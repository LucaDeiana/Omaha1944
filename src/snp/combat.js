"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — meccaniche di tiro del giocatore:
//  ingrandimenti storici, oscillazione dell'ottica, respiro
//  trattenuto (Shift mirando), sporgersi (Q/E) con controllo dei muri.
//  Attive solo con SCEN === 'snp': le altre modalità non cambiano.
// ============================================================
const SNP_ZOOM = { springfield: 2.5, enfield: 3.5, mosin: 3.5, kar98zf: 4, g43: 4 };   // M73B1, No.32, PU, ZF39, ZF4
const SNP_GUNS = { get A() { return (SNP.M || SNP_MAPS.saintlo).guns.A; }, get E() { return (SNP.M || SNP_MAPS.saintlo).guns.E; } };
SNP_ZOOM.svt40 = 3.5;
const _lr = new V3(), _le = new V3();

function snpCamera(dt, w) {
  if (!P.leanOff) Object.assign(P, { breath: 1, breathLock: false, holding: false, leanK: 0, leanOff: new V3() });
  const scoped = w && w.scope && P.adsK > .5;
  // respiro: Shift mirando lo trattiene per qualche secondo, poi il fiatone fa tremare di più
  const wantHold = scoped && KEYS.ShiftLeft && !P.breathLock && P.breath > 0;
  if (wantHold) { P.breath = Math.max(0, P.breath - dt / 4.5); if (P.breath <= 0) { P.breathLock = true; } }
  else { P.breath = Math.min(1, P.breath + dt * (P.breathLock ? .2 : .3)); if (P.breathLock && P.breath > .55) P.breathLock = false; }
  if (wantHold && !P.holding) play('bodyfall', null, { vol: .05, rate: 2.2 });
  P.holding = wantHold;
  let k = wantHold ? .12 : P.breathLock ? 1.9 : 1 + (1 - P.breath) * .6;
  // oscillazione: dipende dalla postura, dal fiato dopo la corsa e dalle ferite
  const A = [.0042, .0026, .0011][P.stance] * (1 + (1 - P.stamina) * 1.6) * (P.hp < 50 ? 1.4 : 1) * k * (.25 + .75 * P.adsK);
  const t = GAME.time;
  const sx = (Math.sin(t * .83) + Math.sin(t * 1.71 + 1.3) * .35 + Math.sin(t * 3.1) * .08) * A, sy = (Math.sin(t * 1.23 + .5) * .8 + Math.sin(t * 2.3 + 2) * .3) * A;
  camera.rotation.x += sy; camera.rotation.y += sx;
  // sporgersi: Q a sinistra, E a destra (non da proni né correndo); la testa non entra nei muri
  const want = P.stance === 2 || P.sprint || P.dead ? 0 : (KEYS.KeyE ? 1 : 0) - (KEYS.KeyQ ? 1 : 0);
  P.leanK = lerp(P.leanK, want, Math.min(1, dt * 8));
  let off = P.leanK * .42;
  if (Math.abs(off) > .01) {
    _lr.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw)).multiplyScalar(Math.sign(off));
    _le.copy(camera.position);
    const h = raySolids(_le, _lr, Math.abs(off) + .18);
    if (h) off = Math.sign(off) * Math.max(0, h.t - .18);
  }
  P.leanOff.set(Math.cos(P.yaw) * off, -Math.abs(off) * .12, -Math.sin(P.yaw) * off);
  camera.position.add(P.leanOff);
  camera.rotation.z -= P.leanK * .16;
  // ingrandimento storico dell'ottica
  if (w && w.scope && SNP_ZOOM[P.slot().id]) {
    const fov = lerp(SETTINGS.fov + (P.sprintK || 0) * 6, 72 / SNP_ZOOM[P.slot().id], P.adsK * P.adsK);
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  // barra del respiro sotto il reticolo
  let bar = SNP.breathEl;
  if (!bar) { bar = SNP.breathEl = document.createElement('div'); bar.style.cssText = 'position:fixed;left:50%;top:calc(50% + 90px);width:120px;height:4px;margin-left:-60px;background:rgba(0,0,0,.45);z-index:17;pointer-events:none;display:none'; bar.innerHTML = '<div style="height:100%;background:#e8dcb8;width:100%"></div>'; document.body.appendChild(bar); }
  const show = scoped && (P.breath < .999 || wantHold);
  bar.style.display = show ? 'block' : 'none';
  if (show) { bar.firstChild.style.width = (P.breath * 100).toFixed(0) + '%'; bar.firstChild.style.background = P.breathLock ? '#c86a4a' : '#e8dcb8'; }
}
