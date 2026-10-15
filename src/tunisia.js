"use strict";
// ============================================================
//  Scenario "Tunisia — Medjez el-Bab, aprile 1943": città araba
//  imbiancata a calce, vicoli, piazza con fontana e minareto,
//  mercato, palme e dune fuori le mura.
//  Modalità: deathmatch (tutti contro tutti) e deathmatch a
//  squadre (fanteria USA contro Afrika Korps), contro i bot.
// ============================================================
const TUN = { ffa: true, goal: 25, time: 600, t: 0, score: { A: 0, E: 0 }, kills: new Map(), bots: [], spawns: [], spawnA: [], spawnE: [], el: null, over: false, respT: [] };
const TUN_C = new V3(0, 0, -150), TUN_R = 128;
const BOT_NAMES_E = ['Hans', 'Fritz', 'Kurt', 'Otto', 'Willi', 'Ernst', 'Karl', 'Heinz', 'Paul', 'Rudi', 'Walter', 'Günter'];
const BOT_NAMES_A = ['Miller', 'Jackson', 'Reese', 'Doyle', 'Parker', 'Mendez', 'Kowalczyk', 'Hayes', 'Boone', 'Carter', 'Sullivan', 'Wade'];

// ---------- terreno: città in piano, dune fuori le mura ----------
function tunH(x, z) {
  const d = Math.hypot(x - TUN_C.x, z - TUN_C.z);
  const dune = (fbm(x * .012 + 5, z * .012, 3) - .5) * 9 + Math.sin(x * .03 + z * .01) * 1.5;
  const town = 2 + (fbm(x * .02, z * .02, 2) - .5) * .5;
  return lerp(town, 3 + dune + (d - TUN_R) * .04, smooth((d - TUN_R + 10) / 45));
}
function tunSplat(x, z, n2) {
  const d = Math.hypot(x - TUN_C.x, z - TUN_C.z);
  let sa = 1.4, di = 0;
  if (d < TUN_R) di = .9 + (fbm(x * .05, z * .05, 2) - .5);
  const tot = sa + di, t = 1.02 + .08 * n2;
  return { sp: [sa / tot, 0, 0, di / tot], cl: [t * 1.08, t * 1.0, t * .86] };
}

