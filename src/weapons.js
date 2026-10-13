"use strict";
// ============================================================
//  Armi del giocatore: modelli dettagliati, animazioni, balistica,
//  bossoli, granate, razzi, esplosioni, mine, armi a terra, mischia
// ============================================================
const VM = {}, vmCache = {};
let vmRoot, vmCur = null, vmCurId = null, vmFlash;
const projectiles = [];
const STATS = { shots: 0, hits: 0, kills: 0, heads: 0, deaths: 0, start: 0 };

function initWeapons() {
  VM.wood = uvMaterial(TEX.gunwood, 4, { vc: false, rough: 1 });
  VM.wood2 = uvMaterial(TEX.gunwood, 4, { vc: false, rough: 1, color: 0x9a8070 });
  VM.metal = uvMaterial(TEX.gunmetal, 10, { vc: false, rough: 1, metal: .85 });
  VM.blue = uvMaterial(TEX.gunmetal, 10, { vc: false, rough: .7, metal: .95, color: 0x8a92a6 });
  VM.brass = new THREE.MeshStandardMaterial({ color: col(0xc49a45), roughness: .28, metalness: 1 });
  VM.olive = uvMaterial(TEX.metal, 3, { vc: false, rough: 1, metal: .3, color: 0x6a7350 });
  VM.sleeve = uvMaterial(TEX.fabric, 5, { vc: false, rough: 1, color: 0x8a8660, nScale: 1.2 });
  VM.skin = new THREE.MeshStandardMaterial({ color: col(0xc9997a), roughness: .62 });
  VM.bake = new THREE.MeshStandardMaterial({ color: col(0x2c1a10), roughness: .4 });
  VM.glass = new THREE.MeshStandardMaterial({ color: col(0x203040), roughness: .05, metalness: .6 });
  VM.sight = new THREE.MeshStandardMaterial({ color: col(0x0c0c0c), roughness: .85, metalness: .2 });
  VM.flash = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.5, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: TEX.fire.map });
  vmRoot = new THREE.Group(); camera.add(vmRoot);
  const fp = new THREE.PlaneGeometry(1, 1);
  vmFlash = new THREE.Group();
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(fp, VM.flash); m.rotation.z = i * PI / 3; m.rotation.y = PI / 2; m.scale.set(2.2, 1, 1); m.position.z = -.5; vmFlash.add(m); }
  vmFlash.add(new THREE.Mesh(fp, VM.flash)); vmFlash.visible = false;
}

function part(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const CZ = (p, mat, x, y, z, r, len, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.position.set(x, y, z); m.rotation.x = PI / 2; p.add(m); return m; };
// profilo laterale estruso (punti z,y del modello; la canna punta verso -z)
function prof(parent, pts, w, mat, x = 0, bev = .004) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const d = Math.max(.001, w - bev * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -d / 2); g.rotateY(-PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.x = x; parent.add(m); return m;
}
function limb(parent, a, b, r, mat) {
  const d = new V3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, 1, 14), mat);
  m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
  m.scale.set(1, d.length(), 1); parent.add(m); return m;
}
function hand(parent, p, side) {
  const h = new THREE.Group(); h.position.copy(p); parent.add(h);
  part(h, U.box, VM.skin, side * .006, -.005, .012, .036, .075, .085);
  for (let i = 0; i < 4; i++) {
    const y = .022 - i * .019;
    part(h, U.box, VM.skin, side * -.012, y, -.03, .028, .016, .03);
    part(h, U.box, VM.skin, side * -.03, y - .002, -.012, .016, .015, .03, 0, side * .9, 0);
  }
  part(h, U.box, VM.skin, side * -.02, .03, .03, .018, .018, .05, -.4, side * .5, 0);
  return h;
}

