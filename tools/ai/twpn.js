// test del rifacimento visivo delle armi (M1 Garand dalla pipeline Blender) nella mappa originale e nella demo
// node tools/ai/twpn.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  const W0 = await p.evaluate(() => JSON.stringify(WEAPONS.garand));
  // mappa originale Omaha
  await p.evaluate(async () => { $('optMap').value = 'omaha'; await startGame(); }); for (let i = 0; i < 90 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  await p.waitForTimeout(1000);
  const L = await p.evaluate(async () => { const D = await WGLB.loading.garand; return D ? { kb: D.kb, ms: D.ms, tri: D.man.triangoli, mats: D.mats.size, tex: D.tex.size, err: D.man.validazione.errori.length } : null; });
  ok('GLB del Garand caricato in background nella mappa originale', L && L.err === 0, L && `${L.kb} KB, ${L.ms} ms, FP ${L.tri.FP} / TP ${L.tri.TP} / WD ${L.tri.WD} triangoli, ${L.mats} materiali, ${L.tex} texture`);
  const S = await p.evaluate(() => {
    GAME.running = false; P.inv[0] = { id: 'garand', mag: 8, res: 40 }; P.cur = 0; P.switchT = 0; P.reloadT = 0; P.mode = 'foot'; P.dead = false; P.carry = null;
    const r = {}; P.adsK = 1; P.moveK = 0; P.recoil = 0; for (let k = 0; k < 3; k++) updateViewmodel(1 / 60);
    r.hq = vmCur && vmCur.hq; vmCur.group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const a = vmCur.group.localToWorld(vmCur.rear.clone()).project(camera), f = vmCur.group.localToWorld(vmCur.front.clone()).project(camera);
    r.ads = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(f.x), Math.abs(f.y));
    // ciclo dell'otturatore allo sparo
    P.adsK = 0; const z0 = vmCur.parts.bolt.position.z; STATS.shots++; updateViewmodel(1 / 60); updateViewmodel(.03); r.cyc = vmCur.parts.bolt.position.z - z0; for (let k = 0; k < 20; k++) updateViewmodel(1 / 60); r.back = vmCur.parts.bolt.position.z - z0;
    // clip vuota: otturatore aperto e clip nascosta; espulsione della clip
    P.inv[0].mag = 0; updateViewmodel(1 / 60); r.lock = vmCur.parts.bolt.position.z - z0; r.clipHidden = !vmCur.mag.visible;
    wglbEjectClip(); r.clipFx = !!(WGLB.clipFx && WGLB.clipFx.obj.visible); const y0 = WGLB.clipFx.obj.position.y; for (let k = 0; k < 10; k++) wglbClipFx(1 / 60); r.clipUp = WGLB.clipFx.obj.position.y > y0;
    // ricarica: clip dall'alto, rilascio dell'otturatore alla fine
    P.reloadT = P.reloadDur = 2.3; P.inv[0].mag = 8; updateViewmodel(.1); r.reloadOpen = vmCur.parts.bolt.position.z - z0;
    P.reloadT = .05; updateViewmodel(1 / 60); r.reloadEnd = vmCur.parts.bolt.position.z - z0; P.reloadT = 0;
    // ispezione
    wglbInspect(); r.it = WGLB.inspectT; updateViewmodel(.6); updateViewmodel(.4); r.inspect = Math.abs(vmCur.group.rotation.y) > .3; r.ry = vmCur.group.rotation.y; WGLB.inspectT = 0;
    return r;
  });
  ok('prima persona: modello Blender in uso', S.hq === 'm1garand');
  ok('ADS calcolato dai punti dell\'arma: diottra e mirino al centro dello schermo', S.ads < .002, `scarto massimo ${S.ads.toFixed(5)} (coordinate normalizzate)`);
  ok('sparo: otturatore e asta arretrano e tornano in batteria', S.cyc > .02 && Math.abs(S.back) < .001, `corsa ${S.cyc.toFixed(3)} m, ritorno ${S.back.toFixed(4)}`);
  ok('clip vuota: otturatore aperto, clip espulsa verso l\'alto', S.lock > .06 && S.clipHidden && S.clipFx && S.clipUp);
  ok('ricarica: otturatore aperto durante l\'inserimento, chiuso alla fine', S.reloadOpen > .06 && Math.abs(S.reloadEnd) < .01, `${S.reloadOpen.toFixed(3)} → ${S.reloadEnd.toFixed(3)}`);
  ok('ispezione dell\'arma (J)', S.inspect, `inspectT ${S.it}, rotazione ${S.ry && S.ry.toFixed(2)}`);
  const T = await p.evaluate(() => { const g = gunGeo('A', 'rifle'), w = wglbGun('garand', 'WD'); return { tp: g ? g.index.count / 3 : 0, colors: g && !!g.attributes.color, wd: !!w, pk: (() => { const pk = spawnPickup('garand', new V3(P.pos.x + 2, 0, P.pos.z)); let hq = false; pk.mesh.traverse(c => { if (c.isMesh && /wood|steel/.test(c.material.name)) hq = true; }); removePickup(pk); return hq; })() }; });
  ok('terza persona: geometria unita dei soldati dal modello TP', T.tp > 3000 && T.tp < 7000 && T.colors, `${Math.round(T.tp)} triangoli`);
  ok('arma a terra: modello WD con materiali PBR', T.wd && T.pk);
  ok('fallback: senza il GLB si usa il modello procedurale', await p.evaluate(() => { const D = WGLB.data.garand; delete WGLB.data.garand; const i = buildViewmodel('garand'); const proc = !i.hq; i.group.parent.remove(i.group); WGLB.data.garand = D; return proc; }));
  const O = await p.evaluate(() => {
    const out = {};
    for (const id of ['thompson', 'mp40', 'kar98']) {
      P.inv[0] = { id, mag: WEAPONS[id].mag, res: 60 }; P.cur = 0; P.reloadT = 0; P.boltT = 0; P.adsK = 1; for (let k = 0; k < 3; k++) updateViewmodel(1 / 60);
      const r = { hq: vmCur.hq }; vmCur.group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const a = vmCur.group.localToWorld(vmCur.rear.clone()).project(camera), f = vmCur.group.localToWorld(vmCur.front.clone()).project(camera);
      r.ads = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(f.x), Math.abs(f.y)); P.adsK = 0;
      if (WGLB.mech[id].type === 'openbolt') { const z0 = vmCur.parts.bolt.position.z; STATS.shots++; updateViewmodel(1 / 60); updateViewmodel(.03); r.mech = Math.abs(vmCur.parts.bolt.position.z - z0) > .02; WGLB.cyc = 0; updateViewmodel(1 / 60); }
      else { P.boltT = .5; updateViewmodel(1 / 60); r.mech = vmCur.bolt.rotation.z > .3 && vmCur.bolt.position.z > .04; P.boltT = 0; updateViewmodel(1 / 60); }
      const tp = gunGeo(id === 'kar98' ? 'E' : id === 'mp40' ? 'E' : 'A', id === 'kar98' ? 'rifle' : 'smg'); r.tp = tp ? Math.round(tp.index.count / 3) : 0;
      out[id] = r;
    }
    return out;
  });
  for (const id in O) ok(`${id}: modello Blender, ADS dalle mire, meccanica, terza persona`, O[id].hq && O[id].ads < .002 && O[id].mech && O[id].tp > 800, JSON.stringify(O[id]));
  ok('danni, balistica, munizioni e tempi del Garand invariati', await p.evaluate(() => JSON.stringify(WEAPONS.garand)) === W0);
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
