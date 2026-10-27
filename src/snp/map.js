"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — mappa 1: «Saint-Lô», città bombardata.
//  Due palazzi affacciati su una strada distrutta: l'Hotel (Alleati)
//  e le Poste (Asse), 3 piani più il tetto, separati da 75 m di
//  macerie che nessuno può attraversare.
//  Tutto è generato con un numero fisso: la mappa è identica su ogni PC.
// ============================================================
const SNP = {
  on: false, C: new V3(0, 0, -150), G: 2, FH: 3.6, GAP: 75, W: 48, D: 22, YARD: 10,
  floors: [], posts: [], nav: { A: [], E: [] }, spawns: { A: [], E: [] }, rooms: []
};
SNP.FRONT = { A: SNP.C.z + SNP.GAP / 2, E: SNP.C.z - SNP.GAP / 2 };
const SNP_RNG = seeded(4471), srand = (a, b) => a + SNP_RNG() * (b - a), spick = a => a[(SNP_RNG() * a.length) | 0];

// ---------- coordinate locali del palazzo: u laterale, v profondità dalla facciata verso l'interno ----------
// Alleati: x = u, z = fronte + v. Asse: ruotato di 180° (x = −u, z = fronte − v).
function snpW(team, u, v, out = new V3()) { return team === 'A' ? out.set(u, 0, SNP.FRONT.A + v) : out.set(-u, 0, SNP.FRONT.E - v); }
function snpL(team, x, z) { return team === 'A' ? { u: x, v: z - SNP.FRONT.A } : { u: -x, v: SNP.FRONT.E - z }; }
function snpBoxW(team, u0, u1, v0, v1) {
  const a = snpW(team, u0, v0), b = snpW(team, u1, v1);
  return [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)];
}
// scatola in coordinate locali: mesh e, se richiesto, solido per collisioni e proiettili
function snpBox(mb, team, u0, u1, v0, v1, y0, y1, c, solid = true, tag = 'house') {
  const [x0, x1, z0, z1] = snpBoxW(team, u0, u1, v0, v1), G = SNP.G;
  mb.add(U.box, c, (x0 + x1) / 2, G + (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, x1 - x0, y1 - y0, z1 - z0);
  return solid ? addSolid(x0, G + y0, z0, x1, G + y1, z1, tag) : null;
}
// pavimento calpestabile (solaio): solido che non blocca chi ci sta sopra
function snpSlab(mb, team, u0, u1, v0, v1, y, c, cc) {
  const [x0, x1, z0, z1] = snpBoxW(team, u0, u1, v0, v1), G = SNP.G;
  mb.mat = 'wood'; mb.add(U.box, c, (x0 + x1) / 2, G + y - .03, (z0 + z1) / 2, 0, 0, 0, x1 - x0, .06, z1 - z0);
  if (y > .1) { mb.mat = 'plaster'; mb.add(U.box, cc, (x0 + x1) / 2, G + y - .2, (z0 + z1) / 2, 0, 0, 0, x1 - x0, .28, z1 - z0); const s = addSolid(x0, G + y - .32, z0, x1, G + y, z1, 'floor'); s.walk = true; }
  SNP.floors.push({ x0, x1, z0, z1, y: G + y });
}
// rettangolo meno i fori: celle della griglia formata dai bordi, fuse per righe
function rectMinus(r, holes) {
  const us = [...new Set([r[0], r[1], ...holes.flatMap(h => [h[0], h[1]])])].filter(u => u >= r[0] && u <= r[1]).sort((a, b) => a - b);
  const vs = [...new Set([r[2], r[3], ...holes.flatMap(h => [h[2], h[3]])])].filter(v => v >= r[2] && v <= r[3]).sort((a, b) => a - b);
  const out = [];
  for (let j = 0; j < vs.length - 1; j++) {
    let run = null;
    for (let i = 0; i < us.length - 1; i++) {
      const cu = (us[i] + us[i + 1]) / 2, cv = (vs[j] + vs[j + 1]) / 2, inH = holes.some(h => cu > h[0] && cu < h[1] && cv > h[2] && cv < h[3]);
      if (!inH) { if (run) run[1] = us[i + 1]; else run = [us[i], us[i + 1], vs[j], vs[j + 1]]; }
      else if (run) { out.push(run); run = null; }
    }
    if (run) out.push(run);
  }
  return out;
}
// muro lungo u (facciata o tramezzo) con aperture {a, b, lo, hi} in metri dal pavimento
function snpWallU(mb, team, v0, v1, u0, u1, y0, h, ops, c) {
  ops = ops.filter(o => o.b > u0 && o.a < u1).sort((p, q) => p.a - q.a);
  let u = u0;
  for (const o of ops) {
    if (o.a > u + .01) snpBox(mb, team, u, o.a, v0, v1, y0, y0 + h, c);
    if (o.lo > .01) snpBox(mb, team, o.a, o.b, v0, v1, y0, y0 + o.lo, c);
    if (o.hi < h - .01) snpBox(mb, team, o.a, o.b, v0, v1, y0 + o.hi, y0 + h, c);
    u = o.b;
  }
  if (u < u1 - .01) snpBox(mb, team, u, u1, v0, v1, y0, y0 + h, c);
}
function snpWallV(mb, team, u0, u1, v0, v1, y0, h, ops, c) {
  ops = ops.filter(o => o.b > v0 && o.a < v1).sort((p, q) => p.a - q.a);
  let v = v0;
  for (const o of ops) {
    if (o.a > v + .01) snpBox(mb, team, u0, u1, v, o.a, y0, y0 + h, c);
    if (o.lo > .01) snpBox(mb, team, u0, u1, o.a, o.b, y0, y0 + o.lo, c);
    if (o.hi < h - .01) snpBox(mb, team, u0, u1, o.a, o.b, y0 + o.hi, y0 + h, c);
    v = o.b;
  }
  if (v < v1 - .01) snpBox(mb, team, u0, u1, v, v1, y0, y0 + h, c);
}
// mattoni sbrecciati attorno a un'apertura e macerie sul pavimento (solo grafica, più un cumulo basso solido)
function snpBreachDeco(mb, team, o, y0, inward) {
  mb.mat = 'brick';
  for (let i = 0; i < 14; i++) {
    const side = SNP_RNG() < .5, u = side ? (SNP_RNG() < .5 ? o.a : o.b) + srand(-.25, .25) : srand(o.a, o.b), y = side ? srand(o.lo, o.hi) : (SNP_RNG() < .5 ? o.lo : o.hi) + srand(-.2, .2);
    const p = snpW(team, u, .2); mb.add(U.box, spick([0x8a4a36, 0x7a4030, 0x9c6a52]), p.x, SNP.G + y0 + y, p.z, srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.2, .45), srand(.1, .2), srand(.2, .4));
  }
  for (let i = 0; i < 10; i++) { const p = snpW(team, srand(o.a - .6, o.b + .6), inward ? srand(.6, 2) : srand(-2.5, -.5)); mb.add(U.box, spick([0x7d6a5a, 0x8a7766, 0x6a5a4c]), p.x, SNP.G + y0 + srand(.05, .25), p.z, srand(-.5, .5), srand(0, 3), srand(-.5, .5), srand(.25, .7), srand(.15, .35), srand(.25, .6)); }
}
// cumulo di macerie o mobile ribaltato: riparo basso solido
function snpCover(mb, team, u, v, y0, w, d, h, kind) {
  const c = kind === 'wood' ? 0x5a4030 : kind === 'sack' ? 0xb0a080 : 0x857262;
  mb.mat = kind === 'wood' ? 'wood' : kind === 'sack' ? 'sack' : 'brick';
  if (kind === 'sack') { for (let r = 0; r < Math.round(h / .28); r++) for (let i = 0; i < Math.max(1, Math.round(w / .9)); i++) { const p = snpW(team, u - w / 2 + (i + .5 + (r % 2) * .3) * w / Math.max(1, Math.round(w / .9)), v); mb.add(U.box, spick([0xc0b090, 0xb0a080, 0xa89878]), p.x, SNP.G + y0 + .14 + r * .28, p.z, srand(-.04, .04), srand(-.1, .1), 0, .9, .28, d); } }
  else if (kind === 'rubble') { for (let i = 0; i < 9; i++) { const p = snpW(team, u + srand(-w / 2, w / 2), v + srand(-d / 2, d / 2)); mb.add(U.box, spick([0x7d6a5a, 0x8a7766, 0x6a5a4c, 0x8a4a36]), p.x, SNP.G + y0 + srand(.1, h * .8), p.z, srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.3, .8), srand(.2, .45), srand(.3, .7)); } }
  else snpBox(mb, team, u - w / 2, u + w / 2, v - d / 2, v + d / 2, y0, y0 + h, c, false);
  const [x0, x1, z0, z1] = snpBoxW(team, u - w / 2, u + w / 2, v - d / 2, v + d / 2);
  addSolid(x0, SNP.G + y0, z0, x1, SNP.G + y0 + h, z1, 'crate');
}