// mire metalliche: la linea di mira passa a quota 'y'; in mira si allinea al centro dello schermo
function addSights(g, kind, y, rz, fz, mat, hood, x = 0) {
  const S = VM.sight;
  if (kind === 'aperture') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.0058, .0024, 8, 20), S); ring.position.set(x, y, rz); g.add(ring);
    part(g, U.box, mat, x, y - .012, rz, .022, .012, .016);
    for (const sx of [-1, 1]) part(g, U.box, mat, x + sx * .0095, y - .002, rz, .005, .02, .012);
  } else if (kind === 'notch') {
    for (const sx of [-1, 1]) part(g, U.box, S, x + sx * .0055, y - .003, rz, .006, .009, .006);
    part(g, U.box, mat, x, y - .01, rz, .02, .008, .012);
  } else if (kind === 'frame') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.006, .0018, 8, 20), S); ring.position.set(x, y, rz); g.add(ring);
    for (const [w, h, dx, dy] of [[.04, .003, 0, .02], [.04, .003, 0, -.02], [.003, .04, .02, 0], [.003, .04, -.02, 0], [.002, .03, 0, 0], [.03, .0015, 0, 0]]) part(g, U.box, S, x + dx, y + dy, fz, w, h, .003);
    return;
  }
  // mirino anteriore: lama con protezioni
  part(g, U.box, S, x, y - .006, fz, .0042, .012, .005);
  part(g, U.box, mat, x, y - .016, fz, .016, .01, .014);
  if (hood) { const hd = new THREE.Mesh(new THREE.TorusGeometry(.01, .0018, 6, 14, PI), mat); hd.position.set(x, y - .006, fz); g.add(hd); }
  else for (const sx of [-1, 1]) part(g, U.box, mat, x + sx * .009, y - .004, fz, .003, .018, .01);
}
// costruzione delle armi (usate anche a terra)
function buildGun(id) {
  const g = new THREE.Group(); let i = {};
  if (id === 'garand' || id === 'kar98' || id === 'springfield' || id === 'kar98zf') {
    const W = id === 'kar98' ? VM.wood2 : VM.wood, Mt = id === 'garand' ? VM.metal : VM.blue;
    prof(g, [[.43, .03], [.27, .035], [.12, .018], [.05, 0], [-.02, 0], [-.05, .012], [-.3, .012], [-.6, .008], [-.62, -.005], [-.6, -.025], [-.3, -.03], [-.08, -.034], [.02, -.04], [.07, -.085], [.11, -.08], [.15, -.055], [.43, -.105], [.44, -.04]], .042, W);
    prof(g, [[-.1, .012], [-.1, .03], [-.3, .034], [-.3, .012]], .036, W);
    prof(g, [[-.38, .012], [-.38, .028], [-.58, .026], [-.58, .012]], .034, W);
    part(g, U.box, Mt, 0, -.035, .44, .044, .11, .01);
    CZ(g, Mt, 0, .03, -.62, .0115, .78);
    part(g, U.box, Mt, 0, -.045, .005, .007, .028, .06); part(g, U.box, Mt, 0, -.025, 0, .004, .025, .008, .3);
    for (const z of [-.33, -.6]) part(g, U.box, Mt, 0, .012, z, .046, .05, .012);
    let mag = null, bolt = null;
    if (id === 'garand') {
      prof(g, [[.07, 0], [.07, .035], [.04, .05], [-.05, .05], [-.14, .04], [-.17, .03], [-.17, 0]], .03, Mt);
      CZ(g, Mt, 0, .012, -.84, .013, .12);
      addSights(g, 'aperture', .068, .055, -.905, Mt);
      part(g, U.box, Mt, .02, .022, -.3, .008, .014, .42); part(g, U.box, Mt, .026, .025, -.08, .014, .02, .03);
      mag = new THREE.Group(); mag.position.set(0, .052, -.045); g.add(mag);
      part(mag, U.box, VM.brass, 0, 0, 0, .022, .012, .062);
      for (let k = 0; k < 4; k++) CZ(mag, VM.brass, (k % 2 ? .005 : -.005), .008, -.022 + k * .015, .005, .02);
    } else {
      CZ(g, Mt, 0, .028, -.05, .016, .24);
      bolt = new THREE.Group(); bolt.position.set(0, .028, .03); g.add(bolt);
      CZ(bolt, Mt, 0, 0, 0, .009, .1);
      const hd = new THREE.Group(); hd.position.set(.01, 0, .03); bolt.add(hd);
      part(hd, U.box, Mt, .025, id === 'kar98' ? -.012 : -.008, 0, .05, .009, .009, 0, 0, id === 'kar98' ? -.45 : -.25);
      part(hd, U.sph, Mt, .05, id === 'kar98' ? -.025 : -.016, 0, .012, .012, .012);
      mag = new THREE.Group(); mag.position.set(0, .046, -.04); g.add(mag);
      for (let k = 0; k < 5; k++) CZ(mag, VM.brass, 0, 0, -.02 + k * .01, .005, .03);
      if (id === 'kar98') addSights(g, 'notch', .06, -.17, -.86, Mt, true);
      if (id === 'springfield' || id === 'kar98zf') {
        CZ(g, VM.blue, 0, .085, -.04, .013, .3); CZ(g, VM.blue, 0, .085, .135, .019, .07); CZ(g, VM.blue, 0, .085, -.205, .018, .05);
        part(g, U.box, VM.blue, 0, .062, .04, .012, .03, .016); part(g, U.box, VM.blue, 0, .062, -.12, .012, .03, .016);
        const k1 = CZ(g, VM.blue, 0, .1, -.04, .007, .015); k1.rotation.set(0, 0, 0);
        const k2 = CZ(g, VM.blue, .015, .085, -.04, .007, .015); k2.rotation.set(0, 0, PI / 2);
        CZ(g, VM.glass, 0, .085, .171, .016, .004);
      }
    }
    i = { mag, bolt, muzzle: new V3(0, .03, -1.01), port: new V3(.02, .05, -.04), hip: new V3(.16, -.17, -.32), ads: new V3(0, -.068, -.17), grip: new V3(0, -.045, .065), fore: new V3(0, -.014, -.38), magOut: new V3(0, .2, 0) };
    if (id === 'springfield' || id === 'kar98zf') i.ads = new V3(0, -.085, -.12);
    if (id === 'kar98') i.ads = new V3(0, -.06, -.16);
  } else if (id === 'thompson') {
    prof(g, [[.36, .01], [.36, -.09], [.14, -.045], [.1, -.03], [.1, .015], [.16, .02]], .04, VM.wood);
    prof(g, [[.1, 0], [.1, .055], [-.16, .055], [-.18, .04], [-.18, 0]], .044, VM.metal);
    prof(g, [[.04, 0], [.065, -.1], [.025, -.112], [0, -.02]], .032, VM.wood);
    prof(g, [[-.18, .01], [-.18, -.028], [-.33, -.024], [-.34, .012]], .042, VM.wood);
    CZ(g, VM.metal, 0, .035, -.32, .0145, .28); CZ(g, VM.metal, 0, .035, -.46, .017, .015);
    addSights(g, 'aperture', .078, .075, -.445, VM.metal);
    const ck = CZ(g, VM.metal, .03, .045, -.05, .007, .02); ck.rotation.set(0, 0, PI / 2);
    part(g, U.box, VM.metal, 0, -.022, .02, .006, .03, .07);
    const mag = new THREE.Group(); mag.position.set(0, -.09, -.11); g.add(mag);
    part(mag, U.box, VM.metal, 0, 0, 0, .028, .17, .048); part(mag, U.box, VM.metal, 0, -.085, 0, .032, .01, .052);
    i = { mag, muzzle: new V3(0, .035, -.47), port: new V3(.025, .05, -.02), hip: new V3(.15, -.16, -.3), ads: new V3(0, -.078, -.2), grip: new V3(0, -.055, .03), fore: new V3(0, -.012, -.27), magOut: new V3(0, -.25, .05), charge: new V3(.03, .045, -.05) };
  } else if (id === 'bar') {
    prof(g, [[.45, .02], [.45, -.1], [.3, -.07], [.12, -.03], [.1, .02], [.3, .03]], .046, VM.wood);
    prof(g, [[.1, -.02], [.125, -.11], [.075, -.118], [.05, -.02]], .034, VM.wood);
    prof(g, [[.12, 0], [.12, .06], [-.28, .06], [-.3, .035], [-.3, -.02], [0, -.02], [.02, 0]], .052, VM.metal);
    prof(g, [[-.3, 0], [-.3, .045], [-.52, .04], [-.52, 0]], .05, VM.wood);
    CZ(g, VM.metal, 0, .045, -.6, .014, .6); CZ(g, VM.metal, 0, .01, -.6, .012, .3); CZ(g, VM.metal, 0, .045, -.93, .019, .07);
    for (let k = 0; k < 3; k++) part(g, U.box, VM.metal, 0, .045, -.91 - k * .015, .045, .004, .004);
    addSights(g, 'aperture', .086, .1, -.9, VM.metal);
    for (const sx of [-1, 1]) { const l = CZ(g, VM.metal, sx * .025, .02, -.7, .005, .36, 6); l.rotation.x = PI / 2 + .04; }
    const mag = new THREE.Group(); mag.position.set(0, -.05, -.12); g.add(mag);
    part(mag, U.box, VM.metal, 0, 0, 0, .036, .1, .076);
    i = { mag, muzzle: new V3(0, .045, -.97), port: new V3(.028, .04, -.05), hip: new V3(.17, -.17, -.3), ads: new V3(0, -.086, -.17), grip: new V3(0, -.06, .085), fore: new V3(0, -.02, -.4), magOut: new V3(0, -.25, 0), charge: new V3(-.03, .03, -.2) };
  } else if (id === 'colt') {
    const slide = new THREE.Group(); g.add(slide);
    prof(slide, [[.04, .03], [.04, .06], [-.17, .06], [-.17, .035], [-.02, .03]], .028, VM.metal);
    for (let k = 0; k < 6; k++) part(slide, U.box, VM.metal, 0, .045, .01 + k * .005, .03, .022, .002);
    addSights(slide, 'notch', .071, .03, -.16, VM.metal);
    prof(g, [[.04, .03], [.03, .01], [-.12, .012], [-.12, .03]], .027, VM.metal);
    prof(g, [[.035, .012], [.062, -.085], [.025, -.095], [0, 0]], .033, VM.wood2);
    CZ(g, VM.metal, 0, .045, -.17, .008, .01);
    part(g, U.box, VM.metal, 0, .055, .045, .01, .02, .012, -.4);
    part(g, U.box, VM.metal, 0, -.005, -.045, .006, .025, .05);
    const mag = new THREE.Group(); mag.position.set(0, -.08, .015); g.add(mag);
    part(mag, U.box, VM.metal, 0, 0, 0, .024, .012, .04);
    i = { mag, slide, muzzle: new V3(0, .045, -.19), port: new V3(.016, .05, -.04), hip: new V3(.13, -.14, -.32), ads: new V3(0, -.071, -.28), grip: new V3(0, -.04, .02), fore: new V3(-.012, -.065, .03), magOut: new V3(0, -.2, 0) };
  } else if (id === 'bazooka') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, 1.45, 20, 1, true), VM.olive); tube.rotation.x = PI / 2; tube.position.z = -.3; g.add(tube);
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(.07, .048, .14, 20, 1, true), VM.olive); flare.rotation.x = -PI / 2; flare.position.z = .46; g.add(flare);
    for (const z of [-1.02, -.6, -.1, .3]) CZ(g, VM.olive, 0, 0, z, .053, .04, 20);
    prof(g, [[.18, -.04], [.18, -.1], [-.08, -.08], [-.08, -.04]], .045, VM.wood);
    prof(g, [[-.04, -.04], [-.02, -.13], [-.06, -.135], [-.08, -.04]], .03, VM.metal);
    prof(g, [[-.33, -.04], [-.31, -.13], [-.35, -.135], [-.37, -.04]], .03, VM.metal);
    addSights(g, 'frame', .045, -.2, -.55, VM.metal, false, -.066);
    part(g, U.box, VM.olive, 0, -.065, -.22, .04, .05, .1);
    const mag = new THREE.Group(); mag.position.set(0, 0, -1.09); g.add(mag);
    const wh = new THREE.Mesh(new THREE.ConeGeometry(.042, .16, 16), VM.olive); wh.rotation.x = -PI / 2; wh.position.z = -.06; mag.add(wh);
    CZ(mag, VM.olive, 0, 0, .04, .04, .07);
    i = { mag, muzzle: new V3(0, 0, -1.05), hip: new V3(.2, -.13, -.25), ads: new V3(.066, -.045, -.22), grip: new V3(0, -.11, -.04), fore: new V3(0, -.11, -.34), magOut: new V3(0, 0, -.5) };
  } else if (id === 'mp40') {
    CZ(g, VM.blue, 0, .03, -.1, .02, .3); for (let k = 0; k < 8; k++) CZ(g, VM.blue, 0, .03, -.2 + k * .025, .022, .006);
    CZ(g, VM.blue, 0, .03, -.33, .01, .16); CZ(g, VM.blue, 0, .03, -.41, .013, .02);
    part(g, U.box, VM.blue, 0, .005, -.37, .015, .02, .04);
    part(g, U.box, VM.blue, 0, -.02, -.17, .03, .06, .05);
    prof(g, [[.05, .01], [.07, -.09], [.03, -.1], [.01, 0]], .032, VM.bake);
    for (const sx of [-1, 1]) part(g, U.box, VM.blue, sx * .012, 0, .16, .006, .012, .25);
    part(g, U.box, VM.blue, 0, -.03, .29, .03, .07, .01);
    addSights(g, 'notch', .064, 0, -.4, VM.blue, true);
    const ck = CZ(g, VM.blue, -.025, .03, -.05, .007, .02); ck.rotation.set(0, 0, PI / 2);
    const mag = new THREE.Group(); mag.position.set(0, -.09, -.17); g.add(mag);
    part(mag, U.box, VM.blue, 0, 0, 0, .022, .2, .035);
    i = { mag, muzzle: new V3(0, .03, -.43), port: new V3(.022, .04, -.05), hip: new V3(.15, -.15, -.3), ads: new V3(0, -.064, -.2), grip: new V3(0, -.045, .04), fore: new V3(0, -.1, -.17), magOut: new V3(0, -.25, 0), charge: new V3(-.03, .03, -.05) };
  }
  i.group = g; return i;
}
function buildViewmodel(id) {
  const i = buildGun(id), g = i.group;
  const rh = i.grip, lh = i.fore;
  hand(g, new V3(rh.x + .012, rh.y, rh.z), 1);
  limb(g, new V3(rh.x + .03, rh.y - .03, rh.z + .05), new V3(.24, -.42, .34), .034, VM.sleeve);
  i.lhand = new THREE.Group(); g.add(i.lhand);
  i.lbase = lh.clone(); i.lhand.position.copy(lh);
  hand(i.lhand, new V3(-.01, -.01, 0), -1);
  i.larm = new THREE.Mesh(new THREE.CylinderGeometry(.036, .04, 1, 14), VM.sleeve); g.add(i.larm);
  i.elbowL = new V3(-.34, -.46, .02);
  if (i.mag) i.magBase = i.mag.position.clone();
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

// ---------- bersagli: zone del corpo ----------
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1;
}
const HITZ = [['neck', 0, .12, 0, .13, 'head', 2], ['spine', 0, .3, 0, .2, 'body', 15], ['spine', 0, .08, 0, .18, 'body', 15], ['hips', 0, 0, 0, .17, 'body', 0],
['hipL', 0, -.22, 0, .09, 'legs', 10], ['hipR', 0, -.22, 0, .09, 'legs', 13], ['knL', 0, -.2, 0, .075, 'legs', 11], ['knR', 0, -.2, 0, .075, 'legs', 14],
['shL', 0, -.15, 0, .065, 'arms', 4], ['shR', 0, -.15, 0, .065, 'arms', 7], ['elL', 0, -.13, 0, .055, 'arms', 5], ['elR', 0, -.13, 0, .055, 'arms', 8]];
const _hs = new V3();
function hitscan(o, d, maxT) {
  let bt = maxT, type = null, obj = null, zone = null, joint = 15;
  const sr = raySolids(o, d, bt); if (sr) { bt = sr.t; type = 'solid'; obj = sr.s; }
  const tt = rayTerrain(o, d, bt); if (tt >= 0 && tt < bt) { bt = tt; type = 'terrain'; obj = null; }
  for (const e of FOES()) {
    if (!e.alive || e.removed) continue;
    const cx = e.pos.x - o.x, cy = e.pos.y + .9 - o.y, cz = e.pos.z - o.z, pr = cx * d.x + cy * d.y + cz * d.z;
    if (pr < 0 || pr > bt + 1.5 || cx * cx + cy * cy + cz * cz - pr * pr > 4) continue;
    const b = e.body; b.root.updateMatrixWorld(true);
    for (const [n, x, y, z, r, zn, j] of HITZ) {
      if (e.inBunker && zn !== 'head') continue;
      const t = raySphere(o, d, _hs.set(x, y, z).applyMatrix4(b[n].matrixWorld), r);
      if (t > 0 && t < bt) { bt = t; type = 'enemy'; obj = e; zone = zn; joint = j; }
    }
  }
  for (const v of MISSION.vehicles) {
    if (!v.alive) continue;
    const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, v.box, bt); if (t >= 0 && t < bt) { bt = t; type = 'vehicle'; obj = v; }
    if (v.gunnerAlive) { const t2 = raySphere(o, d, v.gunnerHead(_hs), .2); if (t2 > 0 && t2 <= bt + .2) { bt = t2; type = 'vgunner'; obj = v; } }
  }
  for (const pl of PLANES) {
    if (!pl.alive || pl.player) continue;
    const t = raySphere(o, d, pl.pos, 5); if (t > 0 && t < bt) { bt = t; type = 'plane'; obj = pl; }
  }
  return { t: bt, type, obj, zone, joint };
}

