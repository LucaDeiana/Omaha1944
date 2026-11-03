"use strict";
// ============================================================
//  Carri 3.0: linea di vista, linea di tiro, collisione dei proiettili con gli edifici, materiali, memoria del bersaglio.
//  Prima i carri vedevano solo il terreno (kasLOS) e i proiettili non toccavano mai muri e case; il Panzer di Omaha
//  sceglieva il soldato più vicino senza guardare e il suo colpo esplodeva direttamente sul bersaglio.
//  Qui tutto passa da una sola interrogazione: il primo ostacolo lungo un segmento (terreno o solido), cercato nella
//  griglia spaziale dei solidi già usata dalla fisica dei carri (vpGrid, celle di 12 m), con cache per coppia.
// ============================================================
const TL = { debug: false, q: 0, st: { los: 0, lofs: 0, hits: 0, cacheHit: 0, shellSolid: 0, shellPen: 0, ms: 0, noLOF: 0, hiddenStop: 0, reposition: 0 } };

// materiali: sight = blocca la vista; pen = millimetri di perforazione assorbiti (oltre, il colpo si ferma)
const TL_MAT = {
  muratura: { sight: 1, pen: 400, fx: 'dirt' }, cemento: { sight: 1, pen: 1e9, fx: 'dirt' }, roccia: { sight: 1, pen: 1e9, fx: 'dirt' },
  acciaio: { sight: 1, pen: 1e9, fx: 'metal' }, terra: { sight: 1, pen: 160, fx: 'dirt' }, vegetazione: { sight: 1, pen: 60, fx: 'dirt' },
  legno: { sight: 1, pen: 12, fx: 'dirt' }, filo: { sight: 0, pen: 0, fx: 'metal' },
};
const TL_TAG = { house: 'muratura', church: 'muratura', tower: 'muratura', ruin: 'muratura', wall: 'muratura', bunker: 'cemento', flak: 'cemento', rock: 'roccia',
  ship: 'acciaio', tank: 'acciaio', sandbag: 'terra', sand: 'terra', hedge: 'vegetazione', crate: 'legno', boat: 'legno', wire: 'filo' };
const tlMat = s => TL_MAT[s.mat || TL_TAG[s.tag] || 'muratura'];

