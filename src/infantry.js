"use strict";
// ============================================================
//  INFANTRY COMBAT AI 3.0 — tre livelli sopra l'IA esistente dei soldati (src/soldier.js), senza sostituirla:
//  A) direttore di battaglia: rapporto di forze e morale per fazione → atteggiamento (attacco, tenuta, ripiegamento);
//  B) squadre: formazione automatica (4–6 soldati vicini), comandante con successione, memoria condivisa entro il
//     raggio della voce, stati HOLD/ADVANCE/SUPPRESS/FLANK/WITHDRAW/REGROUP, fuoco di soppressione sull'ultima posizione
//     nota, fiancheggiamento solo se esiste un riparo raggiungibile e non visto dal nemico, ripiegamento;
//  C) soldato: percezione (cono visivo, tempo di individuazione, udito degli spari, memoria che decade), tempo di
//     reazione prima del primo colpo, soppressione dai colpi vicini (anche diretti ad altri), stato inchiodato, morale.
//  Le decisioni girano a frequenze diverse: percezione con il ciclo «think» esistente (0,3–1,4 s), squadre a 1 Hz
//  (0,33 Hz lontano dalla camera), direttore ogni 3 s. Sui client in rete i soldati sono marionette: tutto questo gira
//  solo dove gira l'IA (host o partita in solitario).
// ============================================================
const INF = {
  squads: [], formT: 0, dirT: 0, dir: { A: { mode: 'hold', ratio: 1 }, E: { mode: 'hold', ratio: 1 } }, noise: [],
  st: { spotted: 0, heard: 0, lost: 0, flanks: 0, flankAbort: 0, supFire: 0, pinned: 0, withdraw: 0, routed: 0, succession: 0, shared: 0, reactDelay: 0 },
  CFG: { fovCos: .17, near: 12, spotRate: 1.6, memTime: 14, hearR: 140, squadMax: 6, squadR: 26, voiceR: 50, flankCD: 70, flankDist: 34 },
  debug: false,
};
const MORALE_ST = [[.7, 'CONFIDENT'], [.5, 'STEADY'], [.3, 'SHAKEN'], [.15, 'DISORGANIZED'], [-1, 'ROUTED']];
const moraleName = m => MORALE_ST.find(([k]) => m > k)[1];
const _iA = new V3(), _iB = new V3(), _iC = new V3();
const infOk = s => s && s.alive && !s.removed && s.state !== 'boat' && !s.remote && !s.proxy && !s.wounded && !s.vip;
const infFoes = team => SCEN === 'tun' && typeof TUN !== 'undefined' && TUN.ffa ? enemies : team === 'A' ? enemies : allies;

