"use strict";
// ============================================================
//  AAA MOVEMENT LAB — controller sperimentale della fanteria (solo nella tech demo «AAA Graphics Test»).
//  Sostituisce SOLO il blocco di movimento e la camera di updatePlayer quando XPC.on è vero e SCEN === 'aaa';
//  fuoco, ricarica, interazione, arma e danni restano quelli originali. Nelle altre mappe questo file non fa nulla.
//
//  Componenti (indipendenti dalle coordinate della mappa: usano solo le interfacce del mondo qui sotto):
//   XPCInput   — tasti e assi di movimento (Q/E inclinazione, F interazione nel laboratorio)
//   XPCCore    — accelerazione, attrito, inerzia, controllo in aria, pendenze, gravità, salto
//   XPCStance  — macchina a stati delle posture (in piedi/accovacciato/prono + scatto, mira) con verifica del soffitto
//   XPCLean    — inclinazione laterale con collisioni (la camera non entra nei muri, non si spara attraverso)
//   XPCCamera  — testa, passi, accelerazione/frenata, atterraggi, rollio laterale; intensità regolabile (accessibilità)
//   XPCVault   — scavalcamento e arrampicata contestuali (con tasto esplicito: Spazio davanti all'ostacolo)
//   XPCAnim    — pesi di blending per le animazioni scheletriche (le clip non esistono ancora: elencate come mancanti)
//  Interfacce del mondo usate (adattatori): solids (AABB), FLOORS/worldFloor, Hf (terreno), pushOut, rayBox.
// ============================================================
const XPC_DEFAULTS = {
  walk: 3.9, run: 4.6, sprint: 6.8, crouch: 2.1, prone: .95, adsMul: .62,
  accel: 26, decel: 22, friction: 9, airControl: .18, airAccel: 6,
  jump: 4.6, gravity: 18, slopeMax: 40, slopeSlow: .35,
  leanAngle: 13, leanDist: .38, leanSpeed: 7,
  bob: 1, camFx: 1, stanceSpeed: 6.5,
  heights: [1.72, 1.18, .55], eyes: [1.62, 1.06, .42],
  vaultMax: 1.15, mantleMax: 1.95, vaultTime: .55, mantleTime: .95,
};
const XPC = {
  on: false, cfg: Object.assign({}, XPC_DEFAULTS),
  st: { state: 'idle', stance: 0, height: 1.72, lean: 0, leanT: 0, slope: 0, acc: 0, speed: 0, vault: 'pronto', ms: 0, msAvg: 0, rays: 0, eyeY: 0, eyeV: 0, land: 0, accTilt: 0, step: 0, blocked: '' },
  vault: null, prevVel: new V3(), panel: false, stats: { n: 0, sum: 0 },
};
const _xa = new V3(), _xb = new V3(), _xc = new V3();

// ---------------------------------------------------------------- adattatori del mondo
const XPCWorld = {
  boxFree(x0, y0, z0, x1, y1, z1) {   // nessun solido (non calpestabile) interseca il volume
    for (const s of solids) {
      if (!s.on || s.max.x <= x0 || s.min.x >= x1 || s.max.z <= z0 || s.min.z >= z1 || s.max.y <= y0 || s.min.y >= y1) continue;
      return false;
    }
    return true;
  },
  ground(x, z, y) {
    let g = Hf(x, z); if (typeof FLOORS !== 'undefined' && FLOORS.length) g = Math.max(g, worldFloor(x, z, y));
    // sommità dei solidi sotto i piedi (casse, muretti, ripiani): ci si può stare sopra
    for (const s of solids) if (s.on && x > s.min.x && x < s.max.x && z > s.min.z && z < s.max.z && s.max.y <= y + .45 && s.max.y > g) g = s.max.y;
    return g;
  },
  // distanza libera lungo un raggio prima di un solido (per inclinazione e scavalcamento)
  ray(o, d, maxT) {
    XPC.st.rays++;
    let best = maxT;
    for (const s of solids) {
      if (!s.on || s.nb) continue;
      const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s, best);
      if (t >= 0 && t < best) best = t;
    }
    return best;
  },
};

