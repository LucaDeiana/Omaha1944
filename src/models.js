"use strict";
// ============================================================
//  Modelli procedurali ad alto dettaglio: navi da guerra e aerei
//  (superfici costruite per sezioni, profili alari, eliche, insegne)
// ============================================================

// ---------- utilità geometriche ----------
function fixWinding(g) {
  const p = g.attributes.position, idx = g.index.array, a = new V3(), b = new V3(), c = new V3();
  let V = 0;
  for (let i = 0; i < idx.length; i += 3) { a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]); V += a.dot(b.cross(c)); }
  if (V < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.computeVertexNormals(); return g;
}
// superficie per sezioni (anelli con lo stesso numero di punti)
function loftGeo(secs, colorFn, caps = true, uvs = 1, skip = null) {
  const m = secs.length, n = secs[0].length, W = n + 1;
  const pos = [], uv = [], cl = [], idx = [];
  for (let i = 0; i < m; i++) for (let j = 0; j <= n; j++) {
    const p = secs[i][j % n]; pos.push(p.x, p.y, p.z); uv.push(j / n * 4 * uvs, i / (m - 1) * 8 * uvs);
    const c = colorFn ? colorFn(p, i, j % n) : col(0xffffff); cl.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < m - 1; i++) for (let j = 0; j < n; j++) {
    if (skip) { const p0 = secs[i][j], p1 = secs[i + 1][(j + 1) % n]; if (skip((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2)) continue; }
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  if (caps) for (const [i, rev] of [[0, true], [m - 1, false]]) {
    const cen = new V3(); for (const p of secs[i]) cen.add(p); cen.multiplyScalar(1 / n);
    const ci = pos.length / 3; pos.push(cen.x, cen.y, cen.z); uv.push(.5, .5);
    const c = colorFn ? colorFn(cen, i, 0) : col(0xffffff); cl.push(c.r, c.g, c.b);
    for (let j = 0; j < n; j++) { const a = i * W + j, b = a + 1; if (rev) idx.push(ci, b, a); else idx.push(ci, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx);
  return fixWinding(g);
}
function sideExtrude(pts, w, bev = 0) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const d = Math.max(.001, w - bev * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -d / 2); g.rotateY(-PI / 2); return g;
}
const cylG2 = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
function superRing(w, h, cy, n, pTop, pBot, z) {
  const r = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, c = Math.cos(a), s = Math.sin(a), p = s > 0 ? pTop : pBot;
    r.push(new V3(w / 2 * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), cy + h / 2 * Math.sign(s) * Math.pow(Math.abs(s), 2 / p), z));
  }
  return r;
}
// profilo alare NACA simmetrico con leggera curvatura; restituisce punti (corda, spessore) da bordo d'uscita superiore a inferiore
function airfoil(n, t, camber = .02) {
  const up = [], lo = [];
  for (let k = 0; k <= n; k++) {
    const x = .5 - .5 * Math.cos(k / n * PI);
    const yt = 5 * t * (.2969 * Math.sqrt(x) - .126 * x - .3516 * x * x + .2843 * x ** 3 - .1036 * x ** 4);
    const yc = camber * 4 * x * (1 - x);
    up.push([x, yc + yt]); lo.push([x, yc - yt]);
  }
  const r = [];
  for (let k = n; k >= 0; k--) r.push(up[k]);
  for (let k = 1; k < n; k++) r.push(lo[k]);
  return r;
}
// ala costruita per sezioni lungo l'apertura (asse x)
function wingGeo(o) {
  const secs = [], af = airfoil(o.af || 18, 1, o.camber ?? .02), stn = [];
  for (let i = 0; i < o.stations.length; i++) { stn.push(o.stations[i]); if (i < o.stations.length - 1) stn.push((o.stations[i] + o.stations[i + 1]) / 2); }
  const col0 = o.color, color = col0 ? p => { const c = col0(p), f = Math.abs(((p.x / 1.25) % 1 + 1) % 1 - .5); return f > .475 ? new THREE.Color(c.r * .82, c.g * .82, c.b * .82) : c; } : null;
  for (const x of stn) {
    const c = o.chord(x), le = o.le(x), y0 = o.y(x), t = o.thick(x), tw = (o.twist ? o.twist(x) : 0);
    secs.push(af.map(([u, v]) => { const zc = u * c, yc = v * t * c; return new V3(x, y0 + yc * Math.cos(tw) + (zc - c * .25) * Math.sin(tw), le + zc); }));
  }
  return loftGeo(secs, color, true);
}
function finGeo(o) {
  const secs = [], af = airfoil(14, 1, 0), stn = [];
  for (let i = 0; i < o.stations.length; i++) { stn.push(o.stations[i]); if (i < o.stations.length - 1) stn.push((o.stations[i] + o.stations[i + 1]) / 2); }
  for (const y of stn) { const c = o.chord(y), le = o.le(y), t = o.thick(y); secs.push(af.map(([u, v]) => new V3(v * t * c, y, le + u * c))); }
  return loftGeo(secs, o.color, true);
}
function stripeCol(v, a, base, alt) { for (let k = 0; k < 5; k++) if (v >= a + k * .46 && v < a + (k + 1) * .46) return k % 2 ? alt[1] : alt[0]; return base; }

// ---------- texture delle insegne ----------
let INSIG = null;
function insignia() {
  if (INSIG) return INSIG;
  const us = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s); const cx = s / 2, cy = s / 2, r = s * .27;
    g.fillStyle = '#1d2a4d'; g.fillRect(cx - s * .46, cy - s * .085, s * .92, s * .17);
    g.fillStyle = '#e8e6df'; g.fillRect(cx - s * .44, cy - s * .065, s * .88, s * .13);
    g.fillStyle = '#1d2a4d'; g.beginPath(); g.arc(cx, cy, r + 4, 0, TAU); g.fill();
    g.fillStyle = '#e8e6df'; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -PI / 2 + k * PI / 5, rr = k % 2 ? r * .38 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill();
  });
  const de = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s); const c = s / 2, a = s * .44, b = s * .13;
    g.fillStyle = '#f2f2f2'; g.fillRect(c - a, c - b - 6, a * 2, (b + 6) * 2); g.fillRect(c - b - 6, c - a, (b + 6) * 2, a * 2);
    g.fillStyle = '#111'; g.fillRect(c - a + 6, c - b, a * 2 - 12, b * 2); g.fillRect(c - b, c - a + 6, b * 2, a * 2 - 12);
  });
  const flag = canvasTex(256, (g, s) => {
    for (let k = 0; k < 13; k++) { g.fillStyle = k % 2 ? '#eee' : '#b22234'; g.fillRect(0, k * s * .5 / 13 + s * .25, s, s * .5 / 13 + 1); }
    g.fillStyle = '#3c3b6e'; g.fillRect(0, s * .25, s * .4, s * .27);
    g.fillStyle = '#fff'; for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) g.fillRect(6 + x * 16, s * .25 + 6 + y * 13, 4, 4);
  });
  const mk = t => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, side: THREE.DoubleSide });
  INSIG = { us: mk(us), de: mk(de), flag: new THREE.MeshStandardMaterial({ map: flag, side: THREE.DoubleSide, roughness: .9 }) };
  INSIG.glass = new THREE.MeshStandardMaterial({ color: col(0x9fb8c8), roughness: .05, metalness: .8, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide });
  INSIG.dark = new THREE.MeshStandardMaterial({ color: col(0x141414), roughness: .6, metalness: .3 });
  return INSIG;
}
function decal(group, mat, w, h, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz, 'YXZ'); group.add(m); return m;
}

