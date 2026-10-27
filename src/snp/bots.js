"use strict";
// ============================================================
//  Modalità SOLO CECCHINI — bot tattici.
//  Ogni bot percepisce (vista, udito), ricorda, decide con una
//  macchina a stati a punteggio e mira convergendo nel tempo.
//  Usa le stesse armi, munizioni, ricariche e collisioni del giocatore.
//  Niente informazioni non percepite: nessuna vista attraverso i muri.
// ============================================================

// livelli di difficoltà: valori iniziali di bilanciamento
const SNP_DIFF = [
  null,
  { name: 'Recluta', react: [1.5, 3], det: .9, turn: 2.0, err0: 6.5, tau: 1.4, floor: .34, hear: 25, moveAfter: 9, dwell: [30, 70], thr: 1.7, head: .05, mem: 6, lead: 0, expoBias: .5, spot: .45 },
  { name: 'Soldato', react: [1, 2], det: 1.35, turn: 2.8, err0: 5.2, tau: 1.0, floor: .24, hear: 18, moveAfter: 4, dwell: [20, 45], thr: 1.35, head: .12, mem: 10, lead: .2, expoBias: .3, spot: .6 },
  { name: 'Veterano', react: [.6, 1.3], det: 2.1, turn: 3.8, err0: 4.2, tau: .7, floor: .16, hear: 12, moveAfter: 2.6, dwell: [12, 30], thr: 1.0, head: .25, mem: 16, lead: .55, expoBias: 0, spot: .8 },
  { name: 'Élite', react: [.35, .8], det: 2.7, turn: 4.8, err0: 3.4, tau: .5, floor: .11, hear: 8, moveAfter: 2, dwell: [9, 22], thr: .9, head: .45, mem: 20, lead: .8, expoBias: -.2, spot: .9 },
  { name: 'Asso', react: [.25, .6], det: 3.2, turn: 5.8, err0: 2.9, tau: .38, floor: .08, hear: 6, moveAfter: 1.6, dwell: [7, 18], thr: .82, head: .6, mem: 25, lead: .95, expoBias: -.35, spot: 1 },
];
// profili di comportamento, indipendenti dalla difficoltà
const SNP_PROF = {
  cauto: { name: 'Cauto', expo: -1.2, cover: 1.5, dwell: 1.25, flee: .9, thr: .8, move: 1, floorVar: 1, engaged: 1 },
  aggressivo: { name: 'Aggressivo', expo: 1.1, cover: .3, dwell: .8, flee: .25, thr: 1.35, move: 1, floorVar: 1, engaged: 1.1 },
  paziente: { name: 'Paziente', expo: -.2, cover: .8, dwell: 2.1, flee: .5, thr: .85, move: .5, floorVar: .7, engaged: 1, scan: 1.7 },
  mobile: { name: 'Mobile', expo: .2, cover: .8, dwell: .5, flee: .6, thr: 1, move: 1.8, floorVar: 1.8, engaged: 1 },
  opportunista: { name: 'Opportunista', expo: .3, cover: .7, dwell: .9, flee: .5, thr: 1.1, move: 1.1, floorVar: 1, engaged: 1.8 },
};
const SNP_PROF_KEYS = Object.keys(SNP_PROF);
const SNP_DMG = { head: 999, body: 1, legs: 45, arms: 40 };   // body: danno pieno dell'arma (letale)
function snpDamage(w, zone) { return zone === 'body' ? w.dmg : SNP_DMG[zone] || w.dmg; }

// ---------- rumori di sparo: ascoltati dai bot al pensiero successivo ----------
function snpShotSound(pos, team, who) {
  SNP.sounds.push({ pos: pos.clone(), team, who, t: GAME.time });
  if (SNP.sounds.length > 40) SNP.sounds.shift();
  if (who) who.shotT = GAME.time;
}

