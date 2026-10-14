"use strict";
// ============================================================
//  Missione: fasi, dialoghi, ondate di sbarco, mortai, cannoni,
//  rinforzi, mezzi corazzati
// ============================================================
const MISSION = {
  stage: -1, stageT: 0, allyZone: null, interactables: [], vehicles: [], markers: [], objText: '', title: '',
  checkpoint: { pos: new V3(-22, 0, 0), yaw: 0 }, nadeCD: 0, eNadeCD: 0, allyNadeCD: 0, godT: 0, mortar: false, mortarT: 4, alliesLost: 0, minCharges: 0,
  flags: {}, defendT: 0, flakOn: false, tanks: [], bangT: 0, waveT: 25, waveN: 0, reinfT: 10,
};
const TIMERS = [];
function after(t, fn) { TIMERS.push({ t, fn }); }
function updateTimers(dt) { for (let i = TIMERS.length - 1; i >= 0; i--) { const x = TIMERS[i]; x.t -= dt; if (x.t <= 0) { TIMERS.splice(i, 1); x.fn(); } } }
function once(key, cond, fn) { if (cond && !MISSION.flags[key]) { MISSION.flags[key] = true; fn(); } }

const SUBQ = []; let subT = 0;
function say(who, text, dur) { SUBQ.push({ who, text, dur: dur || clamp(text.length * .062, 2.4, 6.5) }); }
function updateSubs(dt) {
  if (subT > 0) { subT -= dt; if (subT <= 0) $('subs').innerHTML = ''; }
  if (subT <= 0 && SUBQ.length) { const s = SUBQ.shift(); $('subs').innerHTML = (s.who ? `<b>${s.who}:</b> ` : '') + s.text; subT = s.dur; }
}
const N = { sarge: 'Sgt. Morelli', walsh: 'Cpl. Walsh', kow: 'Pvt. Kowalski', baker: 'Pvt. Baker', russo: 'Pvt. Russo', doc: 'Doc Harris', cox: 'Timoniere', radio: 'Radio', you: 'Tu' };

// ---------- spawn ----------
function addAlly(kind, x, z, o = {}) { return new Soldier('A', kind, x, z, o); }
function addEnemy(kind, x, z, o = {}) { if (o.yaw === undefined) o.yaw = PI; return new Soldier('E', kind, x, z, o); }
const randAllyKind = () => { const r = R(); return r < .56 ? 'rifle' : r < .71 ? 'smg' : r < .85 ? 'bar' : r < .93 ? 'medic' : 'sniper'; };
const randEnemyKind = () => R() < .72 ? 'rifle' : 'smg';
const aliveA = () => allies.filter(a => a.alive).length, aliveE = () => enemies.filter(e => e.alive).length;
const SEATS = [];
for (let r = 0; r < 7; r++) for (let c = -1; c <= 1; c++) SEATS.push(new V3(c * .95, .47, -3.6 + r * 1.1));
function fillBoat(b, n, squad, skipPlayerSeat) {
  const seats = SEATS.filter((s, i) => !(skipPlayerSeat && i === 16));
  const names = [N.sarge, N.walsh, N.kow, N.baker, N.russo, N.doc], kinds = ['rifle', 'smg', 'bar', 'rifle', 'rifle', 'medic'];
  for (let i = 0; i < n && i < seats.length; i++) {
    const sq = squad && i >= 3 && i < 9;
    const a = addAlly(sq ? kinds[i - 3] : randAllyKind(), b.x, b.z, { state: 'boat', squad: sq, name: sq ? names[i - 3] : '' });
    a.boat = b; a.off = seats[i].clone(); a.leave = (seats[i].z + 3.6) * .42 + rnd(0, .35);
  }
}
function addCorpse(team, x, z) {
  const s = new Soldier(team, R() < .8 ? 'rifle' : 'smg', x, z, {}); s.yaw = R() * TAU; s.root.rotation.y = s.yaw;
  s.alive = false; s.state = 'dead'; corpses.push(s);
  startRagdoll(s, { dir: new V3(rnd(-1, 1), 0, rnd(-1, 1)).normalize(), power: 1.5, joint: 15 });
  s.body.rag.noPool = !SETTINGS.gore;
  for (let i = 0; i < 150; i++) updateRagdollsOne(s.body.rag, 1 / 30);
  if (s.body.rag && !s.body.settled) settleRag(s.body.rag);
}
function updateRagdollsOne(r) { const keep = RAGS.slice(); RAGS.length = 0; RAGS.push(r); updateRagdolls(1 / 30); RAGS.length = 0; for (const x of keep) if (x !== r || r.b.settled === false) RAGS.push(x); }
function reinforce(target, x, z, spread = 8) {
  const n = Math.min(target - allies.filter(a => a.alive && a.state !== 'boat').length, 14, Q.allyAlive - aliveA());
  for (let i = 0; i < n; i++) { const a = addAlly(randAllyKind(), x + rnd(-spread, spread), z + rnd(-spread, spread), { state: 'idle' }); a.wait = rnd(.2, 2); }
}
function addCrate(x, z) {
  const y = H(x, z), mb = new MB(); mb.mat = 'wood';
  mb.add(U.box, 0x8a9a6a, 0, .3, 0, 0, 0, 0, 1.1, .6, .6); mb.add(U.box, 0x7a8a5a, 0, .62, 0, 0, 0, 0, 1.14, .06, .64);
  mb.add(U.box, 0x8a9a6a, .3, .85, .05, 0, .4, 0, .5, .4, .35); mb.mat = 'vc'; mb.add(U.box, 0xd8d0b0, .2, .3, -.302, 0, 0, 0, .4, .12, .01);
  const g = groupMesh(mb.buildGroups()); g.position.set(x, y, z); g.rotation.y = rnd(-.3, .3); scene.add(g);
  WORLD.crates.push({ x, z });
}
let BANG_POS;
function addBangaloreCrate(x, z) {
  const mb = new MB(), y = H(x, z); mb.mat = 'wood';
  mb.add(U.box, 0x8d7a5a, 0, .25, 0, 0, 0, 0, 2.2, .5, .7); mb.mat = 'paint';
  for (let i = 0; i < 3; i++) mb.add(U.cyl12, 0x6a7350, -.2 + i * .2, .58, 0, 0, 0, PI / 2, .04, 2.5, .04);
  const g = groupMesh(mb.buildGroups()); g.position.set(x, y, z); g.rotation.y = .1; scene.add(g);
  BANG_POS = new V3(x, y, z);
}

function initMission() {
  if (SCEN === 'ard') { initArdennes(); return; }
  if (SCEN === 'air') { initAirMode(); return; }
  if (PT === 'E') { initAxis(); return; }
  const xs = [-97, -72, -47, -22, 3, 28, 53];
  const per = clamp(Math.floor((Q.allyAlive * .55 - 9) / 6), 4, 10);
  for (let k = 0; k < 10; k++) { const fx = rnd(260, MAPX - 120) * (k % 2 ? 1 : -1); fillBoat(new Boat(fx, rnd(330, 420), rnd(8.2, 9), 82), clamp(Math.floor(per * .7), 4, 8), false); }
  for (const x of xs) {
    const me = x === -22;
    const b = new Boat(x, me ? 380 : rnd(368, 396), me ? 8.5 : rnd(8.2, 8.9), 82);
    if (me) { P.boat = b; fillBoat(b, 10, true, true); } else fillBoat(b, per, false);
  }
  P.inBoat = true; P.yaw = 0; P.seat = new V3(0, .47, 2.2);
  for (let i = 0; i < 30; i++) addCorpse('A', rnd(-170, 170), rnd(-50, 60));
  battleSmoke(); spawnBeachHolders();
  spawnBeachDefenders();
  const fp = (id, x, z, res) => { const p = spawnPickup(id, new V3(x, 0, z), undefined, res); p.fixed = true; };
  fp('thompson', -14, -27); fp('bar', -44, -55.1); fp('bazooka', -17, -55.3, 4); fp('thompson', 30, -40);
  fp('springfield', -58, trenchZ(-58) + .2); fp('springfield', 10, -56); fp('kar98zf', -142, -103); fp('kar98zf', 122, -105); fp('bar', 40, trenchZ(40) + .2); fp('bazooka', -20, -160, 3); fp('thompson', -40, -200);
  addCrate(-26, -55.4); addCrate(-38, trenchZ(-38) + .3); addCrate(-24, -163); addCrate(14, -276); addCrate(-32, -110);
  addBangaloreCrate(-36, -55.3);
  setStage(0); initConvoy(); initTanks();
}

