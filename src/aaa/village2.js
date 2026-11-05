"use strict";
// ============================================================
//  AAA Normandy Village Expansion 2.0 — SOLO nella tech demo (SCEN 'aaa').
//  Il villaggio della demo (casa A, fienile B, casetta C, officina D, casa Blender) resta com'è; attorno si aggiungono:
//   A centro storico a ovest (piazza lastricata, chiesa con campanile salibile, municipio usato come Ortskommandantur,
//     locanda, panetteria, bottega, case attorno alla piazza, pozzo, monumento ai caduti 1914-18, vicolo);
//   B quartiere residenziale lungo una strada secondaria a sud (case diverse, cortili, muretti, orti, depositi);
//   C fattoria a corte chiusa a est (casa, grande fienile, stalla, magazzino, tettoia del fieno, carri, attrezzi);
//   D zona militare a nord sul viottolo (posto di blocco, trincea a zig-zag, due postazioni MG 42, ricovero di cemento,
//     deposito munizioni, ostacoli anticarro, filo spinato) e sbarramento all'ingresso est della strada principale;
//   E periferia (sentiero dei campi, filari, pali del telegrafo, casa isolata, fienile in rovina).
//  Gli edifici usano il sistema modulare della demo (aaaBuilding: muri estrusi con aperture vere, telai, persiane,
//  tetti tegola per tegola, comignoli, gronde, collider a pezzi) con varianti di muratura, colombage, tetti, colori.
//  Coordinate locali (u, v) come terrain.js: x = AV.cx + u, z = AV.cz + v.
// ============================================================
const V2 = {
  on: true, defs: [], built: [], props: 0, lodN: 0, roads: [], trenches: [], plaza: null, stats: {}, sectors: [], spawns: {}, routes: {}, destr: [], dbg: null, lods: [],
};
const v2W = (u, v) => [AV.cx + u, AV.cz + v];

