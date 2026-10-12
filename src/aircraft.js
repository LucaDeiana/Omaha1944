"use strict";
// ============================================================
//  Aerei: P-47 (alleati), Fw 190 (tedeschi), B-26; contraerea;
//  modalità pilota in prima persona con modello di volo fisico
// ============================================================
const PLANES = [];
const PL = { me: null, stickX: 0, stickY: 0, rudder: 0, throttle: .85, gunT: 0, bombs: 2, rearm: 0, cockpit: null, gauges: null, gT: 0, G: 1, firing: false };
const PGEO = {};
const _a1 = new V3(), _a2 = new V3(), _a3 = new V3(), _aq = new THREE.Quaternion(), _am = new THREE.Matrix4();

function lathe(pts, seg) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[1], p[0])), seg); g.rotateX(PI / 2); return g; }
function planform(pts, thick) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * .3, bevelSize: thick * .3, bevelSegments: 1 }); g.translate(0, 0, -thick / 2); g.rotateX(-PI / 2); return g; }
function finG(pts, thick) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]); const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); g.translate(0, 0, -thick / 2); g.rotateY(-PI / 2); return g; }
function buildPlaneGeos() {
  // P-47 Thunderbolt
  let mb = new MB(); mb.mat = 'paint';
  const od = 0x6a7050, gr = 0x9aa0a0, w = 0xe6e3da, b = 0x151515;
  mb.add(lathe([[-5.6, 0], [-5.55, .6], [-5.3, .8], [-4.6, .86], [-3, .86], [-1, .8], [1, .64], [3, .46], [5, .24], [5.7, .08]], 18), od, 0, 0, 0);
  mb.add(planform([[-6.2, -.3], [-6, .6], [-3, 1.25], [0, 1.45], [3, 1.25], [6, .6], [6.2, -.3], [3, -1.05], [0, -1.25], [-3, -1.05]], .22), od, 0, -.35, -.8);
  mb.add(planform([[-2.4, -.2], [-2.3, .4], [0, .7], [2.3, .4], [2.4, -.2], [0, -.5]], .12), od, 0, .1, 4.9);
  mb.add(finG([[3.9, 0], [5.6, .1], [5.8, 1.9], [5.1, 2.1], [4.5, .5]], .1), od, 0, .2, 0);
  for (let i = 0; i < 5; i++) { const c = i % 2 ? b : w; for (const sx of [-1, 1]) mb.add(U.box, c, sx * (3.3 + i * .32), -.2, -.8, 0, 0, 0, .32, .26, 2.4); mb.add(new THREE.CylinderGeometry(.56 - i * .04, .58 - i * .04, .3, 18, 1, true), c, 0, 0, 2.4 + i * .3, PI / 2, 0, 0); }
  mb.mat = 'vc';
  mb.add(U.sph, 0x1d2a33, 0, .78, -.9, 0, 0, 0, .42, .38, 1.1);
  mb.add(new THREE.CylinderGeometry(.84, .84, .5, 20, 1, true), 0x2b2b2b, 0, 0, -5.35, PI / 2, 0, 0);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) mb.add(U.cyl, 0x222222, sx * (2.3 + k * .3), -.32, -2.3, PI / 2, 0, 0, .03, .7, .03);
  PGEO.p47 = mb.buildGroups();
  // Fw 190
  mb = new MB(); mb.mat = 'paint';
  const fg = 0x6f756c, fy = 0xc9a43a;
  mb.add(lathe([[-4.4, 0], [-4.35, .55], [-4.1, .72], [-3.5, .74], [-2, .7], [0, .6], [2, .42], [3.8, .22], [4.4, .06]], 18), fg, 0, 0, 0);
  mb.add(planform([[-5.2, -.3], [-5, .5], [0, 1.25], [5, .5], [5.2, -.3], [0, -1.1]], .2), fg, 0, -.3, -.6);
  mb.add(planform([[-1.8, -.2], [-1.7, .35], [0, .6], [1.7, .35], [1.8, -.2], [0, -.4]], .1), fg, 0, .1, 3.8);
  mb.add(finG([[3, 0], [4.4, .1], [4.5, 1.5], [3.9, 1.6], [3.4, .4]], .1), fg, 0, .15, 0);
  mb.add(new THREE.CylinderGeometry(.74, .74, .45, 20, 1, true), fy, 0, 0, -4.15, PI / 2, 0, 0);
  for (const sx of [-1, 1]) { mb.add(U.box, 0x111111, sx * 3.2, -.18, -.6, 0, 0, 0, 1, .22, .14); mb.add(U.box, 0xeeeeee, sx * 3.2, -.17, -.6, 0, 0, 0, .14, .23, 1); }
  mb.mat = 'vc'; mb.add(U.sph, 0x1d2a33, 0, .62, -.6, 0, 0, 0, .36, .32, .95);
  PGEO.fw190 = mb.buildGroups();
  // B-26 Marauder
  mb = new MB(); mb.mat = 'paint';
  mb.add(lathe([[-8.5, 0], [-8.3, .7], [-7.5, 1.05], [-5, 1.1], [3, 1.05], [6, .7], [8.5, .25], [9, .05]], 18), od, 0, 0, 0);
  mb.add(planform([[-9.8, -.4], [-9.6, .7], [0, 1.6], [9.6, .7], [9.8, -.4], [0, -1.6]], .3), od, 0, .3, -1);
  mb.add(planform([[-3.6, -.2], [-3.5, .5], [0, .9], [3.5, .5], [3.6, -.2], [0, -.6]], .14), od, 0, 1.6, 7.4);
  mb.add(finG([[5.6, 0], [8.6, .2], [8.9, 3.8], [7.6, 4], [6.6, .8]], .14), od, 0, .4, 0);
  for (const sx of [-1, 1]) { mb.add(lathe([[-2.6, 0], [-2.5, .55], [-1.8, .75], [1, .7], [3, .3]], 14), od, sx * 3.4, .1, -1.2); for (let i = 0; i < 5; i++) mb.add(U.box, i % 2 ? b : w, sx * 3.4, -.25 - 0 * i, -1.6 + i * .35, 0, 0, 0, 1.2, .5, .32); }
  mb.mat = 'vc'; mb.add(U.sph, 0x1d2a33, 0, .9, -6.2, 0, 0, 0, .7, .45, 1.2); mb.add(U.sph, 0x1d2a33, 0, 0, -8.4, 0, 0, 0, .65, .65, .5);
  PGEO.b26 = mb.buildGroups();
  // elica
  mb = new MB(); mb.mat = 'paint';
  mb.add(new THREE.ConeGeometry(.32, .7, 14), 0x333333, 0, 0, -.25, -PI / 2, 0, 0);
  for (let k = 0; k < 4; k++) mb.add(U.box, 0x1a1a1a, 0, 0, 0, 0, 0, k * PI / 2, .22, 1.9, .05).add(U.box, 0xd8c040, 0, 0, 0, 0, 0, k * PI / 2, .23, .12, .055);
  PGEO.prop = mb.buildGroups();
}

