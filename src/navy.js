"use strict";
// ============================================================
//  Battaglie navali: navi con fisica di manovra, balistica esterna
//  dei proiettili (resistenza dell'aria per Mach e quota, gravità,
//  dispersione), perforazione delle corazze (De Marre), allagamenti,
//  incendi, siluri, IA con tiro aggiustato per salve, missioni.
//  Mare: una sola griglia polare che segue la camera, onde nel vertex
//  shader solo vicino, normali di dettaglio da texture lontano.
// ============================================================
const KN = .5144;
const NV = { secAuto: true, ships: [], shells: [], torps: [], me: null, cam: { yaw: 0, pitch: -.02, dist: 1 }, aim: new V3(), aimR: 0, lock: null, ammo: 'AP', mis: null, t: 0, tables: {}, el: null, ocean: null, islands: [], over: false, free: { wave: 0, t: 5 } };

// ---------- munizioni: calibro (mm), fattore di forma i (tarato sulle gittate massime storiche), velocità alla bocca (m/s), massa (kg), esplosivo (kg) ----------
const SHELL = {
  us50: { cal: 12.7, i: 0.93, v: 887, m: .046, he: 0, name: '.50 BMG' },
  us20: { cal: 20, i: 1.72, v: 835, m: .123, he: .011, name: '20 mm Oerlikon' },
  us127: { cal: 127, i: 1.37, v: 792, m: 25, he: 3.6, name: '5"/38 Mk 12' },
  us152: { cal: 152, i: 1.08, v: 762, m: 59, he: 3.0, name: '6"/47 Mk 16' },
  us356: { cal: 356, i: 1.05, v: 792, m: 635, he: 47, name: '14"/45 Mk 8' },
  us127b: { cal: 127, i: 1.27, v: 960, m: 22.7, he: 3.0, name: '5"/51 Mk 15' },
  us40: { cal: 40, i: 1.09, v: 881, m: .9, he: .068, name: '40 mm Bofors' },
  de88: { cal: 88, i: 1.2, v: 950, m: 9, he: .9, name: '8,8 cm SK C/32' },
  de37: { cal: 37, i: 1.46, v: 1000, m: .745, he: .04, name: '3,7 cm SK C/30' },
  jp2000: { cal: 2000, i: 1.0, v: 700, m: 146000, he: 6000, name: '2000 mm (sperimentale)' },
  us305: { cal: 305, i: 1.07, v: 762, m: 517, he: 18, name: '12"/50 Mk 8' },
  us600: { cal: 600, i: 1.0, v: 760, m: 3950, he: 160, name: '600 mm Mk 1 (sperimentale)' },
  de20: { cal: 20, i: 1.56, v: 900, m: .12, he: .015, name: '2 cm Flak 38' },
  de127: { cal: 127, i: 1.19, v: 830, m: 28, he: 3.4, name: '12,7 cm SK C/34' },
  de150: { cal: 150, i: 1.17, v: 960, m: 45.5, he: 3.9, name: '15 cm SK C/25' },
  de283: { cal: 283, i: 1.01, v: 890, m: 330, he: 16, name: '28 cm SK C/34' },
};
// ---------- classi navali ----------
// arc: 'fore' (non spara a poppa), 'aft' (non spara a prua), 'side' (solo sui fianchi), 'all'
const NCLS = {
  elco: { name: 'PT boat Elco 80 ft', nat: 'us', type: 'pt', L: 24.4, B: 6.3, D: 1.5, F: 2.2, vmax: 41, tau: 6, R: 55, rud: 1.4, hp: 380, belt: 0, deck: 0, ends: 0, hull: 0x5d6b5a,
    guns: [{ s: 'us50', reload: .12, trav: 1.6, elev: 1.2, disp: 5, mounts: [[-1.8, 2.7, -3, 'all', 2], [1.8, 2.7, -3, 'all', 2]] }, { s: 'us20', reload: .14, trav: 1.4, elev: 1.2, disp: 4, mounts: [[0, 2.6, 9, 'aft', 1]] }],
    torps: { n: 4, kn: 33.5, range: 5700, dmg: 1100, salvo: 2, arc: 'bow', mounts: [[-2.4, 1.6, 2], [2.4, 1.6, 2]] } },
  fletcher: { name: 'Cacciatorpediniere classe Fletcher', nat: 'us', type: 'dd', L: 114.7, B: 12, D: 4.2, F: 7, vmax: 36.5, tau: 24, R: 330, rud: .4, hp: 1800, belt: 13, deck: 13, ends: 0, hull: 0x6b737a,
    guns: [{ s: 'us127', reload: 4, trav: .44, elev: 1.48, disp: 1.3, mounts: [[0, 9, -40, 'fore', 1], [0, 11.5, -31, 'fore', 1], [0, 11.5, 26, 'aft', 1], [0, 9, 35, 'aft', 1], [0, 9, 44, 'aft', 1]] },
      { s: 'us40', sec: true, reload: .5, trav: 1, elev: 1.5, disp: 2.5, mounts: [[-4.5, 10, 8, 'port', 2], [4.5, 10, 8, 'stbd', 2], [0, 10, 16, 'aft', 2]] }],
    torps: { n: 10, kn: 45, range: 5500, dmg: 1500, salvo: 5, arc: 'side', mounts: [[0, 8, -2], [0, 8, 12]] } },
  cleveland: { name: 'Incrociatore leggero classe Cleveland', nat: 'us', type: 'cl', L: 186, B: 20.2, D: 7.5, F: 9, vmax: 32.5, tau: 40, R: 440, rud: .28, hp: 4500, belt: 127, deck: 51, ends: 25, hull: 0x666e73,
    guns: [{ s: 'us152', reload: 7, trav: .17, elev: .82, disp: 1.1, n: 3, mounts: [[0, 11, -58, 'fore', 3], [0, 14, -46, 'fore', 3], [0, 14, 46, 'aft', 3], [0, 11, 58, 'aft', 3]] },
      { s: 'us127', sec: true, reload: 4, trav: .44, elev: 1.48, disp: 1.4, mounts: [[-7.5, 14, -22, 'port', 2], [7.5, 14, -22, 'stbd', 2], [-7.5, 14, 22, 'port', 2], [7.5, 14, 22, 'stbd', 2], [0, 17, -34, 'fore', 2], [0, 17, 34, 'aft', 2]] }] },
  texas: { name: 'Corazzata USS Texas (classe New York)', nat: 'us', type: 'bb', L: 174, B: 29, D: 8.7, F: 8.5, vmax: 21, tau: 70, R: 560, rud: .2, hp: 11000, belt: 305, deck: 76, ends: 64, hull: 0x6a7176,
    guns: [{ s: 'us356', reload: 35, trav: .07, elev: .26, disp: .8, mounts: [[0, 11, -60, 'fore', 2], [0, 14, -47, 'fore', 2], [0, 11.5, 2, 'side', 2], [0, 14, 42, 'aft', 2], [0, 11, 55, 'aft', 2]] },
      { s: 'us127b', sec: true, reload: 6, trav: .3, elev: .35, disp: 1.6, mounts: [[-13.6, 6.5, -26, 'port', 1], [13.6, 6.5, -26, 'stbd', 1], [-13.6, 6.5, -14, 'port', 1], [13.6, 6.5, -14, 'stbd', 1], [-13.6, 6.5, 16, 'port', 1], [13.6, 6.5, 16, 'stbd', 1]] }] },
  maine: { weather: 'sereno', name: 'Super corazzata USS Maine', nat: 'us', type: 'bb', style: 'modern', L: 300, B: 40, D: 11, F: 12, vmax: 30, tau: 85, R: 750, rud: .16, hp: 24000, belt: 460, deck: 210, ends: 120, hull: 0x6a7176,
    guns: [{ s: 'us600', reload: 55, trav: .05, elev: .7, disp: .85, mounts: [[0, 15, -95, 'fore', 4], [0, 21, -74, 'fore', 4], [0, 21, 70, 'aft', 4], [0, 15, 91, 'aft', 4]] },
      { s: 'us305', sec: true, reload: 20, trav: .12, elev: .6, disp: 1, mounts: [[-15, 19, -36, 'port', 2], [15, 19, -36, 'stbd', 2], [-16, 19, 0, 'port', 2], [16, 19, 0, 'stbd', 2], [-15, 19, 36, 'port', 2], [15, 19, 36, 'stbd', 2]] }] },
  satsuma: { name: 'Super corazzata Satsuma', nat: 'jp', type: 'bb', style: 'pagoda', L: 400, B: 56, D: 14, F: 15, vmax: 27, tau: 100, R: 950, rud: .14, hp: 60000, belt: 650, deck: 300, ends: 200, hull: 0x7a7e82,
    guns: [{ s: 'jp2000', reload: 10, trav: .06, elev: .6, disp: .05, mounts: [[0, 20, -142, 'fore', 2], [0, 30, -104, 'fore', 2], [0, 30, 100, 'aft', 2], [0, 20, 138, 'aft', 2]] },
      { s: 'us305', sec: true, reload: 20, trav: .12, elev: .6, disp: 1, mounts: [[-21, 23, -50, 'port', 2], [21, 23, -50, 'stbd', 2], [-23, 23, 0, 'port', 2], [23, 23, 0, 'stbd', 2], [-21, 23, 50, 'port', 2], [21, 23, 50, 'stbd', 2]] }] },
  akagi: { name: 'Portaerei Akagi', nat: 'jp', type: 'cv', L: 260, B: 31, D: 8.7, F: 14, vmax: 31, tau: 60, R: 650, rud: .2, hp: 8500, belt: 152, deck: 79, ends: 40, hull: 0x7a7e82,
    guns: [{ s: 'us127', sec: true, reload: 4, trav: .4, elev: 1.4, disp: 1.6, mounts: [[-15, 12, -70, 'port', 2], [15, 12, -70, 'stbd', 2], [-15, 12, 60, 'port', 2], [15, 12, 60, 'stbd', 2]] }] },
  kaga: { name: 'Portaerei Kaga', nat: 'jp', type: 'cv', L: 248, B: 32, D: 9.5, F: 13, vmax: 28, tau: 60, R: 640, rud: .2, hp: 8800, belt: 152, deck: 38, ends: 40, hull: 0x7a7e82,
    guns: [{ s: 'us127', sec: true, reload: 4, trav: .4, elev: 1.4, disp: 1.6, mounts: [[-16, 12, -60, 'port', 2], [16, 12, -60, 'stbd', 2], [-16, 12, 50, 'port', 2], [16, 12, 50, 'stbd', 2]] }] },
  soryu: { name: 'Portaerei Soryu', nat: 'jp', type: 'cv', L: 227, B: 21, D: 7.6, F: 12, vmax: 34, tau: 50, R: 560, rud: .22, hp: 6000, belt: 41, deck: 25, ends: 20, hull: 0x7a7e82,
    guns: [{ s: 'us127', sec: true, reload: 4, trav: .4, elev: 1.4, disp: 1.6, mounts: [[-11, 11, -50, 'port', 2], [11, 11, -50, 'stbd', 2]] }] },
  z1934: { name: 'Zerstörer 1934', nat: 'de', type: 'dd', L: 119, B: 11.3, D: 4, F: 7, vmax: 36, tau: 24, R: 340, rud: .4, hp: 1900, belt: 0, deck: 0, ends: 0, hull: 0x7b8086,
    guns: [{ s: 'de127', reload: 4.5, trav: .4, elev: .52, disp: 1.4, mounts: [[0, 9, -42, 'fore', 1], [0, 11.5, -33, 'fore', 1], [0, 11.5, 28, 'aft', 1], [0, 9, 37, 'aft', 1], [0, 9, 46, 'aft', 1]] },
      { s: 'de37', sec: true, reload: .8, trav: 1, elev: 1.4, disp: 2.5, mounts: [[-4, 10, 10, 'port', 2], [4, 10, 10, 'stbd', 2]] }],
    torps: { n: 8, kn: 44, range: 6000, dmg: 1450, salvo: 4, arc: 'side', mounts: [[0, 8, -4], [0, 8, 10]] } },
  nurnberg: { name: 'Incrociatore leggero Nürnberg', nat: 'de', type: 'cl', L: 181, B: 16.4, D: 5.6, F: 9, vmax: 32, tau: 40, R: 450, rud: .28, hp: 4000, belt: 50, deck: 25, ends: 18, hull: 0x7d8288,
    guns: [{ s: 'de150', reload: 8, trav: .14, elev: .7, disp: 1.1, mounts: [[0, 11, -56, 'fore', 3], [0, 14, 46, 'aft', 3], [0, 11, 58, 'aft', 3]] },
      { s: 'de88', sec: true, reload: 3.5, trav: .5, elev: 1.4, disp: 1.6, mounts: [[-6.5, 13, 2, 'port', 2], [6.5, 13, 2, 'stbd', 2], [-6.5, 13, 18, 'port', 2], [6.5, 13, 18, 'stbd', 2]] }] },
  scharnhorst: { name: 'Corazzata Scharnhorst', nat: 'de', type: 'bb', L: 235, B: 30, D: 9.7, F: 10, vmax: 31, tau: 70, R: 620, rud: .2, hp: 12500, belt: 350, deck: 105, ends: 70, hull: 0x7a7f84,
    guns: [{ s: 'de283', reload: 17, trav: .1, elev: .7, disp: .9, mounts: [[0, 13, -72, 'fore', 3], [0, 16.5, -58, 'fore', 3], [0, 13, 70, 'aft', 3]] },
      { s: 'de150', sec: true, reload: 9, trav: .15, elev: .7, disp: 1.3, mounts: [[-11, 13.5, -30, 'port', 2], [11, 13.5, -30, 'stbd', 2], [-11, 13.5, 30, 'port', 2], [11, 13.5, 30, 'stbd', 2]] }] },
  sboot: { name: 'Schnellboot S-100', nat: 'de', type: 'pt', L: 35, B: 5.3, D: 1.7, F: 2.6, vmax: 43.6, tau: 7, R: 70, rud: 1.2, hp: 420, belt: 0, deck: 0, ends: 0, hull: 0x8a9096,
    guns: [{ s: 'de20', reload: .13, trav: 1.4, elev: 1.2, disp: 5, mounts: [[0, 3.2, -10, 'all', 1], [0, 3.2, 10, 'aft', 1]] }],
    torps: { n: 2, kn: 40, range: 7500, dmg: 1450, salvo: 2, arc: 'bow', mounts: [[-1.8, 1.8, -8], [1.8, 1.8, -8]] } },
  cargo: { name: 'Mercantile', nat: 'x', type: 'cargo', L: 130, B: 17, D: 7.5, F: 7, vmax: 11, tau: 60, R: 500, rud: .2, hp: 2800, belt: 0, deck: 0, ends: 0, hull: 0x4f4a44, guns: [] },
};

// ---------- balistica esterna ----------
NCLS.kirishima = Object.assign({}, NCLS.texas, { name: 'Corazzata Kirishima', nat: 'jp', style: 'pagoda', vmax: 30, hp: 10500, belt: 203, deck: 70 });
NCLS.kagero = Object.assign({}, NCLS.z1934, { name: 'Cacciatorpediniere Kagero', nat: 'jp', vmax: 35 });
const RHO0 = 1.225;
// coefficiente di resistenza in funzione del numero di Mach (proiettile navale con ogiva lunga)
function cdMach(M) { if (M < .8) return .14; if (M < 1) return .14 + (M - .8) / .2 * .24; if (M < 1.2) return .38; return Math.max(.2, .38 - (M - 1.2) * .1); }
function shellK(S, v, y) { const A = PI * (S.cal / 2000) ** 2, rho = RHO0 * Math.exp(-Math.max(0, y) / 8400); return .5 * rho * cdMach(v / 340) * S.i * A / S.m; }
// un passo (punto medio) di gravità + resistenza
function shellStep(S, p, v, dt) {
  const s0 = v.length(), k0 = shellK(S, s0, p.y);
  const mx = v.x - k0 * s0 * v.x * dt / 2, my = v.y + (-9.81 - k0 * s0 * v.y) * dt / 2, mz = v.z - k0 * s0 * v.z * dt / 2;
  const sm = Math.hypot(mx, my, mz), k1 = shellK(S, sm, p.y + v.y * dt / 2);
  p.x += mx * dt; p.y += my * dt; p.z += mz * dt;
  v.x -= k1 * sm * mx * dt; v.y += (-9.81 - k1 * sm * my) * dt; v.z -= k1 * sm * mz * dt;
}
// tavola di tiro: per ogni alzo, gittata, tempo di volo, velocità e angolo di caduta (bocca a 12 m sull'acqua)
function firingTable(key, elevMax) {
  const id = key + ':' + elevMax.toFixed(3); if (NV.tables[id]) return NV.tables[id];
  const S = SHELL[key], T = [], p = new V3(), v = new V3();
  for (let e = 0; e <= elevMax + 1e-6; e += .0025) {
    // bocca a ~10 m sull'acqua, stesso passo d'integrazione dei proiettili in gioco; il punto di caduta è interpolato all'attraversamento del pelo dell'acqua
    p.set(0, 10, 0); v.set(0, Math.sin(e) * S.v, Math.cos(e) * S.v); let t = 0, py = 10, pz = 0;
    const dt = .0167;
    while (p.y > WATER_Y && t < 400) { py = p.y; pz = p.z; shellStep(S, p, v, dt); t += dt; }
    const u = (py - WATER_Y) / Math.max(1e-6, py - p.y), rz = lerp(pz, p.z, u), tt = t - dt * (1 - u);
    T.push({ e, r: rz, t: tt, vi: v.length(), fall: Math.atan2(-v.y, v.z) });
    if (T.length > 2 && rz < T[T.length - 2].r) break;  // oltre la gittata massima
  }
  return (NV.tables[id] = T);
}
// alzo per una gittata orizzontale data (o null se fuori portata)
function solveElev(T, r) {
  if (r <= T[0].r) return { e: 0, t: T[0].t * r / Math.max(1, T[0].r) };
  for (let i = 1; i < T.length; i++) if (T[i].r >= r) { const a = T[i - 1], b = T[i], u = (r - a.r) / (b.r - a.r); return { e: lerp(a.e, b.e, u), t: lerp(a.t, b.t, u) }; }
  return null;
}
const tableMax = T => T[T.length - 1].r;
// perforazione De Marre (mm) per proiettile perforante
function penDeMarre(S, v) { return 1000 * (Math.pow(v, 1.43) * Math.pow(S.m, .71)) / (Math.pow(2400, 1.43) * Math.pow(S.cal / 100, 1.07)) / 10; }

