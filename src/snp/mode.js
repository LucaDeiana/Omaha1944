"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — regole della partita: squadre, bot,
//  rinascita, punteggio, fine partita. Solo con SCEN === 'snp'.
// ============================================================
const SNPCFG = { bots: 6, fill: true, diff: '3', prof: 'rnd', respawn: 5, goal: 50, time: 900, on: true };
const SNP_NAMES = {
  A: ['Miller', 'Jackson', 'Reese', 'Doyle', 'Parker', 'Mendez', 'Kowalczyk', 'Hayes', 'Boone', 'Carter', 'Sullivan', 'Wade', 'Hollis', 'Price', 'Abbott', 'Vance'],
  E: ['Hans', 'Fritz', 'Kurt', 'Otto', 'Willi', 'Ernst', 'Karl', 'Heinz', 'Paul', 'Rudi', 'Walter', 'Günter', 'Josef', 'Lothar', 'Anton', 'Emil'],
};
Object.assign(SNP, { sounds: [], score: { A: 0, E: 0 }, board: new Map(), t: 0, over: false, el: null, respQ: [], me: 'Tu', lastKiller: null, deathPos: null });

function snpReadCfg() {
  const v = id => $(id) ? $(id).value : null;
  if (v('optSnpBots') !== null) SNPCFG.bots = +v('optSnpBots');
  if (v('optSnpDiff') !== null) SNPCFG.diff = v('optSnpDiff');
  if (v('optSnpProf') !== null) SNPCFG.prof = v('optSnpProf');
  if (v('optSnpResp') !== null) SNPCFG.respawn = +v('optSnpResp');
  if ($('optSnpFill')) SNPCFG.fill = $('optSnpFill').checked;
  if (v('optSnpGun') !== null) SNPCFG.gun = v('optSnpGun');
}
function snpLevel() { return SNPCFG.diff === 'rnd' ? 1 + (R() * 5 | 0) : SNPCFG.diff === 'mix' ? pick([2, 3, 3, 3, 4, 4, 5]) : +SNPCFG.diff; }
function snpProfile() { return SNPCFG.prof === 'rnd' ? pick(SNP_PROF_KEYS) : SNPCFG.prof; }

