"use strict";
// ============================================================
//  AAA Graphics Test — materiali.
//  Texture fotografiche CC0 di ambientCG già nel progetto (colore, normale, rugosità nel canale alfa), applicate in
//  coordinate del mondo (triplanare) con due scale miscelate (meno ripetizione), variazione cromatica a grande scala,
//  umidità e muschio alla base dei muri, smorzamento della luce indiretta dentro gli edifici (gli interni restano
//  in penombra e la luce entra davvero dalle finestre), vento nella vegetazione (solo nello shader).
// ============================================================
const AAA = { on: false, preset: 'HIGH', P: null, mats: {}, rooms: [], time: { value: 0 }, wind: { value: new THREE.Vector2(.8, .35) }, cube: null, st: {}, objs: [], photo: false };
const AAA_PRESETS = {
  LOW: { q: 'basso', terr: 1.0, grass: 0, flowers: 0, leaves: .45, rocks: 300, tiles: false, reflect: false, dust: 0, shafts: false, ivy: .35, near: 40, outer: 8, cube: 64, ssao: 0 },
  MEDIUM: { q: 'medio', pr: 1, shadowMap: 2048, terr: .7, grass: 16000, flowers: 300, leaves: .7, rocks: 1200, tiles: true, reflect: true, dust: 150, shafts: true, ivy: .7, near: 40, outer: 6, cube: 128, ssao: 0 },
  HIGH: { q: 'alto', pr: 1, shadowMap: 4096, terr: .5, grass: 40000, flowers: 900, leaves: .85, rocks: 2600, tiles: true, reflect: true, dust: 320, shafts: true, ivy: 1, near: 34, outer: 5, cube: 256, ssao: 0 },
  ULTRA: { q: 'ultra', pr: 1.25, shadowMap: 4096, terr: .4, grass: 80000, flowers: 1800, leaves: 1.1, rocks: 4500, tiles: true, reflect: true, dust: 600, shafts: true, ivy: 1.3, near: 26, outer: 4, cube: 512, ssao: 16 },
};
function aaaQ() { const p = AAA_PRESETS[AAA.preset] || AAA_PRESETS.HIGH; const q = QUALITY[p.q]; return Object.assign({}, q, { shadowDist: p.near, grass: 0, pr: Math.min(q.pr, p.pr || 1), shadows: q.shadows ? (p.shadowMap || q.shadows) : 0 }); }

const AAA_GLSL_NOISE = `
float aH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float aN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(aH(i),aH(i+vec2(1,0)),f.x),mix(aH(i+vec2(0,1)),aH(i+vec2(1,1)),f.x),f.y);}
float aF(vec2 p){return aN(p)*.5+aN(p*2.03+7.)*.3+aN(p*4.1+3.)*.2;}
uniform vec3 uInMin[6];uniform vec3 uInMax[6];
float aInside(vec3 p){float r=0.;for(int i=0;i<6;i++){vec3 a=step(uInMin[i]-.06,p)*step(p,uInMax[i]+.06);r=max(r,a.x*a.y*a.z);}return r;}`;
const AAA_IN_MIN = Array.from({ length: 6 }, () => new V3(1e5, 1e5, 1e5)), AAA_IN_MAX = Array.from({ length: 6 }, () => new V3(-1e5, -1e5, -1e5));
// stanza interna (fino a 4 volumi): lì la luce indiretta (cielo e ambiente) è ridotta, il sole diretto no
function aaaRoom(x0, y0, z0, x1, y1, z1) { const i = AAA.rooms.length; if (i >= 6) return; AAA.rooms.push([x0, y0, z0, x1, y1, z1]); AAA_IN_MIN[i].set(x0, y0, z0); AAA_IN_MAX[i].set(x1, y1, z1); }

