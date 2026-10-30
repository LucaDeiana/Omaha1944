"use strict";
// ============================================================
//  Schermata di rientro in stile Battlefield: mappa tattica,
//  punti di schieramento e conto alla rovescia
// ============================================================
const DEP = { pts: [], sel: 0, wait: 0, ci: 0, cls: null };
function deployPoints() {
  if (PARA.on && SCEN === 'omaha') return paraDeployPoints();
  if (SCEN === 'ard') return ardDeployPoints();
  if (SCEN === 'air') return airDeployPoints();
  if (SCEN === 'tun') return tunDeployPoints();
  if (SCEN === 'snp') return snpDeployPoints();
  if (SCEN === 'sea') return navyDeployPoints();
  const st = MISSION.stage, pts = [];
  if (PT === 'E') {
    pts.push({ label: 'Ultimo punto', sub: 'con i camerati', kind: 'checkpoint', pos: MISSION.checkpoint.pos });
    if (st <= 2 || MISSION.endless) pts.push({ label: 'Trincea WN 62', sub: 'sopra la spiaggia', kind: 'point', pos: new V3(-10, 0, trenchZ(-10) + .2), yaw: PI });
    if (st >= 3) pts.push({ label: 'Linea delle siepi', sub: 'bocage', kind: 'point', pos: new V3(-30, 0, -174), yaw: PI });
    if (st >= 4 && !MISSION.endless) pts.push({ label: 'Colleville-sur-Mer', sub: 'piazza della chiesa', kind: 'point', pos: new V3(12, 0, -280), yaw: PI });
    if (st >= 5 && !MISSION.endless) pts.push({ label: 'La città', sub: 'piazza del mercato', kind: 'point', pos: CITY.sq.clone().add(new V3(0, 0, 25)), yaw: PI });
    TANKS.list.filter(t => t.alive).slice(0, 3).forEach((t, i) => pts.push({ label: 'Panzer IV ' + (i + 1), sub: t.player ? 'accanto al carro' : 'ai comandi del carro', kind: 'tank', tank: t, pos: t.pos }));
    return pts;
  }
  pts.push({ label: 'Ultimo checkpoint', sub: 'a piedi con la squadra', kind: 'checkpoint', pos: MISSION.checkpoint.pos });
  if (st >= 1 && st <= 4 && !NET.client) pts.push({ label: 'Ondata di sbarco', sub: 'mezzo Higgins', kind: 'wave', pos: new V3(P.pos.x || 0, 0, 82) });
  if (st >= 2) pts.push({ label: 'Terrapieno — Dog Green', sub: 'testa di ponte', kind: 'point', pos: new V3(-26, 0, -55) });
  if (st >= 4) pts.push({ label: 'Trincea conquistata', sub: 'cima della scogliera', kind: 'point', pos: new V3(BREACH_X, 0, trenchZ(BREACH_X)) });
  if (st >= 5) pts.push({ label: 'Bocage', sub: 'varco nella siepe', kind: 'point', pos: new V3(-28, 0, -160) });
  if (st >= 7) pts.push({ label: 'Colleville-sur-Mer', sub: 'piazza della chiesa', kind: 'point', pos: new V3(12, 0, -272) });
  pts.push({ label: 'USS Texas', sub: 'ponte di coperta e torretta B', kind: 'naval', pos: new V3(-230, 0, 780) });
  pts.push({ label: 'P-47 Thunderbolt', sub: 'supporto aereo', kind: 'plane', pos: new V3(-30, 0, 1100) });
  return pts;
}
// ---------- ruoli per il prossimo rientro ----------
const DEP_CLASSES = {
  A: [{ id: 'rifle', n: 'FUCILIERE', d: 'Preciso a ogni distanza, quattro bombe a mano', inv: ['garand', null, 'colt'], nades: 4 },
      { id: 'assault', n: 'ASSALTO', d: 'Mitra per il corpo a corpo e gli assalti', inv: ['thompson', null, 'colt'], nades: 3 },
      { id: 'support', n: 'MITRAGLIERE', d: 'Fuoco di copertura con il BAR', inv: ['bar', null, 'colt'], nades: 2 },
      { id: 'sniper', n: 'TIRATORE SCELTO', d: 'Ottica per i bersagli lontani', inv: ['springfield', null, 'colt'], nades: 1 },
      { id: 'at', n: 'ANTICARRO', d: 'Bazooka contro bunker e carri', inv: ['garand', 'bazooka', 'colt'], nades: 2 }],
  E: [{ id: 'rifle', n: 'SCHÜTZE', d: 'Fucile Mauser, cinque bombe a mano', inv: ['kar98', null, null], nades: 5 },
      { id: 'assault', n: 'STURM', d: 'MP 40 per la difesa ravvicinata', inv: ['mp40', null, null], nades: 4 },
      { id: 'sniper', n: 'SCHARFSCHÜTZE', d: 'Kar98k con ottica', inv: ['kar98zf', null, null], nades: 2 }],
};
function depClasses() {
  if (SCEN === 'snp') return SNP_GUNS[PT].map(id => ({ id, n: WEAPONS[id].name.toUpperCase(), d: WEAPONS[id].cal + ' · ' + WEAPONS[id].mag + ' colpi', inv: [id], gun: id }));
  if (SCEN === 'omaha' || SCEN === 'ard' || SCEN === 'tun') return DEP_CLASSES[PT] || DEP_CLASSES.A;
  return null;
}
function depApplyClass(c) {
  if (!c || c.gun) return;
  P.inv = c.inv.map(id => id ? { id, mag: WEAPONS[id].mag, res: WEAPONS[id].res } : null);
  P.cur = 0; P.prevSlot = P.inv[2] ? 2 : P.inv[1] ? 1 : 0; P.nades = c.nades; P.cls = c.id;
}