// ---------- il palazzo: pianta comune, varianti per fazione ----------
// Pianta di ogni piano (u da −24 a 24, v da 0 = facciata a 22 = retro):
//  stanze sulla facciata v 0,4–7,4 (4 stanze larghe 11,6 m), corridoio v 7,7–10,7,
//  atrio della scala al centro (u −6…6) e due stanze sul retro.
//  Scala a rampe parallele: S1 (v 18,6–20,2) sale verso +u, S2 (v 16,8–18,4) sale verso −u.
const SNP_S1 = [18.6, 20.2], SNP_S2 = [16.8, 18.4];
function snpBuilding(team) {
  const mb = new MB(), FH = SNP.FH, W2 = SNP.W / 2, D = SNP.D, t = .4, A = team === 'A';
  const ext = A ? 0xd9ccb0 : 0xc2a77e, ext2 = A ? 0xc8b896 : 0xae946c, trim = A ? 0xb8a988 : 0xb9ad92, inn = A ? 0xcfc4a8 : 0xc4b9a0, floorC = A ? 0x6b4e33 : 0x5e4632, ceil = 0xd6cfbf;
  const extMat = 'plaster';
  const rooms = [-18, -6, 6, 18];
  // aperture della facciata per piano: due finestre per stanza; brecce e varianti diverse nei due palazzi
  const win = (cu, k) => ({ a: cu + k * 2.8 - .65, b: cu + k * 2.8 + .65, lo: .9, hi: 2.45, kind: 'win' });
  const breaches = A
    ? [{ L: 1, a: 4.2, b: 7.6, lo: .25, hi: 2.9 }, { L: 2, a: -19.5, b: -16.6, lo: .5, hi: 3.2 }, { L: 0, a: 15.2, b: 19.2, lo: .35, hi: 2.6 }]
    : [{ L: 1, a: -8.4, b: -4.6, lo: .3, hi: 2.8 }, { L: 2, a: 16.6, b: 19.8, lo: .4, hi: 3.1 }, { L: 0, a: -20.2, b: -16.4, lo: .3, hi: 2.5 }];
  const facadeOps = [];
  for (let L = 0; L < 3; L++) {
    const ops = [];
    for (const cu of rooms) for (const k of [-1, 1]) {
      const w = win(cu, k);
      if (L === 0) { w.lo = .75; w.hi = 2.55; }
      if (!breaches.some(b => b.L === L && b.b > w.a - .3 && b.a < w.b + .3)) ops.push(w);
    }
    for (const b of breaches) if (b.L === L) ops.push({ ...b, kind: 'breach' });
    facadeOps.push(ops);
  }
  for (let L = 0; L < 3; L++) {
    const y0 = L * FH;
    // muri perimetrali
    mb.mat = extMat; snpWallU(mb, team, 0, t, -W2, W2, y0, FH, facadeOps[L], L === 0 ? (A ? 0xb9ab8e : 0xa08a66) : ext);
    const backOps = [{ a: -14.8, b: -13.6, lo: 1, hi: 2.4 }, { a: 13.6, b: 14.8, lo: 1, hi: 2.4 }, { a: -9.5, b: -8.3, lo: 1, hi: 2.4 }, { a: 8.3, b: 9.5, lo: 1, hi: 2.4 }];
    if (L === 0) backOps.push({ a: -18.7, b: -17.3, lo: 0, hi: 2.3 }, { a: 17.3, b: 18.7, lo: 0, hi: 2.3 });
    snpWallU(mb, team, D - t, D, -W2, W2, y0, FH, backOps, ext);
    snpWallV(mb, team, -W2, -W2 + t, t, D - t, y0, FH, [], ext2); snpWallV(mb, team, W2 - t, W2, t, D - t, y0, FH, [], ext2);
    // tramezzi tra le stanze della facciata (uno sfondato al primo piano)
    mb.mat = 'plaster';
    for (const u of [-12, 0, 12]) {
      const ops = [];
      if (L === 1 && u === (A ? 0 : -12)) ops.push({ a: 2.2, b: 5.4, lo: .3, hi: 2.7 });
      if (L === 2 && u === 12) ops.push({ a: 4.6, b: 5.8, lo: 0, hi: 2.2 });
      snpWallV(mb, team, u - .15, u + .15, t, 7.4, y0, FH, ops, inn);
    }
    // muro del corridoio con le porte delle stanze
    snpWallU(mb, team, 7.4, 7.7, -W2 + t, W2 - t, y0, FH, rooms.map(cu => ({ a: cu - .6, b: cu + .6, lo: 0, hi: 2.2 })), inn);
    // retro del corridoio: porte delle stanze posteriori e atrio della scala aperto
    snpWallU(mb, team, 10.7, 11, -W2 + t, W2 - t, y0, FH, [{ a: -18.6, b: -17.4, lo: 0, hi: 2.2 }, { a: 17.4, b: 18.6, lo: 0, hi: 2.2 }, { a: -6, b: 6, lo: 0, hi: FH }], inn);
    // muri dell'atrio verso le stanze sul retro
    for (const u of [-6.3, 6.3]) snpWallV(mb, team, u - .15, u + .15, 11, D - t, y0, FH, [{ a: 12.4, b: 13.6, lo: 0, hi: 2.2 }], inn);
    // cornicione marcapiano esterno
    mb.mat = 'plaster'; { const [x0, x1, z0, z1] = snpBoxW(team, -W2 - .1, W2 + .1, -.18, 0); mb.add(U.box, trim, (x0 + x1) / 2, SNP.G + y0 + FH - .1, (z0 + z1) / 2, 0, 0, 0, x1 - x0, .22, z1 - z0); }
    // cornici delle finestre e persiane divelte (solo grafica)
    mb.mat = 'wood';
    for (const o of facadeOps[L]) {
      if (o.kind === 'breach') { snpBreachDeco(mb, team, o, y0, true); continue; }
      const p = snpW(team, (o.a + o.b) / 2, .2), wdt = o.b - o.a, ax = team === 'A' ? 1 : -1;
      mb.add(U.box, 0x3a2c20, p.x, SNP.G + y0 + o.lo - .04, p.z, 0, 0, 0, wdt + .25, .08, .55);
      mb.add(U.box, 0x3a2c20, p.x, SNP.G + y0 + o.hi + .04, p.z, 0, 0, 0, wdt + .2, .08, .45);
      if (SNP_RNG() < .55) { const s = SNP_RNG() < .5 ? -1 : 1, q = snpW(team, (s < 0 ? o.a : o.b) + s * .35, -.1); mb.add(U.box, A ? 0x4a5a48 : 0x5a4a3a, q.x, SNP.G + y0 + (o.lo + o.hi) / 2 - .1, q.z, srand(-.2, .2), s * ax * srand(.1, .9), srand(-.3, .3), .65, o.hi - o.lo - .1, .05); }
    }
  }
  // solai: piano terra, 1°, 2°, tetto; fori della scala e crollo del tetto
  const holes = { 1: [[-4, 4, ...SNP_S1]], 2: [[-4, 4, ...SNP_S2]], 3: [[-4, 4, ...SNP_S1], A ? [9, 17, 1.6, 6.6] : [-17, -10, 1.6, 6.2]] };
  for (let L = 0; L <= 3; L++) for (const r of rectMinus([-W2 + t, W2 - t, t, D - t], holes[L] || [])) snpSlab(mb, team, r[0], r[1], r[2], r[3], L * FH, L === 3 ? 0x5a554e : floorC, ceil);
  // scala: rampe con gradini, setto centrale e parapetti sui fori
  mb.mat = 'wood';
  const flights = [{ L: 0, s: SNP_S1, dir: 1 }, { L: 1, s: SNP_S2, dir: -1 }, { L: 2, s: SNP_S1, dir: 1 }];
  for (const f of flights) {
    const y0 = f.L * FH, n = 12;
    for (let k = 0; k < n; k++) {
      const ua = f.dir > 0 ? -4 + k * 8 / n : 4 - (k + 1) * 8 / n, ub = ua + 8 / n, yt = y0 + (k + 1) * FH / n;
      snpBox(mb, team, ua, ub, f.s[0], f.s[1], yt - .18, yt, 0x5a4232, false);
    }
    const [x0, x1, z0, z1] = snpBoxW(team, -4, 4, f.s[0], f.s[1]), xl = snpW(team, f.dir > 0 ? -4 : 4, 0).x, xh = snpW(team, f.dir > 0 ? 4 : -4, 0).x;
    SNP.floors.push({ x0, x1, z0, z1, ramp: { c0: xl, c1: xh, y0: SNP.G + y0, y1: SNP.G + y0 + FH } });
  }
  mb.mat = 'plaster'; snpBox(mb, team, -4, 4, 18.4, 18.6, 0, 3 * FH + 1, inn);
  for (const [L, s, endU] of [[1, SNP_S1, -4], [2, SNP_S2, 4], [3, SNP_S1, -4]]) {
    const y = L * FH, outer = s === SNP_S1 ? [20.2, 20.35] : [16.65, 16.8];
    mb.mat = 'wood'; snpBox(mb, team, -4, 4, outer[0], outer[1], y, y + .95, 0x4a3628);
    snpBox(mb, team, endU - .08, endU + .08, s[0], s[1], y, y + .95, 0x4a3628);
  }
  // tetto: parapetto con varchi verso il nemico, comignoli, lucernario della scala
  const RY = 3 * FH;
  mb.mat = extMat;
  const parOps = A ? [{ a: -15, b: -12.6, lo: 0, hi: 0 }, { a: 2, b: 4.4, lo: .25, hi: .85 }, { a: 19, b: 21.5, lo: 0, hi: 0 }] : [{ a: -20, b: -17.6, lo: 0, hi: 0 }, { a: -4, b: -1.6, lo: .3, hi: .85 }, { a: 11, b: 13.4, lo: 0, hi: 0 }];
  snpWallU(mb, team, 0, t, -W2, W2, RY, .85, parOps, ext); snpWallU(mb, team, D - t, D, -W2, W2, RY, .85, [], ext);
  snpWallV(mb, team, -W2, -W2 + t, t, D - t, RY, .85, [], ext2); snpWallV(mb, team, W2 - t, W2, t, D - t, RY, .85, [], ext2);
  // bordi del crollo del tetto: travi spezzate e macerie sul 2° piano
  { const h = holes[3][1]; mb.mat = 'wood'; for (let i = 0; i < 6; i++) { const p = snpW(team, srand(h[0], h[1]), srand(h[2], h[3])); mb.add(U.box, 0x3e2e22, p.x, SNP.G + RY - srand(.3, 1.6), p.z, srand(-.6, .6), srand(0, 3), srand(-.5, .5), .2, .25, srand(2, 4)); } snpCover(mb, team, (h[0] + h[1]) / 2, (h[2] + h[3]) / 2, 2 * FH, 4, 2.4, .9, 'rubble'); }
  mb.mat = 'brick'; for (const u of A ? [-20, 11] : [-11, 20]) { snpBox(mb, team, u - .6, u + .6, 12, 13.2, RY, RY + 1.8, 0x7a4a3a); }
  snpBox(mb, team, -21, -19.6, 3.5, 4.4, RY, RY + .9, 0x6a6a64);
  // tetto spiovente sopra il vano scala come riparo e copertura
  mb.mat = 'roof'; snpBox(mb, team, -6, -4.6, 15.4, 21.6, RY, RY + 2.4, 0x6a4a3a);
  // ripari interni: macerie, tavoli rovesciati, sacchi davanti a qualche finestra
  const covers = A
    ? [[0, -14, 3.2, 1.6, .7, .9, 'wood'], [0, 9, 2.2, 3, 1, .8, 'sack'], [0, -6, 5.6, 2, .8, .9, 'wood'], [1, -18, 2.6, 2.2, 1, .8, 'rubble'], [1, 6, 3.6, 2.4, 1.2, .7, 'rubble'], [1, 15, 5.4, 1.8, .7, 1, 'wood'], [2, -18, 2.8, 2.6, 1.2, .7, 'rubble'], [2, -4, 2.2, 1.6, .8, .9, 'wood'], [2, 21, 4.6, 1.6, .7, 1.1, 'wood'], [3, -8, 3, 3, .6, .8, 'sack'], [3, 21, 2.4, 2, .6, .7, 'sack']]
    : [[0, 14, 3.2, 1.6, .7, .9, 'wood'], [0, -9, 2.2, 3, 1, .8, 'sack'], [0, 6, 5.6, 2, .8, .9, 'wood'], [1, -6, 3.4, 2.4, 1.2, .7, 'rubble'], [1, 18, 2.6, 2.2, 1, .8, 'rubble'], [1, -15, 5.4, 1.8, .7, 1, 'wood'], [2, 18, 2.8, 2.6, 1.2, .7, 'rubble'], [2, 4, 2.2, 1.6, .8, .9, 'wood'], [2, -21, 4.6, 1.6, .7, 1.1, 'wood'], [3, 8, 3, 3, .6, .8, 'sack'], [3, -21, 2.4, 2, .6, .7, 'sack']];
  for (const [L, u, v, w, d, h, k] of covers) snpCover(mb, team, u, v, L * FH, w, d, h, k);
  // arredi sul retro: armadi, letti, banconi (riparano dai colpi che entrano dalle finestre posteriori)
  for (let L = 0; L < 3; L++) for (const s of [-1, 1]) { mb.mat = 'wood'; snpBox(mb, team, s * 15 - 2, s * 15 + 2, 20.6, 21.5, L * FH, L * FH + 1.9, 0x4a3426); snpBox(mb, team, s * 10, s * 10 + s * 1.4, 15, 17, L * FH, L * FH + .5, 0x6a5040, false); }
  // cortile sul retro con muro di cinta (zona di rientro)
  const Y = SNP.YARD, yardC = A ? 0x8a8070 : 0x7a6a5a;
  mb.mat = 'stone';
  snpBox(mb, team, -W2, W2, D + Y, D + Y + .5, 0, 3.2, yardC); snpBox(mb, team, -W2 - .5, -W2, D, D + Y + .5, 0, 3.2, yardC); snpBox(mb, team, W2, W2 + .5, D, D + Y + .5, 0, 3.2, yardC);
  mb.mat = 'wood'; for (const u of [-10, 4, 15]) snpBox(mb, team, u, u + 1.4, D + 3 + (u % 3), D + 4.2 + (u % 3), 0, 1.1, 0x6b5434, true);
  // facciata: zoccolo in pietra e insegna
  mb.mat = 'plaster'; { const [x0, x1, z0, z1] = snpBoxW(team, -W2 - .1, W2 + .1, -.12, .1); mb.add(U.box, 0x8a8478, (x0 + x1) / 2, SNP.G + .35, (z0 + z1) / 2, 0, 0, 0, x1 - x0, .7, z1 - z0); }
  mb.mat = 'vc'; { const p = snpW(team, 0, -.08); mb.add(U.box, A ? 0x1e2a3a : 0x2a2420, p.x, SNP.G + FH - .65, p.z, 0, 0, 0, 9, .7, .06); }
  snpFurnish(mb, team);
  // facciata: lesene, cornici delle finestre, bugnato al piano terra, cornicione e tetto a mansarda sul retro
  const RYt = 3 * FH, fx = (u, v, y, w, h, d, c, m) => { mb.mat = m; const p = snpW(team, u, v); mb.add(U.box, c, p.x, SNP.G + y, p.z, 0, 0, 0, w, h, d); };
  const pil = A ? 0xe4d8be : 0xc9bb9a, rust = A ? 0xb9ab8e : 0x9a8c72, sur = A ? 0xeee4cc : 0xd2c4a2;
  for (const u of [-23.6, -12, 0, 12, 23.6]) fx(u, -.08, (RYt + .85) / 2, .8, RYt + .85, .18, pil, extMat);
  for (let L = 0; L < 3; L++) for (const o of facadeOps[L]) {
    if (o.kind === 'breach') { for (let k = 0; k < 5; k++) fx((o.a + o.b) / 2 + srand(-2.2, 2.2), -.11, L * FH + (o.lo + o.hi) / 2 + srand(-.4, 1.4), srand(.8, 2), srand(.6, 1.6), .04, 0x2a2622, 'vc'); continue; }
    const cu = (o.a + o.b) / 2, w = o.b - o.a, y0 = L * FH;
    fx(cu - w / 2 - .09, -.1, y0 + (o.lo + o.hi) / 2, .18, o.hi - o.lo + .2, .1, sur, extMat); fx(cu + w / 2 + .09, -.1, y0 + (o.lo + o.hi) / 2, .18, o.hi - o.lo + .2, .1, sur, extMat);
    fx(cu, -.12, y0 + o.hi + .14, w + .5, .26, .14, sur, extMat); fx(cu, -.14, y0 + o.lo - .07, w + .35, .12, .22, sur, 'plaster');
    if (SNP_RNG() < .3) fx(cu + srand(-.3, .3), -.13, y0 + o.hi + .6, srand(.6, 1.4), srand(.5, 1), .03, 0x3a3430, 'vc');   // fuliggine sopra la finestra
  }
  fx(0, -.3, RYt + .95, SNP.W + .6, .24, .6, sur, 'plaster'); fx(0, -.15, RYt + .76, SNP.W + .3, .14, .3, sur, 'plaster');
  // mansarda sul retro (v 12,6–21,6): falda inclinata in ardesia, abbaini e comignoli
  mb.mat = 'roof';
  for (const s of [-1, 1]) { const uc = s * (W2 + 6.5) / 2, len = W2 - 6.5 - .4, p = snpW(team, uc, 17.1); mb.add(U.prism, 0x4a4e54, p.x, SNP.G + RYt, p.z, 0, PI / 2, 0, 9, 3.4, len); const [x0, x1, z0, z1] = snpBoxW(team, uc - len / 2, uc + len / 2, 14.4, 19.8); addSolid(x0, SNP.G + RYt, z0, x1, SNP.G + RYt + 2.2, z1, 'house'); }
  for (const u of [-16, -8, 8, 16]) { fx(u, 13.6, RYt + 1.1, 1.4, 1.5, 1.2, ext, extMat); fx(u, 13.6, RYt + 1.95, 1.7, .2, 1.5, 0x4a4e54, 'roof'); fx(u, 12.98, RYt + 1.05, .8, .9, .04, 0x1c1c1e, 'vc'); }
  // interni: carta da parati di colore diverso per stanza, zoccolatura scura, battiscopa
  const papers = A ? [0x8f9a7e, 0xa38f72, 0x7d8a96, 0xb0a07c] : [0x9c8a6a, 0x7f8c7a, 0xa0907e, 0x8a7f92];
  for (let L = 0; L < 3; L++) rooms.forEach((cu, i) => {
    const y0 = L * FH, pc = papers[(i + L) % 4], dado = 0x4a3c30;
    for (const [ua, ub] of [[cu - 5.65, cu - .6], [cu + .6, cu + 5.65]]) { fx((ua + ub) / 2, 7.38, y0 + 2.25, ub - ua, 2.1, .03, pc, 'plaster'); fx((ua + ub) / 2, 7.37, y0 + .6, ub - ua, 1.1, .04, dado, 'wood'); }
    for (const su of [-1, 1]) { const u = cu + su * 5.8 - su * .02; if (Math.abs(u) > 23.4) continue; fx(u, 3.9, y0 + 2.25, .03, 2.1, 6.9, pc, 'plaster'); fx(u, 3.9, y0 + .6, .04, 1.1, 6.9, dado, 'wood'); }
    for (let k = 0; k < 3; k++) fx(cu + srand(-4.5, 4.5), srand(1.5, 6.5), y0 + .06, srand(.3, .9), .12, srand(.2, .6), spick([0x6a5a4c, 0x8a7766, 0xd8d0c0]), 'vc');   // calcinacci
  });
  addTiled(mb, 60);
  snpLabel(team);
  // nodi di navigazione e postazioni di tiro
  snpNavBuild(team, facadeOps, breaches, holes);
}
// insegna dipinta: HÔTEL DE LA GARE / POSTES ET TÉLÉGRAPHES
function snpLabel(team) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 80; const g = cv.getContext('2d');
  g.fillStyle = team === 'A' ? '#1e2a3a' : '#2a2420'; g.fillRect(0, 0, 1024, 80); g.fillStyle = '#d9c99a'; g.font = '600 54px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(team === 'A' ? 'HÔTEL DE LA GARE' : 'POSTES ET TÉLÉGRAPHES', 512, 42);
  const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8.8, .66), new THREE.MeshStandardMaterial({ map: tx, roughness: .9 }));
  const p = snpW(team, 0, -.12); m.position.set(p.x, SNP.G + SNP.FH - .65, p.z); m.rotation.y = team === 'A' ? 0 : PI; scene.add(m);
}

