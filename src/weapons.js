"use strict";
// ============================================================
//  Armi: modelli in prima persona, fuoco, ricarica, proiettili,
//  granate, razzi, esplosioni, mine, armi raccoglibili
// ============================================================
const VM = {}, vmCache = {};
let vmRoot, vmCur = null, vmCurId = null, vmFlash;
const projectiles = [];
const STATS = { shots: 0, hits: 0, kills: 0, heads: 0, deaths: 0, start: 0 };

function initWeapons() {
  const grain = (base, dark) => canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      g.strokeStyle = `rgba(${dark},${.12 + R() * .25})`; g.lineWidth = R() * 2 + .4; g.beginPath();
      const y = R() * s; g.moveTo(0, y); g.bezierCurveTo(s * .3, y + rnd(-6, 6), s * .6, y + rnd(-6, 6), s, y + rnd(-4, 4)); g.stroke();
    }
  });
  VM.wood = new THREE.MeshStandardMaterial({ map: grain('#8a5530', '40,20,8'), roughness: .45, metalness: 0 });
  VM.wood2 = new THREE.MeshStandardMaterial({ map: grain('#6e3f20', '30,14,6'), roughness: .5, metalness: 0 });
  VM.park = new THREE.MeshStandardMaterial({ color: col(0x353734), roughness: .55, metalness: .7 });
  VM.blue = new THREE.MeshStandardMaterial({ color: col(0x1f2226), roughness: .3, metalness: .9 });
  VM.brass = new THREE.MeshStandardMaterial({ color: col(0xc49a45), roughness: .3, metalness: 1 });
  VM.olive = new THREE.MeshStandardMaterial({ color: col(0x4d5537), roughness: .6, metalness: .3 });
  VM.sleeve = new THREE.MeshStandardMaterial({ color: col(0x67643f), roughness: .95 });
  VM.skin = new THREE.MeshStandardMaterial({ color: col(0xc9997a), roughness: .65 });
  VM.bake = new THREE.MeshStandardMaterial({ color: col(0x2c1a10), roughness: .45 });
  VM.glass = new THREE.MeshStandardMaterial({ color: col(0x203040), roughness: .05, metalness: .6 });
  VM.flash = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  vmRoot = new THREE.Group(); camera.add(vmRoot);
  const fp = new THREE.PlaneGeometry(1, 1);
  vmFlash = new THREE.Group();
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(fp, VM.flash); m.rotation.z = i * PI / 3; m.rotation.y = PI / 2; vmFlash.add(m); }
  const f2 = new THREE.Mesh(fp, VM.flash); vmFlash.add(f2);
  vmFlash.visible = false;
}