const _o = new V3(), _d = new V3(), _r = new V3(), _w = new V3();
function playerFire() {
  const s = P.slot(); if (!s) return;
  const w = WEAPONS[s.id];
  if (P.fireCD > 0 || P.reloadT > 0 || P.switchT > 0 || P.throwT > 0 || P.carry || P.swim || P.inBoat || P.dead || P.interacting || P.meleeT > 0) return;
  if (s.mag <= 0) { sfxMech('dry'); P.fireCD = .3; if (s.res > 0) startReload(); P.trigger = false; return; }
  s.mag--; P.fireCD = w.rate; STATS.shots++;
  P.recoil = 1; P.kickP += w.kick * (P.adsK > .5 ? .55 : 1) * (P.stance === 2 ? .5 : 1); P.kickY += rnd(-1, 1) * w.kick * .35;
  P.pitch += w.kick * .18 + (w.climb || 0) * (P.stance === 2 ? .5 : 1);
  if (!w.auto) P.trigger = false;
  sfxShot(w.snd, null, true);
  vmFlash.visible = true; vmFlash.scale.setScalar(w.rocket ? .35 : rnd(.08, .13)); vmFlash.rotation.z = R() * PI; P.flashT = .045;
  camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  flashLight(_o.clone().addScaledVector(_d, 1.5), 0xffb060, w.rocket ? 30 : 10, .06);
  if (vmCur) {
    const mz = vmCur.group.localToWorld(vmCur.muzzle.clone());
    PS_SMOKE.emit(mz.x, mz.y, mz.z, _d.x * .8, .3, _d.z * .8, rnd(.8, 1.4), .05, .5, .25, .6, .6, .6, 2, -.2);
    if (vmCur.port && !w.bolt && !w.rocket) {
      const pp = vmCur.group.localToWorld(vmCur.port.clone()), rt = _w.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
      fxCasing(pp, rt.multiplyScalar(rnd(2, 3.2)).add(new V3(0, rnd(1.5, 2.6), 0)).addScaledVector(_d, -.3));
    }
  }
  if (w.ping && s.mag === 0) {
    sfxPing();
    if (vmCur && vmCur.mag) { const cp = vmCur.group.localToWorld(vmCur.magBase.clone()); fxCasing(cp, new V3(rnd(-.5, .5), 4, 0).addScaledVector(_d, -.5)); }
  }
  if (w.bolt && s.mag > 0) {
    P.boltT = 1; sfxMech('bolt', .3); sfxMech('boltc', .55);
    setTimeout(() => { if (vmCur && vmCur.port) { const pp = vmCur.group.localToWorld(vmCur.port.clone()); fxCasing(pp, new V3(Math.cos(P.yaw) * 2, 2, -Math.sin(P.yaw) * 2)); } }, 380);
  }
  if (w.rocket) { fireRocket(_o, _d); if (s.mag === 0 && s.res > 0) setTimeout(startReload, 500); return; }
  const spread = (P.adsK > .5 ? w.ads : w.hip) * [1, .75, .55][P.stance] + P.bloom + (P.moveK * (P.adsK > .5 ? .012 : .03));
  P.bloom = Math.min(.04, P.bloom + (w.auto ? .0035 : .008));
  _d.x += rnd(-1, 1) * spread; _d.y += rnd(-1, 1) * spread; _d.z += rnd(-1, 1) * spread; _d.normalize();
  const r = hitscan(_o, _d, w.range || 600), p = _r.copy(_o).addScaledVector(_d, r.t);
  netShot(_o, p, w.snd);
  if (w.auto && (w.snd === 'bar' || w.snd === 'mg42') ? STATS.shots % 3 === 0 : r.t > 30 && R() < .25) fxTracer(_o.clone().addScaledVector(_d, 3), p, w.auto ? 1.1 : .7);
  if (_o.y > WATER_Y && _d.y < 0) {
    const tw = (WATER_Y - _o.y) / _d.y, wz = _o.z + _d.z * tw;
    if (tw < r.t && wz > -9 && Hf(_o.x + _d.x * tw, wz) < WATER_Y) { fxImpact(new V3(_o.x + _d.x * tw, WATER_Y, wz), 'water'); if (r.type !== 'enemy') return; }
  }
  if (r.type === 'enemy') {
    let dm = w.dmg * (r.zone === 'head' ? 3.2 : r.zone === 'legs' ? .65 : r.zone === 'arms' ? .5 : 1);
    if (w.falloff && r.t > w.falloff) dm *= clamp(1 - (r.t - w.falloff) / (w.range || 200), .45, 1);
    const killed = r.obj.damage(dm, _o, true, r.zone, { dir: _d.clone(), power: w.dmg > 100 ? 3.4 : w.dmg > 60 ? 2.6 : 1.8, joint: r.joint });
    STATS.hits++; if (killed && r.zone === 'head') STATS.heads++;
    bloodHit(p.clone(), _d, r.zone === 'head' ? 1.5 : 1); hitMarker(killed, r.zone === 'head');
  } else if (r.type === 'vehicle') { r.obj.damage(w.dmg * .15, true); fxImpact(p.clone(), 'metal'); sfxImpact(p, 'metal'); if (R() < .4) sfxRicochet(p); }
  else if (r.type === 'vgunner') { r.obj.killGunner(true); STATS.hits++; hitMarker(true, true); bloodHit(p.clone(), _d, 1.2); }
  else if (r.type === 'plane') { r.obj.damage(w.dmg * .3, true); fxImpact(p.clone(), 'metal'); hitMarker(false, false); }
  else if (r.type === 'terrain') { fxImpact(p.clone(), p.z > -58.5 ? 'sand' : 'dirt'); if (r.t < 25) sfxImpact(p, 'sand'); }
  // fuoco di soppressione: colpi vicino alla feritoia o ai nemici
  if (PT === 'A') for (const b of [...WORLD.bunkers, ...(WORLD.extraBunkers || [])]) if (Math.abs(p.x - b.x) < 5.5 && Math.abs(p.z - (b.z + 3.5)) < 3.5 && Math.abs(p.y - b.slitY) < 1.8) suppressBunker(b);
  for (const e of FOES()) if (e.alive && !e.inBunker && e.pos.distanceToSquared(p) < 9) e.supp = Math.min(1, e.supp + .45);
  if (r.type === 'solid') {
    const t = r.obj.tag, k = t === 'boat' || t === 'tank' || t === 'flak' ? 'metal' : t === 'hedge' ? 'dirt' : (t === 'house' || t === 'ruin' || t === 'wall' || t === 'church' || t === 'tower' || t === 'bunker') ? 'stone' : 'wood';
    fxImpact(p.clone(), k); if (r.t < 40) { sfxImpact(p, k); if ((k === 'metal' || k === 'stone') && R() < .3) sfxRicochet(p); }
  }
  if (s.mag === 0 && s.res > 0) setTimeout(() => { if (P.slot() === s && s.mag === 0) startReload(); }, w.ping ? 450 : 350);
}
function startReload() {
  const s = P.slot(); if (!s || P.reloadT > 0 || P.switchT > 0) return;
  const w = WEAPONS[s.id];
  if (s.mag >= w.mag || s.res <= 0) return;
  P.reloadT = w.reload; P.reloadDur = w.reload; P.adsK = Math.min(P.adsK, .3);
  if (s.id === 'garand') { sfxMech('clip', w.reload * .5); sfxMech('boltc', w.reload * .78); }
  else if (w.bolt) { sfxMech('bolt', .2); for (let k = 0; k < Math.min(5, w.mag - s.mag); k++) sfxMech('in', .5 + k * .35); sfxMech('boltc', w.reload * .88); }
  else { sfxMech('out', w.reload * .22); sfxMech('in', w.reload * .6); if (s.id !== 'bazooka') sfxMech('boltc', w.reload * .85); }
  if (R() < .3) shout('en', 'reload', null, { vol: .5 });
}
function finishReload() {
  const s = P.slot(); if (!s) return; const w = WEAPONS[s.id];
  const n = Math.min(w.mag - s.mag, s.res); s.mag += n; s.res -= n;
}
function playerMelee() {
  if (P.meleeT > 0 || P.dead || P.inBoat || !P.slot() || P.mode !== 'foot') return;
  P.meleeT = .75;
  setTimeout(() => {
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    for (const e of FOES()) {
      if (!e.alive) continue;
      _w.subVectors(e.chest(T1), _o); const d = _w.length(); _w.normalize();
      if (d < 2.4 && _w.dot(_d) > .6) {
        e.damage(200, _o, true, 'body', { dir: _d.clone(), power: 4, joint: 15 });
        bloodHit(e.chest(T1), _d, 1); play('thud', null, { vol: 1 }); P.shake += .2; hitMarker(true, false); break;
      }
    }
    play('whiz', null, { vol: .2, rate: .5 });
  }, 140);
}

