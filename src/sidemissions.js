"use strict";
// ============================================================
//  Missioni secondarie per la corazzata e per il P-47
// ============================================================
const SIDE = { mode: null, i: { naval: 0, plane: 0 }, cur: null, markers: [], text: '', title: '', score: 0, t: 0 };
let TRUCK_G = null;

class Truck {
  constructor(x, z, dir) {
    if (!TRUCK_G) {
      const mb = new MB(), c = 0x6e6a52, d = 0x2a2a28; mb.mat = 'paint';
      mb.add(U.box, c, 0, 1.3, -2, 0, 0, 0, 2.1, 1.5, 1.8); mb.add(U.box, 0x1a1c1e, 0, 1.6, -2.92, 0, 0, 0, 1.8, .5, .05);
      mb.add(U.box, c, 0, .95, -3.3, -.2, 0, 0, 1.9, .8, 1.2);
      mb.add(U.box, d, 0, .6, 0, 0, 0, 0, 1.2, .3, 7);
      mb.add(U.box, 0x5d5a44, 0, 1.4, 1.6, 0, 0, 0, 2.2, .1, 4.2); for (const sx of [-1, 1]) mb.add(U.box, 0x5d5a44, sx * 1.1, 1.8, 1.6, 0, 0, 0, .06, .8, 4.2);
      mb.add(U.box, 0x55513e, 0, 2.3, 1.6, 0, 0, 0, 2.2, .06, 4.2);
      for (const z of [-3.1, .8, 2.6]) for (const sx of [-1, 1]) mb.add(U.cyl12, d, sx * 1.0, .5, z, 0, 0, PI / 2, .48, .3, .48);
      TRUCK_G = mb.buildGroups();
    }
    this.g = groupMesh(TRUCK_G); this.pos = this.g.position; this.pos.set(x, Hf(x, z), z);
    this.dir = dir; this.yaw = dir > 0 ? -PI / 2 : PI / 2; this.g.rotation.y = this.yaw;
    this.alive = true; this.hp = 220; this.gunnerAlive = false; this.box = { min: new V3(), max: new V3() }; this.truck = true;
    scene.add(this.g); MISSION.vehicles.push(this);
  }
  update(dt) {
    if (!this.alive) return;
    this.pos.x += this.dir * 9 * dt; this.pos.z = -520 + Math.sin(this.pos.x * .004) * 25; this.pos.y = Hf(this.pos.x, this.pos.z);
    this.box.min.set(this.pos.x - 3.6, this.pos.y, this.pos.z - 1.3); this.box.max.set(this.pos.x + 3.6, this.pos.y + 2.5, this.pos.z + 1.3);
    if (Math.abs(this.pos.x) > MAPX) { this.alive = false; scene.remove(this.g); this.escaped = true; }
  }
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a;
    if (this.hp <= 0) {
      this.alive = false; burnMeshes(this.g); const p = this.pos.clone(); p.y += 1.5;
      fxExplosion(p, 2, false); sfxBoom(p, 2); const e = addEmitter(p, 'fire', .9); e.life = 60;
      if (byPlayer) { STATS.kills += 2; feed('Camion nemico distrutto'); }
    }
  }
}
function spawnConvoy(n) {
  const dir = R() < .5 ? 1 : -1, x0 = -dir * (MAPX - 260), list = [];
  for (let k = 0; k < n; k++) list.push(new Truck(x0 - dir * k * 22, -520, dir));
  return list;
}
function crewAlive(x, z, role, r = 5) { return enemies.some(e => e.alive && (!role || e.role === role) && Math.hypot(e.pos.x - x, e.pos.z - z) < r); }

const SIDE_DEF = {
  naval: [
    {
      title: 'Fuoco di controbatteria', brief: 'Gli osservatori segnalano mortai dietro la trincea. Metteteli a tacere.',
      start() { },
      targets() { return WORLD.mortarPits.filter(mp => crewAlive(mp.x, mp.z, 'mortar')).map(mp => ({ pos: new V3(mp.x, Hf(mp.x, mp.z) + 3, mp.z), label: 'Mortaio' })); },
      text(n) { return `Distruggi le postazioni di mortaio — rimaste ${n}`; },
    },
    {
      title: 'Capisaldi del settore', brief: 'I capisaldi a est e a ovest stanno falciando le ondate. Distruggeteli.',
      start() { },
      targets() { return (WORLD.extraBunkers || []).filter(b => !b.destroyed).map(b => ({ pos: new V3(b.x, b.base + 6, b.z), label: 'Caposaldo' })); },
      text(n) { return `Distruggi i capisaldi tedeschi — rimasti ${n}`; },
    },
    {
      title: 'Interdizione', brief: 'Una colonna di rifornimenti percorre la strada costiera. Fermatela.',
      start(s) { s.convoy = spawnConvoy(6); },
      targets(s) { return s.convoy.filter(v => v.alive).map(v => ({ pos: v.pos.clone().add(new V3(0, 4, 0)), label: 'Camion' })); },
      text(n) { return `Distruggi la colonna sulla strada costiera — camion rimasti ${n}`; },
    },
  ],
  plane: [
    {
      title: 'Soppressione contraerea', brief: 'Le Flak da 20 mm sulla scogliera abbattono i nostri. Distruggetele.',
      start() { },
      targets() { return WORLD.aaSites.filter(a => !a.dead && crewAlive(a.x, a.z, 'aa', 6)).map(a => ({ pos: new V3(a.x, Hf(a.x, a.z) + 4, a.z), label: 'Flak' })); },
      text(n) { return `Distruggi le postazioni contraeree — rimaste ${n}`; },
    },
    {
      title: 'Caccia nemici', brief: 'Fw 190 in avvicinamento da sud! Intercettateli.',
      start(s) { s.hunters = []; for (let k = 0; k < 3; k++) { const p = new Plane('fw190', 'E', new V3(rnd(-400, 400), 450 + k * 30, -1400 - k * 60), new V3(0, 0, 160), []); p.hunter = true; p.hp = 220; s.hunters.push(p); } say(N.radio, 'Attenzione Thunderbolt: banditi a ore dodici, quota alta!'); },
      targets(s) { return s.hunters.filter(p => p.alive && !p.crash).map(p => ({ pos: p.pos.clone(), label: 'Fw 190' })); },
      text(n) { return `Abbatti i caccia Fw 190 — rimasti ${n}`; },
    },
    {
      title: 'Attacco alla colonna', brief: 'Rinforzi tedeschi sulla strada costiera. Bombardate e mitragliate.',
      start(s) { s.convoy = spawnConvoy(8); },
      targets(s) { return s.convoy.filter(v => v.alive).map(v => ({ pos: v.pos.clone().add(new V3(0, 4, 0)), label: 'Camion' })); },
      text(n) { return `Distruggi la colonna di rinforzi — veicoli rimasti ${n}`; },
    },
  ],
};