// patch comune: posizione nel mondo, interni, (opzionale) umidità/muschio e vento
function aaaPatch(m, o = {}) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uInMin = { value: AAA_IN_MIN }; sh.uniforms.uInMax = { value: AAA_IN_MAX }; sh.uniforms.uTime = AAA.time; sh.uniforms.uWind = AAA.wind;
    sh.uniforms.uBaseY = { value: o.baseY ?? -1e4 }; sh.uniforms.uMoss = { value: o.moss || 0 }; sh.uniforms.uDamp = { value: o.damp || 0 }; sh.uniforms.uWindK = { value: o.wind || 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAW;uniform float uTime,uWindK;uniform vec2 uWind;' + (o.wind ? 'attribute float wsway;' : ''))
      .replace('#include <project_vertex>', (o.wind ? `
        { vec4 wp0 = modelMatrix * vec4(transformed,1.);
        #ifdef USE_INSTANCING
          wp0 = modelMatrix * instanceMatrix * vec4(transformed,1.);
        #endif
          float k = uWindK * wsway, ph = dot(wp0.xz, vec2(.31,.17));
          vec3 off = vec3(uWind.x, 0., uWind.y) * k * (sin(uTime*1.7+ph)*.6 + sin(uTime*3.1+ph*2.3)*.3 + .35);
          off.y = -k*.15*abs(sin(uTime*2.+ph));
        #ifdef USE_INSTANCING
          transformed += (inverse(mat3(modelMatrix*instanceMatrix)) * off);
        #else
          transformed += (inverse(mat3(modelMatrix)) * off);
        #endif
        }` : '') + '\n#include <project_vertex>')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 w4 = vec4(transformed,1.);\n#ifdef USE_INSTANCING\nw4 = instanceMatrix * w4;\n#endif\nvAW = (modelMatrix * w4).xyz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAW;uniform float uBaseY,uMoss,uDamp;' + AAA_GLSL_NOISE)
      .replace('#include <aomap_fragment>', `{ float ins = aInside(vAW); reflectedLight.indirectDiffuse *= mix(vec3(1.), vec3(.6,.52,.42), ins); reflectedLight.indirectSpecular *= mix(1., .25, ins); }
        #include <aomap_fragment>`);
    if (o.moss || o.damp) sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float hy = vAW.y - uBaseY, n = aF(vAW.xz*1.7 + vAW.y*.9), n2 = aF(vec2(vAW.x+vAW.z, vAW.y)*3.1);
          float damp = uDamp * smoothstep(1.1 + n*.7, 0., hy) * (.55 + .45*n2);
          diffuseColor.rgb *= 1. - damp*.42;
          float moss = uMoss * smoothstep(.75 + n*.6, 0., hy) * smoothstep(.45,.75,n2);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16,.2,.08), moss*.75);
          float streak = uDamp * .25 * smoothstep(.6,.9,aN(vec2(vAW.x*3.+vAW.z*3., vAW.y*.35)));
          diffuseColor.rgb *= 1. - streak; }`);
  };
  m.customProgramCacheKey = () => 'aaa' + (o.wind ? 'w' : '') + (o.moss || o.damp ? 'm' : '') + (o.key || '');
  return m;
}
// materiale fotografico triplanare in coordinate del mondo, due scale miscelate, rugosità dall'alfa
function aaaTri(name, scale, o = {}) {
  const hq = o.hq && typeof TEXH !== 'undefined' && TEXH[o.hq], tex = hq || TEX[name]; if (hq && o.hqScale) scale = o.hqScale; const m = new THREE.MeshStandardMaterial({ vertexColors: !!o.vc, map: tex.map, normalMap: tex.normal, roughness: o.rough ?? 1, metalness: o.metal || 0, color: o.color ?? 0xffffff, side: o.side || THREE.FrontSide });
  m.color.convertSRGBToLinear();
  const p0 = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    sh.uniforms.uTS = { value: scale }; sh.uniforms.uTN = { value: hq ? (o.nStrHQ ?? 1.1) : (o.nStr ?? 1) }; sh.uniforms.uMacro = { value: o.macro ?? .18 }; sh.uniforms.tArm = { value: hq ? hq.arm : tex.map };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTN;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ mat3 nm = mat3(modelMatrix);\n#ifdef USE_INSTANCING\nnm = mat3(modelMatrix*instanceMatrix);\n#endif\nvTN = normalize(nm*objectNormal); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTN;uniform float uTS,uTN,uMacro;uniform sampler2D tArm;' + (hq ? '\n#define AAA_HQ' : ''))
      .replace('#include <map_fragment>', `
        vec3 bw=pow(abs(vTN),vec3(5.));bw/=dot(bw,vec3(1.));
        vec2 tx=vAW.zy*uTS,ty=vAW.xz*uTS,tz=vAW.xy*uTS; vec2 tx2=vec2(-vAW.y,vAW.z)*uTS*.43+.37,ty2=vec2(vAW.z,-vAW.x)*uTS*.43+.61,tz2=vec2(-vAW.y,vAW.x)*uTS*.43+.13;
        float bl = smoothstep(.35,.65,aN(vAW.xz*.13+vAW.y*.07));
        vec4 c1=mapTexelToLinear(texture2D(map,tx))*bw.x+mapTexelToLinear(texture2D(map,ty))*bw.y+mapTexelToLinear(texture2D(map,tz))*bw.z;
        vec4 c2=mapTexelToLinear(texture2D(map,tx2))*bw.x+mapTexelToLinear(texture2D(map,ty2))*bw.y+mapTexelToLinear(texture2D(map,tz2))*bw.z;
        vec4 tcol = mix(c1, c2, bl*.5);
        float mac = aF(vAW.xz*.09 + vAW.y*.05); tcol.rgb *= 1. + (mac-.5)*uMacro*2.;
        diffuseColor *= vec4(tcol.rgb,1.);
        #ifdef AAA_HQ
          vec4 arm = texture2D(tArm,tx)*bw.x+texture2D(tArm,ty)*bw.y+texture2D(tArm,tz)*bw.z; diffuseColor.rgb *= mix(1., arm.r, .75);
        #endif`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef AAA_HQ\nroughnessFactor *= mix(.55, 1., arm.g);\n#else\nroughnessFactor *= mix(.62,1.,tcol.a);\n#endif')
      .replace('#include <normal_fragment_maps>', `
        vec3 nx=texture2D(normalMap,tx).xyz*2.-1.,ny=texture2D(normalMap,ty).xyz*2.-1.,nz=texture2D(normalMap,tz).xyz*2.-1.;
        vec3 wn=normalize(vTN+uTN*(bw.x*vec3(0.,nx.y,nx.x)+bw.y*vec3(ny.x,0.,ny.y)+bw.z*vec3(nz.x,nz.y,0.)));
        normal=normalize(mat3(viewMatrix)*wn);`);
    if (p0) p0(sh, r);
  };
  aaaPatch(m, o);
  const k0 = m.customProgramCacheKey; m.customProgramCacheKey = () => 'tri' + name + (hq ? 'hq' : '') + k0();
  return m;
}
// materiali condivisi della demo (creati una volta)
function aaaMats() {
  if (AAA.mats.stone) return AAA.mats;
  const M = AAA.mats;
  M.stone = aaaTri('cobble', .42, { nStr: 1.5, macro: .22, moss: 1, damp: 1, color: 0xd8d0bc });
  M.stoneLight = aaaTri('stone', .7, { nStr: 1.2, macro: .12, color: 0xece4d0 });
  M.stoneDark = aaaTri('stone', .55, { nStr: 1.6, macro: .2, moss: 1.2, damp: 1.3, color: 0xa89e8a });
  M.plaster = aaaTri('plaster', .45, { nStr: 1, macro: .25, damp: 1.2, moss: .4, color: 0xe6dcc4 });
  M.brick = aaaTri('brick', .75, { nStr: 1.3, macro: .16, damp: 1, moss: .5, color: 0xe0b8a0 });
  M.wood = aaaTri('wood', .9, { nStr: 1.1, macro: .25, color: 0xb8a088, hq: 'tavole_vecchie', hqScale: .55 });
  M.woodDark = aaaTri('wood', .9, { nStr: 1.1, macro: .25, color: 0x7a6a58, hq: 'tavole_vecchie', hqScale: .6 });
  M.woodOld = aaaTri('wood', .7, { nStr: 1.3, macro: .3, color: 0xa89c88, damp: .8, moss: .5, hq: 'tavole_fienile', hqScale: .5 });
  M.paint = aaaTri('wood', .9, { nStr: .8, macro: .3, vc: true, rough: .9, hq: 'tavole_vecchie', hqScale: .7 });   // persiane e porte dipinte: colore dai vertici
  M.metal = aaaTri('metal', .8, { nStr: .8, rough: .7, metal: .35, macro: .3, color: 0x9a9690, hq: 'metallo', hqScale: 1.2 });
  M.rust = aaaTri('metal', .6, { nStr: 1, rough: .85, metal: .2, macro: .4, color: 0xc8a088, hq: 'metallo', hqScale: 1 });
  M.roofTile = aaaPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0, normalMap: TEX.roof.normal, normalScale: new THREE.Vector2(.5, .5) }), { key: 'tile' });
  M.vc = aaaPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), { key: 'vc' });
  M.cloth = aaaPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, normalMap: TEX.fabric.normal, normalScale: new THREE.Vector2(.6, .6) }), { key: 'cloth' });
  M.straw = aaaTri('fabric', 1.6, { nStr: 1.4, macro: .35, color: 0xc8a860 });
  M.sack = aaaTri('fabric', 1.4, { nStr: 1, macro: .3, color: 0x8a7a5c });
  M.glass = aaaPatch(new THREE.MeshStandardMaterial({ color: 0x1a2024, roughness: .06, metalness: .1, transparent: true, opacity: .55, envMapIntensity: 1.4 }), { key: 'glass' });
  M.water = aaaPatch(new THREE.MeshStandardMaterial({ color: new THREE.Color(0x3a3226).convertSRGBToLinear(), vertexColors: true, transparent: true, depthWrite: false, roughness: .06, metalness: 0, envMapIntensity: .95, normalMap: TEX.sand.normal, normalScale: new THREE.Vector2(.035, .035) }), { key: 'water' });
  M.bark = aaaTri('wood', 1.4, { nStr: 1.8, macro: .35, color: 0x6c6458, moss: .6 });
  M.terra = aaaTri('dirt', .5, { nStr: 1.2, macro: .3, color: 0x9a8a72 });
  return M;
}
// texture disegnate su canvas: atlante delle foglie (quercia, melo, siepe, edera), erba con alfa, tessuto a quadri
function aaaCanvasTex(w, h, fn, alpha = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (!alpha) t.format = THREE.RGBFormat; return t; }
function aaaLeafAtlas() {
  if (AAA.leafTex) return AAA.leafTex;
  const sr = seeded(4401), r = (a, b) => a + sr() * (b - a);
  // 4 quadranti: 0 quercia, 1 melo/foglia ovale, 2 siepe fitta (biancospino/nocciolo), 3 edera
  const PH = AAA.leafImg, SZ = PH ? 2048 : 1024;
  AAA.leafTex = aaaCanvasTex(SZ, SZ, (g) => {
    g.clearRect(0, 0, SZ, SZ); if (PH) { g.drawImage(PH, 0, 0, SZ, SZ); g.scale(SZ / 1024, SZ / 1024); }
    const leaf = (x, y, s, a, kind, col) => {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); g.fillStyle = col; g.beginPath();
      if (kind === 0) { // quercia lobata
        g.moveTo(0, 0); for (let i = 0; i <= 10; i++) { const t = i / 10, w = Math.sin(t * Math.PI) * (.38 + .1 * Math.sin(t * 22)); g.lineTo(w * 30, -t * 70); } for (let i = 10; i >= 0; i--) { const t = i / 10, w = Math.sin(t * Math.PI) * (.38 + .1 * Math.sin(t * 22 + 1)); g.lineTo(-w * 30, -t * 70); }
      } else if (kind === 3) { // edera a tre lobi
        g.moveTo(0, 0); g.bezierCurveTo(-30, -5, -34, -30, -14, -36); g.bezierCurveTo(-12, -55, 12, -55, 14, -36); g.bezierCurveTo(34, -30, 30, -5, 0, 0);
      } else { g.moveTo(0, 0); g.bezierCurveTo(-18, -18, -16, -52, 0, -66); g.bezierCurveTo(16, -52, 18, -18, 0, 0); }
      g.fill(); g.strokeStyle = 'rgba(30,40,15,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, kind === 3 ? -40 : -64); g.stroke(); g.restore();
    };
    const pal = [['#3d5a22', '#4a6a28', '#56742e', '#2f4a1a', '#6a7a32'], ['#4a6a2a', '#5a7a32', '#3e5a22', '#6a8238'], ['#34501e', '#3e5a22', '#486a28', '#2a4218', '#5a6e2a'], ['#22381a', '#2e4a20', '#3a5a26', '#1e3016']];
    for (let q = PH ? 3 : 0; q < 4; q++) {
      const ox = (q % 2) * 512, oy = Math.floor(q / 2) * 512, n = q === 2 ? 240 : q === 3 ? 90 : 150;
      g.save(); g.beginPath(); g.rect(ox, oy, 512, 512); g.clip();
      // rametti
      g.strokeStyle = '#3a2e22'; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(ox + 256, oy + 500); g.quadraticCurveTo(ox + r(100, 412), oy + r(200, 400), ox + r(40, 472), oy + r(40, 300)); g.stroke(); }
      for (let i = 0; i < n; i++) { const a = r(0, Math.PI * 2), d = Math.sqrt(sr()) * 220, x = ox + 256 + Math.cos(a) * d, y = oy + 256 + Math.sin(a) * d * .9; leaf(x, y, q === 3 ? r(.9, 1.4) : q === 2 ? r(.4, .65) : r(.6, 1), r(0, Math.PI * 2), q, pal[q][(sr() * pal[q].length) | 0]); }
      g.restore();
    }
  });
  return AAA.leafTex;
}
function aaaLeafMat() {
  if (AAA.mats.leaf) return AAA.mats.leaf;
  const m = new THREE.MeshStandardMaterial({ map: aaaLeafAtlas(), alphaTest: .45, side: THREE.DoubleSide, roughness: .78, metalness: 0, vertexColors: true });
  m.shadowSide = THREE.DoubleSide; aaaPatch(m, { wind: .9, key: 'leaf' });
  // sottofondo traslucido: le foglie in controluce schiariscono (approssimazione)
  const p0 = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { p0(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * .12;'); };
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: .45 });
  AAA.mats.leafDepth = dm; return AAA.mats.leaf = m;
}
