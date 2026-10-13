"use strict";
// ============================================================
//  Folla: scheletri dei soldati, geometrie dettagliate (2 LOD),
//  rendering in istanze GPU, cinematica inversa delle braccia
// ============================================================
const CROWD = { meshes: {}, frustum: new THREE.Frustum(), pm: new THREE.Matrix4(), frame: 0 };
const BODIES = [];
const DOWN = new V3(0, -1, 0);
const SCOL2 = {
  A: { jacket: 0x5f5c40, jacket2: 0x504d34, pants: 0x535038, web: 0x9a9068, pack: 0x77714f, helm: 0x4b5034, net: 0x3c4029, skin: 0xb88a6a, legging: 0xa29775, boot: 0x4a3524, belt2: 0x6b6e5a, metal: 0x2a2a2a, wood: 0x6b4423 },
  E: { jacket: 0x545b54, jacket2: 0x474d48, pants: 0x4b514c, web: 0x23201c, pack: 0x6b6551, helm: 0x4f5650, net: 0x474d48, skin: 0xc9a083, legging: 0x1d1b19, boot: 0x1d1b19, belt2: 0x58625a, metal: 0x252525, wood: 0x5a3a20 },
};
const ARM_A = .29, ARM_B = .27;
const SH_L = new V3(-.2, .44, 0), SH_R = new V3(.2, .44, 0);
const POLE_L = new V3(-.5, -1, .35).normalize(), POLE_R = new V3(.6, -1, .3).normalize();
const qE = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const WFORE = { rifle: new V3(0, .02, -.36), sniper: new V3(0, .02, -.36), smg: new V3(0, -.04, -.2), bar: new V3(0, .0, -.36), mg: new V3(-.02, .02, -.32) };
const WPOSES = {
  aim: { p: new V3(.12, .43, -.25), q: qE(0, .05, 0) },
  ready: { p: new V3(.07, .3, -.2), q: qE(-.55, .6, .3) },
  hip: { p: new V3(.13, .24, -.26), q: qE(-.06, 0, 0) },
  boat: { p: new V3(.05, .25, -.15), q: qE(-1.1, .2, 0) },
};

