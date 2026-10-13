"use strict";
// ============================================================
//  Soldati: animazione procedurale, IA alleata e nemica,
//  feriti, medici, soppressione, grida, ragdoll alla morte
// ============================================================
const allies = [], enemies = [], corpses = [];
const T1 = new V3(), T2 = new V3(), T3 = new V3(), T4 = new V3(), T5 = new V3();
const AI_BUDGET = { n: 0 };

let soldierId = 0;
// qualità dei ripari: più alta = più protetto
const COVER_Q = { bank: 7, tank: 6, sand: 6, bunker: 6, trench: 5, wallN: 5, house: 6, church: 6, ruin: 5, gate: 3, crater: 3.5, hh: 2.5, tree: 4 };
class Soldier {
  constructor(team, kind, x, z, o = {}) {
    this.id = soldierId++; this.team = team; this.kind = kind; this.w = AIW[kind] || AIW.rifle;
    this.snd = AISND[team][kind] || 'garand';
    this.body = makeBody(team, kind); this.root = this.body.root; this.pos = this.root.position;
    this.fixedY = o.y !== undefined;
    this.pos.set(x, this.fixedY ? o.y : Hf(x, z), z);
    this.yaw = o.yaw !== undefined ? o.yaw : (team === 'A' ? 0 : PI); this.root.rotation.y = this.yaw;
    this.hp = 100; this.alive = true; this.state = o.state || (team === 'A' ? 'idle' : 'post');
    this.group = o.group || ''; this.squad = !!o.squad; this.name = o.name || '';
    this.inBunker = !!o.inBunker; this.inTrench = !!o.inTrench; this.stationary = !!o.stationary;
    this.objective = o.objective || null; this.bunker = o.bunker || null; this.toPost = !!o.toPost; this.role = o.role || '';
    this.crouch = 0; this.prone = 0; this.ph = R() * TAU; this.dest = null; this.wp = new V3(); this.cover = null; this.wait = rnd(.5, 2);
    this.thinkT = R() * .5; this.thinkDt = .4; this.fireT = rnd(1, 3); this.burst = 0; this.target = null; this.tVis = false; this.vis = [];
    this.duck = R() < .5; this.duckT = rnd(.5, 3); this.nadeT = rnd(5, 14); this.supp = 0; this.flinch = 0; this.shoutT = rnd(3, 12);
    this.boat = null; this.off = null; this.leave = 0; this.moving = false; this.crouchRun = false;
    this.speedMul = rnd(.88, 1.1); this.flee = false; this.removed = false; this.aim = 0; this.aimW = 0; this.prev = new V3(); this.vel = new V3();
    this.bound = R() < .5 ? 0 : 1;
    this.wounded = false; this.woundT = 0; this.healer = null; this.healTarget = null; this.healT = 0; this.throwT = 0; this.sweep = 0;
    (team === 'A' ? allies : enemies).push(this);
  }
  chest(out) { return out.set(this.pos.x, this.pos.y + lerp(lerp(1.22, .88, this.crouch), .3, Math.max(this.prone, this.wounded ? 1 : 0)), this.pos.z); }
  head(out) { return out.set(0, .12, 0).applyMatrix4(this.body.neck.matrixWorld); }
  eye(out) { return out.set(this.pos.x, this.pos.y + lerp(lerp(1.62, 1.15, this.crouch), .45, this.prone), this.pos.z); }
  muzzle(out) { const f = .7 + this.prone * .3; return out.set(this.pos.x - Math.sin(this.yaw) * f, this.pos.y + lerp(lerp(1.4, 1.02, this.crouch), .35, this.prone), this.pos.z - Math.cos(this.yaw) * f); }