// primo ostacolo lungo a→b. mode 'sight' (la vista) o 'shell' (con pen: gli ostacoli più deboli vengono attraversati e contati)
const _tlD = new V3(), _tlHit = { t: 0, s: null, terrain: false, mat: null, pen: [] };
function tlRay(a, b, mode = 'sight', pen = 0, skipTerrain = false) {
  const t0 = performance.now(); TL.st.los++;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), H = _tlHit; H.s = null; H.terrain = false; H.mat = null; H.pen.length = 0; H.t = d;
  if (d < .5) { TL.st.ms += performance.now() - t0; return null; }
  const ix = dx / d, iy = dy / d, iz = dz / d, q = ++TL.q;
  // solidi: celle della griglia attraversate dal segmento (passo di mezza cella), più i solidi molto grandi
  const G = vpGrid(), c = VP.CELL, n = Math.ceil(d / (c * .5)) + 1, cand = [];
  for (let k = 0; k <= n; k++) {
    const f = Math.min(1, k / n), cx = Math.floor((a.x + dx * f) / c), cz = Math.floor((a.z + dz * f) / c);
    for (let oi = -1; oi <= 1; oi++) for (let oj = -1; oj <= 1; oj++) { const l = G.get((cx + oi) * 100003 + cz + oj); if (l) for (const s of l) if (s._tq !== q) { s._tq = q; cand.push(s); } }
  }
  for (const s of VP.big) if (s._tq !== q) { s._tq = q; cand.push(s); }
  const hits = [];
  for (const s of cand) {
    if (!s.on || (mode === 'sight' && s.nb)) continue; const m = tlMat(s); if (mode === 'sight' ? !m.sight : !m.pen) continue;
    const t = rayBox(a.x, a.y, a.z, ix, iy, iz, s, d); if (t >= 0) hits.push([t, s, m]);
  }
  hits.sort((p, r) => p[0] - r[0]);
  let best = null, left = pen;
  for (const h of hits) { if (mode === 'shell' && h[2].pen < left) { left -= h[2].pen; H.pen.push(h); continue; } best = h; break; }
  // terreno: campioni lungo il segmento (fino al primo solido)
  const lim = best ? best[0] : d;
  if (!skipTerrain) { const st = Math.max(1.5, d / 60); for (let s = st; s < lim - .5; s += st) if (a.y + iy * s < Hf(a.x + ix * s, a.z + iz * s)) { H.t = s; H.terrain = true; TL.st.ms += performance.now() - t0; TL.st.hits++; return H; } }
  TL.st.ms += performance.now() - t0;
  if (!best) return H.pen.length ? (H.s = null, H.t = d, H.left = left, null) : null;
  H.t = best[0]; H.s = best[1]; H.mat = best[2]; H.left = left; TL.st.hits++; return H;
}
// punti dell'osservatore e del bersaglio
function tlEye(o, out) {
  if (o === P) return P.chest ? P.chest(out) : out.copy(P.pos);
  if (o.tank && o.T) return out.set(o.pos.x, o.pos.y + o.T.hullH + .9, o.pos.z);   // cupola del capocarro
  if (o.tank) return out.set(o.pos.x, o.pos.y + 2.7, o.pos.z);
  if (o.type === 'pak') return out.set(o.pos.x, o.pos.y + 1.3, o.pos.z);
  if (o.eye) return o.eye(out);
  return out.set(o.pos.x, o.pos.y + 1.5, o.pos.z);
}
// punti del bersaglio da provare: un carro si vede anche solo dalla torretta (parzialmente coperto)
function tlAimPts(o, out) {
  out.length = 0;
  if (o === P) { out.push(P.chest(new V3())); return out; }
  if (o.tank) { const h = o.T ? o.T.hullH : 1.9; out.push(new V3(o.pos.x, o.pos.y + h + .4, o.pos.z), new V3(o.pos.x, o.pos.y + h * .55, o.pos.z)); return out; }
  if (o.type === 'pak') { out.push(new V3(o.pos.x, o.pos.y + 1.1, o.pos.z)); return out; }
  out.push(o.chest ? o.chest(new V3()) : new V3(o.pos.x, o.pos.y + 1.2, o.pos.z)); return out;
}
// visibilità con cache: ricalcolo periodico (0,5-0,8 s), oppure se uno dei due si è spostato, oppure se l'ostacolo che la bloccava non c'è più
const _tlE = new V3(), _tlP = [];
function tlSee(obs, tgt) {
  const C = obs._tlc || (obs._tlc = new Map()); let e = C.get(tgt);
  const now = GAME.time;
  if (e && now < e.t && Math.abs(obs.pos.x - e.ox) + Math.abs(obs.pos.z - e.oz) < 1.5 && Math.abs(tgt.pos.x - e.tx) + Math.abs(tgt.pos.z - e.tz) < 1.5 && (!e.by || e.by.on) && e.n === solids.length + (TL.ver || 0) * 1e5) { TL.st.cacheHit++; return e.vis; }
  if (!e) { e = {}; C.set(tgt, e); if (C.size > 64) C.clear(); }
  tlEye(obs, _tlE); tlAimPts(tgt, _tlP); let vis = false, by = null, hp = null;
  for (const p of _tlP) { const h = tlRay(_tlE, p, 'sight'); if (!h) { vis = true; break; } if (!by) { by = h.s; hp = h.terrain ? 'terreno' : (h.s.tag || 'solido'); e.hit = _tlE.clone().addScaledVector(_tlD.subVectors(p, _tlE).normalize(), h.t); } }
  Object.assign(e, { n: solids.length + (TL.ver || 0) * 1e5, t: now + .5 + Math.random() * .3, ox: obs.pos.x, oz: obs.pos.z, tx: tgt.pos.x, tz: tgt.pos.z, vis, by: vis ? null : by, why: vis ? '' : hp, e: _tlE.clone(), p: _tlP[0].clone() });
  if (vis) e.hit = null;
  return vis;
}
// linea di tiro: dalla bocca del cannone al punto mirato, con la perforazione del colpo (cache 0,25 s)
function tlLOF(t, aim, pen, near = 0) {   // near: un colpo esplosivo che si ferma a pochi metri dal bersaglio (sacchetti davanti al soldato) è comunque giustificato
  const now = GAME.time, L = t._tlf || (t._tlf = { t: -1 });
  if (now < L.t && L.n === solids.length + (TL.ver || 0) * 1e5 && L.ax !== undefined && Math.abs(L.ax - aim.x) + Math.abs(L.az - aim.z) < 2) return L.ok;
  const mz = t.muzzle(new V3()); TL.st.lofs++;
  let h = tlRay(mz, aim, 'shell', pen || 0); if (h && near && mz.distanceTo(aim) - h.t < near) h = null;
  L.t = now + .25; L.n = solids.length + (TL.ver || 0) * 1e5; L.ax = aim.x; L.az = aim.z; L.ok = !h; L.m = mz; L.a = aim.clone(); L.why = h ? (h.terrain ? 'terreno davanti alla canna' : (h.s.tag || 'ostacolo') + ' davanti alla canna') : ''; L.hit = h ? mz.clone().addScaledVector(_tlD.subVectors(aim, mz).normalize(), h.t) : null;
  return L.ok;
}

