"use strict";
// ============================================================
//  Soldati: modelli articolati, animazioni, IA alleata e nemica
// ============================================================
const allies = [], enemies = [], corpses = [];
const SGEO = {};
const SCOL = {
  A: { jacket: 0x6b6845, pants: 0x5e5b3e, web: 0x8f8660, pack: 0x6e6a4d, helm: 0x4a4f33, skin: 0xc69a7a, legging: 0x9b8f6c, boot: 0x4a3524, wood: 0x6b4423 },
  E: { jacket: 0x5d6660, pants: 0x535b57, web: 0x26231f, pack: 0x4f4a3c, helm: 0x4d5550, skin: 0xc9a083, legging: 0x1c1a18, boot: 0x1c1a18, wood: 0x5a3a20 },
};
const T1 = new V3(), T2 = new V3(), T3 = new V3(), T4 = new V3();

function buildSoldierGeos(team, kind) {
  const C = SCOL[team], met = 0x262626;
  // --- busto con braccia e arma (spazio della colonna, origine all'anca) ---
  const t = new MB();
  t.add(U.box, C.pants, 0, .06, 0, 0, 0, 0, .36, .24, .24);
  t.add(U.box, C.jacket, 0, .4, 0, .05, 0, 0, .44, .52, .26);
  t.add(U.box, C.web, 0, .16, 0, 0, 0, 0, .46, .07, .28);
  for (const x of [-.15, -.05, .05, .15]) t.add(U.box, C.web, x, .16, -.15, 0, 0, 0, .08, .1, .05);
  t.add(U.cyl, C.skin, 0, .7, 0, 0, 0, 0, .06, .1, .06);
  if (team === 'A') {
    t.add(U.box, C.pack, 0, .44, .2, 0, 0, 0, .32, .34, .15);
    t.add(U.cyl, 0x7a7350, 0, .64, .2, 0, 0, PI / 2, .07, .34, .07);
    t.add(U.box, C.web, -.12, .42, 0, 0, 0, 0, .05, .5, .28); t.add(U.box, C.web, .12, .42, 0, 0, 0, 0, .05, .5, .28);
    t.add(U.box, 0x5a4a35, .18, .1, .14, .3, 0, 0, .06, .28, .04);
    if (kind === 'medic') { t.add(U.box, 0xe8e6de, -.24, .52, 0, 0, 0, 0, .02, .09, .13); t.add(U.box, 0xb01010, -.25, .52, 0, 0, 0, 0, .02, .06, .02); }
  } else {
    t.add(U.cyl, 0x5a625a, .14, .2, .16, 0, 0, 0, .06, .26, .06);
    t.add(U.box, C.pack, -.1, .2, .16, 0, 0, 0, .14, .14, .08);
    t.add(U.box, 0x3d3a33, -.13, .32, -.15, 0, 0, 0, .07, .12, .04);
  }
  // braccia e arma
  const grip = new V3(.12, .43, -.16), fore = new V3(.07, .47, -.52), shR = new V3(.25, .57, 0), shL = new V3(-.25, .57, 0);
  let lHand = fore.clone();
  const wood = C.wood;
  if (kind === 'rifle' || kind === 'sniper') {
    t.add(U.box, wood, grip.x, grip.y - .02, grip.z + .16, 0, 0, 0, .055, .1, .4);
    t.add(U.box, wood, grip.x, grip.y + .02, grip.z - .3, 0, 0, 0, .05, .06, .5);
    t.add(U.cyl, met, grip.x, grip.y + .05, grip.z - .62, PI / 2, 0, 0, .013, .5, .013);
    if (kind === 'sniper') t.add(U.cyl, met, grip.x, grip.y + .11, grip.z - .12, PI / 2, 0, 0, .022, .3, .022);
  } else if (kind === 'smg') {
    if (team === 'A') {
      t.add(U.box, wood, grip.x, grip.y - .01, grip.z + .14, 0, 0, 0, .05, .09, .3);
      t.add(U.box, met, grip.x, grip.y + .03, grip.z - .14, 0, 0, 0, .05, .07, .3);
      t.add(U.cyl, met, grip.x, grip.y + .04, grip.z - .38, PI / 2, 0, 0, .015, .24, .015);
      t.add(U.box, met, grip.x, grip.y - .08, grip.z - .14, 0, 0, 0, .035, .18, .06);
    } else {
      t.add(U.cyl, met, grip.x, grip.y + .03, grip.z - .12, PI / 2, 0, 0, .025, .34, .025);
      t.add(U.box, met, grip.x, grip.y - .1, grip.z - .2, 0, 0, 0, .03, .22, .04);
      t.add(U.box, met, grip.x, grip.y, grip.z + .12, 0, 0, 0, .02, .05, .22);
    }
    lHand = new V3(.08, .38, -.36);
  } else if (kind === 'bar') {
    t.add(U.box, wood, grip.x, grip.y - .02, grip.z + .18, 0, 0, 0, .055, .11, .4);
    t.add(U.box, met, grip.x, grip.y + .03, grip.z - .2, 0, 0, 0, .06, .09, .45);
    t.add(U.cyl, met, grip.x, grip.y + .05, grip.z - .65, PI / 2, 0, 0, .016, .5, .016);
    t.add(U.box, met, grip.x, grip.y - .06, grip.z - .16, 0, 0, 0, .04, .12, .08);
  } else if (kind === 'mg') {
    t.add(U.box, met, grip.x, grip.y + .02, grip.z - .2, 0, 0, 0, .08, .11, .6);
    t.add(U.cyl, met, grip.x, grip.y + .04, grip.z - .68, PI / 2, 0, 0, .035, .45, .035);
    t.add(U.box, met, grip.x, grip.y, grip.z + .18, 0, 0, 0, .05, .1, .3);
    t.add(U.box, 0xa0823c, grip.x - .1, grip.y - .02, grip.z - .2, 0, 0, .4, .14, .03, .18);
    lHand = new V3(.04, .44, -.28);
  }
  if (kind === 'medic') { lHand = new V3(-.18, .25, -.15); }
  const elR = new V3(.28, .32, .02), elL = new V3(-.14, .34, -.22);
  t.between(shR, elR, .062, C.jacket); t.between(elR, grip, .052, C.jacket);
  if (kind === 'medic') { t.between(shL, new V3(-.28, .32, 0), .062, C.jacket); t.between(new V3(-.28, .32, 0), lHand, .052, C.jacket); }
  else { t.between(shL, elL, .062, C.jacket); t.between(elL, lHand, .052, C.jacket); }
  t.add(U.sph, C.skin, grip.x, grip.y - .02, grip.z + .02, 0, 0, 0, .045, .045, .05);
  t.add(U.sph, C.skin, lHand.x, lHand.y - .02, lHand.z, 0, 0, 0, .045, .045, .05);
  // --- testa ed elmetto ---
  const h = new MB();
  h.add(U.sph, C.skin, 0, .1, 0, 0, 0, 0, .1, .118, .108);
  h.add(U.box, C.skin, 0, .09, -.105, 0, 0, 0, .025, .04, .03);
  if (team === 'A') {
    h.add(U.hemi, C.helm, 0, .135, 0, 0, 0, 0, .145, .125, .155);
    h.add(U.cyl12, C.helm, 0, .132, 0, 0, 0, 0, .16, .014, .17);
    if (kind === 'medic') for (const sx of [-1, 1]) { h.add(U.cyl12, 0xe8e6de, sx * .14, .2, 0, 0, 0, PI / 2, .045, .01, .045); h.add(U.box, 0xb01010, sx * .147, .2, 0, 0, 0, 0, .008, .055, .016); h.add(U.box, 0xb01010, sx * .147, .2, 0, 0, 0, 0, .008, .016, .055); }
  } else {
    h.add(U.hemi, C.helm, 0, .14, 0, 0, 0, 0, .14, .13, .15);
    h.add(U.skirt, C.helm, 0, .105, .005, 0, 0, 0, .14, .07, .15);
  }
  // --- gambe ---
  const th = new MB(); th.add(U.box, C.pants, 0, -.22, 0, 0, 0, 0, .15, .46, .17);
  const sh = new MB(); sh.add(U.box, C.pants, 0, -.18, 0, 0, 0, 0, .13, .36, .15);
  sh.add(U.box, C.legging, 0, -.33, 0, 0, 0, 0, .145, .2, .16);
  sh.add(U.box, C.boot, 0, -.44, -.04, 0, 0, 0, .14, .1, .27);
  return { torso: t.build(), head: h.build(), thigh: th.build(), shin: sh.build() };
}

