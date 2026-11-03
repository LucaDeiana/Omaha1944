"use strict";
// ============================================================
//  Distruzione 3.0 — sistema centrale (DZ).
//  Oggetti distruttibili fatti di SEZIONI (pannelli di muro, porta, tetto, barricata, sacchi): ogni sezione ha
//  materiale, integrità, stato, una scatola di collisione vera (un elemento di `solids`) e una mesh.
//  Stati: INTACT → LIGHT_DAMAGE (crepe, frammenti) → HEAVY_DAMAGE (sezione dimezzata: collider abbassato)
//  → DESTROYED (collider tolto, macerie basse con il loro collider semplice). Un edificio con metà dei muri
//  distrutti crolla: un cumulo di macerie con un collider unico, fumo e polvere.
//  Il danno arriva solo da impatti reali: proiettili dei carri che toccano il collider (armor.js) ed esplosioni
//  (weapons.js/explode), con attenuazione dietro altri muri. Ogni cambio di stato aggiorna collider, vista dei
//  carri (TL.ver), coperture della fanteria, percorsi, eventi, rete (l'host decide) e salvataggio.
// ============================================================
const DZ_ST = ['INTACT', 'LIGHT_DAMAGE', 'HEAVY_DAMAGE', 'DESTROYED'];
// resistenza strutturale (non è la perforazione balistica: quella è in TL_MAT di tanklos.js)
const DZ_MAT = {
  legno: { res: 1.2, thr: 8, he: 1.5, ap: .7, col: 0x6b4a2c, dust: [.45, .38, .3], snd: 'dz_wood', tl: 'legno', flam: .35, rub: 0x4a3626 },
  mattoni: { res: 5, thr: 30, he: 1.2, ap: .85, col: 0x8e5a44, dust: [.6, .48, .4], snd: 'dz_crumble', tl: 'muratura', flam: 0, rub: 0x7a4e3c },
  pietra: { res: 6.5, thr: 40, he: 1.1, ap: .75, col: 0xb3a88e, dust: [.66, .63, .56], snd: 'dz_crumble', tl: 'muratura', flam: 0, rub: 0x9a907a },
  cemento: { res: 15, thr: 110, he: 1, ap: .5, col: 0x8a8478, dust: [.6, .6, .58], snd: 'dz_crumble', tl: 'cemento', flam: 0, rub: 0x77736a },
  acciaio: { res: 22, thr: 140, he: .6, ap: 1, col: 0x4a4a48, dust: [.3, .3, .3], snd: 'imp_metal', tl: 'acciaio', flam: 0, rub: 0x3a3a38 },
  sacchi: { res: 3, thr: 15, he: .9, ap: .3, col: 0xa8946a, dust: [.62, .55, .42], snd: 'imp_sand', tl: 'terra', flam: 0, rub: 0x9a8660 },
  terra: { res: 4, thr: 20, he: .7, ap: .2, col: 0x6a5a40, dust: [.5, .42, .3], snd: 'imp_sand', tl: 'terra', flam: 0, rub: 0x5a4a34 },
  vegetazione: { res: .7, thr: 4, he: 1.6, ap: .4, col: 0x3c5a2a, dust: [.35, .4, .25], snd: 'dz_wood', tl: 'vegetazione', flam: .25, rub: 0x3a3a22 },
};
const DZ = { on: false, objs: new Map(), secs: [], routes: [], listeners: {}, log: [], fires: 0, FIRE_MAX: 10, CRATER_MAX: 160, craters: 0, debug: false,
  st: { hits: 0, blasts: 0, changes: 0, colMs: 0, routeMs: 0, rubble: 0, debris: 0, craterMs: 0 }, rub: null, rubN: 0, RUB_MAX: 1500, mats: {}, geo: null };
for (const k in DZ_MAT) if (typeof TL_MAT !== 'undefined' && !TL_TAG['dz_' + k]) TL_TAG['dz_' + k] = DZ_MAT[k].tl;
if (typeof TL_TAG !== 'undefined') { TL_TAG.rubble = 'terra'; TL_TAG.rubbleH = 'muratura'; }
if (typeof VP_CRUSH !== 'undefined') VP_CRUSH.rubble = 1;   // le macerie basse si superano coi cingoli; il cumulo di un crollo no

// ---------- eventi (un solo bus: chi ascolta si registra qui) ----------
function dzOn(type, fn) { (DZ.listeners[type] || (DZ.listeners[type] = [])).push(fn); }
function dzEmit(type, d) { DZ.log.push({ t: GAME.time, type, id: d && d.id }); if (DZ.log.length > 60) DZ.log.shift(); if (!DZ.restoring) for (const fn of DZ.listeners[type] || []) try { fn(d); } catch (e) { console.warn(e); } }