// ---------- tracciamento del colpo di un bot: muri, terreno, corpi avversari, giocatore ----------
const _bt = new V3(), _bh = new V3();
function snpTrace(o, d, maxT, team) {
  let bt = maxT, type = null, obj = null, zone = null, joint = 15;
  const sr = raySolids(o, d, bt); if (sr) { bt = sr.t; type = 'solid'; obj = sr.s; }
  const tt = rayTerrain(o, d, bt); if (tt >= 0 && tt < bt) { bt = tt; type = 'terrain'; obj = null; }
  for (const e of team === 'A' ? enemies : allies) {
    if (!e.alive || e.removed) continue;
    const cx = e.pos.x - o.x, cy = e.pos.y + .9 - o.y, cz = e.pos.z - o.z, pr = cx * d.x + cy * d.y + cz * d.z;
    if (pr < 0 || pr > bt + 1.5 || cx * cx + cy * cy + cz * cz - pr * pr > 4) continue;
    const b = e.body; b.root.updateMatrixWorld(true);
    for (const [n, x, y, z, r, zn, j] of HITZ) {
      const t = raySphere(o, d, _bh.set(x, y, z).applyMatrix4(b[n].matrixWorld), r);
      if (t > 0 && t < bt) { bt = t; type = 'soldier'; obj = e; zone = zn; joint = j; }
    }
  }
  if (PT !== team && P.targetable() && P.mode === 'foot') {
    for (const [c, r, zn] of snpPlayerSpheres()) { const t = raySphere(o, d, c, r); if (t > 0 && t < bt) { bt = t; type = 'player'; obj = P; zone = zn; } }
  }
  return { t: bt, type, obj, zone, joint };
}
// sfere del corpo del giocatore secondo la postura (in piedi, accovacciato, prono)
const _ps = [0, 1, 2, 3, 4].map(() => new V3());
function snpPlayerSpheres() {
  const p = P.pos, st = P.stance, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  if (st === 2) return [[_ps[0].set(p.x + fx * .75, p.y + .3, p.z + fz * .75), .14, 'head'], [_ps[1].set(p.x + fx * .35, p.y + .22, p.z + fz * .35), .22, 'body'], [_ps[2].set(p.x - fx * .1, p.y + .18, p.z - fz * .1), .2, 'body'], [_ps[3].set(p.x - fx * .7, p.y + .12, p.z - fz * .7), .17, 'legs'], [_ps[4].set(p.x + fx * .45 + fz * .25, p.y + .2, p.z + fz * .45 - fx * .25), .1, 'arms']];
  const hy = st === 1 ? 1.0 : 1.55, cy = st === 1 ? .78 : 1.22, lo = P.leanOff || _ps[4];
  return [[_ps[0].set(p.x + lo.x, p.y + hy + lo.y, p.z + lo.z), .14, 'head'], [_ps[1].set(p.x + lo.x * .6, p.y + cy, p.z + lo.z * .6), .24, 'body'], [_ps[2].set(p.x, p.y + cy - .32, p.z), .2, 'body'], [_ps[3].set(p.x, p.y + (st === 1 ? .32 : .5), p.z), .19, 'legs'], [_ps[4].set(p.x + fz * .28, p.y + cy, p.z - fx * .28), .1, 'arms']];
}

// ---------- il bot ----------
let SNP_BOT_ID = 1;
class SnpBot extends Soldier {
  constructor(team, x, y, z, o) {
    super(team, 'sniper', x, z, { y, state: 'snp', stationary: true, name: o.name, yaw: team === 'A' ? 0 : PI });
    this.fixedY = true; this.snp = true; this.bid = SNP_BOT_ID++;
    this.lvl = o.lvl; this.D = SNP_DIFF[o.lvl]; this.prof = SNP_PROF[o.prof]; this.profKey = o.prof;
    this.wid = team === 'A' ? 'springfield' : 'kar98zf'; this.W = WEAPONS[this.wid]; this.snd = this.W.snd;
    this.mag = this.W.mag; this.res = this.W.res;
    this.st = 'PATROL'; this.stT = 0; this.path = null; this.pi = 0; this.post = null; this.postT = 0; this.shotsHere = 0;
    this.lookY = this.yaw; this.lookP = 0; this.wantY = this.yaw; this.wantP = 0;
    this.per = new Map();           // percezione: bersaglio → { m (0..1), seen, last (V3), lastT, vel }
    this.mem = [];                  // memoria: { kind, pos, post, t, conf }
    this.tgt = null; this.reactT = 0; this.aimT = 0; this.errY = 0; this.errP = 0; this.nzY = 0; this.nzP = 0;
    this.fireCD = 0; this.reloadT = 0; this.boltT = 0; this.stance = 0; this.moveSp = 0; this.threat = 0; this.threatPos = null;
    this.lastPos = new V3(x, y, z); this.stuckT = 0; this.recent = []; this.scanT = 0; this.scanPt = null; this.shotT = -99;
    this.thinkT = R() * .4;
  }
  // morte: niente feriti in questa modalità, danni secondo la zona colpita
  damage(a, from, byPlayer, zone, imp) {
    if (!this.alive) return false;
    this.hp -= a; this.flinch = 1; this.threat = 1; this.supp = 1;
    if (from) this.feelShot(from, true);
    if (this.hp <= 0) { this.die(from, byPlayer, zone, imp); return true; }
    return false;
  }
  becomeWounded() { this.die(null, false, 'body'); }
  eyeP(out) { return out.set(this.pos.x, this.pos.y + [1.58, 1.02, .4][this.stance], this.pos.z); }