// ---------- mare ----------
const WAVES = [[.82, .57, .55, 74, .55], [-.34, .94, .32, 35, .32], [.96, -.28, .16, 16, .16]];   // dx, dz, ampiezza, lunghezza, ampiezza base
function seaH(x, z, t) { let h = 0; for (const [dx, dz, A, L] of WAVES) { const k = TAU / L; h += A * Math.sin(k * (dx * x + dz * z) - Math.sqrt(9.81 * k) * t); } return WATER_Y + h; }
function buildOcean() {
  const rs = [0]; let r = 0, st = 2.5; while (r < 26000) { r += st; st *= 1.045; rs.push(r); }
  const seg = 128, pos = [], idx = [];
  for (let i = 0; i < rs.length; i++) for (let j = 0; j < seg; j++) { const a = j / seg * TAU; pos.push(Math.cos(a) * rs[i], 0, Math.sin(a) * rs[i]); }
  for (let i = 0; i < rs.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const nt = TEX.water.normal; nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
  const W = WAVES.map(w => new THREE.Vector4(w[0], w[1], w[2], w[3]));
  const m = new THREE.ShaderMaterial({
    uniforms: { uZoom: { value: 1 }, uT: { value: 0 }, uN: { value: nt }, uW: { value: W }, uSun: { value: new V3(.4, .6, -.6).normalize() }, uFog: { value: FOG_COL }, uFogD: { value: .0001 }, uSky: { value: new THREE.Color(0x8c99a2) }, uDeep: { value: new THREE.Color(0x0f1d23) } },
    vertexShader: `uniform float uT; uniform vec4 uW[3]; varying vec3 vW; varying vec3 vN; varying float vF; varying float vH;
      void main(){ vec4 w = modelMatrix * vec4(position,1.); float d = length(w.xz - cameraPosition.xz); float f = 1. - smoothstep(500., 2600., d); vF = f;
        float h = 0.; vec2 g = vec2(0.);
        for (int i=0;i<3;i++){ float k = 6.2831853/uW[i].w; float ph = k*dot(uW[i].xy, w.xz) - sqrt(9.81*k)*uT; h += uW[i].z*sin(ph); g += uW[i].z*k*cos(ph)*uW[i].xy; }
        w.y += h*f; vH = h; vN = normalize(vec3(-g.x*f, 1., -g.y*f)); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uFogD, uZoom; uniform sampler2D uN; uniform vec3 uSun, uFog, uSky, uDeep; varying vec3 vW; varying vec3 vN; varying float vF; varying float vH;
      void main(){ vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        // il dettaglio dipende da quanto è grande un pixel (distanza diviso ingrandimento): col binocolo le increspature lontane restano
        float pd = dist / uZoom, df = 1. - smoothstep(250., 3500., pd), dn = 1. - smoothstep(60., 600., pd);
        vec2 a = texture2D(uN, vW.xz/38. + vec2(uT*.012, uT*.007)).xy*2.-1.;
        vec2 b = texture2D(uN, vW.xz/11. - vec2(uT*.02, -uT*.013)).xy*2.-1.;
        vec2 c3 = texture2D(uN, vW.xz/3.7 + vec2(-uT*.035, uT*.028)).xy*2.-1.;          // increspature fini, solo vicino o al binocolo
        vec2 big = texture2D(uN, vW.xz/260. + vec2(uT*.002, -uT*.0015)).xy*2.-1.;       // onda lunga di fondo: rompe l'uniformità anche da lontano
        vec3 N = normalize(vN + vec3(a.x + b.x*.6 + c3.x*.4*dn + big.x*.5, 0., a.y + b.y*.6 + c3.y*.4*dn + big.y*.5) * (.22 + .4*df));
        float fr = .02 + .98*pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); vec3 sky = mix(uFog, uSky, clamp(R.y*2.5, 0., 1.));
        // colore dell'acqua che varia a chiazze (correnti, profondità) e si schiarisce sulle creste
        float patchy = texture2D(uN, vW.xz/900.).x;
        vec3 deep = mix(uDeep, uDeep * vec3(1.25, 1.45, 1.4), patchy * .8) + vec3(.02, .05, .05) * clamp(vH * .6, 0., 1.) * vF;
        vec3 c = mix(deep, sky, fr * .7);
        // riflesso del sole: lama stretta più un bagliore largo
        float sd = max(dot(R, uSun), 0.);
        c += vec3(1., .95, .85) * (pow(sd, 420.) * 1.6 + pow(sd, 40.) * .08) * (.35 + .65*df);
        // creste di schiuma sparse dove le increspature si sommano
        float fm = smoothstep(.62, .95, (a.x*.5+.5)*.55 + (b.y*.5+.5)*.45 + clamp(vH*.25, 0., .2)) * (.25 + .75*df);
        c = mix(c, vec3(.82, .86, .88), fm * .55);
        float fh = mix(1., .32, smoothstep(8., 320., .5*(cameraPosition.y + vW.y))); float fd = uFogD*fh;
        c = mix(c, uFog, 1. - exp(-fd*fd*dist*dist));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = -1; scene.add(o); NV.ocean = o;
}
function updateOcean(t) {
  const o = NV.ocean; if (!o) return;
  o.position.set(Math.round(camera.position.x / 8) * 8, WATER_Y, Math.round(camera.position.z / 8) * 8);
  o.material.uniforms.uT.value = t; o.material.uniforms.uFogD.value = scene.fog.density; o.material.uniforms.uZoom.value = Math.max(1, SETTINGS.fov / camera.fov);
  if (typeof sun !== 'undefined' && sun) o.material.uniforms.uSun.value.copy(sun.position).normalize();
}

// ---------- isole ----------
function navyH(x, z) {
  let h = -80;
  for (const I of NV.islands) { const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d < 1.3) { if (I.flat) { h = Math.max(h, d < .92 ? I.h : I.h - (d - .92) * 60); continue; } const n = fbm(x * .006 + I.x, z * .006, 3); h = Math.max(h, I.h * (1 - d * d) + (n - .5) * I.h * .5 - 6 * smooth((d - .8) / .5)); } }
  return h;
}
function buildIsland(I) {
  const n = 70, S = I.r * 2.7, pos = [], col = [], idx = [], c = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = I.x - S / 2 + i / (n - 1) * S, z = I.z - S / 2 + j / (n - 1) * S, y = Math.max(navyH(x, z), -20);
    pos.push(x, y, z);
    // colori per quota vera: battigia, prati, macchia in collina, roccia in cima; variazioni a chiazze
    const v = fbm(x * .004 + 3, z * .004, 3), e = fbm(x * .02, z * .02, 2);
    c.set(y < 1.6 ? 0xc2b48a : I.flat ? (e > .55 ? 0x6b7d4c : 0x5e7a44) : y < 45 ? (v > .55 ? 0x4c6a32 : 0x5a7a3a) : y < 130 ? (v > .5 ? 0x3a5428 : 0x45602e) : (e > .5 ? 0x6f6656 : 0x5d5848));
    c.convertSRGBToLinear(); col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT.vc); m.receiveShadow = true; scene.add(m);
}

// ---------- modello della nave ----------
function hullGeo(C) {
  const L = C.L, B = C.B, D = C.D, F = C.F, N = 26, pos = [], col = [], idx = [];
  const hw = t => B / 2 * (t < .3 ? Math.pow(Math.max(t, .002) / .3, .55) : t > .82 ? 1 - ((t - .82) / .18) ** 2 * .3 : 1);
  const sheer = t => F + (t < .25 ? (1 - t / .25) * F * .35 : 0);
  const prof = t => [[hw(t), sheer(t), 1], [hw(t) * .99, .1, 1], [hw(t) * .97, -.1, 0], [hw(t) * .82, -D * .75, 0], [0, -D, 0]];
  const cA = new THREE.Color(C.hull).convertSRGBToLinear(), cB = new THREE.Color(0x5a2420).convertSRGBToLinear(), cDk = new THREE.Color(0x45484a).convertSRGBToLinear();
  const vtx = (x, y, z, c) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  for (const sd of [-1, 1]) {
    const rows = [];
    for (let k = 0; k <= N; k++) { const t = k / N, z = -L / 2 + t * L; rows.push(prof(t).map(([w, y, up]) => vtx(sd * w, y, z, up ? cA : cB))); }
    for (let k = 0; k < N; k++) for (let s = 0; s < 4; s++) { const a = rows[k][s], b = rows[k][s + 1], c2 = rows[k + 1][s], d = rows[k + 1][s + 1]; if (sd < 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2); }
  }
  // ponte
  const dk = [];
  for (let k = 0; k <= N; k++) { const t = k / N, z = -L / 2 + t * L; dk.push([vtx(-hw(t), sheer(t), z, cDk), vtx(hw(t), sheer(t), z, cDk)]); }
  for (let k = 0; k < N; k++) idx.push(dk[k][0], dk[k][1], dk[k + 1][0], dk[k][1], dk[k + 1][1], dk[k + 1][0]);
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }  // facce verso l'esterno
  // specchio di poppa
  const tl = prof(1), base = pos.length / 3; for (const [w, y] of tl) vtx(-w, y, L / 2, cA); for (const [w, y] of tl) vtx(w, y, L / 2, cA);
  for (let s = 0; s < 4; s++) idx.push(base + s, base + s + 1, base + 5 + s, base + s + 1, base + 6 + s, base + 5 + s);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function buildShipModel(C) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.add(new THREE.Mesh(hullGeo(C), MAT.vcMetal || MAT.vc));
  const mb = new MB(), c = C.hull, dk = 0x55595c, L = C.L, B = C.B, F = C.F;
  if (C.type === 'cargo') {
    mb.add(U.box, 0x6a5f52, 0, F + 5, L * .18, 0, 0, 0, B * .7, 10, L * .16); mb.add(U.cyl12, 0x2a2622, 0, F + 13, L * .18, 0, 0, 0, 2.2, 9, 2.2);
    for (const z of [-L * .3, -L * .08, L * .36]) { mb.add(U.box, 0x5c544a, 0, F + 1.2, z, 0, 0, 0, B * .6, 2.4, L * .12); mb.add(U.cyl, 0x3b3631, 0, F + 8, z - L * .07, 0, 0, 0, .3, 16, .3); }
  } else if (C.type === 'pt') {
    mb.add(U.box, c, 0, F + .9, -L * .12, 0, 0, 0, B * .45, 1.8, L * .22); mb.add(U.box, 0x3a3f42, 0, F + 1.9, -L * .17, 0, 0, 0, B * .35, .5, L * .08);
    mb.add(U.cyl, 0x3a3f42, 0, F + 3.4, -L * .1, 0, 0, 0, .1, 4, .1);
  } else {
    // sovrastrutture: plancia, fumaioli, alberi; più grandi per incrociatori e corazzate
    const big = C.type === 'bb' || C.type === 'cl';
    mb.add(U.box, c, 0, F + (big ? 5 : 3), -L * .17, 0, 0, 0, B * .5, big ? 10 : 6, L * .1);
    mb.add(U.box, c, 0, F + (big ? 12 : 7.5), -L * .18, 0, 0, 0, B * .36, big ? 5 : 3, L * .06);
    mb.add(U.cyl, 0x3a3e40, 0, F + (big ? 24 : 15), -L * .16, 0, 0, 0, .35, big ? 26 : 16, .35);
    mb.add(U.box, c, 0, F + 2.5, L * .02, 0, 0, 0, B * .42, 5, L * .22);
    const fz = C.type === 'bb' ? [-.04] : big ? [-.05, .06] : [-.07, .05];
    for (const z of fz) mb.add(U.cyl12, 0x4a4e52, 0, F + (big ? 11 : 8), L * z, 0, 0, 0, big ? B * .14 : B * .17, big ? 12 : 8, big ? B * .18 : B * .2);
    mb.add(U.cyl, 0x3a3e40, 0, F + (big ? 18 : 12), L * .22, 0, 0, 0, .3, big ? 18 : 12, .3);
  }
  const grp = groupMesh(mb.buildGroups(), true); body.add(grp);
  // torri e cannoni
  const turrets = [];
  for (const G of C.guns) for (const [x, y, z, arc, n] of G.mounts) {
    const S = SHELL[G.s], tg = new THREE.Group(); tg.position.set(x, y, z); body.add(tg);
    const sz = S.cal >= 300 ? 1 : S.cal >= 150 ? .7 : S.cal >= 100 ? .5 : .22, tm = new MB();
    if (S.cal >= 100) { tm.add(U.cyl12, c, 0, -1.2 * sz, 0, 0, 0, 0, 4.5 * sz, 2.4 * sz, 4.5 * sz); tm.add(U.box, c, 0, .2 * sz, .6 * sz, 0, 0, 0, 7.5 * sz, 3.2 * sz, 8.5 * sz); }
    else tm.add(U.cyl12, 0x3e4245, 0, -.4, 0, 0, 0, 0, .6, .8, .6);
    tg.add(groupMesh(tm.buildGroups(), true));
    const pv = new THREE.Group(); pv.position.set(0, S.cal >= 100 ? .4 * sz : .2, S.cal >= 100 ? -2.6 * sz : 0); tg.add(pv);
    const bl = new MB(), len = S.cal >= 100 ? S.cal / 1000 * 45 : S.cal > 15 ? 2.2 : 1.4, muzzles = [];
    for (let i = 0; i < n; i++) { const xo = (i - (n - 1) / 2) * Math.max(.3, S.cal / 1000 * 4.5); bl.add(U.cyl, 0x2b2e30, xo, 0, -len / 2, PI / 2, 0, 0, Math.max(.05, S.cal / 2000 * 1.6), len, Math.max(.05, S.cal / 2000 * 1.6)); muzzles.push(new V3(xo, 0, -len)); }
    pv.add(groupMesh(bl.buildGroups(), false));
    turrets.push({ sec: !!G.sec, G, S, key: G.s, g: tg, pv, muzzles, arc, x, y, z, rel: arc === 'aft' ? PI : arc === 'port' ? PI / 2 : arc === 'stbd' ? -PI / 2 : 0, el: 0, reload: rnd(0, G.reload), ok: true, fixT: 0, T: firingTable(G.s, G.elev) });
  }
  return { g, body, turrets };
}

// ---------- nave ----------
class NavShip {
  constructor(cls, team, x, z, yaw, o = {}) {
    const C = NCLS[cls]; this.C = C; this.cls = cls; this.team = team; this.name = o.name || C.name;
    const M = (typeof buildShipModel2 === 'function' ? buildShipModel2 : buildShipModel)(C); this.g = M.g; this.body = M.body; this.turrets = M.turrets; this.hd = M.hd; this.mats = M.mats || []; this.marks = []; scene.add(this.g);
    this.pos = new V3(x, WATER_Y, z); this.yaw = yaw; this.spd = (o.spd ?? (o.ai === false ? .9 : .6)) * C.vmax * KN; this.vel = new V3(); this.yawRate = 0;
    this.tele = o.tele ?? (o.ai === false ? 4 : 3); this.rud = 0; this.rudCmd = 0; this.hp = C.hp; this.hpMax = C.hp; this.alive = true; this.sinking = 0;
    this.flood = 0; this.leak = 0; this.fires = []; this.mod = { eng: 1, steer: 1 }; this.dcT = 0; this.dcCool = 0;
    this.torpN = C.torps ? C.torps.n : 0; this.torpT = 0; this.roll = 0; this.pitch = 0; this.list = 0; this.ai = o.ai !== false; this.role = o.role || C.type;
    this.fc = { tgt: null, err: new V3(), sal: 0 }; this.zig = rnd(0, 30); this.zigS = R() < .5 ? -1 : 1; this.route = o.route || null; this.wake = 0; this.tag = o.tag || '';
    NV.ships.push(this);
  }
  get fwd() { return _nvf.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  // dal sistema della nave al mondo (solo rotta, per i colpi)
  toWorld(lx, ly, lz, out = new V3()) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return out.set(this.pos.x + lx * c + lz * s, this.pos.y + ly, this.pos.z - lx * s + lz * c); }
  toLocal(p, out = new V3()) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw), dx = p.x - this.pos.x, dz = p.z - this.pos.z; return out.set(dx * c - dz * s, p.y - this.pos.y, dx * s + dz * c); }
  update(dt, t) {
    const C = this.C;
    if (this.moored && !this.sinking) { this.spd = 0; this.tele = 0; this.rud = this.rudCmd = 0; }
    this.fxDamage(dt);
    if (this.sinking > 0) { this.sinking += dt; this.spd *= Math.exp(-.3 * dt); this.list = Math.min(this.list + dt * .025 * (this.listS || 1), .9); this.pitch += dt * .004 * (this.trimS || 1); this.pos.y -= dt * (this.blown ? 1.6 : .45); this.pos.addScaledVector(this.fwd, this.spd * dt); this.pose(t); if (this.pos.y < -C.F - C.L * .15 - 30) this.remove(); return; }
    // macchine: velocità verso quella del telegrafo con la costante di tempo della classe; in virata stretta si perde velocità
    const vmax = C.vmax * KN * (this.mod.eng < .5 ? .35 : 1) * (1 - this.flood * .45);
    // in virata la resistenza dello scafo di traverso abbassa la velocità di regime: fino al 30% col timone tutto alla banda (12% per le motosiluranti)
    const turnLoss = 1 - Math.abs(this.rud) * (C.type === 'pt' ? .12 : .3);
    const want = (this.tele >= 0 ? vmax * this.tele / 4 : -vmax * .3 * -this.tele) * turnLoss;
    this.spd += (want - this.spd) * dt / (want < this.spd ? C.tau * .6 : C.tau);
    // timone: si muove alla sua velocità; bloccato se l'agghiaccio è danneggiato
    if (this.mod.steer > .5) this.rud += clamp(this.rudCmd - this.rud, -C.rud * dt, C.rud * dt);
    const yr = this.rud * this.spd / C.R; this.yawRate += (yr - this.yawRate) * Math.min(1, dt / (1 + C.L / 60));
    this.yaw -= this.yawRate * dt;
    this.vel.copy(this.fwd).multiplyScalar(this.spd); this.pos.addScaledVector(this.vel, dt);
    // fondali delle isole: incaglio
    const ahead = this.toWorld(0, 0, -C.L / 2, _nvt);
    if (!this.moored && navyH(ahead.x, ahead.z) > -C.D) { this.spd *= -.2; this.pos.addScaledVector(this.fwd, -2); if ((!this.grT || t - this.grT > 2) && Math.abs(this.spd) > 3) { this.grT = t; this.damage(C.hp * .015 * Math.min(2, Math.abs(this.spd) / 8), null, 'grounding'); if (this === NV.me) showMsg('Incaglio! Macchine indietro', 2); } }
    // allagamento e incendi
    if (this.leak > 0) { this.flood = Math.min(1, this.flood + this.leak * dt); if (this.flood >= 1) this.sink('allagata'); }
    for (const f of this.fires) { f.t -= dt; this.damage(this.hpMax * .0007 * dt, null, 'fire'); if (f.t <= 0) f.e.life = f.s.life = 0; }
    this.fires = this.fires.filter(f => f.t > 0);
    // riparazioni in corso
    if (this.dcT > 0) { this.dcT -= dt; this.leak = Math.max(0, this.leak - dt * .004); this.flood = Math.max(0, this.flood - dt * .01); if (this.dcT <= 0) { for (const f of this.fires) { f.t = 0; f.e.life = f.s.life = 0; } this.fires = []; this.mod.eng = Math.max(this.mod.eng, .8); this.mod.steer = 1; for (const tu of this.turrets) tu.ok = true; if (this === NV.me) showMsg('Squadre di soccorso: danni riparati', 2); } }
    this.dcCool = Math.max(0, this.dcCool - dt);
    for (const tu of this.turrets) {
      if (!tu.ok && tu.fixT > 0) { tu.fixT -= dt; if (tu.fixT <= 0) tu.ok = true; }
      if (!tu.ok) tu.el = Math.max(-.07, tu.el - dt * .15);
      if (tu.ok !== tu.vis) { tu.vis = tu.ok; tu.g.traverse(o => { if (o.isMesh) { if (!tu.ok) { o.userData.m0 = o.userData.m0 || o.material; o.material = NAVY_BURNT(); } else if (o.userData.m0) o.material = o.userData.m0; } }); }
    }
    this.list = lerp(this.list, (this.listS || 0) * this.flood * .25, dt * .2);
    this.pose(t); this.stabilize();
    // scia: schiuma a prua e a poppa proporzionale alla velocità
    this.wake -= dt; const sp = Math.abs(this.spd);
    if (this.wake <= 0 && sp > 2 && dist2Cam(this.pos) < (NV.zoomOn || P.adsHeld ? 22000 : 6000) ** 2) {
      this.wake = C.type === 'pt' ? .05 : .09; const k = sp / (C.vmax * KN);
      const st = this.toWorld(0, 0, C.L * .48, _nvt), bw = this.toWorld(0, 0, -C.L * .47, _nvu), f = this.fwd;
      PS_WAKE.emit(st.x + rnd(-1, 1), WATER_Y + .2, st.z + rnd(-1, 1), -f.x * 2 + rnd(-1, 1), .05, -f.z * 2 + rnd(-1, 1), rnd(6, 10) * (C.L > 100 ? 1.6 : 1), C.B * .3, C.B * (1 + k), .55 * k + .1, .92, .95, .97, .3, 0);
      for (const sd of [-1, 1]) { const r = _nvr.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(sd); PS_WAKE.emit(bw.x, WATER_Y + .3, bw.z, r.x * sp * .25, .1, r.z * sp * .25, rnd(3, 5), C.B * .15, C.B * .6 * k, .5 * k, .95, .97, .98, .6, 0); }
    }
  }
  pose(t) {
    const C = this.C, L = C.L, B = C.B;
    // beccheggio e rollio dalle onde campionate a prua, poppa e fianchi (le navi lunghe le sentono meno)
    const hb = seaH(this.pos.x + this.fwd.x * L * .4, this.pos.z + this.fwd.z * L * .4, t), hs = seaH(this.pos.x - this.fwd.x * L * .4, this.pos.z - this.fwd.z * L * .4, t);
    const rx = Math.cos(this.yaw) * B * .5, rz = -Math.sin(this.yaw) * B * .5, hl = seaH(this.pos.x - rx, this.pos.z - rz, t), hr = seaH(this.pos.x + rx, this.pos.z + rz, t);
    const wy = (hb + hs + hl + hr) / 4, heel = this.yawRate * this.spd * .012;
    if (!this.sinking) this.pos.y = lerp(this.pos.y, wy - this.flood * C.D * .5, .2);
    const pitch = Math.atan2(hb - hs, L * .8) * .8 + this.pitch, roll = Math.atan2(hr - hl, B) * .5 + heel + this.list;
    this.g.position.copy(this.pos); this.g.rotation.set(0, this.yaw, 0); this.body.rotation.set(pitch, 0, roll, 'YXZ');
  }
  damage(a, by, kind) {
    if (this.sinking || !this.alive) return;
    this.hp -= a; if (by && by.team !== this.team && by === NV.me) NV.dmgDone = (NV.dmgDone || 0) + a;
    const k = 1 - .55 * clamp(1 - this.hp / this.hpMax, 0, 1); for (const m of this.mats) m.color.setRGB(k, k * .97, k * .94);
    if (this.hp <= 0) { if (by === NV.me && this !== NV.me) { addScore(this.C.type === 'bb' ? 3000 : this.C.type === 'cl' ? 1500 : this.C.type === 'dd' ? 800 : this.C.type === 'cargo' ? 600 : 300, this.C.name + ' affondato', '#9fe08a'); STATS.kills++; } this.sink(kind); }
  }
  sink(kind) {
    if (this.sinking) return; this.sinking = .01; this.hp = 0; this.tele = 0; this.listS = R() < .5 ? -1 : 1; this.trimS = R() < .5 ? -1 : 1;
    this.slick = navySlick(this.pos, this.C.L); play('boom_big', this.pos, { ref: 300, vol: 1 });
    if (kind === 'magazine') { this.breakK = 1; play('boom_big', this.pos, { ref: 500, vol: 1.3 }); }
    if (kind === 'magazine') { this.blown = true; const p = this.pos.clone().add(new V3(0, this.C.F + 5, 0)); fxExplosion(p, 8, false); for (let i = 0; i < 40; i++) PS_SMOKE.emit(p.x + rnd(-15, 15), p.y + rnd(0, 30), p.z + rnd(-15, 15), rnd(-6, 6), rnd(15, 45), rnd(-6, 6), rnd(10, 18), 15, 60, .8, .15, .14, .13, .2, -.3); sfxBoom(p, 6); }
    feed((this.team === 'A' ? '🇺🇸 ' : '') + this.name + (kind === 'magazine' ? ' esplode: santabarbara colpita!' : ' affonda'));
    if (this === NV.me) { showMsg(kind === 'magazine' ? 'La santabarbara è esplosa!' : 'La nave affonda! Abbandonare la nave!', 5); navyPlayerLost(); }
  }
  // fumo, esplosioni secondarie, bolle e chiazza di nafta in fiamme
  fxDamage(dt) {
    const k = this.hp / this.hpMax, far = dist2Cam(this.pos) > 9000 * 9000;
    this.fxT = (this.fxT || 0) - dt; if (this.fxT > 0 || far) return; this.fxT = .12;
    const C = this.C;
    if (!this.sinking && k < .4 && !this.bigSmoke) { this.bigSmoke = addEmitter(this.pos, 'smoke', C.L > 150 ? 2.6 : 1.6); this.bigSmoke.follow = q => this.toWorld(0, C.F + 6, -C.L * .05, q); this.bigSmoke.life = 1e9; }
    if (!this.sinking && k < .25 && R() < .04) { const p = this.toWorld(rnd(-C.B * .3, C.B * .3), C.F + 2, rnd(-C.L * .4, C.L * .4)); fxExplosion(p, 1.2 + C.L / 150, false); if (dist2Cam(p) < 4000 * 4000) sfxBoom(p, 1.5); }
    if (this.sinking > 0) {
      for (let i = 0; i < 2; i++) { const p = this.toWorld(rnd(-C.B * .5, C.B * .5), 0, rnd(-C.L * .45, C.L * .45)); PS_WAKE.emit(p.x, WATER_Y + .2, p.z, rnd(-1, 1), .3, rnd(-1, 1), rnd(3, 6), 2, 9, .6, .95, .97, .98, .3, 0); }
      if (R() < .25) { const p = this.toWorld(rnd(-C.B, C.B), 0, rnd(-C.L * .5, C.L * .5)); PS_FIRE.emit(p.x, WATER_Y + 1, p.z, rnd(-.5, .5), rnd(2, 4), rnd(-.5, .5), rnd(.8, 1.4), 3, 6, 1, 4, 2, .7); PS_SMOKE.emit(p.x, WATER_Y + 3, p.z, rnd(-1, 1), rnd(3, 6), rnd(-1, 1), rnd(8, 14), 4, 18, .7, .12, .11, .1, .1, -.1); }
      if (!this.bigSmoke) { this.bigSmoke = addEmitter(this.pos, 'smoke', C.L > 150 ? 3 : 1.8); this.bigSmoke.follow = q => q.copy(this.pos).setY(Math.max(WATER_Y + 4, this.pos.y + C.F)); this.bigSmoke.life = 1e9; }
      // spezzata dalla santabarbara: prua e poppa si alzano mentre il centro affonda
      if (this.breakK) { this.body.rotation.x += Math.sin(this.sinking * .7) * .0008; this.pitch = Math.min(.35, this.pitch + dt * .02); }
    }
  }
  remove() { this.alive = false; scene.remove(this.g); if (this.bigSmoke) this.bigSmoke.life = 0; if (this.slick) navySlickFade(this.slick); for (const f of this.fires) f.e.life = f.s.life = 0; const i = NV.ships.indexOf(this); if (i >= 0) NV.ships.splice(i, 1); }
  addFire(lp, by) {
    if (this.fires.length >= 4) return;
    if (by === NV.me && this !== NV.me) navyRibbon('fire');
    const lpc = lp.clone(), e = addEmitter(this.pos, 'fire', this.C.L > 100 ? 1.4 : .8); e.follow = q => { this.toWorld(lpc.x, Math.max(lpc.y, this.C.F), lpc.z, q); };
    const s = addEmitter(this.pos, 'smoke', this.C.L > 100 ? 1.6 : .9); s.follow = e.follow;
    this.fires.push({ e, t: rnd(30, 60), s, lp: lpc });
    if (this === NV.me) showMsg('Incendio a bordo! R: squadre di soccorso', 2);
  }
  // ---------- tiro ----------
  turretWorldDir(tu) { return _nvd.set(-Math.sin(this.yaw + tu.rel), 0, -Math.cos(this.yaw + tu.rel)); }
  arcEdge(tu, rel) {
    const sg = Math.sign(rel) || 1, a = Math.abs(wrapA(rel));
    if (tu.arc === 'fore') return sg * 2.58; if (tu.arc === 'aft') return sg * .57;
    if (tu.arc === 'side') return sg * (a < 1.5 ? .52 : 2.63);
    if (tu.arc === 'port') return rel > 0 ? (a < 1.5 ? .17 : 2.93) : (a < 1.5 ? .17 : 2.93);
    if (tu.arc === 'stbd') return rel < 0 ? -(a < 1.5 ? .17 : 2.93) : -(a < 1.5 ? .17 : 2.93);
    return rel;
  }
  arcOK(tu, rel) {
    const a = Math.abs(wrapA(rel));
    if (tu.arc === 'fore') return a < 2.6; if (tu.arc === 'aft') return a > .55; if (tu.arc === 'side') return a > .5 && a < 2.65; if (tu.arc === 'port') return rel > .15 && rel < 2.95; if (tu.arc === 'stbd') return rel < -.15 && rel > -2.95; return true;
  }
  // punta le torri verso un punto: alzo dalla tavola di tiro, compensando il moto proprio (il proiettile eredita la velocità della nave)
  aimAt(P, dt, list = this.turrets) {
    let any = false;
    for (const tu of list) {
      if (!tu.ok) { tu.aligned = false; continue; }
      const gp = this.toWorld(tu.x, tu.y, tu.z, _nva); let tgt = _nvb.copy(P), sol = null;
      // la velocità ereditata dalla nave viene frenata dall'aria più in fretta di quella alla bocca: ne resta circa (gittata / (v0·t))^1,5
      for (let it = 0; it < 3; it++) { const r = Math.hypot(tgt.x - gp.x, tgt.z - gp.z); sol = solveElev(tu.T, r); if (!sol) break; const fk = Math.pow(clamp(r / Math.max(1, sol.t * tu.S.v), .1, 1), 1.5); tgt.copy(P).addScaledVector(this.vel, -sol.t * fk); }
      const yawW = Math.atan2(-(tgt.x - gp.x), -(tgt.z - gp.z)), rel = wrapA(yawW - this.yaw);
      tu.inArc = this.arcOK(tu, rel); tu.sol = sol;
      // fuori settore la torre si porta al limite più vicino al bersaglio: è pronta appena il bersaglio entra in arco
      const goal = tu.inArc ? rel : this.arcEdge(tu, rel);
      const tv = tu.G.trav * (this === NV.me && NV.arcade ? 2.5 : 1);
      tu.rel = wrapA(tu.rel + clamp(wrapA(goal - tu.rel), -tv * dt, tv * dt));
      const eg = sol ? Math.min(sol.e, tu.G.elev) : tu.G.elev * .3; tu.el += clamp(eg - tu.el, -tv * 1.5 * dt, tv * 1.5 * dt);
      tu.aligned = tu.inArc && sol && Math.abs(wrapA(rel - tu.rel)) < .006 && Math.abs(eg - tu.el) < .004;
      any = any || tu.aligned;
    }
    return any;
  }
  // stabilizzazione: brandeggio e alzo voluti sono riferiti all'orizzonte vero; si convertono nel sistema dello scafo che beccheggia e rolla
  stabilize() {
    _nvq.setFromEuler(this.g.rotation).multiply(_nvq2.setFromEuler(this.body.rotation)).invert();
    for (const tu of this.turrets) {
      const a = this.yaw + tu.rel, w = _nvw.set(-Math.sin(a) * Math.cos(tu.el), Math.sin(tu.el), -Math.cos(a) * Math.cos(tu.el)).applyQuaternion(_nvq);
      tu.g.rotation.y = Math.atan2(-w.x, -w.z); tu.pv.rotation.x = Math.asin(clamp(w.y, -1, 1));
    }
  }
  get main() { return this._m || (this._m = this.turrets.filter(t => !t.sec)); }
  get secs() { return this._s || (this._s = this.turrets.filter(t => t.sec)); }
  // secondarie: sul bersaglio dato se a tiro, altrimenti sul nemico più vicino a portata, con l'anticipo
  secAim(dt, P) {
    const L = this.secs; if (!L.length) return null;
    let aim = P;
    if (!aim) {
      const mr = tableMax(L[0].T) * .9; let best = null, bd = mr;
      for (const o of NV.ships) if (o.team !== this.team && !o.sinking) { const d = o.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = o; } }
      if (best) { const sol = solveElev(L[0].T, bd); aim = best.pos.clone().addScaledVector(best.vel, sol ? sol.t : 0); aim.y = WATER_Y; }
    }
    if (aim) this.aimAt(aim, dt, L);
    return aim;
  }
  fireTurret(tu, ammo) {
    if (!tu.ok || tu.reload > 0 || !tu.aligned || this.sinking) return false;
    tu.reload = tu.G.reload * rnd(.97, 1.03);
    const S = tu.S, big = S.cal >= 100;
    this.g.updateMatrixWorld(true);
    for (const mz of tu.muzzles) {
      const o = tu.pv.localToWorld(mz.clone()), d = tu.pv.localToWorld(mz.clone().add(new V3(0, 0, -1))).sub(o).normalize();
      // dispersione: angolare (mrad) e di velocità iniziale (±0,4 %)
      const sg = tu.G.disp / 1000 * (this === NV.me ? (NV.arcade ? .3 : .6) : 1); d.x += gauss() * sg; d.y += gauss() * sg * .6; d.z += gauss() * sg; d.normalize();
      const v = d.multiplyScalar(S.v * (1 + gauss() * (this === NV.me ? (NV.arcade ? .0006 : .0013) : .004))).add(this.vel);
      const sh = { S, p: o.clone(), v, t: 0, by: this, ammo: ammo || 'AP', key: tu.key, sec: tu.sec }; NV.shells.push(sh);
      if (this === NV.me && !tu.sec) NV.lastShell = sh;
      if (big) { PS_FIRE.emit(o.x, o.y, o.z, d.x * .02, 1, d.z * .02, .25, S.cal / 25, S.cal / 12, 1, 4, 2.6, 1.2); for (let i = 0; i < 4; i++) PS_SMOKE.emit(o.x, o.y, o.z, d.x * rnd(.01, .03), rnd(1, 3), d.z * rnd(.01, .03), rnd(4, 9), S.cal / 30, S.cal / 6, .6, .7, .7, .7, .5, -.05); }
    }
    if (big) { if (this === NV.me) { sfxShipNear(); P.shake = Math.max(P.shake, Math.min(.35, .08 + S.cal / 2500)); } else sfxShip(tu.pv.getWorldPosition(_nvc)); }
    else if (dist2Cam(this.pos) < 1500 * 1500) sfxShot(S.cal >= 20 ? 'flak' : 'm2', this === NV.me ? null : this.pos, this === NV.me);
    if (this === NV.me) STATS.shots++;
    return true;
  }
  launchTorps(P) {
    const T = this.C.torps; if (!T || this.torpN <= 0 || this.torpT > 0 || this.sinking) return false;
    const dir = _nvd.set(P.x - this.pos.x, 0, P.z - this.pos.z).normalize(), rel = wrapA(Math.atan2(-dir.x, -dir.z) - this.yaw);
    // tubi fissi a prua, ma il giroscopio del siluro può impostare una rotta fino a ±35° dopo il lancio
    const ok = T.arc === 'bow' ? Math.abs(rel) < .61 : Math.abs(rel) > .6 && Math.abs(rel) < 2.55;
    if (!ok) { if (this === NV.me) showMsg(T.arc === 'bow' ? 'Bersaglio troppo di lato: il giroscopio corregge al massimo 35°' : 'I tubi lanciano solo sui fianchi', 1.6); return false; }
    const n = Math.min(T.salvo, this.torpN); this.torpN -= n; this.torpT = this.C.type === 'pt' ? 1.5 : 8;
    for (let i = 0; i < n; i++) {
      const m = T.mounts[i % T.mounts.length], o = this.toWorld(m[0] + (T.arc === 'side' ? Math.sign(rel) * this.C.B * .4 : 0), 0, m[2]); o.y = WATER_Y - 2;
      const a = Math.atan2(-dir.x, -dir.z) + (i - (n - 1) / 2) * .045, d = new V3(-Math.sin(a), 0, -Math.cos(a));
      const mesh = new THREE.Mesh(U.cyl, MAT.vc); mesh.scale.set(.27, 7, .27); mesh.rotation.set(PI / 2, a, 0, 'YXZ'); scene.add(mesh);
      NV.torps.push({ p: o, d, v: T.kn * KN, left: T.range, dmg: T.dmg, by: this, mesh, arm: 0, w: 0 });
      PS_WAKE.emit(o.x, WATER_Y + .3, o.z, d.x * 3, 1, d.z * 3, 2, 1, 4, .6, .95, .97, .98, .3, 0);
    }
    play('boom_water', this.pos, { ref: 40, vol: .7 });
    if (this === NV.me) showMsg(n + ' siluri in acqua! (restano ' + this.torpN + ')', 2);
    return true;
  }
}
const _nvf = new V3(), _nvt = new V3(), _nvu = new V3(), _nvr = new V3(), _nvd = new V3(), _nva = new V3(), _nvb = new V3(), _nvc = new V3();
const _nvq = new THREE.Quaternion(), _nvq2 = new THREE.Quaternion(), _nvw = new V3();
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function gauss() { return (R() + R() + R() + R() - 2) * 1.2247; }

// ---------- proiettili in volo ----------
function updateShells(dt) {
  const L = NV.shells;
  for (let i = L.length - 1; i >= 0; i--) {
    const s = L[i], p0 = _nva.copy(s.p); let n = Math.max(1, Math.ceil(dt / .02)), h = dt / n, done = false;
    for (let k = 0; k < n && !done; k++) {
      const a = _nvb.copy(s.p); shellStep(s.S, s.p, s.v, h); s.t += h;
      // navi: segmento contro lo scafo e la sovrastruttura (scatole nel sistema della nave)
      for (const sh of NV.ships) { if (sh.sinking || (sh === s.by && s.t < 1)) continue; if (a.distanceToSquared(sh.pos) > (sh.C.L * .6 + 120) ** 2) continue; const hit = hullHit(sh, a, s.p); if (hit) { shellOnShip(s, sh, hit); done = true; break; } }
      if (done) break;
      if (s.p.y < WATER_Y + 1 && navyH(s.p.x, s.p.z) > s.p.y) { fxExplosion(s.p.clone(), Math.min(4, s.S.cal / 60), false); sfxBoom(s.p, s.S.cal / 100); done = true; break; }
      const sy = seaH(s.p.x, s.p.z, GAME.time);
      if (s.p.y < sy) { splash(s, s.p.clone().setY(sy)); done = true; break; }
      if (s.t > 120) { done = true; break; }
    }
    // fischio dei colpi in arrivo vicino al giocatore
    if (!done && NV.me && s.by !== NV.me && !s.wh && s.v.y < 0 && s.S.cal >= 100 && s.p.distanceTo(camera.position) < 250) { s.wh = true; sfxWhistle(s.p, s.S.cal > 200); }
    if (done) { s.end = s.p.clone(); L.splice(i, 1); }
  }
  // scia luminosa dei proiettili (i grossi calibri sono puntini caldi)
  drawShells();
}
const NVQ = { mesh: null };
// proiettili come in World of Warships: strisce luminose allungate lungo la velocità, testa bianco-calda e coda che sfuma;
// larghezza minima in proporzione alla distanza, così una salva resta leggibile anche a 15 km
const NVG = { mesh: null, N: 1500 };
function initShellFx() {
  const base = new THREE.InstancedBufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3)); base.setIndex([0, 2, 1, 1, 2, 3]);
  const N = NVG.N;
  base.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
  base.setAttribute('iDir', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
  base.setAttribute('iLW', new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2));
  base.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPix: { value: .002 } },
    vertexShader: `attribute vec3 iPos; attribute vec3 iDir; attribute vec2 iLW; attribute vec3 iCol; varying vec2 vUV; varying vec3 vC; uniform float uPix;
      void main(){
        vec3 toCam = normalize(cameraPosition - iPos); vec3 side = normalize(cross(iDir, toCam));
        float d = length(cameraPosition - iPos); float w = max(iLW.y, d * uPix * 1.6) * 3.;   // nucleo di almeno ~1,6 px più alone
        float l = max(iLW.x, d * uPix * 14.);
        vec3 p = iPos - iDir * l * position.x + side * w * position.y;
        vUV = position.xy; vC = iCol; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `varying vec2 vUV; varying vec3 vC;
      void main(){ float u = vUV.x, v = abs(vUV.y);
        float core = smoothstep(.36, .0, v), halo = pow(1. - v, 2.) * .35;
        float body = pow(1. - u, 2.2) * (core * 1.2 + halo);
        float head = smoothstep(.14, 0., u) * (core * 2.4 + halo * 1.5);
        vec3 c = vC * body * 1.3 + vec3(1., .96, .88) * head;
        gl_FragColor = vec4(c, 1.); }`,
  });
  NVG.mesh = new THREE.Mesh(base, m); NVG.mesh.frustumCulled = false; NVG.mesh.renderOrder = 6; scene.add(NVG.mesh);
}
function drawShells() {
  if (!NVG.mesh) initShellFx();
  const L = NV.shells, n = Math.min(NVG.N, L.length), A = NVG.mesh.geometry.attributes;
  for (let i = 0; i < n; i++) {
    const s = L[i], c = s.S.cal, sp = s.v.length(), big = c >= 100;
    A.iPos.setXYZ(i, s.p.x, s.p.y, s.p.z); A.iDir.setXYZ(i, s.v.x / sp, s.v.y / sp, s.v.z / sp);
    // lunghezza come il tratto percorso in ~1/12 di secondo; larghezza dal calibro
    A.iLW.setXY(i, big ? sp * .07 + c / 25 : sp * .045, big ? .12 + c / 1800 : c >= 20 ? .09 : .06);
    const hot = s.ammo === 'HE' ? [1, .5, .16] : [1, .66, .3];
    A.iCol.setXYZ(i, ...(big ? hot : c >= 20 ? [1, .55, .2] : [1, .35, .15]));
  }
  NVG.mesh.geometry.instanceCount = n; NVG.mesh.material.uniforms.uPix.value = 2 * Math.tan(camera.fov * PI / 360) / Math.max(300, innerHeight);
  A.iPos.needsUpdate = A.iDir.needsUpdate = A.iLW.needsUpdate = A.iCol.needsUpdate = true;
}
// colonne d'acqua alte secondo il calibro; le schegge dell'esplosivo colpiscono le navi vicinissime
function splash(s, p) {
  const c = s.S.cal, hgt = c >= 1000 ? 260 : c >= 500 ? 110 : c >= 300 ? 60 : c >= 150 ? 30 : c >= 100 ? 18 : c >= 20 ? 4 : 1.5;
  if (dist2Cam(p) < (NV.zoomOn || P.adsHeld ? 30000 : 12000) ** 2) {
    const n = c >= 100 ? 14 : 3;
    for (let i = 0; i < n; i++) PS_SMOKE.emit(p.x + rnd(-1, 1) * c / 60, p.y, p.z + rnd(-1, 1) * c / 60, rnd(-1, 1) * c / 80, Math.sqrt(2 * 9.81 * hgt) * rnd(.6, 1), rnd(-1, 1) * c / 80, rnd(2.5, 4.5), c / 50 + .4, c / 12 + 1.5, .75, .93, .96, .98, .2, 9.81);
    if (c >= 100) PS_WAKE.emit(p.x, WATER_Y + .2, p.z, 0, 0, 0, 6, c / 30, c / 6, .6, .95, .97, .98, 0, 0);
  }
  if (c >= 100 && dist2Cam(p) < 2500 * 2500) play('imp_water', p, { ref: c / 3, vol: Math.min(1, c / 200) });
  if (s.S.he > .5) for (const sh of NV.ships) { if (sh.sinking || sh === s.by) continue; const l = sh.toLocal(p, _nvc); const dx = Math.max(0, Math.abs(l.x) - sh.C.B / 2), dz = Math.max(0, Math.abs(l.z) - sh.C.L / 2), d = Math.hypot(dx, dz); if (d < c / 12) sh.damage((25 * Math.pow(s.S.he, .6)) * (1 - d / (c / 12)) * (sh.C.belt > 50 ? .1 : .6), s.by, 'splinter'); }
}
// intersezione segmento-scatola nel sistema della nave: scafo (con prua affilata) e sovrastruttura
function hullHit(sh, a, b) {
  const C = sh.C, la = sh.toLocal(a, new V3()), lb = sh.toLocal(b, new V3()), d = lb.clone().sub(la), len = d.length(); if (len < 1e-6) return null; d.multiplyScalar(1 / len);
  const boxes = [[0, (C.F - C.D) / 2, 0, C.B / 2, (C.F + C.D) / 2, C.L / 2, 'hull']];
  if (C.type !== 'pt') boxes.push([0, C.F + (C.type === 'bb' || C.type === 'cl' ? 6 : 4), -C.L * .1, C.B * .26, C.type === 'bb' || C.type === 'cl' ? 7 : 4, C.L * .2, 'sup']);
  let best = null;
  for (const [cx, cy, cz, hx, hy, hz, part] of boxes) {
    let t0 = 0, t1 = len, ax = -1, sg = 0;
    const o = [la.x - cx, la.y - cy, la.z - cz], dd = [d.x, d.y, d.z], h = [hx, hy, hz]; let ok = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dd[k]) < 1e-9) { if (Math.abs(o[k]) > h[k]) { ok = false; break; } continue; }
      let u0 = (-h[k] - o[k]) / dd[k], u1 = (h[k] - o[k]) / dd[k], s = -1; if (u0 > u1) { [u0, u1] = [u1, u0]; s = 1; }
      if (u0 > t0) { t0 = u0; ax = k; sg = s * Math.sign(dd[k]) * -1 * -1; } if (u1 < t1) t1 = u1; if (t0 > t1) { ok = false; break; }
    }
    if (!ok || ax < 0) continue;
    const lp = la.clone().addScaledVector(d, t0);
    // prua e poppa affusolate: un colpo «sul bordo» della scatola fuori dalla sagoma passa oltre
    if (part === 'hull') { const tz = (lp.z + C.L / 2) / C.L, w = C.B / 2 * (tz < .3 ? Math.pow(Math.max(tz, .002) / .3, .55) : 1); if (Math.abs(lp.x) > w + .3 && ax !== 1) continue; }
    if (!best || t0 < best.t) best = { t: t0, lp, ax, part, dirL: d.clone(), p: a.clone().lerp(b, t0 / len) };
  }
  return best;
}
// perforazione, danni ai moduli, allagamenti, incendi
function shellOnShip(s, sh, H) {
  const C = sh.C, S = s.S, v = s.v.length(), lp = H.lp, me = s.by === NV.me;
  const cit = Math.abs(lp.z) < C.L * .27 && H.part === 'hull';
  const face = H.ax === 1 ? 'deck' : 'side';
  let armor = H.part === 'sup' ? 10 : face === 'deck' ? (cit ? C.deck : C.deck * .3) : (cit ? C.belt : C.ends);
  if (lp.y < -1.5 && face === 'side') armor *= .6;
  const nrm = H.ax === 0 ? 0 : H.ax === 1 ? 1 : 2, cosN = Math.abs(H.dirL.getComponent(nrm)), ang = Math.acos(Math.min(1, cosN));
  const fullDmg = 12 * Math.pow(S.m, .75), heDmg = 25 * Math.pow(S.he, .6) + S.cal * .6;
  let dmg = 0, txt = '', pen = false;
  if (s.ammo === 'AP' && S.cal >= 100) {
    if (ang > 1.22 && armor > 0) { txt = 'Rimbalzo'; dmg = fullDmg * .03; }
    else {
      const P = penDeMarre(S, v), eff = armor / Math.max(.2, cosN);
      if (P >= eff) {
        pen = true;
        // sovrapperforazione: contro scafi sottili il perforante grosso attraversa senza esplodere dentro
        const over = armor < S.cal / 8 && C.B < S.cal / 12 + 14 && R() < .65;
        let citHit = false;
        if (!over && (C.type === 'bb' || C.type === 'cl')) {
          const fz = Math.min(.033 * v, C.B * 1.2);
          for (let k = 1; k <= 12 && !citHit; k++) { const q = lp.clone().addScaledVector(H.dirL, fz * k / 12); citHit = Math.abs(q.x) < C.B * .3 && q.y > -C.D * .85 && q.y < C.F * .45 && Math.abs(q.z) < C.L * .27; }
        }
        H.citadel = citHit;
        dmg = fullDmg * (over ? .25 : citHit ? 1.5 : C.type === 'bb' || C.type === 'cl' ? .6 : 1); txt = over ? 'Sovrapperforazione' : citHit ? 'CITTADELLA!' : 'Perforazione';
      } else { dmg = fullDmg * .06; txt = 'Non perforato'; }
    }
  } else {
    // esplosivo (o calibri piccoli): danno di superficie; contro corazze spesse resta fuori
    const P = S.cal / 6; pen = P >= armor; dmg = heDmg * (pen ? 1 : .25); txt = S.cal >= 100 ? (pen ? 'Colpo esplosivo' : 'Esplosivo sulla corazza') : '';
    if (S.cal >= 100 && R() < Math.min(.45, S.cal / 450)) sh.addFire(lp, s.by);
  }
  // moduli: torri vicine al punto d'impatto, macchine nella cittadella, timone a poppa, santabarbara
  if (pen) {
    for (const tu of sh.turrets) if (Math.hypot(tu.z - lp.z, tu.x - lp.x) < Math.max(4, C.B * .25) && R() < .6) { tu.ok = false; tu.fixT = rnd(25, 40); if (sh === NV.me) showMsg('Torre fuori uso!', 1.5); }
    if (H.citadel && R() < .4) { sh.mod.eng = Math.max(0, sh.mod.eng - .5); if (sh === NV.me && sh.mod.eng < .5) showMsg('Sala macchine colpita: velocità ridotta', 2); }
    if (lp.z > C.L * .38 && R() < .3) { sh.mod.steer = 0; if (sh === NV.me) showMsg('Timone bloccato!', 2); }
    if (s.ammo === 'AP' && H.citadel && S.cal >= 200 && R() < .03) { sh.damage(sh.hp + 1, s.by, 'magazine'); dmg = 0; sh.sink('magazine'); }
    if (lp.y < .6 && face === 'side') { sh.leak += .0015 * Math.sqrt(S.m) / Math.sqrt(C.L / 100); sh.listS = Math.sign(lp.x) || 1; if (me) navyRibbon('flood'); if (sh === NV.me) showMsg('Falla sotto la linea di galleggiamento!', 1.8); }
    if (R() < .25) sh.addFire(lp, s.by);
  }
  navyMark(sh, lp, H.ax, pen, S.cal, H.part);
  if (me) navyRibbon(txt === 'Rimbalzo' ? 'rico' : txt === 'Sovrapperforazione' ? 'over' : H.citadel ? 'cit' : pen && S.cal >= 100 ? 'pen' : S.cal >= 100 ? 'nopen' : 'hit');
  if (me) { (sh.hitLog = sh.hitLog || []).push({ x: lp.x, z: lp.z, pen, t: GAME.time, big: S.cal >= 100 && !s.sec, sec: s.sec, cit: H.citadel }); if (sh.hitLog.length > 80) sh.hitLog.shift(); }
  sh.damage(dmg, s.by, 'shell');
  const p = H.p;
  if (S.cal >= 100) { fxExplosion(p.clone(), Math.min(5, S.cal / (pen ? 70 : 120)), false); if (dist2Cam(p) < 3000 * 3000) sfxBoom(p, S.cal / (pen ? 80 : 140)); }
  else { fxImpact(p, 'metal'); if (S.he && R() < .3) fxExplosion(p.clone(), .3, false); }
  if (me) { STATS.hits++; hitMarker(sh.sinking > 0, false); if (s.sec) navySecHit(sh, dmg, pen); else if (txt && S.cal >= 100) navyHitText(txt + (dmg > 0 ? ' · ' + Math.round(dmg) : ''), H.citadel ? '#ffd23a' : pen ? '#ffcf5a' : '#c9d2d8'); }
}
// siluri: corrono a pochi metri di profondità con la scia di bolle; esplodono contro lo scafo
function updateTorps(dt) {
  for (let i = NV.torps.length - 1; i >= 0; i--) {
    const T = NV.torps[i], st = T.v * dt; T.p.addScaledVector(T.d, st); T.left -= st; T.arm += st;
    T.mesh.position.copy(T.p); T.w -= dt;
    if (T.w <= 0 && dist2Cam(T.p) < 4000 * 4000) { T.w = .12; PS_WAKE.emit(T.p.x - T.d.x * 6, WATER_Y + .15, T.p.z - T.d.z * 6, 0, .02, 0, rnd(8, 12), .7, rnd(2, 3), .45, .93, .96, .98, 0, 0); }
    let hit = null;
    if (T.arm > 150) for (const sh of NV.ships) { if (sh.sinking) continue; const l = sh.toLocal(T.p, _nvc); if (Math.abs(l.x) < sh.C.B / 2 + .5 && Math.abs(l.z) < sh.C.L / 2 && sh.C.D > 1.2) { hit = sh; break; } }
    if (hit || T.left <= 0 || navyH(T.p.x, T.p.z) > T.p.y) {
      if (hit) {
        const p = T.p.clone().setY(WATER_Y);
        for (let k = 0; k < 24; k++) PS_SMOKE.emit(p.x + rnd(-3, 3), p.y, p.z + rnd(-3, 3), rnd(-3, 3), rnd(18, 34), rnd(-3, 3), rnd(3, 5), 4, 18, .85, .93, .96, .98, .2, 9.81);
        fxExplosion(p, 4, true); sfxBoom(p, 5, true);
        hit.damage(T.dmg * (hit.C.type === 'bb' ? .55 : 1), T.by, 'torpedo'); hit.leak += .006; hit.listS = Math.sign(hit.toLocal(p, _nvc).x) || 1;
        if (hit === NV.me) { showMsg('Colpiti da un siluro!', 2.5); P.shake = Math.max(P.shake, .5); }
        if (T.by === NV.me) { navyHitText('Siluro a segno! · ' + Math.round(T.dmg), '#ffcf5a'); navyRibbon('torp'); }
      }
      scene.remove(T.mesh); NV.torps.splice(i, 1);
    }
  }
}

