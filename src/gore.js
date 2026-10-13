"use strict";
// ============================================================
//  Gore e ragdoll: sangue, pozze, smembramenti, corpi fisici (Verlet)
// ============================================================
const RAGS = [], GIBS = [];
const _g1 = new V3(), _g2 = new V3(), _g3 = new V3(), _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion();
const C_BLOOD = [.24, .008, .008];

function bloodHit(p, dir, k = 1) {
  if (dist2Cam(p) > 150 * 150) return;
  const g = SETTINGS.gore ? 1 : .3;
  k *= 1.8;
  for (let i = 0; i < 3 * k * g; i++) PS_SMOKE.emit(p.x, p.y, p.z, dir.x * rnd(.5, 2) + rnd(-.4, .4), dir.y * rnd(.5, 2) + rnd(-.2, .6), dir.z * rnd(.5, 2) + rnd(-.4, .4), rnd(.25, .6), .08, rnd(.35, .7) * k, .75, ...C_BLOOD, 3, 1.5);
  for (let i = 0; i < 16 * k * g; i++) PS_GRAIN.emit(p.x, p.y, p.z, dir.x * rnd(1, 5) + rnd(-1, 1), dir.y * rnd(1, 4) + rnd(-.5, 2), dir.z * rnd(1, 5) + rnd(-1, 1), rnd(.5, 1), rnd(.02, .05), .03, 1, .2, .005, .005, .2, 9.8, 1);
  if (SETTINGS.gore) for (let i = 0; i < 2; i++) { const q = p.clone().addScaledVector(dir, rnd(.5, 3)); q.x += rnd(-.4, .4); q.z += rnd(-.4, .4); addDecal('blood', q, rnd(.5, 1.3)); }
  sfxImpact(p, 'flesh');
}
function bloodBurst(p, k = 1) {
  if (!SETTINGS.gore) return;
  k *= 1.6;
  for (let i = 0; i < 8 * k; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-2, 2), rnd(0, 3), rnd(-2, 2), rnd(.4, .9), .15, rnd(.6, 1.4) * k, .8, ...C_BLOOD, 2.5, 2);
  for (let i = 0; i < 40 * k; i++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-6, 6), rnd(0, 7), rnd(-6, 6), rnd(.6, 1.2), rnd(.02, .06), .03, 1, .2, .005, .005, .15, 9.8, 1);
  for (let i = 0; i < 6; i++) addDecal('blood', p.clone().add(new V3(rnd(-2.5, 2.5), 0, rnd(-2.5, 2.5))), rnd(.7, 2));
  play('flesh_squelch', p, { ref: 10 });
}

