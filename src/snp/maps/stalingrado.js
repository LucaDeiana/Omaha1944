"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — mappa 2: «Stalingrado», inverno 1942–43.
//  Fabbrica sovietica «Ottobre Rosso» (mattoni rossi: uffici, grande
//  reparto, caldaie) contro il complesso tedesco (magazzino, torre della
//  centrale, sala turbine). In mezzo lo scalo ferroviario, invalicabile.
//  Quattro livelli per lato (0 / 4,5 / 9 / 13,5 m), tre percorsi verticali.
//  Coordinate locali come Saint-Lô: u laterale, v dalla facciata verso l'interno.
// ============================================================
const STL = { posts: [], doors: [], links: [], spawnSpots: [], smokes: [] };
const STL_CRATERS = [[-18, -142, 5, 1.4], [12, -160, 4.2, 1.1], [30, -136, 3.4, .9], [-34, -166, 4, 1.2], [2, -128, 3, .8], [-4, -176, 3.6, 1]];
const STL_RAILS = [-171, -163, -155, -145, -137, -129];

// ---------- terreno: neve compatta, massicciata dei binari, crateri ----------
function stlH(x, z) {
  let y = SNP.G;
  const out = Math.max(0, Math.abs(x) - 75) + Math.max(0, Math.abs(z - SNP.C.z) - 115);
  if (out > 0) y += (fbm(x * .02, z * .02, 2) - .5) * 2 * Math.min(1, out / 30);
  for (const rz of STL_RAILS) { const d = Math.abs(z - rz); if (d < 2.4 && Math.abs(x) < 80) y += .35 * smooth((2.4 - d) / 1); }
  for (const [cx, cz, r, d] of STL_CRATERS) { const k = Math.hypot(x - cx, z - cz) / r; if (k < 1) y += k < .72 ? -d * (1 - (k / .72) ** 2) : d * .35 * Math.sin((k - .72) / .28 * PI); }
  return y;
}
function stlSplat(x, z, n2) {
  const rail = STL_RAILS.some(rz => Math.abs(z - rz) < 1.8) && Math.abs(x) < 80, cr = STL_CRATERS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r * 1.15);
  const snow = 1.6 + n2 * .5, dirt = cr ? 1.2 : rail ? .9 : .12 + (1 - n2) * .2, peb = rail ? .6 : 0, tot = snow + dirt + peb, t = 1.5 + .12 * n2;
  return { sp: [snow / tot, peb / tot, 0, dirt / tot], sc: cr ? .5 : 0, cl: [t * .98, t * 1.06, t * 1.3] };
}
function stlSmoke(dt) {
  SNP.smokeT = (SNP.smokeT || 0) - dt; if (SNP.smokeT > 0) return; SNP.smokeT = .3;
  for (const [x, y, z, s] of STL.smokes) PS_SMOKE.emit(x + rnd(-1.5, 1.5), y, z + rnd(-1.5, 1.5), rnd(-.4, .4), rnd(1.2, 2.2), rnd(-.4, .4), rnd(8, 13) * s, 4 * s, 14 * s, .3, .29, .28, .45, .1, -.04);
}