function updateSide(dt) {
  const mode = P.mode === 'naval' || P.mode === 'plane' ? P.mode : null;
  if (mode !== SIDE.mode) {
    SIDE.mode = mode;
    if (SIDE.cur && SIDE.cur.mode !== mode) SIDE.cur = null;
    if (mode && !SIDE.cur) startSide(mode);
  }
  if (!SIDE.cur) { SIDE.markers = []; return; }
  const s = SIDE.cur, tg = s.def.targets(s);
  SIDE.markers = tg; SIDE.text = tg.length ? s.def.text(tg.length) : 'Missione compiuta'; SIDE.title = s.def.title;
  if (!tg.length && !s.done) {
    s.done = true; STATS.kills += 5;
    showMsg('Missione compiuta: ' + s.def.title, 3);
    say(N.radio, pick(['Ottimo lavoro, missione compiuta!', 'Bersagli eliminati. Bel lavoro!', 'Obiettivo raggiunto, proseguite.']));
    SIDE.i[s.mode] = (SIDE.i[s.mode] + 1) % SIDE_DEF[s.mode].length;
    const m = s.mode; SIDE.cur = null;
    after(5, () => { if (SIDE.mode === m && !SIDE.cur) startSide(m); });
  }
}
function startSide(mode) {
  const def = SIDE_DEF[mode][SIDE.i[mode]];
  const s = { def, mode, done: false }; SIDE.cur = s; def.start(s);
  if (!def.targets(s).length) { SIDE.i[mode] = (SIDE.i[mode] + 1) % SIDE_DEF[mode].length; SIDE.cur = null; return; }
  showMsg(def.title, 3); say(N.radio, def.brief);
}
// IA dei caccia che danno la caccia al giocatore
const _hUp = new V3(0, 1, 0), _hTo = new V3();
function huntPlayer(p, dt) {
  // bersaglio: il bombardiere assegnato (scorta) oppure il giocatore; senza bersaglio gira in cerchio sul posto e aspetta
  const me = PL.me, ht = p.huntTarget && p.huntTarget.alive && !p.huntTarget.crash ? p.huntTarget : null;
  const tgt = ht || (me && P.mode === 'plane' && !me.crash ? me : null);
  if (!tgt) { p.vel.applyAxisAngle(_hUp, .35 * dt); p.vel.y *= 1 - dt; if (p.pos.y < Hf(p.pos.x, p.pos.z) + 200) p.vel.y += 20 * dt; p.roll = lerp(p.roll, -.5, dt); p.pos.addScaledVector(p.vel, dt); p.orient(p.roll); return; }
  const dist0 = p.pos.distanceTo(tgt.pos);
  p.extT = Math.max(0, (p.extT || 0) - dt);
  if (!p.extT && dist0 < (ht ? 70 : 110)) { p.extT = rnd(3, 5); p.extDir = p.vel.clone().normalize().add(new V3(rnd(-.6, .6), rnd(.2, .5), rnd(-.6, .6))).normalize(); }
  const lead = p.extT ? p.pos.clone().addScaledVector(p.extDir, 500) : tgt.pos.clone().addScaledVector(tgt.vel, dist0 / 700);
  const want = lead.sub(p.pos).normalize(), cur = p.vel.clone().normalize();
  const nv = cur.lerp(want, Math.min(1, dt * .9)).normalize();
  const lat = new V3().crossVectors(cur, nv).y;
  p.roll = lerp(p.roll, clamp(-lat * 40, -1.3, 1.3), dt * 2);
  p.vel.copy(nv).multiplyScalar(165); p.pos.addScaledVector(p.vel, dt); p.orient(p.roll);
  p.fireT -= dt;
  // spara solo se il muso punta davvero il bersaglio (non durante il disimpegno)
  const toT = _hTo.subVectors(tgt.pos, p.pos).normalize();
  if (!p.extT && dist0 < 500 && cur.dot(toT) > .985 && p.fireT <= 0) {
    p.fireT = .07;
    const o = p.pos.clone().addScaledVector(cur, 4), e = tgt.pos.clone().add(new V3(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)));
    fxTracer(o, e, 1.4); sfxShot('mg42', o);
    if (tgt === me) { if (R() < .08) { me.damage(rnd(15, 30), false); P.shake += .3; play('imp_metal', null, { vol: .7 }); lensSplat('dirt', .15); } }
    else if (R() < .1) tgt.damage(rnd(12, 24), false);
  }
  if (p.pos.y < Hf(p.pos.x, p.pos.z) + 60) p.vel.y += 40 * dt;
}