// ============================================================
//  NAVI
// ============================================================
function hullSections(L, B, F, Dr, n, o = {}) {
  const secs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = -L / 2 + t * L;
    const bowK = o.blunt ? .82 : .58;
    const hb = B / 2 * (t < .1 ? .6 + .4 * smooth(t / .1) : t > bowK ? Math.max(.015, 1 - Math.pow((t - bowK) / (1 - bowK), o.blunt ? 3 : 1.8)) : 1);
    const fb = F * (1 + (o.sheer ?? .3) * smooth((t - .6) / .4) + .06 * smooth((.1 - t) / .1));
    const dr = Dr * (1 - .4 * smooth((t - .88) / .12)) * (t < .05 ? .55 + .45 * t / .05 : 1);
    const hd = hb * (1 + .12 * smooth((t - .72) / .28)), cb = B * .012;
    const ring = [[0, -dr], [hb * .5, -dr], [hb * .82, -dr * .95], [hb * .97, -dr * .72], [hb, -dr * .35], [hb, 0], [(hb + hd) / 2, fb * .55], [hd, fb], [hd * .55, fb + cb * .7], [0, fb + cb],
    [-hd * .55, fb + cb * .7], [-hd, fb], [-(hb + hd) / 2, fb * .55], [-hb, 0], [-hb, -dr * .35], [-hb * .97, -dr * .72], [-hb * .82, -dr * .95], [-hb * .5, -dr]];
    secs.push(ring.map(([x, y]) => new V3(x, y, z)));
  }
  return secs;
}
function hullColor(hullHex, deckHex) {
  const af = col(0x5e2d26), bt = col(0x1d1d1d), hc = col(hullHex), dk = col(deckHex);
  return (p, i, j) => j >= 8 && j <= 10 ? dk : p.y < -.4 ? af : p.y < .7 ? bt : hc;
}
// torretta: cannoni puntati verso +z locale, ruotata di 'rot' intorno a y
function shipTurret(mb, x, y, z, s, n, gl, rot, el, opt = {}) {
  const C = opt.color || 0x646d75, out = [];
  mb.setBase(x, y, z, 0, rot, 0); mb.mat = 'paint';
  mb.add(cylG2(3.2 * s, 3.4 * s, 1.2 * s, 28), C, 0, .3 * s, 0);
  mb.add(sideExtrude([[-3.3 * s, 0], [3.0 * s, 0], [4.0 * s, 1.1 * s], [3.3 * s, 2.5 * s], [-3.3 * s, 2.5 * s]], 6.6 * s, .08 * s), C, 0, .9 * s, 0);
  mb.add(cylG2(.32 * s, .32 * s, 7.8 * s, 12), 0x5e666d, 0, 3.3 * s, -1.8 * s, 0, 0, PI / 2);
  for (const sx of [-1, 1]) mb.add(cylG2(.5 * s, .45 * s, .6 * s, 12), 0x5e666d, sx * 3.9 * s, 3.3 * s, -1.8 * s, 0, 0, PI / 2);
  mb.add(U.box, 0x6e777e, 0, 3.45 * s, -2.6 * s, 0, 0, 0, 1.4 * s, .7 * s, 1.2 * s);
  for (let k = 0; k < n; k++) {
    const bx = (k - (n - 1) / 2) * 1.6 * s, ty = 1.9 * s, tz = 3.4 * s;
    const ce = Math.cos(el), se = Math.sin(el);
    mb.add(cylG2(.75 * s, .75 * s, 1.2 * s, 14), 0xc2b89a, bx, ty + .5 * s * se, tz + .5 * s * ce, PI / 2 - el, 0, 0);
    const mid = gl / 2 + 1;
    mb.add(cylG2(.3 * s, .48 * s, gl, 16), 0x4a5258, bx, ty + mid * se, tz + mid * ce, PI / 2 - el, 0, 0);
    mb.add(cylG2(.36 * s, .36 * s, .5 * s, 14), 0x3a4248, bx, ty + (gl + .8) * se, tz + (gl + .8) * ce, PI / 2 - el, 0, 0);
    out.push(new V3(bx, ty + (gl + 1.2) * se, tz + (gl + 1.2) * ce).applyMatrix4(mb.base));
  }
  mb.clearBase();
  return out;
}
function tripod(mb, x, z, y0, h, spread, topY) {
  mb.mat = 'paint';
  const top = new V3(x, y0 + h, z);
  for (const [dx, dz] of [[0, -spread], [-spread * .9, spread * .5], [spread * .9, spread * .5]]) mb.between(new V3(x + dx, y0, z + dz), top, .45, 0x6e777e, cylG2(1, 1.3, 1, 10));
  mb.add(U.box, 0x7e878e, x, y0 + h + 1.4, z, 0, 0, 0, 5.5, 2.8, 5.5); mb.add(U.box, 0x1a1c1e, x, y0 + h + 1.6, z, 0, 0, 0, 5.6, .7, 5.6);
  mb.add(U.box, 0x6e777e, x, y0 + h - .2, z, 0, 0, 0, 7, .3, 7);
  mb.add(cylG2(.2, .25, 7, 8), 0x6e777e, x, y0 + h + 6, z);
  mb.add(U.box, 0x5e666d, x, y0 + h + 7.5, z, 0, 0, 0, .25, .25, 6);
  mb.add(U.box, 0x3a3e42, x, y0 + h + 9, z, 0, 0, 0, .2, 2.2, 3.2);
  return top;
}
function aaQuad(mb, x, y, z, rot) {
  mb.mat = 'paint'; mb.add(cylG2(1.5, 1.6, 1.1, 16), 0x7a838b, x, y + .55, z);
  mb.setBase(x, y + 1.3, z, 0, rot, 0);
  mb.add(U.box, 0x5e666d, 0, 0, 0, 0, 0, 0, 1.2, .6, 1.2);
  for (const [bx, by] of [[-.35, .15], [.35, .15], [-.35, -.1], [.35, -.1]]) mb.add(cylG2(.05, .06, 2.4, 6), 0x2a2e32, bx, by + .5, 1.2, PI / 2 - .5, 0, 0);
  mb.clearBase();
}
function launch(mb, x, y, z, len, rot) {
  const secs = hullSections(len, len * .28, len * .1, len * .06, 10, { sheer: .2 });
  mb.setBase(x, y, z, 0, rot, 0); mb.mat = 'paint';
  mb.addG(loftGeo(secs, hullColor(0x8a9298, 0x6b5a45), true));
  mb.add(U.box, 0x7e878e, 0, len * .12, -len * .05, 0, 0, 0, len * .18, len * .08, len * .3);
  mb.clearBase();
}
function buildWarship(type, o = {}) {
  const P_ = {
    bb: { L: 174, B: 32, F: 7.5, Dr: 8.5, tur: [[.31, 0, 0], [.225, 2.6, 0], [-.04, .6, 0], [-.225, 2.6, 1], [-.31, 0, 1]], s: 1, gl: 15, n: 2, fun: 1 },
    cl: { L: 160, B: 19, F: 5.5, Dr: 6, tur: [[.3, 0, 0], [.22, 2, 0], [-.22, 2, 1], [-.3, 0, 1]], s: .68, gl: 10, n: 3, fun: 2 },
    dd: { L: 106, B: 11, F: 4, Dr: 3.6, tur: [[.33, 0, 0], [.24, 1.6, 0], [-.22, 1.6, 1], [-.32, 0, 1]], s: .42, gl: 6, n: 1, fun: 2, enclosed: true },
    lst: { L: 100, B: 15, F: 5, Dr: 2.6, tur: [], s: .4, gl: 3, n: 1, fun: 0, blunt: true },
  }[type];
  const { L, B, F } = P_, mb = new MB(), guns = [];
  const hc = type === 'lst' ? 0x4c5a52 : 0x323c46, sc = 0x646d75;
  mb.mat = 'paint';
  mb.addG(loftGeo(hullSections(L, B, F, P_.Dr, type === 'lst' ? 30 : 70, { blunt: P_.blunt }), hullColor(hc, 0x6f6a5c), true));
  // ancore e passacavi
  for (const sx of [-1, 1]) { mb.add(U.box, 0x1a1a1a, sx * B * .22, F * .85, L * .45, 0, sx * .3, 0, .4, 1.2, 1.4); mb.add(cylG2(.5, .5, .5, 12), 0x1a1a1a, sx * B * .2, F * 1.2, L * .46, PI / 2, 0, 0); }
  if (type === 'lst') {
    mb.add(U.box, sc, 0, F + 4, -L * .38, 0, 0, 0, B * .7, 8, L * .15); mb.add(U.box, 0x1a1c1e, 0, F + 6.5, -L * .31, 0, 0, 0, B * .7, .8, .2);
    mb.add(cylG2(.3, .3, 14, 8), sc, 0, F + 15, -L * .38);
    for (let k = 0; k < 6; k++) mb.add(U.box, pick([0x55603a, 0x4d5536, 0x6a6a5a]), rnd(-4, 4), F + 1.4, rnd(-L * .2, L * .3), 0, 0, 0, 2.6, 2.2, 5.5);
    return { groups: mb.buildGroups(), guns: [], stacks: [] };
  }
  const yD = F + .2;
  // sovrastrutture
  mb.add(U.box, sc, 0, yD + 1.4, 0, 0, 0, 0, B * .5, 2.8, L * .3);
  mb.add(U.box, 0x1a1c1e, 0, yD + 1.8, 0, 0, 0, 0, B * .505, .5, L * .28);
  const bz = L * (type === 'dd' ? .14 : .13);
  mb.add(U.box, sc, 0, yD + 4.2, bz, 0, 0, 0, B * .38, 2.8, L * .07); mb.add(U.box, sc, 0, yD + 6.8, bz, 0, 0, 0, B * .3, 2.4, L * .05);
  mb.add(U.box, sc, 0, yD + 9, bz + 1, 0, 0, 0, B * .55, .3, L * .04);
  for (const lv of [4.6, 7.2]) mb.add(U.box, 0x15171a, 0, yD + lv, bz + L * .025 + .02, 0, 0, 0, B * .26, .55, .1);
  for (const sx of [-1, 1]) mb.add(U.box, sc, sx * B * .3, yD + 9.2, bz + 1, 0, 0, 0, B * .1, .2, 1.5);
  if (type !== 'dd') mb.add(cylG2(2.2, 2.4, 4.5, 20), sc, 0, yD + 2.2, bz + L * .045);
  // alberi
  const mastH = type === 'bb' ? 26 : type === 'cl' ? 20 : 14;
  if (type === 'dd') { mb.add(cylG2(.25, .35, mastH, 8), sc, 0, yD + 9 + mastH / 2, bz - 2); mb.add(U.box, 0x3a3e42, 0, yD + 9 + mastH, bz - 2, 0, 0, 0, .2, 1.6, 2.6); mb.add(U.box, sc, 0, yD + 6 + mastH * .7, bz - 2, 0, 0, 0, .2, .2, 6); }
  else { tripod(mb, 0, bz - L * .03, yD + 2.8, mastH, 2.5); tripod(mb, 0, -L * .14, yD + 2.8, mastH * .72, 2.2); }
  // fumaioli
  const stacks = [];
  const funZ = P_.fun === 1 ? [0] : type === 'dd' ? [L * .03, -L * .08] : [L * .03, -L * .06];
  for (const fz of funZ) {
    const fh = type === 'dd' ? 7 : 11, rx = type === 'dd' ? 1.4 : 3.1, rz2 = type === 'dd' ? 1.9 : 2.2;
    mb.add(cylG2(1, 1.08, fh, 24), 0x6e777e, 0, yD + 2.8 + fh / 2, fz, type === 'dd' ? -.08 : 0, 0, 0, rx, 1, rz2);
    mb.add(cylG2(1.03, 1, .6, 24), 0x1a1a1a, 0, yD + 2.8 + fh, fz - (type === 'dd' ? .3 : 0), 0, 0, 0, rx, 1, rz2);
    stacks.push(new V3(0, yD + 3.4 + fh, fz));
  }
  // torri principali
  P_.tur.forEach(([tz, raise, aft], k) => {
    const z = tz * L, y = yD + raise;
    if (raise > 0) mb.add(cylG2(3.3 * P_.s, 3.5 * P_.s, raise + .2, 24), sc, 0, yD + raise / 2, z);
    if (o.skipTurret === k) { o.turretPos = new V3(0, y, z); o.turretS = P_.s; return; }
    const m = shipTurret(mb, 0, y, z, P_.s, P_.n, P_.gl, PI / 2, .14 + rnd(-.03, .05), { color: sc });
    for (const p of m) guns.push({ p, big: type === 'bb' });
  });
  // casematte, contraeree, scialuppe, gru
  if (type === 'bb') for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    const z = -L * .16 + k * L * .065, x = sx * (B / 2 - .1);
    mb.add(U.box, 0x15171a, x, F - 1.6, z, 0, 0, 0, .25, 1.4, 1.8);
    mb.add(cylG2(.13, .17, 4, 8), 0x2a2e32, x + sx * 1.8, F - 1.5, z, 0, 0, PI / 2);
  }
  const aaN = type === 'bb' ? 6 : type === 'cl' ? 4 : 1;
  for (let k = 0; k < aaN; k++) aaQuad(mb, (k % 2 ? -1 : 1) * B * .2, yD + 2.8, -L * .1 + Math.floor(k / 2) * L * .08, PI / 2);
  if (type !== 'dd') {
    for (const sx of [-1, 1]) { launch(mb, sx * B * .28, yD + 3, -L * .03, 9, 0); launch(mb, sx * B * .3, yD + 3, L * .05, 7, 0); }
    for (const sx of [-1, 1]) { mb.mat = 'paint'; mb.add(cylG2(.35, .45, 9, 10), sc, sx * B * .18, yD + 4.5, -L * .09); mb.between(new V3(sx * B * .18, yD + 8.5, -L * .09), new V3(sx * B * .35, yD + 6, -L * .03), .2, sc); }
  } else {
    mb.mat = 'paint';
    for (let k = 0; k < 5; k++) mb.add(cylG2(.28, .28, 6.5, 10), 0x5e666d, -1 + k * .5, yD + 1.2, -L * .02, 0, PI / 2, PI / 2);
    for (const sx of [-1, 1]) mb.add(U.box, 0x3a3e42, sx * 3, yD + .7, -L * .45, 0, 0, 0, 1, 1.2, 4);
  }
  // dettagli: oblò, Oerlikon da 20 mm, proiettori, telemetro, manicotti di ventilazione, catene dell'ancora, sartiame
  if (type !== 'lst') {
    const secs = hullSections(L, B, F, P_.Dr, 100);
    mb.mat = 'vc';
    for (let i = 0; i < 70; i++) {
      const t = .12 + i / 70 * .74, sec = secs[Math.round(t * 100)], zz = -L / 2 + t * L, hx = sec[6].x;
      for (const sx of [-1, 1]) for (const ry of [.35, .6]) mb.add(cylG2(1, 1, 1, 8), 0x101214, sx * (hx * .985 + .02), F * ry + .4, zz, 0, 0, PI / 2, .16, .06, .16);
    }
    mb.mat = 'paint';
    const oN = type === 'bb' ? 18 : type === 'cl' ? 12 : 6;
    for (let k = 0; k < oN; k++) {
      const t = .15 + (k >> 1) / (oN / 2) * .7, sec = secs[Math.round(t * 100)], zz = -L / 2 + t * L, sx = k % 2 ? 1 : -1, x = sx * (sec[7].x - 1.4);
      mb.add(cylG2(.25, .3, .9, 10), 0x4d555c, x, yD + .45, zz); mb.add(U.box, 0x5a636a, x - sx * .35, yD + 1.3, zz, 0, 0, 0, .06, .8, 1.1);
      mb.add(cylG2(.06, .06, 1.6, 6), 0x1c1e20, x + sx * .1, yD + 1.35, zz, 0, 0, sx * -1.2); mb.add(cylG2(.13, .13, .35, 8), 0x2a2d30, x, yD + 1.2, zz, 0, 0, PI / 2);
    }
    for (const sx of [-1, 1]) for (const lz of [bz - 1, -L * .12]) {
      mb.add(cylG2(.9, .9, .25, 14), 0x4a5258, sx * B * .17, yD + (lz === bz - 1 ? 10.2 : 7.4), lz); mb.add(cylG2(.55, .55, .9, 14), 0x3c4248, sx * B * .17, yD + (lz === bz - 1 ? 10.8 : 8), lz, PI / 2, 0, 0);
      mb.mat = 'vc'; mb.add(cylG2(.48, .48, .05, 14), 0xd8e0e6, sx * B * .17, yD + (lz === bz - 1 ? 10.8 : 8), lz - .46, PI / 2, 0, 0); mb.mat = 'paint';
    }
    if (type !== 'dd') { mb.add(cylG2(.32, .32, B * .42, 12), 0x3a4046, 0, yD + 10.2, bz + 2.4, 0, 0, PI / 2); for (const sx of [-1, 1]) mb.add(cylG2(.5, .5, .5, 12), 0x2a2e32, sx * B * .21, yD + 10.2, bz + 2.4, 0, 0, PI / 2); mb.add(U.box, 0x4a5258, 0, yD + 10.2, bz + 2.4, 0, 0, 0, 1.6, 1, 1.6); }
    for (let k = 0; k < 10; k++) { const x = rnd(-B * .25, B * .25), zz = rnd(-L * .3, L * .3); if (Math.abs(zz) < L * .16 && Math.abs(x) < B * .26) continue; mb.add(cylG2(.25, .25, 1.4, 10), 0x6a737a, x, yD + .7, zz); mb.add(cylG2(.45, .3, .5, 10), 0x6a737a, x, yD + 1.5, zz + .15, -.9, 0, 0); mb.mat = 'vc'; mb.add(cylG2(.3, .3, .05, 10), 0x0e0f10, x, yD + 1.6, zz + .42, -.9 + PI / 2, 0, 0); mb.mat = 'paint'; }
    for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) mb.add(new THREE.TorusGeometry(.16, .05, 4, 8), 0x1d1e1f, sx * B * .12 + sx * k * .02, yD + .08, L * .43 - k * .32, PI / 2, 0, k % 2 ? PI / 2 : 0);
    for (const sx of [-1, 1]) mb.add(cylG2(.6, .7, .7, 12), 0x2a2c2e, sx * B * .12, yD + .35, L * .37);
    mb.mat = 'vc';
    const top = new V3(0, yD + 2.8 + mastH, bz - L * .03);
    for (const p of [new V3(0, yD + 1, L * .47), new V3(0, yD + 1, -L * .47), new V3(B * .45, yD + 1, bz), new V3(-B * .45, yD + 1, bz), new V3(0, yD + 2.8 + mastH * .72, -L * .14)]) mb.between(top, p, .025, 0x202224);
    mb.mat = 'paint';
  }
  // corrimano
  if (o.rails || type === 'bb' || type === 'cl') {
    mb.mat = 'paint';
    for (let i = 0; i < 60; i++) {
      const t = .08 + i / 60 * .84, sec = hullSections(L, B, F, P_.Dr, 100)[Math.round(t * 100)], dz = sec[7], dzz = -L / 2 + t * L;
      for (const sx of [-1, 1]) mb.add(U.box, 0x9aa3ab, sx * (dz.x - .15), dz.y + .55, dzz, 0, 0, 0, .05, 1.1, .05);
    }
    for (const sx of [-1, 1]) for (const hy of [.6, 1.05]) mb.add(U.box, 0x9aa3ab, sx * (B / 2 - .2), F + hy + .2, 0, 0, 0, 0, .04, .04, L * .6);
  }
  return { groups: mb.buildGroups(), guns, stacks };
}
// colloca la nave nel mondo: lunghezza lungo x, fiancata rivolta alla costa
function placeShip(type, x, z, o = {}) {
  const m = buildWarship(type, o), g = groupMesh(m.groups, false);
  g.position.set(x, 0, z); g.rotation.y = PI / 2; g.updateMatrixWorld(true); scene.add(g);
  for (const gun of m.guns) WORLD.shipGuns.push({ p: gun.p.clone().applyMatrix4(g.matrixWorld), big: gun.big, t: rnd(1, 9) });
  for (const st of m.stacks) addEmitter(st.clone().applyMatrix4(g.matrixWorld), 'stack', type === 'bb' ? 2 : 1.2);
  if (type !== 'lst') { const f = decal(g, insignia().flag, 3.2, 3.2, 0, 7.5 + (type === 'bb' ? 32 : 22), -(type === 'bb' ? 174 : 160) * .14, 0, PI / 2, 0); f.userData.flag = true; }
  return { g, o };
}

