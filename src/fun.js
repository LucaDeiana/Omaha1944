"use strict";
// ============================================================
//  Punteggio, uccisioni multiple e serie di uccisioni:
//  ogni azione dà punti con un riquadro a schermo; le serie
//  senza morire sbloccano supporto aereo, rifornimento e uno
//  sbarramento navale. Il record personale resta salvato.
// ============================================================
const FUN = { score: 0, streak: 0, best: 0, multi: 0, multiT: 0, wasDead: false, pops: [], rewards: {} };

function initFun() {
  FUN.score = 0; FUN.streak = 0; FUN.multi = 0; FUN.multiT = 0;
  try { FUN.best = +localStorage.getItem('omahaBest') || 0; } catch (e) { FUN.best = 0; }
  let box = $('scorePop');
  if (!box) {
    box = document.createElement('div'); box.id = 'scorePop';
    box.style.cssText = 'position:fixed;left:50%;top:58%;transform:translateX(-50%);pointer-events:none;text-align:center;font:600 15px/1.25 Oswald,sans-serif;letter-spacing:.06em;text-shadow:0 1px 3px #000;z-index:20';
    document.body.appendChild(box);
    const big = document.createElement('div'); big.id = 'streakBanner';
    big.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);pointer-events:none;text-align:center;font:700 30px/1.1 Oswald,sans-serif;letter-spacing:.12em;color:#f2d27a;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .4s;z-index:20';
    document.body.appendChild(big);
  }
  // le uccisioni e i colpi alla testa vengono intercettati alla fonte: ogni incremento dà punti
  let kills = STATS.kills || 0, heads = STATS.heads || 0;
  Object.defineProperty(STATS, 'kills', { configurable: true, get: () => kills, set: v => { const d = v - kills; kills = v; if (d > 0 && GAME.started) onKills(d); } });
  Object.defineProperty(STATS, 'heads', { configurable: true, get: () => heads, set: v => { const d = v - heads; heads = v; if (d > 0 && GAME.started) addScore(50 * d, 'Colpo alla testa', '#ffd27a'); } });
}

function addScore(pts, label, color = '#e8e2cf') {
  FUN.score += pts;
  const box = $('scorePop'); if (!box) return;
  const el = document.createElement('div'); el.textContent = `+${pts}  ${label.toUpperCase()}`; el.style.color = color; el.style.transition = 'opacity .5s, transform .5s';
  box.appendChild(el); while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translateY(-14px)'; }, 1500);
  setTimeout(() => el.remove(), 2100);
  if (FUN.score > FUN.best) { FUN.best = FUN.score; try { localStorage.setItem('omahaBest', FUN.best); } catch (e) { } }
}
function banner(text, sub) {
  const b = $('streakBanner'); if (!b) return;
  b.innerHTML = text + (sub ? `<div style="font-size:15px;letter-spacing:.06em;color:#e8e2cf">${sub}</div>` : '');
  b.style.opacity = 1; clearTimeout(b._t); b._t = setTimeout(() => b.style.opacity = 0, 2600);
}

function onKills(d) {
  // più di un'uccisione in un colpo solo = obiettivo o veicolo
  if (d >= 2) { addScore(d * 100, d >= 5 ? 'Obiettivo' : 'Veicolo distrutto', '#9fe08a'); return; }
  addScore(100, 'Eliminazione');
  FUN.streak++;
  FUN.multi = FUN.multiT > 0 ? FUN.multi + 1 : 1; FUN.multiT = 3.5;
  if (FUN.multi >= 2) {
    const names = ['', '', 'Doppia uccisione', 'Tripla uccisione', 'Quadrupla uccisione'];
    addScore(50 * FUN.multi, names[Math.min(4, FUN.multi)] || 'Strage', '#f2b84b');
    if (FUN.multi === 3) banner('TRIPLA UCCISIONE');
    if (FUN.multi >= 5) banner('STRAGE!');
  }
  streakReward(FUN.streak);
}

function streakReward(n) {
  if (n === 5) {
    AIR.cd = 0; banner('SERIE DI 5', 'Supporto aereo pronto — premi T'); sfxTick();
  } else if (n === 10) {
    resupply(); P.nades += 2; P.hp = 100; banner('SERIE DI 10', 'Rifornimento completo e ferite medicate');
  } else if (n === 15 || (n > 15 && n % 10 === 5)) {
    banner('SERIE DI ' + n, 'Sbarramento navale davanti a te!'); navalBarrage();
  } else if (n % 5 === 0) banner('SERIE DI ' + n);
}

