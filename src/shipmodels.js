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
  jp: { hull: 0x6f7377, upper: 0x80858a, deck: 0x7a6a52, dark: 0x2b2f33, metal: 0x6a7075 },   // grigio Kure, ponte in legno
  x: { hull: 0x3e3a35, upper: 0x8c8274, deck: 0x6b5a46, dark: 0x2a2724, metal: 0x5f5850 },    // mercantile: scafo nero, sovrastrutture color legno
};
// scafo: sezioni lungo la nave con prua slanciata (lancio) e svasata, cavallino, poppa a specchio; colori per vertice
function hullGeo2(C) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, B = C.B, D = C.D, F = C.F, N = 44;
  const pt = C.type === 'pt', rake = pt ? L * .05 : L * .045, flare = pt ? .05 : .16;
  const cruiser = !pt && C.type !== 'cargo';
  const hw = t => B / 2 * (t < .32 ? Math.pow(Math.max(t, .003) / .32, pt ? .45 : .62) : t > .84 ? (cruiser ? Math.max(.14, Math.sqrt(Math.max(0, 1 - ((t - .84) / .16) ** 2))) : 1 - ((t - .84) / .16) ** 2 * (pt ? .1 : .32)) : 1);   // poppa da incrociatore: pianta ellittica
  // profondità della carena lungo la nave: piede di ruota arrotondato a prua, fondo che risale verso la poppa (volta di poppa)
  const df = t => pt ? 1 : t < .07 ? .3 + .7 * Math.sqrt(t / .07) : t > .78 ? 1 - Math.pow((t - .78) / .22, 1.3) * (cruiser ? .8 : .7) : 1;
  const sheer = t => F + (t < .3 ? (1 - t / .3) ** 2 * F * (pt ? .25 : .45) : 0) + (t > .9 ? (t - .9) / .1 * F * .08 : 0);
  // profilo di una sezione: [mezza larghezza, quota, colore]
  const sec = t => { const w = hw(t), fl = t < .3 ? 1 + flare * (1 - t / .3) : 1, k = df(t); return [[w * fl, sheer(t), 'hs'], [w * (1 + (fl - 1) * .5), F * .45, 'h'], [w, .5, 'h'], [w * .995, .5, 'b'], [w * .99, -.45, 'b'], [w * .985, -.45, 'r'], [w * .86, -D * .72 * k, 'r'], [w * .35, -D * .97 * k, 'r'], [0, -D * k, 'r']]; };
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
  g.userData = { hw, sheer, zAt, df };
  return g;
}

