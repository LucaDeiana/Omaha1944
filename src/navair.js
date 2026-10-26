"use strict";
// ============================================================
//  Aerei nelle battaglie navali: caccia, bombardieri in picchiata
//  e aerosiluranti guidati dall'IA, contraerea delle navi, squadriglie
//  chiamate dal giocatore (Y) e passaggio ai comandi di un aereo (P).
// ============================================================
const NAIR = { aaRamp: 1, bombs: [], strikeT: 0, aaT: 0, flyT: 0 };
const NA_ROLE = { zero: 'fighter', p40: 'fighter', f4u: 'fighter', bf109: 'fighter', fw190: 'fighter', val: 'dive', sbd: 'dive', stuka: 'dive', kate: 'torpedo', tbf: 'torpedo', ju88: 'dive' };
const _na1 = new V3(), _na2 = new V3(), _naUp = new V3(0, 1, 0);

class NavPlane {
  constructor(type, team, pos, yaw, o = {}) {
    this.type = type; this.team = team; this.role = o.role || NA_ROLE[type] || 'fighter'; this.navy = true;
    const sp = PLANE_SPECS[type] || {}; this.name = sp.name || type;
    this.g = makePlaneModel(type); this.props = this.g.userData.props || []; scene.add(this.g);
    this.pos = this.g.position; this.pos.copy(pos); this.q = this.g.quaternion;
    this.vmax = (PLANE_VMAX[type] || 500) / 3.6; this.spd = this.vmax * .8;
    this.vel = new V3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(this.spd);
    this.hp = (sp.hp || 800) * .55; this.alive = true; this.crash = false; this.roll = 0;
    this.target = o.target || null; this.state = 'ingress'; this.armed = this.role !== 'fighter'; this.fireT = 0; this.cruise = o.alt || (this.role === 'dive' ? 2800 : this.role === 'torpedo' ? 400 : 1500);
    this.turn = this.role === 'fighter' ? .75 : .42; this.t = 0; this.squad = o.squad || null;
    PLANES.push(this);
  }
  // sterza verso una direzione con velocità angolare limitata e inclina le ali
  steer(want, dt) {
    want = want.clone(); const cur = this.vel.clone().normalize(), ang = Math.acos(clamp(cur.dot(want), -1, 1));
    const nv = ang > 1e-4 ? cur.clone().lerp(want, Math.min(1, this.turn * dt / ang)).normalize() : cur.clone();
    const lat = new V3().crossVectors(cur, nv).y; this.roll = lerp(this.roll, clamp(-lat / Math.max(dt, 1e-3) * 1.1, -1.3, 1.3), dt * 3);
    this.vel.copy(nv).multiplyScalar(this.spd);
  }
  orient() {
    const f = _na2.copy(this.vel).normalize(), yaw = Math.atan2(-f.x, -f.z), pitch = Math.asin(clamp(f.y, -1, 1));
    this.q.setFromEuler(new THREE.Euler(pitch, yaw, -this.roll, 'YXZ'));
    for (const p of this.props) p.rotation.z += .9;
  }
  foes() { return NV.ships.filter(s => s.team !== this.team && !s.sinking); }
  update(dt) {
    if (!this.alive) return;
    this.t += dt;
    if (this.crash) {
      // caduta: avvitamento con fumo, poi colonna d'acqua o esplosione sull'isola
      this.vel.y -= 9.8 * dt; this.roll += dt * 2.5; this.pos.addScaledVector(this.vel, dt); this.orient();
      if (this.pos.y < Math.max(WATER_Y, navyH(this.pos.x, this.pos.z))) { const p = this.pos.clone(); if (p.y < WATER_Y + 1) { for (let i = 0; i < 10; i++) PS_SMOKE.emit(p.x, WATER_Y, p.z, rnd(-3, 3), rnd(6, 16), rnd(-3, 3), rnd(1.5, 3), 1.5, 7, .7, .93, .96, .98, .2, 9.81); play('imp_water', p, { ref: 60 }); } else { fxExplosion(p, 2, false); sfxBoom(p, 2); } this.remove(); }
      return;
    }
    let want = null, alt = this.cruise;
    const tgt = this.target && !this.target.sinking ? this.target : (this.target = this.pickShip());
    if (this.role === 'fighter') want = this.fighterAI(dt);
    else if (tgt) want = this.role === 'dive' ? this.diveAI(tgt, dt) : this.torpAI(tgt, dt);
    if (!want) { // senza bersaglio: orbita sopra la propria flotta
      const c = this.home(); want = _na1.set(c.x - this.pos.x, 0, c.z - this.pos.z); if (want.length() < 1500) want.set(-this.vel.z, 0, this.vel.x); want.normalize();
    }
    // quota: si porta alla quota voluta se la manovra non la impone già
    const ah = this.pos.clone().addScaledVector(this.vel, 3), gy = Math.max(navyH(ah.x, ah.z), navyH(this.pos.x, this.pos.z), WATER_Y);
    if (gy > WATER_Y + 2) { alt = Math.max(alt, gy + 90); if (this.pos.y < gy + 70) { this.hold = true; } }
    if (this.hold !== false) { const dy = clamp((alt - this.pos.y) * .004, -.35, .45); want.y = dy; want.normalize(); }
    this.hold = true;
    this.spd = lerp(this.spd, this.vmax * (this.state === 'dive' ? 1.05 : .82), dt * .5);
    this.steer(want, dt); this.pos.addScaledVector(this.vel, dt); this.orient();
    if (this.pos.y < Math.max(WATER_Y, navyH(this.pos.x, this.pos.z)) + 8) { this.hp = 0; this.die(false); }
    // rombo che passa vicino alla camera
    if (dist2Cam(this.pos) < 220 * 220 && (this.flyT || 0) < GAME.time) { this.flyT = GAME.time + 6; play(this.role === 'dive' && this.state === 'dive' ? 'dive' : 'flyby', this.pos, { ref: 120, vol: .9 }); }
  }
  home() { const own = NV.ships.find(s => s.team === this.team && !s.sinking); return own ? own.pos : new V3(0, 0, 0); }
  pickShip() {
    const fs = this.foes(); if (!fs.length) return null;
    // aerosiluranti e bombardieri preferiscono le navi grandi
    return fs.slice().sort((a, b) => (b.C.L - a.C.L) * .02 + (a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos)) / 4000)[0];
  }
  // bombardiere in picchiata: avvicinamento in quota, picchiata a ~70° sul punto futuro della nave, sgancio a ~600 m, richiamata
  diveAI(T, dt) {
    const d = Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
    if (this.state === 'ingress') { if (this.armed && d < this.pos.y * .45 + 200) { this.state = 'dive'; } return _na1.set(T.pos.x - this.pos.x, 0, T.pos.z - this.pos.z).normalize(); }
    if (this.state === 'dive') {
      const tf = Math.sqrt(2 * Math.max(50, this.pos.y) / 9.8) * .55, aim = T.pos.clone().addScaledVector(T.vel, tf);
      this.hold = false;
      if (this.pos.y < 650 || d < 60) { this.dropBomb(T); this.state = 'egress'; this.egT = 25; }
      return aim.sub(this.pos).normalize();
    }
    this.egT -= dt; if (this.egT <= 0) { this.state = 'ingress'; this.armed = this.ammo > 0; if (!this.armed) this.role = 'fighter'; }
    this.cruise = 1200; return _na1.set(this.pos.x - T.pos.x, 0, this.pos.z - T.pos.z).normalize();
  }
  // aerosilurante: discesa a 40 m, corsa verso il punto d'intercettazione, lancio a ~1 km, disimpegno
  torpAI(T, dt) {
    const d = Math.hypot(T.pos.x - this.pos.x, T.pos.z - this.pos.z), tv = (this.type === 'kate' ? 42 : 33) * KN;
    if (this.state === 'ingress' && this.armed) {
      this.cruise = d < 6000 ? 40 : 300;
      let tt = d / tv; const P = T.pos.clone().addScaledVector(T.vel, tt + d / this.spd);
      if (d < 1100 && this.pos.y < 90) { this.dropTorp(P); this.state = 'egress'; this.egT = 30; }
      return P.sub(this.pos).setY(0).normalize();
    }
    this.cruise = 500; this.egT = (this.egT || 20) - dt; if (this.egT <= 0) { this.state = 'ingress'; this.armed = false; this.role = 'fighter'; }
    return _na1.set(this.pos.x - T.pos.x, 0, this.pos.z - T.pos.z).normalize();
  }
  // caccia: insegue l'aereo nemico più vicino (anche quello del giocatore), altrimenti mitraglia le navi
  fighterAI(dt) {
    let best = null, bd = 6000;
    for (const p of PLANES) if (p.team !== this.team && p.alive && !p.crash) { const d = p.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = p; } }
    this.fireT -= dt;
    if (best) {
      const lead = best.pos.clone().addScaledVector(best.vel, bd / 800), want = lead.sub(this.pos).normalize(), cur = _na2.copy(this.vel).normalize();
      this.hold = false; this.cruise = best.pos.y;
      if (bd < 600 && cur.dot(want) > .993 && this.fireT <= 0) {
        this.fireT = .12; const o = this.pos.clone().addScaledVector(cur, 6); fxTracer(o, best.pos.clone().add(new V3(rnd(-5, 5), rnd(-4, 4), rnd(-5, 5))), 1.3);
        if (dist2Cam(o) < 1500 * 1500) sfxShot(this.team === 'E' ? 'mg42' : 'm2', o);
        if (R() < .12 * (1 - bd / 700)) best.damage(rnd(18, 40), false);
      }
      return want;
    }
    // mitragliamento: passaggio basso sulla nave più vicina
    const fs = this.foes(); if (!fs.length) return null;
    const s = fs.reduce((a, b) => a.pos.distanceTo(this.pos) < b.pos.distanceTo(this.pos) ? a : b), d = s.pos.distanceTo(this.pos);
    this.cruise = d < 2500 ? 60 : 600;
    if (d < 900 && this.fireT <= 0) { this.fireT = .15; const o = this.pos.clone(); fxTracer(o, s.pos.clone().add(new V3(rnd(-6, 6), s.C.F, rnd(-20, 20))), 1.2); if (R() < .08) s.damage(rnd(3, 6), null, 'strafe'); if (dist2Cam(o) < 1500 * 1500) sfxShot('m2', o); }
    if (d < 250) this.cruise = 400;
    return s.pos.clone().sub(this.pos).normalize();
  }
  dropBomb(T) {
    if (!this.armed) return; this.armed = false; this.ammo = 0; NAIR.nBombs = (NAIR.nBombs || 0) + 1;
    const m = new THREE.Mesh(BOMB_G(), MAT.paint); m.position.copy(this.pos).add(new V3(0, -1.5, 0)); scene.add(m);
    NAIR.bombs.push({ p: m.position, v: this.vel.clone(), m, by: this, kg: this.type === 'sbd' ? 454 : this.type === 'stuka' ? 500 : 250, life: 40 });
  }
  dropTorp(P) {
    if (!this.armed) return; this.armed = false; NAIR.nTorps = (NAIR.nTorps || 0) + 1;
    const o = this.pos.clone(); o.y = WATER_Y - 2; const d = P.clone().sub(o).setY(0).normalize(), a = Math.atan2(-d.x, -d.z);
    const mesh = new THREE.Mesh(U.cyl, MAT.vc); mesh.scale.set(.27, 5.5, .27); mesh.rotation.set(PI / 2, a, 0, 'YXZ'); scene.add(mesh);
    NV.torps.push({ p: o, d, v: (this.type === 'kate' ? 42 : 33) * KN, left: 4500, dmg: 1300, by: this, mesh, arm: 0, w: 0 });
    for (let i = 0; i < 8; i++) PS_SMOKE.emit(o.x, WATER_Y, o.z, rnd(-2, 2), rnd(3, 8), rnd(-2, 2), rnd(1, 2), 1, 4, .7, .93, .96, .98, .2, 9.81);
    play('imp_water', o, { ref: 50 });
  }
  damage(a, byPlayer) {
    if (!this.alive || this.crash) return; this.hp -= a;
    if (this.hp <= 0) this.die(byPlayer);
    else if (this.hp < 120 && !this.smoke) { this.smoke = addEmitter(this.pos, 'trail', .8); this.smoke.follow = q => q.copy(this.pos); this.smoke.life = 1e9; }
  }
  die(byPlayer) {
    if (this.crash) return; this.crash = true;
    fxExplosion(this.pos.clone(), 1.2, false);
    if (!this.smoke) { this.smoke = addEmitter(this.pos, 'trail', 1); this.smoke.follow = q => q.copy(this.pos); this.smoke.life = 1e9; }
    if (this.team === 'E') { NAIR.kills = (NAIR.kills || 0) + 1; if (byPlayer) { addScore(150, this.name + ' abbattuto', '#9fe08a'); STATS.kills++; navyRibbon('plane'); } }
  }
  remove() { this.alive = false; scene.remove(this.g); if (this.smoke) this.smoke.life = 0; const i = PLANES.indexOf(this); if (i >= 0) PLANES.splice(i, 1); }
}

