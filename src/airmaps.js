"use strict";
// ============================================================
//  Mappe aeree aggiuntive: "La Manica" (aeroporto della RAF sulle
//  scogliere del Kent, bombardieri da intercettare, convoglio navale)
//  e "Il Reno" (pista avanzata in lamiera, ponte d'acciaio, Flak,
//  caccia a reazione). Il decollo e l'atterraggio usano la stessa
//  meccanica della portaerei: CARRIER descrive la base di partenza.
// ============================================================
let AIRMAP = 'norm';
const AIRMAP_NAMES = { norm: 'Normandia — portaerei', manica: 'La Manica — aeroporto RAF', reno: 'Il Reno — pista avanzata' };
const chanCoastZ = x => -300 + 40 * Math.sin(x * .002) + 18 * Math.sin(x * .007);
const renoRiverZ = x => -700 + 80 * Math.sin(x * .0012) + 25 * Math.sin(x * .004);

// ---------- terreni ----------
const AIRMAPS = {
  manica: {
    base(x, z) {
      const cz = chanCoastZ(x), land = 48 + (fbm(x * .002 + 9, z * .002, 4) - .5) * 40 + (fbm(x * .01, z * .01, 2) - .5) * 5;
      if (z < cz - 30) return land;
      if (z > cz) return lerp(-2, -12, smooth((z - cz) / 400));
      return lerp(land, -2, smooth((z - (cz - 30)) / 30));  // scogliera
    },
    H(x, z) { return airfieldFlat(x, z, this.base(x, z)); },
    splat(x, z, n2) {
      const cz = chanCoastZ(x); let sa = 0, gr = 1, di = 0, tr = 1, tg = 1, tb = 1;
      const h = hash2(Math.floor((x + 30 * Math.sin(z * .011)) / 95), Math.floor(z / 70));
      if (h < .2) { di = 1.2; gr = .3; } else if (h < .35) { tr = 1.2; tg = 1.12; tb = .72; }
      if (z > cz - 34 && z < cz + 4) { sa = 3; gr = 0; tr = 1.5; tg = 1.5; tb = 1.45; } // gesso bianco delle scogliere
      if (z > cz + 4) { sa = 2; gr = 0; }
      if (onRunway(x, z, 6)) { di = 3; gr = 0; tr = tg = tb = .62; }
      const tot = sa + gr + di || 1, k = .92 + .16 * n2;
      return { sp: [sa / tot, 0, gr / tot, di / tot], cl: [tr * k, tg * k, tb * k] };
    },
    treeSpot(x, z) { return z < chanCoastZ(x) - 60 && !onRunway(x, z, 40) && Math.abs(x) < 1400 && z > -1450; },
    trees(add) { for (let i = 0; i < 2200; i++) { const x = rnd(-1300, 1300), z = rnd(-1400, -320); const cx = Math.floor(x / 95); if (R() < .5) add(cx * 95 + rnd(-1, 1), z, rnd(.8, 1.2)); else add(x, Math.floor(z / 70) * 70 + rnd(-1, 1), rnd(.8, 1.2)); } },
    field: { x: 0, z: -820, len: 700, w: 46, name: 'RAF Hawkinge', psp: false },
  },
  reno: {
    base(x, z) {
      let y = 60 + (fbm(x * .0022 + 3, z * .0022, 4) - .5) * 110 + (fbm(x * .012, z * .012, 2) - .5) * 8;
      const d = Math.abs(z - renoRiverZ(x));
      if (d < 260) y = lerp(y, 10 + d * .05, smooth((260 - d) / 200));
      if (d < 80) y = lerp(y, -2, smooth((80 - d) / 20));
      return y;
    },
    H(x, z) { return airfieldFlat(x, z, this.base(x, z)); },
    splat(x, z, n2) {
      let gr = 1, di = 0, sa = 0, tr = .95, tg = 1, tb = .9;
      const d = Math.abs(z - renoRiverZ(x)); if (d < 90) { di += (1 - d / 90) * 1.5; gr *= .4; }
      const h = hash2(Math.floor(x / 110), Math.floor(z / 80)); if (h < .25) { di = 1; gr = .5; tr = 1.05; tg = .95; tb = .8; }
      if (onRunway(x, z, 6)) { di = 3; gr = 0; tr = .45; tg = .47; tb = .45; }
      const tot = sa + gr + di || 1, k = .9 + .16 * n2;
      return { sp: [sa / tot, 0, gr / tot, di / tot], cl: [tr * k, tg * k, tb * k] };
    },
    treeSpot(x, z) { return Math.abs(z - renoRiverZ(x)) > 95 && !onRunway(x, z, 40) && Math.abs(x) < 1450 && z > -1450 && z < 1400; },
    trees(add) { for (let k = 0; k < 40; k++) { const cx = rnd(-1300, 1300), cz = rnd(-1400, 1300), r = rnd(50, 140); for (let i = 0; i < r * 1.1; i++) { const a = R() * TAU, dd = Math.sqrt(R()) * r; add(cx + Math.cos(a) * dd, cz + Math.sin(a) * dd, rnd(.9, 1.3)); } } },
    field: { x: 200, z: 620, len: 650, w: 40, name: 'Pista avanzata Y-29', psp: true },
  },
};
// la pista è piana alla quota della base
function onRunway(x, z, m = 0) { const f = AIRMAPS[AIRMAP] && AIRMAPS[AIRMAP].field; return !!f && Math.abs(x - f.x) < f.w / 2 + m && Math.abs(z - f.z) < f.len / 2 + m; }
function airfieldFlat(x, z, y) {
  const f = AIRMAPS[AIRMAP].field; if (f.y === undefined) return y;
  const dx = Math.max(0, Math.abs(x - f.x) - f.w / 2), dz = Math.max(0, Math.abs(z - f.z) - f.len / 2), d = Math.max(dx, dz);
  return d <= 0 ? f.y - .25 : d < 60 ? lerp(f.y - .25, y, smooth(d / 60)) : y; // il terreno sotto la pista resta un po' più basso: niente sfarfallio
}

