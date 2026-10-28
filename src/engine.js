"use strict";
// ============================================================
//  Renderer, cielo, luci, post-processing, risoluzione dinamica
// ============================================================
let renderer, scene, camera, composer = null, gradePass = null, bloomPass = null, fxaaPass = null, sun, skyMesh, skyMat, FOG_COL, skyCube = null;
const SUN_DIR = new V3(-.62, .34, .3).normalize();
const lightPool = [];
const MAT = {};
const FOG_BASE = .0029;
let FOG_K = 1; // moltiplicatore della nebbia per scenario e meteo
const DYN = { scale: 1, acc: 0, n: 0, t: 0 };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 }, uSupp: { value: 0 }, uShock: { value: 0 },
    uWet: { value: 0 }, uFlash: { value: 0 }, uExposure: { value: 1.1 }, uRes: { value: new THREE.Vector2(1, 1) }, uSat: { value: .77 },
  },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uDamage,uSupp,uShock,uWet,uFlash,uExposure,uSat;uniform vec2 uRes;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
  float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
  vec2 drops(vec2 uv,float t){
    vec2 off=vec2(0.);
    for(int k=0;k<2;k++){
      float sc=k==0?9.:17.;
      vec2 g=uv*vec2(sc*uRes.x/uRes.y,sc);vec2 id=floor(g),f=fract(g)-.5;
      float h=h12(id+float(k)*7.);
      if(h>.55){vec2 c=vec2(h12(id+3.1)-.5,h12(id+5.7)-.5)*.5;float r=.12+.18*h12(id+9.);
        float d=length(f-c);float m=smoothstep(r,r*.6,d);off+=(f-c)*m*.12;}
    }
    return off;
  }
  void main(){
    vec2 uv=vUv;vec2 c=uv-.5;
    if(uWet>0.)uv+=drops(uv,uTime)*uWet;
    float ab=(.0012+uDamage*.01+uSupp*.004+uShock*.012)*length(c)*2.;
    vec3 col=vec3(texture2D(tDiffuse,uv+c*ab).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-c*ab).b);
    // nitidezza adattiva: rinforza i dettagli fini, meno dove il contrasto locale è già alto
    vec2 px=1./uRes;
    vec3 sn=texture2D(tDiffuse,uv+vec2(0.,px.y)).rgb,ss=texture2D(tDiffuse,uv-vec2(0.,px.y)).rgb,se=texture2D(tDiffuse,uv+vec2(px.x,0.)).rgb,sw=texture2D(tDiffuse,uv-vec2(px.x,0.)).rgb;
    vec3 c0=texture2D(tDiffuse,uv).rgb;
    vec3 mn=min(min(min(sn,ss),min(se,sw)),c0),mx=max(max(max(sn,ss),max(se,sw)),c0);
    float amp=clamp(min(min(mn.g,1.-mx.g),1.)/max(mx.g,1e-3),0.,1.);
    col=max(col+(c0*4.-sn-ss-se-sw)*(.05+.1*sqrt(amp)),0.);
    if(uShock>0.){vec3 acc=col;for(int i=1;i<7;i++){float s=1.-float(i)*.018*uShock;acc+=texture2D(tDiffuse,(uv-.5)*s+.5).rgb;}col=acc/7.;}
    col=aces(col*uExposure*(1.+uFlash*3.));
    float l=dot(col,vec3(.2126,.7152,.0722));
    col=mix(vec3(l),col,uSat-uSupp*.3-uShock*.45);
    col*=mix(vec3(.92,.99,1.06),vec3(1.06,1.,.9),smoothstep(.04,.55,l));
    col=pow(col,vec3(1./2.2));
    col=(col-.5)*1.12+.5;
    col*=1.-.05*smoothstep(.35,0.,l); // ombre leggermente più profonde
    float v=smoothstep(.95,.28,length(c*vec2(1.25,1.)));
    col*=mix(.42-uSupp*.2-uShock*.2,1.,v);
    col=mix(col,vec3(.42,.02,.02),clamp(uDamage*(1.15-v),0.,.9));
    float g=fract(sin(dot(vUv*uRes+fract(uTime*7.3)*91.7,vec2(12.9898,78.233)))*43758.5453);
    col+=(g-.5)*(.065+uShock*.06);
    gl_FragColor=vec4(col,1.);
  }`
};

// nebbia esponenziale con attenuazione in quota: la quota del tratto osservato è la media tra camera e punto
function installHeightFog() {
  const C = THREE.ShaderChunk; if (C.__heightFog) return; C.__heightFog = true;  // una sola volta anche se il gioco riparte nella stessa pagina
  C.fog_pars_vertex = '#ifdef USE_FOG\nvarying float fogDepth;\nvarying float vFogY;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\nfogDepth = - mvPosition.z;\nvFogY = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, mvPosition.xyz );\n#endif';
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float fogDepth;', 'varying float fogDepth;\n\tvarying float vFogY;');
  C.fog_fragment = `#ifdef USE_FOG
	float fogH = mix( 1.0, 0.32, smoothstep( 8.0, 320.0, 0.5 * ( cameraPosition.y + vFogY ) ) );
	#ifdef FOG_EXP2
		float fdH = fogDensity * fogH;
		float fogFactor = 1.0 - exp( - fdH * fdH * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

// ---------- ombre: due cascate (vicina fine, lontana ampia) e bordi morbidi a campionamento Poisson ----------
// la mappa vicina segue la telecamera spostata in avanti; quella lontana copre centinaia di metri e
// subentra con una sfumatura dove la vicina finisce. La luce della cascata lontana è nera: serve solo
// a produrre la sua mappa, che viene letta nel calcolo dell'ombra del sole.
let sunFar = null;
function patchShadowChunks() {
  const SC = THREE.ShaderChunk;
  let p = SC.shadowmap_pars_fragment;
  const a = p.indexOf('#if defined( SHADOWMAP_TYPE_PCF )'), b = p.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  if (a < 0 || b < 0) return;
  p = p.slice(0, a) + '#if defined( SHADOWMAP_TYPE_PCF )\n' +
    'vec2 ks = shadowRadius / shadowMapSize;\n' +
    'float ang = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );\n' +
    'float ca = cos( ang ), sa = sin( ang ); mat2 rot = mat2( ca, sa, -sa, ca );\n' +
    'shadow = 0.0;\n' + "shadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.61339, 0.61748 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.17002, -0.04025 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.29942, 0.79192 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.64568, 0.49321 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.65178, 0.71789 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.42100, 0.02707 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.81719, -0.27110 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.70537, -0.66820 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.97705, -0.10862 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.06333, 0.14237 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.20353, 0.21433 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.66753, 0.32609 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.09842, -0.29575 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( -0.88592, 0.21537 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.56664, 0.60521 ) * ks, shadowCoord.z );\nshadow += texture2DCompare( shadowMap, shadowCoord.xy + rot * vec2( 0.03977, -0.39610 ) * ks, shadowCoord.z );\n" + 'shadow *= 1.0 / 16.0;\n' + p.slice(b);
  p = p.replace(/\n#endif\s*$/, '\n#if NUM_DIR_LIGHT_SHADOWS > 1\n' +
    'float csmShadow() {\n' +
    '  vec4 c0 = vDirectionalShadowCoord[ 0 ]; vec2 q = c0.xy / c0.w; vec2 e = min( q, 1.0 - q ); float edge = min( e.x, e.y );\n' +
    '  float s1 = 1.0;\n' +
    '  if ( edge < 0.06 ) s1 = getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );\n' +
    '  if ( edge <= 0.0 ) return s1;\n' +
    '  float s0 = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, c0 );\n' +
    '  return mix( s1, s0, smoothstep( 0.0, 0.06, edge ) );\n' +
    '}\n#endif\n#endif');
  SC.shadowmap_pars_fragment = p;
  const L = 'directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  if (SC.lights_fragment_begin.includes(L)) SC.lights_fragment_begin = SC.lights_fragment_begin.replace(L,
    '#if NUM_DIR_LIGHT_SHADOWS > 1\n directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? ( UNROLLED_LOOP_INDEX == 0 ? csmShadow() : 1.0 ) : 1.0;\n#else\n ' + L + '\n#endif');
}
function initEngine() {
  installHeightFog();
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Q.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = Q.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (Q.shadows) { patchShadowChunks(); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }
  renderer.domElement.id = 'gl';
  document.body.prepend(renderer.domElement);

  scene = new THREE.Scene();
  FOG_COL = col(0xa2acaf).clone();
  scene.fog = new THREE.FogExp2(FOG_COL, FOG_BASE);
  scene.background = FOG_COL.clone();

  camera = new THREE.PerspectiveCamera(SETTINGS.fov, innerWidth / innerHeight, .05, 6000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(col(0xbcc7cf), col(0x544a3b), .85));
  sun = new THREE.DirectionalLight(col(0xffe2c2), 2.1);
  if (Q.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(Q.shadows, Q.shadows);
    const c = sun.shadow.camera, s = Q.shadowDist;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 10; c.far = 700;
    sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.radius = 2.2; sun.shadow.autoUpdate = false;
    // cascata lontana: 4 volte più ampia, aggiornata meno spesso
    sunFar = new THREE.DirectionalLight(0x000000, 0); sunFar.castShadow = true; const fs = Math.max(2048, Q.shadows / 2); sunFar.shadow.mapSize.set(fs, fs);
    const f = sunFar.shadow.camera, S = s * 4.5; f.left = -S; f.right = S; f.top = S; f.bottom = -S; f.near = 10; f.far = 1600;
    sunFar.shadow.bias = -.0008; sunFar.shadow.normalBias = .3; sunFar.shadow.radius = 1.4; sunFar.shadow.autoUpdate = false;
  }
  scene.add(sun, sun.target); if (sunFar) scene.add(sunFar, sunFar.target);

  buildSky();
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
  scene.environment = pm.fromScene(es, .02, .1, 100).texture;
  pm.dispose();
  // cubemap del cielo per i riflessi dell'acqua
  const crt = new THREE.WebGLCubeRenderTarget(128, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cc = new THREE.CubeCamera(.1, 100, crt); es.add(cc); cc.update(renderer, es);
  skyCube = crt.texture;

  for (let i = 0; i < Q.lights; i++) {
    const l = new THREE.PointLight(col(0xffaa55), 0, 60, 2);
    l.userData = { t: 0, d: 1, i: 0 };
    scene.add(l); lightPool.push(l);
  }
  buildTextures();
  MAT.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .02 });
  MAT.vcMetal = wearMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .4 }), { grime: .3, chips: .2, rust: .35, low: 2, scale: .35 });
  MAT.paint = wearMaterial(triMaterial(TEX.metal, .5, { metal: 0, rough: 1, nStr: .5 }), { grime: .55, chips: .3, rust: .12, low: 1.3 });
  MAT.concrete = triMaterial(TEX.concrete, .3, { nStr: 1.2 });
  MAT.stone = triMaterial(TEX.stone, .42, { nStr: 1.4 });
  MAT.brick = triMaterial(TEX.brick, .55, { nStr: 1.3 }); MAT.plaster = triMaterial(TEX.plaster, .38, { nStr: 1 }); MAT.cobble = triMaterial(TEX.cobble, .5, { nStr: 1.4 });
  MAT.plaster.color.setScalar(.74); MAT.stone.color.setScalar(.84); MAT.concrete.color.setScalar(.82);
  MAT.roof = triMaterial(TEX.roof, .5, { nStr: 1.3 });
  MAT.wood = triMaterial(TEX.wood, .55, { nStr: 1 });
  MAT.dirt = triMaterial(TEX.dirt, .45, { nStr: 1 });
  MAT.sack = triMaterial(TEX.fabric, 1.4, { nStr: .7 });
  MAT.soldier = uvMaterial(TEX.fabric, 3, { nScale: .7 });

  if (Q.post) {
    const rt = new THREE.WebGLRenderTarget(innerWidth * Q.pr, innerHeight * Q.pr, { type: THREE.HalfFloatType });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.setPixelRatio(Q.pr);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new THREE.RenderPass(scene, camera));
    if (Q.bloom) { bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .5, .5, .9); composer.addPass(bloomPass); }
    gradePass = new THREE.ShaderPass(GradeShader);
    composer.addPass(gradePass);
    if (Q.fxaa && THREE.FXAAShader) { fxaaPass = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaaPass); }
    setResUniforms();
  } else {
    renderer.domElement.style.filter = 'saturate(.72) contrast(1.06)';
    $('vignette').style.display = 'block';
  }
  addEventListener('resize', onResize);
}
function setResUniforms() {
  const pr = renderer.getPixelRatio();
  if (gradePass) gradePass.uniforms.uRes.value.set(innerWidth, innerHeight);
  if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}