// ---------- altezza del pavimento sotto i piedi (piani, scale, terreno) ----------
// restituisce la superficie più alta non oltre il gradino superabile sopra i piedi
function snpFloor(x, z, yf) {
  let best = Hf(x, z);
  for (const f of SNP.floors) {
    if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
    let y = f.y;
    if (f.ramp) { const r = f.ramp, k = clamp((x - r.c0) / (r.c1 - r.c0), 0, 1); y = r.y0 + (r.y1 - r.y0) * k; }
    if (y <= yf + .55 && y > best) best = y;
  }
  return best;
}
// confini della squadra: dentro il proprio palazzo e il cortile
function snpClamp(team, p) {
  const l = snpL(team, p.x, p.z), W2 = SNP.W / 2 - .45;
  const u = clamp(l.u, -W2, W2), v = clamp(l.v, .5, SNP.D + SNP.YARD - .3);
  if (u !== l.u || v !== l.v) { snpW(team, u, v, _snpT); p.x = _snpT.x; p.z = _snpT.z; return true; }
  return false;
}
const _snpT = new V3();

// ---------- navigazione: nodi per piano, archi verificati con raggi sui solidi ----------
// postazione: { id, team, L, pos (piedi), eye, yaw, stance 0 in piedi / 1 accovacciato / 2 prono, kind, cover, expo, sees[], node }
function snpNavBuild(team, facadeOps, breaches, holes) {
  const FH = SNP.FH, nodes = SNP.nav[team], add = (u, v, L, tag) => { const p = snpW(team, u, v); const n = { id: nodes.length, team, L, pos: new V3(p.x, SNP.G + L * FH, p.z), tag: tag || '', e: [] }; nodes.push(n); return n; };
  const rooms = [-18, -6, 6, 18];
  for (let L = 0; L < 3; L++) {
    for (const cu of rooms) { add(cu, 4, L, 'room'); add(cu - 3.4, 4.6, L); add(cu + 3.4, 4.6, L); add(cu, 6.6, L); add(cu, 7.55, L, 'door'); add(cu, 9.2, L, 'corr'); }
    for (const u of [-22, -12, 0, 12, 22]) add(u, 9.2, L, 'corr');
    for (const u of [-18, 18]) { add(u, 10.85, L, 'door'); add(u, 13, L); add(u, 17, L, 'room'); add(u * .62, 13, L); add(u * .62, 17, L); }
    for (const u of [-6.3, 6.3]) add(u, 13, L, 'door');
    add(-3, 12.5, L, 'hall'); add(3, 12.5, L, 'hall'); add(0, 15, L, 'hall'); add(-5, 15.5, L); add(5, 15.5, L);
    add(-5, 17.6, L, 'land'); add(5, 17.6, L, 'land'); add(-5, 19.4, L, 'land'); add(5, 19.4, L, 'land');
    if (L === 0) { add(-18, 22.6, L, 'door'); add(18, 22.6, L, 'door'); for (const u of [-18, -8, 0, 8, 18]) { add(u, 26, L, 'yard'); add(u, 29.5, L, 'yard'); } }
  }
  // tetto
  for (let u = -21; u <= 21; u += 4.2) for (const v of [2.2, 6.5, 11, 15.5, 20]) add(u, v, 3, 'roof');
  add(5, 19.4, 3, 'land');
  // rampe della scala
  const find = (u, v, L) => { const p = snpW(team, u, v); return nodes.find(n => n.L === L && Math.abs(n.pos.x - p.x) < .1 && Math.abs(n.pos.z - p.z) < .1); };
  for (const [ua, va, La, ub, vb, Lb] of [[-5, 19.4, 0, 5, 19.4, 1], [5, 17.6, 1, -5, 17.6, 2], [-5, 19.4, 2, 5, 19.4, 3]]) { const a = find(ua, va, La), b = find(ub, vb, Lb); if (a && b) { a.e.push(b.id); b.e.push(a.id); a.stair = b.stair = true; } }
  // postazioni di tiro
  const post = (u, v, L, stance, kind, cover, expo) => {
    const p = snpW(team, u, v), pos = new V3(p.x, SNP.G + L * FH, p.z);
    const n = add(u, v, L, 'post');
    const ps = { id: SNP.posts.length, team, L, pos, eye: pos.clone().setY(pos.y + [1.58, 1.02, .4][stance]), yaw: team === 'A' ? 0 : PI, stance, kind, cover, expo, sees: [], node: n.id, occ: null, heat: 0 };
    n.post = ps.id; SNP.posts.push(ps); return ps;
  };
  for (let L = 0; L < 3; L++) for (const o of facadeOps[L]) {
    const cu = (o.a + o.b) / 2;
    if (o.kind === 'breach') { post(cu, 1.3, L, o.lo < .4 ? 2 : 1, 'breccia', .45, .7); post(cu + (cu > 0 ? -1.6 : 1.6), 3.4, L, 1, 'fondo stanza', .7, .35); continue; }
    post(cu, .95, L, L === 0 ? 1 : (Math.round(cu * 3) % 2 ? 1 : 0), 'finestra', .55, .6);
    if (Math.round(cu) % 3 === 0) post(cu + (SNP_RNG() < .5 ? -.6 : .6), 5.2, L, 0, 'fondo stanza', .85, .25);
  }
  // tetto: varchi nel parapetto (proni) e dietro il parapetto intero (accovacciati)
  for (const u of team === 'A' ? [-13.8, 3.2, 20.2, -6, 12] : [-18.8, -2.8, 12.2, 6, -12]) post(u, 1.1, 3, Math.abs(u) % 6 < 1 ? 1 : 2, 'tetto', .5, .65);
  post(team === 'A' ? 13 : -13.5, 7.4, 3, 1, 'crollo del tetto', .6, .4);
  // griglia fitta di punti calpestabili per ogni piano (riempie stanze, cortile e tetto)
  for (let L = 0; L <= 3; L++) for (let u = -22.9; u <= 22.9; u += 1.5) for (let v = .95; v <= (L === 0 ? SNP.D + SNP.YARD - .6 : SNP.D - .7); v += 1.5) add(u, v, L, 'g');
  // punti dentro un mobile o troppo vicini a un muro: spostati di poco, altrimenti scartati
  const free = n => { for (const [ox, oz] of [[0, 0], [.3, 0], [-.3, 0], [0, .3], [0, -.3]]) { _snpO.set(n.pos.x + ox, n.pos.y + .45, n.pos.z + oz); if (pointInSolid(_snpO)) return false; _snpO.y = n.pos.y + 1.3; if (pointInSolid(_snpO)) return false; } return Math.abs(snpFloor(n.pos.x, n.pos.z, n.pos.y + .1) - n.pos.y) < .2; };
  for (const n of nodes) {
    if (free(n)) continue;
    const o = n.pos.clone(); let okp = false;
    for (let r = .4; r <= 1.6 && !okp; r += .4) for (let a = 0; a < 8 && !okp; a++) { n.pos.set(o.x + Math.cos(a * PI / 4) * r, o.y, o.z + Math.sin(a * PI / 4) * r); okp = free(n); }
    if (!okp) { n.pos.copy(o); n.dead = true; }
  }
  // archi sullo stesso piano: tra punti con nome fino a 9 m, verso la griglia fino a 2,2 m
  const cell = 3, buck = new Map(), key = (L, i, j) => L * 1e6 + (i + 500) * 1000 + (j + 500);
  for (const n of nodes) { if (n.dead) continue; const k = key(n.L, Math.floor(n.pos.x / cell), Math.floor(n.pos.z / cell)); (buck.get(k) || buck.set(k, []).get(k)).push(n); }
  const named = nodes.filter(n => !n.dead && n.tag !== 'g');
  const link = (a, b) => { if (a.e.includes(b.id)) return; if (snpClear(a.pos, b.pos)) { a.e.push(b.id); b.e.push(a.id); } };
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) { const a = named[i], b = named[j]; if (a.L === b.L && a.pos.distanceTo(b.pos) < 9) link(a, b); }
  for (const a of nodes) {
    if (a.dead) continue; const ci = Math.floor(a.pos.x / cell), cj = Math.floor(a.pos.z / cell);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const b of buck.get(key(a.L, ci + di, cj + dj)) || []) if (b.id > a.id && (a.tag === 'g' || b.tag === 'g') && a.pos.distanceTo(b.pos) < 2.2) link(a, b);
  }
  // punti isolati (schegge tra muri e fori): esclusi
  { const st = nodes.find(n => n.tag === 'yard' && !n.dead), seen = new Set([st.id]), q = [st.id]; while (q.length) { const c = q.shift(); for (const k of nodes[c].e) if (!seen.has(k)) { seen.add(k); q.push(k); } } for (const n of nodes) if (!seen.has(n.id)) n.dead = true; }
  // punti di rinascita: cortile e stanze sul retro del piano terra
  for (const n of nodes) if (!n.dead && n.L === 0 && (n.tag === 'yard' || (n.tag === 'room' && snpL(team, n.pos.x, n.pos.z).v > 12))) SNP.spawns[team].push(n);
}
const _snpD = new V3(), _snpS = new V3(), _snpO = new V3();
// passaggio libero tra due punti dello stesso piano: tre raggi paralleli a due altezze e pavimento continuo
function snpClear(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z); if (d < .05) return true;
  const dx = (b.x - a.x) / d, dz = (b.z - a.z) / d, sx = -dz, sz = dx, x0 = Math.min(a.x, b.x) - .5, x1 = Math.max(a.x, b.x) + .5, z0 = Math.min(a.z, b.z) - .5, z1 = Math.max(a.z, b.z) + .5;
  for (const s of solids) {
    if (!s.on || s.max.x < x0 || s.min.x > x1 || s.max.z < z0 || s.min.z > z1 || s.max.y < a.y + .2 || s.min.y > a.y + 1.4) continue;
    for (const h of [.35, 1.25]) for (const o of [-.3, 0, .3]) if (rayBox(a.x + sx * o, a.y + h, a.z + sz * o, dx, 1e-9, dz, s, d) >= 0) return false;
  }
  for (let t = .4; t < d; t += .4) { const y = snpFloor(a.x + dx * t, a.z + dz * t, a.y + .1); if (Math.abs(y - a.y) > .25) return false; }
  return true;
}
// visibilità precalcolata tra postazioni avversarie (una volta sola, al caricamento)
function snpComputeSees() {
  const A = SNP.posts.filter(p => p.team === 'A'), E = SNP.posts.filter(p => p.team === 'E');
  for (const a of A) for (const e of E) if (losClear(a.eye, e.eye)) { a.sees.push(e.id); e.sees.push(a.id); }
}
// percorso più breve tra due nodi (A*)
function snpPath(team, from, to) {
  const N = SNP.nav[team]; if (from === to) return [from];
  const g = new Map([[from, 0]]), came = new Map(), open = [from], h = i => N[i].pos.distanceTo(N[to].pos), f = new Map([[from, h(from)]]);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
    const c = open.splice(bi, 1)[0];
    if (c === to) { const p = [c]; let k = c; while (came.has(k)) { k = came.get(k); p.unshift(k); } return p; }
    for (const nb of N[c].e) {
      const ng = g.get(c) + N[c].pos.distanceTo(N[nb].pos);
      if (ng < (g.has(nb) ? g.get(nb) : 1e9)) { came.set(nb, c); g.set(nb, ng); f.set(nb, ng + h(nb)); if (!open.includes(nb)) open.push(nb); }
    }
  }
  return null;
}
// percorso accorciato: salta i punti intermedi quando la linea diretta è libera (mai attraverso le scale)
function snpSmooth(team, path) {
  const N = SNP.nav[team], out = [path[0]]; let i = 0;
  while (i < path.length - 1) {
    let j = Math.min(path.length - 1, i + 12);
    for (; j > i + 1; j--) { let same = true; for (let k = i + 1; k <= j; k++) if (N[path[k]].L !== N[path[i]].L) { same = false; break; } if (same && snpClear(N[path[i]].pos, N[path[j]].pos)) break; }
    out.push(path[j]); i = j;
  }
  return out;
}
function snpNearestNode(team, p) {
  let best = null, bd = 1e9;
  for (const n of SNP.nav[team]) { if (n.dead) continue; const dy = Math.abs(n.pos.y - p.y); if (dy > 1.8) continue; const d = n.pos.distanceToSquared(p) + dy * dy * 4; if (d < bd) { bd = d; best = n; } }
  return best;
}

