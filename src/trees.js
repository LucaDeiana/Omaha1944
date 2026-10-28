"use strict";
// ============================================================
//  Alberi in istanze: boschi, frutteti e filari in tutta la campagna.
//  Un'esplosione vicina li abbatte: cadono lontano dal colpo.
// ============================================================
const TREES = { list: [], trunk: null, crown: null, falling: [] };
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new V3(), _ts = new V3();

function treeSpot(x, z) {
  if (SCEN === 'ard') return ardTreeSpot(x, z);
  if (SCEN === 'air') return airTreeSpot(x, z);
  if (z > -100 || Math.abs(x) > MAPX - 30 || z < -MAPX + 40) return false;
  if (cityIn(x, z) || roadDist(x, z) < 6 || inBunkerZone(x, z, 3)) return false;
  if (z < -235 && z > -345 && x > -125 && x < 120) return false; // Colleville
  for (const h of HEDGES) if (Math.abs(z - h.z) < 4) return false;
  if (Math.abs(x - roadPathX(z)) < 8) return false;
  return true;
}
function buildTrees() {
  const n = Math.round(1400 + Q.particles * 1400);
  const add = (x, z, s) => { if (treeSpot(x, z)) TREES.list.push({ x, z, y: Hf(x, z), s, h: rnd(6, 10) * s, ry: R() * TAU, fall: 0, ax: 0, az: 0, felled: false, kind: R() < .25 ? 1 : 0 }); };
  if (SCEN === 'air') airTreeList((x, z, s) => { if (treeSpot(x, z)) TREES.list.push({ x, z, y: Hf(x, z), s, h: rnd(7, 11) * s, ry: R() * TAU, fall: 0, ax: 0, az: 0, felled: false, kind: R() < .25 ? 1 : 0 }); });
  else if (SCEN === 'ard') { ardTreeList((x, z, s) => { if (treeSpot(x, z)) TREES.list.push({ x, z, y: Hf(x, z), s, h: rnd(12, 19) * s, ry: R() * TAU, fall: 0, ax: 0, az: 0, felled: false, kind: 0 }); }); }
  else {
  // boschi a macchie
  for (let k = 0; k < 40 && TREES.list.length < n * .6; k++) {
    const cx = rnd(-MAPX + 100, MAPX - 100), cz = rnd(-1350, -140), r = rnd(25, 70);
    for (let i = 0; i < r * 1.4; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r; add(cx + Math.cos(a) * d, cz + Math.sin(a) * d, rnd(.8, 1.3)); }
  }
  // frutteti a griglia
  for (let k = 0; k < 18; k++) {
    const cx = rnd(-MAPX + 120, MAPX - 120), cz = rnd(-1300, -250), ry = rnd(-.2, .2);
    for (let i = -4; i <= 4; i++) for (let j = -3; j <= 3; j++) add(cx + i * 7 * Math.cos(ry) - j * 7 * Math.sin(ry), cz + i * 7 * Math.sin(ry) + j * 7 * Math.cos(ry), rnd(.55, .75));
  }
  // alberi sparsi lungo siepi e campi
  while (TREES.list.length < n) add(rnd(-MAPX + 40, MAPX - 40), rnd(-1400, -120), rnd(.7, 1.2));
  }
  const N = TREES.list.length;
  const trunkG = new THREE.CylinderGeometry(.14, .24, 1, 7); trunkG.translate(0, .5, 0);
  const mb = new MB(); mb.mat = 'vc';
  // chioma di latifoglia: ciuffi irregolari distribuiti su una forma schiacciata, più scuri sotto e all'interno
  const nb = Q.tex >= 1024 ? 18 : Q.tex >= 512 ? 12 : 6, rr = seeded(31);
  for (let i = 0; i < nb; i++) {
    const a = rr() * TAU, d = Math.sqrt(rr()) * .34, y = (rr() - .35) * .38, out = d / .34;
    const c = new THREE.Color(pick([0x3f5228, 0x4a5e2c, 0x37481f, 0x55662f, 0x44562a, 0x5a6a34])).multiplyScalar(.75 + .35 * out + (y > 0 ? .1 : -.1));
    const s = .16 + rr() * .14;
    mb.add(U.ico1, c.getHex(), Math.cos(a) * d, y, Math.sin(a) * d, rr() * 3, rr() * 3, rr() * 3, s * (1 + rr() * .3), s * (.75 + rr() * .3), s * (1 + rr() * .3));
  }
  // rami che escono dal tronco verso i ciuffi
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + rr() * .6; mb.add(U.cyl, 0x4a3a2a, Math.cos(a) * .12, -.32, Math.sin(a) * .12, Math.sin(a) * .7, 0, -Math.cos(a) * .7, .018, .32, .018); }
  const crownG = SCEN === 'ard' ? ardTreeCrown() : mb.build();
  const cells = new Map(), CS = 160;
  for (const t of TREES.list) { const k = Math.floor(t.x / CS) + ',' + Math.floor(t.z / CS); let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(t); }
  TREES.cells = [];
  for (const list of cells.values()) {
    const bb = new THREE.Box3(); for (const t of list) bb.expandByPoint(new V3(t.x, t.y, t.z)); bb.max.y += 16; bb.expandByScalar(9);
    const sph = bb.getBoundingSphere(new THREE.Sphere());
    const tgc = trunkG.clone(), cgc = crownG.clone(); tgc.boundingSphere = sph; cgc.boundingSphere = sph.clone();
    const c = { trunk: new THREE.InstancedMesh(tgc, MAT.wood, list.length), crown: new THREE.InstancedMesh(cgc, MAT.vc, list.length), dirty: false };
    for (const m of [c.trunk, c.crown]) { m.castShadow = Q.shadows > 0; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    list.forEach((t, i) => { t.cell = c; t.i = i; treeMatrix(t); const v = .78 + R() * .4; c.crown.setColorAt(i, _tc.setRGB(v * (.92 + R() * .12), v, v * (.9 + R() * .14))); });
    if (c.crown.instanceColor) c.crown.instanceColor.needsUpdate = true;
    for (const m of [c.trunk, c.crown]) FOGCULL.push({ obj: m, s: sph });
    TREES.cells.push(c);
  }
  TREES.trunk = true;
  TREES.list.forEach((t, i) => { if (i % 3 === 0) addCover(t.x, t.z + .9, 'tree'); OBST.push({ x: t.x, z: t.z, r: .35 * t.s, tree: t }); });
}
const _tc = new THREE.Color();
function treeMatrix(t) {
  const i = t.i, c = t.cell; c.dirty = true;
  _te.set(t.ax * t.fall, t.ry, t.az * t.fall, 'XZY'); _tq.setFromEuler(_te);
  _tm.compose(_tp.set(t.x, t.y - .2, t.z), _tq, _ts.set(t.s * 1.1, t.h, t.s * 1.1)); c.trunk.setMatrixAt(i, _tm);
  const cs = t.h * (t.kind ? .55 : .75);
  _tm.compose(_tp.set(0, t.h, 0).applyQuaternion(_tq).add(new V3(t.x, t.y - .2, t.z)), _tq, _ts.set(cs * 1.1, cs * (t.fall > .9 ? .8 : 1), cs * 1.1)); c.crown.setMatrixAt(i, _tm);
}
// un'esplosione abbatte gli alberi vicini
function treeBlast(p, radius) {
  if (!TREES.trunk || radius < 3.5) return;
  const r = radius * .9;
  TREES.list.forEach((t, i) => {
    if (t.felled || Math.abs(t.x - p.x) > r || Math.abs(t.z - p.z) > r) return;
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d > r) return;
    t.felled = true; const dd = Math.max(d, .3); t.ax = 1.45 * dz / dd; t.az = -1.45 * dx / dd;
    TREES.falling.push(t);
    if (dist2Cam(new V3(t.x, t.y, t.z)) < 120 * 120) { play('bodyfall', new V3(t.x, t.y + 2, t.z), { ref: 20, vol: .9, rate: .45 }); fxDebris(new V3(t.x, t.y + 1, t.z), 8, 1.5); }
    const o = OBST.find(q => q.tree === t); if (o) o.r = 0;
  });
}
function updateTrees(dt) {
  if (!TREES.falling.length) return;
  for (let k = TREES.falling.length - 1; k >= 0; k--) {
    const t = TREES.falling[k]; t.v = (t.v || 0) + dt * 1.6; t.fall = Math.min(1, t.fall + t.v * dt);
    treeMatrix(t);
    if (t.fall >= 1) { TREES.falling.splice(k, 1); const p = new V3(0, t.h * .6, 0).applyQuaternion(_tq).add(new V3(t.x, t.y, t.z)); p.y = Hf(p.x, p.z); fxImpact(p, 'dirt'); if (dist2Cam(p) < 80 * 80) play('bodyfall', p, { ref: 15, vol: .7, rate: .6 }); }
  }
  for (const c of TREES.cells) if (c.dirty) { c.dirty = false; c.trunk.instanceMatrix.needsUpdate = c.crown.instanceMatrix.needsUpdate = true; }
}
