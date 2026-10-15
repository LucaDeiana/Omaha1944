"use strict";
// ============================================================
//  Modalità aerea "Cieli di Normandia — 7 giugno 1944".
//  Solo P-47: mappa dedicata di bocage visto dall'alto, con costa,
//  fiume e ponte, strada della colonna e villaggio. Missioni:
//  intercettare i caccia, distruggere la colonna sotto la Flak,
//  fermare il treno delle munizioni, scortare i B-26 sullo scalo,
//  bombardare il ponte. Abbattuto, si riparte con un nuovo aereo.
// ============================================================
// portaerei al largo della costa: ponte di volo lungo l'asse z, prua verso terra
const CARRIER = { type: 'carrier', x: -150, z: 1450, len: 250, w: 34, deckY: 18 };
// superficie su cui si può atterrare: ponte o pista, altrimenti terreno asciutto e poco inclinato (sotto ~14°)
function landSurfY(x, z, maxG = .25) {
  const dk = carrierDeckAt(x, z); if (dk > -99) return dk;
  const h = Hf(x, z); if (h < WATER_Y + .4) return -99;
  const gx = (Hf(x + 4, z) - Hf(x - 4, z)) / 8, gz = (Hf(x, z + 4) - Hf(x, z - 4)) / 8;
  return Math.hypot(gx, gz) < maxG ? h : -99;
}
const carrierDeckAt = (x, z) => SCEN === 'air' && Math.abs(x - CARRIER.x) < CARRIER.w / 2 && Math.abs(z - CARRIER.z) < CARRIER.len / 2 ? CARRIER.deckY : -99;
function buildCarrier() {
  const C = CARRIER, mb = new MB(), L = C.len, Y = C.deckY, gray = 0x5d6670, dark = 0x474f57;
  mb.mat = 'paint';
  // scafo: corpo centrale, prua rastremata a gradini, poppa
  mb.add(U.box, gray, C.x, 6, C.z + 10, 0, 0, 0, 28, 16, L - 40);
  for (let k = 0; k < 5; k++) mb.add(U.box, gray, C.x, 6.5 + k * .6, C.z - L / 2 + 26 - k * 6, 0, 0, 0, 26 - k * 5, 15 - k, 8);
  mb.add(U.box, dark, C.x, 1.2, C.z + 10, 0, 0, 0, 28.5, 2.4, L - 38);
  // ponte dell'hangar e fiancate aperte sotto il ponte di volo
  mb.add(U.box, gray, C.x, 15, C.z, 0, 0, 0, 30, 5, L - 20);
  for (let k = 0; k < 12; k++) for (const sx of [-1, 1]) mb.add(U.box, 0x22272c, C.x + sx * 15.05, 15.3, C.z - L / 2 + 25 + k * 18, 0, 0, 0, .1, 3, 10);
  // ponte di volo in legno con strisce
  mb.mat = 'wood';
  mb.add(U.box, 0x5a4e40, C.x, Y - .4, C.z, 0, 0, 0, C.w, .8, L);
  mb.mat = 'vc';
  for (let k = 0; k < 24; k++) mb.add(U.box, 0xe8e4d8, C.x, Y + .02, C.z - L / 2 + 8 + k * 10, 0, 0, 0, .5, .02, 5);
  for (const sx of [-1, 1]) mb.add(U.box, 0xe8e4d8, C.x + sx * (C.w / 2 - .6), Y + .02, C.z, 0, 0, 0, .35, .02, L - 4);
  for (let k = 0; k < 5; k++) mb.add(U.box, 0x1a1a1a, C.x, Y + .05, C.z + L / 2 - 30 - k * 9, 0, 0, 0, C.w - 4, .04, .12); // cavi d'arresto
  mb.add(U.box, 0xd8c23a, C.x, Y + .03, C.z + L / 2 - 36, 0, 0, 0, 2.5, .02, 2.5);
  // isola: plancia, fumaiolo, albero e radar
  mb.mat = 'paint';
  const ix = C.x + C.w / 2 - 3.5, iz = C.z + 10;
  mb.add(U.box, gray, ix, Y + 5, iz, 0, 0, 0, 6, 10, 30); mb.add(U.box, dark, ix, Y + 11, iz - 6, 0, 0, 0, 7, 3, 12);
  mb.add(U.box, 0x2a3036, ix, Y + 11, iz - 11.9, 0, 0, 0, 6.6, 1.2, .1);
  mb.add(U.box, gray, ix + .5, Y + 13, iz + 6, -.12, 0, 0, 5, 7, 8); mb.add(U.box, 0x1c1c1c, ix + .5, Y + 16.6, iz + 6.4, 0, 0, 0, 4.4, .4, 7);
  mb.add(U.cyl12, dark, ix, Y + 19, iz - 3, 0, 0, 0, .35, 14, .35); mb.add(U.box, dark, ix, Y + 24, iz - 3, 0, 0, 0, 5, .3, .3); mb.add(U.box, dark, ix, Y + 21, iz - 3, 0, 0, 0, 3, 2, .2);
  // contraeree lungo i bordi
  for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) { const z = C.z - L / 2 + 30 + k * 26; mb.add(U.cyl12, dark, C.x + sx * (C.w / 2 + 1), Y - 1.2, z, 0, 0, 0, 1.4, .8, 1.4); mb.add(U.cyl12, 0x1c1c1c, C.x + sx * (C.w / 2 + 1), Y - .4, z - 1, PI / 2 - .5, 0, 0, .09, 2.2, .09); }
  const g = groupMesh(mb.buildGroups()); scene.add(g); C.mesh = g;
  // scia della nave e aerei parcheggiati in coda
  for (let k = 0; k < 3; k++) { const pg = makePlaneModel('p47'); pg.position.set(C.x - 10 + k * 7.5, Y + 2.25, C.z + L / 2 - 8); pg.rotation.set(.19, 0, 0); scene.add(pg); buildGear({ g: pg }); }
}
const AIRM = { bridge: null, convoy: [], hunters: [], kills: 0, aa: [] };
const airRiverX = z => -320 + 110 * Math.sin(z * .0028) + 40 * Math.sin(z * .009);
const airRoadX = z => 260 + 45 * Math.sin(z * .0042);
const AIR_BRIDGE_Z = -620;
// ferrovia est-ovest con scalo merci; attraversa il fiume su un ponte a travata
const airRailZ = x => -1050 + 60 * Math.sin(x * .0015);
const airRailY = x => Math.max(6, (airBase(x - 70, airRailZ(x - 70)) + airBase(x, airRailZ(x)) * 2 + airBase(x + 70, airRailZ(x + 70))) / 4);
const AIR_YARD_X = 620;

