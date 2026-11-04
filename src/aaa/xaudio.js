"use strict";
// ============================================================
//  AAA AUDIO OVERHAUL — ExperimentalAudioEngine (XAE), SOLO nella tech demo «AAA Graphics Test».
//  Usa l'AudioContext unico del gioco (AU.ctx) ma un proprio mixer: bus Master/Weapons/Explosions/Vehicles/
//  Environment/Voices/UI → limitatore finale → uscita. Nelle mappe originali non viene mai chiamato.
//
//  Componenti: XAEAssets (campioni, preparazione dei layer), XAEWeapons (profili e layering), XAESpatial (HRTF,
//  distanza, ritardo del suono, assorbimento dell'aria), XAEAcoustics (zone e riverberi per convoluzione),
//  XAEMixer (bus, limitatore, misura dei picchi), XAEVoices (priorità e limite delle sorgenti), XAEDiag.
//
//  Sorgenti audio: SOLO le registrazioni già nel progetto (spari reali CC0 della «Free Firearm Sound Library»,
//  32 kHz mono, ~0,9 s) e i campioni meccanici sintetizzati del gioco. Le code ambientali NON sono registrazioni:
//  nascono dalla convoluzione con risposte all'impulso generate qui (modelli di stanza/esterno), e sono dichiarate
//  tali. Nessun file nuovo è stato acquisito (rete esterna bloccata): vedi tools/audio-pipeline/MANIFEST.md.
// ============================================================
const XAE = { on: false, ready: false, bus: {}, voices: [], maxVoices: 40, zone: 'campo', zoneW: {}, irs: {}, rr: {}, stats: { played: 0, culled: 0, late: 0, peak: 0, clip: 0, occl: 0 }, occCache: new Map(), layersOn: { transient: 1, body: 1, mech: 1, tail: 1, env: 1 }, forceZone: null, abGain: 1 };
const XAE_BUSES = ['weapons', 'explosions', 'vehicles', 'environment', 'voices', 'ui'];
const XAE_SUPERSONIC = { garand: 1, kar98: 1, kar98zf: 1, springfield: 1, enfield: 1, mosin: 1, g43: 1, svt40: 1, bar: 1, mg42: 1 };   // .45 ACP e 9 mm: subsonici o quasi

// ---------------------------------------------------------------- profili delle armi (solo armi del gioco)
// src: campioni del gioco; body/tran: guadagni; lp: taglio del corpo; tailT: durata della coda; tailF: colore della coda;
// mech: suono meccanico dopo lo sparo (ritardo s); rate: per le automatiche la cadenza reale (colpi/min) per le raffiche
const XAE_PROFILES = {
  garand: { src: 'garand', name: 'M1 Garand', body: 1, tran: .55, lp: 9000, tailT: 1.6, tailF: 900, crack: 1, mech: [['clip_in', .0, 0]], rate: 0, ping: true },
  thompson: { src: 'thompson', name: 'Thompson M1A1', body: .9, tran: .35, lp: 7000, tailT: 1.1, tailF: 650, mech: [], rate: 700 },
  bar: { src: 'bar', name: 'BAR M1918A2', body: 1.05, tran: .55, lp: 8500, tailT: 1.7, tailF: 800, mech: [], rate: 550 },
  kar98: { src: 'kar98', name: 'Karabiner 98k', body: 1, tran: .6, lp: 9500, tailT: 1.7, tailF: 950, mech: [], boltAnim: true, rate: 0 },
  mp40: { src: 'mp40', name: 'MP 40', body: .85, tran: .35, lp: 7500, tailT: 1.0, tailF: 700, mech: [], rate: 500, pitch: 1.04 },
  mg42: { src: 'mg42', name: 'MG 42 (solo IA)', body: .95, tran: .45, lp: 8000, tailT: 1.4, tailF: 750, mech: [], rate: 1200 },
  springfield: { src: 'springfield', name: 'Springfield M1903A4', body: 1, tran: .6, lp: 9500, tailT: 1.7, tailF: 950, mech: [], boltAnim: true, rate: 0 },
  colt: { src: 'colt', name: 'Colt M1911A1', body: .8, tran: .45, lp: 7000, tailT: .9, tailF: 800, mech: [], rate: 0 },
  kar98zf: { src: 'kar98', name: 'Kar98k ZF39', body: 1, tran: .6, lp: 9500, tailT: 1.7, tailF: 950, mech: [], boltAnim: true, rate: 0 },
  enfield: { src: 'springfield', name: 'Lee-Enfield No.4 (T)', body: .98, tran: .6, lp: 9200, tailT: 1.7, tailF: 900, mech: [], boltAnim: true, rate: 0, pitch: .98 },
  mosin: { src: 'kar98', name: 'Mosin-Nagant 91/30', body: 1.02, tran: .6, lp: 9000, tailT: 1.8, tailF: 850, mech: [], boltAnim: true, rate: 0, pitch: .97 },
  g43: { src: 'kar98', name: 'Gewehr 43', body: .97, tran: .55, lp: 9000, tailT: 1.6, tailF: 900, mech: [], rate: 0, pitch: 1.02 },
  svt40: { src: 'garand', name: 'SVT-40', body: .97, tran: .6, lp: 9500, tailT: 1.6, tailF: 950, mech: [], rate: 0, pitch: 1.03 },
};

