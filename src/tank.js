"use strict";
// ============================================================
//  Panzer IV: guidati dall'IA tedesca o dal giocatore dell'Asse.
//  Distruttibili con bombe, granate navali, bazooka, cariche e mine.
// ============================================================
const TANKS = { list: [], mines: [], hull: null, tur: null, me: null, respawnT: 30 };

function buildPanzerGeo() {
  const c = 0x8a8460, d = 0x55543e, k = 0x2a2a26;
  const h = new MB(); h.mat = 'paint';
  h.add(U.box, c, 0, 1.05, 0, 0, 0, 0, 2.3, .9, 5.9);
  h.add(U.box, c, 0, 1.2, -3.0, -.25, 0, 0, 2.3, .7, .5); h.add(U.box, c, 0, .7, -3.0, .5, 0, 0, 2.3, .6, .4);
  h.add(U.box, c, 0, 1.62, .3, 0, 0, 0, 2.85, .1, 5.6);
  h.add(U.box, c, -.6, 1.55, -2.2, 0, 0, 0, .9, .45, .9); h.add(U.box, k, -.6, 1.6, -2.66, 0, 0, 0, .3, .1, .04);
  for (const sx of [-1, 1]) {
    h.add(U.box, d, sx * 1.25, .6, 0, 0, 0, 0, .5, 1.0, 6.3);
    for (let i = 0; i < 8; i++) h.add(U.cyl12, k, sx * 1.25, .42, -2.45 + i * .7, 0, 0, PI / 2, .3, .52, .3);
    for (let i = 0; i < 4; i++) h.add(U.cyl12, k, sx * 1.15, 1.1, -2 + i * 1.3, 0, 0, PI / 2, .1, .2, .1);
    h.add(U.cyl12, k, sx * 1.25, .85, -3.05, 0, 0, PI / 2, .36, .5, .36); h.add(U.cyl12, k, sx * 1.25, .75, 2.95, 0, 0, PI / 2, .3, .5, .3);
    for (let i = 0; i < 5; i++) h.add(U.box, c, sx * 1.52, 1.15, -2.3 + i * 1.15, 0, 0, sx * .05, .04, .95, 1.1);
  }
  h.add(U.cyl12, k, -.7, 1.35, 3.0, PI / 2, 0, 0, .1, .4, .1); h.add(U.cyl12, k, .7, 1.35, 3.0, PI / 2, 0, 0, .1, .4, .1);
  for (let i = 0; i < 4; i++) h.add(U.box, 0x6a6448, -.6 + i * .4, 1.7, 2.2, 0, 0, 0, .3, .12, .9);
  TANKS.hull = h.buildGroups();
  const t = new MB(); t.mat = 'paint';
  t.add(U.box, c, 0, .5, .2, 0, 0, 0, 1.9, .85, 2.4); t.add(U.box, c, 0, .52, -1.05, -.2, 0, 0, 1.6, .7, .4);
  for (const sx of [-1, 1]) t.add(U.box, c, sx * 1.25, .55, .2, 0, 0, 0, .05, 1.0, 2.7);
  t.add(U.box, c, 0, .55, 1.6, 0, 0, 0, 2.5, 1.0, .05);
  t.add(U.cyl12, c, -.35, 1.05, .9, 0, 0, 0, .38, .3, .38); t.add(U.cyl12, k, -.35, 1.22, .9, 0, 0, 0, .4, .05, .4);
  t.add(U.cyl12, d, 0, .45, -1.4, PI / 2, 0, 0, .14, .5, .14);
  TANKS.tur = t.buildGroups();
  const g = new MB(); g.mat = 'paint';
  g.add(U.cyl12, d, 0, 0, -2.4, PI / 2, 0, 0, .075, 4.6, .075); g.add(U.cyl12, k, 0, 0, -4.75, PI / 2, 0, 0, .13, .32, .13);
  TANKS.gun = g.buildGroups();
}
class Panzer {
  constructor(x, z, yaw) {
    if (!TANKS.hull) buildPanzerGeo();
    this.g = groupMesh(TANKS.hull); this.tg = groupMesh(TANKS.tur); this.gg = groupMesh(TANKS.gun);
    this.tg.position.y = 1.67; this.gg.position.set(0, .48, -1.4); this.tg.add(this.gg); this.g.add(this.tg); scene.add(this.g);
    this.pos = this.g.position; this.pos.set(x, Hf(x, z), z); this.yaw = yaw; this.tyaw = 0; this.gpitch = 0;
    this.alive = true; this.hp = 1500; this.speed = 0; this.reload = rnd(2, 4); this.mgT = 0; this.player = false; this.gunnerAlive = false;
    this.box = { min: new V3(), max: new V3() }; this.goal = null; this.lane = rnd(-7, 7); this.aiT = 0; this.target = null; this.tank = true;
    this.eng = loopSound('eng_boat', 0);
    MISSION.vehicles.push(this); TANKS.list.push(this);
  }
  muzzle(o) { this.g.updateMatrixWorld(true); return o.set(0, 0, -4.9).applyMatrix4(this.gg.matrixWorld); }
  aimDir(o) { this.g.updateMatrixWorld(true); return o.set(0, 0, -1).transformDirection(this.gg.matrixWorld); }
  fireMain(byPlayer) {
    if (this.reload > 0) return; this.reload = byPlayer ? 3.6 : rnd(6, 9);
    const o = this.muzzle(new V3()), d = this.aimDir(new V3());
    if (!byPlayer) { d.x += rnd(-.012, .012); d.y += rnd(-.008, .012); d.normalize(); }
    PS_FIRE.emit(o.x, o.y, o.z, d.x * 6, d.y * 6, d.z * 6, .2, 2.4, 4, 1, 4, 2.5, 1.2);
    for (let i = 0; i < 6; i++) PS_SMOKE.emit(o.x, o.y, o.z, d.x * rnd(2, 6) + rnd(-1, 1), rnd(0, 1.5), d.z * rnd(2, 6) + rnd(-1, 1), rnd(2, 3.5), .8, 3.5, .55, .55, .55, .55, .8, -.05);
    for (let i = 0; i < 10; i++) PS_GRAIN.emit(this.pos.x + rnd(-3, 3), this.pos.y + .2, this.pos.z + rnd(-3, 3), rnd(-3, 3), rnd(1, 3), rnd(-3, 3), .8, .05, .05, .6, ...C_DIRT, .4, 9.8);
    sfxBoom(o, 1.4); flashLight(o, 0xffb060, 40, .1);
    if (byPlayer) { P.shake += .5; this.kick = 1; }
    let p;
    if (byPlayer) { const r = hitscan(o.clone().addScaledVector(d, 1), d, 1200); p = o.clone().addScaledVector(d, r.t + 1); }
    else { const tp = this.target === P ? P.pos : this.target ? this.target.pos : o.clone().addScaledVector(d, 200); const dist = tp.distanceTo(o); p = tp.clone().add(new V3(rnd(-1, 1) * dist * .03, 0, rnd(-1, 1) * dist * .03)); }
    fxTracer(o, p, 2);
    after(Math.min(1.2, p.distanceTo(o) / 700), () => { p.y = Math.max(p.y, Hf(p.x, p.z)); explode(p, 6, 420, { byPlayer, bomb: true }); });
  }
  fireMG(byPlayer) {
    if (this.mgT > 0) return; this.mgT = .07;
    const o = this.muzzle(new V3()).addScaledVector(this.aimDir(new V3()), -3.2), d = this.aimDir(new V3());
    d.x += rnd(-.01, .01); d.y += rnd(-.008, .008); d.normalize();
    if (!byPlayer) { const t = this.target; if (!t) return; const tp = t === P ? P.chest(new V3()) : t.chest(new V3()); if (R() < .4) fxTracer(o, tp.clone().add(new V3(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2))), 1.2); sfxShot('mg42', o); if (R() < .12) { if (t === P) P.damage(rnd(20, 35) * D.dmg, o); else t.damage(rnd(30, 60), o, false, 'body'); } else if (t === P) P.nearMiss(o, tp); return; }
    const r = hitscan(o, d, 600), p = o.clone().addScaledVector(d, r.t);
    if (R() < .5) fxTracer(o, p, 1.3, byPlayer); sfxShot('mg42', o, byPlayer);
    if (r.type === 'enemy') { const killed = r.obj.damage(70, o, byPlayer, r.zone, { dir: d, power: 2.4, joint: r.joint }); if (byPlayer) hitMarker(killed, r.zone === 'head'); bloodHit(p, d, 1); }
    else if (r.type === 'terrain') fxImpact(p, 'dirt');
  }
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a;
    if (this.player && a > 50) { P.shake += .6; P.hurt = Math.min(1, P.hurt + .3); }
    if (this.hp > 0) return;
    this.alive = false; burnMeshes(this.g); this.tg.rotation.z = rnd(-.4, .4); this.tg.position.y += .4;
    const p = this.pos.clone(); p.y += 2; fxExplosion(p, 3, false); sfxBoom(p, 3); fxDebris(p, 30, 3);
    const e = addEmitter(p, 'fire', 1.4); e.life = 120; addEmitter(p.clone().add(new V3(0, 2, 0)), 'smoke', 1.5).life = 160;
    if (this.eng) this.eng.at(this.pos, 0, 0, 1);
    if (byPlayer) { STATS.kills += 5; feed('Panzer IV distrutto!'); }
    else if (P.mode === 'foot' && P.pos.distanceTo(p) < 200) feed('Un Panzer è stato distrutto');
    if (this.player) { leaveTank(); P.damage(300, p, true); }
  }
  update(dt) {
    if (!this.alive) return;
    this.reload -= dt; this.mgT -= dt; this.kick = Math.max(0, (this.kick || 0) - dt * 3);
    if (this.player) this.drive(dt); else this.think(dt);
    // terreno, collisioni, inclinazione
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.pos.x += fx * this.speed * dt; this.pos.z += fz * this.speed * dt;
    // i carri schiacciano sacchi e ostacoli bassi
    const tk = this.pos.clone(); tk.y += 1.25; pushOut(tk, 2.4, 1.4); this.pos.x = tk.x; this.pos.z = tk.z;
    this.pos.x = clamp(this.pos.x, -MAPX + 30, MAPX - 30); this.pos.z = clamp(this.pos.z, -MAPX + 60, -62);
    const yf = Hf(this.pos.x + fx * 2.5, this.pos.z + fz * 2.5), yb = Hf(this.pos.x - fx * 2.5, this.pos.z - fz * 2.5);
    const yl = Hf(this.pos.x - fz * 1.3, this.pos.z + fx * 1.3), yr = Hf(this.pos.x + fz * 1.3, this.pos.z - fx * 1.3);
    this.pos.y = (yf + yb + yl + yr) / 4;
    this.g.rotation.set(Math.atan2(yf - yb, 5) - this.kick * .03, this.yaw, Math.atan2(yl - yr, 2.6), 'YXZ');
    this.tg.rotation.y = this.tyaw; this.gg.rotation.x = this.gpitch;
    this.box.min.set(this.pos.x - 2.2, this.pos.y, this.pos.z - 2.2); this.box.max.set(this.pos.x + 2.2, this.pos.y + 2.6, this.pos.z + 2.2);
    if (this.eng) this.eng.at(this.pos, .6 + Math.abs(this.speed) * .06, .55 + Math.abs(this.speed) * .05, 120);
    if (Math.abs(this.speed) > 1 && R() < dt * 6) PS_SMOKE.emit(this.pos.x + rnd(-1.5, 1.5), this.pos.y + .3, this.pos.z + rnd(-1.5, 1.5), 0, .5, 0, 1.5, .6, 2.5, .6, ...C_DIRT, 1);
    for (const m of TANKS.mines) if (!m.done && Math.abs(m.x - this.pos.x) < 1.8 && Math.abs(m.z - this.pos.z) < 2.6) { m.done = true; scene.remove(m.mesh); const p = new V3(m.x, Hf(m.x, m.z), m.z); explode(p, 5, 300, {}); this.damage(1100, false); feed('Un Panzer è saltato su una mina'); }
  }
  // IA: raggiunge una posizione di tiro dietro la linea e ingaggia la fanteria nemica
  think(dt) {
    this.aiT -= dt;
    if (!this.goal) this.aiT = 0;
    if (this.aiT <= 0) {
      this.aiT = 1.2;
      if (!this.goal) { const gz = MISSION.stage >= 5 || (PT === 'E' && MISSION.stage >= 3) ? -235 : -112; this.goal = new V3(roadPathX(gz) + rnd(-50, 50), 0, gz + rnd(-8, 8)); }
      let best = null, bd = 260 * 260;
      for (const a of allies) { if (!a.alive || a.state === 'boat') continue; const d2 = a.pos.distanceToSquared(this.pos); if (d2 < bd) { bd = d2; best = a; } }
      if (PT === 'A' && P.targetable() && P.pos.distanceToSquared(this.pos) < bd * 1.3) best = P;
      this.target = best;
    }
    const g = this.goal, dx = g.x - this.pos.x, dz = g.z - this.pos.z, d = Math.hypot(dx, dz);
    let want = 0;
    if (d > 4) { const path = d > 40 && Math.abs(this.pos.x - roadPathX(this.pos.z)) < 30 ? new V3(roadPathX(this.pos.z + 12) + (this.pos.z > -150 || this.pos.z < -360 ? this.lane : 0), 0, this.pos.z + 12) : g; want = 6; this.yaw = angLerp(this.yaw, Math.atan2(-(path.x - this.pos.x), -(path.z - this.pos.z)), dt * .8); }
    this.speed = lerp(this.speed, want, dt * .8);
    if (this.target) {
      const tp = this.target.pos, rel = Math.atan2(-(tp.x - this.pos.x), -(tp.z - this.pos.z)) - this.yaw;
      this.tyaw = angLerp(this.tyaw, rel, dt * .9);
      const hd = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z); this.gpitch = lerp(this.gpitch, Math.atan2(tp.y + 1 - this.pos.y - 2.1, hd) + hd * .00004, dt * 2);
      if (Math.abs(angDiff(this.tyaw, rel)) < .05 && this.speed < 2) this.fireMain(false);
      if (hd < 140 && R() < dt * 3) this.fireMG(false);
    }
  }
  drive(dt) {
    const th = (KEYS.KeyW ? 1 : 0) - (KEYS.KeyS ? 1 : 0), st = (KEYS.KeyA ? 1 : 0) - (KEYS.KeyD ? 1 : 0);
    this.speed = lerp(this.speed, th * (th > 0 ? 10 : 4), dt * (th ? .7 : 1.5));
    this.yaw += st * dt * .55 * (this.speed < 0 ? -1 : 1) * (Math.abs(this.speed) > .5 || th ? 1 : .6);
    if (mouseL) this.fireMain(true);
    if (KEYS.KeyF || KEYS.Space) this.fireMG(true);
  }
}

