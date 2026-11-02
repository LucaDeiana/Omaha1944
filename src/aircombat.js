"use strict";
// ============================================================
//  Combattimento aereo 2.0: configurazione per aereo, volo dell'IA a massa puntiforme
//  (spinta, resistenza, portanza, gravità: l'energia si conserva e si spende), pilota tattico
//  a stati con manovre vere, mira con anticipo e munizioni contate, danni per componente
//  legati al punto d'impatto e abbattimenti diversi a seconda del danno.
//  Le decisioni tattiche girano 5 volte al secondo, sfalsate fra gli aerei; il volo a ogni fotogramma.
// ============================================================

// ---------- configurazione degli aerei ----------
// Varianti rappresentate: P-47D-25 Thunderbolt e Fw 190 A-8. Masse, superfici alari, armamento e munizioni
// dalle schede tecniche; rollio, carico massimo e velocità limite in picchiata adattati al gioco.
// Le velocità (PLANE_VMAX) sono già maggiorate del 25% per il ritmo del gioco: i limiti qui seguono la stessa scala.
const AC_CFG = {
  p47: { name: 'P-47D-25 Thunderbolt', mass: 6600, S: 27.9, roll: 1.45, pitch: .85, gMax: 7.3, vne: 278, cd0: .013, k: .062,
    guns: [{ n: 8, cal: 12.7, rpm: 800, ammo: 425, dmg: 1.6, snd: 'm2' }],
    hp: { eng: 190, wl: 300, wr: 300, rud: 120, elev: 130, ail: 110, fuel: 170, guns: 140, fus: 420 } },
  fw190: { name: 'Fw 190 A-8', mass: 4400, S: 18.3, roll: 2.7, pitch: 1.05, gMax: 7.8, vne: 262, cd0: .0125, k: .066,
    guns: [{ n: 2, cal: 13, rpm: 900, ammo: 475, dmg: 1.2, snd: 'm2' }, { n: 4, cal: 20, rpm: 700, ammo: 200, dmg: 3, he: .5, snd: 'mg42', cannon: true }],
    hp: { eng: 140, wl: 190, wr: 190, rud: 90, elev: 100, ail: 90, fuel: 120, guns: 110, fus: 290 } },
};
// gli altri aerei: valori ricavati dalla loro scheda (massa, superficie, agilità, armi)
function acCfg(type) {
  if (AC_CFG[type]) return AC_CFG[type];
  const sp = (typeof PLANE_SPECS !== 'undefined' && PLANE_SPECS[type]) || PLANE_SPECS.p47, G = sp.guns || PLANE_SPECS.p47.guns, ag = sp.agile || 1, k = (sp.hp || 900) / 1000;
  return AC_CFG[type] = { name: sp.name || type, mass: sp.mass || 4500, S: sp.S || 22, roll: 1.6 * ag, pitch: .9 * ag, gMax: 7, vne: (PLANE_VMAX[type] || 600) / 3.6 * 1.3, cd0: .013, k: .064, jet: !!sp.jet,
    guns: [{ n: G.pos.length, cal: G.cal, rpm: Math.round(60 / (G.int || .07)), ammo: G.cal >= 30 ? 90 : 300, dmg: G.cal >= 30 ? 12 : G.cal >= 20 ? 3 : 1.4, he: G.he, snd: G.snd || 'm2', cannon: G.cal >= 20 }],
    hp: { eng: 160 * k, wl: 220 * k, wr: 220 * k, rud: 100 * k, elev: 110 * k, ail: 100 * k, fuel: 140 * k, guns: 120 * k, fus: 330 * k } };
}
// prestazioni derivate: velocità di stallo e potenza dal punto di equilibrio alla velocità massima
function acPerf(type) {
  const C = acCfg(type); if (C._perf) return C._perf;
  const vmax = (PLANE_VMAX[type] || 600) / 3.6, rho = 1.2, ClMax = 1.55, vs = Math.sqrt(2 * C.mass * 9.8 / (rho * C.S * ClMax));
  const q = .5 * rho * vmax * vmax, Cl = C.mass * 9.8 / (q * C.S), Dv = q * C.S * (C.cd0 + C.k * Cl * Cl);
  return C._perf = { vmax, vs, P: Dv * vmax, Tj: Dv };
}
// difficoltà: tempi di reazione, errore di mira, scelta delle manovre, cura del controllo «six»
const AC_SKILL = {
  recluta: { react: .9, aimErr: .012, fireCone: .05, maneuvers: 1, check6: .35, energy: 0, detect: 1500, mistake: .25 },
  regolare: { react: .55, aimErr: .0065, fireCone: .035, maneuvers: 2, check6: .6, energy: .5, detect: 2000, mistake: .1 },
  veterano: { react: .3, aimErr: .0035, fireCone: .025, maneuvers: 3, check6: .85, energy: 1, detect: 2500, mistake: .03 },
};
const AC_PERS = ['aggressivo', 'prudente', 'equilibrato'];
const AC = { stats: { ai: 0, brains: 0 }, seq: 0, smokeN: 0, fireN: 0 };
const _ac1 = new V3(), _ac2 = new V3(), _ac3 = new V3(), _ac4 = new V3(), _acQ = new THREE.Quaternion(), _acUp = new V3(0, 1, 0);

