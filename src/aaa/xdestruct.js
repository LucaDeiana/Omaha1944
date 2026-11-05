"use strict";
// ============================================================
//  AAA Dynamic Battlefield & Destruction 3.0 — DYNAMIC DESTRUCTION LAB (solo tech demo, SCEN 'aaa').
//  Non sostituisce Distruzione 3.0 del gioco (src/destruction.js, DZ): ne riusa materiali (DZ_MAT), budget degli incendi,
//  perdita delle coperture (dzCoverLost), suoni ed effetti; aggiunge ciò che lì manca, solo nella demo:
//   · pannelli FRATTURATI (kit Blender di celle di Voronoi, assets/aaa/destruction/fracture_kit.glb): il danno toglie
//     le celle nel punto d'impatto, quindi i fori e le brecce stanno dove si colpisce; un collider per cella;
//   · grafo dei supporti: pannello sul pannello sotto (o sul terreno), architrave sui vicini, solaio e tetto sui muri,
//     tavolato sui pilastri, travi sui pilastri; ciò che resta senza appoggio crolla (con un breve preavviso);
//   · detriti con fisica (gravità, rimbalzo, attrito, sonno): i grandi restano come macerie con collider e copertura;
//   · crateri veri sul terreno della demo (griglie fisiche Hf, mesh, normali, materiale) con terra sollevata sul bordo;
//   · incendi del legno con propagazione limitata e deterministica, annerimento, fumo;
//   · griglia di navigazione locale aggiornata solo dove cambiano i collider; coperture che nascono e muoiono;
//   · snapshot serializzabile (reset, ripetizione, sincronizzazione futura); scenari A–E con seme; pannello F3.
//  Due edifici di prova nel cortile del laboratorio (sud-est): casa normanna in pietra e fienile a struttura di legno.
// ============================================================
const XDZ = {
  on: false, ready: false, kit: null, pools: new Map(), panels: [], beams: [], roofs: [], floors: [], bldgs: [], bodies: [], decals: null, decN: 0, DEC_MAX: 600,
  fires: [], FIRE_MAX: 8, craters: [], CRATER_MAX: 40, BODY_MAX: 60, PIECE_MAX: 260, pieces: 0, log: [], events: [], nav: null, rng: null,
  st: { hits: 0, blasts: 0, cells: 0, removed: 0, collapses: 0, updMs: 0, colMs: 0, navMs: 0, craterMs: 0, bodies: 0, sleeping: 0 },
};
const XDZ_ST = ['INTEGRO', 'DANNO LEGGERO', 'DANNO MEDIO', 'DANNO GRAVE', 'CROLLATO'];
// armi: danno per cella e raggio d'azione. Le armi leggere non sfondano la pietra (danno sotto la soglia del materiale)
const XDZ_WPN = {
  fucile: { dmg: 55, r: 0, he: 0 }, mitra: { dmg: 30, r: 0, he: 0 }, mg: { dmg: 65, r: 0, he: 0 },
  granata: { dmg: 520, r: 2.6, he: 1, crater: [1.3, .35] }, carro: { dmg: 2600, r: .95, he: 1, crater: [2.2, .6] }, bombardamento: { dmg: 4200, r: 3.6, he: 1, crater: [4.2, 1.3] },
};
// resistenza delle celle: soglia (sotto non c'è danno strutturale, solo segni), punti per m³
const XDZ_MAT = { mattoni: { thr: 120, hp: 1700, dust: [.6, .48, .4], snd: 'dz_crumble', imp: 'stone', col: 0xc8a090 }, intonaco: { thr: 150, hp: 2000, dust: [.72, .7, .64], snd: 'dz_crumble', imp: 'stone', col: 0xe6dcc4 }, tegole: { thr: 20, hp: 300, dust: [.55, .4, .32], snd: 'dz_crumble', imp: 'stone', col: 0x9a5a42 }, pietra: { thr: 160, hp: 2200, dust: [.66, .63, .56], snd: 'dz_crumble', imp: 'stone', col: 0xd8d0bc }, legno: { thr: 28, hp: 520, dust: [.45, .38, .3], snd: 'dz_wood', imp: 'wood', col: 0xb8a088, flam: 1 }, ardesia: { thr: 20, hp: 300, dust: [.4, .42, .45], snd: 'dz_crumble', imp: 'stone', col: 0x5a6068 } };

// ---------------------------------------------------------------- kit di frattura (GLB Blender)
async function xdzLoadKit() {
  if (XDZ.kit) return XDZ.kit;
  if (!window.FRAC_GLB) await aaaLoadScript('assets/aaa/destruction/fracture_kit.js');
  if (!THREE.GLTFLoader) await aaaLoadScript('assets/lib/three/examples/js/GLTFLoader.js');
  const bin = Uint8Array.from(atob(FRAC_GLB.glb), c => c.charCodeAt(0)), g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin.buffer, '', res, rej));
  const kit = {}, rot = new THREE.Matrix4().makeRotationX(PI / 2);   // glTF (Y in alto) → spazio del pannello: x lungo il muro, y altezza, z spessore
  g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => {
    if (!o.isMesh) return; const m = o.name.match(/^(frac_stone|frac_wood|frac_beam|rubble)_(\d+)/); if (!m) return;
    const geo = o.geometry.clone(); geo.applyMatrix4(rot); geo.computeBoundingBox(); geo.computeBoundingSphere();
    const c = new V3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(rot), vol = (() => { const b = geo.boundingBox; return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z) * .55; })();
    (kit[m[1]] || (kit[m[1]] = []))[+m[2]] = { geo, c, vol };
  });
  for (const k in kit) kit[k] = kit[k].filter(Boolean);
  XDZ.kit = kit; XDZ.kitMan = FRAC_GLB.manifest; FRAC_GLB.glb = null; return kit;
}
// materiali: quelli triplanari della demo (coordinate del mondo), con colore per istanza (annerimento, polvere)
function xdzMat(key) {
  XDZ.mats = XDZ.mats || {}; if (XDZ.mats[key]) return XDZ.mats[key]; const M = aaaMats();
  const base = key === 'pietra' ? aaaTri('cobble', .36, { nStr: 1.7, macro: .26, moss: .6, damp: .8, color: 0xd0c6b0, hq: 'muro_pietra', hqScale: .45, key: 'xdzstone' })
    : key === 'legno' ? aaaTri('wood', .7, { nStr: 1.3, macro: .3, color: 0xa08a70, hq: 'tavole_fienile', hqScale: .5, key: 'xdzwood' })
    : key === 'trave' ? aaaTri('wood', .9, { nStr: 1.1, macro: .25, color: 0x7a6a58, hq: 'tavole_vecchie', hqScale: .6, key: 'xdzbeam' })
    : key === 'mattoni' ? aaaTri('brick', .75, { nStr: 1.3, macro: .2, damp: 1, moss: .5, color: 0xc8a898, hq: 'mattoni', hqScale: .55, key: 'xdzbrick' })
    : key.startsWith('intonaco') ? aaaTri('plaster', .45, { nStr: 1, macro: .28, damp: 1.2, moss: .4, color: key.includes(':') ? +key.split(':')[1] : 0xffffff, hq: 'intonaco_pietra', hqScale: .42, key: 'xdzplaster' + key })
    : key === 'tegole' ? aaaTri('stone', .9, { nStr: 1, macro: .25, color: 0x9a5a42, rough: .8, key: 'xdztile' })
    : aaaTri('stone', .9, { nStr: 1, macro: .2, color: 0x5e646c, rough: .6, key: 'xdzslate' });
  return (XDZ.mats[key] = base);
}
// un'InstancedMesh per (cella del kit, materiale): pochi draw call anche con molti pannelli
function xdzPool(tpl, k, mat) {
  const key = tpl + k + mat; let P_ = XDZ.pools.get(key); if (P_) return P_;
  const cap = 2048, im = new THREE.InstancedMesh(XDZ.kit[tpl][k].geo, xdzMat(mat), cap); im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im); P_ = { im, n: 0, cap }; XDZ.pools.set(key, P_); return P_;
}
const _xm = new THREE.Matrix4(), _xq = new THREE.Quaternion(), _xs = new V3(), _xp = new V3(), _xe = new THREE.Euler(), _xdzC = new THREE.Color(), _xZ = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------------------------------------------------------------- componenti
// pannello fratturato: centro, rotazione attorno a y, dimensioni (w lungo il muro, h, t spessore), materiale, modello di frattura
function xdzPanel(b, role, mat, tpl, cx, cy, cz, ry, w, h, t, o = {}) {
  const kit = XDZ.kit[tpl], M = XDZ_MAT[mat === 'trave' ? 'legno' : mat.split(':')[0]], p = { id: `${b.id}/${role}${b.parts.length}`, b, role, mat, tpl, c: new V3(cx, cy, cz), ry, w, h, t, cells: [], state: 0, supp: true, sup: [], lat: [], covers: [], structural: o.structural ?? true, dead: false, burn: 0, M, o };
  p.mk = String(mat).startsWith('intonaco') ? 'intonaco' : mat; p.tint = String(mat).startsWith('intonaco') ? new THREE.Color(+(String(mat).split(':')[1] || 0xe2d6bc)).multiplyScalar(1.55) : new THREE.Color(0xffffff);   // la texture d'intonaco è scura: il colore della calce la schiarisce   // intonaci: un materiale, colore per istanza
  _xq.setFromAxisAngle(_xp.set(0, 1, 0), ry); if (o.vertical) _xq.multiply(new THREE.Quaternion().setFromAxisAngle(_xp.set(0, 0, 1), PI / 2));   // pilastro: l'asse lungo del modello diventa verticale
  p.m = new THREE.Matrix4().compose(p.c, _xq.clone(), o.vertical ? new V3(h, w, t) : new V3(w, h, t));
  kit.forEach((K, k) => {
    const P_ = xdzPool(tpl, k, p.mk); if (P_.n >= P_.cap) return; const i = P_.n++; P_.im.count = P_.n; P_.im.setColorAt(i, p.tint); P_.im.instanceColor.needsUpdate = true;
    const mi = p.m.clone().multiply(new THREE.Matrix4().makeTranslation(K.c.x, K.c.y, K.c.z)); P_.im.setMatrixAt(i, _xZ); P_.im.instanceMatrix.needsUpdate = true;   // nascosta finché il pannello è integro
    const wp = K.c.clone().applyMatrix4(p.m), bb = K.geo.boundingBox.clone().applyMatrix4(mi), sh = bb.getSize(new V3()).multiplyScalar(.08);
    const vol = K.vol * w * h * t, cell = { p, k, P: P_, i, mi, wp, hp: Math.max(40, vol * M.hp), max: 0, alive: true, vol, bb };
    cell.max = cell.hp; cell.sol = addSolid(bb.min.x + sh.x, bb.min.y + sh.y, bb.min.z + sh.z, bb.max.x - sh.x, bb.max.y - sh.y, bb.max.z - sh.z, 'xdz_' + mat); solids.pop(); cell.sol.mat = mat === 'pietra' ? 'muratura' : 'legno'; cell.sol.xdz = cell;   // entra nella lista dei solidi solo quando il pannello si apre
    p.cells.push(cell);
  });
  // collider unico del pannello integro (pochi solidi a riposo: il giocatore e l'audio li scorrono a ogni fotogramma)
  { const bb = new THREE.Box3(); for (const c of p.cells) bb.union(c.bb); p.sol = addSolid(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, 'xdz_' + mat); p.sol.mat = mat === 'pietra' ? 'muratura' : 'legno'; p.sol.xdzPanel = p; }
  // pelle integra: una superficie unica (niente giunti di frattura visibili su un muro sano); le celle compaiono al primo distacco
  const SK = xdzSkinPool(p.mk); if (o.noSkin) p.noSkin = true; else if (SK.n < SK.cap) { p.skin = SK.n++; SK.im.count = SK.n; SK.im.setMatrixAt(p.skin, p.m); SK.im.setColorAt(p.skin, p.tint); SK.im.instanceColor.needsUpdate = true; SK.im.instanceMatrix.needsUpdate = true; p.SK = SK; }
  p.n0 = p.cells.length; b.parts.push(p); XDZ.panels.push(p); return p;
}
function xdzSkinPool(mat) {
  const key = 'skin' + mat; let P_ = XDZ.pools.get(key); if (P_) return P_; const g = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(g, xdzMat(mat), 2048); im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2048 * 3).fill(1), 3); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
  P_ = { im, n: 0, cap: 2048 }; XDZ.pools.set(key, P_); return P_;
}
// apertura del pannello: via la pelle, dentro le celle ancora vive (con la loro tinta)
function xdzOpenPanel(p) {
  if (p.opened) return; p.opened = true; if (p.run && p.run.sol.on) xdzSplitRun(p.run);
  if (p.sol) { p.sol.on = false; const i = solids.indexOf(p.sol); if (i >= 0) solids.splice(i, 1); } for (const c of p.cells) if (c.alive) solids.push(c.sol);
  if (p.SK) { p.SK.im.setMatrixAt(p.skin, _xZ); p.SK.im.instanceMatrix.needsUpdate = true; }
  for (const c of p.cells) if (c.alive) { c.P.im.setMatrixAt(c.i, c.mi); c.P.im.instanceMatrix.needsUpdate = true; }
}
// vano reale dentro il riquadro di un pannello: misure (comuni con il generatore Blender urban_house.py) e pezzi di riempimento [a0, a1, y0, y1]
const XDZ_WIN = { w: .95, sill: .3, top: .15 }, XDZ_DOOR = { w: 1.05, h: 2.15 };
function xdzOpening(F, door, pw, ph, a, yb, base) {
  const A0 = a - pw / 2, A1 = a + pw / 2;
  if (door) { const w = Math.min(XDZ_DOOR.w, pw - .5), y0 = base, y1 = base + XDZ_DOOR.h, Y1 = yb + 2 * ph; return { a, w, y0, y1, fill: [[A0, a - w / 2, yb, Y1], [a + w / 2, A1, yb, Y1], [a - w / 2, a + w / 2, y1, Y1], [a - w / 2, a + w / 2, yb, y0]] }; }
  const w = Math.min(XDZ_WIN.w, pw - .6), y0 = yb + XDZ_WIN.sill, y1 = yb + ph - XDZ_WIN.top, Y1 = yb + ph;
  return { a, w, y0, y1, fill: [[A0, a - w / 2, yb, Y1], [a + w / 2, A1, yb, Y1], [a - w / 2, a + w / 2, yb, y0], [a - w / 2, a + w / 2, y1, Y1]] };
}
function xdzSplitRun(run) {
  run.sol.on = false; const i = solids.indexOf(run.sol); if (i >= 0) solids.splice(i, 1);
  for (const q of run.ps) if (!q.opened && !q.dead && q.sol) { q.sol.on = true; solids.push(q.sol); }
}
// colonne di pannelli integri contigui (stessa facciata, stessa colonna): un solo collider finché nessuno si apre
function xdzMakeRuns(b) {
  for (const face of b.grid) for (const col of face) {
    let run = null; const flush = () => { if (run && run.ps.length > 1) { const bb = new THREE.Box3(); for (const q of run.ps) { bb.expandByPoint(q.sol.min); bb.expandByPoint(q.sol.max); const k = solids.indexOf(q.sol); if (k >= 0) solids.splice(k, 1); q.run = run; } run.sol = addSolid(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, 'xdz_' + run.ps[0].mat); run.sol.mat = run.ps[0].sol.mat; run.sol.xdzRun = run; } run = null; };
    for (const q of col) { if (!q) { flush(); continue; } (run || (run = { ps: [] })).ps.push(q); } flush();
  }
}
function xdzAlive(p) { return p.cells.reduce((a, c) => a + (c.alive ? 1 : 0), 0) / Math.max(1, p.n0); }
function xdzState(p) { if (p.dead) return 4; const f = xdzAlive(p); return f <= 0 ? 4 : f < .5 ? 3 : f < .97 ? 2 : p.hits > 0 ? 1 : 0; }
// tetto o solaio: segmento rigido (geometria unita), appoggiato su pannelli o travi; crolla in blocco
function xdzSlab(b, role, geo, mat, supports, o = {}) {
  let mesh, bb; if (geo.isObject3D) { mesh = geo; scene.add(mesh); mesh.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(mesh); } else { mesh = new THREE.Mesh(geo, xdzMat(mat)); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); geo.computeBoundingBox(); bb = geo.boundingBox.clone(); }
  const s = { id: `${b.id}/${role}${b.parts.length}`, b, role, mesh, mat, sup: supports, supp: true, dead: false, state: 0, bb, sols: [], floors: [], o, structural: true, burn: 0 };
  if (o.solid !== false) { const B = s.bb, so = addSolid(B.min.x, B.min.y, B.min.z, B.max.x, B.min.y + Math.min(.4, B.max.y - B.min.y), B.max.z, 'xdz_' + role); so.mat = 'legno'; if (o.walk) so.walk = true; s.sols.push(so); }
  if (o.floor) { const F = Object.assign({ xdz: s.id }, o.floor); FLOORS.push(F); s.floors.push(F); }
  b.parts.push(s); (role === 'roof' ? XDZ.roofs : XDZ.floors).push(s); return s;
}