// ---------- mattoni costruttivi ----------
const STL_MAT = { brick: 0xd8c0b0, brick2: 0xc0a898, brickDk: 0x4e2a22, conc: 0x8c8a84, conc2: 0x75736e, steel: 0x3c3b38, rust: 0x6a4030, snow: 0xe6ebf0, plank: 0x5a4632 };
const STL_WM = m => m;
function stlWallU(mb, team, v0, v1, u0, u1, L, h, ops, c, mat, y0) {
  mb.mat = STL_WM(mat); const y = y0 !== undefined ? y0 : L * SNP.FH;
  snpWallU(mb, team, v0, v1, u0, u1, y, h, ops, c);
  for (const o of ops) if (o.lo < .05 && o.hi >= 2) STL.doors.push({ team, u: (o.a + o.b) / 2, v: (v0 + v1) / 2, L, ax: 'u' });
  for (const o of ops) if (o.lo < .05 && L > 0 && y0 === undefined) stlSill(team, o.a, o.b, v0 - .05, v1 + .05, y);
}
function stlWallV(mb, team, u0, u1, v0, v1, L, h, ops, c, mat, y0) {
  mb.mat = STL_WM(mat); const y = y0 !== undefined ? y0 : L * SNP.FH;
  snpWallV(mb, team, u0, u1, v0, v1, y, h, ops, c);
  for (const o of ops) if (o.lo < .05 && o.hi >= 2) STL.doors.push({ team, u: (u0 + u1) / 2, v: (o.a + o.b) / 2, L, ax: 'v' });
  for (const o of ops) if (o.lo < .05 && L > 0 && y0 === undefined) stlSill(team, u0 - .05, u1 + .05, o.a, o.b, y);
}
// soglia: pavimento sotto lo spessore del muro nei passaggi dei piani alti
function stlSill(team, u0, u1, v0, v1, y) { const [x0, x1, z0, z1] = snpBoxW(team, u0, u1, v0, v1); SNP.floors.push({ x0, x1, z0, z1, y: SNP.G + y }); }
// solaio: cemento, grigliato di ferro o tavolato; calpestabile, ferma i proiettili
function stlSlab(mb, team, u0, u1, v0, v1, L, kind, holes) {
  const y = L * SNP.FH, G = SNP.G;
  for (const r of rectMinus([u0, u1, v0, v1], holes || [])) {
    const [x0, x1, z0, z1] = snpBoxW(team, r[0], r[1], r[2], r[3]), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const th = kind === 'conc' ? .35 : kind === 'grate' ? .08 : .12;
    if (L > 0 || kind !== 'conc') {
      mb.mat = kind === 'conc' ? 'concrete' : kind === 'grate' ? 'paint' : 'wood';
      mb.add(U.box, kind === 'conc' ? STL_MAT.conc2 : kind === 'grate' ? STL_MAT.steel : STL_MAT.plank, cx, G + y + .01 - th / 2, cz, 0, 0, 0, w, th, d);
      if (kind === 'grate') { mb.mat = 'paint'; for (const zz of [z0 + .1, z1 - .1]) mb.add(U.box, STL_MAT.rust, cx, G + y - .2, zz, 0, 0, 0, w, .25, .12); }
    } else { mb.mat = 'concrete'; mb.add(U.box, STL_MAT.conc2, cx, G + .02, cz, 0, 0, 0, w, .06, d); }
    if (L > 0) { const s = addSolid(x0, G + y - th, z0, x1, G + y, z1, 'floor'); s.walk = true; }
    SNP.floors.push({ x0, x1, z0, z1, y: G + y });
  }
}
// parapetto: basso e solido (ferma chi cammina, non chi spara sopra)
function stlRailU(mb, team, v, u0, u1, L, h = 1) { mb.mat = 'paint'; snpBox(mb, team, u0, u1, v - .05, v + .05, L * SNP.FH, L * SNP.FH + h, STL_MAT.rust); for (let u = u0; u <= u1; u += 1.6) snpBox(mb, team, u - .04, u + .04, v - .06, v + .06, L * SNP.FH, L * SNP.FH + h + .02, STL_MAT.steel, false); }
function stlRailV(mb, team, u, v0, v1, L, h = 1) { mb.mat = 'paint'; snpBox(mb, team, u - .05, u + .05, v0, v1, L * SNP.FH, L * SNP.FH + h, STL_MAT.rust); for (let v = v0; v <= v1; v += 1.6) snpBox(mb, team, u - .06, u + .06, v - .04, v + .04, L * SNP.FH, L * SNP.FH + h + .02, STL_MAT.steel, false); }
// torre delle scale a rampe parallele lungo u: S1 sale verso +u, S2 verso −u, setto in mezzo, parapetti sui fori
function stlStairs(mb, team, uLo, uHi, S1, S2, L0, L1, metal) {
  const FH = SNP.FH, holes = {};
  for (let L = L0; L < L1; L++) {
    const k = L - L0, s = k % 2 === 0 ? S1 : S2, up = k % 2 === 0, y0 = L * FH, n = 15, run = uHi - uLo;
    for (let i = 0; i < n; i++) {
      const ua = up ? uLo + i * run / n : uHi - (i + 1) * run / n, yt = y0 + (i + 1) * FH / n;
      mb.mat = metal ? 'paint' : 'concrete'; snpBox(mb, team, ua, ua + run / n, s[0], s[1], yt - .1, yt, metal ? STL_MAT.steel : STL_MAT.conc, false);
    }
    const [x0, x1, z0, z1] = snpBoxW(team, uLo, uHi, s[0], s[1]), xl = snpW(team, up ? uLo : uHi, 0).x, xh = snpW(team, up ? uHi : uLo, 0).x;
    SNP.floors.push({ x0, x1, z0, z1, ramp: { axis: 'x', c0: xl, c1: xh, y0: SNP.G + y0, y1: SNP.G + y0 + FH } });
    const vm = (s[0] + s[1]) / 2;
    STL.links.push([team, up ? uLo - 1.3 : uHi + 1.3, vm, L, up ? uHi + 1.3 : uLo - 1.3, vm, L + 1]);
    (holes[L + 1] = holes[L + 1] || []).push([uLo, uHi, s[0], s[1]]);
    // parapetti attorno al foro del piano di arrivo: lato esterno e capo basso
    const outer = s === S1 ? (S1[0] > S2[0] ? [s[1], s[1] + .1] : [s[0] - .1, s[0]]) : (S2[0] > S1[0] ? [s[1], s[1] + .1] : [s[0] - .1, s[0]]);
    mb.mat = 'paint'; snpBox(mb, team, uLo, uHi, outer[0], outer[1], (L + 1) * FH, (L + 1) * FH + 1, STL_MAT.rust);
    const endU = up ? uLo : uHi; snpBox(mb, team, endU - .05, endU + .05, s[0], s[1], (L + 1) * FH, (L + 1) * FH + 1, STL_MAT.rust);
  }
  const sp = S1[0] > S2[0] ? [S2[1], S1[0]] : [S1[1], S2[0]];
  mb.mat = metal ? 'paint' : 'plaster'; snpBox(mb, team, uLo, uHi, sp[0], sp[1], L0 * FH, L1 * FH + 1, metal ? STL_MAT.steel : STL_MAT.brick2);
  return holes;
}
// apertura della facciata: tipi diversi per forma e protezione
//  big: finestrone industriale a reticolo · low: finestra bassa · slit: feritoia · board: sbarrata a metà
//  breach: breccia · hole: buco di granata · lune: finestra a lunetta alta · gap: varco nel parapetto
const STL_OP = { big: { w: 3.2, lo: 1.0, hi: 3.7, st: 0 }, low: { w: 1.6, lo: .75, hi: 1.95, st: 1 }, slit: { w: .55, lo: 1.25, hi: 2.5, st: 0 }, board: { w: 2.4, lo: 1.0, hi: 3.4, st: 0 }, breach: { w: 3.4, lo: .25, hi: 3, st: 2 }, hole: { w: 1.7, lo: 1.3, hi: 2.7, st: 0 }, lune: { w: 2.6, lo: 1.45, hi: 3.6, st: 0 }, gap: { w: 2.6, lo: 0, hi: 1, st: 2 }, mid: { w: 2.2, lo: .95, hi: 2.6, st: 1 } };
function stlOps(list) { return list.map(([kind, u]) => { const o = STL_OP[kind]; return { a: u - o.w / 2, b: u + o.w / 2, lo: o.lo, hi: o.hi, kind, st: o.st }; }); }
function stlFacade(mb, team, u0, u1, L, list, c, mat, h) {
  const ops = stlOps(list), y0 = L * SNP.FH;
  stlWallU(mb, team, 0, .5, u0, u1, L, h || SNP.FH, ops.map(o => o.kind === 'gap' ? { ...o, lo: 0, hi: (h || 1) } : o), c, mat);
  for (const o of ops) {
    const cu = (o.a + o.b) / 2, w = o.b - o.a;
    STL.posts.push({ team, u: cu, L, kind: o.kind, st: L === 0 && o.lo < .6 ? 1 : o.st });
    if (o.kind === 'big' || o.kind === 'lune' || o.kind === 'board') {
      // reticolo di ferro con qualche vetro rimasto (solo grafica: i proiettili passano)
      mb.mat = 'paint';
      for (let x = o.a + .5; x < o.b - .1; x += .52) snpBox(mb, team, x - .025, x + .025, .2, .26, y0 + o.lo, y0 + o.hi, STL_MAT.steel, false);
      for (let y = o.lo + .55; y < o.hi - .1; y += .55) snpBox(mb, team, o.a, o.b, .2, .26, y0 + y - .02, y0 + y + .02, STL_MAT.steel, false);
      mb.mat = 'vc'; for (let k = 0; k < 3; k++) if (SNP_RNG() < .5) { const x = srand(o.a + .2, o.b - .7), y = srand(o.lo, o.hi - .6); snpBox(mb, team, x, x + .5, .22, .24, y0 + y, y0 + y + .52, 0x9aa4a8, false); }
    }
    if (o.kind === 'board') {   // assi inchiodate sulla metà bassa: riparo vero, si spara dalla fessura sopra
      mb.mat = 'wood'; for (let k = 0; k < 2; k++) snpBox(mb, team, o.a - .1, o.b + .1, .52, .6, y0 + o.lo + k * .26, y0 + o.lo + k * .26 + .22, STL_MAT.plank, false);
      snpBox(mb, team, o.a + .3, o.a + .5, .52, .6, y0 + o.lo + .5, y0 + o.hi - .3, STL_MAT.plank, false);
      const [x0, x1, z0, z1] = snpBoxW(team, o.a, o.b, .5, .62); addSolid(x0, SNP.G + y0 + o.lo, z0, x1, SNP.G + y0 + o.lo + .48, z1, 'crate');
      STL.posts[STL.posts.length - 1].st = 0;
    }
    if (o.kind === 'breach' || o.kind === 'hole') snpBreachDeco(mb, team, o, y0, true);
    // davanzale innevato
    if (o.lo > .5) { mb.mat = 'plaster'; snpBox(mb, team, o.a - .05, o.b + .05, -.12, .5, y0 + o.lo, y0 + o.lo + .07, STL_MAT.snow, false); }
  }
}

