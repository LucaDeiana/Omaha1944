"use strict";
// ============================================================
//  Renderer, cielo, luci, post-processing
// ============================================================
let renderer, scene, camera, composer = null, gradePass = null, bloomPass = null, sun, skyMesh, skyMat, FOG_COL;
const SUN_DIR = new V3(-.62, .34, .3).normalize();
const lightPool = [];
const MAT = {};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 }, uSupp: { value: 0 },
    uExposure: { value: 1.1 }, uRes: { value: new THREE.Vector2(1, 1) }, uFade: { value: 0 },
  },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uDamage,uSupp,uExposure,uFade;uniform vec2 uRes;varying vec2 vUv;
  vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
  void main(){
    vec2 c=vUv-.5;
    float ab=(.0012+uDamage*.01+uSupp*.004)*length(c)*2.;
    vec3 col=vec3(texture2D(tDiffuse,vUv+c*ab).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-c*ab).b);
    col=aces(col*uExposure);
    float l=dot(col,vec3(.2126,.7152,.0722));
    col=mix(vec3(l),col,.66-uSupp*.3);
    col*=mix(vec3(.92,.99,1.06),vec3(1.06,1.,.9),smoothstep(.04,.55,l));
    col=pow(col,vec3(1./2.2));
    col=(col-.5)*1.1+.5;
    float v=smoothstep(.95,.28,length(c*vec2(1.25,1.)));
    col*=mix(.42-uSupp*.2,1.,v);
    col=mix(col,vec3(.42,.02,.02),clamp(uDamage*(1.15-v),0.,.9));
    float g=fract(sin(dot(vUv*uRes+fract(uTime*7.3)*91.7,vec2(12.9898,78.233)))*43758.5453);
    col+=(g-.5)*.065;
    col*=1.-uFade;
    gl_FragColor=vec4(col,1.);
  }`
};

function initEngine() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
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
  scene.fog = new THREE.FogExp2(FOG_COL, .0016);
  scene.background = FOG_COL.clone();

  camera = new THREE.PerspectiveCamera(SETTINGS.fov, innerWidth / innerHeight, .05, 5000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(col(0xbcc7cf), col(0x544a3b), .85));
  sun = new THREE.DirectionalLight(col(0xffe2c2), 2.1);
  if (Q.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(Q.shadows, Q.shadows);
    const c = sun.shadow.camera, s = Q.shadowDist;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 10; c.far = 600;
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .05;
  }
  scene.add(sun, sun.target);

  buildSky();
  // mappa d'ambiente dal cielo (riflessi su metalli e acqua)
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
  scene.environment = pm.fromScene(es, .02, .1, 100).texture;
  pm.dispose();

  for (let i = 0; i < Q.lights; i++) {
    const l = new THREE.PointLight(col(0xffaa55), 0, 50, 2);
    l.userData = { t: 0, d: 1, i: 0 };
    scene.add(l); lightPool.push(l);
  }

  MAT.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .02 });
  MAT.vcMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .45 });
  MAT.soldier = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: .04 });

  if (Q.post) {
    const rt = new THREE.WebGLRenderTarget(innerWidth * Q.pr, innerHeight * Q.pr, { type: THREE.HalfFloatType });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.setPixelRatio(Q.pr);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new THREE.RenderPass(scene, camera));
    if (Q.bloom) { bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .45, .5, .92); composer.addPass(bloomPass); }
    gradePass = new THREE.ShaderPass(GradeShader);
    gradePass.uniforms.uRes.value.set(innerWidth, innerHeight);
    composer.addPass(gradePass);
  } else {
    renderer.domElement.style.filter = 'saturate(.72) contrast(1.06)';
    $('vignette').style.display = 'block';
  }
  addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setSize(innerWidth, innerHeight); gradePass.uniforms.uRes.value.set(innerWidth, innerHeight); }
}

function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: SUN_DIR }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 uSunDir;uniform float uTime;varying vec3 vDir;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
    void main(){
      vec3 d=normalize(vDir);float y=d.y;
      vec3 hor=vec3(.64,.68,.69),zen=vec3(.38,.45,.52),gnd=vec3(.55,.58,.58);
      vec3 col=y>0.?mix(hor,zen,pow(clamp(y,0.,1.),.55)):mix(hor,gnd,clamp(-y*5.,0.,1.));
      float sd=max(dot(d,uSunDir),0.);
      col+=vec3(1.,.78,.52)*(pow(sd,6.)*.22+pow(sd,400.)*1.5);
      if(y>0.){
        vec2 uv=d.xz/(y+.07)*1.1+vec2(uTime*.006,uTime*.003);
        float c=fbm(uv);
        float cov=smoothstep(.38,.72,c);
        float shade=smoothstep(.45,.85,fbm(uv*1.8+4.));
        vec3 cc=mix(vec3(.47,.5,.53),vec3(.8,.81,.8),shade);
        cc+=vec3(1.,.82,.55)*pow(sd,5.)*.35*shade;
        col=mix(col,cc,cov*smoothstep(0.,.12,y)*.95);
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

function updateEngine(dt, center, time) {
  sun.position.copy(center).addScaledVector(SUN_DIR, 300);
  sun.target.position.copy(center);
  skyMat.uniforms.uTime.value = time;
  for (const l of lightPool) {
    const u = l.userData;
    if (u.t > 0) { u.t -= dt; l.intensity = u.t > 0 ? u.i * (u.t / u.d) : 0; }
  }
}

function renderFrame(time) {
  skyMesh.position.copy(camera.position);
  if (composer) { gradePass.uniforms.uTime.value = time; composer.render(); }
  else renderer.render(scene, camera);
}