// ---------------------------------------------------------------- edifici di prova
// casa normanna in pietra: 8 × 6,4 m, due piani (3 m), muri di 0,55 m a pannelli (≈ 1,9 × 1,5 m), porta e finestre,
// solaio di legno su due travi, tetto a due falde in tre campate per lato (ardesia)
// edificio in muratura parametrico (casa del laboratorio e isolati dell'Urban Expansion 3.0):
// cfg: w, d, piani (1–3), mat ('pietra' | 'mattoni' | 'intonaco:colore'), tetto ('ardesia' | 'tegole'), pitch,
//      fori: { s|n|o|e: [[colonna, fila], …] } (finestre), porta: [colonna] sul fronte (+z), aperta: porta aperta,
//      scala: scala interna al primo piano, persiane: le finestre chiuse da ante di legno (distruttibili)
function xdzHouse(id, x, z, cfg = {}) {
  const C = Object.assign({ w: 8, d: 6.4, piani: 2, mat: 'pietra', tetto: 'ardesia', pitch: .8, porta: [1], aperta: true, fori: { s: [[3, 2]], n: [[1, 1]], o: [[1, 2]], e: [] }, scala: false, persiane: false, tipo: 'casa', fronte: 's' }, cfg);
  const b = { id, kind: C.tipo, x, z, w: C.w, d: C.d, parts: [], base: 0, cfg: C }, t = .55, sh = 3, nr = C.piani * 2;
  let lo = 1e9; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, Hf(x + a * b.w / 2, z + c * b.d / 2)); b.base = lo + .02; const y0 = b.base - .35;
  const H = C.piani * sh + .35, ph = H / nr, M0 = C.mat.split(':')[0];
  const faces = [
    { k: 's', ax: 'x', fixed: z + b.d / 2 - t / 2, a0: x - b.w / 2, a1: x + b.w / 2, ry: 0 },
    { k: 'n', ax: 'x', fixed: z - b.d / 2 + t / 2, a0: x - b.w / 2, a1: x + b.w / 2, ry: PI },
    { k: 'o', ax: 'z', fixed: x - b.w / 2 + t / 2, a0: z - b.d / 2 + t, a1: z + b.d / 2 - t, ry: PI / 2 },
    { k: 'e', ax: 'z', fixed: x + b.w / 2 - t / 2, a0: z - b.d / 2 + t, a1: z + b.d / 2 - t, ry: -PI / 2 },
  ];
  b.grid = []; b.openings = [];
  for (const F of faces) {
    const L = F.a1 - F.a0, nc = Math.max(2, Math.round(L / 1.9)), pw = L / nc, col = [], holes = (C.fori[F.k] || []).map(h => h[0] + ',' + h[1]);
    if (F.k === C.fronte) for (const c of C.porta) holes.push(c + ',0', c + ',1');
    for (let c = 0; c < nc; c++) { const stack = []; for (let r = 0; r < nr; r++) {
      const a = F.a0 + (c + .5) * pw, yc = y0 + (r + .5) * ph, [px, pz] = F.ax === 'x' ? [a, F.fixed] : [F.fixed, a];
      if (holes.includes(c + ',' + r)) {
        stack.push(null); const door = F.k === C.fronte && C.porta.includes(c) && r <= 1;
        if (door && r === 1) continue;   // la porta occupa due file: già trattata con la fila 0
        // vano di misura vera (finestra 0,95 × ph − 0,45; porta 1,05 × 2,15) con riempimenti di pietra fratturati attorno
        const O = xdzOpening(F, door, pw, ph, a, y0 + r * ph, b.base); O.face = F.k; O.c = c; O.r = r; O.door = door; O.px = px; O.pz = pz; O.ry = F.ry; O.parts = []; b.openings.push(O);
        for (const [ra, rb, ya, yb] of O.fill) { if (rb - ra < .04 || yb - ya < .04) continue; const ac = (ra + rb) / 2, [qx, qz] = F.ax === 'x' ? [ac, F.fixed] : [F.fixed, ac]; const q = xdzPanel(b, 'riempimento', C.mat, 'frac_stone', qx, (ya + yb) / 2, qz, F.ry, rb - ra + .01, yb - ya + .01, t, { structural: false }); q.hang = true; q.face = F; q.open = O; O.parts.push(q); }
        // porta chiusa o persiane: anta di legno nel vano (non portante, distruttibile)
        if ((door && !C.aperta) || (!door && C.persiane)) { const [qx, qz] = F.ax === 'x' ? [O.a, F.fixed] : [F.fixed, O.a]; const q = xdzPanel(b, door ? 'porta' : 'persiana', 'legno', 'frac_wood', qx, (O.y0 + O.y1) / 2, qz, F.ry, O.w - .04, O.y1 - O.y0 - .02, .06, { structural: false, noSkin: !!C.dettagli }); q.door = door; q.hang = true; q.open = O; O.leaf = q; }
        continue;
      }
      const p = xdzPanel(b, 'muro', C.mat, 'frac_stone', px, yc, pz, F.ry, pw + .01, ph + .01, t); p.face = F; p.col = c; p.row = r; stack.push(p);
    } col.push(stack); }
    for (let c = 0; c < nc; c++) for (let r = 0; r < nr; r++) { const p = col[c][r]; if (!p) continue; p.ground = r === 0; if (r > 0 && col[c][r - 1]) p.sup.push(col[c][r - 1]); for (const dc of [-1, 1]) { const q = col[c + dc] && col[c + dc][r]; if (q) p.lat.push(q); } }
    b.grid.push(col);
  }
  // ante: appese ai pannelli vicini della stessa facciata
  for (const q of b.parts.filter(q => q.hang)) q.sup = XDZ.panels.filter(p => p.b === b && p.role === 'muro' && p.c.distanceTo(q.c) < Math.max(q.w, q.h) / 2 + 2.2);
  const south = b.grid[0], north = b.grid[1], top = y0 + H, ix0 = x - b.w / 2 + t, ix1 = x + b.w / 2 - t, iz0 = z - b.d / 2 + t, iz1 = z + b.d / 2 - t;
  FLOORS.push({ x0: ix0, x1: ix1, z0: iz0, z1: iz1, y: b.base + .01, xdz: id });
  { const g = new THREE.BoxGeometry(b.w - 2 * t, .08, b.d - 2 * t); g.translate(x, b.base - .03, z); const m = new THREE.Mesh(g, aaaMats().stoneDark); m.receiveShadow = true; scene.add(m); b.ground = m; }
  // solai su travi (lungo z) appoggiate ai pannelli dei muri lunghi sotto il solaio; scala (rampa) al primo solaio
  b.levels = [{ y: b.base, nome: 'pianterreno' }];
  for (let s = 1; s < C.piani; s++) {
    const fy = b.base + s * sh, beams = [];
    for (const bx of [x - b.w / 4, x + b.w / 4]) {
      const geo = new THREE.BoxGeometry(.24, .28, b.d - 2 * t + .3); geo.translate(bx, fy - .14, z); const sl = xdzSlab(b, 'trave', geo, 'trave', [], { solid: false });
      const near = face => face.map(col => col[2 * s - 1]).filter(Boolean).sort((a, c) => Math.abs(a.c.x - bx) - Math.abs(c.c.x - bx))[0];
      sl.sup = [near(south), near(north)].filter(Boolean); beams.push(sl);
    }
    const L = Math.min(sh / .66, b.w - 2 * t - 1.4), xs0 = ix0 + .25, xs1 = xs0 + L, zs1 = iz0 + 1, stair = C.scala && s === 1;
    const rects = stair ? [[ix0, ix1, zs1, iz1], [xs1 - .02, ix1, iz0, zs1], [ix0, xs0 - .05, iz0, zs1]] : [[ix0, x, iz0, iz1], [x, ix1, iz0, iz1]];
    for (const [a0, a1, c0, c1] of rects) { if (a1 - a0 < .1) continue; const geo = new THREE.BoxGeometry(a1 - a0, .07, c1 - c0); geo.translate((a0 + a1) / 2, fy + .035, (c0 + c1) / 2); xdzSlab(b, 'solaio', geo, 'legno', beams, { walk: true, floor: { x0: a0, x1: a1, z0: c0, z1: c1, y: fy + .07 } }); }
    if (stair) {   // scala di legno: gradini (geometria unita) e rampa percorribile, appoggiate alle travi del solaio
      const n = Math.round(sh / .19), gs = []; for (let i = 0; i < n; i++) { const g = new THREE.BoxGeometry(L / n + .01, .06, .92); g.translate(xs0 + (i + .5) * L / n, b.base + (i + 1) * (sh + .07) / n - .03, iz0 + .48); gs.push(g.toNonIndexed()); }
      const sg = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(gs) : aaaMerge(gs);
      const st = xdzSlab(b, 'scala', sg, 'trave', beams, { solid: false, floor: { x0: xs0, x1: xs1, z0: iz0, z1: zs1, y: 0, ramp: { axis: 'x', c0: xs0, c1: xs1, y0: b.base + .01, y1: fy + .07 } } }); st.stair = true;
    }
    b.levels.push({ y: fy, nome: s === 1 ? 'primo piano' : 'secondo piano', scala: stair });
  }
  b.levels.push({ y: top, nome: 'soffitta (non accessibile)' });
  const pitch = C.pitch, W = b.d / 2 + .35, rh = (b.d / 2) * Math.tan(pitch), nb = Math.max(2, Math.round(b.w / 2.8));
  for (const sd of [-1, 1]) for (let k = 0; k < nb; k++) {
    const u0 = x - b.w / 2 - .3 + k * (b.w + .6) / nb, u1 = u0 + (b.w + .6) / nb, g = C.dettagli ? xdzRoofBay(Math.max(u0, x - b.w / 2 - .14), Math.min(u1, x + b.w / 2 + .14), z, sd, top, W, rh, pitch, C.tetto === 'tegole' ? 'clay' : 'slate', [k === 0 ? -1 : 0, k === nb - 1 ? 1 : 0].filter(Boolean), (id.length * 131 + k * 17 + sd * 7) | 0, C.danni ? .6 : .35) : xdzRoofGeo(u0, u1, z, sd, top, W, rh, pitch);
    const wallRow = (sd > 0 ? south : north), sup = wallRow.map(c => c[nr - 1]).filter(p => p && Math.abs((p.c.x) - (u0 + u1) / 2) < (u1 - u0) / 2 + .6);
    const gab = b.grid[k === 0 ? 2 : k === nb - 1 ? 3 : -1]; if (gab) for (const c of gab) if (c[nr - 1]) sup.push(c[nr - 1]);
    xdzSlab(b, 'roof', g, C.tetto, sup, { solid: true });
  }
  for (const sd of [-1, 1]) { const sh2 = new THREE.Shape(); sh2.moveTo(-b.d / 2, 0); sh2.lineTo(b.d / 2, 0); sh2.lineTo(0, rh); sh2.lineTo(-b.d / 2, 0); const g = new THREE.ExtrudeGeometry(sh2, { depth: t, bevelEnabled: false }); g.rotateY(PI / 2); g.translate(x + sd * (b.w / 2) - (sd > 0 ? t : 0), top, z); const sl = xdzSlab(b, 'timpano', g, C.mat, b.grid[sd < 0 ? 2 : 3].map(c => c[nr - 1]).filter(Boolean), { solid: true }); sl.isGable = true; sl.side = sd; if (sl.mesh.isMesh && String(C.mat).startsWith('intonaco')) sl.mesh.material = xdzMat(C.mat); }
  xdzMakeRuns(b);
  aaaRoom(ix0, b.base - .3, iz0, ix1, top + rh, iz1); b.room = AAA.rooms[AAA.rooms.length - 1]; b.top = top + rh; b.M0 = M0;
  XDZ.bldgs.push(b); return b;
}
// falda di una campata (tavolato + file di lastre sfalsate), lato s (+1 verso +z, -1 verso -z); top = quota della gronda sul muro
function xdzRoofGeo(u0, u1, z, s, top, W, rh, pitch) {
  const tn = Math.tan(pitch), d2 = rh / tn, yE = top - (W - d2) * tn, yR = top + rh, L = Math.hypot(W, yR - yE), up = new V3(0, Math.sin(pitch), -s * Math.cos(pitch)), nrm = new V3(0, Math.cos(pitch), s * Math.sin(pitch));
  const ctr = new V3((u0 + u1) / 2, (yE + yR) / 2, z + s * W / 2), geos = [], ang = s * pitch;
  const deck = new THREE.BoxGeometry(u1 - u0, .05, L); deck.rotateX(ang); deck.translate(ctr.x, ctr.y, ctr.z); geos.push(deck);
  const rows = Math.round(L / .22), n = Math.max(2, Math.round((u1 - u0) / .3)), sr = seeded(Math.round(u0 * 13 + s * 7 + z));
  for (let r = 0; r < rows; r++) { const k = (r + .5) / rows - .5; for (let i = 0; i < n; i++) { const off = (r % 2) * .5, uu = u0 + (i + .5 + off) * (u1 - u0) / (n + .5); if (uu > u1 - .08) continue; const g = new THREE.BoxGeometry((u1 - u0) / n - .015, .02, .34); g.rotateX(ang + .05 * s); const p = ctr.clone().addScaledVector(up, k * L).addScaledVector(nrm, .045 + sr() * .01); g.translate(uu, p.y, p.z); geos.push(g); } }
  const ng = geos.map(g => g.index ? g.toNonIndexed() : g); return THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(ng) : aaaMerge(ng);
}
// fienile a struttura di legno: pilastri (travi fratturabili), correnti in alto, tavolato fra i pilastri, tetto in tre campate
function xdzBarn(id, x, z) {
  const b = { id, kind: 'fienile', x, z, w: 10, d: 7, parts: [], base: 0 }, Hh = 4.2, t = .12;
  let lo = 1e9; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, Hf(x + a * b.w / 2, z + c * b.d / 2)); b.base = lo + .02;
  const posts = {}, P = (px, pz) => { const k = px.toFixed(2) + ',' + pz.toFixed(2); if (posts[k]) return posts[k]; const p = xdzPanel(b, 'pilastro', 'trave', 'frac_beam', px, b.base + Hh / 2 - .15, pz, 0, .26, Hh + .3, .26, { structural: true, vertical: true }); p.ground = true; p.isPost = true; return (posts[k] = p); };
  const xs = [-5, -2.5, 0, 2.5, 5].map(v => x + v), zs = [-3.5, 0, 3.5].map(v => z + v);
  for (const px of xs) { P(px, z - b.d / 2); P(px, z + b.d / 2); } for (const pz of zs) { P(x - b.w / 2, pz); P(x + b.w / 2, pz); }
  // tavolato: pannelli di legno fra pilastri consecutivi (due file in altezza), con un portone aperto a sud
  const runs = [[xs, z + b.d / 2, 0, 'x'], [xs, z - b.d / 2, PI, 'x'], [zs, x - b.w / 2, PI / 2, 'z'], [zs, x + b.w / 2, -PI / 2, 'z']];
  for (const [arr, fixed, ry, ax] of runs) for (let i = 0; i < arr.length - 1; i++) {
    const a0 = arr[i], a1 = arr[i + 1], pa = ax === 'x' ? P(a0, fixed) : P(fixed, a0), pb = ax === 'x' ? P(a1, fixed) : P(fixed, a1);
    if (ax === 'x' && fixed > z && i === 1) continue;   // portone (2,5 m) aperto
    for (let r = 0; r < 2; r++) { const a = (a0 + a1) / 2, yc = b.base - .1 + (r + .5) * (Hh / 2), [px, pz] = ax === 'x' ? [a, fixed] : [fixed, a]; const p = xdzPanel(b, 'tavolato', 'legno', 'frac_wood', px, yc, pz, ry, Math.abs(a1 - a0) - .27, Hh / 2 - .02, t, { structural: false }); p.sup.push(pa, pb); p.needAll = false; }
  }
  // correnti (travi in alto) lungo i lati lunghi, appoggiati ai pilastri
  const plates = [];
  for (const pz of [z - b.d / 2, z + b.d / 2]) for (let i = 0; i < xs.length - 1; i++) { const g = new THREE.BoxGeometry(xs[i + 1] - xs[i] + .2, .24, .24); g.translate((xs[i] + xs[i + 1]) / 2, b.base + Hh + .1, pz); const s = xdzSlab(b, 'corrente', g, 'trave', [P(xs[i], pz), P(xs[i + 1], pz)], { solid: false }); s.both = true; plates.push(s); }
  // tetto: tre campate per lato, appoggiate ai correnti sottostanti
  const pitch = .7, W = b.d / 2 + .4, rh = (b.d / 2) * Math.tan(pitch), top = b.base + Hh + .22;
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const u0 = xs[k] - (k === 0 ? .4 : 0), u1 = xs[k + 1] + (k === 3 ? .4 : 0), g = xdzRoofGeo(u0, u1, z, s, top, W, rh, pitch); const pz = z + s * b.d / 2; xdzSlab(b, 'roof', g, 'legno', plates.filter(q => Math.abs(q.bb.max.z - .12 - pz) < .3 && q.bb.max.x > u0 + .2 && q.bb.min.x < u1 - .2), { solid: true }); }
  FLOORS.push({ x0: x - b.w / 2, x1: x + b.w / 2, z0: z - b.d / 2, z1: z + b.d / 2, y: b.base + .01, xdz: id });
  { const M = aaaMats(), G = new AGeo(); for (let i = 0; i < 8; i++) apHay(G, x - 3.5 + (i % 4) * 1.1, z - 2.4 + Math.floor(i / 4) * 1.2, .1 * i, b.base); b.hay = G.build(); }
  XDZ.bldgs.push(b); return b;
}

