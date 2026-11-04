"use strict";
// ============================================================
//  AAA Graphics Test — asset della pipeline Blender (tools/asset-pipeline).
//  Ogni asset è un GLB con tre livelli di dettaglio (mesh «<id>_LOD0/1/2») e un manifest (collisioni, interni,
//  distanze dei LOD per preset). Le mesh portano solo il nome del materiale: qui diventano MeshStandardMaterial
//  CONDIVISI fra tutti gli asset, con le texture PBR CC0 già caricate dalla demo (TEXH: nessuna copia in memoria).
//  La scala delle texture è già nelle UV (metri / ripetizione decisa dalla pipeline), quindi repeat = 1.
//  Solo nella modalità AAA: le mappe originali non caricano questo file.
// ============================================================
const PIPE = { cache: {}, mats: {}, lib: null, inst: [] };
// libreria dei materiali (copia di tools/asset-pipeline/manifests/materials.json, solo i campi usati a runtime)
const PIPE_MATS = {
  stone: ['muro_pietra', [1, .97, .92], 1, 0, .5, .8], stone_wet: ['muro_pietra', [.62, .62, .6], .72, 0, 1, 1], stone_attic: ['muro_pietra', [.55, .5, .45], 1, 0],
  quoin: ['intonaco_interno', [1.32, 1.27, 1.12], .95, 0, .35, .6], plaster_int: ['intonaco_pietra', [2.5, 2.42, 2.25], 1, 0], wood: ['tavole_vecchie', [.95, .9, .85], .9, 0],
  wood_paint: ['tavole_vecchie', [.52, .66, .6], .85, 0], oak_beam: ['tavole_fienile', [.62, .5, .4], .9, 0], floor: ['pavimento_pietra', [1.6, 1.5, 1.4], .95, 0],
  slate: ['ardesia', [.5, .56, .66], .62, 0], slate_far: ['ardesia', [.47, .52, .62], .7, 0], clay: ['coppi', [.72, .58, .52], .85, 0], brick: ['mattoni', [.9, .85, .8], .9, 0],
  iron: ['metallo', [.3, .3, .32], .7, .6], moss: ['erba', [.42, .52, .26], 1, 0], soot: ['muro_pietra', [.13, .12, .11], 1, 0],
  glass: [null, [.32, .38, .4], .06, 0], glass_far: [null, [.07, .08, .09], .3, 0],
};
const PIPE_IDS = ['normandy_house_01'];