function part(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const CZ = (p, mat, x, y, z, r, len) => part(p, U.cyl12, mat, x, y, z, r, len, r, PI / 2);
function limb(parent, a, b, r, mat) {
  const d = new V3().subVectors(b, a), m = new THREE.Mesh(U.cyl12, mat);
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
  m.scale.set(r, d.length(), r); parent.add(m); return m;
}

// costruisce solo l'arma (usata anche per le armi a terra)
function buildGun(id) {
  const g = new THREE.Group(); let i;
  if (id === 'garand' || id === 'kar98' || id === 'springfield') {
    const W = id === 'garand' ? VM.wood : VM.wood2;
    part(g, U.box, W, 0, -.035, .25, .042, .1, .36);
    part(g, U.box, W, 0, -.012, .06, .038, .065, .14);
    part(g, U.box, W, 0, 0, -.3, .044, .05, .5);
    part(g, U.box, W, 0, .034, -.33, .034, .022, .32);
    part(g, U.box, id === 'kar98' ? VM.blue : VM.park, 0, .028, -.04, .034, .045, .2);
    CZ(g, id === 'kar98' ? VM.blue : VM.park, 0, .03, -.64, .011, .62);
    part(g, U.box, VM.park, 0, -.045, .01, .008, .03, .06);
    part(g, U.box, VM.park, 0, .063, -.92, .006, .024, .01);
    let mag = null, bolt = null;
    if (id === 'garand') {
      CZ(g, VM.park, 0, .012, -.8, .012, .1);
      part(g, U.box, VM.park, 0, .062, .04, .022, .024, .02);
      mag = part(g, U.box, VM.brass, 0, .055, -.05, .018, .014, .06);
    } else {
      part(g, U.box, VM.park, 0, .054, -.17, .02, .016, .03);
      bolt = new THREE.Group(); bolt.position.set(.02, .04, .03); g.add(bolt);
      CZ(bolt, VM.blue, 0, 0, 0, .009, .08);
      part(bolt, U.box, VM.blue, .03, -.01, .03, .05, .01, .01, 0, 0, id === 'kar98' ? 0 : -.6);
      part(bolt, U.sph, VM.blue, .055, -.015, .03, .012, .012, .012);
      mag = part(g, U.box, VM.brass, 0, .05, -.05, .012, .01, .05);
      if (id === 'springfield') {
        CZ(g, VM.blue, 0, .085, -.04, .013, .3); CZ(g, VM.blue, 0, .085, .13, .019, .06); CZ(g, VM.blue, 0, .085, -.2, .018, .06);
        part(g, U.box, VM.blue, 0, .06, .04, .012, .03, .015); part(g, U.box, VM.blue, 0, .06, -.12, .012, .03, .015);
        CZ(g, VM.glass, 0, .085, .165, .016, .005);
      }
    }
    i = { mag, bolt, muzzle: new V3(0, .03, -.96), hip: new V3(.16, -.17, -.32), ads: new V3(0, -.073, -.2), grip: new V3(0, -.04, .06), fore: new V3(0, -.012, -.38) };
    if (id === 'springfield') i.ads = new V3(0, -.085, -.12);
  } else if (id === 'thompson') {
    part(g, U.box, VM.wood, 0, -.02, .2, .04, .09, .26);
    part(g, U.box, VM.park, 0, .03, -.08, .042, .06, .26);
    CZ(g, VM.park, 0, .035, -.33, .014, .24);
    part(g, U.box, VM.wood, 0, -.05, .02, .032, .09, .04, .25);
    part(g, U.box, VM.wood, 0, .008, -.27, .04, .04, .13);
    part(g, U.box, VM.park, 0, .068, .03, .012, .016, .016);
    part(g, U.box, VM.park, 0, .058, -.43, .005, .02, .008);
    part(g, U.box, VM.park, .028, .04, -.04, .012, .012, .02);
    const mag = part(g, U.box, VM.park, 0, -.075, -.11, .028, .17, .05);
    i = { mag, muzzle: new V3(0, .035, -.46), hip: new V3(.15, -.16, -.3), ads: new V3(0, -.075, -.22), grip: new V3(0, -.05, .02), fore: new V3(0, -.012, -.27) };
  } else if (id === 'bar') {
    part(g, U.box, VM.wood, 0, -.025, .27, .045, .1, .36);
    part(g, U.box, VM.park, 0, .025, -.08, .05, .07, .42);
    CZ(g, VM.park, 0, .04, -.6, .014, .5); CZ(g, VM.park, 0, .04, -.87, .019, .07);
    part(g, U.box, VM.wood, 0, .005, -.37, .05, .05, .22);
    part(g, U.box, VM.wood, 0, -.05, .06, .035, .09, .04, .3);
    part(g, U.box, VM.park, 0, .076, .1, .016, .02, .02); part(g, U.box, VM.park, 0, .066, -.86, .005, .022, .01);
    for (const sx of [-1, 1]) part(g, U.cyl12, VM.park, sx * .025, .015, -.64, .005, .34, .005, PI / 2 + .05);
    const mag = part(g, U.box, VM.park, 0, -.045, -.12, .035, .1, .075);
    i = { mag, muzzle: new V3(0, .04, -.92), hip: new V3(.17, -.17, -.3), ads: new V3(0, -.082, -.18), grip: new V3(0, -.05, .07), fore: new V3(0, -.015, -.37) };
  } else if (id === 'colt') {
    const slide = part(g, U.box, VM.park, 0, .045, -.09, .028, .032, .2);
    part(g, U.box, VM.park, 0, .022, -.07, .027, .02, .16);
    part(g, U.box, VM.wood2, 0, -.03, 0, .031, .095, .046, .22);
    part(g, U.box, VM.park, 0, .005, -.045, .006, .025, .05);
    part(g, U.box, VM.park, 0, .065, -.18, .004, .01, .008); part(g, U.box, VM.park, 0, .065, -.005, .016, .01, .008);
    const mag = part(g, U.box, VM.park, 0, -.08, .012, .024, .012, .04);
    i = { mag, slide, muzzle: new V3(0, .045, -.2), hip: new V3(.13, -.14, -.32), ads: new V3(0, -.071, -.3), grip: new V3(0, -.03, .01), fore: new V3(-.01, -.06, .02) };
  } else if (id === 'bazooka') {
    CZ(g, VM.olive, 0, 0, -.3, .046, 1.45);
    part(g, U.cone, VM.olive, 0, 0, .46, .07, .12, .07, -PI / 2);
    CZ(g, VM.olive, 0, 0, -1.02, .054, .04);
    part(g, U.box, VM.wood, 0, -.065, .1, .045, .06, .24);
    part(g, U.box, VM.park, 0, -.09, -.05, .028, .09, .04, .2); part(g, U.box, VM.park, 0, -.09, -.36, .028, .09, .04, .2);
    part(g, U.box, VM.park, -.066, .04, -.55, .01, .05, .02); part(g, U.box, VM.park, -.066, .04, -.2, .012, .02, .01);
    part(g, U.box, VM.olive, 0, -.06, -.22, .04, .05, .1);
    const mag = new THREE.Group(); mag.position.set(0, 0, -1.08); g.add(mag);
    part(mag, U.cone, VM.olive, 0, 0, -.06, .042, .14, .042, -PI / 2); CZ(mag, VM.olive, 0, 0, .03, .04, .06);
    i = { mag, muzzle: new V3(0, 0, -1.05), hip: new V3(.2, -.13, -.25), ads: new V3(.066, -.06, -.25), grip: new V3(0, -.1, -.05), fore: new V3(0, -.1, -.36) };
  } else if (id === 'mp40') {
    CZ(g, VM.blue, 0, .03, -.1, .02, .3); CZ(g, VM.blue, 0, .03, -.33, .01, .16);
    part(g, U.box, VM.blue, 0, .005, -.37, .015, .02, .04);
    part(g, U.box, VM.blue, 0, -.02, -.17, .03, .06, .05);
    part(g, U.box, VM.bake, 0, -.04, .03, .03, .09, .04, .2);
    for (const sx of [-1, 1]) part(g, U.box, VM.blue, sx * .012, .0, .16, .006, .012, .25);
    part(g, U.box, VM.blue, 0, -.03, .29, .03, .07, .01);
    part(g, U.box, VM.blue, 0, .057, .0, .012, .014, .012); part(g, U.box, VM.blue, 0, .052, -.4, .012, .016, .01);
    const mag = part(g, U.box, VM.blue, 0, -.09, -.17, .022, .2, .035);
    i = { mag, muzzle: new V3(0, .03, -.42), hip: new V3(.15, -.15, -.3), ads: new V3(0, -.066, -.22), grip: new V3(0, -.04, .03), fore: new V3(0, -.1, -.17) };
  }
  i.group = g; return i;
}
function buildViewmodel(id) {
  const i = buildGun(id), g = i.group;
  const rh = i.grip, lh = i.fore;
  part(g, U.box, VM.skin, rh.x + .012, rh.y - .01, rh.z, .035, .07, .09);
  limb(g, new V3(rh.x + .02, rh.y - .03, rh.z + .04), new V3(.24, -.42, .34), .036, VM.sleeve);
  part(g, U.box, VM.skin, lh.x - .01, lh.y - .02, lh.z, .05, .045, .09);
  limb(g, new V3(lh.x - .02, lh.y - .04, lh.z + .03), new V3(-.34, -.46, .02), .038, VM.sleeve);
  g.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  g.visible = false; vmRoot.add(g);
  return i;
}
function setViewmodel(id) {
  if (id === vmCurId) return;
  if (vmCur) vmCur.group.visible = false;
  vmCurId = id;
  if (!id) { vmCur = null; return; }
  vmCur = vmCache[id] || (vmCache[id] = buildViewmodel(id));
  vmCur.group.visible = true;
  vmCur.group.add(vmFlash); vmFlash.position.copy(vmCur.muzzle);
}

// ---------- fuoco del giocatore ----------
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1;
}
const _hs = new V3();
function hitscan(o, d, maxT) {
  let bt = maxT, type = null, obj = null, zone = null;
  const sr = raySolids(o, d, bt); if (sr) { bt = sr.t; type = 'solid'; obj = sr.s; }
  const tt = rayTerrain(o, d, bt); if (tt >= 0 && tt < bt) { bt = tt; type = 'terrain'; obj = null; }
  for (const e of enemies) {
    if (!e.alive || e.removed) continue;
    const cx = e.pos.x - o.x, cy = e.pos.y + 1 - o.y, cz = e.pos.z - o.z, pr = cx * d.x + cy * d.y + cz * d.z;
    if (pr < 0 || pr > bt + 1.5 || cx * cx + cy * cy + cz * cz - pr * pr > 4) continue;
    let t = raySphere(o, d, e.head(_hs), .15);
    if (t > 0 && t < bt) { bt = t; type = 'enemy'; obj = e; zone = 'head'; }
    if (e.inBunker) continue;
    const cr = e.crouch, y = e.pos.y;
    t = raySphere(o, d, _hs.set(e.pos.x, y + lerp(1.22, .9, cr), e.pos.z), .27); if (t > 0 && t < bt) { bt = t; type = 'enemy'; obj = e; zone = 'body'; }
    t = raySphere(o, d, _hs.set(e.pos.x, y + lerp(.9, .58, cr), e.pos.z), .22); if (t > 0 && t < bt) { bt = t; type = 'enemy'; obj = e; zone = 'body'; }
    t = raySphere(o, d, _hs.set(e.pos.x, y + lerp(.45, .3, cr), e.pos.z), .22); if (t > 0 && t < bt) { bt = t; type = 'enemy'; obj = e; zone = 'legs'; }
  }
  for (const v of MISSION.vehicles) {
    if (!v.alive) continue;
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, v.box, bt); if (t >= 0 && t < bt) { bt = t; type = 'vehicle'; obj = v; }
    if (v.gunnerAlive) { const t2 = raySphere(o, d, v.gunnerHead(_hs), .2); if (t2 > 0 && t2 <= bt + .2) { bt = t2; type = 'vgunner'; obj = v; } }
  }
  return { t: bt, type, obj, zone };
}