// ---------------------------------------------------------------- mixer
function xaeInit() {
  if (XAE.ready || !AU.ctx || !AU.ready) return false;
  const c = AU.ctx;
  XAE.master = c.createGain(); XAE.master.gain.value = SETTINGS.volume;
  // limitatore finale: soglia -1 dBFS, attacco rapido; nessuna compressione "a muro" sui bus
  XAE.lim = c.createDynamicsCompressor(); XAE.lim.threshold.value = -3; XAE.lim.knee.value = 0; XAE.lim.ratio.value = 20; XAE.lim.attack.value = .0015; XAE.lim.release.value = .09;
  XAE.meter = c.createAnalyser(); XAE.meter.fftSize = 2048; XAE.meterBuf = new Float32Array(XAE.meter.fftSize);
  // saturazione morbida di sicurezza dopo il limitatore: lineare fino a -3 dBFS, poi curva tanh fino a -0,3 dBFS
  // (il compressore del browser non ha lookahead: i transitori più rapidi possono superarne la soglia per pochi campioni)
  XAE.soft = c.createWaveShaper(); { const n = 4096, cv = new Float32Array(n), k = .708, top = .966; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a <= k ? a : k + (top - k) * Math.tanh((a - k) / (top - k))); } XAE.soft.curve = cv; XAE.soft.oversample = '2x'; }
  XAE.master.connect(XAE.lim); XAE.lim.connect(XAE.soft); XAE.soft.connect(XAE.meter); XAE.meter.connect(c.destination);
  XAE.preMeter = c.createAnalyser(); XAE.preMeter.fftSize = 2048; XAE.master.connect(XAE.preMeter);
  for (const k of XAE_BUSES) { const g = c.createGain(); g.gain.value = { weapons: .9, explosions: 1, vehicles: .8, environment: .7, voices: .9, ui: .6 }[k]; g.connect(XAE.master); XAE.bus[k] = g; }
  // duck moderato dell'ambiente quando spara il giocatore
  XAE.envDuck = c.createGain(); XAE.envDuck.connect(XAE.bus.environment);
  xaeBuildAcoustics(); xaeBuildAssets();
  XAE.ready = true; return true;
}