class Plane {
  constructor(type, team, pos, vel, path) {
    this.type = type; this.team = team; this.g = groupMesh(PGEO[type]);
    this.props = [];
    const props = type === 'b26' ? [[-3.4, .1, -3.9], [3.4, .1, -3.9]] : [[0, 0, type === 'fw190' ? -4.5 : -5.75]];
    for (const p of props) {
      const pr = groupMesh(PGEO.prop, false); pr.position.set(...p); this.g.add(pr); this.props.push(pr);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide })); disc.position.set(p[0], p[1], p[2] - .05); this.g.add(disc);
    }
    this.pos = this.g.position; this.pos.copy(pos); this.vel = vel.clone(); this.q = this.g.quaternion;
    this.hp = type === 'b26' ? 900 : 350; this.alive = true; this.path = path || []; this.pi = 0; this.fireT = 0; this.bombs = type === 'b26' ? 6 : 2; this.bombT = 0;
    this.crash = false; this.age = 0; this.roll = 0;
    this.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.g); PLANES.push(this);
    this.eng = loopSound(type === 'fw190' ? 'eng_fw' : type === 'b26' ? 'eng_bomber' : 'eng_p47', 0);
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
      if (byPlayer) { STATS.kills += 2; feed(this.team === 'E' ? 'Caccia nemico abbattuto!' : 'Aereo abbattuto'); }
      if (this.team === 'E' && dist2Cam(this.pos) < 900 * 900) say(N.walsh, 'L\'hanno preso! Sta precipitando!');
    }
  }
  update(dt) {
    this.age += dt;
    for (const p of this.props) p.rotation.z += dt * 60;
    if (this.crash) {
      this.vel.y -= 9.8 * dt * 1.4; this.vel.multiplyScalar(1 - .1 * dt); this.roll += dt * 2;
      this.pos.addScaledVector(this.vel, dt); this.orient(this.roll);
      const gy = Math.max(Hf(this.pos.x, this.pos.z), this.pos.z > -9 ? WATER_Y : -99);
      if (this.pos.y < gy + 1) { explode(this.pos.clone().setY(gy + .5), 12, 500, {}); this.remove(); }
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
  strafe(dt) {
    this.fireT -= dt; if (this.fireT > 0) return; this.fireT = .06;
    const f = _a1.set(0, 0, -1).applyQuaternion(this.q), right = _a2.set(1, 0, 0).applyQuaternion(this.q);
    if (f.y > -.05) return;
    sfxShot(this.team === 'A' ? 'm2' : 'mg42', this.pos);
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
      if (this.team === 'E' && P.targetable() && P.pos.distanceTo(p) < 1.6) P.damage(rnd(40, 70) * D.dmg, o);
      else if (this.team === 'E' && P.targetable() && P.pos.distanceTo(p) < 6) P.nearMiss(o, p);
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
  for (const b of WORLD.bunkers) if (!b.destroyed && Math.hypot(b.x - p.x, b.z - p.z) < 8) { b.destroy(); onObjectiveEvent('bunker', b, true); }
  for (const f of WORLD.flaks) if (f.alive && Math.hypot(f.x - p.x, f.z - p.z) < 8) { f.destroy(); onObjectiveEvent('flak', f, true); }
}

// ---------- incursioni dell'IA ----------
function raidP47(target) {
  const T = target.clone(), side = rnd(-1, 1) * 200, n = R() < .5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const off = new V3(i * 25 - 12, i * 10, i * 40);
    const start = new V3(T.x + side + off.x, 380 + off.y, 1300 + off.z);
    const tp = T.clone().add(new V3(rnd(-15, 15), 0, rnd(-15, 15)));
    const path = [
      { p: new V3(tp.x + side * .3, 260, tp.z + 700), v: 150 },
      { p: new V3(tp.x, tp.y + 45, tp.z + 120), v: 170, guns: true, bomb: tp, r: 50 },
      { p: new V3(tp.x, 140, tp.z - 350), v: 160 },
      { p: new V3(tp.x - side, 450, tp.z - 1600), v: 140 },
    ];
    const pl = new Plane('p47', 'A', start, new V3(0, -10, -140), path); pl.pi = 0;
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
    new Plane('fw190', 'E', new V3(xo, 320, -1300 - i * 40), new V3(0, -15, 150), path);
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
    if (R() < (tgt.player ? .05 : .015)) { tgt.damage(rnd(25, 60), false); if (tgt.player) { P.shake += .4; lensSplat('dirt', .2); play('imp_metal', null, { vol: .8 }); } }
  }
  for (const p of PLANES) {
    if (p.team !== 'E' || p.crash || p.pos.z < 150) continue;
    if (R() < .4) { const o = new V3(rnd(-400, 400), 10, rnd(400, 800)); fxTracer(o, p.pos.clone().add(new V3(rnd(-40, 40), rnd(-30, 30), rnd(-40, 40))), 1.2); if (R() < .03) p.damage(rnd(40, 90), false); }
  }
}
let raidT = { p47: 25, fw: 70, b26: 6 };
function updateAircraft(dt) {
  const st = MISSION.stage;
  if (st >= 0 && P.mode !== 'plane') {
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
  updateAA(dt);
}

// ============================================================
//  Modalità pilota: P-47 in prima persona
// ============================================================
function buildCockpit() {
  const g = new THREE.Group();
  const mb = new MB(); mb.mat = 'paint';
  const dk = 0x3a3d33, od = 0x6a7050;
  mb.add(U.box, dk, 0, -.42, -.75, -.25, 0, 0, 1.05, .5, .12);
  mb.add(U.box, 0x2a2c26, 0, -.12, -.85, -.1, 0, 0, .9, .08, .25);
  for (const sx of [-1, 1]) { mb.add(U.box, od, sx * .5, -.35, -.2, 0, 0, 0, .06, .5, 1.6); mb.add(U.box, 0x2a2c26, sx * .47, -.1, -.2, 0, 0, sx * -.4, .04, .05, 1.6); }
  for (const sx of [-1, 1]) mb.add(U.box, 0x222222, sx * .36, .28, -.95, .35, sx * .15, sx * .5, .03, .7, .03);
  mb.add(U.box, 0x222222, 0, .55, -.6, 0, 0, 0, .7, .03, .03); mb.add(U.box, 0x222222, 0, .58, -.2, 0, 0, 0, .9, .03, .03);
  mb.add(U.box, 0x444444, 0, -.7, -.35, 0, 0, 0, .04, .5, .04);
  mb.add(U.box, 0x333333, 0, -.42, -.38, 0, 0, 0, .06, .1, .06);
  mb.add(U.box, od, 0, -.6, -2.5, 0, 0, 0, 1.2, .5, 3);
  g.add(groupMesh(mb.buildGroups(), false));
  // cruscotto con strumenti disegnati su canvas
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, .375), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 }));
  panel.position.set(0, -.33, -.69); panel.rotation.x = -.25; g.add(panel);
  // collimatore a riflessione
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d');
  sg.strokeStyle = 'rgba(255,170,70,1)'; sg.lineWidth = 3; sg.beginPath(); sg.arc(64, 64, 50, 0, TAU); sg.stroke();
  sg.beginPath(); sg.moveTo(64, 20); sg.lineTo(64, 52); sg.moveTo(64, 76); sg.lineTo(64, 108); sg.moveTo(20, 64); sg.lineTo(52, 64); sg.moveTo(76, 64); sg.lineTo(108, 64); sg.stroke();
  sg.fillStyle = 'rgba(255,170,70,1)'; sg.beginPath(); sg.arc(64, 64, 3, 0, TAU); sg.fill();
  const st = new THREE.CanvasTexture(sc);
  const sight = new THREE.Mesh(new THREE.PlaneGeometry(.16, .16), new THREE.MeshBasicMaterial({ map: st, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(2.5, 1.6, .7) }));
  sight.position.set(0, .02, -.82); g.add(sight);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(.18, .14), new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: .15, roughness: .05, metalness: .5 }));
  glass.position.set(0, .02, -.83); g.add(glass);
  const prop = groupMesh(PGEO.prop, false); prop.position.set(0, -.15, -4.6); g.add(prop);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 32), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: .14, depthWrite: false })); disc.position.set(0, -.15, -4.65); g.add(disc);
  const wing = new MB(); wing.mat = 'paint';
  wing.add(planform([[-6.2, -.3], [-6, .6], [-3, 1.25], [0, 1.45], [3, 1.25], [6, .6], [6.2, -.3], [3, -1.05], [0, -1.25], [-3, -1.05]], .22), 0x6a7050, 0, -1.2, -.4);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) wing.add(U.box, i % 2 ? 0x151515 : 0xe6e3da, sx * (3.3 + i * .32), -1.05, -.4, 0, 0, 0, .32, .26, 2.4);
  g.add(groupMesh(wing.buildGroups(), false));
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  PL.cockpit = g; PL.prop = prop; PL.gctx = cv.getContext('2d'); PL.gtex = tex;
}
function drawGauges() {
  const g = PL.gctx, me = PL.me; if (!g || !me) return;
  g.fillStyle = '#1c1d1a'; g.fillRect(0, 0, 512, 192);
  const gauge = (x, y, r, v, max, label, unit) => {
    g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#ddd'; g.lineWidth = 1.5;
    for (let k = 0; k <= 10; k++) { const a = -PI * 1.25 + k / 10 * PI * 1.5; g.beginPath(); g.moveTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); g.lineTo(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .95); g.stroke(); }
    const a = -PI * 1.25 + clamp(v / max, 0, 1) * PI * 1.5;
    g.strokeStyle = '#f2e6c0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); g.stroke();
    g.fillStyle = '#ddd'; g.font = '13px monospace'; g.textAlign = 'center'; g.fillText(label, x, y + r * .45); g.fillText(Math.round(v) + unit, x, y + r * .7);
  };
  const spd = me.vel.length() * 3.6, alt = me.pos.y;
  gauge(70, 96, 62, spd, 800, 'VELOCITÀ', ' km/h'); gauge(200, 96, 62, alt, 1500, 'QUOTA', ' m'); gauge(330, 96, 52, PL.throttle * 100, 100, 'MANETTA', '%');
  // orizzonte artificiale
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), r = _a2.set(1, 0, 0).applyQuaternion(me.q);
  const pitch = Math.asin(clamp(f.y, -1, 1)), roll = Math.atan2(-r.y, _a3.set(0, 1, 0).applyQuaternion(me.q).y);
  g.save(); g.beginPath(); g.arc(445, 96, 55, 0, TAU); g.clip(); g.translate(445, 96); g.rotate(roll);
  g.fillStyle = '#5a7fa0'; g.fillRect(-80, -120 + pitch * 120, 160, 120); g.fillStyle = '#5a4630'; g.fillRect(-80, pitch * 120, 160, 120);
  g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(-60, pitch * 120); g.lineTo(60, pitch * 120); g.stroke(); g.restore();
  g.strokeStyle = '#f0c040'; g.lineWidth = 3; g.beginPath(); g.moveTo(415, 96); g.lineTo(475, 96); g.stroke();
  PL.gtex.needsUpdate = true;
}
function enterPlane() {
  if (!PGEO.p47) return;
  if (!PL.cockpit) buildCockpit();
  const start = new V3(rnd(-80, 40), 380, 1100);
  const me = new Plane('p47', 'A', start, new V3(0, -5, -120), []); me.player = true; me.hp = 450;
  me.g.visible = false; PL.me = me; PL.throttle = .85; PL.stickX = PL.stickY = PL.rudder = 0; PL.bombs = 2; PL.rearm = 0; PL.av = new V3();
  camera.add(PL.cockpit); PL.cockpit.visible = true;
  P.mode = 'plane'; P.dead = false;
  scene.fog.density = FOG_BASE * .45;
  showMsg('P-47 Thunderbolt — 8 × .50 cal, 2 bombe da 500 lb', 4);
  say(N.radio, 'Qui Thunderbolt Leader: attaccate le posizioni sulla scogliera. Attenti alla contraerea.');
}
function exitPlane() {
  if (PL.me) { PL.me.remove(); PL.me = null; }
  if (PL.cockpit) { PL.cockpit.visible = false; camera.remove(PL.cockpit); }
  scene.fog.density = FOG_BASE;
}
const _pfw = new V3(), _pup = new V3(), _prt = new V3(), _F = new V3(), _vn = new V3();
function updatePlane(dt) {
  const me = PL.me; if (!me) return;
  // comandi: il mouse sposta una "cloche" virtuale che torna al centro
  PL.stickX *= Math.exp(-1.8 * dt); PL.stickY *= Math.exp(-1.8 * dt);
  if (KEYS.KeyW) PL.throttle = Math.min(1, PL.throttle + dt * .4);
  if (KEYS.KeyS) PL.throttle = Math.max(0, PL.throttle - dt * .4);
  PL.rudder = lerp(PL.rudder, (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0), dt * 4);
  if (me.crash) { PL.stickX = PL.stickY = 0; }
  _pfw.set(0, 0, -1).applyQuaternion(me.q); _pup.set(0, 1, 0).applyQuaternion(me.q); _prt.set(1, 0, 0).applyQuaternion(me.q);
  const v = me.vel, V = Math.max(1, v.length()); _vn.copy(v).multiplyScalar(1 / V);
  const m = 6000, S = 27.9, rho = 1.2, q = .5 * rho * V * V;
  const alpha = Math.atan2(-v.dot(_pup), v.dot(_pfw)), beta = v.dot(_prt) / V;
  let Cl = .15 + 4.8 * alpha; const st = .3;
  if (Math.abs(alpha) > st) Cl = Math.sign(alpha) * (.15 + 4.8 * st) * Math.max(.25, 1 - (Math.abs(alpha) - st) * 3.5);
  const lift = q * S * Cl, drag = q * S * (.024 + .065 * Cl * Cl);
  const thrust = me.crash ? 0 : PL.throttle * Math.min(32000, 1.6e6 / Math.max(V, 35));
  _a1.copy(_pup).addScaledVector(_vn, -_pup.dot(_vn)).normalize();
  _F.set(0, -9.8 * m, 0).addScaledVector(_pfw, thrust).addScaledVector(_vn, -drag).addScaledVector(_a1, lift).addScaledVector(_prt, -beta * q * S * .6);
  v.addScaledVector(_F, dt / m);
  PL.G = lift / (m * 9.8);
  // rotazione: comandi + stabilità aerodinamica
  const auth = clamp(V / 110, .25, 1.3);
  const tp = PL.stickY * 1.3 * auth, tr = -PL.stickX * 2.6 * auth, ty = -PL.rudder * .5 * auth;
  PL.av.x = lerp(PL.av.x, tp - alpha * 1.8 * auth, dt * 4); PL.av.z = lerp(PL.av.z, tr, dt * 5); PL.av.y = lerp(PL.av.y, ty - beta * 1.2 * auth, dt * 3);
  _aq.setFromEuler(new THREE.Euler(PL.av.x * dt, PL.av.y * dt, PL.av.z * dt, 'YXZ')); me.q.multiply(_aq).normalize();
  me.pos.addScaledVector(v, dt);
  me.g.updateMatrixWorld();
  for (const p of me.props) p.rotation.z += dt * 60 * PL.throttle;
  PL.prop.rotation.z += dt * (20 + 60 * PL.throttle);
  // armi
  PL.gunT -= dt;
  if ((mouseL || KEYS.Space) && PL.gunT <= 0 && !me.crash) {
    PL.gunT = .055; me.fireT = 0;
    playerPlaneGuns(me);
  }
  PL.rearm -= dt; if (PL.bombs < 2 && PL.rearm <= 0) { PL.bombs = 2; feed('Bombe riarmate'); }
  // contraerea e collisione
  const gy = Math.max(Hf(me.pos.x, me.pos.z), me.pos.z > -9 ? WATER_Y : -99);
  if (me.pos.y < gy + 1.5) {
    explode(me.pos.clone().setY(gy + .5), 12, 600, {});
    exitPlane(); P.mode = 'foot'; P.die(); return;
  }
  if (me.crash && !PL.crashMsg) { PL.crashMsg = true; showMsg('Colpito! Stai precipitando!', 3); }
  if (Math.abs(me.pos.x) > 2400 || Math.abs(me.pos.z) > 2400 || me.pos.y > 2500) { const back = _a2.set(-me.pos.x, 300 - me.pos.y, -me.pos.z).normalize(); v.lerp(back.multiplyScalar(V), dt * .3); }
  // camera in cabina
  const head = _a3.set(0, 1.05, .45).applyQuaternion(me.q).add(me.pos);
  camera.position.copy(head);
  camera.quaternion.copy(me.q);
  camera.rotateY(P.lookYaw || 0); camera.rotateX(P.lookPitch || 0);
  const shake = (PL.gunT > -.05 ? .002 : 0) + Math.min(.004, V * .00002) + P.shake * .01;
  camera.rotateX(rnd(-shake, shake)); camera.rotateY(rnd(-shake, shake));
  if (Math.abs(camera.fov - 78) > .01) { camera.fov = 78; camera.updateProjectionMatrix(); }
  if (PL.eng !== me.eng) PL.eng = me.eng;
  me.eng && me.eng.set(.75 * (.4 + PL.throttle * .6), 0, .75 + PL.throttle * .5);
  P.supp = Math.max(P.supp, clamp((PL.G - 5) / 3, 0, .9));
  PL.gT -= dt; if (PL.gT <= 0) { PL.gT = .15; drawGauges(); }
  P.pos.copy(me.pos);
}
function playerPlaneGuns(me) {
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), r = _a2.set(1, 0, 0).applyQuaternion(me.q);
  sfxShot('m2', null, true); P.shake = Math.min(.5, P.shake + .05);
  for (const sx of [-1, 1]) {
    const o = me.pos.clone().addScaledVector(r, sx * 2.7).addScaledVector(f, 1);
    const conv = me.pos.clone().addScaledVector(f, 320);
    const d = conv.sub(o).normalize().add(new V3(rnd(-.006, .006), rnd(-.006, .006), rnd(-.006, .006))).normalize();
    o.addScaledVector(me.vel, .016);
    let t = rayTerrain(o, d, 1100); const tw = d.y < 0 ? (WATER_Y - o.y) / d.y : -1;
    let water = false; if (tw > 0 && (t < 0 || tw < t) && o.z + d.z * tw > -9) { t = tw; water = true; }
    let hitPlane = null;
    for (const pl of PLANES) if (pl.team === 'E' && pl.alive && !pl.crash) { const tt = raySphere(o, d, pl.pos, 6); if (tt > 0 && (t < 0 || tt < t)) { t = tt; hitPlane = pl; } }
    const end = o.clone().addScaledVector(d, t > 0 ? t : 1100);
    if (R() < .4) fxTracer(o, end, 1.5);
    if (hitPlane) { hitPlane.damage(25, true); fxImpact(end, 'metal'); continue; }
    if (t < 0) continue;
    fxImpact(end, water ? 'water' : end.z > -58 ? 'sand' : 'dirt');
    for (const s of enemies) if (s.alive && !s.inBunker && Math.abs(s.pos.x - end.x) < 1.5 && Math.abs(s.pos.z - end.z) < 1.5) s.damage(rnd(70, 130), o, true, 'body', { dir: d.clone(), power: 3.5, joint: 15 });
    for (const v of MISSION.vehicles) if (v.alive && v.pos.distanceTo(end) < 3) v.damage(25, true);
    for (const a of WORLD.aaSites) if (!a.dead && a.mesh && a.mesh.position.distanceTo(end) < 3 && R() < .1) { a.dead = true; burnMeshes(a.mesh); feed('Postazione contraerea distrutta'); }
  }
}
function planeDropBomb() {
  const me = PL.me; if (!me || PL.bombs <= 0 || me.crash) return;
  PL.bombs--; if (PL.rearm <= 0) PL.rearm = 40;
  const m = new THREE.Mesh(BOMB_G(), MAT.paint), r = _a2.set(1, 0, 0).applyQuaternion(me.q);
  m.position.copy(me.pos).add(new V3(0, -1.2, 0)).addScaledVector(r, PL.bombs ? -1.2 : 1.2); scene.add(m);
  projectiles.push({ type: 'bomb', p: m.position, v: me.vel.clone(), life: 40, m, byPlayer: true, team: 'A' });
  play('mag_out', null, { vol: .8, rate: .5 }); feed('Bomba sganciata');
}