function initSniper() {
  SNP.on = true; snpReadCfg();
  SNP.score = { A: 0, E: 0 }; SNP.board.clear(); SNP.t = 0; SNP.over = false; SNP.respQ = []; SNP.sounds = [];
  P.inBoat = false; P.boat = null; P.mode = 'foot';
  try { SNP.me = ($('optName') && $('optName').value.trim()) || 'Tu'; } catch (e) { SNP.me = 'Tu'; }
  // equipaggiamento: fucile di precisione della propria fazione e pistola, niente granate
  const rifle = SNP_GUNS[PT].includes(SNPCFG.gun) ? SNPCFG.gun : SNP_GUNS[PT][0], w = WEAPONS[rifle];
  P.inv = [{ id: rifle, mag: w.mag, res: w.res }, null, { id: 'colt', mag: 7, res: 21 }]; P.cur = 0; P.prevSlot = 2; P.nades = 0; P.charges = 0;
  if (typeof setViewmodel === 'function') setViewmodel(rifle);
  snpPlacePlayer();
  MISSION.checkpoint = { pos: P.pos.clone(), yaw: P.yaw };
  SNP.board.set(SNP.me, { kills: 0, deaths: 0, team: PT, me: true, lvl: 0 });
  // bot per squadra; la squadra del giocatore ne ha uno in meno (il suo posto)
  snpBalance();
  MISSION.title = 'Solo cecchini — ' + SNP.M.name;
  MISSION.objText = `Prima squadra a ${SNPCFG.goal} uccisioni`;
  MISSION.stage = 0; MISSION.stageT = 0;
  if (!SNP.el) { SNP.el = document.createElement('div'); SNP.el.id = 'snpScore'; SNP.el.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:18;font:600 15px/1.35 Oswald,sans-serif;color:#efe6cf;text-shadow:0 1px 3px #000;text-align:center;letter-spacing:.06em'; document.body.appendChild(SNP.el); }
  if (!SNP.tab) { SNP.tab = document.createElement('div'); SNP.tab.id = 'snpTab'; SNP.tab.style.cssText = 'position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:19;display:none;background:rgba(14,14,12,.86);border:1px solid rgba(232,196,106,.35);padding:14px 20px;font:500 14px/1.6 Oswald,sans-serif;color:#efe6cf;min-width:min(560px,92vw)'; document.body.appendChild(SNP.tab); }
}
// rinascita lontano dal punto di morte e dai nemici visibili
function snpSpawnNode(team, avoid) {
  let best = null, bs = -1e9;
  for (const n of SNP.spawns[team]) { let s = R() * 8; if (avoid) s += Math.min(30, n.pos.distanceTo(avoid)); for (const b of snpTeamBots(team)) if (b.pos.distanceTo(n.pos) < 2) s -= 20; if (s > bs) { bs = s; best = n; } }
  return best || SNP.nav[team][0];
}
function snpPlacePlayer(dp) {
  if (dp && dp.gun && dp.gun !== P.inv[0].id) { P.inv[0] = { id: dp.gun, mag: 0, res: 0 }; SNPCFG.gun = dp.gun; }
  P.cur = 0; P.prevSlot = 2;
  const n = snpSpawnNode(PT, SNP.deathPos);
  P.pos.copy(n.pos); P.pos.x += rnd(-.5, .5); P.pos.z += rnd(-.5, .5); P.pos.y = snpFloor(P.pos.x, P.pos.z, P.pos.y + .2);
  P.yaw = PT === 'A' ? 0 : PI; P.pitch = 0; P.stance = 0;
  const w = WEAPONS[P.inv[0].id]; P.inv[0].mag = w.mag; P.inv[0].res = w.res; P.inv[2].mag = 7; P.inv[2].res = 21; P.nades = 0;
}
function snpSpawnBot(team, name) {
  const used = new Set(snpTeamBots(team).map(b => b.name));
  const NL = (SNP.M.names && SNP.M.names[team]) || SNP_NAMES[team];
  name = name || NL.find(n => !used.has(n) && !SNP.board.has(n + '#x')) || NL.find(n => !used.has(n)) || 'Bot';
  const prev = SNP.board.get(name), lvl = prev ? prev.lvl : snpLevel(), prof = prev ? prev.prof : snpProfile();
  const n = snpSpawnNode(team, prev && prev.deathPos);
  const b = new SnpBot(team, n.pos.x + rnd(-.4, .4), n.pos.y, n.pos.z + rnd(-.4, .4), { name, lvl, prof });
  if (!prev) SNP.board.set(name, { kills: 0, deaths: 0, team, bot: true, lvl, prof });
  b.thinkT = rnd(.1, .6);
  return b;
}
function snpRow(name, team, extra) { let r = SNP.board.get(name); if (!r) { r = { kills: 0, deaths: 0, team, ...extra }; SNP.board.set(name, r); } return r; }
// uccisione: punteggio di squadra e tabellone (solo l'host o la partita in solitario decidono)
function snpCredit(kName, kTeam, vName, vTeam, zone) {
  if (SNP.over || NET.client) return;
  const vr = vName ? snpRow(vName, vTeam) : null; if (vr) vr.deaths++;
  if (kName && kTeam !== vTeam) { snpRow(kName, kTeam).kills++; SNP.score[kTeam]++; }
  const head = zone === 'head' ? ' — colpo alla testa' : '';
  const txt = !kName ? vName + ' è caduto' : kName === SNP.me ? 'Hai eliminato ' + vName + head : vName === SNP.me ? kName + ' ti ha eliminato' + head : kName + ' ha eliminato ' + vName + head;
  feed(txt); if (kName === SNP.me && kTeam !== vTeam) { STATS.kills++; caSniperKill(zone === 'head'); }
  if (vName === SNP.me) caSniperDied();
  if (NET.on && NET.host) netSend({ t: 'snpfeed', k: kName, v: vName, zone });
}
function snpOnDeath(s, byPlayer, zone) {
  if (!s.snp) return;
  if (byPlayer) snpCredit(SNP.me, PT, s.name, s.team, zone);
  else if (s.lastHitPeer) { const p = NET.peers.get(s.lastHitPeer); snpCredit(p ? p.name : '?', p ? p.side : (s.team === 'A' ? 'E' : 'A'), s.name, s.team, zone); }
  else if (s.lastHit && s.lastHit.name) snpCredit(s.lastHit.name, s.lastHit.team, s.name, s.team, zone);
  else snpCredit(null, null, s.name, s.team, zone);
  if (s.post) { s.post.occ = null; s.post = null; }
  const r = SNP.board.get(s.name); if (r) r.deathPos = s.pos.clone();
  if (s.leaveOnDeath) { SNP.board.delete(s.name); return; }
  SNP.respQ.push({ t: SNPCFG.respawn, team: s.team, name: s.name });
}
function snpPlayerDied() {
  SNP.deathPos = P.pos.clone();
  const k = SNP.killBy; SNP.killBy = null;
  if (NET.client) { netSend({ t: 'snpd', by: k ? k.name : null, bt: k ? k.team : null, zone: k ? k.zone : null }); return; }
  snpCredit(k ? k.name : null, k ? k.team : null, SNP.me, PT, k ? k.zone : null);
}
function snpDeployPoints() {
  const pos = snpSpawnNode(PT, SNP.deathPos).pos.clone(), cur = P.inv[0] ? P.inv[0].id : SNP_GUNS[PT][0];
  return [{ label: PT === 'A' ? SNP.M.sideA : SNP.M.sideE, sub: 'posizione sicura nel tuo edificio', kind: 'snp', gun: cur, pos }];
}

function updateSniper(dt) {
  MISSION.stageT += dt; updateSubs(dt); snpSmoke(dt); if (SNP.map === 'stalingrado' && ARD.snow) updateSnowfall(dt);
  while (SNP.sounds.length && GAME.time - SNP.sounds[0].t > 3) SNP.sounds.shift();
  snpHud();
  if (SNP.over) return;
  SNP.t += dt;
  // rinascita dei bot e posti lasciati ai giocatori che entrano
  for (let i = SNP.respQ.length - 1; i >= 0; i--) { const r = SNP.respQ[i]; r.t -= dt; if (r.t <= 0) { SNP.respQ.splice(i, 1); snpSpawnBot(r.team, r.name); } }
  for (const arr of [allies, enemies]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].removed) arr.splice(i, 1);
  SNP.balT = (SNP.balT || 0) - dt; if (SNP.balT <= 0) { SNP.balT = 1; snpBalance(); }
  if (NET.on && NET.host) { SNP.netT = (SNP.netT || 0) - dt; if (SNP.netT <= 0) { SNP.netT = .5; netSend(snpBoardMsg()); } }
  const left = SNPCFG.time - SNP.t;
  if (Math.max(SNP.score.A, SNP.score.E) >= SNPCFG.goal || left <= 0) {
    SNP.over = true;
    for (const b of [...snpTeamBots('A'), ...snpTeamBots('E')]) { b.tgt = null; b.st = 'OBSERVE'; b.mag = 0; b.res = 0; }
    if (NET.on && NET.host) netSend(snpBoardMsg());
    snpEnd();
  }
}
function snpEnd() {
  const win = SNP.score[PT] > SNP.score[PT === 'A' ? 'E' : 'A'];
  GAME.endTitle = SNP.score.A === SNP.score.E ? 'PAREGGIO' : SNP.score.A > SNP.score.E ? 'VITTORIA: ' + SNP.M.teamA : 'VITTORIA: ' + SNP.M.teamE;
  GAME.endText = snpBoardHTML(true) + '<br>';
  after(4, () => GAME.end(win));
}
function snpHud() {
  const left = Math.max(0, SNPCFG.time - SNP.t), clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, me = SNP.board.get(SNP.me) || { kills: 0, deaths: 0 };
  SNP.el.innerHTML = `<span style="color:#9fc2e8">${SNP.M.teamA} ${SNP.score.A}</span> &nbsp;—&nbsp; <span style="color:#e8c98f">${SNP.M.teamE} ${SNP.score.E}</span><br><span style="font-size:13px">${clock} · obiettivo ${SNPCFG.goal} · tu ${me.kills}/${me.deaths}</span>`;
  SNP.tab.style.display = KEYS.Tab && !P.spawnMenu ? 'block' : 'none';
  if (KEYS.Tab) SNP.tab.innerHTML = snpBoardHTML();
}
// giocatori umani per squadra (tu più quelli in rete)
function snpHumans(team) { let n = PT === team ? 1 : 0; if (NET.on) for (const p of NET.peers.values()) if (p.side === team) n++; return n; }
// numero di bot: quelli richiesti, meno i posti presi dai giocatori umani se il riempimento è attivo
function snpBalance() {
  if (NET.client || SNP.over) return;
  for (const team of ['A', 'E']) {
    const want = !SNPCFG.on ? 0 : SNPCFG.fill ? Math.max(0, SNPCFG.bots - snpHumans(team)) : SNPCFG.bots;
    const alive = snpTeamBots(team).filter(b => !b.leaveOnDeath), queued = SNP.respQ.filter(r => r.team === team);
    let have = alive.length + queued.length;
    while (have > want) {
      const q = SNP.respQ.findIndex(r => r.team === team);
      if (q >= 0) { SNP.board.delete(SNP.respQ[q].name); SNP.respQ.splice(q, 1); have--; continue; }
      const b = alive.filter(b => b.st !== 'AIM' && b.st !== 'FIRE').sort((x, y) => (SNP.board.get(x.name) || {}).kills - (SNP.board.get(y.name) || {}).kills)[0];
      if (!b) { alive[0].leaveOnDeath = true; alive.shift(); have--; continue; }
      b.alive = false; b.removed = true; b.body.removed = true; if (b.post) b.post.occ = null; SNP.board.delete(b.name); alive.splice(alive.indexOf(b), 1); have--;
      feed(`${b.name} lascia il posto a un giocatore`);
    }
    for (; have < want; have++) snpSpawnBot(team);
  }
}
// ---------- rete: l'host decide punteggio e bot, gli altri ricevono il tabellone ----------
function snpBoardMsg() {
  return { t: 'snpb', sc: [SNP.score.A, SNP.score.E], tt: Math.round(SNP.t), over: SNP.over ? 1 : 0, cfg: [SNPCFG.goal, SNPCFG.time],
    b: [...SNP.board.entries()].map(([n, r]) => [n, r.team, r.kills, r.deaths, r.bot ? r.lvl : 0, r.bot ? r.prof : '']) };
}
function snpOnNet(m) {
  if (m.t === 'snpb') {
    if (!NET.client) return true;
    SNP.score.A = m.sc[0]; SNP.score.E = m.sc[1]; SNP.t = m.tt; SNPCFG.goal = m.cfg[0]; SNPCFG.time = m.cfg[1];
    SNP.board.clear(); for (const [n, team, k, d, lvl, prof] of m.b) SNP.board.set(n, { kills: k, deaths: d, team, bot: !!lvl, lvl, prof });
    if (m.over && !SNP.over) { SNP.over = true; snpEnd(); }
    return true;
  }
  if (m.t === 'snpd') {   // un giocatore in rete è caduto: l'host assegna l'uccisione
    if (NET.host) { const p = NET.peers.get(m.id); if (p) snpCredit(m.by, m.bt, p.name, p.side, m.zone); }
    return true;
  }
  if (m.t === 'snpfeed') {
    if (!NET.client) return true;
    const head = m.zone === 'head' ? ' — colpo alla testa' : '';
    feed(!m.k ? m.v + ' è caduto' : m.k === SNP.me ? 'Hai eliminato ' + m.v + head : m.v === SNP.me ? m.k + ' ti ha eliminato' + head : m.k + ' ha eliminato ' + m.v + head);
    if (m.k === SNP.me) { STATS.kills++; caSniperKill(m.zone === 'head'); }
    if (m.v === SNP.me) caSniperDied();
    return true;
  }
  if (m.t === 'newhost') {
    NET.hostId = m.id;
    if (m.id === NET.id) {   // questo PC diventa l'host: i bot ripartono da qui, il punteggio resta
      NET.host = true; NET.client = false;
      for (const [nid, s] of NET.proxies) { s.alive = false; s.removed = true; s.body.removed = true; } NET.proxies.clear();
      SNP.respQ = []; snpBalance(); feed('Sei il nuovo host della partita');
    } else feed('Nuovo host della partita');
    return true;
  }
  if (m.t === 'mapdiff') { feed('Sul server si gioca un\'altra mappa: partita in solitario'); try { NET.ws.close(); } catch (e) { } NET.on = false; return true; }
  return false;
}
function snpClientTick(dt) { MISSION.stageT += dt; updateSubs(dt); snpSmoke(dt); if (SNP.map === 'stalingrado' && ARD.snow) updateSnowfall(dt); snpHud(); }
function snpBoardHTML(end) {
  const rows = [...SNP.board.entries()].map(([n, r]) => ({ n, ...r }));
  const col = team => rows.filter(r => r.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map(r => { r.me = r.n === SNP.me; return r; }).map(r => `<tr${r.me ? ' class="me" style="color:#e8c46a"' : ''}><td>${r.n}${r.bot ? ` <small style="opacity:.6">${SNP_DIFF[r.lvl].name} · ${SNP_PROF[r.prof].name.toLowerCase()}</small>` : ''}</td><td style="text-align:right;padding-left:14px">${r.kills}</td><td style="text-align:right;padding-left:10px">${r.deaths}</td></tr>`).join('');
  const head = `<tr style="opacity:.6;font-size:12px"><td></td><td style="text-align:right">U</td><td style="text-align:right">M</td></tr>`;
  return `<div style="display:flex;gap:28px;justify-content:center;flex-wrap:wrap"><div><b style="color:#9fc2e8">${SNP.M.teamA} ${SNP.score.A}</b><table>${head}${col('A')}</table></div><div><b style="color:#e8c98f">${SNP.M.teamE} ${SNP.score.E}</b><table>${head}${col('E')}</table></div></div>`;
}
