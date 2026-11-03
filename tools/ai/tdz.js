// test Distruzione 3.0 sul villaggio di prova (Kasserine, schieramento «V»)
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext(); let p; const errs = [];
  const open = async () => { if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
    await p.evaluate(async () => { $('optMap').value = 'kas'; $('optMap').dispatchEvent(new Event('change')); $('optKasSide').value = 'V'; await startGame(); }); await p.waitForTimeout(2500); };
  await open();
  console.log(await p.evaluate(() => {
    let sd = 5; Math.random = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    const H = DZ.objs.get('casa_01'), front = H.secs.filter(s => s.face === 'front' && s.role === 'wall'), mid = s => new V3((s.box[0] + s.box[3]) / 2, (s.box[1] + s.box[4]) / 2, (s.box[2] + s.box[5]) / 2);
    const panel = front.find(s => s.box[1] > H.base) || front[0], pc = mid(panel), out = pc.clone().add(new V3(0, 0, 6)), inn = pc.clone().add(new V3(0, 0, -1.2));
    const shot = (sec, he) => dzShellHit(sec.sol, mid(sec), new V3(0, 0, -1), { T: { cal: 75 }, he });
    // 1 intatto: blocca vista e proiettili
    const h1 = tlRay(out, inn, 'sight'), h1s = tlRay(out, inn, 'shell', 88);
    ok('1 edificio integro blocca vista e proiettili', h1 && h1.s === panel.sol && h1s && h1s.s === panel.sol, h1 ? h1.s.tag : 'nessun ostacolo');
    // 2 danno leggero: crepe, copertura e collider invariati
    const y0 = panel.sol.max.y; shot(panel, false);
    ok('2 un colpo → danno leggero, il muro protegge ancora', panel.state === 1 && panel.sol.on && panel.sol.max.y === y0 && !!tlRay(out, inn, 'sight'), `${DZ_ST[panel.state]}, integrità ${Math.round(panel.hp / panel.max * 100)}%`);
    // 3 danno grave: metà sezione, collider abbassato
    shot(panel, false);
    ok('3 secondo colpo → danno grave, collider della metà rimasta', panel.state === 2 && Math.abs(panel.sol.max.y - (panel.box[1] + (panel.box[4] - panel.box[1]) * .5)) < .01 && Math.abs(panel.mesh.scale.y - (panel.sol.max.y - panel.box[1])) < .01, `alto ${(panel.sol.max.y - panel.box[1]).toFixed(2)} m su ${(panel.box[4] - panel.box[1]).toFixed(2)}`);
    // 4-5 distrutto: collider tolto, macerie basse con collider proprio; la vista e i colpi passano dall'apertura e solo da lì
    shot(panel, false);
    const side = front.find(s => s !== panel && s.state === 0), sc = mid(side);
    ok('4 terzo colpo → sezione distrutta', panel.state === 3 && !panel.sol.on && !panel.mesh.visible);
    ok('5 collider coerente: varco libero, macerie basse, muro accanto ancora solido', !tlRay(out, inn, 'shell', 0) && !!panel.rubSol && panel.rubSol.max.y - panel.ground < .6 && !!tlRay(sc.clone().add(new V3(0, 0, 6)), sc.clone().add(new V3(0, 0, -1.2)), 'shell', 0), 'macerie alte ' + (panel.rubSol.max.y - panel.ground).toFixed(2) + ' m');
    // 6 varco percorribile dalla fanteria (a piano terra)
    const g0 = front.find(s => s.box[1] < H.base && s.role === 'wall' && s.state === 0), gc = mid(g0), rt = dzRoute('varco', gc.clone().add(new V3(0, 0, 3)), gc.clone().add(new V3(0, 0, -3)), .8, 'inf'); const before = rt.open;
    for (let i = 0; i < 4 && g0.state < 3; i++) shot(g0, true);
    const pp = gc.clone().setY(g0.ground + .1); pushOut(pp, .4); ok('6 muro abbattuto → passaggio reale per la fanteria', !before && rt.open && Math.hypot(pp.x - gc.x, pp.z - gc.z) < .05, `percorso ${before ? 'aperto' : 'chiuso'} → ${rt.open ? 'aperto' : 'chiuso'}`);
    // 7 IA: un soldato su una copertura del muro la perde e se ne cerca un'altra
    const W = DZ.objs.get('muro_01'), sold = enemies.find(s => s.alive && s.cover && s.cover.dz && s.cover.dz.obj === W), cv = sold && sold.cover;
    if (sold) { const sec = cv.dz; while (sec.state < 3) dzDamage(sec, 2000, mid(sec), null); for (let i = 0; i < 90; i++) { GAME.time += 1 / 30; updateAI(1 / 30); } }
    ok('7 copertura distrutta: il soldato lo riconosce e cambia posizione', sold && cv.dead && sold.cover !== cv && sold.coverLostT !== undefined, sold ? `nuova copertura ${sold.cover ? sold.cover.kind : 'in movimento'}` : 'nessun soldato al muro');
    // 8 carri: la linea di vista e di tiro si aggiornano quando si apre il varco
    const us = KAS.vil.us, pz = KAS.vil.pz, back = H.secs.filter(s => s.face === 'back' && s.role === 'wall');
    const v0 = tlSee(us, pz);
    const e = tlEye(us, new V3()), tpz = new V3(pz.pos.x, pz.pos.y + pz.T.hullH + .4, pz.pos.z); let k = 0, hh;
    while ((hh = tlRay(e, tpz, 'sight')) && hh.s && hh.s._dz && k++ < 12) { const s = hh.s._dz; if (s.state < 2) dzSetState(s, 2, {}); dzSetState(s, 3, {}); }
    const v1 = tlSee(us, pz);
    ok('8 varco aperto → lo Sherman vede il Panzer subito (cache invalidata)', !v0 && v1, `sezioni aperte ${k}`);
    // 9 navigazione: la barricata chiude la strada ai carri; distrutta la riapre (evento)
    const rs = DZ.routes.find(r => r.id === 'strada'), was = rs.open; let opened = false; dzOn('ROUTE_OPENED', d => { if (d.id === 'strada') opened = true; });
    for (const s of DZ.objs.get('barricata_01').secs) while (s.state < 3) dzDamage(s, 500, mid(s), null);
    ok('9 barricata distrutta → ROUTE_OPENED, percorso libero', !was && rs.open && opened);
    // relitto sulla strada → ROUTE_BLOCKED
    let blocked = false; dzOn('ROUTE_BLOCKED', d => { if (d.id === 'strada') blocked = true; }); const fake = { pos: new V3(rs.a.x, Hf(rs.a.x, (rs.a.z + rs.b.z) / 2), (rs.a.z + rs.b.z) / 2), yaw: 0, T: { half: [1.4, 3], hullH: 2 }, name: 'prova' }; dzWreck(fake);
    ok('9b relitto sulla strada → ROUTE_BLOCKED', blocked && !rs.open); fake.wreckSol.on = false; dzRoutesNear([rs.a.x - 5, 0, Math.min(rs.a.z, rs.b.z), rs.a.x + 5, 0, Math.max(rs.a.z, rs.b.z)]);
    // 10 cratere: terreno fisico e mesh abbassati insieme
    const cp = new V3(KAS.vil.C.x - 40, 0, KAS.vil.C.z + 40); cp.y = Hf(cp.x, cp.z); const T = WORLD.terr;
    const bs = (a, v) => { let i = 0; while (i < a.length - 1 && a[i] < v) i++; return i; }, vi = bs(T.zs, cp.z) * T.nx + bs(T.xs, cp.x), vx = T.xs[vi % T.nx], vz = T.zs[Math.floor(vi / T.nx)];
    const yv0 = Hf(vx, vz), yc0 = Hf(cp.x, cp.z); explode(cp.clone().add(new V3(0, .3, 0)), 9, 500, {}); const yc1 = Hf(cp.x, cp.z);
    const yv1 = Hf(vx, vz), my = T.g.attributes.position.getY(vi);
    ok('10 bombardamento → cratere grande, mesh e terreno fisico coincidono', yc0 - yc1 > .8 && yv0 - yv1 > .05 && Math.abs(my - yv1) < .01, `profondità ${(yc0 - yc1).toFixed(2)} m al centro, ${(yv0 - yv1).toFixed(2)} m sul vertice vicino, scarto mesh ${(Math.abs(my - yv1)).toFixed(3)} m`);
    return R.join('\n');
  }));
  // vertical slice: sequenza completa con l'IA
  await open();
  console.log(await p.evaluate(() => {
    let sd = 3; Math.random = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    const st = dt => { GAME.time += dt; updateArmor(dt); updateAI(dt); updateTimers(dt); updateFX(dt); };
    const us = KAS.vil.us, pz = KAS.vil.pz, seq = []; let hitsThrough = 0;
    const h0 = pz.hit.bind(pz); pz.hit = function (pt, dir, sh) { const e = tlEye(us, new V3()); if (tlRay(e, new V3(pz.pos.x, pz.pos.y + 2.3, pz.pos.z), 'shell', 0) && tlRay(e, new V3(pz.pos.x, pz.pos.y + 1.1, pz.pos.z), 'shell', 0)) hitsThrough++; return h0(pt, dir, sh); };
    for (const t of ['WALL_BREACHED', 'VEHICLE_WRECK_CREATED', 'COVER_DESTROYED', 'CRATER']) dzOn(t, () => seq.push(t));
    const seen0 = []; let t = 0; for (; t < 150 && MISSION.stage < 3; t += 1 / 30) { st(1 / 30); if (!seen0.length && tlSee(us, pz)) seen0.push(t); }
    st(1 / 30); const holders = KAS.tanks.filter(x => x.alive && x.target === pz).map(x => x.name + (x.player ? ' (giocatore)' : ''));
    const bre = DZ.secs.filter(s => s.state >= 3 && s.obj.id === 'casa_01').length;
    ok('slice: lo Sherman non colpisce il Panzer attraverso la casa intatta', hitsThrough === 0, 'colpi a segno con la casa in mezzo ' + hitsThrough);
    ok('slice: lo Sherman sfonda il muro con colpi reali', (us.breachShots || 0) > 0 && seq.includes('WALL_BREACHED'), `colpi di sfondamento ${us.breachShots || 0}, sezioni aperte ${bre}`);
    ok('slice: dopo il varco lo vede e il combattimento riprende', seen0.length > 0 && seen0[0] > 0 && !pz.alive, `visto a ${seen0[0] ? seen0[0].toFixed(1) : '-'} s, Panzer ${pz.alive ? 'vivo' : 'distrutto'} a ${t.toFixed(0)} s`);
    ok('11 relitto: resta, ha un collider d\'acciaio, non è più un bersaglio', !pz.alive && pz.wreckSol && pz.wreckSol.on && !holders.length && !!pz.g.parent, holders.join(', '));
    ok('slice: fase finale raggiunta', MISSION.stage === 3, MISSION.objText);
    ok('slice: effetti limitati (macerie, incendi)', DZ.rubN <= DZ.RUB_MAX && DZ.fires <= DZ.FIRE_MAX, `macerie ${DZ.rubN}, incendi ${DZ.fires}, crateri ${DZ.craters}, sequenza eventi: ${[...new Set(seq)].join(' → ')}`);
    window.__snap = JSON.stringify(dzSnapshot()); window.__rub = DZ.rubN; return R.join('\n');
  }));
  const snap = await p.evaluate(() => window.__snap);
  // 12 checkpoint: nuova partita, ripristino; due ripristini non duplicano nulla e non ripetono eventi
  await open();
  console.log(await p.evaluate(sn => {
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); const S = JSON.parse(sn);
    let ev = 0; dzOn('WALL_BREACHED', () => ev++);
    dzRestore(S); const s1 = dzSnapshot().s, rub1 = DZ.rubN, sol1 = solids.length; dzRestore(S); const rub2 = DZ.rubN;
    const H = DZ.objs.get('casa_01'), gone = H.secs.filter(s => s.state >= 3), allOff = gone.every(s => !s.sol.on && s.rubSol);
    ok('12 checkpoint: stato degli edifici ripristinato', s1 === S.s && allOff, `${gone.length} sezioni distrutte ripristinate`);
    ok('12 checkpoint: nessuna duplicazione, nessun evento ripetuto', rub2 === rub1 && solids.length === sol1 && ev === 0, `macerie ${rub1}→${rub2}, eventi ${ev}`);
    // 13 rete: l'host decide, il client applica gli eventi e l'istantanea → stesso stato
    const evs = []; NET.host = true; NET.peers = new Map([[1, {}]]); const nh = netHostEvent; window.netHostEvent = e => evs.push(e);
    const sec = DZ.secs.find(s => s.state === 0 && s.role === 'wall'); dzDamage(sec, 5000, null, null); NET.host = false; window.netHostEvent = nh;
    window.__ev = JSON.stringify(evs); window.__st = dzSnapshot().s; return R.join('\n');
  }, snap));
  const net = await p.evaluate(() => [window.__ev, window.__st]);
  await open();
  console.log(await p.evaluate(([evs, hostState, sn]) => {
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    NET.client = true; dzNetSync(JSON.parse(sn).s); for (const e of JSON.parse(evs)) dzNetEvent(e);
    const before = dzSnapshot().s; dzDamage(DZ.secs.find(s => s.state === 0), 9999, null, null); const after = dzSnapshot().s; NET.client = false;
    ok('13 rete: il client ottiene lo stesso stato dell\'host (istantanea + eventi)', before === hostState, `${before.split('').filter(c => c === '3').length} sezioni distrutte su entrambi`);
    ok('13 rete: il client non decide i danni strutturali', after === before);
    return R.join('\n');
  }, [net[0], net[1], snap]));
  // 14 stress: molte esplosioni e colpi
  await open();
  console.log(await p.evaluate(() => {
    const R = [], C = KAS.vil.C, m0 = performance.memory ? performance.memory.usedJSHeapSize : 0; let tE = 0, n = 0;
    for (let i = 0; i < 80; i++) { const pt = new V3(C.x + rnd(-45, 45), 0, C.z + rnd(-40, 40)); pt.y = Hf(pt.x, pt.z) + rnd(0, 3); const t0 = performance.now(); explode(pt, rnd(3, 10), rnd(150, 600), {}); tE += performance.now() - t0; n++; for (let k = 0; k < 4; k++) { GAME.time += 1 / 30; updateFX(1 / 30); } }
    let tS = 0; for (let i = 0; i < 60; i++) { const s = DZ.secs[Math.floor(R_() * DZ.secs.length)]; const t0 = performance.now(); dzDamage(s, rnd(200, 900), null, null); tS += performance.now() - t0; } function R_() { return Math.random(); }
    const t0 = performance.now(); for (let i = 0; i < 60; i++) { GAME.time += 1 / 30; updateArmor(1 / 30); updateAI(1 / 30); updateFX(1 / 30); } const tick = (performance.now() - t0) / 60;
    const m1 = performance.memory ? performance.memory.usedJSHeapSize : 0;
    R.push(`OK   14 stress: ${n} esplosioni (${(tE / n).toFixed(2)} ms ciascuna, con crateri e danni), 60 impatti diretti (${(tS / 60).toFixed(2)} ms), sezioni distrutte ${DZ.secs.filter(s => s.state >= 3).length}/${DZ.secs.length}, edificio ${DZ_ST[DZ.objs.get('casa_01').state]}, crateri ${DZ.craters}, macerie ${DZ.rubN}/${DZ.RUB_MAX}, incendi ${DZ.fires}/${DZ.FIRE_MAX}, collider ${DZ.st.colMs.toFixed(1)} ms totali, percorsi ${DZ.st.routeMs.toFixed(1)} ms totali, crateri ${DZ.st.craterMs.toFixed(1)} ms totali; aggiornamento di gioco dopo lo stress ${tick.toFixed(2)} ms/fotogramma; memoria JS ${((m1 - m0) / 1048576).toFixed(1)} MB in più`);
    return R.join('\n');
  }));
  // campagna: Steel Support, punto di ripresa con lo stato della distruzione, «Continua» in una pagina nuova
  if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { const s = campLoad(); s.done.overlord_01 = { t: 1 }; s.cp = null; campSave(s); await campStart('overlord_05'); GAME.running = true; }); await p.waitForTimeout(2500);
  const c1 = await p.evaluate(() => { const st = dt => { GAME.time += dt; updateArmor(dt); updateAI(dt); updateTimers(dt); campTick(dt); }; for (let i = 0; i < 30 * 60 && MISSION.stage < 2; i++) st(1 / 30); const cp = campLoad().cp; return { on: CAMP.on, stage: MISSION.stage, cp: cp && cp.stage, dz: cp && cp.dz && cp.dz.s, live: dzSnapshot().s }; });
  if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { campMenu(); document.querySelector('#campMenu [data-c=continue]').click(); }); for (let i = 0; i < 20 && await p.evaluate(() => MISSION.stage < 0 || !KAS.vil); i++) await p.waitForTimeout(1000);
  const c2 = await p.evaluate(() => { GAME.running = true; for (let i = 0; i < 3; i++) { GAME.time += 1 / 30; campTick(1 / 30); updateArmor(1 / 30); } return { stage: MISSION.stage, s: dzSnapshot().s }; });
  console.log((c1.on && c1.cp === 2 && c1.dz && c1.dz.includes('3') ? 'OK   ' : 'FALLITO ') + 'campagna: punto di ripresa della fase 2 con lo stato della distruzione — ' + JSON.stringify({ fase: c1.stage, cp: c1.cp, distrutte: c1.dz ? c1.dz.split('').filter(x => x === '3').length : 0 }));
  console.log((c2.stage === 2 && c2.s === c1.dz ? 'OK   ' : 'FALLITO ') + 'campagna: «Continua» ripristina fase e villaggio — ' + JSON.stringify({ fase: c2.stage, uguale: c2.s === c1.dz }));
  console.log(errs.length ? 'ERRORI JS: ' + [...new Set(errs)].slice(0, 4).join(' | ') : 'nessun errore JavaScript'); await b.close();
})();