// ---------- terreno ----------
function airBase(x, z) {
  if (AIRMAP !== 'norm') return AIRMAPS[AIRMAP].base(x, z);
  let y = 28 + (fbm(x * .0016 + 7, z * .0016, 4) - .5) * 95 + (fbm(x * .009, z * .009, 2) - .5) * 7;
  if (z > 120) y = lerp(y, -7, smooth((z - 120) / 260)); // la costa scende verso il mare
  return y;
}
function airH(x, z) {
  if (AIRMAP !== 'norm') return AIRMAPS[AIRMAP].H(x, z);
  let y = airBase(x, z);
  // valle del fiume e alveo
  const d = Math.abs(x - airRiverX(z));
  if (d < 160) y = lerp(y, 4 + d * .02, smooth((160 - d) / 120));
  if (d < 22) y = lerp(y, -1.6, smooth((22 - d) / 9));
  // strada della colonna, appiattita
  const rd = Math.abs(x - airRoadX(z));
  if (rd < 7 && z < 120) y = lerp(y, airBase(airRoadX(z), z) * .5 + y * .5, smooth((7 - rd) / 3));
  // massicciata della ferrovia (larga allo scalo), tranne dove passa sul ponte
  const dz = Math.abs(z - airRailZ(x)), half = Math.abs(x - AIR_YARD_X) < 110 ? 26 : 5;
  if (dz < half + 6 && Math.abs(x - airRiverX(z)) > 34) y = lerp(y, airRailY(x), smooth((half + 6 - dz) / 6));
  return y;
}
// campi a toppe di colori diversi, sabbia sulla costa, terra sulla strada
function airSplat(x, z, n2) {
  if (AIRMAP !== 'norm') return AIRMAPS[AIRMAP].splat(x, z, n2);
  let sa = 0, gr = 1, di = 0, tr = 1, tg = 1, tb = 1;
  const cx = Math.floor((x + 30 * Math.sin(z * .013)) / 85), cz = Math.floor((z + 25 * Math.sin(x * .011)) / 65), h = hash2(cx, cz);
  if (h < .22) { di = 1.4; gr = .2; tr = 1.05; tg = .95; tb = .85; }          // arato
  else if (h < .36) { tr = 1.25; tg = 1.12; tb = .7; }                         // grano
  else if (h < .5) { tr = .85; tg = 1.05; tb = .85; }                          // pascolo scuro
  if (z > 160) { const q = smooth((z - 160) / 80); sa += q * 2; gr *= 1 - q; }
  const rd = Math.abs(x - airRoadX(z)); if (rd < 3.5 && z < 120) di += 2;
  const d = Math.abs(x - airRiverX(z)); if (d < 26) { di += (1 - d / 26) * 1.2; gr *= .6; }
  const rz = Math.abs(z - airRailZ(x)); if (rz < (Math.abs(x - AIR_YARD_X) < 110 ? 24 : 3.2)) { di += 2.5; gr *= .1; tr = tg = tb = .7; }
  const tot = sa + gr + di || 1, k = .92 + .16 * n2;
  return { sp: [sa / tot, 0, gr / tot, di / tot], cl: [tr * k, tg * k, tb * k] };
}
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------- costruzione ----------
function buildAirMap() {
  if (AIRMAP !== 'norm') { buildAirMap2(); return; }
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
  buildRailway();
  buildTrees();
  buildClouds(); buildAirFar(); buildCarrier(); buildCarrier();
}
function buildRailway() {
  const mb = new MB(); mb.mat = 'paint';
  const track = (x0, x1, off) => { for (let x = x0; x < x1; x += 12) { const xa = x, xb = Math.min(x + 12, x1), za = airRailZ(xa) + off, zb = airRailZ(xb) + off, ya = airRailY(xa) + .35, yb = airRailY(xb) + .35; for (const sx of [-.72, .72]) mb.between(new V3(xa, ya, za + sx), new V3(xb, yb, zb + sx), .07, 0x3a3631, U.box); } };
  track(-1500, 1500, 0);
  for (const off of [-9, 9, -17, 17]) track(AIR_YARD_X - 100, AIR_YARD_X + 100, off);
  // ponte a travata sul fiume
  const rx = airRiverX(airRailZ(-340)), bx = airRiverX(airRailZ(rx)), bz = airRailZ(bx), by = airRailY(bx);
  for (const sx of [-2.2, 2.2]) { mb.add(U.box, 0x3b3f42, bx, by + 1.6, bz + sx, 0, 0, 0, 80, 3.2, .3); for (let k = -6; k <= 6; k++) mb.add(U.box, 0x34383a, bx + k * 6, by + 1.6, bz + sx, 0, 0, k % 2 ? .6 : -.6, .25, 3.4, .25); }
  mb.add(U.box, 0x4a4540, bx, by, bz, 0, 0, 0, 80, .6, 5);
  mb.mat = 'stone'; for (const px of [-40, -14, 14, 40]) mb.add(U.box, 0x8e8778, bx + px, by - 5, bz, 0, 0, 0, 4, 10, 6);
  // scalo merci: pensilina, magazzini, carri fermi sui binari secondari
  mb.mat = 'stone';
  mb.add(U.box, 0xb4ab98, AIR_YARD_X, airRailY(AIR_YARD_X) + 4, airRailZ(AIR_YARD_X) - 26, 0, 0, 0, 60, 8, 12);
  mb.add(U.box, 0xa89f8c, AIR_YARD_X - 60, airRailY(AIR_YARD_X) + 3, airRailZ(AIR_YARD_X) + 27, 0, 0, 0, 30, 6, 10);
  mb.mat = 'paint';
  const yardCars = [];
  for (const off of [-9, 9, -17, 17]) for (let k = 0; k < 7; k++) { if (R() < .3) continue; const x = AIR_YARD_X - 80 + k * 24, z = airRailZ(x) + off, y = airRailY(x); mb.add(U.box, pick([0x5a3a28, 0x4a3324, 0x5f5546]), x, y + 1.9, z, 0, 0, 0, 12, 2.6, 2.8); yardCars.push(new V3(x, y, z)); }
  addTiled(mb, 160);
  AIRM.yard = { x: AIR_YARD_X, z: airRailZ(AIR_YARD_X), cars: yardCars, hits: 0 };
}
// nuvole: gruppi di sprite morbidi tra 550 e 900 m
function buildClouds() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 64 + rnd(-30, 30), y = 64 + rnd(-18, 18), r = rnd(18, 40), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const tex = new THREE.CanvasTexture(cv), mats = [new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .9, color: 0xf4f4f2 }), new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .8, color: 0xd8dade })];
  AIRM.clouds = new THREE.Group();
  for (let c = 0; c < 46; c++) {
    const cx = rnd(-3500, 3500), cz = rnd(-3800, 1800), cy = rnd(560, 880);
    for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(mats[i % 3 ? 0 : 1]), sc = rnd(130, 280); sp.scale.set(sc * 1.6, sc, 1); sp.position.set(cx + rnd(-180, 180), cy + rnd(-30, 50), cz + rnd(-120, 120)); AIRM.clouds.add(sp); }
  }
  scene.add(AIRM.clouds);
}
// campagna lontana a bassa risoluzione fino a 6 km e mare aperto
function buildAirFar() {
  // colore medio (lineare) delle texture del terreno: sabbia, ciottoli, erba, terra
  const AV = [TEX.sand, TEX.pebble, TEX.grass, TEX.dirt].map(t => { const im = t.map.image, cv = document.createElement('canvas'); cv.width = cv.height = 4; const g = cv.getContext('2d'); try { g.drawImage(im, 0, 0, 4, 4); const d = g.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 64; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const c = new THREE.Color(r / 4080, gg / 4080, b / 4080).convertSRGBToLinear(); return [c.r, c.g, c.b]; } catch (e) { return [.3, .3, .2]; } });
  const S = 80, xs = [], zs = [];
  for (let x = -6000; x <= 6000; x += S) xs.push(x); for (let z = -6000; z <= 3200; z += S) zs.push(z);
  const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), cl = new Float32Array(nx * nz * 3), idx = [];
  const c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], y = airBase(x, z) - .8;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    const h = hash2(Math.floor(x / 170), Math.floor(z / 130));
    // stessi colori del terreno vicino (texture assente: un po' più scuri), così il bordo della mappa non si vede
    const S4 = airSplat(x, z, fbm(x * .03, z * .03, 3)), w = S4.sp, ws = w[0] + w[1] + w[2] + w[3] || 1, dk = .8 * (.85 + h * .3);
    for (let q = 0; q < 3; q++) cl[k * 3 + q] = S4.cl[q] * dk * (w[0] * AV[0][q] + w[1] * AV[1][q] + w[2] * AV[2][q] + w[3] * AV[3][q]) / ws;
  }
  const inside = (x, z) => x > -1560 && x < 1560 && z > -1460 && z < 380;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (inside(xs[i], zs[j]) && inside(xs[i + 1], zs[j + 1])) continue;
    const a = j * nx + i, b = a + nx; idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
  const far = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); far.frustumCulled = false; scene.add(far);
  // mare calmo unico: l'acqua a onde di Omaha (fondale e schiuma della spiaggia) qui darebbe chiazze e bande
  scene.traverse(o => { if (o.material === waterMat) o.visible = false; });
  const nt = TEX.water.normal.clone(); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(350, 225); nt.needsUpdate = true;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(14000, 9000), new THREE.MeshStandardMaterial({ color: 0x2f474c, roughness: .32, metalness: .15, normalMap: nt, normalScale: new THREE.Vector2(.35, .35) }));
  sea.rotation.x = -PI / 2; sea.position.set(0, WATER_Y, -1200); sea.frustumCulled = false; sea.receiveShadow = true; scene.add(sea); AIRM.sea = sea;
}
// siepi del bocage lungo i bordi dei campi e boschetti
function airTreeSpot(x, z) {
  if (AIRMAP !== 'norm') return AIRMAPS[AIRMAP].treeSpot(x, z);
  if (Math.abs(x) > 1500 || z < -1450 || z > 150) return false;
  if (Math.abs(x - airRiverX(z)) < 26 || (Math.abs(x - airRoadX(z)) < 8 && z < 120)) return false;
  if (Math.abs(z - AIR_BRIDGE_Z) < 30 && Math.abs(x - airRiverX(z)) < 60) return false;
  if (Math.abs(z - airRailZ(x)) < (Math.abs(x - AIR_YARD_X) < 120 ? 34 : 9)) return false;
  return true;
}
function airTreeList(add) {
  if (AIRMAP !== 'norm') { AIRMAPS[AIRMAP].trees(add); return; }
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
    if (this.z < 40) this.z += 7 * dt; // in fondo alla strada la colonna si ferma
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
// treno merci: locomotiva e carri sulla linea; ogni pezzo è un bersaglio
class AirTrainCar {
  constructor(train, k) {
    this.train = train; this.k = k; this.loco = k === 0; this.alive = true; this.hp = this.loco ? 420 : 150; this.truck = true;
    const mb = new MB(); mb.mat = 'paint';
    if (this.loco) { mb.add(U.cyl12, 0x1d1d1d, 0, 2.4, -1, PI / 2, 0, 0, 1.25, 8, 1.25); mb.add(U.box, 0x222222, 0, 2.7, 3.6, 0, 0, 0, 2.8, 3.4, 3); mb.add(U.cyl12, 0x1a1a1a, 0, 4.2, -3.6, 0, 0, 0, .45, 1.4, .45); mb.add(U.box, 0x2a1d14, 0, .9, 0, 0, 0, 0, 2.6, 1, 11); for (let w = -2; w <= 2; w++) for (const sx of [-1, 1]) mb.add(U.cyl12, 0x111111, sx * 1.2, .9, w * 2, 0, 0, PI / 2, .85, .2, .85); }
    else { const c = pick([0x5a3a28, 0x4a3324, 0x5f5546]); mb.add(U.box, c, 0, 2.2, 0, 0, 0, 0, 2.8, 2.8, 11); mb.add(U.box, 0x2a2a2a, 0, .8, 0, 0, 0, 0, 2.4, .6, 10.5); if (k % 3 === 0) { mb.add(U.box, 0x4a5236, 0, 3.9, 0, 0, 0, 0, 2.4, .6, 6); } }
    this.g = groupMesh(mb.buildGroups()); scene.add(this.g); this.pos = this.g.position; this.box = { min: new V3(), max: new V3() };
    MISSION.vehicles.push(this);
  }
  update() {}
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a; if (this.hp > 0) return;
    this.alive = false; burnMeshes(this.g); const p = this.pos.clone(); p.y += 2; fxExplosion(p, this.loco ? 3 : 2, false); sfxBoom(p, 2.2);
    const e = addEmitter(p, this.loco ? 'smoke' : 'fire', 1.2); e.life = 120;
    if (byPlayer) { STATS.kills += this.loco ? 4 : 1; feed(this.loco ? 'Locomotiva distrutta! Il treno è fermo' : 'Vagone distrutto'); }
    if (this.loco) this.train.stopped = true;
  }
}
class AirTrain {
  constructor() { this.s = -1450; this.cars = []; this.stopped = false; for (let k = 0; k < 9; k++) this.cars.push(new AirTrainCar(this, k)); }
  update(dt) {
    if (!this.stopped && this.s < AIR_YARD_X - 40) this.s += 13 * dt;
    this.cars.forEach((c, k) => {
      const x = this.s - k * 12.5, z = airRailZ(x), y = airRailY(x) + .3, ang = Math.atan2(airRailZ(x + 2) - airRailZ(x - 2), 4);
      c.pos.set(x, y, z); c.g.rotation.y = -ang - PI / 2;
      c.box.min.set(x - 6, y, z - 1.6); c.box.max.set(x + 6, y + 4.5, z + 1.6);
    });
  }
}
function airBombHit(p, w = 1) {
  if (AIRM.ships) for (const s of AIRM.ships) if (s.alive && p.x > s.box.min.x - 8 && p.x < s.box.max.x + 8 && p.z > s.box.min.z - 8 && p.z < s.box.max.z + 8) s.damage(650 * w, true);
  const y = AIRM.yard; if (y && MISSION.stage === 3 && Math.abs(p.x - y.x) < 110 && Math.abs(p.z - y.z) < 30) y.hits++;
  const b = AIRM.bridge; if (!b || b.down) return;
  if ((b.alongZ ? Math.abs(p.x - b.x) < 14 && Math.abs(p.z - b.z) < 95 : Math.abs(p.x - b.x) < 40 && Math.abs(p.z - b.z) < 14) && p.y < b.y + 25) {
    b.hp = Math.round((b.hp - w) * 10) / 10; if (w >= 1 || b.hp <= 0) feed(b.hp > 0 ? `Colpo sul ponte! Ancora ${Math.ceil(b.hp)}` : 'Il ponte crolla!');
    if (b.hp <= 0) { b.down = true; burnMeshes(b.mesh); b.mesh.position.y -= 5; b.mesh.rotation.z = .06; for (let i = 0; i < 4; i++) addEmitter(new V3(b.x + rnd(-25, 25), b.y, b.z), 'smoke', 2).life = 120; STATS.kills += 8; }
  }
}
function spawnHunter(type) {
  const me = PL.me, base = me ? me.pos : new V3(0, 400, 0), a = R() * TAU;
  type = type || (AIRMAP === 'norm' ? (R() < .65 ? 'fw190' : 'bf109') : R() < .5 ? 'bf109' : 'fw190');
  const p = new Plane(type, 'E', new V3(base.x + Math.cos(a) * 1300, clamp(base.y + rnd(-80, 160), 250, 900), base.z + Math.sin(a) * 1300), new V3(-Math.cos(a) * 160, 0, -Math.sin(a) * 160), []);
  p.hunter = true; p.hp = type === 'me262' ? 320 : 260; AIRM.hunters.push(p);
  if (type === 'me262') { p.maxSpd = 235; p.spd = 220; p.turnRate = .28; } else if (type === 'bf109') p.turnRate = .42;
  const wl = (PL.wing || []).filter(w => w.alive && !w.crash); if (wl.length && R() < .4) p.huntTarget = pick(wl);
  return p;
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
      if (AIRM.convoy.length - left.length >= 8) { say('Radio', 'Colonna fermata! Un treno di munizioni sta entrando nello scalo: fermatelo!'); setStage(2); }
    },
  },
  {
    title: 'Il treno delle munizioni',
    start() { AIRM.train = new AirTrain(); AIRM.harassT = 45; },
    update(dt) {
      const t = AIRM.train; t.update(dt);
      const loco = t.cars[0], dead = t.cars.filter(c => !c.alive).length;
      MISSION.markers = loco.alive ? [{ pos: loco.pos.clone().add(new V3(0, 7, 0)), label: 'Locomotiva' }] : [];
      MISSION.objText = loco.alive ? `Ferma il treno: distruggi la locomotiva prima che arrivi allo scalo (${Math.max(0, Math.round((AIR_YARD_X - 40 - t.s) / 13))} s)` : `Treno fermo — vagoni distrutti ${dead - 1}/4`;
      AIRM.harassT -= dt; if (AIRM.harassT <= 0 && PL.me) { AIRM.harassT = rnd(55, 85); spawnHunter(); }
      airCountKills();
      // arrivato allo scalo il treno si ferma: basta distruggere locomotiva e 4 vagoni
      if (!loco.alive && dead - 1 >= 4) { say('Radio', 'Treno distrutto! Ora scortate i B-26 sullo scalo ferroviario.'); setStage(3); }
      else if (loco.alive && t.s >= AIR_YARD_X - 41 && !t.warned) { t.warned = true; say('Radio', 'Il treno è nello scalo! Colpitelo comunque, è fermo.'); }
    },
  },
  {
    title: 'Scorta ai Marauder',
    start() {
      AIRM.bombers = []; AIRM.wave = 0;
      const y = AIRM.yard;
      for (let i = 0; i < 6; i++) {
        const o = new V3((i % 3) * 45 - 45, (i % 2) * 15, Math.floor(i / 3) * 60);
        const path = [{ p: new V3(y.x + o.x - 200, 560, 200 + o.z), v: 95 }, { p: new V3(y.x + o.x, 540, y.z + 300), v: 95 }, { p: new V3(y.x + o.x, 520, y.z - 80 + o.z), v: 95, bomb: new V3(y.x + o.x * .6 + rnd(-20, 20), 0, y.z + rnd(-15, 15)), r: 120 }, { p: new V3(y.x + o.x + 600, 600, -2600), v: 100 }];
        const b = new Plane('b26', 'A', new V3(y.x + o.x - 400, 560, 1400 + o.z), new V3(0, 0, -95), path); b.hp = 700; AIRM.bombers.push(b);
      }
      AIRM.escortT = 8; say('Radio', 'Little friends, qui Marauder Leader: arriviamo da nord, copriteci!');
    },
    update(dt) {
      const live = AIRM.bombers.filter(b => b.alive && !b.crash);
      AIRM.escortT -= dt;
      if (AIRM.escortT <= 0 && live.length && AIRM.wave < 4) { AIRM.escortT = 26; AIRM.wave++; for (let k = 0; k < 2; k++) { const h = spawnHunter(); h.huntTarget = pick(live); } say('Radio', pick(['Banditi sui bombardieri!', 'Caccia in attacco alla formazione, a ore sei!', 'Ci sono addosso, Thunderbolt!'])); }
      airCountKills();
      MISSION.markers = live.slice(0, 1).map(b => ({ pos: b.pos.clone(), label: 'B-26' })).concat(AIRM.hunters.filter(h => !h.crash && h.huntTarget).map(h => ({ pos: h.pos.clone(), label: 'Fw 190' })));
      const done = AIRM.bombers.filter(b => b.pi >= 3).length;
      MISSION.objText = `Proteggi i B-26 fino allo sgancio — ${live.length}/6 in volo · sganci ${done}`;
      if (done >= 2 || (AIRM.yard.hits >= 4)) { say('Radio', 'Bombe sullo scalo! Grazie per la scorta. Ultimo obiettivo: il ponte sulla Douve.'); setStage(4); }
      else if (!live.length) { say('Radio', 'Abbiamo perso la formazione... arriva una seconda ondata!'); this.start(); }
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
  if (AIRMAP !== 'norm') { MISSION.checkpoint = { pos: new V3(CARRIER.x, 0, CARRIER.z), yaw: 0 }; P.inBoat = false; P.boat = null; P.mode = 'foot'; P.pos.set(CARRIER.x, CARRIER.deckY + 2, CARRIER.z); setStage(0); return; }
  P.inBoat = false; P.boat = null; P.mode = 'foot'; P.pos.set(0, 500, 1100);
  MISSION.checkpoint = { pos: new V3(-30, 0, 1100), yaw: 0 };
  setStage(0);
}
function updateAirMode(dt) {
  MISSION.stageT += dt;
  airStageList()[MISSION.stage].update(dt);
  updateSubs(dt);
  for (const v of MISSION.vehicles) v.update(dt);
  // a terra il giocatore non ha nulla da fare: torna subito in volo
  if (P.mode === 'foot' && !P.dead && !P.spawnMenu && GAME.started && !CUT.active) enterPlane();
}
// rientro in volo a ~1,5 km dall'obiettivo attuale, diretti verso di esso
function airSpawn() {
  if (AIRMAP !== 'norm') return airSpawn2();
  let t = new V3(0, 0, -400);
  if (MISSION.stage === 1) { const c = AIRM.convoy.find(v => v.alive); if (c) t = c.pos.clone(); }
  else if (MISSION.stage === 2 && AIRM.train) t = AIRM.train.cars[0].pos.clone();
  else if (MISSION.stage === 3 && AIRM.bombers) { const b = AIRM.bombers.find(p => p.alive && !p.crash); if (b) t = b.pos.clone(); }
  else if (MISSION.stage === 4 && AIRM.bridge) t = new V3(AIRM.bridge.x, 0, AIRM.bridge.z);
  else { const h = AIRM.hunters.find(p => p.alive && !p.crash); if (h) t = h.pos.clone(); }
  const a = Math.atan2(t.x, t.z - 1100) + rnd(-.4, .4), pos = new V3(t.x - Math.sin(a) * 1500, 0, t.z - Math.cos(a) * 1500);
  pos.x = clamp(pos.x, -1400, 1400); pos.z = clamp(pos.z, -1400, 900); pos.y = Math.max(Hf(pos.x, pos.z), 0) + 450;
  const d = new V3(t.x - pos.x, 0, t.z - pos.z).normalize().multiplyScalar(130); d.y = -4;
  return { pos, vel: d };
}
const airDeployPoints = () => [
  { label: CARRIER.type === 'field' ? AIRMAPS[AIRMAP].field.name : 'Portaerei', sub: CARRIER.type === 'field' ? 'decollo dalla pista' : 'decollo dal ponte di volo', kind: 'plane', carrier: true, pos: new V3(CARRIER.x, 0, CARRIER.z) },
  { label: 'In volo', sub: 'vicino all\'obiettivo', kind: 'plane', carrier: false, pos: new V3(-30, 0, 1100) },
];
