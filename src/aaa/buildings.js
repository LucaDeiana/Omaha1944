"use strict";
// ============================================================
//  AAA Graphics Test — edifici.
//  Muri: ogni facciata è un solido estruso con le aperture forate (spessore vero, sguanci visibili), in pietra,
//  intonaco o mattoni con umidità e muschio alla base. Aperture: telaio incassato, croce, vetri che riflettono,
//  davanzale e architrave, persiane a tavole con traverse e saetta, porte a tavole con soglia di pietra.
//  Tetti: tegole o lastre d'ardesia una per una (geometria unita, colori variati, muschio sulle file basse),
//  colmo, sottotetto, gronde e pluviali, comignoli con i vasi. Collider: pezzi attorno alle aperture (si entra dalle
//  porte, si spara dalle finestre), solai e scale percorribili.
// ============================================================
const _ab = { e: new THREE.Euler(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), p: new V3(), s: new V3() };
// geometria accumulata per materiale (un'unica mesh per materiale e per edificio)
class AGeo {
  constructor() { this.parts = new Map(); }
  add(mat, g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, col) {
    _ab.e.set(rx, ry, rz, 'YXZ'); _ab.q.setFromEuler(_ab.e); _ab.m.compose(_ab.p.set(x, y, z), _ab.q, _ab.s.set(sx, sy, sz));
    const gg = g.clone().applyMatrix4(_ab.m); if (col !== undefined) { const c = new THREE.Color(col).convertSRGBToLinear(), n = gg.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    (this.parts.get(mat) || this.parts.set(mat, []).get(mat)).push(gg); return this;
  }
  raw(mat, gg) { (this.parts.get(mat) || this.parts.set(mat, []).get(mat)).push(gg); return this; }
  build(cast = true) {
    const grp = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const geos = list.map(g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv', 'wsway'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
      const needC = geos.some(g => g.attributes.color); if (needC) for (const g of geos) if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      const needW = geos.some(g => g.attributes.wsway); if (needW) for (const g of geos) if (!g.attributes.wsway) g.setAttribute('wsway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
      const merged = THREE.BufferGeometryUtils ? THREE.BufferGeometryUtils.mergeBufferGeometries(geos) : aaaMerge(geos);
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = cast; mesh.receiveShadow = true; if (mat === AAA.mats.leaf) mesh.customDepthMaterial = AAA.mats.leafDepth; grp.add(mesh); AAA.st.meshes = (AAA.st.meshes || 0) + 1;
    }
    scene.add(grp); return grp;
  }
}
function aaaMerge(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count; const out = new THREE.BufferGeometry();
  for (const k of Object.keys(geos[0].attributes)) { const is = geos[0].attributes[k].itemSize, a = new Float32Array(n * is); let o = 0; for (const g of geos) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, is)); }
  return out;
}
const ABX = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), half: new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, 0, PI) };
// pietra squadrata irregolare (cantonali, architravi): scatola con spigoli leggermente smussati via scala variabile
function aaaStoneBlock(G, mat, x, y, z, sx, sy, sz, ry = 0, sr) { const j = () => 1 + (sr() - .5) * .06; G.add(mat, ABX.box, x, y, z, (sr() - .5) * .02, ry, (sr() - .5) * .02, sx * j(), sy * j(), sz * j()); }

