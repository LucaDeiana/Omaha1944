"use strict";
// ============================================================
//  AAA Graphics Test — «Normandy Village — Photorealism Test».
//  Modalità separata (SCEN 'aaa'): mondo, luci, preset e strumenti propri. Le mappe del gioco non cambiano.
//  Pianta (coordinate locali u = x, v = z + 100):
//   strada principale fangosa est-ovest (v ≈ 6), viottolo verso nord (u ≈ 13), incrocio con il calvario;
//   A casa normanna a due piani (interno: cucina con camino, stanza con la scala, camera al primo piano);
//   B fienile (pietra e tavole) sul cortile; C piccola casa intonacata a sud della strada; D officina di mattoni;
//   cortile murato con cancello, frutteto, bocage sugli argini, Sherman parcheggiato accanto al muro.
// ============================================================
const AAA_DEFS = () => {
  const B = (u, v) => [AV.cx + u, AV.cz + v];
  return {
    A: { id: 'aaa_casa', u: -14, v: -7, w: 11.5, d: 8, storeys: 2, sh: 3.05, wall: 'pietra', rubble: true, wallCol: 0xc0b49c, band: true, seed: 11,
      roof: { type: 'gable', tile: 'tile', pitch: .86, cols: [0x9a5a42, 0x8e5038, 0xa66448, 0x844a36, 0x9c624a], moss: .7, ov: .45, chimneys: [[-5.3, 0], [5.3, 0]] },
      style: { frame: 0xdcd6c8, shutter: 0x5f7a86, door: 0x4a5a64, lintel: 'stone', shutters: true } },
    C: { id: 'aaa_casetta', u: 31, v: 17.5, w: 7.6, d: 6.4, storeys: 1, sh: 3.3, wall: 'intonaco', wallCol: 0xe8dcc0, quoins: true, seed: 23,
      roof: { type: 'hip', tile: 'slate', pitch: .78, cols: [0x4e545c, 0x585e66, 0x464c54, 0x5c6066], moss: .35, ov: .35, chimneys: [[1.4, 0]] },
      style: { frame: 0xe8e4da, shutter: 0x8a8678, door: 0x6a3a2a, lintel: 'wood', shutters: true } },
    B: { id: 'aaa_fienile', u: 37, v: -29, w: 15, d: 8.6, storeys: 1, sh: 5.1, wall: 'pietra', rubble: true, seed: 31, wallCol: 0xb4aa94,
      roof: { type: 'gable', tile: 'slate', pitch: .72, cols: [0x4a4e52, 0x55585c, 0x5e5e5a, 0x444848], moss: 1, ov: .5, chimneys: [], gutter: false },
      style: { frame: 0x5a4a38, shutter: 0x4a3a2a, door: 0x5a4632, lintel: 'wood', shutters: false } },
    D: { id: 'aaa_officina', u: 51, v: -7, w: 6.2, d: 7.6, storeys: 1, sh: 3.1, wall: 'mattoni', seed: 41, along: 'z',
      roof: { type: 'gable', tile: 'tile', pitch: .62, cols: [0x8a4434, 0x7a3c2e, 0x96503c], moss: .8, ov: .35, chimneys: [[2.4, 0]] },
      style: { frame: 0x3a3a34, shutter: 0x3a3a34, door: 0x2e3a2e, lintel: 'wood', shutters: false } },
  };
};
// aie piane sotto gli edifici (prima del terreno: l'altimetria le usa)
function aaaPads() {
  AV.pads.length = 0; const D = AAA_DEFS();
  for (const k in D) { const d = D[k]; let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, aaaH(AV.cx + d.u + a * d.w / 2, AV.cz + d.v + b * d.d / 2)); AV.pads.push({ x0: d.u - d.w / 2 - .6, x1: d.u + d.w / 2 + .6, z0: d.v - d.d / 2 - .6, z1: d.v + d.d / 2 + .6, y: lo + .05 }); d.base = lo + .2; }
  AAA.defs = D;
  if (typeof v2Pads === 'function' && V2.on) v2Pads();   // villaggio esteso 2.0
}
function aaaBuildWorld() {
  AAA.extras = []; AAA.plants = []; const t0 = performance.now(); AAA.on = true; AAA.st = { hq: AAA.st.hq, assetMs: AAA.st.assetMs, models: AAA.st.models, texHQ: AAA.st.texHQ }; AAA.rooms.length = 0; AAA.objs.length = 0;
  for (let i = 0; i < 8; i++) { AAA_IN_MIN[i].set(1e5, 1e5, 1e5); AAA_IN_MAX[i].set(-1e5, -1e5, -1e5); }
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  aaaPads(); buildHF(); buildHC(); buildWater(); if (WORLD.waterMesh) WORLD.waterMesh.visible = false;
  aaaMats(); aaaBuildTerrain(); aaaPuddles(); aaaRocks();
  const D = AAA.defs, W = (d) => Object.assign({ x: AV.cx + d.u, z: AV.cz + d.v }, d);
  // A — casa principale: facciata a sud sulla strada, due stanze, scala, primo piano
  const A = W(D.A), ax = A.x, az = A.z, fy = .95, uy = A.sh + .85;
  A.faces = {
    '+z': [{ kind: 'win', c: ax - 3.7, y: fy, w: .95, h: 1.3 }, { kind: 'door', c: ax + .5, y: 0, w: 1.1, h: 2.2, open: true }, { kind: 'win', c: ax + 3.6, y: fy, w: .95, h: 1.3 }, { kind: 'win', c: ax - 3.7, y: uy, w: .9, h: 1.2 }, { kind: 'win', c: ax + .5, y: uy, w: .9, h: 1.2 }, { kind: 'win', c: ax + 3.6, y: uy, w: .9, h: 1.2 }],
    '-z': [{ kind: 'win', c: ax - 2.6, y: fy, w: .9, h: 1.2 }, { kind: 'door', c: ax + 2.9, y: 0, w: 1.0, h: 2.1, open: true }, { kind: 'win', c: ax - 2.6, y: uy, w: .8, h: 1.1, noShut: true }],
    '+x': [{ kind: 'win', c: az + .4, y: fy, w: .9, h: 1.25 }, { kind: 'win', c: az + .4, y: uy, w: .8, h: 1.1 }],
    '-x': [{ kind: 'win', c: az - 1.6, y: uy, w: .6, h: .9, noShut: true }],
  };
  const bA = aaaBuilding(A); aaaInteriorA(A, bA);
  // C — piccola casa intonacata, facciata a nord sulla strada
  const C = W(D.C), cx = C.x, cz = C.z;
  C.faces = { '-z': [{ kind: 'win', c: cx - 2.1, y: .9, w: 1, h: 1.45 }, { kind: 'door', c: cx + .4, y: 0, w: 1.05, h: 2.15 }, { kind: 'win', c: cx + 2.5, y: .9, w: 1, h: 1.45 }], '+z': [{ kind: 'win', c: cx - 1.5, y: .9, w: .9, h: 1.3 }], '+x': [{ kind: 'win', c: cz, y: .9, w: .9, h: 1.3 }], '-x': [] };
  const bC = aaaBuilding(C);
  // B — fienile: zoccolo e muri in pietra, tavolato nella parte alta, portone grande sul cortile
  const Bd = W(D.B), bx = Bd.x, bz = Bd.z;
  Bd.faces = { '+z': [{ kind: 'door', c: bx - 1.5, y: 0, w: 3.6, h: 3.7, open: true, barn: true }, { kind: 'win', c: bx + 4.5, y: 2.4, w: .7, h: .7 }, { kind: 'win', c: bx - 5.6, y: 2.4, w: .7, h: .7 }], '-z': [{ kind: 'win', c: bx + 2, y: 2.6, w: .6, h: .6 }], '+x': [{ kind: 'door', c: bz + 1, y: 0, w: 1.3, h: 2.3, open: true }], '-x': [] };
  const bB = aaaBuilding(Bd); aaaBarnDetails(Bd, bB);
  // D — officina di mattoni, apertura larga sul cortile (a ovest)
  const Dd = W(D.D), dx = Dd.x, dz = Dd.z;
  Dd.faces = { '-x': [{ kind: 'door', c: dz - .6, y: 0, w: 2.6, h: 2.6, open: true }, { kind: 'win', c: dz + 2.6, y: 1, w: 1, h: 1.1 }], '+z': [{ kind: 'win', c: dx, y: 1, w: 1.2, h: 1.1 }], '-z': [], '+x': [] };
  const bD = aaaBuilding(Dd); aaaWorkshopDetails(Dd, bD);
  // muri, cancelli, oggetti
  const G = new AGeo(), U = (u, v) => [AV.cx + u, AV.cz + v];
  apDryWall(G, ...U(-21, -2.2), ...U(-7, -2.2), .95, 5, [6.2, 8.4]); apGatePillar(G, ...U(-14.8, -2.2), 1.3); apGatePillar(G, ...U(-12.6, -2.2), 1.3);
  apDryWall(G, ...U(27, -24.5), ...U(27, -4), 1.5, 6, [7.5, 11]); apGatePillar(G, ...U(27, -17), 1.9); apGatePillar(G, ...U(27, -13.5), 1.9); apGate(G, ...U(27, -17), -PI / 2, 3.3, 1.2);
  apDryWall(G, ...U(27, -3.6), ...U(47.5, -3.6), 1.4, 7, [9, 13]);
  apDryWall(G, ...U(-5, 13.2), ...U(9, 13.2), 1.2, 8);
  // cortile: carro, botti, legnaia, secchi, bidoni, attrezzi, balle di fieno
  const HQ = !!AAA.st.hq; apCart(G, ...U(41, -12), 2.4); apFirewood(G, ...U(30.5, -22.8), 0, 3.2, 1.1); if (!HQ) { apBarrel(G, ...U(46, -11), 0); apBarrel(G, ...U(46.7, -11.8), 1); apBarrel(G, ...U(45.6, -12.4), 0, true); }
  if (!HQ) apBucket(G, ...U(33.5, -9)); apChurn(G, ...U(44.6, -3.9 - .6)); apChurn(G, ...U(45.1, -4.5)); apTool(G, ...U(28.2, -20), PI / 2, 'fork', .3); apTool(G, ...U(28.2, -20.6), PI / 2, 'spade', .28);
  apHay(G, ...U(32, -24.2), .1); apHay(G, ...U(33.1, -24.3), -.05); { const [hx, hz] = U(32.5, -24.2); apHay(G, hx, hz, .02, aaaH(hx, hz) + .5); }
  // casa A: botte, panca, secchio, cesta di legna vicino alla porta; ruota appoggiata al muro
  if (!HQ) { apBarrel(G, ...U(-9.2, -1.6), 0); apBucket(G, ...U(-12, -2.7)); } apFirewood(G, ...U(-19.2, -1.2), .02, 1.4, .7);
  { const [wx, wz] = U(-17.6, -2.75), y = aaaH(wx, wz); G.add(AAA.mats.woodDark, new THREE.TorusGeometry(.62, .05, 6, 22), wx, y + .64, wz, 0, 0, -.12); for (let sp = 0; sp < 12; sp++) G.add(AAA.mats.woodDark, ABX.box, wx, y + .64, wz, 0, 0, sp / 12 * PI, .035, 1.2, .035); }
  // Sherman parcheggiato sul ciglio sud, sacchi a terra e casse accanto; casse militari e taniche
  const sh = U(2.5, 10.4); apSherman(sh[0], sh[1], -PI / 2 + .06);
  apSandbags(G, ...U(-3.5, 12.6), ...U(-.5, 12.6), 3); if (!HQ) apCrate(G, ...U(8.6, 12.2), .2, .9, .55, .6, true); apCrate(G, ...U(9.4, 12.5), -.3, .8, .5, .5, true); if (!HQ) { const [cx2, cz2] = U(8.8, 12.3); apCrate(G, cx2, cz2, .05, .8, .45, .5, true, aaaH(cx2, cz2) + .55); apJerry(G, ...U(7.6, 12.6), .3); apJerry(G, ...U(7.9, 12.75), .5); }
  // incrocio: calvario, cartello
  apCalvary(G, ...U(20.5, 12)); apSign(G, ...U(17.8, 1.4), -.3, 'VIERVILLE 3 KM');
  // recinzioni dei campi a sud
  apFence(G, [U(-6, 17.5), U(-6, 40), U(4, 60)], 9);
  G.build(); aaaPlaceModels(); if (typeof pipeVillage === 'function') pipeVillage();
  if (typeof v2Build === 'function' && V2.on) { v2Build(); AAA.st.v2 = V2.stats; }   // villaggio esteso 2.0 (centro storico, residenziale, fattoria, zona militare, periferia)
  // vegetazione: bocage, querce, frutteto, alberi lungo il viottolo, erba, fiori, edera
  const tOak = aaaTreeTemplate('oak', 7), tApple = aaaTreeTemplate('apple', 9), tBush = aaaTreeTemplate('bush', 13);
  const oaks = aaaBocage(tBush, tOak).concat([[...U(22, -1.5), 1.15, .4], [...U(-34, -6), 1.05, 2.1], [...U(6, -42), .95, 1], [...U(-2, 28), 1.1, 3], [...U(60, 6), 1, 4]]);
  aaaPlantInstances(tOak, oaks.map(o => [o[0], o[1], o[2], o[3]]));
  const apples = []; { const sr = seeded(5); for (let i = 0; i < 9; i++) apples.push([...U(-30 + (i % 3) * 8 + (sr() - .5) * 2.5, -19 - Math.floor(i / 3) * 8 + (sr() - .5) * 2.5), .85 + sr() * .35, sr() * 6]); }
  aaaPlantInstances(tApple, apples); if (typeof aaaFallenLeaves === 'function') aaaFallenLeaves(oaks.concat(apples));
  AAA.noGrass = (u, v) => (typeof V2 !== 'undefined' && V2.on && (v2RoadD(u, v) < .4 || v2PlazaD(u, v) < .6)) || AV.pads.some(p => u > p.x0 - .3 && u < p.x1 + .3 && v > p.z0 - .3 && v < p.z1 + .3) || (u > 26 && u < 52 && v > -24 && v < -4) || Math.abs(v - avRoadV(u)) < 2.8;
  aaaGrass(); aaaFlowers();
  aaaIvy(bA.faces['+z'], ax - 5.8, ax - 1.6, A.base + 5.4, A.base, 101, 1); aaaIvy(bA.faces['-x'], az - 3.5, az + 3.5, A.base + 3.5, A.base, 102, .7);
  aaaIvy(bB.faces['+z'], bx + 3, bx + 7.5, Bd.base + 2.8, Bd.base, 103, .8); aaaIvy({ axis: 'z', fixed: AV.cx + 27, out: -1 }, AV.cz - 9, AV.cz - 4.5, aaaH(AV.cx + 27, AV.cz - 6) + 1.5, aaaH(AV.cx + 27, AV.cz - 6) - .1, 104, .9);
  aaaChurch(); aaaChunkAll();
  AAA.st.buildMs = Math.round(performance.now() - t0);
}
// chiesa lontana (silhouette per la composizione, a nord-ovest, fuori dalla zona esplorabile)
function aaaChurch() {
  if (typeof V2 !== 'undefined' && V2.on) return;   // con il villaggio esteso c'è la chiesa vera nel centro storico
  const G = new AGeo(), M = AAA.mats, x = AV.cx - 95, z = AV.cz - 150, y = aaaOuterH(x, z) - .5;
  G.add(M.stone, ABX.box, x, y + 5, z, 0, .3, 0, 9, 10, 22); G.add(M.stone, ABX.box, x + 1, y + 9, z + 13, 0, .3, 0, 5, 18, 5);
  const sp = new THREE.ConeGeometry(3.4, 11, 8); G.add(M.vc, sp, x + 1, y + 23.5, z + 13, 0, .3 + PI / 8, 0, 1, 1, 1, 0x4e545c);
  const roof = new THREE.CylinderGeometry(0, 6.5, 5, 4, 1); G.add(M.vc, roof, x, y + 12, z, 0, .3 + PI / 4, 0, 1, 1, 3.3, 0x585e66);
  G.build(false);
}
// interno della casa A: pavimenti, tramezzo con porta, travi del solaio, scala, camino, mobili, oggetti
function aaaInteriorA(A, b) {
  const HQ = !!AAA.st.hq;
  const M = AAA.mats, G = new AGeo(), sr = seeded(77), base = A.base, t = .55, x0 = A.x - A.w / 2 + t, x1 = A.x + A.w / 2 - t, z0 = A.z - A.d / 2 + t, z1 = A.z + A.d / 2 - t, fy = base + A.sh, px = A.x - 1.1;
  const flag = AAA.mats.flag || (AAA.mats.flag = aaaTri('stone', 1.1, { nStr: 1.4, macro: .3, rough: .9, hq: 'pavimento_pietra', hqScale: .55, color: 0xffffff }));
  // cucina (ovest): lastre di pietra irregolari; stanza (est): tavolato
  for (let x = x0; x < px - .05; x += .62) for (let z = z0; z < z1 - .05; z += .55) { const w = Math.min(.6, px - x) - .02, d = Math.min(.53, z1 - z) - .02; G.add(flag, ABX.box, x + w / 2, base - .05 + sr() * .01, z + d / 2, (sr() - .5) * .01, 0, (sr() - .5) * .01, w, .1, d); }
  const floorW = AAA.mats.floorW || (AAA.mats.floorW = aaaTri('wood', .9, { color: 0xc0a890, hq: 'pavimento_legno', hqScale: .5 }));
  for (let z = z0; z < z1; z += .2) G.add(floorW, ABX.box, (px + x1) / 2, base - .04, z + .1, 0, 0, 0, x1 - px, .08, .19);
  FLOORS.push({ x0, x1, z0, z1, y: base + .01 });
  // tramezzo (intonaco a calce) con porta verso il retro
  const plasterIn = AAA.mats.plasterIn || (AAA.mats.plasterIn = aaaTri('plaster', .5, { nStr: .7, macro: .3, damp: .6, baseY: base, hq: 'intonaco_interno', hqScale: .45, color: 0xd8d0bc }));
  const Fp = { axis: 'z', fixed: px + .15, out: 1, a0: z0, a1: z1, y0: base - .1, y1: fy, t: .3 };
  const pd = [{ c: z0 + 1.1, y0: base, w: .95, h: 2.05 }]; aaaWall(G, plasterIn, Fp, pd); aaaWallSolids(Fp, pd, 'house', 'muratura');
  // solaio: travi a vista e tavolato; vano scala sopra la scala (stanza est, lungo il muro nord)
  const sx0 = x1 - 3.9, sx1 = x1 - .15, sz0 = z0, sz1 = z0 + 1.05;
  for (let x = x0 + .3; x < x1; x += .62) G.add(M.woodDark, ABX.box, x, fy - .14, (z0 + z1) / 2, (sr() - .5) * .01, 0, 0, .18, .24, z1 - z0 + .3);
  G.add(M.woodDark, ABX.box, (x0 + x1) / 2, fy - .32, (z0 + z1) / 2, 0, 0, 0, x1 - x0 + .3, .32, .3);   // trave maestra
  for (let z = z0; z < z1; z += .22) { const hole = z < sz1 + .02; if (hole) { G.add(M.wood, ABX.box, (x0 + sx0) / 2, fy + .01, z + .11, 0, 0, 0, sx0 - x0, .06, .21); } else G.add(M.wood, ABX.box, (x0 + x1) / 2, fy + .01, z + .11, 0, 0, 0, x1 - x0, .06, .21); }
  for (const [a0, a1, b0, b1] of [[x0, x1, sz1, z1], [x0, sx0, z0, sz1]]) { FLOORS.push({ x0: a0, x1: a1, z0: b0, z1: b1, y: fy + .04 }); const s = addSolid(a0, fy - .02, b0, a1, fy + .04, b1, 'floor'); s.walk = true; s.mat = 'legno'; }
  FLOORS.push({ x0: sx0, x1: sx1, z0: sz0, z1: sz1, y: 0, ramp: { axis: 'x', c0: sx1, c1: sx0, y0: base + .01, y1: fy + .04 } });
  for (let i = 0; i < 15; i++) { const k = (i + .5) / 15, x = sx1 - (sx1 - sx0) * k, h = (fy - base) * k; G.add(M.wood, ABX.box, x, base + h - .04, (sz0 + sz1) / 2, 0, 0, 0, (sx1 - sx0) / 15 + .03, .05, sz1 - sz0 - .08); G.add(M.woodDark, ABX.box, x, base + h / 2 - .02, (sz0 + sz1) / 2, 0, 0, 0, (sx1 - sx0) / 15 + .01, h, sz1 - sz0 - .12); }
  for (let i = 0; i < 6; i++) { const k = i / 5, x = sx1 - (sx1 - sx0) * k; G.add(M.woodDark, ABX.box, x, base + (fy - base) * k + .45, sz1 - .03, 0, 0, 0, .05, .9, .05); }
  G.add(M.woodDark, ABX.box, (sx0 + sx1) / 2, (base + fy) / 2 + .9, sz1 - .03, 0, 0, Math.atan2(fy - base, sx1 - sx0), Math.hypot(sx1 - sx0, fy - base), .06, .06);
  // camino in cucina sul muro ovest: focolare, stipiti, architrave di legno, cappa
  const cx = x0 + .35, cz = (z0 + z1) / 2 + .6, st = M.stoneLight;
  G.add(st, ABX.box, cx, base + .05, cz, 0, 0, 0, .9, .1, 2.2); G.add(st, ABX.box, cx, base + .7, cz - .95, 0, 0, 0, .7, 1.4, .3); G.add(st, ABX.box, cx, base + .7, cz + .95, 0, 0, 0, .7, 1.4, .3);
  G.add(M.woodDark, ABX.box, cx + .1, base + 1.5, cz, 0, 0, 0, .55, .26, 2.3); G.add(M.stone, ABX.box, cx - .05, base + 2.3, cz, 0, 0, 0, .75, 1.35, 2.1);
  G.add(M.vc, ABX.box, cx - .15, base + .7, cz, 0, 0, 0, .3, 1.2, 1.5, 0x161412);   // fondo annerito
  for (let i = 0; i < 3; i++) G.add(M.woodOld, ABX.cyl6, cx + .05, base + .2 + i * .04, cz - .3 + i * .3, PI / 2, .4 * i, 0, .07, .7, .07);
  if (!HQ) G.add(M.metal, apLathe('pot', [[0, 0], [.16, .02], [.2, .14], [.18, .26], [0, .26]], 14), cx + .1, base + .5, cz + .05, 0, 0, 0, 1, 1, 1);
  // tavolo con tovaglia a quadri, sedie, credenza con piatti, mensole con barattoli, lanterna, panca
  const tx = x0 + 2.4, tz = (z0 + z1) / 2 - .2;
  if (!HQ) for (const [a, b] of [[-.75, -.4], [.75, -.4], [-.75, .4], [.75, .4]]) G.add(M.woodDark, ABX.box, tx + a, base + .37, tz + b, 0, 0, 0, .07, .74, .07);
  if (!HQ) G.add(M.wood, ABX.box, tx, base + .76, tz, 0, 0, 0, 1.7, .05, .95);
  const cloth = AAA.mats.check || (AAA.mats.check = aaaPatch(new THREE.MeshStandardMaterial({ map: aaaCanvasTex(256, 256, (g, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#b0302a' : ((i % 2) ? '#e8e0d0' : '#c87068'); g.fillRect(i * 32, j * 32, 32, 32); } }, false), roughness: .95 }), { key: 'check' }));
  { const ts = HQ && aaaModelSize('painted_wooden_table'); const cg = new THREE.BoxGeometry(1.25, .015, .9); const m = new THREE.Mesh(cg, cloth); m.position.set(tx + .1, ts ? base + .01 + ts.y + .008 : base + .795, tz); m.rotation.y = .06; m.receiveShadow = true; scene.add(m); }
  for (const [a, b, r] of [[-.4, -.75, 0], [.45, -.72, .2], [.3, .8, PI], [-1.1, .1, PI / 2 + .3]]) { const qx = tx + a, qz = tz + b; G.add(M.woodDark, ABX.box, qx, base + .45, qz, 0, r, 0, .42, .04, .42); for (const [c1, c2] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) G.add(M.woodDark, ABX.box, qx + c1 * Math.cos(r) - c2 * Math.sin(r), base + .22, qz + c1 * Math.sin(r) + c2 * Math.cos(r), 0, r, 0, .04, .45, .04); G.add(M.woodDark, ABX.box, qx - Math.sin(r) * .2, base + .72, qz - Math.cos(r) * .2 * -1, 0, r, 0, .42, .5, .04); }
  if (!HQ) for (let i = 0; i < 4; i++) G.add(M.vc, apLathe('cup', [[0, 0], [.04, 0], [.05, .09], [.045, .09], [0, .01]], 10), tx - .4 + i * .25, base + .8, tz + (i % 2 ? .2 : -.15), 0, 0, 0, 1, 1, 1, [0xe8e4dc, 0x9a5a3e, 0xe8e4dc, 0x3a4a5a][i]);
  if (!HQ) G.add(M.vc, apLathe('jug', [[0, 0], [.08, 0], [.1, .12], [.06, .24], [.07, .3], [0, .3]], 12), tx + .55, base + .8, tz - .1, 0, 0, 0, 1, 1, 1, 0xc8b89a);
  // credenza (dresser) sul muro sud della cucina
  const dz2 = z1 - .3, dx2 = x0 + 2.2;
  if (!HQ) { G.add(M.woodDark, ABX.box, dx2, base + .45, dz2, 0, 0, 0, 1.6, .9, .5); G.add(M.woodDark, ABX.box, dx2, base + 1.55, dz2 + .1, 0, 0, 0, 1.6, 1.3, .3); }
  if (!HQ) for (const yy of [1.25, 1.62, 1.98]) { G.add(M.wood, ABX.box, dx2, base + yy, dz2 + .02, 0, 0, 0, 1.52, .03, .26); for (let i = 0; i < 5; i++) G.add(M.vc, ABX.cyl, dx2 - .6 + i * .3, base + yy + .14, dz2 + .1, PI / 2 - .25, 0, 0, .13, .015, .13, [0xe8e2d4, 0xd8d0c0, 0x8aa0b8][i % 3]); }
  // mensola con barattoli e lanterna sul tramezzo
  G.add(M.wood, ABX.box, px - .06, base + 1.6, z1 - 1.4, 0, 0, 0, .25, .04, 1.4);
  for (let i = 0; i < 5; i++) G.add(M.vc, apLathe('jar' + (i % 2), [[0, 0], [.06 + (i % 2) * .02, 0], [.07, .16], [.04, .2], [0, .2]], 10), px - .06, base + 1.62, z1 - 1.95 + i * .27, 0, 0, 0, 1, 1, 1, [0x8a6a4a, 0xc8b490, 0x5a6a4a, 0xa88a5a, 0x7a5a3a][i]);
  if (!HQ) G.add(M.metal, ABX.box, tx - .1, base + .92, tz + .25, 0, 0, 0, .14, .22, .14);
  // stanza est: armadio, cassapanca, poltrona, quadro
  G.add(M.woodDark, ABX.box, x1 - .4, base + 1.05, z1 - 1.4, 0, 0, 0, .6, 2.1, 1.3); G.add(M.woodOld, ABX.box, px + 1.3, base + .27, z1 - .5, 0, 0, 0, 1.2, .54, .55);
  G.add(M.cloth, ABX.box, px + 1.6, base + .45, z0 + 2.4, 0, .5, 0, .8, .45, .8, 0x6a3a2e); G.add(M.cloth, ABX.box, px + 1.6, base + .8, z0 + 2.75, 0, .5, 0, .8, .6, .15, 0x6a3a2e);
  // primo piano: letto con coperta, comodino, cassettone, sedia
  const uy = fy + .04; if (!HQ) G.add(M.woodDark, ABX.box, x0 + 1.2, uy + .25, z1 - 1.1, 0, 0, 0, 1.5, .5, 2.1); G.add(M.cloth, ABX.box, x0 + 1.2, uy + .58, z1 - 1.05, 0, 0, 0, 1.45, .16, 1.95, 0xd8d0c0); G.add(M.cloth, ABX.box, x0 + 1.2, uy + .62, z1 - .7, 0, 0, 0, 1.47, .12, 1.25, 0x7a5a48);
  G.add(M.woodDark, ABX.box, x0 + 2.3, uy + .3, z1 - .35, 0, 0, 0, .5, .6, .45); G.add(M.woodDark, ABX.box, x1 - 1.5, uy + .5, z1 - .35, 0, 0, 0, 1.4, 1, .5);
  // stanze per la luce indiretta: piano terra e primo piano separati (il solaio fa da confine)
  AAA.rooms.length = Math.max(0, AAA.rooms.length - 1); const ri = AAA.rooms.length; aaaRoom(x0 - .02, base - .3, z0 - .02, x1 + .02, fy, z1 + .02); aaaRoom(x0 - .02, fy, z0 - .02, x1 + .02, A.base + 2 * A.sh + 3, z1 + .02);
  AAA.interior = { x0, x1, z0, z1, base, fy, px }; G.build();
}
function aaaBarnDetails(Bd, b) {
  const M = AAA.mats, G = new AGeo(), base = Bd.base, x0 = Bd.x - Bd.w / 2, x1 = Bd.x + Bd.w / 2, z0 = Bd.z - Bd.d / 2, z1 = Bd.z + Bd.d / 2, top = base + Bd.sh, sr = seeded(55);
  // tavolato verticale nella parte alta dei muri lunghi (sopra i 2,6 m), montanti e traversi a vista
  for (const [zf, s] of [[z1, 1], [z0, -1]]) { for (let x = x0 + .1; x < x1 - .1; x += .24) G.add(M.woodOld, ABX.box, x + .12, (base + 2.6 + top) / 2, zf + s * .03, 0, (sr() - .5) * .02, 0, .22, top - base - 2.6, .04); G.add(M.woodDark, ABX.box, (x0 + x1) / 2, base + 2.62, zf + s * .07, 0, 0, 0, x1 - x0, .2, .12); for (let x = x0 + 2; x < x1 - 1; x += 2.6) G.add(M.woodDark, ABX.box, x, (base + 2.6 + top) / 2, zf + s * .07, 0, 0, 0, .2, top - base - 2.6, .12); }
  // dentro: pilastri e travi, soppalco con fieno, balle, carro a mano, sacchi, attrezzi appesi
  for (let x = x0 + 2.5; x < x1 - 1; x += 3.4) for (const z of [z0 + 2.2, z1 - 2.2]) G.add(M.woodDark, ABX.cyl6, x, base + 2.6, z, 0, 0, 0, .14, 5.2, .14);
  for (let x = x0 + .6; x < x1; x += .8) G.add(M.woodDark, ABX.box, x, top - .25, (z0 + z1) / 2, 0, 0, 0, .16, .2, Bd.d - .4);
  G.add(M.wood, ABX.box, x0 + 3.5, base + 2.65, (z0 + z1) / 2, 0, 0, 0, 6.3, .08, Bd.d - 1);
  for (let i = 0; i < 18; i++) { const hx = x0 + 1 + (i % 6) * 1.02, hz = z0 + 1.2 + Math.floor(i / 6) * .6; apHay(G, hx, hz, (sr() - .5) * .1, base + 2.7 + (i % 2) * .5); }
  for (let i = 0; i < 6; i++) apHay(G, x1 - 1.5 - (i % 3) * 1.05, z0 + 1 + Math.floor(i / 3) * .6, 0, base + .02 + 0);
  for (let i = 0; i < 4; i++) apHay(G, x1 - 2 - (i % 2) * 1.05, z0 + 1.3, 0, base + .52 + Math.floor(i / 2) * .5);
  G.add(M.sack, apLathe('sack', [[0, -.5], [.35, -.42], [.5, -.1], [.5, .1], [.35, .42], [0, .5]], 10), x0 + 1, base + .35, z1 - 1, 0, 0, 0, .35, .7, .3);
  for (const [k, kind] of [[0, 'fork'], [1, 'rake'], [2, 'spade']]) apTool(G, x0 + .5, z1 - 2.6 - k * .45, 0, kind, .15, base);
  // scala a pioli verso il soppalco
  for (const s of [-.22, .22]) G.add(M.woodOld, ABX.box, x0 + 6.6, base + 1.4, z1 - 3 + s, 0, 0, .3, .06, 3, .06); for (let i = 0; i < 8; i++) G.add(M.woodOld, ABX.box, x0 + 6.6 + .35 - i * .1, base + .3 + i * .33, z1 - 3, 0, 0, 0, .04, .04, .48);
  const s = addSolid(x1 - 3.6, base, z0 + .6, x1 - .6, base + 1.5, z0 + 2, 'crate'); s.mat = 'legno';
  G.build();
}
function aaaWorkshopDetails(Dd, b) {
  const M = AAA.mats, G = new AGeo(), base = Dd.base, x0 = Dd.x - Dd.w / 2, z0 = Dd.z - Dd.d / 2, z1 = Dd.z + Dd.d / 2;
  // tettoia di lamiera ondulata arrugginita sul lato del cortile, su pali
  const L = Dd.d + 1, n = 64, pos = [], idx = []; for (let i = 0; i <= n; i++) for (let j = 0; j <= 1; j++) { const a = i / n * 2.4, y = Math.sin(i / n * 2.4 / .076 * PI) * .03; pos.push(-a, y - a * .25, j * L - L / 2); }
  for (let i = 0; i < n; i++) { const a = i * 2, b2 = a + 2; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals(); const ng = cg.toNonIndexed();
  const corr = AAA.mats.corr || (AAA.mats.corr = aaaTri('metal', .5, { nStr: .9, rough: .75, metal: .45, macro: .5, color: 0xc8b0a0, hq: 'lamiera', hqScale: .5, side: THREE.DoubleSide }));
  G.add(corr, ng, x0 - .05, base + 2.75, Dd.z);
  for (const z of [z0 - .3, z1 + .3]) G.add(M.woodOld, ABX.box, x0 - 2.3, base + 1.1, z, 0, 0, 0, .14, 2.25, .14);
  // banco da lavoro, incudine, bidoni, ruota, attrezzi
  G.add(M.woodDark, ABX.box, x0 + 1.2, base + .45, z1 - .9, 0, 0, 0, 2, .9, .7); G.add(M.wood, ABX.box, x0 + 1.2, base + .92, z1 - .9, 0, 0, 0, 2.1, .06, .8);
  G.add(M.metal, ABX.box, x0 + 2.5, base + .55, Dd.z - .5, 0, .3, 0, .55, .25, .2); G.add(M.woodDark, ABX.cyl, x0 + 2.5, base + .22, Dd.z - .5, 0, 0, 0, .25, .44, .25);
  for (let i = 0; i < 3; i++) G.add(M.rust, ABX.cyl, x0 - 1.2 + i * .62, base + .45, z0 + .2, 0, 0, 0, .29, .9, .29);
  G.build();
}

// ---------- modalità ----------
function aaaInit() {
  P.inBoat = false; P.boat = null; P.mode = 'foot'; P.dead = false;
  const sx = AV.cx - 48, sz = AV.cz + avRoadV(-48) - 1; P.pos.set(sx, Hf(sx, sz) + .1, sz); P.yaw = -PI / 2 + .12; P.pitch = -.02;
  MISSION.checkpoint = { pos: P.pos.clone(), yaw: P.yaw }; MISSION.title = 'Normandy Village — Photorealism Test'; MISSION.objText = 'Esplora il villaggio · P modalità foto · H nascondi HUD · K foto · B benchmark'; MISSION.stage = 0; MISSION.stageT = 0;
  // luce del mattino (circa 8:00): sole basso a est-sud-est, caldo; cielo velato, foschia umida
  SUN_DIR.set(.72, .34, .6).normalize(); sun.color.setHex(0xffd2a4); sun.intensity = 2.7;
  scene.traverse(o => { if (o.isHemisphereLight) { o.color.setHex(0xbccad8); o.groundColor.setHex(0x5a5444); o.intensity = .5; } });
  FOG_COL.setHex(0xa8afb2); scene.fog.color.copy(FOG_COL); FOG_K = 1.7; scene.fog.density = FOG_BASE * FOG_K; if (scene.background && scene.background.isColor) scene.background.copy(FOG_COL);
  if (sun.castShadow) {   // ombre statiche sull'intero villaggio: calcolate una volta (più una al primo fotogramma), niente cascata lontana
    const c = sun.shadow.camera, H = 88; c.left = -H; c.right = H; c.top = H; c.bottom = -H; c.near = 5; c.far = 520; c.updateProjectionMatrix();
    const ctr = new V3(AV.cx + 5, aaaH(AV.cx + 5, AV.cz - 5), AV.cz - 5); sun.position.copy(ctr).addScaledVector(SUN_DIR, 250); sun.target.position.copy(ctr); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    AAA.fixedSun = true; AAA.shadowDirty = 3; if (typeof sunFar !== 'undefined' && sunFar) { sunFar.castShadow = false; }
  }
  if (sun.shadow && sun.shadow.camera) { sun.shadow.bias = -.0003; sun.shadow.normalBias = .05; sun.shadow.radius = AAA.preset === 'ULTRA' ? 3 : 2;  }
  // riflessi: una cubemap del villaggio presa dalla strada, una volta (pozzanghere e vetri riflettono cielo e case)
  try { const PZ = AAA_PRESETS[AAA.preset]; const rt = new THREE.WebGLCubeRenderTarget(PZ.cube, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); const cc = new THREE.CubeCamera(.3, 600, rt); cc.position.set(AV.cx + 4, aaaH(AV.cx + 4, AV.cz + 6) + 1.1, AV.cz + 6); scene.add(cc); const vm = typeof vmRoot !== 'undefined' && vmRoot ? vmRoot.visible : null; if (vmRoot) vmRoot.visible = false; cc.update(renderer, scene); if (vmRoot && vm !== null) vmRoot.visible = vm; AAA.cube = rt.texture; for (const m of [AAA.mats.water, AAA.mats.glass]) { m.envMap = AAA.cube; m.needsUpdate = true; } } catch (e) { console.warn('cubemap', e); }
  aaaShafts(); aaaDust(); aaaSSAO();
  // audio: vento leggero e artiglieria molto lontana ogni tanto
  try { AAA.windS = loopSound('wind', 0, 'ambience.wind'); } catch (e) { }
  AAA.boomT = 25; if (!AAA.t0) AAA.t0 = performance.now();
  aaaHudInit();
  if (typeof labInit === 'function') labInit();
  if (typeof xpcInit === 'function') xpcInit();   // Movement Lab (controller sperimentale)
  if (typeof xaeEnable === 'function') xaeEnable(true);   // Audio Overhaul (motore sperimentale)
  if (typeof fpaLoad === 'function') fpaLoad();   // braccia con scheletro (prima persona)
  showMsg('Normandy Village — Photorealism Test · preset ' + AAA.preset, 4);
}
// fasci di luce dalle finestre della casa A esposte al sole (volumi additivi, solo all'interno)
function aaaShafts() {
  if (!AAA_PRESETS[AAA.preset].shafts || !AAA.interior) return;
  const I = AAA.interior, A = AAA.defs.A, ax = AV.cx + A.u, az = AV.cz + A.v, sd = SUN_DIR.clone().negate();
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: AAA.time },
    vertexShader: 'varying vec2 vU;varying vec3 vP;void main(){vU=uv;vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
    fragmentShader: 'uniform float uT;varying vec2 vU;varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5);}void main(){float a=(1.-vU.y)*smoothstep(0.,.15,vU.y)*smoothstep(0.,.25,vU.x)*smoothstep(1.,.75,vU.x);float n=.75+.25*sin(vP.x*3.+vP.y*2.+uT*.4);gl_FragColor=vec4(vec3(1.,.9,.72)*a*n*.075,1.);}' });
  for (const [c, y, w, h] of [[ax - 3.7, A.base + .95, .95, 1.3], [ax + 3.6, A.base + .95, .95, 1.3], [ax + .5, A.base, 1.1, 2.2]]) {
    const L = 5, g = new THREE.PlaneGeometry(w, L, 1, 1); g.translate(0, -L / 2, 0); g.rotateX(PI / 2);
    for (const k of [0, 1]) { const m = new THREE.Mesh(g, mat); m.position.set(c, y + h * (k ? .8 : .25), az + A.d / 2 - .3); m.lookAt(m.position.clone().add(sd)); m.rotateX(-PI / 2); m.renderOrder = 5; scene.add(m); (AAA.extras || (AAA.extras = [])).push(m); }
  }
}
// pulviscolo nell'aria (punti illuminati che fluttuano lentamente), più fitto dentro casa
function aaaDust() {
  const n = AAA_PRESETS[AAA.preset].dust; if (!n) return; const I = AAA.interior, pos = new Float32Array(n * 3), sr = seeded(3);
  for (let i = 0; i < n; i++) { const inside = i < n * .45; pos.set(inside ? [lerp(I.x0, I.x1, sr()), I.base + .2 + sr() * 2.6, lerp(I.z0, I.z1, sr())] : [AV.cx + (sr() - .5) * 60, aaaH(AV.cx, AV.cz) + sr() * 6, AV.cz + avRoadV(0) + (sr() - .5) * 40], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xfff0d8, size: .018, transparent: true, opacity: .55, depthWrite: false, sizeAttenuation: true });
  m.onBeforeCompile = sh => { sh.uniforms.uT = AAA.time; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += vec3(sin(uT*.21+position.y*3.)*.25, sin(uT*.13+position.x*2.)*.12, cos(uT*.17+position.z*2.5)*.25);'); };
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); AAA.dust = p; (AAA.extras || (AAA.extras = [])).push(p);
}
function aaaUpdate(dt) {
  MISSION.stageT += dt; AAA.time.value += dt; updateSubs(dt); aaaChunkTick(dt); if (typeof v2Tick === 'function') v2Tick(dt);
  const t = AAA.time.value; if (!AAA.windOff) AAA.wind.value.set(.7 + .35 * Math.sin(t * .23), .3 + .2 * Math.sin(t * .17 + 1));
  if (AAA.windS) { const g = .18 + .08 * Math.sin(t * .3); AAA.windS.set(g, 0, 1); }
  if ((AAA.boomT -= dt) <= 0) { AAA.boomT = 28 + Math.random() * 40; const a = Math.random() * TAU; sfxBoom(new V3(P.pos.x + Math.cos(a) * 2500, 20, P.pos.z + Math.sin(a) * 2500), .6); }
}
// dopo il giocatore: modalità foto (telecamera libera), benchmark
const AAA_KEYS = {};
function aaaLate(dt) {
  if (typeof xaeUpdate === 'function') { if (XAE.on && !XAE.ready && typeof AU !== 'undefined' && AU.ready) xaeInit(); xaeUpdate(dt); }
  if (typeof LAB !== 'undefined' && LAB.run) { if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false; return labRunFrame(); }
  if (AAA.bench) return aaaBenchTick();
  if (!AAA.photo) return;
  P.pos.copy(AAA.frozen); P.vy = 0;   // il soldato resta dov'era
  const sp = (KEYS.ShiftLeft ? 9 : 2.6) * dt, f = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = new V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  if (KEYS.KeyW) AAA.cam.addScaledVector(f, sp); if (KEYS.KeyS) AAA.cam.addScaledVector(f, -sp); if (KEYS.KeyD) AAA.cam.addScaledVector(r, sp); if (KEYS.KeyA) AAA.cam.addScaledVector(r, -sp);
  if (KEYS.Space) AAA.cam.y += sp; if (KEYS.KeyC) AAA.cam.y -= sp; AAA.cam.y = Math.max(AAA.cam.y, Hf(AAA.cam.x, AAA.cam.z) + .15);
  camera.position.copy(AAA.cam); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); if (Math.abs(camera.fov - AAA.fov) > .01) { camera.fov = AAA.fov; camera.updateProjectionMatrix(); }
  if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = false;
}
function aaaPhoto(on) {
  AAA.photo = on; if (on) { AAA.cam = camera.position.clone(); AAA.frozen = P.pos.clone(); AAA.fov = camera.fov; aaaHud(true); showMsg('Modalità foto: WASD · Spazio/C su e giù · Maiusc veloce · rotella FOV · H HUD · K foto · P esci', 4); }
  else { if (typeof vmRoot !== 'undefined' && vmRoot && !AAA.noHud) vmRoot.visible = true; camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
}
function aaaHud(hide) { AAA.noHud = hide; document.body.classList.toggle('aaaNoHud', hide); if (typeof vmRoot !== 'undefined' && vmRoot) vmRoot.visible = !hide; }
function aaaShot() { renderFrame(GAME.time); try { const a = document.createElement('a'); a.download = 'omaha1944_aaa_' + Date.now() + '.png'; a.href = renderer.domElement.toDataURL('image/png'); a.click(); showMsg('Foto salvata', 1.5); } catch (e) { showMsg('Foto non disponibile', 1.5); } }
function aaaHudInit() {
  if ($('aaaStyle')) return; const st = document.createElement('style'); st.id = 'aaaStyle';
  st.textContent = 'body.aaaNoHud #hud,body.aaaNoHud #cross,body.aaaNoHud #crosshair,body.aaaNoHud #msg,body.aaaNoHud #feed,body.aaaNoHud #subs,body.aaaNoHud .hudBox{display:none!important}#aaaBench{position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:80;background:rgba(10,10,10,.85);color:#eee;font:12px/1.5 monospace;padding:10px 14px;white-space:pre;display:none}';
  document.head.appendChild(st);
}
addEventListener('keydown', e => {
  if (SCEN !== 'aaa' || !GAME.running) return;
  if (e.code === 'KeyP') aaaPhoto(!AAA.photo);
  else if (e.code === 'KeyH') aaaHud(!AAA.noHud);
  else if (e.code === 'KeyK') aaaShot();
  else if (e.code === 'KeyB' && !e.ctrlKey) { if (typeof labStart === 'function') labStart(); else aaaBenchStart(); }
});
addEventListener('wheel', e => { if (SCEN === 'aaa' && AAA.photo) { AAA.fov = clamp(AAA.fov + Math.sign(e.deltaY) * 3, 15, 100); e.stopImmediatePropagation(); } }, { capture: true, passive: true });

// ---------- benchmark: sei inquadrature fisse, 4 s ciascuna; frame time, 1% lento, draw call, triangoli ----------
const AAA_VIEWS = () => { const U = (u, v, h, lu, lv, lh) => [AV.cx + u, h, AV.cz + v, AV.cx + lu, lh, AV.cz + lv]; const A = AAA.defs.A;
  return [['A vista generale', U(-40, 40, 26, 10, -10, 0)], ['B strada principale', U(-30, avRoadV(-30), 1.7, 20, avRoadV(20), 1)], ['C cortile', U(30, -6, 1.7, 40, -20, 1.5)], ['D interno della casa', U(A.u - 1.6, A.v + 1.5, 1.6, A.u - 4.5, A.v - 1, 1)], ['E vegetazione fitta', U(-40, 14, 1.4, -20, 17.5, 1)], ['F Sherman da vicino', U(-.5, 6.5, 1.6, 2.5, 10.8, 1)]]; };
function aaaPose(v) { const [x, h, z, lx, lh, lz] = v; const y = Hf(x, z) + h; camera.position.set(x, y, z); camera.lookAt(lx, Hf(lx, lz) + lh, lz); }
function aaaBenchStart() { AAA.bench = { i: 0, f: 0, times: [], res: [], last: performance.now() }; renderer.info.autoReset = false; aaaHud(true); showMsg('Benchmark in corso…', 2); }
function aaaBenchTick() {
  const B = AAA.bench, V = AAA_VIEWS(), now = performance.now(), dt = now - B.last; B.last = now;
  if (B.f > 20) B.times.push(dt);   // i primi fotogrammi di ogni inquadratura non contano (compilazione, ombre)
  if (B.f === 30) B.info = { calls: renderer.info.render.calls, tri: renderer.info.render.triangles };
  renderer.info.reset(); aaaPose(V[B.i][1]); B.f++;
  if (B.times.length >= 240 || (B.times.length > 30 && B.times.reduce((a, b) => a + b, 0) > 4000)) {
    const t = B.times.slice().sort((a, b) => a - b), avg = t.reduce((a, b) => a + b, 0) / t.length, p99 = t[Math.floor(t.length * .99) - 1] || t[t.length - 1];
    B.res.push({ vista: V[B.i][0], fps: +(1000 / avg).toFixed(1), fpsMin: +(1000 / t[t.length - 1]).toFixed(1), low1: +(1000 / p99).toFixed(1), ms: +avg.toFixed(2), calls: B.info ? B.info.calls : 0, tri: B.info ? B.info.tri : 0 });
    B.i++; B.f = 0; B.times = [];
    if (B.i >= V.length) {
      renderer.info.autoReset = true; AAA.bench = null; const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/d';
      const out = `BENCHMARK · preset ${AAA.preset} · ${innerWidth}×${innerHeight} · caricamento ${AAA.st.loadMs || '?'} ms · memoria JS ${mem} · geometrie ${renderer.info.memory.geometries} · texture ${renderer.info.memory.textures}\n` + B.res.map(r => `${r.vista.padEnd(24)} ${String(r.fps).padStart(6)} FPS  min ${String(r.fpsMin).padStart(6)}  1% ${String(r.low1).padStart(6)}  ${String(r.ms).padStart(6)} ms  draw ${String(r.calls).padStart(5)}  tri ${(r.tri / 1e6).toFixed(2)} M`).join('\n') + '\n[B per ripetere · i risultati sono anche in window.AAA_BENCH]';
      window.AAA_BENCH = { preset: AAA.preset, res: B.res }; console.log(out); let el = $('aaaBench'); if (!el) { el = document.createElement('div'); el.id = 'aaaBench'; document.body.appendChild(el); } el.textContent = out; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 20000); aaaHud(false);
    }
  }
}
// ---------- menù: scelta del preset e avvio (la modalità è separata dalle altre) ----------
function aaaMenu() {
  let el = $('aaaMenu'); if (!el) { el = document.createElement('div'); el.id = 'aaaMenu'; document.body.appendChild(el); }
  const cur = (() => { try { return localStorage.getItem('aaa_preset') || 'HIGH'; } catch (e) { return 'HIGH'; } })();
  el.style.cssText = 'position:fixed;inset:0;z-index:96;background:rgba(8,9,8,.93);color:#ece6d4;display:flex;align-items:center;justify-content:center;font:14px/1.5 "Special Elite",monospace';
  el.innerHTML = `<div style="max-width:640px;padding:20px"><div style="font:600 11px Oswald,sans-serif;letter-spacing:.3em;color:#e8c46a">AAA GRAPHICS TEST</div><h2 style="font:600 30px Oswald,sans-serif;margin:4px 0 8px">Normandy Village — Photorealism Test</h2>
  <p>Tech demo grafica separata dal gioco: un villaggio normanno di 150 × 150 m, mattina di giugno 1944. Esplorazione libera, nessun combattimento.</p>
  <p>Preset grafico:</p><div style="display:flex;gap:8px;flex-wrap:wrap">${Object.keys(AAA_PRESETS).map(k => `<button data-p="${k}" style="font:600 15px Oswald,sans-serif;padding:8px 16px;cursor:pointer;color:#efe6cf;background:${k === cur ? 'rgba(232,196,106,.45)' : 'rgba(232,196,106,.12)'};border:1px solid rgba(232,196,106,.5)">${k}</button>`).join('')}</div>
  <p style="opacity:.8;margin-top:12px">Comandi: P modalità foto (telecamera libera, rotella FOV) · H nascondi HUD · K salva una foto · B benchmark delle sei inquadrature · Esc pausa e uscita</p>
  <div style="display:flex;gap:10px;margin-top:14px"><button data-go="1" style="font:600 18px Oswald,sans-serif;padding:10px 22px;cursor:pointer;color:#111;background:#e8c46a;border:0">AVVIA</button><button data-x="1" style="font:600 15px Oswald,sans-serif;padding:10px 18px;cursor:pointer;color:#efe6cf;background:none;border:1px solid #887">Indietro</button></div></div>`;
  let sel = cur;
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.p) { sel = b.dataset.p; for (const x of el.querySelectorAll('[data-p]')) x.style.background = x.dataset.p === sel ? 'rgba(232,196,106,.45)' : 'rgba(232,196,106,.12)'; }
    if (b.dataset.x) { el.remove(); const mm = $('mainMenu'); if (mm) mm.style.display = ''; }
    if (b.dataset.go) { try { localStorage.setItem('aaa_preset', sel); } catch (e2) { } AAA.preset = sel; el.remove(); const mm = $('mainMenu'); if (mm) mm.style.display = 'none'; const sm = $('optMap'); if (![...sm.options].some(o => o.value === 'aaa')) { const o = document.createElement('option'); o.value = 'aaa'; o.textContent = 'AAA Graphics Test'; sm.appendChild(o); } sm.value = 'aaa'; AAA.t0 = performance.now(); startGame(); }
  };
}

// occlusione ambientale in spazio schermo (SSAOPass di three r128): prende il posto del passaggio di rendering
// (lo fa già lui, niente doppio disegno), buffer della scena in mezza precisione per il color grading; foglie, erba,
// edera e fasci di luce esclusi dalla profondità (le schede con trasparenza farebbero aloni quadrati)
function aaaSSAO() {
  const k = (AAA_PRESETS[AAA.preset] || {}).ssao; if (!k || !composer || !THREE.SSAOPass) return;
  const pr = renderer.getPixelRatio(), w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
  const p = new THREE.SSAOPass(scene, camera, w, h); p.kernelSize = k; p.generateSampleKernel(); p.ssaoMaterial.defines.KERNEL_SIZE = k; p.ssaoMaterial.uniforms.kernel.value = p.kernel; p.ssaoMaterial.needsUpdate = true;
  p.kernelRadius = .6; p.minDistance = .000005; p.maxDistance = .003;
  // intensità: curva di potenza sul risultato sfocato (l'occlusione di r128 è tenue)
  p.blurMaterial.fragmentShader = p.blurMaterial.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*result\s*\/\s*\(\s*5\.0\s*\*\s*5\.0\s*\)\s*\)\s*,\s*1\.0\s*\);/, 'gl_FragColor = vec4( vec3( pow( result / 25.0, 2.6 ) ), 1.0 );'); p.blurMaterial.needsUpdate = true; AAA.st.aoPow = /pow\( result/.test(p.blurMaterial.fragmentShader);
  p.beautyRenderTarget.dispose(); p.beautyRenderTarget = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.HalfFloatType }); p.ssaoMaterial.uniforms.tDiffuse.value = p.beautyRenderTarget.texture;
  const ov = p.overrideVisibility.bind(p); p.overrideVisibility = function () { ov(); this.scene.traverse(o => { if (o.userData.noAO && o.visible) { this._visibilityCache.set(o, o.visible); o.visible = false; } }); };
  scene.traverse(o => { const m = o.material; if (!m || o.isPoints) return; if (m === AAA.mats.leaf || m.alphaTest > 0 || m.transparent || m.blending === THREE.AdditiveBlending || (m.userData && m.userData.grass)) o.userData.noAO = true; });
  const i = composer.passes.findIndex(q => q.constructor && q.constructor.name === 'RenderPass'); if (i >= 0) composer.passes.splice(i, 1, p); else composer.passes.unshift(p);
  AAA.ssao = p; AAA.st.ssao = k;
}

