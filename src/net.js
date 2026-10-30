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
    NET.ws.onopen = () => { NET.on = true; netSend({ t: 'join', name, side, map: SCEN === 'snp' ? 'snp:' + SNP.map : SCEN }); fin(true); };
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
  if (SCEN === 'snp' && snpOnNet(m)) return;
  if (m.t === 'snap') { netApplySnapshot(m); return; }
  if (m.t === 'aihit') { if (NET.host) netOnAIHit(m); return; }
  if (m.t === 'aikill') { STATS.kills++; if (m.head) STATS.heads++; hitMarker(true, m.head); feed(m.head ? 'Nemico eliminato — colpo alla testa' : 'Nemico eliminato'); return; }
  if (m.t === 'hostgone') { feed("L'host ha lasciato la partita"); if (NET.client) { showMsg("L'host ha chiuso la partita", 4); after(4, () => GAME.end(false)); } return; }
  if (m.t === 'welcome') { NET.id = m.id; NET.hostId = m.host; if (m.host === m.id) NET.host = true; else netBecomeClient(); for (const x of m.peers) netPeer(x.id, x.name, x.side); for (const [i, by] of m.occ) if (STATIONS[i]) STATIONS[i].occupant = by; feed(`Connesso al server — giocatori presenti: ${m.peers.length + 1}`); return; }
  if (m.t === 'join') { netPeer(m.id, m.name, m.side); if (SCEN === 'snp' && !NET.client) { snpRow(m.name, m.side); snpBalance(); } feed(`${m.name} è entrato (${m.side === 'E' ? 'Asse' : 'Alleati'})`); return; }
  if (m.t === 'leave') { const p = NET.peers.get(m.id); if (p) { feed(`${p.name} ha lasciato la partita`); if (SCEN === 'snp' && !NET.client) { SNP.board.delete(p.name); NET.peers.delete(m.id); snpBalance(); } netRemovePuppet(p); if (p.tag) p.tag.remove(); NET.peers.delete(m.id); } for (const s of STATIONS) if (s.occupant === m.id) s.occupant = null; return; }
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
    if (SCEN === 'snp') { if (!NET.client) { snpShotSound(o, p.side, p.puppet); snpNearMiss(o, e, p.side, null); } } else if (R() < .5) fxTracer(o, e, .9); sfxShot(m.snd || 'garand', o);
    if (P.targetable() && P.mode === 'foot' && p.side !== PT) P.nearMiss(o, e);
  } else if (m.t === 'air') {
    if (NET.host) { const t = new V3(m.p[0], m.p[1], m.p[2]); if (m.side === 'A') raidP47(t); else strikeFw(t); }
  } else if (m.t === 'boom') {
    const bp = new V3(m.p[0], m.p[1], m.p[2]); fxExplosion(bp, m.r / 4.5, false); sfxBoom(bp, m.r / 5, false);
  } else if (m.t === 'hit') {
    if (!P.targetable()) return;
    const from = p.puppet ? p.puppet.pos.clone().add(new V3(0, 1.4, 0)) : P.pos.clone();
    if (SCEN === 'snp') { SNP.killBy = { name: m.by || p.name, team: m.bt || p.side, zone: m.zone }; P.damage(m.dm, from, false, { name: m.by || p.name, weapon: m.zone === 'head' ? 'colpo alla testa' : '', pos: from }); return; }
    P.damage(m.dm * (m.blast ? 1 : P.hitMul() / .6), from, !!m.blast, { name: m.ai ? 'Nemico' : (p.name || 'Giocatore'), weapon: m.blast ? 'esplosione' : '', pos: from });
    if (P.dead && !NET.killedSent) { NET.killedSent = true; if (!m.ai) netSend({ t: 'kill', to: m.id }); else feed('Ucciso dal nemico'); }
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
function netHit(s, dm, blast, ai, zone) { if (NET.on && s.remote) netSend({ t: 'hit', to: s.remote.id, dm: Math.round(dm), blast: !!blast, ai: !!ai, zone, by: SCEN === 'snp' ? SNP.hitBy || SNP.me : undefined, bt: SCEN === 'snp' ? (SNP.hitBy ? (s.team === 'A' ? 'E' : 'A') : PT) : undefined }); }
function updateNet(dt) {
  if (!NET.on) return;
  netSendState(dt);
  if (NET.host && NET.peers.size) netHostSnapshot(dt);
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

// ============================================================
//  Fase 2: battaglia condivisa. L'host simula IA, mezzi e missione
//  e invia istantanee 10 volte al secondo; gli altri le riproducono.
// ============================================================
const KCODE = { rifle: 0, smg: 1, bar: 2, mg: 3, sniper: 4, medic: 5 }, KNAME = ['rifle', 'smg', 'bar', 'mg', 'sniper', 'medic'];
const BSTATE = ['move', 'landed', 'sunk'];
Object.assign(NET, { host: false, client: false, hostId: 0, nid: 1, snapT: 0, ev: [], deaths: [], proxies: new Map(), boats: new Map(), bid: 1, worldT: 0, lastGaps: '' });
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

// --- host ---
function netHostEvent(e) { if (NET.host && NET.peers.size && NET.ev.length < 120) NET.ev.push(e); }
function netAIShot(s, from, end, tracer) { netHostEvent([0, r1(from.x), r1(from.y), r1(from.z), r1(end.x), r1(end.y), r1(end.z), s.snd, tracer ? 1 : 0]); }
function netAIDeath(s, imp) { if (NET.host && s.nid) NET.deaths.push([s.nid, imp && imp.dir ? r2(imp.dir.x) : 0, imp && imp.dir ? r2(imp.dir.z) : 0, imp && imp.power ? r1(imp.power) : 1.5]); }
function netHostSnapshot(dt) {
  NET.snapT -= dt; if (NET.snapT > 0) return; NET.snapT = .1;
  const sol = [];
  for (const list of [allies, enemies]) for (const s of list) {
    if (!s.alive || s.removed || s.remote) continue;
    if (!s.nid) s.nid = NET.nid++;
    sol.push([s.nid, (s.team === 'A' ? 0 : 8) + (KCODE[s.kind] || 0), r1(s.pos.x), r1(s.pos.y), r1(s.pos.z), r2(s.yaw), r1(s.crouch), r1(s.prone), s.wounded ? 1 : 0]);
  }
  const boats = [];
  for (const b of WORLD.boats) { if (!b.nid) b.nid = NET.bid++; boats.push([b.nid, r1(b.x), r1(b.z), BSTATE.indexOf(b.state), r2(b.ramp)]); }
  const m = { t: 'snap', sol, boats, ev: NET.ev, dead: NET.deaths, mi: [MISSION.stage, MISSION.title, MISSION.objText, MISSION.markers.slice(0, 5).map(k => [r1(k.pos.x), r1(k.pos.y), r1(k.pos.z), k.label || '']), [r1(MISSION.checkpoint.pos.x), r1(MISSION.checkpoint.pos.z), r2(MISSION.checkpoint.yaw || 0)], PT] };
  NET.worldT -= .1;
  if (NET.worldT <= 0) { NET.worldT = 1; m.w = [WORLD.bunkers.concat(WORLD.extraBunkers || []).map(b => b.destroyed ? 1 : 0), WORLD.flaks.map(f => f.alive ? 0 : 1), WORLD.wireGaps, WORLD.wireBreached ? 1 : 0]; }
  netSend(m); NET.ev = []; NET.deaths = [];
}
function netOnAIHit(m) {
  for (const list of [allies, enemies]) for (const s of list) if (s.nid === m.nid && s.alive) {
    const from = new V3(m.f[0], m.f[1], m.f[2]); s.lastHitPeer = m.id;
    const killed = s.damage(m.dm, from, false, m.zone, { dir: new V3(m.d[0], m.d[1], m.d[2]), power: 2.6, joint: 15 });
    if (killed) netSend({ t: 'aikill', to: m.id, head: m.zone === 'head' });
    return;
  }
}
// --- client ---
function netBecomeClient() {
  NET.client = true;
  for (const list of [allies, enemies]) for (const s of list) if (!s.remote) { s.alive = false; s.removed = true; s.body.removed = true; }
  for (const b of WORLD.boats) scene.remove(b.g); WORLD.boats.length = 0;
  for (const v of MISSION.vehicles) if (v.g) scene.remove(v.g); MISSION.vehicles.length = 0;
  WORLD.bombard = 'off'; MISSION.mortar = false; MISSION.flakOn = false; P.inBoat = false; P.boat = null;
  if (CUT.active) endCutscene();
  feed('Partita dell\'host: battaglia condivisa');
  after(.5, () => { P.dead = true; P.deathT = 3; openSpawnMenu(); });
}
function netProxy(s, dt) {
  const q = s.proxy, k = Math.min(1, dt * 10);
  s.pos.x = lerp(s.pos.x, q.x, k); s.pos.y = lerp(s.pos.y, q.y, k); s.pos.z = lerp(s.pos.z, q.z, k);
  if (Math.abs(s.pos.x - q.x) + Math.abs(s.pos.z - q.z) > 15) s.pos.set(q.x, q.y, q.z);
  s.yaw = angLerp(s.yaw, q.yaw, k); s.crouch = lerp(s.crouch, q.cr, k); s.prone = lerp(s.prone, q.pr, k);
  s.target = null; s.dest = null; s.update(dt);
}
function netApplySnapshot(m) {
  if (!NET.client) return;
  const seen = new Set();
  for (const a of m.sol) {
    const [nid, code, x, y, z, yaw, cr, pr, wd] = a; seen.add(nid);
    let s = NET.proxies.get(nid);
    if (!s || !s.alive) {
      if (s) continue;
      s = new Soldier(code >= 8 ? 'E' : 'A', KNAME[code & 7], x, z, { y, state: 'post', stationary: true });
      s.fixedY = true; s.proxy = { x, y, z, yaw, cr, pr }; s.nid = nid; NET.proxies.set(nid, s);
    }
    Object.assign(s.proxy, { x, y, z, yaw, cr, pr });
    if (wd && !s.wounded) { s.wounded = true; hidePart(s.body, 'weapon'); }
  }
  for (const [nid, dx, dz, pw] of m.dead) { const s = NET.proxies.get(nid); if (s && s.alive) { s.proxy = null; s.die(null, false, 'body', { dir: new V3(dx, .2, dz).normalize(), power: pw, joint: 15 }); } NET.proxies.delete(nid); seen.delete(nid); }
  for (const [nid, s] of NET.proxies) if (!seen.has(nid)) { if (s.alive) { s.alive = false; s.removed = true; s.body.removed = true; } NET.proxies.delete(nid); }
  // mezzi da sbarco
  const bseen = new Set();
  for (const [id, x, z, st, ramp] of m.boats) {
    bseen.add(id); let b = NET.boats.get(id);
    if (!b) { b = new Boat(x, z, 0, z); b.nid = id; NET.boats.set(id, b); }
    b.x = x; b.z = z; b.stopZ = z; b.state = BSTATE[st] || 'move'; b.ramp = ramp; b.pivot.rotation.x = -1.45 * smooth(ramp);
  }
  for (const [id, b] of NET.boats) if (!bseen.has(id)) { scene.remove(b.g); const i = WORLD.boats.indexOf(b); if (i >= 0) WORLD.boats.splice(i, 1); NET.boats.delete(id); }
  // eventi: colpi ed esplosioni
  for (const e of m.ev) {
    if (e[0] === 0) {
      const o = new V3(e[1], e[2], e[3]), en = new V3(e[4], e[5], e[6]);
      if (e[8]) fxTracer(o, en, 1.3);
      if (dist2Cam(o) < 400 * 400) sfxShot(e[7], o);
      if (P.targetable() && P.mode === 'foot') { const cl = closestOnSeg(o, en, P.pos); if (cl < 3) P.nearMiss(o, en); }
    } else if (e[0] === 1) { const p = new V3(e[1], e[2], e[3]); fxExplosion(p, e[4] / 4.5, !!e[5]); sfxBoom(p, e[4] / 5, !!e[5]); const d = p.distanceTo(P.pos); if (d < e[4] * 4) P.shake = Math.min(1.6, P.shake + (1 - d / (e[4] * 4)) * 1.3); }
  }
  // missione
  const [stage, title, obj, mk, cp, hostSide] = m.mi;
  MISSION.stage = stage; MISSION.title = title; MISSION.objText = hostSide === PT ? obj : 'Fermate il nemico — ' + obj;
  MISSION.markers = mk.map(([x, y, z, l]) => ({ pos: new V3(x, y, z), label: l }));
  if (hostSide === PT) MISSION.checkpoint = { pos: new V3(cp[0], 0, cp[1]), yaw: cp[2] };
  if (m.w) {
    const bs = WORLD.bunkers.concat(WORLD.extraBunkers || []);
    m.w[0].forEach((d, i) => { if (d && bs[i] && !bs[i].destroyed) { bs[i].gunner = null; bs[i].destroy(); } });
    m.w[1].forEach((d, i) => { const f = WORLD.flaks[i]; if (d && f && f.alive) f.destroy(); });
    const g = JSON.stringify(m.w[2]) + m.w[3];
    if (g !== NET.lastGaps) { NET.lastGaps = g; WORLD.wireGaps = m.w[2]; WORLD.wireBreached = !!m.w[3]; buildWire(); }
  }
}
function closestOnSeg(a, b, p) { const ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1); return a.clone().addScaledVector(ab, t).distanceTo(p); }
function netProxyHit(s, dm, zone, from, dir) { netSend({ t: 'aihit', nid: s.nid, dm: Math.round(dm), zone, f: [r1(from.x), r1(from.y), r1(from.z)], d: [r2(dir.x), r2(dir.y), r2(dir.z)] }); }