// ---------- muro estruso con aperture ----------
// F: { axis 'x'|'z', fixed (piano esterno), out (+1/-1 verso l'esterno), a0, a1 (lungo la facciata), y0, y1, t (spessore) }
function aaaWall(G, mat, F, holes, topShape) {
  const s = new THREE.Shape(); const L = F.a1 - F.a0, H = F.y1 - F.y0;
  if (topShape) { s.moveTo(0, 0); s.lineTo(L, 0); for (const [a, y] of topShape) s.lineTo(a, y); s.lineTo(0, 0); }
  else { s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, H); s.lineTo(0, H); s.lineTo(0, 0); }
  for (const o of holes) { const p = new THREE.Path(), a0 = o.c - o.w / 2 - F.a0, b0 = o.y0 - F.y0; p.moveTo(a0, b0); p.lineTo(a0, b0 + o.h); p.lineTo(a0 + o.w, b0 + o.h); p.lineTo(a0 + o.w, b0); p.lineTo(a0, b0); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth: F.t, bevelEnabled: false, steps: 1, curveSegments: 1 });
  // shape in (a, y); estrusione lungo z locale → facciata: a lungo l'asse, profondità verso l'interno
  const m = new THREE.Matrix4();
  if (F.axis === 'x') m.makeTranslation(F.a0, F.y0, F.fixed - (F.out > 0 ? F.t : 0));
  else { m.makeRotationY(-PI / 2); m.setPosition(F.fixed + (F.out > 0 ? 0 : F.t), F.y0, F.a0); }   // a → +z, profondità → -x
  g.applyMatrix4(m); g.computeVertexNormals();
  G.raw(mat, g); return g;
}
// collider a pezzi attorno alle aperture (scatole allineate agli assi)
function aaaWallSolids(F, holes, tag = 'house', matTL = 'muratura') {
  const pieces = [], box = (p0, p1, y0, y1) => { if (p1 - p0 < .05 || y1 - y0 < .05) return; const i0 = F.out > 0 ? F.fixed - F.t : F.fixed, i1 = F.out > 0 ? F.fixed : F.fixed + F.t; const s = F.axis === 'x' ? addSolid(p0, y0, i0, p1, y1, i1, tag) : addSolid(i0, y0, p0, i1, y1, p1, tag); s.mat = matTL; pieces.push(s); };
  // per colonne: i bordi di tutte le aperture dividono la facciata; in ogni colonna si chiudono solo le quote libere
  const xs = [F.a0, F.a1]; for (const o of holes) xs.push(clamp(o.c - o.w / 2, F.a0, F.a1), clamp(o.c + o.w / 2, F.a0, F.a1)); xs.sort((a, b) => a - b);
  for (let k = 0; k < xs.length - 1; k++) {
    const p0 = xs[k], p1 = xs[k + 1]; if (p1 - p0 < .05) continue; const m = (p0 + p1) / 2;
    const cov = holes.filter(o => m > o.c - o.w / 2 && m < o.c + o.w / 2).map(o => [o.kind === 'door' ? F.y0 : o.y0, o.y0 + o.h]).sort((a, b) => a[0] - b[0]);   // sotto le porte nessun gradino
    let y = F.y0; for (const [a, b] of cov) { box(p0, p1, y, a); y = Math.max(y, b); } box(p0, p1, y, F.y1);
  }
  return pieces;
}
// punto sulla facciata: a lungo l'asse, d verso l'esterno dal piano esterno, y
function aaaAt(F, a, d, y) { return F.axis === 'x' ? [a, y, F.fixed + F.out * d] : [F.fixed + F.out * d, y, a]; }
function aaaRotY(F) { return F.axis === 'x' ? 0 : PI / 2; }