// ---------- bombe degli aerei IA e del giocatore sulle navi ----------
function navBombHitShip(p, kg, by) {
  for (const sh of NV.ships) {
    if (sh.sinking) continue; const l = sh.toLocal(p, new V3());
    if (Math.abs(l.x) < sh.C.B / 2 && Math.abs(l.z) < sh.C.L / 2 && l.y < sh.C.F + 12) {
      // colpo diretto sul ponte: perforazione della corazza orizzontale (bomba perforante ~ 0,4 mm per kg)
      const pen = kg * .4 > (Math.abs(l.z) < sh.C.L * .27 ? sh.C.deck : sh.C.deck * .3), dmg = kg * (pen ? 3.2 : 1.1);
      sh.damage(dmg, by && by.team !== sh.team ? (by === PL.me ? NV.me : by) : null, 'bomb'); sh.addFire(l, by === PL.me ? NV.me : null);
      if (pen && Math.abs(l.z) < sh.C.L * .27 && kg >= 400 && R() < .06) sh.sink('magazine');
      if (by === PL.me) { navyHitText((pen ? 'Bomba perfora il ponte! · ' : 'Bomba a segno · ') + Math.round(dmg), '#ffcf5a'); navyRibbon(pen ? 'pen' : 'hit'); }
      fxExplosion(p.clone(), 3 + kg / 200, false); sfxBoom(p, 3);
      if (sh.marks) navyMark(sh, new V3(l.x, sh.C.F, l.z), 1, pen, 300, 'hull');
      return true;
    }
  }
  return false;
}
function updateNavBombs(dt) {
  for (let i = NAIR.bombs.length - 1; i >= 0; i--) {
    const b = NAIR.bombs[i]; b.v.y -= 9.8 * dt; b.v.multiplyScalar(1 - .02 * dt); b.p.addScaledVector(b.v, dt); b.life -= dt; b.m.lookAt(b.p.clone().add(b.v));
    let done = navBombHitShip(b.p, b.kg, b.by);
    if (!done && b.p.y < WATER_Y) { done = true; splash({ S: { cal: 380, he: b.kg * .5 }, by: b.by }, b.p.clone().setY(WATER_Y)); sfxBoom(b.p, 2.5, true); }
    if (done || b.life <= 0) { scene.remove(b.m); NAIR.bombs.splice(i, 1); }
  }
  // bombe del giocatore (sistema dei proiettili generale): urto con le navi
  if (typeof projectiles !== 'undefined') for (let i = projectiles.length - 1; i >= 0; i--) { const q = projectiles[i]; if (q.type !== 'bomb' || !q.byPlayer) continue; if (navBombHitShip(q.p, 454, PL.me) || q.p.y < WATER_Y) { if (q.p.y < WATER_Y) { splash({ S: { cal: 380, he: 200 }, by: NV.me }, q.p.clone().setY(WATER_Y)); sfxBoom(q.p, 2.5, true); } scene.remove(q.m); projectiles.splice(i, 1); } }
}

