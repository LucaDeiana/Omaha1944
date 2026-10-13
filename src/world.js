"use strict";
// ============================================================
//  Mondo: terreno, acqua, spiaggia, scogliera, trincee, bunker,
//  siepi, batteria, villaggio, flotta, mezzi da sbarco
// ============================================================
const DRAW_X = -30, BREACH_X = -30, WIRE_Z = -62.5, BANK_Z = -57.5, WATER_Y = .3;
const SQUARE = new V3(12, 0, -283);
const solids = [], covers = [], mines = [], OBST = [];
const MINEFIELDS = [[18, 112, -84, -66], [-165, -88, -82, -66]];
const MAPX = 1500;
const DRAWS = [-1250, -700, -30, 450, 950];
const HEDGES = [{ z: -170, gaps: [[-40, -20], [55, 68]] }, { z: -218, gaps: [[-40, -20], [-125, -112], [88, 100]] }];
for (const h of HEDGES) for (let x = -MAPX; x < MAPX; x += 180) if (Math.abs(x) > 230) h.gaps.push([x, x + 14]);
for (const d of DRAWS) if (d !== -30) for (const h of HEDGES) h.gaps.push([d - 10, d + 10]);
const WORLD = {
  wireBreached: false, wireGaps: [], bunkers: [], flaks: [], boats: [], shipGuns: [], crates: [], pickups: [], shells: [], bombard: 'bluff', villageY: 0,
  mortarPits: [[-125, -103], [-58, -106], [32, -104], [112, -102]].map(([x, z]) => ({ x, z })), aaSites: [[-75, -110], [5, -112], [75, -108]].map(([x, z]) => ({ x, z })),
  texas: null,
};
let waterMat, wireLines = null;

// ---------- crateri ----------
const craters = [], craterGrid = new Map();
const ck = (i, j) => (i + 500) * 2000 + (j + 500);
function addCrater(x, z, r, d) {
  const c = { x, z, r, d }; craters.push(c);
  for (let i = Math.floor((x - r) / 10); i <= Math.floor((x + r) / 10); i++)
    for (let j = Math.floor((z - r) / 10); j <= Math.floor((z + r) / 10); j++) {
      const k = ck(i, j); let a = craterGrid.get(k); if (!a) craterGrid.set(k, a = []); a.push(c);
    }
}
function genCraters() {
  // linee di copertura: crateri di mortaio a fasce sul bassofondale e sulla sabbia
  for (const lz of [64, 42, 20, -2, -22, -40]) for (let k = 0; k < 26; k++) { const x = srnd(-220, 220), z = lz + srnd(-4, 4); addCrater(x, z, srnd(2, 3.6), srnd(.5, .9)); addCover(x, z + 1.2, 'crater'); }
  for (let i = 0; i < 160; i++) { const x = srnd(-MAPX + 50, MAPX - 50); if (Math.abs(x) < 200) continue; addCrater(x, srnd(-52, -9), srnd(1.8, 3.4), srnd(.35, .7)); if (R() < .5) addCrater(x + srnd(-20, 20), srnd(-110, -66), srnd(2, 4), srnd(.6, 1.1)); }
  for (let i = 0; i < 80; i++) addCrater(srnd(-190, 190), srnd(-52, -9), srnd(1.8, 3.4), srnd(.35, .7));
  for (let i = 0; i < 300; i++) { const x = srnd(200, MAPX - 40) * (R() < .5 ? -1 : 1), z = srnd(-52, 70); addCrater(x, z, srnd(1.8, 3.4), srnd(.35, .8)); if (i % 2) addCover(x, z + 1.2, 'crater'); }
  for (let i = 0; i < 55; i++) { const x = srnd(-170, 170), z = srnd(-112, -66); if (Math.abs(z - trenchZ(x)) < 4 || Math.abs(x - BREACH_X) < 6) continue; addCrater(x, z, srnd(2, 4), srnd(.6, 1.1)); }
  for (let i = 0; i < 35; i++) { const x = srnd(-160, 160), z = srnd(-212, -118); if (Math.abs(z + 170) < 5) continue; addCrater(x, z, srnd(2, 4.5), srnd(.6, 1.2)); }
}

// ---------- altezza del terreno ----------
function trenchZ(x) { return -90 + 2.2 * Math.sin(x * .11) + 1.3 * Math.sin(x * .031 + 1); }
function roadX(z) { return DRAW_X + 6 * Math.sin(z * .025); }
function roadDist(x, z) {
  let d = 1e9;
  if (z < -64 && z > -292) d = Math.abs(x - roadX(z));
  if (x > -95 && x < 95) d = Math.min(d, Math.abs(z + 281));
  return d;
}
function hedgeH(x, z) {
  let y = 0;
  for (const h of HEDGES) {
    const d = z - h.z;
    if (d > -3.5 && d < 3.5) {
      let g = false; for (const gp of h.gaps) if (x > gp[0] && x < gp[1]) { g = true; break; }
      if (!g) y += 1.2 * Math.exp(-((d / 1.3) ** 2));
    }
  }
  return y;
}
function H0(x, z) {
  if (z > 0) return z < 90 ? -z * .004 + (vnoise(x * .05, z * .05) - .5) * .18 : Math.max(-9, -.36 - (z - 90) * .035) + (vnoise(x * .04, z * .04) - .5) * .4;
  let y = Math.min(-z, 64) * .04;
  y += Math.sin(x * .21 + z * .13) * .03 + (vnoise(x * .07, z * .07) - .5) * .3 * smooth(-z / 25);
  y += 1.15 * Math.exp(-(((z - BANK_Z) / 1.7) ** 2));
  let draw = 0; for (const dx of DRAWS) draw = Math.max(draw, Math.exp(-(((x - dx) / 26) ** 2)));
  const span = 24 + 44 * draw;
  const t = smooth((-61 - z) / span);
  if (t > 0) {
    const top = 13 + 2 * Math.sin(x * .045) + (fbm(x * .02, 3.7, 3) - .5) * 4 - draw * 3;
    y += t * top + t * (1 - t) * 4 * (fbm(x * .11, z * .11, 3) - .5) * 4;
    if (z < -82) { const p = smooth((-82 - z) / 40); y += p * ((fbm(x * .011 + 5, z * .011, 4) - .5) * 8 + (-z - 82) * .008); }
  }
  return y;
}
function H(x, z) {
  let y = H0(x, z);
  if (z > 100) return y;
  if (z < -84 && z > -97 && x > -165 && x < 165) { const d = Math.abs(z - trenchZ(x)); if (d < 1.7) y -= 1.8 * smooth((1.7 - d) / .6); }
  for (const mp of WORLD.mortarPits) { const d = Math.hypot(x - mp.x, z - mp.z); if (d < 2.6) y -= .8 * smooth((2.6 - d) / 1); }
  if (z < -160 && z > -225) y += hedgeH(x, z);
  if (z < -235 && z > -345 && x > -120 && x < 120) {
    const m = smooth(Math.min((120 - Math.abs(x - 5)) / 25, (55 - Math.abs(z + 288)) / 18));
    y = lerp(y, WORLD.villageY + (fbm(x * .05, z * .05, 2) - .5) * .4, m);
  }
  const a = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
  if (a) for (const c of a) {
    const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz;
    if (d2 < c.r * c.r) {
      const k = Math.sqrt(d2) / c.r;
      y += k < .72 ? -c.d * (1 - (k / .72) ** 2) : c.d * .35 * Math.sin((k - .72) / .28 * PI);
    }
  }
  return y;
}
// griglia di altezze precalcolata (interrogazioni veloci per IA, fisica, particelle)
const HF = { x0: -245, z0: -470, step: .75, nx: 0, nz: 0, d: null };
function buildHF() {
  HF.nx = Math.ceil(490 / HF.step) + 1; HF.nz = Math.ceil(530 / HF.step) + 1;
  HF.d = new Float32Array(HF.nx * HF.nz);
  for (let j = 0; j < HF.nz; j++) for (let i = 0; i < HF.nx; i++) HF.d[j * HF.nx + i] = H(HF.x0 + i * HF.step, HF.z0 + j * HF.step);
}
const HC = { x0: -1620, z0: -1520, step: 3, nx: 0, nz: 0, d: null };
function buildHC() { HC.nx = Math.ceil(3240 / HC.step) + 1; HC.nz = Math.ceil(1960 / HC.step) + 1; HC.d = new Float32Array(HC.nx * HC.nz); for (let j = 0; j < HC.nz; j++) for (let i = 0; i < HC.nx; i++) HC.d[j * HC.nx + i] = H(HC.x0 + i * HC.step, HC.z0 + j * HC.step); }
function Hc(x, z) { const fx = (x - HC.x0) / HC.step, fz = (z - HC.z0) / HC.step; if (!HC.d || fx < 0 || fz < 0 || fx >= HC.nx - 1 || fz >= HC.nz - 1) return H(x, z); const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * HC.nx + i, d = HC.d, n = HC.nx; return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + n] * (1 - u) + d[k + n + 1] * u) * v; }
function Hf(x, z) {
  const fx = (x - HF.x0) / HF.step, fz = (z - HF.z0) / HF.step;
  if (!HF.d || fx < 0 || fz < 0 || fx >= HF.nx - 1 || fz >= HF.nz - 1) return Hc(x, z);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * HF.nx + i, d = HF.d, n = HF.nx;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + n] * (1 - u) + d[k + n + 1] * u) * v;
}
function HN(x, z) { const e = .5; return new V3(Hf(x - e, z) - Hf(x + e, z), 2 * e, Hf(x, z - e) - Hf(x, z + e)).normalize(); }
function waveAmp(z) { return clamp((z + 10) / 60, .12, 1); }
function waveH(x, z, t) {
  const a = waveAmp(z);
  return a * (.32 * Math.sin(.07 * (.1 * x + .995 * z) + 1.1 * t) + .14 * Math.sin(.13 * (-.3 * x + .954 * z) + 1.6 * t + 1.3));
}
function waterLevel(x, z, t) { return WATER_Y + waveH(x, z, t); }
function inMinefield(x, z) { for (const m of MINEFIELDS) if (x > m[0] && x < m[1] && z > m[2] && z < m[3]) return true; return false; }