const DEP_KIND = { A: { rifle: 'Fuciliere', smg: 'Capo squadra', bar: 'Mitragliere', sniper: 'Tiratore scelto', medic: 'Infermiere' }, E: { rifle: 'Schütze', smg: 'Gruppenführer', mg: 'Mitragliere MG 42', sniper: 'Scharfschütze', mortar: 'Mortaista' } };
function depSoldierSrc(s) {
  const w = WEAPONS[(AISND[s.team] || {})[s.kind]];
  return { name: s.name || (DEP_KIND[s.team] || {})[s.kind] || (s.team === 'E' ? 'Soldato tedesco' : 'Soldato nemico'), weapon: s.kind === 'mg' ? 'MG 42' : w ? w.name : '', pos: s.pos.clone().add(new V3(0, 1.4, 0)) };
}
// ---------- chi ti ha colpito: scheda della morte e telecamera ----------
function depKillInfo() {
  const k = P.killer;
  if (!k) return { who: 'Caduto in battaglia', how: '', dist: '' };
  const d = k.pos ? Math.round(k.pos.distanceTo(P.deathPos || P.pos)) : 0;
  return { who: k.name || 'Nemico', how: k.weapon || '', dist: d > 2 ? d + ' m' : '' };
}
function showKillCard() {
  let el = $('killCard'); if (!el) { el = document.createElement('div'); el.id = 'killCard'; document.body.appendChild(el); }
  const k = depKillInfo();
  el.innerHTML = `<small>${P.killer ? 'UCCISO DA' : 'SEI CADUTO'}</small><b>${k.who}</b><span>${[k.how, k.dist].filter(Boolean).join(' · ')}</span>`;
  el.classList.add('on'); document.body.classList.add('pDead');
}
function hideKillCard() { const el = $('killCard'); if (el) el.classList.remove('on'); document.body.classList.remove('pDead'); }
// nei primi istanti la visuale si gira verso chi ha sparato
function deathCam(dt) {
  const k = P.killer; if (!k || !k.pos || P.deathT > 2.6) return;
  const e = new V3(P.pos.x, P.pos.y + .3, P.pos.z), d = k.pos.clone().sub(e); if (d.length() < 1 || d.length() > 600) return;
  const wy = Math.atan2(-d.x, -d.z), wp = Math.atan2(d.y, Math.hypot(d.x, d.z)), f = Math.min(1, dt * 2.2);
  let dy = wy - P.yaw; while (dy > PI) dy -= TAU; while (dy < -PI) dy += TAU; P.yaw += dy * f; P.pitch += (wp - P.pitch) * f;
}

