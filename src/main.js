"use strict";
// ============================================================
//  Avvio, menu, pausa, ciclo principale
// ============================================================
const FPS = { v: 60 };
const GAME = {
  running: false, started: false, over: false, time: 0, timeScale: 1,
  end(win) {
    if (this.over) return;
    this.over = true; this.running = false;
    document.exitPointerLock && document.exitPointerLock();
    const t = Math.round(GAME.time), acc = STATS.shots ? Math.round(STATS.hits / STATS.shots * 100) : 0;
    $('pause').classList.add('hidden');
    const ax = PT === 'E';
    $('endTitle').textContent = GAME.endTitle || (ax ? (win ? 'LO SBARCO È RESPINTO' : 'WN 62 È CADUTO') : win ? 'COLLEVILLE È LIBERA' : 'MISSIONE FALLITA');
    $('endText').innerHTML = GAME.endText ? GAME.endText + `<table><tr><td>Colpi alla testa</td><td>${STATS.heads}</td></tr><tr><td>Precisione</td><td>${acc}%</td></tr></table>` : (ax ? (GAME.axisWhy || '') + '<br><br>' : win ? 'La testa di ponte su Omaha Beach regge. Il 6 giugno 1944 è costato caro, ma la strada per la Francia è aperta.<br><br>' : '') +
      `<table><tr><td>Tempo</td><td>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</td></tr>
      <tr><td>Nemici eliminati</td><td>${STATS.kills}</td></tr><tr><td>Colpi alla testa</td><td>${STATS.heads}</td></tr>
      <tr><td>Precisione</td><td>${acc}%</td></tr><tr><td>Volte caduto</td><td>${STATS.deaths}</td></tr>
      <tr><td>Compagni caduti</td><td>${MISSION.alliesLost}</td></tr></table>`;
    if (MISSION.endless) {
      let board = []; try { board = JSON.parse(localStorage.getItem('omahaEndless') || '[]'); } catch (e) { }
      const me = { t, wave: MISSION.level || 1, kills: STATS.kills, d: new Date().toLocaleDateString('it-IT') };
      board.push(me); board.sort((a, b) => b.t - a.t || b.kills - a.kills); board = board.slice(0, 8);
      try { localStorage.setItem('omahaEndless', JSON.stringify(board)); } catch (e) { }
      $('endText').innerHTML += '<div id="endBoard"><b>Classifica — difesa a oltranza</b><table>' + board.map((r, i) => '<tr class="' + (r === me ? 'me' : '') + '"><td>' + (i + 1) + '.</td><td>' + Math.floor(r.t / 60) + ':' + String(r.t % 60).padStart(2, '0') + '</td><td>ondata ' + r.wave + '</td><td>' + r.kills + ' uccisioni</td><td>' + r.d + '</td></tr>').join('') + '</table></div>';
    }
    $('end').classList.remove('hidden');
  }
};

