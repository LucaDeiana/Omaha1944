"use strict";
// ============================================================
//  Giocatore: input, movimento, posture, acqua, danni, interazioni,
//  modalità (a piedi / corazzata / aereo), scelta del rientro
// ============================================================
const KEYS = {};
let mouseL = false;
const P = {
  pos: new V3(), prev: new V3(), vel: new V3(), yaw: 0, pitch: 0, vy: 0, grounded: true, mode: 'foot',
  hp: 100, dead: false, deathT: 0, inBoat: true, boat: null,
  stance: 0, eyeH: 1.0, sprint: false, stamina: 1, moveK: 0, bobPh: 0, stepT: 0, swim: false, depth: 0,
  inv: [{ id: 'garand', mag: 8, res: 72 }, null, { id: 'colt', mag: 7, res: 28 }], cur: 0, prevSlot: 2, nades: 4, charges: 0, carry: null, bandages: 2, bandT: 0,
  fireCD: 0, reloadT: 0, reloadDur: 1, switchT: 0, throwT: 0, boltT: 0, flashT: 0, trigger: false, adsHeld: false, adsK: 0, meleeT: 0,
  recoil: 0, kickP: 0, kickY: 0, bloom: 0, shake: 0, hurt: 0, supp: 0, regenT: 0, shock: 0, shockT: 0,
  interacting: false, intT: 0, intTarget: null, ePressed: false, spawnMenu: false,
  slot() { return this.inv[this.cur]; },
  targetable() { return !this.dead && !this.downed && !this.inBoat && (this.mode === 'foot' || this.mode === 'mg' || this.mode === 'mortar' || this.mode === 'flak'); },
  chest(o) { return o.set(this.pos.x, this.pos.y + [1.25, .86, .32][this.stance], this.pos.z); },
  hitMul() {
    let m = .6;
    if (this.mode === 'mg') return .3;
    if (this.stance === 1) m *= .6; else if (this.stance === 2) m *= .35;
    if (this.sprint && this.moveK > .5) m *= .7;
    if (this.swim) m *= .6;
    return m;
  },
  damage(a, from, blast) {
    if (this.dead || MISSION.godT > 0 || !(this.mode === 'foot' || this.mode === 'mg' || this.mode === 'mortar' || this.mode === 'flak')) return;
    this.hp -= a; this.regenT = 5.5;
    this.hurt = Math.min(1, this.hurt + a / 45); this.shake = Math.min(1.5, this.shake + a / 50);
    this.kickP += rnd(.02, .05); this.kickY += rnd(-.04, .04);
    if (from) damageIndicator(from);
    sfxThud(); if (SETTINGS.gore && a > 15) lensSplat('blood', a / 60);
    if (this.hp <= 0) { if (!blast && a < 90 && downPlayer()) return; this.hp = 0; this.die(); }
  },
  nearMiss(from, end) {
    this.supp = Math.min(1, this.supp + .2);
    sfxWhiz(from);
    this.kickY += rnd(-.006, .006); this.kickP += rnd(-.004, .006);
    if (end && end.distanceTo(this.pos) < 4 && R() < .5) { const g = new V3(end.x, Hf(end.x, end.z), end.z); fxImpact(g, g.z > -9 && g.y < WATER_Y ? 'water' : 'sand'); if (R() < .3) lensSplat('dirt', .15); }
  },
  shellShock(k) { this.shock = Math.max(this.shock, k); this.shockT = 1.6 + k * 1.5; this.stance = Math.max(this.stance, k > .7 ? 2 : this.stance); },
  die() {
    if (this.dead) return;
    if (SCEN === 'tun') tunPlayerDied();
    this.dead = true; this.deathT = 0; STATS.deaths++;
    this.trigger = false; mouseL = false; this.adsHeld = false;
    showMsg('Sei stato colpito', 2.5);
  },
};

