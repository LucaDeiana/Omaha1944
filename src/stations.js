"use strict";
// ============================================================
//  Postazioni occupabili: MG42 nei bunker e mortai dietro la linea.
//  Ogni postazione ha un solo occupante (pronta per il multiplayer).
// ============================================================
const STATIONS = [];
const STN = { cur: null, heat: 0, belt: 250, reloadT: 0, fireT: 0, over: false, tgt: new V3(), mortT: 0, gun: null, shells: [] };
const _so = new V3(), _sd = new V3(), _sr = new V3();

function initStations() {
  for (const b of [...WORLD.bunkers, ...(WORLD.extraBunkers || [])]) {
    STATIONS.push({
      type: 'mg', b, occupant: null, yaw0: PI,
      entry: new V3(b.x, b.base + 1, b.z + 2.1), cam: new V3(b.x, b.slitY - .02, b.z + 2.7),
      usable() { return !b.destroyed && (PT === 'E' || b.neutralized); },
      label: 'Premi E per prendere la MG42 del bunker',
    });
  }
  for (const b of WORLD.tobruks || []) STATIONS.push({
    type: 'mg', b, occupant: null, yaw0: PI, arc: 1.7, entry: new V3(b.x, Hf(b.x, b.z - 2.4), b.z - 2.4), cam: new V3(b.x, b.slitY + .15, b.z),
    usable() { return !b.destroyed && (PT === 'E' || b.neutralized); }, label: 'Premi E per entrare nella torretta Tobruk',
  });
  for (const a of WORLD.aaSites) {
    if (!a.mesh) continue;
    const p = new V3(a.x, Hf(a.x, a.z), a.z);
    STATIONS.push({ type: 'flak', aa: a, occupant: null, entry: p, cam: p.clone().add(new V3(0, 1.7, .9)), yaw0: PI,
      usable() { return !a.dead && (PT === 'E' || !enemies.some(e => e.alive && e.role === 'aa' && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 5)); },
      label: 'Premi E per usare la Flak 38 da 20 mm' });
  }
  for (const mp of WORLD.mortarPits) {
    const p = new V3(mp.x, Hf(mp.x, mp.z), mp.z);
    STATIONS.push({
      type: 'mortar', mp, occupant: null, entry: p, cam: p,
      usable() { return PT === 'E' || !enemies.some(e => e.alive && e.role === 'mortar' && Math.hypot(e.pos.x - mp.x, e.pos.z - mp.z) < 4); },
      label: 'Premi E per usare il mortaio da 81 mm',
    });
  }
}
function stationInteractables() {
  if (P.mode !== 'foot') return [];
  return STATIONS.filter(s => !s.occupant && s.usable()).map(s => ({ pos: s.entry, r: 2.6, label: s.label, active: () => true, done: () => enterStation(s) }));
}
function buildMGView() {
  const g = new THREE.Group(), mb = new MB(); mb.mat = 'vcMetal';
  mb.add(U.box, 0x1c1d1e, 0, 0, 0, 0, 0, 0, .07, .1, .55);
  mb.add(new THREE.CylinderGeometry(.034, .034, .5, 14, 1, true), 0x222324, 0, .02, -.5, PI / 2, 0, 0);
  for (let k = 0; k < 7; k++) mb.add(U.box, 0x0a0a0a, .033, .02, -.32 - k * .06, 0, 0, 0, .006, .02, .035);
  mb.add(new THREE.CylinderGeometry(.012, .012, .2, 8), 0x151515, 0, .02, -.82, PI / 2, 0, 0);
  mb.add(new THREE.CylinderGeometry(.022, .016, .06, 10), 0x111111, 0, .02, -.92, PI / 2, 0, 0);
  mb.add(U.box, 0x1a1a1a, 0, -.05, .32, -.15, 0, 0, .05, .12, .25);
  mb.add(U.box, 0x2a1a10, 0, -.1, .02, .3, 0, 0, .035, .12, .045);
  mb.add(U.box, 0x1a1b1c, -.075, .02, -.02, 0, 0, 0, .08, .06, .12);
  for (let k = 0; k < 9; k++) mb.add(U.box, 0xb08a3a, -.12 - k * .022, .0 - k * .012, -.02, 0, 0, .3, .02, .012, .07);
  mb.add(U.box, 0x1a1a1a, 0, .075, -.6, 0, 0, 0, .01, .04, .01);
  const m = new THREE.Mesh(mb.build(), MAT.vcMetal); g.add(m);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  fl.position.set(0, .02, -1.05); fl.visible = false; g.add(fl); g.userData.flash = fl;
  g.position.set(.0, -.2, -.25); g.visible = false; camera.add(g);
  return g;
}
function enterStation(s) {
  if (s.occupant) return;
  s.occupant = 'P'; STN.cur = s; netSend({ t: 'occ', i: STATIONS.indexOf(s), on: true }); P.mode = s.type; P.stance = 0; P.vel.set(0, 0, 0);
  if (s.type === 'mg') {
    if (!STN.gun) STN.gun = buildMGView();
    STN.gun.visible = true; P.yaw = s.yaw0; P.pitch = -.08;
    P.pos.set(s.cam.x, s.cam.y - 1.55, s.cam.z - .2);
    if (s.b.gunner && s.b.gunner.alive) { s.b.manned = true; s.b.gunner.pos.x = s.b.x + 2.6; s.b.gunner.pos.z = s.b.z + 1; }
    showMsg('MG42 — click sx: fuoco · R: nastro · E: esci', 3);
  } else if (s.type === 'flak') {
    P.yaw = PI; P.pitch = .5; P.pos.copy(s.entry); STN.flakT = 0;
    showMsg('Flak 38 — mouse: mira · click sx: fuoco · click dx: zoom · E: esci', 3.5);
  } else {
    STN.tgt.set(s.mp.x, 0, s.mp.z + 120); P.pos.copy(s.entry);
    showMsg('Mortaio da 81 mm — mouse: bersaglio · click sx: fuoco · E: esci', 3.5);
  }
  $('stHud').style.display = 'block';
}
function leaveStation() {
  const s = STN.cur; if (!s) return;
  s.occupant = null; if (s.b) { s.b.manned = false; if (s.b.gunner && s.b.gunner.alive) { s.b.gunner.pos.x = s.b.x; s.b.gunner.pos.z = s.b.z + 2.5; } } STN.cur = null; netSend({ t: 'occ', i: STATIONS.indexOf(s), on: false });
  if (STN.gun) STN.gun.visible = false;
  $('stHud').style.display = 'none'; $('mortRet').style.display = 'none';
  if (P.mode === 'mg' || P.mode === 'mortar' || P.mode === 'flak') P.mode = 'foot';
  if (s.type === 'mg') P.pos.copy(s.entry).add(new V3(0, 0, -1.2)); else { P.pos.copy(s.entry).add(new V3(0, 0, -2)); } P.pos.y = Math.max(Hf(P.pos.x, P.pos.z), bunkerStep(P.pos.x, P.pos.z));
  camera.fov = SETTINGS.fov; camera.updateProjectionMatrix();
}
function stationMouse(mx, my) {
  if (P.mode === 'flak') { const s = .0021 * SETTINGS.sens * (camera.fov / 70); P.yaw -= mx * s; P.pitch = clamp(P.pitch - my * s, -.08, 1.4); return; }
  if (P.mode === 'mg') {
    const s = .0021 * SETTINGS.sens;
    const arc = STN.cur.arc || .85; P.yaw = clamp(P.yaw - mx * s, STN.cur.yaw0 - arc, STN.cur.yaw0 + arc);
    if (STN.cur.b && STN.cur.b.tur) STN.cur.b.tur.rotation.y = P.yaw; P.pitch = clamp(P.pitch - my * s, -.42, .16);
  } else if (P.mode === 'mortar') {
    const k = .45 * SETTINGS.sens;
    STN.tgt.x -= mx * k; STN.tgt.z -= my * k;
    const mp = STN.cur.mp, dx = STN.tgt.x - mp.x, dz = STN.tgt.z - mp.z, d = Math.hypot(dx, dz);
    if (d > 520) { STN.tgt.x = mp.x + dx / d * 520; STN.tgt.z = mp.z + dz / d * 520; }
    if (d < 40) { STN.tgt.x = mp.x + dx / (d || 1) * 40; STN.tgt.z = mp.z + dz / (d || 1) * 40; }
  }
}
function stationKey(c) {
  if (c === 'KeyE') { leaveStation(); return true; }
  if (c === 'KeyR' && P.mode === 'mg' && STN.belt < 250 && STN.reloadT <= 0) { STN.reloadT = 5.5; sfxMech('out'); setTimeout(() => sfxMech('in'), 2600); setTimeout(() => sfxMech('boltc'), 4800); return true; }
  return false;
}
function mgFire() {
  STN.fireT = .05; STN.belt--; STN.heat = Math.min(1, STN.heat + .012);
  camera.getWorldPosition(_so); camera.getWorldDirection(_sd);
  const sp = .004 + STN.heat * .012;
  _sd.x += rnd(-1, 1) * sp; _sd.y += rnd(-1, 1) * sp; _sd.z += rnd(-1, 1) * sp; _sd.normalize();
  sfxShot('mg42', null, true); P.pitch += .006; P.yaw += rnd(-.003, .003); P.shake = Math.min(.35, P.shake + .05);
  STN.gun.userData.flash.visible = true; STN.gun.userData.flash.rotation.z = R() * PI; STN.flashT = .03;
  flashLight(_so.clone().addScaledVector(_sd, 2), 0xffb060, 12, .05);
  const o = _so.clone().addScaledVector(_sd, 1.2);
  const r = hitscan(o, _sd, 900), p = _sr.copy(o).addScaledVector(_sd, r.t);
  if (STN.belt % 2 === 0) netShot(o, p, 'mg42');
  if (STN.belt % 2 === 0) fxTracer(STN.gun.localToWorld(new V3(0, .02, -1.05)), p, 1.4, true);
  if (o.y > WATER_Y && _sd.y < 0) { const tw = (WATER_Y - o.y) / _sd.y, wz = o.z + _sd.z * tw; if (tw < r.t && wz > -9 && Hf(o.x + _sd.x * tw, wz) < WATER_Y) { fxImpact(new V3(o.x + _sd.x * tw, WATER_Y, wz), 'water'); if (r.type !== 'enemy') return; } }
  if (r.type === 'enemy') {
    const dm = 95 * (r.zone === 'head' ? 3 : r.zone === 'legs' ? .7 : 1);
    const killed = r.obj.damage(dm, o, true, r.zone, { dir: _sd.clone(), power: 2.8, joint: r.joint });
    STATS.hits++; bloodHit(p.clone(), _sd, 1.2); hitMarker(killed, r.zone === 'head');
  } else if (r.type === 'terrain') fxImpact(p.clone(), p.z > -58.5 ? 'sand' : 'dirt');
  else if (r.type === 'vehicle') { r.obj.damage(12, true); fxImpact(p.clone(), 'metal'); }
  for (const e of FOES()) if (e.alive && e.pos.distanceToSquared(p) < 12) e.supp = Math.min(1, e.supp + .5);
  STATS.shots++;
}
function flakFire(s) {
  STN.flakT = .11; camera.getWorldPosition(_so); camera.getWorldDirection(_sd);
  _sd.x += rnd(-.004, .004); _sd.y += rnd(-.004, .004); _sd.z += rnd(-.004, .004); _sd.normalize();
  sfxShot('flak', _so, true); P.shake = Math.min(.5, P.shake + .08); flashLight(_so, 0xffb060, 18, .05);
  const foe = PT === 'A' ? 'E' : 'A';
  let hit = null, ht = 1500;
  for (const pl of PLANES) if (pl.team === foe && pl.alive && !pl.crash) { const t = raySphere(_so, _sd, pl.pos, 7); if (t > 0 && t < ht) { ht = t; hit = pl; } }
  const fuse = hit ? ht : rnd(500, 900), e = _so.clone().addScaledVector(_sd, fuse);
  fxTracer(_so.clone().addScaledVector(_sd, 3).add(new V3(0, -.4, 0)), e, 2.4, true);
  after(fuse / 900, () => { PS_SMOKE.emit(e.x, e.y, e.z, 0, 0, 0, 4, 2, 6, .8, .06, .06, .06, .2, 0); PS_FIRE.emit(e.x, e.y, e.z, 0, 0, 0, .15, 2, 3, 1, 4, 2.5, 1); });
  if (hit) { hit.damage(rnd(90, 140), true); hitMarker(!hit.alive || hit.crash, false); }
  else if (_sd.y < .05) { const r = hitscan(_so.clone().addScaledVector(_sd, 2), _sd, 700); const p = _so.clone().addScaledVector(_sd, r.t + 2); if (r.type === 'enemy') r.obj.damage(140, _so, true, 'body', { dir: _sd.clone(), power: 4, joint: 15 }); fxImpact(p, 'dirt'); }
  netShot(_so, e, 'flak');
}
function updateStation(dt) {
  const s = STN.cur; if (!s) { P.mode = 'foot'; return; }
  if (s.type === 'flak') {
    if (P.dead || s.aa.dead) { leaveStation(); return; }
    STN.flakT -= dt; if (mouseL && STN.flakT <= 0) flakFire(s);
    P.shake = Math.max(0, P.shake - dt * 2);
    camera.position.copy(s.cam).add(_so.set(rnd(-1, 1) * P.shake * .03, rnd(-1, 1) * P.shake * .03, 0));
    camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (s.aa.mesh) s.aa.mesh.rotation.y = P.yaw - PI;
    const fov = P.adsHeld ? 30 : 70; if (Math.abs(camera.fov - fov) > .1) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 10)); camera.updateProjectionMatrix(); }
    const foes = PLANES.filter(p => p.team === (PT === 'A' ? 'E' : 'A') && p.alive && !p.crash).length;
    $('stHud').innerHTML = `<b>Flak 38 da 20 mm</b> — aerei nemici in volo: ${foes}<br><small>Mouse: mira (anticipa il bersaglio) · Click sx: fuoco · Click dx: zoom · E: esci</small>`;
    return;
  }
  if (P.dead || (s.type === 'mg' && s.b.destroyed)) { leaveStation(); return; }
  P.shake = Math.max(0, P.shake - dt * 2);
  if (s.type === 'mg') {
    STN.fireT -= dt; STN.flashT -= dt; if (STN.flashT <= 0) STN.gun.userData.flash.visible = false;
    STN.heat = Math.max(0, STN.heat - dt * (STN.over ? .35 : .18)); if (STN.heat >= 1) { STN.over = true; sfxMech('dry'); } if (STN.over && STN.heat < .35) STN.over = false;
    if (STN.reloadT > 0) { STN.reloadT -= dt; if (STN.reloadT <= 0) STN.belt = 250; }
    else if (mouseL && STN.fireT <= 0 && !STN.over) { if (STN.belt > 0) mgFire(); else { sfxMech('dry'); STN.fireT = .4; } }
    camera.position.copy(s.cam).add(_so.set(rnd(-1, 1) * P.shake * .02, rnd(-1, 1) * P.shake * .02, 0));
    camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    STN.gun.position.set(Math.sin(GAME.time * 40) * .002 * (mouseL ? 1 : 0), -.2 + (mouseL && STN.fireT > 0 ? .004 : 0), -.25 + (STN.fireT > .025 ? .015 : 0));
    const fov = P.adsHeld ? 38 : SETTINGS.fov; if (Math.abs(camera.fov - fov) > .1) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 10)); camera.updateProjectionMatrix(); }
    $('stHud').innerHTML = `<b>MG42</b> — nastro ${STN.belt}/250${STN.reloadT > 0 ? ' · <i>cambio nastro…</i>' : ''}<div class="heat"><i style="width:${Math.round(STN.heat * 100)}%;background:${STN.over ? '#d33' : '#e0a040'}"></i></div><small>Click sx fuoco · Click dx mira · R nastro · E esci</small>`;
  } else {
    STN.mortT -= dt;
    STN.tgt.y = Math.max(Hf(STN.tgt.x, STN.tgt.z), WATER_Y);
    const dir = Math.sign(STN.tgt.z - s.mp.z) || 1;
    camera.position.set(STN.tgt.x, STN.tgt.y + 150, STN.tgt.z - dir * 70);
    camera.lookAt(STN.tgt.x, STN.tgt.y, STN.tgt.z);
    if (Math.abs(camera.fov - 50) > .1) { camera.fov = 50; camera.updateProjectionMatrix(); }
    if (mouseL && STN.mortT <= 0) {
      STN.mortT = 2.4; const from = new V3(s.mp.x, s.entry.y + 1, s.mp.z), tg = STN.tgt.clone(), d = from.distanceTo(tg);
      sfxMortar(from); PS_SMOKE.emit(from.x, from.y + .8, from.z, 0, 2, 0, 2, .5, 2, .5, .5, .5, .5, 1); P.shake += .2;
      const fl = 3 + d / 160; tg.x += rnd(-1, 1) * d * .012; tg.z += rnd(-1, 1) * d * .012;
      STN.shells.push({ p: tg, t: fl });
      after(fl - 1.1, () => sfxWhistle(tg, false));
      after(fl, () => { tg.y = Math.max(Hf(tg.x, tg.z), WATER_Y - .2); explode(tg, 4.6, 230, { byPlayer: true }); });
    }
    for (let i = STN.shells.length - 1; i >= 0; i--) { STN.shells[i].t -= dt; if (STN.shells[i].t <= 0) STN.shells.splice(i, 1); }
    _hv.copy(STN.tgt).project(camera);
    const ret = $('mortRet'); ret.style.display = 'block'; ret.style.left = ((_hv.x * .5 + .5) * innerWidth) + 'px'; ret.style.top = ((-_hv.y * .5 + .5) * innerHeight) + 'px';
    const d = Math.round(Math.hypot(STN.tgt.x - s.mp.x, STN.tgt.z - s.mp.z));
    $('stHud').innerHTML = `<b>Mortaio da 81 mm</b> — distanza ${d} m · ${STN.mortT > 0 ? 'ricarica…' : '<b class="ok">PRONTO</b>'} · colpi in volo: ${STN.shells.length}<br><small>Mouse: sposta il bersaglio · Click sx: fuoco · E: esci</small>`;
  }
}
