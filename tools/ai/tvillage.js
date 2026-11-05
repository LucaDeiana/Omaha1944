// test del villaggio esteso 2.0 (solo tech demo) — node tools/ai/tvillage.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  // mappa originale: nessun edificio del villaggio esteso
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const O = await p.evaluate(() => ({ built: V2.built.length, mesh: !!scene.getObjectByProperty('uuid', V2.plazaMesh && V2.plazaMesh.uuid) }));
  ok('mappa originale: villaggio esteso non costruito', O.built === 0 && !O.mesh, JSON.stringify(O));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(2500);
  const R = await p.evaluate(() => {
    GAME.running = false; const out = { st: V2.stats, val: v2Validate() };
    const inSolid = (x, y, z) => solids.some(s => s.on !== false && x > s.min.x && x < s.max.x && y > s.min.y && y < s.max.y && z > s.min.z && z < s.max.z);
    const ground = (x, z, y) => Math.max(Hf(x, z), worldFloor(x, z, y));
    // percorso a piedi: quota continua (gradino ≤ 0,55 m) e corpo libero da solidi
    const walk = (pts, n = 40) => { let y = ground(pts[0][0], pts[0][1], Hf(pts[0][0], pts[0][1]) + .3), maxStep = 0, blocked = 0;
      for (let i = 0; i < pts.length - 1; i++) for (let k = 1; k <= n; k++) { const t = k / n, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, y2 = ground(x, z, y); maxStep = Math.max(maxStep, Math.abs(y2 - y)); y = y2; if (inSolid(x, y + 1.1, z) || inSolid(x, y + .5, z)) blocked++; }
      return { maxStep: +maxStep.toFixed(2), blocked, y }; };
    const W = (u, v) => [AV.cx + u, AV.cz + v];
    // campanile: dalla porta sud fino alla cella campanaria (rampe nord e sud, pianerottoli)
    const T = V2.defs.find(d => d.id === 'v2_campanile'), tx = AV.cx + T.u, tz = AV.cz + T.v, x0 = tx - 2.05, x1 = tx + 2.05, z0 = tz - 2.05, z1 = tz + 2.05, sw = .9, base = T.base;
    const tw = [[tx, tz + 4], [tx, tz + 1], [x1 - .4, tz]];
    for (let k = 0; k < 3; k++) tw.push([x1 - .4, z0 + .45], [x1 - .25, z0 + .45], [x0 + .45, z0 + .45], [x0 + .45, z1 - .45], [x1 - .25, z1 - .45], [x1 - .4, tz]);
    const tr = walk(tw); out.tower = { ...tr, quota: +(tr.y - base).toFixed(2) };
    // chiesa: dalla piazza attraverso il portale fino al presbiterio rialzato
    const N = V2.defs.find(d => d.id === 'v2_chiesa'), nx = AV.cx + N.u, nz = AV.cz + N.v, door = nx - N.w / 2 + .66 * N.w;
    out.church = walk([[door, nz + N.d / 2 + 3], [door, nz + N.d / 2 - 1.2], [door, nz], [nx + N.w / 2 - 2.2, nz]]);
    // locanda e casa del quartiere residenziale: si sale al primo piano
    const up = (id) => { const d = V2.defs.find(q => q.id === id), x = AV.cx + d.u, z = AV.cz + d.v, ix0 = x - d.w / 2 + .55, iz0 = z - d.d / 2 + .55, L = Math.min(d.sh / .66, d.w - 1.1 - 1.4); const r = walk([[x, iz0 + 2], [ix0 + .1, iz0 + .5], [ix0 + .25 + L + .3, iz0 + .5], [ix0 + .25 + L + .6, iz0 + 1.6]]); return { ...r, quota: +(r.y - d.base).toFixed(2), sh: d.sh }; };
    out.inn = up('v2_locanda'); out.res1 = up('v2_res1');
    // ingresso dalle porte degli edifici esplorabili, case chiuse non accessibili
    const enter = (d, k, f) => { const x = AV.cx + d.u, z = AV.cz + d.v, c = k[1] === 'z' ? x - d.w / 2 + f * d.w : z - d.d / 2 + .55 + f * (d.d - 1.1), o = k[0] === '+' ? 1 : -1;
      const a = k[1] === 'z' ? [c, z + o * (d.d / 2 + 1.5)] : [x + o * (d.w / 2 + 1.5), c], bb = k[1] === 'z' ? [c, z + o * (d.d / 2 - 1.3)] : [x + o * (d.w / 2 - 1.3), c]; return walk([a, bb], 30).blocked; };
    out.doors = {}; for (const d of V2.defs) for (const k in d.open) for (const o of d.open[k]) if (o[0] === 'door') out.doors[d.id + k + o[1]] = { open: !!(d.explore || d.open0 || d.ruin), blocked: enter(d, k, o[1]) };
    // veicoli: il percorso dei carri sulla strada principale è libero per 3,2 m di larghezza
    let vb = 0; for (const [name, r] of Object.entries(V2.routes)) if (/carri/.test(name)) for (let i = 0; i < r.length - 1; i++) for (let k = 0; k <= 10; k++) { const x = r[i].x + (r[i + 1].x - r[i].x) * k / 10, z = r[i].z + (r[i + 1].z - r[i].z) * k / 10; for (const s of [-1.6, 0, 1.6]) for (const q of [[s, 0], [0, s]]) if (inSolid(x + q[0], Hf(x, z) + .4, z + q[1]) || inSolid(x + q[0], Hf(x, z) + 1.5, z + q[1])) vb++; }
    out.vehicle = vb;
    out.spawnBad = Object.values(V2.spawns).flat().filter(q => inSolid(q.x, Hf(q.x, q.z) + 1, q.z)).length;
    // LOD: lontano → volume semplificato; vicino → dettaglio
    const L0 = V2.lods[0]; camera.position.set(L0.x + 400, 30, L0.z); v2LodTick(); const far = L0.lo.visible && !L0.hi.visible; camera.position.set(L0.x, 30, L0.z); v2LodTick(); out.lod = { far, near: L0.hi.visible && !L0.lo.visible, n: V2.lods.length };
    // costo di costruzione, conteggi
    out.terrainVerts = AAA.terrain.geometry.attributes.position.count; out.buildMs = AAA.st.buildMs;
    // debug mappa
    v2DbgOpen(true); for (const k of ['collisioni', 'settori', 'bbox', 'spawn', 'percorsi', 'lod']) v2DbgToggle(k, true); out.dbg = { panel: !!document.querySelector('#v2Panel button'), layers: Object.values(V2.dbg.g).filter(Boolean).length };
    for (const k of ['collisioni', 'settori', 'bbox', 'spawn', 'percorsi', 'lod']) v2DbgToggle(k, false); v2DbgOpen(false);
    out.destr = { edifici: V2.destr.length, parti: V2.destr.reduce((a, e) => a + e.parti.length, 0), set: !!v2SetPart(V2.destr[0].parti[0].id, 'danneggiato') };
    // rendering: draw call dalla piazza (SwiftShader: conteggi, non FPS)
    const [px, pz] = W(-100, 12); camera.position.set(px, Hf(px, pz) + 1.7, pz); camera.lookAt(px - 20, Hf(px, pz) + 3, pz - 20); camera.updateMatrixWorld(); V2.t = 0; v2Tick(0); renderer.info.reset(); renderFrame(GAME.time); out.render = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    return out;
  });
  const v = R.val, bad = Object.entries(v).filter(([k, a]) => a.length);
  ok('validazione mappa: niente sovrapposizioni, edifici su strade/argini, sospesi, porte murate', !bad.length, bad.map(([k, a]) => k + ': ' + a.join(',')).join(' | '));
  ok('quantità: ≥ 25 edifici nuovi, ≥ 8 esplorabili, ≥ 40 props', R.st.edifici >= 25 && R.st.esplorabili >= 8 && R.st.props >= 40, JSON.stringify(R.st));
  ok('campanile salibile fino alla cella campanaria', R.tower.maxStep <= .55 && R.tower.blocked === 0 && R.tower.quota > 12.4, JSON.stringify(R.tower));
  ok('chiesa: dal portale al presbiterio', R.church.maxStep <= .55 && R.church.blocked === 0, JSON.stringify(R.church));
  ok('locanda: scala al primo piano', R.inn.blocked === 0 && R.inn.maxStep <= .55 && Math.abs(R.inn.quota - R.inn.sh) < .2, JSON.stringify(R.inn));
  ok('casa del quartiere residenziale: scala al primo piano', R.res1.blocked === 0 && R.res1.maxStep <= .55 && Math.abs(R.res1.quota - R.res1.sh) < .2, JSON.stringify(R.res1));
  const D = Object.entries(R.doors), openBad = D.filter(([k, d]) => d.open && d.blocked), closedBad = D.filter(([k, d]) => !d.open && !d.blocked);
  ok('porte aperte percorribili (' + D.filter(d => d[1].open).length + ')', !openBad.length, openBad.map(d => d[0]).join(', '));
  ok('porte delle case chiuse bloccate (' + D.filter(d => !d[1].open).length + ')', !closedBad.length, closedBad.map(d => d[0]).join(', '));
  ok('percorsi dei carri liberi (3,2 m)', R.vehicle === 0, R.vehicle + ' punti bloccati');
  ok('punti di comparsa fuori dai solidi', R.spawnBad === 0);
  ok('LOD degli edifici: semplificato lontano, dettaglio vicino', R.lod.far && R.lod.near, JSON.stringify(R.lod));
  ok('debug mappa (F4): pannello e 6 livelli', R.dbg.panel && R.dbg.layers === 6, JSON.stringify(R.dbg));
  ok('dati per la distruzione: parti per edificio, sostituzione registrata', R.destr.edifici >= 25 && R.destr.parti > 300 && R.destr.set, JSON.stringify(R.destr));
  // soglia 30 s: in SwiftShader su questo container anche il commit precedente all'Urban Expansion impiegava 21,3 s
  ok('costruzione e terreno', R.buildMs < 30000 && R.terrainVerts < 200000, `costruzione ${R.buildMs} ms, vertici del terreno ${R.terrainVerts} (LOW)`);
  console.log('     rendering dalla piazza (SwiftShader, non FPS): ' + R.render.calls + ' draw call, ' + Math.round(R.render.tris / 1000) + 'k triangoli');
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
