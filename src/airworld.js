"use strict";
// ============================================================
//  Mondo aereo esteso: terreno a tasselli da 1 km generato attorno
//  al giocatore fino all'orizzonte (24 x 24 km), con lo stesso
//  materiale del terreno centrale, livelli di dettaglio, boschi,
//  case sparse e villaggi.
// ============================================================
const AW = { on: false, size: 1000, half: 12000, R: 6200, chunks: new Map(), mat: null, crownG: null, trunkG: null, wallG: null, roofG: null, last: null };
// area coperta dal terreno dettagliato del centro: lì i tasselli si abbassano e restano nascosti sotto
const awInCenter = (x, z) => x > -MAPX - 120 && x < MAPX + 120 && z > -MAPX && z < 420;

function initAirWorld() {
  AW.on = true; AW.chunks.clear();
  AW.mat = terrainMaterial();
  // chioma leggera: tre icosaedri semplici (60 triangoli) con colori diversi; gli alberi sono decine di migliaia
  const parts = [];
  for (let i = 0; i < 3; i++) { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(rnd(.36, .46), rnd(.3, .4), rnd(.36, .46)); g.rotateY(R() * 3); g.translate(rnd(-.2, .2), rnd(-.08, .18), rnd(-.2, .2)); const c = new THREE.Color(pick([0x3f5228, 0x4a5e2c, 0x37481f, 0x55662f])).convertSRGBToLinear(), n = g.attributes.position.count, cl = new Float32Array(n * 3); for (let k = 0; k < n; k++) { cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); parts.push(g.toNonIndexed ? g : g); }
  AW.crownG = awMergeGeos(parts);
  AW.trunkG = new THREE.CylinderGeometry(.14, .24, 1, 5); AW.trunkG.translate(0, .5, 0);
  const wall = new THREE.BoxGeometry(1, 1, 1); wall.translate(0, .5, 0);
  // tetto a due falde sopra i muri (alto 0,45 della larghezza della casa una volta scalata)
  const rg = new THREE.BufferGeometry(), v = [-.55, 1, -.55, .55, 1, -.55, 0, 1.55, -.55, -.55, 1, .55, .55, 1, .55, 0, 1.55, .55];
  rg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); rg.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]);
  const tint = (g, hex) => { const c = new THREE.Color(hex).convertSRGBToLinear(), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  AW.houseG = awMergeGeos([tint(wall, 0xd2c8b2), tint(rg, 0x7a3b2a)]);
  AW.houseM = new THREE.MeshLambertMaterial({ vertexColors: true });
  awHorizon();
}
// orizzonte: una sola griglia rada e fissa su 32 x 32 km, qualche metro sotto il terreno vero (i tasselli vicini la coprono)
function awHorizon() {
  const L = 16000, st = 250, n = L * 2 / st + 1, N = n * n;
  const pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), uv = new Float32Array(N * 2), sp = new Float32Array(N * 4), ax = new Float32Array(N * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = -L + i * st, z = -L + j * st; let y = H(x, z) - 8; if (y < WATER_Y - .2) y = Math.min(y, WATER_Y - 60);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
    const s = airSplat(x, z, fbm(x * .03, z * .03, 3)); sp.set(s.sp, k * 4); cl.set(s.cl, k * 3);
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6); let o = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx[o++] = a; idx[o++] = b; idx[o++] = a + 1; idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); g.setAttribute('aux', new THREE.BufferAttribute(ax, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, AW.mat); m.frustumCulled = false; scene.add(m); AW.horizon = m;
}
// passo della griglia per distanza: vicino fitto, lontano rado
function awLod(d) { return d < 2300 ? 0 : 1; }
const AW_STEP = [20, 40, 100];

