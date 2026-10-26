"use strict";
// ============================================================
//  Balistica aerea: proiettili veri con tempo di volo, caduta e
//  rallentamento; aggancio del bersaglio (T) e indicatore d'anticipo
// ============================================================
const AB = { list: [], mesh: null, lock: null, lockT: 0, el: null };
// velocità alla bocca (m/s) e rallentamento per calibro: le armi lente vanno anticipate di più
function muzzleV(cal) { return cal >= 40 ? 615 : cal >= 37 ? 860 : cal >= 30 ? 540 : cal >= 20 ? 830 : cal >= 12 ? 870 : 760; }
function bulletDrag(cal) { return cal >= 30 ? .22 : cal >= 20 ? .17 : .14; }

function initAirBullets() {
  if (AB.mesh || !FXP.tr) return;
  AB.mesh = new THREE.InstancedMesh(FXP.tr.geometry, FXP.tr.material, 700);
  AB.mesh.frustumCulled = false; AB.mesh.renderOrder = 5; scene.add(AB.mesh);
  for (let i = 0; i < 700; i++) AB.mesh.setMatrixAt(i, _fz);
}
// armi dei caccia controllati dall'IA (a colpo singolo, cadenza in secondi)
const AI_GUNS = { fw190: { cal: 20, dmg: 7, int: .07 }, bf109: { cal: 20, dmg: 6.5, int: .075 }, me262: { cal: 30, dmg: 26, int: .2, he: 1.2 }, ju88: { cal: 7.9, dmg: 4, int: .1 }, def: { cal: 12.7, dmg: 6, int: .07 } };
function aiGuns(type, team) { if (team === 'A') { const G = (PLANE_SPECS[type] || PLANE_SPECS.p47).guns; return { cal: G.cal, dmg: G.cal >= 30 ? 50 : G.cal >= 20 ? 14 : 10, int: G.cal >= 30 ? .2 : .07, he: G.he }; } return AI_GUNS[type] || AI_GUNS.def; }
function fireAirBullet(o, d, vel, G, dmg, byPlayer, team = 'A') {
  initAirBullets();
  if (AB.list.length >= 700) AB.list.shift();
  const u = muzzleV(G.cal);
  AB.list.push({ p: o.clone(), v: vel.clone().addScaledVector(d, u), life: 1700 / u, G, dmg, byPlayer, team, tr: true });
}