// ---------- terreno: strada in piano con crateri ----------
const SNP_CRATERS = [[-6, -146, 4.2, 1.2], [14, -158, 3.2, .9], [-20, -138, 2.6, .7], [24, -168, 3.6, 1.1], [3, -170, 2.4, .6], [-28, -160, 3, .8], [30, -136, 2.4, .6]];
function snpH(x, z) {
  let y = SNP.G;
  const out = Math.max(0, Math.abs(x) - 70) + Math.max(0, Math.abs(z - SNP.C.z) - 110);
  if (out > 0) y += (fbm(x * .02, z * .02, 2) - .5) * 1.5 * Math.min(1, out / 30);
  for (const [cx, cz, r, d] of SNP_CRATERS) { const k = Math.hypot(x - cx, z - cz) / r; if (k < 1) y += k < .72 ? -d * (1 - (k / .72) ** 2) : d * .35 * Math.sin((k - .72) / .28 * PI); }
  return y;
}
function snpSplat(x, z, n2) {
  const street = Math.abs(z - SNP.C.z) < SNP.GAP / 2, cr = SNP_CRATERS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r * 1.1);
  const peb = street ? .9 : .5, dirt = cr ? 1.6 : .7 + n2 * .4, tot = peb + dirt, t = .78 + .1 * n2;
  return { sp: [0, peb / tot, 0, dirt / tot], cl: [t * .92, t * .9, t * .88] };
}

