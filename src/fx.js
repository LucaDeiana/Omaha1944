"use strict";
// ============================================================
//  Effetti: particelle, traccianti, detriti, bossoli, decalcomanie,
//  onde d'urto, emettitori persistenti, sporco sull'obiettivo
// ============================================================
let PS_SMOKE, PS_FIRE, PS_GRAIN;
const emitters = [];
const FXP = { tr: null, trList: [], trI: 0, deb: null, debList: [], debI: 0, cas: null, casList: [], casI: 0, dec: {}, rings: [], ringI: 0 };
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fs = new V3(), _fp = new V3(), _fu = new V3(0, 1, 0), _fz = new THREE.Matrix4().makeScale(0, 0, 0);

function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}
function dist2Cam(p) { const dx = p.x - camera.position.x, dz = p.z - camera.position.z; return dx * dx + dz * dz; }

const P_VS = `attribute float aSize;attribute vec4 aCol;attribute float aRot;
uniform float uScale,fogDensity;varying vec4 vCol;varying float vRot,vFog;
void main(){vCol=aCol;vRot=aRot;vec4 mv=modelViewMatrix*vec4(position,1.);
gl_PointSize=min(aSize*uScale/max(-mv.z,.3),900.);gl_Position=projectionMatrix*mv;
float fd=-mv.z;vFog=1.-exp(-fogDensity*fogDensity*fd*fd);}`;
const P_FS = `uniform sampler2D uTex;uniform vec3 fogColor;varying vec4 vCol;varying float vRot,vFog;
void main(){vec2 uv=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y)+.5;
vec4 t=mapTexelToLinear(texture2D(uTex,uv));
#ifdef ADD
gl_FragColor=vec4(vCol.rgb*t.rgb,t.a*vCol.a*(1.-vFog));
#else
gl_FragColor=vec4(mix(vCol.rgb*t.rgb,fogColor,vFog),t.a*vCol.a);
#endif
#include <tonemapping_fragment>
#include <encodings_fragment>
}`;
class Particles {
  constructor(n, additive, tex) {
    this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.sz = new Float32Array(n); this.c = new Float32Array(n * 4); this.r = new Float32Array(n);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.drag = new Float32Array(n); this.g = new Float32Array(n); this.rs = new Float32Array(n); this.gr = new Uint8Array(n);
    const geo = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage);
    this.aR = new THREE.BufferAttribute(this.r, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aP); geo.setAttribute('aSize', this.aS); geo.setAttribute('aCol', this.aC); geo.setAttribute('aRot', this.aR);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uScale: { value: 800 }, fogColor: { value: FOG_COL }, fogDensity: { value: scene.fog.density } },
      vertexShader: P_VS, fragmentShader: P_FS, defines: additive ? { ADD: '' } : {},
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat.map = tex; // per mapTexelToLinear
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 4 : 3;
    scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a, cr, cg, cb, drag = 0, grav = 0, ground = 0) {
    const i = this.i; this.i = (i + 1) % this.n; const k = i * 3, k4 = i * 4;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.c[k4] = cr; this.c[k4 + 1] = cg; this.c[k4 + 2] = cb; this.c[k4 + 3] = 0;
    this.drag[i] = drag; this.g[i] = grav; this.r[i] = R() * TAU; this.rs[i] = (R() - .5) * 1.2; this.sz[i] = s0; this.gr[i] = ground;
  }
  update(dt) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3, k4 = i * 4;
      if (this.life[i] <= 0) { this.sz[i] = 0; this.c[k4 + 3] = 0; continue; }
      const t = 1 - this.life[i] / this.max[i], dr = Math.exp(-this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr - this.g[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      if (this.gr[i] && this.v[k + 1] < 0) { const gy = Hf(this.p[k], this.p[k + 2]); if (this.p[k + 1] < gy) { this.p[k + 1] = gy; this.v[k] = this.v[k + 1] = this.v[k + 2] = 0; this.life[i] = Math.min(this.life[i], .4); } }
      this.sz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - t) * (1 - t));
      this.c[k4 + 3] = this.a0[i] * Math.min(1, t * 12) * (1 - t);
      this.r[i] += this.rs[i] * dt;
    }
    this.aP.needsUpdate = this.aS.needsUpdate = this.aC.needsUpdate = this.aR.needsUpdate = true;
    this.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * PI / 360));
    this.mat.uniforms.fogDensity.value = scene.fog.density;
  }
}

