"use strict";
// ============================================================
//  Modelli delle navi in dettaglio: scafo con prua slanciata e
//  svasata, cavallino, bagnasciuga e mimetica dell'epoca;
//  sovrastrutture, alberi, fumaioli, direttori del tiro, radar,
//  lance, gru, antiaeree e torri sagomate per ogni classe.
// ============================================================
const SHIP_PAL = {
  us: { hull: 0x3c4a5c, upper: 0x737b81, deck: 0x46525e, dark: 0x2c3238, metal: 0x6d757b },   // Measure 22: blu marina sotto, grigio nebbia sopra
  de: { hull: 0x8f969b, upper: 0x878d91, deck: 0x8a7a5e, dark: 0x3e4448, metal: 0x737a7f },   // grigio chiaro Kriegsmarine, ponte in teak
  x: { hull: 0x3e3a35, upper: 0x8c8274, deck: 0x6b5a46, dark: 0x2a2724, metal: 0x5f5850 },    // mercantile: scafo nero, sovrastrutture color legno
};
// scafo: sezioni lungo la nave con prua slanciata (lancio) e svasata, cavallino, poppa a specchio; colori per vertice
function hullGeo2(C) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, B = C.B, D = C.D, F = C.F, N = 44;
  const pt = C.type === 'pt', rake = pt ? L * .05 : L * .045, flare = pt ? .05 : .16;
  const hw = t => B / 2 * (t < .32 ? Math.pow(Math.max(t, .003) / .32, pt ? .45 : .62) : t > .84 ? 1 - ((t - .84) / .16) ** 2 * (pt ? .1 : .32) : 1);
  const sheer = t => F + (t < .3 ? (1 - t / .3) ** 2 * F * (pt ? .25 : .45) : 0) + (t > .9 ? (t - .9) / .1 * F * .08 : 0);
  // profilo di una sezione: [mezza larghezza, quota, colore]
  const sec = t => { const w = hw(t), fl = t < .3 ? 1 + flare * (1 - t / .3) : 1; return [[w * fl, sheer(t), 'hs'], [w * (1 + (fl - 1) * .5), F * .45, 'h'], [w, .5, 'h'], [w * .995, .5, 'b'], [w * .99, -.45, 'b'], [w * .985, -.45, 'r'], [w * .86, -D * .72, 'r'], [w * .35, -D * .97, 'r'], [0, -D, 'r']]; };
  const col = { h: new THREE.Color(pal.hull), hs: new THREE.Color(pal.hull).lerp(new THREE.Color(0xffffff), .06), b: new THREE.Color(0x15171a), r: new THREE.Color(0x5b2622), d: new THREE.Color(pal.deck) };
  for (const k in col) col[k].convertSRGBToLinear();
  const pos = [], cl = [], idx = [];
  const vtx = (x, y, z, c) => { pos.push(x, y, z); cl.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  // prua lanciata: più in alto è, più la sezione è spostata in avanti
  const zAt = (t, y) => -L / 2 + t * L - (t < .12 ? Math.max(0, y) / (F * 1.5) * rake * (1 - t / .12) : 0);
  for (const sd of [-1, 1]) {
    const rows = [];
    for (let k = 0; k <= N; k++) { const t = k / N; rows.push(sec(t).map(([w, y, c]) => vtx(sd * w, y, zAt(t, y), col[c]))); }
    for (let k = 0; k < N; k++) for (let s = 0; s < rows[k].length - 1; s++) { const a = rows[k][s], b = rows[k][s + 1], c2 = rows[k + 1][s], d = rows[k + 1][s + 1]; if (sd > 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2); }
  }
  // ponte di coperta
  const dk = []; for (let k = 0; k <= N; k++) { const t = k / N, s0 = sec(t)[0]; dk.push([vtx(-s0[0], s0[1], zAt(t, s0[1]), col.d), vtx(s0[0], s0[1], zAt(t, s0[1]), col.d)]); }
  for (let k = 0; k < N; k++) idx.push(dk[k][0], dk[k + 1][0], dk[k][1], dk[k][1], dk[k + 1][0], dk[k + 1][1]);
  // specchio di poppa
  const tl = sec(1), base = pos.length / 3; for (const [w, y, c] of tl) vtx(-w, y, L / 2, col[c]); for (const [w, y, c] of tl) vtx(w, y, L / 2, col[c]);
  const m = tl.length; for (let s = 0; s < m - 1; s++) idx.push(base + s, base + s + 1, base + m + s, base + s + 1, base + m + s + 1, base + m + s);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData = { hw, sheer, zAt };
  return g;
}