function initInput() {
  addEventListener('keydown', e => {
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    const first = !KEYS[e.code]; KEYS[e.code] = true;
    if (!GAME.running || !first) return;
    const c = e.code;
    if (CUT.active) { if (c === 'Space' || c === 'Enter') endCutscene(); return; }
    if (P.spawnMenu) { deployKey(c); return; }
    if (P.mode === 'naval' && c === 'KeyE') { leaveTurretToDeck(); return; }
    if ((P.mode === 'mg' || P.mode === 'mortar' || P.mode === 'flak') && stationKey(c)) return;
    if (P.mode === 'tank') { if (c === 'KeyE') leaveTank(); return; }
    if (P.mode === 'airmark') { if (c === 'KeyT' || c === 'KeyE') closeAirMark(); return; }
    if (c === 'KeyT' && P.mode === 'foot') { openAirMark(); return; }
    if (c === 'KeyX' && P.mode === 'foot' && PT === 'A') { cycleOrder(); return; }
    if (c === 'KeyH' && P.mode === 'foot' && !P.dead) { if (P.bandages <= 0) showMsg('Nessuna benda rimasta', 1.5); else if (P.hp >= 95) showMsg('Non sei ferito', 1.5); else if (P.bandT <= 0) { P.bandT = 3; P.bandages--; sfxMech('pick'); showMsg('Ti stai bendando…', 3); } return; }
    if (P.mode === 'ship') { navyKey(c); return; }
    if (c === 'KeyB') { openSpawnMenu(); return; }
    if (P.mode === 'plane' && SCEN === 'sea' && c === 'KeyP') { navyTakePlane(); return; }
    if (P.mode === 'plane') { if (c === 'KeyF' || c === 'Space') planeDropBomb(); if (c === 'KeyV') togglePlaneView(); if (c === 'KeyM') togglePlaneAssist(); if (c === 'KeyG') togglePlaneGear(); if (c === 'KeyT') planeLockToggle(); if (c === 'KeyR' && PL.me && PL.me.crash) { const alive = PL.wreck && PL.wreck.done && !PL.wreck.lethal; exitPlane(); P.mode = 'foot'; if (alive) openSpawnMenu(); else P.die(); } return; }
    if (P.mode === 'naval') return;
    if (c === 'KeyR') startReload();
    else if (c === 'KeyC' || c === 'ControlLeft') { if (!P.swim) P.stance = P.stance === 1 ? 0 : 1; }
    else if (c === 'KeyY' && P.mode === 'foot') spotEnemy();
    else if (c === 'KeyZ') { if (!P.swim && !P.inBoat) P.stance = P.stance === 2 ? 0 : 2; }
    else if (c === 'KeyG') throwPlayerNade();
    else if (c === 'KeyV') playerMelee();
    else if (c === 'Digit1') selectSlot(0);
    else if (c === 'Digit2') selectSlot(1);
    else if (c === 'Digit3') selectSlot(2);
    else if (c === 'KeyQ') selectSlot(P.prevSlot);
    else if (c === 'KeyE') P.ePressed = true;
  });
  addEventListener('keyup', e => { KEYS[e.code] = false; });
  addEventListener('mousemove', e => {
    if (!GAME.running) return;
    if (P.mode === 'mg' || P.mode === 'mortar' || P.mode === 'flak') { stationMouse(e.movementX, e.movementY); return; }
    if (P.mode === 'ship') { navyMouse(e.movementX, e.movementY); return; }
    if (P.mode === 'tank') { tankMouse(e.movementX, e.movementY); return; }
    if (P.mode === 'airmark') { airMouse(e.movementX, e.movementY); return; }
    if (P.mode === 'plane' && PL.assist) { const s = .0013 * SETTINGS.sens; PL.aimYaw -= e.movementX * s; PL.aimPitch = clamp(PL.aimPitch - e.movementY * s, -1.35, 1.35); return; }
    if (P.mode === 'plane') { PL.stickX = clamp(PL.stickX + e.movementX * .0022 * SETTINGS.sens, -1, 1); PL.stickY = clamp(PL.stickY - e.movementY * .0022 * SETTINGS.sens, -1, 1); return; }
    if (P.mode === 'naval') { const s = .0021 * SETTINGS.sens * (camera.fov / 60); NAV.yaw -= e.movementX * s; NAV.pitch = clamp(NAV.pitch - e.movementY * s, -.4, .2); return; }
    const s = .0021 * SETTINGS.sens * (camera.fov / SETTINGS.fov) * (P.shock > .3 ? .5 : 1);
    P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.5, 1.5);
    GL.tx = clamp(GL.tx - e.movementX * .0011, -.11, .11); GL.ty = clamp(GL.ty - e.movementY * .0011, -.08, .08);
    swayX = clamp(swayX - e.movementX * .00011, -.025, .025); swayY = clamp(swayY + e.movementY * .00011, -.025, .025);
  });
  addEventListener('mousedown', e => {
    if (!GAME.running) return;
    if (e.button === 0) { mouseL = true; P.trigger = true; }
    if (e.button === 1 && P.mode === 'foot') { e.preventDefault(); spotEnemy(); }
    if (e.button === 2) { P.adsHeld = true; if (P.mode === 'naval') NAV.zoom = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 0) { mouseL = false; P.trigger = false; } if (e.button === 2) { P.adsHeld = false; NAV.zoom = false; } });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => {
    // in volo la rotella regola la manetta (su = più motore), a passi del 5%
    if (GAME.running && P.mode === 'plane' && PL.me) { PL.throttle = clamp(Math.round((PL.throttle + (e.deltaY < 0 ? .05 : -.05)) * 20) / 20, 0, 1); showMsg('Manetta ' + Math.round(PL.throttle * 100) + '%', .8); return; }
    if (GAME.running && P.mode === 'ship') { navyWheel(e.deltaY); return; }
    if (!GAME.running || P.mode !== 'foot') return;
    const dir = e.deltaY > 0 ? 1 : -1;
    for (let k = 1; k <= 3; k++) { const i = (P.cur + dir * k + 3) % 3; if (P.inv[i]) { selectSlot(i); break; } }
  });
}
function selectSlot(i) {
  if (i === P.cur || !P.inv[i] || P.carry || P.dead) return;
  P.prevSlot = P.cur; P.cur = i; P.switchT = .45; P.reloadT = 0; P.boltT = 0; sfxMech('pick');
}