// ---------------------------------------------------------------- risposte all'impulso delle zone (generate, non registrate)
// RT60, predelay, prime riflessioni (n, intervallo), smorzamento delle alte (Hz), densità, livello
const XAE_ZONES = {
  interno: { rt: .55, pre: .004, er: [7, .006], damp: 3500, lvl: .55, desc: 'stanza con muri di pietra e solaio di legno' },
  fienile: { rt: 1.25, pre: .01, er: [6, .013], damp: 2500, lvl: .6, desc: 'grande volume di legno e paglia' },
  cortile: { rt: .9, pre: .012, er: [5, .02], damp: 5000, lvl: .45, desc: 'muri su tre lati, slapback marcato' },
  strada: { rt: 1.1, pre: .016, er: [8, .025], damp: 4500, lvl: .45, desc: 'canyon di facciate: riflessioni ripetute' },
  campo: { rt: 2.2, pre: .06, er: [2, .12], damp: 1400, lvl: .3, desc: 'aperto: eco lontana del terreno e degli alberi' },
  bocage: { rt: 1.5, pre: .03, er: [4, .05], damp: 1800, lvl: .35, desc: 'siepi alte: diffusione e assorbimento del fogliame' },
};
function xaeIR(z, seed) {
  const c = AU.ctx, sr = c.sampleRate, L = Math.ceil(sr * (z.rt * 1.2 + z.pre + .05)), b = c.createBuffer(2, L, sr);
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    const a = Math.exp(-2 * Math.PI * z.damp / sr);
    for (let i = 0; i < L; i++) {
      const t = i / sr - z.pre; if (t < 0) continue;
      const env = Math.pow(10, -3 * t / z.rt);   // -60 dB a RT60
      const n = (rnd() * 2 - 1) * env * Math.min(1, t / .004);
      lp = lp * a + n * (1 - a);   // la coda perde le alte col tempo (assorbimento)
      d[i] = lp * (1 + Math.min(1, t * 3));
    }
    for (let k = 0; k < z.er[0]; k++) {   // prime riflessioni discrete
      const t = z.pre + z.er[1] * (k + 1) * (.7 + rnd() * .6), i = Math.floor(t * sr); if (i < L) d[i] += (.55 / (k + 1)) * (rnd() < .5 ? 1 : -1) * (ch ? .9 : 1);
    }
    let mx = 0; for (let i = 0; i < L; i++) mx = Math.max(mx, Math.abs(d[i])); for (let i = 0; i < L; i++) d[i] *= .5 / (mx || 1);
  }
  return b;
}
function xaeBuildAcoustics() {
  const c = AU.ctx; let seed = 12345;
  for (const k in XAE_ZONES) {
    const cv = c.createConvolver(); cv.buffer = xaeIR(XAE_ZONES[k], seed += 7919);
    const g = c.createGain(); g.gain.value = k === XAE.zone ? 1 : 0; cv.connect(g); g.connect(XAE.bus.environment);
    XAE.irs[k] = { cv, g, send: c.createGain() }; XAE.irs[k].send.connect(cv); XAE.zoneW[k] = k === XAE.zone ? 1 : 0;
  }
  XAE.envIn = c.createGain(); for (const k in XAE.irs) XAE.envIn.connect(XAE.irs[k].send);
}
// zona dell'ascoltatore: interni dai volumi della demo (AAA.rooms), poi densità degli edifici attorno e vegetazione
function xaeDetectZone() {
  if (XAE.forceZone) return XAE.forceZone;
  const p = camera.position;
  for (const r of AAA.rooms || []) if (p.x > r[0] && p.x < r[3] && p.y > r[1] - .2 && p.y < r[4] + .5 && p.z > r[2] && p.z < r[5]) return (r[4] - r[1]) > 4.5 ? 'fienile' : 'interno';
  let walls = [0, 0, 0, 0], near = 0;
  for (const s of solids) {
    if (!s.on || s.max.y - s.min.y < 2.2) continue;
    const cx = (s.min.x + s.max.x) / 2, cz = (s.min.z + s.max.z) / 2, dx = cx - p.x, dz = cz - p.z, d = Math.hypot(dx, dz);
    if (d > 22) continue; near++;
    walls[Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3)] = 1;
  }
  const sides = walls.reduce((a, b) => a + b, 0);
  if (sides >= 3 && near > 12) return 'cortile';
  if (sides >= 2 && near > 6) return 'strada';
  let veg = 0; for (const [x, z, r] of AAA.plants || []) if (Math.hypot(x - p.x, z - p.z) < r + 8) veg++;
  return veg > 6 ? 'bocage' : 'campo';
}
function xaeUpdateZone(dt) {
  const z = xaeDetectZone(); XAE.zone = z; const t = AU.ctx.currentTime;
  for (const k in XAE.irs) { const w = XAE.zoneW[k] += ((k === z ? 1 : 0) - XAE.zoneW[k]) * Math.min(1, dt * 1.5); XAE.irs[k].g.gain.setTargetAtTime(w, t, .05); }
}

// ---------------------------------------------------------------- asset: layer derivati dai campioni (preparati una volta)
function xaeBuildAssets() {
  const c = AU.ctx; XAE.assets = {};
  for (const id in XAE_PROFILES) {
    const pr = XAE_PROFILES[id], list = AU.buf[pr.src]; if (!list) continue;
    // transitorio: primi 35 ms del campione, filtrati passa-alto (attacco, «schiocco» di bocca)
    const tr = list.map(b => { const n = Math.min(b.length, Math.floor(b.sampleRate * .035)), nb = c.createBuffer(1, n, b.sampleRate), s = b.getChannelData(0), o = nb.getChannelData(0); let y = 0, px = 0; for (let i = 0; i < n; i++) { y = .86 * (y + s[i] - px); px = s[i]; o[i] = y * (i > n - 64 ? (n - i) / 64 : 1); } return nb; });
    XAE.assets[id] = { body: list, tran: tr };
  }
}