// ---------- ragdoll ----------
// particelle: 0 bacino,1 collo,2 testa,3 spallaS,4 gomitoS,5 manoS,6 spallaD,7 gomitoD,8 manoD,9 ancaS,10 ginocchioS,11 piedeS,12 ancaD,13 ginocchioD,14 piedeD,15 petto
const RAG_LINKS = [[0, 15], [15, 1], [1, 2], [3, 15], [3, 1], [6, 15], [6, 1], [3, 6], [3, 4], [4, 5], [6, 7], [7, 8], [0, 9], [0, 12], [9, 12], [9, 15], [12, 15], [9, 10], [10, 11], [12, 13], [13, 14], [0, 1], [2, 15], [0, 3], [0, 6], [2, 3], [2, 6]];
const RAG_MIN = [[9, 11, .55], [12, 14, .55], [3, 5, .28], [6, 8, .28], [0, 2, .6], [11, 14, .12], [10, 13, .1]];
const RAG_RAD = [.14, .12, .13, .08, .06, .05, .08, .06, .05, .08, .07, .07, .08, .07, .07, .15];
function jointPositions(b, out) {
  const w = (node, x, y, z, o) => o.set(x, y, z).applyMatrix4(node.matrixWorld);
  w(b.hips, 0, 0, 0, out[0]); w(b.neck, 0, 0, 0, out[1]); w(b.neck, 0, .12, 0, out[2]);
  w(b.shL, 0, 0, 0, out[3]); w(b.elL, 0, 0, 0, out[4]); w(b.elL, 0, -ARM_B, 0, out[5]);
  w(b.shR, 0, 0, 0, out[6]); w(b.elR, 0, 0, 0, out[7]); w(b.elR, 0, -ARM_B, 0, out[8]);
  w(b.hipL, 0, 0, 0, out[9]); w(b.knL, 0, 0, 0, out[10]); w(b.knL, 0, -.45, 0, out[11]);
  w(b.hipR, 0, 0, 0, out[12]); w(b.knR, 0, 0, 0, out[13]); w(b.knR, 0, -.45, 0, out[14]);
  w(b.spine, 0, .25, 0, out[15]);
}
function startRagdoll(s, imp) {
  const b = s.body; if (b.rag) return;
  if (RAGS.length >= Q.ragdolls) settleRag(RAGS[0]);
  b.root.updateMatrixWorld(true);
  const p = Array.from({ length: 16 }, () => new V3()), pr = Array.from({ length: 16 }, () => new V3());
  jointPositions(b, p);
  const v = s.vel ? s.vel.clone() : new V3();
  for (let i = 0; i < 16; i++) pr[i].copy(p[i]).addScaledVector(v, -1 / 60);
  const links = RAG_LINKS.map(([a, c]) => [a, c, p[a].distanceTo(p[c])]);
  const rag = { s, b, p, pr, links, age: 0, calm: 0, solids: solids.filter(o => o.on && !o.nb && o.max.x > p[0].x - 6 && o.min.x < p[0].x + 6 && o.max.z > p[0].z - 6 && o.min.z < p[0].z + 6), boat: s.state === 'boat' ? s.boat : null };
  // impulsi: proiettile (spinta localizzata) o esplosione (tutto il corpo vola)
  if (imp) {
    if (imp.blast) {
      for (let i = 0; i < 16; i++) {
        _g1.subVectors(p[i], imp.blast); const d = Math.max(.5, _g1.length()); _g1.normalize();
        const k = imp.power / (1 + d * .3);
        _g1.y = Math.abs(_g1.y) + .6; _g1.multiplyScalar(k * rnd(.85, 1.15) / 60);
        pr[i].sub(_g1);
      }
    } else if (imp.dir) {
      const hit = imp.joint ?? 15;
      for (let i = 0; i < 16; i++) { const k = (i === hit ? 3.2 : 1) * imp.power / 60; pr[i].addScaledVector(imp.dir, -k); }
      // ginocchia che cedono
      for (const i of [10, 13]) pr[i].addScaledVector(_g1.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)), -.035);
      pr[0].y += .02;
    }
  }
  b.hips.position.set(0, 0, 0); b.hips.quaternion.identity(); b.root.rotation.set(0, 0, 0); b.root.quaternion.identity();
  b.rag = rag; RAGS.push(rag);
  hidePart(b, 'weapon');
}
function settleRag(r) {
  const i = RAGS.indexOf(r); if (i >= 0) RAGS.splice(i, 1);
  r.b.root.updateMatrixWorld(true); r.b.settled = true;
  if (SETTINGS.gore && !r.noPool) { const c = r.p[15]; if (!(c.z > -9 && Hf(c.x, c.z) < WATER_Y - .2)) addDecal('blood', c, rnd(1.2, 2.2), rnd(4, 9)); }
}
function basisQuat(up, right, out) {
  _g2.copy(right).addScaledVector(up, -right.dot(up)).normalize();
  _g3.crossVectors(_g2, up).normalize();
  _gm.makeBasis(_g2, up, _g3); return out.setFromRotationMatrix(_gm);
}
const _wq = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _uq = new THREE.Quaternion(), _up = new V3(), _rt = new V3(), _dv = new V3();
function boneLocal(node, parentWorldQ, a, b, outWorld) {
  _dv.subVectors(b, a).normalize();
  _wq.setFromUnitVectors(DOWN, _dv);
  node.quaternion.copy(parentWorldQ).invert().multiply(_wq);
  if (outWorld) outWorld.copy(_wq);
}
function applyRag(r) {
  const b = r.b, p = r.p;
  b.root.position.copy(p[0]);
  basisQuat(_up.subVectors(p[15], p[0]).normalize(), _rt.subVectors(p[12], p[9]).normalize(), _rq);
  b.root.quaternion.copy(_rq);
  basisQuat(_up.subVectors(p[1], p[15]).normalize(), _rt.subVectors(p[6], p[3]).normalize(), _cq);
  b.spine.quaternion.copy(_rq).invert().multiply(_cq);
  b.spine.position.set(0, .1, 0);
  basisQuat(_up.subVectors(p[2], p[1]).normalize(), _rt.subVectors(p[6], p[3]).normalize(), _wq);
  b.neck.quaternion.copy(_cq).invert().multiply(_wq);
  const tq = new THREE.Quaternion();
  boneLocal(b.shL, _cq, p[3], p[4], tq); boneLocal(b.elL, tq, p[4], p[5]);
  boneLocal(b.shR, _cq, p[6], p[7], tq); boneLocal(b.elR, tq, p[7], p[8]);
  boneLocal(b.hipL, _rq, p[9], p[10], tq); boneLocal(b.knL, tq, p[10], p[11]);
  boneLocal(b.hipR, _rq, p[12], p[13], tq); boneLocal(b.knR, tq, p[13], p[14]);
}
function ragGround(r, x, z) {
  let g = Hf(x, z);
  const bt = r.boat; if (bt && Math.abs(x - bt.x) < 1.6 && z > bt.z - 5.1 && z < bt.z + 5) g = Math.max(g, bt.y + .45);
  return g;
}
function updateRagdolls(dt) {
  const h = Math.min(dt, 1 / 30), g = -9.8 * h * h;
  for (let ri = RAGS.length - 1; ri >= 0; ri--) {
    const r = RAGS[ri], p = r.p, pr = r.pr;
    r.age += h;
    let move = 0;
    for (let i = 0; i < 16; i++) {
      const a = p[i], o = pr[i];
      let vx = (a.x - o.x) * .995, vy = (a.y - o.y) * .995, vz = (a.z - o.z) * .995;
      o.copy(a);
      const wl = a.z > -10 ? WATER_Y + waveH(a.x, a.z, GAME.time) * .6 : -99;
      let ay = g;
      if (a.y < wl - .05) { ay += 13.5 * h * h * (i === 15 || i === 0 ? 1.3 : 1); vx *= .9; vy *= .85; vz *= .9; vx += .004 * h * 60 * Math.sin(GAME.time * .3 + i); }
      a.x += vx; a.y += vy + ay; a.z += vz;
      move = Math.max(move, Math.abs(vx) + Math.abs(vy) + Math.abs(vz));
    }
    for (let it = 0; it < 5; it++) {
      for (const [ia, ib, L] of r.links) {
        const a = p[ia], c = p[ib]; _g1.subVectors(c, a); const d = _g1.length() || 1e-4, k = (d - L) / d * .5;
        a.addScaledVector(_g1, k); c.addScaledVector(_g1, -k);
      }
      for (const [ia, ib, m] of RAG_MIN) {
        const a = p[ia], c = p[ib]; _g1.subVectors(c, a); const d = _g1.length() || 1e-4; if (d >= m) continue; const k = (d - m) / d * .5;
        a.addScaledVector(_g1, k); c.addScaledVector(_g1, -k);
      }
      for (let i = 0; i < 16; i++) {
        const a = p[i], gy = ragGround(r, a.x, a.z) + RAG_RAD[i];
        if (a.y < gy) { a.y = gy; const o = pr[i]; o.x = lerp(o.x, a.x, .45); o.z = lerp(o.z, a.z, .45); }
      }
    }
    for (const s of r.solids) for (let i = 0; i < 16; i++) {
      const a = p[i]; if (a.x < s.min.x || a.x > s.max.x || a.y < s.min.y || a.y > s.max.y || a.z < s.min.z || a.z > s.max.z) continue;
      const pen = [a.x - s.min.x, s.max.x - a.x, a.y - s.min.y, s.max.y - a.y, a.z - s.min.z, s.max.z - a.z], k = pen.indexOf(Math.min(...pen));
      if (k === 0) a.x = s.min.x; else if (k === 1) a.x = s.max.x; else if (k === 2) a.y = s.min.y; else if (k === 3) a.y = s.max.y; else if (k === 4) a.z = s.min.z; else a.z = s.max.z;
    }
    applyRag(r);
    if (!r.landed && r.age > .25 && p[15].y < ragGround(r, p[15].x, p[15].z) + .3) { r.landed = true; play('bodyfall', p[15], { ref: 10 }); }
    const inWater = p[15].z > -10 && p[15].y < WATER_Y + .3;
    r.calm = move < .004 ? r.calm + h : 0;
    if (!inWater && (r.calm > .6 || r.age > 7)) settleRag(r);
    else if (inWater && r.age > 25) settleRag(r);
  }
  // corpi in acqua: sangue che si diffonde
  if (SETTINGS.gore && R() < .15) for (const r of RAGS) { const c = r.p[15]; if (c.z > -10 && c.y < WATER_Y + .3 && R() < .3) PS_SMOKE.emit(c.x + rnd(-.5, .5), WATER_Y + .05, c.z + rnd(-.5, .5), rnd(-.2, .2), 0, rnd(-.2, .2), rnd(4, 7), .4, 2.5, .35, .25, .02, .02, .3, 0); }
}