// ---------------------------------------------------------------- danni localizzati
// colpo di arma leggera su una cella (dal ramo «solid» di playerFire): segno sempre, danno solo sopra la soglia del materiale
function xdzBullet(sol, p, dir, w) {
  let cell = sol && sol.xdz; if (!cell && sol && sol.xdzRun) { const q = sol.xdzRun.ps.filter(q => !q.dead).sort((a, c) => a.c.distanceTo(p) - c.c.distanceTo(p))[0]; if (q) sol = q.sol; }
  if (!cell && sol && sol.xdzPanel) cell = sol.xdzPanel.cells.filter(c => c.alive).sort((a, b) => a.wp.distanceTo(p) - b.wp.distanceTo(p))[0];
  if (!cell || !cell.alive) return false;
  const kind = w && (w.snd === 'mg42' || w.snd === 'bar') ? 'mg' : w && w.auto ? 'mitra' : 'fucile', W = XDZ_WPN[kind];
  XDZ.st.hits++; xdzDecal(p, dir, cell.p.mat); cell.p.hits = (cell.p.hits || 0) + 1;
  xdzHitCell(cell, W.dmg * (w && w.dmg ? w.dmg / 50 : 1), p, dir, kind);
  if (cell.p.state < 1 && cell.alive) { cell.p.state = 1; xdzEvent('DANNO_LEGGERO', cell.p.id); }
  return true;
}
// danno a una cella: sotto soglia solo segni; a zero punti la cella si stacca (detrito) e il pannello si rivaluta
function xdzHitCell(cell, dmg, p, dir, kind) {
  const p_ = cell.p, M = p_.M; if (!cell.alive) return;
  if (dmg < M.thr) { if (p && XDZ.rng() < .5) fxDebris(p, 1, .4); return; }
  cell.hp -= dmg; xdzTint(cell, .75 + .25 * Math.max(0, cell.hp / cell.max));
  if (cell.hp > 0) return; xdzRemoveCell(cell, p, dir, kind);
}
function xdzRemoveCell(cell, p, dir, kind, quiet) {
  if (!cell.alive) return; xdzOpenPanel(cell.p); cell.alive = false; XDZ.st.removed++; const P_ = cell.P; P_.im.setMatrixAt(cell.i, _xZ); P_.im.instanceMatrix.needsUpdate = true; cell.sol.on = false;
  const big = cell.vol > .06, imp = kind === 'carro' || kind === 'granata' || kind === 'bombardamento' || kind === 'crollo';
  if (!quiet) {
    if (big || imp) xdzBody(cell, dir, imp ? (kind === 'crollo' ? 1.2 : 6) : 2.2, p);
    else fxDebris(cell.wp, 4, .7);
    const c = cell.p.M.dust; for (let i = 0; i < 3; i++) PS_SMOKE.emit(cell.wp.x + rnd(-.3, .3), cell.wp.y + rnd(-.2, .3), cell.wp.z + rnd(-.3, .3), rnd(-.6, .6), rnd(.2, 1.2), rnd(-.6, .6), rnd(2, 4), 1, 4, c[0], c[1], c[2], .5, .5, -.03);
  }
  XDZ.dirty = true; XDZ.navDirty.push(cell.bb.clone()); xdzPanelEval(cell.p, kind);
}
// esplosione (granata, colpo di carro, bombardamento): tutte le celle nel raggio con attenuazione; uno schermo integro protegge
function xdzBlast(p, kind, o = {}) {
  const W = XDZ_WPN[kind], t0 = performance.now(); XDZ.st.blasts++; const R2 = W.r + .25;
  for (const pan of XDZ.panels) {
    if (pan.dead || pan.c.distanceTo(p) > R2 + Math.max(pan.w, pan.h)) continue;
    for (const c of pan.cells) { if (!c.alive) continue; const d = c.wp.distanceTo(p); if (d > R2) continue; let k = Math.pow(1 - d / R2, 1.2); if (o.dir && d > .3) { const v = c.wp.clone().sub(p).normalize(); if (v.dot(o.dir) < -.2) k *= .3; } xdzHitCell(c, W.dmg * k, c.wp, o.dir || c.wp.clone().sub(p).normalize(), kind); }
  }
  for (const s of XDZ.roofs.concat(XDZ.floors)) if (!s.dead) { const c = s.bb.clampPoint(p, new V3()); if (c.distanceTo(p) < W.r * .7) xdzSlabFail(s, 'esplosione'); }
  // impulso ai detriti in movimento o addormentati vicini
  for (const B of XDZ.bodies) { const d = B.pos.distanceTo(p); if (d < W.r * 2.5) { const k = (1 - d / (W.r * 2.5)) * 8; B.vel.add(B.pos.clone().sub(p).normalize().multiplyScalar(k)); B.vel.y += k * .5; xdzWake(B); } }
  // incendio del legno vicino (deterministico dal seme dello scenario)
  if (W.he) for (const pan of XDZ.panels) if (pan.M.flam && !pan.dead && pan.c.distanceTo(p) < W.r + 1 && XDZ.rng() < .45) xdzIgnite(pan, p);
  if (W.crater && o.ground !== false) { const gy = Hf(p.x, p.z); if (p.y - gy < .8) xdzCrater(p, W.crater[0] * (.9 + XDZ.rng() * .2), W.crater[1]); }
  if (!o.noFx) xdzBoomFx(p, kind); XDZ.st.colMs += performance.now() - t0;
}
// esplosioni del gioco nella demo (granate, razzi): stesso danno strutturale, effetti già prodotti da explode()
function xdzExplosion(p, radius) { if (!XDZ.ready) return; xdzBlast(p, radius >= 7 ? 'bombardamento' : radius >= 4.5 ? 'carro' : 'granata', { noFx: true }); }
// colpo di cannone: raggio dalla bocca; il primo collider colpito (cella, tetto, terreno) è il punto d'impatto
function xdzShell(o, d, o2 = {}) {
  const r = raySolids(o, d, 400), tt = rayTerrain(o, d, r ? r.t : 400); let t = r ? r.t : 400, onGround = false; if (tt >= 0 && tt < t) { t = tt; onGround = true; }
  const p = o.clone().addScaledVector(d, t); fxTracer && fxTracer(o.clone(), p.clone());
  xdzBlast(p.clone().addScaledVector(d, onGround ? 0 : .15), o2.kind || 'carro', { dir: d.clone(), ground: onGround || o2.ground });
  xdzEvent('COLPO_CARRO', r && r.s && (r.s.xdz || r.s.xdzPanel || r.s.xdzRun) ? (r.s.xdz ? r.s.xdz.p.id : r.s.xdzPanel ? r.s.xdzPanel.id : r.s.xdzRun.ps[0].id) : onGround ? 'terreno' : 'altro'); return p;
}
// effetti per tipo d'impatto: armi leggere (segni e schegge), granata, carro (lampo, onda di polvere, schegge, fumo), bombardamento
function xdzBoomFx(p, kind) {
  const big = kind === 'bombardamento', tank = kind === 'carro', k = big ? 2.4 : tank ? 1.4 : 1;
  flashLight(p.clone().add(new V3(0, .8, 0)), 0xffc070, 30 * k, .08 + .04 * k); fxDebris(p, Math.round(14 * k), 1.2 * k);
  for (let i = 0; i < 14 * k; i++) { const a = i / (14 * k) * TAU; PS_SMOKE.emit(p.x + Math.cos(a) * .4, p.y + .2, p.z + Math.sin(a) * .4, Math.cos(a) * 5 * k, rnd(.2, .8), Math.sin(a) * 5 * k, rnd(3, 6) * k, 1.6, 6 * k, .62, .58, .5, .7, .6, -.02); }   // onda di polvere
  for (let i = 0; i < 8 * k; i++) PS_SMOKE.emit(p.x + rnd(-.5, .5), p.y + rnd(0, 1.5), p.z + rnd(-.5, .5), rnd(-.6, .6), rnd(1.5, 3.5) * k, rnd(-.6, .6), rnd(4, 8) * k, 2.5, 10 * k, .28, .26, .24, .75, .5, -.05);
  sfxBoom(p, big ? 1.6 : tank ? 1.1 : .8); if (typeof P !== 'undefined' && P.pos && P.pos.distanceTo(p) < 40 * k) P.shake = (P.shake || 0) + .5 * k / Math.max(1, P.pos.distanceTo(p) / 10);
}
// segni dei proiettili: piccoli dischi scuri sulla superficie (pool a istanze, i più vecchi si riciclano)
function xdzDecal(p, dir, mat) {
  if (!XDZ.decals) { const g = new THREE.CircleGeometry(.045, 7); XDZ.decals = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), XDZ.DEC_MAX); XDZ.decals.count = 0; XDZ.decals.frustumCulled = false; scene.add(XDZ.decals); }
  const i = XDZ.decN++ % XDZ.DEC_MAX; XDZ.decals.count = Math.min(XDZ.DEC_MAX, XDZ.decN);
  const n = dir ? dir.clone().negate() : new V3(0, 0, 1); _xq.setFromUnitVectors(new V3(0, 0, 1), n); const s = mat === 'pietra' ? rnd(.8, 1.4) : rnd(.6, 1); _xm.compose(p.clone().addScaledVector(n, .012), _xq, _xs.set(s, s, 1)); XDZ.decals.setMatrixAt(i, _xm); XDZ.decals.instanceMatrix.needsUpdate = true;
  { const mk = mat === 'trave' ? 'legno' : String(mat).split(':')[0]; fxImpact(p.clone(), XDZ_MAT[mk] ? XDZ_MAT[mk].imp : 'stone'); } if (typeof sfxImpact === 'function' && P.pos.distanceTo(p) < 40) sfxImpact(p, mat === 'pietra' ? 'stone' : 'wood');
}
function xdzTint(cell, k) { _xdzC.copy(cell.p.tint).multiplyScalar(k * (cell.p.burn ? .35 : 1)); cell.P.im.setColorAt(cell.i, _xdzC); cell.P.im.instanceColor.needsUpdate = true; const p = cell.p; if (p.SK && !p.opened) { const a = p.cells.reduce((s, c) => s + c.hp / c.max, 0) / p.n0; _xdzC.copy(p.tint).multiplyScalar((.7 + .3 * a) * (p.burn ? .4 : 1)); p.SK.im.setColorAt(p.skin, _xdzC); p.SK.im.instanceColor.needsUpdate = true; } }

// ---------------------------------------------------------------- grafo dei supporti e crolli
function xdzSupported(p, seen = new Set()) {
  if (p.dead) return false; if (seen.has(p)) return false; seen.add(p);
  const f = xdzAlive(p);
  if (p.isPost) return f >= .5;                                          // pilastro: regge finché metà delle celle resta
  if (p.role === 'tavolato') return f > .15 && p.sup.some(q => !q.dead && xdzAlive(q) >= .5);
  if (f < .3) return false;
  if (p.ground) return true;
  if (p.sup.some(q => !q.dead && xdzAlive(q) >= .45 && xdzSupported(q, seen))) return true;
  // architrave: senza appoggio sotto regge se integro e appoggiato su entrambi i lati
  // architrave: senza appoggio sotto (apertura o breccia) regge se è quasi integro e almeno un vicino di fila è appoggiato
  return f >= .7 && p.lat.some(q => !q.dead && xdzAlive(q) >= .6 && (q.ground || q.sup.some(r => !r.dead && xdzAlive(r) >= .45) || xdzSupported(q, seen)));   // anche per catena di architravi (con controllo dei cicli)
}
function xdzPanelEval(p, kind) {
  const st = xdzState(p); if (st !== p.state) { p.state = st; xdzEvent(['INTEGRO', 'DANNO_LEGGERO', 'DANNO_MEDIO', 'DANNO_GRAVE', 'CROLLATO'][st], p.id); }
  if (p.state >= 3) for (const c of p.covers) if (!c.dead && typeof dzCoverLost === 'function') dzCoverLost(c);
  XDZ.evalQ = true;
}
// rivalutazione globale (poche decine di nodi): pannelli, travi, solai, tetti senza appoggio crollano con un breve preavviso
function xdzEvalSupport() {
  XDZ.evalQ = false;
  for (const p of XDZ.panels) if (!p.dead && !p.pending && !xdzSupported(p)) { p.pending = GAME.time + .25 + XDZ.rng() * .6; xdzCreak(p.c, p.mat); }
  for (const s of XDZ.roofs.concat(XDZ.floors)) {
    if (s.dead || s.pending) continue;
    const ok = s.role === 'trave' ? s.sup.length > 0 && s.sup.every(q => !q.dead && xdzAlive(q) >= .3)
      : s.both ? s.sup.every(q => !q.dead && xdzAlive(q) >= .5)
      : s.sup.length > 0 && s.sup.filter(q => !q.dead && (q.cells ? xdzAlive(q) >= .3 : true)).length >= Math.max(1, Math.ceil(s.sup.length / 3));   // tetto e solaio: basta un terzo degli appoggi
    if (!ok) { s.pending = GAME.time + .4 + XDZ.rng() * .8; xdzCreak(s.bb.getCenter(new V3()), 'legno'); }
  }
}
function xdzCreak(p, mat) { if (typeof play === 'function') play(mat === 'pietra' ? 'dz_crumble' : 'dz_wood', p.clone(), { vol: .6, ref: 20, rate: .7, cx: 'destruction.creak' }); }
function xdzCollapsePanel(p) {
  if (p.dead) return; p.dead = true; p.pending = 0; XDZ.st.collapses++;
  for (const c of p.cells) if (c.alive) xdzRemoveCell(c, c.wp, new V3(rnd(-.3, .3), -1, rnd(-.3, .3)), 'crollo');
  for (const c of p.covers) if (!c.dead && typeof dzCoverLost === 'function') dzCoverLost(c);
  p.state = 4; xdzEvent('CROLLATO', p.id); if (typeof play === 'function') play(p.mat === 'pietra' ? 'dz_crumble' : 'dz_wood', p.c.clone(), { vol: 1.1, ref: 30, cx: 'destruction.collapse' });
  XDZ.evalQ = true;
}
// tetto, solaio o trave che cede: diventa un corpo rigido che cade, poi maceria; la superficie percorribile sparisce
function xdzSlabFail(s, why) {
  if (s.dead) return; s.dead = true; s.pending = 0; XDZ.st.collapses++; XDZ.dirty = true;
  for (const so of s.sols) so.on = false; for (const f of s.floors) f.off = true;
  const c = s.bb.getCenter(new V3()); scene.remove(s.mesh); let m;
  if (s.mesh.isMesh) { const g = s.mesh.geometry.clone(); g.translate(-c.x, -c.y, -c.z); m = new THREE.Mesh(g, s.mesh.material); m.castShadow = m.receiveShadow = true; }
  else { m = new THREE.Group(); for (const ch of s.mesh.children) { const g = ch.geometry.clone(); g.translate(-c.x, -c.y, -c.z); const q = new THREE.Mesh(g, ch.material); q.castShadow = true; m.add(q); } }
  m.position.copy(c); scene.add(m);
  const sz = s.bb.getSize(new V3()); xdzBodyRaw(m, c, new V3(rnd(-.5, .5), -.5, rnd(-.5, .5)), sz, 'L', s.mat);
  if (s.role === 'roof' && s.b.room && !s.b.roofGone) { s.b.roofGone = true; const i = AAA.rooms.indexOf(s.b.room); if (i >= 0) { AAA.rooms.splice(i, 1); if (typeof aaaRoomTick === 'function') aaaRoomTick(); } }   // senza tetto: luce e acustica d'esterno
  xdzEvent(s.role === 'roof' ? 'TETTO_CROLLATO' : s.role === 'solaio' ? 'SOLAIO_CROLLATO' : s.role === 'scala' ? 'SCALA_CROLLATA' : s.role === 'timpano' ? 'TIMPANO_CROLLATO' : 'TRAVE_CEDUTA', s.id);
  if (typeof play === 'function') play(s.role === 'roof' ? 'dz_collapse' : 'dz_wood', c.clone(), { vol: s.role === 'roof' ? 1.2 : .9, ref: 40, cx: 'destruction.' + s.role });
  XDZ.navDirty.push(s.bb.clone()); XDZ.evalQ = true;
}