// ============================================================
//  AEREI
// ============================================================
const PLANE_DATA = {}, PLANE_MAT = {};
// stazioni infittite con interpolazione di Catmull-Rom: profilo longitudinale liscio
function densify(st, k) {
  const out = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push(b.map((_, q) => b[q] === undefined ? undefined : .5 * (2 * b[q] + (-a[q] + c[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t2 + (-a[q] + 3 * b[q] - 3 * c[q] + d[q]) * t3)));
    }
  }
  out.push(st[st.length - 1]);
  return out;
}
// linee dei pannelli: anelli ogni ~1.1 m e cucitura dorsale, leggermente più scuri
const panelShade = (c, p, step = 1.1) => { const f = Math.abs(((p.z / step) % 1 + 1) % 1 - .5); return f > .47 || Math.abs(p.x) < .025 ? new THREE.Color(c.r * .8, c.g * .8, c.b * .8) : c; };
function fuselageGeo(st, n, pTop, colorFn, skip) {
  const ds = densify(st.map(s => [s[0], s[1], s[2], s[3], s[4] ?? pTop]), 3);
  const secs = ds.map(([z, w, h, cy, pt]) => superRing(Math.max(.001, w), Math.max(.001, h), cy, n * 2, pt, 2.3, z));
  return loftGeo(secs, colorFn ? p => panelShade(colorFn(p), p) : null, true, 1, skip);
}
function propBlades(mb, nB, R, chord, tipHex) {
  const af = airfoil(6, 1, .03), st = [.22, .4, .7, 1, 1.3, 1.6, R * .93, R];
  for (let b = 0; b < nB; b++) {
    const secs = st.map(r => {
      const k = (r - .22) / (R - .22), c = chord * (r > R * .9 ? Math.sqrt(Math.max(.05, 1 - ((r - R * .9) / (R * .1)) ** 2)) : .85 + .3 * Math.sin(k * PI)), tw = lerp(.75, .25, k);
      return af.map(([u, v]) => { const x = (u - .4) * c, zt = v * .12 * c; return new V3(x * Math.cos(tw), r, x * Math.sin(tw) + zt); });
    });
    const tip = col(tipHex), bl = col(0x161616);
    const g = loftGeo(secs, p => (p.y > R - .22 ? tip : bl), true);
    mb.addG(g, 0, 0, 0, 0, 0, b * TAU / nB);
  }
}
function buildPlaneData(type) {
  if (PLANE_DATA[type]) return PLANE_DATA[type];
  if (typeof PLANE_SPECS !== 'undefined' && PLANE_SPECS[type] && !PLANE_SPECS[type].builtin) return PLANE_DATA[type] = buildSpecPlane(type);
  const I = insignia(), mb = new MB(), glass = new MB(), prop = new MB(); mb.mat = glass.mat = prop.mat = 'paint';
  const W = col(0xe6e3da), K = col(0x161616);
  let d;
  if (type === 'p47') {
    const OD = col(0x4a5033), NG = col(0x7b7e78), DK = col(0x1a1a1a);
    const st = [[-5.62, .6, .6, 0], [-5.6, 1.3, 1.42, 0], [-5.47, 1.42, 1.56, 0], [-5.0, 1.48, 1.62, 0], [-4.2, 1.47, 1.62, 0], [-3.6, 1.42, 1.6, .02], [-2.8, 1.33, 1.62, .06], [-2.0, 1.22, 1.6, .1, 1.8],
    [-1.3, 1.12, 1.56, .12, 1.7], [-.5, 1.04, 1.5, .14, 1.6], [.4, .95, 1.36, .13, 1.6], [1.4, .82, 1.16, .1, 1.7], [2.4, .68, .95, .1], [3.4, .53, .76, .12], [4.4, .38, .58, .16], [5.2, .24, .42, .2], [5.7, .1, .22, .22], [5.85, .02, .06, .22]];
    mb.addG(fuselageGeo(st, 30, 2.3, (p) => p.z < -5.56 ? DK : (p.z > 2 && p.z < 4.3) ? stripeCol(p.z, 2, p.y < -.1 ? NG : OD, [W, K]) : p.y < -.15 ? NG : OD, (x, y, z) => z > -1.45 && z < .1 && y > .78 && Math.abs(x) < .4));
    mb.add(new THREE.TorusGeometry(.66, .07, 8, 28), 0x2a2a2a, 0, 0, -5.6);
    mb.add(cylG2(.62, .62, .25, 28), 0x111111, 0, 0, -5.45, PI / 2, 0, 0);
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; mb.add(cylG2(.07, .09, .32, 8), 0x2e2e2e, Math.cos(a) * .42, Math.sin(a) * .42, -5.45, 0, 0, a + PI / 2); }
    mb.add(cylG2(.32, .38, .7, 16), 0x1a1a1a, 0, -.62, -5.0, PI / 2, 0, 0, 1.4, 1, .7);
    const span = [], wing = { chord: x => { const a = Math.abs(x); return a < 5.3 ? 2.9 - .26 * a : (2.9 - .26 * 5.3) * Math.sqrt(Math.max(.04, 1 - ((a - 5.3) / .95) ** 2)); }, le: x => -1.95 + .1 * Math.abs(x), y: x => -.5 + Math.abs(x) * .085, thick: x => .15 - .006 * Math.abs(x) };
    for (let x = -6.24; x <= 6.25; x += .2) span.push(x);
    mb.addG(wingGeo({ ...wing, stations: span, color: (p) => { const a = Math.abs(p.x); const base = p.y < -.5 + a * .085 ? NG : OD; return a > 3 && a < 5.3 ? stripeCol(a, 3, base, [W, K]) : base; } }));
    const tsp = []; for (let x = -2.45; x <= 2.46; x += .25) tsp.push(x);
    mb.addG(wingGeo({ stations: tsp, chord: x => 1.4 - .25 * Math.abs(x), le: x => 4.35 + .12 * Math.abs(x), y: () => .28, thick: () => .1, color: () => OD }));
    const fs = []; for (let y = .3; y <= 2.2; y += .19) fs.push(y);
    mb.addG(finGeo({ stations: fs, chord: y => 1.95 - (y - .3) * .52, le: y => 4.0 + (y - .3) * .48, thick: () => .1, color: () => OD }));
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const x = sx * (2.35 + k * .28); mb.add(cylG2(.022, .026, .6, 8), 0x222222, x, -.5 + Math.abs(x) * .085, -1.95 + .1 * Math.abs(x) - .2 - k * .05, PI / 2, 0, 0); }
    for (const sx of [-1, 1]) mb.add(cylG2(.09, .09, .7, 8), 0x333333, sx * .55, -.6, -3.2, PI / 2, 0, 0);
    mb.add(cylG2(.02, .02, .7, 6), 0x222222, 0, 1.05, .5, -.35, 0, 0);
    mb.add(cylG2(.012, .012, .8, 6), 0x9a9a9a, -5.4, -.08, -1.7, PI / 2, 0, 0);
    mb.mat = 'vc'; mb.between(new V3(0, 1.4, .55), new V3(0, .55, 4.5), .006, 0x202020); mb.mat = 'paint';
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) mb.add(U.box, 0x3a3e2a, sx * (3.4 + k * .7), -.5 + (3.4 + k * .7) * .085 + .07, -1.95 + .1 * (3.4 + k * .7) + 2.9 - .26 * (3.4 + k * .7) - .1, 0, 0, 0, .05, .01, .04);
    glass.addG(loftGeo([-1.55, -1.3, -1.0, -.6, -.2, .15, .35].map((z, i) => { const w = [.2, .6, .74, .78, .74, .6, .3][i], h = [.12, .38, .5, .55, .52, .42, .2][i]; const r = []; for (let k = 0; k < 16; k++) { const a = k / 15 * PI; r.push(new V3(Math.cos(a) * w / 2, .62 + Math.sin(a) * h, z)); } return r; }), null, true));
    for (const z of [-1.35, .12]) mb.add(new THREE.TorusGeometry(.37, .014, 6, 18, PI), 0x30331f, 0, .62, z, 0, 0, 0, 1, 1.4, 1);
    d = { prop: { z: -5.85, R: 1.9, n: 4, chord: .28, tip: 0xd8c040 }, decals: [['us', 1.0, .5, 1.6, .2, .58, PI / 2], ['us', 1.0, .5, 1.6, .2, -.58, -PI / 2], ['usw', 1.1, .55, 4.3, -.48, -1.2]], pilot: [0, .9, -.4], eye: [0, 1.0, -.38], guns: [[-2.6, -.3, -2.3], [2.6, -.3, -2.3]] };
    propSpinner(prop, .5, .8, 0x111111);
  } else if (type === 'fw190') {
    const C1 = col(0x5c6268), C2 = col(0x72767a), LB = col(0xa9b4ba), YL = col(0xd0a32c), DK = col(0x1a1a1a);
    const mott = (p, base) => base === LB ? LB : (vnoise(p.x * 3.1 + p.z * 1.7, p.y * 3 + p.z * 2.3) > .55 ? C2 : C1);
    const st = [[-4.45, .5, .5, 0], [-4.42, 1.15, 1.18, 0], [-4.3, 1.28, 1.3, 0], [-3.8, 1.3, 1.32, 0], [-3.1, 1.28, 1.3, 0], [-2.4, 1.18, 1.3, .03], [-1.6, 1.05, 1.32, .08], [-.8, .95, 1.25, .1, 1.8], [0, .88, 1.15, .1, 1.9], [1.0, .75, .98, .08], [2.0, .6, .8, .08], [3.0, .45, .62, .1], [3.8, .3, .45, .12], [4.3, .15, .26, .15], [4.42, .03, .06, .15]];
    mb.addG(fuselageGeo(st, 28, 2.3, p => p.z < -4.38 ? DK : p.z < -2.4 && p.y < -.1 ? YL : (p.z > 2.2 && p.z < 2.7) ? YL : p.y < -.12 ? LB : mott(p, C1)));
    mb.add(cylG2(.55, .55, .1, 24), 0x111111, 0, 0, -4.38, PI / 2, 0, 0);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; mb.add(U.box, 0x333333, Math.cos(a) * .3, Math.sin(a) * .3, -4.35, 0, 0, a, .05, .3, .02); }
    const span = []; for (let x = -5.25; x <= 5.26; x += .25) span.push(x);
    mb.addG(wingGeo({ stations: span, chord: x => { const a = Math.abs(x); return a < 4.9 ? 2.25 - .24 * a : 1.07 * Math.sqrt(Math.max(.05, 1 - ((a - 4.9) / .4) ** 2)); }, le: x => -1.4 + .07 * Math.abs(x), y: x => -.4 + Math.abs(x) * .085, thick: x => .14 - .006 * Math.abs(x), color: p => p.y < -.4 + Math.abs(p.x) * .085 ? LB : mott(p, C1) }));
    const tsp = []; for (let x = -1.8; x <= 1.81; x += .2) tsp.push(x);
    mb.addG(wingGeo({ stations: tsp, chord: x => 1.05 - .22 * Math.abs(x), le: x => 3.45 + .1 * Math.abs(x), y: () => .2, thick: () => .1, color: () => C1 }));
    const fs = []; for (let y = .25; y <= 1.65; y += .175) fs.push(y);
    mb.addG(finGeo({ stations: fs, chord: y => 1.35 - (y - .25) * .45, le: y => 3.25 + (y - .25) * .4, thick: () => .1, color: () => C1 }));
    for (const sx of [-1, 1]) mb.add(cylG2(.025, .03, .7, 8), 0x222222, sx * 1.9, -.25, -1.6, PI / 2, 0, 0);
    glass.addG(loftGeo([-1.05, -.8, -.4, 0, .4, .65].map((z, i) => { const w = [.2, .55, .66, .66, .55, .25][i], h = [.12, .34, .44, .46, .38, .15][i]; const r = []; for (let k = 0; k < 16; k++) { const a = k / 15 * PI; r.push(new V3(Math.cos(a) * w / 2, .52 + Math.sin(a) * h, z)); } return r; }), null, true));
    d = { prop: { z: -4.55, R: 1.65, n: 3, chord: .3, tip: 0x1a1a1a }, decals: [['de', .75, .75, 1.6, .05, .45, PI / 2], ['de', .75, .75, 1.6, .05, -.45, -PI / 2], ['dew', .9, .9, 3.4, -.38, -1.0]], pilot: [0, .62, -.3], eye: [0, .85, -.4] };
    propSpinner(prop, .55, .9, 0x2a3a2a);
  } else {
    const OD = col(0x4a5033), NG = col(0x7b7e78), DK = col(0x1a1a1a);
    const st = []; for (const [z, w, h, cy] of [[-8.9, .2, .2, -.1], [-8.6, 1.0, 1.0, -.05], [-7.9, 1.6, 1.65, 0], [-6.8, 1.85, 1.9, 0], [-3, 1.95, 2.0, 0], [2, 1.9, 1.95, 0], [5, 1.5, 1.55, .1], [7.5, .9, 1.0, .25], [8.8, .4, .5, .35], [9.2, .08, .1, .4]]) st.push([z, w, h, cy]);
    mb.addG(fuselageGeo(st, 28, 2.1, p => (p.z > 1 && p.z < 3.3) ? stripeCol(p.z, 1, p.y < -.2 ? NG : OD, [W, K]) : p.y < -.2 ? NG : OD));
    const span = []; for (let x = -10.8; x <= 10.81; x += .3) span.push(x);
    mb.addG(wingGeo({ stations: span, chord: x => 3.7 - .16 * Math.abs(x), le: x => -1.8 + .08 * Math.abs(x), y: x => .55 + Math.abs(x) * .04, thick: x => .17 - .005 * Math.abs(x), color: p => { const a = Math.abs(p.x); const b = p.y < .55 + a * .04 ? NG : OD; return a > 5 && a < 7.3 ? stripeCol(a, 5, b, [W, K]) : b; } }));
    for (const sx of [-1, 1]) {
      const ns = []; for (const [z, r] of [[-3.3, .3], [-3.1, .62], [-2.6, .72], [0, .72], [2.5, .55], [3.6, .25], [3.9, .05]]) ns.push(superRing(r * 2, r * 2.1, .2, 18, 2.2, 2.2, z).map(p => (p.x += sx * 3.8, p)));
      mb.addG(loftGeo(ns, p => p.y < .2 ? NG : OD, true));
    }
    const tsp = []; for (let x = -3.9; x <= 3.91; x += .3) tsp.push(x);
    mb.addG(wingGeo({ stations: tsp, chord: x => 1.9 - .2 * Math.abs(x), le: x => 7.0 + .1 * Math.abs(x), y: x => .95 + Math.abs(x) * .06, thick: () => .11, color: () => OD }));
    const fs = []; for (let y = .6; y <= 4.6; y += .4) fs.push(y);
    mb.addG(finGeo({ stations: fs, chord: y => 3 - (y - .6) * .35, le: y => 6.0 + (y - .6) * .45, thick: () => .11, color: () => OD }));
    glass.addG(loftGeo([-9.0, -8.6, -8.0, -7.6].map((z, i) => superRing([.25, 1.0, 1.55, 1.65][i], [.25, 1.0, 1.55, 1.7][i], -.05, 18, 2, 2, z)), null, true));
    glass.addG(loftGeo([-.4, -.1, .3, .6].map((z, i) => superRing([.5, 1.1, 1.1, .5][i], [.35, .7, .7, .35][i], 2.0, 18, 2, 2, z)), null, true));
    mb.add(cylG2(.55, .6, .25, 20), 0x3a3e2a, 0, 1.95, .1); for (const sx of [-1, 1]) mb.add(cylG2(.025, .025, 1.1, 8), 0x1a1a1a, sx * .12, 2.25, -.5, PI / 2, 0, 0);
    for (const sx of [-1, 1]) mb.add(cylG2(.025, .025, .7, 8), 0x1a1a1a, sx * .1, .5, 9.5, PI / 2, 0, 0);
    for (const sx of [-1, 1]) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; mb.add(cylG2(.05, .06, .3, 8), 0x2b2622, sx * 3.8 + Math.cos(a) * .7, .2 + Math.sin(a) * .74, -2.4, PI / 2, 0, 0); } mb.add(new THREE.TorusGeometry(.66, .06, 8, 28), 0x2a2a2a, sx * 3.8, .2, -3.3); }
    glass.addG(loftGeo([-6.6, -6.0, -5.2].map((z, i) => { const w = [.4, 1.2, .7][i], h = [.15, .45, .25][i]; const r = []; for (let k = 0; k < 14; k++) { const a = k / 13 * PI; r.push(new V3(Math.cos(a) * w / 2, .9 + Math.sin(a) * h, z)); } return r; }), null, true));
    d = { props: [[-3.8, .2, -3.45], [3.8, .2, -3.45]], prop: { R: 2.05, n: 4, chord: .3, tip: 0xd8c040 }, decals: [['us', 1.3, .65, 2.6, .3, .96, PI / 2], ['us', 1.3, .65, 2.6, .3, -.96, -PI / 2]], pilot: [0, .8, -6] };
    propSpinner(prop, .35, .6, 0x222222);
  }
  propBlades(prop, d.prop.n, d.prop.R, d.prop.chord, d.prop.tip);
  d.paint = mb.buildGroups(); d.glass = glass.build(); d.propG = prop.buildGroups();
  return PLANE_DATA[type] = d;
}
function propSpinner(mb, r, len, hex) {
  const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector2(r * Math.sqrt(1 - t * t * .98), -t * len)); }
  const g = new THREE.LatheGeometry(pts.reverse(), 20); g.rotateX(-PI / 2);
  mb.add(g, hex, 0, 0, 0);
}
function makePlaneModel(type) {
  const d = buildPlaneData(type), I = insignia(), g = new THREE.Group();
  if (!PLANE_MAT.paint) { PLANE_MAT.paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .15 }); PLANE_MAT.vc = PLANE_MAT.paint; }
  for (const k in d.paint) { const m = new THREE.Mesh(d.paint[k], PLANE_MAT[k] || MAT[k] || PLANE_MAT.paint); m.castShadow = true; g.add(m); }
  const gl = new THREE.Mesh(d.glass, I.glass); gl.renderOrder = 2; g.add(gl); g.userData.glass = gl;
  const props = [];
  for (const pp of d.props || [[0, 0, d.prop.z]]) {
    const pg = new THREE.Group(); pg.position.set(pp[0], pp[1], pp[2]);
    for (const k in d.propG) pg.add(new THREE.Mesh(d.propG[k], PLANE_MAT.paint));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(d.prop.R, 32), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.z = -.05; pg.add(disc); pg.userData.disc = disc;
    g.add(pg); props.push(pg);
  }
  for (const [kind, w, h, z, y, xs, ry] of d.decals) {
    if (kind === 'us' || kind === 'de') decal(g, kind === 'us' ? I.us : I.de, w * 1.6, w * (kind === 'us' ? .8 : 1), xs, y, z, 0, ry, 0);
    else for (const sx of [-1, 1]) decal(g, kind === 'usw' ? I.us : I.de, w * 1.6, w * (kind === 'usw' ? .8 : 1), sx * xs * -3.4, y + .13 + Math.abs(xs * 3.4) * .085, z - 3.3, -PI / 2, 0, 0);
  }
  for (const [k, w, h, x, y, z, rx, ry] of d.decals2 || []) decal(g, k === 'uk' ? ukRoundel() : I[k], w, h, x, y, z, rx, ry, 0);
  if (d.pilot) { const ph = new MB(); ph.add(U.sph, 0xc69a7a, 0, 0, 0, 0, 0, 0, .11, .13, .12); ph.add(U.hemi, 0x3a2a1a, 0, .03, 0, 0, 0, 0, .13, .12, .14); const pm = new THREE.Mesh(ph.build(), MAT.vc); pm.position.set(...d.pilot); g.add(pm); g.userData.pilot = pm; }
  g.userData.props = props; g.userData.data = d;
  return g;
}

