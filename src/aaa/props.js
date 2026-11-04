"use strict";
// ============================================================
//  AAA Graphics Test — oggetti di scena, collocati a mano (non sparsi a caso).
//  Botti a doghe con cerchi, casse di legno e casse militari, sacchi a terra, carro agricolo con ruote a raggi,
//  legnaia, secchi, bidoni del latte, attrezzi, balle di fieno, taniche, recinzioni, cancelli, muri a secco,
//  calvario all'incrocio, cartello stradale, Sherman (modello del gioco) con sacchi a terra sullo scafo.
// ============================================================
const AP = { lathe: {} };
function apLathe(key, pts, seg = 16) { if (AP.lathe[key]) return AP.lathe[key]; const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg); g.computeVertexNormals(); return AP.lathe[key] = g; }
const apY = (x, z) => aaaH(x, z);
function apBarrel(G, x, z, ry = 0, lying = false, s = 1) {
  const M = AAA.mats, g = apLathe('barrel', [[0, 0], [.27, 0], [.3, .2], [.32, .45], [.3, .7], [.27, .9], [0, .9]], 18);
  const y = apY(x, z);
  if (!lying) { G.add(M.woodOld, g, x, y, z, 0, ry, 0, s, s, s); for (const h of [.08, .3, .6, .82]) G.add(M.rust, ABX.cyl, x, y + h * s, z, 0, 0, 0, (.3 + (h > .2 && h < .7 ? .025 : 0)) * s + .006, .04 * s, (.3 + (h > .2 && h < .7 ? .025 : 0)) * s + .006); OBST.push({ x, z, r: .35 * s }); }
  else { G.add(M.woodOld, g, x, y + .31 * s, z, 0, ry, PI / 2, s, s, s); }
}
function apCrate(G, x, z, ry, sx = .8, sy = .6, sz = .6, mil = false, y0) {
  const M = AAA.mats, y = y0 ?? apY(x, z), mat = mil ? M.paint : M.wood, col = mil ? 0x55593c : undefined;
  G.add(mat, ABX.box, x, y + sy / 2, z, 0, ry, 0, sx, sy, sz, col);
  // listelli di rinforzo sui bordi
  const c = Math.cos(ry), s_ = Math.sin(ry);
  for (const k of [-1, 1]) G.add(mat, ABX.box, x + c * k * (sx / 2 - .04), y + sy / 2, z - s_ * k * (sx / 2 - .04), 0, ry, 0, .08, sy + .01, sz + .02, mil ? 0x464a30 : undefined);
  if (mil) G.add(M.vc, ABX.box, x, y + sy * .55, z + Math.cos(ry) * (sz / 2 + .006), 0, ry, 0, sx * .5, sy * .25, .004, 0xd8d0b0);
  if (!y0) { const sol = addSolid(x - Math.max(sx, sz) / 2, y, z - Math.max(sx, sz) / 2, x + Math.max(sx, sz) / 2, y + sy, z + Math.max(sx, sz) / 2, 'crate'); sol.mat = 'legno'; }
}
function apSandbags(G, x0, z0, x1, z1, rows = 3) {
  const M = AAA.mats, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / .62)), ry = Math.atan2(-(z1 - z0), x1 - x0), sr = seeded(Math.round(x0 * 7 + z0 * 13)), sack = apLathe('sack', [[0, -.5], [.35, -.42], [.5, -.1], [.5, .1], [.35, .42], [0, .5]], 10);
  for (let r_ = 0; r_ < rows; r_++) for (let i = 0; i < n - (r_ % 2 ? 1 : 0); i++) {
    const k = (i + .5 + (r_ % 2) * .5) / n, x = lerp(x0, x1, k), z = lerp(z0, z1, k), y = apY(x, z) + .11 + r_ * .2;
    G.add(M.sack, sack, x, y, z, PI / 2, ry + PI / 2 + (sr() - .5) * .12, (sr() - .5) * .08, .72 * (.95 + sr() * .1), .62, .4);
  }
  const s = addSolid(Math.min(x0, x1) - .3, apY(x0, z0) - .2, Math.min(z0, z1) - .3, Math.max(x0, x1) + .3, apY(x0, z0) + rows * .2 + .05, Math.max(z0, z1) + .3, 'sandbag'); s.mat = 'terra';
}
function apCart(G, x, z, ry) {
  const M = AAA.mats, y = apY(x, z), c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz) => [x + c * lx + s * lz, y + ly, z - s * lx + c * lz];
  // cassone di tavole, stanghe appoggiate a terra, ruote a raggi con cerchione
  for (let i = 0; i < 6; i++) { const [px, py, pz] = P(0, .85, -1.1 + i * .44); G.add(M.woodOld, ABX.box, px, py, pz, 0, ry, 0, 1.4, .05, .42); }
  for (const k of [-1, 1]) { const [px, py, pz] = P(k * .7, 1.05, 0); G.add(M.woodOld, ABX.box, px, py, pz, 0, ry, 0, .05, .45, 2.7); const [qx, qy, qz] = P(k * .45, .55, 2.1); G.add(M.woodOld, ABX.box, qx, qy, qz, -.42, ry, 0, .07, .07, 2.4); }
  for (const k of [-1, 1]) { const [wx, wy, wz] = P(k * .82, .62, -.1); G.add(M.woodDark, new THREE.TorusGeometry(.6, .04, 6, 20), wx, wy, wz, 0, ry + PI / 2, 0); G.add(M.rust, new THREE.TorusGeometry(.62, .02, 4, 20), wx, wy, wz, 0, ry + PI / 2, 0); for (let sp = 0; sp < 10; sp++) { const a = sp / 10 * TAU; G.add(M.woodDark, ABX.box, wx + c * 0, wy + Math.cos(a) * .3, wz, a, ry + PI / 2, 0, .03, .6, .03); } G.add(M.woodDark, ABX.cyl, wx, wy, wz, 0, ry, PI / 2, .1, .25, .1); }
  const sol = addSolid(x - 1.5, y, z - 1.5, x + 1.5, y + 1.2, z + 1.5, 'crate'); sol.mat = 'legno';
}
function apFirewood(G, x, z, ry, L = 2, H = 1) {
  const M = AAA.mats, y = apY(x, z), sr = seeded(Math.round(x * 31 + z)), c = Math.cos(ry), s = Math.sin(ry);
  for (let row = 0; row < Math.round(H / .16); row++) for (let i = 0; i < Math.round(L / .17); i++) { const lx = -L / 2 + (i + .5 + (row % 2) * .5) * .17; if (lx > L / 2) continue; G.add(M.woodOld, ABX.cyl6, x + c * lx, y + .08 + row * .15, z - s * lx, PI / 2, ry, 0, .075 + sr() * .015, .5 + sr() * .1, .075 + sr() * .015); }
  const sol = addSolid(x - L / 2, y, z - L / 2 * Math.abs(s) - .3, x + L / 2, y + H, z + L / 2 * Math.abs(s) + .3, 'crate'); sol.mat = 'legno';
}
function apBucket(G, x, z, y0) { const M = AAA.mats, y = y0 ?? apY(x, z); G.add(M.rust, apLathe('bucket', [[0, 0], [.13, 0], [.16, .28], [.155, .28], [.125, .01], [0, .01]], 14), x, y, z); }
function apChurn(G, x, z) { const M = AAA.mats, y = apY(x, z); G.add(M.metal, apLathe('churn', [[0, 0], [.17, 0], [.18, .45], [.12, .58], [.08, .6], [.09, .66], [0, .66]], 14), x, y, z); OBST.push({ x, z, r: .2 }); }
function apHay(G, x, z, ry, y0) { const M = AAA.mats, y = y0 ?? apY(x, z); G.add(M.straw, ABX.box, x, y + .25, z, 0, ry, 0, 1.0, .5, .55); for (const k of [-.25, .25]) G.add(M.vc, ABX.box, x + Math.cos(ry) * k, y + .25, z - Math.sin(ry) * k, 0, ry, 0, .01, .51, .56, 0x8a7448); }
function apJerry(G, x, z, ry, y0) { const M = AAA.mats, y = y0 ?? apY(x, z); G.add(M.paint, ABX.box, x, y + .24, z, 0, ry, 0, .17, .47, .34, 0x4a4e32); G.add(M.paint, ABX.box, x, y + .5, z, 0, ry, 0, .06, .05, .2, 0x3a3e28); }
function apTool(G, x, z, ry, kind, lean = .25, y0) {
  const M = AAA.mats, y = y0 ?? apY(x, z), c = Math.cos(ry), s = Math.sin(ry);
  G.add(M.woodOld, ABX.cyl6, x, y + .75, z, lean * c, ry, lean * s, .022, 1.5, .022);
  const tx = x + Math.sin(lean) * .75 * c, tz = z + Math.sin(lean) * .75 * s;
  if (kind === 'fork') for (let k = -1; k <= 1; k++) G.add(M.rust, ABX.cyl6, tx + k * .05, y + 1.62, tz, 0, ry, 0, .008, .3, .008);
  else if (kind === 'spade') G.add(M.rust, ABX.box, x, y + .1, z, 0, ry, 0, .2, .26, .02);
  else G.add(M.rust, ABX.box, tx, y + 1.55, tz, 0, ry, 0, .4, .04, .04);
}
// muro a secco: pietre irregolari una per una, con copertina; collider unico
function apDryWall(G, x0, z0, x1, z1, h = 1.3, seed = 1, gap) {
  const M = AAA.mats, sr = seeded(seed), r = (a, b) => a + sr() * (b - a), L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  const stone = AAA.mats.wallStone || (AAA.mats.wallStone = aaaTri('stone', .7, { nStr: 1.6, macro: .3, moss: 1.3, damp: 1, hq: 'muro_secco', hqScale: .6, color: 0xc8bea8 }));
  const ico = AP.rock || (AP.rock = (() => { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = .85 + ((i * 7919) % 13) / 13 * .3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })());
  const segs = gap ? [[0, gap[0]], [gap[1], L]] : [[0, L]];
  for (const [a0, a1] of segs) {
    for (let y = 0; y < h; ) { const rh = r(.16, .26); for (let a = a0 + r(0, .2); a < a1 - .1; ) { const sl = r(.28, .55), cx = x0 + dx * (a + sl / 2), cz = z0 + dz * (a + sl / 2), gy = apY(cx, cz) - .15; G.add(stone, ABX.box, cx, gy + y + rh / 2, cz, r(-.06, .06), ry + r(-.08, .08), r(-.06, .06), sl - .03, rh - .02, r(.45, .6)); a += sl; } y += rh; }
    for (let a = a0; a < a1 - .1; a += .45) { const cx = x0 + dx * (a + .22), cz = z0 + dz * (a + .22); G.add(stone, ico, cx, apY(cx, cz) - .15 + h + .05, cz, r(0, 3), r(0, 3), 0, .26, .16, .3); }
    const ax = x0 + dx * a0, az = z0 + dz * a0, bx = x0 + dx * a1, bz = z0 + dz * a1, nx = -dz * .35, nz = dx * .35;
    const sol = addSolid(Math.min(ax, bx) - Math.abs(nx), Math.min(apY(ax, az), apY(bx, bz)) - .3, Math.min(az, bz) - Math.abs(nz), Math.max(ax, bx) + Math.abs(nx), Math.max(apY(ax, az), apY(bx, bz)) + h - .1, Math.max(az, bz) + Math.abs(nz), 'wall'); sol.mat = 'muratura';
    for (const sgn of [-1, 1]) covers.push({ x: (ax + bx) / 2 + nx * 3 * sgn, z: (az + bz) / 2 + nz * 3 * sgn, kind: 'wallN', occ: 0 });
  }
}
function apGatePillar(G, x, z, h = 1.9) { const M = AAA.mats, y = apY(x, z); G.add(M.stoneLight, ABX.box, x, y + h / 2 - .2, z, 0, 0, 0, .55, h + .4, .55); G.add(M.stoneLight, ABX.box, x, y + h + .1, z, 0, 0, 0, .65, .14, .65); const s = addSolid(x - .3, y - .2, z - .3, x + .3, y + h, z + .3, 'wall'); s.mat = 'muratura'; }
function apGate(G, x, z, ry, w = 3, open = .9) {   // cancello di legno a cinque traverse, aperto
  const M = AAA.mats, y = apY(x, z), a = ry + open, c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 5; i++) G.add(M.woodOld, ABX.box, x + c * w / 2, y + .25 + i * .26, z - s * w / 2, 0, a, 0, w, .08, .05);
  for (const k of [0, w / 2, w]) G.add(M.woodOld, ABX.box, x + c * k, y + .78, z - s * k, 0, a, 0, .09, 1.2, .07);
  G.add(M.woodOld, ABX.box, x + c * w / 2, y + .78, z - s * w / 2, 0, a, .62, w * 1.08, .07, .05);
}
function apFence(G, pts, seed) {   // pali di legno con due fili (recinzione di campo)
  const M = AAA.mats, sr = seeded(seed);
  for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 2.5);
    for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n), z = lerp(z0, z1, k / n), y = apY(x, z); G.add(M.woodOld, ABX.cyl6, x, y + .55, z, (sr() - .5) * .08, sr() * 3, (sr() - .5) * .08, .055, 1.25, .055); }
    for (const h of [.5, .95]) { const y0 = apY(x0, z0) + h, y1 = apY(x1, z1) + h; const mid = new V3((x0 + x1) / 2, (y0 + y1) / 2 - .03, (z0 + z1) / 2), d = new V3(x1 - x0, y1 - y0, z1 - z0); G.add(M.rust, ABX.cyl6, mid.x, mid.y, mid.z, 0, Math.atan2(-(z1 - z0), x1 - x0), PI / 2 + Math.atan2(y1 - y0, L) * 0, .006, d.length(), .006); } }
}
function apCalvary(G, x, z) {   // calvario all'incrocio: base a gradini, fusto, croce di pietra
  const M = AAA.mats, y = apY(x, z), st = M.stoneLight;
  G.add(st, ABX.box, x, y + .15, z, 0, .2, 0, 2, .4, 2); G.add(st, ABX.box, x, y + .5, z, 0, .2, 0, 1.3, .35, 1.3); G.add(st, ABX.box, x, y + 2.2, z, 0, .2, 0, .32, 3.2, .32);
  G.add(st, ABX.box, x, y + 3.45, z, 0, .2, 0, 1.2, .26, .26); G.add(M.rust, ABX.box, x + .05, y + 3.2, z + .12, 0, .2, 0, .2, .55, .04);
  const s = addSolid(x - 1, y - .2, z - 1, x + 1, y + .7, z + 1, 'wall'); s.mat = 'muratura'; OBST.push({ x, z, r: .3 });
}
function apSign(G, x, z, ry, txt) {
  const M = AAA.mats, y = apY(x, z); G.add(M.woodOld, ABX.box, x, y + 1.1, z, 0, ry, 0, .1, 2.2, .1);
  const tex = aaaCanvasTex(512, 96, (g, w, h) => { g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2a'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); g.fillStyle = 'rgba(80,60,40,.25)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }, false);
  const m = aaaPatch(new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), { key: 'sign' }), g = new THREE.BoxGeometry(1.3, .26, .03), mesh = new THREE.Mesh(g, m);
  mesh.position.set(x + Math.cos(ry) * .55, y + 1.85, z - Math.sin(ry) * .55); mesh.rotation.y = ry; mesh.castShadow = true; scene.add(mesh);
}
// Sherman del gioco (modello M4A1 di Kasserine), fermo, con usura e polvere; sacchi a terra e bagagli sul ponte
function apSherman(x, z, yaw) {
  const G0 = kasShermanGeo(), g = groupMesh(G0.hull), tg = groupMesh(G0.tur), gg = groupMesh(G0.gun);
  tg.position.set(0, G0.turY, G0.turZ); gg.position.set(0, G0.gunY, G0.gunZ); tg.add(gg); g.add(tg); tg.rotation.y = .35; gg.rotation.x = .04;
  const by = Math.min(aaaH(x, z), aaaH(x + 2, z), aaaH(x - 2, z));
  // vernice verde oliva consumata con ruggine (Poly Haven, CC0) sopra i colori del modello; fango e umidità in basso
  const mat = (typeof TEXH !== 'undefined' && TEXH.sherman) ? aaaTri('metal', .9, { vc: true, hq: 'sherman', hqScale: .7, nStrHQ: .9, rough: .85, metal: .25, macro: .25, damp: 1.6, baseY: by + .35, color: 0xffffff, key: 'shermanhq' })
    : wearMaterial(shipPlateMat(), { grime: .85, chips: .35, rust: .06, low: 1.6, scale: 1 });
  if (!(typeof TEXH !== 'undefined' && TEXH.sherman)) aaaPatch(mat, { key: 'sherman' }); else mat.color.setRGB(2.1, 2.1, 1.9);   // i colori del modello (oliva scuro) moltiplicano la vernice: compenso
  g.traverse(o => { if (o.isMesh) { if (o.material && o.material.vertexColors) o.material = mat; o.castShadow = o.receiveShadow = true; } });
  const fy = (dx, dz) => aaaH(x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz);
  const yf = fy(0, -2.6), yb = fy(0, 2.6), yl = fy(-1.3, 0), yr = fy(1.3, 0);
  g.position.set(x, Math.min(yf, yb, yl, yr) + .02, z); AAA.sherman = { g, yf, yb, yl, yr }; g.rotation.set(Math.atan2(yf - yb, 5.2), yaw, Math.atan2(yr - yl, 2.6), 'YXZ'); scene.add(g);
  const G = new AGeo(), M = AAA.mats; g.updateMatrixWorld(true);
  const L = (lx, ly, lz) => new V3(lx, ly, lz).applyMatrix4(g.matrixWorld);
  // sacchi a terra sulla piastra frontale (pratica documentata in Normandia), bagagli e taniche sul ponte motore
  const sack = apLathe('sack', [[0, -.5], [.35, -.42], [.5, -.1], [.5, .1], [.35, .42], [0, .5]], 10);
  for (let r_ = 0; r_ < 2; r_++) for (let i = 0; i < 4; i++) { const p = L(-.75 + i * .5, 1.55 + r_ * .18, -2.55 + r_ * .15); G.add(M.sack, sack, p.x, p.y, p.z, PI / 2 - .5, yaw + PI / 2, 0, .6, .55, .34); }
  for (let i = 0; i < 3; i++) { const p = L(-.6 + i * .6, 2.15, 1.9); G.add(M.cloth, ABX.cyl, p.x, p.y, p.z, 0, yaw, PI / 2, .16, .55, .16, [0x5a5a3a, 0x4a4a32, 0x6a6448][i]); }
  for (const k of [-1, 1]) { const p = L(k * 1.45, 1.75, 2.3); G.add(M.paint, ABX.box, p.x, p.y, p.z, 0, yaw, 0, .17, .47, .34, 0x4a4e32); }
  G.build();
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), ex = 1.4 * c + 3 * s, ez = 1.4 * s + 3 * c;
  const sol = addSolid(x - ex, g.position.y - .3, z - ez, x + ex, g.position.y + 2.8, z + ez, 'tank'); sol.mat = 'acciaio';
  return g;
}