// ---------- la strada distrutta e i dintorni ----------
function snpStreet() {
  const mb = new MB(), C = SNP.C, G = SNP.G, zA = SNP.FRONT.A, zE = SNP.FRONT.E;
  // marciapiedi, carreggiata in pavé con binari del tram
  mb.mat = 'stone'; for (const z0 of [zA - 3.2, zE]) mb.add(U.box, 0x8e8a80, 0, G + .08, z0 + 1.6, 0, 0, 0, 150, .16, 3.2);
  mb.mat = 'cobble';
  for (let x = -72; x < 72; x += 12) for (let z = zE + 3.2; z < zA - 3.2; z += 11.5) { const cx = x + 6, cz = Math.min(z + 5.75, zA - 3.2 - 5.75); if (SNP_CRATERS.some(([a, b, r]) => Math.hypot(cx - a, cz - b) < r + 1.5)) continue; mb.add(U.box, 0x7a756c, cx, snpH(cx, cz) + .03, cz, 0, 0, 0, 12, .06, 11.5); }
  mb.mat = 'paint'; for (const z of [C.z - .7, C.z + .7]) for (let x = -70; x < 70; x += 8) if (!SNP_CRATERS.some(([a, b, r]) => Math.hypot(x - a, z - b) < r + 3)) mb.add(U.box, 0x55524c, x + 4, G + .07, z, 0, 0, 0, 8, .05, .08);
  // carri distrutti: uno Sherman e un Panzer IV bruciati, di traverso nella strada
  addSherman(mb, -14, snpH(-14, -164), -164, .55, true); addSolid(-16.4, G - 1, -167.6, -11.6, G + 2.6, -160.4, 'tank');
  { const g = kasPz4Geo(), grp = new THREE.Group(), h = groupMesh(g.hull), tu = groupMesh(g.tur), gn = groupMesh(g.gun); tu.position.set(0, g.turY, g.turZ); tu.rotation.y = .9; gn.position.set(0, g.gunY, g.gunZ); gn.rotation.x = .12; tu.add(gn); grp.add(h, tu); burnMeshes(grp); grp.position.set(17, snpH(17, -141), -141); grp.rotation.y = -2.2; grp.rotation.z = .06; scene.add(grp); addSolid(13.6, G - 1, -144.4, 20.4, G + 2.7, -137.6, 'tank'); }
  // automobili civili abbandonate (Citroën Traction Avant e camion)
  const car = (x, z, ry, c, truck) => {
    mb.setBase(x, snpH(x, z), z, 0, ry, 0); mb.mat = 'paint';
    if (truck) { mb.add(U.box, c, 0, 1.0, -1.6, 0, 0, 0, 2.1, 1.3, 1.9); mb.add(U.box, 0x4a4a40, 0, 1.25, 1.1, 0, 0, 0, 2.2, 1.6, 3.6); mb.add(U.box, 0x2a2a28, 0, .55, 0, 0, 0, 0, 1.9, .3, 6); }
    else { mb.add(U.box, c, 0, .7, 0, 0, 0, 0, 1.75, .55, 4.4); mb.add(U.box, c, 0, 1.18, .25, 0, 0, 0, 1.55, .5, 2.1); mb.add(U.box, 0x1a1a18, 0, 1.2, .25, 0, 0, 0, 1.58, .3, 1.6); mb.add(U.box, c, 0, .62, -1.9, 0, 0, 0, 1.1, .5, 1.1); }
    mb.mat = 'vc'; for (const sx of [-1, 1]) for (const sz of truck ? [-1.8, 2] : [-1.4, 1.4]) mb.add(U.cyl12, 0x1c1c1a, sx * .9, .38, sz, 0, 0, PI / 2, .38, .22, .38);
    mb.clearBase();
    const L = truck ? 3.2 : 2.3, Wd = 1.1, c2 = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry)), hx = Wd * c2 + L * s2, hz = Wd * s2 + L * c2;
    addSolid(x - hx, G - 1, z - hz, x + hx, G + (truck ? 2.1 : 1.45), z + hz, 'tank');
  };
  car(-30, -128, 1.4, 0x22262a); car(6, -133, -.3, 0x2c2a24); car(32, -176, .9, 0x3a3428, true); car(-36, -177, -1.2, 0x2a3026); car(40, -150, .1, 0x30302c);
  // lampioni piegati, barricate di sacchi e cavalli di Frisia, cumuli di macerie
  mb.mat = 'paint';
  for (const [x, z, lean] of [[-22, zA - 2.6, .1], [0, zA - 2.6, .5], [22, zA - 2.6, 0], [-22, zE + 2.6, -.4], [0, zE + 2.6, 0], [22, zE + 2.6, .7]]) { mb.setBase(x, G, z, lean, 0, lean * .3); mb.add(U.cyl, 0x2a2c2a, 0, 2.4, 0, 0, 0, 0, .08, 4.8, .08); mb.add(U.box, 0x2a2c2a, .5, 4.75, 0, 0, 0, 0, 1.1, .06, .06); mb.add(U.box, 0x3a3a34, 1, 4.6, 0, 0, 0, 0, .3, .3, .3); mb.clearBase(); }
  for (const [x0, z0, x1, z1] of [[-8, -126, 2, -124], [8, -172, 18, -175], [-44, -150, -38, -140]]) { sandbagLine(mb, x0, z0, x1, z1, 3); const hx = Math.abs(x1 - x0) / 2 + .5, hz = Math.abs(z1 - z0) / 2 + .5; addSolid((x0 + x1) / 2 - hx, G - 1, (z0 + z1) / 2 - hz, (x0 + x1) / 2 + hx, G + 1, (z0 + z1) / 2 + hz, 'sand'); }
  mb.mat = 'paint'; for (const [x, z] of [[-2, -152], [26, -156], [-34, -146], [10, -150], [-12, -176]]) { for (let k = 0; k < 3; k++) mb.add(U.box, 0x3a3630, x, snpH(x, z) + .7, z, k * PI / 3, k * 1.1, PI / 4, .14, 2, .14); }
  for (let i = 0; i < 40; i++) { const x = srand(-60, 60), z = srand(zE + 4, zA - 4), y = snpH(x, z); mb.mat = SNP_RNG() < .5 ? 'brick' : 'stone'; const n = 3 + (SNP_RNG() * 6 | 0); for (let k = 0; k < n; k++) mb.add(U.box, spick([0x7d6a5a, 0x8a7766, 0x6a5a4c, 0x8a4a36, 0x9a8e7c]), x + srand(-1.5, 1.5), y + srand(.05, .5), z + srand(-1.5, 1.5), srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.3, 1.1), srand(.2, .5), srand(.3, .9)); if (i % 3 === 0) addSolid(x - 1, G - 1, z - 1, x + 1, y + .6, z + 1, 'crate'); }
  // grandi cumuli dove sono crollate le case ai lati della strada
  for (const [x, z, r] of [[-52, -132, 7], [55, -166, 8], [-56, -172, 6], [50, -126, 5]]) { mb.mat = 'brick'; for (let k = 0; k < 40; k++) { const a = SNP_RNG() * TAU, d = Math.sqrt(SNP_RNG()) * r, h = (1 - d / r) * 2.4; mb.add(U.box, spick([0x7d6a5a, 0x8a7766, 0x6a5a4c, 0x8a4a36]), x + Math.cos(a) * d, G + h * SNP_RNG(), z + Math.sin(a) * d, srand(-.6, .6), srand(0, 3), srand(-.6, .6), srand(.5, 1.4), srand(.3, .7), srand(.5, 1.2)); } }
  snpStreetProps(mb); addTiled(mb, 60);
  // case in rovina ai lati e fondali di città dietro i palazzi
  const ruins = new MB();
  const house = (cx, cz, w, d, ht, face, style, ruined, solid = true) => { cityHouseGeo(ruins, { cx, cz, w, d, ht, face, style, base: snpH(cx, cz) - .2 }, ruined); if (solid) addSolid(cx - w / 2, G - 1, cz - d / 2, cx + w / 2, G + ht, cz + d / 2, 'house'); };
  for (const s of [-1, 1]) {
    house(s * 34, -124, 12, 10, 9.3, 1, 2, true); house(s * 36, -176, 14, 10, 12.4, -1, 0, true); house(s * 46, -150, 10, 16, 6.2, s, 1, true);
    house(s * 62, -150, 18, 30, 12.4, s, 2, true); house(s * 31, -150, 5, 14, 3.1, s, 0, true);
  }
  for (let i = 0; i < 12; i++) { const x = -66 + i * 12 + srand(-1, 1); house(x, SNP.FRONT.A + 42 + srand(0, 6), 11, 12, spick([9.3, 12.4, 15.5]), -1, i % 3, SNP_RNG() < .4, false); house(-x, SNP.FRONT.E - 42 - srand(0, 6), 11, 12, spick([9.3, 12.4, 15.5]), 1, (i + 1) % 3, SNP_RNG() < .4, false); }
  addTiled(ruins, 60);
}
// fumo che sale dalle rovine lontane
function snpSmoke(dt) {
  SNP.smokeT = (SNP.smokeT || 0) - dt; if (SNP.smokeT > 0) return; SNP.smokeT = .35;
  for (const [x, z] of [[-55, -172], [58, -130], [-30, -100 + 40], [40, -235]]) PS_SMOKE.emit(x + rnd(-2, 2), SNP.G + 4, z + rnd(-2, 2), rnd(-.3, .3), rnd(1.2, 2), rnd(-.3, .3), rnd(9, 14), 4, 14, .32, .3, .28, .5, .1, -.05);
}

function buildSniperMap() {
  SNP.floors.length = 0; SNP.posts.length = 0; SNP.nav.A.length = 0; SNP.nav.E.length = 0; SNP.spawns.A.length = 0; SNP.spawns.E.length = 0;
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  buildHF(); buildHC();
  buildTerrain(); buildWater(); if (WORLD.waterMesh) WORLD.waterMesh.visible = false;
  snpStreet();
  snpBuilding('A'); snpBuilding('E');
  snpComputeSees();
  // cielo coperto di fine luglio 1944: luce diffusa, foschia grigia della polvere
  FOG_COL.setRGB(.62, .63, .64); scene.fog.color.copy(FOG_COL); FOG_K = 1.15; scene.fog.density = FOG_BASE * FOG_K;
  if (sun) sun.intensity *= .62;
}
