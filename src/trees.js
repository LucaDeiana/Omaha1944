"use strict";
// ============================================================
//  Alberi in istanze: boschi, frutteti e filari in tutta la campagna.
//  Un'esplosione vicina li abbatte: cadono lontano dal colpo.
// ============================================================
const TREES = { list: [], trunk: null, crown: null, falling: [] };
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tp = new V3(), _ts = new V3();

function treeSpot(x, z) {
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
  const N = TREES.list.length;
  const trunkG = new THREE.CylinderGeometry(.14, .24, 1, 7); trunkG.translate(0, .5, 0);
  const mb = new MB(); mb.mat = 'vc';
  for (let i = 0; i < 6; i++) mb.add(U.ico1, pick([0x3f5228, 0x4a5e2c, 0x37481f, 0x55662f, 0x44562a]), rnd(-.25, .25), rnd(-.15, .2), rnd(-.25, .25), R(), R(), R(), rnd(.3, .45), rnd(.25, .38), rnd(.3, .45));
  const crownG = mb.build();
  TREES.trunk = new THREE.InstancedMesh(trunkG, MAT.wood, N); TREES.crown = new THREE.InstancedMesh(crownG, MAT.vc, N);
  for (const m of [TREES.trunk, TREES.crown]) { m.castShadow = Q.shadows > 0; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
  TREES.list.forEach((t, i) => { treeMatrix(t, i); if (i % 3 === 0) addCover(t.x, t.z + .9, 'tree'); OBST.push({ x: t.x, z: t.z, r: .35 * t.s, tree: t }); });
  TREES.trunk.instanceMatrix.needsUpdate = TREES.crown.instanceMatrix.needsUpdate = true;
}
function treeMatrix(t, i) {
  _te.set(t.ax * t.fall, t.ry, t.az * t.fall, 'XZY'); _tq.setFromEuler(_te);
  _tm.compose(_tp.set(t.x, t.y - .2, t.z), _tq, _ts.set(t.s * 1.1, t.h, t.s * 1.1)); TREES.trunk.setMatrixAt(i, _tm);
  const cs = t.h * (t.kind ? .55 : .75);
  _tm.compose(_tp.set(0, t.h, 0).applyQuaternion(_tq).add(new V3(t.x, t.y - .2, t.z)), _tq, _ts.set(cs * 1.1, cs * (t.fall > .9 ? .8 : 1), cs * 1.1)); TREES.crown.setMatrixAt(i, _tm);
}
// un'esplosione abbatte gli alberi vicini
function treeBlast(p, radius) {
  if (!TREES.trunk || radius < 3.5) return;
  const r = radius * .9;
  TREES.list.forEach((t, i) => {
    if (t.felled || Math.abs(t.x - p.x) > r || Math.abs(t.z - p.z) > r) return;
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz); if (d > r) return;
    t.felled = true; t.i = i; const dd = Math.max(d, .3); t.ax = 1.45 * dz / dd; t.az = -1.45 * dx / dd;
    TREES.falling.push(t);
    if (dist2Cam(new V3(t.x, t.y, t.z)) < 120 * 120) { play('bodyfall', new V3(t.x, t.y + 2, t.z), { ref: 20, vol: .9, rate: .45 }); fxDebris(new V3(t.x, t.y + 1, t.z), 8, 1.5); }
    const o = OBST.find(q => q.tree === t); if (o) o.r = 0;
  });
}
function updateTrees(dt) {
  if (!TREES.falling.length) return;
  for (let k = TREES.falling.length - 1; k >= 0; k--) {
    const t = TREES.falling[k]; t.v = (t.v || 0) + dt * 1.6; t.fall = Math.min(1, t.fall + t.v * dt);
    treeMatrix(t, t.i);
    if (t.fall >= 1) { TREES.falling.splice(k, 1); const p = new V3(0, t.h * .6, 0).applyQuaternion(_tq).add(new V3(t.x, t.y, t.z)); p.y = Hf(p.x, p.z); fxImpact(p, 'dirt'); if (dist2Cam(p) < 80 * 80) play('bodyfall', p, { ref: 15, vol: .7, rate: .6 }); }
  }
  TREES.trunk.instanceMatrix.needsUpdate = TREES.crown.instanceMatrix.needsUpdate = true;
}