// ---------- schermata di rientro ----------
function openSpawnMenu() {
  P.spawnMenu = true; DEP.pts = deployPoints(); DEP.sel = Math.min(DEP.sel, DEP.pts.length - 1); hideKillCard();
  DEP.cls = depClasses(); if (DEP.cls) { const cur = SCEN === 'snp' ? (P.inv[0] && P.inv[0].id) : P.cls; DEP.ci = Math.max(0, DEP.cls.findIndex(c => c.id === cur)); }
  DEP.wait0 = DEP.wait = P.dead ? (SCEN === 'air' ? 1.5 : SCEN === 'tun' ? 3 : SCEN === 'snp' ? SNPCFG.respawn : 5) : 0;
  DEP.life = P.dead ? { k: STATS.kills - (P.lifeK || 0), t: GAME.time - (P.lifeT || 0) } : null;
  $('spawn').classList.remove('hidden'); depRenderMap(); drawDeploy();
}
function depMove(n) { DEP.sel = (DEP.sel + n + DEP.pts.length) % DEP.pts.length; drawDeploy(); }
function depCls(n) { if (!DEP.cls) return; DEP.ci = (DEP.ci + n + DEP.cls.length) % DEP.cls.length; drawDeploy(); }
function deployKey(c) {
  const n = c.startsWith('Digit') ? +c.slice(5) - 1 : -1;
  if (n >= 0 && n < DEP.pts.length) { DEP.sel = n; drawDeploy(); }
  else if (c === 'ArrowDown' || c === 'KeyS') depMove(1);
  else if (c === 'ArrowUp' || c === 'KeyW') depMove(-1);
  else if (c === 'ArrowRight' || c === 'KeyD' || c === 'KeyE') depCls(1);
  else if (c === 'ArrowLeft' || c === 'KeyA' || c === 'KeyQ') depCls(-1);
  else if ((c === 'Space' || c === 'Enter') && DEP.wait <= 0) depGo();
  else if (c === 'KeyB' && !P.dead) closeSpawnMenu();
}
// con il puntatore bloccato: rotella per scegliere il punto, clic per schierarsi
addEventListener('wheel', e => { if (P.spawnMenu && GAME.running) { e.stopImmediatePropagation(); depMove(e.deltaY > 0 ? 1 : -1); } }, { capture: true, passive: true });
addEventListener('mousedown', e => { if (P.spawnMenu && GAME.running) { e.stopImmediatePropagation(); if (e.button === 0 && DEP.wait <= 0) depGo(); if (e.button === 2) depCls(1); } }, true);
function depGo() {
  const p = DEP.pts[DEP.sel], c = DEP.cls && DEP.cls[DEP.ci];
  if (c && c.gun) p.gun = c.gun; else if (c && (p.kind === 'checkpoint' || p.kind === 'point' || p.kind === 'wave')) depApplyClass(c);
  P.lifeK = STATS.kills; P.lifeT = GAME.time; P.killer = null; hideKillCard();
  deploy(p);
}
function deploy(p) {
  if (p.kind === 'navy') { closeSpawnMenu(); return; }
  if (p.kind === 'plane') PL.spawnCarrier = p.carrier !== false;
  if (p.kind === 'snp') { closeSpawnMenu(); leaveMode(); resetPlayerState(); snpPlacePlayer(p); return; }
  if (p.kind === 'point') { closeSpawnMenu(); leaveMode(); resetPlayerState(); P.inBoat = false; const x = p.pos.x + rnd(-3, 3), z = p.pos.z + rnd(-2, 2); P.pos.set(x, Hf(x, z), z); P.yaw = p.yaw || 0; showMsg('Schierato: ' + p.label, 2.5); return; }
  if (p.kind === 'tank') { closeSpawnMenu(); leaveMode(); resetPlayerState(); P.inBoat = false; const t = p.tank; if (!t.alive) { respawn(); return; } P.pos.set(t.pos.x + 3, Hf(t.pos.x + 3, t.pos.z), t.pos.z); if (!t.player) enterTank(t); return; }
  chooseSpawn(p.kind);
}
function updateDeploy(dt) {
  if (!P.spawnMenu) return;
  if (DEP.wait > 0) { DEP.wait = Math.max(0, DEP.wait - dt); }
  DEP.t = (DEP.t || 0) - dt; if (DEP.t <= 0) { DEP.t = .2; drawDeploy(); }
}
// pericolo di un punto: nemici vivi nei dintorni
function depDanger(p) {
  if (!p.pos || p.kind === 'plane' || p.kind === 'naval' || p.kind === 'navy') return 0;
  let n = 0, near = false; for (const e of FOES()) if (e.alive && !e.removed) { const d = e.pos.distanceTo(p.pos); if (d < 45) n++; if (d < 18) near = true; }
  return near || n >= 3 ? 2 : n ? 1 : 0;
}
// zona inquadrata dalla mappa: punti di rientro e truppe (gli aerei e le navi lontane restano sul bordo)
function depBounds() {
  const xs = [], zs = [], add = v => { xs.push(v.x); zs.push(v.z); };
  for (const p of DEP.pts) if (p.pos && p.kind !== 'plane' && p.kind !== 'naval') add(p.pos);
  for (const a of FRIENDS()) if (a.alive) add(a.pos);
  if (SCEN !== 'snp') for (const e of FOES()) if (e.alive) add(e.pos);
  if (P.deathPos) add(P.deathPos); else add(P.pos);
  const q = (l, f) => { const s = l.slice().sort((a, b) => a - b); return s[Math.floor((s.length - 1) * f)]; };
  const x0 = q(xs, .04), x1 = q(xs, .96), z0 = q(zs, .04), z1 = q(zs, .96);
  const S = Math.max(x1 - x0, z1 - z0, SCEN === 'snp' ? 110 : 90) * 1.2;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, S };
}
// mappa vera: la scena ripresa dall'alto con una telecamera ortografica, una volta all'apertura
function depRenderMap() {
  const cv = $('depMap'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, Hh = cv.height;
  const B = DEP.B = depBounds(); DEP.img = null;
  try {
    const el = renderer.domElement, a = el.width / el.height, h = B.S / 2;
    const cam = new THREE.OrthographicCamera(-h * a, h * a, h, -h, 1, 3000);
    cam.position.set(B.cx, 1200, B.cz); cam.up.set(0, 0, -1); cam.lookAt(B.cx, 0, B.cz); cam.updateMatrixWorld();
    const fog = scene.fog, sky = typeof skyMesh !== 'undefined' && skyMesh ? skyMesh.visible : null; scene.fog = null; if (sky !== null) skyMesh.visible = false;
    renderer.setRenderTarget(null); renderer.render(scene, cam);
    const sw = el.height, sx = (el.width - sw) / 2, tmp = document.createElement('canvas'); tmp.width = W; tmp.height = Hh;
    tmp.getContext('2d').drawImage(el, sx, 0, sw, sw, 0, 0, W, Hh); DEP.img = tmp;
    scene.fog = fog; if (sky !== null) skyMesh.visible = sky;
  } catch (e) { DEP.img = null; }
  g.fillStyle = '#1b1f1c'; g.fillRect(0, 0, W, Hh);
}
function drawDeploy() {
  const cv = $('depMap'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, B = DEP.B || (DEP.B = depBounds()), k = W / B.S;
  const mx = x => clamp(W / 2 + (x - B.cx) * k, 12, W - 12), mz = z => clamp(Hh / 2 + (z - B.cz) * k, 12, Hh - 12);
  if (DEP.img) { g.filter = 'saturate(.65) contrast(1.08) brightness(.9)'; g.drawImage(DEP.img, 0, 0); g.filter = 'none'; } else { g.fillStyle = '#2b302a'; g.fillRect(0, 0, W, Hh); }
  g.strokeStyle = 'rgba(240,230,200,.07)'; g.lineWidth = 1; for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(W * i / 10, 0); g.lineTo(W * i / 10, Hh); g.moveTo(0, Hh * i / 10); g.lineTo(W, Hh * i / 10); g.stroke(); }
  for (const a of FRIENDS()) if (a.alive) { g.fillStyle = '#5fc4ff'; g.beginPath(); g.arc(mx(a.pos.x), mz(a.pos.z), 2.6, 0, TAU); g.fill(); }
  if (SCEN !== 'snp') for (const e of FOES()) if (e.alive && (e.spotT > 0 || e.seenT > 0 || R() < .35)) { g.fillStyle = '#ff5a4a'; g.fillRect(mx(e.pos.x) - 2, mz(e.pos.z) - 2, 4, 4); }
  if (P.deathPos) { const x = mx(P.deathPos.x), y = mz(P.deathPos.z); g.strokeStyle = '#ff5a4a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.stroke(); }
  if (P.killer && P.killer.pos && SCEN !== 'snp') { g.fillStyle = '#ff5a4a'; g.font = 'bold 13px Oswald, sans-serif'; g.textAlign = 'center'; g.fillText('☠', mx(P.killer.pos.x), mz(P.killer.pos.z) - 6); }
  DEP.pts.forEach((p, i) => {
    if (!p.pos) return; const x = mx(p.pos.x), y = mz(p.pos.z), sel = i === DEP.sel, dg = depDanger(p);
    if (sel) { g.strokeStyle = 'rgba(255,208,96,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 15 + Math.sin(performance.now() / 180) * 2, 0, TAU); g.stroke(); }
    g.fillStyle = sel ? '#ffd060' : '#efe6cf'; g.beginPath(); g.arc(x, y, sel ? 10 : 8, 0, TAU); g.fill();
    g.strokeStyle = ['#7bd88f', '#e8c46a', '#ff5a4a'][dg]; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#111'; g.font = 'bold 11px Oswald, sans-serif'; g.textAlign = 'center'; g.fillText(i + 1, x, y + 4);
  });
  const DG = ['SICURO', 'CONTESO', 'SOTTO FUOCO'];
  $('depList').innerHTML = DEP.pts.map((p, i) => { const dg = depDanger(p); return `<div class="dp ${i === DEP.sel ? 'on' : ''}"><kbd>${i + 1}</kbd><div><b>${p.label}</b><small>${p.sub}</small></div><i class="dg d${dg}" title="${DG[dg]}"></i></div>`; }).join('');
  const lo = $('depLoad');
  if (DEP.cls) { const c = DEP.cls[DEP.ci]; lo.style.display = '';
    lo.innerHTML = `<h4>${SCEN === 'snp' ? 'ARMA' : 'RUOLO'}</h4>` + DEP.cls.map((x, i) => `<div class="cl ${i === DEP.ci ? 'on' : ''}"><b>${x.n}</b>${i === DEP.ci ? `<small>${x.d}</small><div class="wp">${x.inv.filter(Boolean).map(id => `<span>${WEAPONS[id].name}</span>`).join('')}</div>` : ''}</div>`).join('') + `<div class="kh"><kbd>A</kbd><kbd>D</kbd> cambia</div>`;
  } else lo.style.display = 'none';
  const ready = DEP.wait <= 0, f = DEP.wait0 ? 1 - DEP.wait / DEP.wait0 : 1;
  $('depBar').style.width = (f * 100).toFixed(1) + '%';
  $('depGo').className = ready ? 'ok' : ''; $('depGo').innerHTML = ready ? 'SCHIERATI <kbd>Spazio</kbd>' : 'RIENTRO TRA ' + Math.ceil(DEP.wait) + ' s';
  const lf = DEP.life; $('depLife').innerHTML = lf ? `ULTIMA VITA · <b>${lf.k}</b> ${lf.k === 1 ? 'uccisione' : 'uccisioni'} · <b>${Math.floor(lf.t / 60)}:${String(Math.floor(lf.t % 60)).padStart(2, '0')}</b> in campo` + (P.killer ? ` · ucciso da <b>${depKillInfo().who}</b>` : '') : '';
  $('depHint').innerHTML = `<kbd>W</kbd><kbd>S</kbd> o rotella: punto · ${DEP.cls ? '<kbd>A</kbd><kbd>D</kbd>: ' + (SCEN === 'snp' ? 'arma' : 'ruolo') + ' · ' : ''}clic o <kbd>Spazio</kbd>: schierati${P.dead ? '' : ' · <kbd>B</kbd> annulla'}`;
}