// ---------- smembramenti ----------
const CHILD = { thighL: ['thighL', 'shinL'], thighR: ['thighR', 'shinR'], uarmL: ['uarmL', 'farmL'], uarmR: ['uarmR', 'farmR'], shinL: ['shinL'], shinR: ['shinR'], farmL: ['farmL'], farmR: ['farmR'], head: ['head', 'helmet'] };
function dismember(s, center) {
  if (!SETTINGS.gore) return;
  const b = s.body; b.root.updateMatrixWorld(true);
  const opts = ['thighL', 'thighR', 'uarmL', 'uarmR', 'shinL', 'shinR', 'farmL', 'farmR'];
  const n = R() < .25 ? 3 : R() < .6 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const name = pick(opts);
    for (const pn of CHILD[name]) {
      const pt = b.parts.find(x => x.name === pn); if (!pt || pt.hidden) continue;
      pt.hidden = true;
      spawnGib(pt, center, true);
    }
    const jp = b.parts.find(x => x.name === name).node.getWorldPosition(new V3());
    bloodBurst(jp, .7);
    const e = addEmitter(jp, 'bleed', 1); e.life = 4; const node = b.parts.find(x => x.name === name).node; e.follow = q => node.getWorldPosition(q);
  }
}
function spawnGib(pt, center, bleed) {
  if (GIBS.length >= Q.gibs) { const old = GIBS.shift(); scene.remove(old.m); }
  const geo = (pt.mesh.hi || pt.mesh.lo).geometry, m = new THREE.Mesh(geo, MAT.soldier);
  pt.node.matrixWorld.decompose(m.position, m.quaternion, m.scale); m.castShadow = true; scene.add(m);
  const v = _g1.subVectors(m.position, center).normalize().multiplyScalar(rnd(6, 13)); v.y = Math.abs(v.y) + rnd(4, 9);
  const gib = { m, v: v.clone(), w: new V3(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)), life: 0, rest: false };
  GIBS.push(gib);
  if (bleed) { const e = addEmitter(m.position, 'bleed', 1); e.life = 2.5; e.follow = q => q.copy(m.position); }
  return gib;
}
function helmetOff(s, dir) {
  const pt = s.body.parts.find(x => x.name === 'helmet'); if (!pt || pt.hidden) return;
  s.body.root.updateMatrixWorld(true); pt.hidden = true;
  const g = spawnGib(pt, s.body.neck.getWorldPosition(new V3()).addScaledVector(dir, -1), false);
  g.v.copy(dir).multiplyScalar(rnd(3, 6)); g.v.y += rnd(2, 4); g.helmet = true;
}
function updateGore(dt) {
  updateRagdolls(dt);
  for (const g of GIBS) {
    if (g.rest) continue;
    g.v.y -= 9.8 * dt; g.m.position.addScaledVector(g.v, dt);
    g.m.rotation.x += g.w.x * dt; g.m.rotation.y += g.w.y * dt; g.m.rotation.z += g.w.z * dt;
    const gy = Hf(g.m.position.x, g.m.position.z) + .05;
    if (g.m.position.y < gy) {
      g.m.position.y = gy; g.v.multiplyScalar(.35); g.v.y = Math.abs(g.v.y) * .4; g.w.multiplyScalar(.5);
      if (g.v.length() < .5) { g.rest = true; if (!g.helmet && SETTINGS.gore) addDecal('blood', g.m.position, rnd(.5, 1)); }
      play(g.helmet ? 'imp_metal' : 'flesh_squelch', g.m.position, { ref: 8, vol: .5 });
    }
  }
}