function acInit(p) {
  const C = acCfg(p.type), sk = AC_SKILL[(typeof SETTINGS !== 'undefined' && SETTINGS.diff) || 'regolare'] || AC_SKILL.regolare;
  p.ac = { C, P: acPerf(p.type), sk, pers: pick(AC_PERS), bank: p.roll || 0, nz: 1, thr: .85, cmdBank: 0, cmdNz: 1, cmdThr: .85,
    st: 'PATROL', stT: 0, brainT: (AC.seq++ % 5) * .04, tgt: null, seen: null, seenPos: new V3(), seenVel: new V3(), seenT: -99, threat: null,
    man: null, manT: 0, avoidT: 0, fireBurst: 0, firePause: 0, gunT: 0, react: 0, home: p.pos.clone(),
    ammo: C.guns.map(g => g.ammo * g.n), parts: Object.fromEntries(Object.entries(C.hp).map(([k, v]) => [k, v])), pmax: C.hp,
    smoke: null, fire: null, leak: null, fireT: 0, jam: 0, dead: false, fate: null };
  p.hp = Math.max(p.hp || 0, C.hp.fus);
}
// integrità di un componente da 0 a 1
const acI = (p, k) => Math.max(0, p.ac.parts[k] / p.ac.pmax[k]);

// ---------- volo: massa puntiforme con energia ----------
function acFly(p, dt) {
  const A = p.ac, C = A.C, Pf = A.P, v = p.vel, V = Math.max(8, v.length());
  const eng = A.dead ? 0 : acI(p, 'eng'), wing = Math.min(acI(p, 'wl'), acI(p, 'wr')), ctl = (k, m) => .35 + .65 * Math.min(1, acI(p, k) * m);
  const auth = clamp(V / (Pf.vs * 1.5), .3, 1) * (V > C.vne * .92 ? .55 : 1);   // comandi molli a bassa velocità e duri vicino al limite in picchiata
  // rollio: verso il comando con la velocità di rollio dell'aereo (alettoni danneggiati: più lento); ala colpita: tendenza a rollare da quel lato
  const rollRate = C.roll * auth * ctl('ail', 1.2), bias = (acI(p, 'wr') - acI(p, 'wl')) * .5;
  let dB = A.cmdBank - A.bank; dB = Math.atan2(Math.sin(dB), Math.cos(dB));
  A.bank += clamp(dB, -rollRate * dt, rollRate * dt) + bias * dt; A.bank = Math.atan2(Math.sin(A.bank), Math.cos(A.bank));
  // fattore di carico: limitato dalla portanza disponibile (stallo), dal limite strutturale e dall'elevatore
  const qd = .5 * 1.2 * V * V, nLift = qd * C.S * 1.55 * (.55 + .45 * wing) / (C.mass * 9.8), nMax = Math.min(C.gMax * ctl('elev', 1.3), nLift);
  A.stall = A.cmdNz > nLift * 1.02 && V < Pf.vs * 1.6;
  const nWant = clamp(A.cmdNz, -2.5, nMax);
  A.nz += clamp(nWant - A.nz, -7 * dt, 7 * dt) * auth;
  if (V < Pf.vs * .92) { A.nz = Math.min(A.nz, .35); A.bank += Math.sin(GAME.time * 3 + p.pos.x) * .9 * dt; }   // stallo: il muso cade e l'ala sbanda
  A.thr = lerp(A.thr, A.cmdThr, Math.min(1, dt * 1.5));
  // forze: spinta (potenza costante sulle eliche), resistenza parassita e indotta, gravità, portanza lungo l'alto dell'aereo
  const Cl = A.nz * C.mass * 9.8 / (qd * C.S), D = qd * C.S * (C.cd0 * (1 + (1 - wing) * .8) + C.k * Cl * Cl);
  const T = A.thr * (C.jet ? Pf.Tj * 1.05 : Pf.P / Math.max(V, 45)) * eng * (eng < .35 ? .6 + .4 * Math.sin(GAME.time * 7 + p.pos.z) ** 2 : 1);
  p.orient(A.bank);
  const fwd = _ac1.copy(v).multiplyScalar(1 / V), up = _ac2.set(0, 1, 0).applyQuaternion(p.q);
  v.addScaledVector(fwd, (T - D) / C.mass * dt).addScaledVector(up, A.nz * 9.8 * dt); v.y -= 9.8 * dt;
  p.pos.addScaledVector(v, dt); p.roll = A.bank;
  p.orient(A.bank);
}
// controllore: porta il vettore portanza sul punto voluto (rollio verso il bersaglio, poi tira); ali livellate quando è davanti
function acSteer(p, dir, thr, nzMax) {
  const A = p.ac, L = _ac3.copy(dir).applyQuaternion(_acQ.copy(p.q).invert());   // x destra, y alto, z dietro
  const off = Math.acos(clamp(-L.z, -1, 1)), clock = Math.atan2(L.x, L.y); A._off = off; A._clock = clock;
  if (off < .12) {   // quasi davanti: piccole correzioni ad ali quasi livellate (rollio negativo = ala destra giù)
    const yawE = Math.atan2(L.x, -L.z); A.cmdBank = clamp(-yawE * 3, -.7, .7);
    A.cmdNz = 1 / Math.max(.5, Math.cos(A.bank)) + clamp(L.y / Math.max(.2, -L.z) * 14, -1.5, 3);
  } else { A.cmdBank = A.bank - clock; A.cmdNz = Math.abs(clock) < .5 ? Math.min(nzMax, 1 + off * 24) : Math.abs(clock) < 1.2 ? Math.min(nzMax, 1 + off * 8) : 1; }
  A.cmdThr = thr;
  return off;
}
// ---------- manovre: programmi di comandi eseguiti attraverso il modello di volo ----------
const AC_MAN = {
  // virata difensiva stretta verso il lato da cui arriva la minaccia
  break: { dur: [2.5, 4], step(p, A, t) { const th = A.threat; const side = th ? Math.sign(_ac1.subVectors(th.pos, p.pos).dot(_ac2.set(1, 0, 0).applyQuaternion(p.q))) || 1 : 1; A.cmdBank = side * -1.25; A.cmdNz = A.C.gMax; A.cmdThr = 1; } },
  // tonneau: rollio continuo con poca trazione, sposta la traiettoria a spirale
  barrel: { dur: [2.2, 3], step(p, A, t) { A.cmdBank = A.bank - 1.2; A.cmdNz = 2.6; A.cmdThr = 1; } },
  // split-S: mezzo rollio sul dorso e richiamata verso il basso fino a invertire la rotta
  splitS: { dur: [5, 7], step(p, A, t) { if (t < .9) { A.cmdBank = Math.PI; A.cmdNz = .3; } else { A.cmdBank = Math.PI; A.cmdNz = A.C.gMax * .9; if (p.vel.y > -5 && t > 2.5) A.man.endT = 0; } A.cmdThr = .5; } },
  // Immelmann: mezzo looping e mezzo rollio, inverte la rotta guadagnando quota
  immel: { dur: [5, 7], step(p, A, t) { const up = _ac1.set(0, 1, 0).applyQuaternion(p.q); A.cmdThr = 1;
    if (!A.man.half) { A.cmdBank = 0; A.cmdNz = A.C.gMax * .85; if (up.y < -.3) { A.man.half = t; A.man.rb = A.bank + Math.PI; } }
    else { A.cmdBank = A.man.rb; A.cmdNz = 1; if (t - A.man.half > 1.8) A.man.endT = 0; } } },
  // forbici: inversioni di virata ripetute a manetta ridotta per far scavalcare l'inseguitore
  scissors: { dur: [5, 8], step(p, A, t) { const s = Math.floor(t / 1.6) % 2 ? 1 : -1; A.cmdBank = s * 1.2; A.cmdNz = A.C.gMax * .8; A.cmdThr = .45; } },
};
function acStartMan(p, k) { const A = p.ac, M = AC_MAN[k]; A.man = { k, t: 0, endT: rnd(...M.dur) }; A.manCd = 3 + (3 - A.sk.maneuvers) * 1.5; }