// ---------- C) percezione e memoria ----------
// rapidità con cui un bersaglio viene notato: chi corre allo scoperto o spara si vede subito, chi è fermo, basso e al riparo molto meno
function infConspic(t, d) {
  let k = INF.CFG.spotRate * clamp(70 / Math.max(8, d), .25, 2.5);
  if (t === P) { k *= P.stance >= 2 ? .35 : P.stance >= 1 ? .6 : 1; if (P.vel && P.vel.lengthSq() > 4) k *= 1.6; if (GAME.time - (P.lastShotT || -9) < 1.5) k *= 2.5; }
  else { if (t.prone > .5) k *= .35; else if (t.crouch > .5) k *= .6; if (t.moving) k *= 1.6; if (t.state === 'cover' || t.inTrench) k *= .7; if (t.inBunker) k *= .5; if (GAME.time - (t.lastShotT || -9) < 1.5) k *= 2.5; }
  return k;
}
function infRemember(s, t, p, conf, src) {
  if (!s.mem) s.mem = new Map();
  const m = s.mem.get(t);
  if (m && m.conf > conf && GAME.time - m.t < 2) return;
  if (m) { m.p.copy(p); m.t = GAME.time; m.conf = Math.max(conf, m.conf * .5); m.src = src; } else s.mem.set(t, { p: p.clone(), t: GAME.time, conf, src });
}
Soldier.prototype.findTarget = function () {
  const r = this.w.range, me = this.pos, C = INF.CFG, cands = [];
  const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
  for (const o of infFoes(this.team)) {
    if (!o.alive || o.state === 'boat' || o.flee || o.removed || o === this) continue;
    const dx = o.pos.x - me.x, dz = o.pos.z - me.z, d2 = dx * dx + dz * dz;
    if (d2 > r * r) continue;
    const d = Math.sqrt(d2), inCone = d < C.near || (dx * fx + dz * fz) / (d || 1) > C.fovCos;
    if (inCone) cands.push([o, o.spotT > 0 && this.team === PT ? d2 * .15 : d2, d]);
  }
  if (this.team !== PT && P.targetable()) { const dx = P.pos.x - me.x, dz = P.pos.z - me.z, d2 = dx * dx + dz * dz, d = Math.sqrt(d2); if (d2 < r * r && (d < C.near || (dx * fx + dz * fz) / (d || 1) > C.fovCos)) cands.push([P, d2 * .5, d]); }
  cands.sort((a, b) => a[1] - b[1]);
  const had = this.target, hadVis = this.tVis;
  this.target = null; this.tVis = false; this.vis.length = 0;
  if (!this.spot) this.spot = new Map();
  const eye = this.eye(T1), nTest = this.kind === 'mg' ? 5 : 2;
  for (let i = 0; i < Math.min(nTest, cands.length); i++) {
    const [c, , d] = cands[i];
    if (!losClear(eye, c.chest(T2))) { this.spot.delete(c); continue; }
    // individuazione progressiva: serve un po' di tempo per «vedere» un soldato immobile e basso
    const v = Math.min(1.2, (this.spot.get(c) || 0) + this.thinkDt * infConspic(c, d)); this.spot.set(c, v);
    if (v < 1 && !(this.mem && this.mem.get(c) && GAME.time - this.mem.get(c).t < 3)) continue;
    if (v >= 1 && !(this.mem && this.mem.get(c))) INF.st.spotted++;
    infRemember(this, c, c.pos, 1, 'vista');
    this.vis.push(c); if (!this.target) { this.target = c; this.tVis = true; }
  }
  // memoria: decade col tempo; i nemici non più visti restano come «ultima posizione nota», mai seguiti attraverso i muri
  if (this.mem) for (const [k, m] of this.mem) { const al = k === P ? !P.dead : k.alive && !k.removed; if (!al || GAME.time - m.t > C.memTime) { this.mem.delete(k); if (al) INF.st.lost++; } }
  this.watchP = null;
  if (!this.target && this.mem && this.mem.size) { let bm = null; for (const m of this.mem.values()) if (!bm || m.conf * (1 - (GAME.time - m.t) / C.memTime) > bm.conf * (1 - (GAME.time - bm.t) / C.memTime)) bm = m; if (bm) this.watchP = bm.p; }
  // fuoco di soppressione ordinato dalla squadra sull'ultima posizione nota
  if (!this.target && this.supOrder && this.supOrder.until > GAME.time) { this.target = this.supOrder.t; this.tVis = true; INF.st.supFire++; }
  if (!this.target && this.team === 'E') {
    const bs = WORLD.boats.filter(b => b.state === 'move' && b.z < 230 && Math.abs(b.x - me.x) < 130);
    if (bs.length) { this.target = { isBoat: true, b: pick(bs), chest: function (o) { const g = this.b.g.position; return o.set(g.x + rnd(-1.4, 1.4), g.y + rnd(.6, 2), g.z - 5 + rnd(-.3, 2)); } }; this.tVis = true; }
  }
  // tempo di reazione: un nuovo bersaglio non viene colpito nello stesso istante in cui lo si vede
  if (this.tVis && this.target !== had && !this.target.isBoat && !this.target.isSupp) { const r2 = rnd(.35, .9) * (this.morale !== undefined && this.morale < .5 ? 1.5 : 1); if (this.fireT < r2) { this.fireT = r2; INF.st.reactDelay++; } }
  if (this.tVis && this.target !== had && this.shoutT <= 0 && dist2Cam(this.pos) < 70 * 70) {
    this.shoutT = rnd(10, 25);
    if (this.team === 'E') shout('de', R() < .5 ? 'spot' : 'fire', this.pos);
    else shout('en', R() < .5 ? 'cover' : 'move', this.pos);
  }
};
// udito: ogni sparo lascia una posizione approssimata (errore proporzionale alla distanza) a chi lo sente
function infHear(src, p, loud) {
  const R2 = (INF.CFG.hearR * loud) ** 2;
  for (const s of infFoes(src.team === 'A' || src === P && PT === 'A' ? 'A' : 'E')) {
    if (!infOk(s)) continue; const dx = s.pos.x - p.x, dz = s.pos.z - p.z, d2 = dx * dx + dz * dz; if (d2 > R2 || d2 < 1) continue;
    const m = s.mem && s.mem.get(src); if (m && GAME.time - m.t < 1.5) continue;
    const e = Math.sqrt(d2) * .12; infRemember(s, src, _iA.set(p.x + rnd(-e, e), p.y, p.z + rnd(-e, e)), .45, 'udito'); INF.st.heard++;
    if (s.supp !== undefined && d2 < 400) s.supp = Math.min(1, s.supp + .05);
  }
}
// soppressione: un colpo che passa o cade vicino a un soldato lo spaventa anche se era diretto ad altri; la MG più del fucile
function infSuppressAt(team, p, amt) {
  for (const s of team === 'A' ? allies : enemies) {
    if (!infOk(s) || s.supp === undefined) continue; const dx = s.pos.x - p.x, dz = s.pos.z - p.z; if (dx * dx + dz * dz > 9) continue;
    s.supp = Math.min(1, s.supp + amt * (1 - Math.sqrt(dx * dx + dz * dz) / 3));
  }
}
(function infHooks() {
  const f0 = Soldier.prototype.fire;
  Soldier.prototype.fire = function () {
    this.lastShotT = GAME.time;
    const t = this.target;
    f0.apply(this, arguments);
    // T3 contiene il punto d'arrivo del colpo calcolato da fire()
    if (t && !t.isBoat) infSuppressAt(this.team === 'A' ? 'E' : 'A', T3, this.kind === 'mg' ? .3 : this.kind === 'bar' ? .22 : .15);
    if ((AI_FRAME + this.id) % 3 === 0) infHear(this, this.pos, this.kind === 'mg' ? 1.5 : 1);
    if (this.morale !== undefined && this.morale < .5) this.fireT *= 1.35;   // morale basso: tiro esitante
    if (t && t.isSupp) { if (this.burst > 0) this.fireT *= 1.6; else this.fireT *= 2.2; }   // soppressione: raffiche più rade, per tenere giù la testa al nemico
  };
})();

