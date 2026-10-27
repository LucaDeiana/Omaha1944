"use strict";
// ============================================================
//  Visualizzatore dei modelli 3D del gioco (viewer.html):
//  elenco di navi, aerei, mezzi e armi costruiti con lo stesso
//  codice del gioco; visuali fisse, fil di ferro, scala umana,
//  linea d'acqua e note puntate sul modello da copiare e incollare.
// ============================================================
(function () {
  const $id = id => document.getElementById(id);
  Q = Object.assign({}, Q, { post: false, shadows: 2048, shadowDist: 60, lights: 0, pr: Math.min(devicePixelRatio || 1, 2) });
  try { initEngine(); } catch (e) { $id('err').textContent += 'initEngine: ' + e.message + '\n'; }
  try { initWeapons(); } catch (e) { }
  if (typeof sunFar !== 'undefined' && sunFar) sunFar.castShadow = false; if (sun) sun.shadow.autoUpdate = true;   // nel visualizzatore basta una mappa d'ombra, aggiornata sempre
  scene.fog = null; if (typeof skyMesh !== 'undefined' && skyMesh) skyMesh.visible = false;
  const BG = new THREE.Color(0x3b4247); scene.background = BG;
  renderer.domElement.style.filter = 'none';
  camera.near = .02; camera.far = 20000; camera.fov = 45; camera.updateProjectionMatrix(); camera.rotation.order = 'XYZ';
  const ctl = new THREE.OrbitControls(camera, renderer.domElement); ctl.enableDamping = true; ctl.dampingFactor = .12; ctl.screenSpacePanning = true;

  // ---------- catalogo ----------
  const CAT = [];
  const add = (cat, name, kind, build, note) => CAT.push({ cat, name, kind, build, note });
  for (const k in NCLS) add('Navi', NCLS[k].name, 'ship', () => buildShipModel2(NCLS[k]).g, `${NCLS[k].L} × ${NCLS[k].B} m, pescaggio ${NCLS[k].D} m`);
  const planes = ['p47', 'fw190', 'b26'].concat(Object.keys(PLANE_SPECS).filter(k => !PLANE_SPECS[k].builtin));
  const pname = t => (PLANE_SPECS[t] && PLANE_SPECS[t].name) || { p47: 'P-47 Thunderbolt', fw190: 'Fw 190', b26: 'B-26 Marauder' }[t] || t;
  for (const t of [...new Set(planes)]) add('Aerei', pname(t), 'plane', () => makePlaneModel(t));
  // cabine: modello dell'aereo con la cabina, visti dal posto del pilota; strumenti animati con un volo simulato
  for (const t of [...new Set(planes)].filter(t => PLANE_SPECS[t])) add('Cabine', pname(t), 'cockpit', () => {
    const g = makePlaneModel(t); PL.type = t; PL.cockpit = null; const ck = buildCockpit(t); g.add(ck);
    if (g.userData.glass) g.userData.glass.visible = false; if (g.userData.pilot) g.userData.pilot.visible = false;
    PL.me = { vel: new V3(0, 3, -120), pos: new V3(0, 900, 0), q: new THREE.Quaternion(), parts: { eng: 1, wl: 1, wr: 1, tail: 1 } }; PL.throttle = .8; PL.G = 1.2; PL.gearK = 0;
    g.userData.eye = (PLANE_SPECS[t].eye || [0, 1.12, -.5]); return g; });
  // carri armati: scafo, torretta e cannone assemblati come in gioco
  const tankAsm = geoF => () => { const G = geoF(), g = groupMesh(G.hull), tg = groupMesh(G.tur), gg = groupMesh(G.gun); tg.position.set(0, G.turY, G.turZ); gg.position.set(0, G.gunY, G.gunZ); tg.add(gg); g.add(tg); return g; };
  add('Carri armati', 'M4A1 Sherman', 'veh', tankAsm(kasShermanGeo), 'carro medio USA, 75 mm M3, corazza frontale 76 mm');
  add('Carri armati', 'Panzer III Ausf. J', 'veh', tankAsm(kasPz3Geo), 'carro medio tedesco, 5 cm KwK 39, corazza frontale 50 mm');
  add('Carri armati', 'Panzer IV Ausf. G', 'veh', tankAsm(kasPz4Geo), 'carro medio tedesco, 7,5 cm KwK 40, corazza frontale 80 mm');
  add('Carri armati', 'Tiger I', 'veh', tankAsm(kasTigerGeo), 'carro pesante tedesco, 8,8 cm KwK 36, corazza frontale 100 mm');
  add('Carri armati', 'Pak 40', 'veh', () => { const G = kasPakGeo(), g = groupMesh(G.base), gg = groupMesh(G.gun); gg.position.set(0, 1.05, -.2); g.add(gg); return g; }, 'cannone anticarro da 7,5 cm');
  // unità: lo stesso scheletro e la stessa animazione dei soldati in gioco, con le andature scelte dal menù
  const unit = (team, kind) => () => {
    const b = makeBody(team, kind); b.removed = true;
    for (const p of b.parts) { const scan = useScanHead(p.key), m = new THREE.Mesh(scan ? headScanGeo() : buildPartGeo(p.key, true), scan ? faceMaterial() : MAT.soldier); p.node.add(m); }
    const u = Object.create(Soldier.prototype);
    Object.assign(u, { body: b, root: b.root, pos: new V3(), yaw: 0, kind, team, crouch: 0, prone: 0, wounded: false, ph: 0, flinch: 0, aim: 0, aimW: 0, moving: false, throwT: 0 });
    b.root.userData.unit = u; return b.root;
  };
  const UN = { A: [['rifle', 'Fuciliere — M1 Garand'], ['smg', 'Capo squadra — Thompson'], ['bar', 'Mitragliere — BAR'], ['sniper', 'Tiratore scelto — Springfield'], ['medic', 'Infermiere']],
    E: [['rifle', 'Grenadier — Kar98k'], ['smg', 'Gruppenführer — MP 40'], ['mg', 'Mitragliere — MG 42'], ['sniper', 'Scharfschütze — Kar98k ZF'], ['medic', 'Sanitäter']] };
  for (const t of ['A', 'E']) for (const [k, n] of UN[t]) add('Unità', (t === 'A' ? 'USA · ' : 'Germania · ') + n, 'unit', unit(t, k), t === 'A' ? '29ª Divisione di fanteria, 1944' : '352ª Divisione di fanteria, 1944');
  add('Mezzi', 'Sd.Kfz. 251/1 Ausf. D', 'veh', () => groupMesh(buildHalftrackGeo()), 'semicingolato tedesco, 5,80 × 2,10 m, 2 MG 34, 10 soldati');
  add('Carri armati', 'M4 Sherman (Omaha)', 'veh', () => { const mb = new MB(); addSherman(mb, 0, 0, 0, 0, false); return groupMesh(mb.buildGroups()); }, 'carri DD e del 741° battaglione corazzato a Omaha');
  add('Mezzi', 'Mezzo da sbarco LCVP (Higgins)', 'ship', () => { if (!LCVP_G) buildBoatGeos(); const g = groupMesh(LCVP_G); lcvpMarks(g, 1); if (RAMP_G) { const rp = groupMesh(RAMP_G); rp.position.set(0, .25, -5.1); g.add(rp); } return g; });
  add('Strutture', 'Bunker (WN 62)', 'veh', () => { if (!BUNKER_G) buildBunkerGeo(); return groupMesh(BUNKER_G); });
  const GN = { garand: 'M1 Garand', springfield: 'Springfield M1903', thompson: 'Thompson M1A1', bar: 'BAR M1918', colt: 'Colt M1911', bazooka: 'Bazooka M1', kar98: 'Kar98k', kar98zf: 'Kar98k con ottica', mp40: 'MP 40' };
  for (const id in GN) add('Armi', GN[id], 'gun', () => { const g = buildGun(id).group; g.visible = true; g.traverse(o => o.visible = true); return g; });

  // ---------- interfaccia elenco ----------
  const cats = [...new Set(CAT.map(c => c.cat))];
  for (const c of cats) { const o = document.createElement('option'); o.value = o.textContent = c; $id('cat').appendChild(o); }
  let cur = null, curObj = null, size = new V3(1, 1, 1), center = new V3();
  const fillList = () => {
    $id('list').innerHTML = '';
    CAT.filter(c => c.cat === $id('cat').value).forEach(c => { const d = document.createElement('div'); d.textContent = c.name; d.onclick = () => show(c); if (c === cur) d.className = 'sel'; $id('list').appendChild(d); });
  };
  $id('cat').onchange = fillList;
  $id('toggle').onclick = () => $id('side').classList.toggle('closed');

  // ---------- aiuti: griglia, uomo, acqua ----------
  let grid = null;
  const man = new THREE.Group(); {
    const m = new THREE.MeshStandardMaterial({ color: 0xd4a94a, roughness: .7 });
    const p = (g, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); man.add(o); };
    p(new THREE.CylinderGeometry(.17, .14, .62, 10), 0, 1.15, 0); p(new THREE.SphereGeometry(.12, 12, 9), 0, 1.66, 0);
    for (const s of [-1, 1]) { p(new THREE.CylinderGeometry(.07, .06, .84, 8), s * .1, .42, 0); p(new THREE.CylinderGeometry(.05, .045, .62, 8), s * .24, 1.12, 0); }
    man.visible = false; scene.add(man);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x163847, transparent: true, opacity: .72, roughness: .2, depthWrite: false, side: THREE.DoubleSide }));
  water.rotation.x = -PI / 2; water.renderOrder = 3; water.visible = false; scene.add(water);
  const toggle = (btn, f) => { const on = !btn.classList.contains('on'); btn.classList.toggle('on', on); f(on); };
  $id('bScale').onclick = e => toggle(e.target, on => man.visible = on);
  $id('bWater').onclick = e => toggle(e.target, on => water.visible = on);
  let wire = false;
  $id('bWire').onclick = e => toggle(e.target, on => { wire = on; applyWire(); });
  const applyWire = () => curObj && curObj.traverse(o => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) m.wireframe = wire; });
  let sunA = 0; $id('bSun').onclick = () => { sunA += PI / 4; placeSun(); };
  const placeSun = () => { const r = Math.max(size.x, size.y, size.z) * 1.5 + 10; sun.position.set(center.x + Math.cos(sunA) * r * .6, center.y + r * .7, center.z + Math.sin(sunA) * r * .6 + r * .3); sun.target.position.copy(center); };

  // ---------- visuali ----------
  const view = v => {
    if (cur && cur.kind === 'cockpit' && curObj) { const e = curObj.userData.eye, d = { side: [1, -.2, 0], front: [0, -.15, -1], back: [0, -.3, -1], top: [0, -1, -.3], iso: [-.35, -.2, -1] }[v] || [0, -.15, -1];
      camera.position.set(e[0], e[1], e[2] + .001); ctl.target.set(e[0] + d[0] * .3, e[1] + d[1] * .3, e[2] + d[2] * .3); camera.fov = SETTINGS.fovAir || 88; camera.updateProjectionMatrix(); ctl.update(); return; }
    if (camera.fov !== 45) { camera.fov = 45; camera.updateProjectionMatrix(); }
    const m = Math.max(size.x, size.y, size.z), r = (m * 1.3 + (m < 4 ? .1 : 1)) * (cur && cur.kind === 'unit' ? 1.6 : 1), c = center;
    const P = { side: [r, size.y * .15, 0], front: [0, size.y * .3, -r], back: [0, size.y * .3, r], top: [0, r, .001], iso: [r * .65, r * .45, -r * .6] }[v];
    camera.position.set(c.x + P[0], c.y + P[1], c.z + P[2]); ctl.target.copy(c); ctl.update();
  };
  document.querySelectorAll('#bar [data-v]').forEach(b => b.onclick = () => view(b.dataset.v));

  function show(c) {
    if (curObj) scene.remove(curObj);
    cur = c; let o;
    try { o = c.build(); } catch (e) { $id('err').textContent = c.name + ': ' + e.message; return; }
    curObj = o; scene.add(o); o.updateMatrixWorld(true);
    o.traverse(m => { if (m.isMesh) { const tr = [].concat(m.material).some(x => x && (x.transparent || x.alphaTest > 0)); m.castShadow = !tr; m.receiveShadow = true; m.frustumCulled = false; } });
    const bb = new THREE.Box3().setFromObject(o); bb.getSize(size); bb.getCenter(center);
    let tris = 0; o.traverse(m => { if (m.isMesh && m.geometry) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
    $id('info').innerHTML = `<b style="color:var(--txt)">${c.name}</b><br>Ingombro: ${size.z.toFixed(1)} m lungo · ${size.x.toFixed(1)} m largo · ${size.y.toFixed(1)} m alto<br>${c.note ? c.note + '<br>' : ''}${Math.round(tris).toLocaleString('it-IT')} triangoli`;
    const r = Math.max(size.x, size.z);
    if (grid) scene.remove(grid);
    const step = r > 100 ? 10 : r > 10 ? 1 : .1; grid = new THREE.GridHelper(Math.ceil(r * 1.6 / step) * step, Math.ceil(r * 1.6 / step), 0x6a7378, 0x4a5257);
    grid.position.y = c.kind === 'ship' ? bb.min.y - .01 : bb.min.y - .002; scene.add(grid);
    man.position.set(center.x + size.x / 2 + 1.5, c.kind === 'ship' ? 0 : bb.min.y, center.z); man.scale.setScalar(1);
    water.scale.set(r * 1.6, r * 1.6, 1); water.position.set(center.x, 0, center.z);
    if (c.kind === 'ship' && !$id('bWater').classList.contains('on')) $id('bWater').click();
    if (c.kind !== 'ship' && $id('bWater').classList.contains('on')) $id('bWater').click();
    const s = sun.shadow.camera, sd = r * .8 + 2; s.left = -sd; s.right = sd; s.top = sd; s.bottom = -sd; s.near = .1; s.far = sd * 6; s.updateProjectionMatrix(); sun.shadow.bias = -.0002 * Math.max(1, r / 50);
    $id('gait').style.display = $id('bSlow').style.display = c.kind === 'unit' ? '' : 'none';
    placeSun(); applyWire(); view('iso'); fillList(); renderNotes();
    try { location.hash = encodeURIComponent(c.cat + '/' + c.name); } catch (e) { }
  }

  // ---------- note ----------
  const KEY = 'viewerNotes';
  let notes = []; try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) { } };
  let noteMode = false;
  $id('bNote').onclick = e => toggle(e.target, on => { noteMode = on; $id('hint').textContent = on ? 'Tocca il modello nel punto da commentare' : 'Trascina per ruotare · rotella/pizzico per lo zoom · tasto destro/due dita per spostare'; });
  const where = (p) => {
    // descrizione del punto: posizione lungo l'oggetto (il davanti è verso -z), lato e altezza
    const bb = new THREE.Box3().setFromObject(curObj), L = bb.max.z - bb.min.z || 1, t = (p.z - bb.min.z) / L;
    const front = cur.kind === 'ship' ? 'prua' : cur.kind === 'gun' ? 'volata' : 'muso', back = cur.kind === 'ship' ? 'poppa' : cur.kind === 'gun' ? 'calcio' : 'coda';
    const lon = t < .12 ? front : t < .35 ? 'verso ' + front : t < .65 ? 'centro' : t < .88 ? 'verso ' + back : back;
    const side = Math.abs(p.x) < (bb.max.x - bb.min.x) * .08 ? 'asse centrale' : p.x > 0 ? (cur.kind === 'ship' ? 'dritta (destra)' : 'destra') : (cur.kind === 'ship' ? 'sinistra' : 'sinistra');
    const h = cur.kind === 'ship' ? `${p.y.toFixed(1)} m sopra la linea d'acqua` : `${(p.y - bb.min.y).toFixed(2)} m da terra`;
    const d = cur.kind === 'ship' ? `${(t * L).toFixed(1)} m da prua` : `${(t * L).toFixed(2)} m dal ${front}`;
    return `${lon}, ${side}, ${h}, ${d}`;
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!noteMode || !curObj || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(curObj, true)[0]; if (!hit) return;
    const p = hit.point;
    notes.push({ obj: cur.name, p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], where: where(p), text: '' });
    save(); renderNotes(); $id('bNote').click();
    const ta = $id('nlist').querySelectorAll('textarea'); if (ta.length) ta[ta.length - 1].focus();
  });
  const pins = [];
  function renderNotes() {
    const mine = notes.filter(n => cur && n.obj === cur.name);
    $id('ncount').textContent = `(${mine.length} qui, ${notes.length} in tutto)`;
    $id('nlist').innerHTML = '';
    for (const p of pins) p.el.remove(); pins.length = 0;
    mine.forEach((n, i) => {
      const d = document.createElement('div'); d.className = 'note';
      d.innerHTML = `<div class="h"><b>#${i + 1}</b><span>${n.where}</span><button>✕</button></div><textarea placeholder="Cosa va cambiato qui?"></textarea>`;
      const ta = d.querySelector('textarea'); ta.value = n.text; ta.oninput = () => { n.text = ta.value; save(); };
      d.querySelector('button').onclick = () => { notes.splice(notes.indexOf(n), 1); save(); renderNotes(); };
      $id('nlist').appendChild(d);
      const el = document.createElement('div'); el.className = 'pin'; el.textContent = i + 1; document.body.appendChild(el);
      pins.push({ el, p: new V3(...n.p) });
    });
  }
  $id('bClear').onclick = () => { if (confirm('Cancellare tutte le note di tutti i modelli?')) { notes = []; save(); renderNotes(); } };
  $id('bCopy').onclick = () => {
    const by = {}; for (const n of notes) (by[n.obj] || (by[n.obj] = [])).push(n);
    let s = 'NOTE SUI MODELLI 3D\n';
    for (const o in by) { s += `\n## ${o}\n`; by[o].forEach((n, i) => s += `#${i + 1} [${n.where}; x=${n.p[0]} y=${n.p[1]} z=${n.p[2]}]: ${n.text || '(nessun testo)'}\n`); }
    const done = () => { $id('bCopy').textContent = 'Copiate!'; setTimeout(() => $id('bCopy').textContent = 'Copia tutte', 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => prompt('Copia il testo:', s)); else prompt('Copia il testo:', s);
  };

  // ---------- andature delle unità ----------
  let slow = false, tPrev = performance.now(), gT = 0;
  $id('bSlow').onclick = e => toggle(e.target, on => slow = on);
  function animUnit(u) {
    const now = performance.now(); let dt = Math.min(.05, (now - tPrev) / 1000); tPrev = now; if (slow) dt *= .25; gT += dt;
    const g = $id('gait').value, k = (a, b) => lerp(a, b, Math.min(1, dt * 5));
    let sp = 0, cr = 0, pr = 0, aim = 0;
    if (g === 'walk') sp = 1.6; else if (g === 'run') sp = 4.6; else if (g === 'crouch') { sp = 1.4; cr = 1; } else if (g === 'crawl') { sp = .7; pr = 1; } else if (g === 'aim') aim = 1;
    else if (g === 'sprint') sp = (gT % 4) < 2 ? 5 : 0; else if (g === 'turn') { sp = 4.4; u.yaw += dt * 1.1; }
    u.crouch = k(u.crouch, cr); u.prone = k(u.prone, pr); u.aimW = k(u.aimW, aim); u.aim = 0; u.wounded = g === 'hurt'; u.moving = sp > .3;
    if (g === 'throw') { u.throwT -= dt; if (u.throwT < -1) u.throwT = .7; } else u.throwT = 0;
    u.root.rotation.y = u.yaw; u.anim(dt, sp, 0);
  }

  // ---------- ciclo ----------
  const _v = new V3();
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  (function loop() {
    requestAnimationFrame(loop); ctl.update();
    if (cur && cur.kind === 'cockpit' && PL.me) { const t = performance.now() / 1000; PL.me.q.setFromEuler(new THREE.Euler(Math.sin(t * .3) * .12, Math.sin(t * .1) * 1.5, Math.sin(t * .4) * .35, 'YXZ')); PL.me.vel.set(0, Math.sin(t * .3) * 15, -130 - Math.sin(t * .2) * 30); PL.me.pos.y = 900 + Math.sin(t * .05) * 600; PL.throttle = .6 + Math.sin(t * .25) * .3; PL.stickX = Math.sin(t * .4) * .5; PL.stickY = Math.sin(t * .3) * .4; PL.rudder = Math.sin(t * .2) * .3; PL.G = 1 + Math.abs(Math.sin(t * .3)) * 2; if (!window.GAME) window.GAME = { time: t }; else GAME.time = t; if (!(PL._vt > t)) { PL._vt = t + .07; drawGauges(); } PL.cockpit.visible = true; updateCockpit(.016); }
    if (cur && cur.kind === 'unit' && curObj && curObj.userData.unit) animUnit(curObj.userData.unit);
    for (const p of pins) { _v.copy(p.p).project(camera); const vis = _v.z < 1; p.el.style.display = vis ? '' : 'none'; p.el.style.left = (_v.x + 1) / 2 * innerWidth + 'px'; p.el.style.top = (1 - _v.y) / 2 * innerHeight + 'px'; }
    renderer.render(scene, camera);
  })();

  // apre il modello indicato nell'indirizzo (#Navi/...) oppure il primo
  let start = CAT[0];
  try { const h = decodeURIComponent(location.hash.slice(1)); const f = CAT.find(c => c.cat + '/' + c.name === h); if (f) start = f; } catch (e) { }
  $id('cat').value = start.cat; show(start);
  $id('load').remove();
  window.VIEWER = { CAT, show, ctl, camera, view };
})();