// ---------- percezione: niente conoscenza perfetta ----------
function acCanSee(p, q, maxD) {
  const r = _ac1.subVectors(q.pos, p.pos), d = r.length(); if (d > maxD) return false;
  const f = _ac2.copy(p.vel).normalize(), cosA = r.dot(f) / d;
  if (cosA < -.5 && R() > p.ac.sk.check6) return false;   // il settore di coda si controlla solo ogni tanto
  return true;
}
function acFoes(p) { return PLANES.filter(q => q.team !== p.team && q.alive && !q.crash && !(q.ac && q.ac.down) && !(q.player && P.mode !== 'plane')); }
// scelta del bersaglio: distanza, quanti compagni lo stanno già attaccando, aiuto a un compagno inseguito
function acPickTarget(p, foes) {
  let best = null, bs = 1e9;
  for (const q of foes) {
    const d = q.pos.distanceTo(p.pos); let s = d;
    let n = 0; for (const o of PLANES) if (o !== p && o.ac && o.team === p.team && o.ac.tgt === q && !o.crash) n++;
    s += n * 700;
    if (q.ac && q.ac.tgt && q.ac.tgt.team === p.team && q.ac.tgt !== p) s -= 500;   // sta inseguendo un mio compagno
    if (q === p.huntTarget) s -= 900; if (q.player && p.team === 'E') s -= 150;
    if (p.ac.tgt === q) s -= 300;   // isteresi: non cambia bersaglio a ogni pensiero
    if (s < bs) { bs = s; best = q; }
  }
  return best;
}
// ---------- cervello tattico (5 Hz) ----------
function acBrain(p) {
  const A = p.ac, sk = A.sk; AC.stats.brains++;
  const foes = acFoes(p);
  // percezione del bersaglio: si aggiorna solo se visibile, altrimenti resta l'ultima posizione nota
  if (!A.tgt || !A.tgt.alive || A.tgt.crash || (A.tgt.ac && A.tgt.ac.down) || GAME.time > (A.retgtT || 0)) { A.tgt = acPickTarget(p, foes); A.retgtT = GAME.time + 6; }
  const T = A.tgt;
  { let mates = 0; for (const o of PLANES) if (o !== p && o.ac && o.team === p.team && o.ac.tgt === T && !o.crash) mates++; p.pairSide = mates ? (PLANES.indexOf(p) % 2 ? 1 : -1) : 0; }
  if (T && acCanSee(p, T, sk.detect)) { if (A.seenT < GAME.time - 3) A.react = sk.react * rnd(.7, 1.3); A.seenPos.copy(T.pos); A.seenVel.copy(T.vel); A.seenT = GAME.time; }
  // minaccia: un nemico vicino che mi ha sul muso
  A.threat = null;
  for (const q of foes) { const r = _ac1.subVectors(p.pos, q.pos), d = r.length(); if (d > 900) continue; if (r.dot(p.vel) < 0) continue;   // di fronte non si scappa: si affronta
    const fq = _ac2.copy(q.vel).normalize(); if (r.dot(fq) / d > .94 && acCanSee(p, q, 900)) { A.threat = q; break; } }
  // previsione della traiettoria: terreno, mare e montagne fra 1,5 e 4,5 s
  const V = p.vel.length(); let low = false;
  for (const s of [1.5, 3, 4.5]) { const x = p.pos.x + p.vel.x * s, y = p.pos.y + p.vel.y * s, z = p.pos.z + p.vel.z * s; if (y < acGround(x, z) + 40 + V * .12) { low = true; break; } }
  // quota necessaria per uscire dalla picchiata: raggio della richiamata, tempo per raddrizzarsi, riflessi
  const agl = p.pos.y - acGround(p.pos.x, p.pos.z);
  if (p.vel.y < 0) { const sg = clamp(-p.vel.y / V, 0, 1), r = V * V / ((A.C.gMax * .85 - 1) * 9.8), tRoll = Math.abs(A.bank) > 1.2 ? Math.abs(A.bank) / (A.C.roll * .8) : 0;
    if (agl < r * (1 - Math.sqrt(1 - sg * sg)) - p.vel.y * (tRoll + .7) + 70) low = true; }
  if (low && R() > sk.mistake) A.avoidT = 1.4;
  // stato
  const dmg = (acI(p, 'eng') + acI(p, 'wl') + acI(p, 'wr') + acI(p, 'fus')) / 4, old = A.st, out = p.pos.distanceTo(A.home) > 4500;
  const seen = GAME.time - A.seenT < 6;
  let st = A.st;
  if (A.dead || dmg < .3) st = dmg < .3 && !A.dead ? 'RETREAT' : 'CRITICAL';
  else if (A.threat && A.stT > .8) st = 'EVADE';
  else if (out && !T) st = 'RETURN';
  else if (!T) st = 'PATROL';
  else if (!seen) st = 'SEARCH';
  else {
    const d = A.seenPos.distanceTo(p.pos), rel = _ac1.subVectors(A.seenPos, p.pos).normalize(), ata = Math.acos(clamp(rel.dot(_ac2.copy(p.vel).normalize()), -1, 1));
    const eDiff = (p.pos.y + V * V / 19.6) - (T.pos.y + T.vel.lengthSq() / 19.6);
    // caccia pesanti (rollio lento): non accettano a lungo il combattimento in virata, salgono e tornano in picchiata
    const heavy = A.C.roll < 2;
    if (A.st === 'REPOSITION' && A.stT < (heavy ? 7 : 4) + (A.pers === 'prudente' ? 2 : 0)) st = 'REPOSITION';
    else if (heavy && A.st === 'PURSUIT' && A.stT > 8 && sk.energy > 0) st = 'REPOSITION';
    else if (d < 160 && ata > 1.2) st = 'REPOSITION';   // sorpassato: si allontana e risale per un nuovo passaggio
    else if (d > 1400) st = 'INTERCEPT';
    else if (d < 650 && ata < .35) st = 'ATTACK';
    else st = 'PURSUIT';
    A.eDiff = eDiff;
    if (st !== 'ATTACK' && sk.energy > .4 && eDiff < -400 && A.pers !== 'aggressivo' && d > 700) st = 'REPOSITION';
  }
  if (st !== old) { const minT = old === 'EVADE' ? 2 : old === 'ATTACK' ? .6 : 1; if (A.stT >= minT || st === 'CRITICAL' || st === 'RETREAT') { A.st = st; A.stT = 0; } }
  // manovre difensive: scelte in base a quota, velocità e minaccia
  if (A.st === 'EVADE' && !A.man && !(A.manCd > 0) && A.react <= 0) {
    const agl = p.pos.y - acGround(p.pos.x, p.pos.z), n = sk.maneuvers;
    const opts = ['break']; if (n >= 2) opts.push('barrel'); if (n >= 2 && agl > 900 && V > A.P.vs * 2) opts.push('splitS'); if (n >= 3 && V < A.P.vs * 2.2) opts.push('scissors');
    acStartMan(p, pick(opts));
  }
  // attacco in picchiata dall'alto (boom and zoom) e Immelmann per tornare indietro dopo un passaggio
  if (A.st === 'REPOSITION' && !A.man && !(A.manCd > 0) && sk.maneuvers >= 3 && V > A.P.vs * 2.6 && p.pos.y - acGround(p.pos.x, p.pos.z) > 400 && R() < .5) acStartMan(p, 'immel');
}
function acGround(x, z) { let g = typeof Hf === 'function' ? Hf(x, z) : 0; if (typeof WATER_Y !== 'undefined') g = Math.max(g, WATER_Y); if (SCEN === 'sea' && typeof navyH === 'function') g = Math.max(g, navyH(x, z)); return g; }