// ---------- contraerea delle navi ----------
const AA_POWER = { bb: 34, cl: 26, dd: 12, pt: 4, cargo: 2 };
function updateNavAA(dt) {
  NAIR.aaRamp = Math.min(1, NAIR.aaRamp + dt / 90);
  NAIR.aaT -= dt; if (NAIR.aaT > 0) return; NAIR.aaT = .1;
  const pl = PLANES.filter(p => p.alive && !p.crash);
  if (!pl.length) return;
  for (const sh of NV.ships) {
    if (sh.sinking) continue;
    const pow = (AA_POWER[sh.C.type] || 8) * (sh.C.L > 250 ? 1.6 : 1) * (sh.hp / sh.hpMax * .6 + .4) * (.15 + .85 * NAIR.aaRamp);
    let best = null, bd = 4200;
    for (const p of pl) if (p.team !== sh.team) { const d = p.pos.distanceTo(sh.pos); if (d < bd) { bd = d; best = p; } }
    if (!best) continue;
    const near = dist2Cam(sh.pos) < 4000 * 4000;
    // traccianti leggeri e scoppi di fumo nero dei calibri medi attorno all'aereo
    if (R() < pow * .02) { const o = sh.toWorld(rnd(-sh.C.B * .4, sh.C.B * .4), sh.C.F + 4, rnd(-sh.C.L * .3, sh.C.L * .3)); const aim = best.pos.clone().addScaledVector(best.vel, bd / 900).add(new V3(rnd(-25, 25), rnd(-15, 15), rnd(-25, 25))); fxTracer(o, aim, 1.2); if (near && R() < .3) sfxShot('flak', o); }
    if (R() < pow * .012 && bd > 600) { const b = best.pos.clone().addScaledVector(best.vel, rnd(.2, 1.2)).add(new V3(rnd(-60, 60), rnd(-40, 40), rnd(-60, 60))); for (let k = 0; k < 3; k++) PS_SMOKE.emit(b.x + rnd(-3, 3), b.y + rnd(-3, 3), b.z + rnd(-3, 3), rnd(-1, 1), rnd(-.5, .5), rnd(-1, 1), rnd(5, 9), 3, 9, .85, .08, .08, .08, .05, -.02); PS_FIRE.emit(b.x, b.y, b.z, 0, 0, 0, .15, 3, 5, 1, 4, 2.4, 1); if (dist2Cam(b) < 2500 * 2500) play('flak_far', b, { ref: 150, vol: .7 }); }
    // probabilità di colpire: cala con la distanza e con la velocità del bersaglio
    const pk = pow * .00045 * (1 - bd / 4200) ** 1.5 * clamp(1.4 - best.vel.length() / 200, .4, 1);
    if (R() < pk) best.damage(rnd(25, 70), sh === NV.me);
  }
}