// ---------------------------------------------------------------- detriti: corpi rigidi semplici (sfera orientata), sonno, macerie persistenti
function xdzBody(cell, dir, power, p) {
  const K = XDZ.kit[cell.p.tpl][cell.k], g = K.geo.clone(), m = new THREE.Mesh(g, xdzMat(cell.p.mat)); m.castShadow = true; m.receiveShadow = true;
  _xm.copy(cell.mi); _xm.decompose(_xp, _xq, _xs); g.scale(_xs.x, _xs.y, _xs.z); m.quaternion.copy(_xq); m.position.copy(cell.wp); scene.add(m);
  if (cell.p.burn) { m.material = m.material.clone(); m.material.color.setScalar(.35); }
  const v = (dir ? dir.clone() : new V3(0, 0, 0)).multiplyScalar(power * (.6 + XDZ.rng() * .6)); v.x += rnd(-1, 1) * power * .3; v.y += power * .35 * XDZ.rng(); v.z += rnd(-1, 1) * power * .3;
  const sz = new V3(K.geo.boundingBox.max.x - K.geo.boundingBox.min.x, K.geo.boundingBox.max.y - K.geo.boundingBox.min.y, K.geo.boundingBox.max.z - K.geo.boundingBox.min.z).multiply(_xs);
  return xdzBodyRaw(m, cell.wp.clone(), v, sz, cell.vol > .12 ? 'L' : 'M', cell.p.mat);
}
function xdzBodyRaw(mesh, pos, vel, size, kind, mat) {
  // limite dei corpi attivi: i più vecchi medi si addormentano subito
  const act = XDZ.bodies.filter(b => !b.sleep); if (act.length >= XDZ.BODY_MAX) { const old = act.find(b => b.kind === 'M') || act[0]; xdzSleep(old); }
  const B = { mesh, pos, vel, w: new V3(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)), size, r: Math.max(.08, Math.min(size.x, size.y, size.z) * .5), kind, mat, sleep: false, still: 0, t: 0, bounces: 0 };
  XDZ.bodies.push(B); XDZ.pieces++; xdzCull(); return B;
}
function xdzWake(B) { if (!B.sleep) return; B.sleep = false; B.still = 0; if (B.sol) { B.sol.on = false; const i = solids.indexOf(B.sol); if (i >= 0) solids.splice(i, 1); B.sol = null; } }
function xdzSleep(B) {
  if (B.sleep) return; B.sleep = true; B.vel.set(0, 0, 0); B.w.set(0, 0, 0);
  if (B.kind === 'L') {   // maceria grande: collider basso, percorribile, copertura
    const bb = new THREE.Box3().setFromObject(B.mesh), sh = bb.getSize(new V3()).multiplyScalar(.12); bb.min.add(sh); bb.max.sub(sh); bb.max.y = Math.min(bb.max.y, Hf(B.pos.x, B.pos.z) + 1.4);
    if (bb.max.y - bb.min.y > .15) { B.sol = addSolid(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, 'rubble'); B.sol.mat = B.mat === 'pietra' ? 'muratura' : 'legno'; B.sol.walk = true; XDZ.navDirty.push(bb.clone()); if (bb.max.y - Hf(B.pos.x, B.pos.z) > .55) { B.cover = { x: B.pos.x, z: B.pos.z, kind: 'ruin', occ: 0, xdz: true }; covers.push(B.cover); xdzEvent('NUOVA_COPERTURA', 'maceria'); } }
  }
  if (typeof sfxImpact === 'function' && B.t < 8 && P.pos.distanceTo(B.pos) < 35) sfxImpact(B.pos, B.mat === 'pietra' ? 'stone' : 'wood');
}
// pulizia: oltre il tetto dei pezzi persistenti spariscono i medi più vecchi già fermi
function xdzCull() {
  while (XDZ.bodies.length > XDZ.PIECE_MAX) { const i = XDZ.bodies.findIndex(b => b.sleep && b.kind === 'M'); if (i < 0) break; const B = XDZ.bodies[i]; scene.remove(B.mesh); B.mesh.geometry.dispose(); XDZ.bodies.splice(i, 1); }
}
const _xg = new V3();
function xdzPhysics(dt) {
  let act = 0; const h = Math.min(dt, 1 / 30), n = h > 1 / 60 ? 2 : 1, st = h / n;
  for (const B of XDZ.bodies) {
    if (B.sleep) continue; act++; B.t += h;
    for (let k = 0; k < n; k++) {
      B.vel.y -= 9.81 * st; B.pos.addScaledVector(B.vel, st);
      // terreno e superfici percorribili (solai, macerie addormentate)
      const gy = Math.max(Hf(B.pos.x, B.pos.z), FLOORS.length ? worldFloor(B.pos.x, B.pos.z, B.pos.y) : -1e9) + B.r;
      if (B.pos.y < gy) { B.pos.y = gy; if (B.vel.y < -1) B.bounces++; B.vel.y = -B.vel.y * .22; B.vel.x *= .62; B.vel.z *= .62; B.w.multiplyScalar(.55); }
      // solidi statici (muri e celle integre): spinta fuori lungo l'asse di minima penetrazione
      for (const s of solids) {
        if (!s.on || s === B.sol || s.tag === 'rubble') continue;
        if (B.pos.x < s.min.x - B.r || B.pos.x > s.max.x + B.r || B.pos.y < s.min.y - B.r || B.pos.y > s.max.y + B.r || B.pos.z < s.min.z - B.r || B.pos.z > s.max.z + B.r) continue;
        const dx0 = B.pos.x - (s.min.x - B.r), dx1 = (s.max.x + B.r) - B.pos.x, dy1 = (s.max.y + B.r) - B.pos.y, dz0 = B.pos.z - (s.min.z - B.r), dz1 = (s.max.z + B.r) - B.pos.z, m = Math.min(dx0, dx1, dy1, dz0, dz1);
        if (m === dy1) { B.pos.y += dy1; B.vel.y = Math.abs(B.vel.y) * .2; B.vel.x *= .7; B.vel.z *= .7; } else if (m === dx0) { B.pos.x -= dx0; B.vel.x = -Math.abs(B.vel.x) * .3; } else if (m === dx1) { B.pos.x += dx1; B.vel.x = Math.abs(B.vel.x) * .3; } else if (m === dz0) { B.pos.z -= dz0; B.vel.z = -Math.abs(B.vel.z) * .3; } else { B.pos.z += dz1; B.vel.z = Math.abs(B.vel.z) * .3; }
      }
    }
    B.mesh.position.copy(B.pos); const wl = B.w.length(); if (wl > 1e-3) { _xq.setFromAxisAngle(_xg.copy(B.w).divideScalar(wl), wl * h); B.mesh.quaternion.premultiply(_xq); }
    const v = B.vel.length(); if (v < .25 && wl < .6) { B.still += h; if (B.still > .45) xdzSleep(B); } else B.still = 0;
    if (B.t > 12) xdzSleep(B);   // sicurezza: nessun corpo resta attivo per sempre
  }
  XDZ.st.bodies = act; XDZ.st.sleeping = XDZ.bodies.length - act;
}

// ---------------------------------------------------------------- crateri: terreno fisico (Hf/Hc) e mesh della demo
function xdzCrater(p, r, depth) {
  if (XDZ.craters.length >= XDZ.CRATER_MAX || !AAA.terrain || !AAA.terrAx) return false;
  const t0 = performance.now(), prof = k => k < .72 ? -(1 - (k / .72) ** 2) : .35 * Math.sin((k - .72) / .28 * PI), dip = (x, z) => { const d = Math.hypot(x - p.x, z - p.z); return d < r ? depth * prof(d / r) : 0; };
  for (const G of [HF, HC]) { if (!G.d) continue; const i0 = Math.max(0, Math.floor((p.x - r - G.x0) / G.step)), i1 = Math.min(G.nx - 1, Math.ceil((p.x + r - G.x0) / G.step)), j0 = Math.max(0, Math.floor((p.z - r - G.z0) / G.step)), j1 = Math.min(G.nz - 1, Math.ceil((p.z + r - G.z0) / G.step)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) G.d[j * G.nx + i] += dip(G.x0 + i * G.step, G.z0 + j * G.step); }
  // mesh del terreno (griglia rettilinea della demo): solo i vertici nel raggio, normali, materiale (terra smossa)
  const T = AAA.terrain.geometry, ax = AAA.terrAx, n = ax.length, pos = T.attributes.position, nor = T.attributes.normal, spl = T.attributes.spl;
  const bs = v => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ax[m] < v) lo = m + 1; else hi = m; } return lo; };
  const i0 = Math.max(0, bs(p.x - AV.cx - r * 1.3) - 1), i1 = Math.min(n - 1, bs(p.x - AV.cx + r * 1.3) + 1), j0 = Math.max(0, bs(p.z - AV.cz - r * 1.3) - 1), j1 = Math.min(n - 1, bs(p.z - AV.cz + r * 1.3) + 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i, x = AV.cx + ax[i], z = AV.cz + ax[j], dd = Math.hypot(x - p.x, z - p.z); if (dd > r * 1.3) continue;
    pos.setY(k, Hf(x, z)); const e = .4, nx = Hf(x - e, z) - Hf(x + e, z), nz = Hf(x, z - e) - Hf(x, z + e), l = Math.hypot(nx, 2 * e, nz); nor.setXYZ(k, nx / l, 2 * e / l, nz / l);
    const q = clamp(1 - dd / (r * 1.3), 0, 1); spl.setXYZW(k, spl.getX(k) * (1 - q), spl.getY(k) * (1 - q) + q * .75, spl.getZ(k) * (1 - q) + q * .25, spl.getW(k) * (1 - q));
  }
  // righe da caricare: unione con quelle non ancora caricate (più crateri nello stesso fotogramma non si perdono)
  const R_ = XDZ.terrRows; XDZ.terrRows = R_ ? [Math.min(R_[0], j0), Math.max(R_[1], j1)] : [j0, j1]; const [r0, r1] = XDZ.terrRows;
  for (const a of [pos, nor, spl]) { a.updateRange.offset = r0 * n * a.itemSize; a.updateRange.count = (r1 - r0 + 1) * n * a.itemSize; a.needsUpdate = true; a.onUpload(() => { XDZ.terrRows = null; }); }
  T.boundingSphere = null;
  // zolle di terra sul bordo (detriti medi che si assestano)
  const G = new AGeo(), M = aaaMats(); for (let i = 0; i < 10; i++) { const a = XDZ.rng() * TAU, rr = r * (.85 + XDZ.rng() * .35), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, s = (.08 + XDZ.rng() * .14) * r / 2; G.add(M.terra, ABX.box, x, Hf(x, z) + s * .3, z, XDZ.rng(), XDZ.rng() * 3, XDZ.rng(), s * 1.6, s, s * 1.2); }
  const clods = G.build(); clods.userData.xdzCrater = true;
  XDZ.craters.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: +r.toFixed(2), d: +depth.toFixed(2), clods }); XDZ.navDirty.push(new THREE.Box3(new V3(p.x - r, -1e3, p.z - r), new V3(p.x + r, 1e3, p.z + r)));
  XDZ.st.craterMs += performance.now() - t0; xdzEvent('CRATERE', p.x.toFixed(0) + ',' + p.z.toFixed(0)); return true;
}

// ---------------------------------------------------------------- incendi: solo legno, budget, propagazione limitata e deterministica
function xdzIgnite(pan, p) {
  if (pan.burn || pan.dead || XDZ.fires.length >= XDZ.FIRE_MAX || !pan.M.flam) return null; pan.burn = 1;
  const at = (p ? pan.cells.filter(c => c.alive).sort((a, b) => a.wp.distanceTo(p) - b.wp.distanceTo(p))[0] : pan.cells.find(c => c.alive)); if (!at) return null;
  const f = { pan, p: at.wp.clone(), t: 0, life: 35 + XDZ.rng() * 20, gen: (p && p.gen) || 0, spread: false, em: addEmitter(at.wp.clone(), 'fire', .7), sm: addEmitter(at.wp.clone().add(new V3(0, 1, 0)), 'smoke', .8) };
  f.em.life = f.life; f.sm.life = f.life * 1.6; XDZ.fires.push(f); for (const c of pan.cells) if (c.alive) xdzTint(c, .6); xdzEvent('INCENDIO', pan.id); return f;
}
function xdzFireTick(dt) {
  for (const f of XDZ.fires.slice()) {
    f.t += dt; const cells = f.pan.cells.filter(c => c.alive);
    if (cells.length && XDZ.rng() < dt * .35) { const c = cells[(XDZ.rng() * cells.length) | 0]; c.hp -= c.max * .3; xdzTint(c, .3); if (c.hp <= 0) xdzRemoveCell(c, c.wp, new V3(0, -1, 0), 'fuoco'); }   // il legno brucia e cede
    if (!f.spread && f.t > 12 && f.gen < 2) { f.spread = true; for (const q of XDZ.panels) if (q !== f.pan && q.M.flam && !q.burn && !q.dead && q.c.distanceTo(f.pan.c) < 3.2 && XDZ.rng() < .5) { const nf = xdzIgnite(q, Object.assign(q.c.clone(), { gen: f.gen + 1 })); if (nf) nf.gen = f.gen + 1; } }
    if (f.t > f.life || !cells.length) { XDZ.fires.splice(XDZ.fires.indexOf(f), 1); f.pan.burn = 2; }
  }
}

// ---------------------------------------------------------------- navigazione locale (griglia di 0,5 m sul cortile del laboratorio), aggiornata solo dove cambia
function xdzNavInit(x0, z0, x1, z1) {
  const s = .5, nx = Math.ceil((x1 - x0) / s), nz = Math.ceil((z1 - z0) / s), N = { x0, z0, s, nx, nz, g: new Uint8Array(nx * nz), ups: 0, cells: 0 };
  (XDZ.navs || (XDZ.navs = [])).push(N); if (!XDZ.nav) XDZ.nav = N;
  xdzNavUpdate(new THREE.Box3(new V3(x0, -1e3, z0), new V3(x1, 1e3, z1)));
}
function xdzNavUpdate(box) { for (const N of XDZ.navs || []) if (box.max.x > N.x0 && box.min.x < N.x0 + N.nx * N.s && box.max.z > N.z0 && box.min.z < N.z0 + N.nz * N.s) xdzNavUpdate1(N, box); }
function xdzNavUpdate1(N, box) { const t0 = performance.now(), i0 = Math.max(0, Math.floor((box.min.x - N.x0) / N.s) - 1), i1 = Math.min(N.nx - 1, Math.ceil((box.max.x - N.x0) / N.s) + 1), j0 = Math.max(0, Math.floor((box.min.z - N.z0) / N.s) - 1), j1 = Math.min(N.nz - 1, Math.ceil((box.max.z - N.z0) / N.s) + 1);
  const near = solids.filter(s => s.on && !s.walk && s.max.x > N.x0 + i0 * N.s - .5 && s.min.x < N.x0 + (i1 + 1) * N.s + .5 && s.max.z > N.z0 + j0 * N.s - .5 && s.min.z < N.z0 + (j1 + 1) * N.s + .5);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = N.x0 + (i + .5) * N.s, z = N.z0 + (j + .5) * N.s, y = Math.max(Hf(x, z), FLOORS.length ? worldFloor(x, z, Hf(x, z) + .3) : -1e9); let block = 0;
    for (const s of near) if (x > s.min.x - .25 && x < s.max.x + .25 && z > s.min.z - .25 && z < s.max.z + .25 && s.max.y > y + .45 && s.min.y < y + 1.6) { block = 1; break; }
    if (!block) { const e = .5, sl = Math.max(Math.abs(Hf(x + e, z) - Hf(x - e, z)), Math.abs(Hf(x, z + e) - Hf(x, z - e))) / (2 * e); if (sl > 1.1) block = 2; }   // pendenza eccessiva (pareti dei crateri profondi)
    N.g[j * N.nx + i] = block; N.cells++;
  }
  N.ups++; XDZ.st.navMs += performance.now() - t0;
}
// A* a 8 direzioni sulla griglia: restituisce lunghezza e punti (null se non c'è passaggio)
function xdzPath(ax, az, bx, bz) {
  const inN = (N, x, z) => x >= N.x0 && z >= N.z0 && x < N.x0 + N.nx * N.s && z < N.z0 + N.nz * N.s, N = (XDZ.navs || []).find(q => inN(q, ax, az) && inN(q, bx, bz)); if (!N) return null; const id = (x, z) => { const i = Math.floor((x - N.x0) / N.s), j = Math.floor((z - N.z0) / N.s); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? -1 : j * N.nx + i; };
  const s = id(ax, az), g = id(bx, bz); if (s < 0 || g < 0) return null; const gx = g % N.nx, gz = (g / N.nx) | 0, H = k => Math.hypot(k % N.nx - gx, ((k / N.nx) | 0) - gz);
  const cost = new Float32Array(N.nx * N.nz).fill(1e9), from = new Int32Array(N.nx * N.nz).fill(-1), open = [[H(s), s]]; cost[s] = 0;
  while (open.length) {
    let bi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q; const [, k] = open.splice(bi, 1)[0]; if (k === g) break;
    const i = k % N.nx, j = (k / N.nx) | 0;
    for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N.nx || b >= N.nz) continue; const q = b * N.nx + a; if (N.g[q]) continue; if (di && dj && (N.g[j * N.nx + a] || N.g[b * N.nx + i])) continue;
      const nc = cost[k] + c; if (nc < cost[q]) { cost[q] = nc; from[q] = k; open.push([nc + H(q), q]); }
    }
  }
  if (cost[g] >= 1e9) return null; const pts = []; for (let k = g; k >= 0; k = from[k]) pts.push([N.x0 + (k % N.nx + .5) * N.s, N.z0 + (((k / N.nx) | 0) + .5) * N.s]); return { len: cost[g] * N.s, pts: pts.reverse() };
}
// coperture: davanti a ogni pannello basso dei muri, sui due lati; muoiono con il pannello (dzCoverLost avvisa chi le usa)
function xdzCovers() {
  for (const p of XDZ.panels) { if (!(p.row === 0 || p.role === 'tavolato') || (p.role === 'tavolato' && p.c.y > p.b.base + 1.5)) continue; const n = new V3(Math.sin(p.ry), 0, Math.cos(p.ry)); for (const s of [1, -1]) { const c = { x: p.c.x + n.x * s * (p.t / 2 + .7), z: p.c.z + n.z * s * (p.t / 2 + .7), kind: 'wallN', occ: 0, xdz: p.id }; covers.push(c); p.covers.push(c); } }
}

