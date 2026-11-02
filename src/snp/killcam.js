"use strict";
// ============================================================
//  SOLO CECCHINI 2.0 — killcam: registrazione circolare degli ultimi secondi (posizioni, orientamenti,
//  mira e colpi di giocatore e bot, 15 volte al secondo) e replay della propria eliminazione.
//  Il replay usa solo dati registrati: senza la ripresa del tiratore mostra la scheda d'eliminazione.
//  La camera che segue il proiettile parte solo se il colpo che ha ucciso è stato registrato davvero.
// ============================================================
const KC = { frames: [], shots: [], recT: 0, maxT: 6 };
// ---------- registrazione ----------
function snpKcRecord(dt) {
  if (SNP2.kc && SNP2.kc.on) return;
  KC.recT -= dt; if (KC.recT > 0) return; KC.recT = 1 / 15;
  const f = { t: GAME.time, e: {} };
  if (!P.dead) f.e[SNP.me] = [P.pos.x, P.pos.y, P.pos.z, P.yaw, P.pitch, P.adsK > .5 ? 1 : 0, P.stance, P.slot() ? P.slot().id : '', PT];
  for (const t of ['A', 'E']) for (const b of snpTeamBots(t)) f.e[b.name] = [b.pos.x, b.pos.y, b.pos.z, b.lookY, b.lookP, b.st === 'AIM' || b.st === 'FIRE' ? 1 : 0, b.stance || 0, b.wid, b.team];
  KC.frames.push(f); while (KC.frames.length && GAME.time - KC.frames[0].t > KC.maxT) KC.frames.shift();
}
function snpKcShot(name, from, end, victim, zone) {
  KC.shots.push({ t: GAME.time, n: name, from: from.clone(), end: end.clone(), v: victim === P || victim === 'P' ? SNP.me : victim && victim.name ? victim.name : null, zone });
  while (KC.shots.length && GAME.time - KC.shots[0].t > KC.maxT) KC.shots.shift();
}
// stato interpolato di un'entità all'istante t (null se non registrata)
function kcAt(name, t) {
  const F = KC.frames; let a = null, b = null;
  for (let i = 0; i < F.length; i++) { if (F[i].t <= t && F[i].e[name]) a = F[i]; if (F[i].t >= t && F[i].e[name]) { b = F[i]; break; } }
  if (!a && !b) return null; if (!a) a = b; if (!b) b = a;
  const A = a.e[name], B = b.e[name], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0, L = (x, y) => x + (y - x) * k;
  let dy = B[3] - A[3]; while (dy > PI) dy -= TAU; while (dy < -PI) dy += TAU;
  return { x: L(A[0], B[0]), y: L(A[1], B[1]), z: L(A[2], B[2]), yaw: A[3] + dy * k, pitch: L(A[4], B[4]), ads: k < .5 ? A[5] : B[5], st: A[6], w: A[7], team: A[8] };
}
// ---------- avvio: chiamato alla morte del giocatore ----------
function snpKcBegin() {
  const k = SNP2.lastDeath; SNP2.kc = null;
  if (!SNPCFG.killcam || !k) return;
  const kc = { on: true, t0: GAME.time, killer: k.k, w: k.w, zone: k.zone, dist: k.dist, team: k.kt, skip: false };
  // colpo che ha ucciso: l'ultimo del tiratore diretto a noi prima della morte
  const shot = [...KC.shots].reverse().find(s => s.n === k.k && s.v === SNP.me && s.t <= k.t + .05 && s.t > k.t - 2);
  const tShot = shot ? shot.t : k.t, have = k.k && kcAt(k.k, tShot) && kcAt(k.k, tShot - 1.5);
  kc.data = !!have; kc.shot = shot || null; kc.tShot = tShot;
  kc.rs = tShot - Math.max(1.5, SNPCFG.kcDur - 1.2); kc.re = tShot + (shot ? 1.2 : .6); kc.rt = kc.rs; kc.len = kc.re - kc.rs;
  // in solitario i bot si fermano e vengono rimessi dove erano; la vittima ha un corpo per il replay
  kc.saved = []; kc.freeze = !NET.on;
  if (kc.data && kc.freeze) {
    for (const t of ['A', 'E']) for (const b of snpTeamBots(t)) kc.saved.push([b, b.pos.clone(), b.yaw]);
    const me = kcAt(SNP.me, tShot);
    if (me) { kc.pup = new Soldier(PT, 'sniper', me.x, me.z, { y: me.y, state: 'post', stationary: true, name: '' }); kc.pup.snpKc = true; }
  }
  SNP2.kc = kc;
  let el = $('snpKc'); if (!el) { el = document.createElement('div'); el.id = 'snpKc'; document.body.appendChild(el); }
  const wn = kc.w && WEAPONS[kc.w] ? WEAPONS[kc.w].name : '';
  el.innerHTML = `<div class="kt">${kc.data ? 'KILLCAM' : 'ELIMINATO'}</div><div class="kb">${k.k ? `<b>${k.k}</b> · ${[wn, kc.zone === 'head' ? 'HEADSHOT' : 'uccisione', kc.dist ? Math.round(kc.dist) + ' m' : ''].filter(Boolean).join(' · ')}` : 'Caduto'}${kc.data ? '' : '<small>replay non disponibile: dati del tiratore mancanti</small>'}<small><kbd>Spazio</kbd> salta</small></div>`;
  el.classList.add('on'); document.body.classList.add('kcOn'); if (typeof hideKillCard === 'function') hideKillCard();
}
function snpKcEnd() {
  const kc = SNP2.kc; if (!kc || !kc.on) return;
  kc.on = false; $('snpKc') && $('snpKc').classList.remove('on'); document.body.classList.remove('kcOn');
  for (const [b, p, y] of kc.saved) if (b.alive && !b.removed) { b.pos.copy(p); b.yaw = y; b.root.rotation.y = y; }
  if (kc.pup) { kc.pup.alive = false; kc.pup.removed = true; kc.pup.body.removed = true; if (kc.pup.root.parent) kc.pup.root.parent.remove(kc.pup.root); }
  SNP2.kcSpent = GAME.time - kc.t0;
  camera.fov = SETTINGS.fov; camera.updateProjectionMatrix();
}
// ---------- riproduzione: ritorna true finché la killcam occupa lo schermo ----------
const _kq = new V3(), _kd = new V3();
function snpKcTick(dt) {
  const kc = SNP2.kc; if (!kc || !kc.on) return false;
  if (kc.skip || KEYS.Space || KEYS.Enter) { snpKcEnd(); return false; }
  if (!kc.data) { if (GAME.time - kc.t0 > 2.2) { snpKcEnd(); return false; } return true; }   // solo la scheda d'eliminazione
  const slow = kc.shot && kc.rt > kc.tShot - .25 && kc.rt < kc.tShot + .7 ? .45 : 1;   // rallenta attorno al colpo
  kc.rt += dt * slow;
  if (kc.rt > kc.re) { snpKcEnd(); return false; }
  // tutti tornano dove erano in quell'istante
  if (kc.freeze) {
    for (const [b] of kc.saved) { const s = kcAt(b.name, kc.rt); if (s && b.alive) { b.pos.set(s.x, s.y, s.z); b.yaw = s.yaw; b.root.rotation.y = s.yaw; } }
    if (kc.pup) { const s = kcAt(SNP.me, Math.min(kc.rt, kc.tShot)); if (s) { kc.pup.pos.set(s.x, s.y, s.z); kc.pup.root.rotation.y = s.yaw; } }
  }
  const K = kcAt(kc.killer, Math.min(kc.rt, kc.tShot + .05));
  const sh = kc.shot, bt = sh ? (kc.rt - kc.tShot) / .5 : -1;
  if (sh && bt >= 0 && bt <= 1) {
    // camera sul proiettile: segue il tratto registrato dalla bocca all'impatto
    _kq.lerpVectors(sh.from, sh.end, bt); _kd.subVectors(sh.end, sh.from).normalize();
    camera.position.copy(_kq).addScaledVector(_kd, -1.6).add(_kd.clone().set(0, .25, 0)); camera.lookAt(_kq.clone().addScaledVector(_kd, 4));
    camera.fov = 40; camera.updateProjectionMatrix();
  } else if (sh && bt > 1) {
    // l'impatto visto da vicino e di lato
    _kd.subVectors(sh.end, sh.from).normalize();
    camera.position.copy(sh.end).addScaledVector(_kd, -3.2).add(new V3(-_kd.z * 1.8, .6, _kd.x * 1.8)); camera.lookAt(sh.end); camera.fov = 50; camera.updateProjectionMatrix();
  } else if (K) {
    // ripresa dagli occhi del tiratore, con l'ingrandimento dell'ottica quando mirava
    const eyeH = [1.58, 1.02, .4][K.st] || 1.58;
    camera.position.set(K.x, K.y + eyeH, K.z); camera.rotation.set(K.pitch, K.yaw, 0, 'YXZ');
    const z = K.ads && SNP_ZOOM[K.w] ? 72 / SNP_ZOOM[K.w] : SETTINGS.fov; camera.fov = lerp(camera.fov, z, Math.min(1, dt * 8)); camera.updateProjectionMatrix();
  }
  return true;
}
