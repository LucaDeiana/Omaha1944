"use strict";
// ============================================================
//  Colleville-sur-Mer (interpretazione di gioco): la via del villaggio dietro Omaha Beach con le due file di case
//  sugli STESSI lotti della versione precedente (coperture, missioni e IA non cambiano posizione), ma edifici della
//  libreria Architettura 4.0: pietra, intonaco, graticcio, mattoni; fattoria con fienile e cortile murato; due case
//  strategiche con interni (piano terra, scala, primo piano). Tutto deterministico (ID stabili «colleville_*»).
//  Documentato: Colleville era un piccolo borgo agricolo in pietra calcarea con chiesa (bombardata il 6 giugno).
//  Interpretazione: tipologie, colori e disposizione delle singole case. Adattamento: lotti allineati alla strada di gioco.
// ============================================================
function buildColleville() {
  const R_ = archRng('colleville'), t0 = performance.now();
  // lotti originali: [x, larghezza, rovina]; fila nord affacciata a sud (z=-268, strada a -z), fila sud affacciata a nord
  const north = [[-79, 11, 0], [-63, 12, 1], [-48, 9, 0], [-17, 10, 0], [-2, 11, 1], [36, 12, 0], [52, 11, 0], [70, 11, 1]];
  const south = [[-79, 11, 0], [-62, 12, 0], [-45, 10, 1], [-16, 11, 0], [35, 10, 1], [51, 12, 0], [68, 11, 0]];
  const KINDS = ['pietra', 'pietra', 'pietra', 'intonaco', 'intonaco', 'colombage', 'mattoni'];
  const rows = [[north, -268, '-z', 8], [south, -295, '+z', 8.5]];
  const out = [];
  rows.forEach(([list, z0, street, d], ri) => list.forEach(([x, w, ruin], i) => {
    const id = `colleville_${ri ? 's' : 'n'}${i}`, r = archRng(id), strategic = (ri === 0 && x === -17) || (ri === 1 && x === -16);
    const kind = strategic ? (ri ? 'intonaco' : 'pietra') : r.pick(KINDS), storeys = strategic || w >= 11 ? 2 : r.chance(.5) ? 2 : 1;
    const dd = d + r.r(-.6, .8), back = r.r(0, 1.4) * (street === '-z' ? 1 : -1);   // arretramento irregolare dalla strada
    const use = kind === 'mattoni' && !strategic ? 'officina' : 'casa';
    out.push(archHouse(id, { x, z: z0 + back, w: w - .4, d: dd, storeys, kind, use, street, interior: strategic, ruin: ruin ? .42 : 0, roof: strategic ? 'gable' : undefined }));
  }));
  // fattoria a nord-est: fienile dietro la fila, cortile murato con cancello verso la strada laterale
  out.push(archHouse('colleville_fienile', { x: 58, z: -252, w: 12, d: 7, storeys: 1, kind: 'pietra', use: 'fienile', street: '-x', ridge: 'x', roof: 'gable' }));
  archYardWall('colleville_cortile', [[44, -262], [44, -246], [66, -246], [66, -258]], 1.3, 1);
  // muretti lungo i giardini dietro le case della fila sud (coperture basse, distruttibili)
  archYardWall('colleville_orti', [[-86, -306], [-55, -306]], 1.1);
  archYardWall('colleville_orti2', [[28, -306], [58, -306]], 1.1, 0);
  WORLD.colleville = { houses: out.map(o => o.id), ms: performance.now() - t0 };
  return out;
}
