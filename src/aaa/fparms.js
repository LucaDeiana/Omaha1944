"use strict";
// ============================================================
//  FIRST-PERSON ARMS & HANDS (solo tech demo «AAA Graphics Test»).
//  Braccia con scheletro da Blender (assets/aaa/arms/fp_arms_rig.js: 2 × 22 ossa, skinning automatico) guidate da:
//   - IK a due ossa (spalla fissa nello spazio della camera, polso sul punto di presa dell'arma, gomito con vettore
//     guida): le mani seguono l'arma, quindi oscillazione, rinculo, scatto e cambio arma NON vengono applicati due volte;
//   - impugnature per arma (FPA_GRIPS): posizione e orientamento del polso nello spazio dell'arma, flessione delle dita
//     calcolata dallo spessore dell'impugnatura, dito sul grilletto;
//   - pose delle dita con tempi sfalsati (mai tutte insieme come un blocco).
//  Animazioni: PROCEDURALI guidate da dati (nessuna clip scheletrica di Blender): dichiarato nel pannello.
// ============================================================
const FPA = { ready: false, loading: null, rig: null, sides: {}, on: true, calib: {}, t: 0, stats: { ms: 0 } };
// spalle nello spazio della camera (m): fuori dall'inquadratura, come in un vero corpo
const FPA_SHOULDER = { R: new V3(.18, -.25, .08), L: new V3(-.15, -.24, -.04) };   // sinistra avanti: spalla portata verso l'arma
const FPA_SCALE = 1.08;   // braccia leggermente più lunghe: esagerazione abituale delle viste in prima persona
// archetipi di impugnatura (spazio dell'arma: -Z avanti, +Y alto, +X destra). w = offset del polso dal punto di presa;
// f = direzione delle dita; b = direzione del dorso; r = raggio dell'impugnatura (flessione delle dita); trig = indice sul grilletto
const FPA_ARCH = {
  rifle: { R: { w: [.034, .028, .072], f: [-.3, -.85, -.42], b: [.95, .1, .15], r: .018, trig: true }, L: { w: [-.045, -.004, .022], f: [.85, .25, -.45], b: [-.15, -.98, .1], r: .021 } },
  smg: { R: { w: [.03, .03, .055], f: [-.35, -.88, -.3], b: [.93, .15, -.3], r: .016, trig: true }, L: { w: [-.045, -.004, .02], f: [.85, .25, -.45], b: [-.15, -.98, .1], r: .02 } },
  pistol: { R: { w: [.026, .03, .05], f: [-.45, -.85, -.25], b: [.88, .2, -.3], r: .014, trig: true }, L: { w: [-.035, -.035, .04], f: [.5, -.3, -.8], b: [-.5, -.75, .3], r: .02 } },
  tube: { R: { w: [.03, .03, .05], f: [-.45, -.85, -.25], b: [.88, .2, -.3], r: .016, trig: true }, L: { w: [-.03, -.05, .045], f: [.3, -.85, -.4], b: [-.9, .1, .3], r: .016 } },
};
const FPA_KIND = { garand: 'rifle', kar98: 'rifle', springfield: 'rifle', kar98zf: 'rifle', enfield: 'rifle', mosin: 'rifle', g43: 'rifle', svt40: 'rifle', thompson: 'smg', mp40: 'smg', bar: 'smg', colt: 'pistol', bazooka: 'tube' };
const FPA_FINGERS = ['index', 'middle', 'ring', 'pinky'];

