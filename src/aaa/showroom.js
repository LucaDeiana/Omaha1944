"use strict";
// ============================================================
//  AAA Graphics Test — 3D ASSET SHOWROOM (F10 o dal pannello F9).
//  Scena separata con l'asset isolato su un piano neutro: camera orbitale (trascina = ruota, rotella = zoom,
//  tasto destro = sposta), luci predefinite, wireframe, ingombro, collisioni, scelta del LOD, statistiche
//  (triangoli, draw call, materiali, texture, dimensioni del file, tempo di caricamento), foto PNG.
//  Mentre è aperto il soldato non riceve input; alla chiusura la demo riprende com'era.
// ============================================================
const ASR = { on: false, scene: null, cam: null, root: null, A: null, sel: null, lod: 'auto', wire: false, bbox: false, cols: false, light: 'mattino', yaw: .7, pitch: .32, dist: 22, tgt: new THREE.Vector3(0, 3, 0), drag: 0, auto: false, helpers: [] };
const SR_LIGHTS = {
  mattino: { sun: [.6, .55, .7], col: 0xfff1dc, int: 1.5, hemi: [0xbcd3ec, 0x5d5446, .55], bg: 0x9fb4c8 },
  mezzogiorno: { sun: [.15, 1, .25], col: 0xffffff, int: 1.7, hemi: [0xd6e6f5, 0x6b604e, .6], bg: 0xa9c3dc },
  tramonto: { sun: [-.9, .22, .35], col: 0xffb27a, int: 1.4, hemi: [0x8a8fb0, 0x4a3a2e, .45], bg: 0x8f7f86 },
  coperto: { sun: [.3, 1, .4], col: 0xdfe6ee, int: .4, hemi: [0xc8d0d8, 0x6a665e, .95], bg: 0xa3a8ad },
  controluce: { sun: [-.4, .5, -.9], col: 0xfff0d8, int: 1.6, hemi: [0xa9bdd3, 0x564c40, .5], bg: 0x9db0c4 },
};
function srList() {
  const out = PIPE_IDS.map(id => ({ id, nome: id + ' (pipeline)', kind: 'pipe' }));
  if (typeof AAA_M !== 'undefined') for (const k in AAA_M) out.push({ id: k, nome: k + ' (Poly Haven)', kind: 'ph' });
  return out;
}
function srInit() {
  if (ASR.scene) return;
  const S = ASR.scene = new THREE.Scene();
  ASR.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .05, 600);
  ASR.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); S.add(ASR.hemi);
  ASR.sun = new THREE.DirectionalLight(0xffffff, 2.5); ASR.sun.castShadow = true; ASR.sun.shadow.mapSize.set(2048, 2048); ASR.sun.shadow.bias = -.0004; ASR.sun.shadow.normalBias = .02;
  S.add(ASR.sun); S.add(ASR.sun.target);
  const g = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a4740, roughness: 1 }));
  g.receiveShadow = true; S.add(g); ASR.ground = g;
  const grid = new THREE.GridHelper(40, 40, 0x555555, 0x666666); grid.position.y = .002; grid.material.transparent = true; grid.material.opacity = .25; S.add(grid);
  ASR.root = new THREE.Group(); S.add(ASR.root);
  if (AAA.cube) S.environment = AAA.cube;
}
function srLight(k) {
  const L = SR_LIGHTS[k] || SR_LIGHTS.mattino; ASR.light = k;
  ASR.sun.color.setHex(L.col); ASR.sun.intensity = L.int; ASR.hemi.color.setHex(L.hemi[0]); ASR.hemi.groundColor.setHex(L.hemi[1]); ASR.hemi.intensity = L.hemi[2];
  ASR.scene.background = new THREE.Color(L.bg);
  const r = Math.max(8, ASR.size || 10); ASR.sun.position.set(L.sun[0], L.sun[1], L.sun[2]).normalize().multiplyScalar(r * 2.2).add(ASR.tgt); ASR.sun.target.position.copy(ASR.tgt);
  const c = ASR.sun.shadow.camera; c.left = c.bottom = -r * 1.1; c.right = c.top = r * 1.1; c.near = .5; c.far = r * 5; c.updateProjectionMatrix();
}
async function srShow(id) {
  srInit(); ASR.sel = id; srClear();
  const it = srList().find(a => a.id === id); if (!it) return;
  let obj, info;
  if (it.kind === 'pipe') {
    const A = await pipeLoad(id); if (!A) { srUi('Asset non caricato: vedi la console.'); return; }
    ASR.A = A; obj = new THREE.LOD(); const D = A.man.distanzeLod[AAA.preset] || A.man.distanzeLod.HIGH;
    ['LOD0', 'LOD1', 'LOD2'].forEach((k, i) => { const g = new THREE.Group(); g.name = k; for (const m of A.lods[k] || []) { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = m.castShadow; c.receiveShadow = true; g.add(c); } obj.addLevel(g, [0, D[0], D[1]][i]); });
    info = A.st;
  } else {
    ASR.A = null; obj = AAA_M[id].clone(true); obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  }
  ASR.obj = obj; ASR.root.add(obj); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj.isLOD ? obj.levels[0].object : obj), size = box.getSize(new THREE.Vector3());
  ASR.box = box; ASR.size = Math.max(size.x, size.y, size.z); ASR.tgt.set((box.min.x + box.max.x) / 2, size.y * .42, (box.min.z + box.max.z) / 2); ASR.dist = ASR.size * 1.9 + 1;
  srLight(ASR.light); srApply(); srUi();
}
function srClear() { for (const h of ASR.helpers) { ASR.scene.remove(h); h.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } ASR.helpers = []; if (ASR.obj) { ASR.root.remove(ASR.obj); ASR.obj = null; } }
function srApply() {
  for (const h of ASR.helpers) { ASR.scene.remove(h); h.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } ASR.helpers = [];
  const O = ASR.obj; if (!O) return;
  if (O.isLOD) { O.autoUpdate = ASR.lod === 'auto'; if (ASR.lod !== 'auto') O.levels.forEach((l, i) => { l.object.visible = 'LOD' + i === ASR.lod; }); }
  ASR.scene.overrideMaterial = ASR.wire ? (ASR.wireMat || (ASR.wireMat = new THREE.MeshBasicMaterial({ color: 0x1b1d1f, wireframe: true }))) : null;
  if (ASR.bbox && ASR.box) { const h = new THREE.Box3Helper(ASR.box, 0xffcc33); ASR.scene.add(h); ASR.helpers.push(h); }
  if (ASR.cols && ASR.A) {
    const g = new THREE.Group(), mw = new THREE.LineBasicMaterial({ color: 0xff3355 }), mk = new THREE.LineBasicMaterial({ color: 0x33ddff });
    for (const c of ASR.A.man.collisioni) { const b = new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max)); const h = new THREE.Box3Helper(b); h.material = c.walk ? mk : mw; g.add(h); }
    ASR.scene.add(g); ASR.helpers.push(g);
  }
}
function srCamera() {
  const c = ASR.cam, d = ASR.dist, p = ASR.pitch, y = ASR.yaw;
  c.position.set(ASR.tgt.x + Math.sin(y) * Math.cos(p) * d, ASR.tgt.y + Math.sin(p) * d, ASR.tgt.z + Math.cos(y) * Math.cos(p) * d);
  c.lookAt(ASR.tgt); c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
}
// chiamata da renderFrame al posto della scena della demo
function srRender() {
  if (ASR.auto) ASR.yaw += .004;
  srCamera(); renderer.info.reset(); ASR.sun.shadow.needsUpdate = true;
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.ACESFilmicToneMapping;   // la scena della demo fa il tone mapping nel post-processing: qui lo fa il renderer
  renderer.render(ASR.scene, ASR.cam); renderer.toneMapping = tm;
  if (ASR.obj && ASR.obj.isLOD && ASR.lod === 'auto') { const i = ASR.obj.getCurrentLevel(); if (i !== ASR.curLod) { ASR.curLod = i; srUi(); } }
  const now = performance.now(); if (now - (ASR.lastInfo || 0) > 500) { ASR.lastInfo = now; ASR.info = { calls: renderer.info.render.calls, tri: renderer.info.render.triangles }; const e = $('srLive'); if (e) e.textContent = `In vista: ${ASR.info.calls} draw call · ${ASR.info.tri.toLocaleString('it')} triangoli · distanza ${ASR.dist.toFixed(1)} m`; }
}
function srOpen(on) {
  srInit(); ASR.on = on; AAA.showroom = on;
  let el = $('srPanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'srPanel'; el.style.cssText = 'position:fixed;right:12px;top:12px;width:min(340px,92vw);max-height:calc(100vh - 24px);overflow:auto;z-index:73;background:rgba(10,11,10,.9);color:#e8e6dc;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #555';
    document.body.appendChild(el); el.addEventListener('click', srClick); el.addEventListener('change', srClick);
  }
  el.style.display = on ? 'block' : 'none';
  if (on) {
    if (typeof labFreeInput === 'function') labFreeInput(); if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => { GAME.running = true; if ($('pause')) $('pause').classList.add('hidden'); }, 60);
    if (!ASR.sel) srShow(PIPE_IDS[0]); else srUi();
  } else if (!LAB.panel && !LAB.run) lockPointer();
}
function srUi(msg) {
  const el = $('srPanel'); if (!el || !ASR.on) return;
  const B = (a, t, on) => `<button data-a="${a}" style="margin:2px 3px 2px 0;padding:3px 7px;background:${on ? '#5a4a22' : '#2a2c2a'};color:#eee;border:1px solid #666;cursor:pointer">${t}</button>`;
  const S = 'margin:9px 0 3px;font:600 11px system-ui;letter-spacing:.12em;color:#c8b070';
  const A = ASR.A, st = A && A.st;
  let h = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="letter-spacing:.08em">3D ASSET SHOWROOM</b>${B('close', 'Chiudi (F10)')}</div>
  <div style="${S}">ASSET</div><select data-a="sel" style="width:100%;background:#222;color:#eee;border:1px solid #666">${srList().map(a => `<option value="${a.id}"${a.id === ASR.sel ? ' selected' : ''}>${a.nome}</option>`).join('')}</select>
  <div style="${S}">VISTA</div>${B('wire', 'Wireframe', ASR.wire)}${B('bbox', 'Ingombro', ASR.bbox)}${A ? B('cols', 'Collisioni', ASR.cols) : ''}${B('auto', 'Giro automatico', ASR.auto)}${B('shot', 'Foto PNG')}
  <div style="${S}">LUCE</div>${Object.keys(SR_LIGHTS).map(k => B('L:' + k, k, ASR.light === k)).join('')}`;
  if (A) h += `<div style="${S}">LIVELLO DI DETTAGLIO</div>${['auto', 'LOD0', 'LOD1', 'LOD2'].map(k => B('lod:' + k, k === 'auto' ? `auto (${'LOD' + (ASR.curLod ?? 0)})` : k, ASR.lod === k)).join('')}
    <div style="opacity:.75">Distanze per ${AAA.preset}: LOD1 da ${A.man.distanzeLod[AAA.preset][0]} m, LOD2 da ${A.man.distanzeLod[AAA.preset][1]} m</div>
    <div style="${S}">STATISTICHE</div><table style="width:100%;border-collapse:collapse">${['LOD0', 'LOD1', 'LOD2'].map(k => `<tr><td>${k}</td><td style="text-align:right">${Math.round(st.triangoli[k] || 0).toLocaleString('it')} tri</td><td style="text-align:right">${st.drawCall[k] || 0} draw call</td></tr>`).join('')}</table>
    <div>File ${st.kb.toLocaleString('it')} KB · caricamento ${st.caricamentoMs} ms · ${st.materiali.length} materiali · texture condivise con la demo (nessuna incorporata)</div>
    <div>Dimensioni ${A.man.dimensioni.larghezza} × ${A.man.dimensioni.profondita} m, colmo ${A.man.dimensioni.colmo} m · ${A.man.collisioni.length} collisioni (rosse: muri; azzurre: calpestabili)</div>
    <div style="${S}">MATERIALI</div><div style="columns:2;font-size:11px">${st.materiali.map(m => `<div title="${(PIPE_MATS[m] || [])[0] || 'procedurale'}">${m} <span style="opacity:.6">${(PIPE_MATS[m] || [])[0] || 'proc.'}</span></div>`).join('')}</div>`;
  else if (ASR.obj) { let tri = 0, mats = new Set(); ASR.obj.traverse(o => { if (o.isMesh) { tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; mats.add(o.material.name || o.material.uuid); } }); h += `<div style="${S}">STATISTICHE</div><div>${Math.round(tri).toLocaleString('it')} triangoli · ${mats.size} materiali · un solo LOD</div>`; }
  h += `<div id="srLive" style="margin-top:8px;opacity:.8"></div><div style="margin-top:6px;opacity:.6">Trascina: ruota · rotella: zoom · tasto destro: sposta</div>${msg ? `<div style="margin-top:6px;color:#e8c860">${msg}</div>` : ''}`;
  el.innerHTML = h;
}
function srClick(e) {
  const t = e.target; if (!t.dataset || !t.dataset.a) return; const a = t.dataset.a;
  if (e.type === 'change' && a === 'sel') { srShow(t.value); return; } if (e.type !== 'click' || a === 'sel') return;
  if (a === 'close') return srOpen(false);
  if (a === 'wire') ASR.wire = !ASR.wire; else if (a === 'bbox') ASR.bbox = !ASR.bbox; else if (a === 'cols') ASR.cols = !ASR.cols; else if (a === 'auto') ASR.auto = !ASR.auto;
  else if (a.startsWith('L:')) srLight(a.slice(2)); else if (a.startsWith('lod:')) ASR.lod = a.slice(4);
  else if (a === 'shot') { srRender(); const u = renderer.domElement.toDataURL('image/png'); const l = document.createElement('a'); l.download = `showroom_${ASR.sel}_${ASR.light}.png`; l.href = u; l.click(); }
  srApply(); srUi();
}
// camera orbitale: eventi del mouse sulla scena (il pannello e il gioco non li ricevono)
addEventListener('mousedown', e => { if (!ASR.on || (e.target.closest && e.target.closest('#srPanel,#labPanel'))) return; ASR.drag = e.button === 2 ? 2 : 1; ASR.mx = e.clientX; ASR.my = e.clientY; e.preventDefault(); e.stopImmediatePropagation(); }, true);
addEventListener('mousemove', e => {
  if (!ASR.on || !ASR.drag) return; const dx = e.clientX - ASR.mx, dy = e.clientY - ASR.my; ASR.mx = e.clientX; ASR.my = e.clientY;
  if (ASR.drag === 1) { ASR.yaw -= dx * .006; ASR.pitch = Math.max(-.15, Math.min(1.45, ASR.pitch + dy * .005)); }
  else { const r = new THREE.Vector3().setFromMatrixColumn(ASR.cam.matrix, 0), u = new THREE.Vector3().setFromMatrixColumn(ASR.cam.matrix, 1), k = ASR.dist * .0016; ASR.tgt.addScaledVector(r, -dx * k).addScaledVector(u, dy * k); }
  e.stopImmediatePropagation();
}, true);
addEventListener('mouseup', e => { if (ASR.on && ASR.drag) { ASR.drag = 0; e.stopImmediatePropagation(); } }, true);
addEventListener('wheel', e => { if (!ASR.on || (e.target.closest && e.target.closest('#srPanel,#labPanel'))) return; ASR.dist = Math.max(.6, Math.min(250, ASR.dist * (1 + Math.sign(e.deltaY) * .12))); e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, passive: false });
addEventListener('contextmenu', e => { if (ASR.on) e.preventDefault(); }, true);
addEventListener('keydown', e => {
  if (typeof SCEN === 'undefined' || SCEN !== 'aaa' || typeof GAME === 'undefined' || !GAME.started) return;
  if (e.code === 'F10') { e.preventDefault(); e.stopImmediatePropagation(); srOpen(!ASR.on); }
  else if (ASR.on && e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); srOpen(false); }
  else if (ASR.on) e.stopImmediatePropagation();
}, true);
