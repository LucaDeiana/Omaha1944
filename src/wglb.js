"use strict";
// ============================================================
//  Armi in alta qualità dalla pipeline Blender (tools/asset-pipeline/scripts/build_weapon.py).
//  Un GLB per arma con tre modelli: FP (prima persona, parti mobili separate), TP (soldati), WD (armi a terra),
//  più i punti di riferimento esportati da Blender (volata, finestra di espulsione, diottra, mirino, impugnature).
//  Si carica in background all'avvio: finché non è pronto, o se manca, il gioco usa i modelli procedurali di
//  src/guns.js. Cambia SOLO l'aspetto: danni, balistica, munizioni e tempi restano quelli di config.js.
// ============================================================
const WGLB = { map: { garand: 'm1garand', thompson: 'thompson', mp40: 'mp40', kar98: 'kar98k', bar: 'bar', springfield: 'springfield', colt: 'colt', bazooka: 'bazooka', kar98zf: 'kar98zf', enfield: 'enfield', mosin: 'mosin', g43: 'g43', svt40: 'svt40', arms: 'fp_arms' },
  // meccanica visibile: 'garand' (asta e otturatore, clip en-bloc), 'openbolt' (mitra a otturatore aperto), 'boltaction' (otturatore girevole)
  mech: { garand: { type: 'garand', stroke: .07, eye: .11 }, thompson: { type: 'openbolt', stroke: .08, eye: .09 }, mp40: { type: 'openbolt', stroke: .075, eye: .1 }, kar98: { type: 'boltaction', eye: .38 },
    bar: { type: 'openbolt', stroke: .07, eye: .14 }, springfield: { type: 'boltaction', eye: .09 }, kar98zf: { type: 'boltaction', eye: .09 }, enfield: { type: 'boltaction', eye: .09 }, mosin: { type: 'boltaction', eye: .09 },
    g43: { type: 'semi', stroke: .06, eye: .09 }, svt40: { type: 'semi', stroke: .06, eye: .09 }, colt: { type: 'pistol', eye: .38 }, bazooka: { type: 'rocket', eye: .12 } },
  data: {}, loading: {}, clipFx: null, inspectT: 0, lastShots: -1, cyc: 0 };