  // colpo arrivato vicino o addosso: il bot capisce la direzione approssimativa
  feelShot(from, hit) {
    const D = this.D, err = (hit ? .5 : 1) * D.hear * PI / 180, b = Math.atan2(from.x - this.pos.x, from.z - this.pos.z) + rnd(-err, err), dd = this.pos.distanceTo(from) * rnd(.8, 1.2);
    const p = new V3(this.pos.x + Math.sin(b) * dd, from.y + rnd(-1.5, 1.5), this.pos.z + Math.cos(b) * dd);
    this.threat = Math.max(this.threat, hit ? 1 : .7); this.threatPos = p;
    this.remember('shotAt', p, 1);
  }
  remember(kind, pos, conf) {
    const post = snpNearestPost(this.team === 'A' ? 'E' : 'A', pos, 9);
    const old = this.mem.find(m => m.kind === kind && (post ? m.post === post : m.pos.distanceTo(pos) < 6));
    if (old) { old.pos.copy(pos); old.t = GAME.time; old.conf = Math.max(old.conf, conf); return old; }
    const m = { kind, pos: pos.clone(), post, t: GAME.time, conf }; this.mem.push(m); if (this.mem.length > 14) this.mem.shift(); return m;
  }
  memConf(m) { return m.conf * Math.exp(-(GAME.time - m.t) / this.D.mem); }