// ---------- pezzi riutilizzabili ----------
// ---------- controllo delle compenetrazioni ----------
// ogni dettaglio minore (bitte, prese d'aria, zattere, lance, mitragliere...) ha un suo identificativo: se finisce dentro una
// sovrastruttura, una torre o un altro dettaglio, oppure resta sospeso in aria, viene tolto per intero
let _GID = 0;
function clut(mb, fn) { const own = !mb.gid; if (own) mb.gid = ++_GID; fn(); if (own) mb.gid = 0; }
const _bb = new THREE.Box3();
function partBox(P) { const g = P.g; if (!g.boundingBox) g.computeBoundingBox(); return _bb.copy(g.boundingBox).applyMatrix4(P.m).clone(); }
function turretBoxes(C, hd) {
  const out = [], L = C.L;
  for (const G of C.guns) for (const [x, y, z, , n] of G.mounts) {
    const S = SHELL[G.s], deckY = hd.sheer((z + L / 2) / L), ty = Math.max(y, deckY + (S.cal >= 140 ? 2 : 1.2));
    const sz = S.cal >= 300 ? Math.min(3.2, S.cal / 356) * (n >= 4 ? 1.15 : 1) : S.cal >= 200 ? .9 : S.cal >= 140 ? .72 : .5;
    const r = S.cal >= 140 ? 4.2 * sz * (n >= 3 ? 1.16 : 1) : S.cal >= 100 ? 2.2 * (n >= 2 ? 1.2 : 1) : S.cal >= 30 ? 1.7 : .7, h = S.cal >= 140 ? 2.2 * sz : 2.2;
    out.push({ box: new THREE.Box3(new V3(x - r, deckY + .2, z - r), new V3(x + r, ty + h, z + r)), body: new THREE.Box3(new V3(x - r, ty - (S.cal >= 140 ? 2.4 * sz : .9), z - r), new V3(x + r, ty + h, z + r)), x, z, ty, S, n, G });
  }
  return out;
}
const _q0 = new THREE.Quaternion(), _p0 = new V3(), _s0 = new V3();
function structBoxes(mb) {
  const st = [], sup = [];
  for (const P of mb.parts) {
    if (P.gid || P.g === U_TAPER) continue;
    P.m.decompose(_p0, _q0, _s0); if (Math.abs(_q0.x) > .03 || Math.abs(_q0.z) > .03) continue;   // pezzi inclinati (gambe dei tripodi, sartie): ingombro poco affidabile
    const b = partBox(P), sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
    if (b.max.y < .3) continue;   // carena e appendici
    if (sx > .9 && sz > .9) sup.push(b);
    if (sx > .9 && sz > .9 && sy > .8) st.push(b);
  }
  return { st, sup };
}
function declutter(mb, C, hd) {
  const L = C.L, { st, sup } = structBoxes(mb), tur = turretBoxes(C, hd).map(t => t.box), dY = z => hd.sheer(Math.min(1, Math.max(0, (z + L / 2) / L)));
  const groups = new Map(); for (const P of mb.parts) if (P.gid) { let g = groups.get(P.gid); if (!g) groups.set(P.gid, g = { parts: [], box: new THREE.Box3() }); g.parts.push(P); g.box.union(partBox(P)); }
  const kept = [], drop = new Set();
  const hit = (b, list) => list.some(o => o.intersectsBox(b));
  for (const [id, g] of groups) {
    const s = new V3(); g.box.getSize(s); const b = g.box.clone().expandByVector(s.multiplyScalar(-.06));
    const c = new V3(); g.box.getCenter(c);
    // appoggio: sul ponte o sopra una superficie che sta sotto il pezzo
    const onDeck = g.box.min.y <= dY(c.z) + .7, under = sup.some(o => c.x >= o.min.x && c.x <= o.max.x && c.z >= o.min.z && c.z <= o.max.z && Math.abs(o.max.y - g.box.min.y) < .45);
    const side = sup.some(o => o.min.y < c.y && o.max.y > c.y && (Math.abs(o.min.x - g.box.max.x) < .5 || Math.abs(o.max.x - g.box.min.x) < .5) && c.z > o.min.z && c.z < o.max.z);   // appeso al fianco di una tuga
    if (hit(b, st) || hit(b, tur) || hit(b, kept) || !(onDeck || under || side || g.box.max.y < dY(c.z))) drop.add(id); else kept.push(b);
  }
  if (drop.size) mb.parts = mb.parts.filter(P => !drop.has(P.gid));
  return drop.size;
}
// elenco dei conflitti fra pezzi grandi (per il controllo dal visualizzatore)
function shipAudit(C) {
  const hg = hullGeo2(C), mb = new MB(); _MT.length = 0; shipSuper(mb, C, hg.userData);
  const { st } = structBoxes(mb), tur = turretBoxes(C, hg.userData), out = [];
  tur.forEach((t, i) => { const b = t.body.clone().expandByScalar(-.15);
    st.forEach(o => { if (o.intersectsBox(b)) out.push(`torre ${t.S.name} a z=${t.z} x=${t.x} dentro un blocco z=${((o.min.z + o.max.z) / 2).toFixed(1)} y=${o.min.y.toFixed(1)}..${o.max.y.toFixed(1)}`); });
    tur.forEach((u, j) => { if (j > i && u.body.intersectsBox(b)) out.push(`torre a z=${t.z} x=${t.x} sovrapposta alla torre a z=${u.z} x=${u.x}`); }); });
  return out;
}
// solido a pianta poligonale con fianchi inclinati: pianta di base e pianta della cima ([x, z], convesse, stesso numero di punti),
// altezza h (da 0 a h); facce piane con le normali verso l'esterno
const _SLAB = new Map();
function slabGeo(base, top, h) {
  const key = JSON.stringify([base, top, h]); let g = _SLAB.get(key); if (g) return g;
  const n = base.length, P = [], cx = base.reduce((a, p) => a + p[0], 0) / n, cz = base.reduce((a, p) => a + p[1], 0) / n, C = new V3(cx, h / 2, cz);
  const B = base.map(([x, z]) => new V3(x, 0, z)), T = top.map(([x, z]) => new V3(x, h, z));
  const tri = (a, b, c) => { const nn = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)), m = new V3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(C); if (nn.dot(m) < 0) P.push(a, c, b); else P.push(a, b, c); };
  for (let i = 1; i < n - 1; i++) { tri(B[0], B[i], B[i + 1]); tri(T[0], T[i], T[i + 1]); }
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(B[i], B[j], T[j]); tri(B[i], T[j], T[i]); }
  g = new THREE.BufferGeometry(); g.setFromPoints(P); g.computeVertexNormals(); _SLAB.set(key, g); return g;
}
const _sc = (pts, sx, sz = sx, dz = 0) => pts.map(([x, z]) => [+(x * sx).toFixed(3), +(z * sz + dz).toFixed(3)]);
// canna rastremata (verso -z) con volata ingrossata
const U_TAPER = new THREE.CylinderGeometry(.78, 1, 1, 12);
function shBarrel(mb, x, y, z, r, len, c = 0x2b2e30) {
  mb.add(U_TAPER, c, x, y, z - len / 2, -PI / 2, 0, 0, r, len, r);
  mb.add(U.cyl12, c, x, y, z - len + r,  -PI / 2, 0, 0, r * 1.05, Math.min(.5, r * 2.5), r * 1.05);
  mb.add(U.cyl, 0x0c0d0e, x, y, z - len - .01, -PI / 2, 0, 0, r * .55, .03, r * .55);   // anima
}
// pianta delle torri dei grossi calibri per nazione (lato 1 = torre da ~7 m)
const TUR_PLAN = {
  us: { b: [[-3.4, -3.3], [3.4, -3.3], [3.8, -1.2], [3.8, 3.3], [3.3, 4.2], [-3.3, 4.2], [-3.8, 3.3], [-3.8, -1.2]], t: [[-3.1, -1.9], [3.1, -1.9], [3.5, -1], [3.5, 3.2], [3.1, 4], [-3.1, 4], [-3.5, 3.2], [-3.5, -1]] },
  de: { b: [[-2.6, -3.6], [2.6, -3.6], [3.8, -1.8], [3.8, 3.4], [2.8, 4.3], [-2.8, 4.3], [-3.8, 3.4], [-3.8, -1.8]], t: [[-2.3, -2.4], [2.3, -2.4], [3.3, -1.2], [3.3, 3.2], [2.6, 3.9], [-2.6, 3.9], [-3.3, 3.2], [-3.3, -1.2]] },
  jp: { b: [[-3.2, -3.4], [3.2, -3.4], [3.9, -1.4], [3.9, 2], [3.2, 3.6], [1.6, 4.4], [-1.6, 4.4], [-3.2, 3.6], [-3.9, 2], [-3.9, -1.4]], t: [[-2.9, -2.2], [2.9, -2.2], [3.4, -1.1], [3.4, 1.9], [2.9, 3.3], [1.5, 4], [-1.5, 4], [-2.9, 3.3], [-3.4, 1.9], [-3.4, -1.1]] },
};
// mitragliera binata/quadrinata Bofors (o 3,7 cm / 25 mm) in vasca con canne e paravampa
function shBofors(mb, x, y, z, c, n = 4, ry = 0) {
  mb.add(U.cyl12, c, x, y + .55, z, 0, 0, 0, 2, 1.1, 2);   // vasca
  mb.add(U.cyl12, 0x2a2d30, x, y + 1.11, z, 0, 0, 0, 1.85, .02, 1.85);
  mb.add(U.cyl12, 0x3a3e42, x, y + .9, z, 0, 0, 0, .7, .7, .7);   // basamento girevole
  const s = Math.sin(ry), co = Math.cos(ry), P = (dx, dz) => [x + dx * co + dz * s, z - dx * s + dz * co];
  let [px, pz] = P(0, .2); mb.add(U.box, 0x4a4f53, px, y + 1.55, pz, 0, ry, 0, .45 * n + .5, .7, 1.6);   // culla
  [px, pz] = P(0, -.55); mb.add(U.box, c, px, y + 1.6, pz, -.25, ry, 0, .45 * n + .9, 1, .08);   // scudo
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * .42; [px, pz] = P(dx, -1.4);
    mb.add(U.cyl, 0x222426, px, y + 1.95, pz, -PI / 2 + .32, ry, 0, .06, 2.4, .06);
    [px, pz] = P(dx, -2.55); mb.add(U.cone, 0x222426, px, y + 2.33, pz, -PI / 2 + .32, ry, 0, .1, .35, .1);
  }
  for (const e of [-1, 1]) { [px, pz] = P(e * (.25 * n + .6), .5); mb.add(U.box, 0x2c3034, px, y + 1.3, pz, 0, ry, 0, .35, .12, .5); }   // seggiolini dei puntatori
}
// mitragliera da 20 mm Oerlikon: colonnina, scudo curvo, canna col caricatore a tamburo
function shOerlikon(mb, x, y, z, ry = 0) {
  mb.add(U.cyl, 0x3a3e42, x, y + .55, z, 0, 0, 0, .12, 1.1, .12);
  const s = Math.sin(ry), co = Math.cos(ry), P = (dx, dz) => [x + dx * co + dz * s, z - dx * s + dz * co];
  let [px, pz] = P(0, -.25); mb.add(U.box, 0x6d757b, px, y + 1.2, pz, -.15, ry, 0, .9, .75, .05);
  [px, pz] = P(0, -.8); mb.add(U.cyl, 0x222426, px, y + 1.35, pz, -PI / 2 + .3, ry, 0, .04, 1.6, .04);
  [px, pz] = P(0, -.15); mb.add(U.cyl12, 0x2a2c2e, px, y + 1.55, pz, 0, 0, 0, .2, .12, .2);
}
// sotto la linea d'acqua: alette di rollio, assi con braccioli, eliche e timoni
function shipUnderwater(mb, C, hd) {
  const L = C.L, B = C.B, D = C.D, pt = C.type === 'pt';
  const ns = C.screws || { bb: 4, cl: 4, cv: 4, dd: 2, pt: 3, cargo: 1 }[C.type] || 2;
  const dark = 0x3b1d1a, bronze = 0x7a6235;
  // alette di rollio lungo il ginocchio di sentina
  if (!pt) for (const sd of [-1, 1]) for (let k = 0; k < 12; k++) {
    const t = .3 + k * .4 / 12, z = -L / 2 + (t + .4 / 24) * L, w = hd.hw(t), dk = hd.df(t);
    mb.add(U.box, dark, sd * w * .82, -D * .74 * dk - D * .04, z, 0, 0, sd * .75, .12, D * .14, L * .4 / 12 + .05);   // a filo della carena (sezione a 0,82 della mezza larghezza)
  }
  const zp = L * (pt ? .42 : C.type === 'cargo' ? .45 : .38), tP = (zp + L / 2) / L, dP = D * hd.df(tP), R = pt ? .5 : Math.min(dP * .42, C.type === 'bb' ? 2.6 : C.type === 'cargo' ? 2.8 : 1.9);
  const xs = ns === 1 ? [0] : ns === 2 ? [-1, 1].map(s => s * hd.hw(tP) * .45) : ns === 3 ? [-1, 0, 1].map(s => s * hd.hw(tP) * .55) : [-1, -.45, .45, 1].map(s => s * hd.hw(tP) * .7);
  for (const x of xs) {
    // fondo dello scafo sotto l'elica: l'elica sta appena sotto la carena, senza scendere oltre la chiglia
    const f = Math.min(1, Math.abs(x) / Math.max(.1, hd.hw(tP))), hb = f > .86 ? -.45 - (1 - f) / .14 * (.72 * dP - .45) : f > .35 ? -.72 * dP - (.86 - f) / .51 * .25 * dP : -.97 * dP - (.35 - f) / .35 * .03 * dP;
    const yp = pt ? -D * .9 : Math.max(-D + R * .9, hb - R * .95);
    if (x !== 0 || ns === 3 && x === 0) {
      const z0 = zp - L * (pt ? .15 : .12); mb.between(new V3(x * .7, -D * .55 * hd.df((z0 + L / 2) / L), z0), new V3(x, yp, zp - R * .4), pt ? .07 : R * .09, 0x6a5a40);   // asse
      mb.between(new V3(x, yp, zp - R * .9), new V3(x * .5, -D * .2 * hd.df(tP) - 1, zp - R * .9), pt ? .05 : R * .06, dark);   // bracciolo
    }
    mb.add(U.cone, bronze, x, yp, zp + R * .05, PI / 2, 0, 0, R * .18, R * .5, R * .18);   // ogiva del mozzo
    const nb = C.type === 'bb' || C.type === 'cv' ? 4 : 3;
    for (let b = 0; b < nb; b++) { const a = b * TAU / nb + (x > 0 ? .3 : 0); mb.add(U.box, bronze, x + Math.cos(a) * R * .52, yp + Math.sin(a) * R * .52, zp - R * .1, 0, .35, a, R * .9, R * .1, R * .42); }
  }
  // timoni: uno centrale, due per corazzate e portaerei con quattro eliche
  const rz = zp + R * 1.3, dR = D * hd.df(Math.min(1, (rz + L / 2) / L)), rh = pt ? .9 : Math.max(2, Math.min(dP * .85, 8)), rx = ns === 4 ? [-1, 1].map(s => s * hd.hw(tP) * .25) : [0];
  for (const x of rx) mb.add(U.box, dark, x, -rh / 2 - (pt ? .3 : Math.max(.3, dR * .35)), Math.min(rz, L / 2 - .3), 0, 0, 0, pt ? .1 : Math.max(.35, B * .015), rh, pt ? .7 : Math.max(2, L * .022));
}
// tavolato del ponte di coperta: trama di tavole e giunti di testa
let _DECK_TEX = null;
function deckTexture() {
  if (_DECK_TEX) return _DECK_TEX;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1024; const x = cv.getContext('2d');
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) { const off = (i * 397 % 4) * 64, y0 = (j * 256 + off) % 1024, v = 185 + ((i * 53 + j * 31) % 40); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i * 16, y0, 16, 256); x.fillStyle = '#5a5a5a'; x.fillRect(i * 16, y0, 16, 2); }
    x.fillStyle = '#4a4a4a'; x.fillRect(i * 16, 0, 1.5, 1024);   // comento fra le tavole
  }
  for (let k = 0; k < 2200; k++) { const v = 150 + Math.random() * 90 | 0; x.fillStyle = `rgba(${v},${v},${v},.25)`; x.fillRect(Math.random() * 256, Math.random() * 1024, 1, 4 + Math.random() * 18); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding;
  return _DECK_TEX = t;
}
function deckMesh(C, hd) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, N = 60, pos = [], uv = [], idx = [], W = 6, plank = C.type === 'pt' ? .12 : .16;
  for (let k = 0; k <= N; k++) { const t = k / N, y = hd.sheer(t) + .03, w = hd.hw(t) * (t < .3 ? 1 + (C.type === 'pt' ? .05 : .16) * (1 - t / .3) : 1) * .985;
    for (let j = 0; j <= W; j++) { const xx = -w + 2 * w * j / W, z = hd.zAt(t, y); pos.push(xx, y, z); uv.push(xx / (plank * 16), z / 12); } }
  for (let k = 0; k < N; k++) for (let j = 0; j < W; j++) { const a = k * (W + 1) + j, b = a + 1, c = a + W + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const tone = { us: 0x515c68, de: 0x9e8c72, jp: 0x8e7d63, x: 0x7d6d58 }[C.nat] || 0x8a765a;
  const m = new THREE.MeshStandardMaterial({ map: deckTexture(), color: new THREE.Color(tone).convertSRGBToLinear(), roughness: .92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.userData.base = m.color.clone(); const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; return mesh;
}
// fumaiolo: corpo ovale con fascia e cappello scuro
function shFunnel(mb, x, y, z, w, l, h, c, cap, rake = 0) {
  mb.add(U.cyl12, c, x, y + h / 2, z, rake, 0, 0, w / 2, h, l / 2);
  mb.add(U.cyl12, cap, x, y + h + .25 - Math.sin(rake) * 0, z + Math.sin(rake) * h / 2, rake, 0, 0, w / 2 * 1.04, .9, l / 2 * 1.04);
  mb.add(U.cyl12, 0x1b1d1f, x, y + h + .55, z + Math.sin(rake) * h / 2, rake, 0, 0, w / 2 * .82, .4, l / 2 * .82);
}
// albero a palo con pennone e radar
const _MT = [];
function shMast(mb, x, y, z, h, c, yard = 6, radar = 0) {
  _MT.push(new V3(x, y + h, z));
  mb.add(U.cyl, c, x, y + h / 2, z, 0, 0, 0, .28, h, .28);
  mb.add(U.cyl, c, x, y + h * .78, z, 0, 0, PI / 2, .1, yard, .1);
  if (radar) { mb.add(U.box, 0x2c3034, x, y + h + radar * .3, z, 0, 0, 0, radar, radar * .6, .2); mb.add(U.cyl, c, x, y + h + .2, z, 0, 0, 0, .12, .6, .12); }
}
// albero a tripode con coffa (corazzate americane)
function shTripod(mb, x, y, z, h, c, top) {
  _MT.push(new V3(x, y + h + 10, z));
  const t = new V3(x, y + h, z);
  mb.between(new V3(x, y, z - 2.2), t, .45, c); mb.between(new V3(x - 2.4, y, z + 1.6), t, .38, c); mb.between(new V3(x + 2.4, y, z + 1.6), t, .38, c);
  mb.add(U.cyl12, top, x, y + h + 1.2, z, 0, 0, 0, 2.8, 2.6, 2.8); mb.add(U.cyl12, top, x, y + h + 3.4, z, 0, 0, 0, 2, 1.8, 2);
  mb.add(U.cyl, c, x, y + h + 7, z, 0, 0, 0, .18, 6, .18);
}
// direttore del tiro con telemetro
function shDirector(mb, x, y, z, s, c) { mb.add(U.box, c, x, y + s * .5, z, 0, 0, 0, s * 1.6, s, s * 1.4); mb.add(U.cyl, 0x2a2e31, x, y + s * .6, z, 0, 0, PI / 2, s * .16, s * 3.2, s * .16); mb.add(U.box, 0x2c3034, x, y + s * 1.25, z, 0, 0, 0, s * 1.3, s * .5, s * .3); }
// lancia di salvataggio sulle selle
function shBoat(mb, x, y, z, l, base) { clut(mb, () => shBoat0(mb, x, y, z, l, base)); }
function shBoat0(mb, x, y, z, l, base) {
  mb.add(U.sph, 0x8e918c, x, y + .7, z, 0, 0, 0, l * .11, .7, l * .5); mb.add(U.box, 0x6f7068, x, y + 1.15, z, 0, 0, 0, l * .17, .12, l * .78); mb.add(U.box, 0x8e918c, x, y + 1.25, z, 0, 0, 0, l * .04, .14, l * .7);
  for (const e of [-1, 1]) { mb.add(U.box, 0x3a3e40, x, y + .15, z + e * l * .3, 0, 0, 0, l * .26, .3, .25); if (base !== undefined && y - base > .4) mb.add(U.cyl, 0x4a4e52, x, (y + base) / 2, z + e * l * .3, 0, 0, 0, .12, y - base, .12); }
}
// impianto antiaereo: vasca con canne
function shAA(mb, x, y, z, c, n = 4) { clut(mb, () => shBofors(mb, x, y, z, c, n === 3 ? 3 : n >= 4 ? 4 : 2, x > 0 ? -PI / 2 : x < 0 ? PI / 2 : 0)); }
// tubi lanciasiluri: affusto girevole con i tubi affiancati
function shTubes(mb, x, y, z, n, c) { mb.add(U.cyl12, c, x, y + .35, z, 0, 0, 0, 1.4, .7, 1.4); for (let i = 0; i < n; i++) mb.add(U.cyl, 0x4a5056, x - .55 * (n - 1) / 2 + i * .55, y + 1.1, z, PI / 2, 0, 0, .27, 7.2, .27); }

// ---------- sovrastrutture per classe ----------
function shipSuper(mb, C, hg) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, B = C.B, u = pal.upper, dk = pal.dark, mt = pal.metal;
  const deckY = z => hg.sheer((z + L / 2) / L);
  // ancore e catene sul castello di prua
  if (C.type !== 'pt') for (const sd of [-1, 1]) { mb.add(U.box, 0x1d1f21, sd * (hg.hw(.06) + .1), deckY(-L * .44) - 1.5, -L * .44, 0, 0, sd * .3, .3, 1.6, 1.2); mb.add(U.cyl, 0x2a2c2e, sd * 1.2, deckY(-L * .4) + .15, -L * .4, PI / 2, 0, 0, .2, L * .08, .2); }
  if (C.type === 'cv') {
    // portaerei: ponte di volo in legno su piloni, isola sul lato, aerei parcheggiati a poppa, antiaeree in sponsoni
    const F = C.F, fy = F + 7, fl = L * .94;
    mb.mat = 'wood'; mb.add(U.box, 0x8f877a, 0, fy, L * .01, 0, 0, 0, B * 1.08, .8, fl);
    for (let z = -fl / 2 + 6; z < fl / 2; z += 12) mb.add(U.box, 0x8a7656, 0, fy + .42, z, 0, 0, 0, B * 1.06, .02, .12);   // giunti del ponte
    mb.mat = 'vc';
    mb.add(U.box, 0xd8d4c4, 0, fy + .43, L * .01, 0, 0, 0, .4, .02, fl * .9);   // linea centrale
    mb.add(U.cyl12, 0xb02a24, 0, fy + .44, -fl * .3, 0, 0, 0, B * .3, .02, B * .3);   // cerchio rosso (hinomaru) a prua
    for (let z = -fl / 2 + 15; z < fl / 2 - 10; z += 22) for (const sd of [-1, 1]) mb.add(U.box, u, sd * B * .42, (F + fy) / 2, z, 0, 0, 0, 1.4, fy - F, 1.4);   // piloni
    mb.add(U.box, u, 0, F + 3, 0, 0, 0, 0, B * .7, 6, L * .8);   // hangar
    const ix = B * .52, iz = -L * .08;
    mb.add(U.box, u, ix, fy + 4, iz, 0, 0, 0, 4, 8, 14); mb.add(U.box, 0x223040, ix, fy + 7, iz - 7.05, 0, 0, 0, 3.6, .8, .1); shMast(mb, ix, fy + 8, iz + 3, 10, mt, 6, 2.5);
    shFunnel(mb, B * .58, F + 2, L * .02, 4, 6, 9, u, dk, .7);
    for (let i = 0; i < 9; i++) { const z = fl * .18 + i * 9, x = (i % 3 - 1) * 8, y = fy + .9; mb.add(U.box, 0x6e7a5c, x, y, z, 0, 0, 0, 1.2, .9, 8); mb.add(U.box, 0x6e7a5c, x, y + .2, z - 1, 0, 0, 0, 11, .25, 2); mb.add(U.box, 0x6e7a5c, x, y + .3, z + 3.3, 0, 0, 0, 4, .2, 1.2); mb.add(U.box, 0xb02a24, x + 3.5, y + .36, z - 1, 0, 0, 0, .9, .02, .9); mb.add(U.box, 0xb02a24, x - 3.5, y + .36, z - 1, 0, 0, 0, .9, .02, .9); }
    for (const sd of [-1, 1]) for (const z of [-L * .3, -L * .1, L * .12, L * .3]) shAA(mb, sd * B * .58, fy - 2, z, u, 3);
    for (const G of C.guns) for (const [x, y, z] of G.mounts) { const w = Math.abs(x) - hg.hw((z + L / 2) / L) + 3; mb.add(U.box, u, Math.sign(x) * (Math.abs(x) - w / 2 + 1.5), y - 1.6, z, 0, 0, 0, w, 1.2, 6); mb.add(U.box, u, Math.sign(x) * (Math.abs(x) - w / 2 + 1.5), y - 3.2, z, 0, 0, 0, w * .6, 2.2, 1.2); }   // sponsoni
    return;
  }
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
    for (const sd of [-1, 1]) mb.add(U.cyl12, 0x4a4e52, sd * 2, F + .55, -3, 0, 0, 0, .6, .5, .6);
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
  if (C.style === 'kongo') {
    // classe Kongo ricostruita: pagoda a ripiani (~30 m sul ponte) con telemetro e direttore in cima, fumaiolo prodiero grande e inclinato,
    // secondo fumaiolo più piccolo, albero a tripode di poppa, catapulta e gru fra le torri di poppa, mitragliere da 25 mm sui ripiani
    const zb = -L * .17;
    mb.add(U.box, u, 0, F + 3, zb + L * .025, 0, 0, 0, B * .5, 6, L * .1);
    const lv = [[B * .4, L * .05, 4.5], [B * .34, L * .044, 4], [B * .3, L * .04, 4], [B * .26, L * .036, 3.5], [B * .22, L * .032, 3.2], [B * .18, L * .028, 3]];
    let y = F + 6;
    lv.forEach(([w, l, h], k) => {
      mb.add(U.box, u, 0, y + h / 2, zb + k * .4, 0, 0, 0, w, h, l);
      if (k % 2 === 1) { mb.add(U.box, dk, 0, y + h + .12, zb + k * .4, 0, 0, 0, w * 1.4, .24, l * 1.2); for (const sd of [-1, 1]) shAA(mb, sd * w * .6, y + h, zb + k * .4 + l * .2, u, 3); }
      if (k === 4) mb.add(U.box, 0x223040, 0, y + h * .55, zb + k * .4 - l / 2 - .02, 0, 0, 0, w * .95, .9, .1);   // plancia
      y += h;
    });
    mb.add(U.cyl, 0x2a2e31, 0, y + 1.2, zb + 2.6, 0, 0, PI / 2, .7, B * .34, .7); mb.add(U.box, u, 0, y + 1.2, zb + 2.6, 0, 0, 0, 2.6, 2.4, 2.4);   // telemetro da 8 m
    shDirector(mb, 0, y + 2.6, zb + 2.6, 1.8, u); shMast(mb, 0, y + 4.4, zb + 3.2, 7, mt, 6, 2);
    mb.add(U.box, u, 0, F + 2.5, -L * .02, 0, 0, 0, B * .5, 5, L * .16);   // tuga fra i fumaioli
    shFunnel(mb, 0, F + 4, -L * .065, B * .25, B * .36, 15, u, dk, .2);
    shFunnel(mb, 0, F + 4, L * .025, B * .2, B * .28, 12, u, dk, .12);
    shTripod(mb, 0, F + 5, L * .085, 13, mt, u); shDirector(mb, 0, F + 23, L * .085, 1.6, u);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .2, F + 5, -L * .02, 11, F); shBoat(mb, sd * B * .2, F + 5, L * .04, 9, F); shAA(mb, sd * B * .36, F + 5, -L * .09, u, 2); shAA(mb, sd * B * .36, F + 5, L * .05, u, 2); }
    for (const sd of [-1, 1]) mb.add(U.box, 0x55595c, sd * B * .14, F + 2.2, L * .27, 0, sd * .25, 0, 1.6, .7, 19);   // catapulta
    mb.add(U.cyl, mt, 0, F + 2, L * .3, 0, 0, 0, .6, 4, .6); mb.between(new V3(0, F + 4, L * .3), new V3(-B * .32, F + 14, L * .28), .32, mt);   // gru degli idrovolanti
    return;
  }
  if (C.style === 'pagoda') {
    // stile giapponese: torre a pagoda alta a ripiani sporgenti con telemetri enormi in cima, fumaiolo unico inclinato a poppavia,
    // albero a tripode di poppa, hangar con catapulte e gru; antiaeree in vasche sui ripiani
    const zb = -L * .14, H0 = F + 2;
    mb.add(U.box, u, 0, H0 + 4, zb + L * .04, 0, 0, 0, B * .6, 8, L * .18);
    const lv = [[B * .5, L * .1, 8], [B * .44, L * .085, 8], [B * .38, L * .07, 7], [B * .32, L * .06, 7], [B * .27, L * .052, 6.5], [B * .23, L * .046, 6], [B * .2, L * .04, 5.5]];
    let y = H0 + 8;
    lv.forEach(([w, l, h], k) => {
      mb.add(U.box, u, 0, y + h / 2, zb + k * .6, 0, 0, 0, w, h, l);
      if (k % 2 === 0) { mb.add(U.box, dk, 0, y + h + .15, zb + k * .6, 0, 0, 0, w * 1.35, .3, l * 1.15); for (const sd of [-1, 1]) shAA(mb, sd * w * .62, y + h, zb + k * .6, u, 3); }   // ripiani sporgenti
      if (k === 3) mb.add(U.box, 0x223040, 0, y + h * .6, zb + k * .6 - l / 2, 0, 0, 0, w * .95, 1, .1);   // finestre di plancia
      y += h;
    });
    mb.add(U.cyl, 0x2a2e31, 0, y + 1.5, zb + 3, 0, 0, PI / 2, 1.1, B * .55, 1.1); mb.add(U.box, u, 0, y + 1.5, zb + 3, 0, 0, 0, B * .16, 3.4, B * .14);   // telemetro principale
    mb.add(U.cyl, 0x2a2e31, 0, y + 4.5, zb + 3, 0, 0, PI / 2, .8, B * .35, .8); mb.add(U.box, u, 0, y + 4.5, zb + 3, 0, 0, 0, B * .11, 2.4, B * .1);
    shMast(mb, 0, y + 6, zb + 4, 10, mt, 8, 4);
    // fumaiolo unico, grande e inclinato verso poppa
    shFunnel(mb, 0, F + 4, L * .06, B * .34, B * .5, 34, u, dk, .32);
    mb.add(U.box, u, 0, F + 5, L * .17, 0, 0, 0, B * .36, 10, L * .07); shDirector(mb, 0, F + 10, L * .17, 4, u);
    shTripod(mb, 0, F + 10, L * .2, 16, mt, u);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .2, F + 9, L * .1, 12, F); for (const z of [-L * .02, L * .26]) shAA(mb, sd * B * .4, F, z, u, 3); }
    mb.add(U.box, u, 0, F + 2.5, L * .44, 0, 0, 0, B * .5, 5, L * .05);   // hangar
    for (const sd of [-1, 1]) mb.add(U.box, 0x55595c, sd * B * .3, F + 5.4, L * .43, 0, sd * .4, 0, 2, .8, 24);   // catapulte
    mb.add(U.cyl, mt, 0, F + 5, L * .46, 0, 0, 0, .8, 4, .8); mb.between(new V3(0, F + 7, L * .46), new V3(-B * .3, F + 18, L * .44), .4, mt);
    return;
  }
  if (C.style === 'modern') {
    // super corazzata: torre di plancia alta a gradoni (stile Iowa), torre corazzata, due fumaioli alti, albero a tripode con radar
    const zb = -L * .16;
    mb.add(U.cyl12, u, 0, F + 4, zb - 9, 0, 0, 0, 5, 8, 5);
    for (let k = 0; k < 5; k++) mb.add(U.box, u, 0, F + 3 + k * 5, zb + k * .5, 0, 0, 0, B * (.5 - k * .06), 5, L * (.09 - k * .011));
    mb.add(U.box, 0x223040, 0, F + 24, zb - L * .03, 0, 0, 0, B * .24, 1, .1);
    shDirector(mb, 0, F + 28, zb + 2, 3.6, u); shMast(mb, 0, F + 32, zb + 8, 20, mt, 14, 5);
    shFunnel(mb, 0, F + 4, -L * .06, B * .2, B * .26, 18, u, dk); shFunnel(mb, 0, F + 4, L * .06, B * .2, B * .26, 16, u, dk);
    mb.add(U.box, u, 0, F + 5, L * .14, 0, 0, 0, B * .4, 10, L * .07); shDirector(mb, 0, F + 10, L * .14, 3, u); shMast(mb, 0, F + 10, L * .17, 16, mt, 9, 3);
    for (const sd of [-1, 1]) { shBoat(mb, sd * B * .18, F + 9, -L * .01, 10, F); shAA(mb, sd * B * .38, F, -L * .25, u); shAA(mb, sd * B * .4, F, L * .22, u); shAA(mb, sd * B * .3, F + 10, L * .1, u); }
    mb.add(U.cyl, mt, 0, F + 1, L * .45, 0, 0, 0, .7, 2.5, .7); mb.between(new V3(0, F + 2.5, L * .45), new V3(B * .3, F + 12, L * .42), .35, mt);
    return;
  }
  if (C.type === 'cl') {
    // incrociatore: torre di plancia alta con direttori e radar, fumaioli, albero di poppa, gru e catapulte a poppa
    const zb = -L * .125;
    mb.add(U.box, u, 0, F + 3.5, zb, 0, 0, 0, B * .42, 7, L * .08);
    mb.add(U.box, u, 0, F + 9, zb + L * .01, 0, 0, 0, B * .38, 4, L * .07); mb.add(U.box, 0x223040, 0, F + 9.6, zb - L * .025 - .02, 0, 0, 0, B * .36, .9, .1);
    mb.add(U.box, u, 0, F + 12.5, zb, 0, 0, 0, B * .3, 3, L * .05);
    shDirector(mb, 0, F + 14, zb, 2.4, u); shMast(mb, 0, F + 14, zb + L * .045, 18, mt, 10, 4);
    if (de) shFunnel(mb, 0, F, -L * .04, B * .28, B * .4, 10, u, dk);
    else { shFunnel(mb, 0, F, -L * .07, B * .24, B * .3, 11, u, dk); shFunnel(mb, 0, F, L * .02, B * .24, B * .3, 11, u, dk); }
    mb.add(U.box, u, 0, F + 3, L * .12, 0, 0, 0, B * .48, 6, L * .08); shDirector(mb, 0, F + 6, L * .12, 2, u); shMast(mb, 0, F + 6, L * .15, 12, mt, 7, 2.5);
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
  shFunnel(mb, 0, F + 2, -L * .06, B * .26, B * .34, 13, u, dk);
  mb.add(U.box, u, 0, F + 2.5, -L * .02, 0, 0, 0, B * .62, 5, L * .12);   // tuga del ponte lance
  shTripod(mb, 0, F + 5, L * .065, 14, u, u); shDirector(mb, 0, F + 24, L * .065, 1.8, u);
  for (const sd of [-1, 1]) { for (const z of [-L * .09, -L * .035, L * .01]) shBoat(mb, sd * B * .22, F + 5, z, 9, F); shAA(mb, sd * B * .38, F + 5, -L * .12, u); shAA(mb, sd * B * .4, F, L * .2, u); }
  mb.add(U.cyl, mt, 0, F + 5, -L * .01, 0, 0, 0, .6, 3, .6); mb.between(new V3(0, F + 6.5, -L * .01), new V3(-B * .3, F + 14, L * .01), .3, mt);   // gru delle lance
}
// torre: barbetta, casa con fronte inclinata, telemetro a orecchie (grossi calibri) o impianto chiuso (127 mm)
function shTurret(tm, S, sz, c, nat, drop = 0, n = 2, casemate = false) {
  const br = (S.cal >= 140 ? 4.3 : S.cal >= 100 ? 2 : .8) * Math.max(sz, .5);
  if (casemate) { tm.add(U.box, c, 0, .1, .6, 0, 0, 0, 1.8, 1.6, 1.4); tm.add(U.box, 0x1a1c1e, 0, .1, -.12, 0, 0, 0, 1.1, 1.1, .06); return; }   // casamatta nel fianco: solo lo scudo
  if (drop > 1) tm.add(U.cyl12, c, 0, -drop / 2, .4 * sz, 0, 0, 0, br, drop, br);
  if (S.cal >= 140) {
    const P = TUR_PLAN[nat] || TUR_PLAN.us, w = n >= 3 ? 1.16 : 1, k = sz, sp = S.cal / 1000 * 5.2;
    tm.add(U.cyl12, c, 0, -1.4 * k, .4 * k, 0, 0, 0, 4.6 * k * w, 2.4 * k, 4.6 * k);
    tm.add(slabGeo(_sc(P.b, k * w, k), _sc(P.t, k * w, k), 3.1 * k), c, 0, -1.15 * k, .5 * k);   // casa della torre con fronte e fianchi inclinati
    for (let i = 0; i < n; i++) tm.add(U.box, 0x1a1c1e, (i - (n - 1) / 2) * sp, .25 * k, -2.55 * k, -.42, 0, 0, sp * .55, 1.5 * k, .12);   // feritoie dei cannoni
    if (nat === 'us') { for (const e of [-1, 1]) tm.add(U.box, c, e * 2.6 * k * w, 2.15 * k, -.9 * k, 0, 0, 0, .9 * k, .5 * k, 1.4 * k); tm.add(U.cyl, 0x2c3034, 0, 2.1 * k, 2.6 * k, 0, 0, 0, .35 * k, .5 * k, .35 * k); }   // cappucci di mira
    if (nat === 'jp') tm.add(U.box, c, 0, 2.15 * k, 3.2 * k, 0, 0, 0, 2.2 * k, .6 * k, 1.2 * k);
    if (S.cal >= 200 || nat !== 'us') { const rl = (nat === 'de' ? 10.5 : nat === 'jp' ? 11.5 : 9) * k * w; tm.add(U.cyl, c, 0, 1.5 * k, 2.7 * k, 0, 0, PI / 2, .5 * k, rl, .5 * k); for (const sd of [-1, 1]) tm.add(U.cyl12, c, sd * rl / 2, 1.5 * k, 2.7 * k, 0, 0, PI / 2, .7 * k, .8 * k, .7 * k); }   // telemetro a orecchie
    tm.add(U.box, 0x3a3e42, 0, 1.98 * k, 3.9 * k, 0, 0, 0, 1.6 * k, .1 * k, .5 * k);   // portello di poppa
  } else if (S.cal >= 100) {
    // impianto chiuso da 12,7 cm: scudo poligonale con fronte e fianchi smussati
    const w = n >= 2 ? 1.2 : 1, b = [[-1.4, -2.4], [1.4, -2.4], [1.8, -1.1], [1.8, 2.6], [-1.8, 2.6], [-1.8, -1.1]], t = [[-1.15, -1.5], [1.15, -1.5], [1.55, -.8], [1.55, 2.4], [-1.55, 2.4], [-1.55, -.8]];
    tm.add(U.cyl12, c, 0, -.65, 0, 0, 0, 0, 2.1 * w, .5, 2.1);
    tm.add(slabGeo(_sc(b, w, 1), _sc(t, w, 1), 2.55), c, 0, -.45, .2);
    for (let i = 0; i < n; i++) tm.add(U.box, 0x1a1c1e, (i - (n - 1) / 2) * .64, .55, -1.85, -.75, 0, 0, .42, 1.2, .08);
    for (const e of [-1, 1]) tm.add(U.box, c, e * .95 * w, 2.2, -.6, 0, 0, 0, .6, .35, .8);   // cappucci dei puntatori
    tm.add(U.box, 0x2a2e31, 0, 1.9, 2.55, 0, 0, 0, 1.6, 1, .08);   // portello posteriore
  } else if (S.cal >= 30) {
    tm.add(U.cyl12, c, 0, -.35, 0, 0, 0, 0, 1.7, .5, 1.7); tm.add(U.cyl12, 0x3e4245, 0, -.05, .2, 0, 0, 0, .6, .5, .6);
    tm.add(U.box, 0x4a4f53, 0, .05, .3, 0, 0, 0, .4 * n + .5, .55, 1.4); tm.add(U.box, c, 0, .25, -.5, -.25, 0, 0, .4 * n + .9, .9, .07);
    for (const e of [-1, 1]) tm.add(U.box, 0x2c3034, e * (.22 * n + .6), -.1, .6, 0, 0, 0, .35, .1, .45);
  } else { tm.add(U.cyl, 0x3e4245, 0, -.4, 0, 0, 0, 0, .12, .8, .12); tm.add(U.box, 0x6d757b, 0, .1, -.25, -.15, 0, 0, .8 * Math.max(1, n * .7), .7, .05); tm.add(U.cyl12, 0x2a2c2e, 0, .25, .15, 0, 0, 0, .18, .12, .18); }
}
// ---------- texture generate dal codice: lamiera navale invecchiata ----------
// mappa colore quasi bianca (si moltiplica per i colori della mimetica) con giunti delle lamiere, saldature, file di rivetti,
// colature di ruggine e sporco; nel canale alfa la ruvidezza; normal map ricavata dai rilievi
let _PLATE = null;
function shipPlateTex() {
  if (_PLATE) return _PLATE;
  const N = 512, col = new Float32Array(N * N * 3).fill(1), hgt = new Float32Array(N * N).fill(.5), rough = new Float32Array(N * N).fill(.72);
  let seed = 7; const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const id = (x, y) => ((y + N) % N) * N + ((x + N) % N);
  // rumore a bassa frequenza (lamiere leggermente ondulate e tinte non uniformi)
  const G = 16, grid = []; for (let i = 0; i < G * G; i++) grid.push(rr());
  const vn = (x, y, s) => { const fx = x / N * s, fy = y / N * s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, g = (a, b) => grid[((b % s + s) % s) * G + ((a % s + s) % s)], sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (g(ix, iy) * (1 - sx) + g(ix + 1, iy) * sx) * (1 - sy) + (g(ix, iy + 1) * (1 - sx) + g(ix + 1, iy + 1) * sx) * sy; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = id(x, y), n = vn(x, y, 4) * .6 + vn(x, y, 16) * .4, f = .93 + n * .1 + (rr() - .5) * .025;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f; hgt[i] = .5 + (vn(x, y, 8) - .5) * .25; rough[i] = .62 + n * .2;
  }
  // corsi di lamiera: giunti orizzontali ogni 128 px (~1,5 m), giunti verticali sfalsati ogni 256 px
  const seam = (x, y) => { const i = id(x, y); hgt[i] = .15; col[i * 3] *= .72; col[i * 3 + 1] *= .72; col[i * 3 + 2] *= .72; };
  for (let r = 0; r < 4; r++) {
    const y0 = r * 128;
    for (let x = 0; x < N; x++) { seam(x, y0); hgt[id(x, y0 + 1)] = .62; hgt[id(x, y0 - 1)] = .4; }   // giunto con bordo sovrapposto
    const off = (r % 2) * 128; for (const xs of [off, off + 256]) for (let y = y0; y < y0 + 128; y++) { seam(xs, y); hgt[id(xs + 1, y)] = .6; }
    for (let x = 4; x < N; x += 10) for (const yy of [y0 + 5, y0 - 5]) { const i = id(x, yy); hgt[i] = .9; hgt[id(x + 1, yy)] = .8; hgt[id(x, yy + 1)] = .8; }   // rivetti
  }
  // colature di ruggine dai giunti e dai rivetti verso il basso (la v cresce verso l'alto)
  for (let k = 0; k < 34; k++) {
    let x = rr() * N | 0; const y0 = (rr() * 4 | 0) * 128 + (rr() < .5 ? -3 : 3), len = 12 + rr() * 110 * rr(), w = .5 + rr() * 2, a0 = .1 + rr() * .3;
    for (let d = 0; d < len; d++) { const a = a0 * Math.pow(1 - d / len, 1.6); if (rr() < .08) x += rr() < .5 ? -1 : 1;
      for (let o = -w; o <= w; o++) { const i = id(x + Math.round(o), y0 - d), e = a * (1 - Math.abs(o) / (w + 1)); col[i * 3] *= 1 - e * .25; col[i * 3 + 1] *= 1 - e * .5; col[i * 3 + 2] *= 1 - e * .68; rough[i] = Math.min(1, rough[i] + e * .5); } }
  }
  // macchie di ruggine e vernice scrostata
  for (let k = 0; k < 16; k++) { const cx = rr() * N, cy = rr() * N, r = 1.5 + rr() * 4, rust = rr() < .5;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d > 1 || rr() < d * .6) continue; const i = id(Math.round(cx + x), Math.round(cy + y));
      if (rust) { col[i * 3] *= .9; col[i * 3 + 1] *= .76; col[i * 3 + 2] *= .64; rough[i] = 1; hgt[i] -= .08; } else { col[i * 3] *= 1.05; col[i * 3 + 1] *= 1.05; col[i * 3 + 2] *= 1.06; hgt[i] -= .05; } } }
  // ritocchi di vernice più freschi (rettangoli leggermente diversi)
  for (let k = 0; k < 10; k++) { const x0 = rr() * N | 0, y0 = rr() * N | 0, w = 20 + rr() * 60 | 0, h = 10 + rr() * 40 | 0, t = .96 + rr() * .08;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = id(x, y); col[i * 3] *= t; col[i * 3 + 1] *= t; col[i * 3 + 2] *= t * 1.01; } }
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d'), im = cx.createImageData(N, N);
  const cn = document.createElement('canvas'); cn.width = cn.height = N; const nx = cn.getContext('2d'), nm = nx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = id(x, y), o = ((N - 1 - y) * N + x) * 4;
    for (let c = 0; c < 3; c++) im.data[o + c] = Math.max(0, Math.min(255, col[i * 3 + c] * 255));
    im.data[o + 3] = 255;
    const dx = (hgt[id(x + 1, y)] - hgt[id(x - 1, y)]) * 3, dy = (hgt[id(x, y + 1)] - hgt[id(x, y - 1)]) * 3, l = Math.hypot(dx, dy, 1);
    nm.data[o] = (-dx / l * .5 + .5) * 255; nm.data[o + 1] = (dy / l * .5 + .5) * 255; nm.data[o + 2] = (1 / l * .5 + .5) * 255; nm.data[o + 3] = Math.max(150, rough[i] * 255);
  }
  // ruvidezza nel canale alfa della mappa colore (letta dal materiale triplanare)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = ((N - 1 - y) * N + x) * 4; im.data[o + 3] = Math.max(150, Math.min(255, rough[id(x, y)] * 255)); }
  cx.putImageData(im, 0, 0); nx.putImageData(nm, 0, 0);
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.premultiplyAlpha = false; if (srgb) t.encoding = THREE.sRGBEncoding; t.generateMipmaps = true; return t; };
  return _PLATE = { map: mk(cv, true), normal: mk(cn, false) };
}
let _SHIPMAT = null;
function shipPlateMat() {
  if (!_SHIPMAT) _SHIPMAT = triMaterial(shipPlateTex(), 1 / 6, { metal: .3, rough: 1, nStr: .55 });
  const m = _SHIPMAT.clone(); m.onBeforeCompile = _SHIPMAT.onBeforeCompile; m.customProgramCacheKey = () => 'shipPlate'; return m;
}
// scritte e insegne disegnate su una tela: numeri di scafo, marche di pescaggio, bandiere
const _DTEX = {};
function canvasTex(key, w, h, draw) {
  if (_DTEX[key]) return _DTEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return _DTEX[key] = t;
}
function flagTex(nat) {
  return canvasTex('flag_' + nat, 192, 128, (x, w, h) => {
    if (nat === 'us') { for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f2efe6' : '#b22234'; x.fillRect(0, i * h / 13, w, h / 13 + 1); } x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, w * .4, h * 7 / 13); x.fillStyle = '#f2efe6'; for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) { x.beginPath(); x.arc(6 + c * 12.5 + (r % 2) * 6, 5 + r * 7.4, 1.8, 0, TAU); x.fill(); } }
    else if (nat === 'jp') { x.fillStyle = '#f2efe6'; x.fillRect(0, 0, w, h); const cx = w * .42, cy = h / 2; x.fillStyle = '#bc002d'; for (let i = 0; i < 16; i++) { const a = i * TAU / 16; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, w * 1.2, a - TAU / 64, a + TAU / 64); x.closePath(); x.fill(); } x.beginPath(); x.arc(cx, cy, h * .3, 0, TAU); x.fill(); }
    else if (nat === 'de') { const c3 = ['#1b1b1b', '#e4e2d8', '#b3221e']; for (let i = 0; i < 3; i++) { x.fillStyle = c3[i]; x.fillRect(0, i * h / 3, w, h / 3 + 1); } x.fillStyle = '#e4e2d8'; x.fillRect(w * .44, h * .22, w * .12, h * .56); x.fillRect(w * .38, h * .4, w * .24, h * .2); x.fillStyle = '#1b1b1b'; x.fillRect(w * .465, h * .26, w * .07, h * .48); x.fillRect(w * .405, h * .435, w * .19, h * .13); }
    else { x.fillStyle = '#a3262a'; x.fillRect(0, 0, w, h); }
  });
}
function textTex(key, txt, color, w = 256, h = 128, font = 'bold 96px Arial') {
  return canvasTex(key, w, h, (x) => { x.clearRect(0, 0, w, h); x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 4); });
}
function draftTex(nat) {
  return canvasTex('draft_' + nat, 64, 512, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#e8e4d8'; x.font = 'bold 30px Arial'; x.textAlign = 'center'; for (let i = 0; i < 8; i++) { const v = nat === 'us' ? 30 - i * 2 : 9 - i; x.fillText(String(v), w / 2, 28 + i * 64); x.fillRect(w * .3, 40 + i * 64, w * .4, 3); } });
}
// decalcomania piana accostata al fianco dello scafo alla posizione t (0 = prua), lato sd, quota y
function hullDecal(body, C, hd, tex, t, sd, y, w, h, opaque) {
  const L = C.L, z = -L / 2 + t * L, d = .004, slope = (hd.hw(t + d) - hd.hw(t - d)) / (2 * d * L);
  const fl = t < .3 ? .16 * (1 - t / .3) : 0, F = C.F;   // stessa svasatura delle sezioni dello scafo
  const flare = 1 + (y > F * .45 ? fl * (.5 + .5 * (y - F * .45) / (F * .55)) : y > .5 ? fl * .5 * (y - .5) / (F * .45 - .5) : 0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: !opaque, roughness: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, depthWrite: false }));
  m.position.set(sd * (hd.hw(t) * flare + .06), y, z); m.rotation.y = sd * (PI / 2 + Math.atan(slope));   // la normale segue il fianco che si allarga verso il centro nave
  body.add(m); return m;
}
// dettagli realistici aggiuntivi: asta di bompresso e bandiere, radar a materasso, cavo di smagnetizzazione,
// scalandroni, lanciabombe di profondità, paramine, numeri di scafo e marche di pescaggio
function shipExtras(mb, body, C, hd) {
  const L = C.L, B = C.B, F = C.F, pal = SHIP_PAL[C.nat] || SHIP_PAL.x, pt = C.type === 'pt', mt = pal.metal, dY = z => hd.sheer((z + L / 2) / L);
  // asta di prua (con il jack) e asta di poppa con la bandiera di guerra
  const fs = pt ? .5 : Math.max(1, L / 120);
  const zb = -L / 2 + L * .012, zs = L / 2 - L * .01;
  mb.add(U.cyl, mt, 0, dY(zb) + 2.5 * fs, zb, 0, 0, 0, .06 * fs, 5 * fs, .06 * fs);
  let ys = dY(zs); for (const P of mb.parts) { if (P.gid) continue; const b = partBox(P); if (b.min.x < 0 && b.max.x > 0 && b.min.z < zs && b.max.z > zs && b.max.y > ys && b.max.y < ys + 9 && b.max.x - b.min.x > 1) ys = b.max.y; }
  const dYs = () => ys;
  mb.add(U.cyl, mt, 0, ys + 3 * fs, zs, 0, 0, 0, .07 * fs, 6 * fs, .07 * fs);
  const flag = (x, y, z, s) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * s, s, 6, 1), new THREE.MeshStandardMaterial({ map: flagTex(C.nat), side: THREE.DoubleSide, roughness: .9 }));
    const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (1.5 * s) + .5; p.setZ(i, Math.sin(u * 5) * .08 * s * u); p.setX(i, p.getX(i)); } f.geometry.computeVertexNormals();
    f.rotation.y = -PI / 2; f.position.set(x, y, z + .75 * s); body.add(f); };
  flag(0, dYs() + 6 * fs - .8 * fs, zs + .07 * fs, 1.6 * fs);
  if (C.nat === 'us' && !pt) { const j = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * fs, .8 * fs), new THREE.MeshStandardMaterial({ map: canvasTex('jack', 96, 64, (x, w, h) => { x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2efe6'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { x.beginPath(); x.arc(8 + c * 13, 7 + r * 12.5, 2.4, 0, TAU); x.fill(); } }), side: THREE.DoubleSide, roughness: .9 })); j.rotation.y = -PI / 2; j.position.set(0, dY(zb) + 4.6 * fs, zb + .6 * fs); body.add(j); }
  if (pt) return;
  // cavo di smagnetizzazione lungo il fianco poco sotto la coperta
  if (C.type !== 'cargo') for (const sd of [-1, 1]) for (let k = 0; k < 30; k++) { const t0 = .06 + k * .88 / 30, t = t0 + .44 / 30, z = -L / 2 + t * L, y = hd.sheer(t) - .9, fl = t < .3 ? 1 + .16 * (1 - t / .3) * .9 : 1; mb.add(U.box, 0x2a2e31, sd * (hd.hw(t) * fl + .05), y, z, 0, 0, 0, .14, .18, L * .88 / 30 + .1); }
  // scalandroni ripiegati sul fianco (corazzate, incrociatori, portaerei)
  if (C.type === 'bb' || C.type === 'cl' || C.type === 'cv') for (const sd of [-1, 1]) for (const t of [.42, .62]) { const z = -L / 2 + t * L, y = hd.sheer(t) - 2.4; mb.add(U.box, 0x5a6066, sd * (hd.hw(t) + .3), y, z, sd * 0, 0, 0, .25, .5, 7); for (let s = 0; s < 6; s++) mb.add(U.box, 0x3a3e42, sd * (hd.hw(t) + .45), y + .3, z - 3 + s * 1.2, 0, 0, 0, .1, .1, .6); }
  // radar: SK "a materasso" sull'albero più alto delle navi americane grandi, SC sui cacciatorpediniere
  const top = _MT.slice().sort((a, b) => b.y - a.y)[0];
  if (top && C.nat === 'us') { const s = C.type === 'dd' ? .7 : 1.2, y = top.y + 1.6 * s;
    mb.add(U.cyl, mt, top.x, top.y + .8 * s, top.z, 0, 0, 0, .12, 1.6 * s, .12);
    for (let i = 0; i <= 5; i++) { mb.add(U.box, 0x2c3034, top.x - 2.5 * s + i * s, y, top.z, 0, 0, 0, .06, 3.6 * s, .06); }
    for (let j = 0; j <= 4; j++) mb.add(U.box, 0x2c3034, top.x, y - 1.8 * s + j * .9 * s, top.z, 0, 0, 0, 5 * s, .06, .06);
    mb.add(U.box, 0x3a3e42, top.x, y, top.z + .25 * s, 0, 0, 0, 5 * s, 3.6 * s, .04); }
  if (top && C.nat === 'jp' && C.type !== 'dd') mb.add(U.box, 0x2c3034, top.x, top.y + 1.2, top.z, 0, 0, 0, 3.2, 1.8, .08);   // radar Type 21
  // cacciatorpediniere: lanciabombe K-gun ai lati e paramine a prua
  if (C.type === 'dd') { for (const sd of [-1, 1]) for (const t of [.78, .84]) { mb.gid = ++_GID; const z = -L / 2 + t * L; mb.add(U.cyl, 0x2a2e30, sd * (hd.hw(t) - 1.4), dY(z) + .5, z, 0, 0, sd * .7, .18, 1.1, .18); mb.add(U.cyl12, 0x2a2e30, sd * (hd.hw(t) - 1.05), dY(z) + .95, z, 0, 0, sd * .7, .35, .5, .35); }
    mb.gid = 0; for (const sd of [-1, 1]) { mb.gid = ++_GID; const z = -L * .28; mb.add(U.cone, 0xb0aa9a, sd * (hd.hw(.22) - .8), dY(z) + .6, z, PI / 2, 0, 0, .3, 1.6, .3); } }
  mb.gid = 0;
  // ancore vere: fuso e marre nelle cubie
  for (const sd of [-1, 1]) { const t = .045, z = -L / 2 + t * L, y = hd.sheer(t) - F * .3, x = sd * (hd.hw(t) * 1.1 + .25), s = Math.max(.6, L / 200);
    mb.add(U.box, 0x1b1d1f, x, y, z, 0, 0, 0, .3 * s, 2.4 * s, .4 * s); mb.add(U.box, 0x1b1d1f, x, y - 1.1 * s, z, 0, 0, 0, .35 * s, .45 * s, 1.8 * s);
    for (const e of [-1, 1]) mb.add(U.box, 0x1b1d1f, x, y - .8 * s, z + e * .8 * s, e * .7, 0, 0, .3 * s, .9 * s, .25 * s); }
  // decalcomanie: marche di pescaggio a prua e a poppa, numero di scafo sui cacciatorpediniere americani
  for (const sd of [-1, 1]) for (const t of [.035, .93]) hullDecal(body, C, hd, draftTex(C.nat), t, sd, -C.D * .25, .5 * Math.max(1, C.D / 6), 4 * Math.max(1, C.D / 6));
  if (C.nat === 'us' && C.type === 'dd') for (const sd of [-1, 1]) hullDecal(body, C, hd, textTex('hull557', '557', '#e8e4d8'), .1, sd, F * .55, 6, 3);
}
function buildShipModel2(C) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mats = [], own = m => { const c = m.clone(); mats.push(c); return c; };
  const hg = hullGeo2(C); body.add(new THREE.Mesh(hg, own(MAT.vcMetal || MAT.vc)));
  const mb = new MB(); _MT.length = 0; shipSuper(mb, C, hg.userData);
  const extra = []; shipDetails(mb, C, hg.userData, extra); shipUnderwater(mb, C, hg.userData); shipExtras(mb, body, C, hg.userData); mb.gid = 0; declutter(mb, C, hg.userData);
  { const dm = deckMesh(C, hg.userData); mats.push(dm.material); body.add(dm); }
  if (mb.parts.length) { const sg = groupMesh(mb.buildGroups(), true); const mm = new Map(); sg.traverse(o => { if (o.isMesh) { if (!mm.has(o.material)) mm.set(o.material, own(o.material)); o.material = mm.get(o.material); } }); body.add(sg); }
  // ringhiere lungo il bordo del ponte
  const rp = [], L = C.L;
  for (const sd of [-1, 1]) for (let k = 0; k < 40; k++) { const t0 = k / 40, t1 = (k + 1) / 40, y0 = hg.userData.sheer(t0) + .9, y1 = hg.userData.sheer(t1) + .9; rp.push(sd * hg.userData.hw(t0) * .98, y0, hg.userData.zAt(t0, y0), sd * hg.userData.hw(t1) * .98, y1, hg.userData.zAt(t1, y1)); }
  rp.push(...extra);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  body.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: new THREE.Color(pal.metal).convertSRGBToLinear(), transparent: true, opacity: .6 })));
  const turrets = [];
  for (const G of C.guns) for (const [x, y, z, arc, n] of G.mounts) {
    const S = SHELL[G.s], tg = new THREE.Group(), deckY = hg.userData.sheer((z + L / 2) / L);
    tg.position.set(x, Math.max(y, deckY + (S.cal >= 140 ? 2 : 1.2)), z); body.add(tg);
    const sz = S.cal >= 300 ? Math.min(3.2, S.cal / 356) * (n >= 4 ? 1.15 : 1) : S.cal >= 200 ? .9 : S.cal >= 140 ? .72 : .5, tm = new MB();
    const cas = C.type === 'bb' && S.cal < 140 && Math.abs(x) > C.B * .4;
    shTurret(tm, S, sz, pal.upper, C.nat, Math.abs(x) < C.B * .3 ? tg.position.y - deckY + .3 : 0, n, cas);
    tg.add(groupMesh(tm.buildGroups(), true));
    const pv = new THREE.Group(); pv.position.set(0, S.cal >= 140 ? .4 * sz : S.cal >= 100 ? .6 : .2, S.cal >= 140 ? -2.8 * sz : S.cal >= 100 ? -2.2 : 0); tg.add(pv);
    const bl = new MB(), len = S.cal >= 100 ? Math.min(62, S.cal / 1000 * (S.cal >= 300 ? 45 : 40)) : S.cal > 15 ? 2.4 : 1.5, muzzles = [], rad = Math.max(.05, S.cal / 2000 * 1.5);
    for (let i = 0; i < n; i++) {
      const xo = (i - (n - 1) / 2) * Math.max(.3, S.cal / 1000 * (S.cal >= 140 ? 5.2 : 3.5));
      if (S.cal >= 30) shBarrel(bl, xo, 0, 0, rad * (S.cal >= 100 ? 1.25 : 1), len, 0x2b2e30); else bl.add(U.cyl, 0x2b2e30, xo, 0, -len / 2, PI / 2, 0, 0, rad, len, rad);
      if (S.cal >= 100) bl.add(U.cyl12, 0x8e8b80, xo, 0, -.5, PI / 2, 0, 0, rad * 2.1, 1.3, rad * 2.1);   // cuffia di tela
      if (S.cal < 100 && S.cal >= 30) bl.add(U.cone, 0x222426, xo, 0, -len - .15, -PI / 2, 0, 0, rad * 1.8, .35, rad * 1.8);   // paravampa
      if (S.cal < 30) bl.add(U.cyl12, 0x2a2c2e, xo, .18, .3, 0, 0, 0, .2, .12, .2);   // caricatore a tamburo
      muzzles.push(new V3(xo, 0, -len));
    }
    pv.add(groupMesh(bl.buildGroups(), false));
    turrets.push({ sec: !!G.sec, G, S, key: G.s, g: tg, pv, muzzles, arc, x, y: tg.position.y, z, rel: arc === 'aft' ? PI : arc === 'port' ? PI / 2 : arc === 'stbd' ? -PI / 2 : 0, el: 0, reload: rnd(0, G.reload), ok: true, fixT: 0, T: firingTable(G.s, G.elev) });
  }
  // lamiera invecchiata su scafo, sovrastrutture e torri (un materiale per nave: il danno lo scurisce)
  const plate = shipPlateMat(); plate.userData.base = new THREE.Color(1, 1, 1); mats.push(plate);
  g.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors && !o.material.map) { const old = o.material; o.material = plate; const k = mats.indexOf(old); if (k >= 0) mats.splice(k, 1); } });
  return { g, body, turrets, hd: hg.userData, mats };
}

