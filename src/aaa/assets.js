"use strict";
// ============================================================
//  AAA Graphics Test — asset CC0 di Poly Haven (vedi assets/aaa/LICENZE.md).
//  Caricati solo quando parte la demo (due file JS con i dati incorporati: dal file locale il browser non lascia
//  leggere a WebGL immagini e modelli separati). Texture 1k: colore, normale, AO/rugosità/metallo. Modelli glTF in GLB.
// ============================================================
const TEXH = {}; const AAA_M = {};
function aaaLoadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('asset non trovato: ' + src)); document.head.appendChild(s); }); }
async function aaaLoadAssets() {
  const t0 = performance.now();
  try {
    if (!window.AAA_TEX) await aaaLoadScript('assets/aaa/aaa_tex.js');
    if (!window.AAA_GLB) await aaaLoadScript('assets/aaa/aaa_models.js');
    if (!THREE.GLTFLoader) await aaaLoadScript('assets/lib/three/examples/js/GLTFLoader.js');
  } catch (e) { console.warn('AAA: asset di alta qualità non disponibili, uso i materiali del gioco', e); AAA.st.hq = false; return; }
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const img = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const jobs = [];
  for (const k in window.AAA_TEX) {
    const e = window.AAA_TEX[k];
    jobs.push(Promise.all([img(e.c), img(e.n), img(e.a)]).then(([c, n, a]) => {
      const T = (im, srgb) => { const t = new THREE.Texture(im || undefined); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.encoding = THREE.sRGBEncoding; t.needsUpdate = !!im; return t; };
      TEXH[k] = { map: T(c, true), normal: T(n), arm: T(a) };
    }));
  }
  const loader = new THREE.GLTFLoader();
  for (const k in window.AAA_GLB) {
    const b64 = window.AAA_GLB[k], bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    jobs.push(new Promise(res => loader.parse(bin.buffer, '', g => { AAA_M[k] = g.scene; res(); }, err => { console.warn('GLB', k, err); res(); })));
  }
  await Promise.all(jobs);
  AAA.st.hq = true; AAA.st.assetMs = Math.round(performance.now() - t0); AAA.st.models = Object.keys(AAA_M).length; AAA.st.texHQ = Object.keys(TEXH).length;
}
// istanza di un modello: copia leggera (geometrie e materiali condivisi), ombre, luce degli interni, collisione semplice
const _amBox = new THREE.Box3();
function aaaModel(name, x, z, ry = 0, s = 1, o = {}) {
  const src = AAA_M[name]; if (!src) return null;
  if (!src.userData.prep) {
    src.userData.prep = true;
    src.traverse(m => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
      const mt = m.material; if (mt && !mt.userData.aaa) { mt.userData.aaa = true; if (mt.map) mt.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (mt.alphaTest > 0 || mt.transparent) { mt.alphaTest = Math.max(mt.alphaTest, .4); mt.transparent = false; mt.side = THREE.DoubleSide; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mt.map, alphaTest: .4 }); } aaaPatch(mt, { key: 'gl_' + name + '_' + (mt.name || mt.uuid.slice(0, 4)) }); } });
  }
  const g = src.clone(); const y = o.y ?? aaaH(x, z);
  g.position.set(x, y + (o.dy || 0), z); g.rotation.set(o.rx || 0, ry, o.rz || 0); g.scale.setScalar(s); scene.add(g); g.updateMatrixWorld(true);
  if (o.solid !== false) { _amBox.setFromObject(g); if (o.round) OBST.push({ x, z, r: Math.max(_amBox.max.x - _amBox.min.x, _amBox.max.z - _amBox.min.z) / 2 }); else if (_amBox.max.y - _amBox.min.y > .25) { const so = addSolid(_amBox.min.x, _amBox.min.y, _amBox.min.z, _amBox.max.x, _amBox.max.y, _amBox.max.z, o.tag || 'crate'); so.mat = o.mat || 'legno'; } }
  AAA.st.modelInst = (AAA.st.modelInst || 0) + 1; return g;
}
// misura di un modello (per appoggiarlo su altri oggetti)
function aaaModelSize(name) { const src = AAA_M[name]; if (!src) return null; _amBox.setFromObject(src); return _amBox.getSize(new V3()); }
// collocazione dei modelli nella scena (a mano), con ripiego sugli oggetti procedurali quando mancano
function aaaPlaceModels() {
  if (!AAA.st.hq) return false;
  const U = (u, v) => [AV.cx + u, AV.cz + v], A = AAA.defs.A, I = AAA.interior, sr = seeded(808), r = (a, b) => a + sr() * (b - a);
  // cortile: botti, cassette, cesta, secchi, scala, attrezzi
  aaaModel('wine_barrel_01', ...U(46.2, -11.2), .3, 1, { round: true }); aaaModel('wine_barrel_01', ...U(47, -12.1), 1.2, 1, { round: true }); aaaModel('wine_barrel_01', ...U(45.8, -12.9), 2.2, .95, { round: true });
  aaaModel('wooden_crate_01', ...U(43.5, -15.5), .4); aaaModel('wooden_crate_01', ...U(44.3, -15.9), -.2); aaaModel('wicker_basket_01', ...U(43.9, -14.7), .8, 1, { solid: false });
  aaaModel('wooden_bucket_01', ...U(33.4, -9.2), 0, 1, { solid: false }); aaaModel('wooden_bucket_01', ...U(31.2, -21.5), 1.4, 1, { solid: false });
  aaaModel('wooden_ladder', ...U(28.6, -24.2), PI / 2, 1, { rx: -.28, solid: false, dy: .05 }); aaaModel('rusted_spade_01', ...U(28.4, -19.4), PI / 2, 1, { rx: -.25, solid: false });
  aaaModel('hatchet', ...U(31, -22), .5, 1, { solid: false, dy: 1.1 });
  // casa A: botte vicino alla porta, cesta, sgabello
  aaaModel('wine_barrel_01', ...U(-9.4, -1.7), .3, 1, { round: true }); aaaModel('wooden_stool_01', ...U(-11.6, -1.9), .6, 1, { round: true }); aaaModel('wicker_basket_01', ...U(-11.9, -1.4), .2, 1, { solid: false });
  // Sherman: casse militari, cassetta di munizioni, taniche, maschera antigas sui sacchi
  aaaModel('wooden_military_crate', ...U(8.6, 12.2), .2); aaaModel('wooden_military_crate', ...U(9.6, 12.6), -.35); aaaModel('ammo_box', ...U(7.8, 12.5), .6, 1, { solid: false });
  aaaModel('metal_jerrycan_green', ...U(7.2, 12.7), .3, 1, { solid: false }); aaaModel('metal_jerrycan_green', ...U(6.8, 12.9), .9, 1, { solid: false });
  { const [x, z] = U(-2.2, 12.6); aaaModel('old_gas_mask', x, z, .4, 1, { solid: false, y: aaaH(x, z) + .62 }); }
  // interni: tavolo, sedie, credenza dipinta, lanterna, brocca, pentola nel camino, letto di sopra
  if (I) {
    const tx = I.x0 + 2.4, tz = (I.z0 + I.z1) / 2 - .2, fl = I.base + .01;
    AAA.hideProcFurniture = true;
    aaaModel('painted_wooden_table', tx, tz, PI / 2, 1, { y: fl });
    const ts = aaaModelSize('painted_wooden_table'), top = fl + (ts ? ts.y : .78);
    aaaModel('Lantern_01', tx - .15, tz + .2, .4, 1, { y: top, solid: false });
    { const L = new THREE.PointLight(0xffb070, .9, 7, 2); L.position.set(tx - .15, top + .25, tz + .2); scene.add(L); AAA.lamp = L; }   // luce calda della lanterna (una sola luce dinamica) aaaModel('jug_01', tx + .45, tz - .15, 1, 1, { y: top, solid: false });
    aaaModel('pot_enamel_01', I.x0 + .45, (I.z0 + I.z1) / 2 + .6, 0, 1, { y: I.base + .12, solid: false });
    aaaModel('painted_wooden_cabinet', I.x0 + 2.2, I.z1 - .35, PI, 1, { y: fl });
    aaaModel('old_bed_frame', I.x0 + 1.2, I.z1 - 1.2, PI / 2, 1, { y: I.fy + .05, solid: false });
    aaaModel('wooden_stool_01', I.px + 1.3, I.z0 + 2.2, .5, 1, { y: fl, solid: false });
  }
  // vegetazione di dettaglio istanziata: varianti singole dei set (felci, ortiche, ciuffi d'erba, cespugli, sassi muschiati)
  const KS = { LOW: 0, MEDIUM: .35, HIGH: .6, ULTRA: 1 }[AAA.preset] ?? .6, keep = () => sr() < KS;
  const L = { grass_medium_01: [], fern_02: [], nettle_plant: [], shrub_02: [], rock_moss_set_01: [] };
  const wallFoot = [[-21, -7, -2.9], [26.4, 26.4, -24, -5, 'z'], [27.5, 47, -3], [-5, 9, 13.9]];
  for (const [a0, a1, b, b1, ax] of wallFoot) for (let k = 0; k < 26; k++) { const t = r(0, 1); const u = ax === 'z' ? a0 + r(-.6, .6) : lerp(a0, a1, t), v = ax === 'z' ? lerp(b, b1, t) : b + r(-.5, .5); if (keep()) L[sr() < .55 ? 'grass_medium_01' : sr() < .6 ? 'nettle_plant' : 'fern_02'].push([...U(u, v), r(0, TAU), r(.7, 1.15)]); }
  for (let k = 0; k < 260; k++) { const u = r(-75, 75), v = avRoadV(u) + (sr() < .5 ? -1 : 1) * r(2.7, 4.2); if (keep()) L.grass_medium_01.push([...U(u, v), r(0, TAU), r(.7, 1.2)]); }   // bordi della strada
  for (const b of AV.banks) for (let i2 = 0; i2 < b.length - 1; i2++) { const [u0, v0] = b[i2], [u1, v1] = b[i2 + 1], Ln = Math.hypot(u1 - u0, v1 - v0), nx = -(v1 - v0) / Ln, nz = (u1 - u0) / Ln; for (let d = 0; d < Ln; d += r(1.5, 3)) { const k = d / Ln, sd = sr() < .5 ? -1 : 1, off = r(1.3, 2.1) * sd; if (keep()) L[sr() < .4 ? 'fern_02' : sr() < .5 ? 'nettle_plant' : sr() < .7 ? 'shrub_02' : 'grass_medium_01'].push([...U(lerp(u0, u1, k) + nx * off, lerp(v0, v1, k) + nz * off), r(0, TAU), r(.7, 1.1)]); } }
  for (const [u, v] of [[-30, 15], [22, 16], [-6, -14], [50, -40], [10, 22], [-45, -20], [60, 15], [35, 40]]) L.rock_moss_set_01.push([...U(u, v), r(0, TAU), r(.8, 1.1)]);
  for (const k in L) aaaScatter(k, L[k], k === 'rock_moss_set_01' ? -.08 : -.02);
  return true;
}
// set di varianti → una InstancedMesh per variante (geometria centrata, base a terra), scelta della variante deterministica
function aaaScatter(name, list, dy = 0) {
  const src = AAA_M[name]; if (!src || !list.length) return; src.updateMatrixWorld(true);
  const vars = []; src.traverse(m => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); g.computeBoundingBox(); const c = g.boundingBox.getCenter(new V3()); g.translate(-c.x, -g.boundingBox.min.y, -c.z); const mt = m.material; if (!mt.userData.aaa) { mt.userData.aaa = true; if (mt.alphaTest > 0 || mt.transparent || /leaf|grass|fern|nettle|shrub/i.test(name)) { mt.alphaTest = Math.max(mt.alphaTest, .45); mt.transparent = false; mt.side = THREE.DoubleSide; } aaaPatch(mt, { key: 'sc_' + name + '_' + mt.uuid.slice(0, 4) }); } vars.push({ g, mt }); });
  const by = vars.map(() => []); list.forEach((p, i) => by[(i * 7 + Math.abs(Math.floor(p[0] * 13 + p[1] * 7))) % vars.length].push(p));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  vars.forEach((v, k) => { const L2 = by[k]; if (!L2.length) return; const im = new THREE.InstancedMesh(v.g, v.mt, L2.length); im.receiveShadow = true; im.castShadow = AAA.preset === 'ULTRA' || /rock|shrub/.test(name); if (v.mt.alphaTest > 0) im.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: v.mt.map, alphaTest: .45 });
    L2.forEach(([x, z, ry, s], i) => { q.setFromAxisAngle(new V3(0, 1, 0), ry); m4.compose(new V3(x, aaaH(x, z) + dy, z), q, new V3(s, s, s)); im.setMatrixAt(i, m4); }); scene.add(im); });
  AAA.st.scatter = (AAA.st.scatter || 0) + list.length;
}