// ---------- arredi industriali ----------
function stlMachine(mb, team, u, v, L, kind, r = 0) {
  const P = PROPS_IND[kind]; if (!P) return;
  snpProp(mb, team, u, v, L * SNP.FH, r, P.parts(), P.solid);
}
const PROPS_IND = {
  lathe: { solid: [1, 3.2, 1.3], parts: () => [['paint', 0, 0x3a4238, 0, .45, 0, 0, 0, 0, .9, .9, 3.2], ['paint', 0, 0x2e352e, 0, 1.1, -1.1, 0, 0, 0, .8, .5, .8], ['paint', U.cyl12, 0x8a8a84, 0, 1.05, .2, PI / 2, 0, 0, .08, 2.2, .08], ['paint', 0, 0x2e352e, 0, 1.05, 1.2, 0, 0, 0, .5, .4, .4]] },
  press: { solid: [1.8, 1.6, 3.4], parts: () => [['paint', 0, 0x3e4440, 0, .4, 0, 0, 0, 0, 1.8, .8, 1.6], ['paint', 0, 0x3e4440, -.7, 1.9, 0, 0, 0, 0, .35, 2.4, 1.2], ['paint', 0, 0x3e4440, .7, 1.9, 0, 0, 0, 0, .35, 2.4, 1.2], ['paint', 0, 0x343a36, 0, 3.2, 0, 0, 0, 0, 1.9, .5, 1.4], ['paint', 0, 0x6a4030, 0, 1.4, 0, 0, 0, 0, 1, .3, 1]] },
  boiler: { solid: [3.4, 7, 3.8], parts: () => [['paint', U.cyl12, 0x3a3836, 0, 1.9, 0, PI / 2, 0, 0, 1.7, 7, 1.7], ['brick', 0, 0x6a3426, 0, .5, 0, 0, 0, 0, 3.4, 1, 6.6], ['paint', U.cyl, 0x4a3a30, 0, 3.8, 2.5, 0, 0, 0, .35, 1.4, .35], ['paint', U.cyl12, 0x2a2826, 0, 1.9, -3.55, PI / 2, 0, 0, 1.2, .2, 1.2]] },
  turbine: { solid: [3, 8, 3], parts: () => [['paint', 0, 0x4a5048, 0, .5, 0, 0, 0, 0, 3, 1, 8], ['paint', U.cyl12, 0x56605a, 0, 1.8, -1, PI / 2, 0, 0, 1.4, 4.5, 1.4], ['paint', U.cyl12, 0x56605a, 0, 1.6, 2.6, PI / 2, 0, 0, 1.1, 2.4, 1.1], ['paint', 0, 0x3a403a, 0, 2.9, -1, 0, 0, 0, 1.6, .4, 4]] },
  transformer: { solid: [2, 1.6, 2.6], parts: () => [['paint', 0, 0x4a4e48, 0, 1.1, 0, 0, 0, 0, 2, 2.2, 1.4], ...[-.6, 0, .6].map(x => ['vc', U.cyl, 0xa89a7a, x, 2.6, 0, 0, 0, 0, .12, .8, .12]), ...[-.85, .85].map(x => ['paint', 0, 0x3a3e38, x, 1, 0, 0, 0, 0, .25, 1.8, 1.6])] },
  crates: { solid: [1.4, 1.4, 1.5], parts: () => [['wood', 0, 0x6a5638, 0, .45, 0, 0, .1, 0, .9, .9, .9], ['wood', 0, 0x5e4c32, .4, .35, .55, 0, -.3, 0, .7, .7, .7], ['wood', 0, 0x6a5638, .05, 1.2, .05, 0, .4, 0, .6, .6, .6]] },
  drums: { solid: [1.6, 1.2, 1], parts: () => [[-.4, 0], [.35, .1], [0, -.45]].map(([x, z]) => ['paint', U.cyl12, 0x3e4a3a, x, .45, z, 0, 0, 0, .3, .9, .3]).concat([['paint', U.cyl12, 0x5a3a2a, .9, .3, .4, PI / 2, .3, 0, .3, .9, .3]]) },
  beam: { solid: null, parts: () => [['paint', 0, STL_MAT.rust, 0, .25, 0, .08, 0, .3, .3, .5, 7], ['paint', 0, STL_MAT.rust, 0, .25, 0, .08, 0, .3, .02, .5, 7]] },
  sandbags: { solid: [2.4, .7, .85], parts: () => [...Array(8)].map((_, i) => ['sack', 0, [0xa09878, 0x8a8264, 0x96906e][i % 3], -1 + (i % 4) * .66 + (i > 3 ? .3 : 0), .16 + (i > 3 ? .3 : 0), 0, 0, srand(-.1, .1), 0, .62, .3, .5]) },
  pipes: { solid: null, parts: () => [['paint', U.cyl12, 0x5a4a3a, 0, 3.6, 0, 0, 0, PI / 2, .22, 9, .22], ['paint', U.cyl12, 0x4a4a46, 0, 3.1, .5, 0, 0, PI / 2, .14, 9, .14], ['paint', U.cyl12, 0x5a4a3a, 4.4, 1.8, 0, 0, 0, 0, .22, 3.6, .22]] },
  snowdrift: { solid: null, parts: () => [['plaster', U.sph, STL_MAT.snow, 0, 0, 0, 0, 0, 0, 2.2, .45, 1.6], ['plaster', U.sph, STL_MAT.snow, .9, 0, .5, 0, 0, 0, 1.2, .3, 1]] },
  rubble: { solid: [2.4, 2, .8], parts: () => [...Array(12)].map(() => ['brick', 0, [0x7a3a2a, 0x8a4a36, 0x6a5a4c, 0x8c8a84][(SNP_RNG() * 4) | 0], srand(-1.1, 1.1), srand(.1, .6), srand(-.9, .9), srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.3, .8), srand(.2, .45), srand(.3, .7)]).concat([['plaster', U.sph, STL_MAT.snow, 0, .55, 0, 0, 0, 0, 1.2, .25, 1]]) },
};