// ---------- B) squadre ----------
const ROLE_PREF = { smg: 0, rifle: 1, bar: 2, sniper: 3, mg: 4, medic: 5 };
function infLeaderPick(q) { let best = null; for (const s of q.m) if (infOk(s) && (!best || ROLE_PREF[s.kind] < ROLE_PREF[best.kind] || (ROLE_PREF[s.kind] === ROLE_PREF[best.kind] && s.id < best.id))) best = s; return best; }
function infForm() {
  if (SCEN === 'tun' && typeof TUN !== 'undefined' && TUN.ffa) { INF.squads.length = 0; return; }   // tutti contro tutti: niente squadre
  for (const q of INF.squads) q.m = q.m.filter(s => infOk(s));
  INF.squads = INF.squads.filter(q => q.m.length);
  const C = INF.CFG;
  for (const L of [allies, enemies]) for (const s of L) {
    if (!infOk(s) || s.squadQ || s.squad || s.inBunker || s.role || s.flee) continue;   // la squadra del giocatore resta agli ordini del giocatore
    // si unisce a una squadra vicina non piena, altrimenti ne forma una nuova
    let q = null, bd = C.squadR * C.squadR;
    for (const o of INF.squads) { if (o.team !== s.team || o.m.length >= C.squadMax || !o.lead) continue; const d2 = o.lead.pos.distanceToSquared(s.pos); if (d2 < bd) { bd = d2; q = o; } }
    if (!q) { q = { id: INF.squads.length + 1 + (INF.idN = (INF.idN || 0) + 1) * 1000, team: s.team, m: [], lead: null, state: 'HOLD', stT: 0, contact: null, flankT: -999, flankers: [], losses: 0, size0: 0, tick: R(), supT: null }; INF.squads.push(q); }
    q.m.push(s); s.squadQ = q; q.size0 = Math.max(q.size0, q.m.length); if (s.morale === undefined) { s.grit = rnd(.8, 1.2); s.morale = clamp(rnd(.62, .85), 0, 1); }
    if (!q.lead) q.lead = s;
  }
  for (const q of INF.squads) { const l = infLeaderPick(q); if (q.lead !== l) q.lead = l; }
}
function infSetState(q, st) { if (q.state === st) return; q.state = st; q.stT = 0; }
function infSquadTick(q, dt) {
  q.stT += dt;
  // perdite e successione del comando
  const alive = q.m.filter(infOk);
  const dead = q.m.length - alive.length; if (dead > 0) { q.losses += dead; for (const s of alive) s.morale -= .12 * dead; q.m = alive; }
  if (!alive.length) return;
  if (!q.lead || !infOk(q.lead)) { const nl = infLeaderPick(q); if (q.lead && nl) { INF.st.succession++; for (const s of alive) s.morale -= .15; if (dist2Cam(nl.pos) < 70 * 70) shout(q.team === 'E' ? 'de' : 'en', 'move', nl.pos); } q.lead = nl; }
  const L = q.lead;
  // memoria condivisa entro il raggio della voce del comandante (niente rete telepatica tra squadre)
  let best = null, bs = 0;
  for (const s of alive) { if (!s.mem) continue; for (const [k, m] of s.mem) { const sc = m.conf * (1 - (GAME.time - m.t) / INF.CFG.memTime); if (sc > bs) { bs = sc; best = [k, m]; } } }
  if (best) for (const s of alive) { if (s === L || s.pos.distanceToSquared(L.pos) < INF.CFG.voiceR ** 2) { const own = s.mem && s.mem.get(best[0]); if (!own || own.t < best[1].t - 1) { infRemember(s, best[0], best[1].p, best[1].conf * .8, 'squadra'); INF.st.shared++; } } }
  const hadContact = !!q.contact;
  q.contact = best && bs > .2 ? { t: best[0], p: best[1].p.clone(), conf: bs } : null;
  if (q.contact && !hadContact && L && dist2Cam(L.pos) < 70 * 70) shout(q.team === 'E' ? 'de' : 'en', 'spot', L.pos, { priority: true });
  if (q.contact) { if (!q.cStart) q.cStart = GAME.time; if (!q.cPos) q.cPos = q.contact.p.clone(); else if (q.cPos.distanceTo(q.contact.p) > 8) { q.cPos.copy(q.contact.p); q.cStart = GAME.time; } } else { q.cStart = 0; q.cPos = null; }
  // morale: fuoco, perdite, isolamento, riparo, comandante vicino; recupero lento in calma
  let msum = 0;
  for (const s of alive) {
    let d = 0; const near = alive.some(o => o !== s && o.pos.distanceToSquared(s.pos) < 400), lp = L && s.pos.distanceToSquared(L.pos) < 900;
    d -= s.supp * .05; if (!near) d -= .015; if (s.cover || s.inTrench) d += .008; if (lp) d += .01; if (s.supp < .1 && !q.contact) d += .03; if (s.supp < .2) d += .01;
    d -= INF.dir[q.team].mode === 'withdraw' ? .01 : 0;
    s.morale = clamp(s.morale + d * dt * (d < 0 ? 1 / (s.grit || 1) : (s.grit || 1)), 0, 1); msum += s.morale;
    // stato inchiodato: fuoco molto intenso, niente tiro per qualche secondo
    if (s.supp > .85 && !s.pinned) { s.pinned = GAME.time + rnd(2, 4); INF.st.pinned++; }
    if (s.pinned && GAME.time > s.pinned) s.pinned = 0;
    // in rotta: abbandona la posizione verso un riparo lontano dal nemico; si riprende lontano dal fuoco
    if (s.morale < .15 && !s.routed && q.contact && !s.stationary) { s.routed = true; INF.st.routed++; infFallback(s, q.contact.p, 25); }
    if (s.routed && s.morale > .4) s.routed = false;
  }
  q.morale = msum / alive.length;
  if (!L) return;
  const pinnedN = alive.filter(s => s.pinned).length, mob = alive.filter(s => !s.stationary && !s.inTrench && !s.squad);
  // ---- decisione del comandante ----
  if (q.state === 'FLANK') { infFlankTick(q, alive); return; }
  if (q.state === 'WITHDRAW') { if (q.stT > 20 && q.morale > .45) infSetState(q, 'REGROUP'); return; }
  if ((q.morale < .28 || q.losses >= Math.max(2, q.size0 * .6)) && q.contact && mob.length) {
    infSetState(q, 'WITHDRAW'); INF.st.withdraw++; for (const s of mob) infFallback(s, q.contact.p, 30); if (dist2Cam(L.pos) < 80 * 80) shout(q.team === 'E' ? 'de' : 'en', 'cover', L.pos, { priority: true }); return;
  }
  if (q.contact) {
    // fuoco di soppressione: mitragliatrice, BAR e un fuciliere tengono la posizione nemica anche senza vederla
    infSetState(q, 'SUPPRESS');
    // solo armi automatiche (o un fuciliere se la squadra non ne ha) e solo su un contatto recente
    let base = alive.filter(s => s.kind === 'mg' || s.kind === 'bar'); if (!base.length) base = alive.filter(s => s.kind === 'rifle').slice(0, 1);
    const fresh = best && GAME.time - best[1].t < 6; if (!fresh) base = [];
    if (!q.supT) q.supT = { isSupp: true, alive: true, pos: new V3(), crouch: 0, chest(o) { return o.set(this.pos.x + rnd(-1.8, 1.8), this.pos.y + .9, this.pos.z + rnd(-1.8, 1.8)); } };
    q.supT.pos.copy(q.contact.p); q.supT.pos.y = Hf(q.supT.pos.x, q.supT.pos.z);
    for (const s of base) if (s.pos.distanceTo(q.supT.pos) < s.w.range * .9 && !s.pinned && s.morale > .3) s.supOrder = { t: q.supT, until: GAME.time + 4 };
    // fiancheggiamento: posizione nemica ferma da un po', squadra abbastanza numerosa e salda, nessun inchiodato
    if (q.cStart && GAME.time - q.cStart > 10 && GAME.time - q.flankT > INF.CFG.flankCD) {
      const why = INF.dir[q.team].mode === 'withdraw' ? 'direttore' : mob.length < 3 ? 'pochi mobili' : alive.length < 4 ? 'pochi vivi' : q.morale < .45 ? 'morale' : pinnedN * 2 >= alive.length ? 'inchiodati' : '';
      if (why) { INF.st.noFlank = INF.st.noFlank || {}; INF.st.noFlank[why] = (INF.st.noFlank[why] || 0) + 1; } else infTryFlank(q, alive, mob);
    }
  } else {
    infSetState(q, q.state === 'WITHDRAW' || q.state === 'REGROUP' ? 'REGROUP' : 'HOLD');
    // riunione: chi si è allontanato troppo dal comandante, senza ordini di posto, torna verso di lui
    if (q.state === 'REGROUP') { for (const s of mob) if (!s.dest && s.pos.distanceTo(L.pos) > 30 && s.team !== 'A') { s.dest = new V3(L.pos.x + rnd(-6, 6), 0, L.pos.z + rnd(-6, 6)); s.state = 'move'; } if (q.stT > 15) infSetState(q, 'HOLD'); }
  }
}
// riparo più lontano dal nemico (ripiegamento o rotta); mai attraverso il nemico
function infFallback(s, threat, minGain) {
  const d0 = Math.hypot(s.pos.x - threat.x, s.pos.z - threat.z); let best = null, bs = -1e9;
  for (const c of covers) { if (c.occ >= 2) continue; const dd = Math.hypot(c.x - s.pos.x, c.z - s.pos.z); if (dd > 55 || dd < 4) continue; const dt = Math.hypot(c.x - threat.x, c.z - threat.z); if (dt < d0 + minGain * .5) continue; const sc = dt - dd * .6 + (COVER_Q[c.kind] || 2) * 2; if (sc > bs) { bs = sc; best = c; } }
  if (s.cover) { s.cover.occ--; s.cover = null; }
  if (best) { best.occ++; s.cover = best; s.dest = new V3(best.x + rnd(-.4, .4), 0, best.z + rnd(-.3, .3)); }
  else { const dx = s.pos.x - threat.x, dz = s.pos.z - threat.z, d = Math.hypot(dx, dz) || 1; s.dest = new V3(s.pos.x + dx / d * minGain, 0, s.pos.z + dz / d * minGain); }
  s.state = 'move'; s.crouchRun = true; s.stationary = false; s.wait = rnd(4, 8);
}
// fiancheggiamento: un punto a lato della posizione nemica, con un riparo vicino, non visibile dal nemico e raggiungibile
function infTryFlank(q, alive, mob) {
  const E = q.contact.p, L = q.lead, cx = alive.reduce((a, s) => a + s.pos.x, 0) / alive.length, cz = alive.reduce((a, s) => a + s.pos.z, 0) / alive.length;
  const dx = E.x - cx, dz = E.z - cz, d = Math.hypot(dx, dz) || 1, px = -dz / d, pz = dx / d;
  if (d < 20 || d > 160) return;
  let pick = null, ps = -1e9;
  for (const side of [-1, 1]) for (const fd of [25, 35, 45]) {
    const fx = E.x + px * side * fd - dx / d * 10, fz = E.z + pz * side * fd - dz / d * 10;
    if (pointInSolid(_iA.set(fx, Hf(fx, fz) + 1, fz)) || Hf(fx, fz) < WATER_Y + .2 || (typeof inMinefield === 'function' && inMinefield(fx, fz))) continue;
    let cv = null, cd = 144;
    for (const c of covers) { if (c.occ >= 2) continue; const dd = (c.x - fx) ** 2 + (c.z - fz) ** 2; if (dd < cd) { cd = dd; cv = c; } }
    if (!cv) continue;   // senza un riparo sul fianco la manovra non si tenta
    const hid = !losClear(_iB.set(E.x, Hf(E.x, E.z) + 1.5, E.z), _iC.set(cv.x, Hf(cv.x, cv.z) + 1.2, cv.z));
    // percorso: affidato alla navigazione esistente (aggira gli edifici); scartati i ripari troppo lontani o dentro i solidi
    const pl = Math.hypot(cv.x - cx, cv.z - cz); if (pl > 80 || pointInSolid(_iA.set(cv.x, Hf(cv.x, cv.z) + 1, cv.z))) continue;
    const sc = (hid ? 20 : 0) - pl * .2 - Math.abs(fd - 35) * .1;
    if (sc > ps) { ps = sc; pick = cv; }
  }
  q.flankT = GAME.time;
  if (!pick) { INF.st.noFlank = INF.st.noFlank || {}; INF.st.noFlank['nessun fianco praticabile'] = (INF.st.noFlank['nessun fianco praticabile'] || 0) + 1; return; }
  const fl = mob.filter(s => s !== L && s.kind !== 'mg' && s.kind !== 'bar' && !s.pinned).slice(0, 2);
  if (fl.length < 1) return;
  for (const s of fl) { if (s.cover) { s.cover.occ--; } pick.occ++; s.cover = pick; s.dest = new V3(pick.x + rnd(-1, 1), 0, pick.z + rnd(-1, 1)); s.state = 'move'; s.crouchRun = true; s.stationary = false; s.flankUntil = GAME.time + 45; s.wait = rnd(6, 10); }
  q.flankers = fl; infSetState(q, 'FLANK'); INF.st.flanks++;
  if (dist2Cam(L.pos) < 80 * 80) shout(q.team === 'E' ? 'de' : 'en', 'move', L.pos, { priority: true });
}
function infFlankTick(q, alive) {
  const fl = q.flankers.filter(infOk);
  // interrotta se i fiancheggiatori sono inchiodati o colpiti; conclusa all'arrivo o allo scadere
  if (fl.length < q.flankers.length || fl.every(s => s.pinned)) { INF.st.flankAbort++; for (const s of fl) { s.flankUntil = 0; if (q.contact) infFallback(s, q.contact.p, 8); } q.flankers = []; infSetState(q, 'SUPPRESS'); return; }
  if (!fl.length || fl.every(s => !s.dest) || q.stT > 45) { for (const s of fl) s.flankUntil = 0; q.flankers = []; infSetState(q, q.contact ? 'SUPPRESS' : 'HOLD'); }
}

