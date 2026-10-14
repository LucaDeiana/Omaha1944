"use strict";
// ============================================================
//  Modalità aerea "Cieli di Normandia — 7 giugno 1944".
//  Solo P-47: mappa dedicata di bocage visto dall'alto, con costa,
//  fiume e ponte, strada della colonna e villaggio. Missioni:
//  intercettare i caccia, distruggere la colonna sotto la Flak,
//  bombardare il ponte. Abbattuto, si riparte con un nuovo aereo.
// ============================================================
const AIRM = { bridge: null, convoy: [], hunters: [], kills: 0, aa: [] };
const airRiverX = z => -320 + 110 * Math.sin(z * .0028) + 40 * Math.sin(z * .009);
const airRoadX = z => 260 + 45 * Math.sin(z * .0042);
const AIR_BRIDGE_Z = -620;

// ---------- terreno ----------
function airBase(x, z) {
  let y = 28 + (fbm(x * .0016 + 7, z * .0016, 4) - .5) * 95 + (fbm(x * .009, z * .009, 2) - .5) * 7;
  if (z > 120) y = lerp(y, -7, smooth((z - 120) / 260)); // la costa scende verso il mare
  return y;
}
function airH(x, z) {
  let y = airBase(x, z);
  // valle del fiume e alveo
  const d = Math.abs(x - airRiverX(z));
  if (d < 160) y = lerp(y, 4 + d * .02, smooth((160 - d) / 120));
  if (d < 22) y = lerp(y, -1.6, smooth((22 - d) / 9));
  // strada della colonna, appiattita
  const rd = Math.abs(x - airRoadX(z));
  if (rd < 7 && z < 120) y = lerp(y, airBase(airRoadX(z), z) * .5 + y * .5, smooth((7 - rd) / 3));
  return y;
}
// campi a toppe di colori diversi, sabbia sulla costa, terra sulla strada
function airSplat(x, z, n2) {
  let sa = 0, gr = 1, di = 0, tr = 1, tg = 1, tb = 1;
  const cx = Math.floor((x + 30 * Math.sin(z * .013)) / 85), cz = Math.floor((z + 25 * Math.sin(x * .011)) / 65), h = hash2(cx, cz);
  if (h < .22) { di = 1.4; gr = .2; tr = 1.05; tg = .95; tb = .85; }          // arato
  else if (h < .36) { tr = 1.25; tg = 1.12; tb = .7; }                         // grano
  else if (h < .5) { tr = .85; tg = 1.05; tb = .85; }                          // pascolo scuro
  if (z > 160) { const q = smooth((z - 160) / 80); sa += q * 2; gr *= 1 - q; }
  const rd = Math.abs(x - airRoadX(z)); if (rd < 3.5 && z < 120) di += 2;
  const d = Math.abs(x - airRiverX(z)); if (d < 26) { di += (1 - d / 26) * 1.2; gr *= .6; }
  const tot = sa + gr + di || 1, k = .92 + .16 * n2;
  return { sp: [sa / tot, 0, gr / tot, di / tot], cl: [tr * k, tg * k, tb * k] };
}
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------- costruzione ----------
function buildAirMap() {
  WORLD.mortarPits = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  buildHF(); buildHC();
  buildTerrain(); buildWater();
  // acqua del fiume: nastro lungo l'alveo
  const rp = [], ri = [];
  for (let z = -1460, k = 0; z <= 200; z += 6, k++) { const x = airRiverX(z); rp.push(x - 17, WATER_Y - .2, z, x + 17, WATER_Y - .2, z); if (k) { const o = (k - 1) * 2; ri.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  const river = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: col(0x40555a), roughness: .12, metalness: .35 })); river.receiveShadow = true; scene.add(river);
  const mb = new MB();
  // ponte in pietra a tre arcate sul fiume
  const bx = airRiverX(AIR_BRIDGE_Z), by = 7.5;
  mb.mat = 'stone';
  mb.add(U.box, 0xa49d8d, bx, by, AIR_BRIDGE_Z, 0, 0, 0, 70, 1.4, 9);
  for (const sx of [-1, 1]) mb.add(U.box, 0x9a9384, bx, by + 1.1, AIR_BRIDGE_Z + sx * 4.3, 0, 0, 0, 70, .8, .5);
  for (const px of [-17, 0, 17]) mb.add(U.box, 0x8e8778, bx + px, by - 6, AIR_BRIDGE_Z, 0, 0, 0, 4, 12, 9);
  for (const sx of [-1, 1]) mb.add(U.box, 0x9a9384, bx + sx * 38, by - 3, AIR_BRIDGE_Z, 0, 0, sx * .25, 12, 6, 9);
  const bridge = groupMesh(mb.buildGroups()); scene.add(bridge);
  AIRM.bridge = { x: bx, z: AIR_BRIDGE_Z, y: by, hp: 3, mesh: bridge, down: false };
  // villaggio lungo la strada
  const vm = new MB();
  for (let i = 0; i < 16; i++) { const z = -380 + i * 13 + rnd(-3, 3), x = airRoadX(z) + (i % 2 ? 14 : -14) + rnd(-3, 3); addHouse(vm, x, z, rnd(8, 11), rnd(8, 10), rnd(5, 7), R() < .2); }
  vm.mat = 'stone'; const cz = -330, cxx = airRoadX(cz) + 30; vm.add(U.box, 0xb8af9c, cxx, H(cxx, cz) + 7, cz, 0, 0, 0, 9, 14, 20); vm.add(U.box, 0xa49b88, cxx, H(cxx, cz) + 18, cz - 8, 0, 0, 0, 5, 22, 5);
  addTiled(vm, 120);
  // postazioni contraeree: attorno al ponte, lungo la strada e al villaggio
  const sites = [[bx - 60, AIR_BRIDGE_Z - 40], [bx + 60, AIR_BRIDGE_Z + 35], [bx - 50, AIR_BRIDGE_Z + 60], [bx + 55, AIR_BRIDGE_Z - 70], [airRoadX(-900) + 40, -900], [airRoadX(-700) - 40, -700], [airRoadX(-480) + 45, -480], [airRoadX(-250) - 40, -250], [airRoadX(-100) + 45, -100]];
  WORLD.aaSites = sites.map(([x, z]) => {
    const m = new MB(), y = H(x, z); m.mat = 'sack';
    for (let a = 0; a < TAU; a += TAU / 10) m.add(U.box, 0x8a7d5e, Math.cos(a) * 2.2, .35, Math.sin(a) * 2.2, 0, -a, 0, .6, .7, 1.2);
    m.mat = 'paint'; m.add(U.cyl12, 0x4a4e3c, 0, .9, 0, 0, 0, 0, .5, .6, .5); m.add(U.cyl12, 0x2a2a26, 0, 1.5, -.6, -.9, 0, 0, .05, 1.6, .05);
    const g = groupMesh(m.buildGroups()); g.position.set(x, y, z); scene.add(g);
    return { x, z, mesh: g };
  });
  buildTrees();
}
// siepi del bocage lungo i bordi dei campi e boschetti
function airTreeSpot(x, z) {
  if (Math.abs(x) > 1500 || z < -1450 || z > 150) return false;
  if (Math.abs(x - airRiverX(z)) < 26 || (Math.abs(x - airRoadX(z)) < 8 && z < 120)) return false;
  if (Math.abs(z - AIR_BRIDGE_Z) < 30 && Math.abs(x - airRiverX(z)) < 60) return false;
  return true;
}
function airTreeList(add) {
  for (let i = 0; i < 2600; i++) {
    const x = rnd(-1300, 1300), z = rnd(-1400, 100), cx = Math.floor((x + 30 * Math.sin(z * .013)) / 85), cz = Math.floor((z + 25 * Math.sin(x * .011)) / 65);
    // punto spostato sul bordo del campo più vicino: le siepi disegnano la scacchiera
    if (R() < .5) add(cx * 85 - 30 * Math.sin(z * .013) + rnd(-1, 1), z, rnd(.8, 1.2)); else add(x, cz * 65 - 25 * Math.sin(x * .011) + rnd(-1, 1), rnd(.8, 1.2));
  }
  for (let k = 0; k < 18; k++) { const cx = rnd(-1200, 1200), cz = rnd(-1350, -100), r = rnd(30, 70); for (let i = 0; i < r * 1.2; i++) { const a = R() * TAU, d = Math.sqrt(R()) * r; add(cx + Math.cos(a) * d, cz + Math.sin(a) * d, rnd(.9, 1.3)); } }
}

