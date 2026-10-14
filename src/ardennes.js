"use strict";
// ============================================================
//  Scenario "Ardenne — Bois Jacques, dicembre 1944".
//  La Easy Company tiene una linea di buche nel bosco innevato
//  davanti a Foy: prima respinge la fanteria tedesca, poi i Panzer,
//  infine contrattacca e riprende il villaggio.
//  Usa le stesse meccaniche di Omaha (IA, armi, carri, supporto
//  aereo, punteggio) con terreno, alberi, meteo e missioni propri.
// ============================================================
let SCEN = 'omaha';
const ARD = { foxes: [], foxGrid: new Map(), village: new V3(0, 0, -300), vy: 0, snow: null, waveT: 8, waves: 0, flags: {} };
const NE = { winters: 'Lt. Winters', lipton: 'Sgt. Lipton', guarnere: 'Sgt. Guarnere', toye: 'Pvt. Toye', radio: 'Radio' };
const ardRoadX = z => 14 * Math.sin(z * .011) + 4;
const ardLineZ = x => 2.5 * Math.sin(x * .05);

// ---------- terreno ----------
function ardBase(x, z) {
  return 12 + (fbm(x * .0055 + 3, z * .0055, 4) - .5) * 22 + (fbm(x * .028, z * .028, 2) - .5) * 1.6 - z * .006;
}
function ardH(x, z) {
  let y = ardBase(x, z);
  // villaggio di Foy su un pianoro
  const dv = Math.hypot(x - ARD.village.x, z - ARD.village.z);
  if (dv < 85) y = lerp(y, ARD.vy, smooth((85 - dv) / 30));
  // strada battuta
  const rd = Math.abs(x - ardRoadX(z));
  if (rd < 7) { const ry = ardBase(ardRoadX(z), z); y = lerp(y, dv < 85 ? lerp(ry, ARD.vy, smooth((85 - dv) / 30)) : ry, smooth((7 - rd) / 3)) - (rd < 3 ? .12 : 0); }
  // buche di volpe della linea americana
  const a = ARD.foxGrid.get(Math.floor(x / 4) + ',' + Math.floor(z / 4));
  if (a) for (const f of a) { const d = Math.hypot(x - f.x, z - f.z); if (d < 1.25) y -= 1.2 * smooth((1.25 - d) / .45); else if (d < 2.2) y += .35 * Math.sin((d - 1.25) / .95 * PI); }
  // crateri di granata
  const c = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
  if (c) for (const k of c) { const dx = x - k.x, dz = z - k.z, d2 = dx * dx + dz * dz; if (d2 < k.r * k.r) { const q = Math.sqrt(d2) / k.r; y += q < .72 ? -k.d * (1 - (q / .72) ** 2) : k.d * .35 * Math.sin((q - .72) / .28 * PI); } }
  return y;
}
// neve: sabbia schiarita e azzurrata; terra scura su strada, buche e crateri
function ardSplat(x, z, n2) {
  let sa = 1, di = 0, sc = 0;
  const rd = Math.abs(x - ardRoadX(z)); if (rd < 3.6) di += smooth((3.6 - rd) / 1.4) * 1.6;
  const a = ARD.foxGrid.get(Math.floor(x / 4) + ',' + Math.floor(z / 4));
  if (a) for (const f of a) { const d = Math.hypot(x - f.x, z - f.z); if (d < 2.4) di += (1 - d / 2.4) * 2.5; }
  const c = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
  if (c) for (const k of c) { const d = Math.hypot(x - k.x, z - k.z); if (d < k.r * 1.3) { const q = 1 - d / (k.r * 1.3); di += q * 1.8; sc = Math.max(sc, q * .7); } }
  const dv = Math.hypot(x - ARD.village.x, z - ARD.village.z); if (dv < 60) di += .25;
  const t = 1.34 + .1 * n2, tot = sa + di;
  return { sp: [sa / tot, 0, 0, di / tot], sc, cl: [t * 1.0, t * 1.06, t * 1.25] };
}

