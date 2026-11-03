// test della tech demo «AAA Graphics Test»: caricamento, collisioni (porta, scala), preset, benchmark, isolamento
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext(); let p; const errs = [];
  const ok = (n, c, x = '') => console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
  const start = async (pr) => { if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); }); await p.goto(URL); await p.waitForTimeout(1500);
    await p.evaluate(async pr => { AAA.preset = pr; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); }, pr); for (let i = 0; i < 60 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000); };
  await start('LOW');
  const r = await p.evaluate(() => {
    const A = AAA.defs.A, I = AAA.interior, out = {};
    out.spawn = Math.abs(P.pos.y - Hf(P.pos.x, P.pos.z)) < .3;
    // dalla strada alla porta d'ingresso, dentro casa: nessuna spinta indietro
    const dx = AV.cx + A.u + .5, z0 = AV.cz + A.v + A.d / 2; let pos = new V3(dx, Hf(dx, z0 + 3), z0 + 3), pushed = 0; for (let i = 0; i < 40; i++) { pos.z -= .15; pos.y = Math.max(Hf(pos.x, pos.z), worldFloor(pos.x, pos.z, pos.y)); const q = pos.clone(); pushOut(pos, .38, 1.7); if (q.distanceTo(pos) > .05) pushed++; }
    out.door = pushed === 0 && pos.z < z0 - 1.5; out.doorZ = +(z0 - pos.z).toFixed(2);
    // muro pieno accanto alla porta: respinge
    let w = new V3(dx + 2.2, 0, z0 + 2), blk = false; for (let i = 0; i < 40; i++) { w.z -= .15; w.y = Hf(w.x, w.z); const q = w.clone(); pushOut(w, .38, 1.7); if (q.distanceTo(w) > .05) blk = true; } out.wall = blk;
    // scala: dal pavimento al primo piano
    const f = FLOORS.find(q => q.ramp), zz = (f.z0 + f.z1) / 2; let y = f.ramp.y0; for (let x = f.ramp.c0; (f.ramp.c1 > f.ramp.c0 ? x <= f.ramp.c1 : x >= f.ramp.c1); x += (f.ramp.c1 > f.ramp.c0 ? .2 : -.2)) y = Math.max(Hf(x, zz), worldFloor(x, zz, y));
    out.stairs = +(y - I.base).toFixed(2);
    out.solids = solids.length; out.floors = FLOORS.length; out.rooms = AAA.rooms.length;
    return out;
  });
  ok('caricamento della demo (LOW) senza errori', !errs.length, errs.slice(0, 2).join(' | '));
  ok('il giocatore compare sul terreno', r.spawn);
  ok('si entra in casa dalla porta', r.door, `dentro di ${r.doorZ} m`);
  ok('il muro accanto alla porta blocca', r.wall);
  ok('la scala porta al primo piano', r.stairs > 2.9, `quota ${r.stairs} m`);
  // benchmark: sei inquadrature, risultati per ciascuna
  const bench = await p.evaluate(async () => { GAME.running = true; aaaBenchStart(); for (let i = 0; i < 400 && AAA.bench; i++) await new Promise(r => setTimeout(r, 500)); GAME.running = false; return window.AAA_BENCH; });
  ok('benchmark: sei inquadrature misurate', bench && bench.res.length === 6, bench ? bench.res.map(x => `${x.vista.split(' ')[0]} ${x.calls}dc ${(x.tri / 1e6).toFixed(2)}M`).join(', ') : 'non concluso');
  // isolamento: Omaha in una pagina nuova non contiene nulla della demo
  if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(2500);
  const iso = await p.evaluate(() => ({ aaa: AAA.on, scen: SCEN, coll: !!(WORLD.colleville && WORLD.colleville.houses.length) }));
  ok('isolamento: Omaha resta Omaha (demo spenta, Colleville presente)', !iso.aaa && iso.scen === 'omaha' && iso.coll);
  ok('nessun errore JavaScript', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
