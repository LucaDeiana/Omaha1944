"use strict";
// ============================================================
//  Operazioni nell'entroterra: catena di missioni del Capt. Ward
// ============================================================
function initInland() {
  const w = addAlly('smg', -24, -182, { name: 'Capt. Ward', stationary: true, state: 'post' });
  w.vip = true; w.yaw = PI;
  const ops = [
    {
      title: 'Il deposito di Vierville', x: -700, z: -330,
      brief: ['Il deposito munizioni di Vierville rifornisce tutto il settore.', 'Metti una carica sulle casse e allontanati. Occhio alle sentinelle.'],
      start(q) {
        q.target = new V3(this.x, 0, this.z); q.target.y = Hf(this.x, this.z);
        const mb = new MB(); mb.mat = 'wood';
        for (let k = 0; k < 14; k++) mb.add(U.box, 0x5a4a32, this.x + rnd(-4, 4), q.target.y + .4 + (k % 3) * .8, this.z + rnd(-3, 3), 0, rnd(-.3, .3), 0, 1.4, .8, .9);
        q.mesh = groupMesh(mb.buildGroups()); scene.add(q.mesh);
        for (let k = 0; k < 7; k++) addEnemy(pick(['rifle', 'rifle', 'smg', 'mg']), this.x + rnd(-14, 14), this.z + rnd(-12, 12), { group: 'dep' });
        q.it = { pos: q.target, r: 3.5, hold: 3, label: 'Tieni premuto E per piazzare la carica', active: () => q.step === 1, done: () => {
          q.step = 2; sfxMech('pick'); showMsg('Carica piazzata — allontanati!', 3);
          after(8, () => {
            const p = q.target.clone(); p.y += 1;
            for (let k = 0; k < 5; k++) after(k * .35, () => { const e = p.clone().add(new V3(rnd(-4, 4), 0, rnd(-4, 4))); explode(e, 14, 400, { bomb: true, byPlayer: true }); fxExplosion(e, 3.5, false); });
            burnMeshes(q.mesh); const em = addEmitter(p, 'fire', 1.5); em.life = 90;
            q.step = 3; feed('Deposito munizioni distrutto'); STATS.kills += 6;
          });
        } };
      },
      marker(q) { return q.step === 1 || q.step === 2 ? { pos: q.target.clone().add(new V3(0, 3, 0)), label: 'Deposito' } : null; },
    },
    {
      title: 'I paracadutisti della 101a', x: 600, z: -420,
      brief: ['Un gruppo della 101a Aviotrasportata è bloccato in una fattoria a est.', 'Ripulisci la zona e portali con noi.'],
      start(q) {
        q.target = new V3(this.x, 0, this.z); q.target.y = Hf(this.x, this.z);
        q.para = []; for (let k = 0; k < 4; k++) { const a = addAlly('rifle', this.x + rnd(-3, 3), this.z + rnd(-2, 2), { stationary: true, state: 'post', name: k === 0 ? 'Sgt. Lipton' : '' }); a.forceProne = true; a.vip = true; q.para.push(a); }
        q.foes = []; for (let k = 0; k < 10; k++) { const a = rnd(0, TAU), r = rnd(18, 35); q.foes.push(addEnemy(pick(['rifle', 'smg', 'mg', 'rifle']), this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, { group: 'farm' })); }
      },
      update(q) {
        if (q.step === 1 && !q.foes.some(e => e.alive)) {
          q.step = 3; for (const a of q.para) { a.forceProne = false; a.stationary = false; a.squad = true; a.state = 'idle'; a.vip = false; }
          say('Sgt. Lipton', 'Pensavamo fosse finita. La 101a è con voi, signore!'); STATS.kills += 5; P.nades += 2;
        }
      },
      marker(q) { return q.step === 1 ? { pos: q.target.clone().add(new V3(0, 3, 0)), label: 'Fattoria' } : null; },
    },
  ];
  NPC.list.push({
    s: w, title: 'Operazioni nell\'entroterra', state: 0, op: -1, step: 0,
    active() { return MISSION.stage >= 5; },
    talk(q) {
      const cur = ops[q.op];
      if (cur && q.step !== 3) { say(w.name, cur.brief[1]); return; }
      q.op++;
      if (q.op >= ops.length) { say(w.name, 'Hai fatto più di quanto chiedessi. Riposati, se ci riesci.'); q.state = 9; showMsg('Missione personale compiuta: ' + q.title, 3); return; }
      const o = ops[q.op]; q.state = 1; q.step = 1; o.start(q);
      if (q.it) MISSION.interactables.push(q.it);
      say(w.name, o.brief[0]); after(4, () => say(w.name, o.brief[1]));
      showMsg(o.title, 3);
    },
    update(q, dt) {
      const o = ops[q.op]; if (!o) return;
      if (o.update) o.update(q, dt);
      if (q.it && q.step === 1 && !MISSION.interactables.includes(q.it)) MISSION.interactables.push(q.it);
      if (q.step === 3 && !q.reported) { q.reported = true; q.it = null; showMsg('Operazione completata: ' + o.title + ' — torna da Ward', 3.5); }
      if (q.step !== 3) q.reported = false;
    },
    marker(q) {
      const o = ops[q.op];
      if (o && q.step !== 3) return o.marker(q);
      return q.state !== 9 && q.op >= 0 && MISSION.stage >= 5 ? { pos: w.pos.clone().add(new V3(0, 2.3, 0)), label: 'Ward' } : null;
    },
  });
}