// ---------- geometrie ----------
const lath = (pts, seg) => new THREE.LatheGeometry(pts.slice().reverse().map(p => new THREE.Vector2(p[0], p[1])), seg);
const cylG = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg);
// sezioni ellittiche morbide: [y, semilarghezza, semiprofondità, spostamento z]
function organic(rings, n) {
  const secs = rings.map(([y, rx, rz, zo = 0]) => { const ring = []; for (let j = 0; j < n; j++) { const a = j / n * TAU, c = Math.cos(a), sn = Math.sin(a); ring.push(new V3(Math.sign(c) * Math.pow(Math.abs(c), .8) * rx, y, zo + Math.sign(sn) * Math.pow(Math.abs(sn), .8) * rz)); } return ring; });
  return loftGeo(secs, null, true);
}
function buildPartGeo(key, hi) {
  const [team, part, kind] = key.split('_'), C = SCOL2[team], s = hi ? 14 : 6, mb = new MB(), A = team === 'A';
  const add = (g, c, x, y, z, rx, ry, rz, sx, sy, sz) => mb.add(g, c, x, y, z, rx || 0, ry || 0, rz || 0, sx ?? 1, sy ?? 1, sz ?? 1);
  if (part === 'pelvis') {
    add(cylG(.165, .15, .24, s), C.pants, 0, .02, 0, 0, 0, 0, 1, 1, .7);
    add(U.sph, C.pants, 0, -.07, 0, 0, 0, 0, .15, .08, .1);
    add(cylG(.172, .172, .055, s), C.web, 0, .12, 0, 0, 0, 0, 1, 1, .72);
    if (hi) {
      if (A) { for (let i = 0; i < 9; i++) { const a = -1.2 + i * .3; add(U.box, C.web, Math.sin(a) * .17, .1, -Math.cos(a) * .12, 0, -a, 0, .055, .07, .035); } add(cylG(.05, .05, .16, 10), C.belt2, .13, .02, .12); add(U.box, C.pack, -.12, -.02, .13, 0, 0, 0, .1, .18, .03); }
      else { for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(U.box, C.web, sx * (.04 + i * .045), .1, -.125, 0, 0, 0, .04, .07, .04); add(U.box, 0x777777, 0, .12, -.122, 0, 0, 0, .045, .04, .01); add(U.box, C.pack, .14, .0, .07, 0, -.4, 0, .16, .15, .06); add(cylG(.05, .05, .15, 10), C.belt2, .16, -.02, .12); add(U.box, C.wood, -.15, .04, .06, .2, 0, 0, .025, .22, .03); }
    }
  } else if (part === 'chest') {
    add(organic([[-.02, .155, .1, 0], [.08, .16, .105, 0], [.2, .17, .115, -.008], [.32, .19, .125, -.012], [.42, .2, .115, 0], [.48, .17, .095, .01], [.52, .08, .07, .01]], hi ? 18 : 8), C.jacket);
    if (hi) {
      add(new THREE.TorusGeometry(.068, .016, 5, 14), C.jacket2, 0, .515, .005, PI / 2, 0, 0, 1, 1, 1);         // colletto
      for (let k = 0; k < 4; k++) add(U.sph, 0x2a2a22, 0, .44 - k * .1, -.122 + k * .004, 0, 0, 0, .009, .009, .005); // bottoni
      for (const sx of [-1, 1]) add(U.box, C.jacket2, sx * .095, .43, -.118, -.12, 0, 0, .09, .022, .02); // patte dei taschini
      for (let k = 0; k < 3; k++) add(new THREE.TorusGeometry(.17, .006, 3, 16), C.jacket2, 0, .14 + k * .07, -.004, PI / 2, 0, 0, 1, .66, 1); // pieghe
    }
    for (const sx of [-1, 1]) add(U.sph, C.jacket, sx * .19, .44, 0, 0, 0, 0, .075, .07, .075);
    add(cylG(.07, .075, .06, s), C.jacket2, 0, .51, 0);
    add(cylG(.055, .06, .1, s), C.skin, 0, .54, 0);
    if (A) {
      add(U.box, C.pack, 0, .32, .16, 0, 0, 0, .3, .32, .13);
      add(cylG(.06, .06, .34, s), C.belt2, 0, .5, .17, 0, 0, PI / 2);
      for (const sx of [-1, 1]) add(U.box, C.web, sx * .1, .3, 0, 0, 0, 0, .04, .44, .27);
      if (hi) {
        for (const sx of [-1, 1]) add(U.box, C.jacket2, sx * .08, .35, -.12, 0, 0, 0, .08, .09, .02);
        add(new THREE.TorusGeometry(.19, .032, 6, 18), C.belt2, 0, .08, 0, PI / 2, 0, 0, 1, .66, 1);
        add(U.box, C.pack, -.07, .2, -.135, 0, 0, 0, .15, .12, .06);
        add(U.box, C.wood, 0, .22, .245, 0, 0, 0, .03, .22, .02); add(U.box, C.metal, 0, .1, .24, 0, 0, 0, .1, .1, .015);
      }
      if (kind === 'medic') { add(U.box, 0xe5e2d8, -.2, .38, 0, 0, 0, 0, .02, .07, .13); add(U.box, 0xa01010, -.212, .38, 0, 0, 0, 0, .006, .05, .015); add(U.box, 0xa01010, -.212, .38, 0, 0, 0, 0, .006, .015, .05); }
    } else {
      for (const sx of [-1, 1]) add(U.box, C.web, sx * .09, .3, 0, 0, 0, sx * .12, .035, .48, .27);
      add(cylG(.06, .06, .27, s), C.belt2, .02, .24, .16, .1, 0, 0);
      if (hi) {
        for (const sx of [-1, 1]) { add(U.box, C.jacket2, sx * .09, .36, -.12, 0, 0, 0, .085, .1, .02); add(U.box, C.jacket2, sx * .1, .12, -.115, 0, 0, 0, .09, .1, .02); }
        for (let k = 0; k < 6; k++) add(new THREE.TorusGeometry(.061, .006, 4, 10), C.belt2, .02, .12 + k * .045, .16, PI / 2 + .1, 0, 0);
        add(U.box, C.pack, -.08, .28, .15, 0, 0, 0, .14, .1, .06); add(U.box, 0x6b6146, 0, .48, -.06, 0, 0, 0, .1, .02, .02);
      }
    }
  } else if (part === 'head') {
    add(organic([[-.02, .045, .05, .0], [.02, .06, .07, -.01], [.045, .072, .085, -.012], [.09, .088, .1, -.004], [.14, .095, .106, .004], [.19, .088, .1, .008], [.225, .06, .07, .008], [.24, .02, .025, .008]], hi ? 16 : 7), C.skin);
    add(U.box, C.skin, 0, .112, -.103, -.25, 0, 0, .022, .05, .03);
    if (hi) { add(U.box, C.skin, 0, .086, -.104, 0, 0, 0, .03, .01, .02); add(U.sph, 0x8a6a56, 0, .03, -.06, 0, 0, 0, .055, .03, .04); for (const sx of [-1, 1]) add(U.sph, C.skin, sx * .052, .1, -.075, 0, 0, 0, .025, .018, .02); }
    if (hi) { for (const sx of [-1, 1]) { add(U.sph, C.skin, sx * .097, .12, .005, 0, 0, 0, .014, .03, .022); add(U.sph, 0x2a2018, sx * .034, .14, -.09, 0, 0, 0, .012, .009, .008); add(U.box, 0x4a3828, sx * .035, .162, -.093, 0, 0, sx * .1, .03, .007, .01); } add(U.box, 0x7a4a40, 0, .074, -.098, 0, 0, 0, .035, .007, .01); }
  } else if (part === 'helmet') {
    const ls = hi ? 18 : 8;
    if (A) {
      add(lath([[0, .118], [.06, .112], [.112, .09], [.14, .052], [.153, .0], [.157, -.028], [.172, -.034], [.176, -.042], [.15, -.042]], ls), C.helm, 0, 0, 0);
      if (hi) { for (let k = 0; k < 6; k++) add(U.box, C.net, 0, .07, 0, 0, k * PI / 6, 0, .31, .004, .006); for (const sx of [-1, 1]) add(U.box, 0x5a5236, sx * .15, -.08, .0, 0, 0, sx * .15, .012, .09, .018); }
      if (kind === 'medic') for (let k = 0; k < 4; k++) { const a = k * PI / 2, x = Math.sin(a) * .148, z = Math.cos(a) * .148; add(U.cyl, 0xe5e2d8, x, .04, z, PI / 2, a, 0, .045, .006, .045); add(U.box, 0xa01010, x * 1.03, .04, z * 1.03, 0, a, 0, .055, .016, .004); add(U.box, 0xa01010, x * 1.03, .04, z * 1.03, 0, a, 0, .016, .055, .004); }
    } else {
      add(lath([[0, .118], [.07, .11], [.12, .085], [.145, .045], [.15, .0], [.152, -.03], [.166, -.052], [.178, -.077], [.182, -.082], [.16, -.082]], ls), C.helm, 0, 0, .01);
      if (hi) add(U.cyl, 0x333333, .14, .03, 0, 0, 0, PI / 2, .008, .01, .008);
    }
  } else if (part === 'uarm') {
    add(organic([[0, .062, .06], [-.08, .064, .058], [-.2, .052, .05], [-.29, .047, .046]], hi ? 10 : 6), C.jacket);
    if (hi) for (let k = 0; k < 2; k++) add(new THREE.TorusGeometry(.055, .005, 3, 10), C.jacket2, 0, -.18 - k * .05, 0, PI / 2 + .3, 0, 0);
    add(U.sph, C.jacket, 0, -.29, 0, 0, 0, 0, .05, .05, .05);
  } else if (part === 'farm') {
    add(organic([[0, .05, .048], [-.08, .05, .046], [-.18, .042, .038], [-.24, .04, .034]], hi ? 10 : 6), C.jacket);
    add(cylG(.046, .046, .03, s), C.jacket2, 0, -.235, 0);
    add(organic([[-.255, .03, .016], [-.29, .038, .02], [-.32, .036, .017]], hi ? 8 : 5), C.skin);
    if (hi) { for (let k = 0; k < 4; k++) add(cylG(.0085, .0075, .07, 5), C.skin, -.024 + k * .016, -.35, -.008, .35, 0, 0); add(cylG(.009, .008, .06, 5), C.skin, .036, -.29, -.022, .3, 0, .7); }
    else add(U.box, C.skin, 0, -.34, -.01, .4, 0, 0, .06, .05, .025);
  } else if (part === 'thigh') {
    add(organic([[.02, .09, .09, .005], [-.1, .088, .085, -.008], [-.25, .074, .072, -.006], [-.4, .062, .064, 0], [-.45, .06, .062, 0]], hi ? 12 : 6), C.pants);
    if (hi) { add(U.box, C.jacket2, .085, -.2, 0, 0, 0, 0, .02, .13, .1); for (let k = 0; k < 2; k++) add(new THREE.TorusGeometry(.068, .005, 3, 10), C.jacket2, 0, -.36 - k * .04, 0, PI / 2 - .25, 0, 0); }
    if (hi && A) add(U.box, C.jacket2, 0, -.2, -.07, 0, 0, 0, .1, .12, .02);
    add(U.sph, C.pants, 0, -.45, 0, 0, 0, 0, .065, .06, .065);
  } else if (part === 'shin') {
    if (A) { add(cylG(.062, .05, .26, s), C.pants, 0, -.13, 0); add(cylG(.067, .058, .2, s), C.legging, 0, -.3, 0); if (hi) for (let k = 0; k < 4; k++) add(U.box, 0x5a5236, .066, -.22 - k * .045, 0, 0, 0, 0, .006, .01, .03); }
    else add(cylG(.066, .061, .38, s), C.boot, 0, -.24, 0);
    add(U.box, C.boot, 0, -.42, -.045, 0, 0, 0, .1, .085, .26);
    add(cylG(.05, .05, .1, s), C.boot, 0, -.42, -.17, PI / 2, 0, 0, 1, 1, .9);
    add(U.box, 0x1a1410, 0, -.462, -.05, 0, 0, 0, .105, .02, .28);
  } else if (part === 'w') {
    const W = C.wood, M = C.metal, cs = hi ? 10 : 5;
    if (kind === 'rifle' || kind === 'sniper') {
      add(U.box, W, 0, -.035, .2, -.12, 0, 0, .045, .1, .28); add(U.box, W, 0, -.01, .02, 0, 0, 0, .04, .06, .12);
      add(U.box, W, 0, .0, -.27, 0, 0, 0, .045, .05, .46); add(U.box, M, 0, .032, -.05, 0, 0, 0, .034, .04, .18);
      add(cylG(.011, .011, .6, cs), M, 0, .03, -.6, PI / 2);
      if (hi) { add(U.box, M, 0, -.045, .005, 0, 0, 0, .008, .03, .06); add(U.box, M, 0, .055, -.88, 0, 0, 0, .006, .02, .01); if (A) add(cylG(.012, .012, .1, cs), M, 0, .012, -.78, PI / 2); else { add(cylG(.007, .007, .06, cs), M, .03, .035, -.02, 0, 0, PI / 2); add(U.sph, M, .06, .03, -.02, 0, 0, 0, .012, .012, .012); } }
      if (kind === 'sniper') { add(cylG(.016, .016, .3, cs), M, 0, .085, -.05, PI / 2); add(cylG(.022, .022, .05, cs), M, 0, .085, .12, PI / 2); }
    } else if (kind === 'smg') {
      if (A) { add(U.box, W, 0, -.02, .16, 0, 0, 0, .04, .09, .24); add(U.box, M, 0, .03, -.08, 0, 0, 0, .042, .06, .26); add(cylG(.014, .014, .24, cs), M, 0, .035, -.33, PI / 2); add(U.box, W, 0, -.05, .0, .25, 0, 0, .032, .09, .04); add(U.box, W, 0, .005, -.24, 0, 0, 0, .04, .04, .13); add(U.box, M, 0, -.075, -.1, 0, 0, 0, .028, .17, .05); }
      else { add(cylG(.02, .02, .3, cs), M, 0, .03, -.1, PI / 2); add(cylG(.01, .01, .16, cs), M, 0, .03, -.33, PI / 2); add(U.box, M, 0, -.09, -.17, 0, 0, 0, .022, .2, .035); add(U.box, 0x2c1a10, 0, -.04, .03, .2, 0, 0, .03, .09, .04); for (const sx of [-1, 1]) add(U.box, M, sx * .012, 0, .16, 0, 0, 0, .006, .012, .25); }
    } else if (kind === 'bar') {
      add(U.box, W, 0, -.025, .22, -.1, 0, 0, .045, .1, .32); add(U.box, M, 0, .025, -.08, 0, 0, 0, .05, .07, .42); add(cylG(.014, .014, .55, cs), M, 0, .04, -.58, PI / 2);
      add(U.box, W, 0, .005, -.36, 0, 0, 0, .05, .05, .22); add(U.box, M, 0, -.045, -.12, 0, 0, 0, .035, .1, .075);
      if (hi) for (const sx of [-1, 1]) add(cylG(.005, .005, .34, 4), M, sx * .025, .015, -.64, PI / 2 + .05);
    } else if (kind === 'mg') {
      add(U.box, M, 0, .03, -.15, 0, 0, 0, .06, .09, .5); add(cylG(.03, .03, .44, cs), M, 0, .045, -.6, PI / 2); add(cylG(.012, .012, .12, cs), M, 0, .045, -.86, PI / 2);
      add(U.box, M, 0, .0, .2, -.1, 0, 0, .04, .09, .28); add(U.box, 0x2c1a10, 0, -.06, .02, .3, 0, 0, .03, .1, .04);
      add(U.box, 0xb08a3a, -.06, .02, -.12, 0, 0, .4, .12, .02, .15);
      if (hi) { for (let k = 0; k < 6; k++) add(U.cyl, 0x111111, .031, .045, -.44 - k * .06, 0, 0, PI / 2, .008, .004, .008); for (const sx of [-1, 1]) add(cylG(.006, .006, .3, 4), M, sx * .04, -.06, -.68, -.6, 0, sx * .3); }
    }
  }
  return mb.build();
}
function getMesh(key) {
  let m = CROWD.meshes[key]; if (m) return m;
  const cap = key[0] === 'A' ? Q.allySlots : Q.enemySlots;
  const mk = (hi) => {
    const im = new THREE.InstancedMesh(buildPartGeo(key, hi), MAT.soldier, cap);
    im.setColorAt(0, new THREE.Color(1, 1, 1)); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    im.count = 0; im.frustumCulled = false; im.castShadow = hi && Q.shadows > 0; im.receiveShadow = true;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im); return im;
  };
  m = CROWD.meshes[key] = { hi: Q.lod > 0 ? mk(true) : null, lo: mk(false), n: [0, 0] };
  return m;
}

