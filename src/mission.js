"use strict";
// ============================================================
//  Missione: fasi, dialoghi, ondate, mortai, cannoni, mezzi
// ============================================================
const MISSION = {
  stage: -1, stageT: 0, allyZone: null, interactables: [], vehicles: [], markers: [], objText: '', title: '',
  checkpoint: { pos: new V3(-22, 0, 0), yaw: 0 }, nadeCD: 0, godT: 0, mortar: false, mortarT: 4, alliesLost: 0, minCharges: 0,
  flags: {}, defendT: 0, flakOn: false, tanks: [], bangT: 0,
};
const TIMERS = [];
function after(t, fn) { TIMERS.push({ t, fn }); }
function updateTimers(dt) { for (let i = TIMERS.length - 1; i >= 0; i--) { const x = TIMERS[i]; x.t -= dt; if (x.t <= 0) { TIMERS.splice(i, 1); x.fn(); } } }
function once(key, cond, fn) { if (cond && !MISSION.flags[key]) { MISSION.flags[key] = true; fn(); } }

// sottotitoli
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
const randAllyKind = () => { const r = R(); return r < .6 ? 'rifle' : r < .75 ? 'smg' : r < .9 ? 'bar' : 'medic'; };
const randEnemyKind = () => R() < .72 ? 'rifle' : 'smg';
const SEATS = [];
for (let r = 0; r < 7; r++) for (let c = -1; c <= 1; c++) SEATS.push(new V3(c * .95, .47, -3.6 + r * 1.1));
function fillBoat(b, n, squad) {
  const seats = SEATS.filter((s, i) => i !== 16);
  const names = [N.sarge, N.walsh, N.kow, N.baker, N.russo, N.doc];
  const kinds = ['rifle', 'smg', 'bar', 'rifle', 'rifle', 'medic'];
  for (let i = 0; i < n && i < seats.length; i++) {
    const sq = squad && i >= 3 && i < 9;
    const a = addAlly(sq ? kinds[i - 3] : randAllyKind(), b.x, b.z, { state: 'boat', squad: sq, name: sq ? names[i - 3] : '' });
    a.boat = b; a.off = seats[i].clone(); a.leave = (seats[i].z + 3.6) * .42 + rnd(0, .35);
  }
}
function addCorpse(team, x, z) {
  const s = new Soldier(team, 'rifle', x, z, {}); s.yaw = R() * TAU; s.root.rotation.y = s.yaw;
  s.alive = false; s.fall = 0; s.fallDir = R() < .5 ? 1 : -1; s.fallTw = rnd(-1, 1); s.update(1);
  corpses.push(s);
}
function aliveAllies() { return allies.filter(a => a.alive && a.state !== 'boat').length; }
function reinforce(target, x, z, spread = 8) {
  const n = Math.min(target - aliveAllies(), 12);
  for (let i = 0; i < n; i++) { const a = addAlly(randAllyKind(), x + rnd(-spread, spread), z + rnd(-spread, spread), { state: 'idle' }); a.wait = rnd(.2, 2); }
}
function addCrate(x, z) {
  const y = H(x, z), g = new THREE.Group();
  const mb = new MB();
  mb.add(U.box, 0x55603a, 0, .3, 0, 0, 0, 0, 1.1, .6, .6); mb.add(U.box, 0x4a5432, 0, .62, 0, 0, 0, 0, 1.14, .06, .64);
  mb.add(U.box, 0xd8d0b0, .2, .3, -.302, 0, 0, 0, .4, .12, .01);
  mb.add(U.box, 0x55603a, .3, .85, .05, 0, .4, 0, .5, .4, .35);
  const m = new THREE.Mesh(mb.build(), MAT.vc); m.castShadow = true; g.add(m); g.position.set(x, y, z); g.rotation.y = rnd(-.3, .3); scene.add(g);
  WORLD.crates.push({ x, z });
}
let BANG_POS;
function addBangaloreCrate(x, z) {
  const mb = new MB(), y = H(x, z);
  mb.add(U.box, 0x6b5a3c, 0, .25, 0, 0, 0, 0, 2.2, .5, .7);
  for (let i = 0; i < 3; i++) mb.add(U.cyl, 0x4d5537, -.2 + i * .2, .58, 0, 0, 0, PI / 2, .04, 2.5, .04);
  const m = new THREE.Mesh(mb.build(), MAT.vc); m.position.set(x, y, z); m.rotation.y = .1; m.castShadow = true; scene.add(m);
  BANG_POS = new V3(x, y, z);
}

