"use strict";
// ============================================================
//  Multiplayer in rete locale: gli altri giocatori compaiono come
//  soldati della loro fazione, si possono colpire, e le postazioni
//  (MG42, mortai) sono occupabili da un solo giocatore alla volta.
// ============================================================
const NET = { ws: null, on: false, id: 0, peers: new Map(), sendT: 0, tags: [] };

function netAvailable() { return location.protocol === 'http:' || location.protocol === 'https:'; }
function connectNet(name, side) {
  return new Promise(res => {
    let done = false; const fin = ok => { if (!done) { done = true; res(ok); } };
    try { NET.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return fin(false); }
    NET.ws.onopen = () => { NET.on = true; netSend({ t: 'join', name, side }); fin(true); };
    NET.ws.onerror = () => fin(false);
    NET.ws.onclose = () => { if (NET.on) { NET.on = false; feed('Connessione al server persa'); for (const p of NET.peers.values()) netRemovePuppet(p); NET.peers.clear(); } fin(false); };
    NET.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } netOnMessage(m); };
    setTimeout(() => fin(false), 3000);
  });
}
function netSend(m) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(m)); }
function netPeer(id, name, side) {
  let p = NET.peers.get(id);
  if (!p) { p = { id, name: name || 'Soldato', side: side || 'A', puppet: null, tp: new V3(), yaw: 0, pitch: 0, st: 0, a: false, w: 'garand', mode: 'foot', tag: null }; NET.peers.set(id, p); }
  if (name) p.name = name; if (side) p.side = side;
  return p;
}
function netOnMessage(m) {
  if (m.t === 'welcome') { NET.id = m.id; for (const x of m.peers) netPeer(x.id, x.name, x.side); for (const [i, by] of m.occ) if (STATIONS[i]) STATIONS[i].occupant = by; feed(`Connesso al server — giocatori presenti: ${m.peers.length + 1}`); return; }
  if (m.t === 'join') { netPeer(m.id, m.name, m.side); feed(`${m.name} è entrato (${m.side === 'E' ? 'Asse' : 'Alleati'})`); return; }
  if (m.t === 'leave') { const p = NET.peers.get(m.id); if (p) { feed(`${p.name} ha lasciato la partita`); netRemovePuppet(p); if (p.tag) p.tag.remove(); NET.peers.delete(m.id); } for (const s of STATIONS) if (s.occupant === m.id) s.occupant = null; return; }
  if (m.t === 'feed') { feed(m.text); return; }
  if (m.t === 'occ') { const s = STATIONS[m.i]; if (!s) return; if (m.denied) { if (STN.cur === s) { leaveStation(); showMsg('Postazione già occupata', 2); } s.occupant = m.by; return; } if (STN.cur !== s) s.occupant = m.by ? m.by : null; return; }
  const p = netPeer(m.id);
  if (m.t === 's') {
    p.tp.set(m.p[0], m.p[1], m.p[2]); p.yaw = m.y; p.pitch = m.pi; p.st = m.st; p.w = m.w; p.mode = m.m;
    if (m.a && !p.a) netSpawnPuppet(p);
    if (!m.a && p.a && p.puppet && p.puppet.alive) { p.puppet.remote = null; p.puppet.die(null, false, 'body', { dir: new V3(rnd(-1, 1), 0, rnd(-1, 1)).normalize(), power: 2, joint: 15 }); p.puppet = null; }
    p.a = m.a;
    if (p.puppet && p.puppet.team !== p.side) { netRemovePuppet(p); if (p.a) netSpawnPuppet(p); }
  } else if (m.t === 'shot') {
    const o = new V3(m.o[0], m.o[1], m.o[2]), e = new V3(m.e[0], m.e[1], m.e[2]);
    if (R() < .5) fxTracer(o, e, .9); sfxShot(m.snd || 'garand', o);
    if (P.targetable() && P.mode === 'foot' && p.side !== PT) P.nearMiss(o, e);
  } else if (m.t === 'boom') {
    explode(new V3(m.p[0], m.p[1], m.p[2]), m.r, m.d, {});
  } else if (m.t === 'hit') {
    if (!P.targetable()) return;
    const from = p.puppet ? p.puppet.pos.clone().add(new V3(0, 1.4, 0)) : P.pos.clone();
    P.damage(m.dm * (m.blast ? 1 : P.hitMul() / .6), from, !!m.blast);
    if (P.dead && !NET.killedSent) { NET.killedSent = true; netSend({ t: 'kill', to: m.id }); }
  }
}
function netKind(w) { return w === 'kar98zf' || w === 'springfield' ? 'sniper' : w === 'mp40' || w === 'thompson' ? 'smg' : w === 'bar' ? 'bar' : 'rifle'; }
function netSpawnPuppet(p) {
  netRemovePuppet(p);
  const s = new Soldier(p.side, netKind(p.w), p.tp.x, p.tp.z, { state: 'post', stationary: true, name: p.name, y: p.tp.y });
  s.remote = p; s.fixedY = true; p.puppet = s; s.yaw = p.yaw;
}
function netRemovePuppet(p) {
  const s = p.puppet; if (!s) return;
  s.remote = null; s.alive = false; s.removed = true; s.body.removed = true; p.puppet = null;
}
// animazione dei soldati degli altri giocatori
function netPuppet(s, dt) {
  const p = s.remote; if (!p) return;
  const k = Math.min(1, dt * 12);
  s.pos.x = lerp(s.pos.x, p.tp.x, k); s.pos.z = lerp(s.pos.z, p.tp.z, k); s.pos.y = lerp(s.pos.y, p.tp.y, k);
  if (s.pos.distanceToSquared(p.tp) > 400) s.pos.copy(p.tp);
  s.yaw = angLerp(s.yaw, p.yaw, k); s.aim = p.pitch;
  s.crouch = lerp(s.crouch, p.st === 1 ? 1 : 0, k); s.prone = lerp(s.prone, p.st === 2 ? 1 : 0, k);
  s.target = null; s.dest = null;
  s.update(dt);
}
function netSendState(dt) {
  if (!NET.on) return;
  NET.sendT -= dt; if (NET.sendT > 0) return; NET.sendT = 1 / 15;
  const s = P.slot(), a = !P.dead && P.mode !== 'naval' && P.mode !== 'plane' && !P.inBoat && !P.spawnMenu;
  if (a) NET.killedSent = false;
  netSend({ t: 's', p: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)], y: +P.yaw.toFixed(3), pi: +P.pitch.toFixed(3), st: P.mode === 'mortar' ? 1 : P.stance, w: s ? s.id : 'garand', m: P.mode, a });
}
function netShot(o, e, snd) { if (NET.on) netSend({ t: 'shot', o: [+o.x.toFixed(1), +o.y.toFixed(1), +o.z.toFixed(1)], e: [+e.x.toFixed(1), +e.y.toFixed(1), +e.z.toFixed(1)], snd }); }
function netHit(s, dm, blast) { if (NET.on && s.remote) netSend({ t: 'hit', to: s.remote.id, dm: Math.round(dm), blast: !!blast }); }
function updateNet(dt) {
  if (!NET.on) return;
  netSendState(dt);
  // nomi sopra la testa degli altri giocatori
  for (const p of NET.peers.values()) {
    if (!p.tag) { p.tag = document.createElement('div'); p.tag.className = 'ntag'; $('markers').appendChild(p.tag); }
    const s = p.puppet;
    if (!s || !s.alive || P.mode !== 'foot') { p.tag.style.display = 'none'; continue; }
    const d = camera.position.distanceTo(s.pos);
    _hv.copy(s.pos); _hv.y += 2.1 - s.prone * 1.5; _hv.project(camera);
    if (_hv.z > 1 || d > (p.side === PT ? 150 : 40)) { p.tag.style.display = 'none'; continue; }
    p.tag.style.display = 'block'; p.tag.style.left = ((_hv.x * .5 + .5) * innerWidth) + 'px'; p.tag.style.top = ((-_hv.y * .5 + .5) * innerHeight) + 'px';
    p.tag.style.color = p.side === PT ? '#9fd3ff' : '#ff8a80'; p.tag.textContent = p.name;
  }
}