  // ---------- percezione (al pensiero, ~3 volte al secondo) ----------
  perceive(dt) {
    const D = this.D, eye = this.eyeP(_sv1), fwdY = this.lookY, cands = snpEnemiesOf(this.team);
    for (const t of cands) {
      let r = this.per.get(t); if (!r) { r = { m: 0, seen: false, last: new V3(), lastT: -99, vel: new V3(), vis: 0 }; this.per.set(t, r); }
      const tp = snpChest(t, _sv2), dx = tp.x - eye.x, dz = tp.z - eye.z, dy = tp.y - eye.y, d = Math.hypot(dx, dz);
      const ang = Math.abs(angLerp(0, Math.atan2(-dx, -dz) - fwdY, 1)), vang = Math.abs(Math.atan2(dy, d) - this.lookP);
      const zoom = this.st === 'AIM' || this.st === 'FIRE' || this.st === 'OBSERVE' || this.st === 'SEARCH' || this.st === 'INVESTIGATE';
      let fov = ang < .2 ? 1 : ang < .9 ? lerp(1, .3, (ang - .2) / .7) : ang < 1.3 ? .12 : 0;
      if (vang > .6) fov *= .3;
      if (zoom && ang < .14) fov *= 1.6;          // nel cannocchiale si vede molto meglio
      let vis = 0;
      if (fov > 0 && d < 260) {
        const pts = snpBodyPts(t);
        for (const p of pts) if (losClear(eye, p)) vis++;
        vis /= pts.length;
      }
      r.vis = vis;
      if (vis > 0) {
        const sp = snpSpeed(t), moveK = 1 + Math.min(sp, 7) * .42, stK = snpStanceK(t), light = snpLight(t), flash = GAME.time - (t.shotT || -99) < 1.3 ? 3.2 : 1;
        const rate = D.det * vis * fov * moveK * stK * light * flash / (1 + (d / 62) ** 2);
        r.m = Math.min(1.2, r.m + rate * dt);
        if (r.m >= 1) {
          if (!r.seen) { r.seen = true; r.react = rnd(D.react[0], D.react[1]) * (this.threat > .5 ? .8 : 1); }
          r.vel.lerp(snpVel(t, _sv3), .5); r.last.copy(tp); r.lastT = GAME.time;
          this.remember('seen', tp, 1);
        } else if (r.m > .3) { this.remember('move', tp, .45 * r.m); }
      } else {
        r.m = Math.max(0, r.m - dt * (r.seen ? .35 : .5));
        if (r.seen && GAME.time - r.lastT > 1.2) { r.seen = false; }
      }
    }
    // spari uditi dalla squadra avversaria: direzione approssimativa, mai le coordinate esatte
    for (const s of SNP.sounds) {
      if (s.team === this.team || s.t <= (this.heardT || 0)) continue;
      const d = this.pos.distanceTo(s.pos); if (d > 300) continue;
      const err = D.hear * PI / 180, b = Math.atan2(s.pos.x - this.pos.x, s.pos.z - this.pos.z) + rnd(-err, err), dd = d * rnd(.78, 1.22);
      this.remember('shot', new V3(this.pos.x + Math.sin(b) * dd, s.pos.y + rnd(-2, 2), this.pos.z + Math.cos(b) * dd), .8);
      // un colpo passato vicino si sente fischiare
      if (s.near && s.near.includes(this)) this.feelShot(s.pos, false);
    }
    if (SNP.sounds.length) this.heardT = SNP.sounds[SNP.sounds.length - 1].t;
    // memoria che svanisce
    this.mem = this.mem.filter(m => this.memConf(m) > .06);
  }
  // miglior bersaglio percepito e confermato
  bestTarget() {
    let best = null, bs = 0;
    for (const [t, r] of this.per) {
      if (!r.seen || r.vis <= 0 || !snpAlive(t)) continue;
      const d = this.pos.distanceTo(t.pos), engaged = GAME.time - (t.shotT || -99) < 4 ? this.prof.engaged : 1;
      const s = r.vis * engaged * (t === this.tgt ? 1.4 : 1) / (1 + d / 120);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }

  // ---------- decisione (macchina a stati a punteggio) ----------
  think() {
    if (!this.alive || this.removed) return;
    const dt = Math.min(.8, GAME.time - (this.lastThink || GAME.time - .35)); this.lastThink = GAME.time;
    this.perceive(dt);
    const D = this.D, Pf = this.prof, t = this.bestTarget();
    this.threat = Math.max(0, this.threat - dt * .12);
    // ricarica se il caricatore è vuoto o quasi e non c'è niente da colpire
    if (this.reloadT <= 0 && this.res > 0 && (this.mag === 0 || (this.mag < 3 && !t && this.st !== 'AIM'))) { this.set('RELOAD'); this.reloadT = this.W.reload * rnd(1, 1.15); return; }
    if (this.st === 'RELOAD') return;
    // minacciato: al riparo o via dalla finestra (dipende dal profilo e dall'esperienza)
    if (this.threat > .6 && this.st !== 'TAKE_COVER' && this.st !== 'REPOSITION' && R() < Pf.flee * (.6 + this.lvl * .1)) {
      this.set('TAKE_COVER'); this.coverT = rnd(1.2, 3) * (this.profKey === 'cauto' ? 1.6 : 1); this.stance = Math.min(2, (this.post ? this.post.stance : 0) + 1); this.tgt = null; return;
    }
    if (this.st === 'TAKE_COVER') { if ((this.coverT -= dt) <= 0) this.choosePost(true); return; }
    // bersaglio visto: tempo di reazione, poi mira
    if (t && !this.moving) {
      const r = this.per.get(t);
      if (this.tgt !== t) { this.tgt = t; this.aimT = 0; this.acquire(t); }
      if (r.react > 0) { r.react -= dt; this.set('AIM', true); this.lookAt(r.last); return; }
      this.set(this.st === 'FIRE' ? 'FIRE' : 'AIM', true); return;
    }
    if (t && this.moving && this.lvl >= 3 && this.st === 'PATROL' && R() < .5) { this.path = null; this.set('AIM'); this.tgt = t; this.acquire(t); return; }
    if (this.tgt && !t) { const r = this.per.get(this.tgt); this.tgt = null; if (r && GAME.time - r.lastT < 3) { this.set('SEARCH'); this.searchPos = r.last.clone(); this.searchT = rnd(2, 4) * (Pf.scan || 1); return; } }
    if (this.st === 'SEARCH') { this.searchT -= dt; this.lookAt(this.searchPos); if (this.searchT > 0) return; if (this.lvl >= 3 && R() < .5) { this.choosePost(); return; } this.set('OBSERVE'); }
    // movimento sospetto o sparo udito: indaga verso quella zona
    const m = this.mem.filter(m => m.kind !== 'seen' || GAME.time - m.t > 2).sort((a, b) => this.memConf(b) - this.memConf(a))[0];
    if (m && this.memConf(m) > .35 && this.st !== 'INVESTIGATE' && this.st !== 'PATROL' && GAME.time - (m.seenByMe || 0) > 6) { m.seenByMe = GAME.time; this.set('INVESTIGATE'); this.invPos = m.post ? m.post.eye.clone() : m.pos.clone(); this.invT = rnd(2.5, 5) * (Pf.scan || 1); return; }
    if (this.st === 'INVESTIGATE') { this.invT -= dt; this.lookAt(this.invPos); if (this.invT > 0) return; this.set('OBSERVE'); }
    // in postazione: osserva; dopo un po' (o dopo qualche colpo) cambia posto
    if (this.st === 'OBSERVE') {
      this.postT -= dt;
      const burned = this.shotsHere >= D.moveAfter && R() < .7, danger = this.post && this.postDanger(this.post) > .7;
      if (this.postT <= 0 || burned || danger) { this.choosePost(); return; }
      return;
    }
    if (this.st === 'PATROL' && !this.path) this.choosePost();
    if (this.st === 'AIM' || this.st === 'FIRE') this.set(this.post ? 'OBSERVE' : 'PATROL');
  }
  set(s, keep) { if (this.st !== s) { this.st = s; this.stT = 0; } }
  lookAt(p) { const e = this.eyeP(_sv1); this.wantY = Math.atan2(-(p.x - e.x), -(p.z - e.z)); this.wantP = Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z)); }
  // inizio dell'acquisizione: errore iniziale che dipende da distanza, movimento e pericolo
  acquire(t) {
    const D = this.D, d = this.pos.distanceTo(t.pos), mv = snpSpeed(t) > 1 ? 1.6 : 1, me = this.moveSp > .5 ? 1.8 : 1, sup = 1 + this.threat * .8;
    const e = (D.err0 * (.55 + d / 160) * mv * me * sup) * PI / 180;
    const a = R() * TAU; this.errY = Math.cos(a) * e; this.errP = Math.sin(a) * e * .7; this.aimT = 0;
    this.aimHead = R() < D.head;
  }

  // valutazione di una postazione: copertura, esposizione, finestre nemiche "calde", varietà, distanza
  scorePost(p) {
    const D = this.D, Pf = this.prof;
    let s = p.cover * Pf.cover * 1.5 + p.expo * (Pf.expo + D.expoBias) - this.postDanger(p) * 2.2 * (1 + D.spot);
    let heat = 0; for (const id of p.sees) heat += SNP.posts[id].heat || 0;
    for (const m of this.mem) if (m.post && p.sees.includes(m.post.id)) heat += this.memConf(m) * 1.5;
    s += Math.min(3, heat) * .6 + Math.min(p.sees.length, 30) / 30;
    const mates = snpTeamBots(this.team).filter(b => b !== this && b.post);
    if (mates.some(b => b.post === p)) return -99;
    s -= mates.filter(b => b.post.L === p.L).length * .35 * Pf.floorVar;
    s -= mates.filter(b => b.post.pos.distanceTo(p.pos) < 5).length * 1.2;
    const rec = this.recent.indexOf(p.id); if (rec >= 0) s -= 2 - rec * .3;
    s -= this.pos.distanceTo(p.pos) / (40 * Pf.move);
    return s + rnd(0, 1.2);
  }
  // pericolo stimato di una postazione: nemici ricordati in finestre che la vedono, o colpi arrivati qui
  postDanger(p) {
    let d = 0;
    for (const m of this.mem) { if (!m.post) continue; if (p.sees.includes(m.post.id)) d += this.memConf(m) * (m.kind === 'shotAt' ? 1 : m.kind === 'seen' ? .8 : .4); }
    if (this.post === p && this.threat > .5) d += this.threat;
    return d;
  }
  // scelta della nuova postazione tra un campione (non tutte, ogni volta)
  choosePost(urgent) {
    const mine = SNP.posts.filter(p => p.team === this.team), cand = [];
    for (let i = 0; i < 14; i++) cand.push(pick(mine));
    let best = null, bs = -1e9;
    for (const p of cand) { const s = this.scorePost(p) + (urgent && this.post && p.L === this.post.L ? -.5 : 0) + (urgent && this.post && p.id === this.post.id ? -5 : 0); if (s > bs) { bs = s; best = p; } }
    if (!best) return;
    if (this.post) { this.post.occ = null; this.recent.unshift(this.post.id); this.recent.length = Math.min(this.recent.length, 5); }
    this.post = best; best.occ = this; this.shotsHere = 0;
    const from = snpNearestNode(this.team, this.pos), to = SNP.nav[this.team][best.node];
    this.path = from ? snpPath(this.team, from.id, to.id) : null; this.pi = 0;
    if (this.path) this.path = snpSmooth(this.team, this.path);
    if (!this.path) { this.path = null; this.set('PATROL'); return; }
    this.run = urgent || this.threat > .5; this.set(urgent ? 'REPOSITION' : 'PATROL');
  }

  // ---------- ogni fotogramma: movimento, sguardo, mira, fuoco ----------
  update(dt) {
    if (!this.alive) return;
    this.stT += dt; this.flinch = Math.max(0, this.flinch - dt * 4); this.supp = Math.max(0, this.supp - dt * .3);
    this.fireCD -= dt; this.boltT = Math.max(0, this.boltT - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const n = Math.min(this.W.mag - this.mag, this.res); this.mag += n; this.res -= n; this.set(this.post ? 'OBSERVE' : 'PATROL'); } }
    let sp = 0;
    this.prev.copy(this.pos);
    // percorso tra i nodi
    if (this.path && this.pi < this.path.length && this.st !== 'AIM' && this.st !== 'FIRE') {
      const n = SNP.nav[this.team][this.path[this.pi]], dx = n.pos.x - this.pos.x, dz = n.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < .35) { this.pi++; if (this.pi >= this.path.length) this.arrive(); }
      else {
        const nearWin = this.post && this.post.pos.distanceTo(this.pos) < 4;
        const v = (this.run ? 4.4 : nearWin ? 1.6 : 2.7) * this.speedMul;
        const step = Math.min(d, v * dt); this.pos.x += dx / d * step; this.pos.z += dz / d * step; sp = v;
        this.yaw = angLerp(this.yaw, Math.atan2(-dx, -dz), dt * 7); this.wantY = this.yaw; this.wantP = 0;
        this.stance = nearWin && this.post.stance > 0 ? 1 : 0;
      }
    }
    this.moving = sp > .3; this.moveSp = sp;
    pushOut(this.pos, .3, this.stance === 2 ? .5 : 1.6); snpClamp(this.team, this.pos);
    const gy = snpFloor(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y = gy > this.pos.y ? gy : Math.max(gy, this.pos.y - dt * 9);
    // bloccato: nuovo percorso dal nodo più vicino
    if (this.path) { this.stuckT += dt; if (this.stuckT > 2) { if (this.lastPos.distanceTo(this.pos) < .4) { this.path = null; this.choosePost(true); } this.stuckT = 0; this.lastPos.copy(this.pos); } }
    this.vel.subVectors(this.pos, this.prev).multiplyScalar(1 / Math.max(dt, 1e-3));
    // postura in postazione
    if (!this.moving && this.post && this.post.pos.distanceTo(this.pos) < 1) {
      let st = this.post.stance;
      if (this.st === 'TAKE_COVER' || this.st === 'RELOAD') st = this.post.stance === 0 ? 1 : 2;
      if (this.st === 'TAKE_COVER' && this.post.kind === 'finestra') st = 1;
      this.stance = st;
      if (this.st === 'OBSERVE' || this.st === 'PATROL' || this.st === 'REPOSITION') this.scan(dt);
    }
    // lo sguardo ruota a velocità limitata, come un mouse
    const tr = this.D.turn * (this.st === 'AIM' ? 1 : .55) * dt;
    if (this.tgt && (this.st === 'AIM' || this.st === 'FIRE')) this.trackTarget(dt);
    this.lookY += clamp(angLerp(0, this.wantY - this.lookY, 1), -tr, tr); this.lookP += clamp(this.wantP - this.lookP, -tr * .7, tr * .7);
    if (!this.moving) this.yaw = this.lookY;
    this.root.rotation.y = this.yaw;
    this.aim = clamp(this.lookP, -.6, .6);
    this.crouch = lerp(this.crouch, this.stance === 1 ? 1 : 0, dt * 6); this.prone = lerp(this.prone, this.stance === 2 ? 1 : 0, dt * 4);
    this.aimW = lerp(this.aimW, (this.st === 'AIM' || this.st === 'FIRE' || this.st === 'OBSERVE' || this.st === 'SEARCH' || this.st === 'INVESTIGATE') && !this.moving && this.reloadT <= 0 ? 1 : 0, dt * 4);
    if (this.tgt && (this.st === 'AIM' || this.st === 'FIRE')) this.aimAndFire(dt);
    const far = dist2Cam(this.pos) > 160 * 160;
    if (!far || (CROWD.frame + this.id) % 3 === 0) this.anim(far ? dt * 3 : dt, sp, 0);
  }
  arrive() { this.path = null; this.postT = rnd(this.D.dwell[0], this.D.dwell[1]) * this.prof.dwell; this.run = false; if (this.post) { this.wantY = this.post.yaw; this.wantP = 0; } this.set('OBSERVE'); }
  // osservazione: lo sguardo passa da una finestra nemica all'altra, soffermandosi su quelle sospette
  scan(dt) {
    this.scanT -= dt;
    if (this.scanT > 0 && this.scanPt) { this.lookAt(this.scanPt); return; }
    const p = this.post; if (!p || !p.sees.length) { this.scanPt = null; this.wantY = p ? p.yaw : this.yaw; return; }
    let best = null, bs = -1;
    for (const id of p.sees) { const q = SNP.posts[id]; let s = R() + (q.heat || 0) * .8; for (const m of this.mem) if (m.post === q) s += this.memConf(m) * 2; if (s > bs) { bs = s; best = q; } }
    this.scanPt = best.eye.clone().add(new V3(rnd(-1, 1), rnd(-.5, .3), 0)); this.scanT = rnd(1.4, 4) * (this.prof.scan || 1);
    this.lookAt(this.scanPt);
  }
  // inseguimento del bersaglio: punto di mira con ritardo (i più bravi anticipano il movimento)
  trackTarget(dt) {
    const t = this.tgt, r = this.per.get(t); if (!r) return;
    const tp = snpAimPoint(t, this.aimHead, _sv2);
    const v = snpVel(t, _sv3), lag = (1 - this.D.lead) * .45;
    tp.addScaledVector(v, -lag);
    this.lookAt(tp);
  }
  aimAndFire(dt) {
    const D = this.D, t = this.tgt, r = this.per.get(t);
    if (!r || !snpAlive(t)) { this.tgt = null; this.set('OBSERVE'); return; }
    if (r.react > 0) { r.react -= dt; return; }
    this.aimT += dt;
    // l'errore converge esponenzialmente; il rumore residuo cambia lentamente (mai identico)
    const k = Math.exp(-dt / D.tau); this.errY *= k; this.errP *= k;
    if (snpSpeed(t) > 1.5) { const g = (1 - D.lead) * .0035 * snpSpeed(t); this.errY += rnd(-g, g); this.errP += rnd(-g, g) * .5; }
    if (this.threat > .5) { this.errY += rnd(-.002, .002); this.errP += rnd(-.002, .002); }
    const fl = D.floor * PI / 180 * (1 + this.threat * .6);
    this.nzY = lerp(this.nzY, rnd(-fl, fl) * 1.6, dt * 1.6); this.nzP = lerp(this.nzP, rnd(-fl, fl) * 1.3, dt * 1.6);
    const turned = Math.abs(angLerp(0, this.wantY - this.lookY, 1)) < .01 && Math.abs(this.wantP - this.lookP) < .01;
    if (!turned || this.fireCD > 0 || this.boltT > 0 || this.mag <= 0 || this.reloadT > 0 || r.vis <= 0) return;
    // stima della probabilità di colpire: errore attuale contro la sagoma visibile
    const d = this.pos.distanceTo(t.pos), size = (this.aimHead ? .12 : .23) / d, err = Math.hypot(this.errY, this.errP) + fl;
    const want = size * D.thr * this.prof.thr * (1 + Math.min(this.aimT, 6) * .08);
    if (err > want && this.aimT < 5 + D.tau * 4) return;
    this.shoot();
  }
  shoot() {
    const t = this.tgt, from = this.eyeP(_sv1).clone(); from.y -= .05;
    const dir = new V3(-Math.sin(this.lookY + this.errY + this.nzY) * Math.cos(this.lookP + this.errP + this.nzP), Math.sin(this.lookP + this.errP + this.nzP), -Math.cos(this.lookY + this.errY + this.nzY) * Math.cos(this.lookP + this.errP + this.nzP)).normalize();
    this.mag--; this.fireCD = this.W.rate; this.boltT = this.mag > 0 ? this.W.rate : 0; this.shotsHere++; this.set('FIRE');
    const hit = snpTrace(from, dir, this.W.range, this.team), end = from.clone().addScaledVector(dir, hit.t);
    sfxShot(this.snd, from); if (dist2Cam(from) < 180 * 180) fxMuzzle(this.muzzle(T1), dir, false);
    snpShotSound(from, this.team, this);
    snpNearMiss(from, end, this.team, hit.obj);
    if (NET.host) netAIShot(this, from, end, false);
    if (hit.type === 'player') {
      const dm = snpDamage(this.W, hit.zone); SNP.killBy = { name: this.name, team: this.team, zone: hit.zone }; P.damage(dm, from);
    } else if (hit.type === 'soldier') {
      const e = hit.obj, dm = snpDamage(this.W, hit.zone); e.lastHit = this;
      if (dist2Cam(end) < 130 * 130) bloodHit(end.clone(), dir, hit.zone === 'head' ? 1.4 : 1);
      SNP.hitBy = this.name; e.damage(dm, from, false, hit.zone, { dir, power: 2.6, joint: hit.joint }); SNP.hitBy = null;
    } else if (hit.t < this.W.range - 1) {
      if (dist2Cam(end) < 160 * 160) { fxImpact(end, hit.type === 'terrain' ? 'dirt' : 'stone'); if (dist2Cam(end) < 25 * 25) { sfxImpact(end, 'sand'); if (R() < .2) sfxRicochet(end); } }
    }
    // dopo il colpo: se manca, a volte riprova; altrimenti valuta di spostarsi
    if (!(hit.type === 'player' || hit.type === 'soldier')) { const e = this.D.err0 * .4 * PI / 180; this.errY = rnd(-e, e); this.errP = rnd(-e, e) * .6; this.aimT = 0; }
  }
}
const _sv1 = new V3(), _sv2 = new V3(), _sv3 = new V3();