// ---------- materiali e mesh condivisi ----------
function dzMat(m, dmg) { const k = m + (dmg ? '_d' : ''); if (DZ.mats[k]) return DZ.mats[k]; const c = new THREE.Color(DZ_MAT[m].col); if (dmg) c.multiplyScalar(.72); return DZ.mats[k] = new THREE.MeshLambertMaterial({ color: c }); }
function dzInit() {
  if (DZ.geo) return; DZ.on = true;
  DZ.geo = new THREE.BoxGeometry(1, 1, 1); DZ.geo.translate(0, .5, 0);
  // macerie persistenti: un'unica InstancedMesh di sassi (colori per istanza)
  const g = new THREE.IcosahedronGeometry(1, 0); DZ.rub = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }), DZ.RUB_MAX); DZ.rub.count = 0; DZ.rub.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DZ.RUB_MAX * 3), 3); DZ.rub.frustumCulled = false; DZ.rub.castShadow = DZ.rub.receiveShadow = true; scene.add(DZ.rub);
}
function dzReset() {
  for (const s of DZ.secs) { if (s.mesh) { scene.remove(s.mesh); } }
  DZ.objs.clear(); DZ.secs.length = 0; DZ.routes.length = 0; DZ.log.length = 0; DZ.listeners = {}; DZ.fires = 0; DZ.craters = 0; DZ.rubN = 0; if (DZ.rub) DZ.rub.count = 0;
  if (DZ.geo) { scene.remove(DZ.rub); DZ.geo = null; DZ.mats = {}; } DZ.on = false;
}
const _dzM4 = new THREE.Matrix4(), _dzQ = new THREE.Quaternion(), _dzS = new V3(), _dzP = new V3(), _dzC = new THREE.Color();
function dzRubble(x, y, z, s, col) {
  if (!DZ.geo) dzInit();
  if (DZ.rubN >= DZ.RUB_MAX) return; const i = DZ.rubN++;
  _dzQ.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)); _dzM4.compose(_dzP.set(x, y, z), _dzQ, _dzS.set(s, s * rnd(.45, .8), s * rnd(.7, 1.2)));
  DZ.rub.setMatrixAt(i, _dzM4); _dzC.setHex(col).multiplyScalar(rnd(.8, 1.1)); DZ.rub.setColorAt(i, _dzC); DZ.rub.count = DZ.rubN; DZ.rub.instanceMatrix.needsUpdate = true; DZ.rub.instanceColor.needsUpdate = true; DZ.st.rubble = DZ.rubN;
}