// ---------------------------------------------------------------- posture
function xpcStanceUpdate(dt) {
  const st = XPC.st, c = XPC.cfg;
  // richiesta del giocatore in P.stance (tasti originali C/Ctrl e Z); qui si verifica se è possibile
  let want = P.stance;
  if (want < st.stance) {   // alzarsi: serve spazio sopra la testa
    const h = c.heights[want], r = .3;
    if (!XPCWorld.boxFree(P.pos.x - r, P.pos.y + c.heights[st.stance] - .02, P.pos.z - r, P.pos.x + r, P.pos.y + h, P.pos.z + r)) { want = st.stance; P.stance = st.stance; st.blocked = 'soffitto: non puoi alzarti'; }
    else st.blocked = '';
  }
  st.stance = want;
  st.height += (c.heights[st.stance] - st.height) * Math.min(1, dt * c.stanceSpeed);
  // stato di locomozione (combinazioni consentite: niente scatto da prono o in mira)
  const spd = Math.hypot(P.vel.x, P.vel.z);
  st.state = !P.grounded ? 'in aria' : XPC.vault ? XPC.vault.kind : P.sprint ? 'scatto' : spd < .15 ? 'fermo' : spd < c.walk * .7 ? 'passo' : 'corsa';
}

// ---------------------------------------------------------------- movimento
function xpcMove(dt, w) {
  const c = XPC.cfg, st = XPC.st;
  const f = (KEYS.KeyW ? 1 : 0) - (KEYS.KeyS ? 1 : 0), sx = (KEYS.KeyD ? 1 : 0) - (KEYS.KeyA ? 1 : 0);
  if (P.stamina <= .02) P.winded = true; else if (P.stamina > .3) P.winded = false;
  P.sprint = !!KEYS.ShiftLeft && !P.adsHeld && f > 0 && st.stance !== 2 && !P.winded && P.adsK < .3 && Math.abs(st.lean) < .2 && P.shock < .5;
  if (P.sprint && P.stance === 1) P.stance = 0;
  let target = [c.walk, c.crouch, c.prone][st.stance];
  if (P.sprint) target = c.sprint;
  target *= (w && w.speedMul) || 1;
  if (P.adsK > .5) target *= c.adsMul;
  if (P.hp < 45) target *= 1 - (1 - P.hp / 45) * .3;
  // pendenza lungo la direzione di marcia (dal gradiente del terreno, non dalla mesh: niente tremolii)
  const e = .5, gx = (Hf(P.pos.x + e, P.pos.z) - Hf(P.pos.x - e, P.pos.z)) / (2 * e), gz = (Hf(P.pos.x, P.pos.z + e) - Hf(P.pos.x, P.pos.z - e)) / (2 * e);
  st.slope = Math.atan(Math.hypot(gx, gz)) * 180 / PI;
  const syw = Math.sin(P.yaw), cyw = Math.cos(P.yaw);
  let wx = 0, wz = 0;
  if (f || sx) { const l = Math.hypot(f, sx); wx = (-syw * f + cyw * sx) / l; wz = (-cyw * f - syw * sx) / l; }   // diagonale normalizzata
  if (wx || wz) {
    const up = gx * wx + gz * wz;   // >0 = salita
    if (up > 0) { const ang = Math.atan(up) * 180 / PI; target *= ang > c.slopeMax ? 0 : 1 - c.slopeSlow * (ang / c.slopeMax); }
  }
  const vx = P.vel.x, vz = P.vel.z;
  if (P.grounded) {
    const tx = wx * target, tz = wz * target, dx = tx - vx, dz = tz - vz, dl = Math.hypot(dx, dz);
    // accelerazione verso la velocità voluta; frenata più decisa quando si lascia il tasto o si inverte
    const reverse = (vx * tx + vz * tz) < 0, rate = (wx || wz) ? (reverse ? c.decel + c.accel * .5 : c.accel) : c.decel;
    const step = Math.min(dl, rate * dt);
    if (dl > 1e-6) { P.vel.x += dx / dl * step; P.vel.z += dz / dl * step; }
    if (!(wx || wz)) { const sp = Math.hypot(P.vel.x, P.vel.z), k = Math.max(0, 1 - c.friction * dt * .1); P.vel.x *= k; P.vel.z *= k; if (sp < .05) P.vel.set(0, P.vel.y, 0); }
  } else {   // in aria: controllo limitato, l'inerzia domina
    P.vel.x += (wx * target - vx) * Math.min(1, c.airAccel * c.airControl * dt);
    P.vel.z += (wz * target - vz) * Math.min(1, c.airAccel * c.airControl * dt);
  }
  // accelerazione misurata (per camera e arma)
  st.acc = Math.hypot(P.vel.x - XPC.prevVel.x, P.vel.z - XPC.prevVel.z) / Math.max(dt, 1e-4);
  const fwdAcc = ((P.vel.x - XPC.prevVel.x) * -syw + (P.vel.z - XPC.prevVel.z) * -cyw) / Math.max(dt, 1e-4);
  st.accTilt += (clamp(fwdAcc * .0035, -.04, .04) - st.accTilt) * Math.min(1, dt * 6);
  XPC.prevVel.set(P.vel.x, 0, P.vel.z);
  P.stamina = clamp(P.stamina + (P.sprint && (f || sx) ? -.16 : .11) * dt, 0, 1);
  // integrazione e collisioni (stessi solidi del gioco), altezza del corpo dalla postura
  P.prev.copy(P.pos);
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  pushOut(P.pos, st.stance === 2 ? .42 : .36, st.height);
  const ground = XPCWorld.ground(P.pos.x, P.pos.z, P.pos.y);
  if (KEYS.Space && P.grounded && st.stance === 0 && !XPC.vault) {
    if (!xpcVaultTry()) { P.vy = c.jump; P.grounded = false; }
    KEYS.Space = false;
  }
  P.vy -= c.gravity * dt; P.pos.y += P.vy * dt;
  if (P.pos.y <= ground) { if (!P.grounded && P.vy < -3) { st.land = Math.min(1, -P.vy / 9); if (P.vy < -7) play('bodyfall', null, { vol: .4 }); } P.pos.y = ground; P.vy = 0; P.grounded = true; }
  else if (P.grounded && P.pos.y - ground < .45 && P.vy <= 0) { P.pos.y = ground; P.vy = 0; }   // gradini e scale: si resta a terra
  else P.grounded = false;
  const spd = Math.hypot(P.vel.x, P.vel.z); st.speed = spd;
  P.moveK = clamp(spd / 4.3, 0, 1.6); P.bobPh += dt * spd * 2.3; P.crawlK = lerp(P.crawlK || 0, st.stance === 2 && spd > .2 && P.adsK < .3 ? 1 : 0, Math.min(1, dt * 6));
  P.stepT -= dt * spd;
  if (P.stepT <= 0 && P.grounded) { P.stepT = P.sprint ? 2.5 : 2.1; sfxStep('sand', P.sprint); st.step = 1; }
}

