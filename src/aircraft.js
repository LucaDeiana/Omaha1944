"use strict";
// ============================================================
//  Aerei: P-47 (alleati), Fw 190 (tedeschi), B-26; contraerea;
//  modalità pilota in prima persona con modello di volo fisico
// ============================================================
const PLANES = [];
const PL = { me: null, stickX: 0, stickY: 0, rudder: 0, throttle: .85, gunT: 0, bombs: 2, rearm: 0, cockpit: null, gauges: null, gT: 0, G: 1, firing: false };
const PGEO = {};
const _a1 = new V3(), _a2 = new V3(), _a3 = new V3(), _a4 = new V3(), _aq = new THREE.Quaternion(), _am = new THREE.Matrix4();

function lathe(pts, seg) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), seg); g.rotateX(PI / 2); return g; }
function planform(pts, thick) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * .3, bevelSize: thick * .3, bevelSegments: 1 }); g.translate(0, 0, -thick / 2); g.rotateX(-PI / 2); return g; }
function finG(pts, thick) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); g.translate(0, 0, -thick / 2); g.rotateY(-PI / 2); return g; }
function buildPlaneGeos() { for (const t of ['p47', 'fw190', 'b26']) buildPlaneData(t); PGEO.ready = true; }

class Plane {
  constructor(type, team, pos, vel, path) {
    this.type = type; this.team = team; this.g = makePlaneModel(type);
    this.props = this.g.userData.props;
    this.pos = this.g.position; this.pos.copy(pos); this.vel = vel.clone(); this.q = this.g.quaternion;
    const spc = typeof PLANE_SPECS !== 'undefined' && PLANE_SPECS[type];
    this.hp = type === 'b26' ? 900 : spc && !spc.builtin ? spc.hp * .35 : 350; this.alive = true; this.path = path || []; this.pi = 0; this.fireT = 0; this.bombs = type === 'b26' ? 6 : 2; this.bombT = 0;
    this.crash = false; this.age = 0; this.roll = 0;
    this.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.g); PLANES.push(this);
    this.eng = loopSound(type === 'fw190' || (spc && spc.nation === 'de') ? 'eng_fw' : type === 'b26' ? 'eng_bomber' : 'eng_p47', 0, 'aircraft.' + type + '.engine');
    if (spc && spc.jet) this.jet = true;
    this.orient(0);
  }
  orient(roll) {
    _a1.copy(this.vel).normalize();
    _am.lookAt(_a2.set(0, 0, 0), _a1, _a3.set(0, 1, 0));
    this.q.setFromRotationMatrix(_am);
    _aq.setFromAxisAngle(_a1.set(0, 0, 1), roll); this.q.multiply(_aq);
  }
  damage(a, byPlayer) {
    if (!this.alive || this.crash) return;
    this.hp -= a;
    if (this.hp <= 0) {
      this.crash = true; this.trail = addEmitter(this.pos, 'trail', 1.5); this.trail.follow = q => q.copy(this.pos); this.trail.life = 30;
      const fate = R(), big = this.type === 'b26';
      if (fate < (big ? .2 : .3)) this.blowUp();
      else if (fate < .72) this.loseWing(R() < .5 ? -1 : 1);
      if (byPlayer) { STATS.kills += 2; feed(this.team === 'E' ? 'Caccia nemico abbattuto!' : 'Aereo abbattuto'); }
      if (this.team === 'E' && dist2Cam(this.pos) < 900 * 900) say(N.walsh, 'L\'hanno preso! Sta precipitando!');
    }
  }
  update(dt) {
    this.age += dt;
    if (this.doomT !== undefined && !this.crash) { this.doomT -= dt; if (this.doomT <= 0) { this.doomT = undefined; fxExplosion(this.pos.clone(), 1.2, false); sfxBoom(this.pos, 1); this.damage(9999, false); if (dist2Cam(this.pos) < 900 * 900) say(N.walsh, this.team === 'A' ? 'Hanno preso un Thunderbolt!' : 'Un crucco abbattuto!'); } }
    for (const p of this.props) { p.rotation.z += dt * 47; p.userData.disc.material.opacity = .14; }
    if (this.crash) {
      this.vel.y -= 9.8 * dt * 1.4; this.vel.multiplyScalar(1 - .1 * dt); this.roll += dt * (this.wingLost ? 6 * this.wingLost : 2);
      this.pos.addScaledVector(this.vel, dt); this.orient(this.roll);
      const gy = Math.max(Hf(this.pos.x, this.pos.z), this.pos.z > -9 ? WATER_Y : -99);
      if (this.pos.y < gy + 1) { explode(this.pos.clone().setY(gy + .5), 12, 500, {}); this.remove(); }
    } else if (this.wing) { wingmanAI(this, dt);
    } else if (this.hunter) { huntPlayer(this, dt);
    } else if (this.pi < this.path.length) {
      const wp = this.path[this.pi];
      _a1.subVectors(wp.p, this.pos); const d = _a1.length();
      const sp = this.vel.length(), turn = (this.type === 'b26' ? .25 : .7) * dt;
      _a1.normalize(); _a2.copy(this.vel).normalize();
      const nv = _a2.lerp(_a1, Math.min(1, turn)).normalize();
      const lat = new V3().crossVectors(this.vel.clone().normalize(), nv).y;
      this.roll = lerp(this.roll, clamp(-lat * 40, -1.2, 1.2), dt * 2);
      this.vel.copy(nv).multiplyScalar(lerp(sp, wp.v || sp, dt * .5));
      this.pos.addScaledVector(this.vel, dt); this.orient(this.roll);
      if (d < (wp.r || 60) || _a1.dot(this.vel) < 0 && d < 300) this.pi++;
      if (wp.guns && d < 900) this.strafe(dt);
      if (wp.bomb && this.bombs > 0) {
        this.bombT -= dt;
        const tz = wp.bomb, lead = this.vel.length() * Math.sqrt(2 * Math.max(10, this.pos.y - Hf(this.pos.x, tz.z)) / 9.8);
        const hd = Math.hypot(tz.x - this.pos.x, tz.z - this.pos.z);
        if (hd < lead + 15 && this.bombT <= 0) { this.dropBomb(); this.bombT = this.type === 'b26' ? .35 : .15; }
      }
    } else { this.pos.addScaledVector(this.vel, dt); this.orient(this.roll *= .98); if (this.age > 60 || Math.abs(this.pos.x) > 2500 || Math.abs(this.pos.z) > 2500) this.remove(); }
    this.eng && this.eng.at(this.pos, this.type === 'b26' ? 2.2 : 1.6, 1 + clamp(-_a3.subVectors(this.pos, camera.position).normalize().dot(this.vel) / 343, -.3, .3), this.type === 'b26' ? 500 : 260);
    if (this.alive && !this.crash && this.team === 'E' && dist2Cam(this.pos) < 220 * 220 && !this.shouted) { this.shouted = true; shout('en', 'plane', P.pos.clone().add(new V3(rnd(-8, 8), 0, rnd(-8, 8))), { text: pick(['Aircraft! Get down!', 'Here come the Jerries!']) }); }
  }
  // esplode in aria: palla di fuoco, rottami che cadono
  blowUp() {
    const p = this.pos.clone(); fxExplosion(p, this.type === 'b26' ? 4 : 2.8, false); sfxBoom(p, 2.6); flashLight(p, 0xffa040, 120, .25);
    for (let k = 0; k < 7; k++) airDebris(p, this.vel.clone().multiplyScalar(.6).add(new V3(rnd(-25, 25), rnd(-10, 20), rnd(-25, 25))), rnd(.6, 2.2), k < 3 ? 0x4a5033 : 0x2a2a2a, true);
    this.exploded = true;
    if (!this.player) this.remove();
  }
  // un'ala si stacca: il modello perde l'ala (taglio nello shader) e l'aereo entra in vite
  loseWing(side) {
    this.wingLost = side; cutWing(this.g, side);
    // motori e insegne sull'ala persa spariscono con lei
    for (const o of this.g.children) if (o.position.x * side > 2.1) o.visible = false;
    const r = _a2.set(1, 0, 0).applyQuaternion(this.q), p = this.pos.clone().addScaledVector(r, side * 4);
    fxExplosion(p, 1.2, false); sfxBoom(p, 1.4);
    airDebris(p, this.vel.clone().addScaledVector(r, side * 10).add(new V3(0, 6, 0)), 0, this.type === 'fw190' ? 0x5c6268 : 0x4a5033, false, side, this.type === 'b26' ? 1.7 : 1);
  }
  strafe(dt) {
    this.fireT -= dt; if (this.fireT > 0) return; this.fireT = .06;
    const f = _a1.set(0, 0, -1).applyQuaternion(this.q), right = _a2.set(1, 0, 0).applyQuaternion(this.q);
    if (f.y > -.05) return;
    sfxAirGun(this.pos, this.team === 'A' ? 'p47' : 'fw190');
    for (const sx of [-1, 1]) {
      const o = this.pos.clone().addScaledVector(right, sx * 2.6);
      const d = f.clone().add(new V3(rnd(-.012, .012), rnd(-.012, .012), rnd(-.012, .012))).normalize();
      const t = rayTerrain(o, d, 900); if (t < 0) continue;
      const p = o.clone().addScaledVector(d, t), wet = p.z > -9 && Hf(p.x, p.z) < WATER_Y;
      if (wet) p.y = WATER_Y;
      if (R() < .5) fxTracer(o, p, 1.3);
      fxImpact(p, wet ? 'water' : p.z > -58 ? 'sand' : 'dirt');
      if (dist2Cam(p) < 30 * 30) sfxImpact(p, wet ? 'water' : 'sand');
      const victims = this.team === 'A' ? enemies : allies;
      for (const s of victims) if (s.alive && s.state !== 'boat' && !s.inBunker && Math.abs(s.pos.x - p.x) < 1.4 && Math.abs(s.pos.z - p.z) < 1.4) s.damage(rnd(60, 120), o, this.player === true, 'body', { dir: d.clone(), power: 3, joint: 15 });
      if (this.team !== PT && P.targetable() && P.pos.distanceTo(p) < 1.6) P.damage(rnd(40, 70) * D.dmg, o, false, { name: 'Aereo nemico', weapon: 'mitragliamento', pos: o.clone() });
      else if (this.team !== PT && P.targetable() && P.pos.distanceTo(p) < 6) P.nearMiss(o, p);
    }
  }
  dropBomb() {
    this.bombs--;
    projGeos();
    const m = new THREE.Mesh(BOMB_G(), MAT.paint); m.position.copy(this.pos).add(new V3(0, -1, 0)); scene.add(m);
    projectiles.push({ type: 'bomb', p: m.position, v: this.vel.clone(), life: 30, m, byPlayer: false, team: this.team });
  }
  remove() { this.alive = false; scene.remove(this.g); if (this.eng) this.eng.stop(); if (this.trail) this.trail.life = 0; const i = PLANES.indexOf(this); if (i >= 0) PLANES.splice(i, 1); }
}
// ---------- rottami in volo ----------
const AIRDEB = [];
function airDebris(p, v, size, hex, burning, wingSide = 0, scale = 1) {
  let m;
  if (wingSide) { const g = new THREE.BoxGeometry(5.2 * scale, .22 * scale, 2.2 * scale); g.translate(wingSide * 2.6 * scale, 0, 0); m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col(hex), roughness: .8 })); }
  else m = new THREE.Mesh(U.box, new THREE.MeshStandardMaterial({ color: col(hex), roughness: .9, metalness: .3 })), m.scale.set(size, size * .4, size * 1.3);
  m.position.copy(p); m.castShadow = true; scene.add(m);
  const d = { m, v, spin: new V3(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)), life: 25 };
  if (burning || wingSide) { d.smoke = addEmitter(m.position, 'trail', wingSide ? .8 : .6); d.smoke.follow = q => q.copy(m.position); d.smoke.life = 20; }
  AIRDEB.push(d);
}
function updateAirDebris(dt) {
  for (let i = AIRDEB.length - 1; i >= 0; i--) {
    const d = AIRDEB[i]; d.life -= dt;
    d.v.y -= 9.8 * dt; d.v.multiplyScalar(1 - .35 * dt); d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
    const gy = Math.max(Hf(d.m.position.x, d.m.position.z), d.m.position.z > -9 ? WATER_Y : -99);
    if (d.m.position.y < gy + .3 || d.life <= 0) {
      if (d.life > 0) { fxImpact(d.m.position.clone().setY(gy + .2), 'dirt'); if (d.m.scale.x > 1.5 || d.m.geometry !== U.box) { const e = addEmitter(d.m.position.clone().setY(gy + .3), 'fire', .5); e.life = 25; } }
      if (d.smoke) d.smoke.life = 0;
      if (d.life <= 0 || d.m.position.y < gy - 1) { scene.remove(d.m); AIRDEB.splice(i, 1); } else { d.v.set(0, 0, 0); d.spin.set(0, 0, 0); d.m.position.y = gy + .1; d.life = Math.min(d.life, 15); }
    }
  }
}
// taglia un'ala dal modello: i frammenti oltre la radice dell'ala vengono scartati nello shader
function cutWing(g, side) {
  g.traverse(o => {
    if (!o.isMesh || o.userData.disc || !o.geometry || !o.geometry.attributes.position) return;
    const base = o.material, nm = base.clone(), orig = base.onBeforeCompile;
    nm.onBeforeCompile = (sh, rr) => {
      if (orig) orig.call(nm, sh, rr);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCutX;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCutX = position.x;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCutX;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (vCutX * ${side.toFixed(1)} > 2.1) discard;`);
    };
    nm.customProgramCacheKey = () => 'cutwing' + side + (base.customProgramCacheKey ? base.customProgramCacheKey() : '');
    o.material = nm;
  });
}
let _bombG = null;
function BOMB_G() {
  if (_bombG) return _bombG;
  const mb = new MB(); mb.add(U.cyl12, 0x4d5537, 0, 0, 0, PI / 2, 0, 0, .18, 1.1, .18); mb.add(U.sph, 0x4d5537, 0, 0, -.55, 0, 0, 0, .18, .18, .25);
  for (let k = 0; k < 4; k++) mb.add(U.box, 0x3d4527, 0, 0, .6, 0, 0, k * PI / 4, .42, .02, .3);
  return _bombG = mb.build();
}
function bombImpact(p, q) {
  explode(p, 11, 650, { byPlayer: !!q.byPlayer, bomb: true, only: q.team === 'E' ? 'A' : (q.byPlayer ? undefined : 'E') });
  if (!q.byPlayer) return;
  // bomba da 500 libbre: schegge e onda d'urto distruggono i mezzi leggeri fino a ~25 m, un colpo diretto ferma anche un carro
  for (const v of MISSION.vehicles) if (v.alive) { const d = v.pos.distanceTo(p); if (d >= 13.5 && d < 25) v.damage(420 * (1 - (d - 13.5) / 11.5), true); else if (d < 6 && v.tank) v.damage(900, true); }
  if (SCEN === 'air') airBombHit(p);
  for (const b of WORLD.extraBunkers || []) if (!b.destroyed && Math.hypot(b.x - p.x, b.z - p.z) < 8) { b.destroy(); feed('Caposaldo distrutto'); }
  for (const b of WORLD.bunkers) if (!b.destroyed && Math.hypot(b.x - p.x, b.z - p.z) < 8) { b.destroy(); onObjectiveEvent('bunker', b, true); }
  for (const f of WORLD.flaks) if (f.alive && Math.hypot(f.x - p.x, f.z - p.z) < 8) { f.destroy(); onObjectiveEvent('flak', f, true); }
}

// ---------- incursioni dell'IA ----------
function raidP47(target) {
  const T = target.clone(), side = rnd(-1, 1) * 200, n = R() < .5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const off = new V3(rnd(-90, 90), rnd(-25, 45), i * rnd(60, 160));
    const start = new V3(T.x + side + off.x, 380 + off.y, 1300 + off.z);
    const tp = T.clone().add(new V3(rnd(-15, 15), 0, rnd(-15, 15)));
    const path = [
      { p: new V3(tp.x + side * .3, 260, tp.z + 700), v: 150 },
      { p: new V3(tp.x, tp.y + 45, tp.z + 120), v: 170, guns: true, bomb: tp, r: 50 },
      { p: new V3(tp.x, 140, tp.z - 350), v: 160 },
      { p: new V3(tp.x - side, 450, tp.z - 1600), v: 140 },
    ];
    const pl = new Plane('p47', 'A', start, new V3(0, -10, -140), path); pl.pi = 0; if (R() < .3) pl.doomT = rnd(8, 18);
  }
  if (dist2Cam(T) < 400 * 400) after(6, () => shout('de', 'plane', T, { range: 200 }));
}
function raidFw190() {
  const x = rnd(-120, 120), n = R() < .6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const xo = x + i * 18;
    const path = [
      { p: new V3(xo, 160, -250), v: 160 },
      { p: new V3(xo + rnd(-10, 10), 22, -48), v: 170, guns: true, bomb: new V3(xo, 0, -25), r: 40 },
      { p: new V3(xo, 30, 120), v: 165, guns: true },
      { p: new V3(xo + 300, 400, 900), v: 150 },
    ];
    const fw = new Plane('fw190', 'E', new V3(xo + rnd(-60, 60), 320 + rnd(-30, 30), -1300 - i * rnd(60, 150)), new V3(0, -15, 150), path); if (R() < .3) fw.doomT = rnd(10, 20);
  }
}
function raidB26() {
  const x0 = rnd(-200, 100);
  for (let i = 0; i < 6; i++) {
    const o = new V3((i % 3) * 40 - 40, 0, Math.floor(i / 3) * 50);
    const path = [{ p: new V3(x0 + o.x, 520, -60 + o.z), v: 95, bomb: new V3(x0 + o.x + rnd(-20, 20), 0, rnd(-260, -120)), r: 120 }, { p: new V3(x0 + o.x, 540, -2000), v: 95 }];
    new Plane('b26', 'A', new V3(x0 + o.x, 520, 1500 + o.z), new V3(0, 0, -95), path);
  }
}
// contraerea tedesca (Flak 38 da 20 mm) e navale alleata
const AA = { t: 0 };
function updateAA(dt) {
  AA.cool = Math.max(0, (AA.cool || 0) - dt);
  AA.t -= dt; if (AA.t > 0) return; AA.t = .1;
  for (const a of WORLD.aaSites) {
    if (a.dead || !a.mesh) continue;
    const crew = enemies.some(e => e.alive && e.role === 'aa' && Math.hypot(e.pos.x - a.x, e.pos.z - a.z) < 5);
    if (!crew) continue;
    let tgt = null, bd = 1100;
    for (const p of PLANES) if (p.team === 'A' && !p.crash) { const d = p.pos.distanceTo(a.mesh.position); if (d < bd) { bd = d; tgt = p; } }
    if (!tgt) continue;
    const o = a.mesh.position.clone().add(new V3(0, 1.2, 0)), lead = tgt.pos.clone().addScaledVector(tgt.vel, bd / 900);
    lead.add(new V3(rnd(-25, 25), rnd(-20, 20), rnd(-25, 25)));
    fxTracer(o, lead, 1.6); sfxShot('flak', o);
    if (R() < .25) { PS_SMOKE.emit(lead.x, lead.y, lead.z, 0, 0, 0, 4, 2, 6, .8, .05, .05, .05, .2, 0); PS_FIRE.emit(lead.x, lead.y, lead.z, 0, 0, 0, .15, 2, 3, 1, 4, 2.5, 1); if (dist2Cam(lead) < 300 * 300) play('boom_far', lead, { ref: 80, vol: .6, rate: 1.6 }); }
    // colpo a segno: probabilità che cala con la distanza e con la velocità; al giocatore al massimo un colpo ogni 0,6 s
    const near = (1 - bd / 1100) ** 1.6, fast = clamp(1.4 - tgt.vel.length() / 160, .45, 1);
    if (tgt.player ? AA.cool <= 0 && R() < .03 * near * fast : R() < .015) { if (tgt.player) AA.cool = .6; tgt.damage(tgt.player ? rnd(14, 32) : rnd(25, 60), false); if (tgt.player) { P.shake = Math.min(.6, P.shake + .15); lensSplat('dirt', .2); play('imp_metal', null, { vol: .8 }); } }
  }
  for (const p of PLANES) {
    // contraerea delle navi alleate al largo di Omaha: solo dove le navi ci sono davvero
    if (SCEN !== 'omaha' || p.team !== 'E' || p.crash || p.pos.z < 150) continue;
    if (R() < .4) { const o = new V3(rnd(-400, 400), 10, rnd(400, 800)); fxTracer(o, p.pos.clone().add(new V3(rnd(-40, 40), rnd(-30, 30), rnd(-40, 40))), 1.2); if (R() < .03) p.damage(rnd(40, 90), false); }
  }
}
let raidT = { p47: 25, fw: 70, b26: 6 };
function updateAircraft(dt) {
  const st = MISSION.stage;
  if (st >= 0 && P.mode !== 'plane' && SCEN === 'omaha') {
    raidT.b26 -= dt; if (raidT.b26 <= 0) { raidT.b26 = 1e9; raidB26(); }
    raidT.p47 -= dt;
    if (raidT.p47 <= 0 && st >= 1) {
      raidT.p47 = rnd(45, 80);
      const al = enemies.filter(e => e.alive && !e.inBunker && e.pos.z < -70 && e.pos.distanceTo(P.pos) > 60);
      if (al.length) raidP47(pick(al).pos);
    }
    raidT.fw -= dt;
    if (raidT.fw <= 0 && st >= 1 && st <= 4) { raidT.fw = rnd(110, 170); raidFw190(); }
  }
  for (let i = PLANES.length - 1; i >= 0; i--) { const p = PLANES[i]; if (p.player) continue; p.update(dt); }
  updateAirDebris(dt);
  updateAA(dt);
  updateAirBullets(dt); updateAirSight();
}

// ============================================================
//  Modalità pilota: P-47 in prima persona
// ============================================================
// la cabina in prima persona e gli strumenti sono in cockpit.js
// colpo sul P-47: blindatura, poi danno a un componente scelto a caso con effetti in volo
const PART_NAME = { eng: 'Motore', wl: 'Ala sinistra', wr: 'Ala destra', tail: 'Impennaggi' };
function playerPlaneHit(me, a, byPlayer) {
  if (!me.alive || me.crash) return;
  a *= .7; me.hp -= a;
  const r = R(), k = r < .32 ? 'eng' : r < .56 ? 'wl' : r < .8 ? 'wr' : 'tail', before = me.parts[k];
  me.parts[k] = Math.max(0, before - a / 260);
  const v = me.parts[k];
  if (before >= .5 && v < .5) showMsg(PART_NAME[k] + ' danneggiato', 1.8);
  if (k === 'eng' && v < .55 && !me.engSmoke) { me.engSmoke = addEmitter(me.pos, 'trail', .5); me.engSmoke.follow = q => q.copy(me.pos); me.engSmoke.life = 1e9; }
  if (k === 'eng' && v < .18 && !me.engFire) { me.engFire = addEmitter(me.pos, 'fire', .35); me.engFire.follow = q => q.copy(me.pos); me.engFire.life = 1e9; showMsg('Motore in fiamme!', 2.5); }
  if ((k === 'wl' || k === 'wr') && v <= 0) { me.hp = 0; }
  if (me.hp <= 0) {
    if (me.engSmoke) me.engSmoke.life = 0; if (me.engFire) me.engFire.life = 0;
    const side = me.parts.wl <= 0 ? -1 : me.parts.wr <= 0 ? 1 : 0;
    Plane.prototype.damage.call(me, 99999, byPlayer);
    if (side && !me.wingLost && !me.exploded) me.loseWing(side);
  }
}
// pannello dei danni nella parte bassa dello schermo
// schema del P-47 visto dall'alto: ogni parte colorata secondo i danni (verde, giallo, rosso, nero se persa)
const DMG_SVG = '<svg viewBox="0 0 140 150" width="140" height="150" style="display:block;margin:0 auto">' +
  '<g stroke="#0c0e09" stroke-width="1.5" stroke-linejoin="round">' +
  '<path id="dmWl" d="M58 52 L6 62 Q2 66 6 72 L58 78 Z"/>' +
  '<path id="dmWr" d="M82 52 L134 62 Q138 66 134 72 L82 78 Z"/>' +
  '<path id="dmTail" d="M64 118 L36 126 Q34 130 38 132 L66 132 L70 146 L74 132 L102 132 Q106 130 104 126 L76 118 Z"/>' +
  '<path id="dmHull" d="M60 34 Q58 30 70 28 Q82 30 80 34 L80 82 Q78 112 72 128 L68 128 Q62 112 60 82 Z"/>' +
  '<path id="dmEng" d="M58 34 Q56 14 70 8 Q84 14 82 34 Z"/>' +
  '<ellipse cx="70" cy="46" rx="5" ry="8" fill="#9bb4c0" opacity=".7"/></g>' +
  '<line x1="52" y1="5" x2="88" y2="5" stroke="#c9c3ad" stroke-width="2" opacity=".6"/></svg><div id="dmTxt"></div>';
function planeDamageHud(me) {
  let el = $('planeDmg');
  if (!el) {
    el = document.createElement('div'); el.id = 'planeDmg';
    el.style.cssText = 'position:fixed;right:16px;top:96px;width:150px;pointer-events:none;z-index:18;font:600 10px/1.3 Oswald,sans-serif;color:#e8e2cf;text-shadow:0 1px 2px #000;letter-spacing:.06em;text-align:center;background:rgba(10,12,8,.35);border:1px solid rgba(232,226,207,.25);border-radius:6px;padding:6px 4px';
    el.innerHTML = DMG_SVG; document.body.appendChild(el);
  }
  if (!me || !me.parts || P.mode !== 'plane') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const colr = (v, lost) => lost ? '#151515' : v > .66 ? '#6fae4f' : v > .33 ? '#d9b443' : '#c8432f';
  const pt = me.parts, hull = clamp(me.hp / (me.hpMax || 1100), 0, 1), blink = Math.sin(GAME.time * 10) > 0;
  $('dmEng').setAttribute('fill', me.engFire && blink ? '#ff7a30' : colr(pt.eng));
  $('dmWl').setAttribute('fill', colr(pt.wl, me.wingLost === -1 || pt.wl <= 0));
  $('dmWr').setAttribute('fill', colr(pt.wr, me.wingLost === 1 || pt.wr <= 0));
  $('dmTail').setAttribute('fill', colr(pt.tail));
  $('dmHull').setAttribute('fill', colr(hull));
  $('dmTxt').innerHTML = 'SCAFO ' + Math.round(hull * 100) + '% · MOTORE ' + Math.round(pt.eng * 100) + '%' + (me.engFire ? '<br><b style="color:#ff7a50">MOTORE IN FIAMME</b>' : '');
}
// gregario: in formazione sull'ala del giocatore; se ci sono caccia nemici vicini li attacca
function wingmanAI(p, dt) {
  const me = PL.me;
  let foe = null, bd = 1600;
  for (const q of PLANES) if (q.team === 'E' && q.alive && !q.crash) { const d = q.pos.distanceTo(p.pos); if (d < bd) { bd = d; foe = q; } }
  let want, spd = 160;
  let aimP = null;
  if (foe) { aimP = bd < 900 ? aiAirGuns(p, foe, dt) : null; want = (aimP || foe.pos.clone().addScaledVector(foe.vel, bd / 750)).clone().sub(p.pos).normalize(); spd = (PLANE_VMAX[p.type] || 640) / 3.6 * .93; }
  else if (me && P.mode === 'plane' && !me.crash && !PL.onDeck) {
    const slot = _a2.set(p.side * 28, 4, 22 + p.side * 6).applyQuaternion(me.q).add(me.pos), d = slot.distanceTo(p.pos);
    want = slot.clone().addScaledVector(me.vel, 1.2).sub(p.pos).normalize(); spd = clamp(me.vel.length() + d * .4, 90, (PLANE_VMAX[p.type] || 640) / 3.6);
  } else {
    // senza giocatore in volo (a terra, sul ponte, abbattuto): giro d'attesa in quota a velocità di crociera
    p.vel.applyAxisAngle(_wUp, .25 * dt); p.vel.y = lerp(p.vel.y, clamp((Hf(p.pos.x, p.pos.z) + 300 - p.pos.y) * .05, -8, 8), dt);
    p.vel.setLength(lerp(p.vel.length(), 120, dt * .5)); p.roll = lerp(p.roll, -.5, dt); p.pos.addScaledVector(p.vel, dt); p.orient(p.roll); return;
  }
  const cur = p.vel.clone().normalize(), ang = Math.acos(clamp(cur.dot(want), -1, 1)), nv = ang > 1e-4 ? cur.clone().lerp(want, Math.min(1, .4 * dt / ang)).normalize() : cur.clone(), lat = new V3().crossVectors(cur, nv).y;
  p.roll = lerp(p.roll, clamp(-lat * 40, -1.3, 1.3), dt * 2);
  const sp0 = p.vel.length();  // letta prima di sovrascrivere la direzione (prima si leggeva il versore: i gregari restavano a 3 m/s)
  p.vel.copy(nv).multiplyScalar(lerp(sp0, spd, dt * .8)); p.pos.addScaledVector(p.vel, dt); p.orient(p.roll);
  if (p.pos.y < Hf(p.pos.x, p.pos.z) + 80) p.vel.y += 40 * dt;
}
const _wUp = new V3(0, 1, 0);
function spawnWingmen() {
  if (SCEN !== 'air' || !PL.me) return;
  PL.wing = (PL.wing || []).filter(w => w.alive && !w.crash);
  for (const side of [-1, 1]) {
    if (PL.wing.some(w => w.side === side)) continue;
    const me = PL.me, pos = _a2.set(side * 30, 5, 30).applyQuaternion(me.q).add(me.pos);
    const v0 = me.vel.clone(); if (v0.length() < 95) v0.setLength(95);  // al decollo il giocatore è lento: i gregari partono già in velocità
    const w = new Plane(PL.type && PLANE_SPECS[PL.type].nation !== 'de' ? PL.type : 'p47', 'A', pos.clone(), v0, []); w.wing = true; w.side = side; w.hp = 600; PL.wing.push(w);
  }
}
// carrello: due gambe principali nelle ali e ruotino di coda; G lo ritrae o lo estrae (circa 2 secondi)
function buildGear(me) {
  const gd = me.g.userData && me.g.userData.data && me.g.userData.data.gear;
  if (gd && gd.fixed) { if (me.player) PL.gearH = 2.4; return; }
  const GX = gd ? gd.x : 1.55, GY = gd ? gd.y : -.42, GZ = gd ? gd.z : -.9, GL = gd ? gd.len : 1.55, TZ = gd ? gd.tailZ : 4.6;
  if (me.player) PL.gearH = .42 + GL - GY - .14;
  const g = new THREE.Group(), mat = PLANE_MAT.paint || MAT.paint, dk = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .8 }), mt = new THREE.MeshStandardMaterial({ color: 0x8a8d86, roughness: .45, metalness: .6 });
  const legs = [];
  for (const side of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(side * GX, GY, GZ); g.add(piv);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, GL, 8), mt); strut.position.y = -GL / 2; piv.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .22, 16), dk); wheel.rotation.z = PI / 2; wheel.position.set(side * -.12, -GL, 0); piv.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .24, 10), mt); hub.rotation.z = PI / 2; hub.position.copy(wheel.position); piv.add(hub);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.04, 1.1, .55), new THREE.MeshStandardMaterial({ color: 0x6b6e68, roughness: .6 })); door.position.set(side * .12, -.6, 0); piv.add(door);
    legs.push({ piv, side });
  }
  const tp = new THREE.Group(); tp.position.set(0, -.25, TZ); g.add(tp);
  const ts = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .55, 6), mt); ts.position.y = -.27; tp.add(ts);
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .1, 12), dk); tw.rotation.z = PI / 2; tw.position.y = -.55; tp.add(tw);
  me.g.add(g); me.gear = { g, legs, tail: tp };
}
function updateGear(me, dt) {
  const G = me.gear; if (!G) return;
  PL.gearK = clamp((PL.gearK ?? 0) + (PL.gearUp ? -1 : 1) * dt * .55, 0, 1);
  const k = smooth(PL.gearK);
  for (const l of G.legs) l.piv.rotation.z = -l.side * (1 - k) * PI / 2;
  G.tail.rotation.x = (1 - k) * PI / 2;
  G.g.visible = PL.gearK > .02;
}
function togglePlaneGear() {
  if (PL.onDeck) { showMsg('Non puoi ritrarre il carrello sul ponte', 1.5); return; }
  PL.gearUp = !PL.gearUp; showMsg(PL.gearUp ? 'Carrello: retrazione' : 'Carrello: estrazione', 1.5); play('mag_in', null, { vol: .5, rate: .5 });
}
// rullaggio sul ponte: spinta contro attrito, coda a terra che si alza con la velocità, decollo o caduta oltre la prua
function carrierRoll(me, dt, thrust, m) {
  // cavo d'arresto agganciato: frenata decisa fino all'arresto
  const brake = (KEYS.KeyS && PL.throttle < .05 ? 9 : 0) + (PL.arrest ? 16 : 0);
  if (PL.arrest && PL.deckV < .5) PL.arrest = false;
  let sp = PL.deckV + (thrust * 1.65 / m - (PL.deckV > .5 ? .7 : 0) - brake) * dt; // nave controvento: il vento sul ponte aiuta la corsa
  if (PL.throttle < .02 && sp < .6) sp = 0;
  sp = Math.max(0, sp); PL.deckV = sp;
  if (sp < 15) PL.deckYaw -= PL.rudder * dt * .35;
  const yaw = PL.deckYaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  me.pos.x += fx * sp * dt; me.pos.z += fz * sp * dt;
  const sy = landSurfY(me.pos.x, me.pos.z, .6);  // già a terra si regge anche su dossi più ripidi
  // in rullaggio su terreno troppo ripido o in acqua il carrello cede
  if (sy < -90 && carrierDeckAt(me.pos.x - fx * sp * dt, me.pos.z - fz * sp * dt) < -90 && sp < 36) { PL.onDeck = false; me.vel.set(fx * sp, -8, fz * sp); me.pos.y -= 2; return; }
  me.pos.y = (sy > -90 ? sy : CARRIER.deckY) + (PL.gearH || 2.25);
  me.vel.set(fx * sp, 0, fz * sp);
  const pitch = lerp(.19, .035, smooth((sp - 18) / 24));
  me.q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')); PL.av.set(0, 0, 0); PL.G = 1;
  PL.aimYaw = yaw;
  const pull = PL.assist ? PL.aimPitch > .1 : PL.stickY > .25;
  if (sp > 41 && (pull || sp > 50)) { PL.onDeck = false; PL.liftT = 2; me.vel.y = 4; showMsg('Decollo! G per ritrarre il carrello', 2); spawnWingmen(); return; }
  if (landSurfY(me.pos.x, me.pos.z, .6) < -90) { PL.onDeck = false; PL.liftT = 2; me.vel.y = 0; if (sp < 36) showMsg('Velocità insufficiente!', 2); else spawnWingmen(); }
}
function enterPlane(o = {}) {
  if (!PGEO.ready) return;
  const jetT = PLANE_SPECS[PLAYER_PLANES.includes(SETTINGS.plane) ? SETTINGS.plane : 'p47'].jet;
  const deck = !o.pos && SCEN === 'air' && PL.spawnCarrier !== false && !(jetT && CARRIER.type !== 'field');
  const sp = o.pos ? { pos: o.pos, vel: o.vel } : deck ? { pos: new V3(CARRIER.x, CARRIER.deckY + 2.3, CARRIER.z + CARRIER.len / 2 - 36), vel: new V3(0, 0, -.01) } : SCEN === 'air' && MISSION.stage >= 0 ? airSpawn() : { pos: new V3(rnd(-80, 40), 380, 1100), vel: new V3(0, -5, -120) };
  PL.type = o.type && PLANE_SPECS[o.type] ? o.type : PLAYER_PLANES.includes(SETTINGS.plane) ? SETTINGS.plane : 'p47'; PL.spec = PLANE_SPECS[PL.type]; PL.torpedo = false;
  const me = new Plane(PL.type, 'A', sp.pos, sp.vel, []); me.player = true; me.hpMax = PL.spec.hp; me.hp = me.hpMax;
  me.parts = { eng: 1, wl: 1, wr: 1, tail: 1 }; me.damage = (a, byPlayer) => playerPlaneHit(me, a, byPlayer);
  buildGear(me);
  PL.onDeck = deck; PL.atBase = true; PL.deckV = 0; PL.deckYaw = 0; PL.gearUp = !deck; PL.gearK = deck ? 1 : 0;
  if (deck) { me.q.setFromEuler(new THREE.Euler(.19, 0, 0, 'YXZ')); me.vel.set(0, 0, 0); }
  if (o.q) me.q.copy(o.q);
  PL.me = me; PL.throttle = .85; PL.stickX = PL.stickY = PL.rudder = 0; PL.bombs = PL.spec.bombs; PL.rearm = 0; PL.av = new V3();
  if (!PL.cockpit || PL.cockpitType !== PL.type) { if (PL.cockpit && PL.cockpit.parent) PL.cockpit.parent.remove(PL.cockpit); buildCockpit(PL.type); }
  me.g.add(PL.cockpit); PL.cockpit.visible = true; if (me.g.userData.pilot) me.g.userData.pilot.visible = false;
  P.mode = 'plane'; P.dead = false;
  scene.fog.density = SCEN === 'sea' ? FOG_BASE * FOG_K : FOG_BASE * .3;   // in mare la visibilità è quella del meteo (decine di km)
  if (!PL.onDeck) spawnWingmen();
  PL.head = null; if (PL.assist === undefined) PL.assist = true; PL.ext = PL.assist; resetPlaneAim();
  if (PL.cockpit) PL.cockpit.visible = !PL.ext; if (me.g.userData.pilot) me.g.userData.pilot.visible = PL.ext; if (me.g.userData.glass) me.g.userData.glass.visible = PL.ext;
  if (PL.onDeck) { PL.throttle = 0; after(.1, () => showMsg((CARRIER.type === 'field' ? 'In testata pista' : 'Sul ponte della portaerei') + ': W per dare motore, a 150 km/h tira su · G carrello', 6)); }
  showMsg(PL.spec.name + ' — mouse: direzione · click sx: fuoco · T: aggancia e segui il cerchio d’anticipo · rotella: manetta', 4);
  say(N.radio, 'Qui Thunderbolt Leader: attaccate le posizioni sulla scogliera. Attenti alla contraerea.');
}
// mirino della visuale esterna: dove arrivano le raffiche (terreno lungo l'asse o punto di convergenza a 320 m)
function planeAimMarker(me) {
  let el = $('mouseAim');
  if (!el) { el = document.createElement('div'); el.id = 'mouseAim'; el.style.cssText = 'position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;pointer-events:none;z-index:18;color:#e8e2cf;font:700 18px/16px sans-serif;text-align:center;text-shadow:0 0 3px #000'; el.textContent = '+'; document.body.appendChild(el); }
  if (!PL.assist || !me || me.crash) { el.style.display = 'none'; return; }
  const p = _a2.copy(camera.position).addScaledVector(planeAimDir(), 400); camera.updateMatrixWorld(); p.project(camera);
  if (p.z > 1) { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.style.left = ((p.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-p.y * .5 + .5) * innerHeight) + 'px';
}
function planeReticle(me) {
  planeAimMarker(me);
  let el = $("planeAim");
  if (!el) { el = document.createElement("div"); el.id = "planeAim"; el.style.cssText = "position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid rgba(255,214,120,.9);border-radius:50%;pointer-events:none;z-index:18;box-shadow:0 0 3px #000"; el.innerHTML = "<div style=\"position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;background:#ffd678;border-radius:50%\"></div>"; document.body.appendChild(el); }
  if (!PL.ext || !me || me.crash) { el.style.display = "none"; return; }
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), t = rayTerrain(me.pos, f, 900), p = _a2.copy(me.pos).addScaledVector(f, t > 0 ? Math.min(t, 900) : 320);
  camera.updateMatrixWorld(); p.project(camera); if (p.z > 1) { el.style.display = "none"; return; }
  el.style.display = "block"; el.style.left = ((p.x * .5 + .5) * innerWidth) + "px"; el.style.top = ((-p.y * .5 + .5) * innerHeight) + "px";
  el.style.borderColor = t > 0 && t < 600 ? "rgba(255,120,90,.95)" : "rgba(255,214,120,.9)";
}
function togglePlaneView() {
  PL.ext = !PL.ext; PL.camP = null;
  if (PL.cockpit) PL.cockpit.visible = !PL.ext;
  const me = PL.me; if (me && me.g.userData.pilot) me.g.userData.pilot.visible = PL.ext;
  if (me && me.g.userData.glass) me.g.userData.glass.visible = PL.ext;
  showMsg(PL.ext ? 'Visuale esterna (V per la cabina)' : 'Visuale in cabina (V per l\'esterno)', 1.5);
}
function togglePlaneAssist() { PL.assist = !PL.assist; resetPlaneAim(); showMsg(PL.assist ? 'Comandi assistiti: il mouse indica la direzione' : 'Comandi manuali: il mouse è la cloche', 2); }
function resetPlaneAim() { const me = PL.me; if (!me) return; PL.camD = null; const f = _a1.set(0, 0, -1).applyQuaternion(me.q); PL.aimYaw = Math.atan2(-f.x, -f.z); PL.aimPitch = Math.asin(clamp(f.y, -1, 1)); PL.camP = null; }
function swapPlane(type) {
  if (type === SETTINGS.plane) return; SETTINGS.plane = type;
  if (!PLAYER_PLANES.includes(type)) { showMsg('Userai l’aereo previsto dalla missione', 3); return; }
  const nm = PLANE_SPECS[type].name;
  if (P.mode === 'plane' && PL.me && !PL.me.crash) {
    const me = PL.me;
    if (PL.onDeck) { exitPlane(); PL.spawnCarrier = true; enterPlane({ type }); }
    else { const pos = me.pos.clone(), vel = me.vel.clone(), q = me.q.clone(); exitPlane(); enterPlane({ type, pos, vel, q }); if (typeof NAIR !== 'undefined' && SCEN === 'sea') PL.torpedo = NA_ROLE[type] === 'torpedo'; }
    showMsg('Ora piloti il ' + nm, 3);
  } else showMsg(nm + ' pronto: lo avrai la prossima volta che sali su un aereo', 4);
}
function exitPlane() {
  AB.lock = null;
  if (PL.me) { if (PL.me.engSmoke) PL.me.engSmoke.life = 0; if (PL.me.engFire) PL.me.engFire.life = 0; } if ($('planeDmg')) $('planeDmg').style.display = 'none';
  PL.ext = false; if ($("planeAim")) $("planeAim").style.display = "none"; if ($('mouseAim')) $('mouseAim').style.display = 'none';
  if (PL.me && PL.wreck) { const w = PL.me; w.alive = false; if (w.eng) w.eng.stop(); const i = PLANES.indexOf(w); if (i >= 0) PLANES.splice(i, 1); if (w.g.userData.pilot) w.g.userData.pilot.visible = false; PL.me = null; }  // il relitto resta dov'è
  else if (PL.me) { PL.me.remove(); PL.me = null; }
  PL.wreck = null;
  if (PL.cockpit && PL.cockpit.parent) PL.cockpit.parent.remove(PL.cockpit);
  scene.fog.density = FOG_BASE * FOG_K;
}
const _pfw = new V3(), _pup = new V3(), _prt = new V3(), _F = new V3(), _vn = new V3(), _aqi = new THREE.Quaternion(), _aimD = new V3();
// direzione del punto di mira dell'istruttore (angoli assoluti mossi dal mouse)
// il punto di mira resta in un cono di ~50° davanti al muso; vicino al suolo o in stallo l'istruttore richiama
function planeAimGuard(me, V) {
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), a = planeAimDir(), c = a.dot(f), lim = Math.cos(1.2);
  if (c < lim) { const ax = _a3.crossVectors(f, a); if (ax.lengthSq() < 1e-8) ax.set(0, 1, 0); ax.normalize(); a.copy(f).applyAxisAngle(ax, 1.2); PL.aimYaw = Math.atan2(-a.x, -a.z); PL.aimPitch = Math.asin(clamp(a.y, -1, 1)); }
  const agl = me.pos.y - Math.max(Hf(me.pos.x, me.pos.z), WATER_Y);
  // si può puntare il terreno: la richiamata interviene solo se l'impatto è imminente
  const sink = -me.vel.y, tti = sink > 1 ? agl / sink : 99;
  if (tti < 2.5 || agl < 18) PL.aimPitch = Math.max(PL.aimPitch, lerp(.3, 0, clamp(tti / 2.5, 0, 1)));
  // anti-stallo solo vicino alla velocità minima (più bassa con gli ipersostentatori)
  if (V < 40) PL.aimPitch = Math.min(PL.aimPitch, Math.asin(clamp(f.y, -1, 1)) - .05);
}
function planeAimDir() { return _aimD.set(-Math.sin(PL.aimYaw) * Math.cos(PL.aimPitch), Math.sin(PL.aimPitch), -Math.cos(PL.aimYaw) * Math.cos(PL.aimPitch)); }
function updatePlane(dt) {
  const me = PL.me; if (!me) return;
  // comandi: il mouse sposta una "cloche" virtuale che torna al centro
  PL.stickX *= Math.exp(-3 * dt); PL.stickY *= Math.exp(-3 * dt);
  if (KEYS.KeyW) PL.throttle = Math.min(1, PL.throttle + dt * (PL.onDeck ? 1.1 : .4));
  if (KEYS.KeyS) PL.throttle = Math.max(0, PL.throttle - dt * .4);
  PL.rudder = lerp(PL.rudder, (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0), dt * 6); // A/D: alettoni (rollio)
  if (me.crash) { PL.stickX = PL.stickY = 0; }
  _pfw.set(0, 0, -1).applyQuaternion(me.q); _pup.set(0, 1, 0).applyQuaternion(me.q); _prt.set(1, 0, 0).applyQuaternion(me.q);
  const v = me.vel, V = Math.max(1, v.length()); _vn.copy(v).multiplyScalar(1 / V);
  const SP = PL.spec || PLANE_SPECS.p47, m = SP.mass, S = SP.S;
  // jet moderni: aria che si rarefà con la quota, velocità del suono, muro del suono
  const alt = Math.max(0, me.pos.y), rho = SP.mach ? 1.225 * Math.exp(-alt / 8500) : 1.2, q = .5 * rho * V * V;
  const aSnd = Math.max(295, 340 - alt * .0039), Mach = V / aSnd; PL.mach = Mach; PL.rho = rho;
  const cdM = SP.mach ? (Mach < .85 ? 1 : Mach < 1.05 ? 1 + (Mach - .85) * 8 : Math.max(1.75, 2.6 - (Mach - 1.05) * 1.2)) : 1;
  const alpha = Math.atan2(-v.dot(_pup), v.dot(_pfw)), beta = v.dot(_prt) / V;
  // ipersostentatori abbassati col carrello a bassa velocità: più portanza per decollo e appontaggio
  const flap = V < 75 ? .55 * smooth((75 - V) / 15) : 0;
  let Cl = (.15 + flap + 4.8 * alpha) * (me.wingLost ? .45 : 1); const st = .3;
  if (Math.abs(alpha) > st) Cl = Math.sign(alpha) * (.15 + flap + 4.8 * st) * Math.max(.25, 1 - (Math.abs(alpha) - st) * 3.5);
  let lift = q * S * Cl; if (SP.gLim) lift = clamp(lift, -3 * m * 9.8, SP.gLim * m * 9.8);   // limite strutturale e del pilota
  // aerofreni (X tenuto): si aprono in mezzo secondo e aggiungono resistenza come i freni di picchiata
  PL.abK = lerp(PL.abK || 0, KEYS.KeyX && !PL.onDeck ? 1 : 0, Math.min(1, dt * 4));
  const drag = q * S * (.024 * cdM + .065 * (lift / Math.max(1, q * S)) ** 2 + .012 * (PL.gearK || 0) + .11 * PL.abK);
  const pt = me.parts || { eng: 1, wl: 1, wr: 1, tail: 1 };
  const thrust = me.crash ? 0 : SP.thrustN ? PL.throttle * SP.thrustN * Math.pow(rho / 1.225, .7) * (1 + .35 * Mach) * (.3 + .7 * pt.eng) : PL.throttle * (SP.jet ? 17000 : Math.min(32000, 1.6e6 / Math.max(V, 35))) * planeThrustK(SP, PL.type) * (m / 6000) * (.3 + .7 * pt.eng);
  if (me.engFire && !me.crash) { me.hp -= dt * 14; if (me.hp <= 0) playerPlaneHit(me, 1, false); }
  updateGear(me, dt);
  if (PL.wreck) wreckStep(me, dt); else if (PL.onDeck) carrierRoll(me, dt, thrust, m); else {
  _a1.copy(_pup).addScaledVector(_vn, -_pup.dot(_vn)).normalize();
  _F.set(0, -9.8 * m, 0).addScaledVector(_pfw, thrust).addScaledVector(_vn, -drag).addScaledVector(_a1, lift).addScaledVector(_prt, -beta * q * S * .6);
  v.addScaledVector(_F, dt / m);
  PL.G = lift / (m * 9.8);
  // rotazione: comandi + stabilità aerodinamica
  const auth = clamp(V / 110, .25, 1.3) * SP.agile;
  // A/D ruotano l'aereo sul proprio asse (alettoni); a comandi rilasciati le ali tornano orizzontali
  const bankR = -Math.asin(clamp(_prt.y, -1, 1));
  let sx = PL.stickX, sy = PL.stickY, ty = 0, level = 0;
  if (PL.assist && !me.crash) {
    planeAimGuard(me, V);
    // istruttore: l'aereo si inclina verso il punto di mira del mouse e tira per raggiungerlo
    const L = _a2.copy(planeAimDir()).applyQuaternion(_aqi.copy(me.q).invert());
    const yawE = Math.atan2(L.x, -L.z), pitE = Math.atan2(L.y, Math.max(.25, -L.z)), off = Math.acos(clamp(-L.z, -1, 1));
    // vicino al bersaglio: piccole correzioni con le ali quasi livellate
    const nx = clamp((clamp(yawE * 4.5, -.75, .75) - bankR) * 2.6, -1, 1), ny = clamp((pitE + clamp(alpha, -.1, .25)) * 3.4, -1, 1);  // punta la traiettoria (non il muso) sul mirino: in orizzontale non perde quota
    // lontano: ruota finché il punto di mira è «sopra» il muso, poi tira
    const clock = Math.atan2(L.x, L.y), fx = clamp(clock * 2.2, -1, 1), fy = clamp(off * 2.4, 0, 1) * Math.max(0, Math.cos(clock));
    const w = smooth((off - .12) / .35);
    sx = lerp(nx, fx, w); sy = lerp(ny, fy, w); ty = -clamp(yawE * 3, -.5, .5) * auth * (1 - w * .5);
    if (Math.abs(PL.rudder) > .1) sx = PL.rudder;
  } else {
    sx = clamp(PL.stickX + PL.rudder, -1, 1);
    level = Math.abs(sx) < .1 && !me.crash ? bankR * 2 * auth : 0;
  }
  let tp = sy * 1.0 * auth * (.45 + .55 * pt.tail), tr = -sx * 1.9 * auth + level;
  // l'ala colpita porta meno: l'aereo tende a rollare da quel lato
  tr += (pt.wr - pt.wl) * .9 * auth;
  // ala persa: avvitamento verso il lato mancante
  if (me.wingLost) { tr += me.wingLost * 3.2; tp -= .4; }
  // subito dopo il decollo il muso sale da solo verso ~8° per allontanarsi dal ponte
  if (PL.liftT > 0 && !me.crash) { const pch = Math.asin(clamp(_pfw.y, -1, 1)); tp += clamp((.14 - pch) * 3, -.3, .6); tr += bankR * 2 * auth; }
  PL.av.x = lerp(PL.av.x, tp - alpha * 1.8 * auth, dt * 3); PL.av.z = lerp(PL.av.z, tr, dt * 5.5); PL.av.y = lerp(PL.av.y, ty - beta * 1.2 * auth, dt * 3);
  _aq.setFromEuler(new THREE.Euler(PL.av.x * dt, PL.av.y * dt, PL.av.z * dt, 'YXZ')); me.q.multiply(_aq).normalize();
  me.pos.addScaledVector(v, dt);
  }
  me.g.updateMatrixWorld();
  for (const p of me.props) p.rotation.z += dt * 60 * PL.throttle;
  // armi
  PL.gunT -= dt; PL.gunT2 = (PL.gunT2 || 0) - dt;
  // seconda batteria (es. mitragliatrici del Mosquito accanto ai cannoni) con la sua cadenza
  const G2 = (PL.spec || {}).guns2; if (G2 && mouseL && PL.gunT2 <= 0 && !me.crash) { PL.gunT2 = G2.int; playerPlaneGuns(me, G2); }
  if (mouseL && PL.gunT <= 0 && !me.crash) {
    PL.gunT = (PL.spec || PLANE_SPECS.p47).guns.int; me.fireT = 0;
    playerPlaneGuns(me);
  }
  PL.rearm -= dt; { const full = PL.torpedo ? 1 : PL.spec.bombs; if (PL.bombs < full && PL.rearm <= 0) { PL.bombs = full; feed(PL.torpedo ? 'Siluro riarmato' : 'Bombe riarmate'); } if (PL.torpedo && PL.bombs > 1) PL.bombs = 1; }
  // contraerea e collisione
  if (me.exploded) { showMsg('Il tuo aereo è esploso in volo!', 3); exitPlane(); P.mode = 'foot'; P.die(); return; }
  const dkY = landSurfY(me.pos.x, me.pos.z), gy = Math.max(Hf(me.pos.x, me.pos.z), me.pos.z > -9 || SCEN === 'sea' ? WATER_Y : -99, dkY);
  PL.liftT = Math.max(0, (PL.liftT || 0) - dt);
  // ruote a contatto col ponte (carrello giù, assetto e discesa ragionevoli): niente schianto, l'aereo rulla
  if (!PL.wreck && !PL.onDeck && dkY > -99 && me.pos.y < dkY + (PL.gearH || 2.25) && me.pos.y > dkY - 1 && PL.gearK > .9 && !me.crash && -v.y < 6) { me.pos.y = dkY + (PL.gearH || 2.25); if (v.y < 0) v.y = 0; }
  if (!PL.wreck && !PL.onDeck && PL.liftT <= 0 && v.y <= .5 && (PL.throttle < .6 || V < 30) && dkY > -99 && me.pos.y < dkY + (PL.gearH || 2.25) + .05 && me.pos.y > dkY - 1) {
    const f = _a1.set(0, 0, -1).applyQuaternion(me.q), r = _a2.set(1, 0, 0).applyQuaternion(me.q), pitch = Math.asin(clamp(f.y, -1, 1));
    if (!me.crash && PL.gearK > .9 && -v.y < 6 && Math.abs(r.y) < .2 && pitch > -.1 && pitch < .35 && V < 80) {
      PL.onDeck = true; PL.deckV = Math.hypot(v.x, v.z); PL.deckYaw = Math.atan2(-f.x, -f.z); PL.throttle = 0; PL.landed = true; PL.atBase = carrierDeckAt(me.pos.x, me.pos.z) > -99; PL.arrest = PL.atBase && CARRIER.type !== 'field' && me.pos.z > CARRIER.z + CARRIER.len * .15; if (PL.arrest) { P.shake += .8; play('imp_metal', null, { vol: .9, rate: .6 }); }
      if (!PL.atBase) showMsg('Atterrato in campo aperto · frena con S · per riparare e riarmare atterra alla base', 3.5);
      else { showMsg(CARRIER.type === 'field' ? 'Atterraggio riuscito! Frena con S' : PL.arrest ? 'Appontaggio riuscito! Cavo agganciato' : 'Appontaggio lungo: frena con S!', 2.5); addScore(300, 'Appontaggio', '#9fe08a'); me.hp = Math.min(me.hpMax, me.hp + 300); for (const k in me.parts) me.parts[k] = Math.max(me.parts[k], .8); PL.bombs = PL.spec.bombs; }
    }
  }
  // contatto col suolo fuori dall'atterraggio: niente morte istantanea, l'aereo si schianta con la sua fisica
  if (!PL.wreck && !PL.onDeck && me.pos.y < gy + (dkY > -99 && PL.gearK > .9 && !me.crash ? .5 : 1.5)) startWreck(me, gy);
  if (me.crash && !PL.wreck && !PL.crashMsg) { PL.crashMsg = true; showMsg((me.wingLost ? 'Hai perso un\'ala! ' : 'Colpito! ') + 'Premi R per rientrare subito', 4); }
  const LIM = SCEN === 'air' ? 11500 : SCEN === 'sea' ? 30000 : 2400; if (Math.abs(me.pos.x) > LIM || Math.abs(me.pos.z) > LIM || me.pos.y > (PL.spec && PL.spec.mach ? 15500 : 4000)) { const back = _a2.set(-me.pos.x, 300 - me.pos.y, -me.pos.z).normalize(); v.lerp(back.multiplyScalar(V), dt * .3); }
  // testa del pilota: si inclina con un ritardo verso le virate, viene schiacciata dalle G e oscilla con le raffiche
  const hr = PL.head || (PL.head = { r: 0, p: 0, y: 0, dy: 0 }), k = Math.min(1, dt * 3);
  hr.r = lerp(hr.r, clamp(-PL.av.z * .09, -.22, .22), k); hr.p = lerp(hr.p, clamp(-PL.av.x * .05 - (PL.G - 1) * .012, -.12, .1), k);
  hr.y = lerp(hr.y, clamp(-PL.av.y * .12, -.1, .1), k); hr.dy = lerp(hr.dy, clamp(-(PL.G - 1) * .018, -.09, .03), k);
  const shake = (PL.gunT > -.05 ? .002 : 0) + Math.min(.004, V * .00002), hitS = Math.min(P.shake, .6) * .004;
  if (!PL.free) { const k = Math.exp(-dt * 5); P.lookYaw = (P.lookYaw || 0) * k; P.lookPitch = (P.lookPitch || 0) * k; }
  if (PL.wreck) wreckCam(me, dt);
  else if (PL.ext) {
    // visuale esterna: inseguimento morbido dietro e sopra l'aereo
    if (PL.assist) {
      const fw = _a1.set(0, 0, -1).applyQuaternion(me.q).lerp(planeAimDir(), .55).normalize();
      PL.camD = PL.camD || fw.clone(); PL.camD.lerp(fw, Math.min(1, dt * 3.5)).normalize();
      // visuale libera (tasto destro): la telecamera gira attorno all'aereo senza toccare la mira
      const ly = P.lookYaw || 0, lp = P.lookPitch || 0, fl = Math.min(1, (Math.abs(ly) + Math.abs(lp)) * 3);
      const ad = _a4.copy(PL.camD).applyAxisAngle(_a1.set(0, 1, 0), ly); if (lp) { const rt = _a1.set(0, 1, 0).cross(ad).normalize(); ad.applyAxisAngle(rt, -lp); }
      const want = _a3.copy(me.pos).addScaledVector(ad, -15); want.y += 3.2;
      want.y = Math.max(want.y, Hf(want.x, want.z) + 2);
      PL.camP = PL.camP || want.clone(); PL.camP.lerp(want, Math.min(1, dt * (fl > 0 ? 14 : 9)));
      camera.position.copy(PL.camP);
      _am.lookAt(camera.position, _a2.copy(me.pos).addScaledVector(ad, 200 * (1 - fl)), _a1.set(0, 1, 0));
      camera.quaternion.setFromRotationMatrix(_am);
    } else {
      const back = _a2.set(0, 2.6, 11).applyQuaternion(me.q), want = _a3.copy(me.pos).add(back);
      want.y = Math.max(want.y, Hf(want.x, want.z) + 2);
      PL.camP = PL.camP || want.clone(); PL.camP.lerp(want, Math.min(1, dt * 6));
      camera.position.copy(PL.camP);
      _am.lookAt(camera.position, _a2.copy(me.pos).addScaledVector(_pfw, 20), _a1.copy(_pup).lerp(new V3(0, 1, 0), .5));
      camera.quaternion.setFromRotationMatrix(_am);
      camera.rotateY(P.lookYaw || 0); camera.rotateX(P.lookPitch || 0);
    }
  } else {
    const ey = (PL.spec && PL.spec.eye) || [0, 1.12, -.5], head = me.g.localToWorld(_a3.set(ey[0], ey[1] + hr.dy, ey[2]));
    camera.position.copy(head);
    camera.quaternion.copy(me.q);
    camera.rotateY((P.lookYaw || 0) + hr.y); camera.rotateX((P.lookPitch || 0) + hr.p); camera.rotateZ(hr.r);
  }
  camera.rotateX(rnd(-shake, shake) + Math.sin(GAME.time * 19) * hitS); camera.rotateY(rnd(-shake, shake) + Math.sin(GAME.time * 15 + 1.3) * hitS * .7);
  planeReticle(me); planeDamageHud(me);
  const fa = SETTINGS.fovAir || 88, fov = (PL.ext ? Math.max(55, fa - 18) : fa) * (P.adsHeld ? .45 : 1); if (Math.abs(camera.fov - fov) > .05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 9)); camera.updateProjectionMatrix(); }
  if (PL.eng !== me.eng) PL.eng = me.eng;
  me.eng && me.eng.set(.75 * (.4 + PL.throttle * .6), 0, .75 + PL.throttle * .5);
  P.supp = Math.max(P.supp, clamp((PL.G - 5) / 3, 0, .9));
  PL.gT -= dt; if (PL.gT <= 0) { PL.gT = .07; drawGauges(); } updateCockpit(dt);
  P.pos.copy(me.pos);
}
const _vbA = new V3(), _vbB = new V3();
function playerPlaneGuns(me, G = (PL.spec || PLANE_SPECS.p47).guns) {
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), r = _a2.set(1, 0, 0).applyQuaternion(me.q), heavy = G.cal >= 30;
  if (!G.rotary || (PL.rotN = (PL.rotN || 0) + 1) % 3 === 0) sfxShot(G.snd, null, true, 0, 'aircraft.' + PL.type + '.guns_fire'); if (heavy) play('boom', null, { vol: .25, rate: 2.2 }); P.shake = Math.min(.8, P.shake + (heavy ? .25 : .05));
  // armi leggere: due fasci (ala sinistra e destra) col danno di tutte le armi; cannoni pesanti: un colpo per arma
  const pts = heavy ? G.pos : [-1, 1].map(s => { const l = G.pos.filter(p => Math.sign(p[0] || s) === s); const n = l.length || 1; return [l.reduce((a, p) => a + p[0], 0) / n, l.reduce((a, p) => a + p[1], 0) / n, l.reduce((a, p) => a + p[2], 0) / n, n]; });
  for (const gp of pts) {
    const dmg = heavy ? G.dmg : G.dmg * (gp[3] || 1) / 4;
    const o = me.g.localToWorld(new V3(gp[0], gp[1], gp[2])).addScaledVector(f, .5);
    // proiettile vero: parte dalla bocca dell'arma con la velocità dell'aereo più quella iniziale del calibro
    // armonizzazione: le armi alari convergono sul mirino a ~300 m e sono alzate quanto basta a compensare la caduta del proiettile
    const conv = G.conv || 300, mv = muzzleV(G.cal), up = _a3.set(0, 1, 0).applyQuaternion(me.q);
    const aim = me.pos.clone().addScaledVector(f, conv).addScaledVector(up, 9.8 * conv * conv / (2 * mv * mv));
    const sd = G.spread, d = aim.sub(o).normalize().add(new V3(rnd(-sd, sd), rnd(-sd, sd), rnd(-sd, sd))).normalize();
    fireAirBullet(o, d, me.vel, G, dmg, true);
  }
}
// impatto di un proiettile del giocatore (aereo, mezzo, terreno o acqua)
function airBulletImpact(o, d, t, hitPlane, hitVeh, water, G, dmg) {
  const heavy = G.cal >= 30;
    const end = o.clone().addScaledVector(d, t);
    // proiettili esplosivi: piccolo scoppio all'impatto
    if (G.he && t > 0) { fxExplosion(end.clone(), G.he * .35, false); if (dist2Cam(end) < 300 * 300) sfxBoom(end, G.he * .3); }
    if (hitPlane) { hitPlane.damage(dmg * (G.he ? 1.2 : 1), true); fxImpact(end, 'metal'); hitMarker(false, false); return; }
    if (hitVeh) { hitVeh.damage(hitVeh.tank ? (G.cal >= 37 ? dmg * .9 : G.cal >= 20 ? dmg * .12 : dmg * .25) : dmg * .9, true); fxImpact(end, 'metal'); if (R() < .3) sfxImpact(end, 'metal'); hitMarker(false, false); return; }
    if (G.he) { explode(end, G.he, dmg * 1.4, { byPlayer: true }); if (SCEN === 'air' && G.cal >= 30) airBombHit(end, G.cal >= 37 ? .25 : .12); }
    fxImpact(end, water ? 'water' : end.z > -58 ? 'sand' : 'dirt');
    for (const s of enemies) if (s.alive && !s.inBunker && Math.abs(s.pos.x - end.x) < 1.5 && Math.abs(s.pos.z - end.z) < 1.5) s.damage(rnd(70, 130), o, true, 'body', { dir: d.clone(), power: 3.5, joint: 15 });
    for (const a of WORLD.aaSites) if (!a.dead && a.mesh && a.mesh.position.distanceTo(end) < 3.5 && R() < .3) { a.dead = true; burnMeshes(a.mesh); feed('Postazione contraerea distrutta'); }
}
function planeDropBomb() {
  const me = PL.me; if (!me || PL.bombs <= 0 || me.crash) return;
  if (SCEN === 'sea' && PL.torpedo && navyPlayerTorpedo()) return;
  PL.bombs--; if (PL.rearm <= 0) PL.rearm = 40;
  const m = new THREE.Mesh(BOMB_G(), MAT.paint), r = _a2.set(1, 0, 0).applyQuaternion(me.q);
  m.position.copy(me.pos).add(new V3(0, -1.2, 0)).addScaledVector(r, PL.bombs ? -1.2 : 1.2); scene.add(m);
  projectiles.push({ type: 'bomb', p: m.position, v: me.vel.clone(), life: 40, m, byPlayer: true, team: 'A' });
  play('mag_out', null, { vol: .8, rate: .5 }); feed('Bomba sganciata');
}

// ---------- schianto fisico ----------
// gravità dell'urto: 0 = strisciata sulla pancia, oltre 1 = impatto violento (il pilota non sopravvive)
function startWreck(me, gy) {
  const v = me.vel, V = v.length(), vy = Math.max(0, -v.y);
  const water = Hf(me.pos.x, me.pos.z) < WATER_Y && gy <= WATER_Y + .05;
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), nose = Math.max(0, -f.y);
  const sev = clamp((vy - 5) / 22 + Math.max(0, V - 45) / 110 + nose * .8, 0, 1.6) * (water ? .7 : 1);
  PL.wreck = { t: 0, rest: 0, sev, water, sink: 0, lethal: sev > 1.05, av: new V3(rnd(-1, 1) * sev * 2.5 + nose * 2, rnd(-1, 1) * sev * 1.5, rnd(-1, 1) * sev * 4) };
  me.crash = true; PL.throttle = 0; PL.onDeck = false; AB.lock = null;
  if (me.gear) me.gear.g.visible = false;  // il carrello cede
  for (const p of me.props) p.rotation.x = rnd(-.4, .4);  // eliche piegate
  me.pos.y = gy + 1;
  v.y = vy * (water ? .1 : .3); v.multiplyScalar(water ? .55 : .8 - Math.min(.35, sev * .25));
  P.shake += .8 + sev; play('imp_metal', null, { vol: 1, rate: .45 }); sfxBoom(me.pos, 1 + sev * 2.5, water); if (water && typeof waterDrop === 'function') waterDrop(me.pos.x, me.pos.z, 9, -2.5, 1);
  if (water) { for (let i = 0; i < 25; i++) PS_SMOKE.emit(me.pos.x + rnd(-3, 3), WATER_Y, me.pos.z + rnd(-3, 3), rnd(-3, 3), rnd(4, 10), rnd(-3, 3), rnd(1, 2), .8, 3, .55, .85, .9, .95, .2, 0); }
  else fxDebris(me.pos, 12 + Math.round(sev * 20), 1 + sev);
  // impatto forte: si staccano pezzi, il motore prende fuoco
  if (sev > .55) { for (let k = 0; k < 4; k++) airDebris(me.pos.clone(), v.clone().multiplyScalar(.5).add(new V3(rnd(-12, 12), rnd(4, 14), rnd(-12, 12))), rnd(.5, 1.6), 0x3c4130, R() < .5); }
  if (sev > .8 && !water && !me.engFire) { me.engFire = addEmitter(me.pos, 'fire', .6); me.engFire.follow = q => q.copy(me.pos); me.engFire.life = 1e9; }
  if (sev > 1.2 && !water) fxExplosion(me.pos.clone(), 1.6, false);
  if (!me.engSmoke) { me.engSmoke = addEmitter(me.pos, 'trail', .6); me.engSmoke.follow = q => q.copy(me.pos); me.engSmoke.life = 1e9; }
  if (PL.cockpit) PL.cockpit.visible = false; if (me.g.userData.pilot) me.g.userData.pilot.visible = true; if (me.g.userData.glass) me.g.userData.glass.visible = true;
  PL.camP = null;
  showMsg(water ? 'Ammaraggio!' : sev > 1 ? 'Schianto!' : 'Atterraggio di fortuna!', 2.5);
}
const _wkq = new THREE.Quaternion(), _wke = new THREE.Euler();
function wreckStep(me, dt) {
  const W = PL.wreck, v = me.vel; W.t += dt;
  v.y -= 9.8 * dt; me.pos.addScaledVector(v, dt);
  const gy = W.water ? WATER_Y : Hf(me.pos.x, me.pos.z), clear = (W.water ? .4 : .9) - W.sink;
  const onG = me.pos.y <= gy + clear + .05;
  if (me.pos.y < gy + clear) {
    me.pos.y = gy + clear;
    if (v.y < -3) {  // rimbalzo: perde energia e prende a girare
      const imp = -v.y; v.y = imp * (W.water ? .08 : .28);
      W.av.x += rnd(-1, 1) * imp * .07; W.av.z += rnd(-1, 1) * imp * .1; W.av.y += rnd(-1, 1) * imp * .04;
      P.shake += Math.min(1, imp * .05); play('imp_metal', null, { vol: Math.min(1, imp / 15), rate: .5 + R() * .2 });
      if (!W.water) fxDebris(me.pos, 6, .8 + imp * .03);
    } else if (v.y < 0) v.y = 0;
    // strisciamento: attrito molto più forte nell'acqua; la terra frena e solleva polvere
    const sp = Math.hypot(v.x, v.z), fr = W.water ? 1.8 : .9 + (sp < 15 ? 1.2 : 0);
    v.x *= Math.exp(-fr * dt); v.z *= Math.exp(-fr * dt);
    W.av.multiplyScalar(Math.exp(-2.2 * dt));
    if (sp > 4 && R() < .6) { if (W.water) PS_SMOKE.emit(me.pos.x, WATER_Y, me.pos.z, rnd(-2, 2), rnd(2, 5), rnd(-2, 2), rnd(.8, 1.5), .6, 2.5, .5, .85, .9, .95, .2, 0); else PS_SMOKE.emit(me.pos.x, gy + .3, me.pos.z, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), rnd(2, 4), 1, 5, .45, .55, .48, .38, .1, 0); }
    // quasi fermo: si adagia sul ventre (o sul dorso se è capovolto)
    if (sp < 6) {
      _wke.setFromQuaternion(me.q, 'YXZ'); const up = _a2.set(0, 1, 0).applyQuaternion(me.q).y;
      _wkq.setFromEuler(new THREE.Euler(.04, _wke.y, up < 0 ? PI : 0, 'YXZ'));
      me.q.slerp(_wkq, Math.min(1, dt * 2.5)); W.av.multiplyScalar(Math.exp(-4 * dt));
    }
    if (W.water && sp < 3) W.sink = Math.min(3.5, W.sink + dt * .25);  // in acqua il relitto affonda piano
  }
  _aq.setFromEuler(new THREE.Euler(W.av.x * dt, W.av.y * dt, W.av.z * dt, 'YXZ')); me.q.multiply(_aq).normalize();
  // fermo da un paio di secondi: esito per il pilota
  if (onG && v.length() < 1.2) W.rest += dt; else W.rest = 0;
  if ((W.rest > 2 || W.t > 14) && !W.done) {
    W.done = true;
    if (W.lethal) { showMsg('Il pilota non è sopravvissuto all’impatto', 3); after(2.5, () => { if (PL.wreck === W) { exitPlane(); P.mode = 'foot'; P.die(); } }); }
    else showMsg(W.water ? 'Sei riuscito a uscire dall’abitacolo! R per rientrare' : 'Sei vivo, l’aereo è un rottame · R per rientrare', 6);
  }
}
// visuale sul relitto: la camera gira piano attorno all'aereo e lo segue nella scivolata
function wreckCam(me, dt) {
  const W = PL.wreck;
  if (W.a0 === undefined) W.a0 = Math.atan2(me.vel.x, me.vel.z) + PI * .75;
  const a = W.t * .25 + W.a0, d = 24 - Math.min(8, W.t * 1.5);
  const want = _a3.set(me.pos.x + Math.sin(a) * d, me.pos.y + 7, me.pos.z + Math.cos(a) * d);
  want.y = Math.max(want.y, Hf(want.x, want.z) + 2.5, WATER_Y + 2);
  PL.camP = PL.camP || want.clone(); PL.camP.lerp(want, Math.min(1, dt * 4));
  camera.position.copy(PL.camP); camera.lookAt(me.pos);
}