const TRENCH_POSTS = [];
function spawnCityGarrison() {
  const n = Math.round(22 * Q.enemyAlive / 120);
  for (let i = 0; i < n; i++) {
    const c = pick(covers.filter(k => cityIn(k.x, k.z) && (k.kind === 'sand' || k.kind === 'ruin' || k.kind === 'house'))); if (!c) break;
    addEnemy(R() < .15 ? 'mg' : randEnemyKind(), c.x, c.z, { state: 'post', stationary: true, group: 'city' });
  }
  if (WORLD.cityTower) addEnemy('sniper', WORLD.cityTower.x, WORLD.cityTower.z, { y: WORLD.cityTower.y, state: 'post', stationary: true, group: 'city' });
}
function spawnBeachDefenders() {
  spawnCityGarrison();
  const m = Q.enemyAlive / 120, step = 3.4 / m;
  for (let x = -158; x < 158; x += step * rnd(.8, 1.2)) {
    if (WORLD.bunkers.some(b => Math.abs(b.x - x) < 6)) continue;
    TRENCH_POSTS.push(new V3(x, 0, trenchZ(x) + .2));
    addEnemy(R() < .8 ? 'rifle' : 'smg', x, trenchZ(x) + .2, { state: 'post', stationary: true, inTrench: true, group: 'beach' });
  }
  for (const x of [-140, -65, -30, 30, 55, 135]) addEnemy('mg', x + 2, trenchZ(x + 2) + .3, { state: 'post', stationary: true, inTrench: true, group: 'beach' });
  for (const b of WORLD.bunkers) { b.gunner = addEnemy('mg', b.x, b.z + 2.5, { y: b.base + 1.2, state: 'post', stationary: true, inBunker: true, bunker: b, group: 'beach' }); b.gunner.supB = b; }
  for (const b of WORLD.tobruks || []) { b.gunner = addEnemy('mg', b.x, b.z, { y: b.base + 1.1, state: 'post', stationary: true, inBunker: true, group: 'beach' }); b.gunner.supB = b; }
  for (const [x, z] of [[-140, -104], [125, -106], [-20, -110], [-80, -96], [60, -98], [160, -100], [-180, -98], [0, -100]]) addEnemy('sniper', x, z, { state: 'post', stationary: true, group: 'beach' });
  for (const [x, z] of [[-80, -74], [-5, -77], [60, -73], [140, -75], [-130, -72], [95, -79], [-110, -78], [-50, -75], [120, -71]]) addEnemy('rifle', x, z, { state: 'post', stationary: true, group: 'beach' });
  for (const mp of WORLD.mortarPits) for (let i = 0; i < 2; i++) addEnemy('rifle', mp.x + (i ? 1.2 : -1.2), mp.z, { state: 'post', stationary: true, group: 'beach', role: 'mortar' });
  for (const b of WORLD.extraBunkers || []) { b.gunner = addEnemy('mg', b.x, b.z + 2.5, { y: b.base + 1.2, state: 'post', stationary: true, inBunker: true, bunker: null, group: 'wn' }); b.gunner.supB = b; for (let k = 0; k < 5; k++) addEnemy(randEnemyKind(), b.x + rnd(-25, 25), -84 + rnd(-6, 3), { state: 'post', stationary: true, group: 'wn' }); }
  for (const a of WORLD.aaSites) for (let i = 0; i < 2; i++) addEnemy('rifle', a.x + (i ? 1 : -1), a.z + .5, { state: 'post', stationary: true, group: 'beach', role: 'aa' });
}
// ondata di mezzi da sbarco; se withPlayer, uno dei mezzi trasporta il giocatore
function battleSmoke() {
  for (let i = 0; i < 26; i++) { const x = rnd(-230, 230), z = rnd(-95, 70); addEmitter(new V3(x, Math.max(H(x, z), WATER_Y) + .5, z), R() < .25 ? 'fire' : 'smoke', rnd(.8, 1.6)); }
  for (let i = 0; i < 10; i++) { const x = rnd(-200, 200), z = rnd(-60, -40); addEmitter(new V3(x, H(x, z) + .3, z), 'bank', 1); }
}
function spawnBeachHolders() {
  const n = Math.round(Q.allyAlive * .3), spots = covers.filter(c => c.z > -58 && c.z < 70 && Math.abs(c.x) < 200);
  for (let i = 0; i < n && spots.length; i++) {
    const c = spots.splice(Math.floor(R() * spots.length), 1)[0]; c.occ = 2;
    const a = addAlly(R() < .2 ? 'bar' : randAllyKind(), c.x + rnd(-.3, .3), c.z + rnd(-.2, .3), { state: 'post', stationary: true, group: 'hold' });
    a.yaw = rnd(-.3, .3); if (R() < .4) a.forceProne = true;
  }
}
function releaseHolders() { for (const a of allies) if (a.alive && a.group === 'hold') { a.stationary = false; a.forceProne = false; a.state = 'idle'; a.wait = rnd(0, 4); } }
// ricarica un mezzo tornato alle navi: riparte pieno se c'è posto per altri soldati
const allyCap = () => MISSION.endless ? Math.min(Math.floor(Q.allySlots * .6), Math.round(Q.allyAlive * (1 + ((MISSION.level || 1) - 1) * .18))) : Q.allyAlive;
function boatReload(b) {
  const room = allyCap() - aliveA(); if (room < 5) return false;
  const front = P.mode === 'foot' && Math.abs(P.pos.x) < 200 ? P.pos.x : rnd(-120, 120);
  b.x = R() < .7 ? clamp(front + rnd(-120, 120), -200, 200) : rnd(-MAPX + 120, MAPX - 120); b.z = rnd(470, 520); b.stopZ = 82; b.speed = rnd(8.4, 9.6);
  b.g.position.set(b.x, 0, b.z); b.doom = R() < .08 ? rnd(30, 150) : undefined;
  fillBoat(b, Math.min(room, Math.round(rnd(8, 12))), false);
  return true;
}
// flotta di mezzi in rotazione continua tra le navi e la spiaggia
function ensureFleet() {
  const want = Math.min(40, Q.waveBoats * 3 + 6 + (MISSION.endless ? ((MISSION.level || 1) - 1) * 3 : 0)), have = WORLD.boats.filter(b => b.state !== 'sunk').length;
  for (let i = have; i < want; i++) { const b = new Boat(0, 520, 9, 82); b.state = 'reload'; b.g.visible = false; b.reloadT = rnd(2, 40); }
}
function spawnWave(withPlayer) {
  const room = Math.max(0, Q.allyAlive - aliveA());
  const nb = withPlayer ? Math.max(1, Math.min(Q.waveBoats, Math.ceil(room / 8))) : Math.min(Q.waveBoats, Math.floor(room / 6));
  if (nb <= 0) return null;
  const per = clamp(Math.floor(room / nb), 4, 11);
  let pb = null;
  for (let i = 0; i < nb; i++) {
    const cx = P.mode === 'foot' ? clamp(P.pos.x, -MAPX + 200, MAPX - 200) : rnd(-600, 600);
    const x = withPlayer && i === 0 ? clamp(P.pos.x || -22, -MAPX + 100, MAPX - 100) : R() < .45 ? rnd(-MAPX + 120, MAPX - 120) : cx + rnd(-220, 220);
    const b = new Boat(x, withPlayer && i === 0 ? 150 : rnd(200, 260), rnd(8.6, 9.6), 82);
    fillBoat(b, per, false, withPlayer && i === 0);
    if (withPlayer && i === 0) pb = b;
    else if (R() < .12) b.doom = rnd(20, 120);
  }
  MISSION.waveN++;
  if (!withPlayer && MISSION.waveN > 1 && P.mode === 'foot') say(N.radio, pick(['Nuova ondata in arrivo sulla spiaggia!', 'Altri mezzi da sbarco in avvicinamento.', 'Ondata ' + (MISSION.waveN + 1) + ' in arrivo.']));
  return pb;
}
function spawnBattery() {
  const m = Q.enemyAlive / 110;
  for (const f of WORLD.flaks) for (let i = 0; i < Math.round(6 * m); i++) { const a = R() * TAU; addEnemy(randEnemyKind(), f.x + Math.cos(a) * 6.5, f.z + Math.sin(a) * 6.5, { state: 'post', stationary: true, group: 'battery' }); }
  const gapAt = x => HEDGES[0].gaps.some(g => x > g[0] - 2 && x < g[1] + 2);
  for (let i = 0; i < Math.round(14 * m); i++) { const x = rnd(-110, 100); if (gapAt(x)) continue; addEnemy(randEnemyKind(), x, -172.8, { state: 'post', stationary: true, group: 'battery' }); }
  addEnemy('mg', -34, -174, { state: 'post', stationary: true, group: 'battery' }); addEnemy('mg', 62, -174, { state: 'post', stationary: true, group: 'battery' });
  for (let i = 0; i < Math.round(6 * m); i++) addEnemy(randEnemyKind(), rnd(-90, 90), -220.8, { state: 'post', stationary: true, group: 'battery' });
  addEnemy('sniper', 75, -205, { state: 'post', stationary: true, group: 'battery' });
}
function spawnVillage() {
  const m = Q.enemyAlive / 110;
  for (let i = 0; i < Math.round(10 * m); i++) addEnemy(randEnemyKind(), pick([rnd(-90, -44), rnd(-18, 36), rnd(56, 90)]), -251.4, { state: 'post', stationary: true, group: 'village' });
  for (const [x, z] of [[-67, -262], [-30, -266], [-6, -262], [22, -270], [43, -262], [60, -263], [-52, -283], [30, -285], [-72, -282], [0, -290], [-20, -275], [50, -278]])
    if (R() < .75 * m + .2) addEnemy(randEnemyKind(), x, z, { state: 'post', stationary: true, group: 'village' });
  addEnemy('mg', -31, -259.6, { state: 'post', stationary: true, group: 'village' });
  const tt = WORLD.towerTop; addEnemy('sniper', tt.x, tt.z, { y: tt.y, state: 'post', stationary: true, group: 'village' });
  for (let i = 0; i < 5; i++) addEnemy(randEnemyKind(), SQUARE.x + rnd(-10, 10), SQUARE.z + rnd(-6, 6), { state: 'post', stationary: true, group: 'village' });
}
function spawnCounter(n) {
  for (let i = 0; i < n; i++) {
    const r = R(), kind = r < .55 ? 'rifle' : r < .9 ? 'smg' : 'mg';
    const e = addEnemy(kind, rnd(-110, 110), rnd(-445, -420), { state: 'assault', group: 'counter', objective: SQUARE.clone().add(new V3(rnd(-15, 15), 0, rnd(-10, 10))) });
    e.yaw = 0; e.wait = rnd(0, 2);
  }
}
// rinforzi tedeschi che corrono a coprire i buchi nella trincea
function reinforceTrench() {
  if (MISSION.stage > 3) return;
  const empty = TRENCH_POSTS.filter(p => !enemies.some(e => e.alive && Math.abs(e.pos.x - p.x) < 2.5 && Math.abs(e.pos.z - p.z) < 3));
  const room = Q.enemyAlive - aliveE();
  const n = Math.min(empty.length, room, 4);
  for (let i = 0; i < n; i++) {
    const p = pick(empty); if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 25) continue;
    addEnemy(randEnemyKind(), p.x + rnd(-20, 20), -150 + rnd(-10, 10), { state: 'move', group: 'beach', toPost: true, objective: p.clone() });
  }
}