const _bd = new V3(), _bn = new V3(), _bq = new THREE.Quaternion(), _bm = new THREE.Matrix4(), _bs = new V3(), _bp = new V3();
function updateAirBullets(dt) {
  const L = AB.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    b.life -= dt; if (b.life <= 0) { L.splice(i, 1); continue; }
    b.v.y -= 9.8 * dt; b.v.multiplyScalar(1 - bulletDrag(b.G.cal) * dt);
    _bn.copy(b.p).addScaledVector(b.v, dt);
    const seg = _bd.subVectors(_bn, b.p).length(); _bd.multiplyScalar(1 / seg);
    // cosa incontra il proiettile lungo il tratto di questo fotogramma
    let t = rayTerrain(b.p, _bd, seg), water = false, hitPlane = null, hitVeh = null;
    if (_bn.y < WATER_Y && Hf(_bn.x, _bn.z) < WATER_Y) { const tw = _bd.y < 0 ? (WATER_Y - b.p.y) / _bd.y : -1; if (tw >= 0 && tw <= seg && (t < 0 || tw < t)) { t = tw; water = true; } }
    const foe = b.team === 'A' ? 'E' : 'A';
    for (const pl of PLANES) if (pl.team === foe && pl.alive && !pl.crash) {
      const r = pl.type === 'b26' || pl.type === 'ju88' ? 8 : 5, tt = raySphere(b.p, _bd, pl.pos, r);
      if (tt >= 0 && tt <= seg && (t < 0 || tt < t)) { t = tt; hitPlane = pl; water = false; }
    }
    if (b.team === 'A') for (const v of MISSION.vehicles.concat(TANKS.list || [])) {
      if (!v.alive || !v.box) continue;
      const tt = rayBox(b.p.x, b.p.y, b.p.z, _bd.x, _bd.y, _bd.z, { min: _vbA.copy(v.box.min).subScalar(.4), max: _vbB.copy(v.box.max).addScalar(.4) }, seg);
      if (tt > 0 && tt <= seg && (t < 0 || tt < t)) { t = tt; hitVeh = v; hitPlane = null; water = false; }
    }
    if (t < 0 && SCEN === 'sea' && typeof navShipAt === 'function') { const sh = navShipAt(_bn, b.team); if (sh) { if (b.byPlayer || b.team === 'E') navStrafeHit(sh, _bn, b.G.cal, b.byPlayer); L.splice(i, 1); continue; } }
    if (t >= 0) {
      if (water && SCEN === 'sea' && typeof waterDrop === 'function') waterDrop(b.p.x + _bd.x * t, b.p.z + _bd.z * t, 1.6, -.12, .25);
      if (b.byPlayer) airBulletImpact(b.p.clone(), _bd.clone(), t, hitPlane, hitVeh, water, b.G, b.dmg);
      else aiBulletImpact(b, b.p.clone().addScaledVector(_bd, t), hitPlane, water);
      L.splice(i, 1); continue;
    }
    b.p.copy(_bn);
  }
  // traccianti legati ai proiettili: la scia mostra esattamente dove vanno i colpi
  if (!AB.mesh) return;
  const cp = camera.position, n = Math.min(L.length, 700);
  for (let i = 0; i < n; i++) {
    const b = L[i], sp = b.v.length(); _bd.copy(b.v).multiplyScalar(1 / sp);
    const len = Math.min(sp * .028, 22); _bp.copy(b.p).addScaledVector(_bd, -len);
    _bq.setFromUnitVectors(_fu, _bd);
    const dc = Math.max(1, _bp.distanceTo(cp)), w = b.G.cal >= 30 ? 2.6 : b.G.cal >= 20 ? 1.8 : 1.3;
    const rad = Math.min(.3, .015 + dc * .0011) * w;
    _bm.compose(_bp, _bq, _bs.set(rad, len, rad)); AB.mesh.setMatrixAt(i, _bm);
  }
  for (let i = n; i < (AB.drawn || 0); i++) AB.mesh.setMatrixAt(i, _fz);
  AB.drawn = n; AB.mesh.instanceMatrix.needsUpdate = true;
}