// ---------- costruzione ----------
function buildAirMap2() {
  const M = AIRMAPS[AIRMAP], f = M.field;
  WORLD.mortarPits = []; WORLD.tobruks = []; WORLD.bombard = 'off'; WORLD.aaSites = [];
  f.y = undefined; let hs = 0; for (let k = 0; k < 9; k++) hs += M.base(f.x + rnd(-f.w / 2, f.w / 2), f.z + rnd(-f.len / 2, f.len / 2)); f.y = Math.max(8, hs / 9);
  Object.assign(CARRIER, { type: 'field', x: f.x, z: f.z, len: f.len, w: f.w, deckY: f.y });
  buildHF(); buildHC(); buildTerrain(); buildWater();
  if (AIRMAP === 'reno') scene.traverse(o => { if (o.material === waterMat) o.visible = false; });
  buildAirfield(f);
  if (AIRMAP === 'manica') buildChannel(); else buildRhine();
  buildTrees(); buildClouds(); buildAirFar();
}
// aeroporto: pista (erba e cemento oppure lamiera forata), hangar, torre, manica a vento, aerei parcheggiati
function buildAirfield(f) {
  const mb = new MB(), Y = f.y;
  mb.mat = 'vc';
  mb.add(U.box, f.psp ? 0x4a4e48 : 0x77756f, f.x, Y - .2, f.z, 0, 0, 0, f.w * .7, .45, f.len);
  for (let k = 0; k < 14; k++) mb.add(U.box, 0x5a5854, f.x + rnd(-3, 3), Y + .06, f.z - f.len / 2 + 40 + k * 45, 0, rnd(-.03, .03), 0, rnd(.8, 1.6), .02, rnd(20, 45)); // segni delle gomme
  mb.mat = 'vc';
  for (let k = 0; k < 18; k++) mb.add(U.box, 0xe8e4d8, f.x, Y + .09, f.z - f.len / 2 + 20 + k * (f.len - 40) / 17, 0, 0, 0, .6, .04, 9);
  for (const e of [-1, 1]) for (let k = 0; k < 6; k++) mb.add(U.box, 0xe8e4d8, f.x - f.w * .3 + k * f.w * .12, Y + .09, f.z + e * (f.len / 2 - 12), 0, 0, 0, 1.4, .02, 14);
  if (f.psp) for (let k = 0; k < 60; k++) mb.add(U.box, 0x3c403a, f.x, Y + .08, f.z - f.len / 2 + k * f.len / 60, 0, 0, 0, f.w * .7, .02, .25);
  // hangar ad arco, torre di controllo, depositi
  const hx = f.x + f.w / 2 + 40;
  mb.mat = 'paint';
  for (let k = 0; k < 3; k++) { const z = f.z - 150 + k * 60; const hy = Math.max(Hf(hx, z), Y); mb.add(new THREE.CylinderGeometry(14, 14, 40, 18, 1, false, 0, PI), 0x5d6157, hx, hy, z, PI / 2, 0, PI / 2, 1, 1, 1); mb.add(U.box, 0x3a3d36, hx - 13.9, hy + 5, z, 0, 0, 0, .3, 10, 18); addSolid(hx - 14, hy - 1, z - 20, hx + 14, hy + 14, z + 20, 'house'); }
  const tx = f.x - f.w / 2 - 35, tz = f.z + 40, ty = Math.max(Hf(tx, tz), Y);
  mb.mat = 'plaster'; mb.add(U.box, 0xd9d4c4, tx, ty + 5, tz, 0, 0, 0, 12, 10, 10); mb.add(U.box, 0xd9d4c4, tx, ty + 11.5, tz, 0, 0, 0, 7, 3, 7); mb.mat = 'vc'; mb.add(U.box, 0x223040, tx, ty + 11.6, tz, 0, 0, 0, 7.1, 1.4, 7.1);
  mb.add(cylG2(.05, .05, 8, 6), 0x777777, tx + 12, ty + 4, tz); mb.add(new THREE.ConeGeometry(.5, 2.4, 10), 0xd86a2a, tx + 13.2, ty + 7.6, tz, 0, 0, PI / 2);
  addTiled(mb, 160);
  // aerei parcheggiati lungo la pista, col carrello giù
  const parked = AIRMAP === 'manica' ? 'spit' : 'p47';
  for (let k = 0; k < 4; k++) { const pg = makePlaneModel(parked), x = f.x + f.w / 2 + 10, z = f.z + 120 + k * 22; pg.position.set(x, Math.max(Hf(x, z), Y) + 2.2, z); pg.rotation.set(.19, -PI / 2, 0, 'YXZ'); scene.add(pg); buildGear({ g: pg }); }
}
// La Manica: costa, faro, convoglio navale tedesco in mare
function buildChannel() {
  const mb = new MB();
  const lx = 300, lz = chanCoastZ(300) - 40, ly = AIRMAPS.manica.base(lx, lz);
  mb.mat = 'plaster'; mb.add(cylG2(2.2, 2.8, 16, 14), 0xeae6dc, lx, ly + 8, lz); mb.mat = 'vc'; mb.add(cylG2(2.4, 2.4, 2, 14), 0x8a2a24, lx, ly + 17, lz); mb.add(cylG2(1.6, 1.6, 2, 12), 0xffe9a0, lx, ly + 19, lz);
  addTiled(mb, 200);
}
// Il Reno: ponte ad arco d'acciaio con torri, cittadine sulle rive, Flak
function buildRhine() {
  const mb = new MB(), bx = -250, bz = renoRiverZ(bx), by = 14;
  // nastro del fiume
  const rp = [], ri = [];
  for (let x = -2000, k = 0; x <= 2000; x += 15, k++) { const z = renoRiverZ(x); rp.push(x, WATER_Y, z - 70, x, WATER_Y, z + 70); if (k) { const o = (k - 1) * 2; ri.push(o, o + 1, o + 2, o + 2, o + 1, o + 3); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  scene.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: col(0x3f5458), roughness: .15, metalness: .3 })));
  // ponte: impalcato lungo z, archi e torri alle estremità
  mb.mat = 'paint';
  mb.add(U.box, 0x3d4247, bx, by, bz, 0, 0, 0, 10, 1.4, 190);
  for (const sx of [-1, 1]) for (let k = 0; k <= 24; k++) { const t = k / 24, z = bz - 85 + t * 170, h = Math.sin(t * PI) * 22; mb.add(U.box, 0x2e3337, bx + sx * 4.6, by + h + 1, z, 0, 0, 0, .5, 1.2, 7.5); if (k % 2 === 0) mb.add(U.box, 0x2e3337, bx + sx * 4.6, by + h / 2 + .8, z, 0, 0, 0, .3, h + .5, .3); }
  mb.mat = 'stone'; for (const e of [-1, 1]) { const z = bz + e * 98; for (const sx of [-1, 1]) mb.add(U.box, 0x6b6050, bx + sx * 6, by + 8, z, 0, 0, 0, 5, 26, 7); mb.add(U.box, 0x6b6050, bx, by + 20, z, 0, 0, 0, 17, 3, 7); }
  for (const pz of [-45, 0, 45]) mb.add(U.box, 0x6b6050, bx, by - 7, bz + pz, 0, 0, 0, 8, 14, 6);
  const bridge = groupMesh(mb.buildGroups()); scene.add(bridge);
  AIRM.bridge = { x: bx, z: bz, y: by, hp: 4, mesh: bridge, down: false, alongZ: true };
  // cittadine sulle due rive
  const vm = new MB();
  for (const e of [-1, 1]) for (let i = 0; i < 14; i++) { const x = bx + rnd(-120, 120), z = bz + e * rnd(110, 200); addHouse(vm, x, z, rnd(8, 11), rnd(8, 10), rnd(5, 8), R() < .25); }
  addTiled(vm, 160);
  // batterie contraeree attorno al ponte
  const sites = []; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, r = rnd(140, 230); sites.push([bx + Math.cos(a) * r, bz + Math.sin(a) * r]); }
  WORLD.aaSites = sites.map(([x, z]) => { const m = new MB(), y = Hf(x, z); m.mat = 'sack'; for (let a = 0; a < TAU; a += TAU / 10) m.add(U.box, 0x8a7d5e, Math.cos(a) * 2.4, .4, Math.sin(a) * 2.4, 0, -a, 0, .6, .8, 1.3); m.mat = 'paint'; m.add(U.cyl12, 0x4a4e3c, 0, 1, 0, 0, 0, 0, .55, .7, .55); for (const s of [-.15, .15]) m.add(U.cyl12, 0x2a2a26, s, 1.7, -.7, -.9, 0, 0, .05, 1.8, .05); const g = groupMesh(m.buildGroups()); g.position.set(x, y, z); scene.add(g); return { x, z, mesh: g }; });
}