// ---------- finestra, persiane, porta ----------
// base locale di una facciata: A lungo la facciata, N verso l'esterno; scatola allineata a un vettore orizzontale e
function aaaBasis(F) { return F.axis === 'x' ? { A: new V3(1, 0, 0), N: new V3(0, 0, F.out) } : { A: new V3(0, 0, 1), N: new V3(F.out, 0, 0) }; }
function aaaBoxAlong(G, mat, p, e, sx, sy, sz, col) { G.add(mat, ABX.box, p.x, p.y, p.z, 0, Math.atan2(-e.z, e.x), 0, sx, sy, sz, col); }
function aaaWindow(G, F, o, st, sr) {
  const M = AAA.mats, ry = aaaRotY(F), inset = F.t * .32, fr = .07;
  const P = (a, d, y, sa, sy, sd, mat, col, rx = 0, rz = 0) => { const [x, yy, z] = aaaAt(F, a, d, y); F.axis === 'x' ? G.add(mat, ABX.box, x, yy, z, rx, ry * 0, rz, sa, sy, sd, col) : G.add(mat, ABX.box, x, yy, z, rz, 0, rx, sd, sy, sa, col); };
  const y0 = o.y0, y1 = o.y0 + o.h, c = o.c, w = o.w;
  // telaio, croce, vetri
  P(c - w / 2 + fr / 2, -inset, (y0 + y1) / 2, fr, o.h, .09, M.paint, st.frame); P(c + w / 2 - fr / 2, -inset, (y0 + y1) / 2, fr, o.h, .09, M.paint, st.frame);
  P(c, -inset, y0 + fr / 2, w, fr, .09, M.paint, st.frame); P(c, -inset, y1 - fr / 2, w, fr, .09, M.paint, st.frame);
  P(c, -inset, (y0 + y1) / 2, .05, o.h, .06, M.paint, st.frame); P(c, -inset, y0 + o.h * .62, w, .05, .06, M.paint, st.frame);
  if (!o.broken) { const [x, yy, z] = aaaAt(F, c, -inset - .02, (y0 + y1) / 2); F.axis === 'x' ? G.add(M.glass, ABX.box, x, yy, z, 0, 0, 0, w - .1, o.h - .1, .012) : G.add(M.glass, ABX.box, x, yy, z, 0, 0, 0, .012, o.h - .1, w - .1); }
  // davanzale in pietra (leggermente inclinato), architrave
  P(c, .04, y0 - .06, w + .24, .12, F.t * .5 + .1, st.sillMat || M.stoneLight);
  if (st.lintel === 'wood') P(c, -.02, y1 + .1, w + .5, .2, F.t * .9, M.woodDark);
  else if (st.lintel === 'stone') for (let k = 0; k < 3; k++) P(c - w / 2 - .12 + (w + .24) * (k + .5) / 3, .015, y1 + .14, (w + .26) / 3 - .02, .28, F.t * .95, M.stoneLight);
  // persiane a tavole (aperte, appoggiate al muro con un angolo), traverse e saetta
  if (st.shutters && !o.noShut) { const { A, N } = aaaBasis(F); for (const sd of [-1, 1]) {
    const sw = w / 2 + .02, del = (o.open ?? (.12 + sr() * .3)), e = A.clone().multiplyScalar(sd * Math.cos(del)).addScaledVector(N, Math.sin(del));
    const hingeP = new V3(...aaaAt(F, c + sd * (w / 2 + .03), .05, 0));
    for (let k = 0; k < 4; k++) { const off = (k + .5) * sw / 4, pc = hingeP.clone().addScaledVector(e, off); pc.y = (y0 + y1) / 2; aaaBoxAlong(G, M.paint, pc, e, sw / 4 - .012, o.h + .02, .035, st.shutter); }
    for (const yy of [y0 + .22, y1 - .22]) { const pc = hingeP.clone().addScaledVector(e, sw / 2).addScaledVector(N, .03); pc.y = yy; aaaBoxAlong(G, M.paint, pc, e, sw * .96, .1, .03, st.shutter); }
    { const pc = hingeP.clone().addScaledVector(e, sw / 2).addScaledVector(N, .03); pc.y = (y0 + y1) / 2; G.add(M.paint, ABX.box, pc.x, pc.y, pc.z, 0, Math.atan2(-e.z, e.x), .9 * sd, sw * 1.15, .08, .03, st.shutter); }
    const hp = hingeP.clone(); hp.y = y0 + .25; G.add(M.metal, ABX.box, hp.x, hp.y, hp.z, 0, 0, 0, .04, .04, .04); hp.y = y1 - .25; G.add(M.metal, ABX.box, hp.x, hp.y, hp.z, 0, 0, 0, .04, .04, .04);
  } }
}
function aaaDoor(G, F, o, st, open) {
  const M = AAA.mats, inset = F.t * .55, y0 = o.y0, y1 = o.y0 + o.h, c = o.c, w = o.w;
  const P = (a, d, y, sa, sy, sd, mat, col, ry = 0) => { const [x, yy, z] = aaaAt(F, a, d, y); F.axis === 'x' ? G.add(mat, ABX.box, x, yy, z, 0, ry, 0, sa, sy, sd, col) : G.add(mat, ABX.box, x, yy, z, 0, ry, 0, sd, sy, sa, col); };
  P(c - w / 2 + .05, -inset, (y0 + y1) / 2, .1, o.h, .14, M.woodDark); P(c + w / 2 - .05, -inset, (y0 + y1) / 2, .1, o.h, .14, M.woodDark); P(c, -inset, y1 - .06, w, .12, .14, M.woodDark);
  P(c, .12, y0 - .08, w + .45, .16, F.t + .4, M.stoneLight);   // soglia di pietra
  if (st.lintel !== 'none') P(c, .02, y1 + .16, w + .6, .3, F.t * .95, st.lintel === 'wood' ? M.woodDark : M.stoneLight);
  // anta a tavole verticali con traverse: chiusa nel vano o aperta verso l'interno
  const { A, N } = aaaBasis(F), n = Math.max(4, Math.round((w - .12) / .15)), L = w - .14;
  const hinge = new V3(...aaaAt(F, c - w / 2 + .08, -inset, 0)), ang = open ? 1.3 : 0, e = A.clone().multiplyScalar(Math.cos(ang)).addScaledVector(N, -Math.sin(ang));
  for (let k = 0; k < n; k++) { const pc = hinge.clone().addScaledVector(e, (k + .5) * L / n); pc.y = (y0 + y1) / 2 - .02; aaaBoxAlong(G, M.paint, pc, e, L / n - .008, o.h - .1, .05, st.door); }
  for (const yy of [y0 + .35, (y0 + y1) / 2 + .1, y1 - .4]) { const pc = hinge.clone().addScaledVector(e, L / 2).addScaledVector(N.clone().applyAxisAngle(new V3(0, 1, 0), 0), -.04 * Math.cos(ang)); pc.addScaledVector(A, open ? .04 * Math.sin(ang) : 0); pc.y = yy; aaaBoxAlong(G, M.paint, pc, e, L * .96, .12, .03, st.door); }
  { const pc = hinge.clone().addScaledVector(e, L * .8); pc.y = (y0 + y1) / 2; G.add(M.metal, ABX.box, pc.x, pc.y, pc.z, 0, 0, 0, .05, .05, .05); }

}

