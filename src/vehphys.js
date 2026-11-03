"use strict";
// ============================================================
//  VEHICLE PHYSICS 2.0 — fisica comune dei carri armati (giocatore e IA usano lo stesso modello).
//  Unità SI: massa kg, potenza W, velocità m/s, forze N, angoli rad, lunghezze m.
//  - passo fisso (60 Hz vicino, 30 Hz a media distanza, 15 Hz lontano) con accumulatore e massimo 6 passi;
//  - moto longitudinale: spinta = potenza utile / velocità (limitata dall'aderenza e dal regolatore), pendenza,
//    resistenza al rotolamento, freni e freno motore; retromarcia separata;
//  - sterzata a cingoli differenziali: raggio minimo, sterzata su un cingolo bloccato da fermi (frizione e freno),
//    rotazione sul posto solo per chi la aveva (Tiger I, cambio Olvar con sterzo rigenerativo);
//  - resistenza alla sterzata (Merritt): M = μt·N·L/4, il cingolo esterno spinge Mr/B in più;
//  - sospensione a punti di contatto lungo i due lati (molla + smorzatore + finecorsa) su 3 gradi di libertà:
//    altezza, beccheggio, rollio; da lontano assetto calcolato dal terreno senza molle;
//  - collisioni: tre cerchi lungo lo scafo contro i solidi (griglia spaziale) e contro gli altri carri;
//    ostacoli più bassi del gradino superabile vengono scavalcati sollevando lo scafo;
//  - danni per componente, corazza inclinata, rinculo, fumo, relitti limitati, audio dal regime del motore.
// ============================================================
const VP = { list: [], wrecks: [], WRECK_MAX: 10, WRECK_TIME: 240, grid: null, gridN: -1, CELL: 12, st: { phys: 0, col: 0, ai: 0, n: 0 }, step: .6, marks: null };
// ---------- superfici: μ = aderenza (forza di trazione massima / peso), crr = resistenza al rotolamento (forza / peso),
// rough = ampiezza delle vibrazioni della camera, dust = colore della polvere. Ordini di grandezza da manuali di mobilità
// fuoristrada per veicoli cingolati (strada 0,9/0,03; terra battuta 0,8/0,07; ghiaia desertica e sabbia compatta 0,7/0,065; sabbia sciolta 0,5/0,12;
// neve 0,35/0,09; fango 0,4/0,18; roccia 0,7/0,04).
const VP_TRACT = .55;   // sforzo di trazione massimo in prima marcia / peso (carri dell'epoca: 0,5-0,7, pendenza massima ~30°)
const VP_GEARS = [.2, .38, .58, .8, 1];   // velocità massima di ciascuna delle cinque marce, frazione di vmax
const VP_SURF = {
  road: { name: 'strada', mu: .9, crr: .03, rough: .15, dust: [.62, .58, .52] },
  dirt: { name: 'terra', mu: .8, crr: .07, rough: .45, dust: [.5, .43, .34] },
  grass: { name: 'prato', mu: .7, crr: .07, rough: .4, dust: [.45, .42, .32] },
  sand: { name: 'sabbia compatta e ghiaia', mu: .7, crr: .065, rough: .35, dust: [.82, .74, .6] },
  loose: { name: 'sabbia sciolta', mu: .5, crr: .12, rough: .3, dust: [.86, .78, .62] },
  snow: { name: 'neve', mu: .35, crr: .09, rough: .3, dust: [.92, .93, .96] },
  snowroad: { name: 'strada innevata', mu: .45, crr: .045, rough: .2, dust: [.9, .9, .92] },
  mud: { name: 'fango', mu: .4, crr: .18, rough: .5, dust: [.3, .26, .2] },
  rock: { name: 'roccia', mu: .7, crr: .04, rough: .7, dust: [.6, .56, .5] },
};
function vpSurface(x, z) {
  const sl = Math.abs(Hf(x + 2, z) - Hf(x - 2, z)) + Math.abs(Hf(x, z + 2) - Hf(x, z - 2));
  if (SCEN === 'kas') { if (typeof kasRoadX === 'function' && Math.abs(x - kasRoadX(z)) < 5) return VP_SURF.road; if (sl > 1.4) return VP_SURF.rock; return fbm(x * .01 + 7, z * .01, 2) > .64 ? VP_SURF.loose : VP_SURF.sand; }
  if (SCEN === 'ard') { if (typeof ardRoadX === 'function' && Math.abs(x - ardRoadX(z)) < 5) return VP_SURF.snowroad; return VP_SURF.snow; }
  if (typeof roadPathX === 'function' && Math.abs(x - roadPathX(z)) < 5) return VP_SURF.road;
  if (z > -70) return VP_SURF.loose;   // spiaggia
  if (sl > 1.6) return VP_SURF.rock;
  return fbm(x * .02 + 3, z * .02, 2) > .66 ? VP_SURF.mud : VP_SURF.grass;
}
// ---------- caratteristiche dei mezzi ----------
// mass kg · power W (potenza del motore) · eta rendimento della trasmissione e dei cingoli · vmax/vrev m/s (regolatore)
// brake m/s² (freni) · engBrake m/s² (freno motore a vuoto) · track interasse dei cingoli m · lc lunghezza a terra m
// rmin raggio minimo di sterzata a velocità m · wMax rad/s · wSlow rad/s sterzata da fermi su un cingolo · pivot rotazione sul posto
// pivotW rad/s · nPts punti di contatto per lato · freq Hz e zeta della sospensione · travel corsa m · step gradino superabile m
// recoil arretramento della canna m · recT s · recTau s · shellM kg · v0 m/s · gunH altezza degli orecchioni sopra il baricentro m
// trav/elev rad/s · elevMin/elevMax rad · stab stabilizzatore in elevazione (solo M4) · mg cadenza della coassiale s
// arm: [spessore mm, inclinazione dalla verticale in gradi] per fronte, fronte inferiore, fianco, retro, tetto, torretta fronte/fianco/retro
const VP_CFG = {
  sherman: { strip: [1.24, 1.03, .42], name: 'M4A1 Sherman', mass: 30300, power: 298e3, eta: .65, vmax: 11.6, vrev: 3.6, brake: 3.5, engBrake: .45, track: 2.1, lc: 3.8, rmin: 9.4, wMax: .55, wSlow: .22, pivot: false, pivotW: 0, nPts: 4, freq: 1.45, zeta: .42, travel: .17, step: .6, recoil: .3, recT: .06, recTau: .22, shellM: 6.8, v0: 620, gunH: 1.0, trav: .42, elev: .3, elevMin: -.17, elevMax: .44, stab: .75, mg: .13, half: [1.4, 3.0],
    arm: { f: [51, 56], lf: [51, 45], s: [38, 0], r: [38, 10], top: [19, 90], tf: [76, 0], ts: [51, 5], tr: [51, 0] } },
  pz4: { strip: [1.24, 1.06, .42], name: 'Panzer IV', mass: 25000, power: 220e3, eta: .65, vmax: 10.5, vrev: 3.2, brake: 3.5, engBrake: .45, track: 2.4, lc: 3.5, rmin: 8, wMax: .55, wSlow: .22, pivot: false, pivotW: 0, nPts: 4, freq: 1.6, zeta: .38, travel: .14, step: .6, recoil: .52, recT: .07, recTau: .28, shellM: 6.8, v0: 740, gunH: 1.1, trav: .3, elev: .3, elevMin: -.14, elevMax: .35, stab: 0, mg: .07, half: [1.45, 2.95],
    arm: { f: [80, 10], lf: [80, 12], s: [30, 0], r: [20, 10], top: [12, 90], tf: [50, 10], ts: [30, 25], tr: [30, 15] } },
  pz3: { strip: [1.22, 1.2, .4], name: 'Panzer III', mass: 21800, power: 220e3, eta: .65, vmax: 11, vrev: 3.4, brake: 3.5, engBrake: .45, track: 2.5, lc: 2.9, rmin: 7.5, wMax: .6, wSlow: .24, pivot: false, pivotW: 0, nPts: 3, freq: 1.7, zeta: .38, travel: .14, step: .6, recoil: .3, recT: .05, recTau: .2, shellM: 2.1, v0: 830, gunH: 1.0, trav: .35, elev: .35, elevMin: -.17, elevMax: .35, stab: 0, mg: .07, half: [1.45, 2.75],
    arm: { f: [50, 10], lf: [50, 20], s: [30, 0], r: [30, 10], top: [16, 90], tf: [57, 15], ts: [30, 25], tr: [30, 12] } },
  tiger: { strip: [1.42, 1.07, .72], name: 'Tiger I', mass: 57000, power: 478e3, eta: .65, vmax: 10, vrev: 2.8, brake: 3, engBrake: .4, track: 2.8, lc: 3.6, rmin: 7, wMax: .42, wSlow: .2, pivot: true, pivotW: .2, nPts: 4, freq: 1.25, zeta: .45, travel: .2, step: .79, recoil: .58, recT: .08, recTau: .32, shellM: 10.2, v0: 810, gunH: 1.3, trav: .2, elev: .25, elevMin: -.14, elevMax: .26, stab: 0, mg: .07, half: [1.8, 3.2],
    arm: { f: [100, 9], lf: [100, 25], s: [80, 0], r: [80, 8], top: [25, 90], tf: [100, 0], ts: [80, 0], tr: [80, 0] } },
};
for (const C of Object.values(VP_CFG)) {   // grandezze derivate
  const g = 9.81, n = C.nPts * 2, L = C.half[1] * 2, W = C.half[0] * 2, H = 2.6;
  C.kTot = C.mass * Math.pow(TAU * C.freq, 2); C.cTot = 2 * C.zeta * Math.sqrt(C.kTot * C.mass); C.s0 = C.mass * g / C.kTot;
  C.Ith = C.mass * (L * L + H * H) / 12; C.Iph = C.mass * (W * W + H * H) / 12;
}
// ---------- componenti: posizione nel riferimento dello scafo (x destra, y su, z indietro) ----------
function vpBoxes(t) {
  if (t.vpBox) return t.vpBox;
  const h = t.vc.half, hh = t.T ? t.T.hullH : 1.9, ty = t.G ? t.G.turY : 1.67, tz = t.G ? t.G.turZ : 0;
  return t.vpBox = {
    engine: [-.9, .45, h[1] * .35, .9, hh - .1, h[1] - .25],
    trans: [-.9, .25, -h[1] + .15, .9, 1.15, -h[1] + 1.15],
    ammo: [-1.25, .9, -1.3, 1.25, 1.7, .5],
    turret: [-.9, ty - .15, tz - .9, .9, ty + .9, tz + 1.0],
    gun: [-.35, ty + .1, tz - 1.6, .35, ty + .85, tz - .7],
  };
}
// ---------- stato iniziale ----------
function vpInit(t, type) {
  const C = t.vc = VP_CFG[type] || VP_CFG.pz4;
  t.cm = { hull: 100, turret: 100, gun: 100, engine: 100, trans: 100, trackL: 100, trackR: 100, ammo: 100 };
  t.vp = { v: 0, w: 0, vl: 0, y: t.pos.y, vy: 0, th: 0, ph: 0, wth: 0, wph: 0, acc: 0, contact: 1, surf: VP_SURF.dirt, surfT: 0, slip: 0, gp: new Float32Array(16), gpN: 0, lod: 0, dL: 0, dR: 0, stall: 0, pw: 0, shift: 0, rcT: 9, rc: 0, rpm: 700, gear: 0, smokeT: 0, stuck: 0, prog: t.pos.clone(), blockT: 0 };
  t.cmdThr = 0; t.cmdSteer = 0; t.gunZ0 = t.gg ? t.gg.position.z : 0; t.marks = [];
  vpPoseKin(t, 1, true); VP.list.push(t); vpTrackStrips(t);
}
function vpLod(t) {
  if (t.player) return 0;
  const d2 = t.pos.distanceToSquared(camera.position);
  return d2 < 160 * 160 ? 0 : d2 < 450 * 450 ? 1 : 2;
}
// ---------- aggiornamento per fotogramma ----------
function vpTick(t, dt) {
  const S = t.vp, C = t.vc, L = vpLod(t), h = L === 0 ? 1 / 60 : L === 1 ? 1 / 30 : 1 / 15, t0 = performance.now();
  S.lod = L; S.acc = Math.min(S.acc + dt, h * 6);
  while (S.acc >= h) { S.acc -= h; vpStep(t, h, L); }
  t.speed = S.v; t.pos.y = S.y;
  // rinculo della canna (arretramento lineare, poi ritorno smorzato esponenziale)
  S.rcT += dt; S.rc = S.rcT < C.recT ? C.recoil * S.rcT / C.recT : C.recoil * Math.exp(-(S.rcT - C.recT) / C.recTau);
  if (t.gg) t.gg.position.z = t.gunZ0 + (S.rc > .002 ? S.rc : 0);
  t.g.rotation.set(S.th, t.yaw, S.ph, 'YXZ');
  // ingombro per i proiettili delle armi leggere: scatola orientata approssimata
  const h0 = C.half[0], h1 = C.half[1], cy = Math.abs(Math.cos(t.yaw)), sy = Math.abs(Math.sin(t.yaw)), ex = cy * h0 + sy * h1, ez = sy * h0 + cy * h1;
  t.box.min.set(t.pos.x - ex, t.pos.y, t.pos.z - ez); t.box.max.set(t.pos.x + ex, t.pos.y + (t.T ? t.T.hullH + 1 : 2.6), t.pos.z + ez);
  VP.st.phys += performance.now() - t0;
  if (L < 2) { vpFx(t, dt); vpStrips(t, dt); }
  vpAudio(t, dt);
  // canna dentro un edificio: niente tiro (non c'è collisione fisica della canna)
  if ((S.blockT -= dt) <= 0) { S.blockT = .2; if (t.muzzle && typeof pointInSolid === 'function') t.gunBlocked = pointInSolid(t.muzzle(_vpA)); }
}
const _vpA = new V3(), _vpB = new V3();
function vpStep(t, h, L) {
  const C = t.vc, S = t.vp, cm = t.cm, m = C.mass, g = 9.81;
  if ((S.surfT -= h) <= 0) { S.surfT = .3; S.surf = vpSurface(t.pos.x, t.pos.z); }
  const sf = S.surf, sy = Math.sin(t.yaw), cy = Math.cos(t.yaw);
  let thr = clamp(t.cmdThr || 0, -1, 1), st = clamp(t.cmdSteer || 0, -1, 1);
  // danni: motore, trasmissione, cingoli, pilota
  if (S.stall > 0) S.stall -= h;
  const eng = cm.engine / 100, tr = cm.trans / 100, Pk = eng <= 0 || S.stall > 0 ? 0 : .3 + .7 * eng;
  const immob = cm.trackL <= 0 || cm.trackR <= 0 || tr <= 0; t.immob = immob;
  if (immob || t.noDriver || Pk === 0) { thr = 0; st = 0; }
  // clutch-brake: da fermi senza rotazione sul posto si sterza tenendo fermo un cingolo, il carro avanza un poco
  if (!C.pivot && Math.abs(thr) < .1 && Math.abs(st) > .1 && Math.abs(S.v) < 1.2) thr = .3;
  const N = m * g * Math.cos(S.th) * Math.cos(S.ph), Fmax = sf.mu * N * S.contact, v = S.v;
  const vmax = (thr >= 0 ? C.vmax : C.vrev) * (.5 + .5 * Math.max(0, tr));
  // potenza alla ruota motrice: innesto progressivo (frizione e motore che sale di giri, ~1,5 s) e brevi cali ai cambi di marcia;
  // la sterzata consuma potenza (momento resistente Mr = μt·N·L/4 per la velocità di rotazione), il resto spinge
  S.pw += clamp((thr !== 0 || st !== 0 ? 1 : .2) - S.pw, -h * 1.5, h * .5);
  // marcia con isteresi: sale oltre il 98% della marcia, scende sotto l'80% della precedente
  let gr = S.gear; const av = Math.abs(v);
  while (gr < 4 && av > C.vmax * VP_GEARS[gr] * .98) gr++;
  while (gr > 0 && av < C.vmax * VP_GEARS[gr - 1] * .8) gr--;
  if (gr > S.gear && thr !== 0) S.shift = .45; S.gear = gr; if (S.shift > 0) S.shift -= h;
  const Mr = .5 * sf.mu * N * C.lc / 4, Ptot = C.power * C.eta * Pk * S.pw * (S.shift > 0 ? .2 : 1), Psteer = Mr * Math.abs(S.w), Pdrive = Math.max(0, Ptot - Psteer);
  let F;
  // spinta: a passo d'uomo la limita la coppia della prima marcia (tractK × peso), poi la potenza (P / v), infine il regolatore
  if (thr !== 0 && Math.abs(v) > vmax * 1.03 && Math.sign(thr) === Math.sign(v)) F = -Math.sign(v) * Math.min(C.brake * m, (Math.abs(v) - vmax) * m * 2);   // in discesa: freno motore e freni tengono la velocità
  else if (thr !== 0 && (Math.sign(thr) === Math.sign(v) || Math.abs(v) < .4)) F = thr * Math.min(VP_TRACT * m * g * S.pw, Pdrive / Math.max(Math.abs(v), .3)) * clamp((vmax - Math.abs(v)) / 1.2, 0, 1);
  else if (thr !== 0) F = -Math.sign(v) * C.brake * m * Math.abs(thr);
  else F = -Math.sign(v) * C.engBrake * m;
  F = clamp(F, -Fmax, Fmax);
  const Fg = m * g * Math.sin(S.th), Fr = sf.crr * N * S.contact;
  let nv;
  if (thr === 0 && Math.abs(v) < .3 && Math.abs(Fg) < Fmax + Fr) nv = 0;   // freni: fermo anche in pendenza se l'aderenza basta
  else { nv = v + (F - Fg) / m * h; const ar = Fr / m * h; nv = Math.abs(nv) <= ar && thr === 0 ? 0 : nv - Math.sign(nv) * Math.min(Math.abs(nv), ar); }
  // sterzata
  let wDes = st * Math.min(C.wMax, Math.max(C.wSlow, Math.abs(nv) / C.rmin));
  if (C.pivot && Math.abs(nv) < 1.5) wDes = st * Math.max(C.pivotW * (1 - Math.abs(nv) / 1.5), Math.min(C.wMax, Math.abs(nv) / C.rmin));
  if (nv < -.2) wDes = -wDes;
  wDes *= .55 + .45 * Math.min(1, sf.mu / .8);   // su fondi cedevoli il cingolo slitta e la sterzata rende meno
  if (!immob) wDes += (cm.trackR - cm.trackL) / 100 * .1 * nv / C.vmax;   // un cingolo danneggiato tira da quella parte
  if (Pk === 0 || immob) wDes = 0;
  const aMax = sf.mu * g * .7;
  if (Math.abs(nv * wDes) > aMax) { S.slip = 1; wDes = Math.sign(wDes) * aMax / Math.max(.1, Math.abs(nv)); } else S.slip = Math.max(0, S.slip - h * 2);
  if (Mr * Math.abs(wDes) > Ptot * .85) wDes = Math.sign(wDes) * Ptot * .85 / Mr;   // il motore non basta per girare più in fretta
  S.w += clamp(wDes - S.w, -1.2 * h, 1.2 * h);
  S.v = nv; t.yaw += S.w * h;
  // scivolamento laterale sui pendii troppo ripidi per l'aderenza
  const sp = Math.sin(S.ph), cp = Math.cos(S.ph);
  if (Math.abs(sp) > sf.mu * cp) S.vl += -Math.sign(sp) * g * (Math.abs(sp) - sf.mu * cp) * h; else S.vl *= Math.max(0, 1 - 6 * h);
  // spostamento: avanti (-sin, -cos), destra (cos, -sin)
  t.pos.x += (-sy * S.v + cy * S.vl) * h; t.pos.z += (-cy * S.v - sy * S.vl) * h;
  S.dL += (S.v - S.w * C.track / 2) * h; S.dR += (S.v + S.w * C.track / 2) * h;
  const tc = performance.now(); vpCollide(t, h); VP.st.col += performance.now() - tc;
  if (t.vpClamp) t.vpClamp();
  if (L < 2) vpSusp(t, h, L); else vpPoseKin(t, h, false);
}
// ---------- sospensione ----------
function vpSusp(t, h, L) {
  const C = t.vc, S = t.vp, m = C.mass, g = 9.81, n = L === 0 ? C.nPts : Math.min(3, C.nPts), kp = C.kTot / (2 * n), cp = C.cTot / (2 * n);
  const sy = Math.sin(t.yaw), cy = Math.cos(t.yaw), sth = Math.sin(S.th), sph = Math.sin(S.ph);
  if (S.gpN !== n) { S.gpN = n; S.gp.fill(-1e9); }
  VP.step = C.step;
  let Fy = 0, Mth = 0, Mph = 0, cnt = 0, gmin = 1e9, k = 0;
  for (let sd = -1; sd <= 1; sd += 2) for (let i = 0; i < n; i++, k++) {
    const z = -C.lc / 2 + C.lc * i / (n - 1), x = sd * C.track / 2;
    // la ruota (o la ruota tendicingolo davanti) sale su un gradino lungo una rampa di circa 45°, non di colpo; scende subito
    let gy = vpGround(t.pos.x + cy * x + sy * z, t.pos.z - sy * x + cy * z, S.y);
    if (S.gp[k] > -1e8 && gy > S.gp[k]) gy = Math.min(gy, S.gp[k] + (Math.abs(S.v) + .6) * h);
    gmin = Math.min(gmin, gy);
    const gd = S.gp[k] > -1e8 ? clamp((gy - S.gp[k]) / h, -3, 3) : 0; S.gp[k] = gy;
    const comp = gy - (S.y + x * sph - z * sth) + C.s0;
    if (comp <= 0) continue;
    const vy = S.vy + x * S.wph - z * S.wth;
    let f = kp * comp + cp * (gd - vy); if (comp > C.travel + C.s0) f += kp * 4 * (comp - C.travel - C.s0);   // finecorsa
    f = Math.max(0, f); cnt++; Fy += f; Mth += f * -z; Mph += f * x;
  }
  S.vy += (Fy / m - g) * h; S.wth += Mth / C.Ith * h - S.wth * .8 * h; S.wph += Mph / C.Iph * h - S.wph * .8 * h;
  S.y += S.vy * h; S.th = clamp(S.th + S.wth * h, -.7, .7); S.ph = clamp(S.ph + S.wph * h, -.7, .7);
  S.contact = cnt / (2 * n);
  if (S.y < gmin - .6) { S.y = gmin - .1; S.vy = Math.max(0, S.vy); }   // mai sotto il terreno
  S.vyA = Fy / m - g;
}
// da lontano: assetto dal terreno, senza molle (le collisioni restano identiche)
function vpPoseKin(t, h, snap) {
  const C = t.vc, S = t.vp, fx = -Math.sin(t.yaw), fz = -Math.cos(t.yaw), a = C.lc / 2, b = C.track / 2;
  VP.step = C.step;
  const yf = vpGround(t.pos.x + fx * a, t.pos.z + fz * a, S.y), yb = vpGround(t.pos.x - fx * a, t.pos.z - fz * a, S.y);
  const yl = vpGround(t.pos.x + fz * b, t.pos.z - fx * b, S.y), yr = vpGround(t.pos.x - fz * b, t.pos.z + fx * b, S.y);
  const ty = (yf + yb + yl + yr) / 4, tth = Math.atan2(yf - yb, a * 2), tph = Math.atan2(yr - yl, b * 2), k = snap ? 1 : Math.min(1, h * 6);
  S.y = snap ? ty : Math.max(lerp(S.y, ty, k), Math.min(yf, yb, yl, yr)); S.th = lerp(S.th, tth, k); S.ph = lerp(S.ph, tph, k); S.vy = S.wth = S.wph = 0; S.contact = 1;
}
// ---------- terreno + ostacoli bassi (griglia spaziale dei solidi) ----------
const VP_CRUSH = { sandbag: 1, hedge: 1, crate: 1, wire: 1, sand: 1 };
function vpGrid() {
  if (VP.grid && VP.gridN === solids.length) return VP.grid;
  const G = new Map(), c = VP.CELL; VP.big = [];
  for (const s of solids) {
    const x0 = Math.floor(s.min.x / c), x1 = Math.floor(s.max.x / c), z0 = Math.floor(s.min.z / c), z1 = Math.floor(s.max.z / c);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 64) { VP.big.push(s); continue; }
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100003 + j; let l = G.get(k); if (!l) G.set(k, l = []); l.push(s); }
  }
  VP.grid = G; VP.gridN = solids.length; return G;
}
const VP_EMPTY = [];
// solidi vicini a un punto (raggio piccolo): celle della griglia + solidi grandi; lista riutilizzata, senza duplicati
const _vpNear = []; let _vpNq = 0;
function vpNear(p, r) {
  const G = vpGrid(), c = VP.CELL, x0 = Math.floor((p.x - r - .5) / c), x1 = Math.floor((p.x + r + .5) / c), z0 = Math.floor((p.z - r - .5) / c), z1 = Math.floor((p.z + r + .5) / c), q = ++_vpNq; _vpNear.length = 0;
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = G.get(i * 100003 + j); if (l) for (const s of l) if (s._vpq !== q) { s._vpq = q; _vpNear.push(s); } }
  for (const s of VP.big) if (s._vpq !== q) { s._vpq = q; _vpNear.push(s); }
  return _vpNear;
}
function vpCell(x, z) { const G = vpGrid(), c = VP.CELL; return G.get(Math.floor(x / c) * 100003 + Math.floor(z / c)) || VP_EMPTY; }
function vpGround(x, z, yRef) {
  let h = Hf(x, z);
  const lim = yRef + VP.step + .05;
  for (const L of [vpCell(x, z), VP.big]) for (const s of L) {
    if (!s.on || x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z || s.max.y <= h) continue;
    if (VP_CRUSH[s.tag]) { h = Math.max(h, Math.min(s.max.y, h + .3)); continue; }   // si schiaccia: piccolo sobbalzo
    if (s.max.y <= lim && s.min.y <= lim) h = s.max.y;
  }
  return h;
}
// ---------- collisioni ----------
const _vpC = new V3();
function vpPush(p, r, yLo, yHi) {
  const c = VP.CELL, x0 = Math.floor((p.x - r) / c), x1 = Math.floor((p.x + r) / c), z0 = Math.floor((p.z - r) / c), z1 = Math.floor((p.z + r) / c), G = vpGrid();
  let hit = 0;
  const one = s => {
    if (!s.on || VP_CRUSH[s.tag] || yHi < s.min.y || yLo > s.max.y - .05) return;
    if (p.x < s.min.x - r || p.x > s.max.x + r || p.z < s.min.z - r || p.z > s.max.z + r) return;
    const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d > 0) { if (d < r) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; hit = 1; } }
    else { const l = p.x - s.min.x, rr = s.max.x - p.x, f = p.z - s.min.z, b = s.max.z - p.z, m = Math.min(l, rr, f, b); if (m === l) p.x = s.min.x - r; else if (m === rr) p.x = s.max.x + r; else if (m === f) p.z = s.min.z - r; else p.z = s.max.z + r; hit = 1; }
  };
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = G.get(i * 100003 + j); if (l) for (const s of l) one(s); }
  for (const s of VP.big) one(s);
  return hit;
}
function vpCollide(t, h) {
  const C = t.vc, S = t.vp, r = C.half[0], sy = Math.sin(t.yaw), cy = Math.cos(t.yaw), off = C.half[1] - r;
  let push = 0, dx = 0, dz = 0;
  for (let i = -1; i <= 1; i++) {
    const z = i * off; _vpC.set(t.pos.x + sy * z, 0, t.pos.z + cy * z); const ox = _vpC.x, oz = _vpC.z;
    if (vpPush(_vpC, r, S.y + C.step, S.y + 2.4)) { const ddx = _vpC.x - ox, ddz = _vpC.z - oz; t.pos.x += ddx; t.pos.z += ddz; dx += ddx; dz += ddz; push++; t.yaw += clamp((ddx * cy - ddz * sy) * z * .02, -.02, .02); }
  }
  // altri carri (anche i relitti): solo quelli abbastanza vicini; ognuno si sposta della sua parte in base alla massa
  for (const o of VP.list) {
    if (o === t || o.removedVP) continue;
    const ddx = t.pos.x - o.pos.x, ddz = t.pos.z - o.pos.z, R2 = C.half[1] + o.vc.half[1];
    if (ddx * ddx + ddz * ddz > R2 * R2) continue;
    const os = Math.sin(o.yaw), oc = Math.cos(o.yaw), oo = o.vc.half[1] - o.vc.half[0], share = o.alive ? o.vc.mass / (o.vc.mass + C.mass) : 1;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const ax = t.pos.x + sy * i * off, az = t.pos.z + cy * i * off, bx = o.pos.x + os * j * oo, bz = o.pos.z + oc * j * oo, ex = ax - bx, ez = az - bz, d = Math.hypot(ex, ez), rr = r + o.vc.half[0];
      if (d < rr && d > .01) { const k = (rr - d) * share; t.pos.x += ex / d * k; t.pos.z += ez / d * k; dx += ex / d * k; dz += ez / d * k; push++; }
    }
  }
  if (push) {
    const along = dx * -sy + dz * -cy, sp = Math.abs(S.v);   // spinta contraria al moto: urto
    if (along * S.v < 0) { if (sp > 2.5 && (S.hitT || 0) < GAME.time) { S.hitT = GAME.time + .8; play('clang', t.player ? null : t.pos, { vol: Math.min(1.4, sp * .15), rate: .6, ref: 40, cx: 'vehicle.' + (t.type || 'pz4') + '.collision' }); if (t.player) P.shake += Math.min(1, sp * .12); } S.v *= Math.max(0, 1 - 30 * h); }
  }
}
// ---------- torretta ----------
function vpTraverse(t) {
  const C = t.vc, k = t.cm.turret <= 0 ? 0 : .25 + .75 * t.cm.turret / 100;
  // Tiger: brandeggio idraulico mosso dal motore, più lento con il motore al minimo
  const rpmK = t.type === 'tiger' ? clamp(.35 + (t.vp.rpm - 700) / 2000, .35, 1) : 1;
  return C.trav * k * rpmK * (t.crew && !t.crew.gun ? .45 : 1);
}
function vpElev(t) { return t.vc.elev * (t.cm.gun <= 0 ? 0 : 1); }
// ---------- sparo: rinculo della canna, risposta dello scafo, onda di polvere ----------
function vpFire(t, o, d) {
  const C = t.vc, S = t.vp; S.rcT = 0;
  // impulso all'orecchione = quantità di moto del proietto + gas (circa la metà in più); la canna rincula sul freno,
  // lo scafo riceve l'impulso come rotazione: J·h/I. Con decine di tonnellate resta un dondolio di pochi decimi di grado.
  const J = C.shellM * C.v0 * 1.5, ty = t.tyaw || 0;
  S.wth += J * C.gunH * Math.cos(ty) / C.Ith; S.wph -= J * C.gunH * Math.sin(ty) / C.Iph;
  if (Math.abs(S.v) > .3 || t.cmdThr) S.v -= J * Math.cos(ty) / C.mass * .5;
  if (S.lod === 2) return;
  const gy = Hf(o.x, o.z), dc = S.surf.dust;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, s = rnd(4, 8); PS_SMOKE.emit(o.x + d.x * 2, gy + .3, o.z + d.z * 2, Math.cos(a) * s + d.x * 4, rnd(.2, .8), Math.sin(a) * s + d.z * 4, rnd(1.6, 2.8), 1, 4, .5, ...dc, 1.6, -.02); }
}
// ---------- danni ----------
function vpHitComp(t, k, dmg) { if (t.cm[k] === undefined || dmg <= 0) return false; const was = t.cm[k]; t.cm[k] = Math.max(0, was - dmg); return was > 0 && t.cm[k] <= 0; }
// intersezione segmento-scatola nel riferimento dello scafo
function vpSegBox(p, d, len, b) {
  let t0 = 0, t1 = len;
  for (let a = 0; a < 3; a++) {
    const o = a === 0 ? p.x : a === 1 ? p.y : p.z, dd = a === 0 ? d.x : a === 1 ? d.y : d.z, lo = b[a], hi = b[a + 3];
    if (Math.abs(dd) < 1e-6) { if (o < lo || o > hi) return -1; continue; }
    let u = (lo - o) / dd, w = (hi - o) / dd; if (u > w) { const q = u; u = w; w = q; }
    t0 = Math.max(t0, u); t1 = Math.min(t1, w); if (t0 > t1) return -1;
  }
  return t0;
}
// colpo perforante o esplosivo sul carro: faccia, spessore efficace, esito
// lp: punto d'impatto e ld: direzione del proiettile, entrambi nel riferimento dello scafo
function vpArmorHit(t, lp, ld, sh) {
  const C = t.vc, A = C.arm, T = t.T || { hullH: 1.9 }, h1 = C.half[1], h0 = C.half[0];
  // il proiettile avanza a passi di alcuni metri: si risale lungo la traiettoria fino alla superficie del carro (punto d'ingresso vero)
  { const lo = [-h0, 0, -h1], hi = [h0, T.hullH + 1.1, h1], o = [lp.x, lp.y, lp.z], u = [-ld.x, -ld.y, -ld.z]; let tb = 1e9, ax = 2;
    for (let i = 0; i < 3; i++) { if (Math.abs(u[i]) < 1e-6) continue; const q = ((u[i] > 0 ? hi[i] : lo[i]) - o[i]) / u[i]; if (q < tb) { tb = q; ax = i; } }
    if (tb > 0 && tb < 8) lp = lp.clone().addScaledVector(ld, -tb); }
  const onTur = lp.y > T.hullH;
  let face, plate, n;
  const slopeN = (deg, nx, nz) => { const s = deg * PI / 180; return new V3(nx * Math.cos(s), Math.sin(s), nz * Math.cos(s)); };
  if (lp.y > T.hullH - .05 && ld.y < -.5 && !onTur) { face = 'tetto'; plate = A.top; n = new V3(0, 1, 0); }
  else if (onTur) {
    const ty = t.tyaw || 0, cz = (t.G ? t.G.turZ : 0), lx = lp.x * Math.cos(ty) - (lp.z - cz) * Math.sin(ty), lz = lp.x * Math.sin(ty) + (lp.z - cz) * Math.cos(ty), ang = Math.atan2(lx, -lz);
    const k = Math.abs(ang) < .7 ? 'tf' : Math.abs(ang) > 2.4 ? 'tr' : 'ts'; face = k === 'tf' ? 'torretta frontale' : k === 'tr' ? 'torretta posteriore' : 'torretta laterale'; plate = A[k];
    const nl = k === 'tf' ? slopeN(plate[1], 0, -1) : k === 'tr' ? slopeN(plate[1], 0, 1) : slopeN(plate[1], Math.sign(lx) || 1, 0);
    n = new V3(nl.x * Math.cos(ty) + nl.z * Math.sin(ty), nl.y, -nl.x * Math.sin(ty) + nl.z * Math.cos(ty));
  } else if (lp.z < -h1 + .7) { const low = lp.y < .95; face = low ? 'fronte inferiore' : 'fronte'; plate = low ? A.lf : A.f; n = slopeN(plate[1], 0, -1); if (low) n.y = -n.y; }
  else if (lp.z > h1 - .6) { face = 'retro'; plate = A.r; n = slopeN(plate[1], 0, 1); }
  else { face = 'fianco'; plate = A.s; n = slopeN(plate[1], Math.sign(lp.x) || 1, 0); }
  n.normalize();
  const cosA = clamp(-ld.dot(n), 0, 1), ang = Math.acos(cosA) * 180 / PI, eff = plate[0] / Math.max(cosA, .2);
  const res = { face, armor: plate[0], eff, ang, kind: 'none', comp: [], crit: '', lp, n };
  // cingoli e ruote: fuori dalla corazza
  if (!onTur && Math.abs(lp.x) > h0 - .55 && lp.y < 1.05) {
    const k = lp.x < 0 ? 'trackL' : 'trackR', dmg = sh.he ? rnd(45, 85) : rnd(35, 70) * (sh.T.cal / 75);
    if (vpHitComp(t, k, dmg)) res.crit = 'cingolo ' + (k === 'trackL' ? 'sinistro' : 'destro') + ' spezzato';
    res.kind = 'track'; res.comp.push(k); return res;
  }
  if (sh.he) {   // esplosivo: perfora solo piastre sottili, altrimenti schegge su ottiche, canna e organi esterni
    const pen = sh.T.cal * .3; res.kind = pen > eff ? 'pen' : 'surface';
    if (onTur && lp.z < (t.G ? t.G.turZ : 0) - .5 && R() < .4) { vpHitComp(t, 'gun', rnd(15, 40)); res.comp.push('gun'); }
    if (face === 'retro' || face === 'tetto') { vpHitComp(t, 'engine', rnd(10, 30)); res.comp.push('engine'); }
    t.cm.hull = Math.max(0, t.cm.hull - (res.kind === 'pen' ? 20 : 4));
    return res;
  }
  const dist = sh.travel || 0, pen = sh.T.pen * Math.max(.45, 1 - dist / 3500) * rnd(.92, 1.08), ratio = pen / eff, overmatch = sh.T.cal > plate[0] * 2.5;
  res.pen = pen;
  if (!overmatch && ang > 70 && R() < .3 + (ang - 70) / 15) { res.kind = 'ricochet'; return res; }
  if (ratio < .8) { res.kind = 'none'; t.cm.hull = Math.max(0, t.cm.hull - 1); return res; }
  if (ratio < 1) {   // non perforato, ma la piastra si sfalda all'interno o un organo esterno si danneggia
    res.kind = 'surface'; t.cm.hull = Math.max(0, t.cm.hull - rnd(3, 8));
    if (onTur && R() < .35) { vpHitComp(t, 'gun', rnd(10, 30)); res.comp.push('gun'); } else if (R() < .3) { vpHitComp(t, 'turret', rnd(8, 20)); res.comp.push('turret'); }
    return res;
  }
  // perforazione: il proiettile attraversa l'interno per circa 2,5 m e colpisce ciò che incontra
  res.kind = 'pen'; const ck = sh.T.cal / 75, B = vpBoxes(t), left = Math.min(1.6, ratio - .6);
  t.cm.hull = Math.max(0, t.cm.hull - (18 + 30 * left) * ck);
  const hits = []; for (const k in B) { const u = vpSegBox(lp, ld, 2.6, B[k]); if (u >= 0) hits.push([u, k]); }
  hits.sort((a, b) => a[0] - b[0]);
  for (const [u, k] of hits) { const dmg = rnd(55, 100) * ck * (1 - u / 3.2) * Math.min(1.3, left + .5); if (dmg <= 0) continue; vpHitComp(t, k, dmg); res.comp.push(k); }
  if (t.cm.ammo <= 0) res.crit = 'munizioni';
  else if (t.cm.engine <= 0 && res.comp.includes('engine')) res.crit = 'motore';
  if (res.crit) res.kind = 'critical';
  return res;
}
// danni da esplosioni senza punto d'impatto (bombe, bazooka, mine, granate): alcuni colpi forti rompono componenti
function vpBlastComp(t, a, frac) {
  if (a < frac * .12) return '';
  const r = R(), k = r < .32 ? (R() < .5 ? 'trackL' : 'trackR') : r < .55 ? 'engine' : r < .7 ? 'turret' : r < .8 ? 'gun' : r < .85 ? 'ammo' : 'trans';
  const dmg = a / frac * 140 * rnd(.6, 1.2), broke = vpHitComp(t, k, dmg);
  return broke ? VP_COMP_NAME[k] : '';
}
const VP_COMP_NAME = { hull: 'scafo', turret: 'torretta', gun: 'cannone', engine: 'motore', trans: 'trasmissione', trackL: 'cingolo sinistro', trackR: 'cingolo destro', ammo: 'deposito munizioni' };
// segni d'impatto (dischi scuri sullo scafo, al massimo 10 per carro, riusati)
function vpMark(t, lp, n, pen) {
  if (!VP.marks) { VP.marks = { g: new THREE.CircleGeometry(.14, 7), m0: new THREE.MeshBasicMaterial({ color: 0x1b1a17, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), m1: new THREE.MeshBasicMaterial({ color: 0x0a0908, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) }; }
  let mk = t.marks.length >= 10 ? t.marks.shift() : new THREE.Mesh(VP.marks.g, VP.marks.m0);
  mk.material = pen ? VP.marks.m1 : VP.marks.m0; mk.scale.setScalar(pen ? 1 : .7); mk.position.copy(lp).addScaledVector(n || _vpB.set(0, 0, 0), .02);
  if (n) mk.lookAt(_vpA.copy(mk.position).add(n)); if (!mk.parent) t.g.add(mk); else if (mk.parent !== t.g) { mk.parent.remove(mk); t.g.add(mk); }
  t.marks.push(mk);
}
// ---------- effetti di danno e di movimento ----------
function vpFx(t, dt) {
  const S = t.vp, cm = t.cm, C = t.vc, sy = Math.sin(t.yaw), cy = Math.cos(t.yaw);
  if (!t.alive) return;
  S.smokeT -= dt;
  if (S.smokeT <= 0) {
    S.smokeT = S.lod === 0 ? .08 : .25;
    const ex = t.pos.x + sy * C.half[1] * .7, ez = t.pos.z + cy * C.half[1] * .7, ey = t.pos.y + 2;
    if (cm.engine < 60) { const k = cm.engine < 30 ? .14 : .45; PS_SMOKE.emit(ex + rnd(-.4, .4), ey, ez + rnd(-.4, .4), rnd(-.3, .3), 1.6, rnd(-.3, .3), 3, .8, 3.5, .55, k, k * .95, k * .9, .5, -.15); }
    if (cm.turret < 50 && R() < .5) PS_SMOKE.emit(t.pos.x, t.pos.y + 3, t.pos.z, 0, 1.2, 0, 2.2, .5, 2.2, .4, .3, .3, .3, .5, -.1);
    if (cm.engine <= 0 && R() < .6) PS_FIRE.emit(ex, ey - .2, ez, rnd(-.3, .3), 1.5, rnd(-.3, .3), .4, .8, 1.4, 1, 3, 1.6, .5);
  }
  // polvere, fango o neve dai cingoli; di più quando slittano
  const sp = Math.abs(S.v) + Math.abs(S.w) * 2 + S.slip * 4;
  if (sp > 1 && R() < dt * (S.lod === 0 ? 10 : 4) * Math.min(2, sp / 4)) {
    const dc = S.surf.dust, side = R() < .5 ? -1 : 1, bx = t.pos.x + cy * side * C.track / 2 + sy * C.half[1] * .8, bz = t.pos.z - sy * side * C.track / 2 + cy * C.half[1] * .8;
    PS_SMOKE.emit(bx, Hf(bx, bz) + .3, bz, rnd(-.5, .5), .6 + S.slip, rnd(-.5, .5), 2 + S.slip, .9, 3.2, .55, ...dc, 1);
  }
  // camera: vibrazione dal fondo e dalle accelerazioni della sospensione
  if (t.player) P.shake = Math.min(1.5, P.shake + dt * (Math.abs(S.v) * S.surf.rough * .05 + Math.min(.6, Math.abs(S.vyA || 0) * .02)));
}
// ---------- cingoli: fascia superiore con tessitura che scorre alla velocità di ciascun cingolo ----------
let VP_TRK_TEX = null;
function vpTrackStrips(t) {
  const SP = t.vc && t.vc.strip; if (!SP) return;
  if (!VP_TRK_TEX) { const c = document.createElement('canvas'); c.width = 16; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#2b2a25'; x.fillRect(0, 0, 16, 64); x.fillStyle = '#4a473e'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 16, 3); x.fillStyle = '#17160f'; for (let i = 4; i < 64; i += 8) x.fillRect(0, i, 16, 1); VP_TRK_TEX = new THREE.CanvasTexture(c); VP_TRK_TEX.wrapS = VP_TRK_TEX.wrapT = THREE.RepeatWrapping; }
  const L = t.vc.lc + 1.3, geo = new THREE.PlaneGeometry(SP[2], L).rotateX(-PI / 2);
  t.strips = [];
  for (const sd of [-1, 1]) {
    const tx = VP_TRK_TEX.clone(); tx.needsUpdate = true; tx.repeat.set(1, L / .9);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: 1, metalness: .2, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.position.set(sd * SP[0], SP[1], .1); t.g.add(m); t.strips.push(m);
  }
}
function vpStrips(t, dt) {
  if (!t.strips) return; const S = t.vp;
  t.strips[0].material.map.offset.y = -(S.dL / .9) % 1; t.strips[1].material.map.offset.y = -(S.dR / .9) % 1;   // il tratto superiore scorre in avanti quando il carro avanza
  t.strips[0].visible = t.cm.trackL > 0; t.strips[1].visible = t.cm.trackR > 0;
}
// ---------- audio: regime simulato da cinque marce, carico dall'acceleratore ----------
function vpAudio(t, dt) {
  const S = t.vp, C = t.vc, v = Math.abs(S.v), tops = VP_GEARS, gr = S.gear;
  if (!t.alive) return;
  const lo = gr ? C.vmax * tops[gr - 1] : 0, frac = clamp((v - lo) / (C.vmax * tops[gr] - lo), 0, 1), load = Math.abs(t.cmdThr || 0);
  const want = t.cm.engine <= 0 || S.stall > 0 ? 0 : v < .3 && !load ? 700 : 1000 + 1500 * frac + 300 * load;
  S.rpm = lerp(S.rpm, want * (S.shift > 0 ? .8 : 1), Math.min(1, dt * (want > S.rpm ? 3 : 2)));
  const rate = S.rpm / 1800 * (t.rateK || 1), vol = S.rpm < 100 ? 0 : .45 + .35 * load + .15 * frac, trk = Math.min(1, (v + Math.abs(S.w) * 2) / C.vmax);
  if (t.eng) t.player ? t.eng.set(vol, 0, rate, 2500) : t.eng.at(t.pos, vol * 1.1, rate, 170);
  if (t.trk) t.player ? t.trk.set(trk * .75 + S.slip * .2, 0, .6 + trk * .9 - S.slip * .15, 4000) : t.trk.at(t.pos, trk * .85, .6 + trk * .9, 90);
  if (t.player && !t.idle && typeof caResolve === 'function' && caResolve('', 'vehicle.' + t.type + '.engine_idle')) t.idle = loopSound(t.eng ? t.eng.name : 'eng_pz4', 0, 'vehicle.' + t.type + '.engine_idle');
  if (t.idle) t.idle.set(t.player ? clamp(1 - (S.rpm - 700) / 500, 0, 1) * .8 : 0, 0, 1, 20000);
  if (t.player && !t.skid && S.slip > .5 && typeof caResolve === 'function' && caResolve('', 'vehicle.' + t.type + '.skid')) t.skid = loopSound('tracks', 0, 'vehicle.' + t.type + '.skid');
  if (t.skid) t.skid.set(t.player ? S.slip * .8 : 0, 0, 1, 20000);
}
function vpSilence(t) { for (const k of ['eng', 'trk', 'tur', 'idle', 'skid']) if (t[k]) { if (t[k].at) t[k].at(t.pos, 0, 0, 1); t[k].set(0); } }
// ---------- relitti: restano in fumo per un tempo limitato, al massimo VP.WRECK_MAX insieme ----------
function vpWreck(t) {
  t.wreckT = GAME.time; VP.wrecks.push(t); vpSilence(t); if (typeof dzWreck === 'function') dzWreck(t);
  if (t.strips) for (const s of t.strips) s.material.map.offset.y += .3;
}
function vpWreckTick() {
  for (let i = VP.wrecks.length - 1; i >= 0; i--) {
    const t = VP.wrecks[i], old = GAME.time - t.wreckT > VP.WRECK_TIME, many = VP.wrecks.length > VP.WRECK_MAX && i === 0;
    if (!(old || many) || t.player) continue;
    VP.wrecks.splice(i, 1); vpRemove(t);
  }
}
function vpRemove(t) {
  t.removedVP = true; if (t.wreckSol) { t.wreckSol.on = false; if (typeof TL !== 'undefined') TL.ver = (TL.ver || 0) + 1; } const k = VP.list.indexOf(t); if (k >= 0) VP.list.splice(k, 1); const w = VP.wrecks.indexOf(t); if (w >= 0) VP.wrecks.splice(w, 1);
  if (t.remove) t.remove(); else { scene.remove(t.g); vpSilence(t); }
  for (const L of [typeof KAS !== 'undefined' ? KAS.tanks : null, TANKS.list, MISSION.vehicles]) if (L) { const j = L.indexOf(t); if (j >= 0) L.splice(j, 1); }
}
// ---------- IA: comandi di guida da direzione e velocità volute (stesse regole del giocatore) ----------
function vpDriveTo(t, hdg, want, dt) {
  const S = t.vp, err = angDiff(t.yaw, hdg), rev = want < 0;
  // rallenta prima delle curve, sterza con un regolatore proporzionale-derivativo
  const tv = Math.abs(want) * clamp(1 - Math.abs(err) / 1.3, t.vc.pivot ? 0 : .15, 1) * (rev ? -1 : 1);
  t.cmdSteer = clamp(err * 2.2 - S.w * .8, -1, 1) * (rev ? -1 : 1);
  t.cmdThr = clamp((tv - S.v) * .7, -1, 1); if (Math.abs(tv) < .05 && Math.abs(S.v) < .2) t.cmdThr = 0;
  // bloccato: vuole muoversi ma non avanza → retromarcia sterzando dall'altra parte
  S.stuckT = (S.stuckT || 0) - dt;
  if (S.rec > 0) { S.rec -= dt; t.cmdThr = -.8; t.cmdSteer = S.recDir; return; }
  if (S.stuckT <= 0) { S.stuckT = 3; const moved = Math.hypot(t.pos.x - S.prog.x, t.pos.z - S.prog.z); if (Math.abs(want) > 1 && moved < 1.2 && !t.immob) { S.rec = 2.5; S.recDir = err > 0 ? -1 : 1; } S.prog.copy(t.pos); }
}
// copertura: punto vicino, verso le proprie linee, dietro al quale il terreno nasconde il carro alla minaccia
function vpCover(t, threat, back) {
  let best = null, bs = 1e9;
  for (let i = 0; i < 10; i++) {
    const a = Math.atan2(back.x - t.pos.x, back.z - t.pos.z) + (i - 4.5) * .35, r = rnd(25, 60), p = new V3(t.pos.x + Math.sin(a) * r, 0, t.pos.z + Math.cos(a) * r); p.y = Hf(p.x, p.z);
    const hid = typeof kasLOS === 'function' ? !kasLOS(threat.pos, p) : false, s = r + (hid ? 0 : 400) + p.distanceTo(back) * .05;
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
// assetto sul terreno per i mezzi a guida scriptata (semicingolato, Sherman di Omaha): beccheggio e rollio dal terreno, con un po' d'inerzia
function vpGroundPose(o, dt, half = [1, 2.9]) {
  const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw), a = half[1] * .8, b = half[0];
  const yf = Hf(o.pos.x + fx * a, o.pos.z + fz * a), yb = Hf(o.pos.x - fx * a, o.pos.z - fz * a), yl = Hf(o.pos.x + fz * b, o.pos.z - fx * b), yr = Hf(o.pos.x - fz * b, o.pos.z + fx * b);
  const k = Math.min(1, dt * 5); o.pth = lerp(o.pth || 0, Math.atan2(yf - yb, a * 2), k); o.pph = lerp(o.pph || 0, Math.atan2(yr - yl, b * 2), k);
  o.pos.y = (yf + yb + yl + yr) / 4; (o.g || o.m).rotation.set(o.pth, o.yaw, o.pph, 'YXZ');
}
