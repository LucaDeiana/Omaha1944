"use strict";
// ============================================================
//  Texture procedurali generate sulla GPU (albedo+rugosità, normal+altezza)
// ============================================================
const TEX = {};
const NOISE_GLSL = `
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float pn(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 float a=hash12(mod(i,per)),b=hash12(mod(i+vec2(1.,0.),per)),c=hash12(mod(i+vec2(0.,1.),per)),d=hash12(mod(i+vec2(1.,1.),per));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float pfbm(vec2 p,vec2 per,int oct){float s=0.,a=.5,n=0.;for(int i=0;i<7;i++){if(i>=oct)break;s+=a*pn(p,per);n+=a;p*=2.;per*=2.;a*=.5;}return s/n;}
vec3 pvor(vec2 p,vec2 per){vec2 i=floor(p),f=fract(p);float f1=9.,f2=9.,id=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 c=mod(i+g,per);vec2 o=hash22(c);vec2 r=g+o-f;float d=dot(r,r);
  if(d<f1){f2=f1;f1=d;id=hash12(c+17.3);}else if(d<f2)f2=d;}
 return vec3(sqrt(f1),sqrt(f2),id);}
`;

const SURF = {
  sand: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float w=pfbm(uv*4.,vec2(4.),3);
    float rip=sin((uv.y*18.+uv.x*3.+w*2.2)*6.28318)*.5+.5; rip=pow(rip,1.6);
    float big=pfbm(uv*3.,vec2(3.),4);
    float g1=pn(uv*300.,vec2(300.)),g2=pn(uv*120.,vec2(120.));
    h=rip*.3+big*.3+g1*.2+g2*.2;
    vec3 b=mix(vec3(.68,.6,.46),vec3(.57,.49,.37),big);
    b*=.88+.18*g2; b*=.9+.14*g1; b*=.93+.1*rip;
    float sp=step(.982,hash12(mod(floor(uv*600.),600.))); b=mix(b,vec3(.3,.27,.23),sp*.7);
    float sh=step(.997,hash12(mod(floor(uv*300.),300.)+5.)); b=mix(b,vec3(.95,.93,.88),sh);
    c=b; r=.93-rip*.05;}`,
  pebble: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec3 v=pvor(uv*26.,vec2(26.));
    float st=smoothstep(.02,.22,v.y-v.x), dome=sqrt(max(0.,1.-v.x*v.x*2.2)), id=v.z;
    vec3 sc=mix(vec3(.42,.41,.39),vec3(.66,.64,.6),id);
    sc=mix(sc,vec3(.52,.46,.38),step(.72,fract(id*7.31)));
    sc=mix(sc,vec3(.34,.37,.4),step(.86,fract(id*13.7)));
    sc=mix(sc,vec3(.75,.72,.66),step(.93,fract(id*3.1)));
    float n=pn(uv*220.,vec2(220.));
    vec3 gap=vec3(.45,.39,.29)*(.8+.4*pn(uv*150.,vec2(150.)));
    c=mix(gap,sc*(.86+.28*n),st); h=dome*st*.85+n*.08; r=mix(.95,.5,st*dome);}`,
  grass: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float n1=pfbm(uv*5.,vec2(5.),4);
    float bl=pn(vec2(uv.x*220.,uv.y*55.),vec2(220.,55.))*.6+pn(vec2(uv.x*90.,uv.y*30.),vec2(90.,30.))*.4;
    float dry=smoothstep(.55,.75,pfbm(uv*3.+7.,vec2(3.),3));
    vec3 g=mix(vec3(.2,.29,.1),vec3(.38,.44,.18),n1);
    g=mix(g,vec3(.52,.48,.28),dry*.7); g*=.55+.7*bl;
    float soil=smoothstep(.25,.1,bl*n1); g=mix(g,vec3(.3,.24,.16),soil*.5);
    c=g; h=bl*.7+n1*.3; r=.95;}`,
  dirt: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec3 v=pvor(uv*16.,vec2(16.)); float cl=smoothstep(.05,.3,v.y-v.x);
    vec3 s=pvor(uv*60.,vec2(60.)); float stn=smoothstep(.14,.0,s.x)*step(.75,s.z);
    float n=pfbm(uv*6.,vec2(6.),5);
    vec3 d=mix(vec3(.32,.25,.17),vec3(.48,.39,.27),n); d*=.8+.3*cl; d=mix(d,vec3(.52,.5,.46),stn);
    c=d; h=cl*.4+n*.4+stn*.3; r=.96-stn*.3;}`,
  concrete: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float pl=fract(uv.y*6.); float line=smoothstep(.0,.025,pl)*smoothstep(1.,.975,pl);
    float plank=hash12(vec2(mod(floor(uv.y*6.),6.),3.));
    float grain=pn(vec2(uv.x*6.,uv.y*120.),vec2(6.,120.));
    float stain=pfbm(vec2(uv.x*10.,uv.y*2.),vec2(10.,2.),4);
    vec3 pv=pvor(uv*40.,vec2(40.)); float pit=smoothstep(.08,.0,pv.x)*step(.6,pv.z);
    float n=pn(uv*256.,vec2(256.));
    vec3 b=vec3(.64,.62,.57)*(.9+.12*plank)*(.92+.1*grain)*(.85+.2*n);
    b*=mix(.68,1.05,stain); b=mix(b*.7,b,line); b=mix(b,b*.5,pit);
    c=b; h=line*.3+grain*.1+n*.2-pit*.4+stain*.2; r=.9;}`,
  stone: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float rows=8.; float ry=uv.y*rows; float row=floor(ry);
    float bx=uv.x*5.+mod(row,2.)*.5; float cell=floor(bx);
    vec2 f=vec2(fract(bx),fract(ry));
    float jit=hash12(vec2(mod(cell,5.),mod(row,rows)));
    float m=smoothstep(.0,.07,min(min(f.x,1.-f.x)*.6,min(f.y,1.-f.y)));
    float n=pfbm(uv*12.,vec2(12.),4), g=pn(uv*200.,vec2(200.));
    vec3 st=mix(vec3(.62,.58,.5),vec3(.76,.72,.63),jit); st=mix(st,vec3(.55,.53,.5),step(.8,fract(jit*9.)));
    st*=.8+.3*n; st*=.92+.12*g;
    vec3 mort=vec3(.52,.49,.44)*(.9+.2*g);
    c=mix(mort,st,m); h=m*(.6+.4*n)+g*.1; r=mix(.95,.85,m);}`,
  roof: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float rows=14.; float ry=uv.y*rows; float row=floor(ry); float bx=uv.x*10.+mod(row,2.)*.5; float cell=floor(bx);
    vec2 f=vec2(fract(bx),fract(ry)); float jit=hash12(vec2(mod(cell,10.),mod(row,rows)));
    float edge=smoothstep(0.,.07,f.x)*smoothstep(1.,.93,f.x);
    vec3 s=mix(vec3(.24,.26,.29),vec3(.37,.38,.41),jit)*(.85+.25*pn(uv*120.,vec2(120.)));
    s*=mix(.55,1.,smoothstep(0.,.25,f.y)); s*=mix(.65,1.,edge);
    c=s; h=f.y*.6+edge*.2; r=.62;}`,
  wood: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float pk=floor(uv.x*4.); float jit=hash12(vec2(mod(pk,4.),9.));
    float g=sin((uv.y*30.+pfbm(vec2(uv.x*8.,uv.y*2.),vec2(8.,2.),3)*4.+jit*10.)*6.283)*.5+.5;
    float gap=smoothstep(0.,.03,fract(uv.x*4.))*smoothstep(1.,.97,fract(uv.x*4.));
    vec3 w=mix(vec3(.42,.3,.18),vec3(.56,.41,.26),jit)*(.8+.25*g); w*=mix(.35,1.,gap);
    c=w; h=g*.3+gap*.5; r=.85;}`,
  fabric: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec2 p=uv*90.; float tw=sin((p.x+p.y)*3.14159)*.5+.5; float wv=sin(p.x*6.283)*sin(p.y*6.283)*.5+.5;
    float n=pfbm(uv*6.,vec2(6.),4); float grime=pfbm(uv*3.+11.,vec2(3.),3);
    float v=.84+.09*tw+.05*wv; v*=.86+.24*n; v*=mix(1.,.72,smoothstep(.55,.8,grime));
    c=vec3(v); h=tw*.5+wv*.3+n*.2; r=.96;}`,
  metal: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float n=pfbm(uv*8.,vec2(8.),5); float chip=smoothstep(.76,.79,pfbm(uv*48.+3.,vec2(48.),3))*.35;
    float streak=pfbm(vec2(uv.x*30.,uv.y*3.),vec2(30.,3.),3);
    float v=.9+.12*n; v*=mix(1.,.78,streak*smoothstep(.4,.8,n));
    c=mix(vec3(v),vec3(.45,.34,.26),chip); h=.5+n*.3-chip*.3; r=mix(.82,.93,chip);}`,
  gunwood: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float d=pfbm(vec2(uv.x*3.,uv.y*12.),vec2(3.,12.),4);
    float g=sin((uv.x*40.+d*6.)*6.283)*.5+.5; g=pow(g,3.);
    float n=pn(uv*300.,vec2(300.));
    vec3 w=mix(vec3(.3,.17,.08),vec3(.43,.26,.13),d)*(.75+.3*(1.-g))*(.95+.1*n);
    c=w; h=g*.3+n*.1; r=.42+g*.15;}`,
  gunmetal: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float n=pn(uv*400.,vec2(400.)),m=pfbm(uv*8.,vec2(8.),4),s=pfbm(uv*30.,vec2(30.),3);
    c=vec3(.21,.22,.21)*(.85+.25*n)*(.9+.2*m); c=mix(c,vec3(.42,.42,.4),smoothstep(.7,.8,s)*.5);
    h=n*.3; r=.5+.25*n-smoothstep(.7,.8,s)*.2;}`,
  blood: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec2 q=uv-.5; float d=length(q); float n=pfbm(uv*6.,vec2(6.),5);
    float blob=smoothstep(.33,.27,d+(n-.5)*.36);
    float drops=0.; for(int i=0;i<12;i++){vec2 o=hash22(vec2(float(i),3.))-.5; float rr=.012+.028*hash12(vec2(float(i),9.)); drops+=smoothstep(rr,rr*.4,length(q-o*.85));}
    float a=clamp(blob+drops,0.,1.);
    c=mix(vec3(.16,.0,.0),vec3(.34,.02,.02),n); h=a; r=a*(.8+.2*n);}`,
  scorch: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec2 q=uv-.5; float d=length(q); float n=pfbm(uv*5.,vec2(5.),5);
    float a=smoothstep(.5,.12,d+(n-.5)*.32);
    c=vec3(.07,.06,.05)*(.7+.6*n); h=a; r=a*.9;}`,
  smoke: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    vec2 q=uv-.5; float d=length(q)*2.; float n=pfbm(uv*4.,vec2(4.),5),n2=pfbm(uv*9.+3.,vec2(9.),3);
    float a=smoothstep(1.,.15,d)*(.35+.9*n); a*=1.-smoothstep(.55,1.,d);
    c=vec3(.78+.22*n2); h=a; r=clamp(a,0.,1.);}`,
  fire: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float d=length(uv-.5)*2.; float n=pfbm(uv*5.,vec2(5.),4);
    float a=smoothstep(1.,0.,d+(n-.5)*.7);
    c=mix(vec3(1.,.42,.08),vec3(1.,.95,.78),smoothstep(.45,1.,a)); h=a; r=a;}`,
  grain: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float d=length(uv-.5)*2.; float a=smoothstep(1.,.5,d); c=vec3(1.); h=a; r=a;}`,
  water: `void surf(vec2 uv,out vec3 c,out float h,out float r){
    float n=pfbm(uv*6.,vec2(6.),5); float w=pfbm(uv*20.+3.,vec2(20.),3);
    float cr=sin((uv.x*10.+n*3.)*6.283)*.5+.5;
    h=n*.6+w*.25+cr*.15; c=vec3(h); r=1.;}`,
};

let _tScene, _tCam, _tMesh;
function genSurface(name, size, opt = {}) {
  if (!_tScene) {
    _tScene = new THREE.Scene(); _tCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    _tMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); _tMesh.frustumCulled = false; _tScene.add(_tMesh);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMode: { value: 0 }, uTexel: { value: 1 / size }, uStrength: { value: opt.strength || .035 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `precision highp float;uniform float uMode,uTexel,uStrength;varying vec2 vUv;${NOISE_GLSL}${SURF[name]}
    void main(){vec3 c;float h,r;surf(vUv,c,h,r);
      if(uMode<.5){gl_FragColor=vec4(c,r);}
      else{vec3 c2;float hx,hy,r2;surf(fract(vUv+vec2(uTexel,0.)),c2,hx,r2);surf(fract(vUv+vec2(0.,uTexel)),c2,hy,r2);
        vec3 n=normalize(vec3((h-hx)/uTexel*uStrength,(h-hy)/uTexel*uStrength,1.));gl_FragColor=vec4(n*.5+.5,h);}}`,
    depthTest: false, depthWrite: false,
  });
  const mk = () => {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
      generateMipmaps: true, depthBuffer: false, stencilBuffer: false,
    });
    rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return rt;
  };
  _tMesh.material = mat;
  const out = {};
  const a = mk(); mat.uniforms.uMode.value = 0; renderer.setRenderTarget(a); renderer.render(_tScene, _tCam);
  a.texture.encoding = THREE.sRGBEncoding; out.map = a.texture;
  if (opt.normal !== false) { const n = mk(); mat.uniforms.uMode.value = 1; renderer.setRenderTarget(n); renderer.render(_tScene, _tCam); out.normal = n.texture; }
  renderer.setRenderTarget(null); mat.dispose();
  TEX[name] = out; return out;
}
// ---------- texture fotografiche CC0 (ambientCG) ----------
const PHOTO_IMG = {};
function preloadPhotos() {
  const P = window.TEX_PHOTO; if (!P) return Promise.resolve();
  const jobs = [];
  for (const k in P) { PHOTO_IMG[k] = {}; for (const ch of ['c', 'n', 'r']) jobs.push(new Promise(res => { const im = new Image(); im.onload = () => { PHOTO_IMG[k][ch] = im; res(); }; im.onerror = () => res(); im.src = P[k][ch]; })); }
  return Promise.all(jobs);
}
function applyPhotoTextures() {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const k in PHOTO_IMG) {
    const im = PHOTO_IMG[k]; if (!im.c || !im.n) continue;
    const S = im.c.width, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'); g.drawImage(im.c, 0, 0);
    if (im.r) {
      const rc = document.createElement('canvas'); rc.width = rc.height = S; const rg = rc.getContext('2d'); rg.drawImage(im.r, 0, 0, S, S);
      const a = g.getImageData(0, 0, S, S), b = rg.getImageData(0, 0, S, S).data;
      for (let i = 3; i < a.data.length; i += 4) a.data[i] = b[i - 3];
      g.putImageData(a, 0, 0);
    }
    const map = new THREE.CanvasTexture(cv); map.encoding = THREE.sRGBEncoding;
    const nor = new THREE.Texture(im.n); nor.needsUpdate = true;
    for (const t of [map, nor]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
    TEX[k] = { map, normal: nor, photo: true };
  }
}
function buildTextures() {
  const big = Q.tex, mid = Math.min(512, Q.tex), small = Math.min(256, Q.tex);
  genSurface('sand', big, { strength: .03 }); genSurface('pebble', big, { strength: .05 });
  genSurface('grass', big, { strength: .025 }); genSurface('dirt', big, { strength: .04 });
  genSurface('concrete', mid, { strength: .03 }); genSurface('stone', mid, { strength: .04 }); genSurface('roof', mid, { strength: .04 });
  genSurface('wood', mid, { strength: .03 }); genSurface('metal', mid, { strength: .02 }); genSurface('fabric', mid, { strength: .02 });
  genSurface('gunwood', mid, { strength: .015 }); genSurface('gunmetal', small, { strength: .02 });
  genSurface('water', mid, { strength: .06 });
  for (const n of ['blood', 'scorch', 'smoke', 'fire']) genSurface(n, n === 'smoke' ? 256 : 128, { normal: false });
  genSurface('grain', 32, { normal: false });
  applyPhotoTextures();
  for (const k of ['brick', 'plaster', 'cobble']) if (!TEX[k]) TEX[k] = TEX[k === 'brick' ? 'roof' : k === 'plaster' ? 'concrete' : 'stone'];
}

// materiale con mappatura triplanare in coordinate dell'oggetto: la texture resta
// solidale all'oggetto anche quando si muove (barche, aerei, torrette)
function triMaterial(tex, scale, o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, normalMap: tex.normal, roughness: o.rough ?? 1, metalness: o.metal || 0, side: o.side || THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTri = { value: scale }; sh.uniforms.uTriN = { value: o.nStr ?? .8 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP;varying vec3 vTriN;varying mat3 vTriM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP=transformed;vTriN=normalize(objectNormal);vTriM=normalMatrix;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTri,uTriN;varying vec3 vTriP;varying vec3 vTriN;varying mat3 vTriM;')
      .replace('#include <map_fragment>', `
        vec3 bw=pow(abs(vTriN),vec3(4.));bw/=dot(bw,vec3(1.));
        vec2 tx=vTriP.zy*uTri,ty=vTriP.xz*uTri,tz=vTriP.xy*uTri;
        vec4 tcol=mapTexelToLinear(texture2D(map,tx))*bw.x+mapTexelToLinear(texture2D(map,ty))*bw.y+mapTexelToLinear(texture2D(map,tz))*bw.z;
        diffuseColor*=vec4(tcol.rgb,1.);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor*=tcol.a;')
      .replace('#include <normal_fragment_maps>', `
        vec3 nx=texture2D(normalMap,tx).xyz*2.-1.,ny=texture2D(normalMap,ty).xyz*2.-1.,nz=texture2D(normalMap,tz).xyz*2.-1.;
        vec3 wn=normalize(vTriN+uTriN*(bw.x*vec3(0.,nx.y,nx.x)+bw.y*vec3(ny.x,0.,ny.y)+bw.z*vec3(nz.x,nz.y,0.)));
        normal=normalize(vTriM*wn);`);
  };
  return m;
}
// materiale con mappa UV scalata (soldati, armi)
function uvMaterial(tex, scale, o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: o.vc !== false, map: tex.map, normalMap: tex.normal, roughness: o.rough ?? 1, metalness: o.metal || 0, color: col(o.color || 0xffffff) });
  if (o.nScale) m.normalScale.set(o.nScale, o.nScale);
  m.onBeforeCompile = sh => {
    sh.uniforms.uUvS = { value: scale };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uUvS;')
      .replace('texture2D( map, vUv )', 'texture2D( map, vUv*uUvS )')
      .replace('texture2D( normalMap, vUv )', 'texture2D( normalMap, vUv*uUvS )')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor*=texture2D(map,vUv*uUvS).a;');
  };
  return m;
}
