// Apertura del gioco: schermata "premi un tasto" (serve per l'audio), sigla della casa di produzione,
// filmato introduttivo in stile cinegiornale e menù principale. Tutto disegnato a mano su canvas e SVG.
(function () {
  const $ = id => document.getElementById(id);
  const css = `
  #intro{position:fixed;inset:0;z-index:50;background:#000;color:#e9dfc4;font-family:Oswald,sans-serif;overflow:hidden;user-select:none}
  #intro canvas{position:absolute;inset:0;width:100%;height:100%}
  #introGate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;cursor:pointer}
  #introGate .t{font-size:13px;letter-spacing:.5em;opacity:.6;animation:igp 1.6s ease-in-out infinite}
  @keyframes igp{50%{opacity:.15}}
  #studio{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:16px;text-align:center}
  #studio svg{width:min(300px,62vw);height:auto;opacity:0;transform:scale(.86);transition:opacity 1.4s ease,transform 4.5s cubic-bezier(.2,.7,.2,1)}
  #studio.on svg{opacity:1;transform:scale(1)}
  #studio .nm{font-family:'Special Elite',monospace;font-size:clamp(16px,3.2vw,26px);letter-spacing:.08em;color:#e8c46a;min-height:1.4em}
  #studio .pr{font-size:12px;letter-spacing:.6em;opacity:0;transition:opacity 1.2s ease 3.4s}
  #studio.on .pr{opacity:.7}
  #filmCap{position:absolute;left:0;right:0;bottom:12%;text-align:center;font-family:'Special Elite',monospace;padding:0 16px;text-shadow:0 0 6px #000}
  #filmCap .d{font-size:clamp(13px,2vw,17px);letter-spacing:.35em;color:#e8c46a}
  #filmCap .l{font-size:clamp(17px,3vw,28px);margin-top:8px;min-height:1.3em}
  #introSkip{position:absolute;right:18px;bottom:16px;font-size:12px;letter-spacing:.2em;opacity:.55;display:none}
  #introSkip kbd{border:1px solid #e9dfc4;padding:1px 6px;border-radius:3px;margin-right:4px}
  #mainMenu{position:fixed;inset:0;z-index:40;display:none;overflow:hidden;background:#05080a}
  #mainMenu canvas{position:absolute;inset:0;width:100%;height:100%}
  #mainMenu .mm{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:16px 8vw;box-sizing:border-box;gap:6px}
  #mainMenu .k{font-size:12px;letter-spacing:.5em;color:#e8c46a;opacity:.85}
  #mainMenu h1{font-family:'Special Elite',monospace;font-weight:400;font-size:clamp(30px,6.4vw,72px);margin:4px 0 26px;color:#efe6cf;letter-spacing:.04em;line-height:1.05;text-shadow:0 4px 24px rgba(0,0,0,.8)}
  #mainMenu button.mmb{display:block;width:min(340px,100%);text-align:left;background:linear-gradient(90deg,rgba(20,24,22,.78),rgba(20,24,22,0));border:0;border-left:3px solid transparent;color:#e9dfc4;font:600 clamp(16px,2.2vw,21px) Oswald,sans-serif;letter-spacing:.14em;padding:11px 16px;cursor:pointer;transition:border-color .2s,padding .2s,color .2s}
  #mainMenu button.mmb:hover,#mainMenu button.mmb:focus-visible{border-left-color:#e8c46a;padding-left:26px;color:#fff;outline:none}
  #mainMenu button.mmb small{display:block;font:400 11px Oswald,sans-serif;letter-spacing:.12em;opacity:.55;margin-top:2px}
  @media (max-height:860px){#mainMenu .mm{gap:2px;padding-top:10px;padding-bottom:10px}#mainMenu button.mmb{padding-top:6px!important;padding-bottom:6px!important;font-size:17px}#mainMenu .mm h1{font-size:clamp(28px,5.2vh,54px)!important;margin:4px 0 10px!important}#mainMenu button.mmb small{font-size:10px}}
  @media (max-height:640px){#mainMenu button.mmb small{display:none}}
  #mainMenu .ft{position:absolute;left:8vw;right:16px;bottom:14px;display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.15em;opacity:.55}
  #mainMenu .ft svg{width:30px;height:30px}
  #mmCredits{position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.82);padding:16px}
  #mmCredits .c{max-width:560px;font-size:14px;line-height:1.6;color:#e9dfc4;text-align:center}
  #mmCredits h2{font-family:'Special Elite',monospace;font-weight:400;color:#e8c46a;letter-spacing:.1em}
  #backMain{background:none;border:1px solid rgba(233,223,196,.4);color:#e9dfc4;font:600 12px Oswald,sans-serif;letter-spacing:.15em;padding:6px 12px;cursor:pointer;margin-bottom:12px}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // logo della casa di produzione: medaglione con due palline minuscole sotto una lente d'ingrandimento
  const LOGO = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-label="Le palle di Luca sono piccine piccine">
    <defs>
      <radialGradient id="lgB" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#3a1414"/><stop offset="1" stop-color="#140707"/></radialGradient>
      <radialGradient id="lgG" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff2c0"/><stop offset=".45" stop-color="#e3b452"/><stop offset="1" stop-color="#7a5418"/></radialGradient>
      <radialGradient id="lgL" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#cfe6ff" stop-opacity=".35"/><stop offset="1" stop-color="#9fc4e8" stop-opacity=".08"/></radialGradient>
      <path id="lgT" d="M 46 150 A 104 104 0 0 1 254 150"/><path id="lgU" d="M 40 150 A 110 110 0 0 0 260 150"/>
    </defs>
    <circle cx="150" cy="150" r="146" fill="url(#lgB)" stroke="#e3b452" stroke-width="4"/>
    <circle cx="150" cy="150" r="128" fill="none" stroke="#e3b452" stroke-width="1.2" stroke-dasharray="2 5"/>
    <text font-family="Oswald,sans-serif" font-weight="600" font-size="19" letter-spacing="4" fill="#e3b452"><textPath href="#lgT" startOffset="50%" text-anchor="middle">LE PALLE DI LUCA</textPath></text>
    <text font-family="Oswald,sans-serif" font-weight="600" font-size="15" letter-spacing="3" fill="#e3b452"><textPath href="#lgU" startOffset="50%" text-anchor="middle" dominant-baseline="hanging">SONO PICCINE PICCINE</textPath></text>
    <line x1="92" y1="196" x2="208" y2="196" stroke="#e3b452" stroke-width="2"/>
    <circle cx="143" cy="191" r="5" fill="url(#lgG)"/><circle cx="156" cy="191.5" r="4.4" fill="url(#lgG)"/>
    <g class="lens"><circle cx="150" cy="138" r="40" fill="url(#lgL)" stroke="#e3b452" stroke-width="6"/>
      <circle cx="143" cy="138" r="13" fill="url(#lgG)" opacity=".95"/><circle cx="162" cy="140" r="11.5" fill="url(#lgG)" opacity=".95"/>
      <path d="M 128 120 A 26 26 0 0 1 150 112" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>
      <line x1="178" y1="166" x2="214" y2="204" stroke="#e3b452" stroke-width="11" stroke-linecap="round"/>
      <line x1="178" y1="166" x2="214" y2="204" stroke="#7a5418" stroke-width="3" stroke-linecap="round"/></g>
    <text x="150" y="232" text-anchor="middle" font-family="Special Elite,monospace" font-size="11" fill="#e3b452" opacity=".8">— PRODUZIONI —</text>
  </svg>`;

  const root = document.createElement('div'); root.id = 'intro';
  root.innerHTML = `<canvas id="introC"></canvas>
    <div id="introGate"><div style="font-family:'Special Elite',monospace;font-size:clamp(18px,3vw,26px);letter-spacing:.1em">FRONTE OCCIDENTALE 1944</div><div class="t">CLICCA O PREMI UN TASTO</div></div>
    <div id="studio">${LOGO}<div class="nm"></div><div class="pr">PRESENTA</div></div>
    <div id="filmCap"><div class="d"></div><div class="l"></div></div>
    <div id="introSkip"><kbd>Spazio</kbd> salta</div>`;
  const mm = document.createElement('div'); mm.id = 'mainMenu';
  mm.innerHTML = `<canvas id="mmC"></canvas><div class="mm">
      <img id="mmLogo" alt="" style="display:none;max-width:min(260px,60vw);max-height:120px;margin-bottom:8px;filter:drop-shadow(0 4px 18px rgba(0,0,0,.8))">
      <div class="k">1941 · 1942 · 1943 · 1944</div>
      <h1>FRONTE<br>OCCIDENTALE 1944</h1>
      <button class="mmb" data-go="omaha">CAMPAGNA<small>Omaha Beach, Ardenne, Tunisia</small></button>
      <button class="mmb" data-go="sea">BATTAGLIE NAVALI<small>Pearl Harbor, Midway, la Manica</small></button>
      <button class="mmb" data-go="armor">GUERRA CORAZZATA<small>Sherman contro Tiger a Kasserine</small></button>
      <button class="mmb" data-go="air">CIELI D'EUROPA<small>Caccia, bombardieri, portaerei</small></button>
      <button class="mmb" data-go="career">CARRIERA<small>Grado, medaglie e missioni completate</small></button>
      <button class="mmb" data-go="opts">IMPOSTAZIONI<small>Grafica, audio, comandi</small></button>
      <button class="mmb" data-go="models">MODELLI 3D<small>Navi, aerei, mezzi e armi da vicino</small></button>
      <button class="mmb" data-go="intro">RIVEDI L'INTRODUZIONE</button>
      <button class="mmb" data-go="cred">RICONOSCIMENTI</button>
    </div>
    <div class="ft">${LOGO}<span>UNA PRODUZIONE «LE PALLE DI LUCA SONO PICCINE PICCINE»</span></div>`;
  const cr = document.createElement('div'); cr.id = 'mmCredits';
  cr.innerHTML = `<div class="c"><div style="width:140px;margin:0 auto">${LOGO}</div><h2>LE PALLE DI LUCA SONO PICCINE PICCINE</h2>
    <p>Ideazione e regia: Luca Deiana<br>Programmazione: Luca Deiana e Claude</p>
    <p style="opacity:.75">Suoni reali di pubblico dominio (CC0): Internet Archive — Red Library, GOLD TAPE, SSE Library; OpenGameArt.<br>Musiche (CC0): «War Theme» e «Some Militaristic Tune» di Spring Spring, OpenGameArt.<br>Grafica 3D: three.js. Caratteri: Oswald e Special Elite (Google Fonts).</p>
    <p style="opacity:.55;font-size:12px">Clicca per chiudere</p></div>`;
  document.body.append(root, mm, cr);
  { const im = mm.querySelector('#mmLogo'); im.onload = () => im.style.display = 'block'; im.src = 'assets/music/personali/logo.png'; }

  // ---------- audio: buffer decodificati dai suoni veri del gioco ----------
  let AC = null; const BUF = {};
  function initAudio() {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const W = window.SFX_WAR || {};
    for (const k of ['air_raid', 'boom_big', 'boom_far', 'dive', 'flyby', 'ship_far', 'flak_far', 'surf', 'whistle', 'eng_bomber']) {
      const v = W[k]; if (!v) continue; const b64 = Array.isArray(v) ? v[0] : v;
      try { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); AC.decodeAudioData(u.buffer, b => BUF[k] = b, () => {}); } catch (e) {}
    }
  }
  const live = [];
  function snd(k, vol = 1, rate = 1, delay = 0) {
    if (!AC || !BUF[k]) return; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = BUF[k]; s.playbackRate.value = rate; g.gain.value = vol * menuVol();
    s.connect(g).connect(AC.destination); s.start(AC.currentTime + delay); live.push({ s, g });
  }
  function hush(t = .6) { if (!AC) return; for (const o of live) { try { o.g.gain.setTargetAtTime(0, AC.currentTime, t / 3); o.s.stop(AC.currentTime + t); } catch (e) {} } live.length = 0; }
  function menuVol() { const v = $('optVol'); return v ? Math.max(0, +v.value || .8) : .8; }
  // sigla: accordo caldo di archi sintetici e due campanellini minuscoli ("piccine piccine")
  function jingle() {
    if (!AC) return; const t0 = AC.currentTime + .1, out = AC.createGain(); out.gain.value = .22 * menuVol(); out.connect(AC.destination);
    for (const [f, d] of [[130.8, 0], [196, .15], [261.6, .3], [329.6, .45], [392, .6]]) {
      for (const det of [-4, 4]) { const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; lp.type = 'lowpass'; lp.frequency.value = 900;
        g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(.12, t0 + d + 1.2); g.gain.setTargetAtTime(0, t0 + 4.2, .7); o.connect(lp).connect(g).connect(out); o.start(t0 + d); o.stop(t0 + 7); }
    }
    for (const [f, d] of [[2093, 2.7], [2637, 3.05]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(.5, t0 + d + .01); g.gain.exponentialRampToValueAtTime(.001, t0 + d + 1.4); o.connect(g).connect(out); o.start(t0 + d); o.stop(t0 + d + 1.5); }
  }

  // ---------- musica: prima i file personali (assets/music/personali), poi i brani CC0 ----------
  const MUS = { a: null, key: '', fadeT: 0 };
  function music(key, vol = .55) {
    if (MUS.key === key && MUS.a && !MUS.a.paused) return; stopMusic(.4);
    const files = { intro: ['assets/music/personali/intro.mp3', 'assets/music/intro_march.mp3'], menu: ['assets/music/personali/menu.mp3', 'assets/music/menu_war_theme.mp3'] }[key];
    const a = new Audio(); a.loop = key === 'menu'; a.volume = 0; MUS.a = a; MUS.key = key; MUS.want = vol;
    let i = 0; a.onerror = () => { if (++i < files.length) { a.src = files[i]; a.play().catch(() => {}); } }; a.src = files[0]; a.play().catch(() => {});
    clearInterval(MUS.fadeT); MUS.fadeT = setInterval(() => { if (MUS.a !== a) return clearInterval(MUS.fadeT); a.volume = Math.min(MUS.want * menuVol(), a.volume + .03); if (a.volume >= MUS.want * menuVol()) clearInterval(MUS.fadeT); }, 50);
  }
  function stopMusic(t = 1) { const a = MUS.a; if (!a) return; MUS.a = null; MUS.key = ''; const st = a.volume / (t * 20); const iv = setInterval(() => { a.volume = Math.max(0, a.volume - st); if (a.volume <= 0) { a.pause(); clearInterval(iv); } }, 50); }
  // il volume del menù segue il cursore del volume
  document.addEventListener('input', e => { if (e.target && e.target.id === 'optVol' && MUS.a) MUS.a.volume = Math.min(1, MUS.want * menuVol()); });
  // la battaglia comincia: la musica sfuma
  document.addEventListener('click', e => { if (e.target && e.target.id === 'startBtn') stopMusic(1.5); }, true);

  // ---------- disegno ----------
  const cv = $('introC'), g = cv.getContext('2d'); let W = 0, H = 0;
  function fit(c) { const r = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * r; c.height = innerHeight * r; return c.getContext('2d').setTransform(r, 0, 0, r, 0, 0); }
  function resize() { fit(cv); fit($('mmC')); W = innerWidth; H = innerHeight; }
  addEventListener('resize', resize); resize();
  const rnd = (a, b) => a + Math.random() * (b - a), cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const seed = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

  function sky(c, top, bot, hz) { const gr = c.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, top); gr.addColorStop(1, bot); c.fillStyle = gr; c.fillRect(0, 0, W, hz); }
  function sea(c, hz, col, t) {
    const gr = c.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); c.fillStyle = gr; c.fillRect(0, hz, W, H - hz);
    c.strokeStyle = 'rgba(255,240,210,.07)'; c.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const y = hz + Math.pow(i / 26, 1.7) * (H - hz); c.beginPath(); for (let x = 0; x <= W; x += 24) c.lineTo(x, y + Math.sin(x * .02 + t * 1.3 + i) * (1 + i * .15)); c.stroke(); }
  }
  // sagoma di nave: scafo, sovrastrutture, torri e fumaioli
  function ship(c, x, y, s, kind, col = '#0d0b09') {
    c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col;
    c.beginPath(); c.moveTo(-100, 0); c.lineTo(-92, 9); c.lineTo(92, 9); c.lineTo(104, -4); c.lineTo(96, -4); c.lineTo(-100, -2); c.fill();
    if (kind === 'cv') { c.fillRect(-98, -12, 196, 4); c.fillRect(-80, -8, 160, 6); c.fillRect(20, -24, 12, 12); c.fillRect(25, -34, 2, 10); }
    else { c.fillRect(-20, -18, 34, 14); c.fillRect(-8, -40, 10, 24); c.fillRect(-12, -46, 18, 6); c.fillRect(18, -26, 9, 22);
      for (const tx of [-70, -48, 50, 72]) { c.fillRect(tx - 9, -10, 18, 7); c.fillRect(tx + (tx < 0 ? 8 : -26), -8, 18, 2); } }
    c.restore();
  }
  function plane(c, x, y, s, rot = 0, col = '#0b0907') { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 14, 2.4, 0, 0, 7); c.fill(); c.fillRect(-3, -1, 6, 2); c.beginPath(); c.moveTo(-2, 0); c.lineTo(3, -15); c.lineTo(6, -15); c.lineTo(4, 0); c.lineTo(6, 15); c.lineTo(3, 15); c.closePath(); c.fill(); c.fillRect(-13, -5, 2, 10); c.restore(); }
  function smoke(c, x, y, h, w, t, k = 1) { for (let i = 0; i < 14; i++) { const f = i / 14, yy = y - f * h, xx = x + Math.sin(f * 3 + t * .4) * w * .6 + f * w * 1.4; c.fillStyle = `rgba(14,12,10,${.32 * (1 - f) * k})`; c.beginPath(); c.arc(xx, yy, w * (.4 + f * 1.3), 0, 7); c.fill(); } }
  function boom(c, x, y, r, a) { if (a <= 0) return; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,245,200,${a})`); gr.addColorStop(.35, `rgba(255,170,60,${a * .8})`); gr.addColorStop(1, 'rgba(120,40,0,0)'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function grade(c, t, k) {
    // pellicola: seppia, tremolio, graffi, grana, vignetta
    c.globalCompositeOperation = 'color'; c.fillStyle = 'rgba(112,88,52,.55)'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    c.fillStyle = `rgba(0,0,0,${.06 + Math.random() * .07})`; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) if (Math.random() < .35) { c.strokeStyle = `rgba(240,230,200,${rnd(.05, .18)})`; c.lineWidth = rnd(.5, 1.5); const x = rnd(0, W); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + rnd(-6, 6), H); c.stroke(); }
    for (let i = 0; i < 160; i++) { c.fillStyle = Math.random() < .5 ? 'rgba(255,250,230,.07)' : 'rgba(0,0,0,.12)'; c.fillRect(rnd(0, W), rnd(0, H), rnd(1, 2.5), rnd(1, 2.5)); }
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.85)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (k < 1) { c.fillStyle = `rgba(0,0,0,${1 - k})`; c.fillRect(0, 0, W, H); }
  }

  // ---------- scene del filmato ----------
  const SCENES = [
    { d: '7 DICEMBRE 1941 · PEARL HARBOR', l: 'All’alba di una domenica, il cielo si riempie di aerei.', T: 7,
      start() { snd('air_raid', .6); snd('eng_bomber', .5, 1, .5); snd('boom_far', .9, 1, 3); snd('boom_big', .8, 1, 4.6); },
      draw(c, t) { const hz = H * .6; sky(c, '#5d6c7a', '#e9c79a', hz); c.fillStyle = 'rgba(255,230,170,.9)'; c.beginPath(); c.arc(W * .78, hz - 30, 34, 0, 7); c.fill();
        c.fillStyle = '#1a1714'; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += 30) c.lineTo(x, hz - 30 - Math.sin(x * .008) * 26 - Math.sin(x * .021) * 10); c.lineTo(W, hz); c.fill();
        sea(c, hz, ['#3d4b52', '#121a1e'], t);
        const s = Math.min(W, H) / 700; for (let i = 0; i < 4; i++) ship(c, W * (.2 + i * .19), hz + 18 + i * 3, s * (.9 + i * .05));
        if (t > 3) { smoke(c, W * .39, hz + 5, H * .45, 30 * s, t, cl((t - 3) / 2, 0, 1)); boom(c, W * .39, hz + 8, 90 * s, cl(1 - (t - 3) * 1.2, 0, 1)); }
        if (t > 4.6) { smoke(c, W * .58, hz + 5, H * .4, 26 * s, t, cl((t - 4.6) / 2, 0, 1)); boom(c, W * .58, hz + 8, 140 * s, cl(1 - (t - 4.6), 0, 1)); }
        const r = seed(7); for (let i = 0; i < 9; i++) { const x = W * (1.1 - t * .13 - r() * .3) + i * 40, y = H * (.12 + r() * .25); plane(c, x, y, s * (1 + r() * .5), Math.PI); } } },
    { d: '4 GIUGNO 1942 · MIDWAY', l: 'Cinque minuti cambiarono la guerra nel Pacifico.', T: 6.5,
      start() { snd('dive', .8, 1, .3); snd('whistle', .6, 1, 2.6); snd('boom_big', 1, 1, 3.4); },
      draw(c, t) { const hz = H * .55; sky(c, '#6f8796', '#c9d4d4', hz); sea(c, hz, ['#4b6470', '#15232a'], t);
        const s = Math.min(W, H) / 600, k = cl(t / 3.4, 0, 1);
        ship(c, W * .5, hz + 26, s * 1.25, 'cv');
        if (t < 3.4) plane(c, W * .5 + (1 - k) * W * .1, H * (.05 + k * .5), s * (1.5 + k * 1.3), Math.PI / 2 * .9);
        if (t > 3.4) { boom(c, W * .5, hz + 14, 220 * s, cl(1.4 - (t - 3.4) * .8, 0, 1)); smoke(c, W * .5, hz + 10, H * .5, 40 * s, t, cl((t - 3.4) / 1.5, 0, 1)); } } },
    { d: '6 GIUGNO 1944 · OMAHA BEACH', l: 'La più grande flotta mai vista si avvicina alla Normandia.', T: 6.5,
      start() { snd('ship_far', .9, 1, .2); snd('surf', .5); snd('ship_far', .8, .9, 2.2); snd('flak_far', .5, 1, 3.5); },
      draw(c, t) { const hz = H * .5; sky(c, '#5b605f', '#a7a69a', hz); c.fillStyle = '#25231e'; c.beginPath(); c.moveTo(0, hz); for (let x = 0; x <= W; x += 20) c.lineTo(x, hz - 40 - Math.sin(x * .006) * 15); c.lineTo(W, hz); c.fill();
        sea(c, hz, ['#4c5650', '#151a18'], t); const s = Math.min(W, H) / 800;
        for (let i = 0; i < 7; i++) ship(c, W * (.08 + i * .15), hz + 6, s * .5);
        for (let i = 0; i < 14; i++) { const x = W * (.05 + (i * .071) % 1), y = H * (.66 + (i % 4) * .07) - t * 6 * (1 + i % 3); c.fillStyle = '#0c0b09'; c.fillRect(x, y, 34 * s, 10 * s); c.fillRect(x + 2 * s, y - 6 * s, 30 * s, 6 * s); }
        for (let i = 0; i < 6; i++) { const tt = (t * 1.3 + i * .37) % 1.6; if (tt < .5) { c.strokeStyle = `rgba(255,190,90,${1 - tt * 2})`; c.lineWidth = 1.5; const x0 = W * (.15 + i * .14), y0 = hz - 36; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + tt * 160, y0 + tt * 200); c.stroke(); } }
        if (t > 2.2) boom(c, W * .33, hz - 30, 60 * s * 2, cl(1 - (t - 2.2) * 1.5, 0, 1)); } },
    { d: 'DICEMBRE 1944 · ARDENNE', l: 'Nella neve di Bastogne, nessuno arretra.', T: 6,
      start() { snd('boom_far', .8, .9, .6); snd('boom_far', .6, .8, 2.4); snd('flak_far', .4, .8, 3.8); },
      draw(c, t) { sky(c, '#8b9196', '#c9cbc8', H); c.fillStyle = '#d9dad5'; c.fillRect(0, H * .7, W, H * .3); const r = seed(3);
        for (let l = 0; l < 3; l++) for (let i = 0; i < 26; i++) { const x = r() * W, h = H * (.1 + r() * .14) * (1 + l * .35), y = H * (.72 + l * .07); c.fillStyle = ['#5a5d5c', '#33302b', '#16130f'][l]; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x - h * .18, y); c.lineTo(x + h * .18, y); c.fill(); }
        for (let i = 0; i < 4; i++) { const ft = (t * 2 + i * .7) % 2.4; if (ft < .08) boom(c, W * (.2 + i * .2), H * .8, 20, 1); }
        c.fillStyle = 'rgba(255,255,255,.75)'; const rs = seed(11); for (let i = 0; i < 220; i++) { const x = (rs() * W + t * 18 * (rs() + .3)) % W, y = (rs() * H + t * 40 * (rs() + .5)) % H; c.fillRect(x, y, 2, 2); } } },
  ];
  const TITLE_T = 5;

  let state = 'gate', sc = -1, st = 0, last = 0, raf = 0, typed = '';
  function setCap(d, l) { const cap = $('filmCap'); cap.querySelector('.d').textContent = d; cap.querySelector('.l').textContent = ''; typed = l; }
  function tick(now) {
    raf = requestAnimationFrame(tick); const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; st += dt;
    if (state === 'studio') {
      const nm = 'LE PALLE DI LUCA SONO PICCINE PICCINE', n = cl(Math.floor((st - 1.2) * 16), 0, nm.length); $('studio').querySelector('.nm').textContent = nm.slice(0, n);
      const lens = $('studio').querySelector('.lens'); if (lens) lens.setAttribute('transform', `translate(${Math.sin(st * 1.4) * 6} ${Math.cos(st * 1.1) * 3})`);
      if (st > 7.2) $('studio').style.opacity = cl(1 - (st - 7.2) / .8, 0, 1);
      if (st > 8) startFilm();
    } else if (state === 'film') {
      const S = SCENES[sc]; g.clearRect(0, 0, W, H);
      if (S) { S.draw(g, st); grade(g, st, cl(Math.min(st / .6, (S.T - st) / .6), 0, 1));
        const L = $('filmCap').querySelector('.l'), n = cl(Math.floor((st - .6) * 30), 0, typed.length); if (L.textContent.length !== n) L.textContent = typed.slice(0, n);
        if (st > S.T) nextScene(); }
      else { // titolo finale
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const k = cl(st / 1.5, 0, 1), z = 1 + st * .025;
        g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.textAlign = 'center'; g.fillStyle = `rgba(239,230,207,${k})`; g.font = `${Math.min(W / 10, 90)}px 'Special Elite',monospace`; g.fillText('FRONTE', 0, -8); g.fillText('OCCIDENTALE 1944', 0, Math.min(W / 10, 90) * .95);
        g.font = `600 ${Math.min(W / 46, 15)}px Oswald,sans-serif`; g.fillStyle = `rgba(232,196,106,${k * .9})`; g.fillText('MARE · CIELO · TERRA', 0, -Math.min(W / 10, 90) * .95); g.restore();
        grade(g, st, cl(Math.min(st / .5, (TITLE_T - st) / .8), 0, 1)); if (st > TITLE_T) showMain();
      }
    } else if (state !== 'gate') cancelAnimationFrame(raf);
  }
  function startStudio() {
    if (state !== 'gate') return; state = 'studio'; st = 0; initAudio(); jingle();
    $('introGate').style.display = 'none'; const s = $('studio'); s.style.display = 'flex'; s.style.opacity = 1; requestAnimationFrame(() => s.classList.add('on')); $('introSkip').style.display = 'block';
  }
  function startFilm() { music('intro', .32); state = 'film'; $('studio').style.display = 'none'; $('studio').classList.remove('on'); sc = -1; nextScene(); }
  function nextScene() {
    sc++; st = 0; const S = SCENES[sc];
    if (S) { setCap(S.d, S.l); S.start(); } else { setCap('', ''); snd('boom_big', .9, .8, .2); }
  }
  function skip() { if (state === 'gate') return startStudio(); if (state === 'studio') { hush(.3); return startFilm(); } if (state === 'film') showMain(); }
  function showMain() {
    hush(.8); music('menu', .5); state = 'menu'; root.style.display = 'none'; $('menu').classList.add('hidden'); mm.style.display = 'block'; menuBg(); const b = mm.querySelector('.mmb'); if (b) b.focus({ preventScroll: true });
  }
  function playIntro() { mm.style.display = 'none'; root.style.display = 'block'; state = 'gate'; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); if (AC) startStudio(); else { state = 'gate'; } }

  // sfondo animato del menù: mare notturno con fari che frugano il cielo e una corazzata in lontananza
  let mmRaf = 0;
  function menuBg() {
    const c = $('mmC').getContext('2d'); let t0 = performance.now();
    cancelAnimationFrame(mmRaf);
    const loop = now => {
      if (mm.style.display === 'none') return; mmRaf = requestAnimationFrame(loop); const t = (now - t0) / 1000, hz = H * .62;
      sky(c, '#06090c', '#2a3036', hz);
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + Math.sin(t * .23 + i * 2.1) * .6, x = W * (.55 + i * .15), y = hz; const gr = c.createLinearGradient(x, y, x + Math.cos(a) * H, y + Math.sin(a) * H); gr.addColorStop(0, 'rgba(230,230,200,.18)'); gr.addColorStop(1, 'rgba(230,230,200,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a - .04) * H * 1.2, y + Math.sin(a - .04) * H * 1.2); c.lineTo(x + Math.cos(a + .04) * H * 1.2, y + Math.sin(a + .04) * H * 1.2); c.fill(); }
      const fl = (t * .7) % 5; if (fl < .25) { c.fillStyle = `rgba(255,190,120,${(1 - fl * 4) * .2})`; c.fillRect(0, 0, W, hz); }
      sea(c, hz, ['#1c2328', '#05080a'], t); const s = Math.min(W, H) / 520; ship(c, W * .72 + Math.sin(t * .05) * 20, hz + 14, s, 'bb', '#030405');
      for (let i = 0; i < 3; i++) plane(c, ((t * 22 + i * 90) % (W + 200)) - 100, H * (.16 + i * .04), s * .5, 0, '#020304');
      const v = c.createLinearGradient(0, 0, W * .7, 0); v.addColorStop(0, 'rgba(0,0,0,.75)'); v.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    };
    mmRaf = requestAnimationFrame(loop);
  }
  function openSetup(map) {
    mm.style.display = 'none'; cancelAnimationFrame(mmRaf);
    if (window.MENUS) return map === 'opts' ? MENUS.openSettings('main') : MENUS.open(map); const m = $('menu'); m.classList.remove('hidden');
    if (map && map !== 'opts') { const sel = $('optMap'); if (sel && sel.value !== map) { sel.value = map; sel.dispatchEvent(new Event('change')); } }
    if (map === 'opts') { const q = $('optQuality'); if (q) q.scrollIntoView({ block: 'center' }); } else m.scrollTop = 0;
  }
  mm.addEventListener('click', e => { const b = e.target.closest('.mmb'); if (!b) return; const go = b.dataset.go; if (go === 'models') { window.open('viewer.html', '_blank'); return; } if (go === 'career') { if (window.CAREER || typeof CAREER !== 'undefined') CAREER.show(); return; }
    if (go === 'intro') return playIntro(); if (go === 'cred') { cr.style.display = 'flex'; return; } openSetup(go); });
  cr.addEventListener('click', () => cr.style.display = 'none');
  root.addEventListener('click', () => state === 'gate' ? startStudio() : skip());
  addEventListener('keydown', e => { if (root.style.display === 'none') { if (e.key === 'Escape' && cr.style.display === 'flex') cr.style.display = 'none'; return; } e.preventDefault(); e.stopPropagation(); if (state === 'gate') startStudio(); else if (e.code === 'Space' || e.key === 'Escape' || e.key === 'Enter') skip(); }, true);

  // pulsante "torna al menù principale" sopra le impostazioni della partita
  document.addEventListener('DOMContentLoaded', () => {
    const panel = $('menu') && $('menu').querySelector('.panel'); if (!panel) return;
    const b = Object.assign(document.createElement('button'), { id: 'backMain', type: 'button', textContent: '← MENÙ PRINCIPALE' });
    b.addEventListener('click', () => { $('menu').classList.add('hidden'); mm.style.display = 'block'; menuBg(); }); panel.prepend(b);
    $('menu').classList.add('hidden');
  });
  // tornando dalla pausa si salta l'introduzione
  let skipNow = false; try { skipNow = sessionStorage.getItem('skipIntro') === '1'; sessionStorage.removeItem('skipIntro'); } catch (e) {}
  if (skipNow) document.addEventListener('DOMContentLoaded', () => setTimeout(showMain, 0)); else raf = requestAnimationFrame(tick);
  window.INTRO = { skip, playIntro, showMain };
})();
