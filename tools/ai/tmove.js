// test dell'AAA Movement Lab (controller sperimentale, solo nella tech demo)
// node tools/ai/tmove.js   — la fisica si fa avanzare chiamando updatePlayer(dt) con tasti simulati
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  // 18. gioco originale: il controller sperimentale non è attivo e il movimento originale non cambia
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(800);
  const O = await p.evaluate(() => { GAME.running = false; P.inBoat = false; P.mode = 'foot'; P.dead = false; const x = 30, z = -60; P.pos.set(x, Hf(x, z), z); P.vel.set(0, 0, 0); P.yaw = 0; P.stance = 0; for (const k in KEYS) KEYS[k] = false; KEYS.KeyW = true; for (let i = 0; i < 60; i++) updatePlayer(1 / 60); KEYS.KeyW = false; return { active: xpcActive(), on: XPC.on, d: Math.hypot(P.pos.x - x, P.pos.z - z), stats: XPC.stats.n }; });
  ok('mappa originale: controller sperimentale spento, movimento originale invariato', !O.active && O.stats === 0 && O.d > 1.5, `percorsi ${O.d.toFixed(2)} m in 1 s con il controller originale`);
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  // 1. avvio del Movement Lab nella tech demo
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1500);
  ok('tech demo: Movement Lab attivo con 10 prove e ostacoli', await p.evaluate(() => xpcActive() && XPC_COURSE.length === 10 && XPC.obstacles.length >= 4));
  const R = await p.evaluate(() => {
    GAME.running = false; const out = {}, keys = k => { for (const x in KEYS) KEYS[x] = false; for (const x of k) KEYS[x] = true; };
    const run = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) updatePlayer(dt); };
    const at = n => { for (const x in KEYS) KEYS[x] = false; xpcGoto(n); run(5); };
    const spd = () => Math.hypot(P.vel.x, P.vel.z);
    // A. accelerazione e frenata
    at('A'); keys(['KeyW']); let t = 0; while (spd() < XPC.cfg.walk * .95 && t < 120) { run(1); t++; } out.acc = t / 60; run(60); out.vmax = spd();
    keys([]); t = 0; while (spd() > .05 && t < 120) { run(1); t++; } out.dec = t / 60;
    // B. diagonale normalizzata e inversione
    at('B'); keys(['KeyW', 'KeyD']); run(90); out.diag = spd(); keys(['KeyS']); run(6); out.revSpd = spd(); run(60);
    // 15. frame rate variabile: stessa distanza a 30 e a 144 fps
    const dist = dt => { at('A'); keys(['KeyW']); const x0 = P.pos.x, z0 = P.pos.z; run(Math.round(1.5 / dt), dt); keys([]); return Math.hypot(P.pos.x - x0, P.pos.z - z0); };
    out.d30 = dist(1 / 30); out.d144 = dist(1 / 144); out.d60 = dist(1 / 60);
    // 3. scatto e fiato
    at('I'); P.stamina = 1; keys(['KeyW', 'ShiftLeft']); run(60); out.sprint = spd(); out.winded = false; for (let i = 0; i < 520; i++) { run(1); if (P.winded) out.winded = true; } keys([]); run(240); out.recov = P.stamina;
    // 4–5. posture e soffitto (trave bassa C a 1,25 m)
    at('C'); keys([]); P.stance = 1; run(90); out.hCrouch = XPC.st.height; P.stance = 2; run(90); out.hProne = XPC.st.height; P.stance = 0; run(90); out.hStand = XPC.st.height;
    P.stance = 1; run(90); const bm = XPC.obstacles[4].s; P.pos.x = (bm.min.x + bm.max.x) / 2; P.pos.z = (bm.min.z + bm.max.z) / 2; P.pos.y = Hf(P.pos.x, P.pos.z); run(5); const under = P.pos.x > bm.min.x - .3 && P.pos.x < bm.max.x + .3;
    P.stance = 0; run(30); out.ceilBlocked = XPC.st.stance !== 0 && /soffitto/.test(XPC.st.blocked); out.underBeam = under; out.beamX = P.pos.x; out.dbg = [bm.min.x, bm.max.x, bm.min.y, bm.max.y, P.pos.y, XPC.st.stance, XPC.st.blocked].map(v => typeof v === 'number' ? +v.toFixed(2) : v).join(' ');
    // 6. inclinazione vicino a un muro: la camera non entra nel solido
    at('D'); keys(['KeyE']); run(60); camera.updateMatrixWorld(); out.leanCamInSolid = !!pointInSolid(camera.position); out.leanFree = XPC.st.leanFree; out.lean = XPC.st.lean; keys([]); run(60);
    at('D'); keys(['KeyQ']); run(60); out.leanOpen = XPC.st.lean * XPC.st.leanFree; keys([]); run(60);
    // 8. scavalcamento del muretto (E) e 9. arrampicata sul piano (F)
    at('E'); keys(['KeyW']); run(25); KEYS.Space = true; run(1); out.vaultKind = XPC.vault && XPC.vault.kind; out.vaultMsg = XPC.st.vault; keys([]); run(60); out.vaultX = P.pos.x - XPC_COURSE.find(q => q.n === 'E').x;
    at('F'); keys(['KeyW']); run(20); KEYS.Space = true; run(1); out.mantleKind = XPC.vault && XPC.vault.kind; out.mantleMsg = XPC.st.vault; keys([]); run(80); out.mantleY = P.pos.y - Hf(P.pos.x, P.pos.z);
    // non si scavalca un muro della casa (troppo alto)
    at('J'); keys(['KeyW']); P.pos.x += 3; run(80); KEYS.Space = true; run(1); out.houseVault = !!XPC.vault; out.houseMsg = XPC.st.vault; keys([]); run(30);
    // 10. ADS: velocità ridotta, niente scatto in mira
    at('H'); P.adsHeld = true; keys(['KeyW', 'ShiftLeft']); run(60); out.adsSpd = spd(); out.adsSprint = P.sprint; P.adsHeld = false; keys([]); run(30);
    // 13. terreno irregolare: la camera è più liscia del terreno
    at('G'); keys(['KeyW']); let dc = 0, dg = 0, pc = null, pg = null; for (let i = 0; i < 180; i++) { run(1); const cy = XPC.st.eyeAbs, gy = P.pos.y; if (pc !== null) { dc += Math.abs((cy - pc) - (gy - pg)); dg += Math.abs(gy - pg); } pc = cy; pg = gy; } keys([]);
    out.camJitter = dc; out.groundVar = dg;
    // 14. scala della casa normanna
    const hs = AAA.pipeHouse; P.pos.set(hs.x + 5.45, hs.y + .25, hs.z - 2.32); P.vel.set(0, 0, 0); P.yaw = Math.PI / 2; XPC.st.eyeInit = 0; keys(['KeyW']); run(420); keys([]); out.stairY = P.pos.y - hs.y;
    // 7. collisioni: un muro della casa ferma il giocatore
    P.pos.set(hs.x + 2.4, Hf(hs.x + 2.4, hs.z + 6), hs.z + 6); P.vel.set(0, 0, 0); P.yaw = 0; keys(['KeyW']); run(240); keys([]); out.wallZ = P.pos.z - hs.z;
    // 11–12. camera e arma: oscillazione dei passi presente e regolabile, arma alimentata dai dati del controller
    at('A'); XPC.cfg.camFx = 1; keys(['KeyW']); run(60); let mn = 1e9, mx = -1e9; for (let i = 0; i < 60; i++) { run(1); const d = camera.position.y - XPC.st.eyeAbs; mn = Math.min(mn, d); mx = Math.max(mx, d); } out.bobOn = mx - mn;
    XPC.cfg.camFx = 0; mn = 1e9; mx = -1e9; for (let i = 0; i < 60; i++) { run(1); const d = camera.position.y - XPC.st.eyeAbs; mn = Math.min(mn, d); mx = Math.max(mx, d); } out.bobOff = mx - mn; XPC.cfg.camFx = 1; keys([]);
    out.wpnMove = P.moveK; out.ctrlMs = XPC.st.msAvg;
    // benchmark: costo di updatePlayer con il controller sperimentale e con quello originale, stessa scena
    const cost = on => { XPC.on = on; at('A'); keys(['KeyW']); const t0 = performance.now(); run(600); keys([]); return (performance.now() - t0) / 600; };
    out.costX = cost(true); out.costO = cost(false); XPC.on = true;
    // 16. reset dei parametri
    XPC.cfg.walk = 9; xpcPanelOpen(true); document.querySelector('#xpcPanel [data-a="reset"]').click(); out.reset = XPC.cfg.walk === XPC_DEFAULTS.walk; xpcPanelOpen(false);
    return out;
  });
  ok('A: accelerazione progressiva e frenata credibile', R.acc > .1 && R.acc < .6 && R.dec > .1 && R.dec < .6 && Math.abs(R.vmax - 3.9) < .1, `0→95% in ${R.acc.toFixed(2)} s, arresto in ${R.dec.toFixed(2)} s, ${R.vmax.toFixed(2)} m/s`);
  ok('B: diagonale normalizzata, inversione con frenata', Math.abs(R.diag - 3.9) < .1 && R.revSpd < 3.5, `diagonale ${R.diag.toFixed(2)} m/s, dopo 0,1 s di inversione ${R.revSpd.toFixed(2)} m/s`);
  ok('frame rate variabile: stessa distanza a 30 e 144 fps', Math.abs(R.d30 - R.d144) / R.d144 < .03, `${R.d30.toFixed(2)} m contro ${R.d144.toFixed(2)} m (60 fps: ${R.d60.toFixed(2)})`);
  ok('I: scatto, fiato esaurito e recupero', R.sprint > 6.5 && R.winded && R.recov > .3, `scatto ${R.sprint.toFixed(2)} m/s, recupero ${(R.recov * 100).toFixed(0)}%`);
  ok('C: posture con altezze del collider', Math.abs(R.hCrouch - 1.18) < .03 && Math.abs(R.hProne - .55) < .03 && Math.abs(R.hStand - 1.72) < .03, `${R.hStand.toFixed(2)} / ${R.hCrouch.toFixed(2)} / ${R.hProne.toFixed(2)} m`);
  ok('C: sotto la trave non ci si alza (verifica del soffitto)', R.ceilBlocked, `x ${R.beamX.toFixed(2)}, sotto la trave: ${R.underBeam} [${R.dbg}]`);
  ok('D: inclinazione contro il muro limitata, camera fuori dai solidi', !R.leanCamInSolid && R.leanFree < .9 && Math.abs(R.leanOpen) > .9, `spazio verso il muro ${(R.leanFree * 100).toFixed(0)}%, lato libero ${(R.leanOpen * 100).toFixed(0)}%`);
  ok('E: scavalcamento del muretto', R.vaultKind === 'scavalcamento' && R.vaultX > .9, `${R.vaultMsg}; finito ${R.vaultX.toFixed(2)} m oltre il punto E`);
  ok('F: arrampicata sul piano da 1,5 m', R.mantleKind === 'arrampicata' && R.mantleY > 1.3, `${R.mantleMsg}; quota finale ${R.mantleY.toFixed(2)} m sul terreno`);
  ok('nessuno scavalcamento dei muri della casa', !R.houseVault, R.houseMsg);
  ok('H: in mira velocità ridotta e niente scatto', !R.adsSprint && R.adsSpd < 3, `${R.adsSpd.toFixed(2)} m/s`);
  ok('G: terreno irregolare, camera senza scatti', R.camJitter < R.groundVar * .6 + .05, `scarti camera ${R.camJitter.toFixed(3)} contro dislivelli ${R.groundVar.toFixed(3)}`);
  ok('J: la scala della casa si sale', Math.abs(R.stairY - 2.835) < .05, `quota ${R.stairY.toFixed(2)} m`);
  ok('collisioni: il muro della casa ferma il giocatore', Math.abs(R.wallZ - 3.66) < .1, `z ${R.wallZ.toFixed(2)}`);
  ok('camera: oscillazione dei passi, disattivabile per accessibilità', R.bobOn > .02 && R.bobOff < .005, `${(R.bobOn * 100).toFixed(1)} cm contro ${(R.bobOff * 100).toFixed(2)} cm`);
  ok('arma alimentata dal controller (velocità → moto dell\'arma)', R.wpnMove > .5);
  ok('costo del controller per fotogramma', R.ctrlMs < 1, `${R.ctrlMs.toFixed(3)} ms in media (SwiftShader)`);
  ok('reset dei parametri ai valori predefiniti', R.reset);
  ok('benchmark: updatePlayer con controller sperimentale e originale', R.costX > 0 && R.costO > 0, `sperimentale ${R.costX.toFixed(3)} ms, originale ${R.costO.toFixed(3)} ms per fotogramma (SwiftShader, CPU)`);
  // 17. ritorno al menù
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(2000);
  ok('ritorno al menù: controller sperimentale spento', await p.evaluate(() => !xpcActive() && !GAME.started));
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
