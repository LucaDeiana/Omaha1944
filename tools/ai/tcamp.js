// test della campagna «Theatres of War»: registro, validazione, salvataggi, missione 1 dall'inizio alla fine
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext(); let p = await ctx.newPage(); const errs = []; const watch = q => q.on('pageerror', e => errs.push(e.message)); watch(p); const fresh = async () => { await p.close(); p = await ctx.newPage(); watch(p); await p.goto(URL); await p.waitForTimeout(1500); };
  const R = []; const ok = (n, c, x = '') => console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
  await p.goto(URL); await p.waitForTimeout(1500);
  const a = await p.evaluate(() => {
    const exp = { edoardo_stara: 'Captain Edoardo Stara', alessio_medda: 'First Lieutenant Alessio Medda', dominick_ucchesu: 'Staff Sergeant Dominick Ucchesu', nino_baker: 'Technical Sergeant Nino Baker', richard_lecca: 'First Lieutenant Richard Lecca', manuel_meloni: 'Petty Officer First Class Manuel Meloni', matteo_murtas: 'Corporal Matteo Murtas' };
    const bad = Object.entries(exp).filter(([id, f]) => !CHAR[id] || CHAR[id].rank + ' ' + CHAR[id].firstName + ' ' + CHAR[id].lastName !== f).map(x => x[0]);
    const fict = CHARACTERS.every(c => c.fictional === true || /fantasia|fittizi/i.test(JSON.stringify(c)));
    const val = campValidate();
    // validazione: duplicato e riferimento mancante vengono segnalati
    const m0 = CMISSIONS[1], keep = m0.characters; m0.characters = keep.concat(['nessuno']); CMISSIONS.push(CMISSIONS[0]); const val2 = campValidate(); CMISSIONS.pop(); m0.characters = keep;
    localStorage.setItem('fo44_campaign', '{rotto'); const s1 = campLoad(); const bk = localStorage.getItem('fo44_campaign_backup');
    localStorage.removeItem('fo44_campaign'); const fresh = campLoad();
    const av = CMISSIONS.filter(m => campAvailable(m, fresh)).map(m => m.id), planned = CMISSIONS.filter(m => m.status === 'planned').length, chap = CAMPAIGN.chapters.map(c => c.missions.length).join('/');
    return { bad, fict, n: CHARACTERS.length, val, val2, corrupt: s1.v === 1 && !Object.keys(s1.done).length && bk === null, av, planned, chap, tot: CMISSIONS.length };
  });
  ok('registro: 7 personaggi con nomi e gradi esatti', a.n === 7 && !a.bad.length, a.bad.join(','));
  ok('personaggi dichiarati di fantasia', a.fict);
  ok('validazione: configurazione pulita', !a.val.length, a.val.join('; '));
  ok('validazione: duplicati e riferimenti mancanti segnalati', a.val2.some(e => /duplicata/.test(e)) && a.val2.some(e => /sconosciuto nessuno/.test(e)), a.val2.length + ' errori');
  ok('salvataggio corrotto: si riparte da zero senza errori', a.corrupt);
  ok('capitoli 7/6/6/5', a.chap === '7/6/6/5', a.chap + ', ' + a.planned + ' in preparazione');
  ok('progressione iniziale: solo la prima missione', a.av.join() === 'overlord_01', a.av.join());
  // missione 1
  await p.evaluate(async () => { await campStart('overlord_01'); GAME.running = true; }); await p.waitForTimeout(4000);
  const b1 = await p.evaluate(() => { const sq = allies.filter(s => s.squad); return { on: CAMP.on, st: MISSION.stage, names: sq.map(s => s.name + ':' + s.kind), chars: Object.keys(CAMP.chars), cp: campLoad().cp, run: GAME.running }; });
  ok('missione 1 avviata', b1.on && b1.run && b1.st >= 0, 'fase ' + b1.st);
  ok('squadra con i personaggi', ['dominick_ucchesu', 'matteo_murtas', 'alessio_medda'].every(c => b1.chars.includes(c)), b1.names.join(', '));
  ok('Murtas cecchino', b1.names.some(n => /Murtas:sniper/.test(n)));
  ok('punto di ripresa iniziale', b1.cp && b1.cp.mission === 'overlord_01' && b1.cp.stage === 0);
  // fasi: dialoghi e salvataggio a ogni fase
  const ph = [];
  for (let st = 1; st <= 4; st++) { await p.evaluate(s => { P.inBoat = false; setStage(s); }, st); await p.evaluate(() => { if (CUT.active) endCutscene(); MISSION.stageT = 30; }); await p.waitForTimeout(2500); ph.push(await p.evaluate(() => ({ st: MISSION.stage, cp: campLoad().cp, fired: [...CAMP.fired].length, sub: ($('subs') || $('subtitle') || {}).textContent || '' }))); }
  ok('punto di ripresa salvato a ogni fase', ph.every((x, i) => x.cp && x.cp.stage === x.st), ph.map(x => x.st + '→' + (x.cp && x.cp.stage)).join(' '));
  ok('dialoghi della regia emessi', ph[ph.length - 1].fired >= 4, ph.map(x => x.fired).join(','));
  // protezione: un personaggio non muore
  const pr = await p.evaluate(() => { const u = CAMP.chars.dominick_ucchesu; if (!u) return null; u.damage(500, null, false, 'torso'); return { alive: u.alive, hp: u.hp, w: !!u.cWounded }; });
  ok('personaggio protetto: ferito, non ucciso', pr && pr.alive && pr.w, JSON.stringify(pr));
  // ripresa: nuova pagina, Continua dalla fase 3
  await p.evaluate(() => { const s = campLoad(); s.cp = { mission: 'overlord_01', stage: 3 }; campSave(s); });
  await fresh();
  await p.evaluate(() => { campMenu(); document.querySelector('#campMenu [data-c=continue]').click(); }); await p.waitForTimeout(800); await p.evaluate(() => { GAME.running = true; if (CUT.active) endCutscene(); }); await p.waitForTimeout(3000); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => ({ st: MISSION.stage, boat: !!P.inBoat, on: CAMP.on, gap: !!MISSION.flags.placed }));
  ok('ripresa dal punto salvato (fase 3)', r.on && r.st === 3 && !r.boat && r.gap, JSON.stringify(r));
  // conclusione
  await p.evaluate(() => setStage(5)); await p.waitForTimeout(2500); await p.evaluate(() => { for (const x of TIMERS) x.t = 0; }); await p.waitForTimeout(2500);
  const c = await p.evaluate(() => { const s = campLoad(); return { done: !!s.done.overlord_01, cp: s.cp, on: CAMP.on, av: CMISSIONS.filter(m => campAvailable(m, s)).map(m => m.id), name: N.sarge, end: !!GAME.endTitle && GAME.endTitle }; });
  ok('missione compiuta salvata', c.done && !c.cp, JSON.stringify(c.end));
  ok('missione successiva sbloccata', c.av.length > 1, c.av.join(','));
  ok('nomi originali ripristinati dopo la campagna', !c.on && !/Ucchesu/.test(c.name), c.name);
  // compatibilità: una partita normale senza campagna
  await fresh();
  const n = await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); return new Promise(r => setTimeout(() => r({ on: CAMP.on, names: allies.filter(s => s.squad).map(s => s.name + ':' + s.kind).join(', '), hud: !!$('campHud') }), 3000)); });
  ok('Omaha normale invariata', !n.on && !/Ucchesu|Murtas/.test(n.names) && !n.hud, n.names);
  ok('nessun errore JavaScript', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