function initMission() {
  const xs = [-97, -72, -47, -22, 3, 28, 53];
  const per = clamp(Math.floor((Q.allies - 9) / 6), 3, 9);
  for (const x of xs) {
    const me = x === -22;
    const b = new Boat(x, me ? 380 : rnd(368, 396), me ? 8.5 : rnd(8.2, 8.9), 11);
    if (me) { P.boat = b; fillBoat(b, 9, true); } else fillBoat(b, per, false);
  }
  P.inBoat = true; P.yaw = 0;
  for (let i = 0; i < 12; i++) addCorpse('A', rnd(-160, 160), rnd(-48, -4));
  spawnBeachDefenders();
  const fp = (id, x, z, res) => { const p = spawnPickup(id, new V3(x, 0, z), undefined, res); p.fixed = true; };
  fp('thompson', -14, -27); fp('bar', -44, -55.1); fp('bazooka', -17, -55.3, 4); fp('thompson', 30, -40);
  fp('springfield', -58, trenchZ(-58) + .2); fp('bar', 40, trenchZ(40) + .2); fp('bazooka', -20, -160, 3); fp('thompson', -40, -200);
  addCrate(-26, -55.4); addCrate(-38, trenchZ(-38) + .3); addCrate(-24, -163); addCrate(14, -276); addCrate(-32, -110);
  addBangaloreCrate(-36, -55.3);
  setStage(0);
}

function spawnBeachDefenders() {
  const m = Q.enemyMul, step = 8.5 / m;
  for (let x = -158; x < 158; x += step * rnd(.8, 1.2)) {
    if (WORLD.bunkers.some(b => Math.abs(b.x - x) < 6)) continue;
    addEnemy(R() < .8 ? 'rifle' : 'smg', x, trenchZ(x) + .2, { state: 'post', stationary: true, inTrench: true, group: 'beach' });
  }
  for (const x of [-65, 55]) addEnemy('mg', x, trenchZ(x) + .3, { state: 'post', stationary: true, inTrench: true, group: 'beach' });
  for (const b of WORLD.bunkers) b.gunner = addEnemy('mg', b.x, b.z + 2.5, { y: b.base + 1.2, state: 'post', stationary: true, inBunker: true, bunker: b, group: 'beach' });
  addEnemy('sniper', -140, -104, { state: 'post', stationary: true, group: 'beach' });
  addEnemy('sniper', 125, -106, { state: 'post', stationary: true, group: 'beach' });
  for (const [x, z] of [[-80, -74], [-5, -77], [60, -73], [140, -75], [-130, -72], [95, -79]]) addEnemy('rifle', x, z, { state: 'post', stationary: true, group: 'beach' });
}
function spawnSecondWave() {
  const room = Q.allies + 6 - aliveAllies();
  if (room < 6) return;
  const xs = [-90, -62, -36, -8, 22, 50], per = clamp(Math.floor(room / 6), 2, 7);
  for (const x of xs) { const b = new Boat(x, rnd(240, 290), rnd(8.6, 9.4), 11); fillBoat(b, per, false); }
}
function spawnBattery() {
  const m = Q.enemyMul;
  for (const f of WORLD.flaks) for (let i = 0; i < Math.round(5 * m); i++) { const a = rnd(-PI, 0) + (i % 2 ? PI : 0) * .5; addEnemy(randEnemyKind(), f.x + Math.cos(a) * 6.5, f.z + Math.sin(a) * 6.5, { state: 'post', stationary: true, group: 'battery' }); }
  const gapAt = x => HEDGES[0].gaps.some(g => x > g[0] - 2 && x < g[1] + 2);
  for (let i = 0; i < Math.round(9 * m); i++) { const x = rnd(-110, 100); if (gapAt(x)) continue; addEnemy(randEnemyKind(), x, -172.8, { state: 'post', stationary: true, group: 'battery' }); }
  addEnemy('mg', -34, -174, { state: 'post', stationary: true, group: 'battery' });
  for (let i = 0; i < Math.round(4 * m); i++) addEnemy(randEnemyKind(), rnd(-90, 90), -220.8, { state: 'post', stationary: true, group: 'battery' });
  addEnemy('sniper', 75, -205, { state: 'post', stationary: true, group: 'battery' });
}
function spawnVillage() {
  const m = Q.enemyMul;
  for (let i = 0; i < Math.round(7 * m); i++) addEnemy(randEnemyKind(), pick([rnd(-90, -44), rnd(-18, 36), rnd(56, 90)]), -251.4, { state: 'post', stationary: true, group: 'village' });
  for (const [x, z] of [[-67, -262], [-30, -266], [-6, -262], [22, -270], [43, -262], [60, -263], [-52, -283], [30, -285], [-72, -282], [0, -290]])
    if (R() < .7 * m + .2) addEnemy(randEnemyKind(), x, z, { state: 'post', stationary: true, group: 'village' });
  addEnemy('mg', -31, -259.6, { state: 'post', stationary: true, group: 'village' });
  const tt = WORLD.towerTop; addEnemy('sniper', tt.x, tt.z, { y: tt.y, state: 'post', stationary: true, group: 'village' });
  for (let i = 0; i < 4; i++) addEnemy(randEnemyKind(), SQUARE.x + rnd(-10, 10), SQUARE.z + rnd(-6, 6), { state: 'post', stationary: true, group: 'village' });
}
function spawnWave(n) {
  for (let i = 0; i < n; i++) {
    const r = R(), kind = r < .55 ? 'rifle' : r < .9 ? 'smg' : 'mg';
    const e = addEnemy(kind, rnd(-110, 110), rnd(-445, -420), { state: 'assault', group: 'counter', objective: SQUARE.clone().add(new V3(rnd(-15, 15), 0, rnd(-10, 10))) });
    e.yaw = 0; e.wait = rnd(0, 2);
  }
}

