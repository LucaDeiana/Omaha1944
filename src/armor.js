"use strict";
// ============================================================
//  GUERRA CORAZZATA — Passo di Kasserine, febbraio 1943.
//  Il giocatore comanda uno Sherman M4A1 con altri carri alleati e
//  conquista tre posizioni lungo la valle (cresta sud, villaggio di
//  Sidi Bou Zid, il passo) contro Panzer IV, Tiger I e cannoni Pak 40.
//  Tiro balistico vero (velocità iniziale, caduta, tempo di volo),
//  corazza diversa davanti/fianchi/retro e torretta, angolo d'impatto,
//  rimbalzi, perforazioni con danni ai cingoli, alla torretta e alle
//  munizioni; contrattacco finale da tenere.
// ============================================================
const KAS = { tanks: [], guns: [], shells: [], caps: [], stage: 0, lives: 3, over: false, el: null, radar: null, rctx: null, respawnT: 0, killed: 0, holdT: 0, wave: 0, msgT: 0 };
const KAS_PTS = [
  { name: 'Cresta di Djebel Ksaira', x: -40, z: -170, r: 70 },
  { name: 'Sidi Bou Zid', x: 70, z: -540, r: 85 },
  { name: 'Il passo di Kasserine', x: 0, z: -930, r: 80 },
];
// ---------- terreno: valle desertica fra due catene, uadi, villaggio spianato ----------
function kasH(x, z) {
  const narrow = smooth((-z - 600) / 350) * 130, half = 330 - narrow;
  let y = 4 + (fbm(x * .004 + 3, z * .004, 4) - .5) * 16 + (fbm(x * .02, z * .02, 2) - .5) * 2.5;
  const ex = Math.abs(x) - half; if (ex > 0) y += Math.pow(Math.min(1, ex / 260), 1.4) * (90 + fbm(x * .008, z * .008, 3) * 70) + ex * .05;
  const wx = 70 * Math.sin(z * .0045 + 1.3) - 60, wd = Math.abs(x - wx); if (wd < 16) y -= 3.2 * smooth((16 - wd) / 9);   // uadi
  for (const p of KAS_PTS) { const d = Math.hypot(x - p.x, z - p.z); if (p === KAS_PTS[1] && d < 110) y = lerp(y, 3, smooth((110 - d) / 40)); }
  if (Math.abs(x - kasRoadX(z)) < 7) y -= .25 * smooth((7 - Math.abs(x - kasRoadX(z))) / 3);
  return y;
}
function kasRoadX(z) { return 40 * Math.sin(z * .003) + (z < -400 && z > -680 ? 30 * Math.sin((z + 400) / 280 * PI) : 0); }
function kasSplat(x, z, n2) {
  const sl = (Math.abs(kasH(x, z - 2) - kasH(x, z + 2)) + Math.abs(kasH(x - 2, z) - kasH(x + 2, z))) * .25;
  const rock = smooth((sl - .35) / .4), road = Math.abs(x - kasRoadX(z)) < 5 ? 1 : 0, vil = Math.hypot(x - KAS_PTS[1].x, z - KAS_PTS[1].z) < 90 ? .6 : 0;
  const scrub = fbm(x * .05 + 9, z * .05, 2) > .62 ? .25 : 0, sa = 1.3 * (1 - rock), pe = rock * 1.4 + (fbm(x * .03, z * .03, 2) > .6 ? .4 : 0), di = road * 1.8 + vil + scrub, gr = scrub * .5, tot = sa + pe + gr + di || 1;
  // increspature delle dune (strisce oblique al vento) e chiazze più scure di ghiaia
  const rip = Math.sin((x * .8 + z * .35) * .9 + fbm(x * .02, z * .02, 2) * 6) * .025, t = 1 + .08 * n2 + rip, dk = fbm(x * .008 + 4, z * .008, 3) < .38 ? .9 : 1;
  return { sp: [sa / tot, pe / tot, gr / tot, di / tot], cl: [t * 1.1 * dk, t * .99 * dk, t * .8 * dk] };
}
function kasPalm(mb, x, z, s = 1) {
  const y = kasH(x, z), h = rnd(7, 11) * s, lean = rnd(-.2, .2), dir = R() * TAU;
  mb.mat = 'wood'; for (let k = 0; k < 6; k++) { const t = k / 6; mb.add(U.cyl, 0x7a6448, x + Math.cos(dir) * lean * t * t * h, y + t * h + h / 12, z + Math.sin(dir) * lean * t * t * h, 0, 0, 0, .22 - t * .06, h / 6 + .05, .22 - t * .06); }
  const tx = x + Math.cos(dir) * lean * h, tz = z + Math.sin(dir) * lean * h, ty = y + h + .2; mb.mat = 'vc';
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + rnd(-.2, .2), c = Math.cos(a), sn = Math.sin(a); mb.add(U.box, pick([0x4d6b2a, 0x5a7a30, 0x435f25]), tx + c * 1.4, ty - .2, tz + sn * 1.4, 0, -a, -.35, 3.2, .06, .7); }
  OBST.push({ x, z, r: .4 });
}
function buildKasserine() {
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  buildHF(); buildHC(); buildTerrain(); buildWater();
  const mb = new MB();
  // villaggio di Sidi Bou Zid: case a calce spianate a quota 3 (tunHouse costruisce a quota 2: base allargata sotto)
  const V = KAS_PTS[1];
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, r = rnd(14, 70), x = V.x + Math.cos(a) * r, z = V.z + Math.sin(a) * r;
    if (Math.abs(x - kasRoadX(z)) < 9 || pointInSolid(new V3(x, 4, z))) continue;
    const w = rnd(6, 11), d = rnd(6, 10); mb.mat = 'plaster'; mb.add(U.box, 0xd9ccb0, x, 2.5, z, 0, 0, 0, w + .4, 1.2, d + .4); tunHouse(mb, x, z, w, d, pick([3.6, 4.2, 4.8, 5.5]), pick(TUN_COLS));
  }
  mb.mat = 'plaster'; mb.add(U.box, 0xece4d0, V.x + 25, 3 + 9, V.z - 20, 0, 0, 0, 3.5, 18, 3.5); mb.add(U.sph, 0x4f8a72, V.x + 25, 3 + 19, V.z - 20, 0, 0, 0, 1.4, 1.2, 1.4); addSolid(V.x + 23, 0, V.z - 22, V.x + 27, 21, V.z - 18, 'tower');
  for (let i = 0; i < 30; i++) { const a = R() * TAU, r = rnd(80, 140); kasPalm(mb, V.x + Math.cos(a) * r, V.z + Math.sin(a) * r, rnd(.9, 1.2)); }
  // rocce sui pendii, pali del telegrafo lungo la pista, relitti
  for (let i = 0; i < 260; i++) { const x = rnd(-700, 700), z = rnd(-1350, 350), y = kasH(x, z); if (Math.abs(x) < 220 && R() < .7) continue; const s = rnd(.8, 4); mb.mat = 'stone'; mb.add(U.ico1, pick([0xa08a68, 0x8e7a5c, 0xb09a74]), x, y + s * .3, z, rnd(0, 3), rnd(0, 3), 0, s * rnd(1, 1.6), s * .7, s); if (s > 2.2) addSolid(x - s * .8, y - 1, z - s * .8, x + s * .8, y + s, z + s * .8, 'rock'); }
  for (let z = 380; z > -1350; z -= 45) { const x = kasRoadX(z) + 9, y = kasH(x, z); mb.mat = 'wood'; mb.add(U.cyl, 0x5a4630, x, y + 3.5, z, 0, 0, 0, .1, 7, .1); mb.add(U.box, 0x5a4630, x, y + 6.6, z, 0, 0, 0, 1.4, .1, .1); }
  for (const [x, z, ry] of [[-120, -320, .7], [150, -700, -.3], [-60, -1050, 2], [90, 60, 1.2]]) addSherman(mb, x, kasH(x, z), z, ry, true);
  // postazioni: sacchetti attorno ai pezzi anticarro e alle posizioni
  for (const p of KAS_PTS) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + rnd(-.3, .3), r = p.r * rnd(.4, .8), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (pointInSolid(new V3(x, 4, z))) continue; sandbagLine(mb, x - 2, z, x + 2, z, 2); }
  addTiled(mb, 120);
  // macchia: cespugli bassi e spinosi sparsi nella valle (istanziati)
  { const N = 2600, g = new THREE.IcosahedronGeometry(1, 0), m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), N), M = new THREE.Matrix4(), c = new THREE.Color(); let k = 0;
    for (let i = 0; i < N * 3 && k < N; i++) { const x = rnd(-560, 560), z = rnd(-1250, 360); if (Math.abs(x - kasRoadX(z)) < 8) continue; const y = kasH(x, z); if (fbm(x * .05 + 9, z * .05, 2) < .5 && R() < .7) continue; const sc = rnd(.35, 1.1);
      M.compose(new V3(x, y + sc * .25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(sc * rnd(1, 1.6), sc * rnd(.4, .7), sc * rnd(1, 1.6))); m.setMatrixAt(k, M); c.setHex(pick([0x6b6a3a, 0x7a704a, 0x5a5a34, 0x8a7a50])).convertSRGBToLinear(); m.setColorAt(k, c); k++; }
    m.count = k; m.receiveShadow = true; scene.add(m); }
  // luce del deserto: foschia sabbiosa leggera, sole alto
  FOG_COL.setRGB(.88, .82, .7); scene.fog.color.copy(FOG_COL); FOG_K = .45; scene.fog.density = FOG_BASE * FOG_K; if (sun) sun.intensity *= 1.25;
  // bandiere sulle posizioni da conquistare
  for (const p of KAS_PTS) { const y = kasH(p.x, p.z), pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 9, 6), MAT.vc); pole.position.set(p.x, y + 4.5, p.z); scene.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ color: 0xb02020, side: THREE.DoubleSide, roughness: .9 })); fl.position.set(p.x + 1.2, y + 8.2, p.z); scene.add(fl); p.flag = fl; }
}