// istanze divise in blocchi spaziali: limiti di visibilità veri (prima la sfera era quella del modello, centrata nell'origine
// del mondo) e distanza massima per erba e piccoli oggetti, dove la foschia li copre già
const AAA_DIST = { grass: { LOW: 0, MEDIUM: 32, HIGH: 42, ULTRA: 55 }, detail: { LOW: 0, MEDIUM: 45, HIGH: 60, ULTRA: 75 }, small: { LOW: 30, MEDIUM: 35, HIGH: 45, ULTRA: 60 } };
function aaaChunkAll() {
  const list = []; scene.traverse(o => { if (o.isInstancedMesh && o.userData.chunk && !o.userData.chunked) list.push(o); });
  const m4 = new THREE.Matrix4(), p = new V3(), q = new THREE.Quaternion(), s = new V3(), c = new THREE.Color(); AAA.chunks = AAA.chunks || [];
  for (const im of list) {
    const [cell, kind] = im.userData.chunk, maxD = kind ? (AAA_DIST[kind] || {})[AAA.preset] || 0 : 0, cells = new Map();
    let smax = 0; for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); m4.decompose(p, q, s); smax = Math.max(smax, s.x, s.y, s.z); const k = Math.floor(p.x / cell) + ',' + Math.floor(p.z / cell); (cells.get(k) || cells.set(k, []).get(k)).push(i); }
    const g = im.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const br = g.boundingSphere.radius + g.boundingSphere.center.length();
    g.boundingSphere = new THREE.Sphere(new V3(0, 0, 0), br * smax + cell * .75);
    for (const [k, idx] of cells) {
      const [ci, cj] = k.split(',').map(Number), cx = (ci + .5) * cell, cz = (cj + .5) * cell, ch = new THREE.InstancedMesh(g, im.material, idx.length);
      ch.position.set(cx, 0, cz); ch.castShadow = im.castShadow; ch.receiveShadow = im.receiveShadow; ch.customDepthMaterial = im.customDepthMaterial; ch.userData = Object.assign({}, im.userData, { chunked: true });
      idx.forEach((i, n) => { im.getMatrixAt(i, m4); m4.elements[12] -= cx; m4.elements[14] -= cz; ch.setMatrixAt(n, m4); if (im.instanceColor) { im.getColorAt(i, c); ch.setColorAt(n, c); } });
      if (ch.instanceColor) ch.instanceColor.needsUpdate = true; ch.updateMatrixWorld(true); scene.add(ch); AAA.chunks.push({ m: ch, x: cx, z: cz, d: maxD });
    }
    scene.remove(im); im.dispose();
  }
  AAA.st.chunks = AAA.chunks.length;
}
// visibilità per distanza (quattro volte al secondo); durante il calcolo delle ombre statiche tutto resta visibile
function aaaChunkTick(dt) {
  if (!AAA.chunks) return; if ((AAA.chunkT = (AAA.chunkT || 0) - dt) > 0) return; AAA.chunkT = .25;
  const cp = camera.position, all = AAA.shadowDirty > 0;
  for (const c of AAA.chunks) c.m.visible = (all || !c.d || Math.hypot(c.x - cp.x, c.z - cp.z) < c.d) && !(AAA.hideDecor && c.m.userData.chunk && c.m.userData.chunk[1]);
}