function fpaLoad() {
  if (FPA.loading) return FPA.loading;
  return (FPA.loading = (async () => {
    if (!window.FPA_GLB) await (typeof wglbScript === 'function' ? wglbScript : aaaLoadScript)('assets/aaa/arms/fp_arms_rig.js');
    if (!THREE.GLTFLoader) await aaaLoadScript('assets/lib/three/examples/js/GLTFLoader.js');
    const bin = Uint8Array.from(atob(FPA_GLB.glb), c => c.charCodeAt(0));
    const g = await new Promise((res, rej) => new THREE.GLTFLoader().parse(bin.buffer, '', res, rej));
    FPA.rig = g.scene; FPA.rig.name = 'fpa_rig';
    for (const s of ['R', 'L']) {
      const root = FPA.rig.getObjectByName('FPA_' + s), B = {};
      // il caricatore glTF rende unici i nomi duplicati tra le due armature (es. «index_1_1»): si risale al nome dell'osso
      const NAMES = new Set(['upperarm', 'forearm', 'hand', 'thumb_0', 'thumb_1', 'thumb_2', ...FPA_FINGERS.flatMap(f => [0, 1, 2, 3].map(k => f + '_' + k))]);
      root.traverse(o => { if (!o.isBone) return; let n = o.name; if (!NAMES.has(n)) n = n.replace(/_\d+$/, ''); if (NAMES.has(n) && !B[n]) B[n] = o; });
      // pose di riposo (quaternioni locali) e lunghezze dalle posizioni dei figli
      for (const k in B) B[k].userData.rest = B[k].quaternion.clone();
      const len = (a, b) => B[b].position.length();
      FPA.sides[s] = { root, B, la: len('upperarm', 'forearm'), lb: len('forearm', 'hand'), curl: {}, curlT: {} };
      for (const f of FPA_FINGERS.concat('thumb')) FPA.sides[s].curl[f] = 0;
    }
    FPA.rig.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = true; } });
    FPA.tris = 0; FPA.rig.traverse(o => { if (o.isMesh) FPA.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    try { FPA.calib = JSON.parse(localStorage.getItem('fpa_calib') || '{}'); } catch (e) { FPA.calib = {}; }
    FPA.ready = true; FPA.man = FPA_GLB.manifest; FPA_GLB.glb = null;
    // le viste in prima persona già costruite passano alle nuove braccia
    if (typeof vmCache !== 'undefined') for (const k in vmCache) { const o = vmCache[k]; o.group.parent && o.group.parent.remove(o.group); delete vmCache[k]; } if (typeof vmCurId !== 'undefined') { vmCur = null; vmCurId = null; }
    return true;
  })().catch(e => { console.warn('braccia FPS non caricate', e); return false; }));
}
function fpaActive() { return FPA.on && FPA.ready && typeof SCEN !== 'undefined' && SCEN === 'aaa'; }
// chiamata da buildViewmodel nella demo: nessuna mano procedurale; restano i gruppi che l'animazione di ricarica muove
function fpaAttach(i) {
  if (!fpaActive()) return false;
  i.lhand = new THREE.Group(); i.group.add(i.lhand); i.lbase = i.fore.clone(); i.lhand.position.copy(i.fore);
  i.larm = new THREE.Object3D(); i.group.add(i.larm);   // il codice originale lo orienta: qui è vuoto
  i.fpa = true; i.hip = i.hip.clone(); i.hip.z += .07;   // con braccia vere l'arma sta più vicina al corpo (la mano sinistra arriva all'astina)
  FPA.rig.scale.setScalar(FPA_SCALE);
  if (FPA.rig.parent !== vmRoot) vmRoot.add(FPA.rig);
  return true;
}
// --- matematica
const _fpaPA = new V3(), _fpaPB = new V3(), _fpaPC = new V3(), _fpaPD = new V3(), _fpaPQ = new THREE.Quaternion(), _fpaPQ2 = new THREE.Quaternion(), _fpaPM = new THREE.Matrix4(), _fpaPS = new V3();
function fpaFrame(y, zHint, out) {   // quaternione con Y lungo y e Z il più vicino possibile a zHint
  const Y = _fpaPA.copy(y).normalize(), Z = _fpaPB.copy(zHint).addScaledVector(Y, -zHint.dot(Y)).normalize(), X = _fpaPC.crossVectors(Y, Z).normalize();
  _fpaPM.makeBasis(X, Y, Z); return out.setFromRotationMatrix(_fpaPM);
}
function fpaSetWorldQuat(bone, qw) {   // locale = (rotazione del genitore nel mondo)^-1 * mondo
  bone.parent.getWorldQuaternion(_fpaPQ2); bone.quaternion.copy(_fpaPQ2.invert().multiply(qw)); bone.updateMatrixWorld(true);
}
// IK a due ossa: S spalla, T polso (mondo), P direzione guida del gomito
function fpaIK(sd, S, T, P, handQ) {
  const a = sd.la * FPA_SCALE, b = sd.lb * FPA_SCALE, d0 = _fpaPD.subVectors(T, S), dist = Math.min(d0.length(), (a + b) * .999), dir = d0.normalize().clone();
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const pl = P.clone().addScaledVector(dir, -P.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, cosA * a).addScaledVector(pl, sinA * a), W = S.clone().addScaledVector(dir, dist);
  const B = sd.B, up = pl.clone().negate();   // Z (dorso) dell'omero verso l'esterno del gomito
  fpaSetWorldQuat(B.upperarm, fpaFrame(_fpaPS.subVectors(E, S), up, new THREE.Quaternion()));
  fpaSetWorldQuat(B.forearm, fpaFrame(_fpaPS.subVectors(W, E), handQ ? new V3(0, 0, 1).applyQuaternion(handQ) : up, new THREE.Quaternion()));
  if (handQ) fpaSetWorldQuat(B.hand, handQ);
  return { E, W, reach: d0.length() };
}
// dita: flessione per falange da un raggio d'impugnatura (avvolgimento) o da un valore diretto; tempi sfalsati per dito
function fpaFingers(sd, dt, pose) {
  const rates = { index: 16, middle: 13, ring: 11, pinky: 9, thumb: 12 };
  for (const f of FPA_FINGERS.concat('thumb')) {
    const t = pose[f] ?? 0; sd.curl[f] += (t - sd.curl[f]) * Math.min(1, dt * rates[f]);
    const c = sd.curl[f], n = f === 'thumb' ? 2 : 3, B = sd.B;
    for (let k = 1; k <= n; k++) {
      const bn = B[f + '_' + k]; if (!bn) continue;
      const w = f === 'thumb' ? [0, .6, .9][k] : [0, .85, 1.1, .75][k];
      bn.quaternion.copy(bn.userData.rest).multiply(_fpaPQ.setFromAxisAngle(_fpaPA.set(1, 0, 0), -c * w));
    }
    if (f === 'thumb' && B.thumb_0) B.thumb_0.quaternion.copy(B.thumb_0.userData.rest).multiply(_fpaPQ.setFromAxisAngle(_fpaPA.set(0, 0, 1), -c * .35 * (sd === FPA.sides.R ? 1 : -1)));
  }
}
const fpaWrapCurl = r => clamp(.022 / r, .6, 1.5);   // impugnatura più sottile => dita più chiuse
function fpaGrip(id, side) {
  const A = FPA_ARCH[FPA_KIND[id] || 'rifle'][side], c = (FPA.calib[id] || {})[side] || {};
  return { w: new V3(...A.w).add(new V3(c.x || 0, c.y || 0, c.z || 0)), f: new V3(...A.f).normalize(), b: new V3(...A.b).normalize(), r: A.r, trig: A.trig, rot: c.r || 0 };
}
// aggiornamento per fotogramma (dopo updateViewmodel)
function fpaUpdate(dt) {
  if (typeof falTick === 'function') falTick(dt);
  if (!fpaActive() || typeof vmCur === 'undefined' || !vmCur || !vmCur.fpa) { if (FPA.rig) FPA.rig.visible = false; return; }
  const t0 = performance.now(); FPA.t += dt;
  const id = vmCurId, g = vmCur.group; FPA.rig.visible = g.visible; if (!g.visible) return;
  vmRoot.updateMatrixWorld(true); g.updateMatrixWorld(true); FPA.rig.updateMatrixWorld(true);
  const gunQW = g.getWorldQuaternion(new THREE.Quaternion());   // copia propria: i temporanei li riusano IK e dita
  for (const s of ['R', 'L']) {
    const sd = FPA.sides[s], G = fpaGrip(id, s);
    // spalla: la radice dell'armatura si sposta perché la testa dell'omero cada sul punto della spalla
    const Sw = vmRoot.localToWorld(FPA_SHOULDER[s].clone());
    sd.root.position.set(0, 0, 0); sd.root.updateMatrixWorld(true);
    const hw = sd.B.upperarm.getWorldPosition(new V3()); sd.root.position.add(sd.root.parent.worldToLocal(Sw.clone()).sub(sd.root.parent.worldToLocal(hw))); sd.root.updateMatrixWorld(true);
    let T, hq, pose, pole;
    const gunQ = gunQW, idle = Math.sin(FPA.t * 1.3 + (s === 'L' ? 1.7 : 0)) * .012;   // micro-aggiustamenti del polso
    const handFrame = (f, b) => fpaFrame(f.clone().applyQuaternion(gunQ), b.clone().applyQuaternion(gunQ), new THREE.Quaternion()).multiply(_fpaPQ2.setFromAxisAngle(_fpaPB.set(0, 1, 0), G.rot + idle));
    if (s === 'R') {
      T = g.localToWorld(vmCur.grip.clone().add(G.w)); hq = handFrame(G.f, G.b);
      const firing = P.trigger || P.flashT > 0, k = fpaWrapCurl(G.r);
      pose = { index: G.trig ? (firing ? .95 : .5) : k, middle: k, ring: k * 1.05, pinky: k * 1.1, thumb: .7 };
      pole = _fpaPC.set(.6, -.8, .1).applyQuaternion(camera.quaternion);
    } else {
      const vault = typeof XPC !== 'undefined' && XPC.vault, reload = P.reloadT > 0;
      if (vault) {   // la mano si stacca e va verso l'ostacolo (transizione provvisoria)
        T = vmRoot.localToWorld(new V3(-.22, -.32, -.42)); hq = fpaFrame(_fpaPA.set(0, -.3, -1).applyQuaternion(camera.quaternion), _fpaPB.set(0, 1, 0).applyQuaternion(camera.quaternion), new THREE.Quaternion());
        pose = { index: .15, middle: .15, ring: .2, pinky: .25, thumb: .1 };
      } else {
        // la posizione della mano sinistra la dà l'animazione dell'arma (i.lhand: presa, caricatore, clip, otturatore)
        T = vmCur.lhand.getWorldPosition(new V3()).add(_fpaPD.copy(G.w).applyQuaternion(gunQ)); hq = handFrame(G.f, G.b);
        const k = fpaWrapCurl(G.r);
        pose = reload ? { index: .9, middle: .8, ring: .7, pinky: .6, thumb: .9 } : { index: k * .9, middle: k, ring: k * 1.05, pinky: k * 1.1, thumb: .55 };
      }
      pole = _fpaPC.set(-.6, -.8, .1).applyQuaternion(camera.quaternion);
    }
    sd.last = fpaIK(sd, Sw, T, pole.clone(), hq);
    fpaFingers(sd, dt, pose);
  }
  // matrici dello scheletro aggiornate qui: il renderer le ricalcola solo quando cambia renderer.info.render.frame,
  // che resta fermo se un altro sistema (il Benchmark Lab) disattiva info.autoReset
  if (!FPA.skins) { FPA.skins = []; FPA.rig.traverse(o => { if (o.isSkinnedMesh && !FPA.skins.includes(o.skeleton)) FPA.skins.push(o.skeleton); }); }
  for (const sk of FPA.skins) sk.update();
  FPA.stats.ms = performance.now() - t0;
}
// calibrazione per arma (Arms Lab): offset del polso e rotazione, salvati nel browser
function fpaCalibrate(id, side, k, v) { const c = FPA.calib[id] || (FPA.calib[id] = {}), s = c[side] || (c[side] = {}); s[k] = v; try { localStorage.setItem('fpa_calib', JSON.stringify(FPA.calib)); } catch (e) { } }