// sbarramento: otto colpi da 127 mm sparsi 60-110 m davanti al giocatore, lontano dai compagni
function navalBarrage() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  say(N.radio, PT === 'A' ? 'Qui USS Texas: arrivano i colpi, giù la testa!' : 'Batteria costiera: fuoco di sbarramento in arrivo!');
  for (let k = 0; k < 8; k++) after(2.5 + k * .45, () => {
    const d = rnd(60, 110), s = rnd(-25, 25), p = new V3(P.pos.x + fx * d - fz * s, 0, P.pos.z + fz * d + fx * s);
    if (FRIENDS().some(f => f.alive && f.pos.distanceToSquared(p) < 15 * 15)) return;
    p.y = Math.max(Hf(p.x, p.z), WATER_Y) + .3;
    explode(p, 9, 500, { byPlayer: true, bomb: true });
  });
}

function updateFun(dt) {
  updateSpots(dt); updateDowned(dt); updatePriority(dt); updateCounter(dt);
  FUN.multiT -= dt;
  if (P.dead && !FUN.wasDead) { if (FUN.streak >= 5) feed('Serie interrotta a ' + FUN.streak); FUN.streak = 0; }
  FUN.wasDead = P.dead;
}

// ---------- avvistamento: il nemico mirato viene marcato, la squadra lo prende di mira ----------
const SPOT = { cd: 0, els: [] };
function spotEnemy() {
  if (SPOT.cd > 0 || P.dead) return; SPOT.cd = .6;
  const dir = camera.getWorldDirection(new V3()), fx = dir.x, fy = dir.y, fz = dir.z, eye = camera.position;
  let best = null, bs = .1;
  for (const e of FOES()) {
    if (!e.alive || e.removed) continue;
    const c = e.chest(T5), dx = c.x - eye.x, dy = c.y - eye.y, dz = c.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > 300 || d < 1) continue;
    const ang = Math.acos(clamp((dx * fx + dy * fy + dz * fz) / d, -1, 1));
    if (ang < bs && losClear(eye, c)) { bs = ang; best = e; }
  }
  if (!best) { showMsg('Nessun nemico nel mirino', 1); return; }
  const fresh = !(best.spotT > 0);
  best.spotT = 10; best.spotBy = true;
  if (fresh) { addScore(10, 'Avvistato', '#ff8a7a'); shout(PT === 'A' ? 'en' : 'de', 'spot', P.pos.clone(), { text: PT === 'A' ? pick(['Contact! There!', 'Enemy, right there!', 'Target, light him up!']) : pick(['Feind gesichtet!', 'Da drüben!', 'Ziel erkannt!']) }); }
  // i compagni vicini lo sopprimono subito
  FRIENDS().filter(a => a.alive && a.state !== 'boat' && !a.rescueP && a.pos.distanceToSquared(P.pos) < 60 * 60).sort((a, b) => a.pos.distanceToSquared(P.pos) - b.pos.distanceToSquared(P.pos)).slice(0, 8).forEach(a => { a.target = best; a.thinkT = Math.max(a.thinkT || 0, .8); });
}
function spotKilled(s, byPlayer) { if (s.spotBy && !byPlayer && s.team !== PT) addScore(50, 'Assist di avvistamento', '#ff8a7a'); }
function updateSpots(dt) {
  SPOT.cd -= dt;
  let n = 0;
  for (const e of FOES()) {
    if (!(e.spotT > 0)) continue;
    e.spotT -= dt; if (!e.alive) { e.spotT = 0; continue; }
    const c = e.head ? e.head(T5) : e.chest(T5); c.y += .45; c.project(camera);
    if (c.z > 1 || Math.abs(c.x) > 1.05 || Math.abs(c.y) > 1.05) continue;
    let el = SPOT.els[n];
    if (!el) { el = SPOT.els[n] = document.createElement('div'); el.style.cssText = 'position:fixed;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid #e0412f;transform:translate(-50%,-100%);pointer-events:none;filter:drop-shadow(0 0 2px #000);z-index:19'; document.body.appendChild(el); }
    el.style.display = 'block'; el.style.left = ((c.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-c.y * .5 + .5) * innerHeight) + 'px';
    el.style.opacity = e.spotT < 2 ? (Math.sin(e.spotT * 12) > 0 ? 1 : .3) : 1;
    n++; if (n >= 12) break;
  }
  for (let i = n; i < SPOT.els.length; i++) SPOT.els[i].style.display = 'none';
}

