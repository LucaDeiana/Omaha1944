// Converte il corpo base CC0 (assets/models/male_base.glb, rig "metarig") nella posa di riposo dei soldati del gioco.
// Uscita: assets/models/male_base.js con posizioni, normali, indici, ossa e pesi già riferiti allo scheletro di crowd.js.
// uso: node tools/convert_base.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const b = fs.readFileSync(path.join(root, 'assets/models/male_base.glb'));
const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), bin = b.slice(20 + jl + 8);
const acc = i => {
  const a = j.accessors[i], v = j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const C = { 5126: Float32Array, 5123: Uint16Array, 5121: Uint8Array, 5125: Uint32Array }[a.componentType];
  const off = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
  return new C(bin.buffer.slice(off, off + a.count * n * C.BYTES_PER_ELEMENT));
};
const prim = j.meshes[0].primitives[0], skin = j.skins[0];
const P = acc(prim.attributes.POSITION), N = acc(prim.attributes.NORMAL), J = acc(prim.attributes.JOINTS_0), W = acc(prim.attributes.WEIGHTS_0), I = acc(prim.indices), IB = acc(skin.inverseBindMatrices);
const names = skin.joints.map(k => j.nodes[k].name);
// assi del modello: x avanti, y su, z sinistra(-)/destra(+) → gioco: x = z, y = y, z = -x
const cv = (x, y, z) => [z, y, -x];
const jointPos = k => { const a = IB.slice(k * 16, k * 16 + 16), t = [a[12], a[13], a[14]]; return cv(-(a[0] * t[0] + a[1] * t[1] + a[2] * t[2]), -(a[4] * t[0] + a[5] * t[1] + a[6] * t[2]), -(a[8] * t[0] + a[9] * t[1] + a[10] * t[2])); };
const JP = {}; names.forEach((n, k) => JP[n] = jointPos(k));
const T = [0, .925, 0];
const add = (a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2], len = a => Math.sqrt(dot(a, a)), nrm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
// rotazione minima che porta u su v (Rodrigues)
const rotTo = (u, v) => { const k = cross(u, v), s = len(k), c = dot(u, v); if (s < 1e-6) return p => p; const ax = mul(k, 1 / s), an = Math.atan2(s, c), ca = Math.cos(an), sa = Math.sin(an); return p => add(add(mul(p, ca), mul(cross(ax, p), sa)), mul(ax, dot(ax, p) * (1 - ca))); };
// scheletro del gioco in posa di riposo (crowd.js makeBody)
const OUR = { shL: [-.172, 1.48, 0], elL: [-.172, 1.19, 0], wrL: [-.172, .945, 0], shR: [.172, 1.48, 0], elR: [.172, 1.19, 0], wrR: [.172, .945, 0], hipL: [-.1, .91, 0], knL: [-.1, .46, 0], anL: [-.1, .06, 0], hipR: [.1, .91, 0], knR: [.1, .46, 0], anR: [.1, .06, 0] };
// segmento del modello → segmento del gioco
const seg = (m0, m1, o0, o1) => { const a = JP[m0], c = JP[m1], du = sub(c, a), dv = sub(OUR[o1], OUR[o0]), u = nrm(du), k = len(dv) / len(du), R = rotTo(u, nrm(dv)); return { f: p => { const d = sub(p, a), al = dot(d, u); return add(OUR[o0], R(add(sub(d, mul(u, al)), mul(u, al * k)))); }, R }; };
const SEG = {};
for (const s of ['L', 'R']) {
  SEG['upper_arm.' + s] = seg('upper_arm.' + s, 'forearm.' + s, 'sh' + s, 'el' + s);
  SEG['forearm.' + s] = seg('forearm.' + s, 'hand.' + s, 'el' + s, 'wr' + s);
  SEG['thigh.' + s] = seg('thigh.' + s, 'shin.' + s, 'hip' + s, 'kn' + s);
  SEG['shin.' + s] = seg('shin.' + s, 'foot.' + s, 'kn' + s, 'an' + s);
  // estremità rigide con la rotazione del segmento padre
  const fa = SEG['forearm.' + s], sh = SEG['shin.' + s];
  SEG['hand.' + s] = { f: p => add(OUR['wr' + s], fa.R(sub(p, JP['hand.' + s]))), R: fa.R };
  SEG['foot.' + s] = { f: p => add(OUR['an' + s], sh.R(sub(p, JP['foot.' + s]))), R: sh.R };
}
const torso = { f: p => add(p, T), R: p => p };
const segOf = n => { const s = n.endsWith('.L') ? 'L' : n.endsWith('.R') ? 'R' : ''; if (/^f_|^thumb|^hand/.test(n)) return SEG['hand.' + s]; if (/^foot|^toe|^heel/.test(n)) return SEG['foot.' + s]; return SEG[n] || torso; };
// osso del gioco: 1 hips, 2 spine, 3 neck, 5 shL, 6 elL, 7 shR, 8 elR, 10 hipL, 11 knL, 12 hipR, 13 knR
const boneOf = n => {
  const s = n.endsWith('.L') ? 'L' : 'R';
  if (/^f_|^thumb|^hand|^forearm/.test(n)) return s === 'L' ? 6 : 8;
  if (/^upper_arm/.test(n)) return s === 'L' ? 5 : 7;
  if (/^foot|^toe|^heel|^shin/.test(n)) return s === 'L' ? 11 : 13;
  if (/^thigh/.test(n)) return s === 'L' ? 10 : 12;
  if (n === 'spine.004' || n === 'spine.005') return 3;
  if (n === 'spine.002' || n === 'spine.003' || /^shoulder/.test(n)) return 2;
  return 1;
};
// parti scartate (sostituite dai pezzi scolpiti del gioco): testa, mani, piedi
const dropOf = n => n === 'spine.005' ? 1 : /^f_|^thumb|^hand/.test(n) ? 1 : /^foot|^toe|^heel/.test(n) ? 1 : 0;
const nv = P.length / 3, pos = [], nor = [], bones = [], wts = [], drop = [];
for (let i = 0; i < nv; i++) {
  const p = cv(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), n = cv(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
  let q = [0, 0, 0], m = [0, 0, 0], dw = 0; const ob = {};
  for (let k = 0; k < 4; k++) {
    const w = W[i * 4 + k]; if (!w) continue; const nm = names[J[i * 4 + k]], s = segOf(nm);
    q = add(q, mul(s.f(p), w)); m = add(m, mul(s.R(n), w)); dw += dropOf(nm) * w;
    const bo = boneOf(nm); ob[bo] = (ob[bo] || 0) + w;
  }
  const bl = Object.entries(ob).sort((a, c) => c[1] - a[1]).slice(0, 2), ws = bl.reduce((a, c) => a + c[1], 0);
  pos.push(q); nor.push(nrm(m)); drop.push(dw > .5);
  bones.push([+bl[0][0], bl[1] ? +bl[1][0] : +bl[0][0]]); wts.push([bl[0][1] / ws, bl[1] ? bl[1][1] / ws : 0]);
}
const idx = [];
for (let t = 0; t < I.length; t += 3) if (!drop[I[t]] && !drop[I[t + 1]] && !drop[I[t + 2]]) idx.push(I[t], I[t + 1], I[t + 2]);
// salda i vertici con la stessa posizione (cuciture UV del modello) e tieni i pesi come mappa osso → peso
const key = p => p.map(x => Math.round(x * 1e4)).join(','), weld = new Map(), V = [], wid = new Int32Array(nv);
for (let i = 0; i < nv; i++) { const k = key(pos[i]); let id = weld.get(k); if (id === undefined) { id = V.length; weld.set(k, id); const m = {}; m[bones[i][0]] = wts[i][0]; if (wts[i][1]) m[bones[i][1]] = (m[bones[i][1]] || 0) + wts[i][1]; V.push({ p: pos[i], m }); } wid[i] = id; }
let F = []; for (let t = 0; t < idx.length; t += 3) F.push([wid[idx[t]], wid[idx[t + 1]], wid[idx[t + 2]]]);
F = F.filter(f => f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]);
const mix = (list) => { const p = [0, 0, 0], m = {}; for (const [v, w] of list) { p[0] += v.p[0] * w; p[1] += v.p[1] * w; p[2] += v.p[2] * w; for (const k in v.m) m[k] = (m[k] || 0) + v.m[k] * w; } return { p, m }; };
// suddivisione di Loop: superficie liscia, bordi (collo, polsi, caviglie) mantenuti
function loop(V, F) {
  const E = new Map(), ek = (a, c) => a < c ? a + '_' + c : c + '_' + a, nb = V.map(() => new Set());
  for (const f of F) for (let k = 0; k < 3; k++) { const a = f[k], c = f[(k + 1) % 3], o = f[(k + 2) % 3], kk = ek(a, c); let e = E.get(kk); if (!e) E.set(kk, e = { a, c, opp: [] }); e.opp.push(o); nb[a].add(c); nb[c].add(a); }
  const bnd = V.map(() => []);
  for (const e of E.values()) if (e.opp.length === 1) { bnd[e.a].push(e.c); bnd[e.c].push(e.a); }
  const NV = V.map((v, i) => {
    if (bnd[i].length >= 2) return mix([[v, .75], [V[bnd[i][0]], .125], [V[bnd[i][1]], .125]]);
    const n = nb[i].size, be = n === 3 ? 3 / 16 : 3 / (8 * n);
    return mix([[v, 1 - n * be], ...[...nb[i]].map(u => [V[u], be])]);
  });
  for (const e of E.values()) { e.id = NV.length; NV.push(e.opp.length === 2 ? mix([[V[e.a], .375], [V[e.c], .375], [V[e.opp[0]], .125], [V[e.opp[1]], .125]]) : mix([[V[e.a], .5], [V[e.c], .5]])); }
  const NF = [];
  for (const f of F) { const [a, c, d] = f, ab = E.get(ek(a, c)).id, cd = E.get(ek(c, d)).id, da = E.get(ek(d, a)).id; NF.push([a, ab, da], [ab, c, cd], [da, cd, d], [ab, cd, da]); }
  return [NV, NF];
}
let SV = V, SF = F;
for (let it = 0; it < 1; it++) [SV, SF] = loop(SV, SF);
// normali lisce pesate per area
const SN = SV.map(() => [0, 0, 0]);
for (const f of SF) { const [a, c, d] = f.map(i => SV[i].p), n = cross(sub(c, a), sub(d, a)); for (const i of f) SN[i] = add(SN[i], n); }
const out = { p: [], n: [], b: [], w: [], i: [] };
SV.forEach((v, i) => {
  out.p.push(...v.p.map(x => +x.toFixed(4))); out.n.push(...nrm(SN[i]).map(x => +x.toFixed(3)));
  const bl = Object.entries(v.m).sort((a, c) => c[1] - a[1]).slice(0, 2), ws = bl.reduce((a, c) => a + c[1], 0);
  out.b.push(+bl[0][0], bl[1] ? +bl[1][0] : +bl[0][0]); out.w.push(+(bl[0][1] / ws).toFixed(3));
});
for (const f of SF) out.i.push(f[0], f[2], f[1]); // avvolgimento antiorario per three.js
const c = SV.length;
const js = '// corpo base CC0 (orange-juice-games / BoQsc, Godot-Male-Base-Mesh) adattato allo scheletro dei soldati da tools/convert_base.js\nconst BASE_MALE = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(root, 'assets/models/male_base.js'), js);
console.log('vertici', c, 'triangoli', out.i.length / 3, 'byte', js.length);