const _o = new V3(), _d = new V3(), _r = new V3();
function playerFire() {
  const s = P.slot(); if (!s) return;
  const w = WEAPONS[s.id];
  if (P.fireCD > 0 || P.reloadT > 0 || P.switchT > 0 || P.throwT > 0 || P.carry || P.swim || P.inBoat || P.dead || P.interacting) return;
  if (s.mag <= 0) { sfxMech('dry'); P.fireCD = .3; if (s.res > 0) startReload(); P.trigger = false; return; }
  s.mag--; P.fireCD = w.rate; STATS.shots++;
  P.recoil = 1; P.kickP += w.kick * (P.adsK > .5 ? .55 : 1) * (P.stance === 2 ? .5 : 1); P.kickY += rnd(-1, 1) * w.kick * .35;
  if (w.climb) P.pitch += w.climb * (P.stance === 2 ? .5 : 1);
  if (!w.auto) P.trigger = false;
  sfxShot(w.snd, null, true);
  vmFlash.visible = true; vmFlash.scale.setScalar(w.rocket ? .3 : rnd(.07, .12)); vmFlash.rotation.z = R() * PI; P.flashT = .045;
  camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  flashLight(_o.clone().addScaledVector(_d, 1.5), 0xffb060, w.rocket ? 30 : 8, .06);
  if (w.ping && s.mag === 0) sfxPing();
  if (w.bolt && s.mag > 0) { P.boltT = 1; sfxMech('bolt', .3); }
  if (w.rocket) { fireRocket(_o, _d); if (s.mag === 0 && s.res > 0) setTimeout(startReload, 500); return; }
  let spread = (P.adsK > .5 ? w.ads : w.hip) * [1, .75, .55][P.stance] + P.bloom + (P.moveK * (P.adsK > .5 ? .012 : .03));
  P.bloom = Math.min(.04, P.bloom + (w.auto ? .0035 : .008));
  _d.x += rnd(-1, 1) * spread; _d.y += rnd(-1, 1) * spread; _d.z += rnd(-1, 1) * spread; _d.normalize();
  const r = hitscan(_o, _d, w.range || 600), p = _r.copy(_o).addScaledVector(_d, r.t);
  // spruzzo se il colpo attraversa l'acqua
  if (_o.y > WATER_Y && _d.y < 0) {
    const tw = (WATER_Y - _o.y) / _d.y, wz = _o.z + _d.z * tw;
    if (tw < r.t && wz > -9 && H(_o.x + _d.x * tw, wz) < WATER_Y) { fxImpact(new V3(_o.x + _d.x * tw, WATER_Y, wz), 'water'); if (r.type !== 'enemy') return; }
  }
  if (r.type === 'enemy') {
    let dm = w.dmg * (r.zone === 'head' ? 3.2 : r.zone === 'legs' ? .65 : 1);
    if (w.falloff && r.t > w.falloff) dm *= clamp(1 - (r.t - w.falloff) / (w.range || 200), .45, 1);
    const killed = r.obj.damage(dm, _o, true, r.zone);
    STATS.hits++; if (killed && r.zone === 'head') STATS.heads++;
    fxImpact(p.clone(), 'blood'); hitMarker(killed, r.zone === 'head');
  } else if (r.type === 'vehicle') { r.obj.damage(w.dmg * .15, true); fxImpact(p.clone(), 'metal'); sfxImpact(p, 'metal'); }
  else if (r.type === 'vgunner') { r.obj.killGunner(true); STATS.hits++; hitMarker(true, true); fxImpact(p.clone(), 'blood'); }
  else if (r.type === 'terrain') fxImpact(p.clone(), p.z > -58.5 ? 'sand' : 'dirt');
  else if (r.type === 'solid') { const t = r.obj.tag; fxImpact(p.clone(), t === 'boat' || t === 'tank' || t === 'flak' ? 'metal' : t === 'hedge' ? 'dirt' : 'stone'); if (t === 'boat' || t === 'tank') sfxImpact(p, 'metal'); }
  if (s.mag === 0 && s.res > 0 && !w.ping) setTimeout(() => { if (P.slot() === s && s.mag === 0) startReload(); }, 350);
  if (s.mag === 0 && w.ping && s.res > 0) setTimeout(() => { if (P.slot() === s && s.mag === 0) startReload(); }, 450);
}
function startReload() {
  const s = P.slot(); if (!s || P.reloadT > 0 || P.switchT > 0) return;
  const w = WEAPONS[s.id];
  if (s.mag >= w.mag || s.res <= 0) return;
  P.reloadT = w.reload; P.reloadDur = w.reload; P.adsK = Math.min(P.adsK, .3);
  sfxMech('out', .15); sfxMech('in', w.reload * .65); if (w.bolt || s.id === 'colt' || s.id === 'thompson' || s.id === 'mp40' || s.id === 'bar') sfxMech('bolt', w.reload * .85);
}
function finishReload() {
  const s = P.slot(); if (!s) return; const w = WEAPONS[s.id];
  const n = Math.min(w.mag - s.mag, s.res); s.mag += n; s.res -= n;
}

