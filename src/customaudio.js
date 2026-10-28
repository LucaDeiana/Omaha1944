"use strict";
// ============================================================
//  Audio personalizzati: ogni suono del gioco può essere sostituito da un file
//  nella cartella degli audio personali (vedi CUSTOM_AUDIO_GUIDE.md).
//  All'avvio il server fornisce l'elenco dei file presenti; quelli riconosciuti
//  dal registro (assets/audio_manifest.js) vengono decodificati una volta sola.
//  Durante il gioco: file personale valido → usato; altrimenti suono originale.
//  Nessuna richiesta di rete durante il gioco, nessuna scansione di cartelle.
// ============================================================
const CA = { buf: {}, n: 0, rot: {}, ready: false, report: { loaded: [], bad: [], unknown: [] } };

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
      (CA.buf[g.id] = CA.buf[g.id] || []).push(b); CA.report.loaded.push(g.f);
    } catch (e) { CA.report.bad.push(g.f); }   // file corrotto o formato non supportato: resta l'originale
  }));
  CA.n = Object.keys(CA.buf).length; CA.ready = true;
  // suoni continui già avviati (vento, mare, motori): passano al file personale senza interrompersi
  for (const h of AU.loopHandles || []) {
    if (h.dead || !h.src) continue; const l = caResolve(h.name, h.cx); if (!l) continue;
    try { const ns = AU.ctx.createBufferSource(); ns.buffer = l[0]; ns.loop = true; ns.playbackRate.value = h.src.playbackRate.value; ns.connect(h.g); ns.start(); h.src.stop(); h.src = ns; } catch (e) { }
  }
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