// ---------- aggiornamento di un caccia IA ----------
function acUpdate(p, dt) {
  if (!p.ac) acInit(p);
  const A = p.ac, t0 = performance.now();
  if (A.down) { acFall(p, dt); return; }
  if (AC.debug) { (A.hist = A.hist || []).push([Math.round(p.pos.y - acGround(p.pos.x, p.pos.z)), Math.round(p.vel.y), +A.avoidT.toFixed(2), Math.round(p.pos.y), Math.round(acGround(p.pos.x, p.pos.z))]); if (A.hist.length > 12) A.hist.shift(); }
  A.stT += dt; A.react -= dt; A.manCd = (A.manCd || 0) - dt; A.avoidT -= dt;
  A.brainT -= dt; if (A.brainT <= 0) { A.brainT = .2; acBrain(p); }
  const T = A.tgt, V = p.vel.length(), vs = A.P.vs;
  let gun = false;
  // sicurezza a ogni fotogramma: molto basso e in discesa (o terreno che sale davanti) → richiamata subito
  { const ax = p.pos.x + p.vel.x * 1.2, az = p.pos.z + p.vel.z * 1.2, agl = Math.min(p.pos.y - acGround(p.pos.x, p.pos.z), p.pos.y + p.vel.y * 1.2 - acGround(ax, az)); if (agl < 70 + Math.max(0, -p.vel.y) * (1.3 + Math.abs(A.bank) / A.C.roll) && A.avoidT <= 0 && R() > A.sk.mistake * .3) A.avoidT = 1.4; }
  if (A.avoidT > 0) {   // recupero d'emergenza: ali livellate e cabrata
    A.cmdBank = 0; A.cmdNz = Math.abs(A.bank) < 1.2 ? A.C.gMax * .85 : Math.abs(A.bank) > 1.9 ? -2 : .5; A.cmdThr = 1; A.man = null;   // rovescio: spinge (il muso va verso il cielo) mentre si raddrizza, poi tira
  } else if (A.man) {
    A.man.t += dt; AC_MAN[A.man.k].step(p, A, A.man.t); if (A.man.t > A.man.endT) A.man = null;
  } else {
    const dir = _ac4; let thr = .85, nzM = A.C.gMax * (A.pers === 'prudente' ? .8 : .95);
    switch (A.st) {
      case 'ATTACK': case 'PURSUIT': case 'INTERCEPT': {
        // ultima posizione nota portata avanti col tempo: insegue dove pensa sia il bersaglio
        const age = GAME.time - A.seenT, tp = _ac1.copy(A.seenPos).addScaledVector(A.seenVel, Math.min(age, 4));
        const d = tp.distanceTo(p.pos);
        if (A.st === 'ATTACK' && T) { const L = airLeadPoint(p, T, A.C.guns[A.C.guns.length - 1]); if (L) tp.copy(L.p); gun = true; }
        else if (A.st === 'PURSUIT' && d < 500) gun = true;   // colpo d'occasione se il muso passa sull'anticipo
        else if (A.st === 'INTERCEPT') tp.addScaledVector(A.seenVel, d / 300);   // rotta d'intercettazione
        else {
          // inseguimento in coda: punta un po' dietro (lag) se si avvicina troppo in fretta, davanti (lead) se resta indietro
          const clos = -_ac2.subVectors(T ? T.vel : A.seenVel, p.vel).dot(_ac3.subVectors(tp, p.pos).normalize());
          if (clos > 60 && d < 600 && A.sk.energy > 0) tp.addScaledVector(A.seenVel, -1.2).y += 120;   // high yo-yo: esce dal piano di virata
          else if (clos < -15 && A.sk.energy > 0) { tp.addScaledVector(A.seenVel, 1.5); tp.y -= 90; }   // low yo-yo: taglia dentro e in basso
          else tp.addScaledVector(A.seenVel, d / 500);
          // due cacciatori sullo stesso bersaglio: il secondo arriva da un lato diverso
          if (p.pairSide) tp.addScaledVector(_ac2.set(-A.seenVel.z, 0, A.seenVel.x).normalize(), p.pairSide * Math.min(400, d * .4));
          thr = clos > 40 && d < 400 ? .55 : 1;
        }
        dir.subVectors(tp, p.pos).normalize(); break; }
      case 'REPOSITION': { dir.copy(p.vel).setY(0).normalize(); dir.y = A.C.roll < 2 && A.stT > 3 && A.eDiff > 300 ? -.25 : .35; dir.normalize(); thr = 1; break; }   // allunga e risale; il caccia pesante con quota in più torna giù in picchiata
      case 'SEARCH': { dir.subVectors(A.seenPos, p.pos).setY(0).normalize(); dir.y = clamp((A.seenPos.y - p.pos.y) * .002, -.2, .2); dir.normalize(); thr = .8; break; }
      case 'RETREAT': case 'RETURN': { dir.subVectors(A.home, p.pos).setY(0).normalize(); dir.y = clamp((A.home.y - p.pos.y) * .002, -.15, .2); dir.normalize(); thr = A.st === 'RETREAT' ? .7 : .85; break; }
      case 'EVADE': { dir.copy(p.vel).normalize(); thr = 1; break; }
      default: { // pattuglia: largo giro in quota
        dir.copy(p.vel).setY(0).normalize().applyAxisAngle(_acUp, .25); dir.y = clamp((A.home.y - p.pos.y) * .003, -.15, .15); dir.normalize(); thr = .75; }
    }
    // vicino al suolo non punta il muso verso il basso oltre il recuperabile
    { const agl = p.pos.y - acGround(p.pos.x, p.pos.z); dir.y = Math.max(dir.y, clamp((160 - agl) / 700, -1, .05)); dir.normalize(); }
    // velocità minima operativa: se è lento non tira (evita lo stallo) e abbassa il muso
    if (V < vs * 1.35) { nzM = Math.min(nzM, 1.4); dir.y = Math.min(dir.y, -.15); thr = 1; }
    acSteer(p, dir, thr, nzM);
  }
  // distanza dagli altri aerei: se un compagno è sulla traiettoria, scarta di lato
  for (const o of PLANES) { if (o === p || o.crash) continue; const r = _ac1.subVectors(o.pos, p.pos), d2 = r.lengthSq(); if (d2 < 70 * 70 && r.dot(p.vel) > 0) { A.cmdBank += (r.dot(_ac2.set(1, 0, 0).applyQuaternion(p.q)) > 0 ? .6 : -.6); break; } }
  acFly(p, dt);
  if (gun && T) acGuns(p, T, dt); else A.gunT -= dt;
  acDamageFx(p, dt);
  // passaggio ravvicinato vicino alla telecamera
  if (GAME.time > (A.flyT || 0) && dist2Cam(p.pos) < 70 * 70 && Math.abs(p.pos.y - camera.position.y) < 60) { A.flyT = GAME.time + 4; acSnd(p, 'flyby', 'flyby'); }
  // ultima sicurezza: sotto il suolo è uno schianto vero (nessun teletrasporto in quota)
  if (p.pos.y < acGround(p.pos.x, p.pos.z) + 1.5) { (AC.crashLog = AC.crashLog || []).push({ st: A.st, man: A.man && A.man.k, bank: +A.bank.toFixed(2), vy: Math.round(p.vel.y), v: Math.round(p.vel.length()), avoid: +A.avoidT.toFixed(2), nz: +A.nz.toFixed(1), stall: A.stall, eng: +acI(p, 'eng').toFixed(2), elev: +acI(p, 'elev').toFixed(2), hist: A.hist }); acKill(p, 'ground', null); }
  AC.stats.ai += performance.now() - t0;
}
// ---------- armi dell'IA: raffiche con anticipo, munizioni contate, inceppamenti ----------
function acGuns(p, T, dt) {
  const A = p.ac, sk = A.sk; A.gunT -= dt;
  if (A.react > 0 || A.jam > 0) { A.jam -= dt; return; }
  const G0 = A.C.guns[A.C.guns.length - 1], L = airLeadPoint(p, T, G0); if (!L) return;
  const rel = _ac1.subVectors(L.p, p.pos), d = rel.length(), f = _ac2.copy(p.vel).normalize();
  const eff = G0.cal >= 20 ? 520 : 650;
  const allow = sk.fireCone * 2 + 8 / Math.max(80, d);   // il bersaglio vicino occupa più spazio nel collimatore
  if (d > eff || Math.acos(clamp(rel.dot(f) / d, -1, 1)) > allow) { A.fireBurst = 0; return; }
  if (A.firePause > 0) { A.firePause -= dt; return; }
  if (A.gunT > 0) return;
  const gk = acI(p, 'guns'); if (gk < .2) return;
  if (gk < .6 && R() < .02) { A.jam = rnd(1.5, 4); return; }
  let fired = false;
  A.C.guns.forEach((g, i) => {
    if (A.ammo[i] <= 0) return;
    const n = Math.max(1, Math.round(g.n * gk)); A.ammo[i] -= n;
    const err = sk.aimErr * (1 + d / 600), dir = rel.clone().normalize().add(_ac3.set(rnd(-err, err), rnd(-err, err), rnd(-err, err))).normalize();
    fireAirBullet(p.pos.clone().addScaledVector(f, 5), dir, p.vel, g, g.dmg * n, false, p.team);
    if (dist2Cam(p.pos) < 900 * 900) sfxShot(g.snd, p.pos, false, 0, 'aircraft.' + p.type + (g.cannon ? '.cannon_fire' : '.guns_fire'));
    fired = true;
  });
  if (!fired) return;
  A.gunT = .09; A.fireBurst += .09;
  if (A.fireBurst > rnd(.5, .9)) { A.fireBurst = 0; A.firePause = rnd(.4, .9); }
}