// ---------------------------------------------------------------- rete stradale e terreno
// strade secondarie, vicoli e sentieri (polilinee locali); la strada principale e il viottolo restano quelli di terrain.js
V2.roads = [
  { id: 'res', w: 4.2, kind: 'road', pts: [[-100, 12], [-100, 30], [-87, 44], [-66, 50], [-46, 47], [-31, 40]] },            // strada del quartiere residenziale
  { id: 'chiesa', w: 3.2, kind: 'lane', pts: [[-98.5, 0], [-98.5, -30], [-96, -60], [-62, -88], [-30, -104], [-6, -112]] },   // dietro la chiesa, verso le trincee
  { id: 'vicolo', w: 2.8, kind: 'alley', pts: [[-129.3, -6], [-129.3, -32], [-121, -40]] },                                     // vicolo stretto (2,8 m)
  { id: 'fattoria', w: 4.2, kind: 'road', pts: [[95, 4], [96, -20], [97, -50], [105, -80]] },                                   // accesso alla fattoria e ai campi
  { id: 'campi', w: 2.4, kind: 'path', pts: [[70, 8], [74, 40], [88, 68], [106, 104]] },                                        // sentiero dei campi a sud-est
];
// trincea a zig-zag (profondità 1,5 m, larghezza 1,4 m), interrotta sul viottolo per il passaggio dei veicoli
V2.trenches = [
  [[-30, -108], [-19, -112.5], [-8, -108.5], [3.5, -113]],
  [[22.5, -113], [33, -108.5], [44, -113.5], [56, -109.5]],
];
V2.plaza = { u0: -122, u1: -94, v0: -6, v1: 16, r: 3 };   // piazza lastricata
function v2SegT(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az; return clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); }
function v2LineD(u, v, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, avSegD(u, v, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
// riquadri di prefiltro (le funzioni del terreno sono chiamate centinaia di migliaia di volte)
for (const r of V2.roads.concat(V2.trenches.map(p => ({ pts: p, w: 1.4 })))) { const us = r.pts.map(p => p[0]), vs = r.pts.map(p => p[1]); r.bb = [Math.min(...us) - 8, Math.max(...us) + 8, Math.min(...vs) - 8, Math.max(...vs) + 8]; }
V2.trenchBB = V2.trenches.map(p => { const us = p.map(q => q[0]), vs = p.map(q => q[1]); return [Math.min(...us) - 4, Math.max(...us) + 4, Math.min(...vs) - 4, Math.max(...vs) + 4]; });
function v2PlazaD(u, v) { const P = V2.plaza, dx = Math.max(P.u0 - u, 0, u - P.u1), dz = Math.max(P.v0 - v, 0, v - P.v1); return Math.hypot(dx, dz); }
// livello di base (senza microrilievo): le strade vi si appoggiano senza gradini
function v2Base(u, v) { return 16 + .016 * u - .011 * v + (fbm(u * .011 + 3, v * .011, 3) - .5) * 3.2; }
// distanza minima da strade nuove (per togliere gli argini dove una strada li attraversa)
function v2RoadD(u, v) { let d = 1e9; for (const r of V2.roads) { const b = r.bb; if (u < b[0] || u > b[1] || v < b[2] || v > b[3]) continue; d = Math.min(d, v2LineD(u, v, r.pts) - r.w / 2); } return d; }
// modifica dell'altimetria (chiamata da aaaH dopo il terreno originale)
function v2H(u, v, y) {
  // piazza: piano leggermente inclinato verso la strada
  const dp = v2PlazaD(u, v); if (dp < 4) y = lerp(v2Base(-108, 4) - .1 + (v - 4) * .006, y, smooth(dp / 4));
  for (const r of V2.roads) {
    const b = r.bb; if (u < b[0] || u > b[1] || v < b[2] || v > b[3]) continue;
    const d = v2LineD(u, v, r.pts), hw = r.w / 2; if (d > hw + 1.6) continue;
    const yb = v2Base(u, v) - .1; y = lerp(yb, y, smooth(clamp((d - hw) / 1.6, 0, 1)));
    if (r.kind === 'road' && d < hw) { const rut = Math.exp(-(((d - hw * .45) / .25) ** 2)); y -= .07 * rut * (.6 + .4 * vnoise(u * .2, v * .2)); }
    if (r.kind === 'path' && d < hw) y -= .04;
  }
  for (let k = 0; k < V2.trenches.length; k++) {
    const b = V2.trenchBB[k]; if (u < b[0] || u > b[1] || v < b[2] || v > b[3]) continue;
    const d = v2LineD(u, v, V2.trenches[k]); if (d < 2.6) { y -= 1.55 * smooth(clamp((1.05 - d) / .35, 0, 1)); y += .32 * Math.exp(-(((d - 1.7) / .45) ** 2)); }   // scavo e terra di riporto (parapetto)
  }
  return y;
}
// pesi dei materiali del terreno: terra e fango sulle strade, ghiaia nei vicoli, terra di riporto alle trincee, solchi nei campi arati
function v2Splat(u, v, s) {
  let [g, d, m, gr, wet] = s; const n = vnoise(u * .23, v * .23);
  for (const r of V2.roads) {
    const b = r.bb; if (u < b[0] || u > b[1] || v < b[2] || v > b[3]) continue;
    const dd = v2LineD(u, v, r.pts), hw = r.w / 2; if (dd > hw + .8) continue; const k = smooth(clamp((hw + .8 - dd) / 1, 0, 1));
    if (r.kind === 'alley') { g *= 1 - k; gr += k * 1.2; d += k * .3; }
    else if (r.kind === 'path') { const ctr = Math.exp(-((dd / .35) ** 2)); g *= 1 - k * (1 - ctr) * .9; d += k * (1 - ctr) * .8; }
    else { g *= 1 - k * .95; d += k * .7; m += k * (.25 + .5 * n) * Math.exp(-(((dd - hw * .45) / .4) ** 2)) * 2; gr += k * .25; wet += k * .3 * n; }
  }
  for (let q = 0; q < V2.trenches.length; q++) { const b = V2.trenchBB[q]; if (u < b[0] || u > b[1] || v < b[2] || v > b[3]) continue; const dd = v2LineD(u, v, V2.trenches[q]); if (dd < 2.4) { const k = smooth(clamp((2.4 - dd) / .8, 0, 1)); g *= 1 - k; d += k * 1.2; m += k * .3 * (dd < 1 ? 1 : 0); } }
  // cortile della fattoria est: fango e paglia
  if (u > 100 && u < 130 && v > -36 && v < -12) { const k = smooth(Math.min(u - 100, 130 - u, v + 36, -12 - v) / 3); g *= 1 - k * .85; m += k * (.5 + .5 * n); d += k * .5; wet += k * .4 * n; }
  // campi arati (nord-est): solchi paralleli
  if (u > 62 && u < 138 && v > -128 && v < -66 && v2RoadD(u, v) > 3) { const k = smooth(Math.min(u - 62, 138 - u, v + 128, -66 - v) / 4), f = .5 + .5 * Math.sin(u * 7.5 + vnoise(u * .05, v * .05) * 3); g *= 1 - k * (.75 + .2 * f); d += k * (.6 + .5 * f); m += k * .15 * (1 - f); }
  const t = g + d + m + gr || 1; return [g / t, d / t, m / t, gr / t, clamp(wet, 0, 1)];
}
// argini del bocage della periferia (si aggiungono a quelli della demo: terrapieno, fosso, siepe e querce automatiche)
AV.banks.push(
  [[-142, -64], [-118, -60], [-104, -70], [-100, -90]],
  [[-142, 72], [-112, 70], [-96, 76], [-70, 80]],
  [[62, 82], [80, 96], [92, 120]],
  [[60, -66], [86, -64], [92, -66]], [[102, -64], [140, -62]],
  [[140, 30], [112, 26], [102, 32], [100, 60]],
);

// ---------------------------------------------------------------- definizioni degli edifici
// aperture compatte: [tipo, frazione lungo la facciata, piano, larghezza, altezza]; porte e finestre vere sui muri estrusi
const V2_STONE_ROOF = [0x4e545c, 0x585e66, 0x464c54, 0x5c6066];
const V2_TILE_ROOF = [0x9a5a42, 0x8e5038, 0xa66448, 0x844a36];
function v2Defs() {
  const D = [];
  const add = (o) => { D.push(Object.assign({ storeys: 1, sh: 3, wall: 'pietra', seed: D.length * 7 + 101, explore: false, zone: 'A' }, o)); };
  const slate = (pitch = .82, o = {}) => Object.assign({ type: 'gable', tile: 'slate', pitch, cols: V2_STONE_ROOF, moss: .5, ov: .4, chimneys: [] }, o);
  const tile = (pitch = .75, o = {}) => Object.assign({ type: 'gable', tile: 'tile', pitch, cols: V2_TILE_ROOF, moss: .6, ov: .38, chimneys: [] }, o);
  // ---------------- A. centro storico
  add({ id: 'v2_chiesa', kind: 'church', zone: 'A', u: -112, v: -19, w: 20, d: 8.6, sh: 7.2, wall: 'pietra', rubble: false, wallCol: 0xc8bea6, explore: true,
    roof: slate(.95, { moss: .9, gutter: false }), style: { frame: 0x7a7a72, door: 0x3e2e22, lintel: 'stone', shutters: false },
    open: { '+z': [['win', .2, 0, .8, 2.6, 2.4], ['win', .45, 0, .8, 2.6, 2.4], ['door', .66, 0, 1.4, 2.6], ['win', .86, 0, .8, 2.6, 2.4]], '-z': [['win', .2, 0, .8, 2.6, 2.4], ['win', .45, 0, .8, 2.6, 2.4], ['win', .7, 0, .8, 2.6, 2.4], ['win', .88, 0, .8, 2.6, 2.4]], '+x': [['win', .5, 0, 1.1, 3.2, 2.6]], '-x': [['door', .5, 0, 1.3, 2.5]] } });
  add({ id: 'v2_campanile', kind: 'tower', zone: 'A', u: -124.6, v: -19, w: 5.2, d: 5.2, storeys: 4, sh: 4.2, wall: 'pietra', rubble: false, wallCol: 0xc4baa2, explore: true, along: 'x',
    roof: { type: 'hip', tile: 'slate', pitch: 1.18, cols: [0x4a5058, 0x545a62, 0x40464e], moss: .3, ov: .3, chimneys: [], gutter: false }, style: { frame: 0x6a6a62, door: 0x3a2a1e, lintel: 'stone', shutters: false },
    open: { '+z': [['door', .5, 0, 1.2, 2.4], ['win', .5, 1, .45, 1.1, .8], ['win', .5, 2, .45, 1.1, .8], ['win', .5, 3, 1.5, 2.2, 1.05]], '-z': [['win', .5, 1, .45, 1.1, .8], ['win', .5, 3, 1.5, 2.2, 1.05]], '+x': [['door', .5, 0, 1.3, 2.5], ['win', .5, 3, 1.5, 2.2, 1.05]], '-x': [['win', .5, 2, .45, 1.1, .8], ['win', .5, 3, 1.5, 2.2, 1.05]] } });
  add({ id: 'v2_mairie', kind: 'mairie', zone: 'A', u: -112, v: 23, w: 13, d: 8.6, storeys: 2, sh: 3.3, wall: 'pietra', rubble: false, band: true, wallCol: 0xd4c8ae, explore: true, ceilingOnly: true,
    roof: { type: 'hip', tile: 'slate', pitch: .78, cols: V2_STONE_ROOF, moss: .4, ov: .45, chimneys: [[-4.6, 0], [4.6, 0]] }, style: { frame: 0xe4e0d4, shutter: 0x6a7a84, door: 0x3a4a54, lintel: 'stone', shutters: true },
    open: { '-z': [['win', .12, 0], ['win', .3, 0], ['door', .5, 0, 1.4, 2.6], ['win', .7, 0], ['win', .88, 0], ['win', .12, 1], ['win', .3, 1], ['win', .5, 1], ['win', .7, 1], ['win', .88, 1]], '+z': [['win', .3, 0], ['win', .7, 0], ['win', .3, 1], ['win', .7, 1]], '+x': [['win', .5, 0], ['win', .5, 1]], '-x': [['win', .5, 1]] } });
  add({ id: 'v2_locanda', kind: 'inn', zone: 'A', u: -89, v: -6.5, w: 12, d: 8, storeys: 2, sh: 3.1, wall: 'intonaco', wallCol: 0xe6d6b0, quoins: true, explore: true, stair: true,
    roof: tile(.78, { chimneys: [[-5, 0], [3, 0]] }), style: { frame: 0xe8e4da, shutter: 0x7a3a2a, door: 0x5a2a1e, lintel: 'wood', shutters: true },
    open: { '+z': [['win', .14, 0, 1.3, 1.5], ['door', .38, 0, 1.15, 2.2], ['win', .62, 0, 1.3, 1.5], ['win', .86, 0], ['win', .14, 1], ['win', .38, 1], ['win', .62, 1], ['win', .86, 1]], '-z': [['door', .8, 0, 1, 2.1], ['win', .3, 0], ['win', .3, 1], ['win', .75, 1]], '+x': [['win', .5, 1]], '-x': [['win', .5, 0], ['win', .5, 1]] } });
  add({ id: 'v2_panetteria', kind: 'bakery', zone: 'A', u: -88, v: 18.5, w: 8.4, d: 7, storeys: 1, sh: 3.4, wall: 'pietra', rubble: true, wallCol: 0xc0b49a, explore: true,
    roof: tile(.8, { chimneys: [[2.6, 0]] }), style: { frame: 0xd8d0c0, shutter: 0x4a6a5a, door: 0x2e4a3e, lintel: 'wood', shutters: true },
    open: { '-z': [['win', .2, 0, 1.6, 1.4], ['door', .55, 0, 1.1, 2.2], ['win', .84, 0]], '+z': [['win', .5, 0]], '+x': [['door', .5, 0, 1, 2.1]], '-x': [['win', .5, 0]] } });
  add({ id: 'v2_bottega', kind: 'shop', zone: 'A', u: -130.5, v: 15, w: 7, d: 9, storeys: 2, sh: 3, wall: 'intonaco', wallCol: 0xd8c8a4, timber: true, along: 'z', open0: true,
    roof: slate(.9, { chimneys: [[0, -3]] }), style: { frame: 0xd8d2c4, shutter: 0x6a5a3a, door: 0x4a3a2a, lintel: 'wood', shutters: true },
    open: { '+x': [['win', .22, 0, 1.6, 1.5], ['door', .55, 0], ['win', .82, 0], ['win', .22, 1], ['win', .55, 1], ['win', .82, 1]], '-z': [['win', .5, 1]], '+z': [['win', .5, 0]], '-x': [] } });
  add({ id: 'v2_casa_piazza1', kind: 'house', zone: 'A', u: -136, v: -13, w: 8, d: 7, storeys: 2, sh: 2.9, wall: 'pietra', rubble: true, wallCol: 0xbcb098,
    roof: slate(.86, { chimneys: [[3.4, 0]] }), style: { frame: 0xdcd6c8, shutter: 0x55707a, door: 0x3a4a54, lintel: 'stone', shutters: true },
    open: { '+z': [['win', .25, 0], ['door', .6, 0], ['win', .25, 1], ['win', .7, 1]], '+x': [['win', .5, 1]], '-z': [['win', .5, 0]], '-x': [] } });
  add({ id: 'v2_casa_piazza2', kind: 'house', zone: 'A', u: -129, v: 27.5, w: 9, d: 7, storeys: 2, sh: 2.8, wall: 'intonaco', wallCol: 0xe8dcc0, timber: true,
    roof: tile(.85, { chimneys: [[-3.8, 0]] }), style: { frame: 0xe0dad0, shutter: 0x8a6a3a, door: 0x5a3a24, lintel: 'wood', shutters: true },
    open: { '-z': [['win', .2, 0], ['door', .5, 0], ['win', .8, 0], ['win', .2, 1], ['win', .5, 1], ['win', .8, 1]], '+x': [['win', .5, 0]], '+z': [['win', .4, 1]], '-x': [] } });
  add({ id: 'v2_casa_piazza3', kind: 'house', zone: 'A', u: -76, v: 26.5, w: 8, d: 7, storeys: 2, sh: 2.9, wall: 'mattoni',
    roof: slate(.8, { chimneys: [[3.3, 0]] }), style: { frame: 0xd8d4c8, shutter: 0x4a5a3a, door: 0x2e3a2e, lintel: 'stone', shutters: true },
    open: { '-z': [['door', .3, 0], ['win', .7, 0], ['win', .3, 1], ['win', .7, 1]], '-x': [['win', .5, 0]], '+z': [], '+x': [['win', .5, 1]] } });
  add({ id: 'v2_casa_piazza4', kind: 'house', zone: 'A', u: -80, v: -21, w: 9, d: 7.5, storeys: 2, sh: 3, wall: 'pietra', rubble: true, wallCol: 0xb8ac94, ruinRoof: true,
    roof: tile(.78, { chimneys: [[-3.8, 0]] }), style: { frame: 0xcfc8b8, shutter: 0x6a4a3a, door: 0x4a3426, lintel: 'stone', shutters: true },
    open: { '+z': [['win', .2, 0], ['door', .5, 0], ['win', .8, 0], ['win', .2, 1], ['win', .8, 1]], '-x': [['win', .5, 0]], '-z': [['win', .5, 1]], '+x': [] } });
  // ---------------- B. quartiere residenziale
  add({ id: 'v2_res1', kind: 'house2', zone: 'B', u: -80, v: 57.5, w: 9.4, d: 7.6, storeys: 2, sh: 2.95, wall: 'pietra', rubble: true, wallCol: 0xc4b89e, band: true, explore: true, stair: true,
    roof: slate(.84, { chimneys: [[-4, 0], [4, 0]] }), style: { frame: 0xdcd6c8, shutter: 0x5f7a86, door: 0x4a5a64, lintel: 'stone', shutters: true },
    open: { '-z': [['win', .17, 0], ['door', .45, 0], ['win', .8, 0], ['win', .17, 1], ['win', .45, 1], ['win', .8, 1]], '+z': [['door', .75, 0, 1, 2.1], ['win', .3, 0], ['win', .3, 1]], '+x': [['win', .5, 1]], '-x': [['win', .5, 0]] } });
  add({ id: 'v2_res2', kind: 'house', zone: 'B', u: -109, v: 40, w: 7, d: 8.4, storeys: 1, sh: 3.1, wall: 'intonaco', wallCol: 0xe4d4b0, along: 'z',
    roof: tile(.82, { chimneys: [[0, 2.6]] }), style: { frame: 0xe8e4da, shutter: 0x5a7a62, door: 0x3a5a42, lintel: 'wood', shutters: true },
    open: { '+x': [['win', .2, 0], ['door', .5, 0], ['win', .8, 0]], '-z': [['win', .5, 0]], '+z': [], '-x': [['win', .5, 0]] } });
  add({ id: 'v2_res3', kind: 'house', zone: 'B', u: -69, v: 37, w: 10, d: 6.6, storeys: 1, sh: 2.9, wall: 'pietra', rubble: true, wallCol: 0xb4aa92, timber: false,
    roof: slate(.9, { chimneys: [[4.3, 0]] }), style: { frame: 0xd4cec0, shutter: 0x7a5a3a, door: 0x5a3e2a, lintel: 'wood', shutters: true },
    open: { '+z': [['win', .15, 0], ['door', .38, 0], ['win', .62, 0], ['win', .86, 0]], '-x': [['win', .5, 0]], '-z': [['win', .5, 0]], '+x': [] } });
  add({ id: 'v2_res4', kind: 'house', zone: 'B', u: -56, v: 61, w: 7, d: 6, storeys: 2, sh: 2.75, wall: 'intonaco', wallCol: 0xd8c49c, timber: true,
    roof: tile(.9, { chimneys: [[2.9, 0]] }), style: { frame: 0xe0dacc, shutter: 0x6a6a5a, door: 0x4a4a3a, lintel: 'wood', shutters: true },
    open: { '-z': [['door', .3, 0], ['win', .72, 0], ['win', .3, 1], ['win', .72, 1]], '+x': [['win', .5, 0]], '+z': [['win', .5, 1]], '-x': [] } });
  add({ id: 'v2_res5', kind: 'house', zone: 'B', u: -42, v: 34.5, w: 8.6, d: 7, storeys: 2, sh: 2.9, wall: 'pietra', rubble: false, wallCol: 0xd0c4aa,
    roof: { type: 'hip', tile: 'slate', pitch: .8, cols: V2_STONE_ROOF, moss: .5, ov: .4, chimneys: [[-3, 0]] }, style: { frame: 0xe4e0d4, shutter: 0x4a5a6a, door: 0x2e3a4a, lintel: 'stone', shutters: true },
    open: { '+z': [['win', .2, 0], ['door', .5, 0], ['win', .8, 0], ['win', .2, 1], ['win', .5, 1], ['win', .8, 1]], '+x': [['win', .5, 0]], '-z': [], '-x': [['win', .5, 1]] } });
  add({ id: 'v2_res6', kind: 'house', zone: 'B', u: -27, v: 55, w: 8, d: 6.4, storeys: 1, sh: 3, wall: 'mattoni',
    roof: tile(.72, { chimneys: [[3.2, 0]] }), style: { frame: 0xd0ccc0, shutter: 0x3a4a3a, door: 0x2a3a2a, lintel: 'wood', shutters: true },
    open: { '-z': [['win', .25, 0], ['door', .6, 0]], '-x': [['win', .5, 0]], '+z': [['win', .5, 0]], '+x': [] } });
  add({ id: 'v2_dep1', kind: 'shed', zone: 'B', u: -99, v: 51, w: 3.6, d: 2.8, storeys: 1, sh: 2.3, wall: 'pietra', rubble: true, wallCol: 0xa89e88,
    roof: tile(.6, { ov: .3 }), style: { frame: 0x5a4a38, door: 0x5a4632, lintel: 'wood', shutters: false }, open: { '-x': [['door', .5, 0, 1, 1.9]], '+x': [], '+z': [], '-z': [] } });
  add({ id: 'v2_dep2', kind: 'shed', zone: 'B', u: -61, v: 28.5, w: 3.2, d: 2.6, storeys: 1, sh: 2.2, wall: 'mattoni',
    roof: slate(.55, { ov: .3 }), style: { frame: 0x3a3a34, door: 0x3a3a2a, lintel: 'wood', shutters: false }, open: { '+z': [['door', .5, 0, .95, 1.9]], '-z': [], '+x': [], '-x': [] } });
  add({ id: 'v2_dep3', kind: 'shed', zone: 'B', u: -47, v: 70, w: 4.2, d: 3, storeys: 1, sh: 2.4, wall: 'pietra', rubble: true, wallCol: 0xb0a690,
    roof: slate(.6, { ov: .3 }), style: { frame: 0x5a4a38, door: 0x6a5642, lintel: 'wood', shutters: false }, open: { '-z': [['door', .4, 0, 1.6, 2.0]], '+z': [], '+x': [], '-x': [] } });
  // ---------------- C. fattoria a corte chiusa (est)
  add({ id: 'v2_fattoria', kind: 'farmhouse', zone: 'C', u: 118, v: -10, w: 13, d: 7, storeys: 2, sh: 2.9, wall: 'pietra', rubble: true, wallCol: 0xbcae94, explore: true, ceilingOnly: true,
    roof: slate(.86, { chimneys: [[-5.6, 0], [2, 0]], moss: .9 }), style: { frame: 0xd4cec0, shutter: 0x5a6a5a, door: 0x4a4a3a, lintel: 'wood', shutters: true },
    open: { '-z': [['win', .15, 0], ['door', .36, 0], ['win', .6, 0], ['door', .85, 0, 1.1, 2.1], ['win', .15, 1], ['win', .6, 1]], '+z': [['win', .3, 0], ['win', .7, 0], ['win', .5, 1]], '+x': [['win', .5, 1]], '-x': [] } });
  add({ id: 'v2_granaio', kind: 'barn', zone: 'C', u: 120, v: -40.5, w: 18, d: 9.6, storeys: 1, sh: 5.4, wall: 'pietra', rubble: true, wallCol: 0xb0a690, explore: true,
    roof: slate(.75, { moss: 1, ov: .5, gutter: false }), style: { frame: 0x5a4a38, door: 0x5a4632, lintel: 'wood', shutters: false },
    open: { '+z': [['door', .3, 0, 3.8, 3.9, 0, 'barn'], ['door', .75, 0, 3.8, 3.9, 0, 'barn'], ['win', .52, 0, .6, .6, 3]], '-z': [['win', .3, 0, .6, .6, 3], ['win', .7, 0, .6, .6, 3]], '+x': [['win', .5, 0, .7, .7, 3.4]], '-x': [['door', .5, 0, 1.2, 2.2]] } });
  add({ id: 'v2_stalla', kind: 'stable', zone: 'C', u: 132.5, v: -24, w: 8, d: 13, storeys: 1, sh: 3.2, wall: 'pietra', rubble: true, wallCol: 0xa89c84, explore: true, along: 'z',
    roof: tile(.7, { moss: 1, cols: [0x8a5a44, 0x7a4c3a, 0x946450] }), style: { frame: 0x5a4a38, door: 0x5a4a36, lintel: 'wood', shutters: false },
    open: { '-x': [['door', .25, 0, 1.4, 2.3], ['win', .5, 0, .8, .6, 1.7], ['door', .75, 0, 1.4, 2.3]], '+x': [['win', .3, 0, .6, .5, 1.9], ['win', .7, 0, .6, .5, 1.9]], '+z': [], '-z': [['win', .5, 0, .6, .5, 1.9]] } });
  add({ id: 'v2_magazzino', kind: 'store', zone: 'C', u: 104.5, v: -31, w: 6.4, d: 9.6, storeys: 1, sh: 3.4, wall: 'mattoni', along: 'z',
    roof: slate(.6), style: { frame: 0x4a4a40, door: 0x4a4a32, lintel: 'wood', shutters: false },
    open: { '+x': [['door', .5, 0, 2.4, 2.8]], '-x': [['win', .5, 0, .8, .6, 2]], '+z': [], '-z': [] } });
  // ---------------- D. zona militare: ricovero (Unterstand) di cemento, costruito a parte
  // ---------------- E. periferia
  add({ id: 'v2_isolata', kind: 'house', zone: 'E', u: 60, v: 70, w: 8.6, d: 6.8, storeys: 1, sh: 3, wall: 'pietra', rubble: true, wallCol: 0xbab098,
    roof: slate(.9, { chimneys: [[-3.6, 0]], moss: 1 }), style: { frame: 0xd0c8b8, shutter: 0x6a5a4a, door: 0x4a3a2a, lintel: 'wood', shutters: true },
    open: { '-x': [['win', .3, 0], ['door', .7, 0]], '-z': [['win', .3, 0], ['win', .75, 0]], '+z': [['win', .5, 0]], '+x': [] } });
  add({ id: 'v2_rovina', kind: 'ruin', zone: 'E', u: -60, v: -112, w: 9, d: 6.5, storeys: 1, sh: 3.4, wall: 'pietra', rubble: true, wallCol: 0xa89e88, ruin: true,
    roof: null, style: { frame: 0x4a3a2a, door: 0x4a3a2a, lintel: 'wood', shutters: false },
    open: { '+z': [['door', .4, 0, 1.6, 2.4], ['win', .8, 0, .9, 1]], '-z': [['win', .5, 0, .9, 1]], '+x': [], '-x': [['win', .5, 0, .8, 1]] } });
  return D;
}
// aperture compatte → formato di aaaBuilding (coordinate del mondo)
function v2Faces(d) {
  const out = {}, x = AV.cx + d.u, z = AV.cz + d.v, t = .55, sr = seeded(d.seed + 5);
  for (const k of ['+z', '-z', '+x', '-x']) {
    out[k] = (d.open[k] || []).map(([kind, f, s, w, h, y, barn]) => {
      const c = k[1] === 'z' ? x - d.w / 2 + f * d.w : z - d.d / 2 + t + f * (d.d - 2 * t);
      if (kind === 'door') return { kind: 'door', c, y: 0, w: w || 1.05, h: h || 2.15, open: d.explore || d.open0 || d.ruin, barn: barn === 'barn' };
      const o = { kind: 'win', c, y: y !== undefined ? s * d.sh + y : (s ? s * d.sh + .85 : .95), w: w || (s ? .9 : .95), h: h || (s ? 1.2 : 1.3) };
      if (d.kind === 'church' || d.kind === 'tower' || d.kind === 'barn' || d.kind === 'stable' || d.kind === 'store' || d.kind === 'shed') o.noShut = true;
      else if (!d.explore && sr() < .55) o.open = PI * .985;   // persiane chiuse: casa abbandonata
      if (d.ruin || (d.kind === 'tower' && s === 3)) o.broken = true;   // cella campanaria: aperture senza vetri
      return o;
    });
  }
  return out;
}
// aie piane (chiamata da aaaPads prima del terreno)
function v2Pads() {
  V2.defs = v2Defs();
  for (const d of V2.defs) {
    let lo = 1e9, hi = -1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) { const h = aaaH(AV.cx + d.u + a * d.w / 2, AV.cz + d.v + b * d.d / 2); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    AV.pads.push({ x0: d.u - d.w / 2 - .6, x1: d.u + d.w / 2 + .6, z0: d.v - d.d / 2 - .6, z1: d.v + d.d / 2 + .6, y: lo + .05, v2: d.id }); d.base = lo + .2; d.slope = hi - lo;
  }
  // ricovero di cemento e piazzola della tettoia del fieno
  for (const [u, v, w, dd] of [[-14, -124, 7, 6], [84, -30, 10, 7]]) { let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, aaaH(AV.cx + u + a * w / 2, AV.cz + v + b * dd / 2)); AV.pads.push({ x0: u - w / 2 - .5, x1: u + w / 2 + .5, z0: v - dd / 2 - .5, z1: v + dd / 2 + .5, y: lo + .02 }); }
}

// ---------------------------------------------------------------- costruzione
function v2Build() {
  const t0 = performance.now(), M = aaaMats(), nScene = scene.children.length; V2.built = []; V2.destr = []; V2.lods = []; V2.props = 0; V2.st0 = solids.length;
  for (const d of V2.defs) {
    const def = Object.assign({}, d, { x: AV.cx + d.u, z: AV.cz + d.v, faces: v2Faces(d) });
    if (d.ruin) { v2Ruin(def); continue; }
    if (d.kind === 'church' || d.kind === 'tower') def.room = false;
    const b = aaaBuilding(def); b.def = def; V2.built.push(b);
    if (d.timber) v2Timber(b, def);
    if (!d.explore && !d.open0) v2PlugHoles(b, def);
    if (d.explore) v2Interior(b, def);
    else if (d.open0) v2Interior(b, def);
    v2Destr(b, def); v2Lod(b, def);
  }
  v2Church(); v2Plaza(); v2ResidentialProps(); v2FarmProps(); v2Military(); v2Periphery(); v2Vegetation();
  v2Combat(); v2Sectors();
  V2.objs = scene.children.slice(nScene);
  v2Precompile();   // tutto ciò che il villaggio esteso ha aggiunto alla scena
  V2.stats = { edifici: V2.built.length + 2, esplorabili: V2.defs.filter(d => d.explore).length + 1, props: V2.props, solidi: solids.length - V2.st0, ms: Math.round(performance.now() - t0) };
}
// colombage (graticcio normanno): montanti, traverse ai piani e ai davanzali, saette agli angoli, che non coprono le aperture
// shader compilati durante il caricamento (anche quelli dei LOD lontani): altrimenti ogni materiale nuovo che entra in vista
// blocca un fotogramma mentre la GPU compila il programma
function v2Precompile() {
  const t = performance.now(), hidden = []; for (const L of V2.lods) if (!L.lo.visible) { L.lo.visible = true; hidden.push(L.lo); }
  try {
    renderer.compile(scene, camera);
    // un rendering completo senza culling compila anche i programmi delle ombre (profondità) di ogni materiale
    const fc = []; for (const o of V2.objs) o.traverse(q => { if (q.isMesh && q.frustumCulled) { q.frustumCulled = false; fc.push(q); } });
    const su = sun.shadow.needsUpdate; sun.shadow.needsUpdate = true; renderer.render(scene, camera); sun.shadow.needsUpdate = su; for (const q of fc) q.frustumCulled = true;
  } catch (e) { console.warn('precompilazione', e); }
  for (const o of hidden) o.visible = false; V2.compileMs = Math.round(performance.now() - t);
}
function v2Timber(b, def) {
  const G = new AGeo(), M = AAA.mats, sr = seeded(def.seed + 9);
  for (const k in b.faces) {
    const F = b.faces[k], ops = def.faces[k].map(o => Object.assign({}, o, { y0: b.base + o.y })), y0 = b.base, y1 = b.top;
    const free = (a, ya, yb) => !ops.some(o => a > o.c - o.w / 2 - .14 && a < o.c + o.w / 2 + .14 && yb > o.y0 - .2 && ya < o.y0 + o.h + .25);
    const put = (a, y, la, ly, rz = 0) => { const [x, yy, z] = aaaAt(F, a, .025, y); F.axis === 'x' ? G.add(M.woodDark, ABX.box, x, yy, z, 0, 0, rz, la, ly, .07) : G.add(M.woodDark, ABX.box, x, yy, z, rz, 0, 0, .07, ly, la); V2.props += 0; };
    for (let s = 0; s < def.storeys; s++) {
      const ya = y0 + s * def.sh + (s ? .12 : .55), yb = y0 + (s + 1) * def.sh - .06;
      put((F.a0 + F.a1) / 2, ya - .06, F.a1 - F.a0, .14); if (s === def.storeys - 1) put((F.a0 + F.a1) / 2, yb, F.a1 - F.a0, .14);
      for (let a = F.a0 + .12; a <= F.a1 - .1; a += .62 + sr() * .1) {
        // montante spezzato attorno alle aperture
        let yy = ya; const step = .2; let segStart = null;
        for (; yy <= yb; yy += step) { const ok = free(a, yy, yy + step); if (ok && segStart === null) segStart = yy; if ((!ok || yy + step > yb) && segStart !== null) { const e = ok ? yb : yy; if (e - segStart > .3) put(a, (segStart + e) / 2, .12, e - segStart); segStart = null; } }
      }
      // saette agli angoli
      for (const side of [-1, 1]) { const a = side < 0 ? F.a0 + .5 : F.a1 - .5, h = yb - ya; if (free(a, ya, yb)) put(a, (ya + yb) / 2, .1, Math.hypot(.8, h) * .98, side * Math.atan2(.8, h)); }
    }
  }
  G.build();
}
// case non esplorabili: porte chiuse e finestre con collider (niente stanze vuote raggiungibili)
function v2PlugHoles(b, def) {
  for (const k in b.faces) {
    const F = b.faces[k];
    for (const o of def.faces[k]) {
      const y0 = b.base + o.y, i0 = F.out > 0 ? F.fixed - F.t : F.fixed, i1 = F.out > 0 ? F.fixed : F.fixed + F.t, a0 = o.c - o.w / 2, a1 = o.c + o.w / 2;
      const s = F.axis === 'x' ? addSolid(a0, y0 - (o.kind === 'door' ? .6 : 0), i0, a1, y0 + o.h, i1, 'house') : addSolid(i0, y0 - (o.kind === 'door' ? .6 : 0), a0, i1, y0 + o.h, a1, 'house');
      s.mat = o.kind === 'door' ? 'legno' : 'vetro'; s.v2plug = def.id;
    }
  }
}
// ---------------------------------------------------------------- interni
const V2F = {};
// mobili essenziali (scatole e torniti: tavoli, sedie, panche, letti, armadi, credenze, camini, banconi, banchi della chiesa)
function v2Furn(G, sr) {
  const M = AAA.mats, W = M.wood, Wd = M.woodDark, add = (...a) => { G.add(...a); };
  const rot = (x, z, ry, lx, lz) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, z - Math.sin(ry) * lx + Math.cos(ry) * lz];
  const F = {
    table(x, y, z, ry, w = 1.6, d = .85, solid = true) { add(Wd, ABX.box, x, y + .74, z, 0, ry, 0, w, .06, d); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [px, pz] = rot(x, z, ry, a * (w / 2 - .07), b * (d / 2 - .07)); add(Wd, ABX.box, px, y + .36, pz, 0, ry, 0, .07, .72, .07); } if (solid) { const s = addSolid(x - w / 2, y, z - d / 2, x + w / 2, y + .77, z + d / 2, 'furniture'); s.mat = 'legno'; } V2.props++; },
    chair(x, y, z, ry) { add(W, ABX.box, x, y + .45, z, 0, ry, 0, .42, .04, .42); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [px, pz] = rot(x, z, ry, a * .18, b * .18); add(W, ABX.box, px, y + .22, pz, 0, ry, 0, .04, .45, .04); } const [bx, bz] = rot(x, z, ry, 0, -.19); add(W, ABX.box, bx, y + .72, bz, 0, ry, 0, .42, .5, .04); V2.props++; },
    bench(x, y, z, ry, w = 1.6) { add(Wd, ABX.box, x, y + .44, z, 0, ry, 0, w, .06, .32); for (const a of [-1, 1]) { const [px, pz] = rot(x, z, ry, a * (w / 2 - .12), 0); add(Wd, ABX.box, px, y + .21, pz, 0, ry, 0, .06, .42, .28); } V2.props++; },
    bed(x, y, z, ry) { add(Wd, ABX.box, x, y + .25, z, 0, ry, 0, 1.0, .3, 1.95); add(M.cloth, ABX.box, x, y + .46, z, 0, ry, 0, .94, .14, 1.86, 0xd8d0bc); const [px, pz] = rot(x, z, ry, 0, -.75); add(M.cloth, ABX.box, px, y + .58, pz, 0, ry, 0, .6, .1, .3, 0xeae4d4); const [hx, hz] = rot(x, z, ry, 0, -.98); add(Wd, ABX.box, hx, y + .55, hz, 0, ry, 0, 1.04, 1.1, .06); const s = addSolid(x - .55, y, z - .55, x + .55, y + .5, z + .55, 'furniture'); s.mat = 'legno'; V2.props++; },
    cupboard(x, y, z, ry, w = 1.3, h = 2) { add(Wd, ABX.box, x, y + h / 2, z, 0, ry, 0, w, h, .55); for (const a of [-1, 1]) { const [px, pz] = rot(x, z, ry, a * w / 4, .285); add(W, ABX.box, px, y + h / 2, pz, 0, ry, 0, w / 2 - .08, h - .25, .02); } const [cx, cz] = rot(x, z, ry, 0, .3); add(M.metal, ABX.box, cx, y + h * .52, cz, 0, ry, 0, .04, .12, .03); const r = Math.abs(Math.sin(ry)) > .5 ? [.28, w / 2] : [w / 2, .28]; const s = addSolid(x - r[0], y, z - r[1], x + r[0], y + h, z + r[1], 'furniture'); s.mat = 'legno'; V2.props++; },
    shelf(x, y, z, ry, w = 1.4) { for (const hh of [.9, 1.35, 1.8]) add(W, ABX.box, x, y + hh, z, 0, ry, 0, w, .04, .3); for (let i = 0; i < 6; i++) { const [px, pz] = rot(x, z, ry, -w / 2 + .15 + sr() * (w - .3), 0); add(M.vc, ABX.cyl, px, y + [.9, 1.35, 1.8][i % 3] + .1, pz, 0, 0, 0, .05 + sr() * .03, .18, .05 + sr() * .03, [0x8a5a3a, 0xc8c0a8, 0x5a6a4a, 0x9a7a4a][i % 4]); } V2.props++; },
    hearth(x, y, z, ry) { add(M.stoneLight, ABX.box, x, y + .7, z, 0, ry, 0, 1.8, 1.4, .5); const [ix, iz] = rot(x, z, ry, 0, .05); add(M.stoneDark, ABX.box, ix, y + .45, iz, 0, ry, 0, 1.1, .9, .46); add(Wd, ABX.box, ...rot(x, z, ry, 0, .22).slice(0, 1), y + 1.45, rot(x, z, ry, 0, .22)[1], 0, ry, 0, 2, .14, .34); const [fx, fz] = rot(x, z, ry, 0, .15); for (let i = 0; i < 3; i++) add(M.bark, ABX.cyl, fx + (i - 1) * .14, y + .1, fz, PI / 2, ry, 0, .05, .5, .05); add(M.metal, ABX.cyl, fx, y + .55, fz, 0, 0, 0, .16, .2, .16); V2.props++; },
    stove(x, y, z) { add(M.metal, ABX.box, x, y + .4, z, 0, 0, 0, .7, .8, .5, 0x2a2a2a); add(M.metal, ABX.cyl, x, y + 1.6, z - .1, 0, 0, 0, .07, 1.6, .07); V2.props++; },
    counter(x, y, z, ry, w = 3) { add(Wd, ABX.box, x, y + .55, z, 0, ry, 0, w, 1.1, .6); add(W, ABX.box, x, y + 1.12, z, 0, ry, 0, w + .1, .05, .7); const r = Math.abs(Math.sin(ry)) > .5 ? [.35, w / 2] : [w / 2, .35]; const s = addSolid(x - r[0], y, z - r[1], x + r[0], y + 1.15, z + r[1], 'furniture'); s.mat = 'legno'; V2.props++; },
    bottles(x, y, z, ry, w = 2) { for (let i = 0; i < 9; i++) { const [px, pz] = rot(x, z, ry, -w / 2 + i * w / 8, 0); G.add(M.glass, ABX.cyl, px, y + .14, pz, 0, 0, 0, .035, .28, .035); } V2.props++; },
    pew(x, y, z, ry, w = 3.2) { add(Wd, ABX.box, x, y + .45, z, 0, ry, 0, w, .05, .4); const [bx, bz] = rot(x, z, ry, 0, -.2); add(Wd, ABX.box, bx, y + .8, bz, 0, ry, 0, w, .6, .05); for (const a of [-1, 1]) { const [px, pz] = rot(x, z, ry, a * w / 2, 0); add(Wd, ABX.box, px, y + .45, pz, 0, ry, 0, .06, .9, .45); } const r = Math.abs(Math.sin(ry)) > .5 ? [.25, w / 2] : [w / 2, .25]; const s = addSolid(x - r[0], y, z - r[1], x + r[0], y + .5, z + r[1], 'furniture'); s.mat = 'legno'; V2.props++; },
    desk(x, y, z, ry) { F.table(x, y, z, ry, 1.4, .75); add(M.cloth, ABX.box, x, y + .78, z, 0, ry + .2, 0, .32, .01, .24, 0xe8e0c8); add(M.cloth, ABX.box, x + .3, y + .78, z + .1, 0, ry - .3, 0, .3, .01, .22, 0xe0d8c0); add(M.metal, ABX.box, x - .45, y + .84, z, 0, ry, 0, .22, .12, .18, 0x1a1a1a); },
    cabinet(x, y, z, ry) { add(M.metal, ABX.box, x, y + .7, z, 0, ry, 0, .5, 1.4, .6, 0x5a5a4a); for (let i = 0; i < 4; i++) { const [px, pz] = rot(x, z, ry, 0, .31); add(M.metal, ABX.box, px, y + .2 + i * .33, pz, 0, ry, 0, .12, .03, .02); } V2.props++; },
    crate(x, y, z, ry, mil = true) { apCrate(G, x, z, ry, .8, .5, .5, mil, y); V2.props++; },
    barrel(x, y, z) { apBarrel(G, x, z, 0); V2.props++; },
  };
  return F;
}
function v2Interior(b, def) {
  const M = AAA.mats, G = new AGeo(), sr = seeded(def.seed + 33), F = v2Furn(G, sr), t = .55, base = b.base;
  const x0 = def.x - def.w / 2 + t, x1 = def.x + def.w / 2 - t, z0 = def.z - def.d / 2 + t, z1 = def.z + def.d / 2 - t, fy = base + def.sh;
  if (def.kind === 'church' || def.kind === 'tower') return;   // interni dedicati (v2Church)
  // pavimento: lastre per cucine, botteghe, stalle, fienili; tavolato per locanda e municipio
  const stoneFloor = /farmhouse|bakery|shop|barn|stable|store|shed|house2/.test(def.kind), fm = stoneFloor ? (AAA.mats.flag || M.stoneDark) : M.wood;
  if (/barn|stable|store|shed/.test(def.kind)) G.add(M.terra, ABX.box, def.x, base - .06, def.z, 0, 0, 0, x1 - x0 + .1, .12, z1 - z0 + .1);
  else for (let x = x0; x < x1 - .05; x += stoneFloor ? .7 : 1.6) G.add(fm, ABX.box, x + Math.min(stoneFloor ? .7 : 1.6, x1 - x) / 2, base - .05 + sr() * .006, def.z, 0, 0, 0, Math.min(stoneFloor ? .7 : 1.6, x1 - x) - .015, .1, z1 - z0);
  FLOORS.push({ x0, x1, z0, z1, y: base + .01, v2: def.id });
  // solaio (con scala se def.stair; altrimenti chiuso) e travi a vista
  if (def.storeys > 1) {
    const L = Math.min(def.sh / .66, x1 - x0 - 1.4), xs0 = x0 + .25, xs1 = xs0 + L, zs1 = z0 + 1;
    const rects = def.stair ? [[x0, x1, zs1, z1], [xs1 - .02, x1, z0, zs1], [x0, xs0 - .05, z0, zs1]] : [[x0, x1, z0, z1]];
    for (const [a0, a1, c0, c1] of rects) { if (a1 - a0 < .1) continue; G.add(M.wood, ABX.box, (a0 + a1) / 2, fy - .03, (c0 + c1) / 2, 0, 0, 0, a1 - a0, .08, c1 - c0); const s = addSolid(a0, fy - .1, c0, a1, fy + .04, c1, 'floor'); s.walk = true; s.mat = 'legno'; if (def.stair) FLOORS.push({ x0: a0, x1: a1, z0: c0, z1: c1, y: fy + .04, v2: def.id }); }
    for (let x = x0 + .4; x < x1; x += .95) G.add(M.woodDark, ABX.box, x, fy - .17, def.z, 0, 0, 0, .16, .2, z1 - z0);
    if (def.stair) {
      const n = Math.round(def.sh / .19); for (let i = 0; i < n; i++) { const h = (i + 1) * (def.sh + .04) / n; G.add(M.wood, ABX.box, xs0 + (i + .5) * L / n, base + h - .05, z0 + .48, 0, 0, 0, L / n + .01, .1, .92); G.add(M.woodDark, ABX.box, xs0 + (i + .5) * L / n, base + h / 2 - .05, z0 + .03, 0, 0, 0, L / n + .01, h, .05); }
      FLOORS.push({ x0: xs0, x1: xs1, z0, z1: zs1, y: 0, ramp: { axis: 'x', c0: xs0, c1: xs1, y0: base + .01, y1: fy + .04 }, v2: def.id });
      // ringhiera del vano scala al piano superiore
      for (let x = xs0; x <= xs1; x += .45) G.add(M.woodDark, ABX.box, x, fy + .5, zs1 + .03, 0, 0, 0, .05, .95, .05); G.add(M.woodDark, ABX.box, (xs0 + xs1) / 2, fy + .98, zs1 + .03, 0, 0, 0, L, .07, .07);
      const s = addSolid(xs0, fy + .04, zs1, xs1 - .9, fy + 1, zs1 + .06, 'furniture'); s.mat = 'legno';
      // camere al piano superiore: letti, armadio, cassapanca
      F.bed(x1 - .7, fy + .04, z1 - 1.2, 0); F.cupboard(x0 + .8, fy + .04, z1 - .35, PI); F.chair(x1 - 1.9, fy + .04, z1 - .6, PI); if (def.w > 10) F.bed(x0 + 2.5, fy + .04, z1 - 1.2, 0);
    }
  }
  // arredo per tipo
  const cx = def.x, cz = def.z, y = base + .01;
  if (def.kind === 'inn') { F.counter(x1 - 1.4, y, cz - .4, PI / 2, 3.4); F.bottles(x1 - .35, y + 1.5, cz - .4, PI / 2, 2.6); G.add(M.wood, ABX.box, x1 - .3, y + 1.5, cz - .4, 0, PI / 2, 0, 2.8, .04, .3); for (const [tx, tz] of [[cx - 3, cz + 1.4], [cx - .2, cz + 1.6], [cx - 3, cz - .2]]) { F.table(tx, y, tz, 0, 1.1, .8); F.chair(tx - .75, y, tz, -PI / 2); F.chair(tx + .75, y, tz, PI / 2); } F.barrel(x1 - .5, y, z1 - .5); F.barrel(x1 - 1.2, y, z1 - .45); F.stove(x0 + .5, y, cz + .8); }
  if (def.kind === 'mairie') { F.desk(cx - 2.5, y, cz + .5, 0); F.chair(cx - 2.5, y, cz - .2, 0); F.desk(cx + 2, y, cz - 1.2, PI); F.chair(cx + 2, y, cz - .5, PI); F.table(cx + .2, y, cz + 1.6, 0, 2, 1.1); G.add(M.cloth, ABX.box, cx + .2, y + .78, cz + 1.6, 0, .05, 0, 1.3, .01, .9, 0xd8ccaa); for (let i = 0; i < 3; i++) F.cabinet(x0 + .35, y, z0 + .6 + i * .65, PI / 2); F.shelf(x1 - .2, y, cz, -PI / 2, 2); F.stove(x1 - .5, y, z0 + .5); }
  if (def.kind === 'bakery') { G.add(M.brick, ABX.box, cx + 2.2, y + .9, z1 - .9, 0, 0, 0, 2.2, 1.8, 1.6); G.add(M.stoneDark, ABX.box, cx + 2.2, y + .75, z1 - 1.72, 0, 0, 0, .7, .45, .04); const s = addSolid(cx + 1.1, y, z1 - 1.7, cx + 3.3, y + 1.8, z1, 'furniture'); s.mat = 'muratura'; F.counter(cx - 1, y, z0 + 1.5, 0, 3); F.shelf(cx - 1, y, z1 - .2, PI, 2.4); for (let i = 0; i < 6; i++) G.add(M.straw, ABX.box, cx - 2 + i * .4, y + 1.2, z0 + 1.45, 0, sr(), 0, .32, .1, .14); F.table(x0 + .9, y, cz, PI / 2, 1.8, .8); }
  if (def.kind === 'shop') { F.counter(cx, y, cz + .2, PI / 2, 3); F.shelf(x0 + .2, y, cz, PI / 2, 3); F.shelf(cx, y, z1 - .2, PI, 2); for (let i = 0; i < 4; i++) F.crate(cx + 1.6, y, z0 + .7 + i * .65, sr(), false); F.barrel(x1 - .5, y, z1 - .5); }
  if (def.kind === 'house2') { F.hearth(x0 + 1.4, y, z1 - .3, PI); F.table(cx, y, cz + .6, 0, 1.8, .9); for (const s of [-1, 1]) { F.chair(cx + s * .5, y, cz + 1.3, PI); F.chair(cx + s * .5, y, cz - .1, 0); } F.cupboard(x1 - .8, y, z1 - .35, PI, 1.4, 1.9); F.bench(x1 - .5, y, cz, PI / 2, 1.4); }
  if (def.kind === 'farmhouse') { F.hearth(x0 + .5, y, cz, -PI / 2); F.table(cx - 1.5, y, cz, 0, 2.6, .95); F.bench(cx - 1.5, y, cz + .75, 0, 2.4); F.bench(cx - 1.5, y, cz - .75, 0, 2.4); F.cupboard(cx + 2, y, z1 - .35, PI, 1.6, 2.1); F.shelf(cx + 4, y, z1 - .2, PI, 1.6); F.barrel(x1 - .5, y, z0 + .5); F.barrel(x1 - .5, y, z0 + 1.2); apChurn(G, x1 - 1.4, z0 + .5); V2.props++; }
  if (def.kind === 'barn') { for (let i = 0; i < 10; i++) apHay(G, x0 + 1 + (i % 5) * 1.1, z0 + .8 + Math.floor(i / 5) * 1.25, sr() * .1, y + ((i * 7) % 3 === 0 ? .5 : 0)); apCart(G, cx + 3.5, cz + .5, PI / 2 + .1); apTool(G, x1 - .4, z0 + 1, -PI / 2, 'fork', .3, y); apTool(G, x1 - .4, z0 + 1.6, -PI / 2, 'spade', .28, y); V2.props += 13;
    // soppalco del fieno (travi e tavolato) sopra la metà ovest, con scala a pioli
    const hy = base + 2.8; G.add(M.woodOld, ABX.box, x0 + 3, hy, cz, 0, 0, 0, 6, .1, z1 - z0); for (let x = x0 + .3; x < x0 + 6; x += 1.2) G.add(M.woodDark, ABX.box, x, hy - .15, cz, 0, 0, 0, .16, .22, z1 - z0); for (let i = 0; i < 4; i++) apHay(G, x0 + .9 + i * 1.2, z1 - 1, .1, hy + .05);
    const s = addSolid(x0, hy - .1, z0, x0 + 6, hy + .05, z1, 'floor'); s.walk = true; s.mat = 'legno'; FLOORS.push({ x0, x1: x0 + 6, z0, z1, y: hy + .05, v2: def.id }); }
  if (def.kind === 'stable') { for (let i = 0; i < 4; i++) { const zz = z0 + 1.2 + i * 2.6; G.add(M.woodOld, ABX.box, cx + .6, y + .7, zz + 1.3, 0, 0, 0, 2.6, 1.4, .08); G.add(M.stoneDark, ABX.box, x1 - .35, y + .4, zz + .1, 0, 0, 0, .5, .5, 1.8); apHay(G, x1 - .6, zz - .6, .2, y); } V2.props += 12; apTool(G, x0 + .3, z0 + .6, PI / 2, 'fork', .3, y); apBucket(G, cx - 1, z1 - .6, y); }
  if (def.kind === 'store') { for (let i = 0; i < 8; i++) apCrate(G, x0 + .6 + (i % 3) * .9, z0 + .6 + Math.floor(i / 3) * .9, sr() * .3, .8, .55, .6, i % 2 === 0, y); for (let i = 0; i < 3; i++) apBarrel(G, x1 - .6, z1 - .6 - i * .8, 0); V2.props += 11; }
  if (def.kind === 'shed') { apFirewood(G, cx, z0 + .5, 0, def.w - 1.4, 1); apTool(G, x0 + .2, cz, PI / 2, 'spade', .3, y); V2.props += 2; }
  G.build();
  if (def.kind !== 'barn' && def.kind !== 'stable' && def.kind !== 'store' && def.kind !== 'shed') aaaRoom(x0 - .02, base - .3, z0 - .02, x1 + .02, def.storeys > 1 && !def.stair && def.ceilingOnly ? fy : b.top + 2, z1 + .02);
}
// rudere: muri senza tetto, sommità irregolare, macerie dentro
function v2Ruin(def) {
  const M = AAA.mats, G = new AGeo(), sr = seeded(def.seed), t = .55, base = def.base, top = base + def.sh;
  const wallMat = aaaTri('cobble', .36, { nStr: 1.7, macro: .26, moss: 1.4, damp: 1.4, baseY: base, color: def.wallCol, hq: 'muro_pietra', hqScale: .45 });
  const { x: cx, z: cz, w, d } = def, faces = {
    '+z': { axis: 'x', fixed: cz + d / 2, out: 1, a0: cx - w / 2, a1: cx + w / 2, y0: base - .5, y1: top, t }, '-z': { axis: 'x', fixed: cz - d / 2, out: -1, a0: cx - w / 2, a1: cx + w / 2, y0: base - .5, y1: top, t },
    '+x': { axis: 'z', fixed: cx + w / 2, out: 1, a0: cz - d / 2 + t, a1: cz + d / 2 - t, y0: base - .5, y1: top, t }, '-x': { axis: 'z', fixed: cx - w / 2, out: -1, a0: cz - d / 2 + t, a1: cz + d / 2 - t, y0: base - .5, y1: top, t } };
  for (const k in faces) {
    const F = faces[k], L = F.a1 - F.a0, H = top - F.y0, ops = def.faces[k].map(o => Object.assign({}, o, { y0: base + o.y })), shape = [[L, H * (.55 + sr() * .4)]];
    for (let a = L - .6; a > .4; a -= .5 + sr() * .5) shape.push([a, H * (.35 + sr() * .6)]); shape.push([0, H * (.6 + sr() * .35)]);
    aaaWall(G, wallMat, F, ops.filter(o => o.y0 + o.h < base + H * .3 + .5 || o.kind === 'door'), shape); aaaWallSolids(F, ops, 'ruin');
  }
  for (let i = 0; i < 26; i++) { const x = cx + (sr() - .5) * (w - 1.4), z = cz + (sr() - .5) * (d - 1.4), s = .25 + sr() * .45; G.add(wallMat, ABX.box, x, base - .1 + s * .3, z, sr() * 2, sr() * 3, sr() * 2, s * 1.4, s * .7, s); }
  for (let i = 0; i < 5; i++) G.add(M.woodDark, ABX.box, cx + (sr() - .5) * (w - 2), base + .2, cz + (sr() - .5) * (d - 2), sr() * .4, sr() * 3, .3 + sr() * .3, .16, .2, 3 + sr() * 2);   // travi del tetto crollato
  V2.props += 31; const grp = G.build(); AAA.objs.push({ id: def.id, grp, def }); V2.built.push({ def, grp, base, top, faces, ruin: true });
  V2.destr.push({ id: def.id, stato: 'rudere', parti: Object.keys(faces).map(k => ({ id: def.id + ':muro' + k, tipo: 'strutturale', danno: 'pesante', bbox: null, connessioni: [] })) });
}
// ---------------------------------------------------------------- chiesa: navata e campanile salibile
function v2Church() {
  const N = V2.built.find(b => b.def.id === 'v2_chiesa'), T = V2.built.find(b => b.def.id === 'v2_campanile'); if (!N || !T) return;
  const M = AAA.mats, G = new AGeo(), sr = seeded(404), F = v2Furn(G, sr), t = .55;
  // --- navata: lastre di pietra, presbiterio rialzato a est, banchi, altare, croce, capriate
  { const d = N.def, base = N.base, x0 = d.x - d.w / 2 + t, x1 = d.x + d.w / 2 - t, z0 = d.z - d.d / 2 + t, z1 = d.z + d.d / 2 - t, flag = AAA.mats.flag || M.stoneDark;
    for (let x = x0; x < x1 - .05; x += .8) for (let z = z0; z < z1 - .05; z += .7) G.add(flag, ABX.box, x + Math.min(.8, x1 - x) / 2, base - .05 + sr() * .008, z + Math.min(.7, z1 - z) / 2, 0, 0, 0, Math.min(.8, x1 - x) - .02, .1, Math.min(.7, z1 - z) - .02);
    FLOORS.push({ x0, x1, z0, z1, y: base + .01, v2: d.id });
    const cx0 = x1 - 3.4; G.add(M.stoneLight, ABX.box, (cx0 + x1) / 2, base + .15, d.z, 0, 0, 0, x1 - cx0, .3, z1 - z0); FLOORS.push({ x0: cx0, x1, z0, z1, y: base + .31, v2: d.id }); { const s = addSolid(cx0, base - .1, z0, x1, base + .3, z1, 'floor'); s.walk = true; s.mat = 'muratura'; }
    G.add(M.stoneLight, ABX.box, x1 - 1.2, base + .3 + .5, d.z, 0, 0, 0, .9, 1, 2.2); { const s = addSolid(x1 - 1.65, base, d.z - 1.1, x1 - .75, base + 1.3, d.z + 1.1, 'furniture'); s.mat = 'muratura'; }
    G.add(M.cloth, ABX.box, x1 - 1.2, base + 1.31, d.z, 0, 0, 0, .95, .02, 2.3, 0xe8e2d0); for (const k of [-1, 1]) { G.add(M.rust, ABX.cyl, x1 - 1.2, base + 1.5, d.z + k * .8, 0, 0, 0, .03, .35, .03); G.add(M.vc, ABX.cyl, x1 - 1.2, base + 1.75, d.z + k * .8, 0, 0, 0, .025, .18, .025, 0xf0ead8); }
    G.add(M.woodDark, ABX.box, x1 - .1, base + 3.6, d.z, 0, 0, 0, .1, 1.9, .14); G.add(M.woodDark, ABX.box, x1 - .1, base + 4, d.z, 0, 0, 0, .1, .14, 1.1);
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) F.pew(x0 + 2.2 + i * 1.5, base, d.z + s * 2.05, -PI / 2, 2.9);
    G.add(M.stoneLight, ABX.cyl, x0 + 1, base + .5, d.z + 2.6, 0, 0, 0, .35, 1, .35); V2.props++;   // fonte battesimale
    for (let x = x0 + 1.2; x < x1; x += 2.6) { const yt = base + d.sh - .1; G.add(M.woodDark, ABX.box, x, yt, d.z, 0, 0, 0, .22, .26, z1 - z0 + .4); G.add(M.woodDark, ABX.box, x, yt + 1.9, d.z, 0, 0, 0, .18, 3.8, .18); for (const s of [-1, 1]) G.add(M.woodDark, ABX.box, x, yt + 1.2, d.z + s * 1.8, s * -.78, 0, 0, .16, .16, 4.4); }
    aaaRoom(x0 - .02, base - .3, z0 - .02, x1 + .02, base + d.sh + 4.5, z1 + .02);
    // muretto del sagrato con croci e lapidi tra la chiesa e la piazza (varco davanti al portale)
    const Gw = new AGeo(), zw = d.z + d.d / 2 + 6.5, door = d.x - d.w / 2 + .66 * d.w;
    apDryWall(Gw, d.x - d.w / 2 - 7.8, zw, door - 1.6, zw, .9, 14); apDryWall(Gw, door + 1.6, zw, d.x + d.w / 2 + .5, zw, .9, 15); apGatePillar(Gw, door - 1.5, zw, 1.4); apGatePillar(Gw, door + 1.5, zw, 1.4);
    for (let i = 0; i < 9; i++) { const gx = d.x - d.w / 2 + 1 + i * 2.05 + (sr() - .5) * .4, gz = d.z + d.d / 2 + 2 + (i % 3) * 1.3; if (Math.abs(gx - door) < 1.4) continue; const y = aaaH(gx, gz); if (i % 2) { Gw.add(M.stoneLight, ABX.box, gx, y + .45, gz, 0, (sr() - .5) * .2, (sr() - .5) * .08, .1, .9, .1); Gw.add(M.stoneLight, ABX.box, gx, y + .68, gz, 0, (sr() - .5) * .2, 0, .5, .1, .1); } else Gw.add(M.stoneLight, ABX.box, gx, y + .3, gz, (sr() - .5) * .1, 0, 0, .55, .6, .12); Gw.add(M.stoneDark, ABX.box, gx, y + .03, gz + .7, 0, 0, 0, .7, .08, 1.5); V2.props++; }
    Gw.build(); V2.props += 4;
  }
  // --- campanile: quattro livelli (0 / 4,2 / 8,4 / 12,6 m), due rampe per livello con pianerottolo a ovest, cella campanaria in cima
  { const d = T.def, base = T.base, x0 = d.x - d.w / 2 + t, x1 = d.x + d.w / 2 - t, z0 = d.z - d.d / 2 + t, z1 = d.z + d.d / 2 - t, H = d.sh, sw = .9, L = (x1 - .2) - (x0 + sw);
    G.add(AAA.mats.flag || M.stoneDark, ABX.box, d.x, base - .05, d.z, 0, 0, 0, x1 - x0, .1, z1 - z0); FLOORS.push({ x0, x1, z0, z1, y: base + .01, v2: d.id });
    const flight = (xa, ya, xb, yb, za, zb) => {   // rampa lungo x (gradini con cosciale, sotto libero)
      const n = Math.round(Math.abs(yb - ya) / .2); for (let i = 0; i < n; i++) { const k = (i + .5) / n, x = lerp(xa, xb, k), y = lerp(ya, yb, (i + 1) / n); G.add(M.wood, ABX.box, x, y - .04, (za + zb) / 2, 0, 0, 0, Math.abs(xb - xa) / n + .02, .07, zb - za - .04); }
      const len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa); for (const zz of [za + .03, zb - .03]) G.add(M.woodDark, ABX.box, (xa + xb) / 2, (ya + yb) / 2 - .12, zz, 0, 0, ang, len, .22, .05);
      FLOORS.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: za, z1: zb, y: 0, ramp: { axis: 'x', c0: xa, c1: xb, y0: ya, y1: yb }, v2: d.id });
    };
    const slab = (a0, a1, c0, c1, y) => { G.add(M.woodOld, ABX.box, (a0 + a1) / 2, y - .05, (c0 + c1) / 2, 0, 0, 0, a1 - a0, .1, c1 - c0); const s = addSolid(a0, y - .12, c0, a1, y, c1, 'floor'); s.walk = true; s.mat = 'legno'; FLOORS.push({ x0: a0, x1: a1, z0: c0, z1: c1, y, v2: d.id }); };
    for (let k = 0; k < 3; k++) {
      const y = base + k * H;
      flight(x1 - .2, y + .01, x0 + sw, y + H / 2, z0, z0 + sw);                 // rampa nord: da est a ovest
      slab(x0, x0 + sw, z0, z1, y + H / 2);                                      // pianerottolo ovest
      flight(x0 + sw, y + H / 2, x1 - .2, y + H, z1 - sw, z1);                   // rampa sud: da ovest a est
      if (k < 2) { slab(x0, x1, z0 + sw, z1 - sw, y + H); slab(x1 - .2, x1, z0, z0 + sw, y + H); slab(x1 - .2, x1, z1 - sw, z1, y + H); }
      else { slab(x0, x1, z0, z1 - sw, y + H); slab(x1 - .2, x1, z1 - sw, z1, y + H); const xr = x1 - 1.15; for (let x = x0 + .1; x <= xr; x += .5) G.add(M.woodDark, ABX.box, x, y + H + .5, z1 - sw - .03, 0, 0, 0, .05, 1, .05); G.add(M.woodDark, ABX.box, (x0 + .1 + xr) / 2, y + H + 1, z1 - sw - .03, 0, 0, 0, xr - x0 - .1, .07, .07); const s = addSolid(x0, y + H, z1 - sw - .08, xr, y + H + 1.05, z1 - sw + .02, 'furniture'); /* ringhiera del vano, varco a est dove arriva la scala */ s.mat = 'legno'; }
    }
    // cella campanaria: castello di travi e campana di bronzo; sacchi a terra alla finestra nord (posto d'osservazione tedesco)
    const yb = base + 3 * H, bell = apLathe('bell', [[0, 0], [.42, 0], [.46, .06], [.4, .2], [.3, .45], [.26, .62], [.2, .7], [0, .72]], 18);
    for (const s of [-1, 1]) G.add(M.woodDark, ABX.box, d.x + s * 1.1, yb + 1.4, d.z, 0, 0, 0, .2, 2.8, .2); G.add(M.woodDark, ABX.box, d.x, yb + 2.75, d.z, 0, 0, 0, 2.4, .22, .22);
    G.add(aaaTri('metal', .8, { nStr: .8, rough: .45, metal: .85, color: 0x8a6a3a, key: 'bronze' }), bell, d.x, yb + 1.85, d.z, 0, 0, 0, 1, 1, 1); G.add(M.metal, ABX.cyl, d.x, yb + 1.9, d.z, 0, 0, 0, .05, .5, .05);
    const sack = apLathe('sack', [[0, -.5], [.35, -.42], [.5, -.1], [.5, .1], [.35, .42], [0, .5]], 10);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) G.add(M.sack, sack, d.x - .6 + i * .6, yb + .12 + r * .2, z0 + .3, PI / 2, PI / 2, 0, .72, .62, .4);
    F.crate(d.x + 1.2, yb, d.z - .8, .3); G.add(M.metal, ABX.box, d.x - 1.2, yb + .2, d.z + .3, 0, .4, 0, .3, .4, .25, 0x3a3e32);   // cassa e radio da campo
    aaaRoom(x0 - .02, base - .3, z0 - .02, x1 + .02, base + 4 * H, z1 + .02);
  }
  G.build();
}
// ---------------------------------------------------------------- piazza lastricata, pozzo, monumento, segni dell'occupazione
function v2Plaza() {
  const P = V2.plaza, st = .5, nu = Math.round((P.u1 - P.u0 + 2) / st), nv = Math.round((P.v1 - P.v0 + 2) / st), pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = P.u0 - 1 + i * st, v = P.v0 - 1 + j * st, [x, z] = v2W(u, v); pos.push(x, aaaH(x, z) + .025, z); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const u = P.u0 - 1 + (i + .5) * st, v = P.v0 - 1 + (j + .5) * st; if (v2PlazaD(u, v) > .6 + vnoise(u * .7, v * .7) * .6) continue; const a = j * (nu + 1) + i, b = a + nu + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  const m = aaaTri('cobble', .3, { nStr: 1.6, macro: .3, damp: .6, color: 0xa8a092, key: 'plaza' }), mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh); V2.plazaMesh = mesh;
  const M = AAA.mats, G = new AGeo(), sr = seeded(505);
  // pozzo: vera di pietra, due montanti, verricello, secchio
  { const [x, z] = v2W(-117, 12), y = aaaH(x, z); G.add(M.stone, apLathe('well', [[.8, 0], [.85, .05], [.85, .85], [.9, .9], [.62, .9], [.58, .05], [0, .05]], 20), x, y, z); for (const s of [-1, 1]) G.add(M.woodDark, ABX.box, x + s * .82, y + 1.3, z, 0, 0, 0, .14, 1.6, .14); G.add(M.woodDark, ABX.cyl, x, y + 1.7, z, 0, 0, PI / 2, .1, 1.6, .1); for (const s of [-1, 1]) G.add(M.roofTile, ABX.box, x, y + 2.25, z + s * .4, s * .7, 0, 0, 2, .05, 1, 0x585e66); apBucket(G, x + .5, z + .1, y + .9); const s = addSolid(x - .9, y, z - .9, x + .9, y + .9, z + .9, 'well'); s.mat = 'muratura'; V2.props++; }
  // monumento ai caduti 1914-1918: basamento a gradini, obelisco, lapide
  { const [x, z] = v2W(-101, -2.5), y = aaaH(x, z); G.add(M.stoneLight, ABX.box, x, y + .15, z, 0, 0, 0, 2.6, .3, 2.6); G.add(M.stoneLight, ABX.box, x, y + .45, z, 0, 0, 0, 1.9, .3, 1.9); G.add(M.stoneLight, ABX.box, x, y + 1.25, z, 0, 0, 0, 1.1, 1.3, 1.1); G.add(M.stoneLight, apLathe('obel', [[.42, 0], [.3, 2.4], [0, 2.75]], 4), x, y + 1.9, z, 0, PI / 4, 0); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) G.add(M.metal, ABX.cyl, x + s * 1.25, y + .4, z - .9 + i * .6, 0, 0, 0, .04, .5, .04); const s = addSolid(x - 1.3, y, z - 1.3, x + 1.3, y + 2, z + 1.3, 'monument'); s.mat = 'muratura'; V2.props++; }
  v2Board(...v2W(-101, -1.92), 0, .8, .45, ['AUX MORTS', 'DE LA COMMUNE', '1914 · 1918'], '#cfc6b0', '#3a3a34', aaaH(...v2W(-101, -2.5)) + 1.25);
  // tigli della piazza, panche, terrazza abbandonata del caffè (sedie rovesciate), bicicletta appoggiata al muro
  for (const [u, v] of [[-120, -4], [-96, 14], [-120, 15]]) { const [x, z] = v2W(u, v); F_bench(G, x + 1.2, aaaH(x, z), z, PI / 2); }
  const Fi = v2Furn(G, sr); { const L = V2.built.find(b => b.def.id === 'v2_locanda').def, zt = L.z + L.d / 2 + 1.2; for (let i = 0; i < 3; i++) { const x = L.x - 4 + i * 2.2, y = aaaH(x, zt); Fi.table(x, y, zt, sr(), .8, .8, false); Fi.chair(x - .6, y, zt + .2, sr() * 6); if (i !== 1) G.add(M.wood, ABX.box, x + .6, y + .22, zt - .3, PI / 2, sr() * 3, 0, .42, .04, .42); } }
  v2Bicycle(G, ...v2W(-125.9, 12.5), PI / 2);
  for (const [u, v, txt, ry, col] of [[-89, -2.4, ['CAFÉ DE LA PLACE'], 0, '#e8dcc0'], [-88, 14.95, ['BOULANGERIE'], PI, '#e8dcc0'], [-126.95, 15, ['ÉPICERIE · MERCERIE'], PI / 2, '#e0d4b0'], [-112, 18.65, ['MAIRIE'], PI, '#d8d0bc']]) { const [x, z] = v2W(u, v), b = V2.built.find(q => Math.abs(q.def.u - u) < 8 && Math.abs(q.def.v - v) < 8); v2Board(x, z, ry, txt[0].length * .19 + .4, .42, txt, col, '#2a2a26', (b ? b.base : aaaH(x, z)) + (u === -112 ? 2.95 : 2.5)); }
  v2Board(...v2W(-110.55, 18.62), PI, 1.15, .34, ['ORTSKOMMANDANTUR'], '#e8e4d8', '#111', V2.defs.find(d => d.id === 'v2_mairie').base + 1.9);
  v2Board(...v2W(-115.5, 18.62), PI, .62, .85, ['AVIS', 'à la population', '— — —', 'Bekanntmachung', '— — — —'], '#e8e2cc', '#222', aaaH(...v2W(-112, 23)) + 1.55);
  v2Board(...v2W(-106.05, 18.62), PI, .5, .7, ['BEKANNT-', 'MACHUNG', '— — —', '— — —'], '#d8c8a0', '#1a1a1a', aaaH(...v2W(-112, 23)) + 1.5);
  apSign(G, ...v2W(-96, -1.5), .2, 'ST-LAURENT 4 KM'); apSign(G, ...v2W(-99.5, -3.5), -PI / 2, 'Ortskommandantur'); V2.props += 12;
  G.build();
}
function F_bench(G, x, y, z, ry) { const M = AAA.mats; G.add(M.woodOld, ABX.box, x, y + .45, z, 0, ry, 0, 1.8, .06, .4); for (const a of [-1, 1]) G.add(M.stoneLight, ABX.box, x + Math.cos(ry) * a * .7, y + .22, z - Math.sin(ry) * a * .7, 0, ry, 0, .12, .44, .36); V2.props++; }
function v2Bicycle(G, x, z, ry) {
  const M = AAA.mats, y = aaaH(x, z), wheel = new THREE.TorusGeometry(.34, .022, 5, 18), P = (a, h) => [x + Math.cos(ry) * a, y + h, z - Math.sin(ry) * a];
  for (const a of [-.52, .52]) G.add(M.metal, wheel, ...P(a, .35), 0, ry, .12, 1, 1, 1, 0x1a1a1a);
  G.add(M.metal, ABX.box, ...P(0, .62), 0, ry, -.05, 1, .035, .035, 0x2a3a2a); G.add(M.metal, ABX.box, ...P(-.2, .48), 0, ry, .9, .62, .035, .035, 0x2a3a2a); G.add(M.metal, ABX.box, ...P(.3, .5), 0, ry, -.8, .5, .035, .035, 0x2a3a2a);
  G.add(M.cloth, ABX.box, ...P(-.28, .82), 0, ry, 0, .22, .05, .1, 0x3a2a1a); G.add(M.metal, ABX.box, ...P(.48, .95), 0, ry + PI / 2, 0, .5, .03, .03, 0x1a1a1a); V2.props++;
}
// insegna o avviso dipinto (texture su canvas), appoggiata a una facciata: (x, z) sul piano del muro, ry verso l'esterno
function v2Board(x, z, ry, w, h, lines, bg, fg, y) {
  const tex = aaaCanvasTex(512, Math.round(512 * h / w), (g, W, Hh) => { g.fillStyle = bg; g.fillRect(0, 0, W, Hh); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(4, 4, W - 8, Hh - 8); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; const fs = Math.min(Hh / (lines.length + .6), W / (Math.max(...lines.map(l => l.length)) * .62)); g.font = `bold ${fs | 0}px serif`; lines.forEach((l, i) => g.fillText(l, W / 2, Hh * (i + .8) / (lines.length + .6))); g.fillStyle = 'rgba(70,55,35,.18)'; for (let i = 0; i < 220; i++) g.fillRect(Math.random() * W, Math.random() * Hh, 3, 3); }, false);
  const m = aaaPatch(new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), { key: 'sign' }), mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, .03), m);
  mesh.position.set(x + Math.sin(ry) * .03, y, z + Math.cos(ry) * .03); mesh.rotation.y = ry; mesh.castShadow = true; scene.add(mesh); V2.props++; return mesh;
}
// ---------------------------------------------------------------- B. quartiere residenziale
function v2ResidentialProps() {
  const M = AAA.mats, G = new AGeo(), sr = seeded(606), U = v2W;
  // muretti di pietra a secco e cancelli dei cortili, recinzioni degli orti
  apDryWall(G, ...U(-85.5, 52), ...U(-82.6, 52), 1, 21); apDryWall(G, ...U(-77.4, 52), ...U(-74.5, 52), 1, 22); apGatePillar(G, ...U(-82.4, 52), 1.3); apGatePillar(G, ...U(-77.6, 52), 1.3);
  apDryWall(G, ...U(-85.5, 52), ...U(-85.5, 62), 1, 23); apDryWall(G, ...U(-74.5, 52), ...U(-74.5, 62), 1, 24);
  apDryWall(G, ...U(-75, 42.6), ...U(-71, 42.6), 1.1, 25); apDryWall(G, ...U(-67, 42.6), ...U(-63, 42.6), 1.1, 26);
  apDryWall(G, ...U(-47, 39.6), ...U(-44.2, 39.6), 1, 27); apDryWall(G, ...U(-39.8, 39.6), ...U(-37, 39.6), 1, 28);
  apFence(G, [U(-105, 46), U(-105, 56), U(-92, 56)], 31); apFence(G, [U(-62, 66), U(-50, 66), U(-50, 73)], 32); apFence(G, [U(-34, 50), U(-22, 50)], 33); V2.props += 14;
  // orti: aiuole con cavoli e porri (file irregolari), spaventapasseri
  const veg = new THREE.IcosahedronGeometry(.2, 1); let n = 0;
  for (const [u0, v0, nu, nv] of [[-104, 47.5, 7, 5], [-60, 67, 6, 4], [-33, 45, 6, 3]]) for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const [x, z] = U(u0 + i * 1.1 + (sr() - .5) * .2, v0 + j * .9 + (sr() - .5) * .2), y = aaaH(x, z), s = .7 + sr() * .5; G.add(M.vc, veg, x, y + .08 * s, z, sr(), sr() * 3, 0, s, s * .7, s, [0x4a6a32, 0x5a7a3a, 0x3e5a2a][(sr() * 3) | 0]); n++; }
  V2.props += n;
  // depositi e attrezzi: carriola, legnaia, botti per l'acqua piovana, ceppo con l'ascia, panni stesi
  apFirewood(G, ...U(-100, 46.8), 0, 2.4, 1.1); apFirewood(G, ...U(-64.5, 31), PI / 2, 2, 1); apBarrel(G, ...U(-75, 53.3), 0); apBarrel(G, ...U(-37.2, 31.5), 0); apBarrel(G, ...U(-104.9, 44), 0);
  v2Wheelbarrow(G, ...U(-70, 44.5), .6); v2Wheelbarrow(G, ...U(-53, 57), 2.2);
  { const [x, z] = U(-66, 44), y = aaaH(x, z); G.add(M.bark, ABX.cyl, x, y + .25, z, 0, 0, 0, .28, .5, .28); G.add(M.woodDark, ABX.box, x + .05, y + .62, z, 0, 0, .5, .05, .5, .05); G.add(M.metal, ABX.box, x - .06, y + .52, z, 0, 0, .5, .03, .06, .14); V2.props++; }
  v2Laundry(G, ...U(-84, 65), ...U(-77, 65)); v2Laundry(G, ...U(-46, 31), ...U(-40, 28));
  apTool(G, ...U(-98.9, 49.3), 0, 'fork', .25); apTool(G, ...U(-46.5, 68.3), 0, 'spade', .28); v2Bicycle(G, ...U(-80.5, 53.3), 0); V2.props += 11;
  G.build();
}
function v2Wheelbarrow(G, x, z, ry) { const M = AAA.mats, y = aaaH(x, z), P = (a, b, h) => [x + Math.cos(ry) * a + Math.sin(ry) * b, y + h, z - Math.sin(ry) * a + Math.cos(ry) * b]; G.add(M.woodOld, ABX.box, ...P(0, 0, .45), 0, ry, -.08, .9, .3, .6); G.add(M.metal, new THREE.TorusGeometry(.2, .04, 5, 14), ...P(.55, 0, .2), 0, ry, 0); for (const s of [-1, 1]) G.add(M.woodDark, ABX.box, ...P(-.35, s * .25, .38), 0, ry, -.15, 1.3, .05, .05); V2.props++; }
function v2Laundry(G, x0, z0, x1, z1) { const M = AAA.mats, ya = aaaH(x0, z0), yb = aaaH(x1, z1); for (const [x, z, y] of [[x0, z0, ya], [x1, z1, yb]]) G.add(M.woodDark, ABX.box, x, y + .95, z, 0, 0, 0, .08, 1.9, .08); const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0); G.add(M.metal, ABX.box, (x0 + x1) / 2, (ya + yb) / 2 + 1.82, (z0 + z1) / 2, 0, ry, 0, L, .012, .012); const sr = seeded(Math.round(x0 * 3)); for (let i = 1; i < 5; i++) { const k = i / 5.3; G.add(M.cloth, ABX.box, lerp(x0, x1, k), lerp(ya, yb, k) + 1.5, lerp(z0, z1, k), 0, ry, 0, .45 + sr() * .3, .6 + sr() * .2, .015, [0xe8e4d8, 0xc8c0b0, 0x8a8a9a, 0xb8a888][i % 4]); } V2.props++; }
// ---------------------------------------------------------------- C. fattoria
function v2FarmProps() {
  const M = AAA.mats, G = new AGeo(), sr = seeded(707), U = v2W;
  // muri della corte con portone verso la strada della fattoria
  apDryWall(G, ...U(107.7, -26.2), ...U(107.7, -22.2), 1.6, 41); apDryWall(G, ...U(107.7, -18.8), ...U(107.7, -14), 1.6, 42); apGatePillar(G, ...U(107.7, -22.1), 2); apGatePillar(G, ...U(107.7, -18.9), 2); apGate(G, ...U(107.7, -22.1), PI / 2 + .3, 3.2, 1.1);
  apDryWall(G, ...U(107.7, -14), ...U(111.3, -13.6), 1.6, 43); apDryWall(G, ...U(124.7, -13.6), ...U(128.4, -17.4), 1.6, 44); apDryWall(G, ...U(128.9, -35.6), ...U(132.4, -30.6), 1.6, 45); apDryWall(G, ...U(107.8, -35.9), ...U(110.9, -36), 1.6, 46); V2.props += 7;
  // corte: pozzo, letamaio, abbeveratoio, carro, aratro, balle, ruota, botti, attrezzi
  { const [x, z] = U(119, -24), y = aaaH(x, z); G.add(M.stone, apLathe('well', [[.8, 0], [.85, .05], [.85, .85], [.9, .9], [.62, .9], [.58, .05], [0, .05]], 20), x, y, z); const s = addSolid(x - .9, y, z - .9, x + .9, y + .9, z + .9, 'well'); s.mat = 'muratura'; V2.props++; }
  { const [x, z] = U(112.5, -31), y = aaaH(x, z); G.add(M.terra, apLathe('manure', [[2, 0], [1.6, .5], [.8, .9], [0, 1]], 12), x, y - .05, z, 0, 0, 0, 1, 1, .8, undefined); G.add(M.straw, apLathe('manure2', [[1.8, 0], [1.2, .6], [0, .82]], 9), x + .3, y, z + .2, 0, 1, 0); V2.props++; }
  { const [x, z] = U(127, -22), y = aaaH(x, z); G.add(M.stoneLight, ABX.box, x, y + .3, z, 0, 0, 0, .7, .6, 2.2); G.add(M.water, ABX.box, x, y + .55, z, 0, 0, 0, .5, .02, 2, 0x404030); V2.props++; }
  apCart(G, ...U(122, -30.5), .4); apCart(G, ...U(100.5, -14), PI / 2 + .1); v2Plough(G, ...U(114, -17.5), 1.2);
  for (let i = 0; i < 7; i++) apHay(G, ...U(126 + (i % 3) * 1.05, -33.6 + Math.floor(i / 3) * .7), .05 * i); apBarrel(G, ...U(124.5, -15), 0); apBarrel(G, ...U(125.2, -15.4), 0); apChurn(G, ...U(123.2, -14.4)); apChurn(G, ...U(123.6, -14.9));
  apTool(G, ...U(111.3, -15.6), PI / 2, 'fork', .3); apFirewood(G, ...U(118, -14.6), 0, 3, 1.2); V2.props += 16;
  // tettoia del fieno (struttura aperta su pali, copertura in lamiera ondulata) con il fieno della stagione precedente
  { const cx = 84, cz = -30, W = 9, D = 6, Hh = 4.2, roofM = aaaTri('metal', .5, { nStr: 1.6, rough: .8, metal: .3, macro: .5, color: 0x9a8a78, hq: 'metallo', hqScale: .9, key: 'corrug' });
    for (const a of [-1, 0, 1]) for (const b of [-1, 1]) { const [x, z] = U(cx + a * W / 2, cz + b * D / 2), y = aaaH(x, z); G.add(M.woodDark, ABX.box, x, y + Hh / 2, z, 0, 0, 0, .22, Hh + .3, .22); const s = addSolid(x - .12, y, z - .12, x + .12, y + Hh, z + .12, 'post'); s.mat = 'legno'; }
    const [x, z] = U(cx, cz), y = aaaH(x, z); for (const b of [-1, 1]) { G.add(M.woodDark, ABX.box, x, y + Hh, z + b * D / 2, 0, 0, 0, W + .4, .22, .2); G.add(roofM, ABX.box, x, y + Hh + .55, z + b * D / 4, b * -.32, 0, 0, W + 1, .04, D / 2 + .7); }
    for (let i = 0; i < 18; i++) apHay(G, x - 3.6 + (i % 6) * 1.25, z - 1.6 + Math.floor(i / 6) * 1.2 % 3.6, 0, y + (i >= 12 ? .5 : 0)); const s = addSolid(x - 4.2, y, z - 2.2, x + 3.8, y + 1, z + 1.8, 'hay'); s.mat = 'terra'; V2.props += 20; V2.hayshed = { id: 'v2_tettoia', x, z };
  }
  G.build();
}
function v2Plough(G, x, z, ry) { const M = AAA.mats, y = aaaH(x, z), P = (a, h) => [x + Math.cos(ry) * a, y + h, z - Math.sin(ry) * a]; G.add(M.woodDark, ABX.box, ...P(0, .55), 0, ry, -.25, 2.4, .1, .1); G.add(M.rust, ABX.box, ...P(.9, .2), 0, ry, .6, .5, .05, .25); for (const s of [-1, 1]) G.add(M.woodDark, ABX.box, x + Math.sin(ry) * s * .25 + Math.cos(ry) * -1.1, y + .8, z + Math.cos(ry) * s * .25 - Math.sin(ry) * -1.1, 0, ry, .5, .9, .06, .06); V2.props++; }
// ---------------------------------------------------------------- D. zona militare
function v2MG42(G, x, y, z, ry) {   // MG 42 su bipiede: canna nel manicotto forato, castello, calcio, nastro
  const M = AAA.mats, P = (a, h) => [x + Math.sin(ry) * a, y + h, z + Math.cos(ry) * a];
  G.add(M.metal, ABX.cyl, ...P(.45, .12), PI / 2, ry, 0, .028, .62, .028, 0x2a2a28); G.add(M.metal, ABX.box, ...P(-.05, .13), 0, ry, 0, .07, .1, .42, 0x2a2a28);
  G.add(M.metal, ABX.box, ...P(-.38, .1), 0, ry, 0, .05, .12, .3, 0x1a1a18); G.add(M.metal, ABX.box, ...P(-.12, .05), 0, ry, 0, .03, .1, .05, 0x1a1a18);
  for (const s of [-1, 1]) G.add(M.metal, ABX.box, x + Math.sin(ry) * .55 + Math.cos(ry) * s * .08, y + .02, z + Math.cos(ry) * .55 - Math.sin(ry) * s * .08, 0, ry, s * .35, .015, .25, .015, 0x2a2a28);
  G.add(M.metal, ABX.box, x + Math.cos(ry) * .18, y + .06, z - Math.sin(ry) * .18, 0, ry + .3, .2, .3, .02, .06, 0x8a6a3a); V2.props++;
}
function v2Hedgehog(G, x, z, ry) { const M = AAA.mats, y = aaaH(x, z); for (const [a, b] of [[0, .9], [PI / 2, .9], [0, -.9]]) G.add(M.rust, ABX.box, x, y + .7, z, a === PI / 2 ? b : 0, ry + a, a === PI / 2 ? 0 : b, 2, .14, .14); const s = addSolid(x - .8, y, z - .8, x + .8, y + 1.3, z + .8, 'obstacle'); s.mat = 'acciaio'; V2.props++; }
function v2Wire(G, x0, z0, x1, z1) {   // filo spinato a fisarmonica su paletti
  const M = AAA.mats, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / .45)), ry = Math.atan2(-(z1 - z0), x1 - x0), coil = new THREE.TorusGeometry(.42, .008, 3, 10);
  for (let i = 0; i <= n; i++) { const k = i / n, x = lerp(x0, x1, k), z = lerp(z0, z1, k); G.add(M.rust, coil, x, aaaH(x, z) + .4, z, 0, ry + PI / 2 + (i % 2 ? .25 : -.25), 0); }
  for (let i = 0; i <= Math.round(L / 3); i++) { const k = i / Math.max(1, Math.round(L / 3)), x = lerp(x0, x1, k), z = lerp(z0, z1, k); G.add(M.rust, ABX.box, x, aaaH(x, z) + .5, z, 0, 0, 0, .04, 1, .04); }
  const s = addSolid(Math.min(x0, x1) - .4, aaaH(x0, z0), Math.min(z0, z1) - .4, Math.max(x0, x1) + .4, aaaH(x0, z0) + .85, Math.max(z0, z1) + .4, 'wire'); s.mat = 'filo'; V2.props++;
}
function v2SandRing(G, cx, cz, r, a0, a1, rows = 4) { const n = 6; for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; apSandbags(G, cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r, rows); } V2.props += 6; }
function v2Military() {
  const M = AAA.mats, G = new AGeo(), sr = seeded(808), U = v2W; V2.mil = [];
  // posto di blocco sul viottolo (asta bianca e rossa, garitta, sacchi a terra, cartello)
  { const v = -84, lu = avLaneU(v), [x, z] = U(lu, v), y = aaaH(x, z);
    for (const s of [-1, 1]) { G.add(M.woodDark, ABX.box, x + s * 3, y + .55, z, 0, 0, 0, .18, 1.1, .18); }
    for (let i = 0; i < 8; i++) G.add(M.vc, ABX.cyl, x - 2.6 + i * .74, y + 1.02, z, 0, 0, PI / 2, .05, .74, .05, i % 2 ? 0xb02a22 : 0xe8e4dc);
    const sx = x + 5, sz = z - 1.5, sy = aaaH(sx, sz); for (const [a, b, w, d] of [[0, -.6, 1.3, .06], [-.62, 0, .06, 1.3], [.62, 0, .06, 1.3]]) G.add(M.woodOld, ABX.box, sx + a, sy + 1.1, sz + b, 0, 0, 0, w, 2.2, d); G.add(M.roofTile, ABX.box, sx, sy + 2.3, sz, .15, 0, 0, 1.6, .06, 1.6, 0x4a4a3a); { const s = addSolid(sx - .65, sy, sz - .65, sx + .65, sy + 2.3, sz - .55, 'house'); s.mat = 'legno'; }
    apSandbags(G, x - 7, z + 1.5, x - 3.6, z + 1.5, 3); apSandbags(G, x + 3.6, z + 1.5, x + 7, z + 1.5, 3); apSign(G, x - 3.4, z + 2.2, 0, 'HALT ! KONTROLLE'); V2.props += 6;
    V2.mil.push({ id: 'posto_blocco', tipo: 'checkpoint', x, z });
  }
  // trincea: rivestimento di tavole e pali, graticcio sul fondo, parapetto di sacchi verso nord
  for (const tr of V2.trenches) for (let i = 0; i < tr.length - 1; i++) {
    const [ua, va] = tr[i], [ub, vb] = tr[i + 1], L = Math.hypot(ub - ua, vb - va), nx = -(vb - va) / L, nz = (ub - ua) / L, ry = Math.atan2(-(vb - va), ub - ua), nn = Math.ceil(L / 1.2);
    for (let k = 0; k <= nn; k++) { const t = k / nn, u = lerp(ua, ub, t), v = lerp(va, vb, t); for (const s of [-1, 1]) { const [x, z] = U(u + nx * s * .72, v + nz * s * .72), yb = aaaH(...U(u, v)); G.add(M.woodOld, ABX.box, x, yb + .7, z, 0, ry, 0, .1, 1.6, .1); } }
    for (const s of [-1, 1]) for (let h = 0; h < 4; h++) { const [x, z] = U((ua + ub) / 2 + nx * s * .7, (va + vb) / 2 + nz * s * .7), yb = aaaH(...U((ua + ub) / 2, (va + vb) / 2)); G.add(M.woodOld, ABX.box, x, yb + .2 + h * .34, z, (sr() - .5) * .02, ry, 0, L, .26, .04); }
    { const [x, z] = U((ua + ub) / 2, (va + vb) / 2), yb = aaaH(x, z); G.add(M.woodDark, ABX.box, x, yb + .04, z, 0, ry, 0, L, .05, .5); }
    const front = nz < 0 ? 1 : -1, [x0, z0] = U(ua + nx * front * 1.55, va + nz * front * 1.55), [x1, z1] = U(ub + nx * front * 1.55, vb + nz * front * 1.55); apSandbags(G, x0, z0, x1, z1, 2);
    for (let k = 0; k < nn; k += 2) { const t = (k + .5) / nn; addCover(...U(lerp(ua, ub, t), lerp(va, vb, t)), 'trench'); }
    V2.props += nn * 2 + 3;
  }
  // postazioni MG 42: anello di sacchi aperto a sud, arma sul parapetto rivolta a nord, casse di munizioni, bossoli
  for (const [u, v] of [[5.5, -117.5], [46, -117.8]]) { const [x, z] = U(u, v), y = aaaH(x, z); v2SandRing(G, x, z, 1.7, PI * .1 - PI, -PI * .1 + 0 - .0, 4); v2MG42(G, x, y + .85, z - 1.35, PI); for (let i = 0; i < 2; i++) G.add(M.paint, ABX.box, x + .8 + i * .2, y + .12, z + .5, 0, .3, 0, .28, .16, .12, 0x4a4e32); for (let i = 0; i < 12; i++) G.add(M.rust, ABX.cyl, x + (sr() - .5) * 1.2, y + .02, z - .5 + (sr() - .5) * .8, PI / 2, sr() * 6, 0, .006, .06, .006, 0xc8a050); addCover(x, z, 'mg'); V2.mil.push({ id: 'mg_' + u, tipo: 'MG42', x, z, dir: PI }); V2.props += 3; }
  // ricovero (Unterstand) di cemento interrato a metà: porta a sud, feritoia a nord, brande, tavolo, stufa, radio
  { const [cx, cz] = U(-14, -124), base = aaaH(cx, cz) + .02, W = 7, D = 6, t = .7, Hh = 2.5, con = aaaTri('plaster', .55, { nStr: 1.2, macro: .3, damp: 1.4, moss: .6, baseY: base, color: 0xa8a49a, key: 'concrete' });
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, wall = (a0, a1, c0, c1, y0, y1) => { G.add(con, ABX.box, (a0 + a1) / 2, (y0 + y1) / 2, (c0 + c1) / 2, 0, 0, 0, a1 - a0, y1 - y0, c1 - c0); const s = addSolid(a0, y0, c0, a1, y1, c1, 'bunker'); s.mat = 'cemento'; };
    wall(x0, x0 + t, z0, z1, base - .3, base + Hh); wall(x1 - t, x1, z0, z1, base - .3, base + Hh);
    wall(x0 + t, cx - .8, z0, z0 + t, base - .3, base + Hh); wall(cx + .8, x1 - t, z0, z0 + t, base - .3, base + Hh); wall(cx - .8, cx + .8, z0, z0 + t, base - .3, base + 1.15); wall(cx - .8, cx + .8, z0, z0 + t, base + 1.45, base + Hh);   // feritoia
    wall(x0 + t, cx - .55, z1 - t, z1, base - .3, base + Hh); wall(cx + .55, x1 - t, z1 - t, z1, base - .3, base + Hh); wall(cx - .55, cx + .55, z1 - t, z1, base + 2.05, base + Hh);   // porta
    wall(x0 - .2, x1 + .2, z0 - .2, z1 + .2, base + Hh, base + Hh + .6);
    G.add(M.terra, apLathe('mound', [[5.2, 0], [4.4, .5], [2.6, .9], [0, 1]], 14), cx, base + Hh + .55, cz, 0, 0, 0, 1, 1, .9);
    G.add(con, ABX.box, cx, base - .05, cz, 0, 0, 0, W - 2 * t, .1, D - 2 * t); FLOORS.push({ x0: x0 + t, x1: x1 - t, z0: z0 + t, z1: z1 - t, y: base + .01, v2: 'v2_ricovero' });
    const F = v2Furn(G, sr), y = base + .01; F.bed(x0 + t + .6, y, cz + .2, 0); G.add(M.woodDark, ABX.box, x0 + t + .6, y + 1.25, cz + .2, 0, 0, 0, 1, .06, 1.95); G.add(M.cloth, ABX.box, x0 + t + .6, y + 1.32, cz + .2, 0, 0, 0, .9, .1, 1.8, 0x5a5a4a);
    F.table(cx + 1, y, cz - .4, 0, 1.2, .7); F.bench(cx + 1, y, cz + .25, 0, 1.2); F.stove(x1 - t - .45, y, z1 - t - .45); G.add(M.metal, ABX.box, cx + 1.2, y + .86, cz - .5, 0, .2, 0, .4, .22, .26, 0x3a3e32); F.crate(x1 - t - .5, y, z0 + t + .45, .1);
    apSandbags(G, cx - 1.6, z1 + 1.6, cx - .8, z1 + .4, 3); apSandbags(G, cx + 1.6, z1 + 1.6, cx + .8, z1 + .4, 3);
    aaaRoom(x0 + t, base - .3, z0 + t, x1 - t, base + Hh, z1 - t); V2.bunker = { id: 'v2_ricovero', x: cx, z: cz }; V2.mil.push({ id: 'ricovero', tipo: 'Unterstand', x: cx, z: cz }); V2.props += 8;
  }
  // deposito munizioni sotto rete mimetica
  { const [cx, cz] = U(31, -96), y = aaaH(cx, cz); for (let i = 0; i < 12; i++) apCrate(G, cx - 2 + (i % 4) * .9, cz - .8 + Math.floor(i / 4 % 2) * .65, (sr() - .5) * .2, .8, .45, .55, true, y + (i >= 8 ? .45 : 0)); for (let i = 0; i < 4; i++) apJerry(G, cx + 2.3, cz - .9 + i * .3, .1);
    for (const [a, b] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) { const [x, z] = [cx + a, cz + b]; G.add(M.woodDark, ABX.box, x, aaaH(x, z) + 1.1, z, 0, 0, 0, .1, 2.2, .1); }
    const net = new THREE.PlaneGeometry(7, 5, 10, 8), p = net.attributes.position; for (let i = 0; i < p.count; i++) { const a = p.getX(i), b = p.getY(i); p.setZ(i, -(Math.cos(a / 3.5 * PI / 2) * Math.cos(b / 2.5 * PI / 2)) * -.3 + (sr() - .5) * .08); } net.computeVertexNormals(); G.add(M.cloth, net, cx, y + 2.15, cz, -PI / 2, 0, 0, 1, 1, 1, 0x4a5236);
    const s = addSolid(cx - 2.4, y, cz - 1.1, cx + 1.4, y + 1, cz + .6, 'crates'); s.mat = 'legno'; V2.props += 18; V2.mil.push({ id: 'deposito', tipo: 'munizioni', x: cx, z: cz });
  }
  // sbarramento all'ingresso est della strada principale: chicane di sacchi, cavalli di Frisia, filo spinato, cartello
  { const u = 74, rv = avRoadV(u); apSandbags(G, ...U(u, rv - 4.6), ...U(u, rv - 2.1), 3); apSandbags(G, ...U(u + 5, rv + 2.1), ...U(u + 5, rv + 4.6), 3);   // chicane: varco centrale di 3,6 m per i carri
    v2Hedgehog(G, ...U(u - 2, rv - 4.6), .3); v2Hedgehog(G, ...U(u + 7, rv + 4.6), 1.1); v2Hedgehog(G, ...U(u + 2.4, rv + 5.4), .7);
    v2Wire(G, ...U(u + 1, rv - 4.4), ...U(u + 1, rv - 11)); v2Wire(G, ...U(u + 4, rv + 4.4), ...U(u + 4, rv + 10)); apSign(G, ...U(u - 1.5, rv - 3.9), 0, 'ACHTUNG ! STRASSENSPERRE'); addCover(...U(u - .6, rv - 3.3), 'sandbag'); addCover(...U(u + 5.6, rv + 3.3), 'sandbag'); V2.props += 3;
    V2.mil.push({ id: 'sbarramento_est', tipo: 'barricade', x: AV.cx + u + 2.5, z: AV.cz + rv });
  }
  // campi minati (cartelli e filo) ai margini nord dei campi arati
  for (const u of [70, 96, 124]) { const [x, z] = U(u, -64.5); apSign(G, x, z, PI, 'ACHTUNG MINEN !'); } v2Wire(G, ...U(64, -66.5), ...U(88, -66.5)); V2.props += 3;
  G.build();
}
// ---------------------------------------------------------------- E. periferia: pali del telegrafo, cartelli, sentieri
function v2Periphery() {
  const M = AAA.mats, G = new AGeo(), U = v2W, poles = [];
  for (let u = -138; u <= 138; u += 34) { const v = avRoadV(u) - 4.6, [x, z] = U(u, v); if (V2.defs.some(d => Math.abs(d.u - u) < d.w / 2 + 1.5 && Math.abs(d.v - v) < d.d / 2 + 1.5) || v2PlazaD(u, v) < 1.5) continue;
    if (typeof XDZ_ROWS !== 'undefined' && XDZ_ROWS.some(R_ => R_.items.some(d => Math.abs(d.u - u) < d.w / 2 + 2 && Math.abs(d.v - v) < d.d / 2 + 2))) continue; /* case dell'Urban Expansion 3.0 */ const y = aaaH(x, z); G.add(M.bark, ABX.cyl, x, y + 3.6, z, 0, 0, 0, .11, 7.2, .11); G.add(M.woodDark, ABX.box, x, y + 6.9, z, 0, .02, 0, .1, .1, 1.3); for (const s of [-1, 1]) G.add(M.vc, ABX.cyl, x, y + 7.02, z + s * .55, 0, 0, 0, .04, .12, .04, 0x6a8a7a); poles.push([x, y + 7.02, z]); }
  for (let i = 0; i < poles.length - 1; i++) for (const s of [-1, 1]) { const a = poles[i], b = poles[i + 1], n = 6; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, sag = t => -1.1 * 4 * t * (1 - t); const p0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0) + sag(t0), lerp(a[2], b[2], t0) + s * .55], p1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1) + sag(t1), lerp(a[2], b[2], t1) + s * .55], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); G.add(M.metal, ABX.box, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, 0, -Math.atan2(p1[2] - p0[2], p1[0] - p0[0]), Math.asin((p1[1] - p0[1]) / L), L, .012, .012, 0x2a2a2a); } }
  V2.props += poles.length;
  apSign(G, ...U(92, 2), -.4, 'FERME DU MANOIR'); apSign(G, ...U(68, 9), .2, 'COLLEVILLE 5 KM'); V2.props += 2;
  { const Gf = G; apFence(Gf, [U(55, 64), U(55, 76), U(66, 76)], 51); apFirewood(Gf, ...U(64.6, 68), PI / 2, 2, 1); apCart(Gf, ...U(52, 70), 2.1); V2.props += 3; }
  G.build();
}
// ---------------------------------------------------------------- vegetazione delle nuove zone (le siepi sugli argini nuovi le genera aaaBocage)
function v2Vegetation() {
  const tOak = aaaTreeTemplate('oak', 7), tApple = aaaTreeTemplate('apple', 9), tBush = aaaTreeTemplate('bush', 13), sr = seeded(909), U = v2W, oaks = [], apples = [], bushes = [];
  for (const [u, v, s] of [[-121, -4.5, .8], [-95.5, 15, .75], [-121, 15.5, .8], [-104, -9.5, .7], [-131, -24, .65], [-98, -27, .95], [-136, 12, .9], [-72, 30, .85], [-90, 66, 1.1], [-38, 64, 1], [-112, 52, .95], [138, -50, 1.2], [92, -60, 1], [52, 88, 1.1], [80, -14, 1], [-70, -100, 1.15], [-44, -95, 1], [24, -128, 1.05], [-30, -130, 1.1]]) oaks.push([...U(u, v), s, sr() * 6]);
  for (let u = 80; u < 140; u += 11) oaks.push([...U(u, avRoadV(u) + 6.5 + (sr() - .5)), .8 + sr() * .3, sr() * 6]);   // filare lungo la strada a est
  for (let i = 0; i < 12; i++) apples.push([...U(108 + (i % 4) * 8 + (sr() - .5) * 2, 36 + Math.floor(i / 4) * 8 + (sr() - .5) * 2), .85 + sr() * .3, sr() * 6]);
  for (let i = 0; i < 40; i++) { const zone = [[-140, -100, -30, 20], [-112, -20, 26, 72], [96, 140, -50, -6], [-40, 60, -136, -86]][i % 4], u = zone[0] + sr() * (zone[1] - zone[0]), v = zone[2] + sr() * (zone[3] - zone[2]); if (V2.defs.some(d => Math.abs(d.u - u) < d.w / 2 + 2 && Math.abs(d.v - v) < d.d / 2 + 2) || v2RoadD(u, v) < 2 || v2PlazaD(u, v) < 2 || Math.abs(v - avRoadV(u)) < 4) continue; bushes.push([...U(u, v), .5 + sr() * .5, sr() * 6]); }
  const ok = (p) => !V2.defs.some(d => Math.abs(d.u + AV.cx - p[0]) < d.w / 2 + 2.5 && Math.abs(d.v + AV.cz - p[1]) < d.d / 2 + 2.5);
  aaaPlantInstances(tOak, oaks.filter(ok)); aaaPlantInstances(tApple, apples.filter(ok)); aaaPlantInstances(tBush, bushes.filter(ok));
  V2.trees = oaks.length + apples.length; V2.bushes = bushes.length;
  for (const p of oaks.concat(apples)) AAA.plants.push([p[0], p[1], 1.2]);
}
// ---------------------------------------------------------------- combattimento: punti di comparsa, percorsi, coperture (per un futuro Combat Lab)
function v2Combat() {
  const U = (u, v) => { const [x, z] = v2W(u, v); return { x: +x.toFixed(1), z: +z.toFixed(1) }; };
  // gli Alleati arrivano da est (strada di Colleville) e da sud-est (campi); i tedeschi difendono piazza, chiesa e trincee a nord
  V2.spawns = {
    us: [U(136, avRoadV(136)), U(134, avRoadV(134) + 3), U(104, 98), U(110, 92)],
    de: [U(-108, 6), U(-112, -9), U(-89, -12), U(-14, -118), U(30, -102)],
    sherman: [U(138, avRoadV(138)), U(100, 100)],
  };
  const road = (u0, u1, s = 8) => { const out = []; for (let u = u0; s > 0 ? u <= u1 : u >= u1; u += s) out.push(U(u, avRoadV(u) - (Math.abs(u - 2.5) < 9 ? 1.5 : 0))); return out; };   // accanto allo Sherman parcheggiato si passa sul lato nord
  V2.routes = {
    carri_strada_principale: road(138, -136, -8),                                                   // Sherman: tutta la strada principale (larga 5,4 m)
    carri_fattoria: V2.roads.find(r => r.id === 'fattoria').pts.map(p => U(...p)).reverse(),
    fanteria_campi: V2.roads.find(r => r.id === 'campi').pts.map(p => U(...p)).reverse().concat(road(70, 20, -10)),
    fanteria_residenziale: V2.roads.find(r => r.id === 'res').pts.map(p => U(...p)).reverse(),
    fanteria_chiesa: V2.roads.find(r => r.id === 'chiesa').pts.map(p => U(...p)),
    fiancheggiamento_vicolo: V2.roads.find(r => r.id === 'vicolo').pts.map(p => U(...p)),
    viottolo_nord: (() => { const o = []; for (let v = 0; v >= -136; v -= 8) o.push(U(avLaneU(v), v)); return o; })(),
  };
  // coperture lungo muri e angoli degli edifici del villaggio esteso (oltre a sacchi e trincee già registrati)
  for (const d of V2.defs) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const [x, z] = v2W(d.u + a * (d.w / 2 + .6), d.v + b * (d.d / 2 + .6)); addCover(x, z, 'corner'); }
  // punti di tiro sopraelevati (finestre ai piani alti degli edifici esplorabili, cella campanaria): contrastabili da almeno due direzioni
  V2.elevated = V2.built.filter(b => b.def && b.def.explore && b.def.storeys > 1).map(b => ({ id: b.def.id, x: b.def.x, z: b.def.z, y: +(b.base + b.def.sh + 1.2).toFixed(1) }));
}
// ---------------------------------------------------------------- settori (40 m): conteggi e caricamento progressivo futuro
function v2Sectors() {
  const S = 40, map = new Map(), key = (x, z) => Math.floor((x - AV.cx + 160) / S) + ',' + Math.floor((z - AV.cz + 160) / S);
  for (const b of V2.built) { const k = key(b.def.x, b.def.z); (map.get(k) || map.set(k, { k, edifici: [], props: 0 }).get(k)).edifici.push(b.def.id); }
  V2.sectors = [...map.values()]; V2.sectorSize = S;
}
// ---------------------------------------------------------------- dati per il futuro Destruction Test
// ogni edificio: parti strutturali (muri per facciata, tetto, solai), decorative (persiane, insegne, gronde), distruttibili
// (porte, finestre, comignoli), con riquadro, collider associati e connessioni; «danneggiato» è lo slot per la variante
function v2Destr(b, def) {
  const parts = [], bb = (x0, y0, z0, x1, y1, z1) => [+x0.toFixed(2), +y0.toFixed(2), +z0.toFixed(2), +x1.toFixed(2), +y1.toFixed(2), +z1.toFixed(2)];
  for (const k in b.faces) {
    const F = b.faces[k], i0 = F.out > 0 ? F.fixed - F.t : F.fixed, i1 = F.out > 0 ? F.fixed : F.fixed + F.t;
    const box = F.axis === 'x' ? bb(F.a0, F.y0, i0, F.a1, F.y1, i1) : bb(i0, F.y0, F.a0, i1, F.y1, F.a1);
    parts.push({ id: `${def.id}:muro${k}`, tipo: 'strutturale', materiale: def.wall, bbox: box, connessioni: [`${def.id}:tetto`].concat(['+x', '-x', '+z', '-z'].filter(q => q[1] !== k[1]).map(q => `${def.id}:muro${q}`)), stato: 'integro', danneggiato: null });
    for (const o of def.faces[k]) parts.push({ id: `${def.id}:${o.kind === 'door' ? 'porta' : 'finestra'}${k}@${o.c.toFixed(1)}`, tipo: 'distruttibile', bbox: null, su: `${def.id}:muro${k}`, stato: 'integro', danneggiato: null });
  }
  if (def.roof) parts.push({ id: `${def.id}:tetto`, tipo: 'strutturale', bbox: bb(def.x - def.w / 2, b.top, def.z - def.d / 2, def.x + def.w / 2, b.ro.yr || b.top + 3, def.z + def.d / 2), connessioni: Object.keys(b.faces).map(k => `${def.id}:muro${k}`), stato: def.ruinRoof ? 'danneggiato' : 'integro', danneggiato: null });
  for (const c of (def.roof && def.roof.chimneys) || []) parts.push({ id: `${def.id}:comignolo@${c[0]}`, tipo: 'distruttibile', su: `${def.id}:tetto`, stato: 'integro', danneggiato: null });
  if (def.storeys > 1) parts.push({ id: `${def.id}:solaio`, tipo: 'strutturale', connessioni: Object.keys(b.faces).map(k => `${def.id}:muro${k}`), stato: 'integro', danneggiato: null });
  parts.push({ id: `${def.id}:decorazioni`, tipo: 'decorativo', descr: 'persiane, gronde, insegne, cantonali', stato: 'integro', danneggiato: null });
  V2.destr.push({ id: def.id, zona: def.zone, mesh: b.grp ? b.grp.uuid : null, parti: parts });
}
// sostituzione futura: v2SetPart('v2_res3:muro+z', 'danneggiato', mesh) — oggi registra solo lo stato e lo slot
function v2SetPart(id, stato, mesh) { for (const e of V2.destr) for (const p of e.parti) if (p.id === id) { p.stato = stato; if (mesh) p.danneggiato = mesh; return p; } return null; }
// ---------------------------------------------------------------- LOD degli edifici: oltre una distanza un volume semplificato (muri, tetto) sostituisce i dettagli
function v2Prism(L, W, H) {   // prisma del tetto a due falde lungo x, base a y = 0
  const a = [-L / 2, 0, -W], b = [L / 2, 0, -W], c = [L / 2, 0, W], d = [-L / 2, 0, W], e = [-L / 2, H, 0], f = [L / 2, H, 0];
  const t = [a, e, f, a, f, b, d, c, f, d, f, e, a, d, e, b, f, c], g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.flat(), 3)); g.computeVertexNormals(); return g;
}
const V2_LOD_D = { LOW: 70, MEDIUM: 95, HIGH: 120, ULTRA: 150 };
function v2Lod(b, def) {
  if (!b.grp) return; const M = AAA.mats, top = b.top, rh = b.ro && b.ro.yr ? b.ro.yr - top : 3, along = def.along || (def.w >= def.d ? 'x' : 'z');
  const g = new AGeo(); g.add(def.wall === 'intonaco' ? M.plaster : def.wall === 'mattoni' ? M.brick : M.stoneDark, ABX.box, def.x, (b.base - .4 + top) / 2, def.z, 0, 0, 0, def.w, top - b.base + .4, def.d);
  if (def.roof) { const col = new THREE.Color(def.roof.cols[0]).multiplyScalar(.85).getHex(), L = (along === 'x' ? def.w : def.d) + .6, W = (along === 'x' ? def.d : def.w) / 2 + .4;
    if (def.roof.type === 'hip' && Math.abs(def.w - def.d) < .5) g.add(M.vc, new THREE.ConeGeometry(W * 1.41, rh, 4, 1).rotateY(PI / 4), def.x, top + rh / 2, def.z, 0, 0, 0, 1, 1, 1, col);
    else g.add(M.vc, v2Prism(L, W, rh), def.x, top, def.z, 0, along === 'x' ? 0 : PI / 2, 0, 1, 1, 1, col); }
  const lo = g.build(); lo.visible = false; V2.lods.push({ hi: b.grp, lo, x: def.x, z: def.z, r: Math.max(def.w, def.d) / 2, extra: [] }); V2.lodN++;
}
function v2LodTick() {
  const D = V2_LOD_D[AAA.preset] || 120, cp = camera.position, all = AAA.shadowDirty > 0 && false; let far = 0;
  for (const L of V2.lods) { const d = Math.hypot(L.x - cp.x, L.z - cp.z) - L.r, f = d > D && !V2.forceHi; L.hi.visible = !f; L.lo.visible = f; if (f) far++; }
  V2.farN = far;
}
// ---------------------------------------------------------------- aggiornamento: LOD, ombre che seguono la camera, stanze interne più vicine
function v2Tick(dt) {
  if (!V2.on || !V2.lods) return; V2.t = (V2.t || 0) - dt; if (V2.t > 0) return; V2.t = .25;
  v2LodTick(); aaaRoomTick && aaaRoomTick();
  // ombre statiche: il riquadro (±88 m) resta sul villaggio originale; nelle zone nuove si ricentra ogni 40 m
  if (AAA.fixedSun && sun.castShadow && !(typeof LAB !== 'undefined' && LAB.run)) { const c = camera.position, home = new V3(AV.cx + 5, 0, AV.cz - 5), ctr = AAA.shadowCtr || (AAA.shadowCtr = home.clone());
    // nel villaggio originale (±60 m) il riquadro resta quello storico: i confronti del Benchmark Lab non cambiano
    const core = Math.abs(c.x - home.x) < 60 && Math.abs(c.z - home.z) < 60, want = core ? home : c;
    if (Math.hypot(want.x - ctr.x, want.z - ctr.z) > (core ? .5 : 40)) { ctr.set(want.x, 0, want.z); const p = new V3(ctr.x, aaaH(ctr.x, ctr.z), ctr.z); sun.position.copy(p).addScaledVector(SUN_DIR, 250); sun.target.position.copy(p); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); AAA.shadowDirty = 2; V2.shadowMoves = (V2.shadowMoves || 0) + 1; } }
  if (V2.dbg && V2.dbg.on) v2DbgUi();
}
// ---------------------------------------------------------------- strumenti di debug della mappa (F4)
function v2DbgToggle(k, on) {
  const D = V2.dbg; on = on ?? !D.f[k]; D.f[k] = on;
  if (D.g[k]) { scene.remove(D.g[k]); D.g[k].traverse(o => o.geometry && o.geometry.dispose()); D.g[k] = null; }
  if (!on) return; const pts = [], col = [], c = new THREE.Color(), seg = (a, b, h) => { pts.push(...a, ...b); c.setHex(h); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
  const box = (x0, y0, z0, x1, y1, z1, h) => { const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]; for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) seg(P[a], P[b], h); };
  if (k === 'collisioni') for (const s of solids) if (s.on !== false) box(s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, s.walk ? 0x40ffe0 : /sandbag|wire|obstacle/.test(s.tag) ? 0xffa040 : s.tag === 'furniture' ? 0xa0a0ff : 0xff4040);
  if (k === 'settori') { const S = V2.sectorSize; for (let i = 0; i <= 8; i++) { const a = AV.cx - 160 + i * S, b = AV.cz - 160 + i * S; seg([a, 30, AV.cz - 160], [a, 30, AV.cz + 160], 0xffff40); seg([AV.cx - 160, 30, b], [AV.cx + 160, 30, b], 0xffff40); } }
  if (k === 'bbox') for (const b of V2.built) { const d = b.def; box(d.x - d.w / 2, b.base - .5, d.z - d.d / 2, d.x + d.w / 2, (b.ro && b.ro.yr) || b.top, d.z + d.d / 2, d.explore ? 0x40ff60 : 0xffffff); }
  if (k === 'spawn') for (const [side, list] of Object.entries(V2.spawns)) for (const p of list) { const y = aaaH(p.x, p.z), h = side === 'us' ? 0x4080ff : side === 'de' ? 0xff4040 : 0x40ff40; seg([p.x, y, p.z], [p.x, y + 6, p.z], h); box(p.x - .5, y, p.z - .5, p.x + .5, y + 1.8, p.z + .5, h); }
  if (k === 'percorsi') for (const [n, r] of Object.entries(V2.routes)) for (let i = 0; i < r.length - 1; i++) seg([r[i].x, aaaH(r[i].x, r[i].z) + .4, r[i].z], [r[i + 1].x, aaaH(r[i + 1].x, r[i + 1].z) + .4, r[i + 1].z], /carri/.test(n) ? 0x40ff40 : 0xffd040);
  if (k === 'lod') { V2.lodColor = true; for (const L of V2.lods) { const y = aaaH(L.x, L.z) + 14; box(L.x - .4, y, L.z - .4, L.x + .4, y + .8, L.z + .4, L.lo.visible ? 0xff4040 : 0x40ff40); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: k !== 'percorsi' && k !== 'spawn', transparent: true, opacity: .9 })); ls.frustumCulled = false; ls.renderOrder = 999; scene.add(ls); D.g[k] = ls;
}
function v2DbgOpen(on) {
  const D = V2.dbg || (V2.dbg = { on: false, f: {}, g: {}, el: null }); D.on = on ?? !D.on;
  if (!D.el) { D.el = document.createElement('div'); D.el.id = 'v2Panel'; D.el.style.cssText = 'position:fixed;left:12px;top:12px;width:300px;max-height:90vh;overflow:auto;background:rgba(14,16,14,.9);color:#e8e4d8;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #556;border-radius:6px;z-index:60'; D.el.addEventListener('click', e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; if (a === 'close') v2DbgOpen(false); else if (a === 'reset') v2Reset(); else if (a.startsWith('go:')) v2Goto(a.slice(3)); else if (a === 'hi') { V2.forceHi = !V2.forceHi; v2LodTick(); } else v2DbgToggle(a); v2DbgUi(); }); document.body.appendChild(D.el); }
  D.el.style.display = D.on ? 'block' : 'none'; if (D.on) v2DbgUi();
}
function v2DbgUi() {
  const D = V2.dbg; if (!D || !D.el || !D.on) return; const ri = renderer.info.render, B = (a, t, on) => `<button data-a="${a}" style="margin:2px;padding:3px 7px;background:${on ? '#4a6a4a' : '#333'};color:#eee;border:1px solid #666;border-radius:3px;cursor:pointer">${t}</button>`;
  const fps = typeof LAB !== 'undefined' && LAB.n ? (() => { const w = labWindow(2); return w.length ? (1000 / (w.reduce((a, b) => a + b, 0) / w.length)).toFixed(0) : 'n/d'; })() : 'n/d';
  D.el.innerHTML = `<b style="letter-spacing:.08em">NORMANDY VILLAGE 2.0 — DEBUG MAPPA</b> ${B('close', '×')}<br>
  Edifici: <b>${V2.stats.edifici + 5}</b> (nuovi ${V2.stats.edifici}, esplorabili ${V2.stats.esplorabili}) · props: <b>${V2.stats.props}</b><br>
  Solidi: ${solids.length} · coperture: ${covers.length} · solai/scale: ${FLOORS.length}<br>
  Draw call: <b>${ri.calls}</b> · triangoli: ${(ri.triangles / 1000).toFixed(0)}k · FPS: <b>${fps}</b><br>
  LOD: ${V2.lods.length} edifici, ${V2.farN || 0} semplificati (oltre ${V2_LOD_D[AAA.preset] || 120} m) · settori: ${V2.sectors.length}<br>
  ${['collisioni', 'settori', 'bbox', 'spawn', 'percorsi', 'lod'].map(k => B(k, k, D.f[k])).join('')} ${B('hi', 'forza LOD0', V2.forceHi)}<br>
  <span style="opacity:.75">Vai a:</span><br>${['piazza', 'chiesa', 'campanile', 'residenziale', 'fattoria', 'trincea', 'ricovero', 'sbarramento'].map(k => B('go:' + k, k)).join('')}<br>
  ${B('reset', 'Ripristina la tech demo')}`;
}
const V2_GOTO = { piazza: [-108, 9, PI / 2], chiesa: [-104.5, -12.5, PI], campanile: [-124.6, -15, PI], residenziale: [-80, 47, PI], fattoria: [102, -20.5, -PI / 2], trincea: [-8, -106, 0], ricovero: [-14, -117.5, 0], sbarramento: [80, avRoadV(80), -PI / 2] };
function v2Goto(k) { const g = V2_GOTO[k]; if (!g) return; const [x, z] = v2W(g[0], g[1]); P.pos.set(x, Math.max(Hf(x, z), worldFloor(x, z, Hf(x, z) + .3)) + .1, z); P.yaw = g[2] + PI; if (P.vel) P.vel.set(0, 0, 0); if (typeof XPC !== 'undefined' && XPC.vel) XPC.vel.set(0, 0, 0); showMsg('Debug mappa: ' + k, 1.5); }
// ripristino: ricarica la tech demo con lo stesso preset (stato iniziale garantito: mondo, controller, laboratori)
function v2Reset() { if (typeof labReload === 'function') labReload(AAA.preset, false); else location.reload(); }
// ---------------------------------------------------------------- validazione (usata dai test e dal pannello)
function v2Validate() {
  const R = { sovrapposizioni: [], suStrada: [], suArgine: [], sospesi: [], pendenza: [], porteBloccate: [], fuoriMappa: [] }, ds = V2.defs;
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) { const a = ds[i], b = ds[j]; if (Math.abs(a.u - b.u) < (a.w + b.w) / 2 - .05 && Math.abs(a.v - b.v) < (a.d + b.d) / 2 - .05 && !(a.kind === 'church' && b.kind === 'tower')) R.sovrapposizioni.push(a.id + '/' + b.id); }
  const old = Object.values(AAA.defs).map(d => ({ id: d.id, u: d.u, v: d.v, w: d.w, d: d.d })); if (AAA.st.pipe) old.push({ id: 'pipe', u: AAA.st.pipe.x - AV.cx, v: AAA.st.pipe.z - AV.cz, w: 13, d: 10 });
  for (const a of ds) for (const b of old) if (Math.abs(a.u - b.u) < (a.w + b.w) / 2 + 1 && Math.abs(a.v - b.v) < (a.d + b.d) / 2 + 1) R.sovrapposizioni.push(a.id + '/' + b.id);
  for (const d of ds) {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) { const u = d.u + a * d.w / 2, v = d.v + b * d.d / 2; if (Math.abs(v - avRoadV(u)) < 3) R.suStrada.push(d.id); if (v2RoadD(u, v) < 0) R.suStrada.push(d.id); if (avBankD(u, v) < 2.2) R.suArgine.push(d.id); if (Math.max(Math.abs(u), Math.abs(v)) > AV.half - 4) R.fuoriMappa.push(d.id); }
    const [x, z] = v2W(d.u, d.v), g = aaaH(x, z); if (d.base - g > .5 || d.base - g < -.05) R.sospesi.push(d.id + ' ' + (d.base - g).toFixed(2)); if (d.slope > 2.2) R.pendenza.push(d.id + ' ' + d.slope.toFixed(1));
    // porta aperta: davanti 1,5 m liberi da solidi alti (non si entra da una porta murata)
    for (const k in d.open) for (const o of d.open[k]) if (o[0] === 'door' && (d.explore || d.open0)) { const f = o[1], t = .55, c = k[1] === 'z' ? x - d.w / 2 + f * d.w : z - d.d / 2 + t + f * (d.d - 2 * t), out = k[0] === '+' ? 1 : -1; const px = k[1] === 'z' ? c : x + out * (d.w / 2 + 1.2), pz = k[1] === 'z' ? z + out * (d.d / 2 + 1.2) : c, py = aaaH(px, pz) + .9; if (solids.some(s => s.on !== false && !s.walk && px > s.min.x && px < s.max.x && pz > s.min.z && pz < s.max.z && py > s.min.y && py < s.max.y)) R.porteBloccate.push(d.id + k); }
  }
  for (const k in R) R[k] = [...new Set(R[k])];
  return R;
}
