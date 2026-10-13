"use strict";
// ============================================================
//  Supporto aereo a richiesta: vista dall'alto per marcare il
//  bersaglio, poi arrivano i cacciabombardieri. Una chiamata ogni
//  AIR.CD secondi, per entrambe le fazioni.
// ============================================================
const AIR = { CD: 150, cd: 45, tgt: new V3(), prev: null, marker: null };

function airReady() { return AIR.cd <= 0; }
function openAirMark() {
  if (P.mode !== 'foot' || P.dead || !airReady()) { if (!airReady()) showMsg('Supporto aereo disponibile tra ' + Math.ceil(AIR.cd) + ' s', 2); return; }
  P.mode = 'airmark'; AIR.tgt.set(P.pos.x - Math.sin(P.yaw) * 120, 0, P.pos.z - Math.cos(P.yaw) * 120);
  $('mortRet').style.display = 'block'; $('stHud').style.display = 'block';
  showMsg('Marca il bersaglio — mouse: sposta · click sx: conferma · T o E: annulla', 3.5);
}
function closeAirMark() { if (P.mode === 'airmark') P.mode = 'foot'; $('mortRet').style.display = 'none'; $('stHud').style.display = 'none'; camera.fov = SETTINGS.fov; camera.updateProjectionMatrix(); }
function airMouse(mx, my) {
  const k = .7 * SETTINGS.sens; AIR.tgt.x -= mx * k; AIR.tgt.z -= my * k * (PT === 'A' ? 1 : -1);
  const dx = AIR.tgt.x - P.pos.x, dz = AIR.tgt.z - P.pos.z, d = Math.hypot(dx, dz);
  if (d > 700) { AIR.tgt.x = P.pos.x + dx / d * 700; AIR.tgt.z = P.pos.z + dz / d * 700; }
}
function updateAirMark(dt) {
  const t = AIR.tgt; t.y = Math.max(Hf(t.x, t.z), WATER_Y);
  const dir = PT === 'A' ? 1 : -1;
  camera.position.set(t.x, t.y + 260, t.z + dir * 110); camera.lookAt(t.x, t.y, t.z);
  if (Math.abs(camera.fov - 55) > .1) { camera.fov = 55; camera.updateProjectionMatrix(); }
  _hv.copy(t).project(camera);
  const ret = $('mortRet'); ret.style.left = ((_hv.x * .5 + .5) * innerWidth) + 'px'; ret.style.top = ((-_hv.y * .5 + .5) * innerHeight) + 'px';
  const friends = FRIENDS().filter(s => s.alive && s.pos.distanceTo(t) < 40).length;
  $('stHud').innerHTML = `<b>Supporto aereo — ${PT === 'A' ? 'P-47 Thunderbolt' : 'Fw 190'}</b> · distanza ${Math.round(Math.hypot(t.x - P.pos.x, t.z - P.pos.z))} m${friends ? ` · <b style="color:#f88">ATTENZIONE: ${friends} compagni vicino al bersaglio</b>` : ''}<br><small>Mouse: sposta il bersaglio · Click sx: conferma · T o E: annulla</small>`;
  if (mouseL) { mouseL = false; P.trigger = false; callAirStrike(t.clone()); closeAirMark(); }
}
function callAirStrike(t) {
  AIR.cd = AIR.CD;
  if (PT === 'A') { raidP47(t); say(N.radio, 'Qui Thunderbolt, bersaglio ricevuto. Arriviamo in picchiata, state giù!'); }
  else { strikeFw(t); say(NA.funk, 'Jabos in arrivo sulla posizione indicata. Köpfe runter!'); }
  // fumogeno colorato sul bersaglio
  for (let i = 0; i < 40; i++) after(i * .25, () => PS_SMOKE.emit(t.x + rnd(-1, 1), t.y + .3, t.z + rnd(-1, 1), rnd(-.5, .5), rnd(1.5, 3), rnd(-.5, .5), rnd(3, 5), .6, 3, .55, PT === 'A' ? .85 : .9, PT === 'A' ? .45 : .2, PT === 'A' ? .8 : .2, .6, -.1));
  netSend({ t: 'air', p: [t.x, t.y, t.z], side: PT });
}
function strikeFw(T) {
  for (let i = 0; i < 3; i++) {
    const xo = T.x + (i - 1) * 25, tp = T.clone().add(new V3(rnd(-12, 12), 0, rnd(-12, 12)));
    const path = [
      { p: new V3(xo, 180, T.z - 300), v: 160 },
      { p: new V3(tp.x, tp.y + 40, tp.z - 110), v: 175, guns: true, bomb: tp, r: 40 },
      { p: new V3(tp.x, 40, tp.z + 160), v: 165, guns: true },
      { p: new V3(xo + 300, 420, tp.z + 900), v: 150 },
    ];
    new Plane('fw190', 'E', new V3(xo + rnd(-40, 40), 320, T.z - 1300 - i * 80), new V3(0, -15, 150), path);
  }
}
function updateAirStrike(dt) {
  AIR.cd = Math.max(0, AIR.cd - dt);
  if (P.mode === 'airmark') updateAirMark(dt);
}