// ---------- squadriglia chiamata dal giocatore ----------
function navyCallStrike() {
  if (NAIR.strikeT > 0) { showMsg('Squadriglia pronta tra ' + Math.ceil(NAIR.strikeT) + ' s', 1.5); return; }
  const T = NV.lock || nearestFoe(NV.me); if (!T) { showMsg('Nessun bersaglio per l’attacco aereo', 1.5); return; }
  const de = NV.me.C.nat === 'de', jp = NV.me.C.nat === 'jp';
  const types = de ? ['stuka', 'stuka', 'stuka', 'bf109', 'bf109'] : jp ? ['val', 'val', 'kate', 'kate', 'zero', 'zero'] : ['sbd', 'sbd', 'sbd', 'tbf', 'tbf', 'f4u', 'f4u'];
  const back = NV.me.pos.clone().addScaledVector(NV.me.fwd, -3000), a = Math.atan2(-(T.pos.x - back.x), -(T.pos.z - back.z));
  types.forEach((t, i) => new NavPlane(t, NV.me.team, back.clone().add(new V3((i % 3 - 1) * 60, (NA_ROLE[t] === 'dive' ? 2600 : NA_ROLE[t] === 'torpedo' ? 450 : 1600) + i * 15, Math.floor(i / 3) * 70)), a, { target: T }));
  NAIR.strikeT = 120; showMsg('Squadriglia in volo verso ' + T.name + ' · P per pilotare uno degli aerei', 3); play('flyby', null, { vol: .5 });
}
// passaggio ai comandi: il giocatore prende un aereo amico in volo; P di nuovo per tornare alla nave
function navyTakePlane() {
  if (P.mode === 'plane') { exitPlane(); P.mode = 'ship'; NV.cam.yaw = NV.me.yaw; showMsg('Al comando della nave', 1.5); return; }
  const own = PLANES.filter(p => p.navy && p.team === NV.me.team && p.alive && !p.crash);
  if (!own.length) { showMsg('Nessun aereo amico in volo: chiama una squadriglia con Y', 2); return; }
  const p = own.reduce((a, b) => a.pos.distanceTo(camera.position) < b.pos.distanceTo(camera.position) ? a : b);
  const type = p.type, pos = p.pos.clone(), vel = p.vel.clone(), q = p.q.clone(), armed = p.armed; p.remove();
  enterPlane({ type, pos, vel, q });
  PL.bombs = armed ? 1 : 0; PL.torpedo = NA_ROLE[type] === 'torpedo';
  showMsg('Ai comandi: ' + (PLANE_SPECS[type] ? PLANE_SPECS[type].name : type) + (PL.torpedo ? ' · Spazio: siluro (sotto 90 m e 330 km/h)' : PL.bombs ? ' · Spazio: bomba' : '') + ' · P per tornare alla nave', 4);
}
function navyPlayerTorpedo() {
  const me = PL.me; if (!me || PL.bombs <= 0) return false;
  const kmh = me.vel.length() * 3.6, alt = me.pos.y - WATER_Y;
  if (alt > 90 || kmh > 330) { showMsg('Troppo alto o troppo veloce: il siluro si spezzerebbe (sotto 90 m e 330 km/h)', 2); return true; }
  PL.bombs = 0; const d = me.vel.clone().setY(0).normalize(), o = me.pos.clone(); o.y = WATER_Y - 2;
  const mesh = new THREE.Mesh(U.cyl, MAT.vc); mesh.scale.set(.27, 5.5, .27); mesh.rotation.set(PI / 2, Math.atan2(-d.x, -d.z), 0, 'YXZ'); scene.add(mesh);
  NV.torps.push({ p: o, d, v: 33 * KN, left: 4500, dmg: 1300, by: NV.me, mesh, arm: 0, w: 0 });
  showMsg('Siluro in acqua!', 1.5); play('imp_water', o, { ref: 50 });
  return true;
}
function updateNavAir(dt) {
  NAIR.strikeT = Math.max(0, NAIR.strikeT - dt);
  updateNavBombs(dt); updateNavAA(dt);
  // aereo del giocatore abbattuto o ammarato: si torna alla nave
  if (P.mode === 'plane' && (!PL.me || PL.me.crash) && !NAIR.backT) NAIR.backT = GAME.time + 4;
  if (NAIR.backT && GAME.time > NAIR.backT) { NAIR.backT = 0; if (P.mode === 'plane') exitPlane(); P.mode = 'ship'; P.dead = false; showMsg('Di nuovo al comando della nave', 2); }
}
// ondata aerea nemica da una direzione
function navyAirRaid(types, from, dist, alt = 0) {
  const c = NV.me ? NV.me.pos : new V3(), a = from ?? R() * TAU, team = 'E';
  const base = new V3(c.x + Math.sin(a) * dist, 0, c.z + Math.cos(a) * dist);
  types.forEach((t, i) => { const r = NA_ROLE[t]; new NavPlane(t, team, base.clone().add(new V3((i % 4 - 1.5) * 80, (r === 'dive' ? 3000 : r === 'torpedo' ? 300 : 1800) + alt + i * 12, Math.floor(i / 4) * 90)), a + PI); });
}