// ---------- modelli ----------
const KAS_GEO = {};
function kasShermanGeo() {
  if (KAS_GEO.sherman) return KAS_GEO.sherman;
  const c = 0x5f6646, d = 0x464c34, k = 0x26261f, tr = 0x2f2d27, h = new MB(), t = new MB(), gn = new MB(); h.mat = t.mat = gn.mat = 'paint';
  h.add(U.box, d, 0, .78, .15, 0, 0, 0, 2.0, .62, 5.4);
  { const sh = new THREE.Shape(), w = 1.25, hh = .74, r = .32; sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, hh - r); sh.quadraticCurveTo(w, hh, w - r, hh); sh.lineTo(-w + r, hh); sh.quadraticCurveTo(-w, hh, -w, hh - r); sh.lineTo(-w, 0);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 4.3, bevelEnabled: true, bevelThickness: .12, bevelSize: .06, bevelSegments: 2, curveSegments: 6 }); eg.translate(0, 0, -4.3 / 2); h.add(eg, c, 0, 1.09, .45); }   // scafo superiore fuso dell'M4A1 h.add(U.box, c, 0, 1.3, -2.15, -.98, 0, 0, 2.5, .95, .1);
  h.add(U.cyl12, c, 0, .78, -2.6, 0, 0, PI / 2, .45, 2.3, .45); for (const sx of [-1, 1]) h.add(U.box, d, sx * .55, 1.82, -1.55, 0, 0, 0, .5, .25, .5);
  h.add(U.box, d, .55, 1.62, -2.05, -.98, 0, 0, .25, .12, .2); h.add(U.cyl12, k, .55, 1.62, -2.3, PI / 2 - .2, 0, 0, .025, .35, .025);
  for (let i = 0; i < 4; i++) h.add(U.box, k, -.5 + i * .33, 1.82, 2.1, 0, 0, 0, .25, .02, .8); h.add(U.box, d, 0, 1.15, 2.67, .2, 0, 0, 2.3, .7, .1);
  for (const sx of [-1, 1]) { h.add(U.box, d, sx * 1.33, 1.0, .15, 0, 0, 0, .45, .05, 5.6);
    for (let b = 0; b < 3; b++) { const bz = -1.55 + b * 1.6; h.add(U.box, d, sx * 1.14, .58, bz, 0, 0, 0, .14, .5, .9); for (const wz of [-.33, .33]) { h.add(U.cyl12, k, sx * 1.24, .33, bz + wz, 0, 0, PI / 2, .3, .32, .3); h.add(U.cyl12, 0x3c3c34, sx * 1.24, .33, bz + wz, 0, 0, PI / 2, .1, .36, .1); } h.add(U.cyl12, k, sx * 1.24, .85, bz + .45, 0, 0, PI / 2, .1, .3, .1); }
    h.add(U.cyl12, k, sx * 1.24, .62, -2.7, 0, 0, PI / 2, .3, .32, .3); h.add(U.cyl12, k, sx * 1.24, .5, 2.55, 0, 0, PI / 2, .25, .32, .25);
    for (let i = 0; i < 44; i++) { const zz = -2.85 + i * .127; h.add(U.box, tr, sx * 1.24, .05, zz, 0, 0, 0, .42, .07, .1); h.add(U.box, tr, sx * 1.24, .96, zz + .05, 0, 0, 0, .42, .06, .1); } }
  for (let i = 0; i < 4; i++) h.add(U.box, 0x6a6448, -.9 + i * .6, 1.95, 2.3, 0, 0, 0, .5, .3, .3);
  // dettagli: fari con le grate, ganci di traino, periscopi del pilota, griglie e attrezzi sul vano motore, deflettore degli scarichi, parafanghi
  for (const sx of [-1, 1]) { h.add(U.cyl12, k, sx * .85, 1.55, -2.35, PI / 2 - .9, 0, 0, .09, .12, .09); h.add(U.box, k, sx * .85, 1.62, -2.42, -.9, 0, 0, .26, .01, .22);
    for (let i = 0; i < 3; i++) h.add(U.box, k, sx * .85 + (i - 1) * .1, 1.6, -2.4, -.9, 0, 0, .012, .02, .24);
    h.add(U.box, k, sx * .7, .55, -2.95, 0, 0, 0, .12, .2, .18); h.add(U.box, k, sx * .5, 1.88, -1.25, 0, 0, 0, .18, .1, .25);
    h.add(U.box, d, sx * 1.3, 1.04, -2.75, -.4, 0, 0, .5, .03, .4); h.add(U.box, d, sx * 1.3, 1.04, 2.85, .3, 0, 0, .5, .03, .4); }
  for (let i = 0; i < 6; i++) h.add(U.box, k, -.75 + i * .3, 1.86, 1.55, 0, 0, 0, .2, .02, .6);
  h.add(U.box, 0x6b5132, .95, 1.86, .9, 0, 0, 0, .06, .05, 1.2); h.add(U.box, 0x3a3a34, .95, 1.86, .25, 0, 0, 0, .18, .04, .2);   // badile
  h.add(U.box, 0x6b5132, -.95, 1.86, 1.1, 0, 0, 0, .06, .05, .9); h.add(U.box, 0x3a3a34, -.95, 1.86, .62, 0, 0, 0, .04, .12, .16);   // ascia
  h.add(U.box, k, 0, .95, 2.85, -.5, 0, 0, 1.8, .03, .45);
  h.mat = 'vc'; for (const sx of [-1, 1]) { h.add(U.cyl12, 0xe8e6dc, sx * 1.26, 1.45, .2, 0, 0, PI / 2, .3, .01, .3); h.add(U.cyl, c, sx * 1.27, 1.45, .2, 0, 0, PI / 2, .2, .01, .2); }
  // torretta fusa (perno a quota 1.81, centro .3 dietro il centro scafo)
  t.add(lath([[0, .85], [.55, .82], [.85, .65], [.98, .35], [1.0, 0], [.95, -.05], [0, -.05]], 18), c, 0, 0, 0); t.add(U.box, c, 0, .36, .65, 0, 0, 0, .9, .5, .7);
  t.add(U.cyl12, d, -.4, .91, .15, 0, 0, 0, .32, .14, .32); t.add(U.cyl12, k, -.4, .99, .15, 0, 0, 0, .3, .03, .3); t.add(U.cyl12, k, .42, 1.14, 0, 0, 0, 0, .025, .45, .025); t.add(U.box, k, .42, 1.34, -.15, 0, 0, 0, .07, .12, .55);
  t.add(U.cyl12, d, .35, .9, -.25, 0, 0, 0, .14, .1, .14); t.add(U.cyl, k, -.2, 1.5, .85, 0, 0, 0, .01, 2.4, .01); t.add(U.cyl12, k, -.2, .85, .85, 0, 0, 0, .05, .1, .05);   // ventilatore, antenna
  t.add(U.cyl12, k, .98, .45, .3, 0, 0, PI / 2, .06, .04, .06); t.add(U.box, d, -.3, .88, -.45, 0, 0, 0, .14, .08, .12); t.add(U.box, 0x20262a, -.3, .9, -.52, 0, 0, 0, .1, .04, .01);   // feritoia, periscopio del cannoniere
  t.mat = 'vc'; t.add(U.cyl12, 0xe8e6dc, 0, .5, .2, 0, 0, 0, .5, .01, .5);
  // cannone M3 da 75 mm con mantelletto (perno all'altezza dell'orecchione)
  gn.add(U.box, d, 0, 0, 0, 0, 0, 0, .75, .45, .25); gn.add(U.cyl12, d, 0, 0, -1.25, PI / 2, 0, 0, .075, 2.5, .075); gn.add(U.cyl12, k, 0, 0, -2.47, PI / 2, 0, 0, .09, .12, .09);
  return KAS_GEO.sherman = { hull: h.buildGroups(), tur: t.buildGroups(), gun: gn.buildGroups(), turY: 1.81, turZ: .3, gunY: .37, gunZ: -1.05, len: 2.55, cup: [-.4, 1.65, .15] };
}
function kasTigerGeo() {
  if (KAS_GEO.tiger) return KAS_GEO.tiger;
  const c = 0xb4a06a, d = 0x8f7f52, k = 0x2a2822, tr = 0x302c26, h = new MB(), t = new MB(), gn = new MB(); h.mat = t.mat = gn.mat = 'paint';
  // scafo squadrato: vasca stretta fra i cingoli, sovrastruttura larga che li copre, piastra frontale verticale da 100 mm
  h.add(U.box, d, 0, .95, 0, 0, 0, 0, 1.85, 1.0, 6.0); h.add(U.box, c, 0, 1.75, .1, 0, 0, 0, 3.45, .65, 4.9); h.add(U.box, c, 0, 1.25, -2.75, -.15, 0, 0, 1.85, 1.0, .25);
  h.add(U.box, c, 0, 1.75, -2.45, 0, 0, 0, 3.45, .65, .15); h.add(U.box, k, -.75, 1.85, -2.53, 0, 0, 0, .35, .1, .02); h.add(U.cyl12, k, .7, 1.8, -2.55, PI / 2, 0, 0, .1, .08, .1);   // feritoia del pilota e sfera della mitragliatrice
  h.add(U.box, d, 0, 2.1, 1.9, 0, 0, 0, 2.2, .1, 1.4); for (let i = 0; i < 3; i++) h.add(U.box, k, -.6 + i * .6, 2.16, 1.9, 0, 0, 0, .45, .02, 1.2);   // griglie del motore
  for (const sx of [-1, 1]) { h.add(U.box, d, sx * 1.62, 1.35, 0, 0, 0, 0, .1, .2, 6.1);
    for (let i = 0; i < 8; i++) { const z = -2.3 + i * .66, off = i % 2 ? .18 : -.02; h.add(U.cyl12, d, sx * (1.3 + off), .55, z, 0, 0, PI / 2, .4, .1, .4); h.add(U.cyl12, k, sx * (1.36 + off), .55, z, 0, 0, PI / 2, .12, .12, .12); }   // ruote interallacciate
    h.add(U.cyl12, k, sx * 1.4, .95, -2.85, 0, 0, PI / 2, .38, .5, .38); h.add(U.cyl12, k, sx * 1.4, .85, 2.75, 0, 0, PI / 2, .32, .5, .32);
    for (let i = 0; i < 48; i++) { const zz = -3.05 + i * .127; h.add(U.box, tr, sx * 1.42, .1, zz, 0, 0, 0, .72, .07, .11); h.add(U.box, tr, sx * 1.42, 1.0, zz + .05, 0, 0, 0, .72, .06, .11); } }
  // dettagli: filtri Feifel e scarichi con le protezioni, cavi di traino, attrezzi, faro Bosch, parafanghi
  for (const sx of [-1, 1]) { h.add(U.cyl12, d, sx * .95, 1.55, 3.2, 0, 0, 0, .28, .9, .28); h.add(U.cyl12, k, sx * .45, 1.95, 3.0, 0, 0, 0, .09, .7, .09); h.add(U.box, d, sx * .45, 2.0, 3.06, 0, 0, 0, .3, .55, .05);
    h.add(U.cyl, 0x3a3630, sx * 1.6, 1.95, 0, PI / 2, 0, 0, .025, 4.5, .025); h.add(U.box, 0x6b5132, sx * 1.55, 2.09, -1.0, 0, 0, 0, .06, .05, 1.3); h.add(U.box, d, sx * 1.64, 1.1, -2.9, -.2, 0, 0, .4, .03, .5); }
  h.add(U.cyl12, k, -.95, 2.15, -2.3, PI / 2 - .3, 0, 0, .1, .14, .1); h.add(U.box, d, -.95, 2.13, -2.2, 0, 0, 0, .05, .1, .06);
  h.mat = 'vc'; for (const sx of [-1, 1]) { h.add(U.box, 0x1a1a1a, sx * 1.73, 1.75, -1.0, 0, 0, 0, .01, .5, .5); h.add(U.box, 0xe8e6dc, sx * 1.735, 1.75, -1.0, 0, 0, 0, .01, .12, .5); h.add(U.box, 0xe8e6dc, sx * 1.735, 1.75, -1.0, 0, 0, 0, .01, .5, .12); }
  // torretta a ferro di cavallo, cupola del capocarro, mantelletto e 8,8 cm KwK 36 col freno di bocca
  const sh = new THREE.Shape(); sh.moveTo(-1.45, -1.3); sh.lineTo(1.45, -1.3); sh.absarc(0, .2, 1.5, 0, PI, false); sh.lineTo(-1.45, -1.3);
  const tg = new THREE.ExtrudeGeometry(sh, { depth: .95, bevelEnabled: false, curveSegments: 16 }); tg.rotateX(PI / 2); tg.translate(0, .95, 0); t.add(tg, c, 0, 0, 0);   // lato piatto davanti, ferro di cavallo dietro
  t.add(U.cyl12, c, -.65, 1.1, .7, 0, 0, 0, .38, .3, .38); t.add(U.cyl12, k, -.65, 1.27, .7, 0, 0, 0, .36, .05, .36); t.add(U.box, d, 0, .5, -1.42, 0, 0, 0, 1.7, .75, .3);
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) t.add(U.cyl12, k, sx * .9 + i * .12 * sx, .75, -1.0, PI / 2 - .4, 0, 0, .05, .2, .05);   // lanciafumogeni
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) t.add(U.box, k, sx * 1.48, .5, -.2 + i * .32, 0, 0, 0, .06, .5, .28);   // maglie di cingolo di scorta sui fianchi della torretta
  t.add(U.box, d, .55, .99, .3, 0, 0, 0, .55, .05, .7); t.add(U.cyl, k, 0, .98, -.4, 0, 0, 0, .05, .06, .05);   // portello del servente, periscopio
  t.mat = 'vc'; t.add(U.box, 0x1a1a1a, 1.5, .6, .2, 0, 0, 0, .01, .4, .6);
  gn.add(U.box, c, 0, 0, 0, 0, 0, 0, 1.25, .75, .35); gn.add(U.cyl12, d, 0, 0, -2.6, PI / 2, 0, 0, .1, 5.0, .1); gn.add(U.cyl12, k, 0, 0, -5.2, PI / 2, 0, 0, .17, .4, .17); gn.add(U.box, k, 0, 0, -5.2, 0, 0, 0, .5, .14, .3);
  return KAS_GEO.tiger = { hull: h.buildGroups(), tur: t.buildGroups(), gun: gn.buildGroups(), turY: 2.08, turZ: .2, gunY: .45, gunZ: -1.35, len: 5.4, cup: [-.65, 1.95, .7] };
}
function kasPz4Geo() {
  if (KAS_GEO.pz4) return KAS_GEO.pz4;
  if (!TANKS.hull) buildPanzerGeo();
  return KAS_GEO.pz4 = { hull: TANKS.hull, tur: TANKS.tur, gun: TANKS.gun, turY: 1.67, turZ: 0, gunY: .48, gunZ: -1.4, len: 4.9, cup: [0, 1.6, .8] };
}
function kasPakGeo() {
  if (KAS_GEO.pak) return KAS_GEO.pak;
  const c = 0x9c8b5c, k = 0x2a2822, m = new MB(), gn = new MB(); m.mat = gn.mat = 'paint';
  for (const sx of [-1, 1]) { m.add(U.cyl12, k, sx * .95, .45, .2, 0, 0, PI / 2, .45, .18, .45); m.add(U.box, c, sx * .55, .3, 2, 0, sx * .28, 0, .14, .14, 3.4); m.add(U.box, c, sx * .55 + sx * .45, .15, 3.6, 0, 0, 0, .2, .3, .3); }   // ruote e code divaricate
  m.add(U.box, c, 0, .7, .2, 0, 0, 0, 1.5, .25, .6);
  for (const sx of [-1, 1]) m.add(U.box, c, sx * .55, 1.15, -.15, -.15, sx * .35, 0, 1.0, 1.1, .05);   // scudo a doppia piastra
  gn.add(U.box, c, 0, 0, .3, 0, 0, 0, .45, .4, 1.1); gn.add(U.cyl12, k, 0, 0, -1.6, PI / 2, 0, 0, .06, 3.2, .06); gn.add(U.box, k, 0, 0, -3.2, 0, 0, 0, .28, .12, .25);
  return KAS_GEO.pak = { base: m.buildGroups(), gun: gn.buildGroups() };
}
// ---------- carri: dati ----------
// corazza in mm (f fronte scafo, s fianchi, r retro, t fronte torretta, ts fianchi torretta); pen a 100 m; v velocità iniziale
const KAS_T = {
  sherman: { name: 'M4A1 Sherman', geo: kasShermanGeo, hp: 100, f: 76, s: 38, r: 38, t: 76, ts: 51, pen: 88, v: 620, cal: 75, reload: 4.2, vmax: 11, trav: .5, elev: .35, hullH: 2.0, half: [1.4, 3.0] },
  pz4: { name: 'Panzer IV G', geo: kasPz4Geo, hp: 95, f: 80, s: 30, r: 20, t: 50, ts: 30, pen: 110, v: 740, cal: 75, reload: 4.8, vmax: 10, trav: .3, elev: .3, hullH: 1.9, half: [1.45, 2.95] },
  tiger: { name: 'Tiger I', geo: kasTigerGeo, hp: 150, f: 100, s: 80, r: 80, t: 110, ts: 80, pen: 162, v: 810, cal: 88, reload: 7, vmax: 7, trav: .2, elev: .25, hullH: 2.2, half: [1.8, 3.2] },
};
// ---------- carro ----------
class KasTank {
  constructor(type, team, x, z, yaw) {
    const T = this.T = KAS_T[type], G = T.geo();
    this.type = type; this.team = team; this.name = T.name;
    this.g = groupMesh(G.hull); this.tg = groupMesh(G.tur); this.gg = groupMesh(G.gun);
    this.tg.position.set(0, G.turY, G.turZ); this.gg.position.set(0, G.gunY, G.gunZ); this.tg.add(this.gg); this.g.add(this.tg); scene.add(this.g); this.G = G;
    if (typeof shipPlateMat === 'function') { KAS.mat = KAS.mat || shipPlateMat(); this.g.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors) o.material = KAS.mat; }); }   // lamiera e getti d'acciaio con giunti, rivetti e ruggine
    this.pos = this.g.position; this.pos.set(x, Hf(x, z), z); this.yaw = yaw; this.tyaw = 0; this.gpitch = 0; this.ayaw = 0; this.apitch = 0;
    this.alive = true; this.hp = this.hpMax = T.hp; this.speed = 0; this.reload = rnd(1, T.reload); this.mgT = 0; this.player = false; this.tank = true;
    this.immob = false; this.jam = false; this.box = { min: new V3(), max: new V3() }; this.aiT = rnd(0, .5); this.target = null; this.goalOff = new V3(rnd(-30, 30), 0, rnd(-30, 30)); this.err = new V3();
    this.eng = loopSound(type === 'sherman' ? 'eng_sherman' : type === 'tiger' ? 'eng_tiger' : 'eng_pz4', 0); this.trk = loopSound('tracks', 0);
    MISSION.vehicles.push(this); KAS.tanks.push(this);
  }
  muzzle(o) { this.g.updateMatrixWorld(true); return o.set(0, 0, -this.G.len).applyMatrix4(this.gg.matrixWorld); }
  aimDir(o) { this.g.updateMatrixWorld(true); return o.set(0, 0, -1).transformDirection(this.gg.matrixWorld); }
  fireMain(byPlayer) {
    if (this.reload > 0 || !this.alive) return; this.reload = this.T.reload * (byPlayer ? 1 : rnd(1, 1.3));
    const o = this.muzzle(new V3()), d = this.aimDir(new V3());
    if (!byPlayer) { const sp = .0018 + (Math.abs(this.speed) > 1 ? .006 : 0); d.x += rnd(-sp, sp); d.y += rnd(-sp, sp) * .6; d.z += rnd(-sp, sp); d.normalize(); }
    kasShell(o, d, this.ammo === 'he' ? Object.assign({}, this.T, { pen: this.T.cal * .55, v: this.T.v * .75, he: true }) : this.T, this);
    PS_FIRE.emit(o.x, o.y, o.z, d.x * 6, d.y * 6, d.z * 6, .2, 2.4, 4, 1, 4, 2.5, 1.2);
    for (let i = 0; i < 8; i++) PS_SMOKE.emit(o.x, o.y, o.z, d.x * rnd(2, 6) + rnd(-1, 1), rnd(0, 1.5), d.z * rnd(2, 6) + rnd(-1, 1), rnd(2, 3.5), .8, 3.5, .62, .58, .5, .55, .8, -.05);
    for (let i = 0; i < 14; i++) PS_GRAIN.emit(this.pos.x + rnd(-3, 3), this.pos.y + .2, this.pos.z + rnd(-3, 3), rnd(-3, 3), rnd(1, 3), rnd(-3, 3), .8, .05, .05, .6, ...C_DIRT, .4, 9.8);
    play('tank_gun', byPlayer ? null : o, { vol: byPlayer ? 1.3 : 1.6, ref: 60, rate: this.T.cal >= 88 ? .82 : 1, revMul: 1.4 }); sfxBoom(o, this.T.cal >= 88 ? 1.2 : .9); flashLight(o, 0xffb060, 40, .1);
    if (byPlayer) { P.shake += .6; this.kick = 1; }
  }
  fireMG(byPlayer) {   // mitragliatrice coassiale: utile contro i serventi dei Pak
    if (this.mgT > 0) return; this.mgT = .09; const o = this.muzzle(new V3()), d = this.aimDir(new V3()); d.x += rnd(-.006, .006); d.y += rnd(-.004, .004); d.normalize();
    const r = hitscan(o.clone().addScaledVector(d, 2), d, 700), p = o.clone().addScaledVector(d, r.t + 2); if (R() < .5) fxTracer(o, p, 1.3, byPlayer); sfxShot('mg42', o, byPlayer);
    for (const g of KAS.guns) if (g.alive && g.pos.distanceTo(p) < 3) g.damage(1.5, byPlayer); if (r.type === 'terrain' || r.type === 'solid') fxImpact(p, 'dirt');
  }
  // colpo perforante: faccia colpita, inclinazione, perforazione o rimbalzo
  hit(p, dir, sh) {
    if (!this.alive) return;
    this.g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.g.matrixWorld).invert(), lp = p.clone().applyMatrix4(inv), ld = dir.clone().transformDirection(inv).negate();   // ld: dal carro verso chi spara
    const T = this.T, onTurret = lp.y > T.hullH;
    let face, armor, cosA;
    if (onTurret) { const tl = ld.clone().applyAxisAngle(new V3(0, 1, 0), -this.tyaw); const front = tl.z < 0 && Math.abs(tl.z) > Math.abs(tl.x); armor = front ? T.t : T.ts; cosA = Math.max(.25, Math.hypot(front ? tl.z : tl.x, 0) / Math.max(.01, tl.length())); face = front ? 'torretta frontale' : 'torretta laterale'; }
    else if (Math.abs(ld.z) > Math.abs(ld.x) * .9) { const front = ld.z < 0; armor = front ? T.f : T.r; cosA = Math.max(.25, Math.abs(ld.z) / ld.length()); face = front ? 'fronte' : 'retro'; }
    else { armor = T.s; cosA = Math.max(.25, Math.abs(ld.x) / ld.length()); face = 'fianco'; }
    if (sh.he) { fxExplosion(p, 1.4, false); sfxBoom(p, 1); this.hp -= 4; if (!onTurret && R() < .25) { this.immob = true; if (sh.owner && sh.owner.player) showMsg('Esplosivo: cingolo spezzato!', 1.4); } if (this.player) P.shake += .7; if (this.hp <= 0) this.destroy(sh.owner && sh.owner.player, false); return; }
    const dist = sh.travel, pen = sh.T.pen * Math.max(.45, 1 - dist / 3500) * rnd(.9, 1.1), eff = armor / cosA;
    const byP = sh.owner && sh.owner.player, mine = this.player;
    if (cosA < .34 && R() < .7 || pen < eff) {   // rimbalzo
      play('ricochet', p, { vol: 1, rate: rnd(.8, 1.1) }); play('clang', mine ? null : p, { vol: mine ? 1.2 : 1, ref: 40 }); fxImpact(p, 'metal', dir); this.hp -= 2;
      if (byP) showMsg('Rimbalzo! (' + face + ', ' + Math.round(eff) + ' mm)', 1.4); if (mine) { showMsg('Colpo rimbalzato sul ' + face, 1.2); P.shake += .5; }
      return;
    }
    const dmg = rnd(30, 60) * (sh.T.cal / 75) * (onTurret ? 1.1 : 1); this.hp -= dmg;
    fxImpact(p, 'metal', dir); for (let i = 0; i < 12; i++) PS_FIRE.emit(p.x, p.y, p.z, rnd(-4, 4), rnd(0, 4), rnd(-4, 4), .05, .3, .5, 1, 3.5, 2.2, 1);
    sfxBoom(p, .8); play('clang', mine ? null : p, { vol: mine ? 1.5 : 1, rate: .7, ref: 40 });
    let crit = '';
    if (!onTurret && face !== 'fronte' && R() < .3) { this.immob = true; crit = 'cingolo spezzato'; }
    else if (onTurret && R() < .25) { this.jam = true; crit = 'torretta bloccata'; }
    if (R() < (face === 'fianco' ? .16 : .08)) { this.hp = -1; crit = 'munizioni esplose'; }
    if (byP) { hitMarker(this.hp <= 0, false); showMsg('Perforato! ' + face + (crit ? ' — ' + crit : ''), 1.6); }
    if (mine) { P.shake += 1; P.hurt = Math.min(1, (P.hurt || 0) + .4); showMsg('Siamo stati colpiti! ' + (crit || face), 1.8); }
    if (this.hp <= 0) this.destroy(byP, crit === 'munizioni esplose');
  }
  damage(a, byPlayer) {   // esplosioni e mitragliatrici: poco effetto sulla corazza
    if (!this.alive) return; this.hp -= a * .02; if (this.hp <= 0) this.destroy(byPlayer, false);
  }
  destroy(byPlayer, ammo) {
    if (!this.alive) return; this.alive = false; burnMeshes(this.g);
    const p = this.pos.clone(); p.y += 2; fxExplosion(p, ammo ? 5 : 3, false); sfxBoom(p, ammo ? 4 : 3); fxDebris(p, ammo ? 50 : 30, 3);
    if (ammo) { this.g.remove(this.tg); scene.add(this.tg); this.tg.position.copy(p).add(new V3(rnd(-3, 3), 3, rnd(-3, 3))); this.tg.rotation.set(rnd(-1, 1), rnd(0, 6), rnd(-1, 1)); this.flyT = 1.2; this.flyV = new V3(rnd(-4, 4), 12, rnd(-4, 4)); KAS.fly = KAS.fly || []; KAS.fly.push(this); }
    else { this.tg.rotation.z = rnd(-.2, .2); }
    const e = addEmitter(p, 'fire', 1.4); e.life = 150; addEmitter(p.clone().add(new V3(0, 2, 0)), 'smoke', 1.6).life = 220;
    if (this.eng) this.eng.at(this.pos, 0, 0, 1); if (this.trk) this.trk.at(this.pos, 0, 0, 1); if (this.tur) this.tur.set(0);
    if (byPlayer) { STATS.kills += 5; KAS.killed++; feed(this.name + ' distrutto!'); }
    else if (this.team === 'E') { KAS.killed += 0; feed(this.name + ' nemico distrutto'); }
    else if (!this.player) feed(this.name + ' alleato perduto');
    if (this.player) kasPlayerKilled();
  }
  update(dt) {
    if (!this.alive) return;
    this.reload -= dt; this.mgT -= dt; this.kick = Math.max(0, (this.kick || 0) - dt * 3);
    if (this.player) this.drive(dt); else this.think(dt);
    if (this.immob) this.speed = lerp(this.speed, 0, dt * 3);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.pos.x += fx * this.speed * dt; this.pos.z += fz * this.speed * dt; this.odo = (this.odo || 0) + Math.abs(this.speed) * dt; if (this.odo > 1.2) { this.odo = 0; kasTrackMark(this); }
    const tk = this.pos.clone(); tk.y += 1.25; pushOut(tk, 2.6, 1.4); this.pos.x = tk.x; this.pos.z = tk.z;
    for (const o of KAS.tanks) if (o !== this && (o.alive || true)) { const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 5.5 && d > .01) { this.pos.x += dx / d * (5.5 - d) * .5; this.pos.z += dz / d * (5.5 - d) * .5; } }
    this.pos.x = clamp(this.pos.x, -620, 620); this.pos.z = clamp(this.pos.z, -1300, 380);
    const h = this.T.half, yf = Hf(this.pos.x + fx * h[1] * .8, this.pos.z + fz * h[1] * .8), yb = Hf(this.pos.x - fx * h[1] * .8, this.pos.z - fz * h[1] * .8);
    const yl = Hf(this.pos.x - fz * h[0], this.pos.z + fx * h[0]), yr = Hf(this.pos.x + fz * h[0], this.pos.z - fx * h[0]);
    this.pos.y = (yf + yb + yl + yr) / 4;
    this.g.rotation.set(Math.atan2(yf - yb, h[1] * 1.6) - this.kick * .03, this.yaw, Math.atan2(yl - yr, h[0] * 2), 'YXZ');
    this.tg.rotation.y = this.tyaw; this.gg.rotation.x = this.gpitch;
    this.box.min.set(this.pos.x - h[0] - .4, this.pos.y, this.pos.z - h[0] - .4); this.box.max.set(this.pos.x + h[0] + .4, this.pos.y + this.T.hullH + 1, this.pos.z + h[0] + .4);
    const sp = Math.abs(this.speed) / this.T.vmax;
    if (this.eng) this.player ? this.eng.set(.55 + sp * .35, 0, .75 + sp * .55 + (KEYS.KeyW || KEYS.KeyS ? .12 : 0), 2500) : this.eng.at(this.pos, .55 + sp * .4, .75 + sp * .5, 170);
    if (this.trk) this.player ? this.trk.set(sp * .7, 0, .6 + sp * .9, 4000) : this.trk.at(this.pos, sp * .8, .6 + sp * .9, 90);
    if (this.player) { if (!this.tur) this.tur = loopSound('turret', 0); const tv = Math.abs(angDiff(this.tyaw, this.tyawPrev ?? this.tyaw)) / Math.max(dt, 1e-3); this.tyawPrev = this.tyaw; if (this.tur) this.tur.set(clamp(tv * .6, 0, .35), 0, .8 + tv * .5); if (this.reload <= 0 && this.reloadPrev > 0) play('reload_clank', null, { vol: .9 }); this.reloadPrev = this.reload; }
    if (Math.abs(this.speed) > 1 && R() < dt * 9) PS_SMOKE.emit(this.pos.x + rnd(-1.8, 1.8) - fx * 3, this.pos.y + .3, this.pos.z + rnd(-1.8, 1.8) - fz * 3, 0, .7, 0, 2.2, .9, 3.5, .7, .82, .74, .6, 1);   // polvere del deserto
  }
  // IA: verso la posizione da conquistare (o da difendere), ingaggio del nemico visibile più minaccioso
  think(dt) {
    this.aiT -= dt;
    if (this.aiT <= 0) {
      this.aiT = .6;
      let best = null, bs = 1e9;
      for (const o of KAS.tanks) { if (!o.alive || o.team === this.team) continue; const d = o.pos.distanceTo(this.pos); if (d > 1400) continue; if (!kasLOS(this.pos, o.pos)) continue; const s = d * (o.player ? .8 : 1) * (o.type === 'tiger' ? .85 : 1); if (s < bs) { bs = s; best = o; } }
      if (this.team === 'A') for (const gp of KAS.guns) { if (!gp.alive) continue; const d = gp.pos.distanceTo(this.pos); if (d < 900 && d * 1.2 < bs && kasLOS(this.pos, gp.pos)) { bs = d * 1.2; best = gp; } }
      if (best !== this.target) this.err.set(rnd(-1, 1), rnd(-.5, .5), rnd(-1, 1)).multiplyScalar(this.team === 'E' ? 4.5 : 3);
      this.target = best;
    }
    // movimento
    const cp = KAS_PTS[Math.min(KAS.stage, 2)], hold = this.team === 'E' && this.defend, goal = hold ? this.defend : new V3(cp.x, 0, cp.z).add(this.goalOff);
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz), tdist = this.target ? this.target.pos.distanceTo(this.pos) : 1e9;
    let want = 0;
    if (d > 12) { want = this.T.vmax * .75; if (this.target && tdist < 1000) want *= this.type === 'tiger' ? 0 : .35; this.yaw = angLerp(this.yaw, Math.atan2(-dx, -dz), dt * .5); }
    this.speed = lerp(this.speed, want, dt * .6);
    // tiro: anticipo sul bersaglio in moto e alzo balistico
    if (this.target) {
      const t = this.target, tp = t.pos.clone(); tp.y += t.tank ? (this.team === 'A' && t.type !== 'tiger' ? t.T.hullH + .5 : 1.4) : .8;   // gli Sherman mirano alla torretta, più sottile della piastra frontale
      const tof = tp.distanceTo(this.pos) / this.T.v; if (t.speed) tp.addScaledVector(new V3(-Math.sin(t.yaw), 0, -Math.cos(t.yaw)), t.speed * tof * .8);
      tp.add(this.err.clone().multiplyScalar(Math.min(1, tdist / 600)));
      this.err.multiplyScalar(1 - dt * (this.team === 'A' ? .3 : .16));   // la mira si affina tenendo il bersaglio
      const rel = Math.atan2(-(tp.x - this.pos.x), -(tp.z - this.pos.z)) - this.yaw;
      if (!this.jam) this.tyaw = angLerpMax(this.tyaw, rel, dt * this.T.trav);
      const hd = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z), mz = this.muzzle(new V3()), want = Math.atan2(tp.y - mz.y, hd) + .5 * Math.asin(clamp(9.8 * hd / (this.T.v * this.T.v), -1, 1));
      this.gpitch += clamp(want - this.gpitch, -dt * this.T.elev, dt * this.T.elev);
      if (Math.abs(angDiff(this.tyaw, rel)) < .012 && Math.abs(this.speed) < 3.5 && tdist < 1300) this.fireMain(false);
    } else if (!this.jam) this.tyaw = angLerpMax(this.tyaw, 0, dt * this.T.trav * .5);
  }
  drive(dt) {
    const th = (KEYS.KeyW ? 1 : 0) - (KEYS.KeyS ? 1 : 0), st = (KEYS.KeyA ? 1 : 0) - (KEYS.KeyD ? 1 : 0);
    if (!this.immob) { this.speed = lerp(this.speed, th * (th > 0 ? this.T.vmax : 4), dt * (th ? .6 : 1.4)); this.yaw += st * dt * .5 * (this.speed < 0 ? -1 : 1) * (Math.abs(this.speed) > .5 || th ? 1 : .7); }
    if (this.jam) this.ayaw = this.tyaw;
    if (mouseL) this.fireMain(true);
    if (KEYS.KeyF || KEYS.Space) this.fireMG(true);
  }
  remove() { scene.remove(this.g); if (this.eng) this.eng.at(this.pos, 0, 0, 1); }
}
// cannone anticarro Pak 40: statico, brandeggio limitato, si nasconde bene
class KasGun {
  constructor(x, z, yaw) {
    const G = kasPakGeo(); this.g = groupMesh(G.base); this.gg = groupMesh(G.gun); this.gg.position.set(0, 1.05, -.2); this.g.add(this.gg); scene.add(this.g);
    this.pos = this.g.position; this.pos.set(x, Hf(x, z), z); this.yaw = yaw; this.g.rotation.y = yaw; this.alive = true; this.hp = 20; this.reload = rnd(2, 6); this.team = 'E'; this.type = 'pak'; this.name = 'Pak 40'; this.aim = 0; this.el = 0;
    this.box = { min: new V3(x - 1.6, this.pos.y, z - 1.6), max: new V3(x + 1.6, this.pos.y + 1.8, z + 1.6) }; this.T = { pen: 135, v: 790, cal: 75, reload: 5 };
    MISSION.vehicles.push(this); KAS.guns.push(this);
  }
  hit(p, dir, sh) { if (sh.he) explode(p, 7, 260, { byPlayer: !!(sh.owner && sh.owner.player), bomb: true }); this.damage(60, sh.owner && sh.owner.player); }
  damage(a, byPlayer) { if (!this.alive) return; this.hp -= a; if (this.hp > 0) return; this.alive = false; burnMeshes(this.g); this.gg.rotation.x = -.4; fxExplosion(this.pos.clone().add(new V3(0, 1, 0)), 2, false); sfxBoom(this.pos, 2); if (byPlayer) { STATS.kills += 2; feed('Pak 40 distrutto'); } }
  update(dt) {
    if (!this.alive) return; this.reload -= dt;
    let best = null, bd = 1100; for (const o of KAS.tanks) if (o.alive && o.team === 'A') { const d = o.pos.distanceTo(this.pos); if (d < bd && kasLOS(this.pos, o.pos)) { bd = d; best = o; } }
    if (!best) return;
    const tp = best.pos.clone(); tp.y += 1.3; const rel = angDiff(Math.atan2(-(tp.x - this.pos.x), -(tp.z - this.pos.z)), this.yaw);
    if (Math.abs(rel) > 1.1) return;   // fuori dal settore di tiro
    this.aim = lerp(this.aim, rel, dt * .8); this.gg.rotation.y = this.aim;
    const hd = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z); this.el = Math.atan2(tp.y - this.pos.y - 1, hd) + .5 * Math.asin(clamp(9.8 * hd / (790 * 790), -1, 1)); this.gg.rotation.x = this.el;
    if (this.reload <= 0 && Math.abs(this.aim - rel) < .02) {
      this.reload = rnd(5, 8); this.g.updateMatrixWorld(true);
      const o = new V3(0, 0, -3.3).applyMatrix4(this.gg.matrixWorld), d = new V3(0, 0, -1).transformDirection(this.gg.matrixWorld); d.x += rnd(-.004, .004); d.y += rnd(-.002, .003); d.normalize();
      kasShell(o, d, this.T, this); PS_FIRE.emit(o.x, o.y, o.z, d.x * 6, d.y * 6, d.z * 6, .2, 2, 3.5, 1, 4, 2.5, 1.2); for (let i = 0; i < 10; i++) PS_GRAIN.emit(this.pos.x + rnd(-3, 3), this.pos.y + .2, this.pos.z + rnd(-3, 3), rnd(-3, 3), rnd(1, 3), rnd(-3, 3), .8, .05, .05, .6, ...C_DIRT, .4, 9.8); sfxBoom(o, 1.3);
    }
  }
}
// linea di vista: il terreno non deve coprire la congiungente fra le torrette
function kasLOS(a, b) { const n = 10; for (let i = 1; i < n; i++) { const t = i / n, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t), y = lerp(a.y + 2.2, b.y + 1.6, t); if (Hf(x, z) > y) return false; } return true; }
// ---------- solchi dei cingoli sulla sabbia ----------
const KAS_TRK = { mesh: null, n: 0, max: 2400, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler() };
function kasTrackMark(t) {
  if (!KAS_TRK.mesh) { const g = new THREE.PlaneGeometry(.55, 1.3).rotateX(-PI / 2); KAS_TRK.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x5a4630, transparent: true, opacity: .32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), KAS_TRK.max); KAS_TRK.mesh.count = 0; KAS_TRK.mesh.frustumCulled = false; KAS_TRK.mesh.renderOrder = 1; scene.add(KAS_TRK.mesh); }
  const w = t.T.half[0] - .15, cx = Math.cos(t.yaw), sx = Math.sin(t.yaw);
  for (const sd of [-1, 1]) { const x = t.pos.x + cx * w * sd, z = t.pos.z - sx * w * sd, y = Hf(x, z) + .04; KAS_TRK.e.set(0, t.yaw, 0); KAS_TRK.q.setFromEuler(KAS_TRK.e); KAS_TRK.m.compose(new V3(x, y, z), KAS_TRK.q, new V3(1, 1, 1)); KAS_TRK.mesh.setMatrixAt(KAS_TRK.n % KAS_TRK.max, KAS_TRK.m); KAS_TRK.n++; }
  KAS_TRK.mesh.count = Math.min(KAS_TRK.n, KAS_TRK.max); KAS_TRK.mesh.instanceMatrix.needsUpdate = true;
}
// ---------- proiettili ----------
const KAS_SHELL_G = new THREE.CylinderGeometry(.06, .06, 1, 5).rotateX(PI / 2);
function kasShell(o, d, T, owner) {
  const m = new THREE.Mesh(KAS_SHELL_G, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.2), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.scale.set(1, 1, 6); scene.add(m); KAS.shells.push({ p: o.clone(), v: d.clone().multiplyScalar(T.v), T, owner, m, life: 4, travel: 0, he: !!T.he });
}
function kasUpdateShells(dt) {
  const tmp = new V3();
  for (let i = KAS.shells.length - 1; i >= 0; i--) {
    const s = KAS.shells[i]; s.life -= dt; let hit = false;
    const steps = Math.max(1, Math.ceil(s.v.length() * dt / 2.5)), h = dt / steps;
    for (let k = 0; k < steps && !hit; k++) {
      s.v.y -= 9.8 * h; tmp.copy(s.v).multiplyScalar(h); s.p.add(tmp); s.travel += tmp.length();
      if (s.p.y < Hf(s.p.x, s.p.z)) { hit = true; const p = s.p.clone(); p.y = Hf(p.x, p.z) + .2; if (s.he) { explode(p, 7, 260, { byPlayer: !!(s.owner && s.owner.player), bomb: true }); for (const g of KAS.guns) if (g.alive && g.pos.distanceTo(p) < 8) g.damage(30 * (1 - g.pos.distanceTo(p) / 9), s.owner && s.owner.player); break; } fxImpact(p, 'dirt'); for (let j = 0; j < 16; j++) PS_GRAIN.emit(p.x, p.y, p.z, rnd(-3, 3), rnd(3, 8), rnd(-3, 3), 1, .08, .08, .9, ...C_DIRT, .5, 9.8); PS_SMOKE.emit(p.x, p.y + .5, p.z, 0, 1.5, 0, 3, 1, 3, .7, .8, .72, .58, .9); sfxBoom(p, .6); for (const g of KAS.guns) if (g.alive && g.pos.distanceTo(p) < 3) g.damage(25, s.owner && s.owner.player); break; }
      for (const t of KAS.tanks) {
        if (t === s.owner || !t.alive) continue;
        const dx = s.p.x - t.pos.x, dz = s.p.z - t.pos.z; if (dx * dx + dz * dz > 16) continue;
        t.g.updateMatrixWorld(true); const lp = s.p.clone().applyMatrix4(new THREE.Matrix4().copy(t.g.matrixWorld).invert()), hh = t.T.half;
        if (Math.abs(lp.x) < hh[0] && Math.abs(lp.z) < hh[1] && lp.y > 0 && lp.y < t.T.hullH + 1) { hit = true; t.hit(s.p.clone(), s.v.clone().normalize(), s); break; }
      }
      if (!hit) for (const g of KAS.guns) if (g.alive && g !== s.owner && g.pos.distanceTo(s.p) < 1.6) { hit = true; g.hit(s.p, s.v, s); break; }
    }
    s.m.position.copy(s.p); s.m.lookAt(tmp.copy(s.p).add(s.v));
    if (hit || s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); KAS.shells.splice(i, 1); }
  }
}
// ---------- partita ----------
function kasSpawnWave(stage) {
  const P0 = KAS_PTS[stage], spots = (n, r) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU + rnd(-.3, .3), rr = r * rnd(.3, .9); return [P0.x + Math.cos(a) * rr, P0.z + Math.sin(a) * rr]; });
  const W = [[['pz4', 2]], [['pz4', 3]], [['tiger', 1], ['pz4', 2]]][stage] || [];
  for (const [type, n] of W) for (const [x, z] of spots(n, P0.r * .8)) { const t = new KasTank(type, 'E', x, z, 0); t.defend = new V3(x, 0, z); }
  for (const [x, z] of spots(stage + 1, P0.r * 1.1)) new KasGun(x, z - 20, 0);
  // rinforzi che scendono dal nord e attaccano la posizione
  if (stage >= 1) for (let i = 0; i < stage; i++) { const t = new KasTank(stage === 2 && i === 0 ? 'tiger' : 'pz4', 'E', P0.x + rnd(-80, 80), P0.z - 260 - i * 30, 0); t.defend = null; }
}
function kasCounterattack() {
  const C = KAS_PTS[2];
  for (let i = 0; i < 4; i++) { const t = new KasTank(i < 2 ? 'tiger' : 'pz4', 'E', C.x + (i - 1.5) * 40, -1270 - i * 15, 0); t.defend = new V3(C.x + (i - 1.5) * 25, 0, C.z); }
  say(N.radio, 'Contrattacco! Tigri e Panzer dal passo, tenete la posizione!'); showMsg('CONTRATTACCO TEDESCO — tieni il passo per 2 minuti', 4);
}
function kasSpawnPlayer() {
  const base = KAS.stage === 0 ? new V3(kasRoadX(300), 0, 300) : new V3(KAS_PTS[KAS.stage - 1].x, 0, KAS_PTS[KAS.stage - 1].z + 40);
  const me = new KasTank('sherman', 'A', base.x, base.z, 0); me.player = true; TANKS.me = me; P.mode = 'tank'; P.dead = false;
  me.ayaw = 0; me.apitch = 0; $('stHud').style.display = 'block'; $('tankSight').classList.add('us');
  // alleati: fino a tre Sherman col giocatore
  const al = KAS.tanks.filter(t => t.alive && t.team === 'A' && !t.player).length;
  for (let i = al; i < 3; i++) new KasTank('sherman', 'A', base.x + (i - 1) * 14 + 8, base.z + 18 + i * 6, 0);
}
function kasPlayerKilled() {
  KAS.lives--; KAS.respawnT = 6; TANKS.me = null; $('stHud').style.display = 'none'; $('tankAim').style.display = 'none'; $('tankSight').style.display = 'none';
  if (KAS.lives <= 0) { KAS.over = true; GAME.endTitle = 'LA BRIGATA È STATA RESPINTA'; GAME.endText = `Carri nemici distrutti: ${KAS.killed}<br>Posizioni conquistate: ${KAS.stage} su 3`; after(4, () => GAME.end(false)); showMsg('Tutti i carri perduti', 4); }
  else showMsg('Carro distrutto! L’equipaggio si salva — nuovo Sherman fra 6 secondi (' + KAS.lives + ' rimasti)', 5);
}
function initArmor() {
  KAS.tanks = []; KAS.guns = []; KAS.shells = []; KAS_TRK.mesh = null; KAS_TRK.n = 0; KAS.stage = 0; KAS.lives = D && D.label && /veterano/i.test(D.label) ? 2 : 3; KAS.over = false; KAS.killed = 0; KAS.holdT = 0; KAS.wave = 0; KAS.cap = 0;
  P.inBoat = false; P.boat = null; MISSION.stage = 0; MISSION.stageT = 0;
  MISSION.title = 'Passo di Kasserine — febbraio 1943'; MISSION.objText = 'Conquista la cresta di Djebel Ksaira';
  kasSpawnWave(0); kasSpawnPlayer();
  if (!KAS.el) { KAS.el = document.createElement('div'); KAS.el.id = 'kasHud'; KAS.el.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:18;font:600 15px/1.35 Oswald,sans-serif;color:#efe6cf;text-align:center;text-shadow:0 1px 3px #000;background:rgba(10,12,10,.55);padding:6px 16px;border-radius:3px;min-width:320px'; document.body.appendChild(KAS.el); }
  if (!KAS.radar) { KAS.radar = document.createElement('canvas'); KAS.radar.width = KAS.radar.height = 200; KAS.radar.style.cssText = 'position:fixed;left:16px;bottom:16px;width:200px;height:200px;pointer-events:none;z-index:18;border-radius:50%;background:rgba(18,16,10,.55);box-shadow:0 0 0 1px rgba(232,196,106,.35)'; document.body.appendChild(KAS.radar); KAS.rctx = KAS.radar.getContext('2d'); }
  KAS.el.style.display = KAS.radar.style.display = 'block';
  say(N.radio, 'Qui comando di brigata: la valle è vostra. Prendete la cresta, poi Sidi Bou Zid e il passo.');
  showMsg('Sherman — W/S/A/D guida · mouse torretta · click sx cannone · click dx ottica · F mitragliatrice', 6);
}
function updateArmor(dt) {
  MISSION.stageT += dt; updateSubs(dt);
  for (const t of KAS.tanks) t.update(dt); for (const g of KAS.guns) g.update(dt);
  kasUpdateShells(dt);
  if (KAS.fly) for (const t of KAS.fly) if (t.flyT > 0) { t.flyT -= dt; t.flyV.y -= 9.8 * dt; t.tg.position.addScaledVector(t.flyV, dt); t.tg.rotation.x += dt * 2; const gy = Hf(t.tg.position.x, t.tg.position.z); if (t.tg.position.y < gy) { t.tg.position.y = gy; t.flyT = 0; } }
  if ($('mini')) $('mini').style.display = 'none';
  // giocatore distrutto: camera sul relitto e nuovo carro
  if (!TANKS.me && !KAS.over) {
    KAS.respawnT -= dt; const w = KAS.tanks.find(t => t.player); if (w) { const a = GAME.time * .3; camera.position.set(w.pos.x + Math.sin(a) * 18, w.pos.y + 8, w.pos.z + Math.cos(a) * 18); camera.lookAt(w.pos); }
    if (KAS.respawnT <= 0) { if (w) w.player = false; kasSpawnPlayer(); }
  }
  if (KAS.over) return kasHud();
  // conquista della posizione corrente
  if (KAS.stage < 3) {
    const C = KAS_PTS[KAS.stage], inside = t => t.alive && Math.hypot(t.pos.x - C.x, t.pos.z - C.z) < C.r;
    const a = KAS.tanks.filter(t => t.team === 'A' && inside(t)).length, e = KAS.tanks.filter(t => t.team === 'E' && inside(t)).length + KAS.guns.filter(g => g.alive && Math.hypot(g.pos.x - C.x, g.pos.z - C.z) < C.r).length;
    if (a && !e) KAS.cap = Math.min(1, KAS.cap + dt / 18); else if (e && !a) KAS.cap = Math.max(0, KAS.cap - dt / 30);
    KAS.contested = a && e;
    if (C.flag) C.flag.material.color.setHex(KAS.cap > .5 ? 0x3050b0 : 0xb02020);
    if (KAS.cap >= 1) {
      KAS.stage++; KAS.cap = 0; KAS.lives = Math.min(KAS.lives + 1, 4);
      if (KAS.stage < 3) { kasSpawnWave(KAS.stage); MISSION.objText = 'Conquista ' + KAS_PTS[KAS.stage].name; showMsg(C.name + ' conquistata! Avanti verso ' + KAS_PTS[KAS.stage].name, 5); say(N.radio, 'Ottimo lavoro. Prossimo obiettivo: ' + KAS_PTS[KAS.stage].name + '.'); for (let i = KAS.tanks.filter(t => t.alive && t.team === 'A' && !t.player).length; i < 3; i++) new KasTank('sherman', 'A', C.x + rnd(-20, 20), C.z + 120, 0); }
      else { KAS.holdT = 120; kasCounterattack(); MISSION.objText = 'Tieni il passo'; }
    }
  } else {
    KAS.holdT -= dt; const foes = KAS.tanks.filter(t => t.alive && t.team === 'E').length;
    if (KAS.holdT <= 0 || foes === 0) { KAS.over = true; GAME.endTitle = 'IL PASSO È NOSTRO'; GAME.endText = `Carri nemici distrutti da te: ${KAS.killed}<br>Carri di riserva rimasti: ${KAS.lives}`; after(4, () => GAME.end(true)); say(N.radio, 'Il passo è nostro! Splendido lavoro, comandante.'); }
  }
  kasHud();
}
function kasHud() {
  if (!KAS.el) return;
  const st = Math.min(KAS.stage, 2), C = KAS_PTS[st], me = TANKS.me;
  const dist = me ? Math.round(Math.hypot(me.pos.x - C.x, me.pos.z - C.z)) : 0;
  const foes = KAS.tanks.filter(t => t.alive && t.team === 'E').length, guns = KAS.guns.filter(g => g.alive).length;
  KAS.el.innerHTML = KAS.stage < 3 ? `OBIETTIVO ${KAS.stage + 1}/3 · ${C.name.toUpperCase()} · ${dist} m<div style="height:6px;margin:5px 0 3px;background:rgba(255,255,255,.12)"><div style="height:100%;width:${Math.round(KAS.cap * 100)}%;background:${KAS.contested ? '#d9b443' : '#6aa0e8'}"></div></div><span style="font-size:12px">carri nemici ${foes} · Pak ${guns} · carri di riserva ${KAS.lives} · distrutti ${KAS.killed}</span>`
    : `TIENI IL PASSO · ${Math.max(0, Math.ceil(KAS.holdT))} s<br><span style="font-size:12px">carri nemici ${foes} · carri di riserva ${KAS.lives} · distrutti ${KAS.killed}</span>`;
  // radar: carri e cannoni attorno al proprio, ruotato sulla torretta
  const x = KAS.rctx; if (!x) return; x.clearRect(0, 0, 200, 200);
  const c = me || KAS.tanks.find(t => t.player) || { pos: new V3(), yaw: 0, tyaw: 0 }, yaw = c.yaw + (c.tyaw || 0), S = 100 / 900, co = Math.cos(yaw), si = Math.sin(yaw);
  const pt = (px, pz) => { const dx = px - c.pos.x, dz = pz - c.pos.z; return [100 + (dx * co - dz * si) * S, 100 + (dx * si + dz * co) * S]; };
  x.strokeStyle = 'rgba(232,196,106,.25)'; for (const r of [33, 66, 99]) { x.beginPath(); x.arc(100, 100, r, 0, TAU); x.stroke(); }
  for (const p of KAS_PTS) { const [a, b] = pt(p.x, p.z); x.strokeStyle = p === KAS_PTS[st] ? '#e8c46a' : 'rgba(232,196,106,.4)'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, p.r * S, 0, TAU); x.stroke(); }
  for (const t of KAS.tanks) { if (!t.alive) continue; const [a, b] = pt(t.pos.x, t.pos.z); if (Math.hypot(a - 100, b - 100) > 98) continue; x.fillStyle = t.player ? '#ffffff' : t.team === 'A' ? '#6aa0e8' : '#e05a4a'; x.save(); x.translate(a, b); x.rotate(t.yaw - yaw); x.fillRect(-3, -5, 6, 10); x.restore(); }
  for (const g of KAS.guns) { if (!g.alive || !g.spotted) continue; const [a, b] = pt(g.pos.x, g.pos.z); x.fillStyle = '#e05a4a'; x.beginPath(); x.arc(a, b, 3, 0, TAU); x.fill(); }
  x.fillStyle = '#e8c46a'; x.beginPath(); x.moveTo(100, 88); x.lineTo(95, 98); x.lineTo(105, 98); x.fill();
  // i Pak si vedono sul radar solo quando sparano o sono vicini
  for (const g of KAS.guns) if (g.alive && (g.reload > 4.5 || (me && g.pos.distanceTo(me.pos) < 250))) g.spotted = true;
}