// ---------- costruzione del mondo ----------
function buildArdennes() {
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  ARD.vy = ardBase(ARD.village.x, ARD.village.z);
  // linea di buche: 25 buche lungo il margine del bosco
  for (let x = -112; x <= 112; x += 9.3) {
    const f = { x: x + rnd(-1.5, 1.5), z: ardLineZ(x) + rnd(-1, 1) };
    ARD.foxes.push(f);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const k = (Math.floor(f.x / 4) + i) + ',' + (Math.floor(f.z / 4) + j); let l = ARD.foxGrid.get(k); if (!l) ARD.foxGrid.set(k, l = []); if (!l.includes(f)) l.push(f); }
  }
  // crateri dei bombardamenti nel campo e nel bosco
  for (let i = 0; i < 140; i++) { const x = rnd(-230, 230), z = rnd(-280, 60); if (Math.abs(x - ardRoadX(z)) > 6 && Math.hypot(x - ARD.village.x, z - ARD.village.z) > 70 && Math.abs(z - ardLineZ(x)) > 5) addCrater(x, z, rnd(1.6, 3.6), rnd(.5, 1.2)); }
  buildHF(); buildHC();
  buildTerrain();
  buildWater();
  // bordi delle buche: sacchetti e tronchi; coperture per l'IA
  const mb = new MB();
  for (const f of ARD.foxes) {
    const y = H(f.x, f.z);
    sandbagLine(mb, f.x - 1.3, f.z - 1.7, f.x + 1.3, f.z - 1.7, 1);
    mb.mat = 'wood';
    for (let k = 0; k < 3; k++) mb.add(U.cyl, 0x4a3a2a, f.x + rnd(-.3, .3), y + .25 + k * .05, f.z + 1.3 + k * .32, 0, rnd(-.15, .15), PI / 2, .12, 2.8, .12);
    addCover(f.x, f.z, 'trench'); addCover(f.x + .9, f.z + .2, 'trench');
  }
  // tronchi abbattuti nel campo come ripari
  for (let i = 0; i < 40; i++) {
    const x = rnd(-200, 200), z = rnd(-230, -20); if (Math.abs(x - ardRoadX(z)) < 7) continue;
    const y = H(x, z), ry = R() * PI; mb.mat = 'wood'; mb.add(U.cyl, 0x3d3024, x, y + .3, z, 0, ry, PI / 2, .3, rnd(5, 9), .3);
    addCover(x + Math.cos(ry) * .9, z - Math.sin(ry) * .9, 'sand'); addCover(x - Math.cos(ry) * .9, z + Math.sin(ry) * .9, 'sand');
  }
  // Foy: case di pietra attorno all'incrocio, alcune in rovina, muretti
  const houses = [[-16, -280, 9, 11, 6], [18, -284, 10, 9, 7], [-20, -305, 8, 10, 5.5], [22, -308, 11, 10, 6.5], [-18, -330, 10, 9, 6], [20, -334, 9, 11, 7], [-48, -296, 9, 9, 5.5], [50, -300, 10, 8, 6], [-44, -322, 8, 10, 5], [46, -326, 9, 9, 6], [0, -352, 12, 9, 8], [-30, -262, 8, 8, 5]];
  houses.forEach(([x, z, w, d, h], i) => { addHouse(mb, x + ardRoadX(z) - 4, z, w, d, h, i % 4 === 3); addCover(x + ardRoadX(z) - 4 + (x < 0 ? w / 2 + 1 : -w / 2 - 1), z, 'house'); });
  for (let i = 0; i < 10; i++) { const z = -270 - i * 9, x = ardRoadX(z); sandbagLine(mb, x - 9, z, x - 9, z - 4, 1); sandbagLine(mb, x + 9, z, x + 9, z - 4, 1); addCover(x - 8, z, 'sand'); addCover(x + 8, z, 'sand'); }
  // carro americano distrutto e jeep abbandonata lungo la strada
  addSherman(mb, ardRoadX(-120) + 7, H(ardRoadX(-120) + 7, -120), -120, .6, true); addCover(ardRoadX(-120) + 7, -116, 'tank');
  addTiled(mb, 120);
  buildTrees();
  // atmosfera invernale: nebbia lattiginosa, sole basso e debole
  FOG_COL.setRGB(.78, .8, .84); scene.fog.color.copy(FOG_COL); scene.fog.density = FOG_BASE * 1.35;
  if (sun) sun.intensity *= .7;
  buildSnowfall();
}
// fiocchi di neve in un volume che segue la camera
function buildSnowfall() {
  const n = Math.round(2500 + Q.particles * 3500), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-40, 40); pos[i * 3 + 1] = rnd(-5, 25); pos[i * 3 + 2] = rnd(-40, 40); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, opacity: .85, depthWrite: false, fog: true });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); ARD.snow = pts;
}
function updateSnowfall(dt) {
  const s = ARD.snow; if (!s) return; const a = s.geometry.attributes.position.array, cp = camera.position, t = GAME.time;
  for (let i = 0; i < a.length; i += 3) {
    a[i + 1] -= dt * (1.1 + (i % 7) * .08); a[i] += Math.sin(t * .7 + i) * dt * .25;
    if (a[i + 1] < -5) a[i + 1] += 30;
  }
  s.geometry.attributes.position.needsUpdate = true;
  s.position.set(cp.x, cp.y - 8, cp.z);
}
// abeti: palchi conici scuri con la neve sopra
function ardTreeCrown() {
  const mb = new MB(); mb.mat = 'vc';
  for (let k = 0; k < 4; k++) {
    const y = -1.25 + k * .4, r = .4 - k * .075, h = .62 - k * .06;
    const cg = new THREE.ConeGeometry(r, h, 9); mb.add(cg, pick([0x1d3322, 0x22392a, 0x1a2e1f]), 0, y + h / 2, 0);
    const sg = new THREE.ConeGeometry(r * .82, h * .45, 9); mb.add(sg, 0xe9eef2, 0, y + h * .78, 0);
  }
  return mb.build();
}
function ardTreeSpot(x, z) {
  if (Math.abs(x) > 600 || z < -900 || z > 300) return false;
  if (Math.abs(x - ardRoadX(z)) < 7) return false;
  if (Math.hypot(x - ARD.village.x, z - ARD.village.z) < 80) return false;
  const lz = ardLineZ(x); if (z > lz - 8 && z < lz + 6) return false;
  return true;
}
function ardTreeList(add) {
  // bosco fitto alle spalle della linea americana
  for (let i = 0; i < 1500; i++) add(rnd(-400, 400), rnd(6, 220), rnd(.8, 1.25));
  // bosco tedesco sul lato opposto del campo e ai fianchi di Foy
  for (let i = 0; i < 900; i++) { const x = rnd(-400, 400), z = rnd(-280, -200); if (Math.abs(x) > 35) add(x, z, rnd(.85, 1.3)); }
  for (let i = 0; i < 700; i++) add(rnd(-400, 400), rnd(-700, -380), rnd(.85, 1.3));
  for (let i = 0; i < 500; i++) { const sx = R() < .5 ? -1 : 1; add(sx * rnd(130, 400), rnd(-380, -20), rnd(.8, 1.2)); }
  // macchie sparse nel campo
  for (let k = 0; k < 10; k++) { const cx = rnd(-110, 110), cz = rnd(-170, -40); for (let i = 0; i < 9; i++) add(cx + rnd(-7, 7), cz + rnd(-7, 7), rnd(.7, 1.1)); }
}