const WGLB_EYE = .11;     // distanza dell'occhio dalla diottra in mira (appoggio della guancia)
function wglbScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('non trovato: ' + src)); document.head.appendChild(s); }); }
function wglbLoad(id) {
  const gid = WGLB.map[id]; if (!gid) return Promise.resolve(null);
  if (WGLB.loading[id]) return WGLB.loading[id];
  return (WGLB.loading[id] = (async () => {
    const t0 = performance.now();
    if (!(window.WPN_GLB && window.WPN_GLB[gid])) await wglbScript('assets/weapons/' + gid + '.js');
    if (!THREE.GLTFLoader) await wglbScript('assets/lib/three/examples/js/GLTFLoader.js');
    const src = window.WPN_GLB[gid], bin = Uint8Array.from(atob(src.glb), c => c.charCodeAt(0));
    const g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin.buffer, '', res, rej));
    const D = { id, gid, man: src.manifest, scene: g.scene, kb: Math.round(src.glb.length * .75 / 1024), ms: 0, mats: new Set(), tex: new Set() };
    g.scene.traverse(o => {
      if (!o.isMesh) return; const m = o.material; D.mats.add(m);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) { D.tex.add(m[k]); m[k].anisotropy = renderer.capabilities.getMaxAnisotropy(); }
      if (/wood/.test(m.name)) m.userData.tint = 0x6b4423; else if (/brass|copper/.test(m.name)) m.userData.tint = 0xb08a3a; else m.userData.tint = 0x3a3d3a;
      if (m.normalMap) m.normalScale.set(.8, .8);
      m.envMapIntensity = .9;
    });
    if (src.bake) await wglbBake(D, src.bake);
    src.glb = null; src.bake = null; D.ms = Math.round(performance.now() - t0); WGLB.data[id] = D;
    // la vista in prima persona già costruita con il modello procedurale viene ricostruita col nuovo
    if (id === 'arms' && typeof vmCache !== 'undefined') for (const k in vmCache) if (vmCache[k].hq) { const o = vmCache[k]; o.group.parent && o.group.parent.remove(o.group); delete vmCache[k]; if (vmCurId === k) { vmCur = null; vmCurId = null; } }
    if (typeof vmCache !== 'undefined' && vmCache[id]) { const old = vmCache[id]; old.group.parent && old.group.parent.remove(old.group); delete vmCache[id]; if (vmCurId === id) { vmCur = null; vmCurId = null; } }
    return D;
  })().catch(e => { console.warn('arma HQ non caricata', id, e); return null; }));
}
// occlusione (R) e spigoli consumati (G) cotti in Blender sul modello in prima persona (secondo set di UV):
// gli incavi si scuriscono anche alla luce diretta, gli spigoli dell'acciaio si schiariscono e diventano più lisci,
// quelli del legno si consumano. Solo il modello FP: soldati e armi a terra restano leggeri.
async function wglbBake(D, uri) {
  const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = uri; }); if (!im) return;
  const t = new THREE.Texture(im); t.flipY = false; t.needsUpdate = true; t.anisotropy = 4; D.tex.add(t); D.bake = t;
  const fp = D.scene.getObjectByName('FP'), cache = new Map();
  fp.traverse(o => {
    if (!o.isMesh || !o.geometry.attributes.uv2) return;
    let m = cache.get(o.material.uuid);
    if (!m) {
      m = o.material.clone(); m.aoMap = t; m.aoMapIntensity = 1;
      const steel = /steel/.test(m.name), wood = /wood|bakelite/.test(m.name);
      const ek = steel ? .32 : wood ? .25 : .1, ec = steel ? new THREE.Color(.62, .62, .6) : new THREE.Color(.75, .55, .38), er = steel ? .32 : .5;
      m.onBeforeCompile = sh => {
        sh.uniforms.uEK = { value: ek }; sh.uniforms.uEC = { value: ec }; sh.uniforms.uER = { value: er };
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEK,uER;uniform vec3 uEC;')
          .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_AOMAP\nvec4 wBk = texture2D(aoMap, vUv2); float wEdge = smoothstep(.45, .98, wBk.g) * uEK;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uEC * (.8 + diffuseColor.rgb), wEdge) * mix(.45, 1., wBk.r);\n#endif')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef USE_AOMAP\nroughnessFactor = mix(roughnessFactor, uER, wEdge);\n#endif');
      };
      m.name = o.material.name; m.userData = Object.assign({}, o.material.userData); cache.set(o.material.uuid, m); D.mats.add(m);
    }
    o.material = m;
  });
}
// mani e avambracci dalla pipeline (fp_arms): sostituiscono capsule e cilindri del modello procedurale
function wglbArms(i, A, B) {
  const D = WGLB.data.arms; if (!D) return false;
  const src = n => D.scene.getObjectByName('FP_' + n);
  const hr = src('hand_r').clone(true); hr.position.copy(i.grip); i.group.add(hr);
  const arm = (a, b) => { const m = src('arm').clone(true), dv = new V3().subVectors(b, a); m.position.copy(a).addScaledVector(dv, .5); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), dv.clone().normalize()); m.scale.set(1, dv.length(), 1); return m; };
  i.group.add(arm(A, B));
  i.lhand = new THREE.Group(); i.group.add(i.lhand); i.lbase = i.fore.clone(); i.lhand.position.copy(i.fore);
  const hl = src('hand_l').clone(true); hl.position.set(0, 0, 0); i.lhand.add(hl);
  i.larm = src('arm').clone(true); i.group.add(i.larm);
  i.arms = 'fp_arms';
  return true;
}
function wglbPreload() { if (!SETTINGS || SETTINGS.hqGuns !== false) for (const id in WGLB.map) wglbLoad(id); }
const _wv = (a) => new V3(a[0], a[1], a[2]);
// modello per un uso: 'FP' (prima persona), 'TP' (soldati), 'WD' (a terra). null = non pronto: si usa il procedurale
function wglbGun(id, kind) {
  const D = WGLB.data[id]; if (!D) return null;
  const src = D.scene.getObjectByName(kind); if (!src) return null;
  const g = new THREE.Group(), P0 = D.man.punti, parts = {};
  for (const ch of src.children) {
    if (/^PT_/.test(ch.name)) continue;
    const c = ch.clone(true);     // mesh condivise (geometrie e materiali), solo i nodi sono nuovi
    g.add(c); const k = ch.name.replace(/^(FP|TP|WD)_/, ''); parts[k] = c;
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const rs = _wv(P0.rear_sight);
  const i = {
    group: g, hq: D.gid, parts, mech: id,
    muzzle: _wv(P0.muzzle), port: _wv(P0.port), grip: _wv(P0.grip_r), fore: _wv(P0.grip_l), charge: _wv(P0.charge),
    rear: rs, front: _wv(P0.front_sight),
    // ADS dai punti dell'arma: la linea diottra–mirino passa per il centro dello schermo, occhio a WGLB_EYE dalla diottra
    ads: new V3(-rs.x, -rs.y, -((WGLB.mech[id] || {}).eye || WGLB_EYE) - rs.z),
    hip: new V3(.13, -.15, -.29),
    magOut: new V3(.0, .17, .02),
  };
  const mc = WGLB.mech[id] || {};
  if (mc.type === 'openbolt') { i.hip = new V3(.12, -.13, -.27); i.magOut = new V3(0, -.25, .05); }
  if (mc.type === 'boltaction') i.magOut = new V3(0, .2, 0);
  if (mc.type === 'semi') i.magOut = new V3(0, -.25, .03);
  if (mc.type === 'pistol') { i.hip = new V3(.13, -.14, -.32); i.magOut = new V3(0, -.2, 0); }
  if (mc.type === 'rocket') { i.hip = new V3(.2, -.13, -.25); i.magOut = new V3(0, 0, .55); }
  if (kind === 'FP' && mc.type === 'pistol' && parts.slide) { const w = new THREE.Group(); w.add(parts.slide); g.add(w); i.slide = w; delete parts.slide; }   // weapons.js scrive slide.position.z
  const magPart = parts.clip || parts.mag;
  if (kind === 'FP' && magPart) { const w = new THREE.Group(); w.position.copy(magPart.position); magPart.position.set(0, 0, 0); w.add(magPart); g.add(w); i.mag = w; }
  // otturatore girevole: src/weapons.js scrive bolt.position.z = .03 + corsa e bolt.rotation.z; un gruppo intermedio
  // con l'origine sull'asse dell'otturatore rende quei valori validi per il modello Blender
  if (kind === 'FP' && mc.type === 'boltaction' && parts.bolt) { const w = new THREE.Group(), pb = parts.bolt.position.clone(); w.position.set(pb.x, pb.y, .03); parts.bolt.position.set(0, 0, pb.z - .03); w.add(parts.bolt); g.add(w); i.bolt = w; delete parts.bolt; }
  if (parts.bolt) i.boltBase = parts.bolt.position.clone();
  if (parts.oprod) i.opBase = parts.oprod.position.clone();
  return i;
}
// animazioni meccaniche del Garand: ciclo otturatore/asta a ogni colpo, otturatore aperto a clip vuota,
// rilascio dell'otturatore a fine ricarica, grilletto, espulsione della clip vuota (pool di un solo oggetto)
const _wgT = new V3();
// marcatori audio della ricarica: i suoni partono quando l'animazione raggiunge il punto, non con timer fissi
const WGLB_MARK = { garand: [[.6, 'clip'], [.78, 'boltc']], openbolt: [[.3, 'out'], [.68, 'in'], [.86, 'boltc']], semi: [[.3, 'out'], [.68, 'in'], [.86, 'boltc']], boltaction: [[.06, 'bolt'], [.3, 'in'], [.45, 'in'], [.6, 'in'], [.88, 'boltc']], pistol: [[.25, 'out'], [.66, 'in'], [.85, 'boltc']], rocket: [[.62, 'in']] };
function wglbMarkers() {
  if (!(typeof xaeActive === 'function' && xaeActive())) return;
  // otturatore girevole dopo lo sparo: suoni sull'apertura e sulla chiusura dell'animazione (P.boltT)
  if (P.boltT > 0) { const b = 1 - P.boltT, b0 = WGLB.lastBT || 0; if (b0 < .12 && b >= .12) xaeMech('bolt'); if (b0 < .82 && b >= .82) xaeMech('boltc'); WGLB.lastBT = b; } else WGLB.lastBT = 0;
  if (P.reloadT <= 0) { WGLB.lastRT = 0; return; }
  const mc = WGLB.mech[vmCur.mech] || {}, t = 1 - P.reloadT / P.reloadDur, t0 = WGLB.lastRT || 0;
  for (const [m, k] of WGLB_MARK[mc.type] || []) if (t0 < m && t >= m) xaeMech(k);
  WGLB.lastRT = t;
}
function wglbAnimate(dt) {
  if (typeof vmCur === 'undefined' || !vmCur || !vmCur.hq) return;
  const s = P.slot(); if (!s) return;
  wglbMarkers();
  const parts = vmCur.parts, mc = WGLB.mech[vmCur.mech] || {}, stroke = mc.stroke || .07;
  if (mc.type === 'boltaction' || mc.type === 'pistol' || mc.type === 'rocket') { if (parts.trigger) parts.trigger.rotation.x = (P.trigger || P.flashT > 0) ? -.18 : 0; if (WGLB.inspectT > 0) WGLB.inspectT = Math.max(0, WGLB.inspectT - dt); return; }
  if (WGLB.lastShots < 0) WGLB.lastShots = STATS.shots;
  else if (STATS.shots !== WGLB.lastShots) { if (s.id === vmCur.mech) WGLB.cyc = 1; WGLB.lastShots = STATS.shots; }
  let back = 0;
  if (WGLB.cyc > 0) { WGLB.cyc = Math.max(0, WGLB.cyc - dt / .085); const t = 1 - WGLB.cyc; back = t < .45 ? Math.sin(t / .45 * PI / 2) : Math.cos((t - .45) / .55 * PI / 2); }
  if (mc.type === 'openbolt') {
    // otturatore aperto: a riposo è indietro; a ogni colpo scatta avanti e torna; in ricarica si riarma alla fine
    back = 1 - (WGLB.cyc > 0 ? Math.sin((1 - WGLB.cyc) * PI) : 0);
    if (P.reloadT > 0) { const t = 1 - P.reloadT / P.reloadDur; if (t > .82) back = 1 - Math.sin(clamp((t - .82) / .16, 0, 1) * PI) * .15; }
  } else {
    if (s.mag === 0 && P.reloadT <= 0) back = 1;                                  // otturatore bloccato in apertura
    if (P.reloadT > 0) { const t = 1 - P.reloadT / P.reloadDur; back = t < .78 ? 1 : 1 - clamp((t - .78) / .05, 0, 1); }   // rilascio con la clip inserita
  }
  if (parts.bolt) parts.bolt.position.z = vmCur.boltBase.z + back * stroke;
  if (parts.oprod) parts.oprod.position.z = vmCur.opBase.z + back * stroke;
  if (parts.trigger) parts.trigger.rotation.x = (P.trigger || P.flashT > 0) ? -.18 : 0;
  if (WGLB.inspectT > 0) WGLB.inspectT = Math.max(0, WGLB.inspectT - dt);
  wglbClipFx(dt);
}
// ispezione dell'arma (tasto J, solo a piedi e non in mira): rotazione per mostrare il fianco destro e la finestra
function wglbInspect() { if (vmCur && P.adsK < .1 && P.reloadT <= 0) WGLB.inspectT = 2.6; }
function wglbInspectPose(o) {
  const t = WGLB.inspectT; if (t <= 0) return;
  const k = Math.sin(clamp((2.6 - t) / 2.6, 0, 1) * PI), k2 = Math.sin(clamp((2.6 - t) / 2.6, 0, 1) * PI * 2);
  o.x += -.08 * k; o.y += .05 * k; o.z += .06 * k; o.ry += .9 * k; o.rz += -.7 * k + .25 * k2; o.rx += .15 * k2;
}
function wglbEjectClip() {
  const D = WGLB.data.garand; if (!D || !vmCur || !vmCur.mag) return;
  let f = WGLB.clipFx;
  if (!f) { const src = D.scene.getObjectByName('WD'), clip = D.scene.getObjectByName('FP_clip'); const m = new THREE.Group(); clip.traverse(o => { if (o.isMesh && /steel/.test(o.material.name)) m.add(new THREE.Mesh(o.geometry, o.material)); }); m.children.forEach(c => c.position.copy(clip.position).negate()); f = WGLB.clipFx = { obj: m, v: new V3(), life: 0, rot: new V3() }; scene.add(m); m.visible = false; void src; }
  vmCur.group.updateMatrixWorld(true); vmCur.mag.getWorldPosition(f.obj.position); f.obj.quaternion.copy(camera.quaternion);
  camera.getWorldDirection(_wgT); f.v.set(Math.cos(P.yaw) * .6, 4.2, -Math.sin(P.yaw) * .6).addScaledVector(_wgT, -.4); f.life = 3; f.obj.visible = true; f.rot.set(rnd(-9, 9), rnd(-6, 6), rnd(-9, 9));
}
function wglbClipFx(dt) {
  const f = WGLB.clipFx; if (!f || f.life <= 0) return;
  f.life -= dt; f.v.y -= 9.8 * dt; f.obj.position.addScaledVector(f.v, dt); f.obj.rotation.x += f.rot.x * dt; f.obj.rotation.y += f.rot.y * dt; f.obj.rotation.z += f.rot.z * dt;
  const g = Hf(f.obj.position.x, f.obj.position.z) + .01; if (f.obj.position.y < g) { f.obj.position.y = g; f.v.multiplyScalar(.3); f.v.y = Math.abs(f.v.y) * .3; f.rot.multiplyScalar(.3); }
  if (f.life <= 0) f.obj.visible = false;
}
addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.ctrlKey && !e.shiftKey && typeof GAME !== 'undefined' && GAME.running && P.mode === 'foot') wglbInspect(); });