// ---------------------------------------------------------------- inclinazione
function xpcLeanUpdate(dt) {
  const c = XPC.cfg, st = XPC.st;
  const want = (KEYS.KeyE ? 1 : 0) - (KEYS.KeyQ ? 1 : 0);
  const allowed = !P.sprint && st.stance !== 2 && !XPC.vault;
  st.leanT = allowed ? want : 0;
  st.lean += (st.leanT - st.lean) * Math.min(1, dt * c.leanSpeed);
  if (Math.abs(st.lean) < 1e-3) { st.lean = 0; st.leanFree = 1; return; }
  // la testa si sposta lungo il fianco: si limita lo spostamento alla distanza libera (niente teste nei muri)
  const side = Math.sign(st.lean), eye = P.pos.y + st.eyeY;
  _xa.set(P.pos.x, eye - .12, P.pos.z); _xb.set(Math.cos(P.yaw) * side, 0, -Math.sin(P.yaw) * side);
  const free = XPCWorld.ray(_xa, _xb, c.leanDist + .35) - .3;
  st.leanFree = clamp(free / c.leanDist, 0, 1);
}

// ---------------------------------------------------------------- scavalcamento / arrampicata
function xpcVaultTry() {
  const c = XPC.cfg, st = XPC.st, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  // si cerca il solido più vicino davanti, entro 0.9 m, all'altezza delle ginocchia/petto
  let hit = null;
  for (const yh of [.45, .9, 1.4]) {
    _xa.set(P.pos.x, P.pos.y + yh, P.pos.z); _xb.set(fx, 0, fz);
    const t = XPCWorld.ray(_xa, _xb, .9); if (t < .9) { hit = t; break; }
  }
  if (hit === null) { st.vault = 'nessun ostacolo davanti'; return false; }
  // sommità: si scende dall'alto finché non si incontra il solido
  const px = P.pos.x + fx * (hit + .12), pz = P.pos.z + fz * (hit + .12);
  _xa.set(px, P.pos.y + c.mantleMax + .3, pz); _xb.set(0, -1, 0);
  const down = XPCWorld.ray(_xa, _xb, c.mantleMax + .3), top = P.pos.y + c.mantleMax + .3 - down, h = top - P.pos.y;
  if (h < .3 || h > c.mantleMax) { st.vault = h > c.mantleMax ? `troppo alto (${h.toFixed(2)} m)` : 'troppo basso: si cammina'; return false; }
  // profondità: quanto è spesso l'ostacolo alla sua sommità
  let depth = 0; for (; depth < 2; depth += .1) { _xa.set(px + fx * depth, top - .05, pz + fz * depth); if (XPCWorld.boxFree(_xa.x - .01, _xa.y - .01, _xa.z - .01, _xa.x + .01, _xa.y + .01, _xa.z + .01)) break; }
  const r = .32;
  if (h <= c.vaultMax && depth <= .8) {
    // scavalcamento: atterraggio oltre l'ostacolo, con spazio libero per il corpo
    const lx = px + fx * (depth + .45), lz = pz + fz * (depth + .45), ly = XPCWorld.ground(lx, lz, top);
    if (ly > top + .1 || top - ly > 2.2) { st.vault = 'atterraggio non valido'; return false; }
    if (!XPCWorld.boxFree(lx - r, ly + .05, lz - r, lx + r, ly + c.heights[0], lz + r)) { st.vault = 'nessuno spazio oltre l\'ostacolo'; return false; }
    if (!XPCWorld.boxFree(Math.min(P.pos.x, lx) - .05, top + .05, Math.min(P.pos.z, lz) - .05, Math.max(P.pos.x, lx) + .05, top + .9, Math.max(P.pos.z, lz) + .05)) { st.vault = 'passaggio ostruito sopra l\'ostacolo'; return false; }
    XPC.vault = { kind: 'scavalcamento', t: 0, dur: c.vaultTime, a: P.pos.clone(), top: new V3(px + fx * depth * .5, top + .1, pz + fz * depth * .5), b: new V3(lx, ly, lz) };
  } else {
    // arrampicata: si sale in piedi sulla sommità, se c'è spazio sopra
    const lx = px + fx * Math.min(.35, depth * .5 + .2), lz = pz + fz * Math.min(.35, depth * .5 + .2);
    if (depth < .35) { st.vault = 'sommità troppo stretta'; return false; }
    if (!XPCWorld.boxFree(lx - r, top + .02, lz - r, lx + r, top + c.heights[0], lz + r)) { st.vault = 'nessuno spazio sopra'; return false; }
    XPC.vault = { kind: 'arrampicata', t: 0, dur: c.mantleTime * (h / 1.6), a: P.pos.clone(), top: new V3(P.pos.x + fx * hit * .5, top + .25, P.pos.z + fz * hit * .5), b: new V3(lx, top, lz) };
  }
  st.vault = XPC.vault.kind + ` (${h.toFixed(2)} m)`; P.vel.set(0, 0, 0); P.vy = 0; P.switchT = Math.max(P.switchT, .3);
  play('bodyfall', null, { vol: .2, rate: 1.4 });
  return true;
}
// transizione PROCEDURALE PROVVISORIA (non un'animazione): curva sopra l'ostacolo, arma abbassata
function xpcVaultUpdate(dt) {
  const v = XPC.vault; v.t += dt / v.dur; const t = Math.min(1, v.t);
  const a = v.a, m = v.top, b = v.b, u = 1 - t;
  P.pos.set(u * u * a.x + 2 * u * t * m.x + t * t * b.x, u * u * a.y + 2 * u * t * m.y + t * t * b.y, u * u * a.z + 2 * u * t * m.z + t * t * b.z);
  P.switchT = Math.max(P.switchT, .25); P.vel.set(0, 0, 0); P.vy = 0; P.grounded = true;
  if (t >= 1) { XPC.vault = null; XPC.st.vault = 'pronto'; XPC.st.land = .35; }
}