// ---------- fasi ----------
const STAGES = [
  { // 0
    title: 'Avvicinamento — 06:31',
    start() { MISSION.allyZone = null; WORLD.bombard = 'bluff'; AU.battle = 1.3; },
    update() {
      const b = P.boat, eta = Math.max(0, (b.z - b.stopZ) / b.speed), t = MISSION.stageT;
      MISSION.objText = b.landed ? 'Preparati a sbarcare!' : `Sbarco tra ${Math.ceil(eta)} s — resta giù`;
      once('s1', t > 2, () => { say(N.sarge, 'Ascoltate! Quando la rampa si abbassa, fuori e di lato: mai dritti davanti!'); shout('en', 'move', null, { text: 'Listen up! When that ramp drops, you go left or right. Never straight out!', priority: true, rate: 1.1 }); });
      once('s2', t > 10, () => say(N.walsh, 'Guardate la Texas... sta radendo al suolo la scogliera.'));
      once('s3', t > 17, () => { say(N.sarge, 'Controllate le armi! Tenete la sabbia lontana dall\'otturatore!'); shout('en', 'move', null, { text: 'Check your weapons! Keep the sand out of your actions!', priority: true }); });
      once('s4', t > 24, () => { say(N.kow, 'Ave Maria, piena di grazia...'); shout('en', 'move', null, { text: 'Hail Mary, full of grace...', priority: true, rate: .95, pitch: .9 }); });
      once('s5', eta < 18, () => { say(N.cox, 'Mitragliatrici sulla spiaggia! State giù!'); shout('en', 'cover', null, { text: 'Machine guns on the beach! Keep your heads down!', priority: true }); });
      once('hit', eta < 14, () => {
        const nb = WORLD.boats.find(x => x.x === 3); if (!nb) return;
        const p = nb.g.position.clone(); p.y += 1;
        fxExplosion(p, 2.4, true); sfxBoom(p, 2.2, true); P.shake += .9; lensSplat('water', .8);
        nb.state = 'sunk';
        for (const a of allies) if (a.boat === nb && a.alive) a.die(p, false, 'blast', { blast: p, power: 9 });
        addEmitter(p, 'fire', 1);
        after(1.2, () => say(N.walsh, 'Hanno colpito la barca di Miller! Oh Dio...'));
      });
      once('s6', eta < 8, () => { say(N.cox, 'Dieci secondi! Che Dio vi assista!'); shout('en', 'move', null, { text: 'Ten seconds! God be with you!', priority: true }); });
      if ((b.open || b.state === 'return' || b.state === 'reload') && !P.inBoat && MISSION.stageT > 2) { setStage(1); return; }
      once('ramp', b.landed, () => {
        say(N.cox, 'RAMPA GIÙ!'); shout('en', 'move', null, { text: 'Ramp going down!', priority: true });
        after(.9, () => {
          const front = allies.filter(a => a.boat === b && a.alive && !a.squad).slice(0, 3);
          const src = new V3(b.x + 20, 14, -82);
          for (const a of front) { const cp = a.chest(new V3()); a.die(src, false, 'body', { dir: cp.clone().sub(src).normalize(), power: 3, joint: 15 }); fxTracer(src, cp, 1.3); bloodHit(cp, cp.clone().sub(src).normalize(), 1.4); sfxShot('mg42', src); }
          for (let i = 0; i < 14; i++) after(i * .05, () => { sfxShot('mg42', src); const q = new V3(b.x + rnd(-1.5, 1.5), b.y + rnd(.5, 2), b.z - 5.5); fxTracer(src, q, 1.3); fxImpact(q, 'metal'); sfxImpact(q, 'metal'); if (R() < .3) sfxRicochet(q); });
          lensSplat('blood', .6);
        });
      });
    }
  },
  { // 1
    title: 'Omaha Beach — Dog Green',
    start() {
      MISSION.checkpoint = { pos: new V3(P.boat.x, 0, P.boat.z - 10), yaw: 0 };
      MISSION.allyZone = { zMin: -56.8, zMax: 90, xMin: -200, xMax: 200, step: 13, wait: [2.5, 6] };
      MISSION.mortar = true; AU.battle = 1.6;
      say(N.sarge, 'Fuori! Fuori! Dritti agli ostacoli, non fermatevi in acqua!'); shout('en', 'move', null, { text: 'Move! Move! Get to the obstacles! Don\'t stop in the water!', priority: true });
      after(8, () => say(N.walsh, 'MG42 sulla scogliera! Ci stanno falciando!'));
      after(16, () => say(N.doc, 'Medico! Ho bisogno di aiuto qui!'));
      after(26, () => { say(N.sarge, 'Al terrapieno! Raggiungete i ciottoli!'); shout('en', 'move', null, { text: 'Get to the seawall!', priority: true }); });
    },
    update() {
      MISSION.objText = 'Raggiungi il terrapieno di ciottoli ai piedi della scogliera';
      const x = clamp(P.pos.x, -60, 10);
      MISSION.markers = [{ pos: new V3(x, H(x, BANK_Z + 1.5) + 1.2, BANK_Z + 1.5), label: 'Terrapieno' }];
      if (P.pos.z < -46) MISSION.checkpoint = { pos: new V3(clamp(P.pos.x, -150, 150), 0, -40), yaw: 0 };
      if (P.pos.z < -53.5 && P.mode === 'foot') setStage(2);
      else if (MISSION.stageT > 45 && allies.filter(a => a.alive && !a.vip && a.pos.z < -48 && a.pos.z > -60 && Math.abs(a.pos.x) < 220).length >= 8) { feed('I compagni hanno raggiunto il terrapieno'); setStage(2); }
    }
  },
  { // 2
    title: 'Il filo spinato',
    start() {
      MISSION.checkpoint = { pos: new V3(-26, 0, -55.2), yaw: 0 };
      say(N.sarge, 'Il filo spinato ci blocca! Ci serve un tubo Bangalore.');
      after(4, () => { say(N.sarge, 'Tu! Prendi il Bangalore dalla cassa e fai saltare quel filo!'); shout('en', 'move', null, { text: 'You! Get that Bangalore and blow that wire!', priority: true }); });
      const wp = new V3(BREACH_X, H(BREACH_X, WIRE_Z + .8), WIRE_Z + .8);
      MISSION.interactables = [
        { pos: BANG_POS, r: 2.4, label: 'Premi E per prendere il tubo Bangalore', active: () => !P.carry && !MISSION.flags.placed, done: () => { P.carry = 'bangalore'; sfxMech('pick'); feed('Hai preso il tubo Bangalore'); } },
        { pos: wp, r: 2.4, hold: 2.5, label: 'Tieni premuto E per infilare il Bangalore sotto il filo', active: () => P.carry === 'bangalore', done: () => placeBangalore(BREACH_X) },
      ];
    },
    update(dt) {
      if (MISSION.stageT > 60 && !MISSION.flags.placed && MISSION.stage === 2) {
        // il geniere apre il varco dove si sono ammassati più compagni
        if (!MISSION.bangX || MISSION.stageT % 10 < MISSION.dt) { let bx = BREACH_X, bn = -1; for (let x = -190; x <= 190; x += 10) { const n = allies.filter(a => a.alive && !a.vip && a.pos.z < -46 && a.pos.z > -62 && Math.abs(a.pos.x - x) < 18).length; if (n > bn) { bn = n; bx = x; } } MISSION.bangX = bx; }
        const bx = MISSION.bangX; aiEngineer('bang', new V3(bx, 0, WIRE_Z + 4), 6, 25, () => { if (MISSION.stage !== 2) return; if (addWireGap(bx)) onWireGap(bx); });
      }
      if (!MISSION.flags.placed) {
        MISSION.objText = (P.carry ? 'Infila il tubo Bangalore sotto il filo spinato' : 'Apri un varco nel filo: Bangalore dalla cassa') + ' — oppure granate, bazooka, Texas (B) o aereo';
        MISSION.markers = [P.carry ? { pos: new V3(BREACH_X, H(BREACH_X, WIRE_Z) + 1.5, WIRE_Z), label: 'Filo spinato' } : { pos: BANG_POS.clone().add(new V3(0, 1.4, 0)), label: 'Bangalore' }];
      } else { MISSION.bangT -= dt; MISSION.markers = []; MISSION.objText = `Fuoco nel buco! Allontanati! ${Math.max(0, Math.ceil(MISSION.bangT))}`; }
    }
  },
  { // 3
    title: 'La scogliera',
    start() {
      MISSION.checkpoint = { pos: new V3(BREACH_X, 0, WIRE_Z + 2.5), yaw: 0 };
      MISSION.allyZone = { zMin: -93, zMax: 90, xMin: -200, xMax: 200, step: 12, wait: [2.5, 5.5] }; releaseHolders();
      say(N.sarge, 'Il filo è aperto! Tutti attraverso il varco, su per la scogliera!'); shout('en', 'move', null, { text: 'The wire is open! Everybody through the gap! Up the bluff!', priority: true });
      after(6, () => say(N.walsh, 'Campi minati ai lati! Restate sul sentiero del canalone!'));
      MISSION.waveT = 5;
    },
    update() {
      const tp = new V3(BREACH_X, 0, trenchZ(BREACH_X)); tp.y = H(tp.x, tp.z) + 1.5;
      MISSION.markers = [{ pos: tp, label: 'Trincea' }];
      const ng = nearestGap(); if (ng !== null && P.pos.z > WIRE_Z) MISSION.markers.unshift({ pos: new V3(ng, H(ng, WIRE_Z) + 1.5, WIRE_Z), label: 'Varco nel filo' });
      const near = enemies.filter(e => e.alive && !e.inBunker && !e.role && Math.hypot(e.pos.x - tp.x, e.pos.z - tp.z) < 30).length;
      MISSION.objText = near ? `Conquista la trincea in cima alla scogliera — difensori: ${near}` : 'Raggiungi la trincea in cima alla scogliera';
      if (P.pos.z < -70) MISSION.checkpoint = { pos: new V3(BREACH_X + 2, 0, -72), yaw: 0 };
      for (const mf of MINEFIELDS) once('mf' + mf[0], P.pos.x > mf[0] - 5 && P.pos.x < mf[1] + 5 && P.pos.z < mf[3] + 4 && P.pos.z > mf[2], () => say(N.walsh, 'Fermo! Campo minato! Guarda i cartelli!'));
      if (near === 0 && (Math.hypot(P.pos.x - tp.x, P.pos.z - tp.z) < 10 || alliesNear(tp.x, tp.z, 14) >= 6)) setStage(4);
      else if (allies.filter(a => a.alive && !a.vip && Math.abs(a.pos.z - trenchZ(a.pos.x)) < 3 && Math.abs(a.pos.x) < 165).length >= 6) { feed('I compagni hanno conquistato un tratto di trincea'); setStage(4); }
    }
  },
  { // 4
    title: 'I bunker MG42',
    start() {
      MISSION.checkpoint = { pos: new V3(BREACH_X, 0, trenchZ(BREACH_X)), yaw: 0 };
      P.charges = Math.max(P.charges, 3); MISSION.minCharges = 3; WORLD.bombard = 'inland';
      feed('Ricevute 3 cariche da demolizione');
      say(N.sarge, 'Trincea presa! Ora quei bunker: prendi queste cariche e falli saltare!');
      say(N.walsh, 'Le porte posteriori danno sulla trincea. O una granata dritta nella feritoia! Oppure chiama la Texas (B).');
      MISSION.allyZone = { zMin: -96, zMax: 90, xMin: -200, xMax: 200, step: 10, wait: [3, 7] };
      MISSION.interactables = WORLD.bunkers.map(b => ({
        pos: b.door, r: 2.8, hold: 2, label: 'Tieni premuto E per piazzare la carica da demolizione',
        active: () => !b.neutralized && !b.charged && P.charges > 0,
        done: () => {
          P.charges--; b.charged = true; sfxMech('pick');
          const c = new THREE.Mesh(U.box, MAT.vc); c.scale.set(.4, .3, .2); c.position.copy(b.door).add(new V3(0, 1, .9)); scene.add(c);
          say(N.you, 'Carica piazzata! Sei secondi!'); shout('en', 'fire', null, { priority: true });
          after(6, () => { scene.remove(c); explode(b.door.clone().add(new V3(0, 1, 1)), 4, 220, { byPlayer: true, charge: true }); b.destroy(); onObjectiveEvent('bunker', b, true); });
        }
      }));
      for (let i = 0; i < Math.round(8 * Q.enemyAlive / 110); i++) addEnemy(randEnemyKind(), rnd(-80, 60), rnd(-150, -135), { state: 'assault', group: 'beach', objective: new V3(rnd(-60, 40), 0, -94) });
    },
    update() {
      const left = WORLD.bunkers.filter(b => !b.neutralized);
      for (const b of left) aiEngineer('bk' + b.x, b.door, 6, 40, () => { if (!b.destroyed) { b.destroy(); onObjectiveEvent('bunker', b, false); } });
      MISSION.objText = `Neutralizza i bunker MG42 (${3 - left.length}/3) — cariche (E), granate, bazooka o la Texas (B)`;
      MISSION.markers = left.map(b => ({ pos: new V3(b.x, b.base + 6, b.z), label: 'MG42' }));
      if (P.mode === 'foot' && Math.abs(P.pos.z - trenchZ(P.pos.x)) < 2.5 && P.pos.x > -150 && P.pos.x < 150) MISSION.checkpoint = { pos: new V3(P.pos.x, 0, trenchZ(P.pos.x)), yaw: 0 };
      once('bdone', !left.length, () => { say(N.sarge, 'Tutti i bunker sono a terra! Ottimo lavoro!'); after(4, () => setStage(5)); });
    }
  },
  { // 5
    title: 'La batteria da 88',
    start() {
      MISSION.checkpoint = { pos: new V3(roadX(-110), 0, -110), yaw: 0 };
      P.charges = Math.max(P.charges, 2); MISSION.minCharges = 2; MISSION.mortar = false; AU.battle = 1.1;
      say(N.radio, 'Qui Easy Six: due cannoni da 88 oltre le siepi stanno massacrando la seconda ondata!');
      say(N.sarge, 'Hai sentito. Avanti, attraverso il bocage! Usa i varchi nelle siepi!');
      MISSION.flakOn = true; spawnBattery();
      reinforce(24, roadX(-100), -100);
      MISSION.allyZone = { zMin: -205, zMax: 90, xMin: -200, xMax: 200, step: 14, wait: [3, 6] };
      MISSION.interactables = WORLD.flaks.map(f => ({
        pos: new V3(f.x, f.pos.y, f.z - 2), r: 2.8, hold: 2, label: 'Tieni premuto E per piazzare la carica sul cannone',
        active: () => f.alive && !f.charged && P.charges > 0,
        done: () => {
          P.charges--; f.charged = true; sfxMech('pick'); say(N.you, 'Carica piazzata! Via!');
          after(5, () => { explode(f.pos.clone().add(new V3(0, 1.5, 0)), 4, 220, { byPlayer: true, charge: true }); f.destroy(); onObjectiveEvent('flak', f, true); });
        }
      }));
    },
    update() {
      const left = WORLD.flaks.filter(f => f.alive);
      for (const f of left) aiEngineer('fk' + f.x, new V3(f.x, 0, f.z - 2), 6, 40, () => { if (f.alive) { f.destroy(); onObjectiveEvent('flak', f, false); } });
      MISSION.objText = `Distruggi i cannoni da 88 mm (${2 - left.length}/2) — cariche (E), bazooka, aereo o Texas (B)`;
      MISSION.markers = left.map(f => ({ pos: f.pos.clone().add(new V3(0, 4.5, 0)), label: 'Flak 88' }));
      if (P.mode === 'foot' && P.pos.z < -176 && P.pos.z > -215) MISSION.checkpoint = { pos: new V3(roadX(-180), 0, -180), yaw: 0 };
      once('fdone', !left.length, () => { MISSION.flakOn = false; say(N.sarge, 'I cannoni tacciono! La spiaggia respira.'); after(4, () => setStage(6)); });
    }
  },
  { // 6
    title: 'Colleville-sur-Mer',
    start() {
      MISSION.checkpoint = { pos: new V3(roadX(-205), 0, -205), yaw: 0 };
      say(N.sarge, 'Ora il villaggio: Colleville-sur-Mer. Casa per casa, ragazzi.');
      after(5, () => say(N.radio, 'Attenzione: cecchino segnalato sul campanile della chiesa.'));
      spawnVillage(); reinforce(26, roadX(-190), -190); AU.battle = .8;
      MISSION.allyZone = { zMin: -300, zMax: 90, xMin: -200, xMax: 200, step: 16, wait: [3, 6] };
    },
    update() {
      const left = enemies.filter(e => e.alive && e.group === 'village');
      MISSION.objText = `Libera Colleville-sur-Mer — nemici rimasti: ${left.length}`;
      MISSION.markers = left.length <= 4 ? left.map(e => ({ pos: e.pos.clone().add(new V3(0, 2.4, 0)), label: '' })) : [{ pos: new V3(SQUARE.x, H(SQUARE.x, SQUARE.z) + 3, SQUARE.z), label: 'Piazza' }];
      if (P.mode === 'foot' && P.pos.z < -240) MISSION.checkpoint = { pos: new V3(-30, 0, -245), yaw: 0 };
      once('vdone', left.length <= 2 && MISSION.stageT > 10, () => {
        for (const e of left) e.flee = true;
        say(N.walsh, 'Scappano! Il villaggio è nostro!'); shout('de', 'retreat', left[0] ? left[0].pos : null, { priority: true });
        after(3, () => setStage(7));
      });
    }
  },
  { // 7
    title: 'Il contrattacco',
    start() {
      MISSION.checkpoint = { pos: new V3(12, 0, -272), yaw: 0 };
      MISSION.minCharges = 1; P.charges = Math.max(P.charges, 1);
      say(N.sarge, 'Rinforzate le posizioni a sud! Arriverà il contrattacco!');
      after(5, () => say(N.radio, 'Easy Six a tutte le unità: fanteria e semicingolati nemici da sud. Tenete duro, i carri arrivano.'));
      reinforce(28, roadX(-240), -245);
      MISSION.allyZone = { defend: true, cx: 12, cz: -305, zMin: -334, zMax: -286, xMin: -80, xMax: 85, wait: [8, 15], kinds: ['wallN', 'house', 'church', 'ruin'] };
      for (const a of allies) if (a.alive && a.state !== 'boat') a.wait = rnd(0, 3);
      MISSION.defendT = 0; MISSION.waveI = 0; AU.battle = 1.3; WORLD.bombard = 'inland';
    },
    update(dt) {
      MISSION.defendT += dt;
      const rem = Math.max(0, 180 - MISSION.defendT), mm = Math.floor(rem / 60), ss = String(Math.floor(rem % 60)).padStart(2, '0');
      MISSION.objText = rem > 0 ? `Difendi Colleville finché arrivano i carri — ${mm}:${ss}` : 'I carri sono arrivati!';
      MISSION.markers = [{ pos: new V3(12, H(12, -318) + 2, -318), label: 'Linea sud' }];
      const waves = [4, 28, 52, 76, 100, 124, 148, 165];
      while (MISSION.waveI < waves.length && MISSION.defendT >= waves[MISSION.waveI]) {
        spawnCounter(Math.min(Q.enemyAlive - aliveE(), Math.round(rnd(9, 14) * Q.enemyAlive / 110))); MISSION.waveI++;
        if (MISSION.waveI === 3) say(N.walsh, 'Ne arrivano altri dal campo!');
      }
      once('ht1', MISSION.defendT > 50, () => { new Halftrack(rnd(-30, 0), -470); say(N.walsh, 'Semicingolato! Qualcuno ha un bazooka?'); });
      once('ht2', MISSION.defendT > 118, () => { new Halftrack(rnd(30, 60), -470); say(N.sarge, 'Un altro blindato! Fermatelo!'); });
      once('win', rem <= 0, victory);
    }
  },
  { // 8
    title: 'La città',
    start() {
      MISSION.checkpoint = { pos: new V3(roadPathX(-340), 0, -340), yaw: 0 };
      say(N.radio, 'Easy Six: la città è il nodo dei rinforzi tedeschi. Prendete la piazza del mercato e fate saltare il deposito dei camion.');
      after(6, () => say(N.sarge, 'E qualcuno zittisca quel cecchino sul campanile!'));
      reinforce(34, roadPathX(-330), -330, 15); MISSION.charges = 2; P.charges = Math.max(P.charges, 2); MISSION.minCharges = 2;
      MISSION.allyZone = { zMin: CITY.z0 + 60, zMax: 90, xMin: -200, xMax: 200, step: 16, wait: [3, 6] };
      for (let i = 0; i < Math.round(16 * Q.enemyAlive / 120); i++) addEnemy(randEnemyKind(), CITY.sq.x + rnd(-40, 40), CITY.sq.z + rnd(-30, 30), { state: 'post', stationary: true, group: 'city' });
      const d = WORLD.depot;
      MISSION.interactables = [{ pos: d.pos.clone().add(new V3(0, 0, 6)), r: 3, hold: 2.5, label: 'Tieni premuto E per minare il deposito', active: () => !d.destroyed && !MISSION.flags.depotCharge, done: () => { MISSION.flags.depotCharge = true; sfxMech('pick'); say(N.you, 'Carica sul deposito! Venti secondi!'); after(20, () => depotBlast(d.pos, 10, 5000)); } }];
    },
    update() {
      const sq = enemies.filter(e => e.alive && Math.hypot(e.pos.x - CITY.sq.x, e.pos.z - CITY.sq.z) < 45).length;
      const tower = enemies.some(e => e.alive && e.kind === 'sniper' && WORLD.cityTower && e.pos.distanceTo(WORLD.cityTower) < 3);
      if (!WORLD.depot.destroyed) aiEngineer('depot', WORLD.depot.pos.clone().add(new V3(0, 0, 7)), 6, 45, () => depotBlast(WORLD.depot.pos, 10, 5000));
      if (tower && sq === 0) once('towerShell', MISSION.stageT > 60, () => { say(N.radio, 'Carri: fuoco sul campanile!'); after(4, () => { for (const e of enemies) if (e.alive && e.kind === 'sniper' && e.pos.distanceTo(WORLD.cityTower) < 3) e.die(WORLD.cityTower, false, 'blast', { blast: WORLD.cityTower.clone(), power: 6 }); fxExplosion(WORLD.cityTower.clone(), 2.5, false); sfxBoom(WORLD.cityTower, 2.5); }); });
      const dep = WORLD.depot.destroyed, done = [sq === 0, !tower, dep].filter(Boolean).length;
      MISSION.objText = 'Piazza del mercato: ' + (sq ? sq + ' nemici' : 'presa') + ' · Deposito: ' + (dep ? 'distrutto' : 'intatto (cariche, bombe, Texas)') + ' · Campanile: ' + (tower ? 'cecchino attivo' : 'libero') + ' — ' + done + '/3';
      MISSION.markers = [];
      if (sq) MISSION.markers.push({ pos: CITY.sq.clone().add(new V3(0, 4, 0)), label: 'Piazza' });
      if (!dep) MISSION.markers.push({ pos: WORLD.depot.pos.clone().add(new V3(0, 4, 0)), label: 'Deposito' });
      if (tower) MISSION.markers.push({ pos: WORLD.cityTower.clone().add(new V3(0, 3, 0)), label: 'Cecchino' });
      if (P.mode === 'foot' && P.pos.z < -380) MISSION.checkpoint = { pos: new V3(P.pos.x, 0, P.pos.z + 4), yaw: 0 };
      once('cwin', done === 3, victory);
    }
  },
];