// ---------------------------------------------------------------- spazializzazione
const _xv = new V3(), _xf = new V3();
function xaeListener() {
  const L = AU.ctx.listener, p = camera.position; camera.getWorldDirection(_xf); _xv.set(0, 1, 0).applyQuaternion(camera.quaternion);
  if (L.positionX) { const t = AU.ctx.currentTime; L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t); L.forwardX.setValueAtTime(_xf.x, t); L.forwardY.setValueAtTime(_xf.y, t); L.forwardZ.setValueAtTime(_xf.z, t); L.upX.setValueAtTime(_xv.x, t); L.upY.setValueAtTime(_xv.y, t); L.upZ.setValueAtTime(_xv.z, t); }
  else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_xf.x, _xf.y, _xf.z, _xv.x, _xv.y, _xv.z); }
}
// occlusione: raggio verso la sorgente sui solidi, in cache per 0,1 s per sorgente (niente raggi a ogni fotogramma)
function xaeOcclusion(pos, key) {
  const now = performance.now(), c = XAE.occCache.get(key);
  if (c && now - c.t < 100) return c.v;
  let v = 0; const o = camera.position, d = _xv.copy(pos).sub(o), L = d.length(); d.divideScalar(L || 1);
  for (const s of solids) { if (!s.on || s.nb || s.max.y - s.min.y < 1.2) continue; const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s, L - .5); if (t >= 0) { v = Math.min(1, v + .6); if (v >= 1) break; } }
  XAE.stats.occl++; XAE.occCache.set(key, { t: now, v }); if (XAE.occCache.size > 200) XAE.occCache.clear();
  return v;
}
// bande di distanza: guadagno (curva propria, il panner non attenua: niente doppia attenuazione), filtro (assorbimento
// dell'aria e del terreno), peso dei layer
function xaeDistance(d) {
  const g = d < 1 ? 1 : 1 / Math.pow(d / 6 + .84, 1.1);
  const lp = clamp(16000 / (1 + d / 90), 900, 16000);
  const band = d < 25 ? 'vicino' : d < 150 ? 'medio' : d < 600 ? 'lontano' : 'molto lontano';
  const tran = d < 25 ? 1 : d < 150 ? 1 - (d - 25) / 125 : 0;
  const mech = d < 12 ? 1 - d / 12 : 0;
  const env = clamp(.25 + d / 220, .25, 1.4);
  return { g, lp, band, tran, mech, env };
}

// ---------------------------------------------------------------- voci (priorità e limite)
function xaeVoice(prio, end) {
  const now = AU.ctx.currentTime; XAE.voices = XAE.voices.filter(v => v.end > now);
  if (XAE.voices.length < XAE.maxVoices) return true;
  let w = null; for (const v of XAE.voices) if (v.prio < prio && (!w || v.prio < w.prio)) w = v;
  if (!w) { XAE.stats.culled++; return false; }
  try { w.g.gain.setTargetAtTime(0, now, .008); w.src.stop(now + .04); } catch (e) { } XAE.voices.splice(XAE.voices.indexOf(w), 1); XAE.stats.culled++;
  return true;
}
function xaeSrc(buf, t, gain, rate, dest, prio) {
  if (!xaeVoice(prio)) return null;
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = gain; s.connect(g); g.connect(dest); s.start(t);
  XAE.voices.push({ src: s, g, prio, start: t, buf, end: t + buf.duration / rate }); XAE.stats.played++;
  return g;
}
// selezione senza ripetizioni immediate
function xaePick(key, list) { const n = list.length; if (n < 2) return list[0]; let i; do i = Math.floor(R() * n); while (i === XAE.rr[key]); XAE.rr[key] = i; return list[i]; }