// ---------- IA ----------
function nearestFoe(sh) {
  let b = null, bs = -1e9; const mr = sh.turrets.length ? tableMax(sh.turrets[0].T) : 8000;
  for (const o of NV.ships) { if (o.team === sh.team || o.sinking) continue; const d = o.pos.distanceTo(sh.pos); const sc = (o.C.L / 30) + (o.tag === 'cargo' || o.tag === 'liberty' ? 4 : 0) - d / 1500 - (d > mr ? 20 : 0) + (o === NV.me ? 1 : 0); if (sc > bs) { bs = sc; b = o; } }
  return b;
}
function aiShip(sh, dt, t) {
  if (sh.sinking) return;
  const C = sh.C;
  // mercantili: seguono la rotta
  if (sh.route) { const wp = sh.route[0]; if (wp) { if (Math.hypot(wp.x - sh.pos.x, wp.z - sh.pos.z) < 300) sh.route.shift(); else steerTo(sh, Math.atan2(-(wp.x - sh.pos.x), -(wp.z - sh.pos.z))); } sh.tele = 3; if (C.type === 'cargo') return; }
  sh.fc.re = (sh.fc.re || 0) - dt; if (sh.fc.re <= 0) { sh.fc.re = 20; sh.fc.tgt = null; }
  const T = sh.fc.tgt && !sh.fc.tgt.sinking && sh.fc.tgt.alive ? sh.fc.tgt : (sh.fc.tgt = nearestFoe(sh));
  if (!T) { sh.tele = 1; return; }
  const dv = _nva.set(T.pos.x - sh.pos.x, 0, T.pos.z - sh.pos.z), dist = dv.length(), brg = Math.atan2(-dv.x, -dv.z);
  const want = { bb: 15000, cl: 10500, dd: 6500, pt: 2500, cv: 30000 }[sh.role] || 8000;
  sh.zig -= dt; if (sh.zig <= 0) { sh.zig = rnd(25, 50); sh.zigS = -sh.zigS; }
  let hd;
  if (!sh.route) {
    if (sh.role === 'pt' || (sh.role === 'dd' && sh.torpN > 0 && dist < 9000)) {
      // attacco silurante: corre verso il bersaglio, lancia a portata e si allontana
      if (sh.retreat > 0) { sh.retreat -= dt; hd = brg + PI + sh.zigS * .5; }
      else { hd = brg + sh.zigS * .25; const lead = T.pos.clone().addScaledVector(T.vel, dist / (C.torps ? C.torps.kn * KN : 20)); if (sh.torpN > 0 && dist < C.torps.range * .55) { if (sh.launchTorps(lead)) sh.retreat = 40; else hd = brg + (C.torps.arc === 'side' ? sh.zigS * 1.4 : 0); } }
    } else if (dist > want * 1.1) hd = brg + sh.zigS * .35;
    else if (dist < want * .8) hd = brg + PI + sh.zigS * .4;
    else hd = brg + sh.zigS * 1.2;  // di fianco: tutte le torri in batteria
    // non andare a sbattere sulle isole
    const ah = sh.pos.clone().addScaledVector(_nvd.set(-Math.sin(hd), 0, -Math.cos(hd)), C.L * 2 + 400); if (navyH(ah.x, ah.z) > -C.D - 2) hd += 1.2 * sh.zigS;
    steerTo(sh, hd); sh.tele = 4;
  }
  // centrale di tiro: errore iniziale in distanza e direzione che si riduce salva dopo salva (correzione sulle colonne d'acqua)
  if (sh.main.length) {
    if (sh.fc.last !== T) { sh.fc.last = T; sh.fc.err.set(gauss() * dist * .05, 0, gauss() * dist * .05); sh.fc.vT = T.vel.clone(); }
    if (T.vel.distanceTo(sh.fc.vT) > 3) { sh.fc.err.multiplyScalar(1.6).clampLength(0, dist * .08); sh.fc.vT.copy(T.vel); }
    const tof = (solveElev(sh.main[0].T, dist) || { t: dist / 600 }).t;
    const aim = T.pos.clone().addScaledVector(T.vel, tof).add(sh.fc.err);
    const inRange = dist < tableMax(sh.main[0].T) * .95;
    sh.aimAt(aim, dt, sh.main);
    const sa = sh.secAim(dt, null); if (sa) for (const tu of sh.secs) sh.fireTurret(tu, 'HE');
    if (inRange) { let fired = false; for (const tu of sh.main) { tu.reload -= 0; if (sh.fireTurret(tu, T.C.belt > 100 || T.C.deck > 40 ? 'AP' : 'HE')) fired = true; } if (fired && sh.main[0].S.cal >= 100) sh.fc.err.multiplyScalar(rnd(.5, .75)).add(_nvw.set(gauss() * dist * .012, 0, gauss() * dist * .012)); }  // correzione sulle colonne d'acqua, mai perfetta
  }
}
function steerTo(sh, hd) { sh.rudCmd = clamp(-wrapA(hd - sh.yaw) * 2.5, -1, 1); }