// ---------- la campagna avanza anche grazie ai compagni ----------
const alliesNear = (x, z, r) => allies.filter(a => a.alive && a.state !== 'boat' && !a.vip && Math.hypot(a.pos.x - x, a.pos.z - z) < r).length;
// un geniere dell'IA piazza una carica su un obiettivo se ci sono abbastanza compagni vicini
function aiEngineer(key, pos, need, delay, fn) {
  const f = MISSION.flags; if (f[key] === 'done') return;
  if (alliesNear(pos.x, pos.z, 26) >= need) f[key] = (f[key] || 0) + MISSION.dt; else f[key] = Math.max(0, (f[key] || 0) - MISSION.dt * .5);
  if (f[key] > delay) { f[key] = 'done'; const c = new V3(pos.x, Hf(pos.x, pos.z) + .4, pos.z); if (P.mode === 'foot' && P.pos.distanceTo(c) < 120) say(N.sarge, pick(['Il genio ha piazzato la carica! Giù la testa!', 'Carica piazzata! Fuoco nel buco!'])); after(5, () => { explode(c, 4.5, 260, { charge: true }); fn(); }); }
}
// stallo al terrapieno: un cacciatorpediniere martella la trincea e un gruppo parte all'assalto
function bankAssault(dt, targetZ) {
  const bank = allies.filter(a => a.alive && !a.vip && a.state !== 'boat' && a.pos.z < -46 && a.pos.z > -64 && Math.abs(a.pos.x) < 220);
  if (bank.length < 6) return;
  MISSION.assaultT = (MISSION.assaultT === undefined ? 40 : MISSION.assaultT) - dt; if (MISSION.assaultT > 0) return;
  MISSION.assaultT = 70;
  const gaps = wireGapsNow(); if (!gaps.length) return;
  let best = null, bn = -1;
  for (const g of gaps) { const gx = (g[0] + g[1]) / 2, n = bank.filter(a => Math.abs(a.pos.x - gx) < 40).length; if (n > bn) { bn = n; best = gx; } }
  if (bn < 3) return;
  const gx = best;
  if (P.mode === 'foot' || P.mode === 'naval') say(N.radio, pick(['Qui McCook: fuoco diretto sulla trincea, tenetevi giù!', 'Cacciatorpediniere sotto costa: apriamo il fuoco sulle postazioni!']));
  for (let i = 0; i < 9; i++) after(1 + i * .55, () => { const x = gx + rnd(-16, 16), p = new V3(x, 0, trenchZ(x) + rnd(-1.5, 1.5)); p.y = H(p.x, p.z); sfxWhistle(p, false); after(.8, () => explode(p, 6.5, 300, {})); });
  after(5.5, () => {
    const grp = bank.filter(a => a.alive).sort((a, b) => Math.abs(a.pos.x - gx) - Math.abs(b.pos.x - gx)).slice(0, 12);
    for (const a of grp) { const x = gx + rnd(-10, 10); a.chargeTo = new V3(x, 0, targetZ(x)); a.chargeT = 25; a.dest = new V3(clamp(a.pos.x, gx - 2, gx + 2), 0, WIRE_Z - 2); a.state = 'move'; a.crouchRun = false; if (a.cover) { a.cover.occ--; a.cover = null; } }
    if (grp[0] && dist2Cam(grp[0].pos) < 120 * 120) shout('en', 'move', grp[0].pos, { text: pick(["Let's go! Up the bluff!", 'Move! Move! Into the trench!', 'Follow me! Go!']), priority: true });
  });
}
// fronte bloccato ovunque: il gruppo più avanzato chiede fuoco di preparazione sul nemico davanti e assalta
function frontAssault(dt) {
  MISSION.frontT = (MISSION.frontT === undefined ? 50 : MISSION.frontT) - dt; if (MISSION.frontT > 0) return;
  MISSION.frontT = 60;
  const adv = allies.filter(a => a.alive && !a.vip && a.state !== 'boat' && !a.wounded && a.pos.z < 60 && Math.abs(a.pos.x) < 260);
  let leader = null;
  for (const a of adv.sort((p, q) => p.pos.z - q.pos.z)) { if (adv.filter(b => b.pos.distanceToSquared(a.pos) < 25 * 25).length >= 5) { leader = a; break; } }
  if (!leader) return;
  const ahead = enemies.filter(e => e.alive && !e.removed && e.pos.z < leader.pos.z + 4 && e.pos.distanceTo(leader.pos) < 100).sort((p, q) => p.pos.distanceTo(leader.pos) - q.pos.distanceTo(leader.pos)).slice(0, 8);
  if (ahead.length < 2) return;
  const c = new V3(); for (const e of ahead) c.add(e.pos); c.multiplyScalar(1 / ahead.length);
  // la mitragliatrice in postazione più vicina al gruppo viene presa di mira e distrutta
  const nests = WORLD.bunkers.concat(WORLD.extraBunkers || [], WORLD.tobruks || []).filter(b => !b.destroyed && Math.hypot(b.x - leader.pos.x, b.z - leader.pos.z) < 90);
  const nest = nests.sort((p, q) => Math.hypot(p.x - leader.pos.x, p.z - leader.pos.z) - Math.hypot(q.x - leader.pos.x, q.z - leader.pos.z))[0];
  if (nest) after(4, () => { const p = new V3(nest.x, nest.slitY || H(nest.x, nest.z), nest.z + 1.5); sfxWhistle(p, false); after(.8, () => { explode(p, 7, 320, {}); if (!nest.destroyed && R() < .75) { nest.destroy(); if (WORLD.bunkers.includes(nest)) onObjectiveEvent('bunker', nest, false); feed('Postazione nemica centrata dal fuoco navale'); } }); });
  if (P.mode === 'foot' || P.mode === 'naval') say(N.radio, pick(['Qui McCook: fuoco diretto sulle posizioni nemiche, tenetevi giù!', 'Cacciatorpediniere sotto costa: fuoco sulle coordinate!', 'Artiglieria in arrivo sulla posizione segnalata!']));
  for (let i = 0; i < 12; i++) after(1 + i * .5, () => { const p = new V3(c.x + rnd(-15, 15), 0, c.z + rnd(-10, 10)); p.y = Hf(p.x, p.z); if (p.distanceTo(leader.pos) < 18) return; sfxWhistle(p, false); after(.8, () => explode(p, 6.5, 300, {})); });
  after(5.5, () => {
    const grp = adv.filter(a => a.alive).sort((p, q) => p.pos.distanceTo(leader.pos) - q.pos.distanceTo(leader.pos)).slice(0, 16);
    for (const a of grp) { a.chargeTo = new V3(c.x + rnd(-10, 10), 0, c.z + rnd(-6, 6)); a.chargeT = 28; a.dest = a.chargeTo.clone(); a.state = 'move'; a.crouchRun = false; if (a.cover) { a.cover.occ--; a.cover = null; } }
    if (grp[0] && dist2Cam(grp[0].pos) < 120 * 120) shout('en', 'move', grp[0].pos, { text: pick(["Let's go! Up the bluff!", 'Move! Move! Take that position!', 'Follow me! Go!']), priority: true });
  });
}
// fase bloccata troppo a lungo: l'appoggio navale o aereo risolve l'obiettivo
function stallResolve() {
  if (PT !== 'A' || MISSION.stageT < 420 || MISSION.flags['stall' + MISSION.stage]) return;
  MISSION.flags['stall' + MISSION.stage] = true; const st = MISSION.stage;
  const boom = (x, z) => { const p = new V3(x, 0, z); p.y = Hf(x, z); explode(p, 8, 400, {}); };
  if (st === 2) { say(N.radio, 'Il genio ha aperto un varco nel filo a ovest!'); if (addWireGap(BREACH_X)) onWireGap(BREACH_X); else setStage(3); }
  else if (st === 3) { say(N.radio, 'Il 116° ha preso la trincea sulla scogliera!'); for (const e of enemies) if (e.alive && e.group === 'beach' && !e.inBunker && Math.abs(e.pos.z - trenchZ(e.pos.x)) < 4) e.die(null, false, 'blast', { blast: e.pos.clone(), power: 4 }); setStage(4); }
  else if (st === 4) { say(N.radio, 'Qui Texas: bunker sulla scogliera centrati!'); for (const b of WORLD.bunkers) if (!b.neutralized) { boom(b.x, b.z + 2); b.destroy(); onObjectiveEvent('bunker', b, false); } }
  else if (st === 5) { say(N.radio, 'Thunderbolt in picchiata: i cannoni da 88 sono distrutti!'); for (const f of WORLD.flaks) if (f.alive) { boom(f.x, f.z); f.destroy(); onObjectiveEvent('flak', f, false); } }
  else if (st === 6) { say(N.radio, 'I Ranger sono entrati a Colleville da est!'); for (const e of enemies) if (e.alive && e.group === 'village') { e.alive = false; e.removed = true; e.body.removed = true; } }
  else if (st === 8) { say(N.radio, 'Bombardieri sulla città: il deposito è in fiamme!'); depotBlast(WORLD.depot.pos, 10, 5000); for (const e of enemies) if (e.alive && (e.group === 'city' || Math.hypot(e.pos.x - CITY.sq.x, e.pos.z - CITY.sq.z) < 50)) { e.alive = false; e.removed = true; e.body.removed = true; } }
}
function setStage(i) {
  MISSION.stage = i; MISSION.stageT = 0; MISSION.markers = []; MISSION.interactables = [];
  const st = (SCEN === 'air' ? AIR_STAGES : SCEN === 'ard' ? ARD_STAGES : PT === 'E' ? AXIS_STAGES : STAGES)[i]; MISSION.title = st.title; st.start();
  if (i > 0) showMsg(st.title, 3);
}
function onWireGap(x) {
  feed('Varco aperto nel filo spinato');
  if (PT === 'A' && MISSION.stage === 2 && !MISSION.flags.placed) { if (P.carry === 'bangalore') P.carry = null; say(N.sarge, 'Il filo è saltato! Tutti attraverso il varco!'); setStage(3); }
  else if (PT === 'E') say(NA.obg, 'Il reticolato è squarciato! Passano da lì!');
}
// varchi e tubo Bangalore sempre disponibili per gli Alleati
function wireInteractables() {
  if (PT !== 'A' || P.mode !== 'foot' || MISSION.stage < 1 || MISSION.stage > 5) return [];
  const out = [];
  if (!P.carry && BANG_POS) out.push({ pos: BANG_POS, r: 2.4, label: 'Premi E per prendere un tubo Bangalore', active: () => true, done: () => { P.carry = 'bangalore'; sfxMech('pick'); feed('Hai preso il tubo Bangalore: infilalo sotto il filo spinato'); } });
  if (P.carry === 'bangalore' && Math.abs(P.pos.z - WIRE_Z) < 3 && wireBlocks(P.pos.x)) { const bx = P.pos.x; out.push({ pos: new V3(bx, P.pos.y, P.pos.z), r: 3, hold: 2.5, label: 'Tieni premuto E per infilare il Bangalore sotto il filo', active: () => true, done: () => placeBangalore(bx) }); }
  return out;
}
function nearestGap() { let best = null, bd = 1e9; for (const g of wireGapsNow()) { const gx = (g[0] + g[1]) / 2, d = Math.abs(gx - P.pos.x); if (d < bd) { bd = d; best = gx; } } return best; }
function placeBangalore(bx = BREACH_X) {
  P.carry = null; if (MISSION.stage === 2) { MISSION.flags.placed = true; MISSION.bangT = 5; }
  const tube = new THREE.Mesh(U.cyl, MAT.paint); tube.scale.set(.05, 3.2, .05); tube.rotation.x = PI / 2 - .12;
  tube.position.set(bx, H(bx, WIRE_Z) + .2, WIRE_Z); scene.add(tube);
  say(N.you, 'FUOCO NEL BUCO!'); say(N.sarge, 'Giù la testa!'); shout('en', 'fire', null, { priority: true });
  after(5, () => {
    scene.remove(tube);
    explode(new V3(bx, H(bx, WIRE_Z) + .3, WIRE_Z), 5, 220, {});
    if (Math.abs(bx - BREACH_X) < 4) { WORLD.wireBreached = true; buildWire(); } else addWireGap(bx);
    if (MISSION.stage === 2) setStage(3);
  });
}
function victory() {
  if (MISSION.stage === 7) { say(N.radio, 'Qui i carri della 741ª: Colleville è nostra. Ora la città!'); for (let i = 0; i < 2; i++) MISSION.tanks.push(new Sherman(roadX(-200) + i * 5, -200 - i * 14, 6 + i * 14)); after(6, () => setStage(8)); return; }
  say(N.radio, 'Easy Six a tutte le unità: la città è in mano americana. Ottimo lavoro!');
  for (const e of enemies) if (e.alive) e.flee = true;
  after(10, () => GAME.end(true));
}

