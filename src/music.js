"use strict";
// ============================================================
//  Musica durante le partite: brani personali facoltativi in
//  assets/music/personali (vedi LEGGIMI.txt in quella cartella).
//  In battaglia: prima il brano dello scenario, poi battaglia.mp3;
//  a fine partita vittoria.mp3 o sconfitta.mp3. Se un file manca,
//  semplicemente non suona nulla (restano i suoni della guerra).
// ============================================================
const MUSIC = (function () {
    let cur = null, started = false, want = 0;
  function scenarioFile() {
    if (typeof PARA !== 'undefined' && PARA.on) return 'battaglia_notte';
    return { omaha: 'battaglia_omaha', sea: 'battaglia_mare', air: 'battaglia_cielo', kas: 'battaglia_carri', ard: 'battaglia_ardenne', tun: 'battaglia_tunisia' }[SCEN] || null;
  }
  const vol = () => Math.max(0, Math.min(1, (typeof SETTINGS !== 'undefined' ? SETTINGS.volume ?? .8 : .8)));
  // prova i file in ordine e suona il primo che esiste
  // bases: nomi senza estensione; per ciascuno si provano le varianti numerate in ordine casuale
  function play(bases, level, loop) {
    stop(1.2); const files = [].concat(...bases.map(b => musicVariants(b))); const a = new Audio(); a.volume = 0; let i = 0; want = level;
    a.onerror = () => { if (++i < files.length) { a.src = files[i]; a.play().catch(() => {}); } else if (cur === a) cur = null; };
    a.src = files[0]; a.play().catch(() => {}); cur = a;
    // in battaglia, finito un brano ne parte un altro a caso
    a.onended = () => { if (loop && cur === a && !GAME.over) { const v = a.volume; play(bases, level, loop); if (cur) cur.volume = v; } };
    const fade = setInterval(() => { if (cur !== a) return clearInterval(fade); a.volume = Math.min(want * vol(), a.volume + .02); if (a.volume >= want * vol()) clearInterval(fade); }, 60);
  }
  function stop(t = 1) { const a = cur; if (!a) return; cur = null; const st = Math.max(.01, a.volume / (t * 16)); const iv = setInterval(() => { a.volume = Math.max(0, a.volume - st); if (a.volume <= 0) { a.pause(); clearInterval(iv); } }, 60); }
  // la partita comincia: musica di battaglia, bassa per non coprire spari e voci
  setInterval(() => {
    if (!started && typeof GAME !== 'undefined' && GAME.started && GAME.running && !GAME.over) { started = true; const f = scenarioFile(); play(f ? [f, 'battaglia'] : ['battaglia'], .32, true); }
    if (cur && !GAME.over) { const tgt = want * vol() * (GAME.running ? 1 : .5); if (Math.abs(cur.volume - tgt) > .01) cur.volume += Math.sign(tgt - cur.volume) * .01; }
  }, 250);
  // fine partita: vittoria o sconfitta
  if (typeof GAME !== 'undefined') { const end0 = GAME.end; GAME.end = function (win) { const was = this.over; end0.apply(this, arguments); if (!was) play([win ? 'vittoria' : 'sconfitta'], .6, false); }; }
  return { play, stop, get current() { return cur ? cur.src.split('/').pop() : null; } };
})();