// ---------- scelta del rientro ----------
function closeSpawnMenu() { P.spawnMenu = false; $('spawn').classList.add('hidden'); }
function leaveMode() {
  if (P.mode === 'mg' || P.mode === 'mortar' || P.mode === 'flak') leaveStation();
  if (P.mode === 'tank') leaveTank();
  if (P.mode === 'airmark') closeAirMark();
  if (P.mode === 'plane') exitPlane();
  if (P.mode === 'naval') exitNaval();
  P.mode = 'foot';
}
function chooseSpawn(kind) {
  if (kind === 'wave' && (MISSION.stage < 1 || MISSION.stage > 4)) return;
  closeSpawnMenu(); leaveMode();
  $('fade').style.opacity = 0;
  if (kind === 'naval') { spawnOnShip(); return; }
  if (kind === 'plane') { enterPlane(); return; }
  if (kind === 'wave') { respawnWave(); return; }
  respawn();
}

const _pp = new V3();
function updatePlayer(dt) {
  MISSION.godT = Math.max(0, MISSION.godT - dt);
  if (P.bandT > 0) { P.bandT -= dt; P.trigger = false; mouseL = false; if (P.bandT <= 0) { P.hp = Math.min(100, P.hp + 45); P.hurt = 0; showMsg('Ferita medicata', 1.5); } }
  P.hurt = Math.max(0, P.hurt - dt * .55); P.supp = Math.max(0, P.supp - dt * .3); P.shake = Math.max(0, P.shake - dt * 1.8);
  P.shockT = Math.max(0, P.shockT - dt); if (P.shockT <= 0) P.shock = Math.max(0, P.shock - dt * .8);
  if (P.mode === 'ship') { updateNavyPlayer(dt); return; }
  if (P.mode === 'naval') { updateNaval(dt); updateViewmodel(dt); return; }
  if (P.mode === 'plane') { updatePlane(dt); updateViewmodel(dt); return; }
  if (P.mode === 'tank') { updateTankMode(dt); updateViewmodel(dt); return; }
  if (P.mode === 'airmark') { updateViewmodel(dt); return; }
  if (P.mode === 'mg' || P.mode === 'mortar' || P.mode === 'flak') { updateStation(dt); updateViewmodel(dt); if (P.mode !== 'foot') return; }
  if (P.dead) {
    P.deathT += dt;
    $('fade').style.opacity = clamp((P.deathT - 1) / 1.4, 0, .85);
    if (P.deathT > 2.6 && !P.spawnMenu) openSpawnMenu();
    updateCamera(dt); updateViewmodel(dt); return;
  }
  P.fireCD -= dt; P.switchT = Math.max(0, P.switchT - dt); P.throwT = Math.max(0, P.throwT - dt); P.meleeT = Math.max(0, P.meleeT - dt);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { P.reloadT = 0; finishReload(); } }
  P.bloom = Math.max(0, P.bloom - dt * .06);
  P.regenT -= dt; if (P.regenT <= 0 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 12);

  const s = P.slot(), w = s ? WEAPONS[s.id] : null;
  const canAds = !P.sprint && !P.swim && !P.carry && P.reloadT <= 0 && P.switchT <= 0 && !P.inBoat;
  P.adsK = clamp(P.adsK + (P.adsHeld && canAds ? 1 : -1) * dt * 7, 0, 1);

  if (P.inBoat) {
    P.boat.toWorld(_pp.set(P.seat ? P.seat.x : 0, .47, P.seat ? P.seat.z : 2.2), P.pos);
    P.moveK = 0;
    if (P.boat.open) { P.inBoat = false; P.pos.y = P.boat.y + .45; onPlayerDisembark(); }
    if (P.boat.state === 'sunk') { P.inBoat = false; P.pos.y = WATER_Y - 1; }
    updateCamera(dt); updateViewmodel(dt); return;
  }

  const f = (KEYS.KeyW ? 1 : 0) - (KEYS.KeyS ? 1 : 0), st = (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0);
  // senza fiato: si torna a correre solo dopo aver recuperato un po' (evita lo scatto on/off a ogni fotogramma)
  if (P.stamina <= .02) P.winded = true; else if (P.stamina > .3) P.winded = false;
  P.sprint = !!KEYS.ShiftLeft && f > 0 && P.stance !== 2 && !P.winded && !P.swim && P.adsK < .3 && P.shock < .5;
  if (P.sprint && P.stance === 1) P.stance = 0;
  let sp = [4.3, 2.2, 1.0][P.stance];
  // strisciata: la spinta arriva quando il braccio sinistro tira il corpo in avanti
  const crawling = P.stance === 2 && (f || st) && !P.swim;
  if (crawling) { P.crawlPh = ((P.crawlPh || 0) + dt * .85) % 1; sp *= P.crawlPh > .35 ? .45 + 1.3 * Math.sin((P.crawlPh - .35) / .65 * PI) : .3; if (P.crawlPh > .35 && P.crawlPh - dt * .85 <= .35) play('bodyfall', null, { vol: .12, rate: 1.6 }); }
  P.crawlK = lerp(P.crawlK || 0, crawling && P.adsK < .3 ? 1 : 0, Math.min(1, dt * 6));
  if (P.sprint) sp = 6.9;
  sp *= (w && w.speedMul) || 1;
  if (P.adsK > .5) sp *= .6;
  if (P.carry) sp *= .85;
  if (P.shock > .3) sp *= .55;
  const g0 = Hf(P.pos.x, P.pos.z), wl = P.pos.z > -10 ? waterLevel(P.pos.x, P.pos.z, GAME.time) : -99;
  let boatFloor = -99;
  P.onShip = P.pos.y > 5 && shipDeckY(P.pos.x, P.pos.z) > -99;
  const shipFloor = P.onShip ? shipDeckY(P.pos.x, P.pos.z) : -99;
  if (P.onShip) boatFloor = shipFloor;
  for (const b of WORLD.boats) if (b.landed && Math.abs(P.pos.x - b.x) < 1.5 && P.pos.z > b.z - 7.1 && P.pos.z < b.z + 5) boatFloor = Math.max(boatFloor, b.y + .45);
  P.depth = Math.max(0, wl - Math.max(g0, boatFloor));
  P.swim = P.depth > 1.4;
  if (P.depth > .15) sp *= clamp(1 - P.depth * .42, .4, 1);
  if (P.swim) { sp = 1.9; P.stance = 0; }
  // ferito: zoppica (passo irregolare e più lento) e la mira trema
  if (P.hp < 45 && !P.downed && !P.dead) {
    const w = 1 - P.hp / 45; sp *= 1 - w * .38 * (.55 + .45 * Math.abs(Math.sin(P.bobPh * .5)));
    if (P.hp < 25) P.sprint = false;
    P.kickY += Math.sin(GAME.time * 1.9) * .0009 * w; P.kickP += Math.sin(GAME.time * 2.7 + 1) * .0007 * w;
  }
  P.stamina = clamp(P.stamina + (P.sprint && (f || st) ? -.16 : .11) * dt, 0, 1);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  let mx = 0, mz = 0;
  if (f || st) { const l = Math.hypot(f, st); mx = (-sy * f + cy * st) / l; mz = (-cy * f - sy * st) / l; }
  if (P.shock > .3) { mx += Math.sin(GAME.time * 1.7) * .3 * P.shock; mz += Math.cos(GAME.time * 1.3) * .3 * P.shock; }
  const acc = P.grounded ? 10 : 2;
  P.vel.x = lerp(P.vel.x, mx * sp, Math.min(1, dt * acc)); P.vel.z = lerp(P.vel.z, mz * sp, Math.min(1, dt * acc));
  P.prev.copy(P.pos);
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  pushOut(P.pos, .38, P.stance === 2 ? .5 : 1.7);
  applyWire(P.pos, P.prev);
  for (const o of OBST) {
    const dx = P.pos.x - o.x, dz = P.pos.z - o.z, d2 = dx * dx + dz * dz, rr = o.r + .3;
    if (d2 < rr * rr && d2 > 0) { const d = Math.sqrt(d2); P.pos.x = o.x + dx / d * rr; P.pos.z = o.z + dz / d * rr; }
  }
  if (P.onShip) { if (shipDeckY(P.pos.x, P.pos.z) < 0) { P.pos.x = P.prev.x; P.pos.z = P.prev.z; } }
  else { P.pos.x = clamp(P.pos.x, -MAPX + 20, MAPX - 20); P.pos.z = clamp(P.pos.z, -MAPX + 60, 115); }
  let ground = Math.max(Hf(P.pos.x, P.pos.z), boatFloor, bunkerStep(P.pos.x, P.pos.z), P.onShip ? Math.max(shipFloor, shipDeckY(P.pos.x, P.pos.z)) : -99);
  if (P.swim) ground = Math.max(ground, wl - 1.4);
  if (KEYS.Space && P.grounded && P.stance === 0 && !P.swim && P.depth < .6) { P.vy = 4.8; P.grounded = false; }
  P.vy -= 18 * dt; P.pos.y += P.vy * dt;
  if (P.pos.y <= ground) { if (!P.grounded && P.vy < -7) { P.shake += .25; play('bodyfall', null, { vol: .4 }); } P.pos.y = ground; P.vy = 0; P.grounded = true; }
  else if (P.grounded && P.pos.y - ground < .7 && P.vy <= 0) { P.pos.y = ground; P.vy = 0; }
  else P.grounded = false;
  if (inMinefield(P.pos.x, P.pos.z)) checkMines(P.pos);
  if (P.depth > .3 && P.moveK > .3 && R() < dt * 3) { PS_GRAIN.emit(P.pos.x + rnd(-.4, .4), wl, P.pos.z + rnd(-.4, .4), rnd(-1, 1), rnd(1, 2.5), rnd(-1, 1), .6, .05, .04, .8, ...C_WATER, .3, 9.8); if (R() < .1) lensSplat('water', .15); }

  const spd = Math.hypot(P.vel.x, P.vel.z);
  P.moveK = clamp(spd / 4.3, 0, 1.6); P.bobPh += dt * spd * 2.3;
  P.stepT -= dt * spd;
  if (P.stepT <= 0 && P.grounded) { P.stepT = P.sprint ? 2.5 : 2.1; sfxStep(P.depth > .1 ? 'water' : Math.abs(P.pos.z - BANK_Z) < 2.5 ? 'peb' : 'sand', P.sprint); }

  if (s && mouseL && (w.auto || P.trigger) && !P.downed) playerFire();
  updateInteract(dt);
  updateCamera(dt); updateViewmodel(dt);
}