// ---------- giocatore ----------
function navyKey(c) {
  const me = NV.me; if (!me || me.sinking) return;
  if (c === 'KeyW') { me.tele = Math.min(4, me.tele + 1); teleMsg(); }
  else if (c === 'KeyS') { me.tele = Math.max(-1, me.tele - 1); teleMsg(); }
  else if (c === 'KeyC') { me.rudCmd = 0; showMsg('Timone al centro', 1); }
  else if (c === 'KeyT') me.launchTorps(NV.aim);
  else if (c === 'KeyQ') navyLock();
  else if (c === 'KeyY') navyCallStrike();
  else if (c === 'KeyP') navyTakePlane();
  else if (c === 'ShiftLeft' || c === 'ShiftRight') { NV.zoomOn = !NV.zoomOn; }
  else if (c === 'KeyZ') { if (NV.follow) { NV.follow = null; return; } const sh = NV.lastShell; if (sh && NV.shells.includes(sh)) { NV.follow = sh; NV.followT = 0; NV.fcam = null; NV.forb = { yaw: 0, pitch: .18 }; showMsg('Segui il colpo · Z per tornare alla nave', 1.5); } else showMsg('Nessun colpo in volo: spara e premi Z', 1.5); }
  else if (c === 'Digit1') { NV.ammo = 'AP'; showMsg('Granate perforanti (AP)', 1.2); }
  else if (c === 'Digit2') { NV.ammo = 'HE'; showMsg('Granate esplosive (HE)', 1.2); }
  else if (c === 'KeyG') { NV.secAuto = !NV.secAuto; showMsg('Armi secondarie: ' + (NV.secAuto ? 'fuoco automatico sul nemico più vicino' : 'solo a comando (F)'), 1.8); }
  else if (c === 'KeyR') { if (me.dcCool > 0) showMsg('Squadre di soccorso pronte tra ' + Math.ceil(me.dcCool) + ' s', 1.5); else { me.dcT = 18; me.dcCool = 75; showMsg('Squadre di soccorso al lavoro (18 s)', 2); } }
}
function teleMsg() { const n = ['Indietro', 'Stop', '1/4 avanti', '1/2 avanti', '3/4 avanti', 'Avanti tutta']; showMsg('Telegrafo: ' + n[NV.me.tele + 1], 1.2); }
function navyMouse(dx, dy) {
  // col colpo seguito il mouse gira attorno al proiettile
  if (NV.follow) { const o = NV.forb, k = .003 * SETTINGS.sens; o.yaw -= dx * k; o.pitch = clamp(o.pitch - dy * k, -.15, 1.4); return; }
 const s = .0018 * SETTINGS.sens * (camera.fov / 60); NV.cam.yaw -= dx * s; NV.cam.pitch = clamp(NV.cam.pitch - dy * s, -.6, .25); }