// torretta del giocatore: ruota attorno a y, i cannoni (verso -z) si alzano intorno a x
function buildPlayerTurret(s) {
  const g = new THREE.Group(), mb = new MB(), C = 0x7a838b; mb.mat = 'paint';
  mb.add(cylG2(3.2 * s, 3.4 * s, 1.2 * s, 32), C, 0, .3 * s, 0);
  mb.add(sideExtrude([[3.3 * s, 0], [-3.0 * s, 0], [-4.0 * s, 1.1 * s], [-3.3 * s, 2.5 * s], [3.3 * s, 2.5 * s]], 6.6 * s, .08 * s), C, 0, .9 * s, 0);
  mb.add(cylG2(.32 * s, .32 * s, 7.8 * s, 12), 0x5e666d, 0, 3.3 * s, 1.8 * s, 0, 0, PI / 2);
  for (const sx of [-1, 1]) mb.add(cylG2(.5 * s, .45 * s, .6 * s, 12), 0x5e666d, sx * 3.9 * s, 3.3 * s, 1.8 * s, 0, 0, PI / 2);
  for (let k = 0; k < 6; k++) mb.add(U.box, 0x5e666d, -2.5 * s + k * s, 3.42 * s, 0, 0, 0, 0, .06 * s, .1 * s, 4 * s);
  mb.add(U.box, 0x6e777e, 0, 3.5 * s, 2.4 * s, 0, 0, 0, 1.4 * s, .7 * s, 1.2 * s);
  for (const sx of [-1, 1]) mb.add(U.box, 0x15171a, sx * 1.6 * s, 1.95 * s, -3.32 * s, 0, 0, 0, .9 * s, .8 * s, .1 * s);
  g.add(groupMesh(mb.buildGroups(), true));
  const pitch = new THREE.Group(); pitch.position.set(0, 1.9 * s, -3.4 * s); g.add(pitch);
  const bm = new MB(); bm.mat = 'paint';
  const gl = 15, muzzles = [];
  for (const bx of [-.8 * s, .8 * s]) {
    bm.add(cylG2(.75 * s, .75 * s, 1.2 * s, 18), 0xc2b89a, bx, 0, -.5 * s, PI / 2, 0, 0);
    bm.add(cylG2(.3 * s, .48 * s, gl, 24), 0x4a5258, bx, 0, -(gl / 2 + 1), -PI / 2, 0, 0);
    bm.add(cylG2(.36 * s, .36 * s, .5 * s, 18), 0x3a4248, bx, 0, -(gl + .8), PI / 2, 0, 0);
    muzzles.push(new V3(bx, 0, -(gl + 1.2)));
  }
  pitch.add(groupMesh(bm.buildGroups(), true));
  return { g, pitch, muzzles };
}