function initFX() {
  PS_SMOKE = new Particles(Math.round(4500 * Q.particles), false, TEX.smoke.map);
  PS_FIRE = new Particles(Math.round(1600 * Q.particles), true, TEX.fire.map);
  PS_GRAIN = new Particles(Math.round(5000 * Q.particles), false, TEX.grain.map);
  // traccianti: cilindri luminosi
  const tg = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); tg.translate(0, .5, 0);
  FXP.tr = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5.5, 2), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 320);
  FXP.tr.frustumCulled = false; FXP.tr.renderOrder = 5; scene.add(FXP.tr);
  for (let i = 0; i < 320; i++) { FXP.trList.push({ on: false, a: new V3(), d: new V3(), len: 0, s: 0, w: 1 }); FXP.tr.setMatrixAt(i, _fz); }
  // detriti
  FXP.deb = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), MAT.dirt, 220);
  FXP.deb.frustumCulled = false; FXP.deb.castShadow = true; scene.add(FXP.deb);
  for (let i = 0; i < 220; i++) { FXP.debList.push({ p: new V3(), v: new V3(), r: new THREE.Euler(), sp: new V3(), s: 1, life: 0 }); FXP.deb.setMatrixAt(i, _fz); }
  // bossoli
  const cg = new THREE.CylinderGeometry(.0055, .006, .063, 8); cg.rotateX(PI / 2);
  FXP.cas = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: col(0xc49a45), metalness: 1, roughness: .3 }), 80);
  FXP.cas.frustumCulled = false; scene.add(FXP.cas);
  for (let i = 0; i < 80; i++) { FXP.casList.push({ p: new V3(), v: new V3(), r: new THREE.Euler(), sp: new V3(), life: 0, rest: false, tink: 0 }); FXP.cas.setMatrixAt(i, _fz); }
  // decalcomanie (bruciature, sangue)
  const dg = new THREE.PlaneGeometry(1, 1); dg.rotateX(-PI / 2);
  for (const [name, n, tex] of [['scorch', 120, TEX.scorch.map], ['blood', 200, TEX.blood.map]]) {
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: name === 'blood' ? .25 : 1, metalness: 0 });
    const im = new THREE.InstancedMesh(dg, m, n); im.frustumCulled = false; im.renderOrder = 1; im.receiveShadow = true; scene.add(im);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, _fz);
    FXP.dec[name] = { im, n, i: 0, list: Array.from({ length: n }, () => ({ p: new V3(), q: new THREE.Quaternion(), s: 0, t: 0, grow: 0, g: 0 })) };
  }
  // onde d'urto
  const rg = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: col(0xfff1d8), transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    m.visible = false; scene.add(m); FXP.rings.push({ m, t: 0, s: 1 });
  }
  initLens();
}