// ---------- dettagli fini: oblò, corsi di lamiera, attrezzature di coperta, finestre e ringhiere delle sovrastrutture,
// zattere, mitragliere, proiettori e sartiame (le linee finiscono nello stesso oggetto delle ringhiere) ----------
function shipDetails(mb, C, hd, lines) {
  const pal = SHIP_PAL[C.nat] || SHIP_PAL.x, L = C.L, B = C.B, u = pal.upper, dk = pal.dark, mt = pal.metal, pt = C.type === 'pt';
  const sideX = (t, y) => hd.hw(t) * (t < .3 && y > C.F * .45 ? 1 + .16 * (1 - t / .3) * (y - C.F * .45) / (C.F * .55) : 1);
  const step = Math.max(2.2, L / 70);
  // file di oblò e corso di lamiera più scuro lungo lo scafo
  if (!pt) for (const sd of [-1, 1]) {
    for (let z = -L * .42; z < L * .44; z += step) {
      const t = (z + L / 2) / L, yp = C.F * .62; if (C.type !== 'cargo' && Math.abs(z) < L * .25 && (C.type === 'bb' || C.type === 'cl')) continue;   // niente oblò sulla cintura corazzata
      mb.add(U.box, 0x101214, sd * (sideX(t, yp) + .02), yp, z, 0, 0, 0, .08, .45, .45);
      if (L > 150 && Math.abs(z) > L * .3) mb.add(U.box, 0x101214, sd * (sideX(t, yp - 2) + .02), yp - 2, z + step / 2, 0, 0, 0, .08, .4, .4);
    }
    // i corsi di lamiera ora sono nella texture della lamiera
  }
  const dY = z => hd.sheer((z + L / 2) / L);
  // bitte, prese d'aria a fungo e boccaporti in coperta; frangionde e verricello a prua
  for (let z = -L * .4; z < L * .45; z += Math.max(pt ? 9 : 6, L / 18)) for (const sd of [-1, 1]) { mb.gid = ++_GID; const t = (z + L / 2) / L, x = sd * (hd.hw(t) - (pt ? .4 : 1.2)); const k = pt ? .45 : 1; mb.add(U.cyl, 0x2a2c2e, x, dY(z) + .35 * k, z, 0, 0, 0, .18 * k, .7 * k, .18 * k); mb.add(U.cyl, 0x2a2c2e, x, dY(z) + .35 * k, z + .8 * k, 0, 0, 0, .18 * k, .7 * k, .18 * k); }
  for (let i = 0; i < Math.round(L / 20); i++) { mb.gid = ++_GID; const z = -L * .35 + i * L * .7 / Math.max(1, Math.round(L / 20) - 1), x = ((i * 37) % 7 - 3) / 3 * B * .3, y = dY(z); const k = pt ? .5 : 1; mb.add(U.cyl, u, x, y + .7 * k, z, 0, 0, 0, .3 * k, 1.4 * k, .3 * k); mb.add(U.sph, u, x, y + 1.5 * k, z, 0, 0, 0, .55 * k, .35 * k, .55 * k); }
  if (!pt) {
    for (const z of [-L * .3, L * .32, L * .38]) { mb.gid = ++_GID; mb.add(U.box, 0x34383c, 0, dY(z) + .12, z, 0, 0, 0, B * .2, .25, B * .14); } mb.gid = 0;
    const zb = -L * .36, w = hd.hw(.14) * .9; for (const sd of [-1, 1]) mb.add(U.box, u, sd * w * .5, dY(zb) + .6, zb, 0, sd * .5, 0, w * 1.1, 1.2, .25);   // frangionde a V
    mb.add(U.cyl12, 0x2a2c2e, 0, dY(-L * .41) + .4, -L * .41, 0, 0, 0, .9, .8, .9);   // verricello dell'ancora
  }
  // sovrastrutture: per ogni blocco del colore delle sovrastrutture, finestre in fila, ringhiera sul tetto, zattere sui fianchi
  const _p = new V3(), _q = new THREE.Quaternion(), _s = new V3(), blocks = [];
  for (const P of mb.parts) if (P.g === U.box && P.c && (P.c.getHex ? P.c.getHex() : 0) === new THREE.Color(u).convertSRGBToLinear().getHex()) { P.m.decompose(_p, _q, _s); if (_s.x > 2.5 && _s.y > 1.6 && _s.z > 2.5 && Math.abs(_q.y) < .01) blocks.push([_p.x, _p.y, _p.z, _s.x, _s.y, _s.z]); }
  if (!blocks.length) for (const P of mb.parts) if (P.g === U.box) { P.m.decompose(_p, _q, _s); if (_s.x > 2.5 && _s.y > 1.6 && _s.z > 2.5 && Math.abs(_q.y) < .01 && _p.y > C.F) blocks.push([_p.x, _p.y, _p.z, _s.x, _s.y, _s.z]); }
  for (const [x, y, z, sx, sy, sz] of blocks.slice(0, 40)) {
    const top = y + sy / 2, wy = top - Math.min(1.1, sy * .3), nw = Math.max(1, Math.floor(sz / 2.4));
    for (const sd of [-1, 1]) for (let i = 0; i < nw; i++) mb.add(U.box, 0x1a2430, x + sd * (sx / 2 + .02), wy, z - sz / 2 + (i + .5) * sz / nw, 0, 0, 0, .06, .55, Math.min(1.2, sz / nw * .55));
    const nf = Math.max(1, Math.floor(sx / 2.4)); for (let i = 0; i < nf; i++) mb.add(U.box, 0x1a2430, x - sx / 2 + (i + .5) * sx / nf, wy, z - sz / 2 - .02, 0, 0, 0, Math.min(1.2, sx / nf * .55), .55, .06);
    // ringhiera sul bordo del tetto
    const ry = top + .9, a = [[x - sx / 2, z - sz / 2], [x + sx / 2, z - sz / 2], [x + sx / 2, z + sz / 2], [x - sx / 2, z + sz / 2]];
    for (let i = 0; i < 4; i++) { const p0 = a[i], p1 = a[(i + 1) % 4]; lines.push(p0[0], ry, p0[1], p1[0], ry, p1[1]); }
    if (sz > 6 && sy > 2.5 && !pt) for (const sd of [-1, 1]) { mb.gid = ++_GID; mb.add(U.box, 0x8d8a76, x + sd * (sx / 2 + .35), y - sy * .1, z + sz * .2, 0, 0, 0, .6, 1, Math.min(4, sz * .4)); mb.gid = 0; }   // zattere
  }
  // mitragliere da 20 mm lungo i bordi e proiettori
  const n20 = C.type === 'bb' ? 10 : C.type === 'cl' ? 7 : C.type === 'dd' ? 3 : 0;
  for (let i = 0; i < n20; i++) for (const sd of [-1, 1]) { mb.gid = ++_GID; const z = -L * .28 + i * L * .56 / Math.max(1, n20 - 1), t = (z + L / 2) / L, x = sd * (hd.hw(t) - 1.6), y = dY(z); mb.add(U.cyl12, u, x, y + .5, z, 0, 0, 0, .5, 1, .5); mb.add(U.cyl, 0x222426, x, y + 1.3, z - .5, PI / 2 - .6, 0, 0, .05, 1.6, .05); mb.add(U.box, u, x, y + 1.1, z - .1, 0, 0, 0, .7, .5, .06); }
  if (!pt && C.type !== 'cargo') for (const sd of [-1, 1]) { mb.gid = ++_GID; const z = -L * .1, y = dY(z) + (C.type === 'bb' ? 14 : 9); mb.add(U.cyl12, 0x3a3e42, sd * B * .2, y, z, PI / 2, 0, 0, .7, .9, .7); mb.add(U.cyl12, 0xd8dccf, sd * B * .2, y, z - .46, PI / 2, 0, 0, .55, .05, .55); }
  mb.gid = 0;
  // sartiame: dalle cime degli alberi verso prua, poppa e fra gli alberi
  const bow = new V3(0, dY(-L * .48) + 1, -L * .48), stern = new V3(0, dY(L * .48) + 1, L * .48);
  const tops = _MT.slice().sort((a, b) => a.z - b.z);
  if (tops.length) { const f0 = tops[0], f1 = tops[tops.length - 1]; lines.push(bow.x, bow.y, bow.z, f0.x, f0.y, f0.z, f1.x, f1.y, f1.z, stern.x, stern.y, stern.z); for (let i = 0; i < tops.length - 1; i++) lines.push(tops[i].x, tops[i].y, tops[i].z, tops[i + 1].x, tops[i + 1].y, tops[i + 1].z); for (const T of tops) for (const sd of [-1, 1]) { const zz = T.z + 4, t = (zz + L / 2) / L; lines.push(T.x, T.y - 1, T.z, sd * hd.hw(t), dY(zz) + .5, zz); } }
}