function onSoldierDeath(s, byPlayer, zone) {
  if (s.team !== PT && byPlayer) { if (PT === 'E') { STATS.kills++; feed(zone === 'head' ? 'Americano eliminato — colpo alla testa' : 'Americano eliminato'); } }
  if (s.team === PT && PT === 'E') { MISSION.alliesLost++; if (R() < .1 && P.pos.distanceTo(s.pos) < 25 && SUBQ.length < 2) say('', pick(['Sanitäter!', 'Er ist tot!', 'Mein Gott, Hans!'])); return; }
  if (PT === 'E') return;
  if (s.team === 'E') {
    if (byPlayer) { STATS.kills++; feed(zone === 'head' ? 'Nemico eliminato — colpo alla testa' : zone === 'blast' ? 'Nemico eliminato — esplosione' : 'Nemico eliminato'); if (R() < .15) shout('en', 'kill', P.pos.clone().add(new V3(rnd(-6, 6), 0, rnd(-6, 6)))); }
    if (R() < .25 && (s.kind === 'rifle' || s.kind === 'smg' || s.kind === 'sniper') && !s.role && P.pos.distanceTo(s.pos) < 120 && !s.fixedY) spawnPickup(s.kind === 'smg' ? 'mp40' : 'kar98', s.pos.clone());
    if (s.bunker) onObjectiveEvent('bunker', s.bunker, byPlayer);
  } else {
    MISSION.alliesLost++;
    if (s.name && P.pos.distanceTo(s.pos) < 60) { say(N.walsh, `${s.name} è a terra!`); s.name = ''; }
    else if (R() < .12 && P.pos.distanceTo(s.pos) < 25 && SUBQ.length < 2) say('', pick(['Uomo a terra!', 'Medico!', 'Lo hanno preso!', 'Sono colpito!']));
  }
}
function onObjectiveEvent(type, obj, byPlayer) {
  if (obj._ann) return; obj._ann = true;
  if (type === 'bunker') { feed('Bunker MG42 neutralizzato'); const left = WORLD.bunkers.filter(b => !b.neutralized).length; if (left) say(N.sarge, `Bunker neutralizzato! Ne restano ${left}!`); }
  if (type === 'flak') feed('Cannone da 88 distrutto');
}
function onPlayerDisembark() { MISSION.godT = Math.max(MISSION.godT, 4); P.supp = 0; if (MISSION.stage === 0) setStage(1); }