function updateInteract(dt) {
  let best = null, bd = 1e9;
  for (const it of MISSION.interactables.concat(npcInteractables())) {
    if (!it.active()) continue;
    const d = Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z);
    if (d < it.r && d < bd && Math.abs(P.pos.y - it.pos.y) < 3) { best = it; bd = d; }
  }
  for (const pk of WORLD.pickups) {
    const d = Math.hypot(P.pos.x - pk.pos.x, P.pos.z - pk.pos.z);
    if (d < 1.8 && d < bd) { best = { pickup: pk, label: `Premi E per raccogliere: ${WEAPONS[pk.id].name}` }; bd = d; }
  }
  for (const c of WORLD.crates) {
    const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z);
    if (d < 2.3 && d < bd) { best = { crate: c, label: 'Premi E per rifornirti di munizioni e granate' }; bd = d; }
  }
  P.intTarget = best;
  const box = $('interact');
  if (!best || P.dead) { P.intT = 0; P.interacting = false; box.style.display = 'none'; P.ePressed = false; return; }
  box.style.display = 'block'; $('intT').textContent = best.label;
  if (best.hold) {
    if (KEYS.KeyE) { P.interacting = true; P.intT += dt / best.hold; if (P.intT >= 1) { P.intT = 0; P.interacting = false; best.done(); } }
    else { P.intT = 0; P.interacting = false; }
    $('intBar').style.display = 'block'; $('intBar').firstChild.style.width = (P.intT * 100) + '%';
  } else {
    $('intBar').style.display = 'none';
    if (P.ePressed) { if (best.pickup) takePickup(best.pickup); else if (best.crate) resupply(); else best.done(); }
  }
  P.ePressed = false;
}
function resupply() {
  for (const s of P.inv) if (s) { const w = WEAPONS[s.id]; s.res = Math.max(s.res, w.res); }
  P.nades = Math.max(P.nades, 5); P.bandages = Math.max(P.bandages, 3);
  sfxMech('pick'); feed('Munizioni e granate rifornite');
}

