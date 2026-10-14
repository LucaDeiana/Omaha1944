"use strict";
// ============================================================
//  Rinforzi tedeschi: camion che fanno la spola tra la città e
//  la linea del fronte. Un camion distrutto rinasce al deposito.
// ============================================================
const CONVOY = { trucks: [], depotZ: -560, stop: false };
const enemyCap = () => Q.enemyAlive + (MISSION.endless ? Math.min(60, Math.floor(MISSION.stageT / 60) * 6) : 0);
const roadPathX = z => SCEN === 'ard' ? ardRoadX(z) : z > -292 ? roadX(clamp(z, -292, -64)) : roadX(-292) + Math.sin(z * .01) * 6;

class SupplyTruck {
  constructor(slot) {
    if (!TRUCK_G) { const t = new Truck(0, -2000, 1); t.alive = false; scene.remove(t.g); MISSION.vehicles.splice(MISSION.vehicles.indexOf(t), 1); }
    this.slot = slot; this.g = groupMesh(TRUCK_G); this.pos = this.g.position;
    this.homeZ = CONVOY.depotZ - slot * 16; this.z = this.homeZ; this.pos.set(roadPathX(this.z) - 1.8, 0, this.z);
    this.hd = 0; this.v = 0; this.stuckT = 0; // direzione di marcia (0 = verso la spiaggia) e velocità
    this.state = 'wait'; this.t = 4 + slot * 7; this.alive = true; this.hp = 260; this.gunnerAlive = false;
    this.box = { min: new V3(), max: new V3() }; this.truck = true;
    scene.add(this.g); MISSION.vehicles.push(this);
  }
  dropZ() {
    const st = MISSION.stage, ax = PT === 'E';
    if (ax) return st <= 2 ? -112 : st === 3 ? -190 : -300;
    return st <= 4 ? -112 : st <= 5 ? -195 : -300;
  }
  update(dt) {
    if (!this.alive) return;
    if (this.state === 'wait') { this.t -= dt; if (this.t <= 0 && !CONVOY.stop && enemyCap() - aliveE() >= 6) { this.state = 'go'; } }
    else if (this.state === 'go') {
      const tz = this.dropZ(); this.drive(dt, 1, tz);
      if (this.pos.z >= tz - 1 || (tz - this.pos.z < 45 && this.stuckT > 1.5)) { /* in coda vicino alla zona di scarico: scarica lì */ this.state = 'unload'; this.t = 3; this.v = 0; this.unload(); }
    } else if (this.state === 'unload') { this.t -= dt; if (this.t <= 0) this.state = 'back'; }
    else if (this.state === 'back') {
      this.drive(dt, -1, this.homeZ);
      if (this.pos.z <= this.homeZ + 1) { this.state = 'wait'; this.v = 0; this.t = aliveE() < Q.enemyAlive * .6 ? rnd(4, 8) : rnd(12, 20); }
    }
    this.z = this.pos.z; this.pos.y = Hf(this.pos.x, this.pos.z);
    this.g.rotation.y = this.hd + PI;
    this.box.min.set(this.pos.x - 1.3, this.pos.y, this.pos.z - 3.6); this.box.max.set(this.pos.x + 1.3, this.pos.y + 2.5, this.pos.z + 3.6);
  }
  // guida con sterzo limitato: segue la propria corsia (destra) e inverte la marcia con un'inversione a U;
  // rallenta e si ferma dietro a un altro camion per non sovrapporsi
  drive(dt, dir, endZ) {
    const p = this.pos, lz = dir > 0 ? Math.min(endZ, p.z + 12) : Math.max(endZ, p.z - 12);
    const tx = roadPathX(lz) + (dir > 0 ? 1.8 : -1.8), want = Math.atan2(tx - p.x, lz - p.z), err = angDiff(this.hd, want);
    let vmax = Math.abs(err) > .9 ? 4 : Math.min(14, 2 + Math.abs(endZ - p.z) * .8);
    const fx = Math.sin(this.hd), fz = Math.cos(this.hd);
    for (const o of CONVOY.trucks) {
      if (o === this) continue; // anche i relitti fanno da ostacolo
      const rx = o.pos.x - p.x, rz = o.pos.z - p.z, ah = rx * fx + rz * fz, lat = Math.abs(rx * fz - rz * fx);
      if (ah > 0 && ah < 16 && lat < 2.8) vmax = Math.min(vmax, Math.max(0, (ah - 8) * 1.5));
    }
    // se bloccato a lungo (incrocio frontale) si sposta di lato
    this.stuckT = vmax < .5 ? this.stuckT + dt : 0;
    if (this.stuckT > 4) { p.x += (dir > 0 ? 1 : -1) * 2.5 * dt; if (this.stuckT > 7) this.stuckT = 0; }
    this.v += clamp(vmax - this.v, -8 * dt, 3 * dt);
    if (this.v > .3) this.hd += clamp(err, -.75 * dt, .75 * dt) * Math.min(1, this.v / 3);
    p.x += Math.sin(this.hd) * this.v * dt; p.z += Math.cos(this.hd) * this.v * dt;
  }
  unload() {
    const room = enemyCap() - aliveE(), n = Math.min(room, aliveE() < enemyCap() * .5 ? 12 : 9); if (n <= 0) return;
    const empty = TRENCH_POSTS.filter(p => !enemies.some(e => e.alive && Math.abs(e.pos.x - p.x) < 2.5 && Math.abs(e.pos.z - p.z) < 3) && !allies.some(a => a.alive && a.state !== 'boat' && Math.abs(a.pos.x - p.x) < 35 && Math.abs(a.pos.z - p.z) < 35));
    const front = this.dropZ() > -130;
    for (let i = 0; i < n; i++) {
      const sx = this.pos.x + rnd(-2, 2), sz = this.pos.z + rnd(-3, 3);
      if (front && empty.length) { const p = empty.splice(Math.floor(R() * empty.length), 1)[0]; addEnemy(randEnemyKind(), sx, sz, { state: 'move', group: 'beach', toPost: true, objective: p.clone() }); }
      else addEnemy(randEnemyKind(), sx, sz, { state: 'assault', group: 'counter', objective: new V3(sx + rnd(-40, 40), 0, this.dropZ() + rnd(10, 30)) });
    }
    if (P.mode === 'foot' && P.pos.distanceTo(this.pos) < 90) shout('de', 'move', this.pos, { text: 'Absitzen! Schnell, schnell!' });
  }
  damage(a, byPlayer) {
    if (!this.alive) return; this.hp -= a;
    if (this.hp <= 0) {
      this.alive = false; burnMeshes(this.g); const p = this.pos.clone(); p.y += 1.5;
      fxExplosion(p, 2, false); sfxBoom(p, 2); const e = addEmitter(p, 'fire', .9); e.life = 50;
      if (byPlayer) { STATS.kills += 2; feed('Camion dei rinforzi distrutto'); }
      const slot = this.slot; after(25, () => { const i = CONVOY.trucks.indexOf(this); CONVOY.trucks[i] = new SupplyTruck(slot); scene.remove(this.g); });
    }
  }
}
function initConvoy() { if (NET.client) return; for (let k = 0; k < 5; k++) CONVOY.trucks.push(new SupplyTruck(k)); }
