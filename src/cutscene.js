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
  if (SCEN === 'air') { airIntro(); return; }
  if (SCEN === 'sea') { showMsg('1944 — La Manica', 4); return; }
  if (SCEN === 'tun') { showMsg('Aprile 1943 — Medjez el-Bab, Tunisia', 4); return; }
  if (SCEN === 'ard') CUT_SHOTS.splice(0, CUT_SHOTS.length, ...ARD_SHOTS);
  if (PT === 'E') {
    CUT_SHOTS[0].cap = 'La flotta alleata al largo della Normandia — 05:50';
    CUT_SHOTS[1].cap = 'Die Landungsboote — arrivano i mezzi da sbarco';
    Object.assign(CUT_SHOTS[2], { cap: 'Widerstandsnest 62 — 06:25', from: [-40, 30, -92], to: [-15, 27, -90], look: [-30, 2, 40], look2: [0, 1, 120] });
  }
  CUT.active = true; CUT.t = 0; CUT.i = -1;
  $('cine').classList.remove('hidden'); $('hud').classList.add('cineHud');
}
function endCutscene() {
  if (!CUT.active) return;
  if (CUT.planes) { for (const m of CUT.planes) scene.remove(m); CUT.planes = null; }
  CUT.active = false; $('cine').classList.add('hidden'); $('hud').classList.remove('cineHud');
  if (vmRoot) vmRoot.visible = true;
  $('fade').style.opacity = 0;
  if (SCEN === 'air') { showMsg(CUT.endMsg, 4); return; }
  showMsg(SCEN === 'ard' ? '26 dicembre 1944 — Bois Jacques, Ardenne' : PT === 'E' ? '6 giugno 1944 — WN 62, Colleville' : '6 giugno 1944 — Omaha Beach', 4);
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
  if (CUT.planes) airIntroPlanes(CUT.t);
  if (s.cam) {
    const [cp, lk] = s.cam(t, k); camera.position.copy(cp); camera.lookAt(lk);
    if (vmRoot) vmRoot.visible = false;
    const e2 = Math.min(t, s.d - t); $('fade').style.opacity = e2 < .45 ? (1 - e2 / .45) * .9 : 0;
    return;
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

// ---------- filmato d'apertura delle missioni aeree: la base, la formazione in volo, l'obiettivo ----------
function airIntro() {
  const C = CARRIER, sp = PLANE_SPECS[SETTINGS.plane] || PLANE_SPECS.p47, type = PLAYER_PLANES.includes(SETTINGS.plane) ? SETTINGS.plane : 'p47';
  let tgt, cap;
  if (AIRMAP === 'manica') { tgt = new V3(-300, 0, 700); cap = ['RAF Hawkinge, Kent — estate 1944', 'La Manica: bombardieri e un convoglio tedesco in rotta'], CUT.endMsg = 'La Manica — decollo dalla pista'; }
  else if (AIRMAP === 'reno') { const b = AIRM.bridge || { x: -250, z: -700 }; tgt = new V3(b.x, 0, b.z); cap = ['Pista avanzata Y-29 — marzo 1945', 'Il ponte d’acciaio sul Reno, difeso dalla Flak'], CUT.endMsg = 'Il Reno — decollo dalla pista'; }
  else { tgt = new V3(airRiverX(AIR_BRIDGE_Z), 0, AIR_BRIDGE_Z); cap = ['Portaerei al largo della Normandia — 7 giugno 1944', 'L’entroterra normanno: caccia, colonne e il ponte'], CUT.endMsg = '7 giugno 1944 — Cieli di Normandia'; }
  if (AIRFREE) { cap[1] = 'Caccia libera: ondate di caccia nemici'; }
  tgt.y = Math.max(Hf(tgt.x, tgt.z), 0);
  const base = new V3(C.x, C.deckY, C.z), dir = tgt.clone().sub(base).setY(0).normalize(), side = new V3(-dir.z, 0, dir.x);
  const D1 = 5.5, D2 = 6, D3 = 6.5, T = D1 + D2 + D3, V = 115, alt = Math.max(tgt.y, C.deckY) + 260;
  // la formazione arriva sopra l'obiettivo alla fine del filmato
  CUT.lead = t => tgt.clone().addScaledVector(dir, -V * (T - t) + 60).setY(Math.min(alt, tgt.y + 110 + (T - t) * 14));
  scene.fog.density = FOG_BASE * FOG_K * .3;  // visibilità da volo, come in cabina
  CUT.dir = dir; CUT.planes = [];
  for (let i = 0; i < 3; i++) { const m = makePlaneModel(type); m.userData.off = [[0, 0, 0], [-16, -2, 14], [16, 2, 16]][i]; scene.add(m); CUT.planes.push(m); }
  const along = C.type === 'field' ? new V3(0, 0, 1) : new V3(0, 0, 1);
  CUT_SHOTS.splice(0, CUT_SHOTS.length,
    { d: D1, cap: cap[0], cam: (t, k) => [base.clone().add(new V3(C.w * .5 + 14, 7 + k * 5, C.len * .45 - k * C.len * .5)), base.clone().add(new V3(0, 2, -C.len * .2 + k * 30))] },
    { d: D2, cap: 'Squadriglia ' + sp.name, cam: (t, k) => { const l = CUT.lead(D1 + t); return [l.clone().addScaledVector(side, 26 - k * 12).addScaledVector(dir, 22 - k * 34).add(new V3(0, 5 - k * 3, 0)), l.clone().addScaledVector(dir, 8)]; } },
    { d: D3, cap: cap[1], cam: (t, k) => { const l = CUT.lead(D1 + D2 + t); return [tgt.clone().addScaledVector(side, 260 - k * 60).addScaledVector(dir, 260).setY(tgt.y + 140 + k * 30), tgt.clone().lerp(l, .2 + k * .35)]; } });
  CUT.active = true; CUT.t = 0; CUT.i = -1;
  $('cine').classList.remove('hidden'); $('hud').classList.add('cineHud');
}
function airIntroPlanes(t) {
  const d = CUT.dir, yaw = Math.atan2(-d.x, -d.z);
  for (const m of CUT.planes) {
    const o = m.userData.off, l = CUT.lead(t), sd = new V3(-d.z, 0, d.x);
    m.position.copy(l).addScaledVector(sd, o[0]).addScaledVector(d, -o[2]); m.position.y += o[1] + Math.sin(t * 1.3 + o[0]) * .4;
    m.rotation.set(0, yaw, Math.sin(t * .9 + o[2]) * .05, 'YXZ');
    for (const p of m.userData.props || []) p.rotation.z += .9;
  }
}
