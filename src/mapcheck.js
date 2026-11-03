"use strict";
// ============================================================
//  Strumenti di mappa 4.0: validazione e overlay di debug (Ctrl+Maiusc+M).
//  Validazione: edifici sovrapposti, oggetti sospesi o sepolti, coperture e punti di comparsa dentro i muri,
//  coordinate non valide, solai senza appoggio, percorsi bloccati. Overlay: collider per tipo, coperture, solai e scale,
//  oggetti distruttibili, punti d'interesse, limiti della mappa. Spento di base, nessun costo se non attivo.
// ============================================================
const MAPCHK = { on: false, g: null, el: null, last: null };
const MC_BUILD = /^(house|church|tower|ruin|bunker|dz_)/;
function mapValidate() {
  const t0 = performance.now(), R = { overlaps: [], floating: [], buried: [], coverInside: 0, spawnInside: [], nan: 0, floors: 0, floorsBad: 0, solids: solids.length, active: 0, covers: covers.length, dz: typeof DZ !== 'undefined' ? DZ.secs.length : 0 };
  const act = solids.filter(s => s.on); R.active = act.length;
  for (const s of solids) if (![s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z].every(Number.isFinite)) R.nan++;
  // edifici sovrapposti: scatole di edifici diversi che si compenetrano (non le sezioni dello stesso oggetto)
  const B = act.filter(s => MC_BUILD.test(s.tag || '') && !s.walk);
  const owner = s => s._dz ? s._dz.obj.id : s;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j]; if (owner(a) === owner(b)) continue;
    const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x), oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y), oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
    if (ox > .3 && oy > .3 && oz > .3 && ox * oy * oz > 1) R.overlaps.push([a.tag, b.tag, +((a.min.x + a.max.x) / 2).toFixed(1), +((a.min.z + a.max.z) / 2).toFixed(1)]);
  }
  // sospesi (la base sopra il terreno in tutti e quattro gli angoli) e sepolti (la cima sotto il terreno)
  for (const s of B) {
    if (s._dz && (s._dz.role === 'hidden' || s._dz.box[1] > s._dz.obj.base + .5)) continue;   // tetti e pezzi dei piani alti poggiano su altri pezzi
    if (/tower/.test(s.tag) && s.min.y > 5) continue;
    const g = Math.min(Hf(s.min.x, s.min.z), Hf(s.max.x, s.min.z), Hf(s.min.x, s.max.z), Hf(s.max.x, s.max.z));
    if (s.min.y > g + .6) R.floating.push([s.tag, +s.min.x.toFixed(1), +s.min.z.toFixed(1), +(s.min.y - g).toFixed(2)]);
    const gM = Math.max(Hf(s.min.x, s.min.z), Hf(s.max.x, s.max.z)); if (s.max.y < gM - .05) R.buried.push([s.tag, +s.min.x.toFixed(1), +s.min.z.toFixed(1)]);
  }
  // coperture dentro un solido (inutilizzabili) e punti di comparsa o di ripresa dentro i muri
  const inside = (x, z, y) => { for (const s of vpNear({ x, z }, .3)) if (s.on && !s.walk && x > s.min.x + .05 && x < s.max.x - .05 && z > s.min.z + .05 && z < s.max.z - .05 && y > s.min.y && y < s.max.y) return s; return null; };
  for (const c of covers) { if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) { R.nan++; continue; } if (!c.dead && inside(c.x, c.z, Hf(c.x, c.z) + 1)) R.coverInside++; }
  const spawns = [];
  if (MISSION.checkpoint && MISSION.checkpoint.pos) spawns.push(['ripresa', MISSION.checkpoint.pos]);
  if (typeof WORLD !== 'undefined' && WORLD.towerTop) spawns.push(['campanile', WORLD.towerTop]);
  for (const [n, p] of spawns) { const y = Math.max(Hf(p.x, p.z), p.y || 0) + 1; if (inside(p.x, p.z, y)) R.spawnInside.push(n); }
  // solai: dentro un edificio ancora in piedi, sopra il terreno
  if (typeof FLOORS !== 'undefined') for (const f of FLOORS) { if (f.off) continue; R.floors++; const y = f.ramp ? f.ramp.y0 : f.y; if (!Number.isFinite(y) || y < Hf((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2) - 1.5) R.floorsBad++; }
  R.ms = +(performance.now() - t0).toFixed(1); R.ok = !R.overlaps.length && !R.floating.length && !R.buried.length && !R.nan && !R.spawnInside.length && !R.floorsBad;
  MAPCHK.last = R; return R;
}
// overlay: solo nel raggio di 120 m dalla telecamera, ricostruito due volte al secondo
const MC_COL = { house: 0xff6040, church: 0xff6040, tower: 0xff6040, ruin: 0xffa040, bunker: 0x40c0ff, rubble: 0x8080ff, rubbleH: 0xb040ff, floor: 0x40ffe0, tank: 0xc0c0c0, wall: 0xffe040, sand: 0xc8a050, sandbag: 0xc8a050 };
function mapDebugTick(dt) {
  if (!MAPCHK.on) { if (MAPCHK.g) MAPCHK.g.visible = false; if (MAPCHK.el) MAPCHK.el.style.display = 'none'; return; }
  if (!MAPCHK.g) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3 * 2600), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 3 * 2600), 3)); MAPCHK.g = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .8 })); MAPCHK.g.frustumCulled = false; MAPCHK.g.renderOrder = 998; scene.add(MAPCHK.g); MAPCHK.el = document.createElement('div'); MAPCHK.el.style.cssText = 'position:fixed;left:10px;top:120px;z-index:61;font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.65);padding:6px 8px;pointer-events:none;white-space:pre'; document.body.appendChild(MAPCHK.el); }
  MAPCHK.t = (MAPCHK.t || 0) - dt; MAPCHK.g.visible = true; MAPCHK.el.style.display = 'block'; if (MAPCHK.t > 0) return; MAPCHK.t = .5;
  const P_ = MAPCHK.g.geometry.attributes.position, C_ = MAPCHK.g.geometry.attributes.color, cp = camera.position, c = new THREE.Color(); let n = 0;
  const seg = (a, b, col) => { if (n >= 24 * 2600) return; c.setHex(col); P_.setXYZ(n, ...a); C_.setXYZ(n++, c.r, c.g, c.b); P_.setXYZ(n, ...b); C_.setXYZ(n++, c.r, c.g, c.b); };
  const boxL = (x0, y0, z0, x1, y1, z1, col) => { const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]; for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) seg(v[a], v[b], col); };
  let shown = 0;
  for (const s of solids) { if (!s.on || Math.abs(s.min.x - cp.x) > 120 || Math.abs(s.min.z - cp.z) > 120) continue; boxL(s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, s._dz ? [0x40ff60, 0xffe040, 0xff8030, 0xff2030][s._dz.state] : MC_COL[s.tag] ?? 0xaaaaaa); shown++; }
  for (const cv of covers) { if (Math.abs(cv.x - cp.x) > 80 || Math.abs(cv.z - cp.z) > 80) continue; const y = Hf(cv.x, cv.z) + .1, col = cv.dead ? 0xff0000 : 0x00ff80; seg([cv.x - .4, y, cv.z], [cv.x + .4, y, cv.z], col); seg([cv.x, y, cv.z - .4], [cv.x, y, cv.z + .4], col); }
  if (typeof FLOORS !== 'undefined') for (const f of FLOORS) { if (f.off || Math.abs(f.x0 - cp.x) > 120 || Math.abs(f.z0 - cp.z) > 120) continue; const y0 = f.ramp ? f.ramp.y0 : f.y, y1 = f.ramp ? f.ramp.y1 : f.y; seg([f.x0, y0 + .03, f.z0], [f.x1, y1 + .03, f.z1], 0x40ffe0); seg([f.x0, y0 + .03, f.z1], [f.x1, y1 + .03, f.z0], 0x40ffe0); }
  if (MISSION.checkpoint && MISSION.checkpoint.pos) { const p = MISSION.checkpoint.pos, y = Hf(p.x, p.z); seg([p.x, y, p.z], [p.x, y + 6, p.z], 0xff00ff); }
  P_.needsUpdate = C_.needsUpdate = true; MAPCHK.g.geometry.setDrawRange(0, n);
  const R = MAPCHK.last || mapValidate();
  MAPCHK.el.textContent = `MAPPA ${SCEN}  collider ${R.active}/${R.solids} (visibili ${shown})  coperture ${R.covers}  solai ${R.floors}  sezioni distruttibili ${R.dz}\nsovrapposizioni ${R.overlaps.length} · sospesi ${R.floating.length} · sepolti ${R.buried.length} · coperture nei muri ${R.coverInside} · comparse nei muri ${R.spawnInside.length} · coordinate non valide ${R.nan}\n[rosso case · arancio rovine · azzurro bunker · giallo muri · verde/arancio/rosso sezioni per stato · ciano solai e scale · croci coperture · viola punto di ripresa]`;
}
addEventListener('keydown', e => { if (e.code === 'KeyM' && e.ctrlKey && e.shiftKey) { e.preventDefault(); MAPCHK.on = !MAPCHK.on; if (MAPCHK.on) mapValidate(); if (typeof showMsg === 'function') showMsg('Debug mappa: ' + (MAPCHK.on ? 'attivo' : 'spento'), 1.5); } });