// ---------- A) direttore di battaglia ----------
function infDirector() {
  for (const tm of ['A', 'E']) {
    const mine = (tm === 'A' ? allies : enemies).filter(infOk), foe = (tm === 'A' ? enemies : allies).filter(infOk);
    const mor = mine.length ? mine.reduce((a, s) => a + (s.morale ?? .7), 0) / mine.length : 0, ratio = mine.length / Math.max(1, foe.length), D2 = INF.dir[tm];
    D2.ratio = ratio; D2.morale = mor; D2.n = mine.length;
    D2.mode = mor < .3 && ratio < .6 ? 'withdraw' : ratio > 1.4 && mor > .55 ? 'attack' : 'hold';
  }
}
// ---------- ciclo ----------
function updateInfantry(dt) {
  if (NET.client) return;
  const t0 = performance.now();
  if ((INF.formT -= dt) <= 0) { INF.formT = 3; infForm(); }
  if ((INF.dirT -= dt) <= 0) { INF.dirT = 3; infDirector(); }
  for (const q of INF.squads) {
    q.tick -= dt; if (q.tick > 0) continue;
    const far = !q.lead || dist2Cam(q.lead.pos) > 300 * 300; q.tick = far ? 3 : 1;
    infSquadTick(q, q.tick);
  }
  if (INF.debug) infDebugDraw();
  INF.ms = (INF.ms || 0) * .95 + (performance.now() - t0) * .05;
}
INF.report = () => { const s = INF.st, m = {}; for (const L of [allies, enemies]) for (const x of L) if (infOk(x) && x.morale !== undefined) { const k = moraleName(x.morale); m[k] = (m[k] || 0) + 1; }
  const qs = {}; for (const q of INF.squads) qs[q.state] = (qs[q.state] || 0) + 1;
  return `squadre ${INF.squads.length} ${JSON.stringify(qs)} · morale ${JSON.stringify(m)} · avvistati ${s.spotted} · sentiti ${s.heard} · contatti persi ${s.lost} · condivisi ${s.shared} · ritardi di reazione ${s.reactDelay} · soppressione su posizione nota ${s.supFire} · inchiodati ${s.pinned} · fiancheggiamenti ${s.flanks} (interrotti ${s.flankAbort}, rinunce ${JSON.stringify(s.noFlank || {})}) · ripiegamenti ${s.withdraw} · in rotta ${s.routed} · successioni ${s.succession} · ${(INF.ms || 0).toFixed(3)} ms`; };