// ---------- giocatore a terra: 15 s per essere soccorso da un medico o da un compagno ----------
const DOWNED = { t: 0, rescueT: 0, msgT: 0, who: null };
function downPlayer() {
  if (P.downed || P.mode !== 'foot' || P.swim || P.inBoat) return false;
  P.downed = true; P.hp = 1; P.stance = 2; P.trigger = false; mouseL = false; P.adsHeld = false;
  DOWNED.t = 15; DOWNED.rescueT = 0; DOWNED.msgT = 0; DOWNED.who = null;
  FUN.streak = 0;
  showMsg('Sei a terra! Striscia al riparo — arriva un medico', 3);
  shout(PT === 'A' ? 'en' : 'de', 'medic', P.pos.clone(), { text: PT === 'A' ? 'Medic! Man down!' : 'Sanitäter! Verwundeter!', priority: true });
  return true;
}
function updateDowned(dt) {
  if (!P.downed) return;
  if (P.dead) { P.downed = false; return; }
  P.stance = 2; P.hp = 1; P.regenT = 5; P.hurt = Math.max(P.hurt, .75);
  DOWNED.t -= dt; DOWNED.msgT -= dt;
  // il soccorritore: medico più vicino, altrimenti il compagno più vicino
  if (!DOWNED.who || !DOWNED.who.alive || !DOWNED.who.rescueP) {
    let best = null, bd = 90 * 90;
    for (const a of FRIENDS()) {
      if (!a.alive || a.state === 'boat' || a.state === 'wounded' || a.inBunker || a.role || a.remote || a.proxy) continue;
      const d = a.pos.distanceToSquared(P.pos) * (a.kind === 'medic' ? .4 : 1);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { DOWNED.who = best; best.rescueP = true; best.stationary = false; best.healTarget = null; best.dest = P.pos.clone(); best.state = 'move'; best.wait = 0; }
  }
  const w = DOWNED.who, near = w && w.alive && w.pos.distanceTo(P.pos) < 2.2;
  DOWNED.rescueT = near ? DOWNED.rescueT + dt : 0;
  if (DOWNED.msgT <= 0) { DOWNED.msgT = 1; showMsg(near ? 'Ti stanno medicando…' : `A terra — ${Math.ceil(DOWNED.t)} s${w ? ` · ${w.name || (w.kind === 'medic' ? 'il medico' : 'un compagno')} sta arrivando (${Math.round(w.pos.distanceTo(P.pos))} m)` : ' · nessuno può raggiungerti'}`, 1.1); }
  if (DOWNED.rescueT > 2.5) {
    P.downed = false; P.hp = 45; P.hurt = .4; P.stance = 1; w.rescueP = false; DOWNED.who = null;
    showMsg('Rimesso in piedi! Torna a combattere', 2);
    if (w.kind === 'medic') shout(PT === 'A' ? 'en' : 'de', 'move', w.pos.clone(), { text: PT === 'A' ? "You're good, get up!" : 'Los, steh auf!' });
    return;
  }
  if (DOWNED.t <= 0) { if (w) w.rescueP = false; P.downed = false; P.hp = 0; P.die(); }
}

// ---------- obiettivo prioritario: una mitragliatrice o un tiratore che inchioda la squadra ----------
const PRIO = { t: 40, target: null, life: 0, el: null, pinT: 0 };
const PRIO_NAME = { mg: 'Mitragliatrice', sniper: 'Tiratore scelto', bar: 'Fucile automatico', smg: 'Squadra d\'assalto', rifle: 'Postazione nemica' };
function pickPriority() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let best = null, bs = -1;
  for (const e of FOES()) {
    if (!e.alive || e.removed || e.state === 'boat' || e.wounded) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d < 45 || d > 190) continue;
    const ahead = (dx * fx + dz * fz) / d; if (ahead < .3) continue;
    const s = (e.kind === 'mg' ? 3 : e.kind === 'sniper' ? 2.5 : e.kind === 'bar' ? 2 : 1) + ahead - d / 200 + (e.inBunker ? .5 : 0);
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function updatePriority(dt) {
  if (P.mode === 'plane' || P.mode === 'naval' || P.dead) { if (PRIO.el) PRIO.el.style.display = 'none'; return; }
  const t = PRIO.target;
  if (!t) {
    PRIO.t -= dt; if (PRIO.el) PRIO.el.style.display = 'none';
    if (PRIO.t <= 0 && P.mode === 'foot' && !P.inBoat && !P.downed) {
      PRIO.t = 8; const e = pickPriority(); if (!e) return;
      PRIO.target = e; PRIO.life = 120; PRIO.pinT = 0;
      banner('OBIETTIVO PRIORITARIO', `${PRIO_NAME[e.kind] || 'Nemico'} che inchioda la squadra — eliminalo`);
      say(N.radio, PT === 'A' ? 'Quella posizione ci tiene inchiodati! Toglietela di mezzo!' : 'Quel tiratore americano ci decima! Eliminatelo!');
    }
    return;
  }
  PRIO.life -= dt;
  if (!t.alive || t.removed || PRIO.life <= 0) {
    if (!t.alive) { if (t.lastByPlayer) { addScore(500, 'Obiettivo prioritario', '#9fe08a'); banner('OBIETTIVO ELIMINATO', 'La squadra riprende ad avanzare'); } else addScore(150, 'Obiettivo eliminato dalla squadra', '#9fe08a'); }
    PRIO.target = null; PRIO.t = rnd(60, 100); return;
  }
  // inchioda i compagni nel suo settore
  PRIO.pinT -= dt;
  if (PRIO.pinT <= 0) { PRIO.pinT = 1; for (const a of FRIENDS()) if (a.alive && a.state !== 'boat' && Math.abs(a.pos.x - t.pos.x) < 45 && a.pos.distanceToSquared(t.pos) < 140 * 140) a.supp = Math.max(a.supp, .85); }
  // indicatore a schermo con distanza
  if (!PRIO.el) { PRIO.el = document.createElement('div'); PRIO.el.style.cssText = 'position:fixed;transform:translate(-50%,-100%);pointer-events:none;color:#f2d27a;font:600 12px Oswald,sans-serif;text-align:center;text-shadow:0 1px 3px #000;z-index:19'; document.body.appendChild(PRIO.el); }
  const c = t.chest(T5); c.y += 1.2; const d = Math.round(t.pos.distanceTo(P.pos)); c.project(camera);
  const on = c.z < 1, x = clamp((c.x * .5 + .5) * innerWidth, 30, innerWidth - 30), y = clamp((-c.y * .5 + .5) * innerHeight, 40, innerHeight - 30);
  PRIO.el.style.display = 'block'; PRIO.el.style.left = (on ? x : (c.x < 0 ? innerWidth - 30 : 30)) + 'px'; PRIO.el.style.top = (on ? y : innerHeight / 2) + 'px';
  PRIO.el.innerHTML = `◆<br>${PRIO_NAME[t.kind] || 'Obiettivo'} · ${d} m`;
}

// ---------- contrattacchi tedeschi (campagna dell'Asse): ondate dalle retrovie verso il punto più avanzato degli Americani ----------
const COUNTER = { t: 150, wave: null };
function updateCounter(dt) {
  if (PT !== 'E' || MISSION.endless || NET.client || MISSION.stage < 2 || MISSION.stage > 5) return;
  if (COUNTER.wave) {
    const alive = COUNTER.wave.filter(s => s.alive).length;
    if (alive < COUNTER.wave.length * .35 || (COUNTER.waveT -= dt) <= 0) {
      // la difesa resiste più a lungo se il contrattacco ha respinto gli Americani dal punto conteso
      const held = countFoes(a => a.pos.distanceTo(COUNTER.pt) < 30) < 3;
      if (held) { MISSION.stageT = Math.max(0, MISSION.stageT - 60); banner('CONTRATTACCO RIUSCITO', 'Gli Americani sono respinti — la linea regge più a lungo'); addScore(300, 'Contrattacco riuscito', '#9fe08a'); }
      else feed('Il contrattacco si è esaurito');
      COUNTER.wave = null; COUNTER.t = rnd(130, 180);
    }
    return;
  }
  COUNTER.t -= dt; if (COUNTER.t > 0) return;
  let pt = null; for (const a of FOES()) if (a.alive && a.state !== 'boat' && (!pt || a.pos.z < pt.z)) pt = a.pos;
  if (!pt) { COUNTER.t = 30; return; }
  COUNTER.pt = new V3(pt.x, 0, pt.z);
  const n = clamp(enemyCap() - aliveE(), 5, 10), wave = [];
  for (let k = 0; k < n; k++) {
    const x = pt.x + rnd(-25, 25), z = pt.z - rnd(45, 65);
    wave.push(addEnemy(k === 0 ? 'mg' : k < 3 ? 'smg' : randEnemyKind(), x, z, { state: 'assault', group: 'counter', objective: new V3(pt.x + rnd(-8, 8), 0, pt.z + rnd(-6, 6)) }));
  }
  const tk = TANKS.list.find(t => t.alive && !t.player); if (tk) tk.goal = new V3(pt.x, 0, pt.z - 15);
  COUNTER.wave = wave; COUNTER.waveT = 90;
  banner('CONTRATTACCO!', `Unisciti all'assalto — ${Math.round(Math.hypot(pt.x - P.pos.x, pt.z - P.pos.z))} m`);
  say(NA.feld, 'Gegenangriff! Contrattacchiamo, ricacciateli in mare!');
  MISSION.markers = [{ pos: new V3(pt.x, Hf(pt.x, pt.z) + 2, pt.z), label: 'Contrattacco' }].concat(MISSION.markers || []);
}