// ---------- scheletro ----------
function makeBody(team, kind) {
  const N = () => new THREE.Object3D();
  const root = N(); root.rotation.order = 'YXZ';
  const hips = N(); hips.position.y = .95; root.add(hips);
  const spine = N(); spine.position.y = .1; hips.add(spine);
  const neck = N(); neck.position.y = .52; spine.add(neck);
  const helmet = N(); helmet.position.y = .12; neck.add(helmet);
  const shL = N(); shL.position.copy(SH_L); spine.add(shL); const elL = N(); elL.position.y = -ARM_A; shL.add(elL);
  const shR = N(); shR.position.copy(SH_R); spine.add(shR); const elR = N(); elR.position.y = -ARM_A; shR.add(elR);
  const gun = N(); spine.add(gun);
  const hipL = N(); hipL.position.set(-.1, -.04, 0); hips.add(hipL); const knL = N(); knL.position.y = -.45; hipL.add(knL);
  const hipR = N(); hipR.position.set(.1, -.04, 0); hips.add(hipR); const knR = N(); knR.position.y = -.45; hipR.add(knR);
  const med = kind === 'medic';
  const parts = [
    { node: hips, key: team + '_pelvis', name: 'pelvis' },
    { node: spine, key: team + '_chest' + (med ? '_medic' : ''), name: 'chest' },
    { node: neck, key: team + '_head', name: 'head' },
    { node: helmet, key: team + '_helmet' + (med ? '_medic' : ''), name: 'helmet' },
    { node: shL, key: team + '_uarm', name: 'uarmL' }, { node: elL, key: team + '_farm', name: 'farmL' },
    { node: shR, key: team + '_uarm', name: 'uarmR' }, { node: elR, key: team + '_farm', name: 'farmR' },
    { node: hipL, key: team + '_thigh', name: 'thighL' }, { node: knL, key: team + '_shin', name: 'shinL' },
    { node: hipR, key: team + '_thigh', name: 'thighR' }, { node: knR, key: team + '_shin', name: 'shinR' },
  ];
  if (!med) parts.push({ node: gun, key: team + '_w_' + kind, name: 'weapon' });
  for (const p of parts) { p.mesh = getMesh(p.key); p.hidden = false; }
  const b = { root, hips, spine, neck, helmet, shL, elL, shR, elR, gun, hipL, knL, hipR, knR, parts, kind, team, tint: new THREE.Color(rnd(.9, 1.05), rnd(.9, 1.05), rnd(.9, 1.05)), removed: false, settled: false, ikT: 0, fore: WFORE[kind] || WFORE.rifle };
  BODIES.push(b);
  return b;
}
function hidePart(b, name) { const p = b.parts.find(x => x.name === name); if (p) p.hidden = true; }