// ---------- bersagli ----------
class AirTruck {
  constructor(z, k) {
    if (!TRUCK_G) { const t = new Truck(0, -2000, 1); t.alive = false; scene.remove(t.g); MISSION.vehicles.splice(MISSION.vehicles.indexOf(t), 1); }
    this.g = groupMesh(TRUCK_G); this.pos = this.g.position; this.z = z; this.k = k; this.hp = 160; this.alive = true; this.truck = true;
    this.box = { min: new V3(), max: new V3() }; scene.add(this.g); MISSION.vehicles.push(this);
  }
  update(dt) {
    if (!this.alive) return;
    this.z += 7 * dt; if (this.z > 60) this.z = -1250;
    const x = airRoadX(this.z) + 1.8; this.pos.set(x, Hf(x, this.z), this.z);
    this.g.rotation.y = Math.atan2(airRoadX(this.z + 3) - airRoadX(this.z), 3) + PI;
    this.box.min.set(x - 1.3, this.pos.y, this.z - 3.6); this.box.max.set(x + 1.3, this.pos.y + 2.5, this.z + 3.6);
  }
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a;
    if (this.hp > 0) return;
    this.alive = false; burnMeshes(this.g); const p = this.pos.clone(); p.y += 1.5;
    fxExplosion(p, 2, false); sfxBoom(p, 2); const e = addEmitter(p, 'fire', 1); e.life = 90;
    if (byPlayer) { STATS.kills += 2; feed('Mezzo della colonna distrutto'); }
  }
}
function airBombHit(p) {
  const b = AIRM.bridge; if (!b || b.down) return;
  if (Math.abs(p.x - b.x) < 40 && Math.abs(p.z - b.z) < 14 && p.y < b.y + 12) {
    b.hp--; feed(b.hp > 0 ? `Colpo sul ponte! Ancora ${b.hp}` : 'Il ponte crolla!');
    if (b.hp <= 0) { b.down = true; burnMeshes(b.mesh); b.mesh.position.y -= 5; b.mesh.rotation.z = .06; for (let i = 0; i < 4; i++) addEmitter(new V3(b.x + rnd(-25, 25), b.y, b.z), 'smoke', 2).life = 120; STATS.kills += 8; }
  }
}
function spawnHunter() {
  const me = PL.me, base = me ? me.pos : new V3(0, 400, 0), a = R() * TAU;
  const p = new Plane('fw190', 'E', new V3(base.x + Math.cos(a) * 1300, clamp(base.y + rnd(-80, 160), 250, 900), base.z + Math.sin(a) * 1300), new V3(-Math.cos(a) * 160, 0, -Math.sin(a) * 160), []);
  p.hunter = true; p.hp = 260; AIRM.hunters.push(p); return p;
}
// conta gli abbattimenti dei caccia nemici
function airCountKills() { for (const p of AIRM.hunters) if (p.crash && !p.counted) { p.counted = true; AIRM.kills++; } AIRM.hunters = AIRM.hunters.filter(p => p.alive && !p.counted); }