function updateCamera(dt) {
  const eyeT = P.inBoat ? .98 : P.swim ? (waterLevel(P.pos.x, P.pos.z, GAME.time) - P.pos.y) + .22 : [1.62, 1.05, .42][P.stance];
  P.eyeH = lerp(P.eyeH, eyeT, Math.min(1, dt * 9));
  P.kickP = lerp(P.kickP, 0, Math.min(1, dt * 10)); P.kickY = lerp(P.kickY, 0, Math.min(1, dt * 10));
  const bk = P.moveK * (1 - P.adsK * .7) * (P.sprint ? 1.5 : 1), bobY = Math.sin(P.bobPh) * .055 * bk, bobX = Math.sin(P.bobPh * .5) * .045 * bk;
  let y = P.pos.y + P.eyeH + bobY, roll = 0;
  P.camBobX = bobX;
  if (P.dead) { const k = clamp(P.deathT / .8, 0, 1); y = P.pos.y + lerp(P.eyeH, .25, k); roll = k * .5; }
  if (P.inBoat) roll = P.boat.g.rotation.z;
  camera.position.set(P.pos.x, y, P.pos.z);
  const sh = P.shake * .035, sk = P.shock * .03;
  camera.rotation.set(P.pitch + P.kickP + rnd(-sh, sh) + Math.sin(GAME.time * 2.1) * sk + (P.inBoat ? P.boat.g.rotation.x : 0), P.yaw + P.kickY + rnd(-sh, sh) + Math.sin(GAME.time * 1.3) * sk, roll + Math.sin(P.bobPh * .5) * .014 * bk + Math.sin(GAME.time * .9) * sk + (P.strafeRoll = lerp(P.strafeRoll || 0, -(P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw)) * .006, .1)));
  camera.position.x += Math.cos(P.yaw) * bobX; camera.position.z -= Math.sin(P.yaw) * bobX;
  const s = P.slot(), w = s ? WEAPONS[s.id] : null;
  P.sprintK = lerp(P.sprintK || 0, P.sprint && P.moveK > .5 ? 1 : 0, Math.min(1, dt * 8));
  let fov = SETTINGS.fov + P.sprintK * 6;
  if (w && P.adsK > 0) fov = lerp(fov, w.fov, P.adsK * P.adsK);
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