// ---------- registrazione ----------
// una sezione: scatola [x0,y0,z0]-[x1,y1,z1], materiale, ruolo (wall, door, roof, barricade, sandbag); hp dal volume e dalla resistenza
function dzSection(obj, role, mat, x0, y0, z0, x1, y1, z1, o = {}) {
  dzInit(); const M = DZ_MAT[mat], vol = (x1 - x0) * (y1 - y0) * (z1 - z0);
  const sol = addSolid(x0, y0, z0, x1, y1, z1, 'dz_' + mat); sol.mat = M.tl;
  const sec = { n: DZ.secs.length, id: obj.id + '/' + (obj.secs.length), obj, role, mat, M, box: [x0, y0, z0, x1, y1, z1], sol, max: Math.max(60, vol * M.res * 42) * (o.hpK || 1), hp: 0, state: 0, covers: [], rubSol: null, ground: o.ground ?? y0, structural: role === 'wall' };
  sec.hp = sec.max; sol._dz = sec;
  if (role !== 'hidden') { const m = new THREE.Mesh(DZ.geo, dzMat(mat, false)); m.position.set((x0 + x1) / 2, y0, (z0 + z1) / 2); m.scale.set(x1 - x0, y1 - y0, z1 - z0); m.castShadow = m.receiveShadow = true; scene.add(m); sec.mesh = m; }
  obj.secs.push(sec); DZ.secs.push(sec); return sec;
}
function dzObject(id, type, o = {}) { dzInit(); const obj = { id, type, state: 0, secs: [], collapsed: false, persistent: true, ...o }; DZ.objs.set(id, obj); return obj; }
// casa in muratura: muri a pannelli (2 per piano in altezza, ~2,6 m in larghezza), porta di legno, finestre come pannelli più bassi, tetto
function dzHouse(id, cx, cz, w, d, storeys, mat = 'pietra', o = {}) {
  const obj = dzObject(id, 'building', { mat, cx, cz, w, d }), t = .55, sh = 3.1, H = storeys * sh;
  let base = 1e9; for (const [x, z] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2], [cx, cz]]) base = Math.min(base, Hf(x, z)); base -= .3; obj.base = base; obj.top = base + H;
  const run = (ax, a0, a1, fixed, fz, face) => {   // fila di pannelli lungo x (ax='x') o lungo z
    const L = a1 - a0, n = Math.max(2, Math.round(L / 2.6)), pw = L / n;
    for (let i = 0; i < n; i++) for (let s = 0; s < storeys; s++) {
      const p0 = a0 + i * pw, p1 = p0 + pw, y0 = s ? base + s * sh : base - .6, y1 = base + (s + 1) * sh, door = face === 'front' && s === 0 && i === Math.floor(n / 2);
      const box = ax === 'x' ? [p0, y0, fixed - t / 2, p1, y1, fixed + t / 2] : [fixed - t / 2, y0, p0, fixed + t / 2, y1, p1];
      if (door) { const dh = base + 2.2; const b2 = box.slice(); b2[4] = dh; const dsec = dzSection(obj, 'door', 'legno', ...b2, { hpK: .6 }); dsec.face = face; const b3 = box.slice(); b3[1] = dh; dzSection(obj, 'wall', mat, ...b3).face = face; continue; }
      dzSection(obj, 'wall', mat, ...box).face = face;
    }
  };
  run('x', cx - w / 2, cx + w / 2, cz + d / 2, 0, 'front'); run('x', cx - w / 2, cx + w / 2, cz - d / 2, 0, 'back');
  run('z', cz - d / 2 + t / 2, cz + d / 2 - t / 2, cx - w / 2, 0, 'left'); run('z', cz - d / 2 + t / 2, cz + d / 2 - t / 2, cx + w / 2, 0, 'right');
  // tetto: una lastra (blocca la vista dall'alto), crolla con l'edificio
  const roof = dzSection(obj, 'roof', 'legno', cx - w / 2 - .3, obj.top, cz - d / 2 - .3, cx + w / 2 + .3, obj.top + .5, cz + d / 2 + .3, { hpK: 3 }); roof.mesh.material = new THREE.MeshLambertMaterial({ color: 0x5f646b });
  // coperture della fanteria ai lati della casa
  for (const [x, z, f] of [[cx - w / 2 - 1, cz + d / 2 + 1.2, 'front'], [cx + w / 2 + 1, cz + d / 2 + 1.2, 'front'], [cx - w / 2 - 1.2, cz - d / 2 - 1, 'back'], [cx + w / 2 + 1.2, cz - d / 2 - 1, 'back']]) dzCover(obj.secs.find(s => s.face === f && s.role === 'wall'), x, z, 'house');
  return obj;
}
// muro basso o alto lungo un segmento, a pannelli
function dzWall(id, x0, z0, x1, z1, h, mat = 'pietra', o = {}) {
  const obj = dzObject(id, o.type || 'wall', { mat }), L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (o.pw || 2.4))), t = o.t || .6, alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, xa = lerp(x0, x1, a), xb = lerp(x0, x1, b), za = lerp(z0, z1, a), zb = lerp(z0, z1, b), g = Math.min(Hf(xa, za), Hf(xb, zb), Hf((xa + xb) / 2, (za + zb) / 2)) - .4;
    const box = alongX ? [Math.min(xa, xb), g, (za + zb) / 2 - t / 2, Math.max(xa, xb), g + .4 + h, (za + zb) / 2 + t / 2] : [(xa + xb) / 2 - t / 2, g, Math.min(za, zb), (xa + xb) / 2 + t / 2, g + .4 + h, Math.max(za, zb)];
    const s = dzSection(obj, o.role || 'wall', mat, ...box, o); s.structural = false;
    if (o.cover !== false) { const nx = alongX ? 0 : 1, nz = alongX ? 1 : 0, cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2, side = o.coverSide || 1; dzCover(s, cx + nx * side * (t / 2 + .8), cz + nz * side * (t / 2 + .8), h < 1.4 ? 'sand' : 'wallN'); }
  }
  return obj;
}
function dzCover(sec, x, z, kind) { if (!sec) return; const c = { x, z, kind, occ: 0, dz: sec }; covers.push(c); sec.covers.push(c); return c; }
// percorso (per carri o fanteria): un segmento che si apre o si chiude secondo i collider
function dzRoute(id, a, b, width, who = 'tank') { const r = { id, a: a.clone(), b: b.clone(), w: width, who, open: null }; DZ.routes.push(r); r.open = dzRouteOpen(r); return r; }
function dzRouteOpen(r) {
  const t0 = performance.now(), L = r.a.distanceTo(r.b), n = Math.ceil(L / 1.5), h = r.who === 'tank' ? 1.6 : 1.2, rad = r.w / 2;
  let ok = true;
  for (let i = 0; i <= n && ok; i++) { const x = lerp(r.a.x, r.b.x, i / n), z = lerp(r.a.z, r.b.z, i / n), y = Hf(x, z);
    for (const s of vpCell(x, z).concat(VP.big)) { if (!s.on || (r.who === 'tank' && VP_CRUSH[s.tag]) || s.max.y < y + (r.who === 'tank' ? .8 : .7) || s.min.y > y + h) continue; if (x > s.min.x - rad && x < s.max.x + rad && z > s.min.z - rad && z < s.max.z + rad) { ok = false; break; } } }
  DZ.st.routeMs += performance.now() - t0; return ok;
}
function dzRoutesNear(box) {
  for (const r of DZ.routes) {
    const x0 = Math.min(r.a.x, r.b.x) - r.w - 4, x1 = Math.max(r.a.x, r.b.x) + r.w + 4, z0 = Math.min(r.a.z, r.b.z) - r.w - 4, z1 = Math.max(r.a.z, r.b.z) + r.w + 4;
    if (box[3] < x0 || box[0] > x1 || box[5] < z0 || box[2] > z1) continue;
    const o = dzRouteOpen(r); if (o !== r.open) { r.open = o; dzEmit(o ? 'ROUTE_OPENED' : 'ROUTE_BLOCKED', { id: r.id, route: r }); }
  }
}