function makeSoldierModel(team, kind) {
  const key = team + kind;
  const G = SGEO[key] || (SGEO[key] = buildSoldierGeos(team, kind));
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const hips = new THREE.Group(); hips.position.y = .95; root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const meshes = [];
  const mk = (g, parent) => { const m = new THREE.Mesh(g, MAT.soldier); parent.add(m); meshes.push(m); return m; };
  mk(G.torso, spine);
  const neck = new THREE.Group(); neck.position.y = .68; spine.add(neck); mk(G.head, neck);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.x = sx * .1; hips.add(hip); mk(G.thigh, hip);
    const knee = new THREE.Group(); knee.position.y = -.46; hip.add(knee); mk(G.shin, knee);
    legs.push(hip, knee);
  }
  return { root, hips, spine, neck, hipL: legs[0], kneeL: legs[1], hipR: legs[2], kneeR: legs[3], meshes };
}

let soldierId = 0;
class Soldier {
  constructor(team, kind, x, z, o = {}) {
    this.id = soldierId++; this.team = team; this.kind = kind; this.w = AIW[kind] || AIW.rifle;
    this.snd = AISND[team][kind] || 'garand';
    this.m = makeSoldierModel(team, kind); this.root = this.m.root; this.pos = this.root.position;
    scene.add(this.root);
    this.fixedY = o.y !== undefined;
    this.pos.set(x, this.fixedY ? o.y : H(x, z), z);
    this.yaw = o.yaw !== undefined ? o.yaw : (team === 'A' ? 0 : PI); this.root.rotation.y = this.yaw;
    this.hp = 100; this.alive = true; this.state = o.state || (team === 'A' ? 'idle' : 'post');
    this.group = o.group || ''; this.squad = !!o.squad; this.name = o.name || '';
    this.inBunker = !!o.inBunker; this.inTrench = !!o.inTrench; this.stationary = !!o.stationary;
    this.objective = o.objective || null; this.bunker = o.bunker || null;
    this.crouch = 0; this.ph = R() * TAU; this.dest = null; this.wp = new V3(); this.cover = null; this.wait = rnd(.5, 2);
    this.thinkT = R() * .5; this.thinkDt = .4; this.fireT = rnd(1, 3); this.burst = 0; this.target = null; this.tVis = false;
    this.duck = R() < .5; this.duckT = rnd(.5, 3); this.nadeT = rnd(5, 14); this.fall = 0; this.fallDir = 1; this.fallTw = 0; this.supp = 0;
    this.boat = null; this.off = null; this.leave = 0; this.moving = false; this.crouchRun = false; this.shadowOn = false;
    this.speedMul = rnd(.88, 1.1); this.flee = false; this.removed = false; this.aim = 0; this.prev = new V3();
    (team === 'A' ? allies : enemies).push(this);
  }
  chest(out) { return out.set(this.pos.x, this.pos.y + lerp(1.22, .88, this.crouch), this.pos.z); }
  head(out) { const c = this.crouch; return out.set(this.pos.x - Math.sin(this.yaw) * c * .2, this.pos.y + lerp(1.72, 1.24, c), this.pos.z - Math.cos(this.yaw) * c * .2); }
  eye(out) { return out.set(this.pos.x, this.pos.y + lerp(1.62, 1.15, this.crouch), this.pos.z); }
  muzzle(out) { return out.set(this.pos.x - Math.sin(this.yaw) * .7, this.pos.y + lerp(1.4, 1.02, this.crouch), this.pos.z - Math.cos(this.yaw) * .7); }