// ---------- giocatore nel carro ----------
function tankInteractables() {
  if (PT !== 'E' || P.mode !== 'foot') return [];
  return TANKS.list.filter(t => t.alive && !t.player).map(t => ({ pos: t.pos, r: 4, label: 'Premi E per salire sul Panzer IV', active: () => true, done: () => enterTank(t) }));
}
function enterTank(t) {
  t.player = true; TANKS.me = t; P.mode = 'tank'; t.tyaw = 0; t.gpitch = 0;
  showMsg('Panzer IV — W/S/A/D guida · mouse torretta · click sx cannone · F mitragliatrice · E esci', 4);
  $('stHud').style.display = 'block';
}
function leaveTank() {
  const t = TANKS.me; if (!t) return;
  t.player = false; TANKS.me = null; t.goal = null; P.mode = 'foot'; $('stHud').style.display = 'none';
  P.pos.set(t.pos.x + Math.cos(t.yaw) * 3, 0, t.pos.z - Math.sin(t.yaw) * 3); P.pos.y = Hf(P.pos.x, P.pos.z);
  camera.fov = SETTINGS.fov; camera.updateProjectionMatrix();
}
function tankMouse(mx, my) { const t = TANKS.me; if (!t) return; const s = .0021 * SETTINGS.sens * (camera.fov / 60); t.tyaw -= mx * s; t.gpitch = clamp(t.gpitch - my * s, -.14, .35); }
function updateTankMode(dt) {
  const t = TANKS.me; if (!t || !t.alive) { leaveTank(); return; }
  P.pos.copy(t.pos); P.pos.y += 1.4;
  const ay = t.yaw + t.tyaw, zoom = P.adsHeld;
  if (zoom) { const o = t.muzzle(new V3()).addScaledVector(t.aimDir(new V3()), -3.8); o.y += .35; camera.position.copy(o); camera.rotation.set(t.gpitch + t.g.rotation.x * 0, ay, 0, 'YXZ'); }
  else { camera.position.set(t.pos.x + Math.sin(ay) * 10, t.pos.y + 5.2, t.pos.z + Math.cos(ay) * 10); camera.rotation.set(t.gpitch - .2, ay, 0, 'YXZ'); }
  camera.position.x += rnd(-1, 1) * P.shake * .05; camera.position.y += rnd(-1, 1) * P.shake * .05; P.shake = Math.max(0, P.shake - dt * 2);
  const fov = zoom ? 18 : 70; if (Math.abs(camera.fov - fov) > .1) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 8)); camera.updateProjectionMatrix(); }
  $('stHud').innerHTML = `<b>Panzer IV</b> — scafo ${Math.max(0, Math.round(t.hp / 15))}% · ${Math.round(Math.abs(t.speed) * 3.6)} km/h · ${t.reload > 0 ? 'cannone in ricarica ' + t.reload.toFixed(1) + ' s' : '<b class="ok">CANNONE PRONTO</b>'}<br><small>W/S/A/D guida · mouse torretta · click sx cannone · click dx mirino · F mitragliatrice · E esci</small>`;
}
// ---------- schieramento ----------
function initTanks() {
  if (NET.client) return;
  for (let i = 0; i < (PT === 'E' ? 3 : 2); i++) new Panzer(roadPathX(-520) + (i - 1) * 8, -520 - i * 12, PI);
  // mine anticarro posate dagli Americani sulle strade verso la costa
  const mg = new THREE.CylinderGeometry(.3, .3, .08, 12);
  for (const z of [-150, -250]) for (let k = 0; k < 3; k++) {
    const x = roadPathX(z) + rnd(-7, 7), zz = z + rnd(-6, 6), m = new THREE.Mesh(mg, MAT.vc);
    m.position.set(x, Hf(x, zz) + .03, zz); scene.add(m); TANKS.mines.push({ x, z: zz, mesh: m, done: false });
  }
}
function updateTanks(dt) {
  if (NET.client) return;
  TANKS.respawnT -= dt;
  const alive = TANKS.list.filter(t => t.alive).length, cap = PT === 'E' ? 3 : (MISSION.stage >= 3 ? 2 : 1);
  if (TANKS.respawnT <= 0 && alive < cap) { TANKS.respawnT = 90; new Panzer(roadPathX(-560) + rnd(-6, 6), -560, PI); if (P.mode === 'foot' && PT === 'A') say(N.radio, 'Attenzione: carri tedeschi in movimento dalla città!'); }
}