// ---------- danni ----------
// impatto di un proiettile perforante (o esplosivo) su una sezione: energia ~ calibro
function dzShellHit(sol, p, dir, sh) {
  const sec = sol._dz; if (!sec || sec.state >= 3 || NET.client) return;
  DZ.st.hits++; const cal = (sh.T && sh.T.cal) || 75, dmg = cal * 8 * (sh.he ? sec.M.he * 1.6 : sec.M.ap);
  dzDamage(sec, dmg, p, dir);
  if (sh.he) dzBlast(p, 4 + cal / 40, cal * 4, { skip: sec });
}
// esplosione: tutte le sezioni nel raggio, con attenuazione per distanza e dietro altri muri (un muro integro protegge ciò che sta dietro)
const _dzA = new V3(), _dzB = new V3();
function dzBlast(p, radius, dmg, o = {}) {
  if (!DZ.on || NET.client || radius < 1.5) return; DZ.st.blasts++;
  const r2 = radius + 2;
  for (const sec of DZ.secs) {
    if (sec.state >= 3 || sec === o.skip) continue; const b = sec.box;
    const cx = clamp(p.x, b[0], b[3]), cy = clamp(p.y, b[1], b[4]), cz = clamp(p.z, b[2], b[5]), d = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
    if (d > r2) continue;
    let k = Math.pow(1 - d / r2, 1.4);
    if (d > .6) { _dzA.copy(p); _dzB.set(cx, cy, cz); const h = tlRay(_dzA, _dzB, 'shell', 0, true); if (h && h.s && h.s !== sec.sol && h.t < d - .4) k *= .2; }   // schermata da un'altra sezione o un altro solido
    dzDamage(sec, dmg * k * sec.M.he, p, null);
  }
}
function dzDamage(sec, dmg, p, dir) {
  if (NET.client) return;   // i danni strutturali li decide solo l'host
  if (sec.state >= 3 || dmg < sec.M.thr) { if (dmg > 2 && p && R() < .5) fxImpact(p, sec.M.tl === 'acciaio' ? 'metal' : 'dirt'); return; }
  sec.hp = Math.max(0, sec.hp - dmg); const f = sec.hp / sec.max, st = f <= 0 ? 3 : f < .35 ? 2 : f < .72 ? 1 : 0;
  dzChips(sec, p, dir, st > sec.state ? 1 : .4);
  if (st > sec.state) dzSetState(sec, st, { p, dir });
}
// frammenti e polvere temporanei (pool di detriti e particelle già esistenti), orientati dalla direzione dell'impatto
function dzChips(sec, p, dir, k) {
  if (!p) { const b = sec.box; p = _dzP.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); }
  const n = Math.round(6 * k + 2); DZ.st.debris += n; fxDebris(p, n, .7 + k * .5);
  const c = sec.M.dust; for (let i = 0; i < 3 + 4 * k; i++) PS_SMOKE.emit(p.x + rnd(-.6, .6), p.y + rnd(-.4, .6), p.z + rnd(-.6, .6), (dir ? -dir.x * 2 : 0) + rnd(-1, 1), rnd(.3, 1.6), (dir ? -dir.z * 2 : 0) + rnd(-1, 1), rnd(3, 6), 1.2, 4 + k * 3, c[0], c[1], c[2], .55, .5, -.03);
  if (typeof play === 'function' && dist2Cam(p) < 250 * 250) play(sec.M.snd, p.clone ? p.clone() : p, { vol: .7 + k * .5, ref: 25, cx: 'destruction.' + sec.mat });
}
function dzSetState(sec, st, o = {}) {
  if (st <= sec.state && !o.force) return; const t0 = performance.now();
  sec.state = st; DZ.st.changes++; const b = sec.box, m = sec.mesh, quiet = !!o.quiet;
  if (st >= 1 && m) m.material = sec.role === 'roof' ? m.material : dzMat(sec.mat, true);   // crepe: tinta più scura e frammenti
  if (st === 2 && sec.role !== 'roof') {
    // gravemente danneggiata: resta metà della sezione (in basso), il collider segue la geometria
    const h = (b[4] - b[1]) * .5; sec.sol.max.y = b[1] + h; if (m) m.scale.y = h; sec.hp = Math.min(sec.hp, sec.max * .34);
    for (const c of sec.covers) c.kind = 'ruin';
    if (!quiet) for (let i = 0; i < 5; i++) dzRubble(rnd(b[0], b[3]), sec.ground + .1, rnd(b[2], b[5]), rnd(.25, .5), sec.M.rub);
  }
  if (st === 3) {
    sec.sol.on = false; if (m) m.visible = false;
    // macerie basse dove stava la sezione (collider semplice, superabile dai cingoli, copertura bassa)
    if (sec.role !== 'roof' && sec.role !== 'hidden') {
      const y0 = sec.ground, rh = sec.role === 'door' ? .25 : .55;
      sec.rubSol = addSolid(b[0] - .3, y0 - .5, b[2] - .3, b[3] + .3, y0 + rh, b[5] + .3, 'rubble'); sec.rubSol.mat = 'terra'; sec.rubSol.walk = true;
      const n = quiet ? 4 : 9; for (let i = 0; i < n; i++) dzRubble(rnd(b[0] - .6, b[3] + .6), y0 + .1, rnd(b[2] - .6, b[5] + .6), rnd(.25, .65), sec.M.rub);
    }
    for (const c of sec.covers) dzCoverLost(c);
    if (sec.role === 'wall' || sec.role === 'door' || sec.role === 'barricade') dzEmit(sec.obj.type === 'building' ? 'WALL_BREACHED' : sec.role === 'barricade' ? 'COVER_DESTROYED' : 'WALL_BREACHED', { id: sec.obj.id, sec, p: o.p });
    if (!quiet && sec.M.flam > 0 && R() < sec.M.flam) dzFire(new V3((b[0] + b[3]) / 2, sec.ground + .3, (b[2] + b[5]) / 2), .8, 50);
  }
  if (!quiet && st >= 2) { const c = new V3((b[0] + b[3]) / 2, b[1] + 1, (b[2] + b[5]) / 2); for (let i = 0; i < 6; i++) PS_SMOKE.emit(c.x + rnd(-1, 1), c.y + rnd(0, 1.5), c.z + rnd(-1, 1), rnd(-1, 1), rnd(.5, 2), rnd(-1, 1), rnd(6, 10), 2, 7, ...sec.M.dust, .6, .5, -.04); }
  if (typeof TL !== 'undefined') TL.ver = (TL.ver || 0) + 1;   // vista e linea di tiro dei carri da ricalcolare
  if (NET.host) netHostEvent([7, sec.n, st]);
  dzObjState(sec.obj, o); dzRoutesNear(b);
  DZ.st.colMs += performance.now() - t0;
}
// stato dell'oggetto dalle sue sezioni; crollo di un edificio con metà dei muri distrutti
function dzObjState(obj, o = {}) {
  const walls = obj.secs.filter(s => s.structural), gone = walls.filter(s => s.state >= 3).length, worst = Math.max(...obj.secs.map(s => s.state));
  const prev = obj.state;
  obj.state = obj.collapsed ? 3 : obj.type === 'building' ? (gone / Math.max(1, walls.length) >= .5 ? 3 : walls.some(s => s.state >= 2) || gone ? 2 : worst >= 1 ? 1 : 0) : obj.secs.every(s => s.state >= 3) ? 3 : worst;
  if (obj.type === 'building' && obj.state === 3 && !obj.collapsed) dzCollapse(obj, o);
  if (obj.state !== prev) dzEmit('STATE_' + DZ_ST[obj.state], { id: obj.id, obj });
}
function dzCollapse(obj, o = {}) {
  obj.collapsed = true; const quiet = !!o.quiet;
  for (const s of obj.secs) if (s.state < 3) { s.state = 2; dzSetState(s, 3, { quiet: true }); }
  // cumulo: collider unico, più basso della casa ma alto abbastanza da bloccare i carri e dare copertura
  const x0 = obj.cx - obj.w / 2 - 1, x1 = obj.cx + obj.w / 2 + 1, z0 = obj.cz - obj.d / 2 - 1, z1 = obj.cz + obj.d / 2 + 1, hh = Math.min(2.4, (obj.top - obj.base) * .3);
  obj.mound = addSolid(obj.cx - obj.w / 2 + .8, obj.base - .5, obj.cz - obj.d / 2 + .8, obj.cx + obj.w / 2 - .8, obj.base + hh, obj.cz + obj.d / 2 - .8, 'rubbleH'); obj.mound.mat = 'muratura';
  const M = DZ_MAT[obj.mat] || DZ_MAT.pietra, n = quiet ? 40 : 70;
  for (let i = 0; i < n; i++) { const x = rnd(x0, x1), z = rnd(z0, z1), e = 1 - Math.max(Math.abs(x - obj.cx) / (obj.w / 2 + 1), Math.abs(z - obj.cz) / (obj.d / 2 + 1)); dzRubble(x, obj.base + Math.max(.1, e * hh * .8), z, rnd(.4, 1.1), R() < .8 ? M.rub : 0x3a2a1e); }
  dzRoutesNear([x0, 0, z0, x1, 0, z1]);
  for (const s of allies.concat(enemies)) if (s.alive && s.pos.x > x0 + 1 && s.pos.x < x1 - 1 && s.pos.z > z0 + 1 && s.pos.z < z1 - 1) s.die(new V3(obj.cx, obj.base + 3, obj.cz), false, 'blast', { blast: new V3(obj.cx, obj.base + 4, obj.cz), power: 5 });
  if (!quiet) {
    const c = new V3(obj.cx, obj.base + 2, obj.cz); fxDebris(c, 50, 2.6);
    for (let i = 0; i < 24; i++) PS_SMOKE.emit(rnd(x0, x1), obj.base + rnd(.5, 5), rnd(z0, z1), rnd(-3, 3), rnd(1, 4), rnd(-3, 3), rnd(8, 14), 3, 12, ...M.dust, .75, .5, -.03);
    if (typeof play === 'function') play('dz_collapse', c, { vol: 1.6, ref: 60, cx: 'destruction.collapse' }); sfxBoom(c, 1.4);
    const e = addEmitter(new V3(obj.cx, obj.base + 1.5, obj.cz), 'smoke', 1.2); e.life = 90;
    if (P.mode === 'foot' && P.pos.distanceTo(c) < 50) P.shake += .7;
  }
  dzEmit('BUILDING_COLLAPSED', { id: obj.id, obj });
}
// copertura persa: non si sceglie più; chi la stava usando lo sa e se ne cerca un'altra
function dzCoverLost(c) {
  if (c.dead) return; c.dead = true; c.occ = 99;
  for (const s of allies.concat(enemies)) if (s.alive && s.cover === c) { s.cover = null; s.state = 'idle'; s.wait = 0; s.dest = null; s.supp = Math.max(s.supp || 0, .6); s.coverLostT = GAME.time; if (typeof shout === 'function' && R() < .5) shout(s.team === 'E' ? 'de' : 'en', 'move', s.pos, { src: s }); }
  dzEmit('COVER_DESTROYED', { id: c.dz ? c.dz.obj.id : '', cover: c });
}
// incendio limitato (budget), con fumo; danno ai soldati vicinissimi
function dzFire(p, s = 1, life = 60) {
  if (DZ.fires >= DZ.FIRE_MAX) return null; DZ.fires++;
  const e = addEmitter(p, 'fire', s); e.life = life; const sm = addEmitter(p.clone().add(new V3(0, 1, 0)), 'smoke', s * .9); sm.life = life * 1.5;
  after(life, () => DZ.fires--); return e;
}

