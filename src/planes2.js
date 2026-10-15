"use strict";
// ============================================================
//  Otto nuovi aerei costruiti da parametri: fusoliera a sezioni,
//  ala (ellittica, a gabbiano o rastremata), impennaggi, motore
//  radiale, in linea o a reazione, tettuccio, mimetica e insegne.
//  Ognuno ha armi, massa, spinta e robustezza proprie: i cannoni
//  pesanti sparano lenti ma con proiettili esplosivi.
// ============================================================
const PLANE_SPECS = {
  p51: {
    name: 'P-51D Mustang', nation: 'us', engine: 'inline', len: 9.8, w: 1.05, h: 1.45, nose: .3,
    wing: { span: 11.3, root: 2.65, tip: 1.15, le: -1.2, sweep: .05, dihedral: .09, y0: -.42 }, tail: { span: 4.2, root: 1.25, z: 3.75 }, fin: { h: 1.75, root: 1.6, z: 3.5 },
    canopy: { z0: -1.0, z1: .6, w: .7, h: .55, y: .55, bubble: true }, scoop: true, stripes: true,
    colors: { top: 0xb9bcb8, bottom: 0xb9bcb8, metal: true, nose: 0xd8c23a },
    prop: { R: 1.7, n: 4, chord: .26, tip: 0xd8c040 }, eye: [0, .95, -.25],
    guns: { pos: [[-2.3, -.35, -1.6], [-2.6, -.35, -1.6], [-2.9, -.35, -1.6], [2.3, -.35, -1.6], [2.6, -.35, -1.6], [2.9, -.35, -1.6]], dmg: 22, int: .06, cal: 12.7, snd: 'm2', spread: .006 },
    mass: 4400, S: 21.6, thrust: 1.05, agile: 1.12, hp: 900, bombs: 2,
  },
  f4u: {
    name: 'F4U Corsair', nation: 'us', engine: 'radial', len: 10.2, w: 1.4, h: 1.55, nose: .6,
    wing: { span: 12.5, root: 2.8, tip: 1.3, le: -1.4, sweep: .04, gull: true, y0: -.55 }, tail: { span: 5, root: 1.4, z: 4 }, fin: { h: 1.9, root: 1.7, z: 3.75 },
    canopy: { z0: -.4, z1: .9, w: .66, h: .5, y: .6 }, stripes: false,
    colors: { top: 0x2f4664, bottom: 0xc9cfd3, mid: 0x5f7590 },
    prop: { R: 2.0, n: 3, chord: .3, tip: 0xd8c040 }, eye: [0, 1.0, .2],
    guns: { pos: [[-2.6, -.6, -1.7], [-2.9, -.55, -1.7], [-3.2, -.5, -1.7], [2.6, -.6, -1.7], [2.9, -.55, -1.7], [3.2, -.5, -1.7]], dmg: 22, int: .06, cal: 12.7, snd: 'm2', spread: .006 },
    mass: 5600, S: 29.2, thrust: 1.08, agile: 1.0, hp: 1150, bombs: 2,
  },
  spit: {
    name: 'Spitfire Mk IX', nation: 'uk', engine: 'inline', len: 9.5, w: 1.0, h: 1.4, nose: .28,
    wing: { span: 11.2, root: 2.5, tip: .4, le: -1.1, ellip: true, dihedral: .1, y0: -.4 }, tail: { span: 3.3, root: 1.1, z: 3.75, ellip: true }, fin: { h: 1.6, root: 1.4, z: 3.55, round: true },
    canopy: { z0: -.9, z1: .4, w: .62, h: .45, y: .55, bubble: true }, stripes: true,
    colors: { top: 0x6b6a4e, camo: 0x48553a, bottom: 0xb7b9ad, band: 0xc9bf9a },
    prop: { R: 1.65, n: 4, chord: .24, tip: 0xd8c040 }, eye: [0, .92, -.3],
    guns: { pos: [[-1.9, -.32, -1.4], [1.9, -.32, -1.4], [-2.9, -.3, -1.3], [2.9, -.3, -1.3]], dmg: 46, int: .075, cal: 20, snd: 'm2', spread: .007 },
    mass: 3400, S: 22.5, thrust: .95, agile: 1.25, hp: 800, bombs: 1,
  },
  typhoon: {
    name: 'Hawker Typhoon IB', nation: 'uk', engine: 'inline', len: 9.7, w: 1.25, h: 1.6, nose: .5, chin: true,
    wing: { span: 12.7, root: 2.9, tip: 1.6, le: -1.5, sweep: .02, dihedral: .1, y0: -.55 }, tail: { span: 4.5, root: 1.3, z: 3.85 }, fin: { h: 1.75, root: 1.6, z: 3.6 },
    canopy: { z0: -.8, z1: .45, w: .66, h: .52, y: .62, bubble: true }, stripes: true,
    colors: { top: 0x6b6a4e, camo: 0x48553a, bottom: 0xb7b9ad, band: 0xc9bf9a },
    prop: { R: 2.0, n: 3, chord: .3, tip: 0xd8c040 }, eye: [0, 1.0, -.2],
    guns: { pos: [[-2.6, -.45, -1.9], [-3.1, -.42, -1.9], [2.6, -.45, -1.9], [3.1, -.42, -1.9]], dmg: 42, int: .1, cal: 20, snd: 'flak', spread: .007, he: 1.5 },
    mass: 5200, S: 25.9, thrust: 1.0, agile: .95, hp: 1100, bombs: 2,
  },
  hurri: {
    name: 'Hurricane IID', nation: 'uk', engine: 'inline', len: 9.8, w: 1.15, h: 1.55, nose: .4,
    wing: { span: 12.2, root: 2.6, tip: 1.3, le: -1.2, dihedral: .1, y0: -.5 }, tail: { span: 3.4, root: 1.2, z: 4.0 }, fin: { h: 1.9, root: 1.6, z: 3.8, round: true },
    canopy: { z0: -.6, z1: .5, w: .62, h: .45, y: .6 }, stripes: true, pods: 'cannon40',
    colors: { top: 0xb39a6a, camo: 0x7a6440, bottom: 0x96a7b0 },
    prop: { R: 1.75, n: 3, chord: .28, tip: 0xd8c040 }, eye: [0, 1.0, -.1],
    guns: { pos: [[-1.9, -.85, -2.6], [1.9, -.85, -2.6]], dmg: 150, int: .42, cal: 40, snd: 'flak', spread: .003, he: 3.2 },
    mass: 3900, S: 23.9, thrust: .85, agile: .9, hp: 950, bombs: 0,
  },
  bf109: {
    name: 'Bf 109G-6', nation: 'de', engine: 'inline', len: 9.0, w: .95, h: 1.4, nose: .3, bulges: true,
    wing: { span: 9.9, root: 2.2, tip: 1.1, le: -1.0, dihedral: .11, y0: -.45 }, tail: { span: 3.0, root: 1.0, z: 3.55, strut: true }, fin: { h: 1.6, root: 1.3, z: 3.4, round: true },
    canopy: { z0: -.9, z1: .3, w: .6, h: .42, y: .52, framed: true }, stripes: false,
    colors: { top: 0x6a6e70, camo: 0x7d8272, bottom: 0xa9b4ba, band: 0xd0a32c },
    prop: { R: 1.5, n: 3, chord: .26, tip: 0x1a1a1a }, eye: [0, .88, -.4],
    guns: { pos: [[0, 0, -4.4], [-.25, .35, -3], [.25, .35, -3]], dmg: 34, int: .08, cal: 20, snd: 'mg42', spread: .006 },
    mass: 3100, S: 16.1, thrust: .95, agile: 1.18, hp: 750, bombs: 1,
  },
  stuka: {
    name: 'Ju 87G Stuka', nation: 'de', engine: 'inline', len: 11.1, w: 1.2, h: 1.7, nose: .45, rad: true,
    wing: { span: 13.8, root: 3.2, tip: 1.4, le: -1.4, gull: 'inv', y0: -.75 }, tail: { span: 5, root: 1.5, z: 4.6, strut: true }, fin: { h: 2.0, root: 1.8, z: 4.35 },
    canopy: { z0: -1.2, z1: 1.3, w: .7, h: .5, y: .6, framed: true, long: true }, stripes: false, spats: true, pods: 'cannon37',
    colors: { top: 0x55613f, camo: 0x3f4a33, bottom: 0x9fb2bc, band: 0xd0a32c },
    prop: { R: 1.7, n: 3, chord: .3, tip: 0x1a1a1a }, eye: [0, 1.0, -.6],
    guns: { pos: [[-2.6, -1.45, -2.3], [2.6, -1.45, -2.3]], dmg: 135, int: .5, cal: 37, snd: 'flak', spread: .003, he: 3 },
    mass: 5000, S: 33.7, thrust: .72, agile: .78, hp: 1050, bombs: 2,
  },
  me262: {
    name: 'Me 262 Schwalbe', nation: 'de', engine: 'jet', len: 10.6, w: 1.25, h: 1.35, nose: .35, tri: true,
    wing: { span: 12.5, root: 3.1, tip: 1.3, le: -.9, sweep: .3, dihedral: .07, y0: -.25 }, tail: { span: 5, root: 1.3, z: 4.4, sweep: .3 }, fin: { h: 1.7, root: 1.6, z: 4.1, sweep: .4 },
    canopy: { z0: -.5, z1: .8, w: .62, h: .45, y: .55 }, stripes: false,
    colors: { top: 0x5f6a4e, camo: 0x7b7d62, bottom: 0xa9b4ba },
    prop: null, eye: [0, .9, .1],
    guns: { pos: [[-.25, .2, -5], [.25, .2, -5], [-.3, -.1, -4.9], [.3, -.1, -4.9]], dmg: 70, int: .13, cal: 30, snd: 'flak', spread: .006, he: 2 },
    mass: 6400, S: 21.7, thrust: 1.6, agile: .85, hp: 1000, bombs: 0, jet: true,
  },
};
// cacciabombardiere bimotore: il più armato, 4 cannoni da 20 mm e 4 mitragliatrici nel muso più 4 bombe; pesante e poco agile
PLANE_SPECS.mosquito = {
  name: 'Mosquito FB.VI', nation: 'uk', engine: 'inline', len: 12.4, w: 1.35, h: 1.7, nose: .7, twin: 2.6,
  wing: { span: 16.5, root: 3.6, tip: 1.5, le: -1.8, sweep: .05, dihedral: .08, y0: -.15 }, tail: { span: 6, root: 1.7, z: 5.1 }, fin: { h: 2.4, root: 2.1, z: 4.8, round: true },
  canopy: { z0: -2.9, z1: -1.4, w: .95, h: .6, y: .62, framed: true }, stripes: true,
  colors: { top: 0x5f6a4e, camo: 0x4d4b3c, bottom: 0xa9aea4, band: 0xc9bf9a },
  prop: { R: 1.9, n: 3, chord: .28, tip: 0xd8c040 }, eye: [0, 1.0, -2.2],
  guns: { pos: [[-.35, -.55, -4.4], [-.15, -.6, -4.5], [.15, -.6, -4.5], [.35, -.55, -4.4]], dmg: 40, int: .11, cal: 20, snd: 'flak', spread: .007, he: 1.3 },
  guns2: { pos: [[-.3, .35, -5.7], [-.1, .4, -5.8], [.1, .4, -5.8], [.3, .35, -5.7]], dmg: 10, int: .05, cal: 7.7, snd: 'm2', spread: .009 },
  mass: 8800, S: 42.2, thrust: 1.05, agile: .75, hp: 1500, bombs: 4,
};
// bombardiere bimotore nemico (solo IA)
PLANE_SPECS.ju88 = {
  name: 'Ju 88A-4', nation: 'de', engine: 'inline', len: 14.4, w: 1.6, h: 1.9, nose: .5, twin: 3.3, glassNose: true, ai: true,
  wing: { span: 20, root: 4.2, tip: 1.8, le: -2.2, dihedral: .07, y0: -.3 }, tail: { span: 7, root: 2, z: 5.8 }, fin: { h: 2.6, root: 2.2, z: 5.5, round: true },
  canopy: { z0: -4.6, z1: -2.4, w: 1.2, h: .7, y: .7, framed: true, long: true }, stripes: false,
  colors: { top: 0x55613f, camo: 0x3f4a33, bottom: 0x9fb2bc },
  prop: { R: 1.75, n: 3, chord: .28, tip: 0x1a1a1a }, eye: [0, 1.1, -3.5],
  guns: { pos: [[0, .6, -2]], dmg: 10, int: .1, cal: 7.9, snd: 'mg42', spread: .01 }, mass: 12000, S: 54.7, thrust: 1, agile: .5, hp: 2200, bombs: 4,
};
PLANE_SPECS.p47 = { name: 'P-47D Thunderbolt', nation: 'us', builtin: true, guns: { pos: [[-2.5, -.3, -2.2], [-2.8, -.3, -2.2], [-3.1, -.3, -2.2], [-3.4, -.3, -2.2], [2.5, -.3, -2.2], [2.8, -.3, -2.2], [3.1, -.3, -2.2], [3.4, -.3, -2.2]], dmg: 25, int: .055, cal: 12.7, snd: 'm2', spread: .006 }, mass: 6000, S: 27.9, thrust: 1, agile: 1, hp: 1100, bombs: 2, eye: [0, 1.12, -.5] };
const PLAYER_PLANES = ['p47', 'p51', 'f4u', 'spit', 'typhoon', 'hurri', 'bf109', 'stuka', 'me262', 'mosquito'];