// ---------- mezzi ----------
let HT_G, SHERMAN_G;
class Halftrack {
  constructor(x, z) {
    if (!HT_G) {
      const mb = new MB(), c = 0xa59a72, d = 0x55544c, g = 0x6a7050; mb.mat = 'paint';
      mb.add(U.box, c, 0, .95, 0, 0, 0, 0, 2.1, 1.0, 5.8);
      mb.add(U.box, c, 0, 1.35, -2.4, .28, 0, 0, 1.9, .7, 1.8);
      for (const sx of [-1, 1]) { mb.add(U.box, c, sx * 1.02, 1.85, .7, 0, 0, sx * -.18, .08, .9, 3.6); mb.add(U.box, d, sx * .95, .5, .9, 0, 0, 0, .38, .85, 3.6); mb.add(U.cyl12, d, sx * 1.0, .45, -2.3, 0, 0, PI / 2, .45, .3, .45); for (let k = 0; k < 4; k++) mb.add(U.cyl12, d, sx * .95, .4, -.3 + k * .75, 0, 0, PI / 2, .3, .4, .3); }
      mb.add(U.box, c, 0, 1.85, 2.55, -.15, 0, 0, 2.1, .9, .08);
      mb.add(U.box, g, .5, 1.2, 1.5, 0, 0, 0, .8, .5, 1.2); mb.add(U.box, g, -.6, 1.3, -1.2, 0, 0, 0, .7, .4, 1.5);
      mb.add(U.box, d, 0, 2.5, -.75, 0, 0, 0, .9, .55, .06);
      mb.add(U.cyl, d, 0, 2.55, -1.2, PI / 2, 0, 0, .035, .9, .035);
      HT_G = mb.buildGroups();
    }
    this.g = groupMesh(HT_G);
    this.gm = makeSoldierModelStatic('E', 'mg'); this.gm.position.set(0, .85, .1); this.g.add(this.gm);
    this.pos = this.g.position; this.pos.set(x, H(x, z), z);
    this.yaw = PI; this.g.rotation.y = PI;
    this.alive = true; this.hp = 700; this.gunnerAlive = true; this.dest = new V3(x + rnd(-10, 10), 0, -350);
    this.fireT = 2; this.burst = 0; this.target = null; this.tVis = false; this.thinkT = 0; this.vis = [];
    this.w = AIW.mg; this.team = 'E'; this.snd = 'mg42'; this.kind = 'mg'; this.supp = 0; this.crouch = 0; this.sweep = 0; this.shoutT = 99;
    this.box = { min: new V3(), max: new V3() };
    this.eng = loopSound('eng_boat', 0);
    scene.add(this.g); MISSION.vehicles.push(this);
  }
  eye(o) { return o.set(this.pos.x - Math.sin(this.yaw) * 1.2, this.pos.y + 2.6, this.pos.z - Math.cos(this.yaw) * 1.2); }
  muzzle(o) { return this.eye(o); }
  chest(o) { return o.set(this.pos.x, this.pos.y + 1.5, this.pos.z); }
  gunnerHead(o) { return o.set(this.pos.x + Math.sin(this.yaw) * .1, this.pos.y + .85 + 1.72, this.pos.z + Math.cos(this.yaw) * .1); }
  update(dt) {
    if (this.eng) this.eng.at(this.pos, this.alive ? 1.2 : 0, .8, 60);
    if (!this.alive) return;
    const dx = this.dest.x - this.pos.x, dz = this.dest.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 1) { const v = Math.min(d, 3.4 * dt); this.pos.x += dx / d * v; this.pos.z += dz / d * v; this.yaw = angLerp(this.yaw, Math.atan2(-dx, -dz), dt * 2); }
    this.pos.y = Hf(this.pos.x, this.pos.z); this.g.rotation.y = this.yaw;
    this.box.min.set(this.pos.x - 1.6, this.pos.y, this.pos.z - 3.1); this.box.max.set(this.pos.x + 1.6, this.pos.y + 2.4, this.pos.z + 3.1);
    if (!this.gunnerAlive) return;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = .6; Soldier.prototype.findTarget.call(this); }
    if (this.target && this.tVis) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        if (this.burst <= 0) this.burst = Math.round(rnd(10, 25));
        Soldier.prototype.fire.call(this); this.burst--;
        this.fireT = this.burst > 0 ? .06 : rnd(1, 2.2);
      }
    }
  }
  damage(a, byPlayer) { if (!this.alive) return; this.hp -= a; if (this.hp <= 0) this.destroy(byPlayer); }
  destroy(byPlayer) {
    this.alive = false; this.gunnerAlive = false; this.gm.visible = false;
    burnMeshes(this.g);
    const p = this.pos.clone(); p.y += 1.5;
    fxExplosion(p, 2.6, false); sfxBoom(p, 2.4); addEmitter(p, 'fire', 1.1); fxDebris(p, 20, 2);
    addSolid(this.box.min.x, this.box.min.y, this.box.min.z, this.box.max.x, this.box.max.y, this.box.max.z, 'tank');
    if (byPlayer) { STATS.kills += 3; feed('Semicingolato distrutto!'); }
    say(N.sarge, 'Blindato distrutto!');
  }
  killGunner(byPlayer) { if (!this.gunnerAlive) return; this.gunnerAlive = false; this.gm.visible = false; if (byPlayer) { STATS.kills++; feed('Mitragliere del semicingolato eliminato'); } }
}
// soldato statico (non istanziato) per il mitragliere del semicingolato
function makeSoldierModelStatic(team, kind) {
  const g = new THREE.Group();
  for (const [key, y] of [[team + '_chest', 1.05], [team + '_head', 1.57], [team + '_helmet', 1.69]]) { const m = new THREE.Mesh(getMesh(key).lo.geometry, MAT.soldier); m.position.y = y; g.add(m); }
  const w = new THREE.Mesh(getMesh(team + '_w_' + kind).lo.geometry, MAT.soldier); w.position.set(.1, 1.35, -.3); g.add(w);
  return g;
}
class Sherman {
  constructor(x, z, tx) {
    if (!SHERMAN_G) { const mb = new MB(); addSherman(mb, 0, 0, 0, 0, false); SHERMAN_G = mb.buildGroups(); }
    this.m = groupMesh(SHERMAN_G); scene.add(this.m);
    this.pos = this.m.position; this.pos.set(x, H(x, z), z); this.dest = new V3(tx, 0, -272); this.fireT = rnd(2, 4); this.yaw = PI;
    this.eng = loopSound('eng_boat', 0);
  }
  update(dt) {
    if (this.eng) this.eng.at(this.pos, 1.5, .6, 80);
    const dx = this.dest.x - this.pos.x, dz = this.dest.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 1) {
      const tgt = d > 30 ? new V3(roadX(this.pos.z - 10), 0, this.pos.z - 10) : this.dest;
      const ex = tgt.x - this.pos.x, ez = tgt.z - this.pos.z, e = Math.hypot(ex, ez) || 1;
      this.pos.x += ex / e * 5 * dt; this.pos.z += ez / e * 5 * dt; this.yaw = angLerp(this.yaw, Math.atan2(-ex, -ez), dt * 2);
    } else {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = rnd(3, 6);
        const mz = new V3(this.pos.x - Math.sin(this.yaw) * 3.4, this.pos.y + 2.3, this.pos.z - Math.cos(this.yaw) * 3.4);
        PS_FIRE.emit(mz.x, mz.y, mz.z, 0, 0, -6, .2, 3, 5, 1, 4, 2.5, 1.2); sfxBoom(mz, 1.2);
        const t = new V3(this.pos.x + rnd(-40, 40), 0, rnd(-430, -380)); t.y = Hf(t.x, t.z);
        after(.5, () => { fxExplosion(t, 1.6, false); sfxBoom(t, 1.4); });
      }
    }
    this.pos.y = Hf(this.pos.x, this.pos.z); this.m.rotation.y = this.yaw;
  }
}