// ---------- bersagli navali ----------
class AirShip {
  constructor(x, z, kind) {
    this.kind = kind; this.alive = true; this.hp = kind === 'flak' ? 700 : 900; this.x = x; this.z = z; this.v = rnd(5, 7); this.fireT = rnd(1, 3); this.truck = true;
    const mb = new MB(), L = kind === 'flak' ? 50 : 70, B = kind === 'flak' ? 8 : 11; mb.mat = 'paint';
    mb.add(U.box, 0x4d5459, 0, 2, 0, 0, 0, 0, L, 4, B); mb.add(U.box, 0x3d4247, 0, 4.2, 0, 0, 0, 0, L * .96, .4, B * .95);
    for (let k = 0; k < 4; k++) mb.add(U.box, 0x3a3e40, -L * .45 - k * 1.2, 2.2, 0, 0, 0, 0, 1.2, 3.6 - k * .6, B * (1 - k * .2));
    mb.add(U.box, 0x5a6064, L * .25, 7, 0, 0, 0, 0, 10, 6, B * .7); mb.add(U.cyl12, 0x2a2a2a, L * .15, 10, 0, 0, 0, 0, 1.2, 5, 1.2);
    if (kind === 'flak') for (let k = 0; k < 4; k++) mb.add(U.cyl12, 0x2a2e30, -L * .3 + k * 10, 5.5, 0, 0, 0, 0, 1.2, 1.2, 1.2);
    else for (let k = 0; k < 3; k++) mb.add(U.box, 0x5a4a38, -L * .3 + k * 12, 5.5, 0, 0, 0, 0, 9, 2.6, B * .7);
    this.g = groupMesh(mb.buildGroups()); scene.add(this.g); this.pos = this.g.position; this.L = L; this.B = B;
    this.box = { min: new V3(), max: new V3() }; MISSION.vehicles.push(this);
  }
  update(dt) {
    if (!this.alive) { this.pos.y = Math.max(this.pos.y - dt * .4, -6); this.g.rotation.z = Math.min(this.g.rotation.z + dt * .02, .3); return; }
    this.x += this.v * dt; if (this.x > 1800) this.x = -1800;
    this.pos.set(this.x, WATER_Y - 1.5 + Math.sin(GAME.time * .7 + this.z) * .15, this.z);
    this.box.min.set(this.x - this.L / 2, 0, this.z - this.B / 2); this.box.max.set(this.x + this.L / 2, 12, this.z + this.B / 2);
    // contraerea di bordo contro il giocatore
    const me = PL.me; if (!me || me.crash) return;
    this.fireT -= dt; const d = me.pos.distanceTo(this.pos);
    if (this.fireT <= 0 && d < 1000) {
      this.fireT = this.kind === 'flak' ? .15 : .5; const o = this.pos.clone().add(new V3(rnd(-10, 10), 8, 0)), aim = me.pos.clone().addScaledVector(me.vel, d / 800).add(new V3(rnd(-20, 20), rnd(-15, 15), rnd(-20, 20)));
      fxTracer(o, aim, 1.4); if (dist2Cam(o) < 900 * 900) sfxShot('flak', o);
      if (R() < (this.kind === 'flak' ? .035 : .015) * (1 - d / 1200)) me.damage(rnd(20, 45), false);
    }
  }
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a;
    if (this.hp > 0) { if (R() < .1) addEmitter(this.pos.clone().add(new V3(rnd(-15, 15), 6, 0)), 'smoke', .8).life = 20; return; }
    this.alive = false; burnMeshes(this.g); const p = this.pos.clone(); p.y += 4; fxExplosion(p, 4, true); sfxBoom(p, 3, true); const e = addEmitter(p, 'fire', 1.6); e.life = 120;
    if (byPlayer) { STATS.kills += 4; feed(this.kind === 'flak' ? 'Nave contraerea affondata!' : 'Mercantile affondato!'); }
  }
}