// cinematica inversa a due ossa nello spazio del busto
const _a = new V3(), _b = new V3(), _c = new V3(), _cd = new V3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _tL = new V3();
function solveArm(S, T, pole, up, fore) {
  _a.subVectors(T, S); let L = _a.length(); const dir = _a.multiplyScalar(1 / (L || 1));
  L = clamp(L, Math.abs(ARM_A - ARM_B) + .01, ARM_A + ARM_B - .005);
  const x = (ARM_A * ARM_A - ARM_B * ARM_B + L * L) / (2 * L), h = Math.sqrt(Math.max(0, ARM_A * ARM_A - x * x));
  _b.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  _c.copy(S).addScaledVector(dir, x).addScaledVector(_b, h);
  _cd.subVectors(_c, S).normalize(); up.quaternion.setFromUnitVectors(DOWN, _cd);
  _cd.subVectors(T, _c).normalize(); _q1.setFromUnitVectors(DOWN, _cd);
  _q2.copy(up.quaternion).invert(); fore.quaternion.copy(_q2.multiply(_q1));
}
// posa dell'arma interpolata e braccia agganciate
function poseWeapon(b, wAim, wHip, wBoat) {
  const g = b.gun;
  g.position.copy(WPOSES.ready.p).lerp(WPOSES.aim.p, wAim); g.quaternion.copy(WPOSES.ready.q).slerp(WPOSES.aim.q, wAim);
  if (wHip > 0) { g.position.lerp(WPOSES.hip.p, wHip); g.quaternion.slerp(WPOSES.hip.q, wHip); }
  if (wBoat > 0) { g.position.lerp(WPOSES.boat.p, wBoat); g.quaternion.slerp(WPOSES.boat.q, wBoat); }
  if (b.kind === 'medic') { solveArm(SH_R, _tL.set(.18, .12, -.12), POLE_R, b.shR, b.elR); solveArm(SH_L, _tL.set(-.18, .12, -.12), POLE_L, b.shL, b.elL); return; }
  solveArm(SH_R, g.position, POLE_R, b.shR, b.elR);
  _tL.copy(b.fore).applyQuaternion(g.quaternion).add(g.position);
  solveArm(SH_L, _tL, POLE_L, b.shL, b.elL);
}