function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  setResUniforms();
}
function setRenderScale(s) {
  DYN.scale = s; const pr = Q.pr * s;
  renderer.setPixelRatio(pr);
  if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); }
  setResUniforms();
}
// risoluzione dinamica: mantiene il gioco fluido abbassando o alzando la risoluzione interna
function updateDynRes(rawDt) {
  if (!SETTINGS.dynres) { if (DYN.scale !== 1) setRenderScale(1); return; }
  DYN.acc += rawDt; DYN.n++; DYN.t += rawDt;
  if (DYN.t < 1.2) return;
  const avg = DYN.acc / DYN.n; DYN.acc = 0; DYN.n = 0; DYN.t = 0;
  const min = Q.prMin / Q.pr;
  if (avg > 1 / 48 && DYN.scale > min + .01) setRenderScale(Math.max(min, DYN.scale - (avg > 1 / 35 ? .15 : .08)));
  else if (avg < 1 / 57 && DYN.scale < 1) setRenderScale(Math.min(1, DYN.scale + .05));
}

function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 }, uCover: { value: 0 }, uGray: { value: 0 } },
    vertexShader: `varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 uSunDir;uniform float uTime,uCover,uGray;varying vec3 vDir;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
    void main(){
      vec3 d=normalize(vDir);float y=d.y;
      vec3 hor=vec3(.64,.68,.69),zen=vec3(.36,.43,.5),gnd=vec3(.55,.58,.58);
      vec3 col=y>0.?mix(hor,zen,pow(clamp(y,0.,1.),.55)):mix(hor,gnd,clamp(-y*5.,0.,1.));
      float sd=max(dot(d,uSunDir),0.);
      col+=vec3(1.,.78,.52)*(pow(sd,6.)*.22+pow(sd,400.)*1.5);
      if(y>0.){
        vec2 uv=d.xz/(y+.07)*1.1+vec2(uTime*.006,uTime*.003);
        float c=fbm(uv),c2=fbm(uv*.45+3.);
        float cov=smoothstep(.36-uCover,.7-uCover*.6,c*.7+c2*.4);
        float sh=fbm(uv*1.8+4.+uSunDir.xz*.15);
        float lit=smoothstep(.3,.9,c-sh*.5+.4);
        vec3 cc=mix(vec3(.42,.45,.48),vec3(.84,.85,.84),lit*(1.-uGray*.6));
        cc+=vec3(1.,.82,.55)*pow(sd,4.)*.4*lit;
        col=mix(col,cc,cov*smoothstep(0.,.12,y)*.96);
      }
      col=mix(col,vec3(.5,.53,.55)*(1.-uGray*.35),uGray*.55);
      gl_FragColor=vec4(pow(col,vec3(2.2)),1.);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat);
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
  scene.add(skyMesh);
}

function flashLight(p, hex, intensity, dur) {
  if (!lightPool.length) return;
  let best = lightPool[0];
  for (const l of lightPool) if (l.userData.t <= 0 || l.userData.t < best.userData.t) best = l;
  best.position.copy(p); best.color.copy(col(hex));
  best.userData.t = dur; best.userData.d = dur; best.userData.i = intensity; best.intensity = intensity;
}

const _snap = new V3(), _snapF = new V3(), _fw = new V3(), _ctr = new V3();
function updateEngine(dt, center, time) {
  // centro ombre agganciato alla griglia dei texel per evitare tremolii
  // la cascata vicina è spostata in avanti nella direzione di sguardo: copre ciò che si vede, non ciò che sta alle spalle
  camera.getWorldDirection(_fw); _fw.y = 0; if (_fw.lengthSq() > 1e-4) _fw.normalize();
  _ctr.copy(center).addScaledVector(_fw, Q.shadowDist * .5);
  if (Q.shadows) { const g = Q.shadowDist * 2 / Q.shadows * 4; _snap.set(Math.round(_ctr.x / g) * g, Math.round(_ctr.y / g) * g, Math.round(_ctr.z / g) * g); }
  else _snap.copy(center);
  sun.position.copy(_snap).addScaledVector(SUN_DIR, 350);
  sun.target.position.copy(_snap);
  if (sunFar) { const sf = sunFar.shadow.camera, g = (sf.right - sf.left) / sunFar.shadow.mapSize.x * 4; _ctr.copy(center).addScaledVector(_fw, Q.shadowDist * 2);
    _snapF.set(Math.round(_ctr.x / g) * g, Math.round(_ctr.y / g) * g, Math.round(_ctr.z / g) * g); sunFar.position.copy(_snapF).addScaledVector(SUN_DIR, 700); sunFar.target.position.copy(_snapF); }
  skyMat.uniforms.uTime.value = time;
  for (const l of lightPool) {
    const u = l.userData;
    if (u.t > 0) { u.t -= dt; l.intensity = u.t > 0 ? u.i * (u.t / u.d) : 0; }
  }
}

let _shF = 0;
// grandi gruppi nascosti quando la nebbia li rende praticamente invisibili
const FOGCULL = [];
function fogCullAdd(obj) { const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) return; FOGCULL.push({ obj, s: b.getBoundingSphere(new THREE.Sphere()) }); }
function renderFrame(time) {
  skyMesh.position.copy(camera.position);
  // oltre questa distanza la nebbia copre tutto: inutile disegnare
  const far = clamp(3 / scene.fog.density, 500, SCEN === 'air' ? 14000 : SCEN === 'sea' ? 26000 : 6000); if (Math.abs(camera.far - far) > 5) { camera.far = far; camera.updateProjectionMatrix(); }
  const lim = 2.05 / scene.fog.density, cp = camera.position;
  if (typeof cityLodUpdate === 'function') cityLodUpdate();
  for (const f of FOGCULL) f.obj.visible = f.s.center.distanceTo(cp) - f.s.radius < lim * (f.k || 1);
  // aggiornamento: vicina a ogni fotogramma (alto/ultra) o a fotogrammi alterni; lontana ogni 4
  if (renderer.shadowMap.enabled) { _shF++; sun.shadow.needsUpdate = Q.shadows >= 4096 || (_shF & 1) === 0; if (sunFar) sunFar.shadow.needsUpdate = (_shF & 3) === 1; }
  if (composer) { gradePass.uniforms.uTime.value = time; composer.render(); }
  else renderer.render(scene, camera);
}