// ---------- missioni ----------
const AIR_STAGES = [
  {
    title: 'Pattuglia — 07:40',
    start() { AIRM.kills = 0; AIRM.needKills = 6; say(NE.radio || 'Radio', 'Thunderbolt Leader, banditi sulla costa. Ripulite il cielo!'); },
    update(dt) {
      airCountKills();
      if (PL.me && AIRM.hunters.length < 2 && AIRM.kills + AIRM.hunters.length < AIRM.needKills) spawnHunter();
      MISSION.markers = AIRM.hunters.filter(p => !p.crash).map(p => ({ pos: p.pos.clone(), label: 'Fw 190' }));
      MISSION.objText = `Abbatti i caccia tedeschi — ${AIRM.kills}/${AIRM.needKills}`;
      if (AIRM.kills >= AIRM.needKills) { say('Radio', 'Cielo pulito. Ora la colonna sulla strada per Carentan!'); setStage(1); }
    },
  },
  {
    title: 'Colonna sulla strada di Carentan',
    start() {
      for (let k = 0; k < 10; k++) AIRM.convoy.push(new AirTruck(-900 - k * 22, k));
      for (const a of WORLD.aaSites) for (let i = 0; i < 2; i++) addEnemy('rifle', a.x + (i ? 1 : -1), a.z + .5, { state: 'post', stationary: true, role: 'aa', group: 'aa' });
      AIRM.harassT = 40;
    },
    update(dt) {
      const left = AIRM.convoy.filter(t => t.alive);
      MISSION.markers = left.slice(0, 1).map(t => ({ pos: t.pos.clone().add(new V3(0, 6, 0)), label: 'Colonna' }));
      MISSION.objText = `Distruggi la colonna — ${AIRM.convoy.length - left.length}/8 mezzi (attento alla Flak)`;
      AIRM.harassT -= dt; if (AIRM.harassT <= 0 && PL.me) { AIRM.harassT = rnd(60, 90); spawnHunter(); }
      airCountKills();
      if (AIRM.convoy.length - left.length >= 8) { say('Radio', 'Colonna fermata! Ultimo obiettivo: il ponte sul fiume. Usate le bombe.'); setStage(2); }
    },
  },
  {
    title: 'Il ponte sulla Douve',
    start() { PL.bombs = 2; AIRM.harassT = 30; },
    update(dt) {
      const b = AIRM.bridge;
      MISSION.markers = b.down ? [] : [{ pos: new V3(b.x, b.y + 8, b.z), label: 'Ponte' }];
      MISSION.objText = b.down ? 'Ponte distrutto' : `Bombarda il ponte — ${b.hp} colpi necessari (Spazio per sganciare)`;
      AIRM.harassT -= dt; if (AIRM.harassT <= 0 && PL.me) { AIRM.harassT = rnd(50, 80); spawnHunter(); }
      airCountKills();
      once('airWin', b.down, () => { say('Radio', 'Ponte abbattuto! Le colonne tedesche sono tagliate fuori. Rientrate alla base.'); addScore(1000, 'Missione compiuta', '#9fe08a'); banner('PONTE DISTRUTTO', 'Cieli di Normandia — missione compiuta'); after(10, () => GAME.end(true)); });
    },
  },
];
function initAirMode() {
  P.inBoat = false; P.boat = null; P.mode = 'foot'; P.pos.set(0, 500, 1100);
  MISSION.checkpoint = { pos: new V3(-30, 0, 1100), yaw: 0 };
  setStage(0);
}
function updateAirMode(dt) {
  MISSION.stageT += dt;
  AIR_STAGES[MISSION.stage].update(dt);
  updateSubs(dt);
  for (const v of MISSION.vehicles) v.update(dt);
  // a terra il giocatore non ha nulla da fare: torna subito in volo
  if (P.mode === 'foot' && !P.dead && !P.spawnMenu && GAME.started && !CUT.active) enterPlane();
}
const airDeployPoints = () => [{ label: 'P-47 Thunderbolt', sub: 'decollo dalla costa', kind: 'plane', pos: new V3(-30, 0, 1100) }];