// ---------- FABBRICA SOVIETICA «OTTOBRE ROSSO» (squadra A) ----------
function stlSoviet() {
  const T = 'A', mb = new MB(), FH = SNP.FH, W2 = 32, D = 26, t = .5, B = STL_MAT.brick, B2 = STL_MAT.brick2;
  // --- uffici (u −32…−16): 4 piani, stanze e corridoio, scala in muratura ---
  const oS1 = [21.4, 23], oS2 = [19.6, 21.2];
  const oHoles = stlStairs(mb, T, -28.5, -19.5, oS1, oS2, 0, 3, false);
  const oFac = [
    [['low', -28.5], ['board', -23.2], ['low', -19.3]],
    [['mid', -29], ['hole', -24.6], ['mid', -19.6]],
    [['slit', -29.8], ['mid', -26.4], ['breach', -21]],
    [['mid', -28.2], ['gap', -23], ['slit', -18.4]],
  ];
  for (let L = 0; L < 4; L++) {
    stlFacade(mb, T, -W2, -16, L, oFac[L], L % 2 ? B2 : B, 'brick');
    stlWallU(mb, T, D - t, D, -W2, -16, L, FH, L === 0 ? stlOps([['mid', -24]]).map(o => ({ ...o, lo: 0, hi: 2.3 })) : stlOps([['mid', -26], ['mid', -21]]), B2, 'brick');
    stlWallV(mb, T, -W2, -W2 + t, t, D - t, L, FH, [], B2, 'brick');
    // tramezzo tra le due stanze sul fronte, muro del corridoio, atrio della scala
    stlWallV(mb, T, -24.15, -23.85, t, 8, L, FH, L === 1 ? [{ a: 2.5, b: 5.5, lo: .3, hi: 2.8 }] : [{ a: 5.6, b: 6.8, lo: 0, hi: 2.2 }], 0xb8ac94, 'plaster');
    stlWallU(mb, T, 8, 8.3, -W2 + t, -16.25, L, FH, [{ a: -28.6, b: -27.4, lo: 0, hi: 2.2 }, { a: -20.6, b: -19.4, lo: 0, hi: 2.2 }], 0xb8ac94, 'plaster');
    stlWallU(mb, T, 11, 11.3, -W2 + t, -16.25, L, FH, [{ a: -29, b: -18, lo: 0, hi: FH }], 0xb8ac94, 'plaster');
    // muro tra uffici e reparto, con porte diverse a ogni piano
    const dv = [[12, 13.4], [4, 5.4], [.7, 2], [3, 4.4]][L];
    stlWallV(mb, T, -16.25, -15.75, t, D - t, L, FH, [{ a: dv[0], b: dv[1], lo: 0, hi: 2.3 }], B2, 'brick');
    stlSlab(mb, T, -W2 + t, -16.25, t, D - t, L, L === 3 ? 'plank' : 'conc', oHoles[L]);
  }
  // tetto degli uffici quasi tutto crollato: travi e qualche lamiera
  mb.mat = 'wood'; for (let u = -31; u < -16.5; u += 2.2) if (SNP_RNG() < .6) snpBox(mb, T, u, u + .25, 1, D - 1, 4 * FH - .2, 4 * FH + .1, 0x3e2e22, false);
  // --- grande reparto (u −16…16): capannone a tutta altezza, soppalco, passerelle, tetto rotto ---
  const hFac = [
    [['low', -12.5], ['low', -7.4], ['breach', -1.2], ['low', 4.6], ['low', 9.2], ['low', 13.6]],
    [['big', -12], ['big', -6.2], ['board', 0], ['big', 6.4], ['big', 12.4]],
    [['lune', -11.4], ['lune', -5.2], ['hole', 1.6], ['lune', 7.8], ['lune', 13.2]],
    [['gap', -12.8], ['gap', -4.4], ['gap', 5.2], ['gap', 12.2]],
  ];
  for (let L = 0; L < 4; L++) stlFacade(mb, T, -15.75, 15.75, L, hFac[L], L === 3 ? B2 : B, 'brick', L === 3 ? 1 : FH);
  for (let L = 0; L < 3; L++) stlWallU(mb, T, D - t, D, -15.75, 15.75, L, FH, L === 0 ? [{ a: -2, b: 2, lo: 0, hi: 3.6 }] : stlOps([['lune', -9], ['lune', 0], ['lune', 9]]), B2, 'brick');
  stlSlab(mb, T, -15.75, 15.75, t, D - t, 0, 'conc');
  // soppalco al 1° piano sul fronte (v 0,5–8) e pianerottolo della scala di ferro
  const mzH = [[-3, 6, 5.9, 7.5]];
  stlSlab(mb, T, -15.75, 15.75, t, 8, 1, 'conc'); stlSlab(mb, T, 12, 15.75, 8, 9.9, 1, 'conc');
  stlRailU(mb, T, 8.05, -15.75, 12, 1);
  // scala di ferro: piano terra → soppalco (lungo u, striscia v 8,3–9,9)
  stlFlight(mb, T, 3, 12, [8.3, 9.9], 0, true);
  // soppalco → passerella del 2° piano (striscia v 5,9–7,5 sul soppalco, sale verso −u)
  stlFlight(mb, T, -3, -12, [5.9, 7.5], 1, true);
  // 2° piano: passerella sotto le finestre (v 0,5–2,1), piattaforma d'arrivo e passerella laterale
  stlSlab(mb, T, -15.75, 15.75, t, 2.1, 2, 'grate'); stlSlab(mb, T, -15.75, -12, 2.1, 7.5, 2, 'grate');
  stlRailU(mb, T, 2.15, -12, 15.75, 2); stlRailV(mb, T, -11.95, 2.1, 5.9, 2); stlRailU(mb, T, 7.55, -15.75, -12, 2);
  // 3° piano: piano di copertura sul fronte (v 0,5–9,5) con crolli, recintati
  const roofH = [[-7, -1, 2.2, 7.5], [6, 11, 3.5, 9.5]];
  stlSlab(mb, T, -15.75, 15.75, t, 9.5, 3, 'conc', roofH);
  for (const h of roofH) { stlRailU(mb, T, h[2] - .05, h[0], h[1], 3); if (h[3] < 9.4) stlRailU(mb, T, h[3] + .05, h[0], h[1], 3); stlRailV(mb, T, h[0] - .05, h[2], h[3], 3); stlRailV(mb, T, h[1] + .05, h[2], h[3], 3); }
  stlRailU(mb, T, 9.55, -15.75, 15.75, 3);
  // capriate spezzate sopra il reparto e travi del carroponte
  mb.mat = 'paint';
  for (let u = -14; u <= 14; u += 4) { const broken = Math.abs(u - 2) < 3 || SNP_RNG() < .25; snpBox(mb, T, u - .12, u + .12, 9.6, broken ? 16 : D - .6, 4 * FH - .3, 4 * FH, STL_MAT.rust, false); if (!broken) for (let v = 11; v < D - 1; v += 3) snpBox(mb, T, u - .06, u + .06, v, v + .1, 4 * FH, 4 * FH + 2.2 * Math.sin((v - 9.5) / (D - 10) * PI), STL_MAT.rust, false); }
  for (const v of [9.8, 24.6]) snpBox(mb, T, -15.5, 15.5, v - .2, v + .2, 11.3, 11.8, STL_MAT.steel, false);
  { const p = snpW(T, 2, 17); mb.mat = 'paint'; mb.add(U.box, STL_MAT.rust, p.x, SNP.G + 5, p.z, .5, .3, .9, .5, .6, 15); }   // carroponte crollato
  // colonne di cemento e macchinari al piano terra
  for (const u of [-8, 0, 8]) for (const v of [9.4, 17.5]) { mb.mat = 'plaster'; snpBox(mb, T, u - .35, u + .35, v - .35, v + .35, 0, 3 * FH, STL_MAT.conc); }
  for (const [u, v, k, r] of [[-12, 13, 'lathe', 0], [-4, 13.5, 'lathe', 0], [5, 21, 'press', 0], [11, 14, 'lathe', 0], [-11, 21, 'press', .2], [-3, 21.5, 'crates', .3], [12, 21, 'drums', 0], [3.5, 12.5, 'beam', .7], [-14, 4, 'crates', 0], [6, 3.6, 'sandbags', 0], [-7, 4.5, 'rubble', 0], [1, 5.5, 'snowdrift', 0], [-2, 17, 'rubble', 0]]) stlMachine(mb, T, u, v, 0, k, r);
  for (const [u, v, k, r] of [[-9, 5.2, 'crates', 0], [8.5, 5, 'drums', 0], [3, 4, 'sandbags', 0], [-14, 6.6, 'rubble', 0]]) stlMachine(mb, T, u, v, 1, k, r);
  for (const [u, v, k, r] of [[-12.5, 4.5, 'crates', 0], [0, 6.5, 'snowdrift', 0], [13, 4, 'sandbags', 0]]) stlMachine(mb, T, u, v, 3, k, r);
  stlMachine(mb, T, 0, 25.2, 0, 'pipes', 0);
  // --- caldaie (u 16…32): caldaie, galleria al 1°, passerella al 2°, tetto, scala di ferro sul retro ---
  const bS1 = [21.4, 23], bS2 = [19.6, 21.2];
  const bHoles = stlStairs(mb, T, 19.5, 28.5, bS1, bS2, 0, 3, true);
  const bFac = [
    [['low', 19], ['slit', 22.6], ['low', 26.4], ['board', 30]],
    [['mid', 18.6], ['big', 23.8], ['slit', 29.8]],
    [['slit', 18.2], ['hole', 22], ['lune', 27.2]],
    [['gap', 20.2], ['gap', 28.6]],
  ];
  for (let L = 0; L < 4; L++) stlFacade(mb, T, 15.75, W2, L, bFac[L], L % 2 ? B : B2, 'brick', L === 3 ? 1 : FH);
  for (let L = 0; L < 3; L++) { stlWallU(mb, T, D - t, D, 15.75, W2, L, FH, L === 0 ? [{ a: 23, b: 26, lo: 0, hi: 3.2 }] : [], B2, 'brick'); stlWallV(mb, T, W2 - t, W2, t, D - t, L, FH, [], B2, 'brick'); }
  for (let L = 0; L < 3; L++) { const dv = [[5, 6.4], [4, 5.4], [.7, 2]][L]; stlWallV(mb, T, 15.75, 16.25, t, D - t, L, FH, [{ a: dv[0], b: dv[1], lo: 0, hi: 2.3 }], B2, 'brick'); }
  stlSlab(mb, T, 16.25, W2 - t, t, D - t, 0, 'conc');
  stlSlab(mb, T, 16.25, W2 - t, t, 12, 1, 'conc'); stlSlab(mb, T, 28.5, W2 - t, 12, 23, 1, 'grate'); stlSlab(mb, T, 16.25, 19.5, 19.6, 23, 1, 'grate');
  stlRailU(mb, T, 12.05, 16.25, 28.4, 1); stlRailV(mb, T, 28.45, 12, 19.5, 1);
  stlSlab(mb, T, 16.25, W2 - t, t, 2.1, 2, 'grate'); stlSlab(mb, T, 16.25, 18.25, 2.1, 19.6, 2, 'grate'); stlSlab(mb, T, 16.25, 19.5, 19.6, 23, 2, 'grate'); stlSlab(mb, T, 28.5, W2 - t, 19.6, 23, 2, 'grate');
  stlRailU(mb, T, 2.15, 18.25, W2 - t, 2); stlRailV(mb, T, 18.3, 2.1, 19.5, 2);
  stlSlab(mb, T, 16.25, W2 - t, t, D - t, 3, 'conc', [...(bHoles[3] || []), [22, 27, 8, 14]]);
  stlRailU(mb, T, 7.95, 22, 27, 3); stlRailU(mb, T, 14.05, 22, 27, 3); stlRailV(mb, T, 21.95, 8, 14, 3); stlRailV(mb, T, 27.05, 8, 14, 3);
  stlWallU(mb, T, D - t, D, 15.75, W2, 3, 1, [], B2, 'brick'); stlWallV(mb, T, W2 - t, W2, t, D - t, 3, 1, [], B2, 'brick');
  for (const [u, v, k, r] of [[20, 16, 'boiler', 0], [26, 16, 'boiler', 0], [24, 4.5, 'crates', 0], [29, 8, 'drums', 0]]) stlMachine(mb, T, u, v, 0, k, r);
  for (const [u, v, k, r] of [[21, 6, 'crates', 0], [26.5, 3.2, 'sandbags', 0]]) stlMachine(mb, T, u, v, 1, k, r);
  for (const [u, v, k] of [[19, 4, 'sandbags'], [30, 18, 'rubble']]) stlMachine(mb, T, u, v, 3, k, 0);
  // muro del reparto verso il tetto delle caldaie (porta al 3° piano)
  stlWallV(mb, T, 15.75, 16.25, t, 9.5, 3, 1.1, [{ a: 3, b: 4.6, lo: 0, hi: 1.1 }], B2, 'brick');
  stlWallV(mb, T, -16.25, -15.75, t, 9.5, 3, FH, [{ a: 3, b: 4.4, lo: 0, hi: 2.3 }], B2, 'brick');
  // --- cortile interno sul retro, ciminiera spezzata, muro di cinta ---
  stlYard(mb, T, B2);
  { const p = snpW(T, 25, D + 6); mb.mat = 'plaster'; mb.add(U.cyl12, B2, p.x, SNP.G + 12, p.z, 0, 0, 0, 2.2, 24, 2.2); mb.add(U.cyl12, B, p.x, SNP.G + 26, p.z, 0, 0, .06, 1.8, 6, 1.8); mb.add(U.cyl12, STL_MAT.brickDk, p.x + .4, SNP.G + 29.5, p.z, .3, 0, .2, 1.6, 2, 1.6); addSolid(p.x - 2.2, SNP.G, p.z - 2.2, p.x + 2.2, SNP.G + 32, p.z + 2.2, 'tower'); STL.smokes.push([p.x, SNP.G + 31, p.z, 1.2]); }
  // insegna dipinta sul fronte
  stlSign(T, 0, 'КРАСНЫЙ ОКТЯБРЬ', '#e8dcc0', '#5a2418', 3 * FH + .5);
  addTiled(mb, 50);
}
// rampa singola (scale di ferro del reparto): da uA (piano L) a uB (piano L+1) nella striscia s
function stlFlight(mb, team, uA, uB, s, L, metal) {
  const FH = SNP.FH, n = 15, y0 = L * FH, lo = Math.min(uA, uB), hi = Math.max(uA, uB);
  for (let i = 0; i < n; i++) { const k = (i + .5) / n, u = uA + (uB - uA) * k, yt = y0 + (i + 1) * FH / n; mb.mat = 'paint'; snpBox(mb, team, u - (hi - lo) / n / 2, u + (hi - lo) / n / 2, s[0], s[1], yt - .08, yt, STL_MAT.steel, false); }
  mb.mat = 'paint'; snpBox(mb, team, lo, hi, s[0] - .06, s[0], y0, y0 + FH + 1, STL_MAT.rust, false);
  const [x0, x1, z0, z1] = snpBoxW(team, lo, hi, s[0], s[1]);
  SNP.floors.push({ x0, x1, z0, z1, ramp: { axis: 'x', c0: snpW(team, uA, 0).x, c1: snpW(team, uB, 0).x, y0: SNP.G + y0, y1: SNP.G + y0 + FH } });
  const vm = (s[0] + s[1]) / 2, dir = Math.sign(uB - uA);
  STL.links.push([team, uA - dir * 1.3, vm, L, uB + dir * 1.3, vm, L + 1]);
}
function stlYard(mb, team, c) {
  const W2 = SNP.W / 2, D = SNP.D, Y = SNP.YARD;
  mb.mat = 'plaster'; snpBox(mb, team, -W2, W2, D + Y, D + Y + .5, 0, 3.4, c); snpBox(mb, team, -W2 - .5, -W2, D, D + Y + .5, 0, 3.4, c); snpBox(mb, team, W2, W2 + .5, D, D + Y + .5, 0, 3.4, c);
  for (const [u, v, k] of [[-20, D + 4, 'crates'], [-6, D + 8, 'drums'], [8, D + 3.5, 'rubble'], [14, D + 9, 'snowdrift'], [-26, D + 9, 'snowdrift']]) stlMachine(mb, team, u, v, 0, k, srand(0, 1));
  for (const u of [-24, -12, 0, 12]) STL.spawnSpots.push([team, u, D + 6, 0]);
}
function stlSign(team, u, text, fg, bg, y) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 96); g.fillStyle = fg; g.font = '600 64px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 50);
  const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), new THREE.MeshStandardMaterial({ map: tx, roughness: .95 }));
  const p = snpW(team, u, -.05); m.position.set(p.x, SNP.G + y, p.z); m.rotation.y = team === 'A' ? 0 : PI; scene.add(m);
}

