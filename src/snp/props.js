"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — arredi e oggetti: mobili dentro i
//  palazzi (intatti, rovesciati, sfondati) e oggetti distrutti
//  per la strada. Numeri casuali fissi: uguali su ogni PC.
//  I mobili alti e i tavoli sono solidi (riparo e collisione).
// ============================================================

// oggetto composto in coordinate locali del palazzo (u, v, quota del piano), ruotato di r
function snpProp(mb, team, u, v, y, r, parts, solid) {
  const p = snpW(team, u, v), ry = r + (team === 'E' ? PI : 0);
  mb.setBase(p.x, SNP.G + y, p.z, 0, ry, 0);
  for (const q of parts) { mb.mat = q[0]; mb.add(q[1] || U.box, q[2], q[3], q[4], q[5], q[6] || 0, q[7] || 0, q[8] || 0, q[9], q[10], q[11]); }
  mb.clearBase();
  if (solid) {   // ingombro solido: [larghezza, profondità, altezza] allineato alla rotazione più vicina
    const [w, d, h] = solid, q = Math.abs(Math.round(ry / (PI / 2))) % 2, hx = (q ? d : w) / 2, hz = (q ? w : d) / 2;
    addSolid(p.x - hx, SNP.G + y, p.z - hz, p.x + hx, SNP.G + y + h, p.z + hz, 'crate');
  }
}
// oggetto in coordinate del mondo (strada)
function snpPropW(mb, x, z, r, parts, solid, y) {
  const gy = y !== undefined ? y : snpH(x, z);
  mb.setBase(x, gy, z, 0, r, 0);
  for (const q of parts) { mb.mat = q[0]; mb.add(q[1] || U.box, q[2], q[3], q[4], q[5], q[6] || 0, q[7] || 0, q[8] || 0, q[9], q[10], q[11]); }
  mb.clearBase();
  if (solid) { const [w, d, h] = solid, q = Math.abs(Math.round(r / (PI / 2))) % 2, hx = (q ? d : w) / 2, hz = (q ? w : d) / 2; addSolid(x - hx, gy - .5, z - hz, x + hx, gy + h, z + hz, 'crate'); }
}