// ---------- solidi ----------
function addSolid(x0, y0, z0, x1, y1, z1, tag) {
  const s = { min: new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)), tag, on: true };
  solids.push(s); return s;
}
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT, t1, t2, s;
  t1 = (b.min.x - ox) / dx; t2 = (b.max.x - ox) / dx; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  t1 = (b.min.y - oy) / dy; t2 = (b.max.y - oy) / dy; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  t1 = (b.min.z - oz) / dz; t2 = (b.max.z - oz) / dz; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  return tmin;
}
function raySolids(o, d, maxT) {
  let bt = maxT, bs = null;
  for (const s of solids) { if (!s.on || s.nb) continue; const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s, bt); if (t >= 0 && t < bt) { bt = t; bs = s; } }
  return bs ? { t: bt, s: bs } : null;
}
function rayTerrain(o, d, maxT) {
  let t = .3, pt = 0;
  while (t < maxT) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < Hf(x, z)) {
      let a = pt, b = t;
      for (let i = 0; i < 7; i++) { const m = (a + b) / 2; if (o.y + d.y * m < Hf(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      return b;
    }
    pt = t; t += Math.max(.35, t * .012);
  }
  return -1;
}
function losClear(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
  if (d < 1) return true;
  const st = Math.max(1.5, d / 45);
  for (let s = st; s < d - .8; s += st) { const k = s / d; if (a.y + dy * k < Hf(a.x + dx * k, a.z + dz * k)) return false; }
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z), inv = 1 / d;
  for (const s of solids) {
    if (!s.on || s.nb || s.max.x < x0 || s.min.x > x1 || s.max.z < z0 || s.min.z > z1) continue;
    if (rayBox(a.x, a.y, a.z, dx * inv, dy * inv, dz * inv, s, d - .6) >= 0) return false;
  }
  return true;
}
function pushOut(p, r, h = 1.7) {
  for (const s of solids) {
    if (!s.on || p.y + h < s.min.y || p.y > s.max.y - .05) continue;
    if (p.x < s.min.x - r || p.x > s.max.x + r || p.z < s.min.z - r || p.z > s.max.z + r) continue;
    const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z);
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d > 0) { if (d < r) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; } }
    else {
      const l = p.x - s.min.x, rr = s.max.x - p.x, f = p.z - s.min.z, b = s.max.z - p.z, m = Math.min(l, rr, f, b);
      if (m === l) p.x = s.min.x - r; else if (m === rr) p.x = s.max.x + r; else if (m === f) p.z = s.min.z - r; else p.z = s.max.z + r;
    }
  }
}
function wireGapsNow() { const g = WORLD.wireGaps.slice(); if (WORLD.wireBreached) g.push([BREACH_X - 3, BREACH_X + 3]); return g; }
function inWireGap(x, m = .4) { return wireGapsNow().some(g => x > g[0] - m && x < g[1] + m); }
function wireBlocks(x) { return x > -205 && x < 205 && !inWireGap(x); }
// un'esplosione abbastanza forte sul reticolato apre un varco
function addWireGap(x) {
  if (x < -200 || x > 200 || inWireGap(x, -1)) return false;
  WORLD.wireGaps.push([x - 2.6, x + 2.6]); buildWire(); return true;
}
function applyWire(p, prev) {
  if (!wireBlocks(p.x)) return;
  if (prev.z >= WIRE_Z && p.z < WIRE_Z + .5) p.z = Math.max(p.z, WIRE_Z + .5);
  else if (prev.z < WIRE_Z && p.z > WIRE_Z - .5) p.z = Math.min(p.z, WIRE_Z - .5);
}
const BARRIERS = [
  { z: WIRE_Z, gaps: () => wireGapsNow() },
  { z: -170, gaps: () => HEDGES[0].gaps },
  { z: -218, gaps: () => HEDGES[1].gaps },
  { z: -250, gaps: () => [[-200, -92], [-40, -22], [40, 52], [92, 200]] },
  { z: -332, gaps: () => [[-200, -92], [-38, -20], [32, 48], [92, 200]] },
];
function routeWaypoint(from, dest, out) {
  let best = null, bd = 1e9;
  for (const b of BARRIERS) { if ((from.z - b.z) * (dest.z - b.z) >= 0) continue; const d = Math.abs(from.z - b.z); if (d < bd) { bd = d; best = b; } }
  if (!best) return out.copy(dest);
  const b = best, side = Math.sign(from.z - b.z), gaps = b.gaps();
  const inGap = gaps.some(g => from.x > g[0] + .4 && from.x < g[1] - .4);
  if (inGap && Math.abs(from.z - b.z) < 3) return out.set(from.x, 0, b.z - side * 3.5);
  if (!gaps.length) return out.set(dest.x, 0, b.z + side * 3);
  let gx = 0, gd = 1e9;
  for (const g of gaps) { const c = clamp((from.x + dest.x) / 2, g[0] + 1.5, g[1] - 1.5), d = Math.abs(c - from.x) + Math.abs(c - dest.x) * .5; if (d < gd) { gd = d; gx = c; } }
  return out.set(gx, 0, b.z + side * 2.4);
}
function addCover(x, z, kind) { covers.push({ x, z, kind, occ: 0 }); }

// ---------- terreno con texture multiple ----------
function axisSteps(a0, a1, f) { const r = []; let a = a0; while (a < a1) { r.push(a); a += f(a); } r.push(a1); return r; }
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX.sand.map, normalMap: TEX.sand.normal, roughness: 1, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tPeb: { value: TEX.pebble.map }, tGrass: { value: TEX.grass.map }, tDirt: { value: TEX.dirt.map }, nPeb: { value: TEX.pebble.normal }, nGrass: { value: TEX.grass.normal }, nDirt: { value: TEX.dirt.normal } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat;attribute vec2 aux;varying vec4 vSplat;varying vec2 vAux;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSplat=splat;vAux=aux;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tPeb,tGrass,tDirt,nPeb,nGrass,nDirt;varying vec4 vSplat;varying vec2 vAux;')
      .replace('#include <map_fragment>', `
        vec2 uS=vUv,uP=vUv*1.7,uG=vUv*1.1,uD=vUv*.9;
        vec4 cS=mapTexelToLinear(texture2D(map,uS)),cP=mapTexelToLinear(texture2D(tPeb,uP)),cG=mapTexelToLinear(texture2D(tGrass,uG)),cD=mapTexelToLinear(texture2D(tDirt,uD));
        float macro=mapTexelToLinear(texture2D(tDirt,vUv*.061)).r+mapTexelToLinear(texture2D(map,vUv*.023)).r;
        vec4 hgt=vec4(cS.r*.6+.4,cP.r*1.5,cG.g*1.3,cD.r*1.4);
        vec4 sw=vSplat*(hgt+.15);sw=pow(sw,vec4(3.));sw/=max(dot(sw,vec4(1.)),1e-4);
        vec3 tc=cS.rgb*sw.x+cP.rgb*sw.y+cG.rgb*sw.z+cD.rgb*sw.w;
        tc*=.75+.5*clamp(macro*1.4,0.,1.);
        diffuseColor.rgb*=tc*mix(1.,.5,vAux.x)*mix(1.,.28,vAux.y);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=dot(sw,vec4(cS.a,cP.a,cG.a,cD.a));roughnessFactor=mix(roughnessFactor,.2,vAux.x*.92);`)
      .replace('texture2D( normalMap, vUv ).xyz', '(texture2D(normalMap,uS).xyz*sw.x+texture2D(nPeb,uP).xyz*sw.y+texture2D(nGrass,uG).xyz*sw.z+texture2D(nDirt,uD).xyz*sw.w)');
  };
  return m;
}
function buildTerrain() {
  const s = Q.terrainStep;
  const xs = axisSteps(-MAPX - 120, MAPX + 120, x => (Math.abs(x) < 185 ? 1.6 : Math.abs(x) < 700 ? 3.2 : 6) * s);
  const zs = axisSteps(-MAPX, 420, z => (z > -106 && z < -48 ? (Math.abs(0) < 1 ? .85 : 2) : z >= -48 && z < 100 ? 1.5 : z <= -106 && z > -340 ? 2.2 : 7) * s);
  const nx = xs.length, nz = zs.length, N = nx * nz;
  const pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), uv = new Float32Array(N * 2), sp = new Float32Array(N * 4), ax = new Float32Array(N * 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], y = Math.abs(x) < 240 && z > -470 ? H(x, z) : Hc(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
    const n2 = fbm(x * .03, z * .03, 3);
    let sa = 0, pe = 0, gr = 0, di = 0, wet = 0, sc = 0, tr = 1, tg = 1, tb = 1;
    if (z > -59.5) {
      sa = 1; pe = Math.exp(-(((z - BANK_Z) / 2.3) ** 2)) * 1.3;
      wet = z > 1 ? 1 : smooth((z + 14) / 12);
      const t = .92 + .16 * n2; tr = t; tg = t; tb = t;
    } else {
      const sl = (Math.abs(Hf(x, z - 1) - Hf(x, z + 1)) + Math.abs(Hf(x - 1, z) - Hf(x + 1, z))) * .5;
      di = smooth((sl - .45) / .6) * .9; gr = 1 - di;
      const tra = 1 - smooth((-59.5 - z) / 4); sa += tra; pe += tra * .5;
      if (z < -110) { const f = fbm(x * .009 + 11, z * .009, 3); if (f > .56) { const q = smooth((f - .56) / .05); tr = 1 + .25 * q; tg = 1 + .08 * q; tb = 1 - .2 * q; } else if (f < .42) { tr = .85; tb = .85; } }
      const rd = roadDist(x, z); if (rd < 3.2) { const q = smooth((3.2 - rd) / 1.2); di += q * 2; gr *= 1 - q; }
      if (z < -84 && z > -97 && x > -165 && x < 165 && Math.abs(z - trenchZ(x)) < 1.8) { di += 2; gr *= .2; }
      if (z < -245 && z > -330 && x > -100 && x < 100) di += .6;
    }
    const a = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
    if (a) for (const c of a) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r * 1.25) { const q = 1 - d / (c.r * 1.25); sc = Math.max(sc, q * .8); di += q * 1.5; } }
    const tot = sa + pe + gr + di || 1;
    sp[k * 4] = sa / tot; sp[k * 4 + 1] = pe / tot; sp[k * 4 + 2] = gr / tot; sp[k * 4 + 3] = di / tot;
    ax[k * 2] = wet; ax[k * 2 + 1] = sc;
    cl[k * 3] = tr; cl[k * 3 + 1] = tg; cl[k * 3 + 2] = tb;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + nx, cc = a + 1, d = b + 1;
    idx[o++] = a; idx[o++] = b; idx[o++] = cc; idx[o++] = cc; idx[o++] = b; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); g.setAttribute('aux', new THREE.BufferAttribute(ax, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, terrainMaterial()); m.receiveShadow = true; scene.add(m);
}

