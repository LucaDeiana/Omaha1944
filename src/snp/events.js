"use strict";
// ============================================================
//  SOLO CECCHINI 2.0 — eventi di uccisione centralizzati, statistiche per giocatore,
//  annunciatore con coda e priorità, scritte a schermo, killfeed, classifica e premi di fine partita.
//  Le uccisioni le decide solo l'autorità (partita in solitario o host): i client mostrano ciò che ricevono.
// ============================================================
Object.assign(SNPCFG, { killcam: true, kcDur: 4, announce: true, hsOnly: false, protect: 2.5 });
// soglie degli annunci (configurabili)
const SNP_AN_CFG = { hsWindow: 12, multiWindow: 4, spree: 5, rampage: 10, dominating: 15, unstoppable: 20 };
// priorità: con più annunci nello stesso istante parte solo il più importante
const SNP_AN = {
  unstoppable: { p: 10, txt: 'UNSTOPPABLE!', say: 'Unstoppable!', big: 3 },
  dominating: { p: 9, txt: 'DOMINATING!', say: 'Dominating!', big: 3 },
  rampage: { p: 8, txt: 'RAMPAGE!', say: 'Rampage!', big: 2 },
  killing_spree: { p: 7, txt: 'KILLING SPREE!', say: 'Killing spree!', big: 2 },
  multi_headshot: { p: 6, txt: 'MULTI HEADSHOT!', say: 'Multi headshot!', big: 3, hs: 1 },
  triple_headshot: { p: 5, txt: 'TRIPLE HEADSHOT!', say: 'Triple headshot!', big: 2, hs: 1 },
  multi_kill: { p: 5, txt: 'MULTI KILL!', say: 'Multi kill!', big: 2 },
  triple_kill: { p: 4, txt: 'TRIPLE KILL!', say: 'Triple kill!', big: 2 },
  double_headshot: { p: 3, txt: 'DOUBLE HEADSHOT!', say: 'Double headshot!', big: 1, hs: 1 },
  double_kill: { p: 2, txt: 'DOUBLE KILL!', say: 'Double kill!', big: 1 },
  headshot: { p: 1, txt: 'HEADSHOT!', say: 'Headshot!', big: 0, hs: 1 },
};
const SNP2 = { seen: new Map(), q: [], busyT: 0, feed: [], feedEl: null, anEl: null, tabT: 0, kc: null };