// ---------------------------------------------------------------- camera
function xpcCamera(dt) {
  const c = XPC.cfg, st = XPC.st, k = c.camFx;
  const eyeT = c.eyes[st.stance] * (st.height / c.heights[st.stance] * .3 + .7);
  // altezza degli occhi con smorzamento critico: assorbe gradini e piccole irregolarità senza scatti
  const tgt = P.pos.y + eyeT;
  if (!st.eyeInit) { st.eyeAbs = tgt; st.eyeInit = 1; }
  const dy = tgt - st.eyeAbs, w = 18;
  st.eyeV += (dy * w * w - 2 * w * st.eyeV) * dt; st.eyeAbs += st.eyeV * dt;
  if (Math.abs(dy) > .8) { st.eyeAbs = tgt; st.eyeV = 0; }
  st.eyeY = st.eyeAbs - P.pos.y; P.eyeH = st.eyeY;
  st.land = Math.max(0, st.land - dt * 2.6);
  P.kickP = lerp(P.kickP, 0, Math.min(1, dt * 10)); P.kickY = lerp(P.kickY, 0, Math.min(1, dt * 10));
  // passi: oscillazione verticale e laterale legata alla fase del passo (non duplicata nell'arma: lì c'è il suo moto)
  const bk = P.moveK * (1 - P.adsK * .75) * (P.sprint ? 1.35 : 1) * c.bob * k * (P.grounded ? 1 : 0);
  const bobY = Math.sin(P.bobPh) * .038 * bk, bobX = Math.sin(P.bobPh * .5) * .028 * bk;
  const landDip = -Math.sin(st.land * PI) * .09 * k;
  // inclinazione laterale
  const side = Math.sign(st.lean), lk = Math.abs(st.lean) * st.leanFree, ld = c.leanDist * lk * side;
  const lr = -c.leanAngle * PI / 180 * lk * side * (1 - P.adsK * .35);
  let x = P.pos.x + Math.cos(P.yaw) * (bobX + ld), z = P.pos.z - Math.sin(P.yaw) * (bobX + ld), y = st.eyeAbs + bobY + landDip - lk * .06;
  camera.position.set(x, y, z);
  const vr = P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw);
  P.strafeRoll = lerp(P.strafeRoll || 0, -vr * .007 * k, Math.min(1, dt * 6));
  const sh = P.shake * .035;
  camera.rotation.set(P.pitch + P.kickP + rnd(-sh, sh) - st.accTilt * k - st.land * .05 * k, P.yaw + P.kickY + rnd(-sh, sh), lr + P.strafeRoll + Math.sin(P.bobPh * .5) * .01 * bk);
  const s = P.slot(), wpn = s ? WEAPONS[s.id] : null;
  P.sprintK = lerp(P.sprintK || 0, P.sprint && P.moveK > .5 ? 1 : 0, Math.min(1, dt * 8));
  let fov = SETTINGS.fov + P.sprintK * 6 * k;
  if (wpn && P.adsK > 0) fov = lerp(fov, wpn.fov, P.adsK * P.adsK);
  if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // all'arma solo i dati (atterraggio, inclinazione): il suo moto lo calcola updateViewmodel
  if (typeof swayY !== 'undefined') swayY -= st.land * .004;
}

