"use strict";
// ============================================================
//  AAA Graphics Test — terreno del villaggio (150 × 150 m, centro in (0, -100)).
//  Altimetria propria: strada principale fangosa con due solchi di ruote, viottolo secondario con la striscia d'erba,
//  piccolo incrocio, aie spianate sotto gli edifici, terrapieni e fossi del bocage, microrilievo.
//  La mesh vicina è fitta (0,28–1 m secondo il preset) e fonde erba, terra, fango e ghiaia con miscela per altezza
//  della texture; il bagnato abbassa la rugosità. Le pozzanghere sono piani d'acqua posati nei punti bassi dei solchi.
// ============================================================
const AV = { cx: 0, cz: -100, half: 78, pads: [], banks: [] };
const avRoadV = u => 6 + 3.4 * Math.sin(u * .026 + .4);                 // strada principale (est-ovest), v locale
const avLaneU = v => 13 + 2.2 * Math.sin(v * .045 + 1.1);               // viottolo verso nord (v negativi)
// distanza da un segmento
function avSegD(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
// argini del bocage: polilinee in coordinate locali [u, v]; con fosso da un lato
AV.banks = [
  [[-78, 17], [-40, 18.5], [-6, 16.5]],                 // lungo la strada a sud-ovest (varco a -6..+4 per il campo)
  [[22, 19], [50, 21], [78, 18]],                       // a sud-est
  [[-78, -46], [-52, -50], [-30, -47], [-24, -64], [-26, -78]],   // a nord-ovest, dietro il frutteto
  [[30, -60], [52, -58], [78, -62]],                    // a nord-est, dietro il fienile
  [[-14, 30], [-12, 52], [-16, 78]],                    // fra i campi a sud
];
function avBankD(u, v) { let d = 1e9; for (const b of AV.banks) for (let i = 0; i < b.length - 1; i++) d = Math.min(d, avSegD(u, v, b[i][0], b[i][1], b[i + 1][0], b[i + 1][1])); return d; }
function aaaH(x, z) {
  const u = x - AV.cx, v = z - AV.cz;
  let y = 16 + .016 * u - .011 * v + (fbm(u * .011 + 3, v * .011, 3) - .5) * 3.2 + (vnoise(u * .09, v * .09) - .5) * .35 + (vnoise(u * .7, v * .7) - .5) * .05;
  // aie degli edifici: piano, con raccordo di 2 m
  for (const p of AV.pads) { const dx = Math.max(p.x0 - u, 0, u - p.x1), dz = Math.max(p.z0 - v, 0, v - p.z1), d = Math.hypot(dx, dz); if (d < 3) y = lerp(p.y, y, smooth(d / 3)); }
  // argini del bocage (terrapieno con fosso)
  const db = avBankD(u, v); if (db < 3.2) y += 1.15 * Math.exp(-((db / 1.25) ** 2)) - (db > 1.6 ? .32 * Math.exp(-(((db - 2.4) / .5) ** 2)) : 0);
  // incrocio: leggermente spianato
  const dq = Math.hypot(u - 13, v - 6); if (dq < 11) y = lerp(y, 16 + .016 * 13 - .011 * 6 - .15, smooth(1 - dq / 11) * .8);
  // strada principale: piano stradale, bordi rialzati, due solchi con profondità variabile, dosso centrale
  const rv = avRoadV(u), dr = v - rv, ar = Math.abs(dr);
  if (ar < 4.2) {
    const base = 16 + .016 * u - .011 * rv + (fbm(u * .011 + 3, rv * .011, 3) - .5) * 3.2 - .12;
    y = lerp(y, base, smooth(clamp((4.2 - ar) / 1.4, 0, 1)));
    if (ar < 2.7) { const rut = (o) => Math.exp(-(((dr - o) / .28) ** 2)); const dep = .11 + .07 * vnoise(u * .15, 1) + .05 * vnoise(u * .9, 5); y -= dep * (rut(-.85) + rut(.85)); y += .05 * Math.exp(-((dr / .45) ** 2)); y += (vnoise(u * 1.3, v * 1.3) - .5) * .05; }
    if (ar > 2.5 && ar < 3.4) y += .06 * Math.sin((ar - 2.5) / .9 * PI);   // cordolo erboso ai bordi
  }
  // viottolo: solchi più leggeri, striscia d'erba al centro
  if (v < rv - 1) { const lu = avLaneU(v), dl = u - lu, al = Math.abs(dl); if (al < 2.8) { y -= .08 * smooth(clamp((2.8 - al) / 1, 0, 1)); if (al < 1.6) { const rut = o => Math.exp(-(((dl - o) / .22) ** 2)); y -= .07 * (rut(-.72) + rut(.72)); } } }
  return y;
}
// pesi dei materiali: erba, terra, fango, ghiaia + bagnato
function aaaSplat(x, z) {
  const u = x - AV.cx, v = z - AV.cz, n = vnoise(u * .21, v * .21), n2 = vnoise(u * .9 + 4, v * .9);
  let g = 1, d = 0, m = 0, gr = 0, wet = 0;
  const rv = avRoadV(u), ar = Math.abs(v - rv);
  if (ar < 3.3) { const k = smooth(clamp((3.3 - ar) / 1, 0, 1)); g *= 1 - k * (ar < 2.6 ? 1 : .6 + n * .4); const rutK = Math.max(Math.exp(-(((v - rv + .85) / .32) ** 2)), Math.exp(-(((v - rv - .85) / .32) ** 2))); m += k * (.35 + rutK * .9); d += k * .55; gr += k * Math.exp(-(((v - rv) / .4) ** 2)) * .7 * n2; wet += k * rutK * (.6 + .4 * n); }
  if (v < rv - 1) { const al = Math.abs(u - avLaneU(v)); if (al < 2.2) { const k = smooth(clamp((2.2 - al) / .8, 0, 1)), ctr = Math.exp(-((al / .3) ** 2)); g *= 1 - k * (1 - ctr) * .95; d += k * (1 - ctr) * .7; m += k * (1 - ctr) * .25 * n; gr += k * .2; } }
  const dq = Math.hypot(u - 13, v - 6); if (dq < 9) { const k = smooth(1 - dq / 9); g *= 1 - k * .9; gr += k * (.6 + .4 * n2); d += k * .3; }
  // cortile della fattoria: fango e paglia calpestata
  if (u > 26 && u < 52 && v > -22 && v < -4) { const k = smooth(Math.min(u - 26, 52 - u, v + 22, -4 - v) / 3); g *= 1 - k * .85; m += k * (.5 + .5 * n); d += k * .5; wet += k * .45 * n; }
  // vialetti verso le porte, aie degli edifici
  for (const p of AV.pads) { const dx = Math.max(p.x0 - u, 0, u - p.x1), dz = Math.max(p.z0 - v, 0, v - p.z1), dd = Math.hypot(dx, dz); if (dd < 1.6) { const k = 1 - dd / 1.6; g *= 1 - k * .7; d += k * .6; gr += k * .2; } }
  const db = avBankD(u, v); if (db < 2.6) { g = Math.max(g, .4); d += .35 * Math.exp(-(((db - 2.3) / .6) ** 2)); wet += .25 * Math.exp(-(((db - 2.4) / .4) ** 2)); }
  d += (1 - g) * .1 + .06 * smooth(clamp((n - .66) * 4, 0, 1));   // chiazze di terra nell'erba
  const s = g + d + m + gr || 1; return [g / s, d / s, m / s, gr / s, clamp(wet, 0, 1)];
}
// shader del terreno: quattro strati fotografici fusi per altezza (luminanza come altezza), anti-ripetizione, bagnato
function aaaTerrainMat() {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, map: TEX.grass.map, normalMap: TEX.grass.normal });
  m.onBeforeCompile = sh => {
    for (const [k, t] of [['tG', TEX.grass], ['tD', TEX.dirt], ['tR', TEX.cobble], ['tS', TEX.sand]]) { sh.uniforms[k] = { value: t.map }; sh.uniforms[k + 'n'] = { value: t.normal }; }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 spl;attribute float wet;varying vec4 vSpl;varying float vWet;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpl=spl;vWet=wet;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vSpl;varying float vWet;uniform sampler2D tG,tD,tR,tS,tGn,tDn,tRn,tSn;')
      .replace('#include <map_fragment>', `
        vec2 w = vAW.xz; float mx = smoothstep(.3,.7,aN(w*.06));
        vec2 uA = w*.42, uB = vec2(w.y,-w.x)*.17+.3;
        vec4 g1 = mapTexelToLinear(texture2D(tG, uA*1.3)), g2 = mapTexelToLinear(texture2D(tG, uB*1.1));
        vec4 cG = mix(g1, g2, mx*.6); cG.rgb *= vec3(.86,.95,.7) * (.8 + .4*aN(w*.33));
        vec4 cD = mix(mapTexelToLinear(texture2D(tD, uA)), mapTexelToLinear(texture2D(tD, uB*1.4)), mx*.5); cD.rgb *= vec3(.72,.66,.58);
        vec4 cM = cD; cM.rgb *= vec3(.48,.43,.37);
        vec4 cR = mapTexelToLinear(texture2D(tR, uA*1.6)); cR.rgb = mix(cR.rgb, mapTexelToLinear(texture2D(tS, uA*2.1)).rgb, .45) * vec3(.85,.82,.76);
        // miscela per altezza: il materiale "più alto" vince ai bordi (sassi che emergono dal fango, ciuffi d'erba)
        float hG = dot(cG.rgb, vec3(.33))*1.4 + vSpl.x*2.2, hD = dot(cD.rgb,vec3(.33)) + vSpl.y*2.2, hM = .35 + vSpl.z*2.2, hR = dot(cR.rgb,vec3(.33))*1.6 + vSpl.w*2.2;
        float mH = max(max(hG,hD),max(hM,hR)) - .28;
        vec4 bw = max(vec4(hG,hD,hM,hR) - mH, 0.); bw /= (dot(bw, vec4(1.)) + 1e-4);
        vec4 tc = cG*bw.x + cD*bw.y + cM*bw.z + cR*bw.w;
        float wetK = clamp(vWet + bw.z*.55, 0., 1.);
        tc.rgb *= 1. - wetK*.32;
        diffuseColor.rgb *= tc.rgb;
        float aRough = mix(max(tc.a, .55 + bw.x*.35), .22, wetK*.8);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(aRough*.9 + .08, .06, 1.);')
      .replace('#include <normal_fragment_maps>', `
        vec3 nG = texture2D(tGn, uA*1.3).xyz*2.-1., nD = texture2D(tDn, uA).xyz*2.-1., nR = texture2D(tRn, uA*1.6).xyz*2.-1.;
        vec3 tn = nG*bw.x + nD*(bw.y + bw.z*.5) + nR*bw.w*1.3; tn.xy *= 1. - wetK*.6;
        vec3 wn = normalize(vNormalW + vec3(tn.x, 0., tn.y)*.9);
        normal = normalize(mat3(viewMatrix)*wn);`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNormalW;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvNormalW = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNormalW;');
  };
  aaaPatch(m, { key: 'terr' });
  // la patch comune avvolge onBeforeCompile: le dichiarazioni di vAW e del rumore arrivano prima del codice del terreno
  return m;
}
function aaaBuildTerrain() {
  const PZ = AAA_PRESETS[AAA.preset], st = PZ.terr, h = AV.half + 6, n = Math.ceil(h * 2 / st) + 1;
  const pos = new Float32Array(n * n * 3), spl = new Float32Array(n * n * 4), wet = new Float32Array(n * n), uv = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = AV.cx - h + i * st, z = AV.cz - h + j * st, s = aaaSplat(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = aaaH(x, z); pos[k * 3 + 2] = z; spl.set(s.slice(0, 4), k * 4); wet[k] = s[4];
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6); let o = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx[o++] = a; idx[o++] = b; idx[o++] = a + 1; idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('spl', new THREE.BufferAttribute(spl, 4)); g.setAttribute('wet', new THREE.BufferAttribute(wet, 1)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const tm = aaaTerrainMat(), mesh = new THREE.Mesh(g, tm); mesh.receiveShadow = true; scene.add(mesh); AAA.terrain = mesh;
  // anello esterno rado fino a 700 m: campi chiusi da siepi, il resto lo copre la foschia
  const R = 1400, so = PZ.outer * 2, no = Math.ceil(R * 2 / so) + 1, p2 = [], i2 = [], s2 = [], w2 = [];
  for (let j = 0; j < no; j++) for (let i = 0; i < no; i++) { const x = AV.cx - R + i * so, z = AV.cz - R + j * so; p2.push(x, aaaOuterH(x, z), z); const f = vnoise(x * .012, z * .012); s2.push(.82 + f * .1, .1, 0, .08 - f * .05); w2.push(0); }
  for (let j = 0; j < no - 1; j++) for (let i = 0; i < no - 1; i++) { const x = AV.cx - R + (i + .5) * so, z = AV.cz - R + (j + .5) * so; if (Math.abs(x - AV.cx) < h - so && Math.abs(z - AV.cz) < h - so) continue; const a = j * no + i, b = a + no; i2.push(a, b, a + 1, a + 1, b, b + 1); }
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); g2.setAttribute('spl', new THREE.Float32BufferAttribute(s2, 4)); g2.setAttribute('wet', new THREE.Float32BufferAttribute(w2, 1)); g2.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p2.length / 3 * 2), 2)); g2.setIndex(i2); g2.computeVertexNormals();
  const m2 = new THREE.Mesh(g2, tm); m2.receiveShadow = true; scene.add(m2);
  return mesh;
}
// fuori dal villaggio: stessa base, campi leggermente ondulati, l'orlo della mesh vicina combacia (stessa funzione al bordo)
function aaaOuterH(x, z) { const u = x - AV.cx, v = z - AV.cz, inn = Math.max(Math.abs(u), Math.abs(v)); if (inn < AV.half + 6) return aaaH(x, z) - .02; return 16 + .016 * u - .011 * v + (fbm(u * .011 + 3, v * .011, 3) - .5) * 3.2 + (fbm(u * .003, v * .003, 3) - .5) * 14 * smooth((inn - 90) / 200); }
// pozzanghere: nei punti bassi dei solchi della strada, nel cortile, all'incrocio; piano d'acqua posato appena sopra il fondo
function aaaPuddles() {
  const M = aaaMats(), sr = seeded(777), r = (a, b) => a + sr() * (b - a), out = [];
  const add = (u, v, rx, rz, rot, fill) => {
    const x = AV.cx + u, z = AV.cz + v; let lo = 1e9; for (let a = 0; a < 8; a++) lo = Math.min(lo, aaaH(x + Math.cos(a) * rx * .3, z + Math.sin(a) * rz * .3)); const y = lo + fill;
    const sh = new THREE.Shape(), N = 18; for (let i = 0; i <= N; i++) { const a = i / N * TAU, k = 1 + .22 * Math.sin(a * 3 + rot * 5) + .12 * Math.sin(a * 5 + u); const px = Math.cos(a) * rx * k, pz = Math.sin(a) * rz * k; i ? sh.lineTo(px, pz) : sh.moveTo(px, pz); }
    const g = new THREE.ShapeGeometry(sh, 6); g.rotateX(-PI / 2); g.rotateY(rot); g.translate(x, y, z);
    { const p = g.attributes.position, c = new Float32Array(p.count * 4); for (let i = 0; i < p.count; i++) { const dx = (p.getX(i) - x), dz = (p.getZ(i) - z), e = Math.hypot(dx / rx, dz / rz); c.set([1, 1, 1, clamp((1.15 - e) * 3, 0, 1) * .92], i * 4); } g.setAttribute('color', new THREE.BufferAttribute(c, 4)); }
    const m = new THREE.Mesh(g, M.water); m.receiveShadow = true; scene.add(m); out.push(m);
  };
  // lungo i solchi
  for (let u = -70; u < 72; u += r(3.5, 8)) { if (sr() < .38) continue; const rv = avRoadV(u), side = sr() < .5 ? -.85 : .85, a = Math.atan2(avRoadV(u + 1) - rv, 1); add(u, rv + side, r(.9, 2.4), r(.22, .36), -a, r(.05, .085)); }
  add(13, 6, 2.6, 1.6, .4, .06); add(36, -10, 3, 1.8, .9, .07); add(44, -16, 1.6, 1.1, .2, .05); add(30, -15, 1.4, .9, 1.4, .05);
  AAA.puddles = out; return out;
}
// sassi e ghiaia: istanze (icosaedri deformati) lungo i bordi della strada, sul dosso centrale, nel cortile e nell'erba
function aaaRocks() {
  const PZ = AAA_PRESETS[AAA.preset], n = PZ.rocks, g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, sr = seeded(91), r = (a, b) => a + sr() * (b - a);
  for (let i = 0; i < p.count; i++) { const k = .75 + sr() * .45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .7, p.getZ(i) * k); } g.computeVertexNormals();
  const im = new THREE.InstancedMesh(g, aaaTri('stone', 1.6, { nStr: 1.2, color: 0x7a7266, macro: .3 }), n); im.castShadow = im.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let c = 0;
  for (let t = 0; t < n * 4 && c < n; t++) {
    const u = r(-75, 75), v = r(-75, 75), s = aaaSplat(AV.cx + u, AV.cz + v), w = s[1] * .6 + s[3] * 1.4 + s[2] * .25; if (sr() > w * .8 + .02) continue;
    const sz = s[3] > .3 ? r(.02, .06) : r(.025, .09) * (sr() < .05 ? 2 : 1), x = AV.cx + u, z = AV.cz + v;
    e.set(r(0, 3), r(0, 3), r(0, 3)); q.setFromEuler(e); m4.compose(new V3(x, aaaH(x, z) + sz * .2, z), q, new V3(sz, sz, sz)); im.setMatrixAt(c++, m4);
  }
  im.count = c; scene.add(im); return im;
}