function navyWheel(dy) {
  if (P.adsHeld || NV.zoomOn) { NV.zfov = clamp((NV.zfov || 9) * (dy > 0 ? 1.25 : .8), 2.5, 25); showMsg('Ingrandimento ' + (60 / NV.zfov).toFixed(1) + '×', .8); return; }
  NV.cam.dist = clamp(NV.cam.dist * (dy > 0 ? 1.12 : .89), .35, 4);
}
function navyLock() {
  let best = null, ba = .2;
  const f = new V3(); camera.getWorldDirection(f);
  for (const s of NV.ships) { if (s === NV.me || s.sinking || s.team === NV.me.team) continue; const d = s.pos.clone().sub(camera.position), a = d.angleTo(f); if (a < ba) { ba = a; best = s; } }
  NV.lock = best && best !== NV.lock ? best : null; showMsg(NV.lock ? 'Bersaglio: ' + NV.lock.name : 'Bersaglio libero', 1.2);
}
function updateNavyPlayer(dt) {
  const me = NV.me; if (!me) return;
  P.pos.copy(me.pos);
  // A/D: muovono il timone e lo lasciano dov'è
  if (!me.sinking) { if (KEYS.KeyA) me.rudCmd = clamp(me.rudCmd - dt * .8, -1, 1); if (KEYS.KeyD) me.rudCmd = clamp(me.rudCmd + dt * .8, -1, 1); }
  if (navyShellCam(dt)) { if (!me.sinking) { me.aimAt(NV.aim, dt, me.main); for (const tu of me.turrets) tu.reload = Math.max(0, tu.reload - dt); } me.torpT = Math.max(0, me.torpT - dt); return; }
  // camera: in terza persona attorno alla nave o col binocolo (tasto destro) dalla plancia
  const zoom = P.adsHeld || NV.zoomOn, C = me.C, cy = NV.cam.yaw, cpch = NV.cam.pitch;
  const dir = new V3(-Math.sin(cy) * Math.cos(cpch), Math.sin(cpch), -Math.cos(cy) * Math.cos(cpch));
  // col binocolo la camera sta davanti e sopra la nave lungo la mira: niente alberi o fumaioli in vista
  if (zoom) { camera.position.set(me.pos.x + dir.x / Math.max(.2, Math.hypot(dir.x, dir.z)) * C.L * .6, me.pos.y + C.F + 12 + C.L * .06, me.pos.z + dir.z / Math.max(.2, Math.hypot(dir.x, dir.z)) * C.L * .6); camera.fov = lerp(camera.fov, NV.zfov || 9, .25); }
  else { const d = (C.L * 1.1 + 25) * NV.cam.dist; camera.position.copy(me.pos).addScaledVector(dir, -d); camera.position.y = Math.max(camera.position.y + C.F + C.L * .18, seaH(camera.position.x, camera.position.z, GAME.time) + 3); camera.fov = lerp(camera.fov, SETTINGS.fov, .2); }
  camera.updateProjectionMatrix();
  camera.lookAt(_nva.copy(camera.position).addScaledVector(dir, 1000).add(new V3(0, zoom ? 0 : C.L * .1, 0)));
  // scossone: oscillazione morbida e contenuta (più piccola col binocolo, dove sarebbe ingrandita)
  if (P.shake > 0) { const a = Math.min(P.shake, .6) * .0035 * (camera.fov / 60), t = GAME.time; camera.rotation.x += Math.sin(t * 21) * a; camera.rotation.y += Math.sin(t * 17 + 1.3) * a * .7; }
  // punto mirato: dove il raggio del mirino tocca il mare (oltre l'orizzonte: gittata massima)
  const f = new V3(); camera.getWorldDirection(f); const maxR = me.main.length ? tableMax(me.main[0].T) : 3000;
  if (f.y < -1e-4) { const t = (camera.position.y - WATER_Y) / -f.y; NV.aim.copy(camera.position).addScaledVector(f, Math.min(t, maxR * 1.3 / Math.max(.05, Math.hypot(f.x, f.z)))); }
  else NV.aim.copy(me.pos).add(new V3(f.x, 0, f.z).normalize().multiplyScalar(maxR));
  NV.aim.y = WATER_Y;
  // telemetro: col bersaglio agganciato, o con una nave nemica vicina al mirino, la distanza la dà la centrale di tiro
  // (distanza futura del bersaglio dopo il tempo di volo); il giocatore corregge solo l'anticipo laterale
  NV.rf = null;
  if (me.main.length) {
    const bx = NV.aim.x - me.pos.x, bz = NV.aim.z - me.pos.z, bl = Math.hypot(bx, bz) || 1, brg = Math.atan2(-bx, -bz);
    let T = NV.lock && !NV.lock.sinking ? NV.lock : null;
    if (!T) { let ba = .045; for (const o of NV.ships) { if (o.team === me.team || o.sinking) continue; const a = Math.abs(wrapA(Math.atan2(-(o.pos.x - me.pos.x), -(o.pos.z - me.pos.z)) - brg)) * Math.max(1, o.pos.distanceTo(me.pos) / 6000); if (a < ba) { ba = a; T = o; } } }
    if (T) {
      let tof = 0, P2 = T.pos; for (let i = 0; i < 3; i++) { const sol = solveElev(me.main[0].T, Math.hypot(P2.x - me.pos.x, P2.z - me.pos.z)); tof = sol ? sol.t : 0; P2 = T.pos.clone().addScaledVector(T.vel, tof); }
      // distanza dal telemetro, corretta con l'altezza del mirino: sulla linea di galleggiamento del bersaglio è esattamente la sua,
      // più in basso è più corta, più in alto più lunga (stessa sensibilità del mirare sull'acqua)
      const rT = Math.hypot(P2.x - me.pos.x, P2.z - me.pos.z), hc = camera.position.y - WATER_Y;
      const aT = Math.atan2(hc, Math.hypot(T.pos.x - camera.position.x, T.pos.z - camera.position.z)), aC = -Math.asin(clamp(f.y, -1, 1));
      const r = aC > 1e-4 ? clamp(rT * Math.tan(aT) / Math.tan(aC), 50, maxR * 1.2) : maxR * 1.2;
      NV.aim.set(me.pos.x + bx / bl * r, WATER_Y, me.pos.z + bz / bl * r); NV.rf = T;
    }
  }
  NV.aimR = Math.hypot(NV.aim.x - me.pos.x, NV.aim.z - me.pos.z);
  if (!me.sinking) {
    me.aimAt(NV.aim, dt, me.main);
    for (const tu of me.turrets) tu.reload = Math.max(0, tu.reload - dt);
    if (mouseL) { let shot = 0; for (const tu of me.main) if (me.fireTurret(tu, NV.ammo)) shot++; if (!shot) navyWhyNot(me.main); }
    const man = KEYS.KeyF; NV.secMan = man;
    const sa = me.secAim(dt, man ? NV.aim : null);
    if (man || (sa && NV.secAuto)) { let shot = 0; for (const tu of me.secs) if (me.fireTurret(tu, 'HE')) shot++; if (man && !shot) navyWhyNot(me.secs, true); }
  }
  me.torpT = Math.max(0, me.torpT - dt);
}
// perché non parte il colpo: torri in ricarica, fuori arco, fuori portata o non ancora in punteria
function navyWhyNot(list, sec) {
  if (!list.length || (NV.whyT || 0) > GAME.time) return; NV.whyT = GAME.time + .6;
  const ok = list.filter(t => t.ok), ready = ok.filter(t => t.reload <= 0), arc = ready.filter(t => t.inArc), sol = arc.filter(t => t.sol);
  let m;
  if (!ok.length) m = 'Torri fuori uso';
  else if (!ready.length) m = 'In ricarica: ' + Math.ceil(Math.min(...ok.map(t => t.reload))) + ' s';
  else if (!arc.length) m = 'Nessuna torre può brandeggiare da quel lato';
  else if (!sol.length) m = 'Bersaglio fuori portata';
  else m = (sec ? 'Secondarie' : 'Torri') + ' non ancora in punteria: ' + sol.filter(t => t.aligned).length + '/' + sol.length;
  navyHitText(m, '#ff9a6a');
}
// camera sul proiettile: dietro e un po' sopra, guarda dove sta andando; all'impatto resta sul punto qualche istante
function navyShellCam(dt) {
  const S = NV.follow; if (!S) return false;
  const inFlight = NV.shells.includes(S);
  if (!inFlight) { NV.followT += dt; if (NV.followT > 2.2 || !S.end) { NV.follow = null; return false; } }
  const p = inFlight ? S.p : S.end, d = _nvw.copy(S.v).normalize(), back = (inFlight ? 26 + Math.min(40, S.S.cal / 12) : 70 + S.S.cal / 4) * NV.cam.dist;
  // orbita: di base dietro al proiettile, il mouse la ruota attorno (rotella: distanza)
  const o = NV.forb, h = Math.atan2(-d.x, -d.z) + o.yaw, pc = o.pitch + (inFlight ? 0 : .25);
  const want = _nvb.set(p.x + Math.sin(h) * Math.cos(pc) * back, p.y + Math.sin(pc) * back, p.z + Math.cos(h) * Math.cos(pc) * back);
  // si ammorbidisce solo lo scostamento dal proiettile: la camera non resta indietro anche a 800 m/s
  const off = want.clone().sub(p); NV.fcam = NV.fcam || off.clone(); NV.fcam.lerp(off, Math.min(1, dt * 8));
  camera.position.copy(p).add(NV.fcam); camera.position.y = Math.max(camera.position.y, seaH(camera.position.x, camera.position.z, GAME.time) + 2); camera.fov = lerp(camera.fov, 45, .2); camera.updateProjectionMatrix();
  camera.lookAt(inFlight && Math.abs(o.yaw) < .05 && Math.abs(o.pitch - .18) < .05 ? _nva.copy(p).addScaledVector(d, 30) : p);
  return true;
}
// colpi delle secondarie: contatore che si somma finché continuano ad arrivare
function navySecHit(sh, dmg, pen) {
  const E = navyHud(), now = GAME.time, H = NV.secH || (NV.secH = { n: 0, d: 0, p: 0, t: 0, ship: null });
  if (now - H.t > 2.5 || H.ship !== sh) { H.n = 0; H.d = 0; H.p = 0; H.ship = sh; }
  H.n++; H.d += dmg; if (pen) H.p++; H.t = now;
  E.secHit.textContent = 'Secondarie a segno ×' + H.n + (H.p ? ' (' + H.p + ' perforanti)' : '') + ' · ' + Math.round(H.d) + ' danni su ' + sh.name;
  E.secHit.style.opacity = 1; clearTimeout(NV.secTO); NV.secTO = setTimeout(() => E.secHit.style.opacity = 0, 2200);
  play('ping', null, { vol: .25, rate: 1.6 });
}
function navyPlayerLost() {
  after(7, () => {
    if (NV.over && !(NV.mis && NV.mis.free)) return;  // missione già vinta: la nave affonda da eroina
    if (NV.mis && NV.mis.free) { const k = NV.me.cls; NV.me = new NavShip(k, 'A', NV.me.pos.x + 3000, NV.me.pos.z + 3000, NV.me.yaw, { ai: false, spd: .5 }); showMsg('Nuova nave al comando', 3); return; }
    GAME.endTitle = 'NAVE AFFONDATA'; GAME.endText = 'La tua nave è andata a fondo.'; GAME.end(false);
  });
}

