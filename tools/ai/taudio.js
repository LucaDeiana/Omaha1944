// test del gestore delle voci e dei loop dei motori (orologio delle voci simulato)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const root = process.env.ROOT || path.resolve(__dirname, '../..');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + root + '/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(4000);
  console.log(await p.evaluate(async () => {
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    if (AU.ctx && AU.ctx.state !== 'running') try { await AU.ctx.resume(); } catch (e) { }
    let T = 1000; VOX.clock = () => T; GAME.running = true;
    const pos = camera.position.clone().add(new V3(5, 0, -5)), cnt = k => (VOX.byCat[k] || { ok: 0 }).ok - (base[k] || 0); const base = {}; const rebase = () => { for (const k in VOX.byCat) base[k] = VOX.byCat[k].ok; }; rebase();
    // 1 un soldato in combattimento per 60 s chiede «aprite il fuoco» a ogni aggiornamento: detto una volta sola
    const sol = { alive: true, id: 1, kind: 'rifle' }, q = { id: 77 };
    VOX.log.length = 0; for (let i = 0; i < 600; i++) { T += .1; shout('en', 'openfire', pos, { src: sol, squad: q, ev: 'open.77.1', priority: true }); }
    ok('«Open fire» in combattimento continuo per 60 s', cnt('en.openfire') === 1, cnt('en.openfire') + ' volte su 600 richieste ');
    // 2 nuovo ordine distinto (nuovo episodio di contatto, dopo l'attesa della squadra): detto di nuovo
    T += 30; shout('en', 'openfire', pos, { src: { alive: true, id: 2 }, squad: q, ev: 'open.77.2', priority: true }); ok('nuovo ordine distinto: detto di nuovo', cnt('en.openfire') === 2);
    // 3 duplicato dello stesso evento: scartato anche dopo l'attesa
    T += 30; shout('en', 'openfire', pos, { src: { alive: true, id: 3 }, ev: 'open.77.2', priority: true }); ok('stesso evento: scartato', cnt('en.openfire') === 2, VOX.log[VOX.log.length - 1].res);
    // 4 cento soldati che chiedono avvistamenti in 60 s: poche frasi, mai la stessa categoria più di una volta ogni 10 s
    rebase(); const S = Array.from({ length: 100 }, (_, i) => ({ alive: true, id: 100 + i }));
    for (let i = 0; i < 600; i++) { T += .1; shout('de', 'spot', pos, { src: S[i % 100] }); }
    ok('100 soldati, avvistamenti per 60 s', cnt('de.spot') <= 6, cnt('de.spot') + ' frasi dette su 600 richieste');
    // 5 parlante morto: non parla; se muore mentre parla, la voce si interrompe
    const dead = { alive: false, id: 9 }; T += 20; shout('en', 'cover', pos, { src: dead }); ok('soldato morto non parla', VOX.log[VOX.log.length - 1].res === 'parlante morto');
    const sp = { alive: true, id: 10 }; T += 20; shout('en', 'medic', pos, { src: sp }); const pl = VOX.playing.length; sp.alive = false; voxTick(); ok('voce interrotta alla morte del parlante', pl === 1 && VOX.playing.length === 0);
    // 6 priorità: con una voce in corso, una più importante passa e una meno importante no
    VOX.playing.length = 0; T += 30; shout('en', 'move', pos, { src: { alive: true, id: 11 } }); shout('en', 'kill', pos, { src: { alive: true, id: 12 } }); const low = VOX.log[VOX.log.length - 1].res;
    shout('en', 'grenade', pos, { src: { alive: true, id: 13 } }); const crit = VOX.log[VOX.log.length - 1].res;
    ok('priorità: bassa scartata, critica passa', low === 'altra voce in corso' && crit === 'ok', low + ' / ' + crit);
    // 7 varianti: con più frasi disponibili non sempre la stessa
    const texts = new Set(); for (let i = 0; i < 20; i++) { T += 20; VOX.playing.length = 0; shout('en', 'spot', pos, { src: { alive: true, id: 200 + i } }); texts.add(VOX.log[VOX.log.length - 1].text); }
    ok('varianti delle frasi', texts.size >= 3, [...texts].join(' | '));
    // 8 motori: loop di 4 s, giunzione continua, nessun calo di volume lungo il giro
    const lp = n => { const d = AU.buf[n][0].getChannelData(0), sr = AU.buf[n][0].sampleRate, W = Math.floor(sr * .05), rms = []; for (let i = 0; i + W <= d.length; i += W) { let s = 0; for (let k = i; k < i + W; k++) s += d[k] * d[k]; rms.push(Math.sqrt(s / W)); } let s2 = 0; const H2 = Math.floor(W / 2); for (let k = 0; k < 2 * H2; k++) { const x = k < H2 ? d[d.length - H2 + k] : d[k - H2]; s2 += x * x; } const jr = Math.sqrt(s2 / (2 * Math.floor(W / 2))); return { len: (d.length / sr).toFixed(2), min: Math.min(...rms) / (rms.reduce((a, b) => a + b, 0) / rms.length), junction: jr / (rms.reduce((a, b) => a + b, 0) / rms.length), jump: Math.abs(d[d.length - 1] - d[0]) }; };
    for (const n of ['eng_p47', 'eng_fw', 'eng_sherman']) { const r = lp(n); ok('loop ' + n, r.min > (n === 'eng_sherman' ? .5 : .6) && r.junction > .8 && r.junction < 1.25, `giro ${r.len} s · finestra più debole ${(r.min * 100).toFixed(0)}% della media · giunzione ${(r.junction * 100).toFixed(0)}% · salto ${r.jump.toFixed(3)}`); }
    // 9 file personale con silenzi: trasformato in loop senza buchi
    const c = AU.ctx, sr = c.sampleRate, buf = c.createBuffer(1, sr * 3, sr), d = buf.getChannelData(0); for (let i = sr * .5; i < sr * 2.6; i++) d[i] = Math.sin(i / sr * TAU * 90) * .6;
    const lb = loopify(buf), ld = lb.getChannelData(0); let zeros = 0; for (let i = 0; i < ld.length; i++) if (Math.abs(ld[i]) < .0005) zeros++;
    ok('loop da file personale: silenzi tolti', lb.duration < 2.1 && zeros / ld.length < .02, `durata ${lb.duration.toFixed(2)} s, campioni muti ${(zeros / ld.length * 100).toFixed(1)}%`);
    // 10 qualità dei file personali: segnali preparati con difetti noti
    const mk = (sec, f) => { const b2 = c.createBuffer(1, Math.floor(sr * sec), sr), x = b2.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = f(i / sr, i); return b2; };
    let lpf = 0; const voice = t => (Math.sin(t * TAU * 180) * .4 + Math.sin(t * TAU * 1800) * .15 + Math.sin(t * TAU * 5200) * .08) * Math.max(0, Math.sin(t * TAU * 3));
    const cases = [['pulito', mk(1.2, t => voice(t) * .8 + (Math.random() - .5) * .002), 'KEEP'], ['fruscio forte', mk(1.2, t => voice(t) * .15 + (Math.random() - .5) * .35), 'REPLACE'],
      ['distorto', mk(1.2, t => clamp(voice(t) * 4, -1, 1)), 'REPLACE'], ['ovattato', mk(1.2, t => (lpf += (voice(t) - lpf) * .03) * 3), 'CLEANUP|REPLACE'], ['con silenzi', mk(2, t => t > .6 && t < 1.4 ? voice(t) * .8 : 0), 'CLEANUP']];
    for (const [nm, bb, exp] of cases) { const qq = caAnalyze(bb); ok('qualità: ' + nm, new RegExp('^(' + exp + ')$').test(qq.cls), qq.cls + (qq.notes.length ? ' — ' + qq.notes.join(', ') : '')); }
    const cl = caCleanVoice(cases[4][1], caAnalyze(cases[4][1])); ok('pulizia voce: silenzi tagliati', cl.duration < 1, cl.duration.toFixed(2) + ' s invece di 2,00');
    // 12 occlusione: un edificio fra camera e sorgente attenua e ovatta, allo scoperto no
    const W = solids.find(o => o.on && /house|church/.test(o.tag || '') && o.max.y - o.min.y > 4 && o.min.z < -150);
    if (W) { const wx = (W.min.x + W.max.x) / 2; camera.position.set(wx, Hf(wx, W.max.z + 8) + 1.6, W.max.z + 8); OCC.m.clear(); OCC.cam.set(1e9, 0, 0);
      const behind = spatial(new V3(wx, Hf(wx, W.min.z - 8), W.min.z - 8)), open = spatial(new V3(wx, Hf(wx, W.max.z + 30), W.max.z + 30));
      ok('occlusione: dietro l\'edificio', behind.occ && !open.occ, `dietro: filtro ${Math.round(behind.lp)} Hz · scoperto: filtro ${Math.round(open.lp)} Hz`); }
    // 11 mixer: ogni suono va nel suo bus e il volume del bus si applica
    ok('mixer: bus per categoria', busFor('garand') === AU.bus.weapons && busFor('boom') === AU.bus.explosions && busFor('x', { cx: 'aircraft.p47.engine' }) === AU.bus.aircraft && busFor('_custom', { bus: 'voices' }) === AU.bus.voices);
    SETTINGS.mix = { weapons: .4 }; mixApply(); await new Promise(r => setTimeout(r, 400)); ok('mixer: volume delle armi al 40%', Math.abs(AU.bus.weapons.gain.value - .4) < .03, AU.bus.weapons.gain.value.toFixed(2)); SETTINGS.mix = {}; mixApply();
    return R.join('\n'); }));
  // 10 volo: 3 minuti con manetta che cambia e cambi di visuale, il motore non viene mai ricostruito
  await p.evaluate(async () => { $('optMap').value = 'air'; $('optMap').dispatchEvent(new Event('change')); });
  await b.close();
  const b2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }); const p2 = await b2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('file://' + root + '/index.html'); await p2.waitForTimeout(1500);
  await p2.evaluate(async () => { $('optMap').value = 'air'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p2.waitForTimeout(5000);
  console.log(await p2.evaluate(async () => { const R = [];
    if (P.mode !== 'plane') { enterPlane(); }
    const me = PL.me, h = me && me.eng; if (!h) return 'nessun motore del giocatore';
    const src0 = h.src, b0 = h.builds; let rateMin = 9, rateMax = 0, jumps = 0, lastRate = null;
    for (let i = 0; i < 180 * 30; i++) { const dt = 1 / 30; GAME.time += dt; PL.throttle = .5 + .45 * Math.sin(i / 90); if (i % 600 === 0) PL.ext = !PL.ext; try { updateAircraft(dt); updatePlayer(dt); } catch (e) { return 'ERR ' + e.message; }
      if (PL.me !== me) break; const r = h.src.playbackRate.value; rateMin = Math.min(rateMin, r); rateMax = Math.max(rateMax, r); if (lastRate !== null && Math.abs(r - lastRate) > .15) jumps++; lastRate = r; }
    R.push(((PL.me === me && h.src === src0 && h.builds === b0) ? 'OK   ' : 'FALLITO ') + `motore P-47 per 3 minuti con manetta variabile e 18 cambi di visuale: stessa sorgente audio ${h.src === src0}, ricostruzioni ${h.builds - b0}, velocità di lettura ${rateMin.toFixed(2)}–${rateMax.toFixed(2)}, salti bruschi ${jumps}`);
    return R.join('\n'); }));
  console.log(errs.slice(0, 3).join(' | ') || 'nessun errore'); await b2.close(); })();
