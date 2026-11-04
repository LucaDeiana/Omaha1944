// test del Graphics Benchmark Lab (tech demo AAA)
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  const ok = (n, c, x = '') => console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.evaluate(() => { GAME.running = true; }); await p.waitForTimeout(3000);
  // statistiche su dati noti: 990 fotogrammi da 10 ms e 10 da 50 ms
  const st = await p.evaluate(() => labStats(Array(990).fill(10).concat(Array(10).fill(50))));
  ok('statistiche: media, 1% low dal 1% più lento, P99', Math.abs(st.mean - 10.4) < 1e-9 && Math.abs(st.low1 - 20) < 1e-9 && st.p99 === 10 && st.max === 50 && Math.abs(st.fps - 1000 / 10.4) < 1e-9, `media ${st.mean} ms, 1% low ${st.low1}, P99 ${st.p99}`);
  ok('statistiche: con meno di 100 campioni il 1% low non viene calcolato', await p.evaluate(() => labStats([10, 11, 12]).low1 === null));
  // F8 e F9
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'F8' }))); await p.waitForTimeout(600); const ov = await p.evaluate(() => $('labOv') && $('labOv').style.display === 'block' && /FPS/.test($('labOv').textContent));
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'F8' }))); await p.waitForTimeout(300); const ov2 = await p.evaluate(() => $('labOv').style.display === 'none');
  ok('F8 mostra e nasconde l\'overlay con le metriche', ov && ov2);
  await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'F9' }))); await p.waitForTimeout(400); ok('F9 apre il pannello GRAPHICS BENCHMARK LAB', await p.evaluate(() => LAB.panel && /GRAPHICS BENCHMARK LAB/.test($('labPanel').textContent) && /FEATURE ISOLATION/.test($('labPanel').textContent)));
  ok('percorso A–H: nessun punto della camera dentro muri o terreno', await p.evaluate(() => LAB.pathBad === 0), 'punti in collisione: ' + await p.evaluate(() => LAB.pathBad));
  // misura dei fotogrammi con il contatore: il ciclo gira e registra
  const fr = await p.evaluate(() => new Promise(r => { const n0 = LAB.n; setTimeout(() => r({ d: LAB.n - n0, s: labStats(labWindow(30).ft) }), 10000); }));
  ok('contatore: i fotogrammi vengono registrati con il loro intervallo', fr.d >= 2 && fr.s && fr.s.mean > 0, `${fr.d} fotogrammi in 10 s, media ${fr.s ? fr.s.mean.toFixed(1) : '-'} ms`);
  // benchmark completo (breve)
  const n0 = await p.evaluate(() => LAB.runs.length);
  const run = await p.evaluate(() => new Promise(r => labStart({ dur: 20, warm: 2, label: 'test', onEnd: res => r(res && { fps: res.frame.fps, n: res.fotogrammi, seg: Object.keys(res.tratti), dyn: SETTINGS.dynres, gpu: res.gpu, miss: res.mancanti }) })));
  ok('benchmark completo sul percorso, salvato', run && run.n >= 10 && (await p.evaluate(() => LAB.runs.length)) === n0 + 1, run ? `${run.n} fotogrammi, tratti ${run.seg.join(' / ')}` : 'nessun risultato');
  ok('metriche mancanti dichiarate (GPU, memoria GPU)', run && run.miss.some(m => /GPU/.test(m)), run ? run.miss.join(' | ') : '');
  // interruzione anticipata
  const ab = await p.evaluate(() => new Promise(r => { const d0 = SETTINGS.dynres = true, n = LAB.runs.length; labStart({ dur: 60, warm: 1 }); setTimeout(() => { labStop(true); r({ same: LAB.runs.length === n, dyn: SETTINGS.dynres === d0, idle: !LAB.run }); }, 2500); }));
  ok('interruzione anticipata: nessun risultato parziale, risoluzione dinamica ripristinata', ab.same && ab.dyn && ab.idle);
  // isolamento degli effetti: ogni interruttore e il ripristino
  const fi = await p.evaluate(() => { const before = { fog: scene.fog.density, cast: sun.castShadow, env: AAA.mats.water.envMap, post: !!AAA.noPost, decor: !!AAA.hideDecor }; const out = {};
    for (const k in LAB_FEAT) { labSetFeat(k, true); out[k] = !!LAB.feat[k]; } const off = { fog: scene.fog.density < 1e-5, cast: !sun.castShadow, env: AAA.mats.water.envMap === null, post: AAA.noPost, decor: AAA.hideDecor };
    labResetFeat(); const after = { fog: scene.fog.density, cast: sun.castShadow, env: AAA.mats.water.envMap, post: !!AAA.noPost, decor: !!AAA.hideDecor };
    return { on: Object.values(out).every(Boolean), off: Object.values(off).every(Boolean), back: JSON.stringify([before.fog, before.cast, before.env === after.env, before.post, before.decor]) === JSON.stringify([after.fog, after.cast, true, after.post, after.decor]) }; });
  ok('isolamento: ogni effetto si spegne e la configurazione si ripristina', fi.on && fi.off && fi.back, JSON.stringify(fi));
  // esportazione
  const [dj] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => labDownload('t.json', labJSON(), 'application/json'))]); const J = JSON.parse(fs.readFileSync(await dj.path(), 'utf8'));
  const [dc] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => labDownload('t.csv', labCSV(), 'text/csv'))]); const C = fs.readFileSync(await dc.path(), 'utf8').split('\n');
  ok('esportazione JSON con ambiente, statistiche e serie', J.esecuzioni.length >= 1 && J.esecuzioni[0].frame && J.esecuzioni[0].ambiente.browser && Array.isArray(J.esecuzioni[0].serie), `${J.esecuzioni.length} esecuzioni, browser ${J.esecuzioni[0].ambiente.browser}, GPU «${J.esecuzioni[0].ambiente.gpu}»`);
  ok('esportazione CSV con intestazione e righe', /fps_medio/.test(C[0]) && C.length >= 2, `${C.length - 1} righe`);
  // foto di confronto
  const sh = await p.evaluate(() => { const s = labShots(); return Object.entries(s).map(([k, v]) => [k, v.full.length, v.res]); });
  ok('foto di confronto: tre pose fisse acquisite', sh.length === 3 && sh.every(x => x[1] > 5000), sh.map(x => `${x[0]} ${Math.round(x[1] / 1024)} KB ${x[2]}`).join(', '));
  // costo del profiler
  ok('costo del profiler per fotogramma contenuto', await p.evaluate(() => LAB.cost < 1.5), (await p.evaluate(() => LAB.cost)).toFixed(3) + ' ms');
  // accumulo di risorse su due giri del percorso
  const soak = await p.evaluate(() => new Promise(r => { labSoak(2, 8); const w = setInterval(() => { if (LAB.soakRes) { clearInterval(w); r(LAB.soakRes); } }, 500); }));
  ok('test di accumulo: geometrie, texture e programmi non crescono fra un giro e l\'altro', soak.crescita.geometrie <= 0 && soak.crescita.texture <= 0 && soak.crescita.programmi <= 0, JSON.stringify(soak.crescita));
  // cambio di preset: ricarica e avvio automatico con il nuovo preset
  await p.evaluate(() => labReload('MEDIUM', false)); await p.waitForLoadState('load'); await p.waitForTimeout(2500); for (let i = 0; i < 90 && await p.evaluate(() => !(typeof GAME !== 'undefined' && GAME.started)); i++) await p.waitForTimeout(1000); await p.waitForTimeout(2500);
  ok('cambio di preset: la demo riparte da sola con MEDIUM e il pannello aperto', await p.evaluate(() => AAA.preset === 'MEDIUM' && SCEN === 'aaa' && LAB.panel));
  // ritorno al menù: ricarica senza avvio automatico
  await Promise.all([p.waitForNavigation(), p.evaluate(() => { sessionStorage.removeItem('aaa_autostart'); setTimeout(() => location.reload(), 50); })]); await p.waitForTimeout(3000);
  ok('ritorno al menù principale', await p.evaluate(() => typeof GAME !== 'undefined' && !GAME.started && !!$('mainMenu')));
  ok('nessun errore JavaScript', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