// ---------- debug (Ctrl+Maiusc+I): stato, squadra, morale, soppressione, ultima posizione nota, legami col comandante ----------
const INF_COL = { HOLD: '#9fd0ff', SUPPRESS: '#ffcf5a', FLANK: '#ff8a3d', WITHDRAW: '#ff5050', REGROUP: '#c58bff' };
function infDebugDraw() {
  if (!INF.dbg) {
    INF.dbg = { labels: [], root: document.createElement('div') }; INF.dbg.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;font:600 10px/1.2 monospace'; document.body.appendChild(INF.dbg.root);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 400), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6 * 400), 3));
    INF.dbg.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); INF.dbg.lines.frustumCulled = false; INF.dbg.lines.renderOrder = 999; scene.add(INF.dbg.lines);
  }
  const D = INF.dbg; D.root.style.display = 'block'; D.lines.visible = true;
  if ((D.t = (D.t || 0) + 1) % 6) return;
  const pa = D.lines.geometry.attributes.position.array, ca = D.lines.geometry.attributes.color.array; let n = 0, li = 0;
  const seg = (a, b, r, g, bb) => { if (n >= 400) return; pa.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6); ca.set([r, g, bb, r, g, bb], n * 6); n++; };
  for (const q of INF.squads) { const L = q.lead; if (!L || dist2Cam(L.pos) > 90 * 90) continue; for (const s of q.m) { if (!infOk(s)) continue; if (s !== L) seg(_iA.copy(L.pos).setY(L.pos.y + 2), _iB.copy(s.pos).setY(s.pos.y + 1.8), .4, .7, 1); if (s.watchP) seg(_iA.copy(s.pos).setY(s.pos.y + 1.5), s.watchP, 1, .3, .3); if (s.cover) seg(_iA.copy(s.pos).setY(s.pos.y + .2), _iB.set(s.cover.x, Hf(s.cover.x, s.cover.z) + .2, s.cover.z), .3, 1, .4); } }
  D.lines.geometry.setDrawRange(0, n * 2); D.lines.geometry.attributes.position.needsUpdate = D.lines.geometry.attributes.color.needsUpdate = true;
  for (const q of INF.squads) for (const s of q.m) {
    if (!infOk(s) || dist2Cam(s.pos) > 60 * 60) continue;
    _iA.set(s.pos.x, s.pos.y + 2.2, s.pos.z).project(camera); if (_iA.z > 1) continue;
    let el = D.labels[li]; if (!el) { el = D.labels[li] = document.createElement('div'); el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);white-space:nowrap;text-shadow:0 1px 2px #000;text-align:center'; D.root.appendChild(el); }
    el.style.display = 'block'; el.style.left = ((_iA.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-_iA.y * .5 + .5) * innerHeight) + 'px'; el.style.color = INF_COL[q.state] || '#fff';
    el.textContent = `${q.team}${q.id % 1000}${s === q.lead ? '★' : ''} ${q.state} ${s.state}${s.pinned ? ' INCHIODATO' : ''}${s.routed ? ' ROTTA' : ''} · ${moraleName(s.morale)} ${Math.round(s.morale * 100)} · sopp ${Math.round(s.supp * 100)}${s.tVis ? ' · vede' : s.watchP ? ' · ricorda' : ''}`; li++;
  }
  for (let i = li; i < D.labels.length; i++) D.labels[i].style.display = 'none';
}
addEventListener('keydown', e => { if (e.code === 'KeyI' && e.ctrlKey && e.shiftKey) { e.preventDefault(); INF.debug = !INF.debug; if (!INF.debug && INF.dbg) { INF.dbg.root.style.display = 'none'; INF.dbg.lines.visible = false; } } });