// ---------- proiettili ----------
let NADE_G, STICK_G, ROCKET_G;
function projGeos() {
  if (NADE_G) return;
  let mb = new MB(); mb.add(U.sph, 0x4f5a3a, 0, 0, 0, 0, 0, 0, .045, .06, .045); for (let k = 0; k < 6; k++) mb.add(U.box, 0x434d31, 0, -.04 + k * .016, 0, 0, 0, 0, .095, .005, .095); mb.add(U.cyl, 0x666666, 0, .065, 0, 0, 0, 0, .015, .03, .015); mb.add(U.box, 0x777777, .02, .06, 0, 0, 0, .5, .01, .05, .015); NADE_G = mb.build();
  mb = new MB(); mb.add(U.cyl, 0x6b4a2a, 0, 0, 0, 0, 0, 0, .017, .28, .017); mb.add(U.cyl12, 0x55605a, 0, .17, 0, 0, 0, 0, .035, .1, .035); STICK_G = mb.build();
  mb = new MB(); mb.add(U.cyl, 0x4d5537, 0, 0, 0, PI / 2, 0, 0, .04, .4, .04); mb.add(U.cone, 0x4d5537, 0, 0, -.28, -PI / 2, 0, 0, .04, .16, .04); for (let k = 0; k < 4; k++) mb.add(U.box, 0x4d5537, 0, 0, .2, 0, 0, k * PI / 4, .1, .005, .06); ROCKET_G = mb.build();
}
function spawnNade(p, v, fuse, team, byPlayer) {
  projGeos();
  const m = new THREE.Mesh(team === 'A' ? NADE_G : STICK_G, MAT.vc); m.position.copy(p); m.castShadow = true; scene.add(m);
  const n = { type: 'nade', p: m.position, v: v.clone(), fuse, m, team, byPlayer, spin: new V3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)) };
  projectiles.push(n); return n;
}
function throwPlayerNade() {
  if (P.nades <= 0 || P.throwT > 0 || P.inBoat || P.dead || P.swim || P.carry || P.mode !== 'foot') return;
  P.nades--; P.throwT = .75; sfxMech('pin');
  setTimeout(() => {
    if (P.dead) return;
    camera.getWorldPosition(_o); camera.getWorldDirection(_d);
    const p = _o.clone().addScaledVector(_d, .5); p.y -= .1;
    const v = _d.clone().multiplyScalar(P.stance === 2 ? 13 : 18.5); v.y += 3.5;
    spawnNade(p, v, 3.6, 'A', true);
    if (R() < .5) shout('en', 'grenade', null, { vol: .6, text: 'Frag out!' });
  }, 260);
}
function fireRocket(o, d) {
  projGeos();
  const m = new THREE.Mesh(ROCKET_G, MAT.vcMetal), p = o.clone().addScaledVector(d, 1.1);
  m.position.copy(p); m.lookAt(p.clone().sub(d)); scene.add(m);
  projectiles.push({ type: 'rocket', p: m.position, v: d.clone().multiplyScalar(85), life: 5, m });
  sfxRocket(o);
  const back = o.clone().addScaledVector(d, -1.2);
  for (let i = 0; i < 14; i++) PS_SMOKE.emit(back.x, back.y, back.z, -d.x * rnd(4, 9) + rnd(-1, 1), rnd(0, 1.5), -d.z * rnd(4, 9) + rnd(-1, 1), rnd(1.5, 3), .4, 2.5, .6, .6, .6, .6, 2);
  P.shake += .35;
}
function pointInSolid(p) { for (const s of solids) if (s.on && p.x > s.min.x && p.x < s.max.x && p.y > s.min.y && p.y < s.max.y && p.z > s.min.z && p.z < s.max.z) return s; return null; }

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const q = projectiles[i];
    if (q.type === 'rocket' || q.type === 'shell' || q.type === 'bomb') {
      q.v.y -= (q.type === 'rocket' ? 1.5 : 9.8) * dt;
      if (q.type === 'bomb') q.v.multiplyScalar(1 - .02 * dt);
      const prev = q.p.clone(); q.p.addScaledVector(q.v, dt); q.life -= dt;
      q.m.lookAt(q.p.clone().sub(q.v));
      if (q.type === 'rocket') { PS_SMOKE.emit(q.p.x, q.p.y, q.p.z, rnd(-.3, .3), rnd(0, .4), rnd(-.3, .3), rnd(1, 2), .15, 1.1, .5, .62, .62, .62, 1); PS_FIRE.emit(q.p.x, q.p.y, q.p.z, 0, 0, 0, .05, .25, .1, 1, 4, 2.4, 1); }
      else if (q.type === 'shell') PS_FIRE.emit(q.p.x, q.p.y, q.p.z, 0, 0, 0, .08, 1.4, .4, 1, 4, 2.5, 1.2);
      if (q.type === 'bomb' && !q.wh && q.v.y < -8) { q.wh = true; sfxWhistle(q.p, true); }
      let hit = q.life <= 0 || q.p.y < Hf(q.p.x, q.p.z) || (q.p.z > -9 && q.p.y < WATER_Y && Hf(q.p.x, q.p.z) < WATER_Y);
      const sol = pointInSolid(q.p); if (sol) hit = true;
      if (q.type === 'rocket') {
        for (const e of FOES()) if (e.alive && e.chest(T1).distanceToSquared(q.p) < 1.1) hit = true;
        for (const v of MISSION.vehicles) if (v.alive && q.p.x > v.box.min.x && q.p.x < v.box.max.x && q.p.z > v.box.min.z && q.p.z < v.box.max.z && q.p.y < v.box.max.y) { hit = true; v.damage(700, true); }
      }
      if (hit) {
        const p = prev.lerp(q.p, .5);
        if (sol && sol.tag === 'bunker' && q.byPlayer !== false) { const b = WORLD.bunkers.find(b => b.lower === sol || b.upper === sol || b.side === sol); if (b && !b.destroyed) { b.destroy(); onObjectiveEvent('bunker', b, true); } }
        if (sol && sol.tag === 'flak') { const f = WORLD.flaks.find(f => f.solid === sol); if (f && f.alive) { f.destroy(); onObjectiveEvent('flak', f, true); } }
        if (q.type === 'rocket') explode(p, 5.5, 320, { byPlayer: true, rocket: true });
        else if (q.type === 'shell') navalImpact(p, q);
        else bombImpact(p, q);
        scene.remove(q.m); projectiles.splice(i, 1);
      }
      continue;
    }
    // granata
    q.v.y -= 9.8 * dt;
    const np = q.p.clone().addScaledVector(q.v, dt), sol = pointInSolid(np);
    if (sol) {
      const pen = [np.x - sol.min.x, sol.max.x - np.x, np.y - sol.min.y, sol.max.y - np.y, np.z - sol.min.z, sol.max.z - np.z];
      const k = pen.indexOf(Math.min(...pen));
      if (k < 2) q.v.x *= -.35; else if (k < 4) q.v.y *= -.3; else q.v.z *= -.35;
      q.v.multiplyScalar(.7); play('nade_bounce', q.p, { ref: 8 });
    } else q.p.copy(np);
    const g = Hf(q.p.x, q.p.z), wl = q.p.z > -9 && g < WATER_Y ? WATER_Y : -1e9;
    if (q.p.y < wl) { q.v.multiplyScalar(Math.exp(-4 * dt)); if (!q.splash) { q.splash = true; fxImpact(q.p.clone(), 'water'); } }
    if (q.p.y < g + .07) { q.p.y = g + .07; if (q.v.y < -1) play('nade_bounce', q.p, { ref: 8 }); if (q.v.y < 0) q.v.y *= -.3; q.v.x *= .6; q.v.z *= .6; q.spin.multiplyScalar(.6); }
    q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt;
    q.fuse -= dt;
    if (q.fuse <= 0) {
      const p = q.p.clone(); p.y += .1;
      for (const b of WORLD.bunkers) if (!b.neutralized && Math.abs(p.x - b.x) < 4.6 && Math.abs(p.z - b.z) < 3.6 && p.y > b.base && p.y < b.base + 3.2) { b.gunner.die(p, q.byPlayer, 'blast', { blast: p, power: 8 }); onObjectiveEvent('bunker', b, q.byPlayer); }
      explode(p, 6.5, 240, { byPlayer: q.byPlayer, nade: true, team: q.team });
      scene.remove(q.m); projectiles.splice(i, 1);
    }
  }
}

