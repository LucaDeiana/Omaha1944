"use strict";
// ============================================================
//  Configurazione, utilità matematiche, dati delle armi
// ============================================================
const R = Math.random, rnd = (a, b) => a + R() * (b - a), pick = a => a[(R() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI, TAU = PI * 2;
const V3 = THREE.Vector3;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const $ = id => document.getElementById(id);

function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, per = 0) {
  let xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  let x1 = xi + 1, y1 = yi + 1;
  if (per) { xi = ((xi % per) + per) % per; yi = ((yi % per) + per) % per; x1 = ((x1 % per) + per) % per; y1 = ((y1 % per) + per) % per; }
  const a = hash2(xi, yi), b = hash2(x1, yi), c = hash2(xi, y1), d = hash2(x1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4, per = 0) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, per ? per * f : 0); n += a; f *= 2; a *= .5; }
  return s / n;
}
function seeded(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const SR = seeded(1944);
const srnd = (a, b) => a + SR() * (b - a);

// colori: gli hex sono sRGB, il rendering lavora in lineare
const _colCache = new Map();
function col(h) {
  let c = _colCache.get(h);
  if (!c) { c = new THREE.Color(h).convertSRGBToLinear(); _colCache.set(h, c); }
  return c;
}

// ---------- Impostazioni ----------
const DPR = devicePixelRatio || 1;
const QUALITY = {
  basso: { label: 'Basso', pr: Math.min(DPR, .9), prMin: .55, shadows: 0, shadowDist: 0, post: false, bloom: false, fxaa: false, terrainStep: 1.6, tex: 256, allyAlive: 61, enemyAlive: 74, allySlots: 182, enemySlots: 156, grass: 0, lights: 1, particles: .55, lod: 0, waveBoats: 3, gibs: 6, ragdolls: 8 },
  medio: { label: 'Medio', pr: Math.min(DPR, 1), prMin: .65, shadows: 2048, shadowDist: 70, post: true, bloom: true, fxaa: true, terrainStep: 1.15, tex: 512, allyAlive: 101, enemyAlive: 115, allySlots: 299, enemySlots: 247, grass: 6000, lights: 2, particles: .8, lod: 47, waveBoats: 4, gibs: 12, ragdolls: 16 },
  alto: { label: 'Alto', pr: Math.min(DPR, 1.5), prMin: .7, shadows: 4096, shadowDist: 90, post: true, bloom: true, fxaa: true, terrainStep: .85, tex: 1024, allyAlive: 149, enemyAlive: 162, allySlots: 429, enemySlots: 351, grass: 14000, lights: 4, particles: 1, lod: 81, waveBoats: 6, gibs: 20, ragdolls: 26 },
  ultra: { label: 'Ultra', pr: Math.min(DPR, 2), prMin: .75, shadows: 4096, shadowDist: 120, post: true, bloom: true, fxaa: true, terrainStep: .7, tex: 1024, allyAlive: 203, enemyAlive: 203, allySlots: 559, enemySlots: 429, grass: 24000, lights: 4, particles: 1.25, lod: 126, waveBoats: 7, gibs: 30, ragdolls: 40 },
};
const DIFF = {
  recluta: { label: 'Recluta', dmg: .45, acc: .7 },
  regolare: { label: 'Regolare', dmg: .75, acc: .9 },
  veterano: { label: 'Veterano', dmg: 1.15, acc: 1.1 },
};
let PT = 'A'; // fazione del giocatore: 'A' Alleati, 'E' Asse
const SETTINGS = { side: 'A', quality: 'medio', diff: 'regolare', sens: 1, fov: 72, gore: true, voices: true, dynres: true, volume: .85, fps: false };
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('omaha_settings') || '{}')); } catch (e) { }
function saveSettings() { try { localStorage.setItem('omaha_settings', JSON.stringify(SETTINGS)); } catch (e) { } }
let Q = QUALITY[SETTINGS.quality] || QUALITY.medio, D = DIFF[SETTINGS.diff] || DIFF.regolare;

