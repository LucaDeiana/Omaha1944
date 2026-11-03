"use strict";
// ============================================================
//  Debug audio (Ctrl+Maiusc+U): voci richieste con esito e motivo dello scarto, contatori per categoria,
//  loop attivi (motori, cingoli, ambiente) con volume, velocità di lettura, filtro e numero di ricostruzioni,
//  campioni più suonati nell'ultimo secondo. Spento per default; non costa nulla quando è spento.
// ============================================================
const ADBG = { on: false, el: null, plays: {}, t: 0 };
(function adbgHook() {
  const p0 = window.play; window.play = function (name, pos, o) { const r = p0.apply(this, arguments); if (ADBG.on && r) { const k = (o && o.cx && typeof caHas === 'function' && caHas(o.cx) ? o.cx : name); ADBG.plays[k] = (ADBG.plays[k] || 0) + 1; } return r; };
})();
function adbgDraw() {
  if (!ADBG.on) return;
  if (!ADBG.el) { ADBG.el = document.createElement('pre'); ADBG.el.style.cssText = 'position:fixed;right:8px;top:60px;z-index:60;max-width:46vw;max-height:84vh;overflow:hidden;background:rgba(8,10,8,.82);color:#d8e6cf;font:11px/1.35 monospace;padding:8px 10px;pointer-events:none;white-space:pre-wrap'; document.body.appendChild(ADBG.el); }
  const now = VOX.clock(), L = [];
  L.push(`VOCI richieste ${VOX.req} · dette ${VOX.played} · scartate ${VOX.dropped} · in corso ${VOX.playing.length}`);
  L.push('per categoria (dette/richieste): ' + Object.entries(VOX.byCat).map(([k, v]) => `${k} ${v.ok}/${v.req}`).join(' · '));
  for (const e of VOX.log.slice(-14).reverse()) L.push(`${(now - e.t).toFixed(1).padStart(5)} s fa  ${e.k.padEnd(14)} ${e.res === 'ok' ? 'DETTA  «' + e.text + '»' : 'scarto: ' + e.res}${e.src ? '  · ' + e.src : ''}${e.ev ? '  · ' + e.ev : ''}`);
  L.push(''); L.push('LOOP attivi (nome · personale · ricostruzioni · volume · velocità · filtro)');
  for (const h of (AU.loopHandles || []).filter(h => !h.dead && h.g && h.g.gain.value > .003).slice(0, 14)) L.push(`  ${(h.cx || h.name).padEnd(30)} ${h.custom ? 'file' : 'base'} · ${h.builds || 0} · ${h.g.gain.value.toFixed(2)} · ${h.src.playbackRate.value.toFixed(2)} · ${Math.round(h.f.frequency.value)} Hz`);
  if (PL && PL.me && PL.me.eng) { const h = PL.me.eng; L.push(`MOTORE DEL GIOCATORE: ${h.cx || h.name} · ricostruito ${h.builds || 0} volte · manetta ${Math.round(PL.throttle * 100)}% · velocità di lettura ${h.src ? h.src.playbackRate.value.toFixed(3) : '-'}`); }
  if (typeof caQualityReport === 'function' && CA.report.quality.length) { L.push(''); L.push(caQualityReport().split('\n').slice(0, 10).join('\n')); }
  L.push(''); L.push('suoni nell\'ultimo secondo: ' + Object.entries(ADBG.plays).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + '×' + v).join(' · '));
  if ((ADBG.t += 1) % 30 === 0) ADBG.plays = {};
  ADBG.el.textContent = L.join('\n');
}
addEventListener('keydown', e => { if (e.code === 'KeyU' && e.ctrlKey && e.shiftKey) { e.preventDefault(); ADBG.on = !ADBG.on; if (ADBG.el) ADBG.el.style.display = ADBG.on ? 'block' : 'none'; } });
setInterval(adbgDraw, 33);