// tondo britannico
function ukRoundel() {
  const I = insignia(); if (I.uk) return I.uk;
  const t = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); const c = s / 2; for (const [r, col] of [[.48, '#d8c23a'], [.42, '#1f2b5a'], [.26, '#e8e6df'], [.14, '#9a2a24']]) { g.fillStyle = col; g.beginPath(); g.arc(c, c, s * r, 0, TAU); g.fill(); } });
  I.uk = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, side: THREE.DoubleSide });
  return I.uk;
}
// fusoliera: larghezza e altezza lungo la lunghezza secondo il tipo di motore
function specFuselage(sp) {
  const L = sp.len, st = [], N = 18;
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = -L * .46 + t * L;
    let k;
    if (sp.engine === 'radial') k = t < .06 ? lerp(.8, 1, t / .06) : t < .32 ? 1 : Math.pow(1 - (t - .32) / .68, 1.15);
    else if (sp.engine === 'jet') k = t < .2 ? Math.sqrt(t / .2) * .9 + .1 : t < .45 ? 1 : Math.pow(1 - (t - .45) / .55, 1.2);
    else k = t < .14 ? .3 + .7 * Math.sqrt(t / .14) : t < .38 ? 1 : Math.pow(1 - (t - .38) / .62, 1.25);
    k = Math.max(.04, k);
    let h = sp.h * (sp.tri && t > .25 && t < .6 ? 1.08 : 1) * k, w = sp.w * k * (sp.tri ? (1.05 - .1 * t) : 1);
    const cy = t > .45 ? (t - .45) * sp.h * .35 : 0;
    st.push([z, Math.max(.03, w), Math.max(.03, h), cy, t > .2 && t < .55 && !sp.tri ? 1.9 : 2.2]);
  }
  return st;
}
function buildSpecPlane(type) {
  const sp = PLANE_SPECS[type], mb = new MB(), glass = new MB(), prop = new MB(); mb.mat = glass.mat = prop.mat = 'paint';
  const C = sp.colors, top = col(C.top), bot = col(C.bottom), camo = col(C.camo || C.top), W = col(0xe6e3da), K = col(0x161616), band = C.band ? col(C.band) : null, nose = C.nose ? col(C.nose) : null;
  const L = sp.len, half = sp.wing.span / 2;
  const paint = (p, isWing) => {
    const lower = p.y < (isWing ? (Math.abs(p.x) <= half + .1 ? wy(p.x) : sp.wing.y0) - .01 : -.15);
    let c = lower ? bot : top;
    if (!lower && C.camo && vnoise(p.x * .45 + p.z * .2 + 3, p.z * .5 - p.x * .15) > .52) c = camo;
    if (C.metal) c = col(0xb9bcb8);
    if (nose && p.z < -L * .42) c = nose;
    if (band && !isWing && p.z > L * .22 && p.z < L * .3) c = band;
    if (sp.stripes) { const v = isWing ? Math.abs(p.x) : p.z; const a = isWing ? half * .42 : L * .18; if (isWing ? lower || true : true) { const s = stripeCol(v, a, c, [W, K]); if (s !== c && (isWing || p.y < .4)) c = s; } }
    return c;
  };
  // fusoliera
  const fst = specFuselage(sp);
  mb.addG(fuselageGeo(fst, 24, 2.2, p => paint(p, false)));
  // ala
  const w = sp.wing, span = [];
  for (let x = -half; x <= half + .01; x += half / 14) span.push(x);
  const wy = x => { const a = Math.abs(x); if (w.gull === true) return w.y0 + (a < 1.9 ? -a * .22 : -.42 + (a - 1.9) * .13); if (w.gull === 'inv') return w.y0 + (a < 2.2 ? -a * .2 : -.44 + (a - 2.2) * .16); return w.y0 + a * (w.dihedral || .08); };
  const chord = x => { const a = Math.abs(x) / half; if (w.ellip) return Math.max(w.tip, w.root * Math.sqrt(Math.max(0, 1 - a * a))); return lerp(w.root, w.tip, a) * (a > .94 ? Math.sqrt(Math.max(.1, 1 - ((a - .94) / .06) ** 2)) : 1); };
  const le = x => w.le + Math.abs(x) * (w.sweep || 0) + (w.root - chord(x)) * (w.ellip ? .35 : .15);
  mb.addG(wingGeo({ stations: span, chord, le, y: wy, thick: x => .15 - .007 * Math.abs(x), color: p => paint(p, true) }));
  // impennaggi
  const tl = sp.tail, tsp = tl.span * (tl.span > 4.6 ? .85 : 1), ts = []; for (let x = -tsp / 2; x <= tsp / 2 + .01; x += tsp / 12) ts.push(x);
  mb.addG(wingGeo({ stations: ts, chord: x => (tl.ellip ? Math.max(.35, tl.root * Math.sqrt(Math.max(0, 1 - (2 * x / tl.span) ** 2))) : tl.root - Math.abs(x) * .22) * .82, le: x => tl.z + Math.abs(x) * (tl.sweep || .08), y: () => (sp.tri ? .55 : .22), thick: () => .09, color: p => paint(p, true) }));
  const fn = sp.fin, fs = []; for (let y = .2; y <= fn.h + .01; y += fn.h / 9) fs.push(y);
  mb.addG(finGeo({ stations: fs, chord: y => fn.round ? Math.max(.3, fn.root * Math.sqrt(Math.max(0, 1 - (y / fn.h) ** 2)) + .2) : fn.root - (y - .2) * .35, le: y => fn.z + (y - .2) * (fn.sweep || .35), thick: () => .1, color: p => paint(p, false) }));
  if (tl.strut) for (const sx of [-1, 1]) mb.add(cylG2(.025, .025, .9, 6), 0x333333, sx * .5, -.1, tl.z + .3, 0, 0, sx * .7);
  // motore
  let propZ = -L * .46 - .05;
  if (sp.engine === 'radial') { mb.add(new THREE.TorusGeometry(sp.w * .45, .07, 8, 24), 0x2a2a2a, 0, 0, propZ + .05); mb.add(cylG2(sp.w * .44, sp.w * .44, .2, 24), 0x111111, 0, 0, propZ + .15, PI / 2, 0, 0); }
  if (sp.engine === 'inline') { for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) mb.add(U.box, 0x2b2622, sx * sp.w * .48, .1, -L * .4 + k * .22, 0, 0, 0, .1, .08, .12); }
  if (sp.chin) mb.add(U.box, 0x2a2a2a, 0, -sp.h * .45, -L * .38, 0, 0, 0, sp.w * .7, .45, 1.1);
  if (sp.rad) mb.add(U.box, 0x2a2a2a, 0, -sp.h * .48, -L * .36, 0, 0, 0, sp.w * .55, .35, .8);
  if (sp.scoop) mb.add(U.box, bot.getHex ? 0xa9aca8 : 0xa9aca8, 0, -sp.h * .48, .2, 0, 0, 0, .55, .38, 1.6);
  if (sp.bulges) for (const sx of [-1, 1]) mb.add(U.sph, C.top, sx * sp.w * .4, .35, -L * .2, 0, 0, 0, .14, .12, .3);
  // gondole dei motori del bimotore
  const twinProps = [];
  if (sp.twin) for (const sx of [-1, 1]) { const x = sx * sp.twin, y = wy(x); const nac = []; for (let k = 0; k <= 8; k++) { const t = k / 8; nac.push(new THREE.Vector2(Math.max(.05, .6 * Math.sin(Math.min(1, t * 1.4 + .25) * PI / 1.15)), t * 4.6)); } const g = new THREE.LatheGeometry(nac, 16); g.rotateX(PI / 2); mb.add(g, C.top, x, y - .05, -3.4); twinProps.push([x, y - .05, -3.5]); }
  // gondole dei reattori (Me 262)
  if (sp.engine === 'jet') for (const sx of [-1, 1]) { const x = sx * 2.3, y = wy(x) - .45; const nac = []; for (let k = 0; k <= 8; k++) { const t = k / 8; nac.push(new THREE.Vector2(Math.max(.05, .42 * Math.sin(Math.min(1, t * 1.6 + .15) * PI / 1.1)), t * 3.6)); } const g = new THREE.LatheGeometry(nac, 16); g.rotateX(PI / 2); mb.add(g, C.top, x, y, -2.2); mb.add(cylG2(.3, .3, .1, 14), 0x101010, x, y, -2.25, PI / 2, 0, 0); }
  // gondole dei cannoni pesanti sotto le ali
  if (sp.pods) for (const sx of [-1, 1]) { const x = sx * (sp.pods === 'cannon37' ? 2.6 : 1.9), y = wy(x) - (sp.pods === 'cannon37' ? .65 : .4); mb.add(U.box, 0x3a3e33, x, y, -1.2, 0, 0, 0, .28, .3, 2.0); mb.add(cylG2(.06, .06, 1.8, 8), 0x1a1a1a, x, y, -2.9, PI / 2, 0, 0); mb.add(cylG2(.09, .09, .2, 8), 0x1a1a1a, x, y, -3.8, PI / 2, 0, 0); }
  // carrello fisso carenato (Stuka)
  if (sp.spats) for (const sx of [-1, 1]) { const x = sx * 1.8, y = wy(x); mb.add(U.box, C.top, x, y - .7, -1.1, 0, 0, 0, .3, 1.3, .9); mb.add(U.sph, C.top, x, y - 1.35, -1.1, 0, 0, 0, .3, .5, .7); }
  // armi che sporgono dal bordo d'attacco
  // canne: quelle alari sporgono dal bordo d'attacco seguendo la forma dell'ala
  for (const g of sp.guns.pos) { if (sp.pods && Math.abs(g[0]) > 1) continue; const onWing = Math.abs(g[0]) > 1.2, gy = onWing ? wy(g[0]) : g[1], gz = onWing ? le(g[0]) - .22 : g[2] - .3; mb.add(cylG2(.025, .03, .6, 6), 0x1c1c1c, g[0], gy, gz, PI / 2, 0, 0); }
  // tettuccio
  const cn = sp.canopy, czs = cn.long ? [cn.z0, cn.z0 + .3, (cn.z0 + cn.z1) / 2, cn.z1 - .3, cn.z1] : [cn.z0, cn.z0 + .25, cn.z0 + .6, (cn.z0 + cn.z1) / 2 + .2, cn.z1 - .15, cn.z1];
  glass.addG(loftGeo(czs.map((z, i) => { const f = Math.sin((i / (czs.length - 1)) * PI) * .9 + .1, r = []; for (let k = 0; k < 16; k++) { const a = k / 15 * PI; r.push(new V3(Math.cos(a) * cn.w / 2 * Math.max(.3, f), cn.y + Math.sin(a) * cn.h * f, z)); } return r; }), null, true));
  if (cn.framed) for (let k = 1; k < czs.length - 1; k++) mb.add(new THREE.TorusGeometry(cn.w / 2, .015, 4, 14, PI), 0x30331f, 0, cn.y, czs[k], 0, 0, 0, 1, cn.h * 2 / cn.w * .9, 1);
  if (!cn.bubble) mb.add(U.box, C.top, 0, cn.y + cn.h * .5, cn.z1 + .7, 0, 0, 0, .35, .4, 1.4);
  // elica
  let d;
  if (sp.glassNose) glass.addG(loftGeo([-L * .46, -L * .44, -L * .4, -L * .36].map((z, i) => superRing([.2, .9, 1.25, 1.4][i], [.2, .95, 1.4, 1.6][i], 0, 16, 2, 2, z)), null, true));
  if (sp.prop) { propSpinner(prop, sp.engine === 'radial' ? .38 : .3, sp.engine === 'radial' ? .55 : .75, nose ? C.nose : 0x1a1a1a); propBlades(prop, sp.prop.n, sp.prop.R, sp.prop.chord, sp.prop.tip); }
  // insegne
  const ins = sp.nation === 'uk' ? 'uk' : sp.nation, d2 = [];
  const fz = L * .12, fy = .05, fw = sp.nation === 'de' ? .7 : .85;
  d2.push([ins, fw * (sp.nation === 'us' ? 1.6 : 1), fw * (sp.nation === 'us' ? .8 : 1), sp.w * .52, fy, fz, 0, PI / 2], [ins, fw * (sp.nation === 'us' ? 1.6 : 1), fw * (sp.nation === 'us' ? .8 : 1), -sp.w * .52, fy, fz, 0, -PI / 2]);
  for (const sx of [-1, 1]) { const x = sx * half * .7; d2.push([ins, 1.1 * (sp.nation === 'us' ? 1.6 : 1), 1.1 * (sp.nation === 'us' ? .8 : 1), x, wy(x) + .12, le(x) + chord(x) * .45, -PI / 2, 0]); }
  d = { prop: sp.prop ? { z: propZ, R: sp.prop.R } : { z: 0, R: .1 }, props: sp.twin ? twinProps : sp.prop ? undefined : [], decals: [], decals2: d2, pilot: [0, cn.y + .3, (cn.z0 + cn.z1) / 2], eye: sp.eye, spec: sp };
  d.paint = mb.buildGroups(); d.glass = glass.build(); d.propG = prop.buildGroups();
  // carrello retrattile: gambe nelle ali, ruotino di coda
  d.gear = { x: half * .3, y: wy(half * .3) + .05, z: le(half * .3) + chord(half * .3) * .35, len: sp.h * 1.05, tailZ: tl.z + .4, fixed: !!sp.spats };
  return d;
}

// velocità massime storiche in volo livellato (km/h): la spinta di ogni aereo è tarata per raggiungerle a manetta piena col carrello retratto
const PLANE_VMAX = { p47: 690, p51: 703, f4u: 671, spit: 657, typhoon: 652, hurri: 518, bf109: 640, stuka: 400, me262: 870, mosquito: 610, ju88: 470, fw190: 655, b26: 460 };
function planeThrustK(SP, type) {
  if (SP._tk) return SP._tk;
  const V = (PLANE_VMAX[type] || 560) / 3.6, m = SP.mass, S = SP.S, q = .6 * V * V, Cl = m * 9.8 / (q * S), drag = q * S * (.024 + .065 * Cl * Cl);
  const base = (SP.jet ? 17000 : Math.min(32000, 1.6e6 / Math.max(V, 35))) * (m / 6000);
  return (SP._tk = drag / base);
}
