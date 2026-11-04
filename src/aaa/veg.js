"use strict";
// ============================================================
//  AAA Graphics Test — vegetazione.
//  Alberi generati per ramificazione (tronco rastremato e curvo, rami di due ordini, rametti) con foglie a schede
//  dall'atlante disegnato su canvas; tre modelli (quercia, melo, cespuglio di siepe) istanziati con scala, rotazione
//  e tinta diverse. Vento solo nello shader (attributo wsway). Erba 3D a ciuffi istanziati, fiori, bocage sugli argini,
//  edera sui muri. Le ombre delle foglie rispettano la trasparenza (materiale di profondità con alfa).
// ============================================================
function aaaTreeTemplate(kind, seed) {
  const sr = seeded(seed), r = (a, b) => a + sr() * (b - a), LK = AAA_PRESETS[AAA.preset].leaves;
  const bark = [], leaves = [], cyl = new THREE.CylinderGeometry(1, 1, 1, kind === 'bush' ? 5 : 8, 1, true);
  const P = { oak: { h: r(9, 12), r0: .42, lv: 3, spread: 1.05, leafS: [1.2, 2], cl: 22, q: 0 }, apple: { h: r(3.6, 4.6), r0: .16, lv: 3, spread: 1.3, leafS: [.8, 1.3], cl: 14, q: 1 }, bush: { h: r(1.6, 2.4), r0: .05, lv: 2, spread: 1.6, leafS: [.7, 1.1], cl: 10, q: 2 }, poplar: { h: r(13, 16), r0: .3, lv: 2, spread: .45, leafS: [1, 1.6], cl: 16, q: 1 } }[kind];
  const seg = (a, b, ra, rb) => { const d = b.clone().sub(a), L = d.length(); const g = new THREE.CylinderGeometry(rb, ra, L, kind === 'bush' ? 5 : 8, 1, true); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); const w = new Float32Array(g.attributes.position.count); for (let i = 0; i < w.length; i++) w[i] = clamp(g.attributes.position.getY(i) / P.h, 0, 1) ** 2 * .25; g.setAttribute('wsway', new THREE.BufferAttribute(w, 1)); bark.push(g); };
  const card = (c, s) => {
    // scheda di foglie: quadrato orientato a caso, UV nel quadrante dell'atlante
    const g = new THREE.PlaneGeometry(s, s); g.rotateX(r(-1.4, 1.4)); g.rotateY(r(0, TAU)); g.rotateZ(r(-.6, .6)); g.translate(c.x, c.y, c.z);
    const uv = g.attributes.uv, qx = (P.q % 2) * .5, qy = 1 - (Math.floor(P.q / 2) + 1) * .5; for (let i = 0; i < uv.count; i++) uv.setXY(i, qx + uv.getX(i) * .5, qy + uv.getY(i) * .5);
    const tint = .75 + sr() * .45, sun = clamp(c.y / P.h, 0, 1), col = new Float32Array(uv.count * 3); for (let i = 0; i < uv.count; i++) col.set([tint * (.85 + sun * .2), tint * (.9 + sun * .15), tint * .8], i * 3);
    const w = new Float32Array(uv.count).fill(.3 + .7 * clamp(c.y / P.h, 0, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('wsway', new THREE.BufferAttribute(w, 1)); leaves.push(g);
  };
  const tips = [];
  const grow = (p, dir, len, rad, lv) => {
    const n = lv === 0 ? 6 : 4; let cur = p.clone(), d = dir.clone();
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n, nxt = cur.clone().addScaledVector(d, len / n), ra = rad * (1 - (i / n) * .6), rb = rad * (1 - k * .6);
      seg(cur, nxt, ra, rb);
      if (lv < P.lv - 1 && (lv > 0 || k > (kind === 'poplar' ? .25 : .45)) && sr() < (lv === 0 ? .9 : .7)) {
        const nb = lv === 0 ? 2 : 2; for (let b = 0; b < nb; b++) { const a = r(0, TAU), up = lv === 0 ? r(.35, .8) : r(.1, .7); const cd = new V3(Math.cos(a) * P.spread, up, Math.sin(a) * P.spread).normalize().lerp(d, .25).normalize(); grow(nxt, cd, len * r(.42, .62), rb * r(.55, .7), lv + 1); }
      }
      d.add(new V3(r(-.2, .2), lv ? -.06 : .02, r(-.2, .2))).normalize(); cur = nxt;
    }
    if (lv >= P.lv - 2) tips.push([cur, len]);
  };
  grow(new V3(0, -.3, 0), new V3(r(-.08, .08), 1, r(-.08, .08)).normalize(), P.h * (kind === 'oak' ? .52 : kind === 'poplar' ? .85 : .6), P.r0, 0);
  for (const [t, len] of tips) { const n = Math.round(P.cl * LK * (kind === 'bush' ? 1 : .6)); for (let i = 0; i < n; i++) { const off = new V3(r(-1, 1), r(-.6, 1), r(-1, 1)).multiplyScalar(Math.max(.6, len * .55)); card(t.clone().add(off), r(...P.leafS)); } }
  // rametti sottili verso le schede (silhouette meno «a palla»)
  const merge = list => THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(list.map(g => g.index ? g.toNonIndexed() : g)) : aaaMerge(list.map(g => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }));
  for (const g of bark) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  return { bark: merge(bark), leaves: merge(leaves), h: P.h };
}
// istanze: un'InstancedMesh per corteccia e una per le foglie di ciascun modello
function aaaPlantInstances(tpl, list, tint) {
  const M = aaaMats(), leaf = aaaLeafMat(), barkM = AAA.mats.barkW || (AAA.mats.barkW = aaaTri('wood', 1.3, { nStr: 1.8, macro: .35, color: 0x6c6458, moss: .4, wind: .9, key: 'barkw', hq: 'corteccia', hqScale: .9, nStrHQ: 1.4 }));
  const b = new THREE.InstancedMesh(tpl.bark, barkM, list.length), l = new THREE.InstancedMesh(tpl.leaves, leaf, list.length);
  b.castShadow = b.receiveShadow = l.castShadow = l.receiveShadow = true; l.customDepthMaterial = AAA.mats.leafDepth;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  list.forEach(([x, z, s, ry, t], i) => { q.setFromAxisAngle(new V3(0, 1, 0), ry); m4.compose(new V3(x, aaaH(x, z), z), q, new V3(s, s * (.9 + (i % 5) * .05), s)); b.setMatrixAt(i, m4); l.setMatrixAt(i, m4); c.setRGB(...(t || tint || [1, 1, 1])); l.setColorAt(i, c); });
  l.instanceColor.needsUpdate = true; scene.add(b, l); AAA.st.trees = (AAA.st.trees || 0) + list.length; return [b, l];
}
// erba: ciuffi di lame (base scura, punta chiara), normali verso l'alto, istanze dove il terreno è erboso
function aaaGrass() {
  const PZ = AAA_PRESETS[AAA.preset]; if (!PZ.grass) return null;
  const sr = seeded(55), r = (a, b) => a + sr() * (b - a), BL = 80;
  const pos = [], col = [], sw = [], nor = [];
  for (let i = 0; i < BL; i++) {
    const x = r(-.5, .5), z = r(-.5, .5), h = r(.12, .38) * (sr() < .12 ? 1.6 : 1), w = r(.016, .03), a = r(0, TAU), bend = r(.05, .22), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const pts = [[-w, 0, 0], [w, 0, 0], [-w * .7, h * .55, bend * .4], [w * .7, h * .55, bend * .4], [0, h, bend]];
    const V = pts.map(([o, y, f]) => [x + px * o + dx * f, y, z + pz * o + dz * f]);
    const g0 = r(.75, 1.05), dry = sr() < .12;
    const cB = dry ? [.16, .14, .06] : [.035 * g0, .07 * g0, .015], cT = dry ? [.36, .3, .13] : [.13 * g0, .22 * g0, .05 * g0];
    for (const [a1, b1, c1] of [[0, 1, 2], [2, 1, 3], [2, 3, 4]]) for (const k of [a1, b1, c1]) { pos.push(...V[k]); const t = V[k][1] / h; col.push(...cB.map((v, j) => v + (cT[j] - v) * t)); sw.push(t * t); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('wsway', new THREE.Float32BufferAttribute(sw, 1)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const mat = aaaPatch(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .85 }), { wind: .32, key: 'grass' }); mat.userData.grass = true;
  const N = Math.floor(PZ.grass / BL), im = new THREE.InstancedMesh(g, mat, N); im.receiveShadow = true; im.castShadow = AAA.preset === 'ULTRA';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let c = 0;
  for (let t = 0; t < N * 6 && c < N; t++) {
    const u = r(-76, 76), v = r(-76, 76), x = AV.cx + u, z = AV.cz + v, s = aaaSplat(x, z); if (s[0] < .55 + sr() * .3) continue; const core = Math.max(Math.abs(u - 5), Math.abs(v)); if (core > 40 && sr() < .55) continue;
    if (AAA.noGrass && AAA.noGrass(u, v)) continue;
    q.setFromAxisAngle(new V3(0, 1, 0), r(0, TAU)); const k = r(.8, 1.35) * (s[0] > .9 ? 1.15 : .85); m4.compose(new V3(x, aaaH(x, z) - .02, z), q, new V3(k, k * r(.8, 1.3), k)); im.setMatrixAt(c++, m4);
  }
  im.count = c; scene.add(im); AAA.st.grass = c * BL; return im;
}
// fiori di campo: papaveri, margherite, ranuncoli (piccole corolle su stelo)
function aaaFlowers() {
  const PZ = AAA_PRESETS[AAA.preset]; if (!PZ.flowers) return; const sr = seeded(12), r = (a, b) => a + sr() * (b - a), G = new AGeo(), M = aaaMats();
  const kinds = [[0xc8281e, .07], [0xf2f0e6, .05], [0xe8c428, .04]];
  for (let i = 0, n = 0; i < PZ.flowers * 5 && n < PZ.flowers; i++) {
    const u = r(-75, 75), v = r(-75, 75), x = AV.cx + u, z = AV.cz + v, s = aaaSplat(x, z); if (s[0] < .9 || (AAA.noGrass && AAA.noGrass(u, v))) continue;
    const [c, sz] = kinds[sr() < .45 ? 0 : sr() < .7 ? 1 : 2], y = aaaH(x, z), h = r(.3, .6);
    G.add(M.vc, ABX.cyl6, x, y + h / 2, z, 0, 0, 0, .006, h, .006, 0x3a5a22); G.add(M.vc, ABX.cyl6, x, y + h, z, r(-.3, .3), 0, r(-.3, .3), sz, .015, sz, c); if (c !== 0xc8281e) G.add(M.vc, ABX.cyl6, x, y + h + .01, z, 0, 0, 0, sz * .35, .02, sz * .35, 0xe0a020); n++;
  }
  G.build(false);
}
// edera: schede del quadrante dell'atlante appiattite contro un muro, con fusti; cresce dal basso
function aaaIvy(F, a0, a1, yTop, base, seed, dens = 1) {
  const sr = seeded(seed), r = (a, b) => a + sr() * (b - a), K = AAA_PRESETS[AAA.preset].ivy * dens, leaves = [], stems = new AGeo(), M = aaaMats();
  const n = Math.round((a1 - a0) * (yTop - base) * 9 * K);
  for (let i = 0; i < n; i++) {
    const a = r(a0, a1), hMax = (yTop - base) * (1 - Math.abs((a - (a0 + a1) / 2) / ((a1 - a0) / 2)) * .65), y = base + Math.pow(sr(), 1.3) * hMax, d = r(.03, .14);
    const g = new THREE.PlaneGeometry(r(.35, .6), r(.35, .6)); g.rotateY(r(-.5, .5)); g.rotateX(r(-.4, .4));
    const [x, yy, z] = aaaAt(F, a, d, y); if (F.axis === 'x') { if (F.out < 0) g.rotateY(PI); } else g.rotateY(F.out > 0 ? PI / 2 : -PI / 2); g.translate(x, yy, z);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, .5 + uv.getX(k) * .5, uv.getY(k) * .5);
    const t = .7 + sr() * .4, col = new Float32Array(uv.count * 3).fill(t); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('wsway', new THREE.BufferAttribute(new Float32Array(uv.count).fill(.05), 1)); leaves.push(g);
  }
  for (let i = 0; i < Math.round((a1 - a0) * 1.2); i++) { let a = r(a0, a1), y = base; for (let k = 0; k < 8; k++) { const y2 = y + r(.3, .6), a2 = a + r(-.25, .25), [x1, , z1] = aaaAt(F, a, .03, 0), [x2, , z2] = aaaAt(F, a2, .03, 0); const p1 = new V3(x1, y, z1), p2 = new V3(x2, y2, z2), d = p2.clone().sub(p1); stems.add(M.woodDark, ABX.cyl6, (x1 + x2) / 2, (y + y2) / 2, (z1 + z2) / 2, 0, 0, 0, .012, d.length(), .012); a = a2; y = y2; if (y > base + (yTop - base) * .9) break; } }
  const merged = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(leaves.map(g => g.toNonIndexed())) : aaaMerge(leaves.map(g => g.toNonIndexed()));
  const m = new THREE.Mesh(merged, aaaLeafMat()); m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = AAA.mats.leafDepth; scene.add(m); stems.build();
}
// bocage: cespugli fitti sugli argini, alberi a intervalli, rovi alla base
function aaaBocage(tBush, tOak) {
  const sr = seeded(303), r = (a, b) => a + sr() * (b - a), bush = [], oak = [], bramble = [];
  for (const b of AV.banks) for (let i = 0; i < b.length - 1; i++) {
    const [u0, v0] = b[i], [u1, v1] = b[i + 1], L = Math.hypot(u1 - u0, v1 - v0), nx = -(v1 - v0) / L, nz = (u1 - u0) / L;
    for (let s = 0; s < L; s += r(.9, 1.4)) { const k = s / L, u = lerp(u0, u1, k) + nx * r(-.4, .4), v = lerp(v0, v1, k) + nz * r(-.4, .4); bush.push([AV.cx + u, AV.cz + v, r(1, 1.7), r(0, TAU), [r(.8, 1.05), r(.85, 1.05), r(.75, .95)]]); if (sr() < .5) bramble.push([AV.cx + u + nx * r(1, 1.6), AV.cz + v + nz * r(1, 1.6), r(.55, .85), r(0, TAU), [.7, .72, .6]]); }
    for (let s = r(2, 8); s < L; s += r(9, 15)) { const k = s / L; oak.push([AV.cx + lerp(u0, u1, k), AV.cz + lerp(v0, v1, k), r(.85, 1.25), r(0, TAU)]); }
  }
  aaaPlantInstances(tBush, bush.concat(bramble)); return oak;
}
