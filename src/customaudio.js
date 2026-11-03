"use strict";
// ============================================================
//  Audio personalizzati: ogni suono del gioco può essere sostituito da un file
//  nella cartella degli audio personali (vedi CUSTOM_AUDIO_GUIDE.md).
//  All'avvio il server fornisce l'elenco dei file presenti; quelli riconosciuti
//  dal registro (assets/audio_manifest.js) vengono decodificati una volta sola.
//  Durante il gioco: file personale valido → usato; altrimenti suono originale.
//  Nessuna richiesta di rete durante il gioco, nessuna scansione di cartelle.
// ============================================================
const CA = { buf: {}, n: 0, rot: {}, ready: false, report: { loaded: [], bad: [], unknown: [], quality: [] } };
// ---------- qualità dei file personali ----------
// Analisi al caricamento (in memoria, i file non vengono toccati): picco e distorsione, volume della parte utile,
// silenzi alle estremità, rumore di fondo (rapporto segnale/rumore sulle finestre di 20 ms), registrazione ovattata
// (poca energia sopra ~4 kHz). Classe: KEEP, CLEANUP (recuperabile), REPLACE (da sostituire).
function caAnalyze(b) {
  const d = b.getChannelData(0), sr = b.sampleRate, n = d.length; let pk = 0, clip = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a > .995) clip++; }
  const th = Math.max(.003, pk * .03); let a0 = 0, z = n - 1; while (a0 < z && Math.abs(d[a0]) < th) a0++; while (z > a0 && Math.abs(d[z]) < th) z--;
  const W = Math.max(1, Math.floor(sr * .02)), rms = []; let hf = 0, tot = 0;
  for (let i = a0; i + W <= z; i += W) { let s2 = 0; for (let k = i; k < i + W; k++) s2 += d[k] * d[k]; rms.push(Math.sqrt(s2 / W)); }
  for (let i = a0 + 1; i <= z; i++) { const df = d[i] - d[i - 1]; hf += df * df; tot += d[i] * d[i]; }
  const sorted = rms.slice().sort((x, y) => x - y), floor = sorted[Math.floor(sorted.length * .1)] || 1e-6, act = sorted[Math.floor(sorted.length * .7)] || 1e-6;
  const snr = 20 * Math.log10(act / Math.max(floor, 1e-6)), lvl = 20 * Math.log10(act + 1e-9), bright = Math.sqrt(hf / Math.max(tot, 1e-12));
  // bright: rapporto fra la derivata e il segnale; a 44,1 kHz una voce piena sta sopra ~0,15, una registrazione telefonica sotto ~0,06
  const notes = [], brightN = bright * sr / 44100;
  if (clip / n > .001) notes.push(`distorsione ${(clip / n * 100).toFixed(2)}%`);
  if (a0 / sr > .25 || (n - z) / sr > .25) notes.push(`silenzi ${(a0 / sr).toFixed(2)}+${((n - z) / sr).toFixed(2)} s`);
  if (lvl < -32) notes.push(`volume basso ${lvl.toFixed(0)} dBFS`);
  if (snr < 15) notes.push(`fruscio (segnale/rumore ${snr.toFixed(0)} dB)`);
  if (brightN < .06) notes.push('ovattata');
  if (sr < 22050) notes.push(`campionamento ${sr} Hz`);
  const cls = snr < 8 || clip / n > .02 || (brightN < .04 && snr < 15) ? 'REPLACE' : notes.length ? 'CLEANUP' : 'KEEP';
  return { cls, notes, snr, lvl, peak: pk, a0, z };
}
// pulizia leggera e non distruttiva per voci e annunci: silenzi tagliati (resta un margine di 30 ms) e picco a −1 dBFS
function caCleanVoice(b, q) {
  const sr = b.sampleRate, pad = Math.floor(sr * .03), a = Math.max(0, q.a0 - pad), z = Math.min(b.length - 1, q.z + pad), L = z - a + 1;
  if (L < sr * .05) return b;
  const nb = AU.ctx.createBuffer(b.numberOfChannels, L, sr), g = q.peak > 0 ? Math.min(4, .89 / q.peak) : 1;
  for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), o = nb.getChannelData(c); for (let i = 0; i < L; i++) { let x = s[a + i] * g; if (Math.abs(x) > .89) x = Math.sign(x) * (.89 + Math.tanh((Math.abs(x) - .89) * 4) * .1); o[i] = x; } }
  return nb;
}
function caQualityReport() { const Q = CA.report.quality; if (!Q.length) return 'nessun file personale analizzato'; const c = { KEEP: 0, CLEANUP: 0, REPLACE: 0 }; for (const q of Q) c[q.cls]++; return `File personali: ${Q.length} · da tenere ${c.KEEP} · ripuliti o da ripulire ${c.CLEANUP} · da sostituire ${c.REPLACE}\n` + Q.filter(q => q.cls !== 'KEEP').map(q => `${q.cls.padEnd(8)} ${q.f} — ${q.notes.join(', ')}${q.cleaned ? ' (ripulito in memoria)' : ''}`).join('\n'); }