// ---------- pezzi riutilizzabili ----------
// fumaiolo: corpo ovale con fascia e cappello scuro
function shFunnel(mb, x, y, z, w, l, h, c, cap, rake = 0) {
  mb.add(U.cyl12, c, x, y + h / 2, z, rake, 0, 0, w / 2, h, l / 2);
  mb.add(U.cyl12, cap, x, y + h + .25 - Math.sin(rake) * 0, z + Math.sin(rake) * h / 2, rake, 0, 0, w / 2 * 1.04, .9, l / 2 * 1.04);
  mb.add(U.cyl12, 0x1b1d1f, x, y + h + .55, z + Math.sin(rake) * h / 2, rake, 0, 0, w / 2 * .82, .4, l / 2 * .82);
}
// albero a palo con pennone e radar
function shMast(mb, x, y, z, h, c, yard = 6, radar = 0) {
  mb.add(U.cyl, c, x, y + h / 2, z, 0, 0, 0, .28, h, .28);
  mb.add(U.cyl, c, x, y + h * .78, z, 0, 0, PI / 2, .1, yard, .1);
  if (radar) { mb.add(U.box, 0x2c3034, x, y + h + radar * .3, z, 0, 0, 0, radar, radar * .6, .2); mb.add(U.cyl, c, x, y + h + .2, z, 0, 0, 0, .12, .6, .12); }
}
// albero a tripode con coffa (corazzate americane)
function shTripod(mb, x, y, z, h, c, top) {
  const t = new V3(x, y + h, z);
  mb.between(new V3(x, y, z - 2.2), t, .45, c); mb.between(new V3(x - 2.4, y, z + 1.6), t, .38, c); mb.between(new V3(x + 2.4, y, z + 1.6), t, .38, c);
  mb.add(U.cyl12, top, x, y + h + 1.2, z, 0, 0, 0, 2.8, 2.6, 2.8); mb.add(U.cyl12, top, x, y + h + 3.4, z, 0, 0, 0, 2, 1.8, 2);
  mb.add(U.cyl, c, x, y + h + 7, z, 0, 0, 0, .18, 6, .18);
}
// direttore del tiro con telemetro
function shDirector(mb, x, y, z, s, c) { mb.add(U.box, c, x, y + s * .5, z, 0, 0, 0, s * 1.6, s, s * 1.4); mb.add(U.cyl, 0x2a2e31, x, y + s * .6, z, 0, 0, PI / 2, s * .16, s * 3.2, s * .16); mb.add(U.box, 0x2c3034, x, y + s * 1.25, z, 0, 0, 0, s * 1.3, s * .5, s * .3); }
// lancia di salvataggio sulle selle
function shBoat(mb, x, y, z, l, base) {
  mb.add(U.sph, 0xd9d4c4, x, y + .6, z, 0, 0, 0, l * .14, .6, l * .5); mb.add(U.box, 0x6a5a48, x, y + 1.05, z, 0, 0, 0, l * .2, .08, l * .82);
  for (const e of [-1, 1]) { mb.add(U.box, 0x3a3e40, x, y + .15, z + e * l * .3, 0, 0, 0, l * .26, .3, .25); if (base !== undefined && y - base > .4) mb.add(U.cyl, 0x4a4e52, x, (y + base) / 2, z + e * l * .3, 0, 0, 0, .12, y - base, .12); }
}
// impianto antiaereo: vasca con canne
function shAA(mb, x, y, z, c, n = 4) { mb.add(U.cyl12, c, x, y + .5, z, 0, 0, 0, 1.6, 1, 1.6); for (let i = 0; i < n; i++) mb.add(U.cyl, 0x25282a, x - .45 * (n - 1) / 2 + i * .45, y + 1.4, z - 1.2, PI / 2 - .5, 0, 0, .07, 2.4, .07); }
// tubi lanciasiluri: affusto girevole con i tubi affiancati
function shTubes(mb, x, y, z, n, c) { mb.add(U.cyl12, c, x, y + .35, z, 0, 0, 0, 1.4, .7, 1.4); for (let i = 0; i < n; i++) mb.add(U.cyl, 0x4a5056, x - .55 * (n - 1) / 2 + i * .55, y + 1.1, z, PI / 2, 0, 0, .27, 7.2, .27); }

