"use strict";
// ============================================================
//  Folla: scheletri dei soldati, geometrie dettagliate (2 LOD),
//  rendering in istanze GPU, cinematica inversa delle braccia
// ============================================================
const CROWD = { meshes: {}, frustum: new THREE.Frustum(), pm: new THREE.Matrix4(), frame: 0 };
const BODIES = [];
const DOWN = new V3(0, -1, 0);
const SCOL2 = {
  A: { jacket: 0x5f5c40, jacket2: 0x504d34, pants: 0x535038, web: 0x9a9068, pack: 0x77714f, helm: 0x4b5034, net: 0x3c4029, skin: 0xa87c60, legging: 0xa29775, boot: 0x4a3524, belt2: 0x6b6e5a, metal: 0x2a2a2a, wood: 0x6b4423 },
  E: { jacket: 0x545b54, jacket2: 0x474d48, pants: 0x4b514c, web: 0x23201c, pack: 0x6b6551, helm: 0x4f5650, net: 0x474d48, skin: 0xb58f74, legging: 0x1d1b19, boot: 0x1d1b19, belt2: 0x58625a, metal: 0x252525, wood: 0x5a3a20 },
};
const ARM_A = .29, ARM_B = .27;
const SH_L = new V3(-.172, .43, 0), SH_R = new V3(.172, .43, 0);
const POLE_L = new V3(-.5, -1, .35).normalize(), POLE_R = new V3(.6, -1, .3).normalize();
const qE = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const WFORE = { rifle: new V3(0, .02, -.36), sniper: new V3(0, .02, -.36), smg: new V3(0, -.04, -.2), bar: new V3(0, .0, -.36), mg: new V3(-.02, .02, -.32) };
// posizioni dell'arma (impugnatura) nello spazio del busto; l'arma punta verso -z, il calcio sta dietro l'impugnatura
// mira: calcio nella spalla, linea di mira all'altezza dell'occhio
// pronto basso: calcio sotto l'ascella, volata in avanti e in basso (marcia e attesa)
// arma diagonale sul petto ("port arms"): volata in alto a sinistra, per correre
const WPOSES = {
  aim: { p: new V3(.105, .47, -.3), q: qE(.015, .045, 0) },
  ready: { p: new V3(.115, .29, -.27), q: qE(-.42, .12, .04) },
  port: { p: new V3(.08, .2, -.21), q: qE(.78, .55, .3) },
  hip: { p: new V3(.13, .24, -.26), q: qE(-.06, 0, 0) },
  boat: { p: new V3(.05, .25, -.15), q: qE(-1.1, .2, 0) },
};

// ---------- testa scansionata (Lee Perry-Smith, Infinite Realities, CC BY 3.0) ----------
const HEAD_GEO = {}, FACE_MAT = {};
const _b64 = (s, T) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
// forma del volto: 8 varianti anatomiche della scansione (naso, mascella, mento, zigomi, labbra, orecchie, lunghezza)
function headScanGeo(v = 0) {
  if (HEAD_GEO[v] || typeof HEAD_SCAN === 'undefined') return HEAD_GEO[v];
  const g = new THREE.BufferGeometry(), pv = HEAD_SCAN.pv && HEAD_SCAN.pv[v];
  g.setAttribute('position', new THREE.BufferAttribute(_b64(pv || HEAD_SCAN.p, Float32Array), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(_b64(HEAD_SCAN.uv, Float32Array), 2));
  g.setIndex(new THREE.BufferAttribute(_b64(HEAD_SCAN.i, Uint16Array), 1)); g.computeVertexNormals();
  return HEAD_GEO[v] = g;
}
// pelle: 0 rasato, 1 barba di qualche giorno, 2 barba e baffi
function faceMaterial(t = 0) {
  if (FACE_MAT[t]) return FACE_MAT[t];
  const L = new THREE.TextureLoader(), map = L.load((HEAD_SCAN.cols || [])[t] || HEAD_SCAN.col), nm = FACE_MAT.nm || (FACE_MAT.nm = L.load(HEAD_SCAN.nrm));
  map.encoding = THREE.sRGBEncoding; map.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map, normalMap: nm, roughness: .62, metalness: 0 }); m.normalScale.set(.9, .9);
  return FACE_MAT[t] = m;
}
const useScanHead = key => /_head(_\d+_\d+)?$/.test(key) && typeof HEAD_SCAN !== 'undefined';
const scanParts = key => { const m = key.match(/_head_(\d+)_(\d+)$/); return m ? [+m[1], +m[2]] : [0, 0]; };
function pickFace(team) { const r = R(); return [Math.floor(R() * ((HEAD_SCAN && HEAD_SCAN.pv) ? HEAD_SCAN.pv.length : 1)), r < (team === 'A' ? .5 : .62) ? 0 : r < .92 ? 1 : 2]; }