// ---------- utilità di percezione ----------
function snpEnemiesOf(team) { const l = (team === 'A' ? enemies : allies).filter(s => s.alive && !s.removed); if (PT !== team && P.targetable()) l.push(P); return l; }
function snpTeamBots(team) { return (team === 'A' ? allies : enemies).filter(s => s.snp && s.alive && !s.removed); }
function snpAlive(t) { return t === P ? P.targetable() : t.alive && !t.removed; }
function snpChest(t, out) { return t === P ? P.chest(out) : t.chest(out); }
function snpAimPoint(t, head, out) { if (t === P) return head ? out.set(P.pos.x, P.pos.y + [1.55, 1.0, .3][P.stance], P.pos.z) : P.chest(out); return head ? t.head(out) : t.chest(out); }
function snpBodyPts(t) {
  if (t === P) { const s = snpPlayerSpheres(); return [s[0][0], s[1][0], s[3][0]]; }
  const p = t.pos, pr = t.prone > .5, cr = t.crouch > .5;
  return [new V3(p.x, p.y + (pr ? .35 : cr ? 1.05 : 1.55), p.z), new V3(p.x, p.y + (pr ? .25 : cr ? .78 : 1.2), p.z), new V3(p.x, p.y + (pr ? .18 : cr ? .4 : .6), p.z)];
}
function snpSpeed(t) { return t === P ? Math.hypot(P.vel.x, P.vel.z) : Math.hypot(t.vel.x, t.vel.z); }
function snpVel(t, out) { return t === P ? out.set(P.vel.x, 0, P.vel.z) : out.set(t.vel.x, 0, t.vel.z); }
function snpStanceK(t) { const st = t === P ? P.stance : t.prone > .5 ? 2 : t.crouch > .5 ? 1 : 0; return [1, .7, .42][st]; }
// luce: chi sta in fondo alla stanza, nell'ombra, si vede meno di chi è affacciato
function snpLight(t) {
  const team = t === P ? PT : t.team, l = snpL(team, t.pos.x, t.pos.z);
  const roof = t.pos.y > SNP.G + 3 * SNP.FH - .3;
  return roof ? 1 : l.v < 1.6 ? 1 : l.v < 4 ? .7 : .45;
}
function snpNearestPost(team, p, maxD) { let best = null, bd = maxD * maxD; for (const q of SNP.posts) { if (q.team !== team) continue; const d = q.eye.distanceToSquared(p); if (d < bd) { bd = d; best = q; } } return best; }
// colpo passato vicino: i bersagli lo sentono fischiare
function snpNearMiss(from, end, team, hitObj) {
  const s = SNP.sounds[SNP.sounds.length - 1]; if (!s) return;
  s.near = [];
  for (const b of snpTeamBots(team === 'A' ? 'E' : 'A')) { if (b === hitObj) continue; if (closestOnSeg(from, end, b.chest(_sv3)) < 2.5) s.near.push(b); }
  if (PT !== team && hitObj !== P && P.targetable() && closestOnSeg(from, end, P.pos) < 3) P.nearMiss(from, end);
}