function suppressBunker(b, tobruk) {
  const was = b.supT > 0; b.supT = 4.5; MISSION.suppT = 4.5;
  if (b.gunner && b.gunner.alive) { b.gunner.supp = 1; b.gunner.duck = true; b.gunner.duckT = Math.min(b.gunner.duckT, 1); }
  if (!was && !b.neutralized) { feed(tobruk ? 'Torretta Tobruk soppressa — il mitragliere si è abbassato!' : 'MG42 soppressa — gli alleati avanzano!'); if (R() < .5) shout('en', 'move', P.pos.clone().add(new V3(rnd(-8, 8), 0, rnd(-5, 5))), { text: pick(['Suppress that bunker! Go, go!', "He's pinned! Move up!", 'Keep his head down! Move!']) }); }
}
function updateMission(dt) {
  MISSION.dt = dt;
  if (NET.client) { updateSubs(dt); for (const v of MISSION.vehicles) v.update(dt); return; }
  if (SCEN === 'ard') { updateArdennes(dt); return; }
  if (SCEN === 'air') { updateAirMode(dt); return; }
  MISSION.suppT = Math.max(0, (MISSION.suppT || 0) - dt);
  for (const b of [...WORLD.bunkers, ...(WORLD.extraBunkers || []), ...(WORLD.tobruks || [])]) b.supT = Math.max(0, (b.supT || 0) - dt);
  MISSION.stageT += dt; MISSION.nadeCD -= dt; MISSION.eNadeCD -= dt; MISSION.allyNadeCD -= dt;
  (PT === 'E' ? AXIS_STAGES : STAGES)[MISSION.stage].update(dt);
  stallResolve();
  if (MISSION.stage >= 1 && !(PT === 'A' && MISSION.stage === 7) && !(MISSION.allyZone && MISSION.allyZone.defend)) frontAssault(dt);
  updateSubs(dt);
  // ondate di sbarco continue
  if (MISSION.stage >= 1) {
    MISSION.waveT -= dt;
    if (MISSION.waveT <= 0) { MISSION.waveT = 10; ensureFleet(); }
  }
  if (MISSION.stage >= 1 && MISSION.stage <= (PT === 'E' ? 2 : 4)) {
    MISSION.reinfT -= dt;
    if (MISSION.reinfT <= 0) { MISSION.reinfT = rnd(12, 20); }
  }
  for (const b of WORLD.boats) if (b.doom !== undefined && b.state === 'move' && b.z < b.doom) {
    b.doom = undefined; const p = b.g.position.clone(); p.y += 1;
    fxExplosion(p, 2.4, true); sfxBoom(p, 2.2, true); b.state = 'sunk';
    for (const a of allies) if (a.boat === b && a.alive) { a.state = 'boat'; a.die(p, false, 'blast', { blast: p, power: 10 }); }
  }
  // mortai tedeschi: solo dalle postazioni con serventi vivi
  if (MISSION.mortar) {
    const crews = WORLD.mortarPits.filter(mp => enemies.some(e => e.alive && e.role === 'mortar' && Math.hypot(e.pos.x - mp.x, e.pos.z - mp.z) < 4));
    MISSION.mortarT -= dt * crews.length / 2;
    if (MISSION.mortarT <= 0 && crews.length) {
      MISSION.mortarT = rnd(1.8, 3.6);
      const pit = pick(crews), pp = new V3(pit.x, Hf(pit.x, pit.z) + 1, pit.z);
      sfxMortar(pp); PS_SMOKE.emit(pp.x, pp.y + .8, pp.z, 0, 2, 0, 2, .5, 2, .5, .5, .5, .5, 1);
      const onBeach = allies.filter(a => a.alive && a.state !== 'boat' && a.pos.z > -60 && a.pos.z < 90);
      let c;
      if (PT === 'A' && P.targetable() && P.pos.z > -64 && R() < .22) c = P.pos.clone().add(new V3(rnd(-14, 14), 0, rnd(-12, 12)));
      else if (onBeach.length) c = pick(onBeach).pos.clone().add(new V3(rnd(-9, 9), 0, rnd(-9, 9)));
      else c = new V3(rnd(-150, 150), 0, rnd(-50, 80));
      c.z = Math.max(c.z, -59); c.y = Math.max(Hf(c.x, c.z), WATER_Y - .2);
      after(2.2, () => { sfxWhistle(c, false); if (P.pos.distanceTo(c) < 25 && R() < .4) shout('en', 'mortar', P.pos.clone().add(new V3(4, 0, 3))); });
      after(3.2, () => explode(c, 4.4, 220, { only: 'A' }));
    }
  }
  if (MISSION.flakOn) for (const f of WORLD.flaks) {
    if (!f.alive) continue;
    f.fireT -= dt;
    if (f.fireT <= 0) {
      f.fireT = rnd(6, 10);
      PS_FIRE.emit(f.muzzle.x, f.muzzle.y, f.muzzle.z, 0, 1, 8, .2, 3, 5, 1, 4, 2.6, 1.2);
      for (let i = 0; i < 4; i++) PS_SMOKE.emit(f.muzzle.x, f.muzzle.y, f.muzzle.z, rnd(-1, 1), rnd(.5, 1.5), rnd(2, 6), rnd(3, 5), 1, 5, .5, .5, .5, .5, .6);
      sfxShip(f.muzzle); flashLight(f.muzzle, 0xffb060, 40, .15);
      const t = new V3(rnd(-120, 120), 0, rnd(-50, 6)); t.y = Math.max(Hf(t.x, t.z), WATER_Y - .2);
      after(1.6, () => explode(t, 5, 260, { only: 'A' }));
    }
  }
  for (const v of MISSION.vehicles) v.update(dt);
  for (const t of MISSION.tanks) t.update(dt);
}