// ---------- aggiornamento istanze ----------
const _cs = new THREE.Sphere(), _cc = new THREE.Color();
function updateCrowd() {
  CROWD.frame++;
  CROWD.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  CROWD.frustum.setFromProjectionMatrix(CROWD.pm);
  for (const k in CROWD.meshes) { const m = CROWD.meshes[k]; m.n[0] = m.n[1] = 0; }
  const cp = camera.position, lod2 = Q.lod * Q.lod;
  for (let i = BODIES.length - 1; i >= 0; i--) {
    const b = BODIES[i];
    if (b.removed) { BODIES.splice(i, 1); continue; }
    const rp = b.rag ? b.rag.p[0] : b.root.position;
    _cs.center.set(rp.x, rp.y + .9, rp.z); _cs.radius = 1.6;
    const near = Q.shadows && Math.abs(rp.x - cp.x) < Q.shadowDist * .6 && Math.abs(rp.z - cp.z) < Q.shadowDist * .6;
    if (!CROWD.frustum.intersectsSphere(_cs) && !near) continue;
    if (!b.settled) b.root.updateMatrixWorld(true);
    const dx = rp.x - cp.x, dz = rp.z - cp.z, d2 = dx * dx + dz * dz;
    const L = d2 < lod2 ? 0 : 1;
    _cc.copy(b.tint);
    for (const p of b.parts) {
      if (p.hidden) continue;
      const mm = p.mesh, im = L === 0 && mm.hi ? mm.hi : mm.lo, li = im === mm.hi ? 0 : 1, idx = mm.n[li];
      if (idx >= im.instanceMatrix.count) continue;
      im.instanceMatrix.array.set(p.node.matrixWorld.elements, idx * 16);
      const ca = im.instanceColor.array; ca[idx * 3] = _cc.r; ca[idx * 3 + 1] = _cc.g; ca[idx * 3 + 2] = _cc.b;
      mm.n[li]++;
    }
  }
  for (const k in CROWD.meshes) {
    const m = CROWD.meshes[k];
    for (const [im, li] of [[m.hi, 0], [m.lo, 1]]) { if (!im) continue; im.count = m.n[li]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