// ---------- esplosioni ----------
const _ex = new V3();
function explode(p, radius, dmg, o = {}) {
  const wet = p.z > -9 && Hf(p.x, p.z) < WATER_Y && p.y < WATER_Y + .8;
  fxExplosion(p, radius / 4.5, wet); sfxBoom(p, radius / 5, wet);
  if (radius >= 4 && Math.abs(p.z - WIRE_Z) < 2.6 && addWireGap(p.x)) onWireGap(p.x);
  for (const list of [allies, enemies]) for (const s of list) {
    if (!s.alive || s.removed) continue;
    if (s.state === 'boat' && !o.boat) continue;
    if (o.only && s.team !== o.only) continue;
    if (s.inBunker && !(o.bomb && o.byPlayer)) continue;
    const d = s.chest(_ex).distanceTo(p);
    if (d < radius) {
      let dm = dmg * (1 - d / radius);
      if (s.inTrench && d > 2) dm *= .5;
      if (s.prone > .5) dm *= .6;
      if (o.ship) dm *= s.team === 'E' && R() < .25 ? 1 : .12;
      s.damage(dm, p, !!o.byPlayer && s.team !== PT, 'blast', { blast: p.clone(), power: radius * 1.6 });
    } else if (d < radius * 2.5) s.supp = Math.min(1, s.supp + .5);
  }
  if (P.mode === 'foot' && (P.targetable() || (o.boat && !P.dead))) {
    const d = P.chest(_ex).distanceTo(p), r2 = radius * 1.25;
    if (d < r2 && (!o.only || o.only === PT)) {
      let dm = dmg * .55 * Math.pow(1 - d / r2, 1.2);
      if (!losClear(new V3(p.x, p.y + .6, p.z), _ex)) dm *= .3;
      if (P.stance === 2) dm *= .7;
      P.damage(dm * (o.byPlayer ? .8 : D.dmg), p, true);
    }
    if (d < radius * 4) P.shake = Math.min(1.6, P.shake + (1 - d / (radius * 4)) * 1.3);
    if (d < radius * 2.2) { muffle(clamp(3.5 - d / radius, 1.2, 3.5)); if (d < radius * 1.6) P.shellShock(clamp(1.6 - d / radius, .4, 1)); }
    if (d < radius * 5) P.supp = Math.min(1, P.supp + .4);
  }
  for (const v of MISSION.vehicles) if (v.alive) { const d = v.pos.distanceTo(p); if (d < radius + 2.5) v.damage(dmg * (1 - d / (radius + 2.5)) * (o.charge ? 3 : 1), !!o.byPlayer); }
  for (const a of WORLD.aaSites) if (!a.dead && a.mesh && a.mesh.position.distanceTo(p) < Math.max(4, radius * .6)) { a.dead = true; burnMeshes(a.mesh); }
}
function checkMines(pos) {
  for (const m of mines) {
    if (!m.live) continue;
    const dx = pos.x - m.x, dz = pos.z - m.z;
    if (dx * dx + dz * dz < 1.2) {
      m.live = false; sfxMech('dry'); sfxImpact(pos, 'metal');
      after(.4, () => explode(new V3(m.x, Hf(m.x, m.z) + .3, m.z), 4.5, 280, { mine: true }));
    }
  }
}

