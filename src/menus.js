// Menù del gioco riorganizzati per sezione: Campagna, Battaglie navali, Cieli d'Europa e Impostazioni.
// Riusa i controlli esistenti (stessi id) spostandoli nei pannelli giusti, così la logica di avvio resta invariata.
(function () {
  const $ = id => document.getElementById(id);
  const css = `
  #menu.mx{background:linear-gradient(180deg,rgba(4,6,7,.96),rgba(10,13,12,.96));align-items:stretch;padding:0}
  #menu.mx>.panel{display:none}
  .mxW{display:flex;flex-direction:column;width:100%;min-height:100%;max-width:1180px;margin:0 auto;padding:18px 20px 22px;box-sizing:border-box;color:#e9dfc4}
  .mxTop{display:flex;align-items:center;gap:16px;border-bottom:1px solid rgba(232,196,106,.25);padding-bottom:12px;margin-bottom:16px}
  .mxTop h2{margin:0;font-size:clamp(22px,3.4vw,34px);letter-spacing:.08em;flex:1}
  .mxTop .k{font:600 11px Oswald,sans-serif;letter-spacing:.4em;color:#e8c46a;display:block;margin-bottom:2px}
  .mxBtn{width:auto;margin:0;padding:7px 14px;font:600 12px Oswald,sans-serif;letter-spacing:.15em;background:transparent;border:1px solid rgba(233,223,196,.35);color:#e9dfc4}
  .mxBtn:hover{background:rgba(232,196,106,.12);border-color:#e8c46a}
  .mxBody{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:22px;flex:1}
  .mxCards{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 140px);overflow:auto;padding-right:4px}
  .mxCard{all:unset;cursor:pointer;display:block;padding:12px 14px;border:1px solid rgba(233,223,196,.14);border-left:3px solid transparent;background:rgba(255,255,255,.025);transition:background .15s,border-color .15s}
  .mxCard:hover{background:rgba(232,196,106,.07)}
  .mxCard.on{border-left-color:#e8c46a;background:rgba(232,196,106,.11);border-color:rgba(232,196,106,.35)}
  .mxCard b{display:block;font:600 16px Oswald,sans-serif;letter-spacing:.08em;color:#efe6cf}
  .mxCard i{display:block;font:400 11px Oswald,sans-serif;letter-spacing:.25em;color:#e8c46a;font-style:normal;margin-top:2px}
  .mxSide{display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(233,223,196,.12);padding:16px 18px}
  .mxSide h3{margin:0;font-family:'Special Elite',monospace;font-weight:400;font-size:22px;color:#efe6cf}
  .mxSide .d{font-size:14px;line-height:1.55;color:#cfc9b6}
  .mxSide .o label{display:block;margin:0 0 10px;font-size:13px;letter-spacing:.06em;color:#cfc9b6}
  .mxSide .o select{margin-top:4px}
  .mxSide #startBtn{margin-top:auto;font-size:20px;letter-spacing:.2em}
  .mxHint{font-size:12px;color:#a9a391;line-height:1.6}
  #setScr{position:fixed;inset:0;z-index:41;display:none;background:linear-gradient(180deg,rgba(4,6,7,.97),rgba(10,13,12,.97));overflow:auto}
  .mxTabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
  .mxTab{width:auto;margin:0;padding:7px 16px;font:600 13px Oswald,sans-serif;letter-spacing:.15em;background:transparent;border:0;border-bottom:2px solid transparent;color:#cfc9b6}
  .mxTab:hover{background:none;color:#fff}
  .mxTab.on{border-bottom-color:#e8c46a;color:#efe6cf}
  .mxPane{display:none;max-width:640px}
  .mxPane.on{display:block}
  .mxPane label{display:block;margin:0 0 14px;font-size:14px;letter-spacing:.05em;color:#cfc9b6}
  .mxPane .keys{line-height:2.1}
  #pause .panel.small{background:rgba(10,13,12,.92);border:1px solid rgba(232,196,106,.25);padding:22px 24px;box-sizing:border-box}
  #pause h2{letter-spacing:.12em}
  #pause button{font-size:16px;letter-spacing:.2em}
  #pause #mainBtn{background:transparent;border-color:#6b6a5c;font-size:13px}
  @media (max-width:760px){.mxBody{grid-template-columns:1fr}.mxCards{max-height:none}}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // descrizioni di scenari e missioni
  const DESC = {
    omaha: ['6 GIUGNO 1944', 'Omaha Beach', 'Sbarca sotto il fuoco delle mitragliatrici del WN 62, apri un varco nel filo spinato e libera Colleville. Oppure difendi il bunker con la Wehrmacht.'],
    ard: ['DICEMBRE 1944', 'Ardenne — Bois Jacques', 'Tieni le buche nel bosco innevato di Bastogne, ferma i Panzer e riprendi Foy.'],
    E: ['FEBBRAIO 1943 · ASSE', 'Difesa del passo', 'Al comando di un Tiger I, con due Panzer IV, tieni il passo di Kasserine contro quattro ondate di Sherman che risalgono la valle. Il cannone da 8,8 cm perfora a distanze enormi, ma il Tiger è lento e i fianchi sono il suo punto debole: non farti aggirare.'],
    A: ['FEBBRAIO 1943 · ALLEATI', 'Passo di Kasserine', 'Al comando di uno Sherman, con tre carri della tua brigata, conquista la cresta, il villaggio di Sidi Bou Zid e il passo. Panzer IV, Tiger I e cannoni Pak 40: corazza vera davanti e ai fianchi, rimbalzi, cingoli spezzati, munizioni che esplodono. Infine tieni il passo contro il contrattacco.'],
    tun: ['1943', 'Tunisia — Medjez el-Bab', 'Deathmatch nel villaggio tunisino: tutti contro tutti o USA contro Afrika Korps.'],
    dd: ['MANICA 1944', 'Caccia nella Manica', 'Con il cacciatorpediniere Fletcher, intercetta le siluranti tedesche prima che colpiscano il convoglio.'],
    pt: ['MANICA 1944', 'Siluri sul convoglio', 'Una PT boat veloce e fragile contro un convoglio scortato: avvicinati di notte e lancia i siluri.'],
    escort: ['ATLANTICO 1944', 'Scorta al convoglio', 'Al comando dell’incrociatore Cleveland, porta i mercantili Liberty in salvo.'],
    line: ['1943', 'Battaglia di linea', 'La corazzata Texas contro lo Scharnhorst, nella burrasca del Mare del Nord.'],
    midway: ['4 GIUGNO 1942', 'Midway', 'Guida i Dauntless della Enterprise in picchiata sulle portaerei di Nagumo: Akagi, Kaga e Soryu.'],
    pearl: ['7 DICEMBRE 1941', 'Pearl Harbor', 'Domenica mattina, 7:55: tre ondate di aerei giapponesi su Battleship Row. Difendi la flotta in rada, o prendi un P-40.'],
    maine: ['IMMAGINARIA', 'Il mostro d’acciaio', 'La super corazzata Maine, sedici cannoni da 600 mm, contro una flotta intera.'],
    free: ['LIBERA', 'Battaglia libera', 'Ondate di navi nemiche sempre più grandi, con meteo casuale.'],
    norm: ['GIUGNO 1944', 'Normandia', 'Decollo dalla portaerei: caccia, colonne corazzate e treni sulla costa francese.'],
    manica: ['1944', 'La Manica', 'Dall’aeroporto RAF di Hawkinge, intercetta i caccia tedeschi sopra il canale.'],
    reno: ['1945', 'Il Reno', 'Dalla pista avanzata Y-29, attacca i ponti e scorta i bombardieri.'],
  };
  const SEC = {
    omaha: { title: 'CAMPAGNA', k: 'FANTERIA · 1943–1944', sel: 'optMap', opts: ['omaha', 'ard', 'tun'], start: 'INIZIA LA BATTAGLIA', show: ['optSide', 'modeL', 'tunModeL', 'planeL', 'optDiff', 'mp'] },
    sea: { title: 'BATTAGLIE NAVALI', k: 'MARE · 1941–1944', sel: 'optNavMis', start: 'SALPA', show: ['navL', 'planeL', 'optDiff'] },
    armor: { title: 'GUERRA CORAZZATA', k: 'CARRI ARMATI · 1943', sel: 'optKasSide', start: 'AVANTI, CARRI!', show: ['optDiff'] },
    air: { title: 'CIELI D’EUROPA', k: 'AVIAZIONE · 1944–1945', sel: 'optAirMap', start: 'DECOLLA', show: ['airMapL', 'planeL', 'optDiff'] },
  };

  let W, cardsEl, sideEl, optEl, cur = null;
  function build() {
    const menu = $('menu'); if (!menu || W) return; menu.classList.add('mx');
    W = document.createElement('div'); W.className = 'mxW';
    W.innerHTML = `<div class="mxTop"><button class="mxBtn" id="mxBack">← MENÙ</button><h2><span class="k"></span><span class="t"></span></h2><button class="mxBtn" id="mxSet">IMPOSTAZIONI</button></div>
      <div class="mxBody"><div class="mxCards"></div><div class="mxSide"><div><div class="k" style="font:600 11px Oswald;letter-spacing:.4em;color:#e8c46a"></div><h3></h3></div><div class="d"></div><div class="o"></div><div class="mxHint"></div></div></div>`;
    menu.appendChild(W); cardsEl = W.querySelector('.mxCards'); sideEl = W.querySelector('.mxSide'); optEl = sideEl.querySelector('.o');
    $('mxBack').onclick = () => { menu.classList.add('hidden'); window.INTRO && INTRO.showMain(); };
    $('mxSet').onclick = () => openSettings('setup');
    // pulsante d'avvio e messaggi nel pannello laterale
    sideEl.appendChild($('startBtn')); for (const id of ['netNote', 'netErr']) if ($(id)) sideEl.appendChild($(id));
    const old = $('backMain'); if (old) old.remove();
    buildSettings(); buildPause();
  }
  function wrapOf(id) { const e = $(id); if (!e) return null; if (id === 'mp') return document.querySelector('#menu .checks.mp') || (W && W.querySelector('.checks.mp')); return e.tagName === 'LABEL' ? e : e.closest('label') || e; }
  function open(sec) {
    build(); const S = SEC[sec] || SEC.omaha; cur = sec;
    W.querySelector('.mxTop .k').textContent = S.k; W.querySelector('.mxTop .t').textContent = S.title; $('startBtn').textContent = S.start;
    // la mappa giusta per la sezione
    const map = $('optMap'); const want = sec === 'omaha' ? (['omaha', 'ard', 'tun'].includes(map.value) ? map.value : 'omaha') : sec === 'armor' ? 'kas' : sec;
    if (map.value !== want) { map.value = want; map.dispatchEvent(new Event('change')); }
    // opzioni della sezione
    // i controlli della sezione precedente tornano nel deposito nascosto (non vanno distrutti)
    let stash = $('mxStash'); if (!stash) { stash = Object.assign(document.createElement('div'), { id: 'mxStash' }); stash.style.display = 'none'; W.appendChild(stash); }
    while (optEl.firstChild) stash.appendChild(optEl.firstChild);
    for (const id of S.show) { const w = wrapOf(id); if (w) optEl.appendChild(w); }
    // le schede sostituiscono i menù a tendina di missione e mappa
    for (const id of ['optNavMis', 'optAirMap', 'optKasSide']) if ($(id)) $(id).style.display = 'none';
    const rel = (id, t) => { const l = $(id); if (l && l.firstChild && l.firstChild.nodeType === 3) l.firstChild.textContent = t + ' '; };
    rel('navL', 'Nave e tiro'); rel('airMapL', 'Modalità');
    // schede
    const sel = $(S.sel), list = S.opts || [...sel.options].map(o => o.value); cardsEl.innerHTML = '';
    for (const v of list) {
      const D = DESC[v] || ['', ([...sel.options].find(o => o.value === v) || {}).textContent || v, ''];
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mxCard'; b.dataset.v = v; b.innerHTML = `<i>${D[0]}</i><b>${D[1]}</b>`;
      b.onclick = () => pick(S, v); cardsEl.appendChild(b);
    }
    pick(S, sel.value && list.includes(sel.value) ? sel.value : list[0]);
    $('menu').classList.remove('hidden'); $('menu').scrollTop = 0;
  }
  function pick(S, v) {
    const sel = $(S.sel); if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change')); }
    for (const c of cardsEl.children) c.classList.toggle('on', c.dataset.v === v);
    const D = DESC[v] || ['', v, '']; sideEl.querySelector('.k').textContent = D[0]; sideEl.querySelector('h3').textContent = D[1]; sideEl.querySelector('.d').textContent = D[2];
    sideEl.querySelector('.mxHint').innerHTML = cur === 'sea' ? 'Nave: <kbd>W/S</kbd> macchine · <kbd>A/D</kbd> timone · <kbd>Shift</kbd> binocolo · click fuoco · <kbd>Z</kbd> segui il proiettile · <kbd>Y</kbd> attacco aereo · <kbd>P</kbd> pilota un aereo'
      : cur === 'armor' ? 'Carro: <kbd>W/S</kbd> avanti e indietro · <kbd>A/D</kbd> sterzo · mouse torretta · click cannone · click dx ottica del cannoniere · <kbd>F</kbd> mitragliatrice. Mira ai fianchi: la corazza è più sottile'
      : cur === 'air' ? 'Aereo: mouse direzione · <kbd>A/D</kbd> rollio · <kbd>W/S</kbd> manetta · <kbd>Spazio</kbd> bomba · <kbd>V</kbd> visuale · <kbd>M</kbd> comandi manuali'
      : '<kbd>W A S D</kbd> movimento · click fuoco · click dx mira · <kbd>G</kbd> granata · <kbd>B</kbd> cambia ruolo · <kbd>T</kbd> supporto aereo';
  }

  // ---------- impostazioni ----------
  let setFrom = null;
  function buildSettings() {
    if ($('setScr')) return;
    const s = document.createElement('div'); s.id = 'setScr';
    s.innerHTML = `<div class="mxW"><div class="mxTop"><button class="mxBtn" id="setBack">← INDIETRO</button><h2><span class="k">FRONTE OCCIDENTALE 1944</span><span class="t">IMPOSTAZIONI</span></h2></div>
      <div class="mxTabs"><button class="mxTab on" data-p="g">GRAFICA</button><button class="mxTab" data-p="a">AUDIO</button><button class="mxTab" data-p="c">COMANDI</button><button class="mxTab" data-p="k">TASTI</button></div>
      <div class="mxPane on" data-p="g"></div><div class="mxPane" data-p="a"></div><div class="mxPane" data-p="c"></div><div class="mxPane" data-p="k"></div></div>`;
    document.body.appendChild(s);
    const P = k => s.querySelector(`.mxPane[data-p="${k}"]`), lab = id => $(id) && $(id).closest('label');
    for (const id of ['optQuality', 'optDyn', 'optFps', 'optGore']) { const l = lab(id); if (l) P('g').appendChild(l); }
    for (const id of ['optVol', 'optVoices']) { const l = lab(id); if (l) P('a').appendChild(l); }
    for (const id of ['optSens', 'optFov', 'optFovAir']) { const l = lab(id); if (l) P('c').appendChild(l); }
    const keys = document.querySelector('#menu .keys'); if (keys) P('k').appendChild(keys);
    for (const c of document.querySelectorAll('#menu .opts > .checks:not(.mp)')) if (!c.children.length) c.remove();
    s.querySelectorAll('.mxTab').forEach(t => t.onclick = () => { s.querySelectorAll('.mxTab').forEach(x => x.classList.toggle('on', x === t)); s.querySelectorAll('.mxPane').forEach(x => x.classList.toggle('on', x.dataset.p === t.dataset.p)); });
    $('setBack').onclick = () => { s.style.display = 'none'; if (setFrom === 'main') window.INTRO && INTRO.showMain(); else $('menu').classList.remove('hidden'); };
  }
  function openSettings(from) { build(); setFrom = from; $('menu').classList.add('hidden'); $('setScr').style.display = 'block'; }

  // ---------- pausa: torna al menù principale ----------
  function buildPause() {
    const r = $('restartBtn'); if (!r || $('mainBtn')) return;
    r.textContent = 'RICOMINCIA LA MISSIONE';
    const b = Object.assign(document.createElement('button'), { id: 'mainBtn', type: 'button', textContent: 'TORNA AL MENÙ PRINCIPALE' });
    b.onclick = () => { try { sessionStorage.setItem('skipIntro', '1'); } catch (e) {} location.reload(); };
    r.after(b);
  }
  window.MENUS = { open, openSettings };
  document.addEventListener('DOMContentLoaded', () => setTimeout(build, 0));
})();