// carica e decodifica i file personali presenti (in parallelo, senza bloccare l'avvio)
async function loadCustomAudio() {
  const MF = window.AUDIO_MANIFEST; if (!MF || !AU.ctx || !netAvailable()) return;
  let files;
  try { const r = await fetch('custom-audio/index', { cache: 'no-store' }); if (!r.ok) return; files = await r.json(); } catch (e) { return; }
  if (!Array.isArray(files) || !files.length) return;
  // raggruppa per evento: "weapons/rifles/kar98/fire_02.mp3" → percorso base "weapons/rifles/kar98/fire", variante 02
  const byPath = {}; for (const e of MF.list) byPath[e.path] = e.id;
  const groups = {};
  for (const f of files) {
    const m = /^(.*?)(?:_(\d{1,3}))?\.(flac|wav|ogg|mp3)$/i.exec(f); if (!m) continue;
    const id = byPath[m[1].toLowerCase()]; if (!id) { CA.report.unknown.push(f); continue; }
    const key = id + '#' + (m[2] || '0'), g = groups[key];
    // stesso nome in più formati: vale la priorità flac > wav > ogg > mp3 (prima la qualità piena)
    const pr = MF.formats.indexOf(m[3].toLowerCase());
    if (!g || pr < g.pr) groups[key] = { id, f, pr };
  }
  await Promise.all(Object.values(groups).map(async g => {
    try {
      const r = await fetch('custom-audio/file/' + g.f.split('/').map(encodeURIComponent).join('/')); if (!r.ok) throw 0;
      const b = await AU.ctx.decodeAudioData(await r.arrayBuffer());
      if (!b || b.duration < .01) throw 0;
      const q = caAnalyze(b), isVoice = /^(shout|radio|sniper\.announcer)\./.test(g.id); let bb = b;
      if (isVoice && q.cls !== 'KEEP') { bb = caCleanVoice(b, q); q.cleaned = true; }
      CA.report.quality.push({ f: g.f, id: g.id, cls: q.cls, notes: q.notes, cleaned: !!q.cleaned });
      (CA.buf[g.id] = CA.buf[g.id] || []).push(bb); CA.report.loaded.push(g.f);
    } catch (e) { CA.report.bad.push(g.f); }   // file corrotto o formato non supportato: resta l'originale
  }));
  CA.n = Object.keys(CA.buf).length; CA.ready = true;
  // suoni continui già avviati (vento, mare, motori): passano al file personale senza interrompersi
  for (const h of AU.loopHandles || []) {
    if (h.dead || !h.src) continue; const l = caResolve(h.name, h.cx); if (!l) continue;
    try { const ns = AU.ctx.createBufferSource(); ns.buffer = typeof loopify === 'function' ? loopify(l[0]) : l[0]; ns.loop = true; h.builds = (h.builds || 0) + 1; h.custom = true; ns.playbackRate.value = h.src.playbackRate.value; ns.connect(h.g); ns.start(); h.src.stop(); h.src = ns; } catch (e) { }
  }
  if (CA.report.quality.length) console.info(caQualityReport());
  if (CA.n) console.info(`Audio personali: ${CA.report.loaded.length} file per ${CA.n} eventi` + (CA.report.bad.length ? ` · non validi: ${CA.report.bad.join(', ')}` : '') + (CA.report.unknown.length ? ` · non riconosciuti: ${CA.report.unknown.join(', ')}` : ''));
}
// carica alcuni eventi in un altro contesto audio (introduzione e menù): restituisce { id: [buffer] }
async function caLoadInto(ctx, ids) {
  const MF = window.AUDIO_MANIFEST, out = {}; if (!MF || !ctx || !netAvailable()) return out;
  let files; try { const r = await fetch('custom-audio/index', { cache: 'no-store' }); if (!r.ok) return out; files = await r.json(); } catch (e) { return out; }
  const want = new Set(ids);
  for (const f of files) {
    const m = /^(.*?)(?:_(\d{1,3}))?\.(flac|wav|ogg|mp3)$/i.exec(f); if (!m) continue;
    const e = MF.list.find(x => x.path === m[1].toLowerCase()); if (!e || !want.has(e.id)) continue;
    try { const r = await fetch('custom-audio/file/' + f.split('/').map(encodeURIComponent).join('/')); const b = await ctx.decodeAudioData(await r.arrayBuffer()); if (b && b.duration > .01) (out[e.id] = out[e.id] || []).push(b); } catch (x) { }
  }
  return out;
}
// sceglie la variante successiva senza ripetere subito la stessa
function caVariant(id) {
  const l = CA.buf[id]; if (l.length === 1) return l;
  const i = CA.rot[id] = ((CA.rot[id] ?? (R() * l.length | 0)) + 1 + (R() * (l.length - 1) | 0)) % l.length;
  return [l[i]];
}
// ricerca: prima gli eventi di contesto (es. arma, carro, nave), poi l'evento generico del campione
function caResolve(name, cx) {
  if (!CA.n) return null;
  if (cx) { if (typeof cx === 'string') { if (CA.buf[cx]) return caVariant(cx); } else for (const id of cx) if (id && CA.buf[id]) return caVariant(id); }
  const g = window.AUDIO_MANIFEST && AUDIO_MANIFEST.bySample[name];
  return g && CA.buf[g] ? caVariant(g) : null;
}
// eventi senza un suono originale (mira, annunci, interfaccia): suonano solo se c'è il file
function caPlay(id, pos, o = {}) { if (!CA.buf[id]) return null; return play('_custom', pos, Object.assign({ list: caVariant(id), var: 0 }, o)); }
function caHas(id) { return !!CA.buf[id]; }