// ---------------------------------------------------------------- FIRST-PERSON ARMS LAB (F11)
// camera orbitale attorno a braccia e arma (stessa scena, stessa pose del gioco), scheletro, wireframe, pose, test
// (ADS, rinculo, ricarica, scatto, scavalcamento), scelta dell'arma, confronto con le mani precedenti, calibrazione.
const FAL = { on: false, yaw: 2.4, pitch: .25, dist: .75, cam: null, helper: null, wire: false, test: null, testT: 0, old: false };
function falRender() {
  const c = FAL.cam || (FAL.cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .01, 100));
  camera.updateMatrixWorld(true); const tgt = camera.localToWorld(new V3(0, -.16, -.3));
  const off = new V3(Math.sin(FAL.yaw) * Math.cos(FAL.pitch), Math.sin(FAL.pitch), Math.cos(FAL.yaw) * Math.cos(FAL.pitch)).multiplyScalar(FAL.dist).applyQuaternion(camera.quaternion);
  c.position.copy(tgt).add(off); c.up.set(0, 1, 0).applyQuaternion(camera.quaternion); c.lookAt(tgt); c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.render(scene, c); renderer.toneMapping = tm;
}
function falTick(dt) {   // test animati, guidano lo stato del giocatore come farebbe il gioco
  if (!FAL.on || !FAL.test) return; FAL.testT += dt; const t = FAL.testT;
  if (FAL.test === 'ads') P.adsHeld = Math.sin(t * 1.6) > 0;
  else if (FAL.test === 'recoil') { if ((t * 3 | 0) !== FAL.lastShot) { FAL.lastShot = t * 3 | 0; P.recoil = 1; P.flashT = .05; STATS.shots++; } }
  else if (FAL.test === 'reload') { if (P.reloadT <= 0 && t > .3) { const s = P.slot(); s.mag = 0; startReload(); FAL.testT = -1; } }
  else if (FAL.test === 'sprint') { P.sprint = true; P.moveK = 1.4; P.bobPh += dt * 14; }
  else if (FAL.test === 'vault' && typeof XPC !== 'undefined') { XPC.vault = (t % 2) < 1 ? XPC.vault || { kind: 'scavalcamento', t: 0, dur: 99, a: P.pos.clone(), top: P.pos.clone(), b: P.pos.clone() } : null; }
  else if (FAL.test === 'switch') { if (P.switchT <= 0 && t % 2 < dt) { P.switchT = .5; } }
}
function falUi() {
  const el = document.getElementById('falPanel'); if (!el || !FAL.on) return;
  const B = (a, t, on) => `<button data-a="${a}" style="margin:2px 3px 2px 0;padding:2px 7px;background:${on ? '#5a4a22' : '#2a2c2a'};color:#eee;border:1px solid #666;cursor:pointer">${t}</button>`;
  const S = 'margin:8px 0 3px;font:600 11px system-ui;letter-spacing:.12em;color:#c8b070', id = typeof vmCurId !== 'undefined' ? vmCurId : '', cal = (FPA.calib[id] || {});
  const slider = (side, k, lbl, a, b) => `<label style="display:block;font-size:11px">${side} ${lbl} <input data-cal="${side}:${k}" type="range" min="${a}" max="${b}" step=".002" value="${(cal[side] || {})[k] || 0}" style="width:60%"></label>`;
  el.innerHTML = `<b style="letter-spacing:.08em">FIRST-PERSON ARMS LAB</b> <span style="opacity:.6">(F11)</span>
  <div style="${S}">ARMA</div>${Object.keys(FPA_KIND).filter(k => WGLB.data[k]).map(k => B('w:' + k, WEAPONS[k].name.split(' ')[0], k === id)).join('')}
  <div style="${S}">VISTA</div>${B('skel', 'Scheletro', !!FAL.helper)}${B('wire', 'Wireframe', FAL.wire)}${B('fp', 'Vista del giocatore')}${B('old', 'Mani precedenti', FAL.old)}
  <div style="${S}">TEST</div>${['ads', 'recoil', 'reload', 'sprint', 'vault', 'switch'].map(k => B('t:' + k, { ads: 'Mira', recoil: 'Rinculo', reload: 'Ricarica', sprint: 'Scatto', vault: 'Mano libera (scavalc.)', switch: 'Cambio arma' }[k], FAL.test === k)).join('')}${B('t:', 'Stop')}
  <div style="${S}">CALIBRAZIONE (${id})</div>${slider('R', 'x', 'polso x', -.06, .06)}${slider('R', 'y', 'polso y', -.06, .06)}${slider('R', 'z', 'polso z', -.06, .06)}${slider('R', 'r', 'rotazione', -1, 1)}${slider('L', 'x', 'polso x', -.06, .06)}${slider('L', 'y', 'polso y', -.06, .06)}${slider('L', 'z', 'polso z', -.06, .06)}${slider('L', 'r', 'rotazione', -1, 1)}
  <div style="${S}">STATISTICHE</div><div style="font-size:11px">${FPA.tris ? Math.round(FPA.tris).toLocaleString('it') : '—'} triangoli · ${FPA.man ? Object.values(FPA.man.ossa).reduce((a, b) => a + b, 0) : 0} ossa · IK+dita ${FPA.stats.ms.toFixed(3)} ms · animazioni procedurali (nessuna clip di Blender)</div>
  <div style="opacity:.6;font-size:11px;margin-top:4px">Trascina: ruota · rotella: zoom</div>`;
}
function falOpen(on) {
  FAL.on = on; let el = document.getElementById('falPanel');
  if (!el) {
    el = document.createElement('div'); el.id = 'falPanel'; el.style.cssText = 'position:fixed;right:12px;top:12px;width:min(330px,92vw);max-height:calc(100vh - 24px);overflow:auto;z-index:73;background:rgba(10,11,10,.9);color:#e8e6dc;font:12px/1.45 system-ui,sans-serif;padding:10px 12px;border:1px solid #555';
    document.body.appendChild(el);
    el.addEventListener('input', e => { const c = e.target.dataset.cal; if (c) { const [s, k] = c.split(':'); fpaCalibrate(vmCurId, s, k, +e.target.value); } });
    el.addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a.startsWith('w:')) { const k = a.slice(2); const i = P.inv.findIndex(s => s && s.id === k); if (i >= 0) P.cur = i; else { P.inv[0] = { id: k, mag: WEAPONS[k].mag, res: 60 }; P.cur = 0; } }
      else if (a === 'skel') { if (FAL.helper) { scene.remove(FAL.helper); FAL.helper = null; } else { FAL.helper = new THREE.Group(); for (const s of ['R', 'L']) { const h = new THREE.SkeletonHelper(FPA.sides[s].root); h.material.depthTest = false; FAL.helper.add(h); } scene.add(FAL.helper); } }
      else if (a === 'wire') { FAL.wire = !FAL.wire; FPA.rig.traverse(o => { if (o.isMesh) o.material.wireframe = FAL.wire; }); }
      else if (a === 'fp') { FAL.view = !FAL.view; }
      else if (a === 'old') { FAL.old = !FAL.old; FPA.on = !FAL.old; for (const k in vmCache) { const o = vmCache[k]; o.group.parent && o.group.parent.remove(o.group); delete vmCache[k]; } vmCur = null; vmCurId = null; if (FPA.rig) FPA.rig.visible = !FAL.old; }
      else if (a.startsWith('t:')) { FAL.test = a.slice(2) || null; FAL.testT = 0; if (!FAL.test) { P.adsHeld = false; P.sprint = false; if (typeof XPC !== 'undefined') XPC.vault = null; } }
      falUi(); e.target.blur();
    });
  }
  el.style.display = on ? 'block' : 'none';
  if (on) { falUi(); if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => { GAME.running = true; const pz = document.getElementById('pause'); if (pz) pz.classList.add('hidden'); }, 60); }
}
addEventListener('mousedown', e => { if (!FAL.on || FAL.view || (e.target.closest && e.target.closest('#falPanel'))) return; FAL.drag = 1; FAL.mx = e.clientX; FAL.my = e.clientY; e.stopImmediatePropagation(); }, true);
addEventListener('mousemove', e => { if (!FAL.on || !FAL.drag) return; FAL.yaw -= (e.clientX - FAL.mx) * .006; FAL.pitch = clamp(FAL.pitch + (e.clientY - FAL.my) * .005, -1.2, 1.4); FAL.mx = e.clientX; FAL.my = e.clientY; e.stopImmediatePropagation(); }, true);
addEventListener('mouseup', () => { FAL.drag = 0; }, true);
addEventListener('wheel', e => { if (!FAL.on || FAL.view || (e.target.closest && e.target.closest('#falPanel'))) return; FAL.dist = clamp(FAL.dist * (1 + Math.sign(e.deltaY) * .1), .2, 3); e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, passive: false });
addEventListener('keydown', e => { if (e.code === 'F11' && typeof SCEN !== 'undefined' && SCEN === 'aaa' && typeof GAME !== 'undefined' && GAME.started) { e.preventDefault(); falOpen(!FAL.on); } });
setInterval(() => { if (FAL.on) { const el = document.getElementById('falPanel'); if (el && !el.matches(':hover')) falUi(); } }, 1000);
