"use strict";
// ============================================================
//  Filmato d'apertura nel motore: corazzata, ondata, spiaggia
// ============================================================
const CUT = { active: false, t: 0, i: -1 };
const CUT_SHOTS = [
  { d: 6, cap: 'USS Texas — 05:50', from: [-150, 12, 742], to: [-175, 15, 738], look: [-240, 16, 790], look2: [-235, 18, 770], fire: [1.2, 3.6] },
  { d: 5.5, cap: 'Prima ondata d\'assalto — settore Dog Green', from: [30, 22, 470], to: [10, 9, 330], look: [-22, 1, 250], look2: [-22, 1, 120] },
  { d: 6, cap: 'Omaha Beach — 06:30', from: [40, 3.5, 95], to: [12, 3, 45], look: [0, 14, -80], look2: [-20, 18, -95] },
];
function startCutscene() {
  CUT.active = true; CUT.t = 0; CUT.i = -1;
  $('cine').classList.remove('hidden'); $('hud').classList.add('cineHud');
}
function endCutscene() {
  if (!CUT.active) return;
  CUT.active = false; $('cine').classList.add('hidden'); $('hud').classList.remove('cineHud');
  if (vmRoot) vmRoot.visible = true;
  $('fade').style.opacity = 0;
  showMsg('6 giugno 1944 — Omaha Beach', 4);
}
function updateCutscene(dt) {
  if (!CUT.active) return;
  CUT.t += dt;
  let t = CUT.t, i = 0;
  while (i < CUT_SHOTS.length && t > CUT_SHOTS[i].d) { t -= CUT_SHOTS[i].d; i++; }
  if (i >= CUT_SHOTS.length) { endCutscene(); return; }
  const s = CUT_SHOTS[i], k = smooth(t / s.d);
  if (i !== CUT.i) {
    CUT.i = i; s.fired = 0; $('cineCap').textContent = s.cap; $('cineCap').style.opacity = 1;
    after(Math.min(3.5, s.d - 1), () => { if (CUT.i === i) $('cineCap').style.opacity = 0; });
  }
  // salve della Texas durante la prima inquadratura
  if (s.fire && s.fired < s.fire.length && t > s.fire[s.fired]) {
    s.fired++;
    for (const g of WORLD.shipGuns) if (g.big && Math.hypot(g.p.x - SHIP.x, g.p.z - SHIP.z) < 100) g.t = rnd(0, .25);
    P.shake += .4;
  }
  const f = s.from, to = s.to, l = s.look, l2 = s.look2;
  camera.position.set(lerp(f[0], to[0], k), lerp(f[1], to[1], k), lerp(f[2], to[2], k));
  camera.position.y = Math.max(camera.position.y, waterLevel(camera.position.x, camera.position.z, GAME.time) + 1.2, Hf(camera.position.x, camera.position.z) + 1.4);
  camera.lookAt(lerp(l[0], l2[0], k), lerp(l[1], l2[1], k), lerp(l[2], l2[2], k));
  camera.position.x += Math.sin(GAME.time * 1.3) * .06; camera.position.y += Math.sin(GAME.time * 1.7) * .05;
  if (vmRoot) vmRoot.visible = false;
  // dissolvenze tra le inquadrature
  const edge = Math.min(t, s.d - t);
  $('fade').style.opacity = edge < .45 ? (1 - edge / .45) * .9 : 0;
}