// ---------- Armi del giocatore (dati storici approssimati) ----------
const WEAPONS = {
  garand: { name: 'M1 Garand', cal: '.30-06 Springfield', mag: 8, res: 72, dmg: 105, rate: .16, auto: false, reload: 2.3, hip: .028, ads: .0012, kick: .032, climb: 0, fov: 52, snd: 'garand', ping: true, range: 600 },
  thompson: { name: 'Thompson M1A1', cal: '.45 ACP', mag: 30, res: 150, dmg: 36, rate: .086, auto: true, reload: 2.7, hip: .034, ads: .011, kick: .011, climb: .0055, fov: 58, snd: 'thompson', range: 220, falloff: 50 },
  bar: { name: 'BAR M1918A2', cal: '.30-06 Springfield', mag: 20, res: 100, dmg: 80, rate: .14, auto: true, reload: 3.0, hip: .045, ads: .008, kick: .02, climb: .008, fov: 52, snd: 'bar', range: 600, speedMul: .9 },
  springfield: { name: 'Springfield M1903A4', cal: '.30-06 (ottica M73B1)', mag: 5, res: 40, dmg: 170, rate: 1.25, auto: false, reload: 3.2, hip: .05, ads: 0, kick: .06, climb: 0, fov: 17, snd: 'springfield', scope: true, bolt: true, range: 900 },
  colt: { name: 'Colt M1911A1', cal: '.45 ACP', mag: 7, res: 42, dmg: 44, rate: .14, auto: false, reload: 1.7, hip: .03, ads: .009, kick: .03, climb: 0, fov: 62, snd: 'colt', range: 130, falloff: 35 },
  bazooka: { name: 'M1A1 Bazooka', cal: 'Razzo M6A1 HEAT', mag: 1, res: 4, dmg: 400, rate: 1, auto: false, reload: 3.6, hip: .02, ads: .004, kick: .05, climb: 0, fov: 50, snd: 'bazooka', rocket: true, speedMul: .85 },
  mp40: { name: 'MP 40', cal: '9 mm Parabellum', mag: 32, res: 96, dmg: 32, rate: .109, auto: true, reload: 2.6, hip: .034, ads: .012, kick: .01, climb: .0048, fov: 58, snd: 'mp40', range: 200, falloff: 45 },
  kar98zf: { name: 'Kar98k ZF39', cal: '7,92×57 mm (ottica 4×)', mag: 5, res: 40, dmg: 175, rate: 1.2, auto: false, reload: 3.1, hip: .05, ads: 0, kick: .06, climb: 0, fov: 15, snd: 'kar98', scope: true, bolt: true, range: 900 },
  kar98: { name: 'Karabiner 98k', cal: '7,92×57 mm Mauser', mag: 5, res: 40, dmg: 130, rate: 1.1, auto: false, reload: 3.0, hip: .03, ads: .0012, kick: .05, climb: 0, fov: 50, snd: 'kar98', bolt: true, range: 700 },
};

// ---------- Armi dell'IA ----------
const AIW = {
  rifle: { rate: [1.6, 3.2], acc: .3, range: 200, burst: [1, 1], bi: 0, dmg: [30, 55], tracer: .12 },
  smg: { rate: [1.0, 2.2], acc: .13, range: 80, burst: [4, 9], bi: .1, dmg: [16, 26], tracer: .25 },
  bar: { rate: [1.3, 2.6], acc: .14, range: 230, burst: [3, 7], bi: .14, dmg: [25, 40], tracer: .6 },
  mg: { rate: [.7, 1.8], acc: .07, range: 320, burst: [15, 40], bi: .05, dmg: [25, 45], tracer: .55 },
  sniper: { rate: [4, 7], acc: .55, range: 380, burst: [1, 1], bi: 0, dmg: [55, 90], tracer: 0 },
  medic: { rate: [2, 4], acc: .15, range: 60, burst: [1, 1], bi: 0, dmg: [15, 25], tracer: 0 },
}
const AISND = { A: { rifle: 'garand', smg: 'thompson', bar: 'bar', medic: 'colt', sniper: 'springfield' }, E: { rifle: 'kar98', smg: 'mp40', mg: 'mg42', sniper: 'kar98' } };