// ---------------------------------------------------------------- coda generata (tail): rumore filtrato con inviluppo
const XAE_TAILS = {};
function xaeTail(id) {
  if (XAE_TAILS[id]) return XAE_TAILS[id];
  const pr = XAE_PROFILES[id], c = AU.ctx, sr = c.sampleRate, L = Math.ceil(pr.tailT * sr), b = c.createBuffer(1, L, sr), d = b.getChannelData(0);
  let s = 97 + id.length * 31, lp = 0, lp2 = 0; const a = Math.exp(-2 * Math.PI * pr.tailF / sr), a2 = Math.exp(-2 * Math.PI * 60 / sr);
  for (let i = 0; i < L; i++) { s = (s * 16807) % 2147483647; const n = s / 2147483647 * 2 - 1, t = i / sr; lp = lp * a + n * (1 - a); lp2 = lp2 * a2 + lp * (1 - a2); d[i] = (lp - lp2) * Math.pow(10, -2.4 * t / pr.tailT) * Math.min(1, t / .02) * 2.2; }
  return (XAE_TAILS[id] = b);
}

// ---------------------------------------------------------------- sparo multistrato
// opts: { pos (null = giocatore), burst (indice nella raffica), dist (forza la distanza, Audio Lab), layers }
function xaeShot(id, pos, o = {}) {
  if (!XAE.ready && !xaeInit()) return false;
  const pr = XAE_PROFILES[id] || XAE_PROFILES.garand, A = XAE.assets[id] || XAE.assets.garand; if (!A) return false;
  const c = AU.ctx, now = c.currentTime, player = !pos, L = Object.assign({}, XAE.layersOn, o.layers || {});
  const d = player ? 0 : (o.dist ?? pos.distanceTo(camera.position)), D = xaeDistance(d);
  const delay = player ? 0 : Math.min(3, d / 343), t = now + delay + (o.delay || 0);
  const occ = player || o.dist !== undefined ? (o.occ || 0) : xaeOcclusion(pos, o.key || id);
  // catena: layer → filtro (aria + occlusione) → panner HRTF (solo sorgenti esterne) → bus armi; mandata al riverbero di zona
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = Math.min(D.lp, pr.lp) * (occ ? .3 : 1); filt.Q.value = .5;
  const out = c.createGain(); out.gain.value = D.g * (1 - occ * .55) * (o.gain ?? 1) * XAE.abGain;
  let last = out; filt.connect(out);
  if (!player) {
    const pn = c.createPanner(); pn.panningModel = d < 60 ? 'HRTF' : 'equalpower'; pn.distanceModel = 'linear'; pn.rolloffFactor = 0; pn.refDistance = 1; pn.maxDistance = 1e5;
    const pp = o.dist !== undefined ? _xv.copy(camera.position).add(_xf.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(Math.max(1, d))) : pos;
    if (pn.positionX) { pn.positionX.value = pp.x; pn.positionY.value = pp.y; pn.positionZ.value = pp.z; } else pn.setPosition(pp.x, pp.y, pp.z);
    out.connect(pn); last = pn;
  }
  last.connect(XAE.bus.weapons);
  const env = c.createGain(); env.gain.value = D.env * (player ? .55 : 1) * (occ ? 1.2 : 1); last.connect(env); env.connect(XAE.envIn);
  const prio = player ? 3 : d < 60 ? 2 : 1, rate = (pr.pitch || 1) * (1 + (R() - .5) * .03), burst = o.burst || 0, bodyG = pr.body * Math.pow(10, (R() - .5) * .1);
  let any = false;
  if (L.body) any = !!xaeSrc(xaePick(id + 'b', A.body), t, bodyG * (burst > 0 ? .9 : 1), rate, filt, prio) || any;
  if (L.transient && D.tran > .01) xaeSrc(xaePick(id + 't', A.tran), t, pr.tran * D.tran * (player ? 1.15 : 1), rate, filt, prio);
  // coda: sulle raffiche si suona solo ogni terzo colpo (le code si accumulerebbero), più lunga all'ultimo
  if (L.tail && (!pr.rate || burst % 3 === 0 || o.last)) xaeSrc(xaeTail(id), t + .015, (player ? .35 : .5) * (D.band === 'molto lontano' ? 1.4 : 1), 1, filt, prio - .5);
  if (L.mech && D.mech > .01) for (const [n, dl, v] of pr.mech) if (AU.buf[n]) xaeSrc(AU.buf[n][0], t + dl, v * D.mech, 1, XAE.bus.weapons, prio);
  if (!L.env) env.gain.value = 0;
  if (player) { const t2 = now; XAE.bus.environment.gain.setTargetAtTime(.45, t2, .01); XAE.bus.environment.gain.setTargetAtTime(.7, t2 + .25, .4); }
  if (delay > 0 && o.dist === undefined && t - now > 3) XAE.stats.late++;
  return any;
}
// raffica (Audio Lab): colpi programmati alla cadenza reale, non con timer del browser
function xaeBurst(id, n, o = {}) {
  const pr = XAE_PROFILES[id]; const dt = 60 / (pr.rate || 600);
  for (let i = 0; i < n; i++) xaeShot(id, o.pos || null, Object.assign({}, o, { burst: i, last: i === n - 1, delay: i * dt }));
}
// onda d'urto del proiettile supersonico che passa vicino: schiocco secco, senza riverbero di zona
function xaeCrack(weapon, from) {
  if (!XAE.ready) return;
  if (weapon && !XAE_SUPERSONIC[weapon]) { if (AU.buf.whiz) xaeSrc(AU.buf.whiz[0], AU.ctx.currentTime, .5, 1, XAE.bus.weapons, 3); return; }
  if (AU.buf.crack) xaeSrc(AU.buf.crack[0], AU.ctx.currentTime, .85, 1 + (R() - .5) * .04, XAE.bus.weapons, 3);
}
// meccanica dell'arma: eventi dal gioco (sfxMech) e marcatori delle animazioni Blender (wglb.js)
function xaeMech(kind, delay = 0) {
  if (!XAE.ready) return false;
  const n = MECH[kind] || kind; if (!AU.buf[n]) return false;
  xaeSrc(AU.buf[n][0], AU.ctx.currentTime + delay, .5, 1 + (R() - .5) * .04, XAE.bus.weapons, 2.5); return true;
}