// ---------- COMPLESSO TEDESCO: magazzino, torre della centrale, sala turbine (squadra E) ----------
function stlGerman() {
  const T = 'E', mb = new MB(), FH = SNP.FH, W2 = 32, D = 26, t = .5, C1 = STL_MAT.conc, C2 = STL_MAT.conc2, BD = 0x5a3a30;
  // --- magazzino (u −32…−12): piano terra e ballatoio al 1° piano, tetto a shed ---
  const wFac = [
    [['slit', -30.2], ['slit', -27.6], ['board', -23.4], ['slit', -19.4], ['slit', -16.8], ['low', -13.8]],
    [['mid', -29.4], ['slit', -25.8], ['big', -21.4], ['slit', -16.6], ['slit', -14]],
  ];
  for (let L = 0; L < 2; L++) stlFacade(mb, T, -W2, -12, L, wFac[L], BD, 'brick');
  stlWallU(mb, T, 0, .5, -W2, -12, 2, 1.4, [], BD, 'brick');
  for (let L = 0; L < 2; L++) { stlWallU(mb, T, D - t, D, -W2, -12, L, FH, L === 0 ? [{ a: -26, b: -22, lo: 0, hi: 3.4 }] : [], BD, 'brick'); stlWallV(mb, T, -W2, -W2 + t, t, D - t, L, FH, [], BD, 'brick'); }
  stlSlab(mb, T, -W2 + t, -12.25, t, D - t, 0, 'conc');
  stlSlab(mb, T, -W2 + t, -12.25, t, 6, 1, 'plank'); stlSlab(mb, T, -W2 + t, -28.5, 6, 20, 1, 'plank');
  stlRailU(mb, T, 6.05, -26.6, -12.25, 1); stlRailV(mb, T, -28.45, 8.2, 20, 1);
  stlFlight(mb, T, -18, -27, [6.6, 8.2], 0, false);   // scala di legno del magazzino: piano terra → ballatoio
  stlSlab(mb, T, -28.5, -26.6, 6, 8.2, 1, 'plank');
  // tetto a shed: denti di sega in lamiera e vetri rotti
  mb.mat = 'paint'; for (let v = 2; v < D - 2; v += 5) { const p = snpW(T, -22, v); mb.add(U.box, 0x4a4c4a, p.x, SNP.G + 2 * FH + .4, p.z, -.45, 0, 0, 19.6, .1, 5.4); }
  for (const [u, v, k, r] of [[-26, 14, 'crates', 0], [-20, 16, 'crates', .4], [-15, 21, 'drums', 0], [-22, 22, 'rubble', 0], [-30, 3.5, 'sandbags', 0], [-17, 4, 'crates', 0], [-24, 11, 'snowdrift', 0]]) stlMachine(mb, T, u, v, 0, k, r);
  for (const [u, v, k] of [[-24, 3.6, 'crates'], [-14.5, 4, 'sandbags'], [-30, 12, 'drums']]) stlMachine(mb, T, u, v, 1, k, 0);
  // --- torre della centrale (u −12…2): 4 piani in cemento, scala a rampe, serbatoio in cima ---
  const tS1 = [20.2, 21.8], tS2 = [22.2, 23.8];
  const tHoles = stlStairs(mb, T, -9.5, -.5, tS1, tS2, 0, 3, false);
  const tFac = [
    [['low', -8.6], ['slit', -4.6], ['low', -1]],
    [['mid', -9], ['mid', -5], ['slit', -1.6]],
    [['mid', -10.2], ['breach', -6.4], ['slit', -1.4]],
    [['mid', -9.2], ['slit', -5.6], ['mid', -1.8]],
  ];
  for (let L = 0; L < 4; L++) {
    stlFacade(mb, T, -12, 2, L, tFac[L], L === 2 ? C2 : C1, 'concrete');
    stlWallU(mb, T, D - t, D, -12, 2, L, FH, L === 0 ? [{ a: -6, b: -4.6, lo: 0, hi: 2.3 }] : stlOps([['slit', -6]]), C2, 'concrete');
    const dvW = [[12, 13.4], [3, 4.4], null, null][L], dvE = [[10, 11.4], [1.6, 3], [.7, 2], [3, 4.4]][L];
    stlWallV(mb, T, -12.25, -11.75, t, D - t, L, FH, dvW ? [{ a: dvW[0], b: dvW[1], lo: 0, hi: 2.3 }] : [], C2, 'concrete');
    stlWallV(mb, T, 1.75, 2.25, t, D - t, L, FH, [{ a: dvE[0], b: dvE[1], lo: 0, hi: 2.3 }], C2, 'concrete');
    stlWallU(mb, T, 9, 9.3, -11.75, 1.75, L, FH, [{ a: -7, b: -5.8, lo: 0, hi: 2.2 }, { a: -2.4, b: -1.2, lo: 0, hi: 2.2 }], 0x9a968c, 'plaster');
    stlSlab(mb, T, -11.75, 1.75, t, D - t, L, 'conc', tHoles[L]);
  }
  // tetto della torre non praticabile (stesso numero di livelli dei sovietici)
  mb.mat = 'plaster'; snpBox(mb, T, -12, 2, 0, D, 4 * FH, 4 * FH + .4, C1); snpBox(mb, T, -12.2, 2.2, -.2, .3, 4 * FH + .4, 4 * FH + 1.2, C2);
  { const p = snpW(T, -5, 14); mb.mat = 'paint'; mb.add(U.cyl12, 0x5a5650, p.x, SNP.G + 4 * FH + 2, p.z, 0, 0, 0, 2.6, 4, 2.6); addSolid(p.x - 2.6, SNP.G + 4 * FH, p.z - 2.6, p.x + 2.6, SNP.G + 4 * FH + 4, p.z + 2.6, 'tower'); }
  for (let L = 0; L < 4; L++) stlMachine(mb, T, [-9, -3, -8, -2][L], [5, 4.5, 5.5, 6][L], L, ['crates', 'sandbags', 'rubble', 'drums'][L], 0);
  // --- sala turbine (u 2…32): turbine, carroponte al 1°, passerella delle lunette al 2°, tetto in cemento ---
  const uS1 = [21.4, 23], uS2 = [19.6, 21.2];
  const uHoles = stlStairs(mb, T, 19.5, 28.5, uS1, uS2, 0, 3, true);
  const uFac = [
    [['low', 4.6], ['low', 9.2], ['breach', 14.2], ['low', 19.6], ['slit', 23.4], ['low', 27.4], ['slit', 30.6]],
    [['big', 5.4], ['big', 11.2], ['slit', 15.6], ['big', 20.6], ['board', 27]],
    [['lune', 4.8], ['lune', 10.6], ['hole', 16.4], ['lune', 22.4], ['lune', 28.2], ['slit', 30.9]],
    [['gap', 6], ['gap', 15.4], ['gap', 21], ['gap', 25.8], ['gap', 30.2]],
  ];
  for (let L = 0; L < 4; L++) stlFacade(mb, T, 2, W2, L, uFac[L], L % 2 ? C2 : C1, 'concrete', L === 3 ? 1 : FH);
  for (let L = 0; L < 3; L++) { stlWallU(mb, T, D - t, D, 2, W2, L, FH, L === 0 ? [{ a: 8, b: 11, lo: 0, hi: 3.2 }] : stlOps([['lune', 10]]), C2, 'concrete'); stlWallV(mb, T, W2 - t, W2, t, D - t, L, FH, [], C2, 'concrete'); }
  stlWallU(mb, T, D - t, D, 2, W2, 3, 1, [], C2, 'concrete'); stlWallV(mb, T, W2 - t, W2, t, D - t, 3, 1, [], C2, 'concrete');
  stlSlab(mb, T, 2.25, W2 - t, t, D - t, 0, 'conc');
  stlSlab(mb, T, 2.25, W2 - t, t, 4, 1, 'grate'); stlSlab(mb, T, 28.5, W2 - t, 4, 23, 1, 'grate'); stlSlab(mb, T, 16.25, 19.5, 19.6, 23, 1, 'grate');
  stlRailU(mb, T, 4.05, 2.25, 28.4, 1); stlRailV(mb, T, 28.45, 4, 19.5, 1);
  stlSlab(mb, T, 2.25, W2 - t, t, 2.1, 2, 'grate'); stlSlab(mb, T, 16.25, 18.25, 2.1, 19.6, 2, 'grate'); stlSlab(mb, T, 16.25, 19.5, 19.6, 23, 2, 'grate'); stlSlab(mb, T, 28.5, W2 - t, 19.6, 23, 2, 'grate');
  stlRailU(mb, T, 2.15, 2.25, 16.2, 2); stlRailU(mb, T, 2.15, 18.3, W2 - t, 2); stlRailV(mb, T, 18.3, 2.1, 19.5, 2);
  const tuH = [[5, 12, 2.5, 9], [20, 26, 6, 12]];
  stlSlab(mb, T, 2.25, W2 - t, t, 14, 3, 'conc', [...tuH, [19.5, 28.5, ...uS1]]);
  stlSlab(mb, T, 16.25, W2 - t, 14, D - t, 3, 'conc', [[19.5, 28.5, ...uS1]]);
  for (const h of tuH) { stlRailU(mb, T, h[2] - .05, h[0], h[1], 3); stlRailU(mb, T, h[3] + .05, h[0], h[1], 3); stlRailV(mb, T, h[0] - .05, h[2], h[3], 3); stlRailV(mb, T, h[1] + .05, h[2], h[3], 3); }
  stlRailU(mb, T, 14.05, 2.25, 16.2, 3); stlRailV(mb, T, 16.2, 14, D - t, 3);
  for (const [u, v, k, r] of [[8, 15, 'turbine', 0], [14, 15, 'turbine', 0], [24, 8, 'transformer', 0], [27, 13, 'transformer', 0], [5, 22, 'crates', 0], [11, 5, 'sandbags', 0], [22, 4.2, 'rubble', 0], [6, 9, 'snowdrift', 0]]) stlMachine(mb, T, u, v, 0, k, r);
  for (const [u, v, k] of [[9, 2.6, 'crates'], [24, 2.8, 'sandbags']]) stlMachine(mb, T, u, v, 1, k, 0);
  for (const [u, v, k] of [[3.6, 5, 'crates'], [14, 10, 'sandbags'], [30, 4, 'rubble'], [18, 20, 'snowdrift']]) stlMachine(mb, T, u, v, 3, k, 0);
  mb.mat = 'paint'; for (const v of [3.8, 24.6]) snpBox(mb, T, 2.4, 31.4, v - .25, v + .25, 3 * FH + .6, 3 * FH + 1.2, STL_MAT.steel, false);
  { const p = snpW(T, 12, 11); mb.add(U.box, 0xb08a20, p.x, SNP.G + 3 * FH + .9, p.z, 0, 0, 0, 1.2, .9, 20); }   // carroponte giallo
  stlMachine(mb, T, 10, 25.2, 0, 'pipes', 0);
  stlYard(mb, T, C2);
  stlSign(T, 17, 'KRAFTWERK — DIENSTSTELLE 9', '#1c1c1a', '#c8c2b0', 3 * FH + .5);
  addTiled(mb, 50);
}