// ---------- API ----------
const C_SAND = [.58, .49, .35], C_DIRT = [.27, .21, .14], C_STONE = [.45, .44, .42], C_WATER = [.82, .86, .88], C_SMOKE = [.24, .24, .24], C_BLACK = [.035, .033, .03];
function fxMuzzle(p, dir, big) {
  const s = big ? 1 : .6;
  for (let i = 0; i < 4; i++) PS_FIRE.emit(p.x + dir.x * i * .14 * s, p.y + dir.y * i * .14 * s, p.z + dir.z * i * .14 * s, dir.x * 3, dir.y * 3, dir.z * 3, .045, .4 * s * (1 - i * .15), .6 * s, 1, 5, 3, 1.2);
  PS_SMOKE.emit(p.x, p.y, p.z, dir.x * 1.5, .4, dir.z * 1.5, rnd(.7, 1.4), .2 * s, 1.4 * s, .3, .55, .55, .55, 1.5, -.3);
}
function fxImpact(p, kind, dir) {
  if (dist2Cam(p) > 260 * 260) return;
  const near = dist2Cam(p) < 60 * 60;
  if (kind === 'water') {
    for (let i = 0; i < (near ? 12 : 5); i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-.9, .9), rnd(3, 7.5), rnd(-.9, .9), rnd(.6, 1), .05, .04, .9, ...C_WATER, .3, 9.8);
    PS_SMOKE.emit(p.x, p.y + .3, p.z, 0, 2.5, 0, .7, .2, .9, .55, ...C_WATER, 2, 4);
    PS_SMOKE.emit(p.x, p.y, p.z, 0, .3, 0, 1.2, .3, 1.4, .3, ...C_WATER, 1);
  } else if (kind === 'metal' || kind === 'stone') {
    for (let i = 0; i < 8; i++) PS_FIRE.emit(p.x, p.y, p.z, rnd(-5, 5), rnd(0, 6), rnd(-5, 5), rnd(.08, .25), .05, .02, 1, 4, 2.5, 1, 2, 9);
    PS_SMOKE.emit(p.x, p.y, p.z, 0, .6, 0, rnd(.6, 1), .2, 1.1, .55, ...C_STONE, 1);
    if (kind === 'stone') for (let i = 0; i < 4; i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), .8, .04, .03, 1, ...C_STONE, .2, 9.8, 1);
  } else if (kind === 'wood') {
    for (let i = 0; i < 6; i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), 1, .05, .04, 1, .45, .32, .2, .2, 9.8, 1);
  } else {
    const c = kind === 'sand' ? C_SAND : C_DIRT, n = near ? 1 : .4;
    // getto di sabbia verticale
    for (let i = 0; i < 3; i++) PS_SMOKE.emit(p.x, p.y + i * .25, p.z, rnd(-.3, .3), rnd(2, 4.5) - i, rnd(-.3, .3), rnd(.6, 1.1), .12, rnd(.6, 1.1), .8, ...c, 2.5, 3);
    for (let i = 0; i < 18 * n; i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-1.6, 1.6), rnd(2.5, 7), rnd(-1.6, 1.6), rnd(.7, 1.3), rnd(.03, .07), .04, 1, c[0] * .8, c[1] * .8, c[2] * .8, .3, 11, 1);
    PS_SMOKE.emit(p.x, p.y, p.z, rnd(-.3, .3), .5, rnd(-.3, .3), rnd(1.5, 2.5), .3, 1.8, .4, ...c, 1, -.1);
  }
}
function fxShock(p, size) {
  const r = FXP.rings[FXP.ringI]; FXP.ringI = (FXP.ringI + 1) % FXP.rings.length;
  r.m.visible = true; r.m.position.copy(p); r.t = 0; r.s = size;
}
function fxExplosion(p, size, water) {
  const d2 = dist2Cam(p), far = d2 > 500 * 500, near = d2 < 90 * 90;
  flashLight(new V3(p.x, p.y + 2, p.z), 0xffa050, 90 * size, .4);
  if (!far) fxShock(new V3(p.x, p.y + .5, p.z), size * 6);
  const nf = far ? 6 : 22;
  for (let i = 0; i < nf; i++) {
    const a = R() * TAU, u = rnd(.2, 1), sp = rnd(2, 8) * size;
    PS_FIRE.emit(p.x, p.y + .5, p.z, Math.cos(a) * sp * (1 - u * .5), u * sp * 1.3, Math.sin(a) * sp * (1 - u * .5), rnd(.2, .5), size * 1.2, size * 3.4, 1, 4, 2.2, .8, 3, -1);
  }
  if (water) {
    for (let i = 0; i < (far ? 10 : 34); i++) PS_SMOKE.emit(p.x + rnd(-1, 1) * size, p.y, p.z + rnd(-1, 1) * size, rnd(-1.5, 1.5) * size, rnd(9, 17) * size, rnd(-1.5, 1.5) * size, rnd(1.4, 2.4), size * .8, size * 2.8, .85, ...C_WATER, .4, 9.8);
    if (!far) for (let i = 0; i < 80 * Q.particles; i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-4, 4) * size, rnd(8, 18) * size, rnd(-4, 4) * size, rnd(1.5, 2.6), .08, .06, .9, ...C_WATER, .2, 9.8);
    for (let i = 0; i < 6; i++) PS_SMOKE.emit(p.x, p.y + 1, p.z, rnd(-2, 2), rnd(.5, 2), rnd(-2, 2), rnd(2, 4), size * 2, size * 7, .45, ...C_WATER, .6, -.2);
  } else {
    const c = p.z > -58 ? C_SAND : C_DIRT;
    for (let i = 0; i < (far ? 6 : 22); i++) PS_SMOKE.emit(p.x, p.y + .5, p.z, rnd(-2.5, 2.5) * size, rnd(6, 14) * size, rnd(-2.5, 2.5) * size, rnd(1, 1.9), size * .6, size * 2.2, .95, ...c, .6, 9.8);
    if (!far) for (let i = 0; i < 160 * Q.particles; i++) PS_GRAIN.emit(p.x, p.y + .3, p.z, rnd(-5, 5) * size, rnd(5, 18) * size, rnd(-5, 5) * size, rnd(1.5, 3.5), rnd(.04, .11), .06, 1, c[0] * .7, c[1] * .7, c[2] * .7, .15, 9.8, 1);
    for (let i = 0; i < (far ? 4 : 14); i++) PS_SMOKE.emit(p.x + rnd(-1, 1) * size, p.y + rnd(0, 2) * size, p.z + rnd(-1, 1) * size, rnd(-1, 1), rnd(.8, 2.4), rnd(-1, 1), rnd(5, 10), size * 1.8, size * 8, .65, ...C_SMOKE, .3, -.15);
    if (!far) fxDebris(p, Math.round(10 * Math.min(size, 2.2)), size, c === C_SAND);
    addDecal('scorch', p, size * 4.5);
  }
  if (near && P.mode === 'foot') { const k = 1 - Math.sqrt(d2) / 90; lensSplat(water ? 'water' : 'dirt', k * size); }
}
function fxDebris(p, n, size) {
  for (let i = 0; i < n; i++) {
    const d = FXP.debList[FXP.debI]; FXP.debI = (FXP.debI + 1) % FXP.debList.length;
    d.p.copy(p); d.p.y += .4; d.v.set(rnd(-7, 7) * size, rnd(7, 16) * size, rnd(-7, 7) * size); d.life = rnd(3, 6);
    d.s = rnd(.06, .22) * Math.min(size, 2); d.sp.set(rnd(-10, 10), rnd(-10, 10), rnd(-10, 10));
  }
}
function fxTracer(a, b, w = 1) {
  const t = FXP.trList[FXP.trI]; FXP.trI = (FXP.trI + 1) % FXP.trList.length;
  t.on = true; t.a.copy(a); t.d.subVectors(b, a); t.len = t.d.length(); t.d.normalize(); t.s = rnd(0, 5); t.w = w;
}
function fxCasing(p, v) {
  const c = FXP.casList[FXP.casI]; FXP.casI = (FXP.casI + 1) % FXP.casList.length;
  c.p.copy(p); c.v.copy(v); c.life = 12; c.rest = false; c.tink = 0; c.sp.set(rnd(-25, 25), rnd(-25, 25), rnd(-25, 25));
}
function addDecal(type, p, s, grow = 0) {
  const D_ = FXP.dec[type]; const e = D_.list[D_.i]; const idx = D_.i; D_.i = (D_.i + 1) % D_.n;
  const n = HN(p.x, p.z);
  e.p.set(p.x, Hf(p.x, p.z) + .05 + R() * .02, p.z);
  e.q.setFromUnitVectors(_fu, n); e.q.multiply(_fq.setFromAxisAngle(_fu, R() * TAU));
  e.s = grow ? s * .15 : s; e.g = s; e.grow = grow;
  _fm.compose(e.p, e.q, _fs.set(e.s, 1, e.s)); D_.im.setMatrixAt(idx, _fm); D_.im.instanceMatrix.needsUpdate = true;
}
function addEmitter(p, type, scale = 1) { const e = { p: p.clone(), type, scale, acc: 0, on: true, life: Infinity }; emitters.push(e); return e; }