// ---------------------------------------------------------------- animazioni (architettura di blending)
const XPC_CLIPS = ['idle', 'walk', 'run', 'sprint', 'crouch', 'prone', 'lean', 'vault', 'mantle'];
const XPCAnim = {
  clips: {},   // nome -> AnimationClip quando esisterà un GLB del soldato con scheletro; per ora nessuna
  weights: Object.fromEntries(XPC_CLIPS.map(k => [k, 0])),
  update(dt) {
    const st = XPC.st, sp = st.speed, W = {};
    for (const k of XPC_CLIPS) W[k] = 0;
    if (XPC.vault) W[XPC.vault.kind === 'scavalcamento' ? 'vault' : 'mantle'] = 1;
    else if (st.stance === 2) W.prone = 1;
    else if (st.stance === 1) W.crouch = 1;
    else if (P.sprint) W.sprint = 1;
    else { const a = clamp(sp / XPC.cfg.walk, 0, 1); W.idle = 1 - a; W.walk = a * (1 - clamp((sp - 3) / 1.5, 0, 1)); W.run = a - W.walk; }
    W.lean = Math.abs(st.lean);
    for (const k of XPC_CLIPS) this.weights[k] += (W[k] - this.weights[k]) * Math.min(1, dt * 8);
  },
  missing() { return XPC_CLIPS.filter(k => !this.clips[k]); },
};