// ---------- missioni ----------
const AIR_STAGES2 = {
  manica: [
    {
      title: 'Bombardieri sulla costa — 11:20',
      start() {
        AIRM.bombers = []; AIRM.kills = 0;
        say('Radio', 'Qui Hawkinge: Ju 88 in arrivo dal mare con la scorta. Fermateli prima della costa!');
        for (let i = 0; i < 6; i++) { const o = new V3((i % 3) * 40 - 40, (i % 2) * 20, Math.floor(i / 3) * 60), f = CARRIER; const path = [{ p: new V3(f.x + o.x, 900, chanCoastZ(f.x) + 200), v: 110 }, { p: new V3(f.x + o.x, 850, f.z + o.z), v: 115, bomb: new V3(f.x + rnd(-30, 30), 0, f.z + rnd(-200, 200)), r: 140 }, { p: new V3(f.x + 1500, 1000, 2600), v: 120 }]; const b = new Plane('ju88', 'E', new V3(f.x + 900 + o.x, 950, 2600 + o.z), new V3(-60, 0, -95), path); b.hp = 420; AIRM.bombers.push(b); }
        for (let i = 0; i < 3; i++) { const h = spawnHunter(); h.huntTarget = null; }
      },
      update(dt) {
        const live = AIRM.bombers.filter(b => b.alive && !b.crash), down = AIRM.bombers.length - live.length;
        airCountKills();
        MISSION.markers = live.map(b => ({ pos: b.pos.clone(), label: 'Ju 88' }));
        MISSION.objText = `Abbatti i bombardieri — ${down}/4`;
        if (down >= 4 || (!live.length && MISSION.stageT > 10)) { say('Radio', 'Ottimo lavoro! Ora il convoglio tedesco nella Manica: navi da carico e una nave contraerea.'); setStage(1); }
      },
    },
    {
      title: 'Il convoglio nella Manica',
      start() { AIRM.ships = []; for (let i = 0; i < 6; i++) AIRM.ships.push(new AirShip(-900 + i * 140, 900 + (i % 2) * 120, i === 2 ? 'flak' : 'cargo')); AIRM.harassT = 40; PL.bombs = Math.max(PL.bombs, (PL.spec || {}).bombs || 0); },
      update(dt) {
        for (const s of AIRM.ships) s.update(dt);
        const sunk = AIRM.ships.filter(s => !s.alive).length;
        MISSION.markers = AIRM.ships.filter(s => s.alive).map(s => ({ pos: s.pos.clone().add(new V3(0, 14, 0)), label: s.kind === 'flak' ? 'Nave Flak' : 'Mercantile' }));
        MISSION.objText = `Affonda il convoglio — ${sunk}/4 navi (bombe o cannoni pesanti)`;
        AIRM.harassT -= dt; if (AIRM.harassT <= 0 && PL.me) { AIRM.harassT = rnd(55, 80); spawnHunter(); }
        airCountKills();
        if (sunk >= 4) { say('Radio', 'Convoglio distrutto! Rientrate a Hawkinge e atterrate.'); setStage(2); }
      },
    },
    airLandingStage('Rientro a Hawkinge'),
  ],
  reno: [
    {
      title: 'Contraerea sul Reno — 15:40',
      start() { for (const a of WORLD.aaSites) for (let i = 0; i < 2; i++) addEnemy('rifle', a.x + (i ? 1 : -1), a.z + .5, { state: 'post', stationary: true, role: 'aa', group: 'aa' }); say('Radio', 'Thunderbolt, la Flak protegge il ponte sul Reno. Spegnete le batterie!'); },
      update(dt) {
        const left = WORLD.aaSites.filter(a => !a.dead && enemies.some(e => e.alive && e.role === 'aa' && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 5));
        MISSION.markers = left.map(a => ({ pos: new V3(a.x, Hf(a.x, a.z) + 6, a.z), label: 'Flak' }));
        MISSION.objText = `Distruggi le batterie contraeree — ${WORLD.aaSites.length - left.length}/6`;
        if (WORLD.aaSites.length - left.length >= 6) { say('Radio', 'Attenzione: caccia a reazione! Le Schwalbe arrivano da est, velocissime.'); setStage(1); }
      },
    },
    {
      title: 'Schwalbe!',
      start() { AIRM.kills = 0; AIRM.needKills = 3; AIRM.jetN = 0; },
      update(dt) {
        airCountKills();
        if (PL.me && AIRM.hunters.length < 2 && AIRM.kills + AIRM.hunters.length < AIRM.needKills) { const h = spawnHunter('me262'); AIRM.jetN++; }
        MISSION.markers = AIRM.hunters.filter(p => !p.crash).map(p => ({ pos: p.pos.clone(), label: 'Me 262' }));
        MISSION.objText = `Abbatti i caccia a reazione — ${AIRM.kills}/${AIRM.needKills} (sono più veloci: aspettali in virata)`;
        if (AIRM.kills >= AIRM.needKills) { say('Radio', 'Cielo libero. Ora il ponte: serve un colpo pieno.'); setStage(2); }
      },
    },
    {
      title: 'Il ponte sul Reno',
      start() { PL.bombs = Math.max(PL.bombs, (PL.spec || {}).bombs || 0); AIRM.harassT = 40; },
      update(dt) {
        const b = AIRM.bridge;
        MISSION.markers = b.down ? [] : [{ pos: new V3(b.x, b.y + 25, b.z), label: 'Ponte' }];
        MISSION.objText = b.down ? 'Ponte distrutto' : `Distruggi il ponte — ancora ${b.hp} colpi (bombe o cannoni pesanti)`;
        AIRM.harassT -= dt; if (AIRM.harassT <= 0 && PL.me) { AIRM.harassT = rnd(55, 85); spawnHunter(R() < .4 ? 'me262' : 'bf109'); }
        airCountKills();
        if (b.down) { say('Radio', 'Il ponte è in acqua! Rientrate alla pista Y-29 e atterrate.'); setStage(3); }
      },
    },
    airLandingStage('Rientro alla pista Y-29'),
  ],
};
// fase finale comune: atterrare alla base e fermarsi
function airLandingStage(title) {
  return {
    title,
    start() { PL.landed = false; },
    update(dt) {
      const f = CARRIER;
      MISSION.markers = PL.onDeck ? [] : [{ pos: new V3(f.x, f.deckY + 30, f.z + f.len / 2), label: 'Pista' }];
      MISSION.objText = PL.onDeck ? 'Fermati sulla pista (S per frenare)' : 'Atterra: carrello giù (G), motore al minimo, discesa lenta verso la testata della pista';
      airCountKills();
      once('airLand', PL.landed && PL.onDeck && PL.deckV < 3, () => { say('Radio', 'Bentornato a terra. Missione compiuta!'); addScore(1000, 'Missione compiuta', '#9fe08a'); banner('MISSIONE COMPIUTA', AIRMAP_NAMES[AIRMAP]); after(8, () => GAME.end(true)); });
    },
  };
}
function airStageList() { return AIRMAP === 'norm' ? AIR_STAGES : AIR_STAGES2[AIRMAP]; }
function airSpawn2() {
  let t = new V3(0, 0, 0);
  if (AIRMAP === 'manica') { if (MISSION.stage === 0 && AIRM.bombers) { const b = AIRM.bombers.find(p => p.alive && !p.crash); if (b) t = b.pos.clone(); } else if (AIRM.ships) { const s = AIRM.ships.find(v => v.alive); if (s) t = s.pos.clone(); } }
  else { const b = AIRM.bridge; if (b) t = new V3(b.x, 0, b.z); }
  const pos = new V3(t.x + rnd(-300, 300), 0, t.z + 1500); pos.x = clamp(pos.x, -1400, 1400); pos.z = clamp(pos.z, -1400, 1400); pos.y = Math.max(Hf(pos.x, pos.z), 0) + 500;
  const d = new V3(t.x - pos.x, 0, t.z - pos.z).normalize().multiplyScalar(130); d.y = -4;
  return { pos, vel: d };
}
