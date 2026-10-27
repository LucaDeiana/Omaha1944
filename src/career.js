"use strict";
// ============================================================
//  Carriera: statistiche permanenti fra le partite (missioni giocate e vinte,
//  nemici abbattuti, carri, tempo di gioco), gradi da Soldato a Colonnello,
//  medaglie con condizioni storiche e schermata dal menù principale.
// ============================================================
const CAREER = (function () {
  const KEY = 'omahaCareer';
  const MISSIONS = [
    ['omaha/A', 'Omaha Beach', 'Fanteria USA, 6 giugno 1944'], ['omaha/E', 'Difesa del WN 62', 'Wehrmacht, 6 giugno 1944'], ['ard', 'Ardenne — Bois Jacques', 'dicembre 1944'], ['tun', 'Medjez el-Bab', 'deathmatch, 1943'],
    ['kas/A', 'Passo di Kasserine', 'Sherman, febbraio 1943'], ['kas/E', 'Difesa del passo', 'Tiger I, febbraio 1943'], ['kas/S', 'Battaglia libera di carri', 'Sidi Bou Zid'],
    ['sea/dd', 'Caccia nella Manica', 'Fletcher'], ['sea/pt', 'Siluri sul convoglio', 'PT boat'], ['sea/escort', 'Scorta al convoglio', 'Cleveland'], ['sea/line', 'Battaglia di linea', 'Texas'], ['sea/midway', 'Midway', '4 giugno 1942'], ['sea/pearl', 'Pearl Harbor', '7 dicembre 1941'], ['sea/maine', 'Il mostro d’acciaio', 'immaginaria'], ['sea/free', 'Battaglia navale libera', 'ondate'],
    ['air/norm', 'Cieli di Normandia', 'dalla portaerei'], ['air/manica', 'La Manica', 'Hawkinge'], ['air/reno', 'Il Reno', 'pista Y-29'],
  ];
  const RANKS = [[0, 'Soldato'], [800, 'Soldato scelto'], [2000, 'Caporale'], [4000, 'Sergente'], [7000, 'Sergente maggiore'], [11000, 'Sottotenente'], [16000, 'Tenente'], [23000, 'Capitano'], [32000, 'Maggiore'], [45000, 'Tenente colonnello'], [60000, 'Colonnello']];
  const MEDALS = [
    ['first', 'Distintivo del combattente', 'Completa una missione', c => c.won >= 1],
    ['bronze', 'Stella di bronzo', 'Vinci 5 missioni', c => c.won >= 5],
    ['silver', 'Stella d’argento', 'Vinci 15 missioni', c => c.won >= 15],
    ['dsc', 'Distinguished Service Cross', 'Vinci tutte le missioni almeno una volta', c => MISSIONS.every(m => (c.m[m[0]] || {}).won)],
    ['heart', 'Purple Heart', 'Cadi in battaglia 25 volte', c => c.deaths >= 25],
    ['inf', 'Distintivo del fante combattente', '250 nemici abbattuti', c => c.kills >= 250],
    ['ace', 'Asso dell’aviazione', 'Vinci tutte le missioni aeree', c => ['air/norm', 'air/manica', 'air/reno'].every(k => (c.m[k] || {}).won)],
    ['navy', 'Navy Cross', 'Vinci 4 battaglie navali', c => MISSIONS.filter(m => m[0].startsWith('sea/') && (c.m[m[0]] || {}).won).length >= 4],
    ['armor', 'Distintivo dei carristi', 'Vinci le tre battaglie di carri', c => ['kas/A', 'kas/E', 'kas/S'].every(k => (c.m[k] || {}).won)],
    ['vet', 'Veterano', '5 ore di battaglia', c => c.time >= 5 * 3600],
  ];
  function load() { let c = null; try { c = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { } return Object.assign({ pts: 0, played: 0, won: 0, kills: 0, deaths: 0, heads: 0, time: 0, m: {}, medals: [] }, c || {}); }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } }
  function missionKey() {
    if (SCEN === 'omaha') return 'omaha/' + (typeof PT !== 'undefined' ? PT : 'A');
    if (SCEN === 'sea') return 'sea/' + (NV.misKey || 'dd');
    if (SCEN === 'air') return 'air/' + (typeof AIRMAP !== 'undefined' ? AIRMAP : 'norm');
    if (SCEN === 'kas') return 'kas/' + (KAS.side || 'A');
    return SCEN;
  }
  function rank(p) { let r = RANKS[0]; for (const x of RANKS) if (p >= x[0]) r = x; return r; }
  // fine partita: punti, missione, nuove medaglie e promozioni (mostrate nella schermata finale)
  function record(win) {
    const c = load(), k = missionKey(), before = rank(c.pts)[1], mb = c.medals.slice();
    const gained = Math.round((STATS.kills || 0) * 10 + (STATS.heads || 0) * 5 + (win ? 600 : 120) + Math.min(600, GAME.time / 2));
    c.pts += gained; c.played++; if (win) c.won++; c.kills += STATS.kills || 0; c.deaths += STATS.deaths || 0; c.heads += STATS.heads || 0; c.time += Math.round(GAME.time);
    const m = c.m[k] = c.m[k] || { played: 0, won: 0, best: 0 }; m.played++; if (win) m.won++; m.best = Math.max(m.best, STATS.kills || 0);
    for (const [id, , , f] of MEDALS) if (!c.medals.includes(id) && f(c)) c.medals.push(id);
    save(c);
    const after = rank(c.pts)[1], nm = c.medals.filter(x => !mb.includes(x)).map(id => MEDALS.find(q => q[0] === id)[1]);
    return `<div style="margin-top:10px;font:600 14px Oswald,sans-serif;letter-spacing:.06em;color:#e8c46a">+${gained} punti carriera${after !== before ? ' · PROMOSSO A ' + after.toUpperCase() : ''}${nm.length ? '<br>Medaglia: ' + nm.join(', ') : ''}</div>`;
  }
  // schermata della carriera
  function show() {
    const c = load(), [, rn] = rank(c.pts), nx = RANKS.find(r => r[0] > c.pts), prev = rank(c.pts)[0];
    let el = document.getElementById('careerScr');
    if (!el) { el = document.createElement('div'); el.id = 'careerScr'; el.style.cssText = 'position:fixed;inset:0;z-index:60;overflow:auto;background:linear-gradient(180deg,#050708,#0d0f0d);color:#e9dfc4;font-family:Oswald,sans-serif'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target.dataset.close !== undefined) el.style.display = 'none'; }); }
    const h = Math.floor(c.time / 3600), mi = Math.floor(c.time % 3600 / 60), pr = nx ? Math.round((c.pts - prev) / (nx[0] - prev) * 100) : 100;
    el.innerHTML = `<div style="max-width:1000px;margin:0 auto;padding:22px 20px">
      <div style="display:flex;align-items:center;gap:16px;border-bottom:1px solid rgba(232,196,106,.25);padding-bottom:12px;margin-bottom:16px"><button data-close style="width:auto;margin:0;padding:7px 14px;font:600 12px Oswald,sans-serif;letter-spacing:.15em;background:transparent;border:1px solid rgba(233,223,196,.35);color:#e9dfc4">← MENÙ</button>
      <h2 style="margin:0;flex:1;letter-spacing:.08em"><span style="display:block;font-size:11px;letter-spacing:.4em;color:#e8c46a">STATO DI SERVIZIO</span>CARRIERA</h2></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px">
        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(233,223,196,.12);padding:16px"><div style="font-size:11px;letter-spacing:.3em;color:#e8c46a">GRADO</div><div style="font:400 30px 'Special Elite',monospace;margin:4px 0">${rn}</div>
          <div style="font-size:13px;color:#cfc9b6">${c.pts.toLocaleString('it-IT')} punti${nx ? ' · prossimo grado: ' + nx[1] + ' a ' + nx[0].toLocaleString('it-IT') : ' · grado massimo'}</div><div style="height:6px;background:rgba(255,255,255,.1);margin-top:8px"><div style="height:100%;width:${pr}%;background:#e8c46a"></div></div>
          <table style="width:100%;margin-top:14px;font-size:14px;color:#cfc9b6">${[['Missioni giocate', c.played], ['Missioni vinte', c.won], ['Nemici abbattuti', c.kills], ['Colpi alla testa', c.heads], ['Volte caduto', c.deaths], ['Tempo in battaglia', h + ' h ' + mi + ' min']].map(r => `<tr><td>${r[0]}</td><td style="text-align:right;color:#efe6cf">${r[1]}</td></tr>`).join('')}</table></div>
        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(233,223,196,.12);padding:16px"><div style="font-size:11px;letter-spacing:.3em;color:#e8c46a;margin-bottom:8px">MEDAGLIE ${c.medals.length}/${MEDALS.length}</div>
          ${MEDALS.map(([id, n, d]) => { const ok = c.medals.includes(id); return `<div style="display:flex;gap:10px;align-items:center;margin:6px 0;opacity:${ok ? 1 : .38}"><div style="width:22px;height:22px;border-radius:50%;flex:none;background:${ok ? 'radial-gradient(circle at 35% 35%,#f4dc8a,#a8822e)' : '#3a3a34'};box-shadow:0 0 0 2px ${ok ? '#6b1f1f' : '#222'}"></div><div><div style="font-size:14px;color:#efe6cf">${n}</div><div style="font-size:11px;color:#a9a391">${d}</div></div></div>`; }).join('')}</div>
        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(233,223,196,.12);padding:16px;grid-column:1/-1"><div style="font-size:11px;letter-spacing:.3em;color:#e8c46a;margin-bottom:8px">MISSIONI</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:4px 18px">${MISSIONS.map(([k, n, d]) => { const m = c.m[k] || {}; return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:4px 0;border-bottom:1px solid rgba(233,223,196,.07)"><span><span style="color:${m.won ? '#8fc46a' : m.played ? '#d9b443' : '#555'}">${m.won ? '✓' : m.played ? '•' : '○'}</span> ${n} <span style="font-size:11px;color:#8a8576">${d}</span></span><span style="font-size:12px;color:#a9a391">${m.played ? m.won + '/' + m.played : ''}</span></div>`; }).join('')}</div></div>
      </div></div>`;
    el.style.display = 'block';
  }
  // aggancio alla fine della partita
  if (typeof GAME !== 'undefined') { const end0 = GAME.end; GAME.end = function (win) { if (this.over) return; let extra = ''; try { extra = record(win); } catch (e) { } end0.call(this, win); try { const t = document.getElementById('endText'); if (t && extra) t.innerHTML += extra; } catch (e) { } }; }
  return { show, record, load };
})();