// ---------- armi a terra ----------
function spawnPickup(id, pos, mag, res) {
  const gi = buildGun(id), g = gi.group;
  g.rotation.set(0, R() * TAU, PI / 2); g.position.set(pos.x, Hf(pos.x, pos.z) + .06, pos.z);
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

// ---------- animazione dell'arma in prima persona ----------
let swayX = 0, swayY = 0;
const _lh = new V3(), _ea = new V3();
// inerzia dell'arma: la volata anticipa la rotazione della visuale e poi si assesta con una molla
const GL = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
function updateGunLead(dt) {
  const d = Math.min(dt, .033);
  GL.tx = lerp(GL.tx, 0, Math.min(1, d * 9)); GL.ty = lerp(GL.ty, 0, Math.min(1, d * 9));
  GL.vx += ((GL.tx - GL.x) * 210 - GL.vx * 17) * d; GL.vy += ((GL.ty - GL.y) * 210 - GL.vy * 17) * d;
  GL.x += GL.vx * d; GL.y += GL.vy * d;
}
const T6 = new V3(), T7 = new V3(), T8 = new V3(), _crInv = new THREE.Matrix4();
function updateViewmodel(dt) {
  const s = P.slot();
  setViewmodel(P.carry || P.dead || !s || P.mode !== 'foot' ? null : s.id);
  if (!vmCur) { $('scope').style.display = 'none'; return; }
  const w = WEAPONS[s.id], g = vmCur.group, k = P.adsK;
  const base = T1.copy(vmCur.hip).lerp(vmCur.ads, k);
  const bob = P.bobPh, bm = P.moveK * (1 - k * .85), br = Math.sin(GAME.time * 1.4) * .0025 * (1 - k * .6);
  let x = base.x + Math.cos(bob * .5) * .013 * bm + swayX, y = base.y - Math.abs(Math.sin(bob * .5)) * .016 * bm + swayY + br, z = base.z;
  let rx = 0, ry = 0, rz = Math.cos(bob * .5) * .02 * bm;
  // oscillazione in stile Battlefield: respiro a otto, inclinazione nelle virate e negli spostamenti laterali
  updateGunLead(dt);
  const am = 1 - k * .92, tt = GAME.time, fat = 1 + (1 - P.stamina) * 1.5;
  x += Math.sin(tt * .9) * .0042 * am * fat; y += Math.sin(tt * 1.8) * .0026 * am * fat;
  ry += Math.sin(tt * .9 + .6) * .006 * am * fat; rx += Math.sin(tt * 1.8 + .3) * .004 * am * fat;
  ry += GL.x * (1 - k); rx += GL.y * (1 - k); rz += GL.x * .55 * am;
  x += GL.x * .05 * am; y += GL.y * .03 * am;
  const vr = P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw);
  rz -= vr * .014 * am; x -= vr * .0025 * am;
  y += clamp(P.vy, -6, 6) * -.004 * am;
  swayX = lerp(swayX, 0, dt * 8); swayY = lerp(swayY, 0, dt * 8);
  z += P.recoil * (k > .5 ? .035 : .06); rx += P.recoil * (k > .5 ? .03 : .09);
  P.recoil = Math.max(0, P.recoil - dt * 9);
  const sk = P.sprintK || 0; x += .05 * sk; y -= .05 * sk; ry += .55 * sk; rz += .25 * sk; rx -= .1 * sk;
  if (P.swim || P.throwT > 0) { y -= .35; rx -= .6; }
  if (!P.grounded) { y += .02; rx += .05; }
  if (P.meleeT > 0) { const m = Math.sin((1 - P.meleeT / .75) * PI); z -= m * .25; rx += m * .4; ry -= m * .3; x -= m * .08; }
  _lh.copy(vmCur.lbase);
  if (vmCur.mag) { vmCur.mag.position.copy(vmCur.magBase); vmCur.mag.visible = !(w.rocket && s.mag === 0) && !(s.id === 'garand' && s.mag === 0); }
  if (P.reloadT > 0) {
    const t = 1 - P.reloadT / P.reloadDur, tilt = Math.sin(clamp(t, 0, 1) * PI);
    rz += tilt * .55; rx += tilt * .22; y -= tilt * .06; x -= tilt * .03;
    if (w.bolt) {
      const bt = clamp((t - .05) / .2, 0, 1) * (1 - clamp((t - .85) / .12, 0, 1));
      if (vmCur.bolt) { vmCur.bolt.position.z = .03 + bt * .08; vmCur.bolt.rotation.z = bt * .9; }
      _lh.lerp(T2.copy(vmCur.magBase).add(T3.set(0, .1, .05)), clamp((t - .15) / .1, 0, 1) * (1 - clamp((t - .8) / .1, 0, 1)));
      if (t > .25 && t < .8) _lh.y += Math.sin(t * 30) * .01;
    } else if (vmCur.mag && vmCur.magBase) {
      const out = clamp((t - .18) / .17, 0, 1), inn = clamp((t - .5) / .2, 0, 1), back = clamp((t - .8) / .15, 0, 1);
      const off = T2.copy(vmCur.magOut);
      if (t < .5) { vmCur.mag.position.copy(vmCur.magBase).addScaledVector(off, out); vmCur.mag.visible = t < .4; _lh.lerp(T3.copy(vmCur.magBase).addScaledVector(off, out), clamp(t / .18, 0, 1)); }
      else { vmCur.mag.visible = true; vmCur.mag.position.copy(vmCur.magBase).addScaledVector(off, 1 - inn); _lh.copy(vmCur.lbase).lerp(T3.copy(vmCur.magBase).addScaledVector(off, 1 - inn), 1 - back); }
      if (vmCur.charge && t > .8) _lh.lerp(vmCur.charge, Math.sin(clamp((t - .8) / .18, 0, 1) * PI) * (1 - back * .5));
    }
  }
  if (P.boltT > 0 && vmCur.bolt) {
    P.boltT = Math.max(0, P.boltT - dt / (w.rate * .9));
    const e = Math.sin((1 - P.boltT) * PI);
    vmCur.bolt.position.z = .03 + e * .08; vmCur.bolt.rotation.z = e * .9; rz += e * .1;
  } else if (vmCur.bolt && P.reloadT <= 0) { vmCur.bolt.position.z = .03; vmCur.bolt.rotation.z = 0; }
  if (vmCur.slide) vmCur.slide.position.z = P.recoil * .03 + (s.mag === 0 ? .03 : 0);
  if (P.switchT > 0) { y -= P.switchT * .5; rx -= P.switchT * 1.2; }
  // strisciata: arma ruotata sul fianco, la mano sinistra si allunga, si pianta a terra e tira
  const ck = P.crawlK || 0, elb = T6.copy(vmCur.elbowL);
  if (ck > .01) {
    x += .1 * ck; y -= .09 * ck; z += .06 * ck; ry += .7 * ck; rz += .75 * ck; rx -= .12 * ck;
    const ph = P.crawlPh || 0, hc = T7;
    if (ph < .35) { const t = smooth(ph / .35); hc.set(lerp(-.17, -.24, t), lerp(-.33, -.26, t) + Math.sin(t * PI) * .09, lerp(-.36, -.82, t)); }
    else { const t = smooth((ph - .35) / .65); hc.set(lerp(-.24, -.17, t), lerp(-.26, -.33, t), lerp(-.82, -.36, t)); }
    g.position.set(x, y, z); g.rotation.set(rx, ry, rz); g.updateMatrix(); _crInv.copy(g.matrix).invert();
    const hl = T8.copy(hc).applyMatrix4(_crInv);
    _lh.lerp(hl, ck);
    const eCam = T8.copy(hc).add(T3.set(-.14, -.06, .32)); eCam.z = Math.max(eCam.z, -.25);
    elb.lerp(eCam.applyMatrix4(_crInv), ck);
  }
  vmCur.lhand.position.copy(_lh);
  if (ck > .01) vmCur.lhand.rotation.set(-1.2 * ck, 0, .4 * ck); else vmCur.lhand.rotation.set(0, 0, 0);
  _ea.copy(_lh).add(T3.set(-.02, -.04, .03));
  const la = vmCur.larm, dv = T5.subVectors(elb, _ea);
  la.position.copy(_ea).addScaledVector(dv, .5); la.quaternion.setFromUnitVectors(T4.set(0, 1, 0), dv.clone().normalize()); la.scale.set(1, dv.length(), 1);
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