// ---------- aggancio del bersaglio e anticipo ----------
function planeSightDir(me) { return PL.assist ? planeAimDir().clone() : new V3(0, 0, -1).applyQuaternion(me.q); }
function pickAirTarget(me, maxAng, maxD, skip) {
  const dir = planeSightDir(me); let best = null, bs = 1e9;
  for (const p of PLANES) {
    if (p.team !== 'E' || !p.alive || p.crash || p === skip) continue;
    const r = p.pos.clone().sub(me.pos), d = r.length(); if (d > maxD) continue;
    const a = Math.acos(clamp(r.dot(dir) / d, -1, 1)); if (a > maxAng) continue;
    const sc = a + d / 6000; if (sc < bs) { bs = sc; best = p; }
  }
  return best;
}
function planeLockToggle() {
  const me = PL.me; if (!me || me.crash) return;
  const nx = pickAirTarget(me, .45, 2500, AB.lock);
  if (nx) { AB.lock = nx; showMsg('Bersaglio agganciato: ' + planeLabel(nx), 1.5); play('mag_in', null, { vol: .4, rate: 1.6 }); }
  else if (AB.lock) { AB.lock = null; showMsg('Aggancio rilasciato', 1.2); }
  else showMsg('Nessun bersaglio davanti a te', 1.2);
}
function planeLabel(p) { return (PLANE_SPECS[p.type] && PLANE_SPECS[p.type].name) || ({ fw190: 'Fw 190', bf109: 'Bf 109', b26: 'B-26', me262: 'Me 262' })[p.type] || 'nemico'; }
// punto in cui mirare: dove sarà il bersaglio quando arriva il colpo (moto relativo, rallentamento e caduta del proiettile)
function airLeadPoint(me, tgt, G) {
  const u0 = muzzleV(G.cal), k = bulletDrag(G.cal), r = tgt.pos.clone().sub(me.pos), w = tgt.vel.clone().sub(me.vel);
  let u = u0, t = 0;
  for (let it = 0; it < 3; it++) {
    const a = w.dot(w) - u * u, bq = 2 * r.dot(w), c = r.dot(r), disc = bq * bq - 4 * a * c;
    if (disc < 0) return null;
    t = Math.abs(a) < 1e-6 ? -c / bq : (-bq - Math.sqrt(disc)) / (2 * a); if (!(t > 0)) t = (-bq + Math.sqrt(disc)) / (2 * a);
    if (!(t > 0) || t > 3) return null;
    u = u0 * (1 - k * t / 2);  // velocità media lungo il tragitto
  }
  const aim = r.addScaledVector(w, t); aim.y += .5 * 9.8 * t * t;
  return { p: aim.add(me.pos), t };
}
function airHudEl() {
  if (AB.el) return AB.el;
  const mk = (css, html = '') => { const e = document.createElement('div'); e.style.cssText = 'position:fixed;pointer-events:none;display:none;z-index:6;' + css; e.innerHTML = html; document.body.appendChild(e); return e; };
  AB.el = {
    lead: mk('width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid rgba(255,255,255,.9);border-radius:50%;box-shadow:0 0 3px #000', '<div style="position:absolute;left:8px;top:8px;width:2px;height:2px;background:#fff"></div>'),
    box: mk('width:40px;height:40px;margin:-20px 0 0 -20px;border:2px solid #ffb43a;box-shadow:0 0 3px #000'),
    txt: mk('font:12px Oswald, sans-serif;color:#ffb43a;text-shadow:0 0 3px #000;transform:translate(-50%, 0);white-space:nowrap'),
    line: mk('height:1px;background:rgba(255,255,255,.35);transform-origin:0 0'),
    bomb: mk('width:26px;height:26px;margin:-13px 0 0 -13px', '<svg width="26" height="26" viewBox="0 0 26 26"><g stroke="#ffd34a" stroke-width="2" fill="none" style="filter:drop-shadow(0 0 2px #000)"><path d="M13 2v7M13 17v7M2 13h7M17 13h7"/><circle cx="13" cy="13" r="4"/></g></svg>'),
  };
  return AB.el;
}
const _bsc = new V3();
function toScreen(p) { _bsc.copy(p).project(camera); if (_bsc.z > 1) return null; return [(_bsc.x + 1) / 2 * innerWidth, (1 - _bsc.y) / 2 * innerHeight]; }
function updateAirSight() {
  const E = airHudEl(), me = PL.me, hide = () => { E.lead.style.display = E.box.style.display = E.txt.style.display = E.line.style.display = 'none'; };
  if (P.mode !== 'plane' || !me || me.crash || CUT.active) { hide(); E.bomb.style.display = 'none'; return; }
  updateBombSight(me, E);
  if (AB.lock && (!AB.lock.alive || AB.lock.crash || AB.lock.pos.distanceTo(me.pos) > 3500)) { AB.lock = null; }
  // senza aggancio l'anticipo appare per il nemico più vicino al mirino
  const tgt = AB.lock || pickAirTarget(me, .26, 1100);
  if (!tgt) { hide(); return; }
  const G = (PL.spec || PLANE_SPECS.p47).guns, L = airLeadPoint(me, tgt, G), d = tgt.pos.distanceTo(me.pos);
  const ts = toScreen(tgt.pos);
  if (ts && AB.lock) { E.box.style.display = 'block'; E.box.style.left = ts[0] + 'px'; E.box.style.top = ts[1] + 'px'; E.txt.style.display = 'block'; E.txt.style.left = ts[0] + 'px'; E.txt.style.top = ts[1] + 24 + 'px'; E.txt.textContent = planeLabel(tgt) + ' · ' + Math.round(d) + ' m'; }
  else { E.box.style.display = E.txt.style.display = 'none'; }
  const ls = L && d < 1600 ? toScreen(L.p) : null;
  if (ls) {
    E.lead.style.display = 'block'; E.lead.style.left = ls[0] + 'px'; E.lead.style.top = ls[1] + 'px';
    // a tiro utile il cerchio diventa rosso
    E.lead.style.borderColor = d < (G.cal >= 30 ? 450 : 650) ? 'rgba(255,80,60,.95)' : 'rgba(255,255,255,.9)';
    if (ts) { const dx = ls[0] - ts[0], dy = ls[1] - ts[1]; E.line.style.display = 'block'; E.line.style.left = ts[0] + 'px'; E.line.style.top = ts[1] + 'px'; E.line.style.width = Math.hypot(dx, dy) + 'px'; E.line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)'; }
    else E.line.style.display = 'none';
  } else { E.lead.style.display = E.line.style.display = 'none'; }
}