// ---------- tetto a tegole/ardesia ----------
// o: cx, cz, along, L, W (metà larghezza dell'edificio), top (gronda), pitch, ov, type 'gable'|'hip', tile 'tile'|'slate', cols, moss
function aaaRoof(G, o, sr) {
  const M = AAA.mats, tan = Math.tan(o.pitch), rh = o.W * tan, yr = o.top + rh, L = o.L, W = o.W, ov = o.ov, PZ = AAA_PRESETS[AAA.preset];
  const Pw = (u, v, y) => o.along === 'x' ? [o.cx + u, y, o.cz + v] : [o.cx + v, y, o.cz + u];
  const slopeLen = Math.hypot(W + ov, rh + ov * tan), cosP = Math.cos(o.pitch);
  const big = PZ.tiles ? 1 : 2.4, tw = (o.tile === 'slate' ? .32 : .2) * big, tl = (o.tile === 'slate' ? .42 : .3) * big, ex = (o.tile === 'slate' ? .19 : .13) * big;   // larghezza, lunghezza, parte esposta
  const tileGeo = new THREE.BoxGeometry(1, 1, 1);
  const pos = [], nor = [], col = [];
  const pushBox = (cx, cy, cz, sx, sy, sz, rx, ry, color) => { _ab.e.set(rx, ry, 0, 'YXZ'); _ab.q.setFromEuler(_ab.e); _ab.m.compose(_ab.p.set(cx, cy, cz), _ab.q, _ab.s.set(sx, sy, sz)); const g = tileGeo.clone().applyMatrix4(_ab.m).toNonIndexed(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); const c = new THREE.Color(color).convertSRGBToLinear(); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b); };
  // falde: per ogni lato s, file dalla gronda al colmo; nelle falde a padiglione le file si accorciano verso il colmo
  const rows = Math.ceil(slopeLen / ex);
  for (const s of [-1, 1]) for (let r = 0; r < rows; r++) {
    const k = (r + .5) / rows, vv = s * (W + ov) * (1 - k), yy = o.top - ov * tan + (rh + ov * tan) * k;
    const halfLen = o.type === 'hip' ? Math.max(.1, L + ov - (W + ov) * k) : L + ov;
    const n = Math.max(1, Math.round(halfLen * 2 / tw)), w0 = halfLen * 2 / n;
    const mossRow = o.moss * smooth(1 - k * 2.2);
    for (let i = 0; i < n; i++) {
      const uu = -halfLen + (i + .5 + (r % 2 ? .5 : 0) * (i < n - 1 ? 1 : 0)) * w0; if (Math.abs(uu) > halfLen) continue;
      let c = new THREE.Color(o.cols[(sr() * o.cols.length) | 0]).multiplyScalar(.82 + sr() * .3);
      if (sr() < mossRow * .8) c.lerp(new THREE.Color(sr() < .5 ? 0x4a5226 : 0x6a6a3a), .5 + sr() * .4); else if (sr() < .05) c.multiplyScalar(.6);
      const tilt = o.pitch + .05 + (sr() - .5) * .04, [x, y, z] = Pw(uu, vv, yy + .02);
      if (o.along === 'x') pushBox(x, y, z, w0 - .012, .028, tl, s * tilt, (sr() - .5) * .03, c.getHex());
      else { _ab.e.set(0, 0, 0); pushBox(x, y, z, tl, .028, w0 - .012, 0, 0, c.getHex()); const N = pos.length; /* inclinazione attorno a x per falde lungo z: ruoto gli ultimi vertici */ const cnt = 36, base = pos.length - cnt * 3; for (let q = 0; q < cnt; q++) { const ix = base + q * 3; const lx = pos[ix] - x, ly = pos[ix + 1] - y; const a = -s * tilt; pos[ix] = x + lx * Math.cos(a) - ly * Math.sin(a); pos[ix + 1] = y + lx * Math.sin(a) + ly * Math.cos(a); const nx = nor[ix], ny = nor[ix + 1]; nor[ix] = nx * Math.cos(a) - ny * Math.sin(a); nor[ix + 1] = nx * Math.sin(a) + ny * Math.cos(a); } }
    }
  }
  // falde di testa (padiglione): triangoli di file lungo l'asse
  if (o.type === 'hip') for (const s of [-1, 1]) for (let r = 0; r < rows; r++) {
    const k = (r + .5) / rows, uu = s * (L + ov - (W + ov) * k) , yy = o.top - ov * tan + (rh + ov * tan) * k, halfW = Math.max(.05, (W + ov) * (1 - k));
    const n = Math.max(1, Math.round(halfW * 2 / tw)), w0 = halfW * 2 / n;
    for (let i = 0; i < n; i++) { const vv = -halfW + (i + .5) * w0; let c = new THREE.Color(o.cols[(sr() * o.cols.length) | 0]).multiplyScalar(.82 + sr() * .3); if (sr() < o.moss * smooth(1 - k * 2.2) * .7) c.lerp(new THREE.Color(0x4a5226), .6);
      const [x, y, z] = Pw(uu, vv, yy + .02), tilt = o.pitch + .05;
      if (o.along === 'x') { pushBox(x, y, z, tl, .028, w0 - .012, 0, 0, c.getHex()); const cnt = 36, base = pos.length - cnt * 3; for (let q = 0; q < cnt; q++) { const ix = base + q * 3; const lx = pos[ix] - x, ly = pos[ix + 1] - y; const a = -s * tilt; pos[ix] = x + lx * Math.cos(a) - ly * Math.sin(a); pos[ix + 1] = y + lx * Math.sin(a) + ly * Math.cos(a); const nx = nor[ix], ny = nor[ix + 1]; nor[ix] = nx * Math.cos(a) - ny * Math.sin(a); nor[ix + 1] = nx * Math.sin(a) + ny * Math.cos(a); } }
      else pushBox(x, y, z, w0 - .012, .028, tl, s * tilt, 0, c.getHex()); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  G.raw(M.roofTile, g);
  // sottotetto (tavolato) sotto le file, colmo a coppi o lamiera, frontoni
  const under = (pts) => { const p2 = []; for (const q of pts) p2.push(...Pw(...q)); const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); gg.computeVertexNormals(); G.raw(M.woodDark, gg); };
  const ye = o.top - ov * tan - .03, yr2 = yr - .03;
  if (o.type === 'gable') for (const s of [-1, 1]) { const a = [[-L - ov, s * (W + ov), ye], [L + ov, s * (W + ov), ye], [L + ov, 0, yr2], [-L - ov, 0, yr2]]; const t = s > 0 ? [a[0], a[1], a[2], a[0], a[2], a[3]] : [a[0], a[2], a[1], a[0], a[3], a[2]]; under(t.map(q => q)); under(t.slice().reverse()); }
  else { const r0 = Math.max(.05, L - W); for (const s of [-1, 1]) { const a = [[-L - ov, s * (W + ov), ye], [L + ov, s * (W + ov), ye], [r0, 0, yr2], [-r0, 0, yr2]]; const t = [a[0], a[1], a[2], a[0], a[2], a[3]]; under(t); under(t.slice().reverse()); const b = [[s * (L + ov), -(W + ov), ye], [s * (L + ov), W + ov, ye], [s * r0, 0, yr2]]; under(b); under(b.slice().reverse()); } }
  const ridgeL = o.type === 'hip' ? Math.max(.2, L - W) : L + ov + .05;
  for (let u = -ridgeL; u < ridgeL; u += .38) { const [x, y, z] = Pw(u + .19, 0, yr + .04); const col2 = o.tile === 'slate' ? 0x5a5a58 : new THREE.Color(o.cols[0]).multiplyScalar(.85).getHex(); G.add(M.roofTile, ABX.half, x, y, z, o.along === 'x' ? 0 : 0, o.along === 'x' ? 0 : PI / 2, PI / 2, .14, .4, .14, col2); }
  return { yr, rh };
}
function aaaGable(G, mat, o, s) {
  // frontone pieno sopra la gronda (stesso materiale del muro), spessore del muro
  const F = { axis: o.along === 'x' ? 'z' : 'x', fixed: (o.along === 'x' ? o.cx : o.cz) + s * o.L, out: s, a0: (o.along === 'x' ? o.cz : o.cx) - o.W, a1: (o.along === 'x' ? o.cz : o.cx) + o.W, y0: o.top, y1: o.top + o.W * Math.tan(o.pitch), t: o.t };
  const g = aaaWall(G, mat, F, o.holes || [], [[F.a1 - F.a0, 0], [o.W, F.y1 - F.y0]]);
  // collider del frontone (approssimato con la metà inferiore)
  const sl = F.axis === 'x' ? addSolid(F.a0 + o.W * .5, F.y0, Math.min(F.fixed, F.fixed - F.out * F.t), F.a1 - o.W * .5, F.y0 + (F.y1 - F.y0) * .5, Math.max(F.fixed, F.fixed - F.out * F.t), 'house') : addSolid(Math.min(F.fixed, F.fixed - F.out * F.t), F.y0, F.a0 + o.W * .5, Math.max(F.fixed, F.fixed - F.out * F.t), F.y0 + (F.y1 - F.y0) * .5, F.a1 - o.W * .5, 'house'); sl.mat = 'muratura';
  return g;
}
function aaaChimney(G, o, u, v, mat, sr) {
  const M = AAA.mats, Pw = (uu, vv, y) => o.along === 'x' ? [o.cx + uu, y, o.cz + vv] : [o.cx + vv, y, o.cz + uu];
  const hTop = o.yr + 1.1, [x, , z] = Pw(u, v, 0), hb = o.top - 1;
  G.add(mat, ABX.box, x, (hb + hTop) / 2, z, 0, 0, 0, .95, hTop - hb, .75);
  G.add(M.stoneLight, ABX.box, x, hTop + .06, z, 0, 0, 0, 1.12, .12, .92); G.add(M.stoneLight, ABX.box, x, hTop - .35, z, 0, 0, 0, 1.02, .08, .82);
  for (const k of [-1, 1]) G.add(M.vc, ABX.cyl, x + k * .22, hTop + .32, z, 0, 0, 0, .1, .4, .1, 0x9a5a3e);   // vasi di terracotta
}
function aaaGutter(G, o) {
  const M = AAA.mats, Pw = (u, v, y) => o.along === 'x' ? [o.cx + u, y, o.cz + v] : [o.cx + v, y, o.cz + u], ye = o.top - o.ov * Math.tan(o.pitch) - .08;
  for (const s of [-1, 1]) { const [x, y, z] = Pw(0, s * (o.W + o.ov - .05), ye); G.add(M.metal, ABX.half, x, y, z, 0, o.along === 'x' ? 0 : PI / 2, PI / 2, .07, (o.L + o.ov) * 2, .07, undefined);
    const [dx, , dz] = Pw(s * (o.L - .3), s * (o.W + o.ov - .05), 0); G.add(M.metal, ABX.cyl, dx, (ye + o.base) / 2, dz, 0, 0, 0, .045, ye - o.base, .045); }
}

