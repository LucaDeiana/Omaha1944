"use strict";
// ============================================================
//  Renderer, cielo, luci, post-processing, risoluzione dinamica
// ============================================================
let renderer, scene, camera, composer = null, gradePass = null, bloomPass = null, fxaaPass = null, sun, skyMesh, skyMat, FOG_COL, skyCube = null;
const SUN_DIR = new V3(-.62, .34, .3).normalize();
const lightPool = [];
const MAT = {};
const FOG_BASE = .0029;
const DYN = { scale: 1, acc: 0, n: 0, t: 0 };

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 }, uSupp: { value: 0 }, uShock: { value: 0 },
    uWet: { value: 0 }, uFlash: { value: 0 }, uExposure: { value: 1.1 }, uRes: { value: new THREE.Vector2(1, 1) }, uSat: { value: .68 },
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
    if(uShock>0.){vec3 acc=col;for(int i=1;i<7;i++){float s=1.-float(i)*.018*uShock;acc+=texture2D(tDiffuse,(uv-.5)*s+.5).rgb;}col=acc/7.;}
    col=aces(col*uExposure*(1.+uFlash*3.));
    float l=dot(col,vec3(.2126,.7152,.0722));
    col=mix(vec3(l),col,uSat-uSupp*.3-uShock*.45);
    col*=mix(vec3(.92,.99,1.06),vec3(1.06,1.,.9),smoothstep(.04,.55,l));
    col=pow(col,vec3(1./2.2));
    col=(col-.5)*1.1+.5;
    float v=smoothstep(.95,.28,length(c*vec2(1.25,1.)));
    col*=mix(.42-uSupp*.2-uShock*.2,1.,v);
    col=mix(col,vec3(.42,.02,.02),clamp(uDamage*(1.15-v),0.,.9));
    float g=fract(sin(dot(vUv*uRes+fract(uTime*7.3)*91.7,vec2(12.9898,78.233)))*43758.5453);
    col+=(g-.5)*(.065+uShock*.06);
    gl_FragColor=vec4(col,1.);
  }`
};

function initEngine() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Q.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = Q.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (Q.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
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
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
  }
  scene.add(sun, sun.target);

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
  MAT.vcMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .45 });
  MAT.paint = triMaterial(TEX.metal, .5, { metal: 0, rough: 1, nStr: .5 });
  MAT.concrete = triMaterial(TEX.concrete, .3, { nStr: 1.2 });
  MAT.stone = triMaterial(TEX.stone, .42, { nStr: 1.4 });
  MAT.brick = triMaterial(TEX.brick, .55, { nStr: 1.3 }); MAT.plaster = triMaterial(TEX.plaster, .38, { nStr: 1 }); MAT.cobble = triMaterial(TEX.cobble, .5, { nStr: 1.4 });
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
    uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 uSunDir;uniform float uTime;varying vec3 vDir;
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
        float cov=smoothstep(.36,.7,c*.7+c2*.4);
        float sh=fbm(uv*1.8+4.+uSunDir.xz*.15);
        float lit=smoothstep(.3,.9,c-sh*.5+.4);
        vec3 cc=mix(vec3(.42,.45,.48),vec3(.84,.85,.84),lit);
        cc+=vec3(1.,.82,.55)*pow(sd,4.)*.4*lit;
        col=mix(col,cc,cov*smoothstep(0.,.12,y)*.96);
      }
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

const _snap = new V3();
function updateEngine(dt, center, time) {
  // centro ombre agganciato alla griglia dei texel per evitare tremolii
  if (Q.shadows) { const g = Q.shadowDist * 2 / Q.shadows * 4; _snap.set(Math.round(center.x / g) * g, Math.round(center.y / g) * g, Math.round(center.z / g) * g); }
  else _snap.copy(center);
  sun.position.copy(_snap).addScaledVector(SUN_DIR, 350);
  sun.target.position.copy(_snap);
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
  const far = clamp(3 / scene.fog.density, 500, 6000); if (Math.abs(camera.far - far) > 5) { camera.far = far; camera.updateProjectionMatrix(); }
  const lim = 2.05 / scene.fog.density, cp = camera.position;
  for (const f of FOGCULL) f.obj.visible = f.s.center.distanceTo(cp) - f.s.radius < lim * (f.k || 1);
  if (renderer.shadowMap.enabled) { renderer.shadowMap.autoUpdate = false; if ((_shF++ & 1) === 0) renderer.shadowMap.needsUpdate = true; }
  if (composer) { gradePass.uniforms.uTime.value = time; composer.render(); }
  else renderer.render(scene, camera);
}