// ---------------------------------------------------------------- punto d'ingresso (chiamato da updatePlayer)
function xpcUpdate(dt, w) {
  const t0 = performance.now(); XPC.st.rays = 0;
  xpcStanceUpdate(dt);
  // sotto-passi fissi (≤ 1/120 s): stesso movimento a qualunque frame rate
  const n = Math.max(1, Math.ceil(dt / (1 / 120) - 1e-6)), h = dt / n;
  for (let i = 0; i < n; i++) { if (XPC.vault) xpcVaultUpdate(h); else xpcMove(h, w); }
  xpcLeanUpdate(dt);
  XPCAnim.update(dt);
  const ms = performance.now() - t0; XPC.st.ms = ms; XPC.stats.n++; XPC.stats.sum += ms; XPC.st.msAvg = XPC.stats.sum / XPC.stats.n;
  if (XPC.panel) xpcPanelTick();
}
function xpcActive() { return XPC.on && typeof SCEN !== 'undefined' && SCEN === 'aaa'; }
// inclinazione e interazione nel laboratorio: Q/E inclinano (cattura prima dei tasti originali), F interagisce
addEventListener('keydown', e => {
  if (!xpcActive() || P.mode !== 'foot' || (typeof LAB !== 'undefined' && LAB.panel) || (typeof ASR !== 'undefined' && ASR.on)) return;
  if (e.code === 'KeyQ' || e.code === 'KeyE') { KEYS[e.code] = true; e.stopImmediatePropagation(); }
  else if (e.code === 'KeyF') { P.ePressed = true; }
  else if (e.code === 'F6') { e.preventDefault(); xpcPanelOpen(!XPC.panel); }
}, true);

