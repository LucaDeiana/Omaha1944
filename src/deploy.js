"use strict";
// ============================================================
//  Schermata di rientro in stile Battlefield: mappa tattica,
//  punti di schieramento e conto alla rovescia
// ============================================================
const DEP = { pts: [], sel: 0, wait: 0 };
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
function openSpawnMenu() {
  P.spawnMenu = true; DEP.pts = deployPoints(); DEP.sel = Math.min(DEP.sel, DEP.pts.length - 1);
  DEP.wait = P.dead ? (SCEN === 'air' ? 1.5 : SCEN === 'tun' ? 3 : SCEN === 'snp' ? SNPCFG.respawn : 5) : 0;
  $('spawn').classList.remove('hidden'); drawDeploy();
}
function deployKey(c) {
  const n = c.startsWith('Digit') ? +c.slice(5) - 1 : -1;
  if (n >= 0 && n < DEP.pts.length) { DEP.sel = n; drawDeploy(); }
  else if (c === 'ArrowDown' || c === 'KeyS') { DEP.sel = (DEP.sel + 1) % DEP.pts.length; drawDeploy(); }
  else if (c === 'ArrowUp' || c === 'KeyW') { DEP.sel = (DEP.sel + DEP.pts.length - 1) % DEP.pts.length; drawDeploy(); }
  else if ((c === 'Space' || c === 'Enter') && DEP.wait <= 0) deploy(DEP.pts[DEP.sel]);
  else if (c === 'KeyB' && !P.dead) closeSpawnMenu();
}
function deploy(p) {
  if (p.kind === 'navy') { closeSpawnMenu(); return; }
  if (p.kind === 'plane') PL.spawnCarrier = p.carrier !== false;
  if (p.kind === 'plane') PL.spawnCarrier = p.carrier !== false;
  if (p.kind === 'snp') { closeSpawnMenu(); leaveMode(); resetPlayerState(); snpPlacePlayer(p); return; }
  if (p.kind === 'point') { closeSpawnMenu(); leaveMode(); resetPlayerState(); P.inBoat = false; const x = p.pos.x + rnd(-3, 3), z = p.pos.z + rnd(-2, 2); P.pos.set(x, Hf(x, z), z); P.yaw = p.yaw || 0; showMsg('Schierato: ' + p.label, 2.5); return; }
  if (p.kind === 'tank') { closeSpawnMenu(); leaveMode(); resetPlayerState(); P.inBoat = false; const t = p.tank; if (!t.alive) { respawn(); return; } P.pos.set(t.pos.x + 3, Hf(t.pos.x + 3, t.pos.z), t.pos.z); if (!t.player) enterTank(t); return; }
  chooseSpawn(p.kind);
}
function updateDeploy(dt) {
  if (!P.spawnMenu) return;
  if (DEP.wait > 0) { DEP.wait = Math.max(0, DEP.wait - dt); }
  DEP.t = (DEP.t || 0) - dt; if (DEP.t <= 0) { DEP.t = .25; drawDeploy(); }
}
function drawDeploy() {
  const cv = $('depMap'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, Hh = cv.height;
  if (SCEN !== 'omaha') { drawDeployGeneric(g, W, Hh); return; }
  // area dei combattimenti: x -360..360, z 140..-340; ciò che è fuori viene fissato al bordo
  const mx = x => clamp((x + 360) / 720, .03, .97) * W, mz = z => clamp((140 - z) / 480, .04, .97) * Hh;
  g.fillStyle = '#26333a'; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#c2b080'; g.fillRect(0, mz(90), W, mz(-58) - mz(90));
  g.fillStyle = '#4f5a34'; g.fillRect(0, mz(-58), W, Hh - mz(-58));
  g.fillStyle = '#3b4527'; for (const h of HEDGES) g.fillRect(0, mz(h.z) - 1, W, 2);
  g.fillStyle = '#7a6f5a'; for (const [vx, vz] of [[0, -283], [-700, -330], [-1250, -300], [600, -420]]) g.fillRect(mx(vx) - 9, mz(vz) - 6, 18, 12);
  for (const b of [...WORLD.bunkers, ...(WORLD.extraBunkers || [])]) { g.fillStyle = b.destroyed || (b.gunner && !b.gunner.alive) ? '#666' : '#d23'; g.fillRect(mx(b.x) - 3, mz(b.z) - 3, 6, 6); }
  g.fillStyle = '#9aa3ab'; for (const s of [[-230, 780], [190, 840]]) g.fillRect(mx(s[0]) - 10, mz(s[1]) - 2, 20, 4);
  for (const a of allies) if (a.alive && a.state !== 'boat' && R() < .5) { g.fillStyle = '#6cf'; g.fillRect(mx(a.pos.x), mz(a.pos.z), 2, 2); }
  for (const e of enemies) if (e.alive && R() < .5) { g.fillStyle = '#f66'; g.fillRect(mx(e.pos.x), mz(e.pos.z), 2, 2); }
  DEP.pts.forEach((p, i) => {
    const x = mx(p.pos.x), y = mz(p.pos.z), sel = i === DEP.sel;
    g.fillStyle = sel ? '#ffd060' : '#e8e3d0'; g.beginPath(); g.arc(x, y, sel ? 9 : 6, 0, TAU); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 11px Oswald, sans-serif'; g.textAlign = 'center'; g.fillText(i + 1, x, y + 4);
  });
  $('depList').innerHTML = DEP.pts.map((p, i) => `<div class="sp ${i === DEP.sel ? 'on' : ''}"><kbd>${i + 1}</kbd> ${p.label} <small>${p.sub}</small></div>`).join('') +
    `<div class="spHint">${DEP.wait > 0 ? 'Rientro tra ' + Math.ceil(DEP.wait) + ' s' : 'Premi <kbd>Spazio</kbd> per schierarti'} · <kbd>1-9</kbd> scegli${P.dead ? '' : ' · <kbd>B</kbd> annulla'}</div>`;
}
// altre modalità: mappa neutra centrata sui punti di schieramento e sulle truppe
function drawDeployGeneric(g, W, Hh) {
  const xs = [], zs = [], fr = (typeof FRIENDS === 'function' ? FRIENDS() : []).filter(a => a.alive), fo = (typeof FOES === 'function' ? FOES() : []).filter(e => e.alive);
  for (const o of [...DEP.pts.filter(p => p.kind !== 'plane' && p.kind !== 'naval'), ...fr, ...(SCEN === 'snp' ? [] : fo)]) if (o.pos) { xs.push(o.pos.x); zs.push(o.pos.z); }
  if (!xs.length) { xs.push(0); zs.push(0); }
  let x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const s = Math.max(x1 - x0, z1 - z0, 60) * 1.15, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, k = Math.min(W, Hh) / s;
  const mx = x => clamp(W / 2 + (x - cx) * k, 10, W - 10), mz = z => clamp(Hh / 2 + (z - cz) * k, 10, Hh - 10);
  g.fillStyle = SCEN === 'sea' || SCEN === 'air' ? '#22323d' : SCEN === 'tun' || SCEN === 'kas' ? '#7a6a4c' : SCEN === 'ard' ? '#c9ccc9' : '#3d4236'; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(W * i / 8, 0); g.lineTo(W * i / 8, Hh); g.stroke(); g.beginPath(); g.moveTo(0, Hh * i / 8); g.lineTo(W, Hh * i / 8); g.stroke(); }
  for (const a of fr) { g.fillStyle = '#6cf'; g.fillRect(mx(a.pos.x) - 1, mz(a.pos.z) - 1, 3, 3); }
  if (SCEN !== 'snp') for (const e of fo) if (R() < .5) { g.fillStyle = '#f66'; g.fillRect(mx(e.pos.x) - 1, mz(e.pos.z) - 1, 3, 3); }
  (SCEN === 'snp' ? [DEP.pts[DEP.sel]] : DEP.pts).forEach((p) => {
    const i = DEP.pts.indexOf(p), x = mx(p.pos.x), y = mz(p.pos.z), sel = i === DEP.sel;
    g.fillStyle = sel ? '#ffd060' : '#e8e3d0'; g.beginPath(); g.arc(x, y, sel ? 9 : 6, 0, TAU); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 11px Oswald, sans-serif'; g.textAlign = 'center'; g.fillText(SCEN === 'snp' ? '★' : i + 1, x, y + 4);
  });
  $('depList').innerHTML = DEP.pts.map((p, i) => `<div class="sp ${i === DEP.sel ? 'on' : ''}"><kbd>${i + 1}</kbd> ${p.label} <small>${p.sub}</small></div>`).join('') +
    `<div class="spHint">${DEP.wait > 0 ? 'Rientro tra ' + Math.ceil(DEP.wait) + ' s' : 'Premi <kbd>Spazio</kbd> per schierarti'} · <kbd>1-9</kbd> scegli${P.dead ? '' : ' · <kbd>B</kbd> annulla'}</div>`;
}
