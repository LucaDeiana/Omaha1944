"use strict";
// ============================================================
//  Avvio, menu, pausa, ciclo principale
// ============================================================
const GAME = {
  running: false, started: false, over: false, time: 0,
  end(win) {
    if (this.over) return;
    this.over = true; this.running = false;
    document.exitPointerLock && document.exitPointerLock();
    const t = Math.round(GAME.time), acc = STATS.shots ? Math.round(STATS.hits / STATS.shots * 100) : 0;
    $('pause').classList.add('hidden');
    $('endTitle').textContent = win ? 'COLLEVILLE È LIBERA' : 'MISSIONE FALLITA';
    $('endText').innerHTML = (win ? 'La testa di ponte su Omaha Beach regge. Il 6 giugno 1944 è costato caro, ma la strada per la Francia è aperta.<br><br>' : '') +
      `<table><tr><td>Tempo</td><td>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</td></tr>
      <tr><td>Nemici eliminati</td><td>${STATS.kills}</td></tr><tr><td>Colpi alla testa</td><td>${STATS.heads}</td></tr>
      <tr><td>Precisione</td><td>${acc}%</td></tr><tr><td>Volte caduto</td><td>${STATS.deaths}</td></tr>
      <tr><td>Compagni caduti</td><td>${MISSION.alliesLost}</td></tr></table>`;
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
  $('optSens').value = SETTINGS.sens; $('optFov').value = SETTINGS.fov;
  const upd = () => { $('sensV').textContent = (+$('optSens').value).toFixed(2); $('fovV').textContent = $('optFov').value; };
  upd();
  for (const id of ['optSens', 'optFov']) $(id).addEventListener('input', () => {
    upd(); SETTINGS.sens = +$('optSens').value; SETTINGS.fov = +$('optFov').value; saveSettings();
    for (const id2 of ['pSens', 'pFov']) { }
  });
  $('pSens').value = SETTINGS.sens; $('pFov').value = SETTINGS.fov;
  $('pSens').addEventListener('input', () => { SETTINGS.sens = +$('pSens').value; saveSettings(); });
  $('pFov').addEventListener('input', () => { SETTINGS.fov = +$('pFov').value; saveSettings(); });
}

async function startGame() {
  SETTINGS.quality = $('optQuality').value; SETTINGS.diff = $('optDiff').value;
  SETTINGS.sens = +$('optSens').value; SETTINGS.fov = +$('optFov').value; saveSettings();
  Q = QUALITY[SETTINGS.quality]; D = DIFF[SETTINGS.diff];
  initAudio();
  $('menu').classList.add('hidden'); $('loading').classList.remove('hidden');
  const step = async (t) => { $('loadT').textContent = t; await new Promise(r => requestAnimationFrame(() => setTimeout(r, 20))); };
  try {
    await step('Preparazione del motore grafico…'); initEngine(); initFX(); initWeapons();
    await step('Generazione della costa normanna…'); buildWorld();
    await step('Imbarco delle truppe…'); initMission(); initHUD(); initInput();
    await step('Compilazione degli shader…'); renderer.compile(scene, camera);
  } catch (e) {
    $('loadT').innerHTML = 'Errore durante il caricamento:<br><small>' + e.message + '</small>'; console.error(e); return;
  }
  $('loading').classList.add('hidden');
  GAME.started = true; STATS.start = performance.now();
  lockPointer();
  showMsg('6 giugno 1944 — Omaha Beach', 4);
}
function lockPointer() { const c = renderer.domElement; (c.requestPointerLock || (() => { })).call(c); }

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  GAME.running = locked && GAME.started && !GAME.over;
  if (!locked && GAME.started && !GAME.over) { $('pause').classList.remove('hidden'); mouseL = false; P.trigger = false; P.adsHeld = false; for (const k in KEYS) KEYS[k] = false; }
  if (locked) $('pause').classList.add('hidden');
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!GAME.started) return;
  if (GAME.running) {
    GAME.time += dt;
    updateTimers(dt);
    updateMission(dt);
    updateWorld(dt, GAME.time);
    updatePlayer(dt);
    updateAI(dt);
    updateProjectiles(dt);
    updateFX(dt);
    updateEngine(dt, P.pos, GAME.time);
    updateAudio(dt);
    updateHUD(dt);
  }
  renderFrame(GAME.time);
}

window.addEventListener('DOMContentLoaded', () => {
  if (!window.THREE || !THREE.EffectComposer) { $('startBtn').disabled = true; $('netErr').classList.remove('hidden'); }
  bindSettings();
  $('startBtn').addEventListener('click', startGame);
  $('resumeBtn').addEventListener('click', lockPointer);
  $('restartBtn').addEventListener('click', () => location.reload());
  $('againBtn').addEventListener('click', () => location.reload());
  requestAnimationFrame(frame);
});
