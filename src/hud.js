"use strict";
// ============================================================
//  HUD: obiettivi, marcatori, bussola, munizioni, avvisi
// ============================================================
let msgT = 0, hudT = 0, compassCtx;
const markerEls = [], ddEls = [];
const _hv = new V3();

function initHUD() {
  compassCtx = $('compass').getContext('2d');
  for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'mk'; d.style.display = 'none'; $('markers').appendChild(d); markerEls.push(d); }
  $('hud').classList.remove('hidden');
}
function feed(text) {
  const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, 3500);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
function subLine(who, text, it) { say(who, '<i>«' + text + '»</i>' + (it ? ' — ' + it : '')); }
function showMsg(text, dur = 3) { $('msg').textContent = text; $('msg').style.opacity = 1; msgT = dur; }
function damageIndicator(from) {
  const a = Math.atan2(from.x - P.pos.x, from.z - P.pos.z);
  const rel = -(a - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)));
  const d = document.createElement('div'); d.className = 'dd'; d.style.transform = `rotate(${rel}rad)`;
  $('dmgdir').appendChild(d);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, 700);
}
function bearing(dx, dz) { return Math.atan2(-dx, dz); } // 0 = nord (mare), positivo verso est (-x)
function drawCompass() {
  const g = compassCtx, W = 360, Hh = 34;
  g.clearRect(0, 0, W, Hh);
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(.2, 'rgba(0,0,0,.45)'); grd.addColorStop(.8, 'rgba(0,0,0,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
  const head = bearing(-Math.sin(P.yaw), -Math.cos(P.yaw));
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  g.textAlign = 'center'; g.font = '13px Oswald, sans-serif';
  for (let deg = 0; deg < 360; deg += 15) {
    let d = deg * PI / 180 - head; while (d > PI) d -= TAU; while (d < -PI) d += TAU;
    if (Math.abs(d) > PI / 2) continue;
    const x = W / 2 + d / (PI / 2) * (W / 2), a = 1 - Math.abs(d) / (PI / 2);
    g.fillStyle = `rgba(233,228,212,${a})`;
    if (names[deg] !== undefined) g.fillText(names[deg], x, 22); else g.fillRect(x - .5, 20, 1, 6);
  }
  for (const mk of MISSION.markers) {
    let d = bearing(mk.pos.x - P.pos.x, mk.pos.z - P.pos.z) - head; while (d > PI) d -= TAU; while (d < -PI) d += TAU;
    const x = W / 2 + clamp(d / (PI / 2), -1, 1) * (W / 2);
    g.fillStyle = '#ffd060'; g.beginPath(); g.moveTo(x, 3); g.lineTo(x - 5, 9); g.lineTo(x + 5, 9); g.fill();
  }
  g.fillStyle = '#e9e4d4'; g.fillRect(W / 2 - 1, 28, 2, 6);
}

function updateHUD(dt) {
  msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0;
  // marcatori 3D
  for (let i = 0; i < markerEls.length; i++) {
    const el = markerEls[i], mk = (P.mode !== 'foot' && SIDE.cur ? SIDE.markers : MISSION.markers.concat(NPC.markers || []))[i];
    if (!mk || P.inBoat) { el.style.display = 'none'; continue; }
    _hv.copy(mk.pos).project(camera);
    const behind = _hv.z > 1;
    let x = (_hv.x * .5 + .5) * innerWidth, y = (-_hv.y * .5 + .5) * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - 40; }
    x = clamp(x, 30, innerWidth - 30); y = clamp(y, 60, innerHeight - 40);
    const dist = Math.round(Math.hypot(mk.pos.x - P.pos.x, mk.pos.z - P.pos.z));
    el.style.display = 'block'; el.style.left = x + 'px'; el.style.top = y + 'px';
    el.textContent = (mk.label ? mk.label + ' · ' : '') + dist + ' m';
  }
  // mirino dinamico
  const s = P.slot(), w = s ? WEAPONS[s.id] : null;
  const spread = w ? ((P.adsK > .5 ? w.ads : w.hip) + P.bloom + P.moveK * .03) : .03;
  $('cross').style.setProperty('--g', (4 + spread * 900) + 'px');
  $('cross').style.opacity = (P.adsK > .4 || P.inBoat || P.dead || P.sprint) ? 0 : 1;
  // avviso granata
  let gw = null, gd = 1e9;
  for (const q of projectiles) if (q.type === 'nade' && q.team === 'E') { const d = q.p.distanceTo(P.pos); if (d < 11 && d < gd) { gd = d; gw = q; } }
  const ge = $('gwarn');
  if (gw && !P.dead) {
    const a = Math.atan2(gw.p.x - P.pos.x, gw.p.z - P.pos.z), rel = -(a - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)));
    ge.style.display = 'block'; ge.firstChild.style.transform = `translate(-50%,-50%) translate(${Math.sin(rel) * 90}px,${-Math.cos(rel) * 90}px)`;
  } else ge.style.display = 'none';
  // effetti schermo
  const low = P.hp < 35 && !P.dead ? .35 + Math.sin(GAME.time * 5) * .1 : 0;
  if (gradePass) { gradePass.uniforms.uDamage.value = Math.max(P.hurt * .8, low); gradePass.uniforms.uSupp.value = P.supp; $('blood').style.opacity = 0; }
  else $('blood').style.opacity = Math.max(P.hurt, low);
  $('naval').style.display = P.mode === 'naval' ? 'block' : 'none';
  $('planehud').style.display = P.mode === 'plane' ? 'block' : 'none';
  $('cross').style.display = P.mode === 'foot' ? 'block' : 'none';
  $('wbox').style.display = $('hpbox').style.display = P.mode === 'foot' ? 'block' : 'none';
  if (gradePass) { gradePass.uniforms.uShock.value = P.shock; gradePass.uniforms.uFlash.value = Math.max(0, gradePass.uniforms.uFlash.value - dt * 2); }
  hudT -= dt; if (hudT > 0) return; hudT = .1;
  if (P.mode === 'naval') { $('navInfo').innerHTML = (NAV.target ? 'Distanza: <b>' + Math.round(NAV.range) + ' m</b>' : 'Nessun bersaglio') + '<br>' + (NAV.reload > 0 ? 'Ricarica: ' + NAV.reload.toFixed(1) + ' s' : NAV.ready ? '<b class="ok">PRONTO AL FUOCO</b>' : 'Brandeggio torretta…') + '<br><small>Click sx: fuoco · Click dx: binocolo · B: cambia ruolo</small>'; $('navZoom').style.display = NAV.zoom ? 'block' : 'none'; }
  if (P.mode === 'plane' && PL.me) $('planeInfo').innerHTML = 'Velocità ' + Math.round(PL.me.vel.length() * 3.6) + ' km/h · Quota ' + Math.round(PL.me.pos.y) + ' m · Manetta ' + Math.round(PL.throttle * 100) + '% · ' + PL.G.toFixed(1) + ' G<br>Bombe: ' + PL.bombs + (PL.bombs < 2 ? ' (riarmo ' + Math.max(0, Math.ceil(PL.rearm)) + ' s)' : '') + ' · Scafo ' + Math.max(0, Math.round(PL.me.hp / 4.5)) + '%<br><small>Mouse: cloche · W/S: manetta · A/D: timone · Click sx/Spazio: mitragliatrici · Click dx/F: bomba · B: cambia ruolo</small>';
  if (SETTINGS.fps) $('fps').textContent = Math.round(FPS.v) + ' fps · ' + Math.round(DYN.scale * 100) + '% ris.';
  if (P.mode !== 'foot' && SIDE.cur) { $('objT').textContent = (P.mode === 'naval' ? 'USS Texas — ' : 'P-47 — ') + SIDE.title; $('objS').textContent = SIDE.text; } else { $('objT').textContent = MISSION.title; $('objS').textContent = MISSION.objText; }
  $('hpbar').firstChild.style.width = P.hp + '%';
  $('hpbar').firstChild.style.background = P.hp < 35 ? '#b33' : '#c8c0a0';
  $('stance').textContent = ['IN PIEDI', 'ACCOVACCIATO', 'A TERRA'][P.stance] + (P.swim ? ' · A NUOTO' : '') + (P.stamina < .3 ? ' · SENZA FIATO' : '');
  if (P.carry) { $('wname').textContent = 'Tubo Bangalore'; $('wammo').innerHTML = '—'; }
  else if (w) {
    $('wname').textContent = w.name;
    $('wammo').innerHTML = P.reloadT > 0 ? '<small>Ricarica…</small>' : `${s.mag}<small> / ${s.res}</small>`;
  }
  const slots = P.inv.map((x, i) => x ? `<span class="${i === P.cur ? 'on' : ''}">${i + 1} ${WEAPONS[x.id].name}</span>` : '').join('');
  $('wextra').innerHTML = `${w ? w.cal + '<br>' : ''}Granate: ${P.nades} · Cariche: ${P.charges}<div class="slots">${slots}</div>`;
  $('info').textContent = `Alleati: ${allies.filter(a => a.alive).length} · Nemici in vista: ${enemies.filter(e => e.alive && dist2Cam(e.pos) < 200 * 200).length} · Uccisioni: ${STATS.kills}`;
  drawCompass();
}