function fillSelect(id, obj, cur) {
  const s = $(id); s.innerHTML = '';
  for (const k in obj) { const o = document.createElement('option'); o.value = k; o.textContent = obj[k].label; if (k === cur) o.selected = true; s.appendChild(o); }
}
function bindSettings() {
  fillSelect('optQuality', QUALITY, SETTINGS.quality);
  fillSelect('optDiff', DIFF, SETTINGS.diff);
  const modeVis = () => { $('modeL').style.display = $('optSide').value === 'E' ? '' : 'none'; }; $('optSide').addEventListener('change', modeVis); setTimeout(modeVis, 0); try { $('optName').value = localStorage.getItem('omahaName') || ''; } catch (e) { }
  $('optNet').addEventListener('change', () => $('netNote').classList.toggle('hidden', !$('optNet').checked || netAvailable())); $('optSide').value = SETTINGS.side || 'A'; $('optMap').value = SETTINGS.map || 'omaha';
  const ps = $('optPlane'); ps.innerHTML = PLAYER_PLANES.map(k => { const s = PLANE_SPECS[k], g = s.guns; return `<option value="${k}">${s.name} — ${g.pos.length}× ${g.cal} mm${g.he ? ' esplosivi' : ''}${s.guns2 ? ' + ' + s.guns2.pos.length + '× ' + s.guns2.cal + ' mm' : ''}</option>`; }).join(''); ps.value = SETTINGS.plane || 'p47';
  const mapVis = () => { $('navL').style.display = $('optMap').value === 'sea' ? '' : 'none'; const a = $('optMap').value !== 'omaha'; $('optSide').parentNode.style.display = a ? 'none' : ''; $('tunModeL').style.display = $('optMap').value === 'tun' ? '' : 'none'; $('planeL').style.display = $('airMapL').style.display = $('optMap').value === 'air' ? '' : 'none'; if (a) $('modeL').style.display = 'none'; else modeVis(); }; $('optMap').addEventListener('change', mapVis); setTimeout(mapVis, 0);
  const sync = () => {
    for (const [a, b] of [['optSens', 'pSens'], ['optFov', 'pFov'], ['optVol', 'pVol']]) { $(a).value = $(b).value = SETTINGS[{ optSens: 'sens', optFov: 'fov', optVol: 'volume' }[a]]; }
    for (const [a, b, k] of [['optGore', 'pGore', 'gore'], ['optVoices', 'pVoices', 'voices'], ['optDyn', 'pDyn', 'dynres'], ['optFps', 'pFps', 'fps']]) $(a).checked = $(b).checked = SETTINGS[k];
    $('sensV').textContent = (+SETTINGS.sens).toFixed(2); $('fovV').textContent = SETTINGS.fov; $('volV').textContent = Math.round(SETTINGS.volume * 100) + '%';
    $('fps').style.display = SETTINGS.fps ? 'block' : 'none';
  };
  const bind = (ids, key, num) => ids.forEach(id => $(id).addEventListener('input', e => { SETTINGS[key] = num ? +e.target.value : e.target.checked; saveSettings(); sync(); }));
  bind(['optSens', 'pSens'], 'sens', true); bind(['optFov', 'pFov'], 'fov', true); bind(['optVol', 'pVol'], 'volume', true);
  bind(['optGore', 'pGore'], 'gore'); bind(['optVoices', 'pVoices'], 'voices'); bind(['optDyn', 'pDyn'], 'dynres'); bind(['optFps', 'pFps'], 'fps');
  sync();
}

async function startGame() {
  SETTINGS.plane = $('optPlane') ? $('optPlane').value : 'p47'; AIRMAP = $('optAirMap') ? $('optAirMap').value : 'norm'; AIRFREE = !!$('optAirFree') && $('optAirFree').value === '1';
  SCEN = $('optMap').value; NV.misKey = $('optNavMis').value; NV.freeShip = $('optNavShip').value; TUN.mode = $('optTunMode') ? $('optTunMode').value : 'dm'; SETTINGS.map = SCEN; SETTINGS.side = $('optSide').value; if (SCEN !== 'omaha') SETTINGS.side = 'A'; PT = SETTINGS.side; MISSION.endless = PT === 'E' && $('optMode').value === 'e'; try { localStorage.setItem('omahaName', $('optName').value); } catch (e) { }
  SETTINGS.quality = $('optQuality').value; SETTINGS.diff = $('optDiff').value; saveSettings();
  Q = QUALITY[SETTINGS.quality]; D = DIFF[SETTINGS.diff];
  const audioP = initAudio();
  $('menu').classList.add('hidden'); $('loading').classList.remove('hidden');
  const step = async (t) => { $('loadT').textContent = t; await new Promise(r => setTimeout(r, 30)); };
  try {
    await step('Caricamento delle texture fotografiche…'); await preloadPhotos();
    await step('Preparazione del motore grafico e delle texture…'); initEngine(); initFX(); initWeapons(); buildPlaneGeos();
    await step('Generazione della costa normanna…'); buildWorld();
    await step('Imbarco delle truppe…'); initMission(); initHUD(); initFun(); initNPC(); initStations(); initInput();
    await step('Registrazione dei suoni…'); await audioP;
    if ($('optNet').checked) {
      await step('Connessione al server multiplayer…');
      const ok = netAvailable() && await connectNet(($('optName').value || 'Soldato').trim(), PT);
      if (!ok) { $('netNote').classList.remove('hidden'); feed('Server multiplayer non raggiungibile: partita in solitario'); }
    }
    await step('Compilazione degli shader…'); renderer.compile(scene, camera);
  } catch (e) {
    $('loadT').innerHTML = 'Errore durante il caricamento:<br><small>' + e.message + '</small>'; console.error(e); return;
  }
  $('loading').classList.add('hidden');
  GAME.started = true; STATS.start = performance.now();
  lockPointer();
  startCutscene();
}
// se il browser rifiuta la cattura del mouse (es. caricamento lungo dopo il clic) mostra un pulsante per entrare in partita
function lockFailed() {
  if (!GAME.started || GAME.over || GAME.running) return;
  $('pause').classList.remove('hidden'); $('pause').querySelector('h2').textContent = 'PRONTO'; $('resumeBtn').textContent = 'CLICCA PER ENTRARE IN BATTAGLIA';
}
function lockPointer() {
  const c = renderer.domElement; if (!c.requestPointerLock) return;
  try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(lockFailed); } catch (e) { lockFailed(); }
  setTimeout(() => { if (document.pointerLockElement !== c) lockFailed(); }, 700);
}
document.addEventListener('pointerlockerror', lockFailed);

