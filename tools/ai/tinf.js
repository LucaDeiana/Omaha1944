// test dei singoli comportamenti dell'IA di fanteria 3.0 (generatore deterministico)
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const S = __dirname;
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../../index.html') + ''); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(2500);
  console.log(await p.evaluate(() => {
    let sd = 7; Math.random = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    const clear = () => { for (const s of allies.concat(enemies)) { s.alive = false; s.removed = true; s.body.removed = true; } allies.length = enemies.length = 0; INF.squads.length = 0; P.dead = true; P.pos.set(0, -50, 900); MISSION.allyZone = null; };
    const mk = (tm, k, x, z, o = {}) => { const s = new Soldier(tm, k, x, z, Object.assign({ state: tm === 'A' ? 'cover' : 'post' }, o)); (tm === 'A' ? allies : enemies).includes(s) || (tm === 'A' ? allies : enemies).push(s); s.thinkDt = .4; return s; };
    const step = sec => { for (let i = 0; i < sec * 30; i++) { GAME.time += 1 / 30; updateAI(1 / 30); } };
    // punto aperto e un muro: cerco un solido alto isolato
    const W = solids.find(s => s.on && /house|wall|church|ruin/.test(s.tag || '') && s.min.y < Hf((s.min.x + s.max.x) / 2, (s.min.z + s.max.z) / 2) + .5 && s.max.y - s.min.y > 3 && s.max.x - s.min.x > 4 && s.max.x - s.min.x < 20 && s.min.z < -150 && s.max.z > -400);
    const wx = (W.min.x + W.max.x) / 2, wz = (W.min.z + W.max.z) / 2;
    clear();
    // 1 percezione: un nemico dietro il muro non è noto; uno allo scoperto nel cono visivo sì (dopo il tempo d'individuazione)
    const a = mk('A', 'rifle', wx, W.max.z + 6, { stationary: true }), e1 = mk('E', 'rifle', wx, W.min.z - 3, { stationary: true });
    a.yaw = 0; for (let i = 0; i < 8; i++) a.findTarget();
    ok('percezione: nemico dietro il muro sconosciuto', !a.target && !(a.mem && a.mem.has(e1)));
    e1.alive = false; e1.removed = true; e1.body.removed = true; enemies.splice(enemies.indexOf(e1), 1); const e1b = mk('E', 'rifle', wx, W.min.z - 3, { stationary: true });
    let ep = null; for (let k = 0; k < 24 && !ep; k++) { const an = k / 24 * TAU, x = a.pos.x + Math.sin(an) * 32, z = a.pos.z + Math.cos(an) * 32; if (pointInSolid(new V3(x, Hf(x, z) + 1, z))) continue; if (losClear(a.eye(new V3()), new V3(x, Hf(x, z) + 1.3, z))) ep = [x, z]; }
    const e2 = mk('E', 'rifle', ep[0], ep[1], { stationary: true }); a.yaw = Math.atan2(-(e2.pos.x - a.pos.x), -(e2.pos.z - a.pos.z));
    e2.crouch = 1; e2.state = 'cover'; a.findTarget(); const first = a.target === e2; let n = 1; while (a.target !== e2 && n < 20) { a.findTarget(); n++; }
    ok('percezione: nemico accovacciato e fermo individuato dopo un tempo', a.target === e2 && !first, n + ' cicli di percezione');
    a.spot.clear(); a.mem.clear(); e2.crouch = 0; e2.state = 'move'; e2.moving = true; a.findTarget(); ok('percezione: nemico in piedi in movimento individuato subito', a.target === e2); e2.moving = false;
    // 2 cono visivo: alle spalle non si vede
    a.yaw += PI; a.spot && a.spot.clear(); a.mem && a.mem.clear(); for (let i = 0; i < 10; i++) a.findTarget(); ok('cono visivo: nemico alle spalle non visto', a.target !== e2);
    // 3 udito: lo sparo lascia una posizione stimata (non esatta)
    a.mem && a.mem.clear(); infHear(e1b, e1b.pos, 1); const m = a.mem.get(e1b); ok('udito: posizione stimata dello sparo', !!m && m.conf < 1 && m.p.distanceTo(e1b.pos) > 0, m ? 'errore ' + m.p.distanceTo(e1b.pos).toFixed(1) + ' m' : '');
    // 4 memoria: decade e si cancella
    m.t = GAME.time - 20; a.findTarget(); ok('memoria: decadimento e cancellazione', !a.mem.has(e1b));
    // 5 squadre e successione del comando
    clear(); const sq = []; for (let i = 0; i < 5; i++) sq.push(mk('A', i ? 'rifle' : 'smg', wx + i * 3, W.max.z + 20));
    infForm(); const q = sq[0].squadQ; ok('squadra formata con comandante', q && q.m.length === 5 && q.lead === sq[0], q ? q.m.length + ' membri, capo ' + q.lead.kind : '');
    const s0 = INF.st.succession; sq[0].alive = false; infSquadTick(q, 1); ok('successione del comando', q.lead && q.lead !== sq[0] && INF.st.succession === s0 + 1 && sq[1].morale < .85);
    // 6 soppressione → inchiodato → recupero
    const v = sq[2]; v.supp = 1; infSquadTick(q, 1); const pin = !!v.pinned; v.supp = 0; GAME.time += 5; infSquadTick(q, 1); ok('soppressione: inchiodato e poi recupero', pin && !v.pinned);
    // 7 morale: cala con il fuoco, si riprende in calma
    v.morale = .2; for (let i = 0; i < 40; i++) infSquadTick(q, 1); ok('morale: recupero in calma', v.morale > .4, v.morale.toFixed(2));
    for (const s of q.m) s.supp = .9; const mb = q.m.map(s => s.morale); for (let i = 0; i < 6; i++) infSquadTick(q, 1); ok('morale: cala sotto il fuoco', q.m.every((s, i) => s.morale < mb[i]));
    // 8 ripari: prenotazione e rilascio
    const c0 = covers.find(c => c.occ === 0 && Math.hypot(c.x - v.pos.x, c.z - v.pos.z) < 50 && Math.hypot(c.x - wx, c.z - (W.min.z - 60)) > Math.hypot(v.pos.x - wx, v.pos.z - (W.min.z - 60)) + 10);
    const nc = covers.filter(c => c.occ === 0 && Math.hypot(c.x - v.pos.x, c.z - v.pos.z) > 15 && Math.hypot(c.x - v.pos.x, c.z - v.pos.z) < 40)[0], th = new V3(v.pos.x - (nc.x - v.pos.x) * 2, 0, v.pos.z - (nc.z - v.pos.z) * 2);
    infFallback(v, th, 10); const cv = v.cover, occ = cv ? cv.occ : -1; infFallback(v, th, 10);
    ok('ripari: prenotazione', cv && occ >= 1); ok('ripari: rilascio del precedente', !cv || v.cover === cv || cv.occ === occ - 1);
    // 9 caricatore: finiti i colpi ricarica e tace
    const g = sq[3]; g.target = e2; g.mag = 1; g.fire(); ok('munizioni: ricarica a caricatore vuoto', g.reloadT > 0 && g.mag === 8, 'ricarica ' + g.reloadT.toFixed(1) + ' s');
    // 10 morte e copertura rimossa: nessun errore e posto liberato dalla squadra
    sq[4].alive = false; infSquadTick(q, 1); ok('morte: tolto dalla squadra', !q.m.includes(sq[4]));
    if (cv) { cv.occ = 0; const kd = covers.indexOf(cv); covers.splice(kd, 1); try { infSquadTick(q, 1); v.think(); ok('riparo rimosso: nessun errore', true); } catch (e) { ok('riparo rimosso: nessun errore', false, e.message); } covers.splice(kd, 0, cv); }
    // 11 fuoco di soppressione: non colpisce mai
    const hp0 = e2.hp; g.reloadT = 0; g.target = { isSupp: true, alive: true, pos: e2.pos.clone(), crouch: 0, chest(o) { return o.copy(this.pos).setY(this.pos.y + .9); } }; for (let i = 0; i < 30; i++) { g.mag = 8; g.fire(); } ok('soppressione: nessun colpo garantito', e2.hp === hp0);
    // 13 carri: un Panzer vicino e visibile spaventa e fa cercare riparo; davanti a uno Sherman in movimento ci si sposta di lato
    clear(); const ta = mk('A', 'rifle', ep[0], ep[1]); const sqa = [ta, mk('A', 'rifle', ep[0] + 2, ep[1]), mk('A', 'rifle', ep[0] - 2, ep[1]), mk('A', 'smg', ep[0], ep[1] + 2)]; infForm();
    const pz = new Panzer(a.pos.x, a.pos.z, 0); pz.think = () => { }; const sp0 = ta.supp; infSquadTick(ta.squadQ, 1);
    ok('carri: il Panzer spaventa e fa cercare riparo', ta.supp > sp0 && !!ta.dest, 'soppressione ' + ta.supp.toFixed(2) + ', scarti ' + (INF.st.tankDodge || 0));
    pz.alive = false; vpRemove(pz);
    const sh = new KasTank('sherman', 'A', ta.pos.x, ta.pos.z + 7, 0); sh.speed = 4; sh.think = () => { }; ta.dest = null; ta.tankDodgeT = 0; infSquadTick(ta.squadQ, 1);
    ok('carri: passo di lato davanti allo Sherman in movimento', !!ta.dest && (INF.st.tankStep || 0) > 0); vpRemove(sh);
    // 14 tiratore scelto: dopo tre colpi cambia posizione
    for (const c of covers) if (Math.hypot(c.x - ep[0], c.z - ep[1]) < 40) c.occ = 0;
    const sn = mk('A', 'sniper', ep[0] + 5, ep[1]); sn.target = e2; for (let i = 0; i < 3; i++) { sn.mag = 5; sn.fire(); } sn.dest = null; for (let i = 0; i < 3; i++) { GAME.time += 1; sn.findTarget(); }
    ok('tiratore scelto: cambia posizione dopo tre colpi', !!sn.dest, 'spostamenti ' + (INF.st.snMove || 0));
    // 12 debug attivabile
    INF.debug = true; try { infDebugDraw(); for (let i = 0; i < 6; i++) infDebugDraw(); ok('debug: sovrimpressione', true); } catch (e) { ok('debug: sovrimpressione', false, e.message); } INF.debug = false;
    return R.join('\n'); }));
  console.log(errs.slice(0, 3).join('|') || 'nessun errore'); await b.close(); })();