// ---------- modalità cecchini: annunci confermati dal sistema di combattimento ----------
const CA_SNP = { streak: 0, heads: 0, lastKill: -99, multi: 0 };
function caSniperKill(head) {
  if (SCEN !== 'snp') return;
  const t = GAME.time, c = CA_SNP;
  c.streak++; c.heads = head ? c.heads + 1 : 0;
  c.multi = t - c.lastKill < 4 ? c.multi + 1 : 1; c.lastKill = t;
  caPlay(head ? 'sniper.effects.headshot_confirm' : 'sniper.effects.kill_confirm', null, { vol: .9 });
  const ann = c.streak === 10 ? 'unstoppable' : c.streak === 5 ? 'killing_spree' : c.heads === 3 ? 'triple_headshot' : c.heads === 2 ? 'double_headshot' : c.multi === 2 ? 'multikill' : head ? 'headshot' : null;
  if (ann) setTimeout(() => caPlay('sniper.announcer.' + ann, null, { vol: 1.1 }), 250);
}
function caSniperHit() { if (SCEN === 'snp') caPlay('sniper.effects.hitmarker', null, { vol: .8 }); }
function caSniperDied() { CA_SNP.streak = 0; CA_SNP.heads = 0; }
// interfaccia: clic sui pulsanti (dopo l'avvio dell'audio) e inizio della battaglia, solo se presenti i file
document.addEventListener('click', e => { if (CA.n && e.target.closest && e.target.closest('button, .mmb, .mxCard, .mxBtn, .mxTab')) caPlay('ui.click', null, { vol: .8 }); }, true);
function caStart() { let k = 0; const t = setInterval(() => { if (CA.ready || ++k > 40) { clearInterval(t); caPlay('ui.start', null, { vol: 1 }); } }, 150); }