// ---------- acqua ----------
function buildWater() {
  waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uDeep: { value: col(0x1f363b) }, uShallow: { value: col(0x5a776d) },
      uFog: { value: FOG_COL }, uFogD: { value: scene.fog.density }, tN: { value: TEX.water.normal }, uSky: { value: skyCube },
    },
    vertexShader: `uniform float uTime;varying vec3 vW;varying vec2 vD;varying float vC;
    float amp(float z){return clamp((z+10.)/60.,.12,1.);}
    void main(){vec4 w=modelMatrix*vec4(position,1.);float a=amp(w.z);
      vec2 d1=vec2(.1,.995),d2=vec2(-.3,.954);
      float p1=.07*dot(d1,w.xz)+1.1*uTime,p2=.13*dot(d2,w.xz)+1.6*uTime+1.3;
      w.y+=a*(.32*sin(p1)+.14*sin(p2));
      vD=a*(.32*.07*cos(p1)*d1+.14*.13*cos(p2)*d2);
      vC=sin(p1)*.5+.5;vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uFogD;uniform vec3 uSunDir,uDeep,uShallow,uFog;uniform sampler2D tN;uniform samplerCube uSky;varying vec3 vW;varying vec2 vD;varying float vC;
    float bed(vec2 p){return p.y>90.?max(-9.,-.36-(p.y-90.)*.035):p.y>0.?-p.y*.004:min(-p.y,64.)*.04;}
    void main(){
      vec2 p=vW.xz;float t=uTime;
      vec3 n1=texture2D(tN,p*.045+vec2(t*.012,t*.021)).xyz*2.-1.;
      vec3 n2=texture2D(tN,p*.13-vec2(t*.023,t*.011)).xyz*2.-1.;
      vec3 n3=texture2D(tN,p*.4+vec2(t*.05,-t*.04)).xyz*2.-1.;
      vec3 n=normalize(vec3(-vD.x,1.,-vD.y)+vec3(n1.x+n2.x*.7+n3.x*.3,0.,n1.y+n2.y*.7+n3.y*.3)*.32);
      vec3 v=normalize(cameraPosition-vW);
      float fr=.02+.98*pow(1.-max(dot(n,v),0.),5.);
      vec3 r=reflect(-v,n);r.y=abs(r.y);
      vec3 sky=textureCube(uSky,r).rgb;
      float depth=vW.y-bed(p);
      vec3 wc=mix(uShallow,uDeep,clamp(depth/5.,0.,1.));
      wc+=vec3(.03,.06,.05)*smoothstep(.6,1.,vC)*clamp(depth,0.,1.);
      vec3 c=mix(wc,sky,fr*.92);
      c+=vec3(1.,.88,.7)*pow(max(dot(r,uSunDir),0.),260.)*4.;
      float pat=smoothstep(.35,.9,sin(p.x*.37+t*.9+sin(p.y*.8+t*.5)*2.)*.5+.5+sin(p.x*1.3-p.y*.9-t*1.4)*.25+n2.x*.4);
      float foam=smoothstep(.5,.0,depth)*pat*.85;
      foam+=smoothstep(.86,.99,vC)*.22*pat*clamp((40.-vW.z)/40.,0.,1.);
      c=mix(c,vec3(.72,.74,.73),clamp(foam,0.,1.)*.75);
      float fd=length(cameraPosition-vW);c=mix(c,uFog,1.-exp(-uFogD*uFogD*fd*fd));
      gl_FragColor=vec4(c,clamp(depth*.9+.18+fr*.6+foam*.5,0.,1.));
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
    transparent: true,
  });
  const g = new THREE.PlaneGeometry(4400, 2300, 400, 230); g.rotateX(-PI / 2);
  const m = new THREE.Mesh(g, waterMat); m.position.set(0, WATER_Y, 1135); m.renderOrder = 1; m.frustumCulled = false;
  scene.add(m);
}

function groupMesh(groups, cast = true) {
  const g = new THREE.Group();
  for (const k in groups) { const m = new THREE.Mesh(groups[k], MAT[k] || MAT.vc); m.castShadow = cast; m.receiveShadow = true; g.add(m); }
  return g;
}

// ---------- mezzo da sbarco LCVP ----------
let LCVP_G, RAMP_G;
function buildBoatGeos() {
  const mb = new MB(), c = 0x4b574f, d = 0x3d4740;
  // scafo sagomato: fondo a V che si alza verso la prua, fianchi leggermente svasati
  const secs = [];
  for (let i = 0; i <= 12; i++) {
    const z = 5.1 - i * (10.2 / 12), t = i / 12, k = lerp(-.28, .12, t * t), sw = 1.66 + Math.sin(t * PI) * .06;
    const ring = [[-sw - .04, 2.1], [-sw - .02, 1.3], [-sw + .04, .55], [-sw + .3, .12], [-.75, k + .06], [0, k], [.75, k + .06], [sw - .3, .12], [sw - .04, .55], [sw + .02, 1.3], [sw + .04, 2.1], [0, 2.1]];
    secs.push(ring.map(([x, y]) => new V3(x, y, z)));
  }
  const hull = loftGeo(secs, (p) => col(p.y < .35 ? 0x3c4640 : p.y > 1.95 ? 0x4a564e : 0x56635a), false, 1, (x, y) => y > 2.05 && Math.abs(x) < 1.6);
  mb.mat = 'paint'; mb.addG(hull);
  for (const sx of [-1, 1]) {
    mb.add(U.box, d, sx * 1.53, 1.15, .1, 0, 0, 0, .1, 1.8, 10);          // fasciame interno
    mb.add(U.box, 0x3a443e, sx * 1.74, 2.12, 0, 0, 0, 0, .3, .1, 10.3);   // capodibanda
    mb.add(U.box, 0x3a443e, sx * 1.76, 1.3, 0, 0, 0, 0, .08, .12, 10.2);  // bottazzo
    mb.add(U.box, d, sx * 1.6, 1.08, -5.05, 0, 0, 0, .34, 2.1, .3);       // montanti di prua
    for (let i = -4.2; i <= 4.2; i += 1.05) mb.add(U.box, 0x3c4740, sx * 1.43, 1.15, i, 0, 0, 0, .12, 1.6, .1); // ordinate
    for (const z of [-3.5, 0, 3.4]) { mb.add(U.cyl, 0x2a2a2a, sx * 1.7, 2.2, z, 0, 0, 0, .05, .1, .05); mb.add(U.box, 0x2a2a2a, sx * 1.7, 2.26, z, 0, 0, 0, .06, .04, .3); } // bitte
  }
  mb.add(U.box, c, 0, 1.15, 5.05, 0, 0, 0, 3.4, 2.1, .14);
  // postazione del timoniere con scudi corazzati
  mb.add(U.box, d, 0, 1.3, 4.5, 0, 0, 0, 3.1, .12, 1.0);
  mb.add(U.box, c, .9, 2.35, 4.15, 0, 0, 0, .9, .55, .08); mb.add(U.box, c, -.9, 2.35, 4.15, 0, 0, 0, .9, .55, .08);
  mb.add(U.box, 0x2c2c2c, .9, 2.45, 4.2, 0, 0, 0, .3, .12, .1);
  mb.add(U.cyl12, 0x1d1d1d, .9, 1.85, 4.55, PI / 2, 0, 0, .2, .04, .2); mb.add(U.cyl, 0x333333, .9, 1.6, 4.6, 0, 0, 0, .04, .5, .04);
  // vano motore e scarico
  mb.add(U.box, 0x4a564e, 0, .9, 3.6, 0, 0, 0, 1.3, .8, 1.4); mb.add(U.box, 0x3d4842, 0, 1.32, 3.6, 0, 0, 0, 1.36, .06, 1.46);
  mb.add(U.cyl, 0x2b2622, -1.2, 2.1, 4.9, 0, 0, 0, .09, .7, .09);
  // mitragliatrici Browning .30 sulle ralle di poppa
  for (const sx of [-1, 1]) {
    mb.add(U.cyl12, 0x2e2e2e, sx * 1.35, 2.2, 4.75, 0, 0, 0, .12, .05, .12); mb.add(U.cyl, 0x333333, sx * 1.35, 2.35, 4.75, 0, 0, 0, .03, .3, .03);
    mb.add(U.box, 0x1e1e1e, sx * 1.35, 2.52, 4.6, 0, 0, 0, .1, .16, .4); mb.add(U.cyl, 0x1a1a1a, sx * 1.35, 2.56, 4.0, PI / 2 - .2, 0, 0, .03, 1.0, .03);
    mb.add(U.cyl, 0x1a1a1a, sx * 1.35, 2.55, 4.25, PI / 2 - .2, 0, 0, .05, .45, .05); mb.add(U.box, 0x3d3a2a, sx * 1.42, 2.45, 4.6, 0, 0, 0, .1, .12, .18);
  }
  // pagliolato bagnato con acqua sul fondo
  mb.mat = 'wood';
  for (let x = -1.35; x <= 1.36; x += .3) mb.add(U.box, 0x6a5440, x, .44, -.4, 0, 0, 0, .27, .05, 8.6);
  for (let i = -4 ; i <= 3; i += 1.4) mb.add(U.box, 0x5a4636, 0, .47, i, 0, 0, 0, 3, .03, .1);
  mb.mat = 'vc';
  for (let i = 0; i < 7; i++) mb.add(U.cyl12, 0x1c2622, rnd(-1, 1), .472, rnd(-4.3, 2), 0, 0, 0, rnd(.3, .7), .005, rnd(.4, 1.1)); // pozze d'acqua
  for (let i = 0; i < 6; i++) mb.add(U.box, R() < .5 ? 0x3a3a2a : 0x4a4230, rnd(-1.2, 1.2), .56, rnd(-4, 2.5), 0, R() * 3, 0, rnd(.3, .55), .2, rnd(.25, .45)); // casse e zaini
  LCVP_G = mb.buildGroups();
  // rampa: lamiera rinforzata, cerniere e cavi
  const rb = new MB(); rb.mat = 'paint';
  rb.add(U.box, 0x55625a, 0, 1.02, 0, 0, 0, 0, 3.2, 2.05, .12);
  for (const y of [.3, .7, 1.1, 1.5, 1.85]) rb.add(U.box, 0x66726a, 0, y, -.1, 0, 0, 0, 3.1, .07, .09);
  for (const x of [-1.25, -.6, 0, .6, 1.25]) rb.add(U.box, 0x66726a, x, 1, -.1, 0, 0, 0, .07, 1.95, .09);
  for (const y of [.3, .7, 1.1, 1.5]) rb.add(U.box, 0x4f5a52, 0, y, .08, 0, 0, 0, 2.9, .04, .05); // listelli antiscivolo
  rb.add(U.box, 0x555f58, 0, 2.05, -.02, 0, 0, 0, 3.25, .08, .22);
  for (const x of [-1.2, -.4, .4, 1.2]) rb.add(U.cyl12, 0x30302c, x, .05, 0, 0, 0, PI / 2, .07, .3, .07); // cerniere
  rb.mat = 'vcMetal';
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) rb.add(U.box, 0x22201e, sx * 1.45, 1.98 + k * .02, .12 + k * .1, 1.2, 0, 0, .025, .07, .04); // cavi del verricello
  RAMP_G = rb.buildGroups();
}
class Boat {
  constructor(x, z0, speed, stopZ) {
    this.g = groupMesh(LCVP_G);
    this.pivot = new THREE.Group(); this.pivot.position.set(0, .25, -5.1); this.g.add(this.pivot);
    this.pivot.add(groupMesh(RAMP_G));
    this.x = x; this.z = z0; this.speed = speed; this.stopZ = stopZ; this.state = 'move'; this.ramp = 0; this.ph = R() * 10; this.sinkT = 0; this.y = 0;
    this.g.position.set(x, 0, z0); scene.add(this.g); WORLD.boats.push(this);
    this.spray = 0;
  }
  get landed() { return this.state === 'landed'; }
  get open() { return this.state === 'landed' && this.ramp >= 1; }
  update(dt, t) {
    if (this.state === 'move') {
      this.z -= this.speed * dt;
      // spruzzi della prua
      this.spray -= dt;
      if (this.spray <= 0 && dist2Cam(this.g.position) < 250 * 250) {
        this.spray = .12;
        for (let i = 0; i < 3; i++) PS_GRAIN.emit(this.x + rnd(-1.8, 1.8), this.y + .6, this.z - 5.2, rnd(-2.5, 2.5), rnd(1.5, 4), rnd(-1, 1) - this.speed * .3, rnd(.6, 1), .06, .05, .85, ...C_WATER, .3, 9.8);
        PS_SMOKE.emit(this.x + rnd(-1.6, 1.6), this.y + .4, this.z - 5, rnd(-1, 1), .8, 1, .9, .3, 1.4, .4, ...C_WATER, 1);
        if (this === P.boat && P.inBoat && R() < .06) lensSplat('water', .35);
      }
      if (this.z <= this.stopZ) {
        this.z = this.stopZ; this.state = 'landed';
        const x = this.x, z = this.z, y0 = -1, y1 = 3;
        this.sol = [addSolid(x - 1.72, y0, z - 5, x - 1.5, y1, z + 5.1, 'boat'), addSolid(x + 1.5, y0, z - 5, x + 1.72, y1, z + 5.1, 'boat'), addSolid(x - 1.7, y0, z + 4.95, x + 1.7, y1, z + 5.15, 'boat')];
      }
    }
    if (this.state === 'landed' && this.ramp < 1) {
      this.ramp = Math.min(1, this.ramp + dt * .85); this.pivot.rotation.x = -1.45 * smooth(this.ramp);
      if (this.ramp >= 1) { const p = new V3(this.x, WATER_Y, this.z - 7); fxImpact(p, 'water'); play('imp_water', p, { ref: 20, vol: 1.5, rate: .6 }); }
    }
    let y = .32 + waveH(this.x, this.z, t) * (this.state === 'move' ? 1 : .35);
    const pitch = this.state === 'move' ? (waveH(this.x, this.z - 4, t) - waveH(this.x, this.z + 4, t)) * .1 : 0;
    if (this.state === 'sunk') { this.sinkT += dt; y -= Math.min(1.7, this.sinkT * .25); this.g.rotation.z = Math.min(.35, this.sinkT * .05); }
    this.y = y;
    this.g.position.set(this.x, y, this.z);
    if (this.state !== 'sunk') { this.g.rotation.x = pitch; this.g.rotation.z = Math.sin(t * 1.3 + this.ph) * .025 * (this.state === 'move' ? 1 : .2); }
    this.g.updateMatrixWorld();
  }
  toWorld(off, out) { return out.copy(off).applyMatrix4(this.g.matrixWorld); }
}

// ---------- bunker e cannoni da 88 ----------
let BUNKER_G, FLAK_G, AA_G;
function buildBunkerGeo() {
  const mb = new MB(), c = 0xb0aca2, c2 = 0x9a968c;
  mb.mat = 'concrete';
  mb.add(U.box, c, 0, 1.25, 0, 0, 0, 0, 9, 2.5, 7);
  mb.add(U.box, c, -3.25, 2.78, 0, 0, 0, 0, 2.5, .56, 7); mb.add(U.box, c, 3.25, 2.78, 0, 0, 0, 0, 2.5, .56, 7);
  mb.add(U.box, c, 0, 2.78, -1.2, 0, 0, 0, 4, .56, 4.6);
  mb.add(U.box, c, 0, 3.6, 0, 0, 0, 0, 9, 1.1, 7);
  mb.add(U.box, c2, 0, 4.4, .2, 0, 0, 0, 10, .7, 8);
  for (const sx of [-1, 1]) { mb.add(U.box, c2, sx * 5.2, 1.6, 3.4, 0, sx * -.5, 0, .8, 3, 2.5); mb.add(U.box, c2, sx * 5, 4.4, .2, 0, 0, sx * .5, .6, .6, 8); }
  mb.add(U.box, c2, 0, 2.48, 3.35, .5, 0, 0, 4.2, .12, .5); mb.add(U.box, c2, 0, 3.08, 3.35, -.5, 0, 0, 4.2, .12, .5);
  for (let i = 0; i < 6; i++) mb.add(U.box, c2, rnd(-4, 4), 4.78, rnd(-3, 3), rnd(-.1, .1), R() * 3, rnd(-.1, .1), rnd(.4, 1), .12, rnd(.4, 1));
  mb.mat = 'vc';
  mb.add(U.box, 0x0b0b0b, 0, 2.78, 3.2, 0, 0, 0, 3.9, .54, .6);
  mb.add(U.box, 0x151515, 0, 1.1, -3.52, 0, 0, 0, 1.4, 2.1, .1);
  mb.add(U.box, 0x3a3a36, 0, 1.1, -3.56, 0, 0, 0, 1.6, 2.3, .05);
  for (let i = 0; i < 14; i++) mb.add(U.ico1, R() < .5 ? 0x55603a : 0x6b6a45, rnd(-4.5, 4.5), 4.9, rnd(-3.5, 3.5), 0, R() * 3, 0, rnd(.6, 1.2), rnd(.3, .5), rnd(.6, 1.2));
  mb.mat = 'paint';
  mb.add(U.box, 0x3d3f3a, -2.1, 2.78, 3.48, 0, .4, 0, .9, .5, .04); mb.add(U.box, 0x3d3f3a, 2.1, 2.78, 3.48, 0, -.4, 0, .9, .5, .04);
  for (let i = 0; i < 6; i++) mb.add(U.cyl, 0x4a3a2a, rnd(-4, 4), 3.9, 3.45, rnd(-.6, .6), 0, rnd(-.6, .6), .015, rnd(.3, .8), .015);
  BUNKER_G = mb.buildGroups();
  const f = new MB(), y = 0xa59a72, dk = 0x55544c; f.mat = 'paint';
  f.add(U.box, dk, 0, .35, 0, 0, 0, 0, 6.5, .3, .6); f.add(U.box, dk, 0, .35, 0, 0, 0, 0, .6, .3, 6.5);
  for (const [x, z] of [[3.1, 0], [-3.1, 0], [0, 3.1], [0, -3.1]]) f.add(U.cyl12, dk, x, .22, z, 0, 0, 0, .35, .1, .35);
  f.add(U.cyl12, y, 0, 1.0, 0, 0, 0, 0, .5, 1.1, .5);
  f.add(U.box, y, 0, 1.85, .3, 0, 0, 0, 1.3, .8, 1.8);
  f.add(U.cyl12, y, 0, 2.62, 2.58, 1.22, 0, 0, .1, 5.6, .1);
  f.add(U.cyl12, dk, 0, 3.55, 5.16, 1.22, 0, 0, .15, .5, .15);
  f.add(U.cyl12, y, 0, 2.2, 1.6, 1.22, 0, 0, .14, 1.8, .14); f.add(U.cyl12, y, .25, 2.1, 1.3, 1.22, 0, 0, .07, 1.4, .07); f.add(U.cyl12, y, -.25, 2.1, 1.3, 1.22, 0, 0, .07, 1.4, .07);
  f.add(U.box, y, 0, 2.0, 1.2, -.15, 0, 0, 2.6, 1.7, .08); f.add(U.box, y, -.9, 2.0, .7, -.15, .6, 0, .9, 1.6, .06); f.add(U.box, y, .9, 2.0, .7, -.15, -.6, 0, .9, 1.6, .06);
  f.add(U.box, dk, -.8, .5, -2.4, 0, 0, 0, .9, .5, .5); f.add(U.box, dk, .8, .5, 2.4, 0, 0, 0, .9, .5, .5);
  for (let i = 0; i < 8; i++) f.add(U.cyl, 0xb09040, -2.2 + i * .1, .4, -2, PI / 2, 0, 0, .045, .9, .045);
  FLAK_G = f.buildGroups();
  const a = new MB(); a.mat = 'paint';
  a.add(U.cyl12, 0x5a5d58, 0, .35, 0, 0, 0, 0, .7, .2, .7); a.add(U.box, 0x6a6d65, 0, .8, 0, 0, 0, 0, .5, .6, .7);
  a.add(U.cyl12, 0x3a3a38, 0, 1.15, -.9, 1.1, 0, 0, .04, 1.6, .04); a.add(U.box, 0x6a6d65, 0, 1.0, -.3, 0, 0, 0, .9, .6, .04); a.add(U.box, 0x3a3a38, .18, .95, -.1, 0, 0, 0, .1, .25, .15);
  AA_G = a.buildGroups();
}
const MAT_BURNT = {};
function burnMeshes(g) { g.traverse(o => { if (o.isMesh) { const k = o.material === MAT.concrete ? 'concrete' : 'paint'; o.material = MAT_BURNT[k] || (MAT_BURNT[k] = (() => { const m = k === 'concrete' ? triMaterial(TEX.concrete, .32) : triMaterial(TEX.metal, .35, { metal: .3 }); m.color.setRGB(.28, .25, .22); return m; })()); } }); }
function makeBunker(x, extra) {
  const z = -84.5, g = H(x, z + 3), base = g - 1.35;
  const mesh = groupMesh(BUNKER_G); mesh.position.set(x, base, z); scene.add(mesh);
  const b = {
    x, z, base, mesh, gunner: null, destroyed: false, slitY: base + 2.78,
    door: new V3(x, H(x, z - 4.6), z - 4.6),
    lower: addSolid(x - 4.5, base - 2, z - 3.5, x + 4.5, base + 2.5, z + 3.5, 'bunker'),
    upper: addSolid(x - 4.5, base + 3.06, z - 3.5, x + 4.5, base + 4.8, z + 3.5, 'bunker'),
    side: addSolid(x - 4.5, base + 2.4, z - 3.5, x + 4.5, base + 3.1, z + 1, 'bunker'),
    get neutralized() { return this.destroyed || !this.gunner || !this.gunner.alive; },
    destroy() {
      if (this.destroyed) return; this.destroyed = true;
      burnMeshes(this.mesh);
      if (this.gunner && this.gunner.alive) this.gunner.die(null, false, 'blast', { blast: new V3(this.x, this.slitY - 1, this.z + 1), power: 8 });
      const p = new V3(this.x, this.slitY, this.z + 3.4);
      fxExplosion(p, 2.4, false); sfxBoom(p, 2.2); fxDebris(p, 25, 2.5);
      addEmitter(p, 'fire', .9); addEmitter(new V3(this.x, base + 5, this.z), 'smoke', 1.2);
    }
  };
  for (let i = -3; i <= 3; i++) addCover(x + i * 1.4, z + 5.2, 'bunker');
  (extra ? (WORLD.extraBunkers || (WORLD.extraBunkers = [])) : WORLD.bunkers).push(b); return b;
}
function makeFlak(x, z) {
  const base = H(x, z), mesh = groupMesh(FLAK_G);
  mesh.position.set(x, base, z); scene.add(mesh);
  const f = {
    x, z, mesh, alive: true, fireT: rnd(3, 8),
    muzzle: new V3(x, base + 3.55 + .3, z + 5.4), pos: new V3(x, base, z),
    solid: addSolid(x - 1.3, base, z - .5, x + 1.3, base + 2.6, z + 2.2, 'flak'),
    destroy() {
      if (!this.alive) return; this.alive = false;
      burnMeshes(this.mesh); this.mesh.rotation.z = .25; this.mesh.rotation.x = -.1;
      const p = new V3(this.x, base + 1.5, this.z);
      fxExplosion(p, 2.6, false); sfxBoom(p, 2.4); addEmitter(p, 'fire', 1.1); fxDebris(p, 20, 2);
    }
  };
  WORLD.flaks.push(f); return f;
}

// ---------- modelli statici ----------
function addSherman(mb, x, y, z, ry, burnt) {
  const c = burnt ? 0x4a4540 : 0x6d7550, d = burnt ? 0x34302b : 0x4f5539, om = mb.mat; mb.mat = 'paint';
  mb.setBase(x, y, z, 0, ry, 0);
  mb.add(U.box, c, 0, .75, 0, 0, 0, 0, 2.5, 1.0, 5.8);
  mb.add(U.box, c, 0, 1.55, .35, 0, 0, 0, 2.4, .75, 4.2);
  mb.add(U.box, c, 0, 1.3, -2.35, -.62, 0, 0, 2.4, .95, 1.6);
  for (const sx of [-1, 1]) {
    mb.add(U.box, d, sx * 1.38, .55, 0, 0, 0, 0, .55, 1.05, 6.0);
    for (let i = 0; i < 6; i++) mb.add(U.cyl12, d, sx * 1.38, .38, -2.3 + i * .92, 0, 0, PI / 2, .33, .62, .33);
    for (let i = 0; i < 3; i++) mb.add(U.box, d, sx * 1.2, .55, -2 + i * 2, 0, 0, 0, .15, .5, .4);
    mb.add(U.cyl12, d, sx * 1.38, .7, -2.9, 0, 0, PI / 2, .35, .58, .35); mb.add(U.cyl12, d, sx * 1.38, .7, 2.9, 0, 0, PI / 2, .3, .58, .3);
  }
  mb.add(U.cyl12, c, 0, 2.35, .35, 0, 0, 0, 1.05, .9, 1.1); mb.add(U.cyl12, c, 0, 2.85, .4, 0, 0, 0, .9, .15, .95);
  mb.add(U.box, c, 0, 2.3, -.75, 0, 0, 0, .95, .62, .45);
  mb.add(U.cyl12, d, 0, 2.3, -2.05, PI / 2, 0, 0, .075, 2.6, .075);
  mb.add(U.cyl12, d, -.4, 2.95, .5, 0, 0, 0, .3, .1, .3); mb.add(U.cyl, 0x222222, .4, 3.05, .3, PI / 2 - .2, 0, 0, .02, .9, .02);
  for (let i = 0; i < 4; i++) mb.add(U.box, d, -.9 + i * .6, 1.95, 2.3, 0, 0, 0, .5, .3, .3);
  mb.clearBase(); mb.mat = om;
}
function addLCVPWreck(mb, x, z, ry, rz) {
  const y = Math.max(H(x, z), -.6), om = mb.mat; mb.mat = 'paint';
  mb.setBase(x, y - .3, z, 0, ry, rz);
  mb.add(U.box, 0x5d665f, 0, .12, 0, 0, 0, 0, 3.3, .5, 10.2);
  mb.add(U.box, 0x6b756d, -1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2); mb.add(U.box, 0x6b756d, 1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2);
  mb.add(U.box, 0x6b756d, 0, 1.08, 5.05, 0, 0, 0, 3.3, 1.95, .14);
  mb.add(U.box, 0x5d665f, 0, .4, -5.6, -1.3, 0, 0, 3.2, 2, .12);
  mb.clearBase(); mb.mat = om;
  addCover(x, z + 6, 'wreck'); OBST.push({ x, z, r: 2.2 }, { x: x + Math.sin(ry) * 3, z: z + Math.cos(ry) * 3, r: 2 }, { x: x - Math.sin(ry) * 3, z: z - Math.cos(ry) * 3, r: 2 });
}
function addHouse(mb, cx, cz, w, d, h, ruined) {
  const base = Math.min(H(cx - w / 2, cz - d / 2), H(cx + w / 2, cz - d / 2), H(cx - w / 2, cz + d / 2), H(cx + w / 2, cz + d / 2)) - .3;
  const stone = pick([0xc2b9a5, 0xb6ac97, 0xcdc4ae, 0xaea591]), top = base + h + .3, street = cz < -281 ? 1 : -1;
  if (!ruined) {
    mb.mat = 'stone';
    mb.add(U.box, stone, cx, base + (h + .3) / 2, cz, 0, 0, 0, w, h + .3, d);
    mb.add(U.box, stone, cx + w * .3, top + d * .3, cz, 0, 0, 0, .7, d * .45 + 1, .7);
    mb.add(U.box, 0x8a8478, cx, base + .3, cz, 0, 0, 0, w + .1, .6, d + .1);
    mb.mat = 'roof';
    mb.add(U.prism, pick([0x9aa0a8, 0x8e949b, 0xa58876]), cx, top, cz, 0, PI / 2, 0, d + .7, d * .45, w + .6);
    mb.mat = 'vc';
    for (const sz of [-1, 1]) for (let fx = -w / 2 + 1.6; fx < w / 2 - 1; fx += 2.6) for (const fy of h > 4.5 ? [1.7, 4.2] : [1.7]) {
      const z = cz + sz * d / 2;
      mb.add(U.box, 0x18191b, cx + fx, base + fy, z, 0, 0, 0, .95, 1.25, .12);
      mb.add(U.box, 0xd0cbbd, cx + fx, base + fy - .68, z, 0, 0, 0, 1.15, .1, .2);
      mb.add(U.box, 0x5a4a3a, cx + fx, base + fy, z + sz * .07, 0, 0, 0, .06, 1.2, .02); mb.add(U.box, 0x5a4a3a, cx + fx, base + fy, z + sz * .07, 0, 0, 0, .9, .05, .02);
      mb.add(U.box, 0x46523f, cx + fx - .78, base + fy, z + sz * .02, 0, sz * .3, 0, .5, 1.3, .05); mb.add(U.box, 0x46523f, cx + fx + .78, base + fy, z + sz * .02, 0, -sz * .3, 0, .5, 1.3, .05);
    }
    mb.add(U.box, 0x4a3524, cx, base + 1.3, cz + street * d / 2, 0, 0, 0, 1.2, 2.3, .14);
    mb.add(U.box, 0x3a3a3a, cx, top - .05, cz + street * (d / 2 + .1), 0, 0, 0, w + .6, .1, .15);
    addSolid(cx - w / 2, base, cz - d / 2, cx + w / 2, top + d * .45, cz + d / 2, 'house');
  } else {
    const t = .5, walls = [[cx, cz - d / 2 + t / 2, w, t], [cx, cz + d / 2 - t / 2, w, t], [cx - w / 2 + t / 2, cz, t, d], [cx + w / 2 - t / 2, cz, t, d]];
    walls.forEach((wl, wi) => {
      const len = Math.max(wl[2], wl[3]), along = wl[2] > wl[3], segs = Math.max(2, Math.round(len / 1.2));
      let hsum = 0, cnt = 0;
      mb.mat = 'stone';
      for (let i = 0; i < segs; i++) {
        const f = -len / 2 + (i + .5) * len / segs;
        if (wi === (street > 0 ? 1 : 0) && Math.abs(f) < 1.1) continue;
        const sh = rnd(1.4, h) * (R() < .2 ? .4 : 1); hsum += sh; cnt++;
        mb.add(U.box, stone, wl[0] + (along ? f : 0), base + sh / 2, wl[1] + (along ? 0 : f), 0, 0, 0, along ? len / segs + .02 : t, sh, along ? t : len / segs + .02);
      }
      const ah = base + hsum / Math.max(1, cnt);
      if (wi === (street > 0 ? 1 : 0)) {
        addSolid(wl[0] - len / 2, base, wl[1] - t / 2, wl[0] - 1.1, ah, wl[1] + t / 2, 'ruin');
        addSolid(wl[0] + 1.1, base, wl[1] - t / 2, wl[0] + len / 2, ah, wl[1] + t / 2, 'ruin');
      } else addSolid(wl[0] - wl[2] / 2, base, wl[1] - wl[3] / 2, wl[0] + wl[2] / 2, ah, wl[1] + wl[3] / 2, 'ruin');
    });
    mb.mat = 'stone';
    for (let i = 0; i < 12; i++) mb.add(U.ico, stone, cx + rnd(-w / 2, w / 2), base + .3, cz + rnd(-d / 2, d / 2), R() * 3, R() * 3, 0, rnd(.4, 1.3), rnd(.3, .7), rnd(.4, 1.3));
    mb.mat = 'wood';
    for (let i = 0; i < 5; i++) mb.add(U.box, 0x2a201a, cx + rnd(-w / 3, w / 3), base + rnd(.5, 2.5), cz + rnd(-d / 3, d / 3), rnd(-.8, .8), R() * 3, rnd(-.5, .5), .2, .2, rnd(2, 4));
    mb.mat = 'vc';
    addCover(cx, cz + (street > 0 ? -d / 2 + 1.2 : d / 2 - 1.2), 'ruin');
    addEmitter(new V3(cx + rnd(-2, 2), base + .5, cz + rnd(-2, 2)), R() < .5 ? 'smoke' : 'fire', .6);
  }
  mb.mat = 'vc';
  addCover(cx - w / 2 + 1, cz + d / 2 + 1, 'house'); addCover(cx + w / 2 - 1, cz + d / 2 + 1, 'house');
  addCover(cx - w / 2 + 1, cz - d / 2 - 1, 'houseS'); addCover(cx + w / 2 - 1, cz - d / 2 - 1, 'houseS');
  return base;
}
function addTree(mb, x, z, s = 1) {
  const y = H(x, z), hgt = rnd(5, 9) * s, om = mb.mat;
  mb.mat = 'wood'; mb.add(new THREE.CylinderGeometry(.16, .26, 1, 8), 0x4e3d2d, x, y + hgt / 2, z, rnd(-.05, .05), 0, rnd(-.05, .05), s, hgt, s);
  mb.mat = 'vc';
  for (let i = 0; i < 5; i++) mb.add(U.ico1, pick([0x3f5228, 0x4a5e2c, 0x37481f, 0x55662f]), x + rnd(-1.8, 1.8) * s, y + hgt + rnd(-1.4, 1.2) * s, z + rnd(-1.8, 1.8) * s, R(), R(), R(), rnd(1.6, 2.8) * s, rnd(1.4, 2.4) * s, rnd(1.6, 2.8) * s);
  mb.mat = om;
}
function sandbagLine(mb, x0, z0, x1, z1, rows = 2) {
  const om = mb.mat; mb.mat = 'sack';
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / .95)), ry = Math.atan2(x1 - x0, z1 - z0) + PI / 2;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const t = (i + .5 + (r % 2) * .5) / n; if (t > 1) continue;
    const x = lerp(x0, x1, t), z = lerp(z0, z1, t), y = H(x, z);
    mb.add(U.box, pick([0xc0b090, 0xb0a080, 0xa89878]), x, y + .17 + r * .3, z, rnd(-.05, .05), ry + rnd(-.1, .1), rnd(-.05, .05), .95, .3, .48);
  }
  mb.mat = om;
}

function buildStatic() {
  const S = new MB();
  // --- ostacoli della spiaggia ---
  S.mat = 'paint';
  for (let i = 0; i < 450; i++) {
    const x = i < 250 ? srnd(-195, 195) : srnd(-MAPX + 40, MAPX - 40), z = srnd(-49, 78), y = H(x, z), ry = srnd(0, PI);
    S.add(U.box, 0x6a5a4c, x, y + .7, z, PI / 4, ry, 0, .17, .17, 2.4);
    S.add(U.box, 0x6a5a4c, x, y + .7, z, -PI / 4, ry, 0, .17, .17, 2.4);
    S.add(U.box, 0x705e50, x, y + .7, z, 0, ry + PI / 2, PI / 4, .17, 2.4, .17);
    addCover(x + rnd(-.3, .3), z + 1.35, 'hh'); OBST.push({ x, z, r: .9 });
  }
  for (let i = 0; i < 34; i++) {
    const x = srnd(-185, 185), z = srnd(-10, 82), y = H(x, z), ry = srnd(-.25, .25);
    S.setBase(x, y, z, 0, ry, 0);
    for (const fx of [-1.4, 0, 1.4]) S.add(U.box, 0x6b5d50, fx, 1.3, 0, 0, 0, 0, .14, 2.6, .14);
    for (const fy of [.3, 1.3, 2.5]) S.add(U.box, 0x6b5d50, 0, fy, 0, 0, 0, 0, 3.0, .12, .12);
    for (const fx of [-1.4, 0, 1.4]) S.add(U.box, 0x5e5246, fx, 1.2, 1.1, -.85, 0, 0, .12, .12, 2.9);
    S.clearBase(); addCover(x, z + 2.4, 'gate'); OBST.push({ x: x - 1, z, r: .8 }, { x: x + 1, z, r: .8 });
  }
  for (let i = 0; i < 55; i++) {
    const x = srnd(-190, 190), z = srnd(-24, 65), y = H(x, z);
    S.mat = 'wood'; S.add(new THREE.CylinderGeometry(.12, .15, 1, 8), 0x7b6a56, x, y + 1.65, z + 1.13, .6, 0, 0, 1, 4, 1);
    S.mat = 'paint'; S.add(U.cyl12, 0x6c6f5c, x, y + 3.35, z + 2.26, .6, 0, 0, .18, .09, .18); S.add(U.cyl12, 0x55574a, x, y + 3.4, z + 2.29, .6, 0, 0, .04, .08, .04);
    OBST.push({ x, z: z + .3, r: .35 });
  }
  // relitti in fiamme
  [[45, -21, .4], [-92, -30, -.3], [118, -10, 2.6], [-150, -15, .2], [5, -38, -.7], [-48, -12, 1.2]].forEach(([x, z, r], i) => {
    addSherman(S, x, H(x, z) - .25, z, r, true);
    addEmitter(new V3(x, H(x, z) + 2.4, z), i % 2 ? 'fire' : 'smoke', i % 2 ? .9 : 1);
    addSolid(x - 2, H(x, z) - 1, z - 2, x + 2, H(x, z) + 2.6, z + 2, 'tank');
    addCover(x, z + 3.6, 'tank'); addCover(x + 1.5, z + 3.4, 'tank');
  });
  // altri relitti di carri e barricate di sacchi e rottami
  for (let i = 0; i < 12; i++) {
    const x = srnd(-190, 190), z = srnd(-48, 60);
    addSherman(S, x, H(x, z) - .3, z, srnd(0, TAU), true); addSolid(x - 2, H(x, z) - 1, z - 2, x + 2, H(x, z) + 2.6, z + 2, 'tank');
    addCover(x, z + 3.6, 'tank'); addCover(x + 1.6, z + 3.4, 'tank'); addCover(x - 1.6, z + 3.4, 'tank');
    if (i % 3 === 0) addEmitter(new V3(x, H(x, z) + 2.4, z), 'smoke', .8);
  }
  for (let i = 0; i < 30; i++) {
    const x = srnd(-195, 195), z = srnd(-50, 66), y = H(x, z), ry = srnd(-.3, .3);
    S.setBase(x, y, z, 0, ry, 0); S.mat = 'sack';
    for (let k = 0; k < 5; k++) for (let l = 0; l < 2; l++) S.add(U.box, pick([0x8a7f5e, 0x7d7353, 0x93886a]), -1.6 + k * .8 + l * .4, .2 + l * .36, 0, 0, srnd(-.1, .1), 0, .78, .36, .5);
    S.clearBase(); addSolid(x - 2, y - .5, z - .35, x + 2, y + .8, z + .35, 'sand');
    addCover(x - .8, z + 1, 'sand'); addCover(x + .8, z + 1, 'sand');
  }
  // dettagli della spiaggia lungo tutta la costa
  const farX = () => srnd(205, MAPX - 40) * (R() < .5 ? -1 : 1);
  for (let i = 0; i < 120; i++) {
    const x = farX(), z = srnd(-10, 82), y = H(x, z), ry = srnd(-.25, .25);
    S.mat = 'paint'; S.setBase(x, y, z, 0, ry, 0);
    for (const fx of [-1.4, 0, 1.4]) S.add(U.box, 0x6b5d50, fx, 1.3, 0, 0, 0, 0, .14, 2.6, .14);
    for (const fy of [.3, 1.3, 2.5]) S.add(U.box, 0x6b5d50, 0, fy, 0, 0, 0, 0, 3.0, .12, .12);
    S.clearBase(); addCover(x, z + 2.4, 'gate'); OBST.push({ x: x - 1, z, r: .8 }, { x: x + 1, z, r: .8 });
  }
  for (let i = 0; i < 260; i++) {
    const x = farX(), z = srnd(-24, 65), y = H(x, z);
    S.mat = 'wood'; S.add(U.cyl, 0x7b6a56, x, y + 1.65, z + 1.13, .6, 0, 0, .13, 4, .13);
    S.mat = 'paint'; S.add(U.cyl12, 0x6c6f5c, x, y + 3.35, z + 2.26, .6, 0, 0, .18, .09, .18);
    OBST.push({ x, z: z + .3, r: .35 });
  }
  for (let i = 0; i < 36; i++) {
    const x = farX(), z = srnd(-48, 40);
    addSherman(S, x, H(x, z) - .3, z, srnd(0, TAU), true); addSolid(x - 2, H(x, z) - 1, z - 2, x + 2, H(x, z) + 2.6, z + 2, 'tank');
    addCover(x, z + 3.6, 'tank'); if (i % 3 === 0) addEmitter(new V3(x, H(x, z) + 2.4, z), i % 2 ? 'fire' : 'smoke', .8);
  }
  for (let i = 0; i < 18; i++) addLCVPWreck(S, farX(), srnd(-4, 30), srnd(-.6, .6), srnd(-.35, .35));
  for (let i = 0; i < 100; i++) {
    const x = farX(), z = srnd(-50, 60), y = H(x, z), ry = srnd(-.3, .3);
    S.setBase(x, y, z, 0, ry, 0); S.mat = 'sack';
    for (let k = 0; k < 5; k++) for (let l = 0; l < 2; l++) S.add(U.box, pick([0x8a7f5e, 0x7d7353, 0x93886a]), -1.6 + k * .8 + l * .4, .2 + l * .36, 0, 0, srnd(-.1, .1), 0, .78, .36, .5);
    S.clearBase(); addSolid(x - 2, y - .5, z - .35, x + 2, y + .8, z + .35, 'sand'); addCover(x, z + 1, 'sand');
  }
  for (let i = 0; i < 400; i++) {
    const x = farX(), z = srnd(-50, 10), y = H(x, z);
    if (R() < .5) { S.mat = 'wood'; S.add(U.box, pick([0x8d7a5c, 0x7a6a50, 0x6a5a40]), x, y + .2, z, 0, R() * 3, 0, rnd(.4, .9), rnd(.3, .5), rnd(.4, 1.2)); }
    else { S.mat = 'paint'; S.add(U.cyl12, 0x6f755a, x, y + .15, z, PI / 2, R() * 3, 0, .17, .5, .17); }
  }
  S.mat = 'wood';
  for (let x = -MAPX + 40; x < MAPX - 40; x += srnd(3, 10)) if (Math.abs(x) > 200) S.add(U.box, 0x6a5a47, x, H(x, BANK_Z + .8) + .55, BANK_Z + .8, srnd(-.2, .1), srnd(-.3, .3), srnd(-.15, .15), .15, 1.3, .15);
  for (let x = -MAPX + 40; x < MAPX - 40; x += 4) if (Math.abs(x) > 200) { S.mat = 'paint'; S.add(U.cyl, 0x5a4a3a, x, H(x, WIRE_Z) + .6, WIRE_Z, 0, 0, srnd(-.15, .15), .05, 1.3, .05); }
  for (let i = 0; i < 16; i++) { const x = farX(), z = srnd(-80, 40); addEmitter(new V3(x, Math.max(H(x, z), WATER_Y) + .5, z), R() < .3 ? 'fire' : 'smoke', rnd(.8, 1.5)); }
  // nidi di sacchi a terra e buche sulla scogliera per i difensori
  for (let i = 0; i < 46; i++) {
    const x = srnd(-200, 200), z = srnd(-82, -68); if (Math.abs(x - BREACH_X) < 8 || inMinefield(x, z)) continue;
    const y = H(x, z), ry = srnd(-.25, .25); S.setBase(x, y, z, 0, ry, 0); S.mat = 'sack';
    for (let k = 0; k < 7; k++) { const a = -1.2 + k * .4; for (let l = 0; l < 2; l++) S.add(U.box, pick([0x8a7f5e, 0x7d7353, 0x6f6a50]), Math.sin(a) * 1.4, .18 + l * .34, Math.cos(a) * 1.1 - .3, 0, a, 0, .7, .34, .45); }
    S.clearBase(); addSolid(x - 1.5, y - .5, z + .4, x + 1.5, y + .6, z + 1, 'sand'); addCover(x, z - .4, 'trench');
  }
  [[-60, 3, .35, .25], [80, 1, -.5, -.3], [150, 4, .2, .3], [-130, 2, -.25, .2], [20, -2, .6, .4], [-175, 5, -.2, -.25]].forEach(([x, z, ry, rz], i) => { addLCVPWreck(S, x, z, ry, rz); if (i % 2) addEmitter(new V3(x, WATER_Y + 1, z), 'fire', .7); });
  for (let i = 0; i < 90; i++) {
    const x = srnd(-180, 180), z = srnd(-50, -2), y = H(x, z);
    if (R() < .5) { S.mat = 'wood'; S.add(U.box, pick([0x8d7a5c, 0x7a6a50, 0x6a5a40]), x, y + .2, z, 0, R() * 3, 0, rnd(.4, .9), rnd(.3, .5), rnd(.4, 1.2)); }
    else { S.mat = 'paint'; S.add(U.cyl12, 0x6f755a, x, y + .15, z, PI / 2, R() * 3, 0, .17, .5, .17); }
  }
  // fumogeni e banchi di fumo lungo la spiaggia
  for (let i = 0; i < 7; i++) addEmitter(new V3(srnd(-170, 170), H(0, -30) + .5, srnd(-55, -20)), 'bank', srnd(.8, 1.3));
  for (let i = 0; i < 6; i++) { const x = srnd(-150, 150), z = srnd(-82, -66); addEmitter(new V3(x, H(x, z) + .3, z), R() < .5 ? 'fire' : 'smoke', .5); }
  // terrapieno
  S.mat = 'wood';
  for (let x = -200; x < 200; x += srnd(2, 9)) S.add(U.box, 0x6a5a47, x, H(x, BANK_Z + .8) + .55, BANK_Z + .8, srnd(-.2, .1), srnd(-.3, .3), srnd(-.15, .15), .15, 1.3, .15);
  for (let x = -198; x < 198; x += 2.3) if (!inMinefield(x, -66)) addCover(x + rnd(-.3, .3), BANK_Z + 1.6, 'bank');
  for (let x = -200; x <= 200; x += 4) S.add(U.cyl, 0x5a4a3a, x, H(x, WIRE_Z) + .6, WIRE_Z, 0, 0, srnd(-.15, .15), .05, 1.3, .05);
  // trincea
  for (let x = -164; x < 164; x += 1.15) {
    const z = trenchZ(x) + 1.9, y = H(x, z);
    S.mat = 'sack'; S.add(U.box, R() < .5 ? 0xc0b090 : 0xb0a080, x, y + .18, z, 0, srnd(-.2, .2), 0, 1.05, .32, .5);
    if (R() < .6) S.add(U.box, 0xb8a888, x + .5, y + .48, z + .05, 0, srnd(-.2, .2), 0, 1.0, .3, .48);
  }
  for (let x = -160; x < 160; x += 3.2) addCover(x, trenchZ(x) + .4, 'trench');
  S.mat = 'wood';
  for (let x = -164; x < 164; x += 3) { const z = trenchZ(x) - 1.55; S.add(U.box, 0x6a5a45, x, H(x, z) + .5, z, 0, 0, 0, .12, 1.1, .12); S.add(U.box, 0x7a6a52, x, H(x, z) + .3, z + .05, 0, 0, 0, 3, .25, .04); }
  // postazioni di mortaio e contraerea
  for (const mp of WORLD.mortarPits) {
    for (let a = 0; a < TAU; a += TAU / 10) sandbagLine(S, mp.x + Math.cos(a) * 2.7, mp.z + Math.sin(a) * 2.7, mp.x + Math.cos(a + TAU / 10) * 2.7, mp.z + Math.sin(a + TAU / 10) * 2.7, 2);
    S.mat = 'paint'; const y = H(mp.x, mp.z);
    S.add(U.cyl12, 0x3c3e38, mp.x, y + .6, mp.z, -.75, 0, 0, .045, 1.2, .045); S.add(U.box, 0x3c3e38, mp.x, y + .12, mp.z - .4, 0, 0, 0, .5, .05, .5);
    for (let i = 0; i < 6; i++) S.add(U.box, 0x55603a, mp.x + 1.4, y + .15 + (i % 2) * .2, mp.z + i * .2 - .5, 0, 0, 0, .4, .2, .15);
  }
  for (const aa of WORLD.aaSites) {
    for (let a = 0; a < TAU; a += TAU / 12) sandbagLine(S, aa.x + Math.cos(a) * 3, aa.z + Math.sin(a) * 3, aa.x + Math.cos(a + TAU / 12) * 3, aa.z + Math.sin(a + TAU / 12) * 3, 2);
    const g = groupMesh(AA_G); g.position.set(aa.x, H(aa.x, aa.z), aa.z); scene.add(g); aa.mesh = g;
  }
  // campi minati
  for (const mf of MINEFIELDS) {
    for (let x = mf[0]; x <= mf[1]; x += 18) {
      const z = mf[3] + .5, y = H(x, z);
      S.mat = 'wood'; S.add(U.cyl, 0x5a4a37, x, y + .7, z, 0, 0, srnd(-.2, .2), .05, 1.4, .05);
      S.mat = 'vc'; S.add(U.box, 0xc9b23a, x, y + 1.3, z + .02, 0, 0, srnd(-.2, .2), .7, .45, .04); S.add(U.box, 0x111111, x, y + 1.3, z + .05, 0, 0, 0, .5, .08, .02);
    }
    for (let i = 0; i < 34; i++) mines.push({ x: srnd(mf[0], mf[1]), z: srnd(mf[2], mf[3]), live: true });
  }
  // vegetazione della scogliera
  S.mat = 'vc';
  for (let i = 0; i < 1100; i++) {
    const x = i < 420 ? srnd(-200, 200) : srnd(-MAPX, MAPX), z = srnd(-100, -60); if (Math.abs(z - trenchZ(x)) < 3 || roadDist(x, z) < 4) continue;
    const y = H(x, z);
    if (R() < .7) { S.mat = 'vc'; S.add(U.ico1, pick([0x4a5a2a, 0x5d6a33, 0x3f4f25, 0x6b6c3d]), x, y + .3, z, R(), R(), R(), rnd(.6, 1.5), rnd(.5, 1.1), rnd(.6, 1.5)); }
    else { S.mat = 'concrete'; S.add(U.ico, pick([0x9e9a90, 0xaba69a]), x, y + .1, z, R(), R(), R(), rnd(.4, 1.2), rnd(.3, .8), rnd(.4, 1.2)); }
  }
  // siepi
  for (const hd of HEDGES) {
    const inGap = x => hd.gaps.some(g => x > g[0] && x < g[1]);
    S.mat = 'vc';
    for (let x = -MAPX; x < MAPX; x += Math.abs(x) < 230 ? 1.4 : 2.6) {
      if (inGap(x)) continue;
      const y = H(x, hd.z);
      S.add(U.ico1, pick([0x3a4d23, 0x45582a, 0x33441f, 0x4f6030]), x + rnd(-.4, .4), y + rnd(1.4, 2.2), hd.z + rnd(-.7, .7), R(), R(), R(), rnd(1.3, 2.0), rnd(1.4, 2.1), rnd(1.2, 1.8));
      if (R() < .12) addTree(S, x, hd.z + rnd(-.5, .5), rnd(.8, 1.2));
    }
    const ends = [...hd.gaps.map(g => g[0]), MAPX].sort((a, b) => a - b), starts = [-MAPX, ...hd.gaps.map(g => g[1])].sort((a, b) => a - b);
    for (let k = 0; k < ends.length; k++) for (let x = starts[k]; x < ends[k]; x += 8) {
      const x1 = Math.min(ends[k], x + 8); let lo = 1e9, hi = -1e9;
      for (let s = x; s <= x1; s += 2) { const y = H(s, hd.z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      addSolid(x, lo - 1, hd.z - 1.3, x1, hi + 2.8, hd.z + 1.3, 'hedge').nb = true;
    }
    for (let x = -200; x < 200; x += 3) if (!inGap(x)) { addCover(x, hd.z + 2.3, 'hedgeN'); addCover(x, hd.z - 2.3, 'hedgeS'); }
  }
  for (let i = 0; i < 420; i++) {
    const x = i < 120 ? srnd(-230, 230) : srnd(-MAPX, MAPX), z = i < 120 ? srnd(-420, -110) : srnd(-MAPX + 50, -110);
    if (roadDist(x, z) < 6 || (z < -240 && z > -330 && x > -95 && x < 90) || Math.abs(z + 170) < 6 || Math.abs(z + 218) < 6 || (z < -180 && z > -205 && x > -20 && x < 70)) continue;
    addTree(S, x, z, rnd(.8, 1.3));
  }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) addTree(S, 70 + c * 7 + srnd(-1, 1), -240 - r * 7, .6);
  S.mat = 'wood';
  for (let z = -80; z > -280; z -= 28) { const x = roadX(z) + 5, y = H(x, z); S.add(U.cyl, 0x5a4d3e, x, y + 3.5, z, 0, 0, 0, .1, 7, .1); S.add(U.box, 0x5a4d3e, x, y + 6.6, z, 0, 0, 0, 1.4, .1, .1); }
  // villaggio
  for (const [vx, vz] of [[-700, -330], [-1250, -300], [600, -420]]) for (let k = 0; k < 14; k++) addHouse(S, vx + (k % 7) * 16 - 48 + srnd(-2, 2), vz + (k < 7 ? 0 : -26), srnd(9, 12), 8, R() < .5 ? 6 : 4.5, R() < .3);
  const north = [[-79, 11, 0], [-63, 12, 1], [-48, 9, 0], [-17, 10, 0], [-2, 11, 1], [36, 12, 0], [52, 11, 0], [70, 11, 1]];
  const south = [[-79, 11, 0], [-62, 12, 0], [-45, 10, 1], [-16, 11, 0], [35, 10, 1], [51, 12, 0], [68, 11, 0]];
  for (const [x, w, r] of north) addHouse(S, x, -268, w, 8, R() < .5 ? 6 : 4.5, !!r);
  for (const [x, w, r] of south) addHouse(S, x, -295, w, 8.5, R() < .5 ? 6 : 4.5, !!r);
  {
    const cx = 13, cz = -312, w = 10, d = 20, base = Math.min(H(cx - 5, cz - 10), H(cx + 5, cz + 10)) - .3, st = 0xc6bda8;
    S.mat = 'stone'; S.add(U.box, st, cx, base + 4.5, cz, 0, 0, 0, w, 9, d);
    for (let z = cz - 9; z <= cz + 9; z += 3) for (const sx of [-1, 1]) S.add(U.box, st, cx + sx * (w / 2 + .25), base + 3.5, z, 0, 0, 0, .6, 7, .8);
    S.mat = 'roof'; S.add(U.prism, 0x9aa0a8, cx, base + 9, cz, 0, 0, 0, w + .8, 4.5, d + .6);
    S.mat = 'vc'; for (let z = cz - 8; z <= cz + 6; z += 3.5) for (const sx of [-1, 1]) { S.add(U.box, 0x1a1a1c, cx + sx * w / 2, base + 4.5, z, 0, 0, 0, .14, 3, 1); S.add(U.cyl12, 0x1a1a1c, cx + sx * w / 2, base + 6, z, 0, 0, PI / 2, .5, .14, .5); }
    addSolid(cx - w / 2, base, cz - d / 2, cx + w / 2, base + 13, cz + d / 2, 'church');
    const tx = cx, tz = cz + d / 2 + 2.5;
    S.mat = 'stone'; S.add(U.box, st, tx, base + 6.4, tz, 0, 0, 0, 5, 12.8, 5);
    for (const [px, pz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) S.add(U.box, st, tx + px, base + 13.9, tz + pz, 0, 0, 0, .8, 2.3, .8);
    S.add(U.box, st, tx, base + 16, tz, 0, 0, 0, 5.2, 2, 5.2);
    S.mat = 'roof'; S.add(U.pyr, 0x8e949b, tx, base + 19.8, tz, 0, PI / 4, 0, 3.8, 5.6, 3.8);
    S.mat = 'vc'; S.add(U.box, 0x3a2b1e, tx, base + 1.4, tz + 2.52, 0, 0, 0, 1.4, 2.8, .1); S.add(U.box, 0x777777, tx, base + 23, tz, 0, 0, 0, .08, 1.4, .08); S.add(U.box, 0x777777, tx, base + 23.3, tz, 0, 0, 0, .6, .08, .08);
    addSolid(tx - 2.5, base, tz - 2.5, tx + 2.5, base + 12.8, tz + 2.5, 'tower');
    addSolid(tx - 2.6, base + 15, tz - 2.6, tx + 2.6, base + 22, tz + 2.6, 'tower');
    WORLD.towerTop = new V3(tx, base + 12.8, tz);
    addCover(tx - 3.5, tz + 3.5, 'church'); addCover(tx + 3.5, tz + 3.5, 'church');
  }
  const wall = (x0, x1, z) => {
    S.mat = 'stone';
    for (let x = x0; x < x1; x += 2) { const y = H(x + 1, z); S.add(U.box, pick([0xb5ac98, 0xc0b7a2]), x + 1, y + .5, z, 0, 0, 0, 2.05, 1.1, .7); }
    let lo = 1e9, hi = -1e9; for (let x = x0; x <= x1; x += 4) { const y = H(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    addSolid(x0, lo - .5, z - .35, x1, hi + 1.05, z + .35, 'wall');
    for (let x = x0 + 1; x < x1; x += 2.5) { addCover(x, z + 1.1, 'wallN'); addCover(x, z - 1.1, 'wallS'); }
  };
  wall(-92, -40, -250); wall(-22, 40, -250); wall(52, 92, -250);
  wall(-92, -38, -332); wall(-20, 32, -332); wall(48, 92, -332);
  sandbagLine(S, -35.5, -258, -26.5, -258, 3);
  addSolid(-35.5, H(-31, -258) - .5, -258.3, -26.5, H(-31, -258) + .8, -257.7, 'sandbag');
  for (const [fx, fz] of [[-5, -194], [48, -196]]) for (let a = 0; a < TAU; a += TAU / 16) {
    if (Math.abs(a - PI / 2) < .5) continue;
    sandbagLine(S, fx + Math.cos(a) * 5, fz + Math.sin(a) * 5, fx + Math.cos(a + TAU / 16) * 5, fz + Math.sin(a + TAU / 16) * 5, 2);
  }
  const grp = groupMesh(S.buildGroups()); scene.add(grp);
}

function buildWire() {
  if (wireLines) { scene.remove(wireLines); wireLines.geometry.dispose(); }
  const pts = [];
  const coil = (x0, x1, z, yOff, main) => {
    let prev = null;
    for (let x = x0; x <= x1; x += .2) {
      if (main && inWireGap(x, .6)) { prev = null; continue; }
      const a = x * 3.1, p = new V3(x, H(x, z) + yOff + .45 + Math.sin(a) * .45, z + Math.cos(a) * .45);
      if (prev) pts.push(prev, p); prev = p;
      if (R() < .25) { const b = p.clone().add(new V3(rnd(-.05, .05), rnd(-.05, .05), rnd(-.05, .05))); pts.push(p, b); }
    }
  };
  for (let x = -MAPX + 40; x < -200; x += 8) coil(x, x + 8, WIRE_Z, 0);
  for (let x = 200; x < MAPX - 40; x += 8) coil(x, x + 8, WIRE_Z, 0);
  for (let x = -200; x < 200; x += 8) {
    const x1 = x + 8;
    coil(x, x1, WIRE_Z, 0, true);
  }
  for (let i = 0; i < 25; i++) { const x = srnd(-170, 170), z = srnd(-82, -66); if (Math.abs(x - BREACH_X) > 8) coil(x, x + srnd(3, 7), z, -.1); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  wireLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col(0x2a2622) }));
  scene.add(wireLines);
}

function buildGrass() {
  if (!Q.grass) return;
  const tex = canvasTex(128, (g, s) => {
    for (let i = 0; i < 60; i++) {
      const x = rnd(4, s - 4), h = rnd(s * .35, s * .97), lean = rnd(-14, 14);
      g.strokeStyle = `rgba(${140 + R() * 70 | 0},${150 + R() * 60 | 0},${80 + R() * 50 | 0},1)`; g.lineWidth = rnd(1.5, 3.5);
      g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x + lean * .3, s - h * .5, x + lean, s - h); g.stroke();
    }
  });
  const p1 = new THREE.PlaneGeometry(1, 1, 1, 2); p1.translate(0, .5, 0);
  const pos = [], uv = [], nor = [], idx = []; let o = 0;
  for (const ang of [0, PI / 3, -PI / 3]) {
    const g = p1.clone(); g.rotateY(ang);
    const pa = g.attributes.position, ua = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); uv.push(ua.getX(i), ua.getY(i)); nor.push(0, 1, 0); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + o);
    o += pa.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: 1, color: col(0x8d9560) });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.sh = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 ip=instanceMatrix*vec4(0.,0.,0.,1.); float sw=sin(uTime*1.7+ip.x*.3+ip.z*.2)*.12+sin(uTime*3.1+ip.x)*.04; transformed.x+=sw*position.y; transformed.z+=sw*.6*position.y;');
  };
  const im = new THREE.InstancedMesh(geo, mat, Q.grass);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < Q.grass && tries < Q.grass * 4; tries++) {
    const x = srnd(-180, 180), z = srnd(-235, -62);
    if (roadDist(x, z) < 3 || (z < -84 && z > -97 && Math.abs(z - trenchZ(x)) < 2.5) || (z < -245 && x > -95 && x < 95)) continue;
    const y = H(x, z); p.set(x, y - .05, z); q.setFromAxisAngle(new V3(0, 1, 0), SR() * PI);
    const h = srnd(.45, 1.1); s.set(srnd(.7, 1.3), h, srnd(.7, 1.3));
    m.compose(p, q, s); im.setMatrixAt(n, m);
    c.setHSL(.17 + SR() * .06, .35, .45 + SR() * .2); im.setColorAt(n, c); n++;
  }
  im.count = n; im.receiveShadow = true; scene.add(im);
  WORLD.grassMat = mat;
}

// ---------- flotta (modelli dettagliati in models.js) ----------
function buildFleet() {
  const tx = placeShip('bb', -230, 780, { skipTurret: 1, rails: true });
  placeShip('bb', 190, 840);
  placeShip('cl', 470, 720); placeShip('cl', -470, 700);
  placeShip('dd', -110, 430); placeShip('dd', 70, 390); placeShip('dd', 280, 460);
  placeShip('bb', -1100, 820); placeShip('cl', 1050, 760); placeShip('dd', -800, 440); placeShip('dd', 750, 420); placeShip('dd', 1300, 480);
  for (let i = 0; i < 8; i++) placeShip('lst', srnd(-900, 900), srnd(1250, 1700));
  const mb = new MB(); mb.mat = 'paint';
  for (let i = 0; i < 22; i++) { const x = srnd(-700, 700), z = srnd(520, 1100); mb.add(U.box, 0x55625a, x, .5, z, 0, srnd(-.2, .2), 0, 4, 2, 11); }
  mb.mat = 'vc';
  for (let i = 0; i < 6; i++) {
    const x = srnd(-900, 900), z = srnd(1250, 1700), y = srnd(90, 130);
    mb.add(U.sph, 0x8d949a, x, y, z, 0, 0, 0, 7, 3.2, 3.2); mb.add(U.box, 0x8d949a, x + 6, y + 1.5, z, 0, 0, 0, 2.5, 2.5, .2);
    mb.add(U.cyl, 0x333333, x, y / 2, z, 0, 0, 0, .1, y, .1);
  }
  scene.add(groupMesh(mb.buildGroups(), false));
  // torretta B della USS Texas manovrabile dal giocatore
  const sg = tx.g, tp = tx.o.turretPos, s = tx.o.turretS;
  const pt = buildPlayerTurret(s), wp = tp.clone().applyMatrix4(sg.matrixWorld);
  pt.g.position.copy(wp); scene.add(pt.g);
  const cam = new V3(0, tp.y + 8.5, tp.z - 15).applyMatrix4(sg.matrixWorld);
  WORLD.texas = { g: pt.g, pitch: pt.pitch, yaw: 0, elev: .1, muzzles: pt.muzzles, cam };
}

// ---------- costruzione ----------
function buildWorld(step) {
  genCraters();
  WORLD.villageY = H0(10, -283);
  buildHF(); buildHC();
  buildTerrain();
  buildWater();
  buildBoatGeos(); buildBunkerGeo();
  buildStatic();
  buildWire();
  buildGrass();
  buildFleet();
  for (const x of [-100, 15, 100]) makeBunker(x);
  for (const x of [-1200, -650, 470, 980, -170, -58, 57, 168]) makeBunker(x, true);
  makeFlak(-5, -194); makeFlak(48, -196);
}

function updateWorld(dt, t) {
  waterMat.uniforms.uTime.value = t; waterMat.uniforms.uFogD.value = scene.fog.density;
  if (WORLD.grassMat && WORLD.grassMat.userData.sh) WORLD.grassMat.userData.sh.uniforms.uTime.value = t;
  for (const b of WORLD.boats) b.update(dt, t);
  // bombardamento navale
  for (const g of WORLD.shipGuns) {
    g.t -= dt; if (g.t > 0) continue;
    g.t = g.big ? rnd(7, 12) : rnd(4, 8);
    if (WORLD.bombard === 'off') continue;
    PS_FIRE.emit(g.p.x, g.p.y, g.p.z, 0, 2, -14, .3, g.big ? 16 : 9, g.big ? 26 : 14, 1, 4, 2.6, 1.2);
    for (let i = 0; i < 3; i++) PS_SMOKE.emit(g.p.x, g.p.y, g.p.z - 4, rnd(-2, 2), rnd(1, 3), rnd(-12, -6), rnd(5, 8), g.big ? 10 : 6, g.big ? 32 : 18, .55, .55, .55, .55, .4, -.1);
    sfxShip(g.p);
    const tp = bombardTarget(); if (!tp) continue;
    WORLD.shells.push({ t: g.p.distanceTo(tp) / 650 + 1.2, p: tp, size: g.big ? 2.4 : 1.5 });
  }
  for (let i = WORLD.shells.length - 1; i >= 0; i--) {
    const s = WORLD.shells[i]; s.t -= dt;
    if (s.t < .9 && !s.w) { s.w = true; if (s.p.distanceTo(P.pos) < 120) sfxWhistle(s.p, false); }
    if (s.t > 0) continue;
    WORLD.shells.splice(i, 1);
    if (s.p.distanceTo(P.pos) < 30 && P.mode === 'foot') continue;
    explode(s.p, s.size * 4.5, 260, { ship: true });
  }
}
function bombardTarget() {
  if (WORLD.bombard === 'bluff') {
    const al = enemies.filter(e => e.alive && !e.inBunker && e.group === 'beach');
    let p = al.length && R() < .3 ? pick(al).pos.clone().add(new V3(rnd(-10, 10), 0, rnd(-6, 6))) : new V3(rnd(-MAPX + 100, MAPX - 100), 0, rnd(-140, -92));
    p.y = Hf(p.x, p.z); return p;
  }
  if (WORLD.bombard === 'inland') { const p = new V3(rnd(-250, 250), 0, rnd(-470, -350)); p.y = Hf(p.x, p.z); return p; }
  return null;
}
