"use strict";
// ============================================================
//  GRAPHICS BENCHMARK LAB 1.0 — misura delle prestazioni della tech demo «AAA Graphics Test» (solo SCEN 'aaa').
//  · F8: overlay discreto (FPS smussati e medi, frame time medio e massimo, 1% low, draw call, triangoli, geometrie,
//    texture, memoria JS, caricamento, preset, risoluzione interna, budget dei 20 ms, grafico degli ultimi 60 s).
//  · F9: pannello del laboratorio (metriche, benchmark sul percorso A–H, preset, isolamento degli effetti, risultati,
//    confronto, esportazione JSON/CSV, foto di confronto, diagnostica, test di accumulo delle risorse).
//  Metodo: tempo del fotogramma OSSERVATO = intervallo fra due fotogrammi consecutivi (requestAnimationFrame);
//  tempo CPU = durata del lavoro del fotogramma in JavaScript (aggiornamento + invio dei comandi di disegno);
//  tempo GPU = solo con EXT_disjoint_timer_query_webgl2 disponibile (interrogazioni asincrone), altrimenti «non disponibile».
//  1% low = 1000 / media del 1% dei fotogrammi più lenti (almeno 100 campioni), non l'FPS minimo.
// ============================================================
const LAB = {
  N: 8192, ft: new Float32Array(8192), cpu: new Float32Array(8192), ts: new Float64Array(8192), n: 0, i: 0, last: 0, t0: 0, smooth: 0,
  orig: {}, info: { calls: 0, tri: 0 }, ov: false, panel: false, run: null, runs: [], feat: {}, gpu: null, lastUi: 0, cost: 0, budget: 20,
};
// ---------- statistica ----------
function labStats(arr) {
  const a = Array.from(arr).filter(v => v > 0 && Number.isFinite(v)); const n = a.length; if (!n) return null;
  a.sort((x, y) => x - y); const sum = a.reduce((s, v) => s + v, 0), mean = sum / n, q = p => a[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n), k = Math.max(1, Math.floor(n * .01)), worst = a.slice(n - k), wMean = worst.reduce((s, v) => s + v, 0) / k;
  return { n, mean, median: q(.5), min: a[0], max: a[n - 1], p95: q(.95), p99: q(.99), sd, fps: 1000 / mean, low1: n >= 100 ? 1000 / wMean : null, over20: a.filter(v => v > 20).length / n };
}
// ---------- tempo GPU (se il driver lo espone) ----------
function labGpuInit() {
  if (LAB.gpu !== null) return; const gl = renderer.getContext(); const ext = gl.getExtension && (gl.getExtension('EXT_disjoint_timer_query_webgl2'));
  LAB.gpu = ext && gl.createQuery ? { gl, ext, pending: [], last: null, ms: new Float32Array(1024), n: 0 } : false;
}
function labFrameStart(now) {
  if (SCEN !== 'aaa') return; LAB.fs = performance.now();
  if (LAB.last) { const dt = now - LAB.last; if (dt > 0 && dt < 2000) { LAB.ft[LAB.i] = dt; LAB.ts[LAB.i] = now; LAB.smooth = LAB.smooth ? LAB.smooth * .9 + dt * .1 : dt; LAB.cur = dt; } }
  LAB.last = now;
  renderer.info.autoReset = false; renderer.info.reset();
  const G = LAB.gpu; if (G) { const gl = G.gl; if (!G.active) { const q = gl.createQuery(); gl.beginQuery(G.ext.TIME_ELAPSED_EXT, q); G.active = q; } }
}
function labFrameEnd() {
  if (SCEN !== 'aaa' || !LAB.fs) return; const c = performance.now() - LAB.fs; LAB.cpu[LAB.i] = c; LAB.info.calls = renderer.info.render.calls; LAB.info.tri = renderer.info.render.triangles;
  if (LAB.last) { LAB.i = (LAB.i + 1) % LAB.N; LAB.n = Math.min(LAB.N, LAB.n + 1); }
  const G = LAB.gpu; if (G) { const gl = G.gl; if (G.active) { gl.endQuery(G.ext.TIME_ELAPSED_EXT); G.pending.push(G.active); G.active = null; }
    while (G.pending.length) { const q = G.pending[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; G.pending.shift(); const dis = gl.getParameter(G.ext.GPU_DISJOINT_EXT); if (!dis) { const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); G.last = ns / 1e6; G.ms[G.n++ % 1024] = G.last; } gl.deleteQuery(q); } }
  const t0 = performance.now();
  if (LAB.ov && t0 - LAB.lastUi > 250) { LAB.lastUi = t0; labOverlay(); }
  LAB.cost = LAB.cost * .95 + (performance.now() - t0) * .05;   // costo del profiler stesso
}
// ultimi «sec» secondi del buffer circolare
function labWindow(sec) { const out = [], cpu = [], now = performance.now(); for (let k = 0; k < LAB.n; k++) { const j = (LAB.i - 1 - k + LAB.N) % LAB.N; if (now - LAB.ts[j] > sec * 1000) break; out.push(LAB.ft[j]); cpu.push(LAB.cpu[j]); } return { ft: out, cpu }; }
// ---------- overlay F8 ----------
function labRes() { const s = new THREE.Vector2(); renderer.getDrawingBufferSize(s); return `${s.x}×${s.y}`; }
function labMem() { return performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'non disponibile'; }
function labOverlay() {
  let el = $('labOv'); if (!el) { el = document.createElement('div'); el.id = 'labOv'; el.style.cssText = 'position:fixed;right:10px;top:10px;z-index:70;width:300px;background:rgba(8,10,8,.72);color:#e8e6dc;font:11px/1.4 monospace;padding:6px 8px;border-left:3px solid #888;pointer-events:none'; el.innerHTML = '<div id="labOvT"></div><canvas id="labOvC" width="284" height="56" style="display:block;margin-top:4px"></canvas>'; document.body.appendChild(el); }
  el.style.display = LAB.ov ? 'block' : 'none'; if (!LAB.ov) return;
  const w10 = labStats(labWindow(10).ft), cpu = labStats(labWindow(10).cpu), G = LAB.gpu, gs = G ? labStats(G.ms.slice(0, Math.min(G.n, 1024))) : null, p5 = labStats(labWindow(5).ft);
  const persist = p5 && p5.p95 > LAB.budget, spike = !persist && p5 && p5.max > LAB.budget * 2;
  el.style.borderLeftColor = persist ? '#d0603a' : spike ? '#c8a040' : '#888';
  $('labOvT').innerHTML = `<b>LAB · ${AAA.preset}</b> · ${labRes()} · DPR ${devicePixelRatio}<br>` +
    `FPS ${(1000 / LAB.smooth).toFixed(0)} (smussati) · media 10 s ${w10 ? w10.fps.toFixed(1) : '—'}<br>` +
    `frame ${w10 ? w10.mean.toFixed(2) : '—'} ms · max ${w10 ? w10.max.toFixed(1) : '—'} · 1% low ${w10 && w10.low1 ? w10.low1.toFixed(1) : 'campioni insuff.'}<br>` +
    `CPU JS ${cpu ? cpu.mean.toFixed(2) + ' ms' : '—'} · GPU ${gs ? gs.mean.toFixed(2) + ' ms' : 'non disponibile'}<br>` +
    `draw ${LAB.info.calls} · tri ${(LAB.info.tri / 1e6).toFixed(2)} M · geo ${renderer.info.memory.geometries} · tex ${renderer.info.memory.textures}<br>` +
    `JS ${labMem()} · caricamento ${AAA.st.loadMs ? (AAA.st.loadMs / 1000).toFixed(1) + ' s' : 'n/d'} · profiler ${LAB.cost.toFixed(3)} ms<br>` +
    (persist ? '<span style="color:#f0905a">oltre il budget di 20 ms in modo persistente (P95 ultimi 5 s)</span>' : spike ? '<span style="color:#e0c070">picco isolato oltre 40 ms</span>' : 'entro il budget dei 20 ms (P95 ultimi 5 s)');
  labGraph($('labOvC'), labWindow(60).ft.reverse(), 50);
}
// grafico dei frame time (Canvas 2D), linee guida a 16,7 / 20 / 33,3 ms
function labGraph(cv, data, maxMs = 50) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, W, H);
  for (const [ms, c] of [[16.67, '#5a7a5a'], [20, '#a08a50'], [33.33, '#a05a4a']]) { const y = H - ms / maxMs * H; g.strokeStyle = c; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.setLineDash([]); if (!data.length) return; g.strokeStyle = '#e8e6dc'; g.beginPath(); const step = W / Math.max(1, data.length - 1);
  data.forEach((v, k) => { const x = k * step, y = H - Math.min(v, maxMs) / maxMs * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
}
// ---------- percorso del benchmark (punti verificati nella scena: porta della casa, cancello del cortile) ----------
function labPath() {
  const U = (u, v) => [AV.cx + u, AV.cz + v], A = AAA.defs.A, door = AV.cx + A.u + .5, fz = AV.cz + A.v + A.d / 2;
  // [x, z, altezza sul terreno, guarda x, z, altezza, peso del tratto, etichetta]
  return [
    [...U(-46, 36), 22, ...U(8, -12), 0, 0, 'A panoramica'],
    [...U(-40, avRoadV(-40) + .4), 1.65, ...U(-10, avRoadV(-10)), 1.2, 1.2, 'B strada'],
    [...U(4, avRoadV(4) - .4), 1.65, ...U(20, -5), 1.4, 1, 'B strada'],
    [...U(22, -15.3), 1.7, ...U(40, -18), 1.6, 1, 'C cortile'],
    [...U(34, -14), 1.7, ...U(37, -25), 2.5, .9, 'C cortile'],
    [...U(24, -15.3), 1.7, ...U(-14, -7), 3, .9, 'C cortile'],
    [door, fz + 7, 1.7, AV.cx + A.u, fz - 4, 3.2, 1.1, 'D facciata'],
    [door, fz + 1.5, 1.65, door, fz - 3, 1.5, .8, 'D facciata'],
    [door, fz - .2, 1.65, door - 2, fz - 4, 1.3, .5, 'E interno'],
    [door, fz - 2.6, 1.6, AV.cx + A.u - 5, fz - 4.4, 1, .9, 'E interno'],
    [door, fz - 2.6, 1.6, door + 3, fz - 4, 1.2, .6, 'E interno'],
    [door, fz + 1.5, 1.65, door, fz + 6, 1.4, .6, 'E interno'],
    [...U(-30, 23), 1.6, ...U(-20, 17.5), 1.3, 1.3, 'F bocage'],
    [...U(-12, 23.5), 1.6, ...U(2, 17), 1.4, 1, 'F bocage'],
    [...U(-3, 5.6), 1.7, ...U(2.5, 10.4), 1.2, 1, 'G Sherman'],
    [...U(9, 5), 1.6, ...U(2.5, 10.4), 1.1, .9, 'G Sherman'],
    [...U(60, -62), 26, ...U(0, -5), 0, 1.4, 'H vista finale'],
  ];
}
function labPose(t) {   // t in 0..1 lungo il percorso, interpolazione morbida fra i punti
  const P = labPath(), W = P.slice(1).map(p => p[6]), tot = W.reduce((a, b) => a + b, 0); let acc = 0, k = 0;
  for (; k < W.length - 1 && acc + W[k] < t * tot; k++) acc += W[k];
  const f = clamp((t * tot - acc) / W[k], 0, 1), s = f * f * (3 - 2 * f), a = P[k], b = P[k + 1];
  const x = lerp(a[0], b[0], s), z = lerp(a[1], b[1], s), h = lerp(a[2], b[2], s), lx = lerp(a[3], b[3], s), lz = lerp(a[4], b[4], s), lh = lerp(a[5], b[5], s);
  const y = Math.max(FLOORS.length ? worldFloor(x, z, Hf(x, z) + h) : -1e9, Hf(x, z)) + h;
  return { x, y, z, lx, ly: Math.max(FLOORS.length ? worldFloor(lx, lz, Hf(lx, lz) + 1) : -1e9, Hf(lx, lz)) + lh, lz, label: (f < .5 ? a : b)[7] };
}
// verifica del percorso: nessun punto della camera dentro un solido o sotto il terreno
function labCheckPath(n = 600) { let bad = 0; const v = new V3(); for (let i = 0; i <= n; i++) { const p = labPose(i / n); v.set(p.x, p.y, p.z); if (pointInSolid(v) || p.y < Hf(p.x, p.z) + .3) bad++; } return bad; }
// ---------- benchmark ----------
function labStart(o = {}) {
  if (LAB.run) return; const dur = o.dur || +($('labDur') && $('labDur').value) || 60, warm = o.warm ?? 4;
  LAB.run = { dur, warm, t0: performance.now(), ft: [], cpu: [], gpu: [], calls: [], tri: [], seg: {}, label: o.label || '', onEnd: o.onEnd || null, feat: Object.keys(LAB.feat).filter(k => LAB.feat[k]) };
  LAB.saved = { dyn: SETTINGS.dynres, scale: typeof DYN !== 'undefined' ? DYN.scale : 1, photo: AAA.photo, running: GAME.running };
  if (SETTINGS.dynres) { SETTINGS.dynres = false; if (typeof setRenderScale === 'function') setRenderScale(1); }   // risoluzione fissa: confronti fra preset leali
  AAA.bench = null; AAA.labCam = true; GAME.running = true; if ($('pause')) $('pause').classList.add('hidden'); if (typeof aaaHud === 'function') aaaHud(true);
  labUi();
}
function labRunFrame() {
  const R = LAB.run, t = (performance.now() - R.t0) / 1000; if (LAB.saved.ppos) { P.pos.copy(LAB.saved.ppos); P.vy = 0; } else LAB.saved.ppos = P.pos.clone();   // il giocatore resta fermo
  if (t < R.warm) { const p = labPose(0); camera.position.set(p.x, p.y, p.z); camera.lookAt(p.lx, p.ly, p.lz); return; }
  const k = (t - R.warm) / R.dur; if (k >= 1) return labStop(false);
  const p = labPose(k); camera.position.set(p.x, p.y, p.z); camera.lookAt(p.lx, p.ly, p.lz); camera.updateMatrixWorld();
  const j = (LAB.i - 1 + LAB.N) % LAB.N; if (t - R.warm > .1) { R.ft.push(LAB.ft[j]); R.cpu.push(LAB.cpu[j]); R.calls.push(LAB.info.calls); R.tri.push(LAB.info.tri); if (LAB.gpu && LAB.gpu.last) R.gpu.push(LAB.gpu.last); (R.seg[p.label] || (R.seg[p.label] = [])).push(LAB.ft[j]); }
}
function labStop(aborted) {
  const R = LAB.run; if (!R) return; LAB.run = null; AAA.labCam = false;
  SETTINGS.dynres = LAB.saved.dyn; GAME.running = document.pointerLockElement === renderer.domElement || LAB.panel; if (typeof aaaHud === 'function') aaaHud(false);
  if (aborted || R.ft.length < 30) { labUi('Benchmark interrotto: nessun risultato salvato (' + R.ft.length + ' fotogrammi).'); if (R.onEnd) R.onEnd(null); return; }
  const st = labStats(R.ft), cs = labStats(R.cpu), gs = R.gpu.length > 30 ? labStats(R.gpu) : null, avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const res = { id: Date.now(), data: new Date().toISOString(), build: labBuild(), preset: AAA.preset, label: R.label, durata: R.dur, fotogrammi: st.n, risoluzione: labRes(), dpr: devicePixelRatio, pr: renderer.getPixelRatio(),
    funzioni: labFeatures(), disattivate: R.feat, frame: labRound(st), cpu: cs ? labRound(cs) : null, gpu: gs ? labRound(gs) : 'non disponibile', drawCall: Math.round(avg(R.calls)), triangoli: Math.round(avg(R.tri)),
    tratti: Object.fromEntries(Object.entries(R.seg).map(([k, v]) => { const s = labStats(v); return [k, { fps: +s.fps.toFixed(1), p99: +s.p99.toFixed(2) }]; })), serie: R.ft.map(v => +v.toFixed(2)), ambiente: labEnv(), caricamentoMs: AAA.st.loadMs || null,
    mancanti: [gs ? null : 'tempo GPU (estensione EXT_disjoint_timer_query_webgl2 non disponibile)', performance.memory ? null : 'memoria JS', 'memoria GPU (WebGL non la espone)'].filter(Boolean) };
  LAB.runs.push(res); labSave(); labUi(`Benchmark concluso: ${st.fps.toFixed(1)} FPS medi, 1% low ${st.low1 ? st.low1.toFixed(1) : '—'}.`); if (R.onEnd) R.onEnd(res);
  window.LAB_LAST = res;
}
function labRound(s) { const o = {}; for (const k in s) o[k] = s[k] === null ? null : +(+s[k]).toFixed(k === 'n' ? 0 : 3); return o; }
function labBuild() { const s = [...document.scripts].map(x => x.src).find(x => /\?v=/.test(x)); return s ? s.split('?v=')[1] : 'n/d'; }
function labEnv() {
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), ua = navigator.userAgent;
  const browser = (ua.match(/(Edg|OPR|Chrome|Firefox|Version)\/[\d.]+/g) || []).pop() || 'n/d', os = (navigator.userAgentData && navigator.userAgentData.platform) || (/Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : 'n/d');
  return { browser, os, webgl: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1', gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'non esposto dal browser', schermo: `${screen.width}×${screen.height}`, finestra: `${innerWidth}×${innerHeight}` };
}
function labFeatures() { const PZ = AAA_PRESETS[AAA.preset]; return { ombre: !!(sun && sun.castShadow && !LAB.feat.ombre), ssao: !!(AAA.ssao && !LAB.feat.ao), bloom: !!(typeof bloomPass !== 'undefined' && bloomPass && bloomPass.enabled), post: !!(composer && !LAB.feat.post), erba: PZ.grass, terreno: PZ.terr, vegetazioneDettaglio: !LAB.feat.decor, foschia: !LAB.feat.fog, riflessi: !LAB.feat.refl }; }
function labSave() { try { localStorage.setItem('aaa_lab_runs', JSON.stringify(LAB.runs.map(r => Object.assign({}, r, { serie: r.serie.filter((_, i) => i % 2 === 0) })).slice(-40))); } catch (e) { } }
function labLoad() { try { LAB.runs = JSON.parse(localStorage.getItem('aaa_lab_runs') || '[]'); } catch (e) { LAB.runs = []; } }
// ---------- isolamento degli effetti (reversibile) ----------
const LAB_FEAT = {
  ombre: ['Ombre', on => { if (on) LAB.orig.cast = sun.castShadow; sun.castShadow = on ? false : LAB.orig.cast; if (!on && sun.castShadow) AAA.shadowDirty = 3; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }],
  ao: ['Occlusione ambientale (SSAO)', on => { if (!AAA.ssao || !composer) return; LAB.rp = LAB.rp || new THREE.RenderPass(scene, camera); const i = composer.passes.indexOf(on ? AAA.ssao : LAB.rp); if (i >= 0) composer.passes.splice(i, 1, on ? LAB.rp : AAA.ssao); }],
  fxaa: ['Antialiasing FXAA', on => { if (typeof fxaaPass !== 'undefined' && fxaaPass) { if (on) LAB.orig.fxaa = fxaaPass.enabled; fxaaPass.enabled = on ? false : LAB.orig.fxaa; } }],
  bloom: ['Bloom', on => { if (typeof bloomPass !== 'undefined' && bloomPass) { if (on) LAB.orig.bloom = bloomPass.enabled; bloomPass.enabled = on ? false : LAB.orig.bloom; } }],
  fog: ['Foschia', on => { if (on) { LAB.fogD = scene.fog.density; scene.fog.density = 1e-6; } else if (LAB.fogD) scene.fog.density = LAB.fogD; }],
  decor: ['Vegetazione decorativa (erba, piante, sassi, foglie)', on => { AAA.hideDecor = on; AAA.chunkT = 0; for (const c of AAA.chunks || []) if (c.m.userData.chunk && c.m.userData.chunk[1]) c.m.visible = !on; }],
  wind: ['Animazione della vegetazione', on => { AAA.windOff = on; if (on) AAA.wind.value.set(0, 0); }],
  refl: ['Riflessi delle pozzanghere e dei vetri', on => { for (const m of [AAA.mats.water, AAA.mats.glass]) { if (on) (LAB.orig.env || (LAB.orig.env = new Map())).set(m, m.envMap); m.envMap = on ? null : LAB.orig.env.get(m); m.needsUpdate = true; } }],
  post: ['Post-processing (bloom, grading, FXAA, SSAO)', on => { AAA.noPost = on; }],
  pipe: ['Asset della pipeline Blender (casa normanna)', on => { if (AAA.pipeHouse) { AAA.pipeHouse.obj.visible = !on; AAA.shadowDirty = 3; } }],
  extra: ['Dettagli non essenziali (oggetti, pulviscolo, fasci di luce)', on => { for (const o of AAA.extras || []) { if (on) o.userData.labVis = o.visible; o.visible = on ? false : o.userData.labVis !== false; } }],
};
function labSetFeat(k, on) { if (!!LAB.feat[k] === !!on) return; LAB.feat[k] = !!on; LAB_FEAT[k][1](!!on); }
function labResetFeat() { for (const k in LAB_FEAT) labSetFeat(k, false); }
// costo indicativo: stesso percorso, prima tutto attivo, poi un effetto spento alla volta (i costi non sono additivi)
function labFeatureSweep(dur = 20, reps = 1) {
  const keys = Object.keys(LAB_FEAT), jobs = []; for (let r = 0; r < reps; r++) { jobs.push(null); for (const k of keys) jobs.push(k); }
  const out = []; LAB.sweep = { out };
  const next = () => { labResetFeat(); const k = jobs.shift(); if (k === undefined) { LAB.sweep = null; LAB.costs = labCosts(out); labUi('Isolamento concluso.'); return; } if (k) labSetFeat(k, true);
    setTimeout(() => labStart({ dur, warm: 3, label: k ? 'senza ' + LAB_FEAT[k][0] : 'riferimento', onEnd: res => { if (res) out.push({ k, ms: res.gpu && res.gpu.mean ? res.gpu.mean : res.frame.mean, gpu: !!(res.gpu && res.gpu.mean), fps: res.frame.fps }); next(); } }), 300); };
  next();
}
function labCosts(out) { const base = out.filter(o => !o.k).map(o => o.ms), bm = base.reduce((a, b) => a + b, 0) / (base.length || 1), by = {}; for (const o of out) if (o.k) (by[o.k] || (by[o.k] = [])).push(o.ms);
  return Object.entries(by).map(([k, v]) => { const m = v.reduce((a, b) => a + b, 0) / v.length, sd = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) : null; return { k, nome: LAB_FEAT[k][0], costoMs: +(bm - m).toFixed(2), riferimentoMs: +bm.toFixed(2), misura: out.every(o => o.gpu) ? 'tempo GPU' : 'tempo fotogramma (quantizzato dal V-Sync)', variabilita: sd === null ? 'una sola misura' : sd.toFixed(2) + ' ms' }; }).sort((a, b) => b.costoMs - a.costoMs); }
// ---------- esportazione ----------
function labDownload(name, text, type) { const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(new Blob([text], { type })); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function labJSON() { return JSON.stringify({ formato: 'omaha1944-graphics-lab-1', esportato: new Date().toISOString(), ambiente: LAB.runs.length ? LAB.runs[LAB.runs.length - 1].ambiente : labEnv(), costiEffetti: LAB.costs || null, esecuzioni: LAB.runs }, null, 1); }
function labCSV() {
  const H = ['data', 'build', 'preset', 'etichetta', 'durata_s', 'fotogrammi', 'risoluzione', 'dpr', 'fps_medio', '1pct_low', 'ms_medio', 'ms_mediana', 'ms_p95', 'ms_p99', 'ms_max', 'ms_dev_std', 'cpu_ms', 'gpu_ms', 'draw_call', 'triangoli', 'browser', 'os', 'gpu', 'disattivate', 'mancanti'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return [H.join(',')].concat(LAB.runs.map(r => [r.data, r.build, r.preset, r.label, r.durata, r.fotogrammi, r.risoluzione, r.dpr, r.frame.fps, r.frame.low1, r.frame.mean, r.frame.median, r.frame.p95, r.frame.p99, r.frame.max, r.frame.sd, r.cpu ? r.cpu.mean : '', typeof r.gpu === 'object' ? r.gpu.mean : 'n/d', r.drawCall, r.triangoli, r.ambiente.browser, r.ambiente.os, r.ambiente.gpu, (r.disattivate || []).join(' '), (r.mancanti || []).join(' | ')].map(q).join(','))).join('\n');
}
// ---------- foto di confronto: stessa posa, FOV e luce; miniature conservate fra un preset e l'altro ----------
const LAB_SHOTS = [['facciata', -14 + .5 - 1, -7 + 4 + 7, 1.7, -14, -7 + 4 - 4, 3.2], ['strada', -34, 6.4, 1.5, 0, 8, .5], ['interno', -14 - 1.5, -7 + 2.7, 1.6, -14 - 5.4, -7 - 1.4, .9]];
function labShots() {
  const out = {}, save = camera.position.clone(), rot = camera.rotation.clone(), fov = camera.fov; camera.fov = 70; camera.updateProjectionMatrix();
  for (const [n, u, v, h, lu, lv, lh] of LAB_SHOTS) { const x = AV.cx + u, z = AV.cz + v, lx = AV.cx + lu, lz = AV.cz + lv; camera.position.set(x, Math.max(Hf(x, z), FLOORS.length ? worldFloor(x, z, Hf(x, z) + h) : -1e9) + h, z); camera.lookAt(lx, Hf(lx, lz) + lh, lz); camera.updateMatrixWorld();
    AAA.chunkT = 0; if (typeof aaaChunkTick === 'function') aaaChunkTick(1); renderFrame(GAME.time); const full = renderer.domElement.toDataURL('image/jpeg', .9);
    const c = document.createElement('canvas'); c.width = 480; c.height = Math.round(480 * renderer.domElement.height / renderer.domElement.width); c.getContext('2d').drawImage(renderer.domElement, 0, 0, c.width, c.height); out[n] = { full, thumb: c.toDataURL('image/jpeg', .8), res: labRes() }; }
  camera.position.copy(save); camera.rotation.copy(rot); camera.fov = fov; camera.updateProjectionMatrix();
  try { const all = JSON.parse(localStorage.getItem('aaa_lab_shots') || '{}'); all[AAA.preset] = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { thumb: v.thumb, res: v.res, data: new Date().toISOString() }])); localStorage.setItem('aaa_lab_shots', JSON.stringify(all)); } catch (e) { }
  LAB.lastShots = out; return out;
}
// ---------- test di accumulo: il percorso ripetuto N volte, risorse a ogni giro ----------
function labSoak(laps = 3, dur = 25) {
  const res = []; const lap = i => { const m = { giro: i, geometrie: renderer.info.memory.geometries, texture: renderer.info.memory.textures, programmi: (renderer.info.programs || []).length, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, oggetti: (() => { let n = 0; scene.traverse(() => n++); return n; })() }; res.push(m);
    if (i >= laps) { LAB.soakRes = { giri: res, crescita: { geometrie: res[res.length - 1].geometrie - res[1].geometrie, texture: res[res.length - 1].texture - res[1].texture, programmi: res[res.length - 1].programmi - res[1].programmi, oggetti: res[res.length - 1].oggetti - res[1].oggetti } }; labUi('Test di accumulo concluso.'); return; }
    labStart({ dur, warm: 1, label: 'accumulo giro ' + (i + 1), onEnd: () => setTimeout(() => lap(i + 1), 200) }); };
  lap(0);
}
function labSoakFrame() {}
// ---------- diagnostica ----------
function labDiag(kind, on) {
  if (kind === 'wire') { scene.overrideMaterial = on ? (LAB.wire || (LAB.wire = new THREE.MeshBasicMaterial({ color: 0x9fe07a, wireframe: true }))) : null; }
  if (kind === 'bounds') { if (LAB.bh) { scene.remove(LAB.bh); LAB.bh = null; } if (on) { LAB.bh = new THREE.Group(); for (const c of AAA.chunks || []) { const s = c.m.geometry.boundingSphere; if (!s) continue; const b = new THREE.Box3().setFromCenterAndSize(new V3(c.x, Hf(c.x, c.z) + 2, c.z), new V3(s.radius, 4, s.radius)); LAB.bh.add(new THREE.Box3Helper(b, c.m.visible ? 0x60ff80 : 0xff6040)); } scene.add(LAB.bh); } }
  if (kind === 'colliders' && typeof MAPCHK !== 'undefined') { MAPCHK.on = on; if (on) mapValidate(); }
}
function labDiagText() {
  let vis = 0, tot = 0; scene.traverse(o => { if (o.isMesh) { tot++; if (o.visible) vis++; } }); const ch = AAA.chunks || [], chv = ch.filter(c => c.m.visible).length;
  return `oggetti mesh visibili ${vis}/${tot} (prima dello scarto per inquadratura) · blocchi visibili ${chv}/${ch.length}<br>distanze massime: erba ${AAA_DIST.grass[AAA.preset]} m · dettaglio ${AAA_DIST.detail[AAA.preset]} m · piccoli ${AAA_DIST.small[AAA.preset]} m · alberi nessuna (foschia)<br>LOD: nessun livello di dettaglio per distanza sui modelli (solo scarto per blocchi) · ombre statiche ${AAA.fixedSun ? 'sì' : 'no'} · risoluzione dinamica ${SETTINGS.dynres ? 'attiva' : 'spenta'}`;
}
// ---------- pannello F9 ----------
function labPanel(on) {
  LAB.panel = on; let el = $('labPanel');
  if (!el) { el = document.createElement('div'); el.id = 'labPanel'; el.style.cssText = 'position:fixed;left:12px;top:12px;bottom:12px;width:min(560px,94vw);z-index:72;overflow:auto;background:rgba(10,11,10,.93);color:#e8e6dc;font:12px/1.45 system-ui,sans-serif;padding:10px 14px;border:1px solid #555'; document.body.appendChild(el); el.addEventListener('click', labClick); el.addEventListener('change', labClick); }
  el.style.display = on ? 'block' : 'none';
  if (on) { labFreeInput(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => { GAME.running = true; if ($('pause')) $('pause').classList.add('hidden'); }, 60); labUi(); }
  else if (!LAB.run) lockPointer();
}
const LAB_SEC = 'margin:10px 0 4px;font:600 12px system-ui;letter-spacing:.12em;color:#c8b070';
function labUi(msg) {
  const el = $('labPanel'); if (!el || !LAB.panel) return; if (msg) LAB.msg = msg;
  const B = (a, t, x = '') => `<button data-a="${a}" ${x} style="margin:2px 4px 2px 0;padding:4px 9px;background:#2a2c28;color:#eee;border:1px solid #666;cursor:pointer">${t}</button>`;
  const runs = LAB.runs.slice(-12).reverse(), f = x => x === null || x === undefined ? '—' : (+x).toFixed(1);
  const cmp = LAB.cmp && LAB.cmp.length === 2 ? LAB.cmp.map(id => LAB.runs.find(r => r.id === id)).filter(Boolean) : null;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px;letter-spacing:.08em">GRAPHICS BENCHMARK LAB</b>${B('close', 'Chiudi (F9)')}</div>
  <div style="opacity:.75">${LAB.msg || 'Misure locali: niente viene inviato a server esterni.'}</div>
  <div style="${LAB_SEC}">1 · LIVE METRICS</div>${B('ov', LAB.ov ? 'Nascondi overlay (F8)' : 'Mostra overlay (F8)')} <span style="opacity:.75">GPU: ${LAB.gpu ? 'misurabile (timer query)' : 'non disponibile in questo browser: si misurano solo frame osservato e CPU'}</span>
  <div style="${LAB_SEC}">2 · RUN BENCHMARK</div>Durata <select id="labDur">${[20, 30, 60, 90, 120].map(d => `<option ${d === 60 ? 'selected' : ''}>${d}</option>`).join('')}</select> s · percorso A–H ${B('run', LAB.run ? 'In corso…' : 'Avvia', LAB.run ? 'disabled' : '')} ${B('stop', 'Interrompi')} ${B('all', 'Tutti i preset in sequenza')}<br><span style="opacity:.7">Riscaldamento escluso dalle statistiche · risoluzione dinamica sospesa · comandi del giocatore disattivati durante la misura · punti del percorso dentro i muri: ${LAB.pathBad ?? '?'}</span>
  <div style="${LAB_SEC}">3 · GRAPHICS PRESETS</div>Attivo <b>${AAA.preset}</b> · risoluzione interna ${labRes()} · ${Object.keys(AAA_PRESETS).map(k => B('preset_' + k, k)).join('')} <span style="opacity:.7">(ricarica la demo con il preset scelto)</span>
  <div style="${LAB_SEC}">4 · FEATURE ISOLATION</div>${Object.entries(LAB_FEAT).map(([k, [n]]) => `<label style="display:block"><input type="checkbox" data-f="${k}" ${LAB.feat[k] ? 'checked' : ''}> spegni ${n}</label>`).join('')}
  ${B('sweep', 'Misura il costo di ogni effetto (15 s × 2)')} ${B('showroom', '3D Asset Showroom (F10)')} ${B('reset', 'Ripristina configurazione')}
  ${LAB.costs ? `<canvas id="labCost" width="520" height="${22 * LAB.costs.length + 10}"></canvas><div style="opacity:.7">Differenza di frame time medio rispetto al riferimento, stesso percorso. I costi non sono additivi.</div>` : ''}
  <div style="${LAB_SEC}">5 · RESULTS</div>
  <table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="text-align:left;opacity:.7"><th></th><th>Preset</th><th>FPS</th><th>1% low</th><th>ms</th><th>P99</th><th>Draw</th><th>Tri</th><th>Note</th></tr>
  ${runs.map(r => `<tr style="border-top:1px solid #333"><td><input type="checkbox" data-c="${r.id}" ${(LAB.cmp || []).includes(r.id) ? 'checked' : ''}></td><td>${r.preset}</td><td>${f(r.frame.fps)}</td><td>${f(r.frame.low1)}</td><td>${(+r.frame.mean).toFixed(2)}</td><td>${(+r.frame.p99).toFixed(1)}</td><td>${r.drawCall}</td><td>${(r.triangoli / 1e6).toFixed(2)}M</td><td>${r.label || ''} ${r.risoluzione}${(r.disattivate || []).length ? ' · senza ' + r.disattivate.join(',') : ''}</td></tr>`).join('') || '<tr><td colspan="9" style="opacity:.6">Nessuna esecuzione registrata.</td></tr>'}</table>
  ${cmp ? `<div style="margin-top:4px">Confronto ${cmp[0].preset} → ${cmp[1].preset}: FPS ${labDelta(cmp[0].frame.fps, cmp[1].frame.fps)}, 1% low ${labDelta(cmp[0].frame.low1, cmp[1].frame.low1)}, frame time ${labDelta(cmp[0].frame.mean, cmp[1].frame.mean, true)}${cmp[0].risoluzione !== cmp[1].risoluzione ? ' · <b>risoluzioni diverse</b>' : ''}</div>` : '<div style="opacity:.6">Seleziona due righe per confrontarle.</div>'}
  <canvas id="labFt" width="520" height="90" style="margin-top:6px"></canvas><canvas id="labPre" width="520" height="90"></canvas>
  ${B('clear', 'Svuota risultati')}
  <div style="${LAB_SEC}">6 · EXPORT</div>${B('json', 'Esporta JSON')} ${B('csv', 'Esporta CSV')} ${B('shots', 'Foto di confronto (preset attivo)')}
  ${(() => { try { const all = JSON.parse(localStorage.getItem('aaa_lab_shots') || '{}'); const ps = Object.keys(all); return ps.length ? '<div style="display:grid;grid-template-columns:repeat(' + ps.length + ',1fr);gap:4px;margin-top:4px">' + ps.map(p => `<div style="font-size:10px">${p}<br>${Object.entries(all[p]).map(([k, v]) => `<img src="${v.thumb}" style="width:100%;display:block;margin:2px 0" title="${k} ${v.res}">`).join('')}</div>`).join('') + '</div>' : ''; } catch (e) { return ''; } })()}
  <div style="${LAB_SEC}">7 · DIAGNOSTICS</div><label><input type="checkbox" data-d="wire" ${LAB.dg && LAB.dg.wire ? 'checked' : ''}> wireframe</label> <label><input type="checkbox" data-d="bounds" ${LAB.dg && LAB.dg.bounds ? 'checked' : ''}> blocchi e limiti</label> <label><input type="checkbox" data-d="colliders" ${LAB.dg && LAB.dg.colliders ? 'checked' : ''}> collider</label>
  <div style="opacity:.8;margin-top:4px">${labDiagText()}</div>${B('soak', 'Test di accumulo risorse (3 giri)')}
  ${LAB.soakRes ? `<div>Crescita fra il 1° e l'ultimo giro: geometrie ${LAB.soakRes.crescita.geometrie}, texture ${LAB.soakRes.crescita.texture}, programmi ${LAB.soakRes.crescita.programmi}, oggetti ${LAB.soakRes.crescita.oggetti}</div>` : ''}`;
  const last = LAB.runs[LAB.runs.length - 1]; if (last) labGraph($('labFt'), last.serie, 50);
  labBars($('labPre'), Object.values(LAB.runs.reduce((m, r) => { if (!(r.disattivate || []).length && !/accumulo/.test(r.label || '')) m[r.preset] = r; return m; }, {})).map(r => [r.preset, r.frame.fps, r.frame.low1]), 'FPS medio / 1% low per preset (ultima esecuzione completa)');
  if (LAB.costs && $('labCost')) labBars($('labCost'), LAB.costs.map(c => [c.nome.split(' (')[0], c.costoMs]), 'ms', true);
}
function labDelta(a, b, lowerBetter) { if (a == null || b == null) return 'n/d'; const d = b - a, pct = d / a * 100; return `${d >= 0 ? '+' : ''}${d.toFixed(1)} (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%)${Math.abs(pct) < 3 ? ' ≈ invariato' : ''}`; }
function labBars(cv, rows, title, horiz) {
  if (!cv) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H); g.fillStyle = '#ccc'; g.font = '11px system-ui'; if (!rows.length) { g.fillText('Nessun dato misurato.', 6, 16); return; }
  if (horiz) { const mx = Math.max(.01, ...rows.map(r => Math.abs(r[1]))); rows.forEach(([n, v], i) => { const y = 6 + i * 22, w = Math.abs(v) / mx * (W - 220); g.fillStyle = '#ccc'; g.fillText(n.slice(0, 30), 4, y + 12); g.fillStyle = v >= 0 ? '#8a8a8a' : '#5a6a8a'; g.fillRect(200, y + 2, w, 13); g.fillStyle = '#eee'; g.fillText(v.toFixed(2) + ' ms', 204 + w, y + 12); }); return; }
  g.fillText(title, 4, 11); const mx = Math.max(60, ...rows.map(r => r[1] || 0)), bw = (W - 20) / rows.length;
  rows.forEach(([n, a, b], i) => { const x = 10 + i * bw, h1 = (a || 0) / mx * (H - 30), h2 = (b || 0) / mx * (H - 30); g.fillStyle = '#8a8a8a'; g.fillRect(x, H - 14 - h1, bw * .4, h1); g.fillStyle = '#5a6a8a'; g.fillRect(x + bw * .42, H - 14 - h2, bw * .4, h2); g.fillStyle = '#ddd'; g.fillText(`${n} ${a ? a.toFixed(0) : '—'}/${b ? b.toFixed(0) : '—'}`, x, H - 2); });
  const y50 = H - 14 - 50 / mx * (H - 30); g.strokeStyle = '#a08a50'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, y50); g.lineTo(W, y50); g.stroke(); g.setLineDash([]);
}
function labClick(e) {
  const t = e.target; if (e.type === 'change' && t.dataset.f) { labSetFeat(t.dataset.f, t.checked); return; }
  if (e.type === 'change' && t.dataset.c) { const id = +t.dataset.c; LAB.cmp = (LAB.cmp || []).filter(x => x !== id); if (t.checked) LAB.cmp.push(id); LAB.cmp = LAB.cmp.slice(-2); labUi(); return; }
  if (e.type === 'change' && t.dataset.d) { (LAB.dg || (LAB.dg = {}))[t.dataset.d] = t.checked; labDiag(t.dataset.d, t.checked); labUi(); return; }
  const a = t.dataset && t.dataset.a; if (!a || e.type !== 'click') return;
  if (a === 'close') labPanel(false); else if (a === 'ov') { LAB.ov = !LAB.ov; labOverlay(); labUi(); }
  else if (a === 'run') labStart(); else if (a === 'stop') { LAB.sweep = null; LAB.queue = null; try { sessionStorage.removeItem('aaa_lab_queue'); } catch (e2) { } labStop(true); }
  else if (a === 'reset') { labResetFeat(); for (const k in LAB.dg || {}) labDiag(k, false); LAB.dg = {}; labUi('Configurazione ripristinata.'); }
  else if (a === 'sweep') labFeatureSweep(15, 2);
  else if (a === 'showroom' && typeof srOpen === 'function') { labPanel(false); srOpen(true); }
  else if (a === 'json') labDownload('omaha1944_lab_' + Date.now() + '.json', labJSON(), 'application/json');
  else if (a === 'csv') labDownload('omaha1944_lab_' + Date.now() + '.csv', labCSV(), 'text/csv');
  else if (a === 'shots') { const s = labShots(); for (const [k, v] of Object.entries(s)) { const l = document.createElement('a'); l.download = `omaha1944_${AAA.preset}_${k}.jpg`; l.href = v.full; l.click(); } labUi('Foto acquisite per ' + AAA.preset + ' (' + labRes() + ').'); }
  else if (a === 'clear') { LAB.runs = []; LAB.cmp = []; labSave(); labUi('Risultati svuotati.'); }
  else if (a === 'soak') labSoak(3, 25);
  else if (a.startsWith('preset_')) labReload(a.slice(7), false);
  else if (a === 'all') { try { sessionStorage.setItem('aaa_lab_queue', JSON.stringify({ list: ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'], dur: +$('labDur').value || 60 })); } catch (e2) { } labReload('LOW', true); }
}
// cambio di preset: la scena si ricostruisce, quindi si ricarica la pagina e la demo riparte da sola col preset scelto
function labReload(preset, bench) { try { localStorage.setItem('aaa_preset', preset); sessionStorage.setItem('aaa_autostart', JSON.stringify({ preset, lab: 1, bench: !!bench })); sessionStorage.setItem('skipIntro', '1'); } catch (e) { } location.reload(); }
// avvio automatico dopo una ricarica (cambio preset o sequenza di benchmark)
function labAutostart() {
  let a = null; try { a = JSON.parse(sessionStorage.getItem('aaa_autostart') || 'null'); sessionStorage.removeItem('aaa_autostart'); } catch (e) { }
  if (!a) return; const go = () => { AAA.preset = a.preset; const sm = $('optMap'); if (![...sm.options].some(o => o.value === 'aaa')) { const o = document.createElement('option'); o.value = 'aaa'; o.textContent = 'AAA Graphics Test'; sm.appendChild(o); } sm.value = 'aaa'; AAA.t0 = performance.now(); const mm = $('mainMenu'); if (mm) mm.style.display = 'none'; LAB.auto = a; startGame(); };
  setTimeout(go, 400);
}
// all'avvio della demo: tempo di caricamento, GPU, percorso verificato, eventuale coda di benchmark
function labInit() {
  labLoad(); labGpuInit(); AAA.st.loadMs = AAA.t0 ? Math.round(performance.now() - AAA.t0) : null; LAB.pathBad = labCheckPath();
  const a = LAB.auto; if (!a) return; LAB.auto = null;
  setTimeout(() => { labPanel(true); let Qd = null; try { Qd = JSON.parse(sessionStorage.getItem('aaa_lab_queue') || 'null'); } catch (e) { }
    if (a.bench && Qd) labStart({ dur: Qd.dur, label: 'sequenza preset', onEnd: () => { const i = Qd.list.indexOf(AAA.preset); if (i >= 0 && i < Qd.list.length - 1) labReload(Qd.list[i + 1], true); else { try { sessionStorage.removeItem('aaa_lab_queue'); } catch (e) { } labUi('Sequenza dei preset conclusa.'); } } }); }, 1500);
}
addEventListener('keydown', e => {
  if (SCEN !== 'aaa' || !GAME.started) return;
  if (e.code === 'F8') { e.preventDefault(); LAB.ov = !LAB.ov; labOverlay(); if (LAB.panel) labUi(); }
  else if (e.code === 'F9') { e.preventDefault(); labPanel(!LAB.panel); }
  else if (e.code === 'Escape' && LAB.run) labStop(true);
  else if (e.code === 'Escape' && LAB.panel) { e.preventDefault(); labPanel(false); }
  else return;
  e.stopImmediatePropagation();
}, true);
// pannello aperto: mouse e tastiera servono al pannello, il soldato non riceve input
function labBlock(e) {
  const sr = typeof ASR !== 'undefined' && ASR.on;
  if (SCEN !== 'aaa' || !(LAB.panel || sr) || typeof GAME === 'undefined' || !GAME.started) return;
  const inPanel = e.target && e.target.closest && e.target.closest('#labPanel,#srPanel');
  if (sr && !LAB.panel && !inPanel && /^(mousedown|mouseup|mousemove|wheel|contextmenu)$/.test(e.type)) return;   // camera orbitale dello showroom: la gestiscono i suoi listener
  if (e.type.startsWith('key') && /^(F8|F9|F10|Escape)$/.test(e.code)) return;   // tasti del laboratorio e dello showroom
  if (e.type.startsWith('key')) { if (inPanel && /^(Tab|Enter|Space|Arrow)/.test(e.code)) return; e.stopImmediatePropagation(); return; }
  if (inPanel) return;
  e.stopImmediatePropagation(); if (e.type !== 'mousemove') e.preventDefault();
}
for (const t of ['keydown', 'keyup', 'mousedown', 'mouseup', 'click', 'mousemove', 'wheel', 'contextmenu']) addEventListener(t, labBlock, { capture: true, passive: false });
function labFreeInput() { try { if (typeof KEYS !== 'undefined') for (const k in KEYS) KEYS[k] = false; if (typeof mouseL !== 'undefined') mouseL = false; if (typeof P !== 'undefined') { P.trigger = false; P.adsHeld = false; } } catch (e) { } }
if (document.readyState !== 'loading') labAutostart(); else addEventListener('DOMContentLoaded', labAutostart);