  damage(a, from, byPlayer, zone) {
    if (!this.alive) return false;
    this.hp -= a; this.supp = Math.min(1, this.supp + .6);
    if (this.hp <= 0) { this.die(from, byPlayer, zone); return true; }
    if (from && this.team === 'E' && byPlayer) { this.target = P; this.tVis = true; this.duck = true; this.duckT = rnd(.6, 1.4); }
    return false;
  }
  die(from, byPlayer, zone) {
    if (!this.alive) return;
    this.alive = false; this.fall = 0;
    if (from) {
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z;
      this.fallDir = (dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw)) > 0 ? -1 : 1;
    } else this.fallDir = R() < .5 ? 1 : -1;
    this.fallTw = rnd(-1, 1);
    if (this.cover) { this.cover.occ--; this.cover = null; }
    for (const m of this.m.meshes) m.castShadow = false;
    corpses.push(this);
    if (corpses.length > Q.corpses) { const c = corpses.shift(); c.removed = true; scene.remove(c.root); }
    onSoldierDeath(this, byPlayer, zone);
  }
  setShadow(on) { if (on === this.shadowOn) return; this.shadowOn = on; for (const m of this.m.meshes) m.castShadow = on; }

  update(dt) {
    if (!this.alive) {
      if (this.fall < 1) {
        this.fall = Math.min(1, this.fall + dt * 2.6);
        const e = 1 - (1 - this.fall) ** 2, m = this.m;
        this.root.rotation.x = e * PI / 2 * .95 * this.fallDir;
        this.root.rotation.z = e * this.fallTw * .25;
        m.hips.position.y = lerp(m.hips.position.y, .9, e); m.spine.rotation.x = 0;
        m.hipL.rotation.x = e * .25 * this.fallDir; m.hipR.rotation.x = -e * .15; m.kneeL.rotation.x = -e * .4; m.kneeR.rotation.x = -e * .1;
        if (!this.fixedY && this.state !== 'boat') this.pos.y = H(this.pos.x, this.pos.z) + .12 * e;
      }
      if (this.state === 'boat' && this.boat) this.boat.toWorld(this.off, this.pos);
      return;
    }
    if (this.state === 'boat') {
      this.boat.toWorld(this.off, this.pos);
      this.yaw = this.boat.g.rotation.y; this.root.rotation.y = this.yaw;
      this.crouch = lerp(this.crouch, this.boat.open ? 0 : .8, dt * 3);
      this.anim(dt, 0);
      if (this.boat.open) {
        this.leave -= dt;
        if (this.leave <= 0) { this.state = 'move'; this.dest = new V3(this.pos.x + rnd(-.5, .5), 0, this.boat.z - 10); this.crouchRun = false; this.thinkT = rnd(1.5, 3); }
      }
      return;
    }
    this.supp = Math.max(0, this.supp - dt * .25);
    let sp = 0;
    this.prev.copy(this.pos);
    if (this.dest && !this.stationary) {
      routeWaypoint(this.pos, this.dest, this.wp);
      const isDest = Math.abs(this.wp.x - this.dest.x) < .01 && Math.abs(this.wp.z - this.dest.z) < .01;
      const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < .5) { if (isDest) { this.dest = null; this.onArrive(); } }
      else {
        let v = (this.crouchRun ? 3.3 : 4.6) * this.speedMul;
        if (this.flee) v = 5;
        const depth = WATER_Y - H(this.pos.x, this.pos.z);
        if (depth > 0) v *= clamp(1 - depth * .55, .3, 1);
        const step = Math.min(d, v * dt);
        this.pos.x += dx / d * step; this.pos.z += dz / d * step; sp = v;
        const ty = Math.atan2(-dx, -dz);
        this.yaw = angLerp(this.yaw, ty, dt * 8);
      }
    }
    this.moving = sp > .5;
    if (!this.fixedY) {
      if (this.moving) { pushOut(this.pos, .35); applyWire(this.pos, this.prev); }
      this.pos.y = H(this.pos.x, this.pos.z);
      if (this.moving && inMinefield(this.pos.x, this.pos.z)) checkMines(this.pos);
    }
    // bersaglio e postura
    if (this.target && !this.moving) {
      const tp = targetChest(this.target, T2);
      if (tp) {
        this.yaw = angLerp(this.yaw, Math.atan2(-(tp.x - this.pos.x), -(tp.z - this.pos.z)), dt * 6);
        const hd = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z);
        this.aim = lerp(this.aim, clamp(Math.atan2(tp.y - this.pos.y - 1.3, hd), -.6, .6), dt * 5);
      }
    } else this.aim = lerp(this.aim, 0, dt * 4);
    this.root.rotation.y = this.yaw;

    const posted = this.state === 'post' || this.state === 'cover' || this.state === 'hold';
    if (posted) {
      this.duckT -= dt;
      if (this.duckT <= 0) {
        this.duck = !this.duck;
        this.duckT = this.duck ? rnd(1.2, 3.5) * (1 + this.supp * 2) : rnd(2.2, 5);
        if (this.kind === 'mg' || this.inBunker) this.duck = false;
      }
    } else this.duck = false;
    let wc = 0;
    if (this.moving) wc = this.crouchRun ? .35 : 0;
    else if (posted) wc = this.duck ? 1 : (this.inTrench || this.inBunker || this.kind === 'mg' ? 0 : (this.team === 'A' && this.cover && this.cover.kind === 'bank' ? .55 : .15));
    if (this.state === 'boat') wc = .8;
    this.crouch = lerp(this.crouch, wc, dt * 6);

    // fuoco
    if (!this.duck && !this.moving && this.target && this.tVis && !this.flee) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        if (this.burst <= 0) this.burst = Math.round(rnd(this.w.burst[0], this.w.burst[1]));
        this.fire(); this.burst--;
        this.fireT = this.burst > 0 ? this.w.bi * rnd(.85, 1.15) : rnd(this.w.rate[0], this.w.rate[1]) * (this.team === 'A' ? 1 : 1 / Math.max(.6, D.acc));
      }
    }
    this.anim(dt, sp);
  }

  anim(dt, sp) {
    const m = this.m, run = clamp(sp / 4.5, 0, 1), cr = this.crouch;
    this.ph += dt * (3 + sp * 2.1);
    const s = Math.sin(this.ph), c = Math.cos(this.ph);
    const still = run < .1;
    m.hips.position.y = (still ? lerp(.95, .56, cr) : lerp(.95, .8, cr)) + Math.abs(c) * .05 * run;
    const base = still ? cr * 1.45 : cr * .45;
    m.hipL.rotation.x = s * .8 * run + base; m.hipR.rotation.x = -s * .8 * run + base;
    const kb = still ? cr * 2.3 : cr * .7;
    m.kneeL.rotation.x = -(Math.max(0, Math.sin(this.ph + 1.6)) * 1.2 * run + kb);
    m.kneeR.rotation.x = -(Math.max(0, Math.sin(this.ph + 1.6 + PI)) * 1.2 * run + kb);
    m.spine.rotation.x = -(.15 * run + cr * (still ? .3 : .45)) + this.aim * .8;
    m.spine.rotation.y = s * .08 * run;
  }

  think() {
    if (!this.alive || this.state === 'boat' || this.removed) return;
    const d2 = dist2Cam(this.pos);
    this.setShadow(Q.shadows > 0 && d2 < (Q.shadowDist * .75) ** 2);
    this.findTarget();
    if (this.team === 'A') this.thinkAlly(); else this.thinkEnemy();
  }

  findTarget() {
    const r = this.w.range, me = this.pos, cands = [];
    const opp = this.team === 'A' ? enemies : allies;
    for (const o of opp) {
      if (!o.alive || o.state === 'boat' || o.flee || o.removed) continue;
      const dx = o.pos.x - me.x, dz = o.pos.z - me.z, d2 = dx * dx + dz * dz;
      if (d2 < r * r) cands.push([o, d2]);
    }
    if (this.team === 'E' && P.targetable()) { const d2 = P.pos.distanceToSquared(me); if (d2 < r * r) cands.push([P, d2 * .5]); }
    cands.sort((a, b) => a[1] - b[1]);
    this.target = null; this.tVis = false;
    const eye = this.eye(T1);
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const c = cands[i][0], tp = c.chest(T2);
      if (losClear(eye, tp)) { this.target = c; this.tVis = true; return; }
    }
    if (cands.length) { this.target = cands[0][0]; return; }
    if (this.team === 'E') {
      const bs = WORLD.boats.filter(b => b.state === 'move' && b.z < 220 && Math.abs(b.x - me.x) < 120);
      if (bs.length) { this.target = { isBoat: true, b: pick(bs), chest: function (o) { const g = this.b.g.position; return o.set(g.x + rnd(-1.4, 1.4), g.y + rnd(.6, 2), g.z - 5 + rnd(-.3, 2)); } }; this.tVis = true; }
    }
  }

  thinkAlly() {
    const Z = MISSION.allyZone;
    if (this.squad && !P.inBoat && P.pos.distanceTo(this.pos) > 28 && this.state !== 'move') this.wait = 0;
    if (this.state === 'move') return;
    this.wait -= this.thinkDt;
    if (this.wait <= 0 && Z) this.pickCover(Z);
  }
  pickCover(Z) {
    const p = this.pos;
    let best = null, bs = -1e9;
    for (const c of covers) {
      if (c.occ >= 2 || c.z > Z.zMax || c.z < Z.zMin || c.x < Z.xMin || c.x > Z.xMax) continue;
      if (Z.kinds && !Z.kinds.includes(c.kind)) continue;
      const dx = c.x - p.x, dz = c.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 50 || dist < 1) continue;
      if (inMinefield(c.x, c.z)) continue;
      let s;
      if (Z.defend) s = -Math.hypot(c.x - Z.cx, c.z - Z.cz) * .25 - dist * .15 + R() * 6;
      else {
        const prog = p.z - c.z;
        s = p.z - Z.zMin < 5 ? -dist * .3 + R() * 6 : -Math.abs(prog - Z.step) * .55 - Math.abs(dx) * .25 + R() * 8;
      }
      if (this.squad) { const dp = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); s -= Math.max(0, dp - 12) * .9; }
      if (s > bs) { bs = s; best = c; }
    }
    if (this.cover) { this.cover.occ--; this.cover = null; }
    if (best) { best.occ++; this.cover = best; this.dest = new V3(best.x + rnd(-.35, .35), 0, best.z + rnd(-.2, .3)); }
    else this.dest = new V3(clamp(p.x + rnd(-8, 8), Z.xMin, Z.xMax), 0, clamp(p.z - rnd(3, 12), Z.zMin, Z.zMax));
    this.state = 'move'; this.crouchRun = this.supp > .2 || R() < .45;
  }
  onArrive() {
    if (this.flee) { this.removed = true; scene.remove(this.root); this.alive = false; return; }
    const Z = MISSION.allyZone;
    if (this.team === 'A') { this.state = 'cover'; this.wait = Z ? rnd(Z.wait[0], Z.wait[1]) : 4; }
    else { this.state = this.state === 'assault' ? 'assault' : 'post'; this.wait = rnd(3, 7); }
    this.duck = true; this.duckT = rnd(.4, 1.2);
  }
  thinkEnemy() {
    if (this.flee) { if (!this.dest) { this.dest = new V3(this.pos.x + rnd(-40, 40), 0, -540); this.state = 'move'; } return; }
    if (this.state === 'assault' && !this.dest) {
      this.wait -= this.thinkDt;
      if (this.wait <= 0) {
        const o = this.objective, dx = o.x - this.pos.x, dz = o.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 22) { this.state = 'hold'; }
        else {
          const step = Math.min(rnd(10, 22), d - 15), nx = this.pos.x + dx / d * step + rnd(-6, 6), nz = this.pos.z + dz / d * step;
          let best = null, bd = 49;
          for (const c of covers) { const dd = (c.x - nx) ** 2 + (c.z - nz) ** 2; if (dd < bd && c.occ < 2) { bd = dd; best = c; } }
          this.dest = best ? new V3(best.x, 0, best.z - 2) : new V3(nx, 0, nz);
          this.crouchRun = R() < .5;
        }
      }
    }
    if (this.target === P && this.tVis && !this.inBunker && this.kind !== 'mg' && !this.moving) {
      const d = P.pos.distanceTo(this.pos);
      if (d > 9 && d < 30) { this.nadeT -= this.thinkDt; if (this.nadeT <= 0 && MISSION.nadeCD <= 0) { throwEnemyNade(this); this.nadeT = rnd(18, 32); MISSION.nadeCD = rnd(6, 11) / D.acc; } }
    }
  }

  fire() {
    const t = this.target, tp = targetChest(t, T2); if (!tp) return;
    const from = this.muzzle(T1), d = from.distanceTo(tp);
    let p = this.w.acc * clamp(1.15 - d / this.w.range, .12, 1);
    p *= this.team === 'E' ? D.acc : (d > 60 ? .4 : 1.1);
    if (this.supp > .3) p *= .6;
    if (t === P) { p *= P.hitMul(); if (!losClear(from, tp)) p = 0; }
    else if (t.isBoat) p = 0;
    else { if (t.crouch > .5) p *= .55; if (t.inTrench) p *= .5; if (t.moving) p *= .75; if (t.state === 'cover') p *= .75; if (t.pos.z > -56.5) p *= 1.7; }
    const hit = R() < p, end = T3.copy(tp);
    if (!hit) { end.x += rnd(-2.2, 2.2); end.y += rnd(-1.2, 1.6); end.z += rnd(-2.2, 2.2); end.sub(from).multiplyScalar(1.5).add(from); }
    if (R() < this.w.tracer && d > 8) fxTracer(from, end);
    sfxShot(this.snd, from);
    if (dist2Cam(from) < 160 * 160) fxMuzzle(from, T4.subVectors(tp, from).normalize(), this.kind === 'mg');
    if (hit) {
      const dm = rnd(this.w.dmg[0], this.w.dmg[1]);
      if (t === P) P.damage(dm * D.dmg, from);
      else { t.damage(dm * 1.8, from, false); if (dist2Cam(tp) < 120 * 120) fxImpact(tp.clone(), 'blood'); }
    } else {
      if (t === P) P.nearMiss(from);
      if (t.isBoat) { if (t.b === P.boat || dist2Cam(tp) < 60 * 60) { fxImpact(tp.clone(), 'metal'); sfxImpact(tp, 'metal'); } }
      else if (R() < .35) {
        const gx = end.x, gz = end.z, gy = H(gx, gz), wet = gz > -8 && gy < WATER_Y;
        const ip = new V3(gx, wet ? WATER_Y : gy, gz);
        if (dist2Cam(ip) < 150 * 150) fxImpact(ip, wet ? 'water' : gz > -58 ? 'sand' : 'dirt');
      }
    }
  }
}
function angLerp(a, b, t) { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return a + d * Math.min(1, t); }
function targetChest(t, out) {
  if (!t) return null;
  if (t === P) return P.targetable() ? P.chest(out) : null;
  if (t.isBoat) return t.b.state === 'move' ? t.chest(out) : null;
  return t.alive ? t.chest(out) : null;
}

function updateAI(dt) {
  for (const list of [allies, enemies]) {
    for (const s of list) {
      if (s.removed) continue;
      s.update(dt);
      if (s.alive && s.state !== 'boat') {
        s.thinkT -= dt;
        if (s.thinkT <= 0) { s.thinkDt = dist2Cam(s.pos) > 200 * 200 ? rnd(.8, 1.2) : rnd(.3, .5); s.thinkT = s.thinkDt; s.think(); }
      }
    }
  }
  for (const list of [allies, enemies]) for (let i = list.length - 1; i >= 0; i--) if (list[i].removed) list.splice(i, 1);
}