// ---------------------------------------------------------------- aggiornamento e diagnostica
function xaeUpdate(dt) {
  if (!XAE.on || !XAE.ready) return;
  xaeListener(); xaeUpdateZone(dt);
  const m = XAE.meter; m.getFloatTimeDomainData(XAE.meterBuf); let pk = 0, sq = 0; for (const v of XAE.meterBuf) { const a = Math.abs(v); if (a > pk) pk = a; sq += v * v; }
  XAE.stats.peak = Math.max(XAE.stats.peak * .97, pk); XAE.stats.rms = Math.sqrt(sq / XAE.meterBuf.length); if (pk >= .999) XAE.stats.clip++;
  XAE.preMeter.getFloatTimeDomainData(XAE.meterBuf); let pp = 0; for (const v of XAE.meterBuf) pp = Math.max(pp, Math.abs(v)); XAE.stats.prePeak = Math.max((XAE.stats.prePeak || 0) * .97, pp);
}
function xaeDiag() {
  const now = AU.ctx ? AU.ctx.currentTime : 0;
  return { stato: AU.ctx ? AU.ctx.state : 'assente', voci: XAE.voices.filter(v => v.end > now).length, maxVoci: XAE.maxVoices, zona: XAE.zone, buffer: Object.keys(AU.buf).length,
    picco_dBFS: XAE.stats.peak ? +(20 * Math.log10(XAE.stats.peak)).toFixed(1) : -Infinity, picco_prima_limitatore_dBFS: XAE.stats.prePeak ? +(20 * Math.log10(XAE.stats.prePeak)).toFixed(1) : -Infinity,
    clip: XAE.stats.clip, suonati: XAE.stats.played, scartati: XAE.stats.culled, raggi_occlusione: XAE.stats.occl, ritardi_oltre_3s: XAE.stats.late };
}
// attivazione e rilascio (solo tech demo): il gioco originale riprende quando la demo si chiude (ricarica della pagina)
function xaeEnable(on) {
  if (on && (typeof SCEN === 'undefined' || SCEN !== 'aaa')) return false;
  XAE.on = on; if (on) xaeInit();
  if (!on) { const now = AU.ctx ? AU.ctx.currentTime : 0; for (const v of XAE.voices) try { v.src.stop(now); } catch (e) { } XAE.voices = []; }
  return XAE.on;
}
function xaeActive() { return XAE.on && XAE.ready && typeof SCEN !== 'undefined' && SCEN === 'aaa'; }

