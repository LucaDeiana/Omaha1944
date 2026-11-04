// test dell'integrazione degli asset della pipeline Blender (tech demo AAA) e dello showroom
// node tools/ai/tpipe.js   (Chromium headless con SwiftShader: i tempi non sono FPS reali)
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
async function startAAA(p, preset) {
  await p.evaluate(async (pr) => { AAA.preset = pr; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); }, preset);
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1500);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 480 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  // 1. mappa originale: la pipeline non entra
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1500);
  ok('mappa originale (Omaha): nessun asset della pipeline caricato o posato', await p.evaluate(() => !window.AAA_PIPE && PIPE.inst.length === 0 && !scene.getObjectByName('pipe_normandy_house_01') && !solids.some(s => s.tag === 'pipe')));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { setTimeout(() => location.reload(), 50); })]); await p.waitForTimeout(1500);
  // 2. tech demo HIGH
  await startAAA(p, 'HIGH');
  const L = await p.evaluate(async () => { const A = await PIPE.cache.normandy_house_01; return { lods: Object.keys(A.lods), tri: A.st.triangoli, mats: A.st.materiali.length, kb: A.st.kb, ms: A.st.caricamentoMs, sharedTex: A.lods.LOD0.every(m => !m.material.map || Object.values(TEXH).some(t => t.map === m.material.map)), uv2: A.lods.LOD0.every(m => !!m.geometry.attributes.uv2) }; });
  ok('GLB caricato e decodificato con GLTFLoader, tre LOD', L.lods.length === 3, `LOD0 ${Math.round(L.tri.LOD0)} / LOD1 ${Math.round(L.tri.LOD1)} / LOD2 ${Math.round(L.tri.LOD2)} triangoli, ${L.kb} KB, ${L.ms} ms`);
  ok('materiali PBR: texture condivise con la demo (nessuna copia), uv2 per l\'occlusione', L.sharedTex && L.uv2, `${L.mats} materiali`);
  ok('cache: un secondo caricamento restituisce lo stesso oggetto', await p.evaluate(async () => (await pipeLoad('normandy_house_01')) === (await PIPE.cache.normandy_house_01)));
  const pl = await p.evaluate(() => { const I = AAA.pipeHouse; return I ? { x: I.x, z: I.z, sol: I.solids.length, fl: I.floors.length, rooms: AAA.rooms.length, inScene: !!scene.getObjectByName('pipe_normandy_house_01') } : null; });
  ok('casa posata nel villaggio in un punto libero, con collisioni, pavimenti e volumi interni', pl && pl.inScene && pl.sol > 40 && pl.fl >= 6, pl && `(${pl.x.toFixed(1)}, ${pl.z.toFixed(1)}), ${pl.sol} collisioni, ${pl.fl} superfici calpestabili, ${pl.rooms} volumi interni`);
  // scala e orientamento: larghezza ~12.4 m lungo X, colmo ~7.5 m, facciata (porta) verso +Z
  const dim = await p.evaluate(() => { const o = AAA.pipeHouse.obj.levels[0].object, bx = new THREE.Box3().setFromObject(o), s = bx.getSize(new THREE.Vector3()); const door = AAA.pipeHouse.solids.find(s => s.pipeTag === 'soglia'); return { x: s.x, y: s.y, z: s.z, doorZ: door ? (door.min.z + door.max.z) / 2 - AAA.pipeHouse.z : 0 }; });
  ok('scala in metri e orientamento (Y in alto, porta sulla facciata +Z)', Math.abs(dim.x - 12.4 - .8) < 1 && dim.y > 8 && dim.y < 10 && dim.doorZ > 2.5, `${dim.x.toFixed(2)} × ${dim.y.toFixed(2)} × ${dim.z.toFixed(2)} m, porta a z +${dim.doorZ.toFixed(2)}`);
  // LOD per distanza
  const lodT = await p.evaluate(() => { const o = AAA.pipeHouse.obj, c = new THREE.PerspectiveCamera(), r = []; for (const d of [5, 40, 120]) { c.position.set(o.position.x, o.position.y + 2, o.position.z + d); c.updateMatrixWorld(); o.update(c); r.push(o.getCurrentLevel()); } return r; });
  ok('LOD: 5 m → LOD0, 40 m → LOD1, 120 m → LOD2 (distanze HIGH 30/80 m)', lodT.join() === '0,1,2', lodT.join(', '));
  // collisioni: camminata reale con updatePlayer
  const W = await p.evaluate(() => {
    const I = AAA.pipeHouse, hx = I.x, hy = I.y, hz = I.z; GAME.running = false;
    const walk = (x, z, yaw, steps, y) => { P.pos.set(x, y ?? Math.max(Hf(x, z), worldFloor(x, z, hy + .3)), z); P.vel.set(0, 0, 0); P.yaw = yaw; P.stance = 0; P.grounded = true; for (const k in KEYS) KEYS[k] = false; KEYS.KeyW = true; for (let i = 0; i < steps; i++) updatePlayer(1 / 60); KEYS.KeyW = false; return { x: P.pos.x - hx, y: P.pos.y - hy, z: P.pos.z - hz }; };
    return { porta: walk(hx - 1.19, hz + 6, 0, 260), muro: walk(hx + 2.4, hz + 6, 0, 240), finestra: walk(hx + 3.56, hz + 6, 0, 240), scala: walk(hx + 5.45, hz - 2.32, Math.PI / 2, 420, hy + .25), gronda: walk(hx + 2.7, hz - 1.5, Math.PI, 240, hy + 2.835), tramezzo: walk(hx + 3, hz + 1.5, Math.PI / 2, 300, hy + .25), varco: walk(hx + 3, hz + 2.2, Math.PI / 2, 420, hy + .25) };
  });
  ok('si entra dalla porta e si cammina sul pavimento (quota +0.25 m)', W.porta.z < 0 && Math.abs(W.porta.y - .25) < .02, `fermo a z ${W.porta.z.toFixed(2)}, y ${W.porta.y.toFixed(2)}`);
  ok('i muri e le finestre fermano il giocatore', Math.abs(W.muro.z - 3.68) < .05 && Math.abs(W.finestra.z - 3.68) < .05, `muro ${W.muro.z.toFixed(2)}, finestra ${W.finestra.z.toFixed(2)}`);
  ok('la scala porta al sottotetto', Math.abs(W.scala.y - 2.835) < .03, `quota finale ${W.scala.y.toFixed(2)} m`);
  ok('nel sottotetto la falda bassa blocca il passaggio', W.gronda.z < 2.0, `fermo a z ${W.gronda.z.toFixed(2)}`);
  ok('il tramezzo blocca, il suo vano porta si attraversa', W.tramezzo.x > 1 && W.varco.x < -4.5, `tramezzo x ${W.tramezzo.x.toFixed(2)}, varco x ${W.varco.x.toFixed(2)}`);
  await p.evaluate(() => { GAME.running = true; });
  // isolamento nel laboratorio
  ok('Benchmark Lab: l\'asset si può isolare e ripristinare', await p.evaluate(() => { labSetFeat('pipe', true); const off = !AAA.pipeHouse.obj.visible; labSetFeat('pipe', false); return off && AAA.pipeHouse.obj.visible; }));
  // impatto sulla scena: conteggi con la casa visibile e nascosta, da una posa del percorso del benchmark (non sono FPS)
  const imp = await p.evaluate(() => { const r = {}; for (const [k, vis] of [['con', true], ['senza', false]]) { AAA.pipeHouse.obj.visible = vis; const I = AAA.pipeHouse; camera.position.set(I.x + 6, I.y + 2, I.z + 16); camera.lookAt(I.x, I.y + 3, I.z); camera.updateMatrixWorld(); renderer.info.autoReset = false; renderer.info.reset(); renderFrame(GAME.time); r[k] = { calls: renderer.info.render.calls, tri: renderer.info.render.triangles }; } AAA.pipeHouse.obj.visible = true; return r; });
  ok('impatto misurato (vista a 17 m, LOD0, ombre incluse)', imp.con.calls > imp.senza.calls, `+${imp.con.calls - imp.senza.calls} draw call, +${(imp.con.tri - imp.senza.tri).toLocaleString('it')} triangoli`);
  console.log('IMPATTO ' + JSON.stringify(imp));
  // showroom
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'F10', bubbles: true }))); await p.waitForTimeout(2500);
  const sr = await p.evaluate(() => ({ on: ASR.on, sel: ASR.sel, panel: !!$('srPanel') && $('srPanel').style.display !== 'none', obj: !!ASR.obj }));
  ok('F10 apre il 3D Asset Showroom con la casa', sr.on && sr.panel && sr.obj && sr.sel === 'normandy_house_01');
  const tg = await p.evaluate(() => { const r = {}; for (const a of ['wire', 'bbox', 'cols', 'L:tramonto', 'lod:LOD2', 'lod:LOD1', 'lod:auto']) { const b = document.querySelector(`#srPanel [data-a="${a}"]`); if (!b) { r[a] = 'manca'; continue; } b.click(); srRender(); r[a] = 'ok'; } return { r, helpers: ASR.helpers.length, wire: !!ASR.scene.overrideMaterial }; });
  ok('showroom: wireframe, ingombro, collisioni, luci e LOD si attivano', Object.values(tg.r).every(v => v === 'ok') && tg.helpers === 2 && tg.wire, JSON.stringify(tg.r));
  const keys = await p.evaluate(() => { const before = P.pos.clone(); dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true })); const w = !!KEYS.KeyW; dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })); return { w }; });
  ok('showroom aperto: il soldato non riceve i tasti', !keys.w);
  const sw = await p.evaluate(async () => { const k = Object.keys(AAA_M)[0]; await srShow(k); srRender(); const a = { sel: ASR.sel, obj: !!ASR.obj }; await srShow('normandy_house_01'); srRender(); return { a, back: ASR.sel }; });
  ok('showroom: si passa a un modello Poly Haven e si torna alla casa', sw.a.obj && sw.back === 'normandy_house_01', sw.a.sel);
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))); await p.waitForTimeout(500);
  ok('Esc chiude lo showroom e la demo torna alla sua scena', await p.evaluate(() => !ASR.on && $('srPanel').style.display === 'none'));
  // pulizia: scaricare l'asset libera geometrie, collisioni e pavimenti
  const cl = await p.evaluate(async () => { const g0 = renderer.info.memory.geometries, s0 = solids.length, f0 = FLOORS.length, n = AAA.pipeHouse.solids.length, nf = AAA.pipeHouse.floors.length; pipeUnload('normandy_house_01'); await new Promise(r => setTimeout(r, 200)); renderFrame(GAME.time); return { dg: g0 - renderer.info.memory.geometries, ds: s0 - solids.length, df: f0 - FLOORS.length, n, nf, inScene: !!scene.getObjectByName('pipe_normandy_house_01') }; });
  ok('pulizia: rimossi oggetto, collisioni, pavimenti; geometrie liberate', !cl.inScene && cl.ds === cl.n && cl.df === cl.nf && cl.dg > 0, `−${cl.dg} geometrie, −${cl.ds} collisioni, −${cl.df} pavimenti`);
  // preset LOW: distanze più corte
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { sessionStorage.removeItem('aaa_autostart'); setTimeout(() => location.reload(), 50); })]); await p.waitForTimeout(1500);
  await startAAA(p, 'LOW');
  const low = await p.evaluate(() => { const o = AAA.pipeHouse && AAA.pipeHouse.obj; return o ? o.levels.map(l => l.distance) : null; });
  ok('preset LOW: LOD1 da 10 m e LOD2 da 35 m', low && low.join() === '0,10,35', low && low.join(', '));
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