// ---------- proiettili: razzi e granate ----------
let NADE_GEO, STICK_GEO, ROCKET_GEO;
function projGeos() {
  if (NADE_GEO) return;
  let mb = new MB(); mb.add(U.sph, 0x3f4a2e, 0, 0, 0, 0, 0, 0, .045, .06, .045); mb.add(U.cyl, 0x555555, 0, .065, 0, 0, 0, 0, .015, .03, .015); NADE_GEO = mb.build();
  mb = new MB(); mb.add(U.cyl, 0x6b4a2a, 0, 0, 0, 0, 0, 0, .017, .28, .017); mb.add(U.cyl12, 0x4a5048, 0, .17, 0, 0, 0, 0, .035, .1, .035); STICK_GEO = mb.build();
  mb = new MB(); mb.add(U.cyl, 0x4d5537, 0, 0, 0, PI / 2, 0, 0, .04, .4, .04); mb.add(U.cone, 0x4d5537, 0, 0, -.28, -PI / 2, 0, 0, .04, .16, .04); ROCKET_GEO = mb.build();
}
function spawnNade(p, v, fuse, team, byPlayer) {
  projGeos();
  const m = new THREE.Mesh(team === 'A' ? NADE_GEO : STICK_GEO, MAT.vc); m.position.copy(p); m.castShadow = true; scene.add(m);
  const n = { type: 'nade', p: m.position, v: v.clone(), fuse, m, team, byPlayer, spin: new V3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)) };
  projectiles.push(n); return n;
}
function throwPlayerNade() {
  if (P.nades <= 0 || P.throwT > 0 || P.inBoat || P.dead || P.swim || P.carry) return;
  P.nades--; P.throwT = .75; sfxMech('pin');
  setTimeout(() => {
    if (P.dead) return;
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    const p = _o.clone().addScaledVector(_d, .5); p.y -= .1;
    const v = _d.clone().multiplyScalar(P.stance === 2 ? 13 : 18.5); v.y += 3.5;
    spawnNade(p, v, 3.6, 'A', true);
  }, 260);
}
function throwEnemyNade(e) {
  const from = e.eye(new V3()); from.y += .3;
  const tgt = P.pos.clone().add(new V3(rnd(-2.5, 2.5) / D.acc, 0, rnd(-2.5, 2.5) / D.acc));
  const dx = tgt.x - from.x, dz = tgt.z - from.z, dh = Math.hypot(dx, dz), T = 1.1 + dh / 28, dy = H(tgt.x, tgt.z) - from.y;
  const v = new V3(dx / T, (dy + 4.9 * T * T) / T, dz / T);
  e.duck = false; e.duckT = 1.5;
  const n = spawnNade(from, v, 4.2, 'E', false);
  n.warn = true;
}
function fireRocket(o, d) {
  projGeos();
  const m = new THREE.Mesh(ROCKET_GEO, MAT.vcMetal); const p = o.clone().addScaledVector(d, 1.1);
  m.position.copy(p); m.lookAt(p.clone().sub(d)); scene.add(m);
  projectiles.push({ type: 'rocket', p: m.position, v: d.clone().multiplyScalar(85), life: 5, m });
  sfxRocket(o);
  const back = o.clone().addScaledVector(d, -1.2);
  for (let i = 0; i < 10; i++) PS_SMOKE.emit(back.x, back.y, back.z, -d.x * rnd(4, 9) + rnd(-1, 1), rnd(0, 1.5), -d.z * rnd(4, 9) + rnd(-1, 1), rnd(1.5, 3), .4, 2.5, .6, .6, .6, .6, 2);
  P.shake += .35;
}
function pointInSolid(p) { for (const s of solids) if (s.on && p.x > s.min.x && p.x < s.max.x && p.y > s.min.y && p.y < s.max.y && p.z > s.min.z && p.z < s.max.z) return s; return null; }

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const q = projectiles[i];
    if (q.type === 'rocket') {
      q.v.y -= 1.5 * dt; const prev = q.p.clone(); q.p.addScaledVector(q.v, dt); q.life -= dt;
      q.m.lookAt(q.p.clone().sub(q.v));
      PS_SMOKE.emit(q.p.x, q.p.y, q.p.z, rnd(-.3, .3), rnd(0, .4), rnd(-.3, .3), rnd(1, 2), .15, 1.1, .5, .62, .62, .62, 1);
      PS_FIRE.emit(q.p.x, q.p.y, q.p.z, 0, 0, 0, .05, .25, .1, 1, 4, 2.4, 1);
      let hit = q.life <= 0 || q.p.y < H(q.p.x, q.p.z);
      const sol = pointInSolid(q.p);
      if (sol) hit = true;
      for (const e of enemies) if (e.alive && e.chest(T1).distanceToSquared(q.p) < 1.1) hit = true;
      for (const v of MISSION.vehicles) if (v.alive && q.p.x > v.box.min.x && q.p.x < v.box.max.x && q.p.z > v.box.min.z && q.p.z < v.box.max.z && q.p.y < v.box.max.y) { hit = true; v.damage(700, true); }
      if (hit) {
        const p = prev.lerp(q.p, .5);
        if (sol && sol.tag === 'bunker') { const b = WORLD.bunkers.find(b => b.lower === sol || b.upper === sol || b.side === sol); if (b && !b.destroyed) { b.destroy(); onObjectiveEvent('bunker', b, true); } }
        if (sol && sol.tag === 'flak') { const f = WORLD.flaks.find(f => f.solid === sol); if (f && f.alive) { f.destroy(); onObjectiveEvent('flak', f, true); } }
        explode(p, 5.5, 320, { byPlayer: true, rocket: true });
        scene.remove(q.m); projectiles.splice(i, 1);
      }
      continue;
    }
    // granata
    q.v.y -= 9.8 * dt;
    const np = q.p.clone().addScaledVector(q.v, dt);
    const sol = pointInSolid(np);
    if (sol) {
      const pen = [np.x - sol.min.x, sol.max.x - np.x, np.y - sol.min.y, sol.max.y - np.y, np.z - sol.min.z, sol.max.z - np.z];
      const k = pen.indexOf(Math.min(...pen));
      if (k < 2) q.v.x *= -.35; else if (k < 4) q.v.y *= -.3; else q.v.z *= -.35;
      q.v.multiplyScalar(.7);
    } else q.p.copy(np);
    const g = H(q.p.x, q.p.z), wl = q.p.z > -9 && g < WATER_Y ? WATER_Y : -1e9;
    if (q.p.y < wl) { q.v.multiplyScalar(Math.exp(-4 * dt)); if (!q.splash) { q.splash = true; fxImpact(q.p.clone(), 'water'); } }
    if (q.p.y < g + .07) { q.p.y = g + .07; if (q.v.y < 0) q.v.y *= -.3; q.v.x *= .6; q.v.z *= .6; q.spin.multiplyScalar(.6); if (Math.abs(q.v.y) > 1) sfxImpact(q.p, 'dirt'); }
    q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt;
    q.fuse -= dt;
    if (q.fuse <= 0) {
      const p = q.p.clone(); p.y += .1;
      for (const b of WORLD.bunkers) if (!b.neutralized && Math.abs(p.x - b.x) < 4.6 && Math.abs(p.z - b.z) < 3.6 && p.y > b.base && p.y < b.base + 3.2) { b.gunner.die(p, q.byPlayer); onObjectiveEvent('bunker', b, q.byPlayer); }
      explode(p, 6.5, 240, { byPlayer: q.byPlayer, nade: true, team: q.team });
      scene.remove(q.m); projectiles.splice(i, 1);
    }
  }
}

