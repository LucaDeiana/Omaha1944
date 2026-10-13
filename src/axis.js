"use strict";
// ============================================================
//  Campagna dell'Asse: difesa del Widerstandsnest 62
// ============================================================
const NA = { feld: 'Feldwebel Krüger', obg: 'Obergefreiter Lang', funk: 'Funker' };
const FRIENDS = () => PT === 'A' ? allies : enemies, FOES = () => PT === 'A' ? enemies : allies;
const countFoes = f => allies.filter(a => a.alive && a.state !== 'boat' && f(a)).length;
function holdText(t, total) { const r = Math.max(0, total - t); return Math.floor(r / 60) + ':' + String(Math.floor(r % 60)).padStart(2, '0'); }

function initAxis() {
  const xs = [-97, -72, -47, -22, 3, 28, 53];
  const per = clamp(Math.floor((Q.allyAlive * .55) / 7), 4, 10);
  for (let k = 0; k < 10; k++) { const fx = rnd(260, MAPX - 120) * (k % 2 ? 1 : -1); fillBoat(new Boat(fx, rnd(330, 420), rnd(8.2, 9), 82), clamp(Math.floor(per * .7), 4, 8), false); }
  for (const x of xs) fillBoat(new Boat(x, rnd(330, 380), rnd(8.2, 8.9), 82), per, false);
  for (let i = 0; i < 6; i++) addCorpse('E', rnd(-150, 150), rnd(-96, -84));
  spawnBeachDefenders(); battleSmoke(); spawnBeachHolders();
  const b = WORLD.bunkers[1] || WORLD.bunkers[0], x = b.x + 5;
  MISSION.checkpoint = { pos: new V3(x, 0, trenchZ(x) + .2), yaw: PI };
  P.inBoat = false; P.boat = null; P.pos.set(x, Hf(x, trenchZ(x) + .2), trenchZ(x) + .2); P.yaw = PI;
  P.inv = [{ id: 'kar98', mag: 5, res: 60 }, { id: 'mp40', mag: 32, res: 160 }, null]; P.cur = 0; P.prevSlot = 1; P.nades = 5;
  const fp = (id, px, pz, res) => { const p = spawnPickup(id, new V3(px, 0, pz), undefined, res); p.fixed = true; };
  fp('mp40', x - 6, trenchZ(x - 6) + .2); fp('kar98zf', x + 2, trenchZ(x + 2) + .2); fp('kar98zf', -20, -110); fp('kar98', -40, -172.5); fp('mp40', 10, -270);
  addCrate(x + 3, trenchZ(x + 3) - .6); addCrate(-30, -176); addCrate(14, -276);
  if (MISSION.endless) { setStage(6); after(1, () => { for (const b of WORLD.boats) b.speed *= 1; }); } else setStage(0);
  initConvoy(); initTanks();
}
function axisBreach() {
  if (WORLD.wireBreached) return;
  explode(new V3(BREACH_X, H(BREACH_X, WIRE_Z) + .3, WIRE_Z), 5, 220, {});
  WORLD.wireBreached = true; buildWire();
  say(NA.obg, 'Sie haben den Draht gesprengt! Hanno aperto un varco nel filo spinato!');
}
function axisEnd(win, why) {
  GAME.axisWhy = why;
  if (win) { say(NA.funk, 'Hier Regiment 916: la 352ª contrattacca. Avete tenuto, gut gemacht!'); for (const a of allies) if (a.alive) a.flee = true; }
  after(win ? 8 : 3, () => GAME.end(win));
}
const AXIS_STAGES = [
  { // 0
    title: 'WN 62 — 06:25',
    start() { MISSION.allyZone = null; WORLD.bombard = 'bluff'; AU.battle = 1.2; },
    update() {
      const b = WORLD.boats.reduce((m, x) => x.state === 'move' && (!m || x.z < m.z) ? x : m, null);
      const eta = b ? Math.max(0, (b.z - b.stopZ) / b.speed) : 0;
      MISSION.objText = `Mezzi da sbarco in avvicinamento — a terra tra ${Math.ceil(eta)} s. Prendi posizione nella trincea`;
      once('a1', MISSION.stageT > 2, () => say(NA.feld, 'Alle Mann auf Position! Tutti ai posti! Fuoco solo al mio ordine!'));
      once('a2', MISSION.stageT > 10, () => say(NA.obg, 'Mein Gott... guardate quante navi. È tutto il mare.'));
      once('a3', eta < 20, () => say(NA.feld, 'Aspettate che abbassino le rampe... poi Feuer frei!'));
      if (WORLD.boats.some(x => x.landed)) setStage(1);
    }
  },
  { // 1
    title: 'Fuoco sulla spiaggia',
    start() {
      MISSION.allyZone = { zMin: -56.8, zMax: 90, xMin: -200, xMax: 200, step: 13, wait: [2.5, 6] };
      MISSION.mortar = true; AU.battle = 1.6; MISSION.waveT = 20;
      say(NA.feld, 'FEUER FREI! Fuoco a volontà sulle rampe!');
    },
    update() {
      const atBank = countFoes(a => a.pos.z < -48 && a.pos.z > -62), T = 300;
      MISSION.objText = `Inchioda gli Americani sulla spiaggia — al terrapieno: ${atBank}/20 · ${holdText(MISSION.stageT, T)}`;
      MISSION.markers = [];
      once('b1', MISSION.stageT > 40, () => say(NA.obg, 'Ne arrivano sempre di più! Non finiscono mai!'));
      once('b2', MISSION.stageT > 120, () => say(NA.funk, 'Il caposaldo 61 non risponde più!'));
      if (atBank >= 20 || MISSION.stageT > T) { axisBreach(); setStage(2); }
    }
  },
  { // 2
    title: 'La scogliera',
    start() {
      MISSION.allyZone = { zMin: -93, zMax: 90, xMin: -200, xMax: 200, step: 12, wait: [2.5, 5.5] };
      after(60, () => { if (MISSION.stage === 2) MISSION.allyZone = { zMin: -96, zMax: 90, xMin: -200, xMax: 200, step: 10, wait: [3, 7] }; });
      reinforce(30, BREACH_X, -50, 15); releaseHolders();
      say(NA.feld, 'Salgono dal canalone! Granate, Handgranaten!');
    },
    update() {
      const T = 240, inTrench = countFoes(a => a.pos.z < -82 && a.pos.z > -100 && Math.abs(a.pos.x) < 165);
      MISSION.objText = `Tieni la trincea sulla scogliera — Americani in trincea: ${inTrench}/12 · ${holdText(MISSION.stageT, T)}`;
      MISSION.markers = [{ pos: new V3(BREACH_X, H(BREACH_X, trenchZ(BREACH_X)) + 2, trenchZ(BREACH_X)), label: 'Canalone' }];
      if (MISSION.stageT > T) { once('w2', true, () => axisEnd(true, 'La scogliera ha retto: gli Americani sono rimasti inchiodati sulla spiaggia.')); return; }
      if (inTrench >= 12) setStage(3);
    }
  },
  { // 3
    title: 'Ripiegamento sulle siepi',
    start() {
      MISSION.checkpoint = { pos: new V3(-30, 0, -174), yaw: PI }; MISSION.mortar = false; WORLD.bombard = 'inland';
      say(NA.feld, 'Zurück! Ripiegare sulla linea delle siepi! Muoversi!');
      for (const e of enemies) if (e.alive && e.pos.z > -100 && !e.inBunker && R() < .5) { e.stationary = false; e.state = 'move'; e.toPost = true; e.objective = new V3(rnd(-100, 90), 0, -172.8); }
      spawnBattery(); MISSION.flakOn = true;
      reinforce(34, rnd(-60, 20), -95, 20);
      MISSION.allyZone = { zMin: -205, zMax: 90, xMin: -200, xMax: 200, step: 14, wait: [3, 6] };
    },
    update() {
      const T = 240, past = countFoes(a => a.pos.z < -178);
      MISSION.objText = `Ferma gli Americani al bocage — oltre le siepi: ${past}/12 · ${holdText(MISSION.stageT, T)}`;
      MISSION.markers = [{ pos: new V3(-30, H(-30, -172) + 2, -172), label: 'Siepi' }];
      if (MISSION.stageT > T) { once('w3', true, () => axisEnd(true, 'Il bocage ha fermato l\'avanzata: la testa di ponte resta sulla spiaggia.')); return; }
      if (past >= 12) setStage(4);
    }
  },
  { // 4
    title: 'Colleville-sur-Mer',
    start() {
      MISSION.checkpoint = { pos: new V3(12, 0, -280), yaw: PI }; MISSION.flakOn = false;
      say(NA.feld, 'Al villaggio! Ogni casa è una fortezza. Kein Schritt zurück!');
      spawnVillage(); reinforce(36, -10, -170, 25);
      MISSION.allyZone = { zMin: -300, zMax: 90, xMin: -200, xMax: 200, step: 16, wait: [3, 6] };
    },
    update() {
      const T = 240, sq = countFoes(a => Math.hypot(a.pos.x - SQUARE.x, a.pos.z - SQUARE.z) < 40);
      MISSION.objText = `Difendi Colleville finché arriva la 352ª — Americani in piazza: ${sq}/15 · ${holdText(MISSION.stageT, T)}`;
      MISSION.markers = [{ pos: new V3(SQUARE.x, H(SQUARE.x, SQUARE.z) + 3, SQUARE.z), label: 'Piazza' }];
      if (MISSION.stageT > T) { once('w4', true, () => axisEnd(true, 'Colleville è rimasta tedesca fino all\'arrivo dei rinforzi.')); return; }
      if (sq >= 15) setStage(5);
    }
  },
  { // 5
    title: 'La città',
    start() {
      MISSION.checkpoint = { pos: CITY.sq.clone().add(new V3(0, 0, 20)), yaw: PI };
      say(NA.feld, 'Colleville è perduta. Tutti in città: la piazza del mercato e il deposito vanno tenuti a ogni costo!');
      MISSION.allyZone = { zMin: CITY.z0 + 60, zMax: 90, xMin: -200, xMax: 200, step: 16, wait: [3, 6] };
      reinforce(40, roadPathX(-300), -300, 20);
    },
    update() {
      const T = 300, sq = countFoes(a => Math.hypot(a.pos.x - CITY.sq.x, a.pos.z - CITY.sq.z) < 40);
      MISSION.objText = 'Difendi la piazza del mercato e il deposito — Americani in piazza: ' + sq + '/15 · deposito ' + (WORLD.depot.destroyed ? 'DISTRUTTO' : 'intatto') + ' · ' + holdText(MISSION.stageT, T);
      MISSION.markers = [{ pos: CITY.sq.clone().add(new V3(0, 4, 0)), label: 'Piazza' }, { pos: WORLD.depot.pos.clone().add(new V3(0, 4, 0)), label: 'Deposito' }];
      if (MISSION.stageT > T) { once('w5', true, () => axisEnd(true, 'La città ha resistito: la 21ª Panzer arriva a dare il cambio.')); return; }
      if (sq >= 15) once('l5', true, () => axisEnd(false, 'Gli Americani hanno preso la città.'));
    }
  },
  { // 6 — modalità infinita
    title: 'Difesa a oltranza',
    start() { MISSION.allyZone = { zMin: -56.8, zMax: 90, xMin: -200, xMax: 200, step: 13, wait: [2.5, 6] }; MISSION.mortar = true; AU.battle = 1.6; MISSION.waveT = 5; say(NA.feld, 'Non arriveranno rinforzi. Teniamo finché c\'è un uomo vivo!'); },
    update(dt) {
      const t = MISSION.stageT, lvl = 1 + Math.floor(t / 90), inT = countFoes(a => a.pos.z < -82 && a.pos.z > -100 && Math.abs(a.pos.x) < 165);
      MISSION.level = lvl;
      if (lvl >= 3 && !WORLD.wireBreached) axisBreach();
      if (lvl >= 3 && MISSION.allyZone.zMin > -90) MISSION.allyZone = { zMin: -96, zMax: 90, xMin: -200, xMax: 200, step: 13, wait: [2, 5], kinds: ['bank', 'tank', 'sand', 'crater', 'hh', 'gate', 'trench', 'bunker'] };
      MISSION.objText = 'Modalità infinita — ondata ' + lvl + ' · resistito ' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + ' · uccisioni ' + STATS.kills + ' · Americani in trincea: ' + inT + '/25';
      once('e' + lvl, lvl > 1, () => { feed('Ondata ' + lvl + ': più mezzi da sbarco in arrivo'); say(NA.obg, pick(['Ne arrivano ancora di più!', 'Altre barche! Sempre di più!', 'Il mare è nero di barche!'])); });
      if (inT >= 25) once('eend', true, () => axisEnd(false, 'Difesa a oltranza: resistito ' + Math.floor(t / 60) + ' minuti e ' + Math.floor(t % 60) + ' secondi fino all\'ondata ' + lvl + ', con ' + STATS.kills + ' Americani eliminati.'));
    }
  },
];