// ---------- HUD ----------
function navyHud() {
  if (NV.el) return NV.el;
  const box = document.createElement('div'); box.id = 'navyhud';
  box.innerHTML = `<div id="nvCross" style="position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none"><svg width="26" height="26"><g stroke="#fff" stroke-width="1.5" fill="none" style="filter:drop-shadow(0 0 2px #000)"><path d="M13 0v9M13 17v9M0 13h9M17 13h9"/></g></svg></div>
  <div id="nvGun" style="position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;display:none"><svg width="34" height="34"><g id="nvGunC" stroke="#ffd25a" stroke-width="2" fill="none" style="filter:drop-shadow(0 0 2px #000)"><circle cx="17" cy="17" r="11"/><path d="M17 0v8M17 26v8M0 17h8M26 17h8"/></g></svg><div id="nvGunT" style="position:absolute;left:50%;top:36px;transform:translateX(-50%);font:600 11px Oswald,sans-serif;white-space:nowrap;text-shadow:0 0 3px #000"></div></div>
  <div id="nvSec" style="position:fixed;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid #7fd3ff;transform:rotate(45deg);pointer-events:none;display:none"></div>
  <div id="nvLead" style="position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;pointer-events:none;display:none"><svg width="20" height="20"><path d="M10 1L19 10L10 19L1 10Z" stroke="#ff6a4a" stroke-width="2" fill="none"/></svg></div>
  <div id="nvLine" style="position:fixed;height:2px;transform-origin:0 50%;pointer-events:none;display:none"></div>
  <div id="nvTorp" style="position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px dashed #7fd3ff;border-radius:50%;pointer-events:none;display:none"></div>
  <div id="nvLockB" style="position:fixed;width:46px;height:30px;margin:-15px 0 0 -23px;border:2px solid #ffb43a;pointer-events:none;display:none"></div>
  <div id="nvRange" style="position:fixed;left:50%;top:calc(50% + 22px);transform:translateX(-50%);font:12px Oswald,sans-serif;color:#fff;text-shadow:0 0 3px #000;pointer-events:none;white-space:nowrap"></div>
  <div id="nvHit" style="position:fixed;left:50%;top:calc(50% - 48px);transform:translateX(-50%);font:600 15px Oswald,sans-serif;text-shadow:0 0 4px #000;pointer-events:none;opacity:0;transition:opacity .4s"></div>
  <div id="nvSecHit" style="position:fixed;left:50%;top:calc(50% + 58px);transform:translateX(-50%);font:600 13px Oswald,sans-serif;color:#7fd3ff;text-shadow:0 0 4px #000;pointer-events:none;opacity:0;transition:opacity .4s;white-space:nowrap"></div>
  <div id="nvLeft" style="position:fixed;left:14px;bottom:14px;width:250px;font:12px Oswald,sans-serif;color:#e8e2d0;background:rgba(10,14,16,.55);padding:8px 10px;border-radius:4px;pointer-events:none"></div>
  <div id="nvRight" style="position:fixed;right:14px;bottom:14px;width:230px;font:12px Oswald,sans-serif;color:#e8e2d0;background:rgba(10,14,16,.55);padding:8px 10px;border-radius:4px;pointer-events:none"></div>
  <div id="nvTgt" style="position:fixed;left:14px;top:96px;width:300px;background:rgba(10,14,16,.68);border:1px solid rgba(255,180,60,.5);border-radius:4px;padding:7px 9px;font:12px Oswald,sans-serif;color:#e8e2d0;pointer-events:none;display:none"><div id="nvTgtH"></div><canvas id="nvTgtC" width="282" height="96" style="display:block;margin:4px 0"></canvas><div id="nvTgtS"></div></div>
  <canvas id="nvRadar" width="170" height="170" style="position:fixed;right:14px;top:70px;border-radius:50%;background:rgba(8,20,24,.55);pointer-events:none"></canvas>`;
  document.body.appendChild(box);
  NV.el = { secHit: $('nvSecHit'), box, line: $('nvLine'), cross: $('nvCross'), gun: $('nvGun'), gunC: $('nvGunC'), gunT: $('nvGunT'), sec: $('nvSec'), lead: $('nvLead'), torp: $('nvTorp'), lockB: $('nvLockB'), range: $('nvRange'), hit: $('nvHit'), left: $('nvLeft'), right: $('nvRight'), radar: $('nvRadar'), tgt: $('nvTgt'), tgtH: $('nvTgtH'), tgtC: $('nvTgtC'), tgtS: $('nvTgtS') };
  return NV.el;
}
function navyHitText(t, c) { const E = navyHud(); E.hit.textContent = t; E.hit.style.color = c; E.hit.style.opacity = 1; clearTimeout(NV.hitTO); NV.hitTO = setTimeout(() => E.hit.style.opacity = 0, 1300); }
const _nvsp = new V3();
function scr(p) { _nvsp.copy(p).project(camera); if (_nvsp.z > 1 || _nvsp.z < -1) return null; return [(_nvsp.x + 1) / 2 * innerWidth, (1 - _nvsp.y) / 2 * innerHeight]; }
function place(el, p) { const s = p && scr(p); if (s) { el.style.display = 'block'; el.style.left = s[0] + 'px'; el.style.top = s[1] + 'px'; } else el.style.display = 'none'; return s; }
function updateNavyHud(dt) {
  const E = navyHud(), me = NV.me; E.box.style.display = me && P.mode === 'ship' ? 'block' : 'none'; if (!me || P.mode !== 'ship') return;
  // dove cadrebbero ora i colpi delle torri (in ritardo rispetto al mirino finché le torri ruotano)
  const tu = me.main.find(t => t.ok) || me.main[0];
  if (tu) { const T = tu.T; let r = 0; for (let i = 1; i < T.length; i++) if (T[i].e >= tu.el) { r = lerp(T[i - 1].r, T[i].r, (tu.el - T[i - 1].e) / (T[i].e - T[i - 1].e)); break; } if (tu.el >= T[T.length - 1].e) r = tableMax(T); const gp = me.toWorld(tu.x, 0, tu.z), a = me.yaw + tu.rel; place(E.gun, new V3(gp.x - Math.sin(a) * r, WATER_Y, gp.z - Math.cos(a) * r));
    const live = me.main.filter(t => t.ok && t.inArc), al = live.filter(t => t.aligned).length, rd = live.filter(t => t.aligned && t.reload <= 0).length, inR = live.some(t => t.sol);
    const col = !live.length || !inR ? '#ff6a5a' : al === live.length ? '#7fe06a' : '#ffd25a';
    E.gunC.setAttribute('stroke', col); E.gunT.style.color = col;
    E.gunT.textContent = !live.length ? 'FUORI ARCO' : !inR ? 'FUORI PORTATA' : al + '/' + live.length + ' IN PUNTERIA' + (rd < al ? ' · ' + (al - rd) + ' in ricarica' : ''); }
  // bersaglio delle secondarie
  const st = me.secs.find(t => t.ok && t.sol && t.inArc);
  if (st && (NV.secMan || NV.secAuto)) { const T = st.T; let r = 0; for (let i = 1; i < T.length; i++) if (T[i].e >= st.el) { r = lerp(T[i - 1].r, T[i].r, (st.el - T[i - 1].e) / (T[i].e - T[i - 1].e)); break; } const gp = me.toWorld(st.x, 0, st.z), a = me.yaw + st.rel; place(E.sec, new V3(gp.x - Math.sin(a) * r, WATER_Y, gp.z - Math.cos(a) * r)); } else E.sec.style.display = 'none';
  // bersaglio agganciato: anticipo (dove sarà quando arrivano i colpi) e, coi siluri, punto d'intercettazione
  if (NV.lock && NV.lock.sinking) NV.lock = null; const L = NV.lock || NV.rf;
  if (L) {
    place(E.lockB, L.pos.clone().add(new V3(0, L.C.F, 0)));
    const d = L.pos.distanceTo(me.pos), sol = tu && solveElev(tu.T, d), tof = sol ? sol.t : 0;
    const ls = place(E.lead, sol ? L.pos.clone().addScaledVector(L.vel, tof).setY(WATER_Y) : null);
    if (ls) {
      const cx = innerWidth / 2, cy = innerHeight / 2, dx = ls[0] - cx, dy = ls[1] - cy, len = Math.hypot(dx, dy);
      // tolleranza: mezza lunghezza apparente della nave bersaglio sullo schermo (minimo 6 px)
      const sl = scr(L.pos.clone().addScaledVector(L.fwd, L.C.L * .35)), sc = scr(L.pos), tol = Math.max(6, sl && sc ? Math.abs(sl[0] - sc[0]) : 6);
      const ok = Math.abs(dx) < tol; E.line.style.display = 'block'; E.line.style.left = cx + 'px'; E.line.style.top = cy + 'px'; E.line.style.width = len + 'px';
      E.line.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)'; E.line.style.background = ok ? 'rgba(110,230,100,.95)' : 'rgba(255,120,90,.7)';
      E.lead.querySelector('path').setAttribute('stroke', ok ? '#6ee664' : '#ff6a4a');
    } else E.line.style.display = 'none';
    if (me.C.torps && me.torpN > 0) { const vt = me.C.torps.kn * KN; let tt = d / vt; for (let i = 0; i < 3; i++) tt = L.pos.clone().addScaledVector(L.vel, tt).distanceTo(me.pos) / vt; place(E.torp, L.pos.clone().addScaledVector(L.vel, tt).setY(WATER_Y)); } else E.torp.style.display = 'none';
  } else { E.lockB.style.display = E.lead.style.display = E.torp.style.display = E.line.style.display = 'none'; }
  const sol = tu && solveElev(tu.T, NV.aimR);
  E.range.innerHTML = (NV.rf ? '<span style="color:#7fe06a">telemetro</span> ' : '') + Math.round(NV.aimR) + ' m' + (sol ? ' · volo ' + sol.t.toFixed(1) + ' s' : ' · <span style="color:#ff8a6a">fuori portata</span>') + (L ? '<br><span style="color:#ffb43a">' + L.name + ' · ' + Math.round(L.pos.distanceTo(me.pos)) + ' m · ' + Math.round(Math.abs(L.spd) / KN) + ' nodi</span>' : '');
  NV.hudT = (NV.hudT || 0) - dt; if (NV.hudT > 0) return; NV.hudT = .15;
  const bar = (v, c) => `<div style="height:6px;background:#222;margin:2px 0 5px"><div style="height:100%;width:${Math.max(0, v * 100)}%;background:${c}"></div></div>`;
  const tn = ['Indietro', 'Stop', '1/4', '1/2', '3/4', 'Tutta'];
  E.left.innerHTML = `<b style="font-size:14px">${me.C.name}</b><br>Scafo ${Math.max(0, Math.round(me.hp / me.hpMax * 100))}%${bar(me.hp / me.hpMax, me.hp / me.hpMax > .4 ? '#7fc06a' : '#e0604a')}` +
    `Velocità <b>${(Math.abs(me.spd) / KN).toFixed(1)} nodi</b> · telegrafo <b>${tn[me.tele + 1]}</b><br>Timone ${me.rud < -.05 ? '◀ ' : me.rud > .05 ? '▶ ' : ''}${Math.round(Math.abs(me.rud) * 35)}°${me.mod.steer < .5 ? ' <span style="color:#ff8a6a">BLOCCATO</span>' : ''}` +
    `<br>Allagamento ${Math.round(me.flood * 100)}%${me.leak > 0 ? ' <span style="color:#7fd3ff">falla</span>' : ''} · incendi ${me.fires.length}${me.mod.eng < .5 ? '<br><span style="color:#ff8a6a">Macchine danneggiate</span>' : ''}` +
    `<br>Soccorso (R): ${me.dcT > 0 ? 'al lavoro ' + Math.ceil(me.dcT) + ' s' : me.dcCool > 0 ? 'tra ' + Math.ceil(me.dcCool) + ' s' : 'pronto'}<br><small>W/S telegrafo · A/D timone · C centra · mouse mira (vicino a una nave la distanza la dà il telemetro: porta il mirino sul rombo d'anticipo) · tasto sx fuoco · Shift binocolo on/off (o tieni il tasto dx), rotella ingrandisce · F secondarie · Z segui il colpo (mouse per girargli attorno) · Q aggancia · Y squadriglia · P pilota un aereo · 1/2 munizioni${me.C.torps ? ' · T siluri' : ''} · rotella distanza</small>`;
  const S = tu ? tu.S : null;
  E.right.innerHTML = (S ? `<b>${S.name}</b> · ${S.cal >= 100 ? (NV.ammo === 'AP' ? 'perforante' : 'esplosivo') : 'mitragliere'}<br><small>${Math.round(S.v)} m/s · ${S.m >= 1 ? S.m + ' kg' : Math.round(S.m * 1000) + ' g'} · perfora ${Math.round(penDeMarre(S, S.v))} mm alla bocca</small><br>` : '') +
    me.main.map((t, i) => `<span style="display:inline-block;width:46px">${t.G.mounts.length > 3 ? 'T' + (i + 1) : 'A' + (i + 1)}</span><span style="display:inline-block;width:150px;height:6px;background:#222;vertical-align:middle"><span style="display:block;height:100%;width:${t.ok ? (1 - t.reload / t.G.reload) * 100 : 0}%;background:${!t.ok ? '#e0604a' : t.reload <= 0 ? (t.aligned ? '#7fc06a' : '#c9b25a') : '#6a8aa0'}"></span></span>`).slice(0, 8).join('<br>') +
    (me.secs.length ? `<br><b>Secondarie</b> ${me.secs[0].S.name} ×${me.secs.reduce((a, t) => a + t.muzzles.length, 0)} · ${NV.secMan ? '<span style="color:#7fd3ff">a comando</span>' : NV.secAuto ? 'automatiche' : 'ferme'}<br><small>F spara dove miri · G automatiche on/off</small>` : '') +
    (me.C.torps ? `<br>Siluri: <b>${me.torpN}</b>${me.torpT > 0 ? ' (ricarica ' + Math.ceil(me.torpT) + ' s)' : ''}` : '');
  drawRadar(E.radar);
  drawTargetCard(E, NV.lock && !NV.lock.sinking ? NV.lock : null);
}
function drawRadar(cv) {
  const g = cv.getContext('2d'), me = NV.me, R0 = 85, sc = R0 / 16000;
  g.clearRect(0, 0, 170, 170); g.strokeStyle = 'rgba(160,210,220,.25)'; for (const r of [.33, .66, 1]) { g.beginPath(); g.arc(85, 85, R0 * r - 1, 0, TAU); g.stroke(); }
  const cs = Math.cos(NV.cam.yaw), sn = Math.sin(NV.cam.yaw);
  for (const I of NV.islands) { const dx = I.x - me.pos.x, dz = I.z - me.pos.z, x = (dx * cs - dz * sn) * sc, y = (dx * sn + dz * cs) * sc; g.fillStyle = 'rgba(140,130,100,.6)'; g.beginPath(); g.arc(85 + x, 85 + y, Math.max(2, I.r * sc), 0, TAU); g.fill(); }
  for (const s of NV.ships) {
    if (s.sinking) continue; const dx = s.pos.x - me.pos.x, dz = s.pos.z - me.pos.z, x = (dx * cs - dz * sn) * sc, y = (dx * sn + dz * cs) * sc; if (x * x + y * y > R0 * R0) continue;
    g.fillStyle = s === me ? '#fff' : s.team === me.team ? '#7fc0ff' : '#ff6a5a'; g.save(); g.translate(85 + x, 85 + y); g.rotate(-(s.yaw - NV.cam.yaw)); g.fillRect(-1.5, -4, 3, 8); g.restore();
  }
  for (const T of NV.torps) { const dx = T.p.x - me.pos.x, dz = T.p.z - me.pos.z, x = (dx * cs - dz * sn) * sc, y = (dx * sn + dz * cs) * sc; g.fillStyle = T.by.team === me.team ? '#9fe' : '#ff0'; g.fillRect(85 + x - 1, 85 + y - 1, 2, 2); }
}