// ---------------------------------------------------------------- AAA AUDIO LAB (F7)
// confronto A/B a volume percepito bilanciato: si misura l'RMS dell'uscita di ciascun sistema sullo stesso sparo e si
// corregge il guadagno del nuovo (XAE.abGain) per eguagliare il vecchio. Così «più forte» non passa per «migliore».
const XAL = { open: false, gun: 'garand', dist: 0, zone: 'auto', levels: { A: null, B: null } };
function xalMeasure(which, fn) {
  const c = AU.ctx; if (!c) return;
  if (!XAL.anA) { XAL.anA = c.createAnalyser(); XAL.anA.fftSize = 2048; AU.master.connect(XAL.anA); }
  const an = which === 'A' ? XAL.anA : XAE.preMeter, buf = new Float32Array(an.fftSize); let sum = 0, n = 0, pk = 0;
  fn();
  const t0 = performance.now(), iv = setInterval(() => {
    an.getFloatTimeDomainData(buf); for (const v of buf) { sum += v * v; n++; pk = Math.max(pk, Math.abs(v)); }
    if (performance.now() - t0 > 700) { clearInterval(iv); XAL.levels[which] = { rms: Math.sqrt(sum / Math.max(1, n)), pk }; xalUi(); }
  }, 20);
}
function xalPlay(which) {
  const id = XAL.gun, pr = XAE_PROFILES[id], d = XAL.dist;
  const pos = d > 0 ? camera.position.clone().add(new V3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(d)) : null;
  if (which === 'A') { const was = XAE.on; XAE.on = false; try { sfxShot(pr.src, pos, !pos); } finally { XAE.on = was; } }
  else xaeShot(id, pos, { dist: d > 0 ? d : undefined });
}
function xalUi() {
  const el = document.getElementById('xalPanel'); if (!el || !XAL.open) return;
  const B = (a, t, on) => `<button data-a="${a}" style="margin:2px 3px 2px 0;padding:2px 7px;background:${on ? '#5a4a22' : '#2a2c2a'};color:#eee;border:1px solid #666;cursor:pointer">${t}</button>`;
  const S = 'margin:8px 0 3px;font:600 11px system-ui;letter-spacing:.12em;color:#c8b070', g = XAE_PROFILES[XAL.gun], D = xaeDiag(), lv = XAL.levels;
  const db = v => v ? (20 * Math.log10(v)).toFixed(1) + ' dBFS' : '—';
  el.innerHTML = `<b style="letter-spacing:.08em">AAA AUDIO LAB</b> <span style="opacity:.6">(F7)</span>
  <div style="${S}">ARMA</div><select data-a="gun" style="width:100%;background:#222;color:#eee;border:1px solid #666">${Object.keys(XAE_PROFILES).map(k => `<option value="${k}"${k === XAL.gun ? ' selected' : ''}>${XAE_PROFILES[k].name}</option>`).join('')}</select>
  <div style="margin-top:4px">${B('shot', 'Colpo singolo (nuovo)')}${g.rate ? B('burst', 'Raffica 10 colpi') : ''}${B('reload', 'Anteprima ricarica')}${B('crack', 'Proiettile che passa')}</div>
  <div style="${S}">CONFRONTO A/B (VOLUME BILANCIATO)</div>${B('A', 'A: audio originale')}${B('B', 'B: motore sperimentale')}${B('match', 'Bilancia B su A')}
  <div style="font-size:11px">A: RMS ${db(lv.A && lv.A.rms)}, picco ${db(lv.A && lv.A.pk)} · B: RMS ${db(lv.B && lv.B.rms)}, picco ${db(lv.B && lv.B.pk)} · correzione B ${(20 * Math.log10(XAE.abGain)).toFixed(1)} dB</div>
  <div style="${S}">DISTANZA DELLA SORGENTE: ${XAL.dist ? XAL.dist + ' m (' + xaeDistance(XAL.dist).band + ')' : 'arma del giocatore'}</div><input data-a="dist" type="range" min="0" max="800" step="5" value="${XAL.dist}" style="width:100%">
  <div style="${S}">AMBIENTE</div>${['auto', ...Object.keys(XAE_ZONES)].map(z => B('z:' + z, z === 'auto' ? `auto (${XAE.zone})` : z, XAL.zone === z)).join('')}
  <div style="font-size:11px;opacity:.75">${XAE_ZONES[XAE.zone] ? XAE_ZONES[XAE.zone].desc + ' — risposta all\'impulso generata, non registrata' : ''}</div>
  <div style="${S}">LAYER</div>${Object.keys(XAE.layersOn).map(k => B('l:' + k, k, XAE.layersOn[k])).join('')}
  <div style="${S}">STRESS</div>${B('stress', '30 soldati che sparano attorno')}
  <div style="${S}">DIAGNOSTICA</div><pre style="margin:0;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap">${Object.entries(D).map(([k, v]) => k.padEnd(28) + v).join('\n')}</pre>
  <div style="opacity:.6;margin-top:6px;font-size:11px">Sorgenti: registrazioni CC0 già nel progetto (32 kHz mono, ~0,9 s). Code e riverberi generati. Nessun file nuovo acquisito: vedi tools/audio-pipeline/MANIFEST.md.</div>`;
}
function xalOpen(on) {
  XAL.open = on; let el = document.getElementById('xalPanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'xalPanel'; el.style.cssText = 'position:fixed;right:12px;top:12px;width:min(360px,92vw);max-height:calc(100vh - 24px);overflow:auto;z-index:72;background:rgba(10,11,10,.9);color:#e8e6dc;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #555';
    document.body.appendChild(el);
    el.addEventListener('change', e => { const a = e.target.dataset.a; if (a === 'gun') { XAL.gun = e.target.value; xalUi(); } });
    el.addEventListener('input', e => { if (e.target.dataset.a === 'dist') { XAL.dist = +e.target.value; xalUi(); } });
    el.addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a || e.type !== 'click' || a === 'gun' || a === 'dist') return;
      if (!XAE.ready) xaeInit();
      if (a === 'shot') xaeShot(XAL.gun, null, XAL.dist ? { dist: XAL.dist } : {});
      else if (a === 'burst') xaeBurst(XAL.gun, 10, XAL.dist ? { dist: XAL.dist } : {});
      else if (a === 'reload') { const ty = (WGLB.mech[XAL.gun] || {}).type || 'semi', dur = (WEAPONS[XAL.gun] || { reload: 2.5 }).reload; for (const [m, k] of WGLB_MARK[ty] || []) xaeMech(k, m * dur); }
      else if (a === 'crack') xaeCrack(XAL.gun, null);
      else if (a === 'A' || a === 'B') xalMeasure(a, () => xalPlay(a));
      else if (a === 'match') { if (XAL.levels.A && XAL.levels.B) XAE.abGain = clamp(XAE.abGain * XAL.levels.A.rms / Math.max(1e-6, XAL.levels.B.rms), .1, 4); }
      else if (a.startsWith('z:')) { XAL.zone = a.slice(2); XAE.forceZone = XAL.zone === 'auto' ? null : XAL.zone; }
      else if (a.startsWith('l:')) { const k = a.slice(2); XAE.layersOn[k] = XAE.layersOn[k] ? 0 : 1; }
      else if (a === 'stress') xaeStress(30);
      xalUi(); e.target.blur();
    });
  }
  el.style.display = on ? 'block' : 'none'; if (on) { xalUi(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => { GAME.running = true; const pz = document.getElementById('pause'); if (pz) pz.classList.add('hidden'); }, 60); }
  else if (typeof lockPointer === 'function' && !(typeof LAB !== 'undefined' && LAB.panel)) lockPointer();
}
// stress: molte sorgenti che sparano raffiche attorno all'ascoltatore (verifica del limite delle voci e del limitatore)
function xaeStress(n) {
  const ids = ['garand', 'kar98', 'mp40', 'thompson', 'mg42', 'bar'];
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = 15 + R() * 300, pos = camera.position.clone().add(new V3(Math.cos(a) * d, 0, Math.sin(a) * d)), id = ids[i % ids.length];
    if (XAE_PROFILES[id].rate) xaeBurst(id, 6, { pos, key: 'st' + i, delay: R() * .5 }); else xaeShot(id, pos, { key: 'st' + i, delay: R() * .5 });
  }
}
addEventListener('keydown', e => { if (e.code === 'F7' && typeof SCEN !== 'undefined' && SCEN === 'aaa' && typeof GAME !== 'undefined' && GAME.started) { e.preventDefault(); xalOpen(!XAL.open); } });
setInterval(() => { if (XAL.open) xalUi(); }, 500);