// ---------- statistiche ----------
function snpStatRow(name, team) {
  const r = snpRow(name, team);
  // campo per campo: sui client la riga arriva dal tabellone dell'host con solo una parte delle statistiche
  if (!r.statInit) { r.statInit = true; const D = { shots: 0, hits: 0, heads: 0, hsRun: 0, hsBest: 0, streak: 0, best: 0, longest: 0, lifeT0: SNP.t, lifeSum: 0, lives: 0, score: 0, multiN: 0, multiT: -99, hsN: 0, hsT: -99 }; for (const k in D) if (r[k] === undefined) r[k] = D[k]; }
  if (!r.guns) r.guns = {};
  return r;
}
// ogni colpo sparato (per la precisione e per la killcam)
function snpShotEv(name, team, from, end, victim, zone) {
  if (SCEN !== 'snp') return;
  if (!NET.client) { const r = snpStatRow(name, team); r.shots++; if (victim) r.hits++; }
  if (typeof snpKcShot === 'function') snpKcShot(name, from, end, victim, zone);
}
// uccisione confermata: unico punto che aggiorna punteggi, serie, annunci e killfeed. Ritorna false se è un doppione
function snpKillEv(ev) {
  // doppione: la stessa vittima non può cadere due volte in meno di un secondo (la rinascita richiede almeno 3 s)
  const last = SNP2.seen.get(ev.v); if (last !== undefined && GAME.time - last < 1) return false;
  SNP2.seen.set(ev.v, GAME.time);
  const head = ev.zone === 'head', vr = ev.v ? snpStatRow(ev.v, ev.vt) : null;
  if (vr) { vr.deaths++; vr.lives++; vr.lifeSum += SNP.t - vr.lifeT0; vr.lifeT0 = SNP.t; vr.streak = 0; vr.hsRun = 0; vr.multiN = 0; vr.hsN = 0; }
  const an = [];
  if (ev.k && ev.kt !== ev.vt) {
    const kr = snpStatRow(ev.k, ev.kt);
    kr.kills++; kr.score += 100 + (head ? 50 : 0) + Math.min(50, Math.round((ev.dist || 0) / 10)); SNP.score[ev.kt]++;
    if (ev.w) kr.guns[ev.w] = (kr.guns[ev.w] || 0) + 1;
    if (ev.dist && ev.dist > kr.longest) kr.longest = Math.round(ev.dist);
    // tre contatori distinti: serie senza morire, uccisioni ravvicinate nel tempo, headshot letali consecutivi
    kr.streak++; kr.best = Math.max(kr.best, kr.streak);
    kr.multiN = GAME.time - kr.multiT <= SNP_AN_CFG.multiWindow ? kr.multiN + 1 : 1; kr.multiT = GAME.time;
    if (head) { kr.heads++; kr.hsN = GAME.time - kr.hsT <= SNP_AN_CFG.hsWindow ? kr.hsN + 1 : 1; kr.hsT = GAME.time; kr.hsRun++; kr.hsBest = Math.max(kr.hsBest, kr.hsRun); } else { kr.hsN = 0; kr.hsRun = 0; }
    const C = SNP_AN_CFG, s = kr.streak;
    if (s === C.unstoppable) an.push('unstoppable'); else if (s === C.dominating) an.push('dominating'); else if (s === C.rampage) an.push('rampage'); else if (s === C.spree) an.push('killing_spree');
    if (head) an.push(kr.hsN >= 4 ? 'multi_headshot' : kr.hsN === 3 ? 'triple_headshot' : kr.hsN === 2 ? 'double_headshot' : 'headshot');
    if (kr.multiN >= 4) an.push('multi_kill'); else if (kr.multiN === 3) an.push('triple_kill'); else if (kr.multiN === 2) an.push('double_kill');
  }
  snpFeedAdd(ev);
  if (ev.k === SNP.me && ev.kt !== ev.vt) { STATS.kills++; snpAnnounce(an); if (typeof caPlay === 'function') caPlay(head ? 'sniper.effects.headshot_confirm' : 'sniper.effects.kill_confirm', null, { vol: .9 }); }
  if (ev.v === SNP.me) { snpAnnClear(); }
  return true;
}
// ---------- annunciatore: un solo annuncio alla volta, il più importante; nessuna sovrapposizione ----------
function snpAnnounce(list) {
  if (!list.length) return;
  list.sort((a, b) => SNP_AN[b].p - SNP_AN[a].p);
  const top = list[0];
  // in coda resta al massimo un annuncio, e solo se più importante di quello in coda
  if (SNP2.busyT > 0) { if (!SNP2.q.length || SNP_AN[top].p > SNP_AN[SNP2.q[0]].p) SNP2.q = [top]; return; }
  snpAnnPlay(top);
}
function snpAnnPlay(k) {
  const A = SNP_AN[k]; SNP2.busyT = A.big >= 2 ? 1.6 : 1.1;
  snpAnnText(A);
  if (!SNPCFG.announce) return;
  const id = 'sniper.announcer.' + k, alt = k === 'multi_kill' ? 'sniper.announcer.multikill' : null;
  if (typeof caHas === 'function' && caHas(id)) caPlay(id, null, { vol: 1.1 });
  else if (alt && typeof caHas === 'function' && caHas(alt)) caPlay(alt, null, { vol: 1.1 });
  else snpAnnVoice(A.say);   // nessun file personale: voce sintetica del sistema (nessun audio di altri giochi)
}
function snpAnnVoice(t) {
  try { if (!window.speechSynthesis || SETTINGS.voices === false) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = 1.15; u.pitch = .55; u.volume = Math.min(1, (SETTINGS.volume || .85) * 1.1); speechSynthesis.speak(u); } catch (e) { }
}
function snpAnnClear() { SNP2.q = []; }
function snpAnnTick(dt) { if (SNP2.busyT > 0) { SNP2.busyT -= dt; if (SNP2.busyT <= 0 && SNP2.q.length) snpAnnPlay(SNP2.q.shift()); } }
// scritta centrale: rapida, con un colpo di scala e dissolvenza; sopra il reticolo, non sul bersaglio
function snpAnnText(A) {
  let el = SNP2.anEl; if (!el) { el = SNP2.anEl = document.createElement('div'); el.id = 'snpAnn'; document.body.appendChild(el); }
  el.textContent = A.txt; el.className = 'b' + A.big + (A.hs ? ' hs' : ''); void el.offsetWidth; el.classList.add('on');
}
// ---------- killfeed ----------
function snpFeedAdd(ev) {
  let el = SNP2.feedEl; if (!el) { el = SNP2.feedEl = document.createElement('div'); el.id = 'snpFeed'; document.body.appendChild(el); }
  const row = document.createElement('div'), me = n => n === SNP.me ? ' me' : '', col = t => t === 'A' ? 'a' : 'e';
  const wn = ev.w && WEAPONS[ev.w] ? WEAPONS[ev.w].name.replace(/ \(.*$/, '') : '';
  const tags = [wn, ev.zone === 'head' ? '<b class="hs">HEADSHOT</b>' : '', ev.dist ? Math.round(ev.dist) + ' m' : ''].filter(Boolean).join(' · ');
  row.innerHTML = ev.k ? `<span class="${col(ev.kt)}${me(ev.k)}">${ev.k}</span> <i>[${tags}]</i> <span class="${col(ev.vt)}${me(ev.v)}">${ev.v}</span>` : `<span class="${col(ev.vt)}${me(ev.v)}">${ev.v}</span> <i>[caduto]</i>`;
  el.prepend(row); while (el.children.length > 5) el.lastChild.remove();
  setTimeout(() => { row.style.opacity = 0; setTimeout(() => row.remove(), 600); }, 6500);
}
// ---------- classifica (Tab): aggiornata 4 volte al secondo solo quando è aperta ----------
function snpTabTick(dt) {
  const open = KEYS.Tab && !P.spawnMenu && !(SNP2.kc && SNP2.kc.on);
  SNP.tab.style.display = open ? 'block' : 'none';
  if (!open) return; SNP2.tabT -= dt; if (SNP2.tabT > 0) return; SNP2.tabT = .25;
  SNP.tab.innerHTML = snpBoardHTML();
}
function snpRowsSorted(team) {
  return [...SNP.board.entries()].map(([n, r]) => ({ n, ...r })).filter(r => !team || r.team === team)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || b.kills - a.kills || a.deaths - b.deaths || (b.heads || 0) - (a.heads || 0) || (a.n < b.n ? -1 : 1));
}
function snpKD(r) { return (r.kills / Math.max(1, r.deaths)).toFixed(2); }
function snpBoardHTML(end) {
  const left = Math.max(0, SNPCFG.time - SNP.t), clock = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const team = t => { const rows = snpRowsSorted(t), bots = rows.filter(r => r.bot).length;
    return `<div class="sbT"><div class="sbH ${t === 'A' ? 'a' : 'e'}"><b>${t === 'A' ? SNP.M.teamA : SNP.M.teamE}</b><span>${SNP.score[t]}</span><small>${rows.length - bots} giocatori · ${bots} bot</small></div>
      <table><tr class="hd"><td></td><td>PUNTI</td><td>U</td><td>M</td><td>TESTA</td><td>U/M</td><td>SERIE</td><td>PING</td></tr>${rows.map(r => `<tr class="${r.n === SNP.me ? 'me' : ''}"><td>${r.n}${r.bot ? `<small>${SNP_DIFF[r.lvl] ? SNP_DIFF[r.lvl].name : ''}</small>` : ''}</td><td>${r.score || 0}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.heads || 0}</td><td>${snpKD(r)}</td><td>${r.best || 0}</td><td>${r.bot ? '—' : r.ping !== undefined ? r.ping : r.n === SNP.me ? '0' : '—'}</td></tr>`).join('')}</table></div>`; };
  return `<div class="sb">${end ? '' : `<div class="sbTop">${clock} rimasti · obiettivo ${SNPCFG.goal} uccisioni${SNPCFG.hsOnly ? ' · SOLO COLPI ALLA TESTA' : ''}</div>`}<div class="sbCols">${team('A')}${team('E')}</div></div>`;
}
// fine partita: vincitore, migliori, statistiche personali
function snpEndHTML() {
  const all = snpRowsSorted(), best = (f, min = 1) => all.filter(r => f(r) >= min).sort((a, b) => f(b) - f(a))[0];
  const acc = r => r.shots >= 5 ? r.hits / r.shots : 0, aw = [
    ['MIGLIOR GIOCATORE', all[0], r => r.score + ' punti'],
    ['MIGLIOR CECCHINO', best(r => r.longest), r => 'colpo più lungo ' + r.longest + ' m'],
    ['PIÙ HEADSHOT', best(r => r.heads || 0), r => r.heads + ' alla testa'],
    ['SERIE MIGLIORE', best(r => r.best || 0), r => r.best + ' di fila'],
    ['PIÙ PRECISO', best(r => acc(r), .01), r => Math.round(acc(r) * 100) + '% a segno']].filter(a => a[1]);
  const me = SNP.board.get(SNP.me) || {}, fav = Object.entries(me.guns || {}).sort((a, b) => b[1] - a[1])[0];
  const life = me.lives ? (me.lifeSum + (SNP.t - (me.lifeT0 || 0))) / (me.lives + 1) : SNP.t;
  return `<div class="sbAw">${aw.map(([t, r, f]) => `<div><small>${t}</small><b>${r.n}</b><span>${f(r)}</span></div>`).join('')}</div>
    <div class="sbMe">LE TUE STATISTICHE · colpi ${me.shots || 0} · a segno ${me.hits || 0} (${me.shots ? Math.round(me.hits / me.shots * 100) : 0}%) · alla testa ${me.heads || 0} · headshot di fila ${me.hsBest || 0} · uccisioni ${me.kills || 0} · morti ${me.deaths || 0} · U/M ${snpKD({ kills: me.kills || 0, deaths: me.deaths || 0 })} · serie ${me.best || 0} · colpo più lungo ${me.longest || 0} m · vita media ${Math.round(life)} s${fav ? ' · fucile preferito ' + WEAPONS[fav[0]].name : ''}</div>` + snpBoardHTML(true);
}
// ---------- protezione allo spawn: termina allo scadere o al primo colpo ----------
function snpProtectStart() { MISSION.godT = SNPCFG.protect; }