let AWH = null;  // altezze del tassello in costruzione
function awHeights(cx, cz, lod) {
  const S = AW.size, st = AW_STEP[lod], n = S / st + 1, m = n + 2, x0 = cx * S - st, z0 = cz * S - st, d = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) d[j * m + i] = H(x0 + i * st, z0 + j * st);
  AWH = { d, m, st, x0, z0 };
}
// altezza interpolata dalla griglia del tassello (fuori griglia: funzione vera)
function awH(x, z) {
  const A = AWH, fx = (x - A.x0) / A.st, fz = (z - A.z0) / A.st;
  if (fx < 0 || fz < 0 || fx >= A.m - 1 || fz >= A.m - 1) return H(x, z);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * A.m + i, d = A.d, m = A.m;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + m] * (1 - u) + d[k + m + 1] * u) * v;
}
function awTerrain(cx, cz, lod) {
  const S = AW.size, st = AW_STEP[lod], n = S / st + 1, x0 = cx * S, z0 = cz * S;
  // griglia più un bordo «gonnella» abbassato che chiude le fessure tra tasselli di dettaglio diverso
  const N = n * n + 4 * n, pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), uv = new Float32Array(N * 2), sp = new Float32Array(N * 4), ax = new Float32Array(N * 2);
  const nrm = new Float32Array(N * 3), _n = new V3();
  const put = (k, x, z, y) => {
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
    _n.set(awH(x - st, z) - awH(x + st, z), 2 * st, awH(x, z - st) - awH(x, z + st)).normalize(); nrm.set([_n.x, _n.y, _n.z], k * 3);
    const s = airSplat(x, z, fbm(x * .03, z * .03, 3)); sp.set(s.sp, k * 4); cl.set(s.cl, k * 3);
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + i * st, z = z0 + j * st; let y = AWH.d[(j + 1) * AWH.m + i + 1] - (awInCenter(x, z) ? 1.5 : 0);
    // fondale molto più basso dell'acqua: da lontano la precisione di profondità non basta a separarli e il fondo trasparirebbe
    if (y < WATER_Y - .2) y = Math.min(y, WATER_Y - (awInCenter(x, z) ? 48 : 45));
    put(j * n + i, x, z, y); }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // gonnelle sui quattro lati
  const edges = [[i => i, () => 0], [i => i, () => n - 1], [() => 0, j => j], [() => n - 1, j => j]];
  let k = n * n;
  edges.forEach(([fi, fj], e) => {
    const base = k;
    for (let t = 0; t < n; t++) { const i = fi(t), j = fj(t), s = j * n + i; put(k, pos[s * 3], pos[s * 3 + 2], pos[s * 3 + 1] - 25); k++; }
    for (let t = 0; t < n - 1; t++) { const i = fi(t), j = fj(t), a = j * n + i, i2 = fi(t + 1), j2 = fj(t + 1), b = j2 * n + i2; idx.push(a, base + t, b, b, base + t, base + t + 1, a, b, base + t, b, base + t + 1, base + t); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); g.setAttribute('aux', new THREE.BufferAttribute(ax, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, AW.mat); m.receiveShadow = lod === 0; return m;
}
// terreno adatto a un albero o a una casa: asciutto, non ripido, fuori dal centro e lontano dai fiumi
function awLandOK(x, z, slopeMax) {
  if (awInCenter(x, z)) return false;
  const h = awH(x, z); if (h < WATER_Y + 1.5) return false;
  if (AIRMAP === 'reno' && Math.abs(z - renoRiverZ(x)) < 100) return false;
  if (AIRMAP === 'norm' && Math.abs(x - airRiverX(z)) < 40) return false;
  return Math.abs(awH(x + 10, z) - awH(x - 10, z)) + Math.abs(awH(x, z + 10) - awH(x, z - 10)) < slopeMax * 20;
}
function awProps(cx, cz, lod) {
  const S = AW.size, x0 = cx * S, z0 = cz * S, grp = new THREE.Group();
  // copia della geometria con la sfera che contiene tutto il tassello: così il culling delle istanze funziona (three r128)
  const sph = new THREE.Sphere(new V3(x0 + S / 2, awH(x0 + S / 2, z0 + S / 2), z0 + S / 2), S * .75 + 60);
  const geo = g0 => { const g = g0.clone(); g.boundingSphere = sph.clone(); return g; };
  const seed = hash2(cx * 7 + 3, cz * 13 + 5); let rs = seed * 1e6 | 0; const rr = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // boschi: macchie dove il rumore a grande scala è alto, più alberi sparsi lungo i campi
  const trees = [];
  const want = lod === 0 ? 550 : 0;  // oltre 3,5 km gli alberi diventano puntini scuri: i boschi restano nei colori del terreno
  for (let t = 0; t < want * 3 && trees.length < want; t++) {
    const x = x0 + rr() * S, z = z0 + rr() * S, f = fbm(x * .0011 + 40, z * .0011, 3);
    if (f < .53 && rr() > .04) continue;
    if (!awLandOK(x, z, .35)) continue;
    trees.push([x, awH(x, z), z, (.8 + rr() * .5) * (f > .6 ? 1.2 : 1)]);
  }
  if (trees.length) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), p = new V3();
    const crown = new THREE.InstancedMesh(geo(AW.crownG), MAT.vc, trees.length), trunk = lod === 0 ? new THREE.InstancedMesh(geo(AW.trunkG), MAT.wood, trees.length) : null;
    trees.forEach(([x, y, z, s], i) => {
      const h = (7 + rr() * 4) * s; q.setFromAxisAngle(_fu, rr() * TAU);
      m4.compose(p.set(x, y + h * .55, z), q, sc.set(h * .75, h * .7, h * .75)); crown.setMatrixAt(i, m4);
      if (trunk) { m4.compose(p.set(x, y - .3, z), q, sc.set(s, h * .6, s)); trunk.setMatrixAt(i, m4); }
    });
    for (const m of [crown, trunk]) if (m) grp.add(m);
  }
  // fattorie sparse e, in alcuni tasselli, un villaggio con la chiesa
  const houses = [];
  const nFarm = 2 + Math.floor(rr() * 5);
  for (let i = 0; i < nFarm; i++) {
    const x = x0 + 60 + rr() * (S - 120), z = z0 + 60 + rr() * (S - 120); if (!awLandOK(x, z, .15)) continue;
    const ry = rr() * PI; for (let b = 0; b < 2 + rr() * 2; b++) houses.push([x + Math.cos(ry) * b * 14, z + Math.sin(ry) * b * 14, 8 + rr() * 6, 7 + rr() * 4, 4 + rr() * 2, ry + (b % 2) * PI / 2]);
  }
  if (rr() < .28) {
    const vx = x0 + 250 + rr() * (S - 500), vz = z0 + 250 + rr() * (S - 500);
    if (awLandOK(vx, vz, .12)) {
      const ry = rr() * PI, nH = 14 + Math.floor(rr() * 18);
      for (let i = 0; i < nH; i++) { const a = rr() * TAU, d = 15 + Math.sqrt(rr()) * 110, x = vx + Math.cos(a) * d, z = vz + Math.sin(a) * d; if (awLandOK(x, z, .2)) houses.push([x, z, 7 + rr() * 5, 8 + rr() * 6, 5 + rr() * 3, ry + (rr() < .5 ? 0 : PI / 2)]); }
      houses.push([vx, vz, 9, 22, 9, ry, 'church']);
    }
  }
  if (houses.length) {
    // campanile della chiesa come una casa stretta e altissima
    for (const hs of houses.filter(h => h[6])) houses.push([hs[0] - Math.sin(hs[5]) * (hs[3] * .5 + 3), hs[1] - Math.cos(hs[5]) * (hs[3] * .5 + 3), 4.5, 4.5, 20, hs[5]]);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), p = new V3(), col = new THREE.Color();
    const hm = new THREE.InstancedMesh(geo(AW.houseG), AW.houseM, houses.length);
    houses.forEach(([x, z, w, l, h, ry], i) => {
      q.setFromAxisAngle(_fu, ry); m4.compose(p.set(x, awH(x, z) - .5, z), q, sc.set(w, h, l)); hm.setMatrixAt(i, m4);
      const t = .82 + rr() * .2; hm.setColorAt(i, col.setRGB(t, t * (.94 + rr() * .06), t * (.86 + rr() * .1)));
    });
    hm.instanceColor.needsUpdate = true; grp.add(hm);
  }
  return grp;
}
function awBuild(cx, cz, lod) {
  awHeights(cx, cz, lod);
  const g = new THREE.Group(); g.add(awTerrain(cx, cz, lod));
  if (lod < 2) g.add(awProps(cx, cz, lod));
  scene.add(g); return g;
}
function awDispose(c) { scene.remove(c.g); c.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose && o.dispose(); }); }
// ogni fotogramma: costruisce (al massimo pochi tasselli per volta) quelli mancanti o col dettaglio sbagliato, toglie i lontani
function updateAirChunks(dt, all) {
  if (!AW.on) return;
  const cp = camera.position, S = AW.size, r = Math.ceil(AW.R / S), ci0 = Math.floor(cp.x / S), cj0 = Math.floor(cp.z / S), lim = AW.half / S;
  const todo = [];
  for (let j = cj0 - r; j <= cj0 + r; j++) for (let i = ci0 - r; i <= ci0 + r; i++) {
    if (i < -lim || j < -lim || i >= lim || j >= lim) continue;
    const mx = i * S + S / 2, mz = j * S + S / 2, d = Math.hypot(mx - cp.x, mz - cp.z);
    if (d > AW.R + S * .7) continue;
    // tasselli interamente dentro il centro dettagliato: inutili
    if (awInCenter(i * S, j * S) && awInCenter(i * S + S, j * S) && awInCenter(i * S, j * S + S) && awInCenter(i * S + S, j * S + S)) continue;
    const key = i + ',' + j, lod = awLod(d), c = AW.chunks.get(key);
    if (c) { c.seen = true; if (c.lod !== lod) todo.push([d, i, j, lod, key]); } else todo.push([d, i, j, lod, key]);
  }
  todo.sort((a, b) => a[0] - b[0]);
  let budget = all ? 1e9 : 1;
  for (const [, i, j, lod, key] of todo) {
    if (budget-- <= 0) break;
    const old = AW.chunks.get(key); if (old) awDispose(old);
    AW.chunks.set(key, { g: awBuild(i, j, lod), lod, seen: true });
  }
  for (const [key, c] of AW.chunks) { if (!c.seen) { awDispose(c); AW.chunks.delete(key); } else c.seen = false; }
}

function awMergeGeos(list) {
  let n = 0; const ps = list.map(g => g.index ? g.toNonIndexed() : g); for (const g of ps) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of ps) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

// durante il caricamento: tutti i tasselli attorno alla base, così in partita niente scatti iniziali
function awPreload() { camera.position.set(CARRIER.x, 300, CARRIER.z); updateAirChunks(0, true); AW.first = true; }