// ---------- scalo ferroviario centrale: solo scenografia, nessun passaggio ----------
function stlRailyard() {
  const mb = new MB(), G = SNP.G, zA = SNP.FRONT.A, zE = SNP.FRONT.E;
  // binari: traversine e rotaie; alcuni tratti divelti
  for (const rz of STL_RAILS) {
    for (let x = -78; x < 78; x += .9) { if (SNP_RNG() < .05) continue; const y = stlH(x, rz); mb.mat = 'wood'; mb.add(U.box, 0x3a3026, x, y + .06, rz, 0, srand(-.05, .05), 0, .24, .14, 2.5); }
    for (const o of [-.72, .72]) { let x = -78; while (x < 78) { const len = srand(10, 30), bend = SNP_RNG() < .12; mb.mat = 'paint'; const p = new V3(x + len / 2, stlH(x + len / 2, rz + o) + .18, rz + o); mb.add(U.box, 0x4a4440, p.x, p.y + (bend ? .4 : 0), p.z, 0, bend ? .08 : 0, bend ? .1 : 0, len, .14, .08); x += len + (SNP_RNG() < .1 ? 3 : 0); } }
  }
  // vagoni merci: sventrati, rovesciati, bruciati
  const wagon = (x, z, r, roll, burnt) => {
    const y = stlH(x, z), c = burnt ? 0x2a2522 : spick([0x5a3a2a, 0x4a3426, 0x6a4430]);
    mb.setBase(x, y, z, 0, r, roll);
    mb.mat = 'wood'; mb.add(U.box, c, 0, 2, 0, 0, 0, 0, 10, 2.6, 2.8); mb.add(U.box, 0x3a3a38, 0, 3.4, 0, 0, 0, 0, 10.2, .2, 3);
    mb.add(U.box, 0x1e1a18, 1, 2, 1.42, 0, 0, 0, 2.6, 2.2, .04);
    mb.mat = 'paint'; for (const sx of [-3.5, 3.5]) for (const sz of [-1, 1]) mb.add(U.cyl12, 0x1c1c1a, sx, .5, sz * .75, PI / 2, 0, 0, .45, .14, .45);
    mb.add(U.box, 0x2a2826, 0, .7, 0, 0, 0, 0, 10.4, .3, 1.8);
    mb.clearBase();
    if (!roll) mb.add(U.box, STL_MAT.snow, x, y + 3.55, z, 0, r, 0, 9.6, .1, 2.6);
    const hx = Math.abs(Math.cos(r)) * 5.2 + Math.abs(Math.sin(r)) * 1.5, hz = Math.abs(Math.sin(r)) * 5.2 + Math.abs(Math.cos(r)) * 1.5;
    addSolid(x - hx, y - .5, z - hz, x + hx, y + (roll ? 2.8 : 3.5), z + hz, 'tank');
  };
  for (const [x, z, r, roll, b] of [[-40, -171, 0, 0, 0], [-29, -171, 0, 0, 1], [-14, -163, .05, 0, 0], [24, -163, 0, 0, 0], [35, -163, .02, 0, 1], [-8, -145, 0, 1.45, 1], [44, -137, .3, 0, 0], [-46, -129, -.1, 0, 0], [16, -129, 0, 0, 1]]) wagon(x, z, r, roll, b);
  // locomotiva deragliata
  { const x = 6, z = -154, y = stlH(x, z); mb.setBase(x, y, z, 0, .25, .18); mb.mat = 'paint';
    mb.add(U.cyl12, 0x1e1e1c, 0, 2.4, 0, 0, 0, PI / 2, 1.1, 8, 1.1); mb.add(U.box, 0x1e1e1c, 4.6, 2.8, 0, 0, 0, 0, 2.6, 3, 2.8); mb.add(U.box, 0x262422, 5, 4.4, 0, 0, 0, 0, 3.2, .2, 3.2);
    mb.add(U.cyl12, 0x1e1e1c, -3, 4, 0, 0, 0, 0, .35, 1.4, .35); mb.add(U.box, 0x6a1a14, -4.1, 1.2, 0, 0, 0, 0, .3, .8, 2.6);
    for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) mb.add(U.cyl12, 0x2a2826, -2.4 + i * 1.6, .85, sz * 1, PI / 2, 0, 0, .75, .12, .75);
    mb.add(U.box, 0x2a2826, 0, 1, 0, 0, 0, 0, 9, .4, 2);
    mb.clearBase(); addSolid(x - 5, y - .5, z - 2.4, x + 7, y + 4.5, z + 2.4, 'tank'); STL.smokes.push([x - 3, y + 5, z, .6]); }
  // carro cisterna bruciato e pianale con un T-34 distrutto
  { const x = -24, z = -155, y = stlH(x, z); mb.setBase(x, y, z, 0, -.1, 0); mb.mat = 'paint'; mb.add(U.cyl12, 0x2a2624, 0, 2.2, 0, 0, 0, PI / 2, 1.4, 9, 1.4); mb.add(U.box, 0x1e1c1a, 0, .8, 0, 0, 0, 0, 9.6, .3, 2); mb.clearBase(); addSolid(x - 5, y - .5, z - 1.6, x + 5, y + 3.6, z + 1.6, 'tank'); }
  { const x = 30, z = -145, y = stlH(x, z); mb.setBase(x, y, z, 0, 0, 0); mb.mat = 'paint'; mb.add(U.box, 0x2a2826, 0, 1, 0, 0, 0, 0, 12, .35, 2.8);
    mb.setBase(x + 1, y + 1.2, z, 0, .4, .1); mb.add(U.box, 0x2e3a28, 0, .8, 0, 0, 0, 0, 5.8, 1, 3); mb.add(U.box, 0x2e3a28, -2.5, .7, 0, 0, 0, -.5, 1.2, .9, 3); mb.add(U.cyl12, 0x2e3a28, .5, 1.6, 0, 0, 0, 0, 1.1, .7, 1.1); mb.add(U.cyl12, 0x2a3424, -2.5, 1.65, 0, 0, 0, PI / 2 + .2, .09, 3.2, .09);
    for (const sz of [-1.45, 1.45]) mb.add(U.box, 0x1c1c1a, 0, .45, sz, 0, 0, 0, 5.6, .9, .5);
    mb.clearBase(); addSolid(x - 6, y - .5, z - 1.6, x + 6, y + 3.6, z + 1.6, 'tank'); STL.smokes.push([x + 1, y + 3, z, .5]); }
  // semicingolato tedesco ribaltato
  { const x = -38, z = -140; if (!HT_GEO_DONE && typeof buildHalftrackGeo === 'function') { try { HT_GEO_DONE = buildHalftrackGeo(); } catch (e) { HT_GEO_DONE = null; } }
    if (HT_GEO_DONE) { const g = groupMesh(HT_GEO_DONE); burnMeshes(g); g.position.set(x, stlH(x, z) + .8, z); g.rotation.set(0, 1.1, 2.6); scene.add(g); }
    addSolid(x - 3, SNP.G - .5, z - 3, x + 3, SNP.G + 2.2, z + 3, 'tank'); }
  // barriere di cemento, filo spinato, cumuli di neve e macerie
  mb.mat = 'concrete';
  for (const [x, z, r] of [[-60, -150, .2], [-56, -134, -.3], [58, -165, .1], [54, -128, .5], [-2, -136, 1.2], [22, -172, .4], [-52, -170, 1]]) { const y = stlH(x, z); for (let k = 0; k < 3; k++) mb.add(U.box, STL_MAT.conc, x + Math.cos(r) * k * 1.7, y + .55, z + Math.sin(r) * k * 1.7, 0, -r + srand(-.15, .15), srand(-.05, .05), 1.6, 1.1, .7); addSolid(x - 3, y - .5, z - 3, x + 3, y + 1.1, z + 3, 'wall'); }
  mb.mat = 'paint'; for (const z of [zA - 8, zE + 8]) for (let x = -60; x < 60; x += 2.2) { const y = stlH(x, z); mb.add(U.cyl, 0x2a2826, x, y + .6, z, srand(-.1, .1), 0, srand(-.1, .1), .04, 1.2, .04); for (const h of [.35, .75, 1.1]) mb.add(U.box, 0x3a3634, x + 1.1, y + h, z, 0, 0, srand(-.05, .05), 2.2, .015, .015); }
  for (let i = 0; i < 30; i++) { const x = srand(-70, 70), z = srand(zE + 4, zA - 4), y = stlH(x, z); mb.mat = 'brick'; for (let k = 0; k < 6; k++) mb.add(U.box, spick([0x7a3a2a, 0x8a4a36, 0x6a5a4c, 0x8c8a84]), x + srand(-1.6, 1.6), y + srand(.05, .5), z + srand(-1.6, 1.6), srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.4, 1), srand(.25, .5), srand(.3, .8)); mb.mat = 'plaster'; mb.add(U.sph, STL_MAT.snow, x, y + .1, z, 0, 0, 0, srand(1.5, 2.6), srand(.25, .5), srand(1.2, 2)); }
  // gru ferroviaria rovesciata e torri dell'acqua in lontananza
  { const x = -2, z = -168, y = stlH(x, z); mb.mat = 'paint'; mb.add(U.box, 0x3a2e24, x, y + 1.2, z, 0, .3, 0, 7, 2, 2.6); mb.add(U.box, STL_MAT.rust, x + 4, y + .6, z + 2, .1, .9, 1.35, .5, .5, 12); addSolid(x - 4, y - .5, z - 2, x + 4, y + 2.4, z + 2, 'tank'); }
  // marciapiedi di carico davanti alle due fabbriche
  mb.mat = 'concrete'; for (const z of [zA - 2.2, zE + 2.2]) mb.add(U.box, STL_MAT.conc2, 0, G + .25, z, 0, 0, 0, 66, .5, 3);
  for (const z of [zA - 2.2, zE + 2.2]) addSolid(-33, G - 1, z - 1.5, 33, G + .5, z + 1.5, 'wall');
  addTiled(mb, 50);
  // città distrutta tutt'intorno: palazzi sventrati, ciminiere, colonne di fumo
  const far = new MB();
  for (let i = 0; i < 14; i++) for (const side of [-1, 1]) {
    const x = side * srand(42, 80), z = srand(zE - 30, zA + 30); if (Math.abs(x) < 40) continue;
    cityHouseGeo(far, { cx: x, cz: z, w: srand(10, 18), d: srand(10, 16), ht: spick([9.3, 12.4, 15.5]), face: side, style: 2, base: stlH(x, z) - .2 }, true);
    addSolid(x - 5, SNP.G - 1, z - 5, x + 5, SNP.G + 9, z + 5, 'house');
  }
  for (let i = 0; i < 10; i++) { const x = srand(-90, 90), z = SNP.C.z + (i % 2 ? 1 : -1) * srand(100, 140); cityHouseGeo(far, { cx: x, cz: z, w: srand(12, 22), d: 12, ht: spick([12.4, 15.5, 18.6]), face: i % 2 ? -1 : 1, style: 2, base: stlH(x, z) - .2 }, SNP_RNG() < .7); }
  for (const [x, z, h] of [[-70, -230, 26], [80, -60, 30], [-90, -90, 22], [60, -250, 28]]) { far.mat = 'plaster'; far.add(U.cyl12, 0x5a3026, x, SNP.G + h / 2, z, 0, 0, 0, 1.6, h, 1.6); STL.smokes.push([x, SNP.G + h, z, 1.4]); }
  for (const [x, z] of [[-48, -120], [52, -178], [-20, -95], [30, -205], [64, -150], [-66, -160]]) STL.smokes.push([x, SNP.G + 3, z, 1]);
  addTiled(far, 80);
}
let HT_GEO_DONE = null;

