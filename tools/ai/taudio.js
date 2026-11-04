// test dell'AAA Audio Overhaul (motore sperimentale XAE, solo nella tech demo)
// node tools/ai/taudio.js — Chromium headless con autoplay consentito: l'AudioContext gira, ma nessuno ascolta:
// si verificano grafo, livelli misurati, tempi, zone, occlusione, limiti; la QUALITÀ va valutata a orecchio (Audio Lab, A/B).
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  // 19. gioco originale: audio originale
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.evaluate(async () => { if (typeof initAudio === 'function') await initAudio(); }); for (let i = 0; i < 30 && await p.evaluate(() => !AU.ready); i++) await p.waitForTimeout(500);
  const O = await p.evaluate(() => { const a0 = AU.active.length; sfxShot('garand', null, true); return { xae: xaeActive(), played: XAE.stats.played, orig: AU.active.length > a0, ready: AU.ready, st: AU.ctx && AU.ctx.state }; });
  ok('mappa originale: si usa il sistema audio originale, il motore sperimentale resta spento', !O.xae && O.played === 0 && O.orig, JSON.stringify(O));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.evaluate(async () => { if (typeof initAudio === 'function') await initAudio(); }); for (let i = 0; i < 30 && await p.evaluate(() => !AU.ready); i++) await p.waitForTimeout(500);
  await p.waitForTimeout(800);
  const R = await p.evaluate(async () => {
    GAME.running = false; const out = {}; xaeInit(); out.active = xaeActive(); out.ctx = AU.ctx.state;
    out.oneCtx = XAE.master.context === AU.ctx;
    // 1–6. profili di tutte le armi del gioco (e MG 42 dell'IA): ogni sparo crea i layer
    out.weapons = {}; for (const id in XAE_PROFILES) { const v0 = XAE.stats.played; const okk = xaeShot(id, null, {}); out.weapons[id] = okk && XAE.stats.played - v0 >= 3; }
    // varianti senza ripetizioni immediate
    let rep = 0, prev = -1; for (let i = 0; i < 40; i++) { xaePick('t', [1, 2, 3, 4]); if (XAE.rr.t === prev) rep++; prev = XAE.rr.t; } out.noRepeat = rep === 0;
    // 7. bande di distanza: guadagno, filtro, transitorio e meccanica decrescono; l'ambiente cresce
    const ds = [5, 60, 300, 900].map(d => xaeDistance(d)); out.bands = ds.map(d => d.band);
    out.distOk = ds.every((d, i) => i === 0 || (d.g < ds[i - 1].g && d.lp <= ds[i - 1].lp && d.tran <= ds[i - 1].tran && d.env >= ds[i - 1].env)) && ds[3].tran === 0 && ds[1].mech === 0;
    // 8–9. zone acustiche: dentro la casa normanna e in campo aperto
    const hs = AAA.pipeHouse, cam = camera.position.clone();
    camera.position.set(hs.x + 3, hs.y + 1.6, hs.z + 1); out.zIn = xaeDetectZone();
    camera.position.set(AV.cx + 150, Hf(AV.cx + 150, AV.cz + 150) + 1.7, AV.cz + 150); out.zOut = xaeDetectZone();
    // 10. occlusione: sorgente dietro la casa (ascoltatore davanti), poi linea libera; cache a 0,1 s
    camera.position.set(hs.x, hs.y + 1.6, hs.z + 12); camera.updateMatrixWorld();
    XAE.occCache.clear(); const behind = new V3(hs.x, hs.y + 1.5, hs.z - 8); out.occB = xaeOcclusion(behind, 'b');
    const r0 = XAE.stats.occl; xaeOcclusion(behind, 'b'); out.occCached = XAE.stats.occl === r0;
    out.occF = xaeOcclusion(new V3(hs.x + 30, hs.y + 1.5, hs.z + 30), 'f');
    camera.position.copy(cam);
    // 12. raffica alla cadenza reale (MG 42: 1200 colpi/min = 50 ms)
    xaeEnable(false); xaeEnable(true); const body = XAE.assets.mg42.body; xaeBurst('mg42', 6, { dist: 30, layers: { transient: 0, tail: 0, mech: 0 } });
    const st = XAE.voices.filter(v => body.includes(v.buf)).map(v => v.start).sort((a, c) => a - c); out.burstVoices = st.length;
    out.burstDt = st.slice(1).map((t, i) => t - st[i]); out.burstOk = st.length === 6 && out.burstDt.every(d => Math.abs(d - .05) < .002);
    // 11. ricarica: marcatori dell'animazione (Garand), nessun timer fisso
    let calls = []; const om = window.xaeMech; window.xaeMech = (k, d) => { calls.push(k); return om(k, d); };
    P.inv[0] = { id: 'garand', mag: 0, res: 40 }; P.cur = 0; await Promise.resolve(); updateViewmodel(1 / 60);
    P.reloadT = P.reloadDur = 2.3; for (let i = 0; i < 140; i++) { P.reloadT = Math.max(.001, P.reloadT - 1 / 60); updateViewmodel(1 / 60); } P.reloadT = 0; window.xaeMech = om;
    out.reloadMarks = calls.join(',');
    // 11b. supersonico: schiocco per il Garand, sibilo per la Thompson (.45 ACP)
    const cr = AU.buf.crack && AU.buf.crack[0], wz = AU.buf.whiz && AU.buf.whiz[0]; let last;
    xaeCrack('garand'); last = XAE.voices[XAE.voices.length - 1]; out.crackG = last.src.buffer === cr;
    xaeCrack('thompson'); last = XAE.voices[XAE.voices.length - 1]; out.crackT = last.src.buffer === wz;
    // 13. molte sorgenti: limite delle voci rispettato
    xaeStress(30); const nowV = XAE.voices.filter(v => v.end > AU.ctx.currentTime).length; out.voices = nowV; out.culled = XAE.stats.culled;
    // 15–16. mixer e limitatore: picco misurato all'uscita mentre suona lo stress test
    XAE.stats.peak = 0; XAE.stats.prePeak = 0; XAE.stats.clip = 0;
    for (let i = 0; i < 40; i++) { xaeUpdate(1 / 30); await new Promise(r => setTimeout(r, 25)); }
    out.peak = XAE.stats.peak; out.prePeak = XAE.stats.prePeak; out.clip = XAE.stats.clip;
    out.buses = Object.keys(XAE.bus).join(',');
    // A/B: A passa dal sistema originale, B dal motore sperimentale
    const a0 = AU.active.length, p0 = XAE.stats.played; xalPlay('A'); out.abA = AU.active.length > a0 && XAE.stats.played === p0; xalPlay('B'); out.abB = XAE.stats.played > p0;
    // 17. rilascio
    xaeEnable(false); out.cleanup = XAE.voices.length === 0 && !xaeActive(); xaeEnable(true);
    return out;
  });
  ok('tech demo: motore sperimentale attivo sull\'AudioContext unico del gioco', R.active && R.oneCtx, `stato ${R.ctx}`);
  for (const id in R.weapons) ok(`profilo multistrato: ${id}`, R.weapons[id]);
  ok('varianti senza ripetizioni immediate', R.noRepeat);
  ok('7. bande di distanza (filtro, transitorio, meccanica, ambiente), non solo volume', R.distOk, R.bands.join(' → '));
  ok('8–9. zone acustiche: interno della casa e campo aperto', R.zIn === 'interno' && R.zOut !== 'interno', `${R.zIn} / ${R.zOut}`);
  ok('10. occlusione dietro la casa, linea libera, raggi in cache', R.occB > .5 && R.occF === 0 && R.occCached, `dietro ${R.occB}, libera ${R.occF}`);
  ok('12. raffica MG 42 programmata alla cadenza reale (1200 colpi/min = 50 ms)', R.burstOk, `${R.burstVoices} colpi, intervalli ${R.burstDt.map(d => (d * 1000).toFixed(1)).join('/')} ms`);
  ok('11. ricarica Garand: suoni dai marcatori dell\'animazione', R.reloadMarks === 'clip,boltc', R.reloadMarks);
  ok('schiocco supersonico solo per i proiettili supersonici', R.crackG && R.crackT);
  ok('13. molte sorgenti: limite delle voci rispettato', R.voices <= 40, `${R.voices} attive, ${R.culled} scartate per priorità`);
  ok('15–16. mixer a bus e limitatore: uscita sotto 0 dBFS', R.peak < 1 && R.clip === 0 && R.buses.split(',').length === 6, `picco uscita ${(20 * Math.log10(R.peak || 1e-9)).toFixed(1)} dBFS, prima del limitatore ${(20 * Math.log10(R.prePeak || 1e-9)).toFixed(1)} dBFS, clip ${R.clip}`);
  ok('A/B: A dal sistema originale, B dal motore sperimentale', R.abA && R.abB);
  ok('17. rilascio delle sorgenti sperimentali', R.cleanup);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  ok('18. ritorno al menù: motore sperimentale spento', await p.evaluate(() => !xaeActive()));
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