// ---------- missioni ----------
const NAVY_MIS = {
  dd: { name: 'Caccia nella Manica', ship: 'fletcher', brief: 'Due Zerstörer e due Schnellboote razziano la Manica. Affondali tutti.',
    setup() { navyIslands(3); NV.me = new NavShip(navyPick('fletcher'), 'A', 0, 0, 0, { ai: false }); for (const [x, z, k] of [[2500, -12000, 'z1934'], [3600, -11400, 'z1934'], [-4000, -9000, 'sboot'], [-3400, -9500, 'sboot']]) new NavShip(k, 'E', x, z, PI * .1, { spd: .8 }); },
    obj() { const n = NV.ships.filter(s => s.team === 'E' && !s.sinking).length; return [n === 0, 'Affonda la flottiglia tedesca — restano ' + n]; } },
  pt: { name: 'Siluri sul convoglio', ship: 'elco', brief: 'Un convoglio tedesco costeggia le isole. Avvicinati e silura almeno due mercantili.',
    setup() { navyIslands(5); NV.me = new NavShip(navyPick('elco'), 'A', 0, 0, 0, { ai: false });
      const route = () => [{ x: -14000, z: -4200 }, { x: -30000, z: -4200 }];
      for (let i = 0; i < 3; i++) new NavShip('cargo', 'E', 2600 - i * 600, -4200 + (i % 2) * 300, PI / 2, { route: route(), spd: .9, name: 'Mercantile ' + ['Elbe', 'Weser', 'Ems'][i], tag: 'cargo' });
      new NavShip('z1934', 'E', 2900, -5000, PI / 2, { spd: .5 }); for (const [x, z] of [[2000, -3400], [1200, -5200]]) new NavShip('sboot', 'E', x, z, PI / 2, { spd: .5 }); },
    obj() { const sunk = NV.ships.filter(s => s.tag === 'cargo' && s.sinking).length + (NV.cargoGone || 0); return [sunk >= 2, 'Affonda i mercantili — ' + sunk + '/2']; } },
  escort: { name: 'Scorta al convoglio', ship: 'cleveland', brief: 'Proteggi i trasporti alleati fino all\'arrivo: resisti 7 minuti, non perderne più di due.',
    setup() { navyIslands(2); NV.me = new NavShip(navyPick('cleveland'), 'A', 600, 0, -PI / 2, { ai: false, spd: .3 }); NV.waveT = [15, 120, 250]; NV.escT = 420;
      for (let i = 0; i < 4; i++) new NavShip('cargo', 'A', -i * 500, 900 + (i % 2) * 350, -PI / 2, { route: [{ x: 30000, z: 900 }], spd: .9, name: 'Liberty ' + ['Ohio', 'Iowa', 'Maine', 'Utah'][i], tag: 'liberty' }); },
    tick(dt) { NV.escT -= dt; const w = NV.waveT; for (let i = 0; i < w.length; i++) if (w[i] > 0 && (w[i] -= dt) <= 0) { const mp = NV.me.pos; const sets = [[['sboot', 1], ['sboot', -1], ['sboot', 0]], [['z1934', 1], ['z1934', .5]], [['nurnberg', 0], ['sboot', 1], ['sboot', -1]]][i]; for (const [k, o] of sets) new NavShip(k, 'E', mp.x + 6000 + o * 900, mp.z - 11000 - Math.abs(o) * 600, PI * .85, { spd: .8 }); feed('Radar: navi nemiche in avvicinamento da nord!'); } },
    obj() { const lost = NV.ships.filter(s => s.tag === 'liberty' && s.sinking).length + (NV.libLost || 0); if (lost > 2) return [false, 'Convoglio perduto', true]; return [NV.escT <= 0, 'Scorta il convoglio — ' + Math.ceil(NV.escT) + ' s · trasporti persi ' + lost + '/2']; } },
  line: { weather: 'burrasca', name: 'Battaglia di linea', ship: 'texas', brief: 'La Scharnhorst è uscita con due cacciatorpediniere. Affondala.',
    setup() { navyIslands(2); NV.me = new NavShip(navyPick('texas'), 'A', 0, 0, 0, { ai: false }); new NavShip('fletcher', 'A', -500, 700, 0, { name: 'USS Nelson' }); new NavShip('fletcher', 'A', 600, 900, 0, { name: 'USS Glennon' });
      new NavShip('scharnhorst', 'E', 4000, -19000, PI * .9, { spd: .8, tag: 'flag', name: 'Scharnhorst' }); new NavShip('z1934', 'E', 3000, -17500, PI * .9, { spd: .8 }); new NavShip('z1934', 'E', 5200, -18000, PI * .9, { spd: .8 }); },
    obj() { const s = NV.ships.find(s => s.tag === 'flag'); return [!s || s.sinking, s ? 'Affonda la Scharnhorst — ' + Math.round(s.pos.distanceTo(NV.me.pos) / 100) / 10 + ' km · scafo ' + Math.max(0, Math.round(s.hp / s.hpMax * 100)) + '%' : '']; } },
  maine: { name: 'Il mostro d\u2019acciaio', ship: 'maine', brief: 'La super corazzata Maine contro la squadra tedesca al completo: Scharnhorst, Nürnberg e quattro Zerstörer.',
    setup() { navyIslands(3); NV.me = new NavShip(navyPick('maine'), 'A', 0, 0, 0, { ai: false }); new NavShip('fletcher', 'A', -600, 900, 0, { name: 'USS Kidd' }); new NavShip('fletcher', 'A', 700, 1100, 0, { name: 'USS Bullard' });
      new NavShip('scharnhorst', 'E', 5000, -26000, PI * .9, { spd: .8, tag: 'flag', name: 'Scharnhorst' }); new NavShip('nurnberg', 'E', 2500, -24000, PI * .9, { spd: .8 });
      for (const [x, z] of [[3000, -22000], [6500, -23000], [1000, -21500], [8000, -24500]]) new NavShip('z1934', 'E', x, z, PI * .9, { spd: .8 }); },
    obj() { const n = NV.ships.filter(s => s.team === 'E' && !s.sinking).length; return [n === 0, 'Affonda la squadra tedesca — restano ' + n]; } },
  midway: { weather: 'sereno', sun: [-.3, .7, .4], name: 'Midway — 4 giugno 1942', ship: 'fletcher', brief: 'Bombardieri in picchiata del gruppo aereo della Enterprise: la flotta di Nagumo è sotto di voi. Affondate le portaerei!',
    setup() {
      for (const [x, z, r] of [[9000, 21000, 900], [10400, 21600, 500]]) NV.islands.push({ x, z, r, h: 6, flat: true });   // atollo di Midway
      for (const I of NV.islands) buildIsland(I);
      NV.me = new NavShip(navyPick('fletcher'), 'A', 2000, 26000, 0, { ai: false, spd: .5, name: 'USS Hammann' });
      const route = (x, z) => [{ x: x - 30000, z }, { x: x - 60000, z }];
      const jp = [['akagi', 0, 0], ['kaga', -1600, 900], ['soryu', 1500, 1200], ['kirishima', 0, -2200], ['kagero', 2600, -1200], ['kagero', -2600, -1000], ['kagero', 2800, 2600], ['kagero', -2900, 2800]];
      for (const [k, x, z] of jp) new NavShip(k, 'E', x, z, PI / 2, { route: route(x, z), spd: .8, tag: NCLS[k].type === 'cv' ? 'cv' : '' });
      // la pattuglia di Zero sopra le portaerei e gli altri gruppi d'attacco americani
      for (let i = 0; i < 8; i++) new NavPlane('zero', 'E', new V3(rnd(-2500, 2500), 2600 + i * 40, rnd(-2000, 2500)), R() * TAU, { cap: NV.ships.find(s => s.cls === 'akagi') });
      for (let i = 0; i < 9; i++) new NavPlane('sbd', 'A', new V3(-3000 + (i % 3) * 70, 4300 + i * 15, 12500 + Math.floor(i / 3) * 80), 0, { target: NV.ships.find(s => s.cls === ['akagi', 'kaga', 'soryu'][i % 3]) });
      for (let i = 0; i < 6; i++) new NavPlane('tbf', 'A', new V3(3000 + (i % 3) * 70, 350, 13000 + Math.floor(i / 3) * 80), 0, { target: NV.ships.find(s => s.cls === ['kaga', 'akagi', 'soryu'][i % 3]) });
      NV.escT = 720;
      // il giocatore guida il capo pattuglia
      after(.2, () => { enterPlane({ type: 'sbd', pos: new V3(-2600, 4500, 12000), vel: new V3(0, 0, -95) }); PL.bombs = 1; showMsg('Sei il capo pattuglia: picchiata sulla portaerei, Spazio sgancia la bomba · P per tornare alla nave', 6); });
    },
    tick(dt) { NV.escT -= dt; },
    obj() {
      const cv = NV.ships.filter(s => s.tag === 'cv'), sunk = cv.filter(s => s.sinking).length + (3 - cv.length);
      if (NV.escT <= 0 && sunk < 3) return [false, 'La flotta giapponese si è ritirata', true];
      return [sunk >= 3, 'Affonda le portaerei — ' + sunk + '/3 · ' + Math.max(0, Math.ceil(NV.escT)) + ' s · abbattuti ' + (NAIR.kills || 0)];
    } },
  pearl: { weather: 'sereno', sun: [.85, .2, -.35], name: 'Pearl Harbor — 7 dicembre 1941', ship: 'fletcher', brief: 'Domenica mattina, 7:55. Aerei giapponesi su Pearl Harbor! Posti di combattimento: difendi la flotta in rada.',
    setup() {
      // rada: Ford Island al centro, colline di Oahu tutt'attorno con l'ingresso del canale a sud
      NV.islands.push({ x: 0, z: 0, r: 720, h: 5, flat: true });
      for (const [x, z, r, h] of [[-3300, -200, 2000, 120], [200, -3400, 2100, 160], [3500, -600, 1900, 110], [-2900, 2900, 1500, 70], [2900, 2900, 1500, 80], [-5200, -4200, 2600, 260], [4800, -4800, 2600, 220]]) NV.islands.push({ x, z, r, h });
      for (const I of NV.islands) buildIsland(I);
      pearlFordIsland();
      NV.me = new NavShip(navyPick('fletcher'), 'A', 350, 1500, PI, { ai: false, spd: .2, tele: 2, name: 'USS Helm' });
      if (NV.me.C === NCLS.fletcher) NV.me.name = 'USS Helm';
      // Battleship Row: corazzate ormeggiate a coppie lungo Ford Island
      const row = [['Nevada', -560, 0], ['Arizona', -350, 0], ['Tennessee', -130, 0], ['West Virginia', -130, 1], ['Maryland', 90, 0], ['Oklahoma', 90, 1], ['California', 320, 0]];
      for (const [n, z, out] of row) { const s = new NavShip('texas', 'A', 770 + out * 31, z, 0, { spd: 0, tele: 0, name: 'USS ' + n, tag: 'bb' }); s.ai = false; s.moored = true; s.spd = 0; }
      NV.waveT = [6, 160, 300]; NV.pT = 60; NV.escT = 480; NAIR.kills = 0; NAIR.aaRamp = 0;  // sorpresa: la contraerea si arma in ~90 s
      play('air_raid', null, { vol: .6 }); after(2.5, () => play('gq_siren', null, { vol: .5 }));
    },
    tick(dt) {
      NV.escT -= dt; const w = NV.waveT;
      const raids = [['kate', 'kate', 'kate', 'kate', 'kate', 'kate', 'val', 'val', 'val', 'val', 'zero', 'zero', 'zero', 'zero'], ['val', 'val', 'val', 'val', 'val', 'val', 'zero', 'zero', 'zero', 'zero'], ['kate', 'kate', 'kate', 'kate', 'val', 'val', 'val', 'val', 'zero', 'zero']];
      for (let i = 0; i < 3; i++) if (w[i] > 0 && (w[i] -= dt) <= 0) { navyAirRaid(raids[i], [0, 1.2, -1][i] + PI, 9000); banner(['PRIMA ONDATA', 'SECONDA ONDATA', 'TERZA ONDATA'][i], raids[i].length + ' aerei giapponesi'); play('air_raid', null, { vol: .35 }); }
      if (NV.pT > 0 && (NV.pT -= dt) <= 0) { for (let i = 0; i < 4; i++) new NavPlane('p40', 'A', new V3(-6000 + i * 60, 900 + i * 20, 1500), PI / 2); say('Radio', 'Welch e Taylor sono decollati da Haleiwa coi P-40! P per pilotarne uno.'); }
    },
    obj() {
      const bb = NV.ships.filter(s => s.tag === 'bb'), afloat = bb.filter(s => !s.sinking).length;
      if (afloat < 3) return [false, 'La flotta da battaglia è perduta', true];
      return [NV.escT <= 0, 'Resisti all\u2019attacco — ' + Math.max(0, Math.ceil(NV.escT)) + ' s · aerei abbattuti ' + (NAIR.kills || 0) + ' · corazzate a galla ' + afloat + '/7'];
    } },
  free: { name: 'Battaglia libera', free: true, brief: 'Ondate di navi nemiche sempre più forti.',
    setup() { navyIslands(4); NV.me = new NavShip(navyPick('fletcher'), 'A', 0, 0, 0, { ai: false }); NV.free = { wave: 0, t: 5 }; },
    tick(dt) { const left = NV.ships.filter(s => s.team === 'E' && !s.sinking).length; if (left === 0) { NV.free.t -= dt; if (NV.free.t <= 0) { const w = ++NV.free.wave, mp = NV.me.pos, a = R() * TAU, d = { pt: 6000, dd: 11000, cl: 14000, bb: 18000 }[NV.me.C.type];
      const pool = w < 2 ? ['sboot', 'sboot'] : w < 3 ? ['z1934', 'sboot', 'sboot'] : w < 5 ? ['z1934', 'z1934', 'sboot'] : w < 7 ? ['nurnberg', 'z1934', 'sboot', 'sboot'] : ['scharnhorst', 'z1934', 'z1934', 'nurnberg'];
      pool.forEach((k, i) => new NavShip(k, 'E', mp.x + Math.sin(a) * d + i * 700, mp.z + Math.cos(a) * d + i * 500, a, { spd: .8 })); banner('ONDATA ' + w, pool.length + ' navi nemiche'); NV.free.t = 8; } } },
    obj() { return [false, 'Ondata ' + NV.free.wave + ' · affondate ' + STATS.kills]; } },
};
// nave del giocatore: quella scelta nel menu, oppure quella prevista dalla missione
function navyPick(def) { return NV.freeShip && NV.freeShip !== 'mission' && NCLS[NV.freeShip] ? NV.freeShip : def; }
function pearlFordIsland() {
  const mb = new MB(), y = 5;
  mb.add(U.box, 0x6d6a60, 0, y + .05, -100, 0, .3, 0, 60, .1, 900);   // pista
  for (const [x, z] of [[-300, -200], [-300, -60], [-300, 80], [-200, 260]]) { mb.add(U.box, 0x8a8e8a, x, y + 9, z, 0, 0, 0, 70, 18, 50); mb.add(U.box, 0x5c605c, x, y + 18.5, z, 0, 0, 0, 72, 1, 52); }
  mb.add(U.box, 0xb9b4a2, 150, y + 14, -350, 0, 0, 0, 10, 28, 10); mb.add(U.box, 0x3a3f42, 150, y + 29, -350, 0, 0, 0, 13, 3, 13);   // torre di controllo
  for (let i = 0; i < 8; i++) { const x = -150 + (i % 4) * 40, z = 380 + Math.floor(i / 4) * 40; mb.add(U.cyl12, 0xa8a69c, x, y + 7, z, 0, 0, 0, 15, 14, 15); }   // serbatoi
  for (let i = 0; i < 30; i++) { const a = R() * TAU, d = rnd(100, 600); mb.add(U.cyl, 0x6a5a40, Math.cos(a) * d * .7, y + 4, Math.sin(a) * d, 0, 0, 0, .3, 8, .3); mb.add(U.sph, 0x3f5a2a, Math.cos(a) * d * .7, y + 9, Math.sin(a) * d, 0, 0, 0, 3, 1.5, 3); }   // palme
  scene.add(groupMesh(mb.buildGroups(), true));
}
function navyIslands(n) {
  let s = 1;
  for (let i = 0; i < n; i++) { const a = i * 2.4 + 1, d = 4000 + i * 2600; NV.islands.push({ x: Math.cos(a) * d, z: -Math.abs(Math.sin(a)) * d - 2000, r: rnd(500, 1300), h: rnd(40, 110) }); s++; }
  for (const I of NV.islands) buildIsland(I);
}

