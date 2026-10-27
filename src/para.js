"use strict";
// ============================================================
//  NOTTE DEL D-DAY — paracadutisti della 101ª Aviotrasportata
//  sulla stessa costa di Omaha, la notte fra il 5 e il 6 giugno 1944.
//  Lancio col paracadute nel buio, squadra dispersa da radunare,
//  due cannoni Flak da far saltare con le cariche, il villaggio di
//  Colleville da prendere e da tenere fino all'alba contro il
//  contrattacco. Luna, stelle, traccianti antiaerei che salgono,
//  riflettori, razzi illuminanti, case in fiamme.
// ============================================================
const PARA = { on: false, stage: 0, t: 0, squad: [], found: 0, flakDone: 0, charges: [], canopy: null, lights: [], beams: [], flareT: 4, aaT: 0, dawn: 0, holdT: 0, over: false };
const PARA_NAMES = ['Pvt. Hale', 'Pvt. Rossi', 'Cpl. Murphy', 'Pvt. Novak', 'Pvt. Grant', 'Sgt. Lipton'];
function paraNight() {
  // luce lunare fredda e debole, cielo scuro con stelle e luna, nebbia notturna
  if (sun) { sun.color.setHex(0x9fb4d8); sun.intensity = .22; sun.position.copy(new V3(.4, .7, -.3).normalize().multiplyScalar(300)); }
  scene.traverse(o => { if (o.isHemisphereLight) { o.intensity = .16; o.color.setHex(0x51617e); o.groundColor.setHex(0x1a1a1a); } });
  if (typeof skyMesh !== 'undefined' && skyMesh) skyMesh.visible = false;
  FOG_COL.setRGB(.035, .045, .07); scene.background = FOG_COL.clone(); scene.fog.color.copy(FOG_COL); FOG_K = 1.35; scene.fog.density = FOG_BASE * FOG_K; scene.environment = null;
  if (gradePass) gradePass.uniforms.uExposure.value = 1.25; P_LIT.value = .14;
  const N = 2200, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = R() * TAU, e = Math.asin(R() * .95 + .05), r = 4000; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  PARA.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: .85 })); camera.add(PARA.stars); PARA.stars.matrixAutoUpdate = true;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0xf2f0e2, fog: false })); moon.position.set(1400, 2200, -2600); moon.lookAt(0, 0, 0); scene.add(moon); PARA.moon = moon;
  // stelle e luna seguono la camera (all'infinito)
  PARA.stars.onBeforeRender = () => { PARA.stars.quaternion.copy(camera.quaternion).invert(); };
}
function paraFires() {
  // case in fiamme nel villaggio e nella campagna, con luci che tremolano
  const spots = [[SQUARE.x - 34, SQUARE.z + 18], [SQUARE.x + 40, SQUARE.z - 6], [-120, -380], [90, -420]];
  for (const [x, z] of spots) { const p = new V3(x, Hf(x, z) + 2, z); addEmitter(p, 'fire', 1.5).life = 1e9; addEmitter(p.clone().add(new V3(0, 4, 0)), 'smoke', 1.3).life = 1e9;
    const l = new THREE.PointLight(0xff8a3a, 2.2, 55, 2); l.position.copy(p).add(new V3(0, 2, 0)); scene.add(l); PARA.lights.push(l); }
  // riflettori antiaerei che spazzano il cielo
  for (const [x, z] of [[-140, -260], [150, -300], [10, -520]]) { const g = new THREE.ConeGeometry(14, 900, 16, 1, true); g.translate(0, -450, 0); g.rotateX(PI);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, Hf(x, z) + 1, z); scene.add(m); PARA.beams.push({ m, ph: R() * 6, sp: rnd(.08, .18) }); }
}
function initPara() {
  WORLD.bombard = 'off'; P.inBoat = false; P.boat = null; P.mode = 'foot'; MISSION.stage = 0; MISSION.stageT = 0;
  PARA.stage = 0; PARA.t = 0; PARA.found = 0; PARA.flakDone = 0; PARA.over = false; PARA.dawn = 0; PARA.squad = [];
  paraNight(); paraFires();
  // lancio: si scende col paracadute nei campi fra la spiaggia e Colleville
  const x0 = rnd(-40, 40), z0 = -420; P.pos.set(x0, Hf(x0, z0) + 170, z0); P.yaw = PI; P.vy = -5; P.grounded = false; P.para = true;
  const cg = new THREE.SphereGeometry(4.2, 18, 8, 0, TAU, 0, PI / 2.4), cm = new THREE.MeshStandardMaterial({ color: 0xc8c2a8, roughness: 1, side: THREE.DoubleSide });
  PARA.canopy = new THREE.Group(); PARA.canopy.add(new THREE.Mesh(cg, cm)); const lines = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; lines.push(new V3(Math.cos(a) * 3.9, 1.0, Math.sin(a) * 3.9), new V3(0, -6.2, 0)); }
  PARA.canopy.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x8a8670 }))); scene.add(PARA.canopy);
  MISSION.checkpoint = { pos: new V3(x0, 0, z0), yaw: PI };
  // paracadutisti dispersi nei campi: fermi finché non li trovi
  for (let i = 0; i < 6; i++) { const a = R() * TAU, r = rnd(45, 150), x = clamp(x0 + Math.cos(a) * r, -200, 200), z = clamp(z0 + Math.sin(a) * r * .7, -520, -330);
    const s = addAlly(pick(['rifle', 'rifle', 'smg', 'bar']), x, z, { state: 'post', stationary: true, name: PARA_NAMES[i], group: 'para' }); s.paraLost = true; PARA.squad.push(s); }
  // tedeschi: guarnigione del villaggio, serventi dei Flak, pattuglie nei campi
  spawnVillage();
  for (const f of WORLD.flaks || []) for (let i = 0; i < 3; i++) addEnemy(i ? 'rifle' : 'mg', f.x + rnd(-6, 6), f.z - 6 + rnd(-3, 3), { state: 'post', stationary: true, group: 'flak' });
  for (let i = 0, n = 0; i < 60 && n < 8; i++) { const x = rnd(-170, 170), z = rnd(-490, -320); if (Math.hypot(x - x0, z - z0) < 95) continue; n++; addEnemy(randEnemyKind(), x, z, { state: 'post', stationary: true, group: 'patrol' }); }
  MISSION.title = 'Notte del D-Day — 101ª Aviotrasportata'; MISSION.objText = 'Raduna la squadra dispersa (0/6)';
  // cariche sui Flak: interazione col tasto E
  PARA.charges = [];
  for (const f of WORLD.flaks || []) MISSION.interactables.push({ pos: f.pos, r: 3.2, label: 'Premi E per piazzare la carica di esplosivo sul Flak', active: () => PARA.stage >= 1 && f.alive && !f.charged, done: () => { f.charged = true; PARA.charges.push({ f, t: 8 }); showMsg('Carica piazzata! Allontanati: 8 secondi', 3); play('pin', null, { vol: 1 }); } });
  PARA.drone = loopSound('eng_bomber', 0);
  say(N.radio, 'Jump, jump, jump! Go, go!'); showMsg('Notte fra il 5 e il 6 giugno 1944 — W/A/S/D per guidare il paracadute', 5);
}
function updatePara(dt) {
  MISSION.stageT += dt; PARA.t += dt; updateSubs(dt);
  // paracadute: discesa a ~5,5 m/s, la vela sopra la testa; all'atterraggio si sgancia
  if (P.para) {
    if (P.vy < -5.5) P.vy = -5.5; P.vy = Math.max(P.vy, -5.5);
    PARA.canopy.position.set(P.pos.x, P.pos.y + 8.2, P.pos.z); PARA.canopy.rotation.z = Math.sin(PARA.t * .7) * .06;
    if (P.grounded || P.pos.y - Hf(P.pos.x, P.pos.z) < .2) { P.para = false; showMsg('A terra. Trova gli altri: ascolta il cricket (avvicinati ai compagni)', 5); play('bodyfall', null, { vol: .8 }); PARA.canopy.position.y = Hf(P.pos.x, P.pos.z) + .3; PARA.canopy.scale.set(1, .15, 1); MISSION.checkpoint = { pos: P.pos.clone(), yaw: P.yaw }; }
  }
  // atmosfera: rombo dei C-47 che passano, traccianti antiaerei verso il cielo, razzi illuminanti
  if (PARA.drone) PARA.drone.set(PARA.stage < 2 ? .25 + Math.sin(PARA.t * .2) * .1 : .05, 0, .8);
  PARA.aaT -= dt; if (PARA.aaT <= 0) { PARA.aaT = rnd(.08, .25); const live = (WORLD.flaks || []).filter(f => f.alive), src = live.length && R() < .5 ? pick(live).muzzle : new V3(rnd(-200, 200), 0, rnd(-600, -250)); const o = src.clone(); if (!live.includes(src)) o.y = Hf(o.x, o.z) + 1;
    const d = new V3(rnd(-.4, .4), 1, rnd(-.4, .4)).normalize(); fxTracer(o, o.clone().addScaledVector(d, rnd(400, 900)), 1.6); if (R() < .15) play(R() < .5 ? 'flak_far' : 'mg_far', o, { ref: 120, vol: .6 }); }
  PARA.flareT -= dt; if (PARA.flareT <= 0) { PARA.flareT = rnd(9, 18); const p = new V3(rnd(-150, 150), 0, rnd(-520, -300)); p.y = Hf(p.x, p.z) + 160; PARA.flare = { p, t: 14 }; if (!PARA.flareL) { PARA.flareL = new THREE.PointLight(0xfff0d0, 0, 420, 1.6); scene.add(PARA.flareL); } }
  if (PARA.flare) { const f = PARA.flare; f.t -= dt; f.p.y -= 4 * dt; PARA.flareL.position.copy(f.p); PARA.flareL.intensity = f.t > 0 ? 2.4 * Math.min(1, f.t / 2) * (.85 + Math.random() * .3) : 0; if (R() < dt * 30) PS_FIRE.emit(f.p.x, f.p.y, f.p.z, rnd(-.3, .3), -1, rnd(-.3, .3), .4, 1.2, 1.4, 1, 3.5, 2.6, 2); if (f.t <= 0) PARA.flare = null; }
  for (const l of PARA.lights) l.intensity = 1.8 + Math.random() * .9;
  for (const b of PARA.beams) { b.ph += dt * b.sp; b.m.rotation.set(Math.sin(b.ph) * .5, 0, Math.cos(b.ph * .7) * .5); b.m.visible = PARA.dawn < .6; }
  // cariche: esplodono dopo il conto alla rovescia
  for (let i = PARA.charges.length - 1; i >= 0; i--) { const c = PARA.charges[i]; c.t -= dt; if (c.t <= 0) { PARA.charges.splice(i, 1); c.f.destroy(); explode(c.f.pos.clone().add(new V3(0, 1, 0)), 7, 400, { byPlayer: true }); PARA.flakDone++; STATS.kills += 3; showMsg('Flak distrutto! (' + PARA.flakDone + '/' + (WORLD.flaks || []).length + ')', 3); } }
  // obiettivi
  const nFlak = (WORLD.flaks || []).length;
  if (PARA.stage === 0) {
    for (const s of PARA.squad) if (s.paraLost && s.alive && !P.para && s.pos.distanceTo(P.pos) < 7) { s.paraLost = false; s.squad = true; s.stationary = false; s.state = 'idle'; PARA.found++; say(s.name, pick(['Flash!', 'Thunder! Grazie a Dio sei tu.', 'Ho perso il fucile nell\'acqua, ma ce l\'ho fatta.', 'Dove diavolo siamo?'])); }
    MISSION.objText = `Raduna la squadra dispersa (${PARA.found}/6)`;
    MISSION.markers = PARA.squad.filter(s => s.paraLost && s.alive).slice(0, 2).map(s => ({ pos: s.pos.clone().add(new V3(0, 2, 0)), label: s.name }));
    if (PARA.found >= 4 || (PARA.t > 300 && PARA.found >= 1)) { PARA.stage = 1; MISSION.objText = 'Fai saltare i cannoni Flak sopra la spiaggia (0/' + nFlak + ')'; say(N.radio, 'Easy Company: i Flak sulla scogliera devono saltare prima dell\'alba. Usate le cariche.'); showMsg('Nuovo obiettivo: distruggi i Flak con le cariche (E)', 5); }
  } else if (PARA.stage === 1) {
    MISSION.objText = `Fai saltare i cannoni Flak sopra la spiaggia (${PARA.flakDone}/${nFlak})`;
    MISSION.markers = (WORLD.flaks || []).filter(f => f.alive).map(f => ({ pos: f.pos.clone().add(new V3(0, 4, 0)), label: 'Flak' }));
    if (PARA.flakDone >= nFlak) { PARA.stage = 2; MISSION.objText = 'Prendi Colleville-sur-Mer'; say(N.radio, 'Ottimo lavoro. Ora prendete Colleville e tenete la strada.'); MISSION.checkpoint = { pos: P.pos.clone(), yaw: P.yaw }; }
  } else if (PARA.stage === 2) {
    const left = enemies.filter(e => e.alive && e.group === 'village').length; MISSION.objText = `Prendi Colleville-sur-Mer (difensori rimasti: ${left})`;
    MISSION.markers = [{ pos: SQUARE.clone().add(new V3(0, 6, 0)), label: 'Colleville' }];
    if (left <= 2 && P.pos.distanceTo(SQUARE) < 40) { PARA.stage = 3; PARA.holdT = 180; MISSION.checkpoint = { pos: SQUARE.clone(), yaw: PI }; say(N.radio, 'Colleville è nostra! Arrivano i rinforzi tedeschi da sud: resistete fino all\'alba!'); showMsg('Resisti fino all\'alba', 5); spawnCounter(Math.round(8 * Q.enemyAlive / 110)); PARA.wave = 1; }
  } else if (PARA.stage === 3) {
    PARA.holdT -= dt; MISSION.objText = `Resisti fino all'alba: ${Math.ceil(Math.max(0, PARA.holdT) / 60)} min`; MISSION.markers = [];
    if (PARA.wave < 3 && PARA.holdT < 180 - PARA.wave * 60) { PARA.wave++; spawnCounter(Math.round((6 + PARA.wave * 3) * Q.enemyAlive / 110)); say(N.sarge, 'Arrivano altri crucchi dalla strada!'); }
    PARA.dawn = clamp(1 - PARA.holdT / 180, 0, 1);
    paraDawn(PARA.dawn);
    if (PARA.holdT <= 0 && !PARA.over) { PARA.over = true; GAME.endTitle = 'ALL\'ALBA COLLEVILLE È NOSTRA'; GAME.endText = 'La spiaggia sotto il villaggio è senza Flak e la strada è tagliata: la prima ondata a Omaha sbarcherà fra poco.'; say(N.radio, 'Vediamo la flotta all\'orizzonte. Ce l\'avete fatta.'); after(4, () => GAME.end(true)); }
  }
}
// l'alba: il cielo schiarisce da blu notte a rosa, la luna impallidisce
function paraDawn(k) {
  const c = new THREE.Color(.035, .045, .07).lerp(new THREE.Color(.55, .5, .52), k * k); FOG_COL.copy(c); scene.background.copy(c); scene.fog.color.copy(c);
  if (sun) { sun.intensity = .22 + k * 1.2; sun.color.setRGB(.62 + k * .38, .7 + k * .12, .85 - k * .25); }
  scene.traverse(o => { if (o.isHemisphereLight) o.intensity = .16 + k * .55; });
  if (PARA.stars) PARA.stars.material.opacity = .85 * (1 - k); if (PARA.moon) PARA.moon.material.color.setScalar(1 - k * .5);
  if (gradePass) gradePass.uniforms.uExposure.value = 1.25 - k * .2; P_LIT.value = .14 + k * .7;
}
function paraDeployPoints() {
  const s = PARA.squad.find(q => q.alive && !q.paraLost), p = s ? s.pos.clone().add(new V3(rnd(-3, 3), 0, 3)) : MISSION.checkpoint.pos.clone();
  return [{ label: s ? 'Con la squadra' : 'Ultimo punto', sub: s ? s.name : 'dove sei atterrato', kind: 'point', pos: p, yaw: PI }];
}