// colpo dell'IA (nemici o gregari): danneggia solo gli aerei; contro il giocatore scossone e rumore di lamiera
function aiBulletImpact(b, end, hitPlane, water) {
  if (b.G.he) fxExplosion(end.clone(), b.G.he * .35, false);
  if (hitPlane) {
    hitPlane.damage(b.dmg * (b.G.he ? 1.2 : 1), false); fxImpact(end, 'metal');
    if (hitPlane.player) { P.shake = Math.min(.6, P.shake + (b.G.cal >= 30 ? .2 : .06)); play('imp_metal', null, { vol: .7 }); if (R() < .3) lensSplat('dirt', .12); }
    return;
  }
  if (dist2Cam(end) < 600 * 600) fxImpact(end, water ? 'water' : 'dirt');
}
// mira dell'IA: punta il cerchio d'anticipo (con un errore di mira) e spara quando il muso è allineato
function aiAirGuns(p, tgt, dt, maxD = 600) {
  const G = p.aiG || (p.aiG = aiGuns(p.type, p.team));
  p.fireT -= dt;
  const L = airLeadPoint(p, tgt, G); if (!L) return null;
  const dirL = L.p.clone().sub(p.pos), d = dirL.length(); dirL.multiplyScalar(1 / d);
  const cur = p.vel.clone().normalize();
  if (d < maxD && cur.dot(dirL) > .9965 && p.fireT <= 0) {
    p.fireT = G.int;
    const err = .009 + (p.team === 'E' ? .006 : .003), dir = dirL.clone().lerp(cur, .5).add(new V3(rnd(-err, err), rnd(-err, err), rnd(-err, err))).normalize();
    const o = p.pos.clone().addScaledVector(cur, 5);
    fireAirBullet(o, dir, p.vel, G, G.dmg, false, p.team);
    if (dist2Cam(o) < 900 * 900) sfxShot(p.team === 'E' ? 'mg42' : 'm2', o);
  }
  return L.p;
}

// punto d'impatto della bomba (CCIP): stessa caduta e resistenza della bomba vera, finché tocca terra o acqua
const _bsP = new V3(), _bsV = new V3();
function updateBombSight(me, E) {
  const agl = me.pos.y - Math.max(Hf(me.pos.x, me.pos.z), WATER_Y);
  if (PL.bombs <= 0 || agl < 15 || agl > 1800) { E.bomb.style.display = 'none'; return; }
  _bsP.copy(me.pos); _bsP.y -= 1.2; _bsV.copy(me.vel);
  for (let i = 0; i < 600; i++) {
    const dt = .05; _bsV.y -= 9.8 * dt; _bsV.multiplyScalar(1 - .02 * dt); _bsP.addScaledVector(_bsV, dt);
    const g = Hf(_bsP.x, _bsP.z); if (_bsP.y < g || (_bsP.y < WATER_Y && g < WATER_Y)) break;
  }
  const s = toScreen(_bsP);
  if (s) { E.bomb.style.display = 'block'; E.bomb.style.left = s[0] + 'px'; E.bomb.style.top = s[1] + 'px'; } else E.bomb.style.display = 'none';
}