  damage(a, from, byPlayer, zone, imp) {
    if (!this.alive) return false;
    if (this.remote) { if (byPlayer || NET.host) netHit(this, a, zone === 'blast', !byPlayer); this.flinch = 1; return false; }
    if (this.proxy) { if (byPlayer) netProxyHit(this, a, zone, from || P.pos, (imp && imp.dir) || new V3(0, 0, -1)); this.flinch = 1; return byPlayer ? false : false; }
    if (this.vip) { this.supp = 1; this.flinch = 1; return false; }
    this.hp -= a; this.supp = Math.min(1, this.supp + .6); this.flinch = 1;
    if (this.hp <= 0) {
      if (this.team === 'A' && !this.wounded && zone !== 'head' && zone !== 'blast' && this.state !== 'boat' && R() < .28) { this.becomeWounded(); return false; }
      this.die(from, byPlayer, zone, imp); return true;
    }
    if (from && this.team !== PT && byPlayer) { this.target = P; this.tVis = true; this.duck = true; this.duckT = rnd(.6, 1.4); if (R() < .3) shout('de', 'medic', this.pos); }
    return false;
  }
  becomeWounded() {
    this.wounded = true; this.hp = 1; this.state = 'wounded'; this.woundT = rnd(10, 30); this.dest = null; this.stationary = false;
    if (this.cover) { this.cover.occ--; this.cover = null; }
    hidePart(this.body, 'weapon');
    sfxVoice(this.pos, pick(['scream', 'wail']));
    if (P.pos.distanceTo(this.pos) < 30) shout('en', 'medic', this.pos, { sub: true });
  }
  heal() { this.wounded = false; this.hp = 45; this.state = 'idle'; this.wait = rnd(.5, 2); const p = this.body.parts.find(x => x.name === 'weapon'); if (p) p.hidden = false; }
  die(from, byPlayer, zone, imp) {
    if (!this.alive) return;
    this.alive = false; if (this.state !== 'boat') this.state = 'dead';
    if (NET.host) netAIDeath(this, imp);
    if (this.cover) { this.cover.occ--; this.cover = null; }
    corpses.push(this);
    if (SETTINGS.gore && dist2Cam(this.pos) < 120 * 120) { const bp = this.pos.clone(); for (let i = 0; i < 3; i++) after(.4 + i * 1.2, () => addDecal('blood', bp.clone().add(new V3(rnd(-.5, .5), 0, rnd(-.5, .5))), .9 + i * .45)); }
    const cap = Q.allySlots + Q.enemySlots - Q.allyAlive - Q.enemyAlive - 20;
    while (corpses.length > cap) { const c = corpses.shift(); c.removed = true; c.body.removed = true; if (c.body.rag) { const i = RAGS.indexOf(c.body.rag); if (i >= 0) RAGS.splice(i, 1); } }
    let impulse = imp, dir = null;
    if (from) dir = this.chest(T3).sub(from).normalize();
    if (!impulse && dir) impulse = { dir, power: zone === 'head' ? 1.2 : rnd(1.4, 2.8), joint: zone === 'head' ? 2 : zone === 'legs' ? (R() < .5 ? 10 : 13) : 15 };
    if (impulse && impulse.blast) {
      const d = this.chest(T4).distanceTo(impulse.blast);
      if (d < impulse.power * .55) dismember(this, impulse.blast);
    }
    startRagdoll(this, impulse);
    if (zone === 'head' && dir) { if (R() < .55) helmetOff(this, dir); if (SETTINGS.gore) bloodBurst(this.head(T4), .5); }
    else if (R() < .35) sfxVoice(this.pos, pick(['scream', 'groan', 'yell']));
    onSoldierDeath(this, byPlayer, zone);
  }