function resetPlayerState() {
  P.hp = 100; P.dead = false; P.downed = false; P.deathT = 0; P.vel.set(0, 0, 0); P.vy = 0; P.stance = 0; P.hurt = 0; P.supp = 0; P.shake = 0; P.shock = 0; P.pitch = 0;
  for (const s of P.inv) if (s) { const w = WEAPONS[s.id]; s.res = Math.max(s.res, w.mag * 3); if (s.mag === 0) s.mag = Math.min(w.mag, s.res); }
  P.nades = Math.max(P.nades, 3); P.charges = Math.max(P.charges, MISSION.minCharges || 0); P.bandages = Math.max(P.bandages, 2); P.bandT = 0;
  P.carry = null; P.reloadT = 0; P.switchT = .5;
  for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].team !== PT && projectiles[i].type === 'nade') { scene.remove(projectiles[i].m); projectiles.splice(i, 1); }
  MISSION.godT = 3.5; $('fade').style.opacity = 0;
}
function respawn() {
  const c = MISSION.checkpoint;
  resetPlayerState();
  P.inBoat = false; P.pos.set(c.pos.x, Hf(c.pos.x, c.pos.z), c.pos.z); P.yaw = c.yaw;
  showMsg('Ritorno all\'ultimo checkpoint', 2.5);
}
function respawnWave() {
  resetPlayerState();
  const b = spawnWave(true);
  P.boat = b; P.inBoat = true; P.seat = new V3(0, .47, 2.2); P.yaw = 0;
  showMsg('Sbarchi con la prossima ondata', 2.5);
}