// ---------------------------------------------------------------- percorso di prova (A–J) e ostacoli necessari
const XPC_COURSE = [];
function xpcBuildCourse() {
  XPC_COURSE.length = 0;
  // il percorso si appoggia alla scena esistente: riferimenti relativi al centro del villaggio e alla casa della pipeline
  const cx = AV.cx, cz = AV.cz, hs = AAA.pipeHouse;
  const free = (x, z) => XPCWorld.boxFree(x - .4, Hf(x, z) + .1, z - .4, x + .4, Hf(x, z) + 1.8, z + .4);
  const spot = (x, z, r = 0) => { for (let k = 0; k < 40; k++) { const a = k * 2.4, d = r + k * .6, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (free(px, pz)) return [px, pz]; } return [x, z]; };
  const base = spot(cx - 8, cz + 22);
  const mat = AAA.mats.stoneLight || AAA.mats.stone || new THREE.MeshStandardMaterial({ color: 0x9a948a });
  const obstacles = [];
  const addBox = (x, z, w, d, h, y0 = null, tag = 'lab') => {
    const g = y0 ?? Hf(x, z) - .3; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h + (y0 === null ? .3 : 0), d), mat); m.position.set(x, g + (h + (y0 === null ? .3 : 0)) / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    const s = addSolid(x - w / 2, g, z - d / 2, x + w / 2, g + h + (y0 === null ? .3 : 0), z + d / 2, tag); s.mat = 'muratura'; obstacles.push({ m, s }); return s;
  };
  const [bx, bz] = base, g0 = Hf(bx, bz);
  // E: muretto basso (0.9 m, spesso 0.4) — F: piano alto (1.5 m, profondo 1.6) — C: trave bassa per passare accovacciati
  addBox(bx + 6, bz, .4, 3, .9);
  addBox(bx + 12, bz, 1.6, 2.4, 1.5);
  addBox(bx + 18, bz - 1.4, .3, .3, 1.32); addBox(bx + 18, bz + 1.4, .3, .3, 1.32); addBox(bx + 18, bz, .4, 3.1, .25, Hf(bx + 18, bz) + 1.32);
  XPC.obstacles = obstacles;
  const P0 = (n, label, x, z, yaw, extra) => XPC_COURSE.push({ n, label, x, z, yaw, extra });
  P0('A', 'Accelerazione e frenata (corsa di 20 m)', bx - 16, bz, -Math.PI / 2);
  P0('B', 'Strafing e cambi di direzione', bx - 8, bz + 4, -Math.PI / 2);
  P0('C', 'Accovacciato e prono: trave bassa a 1,25 m', bx + 15.5, bz, -Math.PI / 2);
  P0('D', 'Inclinazione vicino a un muro', ...(hs ? [hs.x + 6.9, hs.z + 2.5] : spot(cx, cz, 4)), 0);
  P0('E', 'Scavalcamento: muretto 0,9 m (Spazio)', bx + 4.6, bz, -Math.PI / 2);
  P0('F', 'Arrampicata: piano 1,5 m (Spazio)', bx + 9.8, bz, -Math.PI / 2);
  P0('G', 'Terreno irregolare (bocage)', ...spot(cx + 24, cz - 20), 0);
  P0('H', 'Movimento in mira', bx - 4, bz - 4, -Math.PI / 2);
  P0('I', 'Scatto e recupero del fiato', bx - 22, bz - 6, -Math.PI / 2);
  P0('J', 'Scala e interni (casa normanna)', ...(hs ? [hs.x - 1.19, hs.z + 5] : spot(cx, cz, 2)), 0);
  for (const p of XPC_COURSE) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xe8c860 })); s.position.set(p.x, Hf(p.x, p.z) + .7, p.z); scene.add(s); p.marker = s; }
}
function xpcGoto(n) {
  const p = XPC_COURSE.find(q => q.n === n); if (!p) return;
  const hs = AAA.pipeHouse; if (hs && n === 'D') { p.x = hs.x + 6.5; p.z = hs.z + 2.5; p.yaw = Math.PI; } if (hs && n === 'J') { p.x = hs.x - 1.19; p.z = hs.z + 5; }
  P.pos.set(p.x, XPCWorld.ground(p.x, p.z, Hf(p.x, p.z) + 1) + .02, p.z); P.vel.set(0, 0, 0); P.vy = 0; P.yaw = p.yaw; P.pitch = 0; P.stance = 0; XPC.st.stance = 0; XPC.st.height = XPC.cfg.heights[0]; XPC.st.eyeInit = 0; XPC.vault = null;
  // stato dinamico azzerato: ogni prova riparte identica (ripetibilità)
  Object.assign(XPC.st, { lean: 0, leanT: 0, leanFree: 1, land: 0, eyeV: 0, accTilt: 0, blocked: '', vault: 'pronto' }); XPC.prevVel.set(0, 0, 0);
  P.stamina = 1; P.winded = false; P.sprint = false; P.adsK = 0; P.crawlK = 0; P.bobPh = 0; P.stepT = 0; P.grounded = true; P.strafeRoll = 0;
  XPC.st.course = n; if (typeof showMsg === 'function') showMsg(`Prova ${n}: ${p.label}`, 2.5);
}

// ---------------------------------------------------------------- pannello MOVEMENT LAB — DEBUG (F6)
const XPC_SLIDERS = [['walk', 'Velocità al passo', 1, 7, .1], ['sprint', 'Velocità di scatto', 3, 11, .1], ['accel', 'Accelerazione', 4, 60, 1], ['decel', 'Decelerazione', 4, 60, 1],
  ['friction', 'Attrito', 0, 30, .5], ['leanAngle', 'Angolo di inclinazione (°)', 0, 25, 1], ['bob', 'Oscillazione della camera', 0, 2, .05], ['camFx', 'Effetti camera (accessibilità)', 0, 1, .05], ['stanceSpeed', 'Velocità cambio postura', 1, 15, .5]];