  update(dt) {
    if (!this.alive) return;
    if (this.state === 'boat') {
      this.boat.toWorld(this.off, this.pos);
      this.yaw = this.boat.g.rotation.y; this.root.rotation.y = this.yaw;
      this.crouch = lerp(this.crouch, this.boat.open ? 0 : .8, dt * 3);
      this.anim(dt, 0, this.boat.open ? 0 : 1);
      if (this.boat.open) {
        this.leave -= dt;
        if (this.leave <= 0) { this.state = 'move'; this.dest = new V3(this.pos.x + rnd(-1.2, 1.2), 0, this.boat.z - rnd(9, 14)); this.crouchRun = R() < .5; this.thinkT = rnd(1.5, 3); this.body.tint.multiplyScalar(.8); if (R() < .25) shout('en', 'move', this.pos); }
      }
      return;
    }
    this.supp = Math.max(0, this.supp - dt * .2); this.flinch = Math.max(0, this.flinch - dt * 4);
    this.prev.copy(this.pos);
    let sp = 0;
    if (this.state === 'wounded') {
      this.woundT -= dt;
      if (this.woundT <= 0 && !this.healer) { this.die(null, false, 'body'); return; }
      if (!this.healer && this.pos.z > -55) { this.pos.z -= .35 * dt; sp = .3; }
      this.pos.y = Hf(this.pos.x, this.pos.z);
      this.anim(dt, 0, 0);
      if (R() < dt * .12) { sfxVoice(this.pos, pick(['groan', 'wail'])); if (R() < .3 && P.pos.distanceTo(this.pos) < 25) shout('en', 'medic', this.pos); }
      return;
    }
    if (this.dest && !this.stationary) {
      routeWaypoint(this.pos, this.dest, this.wp);
      const isDest = Math.abs(this.wp.x - this.dest.x) < .01 && Math.abs(this.wp.z - this.dest.z) < .01;
      const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < .5) { if (isDest) { this.dest = null; this.onArrive(); } }
      else {
        let v = (this.crouchRun ? 3.3 : 4.6) * this.speedMul;
        if (this.flee) v = 5.2;
        if (this.prone > .5) v = 1.1;
        const depth = WATER_Y - Hf(this.pos.x, this.pos.z);
        if (depth > 0) v *= clamp(1 - depth * .55, .3, 1);
        const step = Math.min(d, v * dt);
        this.pos.x += dx / d * step; this.pos.z += dz / d * step; sp = v;
        this.yaw = angLerp(this.yaw, Math.atan2(-dx, -dz), dt * 8);
      }
    }
    this.moving = sp > .5;
    if (!this.fixedY) {
      if (this.moving) { pushOut(this.pos, .35); applyWire(this.pos, this.prev); }
      this.pos.y = Hf(this.pos.x, this.pos.z);
      if (this.moving && inMinefield(this.pos.x, this.pos.z)) checkMines(this.pos);
    }
    this.vel.subVectors(this.pos, this.prev).multiplyScalar(1 / Math.max(dt, 1e-3));
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
        if (this.kind === 'mg' || this.inBunker || this.role) this.duck = this.role === 'mortar' || (this.supB ? this.supB.supT > 0 : this.supp > .6);
      }
    } else this.duck = false;
    if (this.supB && this.supB.supT > 0) this.duck = true;
    const wantProne = this.forceProne || this.team === 'A' && posted && this.supp > .55 && this.pos.z > -58 && (!this.cover || this.cover.kind !== 'bank');
    this.prone = lerp(this.prone, wantProne ? 1 : 0, dt * 3);
    let wc = 0;
    if (this.moving) wc = this.crouchRun ? .35 : 0;
    else if (posted) wc = this.duck ? 1 : (this.inTrench || this.inBunker || this.kind === 'mg' ? 0 : (this.team === 'A' && this.cover && this.cover.kind === 'bank' ? .55 : .15));
    if (this.role === 'mortar' || this.healT > 0) wc = 1;
    this.crouch = lerp(this.crouch, wc, dt * 6);
    const firing = !this.duck && !this.moving && this.target && this.tVis && !this.flee && !this.role && !this.healTarget;
    this.aimW = lerp(this.aimW, firing || (this.target && !this.moving) ? 1 : 0, dt * 5);
    if (firing) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        if (this.burst <= 0) { this.burst = Math.round(rnd(this.w.burst[0], this.w.burst[1])); if (this.kind === 'mg' && this.vis.length > 1 && R() < .6) this.target = pick(this.vis); this.sweep = rnd(-1, 1); }
        this.fire(); this.burst--;
        this.fireT = this.burst > 0 ? this.w.bi * rnd(.85, 1.15) : rnd(this.w.rate[0], this.w.rate[1]) * (this.team === 'A' ? 1 : 1 / Math.max(.6, D.acc));
      }
    }
    this.throwT = Math.max(0, this.throwT - dt);
    if (this.healTarget) {
      const w = this.healTarget;
      if (!w.alive || !w.wounded) this.healTarget = null;
      else if (this.pos.distanceTo(w.pos) < 1.4) { this.dest = null; this.healT += dt; if (this.healT > 5) { w.heal(); w.healer = null; this.healTarget = null; this.healT = 0; } }
    }
    const far = dist2Cam(this.pos) > 160 * 160;
    if (!far || (CROWD.frame + this.id) % 3 === 0) this.anim(far ? dt * 3 : dt, sp, 0);
  }

  anim(dt, sp, boatW) {
    const b = this.body, run = clamp(sp / 4.5, 0, 1), cr = this.crouch, pr = this.prone, wd = this.wounded ? 1 : 0;
    this.ph += dt * (3 + sp * 2.1);
    const s = Math.sin(this.ph), c = Math.cos(this.ph), still = run < .1;
    let hy = (still ? lerp(.95, .56, cr) : lerp(.95, .78, cr)) + Math.abs(c) * .05 * run;
    hy = lerp(hy, .2, Math.max(pr, wd));
    b.hips.position.set(0, hy, 0);
    b.hips.rotation.set(-PI / 2 * .93 * pr + PI / 2 * .9 * wd, s * .06 * run, 0);
    const crawl = pr * Math.min(1, sp);
    const base = still ? cr * 1.45 : cr * .45;
    b.hipL.rotation.set((s * .8 * run + base) * (1 - pr) + s * .3 * crawl + wd * (.3 + Math.sin(this.ph * .7) * .2), 0, -.04 - pr * .12);
    b.hipR.rotation.set((-s * .8 * run + base) * (1 - pr) - s * .3 * crawl + wd * .6, 0, .04 + pr * .12);
    const kb = still ? cr * 2.3 : cr * .7;
    b.knL.rotation.x = -((Math.max(0, Math.sin(this.ph + 1.6)) * 1.25 * run + kb) * (1 - pr) + Math.max(0, s) * .8 * crawl + wd * .7);
    b.knR.rotation.x = -((Math.max(0, Math.sin(this.ph + 1.6 + PI)) * 1.25 * run + kb) * (1 - pr) + Math.max(0, -s) * .8 * crawl + wd * 1.1);
    const fl = this.flinch * .35;
    b.spine.rotation.set((-(.15 * run + cr * (still ? .3 : .45)) + this.aim * .7) * (1 - pr) + pr * .35 + fl - wd * .3, s * .08 * run, 0);
    b.neck.rotation.set(-this.aim * .3 + pr * .7 - fl * .5 + wd * .5, 0, 0);
    if (wd) { solveArm(SH_R, T5.set(.06, .1, -.2), POLE_R, b.shR, b.elR); solveArm(SH_L, T5.set(-.06, .12, -.2), POLE_L, b.shL, b.elL); return; }
    poseWeapon(b, this.aimW, this.kind === 'mg' && this.moving ? 1 : 0, boatW);
    if (this.throwT > 0) { const k = 1 - this.throwT / .7; solveArm(SH_R, T5.set(.22, lerp(.75, .5, k), lerp(.25, -.55, k)), POLE_R, b.shR, b.elR); }
  }

  think() {
    if (!this.alive || this.state === 'boat' || this.removed || this.state === 'wounded') return;
    this.findTarget();
    if (this.team === 'A') this.thinkAlly(); else this.thinkEnemy();
    this.shoutT -= this.thinkDt;
  }
  findTarget() {
    const r = this.w.range, me = this.pos, cands = [];
    const opp = this.team === 'A' ? enemies : allies;
    for (const o of opp) {
      if (!o.alive || o.state === 'boat' || o.flee || o.removed) continue;
      const dx = o.pos.x - me.x, dz = o.pos.z - me.z, d2 = dx * dx + dz * dz;
      if (d2 < r * r) cands.push([o, d2]);
    }
    if (this.team !== PT && P.targetable()) { const d2 = P.pos.distanceToSquared(me); if (d2 < r * r) cands.push([P, d2 * .5]); }
    cands.sort((a, b) => a[1] - b[1]);
    const had = this.target;
    this.target = null; this.tVis = false; this.vis.length = 0;
    const eye = this.eye(T1), nTest = this.kind === 'mg' ? 5 : 2;
    for (let i = 0; i < Math.min(nTest, cands.length); i++) {
      const c = cands[i][0];
      if (losClear(eye, c.chest(T2))) { this.vis.push(c); if (!this.target) { this.target = c; this.tVis = true; } }
    }
    if (!this.target && cands.length) this.target = cands[0][0];
    if (!this.target && this.team === 'E') {
      const bs = WORLD.boats.filter(b => b.state === 'move' && b.z < 230 && Math.abs(b.x - me.x) < 130);
      if (bs.length) { this.target = { isBoat: true, b: pick(bs), chest: function (o) { const g = this.b.g.position; return o.set(g.x + rnd(-1.4, 1.4), g.y + rnd(.6, 2), g.z - 5 + rnd(-.3, 2)); } }; this.tVis = true; }
    }
    if (this.tVis && this.target !== had && this.shoutT <= 0 && dist2Cam(this.pos) < 70 * 70) {
      this.shoutT = rnd(10, 25);
      if (this.team === 'E') shout('de', R() < .5 ? 'spot' : 'fire', this.pos);
      else shout('en', R() < .5 ? 'cover' : 'move', this.pos);
    }
  }
  thinkAlly() {
    const Z = MISSION.allyZone;
    if (this.kind === 'medic' && !this.healTarget) {
      let best = null, bd = 30 * 30;
      for (const a of allies) if (a.wounded && a.alive && !a.healer) { const d = a.pos.distanceToSquared(this.pos); if (d < bd) { bd = d; best = a; } }
      if (best) { best.healer = this; this.healTarget = best; this.healT = 0; this.dest = best.pos.clone(); this.state = 'move'; this.crouchRun = true; return; }
    }
    if (this.healTarget) { if (this.healTarget.alive && this.pos.distanceTo(this.healTarget.pos) > 1.4) { this.dest = this.healTarget.pos.clone(); this.state = 'move'; } return; }
    if (this.squad && !P.inBoat && P.mode === 'foot' && P.pos.distanceTo(this.pos) > 28 && this.state !== 'move') this.wait = 0;
    this.nadeT -= this.thinkDt;
    if (this.target && this.target !== P && this.tVis && this.target.inTrench && this.nadeT <= 0 && MISSION.allyNadeCD <= 0) {
      const d = this.target.pos.distanceTo(this.pos);
      if (d > 10 && d < 28) { throwNadeAt(this, this.target.pos, 'A'); this.nadeT = rnd(20, 40); MISSION.allyNadeCD = rnd(3, 6); if (dist2Cam(this.pos) < 50 * 50) shout('en', 'grenade', this.pos); }
    }
    if (this.state === 'move') return;
    this.wait -= this.thinkDt * (MISSION.suppT > 0 || PT === 'E' ? 3 : 1);
    if (this.wait <= 0 && (Z || Math.abs(this.pos.x) > 215)) {
      // avanzata a sbalzi: metà della squadra copre mentre l'altra si muove, e mai sotto fuoco intenso
      const pinned = this.supp > (MISSION.suppT > 0 ? .55 : .3) && this.cover;
      const myTurn = (Math.floor(GAME.time / 6) + this.bound) % 2 === 0 || MISSION.suppT > 0 || !this.cover;
      if (pinned || !myTurn) { this.wait = rnd(1.2, 2.6); if (pinned && R() < .08 && dist2Cam(this.pos) < 50 * 50) shout('en', 'cover', this.pos); return; }
      this.pickCover(Z);
    }
  }
  pickCover(Z) {
    const p = this.pos;
    if (Math.abs(p.x) > 215 && p.z > -62 && !(Z && Z.defend)) Z = { zMin: -56.8, zMax: 90, xMin: p.x - 45, xMax: p.x + 45, step: 13, wait: (Z && Z.wait) || [2.5, 6] };
    let best = null, bs = -1e9;
    for (const c of covers) {
      if (c.occ >= 2 || c.z > Z.zMax || c.z < Z.zMin || c.x < Z.xMin || c.x > Z.xMax) continue;
      if (Z.kinds && !Z.kinds.includes(c.kind)) continue;
      const dx = c.x - p.x, dz = c.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 50 || dist < 1) continue;
      if (inMinefield(c.x, c.z)) continue;
      let s;
      if (Z.defend) s = -Math.hypot(c.x - Z.cx, c.z - Z.cz) * .25 - dist * .15 + R() * 6;
      else { const prog = p.z - c.z; s = p.z - Z.zMin < 5 ? -dist * .3 + R() * 6 : -Math.abs(prog - Z.step) * .55 - Math.abs(dx) * .25 + R() * 8; }
      s += COVER_Q[c.kind] || 2;
      if (this.supp > .3) s -= dist * .35;
      if (this.squad) { const dp = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); s -= Math.max(0, dp - 12) * .9; }
      if (s > bs) { bs = s; best = c; }
    }
    if (this.cover) { this.cover.occ--; this.cover = null; }
    if (best) { best.occ++; this.cover = best; this.dest = new V3(best.x + rnd(-.35, .35), 0, best.z + rnd(-.2, .3)); }
    else this.dest = new V3(clamp(p.x + rnd(-8, 8), Z.xMin, Z.xMax), 0, clamp(p.z - rnd(3, 12), Z.zMin, Z.zMax));
    this.state = 'move'; this.crouchRun = this.supp > .2 || R() < .45;
  }
  onArrive() {
    if (this.flee) { this.removed = true; this.body.removed = true; this.alive = false; return; }
    const Z = MISSION.allyZone;
    if (this.team === 'A') { this.state = 'cover'; this.wait = Z ? rnd(Z.wait[0], Z.wait[1]) : 4; }
    else if (this.toPost) { this.state = 'post'; this.stationary = true; this.toPost = false; this.inTrench = this.pos.z < -84 && Math.abs(this.pos.z - trenchZ(this.pos.x)) < 2; this.yaw = PI; }
    else { this.state = this.state === 'assault' ? 'assault' : 'post'; this.wait = rnd(3, 7); }
    this.duck = true; this.duckT = rnd(.4, 1.2);
  }
  thinkEnemy() {
    if (this.flee) { if (!this.dest) { this.dest = new V3(this.pos.x + rnd(-40, 40), 0, -540); this.state = 'move'; } return; }
    if (this.toPost && !this.dest && this.objective) { this.dest = this.objective.clone(); this.state = 'move'; this.crouchRun = R() < .6; }
    if (this.state === 'assault' && !this.dest) {
      this.wait -= this.thinkDt;
      if (this.wait <= 0) {
        const o = this.objective, dx = o.x - this.pos.x, dz = o.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 22) this.state = 'hold';
        else {
          const step = Math.min(rnd(10, 22), d - 15), nx = this.pos.x + dx / d * step + rnd(-6, 6), nz = this.pos.z + dz / d * step;
          let best = null, bd = 49;
          for (const c of covers) { const dd = (c.x - nx) ** 2 + (c.z - nz) ** 2; if (dd < bd && c.occ < 2) { bd = dd; best = c; } }
          this.dest = best ? new V3(best.x, 0, best.z - 2) : new V3(nx, 0, nz);
          this.crouchRun = R() < .5;
        }
      }
    }
    const t = this.target;
    if (t && this.tVis && !this.inBunker && this.kind !== 'mg' && !this.moving && !this.role && t.pos) {
      const d = t.pos.distanceTo(this.pos);
      if (d > 9 && d < 30) {
        this.nadeT -= this.thinkDt;
        const cd = t === P ? MISSION.nadeCD : MISSION.eNadeCD;
        if (this.nadeT <= 0 && cd <= 0) {
          throwNadeAt(this, t === P ? P.pos.clone().add(new V3(rnd(-2.5, 2.5) / D.acc, 0, rnd(-2.5, 2.5) / D.acc)) : t.pos, 'E');
          this.nadeT = rnd(18, 32); if (t === P) MISSION.nadeCD = rnd(6, 11) / D.acc; else MISSION.eNadeCD = rnd(3, 6);
          if (dist2Cam(this.pos) < 60 * 60) shout('de', 'grenade', this.pos, { priority: true });
        }
      }
    }
  }

  fire() {
    if (this.supB && this.supB.manned) return;
    const t = this.target, tp = targetChest(t, T2); if (!tp) return;
    const from = this.muzzle(T1), d = from.distanceTo(tp);
    let p = this.w.acc * clamp(1.15 - d / this.w.range, .12, 1);
    if (PT === 'E') p *= this.team === 'E' ? .3 : (t === P ? D.acc : 1.1); // Asse: i camerati IA sparano peggio, gli Americani premono
    else p *= this.team === 'E' ? D.acc : (d > 60 ? .4 : 1.1);
    if (this.supp > .3) p *= .6;
    if (t === P) { p *= P.hitMul(); if (!losClear(from, tp)) p = 0; }
    else if (t.isBoat) p = 0;
    else {
      if (t.crouch > .5) p *= .55; if (t.prone > .5) p *= .4; if (t.inTrench) p *= .5; if (t.moving) p *= .75; if (t.state === 'cover') p *= .75;
      if (t.pos.z > -56.5) p *= 1.15;
      if (t.state === 'move' && t.pos.z > 4 && this.kind === 'mg') p *= 1.25;
    }
    const hit = R() < p, end = T3.copy(tp);
    if (!hit) {
      const sw = this.kind === 'mg' ? this.sweep * 3 + Math.sin(this.burst * .7) * 2 : 0;
      end.x += rnd(-2.2, 2.2) + sw; end.y += rnd(-1.2, 1.6); end.z += rnd(-2.2, 2.2);
      end.sub(from).multiplyScalar(1.5).add(from);
    }
    const dir = T4.subVectors(tp, from).normalize();
    const trc = R() < this.w.tracer && d > 8; if (trc) fxTracer(from, end, this.kind === 'mg' ? 1.6 : 1);
    if (NET.host) netAIShot(this, from, end, trc);
    sfxShot(this.snd, from);
    if (dist2Cam(from) < 180 * 180) fxMuzzle(from, dir, this.kind === 'mg');
    if (hit) {
      const dm = rnd(this.w.dmg[0], this.w.dmg[1]);
      if (t === P) P.damage(dm * D.dmg, from);
      else { const zone = R() < .12 ? 'head' : R() < .2 ? 'legs' : 'body'; const hp = zone === 'head' ? t.head(T5) : tp.clone(); t.damage(dm * (zone === 'head' ? 4 : 1.8), from, false, zone); if (dist2Cam(tp) < 130 * 130) bloodHit(hp, dir, zone === 'head' ? 1.4 : 1); }
    } else {
      if (t === P) P.nearMiss(from, end);
      else if (t.supp !== undefined) t.supp = Math.min(1, t.supp + .2);
      if (t.isBoat) { if (t.b === P.boat || dist2Cam(tp) < 60 * 60) { fxImpact(tp.clone(), 'metal'); sfxImpact(tp, 'metal'); if (R() < .3) sfxRicochet(tp); } }
      else if (R() < .45) {
        const gx = end.x, gz = end.z, gy = Hf(gx, gz), wet = gz > -8 && gy < WATER_Y;
        const ip = new V3(gx, wet ? WATER_Y : gy, gz);
        if (dist2Cam(ip) < 160 * 160) { fxImpact(ip, wet ? 'water' : gz > -58 ? 'sand' : 'dirt'); if (dist2Cam(ip) < 25 * 25) { sfxImpact(ip, wet ? 'water' : 'sand'); if (R() < .15) sfxRicochet(ip); } }
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
function throwNadeAt(s, tgt, team) {
  const from = s.eye(new V3()); from.y += .3;
  const dx = tgt.x - from.x, dz = tgt.z - from.z, dh = Math.hypot(dx, dz), T = 1.1 + dh / 28, dy = Hf(tgt.x, tgt.z) - from.y;
  const v = new V3(dx / T + rnd(-1, 1), (dy + 4.9 * T * T) / T, dz / T + rnd(-1, 1));
  s.duck = false; s.duckT = 1.5; s.throwT = .7;
  const n = spawnNade(from, v, team === 'E' ? 4.2 : 3.8, team, false);
  n.warn = team === 'E';
}

function updateAI(dt) {
  AI_BUDGET.n = 0;
  for (const list of [allies, enemies]) {
    for (const s of list) {
      if (s.removed || !s.alive) continue;
      if (s.remote) { netPuppet(s, dt); continue; }
      if (s.proxy) { netProxy(s, dt); continue; }
      s.update(dt);
      if (s.alive && s.state !== 'boat') {
        s.thinkT -= dt;
        if (s.thinkT <= 0 && AI_BUDGET.n < 30) {
          AI_BUDGET.n++;
          s.thinkDt = dist2Cam(s.pos) > 200 * 200 ? rnd(.9, 1.4) : rnd(.3, .55); s.thinkT = s.thinkDt; s.think();
        }
      }
    }
  }
  for (const list of [allies, enemies]) for (let i = list.length - 1; i >= 0; i--) if (list[i].removed) list.splice(i, 1);
}