// ---------- fasi ----------
const STAGES = [
  { // 0
    title: 'Avvicinamento — 06:31',
    start() { MISSION.allyZone = null; WORLD.bombard = 'bluff'; AU.battle = 1.2; },
    update() {
      const b = P.boat, eta = Math.max(0, (b.z - b.stopZ) / b.speed), t = MISSION.stageT;
      MISSION.objText = b.landed ? 'Preparati a sbarcare!' : `Sbarco tra ${Math.ceil(eta)} s — resta giù`;
      once('s1', t > 2, () => say(N.sarge, 'Ascoltate! Quando la rampa si abbassa, fuori e di lato: mai dritti davanti!'));
      once('s2', t > 9, () => say(N.walsh, 'Guardate la Texas... sta radendo al suolo la scogliera.'));
      once('s3', t > 16, () => say(N.sarge, 'Controllate le armi! Tenete la sabbia lontana dall\'otturatore!'));
      once('s4', t > 23, () => say(N.kow, 'Ave Maria, piena di grazia...'));
      once('s5', eta < 18, () => say(N.cox, 'Mitragliatrici sulla spiaggia! State giù!'));
      once('hit', eta < 14, () => {
        const nb = WORLD.boats.find(x => x.x === 3);
        if (!nb) return;
        const p = nb.g.position.clone(); p.y += 1;
        fxExplosion(p, 2.2, true); sfxBoom(p, 2); P.shake += .8;
        nb.state = 'sunk';
        for (const a of allies) if (a.boat === nb && a.alive) a.die(null, false);
        addEmitter(p, 'fire', 1);
        after(1.2, () => say(N.walsh, 'Hanno colpito la barca di Miller! Oh Dio...'));
      });
      once('s6', eta < 8, () => say(N.cox, 'Dieci secondi! Che Dio vi assista!'));
      once('ramp', b.landed, () => {
        say(N.cox, 'RAMPA GIÙ!');
        after(.9, () => {
          const front = allies.filter(a => a.boat === b && a.alive && !a.squad).slice(0, 2);
          const src = new V3(b.x + 20, 14, -82);
          for (const a of front) { a.die(src, false); fxTracer(src, a.chest(new V3())); fxImpact(a.chest(new V3()), 'blood'); sfxShot('mg42', src); }
          for (let i = 0; i < 10; i++) after(i * .06, () => { sfxShot('mg42', src); const q = new V3(b.x + rnd(-1.5, 1.5), b.y + rnd(.5, 2), b.z - 5.5); fxTracer(src, q); fxImpact(q, 'metal'); sfxImpact(q, 'metal'); });
        });
      });
    }
  },
  { // 1
    title: 'Omaha Beach — Dog Green',
    start() {
      MISSION.checkpoint = { pos: new V3(P.boat.x, 0, P.boat.z - 10), yaw: 0 };
      MISSION.allyZone = { zMin: -56.8, zMax: 8, xMin: -200, xMax: 200, step: 13, wait: [2.5, 6] };
      MISSION.mortar = true; AU.battle = 1.5;
      say(N.sarge, 'Fuori! Fuori! Dritti agli ostacoli, non fermatevi in acqua!');
      after(8, () => say(N.walsh, 'MG42 sulla scogliera! Ci stanno falciando!'));
      after(16, () => say(N.doc, 'Medico! Ho bisogno di aiuto qui!'));
      after(26, () => say(N.sarge, 'Al terrapieno! Raggiungete i ciottoli!'));
    },
    update() {
      MISSION.objText = 'Raggiungi il terrapieno di ciottoli ai piedi della scogliera';
      const x = clamp(P.pos.x, -60, 10);
      MISSION.markers = [{ pos: new V3(x, H(x, BANK_Z + 1.5) + 1.2, BANK_Z + 1.5), label: 'Terrapieno' }];
      if (P.pos.z < -46) MISSION.checkpoint = { pos: new V3(clamp(P.pos.x, -150, 150), 0, -40), yaw: 0 };
      if (P.pos.z < -53.5) setStage(2);
    }
  },
  { // 2
    title: 'Il filo spinato',
    start() {
      MISSION.checkpoint = { pos: new V3(-26, 0, -55.2), yaw: 0 };
      say(N.sarge, 'Il filo spinato ci blocca! Ci serve un tubo Bangalore.');
      after(4, () => say(N.sarge, 'Tu! Prendi il Bangalore dalla cassa e fai saltare quel filo!'));
      const wp = new V3(BREACH_X, H(BREACH_X, WIRE_Z + .8), WIRE_Z + .8);
      MISSION.interactables = [
        { pos: BANG_POS, r: 2.4, label: 'Premi E per prendere il tubo Bangalore', active: () => !P.carry && !MISSION.flags.placed, done: () => { P.carry = 'bangalore'; sfxMech('pick'); feed('Hai preso il tubo Bangalore'); } },
        { pos: wp, r: 2.4, hold: 2.5, label: 'Tieni premuto E per infilare il Bangalore sotto il filo', active: () => P.carry === 'bangalore', done: placeBangalore },
      ];
    },
    update(dt) {
      if (!MISSION.flags.placed) {
        MISSION.objText = P.carry ? 'Infila il tubo Bangalore sotto il filo spinato' : 'Prendi il tubo Bangalore dalla cassa';
        MISSION.markers = [P.carry ? { pos: new V3(BREACH_X, H(BREACH_X, WIRE_Z) + 1.5, WIRE_Z), label: 'Filo spinato' } : { pos: BANG_POS.clone().add(new V3(0, 1.4, 0)), label: 'Bangalore' }];
      } else {
        MISSION.bangT -= dt; MISSION.markers = [];
        MISSION.objText = `Fuoco nel buco! Allontanati! ${Math.max(0, Math.ceil(MISSION.bangT))}`;
      }
    }
  },
  { // 3
    title: 'La scogliera',
    start() {
      MISSION.checkpoint = { pos: new V3(BREACH_X, 0, WIRE_Z + 2.5), yaw: 0 };
      MISSION.allyZone = { zMin: -93, zMax: -58, xMin: -75, xMax: 25, step: 12, wait: [2.5, 5.5] };
      say(N.sarge, 'Il filo è aperto! Tutti attraverso il varco, su per la scogliera!');
      after(6, () => say(N.walsh, 'Campi minati ai lati! Restate sul sentiero del canalone!'));
      after(14, () => say(N.radio, 'Seconda ondata in arrivo sulla spiaggia.'));
      spawnSecondWave();
    },
    update() {
      const tp = new V3(BREACH_X, 0, trenchZ(BREACH_X)); tp.y = H(tp.x, tp.z) + 1.5;
      MISSION.markers = [{ pos: tp, label: 'Trincea' }];
      const near = enemies.filter(e => e.alive && !e.inBunker && Math.hypot(e.pos.x - tp.x, e.pos.z - tp.z) < 30).length;
      MISSION.objText = near ? `Conquista la trincea in cima alla scogliera — difensori: ${near}` : 'Raggiungi la trincea in cima alla scogliera';
      if (P.pos.z < -70) MISSION.checkpoint = { pos: new V3(BREACH_X + 2, 0, -72), yaw: 0 };
      for (const mf of MINEFIELDS) once('mf' + mf[0], P.pos.x > mf[0] - 5 && P.pos.x < mf[1] + 5 && P.pos.z < mf[3] + 4 && P.pos.z > mf[2], () => { say(N.walsh, 'Fermo! Campo minato! Guarda i cartelli!'); });
      if (near === 0 && Math.hypot(P.pos.x - tp.x, P.pos.z - tp.z) < 10) setStage(4);
    }
  },
  { // 4
    title: 'I bunker MG42',
    start() {
      MISSION.checkpoint = { pos: new V3(BREACH_X, 0, trenchZ(BREACH_X)), yaw: 0 };
      P.charges = Math.max(P.charges, 3); MISSION.minCharges = 3; WORLD.bombard = 'inland';
      feed('Ricevute 3 cariche da demolizione');
      say(N.sarge, 'Trincea presa! Ora quei bunker: prendi queste cariche e falli saltare!');
      say(N.walsh, 'Le porte posteriori danno sulla trincea. O una granata dritta nella feritoia!');
      MISSION.allyZone = { zMin: -96, zMax: -78, xMin: -165, xMax: 165, step: 0, wait: [3, 7], kinds: ['trench', 'bunker'] };
      MISSION.interactables = WORLD.bunkers.map(b => ({
        pos: b.door, r: 2.8, hold: 2, label: 'Tieni premuto E per piazzare la carica da demolizione',
        active: () => !b.neutralized && !b.charged && P.charges > 0,
        done: () => {
          P.charges--; b.charged = true; sfxMech('pick');
          const c = new THREE.Mesh(U.box, MAT.vc); c.scale.set(.4, .3, .2); c.position.copy(b.door).add(new V3(0, 1, .9)); scene.add(c);
          say(N.you, 'Carica piazzata! Sei secondi!');
          after(6, () => { scene.remove(c); explode(b.door.clone().add(new V3(0, 1, 1)), 4, 220, { byPlayer: true, charge: true }); b.destroy(); onObjectiveEvent('bunker', b, true); });
        }
      }));
      const m = Q.enemyMul;
      for (let i = 0; i < Math.round(6 * m); i++) { const e = addEnemy(randEnemyKind(), rnd(-80, 60), rnd(-150, -135), { state: 'assault', group: 'beach', objective: new V3(rnd(-60, 40), 0, -94) }); e.yaw = PI; }
    },
    update() {
      const left = WORLD.bunkers.filter(b => !b.neutralized);
      MISSION.objText = `Neutralizza i bunker MG42 (${3 - left.length}/3) — cariche (E), granate o bazooka`;
      MISSION.markers = left.map(b => ({ pos: new V3(b.x, b.base + 6, b.z), label: 'MG42' }));
      if (Math.abs(P.pos.z - trenchZ(P.pos.x)) < 2.5 && P.pos.x > -150 && P.pos.x < 150) MISSION.checkpoint = { pos: new V3(P.pos.x, 0, trenchZ(P.pos.x)), yaw: 0 };
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
      reinforce(16, roadX(-100), -100);
      MISSION.allyZone = { zMin: -205, zMax: -92, xMin: -110, xMax: 100, step: 14, wait: [3, 6] };
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
      MISSION.objText = `Distruggi i cannoni da 88 mm (${2 - left.length}/2) — cariche (E) o bazooka`;
      MISSION.markers = left.map(f => ({ pos: f.pos.clone().add(new V3(0, 4.5, 0)), label: 'Flak 88' }));
      if (P.pos.z < -176 && P.pos.z > -215) MISSION.checkpoint = { pos: new V3(roadX(-180), 0, -180), yaw: 0 };
      once('fdone', !left.length, () => { MISSION.flakOn = false; say(N.sarge, 'I cannoni tacciono! La spiaggia respira.'); after(4, () => setStage(6)); });
    }
  },
  { // 6
    title: 'Colleville-sur-Mer',
    start() {
      MISSION.checkpoint = { pos: new V3(roadX(-205), 0, -205), yaw: 0 };
      say(N.sarge, 'Ora il villaggio: Colleville-sur-Mer. Casa per casa, ragazzi.');
      after(5, () => say(N.radio, 'Attenzione: cecchino segnalato sul campanile della chiesa.'));
      spawnVillage(); reinforce(18, roadX(-190), -190); AU.battle = .8;
      MISSION.allyZone = { zMin: -300, zMax: -160, xMin: -100, xMax: 100, step: 16, wait: [3, 6] };
    },
    update() {
      const left = enemies.filter(e => e.alive && e.group === 'village');
      MISSION.objText = `Libera Colleville-sur-Mer — nemici rimasti: ${left.length}`;
      MISSION.markers = left.length <= 4 ? left.map(e => ({ pos: e.pos.clone().add(new V3(0, 2.4, 0)), label: '' })) : [{ pos: new V3(SQUARE.x, H(SQUARE.x, SQUARE.z) + 3, SQUARE.z), label: 'Piazza' }];
      if (P.pos.z < -240) MISSION.checkpoint = { pos: new V3(-30, 0, -245), yaw: 0 };
      once('vdone', left.length <= 2 && MISSION.stageT > 10, () => {
        for (const e of left) e.flee = true;
        say(N.walsh, 'Scappano! Il villaggio è nostro!');
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
      reinforce(20, roadX(-240), -245);
      MISSION.allyZone = { defend: true, cx: 12, cz: -305, zMin: -334, zMax: -286, xMin: -80, xMax: 85, wait: [8, 15], kinds: ['wallN', 'house', 'church', 'ruin'] };
      for (const a of allies) if (a.alive && a.state !== 'boat') a.wait = rnd(0, 3);
      MISSION.defendT = 0; MISSION.waveI = 0; AU.battle = 1.2; WORLD.bombard = 'inland';
    },
    update(dt) {
      MISSION.defendT += dt;
      const rem = Math.max(0, 180 - MISSION.defendT), mm = Math.floor(rem / 60), ss = String(Math.floor(rem % 60)).padStart(2, '0');
      MISSION.objText = rem > 0 ? `Difendi Colleville finché arrivano i carri — ${mm}:${ss}` : 'I carri sono arrivati!';
      MISSION.markers = [{ pos: new V3(12, H(12, -318) + 2, -318), label: 'Linea sud' }];
      const waves = [4, 30, 58, 86, 112, 138, 160];
      while (MISSION.waveI < waves.length && MISSION.defendT >= waves[MISSION.waveI]) {
        spawnWave(Math.round(rnd(6, 9) * Q.enemyMul)); MISSION.waveI++;
        if (MISSION.waveI === 3) say(N.walsh, 'Ne arrivano altri dal campo!');
      }
      once('ht1', MISSION.defendT > 50, () => { new Halftrack(rnd(-30, 0), -470); say(N.walsh, 'Semicingolato! Qualcuno ha un bazooka?'); });
      once('ht2', MISSION.defendT > 118, () => { new Halftrack(rnd(30, 60), -470); say(N.sarge, 'Un altro blindato! Fermatelo!'); });
      once('win', rem <= 0, victory);
    }
  },
];

function setStage(i) {
  MISSION.stage = i; MISSION.stageT = 0; MISSION.markers = []; MISSION.interactables = [];
  const st = STAGES[i]; MISSION.title = st.title; st.start();
  if (i > 0) showMsg(st.title, 3);
}
function placeBangalore() {
  P.carry = null; MISSION.flags.placed = true; MISSION.bangT = 5;
  const tube = new THREE.Mesh(U.cyl, MAT.vc); tube.scale.set(.05, 3.2, .05); tube.rotation.x = PI / 2 - .12;
  tube.position.set(BREACH_X, H(BREACH_X, WIRE_Z) + .2, WIRE_Z); scene.add(tube);
  say(N.you, 'FUOCO NEL BUCO!'); say(N.sarge, 'Giù la testa!');
  after(5, () => {
    scene.remove(tube);
    explode(new V3(BREACH_X, H(BREACH_X, WIRE_Z) + .3, WIRE_Z), 5, 220, {});
    WORLD.wireBreached = true; buildWire(); setStage(3);
  });
}
function victory() {
  say(N.radio, 'Qui i carri della 741ª: stiamo entrando a Colleville!');
  for (const e of enemies) if (e.alive) e.flee = true;
  for (let i = 0; i < 2; i++) MISSION.tanks.push(new Sherman(roadX(-200) + i * 5, -200 - i * 14, 6 + i * 14));
  after(12, () => GAME.end(true));
}

function onSoldierDeath(s, byPlayer, zone) {
  if (s.team === 'E') {
    if (byPlayer) { STATS.kills++; feed(zone === 'head' ? 'Nemico eliminato — colpo alla testa' : zone === 'blast' ? 'Nemico eliminato — esplosione' : 'Nemico eliminato'); }
    if (R() < .3 && (s.kind === 'rifle' || s.kind === 'smg' || s.kind === 'sniper') && P.pos.distanceTo(s.pos) < 120 && !s.fixedY) spawnPickup(s.kind === 'smg' ? 'mp40' : 'kar98', s.pos.clone());
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
  if (type === 'flak') { feed('Cannone da 88 distrutto'); }
}
function onPlayerDisembark() { if (MISSION.stage === 0) setStage(1); }

// ---------- mezzi ----------
let HT_GEO, SHERMAN_GEO;
class Halftrack {
  constructor(x, z) {
    if (!HT_GEO) {
      const mb = new MB(), c = 0x7d7552, d = 0x3f3c33, g = 0x5a6040;
      mb.add(U.box, c, 0, .95, 0, 0, 0, 0, 2.1, 1.0, 5.8);
      mb.add(U.box, c, 0, 1.35, -2.4, .28, 0, 0, 1.9, .7, 1.8);
      for (const sx of [-1, 1]) { mb.add(U.box, c, sx * 1.02, 1.85, .7, 0, 0, sx * -.18, .08, .9, 3.6); mb.add(U.box, d, sx * .95, .5, .9, 0, 0, 0, .38, .85, 3.6); mb.add(U.cyl12, d, sx * 1.0, .45, -2.3, 0, 0, PI / 2, .45, .3, .45); }
      mb.add(U.box, c, 0, 1.85, 2.55, -.15, 0, 0, 2.1, .9, .08);
      mb.add(U.box, g, .5, 1.2, 1.5, 0, 0, 0, .8, .5, 1.2); mb.add(U.box, g, -.6, 1.3, -1.2, 0, 0, 0, .7, .4, 1.5);
      mb.add(U.box, d, 0, 2.5, -.75, 0, 0, 0, .9, .55, .06);
      mb.add(U.cyl, d, 0, 2.55, -1.2, PI / 2, 0, 0, .035, .9, .035);
      HT_GEO = mb.build();
    }
    this.mat = MAT.vcMetal.clone();
    this.g = new THREE.Group(); const body = new THREE.Mesh(HT_GEO, this.mat); body.castShadow = true; this.g.add(body);
    this.gm = makeSoldierModel('E', 'mg'); this.gm.root.position.set(0, .85, .1); this.g.add(this.gm.root);
    this.pos = this.g.position; this.pos.set(x, H(x, z), z);
    this.yaw = PI; this.g.rotation.y = PI;
    this.alive = true; this.hp = 700; this.gunnerAlive = true; this.dest = new V3(x + rnd(-10, 10), 0, -350);
    this.fireT = 2; this.burst = 0; this.target = null; this.tVis = false; this.thinkT = 0;
    this.w = AIW.mg; this.team = 'E'; this.snd = 'mg42'; this.kind = 'mg'; this.supp = 0; this.crouch = 0;
    this.box = { min: new V3(), max: new V3() };
    scene.add(this.g); MISSION.vehicles.push(this);
  }
  eye(o) { return o.set(this.pos.x - Math.sin(this.yaw) * 1.2, this.pos.y + 2.6, this.pos.z - Math.cos(this.yaw) * 1.2); }
  muzzle(o) { return this.eye(o); }
  chest(o) { return o.set(this.pos.x, this.pos.y + 1.5, this.pos.z); }
  gunnerHead(o) { return o.set(this.pos.x + Math.sin(this.yaw) * .1, this.pos.y + .85 + 1.72, this.pos.z + Math.cos(this.yaw) * .1); }
  update(dt) {
    if (!this.alive) return;
    const dx = this.dest.x - this.pos.x, dz = this.dest.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 1) { const v = Math.min(d, 3.4 * dt); this.pos.x += dx / d * v; this.pos.z += dz / d * v; this.yaw = angLerp(this.yaw, Math.atan2(-dx, -dz), dt * 2); }
    this.pos.y = H(this.pos.x, this.pos.z); this.g.rotation.y = this.yaw;
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
    this.alive = false; this.gunnerAlive = false; this.gm.root.visible = false;
    this.mat.color.setRGB(.25, .23, .2);
    const p = this.pos.clone(); p.y += 1.5;
    fxExplosion(p, 2.5, false); sfxBoom(p, 2.2); addEmitter(p, 'fire', 1.1);
    addSolid(this.box.min.x, this.box.min.y, this.box.min.z, this.box.max.x, this.box.max.y, this.box.max.z, 'tank');
    if (byPlayer) { STATS.kills += 3; feed('Semicingolato distrutto!'); }
    say(N.sarge, 'Blindato distrutto!');
  }
  killGunner(byPlayer) { if (!this.gunnerAlive) return; this.gunnerAlive = false; this.gm.root.visible = false; if (byPlayer) { STATS.kills++; feed('Mitragliere del semicingolato eliminato'); } }
}
class Sherman {
  constructor(x, z, tx) {
    if (!SHERMAN_GEO) { const mb = new MB(); addSherman(mb, 0, 0, 0, 0, false); SHERMAN_GEO = mb.build(); }
    this.m = new THREE.Mesh(SHERMAN_GEO, MAT.vcMetal); this.m.castShadow = true; scene.add(this.m);
    this.pos = this.m.position; this.pos.set(x, H(x, z), z); this.dest = new V3(tx, 0, -272); this.fireT = rnd(2, 4); this.yaw = PI;
  }
  update(dt) {
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
        const t = new V3(this.pos.x + rnd(-40, 40), 0, rnd(-430, -380)); t.y = H(t.x, t.z);
        after(.5, () => { fxExplosion(t, 1.6, false); sfxBoom(t, 1.4); });
      }
    }
    this.pos.y = H(this.pos.x, this.pos.z); this.m.rotation.y = this.yaw;
  }
}