// ---------- sovrastrutture per classe ----------
function shipSuper(mb, C, hg) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, B = C.B, u = pal.upper, dk = pal.dark, mt = pal.metal;
  const deckY = z => hg.sheer((z + L / 2) / L);
  // ancore e catene sul castello di prua
  if (C.type !== 'pt') for (const sd of [-1, 1]) { mb.add(U.box, 0x1d1f21, sd * (hg.hw(.06) + .1), deckY(-L * .44) - 1.5, -L * .44, 0, 0, sd * .3, .3, 1.6, 1.2); mb.add(U.cyl, 0x2a2c2e, sd * 1.2, deckY(-L * .4) + .15, -L * .4, PI / 2, 0, 0, .2, L * .08, .2); }
  if (C.type === 'cargo') {
    const F = C.F;
    mb.add(U.box, u, 0, F + 2, -L * .4, 0, 0, 0, B * .8, 4, L * .1);   // castello
    mb.add(U.box, u, 0, F + 3.5, L * .05, 0, 0, 0, B * .85, 7, L * .14);  // casseretto centrale
    mb.add(U.box, u, 0, F + 8.2, L * .02, 0, 0, 0, B * .7, 2.4, L * .08); mb.add(U.box, 0x2a3a48, 0, F + 8.4, L * .02 - L * .041, 0, 0, 0, B * .66, .9, .1);
    shFunnel(mb, 0, F + 7, L * .1, 3.4, 4.6, 7.5, 0x262320, 0x1a1816);
    mb.add(U.box, u, 0, F + 2.5, L * .43, 0, 0, 0, B * .8, 5, L * .09);  // cassero di poppa
    for (const z of [-L * .27, -L * .14, L * .22, L * .33]) { mb.add(U.box, 0x4f463c, 0, F + .7, z, 0, 0, 0, B * .55, 1.4, L * .075); }
    for (const z of [-L * .205, L * .275]) { mb.add(U.cyl, mt, 0, F + 7, z, 0, 0, 0, .35, 14, .35); for (const sd of [-1, 1]) mb.between(new V3(0, F + 1.5, z), new V3(sd * 3, F + 11, z - 7), .15, mt); }
    for (const sd of [-1, 1]) shBoat(mb, sd * B * .2, F + 7, L * .06, 7, F);
    return;
  }
  if (C.type === 'pt') {
    const F = C.F, wood = C.nat === 'us' ? 0x5d6b5a : 0x8a9096;
    mb.add(U.box, wood, 0, F + .8, -L * .08, 0, 0, 0, B * .42, 1.6, L * .18); mb.add(U.box, 0x2b3a46, 0, F + 1.35, -L * .16, -.4, 0, 0, B * .38, .5, .1);
    mb.add(U.cyl, 0x3a3f42, 0, F + 3.2, -L * .05, 0, 0, 0, .09, 3.6, .09); mb.add(U.box, 0x2c3034, 0, F + 5, -L * .05, 0, 0, 0, .8, .4, .1);
    for (const sd of [-1, 1]) mb.add(U.cyl12, 0x4a4e52, sd * 1.8, F + .55, -3, 0, 0, 0, .8, .5, .8);
    // tubi lanciasiluri (PT: lungo i fianchi; S-boot: a prua nello scafo)
    if (C.nat === 'us') for (const sd of [-1, 1]) for (const z of [2, 7]) { mb.add(U.cyl, 0x4a5056, sd * (B / 2 - .4), F + .5, z, PI / 2, 0, 0, .3, 6.5, .3); }
    else for (const sd of [-1, 1]) mb.add(U.cyl, 0x4a5056, sd * 1.3, F + .1, -L * .3, PI / 2, 0, 0, .33, 7, .33);
    return;
  }
  const F = deckY(0), big = C.type === 'bb' || C.type === 'cl', de = C.nat === 'de';
  if (C.type === 'dd') {
    // cacciatorpediniere: plancia a due livelli col direttore, due fumaioli, albero col radar, tubi, bombe di profondità
    const zb = -L * .17;
    mb.add(U.box, u, 0, F + 2.4, zb, 0, 0, 0, B * .62, 4.8, L * .13);
    mb.add(U.box, u, 0, F + 5.8, zb - L * .02, 0, 0, 0, B * .5, 2, L * .08); mb.add(U.box, 0x223040, 0, F + 6, zb - L * .06, 0, 0, 0, B * .48, .7, .1);
    shDirector(mb, 0, F + 7, zb + L * .01, 1.7, u);
    shMast(mb, 0, F + 7, zb + L * .055, 13, mt, 8, 2.6);
    shFunnel(mb, 0, F, -L * .03, B * .26, B * .34, de ? 7 : 8.5, u, dk, de ? 0 : -.12);
    shFunnel(mb, 0, F, L * .1, B * .26, B * .34, de ? 7 : 8, u, dk, de ? 0 : -.12);
    mb.add(U.box, u, 0, F + 1.6, L * .2, 0, 0, 0, B * .45, 3.2, L * .1);   // tuga di poppa
    shDirector(mb, 0, F + 3.2, L * .2, 1.2, u);
    shTubes(mb, 0, F, L * .035, de ? 4 : 5, mt); shTubes(mb, 0, F, L * .155, de ? 4 : 5, mt);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .2, F + 2, -L * .07, 6, F); mb.add(U.box, 0x2a2e30, sd * B * .3, F + .6, L * .46, 0, 0, 0, .9, 1.2, 4); }
    for (const sd of [-1, 1]) shAA(mb, sd * B * .33, F, L * .09, u, 2);
    return;
  }
  if (C.type === 'cl') {
    // incrociatore: torre di plancia alta con direttori e radar, fumaioli, albero di poppa, gru e catapulte a poppa
    const zb = -L * .19;
    mb.add(U.box, u, 0, F + 3.5, zb, 0, 0, 0, B * .55, 7, L * .11);
    mb.add(U.box, u, 0, F + 9, zb - L * .01, 0, 0, 0, B * .45, 4, L * .08); mb.add(U.box, 0x223040, 0, F + 9.6, zb - L * .05, 0, 0, 0, B * .43, .9, .1);
    mb.add(U.box, u, 0, F + 12.5, zb, 0, 0, 0, B * .3, 3, L * .05);
    shDirector(mb, 0, F + 14, zb, 2.4, u); shMast(mb, 0, F + 14, zb + L * .045, 18, mt, 10, 4);
    if (de) shFunnel(mb, 0, F, -L * .04, B * .28, B * .4, 10, u, dk);
    else { shFunnel(mb, 0, F, -L * .07, B * .24, B * .3, 11, u, dk); shFunnel(mb, 0, F, L * .02, B * .24, B * .3, 11, u, dk); }
    mb.add(U.box, u, 0, F + 3, L * .12, 0, 0, 0, B * .48, 6, L * .1); shDirector(mb, 0, F + 6, L * .12, 2, u); shMast(mb, 0, F + 6, L * .16, 12, mt, 7, 2.5);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .2, F + 6, -L * .02, 8, F); shBoat(mb, sd * B * .2, F + 6, L * .04, 8, F); shAA(mb, sd * B * .36, F + 6, -L * .12, u); shAA(mb, sd * B * .38, F, L * .08, u); }
    mb.add(U.cyl, mt, 0, F + 1, L * .43, 0, 0, 0, .5, 2, .5); mb.between(new V3(0, F + 2, L * .43), new V3(B * .35, F + 8, L * .4), .25, mt);   // gru per gli idrovolanti
    for (const sd of [-1, 1]) mb.add(U.box, 0x55595c, sd * B * .25, F + 1, L * .37, 0, sd * .5, 0, 1.2, .6, 14);   // catapulte
    return;
  }
  // corazzate
  if (de) {
    // Scharnhorst: torre di comando con grande telemetro, fumaiolo unico col cappello, albero a palo, hangar e catapulta
    const zb = -L * .17;
    mb.add(U.box, u, 0, F + 4, zb, 0, 0, 0, B * .45, 8, L * .1);
    mb.add(U.cyl12, u, 0, F + 13, zb, 0, 0, 0, 3.6, 12, 3.6);
    mb.add(U.box, u, 0, F + 19.5, zb, 0, 0, 0, 5.5, 3, 5); mb.add(U.cyl, 0x2a2e31, 0, F + 21.5, zb, 0, 0, PI / 2, .6, 12, .6); mb.add(U.box, 0x2c3034, 0, F + 23, zb, 0, 0, 0, 4.5, 1.5, 4);
    mb.add(U.box, u, 0, F + 3, -L * .06, 0, 0, 0, B * .55, 6, L * .1);
    shFunnel(mb, 0, F + 5, -L * .03, B * .26, B * .38, 12, u, dk, -.05);
    shMast(mb, 0, F + 6, L * .03, 22, mt, 12, 3.5);
    mb.add(U.box, u, 0, F + 3, L * .1, 0, 0, 0, B * .5, 6, L * .1); shDirector(mb, 0, F + 6, L * .14, 2.6, u);
    mb.add(U.box, 0x55595c, 0, F + 6.5, L * .1, 0, 0, 0, 2, .6, 16);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .2, F + 6, -L * .05, 9, F); shBoat(mb, sd * B * .2, F + 6, L * .02, 9, F); shAA(mb, sd * B * .36, F + 6, L * .07, u); }
    return;
  }
  // USS Texas: due alberi a tripode con coffa, torre corazzata, fumaiolo unico, ponti delle lance, casematte, antiaeree
  const zb = -L * .2;
  mb.add(U.cyl12, u, 0, F + 3, zb + 4, 0, 0, 0, 4, 6, 4);
  mb.add(U.box, u, 0, F + 4, zb, 0, 0, 0, B * .45, 8, L * .08); mb.add(U.box, u, 0, F + 9.5, zb - 1, 0, 0, 0, B * .35, 3, L * .05); mb.add(U.box, 0x223040, 0, F + 10, zb - L * .025 - 1, 0, 0, 0, B * .33, .8, .1);
  shTripod(mb, 0, F + 11, zb + 3, 18, u, u); shDirector(mb, 0, F + 34, zb + 3, 2.2, u);
  shFunnel(mb, 0, F + 2, -L * .02, B * .26, B * .34, 13, u, dk);
  mb.add(U.box, u, 0, F + 2.5, L * .06, 0, 0, 0, B * .62, 5, L * .14);
  shTripod(mb, 0, F + 5, L * .14, 14, u, u); shDirector(mb, 0, F + 24, L * .14, 1.8, u);
  for (const sd of [-1, 1]) { for (const z of [-L * .02, L * .04, L * .1]) shBoat(mb, sd * B * .2, F + 5, z, 9, F); shAA(mb, sd * B * .38, F + 5, -L * .12, u); shAA(mb, sd * B * .4, F, L * .2, u); }
  mb.add(U.cyl, mt, 0, F + 1, L * .03, 0, 0, 0, .6, 3, .6); mb.between(new V3(0, F + 3, L * .03), new V3(-B * .3, F + 12, L * .05), .3, mt);   // gru delle lance
}
// torre: barbetta, casa con fronte inclinata, telemetro a orecchie (grossi calibri) o impianto chiuso (127 mm)
function shTurret(tm, S, sz, c, nat, drop = 0) {
  if (drop > 1) tm.add(U.cyl12, c, 0, -drop / 2, .4 * sz, 0, 0, 0, (S.cal >= 140 ? 4.3 : S.cal >= 100 ? 2 : .8) * Math.max(sz, .5), drop, (S.cal >= 140 ? 4.3 : S.cal >= 100 ? 2 : .8) * Math.max(sz, .5));
  if (S.cal >= 140) {
    tm.add(U.cyl12, c, 0, -1.4 * sz, .4 * sz, 0, 0, 0, 4.6 * sz, 2.4 * sz, 4.6 * sz);
    tm.add(U.box, c, 0, .35 * sz, .9 * sz, 0, 0, 0, 7.4 * sz, 3 * sz, 7.2 * sz);
    tm.add(U.box, c, 0, .1 * sz, -3 * sz, -.45, 0, 0, 7 * sz, 2.4 * sz, 1.4 * sz);   // fronte inclinata
    tm.add(U.box, c, 0, 1.95 * sz, .7 * sz, 0, 0, 0, 6.8 * sz, .3 * sz, 6.8 * sz);
    if (S.cal >= 200) { tm.add(U.cyl, c, 0, 1.2 * sz, 2.8 * sz, 0, 0, PI / 2, .55 * sz, 10.5 * sz, .55 * sz); for (const sd of [-1, 1]) tm.add(U.cyl12, c, sd * 5.2 * sz, 1.2 * sz, 2.8 * sz, 0, 0, PI / 2, .75 * sz, .9 * sz, .75 * sz); }
    tm.add(U.box, 0x2a2e31, 0, 1.3 * sz, 4 * sz, 0, 0, 0, 1.4 * sz, .5 * sz, .6 * sz);
  } else if (S.cal >= 100) {
    // impianto chiuso da 127 mm (scudo a scatola con fronte smussata)
    tm.add(U.cyl12, c, 0, -.6, 0, 0, 0, 0, 2.2, 1, 2.2);
    tm.add(U.box, c, 0, .7, .5, 0, 0, 0, 3.6, 2.6, 5.2); tm.add(U.box, c, 0, .6, -2.3, -.5, 0, 0, 3.5, 2, 1.2);
    tm.add(U.box, 0x2a2e31, 1.2, 2.1, 1, 0, 0, 0, .7, .4, .7);
  } else if (S.cal >= 30) { tm.add(U.cyl12, 0x3e4245, 0, -.3, 0, 0, 0, 0, 1.3, .6, 1.3); tm.add(U.box, c, 0, .3, -.4, 0, 0, 0, 2, 1.2, .2); }
  else tm.add(U.cyl12, 0x3e4245, 0, -.4, 0, 0, 0, 0, .6, .8, .6);
}
function buildShipModel2(C) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const hg = hullGeo2(C); body.add(new THREE.Mesh(hg, MAT.vcMetal || MAT.vc));
  const mb = new MB(); shipSuper(mb, C, hg.userData);
  if (mb.parts.length) body.add(groupMesh(mb.buildGroups(), true));
  // ringhiere lungo il bordo del ponte
  const rp = [], L = C.L;
  for (const sd of [-1, 1]) for (let k = 0; k < 40; k++) { const t0 = k / 40, t1 = (k + 1) / 40, y0 = hg.userData.sheer(t0) + .9, y1 = hg.userData.sheer(t1) + .9; rp.push(sd * hg.userData.hw(t0) * .98, y0, hg.userData.zAt(t0, y0), sd * hg.userData.hw(t1) * .98, y1, hg.userData.zAt(t1, y1)); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  body.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: new THREE.Color(pal.metal).convertSRGBToLinear(), transparent: true, opacity: .6 })));
  const turrets = [];
  for (const G of C.guns) for (const [x, y, z, arc, n] of G.mounts) {
    const S = SHELL[G.s], tg = new THREE.Group(), deckY = hg.userData.sheer((z + L / 2) / L);
    tg.position.set(x, Math.max(y, deckY + (S.cal >= 140 ? 2 : 1.2)), z); body.add(tg);
    const sz = S.cal >= 300 ? 1 : S.cal >= 200 ? .9 : S.cal >= 140 ? .72 : .5, tm = new MB();
    shTurret(tm, S, sz, pal.upper, C.nat, Math.abs(x) < C.B * .3 ? tg.position.y - deckY + .3 : 0);
    tg.add(groupMesh(tm.buildGroups(), true));
    const pv = new THREE.Group(); pv.position.set(0, S.cal >= 140 ? .4 * sz : S.cal >= 100 ? .6 : .2, S.cal >= 140 ? -2.8 * sz : S.cal >= 100 ? -2.2 : 0); tg.add(pv);
    const bl = new MB(), len = S.cal >= 100 ? S.cal / 1000 * (S.cal >= 300 ? 45 : 40) : S.cal > 15 ? 2.4 : 1.5, muzzles = [], rad = Math.max(.05, S.cal / 2000 * 1.5);
    for (let i = 0; i < n; i++) {
      const xo = (i - (n - 1) / 2) * Math.max(.3, S.cal / 1000 * (S.cal >= 140 ? 5.2 : 3.5));
      bl.add(U.cyl, 0x2b2e30, xo, 0, -len / 2, PI / 2, 0, 0, rad, len, rad);
      bl.add(U.cyl, 0x2b2e30, xo, 0, -len + .25, PI / 2, 0, 0, rad * 1.25, .5, rad * 1.25);   // volata
      if (S.cal >= 140) bl.add(U.cyl, 0x8e8b80, xo, 0, -.4, PI / 2, 0, 0, rad * 1.9, 1.2, rad * 1.9);   // cuffia di tela
      muzzles.push(new V3(xo, 0, -len));
    }
    pv.add(groupMesh(bl.buildGroups(), false));
    turrets.push({ sec: !!G.sec, G, S, key: G.s, g: tg, pv, muzzles, arc, x, y: tg.position.y, z, rel: arc === 'aft' ? PI : arc === 'port' ? PI / 2 : arc === 'stbd' ? -PI / 2 : 0, el: 0, reload: rnd(0, G.reload), ok: true, fixT: 0, T: firingTable(G.s, G.elev) });
  }
  return { g, body, turrets };
}