// ---------- memoria del bersaglio: sconosciuto / noto (ultima posizione) / visibile ----------
const TL_UNKNOWN = 'TARGET_UNKNOWN', TL_KNOWN = 'TARGET_KNOWN', TL_VISIBLE = 'TARGET_VISIBLE';
function tlMem(t) { return t._tlm || (t._tlm = { state: TL_UNKNOWN, tgt: null, p: new V3(), t: -99, seenT: -99, hidT: 0, why: '' }); }
function tlSaw(t, tgt) { const m = tlMem(t); m.state = TL_VISIBLE; m.tgt = tgt; m.p.copy(tgt.pos); m.t = GAME.time; m.hidT = 0; }
// a ogni pensiero: se il bersaglio tenuto non è più visibile resta «noto» per un po' (12 s), poi viene dimenticato
function tlForget(t, dt) {
  const m = tlMem(t);
  if (m.state === TL_VISIBLE && t.target !== m.tgt) { m.state = m.tgt && m.tgt.alive !== false ? TL_KNOWN : TL_UNKNOWN; }
  if (m.state === TL_KNOWN) { m.hidT += dt; if (GAME.time - m.t > 12 || !m.tgt || m.tgt.alive === false) { m.state = TL_UNKNOWN; m.tgt = null; } }
  return m;
}
// posizione di tiro: un punto vicino, libero, da cui l'ultima posizione nota del nemico si vede
function tlFirePos(t, p) {
  const e = new V3(), tp = new V3(p.x, p.y + 1.8, p.z); let best = null, bs = 1e9;
  for (let i = 0; i < 24; i++) {
    const a = i / 12 * TAU, r = 16 + (i % 4) * 16 + (i >= 12 ? 8 : 0), x = t.pos.x + Math.sin(a) * r, z = t.pos.z + Math.cos(a) * r, y = Hf(x, z);
    if (vpCell(x, z).some(s => s.on && tlMat(s).sight && s.max.y > y + .8 && x > s.min.x - 4 && x < s.max.x + 4 && z > s.min.z - 4 && z < s.max.z + 4)) continue;   // dentro o addosso a un edificio
    if (Math.abs(Hf(x + 3, z) - Hf(x - 3, z)) > 3 || Math.abs(Hf(x, z + 3) - Hf(x, z - 3)) > 3) continue;   // troppo ripido
    e.set(x, y + (t.T ? t.T.hullH + .9 : 2.7), z); if (tlRay(e, tp, 'sight')) continue;
    const s = r + Math.hypot(x - p.x, z - p.z) * .05; if (s < bs) { bs = s; best = new V3(x, y, z); }
  }
  return best;
}