function updateFX(dt) {
  PS_SMOKE.update(dt); PS_FIRE.update(dt); PS_GRAIN.update(dt);
  for (let ei = emitters.length - 1; ei >= 0; ei--) {
    const e = emitters[ei];
    e.life -= dt; if (e.life <= 0) { emitters.splice(ei, 1); continue; }
    if (!e.on) continue;
    if (e.follow) e.follow(e.p);
    const d2 = dist2Cam(e.p); if (d2 > 1200 * 1200) continue;
    const s = e.scale, far = d2 > 300 * 300;
    e.acc += dt * (far ? .4 : 1);
    if (e.type === 'fire') {
      while (e.acc > .05) {
        e.acc -= .05;
        PS_FIRE.emit(e.p.x + rnd(-1, 1) * s, e.p.y + rnd(0, .5) * s, e.p.z + rnd(-1, 1) * s, rnd(-.3, .3), rnd(1.5, 3) * s, rnd(-.3, .3), rnd(.5, .9), s * .9, s * .3, .9, 3, 1.5, .5, .5, -.5);
        if (R() < .5) PS_SMOKE.emit(e.p.x, e.p.y + s, e.p.z, rnd(-.3, .3) + .5, rnd(2, 3.5) * s, rnd(-.3, .3), rnd(7, 12), s * 1.2, s * 7, .72, ...C_BLACK, .1, -.1);
        if (R() < .2 && !far) PS_GRAIN.emit(e.p.x, e.p.y + s, e.p.z, rnd(-1, 1), rnd(2, 5), rnd(-1, 1), rnd(1, 2.5), .03, .01, 1, 4, 1.6, .3, .5, -1);
      }
    } else if (e.type === 'smoke') {
      while (e.acc > .16) { e.acc -= .16; PS_SMOKE.emit(e.p.x + rnd(-1, 1) * s, e.p.y, e.p.z + rnd(-1, 1) * s, .6, rnd(1.5, 2.5) * s, rnd(-.2, .2), rnd(8, 13), s * 1.5, s * 9, .55, ...C_SMOKE, .05, -.05); }
    } else if (e.type === 'bank') {
      while (e.acc > .4) { e.acc -= .4; PS_SMOKE.emit(e.p.x + rnd(-6, 6) * s, e.p.y + rnd(0, 1), e.p.z + rnd(-3, 3) * s, rnd(1.2, 2.2), rnd(.1, .4), rnd(-.3, .3), rnd(12, 18), s * 3, s * 10, .26, .5, .5, .5, .02, -.01); }
    } else if (e.type === 'stack') {
      while (e.acc > .3) { e.acc -= .3; PS_SMOKE.emit(e.p.x, e.p.y, e.p.z, rnd(1, 2), rnd(2, 3), 0, rnd(8, 12), s * 2, s * 10, .5, .12, .12, .12, .05, 0); }
    } else if (e.type === 'bleed') {
      while (e.acc > .07) { e.acc -= .07; PS_GRAIN.emit(e.p.x, e.p.y, e.p.z, rnd(-.5, .5), rnd(.5, 2), rnd(-.5, .5), .8, .04, .03, 1, .22, .01, .01, .2, 9.8, 1); }
    } else if (e.type === 'trail') {
      while (e.acc > .03) { e.acc -= .03; PS_SMOKE.emit(e.p.x, e.p.y, e.p.z, rnd(-.3, .3), rnd(.2, .6), rnd(-.3, .3), rnd(2, 4), s * .6, s * 3, .6, ...C_BLACK, .5, -.2); if (R() < .4) PS_FIRE.emit(e.p.x, e.p.y, e.p.z, 0, 0, 0, .15, s * .7, s * .2, 1, 3, 1.5, .5); }
    }
  }
  // traccianti
  const cp = camera.position;
  for (let i = 0; i < FXP.trList.length; i++) {
    const t = FXP.trList[i];
    if (!t.on) continue;
    t.s += 600 * dt;
    if (t.s > t.len + 8) { t.on = false; FXP.tr.setMatrixAt(i, _fz); continue; }
    const s1 = Math.min(t.s, t.len), s0 = Math.max(0, t.s - 9);
    _fp.copy(t.a).addScaledVector(t.d, s0);
    const dc = Math.max(1, _fp.distanceTo(cp));
    _fq.setFromUnitVectors(_fu, t.d);
    const rad = Math.min(.25, .012 + dc * .0011) * t.w;
    _fm.compose(_fp, _fq, _fs.set(rad, Math.max(.01, s1 - s0), rad)); FXP.tr.setMatrixAt(i, _fm);
  }
  FXP.tr.instanceMatrix.needsUpdate = true;
  // detriti
  for (let i = 0; i < FXP.debList.length; i++) {
    const d = FXP.debList[i]; if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) { FXP.deb.setMatrixAt(i, _fz); continue; }
    d.v.y -= 15 * dt; d.p.addScaledVector(d.v, dt);
    d.r.x += d.sp.x * dt; d.r.y += d.sp.y * dt; d.r.z += d.sp.z * dt;
    const g = Hf(d.p.x, d.p.z);
    if (d.p.y < g + d.s * .5) { d.p.y = g + d.s * .5; d.v.multiplyScalar(.3); d.v.y = Math.abs(d.v.y) * .5; d.sp.multiplyScalar(.4); }
    _fq.setFromEuler(d.r); _fm.compose(d.p, _fq, _fs.set(d.s, d.s * .8, d.s)); FXP.deb.setMatrixAt(i, _fm);
  }
  FXP.deb.instanceMatrix.needsUpdate = true;
  // bossoli
  for (let i = 0; i < FXP.casList.length; i++) {
    const c = FXP.casList[i]; if (c.life <= 0) continue;
    c.life -= dt;
    if (c.life <= 0) { FXP.cas.setMatrixAt(i, _fz); continue; }
    if (!c.rest) {
      c.v.y -= 9.8 * dt; c.p.addScaledVector(c.v, dt); c.r.x += c.sp.x * dt; c.r.y += c.sp.y * dt; c.r.z += c.sp.z * dt;
      const g = Hf(c.p.x, c.p.z) + .006;
      if (c.p.y < g) { c.p.y = g; c.v.multiplyScalar(.35); c.v.y = -c.v.y * .5; c.sp.multiplyScalar(.5); if (c.tink++ < 2) sfxTink(c.p); if (c.v.length() < .4) { c.rest = true; c.r.x = PI / 2 * 0; c.r.z = 0; } }
    }
    _fq.setFromEuler(c.r); _fm.compose(c.p, _fq, _fs.set(1, 1, 1)); FXP.cas.setMatrixAt(i, _fm);
  }
  FXP.cas.instanceMatrix.needsUpdate = true;
  // pozze di sangue che si allargano
  for (const name in FXP.dec) {
    const D_ = FXP.dec[name]; let upd = false;
    for (let i = 0; i < D_.n; i++) {
      const e = D_.list[i]; if (!e.grow || e.s >= e.g) continue;
      e.s = Math.min(e.g, e.s + e.g * dt / e.grow); _fm.compose(e.p, e.q, _fs.set(e.s, 1, e.s)); D_.im.setMatrixAt(i, _fm); upd = true;
    }
    if (upd) D_.im.instanceMatrix.needsUpdate = true;
  }
  for (const r of FXP.rings) {
    if (!r.m.visible) continue;
    r.t += dt * 3.2;
    if (r.t >= 1) { r.m.visible = false; continue; }
    r.m.scale.setScalar(r.s * (.2 + r.t)); r.m.material.opacity = (1 - r.t) * .35;
  }
  updateLens(dt);
}