// ---------- esplosioni ----------
const _ex = new V3();
function explode(p, radius, dmg, o = {}) {
  const wet = p.z > -9 && H(p.x, p.z) < WATER_Y && p.y < WATER_Y + .8;
  fxExplosion(p, radius / 4.5, wet); sfxBoom(p, radius / 5);
  for (const list of [allies, enemies]) for (const s of list) {
    if (!s.alive || s.removed) continue;
    if (s.state === 'boat' && !o.boat) continue;
    if (o.only && s.team !== o.only) continue;
    if (s.inBunker) continue;
    const d = s.chest(_ex).distanceTo(p);
    if (d < radius) {
      let dm = dmg * (1 - d / radius);
      if (s.inTrench && d > 2) dm *= .5;
      if (o.ship) dm *= s.team === 'E' && R() < .25 ? 1 : .12;
      s.damage(dm, p, !!o.byPlayer && s.team === 'E', 'blast');
    }
  }
  if (P.targetable() || (o.boat && !P.dead)) {
    const d = P.chest(_ex).distanceTo(p), r2 = radius * 1.25;
    if (d < r2 && !(o.only === 'E')) {
      let dm = dmg * .55 * Math.pow(1 - d / r2, 1.2);
      if (!losClear(new V3(p.x, p.y + .6, p.z), _ex)) dm *= .3;
      if (P.stance === 2) dm *= .7;
      P.damage(dm * (o.byPlayer ? .8 : D.dmg), p, true);
    }
    if (d < radius * 4) P.shake = Math.min(1.5, P.shake + (1 - d / (radius * 4)) * 1.2);
    if (d < radius * 2.2) muffle(clamp(3.5 - d / radius, 1.2, 3.5));
  }
  for (const v of MISSION.vehicles) if (v.alive) { const d = v.pos.distanceTo(p); if (d < radius + 2.5) v.damage(dmg * (1 - d / (radius + 2.5)) * (o.charge ? 3 : 1), !!o.byPlayer); }
}
function checkMines(pos) {
  for (const m of mines) {
    if (!m.live) continue;
    const dx = pos.x - m.x, dz = pos.z - m.z;
    if (dx * dx + dz * dz < 1.2) {
      m.live = false; sfxMech('dry'); sfxImpact(pos, 'metal');
      after(.4, () => explode(new V3(m.x, H(m.x, m.z) + .3, m.z), 4.5, 260, { mine: true }));
    }
  }
}