// ---------- edificio completo ----------
// def: { id, x, z, w, d, storeys, sh, wall: 'pietra'|'intonaco'|'mattoni', roof: {type, tile, pitch, cols, moss}, along, faces: { '+z': [aperture], ... }, style, interior }
function aaaBuilding(def) {
  const M = aaaMats(), sr = seeded(def.seed || 1), G = new AGeo();
  const base = def.base, t = def.t || .55, top = base + def.storeys * def.sh;
  const wallMat = def.wall === 'intonaco' ? aaaTri('plaster', .45, { nStr: 1, macro: .28, damp: 1.3, moss: .5, baseY: base, color: def.wallCol || 0xe2d6bc }) : def.wall === 'mattoni' ? aaaTri('brick', .75, { nStr: 1.3, macro: .2, damp: 1.2, moss: .6, baseY: base, color: 0xa88878 }) : aaaTri(def.rubble ? 'cobble' : 'stone', def.rubble ? .36 : .5, { nStr: 1.7, macro: .26, moss: 1.1, damp: 1.2, baseY: base, color: def.wallCol || 0xc4b8a0 });
  const { x: cx, z: cz, w, d } = def;
  const faces = {
    '+z': { axis: 'x', fixed: cz + d / 2, out: 1, a0: cx - w / 2, a1: cx + w / 2, y0: base - .5, y1: top, t },
    '-z': { axis: 'x', fixed: cz - d / 2, out: -1, a0: cx - w / 2, a1: cx + w / 2, y0: base - .5, y1: top, t },
    '+x': { axis: 'z', fixed: cx + w / 2, out: 1, a0: cz - d / 2 + t, a1: cz + d / 2 - t, y0: base - .5, y1: top, t },
    '-x': { axis: 'z', fixed: cx - w / 2, out: -1, a0: cz - d / 2 + t, a1: cz + d / 2 - t, y0: base - .5, y1: top, t },
  };
  const st = Object.assign({ frame: 0xd8d2c4, shutter: 0x5a7262, door: 0x4a3a2c, lintel: 'stone', shutters: true }, def.style || {});
  for (const k in faces) {
    const F = faces[k], ops = (def.faces[k] || []).map(o => Object.assign({}, o, { y0: base + o.y, h: o.h }));
    aaaWall(G, wallMat, F, ops); aaaWallSolids(F, ops);
    for (const o of ops) o.kind === 'door' ? aaaDoor(G, F, o, st, o.open) : aaaWindow(G, F, o, st, sr);
    // zoccolo sporgente e scuro
    const [x, y, z] = aaaAt(F, (F.a0 + F.a1) / 2, .03, base - .1); F.axis === 'x' ? G.add(M.stoneDark, ABX.box, x, y, z, 0, 0, 0, F.a1 - F.a0 + .12, .7, .1) : G.add(M.stoneDark, ABX.box, x, y, z, 0, 0, 0, .1, .7, F.a1 - F.a0 - .1);
  }
  // cantonali alternati (case in pietra e in mattoni), leggermente sporgenti, più chiari
  if (def.wall !== 'intonaco' || def.quoins) for (const [qx, qz] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2]]) {
    const sx = qx > cx ? -1 : 1, sz = qz > cz ? -1 : 1;
    for (let y = base, k = 0; y < top - .2; k++) { const h = .32 + sr() * .1, lx = k % 2 ? .62 : .36, lz = k % 2 ? .36 : .62; aaaStoneBlock(G, M.stoneLight, qx + sx * (lx / 2 - .025), y + h / 2, qz + sz * (lz / 2 - .025), lx + .05, h - .02, lz + .05, 0, sr); y += h; }
  }
  // fascia marcapiano fra i piani (case in pietra a due piani)
  if (def.storeys > 1 && def.band) for (const k in faces) { const F = faces[k], [x, y, z] = aaaAt(F, (F.a0 + F.a1) / 2, .04, base + def.sh - .05); F.axis === 'x' ? G.add(M.stoneLight, ABX.box, x, y, z, 0, 0, 0, F.a1 - F.a0 + .1, .16, .12) : G.add(M.stoneLight, ABX.box, x, y, z, 0, 0, 0, .12, .16, F.a1 - F.a0 - .1); }
  // tetto
  const R = def.roof, along = def.along || (w >= d ? 'x' : 'z'), L = (along === 'x' ? w : d) / 2, W = (along === 'x' ? d : w) / 2;
  const ro = { cx, cz, along, L, W, top, pitch: R.pitch, ov: R.ov ?? .4, type: R.type, tile: R.tile, cols: R.cols, moss: R.moss ?? .5, t, base, holes: R.gableHoles };
  const rr = aaaRoof(G, ro, sr); ro.yr = rr.yr;
  if (R.type === 'gable') for (const s of [-1, 1]) aaaGable(G, wallMat, ro, s);
  for (const c of R.chimneys || []) aaaChimney(G, ro, c[0], c[1], def.wall === 'mattoni' ? wallMat : aaaTri('stone', .5, { nStr: 1.4, baseY: top, color: def.wallCol || 0xd6ccb4 }), sr);
  if (R.gutter !== false) aaaGutter(G, ro);
  // collider del tetto (blocca vista e colpi), stanze interne per la luce
  const rs = addSolid(cx - w / 2, top, cz - d / 2, cx + w / 2, top + rr.rh * .55, cz + d / 2, 'house'); rs.mat = 'legno';
  if (def.room !== false) aaaRoom(cx - w / 2 + t - .02, base - .3, cz - d / 2 + t - .02, cx + w / 2 - t + .02, top + rr.rh, cz + d / 2 - t + .02);
  const grp = G.build(); AAA.objs.push({ id: def.id, grp, def });
  return { G, grp, base, top, faces, ro, wallMat };
}