// ---------------------------------------------------------------- eventi, persistenza, reset
function xdzEvent(type, id) { const e = { t: +(typeof GAME !== 'undefined' ? GAME.time : 0).toFixed(2), type, id }; XDZ.log.push(e); if (XDZ.log.length > 80) XDZ.log.shift(); XDZ.events.push(e); }
// snapshot serializzabile: celle vive per pannello (maschera in base 36), parti cedute, crateri, incendi, macerie grandi ferme
function xdzSnapshot() {
  return { v: 1, seed: XDZ.seed, pannelli: XDZ.panels.map(p => p.cells.reduce((m, c, i) => m + (c.alive ? 0 : 2 ** i), 0).toString(36)), lastre: XDZ.roofs.concat(XDZ.floors).filter(s => s.dead).map(s => s.id),
    crateri: XDZ.craters.map(c => [c.x, c.z, c.r, c.d]), incendi: XDZ.fires.map(f => f.pan.id), bruciati: XDZ.panels.filter(p => p.burn).map(p => p.id),
    macerie: XDZ.bodies.filter(b => b.sleep && b.kind === 'L').map(b => [+b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2), b.mat]) };
}
function xdzRestore(sn) {
  if (!sn || sn.v !== 1) return false; xdzReset({ terrain: true }); XDZ.restoring = true;
  try {
    sn.pannelli.forEach((m, i) => { const p = XDZ.panels[i], mask = parseInt(m, 36); if (!p || !mask) return; p.cells.forEach((c, k) => { if (mask & (2 ** k)) xdzRemoveCell(c, null, null, 'ripristino', true); }); });
    for (const id of sn.lastre) { const s = XDZ.roofs.concat(XDZ.floors).find(q => q.id === id); if (s) { s.dead = true; for (const so of s.sols) so.on = false; for (const f of s.floors) f.off = true; scene.remove(s.mesh); } }
    for (const p of XDZ.panels) { p.state = xdzState(p); if (p.state === 4) p.dead = true; }
    for (const c of sn.crateri) xdzCrater(new V3(c[0], Hf(c[0], c[1]), c[1]), c[2], c[3]);
    for (const id of sn.bruciati) { const p = XDZ.panels.find(q => q.id === id); if (p) { p.burn = 2; for (const c of p.cells) if (c.alive) xdzTint(c, .35); } }
    for (const id of sn.incendi) { const p = XDZ.panels.find(q => q.id === id); if (p) { p.burn = 0; xdzIgnite(p); } }
    for (const [x, y, z, mat] of sn.macerie) { const g = new THREE.DodecahedronGeometry(.4, 0); g.scale(1.3, .7, 1); const m = new THREE.Mesh(g, xdzMat(mat)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); const B = xdzBodyRaw(m, new V3(x, y, z), new V3(), new V3(1, .55, .8), 'L', mat); xdzSleep(B); }
  } finally { XDZ.restoring = false; }
  XDZ.evalQ = false; for (const N of XDZ.navs) xdzNavUpdate(new THREE.Box3(new V3(N.x0, -1e3, N.z0), new V3(N.x0 + N.nx * N.s, 1e3, N.z0 + N.nz * N.s))); return true;
}
// reset: edifici (ricostruiti integri), detriti, segni, incendi; con terrain:true anche i crateri (griglie e mesh dall'altimetria originale)
function xdzReset(o = {}) {
  for (const f of XDZ.fires) { f.em.life = 0; f.sm.life = 0; } XDZ.fires.length = 0;
  for (const B of XDZ.bodies) { scene.remove(B.mesh); if (B.sol) { const i = solids.indexOf(B.sol); if (i >= 0) solids.splice(i, 1); } if (B.cover) { const i = covers.indexOf(B.cover); if (i >= 0) covers.splice(i, 1); } } XDZ.bodies.length = 0; XDZ.pieces = 0;
  for (let i = solids.length - 1; i >= 0; i--) if (/^xdz_/.test(solids[i].tag)) solids.splice(i, 1);
  for (let i = FLOORS.length - 1; i >= 0; i--) if (FLOORS[i].xdz) FLOORS.splice(i, 1);
  for (let i = covers.length - 1; i >= 0; i--) if (covers[i].xdz) covers.splice(i, 1);
  for (const [, P_] of XDZ.pools) { scene.remove(P_.im); P_.im.dispose(); } XDZ.pools.clear();
  for (const s of XDZ.roofs.concat(XDZ.floors)) scene.remove(s.mesh); for (const b of XDZ.bldgs) { if (b.hay) scene.remove(b.hay); if (b.furn) scene.remove(b.furn); if (b.ground) scene.remove(b.ground); if (b.room) { const i = AAA.rooms.indexOf(b.room); if (i >= 0) AAA.rooms.splice(i, 1); } }
  XDZ.panels.length = 0; XDZ.roofs.length = 0; XDZ.floors.length = 0; XDZ.bldgs.length = 0; if (XDZ.decals) { XDZ.decN = 0; XDZ.decals.count = 0; }
  if (o.terrain) xdzResetTerrain();
  XDZ.rng = seeded(XDZ.seed = o.seed ?? XDZ.seed ?? 1944); XDZ.log.length = 0; XDZ.events.length = 0; XDZ.navDirty = []; for (const k in XDZ.st) XDZ.st[k] = 0;
  if (typeof xdzDetailUnloadAll === 'function') xdzDetailUnloadAll();
  XDZ_REG.clear(); xdzRegister(xdzHouse('casa_lab', ...v2W(XDZ_LAB.house[0], XDZ_LAB.house[1]))); xdzRegister(xdzBarn('fienile_lab', ...v2W(XDZ_LAB.barn[0], XDZ_LAB.barn[1])));
  xdzUrbanBuild(); xdzRowsBuild(); xdzCovers(); xdzDetailLoadAll();
  for (const N of XDZ.navs || []) xdzNavUpdate(new THREE.Box3(new V3(N.x0, -1e3, N.z0), new V3(N.x0 + N.nx * N.s, 1e3, N.z0 + N.nz * N.s)));
  if (typeof AAA !== 'undefined') AAA.shadowDirty = 2; xdzEvent('RESET', o.terrain ? 'scenario' : 'edifici');
}
function xdzResetTerrain() {
  const T = AAA.terrain && AAA.terrain.geometry, ax = AAA.terrAx;
  for (const c of XDZ.craters) {
    const r = c.r * 1.35; for (const G of [HF, HC]) { if (!G.d) continue; const i0 = Math.max(0, Math.floor((c.x - r - G.x0) / G.step)), i1 = Math.min(G.nx - 1, Math.ceil((c.x + r - G.x0) / G.step)), j0 = Math.max(0, Math.floor((c.z - r - G.z0) / G.step)), j1 = Math.min(G.nz - 1, Math.ceil((c.z + r - G.z0) / G.step)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) G.d[j * G.nx + i] = H(G.x0 + i * G.step, G.z0 + j * G.step); }
    if (T && ax) { const n = ax.length, pos = T.attributes.position, nor = T.attributes.normal, spl = T.attributes.spl; for (let j = 0; j < n; j++) { const z = AV.cz + ax[j]; if (Math.abs(z - c.z) > r) continue; for (let i = 0; i < n; i++) { const x = AV.cx + ax[i]; if (Math.abs(x - c.x) > r) continue; const k = j * n + i; pos.setY(k, aaaH(x, z)); const e = .4, nx = aaaH(x - e, z) - aaaH(x + e, z), nz = aaaH(x, z - e) - aaaH(x, z + e), l = Math.hypot(nx, 2 * e, nz); nor.setXYZ(k, nx / l, 2 * e / l, nz / l); const s = aaaSplat(x, z); spl.setXYZW(k, s[0], s[1], s[2], s[3]); } } for (const a of [pos, nor, spl]) { a.updateRange.offset = 0; a.updateRange.count = -1; a.needsUpdate = true; } }
    if (c.clods) scene.remove(c.clods);
  }
  XDZ.craters.length = 0;
}

// ---------------------------------------------------------------- scenari ripetibili (seme fisso)
const XDZ_LAB = { house: [116, 74], barn: [131, 75], yard: [104, 60, 142, 90] };
function xdzShooter(target, dist, h = 1.6, yaw = 0) { const o = new V3(target.x + Math.sin(yaw) * dist, 0, target.z + Math.cos(yaw) * dist); o.y = Hf(o.x, o.z) + h; return o; }
function xdzFireAt(o, target, w, n, spread = .02) {
  let hits = 0; for (let i = 0; i < n; i++) { const d = target.clone().sub(o).normalize(); d.x += (XDZ.rng() - .5) * spread; d.y += (XDZ.rng() - .5) * spread; d.z += (XDZ.rng() - .5) * spread; d.normalize(); const r = raySolids(o, d, 200); if (r && r.s && (r.s.xdz || r.s.xdzPanel || r.s.xdzRun) && xdzBullet(r.s, o.clone().addScaledVector(d, r.t), d, w)) hits++; else if (r) { const p = o.clone().addScaledVector(d, r.t); xdzDecal(p, d, r.s.mat === 'acciaio' ? 'pietra' : 'pietra'); } }
  return hits;
}
const XDZ_SCEN = {
  A: { nome: 'A · armi leggere (pietra, legno, metallo)', run(Q) { const H = XDZ.bldgs[0], B = XDZ.bldgs[1], wS = { snd: 'garand', dmg: 50 }, wM = { snd: 'mg42', dmg: 45, auto: true };
    const t1 = new V3(H.x - 2, H.base + 1.2, H.z + H.d / 2), t2 = new V3(B.x - 3.7, B.base + 1, B.z + B.d / 2), t3 = AAA.sherman ? AAA.sherman.g.position.clone().add(new V3(0, 1.2, 0)) : null;
    Q.push([0, () => xdzFireAt(xdzShooter(t1, 25), t1, wS, 20)], [1, () => xdzFireAt(xdzShooter(t1, 25), t1, wM, 40, .04)], [2, () => xdzFireAt(xdzShooter(t2, 20), t2, wM, 60, .05)], [3, () => { if (t3) xdzFireAt(t3.clone().add(new V3(0, 0, 20)), t3, wS, 10); }]); } },
  B: { nome: 'B · colpo di carro: breccia nel muro', run(Q) { const H = XDZ.bldgs[0], t = new V3(H.x + 1.2, H.base + 1.6, H.z + H.d / 2), o = xdzShooter(t, 35, 2.2, .1); Q.push([0, () => xdzShell(o, t.clone().sub(o).normalize())], [1.5, () => xdzShell(o, t.clone().add(new V3(.3, .5, 0)).sub(o).normalize())]); } },
  C: { nome: 'C · crollo strutturale (pilastri e muro portante)', run(Q) { const B = XDZ.bldgs[1], H = XDZ.bldgs[0];
    const posts = B.parts.filter(p => p.isPost && Math.abs(p.c.z - (B.z - B.d / 2)) < .2 && Math.abs(p.c.x - B.x) < 3.5);
    posts.forEach((p, i) => Q.push([i * .8, () => { const o = xdzShooter(p.c, 30, 1.4, PI); xdzShell(o, p.c.clone().sub(o).normalize()); }]));
    const low = H.grid[1].map(c => c[0]).filter(Boolean).slice(1, 3); low.forEach((p, i) => Q.push([3 + i * .8, () => { for (const c of p.cells) if (c.alive) xdzRemoveCell(c, c.wp, new V3(0, 0, -1), 'carro'); }])); } },
  D: { nome: 'D · esplosione sul terreno: cratere', run(Q) { const [x, z] = v2W(110, 84); Q.push([0, () => xdzBlast(new V3(x, Hf(x, z) + .1, z), 'bombardamento')], [1.2, () => { const [a, b] = v2W(124, 86); xdzBlast(new V3(a, Hf(a, b) + .1, b), 'carro'); }]); } },
  E: { nome: 'E · armi combinate: carro, mitragliatrice, mortai, incendio', run(Q) { const H = XDZ.bldgs[0], B = XDZ.bldgs[1];
    for (let k = 0; k < 4; k++) Q.push([k * 1.5, () => { const t = new V3(B.x - 4 + k * 2.5, B.base + 1.2, B.z + B.d / 2), o = xdzShooter(t, 40, 2.2, -.2); xdzShell(o, t.clone().sub(o).normalize()); }]);
    Q.push([2, () => xdzFireAt(xdzShooter(new V3(H.x, H.base + 1.5, H.z + H.d / 2), 30), new V3(H.x, H.base + 1.5, H.z + H.d / 2), { snd: 'mg42', dmg: 45, auto: true }, 80, .08)]);
    for (let k = 0; k < 3; k++) Q.push([3 + k, () => { const [x, z] = v2W(XDZ_LAB.house[0] - 6 + k * 9 + (XDZ.rng() - .5) * 3, XDZ_LAB.house[1] + 7 + (XDZ.rng() - .5) * 3); xdzBlast(new V3(x, Hf(x, z) + .1, z), 'granata'); }]);
    Q.push([6.5, () => { const t = new V3(H.x - 2, H.base + 1.4, H.z + H.d / 2), o = xdzShooter(t, 35, 2.2, -.15); xdzShell(o, t.clone().sub(o).normalize()); }], [7, () => { const p = B.parts.find(q => q.role === 'tavolato' && !q.dead); if (p) xdzIgnite(p); }]);
    Q.push([9, () => { XDZ.agents = xdzAgents(); }]); } },
};
// agenti di navigazione (indicatori, non soldati): ripianificano il percorso quando la griglia cambia
function xdzAgents() { const [ax, az] = v2W(XDZ_LAB.house[0], XDZ_LAB.house[1] + 11), [bx, bz] = v2W(XDZ_LAB.house[0], XDZ_LAB.house[1]); return [{ a: [ax, az], b: [bx, bz], path: xdzPath(ax, az, bx, bz), ver: XDZ.nav.ups }]; }
function xdzScenario(k, o = {}) {
  const S = XDZ_SCEN[k]; if (!S) return; xdzReset({ terrain: true, seed: o.seed ?? 1944 }); const Q = []; S.run(Q); XDZ.queue = Q.map(([t, fn]) => ({ t: GAME.time + t, fn })); XDZ.scen = k; xdzEvent('SCENARIO', k);
}

// ---------------------------------------------------------------- aggiornamento (dal ciclo della demo)
function xdzTick(dt) {
  if (!XDZ.ready) return; const t0 = performance.now();
  if (XDZ.queue && XDZ.queue.length) { for (const q of XDZ.queue.slice()) if (GAME.time >= q.t) { XDZ.queue.splice(XDZ.queue.indexOf(q), 1); try { q.fn(); } catch (e) { console.warn('scenario', e); } } }
  if (XDZ.evalQ) xdzEvalSupport();
  for (const p of XDZ.panels) if (p.pending && GAME.time >= p.pending) xdzCollapsePanel(p);
  for (const s of XDZ.roofs.concat(XDZ.floors)) if (s.pending && GAME.time >= s.pending) xdzSlabFail(s, 'appoggio');
  xdzPhysics(dt); xdzFireTick(dt);
  if (XDZ.navDirty.length) { const bb = XDZ.navDirty.reduce((a, b) => a.union(b), XDZ.navDirty[0].clone()); XDZ.navDirty.length = 0; xdzNavUpdate(bb); if (typeof TL !== 'undefined') TL.ver = (TL.ver || 0) + 1; if (XDZ.agents) for (const A of XDZ.agents) if (A.ver !== XDZ.nav.ups) { A.path = xdzPath(...A.a, ...A.b); A.ver = XDZ.nav.ups; } }
  if (XDZ.dirty) { XDZ.dirty = false; if (AAA.fixedSun) AAA.shadowDirty = Math.max(AAA.shadowDirty || 0, 1); for (const b of XDZ.bldgs) if (b.detail) xdzDetailSync(b); }
  if ((XDZ.dT = (XDZ.dT || 0) - dt) <= 0) { XDZ.dT = .5; xdzDetailPump(); }
  XDZ.st.updMs = performance.now() - t0; XDZ.st.cells = XDZ.panels.reduce((a, p) => a + p.cells.filter(c => c.alive).length, 0);
  if (XDZ.ui && XDZ.ui.on && (XDZ.uiT = (XDZ.uiT || 0) - dt) <= 0) { XDZ.uiT = .3; xdzUi(); }
}
// costruzione nella demo: aie piane, kit, edifici, navigazione, shader precompilati
function xdzPads() {
  xdzUrbanPads(); xdzRowsPads(); for (const [k, w, d] of [['house', 8, 6.4], ['barn', 10, 7]]) { const [u, v] = XDZ_LAB[k]; let lo = 1e9; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, aaaH(AV.cx + u + a * w / 2, AV.cz + v + b * d / 2)); AV.pads.push({ x0: u - w / 2 - .8, x1: u + w / 2 + .8, z0: v - d / 2 - .8, z1: v + d / 2 + .8, y: lo + .02, xdz: k }); } }