function pipeMat(name) {
  if (PIPE.mats[name]) return PIPE.mats[name];
  const d = PIPE_MATS[name] || [null, [.6, .6, .6], .8, 0], T = d[0] && typeof TEXH !== 'undefined' ? TEXH[d[0]] : null;
  let m;
  if (name === 'glass') m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...d[1]), roughness: d[2], metalness: 0, transparent: true, opacity: .38, side: THREE.DoubleSide, depthWrite: false, envMap: AAA.cube || null, envMapIntensity: 1 });
  else {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...d[1]), roughness: d[2], metalness: d[3] });
    if (T) { m.map = T.map; m.normalMap = T.normal; m.aoMap = T.arm; m.roughnessMap = T.arm; m.metalnessMap = d[3] ? T.arm : null; m.aoMapIntensity = .8; }
    if (name === 'moss') m.normalScale.set(.6, .6);
  }
  m.name = 'pipe_' + name;
  if (typeof aaaPatch === 'function' && name !== 'glass') aaaPatch(m, { baseY: PIPE.baseY ?? 0, moss: d[4] || 0, damp: d[5] || 0 });
  return (PIPE.mats[name] = m);
}
// caricamento asincrono con cache: lo stesso asset non viene mai scaricato o decodificato due volte
function pipeLoad(id) {
  if (PIPE.cache[id]) return PIPE.cache[id];
  return (PIPE.cache[id] = (async () => {
    const t0 = performance.now();
    if (!(window.AAA_PIPE && window.AAA_PIPE[id])) await aaaLoadScript('assets/aaa/pipeline/' + id + '.js');
    if (!THREE.GLTFLoader) await aaaLoadScript('assets/lib/three/examples/js/GLTFLoader.js');
    const src = window.AAA_PIPE[id], bin = Uint8Array.from(atob(src.glb), c => c.charCodeAt(0));
    const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin.buffer, '', res, rej));
    const lods = {}, st = { triangoli: {}, materiali: new Set(), drawCall: {} };
    gltf.scene.traverse(o => {
      if (!o.isMesh) return; const k = (o.name.match(/LOD\d/) || o.parent.name.match(/LOD\d/) || [])[0]; if (!k) return;
      (lods[k] || (lods[k] = [])).push(o);
      const g = o.geometry; if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', g.attributes.uv);
      const old = o.material; o.material = pipeMat(old.name); st.materiali.add(old.name); old.dispose();
      o.castShadow = !/glass/.test(old.name); o.receiveShadow = true;
      st.triangoli[k] = (st.triangoli[k] || 0) + (g.index ? g.index.count : g.attributes.position.count) / 3;
      st.drawCall[k] = (st.drawCall[k] || 0) + 1;
    });
    const A = { id, man: src.manifest, lods, st: { triangoli: st.triangoli, drawCall: st.drawCall, materiali: [...st.materiali], kb: Math.round(src.glb.length * .75 / 1024), caricamentoMs: Math.round(performance.now() - t0) } };
    window.AAA_PIPE[id].glb = null;   // il base64 non serve più: lo libero
    return A;
  })().catch(e => { console.warn('pipeline: asset non caricato', id, e); delete PIPE.cache[id]; return null; }));
}
// istanza nel mondo: THREE.LOD con le mesh condivise, collisioni del manifest, volumi interni; rotazione a multipli di 90°
function pipePlace(A, x, y, z, quarter = 0, o = {}) {
  const lod = new THREE.LOD(), D = A.man.distanzeLod[AAA.preset] || A.man.distanzeLod.HIGH, dist = [0, D[0], D[1]];
  ['LOD0', 'LOD1', 'LOD2'].forEach((k, i) => { const g = new THREE.Group(); for (const m of A.lods[k] || []) { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = m.castShadow; c.receiveShadow = true; g.add(c); } lod.addLevel(g, dist[i]); });
  lod.position.set(x, y, z); lod.rotation.y = quarter * Math.PI / 2; lod.name = 'pipe_' + A.id; scene.add(lod); lod.updateMatrixWorld(true);
  const rot = (p) => { const v = new V3(p[0], p[1], p[2]).applyAxisAngle(new V3(0, 1, 0), quarter * Math.PI / 2); return v.add(new V3(x, y, z)); };
  const solidsAdded = [];
  if (o.colliders !== false && typeof addSolid === 'function') for (const c of A.man.collisioni) {
    const a = rot(c.min), b = rot(c.max), s = addSolid(a.x, a.y, a.z, b.x, b.y, b.z, 'pipe');
    if (c.walk) s.walk = true; s.mat = /legno|scala|solaio/.test(c.tag) ? 'legno' : 'muratura'; s.pipeTag = c.tag; solidsAdded.push(s);
  }
  if (o.rooms !== false && typeof aaaRoom === 'function') for (const r of A.man.interni) { const a = rot(r.min), b = rot(r.max); aaaRoom(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)); }
  const floorsAdded = [];
  if (o.colliders !== false && typeof FLOORS !== 'undefined' && quarter % 2 === 0) for (const f of A.man.pavimenti || []) {   // superfici calpestabili (pavimento, gradini, scala a rampa, sottotetto)
    const sg = quarter === 2 ? -1 : 1, X = v => x + sg * v, Z = v => z + sg * v;
    const F = { x0: Math.min(X(f.x0), X(f.x1)), x1: Math.max(X(f.x0), X(f.x1)), z0: Math.min(Z(f.z0), Z(f.z1)), z1: Math.max(Z(f.z0), Z(f.z1)), y: y + f.y, pipe: A.id };
    if (f.ramp) F.ramp = { axis: 'x', c0: X(f.ramp.c0), c1: X(f.ramp.c1), y0: y + f.ramp.y0, y1: y + f.ramp.y1 };
    FLOORS.push(F); floorsAdded.push(F);
  }
  const I = { A, obj: lod, solids: solidsAdded, floors: floorsAdded, x, y, z, quarter };
  I.dispose = () => { scene.remove(lod); for (const s of solidsAdded) { const k = solids.indexOf(s); if (k >= 0) solids.splice(k, 1); } for (const f of floorsAdded) { const k = FLOORS.indexOf(f); if (k >= 0) FLOORS.splice(k, 1); } PIPE.inst.splice(PIPE.inst.indexOf(I), 1); };
  PIPE.inst.push(I); return I;
}
// pulizia completa (cambio asset nello showroom): geometrie dell'asset; i materiali condivisi restano finché vive la demo
function pipeUnload(id) {
  const p = PIPE.cache[id]; if (!p) return; delete PIPE.cache[id];
  p.then(A => { if (!A) return; for (const I of PIPE.inst.slice()) if (I.A === A) I.dispose(); for (const k in A.lods) for (const m of A.lods[k]) m.geometry.dispose(); });
}
// posa nel villaggio della demo (punto libero verificato: niente sovrapposizioni con muri e oggetti esistenti)
const PIPE_SPOTS = { normandy_house_01: null };
function pipeVillage() {
  if (!PIPE.cache.normandy_house_01) return;
  PIPE.cache.normandy_house_01.then(A => {
    if (!A || !AAA.on) return; const s = PIPE_SPOTS.normandy_house_01 || pipeFindSpot(A); if (!s) { console.warn('pipeline: nessun punto libero per', A.id); return; }
    PIPE.baseY = s.y; const I = pipePlace(A, s.x, s.y, s.z, s.q); AAA.pipeHouse = I; AAA.st.pipe = { id: A.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1) };
    if (PIPE.mats.glass && AAA.cube) { PIPE.mats.glass.envMap = AAA.cube; PIPE.mats.glass.needsUpdate = true; }
    if (typeof aaaIvy === 'function') for (const e of A.man.edera) { const q = s.q % 4, D = A.man.parametri.depth; if (q === 0) aaaIvy({ axis: 'x', fixed: s.z + D / 2, out: 1 }, s.x + e.a0, s.x + e.a1, s.y + e.top, s.y, 211, .9); }
    if (typeof AAA.shadowDirty === 'number') AAA.shadowDirty = 3;
  });
}
// ricerca deterministica: griglia attorno al villaggio, ingombro + 2 m libero da solidi, pendenza entro 0.5 m
function pipeFindSpot(A) {
  const W = A.man.parametri.width + 1.4, D = A.man.parametri.depth + 2.2, cands = [[AV.cx + 4.7, AV.cz - 17.4]];   // punto storico della casa (prima scelta)
  for (let r = 18; r <= 90; r += 4) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; cands.push([AV.cx + Math.cos(a) * r, AV.cz + Math.sin(a) * r]); }
  for (const [x, z] of cands) {
    const hs = []; for (const [u, v] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5], [0, 0], [0, -.5], [0, .5]]) hs.push(aaaH(x + u * W, z + v * D));
    const hi = Math.max(...hs), lo = Math.min(...hs); if (hi - lo > .5) continue;
    const x0 = x - W / 2 - 2, x1 = x + W / 2 + 2, z0 = z - D / 2 - 2, z1 = z + D / 2 + 3.5;
    if (solids.some(s => s.on !== false && s.max.x > x0 && s.min.x < x1 && s.max.z > z0 && s.min.z < z1 && s.max.y > lo - .5)) continue;
    if ((AAA.plants || []).some(([px, pz, pr]) => px + pr > x0 && px - pr < x1 && pz + pr > z0 && pz - pr < z1)) continue;
    if (AAA.objs && AAA.objs.some(o => o.position && o.position.x > x0 && o.position.x < x1 && o.position.z > z0 && o.position.z < z1)) continue;
    return { x, z, y: hi - .12, q: 0 };
  }
  return null;
}