// ---------- sporco, sangue e acqua sull'obiettivo ----------
let lensCtx, lensSplats = [], lensDirty = false;
function initLens() { const cv = $('lens'); cv.width = innerWidth / 2; cv.height = innerHeight / 2; lensCtx = cv.getContext('2d'); addEventListener('resize', () => { cv.width = innerWidth / 2; cv.height = innerHeight / 2; }); }
function lensSplat(kind, amount) {
  if (kind === 'water' && gradePass) { LENS.wet = Math.min(1, LENS.wet + amount); return; }
  const W = lensCtx.canvas.width, Hh = lensCtx.canvas.height, n = Math.round(4 + amount * 14);
  for (let i = 0; i < n; i++) {
    const edge = R() < .7, x = edge ? (R() < .5 ? rnd(0, W * .25) : rnd(W * .75, W)) : rnd(0, W), y = edge ? rnd(0, Hh) : (R() < .5 ? rnd(0, Hh * .3) : rnd(Hh * .7, Hh));
    lensSplats.push({ kind, x, y, r: rnd(4, 18) * (kind === 'blood' ? 1.2 : 1) * (.5 + amount), a: Math.min(1, .5 + amount), drip: kind === 'blood' ? rnd(0, 30) : 0, seed: R() });
  }
  if (lensSplats.length > 140) lensSplats.splice(0, lensSplats.length - 140);
  lensDirty = true;
}
const LENS = { wet: 0 };
function updateLens(dt) {
  LENS.wet = Math.max(0, LENS.wet - dt * .25);
  if (gradePass) gradePass.uniforms.uWet.value = LENS.wet;
  if (!lensSplats.length) { if (lensDirty) { lensCtx.clearRect(0, 0, lensCtx.canvas.width, lensCtx.canvas.height); lensDirty = false; } return; }
  const g = lensCtx; g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  for (let i = lensSplats.length - 1; i >= 0; i--) {
    const s = lensSplats[i]; s.a -= dt * (s.kind === 'blood' ? .12 : .2);
    if (s.a <= 0) { lensSplats.splice(i, 1); continue; }
    const c = s.kind === 'blood' ? `rgba(90,0,0,${s.a * .85})` : s.kind === 'water' ? `rgba(200,215,220,${s.a * .25})` : `rgba(70,55,38,${s.a * .8})`;
    g.fillStyle = c; g.beginPath();
    for (let k = 0; k < 7; k++) { const an = k / 7 * TAU, rr = s.r * (.7 + .5 * hash2(k, s.seed * 1000 | 0)); g.lineTo(s.x + Math.cos(an) * rr, s.y + Math.sin(an) * rr); }
    g.fill();
    if (s.drip) { g.fillRect(s.x - 1.5, s.y, 3, s.drip * (1 - s.a) + 4); }
  }
  lensDirty = true;
}
