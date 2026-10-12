"use strict";
// ============================================================
//  Effetti: particelle (fumo, fuoco, polvere, acqua), traccianti,
//  detriti, crateri, emettitori persistenti
// ============================================================
let PS_SMOKE, PS_FIRE, tracerGeo, tracerArr;
const emitters = [], tracers = [], debris = [], decals = [];
let tracerI = 0, debrisI = 0, decalI = 0;
const TRACER_N = 400;

function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
}

const P_VS = `attribute float aSize;attribute vec4 aCol;attribute float aRot;
uniform float uScale,fogDensity;varying vec4 vCol;varying float vRot,vFog;
void main(){vCol=aCol;vRot=aRot;vec4 mv=modelViewMatrix*vec4(position,1.);
gl_PointSize=aSize*uScale/max(-mv.z,.3);gl_Position=projectionMatrix*mv;
float fd=-mv.z;vFog=1.-exp(-fogDensity*fogDensity*fd*fd);}`;
const P_FS = `uniform sampler2D uTex;uniform vec3 fogColor;varying vec4 vCol;varying float vRot,vFog;
void main(){vec2 uv=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y)+.5;
vec4 t=texture2D(uTex,uv);
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
    this.n = n; this.i = 0; this.active = 0;
    this.p = new Float32Array(n * 3); this.sz = new Float32Array(n); this.c = new Float32Array(n * 4); this.r = new Float32Array(n);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.drag = new Float32Array(n); this.g = new Float32Array(n); this.rs = new Float32Array(n);
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
    this.pts = new THREE.Points(geo, this.mat); this.pts.frustumCulled = false;
    this.pts.renderOrder = additive ? 4 : 3;
    scene.add(this.pts);
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a, cr, cg, cb, drag = 0, grav = 0) {
    const i = this.i; this.i = (i + 1) % this.n; const k = i * 3, k4 = i * 4;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.c[k4] = cr; this.c[k4 + 1] = cg; this.c[k4 + 2] = cb; this.c[k4 + 3] = 0;
    this.drag[i] = drag; this.g[i] = grav; this.r[i] = R() * TAU; this.rs[i] = (R() - .5) * 1.2; this.sz[i] = s0;
  }
  update(dt) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3, k4 = i * 4;
      if (this.life[i] <= 0) { this.sz[i] = 0; this.c[k4 + 3] = 0; continue; }
      const t = 1 - this.life[i] / this.max[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.v[k] *= dr; this.v[k + 1] = this.v[k + 1] * dr - this.g[i] * dt; this.v[k + 2] *= dr;
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      this.sz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - t) * (1 - t));
      this.c[k4 + 3] = this.a0[i] * Math.min(1, t * 12) * (1 - t);
      this.r[i] += this.rs[i] * dt;
    }
    this.aP.needsUpdate = this.aS.needsUpdate = this.aC.needsUpdate = this.aR.needsUpdate = true;
    this.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * PI / 360));
  }
}

function initFX() {
  const smokeTex = canvasTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + (R() - .5) * s * .4, y = s / 2 + (R() - .5) * s * .4, r = s * (.14 + R() * .22);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const b = 200 + R() * 55 | 0;
      gr.addColorStop(0, `rgba(${b},${b},${b},.32)`); gr.addColorStop(1, `rgba(${b},${b},${b},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
  const fireTex = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,200,110,.9)');
    gr.addColorStop(.6, 'rgba(255,110,30,.35)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  PS_SMOKE = new Particles(Math.round(2600 * Q.particles), false, smokeTex);
  PS_FIRE = new Particles(Math.round(1100 * Q.particles), true, fireTex);

  tracerArr = new Float32Array(TRACER_N * 6);
  tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerArr, 3).setUsage(THREE.DynamicDrawUsage));
  const tl = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(5, 3.4, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  tl.frustumCulled = false; tl.renderOrder = 5; scene.add(tl);
  for (let i = 0; i < TRACER_N; i++) tracers.push({ on: false, a: new V3(), d: new V3(), len: 0, s: 0 });

  const dg = new THREE.BoxGeometry(1, 1, 1), dm = new THREE.MeshStandardMaterial({ color: col(0x4a3d2e), roughness: 1 });
  for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(dg, dm); m.visible = false; scene.add(m); debris.push({ m, v: new V3(), life: 0, spin: new V3() }); }

  const scorch = canvasTex(128, (g, s) => {
    for (let i = 0; i < 40; i++) {
      const a = R() * TAU, r = R() * s * .25, x = s / 2 + Math.cos(a) * r, y = s / 2 + Math.sin(a) * r, rr = s * (.1 + R() * .2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(20,16,12,.35)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
  const decMat = new THREE.MeshStandardMaterial({ map: scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
  const decGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(decGeo, decMat); m.visible = false; m.renderOrder = 1; scene.add(m); decals.push(m); }
}

// ---------- API effetti ----------
const C_SAND = [.55, .46, .32], C_DIRT = [.28, .22, .15], C_STONE = [.45, .44, .42], C_WATER = [.8, .85, .87], C_SMOKE = [.22, .22, .22], C_BLACK = [.035, .033, .03], C_BLOOD = [.25, .01, .01];
function dist2Cam(p) { const dx = p.x - camera.position.x, dz = p.z - camera.position.z; return dx * dx + dz * dz; }

function fxMuzzle(p, dir, big) {
  const s = big ? 1 : .6;
  for (let i = 0; i < 3; i++) PS_FIRE.emit(p.x + dir.x * i * .15 * s, p.y + dir.y * i * .15 * s, p.z + dir.z * i * .15 * s, dir.x * 3, dir.y * 3, dir.z * 3, .05, .35 * s, .55 * s, 1, 4, 2.6, 1.1);
  PS_SMOKE.emit(p.x, p.y, p.z, dir.x * 1.5, .4, dir.z * 1.5, rnd(.6, 1.2), .2 * s, 1.2 * s, .35, .5, .5, .5, 1.5, -.3);
}
function fxImpact(p, kind) {
  if (dist2Cam(p) > 250 * 250) return;
  if (kind === 'water') {
    for (let i = 0; i < 7; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-.8, .8), rnd(3, 6.5), rnd(-.8, .8), rnd(.5, .8), .15, .45, .8, ...C_WATER, .5, 9.8);
    PS_SMOKE.emit(p.x, p.y + .2, p.z, 0, .5, 0, 1, .3, 1.2, .4, ...C_WATER, 1);
  } else if (kind === 'blood') {
    for (let i = 0; i < 5; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-1, 1), rnd(-.5, 1.5), rnd(-1, 1), rnd(.3, .5), .1, .4, .9, ...C_BLOOD, 2, 4);
  } else if (kind === 'metal' || kind === 'stone') {
    for (let i = 0; i < 6; i++) PS_FIRE.emit(p.x, p.y, p.z, rnd(-4, 4), rnd(0, 5), rnd(-4, 4), rnd(.08, .2), .06, .03, 1, 3, 2, .8, 2, 9);
    PS_SMOKE.emit(p.x, p.y, p.z, 0, .6, 0, rnd(.6, 1), .2, 1, .5, ...C_STONE, 1);
  } else {
    const c = kind === 'sand' ? C_SAND : C_DIRT;
    for (let i = 0; i < 4; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-.7, .7), rnd(1, 3), rnd(-.7, .7), rnd(.6, 1.2), .15, rnd(.7, 1.3), .75, ...c, 2, 2);
    for (let i = 0; i < 3; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-2, 2), rnd(3, 6), rnd(-2, 2), .5, .08, .12, 1, ...C_DIRT, 0, 12);
  }
}
function fxExplosion(p, size, water) {
  const far = dist2Cam(p) > 600 * 600;
  flashLight(new V3(p.x, p.y + 2, p.z), 0xffa050, 60 * size, .35);
  const nf = far ? 6 : 16;
  for (let i = 0; i < nf; i++) {
    const a = R() * TAU, u = rnd(.2, 1), sp = rnd(2, 7) * size;
    PS_FIRE.emit(p.x, p.y + .5, p.z, Math.cos(a) * sp * (1 - u * .5), u * sp * 1.3, Math.sin(a) * sp * (1 - u * .5), rnd(.2, .45), size * 1.2, size * 3.2, 1, 4, 2.3, .9, 3, -1);
  }
  if (water) {
    for (let i = 0; i < (far ? 8 : 26); i++) PS_SMOKE.emit(p.x + rnd(-1, 1) * size, p.y, p.z + rnd(-1, 1) * size, rnd(-1.5, 1.5) * size, rnd(8, 15) * size, rnd(-1.5, 1.5) * size, rnd(1.4, 2.2), size * .8, size * 2.6, .85, ...C_WATER, .4, 9.8);
    for (let i = 0; i < 5; i++) PS_SMOKE.emit(p.x, p.y + 1, p.z, rnd(-2, 2), rnd(.5, 2), rnd(-2, 2), rnd(2, 4), size * 2, size * 7, .45, ...C_WATER, .6, -.2);
  } else {
    for (let i = 0; i < (far ? 6 : 18); i++) PS_SMOKE.emit(p.x, p.y + .5, p.z, rnd(-2.5, 2.5) * size, rnd(5, 13) * size, rnd(-2.5, 2.5) * size, rnd(1, 1.8), size * .6, size * 2, .95, ...C_DIRT, .6, 9.8);
    for (let i = 0; i < (far ? 4 : 12); i++) PS_SMOKE.emit(p.x + rnd(-1, 1) * size, p.y + rnd(0, 2) * size, p.z + rnd(-1, 1) * size, rnd(-1, 1), rnd(.8, 2.4), rnd(-1, 1), rnd(4, 8), size * 1.8, size * 7, .65, ...C_SMOKE, .3, -.15);
    if (!far) for (let i = 0; i < 6; i++) {
      const d = debris[debrisI]; debrisI = (debrisI + 1) % debris.length;
      d.m.visible = true; d.m.position.copy(p); d.m.position.y += .5; d.m.scale.setScalar(rnd(.12, .35) * Math.min(size, 2));
      d.v.set(rnd(-6, 6) * size, rnd(6, 14) * size, rnd(-6, 6) * size); d.life = 3; d.spin.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    }
    addDecal(p, size * 4);
  }
}
function addDecal(p, s) {
  const m = decals[decalI]; decalI = (decalI + 1) % decals.length;
  const n = HN(p.x, p.z);
  m.position.set(p.x, H(p.x, p.z) + .06, p.z);
  m.quaternion.setFromUnitVectors(new V3(0, 0, 1), n);
  m.rotateZ(R() * TAU); m.scale.set(s, s, 1); m.visible = true;
}
function fxTracer(a, b) {
  const t = tracers[tracerI]; tracerI = (tracerI + 1) % TRACER_N;
  t.on = true; t.a.copy(a); t.d.subVectors(b, a); t.len = t.d.length(); t.d.normalize(); t.s = rnd(0, 5);
}
// emettitori: fumo di relitti, colonne di fumo, ciminiere delle navi
function addEmitter(p, type, scale = 1) { const e = { p: p.clone(), type, scale, acc: 0, on: true }; emitters.push(e); return e; }