// ---------- mobili ----------
const WD = 0x5a3e2a, WD2 = 0x6e4c32, WD3 = 0x3e2a1e;
const PROPS = {
  table: (broken) => broken
    ? [['wood', 0, WD2, .2, .5, 0, .3, 0, .4, 1.4, .05, .9], ['wood', 0, WD, .55, .35, .3, 0, 0, 0, .07, .7, .07], ['wood', 0, WD, -.5, .35, -.3, 0, 0, 0, .07, .7, .07], ['wood', 0, WD, -.4, .05, .35, 1.4, .3, 0, .07, .7, .07]]
    : [['wood', 0, WD2, 0, .74, 0, 0, 0, 0, 1.4, .05, .9], ...[[-.62, -.38], [.62, -.38], [-.62, .38], [.62, .38]].map(([x, z]) => ['wood', 0, WD, x, .36, z, 0, 0, 0, .07, .72, .07])],
  tableOver: () => [['wood', 0, WD2, 0, .45, 0, PI / 2, 0, 0, 1.4, .05, .9], ...[[-.62, .3], [.62, .3]].map(([x, y]) => ['wood', 0, WD, x, y + .1, .4, 0, 0, 0, .07, .07, .72])],
  chair: (fallen) => fallen
    ? [['wood', 0, WD, 0, .12, 0, PI / 2, 0, 0, .42, .04, .42], ['wood', 0, WD, 0, .35, -.22, 0, 0, 0, .42, .5, .04], ['wood', 0, WD3, .18, .25, .2, 0, 0, 0, .04, .04, .45]]
    : [['wood', 0, WD, 0, .45, 0, 0, 0, 0, .42, .04, .42], ['wood', 0, WD, 0, .72, .2, 0, 0, 0, .42, .5, .04], ...[[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].map(([x, z]) => ['wood', 0, WD3, x, .22, z, 0, 0, 0, .04, .45, .04])],
  wardrobe: () => [['wood', 0, WD3, 0, 1, 0, 0, 0, 0, 1.2, 2, .55], ['wood', 0, WD2, -.29, 1.05, -.28, 0, 0, 0, .56, 1.75, .02], ['wood', 0, WD2, .29, 1.05, -.28, 0, 0, 0, .56, 1.75, .02], ['wood', 0, WD3, 0, 2.05, 0, 0, 0, 0, 1.3, .1, .62]],
  wardrobeDown: () => [['wood', 0, WD3, 0, .28, 0, 0, 0, 0, 1.2, .55, 2], ['wood', 0, WD2, .2, .02, -.6, 0, .4, 0, .56, .03, 1.7]],
  bed: () => [['wood', 0, WD3, 0, .25, 0, 0, 0, 0, 1.0, .3, 2.0], ['sack', 0, 0xd8d0bc, 0, .46, .05, 0, 0, 0, .92, .14, 1.85], ['sack', 0, 0xb8a888, .05, .55, .3, .05, 0, .04, .95, .06, 1.2], ['wood', 0, WD3, 0, .55, -1, 0, 0, 0, 1.0, .9, .06], ['sack', 0, 0xeee8d8, 0, .58, -.78, 0, 0, 0, .6, .1, .3]],
  desk: () => [['wood', 0, WD2, 0, .76, 0, 0, 0, 0, 1.3, .05, .7], ['wood', 0, WD, -.45, .38, 0, 0, 0, 0, .38, .74, .66], ['wood', 0, WD, .55, .38, 0, 0, 0, 0, .04, .74, .66], ['vc', 0, 0x2a2622, .25, .84, -.05, 0, .3, 0, .35, .12, .28], ['vc', 0, 0xe8e2d0, -.2, .79, .05, 0, .2, 0, .3, .01, .22]],
  shelf: () => [['wood', 0, WD3, 0, 1.1, 0, 0, 0, 0, 1.6, 2.2, .35], ...[.35, .85, 1.35, 1.85].map(y => ['vc', 0, pick3([0x6a3a2a, 0x2a3a4a, 0x4a4a2a, 0x7a6a4a]), 0, y, -.02, 0, 0, 0, 1.4, .3, .25])],
  sofa: () => [['sack', 0, 0x6a3a34, 0, .25, 0, 0, 0, 0, 1.9, .42, .85], ['sack', 0, 0x6a3a34, 0, .62, .34, -.15, 0, 0, 1.9, .55, .2], ['sack', 0, 0x5a3029, -.92, .45, 0, 0, 0, 0, .18, .45, .85], ['sack', 0, 0x5a3029, .92, .45, 0, 0, 0, 0, .18, .45, .85]],
  piano: () => [['wood', 0, 0x1c1714, 0, .7, 0, 0, 0, 0, 1.5, 1.3, .6], ['vc', 0, 0xe8e2d4, 0, .78, -.36, 0, 0, 0, 1.3, .03, .16], ['wood', 0, 0x1c1714, 0, .78, -.36, .05, 0, 0, 1.45, .06, .02]],
  crates: () => [['wood', 0, 0x8a7350, 0, .3, 0, 0, .1, 0, .6, .6, .6], ['wood', 0, 0x7a6448, .5, .25, .3, 0, -.3, 0, .5, .5, .5], ['wood', 0, 0x8a7350, .1, .82, .05, 0, .4, 0, .45, .45, .45]],
  ammo: () => [['paint', 0, 0x4a5236, 0, .13, 0, 0, 0, 0, .3, .26, .16], ['paint', 0, 0x4a5236, .34, .13, .05, 0, .2, 0, .3, .26, .16], ['paint', 0, 0x3a4228, .15, .38, .02, 0, -.1, 0, .3, .24, .16]],
  papers: () => [...Array(7)].map((_, i) => ['vc', 0, i % 3 ? 0xe8e2d0 : 0xd8cfb4, srand(-.9, .9), .012 + i * .002, srand(-.7, .7), 0, srand(0, 3), 0, srand(.2, .32), .004, srand(.25, .32)]),
  lampFall: () => [['paint', U.cyl, 0x2a2a28, 0, .05, 0, 0, 0, PI / 2, .03, 1.3, .03], ['vc', U.sph, 0xd8c890, .7, .1, 0, 0, 0, 0, .18, .12, .18]],
  frame: (c) => [['wood', 0, 0x6a4a2a, 0, 0, 0, 0, 0, 0, .9, .7, .04], ['vc', 0, c, 0, 0, -.025, 0, 0, 0, .78, .58, .01]],
  curtain: () => [['sack', 0, 0x7a2a26, 0, 0, 0, 0, 0, 0, .5, 1.9, .04]],
  counter: (len) => [['wood', 0, WD2, 0, .55, 0, 0, 0, 0, len, 1.1, .7], ['wood', 0, WD3, 0, 1.12, -.05, 0, 0, 0, len + .1, .05, .82], ...[...Array(Math.floor(len / .25))].map((_, i) => ['paint', U.cyl, 0x8a7a50, -len / 2 + .12 + i * .25, 1.5, .15, 0, 0, 0, .012, .75, .012]), ['paint', 0, 0x8a7a50, 0, 1.88, .15, 0, 0, 0, len, .03, .03]],
  cabinet: () => [['wood', 0, WD, 0, .7, 0, 0, 0, 0, 1.4, 1.4, .45], ...[...Array(12)].map((_, i) => ['wood', 0, WD3, -.55 + (i % 6) * .22, .35 + Math.floor(i / 6) * .5, -.23, 0, 0, 0, .18, .38, .02])],
  stove: () => [['paint', 0, 0x2a2826, 0, .45, 0, 0, 0, 0, .6, .9, .55], ['paint', U.cyl, 0x2a2826, 0, 1.6, .1, 0, 0, 0, .07, 1.4, .07]],
  rubbleSmall: () => [...Array(6)].map(() => ['vc', 0, pick3([0x7d6a5a, 0x8a7766, 0xd8d0c0, 0x6a5a4c]), srand(-.5, .5), srand(.03, .12), srand(-.5, .5), srand(-.5, .5), srand(0, 3), srand(-.5, .5), srand(.15, .45), srand(.06, .16), srand(.12, .35)]),
};
function pick3(a) { return a[(SNP_RNG() * a.length) | 0]; }

// ---------- arredamento dei palazzi ----------
// stanze sulla facciata: i mobili stanno lungo i tramezzi e in fondo, lontano dalle finestre e dalle postazioni
function snpFurnish(mb, team) {
  const A = team === 'A', FH = SNP.FH, rooms = [-18, -6, 6, 18];
  const pics = [0x6a7a5a, 0x8a6a4a, 0x4a5a6a, 0x9a8a6a, 0x5a4a3a];
  for (let L = 0; L < 3; L++) rooms.forEach((cu, i) => {
    const y = L * FH, kind = (i + L * 2 + (A ? 0 : 1)) % 4;
    // contro il tramezzo sinistro e destro: armadio, scaffale, letto, scrivania (lontani dalle finestre)
    const side = (s) => cu + s * 5.1;
    if (kind === 0) { snpProp(mb, team, side(-1), 3.2, y, PI / 2, PROPS.wardrobe(), [1.2, .55, 2.1]); snpProp(mb, team, side(1), 4, y, 0, PROPS.bed(), [1, 2, .6]); snpProp(mb, team, cu - 1.5, 4.4, y, .4, PROPS.chair(true)); }
    else if (kind === 1) { snpProp(mb, team, cu + srand(-1, 1), 3.4, y, srand(-.3, .3), PROPS.table(SNP_RNG() < .4), [1.4, .9, .78]); snpProp(mb, team, cu - 1.4, 3.2, y, 1.4, PROPS.chair(false)); snpProp(mb, team, cu + 1.3, 3.8, y, -2, PROPS.chair(true)); snpProp(mb, team, side(-1), 4.5, y, PI / 2, PROPS.shelf(), [1.6, .35, 2.2]); }
    else if (kind === 2) { snpProp(mb, team, side(1), 3.6, y, -PI / 2, PROPS.sofa(), [1.9, .85, .8]); snpProp(mb, team, side(-1), 2.6, y, PI / 2, PROPS.desk(), [1.3, .7, .8]); snpProp(mb, team, side(-1) + .8, 2.8, y, -PI / 2, PROPS.chair(false)); snpProp(mb, team, cu, 4.6, y, 0, PROPS.papers()); }
    else { snpProp(mb, team, side(-1), 3.8, y, 0, PROPS.wardrobeDown(), [1.2, 2, .6]); snpProp(mb, team, side(1), 4.2, y, -PI / 2, PROPS.stove(), [.6, .55, .9]); snpProp(mb, team, cu + .8, 4.8, y, 0, PROPS.lampFall()); snpProp(mb, team, cu - 1, 3.4, y, 0, PROPS.rubbleSmall()); }
    // angoli in fondo: casse, sedie rovesciate, tavolino, lampada caduta
    const corner = [PROPS.crates, () => PROPS.chair(true), PROPS.tableOver, PROPS.lampFall, PROPS.rubbleSmall];
    snpProp(mb, team, cu - 4.4, 6.6, y, srand(0, 3), corner[(i + L) % 5](), (i + L) % 5 === 0 ? [1, 1, .9] : null);
    snpProp(mb, team, cu + 4.4, 6.6, y, srand(0, 3), corner[(i + L + 2) % 5](), (i + L + 2) % 5 === 0 ? [1, 1, .9] : null);
    snpProp(mb, team, cu + srand(-2, 2), srand(5.8, 6.8), y, srand(0, 3), PROPS.papers());
    // quadri sul muro del corridoio, tende strappate ai lati di qualche finestra, calcinacci
    snpProp(mb, team, cu + srand(-3, 3), 7.33, y + 1.8, 0, PROPS.frame(pics[(i + L) % 5]));
    for (const k of [-1, 1]) if (SNP_RNG() < .45) snpProp(mb, team, cu + k * 2.8 + k * .95, .55, y + 1.65, 0, PROPS.curtain());
    if (SNP_RNG() < .6) snpProp(mb, team, cu + srand(-3.5, 3.5), srand(2.2, 6), y, srand(0, 3), PROPS.rubbleSmall());
  });
  // stanze sul retro: camere dell'albergo o uffici postali
  for (let L = 0; L < 3; L++) for (const s of [-1, 1]) {
    const y = L * FH;
    if (A) { snpProp(mb, team, s * 20.5, 15, y, PI / 2 * s, PROPS.bed(), [1, 2, .6]); snpProp(mb, team, s * 13, 18.5, y, 0, PROPS.desk(), [1.3, .7, .8]); snpProp(mb, team, s * 13, 17.7, y, PI, PROPS.chair(SNP_RNG() < .5)); }
    else { snpProp(mb, team, s * 20.5, 15.5, y, PI / 2 * s, PROPS.cabinet(), [1.4, .45, 1.4]); snpProp(mb, team, s * 13, 18.5, y, 0, PROPS.desk(), [1.3, .7, .8]); snpProp(mb, team, s * 10.5, 14, y, 0, PROPS.crates(), [1, 1, .9]); }
    snpProp(mb, team, s * 16, 13, y, srand(0, 3), PROPS.papers());
  }
  // piano terra: reception dell'albergo o sportelli delle Poste nel corridoio sul lato
  if (A) { snpProp(mb, team, -18, 15, 0, 0, PROPS.counter(3.2), [3.2, .7, 1.15]); snpProp(mb, team, 18, 16, 0, -PI / 2, PROPS.piano(), [1.5, .6, 1.4]); }
  else { snpProp(mb, team, -18, 15.5, 0, 0, PROPS.counter(5), [5, .7, 1.15]); snpProp(mb, team, 18, 15.5, 0, 0, PROPS.counter(4), [4, .7, 1.15]); }
  // munizioni e casse accanto a qualche postazione
  for (const [u, v, L] of A ? [[-15, 6.2, 1], [9, 6.2, 2], [-3, 6.4, 0]] : [[15, 6.2, 1], [-9, 6.2, 2], [3, 6.4, 0]]) snpProp(mb, team, u, v, L * FH, srand(0, 1), PROPS.ammo());
  // tetto: casse e sacchi abbandonati
  snpProp(mb, team, A ? 16 : -16, 9, 3 * FH, .3, PROPS.crates(), [1, 1, .9]);
}

// ---------- oggetti distrutti per la strada ----------
function snpStreetProps(mb) {
  const zA = SNP.FRONT.A, zE = SNP.FRONT.E;
  const bike = (fallen) => fallen
    ? [['paint', U.cyl, 0x1a1a18, 0, .04, -.5, PI / 2, 0, 0, .34, .03, .34], ['paint', U.cyl, 0x1a1a18, .1, .04, .55, PI / 2, 0, 0, .34, .03, .34], ['paint', 0, 0x2a3a2a, .05, .07, 0, 0, 0, 0, .05, .05, 1.05]]
    : [['paint', U.cyl, 0x1a1a18, 0, .34, -.5, 0, 0, PI / 2, .34, .03, .34], ['paint', U.cyl, 0x1a1a18, 0, .34, .55, 0, 0, PI / 2, .34, .03, .34], ['paint', 0, 0x2a3a2a, 0, .6, 0, 0, 0, 0, .05, .05, 1.05], ['paint', 0, 0x2a3a2a, 0, .8, -.45, 0, 0, 0, .5, .03, .03]];
  // biciclette, valigie, materassi, carte e mobili buttati giù dalle finestre
  for (const [x, z, r, f] of [[-26, -118, .4, 1], [12, -119, 1.8, 0], [30, -181, .9, 1], [-8, -182, 2.4, 1], [44, -132, .2, 0]]) snpPropW(mb, x, z, r, bike(f));
  for (const [x, z] of [[-18, -121], [21, -179], [3, -125], [-30, -176], [36, -122]]) snpPropW(mb, x, z, srand(0, 3), [['sack', 0, pick3([0x6a4a30, 0x4a3a2a, 0x7a5a3a]), 0, .18, 0, 0, 0, 0, .65, .36, .22], ['sack', 0, 0x3a2a1e, .5, .15, .3, 0, .8, .15, .55, .3, .2]]);
  for (const [x, z, r] of [[-14, -116.5, .3], [24, -183.5, 2.9], [-40, -184, 1.2]]) snpPropW(mb, x, z, r, [['sack', 0, 0xc8bca0, 0, .08, 0, 0, 0, .05, 1, .16, 1.9], ['sack', 0, 0xa89878, .2, .1, .2, 0, 0, 0, .3, .06, .4]]);
  for (let i = 0; i < 14; i++) snpPropW(mb, srand(-45, 45), srand(zE + 3, zA - 3), srand(0, 3), PROPS.papers());
  for (const [x, z, r] of [[-20, -117, 2.6], [18, -184, .3], [6, -116, 1], [-24, -183.5, 2]]) snpPropW(mb, x, z, r, PROPS.tableOver());
  for (const [x, z, r] of [[-19, -118.5, 1], [17, -182, 2.2], [-23, -182, .7], [7, -117.5, .3]]) snpPropW(mb, x, z, r, PROPS.chair(true));
  snpPropW(mb, 26, -117, 1.2, PROPS.wardrobeDown(), [1.2, 2, .6]);
  snpPropW(mb, -34, -181.5, -.6, PROPS.sofa(), [1.9, .85, .8]);
  // caffè sul marciapiede dell'albergo: tavolini, sedie e tenda strappata
  for (let i = 0; i < 4; i++) { const x = 9 + i * 2.6; snpPropW(mb, x, zA - 1.6, 0, [['paint', U.cyl12, 0x2a2826, 0, .72, 0, 0, 0, 0, .35, .03, .35], ['paint', U.cyl, 0x2a2826, 0, .36, 0, 0, 0, 0, .03, .72, .03]], null, SNP.G + .16); snpPropW(mb, x + .6, zA - 1.2, srand(0, 3), PROPS.chair(i % 2 === 0), null, SNP.G + .16); }
  { const p = snpW('A', 13, -.6); mb.mat = 'sack'; mb.add(U.box, 0x8a2a24, p.x, SNP.G + 3.05, p.z - .9, -.5, 0, 0, 9, .04, 2.2); mb.add(U.box, 0x8a2a24, p.x - 3, SNP.G + 2.4, p.z - 1.8, -1.2, 0, .2, 2.5, .03, 1.4); }
  // colonna delle affissioni sbrecciata e cassetta delle lettere
  snpPropW(mb, -42, -164, 0, [['plaster', U.cyl12, 0x8a8270, 0, 1.4, 0, 0, 0, 0, .65, 2.8, .65], ['paint', U.cyl12, 0x3a4a3a, 0, 2.9, 0, 0, 0, 0, .75, .2, .75], ['paint', U.cyl12, 0x3a4a3a, 0, 3.2, 0, 0, 0, 0, .3, .5, .3], ['vc', 0, 0xd8c8a0, .66, 1.6, 0, 0, 0, 0, .02, .9, .6], ['vc', 0, 0xb84a3a, -.3, 1.9, .6, 0, .5, 0, .5, .8, .02]], [1.3, 1.3, 2.8]);
  snpPropW(mb, 33, -185, 0, [['paint', 0, 0xb8a040, 0, .9, 0, 0, 0, 0, .4, .5, .3], ['paint', U.cyl, 0x2a2826, 0, .4, 0, 0, 0, 0, .04, .8, .04]], null, SNP.G + .16);
  // pali del telegrafo abbattuti con i fili per terra
  for (const [x, z, r, lean] of [[-48, -144, .3, 1.35], [48, -158, 2.8, .4], [-10, -132, 1.1, 1.5]]) {
    snpPropW(mb, x, z, r, [['wood', U.cyl, 0x4a3a2a, 0, 3.6 * Math.cos(lean), Math.sin(lean) * 3.6, lean, 0, 0, .13, 7.2, .13], ['wood', 0, 0x4a3a2a, 0, 7 * Math.cos(lean), Math.sin(lean) * 7, lean, 0, 0, 1.4, .1, .1]]);
    mb.mat = 'paint'; for (let k = 0; k < 3; k++) mb.add(U.box, 0x1a1a18, x + srand(-4, 4), snpH(x, z) + .02, z + srand(-4, 4), 0, srand(0, 3), 0, srand(5, 9), .015, .015);
  }
  // carretto a mano rovesciato, botti, bidoni e casse
  snpPropW(mb, -2, -163, .5, [['wood', 0, 0x6a5034, 0, .5, 0, .35, 0, .2, 1.4, .1, 2.2], ['wood', U.cyl12, 0x3a2a1e, .75, .55, -.3, 0, 0, PI / 2, .55, .06, .55], ['wood', 0, 0x6a5034, .2, .9, 1.2, -.6, 0, 0, .06, .06, 1.6], ['wood', 0, 0x8a7350, -.6, .25, -.8, 0, .3, 0, .5, .5, .5]], [1.6, 2.3, 1]);
  for (const [x, z] of [[22, -146], [-31, -152], [37, -170], [-6, -126]]) { snpPropW(mb, x, z, 0, [['wood', U.cyl12, 0x6a4a2a, 0, .45, 0, 0, 0, 0, .32, .9, .32], ['paint', U.cyl12, 0x2a2826, 0, .7, 0, 0, 0, 0, .335, .04, .335], ['paint', U.cyl12, 0x2a2826, 0, .2, 0, 0, 0, 0, .335, .04, .335]], [.7, .7, .9]); snpPropW(mb, x + 1.1, z + .4, srand(0, 3), [['paint', U.cyl12, 0x4a4a3a, 0, .1, 0, PI / 2, 0, 0, .28, .85, .28]]); }
  // bossoli, elmetti e zaini abbandonati
  for (let i = 0; i < 10; i++) { const x = srand(-40, 40), z = srand(zE + 6, zA - 6); snpPropW(mb, x, z, srand(0, 3), [['paint', U.sph, i % 2 ? 0x4a5236 : 0x5a5a4a, 0, .06, 0, 0, 0, 0, .19, .1, .22], ['sack', 0, 0x6a6448, .5, .1, .2, 0, .7, 0, .35, .2, .45]]); }
  // alberi del viale bruciati e spezzati
  for (const [x, z, h] of [[-36, -116, 3.5], [-12, -184.5, 5], [40, -117, 2.4], [-50, -185, 4.2]]) { snpPropW(mb, x, z, srand(0, 3), [['wood', U.cyl, 0x2a221c, 0, h / 2, 0, srand(-.1, .1), 0, srand(-.1, .1), .2, h, .2], ['wood', U.cyl, 0x2a221c, .5, h * .8, 0, 0, 0, .9, .07, 1.6, .07], ['wood', U.cyl, 0x2a221c, -.2, .15, 1.6, PI / 2 - .1, .4, 0, .14, 2.6, .14]], [.5, .5, h]); }
  // cumuli di calcinacci sotto le facciate e auto rovesciate e bruciate
  for (const z of [zA - 1.4, zE + 1.4]) for (let i = 0; i < 9; i++) { const x = -21 + i * 5.2 + srand(-1, 1); snpPropW(mb, x, z, srand(0, 3), [...PROPS.rubbleSmall(), ...PROPS.rubbleSmall()], null, SNP.G + .16); }
  for (const [x, z, r] of [[-44, -126, .4], [46, -178, 2.6]]) snpPropW(mb, x, z, r, [['paint', 0, 0x262422, 0, .75, 0, 0, 0, PI, 1.75, .55, 4.4], ['paint', 0, 0x262422, 0, .32, .25, 0, 0, PI, 1.55, .5, 2.1], ...[[-.9, -1.4], [.9, -1.4], [-.9, 1.4], [.9, 1.4]].map(([a, b]) => ['vc', U.cyl12, 0x161514, a, 1.1, b, 0, 0, PI / 2, .38, .2, .38])], [1.8, 4.4, 1.3]);
  // sacchi di sabbia sparsi e sacchi postali davanti alle Poste
  for (let i = 0; i < 6; i++) snpPropW(mb, srand(-22, 22), zE + 4.2 + srand(0, 1.5), srand(0, 3), [['sack', 0, 0x9a8e6a, 0, .2, 0, 0, 0, .1, .5, .4, .35], ['sack', 0, 0x8a7e5a, .4, .15, .2, .3, .5, 0, .45, .35, .3]]);
}