// ---------- navigazione, postazioni, rinascite ----------
function stlNav(team) {
  const FH = SNP.FH, nodes = SNP.nav[team];
  const add = (u, v, L, tag) => { const p = snpW(team, u, v); const n = { id: nodes.length, team, L, pos: new V3(p.x, SNP.G + L * FH, p.z), tag: tag || '', e: [] }; nodes.push(n); return n; };
  // porte (su entrambi i lati del muro), capi delle scale, cortile
  for (const d of STL.doors) if (d.team === team) { if (d.ax === 'u') { add(d.u, d.v - .7, d.L, 'door'); add(d.u, d.v + .7, d.L, 'door'); } else { add(d.u - .7, d.v, d.L, 'door'); add(d.u + .7, d.v, d.L, 'door'); } }
  const ends = [];
  for (const [tm, ua, va, La, ub, vb, Lb] of STL.links) if (tm === team) ends.push([add(ua, va, La, 'land'), add(ub, vb, Lb, 'land')]);
  for (const [tm, u, v, L] of STL.spawnSpots) if (tm === team) add(u, v, L, 'yard');
  for (const u of [-28, -20, 20, 28]) add(u, 15, 0, 'spawn');
  // postazioni: dietro ogni apertura della facciata dove c'è pavimento; "fondo stanza" dietro i finestroni
  const post = (u, v, L, stance, kind, cover, expo) => {
    const p = snpW(team, u, v), pos = new V3(p.x, SNP.G + L * FH, p.z);
    if (Math.abs(snpFloor(pos.x, pos.z, pos.y + .1) - pos.y) > .2) return null;
    const n = add(u, v, L, 'post');
    const ps = { id: SNP.posts.length, team, L, pos, eye: pos.clone().setY(pos.y + [1.58, 1.02, .4][stance]), yaw: team === 'A' ? 0 : PI, stance, kind, cover, expo, sees: [], node: n.id, occ: null, heat: 0 };
    n.post = ps.id; SNP.posts.push(ps); return ps;
  };
  const NAME = { big: 'finestrone', low: 'finestra bassa', slit: 'feritoia', board: 'finestra sbarrata', breach: 'breccia', hole: 'squarcio', lune: 'lunetta', gap: 'tetto', mid: 'finestra' };
  const COV = { big: [.45, .75], low: [.7, .45], slit: [.9, .2], board: [.8, .35], breach: [.5, .6], hole: [.65, .45], lune: [.6, .5], gap: [.4, .85], mid: [.6, .5] };
  for (const o of STL.posts) {
    if (o.team !== team) continue;
    const [cv, ex] = COV[o.kind];
    post(o.u, 1.1, o.L, o.st, NAME[o.kind], cv, ex);
    if (o.kind === 'big' || o.kind === 'lune' || o.kind === 'hole') post(o.u + (SNP_RNG() < .5 ? -.5 : .5), 4.6, o.L, 0, 'fondo stanza', .85, .2);
  }
  const grid = [];
  for (let L = 0; L <= 3; L++) grid.push({ L, u0: -31.3, u1: 31.3, v0: .95, v1: L === 0 ? SNP.D + SNP.YARD - .6 : SNP.D - .7 });
  // le rampe: collegamento diretto tra i due capi (prima di scartare le zone isolate)
  snpNavFinish(team, nodes, add, grid, n => n.tag === 'yard' || n.tag === 'spawn', () => { for (const [a, b] of ends) if (!a.dead && !b.dead) { a.e.push(b.id); b.e.push(a.id); a.stair = b.stair = true; } });
}
// rinascite al riparo: scartate quelle visibili da una postazione nemica
function stlSafeSpawns() {
  for (const team of ['A', 'E']) {
    const enemy = SNP.posts.filter(p => p.team !== team), all = SNP.spawns[team];
    const vis = n => { const h = n.pos.clone(); h.y += 1.5; let c = 0; for (const p of enemy) if (p.eye.distanceTo(h) < 200 && losClear(p.eye, h)) c++; return c; };
    const scored = all.map(n => [n, vis(n)]), safe = scored.filter(s => s[1] === 0).map(s => s[0]);
    SNP.spawns[team] = safe.length >= 3 ? safe : scored.sort((a, b) => a[1] - b[1]).slice(0, 4).map(s => s[0]);
  }
}

