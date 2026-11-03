// test Carri 3.0: vista, linea di tiro e proiettili contro gli edifici, per entrambi gli schieramenti
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext(); let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'kas'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(3000);
  const out = await p.evaluate(() => {
    let sd = 11; Math.random = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    const clear = () => { for (const t of KAS.tanks.concat(KAS.guns)) { t.alive = false; t.remove ? t.remove() : scene.remove(t.g); } KAS.tanks.length = 0; KAS.guns.length = 0; for (const s of KAS.shells) scene.remove(s.m); KAS.shells.length = 0; TANKS.me = null; P.mode = 'foot'; P.dead = true; };
    const cp = KAS_PTS[Math.min(KAS.stage, 2)]; KAS.st = KAS.st || {};
    const mk = (type, team, x, z, yaw) => { const t = new KasTank(type, team, x, z, yaw); t.goalOff.set(x - cp.x, 0, z - cp.z); t.defend = team === 'E' ? new V3(x, 0, z) : null; t.hits = 0; t.hit = function () { this.hits++; }; t.pin = t.pos.clone(); t.fires = 0; const f = t.fireMain.bind(t); t.fireMain = bp => { const r0 = t.reload; f(bp); if (t.reload > r0) t.fires++; }; vpPoseKin && 0; return t; };
    const step = (sec, ts) => { if (!sec) return; for (let i = 0; i < sec * 30; i++) { GAME.time += 1 / 30; for (const t of ts) { t.update(1 / 30); if (t.pin) { t.pos.x = t.pin.x; t.pos.z = t.pin.z; t.speed = 0; if (t.vp) t.vp.v = 0; } } kasUpdateShells(1 / 30); } };
    // edificio isolato del villaggio, abbastanza alto da coprire un carro
    // edificio e coppia di posizioni ai due lati: con l'edificio la congiungente è bloccata, senza è libera (nessun'altra casa in mezzo)
    let H, hx, hz, A = null, E = null;
    for (const c of solids.filter(s => s.on && s.tag === 'house' && s.max.y - Hf((s.min.x + s.max.x) / 2, (s.min.z + s.max.z) / 2) > 4.6)) {
      const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2, free = (x, z) => !solids.some(s => s.on && s !== c && s.max.y - s.min.y > .5 && x > s.min.x - 6 && x < s.max.x + 6 && z > s.min.z - 6 && z < s.max.z + 6);
      for (let k = 0; k < 16 && !A; k++) { const a = k / 16 * Math.PI, dx = Math.cos(a), dz = Math.sin(a); for (const r of [30, 40, 55]) { const p1 = [cx + dx * r, cz + dz * r], p2 = [cx - dx * r, cz - dz * r]; if (!free(...p1) || !free(...p2) || Math.abs(Hf(...p1) - Hf(...p2)) > 3) continue;
        const e1 = new V3(p1[0], Hf(...p1) + 2.9, p1[1]), e2 = new V3(p2[0], Hf(...p2) + 2.3, p2[1]), e3 = new V3(p2[0], Hf(...p2) + 1.1, p2[1]); if (!tlRay(e1, e2) || !tlRay(e1, e3)) continue; c.on = false; const ok2 = !tlRay(e1, e2) && !tlRay(e1, e3); c.on = true; if (ok2) { A = p1; E = p2; H = c; hx = cx; hz = cz; break; } } }
      if (A) break; }
    const yawTo = (a, b) => Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
    const run = (obsTeam) => {
      const oT = obsTeam === 'A' ? 'sherman' : 'pz4', tT = obsTeam === 'A' ? 'pz4' : 'sherman', tTeam = obsTeam === 'A' ? 'E' : 'A', tag = obsTeam === 'A' ? 'alleato' : 'nemico';
      // 1 edificio fra due carri
      clear(); let o = mk(oT, obsTeam, A[0], A[1], yawTo(A, E)), t = mk(tT, tTeam, E[0], E[1], yawTo(E, A)); t.T = Object.assign({}, t.T); t.think = () => {};
      const hp0 = t.hp; step(14, [o, t]);
      ok(`1 ${tag}: edificio fra i carri, non si vedono`, !tlSee(o, t) && !o.target, tlMem(o).state);
      ok(`1 ${tag}: nessun danno attraverso l'edificio`, t.hits === 0 && o.fires === 0, 'colpi ' + o.fires);
      // 2 ostacolo rimosso: individua e attacca
      H.on = false; o.reload = 0; for (let i = 0; i < 12 && !o.fires; i++) step(2, [o, t]); const vis = o.target === t; H.on = true;
      ok(`2 ${tag}: senza ostacolo individua e spara`, vis && o.fires > 0, 'colpi ' + o.fires + ', colpi a segno ' + t.hits);
      // 3 bersaglio che si nasconde: visto allo scoperto, poi dietro l'edificio
      clear(); o = mk(oT, obsTeam, A[0], A[1], yawTo(A, E)); t = mk(tT, tTeam, E[0], E[1], yawTo(E, A)); t.think = () => {};
      H.on = false; for (let i = 0; i < 20 && o.target !== t; i++) step(.5, [o, t]); const saw = o.target === t, sawWhy = o.tlWhy + ' ' + tlMem(o).state; H.on = true; o.flankP = null; const f0 = o.fires, h1 = t.hits; o.tlBlock = true;
      // un riposizionamento è lecito, ma lo blocco per 10 s per verificare che fermo non spari
      step(10, [o, t]); const m = tlMem(o);
      ok(`3 ${tag}: nascosto → posizione ricordata, niente fuoco`, saw && m.state === 'TARGET_KNOWN' && o.fires === f0 && t.hits === h1, m.state + ', colpi dopo ' + (o.fires - f0) + (saw ? '' : ', mai visto: ' + sawWhy));
      ok(`3 ${tag}: reagisce (nuovo angolo di tiro o attesa)`, !!o.flankP || /attendo/.test(o.tlWhy), o.flankP ? 'punto a ' + o.flankP.distanceTo(o.pos).toFixed(0) + ' m' : o.tlWhy);
      // 4 cannone ostruito: muretto più alto della canna, più basso degli occhi del capocarro
      clear(); H.on = false; o = mk(oT, obsTeam, A[0], A[1], yawTo(A, E)); t = mk(tT, tTeam, E[0], E[1], yawTo(E, A)); t.think = () => {}; o.pin = o.pos.clone(); step(.5, [o, t]);
      const mz = o.muzzle(new V3()), ey = tlEye(o, new V3()), d = new V3(E[0] - A[0], 0, E[1] - A[1]).normalize(), wp = o.pos.clone().addScaledVector(d, 6.5), tTop = new V3(t.pos.x, t.pos.y + t.T.hullH + .4, t.pos.z), tAim = new V3(t.pos.x, t.pos.y + t.T.hullH * .55, t.pos.z), at = (a, b) => a.y + (b.y - a.y) * (Math.hypot(wp.x - a.x, wp.z - a.z) / Math.hypot(b.x - a.x, b.z - a.z)), top = (at(ey, tTop) + Math.max(at(mz, tAim), at(mz, tTop))) / 2;
      const W = addSolid(wp.x - 3 * Math.abs(d.z) - .3, Hf(wp.x, wp.z) - 1, wp.z - 3 * Math.abs(d.x) - .3, wp.x + 3 * Math.abs(d.z) + .3, top, wp.z + 3 * Math.abs(d.x) + .3, 'wall'); VP.gridN = -1;
      const h4 = t.hits, f4 = o.fires; o.reload = 0; step(10, [o, t]);
      ok(`4 ${tag}: vede ma la canna è ostruita, non spara`, o.target === t && o.fires === f4 && t.hits === h4, `occhi ${(ey.y - Hf(o.pos.x, o.pos.z)).toFixed(1)} m, canna ${(mz.y - Hf(o.pos.x, o.pos.z)).toFixed(1)} m, muro ${(top - Hf(wp.x, wp.z)).toFixed(1)} m · ${o.tlWhy}`);
      W.on = false; solids.splice(solids.indexOf(W), 1); VP.gridN = -1; H.on = true;
      // 5 proiettile sparato contro il muro: colpisce l'edificio, non il carro dietro
      const s0 = (KAS.st && KAS.st.solid) || 0, h5 = t.hits, o5 = o.muzzle(new V3()), d5 = new V3(t.pos.x, t.pos.y + 1.4, t.pos.z).sub(o5).normalize();
      kasShell(o5, d5, o.T, o); step(1.5, []);
      ok(`5 ${tag}: proiettile contro l'edificio`, (KAS.st.solid || 0) === s0 + 1 && t.hits === h5, 'impatti su solidi ' + ((KAS.st.solid || 0) - s0));
      return [o, t];
    };
    run('A'); run('E');
    // materiali: una cassa di legno viene attraversata (perforazione ridotta), la muratura no
    clear(); { const o = mk('sherman', 'A', A[0], A[1], yawTo(A, E)), t = mk('pz4', 'E', E[0], E[1], yawTo(E, A)); t.think = () => {}; H.on = false;
      const mid = new V3((A[0] + E[0]) / 2 + 4, 0, (A[1] + E[1]) / 2); const C = addSolid(mid.x - 1.5, Hf(mid.x, mid.z) - 1, mid.z - 1.5, mid.x + 1.5, Hf(mid.x, mid.z) + 6, mid.z + 1.5, 'crate'); VP.gridN = -1;
      const om = o.muzzle(new V3()), dd = mid.clone().setY(Hf(mid.x, mid.z) + 2).sub(om).normalize(); const n0 = KAS.shells.length; kasShell(om, dd, o.T, o); const sh = KAS.shells[n0]; step(.6, []);
      ok('materiali: il legno viene attraversato con perforazione ridotta', TL.st.shellPen > 0 && sh.pen < o.T.pen, `perforazione ${o.T.pen} → ${sh.pen} mm`);
      C.on = false; H.on = true; }
    // 8 distruzione: il collider spento aggiorna subito vista e tiro
    clear(); { const o = mk('sherman', 'A', A[0], A[1], yawTo(A, E)), t = mk('pz4', 'E', E[0], E[1], yawTo(E, A)); t.think = () => {}; step(2, [o, t]); const before = tlSee(o, t); H.on = false; const after = tlSee(o, t); H.on = true;
      ok('8 collider dell\'edificio spento → vista aggiornata subito (cache invalidata)', !before && after); }
    // 9 prestazioni: 12 carri che combattono nel villaggio
    clear(); { const ts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = 60 + (i % 3) * 25; ts.push(mk(i % 2 ? 'pz4' : 'sherman', i % 2 ? 'E' : 'A', hx + Math.cos(a) * r, hz + Math.sin(a) * r, 0)); }
      const s0 = Object.assign({}, TL.st), t0 = performance.now(); step(20, ts); const fr = 600, ms = TL.st.ms - s0.ms;
      R.push(`PRESTAZIONI 12 carri, 20 s: interrogazioni ${TL.st.los - s0.los} (${((TL.st.los - s0.los) / fr).toFixed(1)}/fotogramma), cache ${TL.st.cacheHit - s0.cacheHit}, ${(ms / fr).toFixed(3)} ms/fotogramma per vista+tiro+proiettili, colpi su solidi ${TL.st.shellSolid - s0.shellSolid}, tiri trattenuti ${TL.st.noLOF - s0.noLOF}, riposizionamenti ${TL.st.reposition - s0.reposition}; aggiornamento totale ${((performance.now() - t0) / fr).toFixed(2)} ms/fotogramma`); }
    return R.join('\n');
  });
  console.log(out);
  // Omaha: Panzer contro fanteria dietro una casa (e fanteria nemica per il Panzer quando si gioca coi tedeschi è la stessa classe)
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(3000);
  console.log(await p.evaluate(() => {
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    for (const t of TANKS.list) { t.alive = false; scene.remove(t.g); } TANKS.list.length = 0; for (const s of allies) { s.alive = false; s.removed = true; s.body.removed = true; } allies.length = 0; P.dead = true; P.pos.set(0, -50, 900);
    let H, hx, hz, hw;
    for (const c of solids.filter(s => s.on && /house|church|ruin/.test(s.tag) && s.max.y - s.min.y > 5 && s.max.x - s.min.x > 6)) { const x = (c.min.x + c.max.x) / 2, z = (c.min.z + c.max.z) / 2, w = (c.max.x - c.min.x) / 2, a = new V3(x - w - 30, Hf(x - w - 30, z) + 2.7, z), b = new V3(x + w + 8, Hf(x + w + 8, z) + 1.3, z);
      if (pointInSolid(a) || pointInSolid(b) || !tlRay(a, b)) continue; c.on = false; const clear = !tlRay(a, b); c.on = true; if (clear) { H = c; hx = x; hz = z; hw = w; break; } }
    const pz = new Panzer(hx - hw - 30, hz, -PI / 2); pz.goal = pz.pos.clone(); pz.think0 = 0;
    const so = new Soldier('A', 'rifle', hx + hw + 8, hz, { state: 'cover', stationary: true }); allies.includes(so) || allies.push(so);
    let boom = 0; const ex0 = explode; explode = function (pt, ...a) { if (pt.distanceTo(so.pos) < 7) boom++; return ex0(pt, ...a); };
    const step = s => { for (let i = 0; i < s * 30; i++) { GAME.time += 1 / 30; pz.update(1 / 30); updateTimers(1 / 30); } };
    pz.reload = 0; step(12);
    ok('Omaha: Panzer non vede il fante dietro la casa', !pz.target && boom === 0 && so.alive, 'esplosioni vicine ' + boom);
    H.on = false; pz.reload = 0; step(12); H.on = true;
    ok('Omaha: senza la casa lo vede e spara', boom > 0 || !so.alive, 'esplosioni vicine ' + boom);
    R.push('debug '+[!!pz.target, pz.tlWhy, JSON.stringify((pz._tlc&&pz._tlc.get(so)||{}).why), pz.pos.distanceTo(so.pos).toFixed(0)]); explode = ex0; return R.join('\n');
  }));
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 3).join(' | ') : 'nessun errore JavaScript'); await b.close();
})();