async function xdzBuild() {
  try { await xdzLoadKit(); } catch (e) { console.warn('kit di frattura non caricato', e); return; }
  if (!AAA.on) return; XDZ.on = true; const [x0, z0] = v2W(XDZ_LAB.yard[0], XDZ_LAB.yard[1]), [x1, z1] = v2W(XDZ_LAB.yard[2], XDZ_LAB.yard[3]); XDZ.nav = null;
  XDZ.navs = []; XDZ.nav = null; xdzNavInit(x0, z0, x1, z1); for (const [u0, v0, u1, v1] of [[-96, 72, -46, 108], [-126, -50, -96, -30], [-80, -12, -50, 18], [32, 8, 68, 62], [44, -54, 100, -32]]) { const [a0, b0] = v2W(u0, v0), [a1, b1] = v2W(u1, v1); xdzNavInit(a0, b0, a1, b1); }
  xdzReset({ seed: 1944 });
  apSign(new AGeo(), ...v2W(XDZ_LAB.house[0] - 6, XDZ_LAB.house[1] + 8), .3, 'DESTRUCTION LAB (F3)');
  // shader precompilati (anche ombre): niente blocchi quando il laboratorio entra in vista
  try { const t0 = performance.now(), fc = []; scene.traverse(q => { if (q.isMesh && q.frustumCulled) { q.frustumCulled = false; fc.push(q); } }); renderer.compile(scene, camera); const su = sun.shadow.needsUpdate; sun.shadow.needsUpdate = true; renderer.render(scene, camera); sun.shadow.needsUpdate = su; for (const q of fc) q.frustumCulled = true; XDZ.compileMs = Math.round(performance.now() - t0); } catch (e) { }
  XDZ.ready = true; xdzEvent('PRONTO', 'laboratorio');
}

// ---------------------------------------------------------------- DESTRUCTION LAB DEBUG (F3)
function xdzOpen(on) {
  const U = XDZ.ui || (XDZ.ui = { on: false, el: null, f: {}, g: null }); U.on = on ?? !U.on;
  if (!U.el) { U.el = document.createElement('div'); U.el.id = 'xdzPanel'; U.el.style.cssText = 'position:fixed;right:12px;top:12px;width:330px;max-height:92vh;overflow:auto;background:rgba(16,14,12,.92);color:#ece6da;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #665;border-radius:6px;z-index:60';
    U.el.addEventListener('click', e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; if (a === 'close') xdzOpen(false); else if (a === 'rb') xdzReset(); else if (a === 'rt') { xdzResetTerrain(); xdzNavUpdate(new THREE.Box3(new V3(XDZ.nav.x0, -1e3, XDZ.nav.z0), new V3(XDZ.nav.x0 + XDZ.nav.nx * XDZ.nav.s, 1e3, XDZ.nav.z0 + XDZ.nav.nz * XDZ.nav.s))); } else if (a === 'rs') xdzReset({ terrain: true }); else if (a === 'snap') { XDZ.saved = xdzSnapshot(); showMsg('Snapshot salvato', 1.2); } else if (a === 'load') { if (XDZ.saved) xdzRestore(XDZ.saved); } else if (a === 'go') { const [x, z] = v2W(XDZ_LAB.house[0] - 4, XDZ_LAB.house[1] + 12); P.pos.set(x, Hf(x, z) + .1, z); P.yaw = 0; } else if (a.startsWith('sel:')) xdzSelect(a.slice(4)); else if (a.startsWith('s:')) xdzScenario(a.slice(2)); else if (a.startsWith('v:')) { U.f[a.slice(2)] = !U.f[a.slice(2)]; xdzDebugDraw(); } xdzUi(); });
    document.body.appendChild(U.el); }
  U.el.style.display = U.on ? 'block' : 'none'; if (U.on) xdzUi(); xdzDebugDraw();
}
function xdzUi() {
  const U = XDZ.ui; if (!U || !U.el || !U.on) return; const B = (a, t, on) => `<button data-a="${a}" style="margin:2px;padding:3px 7px;background:${on ? '#5a4a2a' : '#333'};color:#eee;border:1px solid #666;border-radius:3px;cursor:pointer">${t}</button>`;
  const integ = b => { const ps = b.parts.filter(p => p.cells), a = ps.reduce((s, p) => s + p.cells.filter(c => c.alive).length, 0), n = ps.reduce((s, p) => s + p.n0, 0); return Math.round(a / Math.max(1, n) * 100); };
  const st = XDZ.st, ri = renderer.info.render;
  U.el.innerHTML = `<b style="letter-spacing:.08em">DESTRUCTION LAB DEBUG</b> ${B('close', '×')}<br>
  ${XDZ.bldgs.map(b => `<b>${b.kind}</b>: integrità ${integ(b)}% · pannelli ${b.parts.filter(p => p.cells).map(p => p.state).reduce((a, s) => (a[s]++, a), [0, 0, 0, 0, 0]).map((n, i) => n ? `${n} ${XDZ_ST[i].toLowerCase()}` : '').filter(Boolean).join(', ')} · tetto ${b.parts.filter(p => p.role === 'roof' && p.dead).length}/${b.parts.filter(p => p.role === 'roof').length} ceduti`).join('<br>')}<br>
  Frammenti integri: ${st.cells} · staccati: ${st.removed} · corpi attivi: ${st.bodies} · fermi: ${st.sleeping}<br>
  Collider: ${solids.length} · crateri: ${XDZ.craters.length} · incendi: ${XDZ.fires.length}/${XDZ.FIRE_MAX} · segni: ${Math.min(XDZ.decN, XDZ.DEC_MAX)}<br>
  Aggiornamento ${st.updMs.toFixed(2)} ms · collisioni ${st.colMs.toFixed(1)} ms tot · navigazione ${st.navMs.toFixed(1)} ms tot (${XDZ.nav ? XDZ.nav.ups : 0} agg.) · crateri ${st.craterMs.toFixed(1)} ms<br>
  Draw call ${ri.calls} · triangoli ${(ri.triangles / 1000).toFixed(0)}k<br>
  <span style="opacity:.75">Registro edifici (${XDZ_REG.size}) — clic per selezionare:</span><br>${[...XDZ_REG.values()].map(e => { const s = xdzRegState(e); return B('sel:' + e.id, `${e.id} ${s.integrita}%`, XDZ.sel === e.id); }).join('')}<br>
  ${XDZ.sel && XDZ_REG.get(XDZ.sel) ? (() => { const e = XDZ_REG.get(XDZ.sel), s = xdzRegState(e); return `<div style="background:#2a2620;padding:4px 6px;margin:3px 0"><b>${e.id}</b> · ${e.tipo} · ${e.zona}<br>dim ${e.dim.join(' × ')} m · materiali ${e.materiali.join(', ')} · livelli: ${e.livelli.join(', ')}<br>integrità ${s.integrita}% · pannelli ${s.pannelli} (crollati ${s.crollati}) · tetto ceduto ${s.tetto} · solai ${s.solai} · scala ${s.scala} · collider ${s.collider}</div>`; })() : ''}
  <span style="opacity:.75">Scenari (seme 1944):</span><br>${Object.keys(XDZ_SCEN).map(k => B('s:' + k, XDZ_SCEN[k].nome.split(' · ')[0] + ' ' + XDZ_SCEN[k].nome.split(' · ')[1].split(':')[0].split('(')[0])).join('')}<br>
  <span style="opacity:.75">Visualizza:</span> ${['supporti', 'collider', 'navigazione'].map(k => B('v:' + k, k, U.f[k])).join('')}<br>
  ${B('rb', 'Reset edifici')}${B('rt', 'Reset terreno')}${B('rs', 'Reset scenario')}<br>${B('snap', 'Salva snapshot')}${B('load', 'Ripristina snapshot')}${B('go', 'Vai al laboratorio')}<br>
  <span style="opacity:.7;font-size:11px">${XDZ.log.slice(-6).reverse().map(e => `${e.t}s ${e.type} ${e.id || ''}`).join('<br>')}</span>`;
}
function xdzSelect(id) {
  const e = XDZ_REG.get(id); if (!e) return; XDZ.sel = id; const b = e.b; P.pos.set(b.x, Hf(b.x, b.z + b.d / 2 + 6) + .1, b.z + b.d / 2 + 6); P.yaw = 0; if (P.vel) P.vel.set(0, 0, 0); xdzDebugDraw(); xdzUi();
}
function xdzDebugDraw() {
  const U = XDZ.ui; if (U.g) { scene.remove(U.g); U.g.geometry.dispose(); U.g = null; } if (!U.on) return;
  const pts = [], col = [], c = new THREE.Color(), seg = (a, b, h) => { pts.push(a.x, a.y, a.z, b.x, b.y, b.z); c.setHex(h); col.push(c.r, c.g, c.b, c.r, c.g, c.b); };
  if (U.f.supporti) { for (const p of XDZ.panels) if (!p.dead) { const ok = xdzSupported(p); for (const q of p.sup) if (!q.dead) seg(p.c, q.c, ok ? 0x40ff60 : 0xff3030); if (p.ground) seg(p.c, p.c.clone().setY(p.b.base), ok ? 0x40ff60 : 0xff3030); } for (const s of XDZ.roofs.concat(XDZ.floors)) if (!s.dead) { const sc = s.bb.getCenter(new V3()); for (const q of s.sup) if (q && !q.dead) seg(sc, q.c || q.bb.getCenter(new V3()), 0x40a0ff); } }
  if (U.f.collider) for (const s of solids) if (s.on && (/^xdz_|rubble/.test(s.tag))) { const a = s.min, b = s.max; for (const [p, q] of [[[a.x, a.y, a.z], [b.x, a.y, a.z]], [[a.x, a.y, a.z], [a.x, b.y, a.z]], [[a.x, a.y, a.z], [a.x, a.y, b.z]], [[b.x, b.y, b.z], [a.x, b.y, b.z]], [[b.x, b.y, b.z], [b.x, a.y, b.z]], [[b.x, b.y, b.z], [b.x, b.y, a.z]]]) seg(new V3(...p), new V3(...q), s.tag === 'rubble' ? 0x8080ff : 0xffa040); }
  if (U.f.navigazione && XDZ.nav) { const N = XDZ.nav; for (let j = 0; j < N.nz; j++) for (let i = 0; i < N.nx; i++) if (N.g[j * N.nx + i]) { const x = N.x0 + (i + .5) * N.s, z = N.z0 + (j + .5) * N.s, y = Hf(x, z) + .1; seg(new V3(x - .2, y, z), new V3(x + .2, y, z), N.g[j * N.nx + i] === 2 ? 0xffff40 : 0xff4040); } for (const A of XDZ.agents || []) if (A.path) for (let k = 0; k < A.path.pts.length - 1; k++) { const [a, b] = A.path.pts[k], [e, f] = A.path.pts[k + 1]; seg(new V3(a, Hf(a, b) + .3, b), new V3(e, Hf(e, f) + .3, f), 0x40ffff); } }
  if (XDZ.sel && XDZ_REG.get(XDZ.sel)) { const b = XDZ_REG.get(XDZ.sel).b, x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y0 = b.base, y1 = b.top || b.base + 4; const P8 = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].map(q => new V3(...q)); for (const [a, c] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) seg(P8[a], P8[c], 0xffff40); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  U.g = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); U.g.renderOrder = 999; U.g.frustumCulled = false; scene.add(U.g);
}
addEventListener('keydown', e => { if (typeof SCEN === 'undefined' || SCEN !== 'aaa' || !GAME.started || e.code !== 'F3') return; e.preventDefault(); e.stopImmediatePropagation(); if (XDZ.ready) xdzOpen(); else showMsg('Destruction Lab in caricamento…', 1.5); }, true);

// ============================================================
//  AAA Normandy Village URBAN EXPANSION 3.0 — fase F: primo isolato (5 case a schiera), tutte nel sistema di distruzione
//  del Destruction Lab (pannelli fratturati, supporti, detriti, collider, navigazione, persistenza). Registro degli edifici.
// ============================================================
// rue Neuve: strada est-ovest a sud del quartiere residenziale, collegata alla strada secondaria
const XDZ_URBAN = {
  strada: { id: 'rue_neuve', w: 5, kind: 'road', pts: [[-96, 93.5], [-62, 93.6], [-44, 92.6], [-36, 72], [-35, 58], [-33, 46], [-31, 41]] },
  // isolato 1: case a schiera sul lato nord della strada, facciate a sud verso la strada (fronti allineati a v = 90)
  isolato1: [
    { id: 'u1_casa_a', u: -84.4, w: 7.2, d: 6.8, piani: 2, mat: 'pietra', tetto: 'ardesia', pitch: .86, porta: [1], aperta: true, scala: true, fori: { s: [[3, 1], [1, 3], [3, 3]], n: [[1, 1], [2, 3]], o: [[1, 3]], e: [] }, tipo: 'casa a schiera (esplorabile)' },
    { id: 'u1_casa_b', u: -77.65, w: 6.2, d: 6.4, piani: 2, mat: 'intonaco:0xe8dcc0', tetto: 'tegole', pitch: .8, porta: [2], aperta: false, persiane: true, fori: { s: [[0, 1], [0, 3], [2, 3]], n: [[1, 3]], o: [], e: [] }, tipo: 'casa a schiera' },
    { id: 'u1_bottega', u: -70.5, w: 8, d: 7.2, piani: 3, mat: 'mattoni', tetto: 'ardesia', pitch: .78, porta: [1], aperta: true, scala: true, fori: { s: [[3, 1], [0, 3], [2, 3], [0, 5], [3, 5]], n: [[2, 3], [1, 5]], o: [], e: [] }, tipo: 'bottega con abitazione (esplorabile, 3 piani)' },
    { id: 'u1_casa_c', u: -62.75, w: 7.4, d: 6.6, piani: 2, mat: 'intonaco:0xd8c49c', tetto: 'tegole', pitch: .9, porta: [0], aperta: false, persiane: true, fori: { s: [[2, 1], [0, 3], [2, 3]], n: [[1, 1]], o: [], e: [[1, 3]] }, tipo: 'casa a schiera', danni: true },
    { id: 'u1_rimessa', u: -55.3, w: 7.4, d: 6.2, piani: 1, mat: 'pietra', tetto: 'ardesia', pitch: .7, porta: [1, 2], aperta: true, fori: { s: [], n: [], o: [], e: [[1, 1]] }, tipo: 'rimessa (portone)' },
  ],
  front: 90,
};
V2.roads.push(XDZ_URBAN.strada); { const r = XDZ_URBAN.strada, us = r.pts.map(q => q[0]), vs = r.pts.map(q => q[1]); r.bb = [Math.min(...us) - 8, Math.max(...us) + 8, Math.min(...vs) - 8, Math.max(...vs) + 8]; }
const XDZ_REG = new Map();   // registro: id → voce (stabile, nessun duplicato)
function xdzRegister(b, extra = {}) {
  if (XDZ_REG.has(b.id) && XDZ_REG.get(b.id).b !== b && !XDZ.rebuilding) throw new Error('ID edificio duplicato: ' + b.id);
  const e = { id: b.id, b, tipo: b.kind, pos: [+b.x.toFixed(2), +b.base.toFixed(2), +b.z.toFixed(2)], orient: 0, dim: [b.w, b.d, +((b.top || b.base + 5) - b.base).toFixed(2)], asset: 'kit di frattura (fracture_kit.glb) + generatore xdzHouse', materiali: b.cfg ? [b.cfg.mat, b.cfg.tetto] : ['pietra', 'legno'], distruzione: true, livelli: (b.levels || [{ nome: 'pianterreno' }]).map(l => l.nome), esplorabile: !!(b.cfg ? b.cfg.aperta : true), zona: extra.zona || 'laboratorio' };
  XDZ_REG.set(b.id, e); return e;
}
function xdzRegState(e) {
  const b = e.b, ps = b.parts.filter(p => p.cells), alive = ps.reduce((a, p) => a + p.cells.filter(c => c.alive).length, 0), n = ps.reduce((a, p) => a + p.n0, 0);
  return { integrita: Math.round(alive / Math.max(1, n) * 100), pannelli: ps.length, crollati: ps.filter(p => p.dead).length, tetto: b.parts.filter(p => p.role === 'roof' && p.dead).length + '/' + b.parts.filter(p => p.role === 'roof').length, solai: b.parts.filter(p => p.role === 'solaio' && !p.dead).length, scala: b.parts.some(p => p.stair) ? (b.parts.find(p => p.stair).dead ? 'crollata' : 'percorribile') : 'nessuna', collider: ps.reduce((a, p) => a + (p.opened ? p.cells.filter(c => c.alive).length : 1), 0) };
}
// muretti di cortile distruttibili (una fila di pannelli di pietra, appoggiati al terreno)
function xdzLowWall(b, x0, z0, x1, z1, h = 1.3) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2)), ry = Math.atan2(x1 - x0, z1 - z0) - PI / 2;
  for (let i = 0; i < n; i++) { const k = (i + .5) / n, x = lerp(x0, x1, k), z = lerp(z0, z1, k), y = Hf(x, z) - .2; const p = xdzPanel(b, 'muretto', 'pietra', 'frac_stone', x, y + (h + .2) / 2, z, ry, L / n + .01, h + .2, .45, { structural: false }); p.ground = true; p.row = 0; }
}
function xdzUrbanPads() {
  for (const d of XDZ_URBAN.isolato1) { const v = XDZ_URBAN.front - d.d / 2; let lo = 1e9; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, aaaH(AV.cx + d.u + a * d.w / 2, AV.cz + v + c * d.d / 2)); AV.pads.push({ x0: d.u - d.w / 2 - .3, x1: d.u + d.w / 2 + .3, z0: v - d.d / 2 - .4, z1: v + d.d / 2 + .8, y: lo + .02, xdz: d.id }); }
}
function xdzUrbanBuild() {
  const out = [];
  for (const d of XDZ_URBAN.isolato1) {
    const v = XDZ_URBAN.front - d.d / 2, [x, z] = v2W(d.u, v), b = xdzHouse(d.id, x, z, Object.assign({ dettagli: true }, d)); xdzRegister(b, { zona: 'isolato 1 (rue Neuve)' }); out.push(b);
    // arredo essenziale al pianterreno delle case esplorabili (tavolo, sedie, credenza, camino)
    if (d.aperta && d.piani > 1 && typeof v2Furn === 'function') { const G = new AGeo(), F = v2Furn(G, seeded(d.u * 7 | 0)), y = b.base + .01; F.table(x + .8, y, z + .4, 0, 1.5, .8); F.chair(x + .2, y, z + 1.1, PI); F.chair(x + 1.4, y, z + 1.1, PI); F.cupboard(x + b.w / 2 - 1.1, y, z - b.d / 2 + .9, 0, 1.2, 1.9); b.furn = G.build(); }
  }
  // cortili posteriori con muretti divisori distruttibili (accesso posteriore per la fanteria fra la rimessa e la casa c)
  const back = XDZ_URBAN.front - 7.6, rear = back - 3;   // cortili di 3 m (dietro c'è l'argine del bocage)
  const wb = { id: 'u1_muretti', kind: 'muretti', x: AV.cx - 70, z: AV.cz + rear, w: 34, d: 6, parts: [], base: Hf(AV.cx - 70, AV.cz + rear) };
  xdzLowWall(wb, ...v2W(-88.2, rear), ...v2W(-60.5, rear));   // muro di fondo (varco a est verso il campo)
  for (const u of [-80.9, -73.8, -66.6]) xdzLowWall(wb, ...v2W(u, rear + .3), ...v2W(u, back - .3), 1.6);
  wb.top = wb.base + 1.5; XDZ.bldgs.push(wb); xdzRegister(wb, { zona: 'isolato 1 (cortili)' });
  // stato iniziale danneggiato (casa c): angolo alto colpito e una campata del tetto ceduta, coerente col sistema (celle tolte, collider spenti)
  const dc = out.find(b => b.cfg.danni); if (dc) xdzPreDamage(dc);
  return out;
}