// ---------- missioni ----------
const ardFoes = () => enemies.filter(e => e.alive);
function ardWave(n, objZ) {
  for (let i = 0; i < n && aliveE() < Q.enemyAlive; i++) {
    const x = rnd(-140, 140), z = rnd(-250, -215);
    addEnemy(i === 0 && R() < .5 ? 'mg' : randEnemyKind(), x, z, { state: 'assault', group: 'counter', objective: new V3(x * .8 + rnd(-10, 10), 0, objZ + rnd(-6, 6)) });
  }
}
const ARD_STAGES = [
  {
    title: 'Bois Jacques — 07:10',
    start() {
      MISSION.allyZone = { defend: true, cx: 0, cz: 0, zMin: -8, zMax: 14, xMin: -125, xMax: 125, wait: [6, 12], kinds: ['trench', 'tree', 'sand'] };
      MISSION.objText = 'Tieni la linea: respingi la fanteria tedesca dal bosco';
      say(NE.winters, 'Tenete le buche. Arriveranno dal bosco di fronte: nessuno arretra.');
      after(5, () => say(NE.lipton, 'Munizioni contate, ragazzi. Mirate prima di sparare.'));
      ARD.waveT = 6; ARD.waves = 0; AU.battle = 1.2;
    },
    update(dt) {
      const T = 210;
      ARD.waveT -= dt;
      if (ARD.waveT <= 0 && MISSION.stageT < T) { ARD.waveT = rnd(22, 30); ARD.waves++; ardWave(6 + ARD.waves * 2, ardLineZ(0) - 2); if (ARD.waves > 1) say(NE.guarnere, pick(['Eccoli di nuovo, dal bosco!', 'Krauts a ore dodici!', 'Un\'altra ondata, tenete giù la testa!'])); }
      MISSION.objText = MISSION.stageT < T ? `Tieni la linea — ${Math.ceil(T - MISSION.stageT)} s` : `Elimina gli ultimi attaccanti — ${ardFoes().filter(e => e.pos.z > -200).length} rimasti`;
      if (MISSION.stageT > T && ardFoes().filter(e => e.pos.z > -200).length <= 3) setStage(1);
    },
  },
  {
    title: 'Panzer sulla strada di Foy',
    start() {
      MISSION.objText = 'Distruggi i Panzer con il bazooka (casse alla linea) o chiama il supporto aereo';
      say(NE.radio, 'Easy, qui Dog: due Panzer sulla strada da Foy, con fanteria di scorta!');
      after(4, () => say(NE.winters, 'Bazooka in prima linea! Mirate ai cingoli e ai fianchi.'));
      for (let i = 0; i < 2; i++) { const t = new Panzer(ardRoadX(-330 - i * 18) + (i ? 6 : -6), -330 - i * 18, PI); t.goal = new V3(ardRoadX(-30) + (i ? 18 : -18), 0, -30); t.lane = i ? 6 : -6; ARD.tanks = (ARD.tanks || []).concat(t); }
      ardWave(10, ardLineZ(0) - 4);
      AIR.cd = Math.min(AIR.cd, 20);
    },
    update(dt) {
      const left = (ARD.tanks || []).filter(t => t.alive);
      for (const t of left) if (!t.player && t.pos.z > -40) t.goal = new V3(t.pos.x, 0, -40);
      MISSION.markers = left.map((t, i) => ({ pos: t.pos.clone().add(new V3(0, 3.5, 0)), label: 'Panzer ' + (i + 1) }));
      MISSION.objText = `Distruggi i Panzer — ${left.length} rimasti`;
      ARD.waveT -= dt; if (ARD.waveT <= 0) { ARD.waveT = 35; ardWave(6, ardLineZ(0) - 3); }
      if (!left.length) { say(NE.lipton, 'Tutti e due in fiamme! Bel lavoro!'); setStage(2); }
    },
  },
  {
    title: 'Contrattacco su Foy',
    start() {
      MISSION.objText = 'Attraversa il campo e riprendi Foy';
      say(NE.winters, 'Ora tocca a noi. Easy Company, avanti fino a Foy!');
      for (const a of allies) if (a.alive) { a.stationary = false; a.forceProne = false; a.state = 'idle'; a.wait = rnd(0, 3); }
      MISSION.allyZone = { zMin: -120, zMax: 14, xMin: -150, xMax: 150, step: 14, wait: [2.5, 5] };
      // guarnigione del villaggio e postazioni
      const vc = covers.filter(k => Math.hypot(k.x - ARD.village.x, k.z - ARD.village.z) < 75).sort(() => R() - .5).slice(0, Math.round(30 * Q.enemyAlive / 120));
      for (const c of vc) addEnemy(R() < .15 ? 'mg' : randEnemyKind(), c.x, c.z, { state: 'post', stationary: true, group: 'city' });
      addEnemy('sniper', ARD.village.x + ardRoadX(-352) - 4, -352, { y: H(ardRoadX(-352), -352) + 6, state: 'post', stationary: true, group: 'city' });
      for (let i = 0; i < 2; i++) MISSION.tanks.push(new Sherman(ardRoadX(40) + i * 5, 40 + i * 14, ardRoadX(-272) + (i ? 6 : -6)));
      ARD.push = 0;
    },
    update(dt) {
      // la linea avanza a sbalzi verso il villaggio
      ARD.push += dt;
      const zMin = Math.max(-345, -120 - Math.floor(ARD.push / 35) * 45);
      if (MISSION.allyZone.zMin !== zMin) MISSION.allyZone = { zMin, zMax: zMin + 130, xMin: -150, xMax: 150, step: 14, wait: [2.5, 5] };
      const inV = ardFoes().filter(e => Math.hypot(e.pos.x - ARD.village.x, e.pos.z - ARD.village.z) < 75).length;
      MISSION.markers = [{ pos: new V3(ardRoadX(-300), ARD.vy + 3, -300), label: 'Foy' }];
      MISSION.objText = `Riprendi Foy — ${inV} difensori nel villaggio`;
      once('ardHalf', inV <= 8, () => say(NE.guarnere, 'Stanno cedendo! Casa per casa, avanti!'));
      once('ardWin', MISSION.stageT > 30 && inV <= 2, ardVictory);
      // valvola di sicurezza: dopo 8 minuti i difensori superstiti ripiegano
      if (MISSION.stageT > 480 && (MISSION.ardFleeT = (MISSION.ardFleeT || 0) - dt) <= 0) { MISSION.ardFleeT = 20; const v = ardFoes().filter(e => Math.hypot(e.pos.x - ARD.village.x, e.pos.z - ARD.village.z) < 75); v.slice(0, Math.ceil(v.length / 3)).forEach(e => { e.flee = true; e.stationary = false; e.dest = new V3(e.pos.x, 0, -470); e.state = 'move'; }); }
    },
  },
];
function ardVictory() {
  say(NE.winters, 'Foy è nostra. La linea regge: Bastogne non cadrà.');
  for (const e of enemies) if (e.alive) e.flee = true;
  addScore(1000, 'Foy liberata', '#9fe08a'); banner('FOY LIBERATA', 'Ardenne, dicembre 1944');
  after(10, () => GAME.end(true));
}
function initArdennes() {
  // compagnia nelle buche: la squadra del giocatore al centro
  const names = [NE.lipton, NE.guarnere, NE.toye, 'Doc Roe'], kinds = ['rifle', 'bar', 'rifle', 'medic'];
  const nAll = Math.min(Q.allyAlive, 60);
  let k = 0;
  for (const f of ARD.foxes) for (let s = 0; s < 2 && k < nAll; s++, k++) {
    const central = Math.abs(f.x) < 12 && s === 0 && k < 40;
    const nm = Math.abs(f.x + 9) < 6 ? names.shift() : '';
    const a = addAlly(nm ? kinds[3 - names.length] : randAllyKind(), f.x + (s ? .9 : 0), f.z + .2, { state: 'post', stationary: true, squad: !!nm || central, name: nm || '' });
    a.yaw = 0;
  }
  P.inBoat = false; P.boat = null; P.mode = 'foot';
  const pf = ARD.foxes.reduce((b, f) => Math.abs(f.x) < Math.abs(b.x) ? f : b, ARD.foxes[0]);
  P.pos.set(pf.x + .4, H(pf.x, pf.z), pf.z + .6); P.yaw = 0; P.pitch = 0;
  MISSION.checkpoint = { pos: P.pos.clone(), yaw: 0 };
  const fp = (id, x, z, res) => { const p = spawnPickup(id, new V3(x, 0, z), undefined, res); p.fixed = true; };
  fp('bazooka', pf.x - 3, pf.z + 3, 4); fp('bazooka', -60, ardLineZ(-60) + 3, 4); fp('bazooka', 55, ardLineZ(55) + 3, 4);
  fp('thompson', pf.x + 3, pf.z + 3); fp('bar', -30, ardLineZ(-30) + 3); fp('springfield', 30, ardLineZ(30) + 3);
  addCrate(pf.x - 1.5, pf.z + 4); addCrate(-70, ardLineZ(-70) + 4); addCrate(70, ardLineZ(70) + 4);
  for (let i = 0; i < 14; i++) addCorpse('E', rnd(-150, 150), rnd(-180, -30));
  setStage(0);
}
function updateArdennes(dt) {
  MISSION.stageT += dt; MISSION.nadeCD -= dt; MISSION.eNadeCD -= dt; MISSION.allyNadeCD -= dt;
  ARD_STAGES[MISSION.stage].update(dt);
  updateSubs(dt);
  for (const v of MISSION.vehicles) v.update(dt);
  for (const t of MISSION.tanks) t.update(dt);
  updateSnowfall(dt);
}
function ardDeployPoints() {
  const pts = [{ label: 'Ultimo checkpoint', sub: 'con la squadra', kind: 'checkpoint', pos: MISSION.checkpoint.pos }];
  pts.push({ label: 'Linea delle buche', sub: 'Bois Jacques', kind: 'point', pos: new V3(0, 0, ardLineZ(0) + 3) });
  if (MISSION.stage >= 2) pts.push({ label: 'Campo innevato', sub: 'a metà strada da Foy', kind: 'point', pos: new V3(ardRoadX(-150) + 8, 0, -150) });
  pts.push({ label: 'P-47 Thunderbolt', sub: 'supporto aereo', kind: 'plane', pos: new V3(-30, 0, 1100) });
  return pts;
}
const ARD_SHOTS = [
  { d: 6, cap: 'Ardenne, Belgio — 26 dicembre 1944', from: [-120, 45, 150], to: [-40, 38, 80], look: [0, 10, -150], look2: [0, 8, -250] },
  { d: 5.5, cap: 'Bois Jacques — la linea della Easy Company', from: [40, 6, 30], to: [-10, 3.5, 12], look: [-30, 2, 0], look2: [0, 2, -40] },
  { d: 6, cap: 'Foy — in mano tedesca', from: [30, 14, -150], to: [10, 10, -210], look: [0, 6, -300], look2: [0, 5, -310] },
];