// ---------- Costruttore di geometrie unite (colori per vertice) ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();
function mergeGeos(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { const g = p.g; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cl = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let vo = 0, io = 0; const v = new V3(), nm = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.g, pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, c = p.c, ca = p.vc ? g.attributes.color : null;
    nm.getNormalMatrix(p.m);
    for (let i = 0; i < pa.count; i++) {
      const k = (vo + i) * 3;
      v.fromBufferAttribute(pa, i).applyMatrix4(p.m); pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
      if (ca) { cl[k] = ca.getX(i) * c.r; cl[k + 1] = ca.getY(i) * c.g; cl[k + 2] = ca.getZ(i) * c.b; } else { cl[k] = c.r; cl[k + 1] = c.g; cl[k + 2] = c.b; }
      if (ua) { uvs[(vo + i) * 2] = ua.getX(i) * (p.uvs || 1); uvs[(vo + i) * 2 + 1] = ua.getY(i) * (p.uvs || 1); }
    }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo; io += g.index.count; }
    else { for (let i = 0; i < pa.count; i++) idx[io + i] = vo + i; io += pa.count; }
    vo += pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}
class MB {
  constructor() { this.parts = []; this.base = null; this.mat = 'vc'; }
  setBase(x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    this.base = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(s, s, s));
    return this;
  }
  clearBase() { this.base = null; return this; }
  add(g, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    const m = new THREE.Matrix4().compose(_p, _q, _s);
    if (this.base) m.premultiply(this.base);
    this.parts.push({ g, c: typeof c === 'number' ? col(c) : c, m, mat: this.mat, gid: this.gid || 0 });
    return this;
  }
  // cilindro tra due punti
  between(a, b, r, c, g = U.cyl) {
    const d = new V3().subVectors(b, a), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, .5), q, new V3(r, len, r));
    if (this.base) m.premultiply(this.base);
    this.parts.push({ g, c: typeof c === 'number' ? col(c) : c, m, mat: this.mat, gid: this.gid || 0 });
    return this;
  }
  // aggiunge una geometria con i suoi colori per vertice
  addG(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, tint = 0xffffff) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s, s, s);
    const m = new THREE.Matrix4().compose(_p, _q, _s); if (this.base) m.premultiply(this.base);
    this.parts.push({ g, c: col(tint), m, mat: this.mat, vc: true, gid: this.gid || 0 }); return this;
  }
  build() { return mergeGeos(this.parts); }
  // divide le parti in tasselli quadrati di lato size: ogni tassello ha i suoi gruppi di materiali
  buildTiles(size) {
    const tiles = new Map();
    for (const p of this.parts) { const e = p.m.elements, k = Math.floor(e[12] / size) + ',' + Math.floor(e[14] / size); let t = tiles.get(k); if (!t) tiles.set(k, t = []); t.push(p); }
    const out = [];
    for (const parts of tiles.values()) { const g = {}; for (const p of parts) (g[p.mat] || (g[p.mat] = [])).push(p); const o = {}; for (const k in g) o[k] = mergeGeos(g[k]); out.push(o); }
    return out;
  }
  buildGroups() { const g = {}; for (const p of this.parts) (g[p.mat] || (g[p.mat] = [])).push(p); const o = {}; for (const k in g) o[k] = mergeGeos(g[k]); return o; }
}
// geometrie unitarie condivise
const U = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.ConeGeometry(1, 1, 10),
  pyr: new THREE.ConeGeometry(1, 1, 4),
  sph: new THREE.SphereGeometry(1, 12, 9),
  hemi: new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, PI / 2),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  prism: (() => { const s = new THREE.Shape(); s.moveTo(-.5, 0); s.lineTo(.5, 0); s.lineTo(0, 1); s.lineTo(-.5, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -.5); return g; })(),
  skirt: new THREE.CylinderGeometry(1, 1.25, 1, 12, 1, true),
};