// ---------- scenario ----------
// meteo navale: sereno, coperto o burrasca (onde più alte, pioggia, lampi); ora del giorno dal sole
const NAVY_WX = {
  sereno: { cover: -.12, gray: 0, fog: .009, waves: 1, sun: 1.05, fogc: [.68, .75, .8] },
  coperto: { cover: .22, gray: .45, fog: .015, waves: 1.3, sun: .7, fogc: [.62, .66, .69] },
  burrasca: { cover: .42, gray: .85, fog: .028, waves: 2.3, sun: .45, fogc: [.47, .5, .53], rain: true },
};
function applyNavyWeather(kind, sunDir) {
  const W = NAVY_WX[kind] || NAVY_WX.coperto; NV.wx = kind; NV.wxW = W;
  if (sunDir) SUN_DIR.set(...sunDir).normalize();
  if (skyMat) { skyMat.uniforms.uCover.value = W.cover; skyMat.uniforms.uGray.value = W.gray; }
  FOG_K = W.fog; FOG_COL.setRGB(...W.fogc); scene.fog.color.copy(FOG_COL); scene.fog.density = FOG_BASE * FOG_K;
  if (sun) sun.intensity *= W.sun;
  for (const w of WAVES) w[2] = w[4] * W.waves;
  if (NV.ocean) NV.ocean.material.uniforms.uW.value.forEach((v, i) => v.z = WAVES[i][2]);
  if (W.rain && typeof buildSnowfall === 'function') buildSnowfall(true);
}
// nuvole vere sopra il mare (gli aerei ci passano attraverso)
function buildNavyClouds(n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  for (let i = 0; i < 16; i++) { const x = 64 + rnd(-32, 32), y = 64 + rnd(-18, 18), r = rnd(16, 40), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const tex = new THREE.CanvasTexture(cv), shade = 1 - (NV.wxW ? NV.wxW.gray * .62 : 0);
  const mats = [new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .92, color: new THREE.Color(shade, shade, shade * 1.01) }), new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .85, color: new THREE.Color(shade * .82, shade * .84, shade * .87) })];
  const grp = new THREE.Group();
  for (let c = 0; c < n; c++) {
    const cx = rnd(-26000, 26000), cz = rnd(-26000, 26000), cy = rnd(800, 1700);
    for (let i = 0; i < 8; i++) { const big = 1 + (NV.wxW ? NV.wxW.gray : 0), sp = new THREE.Sprite(mats[i % 3 ? 0 : 1]), sc = rnd(320, 700) * big; sp.scale.set(sc * 1.8, sc * .8, 1); sp.position.set(cx + rnd(-420, 420) * big, cy + rnd(-40, 90) - (i % 3 ? 0 : 60), cz + rnd(-300, 300) * big); grp.add(sp); }
  }
  scene.add(grp); NV.clouds = grp;
}
function updateNavyWeather(dt) {
  if (typeof ARD !== 'undefined' && ARD.snow) updateSnowfall(dt);
  if (NV.wx !== 'burrasca') return;
  // lampi e tuoni lontani
  NV.ltT = (NV.ltT ?? rnd(6, 14)) - dt;
  if (NV.ltT <= 0) { NV.ltT = rnd(8, 20); if (gradePass) gradePass.uniforms.uFlash.value = .55; after(rnd(1.5, 4), () => play('boom_far', null, { vol: .5, rate: .6 })); }
}
function buildNavyWorld() {
  WORLD.mortarPits = []; WORLD.aaSites = []; WORLD.tobruks = []; WORLD.bombard = 'off';
  buildWater(); scene.traverse(o => { if (o.material === waterMat) o.visible = false; });
  buildOcean();
}
function initNavy() {
  const M = NAVY_MIS[NV.misKey] || NAVY_MIS.dd; NV.mis = M;
  M.setup();
  P.mode = 'ship'; P.inBoat = false; P.boat = null; P.pos.copy(NV.me.pos);
  NV.cam.yaw = NV.me.yaw; NV.cam.pitch = -.02; camera.near = 2.5; camera.updateProjectionMatrix();
  applyNavyWeather(M.weather || (NV.misKey === 'free' ? pick(['sereno', 'coperto', 'coperto', 'burrasca']) : 'coperto'), M.sun);
  buildNavyClouds(NV.wx === 'burrasca' ? 80 : NV.wx === 'coperto' ? 70 : 40);
  MISSION.stage = 0; MISSION.markers = [];
  GAME.endTitle = null; GAME.endText = null;
  say('Radio', M.brief);
}
function updateNavy(dt) {
  const t = GAME.time; updateNavyWeather(dt);
  updateOcean(t);
  updateNavAir(dt);
  for (const s of NV.ships.slice()) { if ((s !== NV.me && s.ai) || (s === NV.me && P.mode !== 'ship' && !s.sinking)) { for (const tu of s.turrets) tu.reload = Math.max(0, tu.reload - dt); s.torpT = Math.max(0, s.torpT - dt); aiShip(s, dt, t); } s.update(dt, t); }
  // navi che si toccano: si spingono e si danneggiano
  for (let i = 0; i < NV.ships.length; i++) for (let j = i + 1; j < NV.ships.length; j++) {
    const a = NV.ships[i], b = NV.ships[j], d = a.pos.distanceTo(b.pos), r = (a.C.L + b.C.L) * .3; if (d > r || d < 1 || (a.moored && b.moored)) continue;
    const l = b.toLocal(a.pos, _nvc); if (Math.abs(l.x) > b.C.B / 2 + a.C.B / 2 || Math.abs(l.z) > b.C.L / 2 + a.C.B / 2) continue;
    const n = _nvd.subVectors(a.pos, b.pos).setY(0).normalize(), rv = a.vel.clone().sub(b.vel).dot(n);
    a.pos.addScaledVector(n, 1); b.pos.addScaledVector(n, -1);
    if (rv < -1) { const imp = -rv; a.damage(imp * b.C.L * .8, b, 'ram'); b.damage(imp * a.C.L * .8, a, 'ram'); a.spd *= .5; b.spd *= .5; if (a === NV.me || b === NV.me) { P.shake += 1; play('imp_metal', null, { vol: 1, rate: .4 }); showMsg('Collisione!', 1.5); } }
  }
  updateShells(dt); updateTorps(dt); updateSlicks(dt);
  // mercantili che escono dalla mappa: contano come fuggiti
  for (const s of NV.ships) if (s.tag && s.route && s.route.length === 0 && !s.sinking && s.tag === 'cargo') { NV.cargoGone = NV.cargoGone || 0; }
  const M = NV.mis; if (M.tick) M.tick(dt);
  const [win, txt, lose] = M.obj();
  MISSION.objText = txt;
  MISSION.markers = P.adsHeld || NV.zoomOn ? [] : NV.ships.filter(s => s !== NV.me && !s.sinking && s.pos.distanceTo(NV.me.pos) < (s.team === NV.me.team ? 3000 : 25000)).map(s => ({ pos: s.pos.clone().add(new V3(0, s.C.F + 25, 0)), label: (s.name !== s.C.name ? s.name : s.C.name.replace(/^(Cacciatorpediniere|Incrociatore leggero|Corazzata|Super corazzata) /, '')) + ' · ' + (s.pos.distanceTo(NV.me.pos) / 1000).toFixed(1) + ' km', friend: s.team === NV.me.team }));
  if (!NV.over && win) { NV.over = true; banner('MISSIONE COMPIUTA', M.name); addScore(2000, 'Missione compiuta', '#9fe08a'); GAME.endTitle = 'VITTORIA NAVALE'; GAME.endText = M.name + ': obiettivo raggiunto.'; after(7, () => GAME.end(true)); }
  if (!NV.over && lose) { NV.over = true; banner('MISSIONE FALLITA', txt); GAME.endTitle = 'MISSIONE FALLITA'; GAME.endText = txt; after(5, () => GAME.end(false)); }
  updateNavyHud(dt);
}
function navyDeployPoints() { return [{ label: NV.me ? NV.me.C.name : 'Nave', sub: 'torna al comando', kind: 'navy', pos: NV.me ? NV.me.pos : new V3() }]; }

// ---------- scheda del bersaglio agganciato: sagoma dall'alto, scafo, condizioni e colpi a segno ----------
function drawTargetCard(E, T) {
  if (!T) { E.tgt.style.display = 'none'; return; }
  E.tgt.style.display = 'block';
  const C = T.C, me = NV.me, d = T.pos.distanceTo(me.pos), hp = Math.max(0, T.hp / T.hpMax);
  const rel = wrapA(Math.atan2(-(me.pos.x - T.pos.x), -(me.pos.z - T.pos.z)) - T.yaw), aspect = Math.round(Math.abs(rel) * 180 / PI);
  E.tgtH.innerHTML = '<b style="font-size:14px;color:#ffcf7a">' + T.name + '</b><br>' + (d / 1000).toFixed(1) + ' km · ' + Math.round(Math.abs(T.spd) / KN) + ' nodi · angolo ' + aspect + '°' +
    '<div style="height:7px;background:#222;margin:4px 0 0"><div style="height:100%;width:' + hp * 100 + '%;background:' + (hp > .5 ? '#7fc06a' : hp > .25 ? '#e0b04a' : '#e0604a') + '"></div></div>';
  const g = E.tgtC.getContext('2d'), W = 282, Hh = 96, sc = Math.min((W - 16) / C.L, (Hh - 20) / C.B, 3.2), cx = W / 2, cy = Hh / 2;
  g.clearRect(0, 0, W, Hh);
  // scafo visto dall'alto (prua a sinistra) con l'allagamento in azzurro dal basso
  const hw = t => C.B / 2 * (t < .3 ? Math.pow(Math.max(t, .002) / .3, .55) : t > .82 ? 1 - ((t - .82) / .18) ** 2 * .3 : 1);
  g.beginPath(); for (let k = 0; k <= 40; k++) { const t = k / 40; g.lineTo(cx + (-C.L / 2 + t * C.L) * sc, cy - hw(t) * sc); } for (let k = 40; k >= 0; k--) { const t = k / 40; g.lineTo(cx + (-C.L / 2 + t * C.L) * sc, cy + hw(t) * sc); } g.closePath();
  g.fillStyle = 'rgba(150,160,165,.35)'; g.fill(); g.strokeStyle = 'rgba(220,225,230,.85)'; g.lineWidth = 1.2; g.stroke();
  if (T.flood > 0) { g.save(); g.clip(); g.fillStyle = 'rgba(80,160,230,.45)'; const h = C.B * sc * T.flood; g.fillRect(0, cy + C.B / 2 * sc - h, W, h); g.restore(); }
  // cittadella corazzata
  if (C.type === 'bb' || C.type === 'cl') { g.strokeStyle = 'rgba(200,190,150,.5)'; g.setLineDash([3, 3]); g.strokeRect(cx - C.L * .27 * sc, cy - C.B * .42 * sc, C.L * .54 * sc, C.B * .84 * sc); g.setLineDash([]); }
  // torri: verdi efficienti, rosse fuori uso; le secondarie più piccole
  for (const tu of T.turrets) { g.beginPath(); g.arc(cx + tu.z * sc, cy + tu.x * sc, Math.max(1.6, (tu.sec ? 1.6 : 3.4) * Math.min(sc, 1.6)), 0, TAU); g.fillStyle = tu.ok ? (tu.sec ? '#8fb0a0' : '#7fd07a') : '#ff5a4a'; g.fill(); }
  // incendi
  for (const fi of T.fires) if (fi.lp) { g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(cx + fi.lp.z * sc, cy + fi.lp.x * sc, 4, 0, TAU); g.fill(); g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(cx + fi.lp.z * sc, cy + fi.lp.x * sc, 1.8, 0, TAU); g.fill(); }
  // colpi a segno: rossi perforanti, grigi non perforanti; i più recenti lampeggiano
  for (const h of T.hitLog || []) {
    const x = cx + h.z * sc, y = cy + clamp(h.x, -C.B / 2, C.B / 2) * sc, fresh = GAME.time - h.t < 1.5;
    if (h.cit) { g.fillStyle = '#ffd23a'; g.fillRect(x - 3.5, y - 3.5, 7, 7); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(x - 3.5, y - 3.5, 7, 7); continue; }
    g.strokeStyle = h.pen ? '#ff4a3a' : '#c8c8c8'; g.lineWidth = fresh ? 2.2 : 1.4; const r = h.big ? 3.2 : 1.8;
    g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
    if (fresh) { g.beginPath(); g.arc(x, y, 6 + (GAME.time - h.t) * 6, 0, TAU); g.strokeStyle = 'rgba(255,200,90,' + (1 - (GAME.time - h.t) / 1.5) + ')'; g.stroke(); }
  }
  g.fillStyle = 'rgba(232,226,208,.6)'; g.font = '10px Oswald,sans-serif'; g.fillText('prua', 3, cy + 3);
  const tOk = T.main.filter(t => t.ok).length, hits = (T.hitLog || []).length, pens = (T.hitLog || []).filter(h => h.pen).length;
  const st = [];
  st.push('Torri ' + tOk + '/' + T.main.length);
  st.push(T.mod.eng < .5 ? '<span style="color:#ff8a6a">macchine colpite</span>' : 'macchine ok');
  st.push(T.mod.steer < .5 ? '<span style="color:#ff8a6a">timone bloccato</span>' : 'timone ok');
  if (T.fires.length) st.push('<span style="color:#ffaa4a">' + T.fires.length + ' incendi</span>');
  if (T.flood > .01 || T.leak > 0) st.push('<span style="color:#7fc3ff">allagamento ' + Math.round(T.flood * 100) + '%</span>');
  E.tgtS.innerHTML = st.join(' · ') + '<br><small>Colpi a segno: ' + hits + ' (perforanti ' + pens + ') · corazza: cintura ' + C.belt + ' mm, ponte ' + C.deck + ' mm</small>';
}

// ---------- segni dei colpi sullo scafo ----------
let _nburnt = null;
const NAVY_BURNT = () => _nburnt || (_nburnt = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: .95, metalness: .1 }));
const NVM = { geo: null, hole: null, scorch: null, dent: null };
function navyMark(sh, lp, ax, pen, cal, part) {
  // solo scafo e ponte (la sovrastruttura è una sagoma approssimata: il segno resterebbe sospeso) e solo dai 100 mm in su
  if (part !== 'hull' || cal < 100) return;
  if (!NVM.geo) {
    NVM.geo = new THREE.CircleGeometry(1, 10);
    const mk = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    NVM.hole = mk(0x0b0a09, .95); NVM.scorch = mk(0x1d1712, .6); NVM.dent = mk(0x4a4c4e, .7);
  }
  const C = sh.C, hd = sh.hd, add = (mat, r, off) => {
    const m = new THREE.Mesh(NVM.geo, mat); m.scale.setScalar(r); let x = lp.x, y = lp.y, z = lp.z;
    if (hd && part === 'hull') { const t = clamp((z + C.L / 2) / C.L, 0, 1); if (ax === 0) x = Math.sign(x || 1) * (hd.hw(t) + .06 + off); if (ax === 1) y = hd.sheer(t) + .06 + off; }
    m.position.set(x, y, z);
    if (ax === 0) m.rotation.y = x > 0 ? PI / 2 : -PI / 2; else if (ax === 1) m.rotation.x = -PI / 2; else m.rotation.y = z > 0 ? 0 : PI;
    m.renderOrder = 2; sh.body.add(m); sh.marks.push(m);
    if (sh.marks.length > 90) sh.body.remove(sh.marks.shift());
  };
  // grossi calibri: alone bruciato attorno al foro; perforanti: foro nero; non perforanti: scalfittura chiara
  if (pen) add(NVM.scorch, cal / 90 + .8, 0);
  add(pen ? NVM.hole : NVM.dent, Math.max(.2, cal / (pen ? 450 : 1000)), .01);
}
// ---------- nastri dei risultati (stile World of Warships) ----------
const RIB = { plane: ['Aereo abbattuto', '#9fe08a'], cit: ['CITTADELLA', '#ffd23a'], pen: ['Perforazione', '#ffb04a'], over: ['Sovrapperforazione', '#c9d2d8'], nopen: ['Non perforato', '#9aa3a8'], rico: ['Rimbalzo', '#9aa3a8'], hit: ['Colpo', '#c9d2d8'], fire: ['Incendio', '#ff8a3a'], flood: ['Allagamento', '#6fb8ff'], torp: ['Siluro', '#7fd3ff'] };
function navyRibbon(k) {
  if (!RIB[k]) return;
  let box = $('nvRib');
  if (!box) { box = document.createElement('div'); box.id = 'nvRib'; box.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:6px;pointer-events:none;font:600 12px Oswald,sans-serif;z-index:6'; document.body.appendChild(box); }
  NV.ribs = NV.ribs || {}; NV.ribs[k] = (NV.ribs[k] || 0) + 1;
  let el = box.querySelector('[data-k="' + k + '"]');
  if (!el) { el = document.createElement('div'); el.dataset.k = k; el.style.cssText = 'padding:3px 8px;border-radius:3px;background:rgba(10,14,16,.7);border:1px solid ' + RIB[k][1] + ';color:' + RIB[k][1] + ';transition:transform .15s'; box.appendChild(el); }
  el.textContent = RIB[k][0] + ' ×' + NV.ribs[k];
  el.style.transform = 'scale(1.25)'; setTimeout(() => el.style.transform = 'scale(1)', 160);
  if (k === 'cit') play('ping', null, { vol: .5, rate: .8 });
}

// chiazza di nafta: disco scuro iridescente che si allarga sull'acqua, con fiamme sparse
const _slickTex = { t: null };
function navySlick(p, L) {
  if (!_slickTex.t) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(14,12,10,.85)'); gr.addColorStop(.6, 'rgba(24,20,16,.55)'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,40,70,.08)'; g.beginPath(); g.arc(64 + rnd(-40, 40), 64 + rnd(-40, 40), rnd(4, 14), 0, 7); g.fill(); } _slickTex.t = new THREE.CanvasTexture(cv); }
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ map: _slickTex.t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -PI / 2; m.position.set(p.x, WATER_Y + .08, p.z); m.scale.setScalar(L * .3); m.renderOrder = 1; scene.add(m);
  const o = { m, r: L * .3, max: L * 1.4, t: 0 }; NV.slicks = NV.slicks || []; NV.slicks.push(o); return o;
}
function navySlickFade(o) { o.fade = true; }
function updateSlicks(dt) {
  if (!NV.slicks) return;
  for (let i = NV.slicks.length - 1; i >= 0; i--) {
    const o = NV.slicks[i]; o.t += dt; o.r = Math.min(o.max, o.r + dt * 1.6); o.m.scale.setScalar(o.r);
    if (o.t > 120) { o.m.material.opacity -= dt * .02; if (o.m.material.opacity <= 0) { scene.remove(o.m); NV.slicks.splice(i, 1); continue; } }
    if (o.t < 90 && R() < dt * 3 && dist2Cam(o.m.position) < 8000 * 8000) { const a = R() * TAU, d = Math.sqrt(R()) * o.r * .8, x = o.m.position.x + Math.cos(a) * d, z = o.m.position.z + Math.sin(a) * d; PS_FIRE.emit(x, WATER_Y + .6, z, 0, rnd(1.5, 3), 0, rnd(.7, 1.3), 2.5, 5, 1, 4, 2, .7); if (R() < .5) PS_SMOKE.emit(x, WATER_Y + 3, z, rnd(-.5, .5), rnd(3, 5), rnd(-.5, .5), rnd(8, 14), 4, 16, .65, .1, .1, .09, .1, -.1); }
  }
}