// ---------------------------------------------------------------- fasi H–K: altri isolati (stesso generatore distruttibile)
// file di edifici lungo una strada: fronte 's' (facciata verso +z) o 'n' (verso -z), linea di facciata v, partenza u, larghezze in sequenza
const XDZ_ROWS = [
  { id: 'u2', zona: 'rue Neuve (lato sud)', fronte: 'n', v: 97.2, u0: -91, gap: .1, items: [
    { w: 6.8, d: 6.6, piani: 2, mat: 'intonaco:0xe0d0a8', tetto: 'tegole', porta: [1], aperta: false, persiane: true, fori: { n: [[3, 1], [1, 3], [3, 3]], s: [[1, 3]] }, tipo: 'casa a schiera' },
    { w: 7.6, d: 7, piani: 2, mat: 'pietra', tetto: 'ardesia', porta: [2], aperta: true, scala: true, fori: { n: [[0, 1], [0, 3], [3, 3]], s: [[2, 1]] }, tipo: 'casa a schiera (esplorabile)' },
    { w: 6.4, d: 6.2, piani: 1, mat: 'pietra', tetto: 'ardesia', pitch: .9, porta: [1], aperta: false, persiane: true, fori: { n: [[2, 1]] }, tipo: 'casa rurale', danni: true },
    { w: 8, d: 6.8, piani: 2, mat: 'mattoni', tetto: 'tegole', porta: [1], aperta: false, persiane: true, fori: { n: [[3, 1], [0, 3], [2, 3]], e: [[1, 3]] }, tipo: 'casa in mattoni' },
  ] },
  { id: 'u3', zona: "rue de l'Église", fronte: 's', v: -38.6, u0: -119.4, gap: .1, items: [
    { w: 6.4, d: 6.6, piani: 2, mat: 'pietra', tetto: 'ardesia', pitch: .9, porta: [1], aperta: false, persiane: true, fori: { s: [[2, 1], [0, 3], [2, 3]], n: [[1, 3]] }, tipo: 'casa del sagrestano' },
    { w: 8.4, d: 7.2, piani: 2, mat: 'mattoni', tetto: 'ardesia', porta: [2], aperta: true, scala: true, fori: { s: [[0, 1], [4, 1], [0, 3], [2, 3], [4, 3]], n: [[1, 1]] }, tipo: 'ufficio postale (PTT, esplorabile)' },
  ] },
  { id: 'u4', zona: 'Grande Rue (lato nord)', fronte: 's', v: -1.8, u0: -76, gap: .1, items: [
    { w: 7.2, d: 7, piani: 2, mat: 'intonaco:0xd8c8a4', tetto: 'ardesia', porta: [1], aperta: true, scala: true, fori: { s: [[3, 1], [1, 3], [3, 3]], n: [[2, 1]] }, tipo: 'caffè-tabacchi (esplorabile)' },
    { w: 6.4, d: 6.4, piani: 2, mat: 'pietra', tetto: 'tegole', porta: [2], aperta: false, persiane: true, fori: { s: [[0, 1], [0, 3], [2, 3]] }, tipo: 'casa a schiera', danni: true },
    { w: 8, d: 7.4, piani: 3, mat: 'mattoni', tetto: 'ardesia', porta: [1], aperta: false, persiane: true, fori: { s: [[3, 1], [0, 3], [2, 3], [0, 5], [3, 5]], n: [[1, 3]] }, tipo: 'casa borghese a tre piani' },
  ] },
  { id: 'u5', zona: 'Grande Rue (lato sud)', fronte: 'n', v: 8.6, u0: -70, gap: .1, items: [
    { w: 6.4, d: 5.6, piani: 1, mat: 'intonaco:0xe8dcc0', tetto: 'tegole', porta: [1], aperta: false, persiane: true, fori: { n: [[3, 1]] }, tipo: 'casa rurale' },
    { w: 7, d: 5.8, piani: 2, mat: 'pietra', tetto: 'ardesia', porta: [2], aperta: true, scala: true, fori: { n: [[0, 1], [0, 3], [3, 3]] }, tipo: 'casa (esplorabile)' },
    { w: 6, d: 5.6, piani: 1, mat: 'pietra', tetto: 'ardesia', porta: [0], aperta: false, persiane: true, fori: { n: [[2, 1]] }, tipo: 'casa rurale' },
  ] },
  { id: 'u6', zona: 'Ferme de la Croix (agricola)', fronte: 's', v: 44, u0: 36.8, gap: 4.8, items: [
    { w: 9.6, d: 7, piani: 2, mat: 'pietra', tetto: 'ardesia', pitch: .9, porta: [2], aperta: true, scala: true, fori: { s: [[0, 1], [4, 1], [0, 3], [2, 3], [4, 3]], n: [[2, 1]] }, tipo: 'casa colonica (esplorabile)' },
    { w: 12, d: 8, piani: 1, mat: 'pietra', tetto: 'ardesia', pitch: .75, porta: [2, 3], aperta: true, fori: { n: [[1, 1], [4, 1]] }, tipo: 'fienile' },
  ] },
  { id: 'u7', zona: 'Ferme de la Croix (agricola)', fronte: 'n', v: 52, u0: 36.8, gap: 4.8, items: [
    { w: 9.6, d: 6, piani: 1, mat: 'mattoni', tetto: 'tegole', porta: [1, 3], aperta: true, fori: { n: [[2, 1]], s: [[1, 1], [3, 1]] }, tipo: 'stalla' },
    { w: 8, d: 6, piani: 1, mat: 'pietra', tetto: 'tegole', pitch: .7, porta: [1, 2], aperta: true, fori: {}, tipo: 'rimessa dei carri' },
  ] },
  { id: 'u8', zona: 'rue des Ateliers (servizi)', fronte: 's', v: -40, u0: 48, gap: .3, items: [
    { w: 9, d: 7, piani: 1, mat: 'mattoni', tetto: 'ardesia', pitch: .65, porta: [1, 2], aperta: true, fori: { s: [[4, 1]], n: [[1, 1], [3, 1]] }, tipo: 'officina meccanica' },
    { w: 11, d: 8, piani: 1, mat: 'pietra', tetto: 'ardesia', pitch: .62, porta: [2, 3], aperta: true, fori: { n: [[1, 1], [4, 1]] }, tipo: 'magazzino' },
    { w: 6, d: 5.6, piani: 1, mat: 'pietra', tetto: 'tegole', pitch: .8, porta: [1], aperta: true, fori: { s: [[2, 1]] }, tipo: 'forgia del maniscalco' },
    { w: 7.4, d: 6, piani: 1, mat: 'mattoni', tetto: 'tegole', porta: [1, 2], aperta: false, fori: { e: [[1, 1]] }, tipo: 'rimessa' },
  ] },
];
XDZ_URBAN.strade2 = [
  { id: 'rue_eglise', w: 4.4, kind: 'lane', pts: [[-123, -36.2], [-99, -36.2]] },
  { id: 'ferme_croix', w: 4.2, kind: 'road', pts: [[49, 12], [49, 49], [49, 58]] },
  { id: 'rue_ateliers', w: 5, kind: 'road', pts: [[46, -37], [84, -36.6], [96.6, -41]] },
];
for (const r of XDZ_URBAN.strade2) { V2.roads.push(r); const us = r.pts.map(q => q[0]), vs = r.pts.map(q => q[1]); r.bb = [Math.min(...us) - 8, Math.max(...us) + 8, Math.min(...vs) - 8, Math.max(...vs) + 8]; }
// posizioni calcolate una volta (u, v del centro)
for (const R_ of XDZ_ROWS) { let u = R_.u0; R_.items.forEach((d, i) => { d.id = `${R_.id}_${String.fromCharCode(97 + i)}`; d.fronte = R_.fronte; d.u = u + d.w / 2; d.v = R_.fronte === 's' ? R_.v - d.d / 2 : R_.v + d.d / 2; d.zona = R_.zona; u += d.w + R_.gap; }); }
function xdzRowsPads() {
  for (const R_ of XDZ_ROWS) for (const d of R_.items) { let lo = 1e9; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, aaaH(AV.cx + d.u + a * d.w / 2, AV.cz + d.v + c * d.d / 2)); AV.pads.push({ x0: d.u - d.w / 2 - .3, x1: d.u + d.w / 2 + .3, z0: d.v - d.d / 2 - .6, z1: d.v + d.d / 2 + .6, y: lo + .02, xdz: d.id }); }
}
function xdzRowsBuild() {
  const out = [];
  for (const R_ of XDZ_ROWS) for (const d of R_.items) {
    const [x, z] = v2W(d.u, d.v), b = xdzHouse(d.id, x, z, Object.assign({ dettagli: true }, d)); xdzRegister(b, { zona: d.zona }); out.push(b);
    if (d.aperta && d.piani > 1 && typeof v2Furn === 'function') { const G = new AGeo(), F = v2Furn(G, seeded(Math.abs(d.u * 7) | 0)), y = b.base + .01; F.table(x + .6, y, z + .3, 0, 1.4, .8); F.chair(x, y, z + 1, PI); F.cupboard(x + b.w / 2 - 1.1, y, z - b.d / 2 + .9, 0, 1.2, 1.9); b.furn = G.build(); }
    if (d.danni) xdzPreDamage(b);
  }
  // corte della fattoria: muretti sui lati ovest ed est (varco della strada al centro), cortile delle officine
  const wf = { id: 'u6_muri_corte', kind: 'muretti', x: AV.cx + 49, z: AV.cz + 48, w: 28, d: 8, parts: [], base: Hf(AV.cx + 49, AV.cz + 48) };
  xdzLowWall(wf, ...v2W(36.6, 44.4), ...v2W(36.6, 51.6), 1.7); xdzLowWall(wf, ...v2W(63.8, 44.4), ...v2W(63.8, 51.6), 1.7); wf.top = wf.base + 1.7; XDZ.bldgs.push(wf); xdzRegister(wf, { zona: 'Ferme de la Croix (agricola)' });
  const wa = { id: 'u8_muro_cortile', kind: 'muretti', x: AV.cx + 64, z: AV.cz - 50, w: 34, d: 2, parts: [], base: Hf(AV.cx + 64, AV.cz - 50) };
  xdzLowWall(wa, ...v2W(48, -51), ...v2W(73, -51), 1.9); wa.top = wa.base + 1.9; XDZ.bldgs.push(wa); xdzRegister(wa, { zona: 'rue des Ateliers (servizi)' });
  return out;
}
// danni di guerra preesistenti, coerenti col sistema: celle tolte (collider spenti), una campata del tetto ceduta (collider spento)
function xdzPreDamage(b) {
  const top = b.grid[0].map(c => c[c.length - 1]).filter(Boolean).slice(-1)[0]; if (top) for (const c of top.cells.slice(0, 11)) xdzRemoveCell(c, null, null, 'preesistente', true);
  const rf = b.parts.find(p => p.role === 'roof'); if (rf) { rf.dead = true; for (const so of rf.sols) so.on = false; scene.remove(rf.mesh); } b.preDanni = true;
}
// validazione delle posizioni: niente sovrapposizioni (fra loro, con il villaggio 2.0, con il villaggio originale, con il laboratorio), niente edifici su strade o argini
function xdzUrbanValidate() {
  const all = XDZ_URBAN.isolato1.map(d => ({ id: d.id, u: d.u, v: XDZ_URBAN.front - d.d / 2, w: d.w, d: d.d })).concat(XDZ_ROWS.flatMap(R_ => R_.items.map(d => ({ id: d.id, u: d.u, v: d.v, w: d.w, d: d.d }))));
  const other = V2.defs.map(d => ({ id: d.id, u: d.u, v: d.v, w: d.w, d: d.d })).concat(Object.values(AAA.defs).map(d => ({ id: d.id, u: d.u, v: d.v, w: d.w, d: d.d }))).concat([{ id: 'lab_casa', u: XDZ_LAB.house[0], v: XDZ_LAB.house[1], w: 8, d: 6.4 }, { id: 'lab_fienile', u: XDZ_LAB.barn[0], v: XDZ_LAB.barn[1], w: 10, d: 7 }]);
  if (AAA.st.pipe) other.push({ id: 'pipe', u: AAA.st.pipe.x - AV.cx, v: AAA.st.pipe.z - AV.cz, w: 13, d: 10 });
  const R = { sovrapposizioni: [], suStrada: [], suArgine: [], fuoriMappa: [] }, ov = (a, b, m) => Math.abs(a.u - b.u) < (a.w + b.w) / 2 + m && Math.abs(a.v - b.v) < (a.d + b.d) / 2 + m;
  for (let i = 0; i < all.length; i++) { for (let j = i + 1; j < all.length; j++) if (ov(all[i], all[j], -.02)) R.sovrapposizioni.push(all[i].id + '/' + all[j].id); for (const o of other) if (ov(all[i], o, .5)) R.sovrapposizioni.push(all[i].id + '/' + o.id); }
  for (const a of all) for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, -1], [0, 1]]) { const u = a.u + x * a.w / 2, v = a.v + y * a.d / 2; if (Math.abs(v - avRoadV(u)) < 3.2 || v2RoadD(u, v) < -.02) R.suStrada.push(a.id); if (avBankD(u, v) < 2.2) R.suArgine.push(a.id); if (Math.max(Math.abs(u), Math.abs(v)) > AV.half - 3) R.fuoriMappa.push(a.id); }
  for (const k in R) R[k] = [...new Set(R[k])]; R.n = all.length; return R;
}