// ---------- uniformi: sovietici con telogrejka e SSh-40, tedeschi in grigio invernale ----------
function stlUniforms() {
  Object.assign(SCOL2.A, { jacket: 0x5c5a42, jacket2: 0x4e4c36, pants: 0x55523c, web: 0x5a4a32, pack: 0x6a6448, helm: 0x47533a, net: 0x47533a, legging: 0x2e2a24, boot: 0x2a2420, belt2: 0x5a4a32 });
  Object.assign(SCOL2.E, { jacket: 0x5a5e58, jacket2: 0x4c504a, pants: 0x50544e, helm: 0x8a8e88, net: 0x6a6e68 });
}

function stlBuild() {
  STL.posts.length = 0; STL.doors.length = 0; STL.links.length = 0; STL.spawnSpots.length = 0; STL.smokes.length = 0;
  stlUniforms();
  stlRailyard();
  stlSoviet(); stlGerman();
  stlNav('A'); stlNav('E');
  snpComputeSees();
  stlSafeSpawns();
  // cielo d'inverno: luce fredda e bassa, foschia grigio-azzurra, neve che cade
  FOG_COL.setRGB(.6, .64, .7); scene.fog.color.copy(FOG_COL); FOG_K = 1.25; scene.fog.density = FOG_BASE * FOG_K;
  if (sun) { sun.intensity *= .5; sun.color.setRGB(.85, .9, 1); }
  try { buildSnowfall(false); } catch (e) { }
}
SNP_MAPS.stalingrado = {
  name: 'Stalingrado', date: 'Inverno 1942 — Stalingrado, quartiere delle fabbriche', GAP: 90, W: 64, D: 26, FH: 4.5, YARD: 12,
  H: stlH, splat: stlSplat, build: stlBuild, smoke: stlSmoke,
  sideA: 'Fabbrica «Ottobre Rosso»', sideE: 'Centrale elettrica', teamA: 'SOVIETICI', teamE: 'TEDESCHI',
  guns: { A: ['mosin', 'svt40'], E: ['kar98zf', 'g43'] },
  names: { A: ['Vasilij', 'Nikolaj', 'Ivan', 'Sergej', 'Aleksej', 'Dmitrij', 'Pavel', 'Michail', 'Jurij', 'Grigorij', 'Anatolij', 'Boris', 'Viktor', 'Oleg', 'Fëdor', 'Leonid'] },
};
