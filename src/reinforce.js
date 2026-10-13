"use strict";
// ============================================================
//  Rinforzi tedeschi: camion che fanno la spola tra la città e
//  la linea del fronte. Un camion distrutto rinasce al deposito.
// ============================================================
const CONVOY = { trucks: [], depotZ: -560 };
const roadPathX = z => z > -292 ? roadX(clamp(z, -292, -64)) : roadX(-292) + Math.sin(z * .01) * 6;

class SupplyTruck {
  constructor(slot) {
    if (!TRUCK_G) { const t = new Truck(0, -2000, 1); t.alive = false; scene.remove(t.g); MISSION.vehicles.splice(MISSION.vehicles.indexOf(t), 1); }
    this.slot = slot; this.g = groupMesh(TRUCK_G); this.pos = this.g.position;
    this.z = CONVOY.depotZ - slot * 25; this.pos.set(roadPathX(this.z), 0, this.z);
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
    if (this.state === 'wait') { this.t -= dt; if (this.t <= 0 && Q.enemyAlive - aliveE() >= 6) { this.state = 'go'; } }
    else if (this.state === 'go') {
      const tz = this.dropZ(); this.z = Math.min(tz, this.z + 15 * dt);
      if (this.z >= tz) { this.state = 'unload'; this.t = 3; this.unload(); }
    } else if (this.state === 'unload') { this.t -= dt; if (this.t <= 0) this.state = 'back'; }
    else if (this.state === 'back') { this.z -= 16 * dt; if (this.z <= CONVOY.depotZ) { this.z = CONVOY.depotZ; this.state = 'wait'; this.t = aliveE() < Q.enemyAlive * .6 ? rnd(4, 8) : rnd(12, 20); } }
    const back = this.state === 'back';
    this.pos.set(roadPathX(this.z), Hf(roadPathX(this.z), this.z), this.z);
    const ahead = roadPathX(this.z + (back ? -3 : 3)) - this.pos.x;
    this.g.rotation.y = Math.atan2(ahead, back ? -3 : 3) + (back ? 0 : PI);
    this.box.min.set(this.pos.x - 1.3, this.pos.y, this.pos.z - 3.6); this.box.max.set(this.pos.x + 1.3, this.pos.y + 2.5, this.pos.z + 3.6);
  }
  unload() {
    const room = Q.enemyAlive - aliveE(), n = Math.min(room, aliveE() < Q.enemyAlive * .5 ? 12 : 9); if (n <= 0) return;
    const empty = TRENCH_POSTS.filter(p => !enemies.some(e => e.alive && Math.abs(e.pos.x - p.x) < 2.5 && Math.abs(e.pos.z - p.z) < 3));
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