// ---------- armi a terra ----------
function spawnPickup(id, pos, mag, res) {
  const gi = buildGun(id), g = gi.group;
  g.rotation.set(0, R() * TAU, PI / 2); g.position.set(pos.x, H(pos.x, pos.z) + .06, pos.z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const w = WEAPONS[id];
  const pk = { id, pos: g.position, mesh: g, mag: mag !== undefined ? mag : w.mag, res: res !== undefined ? res : Math.round(w.mag * 2) };
  WORLD.pickups.push(pk);
  if (WORLD.pickups.length > 22) { const old = WORLD.pickups.find(x => !x.fixed); if (old) removePickup(old); }
  return pk;
}
function removePickup(pk) { scene.remove(pk.mesh); const i = WORLD.pickups.indexOf(pk); if (i >= 0) WORLD.pickups.splice(i, 1); }
function takePickup(pk) {
  const has = P.inv.findIndex(s => s && s.id === pk.id);
  if (has >= 0) { P.inv[has].res += pk.mag + pk.res; removePickup(pk); sfxMech('pick'); feed(`Munizioni: ${WEAPONS[pk.id].name}`); return; }
  let slot = P.inv[1] ? (P.cur === 2 ? 0 : P.cur) : 1;
  if (pk.id === 'colt') slot = 2;
  const old = P.inv[slot];
  if (old) spawnPickup(old.id, new V3(P.pos.x - Math.sin(P.yaw) * 1.2, 0, P.pos.z - Math.cos(P.yaw) * 1.2), old.mag, old.res);
  P.inv[slot] = { id: pk.id, mag: pk.mag, res: pk.res };
  removePickup(pk); sfxMech('pick');
  P.cur = slot; P.switchT = .5; P.reloadT = 0;
  feed(`Raccolto: ${WEAPONS[pk.id].name}`);
}

// ---------- viewmodel: animazioni ----------
let swayX = 0, swayY = 0;
function updateViewmodel(dt) {
  const s = P.slot();
  setViewmodel(P.carry || P.dead || !s ? null : s.id);
  if (!vmCur) { $('scope').style.display = 'none'; return; }
  const w = WEAPONS[s.id], g = vmCur.group;
  const k = P.adsK;
  const base = T1.copy(vmCur.hip).lerp(vmCur.ads, k);
  const bob = P.bobPh, bm = P.moveK * (1 - k * .85);
  let x = base.x + Math.cos(bob * .5) * .012 * bm + swayX, y = base.y - Math.abs(Math.sin(bob * .5)) * .014 * bm + swayY, z = base.z;
  let rx = 0, ry = 0, rz = 0;
  swayX = lerp(swayX, 0, dt * 8); swayY = lerp(swayY, 0, dt * 8);
  z += P.recoil * (k > .5 ? .035 : .06); rx += P.recoil * (k > .5 ? .03 : .09);
  P.recoil = Math.max(0, P.recoil - dt * 9);
  if (P.sprint && P.moveK > .5) { x += .05; y -= .05; ry += .55; rz += .25; rx -= .1; }
  if (P.swim || P.throwT > 0) { y -= .35; rx -= .6; }
  if (P.reloadT > 0) {
    const t = 1 - P.reloadT / P.reloadDur, e = Math.sin(clamp(t, 0, 1) * PI);
    rz += e * .55; rx += e * .25; y -= e * .07; x -= e * .03;
    if (vmCur.mag) { vmCur.mag.visible = !(t > .3 && t < .55); vmCur.mag.position.y = (vmCur.mag.userData.y0 ??= vmCur.mag.position.y) - (t > .2 && t < .65 ? .12 * Math.sin((t - .2) / .45 * PI) : 0); }
  } else if (vmCur.mag) { vmCur.mag.visible = s.mag > 0 || !w.rocket; if (vmCur.mag.userData.y0 !== undefined) vmCur.mag.position.y = vmCur.mag.userData.y0; }
  if (w.rocket && vmCur.mag && P.reloadT <= 0) vmCur.mag.visible = s.mag > 0;
  if (P.boltT > 0 && vmCur.bolt) {
    P.boltT = Math.max(0, P.boltT - dt / (w.rate * .9));
    const e = Math.sin((1 - P.boltT) * PI);
    vmCur.bolt.position.z = .03 + e * .07; vmCur.bolt.rotation.z = e * .9; rz += e * .12;
  }
  if (vmCur.slide) vmCur.slide.position.z = -.09 + P.recoil * .03 + (s.mag === 0 ? .03 : 0);
  if (P.switchT > 0) { y -= P.switchT * .5; rx -= P.switchT * 1.2; }
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
  if (P.flashT > 0) { P.flashT -= dt; vmFlash.visible = P.flashT > 0; } else vmFlash.visible = false;
  const scoped = w.scope && k > .92;
  $('scope').style.display = scoped ? 'block' : 'none';
  g.visible = !scoped;
}
function hitMarker(kill, head) {
  const h = $('hitm'); h.className = kill ? 'kill' : ''; h.style.opacity = 1;
  clearTimeout(h._t); h._t = setTimeout(() => h.style.opacity = 0, kill ? 260 : 120);
  sfxTick();
}