document.addEventListener('pointerlockchange', () => {
  const locked = renderer && document.pointerLockElement === renderer.domElement;
  GAME.running = locked && GAME.started && !GAME.over;
  if (!locked && GAME.started && !GAME.over) {
    if (SCEN === 'air') { const ps = $('pPlane'); if (!ps.options.length) ps.innerHTML = $('optPlane').innerHTML; ps.value = SETTINGS.plane; $('pPlaneL').style.display = ''; }
    $('pause').classList.remove('hidden'); mouseL = false; P.trigger = false; P.adsHeld = false; for (const k in KEYS) KEYS[k] = false;
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (AU.ctx) AU.ctx.suspend();
  }
  if (locked) { $('pause').querySelector('h2').textContent = 'PAUSA'; $('resumeBtn').textContent = 'RIPRENDI'; $('pause').classList.add('hidden'); if (AU.ctx) AU.ctx.resume(); }
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
  FPS.v = lerp(FPS.v, 1 / Math.max(raw, 1e-3), .05);
  if (!GAME.started) return;
  if (GAME.running) {
    GAME.timeScale = 1;
    const dt = Math.min(.05, raw) * GAME.timeScale;
    GAME.time += dt;
    updateTimers(dt);
    updateMission(dt);
    updateWorld(dt, GAME.time);
    updateAircraft(dt);
    updateSide(dt); updateDeploy(dt); updateNPC(dt); updateNet(dt); updateTanks(dt); updateAirStrike(dt);
    updatePlayer(dt); updateCutscene(dt);
    updateAI(dt);
    updateProjectiles(dt);
    updateGore(dt);
    updateFX(dt);
    updateEngine(dt, P.pos, GAME.time);
    updateAudio(dt);
    updateHUD(dt); updateFun(dt);
    updateDynRes(raw);
  }
  camera.updateMatrixWorld();
  updateCrowd();
  renderFrame(GAME.time);
}

// audio sospeso quando la scheda non è visibile
document.addEventListener('visibilitychange', () => { if (!AU.ctx) return; if (document.hidden) AU.ctx.suspend(); else if (GAME.running) AU.ctx.resume(); });
window.addEventListener('pagehide', () => { if (AU.ctx) AU.ctx.close(); });
window.addEventListener('DOMContentLoaded', () => {
  if (!window.THREE || !THREE.EffectComposer) { $('startBtn').disabled = true; $('netErr').classList.remove('hidden'); return; }
  bindSettings();
  $('startBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', lockPointer);
  // cambio d'aereo in partita: subito se si è fermi alla base, altrimenti al prossimo decollo
  $('pPlane').addEventListener('change', e => swapPlane(e.target.value));
  $('roleBtn').addEventListener('click', () => { lockPointer(); setTimeout(openSpawnMenu, 100); });
  $('restartBtn').addEventListener('click', () => location.reload());
  $('againBtn').addEventListener('click', () => location.reload());
  requestAnimationFrame(frame);
});
