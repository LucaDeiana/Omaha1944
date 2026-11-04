"use strict";
// ============================================================
//  Armi in alta qualità dalla pipeline Blender (tools/asset-pipeline/scripts/build_weapon.py).
//  Un GLB per arma con tre modelli: FP (prima persona, parti mobili separate), TP (soldati), WD (armi a terra),
//  più i punti di riferimento esportati da Blender (volata, finestra di espulsione, diottra, mirino, impugnature).
//  Si carica in background all'avvio: finché non è pronto, o se manca, il gioco usa i modelli procedurali di
//  src/guns.js. Cambia SOLO l'aspetto: danni, balistica, munizioni e tempi restano quelli di config.js.
// ============================================================
const WGLB = { map: { garand: 'm1garand' }, data: {}, loading: {}, clipFx: null, inspectT: 0, lastShots: -1, cyc: 0 };
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
    src.glb = null; D.ms = Math.round(performance.now() - t0); WGLB.data[id] = D;
    // la vista in prima persona già costruita con il modello procedurale viene ricostruita col nuovo
    if (typeof vmCache !== 'undefined' && vmCache[id]) { const old = vmCache[id]; old.group.parent && old.group.parent.remove(old.group); delete vmCache[id]; if (vmCurId === id) { vmCur = null; vmCurId = null; } }
    return D;
  })().catch(e => { console.warn('arma HQ non caricata', id, e); return null; }));
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
    ads: new V3(-rs.x, -rs.y, -WGLB_EYE - rs.z),
    hip: new V3(.13, -.15, -.29),
    magOut: new V3(.0, .17, .02),
  };
  if (kind === 'FP' && parts.clip) { const w = new THREE.Group(); w.position.copy(parts.clip.position); parts.clip.position.set(0, 0, 0); w.add(parts.clip); g.add(w); i.mag = w; }
  if (parts.bolt) i.boltBase = parts.bolt.position.clone();
  if (parts.oprod) i.opBase = parts.oprod.position.clone();
  return i;
}
// animazioni meccaniche del Garand: ciclo otturatore/asta a ogni colpo, otturatore aperto a clip vuota,
// rilascio dell'otturatore a fine ricarica, grilletto, espulsione della clip vuota (pool di un solo oggetto)
const _wgT = new V3();
function wglbAnimate(dt) {
  if (typeof vmCur === 'undefined' || !vmCur || !vmCur.hq) return;
  const s = P.slot(); if (!s) return;
  const parts = vmCur.parts, stroke = .07;
  if (WGLB.lastShots < 0) WGLB.lastShots = STATS.shots;
  else if (STATS.shots !== WGLB.lastShots) { if (s.id === vmCur.mech) WGLB.cyc = 1; WGLB.lastShots = STATS.shots; }
  let back = 0;
  if (WGLB.cyc > 0) { WGLB.cyc = Math.max(0, WGLB.cyc - dt / .085); const t = 1 - WGLB.cyc; back = t < .45 ? Math.sin(t / .45 * PI / 2) : Math.cos((t - .45) / .55 * PI / 2); }
  if (s.mag === 0 && P.reloadT <= 0) back = 1;                                  // otturatore bloccato in apertura
  if (P.reloadT > 0) { const t = 1 - P.reloadT / P.reloadDur; back = t < .78 ? 1 : 1 - clamp((t - .78) / .05, 0, 1); }   // rilascio con la clip inserita
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