function updateMission(dt) {
  MISSION.stageT += dt; MISSION.nadeCD -= dt;
  STAGES[MISSION.stage].update(dt);
  updateSubs(dt);
  // mortai tedeschi sulla spiaggia
  if (MISSION.mortar) {
    MISSION.mortarT -= dt;
    if (MISSION.mortarT <= 0) {
      MISSION.mortarT = rnd(1.8, 3.6);
      const onBeach = allies.filter(a => a.alive && a.state !== 'boat' && a.pos.z > -60 && a.pos.z < 12);
      let c;
      if (P.targetable() && P.pos.z > -64 && R() < .22) c = P.pos.clone().add(new V3(rnd(-14, 14), 0, rnd(-12, 12)));
      else if (onBeach.length) c = pick(onBeach).pos.clone().add(new V3(rnd(-9, 9), 0, rnd(-9, 9)));
      else c = new V3(rnd(-150, 150), 0, rnd(-50, 10));
      c.z = Math.max(c.z, -59); c.y = Math.max(H(c.x, c.z), WATER_Y - .2);
      sfxWhistle(c);
      after(1, () => explode(c, 4.2, 200, { only: 'A' }));
    }
  }
  // cannoni da 88 che sparano sulla spiaggia
  if (MISSION.flakOn) for (const f of WORLD.flaks) {
    if (!f.alive) continue;
    f.fireT -= dt;
    if (f.fireT <= 0) {
      f.fireT = rnd(6, 10);
      PS_FIRE.emit(f.muzzle.x, f.muzzle.y, f.muzzle.z, 0, 1, 8, .2, 3, 5, 1, 4, 2.6, 1.2);
      for (let i = 0; i < 4; i++) PS_SMOKE.emit(f.muzzle.x, f.muzzle.y, f.muzzle.z, rnd(-1, 1), rnd(.5, 1.5), rnd(2, 6), rnd(3, 5), 1, 5, .5, .5, .5, .5, .6);
      sfxShip(f.muzzle); flashLight(f.muzzle, 0xffb060, 40, .15);
      const t = new V3(rnd(-120, 120), 0, rnd(-50, 6)); t.y = Math.max(H(t.x, t.z), WATER_Y - .2);
      after(1.6, () => explode(t, 5, 240, { only: 'A' }));
    }
  }
  for (const v of MISSION.vehicles) v.update(dt);
  for (const t of MISSION.tanks) t.update(dt);
}