function updateFX(dt) {
  PS_SMOKE.update(dt); PS_FIRE.update(dt);
  for (const e of emitters) {
    if (!e.on) continue;
    const d2 = dist2Cam(e.p); if (d2 > 1100 * 1100) continue;
    const s = e.scale, far = d2 > 300 * 300;
    e.acc += dt * (far ? .4 : 1);
    if (e.type === 'fire') {
      while (e.acc > .06) {
        e.acc -= .06;
        PS_FIRE.emit(e.p.x + rnd(-1, 1) * s, e.p.y + rnd(0, .5) * s, e.p.z + rnd(-1, 1) * s, rnd(-.3, .3), rnd(1.5, 3) * s, rnd(-.3, .3), rnd(.5, .9), s * .9, s * .3, .9, 3, 1.5, .5, .5, -.5);
        if (R() < .5) PS_SMOKE.emit(e.p.x, e.p.y + s, e.p.z, rnd(-.3, .3) + .4, rnd(2, 3.5) * s, rnd(-.3, .3), rnd(6, 10), s * 1.2, s * 6, .7, ...C_BLACK, .1, -.1);
      }
    } else if (e.type === 'smoke') {
      while (e.acc > .18) { e.acc -= .18; PS_SMOKE.emit(e.p.x + rnd(-1, 1) * s, e.p.y, e.p.z + rnd(-1, 1) * s, .5, rnd(1.5, 2.5) * s, rnd(-.2, .2), rnd(7, 12), s * 1.5, s * 8, .55, ...C_SMOKE, .05, -.05); }
    } else if (e.type === 'stack') {
      while (e.acc > .3) { e.acc -= .3; PS_SMOKE.emit(e.p.x, e.p.y, e.p.z, rnd(1, 2), rnd(2, 3), 0, rnd(8, 12), s * 2, s * 10, .5, .12, .12, .12, .05, 0); }
    }
  }
  for (let i = 0; i < TRACER_N; i++) {
    const t = tracers[i], o = i * 6;
    if (!t.on) { if (tracerArr[o + 1] !== -999) { tracerArr.fill(0, o, o + 6); tracerArr[o + 1] = tracerArr[o + 4] = -999; } continue; }
    t.s += 520 * dt;
    if (t.s > t.len + 6) { t.on = false; continue; }
    const s1 = Math.min(t.s, t.len), s0 = Math.max(0, t.s - 7);
    tracerArr[o] = t.a.x + t.d.x * s0; tracerArr[o + 1] = t.a.y + t.d.y * s0; tracerArr[o + 2] = t.a.z + t.d.z * s0;
    tracerArr[o + 3] = t.a.x + t.d.x * s1; tracerArr[o + 4] = t.a.y + t.d.y * s1; tracerArr[o + 5] = t.a.z + t.d.z * s1;
  }
  tracerGeo.attributes.position.needsUpdate = true;
  for (const d of debris) {
    if (d.life <= 0) continue;
    d.life -= dt; d.v.y -= 15 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt;
    const g = H(d.m.position.x, d.m.position.z);
    if (d.m.position.y < g) { d.m.position.y = g; d.v.multiplyScalar(.3); d.v.y = Math.abs(d.v.y); d.spin.multiplyScalar(.5); }
    if (d.life <= 0) d.m.visible = false;
  }
}