// ---------- danni per componente ----------
// il punto d'impatto (sulla sfera di collisione) viene riportato nelle coordinate dell'aereo:
// di lato le ali (e gli alettoni verso l'estremità), davanti il motore, dietro timone ed elevatore, al centro serbatoi e fusoliera
function acHit(p, a, byPlayer, pt, G) {
  if (!p.ac) acInit(p);
  const A = p.ac; if (A.down) return;
  if (byPlayer) p.lastByPlayer = true;
  const loc = _ac1.copy(pt || p.pos).sub(p.pos).applyQuaternion(_acQ.copy(p.q).invert());
  const ax = Math.abs(loc.x), parts = [];
  if (ax > 1.4) { const w = loc.x < 0 ? 'wl' : 'wr'; parts.push([w, 1]); if (ax > 3.3) parts.push(['ail', .5]); if (ax > 2 && ax < 3.6) parts.push(['guns', .35]); }
  else if (loc.z < -1.8) parts.push(['eng', 1]);
  else if (loc.z > 2.8) parts.push([loc.y > .3 ? 'rud' : 'elev', 1]);
  else { parts.push([Math.abs(loc.z) < 1.2 && R() < .5 ? 'fuel' : 'fus', 1]); if (loc.z < 0 && loc.y > 0) A.cockpitHits = (A.cockpitHits || 0) + (G && G.cal >= 20 ? 1 : .35); }
  const he = G && G.he ? 1 + G.he : 1;
  for (const [k, f] of parts) A.parts[k] = Math.max(0, A.parts[k] - a * f * he);
  if (he > 1) for (const k of ['fus', 'fuel']) A.parts[k] = Math.max(0, A.parts[k] - a * .25);   // schegge dei proiettili esplosivi
  p.hp = A.parts.fus;
  if (dist2Cam(p.pos) < 500 * 500 && R() < .3) { if (typeof caHas === 'function' && caHas('aircraft.' + p.type + '.damage')) caPlay('aircraft.' + p.type + '.damage', p.pos); else play('imp_metal', p.pos, { ref: 40, vol: .7 }); }
  // conseguenze: incendio dai serbatoi o dal motore, ala che cede, pilota colpito, struttura che salta
  if (!A.fire && (acI(p, 'fuel') < .3 || (acI(p, 'eng') < .15 && R() < .3)) && R() < (he > 1 ? .5 : .25)) acIgnite(p);
  if (acI(p, 'eng') <= 0 && !A.dead) { A.dead = true; if (!A.smoke) acSmoke(p, 'heavy'); }
  if (acI(p, 'wl') <= 0) return acKill(p, 'wing', -1, byPlayer);
  if (acI(p, 'wr') <= 0) return acKill(p, 'wing', 1, byPlayer);
  if ((A.cockpitHits || 0) > 2.5 + R() * 2) return acKill(p, 'pilot', null, byPlayer);
  if (A.parts.fus <= 0) return acKill(p, he > 1.3 ? 'explode' : 'struct', null, byPlayer);
}
function acSmoke(p, lvl) { const A = p.ac; if (A.smoke) A.smoke.life = 0; if (AC.smokeN > 12) return; A.smoke = addEmitter(p.pos, lvl === 'heavy' ? 'smoke' : 'trail', lvl === 'heavy' ? 1 : .45); A.smoke.follow = q => q.copy(p.pos); A.smoke.life = 1e9; A.smokeLvl = lvl; AC.smokeN++; }
function acIgnite(p) {
  const A = p.ac; A.fire = addEmitter(p.pos, 'fire', .45); A.fire.follow = q => q.copy(p.pos); A.fire.life = 1e9; AC.fireN++; A.fireT = 0;
  if (!A.smoke || A.smokeLvl !== 'heavy') acSmoke(p, 'heavy');
  if (dist2Cam(p.pos) < 900 * 900 && typeof caHas === 'function' && caHas('aircraft.' + p.type + '.fire')) caPlay('aircraft.' + p.type + '.fire', p.pos);
}
// fumo e incendio che crescono col danno; l'incendio consuma ala e fusoliera finché qualcosa cede
function acDamageFx(p, dt) {
  const A = p.ac, e = acI(p, 'eng');
  if (!A.smoke && e < .6) acSmoke(p, e < .3 ? 'heavy' : 'light'); else if (A.smoke && A.smokeLvl === 'light' && e < .3) acSmoke(p, 'heavy');
  if (A.fire) { A.fireT += dt; A.parts.fus -= dt * 9; A.parts.wl -= dt * 3; A.parts.fuel -= dt * 6; if (A.parts.wl <= 0) return acKill(p, 'wing', -1, p.lastByPlayer); if (A.parts.fus <= 0 || A.fireT > rnd(14, 30)) return acKill(p, A.fireT > 10 && R() < .5 ? 'explode' : 'burn', null, p.lastByPlayer); }
  if (A.dead && !A.down && p.pos.y - acGround(p.pos.x, p.pos.z) < 30) acKill(p, 'glide', null, p.lastByPlayer);
}
// ---------- abbattimenti ----------
// ala: avvitamento; pilota: picchiata senza controllo; incendio: spirale che brucia; motore fermo: planata e atterraggio di fortuna;
// struttura o esplosivo: esplode in aria; suolo: schianto
function acKill(p, kind, side, byPlayer) {
  const A = p.ac; if (A.down) return;
  A.down = kind; A.downT = 0; A.fallBank = A.bank; p.crash = true;
  if (byPlayer || p.lastByPlayer) { STATS.kills += 2; feed(p.team === 'E' ? (kind === 'pilot' ? 'Pilota nemico colpito!' : kind === 'wing' ? 'Ala staccata: caccia abbattuto!' : 'Caccia nemico abbattuto!') : 'Aereo abbattuto'); }
  if (p.team === 'E' && dist2Cam(p.pos) < 900 * 900 && SCEN !== 'air') say(N.walsh, 'L\'hanno preso! Sta precipitando!');
  if (kind === 'wing') p.loseWing(side || (R() < .5 ? -1 : 1));
  if (kind === 'explode') { acSnd(p, 'explosion', 'boom_big'); p.blowUp(); acClean(p); return; }
  if (kind === 'ground') { acImpact(p); return; }
  if (!A.smoke) acSmoke(p, 'heavy');
  p.trail = A.smoke;
}
function acSnd(p, ev, orig) { if (typeof caHas === 'function' && caHas('aircraft.' + p.type + '.' + ev)) caPlay('aircraft.' + p.type + '.' + ev, p.pos); else play(orig, p.pos, { ref: 300, vol: 1 }); }
function acFall(p, dt) {
  const A = p.ac, v = p.vel; A.downT += dt;
  const g = acGround(p.pos.x, p.pos.z), agl = p.pos.y - g;
  if (A.down === 'glide') {   // planata col motore fermo: muso basso, ali livellate, cerca di arrivare a terra piano
    A.cmdBank = 0; A.cmdNz = agl < 25 ? 1.15 : .95; A.cmdThr = 0; acFly(p, dt);
    if (agl < 2) { const slow = v.length() < A.P.vs * 1.8 && v.y > -6; if (slow) { A.down = 'landed'; v.set(0, 0, 0); p.pos.y = g + 1; if (A.smoke) A.smoke.life = 20; feed('Caccia nemico costretto ad atterrare'); p.fireT = 0; setTimeout(() => p.alive && p.remove(), 20000); } else acImpact(p); }
    return;
  }
  if (A.down === 'landed') return;
  // caduta: gravità vera, resistenza, rotazione secondo il tipo di danno
  v.y -= 9.8 * dt * (A.down === 'pilot' ? 1.15 : 1); v.multiplyScalar(1 - .08 * dt);
  A.fallBank += dt * (A.down === 'wing' ? 6 * (p.wingLost || 1) : A.down === 'burn' ? 1.8 : A.down === 'pilot' ? .4 : 2.4);
  if (A.down === 'burn' && A.downT > 6 && R() < dt * .08) { acSnd(p, 'explosion', 'boom_big'); p.blowUp(); acClean(p); return; }
  p.pos.addScaledVector(v, dt); p.orient(A.fallBank);
  if (p.pos.y < g + 1) acImpact(p);
}
function acImpact(p) {
  const g = acGround(p.pos.x, p.pos.z), wet = typeof WATER_Y !== 'undefined' && g <= WATER_Y + .01 && (typeof Hf !== 'function' || Hf(p.pos.x, p.pos.z) < WATER_Y || SCEN === 'sea');
  const at = p.pos.clone().setY(g + .5);
  if (wet) { fxExplosion(at, 2.2, true); acSnd(p, 'explosion', 'boom_water'); }
  else { explode(at, 12, 500, {}); acSnd(p, 'explosion', 'boom_big'); }
  acClean(p); p.remove();
}
function acClean(p) { const A = p.ac; if (A.smoke) { A.smoke.life = 0; AC.smokeN--; } if (A.fire) { A.fire.life = 0; AC.fireN--; } A.smoke = A.fire = null; }
// per il benchmark: aerei già colpiti, con fumo e qualche componente ridotto
function acDamageDemo(p) { if (!p.ac) acInit(p); const A = p.ac; A.parts.eng *= .25; A.parts.wl *= .6; acSmoke(p, 'heavy'); }
