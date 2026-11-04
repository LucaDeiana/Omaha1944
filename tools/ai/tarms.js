// test delle braccia con scheletro in prima persona (solo tech demo) — node tools/ai/tarms.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  // gioco originale: nessuna braccia con scheletro
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const O = await p.evaluate(async () => { await Promise.all(Object.values(WGLB.loading)); GAME.running = false; P.inv[0] = { id: 'garand', mag: 8, res: 40 }; P.cur = 0; P.mode = 'foot'; P.dead = false; P.inBoat = false; for (let k = 0; k < 3; k++) updateViewmodel(1 / 60); return { loaded: !!window.FPA_GLB || FPA.ready, fpa: !!(vmCur && vmCur.fpa), rig: !!scene.getObjectByName('fpa_rig') }; });
  ok('mappa originale: braccia originali, rig sperimentale non caricato', !O.loaded && !O.fpa && !O.rig, JSON.stringify(O));
  await Promise.all([p.waitForNavigation(), p.evaluate(() => setTimeout(() => location.reload(), 50))]); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 150 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(800);
  const R = await p.evaluate(async () => {
    await Promise.all(Object.values(WGLB.loading)); await FPA.loading; GAME.running = false; const out = {};
    let skins = 0, bones = new Set(); FPA.rig.traverse(o => { if (o.isSkinnedMesh) { skins++; for (const bn of o.skeleton.bones) bones.add(bn.uuid); } });
    out.rig = { skins, bones: bones.size, tris: Math.round(FPA.tris), man: FPA.man.validazione.errori.length };
    const step = (n = 6, dt = 1 / 60) => { for (let k = 0; k < n; k++) updateViewmodel(dt); };
    const errs = () => ['R', 'L'].map(s => { const sd = FPA.sides[s]; return sd.B.hand.getWorldPosition(new V3()).distanceTo(sd.last.W); });
    const target = s => { const sd = FPA.sides[s]; return sd.last.W.distanceTo(FPA.sides[s].B.upperarm.getWorldPosition(new V3())) / ((sd.la + sd.lb) * FPA_SCALE); };
    // impugnatura e IK su tutte le armi (fianco e mira)
    out.weap = {};
    for (const id of Object.keys(FPA_KIND)) {
      if (!WGLB.data[id]) continue; P.inv[0] = { id, mag: WEAPONS[id].mag, res: 40 }; P.cur = 0; P.reloadT = 0; P.adsK = 0; step();
      const e0 = Math.max(...errs()), reachR = target('R'), reachL = target('L'); P.adsK = 1; step(); const e1 = Math.max(...errs());
      // gomito sotto la linea spalla–polso (posa naturale)
      const sd = FPA.sides.R, S = sd.B.upperarm.getWorldPosition(new V3()), E = sd.B.forearm.getWorldPosition(new V3()), W = sd.last.W, mid = S.clone().lerp(W, .5);
      const down = camera.worldToLocal(E.clone()).y < camera.worldToLocal(mid.clone()).y + .02;
      out.weap[id] = { fpa: vmCur.fpa, e: +Math.max(e0, e1).toFixed(4), reach: +Math.max(reachR, reachL).toFixed(2), down };
      P.adsK = 0;
    }
    // dita: grilletto e tempi sfalsati
    P.inv[0] = { id: 'garand', mag: 8, res: 40 }; P.cur = 0; step(30);
    const c0 = FPA.sides.R.curl.index; P.trigger = true; step(3); const c1 = FPA.sides.R.curl.index, cm = FPA.sides.R.curl.middle; P.trigger = false; step(30);
    out.trigger = { prima: +c0.toFixed(2), premuto: +c1.toFixed(2) };
    P.reloadT = P.reloadDur = 2.3; step(2); const L = FPA.sides.L.curl; out.stagger = Math.abs(L.index - L.pinky) > .02;
    // ricarica: la mano sinistra segue l'animazione dell'arma (clip) e afferra
    let dmax = 0; for (let k = 0; k < 60; k++) { P.reloadT = Math.max(.01, P.reloadT - 1 / 60); step(1); dmax = Math.max(dmax, FPA.sides.L.last.W.distanceTo(vmCur.group.localToWorld(vmCur.fore.clone()))); }
    out.reloadMove = +dmax.toFixed(3); out.reloadGrab = FPA.sides.L.curl.thumb > .7; P.reloadT = 0; step(30);
    // rinculo: le mani restano sulla presa (l'arma rincula, le braccia la seguono: nessun rinculo applicato due volte)
    P.recoil = 1; P.flashT = .04; step(2); out.recoilErr = +Math.max(...errs()).toFixed(4); P.recoil = 0; P.flashT = 0; step(10);
    // scavalcamento: la mano sinistra lascia l'arma
    XPC.vault = { kind: 'scavalcamento', t: 0, dur: 99, a: P.pos.clone(), top: P.pos.clone(), b: P.pos.clone() }; step(20);
    out.vaultRelease = +FPA.sides.L.last.W.distanceTo(vmCur.group.localToWorld(vmCur.fore.clone())).toFixed(3); XPC.vault = null; step(20);
    // scatto, posture, inclinazione: niente NaN, mani sempre sull'arma
    let nan = false, maxE = 0;
    for (const [k, v] of [['sprint', 1], ['crouch', 1], ['prone', 1], ['lean', 1]]) {
      if (k === 'sprint') { P.sprint = true; P.sprintK = 1; } if (k === 'crouch') P.stance = 1; if (k === 'prone') { P.stance = 2; P.crawlK = 1; } if (k === 'lean') { XPC.st.lean = 1; }
      step(15); for (const s of ['R', 'L']) { const q = FPA.sides[s].B.hand.quaternion; if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) nan = true; } maxE = Math.max(maxE, ...errs());
      P.sprint = false; P.sprintK = 0; P.stance = 0; P.crawlK = 0; XPC.st.lean = 0;
    }
    out.states = { nan, maxE: +maxE.toFixed(4) };
    // cambio arma: il rig non si duplica e segue la nuova arma
    P.inv[0] = { id: 'thompson', mag: 30, res: 60 }; P.cur = 0; P.switchT = .4; step(40); let rigs = 0; scene.traverse(o => { if (o.name === 'fpa_rig') rigs++; });
    out.switch = { rigs, fpa: vmCur.fpa, e: +Math.max(...errs()).toFixed(4) };
    // le matrici dello scheletro cambiano tra due fotogrammi (skinning vivo anche con info.autoReset spento)
    const sk = FPA.skins[0]; const m0 = sk.boneMatrices.slice(); P.adsK = .5; step(4); P.adsK = 0; out.skinLive = sk.boneMatrices.some((v, i) => Math.abs(v - m0[i]) > 1e-5);
    out.ms = +FPA.stats.ms.toFixed(3);
    // Arms Lab
    falOpen(true); const btn = a => document.querySelector(`#falPanel [data-a="${a}"]`); btn('skel').click(); btn('wire').click(); const helper = !!FAL.helper; btn('wire').click(); btn('skel').click();
    fpaCalibrate('thompson', 'L', 'x', .01); out.lab = { helper, calib: JSON.parse(localStorage.getItem('fpa_calib')).thompson.L.x === .01 }; fpaCalibrate('thompson', 'L', 'x', 0); falRender(); falOpen(false);
    return out;
  });
  ok('rig: 2 SkinnedMesh per braccio, 44 ossa, GLB validato', R.rig.bones === 44 && R.rig.skins >= 6 && R.rig.man === 0, JSON.stringify(R.rig));
  for (const id in R.weap) { const w = R.weap[id]; ok(`impugnatura e IK: ${id}`, w.fpa && w.e < .01 && w.reach < 1.001 && w.down, `errore polso ${(w.e * 1000).toFixed(1)} mm, estensione ${Math.round(w.reach * 100)}%, gomito in basso: ${w.down}`); }
  ok('dito sul grilletto: si chiude allo sparo', R.trigger.premuto > R.trigger.prima + .1, JSON.stringify(R.trigger));
  ok('dita con tempi sfalsati (non un blocco unico)', R.stagger);
  ok('ricarica: la mano sinistra segue l\'animazione e afferra', R.reloadMove > .05 && R.reloadGrab, `spostamento massimo ${R.reloadMove} m`);
  ok('rinculo: mani sempre sulla presa (nessun rinculo doppio)', R.recoilErr < .005, `${R.recoilErr} m`);
  ok('scavalcamento: la mano sinistra lascia l\'arma', R.vaultRelease > .1, `${R.vaultRelease} m dall'astina`);
  ok('scatto, accovacciato, prono, inclinazione: pose valide', !R.states.nan && R.states.maxE < .01, JSON.stringify(R.states));
  ok('cambio arma: un solo rig, nuova impugnatura', R.switch.rigs === 1 && R.switch.fpa && R.switch.e < .01, JSON.stringify(R.switch));
  ok('skinning aggiornato a ogni fotogramma', R.skinLive);
  ok('costo IK + dita per fotogramma', R.ms < 2, `${R.ms} ms (SwiftShader, CPU)`);
  ok('Arms Lab: scheletro, wireframe, calibrazione salvata', R.lab.helper && R.lab.calib);
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