// ---------- debug visivo (Ctrl+Maiusc+K) ----------
const TLD = { lines: null, labels: [] };
function tlDebugTick() {
  if (!TL.debug) { if (TLD.lines) TLD.lines.visible = false; for (const l of TLD.labels) l.style.display = 'none'; return; }
  const tanks = (typeof KAS !== 'undefined' && KAS.tanks || []).concat(typeof TANKS !== 'undefined' ? TANKS.list : [], typeof KAS !== 'undefined' && KAS.guns || []).filter(t => t.alive && !t.player);
  if (!TLD.lines) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 600), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6 * 600), 3)); TLD.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true })); TLD.lines.frustumCulled = false; TLD.lines.renderOrder = 999; scene.add(TLD.lines); }
  const P_ = TLD.lines.geometry.attributes.position, C_ = TLD.lines.geometry.attributes.color; let n = 0;
  const seg = (a, b, r, g, bb) => { if (!a || !b || n >= 600) return; P_.setXYZ(n * 2, a.x, a.y, a.z); P_.setXYZ(n * 2 + 1, b.x, b.y, b.z); C_.setXYZ(n * 2, r, g, bb); C_.setXYZ(n * 2 + 1, r, g, bb); n++; };
  const cross = (p, r, g, b) => { if (!p) return; seg(new V3(p.x - 1, p.y, p.z), new V3(p.x + 1, p.y, p.z), r, g, b); seg(new V3(p.x, p.y - 1, p.z), new V3(p.x, p.y + 1, p.z), r, g, b); seg(new V3(p.x, p.y, p.z - 1), new V3(p.x, p.y, p.z + 1), r, g, b); };
  let li = 0;
  for (const t of tanks) {
    const m = tlMem(t), e = tlEye(t, new V3());
    // vista: verde = visibile; rossa fino al primo ostacolo (croce rossa); gialla = ultima posizione nota
    if (t.target && t._tlc && t._tlc.get(t.target)) { const c = t._tlc.get(t.target); seg(e, c.p, 0, 1, 0); }
    if (m.state === TL_KNOWN) { seg(e, new V3(m.p.x, m.p.y + 2, m.p.z), 1, .85, 0); const c = t._tlc && t._tlc.get(m.tgt); if (c && c.hit) { seg(e, c.hit, 1, 0, 0); cross(c.hit, 1, 0, 0); } }
    // canna e linea di tiro: azzurra libera, magenta ostruita fino all'ostacolo
    if (t.muzzle && t.aimDir) { const mz = t.muzzle(new V3()); seg(mz, mz.clone().addScaledVector(t.aimDir(new V3()), 25), .6, .6, 1); const L = t._tlf; if (L && L.m && GAME.time - L.t < 1) { if (L.ok) seg(L.m, L.a, 0, .9, 1); else { seg(L.m, L.hit, 1, 0, 1); cross(L.hit, 1, 0, 1); } } }
    if (t.flankP) { seg(new V3(t.pos.x, t.pos.y + .5, t.pos.z), new V3(t.flankP.x, t.flankP.y + .5, t.flankP.z), 1, 1, 1); cross(new V3(t.flankP.x, t.flankP.y + 1, t.flankP.z), 1, 1, 1); }
    // etichetta: stato e motivo
    const sp = e.clone().add(new V3(0, 2, 0)).project(camera); if (sp.z > 1 || Math.abs(sp.x) > 1.1 || Math.abs(sp.y) > 1.1) continue;
    let l = TLD.labels[li]; if (!l) { l = TLD.labels[li] = document.createElement('div'); l.style.cssText = 'position:fixed;z-index:60;pointer-events:none;font:11px/1.25 monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 4px;white-space:pre;transform:translate(-50%,-100%)'; document.body.appendChild(l); }
    l.style.display = 'block'; l.style.left = ((sp.x + 1) / 2 * innerWidth) + 'px'; l.style.top = ((1 - sp.y) / 2 * innerHeight) + 'px';
    l.textContent = `${t.name || t.type} ${t.team || ''}\n${m.state.replace('TARGET_', '')}${t.target ? ' → ' + (t.target === P ? 'giocatore' : t.target.name || t.target.kind || 'bersaglio') : ''}\n${t.tlWhy || ''}`; li++;
  }
  for (let i = li; i < TLD.labels.length; i++) TLD.labels[i].style.display = 'none';
  TLD.lines.geometry.setDrawRange(0, n * 2); P_.needsUpdate = C_.needsUpdate = true; TLD.lines.visible = true;
}
addEventListener('keydown', e => { if (e.code === 'KeyK' && e.ctrlKey && e.shiftKey) { e.preventDefault(); TL.debug = !TL.debug; if (typeof showMsg === 'function') showMsg('Debug vista e tiro dei carri: ' + (TL.debug ? 'attivo' : 'spento'), 1.5); } });