// ---------- costruzione della città ----------
const TUN_COLS = [0xe9e3d3, 0xefe8d8, 0xe2d6bc, 0xd9c8a4, 0xe6dccb, 0xcdb48a];
function tunHouse(mb, x, z, w, d, h, colr) {
  const y = 2;
  mb.mat = 'plaster';
  mb.add(U.box, colr, x, y + h / 2, z, 0, 0, 0, w, h, d);
  // parapetto sul tetto piatto
  for (const [ox, oz, sx, sz] of [[0, d / 2 - .15, w, .3], [0, -d / 2 + .15, w, .3], [w / 2 - .15, 0, .3, d], [-w / 2 + .15, 0, .3, d]]) mb.add(U.box, colr, x + ox, y + h + .4, z + oz, 0, 0, 0, sx, .8, sz);
  // porte (azzurre o in legno) e finestrelle scure
  mb.mat = 'wood';
  const doorC = pick([0x2f6f9a, 0x3b7fa8, 0x6b4a2c, 0x2a5d84]);
  const side = R() < .5 ? 1 : -1;
  mb.add(U.box, doorC, x + rnd(-w / 4, w / 4), y + 1.1, z + side * (d / 2 + .02), 0, 0, 0, 1.2, 2.2, .06);
  mb.mat = 'vc';
  for (let k = 0; k < Math.floor(w / 3); k++) for (const sd of [-1, 1]) if (R() < .6) mb.add(U.box, 0x2a2622, x - w / 2 + 1.5 + k * 3, y + h * .62, z + sd * (d / 2 + .02), 0, 0, 0, .7, .9, .05);
  if (h > 6 && R() < .5) { mb.mat = 'wood'; mb.add(U.box, 0x6b4a2c, x, y + h * .55, z + side * (d / 2 + .5), 0, 0, 0, Math.min(3, w * .5), .15, 1); }
  addSolid(x - w / 2, y - 1, z - d / 2, x + w / 2, y + h + .8, z + d / 2, 'house');
  for (const [cx, cz] of [[x - w / 2 - .9, z - d / 2 - .9], [x + w / 2 + .9, z - d / 2 - .9], [x - w / 2 - .9, z + d / 2 + .9], [x + w / 2 + .9, z + d / 2 + .9]]) addCover(cx, cz, 'house');
}
function tunPalm(mb, x, z, s = 1) {
  const y = tunH(x, z), lean = rnd(-.25, .25), dir = R() * TAU, h = rnd(7, 11) * s;
  mb.mat = 'wood';
  for (let k = 0; k < 6; k++) { const t = k / 6, ox = Math.cos(dir) * lean * t * t * h, oz = Math.sin(dir) * lean * t * t * h; mb.add(U.cyl, 0x7a6448, x + ox, y + t * h + h / 12, z + oz, 0, 0, 0, .22 - t * .06, h / 6 + .05, .22 - t * .06); }
  const tx = x + Math.cos(dir) * lean * h, tz = z + Math.sin(dir) * lean * h, ty = y + h + .2;
  mb.mat = 'vc';
  // fronde ricadenti: tratto interno quasi orizzontale e punta che scende
  for (let k = 0; k < 11; k++) { const a = k / 11 * TAU + rnd(-.2, .2), c = Math.cos(a), sn = Math.sin(a), col = pick([0x4d6b2a, 0x5a7a30, 0x435f25]); mb.add(U.box, col, tx + c * 1.2, ty + .1, tz + sn * 1.2, 0, -a, -.12, 2.4, .06, .55); mb.add(U.box, col, tx + c * 2.9, ty - .55, tz + sn * 2.9, 0, -a, -.55, 1.6, .05, .42); }
  OBST.push({ x, z, r: .4 });
}
function buildTunisia() {
  tunUniforms();
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  buildHF(); buildHC();
  buildTerrain(); buildWater();
  const mb = new MB();
  // isolati della medina: celle irregolari separate da strade e vicoli
  const cell = 21, half = 5;
  for (let gx = -half; gx <= half; gx++) for (let gz = -half; gz <= half; gz++) {
    const cx = TUN_C.x + gx * cell + rnd(-2, 2), cz = TUN_C.z + gz * cell + rnd(-2, 2);
    const dc = Math.hypot(cx - TUN_C.x, cz - TUN_C.z);
    if (dc > TUN_R - 14) continue;
    if (Math.abs(cx - TUN_C.x) < 24 && Math.abs(cz - TUN_C.z) < 22) continue; // piazza
    if (Math.abs(cx - TUN_C.x) < 6) continue; // via principale nord-sud
    if (R() < .12) continue; // cortili e slarghi
    // l'isolato si divide in 1-3 case con altezze diverse, separate da vicoli stretti
    const n = R() < .4 ? 1 : R() < .6 ? 2 : 3, along = R() < .5;
    const W = cell - 6, Dp = cell - 6;
    for (let k = 0; k < n; k++) {
      const seg = (along ? W : Dp) / n, gap = n > 1 ? 1.6 : 0;
      const hx = along ? cx - W / 2 + seg * (k + .5) : cx, hz = along ? cz : cz - Dp / 2 + seg * (k + .5);
      const w = along ? seg - gap : W, d = along ? Dp : seg - gap;
      tunHouse(mb, hx, hz, w, d, pick([4.2, 4.8, 5.5, 6.5, 7.5, 8.6]), pick(TUN_COLS));
    }
  }
  // piazza: fontana, minareto e cupola della moschea, bancarelle del mercato
  const fy = tunH(TUN_C.x, TUN_C.z);
  mb.mat = 'stone'; mb.add(U.cyl12, 0xcfc3a5, TUN_C.x, fy + .45, TUN_C.z, 0, 0, 0, 3.2, .9, 3.2); mb.add(U.cyl12, 0x5a7d86, TUN_C.x, fy + .85, TUN_C.z, 0, 0, 0, 2.8, .1, 2.8); mb.add(U.cyl12, 0xcfc3a5, TUN_C.x, fy + 1.6, TUN_C.z, 0, 0, 0, .4, 1.6, .4);
  addSolid(TUN_C.x - 3, fy - 1, TUN_C.z - 3, TUN_C.x + 3, fy + .9, TUN_C.z + 3, 'wall'); for (let a = 0; a < 4; a++) addCover(TUN_C.x + Math.cos(a * PI / 2) * 4, TUN_C.z + Math.sin(a * PI / 2) * 4, 'sand');
  const mx = TUN_C.x + 20, mz = TUN_C.z - 30; mb.mat = 'plaster';
  mb.add(U.box, 0xece4d0, mx, fy + 12, mz, 0, 0, 0, 4.5, 24, 4.5); mb.add(U.box, 0xe0d4b8, mx, fy + 24.6, mz, 0, 0, 0, 5.4, 1.2, 5.4); mb.add(U.box, 0xece4d0, mx, fy + 26.6, mz, 0, 0, 0, 3, 3, 3);
  mb.add(U.sph, 0x4f8a72, mx, fy + 28.4, mz, 0, 0, 0, 1.6, 1.4, 1.6); addSolid(mx - 2.3, fy - 1, mz - 2.3, mx + 2.3, fy + 24, mz + 2.3, 'tower');
  mb.add(U.box, 0xe9e1cc, mx - 10, fy + 3.5, mz - 3, 0, 0, 0, 14, 7, 12); mb.add(U.sph, 0xe9e1cc, mx - 10, fy + 7, mz - 3, 0, 0, 0, 5.2, 4.2, 5.2); addSolid(mx - 17, fy - 1, mz - 9, mx - 3, fy + 9, mz + 3, 'house');
  for (let i = 0; i < 9; i++) {
    const x = TUN_C.x + rnd(-20, 20), z = TUN_C.z + (i % 2 ? 1 : -1) * rnd(10, 19); if (Math.abs(x - TUN_C.x) < 5) continue;
    mb.mat = 'wood'; for (const [ox, oz] of [[-1.2, -.9], [1.2, -.9], [-1.2, .9], [1.2, .9]]) mb.add(U.cyl, 0x6b4a2c, x + ox, fy + 1.2, z + oz, 0, 0, 0, .06, 2.4, .06);
    mb.add(U.box, 0x7a5a3a, x, fy + .9, z, 0, 0, 0, 2.6, .8, 1.8);
    mb.mat = 'vc'; mb.add(U.box, pick([0xb5452f, 0x2f6f9a, 0xd8a33a, 0x7a3b6a, 0xe8e0c8]), x, fy + 2.45, z, .08, 0, 0, 2.9, .05, 2.2);
    addSolid(x - 1.3, fy - 1, z - .9, x + 1.3, fy + 1.3, z + .9, 'crate'); addCover(x, z + 1.6, 'sand'); addCover(x, z - 1.6, 'sand');
  }
  // mura basse diroccate attorno alla città con varchi
  for (let a = 0; a < TAU; a += .045) {
    if ((a % (PI / 2)) < .14) continue; // porte
    if (R() < .18) continue; // brecce
    const x = TUN_C.x + Math.cos(a) * (TUN_R - 4), z = TUN_C.z + Math.sin(a) * (TUN_R - 4), y = tunH(x, z), hgt = rnd(1.2, 2.4);
    mb.mat = 'stone'; mb.add(U.box, 0xc9b48c, x, y + hgt / 2, z, 0, -a, 0, .9, hgt, 6.2);
    addSolid(x - 2.6, y - 1, z - 2.6, x + 2.6, y + hgt, z + 2.6, 'wall');
    if (R() < .4) addCover(x - Math.cos(a) * 1.4, z - Math.sin(a) * 1.4, 'sand');
  }
  // palme nella piazza, lungo le strade e nell'oasi fuori le mura
  for (let i = 0; i < 10; i++) tunPalm(mb, TUN_C.x + rnd(-22, 22), TUN_C.z + (i % 2 ? 1 : -1) * rnd(14, 21));
  for (let i = 0; i < 26; i++) { const a = R() * TAU, r = rnd(TUN_R + 8, TUN_R + 60); tunPalm(mb, TUN_C.x + Math.cos(a) * r, TUN_C.z + Math.sin(a) * r, rnd(.9, 1.2)); }
  // relitti e postazioni nel deserto e alle porte
  for (const [x, z, ry] of [[TUN_C.x - 150, TUN_C.z + 30, .8], [TUN_C.x + 140, TUN_C.z - 60, -.4], [TUN_C.x + 30, TUN_C.z + 150, 2.2]]) { addSherman(mb, x, tunH(x, z), z, ry, true); addSolid(x - 2, tunH(x, z) - 1, z - 3, x + 2, tunH(x, z) + 2.6, z + 3, 'tank'); addCover(x + 3, z, 'tank'); addCover(x - 3, z, 'tank'); }
  for (let i = 0; i < 16; i++) { const a = R() * TAU, r = rnd(20, TUN_R - 15), x = TUN_C.x + Math.cos(a) * r, z = TUN_C.z + Math.sin(a) * r; if (pointInSolid(new V3(x, 3, z))) continue; sandbagLine(mb, x - 1.5, z, x + 1.5, z, 2); addCover(x, z + 1, 'sand'); addCover(x, z - 1, 'sand'); }
  for (let i = 0; i < 24; i++) { const a = R() * TAU, r = rnd(10, TUN_R - 10), x = TUN_C.x + Math.cos(a) * r, z = TUN_C.z + Math.sin(a) * r; if (pointInSolid(new V3(x, 3, z))) continue; mb.mat = 'wood'; mb.add(U.box, 0x8a7350, x, tunH(x, z) + .45, z, 0, R() * PI, 0, 1.1, .9, .9); addSolid(x - .6, 0, z - .6, x + .6, tunH(x, z) + .9, z + .6, 'crate'); addCover(x + 1, z, 'sand'); }
  addTiled(mb, 100);
  // punti di rinascita: liberi, sparsi; quelli di squadra ai due lati opposti della città
  for (let i = 0; i < 400 && TUN.spawns.length < 36; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * (TUN_R - 12), p = new V3(TUN_C.x + Math.cos(a) * r, 0, TUN_C.z + Math.sin(a) * r);
    if (pointInSolid(new V3(p.x, 3, p.z)) || TUN.spawns.some(q => q.distanceTo(p) < 12)) continue;
    TUN.spawns.push(p);
  }
  TUN.spawnA = TUN.spawns.filter(p => p.z > TUN_C.z + 35); TUN.spawnE = TUN.spawns.filter(p => p.z < TUN_C.z - 35);
  // luce calda del Nordafrica: foschia sabbiosa leggera, sole forte
  FOG_COL.setRGB(.86, .8, .68); scene.fog.color.copy(FOG_COL); FOG_K = .7; scene.fog.density = FOG_BASE * FOG_K;
  if (sun) sun.intensity *= 1.25;
}