// ---------- geometrie ----------
const lath = (pts, seg) => new THREE.LatheGeometry(pts.slice().reverse().map(p => new THREE.Vector2(p[0], p[1])), seg);
const cylG = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg);
// sezioni ellittiche morbide: [y, semilarghezza, semiprofondità, spostamento z]
function organic(rings, n) {
  const secs = rings.map(([y, rx, rz, zo = 0]) => { const ring = []; for (let j = 0; j < n; j++) { const a = j / n * TAU, c = Math.cos(a), sn = Math.sin(a); ring.push(new V3(Math.sign(c) * Math.pow(Math.abs(c), .8) * rx, y, zo + Math.sign(sn) * Math.pow(Math.abs(sn), .8) * rz)); } return ring; });
  return loftGeo(secs, null, true);
}
// rings: [y, semilarghezza, raggio davanti, raggio dietro, spostamento x, spostamento z]
// fold: ampiezza delle pieghe del tessuto; shade: ombreggiatura verso le estremità
function sculpt(rings, n, hex, o = {}) {
  const base = col(hex), fold = o.fold || 0, seed = o.seed || 1, m = rings.length;
  const secs = rings.map(([y, rx, rf, rb, xo = 0, zo = 0], i) => {
    const ring = [];
    for (let j = 0; j < n; j++) {
      const a = j / n * TAU, c = Math.cos(a), sn = Math.sin(a), rz = sn < 0 ? rf : rb;
      const e = o.round || .82, px = Math.sign(c) * Math.pow(Math.abs(c), e) * rx, pz = Math.sign(sn) * Math.pow(Math.abs(sn), e) * rz;
      const k = fold ? (vnoise(j * 1.7 + seed * 13, i * 2.3 + seed) - .5) * fold * (o.foldMask ? o.foldMask(i / (m - 1), a) : 1) : 0;
      const len = Math.hypot(px, pz) || 1;
      ring.push(new V3(xo + px + px / len * k, y, zo + pz + pz / len * k));
    }
    return ring;
  });
  const cf = (p, i, j) => {
    const t = i / (m - 1), a = j / n * TAU;
    let sh = 1 - (o.shadeTop || 0) * (1 - t) * 0 - (o.shadeBottom || .12) * Math.max(0, 1 - t * 4) - (o.shadeTopEnd || .06) * Math.max(0, t * 4 - 3);
    if (fold) sh *= .9 + (vnoise(j * 1.7 + seed * 13, i * 2.3 + seed)) * .2;
    if (o.under) sh *= 1 - o.under * Math.max(0, -Math.cos(a - (o.underA || 0)));
    return new THREE.Color(base.r * sh, base.g * sh, base.b * sh);
  };
  return loftGeo(secs, cf, true, o.uvs || 1);
}
// arto lungo l'asse z (piedi, scarpe): ruota le sezioni costruite lungo y
const alongZ = (rings, n, hex, o) => { const g = sculpt(rings, n, hex, o); g.rotateX(-PI / 2); return g; };
function buildPartGeo(key, hi, gear) {
  const [team, part, kind] = key.split('_'), C = SCOL2[team], s = hi ? 14 : 7, mb = new MB(), A = team === 'A';
  const add = (g, c, x, y, z, rx, ry, rz, sx, sy, sz) => mb.add(g, c, x, y, z, rx || 0, ry || 0, rz || 0, sx ?? 1, sy ?? 1, sz ?? 1);
  const G = (g) => mb.addG(g, 0, 0, 0, 0, 0, 0, 1, 0xffffff), B = g => { if (!gear) G(g); };
  if (part === 'pelvis') {
    // calzoni: bacino con glutei, cavallo e cintura
    B(sculpt([[-.13, .1, .07, .08], [-.09, .145, .09, .11], [-.02, .16, .095, .12], [.06, .162, .095, .11], [.13, .158, .09, .1]], hi ? 18 : 8, C.pants, { fold: hi ? .012 : 0, seed: 2, shadeBottom: .25 }));
    for (const sx of [-1, 1]) B(sculpt([[-.16, .055, .06, .065, sx * .085], [-.11, .075, .075, .08, sx * .08], [-.06, .08, .08, .085, sx * .07]], hi ? 12 : 6, C.pants, { shadeBottom: .2 }));
    G(sculpt([[.1, .168, .1, .118], [.15, .168, .1, .118]], hi ? 18 : 8, C.web, { shadeBottom: 0 }));
    if (hi) {
      if (A) { add(new THREE.TorusGeometry(.19, .035, 6, 16), 0x5a5e44, 0, .02, 0, PI / 2, 0, 0, 1, .7, 1); add(U.box, 0x4a4e38, .17, -.02, 0, 0, 0, 0, .05, .1, .08); for (let i = 0; i < 9; i++) { const a = -1.2 + i * .3; add(U.box, C.web, Math.sin(a) * .17, .1, -Math.cos(a) * .12, 0, -a, 0, .055, .07, .035); } add(cylG(.05, .05, .16, 10), C.belt2, .13, .02, .12); add(U.box, C.pack, -.12, -.02, .13, 0, 0, 0, .1, .18, .03); }
      else { for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) add(U.box, C.web, sx * (.04 + i * .045), .1, -.125, 0, 0, 0, .04, .07, .04); add(U.box, 0x777777, 0, .12, -.122, 0, 0, 0, .045, .04, .01); add(U.box, C.pack, .14, .0, .07, 0, -.4, 0, .16, .15, .06); add(cylG(.05, .05, .15, 10), C.belt2, .16, -.02, .12); add(U.box, C.wood, -.15, .04, .06, .2, 0, 0, .025, .22, .03); }
    }
  } else if (part === 'chest') {
    // giacca: vita, torace con pettorali e scapole, spalle spioventi, colletto, collo
    B(sculpt([[-.06, .17, .105, .125], [.02, .158, .1, .115], [.12, .155, .105, .112], [.22, .168, .118, .118], [.32, .162, .122, .12], [.4, .158, .112, .112], [.46, .135, .095, .098], [.5, .12, .075, .08], [.53, .075, .06, .065]], hi ? 18 : 8, C.jacket, { fold: hi ? .014 : 0, seed: 3, shadeBottom: .18, foldMask: (t) => t < .7 ? 1 : .3, under: .12, underA: 0 }));
    if (hi) {
      G(sculpt([[.5, .085, .07, .07, 0, .005], [.545, .082, .068, .07, 0, .005]], 14, C.jacket2, { fold: .006 }));
      for (let k = 0; k < 4; k++) add(U.sph, 0x2a2a22, 0, .44 - k * .1, -.124 + k * .006, 0, 0, 0, .009, .009, .005);
      for (const sx of [-1, 1]) { add(U.box, C.jacket2, sx * .095, .41, -.122, -.14, 0, 0, .095, .025, .02); add(U.box, C.jacket2, sx * .095, .37, -.118, -.05, 0, 0, .09, .07, .012); }
      for (const sx of [-1, 1]) add(U.box, C.jacket2, sx * .17, .47, -.01, 0, 0, sx * -.35, .06, .015, .1);
    }
    B(sculpt([[.52, .052, .05, .055], [.6, .048, .045, .05]], hi ? 12 : 6, C.skin, { shadeBottom: .3 }));
    if (A) {
      G(sculpt([[.16, .1, .03, .05, 0, .16], [.22, .13, .04, .07, 0, .165], [.38, .135, .04, .075, 0, .165], [.46, .11, .03, .05, 0, .16]], hi ? 12 : 6, C.pack, { fold: hi ? .008 : 0, seed: 21, shadeBottom: .2 }));
      for (const sx of [-1, 1]) add(U.box, C.web, sx * .08, .3, .232, 0, 0, 0, .03, .26, .01);
      add(cylG(.06, .06, .34, s), C.belt2, 0, .5, .17, 0, 0, PI / 2);
      for (const sx of [-1, 1]) { add(U.box, C.web, sx * .088, .28, -.124, -.06, 0, 0, .036, .4, .01); add(U.box, C.web, sx * .1, .468, -.01, 0, 0, sx * -.3, .036, .01, .22); }
      if (hi) {
        for (const sx of [-1, 1]) add(U.box, C.jacket2, sx * .08, .35, -.12, 0, 0, 0, .08, .09, .02);
        add(new THREE.TorusGeometry(.19, .032, 6, 18), C.belt2, 0, .08, 0, PI / 2, 0, 0, 1, .66, 1);
        add(U.box, C.pack, -.07, .2, -.135, 0, 0, 0, .15, .12, .06);
        add(U.box, C.wood, 0, .22, .245, 0, 0, 0, .03, .22, .02); add(U.box, C.metal, 0, .1, .24, 0, 0, 0, .1, .1, .015);
        G(sculpt([[.2, .075, .04, .01, 0, -.14], [.24, .088, .05, .012, 0, -.142], [.32, .088, .05, .012, 0, -.142], [.35, .07, .035, .01, 0, -.14]], 10, 0x4e4a36, { fold: .006, seed: 23, shadeBottom: .25 }));
        add(U.box, 0x3e3a2a, 0, .34, -.188, .2, 0, 0, .17, .03, .05);
      }
      if (kind === 'medic') { add(U.box, 0xe5e2d8, -.2, .38, 0, 0, 0, 0, .02, .07, .13); add(U.box, 0xa01010, -.212, .38, 0, 0, 0, 0, .006, .05, .015); add(U.box, 0xa01010, -.212, .38, 0, 0, 0, 0, .006, .015, .05); }
    } else {
      for (const sx of [-1, 1]) { add(U.box, C.web, sx * .085, .28, -.124, -.06, 0, sx * .12, .03, .42, .01); add(U.box, C.web, sx * .1, .468, -.01, 0, 0, sx * -.3, .03, .01, .22); add(U.box, C.web, sx * .04, .32, .125, .06, 0, sx * -.25, .03, .36, .01); }
      add(cylG(.06, .06, .27, s), C.belt2, .02, .24, .16, .1, 0, 0);
      if (hi) {
        for (const sx of [-1, 1]) { add(U.box, C.jacket2, sx * .09, .36, -.12, 0, 0, 0, .085, .1, .02); add(U.box, C.jacket2, sx * .1, .12, -.115, 0, 0, 0, .09, .1, .02); }
        for (let k = 0; k < 6; k++) add(new THREE.TorusGeometry(.061, .006, 4, 10), C.belt2, .02, .12 + k * .045, .16, PI / 2 + .1, 0, 0);
        add(U.box, C.pack, -.08, .28, .15, 0, 0, 0, .14, .1, .06); add(U.box, 0x6b6146, 0, .48, -.06, 0, 0, 0, .1, .02, .02);
        for (const sx of [-1, 1]) add(U.box, 0x54503c, sx * .19, .43, 0, 0, 0, 0, .05, .02, .12);
        add(U.box, 0x5a5034, .17, .02, .1, 0, -.3, 0, .18, .2, .1);
        add(U.cyl12, 0x2e2c28, .14, -.02, -.12, .25, 0, .15, .015, .32, .015); add(U.cyl12, 0x3a3630, .14, .16, -.12, .25, 0, .15, .03, .07, .03);
      }
    }
  } else if (part === 'head') {
    // testa: mascella, mento, zigomi, orbite, arcate, cranio; naso, orecchie, occhi, sopracciglia, labbra, barba
    const sk = C.skin;
    G(sculpt([[-.03, .045, .045, .05, 0, .01], [.0, .05, .05, .055, 0, .008], [.03, .062, .072, .062, 0, .002], [.055, .07, .088, .07], [.085, .078, .092, .085, 0, -.002], [.115, .083, .088, .098], [.14, .084, .084, .104], [.165, .087, .092, .106], [.19, .086, .088, .104], [.215, .078, .078, .096, 0, .006], [.238, .055, .052, .07, 0, .01], [.25, .02, .02, .028, 0, .012]], hi ? 20 : 8, sk, { round: .78, shadeBottom: .22, shadeTopEnd: 0, seed: 5 }));
    if (hi) {
      add(U.box, sk, 0, .12, -.098, -.32, 0, 0, .026, .055, .034); add(U.sph, sk, 0, .097, -.104, 0, 0, 0, .018, .012, .016);
      for (const sx of [-1, 1]) {
        add(U.sph, sk, sx * .086, .135, .012, 0, 0, 0, .012, .032, .022);
        add(U.sph, 0xd8d2c8, sx * .033, .143, -.083, 0, 0, 0, .013, .008, .006); add(U.sph, 0x2a2a28, sx * .033, .143, -.088, 0, 0, 0, .006, .006, .004);
        add(U.box, 0x3a2c22, sx * .035, .162, -.09, 0, 0, sx * .08, .032, .008, .012);
        add(U.sph, sk, sx * .05, .105, -.072, 0, 0, 0, .026, .016, .02);
      }
      add(U.box, 0x7a4a40, 0, .066, -.088, 0, 0, 0, .034, .006, .01); add(U.box, 0x8a5a4c, 0, .059, -.087, 0, 0, 0, .028, .005, .01);
      add(U.sph, 0x9a7a62, 0, .04, -.062, 0, 0, 0, .05, .022, .036);
    }
  } else if (part === 'uarm') {
    // braccio: deltoide che si raccorda alla spalla, bicipite, gomito; manica con pieghe
    B(sculpt([[.055, .04, .045, .045, -.01], [.025, .058, .058, .062, -.004], [-.04, .058, .057, .058], [-.13, .054, .056, .052], [-.22, .047, .047, .045], [-.29, .045, .045, .045], [-.31, .038, .038, .038]], hi ? 12 : 6, C.jacket, { fold: hi ? .01 : 0, seed: 7, shadeBottom: .1, under: .15, underA: PI }));
  } else if (part === 'farm') {
    // avambraccio, polsino, mano con dita piegate attorno all'impugnatura
    B(sculpt([[.02, .046, .046, .046], [-.06, .046, .046, .044], [-.15, .041, .04, .037], [-.235, .038, .036, .034]], hi ? 12 : 6, C.jacket, { fold: hi ? .008 : 0, seed: 9 }));
    G(sculpt([[-.215, .045, .043, .041], [-.25, .044, .042, .04]], hi ? 12 : 6, C.jacket2, {}));
    G(sculpt([[-.245, .028, .02, .02], [-.27, .036, .022, .022], [-.3, .04, .024, .02], [-.325, .038, .02, .016]], hi ? 10 : 5, C.skin, { shadeBottom: .1 }));
    if (hi) {
      for (let k = 0; k < 4; k++) { const x = -.027 + k * .018, ln = k === 0 || k === 3 ? .028 : .034; add(cylG(.0095, .009, ln, 6), C.skin, x, -.338, -.004, .9, 0, 0); add(cylG(.009, .008, ln * .85, 6), C.skin, x, -.348, -.03, 2.2, 0, 0); }
      add(cylG(.01, .009, .045, 6), C.skin, .038, -.29, -.024, .5, 0, .9);
    } else add(U.box, C.skin, 0, -.34, -.012, .4, 0, 0, .065, .045, .03);
  } else if (part === 'thigh') {
    // coscia: gluteo, quadricipite, ginocchio; calzoni con pieghe
    B(sculpt([[.05, .075, .075, .085], [-.02, .088, .088, .095], [-.12, .084, .086, .084], [-.24, .074, .076, .07], [-.36, .064, .064, .062], [-.44, .06, .066, .058], [-.48, .052, .056, .05]], hi ? 12 : 6, C.pants, { fold: hi ? .014 : 0, seed: 11, shadeBottom: .12, under: .1, underA: PI / 2 }));
    if (hi) add(U.box, C.jacket2, gear ? .1 : .088, -.18, -.005, 0, 0, 0, .022, .13, .11);
    if (hi && A) add(U.box, C.jacket2, 0, -.2, -.075, 0, 0, 0, .1, .12, .02);
  } else if (part === 'shin') {
    // stinco e polpaccio, ghette (americani) o stivali (tedeschi), scarpone con punta e tacco
    if (A) {
      B(sculpt([[.03, .056, .058, .056], [-.06, .054, .052, .064], [-.15, .05, .048, .06], [-.22, .046, .045, .05]], hi ? 12 : 6, C.pants, { fold: hi ? .01 : 0, seed: 13 }));
      B(sculpt([[-.2, .058, .056, .062], [-.28, .054, .052, .058], [-.38, .05, .05, .052], [-.4, .052, .055, .055]], hi ? 12 : 6, C.legging, { fold: hi ? .006 : 0, seed: 14, shadeBottom: .15 }));
      if (hi && !gear) for (let k = 0; k < 4; k++) add(U.box, 0x5a5236, .058, -.24 - k * .042, -.012, 0, 0, 0, .006, .01, .024);
    } else {
      B(sculpt([[.03, .06, .062, .066], [-.08, .062, .06, .07], [-.2, .06, .058, .065], [-.33, .055, .055, .058], [-.4, .053, .055, .056]], hi ? 12 : 6, C.boot, { fold: hi ? .008 : 0, seed: 15, shadeBottom: .2 }));
      if (!gear) add(cylG(.064, .064, .03, s), 0x262420, 0, .02, 0);
    }
    G(alongZ([[-.08, .045, .05, .05], [-.04, .05, .052, .05], [.02, .052, .045, .045], [.1, .05, .04, .035], [.16, .044, .036, .03], [.19, .03, .024, .02]], hi ? 10 : 6, C.boot, { shadeBottom: 0, round: .7 }).translate(0, -.42, -.04));
    add(U.box, 0x161210, 0, -.465, -.05, 0, 0, 0, .1, .02, .29);
    add(U.box, 0x161210, 0, -.455, .055, 0, 0, 0, .09, .03, .07);
  } else if (part === 'helmet') {
    const ls = hi ? 18 : 8;
    if (A) {
      add(lath([[0, .118], [.06, .112], [.112, .09], [.14, .052], [.153, .0], [.157, -.028], [.172, -.034], [.176, -.042], [.15, -.042]], ls), C.helm, 0, 0, 0);
      if (hi) { for (let k = 0; k < 6; k++) add(U.box, C.net, 0, .07, 0, 0, k * PI / 6, 0, .31, .004, .006); for (const sx of [-1, 1]) add(U.box, 0x5a5236, sx * .122, -.09, -.012, 0, 0, sx * .28, .012, .11, .018); }
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
    const scan = hi && useScanHead(key);
    const [fv, ft] = scan ? scanParts(key) : [0, 0];
    const im = new THREE.InstancedMesh(scan ? headScanGeo(fv) : buildPartGeo(key, hi), scan ? faceMaterial(ft) : MAT.soldier, cap);
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
  // elmetto calzato sulla testa scansionata: imbottitura di ~1,5 cm sopra la calotta, tesa all'altezza delle sopracciglia,
  // centrato sul cranio (un po' indietro rispetto al collo)
  const scanH = typeof HEAD_SCAN !== 'undefined';
  const helmet = N(); helmet.position.set(0, scanH ? (team === 'A' ? .179 : .192) : team === 'A' ? .185 : .2, scanH ? .022 : 0); helmet.scale.setScalar(scanH ? .885 : .93); neck.add(helmet);
  const head = N(); head.scale.set(rnd(.95, 1.05), rnd(.96, 1.04), rnd(.95, 1.05)); neck.add(head);   // volti diversi: proporzioni variate
  const shL = N(); shL.position.copy(SH_L); spine.add(shL); const elL = N(); elL.position.y = -ARM_A; shL.add(elL);
  const shR = N(); shR.position.copy(SH_R); spine.add(shR); const elR = N(); elR.position.y = -ARM_A; shR.add(elR);
  const gun = N(); spine.add(gun);
  const hipL = N(); hipL.position.set(-.1, -.04, 0); hips.add(hipL); const knL = N(); knL.position.y = -.45; hipL.add(knL);
  const hipR = N(); hipR.position.set(.1, -.04, 0); hips.add(hipR); const knR = N(); knR.position.y = -.45; hipR.add(knR);
  const med = kind === 'medic';
  const parts = [
    { node: hips, key: team + '_pelvis', name: 'pelvis' },
    { node: spine, key: team + '_chest' + (med ? '_medic' : ''), name: 'chest' },
    { node: head, key: team + '_head' + (typeof HEAD_SCAN !== 'undefined' ? '_' + pickFace(team).join('_') : ''), name: 'head' },
    { node: helmet, key: team + '_helmet' + (med ? '_medic' : ''), name: 'helmet' },
    { node: shL, key: team + '_uarm', name: 'uarmL' }, { node: elL, key: team + '_farm', name: 'farmL' },
    { node: shR, key: team + '_uarm', name: 'uarmR' }, { node: elR, key: team + '_farm', name: 'farmR' },
    { node: hipL, key: team + '_thigh', name: 'thighL' }, { node: knL, key: team + '_shin', name: 'shinL' },
    { node: hipR, key: team + '_thigh', name: 'thighR' }, { node: knR, key: team + '_shin', name: 'shinR' },
  ];
  if (!med) parts.push({ node: gun, key: team + '_w_' + kind, name: 'weapon' });
  for (const p of parts) { p.mesh = getMesh(p.key); p.hidden = false; }
  const skinT = new THREE.Color(rnd(.86, 1.06), rnd(.8, .98), rnd(.74, .92));
  const b = { skinT, root, hips, spine, neck, head, helmet, shL, elL, shR, elR, gun, hipL, knL, hipR, knR, parts, kind, team, tint: new THREE.Color(rnd(.9, 1.05), rnd(.9, 1.05), rnd(.9, 1.05)), removed: false, settled: false, ikT: 0, fore: WFORE[kind] || WFORE.rifle };
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
function poseWeapon(b, wAim, wHip, wBoat, wPort = 0, sway = null) {
  const g = b.gun;
  g.position.copy(WPOSES.ready.p); g.quaternion.copy(WPOSES.ready.q);
  if (wPort > 0) { g.position.lerp(WPOSES.port.p, wPort); g.quaternion.slerp(WPOSES.port.q, wPort); }
  if (wAim > 0) { g.position.lerp(WPOSES.aim.p, wAim); g.quaternion.slerp(WPOSES.aim.q, wAim); }
  if (sway) g.position.add(sway);
  if (wHip > 0) { g.position.lerp(WPOSES.hip.p, wHip); g.quaternion.slerp(WPOSES.hip.q, wHip); }
  if (wBoat > 0) { g.position.lerp(WPOSES.boat.p, wBoat); g.quaternion.slerp(WPOSES.boat.q, wBoat); }
  if (b.kind === 'medic') { solveArm(SH_R, _tL.set(.18, .12, -.12), POLE_R, b.shR, b.elR); solveArm(SH_L, _tL.set(-.18, .12, -.12), POLE_L, b.shL, b.elL); return; }
  solveArm(SH_R, g.position, POLE_R, b.shR, b.elR);
  _tL.copy(b.fore).applyQuaternion(g.quaternion).add(g.position);
  solveArm(SH_L, _tL, POLE_L, b.shL, b.elL);
}

// ---------- corpo unico deformabile (soldati vicini) ----------
// ogni vertice è legato al suo osso e, vicino all'articolazione, sfuma sull'osso padre
const SKIN = { tpl: {}, pool: {}, used: {}, mat: null, max: 30, dist: 40 };
const SKIN_BONES = ['root', 'hips', 'spine', 'neck', 'helmet', 'shL', 'elL', 'shR', 'elR', 'gun', 'hipL', 'knL', 'hipR', 'knR'];
// nome parte: [osso, osso padre, verso dell'arto (+1 su, -1 giù), mezza ampiezza della sfumatura]
const SKIN_MAP = { pelvis: [1, 1, 0, 0], chest: [2, 1, 1, .09], head: [3, 2, 1, .04], helmet: [4, 4, 0, 0], uarmL: [5, 2, -1, .07], farmL: [6, 5, -1, .05], uarmR: [7, 2, -1, .07], farmR: [8, 7, -1, .05], weapon: [9, 9, 0, 0], thighL: [10, 1, -1, .08], shinL: [11, 10, -1, .06], thighR: [12, 1, -1, .08], shinR: [13, 12, -1, .06] };
const skinKey = b => b.team + '|' + b.kind;
// atlante: colonna del corpo (u 0..0.5, con un quarto ripetuto oltre la cucitura), colonna delle braccia (0.5..0.75), zona neutra per elmetto e arma
const SKIN_UA = .4, SKIN_UB = .5, SKIN_US = .2, SKIN_W = 1024, SKIN_H = 2048;
function paintSoldier(team) {
  const cv = document.createElement('canvas'); cv.width = SKIN_W; cv.height = SKIN_H;
  const g = cv.getContext('2d'), A = team === 'A';
  // trama del tessuto: grana fine e fili incrociati
  const id = g.createImageData(SKIN_W, SKIN_H), d = id.data;
  for (let y = 0; y < SKIN_H; y++) for (let x = 0; x < SKIN_W; x++) {
    const i = (y * SKIN_W + x) * 4, w = ((x + (y >> 1)) % 3 === 0 ? -6 : 0) + ((y + (x >> 1)) % 3 === 0 ? -4 : 0);
    const val = 240 + w + (Math.random() - .5) * 14 + (vnoise(x * .02, y * .02) - .5) * 24;
    d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#fff'; g.fillRect(SKIN_W * .86, SKIN_H * .92, SKIN_W * .14, SKIN_H * .08);
  // (u attorno alla parte, altezza in metri) → pixel; ogni tratto è ripetuto oltre la cucitura
  const SC = c => SKIN_W * (c ? SKIN_US : SKIN_UA), X = (u, c) => (c ? SKIN_UB * SKIN_W : 0) + u * SC(c), Y = y => (1 - y / 2) * SKIN_H;
  const offs = (u0, u1) => [0, 1, -1].filter(o => Math.max(u0, u1) + o > -.05 && Math.min(u0, u1) + o < 1.3);
  const line = (u0, y0, u1, y1, c, w, st) => { for (const o of offs(u0, u1)) { g.strokeStyle = st; g.lineWidth = w; g.beginPath(); g.moveTo(X(u0 + o, c), Y(y0)); g.lineTo(X(u1 + o, c), Y(y1)); g.stroke(); } };
  const blob = (u, y, rx, ry, c, st) => { for (const o of offs(u - rx, u + rx)) { const x = X(u + o, c), gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, st); gr.addColorStop(1, st.replace(/[\d.]+\)$/, '0)')); g.save(); g.translate(x, Y(y)); g.scale(rx * SC(c), ry * SKIN_H / 2); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); } };
  const rect = (u, y, w, h, c, st) => { for (const o of offs(u - w / 2, u + w / 2)) { g.strokeStyle = st; g.lineWidth = 3; g.strokeRect(X(u + o - w / 2, c), Y(y), w * SC(c), h * SKIN_H / 2); } };
  const seam = 'rgba(40,36,28,.5)', stitch = 'rgba(50,45,35,.35)', wr = 'rgba(30,28,22,.24)', hl = 'rgba(255,255,255,.3)';
  // pieghe: tratti curvi scuri con un filo di luce sopra
  const wrinkle = (u, y, c, n, spread, h) => {
    for (let k = 0; k < n; k++) {
      const uu = u + (Math.random() - .5) * spread, yy = y + (Math.random() - .5) * h, l = .03 + Math.random() * .06, bend = (Math.random() - .5) * .025;
      for (const o of offs(uu - l / 2, uu + l / 2)) {
        const x0 = X(uu - l / 2 + o, c), x1 = X(uu + l / 2 + o, c), xm = (x0 + x1) / 2;
        g.lineWidth = 2 + Math.random() * 4; g.strokeStyle = wr; g.beginPath(); g.moveTo(x0, Y(yy)); g.quadraticCurveTo(xm, Y(yy + bend), x1, Y(yy + bend * .3)); g.stroke();
        g.lineWidth = 1.5; g.strokeStyle = hl; g.beginPath(); g.moveTo(x0, Y(yy) - 4); g.quadraticCurveTo(xm, Y(yy + bend) - 4, x1, Y(yy + bend * .3) - 4); g.stroke();
      }
    }
  };
  // ---- corpo: cuciture laterali, abbottonatura, carré, tasche ----
  for (const u of [.25, .75]) { line(u, .45, u, 1.0, 0, 3, seam); line(u, 1.08, u, 1.5, 0, 3, seam); }
  line(.5, 1.12, .5, 1.53, 0, 3, seam); line(.507, 1.12, .507, 1.53, 0, 1, stitch);
  line(-.05, 1.43, .2, 1.43, 0, 2, stitch); line(.8, 1.43, 1.05, 1.43, 0, 2, stitch);
  for (const su of [-1, 1]) { rect(.5 + su * .09, 1.47, .1, .1, 0, seam); line(.5 + su * .09 - .05, 1.44, .5 + su * .09 + .05, 1.44, 0, 2, stitch); }
  if (!A) for (const su of [-1, 1]) { rect(.5 + su * .1, 1.25, .11, .11, 0, seam); line(.5 + su * .1 - .055, 1.22, .5 + su * .1 + .055, 1.22, 0, 2, stitch); }
  wrinkle(.5, 1.12, 0, 30, .9, .06); wrinkle(.25, 1.36, 0, 10, .06, .12); wrinkle(.75, 1.36, 0, 10, .06, .12);
  wrinkle(.5, .86, 0, 16, .3, .08); wrinkle(.5, .5, 0, 30, .9, .1); wrinkle(.0, .58, 0, 12, .3, .12);
  if (!A) { wrinkle(.5, .14, 0, 30, 1, .16); for (let k = 0; k < 4; k++) line(-.05, .1 + k * .045, 1.3, .1 + k * .045 + .01, 0, 3, 'rgba(20,18,15,.25)'); }
  else { for (let k = 0; k < 7; k++) line(.34, .12 + k * .04, .34, .14 + k * .04, 0, 5, 'rgba(60,50,30,.5)'); wrinkle(.5, .37, 0, 14, .9, .04); }
  blob(.5, 1.06, .9, .03, 0, 'rgba(0,0,0,.35)'); blob(.5, 1.555, .35, .025, 0, 'rgba(0,0,0,.3)');
  // ---- volto ----
  const FY = 1.57, hair = A ? 'rgba(60,40,25,.85)' : 'rgba(150,120,70,.85)';
  blob(.5, FY + .23, .3, .05, 0, 'rgba(10,6,4,.6)');
  blob(.5, FY + .005, .2, .035, 0, 'rgba(20,10,6,.5)');
  blob(.5, FY + .045, .13, .035, 0, A ? 'rgba(60,60,70,.32)' : 'rgba(80,70,60,.25)');
  for (const su of [-1, 1]) {
    const eu = .5 + su * .058;
    blob(eu, FY + .145, .045, .02, 0, 'rgba(70,40,28,.45)');
    blob(eu, FY + .143, .018, .005, 0, 'rgba(235,225,210,.55)');
    blob(eu - su * .003, FY + .143, .007, .005, 0, 'rgba(35,24,16,.9)');
    line(eu - .02, FY + .15, eu + .02, FY + .149, 0, 2, 'rgba(40,24,16,.6)');
    line(eu - .026 * su, FY + .162, eu + .028 * su, FY + .167, 0, 4, A ? 'rgba(70,45,25,.6)' : 'rgba(110,85,50,.55)');
    blob(.5 + su * .09, FY + .1, .05, .03, 0, 'rgba(170,80,60,.1)');
    line(.5 + su * .035, FY + .115, .5 + su * .052, FY + .072, 0, 2, 'rgba(80,45,30,.2)');
    blob(.5 + su * .25, FY + .13, .03, .03, 0, 'rgba(90,40,30,.35)');
    blob(.5 + su * .2, FY + .19, .12, .05, 0, hair);
  }
  blob(0, FY + .19, .25, .07, 0, hair);
  for (const su of [-1, 1]) blob(.5 + su * .16, FY + .1, .08, .09, 0, 'rgba(60,35,25,.22)'); // volume: lati del viso in ombra
  blob(.5, FY + .125, .012, .025, 0, 'rgba(255,240,230,.25)'); blob(.5, FY + .097, .02, .008, 0, 'rgba(70,30,20,.45)');
  line(.475, FY + .064, .525, FY + .064, 0, 2, 'rgba(90,40,35,.5)'); blob(.5, FY + .056, .025, .006, 0, 'rgba(150,80,70,.25)');
  // ---- braccia: cucitura, pieghe al gomito, polsino, nocche ----
  line(.0, .9, .0, 1.5, 1, 3, seam); line(1, .9, 1, 1.5, 1, 3, seam); line(.75, .95, .75, 1.48, 1, 2, stitch);
  wrinkle(.5, 1.2, 1, 24, 1, .07); wrinkle(.25, 1.42, 1, 8, .2, .06); line(-.05, .985, 1.3, .985, 1, 3, seam);
  for (let k = 0; k < 4; k++) line(.38 + k * .08, .855, .38 + k * .08, .875, 1, 2, 'rgba(90,50,40,.4)');
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  return t;
}
function skinMaterial(team) {
  if (!SKIN.mat) SKIN.mat = {};
  if (SKIN.mat[team]) return SKIN.mat[team];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: paintSoldier(team), normalMap: TEX.fabric.normal, roughness: .93, metalness: 0 });
  m.normalScale.set(.55, .55); m.skinning = true;
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('texture2D( normalMap, vUv )', 'texture2D( normalMap, vUv*vec2(22.,11.) )'); };
  return SKIN.mat[team] = m;
}
function skinTemplate(b) {
  const key = skinKey(b); let t = SKIN.tpl[key]; if (t) return t;
  const r = makeBody(b.team, b.kind); BODIES.pop();
  r.root.updateMatrixWorld(true);
  const parts = [], ranges = [], white = new THREE.Color(1, 1, 1);
  const base = typeof BASE_MALE !== 'undefined';
  if (base) { const g = baseBodyGeo(b.team); parts.push({ g, m: new THREE.Matrix4(), c: white, vc: true, uvs: 1 }); ranges.push(['base', g.attributes.position.count, null]); }
  for (const p of r.parts) { if (base && p.name === 'head' && useScanHead(p.key)) continue; const g = (p.name === 'weapon' && gunGeo(b.team, b.kind)) || buildPartGeo(p.key, true, base); parts.push({ g, m: p.node.matrixWorld.clone(), c: white, vc: true, uvs: 1 }); ranges.push([p.name, g.attributes.position.count, p.node.matrixWorld.clone().invert()]); }
  const geo = mergeGeos(parts), n = geo.attributes.position.count, si = new Float32Array(n * 4), sw = new Float32Array(n * 4), pa = geo.attributes.position, v = new V3();
  let o = 0;
  for (const [name, cnt, inv] of ranges) {
    if (name === 'base') { const BB = BASE_MALE.b, BW = BASE_MALE.w; for (let i = 0; i < cnt; i++) { si[i * 4] = BB[i * 2]; si[i * 4 + 1] = BB[i * 2 + 1]; sw[i * 4] = BW[i]; sw[i * 4 + 1] = 1 - BW[i]; } o += cnt; continue; }
    const [bone, par, dir, hw] = SKIN_MAP[name];
    for (let i = o; i < o + cnt; i++) {
      si[i * 4] = bone; si[i * 4 + 1] = par;
      let w = 1;
      if (hw) { v.fromBufferAttribute(pa, i).applyMatrix4(inv); w = clamp(.5 + v.y * dir / (2 * hw), 0, 1); w = w * w * (3 - 2 * w); }
      sw[i * 4] = w; sw[i * 4 + 1] = 1 - w;
    }
    o += cnt;
  }
  // coordinate di texture: proiezione cilindrica attorno all'asse di ogni parte (davanti = centro)
  const ul = new Float32Array(n), vy = new Float32Array(n), cl = new Float32Array(n);
  o = 0;
  for (let pi = 0; pi < ranges.length; pi++) {
    const [name, cnt] = ranges[pi], e = parts[pi].m.elements, flat = name === 'helmet' || name === 'weapon';
    let arm = name[0] === 'u' || name[0] === 'f', cx = name === 'chest' || name === 'head' || name === 'pelvis' ? 0 : e[12], cz = arm ? e[14] : 0;
    for (let i = o; i < o + cnt; i++) {
      if (name === 'base') { const bo = BASE_MALE.b[(i - o) * 2]; arm = bo >= 5 && bo <= 8; cx = arm ? (bo < 7 ? SH_L.x : SH_R.x) : bo >= 10 ? (bo < 12 ? -.1 : .1) : 0; cz = 0; }
      v.fromBufferAttribute(pa, i);
      ul[i] = .5 + Math.atan2(v.x - cx, -(v.z - cz)) / TAU; vy[i] = v.y; cl[i] = flat ? 2 : arm ? 1 : 0;
    }
    o += cnt;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setAttribute('_ul', new THREE.BufferAttribute(ul, 1)); geo.setAttribute('_vy', new THREE.BufferAttribute(vy, 1)); geo.setAttribute('_cl', new THREE.BufferAttribute(cl, 1));
  const g2 = geo.toNonIndexed(), m2 = g2.attributes.position.count, U2 = g2.attributes._ul.array, V2 = g2.attributes._vy.array, C2 = g2.attributes._cl.array, uv = g2.attributes.uv.array;
  // i triangoli a cavallo della cucitura posteriore prendono la copia ripetuta oltre u = 1
  for (let i = 0; i < m2; i += 3) {
    if (Math.max(U2[i], U2[i + 1], U2[i + 2]) - Math.min(U2[i], U2[i + 1], U2[i + 2]) > .5) for (let k = 0; k < 3; k++) if (U2[i + k] < .5) U2[i + k] += 1;
    for (let k = i; k < i + 3; k++) {
      const cc = C2[k];
      uv[k * 2] = cc === 2 ? .93 : cc === 1 ? SKIN_UB + U2[k] * SKIN_US : U2[k] * SKIN_UA;
      uv[k * 2 + 1] = cc === 2 ? .03 : V2[k] / 2;
    }
  }
  g2.deleteAttribute('_ul'); g2.deleteAttribute('_vy'); g2.deleteAttribute('_cl'); geo.dispose();
  g2.computeBoundingSphere();
  const inv = SKIN_BONES.map(k => r[k].matrixWorld.clone().invert());
  t = SKIN.tpl[key] = { geo: g2, inv };
  return t;
}
// corpo base CC0 vestito: giacca, calzoni, ghette o stivali, collo; gonfiato lungo la normale per il volume del tessuto
function baseBodyGeo(team) {
  const C = SCOL2[team], A = team === 'A', BP = BASE_MALE.p, BN = BASE_MALE.n, BB = BASE_MALE.b, n = BP.length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(BN), cl = new Float32Array(n * 3), uv = new Float32Array(n * 2), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const bo = BB[i * 2], y = BP[i * 3 + 1], arm = bo >= 5 && bo <= 8, leg = bo >= 10, neck = bo === 3 && y > 1.53;
    let hex = C.jacket, inf = .022;
    if (arm) { inf = .016; }
    else if (leg || (bo === 1 && y < .99)) { hex = C.pants; inf = .018; if (bo === 11 || bo === 13) { if (A && y < .3) { hex = C.legging; inf = .02; } else if (!A && y < .47) { hex = C.boot; inf = .012; } } }
    if (neck) { hex = C.skin; inf = 0; }
    c.copy(col(hex)); const sh = .92 + (y > .99 && y < 1.06 ? -.12 : 0); // ombra sotto la cintura
    cl[i * 3] = c.r * sh; cl[i * 3 + 1] = c.g * sh; cl[i * 3 + 2] = c.b * sh;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = BP[i * 3 + k] + BN[i * 3 + k] * inf;
    if (bo === 3 && y > 1.6 && typeof HEAD_SCAN !== 'undefined') { pos[i * 3] *= .55; pos[i * 3 + 1] = 1.6; pos[i * 3 + 2] *= .55; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(BASE_MALE.i);
  return g;
}
// arma dei soldati vicini: lo stesso modello della vista in prima persona, fuso in un'unica geometria
// con i colori dei materiali; l'impugnatura cade sull'origine del nodo dell'arma come nei modelli semplici
const GUN_ID = { A: { rifle: 'garand', sniper: 'springfield', smg: 'thompson', bar: 'bar' }, E: { rifle: 'kar98', sniper: 'kar98zf', smg: 'mp40' } };
function gunGeo(team, kind) {
  const id = (GUN_ID[team] || {})[kind]; if (!id || typeof buildGun !== 'function' || !VM.wood) return null;
  const gi = buildGun(id), grp = gi.group, C = SCOL2[team], parts = [];
  const tint = m => m === VM.wood ? 0x6b4423 : m === VM.wood2 ? 0x5a3a20 : m === VM.bake ? 0x2c1a10 : m === VM.brass ? 0xb08a3a : m === VM.glass ? 0x203040 : m === VM.olive ? 0x4a5236 : C.metal;
  grp.updateMatrixWorld(true);
  const off = new THREE.Matrix4().makeTranslation(-gi.grip.x, -gi.grip.y - .03, -gi.grip.z + .03);
  grp.traverse(o => { if (!o.isMesh) return; const g = o.geometry.index ? o.geometry : o.geometry; parts.push({ g, m: off.clone().multiply(o.matrixWorld), c: col(tint(o.material)), vc: false, uvs: 1 }); });
  return mergeGeos(parts);
}
function skinMesh(key, t) {
  const pool = SKIN.pool[key] || (SKIN.pool[key] = []), u = SKIN.used[key] || 0;
  SKIN.used[key] = u + 1;
  if (pool[u]) return pool[u];
  const m = new THREE.SkinnedMesh(t.geo, skinMaterial(key[0]));
  m.frustumCulled = false; m.matrixAutoUpdate = false; m.castShadow = Q.shadows > 0; m.receiveShadow = true;
  m.bindMode = 'detached';
  scene.add(m); pool[u] = m; return m;
}
const _skc = [];
function skinCandidates() {
  _skc.length = 0;
  if (!Q.lod) return;
  const cp = camera.position, d2m = SKIN.dist * SKIN.dist;
  for (const b of BODIES) {
    b._sk = false;
    if (b.removed || b.rag || b.parts.some(p => p.hidden)) continue;
    const e = b.root.matrixWorld.elements, dx = e[12] - cp.x, dz = e[14] - cp.z, d2 = dx * dx + dz * dz;
    if (d2 > d2m) continue;
    _cs.center.set(e[12], e[13] + .9, e[14]); _cs.radius = 1.6;
    if (!CROWD.frustum.intersectsSphere(_cs) && d2 > 64) continue;
    b._d2 = d2; _skc.push(b);
  }
  _skc.sort((a, c) => a._d2 - c._d2);
  if (_skc.length > SKIN.max) _skc.length = SKIN.max;
  for (const k in SKIN.used) SKIN.used[k] = 0;
  for (const b of _skc) {
    b._sk = true; b.root.updateMatrixWorld(true);
    const t = skinTemplate(b), m = skinMesh(skinKey(b), t);
    if (!b.skel) b.skel = new THREE.Skeleton(SKIN_BONES.map(k => b[k]), t.inv);
    m.skeleton = b.skel; m.visible = true;
  }
  for (const k in SKIN.pool) { const pool = SKIN.pool[k]; for (let i = SKIN.used[k] || 0; i < pool.length; i++) pool[i].visible = false; }
}

// ---------- aggiornamento istanze ----------
const _cs = new THREE.Sphere(), _cc = new THREE.Color();
function updateCrowd() {
  CROWD.frame++;
  CROWD.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  CROWD.frustum.setFromProjectionMatrix(CROWD.pm);
  for (const k in CROWD.meshes) { const m = CROWD.meshes[k]; m.n[0] = m.n[1] = 0; }
  const cp = camera.position, lod2 = Q.lod * Q.lod;
  skinCandidates();
  for (let i = BODIES.length - 1; i >= 0; i--) {
    const b = BODIES[i];
    if (b.removed) { BODIES.splice(i, 1); continue; }
    const rp = b.rag ? b.rag.p[0] : b.root.position;
    _cs.center.set(rp.x, rp.y + .9, rp.z); _cs.radius = 1.6;
    const near = Q.shadows && Math.abs(rp.x - cp.x) < Q.shadowDist * .6 && Math.abs(rp.z - cp.z) < Q.shadowDist * .6;
    if (!CROWD.frustum.intersectsSphere(_cs) && !near) continue;
    if (!b.settled) b.root.updateMatrixWorld(true);
    const dx = rp.x - cp.x, dz = rp.z - cp.z, d2 = dx * dx + dz * dz;
    const L = d2 < lod2 || b._sk ? 0 : 1;
    _cc.copy(b.tint);
    for (const p of b.parts) {
      const scanH = p.name === 'head' && useScanHead(p.key);
      if (p.hidden || (b._sk && !(scanH && typeof BASE_MALE !== 'undefined'))) continue;
      const mm = p.mesh, im = L === 0 && mm.hi ? mm.hi : mm.lo, li = im === mm.hi ? 0 : 1, idx = mm.n[li];
      if (idx >= im.instanceMatrix.count) continue;
      im.instanceMatrix.array.set(p.node.matrixWorld.elements, idx * 16);
      const tc = scanH && im === mm.hi ? b.skinT : _cc, ca = im.instanceColor.array; ca[idx * 3] = tc.r; ca[idx * 3 + 1] = tc.g; ca[idx * 3 + 2] = tc.b;
      mm.n[li]++;
    }
  }
  for (const k in CROWD.meshes) {
    const m = CROWD.meshes[k];
    for (const [im, li] of [[m.hi, 0], [m.lo, 1]]) { if (!im) continue; im.count = m.n[li]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