function xpcPanelOpen(on) {
  XPC.panel = on; let el = $('xpcPanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'xpcPanel'; el.style.cssText = 'position:fixed;left:12px;top:12px;width:min(330px,92vw);max-height:calc(100vh - 24px);overflow:auto;z-index:71;background:rgba(10,11,10,.88);color:#e8e6dc;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #555';
    document.body.appendChild(el);
    el.addEventListener('input', e => { const k = e.target.dataset.k; if (k) { XPC.cfg[k] = +e.target.value; xpcPanelTick(true); } });
    el.addEventListener('click', e => { const a = e.target.dataset.a; if (!a) return; if (a === 'reset') { XPC.cfg = Object.assign({}, XPC_DEFAULTS); xpcPanelBuild(); } else if (a === 'toggle') { XPC.on = !XPC.on; XPC.stats = { n: 0, sum: 0 }; xpcPanelBuild(); } else if (a[0] === 'G') xpcGoto(a.slice(1)); e.target.blur(); });
  }
  el.style.display = on ? 'block' : 'none'; if (on) { xpcPanelBuild(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => { GAME.running = true; const pz = document.getElementById('pause'); if (pz) pz.classList.add('hidden'); }, 60); }
  else if (typeof lockPointer === 'function' && !(typeof LAB !== 'undefined' && LAB.panel)) lockPointer();
}
function xpcPanelBuild() {
  const el = $('xpcPanel'); if (!el) return; const S = 'margin:8px 0 3px;font:600 11px system-ui;letter-spacing:.12em;color:#c8b070';
  const B = (a, t) => `<button data-a="${a}" style="margin:2px 3px 2px 0;padding:2px 7px;background:#2a2c2a;color:#eee;border:1px solid #666;cursor:pointer">${t}</button>`;
  el.innerHTML = `<b style="letter-spacing:.08em">MOVEMENT LAB — DEBUG</b> <span style="opacity:.6">(F6)</span>
  <div style="margin:4px 0">${B('toggle', XPC.on ? 'Controller: SPERIMENTALE' : 'Controller: ORIGINALE')} ${B('reset', 'Reset defaults')}</div>
  <div style="${S}">STATO</div><pre id="xpcStat" style="margin:0;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap"></pre>
  <div style="${S}">PROVE</div>${XPC_COURSE.map(p => B('G' + p.n, p.n)).join('')}<div style="opacity:.7;font-size:11px">${XPC_COURSE.map(p => `${p.n}: ${p.label}`).join('<br>')}</div>
  <div style="${S}">PARAMETRI</div>${XPC_SLIDERS.map(([k, t, a, b, s]) => `<label style="display:block">${t} <span id="xpv_${k}">${XPC.cfg[k]}</span><input data-k="${k}" type="range" min="${a}" max="${b}" step="${s}" value="${XPC.cfg[k]}" style="width:100%"></label>`).join('')}
  <div style="${S}">ANIMAZIONI</div><div id="xpcAnim" style="font-size:11px"></div>
  <div style="opacity:.6;margin-top:6px">Q/E inclinazione · Spazio davanti a un ostacolo: scavalca/arrampica · C/Ctrl accovacciato · Z prono · F interagisci</div>`;
  xpcPanelTick(true);
}
function xpcPanelTick(force) {
  const now = performance.now(); if (!force && now - (XPC.lastUi || 0) < 150) return; XPC.lastUi = now;
  const el = $('xpcStat'); if (!el) return; const st = XPC.st;
  for (const [k] of XPC_SLIDERS) { const v = $('xpv_' + k); if (v) v.textContent = XPC.cfg[k]; }
  el.textContent = `velocità      ${st.speed.toFixed(2)} m/s\naccelerazione ${st.acc.toFixed(1)} m/s²\nstato         ${st.state}\npostura       ${['in piedi', 'accovacciato', 'prono'][st.stance]}${st.blocked ? ' — ' + st.blocked : ''}\naltezza       ${st.height.toFixed(2)} m\na terra       ${P.grounded ? 'sì' : 'no'}\npendenza      ${st.slope.toFixed(1)}°\ninclinazione  ${(st.lean * 100).toFixed(0)}% (spazio ${(st.leanFree * 100 || 0).toFixed(0)}%)\nscavalcamento ${st.vault}\nmira (ADS)    ${(P.adsK * 100).toFixed(0)}%\ncontroller    ${st.ms.toFixed(3)} ms (media ${st.msAvg.toFixed(3)}), raggi ${st.rays}`;
  const a = $('xpcAnim'); if (a) a.innerHTML = XPC_CLIPS.map(k => `${k} ${(XPCAnim.weights[k] * 100).toFixed(0)}%${XPCAnim.clips[k] ? '' : ' <span style="color:#d98">(clip mancante: transizione procedurale)</span>'}`).join(' · ');
}
// attivazione: solo nella tech demo, dopo la costruzione del mondo
function xpcInit() { if (SCEN !== 'aaa') return; XPC.on = true; XPC.stats = { n: 0, sum: 0 }; Object.assign(XPC.st, { stance: P.stance || 0, height: XPC.cfg.heights[0], eyeInit: 0 }); xpcBuildCourse(); }