// ---------- partita ----------
function tunSpawnPoint(team) {
  const list = !TUN.ffa && team ? (team === 'A' ? TUN.spawnA : TUN.spawnE) : TUN.spawns;
  let best = null, bs = -1;
  for (const p of list) {
    let m = P.dead || team === 'A' && !TUN.ffa ? 1e9 : p.distanceTo(P.pos);
    for (const s of TUN.ffa ? enemies : (team === 'A' ? enemies : allies)) if (s.alive) m = Math.min(m, p.distanceTo(s.pos));
    const sc = Math.min(m, 70) + R() * 15;
    if (sc > bs) { bs = sc; best = p; }
  }
  return (best || TUN_C).clone();
}
function tunSpawnBot(team) {
  const p = tunSpawnPoint(team), kinds = ['rifle', 'rifle', 'smg', 'smg', 'bar', 'rifle', 'sniper'];
  const k = team === 'E' && R() < .1 ? 'mg' : pick(kinds.filter(x => team === 'E' ? x !== 'bar' : true));
  const names = team === 'A' ? BOT_NAMES_A : BOT_NAMES_E, name = names[TUN.bots.length % names.length];
  const o = { state: 'assault', group: 'tun', objective: tunObjective(), name };
  const s = team === 'A' ? addAlly(k, p.x, p.z, o) : addEnemy(k, p.x, p.z, o);
  s.tunName = name; s.yaw = R() * TAU; TUN.bots.push(s);
  if (!TUN.kills.has(name)) TUN.kills.set(name, { kills: 0, deaths: 0, team });
  return s;
}
// obiettivo di movimento: in deathmatch un punto a caso, a squadre la metà campo avversaria o il centro
function tunObjective(team) {
  if (!TUN.ffa && team) { const l = team === 'A' ? TUN.spawnE : TUN.spawnA; if (R() < .55) return pick(l).clone(); }
  if (R() < .3) return TUN_C.clone().add(new V3(rnd(-20, 20), 0, rnd(-20, 20)));
  return pick(TUN.spawns).clone();
}
function initTunisia() {
  TUN.ffa = TUN.mode !== 'tdm'; TUN.goal = TUN.ffa ? 25 : 50; TUN.t = 0; TUN.over = false;
  P.inBoat = false; P.boat = null; P.mode = 'foot';
  const sp = tunSpawnPoint('A'); P.pos.set(sp.x, Hf(sp.x, sp.z), sp.z); P.yaw = Math.atan2(sp.x - TUN_C.x, sp.z - TUN_C.z);
  MISSION.checkpoint = { pos: P.pos.clone(), yaw: P.yaw };
  if (TUN.ffa) for (let i = 0; i < 11; i++) tunSpawnBot('E');
  else { for (let i = 0; i < 7; i++) tunSpawnBot('A'); for (let i = 0; i < 8; i++) tunSpawnBot('E'); }
  TUN.kills.set('Tu', { kills: 0, deaths: 0, team: 'A', me: true });
  // armi sparse per la città
  const ids = ['thompson', 'bar', 'kar98zf', 'mp40', 'springfield', 'thompson', 'mp40', 'bazooka', 'bar', 'kar98'];
  ids.forEach(id => { const p = pick(TUN.spawns); const pk = spawnPickup(id, new V3(p.x + rnd(-2, 2), 0, p.z + rnd(-2, 2)), undefined, id === 'bazooka' ? 3 : undefined); pk.fixed = true; });
  MISSION.title = TUN.ffa ? 'Deathmatch — Medjez el-Bab' : 'Deathmatch a squadre — Medjez el-Bab';
  MISSION.objText = TUN.ffa ? `Primo a ${TUN.goal} uccisioni` : `Prima squadra a ${TUN.goal} uccisioni`;
  MISSION.stage = 0; MISSION.stageT = 0;
  if (!TUN.el) { TUN.el = document.createElement('div'); TUN.el.id = 'tunScore'; TUN.el.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:18;font:600 15px/1.35 Oswald,sans-serif;color:#efe6cf;text-shadow:0 1px 3px #000;text-align:center;letter-spacing:.06em'; document.body.appendChild(TUN.el); }
}
function tunCredit(name, k, d) { const r = TUN.kills.get(name); if (r) { r.kills += k; r.deaths += d; } }
function tunOnDeath(s, byPlayer) {
  const victim = s.tunName || '?';
  tunCredit(victim, 0, 1);
  let killer = null;
  if (byPlayer && (TUN.ffa || s.team !== PT)) { killer = 'Tu'; STATS.kills++; feed('Hai eliminato ' + victim); }
  else if (s.lastHit && s.lastHit.tunName && s.lastHit !== s) { killer = s.lastHit.tunName; if (dist2Cam(s.pos) < 140 * 140) feed(killer + ' ha eliminato ' + victim); }
  if (killer) { tunCredit(killer, 1, 0); if (!TUN.ffa) { const kt = killer === 'Tu' ? 'A' : TUN.kills.get(killer).team; if (kt !== s.team) TUN.score[kt]++; } }
  else if (!TUN.ffa) TUN.score[s.team === 'A' ? 'E' : 'A']++;
  TUN.respT.push({ t: 4, team: s.team });
}
function tunPlayerDied() { tunCredit('Tu', 0, 1); if (!TUN.ffa) TUN.score.E++; }
function updateTunisia(dt) {
  MISSION.stageT += dt; MISSION.nadeCD -= dt; MISSION.eNadeCD -= dt; MISSION.allyNadeCD -= dt;
  updateSubs(dt);
  if (TUN.over) return;
  TUN.t += dt;
  // rinascita dei bot
  for (let i = TUN.respT.length - 1; i >= 0; i--) { const r = TUN.respT[i]; r.t -= dt; if (r.t <= 0) { TUN.respT.splice(i, 1); tunSpawnBot(r.team); } }
  // i bot fermi ricevono un nuovo obiettivo; vengono tolti dalle liste quando il corpo sparisce
  for (const s of TUN.bots) if (s.alive && (s.state === 'hold' || s.state === 'idle' || (!s.dest && s.state !== 'assault'))) { s.state = 'assault'; s.objective = tunObjective(s.team); s.wait = rnd(.5, 2); }
  TUN.bots = TUN.bots.filter(s => !s.removed);
  for (const arr of [allies, enemies]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].removed) arr.splice(i, 1);
  // resta dentro l'arena
  const dx = P.pos.x - TUN_C.x, dz = P.pos.z - TUN_C.z, dd = Math.hypot(dx, dz);
  if (dd > TUN_R + 70) { P.pos.x = TUN_C.x + dx / dd * (TUN_R + 70); P.pos.z = TUN_C.z + dz / dd * (TUN_R + 70); showMsg('Torna in città!', 1); }
  // punteggio e fine partita
  const rows = [...TUN.kills.entries()].map(([n, r]) => ({ n, ...r })).sort((a, b) => b.kills - a.kills);
  const me = TUN.kills.get('Tu'), left = Math.max(0, TUN.time - TUN.t), clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (TUN.ffa) { const lead = rows[0], pos = rows.findIndex(r => r.me) + 1; TUN.el.innerHTML = `DEATHMATCH · ${clock}<br><span style="font-size:13px">Tu ${me.kills} (${pos}°) · in testa: ${lead.n} ${lead.kills} · obiettivo ${TUN.goal}</span>`; }
  else TUN.el.innerHTML = `<span style="color:#9fc2e8">USA ${TUN.score.A}</span> &nbsp;—&nbsp; <span style="color:#e8c98f">DAK ${TUN.score.E}</span><br><span style="font-size:13px">${clock} · obiettivo ${TUN.goal} · tu ${me.kills}/${me.deaths}</span>`;
  const done = TUN.ffa ? rows[0].kills >= TUN.goal : Math.max(TUN.score.A, TUN.score.E) >= TUN.goal;
  if (done || left <= 0) {
    TUN.over = true;
    const win = TUN.ffa ? rows[0].me : TUN.score.A > TUN.score.E;
    GAME.endTitle = TUN.ffa ? (win ? 'HAI VINTO IL DEATHMATCH' : rows[0].n.toUpperCase() + ' VINCE') : (TUN.score.A === TUN.score.E ? 'PAREGGIO' : win ? 'VITTORIA AMERICANA' : 'VITTORIA DELL\'AFRIKA KORPS');
    GAME.endText = '<table>' + rows.slice(0, 8).map((r, i) => `<tr${r.me ? ' class="me"' : ''}><td>${i + 1}.</td><td>${r.n}${TUN.ffa ? '' : r.team === 'A' ? ' (USA)' : ' (DAK)'}</td><td>${r.kills} uccisioni</td><td>${r.deaths} morti</td></tr>`).join('') + '</table><br>';
    for (const s of TUN.bots) if (s.alive) { s.target = null; s.state = 'hold'; }
    after(4, () => GAME.end(win));
  }
}
function tunDeployPoints() {
  const p = tunSpawnPoint('A');
  return [{ label: 'Rientro in città', sub: TUN.ffa ? 'punto lontano dai nemici' : 'con la tua squadra', kind: 'point', pos: p, yaw: Math.atan2(p.x - TUN_C.x, p.z - TUN_C.z) }];
}
// uniformi dell'Afrika Korps: tela kaki chiaro, elmetto color sabbia, stivaletti e cinghie in cuoio
function tunUniforms() { Object.assign(SCOL2.E, { jacket: 0xa8946a, jacket2: 0x8f7c55, pants: 0x9c8860, web: 0x5f4b30, pack: 0x8a7a58, helm: 0xa39068, net: 0x8a7a58, legging: 0x5a4630, boot: 0x4a3a28, belt2: 0x7d6c4a }); Object.assign(SCOL2.A, { jacket: 0x7d7556, pants: 0x6f6a4c }); }
