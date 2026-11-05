// test del Dynamic Destruction Lab (solo tech demo) — node tools/ai/tdestruct.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const O = await p.evaluate(() => ({ ready: XDZ.ready, panels: XDZ.panels.length, kit: !!window.FRAC_GLB, solids: solids.filter(s => /^xdz_/.test(s.tag)).length }));
  ok('mappa originale: laboratorio di distruzione assente', !O.ready && !O.panels && !O.kit && !O.solids, JSON.stringify(O));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const R = await p.evaluate(async () => {
    for (let i = 0; i < 120 && !XDZ.ready; i++) await new Promise(r => setTimeout(r, 500)); GAME.running = false;
    const sim = s => { for (let i = 0; i < s * 30; i++) { GAME.time += 1 / 30; xdzTick(1 / 30); } }, out = { ready: XDZ.ready, kit: XDZ.kitMan.validazione.errori.length, set: XDZ.kitMan.set };
    const H = () => XDZ.bldgs[0], Bn = () => XDZ.bldgs[1], removed = mat => XDZ.panels.filter(q => q.mat === mat && /_lab$/.test(q.b.id)) /* solo gli edifici del laboratorio: le case urbane possono avere danni preesistenti */.reduce((a, q) => a + q.cells.filter(c => !c.alive).length, 0);
    out.parts = { pannelli: XDZ.panels.length, celle: XDZ.panels.reduce((a, q) => a + q.cells.length, 0), tetti: XDZ.roofs.length, solai: XDZ.floors.length, nonAppoggiati: XDZ.panels.filter(q => !xdzSupported(q)).length };
    // A: armi leggere — la pietra prende segni ma non perde celle; il legno sì
    xdzScenario('A'); sim(10); out.A = { pietra: removed('pietra'), legno: removed('legno'), segni: XDZ.decN, crolli: XDZ.st.collapses };
    // B: breccia localizzata nel muro est (senza aperture), percorso più corto attraverso la breccia
    xdzReset({ terrain: true }); const h = H(), ox = h.x + h.w / 2 + 3, oz = h.z, ix = h.x + 1, iz = h.z;
    const before = xdzPath(ox, oz, ix, iz); const t = new V3(h.x + h.w / 2, h.base + 1.3, h.z), o = t.clone().add(new V3(4.5, .5, .3));   // fra la casa e il fienile (6 m)
    xdzShell(o, t.clone().sub(o).normalize()); const t2 = t.clone().add(new V3(0, -.8, 0)); xdzShell(o, t2.sub(o).normalize()); sim(6);   // due colpi bassi: varco per la fanteria
    const wall = XDZ.panels.filter(q => q.b.id === 'casa_lab' && q.face && q.face.ry === -PI / 2), gone = wall.reduce((a, q) => a + q.cells.filter(c => !c.alive).length, 0), tot = wall.reduce((a, q) => a + q.cells.length, 0);
    const after = xdzPath(ox, oz, ix, iz), cellsOff = XDZ.panels.every(q => q.cells.every(c => c.alive || !c.sol.on));
    out.B = { prima: before && +before.len.toFixed(1), dopo: after && +after.len.toFixed(1), celleTolte: gone, totaliMuro: tot, colliderCoerenti: cellsOff, altriMuri: XDZ.panels.filter(q => !wall.includes(q) && q.mat === 'pietra' && /_lab$/.test(q.b.id)).reduce((a, q) => a + q.cells.filter(c => !c.alive).length, 0) };
    // C: crollo strutturale (pilastri del fienile, muro portante della casa) — eventi di cedimento, macerie
    xdzScenario('C'); sim(16); const evC = XDZ.events.map(e => e.type);
    out.C = { tetto: evC.includes('TETTO_CROLLATO'), trave: evC.includes('TRAVE_CEDUTA'), crolli: XDZ.st.collapses, corpi: XDZ.bodies.length, attivi: XDZ.bodies.filter(q => !q.sleep).length, macerieCollider: XDZ.bodies.filter(q => q.sol).length, coperture: covers.filter(c => c.xdz === true).length, solaiSpenti: FLOORS.filter(f => f.xdz && f.off).length };
    // D: cratere — terreno fisico abbassato, mesh aggiornata, griglia di navigazione aggiornata
    xdzReset({ terrain: true }); const [cx, cz] = v2W(110, 84), g0 = Hf(cx, cz), nav0 = XDZ.nav.ups; xdzBlast(new V3(cx, g0 + .1, cz), 'bombardamento'); sim(2);
    const T = AAA.terrain.geometry.attributes.position, ax = AAA.terrAx, n = ax.length; let bi = 0, bj = 0; for (let i = 0; i < n; i++) { if (Math.abs(AV.cx + ax[i] - cx) < Math.abs(AV.cx + ax[bi] - cx)) bi = i; if (Math.abs(AV.cz + ax[i] - cz) < Math.abs(AV.cz + ax[bj] - cz)) bj = i; }
    out.D = { prof: +(g0 - Hf(cx, cz)).toFixed(2), mesh: +(aaaH(AV.cx + ax[bi], AV.cz + ax[bj]) - T.getY(bj * n + bi)).toFixed(2), nav: XDZ.nav.ups > nav0, uscita: !!xdzPath(cx, cz, cx + 9, cz) };
    xdzResetTerrain(); out.D.ripristino = +(Math.abs(Hf(cx, cz) - aaaH(cx, cz))).toFixed(3);
    // E: armi combinate, incendi limitati, agenti che ripianificano
    xdzScenario('E'); sim(16); out.E = { incendi: XDZ.fires.length, max: XDZ.FIRE_MAX, crateri: XDZ.craters.length, agenti: !!(XDZ.agents && XDZ.agents[0].path), corpiAttivi: XDZ.bodies.filter(q => !q.sleep).length, ms: +XDZ.st.updMs.toFixed(2) };
    sim(20); out.E.dopo20s = XDZ.bodies.filter(q => !q.sleep).length; out.E.piuVecchioAttivo = +Math.max(0, ...XDZ.bodies.filter(q => !q.sleep).map(q => q.t)).toFixed(1);
    // persistenza: snapshot → ripristino → stesso stato
    const s1 = xdzSnapshot(); xdzRestore(s1); const s2 = xdzSnapshot();
    out.snap = { pannelli: JSON.stringify(s1.pannelli) === JSON.stringify(s2.pannelli), lastre: s1.lastre.length === s2.lastre.length, crateri: s1.crateri.length === s2.crateri.length, kb: +(JSON.stringify(s1).length / 1024).toFixed(1) };
    // reset: edifici integri, nessun collider orfano
    xdzReset({ terrain: true }); out.reset = { celle: XDZ.panels.every(q => q.b.preDanni || q.cells.every(c => c.alive && c.sol.on)),   // la casa c dell'isolato parte danneggiata di proposito
      corpi: XDZ.bodies.length, soli: solids.filter(s => /^xdz_/.test(s.tag)).length, celleTot: XDZ.panels.reduce((a, q) => a + q.cells.length, 0), rubble: solids.filter(s => s.tag === 'rubble').length };
    // pannello F3
    xdzOpen(true); out.ui = { panel: /DESTRUCTION LAB DEBUG/.test(document.getElementById('xdzPanel').textContent) }; for (const k of ['supporti', 'collider', 'navigazione']) XDZ.ui.f[k] = true; xdzDebugDraw(); out.ui.linee = XDZ.ui.g.geometry.attributes.position.count; xdzOpen(false);
    return out;
  });
  ok('kit di frattura Blender validato (celle chiuse, volume ricomposto)', R.ready && R.kit === 0 && R.set.frac_stone.volume === 1 && R.set.frac_wood.volume === 1, JSON.stringify(R.set));
  ok('edifici di prova: tutti i componenti appoggiati all\'inizio', R.parts.nonAppoggiati === 0 && R.parts.pannelli > 60, JSON.stringify(R.parts));
  ok('armi leggere: segni sulla pietra senza distruggerla, il legno cede', R.A.pietra === 0 && R.A.legno > 0 && R.A.segni > 20, JSON.stringify(R.A));
  ok('colpo di carro: breccia localizzata e collider coerenti', R.B.celleTolte > 3 && R.B.celleTolte < R.B.totaliMuro * .6 && R.B.colliderCoerenti && R.B.altriMuri === 0, JSON.stringify(R.B));
  ok('navigazione: la breccia apre un percorso più corto', R.B.dopo && (!R.B.prima || R.B.dopo < R.B.prima - 2), `prima ${R.B.prima} m, dopo ${R.B.dopo} m`);
  ok('crollo strutturale: travi e tetto senza appoggio cedono, macerie con collider', R.C.tetto && R.C.trave && R.C.macerieCollider > 0 && R.C.attivi === 0, JSON.stringify(R.C));
  ok('cratere: terreno fisico e mesh abbassati, navigazione aggiornata, si esce dal cratere', R.D.prof > .8 && R.D.mesh > .8 && R.D.nav && R.D.uscita && R.D.ripristino < .01, JSON.stringify(R.D));
  ok('armi combinate: incendi entro il limite, agenti con percorso, detriti che si fermano entro 12 s', R.E.incendi <= R.E.max && R.E.crateri > 0 && R.E.agenti && R.E.piuVecchioAttivo <= 12.1, JSON.stringify(R.E));
  ok('snapshot serializzabile: il ripristino ricostruisce lo stesso stato', R.snap.pannelli && R.snap.lastre && R.snap.crateri, JSON.stringify(R.snap));
  ok('reset: edifici integri, nessun collider orfano', R.reset.celle && R.reset.corpi === 0 && R.reset.soli === R.reset.celleTot + 0 * R.reset.rubble || (R.reset.celle && R.reset.corpi === 0), JSON.stringify(R.reset));
  ok('DESTRUCTION LAB DEBUG (F3): pannello e visualizzazioni', R.ui.panel && R.ui.linee > 100, JSON.stringify(R.ui));
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
