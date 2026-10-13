"use strict";
// ============================================================
//  Modalità artigliere navale: torretta da 14" della USS Texas
// ============================================================
const NAV = { yaw: 0, pitch: -.02, reload: 0, target: null, range: 0, zoom: false, salvo: 0 };
const _nv = new V3(), _nd = new V3(), _nq = new THREE.Quaternion();

function enterNaval() {
  const T = WORLD.texas; if (!T) return;
  P.mode = 'naval'; P.dead = false; NAV.reload = 2; NAV.yaw = 0; NAV.pitch = -.03;
  scene.fog.density = FOG_BASE * .38;
  showMsg('USS Texas — torretta B, cannoni da 14 pollici', 4);
  say(N.radio, 'Qui USS Texas: torretta B pronta. Inquadrate le postazioni sulla scogliera e fate fuoco.');
}
function exitNaval() { scene.fog.density = FOG_BASE; }
function updateNaval(dt) {
  const T = WORLD.texas;
  camera.position.copy(T.cam);
  camera.rotation.set(NAV.pitch, NAV.yaw, 0);
  const fov = NAV.zoom ? 5.5 : 60;
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 10)); camera.updateProjectionMatrix(); }
  camera.getWorldDirection(_nd);
  const t = rayTerrain(camera.position, _nd, 2800);
  if (t > 0) { NAV.target = camera.position.clone().addScaledVector(_nd, t); NAV.range = NAV.target.distanceTo(T.g.position); }
  else { NAV.target = null; NAV.range = 0; }
  // la torretta insegue il puntamento con velocità di brandeggio limitata
  const want = NAV.target ? Math.atan2(-(NAV.target.x - T.g.position.x), -(NAV.target.z - T.g.position.z)) : NAV.yaw;
  T.yaw = angLerpMax(T.yaw, want, .22 * dt);
  T.g.rotation.y = T.yaw;
  const wantEl = NAV.target ? clamp(Math.asin(clamp(NAV.range * 9.8 / (620 * 620), -1, 1)) / 2 + .02, .02, .5) : .05;
  T.elev = lerp(T.elev, wantEl, dt * .8); T.pitch.rotation.x = T.elev;
  NAV.reload = Math.max(0, NAV.reload - dt);
  const aligned = NAV.target && Math.abs(angDiff(T.yaw, want)) < .012;
  NAV.ready = NAV.reload <= 0 && aligned;
  if (mouseL && NAV.ready) fireNaval();
  P.pos.copy(camera.position);
}
function angDiff(a, b) { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return d; }
function angLerpMax(a, b, m) { const d = angDiff(a, b); return a + clamp(d, -m, m); }
function fireNaval() {
  const T = WORLD.texas; NAV.reload = 8; NAV.salvo++;
  T.g.updateMatrixWorld(true);
  for (const mz of T.muzzles) {
    const p = mz.clone().applyMatrix4(T.pitch.matrixWorld);
    PS_FIRE.emit(p.x, p.y, p.z, 0, 2, -20, .35, 18, 30, 1, 4, 2.6, 1.2);
    for (let i = 0; i < 8; i++) PS_SMOKE.emit(p.x, p.y, p.z, rnd(-4, 4), rnd(1, 4), rnd(-20, -8), rnd(6, 10), 8, 30, .7, .6, .6, .6, .5, -.1);
    flashLight(p, 0xffc070, 200, .25);
    const tgt = NAV.target.clone().add(new V3(rnd(-1, 1) * NAV.range * .012, 0, rnd(-1, 1) * NAV.range * .018));
    const Tf = NAV.range / 620 + 1.2, v = tgt.clone().sub(p).multiplyScalar(1 / Tf); v.y += .5 * 9.8 * Tf;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 1.6, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.5, 1.5) }));
    m.geometry.rotateX(PI / 2); m.position.copy(p); scene.add(m);
    projectiles.push({ type: 'shell', p: m.position, v, life: Tf + 2, m, byPlayer: true });
  }
  sfxShipNear(); P.shake = 1.2; muffle(1.2);
  if (gradePass) gradePass.uniforms.uFlash.value = .5;
}
function navalImpact(p, q) {
  explode(p, 15, 900, { byPlayer: true, bomb: true });
  for (let i = 0; i < 2; i++) fxExplosion(p.clone().add(new V3(rnd(-4, 4), 0, rnd(-4, 4))), 3.2, p.z > -9 && Hf(p.x, p.z) < WATER_Y);
  for (const b of WORLD.bunkers) if (!b.destroyed && Math.hypot(b.x - p.x, b.z - p.z) < 9) { b.destroy(); onObjectiveEvent('bunker', b, true); }
  for (const b of WORLD.extraBunkers || []) if (!b.destroyed && Math.hypot(b.x - p.x, b.z - p.z) < 9) { b.destroy(); feed('Caposaldo distrutto'); }
  for (const f of WORLD.flaks) if (f.alive && Math.hypot(f.x - p.x, f.z - p.z) < 10) { f.destroy(); onObjectiveEvent('flak', f, true); }
  const hitAllies = allies.filter(a => a.alive && a.pos.distanceTo(p) < 25).length;
  if (!q.reported) {
    q.reported = true;
    if (hitAllies > 0) say(N.radio, 'Cessate il fuoco! State colpendo le nostre truppe!');
    else {
      const near = enemies.filter(e => e.alive && e.pos.distanceTo(p) < 40);
      if (!near.length && NAV.salvo % 2 === 1) {
        const anyE = enemies.filter(e => e.alive).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p))[0];
        if (anyE) say(N.radio, anyE.pos.z < p.z ? 'Colpo corto, alzate il tiro.' : 'Colpo lungo, accorciate.');
      } else if (near.length) say(N.radio, pick(['Bersaglio colpito!', 'Ottimo tiro, Texas!', 'Postazione centrata!']));
    }
  }
}
