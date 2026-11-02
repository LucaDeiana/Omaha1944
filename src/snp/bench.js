"use strict";
// ============================================================
//  Benchmark della modalità cecchini (Ctrl+Maiusc+B in partita, oppure snpBench() dalla console).
//  Scenari: nessun bot, 4, 8, 12 bot, molti spari, killcam attiva. Per ognuno: FPS medi e 1% low,
//  tempo per fotogramma, draw call, raggi di collisione per fotogramma, tempo dell'IA, memoria.
//  Funziona anche sul codice precedente (la killcam viene saltata se manca).
// ============================================================
async function snpBench(secs = 12) {
  if (SCEN !== 'snp' || window.__snpBenchOn) return; window.__snpBenchOn = true;
  const ri = renderer.info, auto0 = ri.autoReset; ri.autoReset = false;
  const C = { ai: 0, rays: 0 }, wrap = (n, f) => { const o = window[n]; window[n] = function () { const t = performance.now(); const r = o.apply(this, arguments); f(performance.now() - t); return r; }; return o; };
  const oAI = wrap('updateAI', ms => C.ai += ms), oRS = wrap('raySolids', () => C.rays++), oRT = wrap('rayTerrain', () => C.rays++);
  const god0 = MISSION.godT; const res = [];
  const setBots = n => { SNPCFG.bots = n; SNPCFG.fill = false; for (const t of ['A', 'E']) { const l = snpTeamBots(t); for (let i = n; i < l.length; i++) { l[i].alive = false; l[i].removed = true; l[i].body.removed = true; SNP.board.delete(l[i].name); } } snpBalance(); };
  const SC = [['Partita senza bot', 0], ['Partita con 4 bot', 2], ['Partita con 8 bot', 4], ['Partita con 12 bot', 6], ['Numerosi spari (12 bot)', 6, 'fire'], ['Killcam attiva (12 bot)', 6, 'kc']];
  for (const [name, nPer, extra] of SC) {
    setBots(nPer); MISSION.godT = 1e9;
    let kcOk = false;
    if (extra === 'kc' && typeof snpKcBegin === 'function') { const b = snpTeamBots(PT === 'A' ? 'E' : 'A')[0]; if (b) { SNP2.lastDeath = { k: b.name, kt: b.team, zone: 'head', w: b.wid, dist: 100, t: GAME.time - .5 }; KC.shots.push({ t: GAME.time - .6, n: b.name, from: b.eyeP(new V3()), end: P.pos.clone(), v: SNP.me, zone: 'head' }); snpKcBegin(); kcOk = SNP2.kc && SNP2.kc.on; } }
    const ft = [], calls = [], ai = [], rays = []; let last = performance.now(), t0 = last, fT = 0;
    await new Promise(done => { const step = now => { const dt = now - last; last = now;
      if (now - t0 > 1500) { ft.push(dt); calls.push(ri.render.calls); ai.push(C.ai); rays.push(C.rays); }
      ri.reset(); C.ai = 0; C.rays = 0;
      if (extra === 'fire' && (fT += dt) > 120) { fT = 0; for (const t of ['A', 'E']) for (const b of snpTeamBots(t)) if (b.alive && Math.random() < .5) { b.fireCD = 0; b.mag = Math.max(1, b.mag); b.tgt = b.tgt || null; try { b.shoot(); } catch (e) { } } }
      if (extra === 'kc' && SNP2.kc && SNP2.kc.on) { snpKcTick(dt / 1000); if (SNP2.kc.rt > SNP2.kc.re - .3) SNP2.kc.rt = SNP2.kc.rs; }
      if (now - t0 < secs * 1000) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    if (extra === 'kc' && typeof snpKcEnd === 'function') snpKcEnd();
    const s = ft.slice().sort((a, b) => a - b), mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), worst = s.slice(Math.floor(s.length * .99)), avgFt = mean(ft);
    res.push({ name: name + (extra === 'kc' && !kcOk ? ' (killcam assente)' : ''), bots: snpTeamBots('A').length + snpTeamBots('E').length, fps: +(1000 / avgFt).toFixed(1), low1: +(1000 / (mean(worst) || 1)).toFixed(1), ft: +avgFt.toFixed(2), calls: Math.round(mean(calls)), rays: Math.round(mean(rays)), aiMs: +mean(ai).toFixed(2), memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
  }
  window.updateAI = oAI; window.raySolids = oRS; window.rayTerrain = oRT; ri.autoReset = auto0; MISSION.godT = god0; window.__snpBenchOn = false;
  const txt = 'Scenario | bot | FPS medi | 1% low | ms/fot | draw call | raggi/fot | ms IA | memoria MB\n' + res.map(r => `${r.name} | ${r.bots} | ${r.fps} | ${r.low1} | ${r.ft} | ${r.calls} | ${r.rays} | ${r.aiMs} | ${r.memMB}`).join('\n');
  console.log('BENCHMARK CECCHINI\n' + txt); try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) { }
  let el = $('benchOut'); if (!el) { el = document.createElement('pre'); el.id = 'benchOut'; el.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:70;background:rgba(10,12,10,.92);color:#efe6cf;font:13px/1.5 monospace;padding:16px 20px;border:1px solid #e8c46a;white-space:pre;pointer-events:auto;cursor:pointer'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.textContent = 'BENCHMARK CECCHINI (copiato negli appunti · clic per chiudere)\n\n' + txt;
  return res;
}
addEventListener('keydown', e => { if (e.code === 'KeyB' && e.ctrlKey && e.shiftKey && SCEN === 'snp') { e.preventDefault(); snpBench(); } });