// ============================================================
//  DETTAGLIO ARCHITETTONICO BLENDER (assets/aaa/urban/<id>.glb, generatore urban_house.py) legato alla distruzione
//  Ogni nodo del GLB è «<gruppo>@LOD0»; i gruppi si uniscono per materiale in un'unica mesh per edificio con l'attributo
//  xgrp (indice globale del gruppo); una maschera (texture 256×64) nasconde sulla GPU i gruppi dei componenti rotti
//  (anche nell'ombra) e il pezzo cade come detrito con la sua geometria. Caricamento progressivo per distanza.
// ============================================================
const XDZD = { mats: {}, depth: {}, n: 1, tex: null, data: null, loading: null, queue: [], tris: 0, loaded: 0 };
function xdzDMask() {
  if (XDZD.tex) return XDZD.tex; XDZD.data = new Uint8Array(256 * 64 * 4).fill(255); XDZD.tex = new THREE.DataTexture(XDZD.data, 256, 64, THREE.RGBAFormat); XDZD.tex.needsUpdate = true; return XDZD.tex;
}
const XDZD_GLSL_V = `attribute float xgrp; uniform sampler2D uXdzMask;`, XDZD_GLSL_B = `{ vec2 mu = vec2((mod(xgrp, 256.) + .5) / 256., (floor(xgrp / 256.) + .5) / 64.); if (texture2D(uXdzMask, mu).r < .5) transformed = vec3(0.); }`;
function xdzDPatch(m, key) {
  m.onBeforeCompile = sh => { sh.uniforms.uXdzMask = { value: xdzDMask() }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + XDZD_GLSL_V).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + XDZD_GLSL_B); };
  return m;
}
// materiali come quelli della casa Blender (pipeMat: texture CC0 della demo, scala nelle UV), con la maschera dei gruppi
function xdzDMat(name) {
  if (XDZD.mats[name]) return XDZD.mats[name]; const d = PIPE_MATS[name] || [null, [.6, .6, .6], .8, 0], T_ = d[0] && typeof TEXH !== 'undefined' ? TEXH[d[0]] : null;
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...d[1]), roughness: d[2], metalness: d[3] });
  if (name === 'glass') { m.transparent = true; m.opacity = .4; m.depthWrite = false; m.side = THREE.DoubleSide; m.envMap = AAA.cube || null; m.roughness = .06; }
  else if (T_) { m.map = T_.map; m.normalMap = T_.normal; m.aoMap = T_.arm; m.roughnessMap = T_.arm; m.metalnessMap = d[3] ? T_.arm : null; m.aoMapIntensity = .8; }
  xdzDPatch(m); m.name = 'xdzd_' + name;
  if (name !== 'glass' && typeof aaaPatch === 'function') aaaPatch(m, { baseY: 0, moss: d[4] || 0, damp: d[5] || 0, key: 'xdzd' });
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); xdzDPatch(dm); XDZD.depth[name] = dm;
  return (XDZD.mats[name] = m);
}
function xdzDetailLoadAll() { for (const b of XDZ.bldgs) if (b.cfg && b.cfg.dettagli && !b.detail && !XDZD.queue.includes(b)) XDZD.queue.push(b); }
// uno alla volta, il più vicino alla camera per primo
async function xdzDetailPump() {
  if (XDZD.loading || !XDZD.queue.length) return; const cp = camera.position; XDZD.queue.sort((a, c) => Math.hypot(a.x - cp.x, a.z - cp.z) - Math.hypot(c.x - cp.x, c.z - cp.z));
  const b = XDZD.queue.shift(); if (!XDZ.bldgs.includes(b)) return; XDZD.loading = b;
  try { await xdzDetailLoad(b); } catch (e) { b.detail = { err: String(e) }; } finally { XDZD.loading = null; }
}
async function xdzDetailLoad(b) {
  xdzDMask(); const id = b.id; if (!(window.URBAN_GLB && URBAN_GLB[id] && URBAN_GLB[id].glb)) await aaaLoadScript('assets/aaa/urban/' + id + '.js?r=' + (XDZD.rel = (XDZD.rel || 0) + 1));   // dopo un reset i dati liberati si ricaricano dal file
  if (!XDZ.bldgs.includes(b)) return;
  const src = URBAN_GLB[id], bin = Uint8Array.from(atob(src.glb), c => c.charCodeAt(0)), gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin.buffer, '', res, rej));
  if (!XDZ.bldgs.includes(b)) return;
  const byMat = {}, groups = {}; gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return; let n = o; while (n && !/@LOD0$/.test(n.name || '')) n = n.parent; if (!n) return; const key = n.name.split('@')[0].replace(/_/g, ':');   // nel GLB «p_s_1_2»
    const G = groups[key] || (groups[key] = { key, gi: XDZD.n++, parts: [], box: new THREE.Box3(), on: true });
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed(), cnt = g.attributes.position.count; g.setAttribute('xgrp', new THREE.BufferAttribute(new Float32Array(cnt).fill(G.gi), 1)); if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'uv2', 'xgrp'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) { g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2)); g.setAttribute('uv2', g.attributes.uv); }
    const mn = o.material.name || 'stone'; (byMat[mn] || (byMat[mn] = [])).push({ g, G }); g.computeBoundingBox(); G.box.union(g.boundingBox);
  });
  const root = new THREE.Group(); root.position.set(b.x, b.base, b.z); root.name = 'xdzd_' + id;
  for (const mn in byMat) {
    let off = 0; const list = byMat[mn]; for (const { g, G } of list) { G.parts.push({ mat: mn, start: off, count: g.attributes.position.count }); off += g.attributes.position.count; }
    const merged = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(list.map(q => q.g)) : aaaMerge(list.map(q => q.g)); for (const q of list) q.g.dispose();
    const mesh = new THREE.Mesh(merged, xdzDMat(mn)); mesh.castShadow = mn !== 'glass'; mesh.receiveShadow = true; mesh.customDepthMaterial = XDZD.depth[mn]; root.add(mesh); XDZD.tris += merged.attributes.position.count / 3;
    for (const { G } of list) G.parts.filter(p => p.mat === mn).forEach(p => p.mesh = mesh);
  }
  scene.add(root);
  // legame gruppo → componente distruttibile
  const fi = { s: 0, n: 1, o: 2, e: 3 };
  for (const key in groups) {
    const G = groups[key], k = key.split(':');
    if (k[0] === 'p') G.own = [b.grid[fi[k[1]]] && b.grid[fi[k[1]]][+k[2]] && b.grid[fi[k[1]]][+k[2]][+k[3]]].filter(Boolean);
    else if (k[0] === 'o' || k[0] === 'a') { const O = b.openings.find(q => q.face === k[1] && q.c === +k[2] && q.r === +k[3]); G.own = O ? (k[0] === 'o' ? O.parts.slice() : O.leaf ? [O.leaf] : O.parts.slice()) : []; }
    else if (k[0] === 'g') G.own = b.parts.filter(p => p.isGable && p.side === +k[1]);
    else G.own = [];
  }
  for (const O of b.openings) if (O.leaf && O.leaf.SK && !O.leaf.opened) { O.leaf.SK.im.setMatrixAt(O.leaf.skin, _xZ); O.leaf.SK.im.instanceMatrix.needsUpdate = true; O.leaf.noSkin = true; }
  URBAN_GLB[id].glb = null; b.detail = { root, groups, man: src.manifest }; XDZD.loaded++;
  xdzDetailSync(b, true); if (AAA.fixedSun) AAA.shadowDirty = Math.max(AAA.shadowDirty || 0, 1);
}
// visibilità dei gruppi dallo stato dei componenti; un gruppo che sparisce cade come detrito (salvo ripristino)
function xdzDetailSync(b, quiet) {
  const D = b.detail; if (!D || !D.groups) return; let ch = false;
  for (const key in D.groups) {
    const G = D.groups[key], on = G.own.every(p => !p.dead && !p.opened);
    if (on === G.on) continue; G.on = on; ch = true; const i = G.gi * 4; XDZD.data[i] = XDZD.data[i + 1] = XDZD.data[i + 2] = on ? 255 : 0;
    if (!on && !quiet && !XDZ.restoring) xdzDetailDebris(b, G);
  }
  if (ch) XDZD.tex.needsUpdate = true;
}
function xdzDetailDebris(b, G) {
  if (XDZ.bodies.filter(q => !q.sleep).length >= XDZ.BODY_MAX) return; const grp = new THREE.Group(), c = G.box.getCenter(new V3()), sz = G.box.getSize(new V3());
  for (const p of G.parts) { const src = p.mesh.geometry, g = new THREE.BufferGeometry(); for (const a of ['position', 'normal', 'uv', 'uv2']) { const A = src.attributes[a]; if (A) g.setAttribute(a, new THREE.BufferAttribute(A.array.slice(p.start * A.itemSize, (p.start + p.count) * A.itemSize), A.itemSize)); } g.translate(-c.x, -c.y, -c.z); const m = new THREE.Mesh(g, typeof pipeMat === 'function' ? pipeMat(p.mat) : xdzMat('pietra')); m.castShadow = true; grp.add(m); }
  const w = new V3(b.x + c.x, b.base + c.y, b.z + c.z); grp.position.copy(w); scene.add(grp);
  const out = new V3(c.x, 0, c.z).normalize(); xdzBodyRaw(grp, w, out.multiplyScalar(1.5 + XDZ.rng() * 2).add(new V3(0, 1, 0)), sz.clone().max(new V3(.1, .1, .1)), sz.length() > 1.2 ? 'L' : 'M', 'legno');
}
function xdzDetailUnloadAll() { for (const b of XDZ.bldgs) if (b.detail && b.detail.root) { scene.remove(b.detail.root); b.detail.root.traverse(o => o.geometry && o.geometry.dispose()); } XDZD.queue.length = 0; if (XDZD.data) { XDZD.data.fill(255); XDZD.tex.needsUpdate = true; } XDZD.n = 1; XDZD.tris = 0; XDZD.loaded = 0; }

// ---------------------------------------------------------------- tetto come la casa Blender (roof() di normandy_house.py), generato nel gioco per campata
const XDZ_TILE = { slate: 4.5, clay: 2, oak_beam: 2, wood: 1.6, iron: .6 };
// scatola orientata con UV in metri / ripetizione (come Geo.poly), scritta direttamente negli array del materiale
const XDZ_BOXF = [   // facce: normale locale, assi (u, v) in coordinate locali, indici delle dimensioni per le UV
  [[1, 0, 0], [0, 0, -1], [0, 1, 0], 2, 1], [[-1, 0, 0], [0, 0, 1], [0, 1, 0], 2, 1], [[0, 1, 0], [1, 0, 0], [0, 0, -1], 0, 2],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1], 0, 2], [[0, 0, 1], [1, 0, 0], [0, 1, 0], 0, 1], [[0, 0, -1], [-1, 0, 0], [0, 1, 0], 0, 1]];
const _xbP = new V3(), _xbN = new V3(), _xbM3 = new THREE.Matrix3();
function xdzBoxUV(G, mat, M, sx, sy, sz, skipBottom) {
  const A = G[mat] || (G[mat] = { p: [], n: [], u: [] }), t = XDZ_TILE[mat] || 1.5, S = [sx, sy, sz], h = [sx / 2, sy / 2, sz / 2], ou = Math.random() * 7, ov = Math.random() * 7; _xbM3.getNormalMatrix(M);
  for (let f = 0; f < 6; f++) {
    if (skipBottom && f === 5) continue; const [n, U, Vv, iu, iv] = XDZ_BOXF[f];
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b2]) => { const x = n[0] * h[0] + (U[0] * a + Vv[0] * b2) * h[0], y = n[1] * h[1] + (U[1] * a + Vv[1] * b2) * h[1], z = n[2] * h[2] + (U[2] * a + Vv[2] * b2) * h[2]; _xbP.set(x, y, z).applyMatrix4(M); return [_xbP.x, _xbP.y, _xbP.z, (a + 1) / 2 * S[iu] / t + ou, (b2 + 1) / 2 * S[iv] / t + ov]; });
    _xbN.set(n[0], n[1], n[2]).applyMatrix3(_xbM3).normalize();
    for (const k of [0, 1, 2, 0, 2, 3]) { const q = pts[k]; A.p.push(q[0], q[1], q[2]); A.n.push(_xbN.x, _xbN.y, _xbN.z); A.u.push(q[3], q[4]); }
  }
}
function xdzGeoFrom(A) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2)); g.setAttribute('uv2', g.attributes.uv); return g; }
// mezzo cilindro (coppi del colmo, grondaia) lungo x, aperto verso il basso (coppo) o verso l'alto (grondaia)
function xdzHalfCyl(G, mat, cx, cy, cz, r, len, seg, upward) {
  const A = G[mat] || (G[mat] = { p: [], n: [], u: [] }), t = XDZ_TILE[mat] || 1.5;
  for (let i = 0; i < seg; i++) {
    const a0 = PI * i / seg, a1 = PI * (i + 1) / seg, s = upward ? -1 : 1, P_ = (a, x) => [cx + x, cy + s * Math.sin(a) * r, cz + Math.cos(a) * r];
    const q = [P_(a0, -len / 2), P_(a0, len / 2), P_(a1, len / 2), P_(a1, -len / 2)], nm = a => [0, s * Math.sin(a), Math.cos(a)];
    for (const [k, a] of [[0, a0], [1, a0], [2, a1], [0, a0], [2, a1], [3, a1]]) { A.p.push(...q[k]); const nn = nm(a); A.n.push(nn[0] * (upward ? -1 : 1), nn[1] * (upward ? -1 : 1), nn[2] * (upward ? -1 : 1)); A.u.push((k === 1 || k === 2 ? len : 0) / t, a * r / t); }
  }
}
function xdzRoofBay(u0, u1, z, s, top, W, rh, pitch, rmat, ends, seed, wear = .35) {
  const G = {}, sr = seeded(seed), tn = Math.tan(pitch), d2 = rh / tn, ov = W - d2, cs = Math.cos(pitch), sn = Math.sin(pitch);
  const yE = top - ov * tn, yR = top + rh, zE = z + s * W, L = Math.hypot(W, yR - yE), up = new V3(0, sn, -s * cs), nrm = new V3(0, cs, s * sn), side = new V3(1, 0, 0);
  const basis = (ang) => new THREE.Matrix4().makeBasis(side, up, nrm);
  const at = (x, k, h) => new V3(x, yE + up.y * k + nrm.y * h, zE + up.z * k + nrm.z * h);
  const Mb = basis(), put = (mat, p, sx, sy, sz, rx = 0, rz = 0, skip) => { const M = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(Mb).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz))); xdzBoxUV(G, mat, M, sx, sy, sz, skip); };
  // tavolato e puntoni
  put('oak_beam', at((u0 + u1) / 2, L / 2, -.1), u1 - u0, L, .2);
  const nr = Math.max(2, Math.round((u1 - u0) / .55)); for (let j = 0; j <= nr; j++) put('oak_beam', at(u0 + .15 + j * (u1 - u0 - .3) / nr, ov / 2 / cs * .5, -.26), .075, ov / cs + .05, .13);
  put('wood', at((u0 + u1) / 2, 0, -.1), u1 - u0, .03, .22);   // frontalino
  // corsi di ardesia (o tegole piane) posati uno per uno: larghezza, rotazione, quota variabili; qualche mancante se usurato
  const ex = rmat === 'clay' ? .206 : .165, nc = Math.floor(L / ex) + 1;
  for (let i = 0; i < nc; i++) {
    const s0 = i * ex; if (s0 > L - .02) break; const Ls = Math.min(ex * 2.1, L - s0 + .02), tilt = Math.atan2(.011, Ls), lift = i ? .012 : .02;
    let x = u0 - (i % 2 ? .05 + sr() * .09 : 0);
    while (x < u1 - .02) {
      const w = rmat === 'clay' ? .17 + sr() * .03 : .22 + sr() * .08, xa = Math.max(x, u0), xb = Math.min(x + w, u1); x += w + .006; if (xb - xa < .04) continue;
      if (sr() < wear * .012 && i > 2 && i < nc - 3) continue;
      put(rmat, at((xa + xb) / 2, s0 + Ls / 2, lift * .5 + (sr() - .5) * .004), xb - xa, Ls + (sr() - .5) * .015, rmat === 'clay' ? .014 : .009, tilt + (sr() - .5) * .02, (sr() - .5) * .04, true);
    }
  }
  // grondaia di ghisa (mezzo tubo) e colmo di coppi (solo sul lato verso +z, per non raddoppiare)
  { const p = at((u0 + u1) / 2, -.06, -.1); xdzHalfCyl(G, 'iron', p.x, p.y - .04, p.z + s * .06, .065, u1 - u0 - .04, 8, true); }
  if (s > 0) { const n = Math.max(1, Math.round((u1 - u0) / .38)); for (let j = 0; j < n; j++) xdzHalfCyl(G, 'clay', u0 + (j + .5) * (u1 - u0) / n, yR + .02, z, .12, .4, 8, false); }
  // bandinelle sui timpani
  for (const e of ends) { const x = e < 0 ? u0 - .01 : u1 + .01; put('wood', at(x, L / 2, -.02), .035, L, .2); }
  const grp = new THREE.Group();
  for (const mat in G) { const merged = xdzGeoFrom(G[mat]); const m = new THREE.Mesh(merged, typeof pipeMat === 'function' ? pipeMat(mat) : xdzMat('ardesia')); m.castShadow = m.receiveShadow = true; grp.add(m); }
  return grp;
}