// ---------- crateri: il terreno fisico (griglie HF e HC) e la mesh del terreno si abbassano davvero ----------
function dzCraterProfile(k) { return k < .72 ? -(1 - (k / .72) ** 2) : .35 * Math.sin((k - .72) / .28 * PI); }
function dzCrater(p, r, depth) {
  if (DZ.craters >= DZ.CRATER_MAX || SCEN === 'air' || SCEN === 'sea' || !WORLD.terr) return false;
  if (Hf(p.x, p.z) < WATER_Y + .3 || p.y - Hf(p.x, p.z) > 1.2) return false;   // in acqua o troppo in alto: niente cratere
  if (typeof cityIn === 'function' && SCEN === 'omaha' && cityIn(p.x, p.z) && solids.some(s => s.on && p.x > s.min.x && p.x < s.max.x && p.z > s.min.z && p.z < s.max.z)) return false;
  const t0 = performance.now(); DZ.craters++;
  const dip = (x, z) => { const d = Math.hypot(x - p.x, z - p.z); return d < r ? depth * dzCraterProfile(d / r) : 0; };
  for (const G of [HF, HC]) { if (!G.d) continue; const i0 = Math.max(0, Math.floor((p.x - r - G.x0) / G.step)), i1 = Math.min(G.nx - 1, Math.ceil((p.x + r - G.x0) / G.step)), j0 = Math.max(0, Math.floor((p.z - r - G.z0) / G.step)), j1 = Math.min(G.nz - 1, Math.ceil((p.z + r - G.z0) / G.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) G.d[j * G.nx + i] += dip(G.x0 + i * G.step, G.z0 + j * G.step); }
  // mesh: vertici nel raggio (ricerca binaria sugli assi), normali e colore di terra smossa; aggiornamento del solo intervallo di righe
  const T = WORLD.terr, pos = T.g.attributes.position, nor = T.g.attributes.normal, sp = T.g.attributes.splat, bs = (a, v) => { let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
  const i0 = Math.max(0, bs(T.xs, p.x - r * 1.3) - 1), i1 = Math.min(T.nx - 1, bs(T.xs, p.x + r * 1.3) + 1), j0 = Math.max(0, bs(T.zs, p.z - r * 1.3) - 1), j1 = Math.min(T.nz - 1, bs(T.zs, p.z + r * 1.3) + 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * T.nx + i, x = T.xs[i], z = T.zs[j], dd = Math.hypot(x - p.x, z - p.z); if (dd > r * 1.3) continue;
    pos.setY(k, Hf(x, z)); const e = .6, nx = Hf(x - e, z) - Hf(x + e, z), nz = Hf(x, z - e) - Hf(x, z + e), l = Math.hypot(nx, 2 * e, nz); nor.setXYZ(k, nx / l, 2 * e / l, nz / l);
    if (sp) { const q = clamp(1 - dd / (r * 1.3), 0, 1) * .85; sp.setXYZW(k, sp.getX(k) * (1 - q), sp.getY(k) * (1 - q), sp.getZ(k) * (1 - q), sp.getW(k) * (1 - q) + q); }
  }
  for (const a of [pos, nor, sp]) if (a) { a.updateRange.offset = j0 * T.nx * a.itemSize; a.updateRange.count = (j1 - j0 + 1) * T.nx * a.itemSize; a.needsUpdate = true; }
  // terra sollevata sul bordo e polvere
  for (let i = 0; i < 10; i++) { const a = R() * TAU, rr = r * rnd(.8, 1.15), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; dzRubble(x, Hf(x, z) + .05, z, rnd(.15, .35) * r / 3, 0x4a3c2a); }
  DZ.cr = DZ.cr || []; DZ.cr.push([+p.x.toFixed(1), +p.z.toFixed(1), +r.toFixed(2), +depth.toFixed(2)]);
  DZ.st.craterMs += performance.now() - t0; dzEmit('CRATER', { id: 'crater', p, r }); return true;
}
// dalle esplosioni: piccolo (granata grossa), medio (HE di carro, mortaio), grande (bomba, nave)
function dzExplosion(p, radius, dmg, o = {}) {
  if (NET.client) return;
  dzBlast(p, radius, dmg, o);
  const sz = o.ship || radius >= 9 ? [5.5, 1.6] : radius >= 6 ? [3.4, 1.0] : radius >= 4.5 ? [2.2, .6] : null;
  if (sz && !o.noCrater) { const ok = dzCrater(p, sz[0] * rnd(.85, 1.15), sz[1] * rnd(.85, 1.15)); if (ok && NET.host) netHostEvent([8, +p.x.toFixed(1), +p.z.toFixed(1), sz[0], sz[1]]); }
}

// ---------- relitti: collider d'acciaio, copertura, niente più bersaglio (alive = false) ----------
function dzWreck(t) {
  if (t.wreckSol || !t.pos) return; const h = t.T ? t.T.half : [1.5, 3], hh = t.T ? t.T.hullH : 2;
  const c = Math.abs(Math.cos(t.yaw)), s = Math.abs(Math.sin(t.yaw)), ex = h[0] * c + h[1] * s, ez = h[0] * s + h[1] * c;
  t.wreckSol = addSolid(t.pos.x - ex, t.pos.y - .3, t.pos.z - ez, t.pos.x + ex, t.pos.y + hh, t.pos.z + ez, 'tank'); t.wreckSol.mat = 'acciaio';
  covers.push({ x: t.pos.x + ex + 1, z: t.pos.z, kind: 'tank', occ: 0 }, { x: t.pos.x - ex - 1, z: t.pos.z, kind: 'tank', occ: 0 });
  // fuoco e fumo del relitto li crea già chi distrugge il carro (KasTank.destroy, Panzer.damage): qui non si duplicano
  if (typeof TL !== 'undefined') TL.ver = (TL.ver || 0) + 1;
  dzRoutesNear([t.pos.x - ex, 0, t.pos.z - ez, t.pos.x + ex, 0, t.pos.z + ez]);
  dzEmit('VEHICLE_WRECK_CREATED', { id: t.name || t.type, t });
}

// ---------- persistenza (checkpoint) e rete ----------
function dzSnapshot() { return { v: 1, s: DZ.secs.map(s => s.state).join(''), h: DZ.secs.map(s => Math.round(s.hp / s.max * 100)), cr: (DZ.cr || []).slice(0, 80), c: [...DZ.objs.values()].filter(o => o.collapsed).map(o => o.id) }; }
function dzRestore(sn) {
  if (!sn || sn.v !== 1 || typeof sn.s !== 'string') return false; DZ.restoring = true; try {
  for (let i = 0; i < DZ.secs.length && i < sn.s.length; i++) { const sec = DZ.secs[i], st = +sn.s[i]; if (sn.h && sn.h[i] !== undefined) sec.hp = sec.max * sn.h[i] / 100; if (st > sec.state) { if (st === 3 && sec.state < 2) dzSetState(sec, 2, { quiet: true }); dzSetState(sec, st, { quiet: true }); } }
  for (const id of sn.c || []) { const o = DZ.objs.get(id); if (o && !o.collapsed) dzCollapse(o, { quiet: true }); }
  for (const c of sn.cr || []) if (!(DZ.cr || []).some(q => q[0] === c[0] && q[1] === c[1])) dzCrater(new V3(c[0], Hf(c[0], c[1]), c[1]), c[2], c[3]);
  } finally { DZ.restoring = false; }
  return true;
}
// rete: l'host decide e invia gli stati; il client li applica (effetti generati in locale) e si riallinea con l'istantanea periodica
function dzNetEvent(e) { if (e[0] === 7) { const s = DZ.secs[e[1]]; if (s && e[2] > s.state) dzSetState(s, e[2], {}); } else if (e[0] === 8) dzCrater(new V3(e[1], Hf(e[1], e[2]), e[2]), e[3], e[4]); }
function dzNetSync(str) { if (typeof str !== 'string') return; for (let i = 0; i < DZ.secs.length && i < str.length; i++) { const st = +str[i], s = DZ.secs[i]; if (st > s.state) dzSetState(s, st, { quiet: true }); } }

// ---------- debug (Ctrl+Maiusc+J): sezioni colorate per stato, integrità, percorsi, eventi; comandi di prova ----------
const DZD = { g: null, el: null };
function dzDebugTick() {
  if (!DZ.debug || !DZ.on) { if (DZD.g) DZD.g.visible = false; if (DZD.el) DZD.el.style.display = 'none'; return; }
  if (!DZD.g) { DZD.g = new THREE.Group(); scene.add(DZD.g); DZD.el = document.createElement('div'); DZD.el.style.cssText = 'position:fixed;right:10px;top:120px;z-index:61;font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.65);padding:6px 8px;max-width:360px;pointer-events:none;white-space:pre'; document.body.appendChild(DZD.el); }
  while (DZD.g.children.length) { const c = DZD.g.children.pop(); c.geometry.dispose(); }
  const col = [0x40ff60, 0xffe040, 0xff8030, 0xff2030], box = (b, c) => { const h = new THREE.Box3Helper(new THREE.Box3(b.min.clone(), b.max.clone()), c); h.material.depthTest = false; DZD.g.add(h); };
  for (const s of DZ.secs) if (s.sol.on) box(s.sol, col[s.state]); else if (s.rubSol) box(s.rubSol, 0x8080ff);
  for (const o of DZ.objs.values()) if (o.mound) box(o.mound, 0xb040ff);
  for (const r of DZ.routes) { const g = new THREE.BufferGeometry().setFromPoints([r.a.clone().setY(Hf(r.a.x, r.a.z) + .5), r.b.clone().setY(Hf(r.b.x, r.b.z) + .5)]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: r.open ? 0x40ff60 : 0xff2030, depthTest: false })); DZD.g.add(l); }
  DZD.g.visible = true; DZD.el.style.display = 'block';
  DZD.el.textContent = 'DISTRUZIONE\n' + [...DZ.objs.values()].map(o => `${o.id} ${DZ_ST[o.state]} ${Math.round(o.secs.reduce((a, s) => a + s.hp, 0) / o.secs.reduce((a, s) => a + s.max, 0) * 100)}% sez.${o.secs.filter(s => s.state >= 3).length}/${o.secs.length}`).join('\n') +
    '\npercorsi: ' + DZ.routes.map(r => r.id + (r.open ? ' aperto' : ' chiuso')).join(', ') + `\nmacerie ${DZ.rubN}/${DZ.RUB_MAX} · incendi ${DZ.fires}/${DZ.FIRE_MAX} · crateri ${DZ.craters} · collider ${DZ.st.colMs.toFixed(1)} ms tot\n` + DZ.log.slice(-6).map(e => `${e.t.toFixed(0)}s ${e.type} ${e.id || ''}`).join('\n') + '\n[ dzTest.damage(id, n) · dzTest.destroy(id) ]';
}
const dzTest = { damage(id, n = 400) { const o = DZ.objs.get(id); if (o) for (const s of o.secs) dzDamage(s, n, null, null); }, destroy(id) { const o = DZ.objs.get(id); if (o) for (const s of o.secs) { if (s.state < 2) dzSetState(s, 2, {}); dzSetState(s, 3, {}); } } };
addEventListener('keydown', e => { if (e.code === 'KeyJ' && e.ctrlKey && e.shiftKey) { e.preventDefault(); DZ.debug = !DZ.debug; if (typeof showMsg === 'function') showMsg('Debug distruzione: ' + (DZ.debug ? 'attivo' : 'spento'), 1.5); } });
