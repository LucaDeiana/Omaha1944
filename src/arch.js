"use strict";
// ============================================================
//  Architettura 4.0 — libreria modulare di edifici per teatro.
//  Un edificio è fatto di PEZZI DI MURO veri (sezioni di Distruzione 3.0: collider, materiale, stati), separati da
//  APERTURE REALI (finestre e porte: si vede e si spara attraverso, si entra dalle porte aperte), più un tetto
//  costruito come geometria (a due falde, a padiglione, a mezzo padiglione) con gronda, colmo e comignoli,
//  decorazioni legate ai pezzi (cornici, davanzali, persiane, cantonali, graticcio: cadono col muro) e, per gli
//  edifici strategici, interni con solaio, scala e mobili essenziali.
//  Tutto è deterministico: lo stesso ID dà sempre lo stesso edificio (missioni, punti di ripresa, rete).
// ============================================================
const ARCH = { st: { houses: 0, secs: 0, ms: 0 } };
function archRng(id) { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); const f = seeded(h >>> 0); return { f, r: (a, b) => a + f() * (b - a), pick: a => a[(f() * a.length) | 0], chance: p => f() < p }; }

// profili per teatro: materiali, colori, tetti, aperture (Normandia: pietra calcarea, intonaci chiari, ardesia e coppi, persiane dipinte)
const ARCH_PROFILE = {
  normandy: {
    walls: {
      pietra: { mat: 'pietra', vis: 'stone', cols: [0xc0b59b, 0xb5aa90, 0xc8bea4, 0xaea388], t: .6 },
      intonaco: { mat: 'pietra', vis: 'plaster', cols: [0xc4b898, 0xbcae8c, 0xc8bc9e, 0xb8a684, 0xc2b08e], t: .5 },
      mattoni: { mat: 'mattoni', vis: 'brick', cols: [0xa06a52, 0x925e48, 0x9a644c], t: .45 },
    },
    roofs: { ardesia: [0x5c626a, 0x666c74, 0x545a62], coppi: [0x8e4e38, 0x7e4634, 0x985a40] },
    shutters: [0x4e6a54, 0x6a7a86, 0x8c8c7c, 0x6e4434, 0x3d5266, 0x7a6a4a], timber: 0x3a2a1e, trim: 0xdcd4c0, door: [0x4a3524, 0x3c4a3a, 0x5a3a28, 0x34404e],
    pitch: [.75, .92],   // 43-53°: tetti normanni ripidi
  },
};

// ---------- tetto (geometria in coordinate del mondo, colori per vertice) ----------
function archRoofGeo(o) {
  // o: cx, cz, along ('x'|'z'), L (metà lunghezza lungo il colmo), Wd (metà larghezza), top, pitch, ov, type, col
  const pos = [], cols = [], c = new THREE.Color(o.col), tan = Math.tan(o.pitch), rh = o.Wd * tan, yr = o.top + rh, ye = o.top - o.ov * tan;
  const P = (u, v, y) => o.along === 'x' ? [o.cx + u, y, o.cz + v] : [o.cx + v, y, o.cz + u];
  const tri = (a, b, d, k = 1) => { for (const q of [a, b, d]) { pos.push(...P(...q)); const s = k * (.92 + .16 * ((q[0] * 7.1 + q[1] * 3.3) % 1 + 1) % 1); cols.push(c.r * s, c.g * s, c.b * s); } };
  const quad = (a, b, d, e, k) => { tri(a, b, d, k); tri(a, d, e, k); };
  const both = (fn) => { fn(false); fn(true); };
  const L = o.L, W = o.Wd, ov = o.ov, th = .16;
  const slab = (pts, under) => { const q = under ? pts.map(p => [p[0], p[1], p[2] - th]).reverse() : pts; if (q.length === 3) tri(...q, under ? .55 : 1); else quad(...q, under ? .55 : 1); };
  if (o.type === 'gable') {
    for (const s of [-1, 1]) both(u => slab(s > 0 ? [[-L - ov, W + ov, ye], [L + ov, W + ov, ye], [L + ov, 0, yr], [-L - ov, 0, yr]] : [[L + ov, -W - ov, ye], [-L - ov, -W - ov, ye], [-L - ov, 0, yr], [L + ov, 0, yr]], u));
  } else if (o.type === 'hip') {
    const r = Math.max(0, L - W);
    for (const s of [-1, 1]) both(u => slab(s > 0 ? [[-L - ov, W + ov, ye], [L + ov, W + ov, ye], [r, 0, yr], [-r, 0, yr]] : [[L + ov, -W - ov, ye], [-L - ov, -W - ov, ye], [-r, 0, yr], [r, 0, yr]], u));
    for (const s of [-1, 1]) both(u => slab(s > 0 ? [[L + ov, W + ov, ye], [L + ov, -W - ov, ye], [r, 0, yr]] : [[-L - ov, -W - ov, ye], [-L - ov, W + ov, ye], [-r, 0, yr]], u));
  } else {   // mezzo padiglione: frontone fino a due terzi, poi una piccola falda
    const vh = W * .38, yh = o.top + rh * (1 - vh / W), hk = vh;
    for (const s of [-1, 1]) {
      both(u => slab(s > 0 ? [[-L - ov, W + ov, ye], [L + ov, W + ov, ye], [L + ov, vh, yh], [-L - ov, vh, yh]] : [[L + ov, -W - ov, ye], [-L - ov, -W - ov, ye], [-L - ov, -vh, yh], [L + ov, -vh, yh]], u));
      both(u => slab(s > 0 ? [[-L - ov, vh, yh], [L + ov, vh, yh], [L - hk, 0, yr], [-L + hk, 0, yr]] : [[L + ov, -vh, yh], [-L - ov, -vh, yh], [-L + hk, 0, yr], [L - hk, 0, yr]], u));
      both(u => slab(s > 0 ? [[L + ov, vh, yh], [L + ov, -vh, yh], [L - hk, 0, yr]] : [[-L - ov, -vh, yh], [-L - ov, vh, yh], [-L + hk, 0, yr]], u));
    }
    o.gableTop = yh;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
  const uv = new Float32Array(pos.length / 3 * 2); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return { g, yr, rh, ye };
}
// frontone (triangolo o pentagono di muro sopra la gronda), doppia faccia
function archGableGeo(o, s, col, yTop) {
  const P = (u, v, y) => o.along === 'x' ? [o.cx + u, y, o.cz + v] : [o.cx + v, y, o.cz + u], pos = [], c = new THREE.Color(col), cols = [];
  const u = s * (o.L - .02), W = o.Wd - .05, yr = o.top + o.Wd * Math.tan(o.pitch), y2 = yTop ?? yr;
  const pts = y2 < yr - .01 ? [[u, -W, o.top], [u, W, o.top], [u, W * (yr - y2) / (yr - o.top), y2], [u, -W * (yr - y2) / (yr - o.top), y2]] : [[u, -W, o.top], [u, W, o.top], [u, 0, yr]];
  const add = q => { for (const p of q) { pos.push(...P(...p)); cols.push(c.r, c.g, c.b); } };
  for (const rev of [false, true]) { const q = rev ? pts.slice().reverse() : pts; add([q[0], q[1], q[2]]); if (q.length === 4) add([q[0], q[2], q[3]]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
}

// ---------- edificio ----------
// spec: x, z, w (lungo x), d (lungo z), storeys, kind ('pietra'|'intonaco'|'colombage'|'mattoni'), use ('casa'|'fattoria'|'fienile'|'officina'),
//       street ('+z'|'-z'|'+x'|'-x'), roof ('gable'|'hip'|'halfhip'), ridge ('x'|'z'), interior, ruin (0..1), profile
function archHouse(id, spec) {
  const t0 = performance.now(), R_ = archRng(id), PR = ARCH_PROFILE[spec.profile || 'normandy'];
  const kind = spec.kind || 'pietra', W_ = PR.walls[kind === 'colombage' ? 'intonaco' : kind] || PR.walls.pietra, wallCol = R_.pick(W_.cols), t = W_.t, mat = W_.mat;
  const { x: cx, z: cz, w, d } = spec, use = spec.use || 'casa', storeys = spec.storeys || 1, sh = use === 'fienile' ? 4.6 : 3.0;
  let base = 1e9; for (const [px, pz] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2], [cx, cz]]) base = Math.min(base, Hf(px, pz)); base -= .25;
  const top = base + storeys * sh + .25;
  const obj = dzObject(id, 'building', { mat, cx, cz, w, d, base, top, spec, deco: [], floors: [], vis: [] });
  const shutterC = R_.pick(PR.shutters), doorC = R_.pick(PR.door), trim = kind === 'pietra' ? 0xd4ccb4 : PR.trim;
  // facciate: front/back corrono lungo x (z = cz ± d/2), lati lungo z, dentro ai fronti
  const faces = [
    { f: '+z', axis: 'x', fixed: cz + d / 2 - t / 2, a0: cx - w / 2, a1: cx + w / 2, out: 1 },
    { f: '-z', axis: 'x', fixed: cz - d / 2 + t / 2, a0: cx - w / 2, a1: cx + w / 2, out: -1 },
    { f: '+x', axis: 'z', fixed: cx + w / 2 - t / 2, a0: cz - d / 2 + t, a1: cz + d / 2 - t, out: 1 },
    { f: '-x', axis: 'z', fixed: cx - w / 2 + t / 2, a0: cz - d / 2 + t, a1: cz + d / 2 - t, out: -1 },
  ];
  const ridge = spec.ridge || (w >= d ? 'x' : 'z'), gableFaces = ridge === 'x' ? ['+x', '-x'] : ['+z', '-z'];
  const box = (axis, fixed, p0, p1, y0, y1, th) => axis === 'x' ? [p0, y0, fixed - th / 2, p1, y1, fixed + th / 2] : [fixed - th / 2, y0, p0, fixed + th / 2, y1, p1];
  const at = (F, a, off, y) => F.axis === 'x' ? [a, y, F.fixed + F.out * off] : [F.fixed + F.out * off, y, a];   // punto sulla facciata (off verso l'esterno)
  const ry = F => F.axis === 'x' ? 0 : PI / 2;
  const piece = (F, p0, p1, y0, y1, role = 'wall') => { if (p1 - p0 < .08 || y1 - y0 < .08) return null; const s = dzSection(obj, role, mat, ...box(F.axis, F.fixed, p0, p1, y0, y1, t), { vis: W_.vis, col: wallCol }); s.face = F.f; return s; };
  const openings = [];
  for (const F of faces) {
    const L = F.a1 - F.a0, isGable = gableFaces.includes(F.f), isStreet = F.f === spec.street;
    // campate: finestre a intervalli regolari (le facciate normanne sono simmetriche), meno finestre sui frontoni
    const bayW = use === 'fienile' ? 4.5 : 2.7, nb = Math.max(1, Math.floor((L - .8) / bayW)), step = L / nb;
    for (let st = 0; st < storeys; st++) {
      const y0 = st ? base + st * sh : base - .6, y1 = base + (st + 1) * sh + (st === storeys - 1 ? .25 : 0), fl = base + st * sh;
      const ops = [];
      for (let b = 0; b < nb; b++) {
        const c = F.a0 + step * (b + .5);
        if (isGable && nb > 1 && b !== Math.floor(nb / 2) && !(st && R_.chance(.3))) continue;   // frontone: una finestra centrale
        if (st === 0 && isStreet && b === Math.floor(nb / 2)) { const dw = use === 'fienile' ? 3.2 : use === 'officina' ? 2.6 : 1.1, dh = use === 'fienile' ? 3.6 : use === 'officina' ? 2.7 : 2.15; ops.push({ c, w: dw, y0: fl + .02, y1: fl + dh, door: true }); continue; }
        if (use === 'fienile' && !st) { if (R_.chance(.5)) ops.push({ c, w: .7, y0: fl + 2.2, y1: fl + 2.9 }); continue; }
        if (!isStreet && !st && R_.chance(.25)) continue;
        if (st === 0 && !isStreet && !isGable && b === 0 && spec.interior && R_.chance(.6)) { ops.push({ c, w: 1, y0: fl + .02, y1: fl + 2.1, door: true, back: true }); continue; }
        const ww = kind === 'pietra' ? .9 : 1.0, wh = st ? 1.2 : 1.3, sill = st ? .95 : .9;
        ops.push({ c, w: ww, y0: fl + sill, y1: fl + sill + wh });
      }
      // pezzi di muro attorno alle aperture: pilastri fra le aperture, parapetti sotto, architravi sopra
      let cur = F.a0, prevPier = null;
      ops.sort((a, b) => a.c - b.c);
      for (const o of ops) {
        const p0 = o.c - o.w / 2, p1 = o.c + o.w / 2;
        const pier = piece(F, cur, p0, y0, y1); cur = p1;
        const below = o.y0 > y0 + .1 ? piece(F, p0, p1, y0, o.y0) : null, above = piece(F, p0, p1, o.y1, y1);
        o.F = F; o.st = st; o.pier = pier || prevPier; o.below = below; o.above = above; prevPier = pier; openings.push(o);
      }
      const last = piece(F, cur, F.a1, y0, y1);
    }
  }
  // decorazioni delle aperture (legate al pezzo sopra o sotto: cadono con lui)
  for (const o of openings) {
    const F = o.F, link = o.above || o.below || o.pier, fr = .09, dpt = t / 2 - .12, hh = o.y1 - o.y0;
    const D = (vis, col, a, off, y, sx, sy, sz, lk = link, rot = 0) => { const [x, yy, z] = at(F, a, off, y); return F.axis === 'x' ? dzDeco(lk, vis, col, x, yy, z, sx, sy, sz, rot) : dzDeco(lk, vis, col, x, yy, z, sz, sy, sx, rot); };
    if (o.door) {
      D('vc', 0x2a2420, o.c - o.w / 2 + fr / 2, dpt, o.y0, fr, hh, .14); D('vc', 0x2a2420, o.c + o.w / 2 - fr / 2, dpt, o.y0, fr, hh, .14); D('vc', 0x2a2420, o.c, dpt, o.y1 - fr, o.w, fr, .14);
      if (kind !== 'intonaco') D('stone', trim, o.c, t / 2 - .05, o.y1, o.w + .5, .28, .14);
      const open = spec.interior || o.back ? 1 : 0;
      if (open) { const lw = o.w - .1, hx = o.c - o.w / 2 + .05, off = -(t / 2 + lw / 2 + .02); if (F.axis === 'x') dzDeco(link, 'wood', doorC, hx, o.y0, F.fixed + F.out * off, .06, hh - .05, lw); else dzDeco(link, 'wood', doorC, F.fixed + F.out * off, o.y0, hx, lw, hh - .05, .06); o.open = true; }
      else { const [x0, y0_, z0] = at(F, o.c - o.w / 2, 0, o.y0); const b = F.axis === 'x' ? [o.c - o.w / 2 + .02, o.y0, F.fixed - .05, o.c + o.w / 2 - .02, o.y1 - .02, F.fixed + .05] : [F.fixed - .05, o.y0, o.c - o.w / 2 + .02, F.fixed + .05, o.y1 - .02, o.c + o.w / 2 - .02]; const ds = dzSection(obj, 'door', 'legno', ...b, { hpK: .7, vis: 'wood', col: doorC }); ds.face = F.f; }
      continue;
    }
    // finestra: telaio scuro con crociera, vetro scuro arretrato, davanzale, architrave (pietra) o cornice (intonaco), persiane aperte
    D('vc', 0x26221e, o.c, dpt - .02, o.y0, o.w, hh, .04, link);
    D('vc', 0x10141a, o.c, -t / 2 + .25, o.y0, o.w - .1, hh - .05, .02, link);   // vetro / buio della stanza
    D('vc', 0xdedad0, o.c, dpt + .01, o.y0 + hh * .62, o.w, .06, .06, link); D('vc', 0xdedad0, o.c, dpt + .01, o.y0, .06, hh, .06, link);
    D(kind === 'intonaco' || kind === 'colombage' ? 'vc' : 'stone', trim, o.c, t / 2 + .04, o.y0 - .1, o.w + .3, .1, .2, o.below || link);
    if (kind === 'pietra' || kind === 'mattoni') D('stone', trim, o.c, t / 2 + .01, o.y1, o.w + .45, .26, .12, o.above || link);
    else D('vc', trim, o.c, t / 2 + .01, o.y0 - .04, o.w + .2, hh + .12, .03, link);
    if (use !== 'fienile' && R_.chance(.85)) for (const sd of [-1, 1]) { const sw = o.w / 2 + .02; D('vc', shutterC, o.c + sd * (o.w / 2 + sw / 2 + .03), t / 2 + .04, o.y0, sw, hh, .04, o.pier || link); }   // persiane aperte, accostate al muro
  }
  // cantonali in pietra chiara (case in pietra), zoccolo, fascia marcapiano
  const firstPiece = obj.secs[0];
  if (kind === 'pietra' || kind === 'mattoni') for (const [qx, qz] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2]]) {
    const lk = obj.secs.find(s => s.role === 'wall' && Math.abs((s.box[0] + s.box[3]) / 2 - qx) < 1.8 && Math.abs((s.box[2] + s.box[5]) / 2 - qz) < 1.8) || firstPiece;
    for (let y = base, k = 0; y < top - .4; y += .42, k++) { const lx = k % 2 ? .5 : .32, lz = k % 2 ? .32 : .5; dzDeco(lk, 'stone', 0xe0d8c2, qx + (qx > cx ? -lx / 2 + .03 : lx / 2 - .03), y, qz + (qz > cz ? -lz / 2 + .03 : lz / 2 - .03), lx + .02, .4, lz + .02); }
  }
  for (const F of faces) { const [x, yy, z] = at(F, (F.a0 + F.a1) / 2, .02, base - .2); F.axis === 'x' ? dzDeco(obj, 'concrete', 0x8a8478, x, yy, z, F.a1 - F.a0 + .1, .75, t + .06) : dzDeco(obj, 'concrete', 0x8a8478, x, yy, z, t + .06, .75, F.a1 - F.a0 + .1); }
  if (storeys > 1 && kind !== 'colombage') for (const F of faces) for (let st = 1; st < storeys; st++) { const [x, yy, z] = at(F, (F.a0 + F.a1) / 2, .04, base + st * sh - .08); F.axis === 'x' ? dzDeco(obj, kind === 'intonaco' ? 'vc' : 'stone', trim, x, yy, z, F.a1 - F.a0 + .12, .16, t + .1) : dzDeco(obj, kind === 'intonaco' ? 'vc' : 'stone', trim, x, yy, z, t + .1, .16, F.a1 - F.a0 + .12); }
  // graticcio (colombage) sui piani: montanti, traversi e diagonali scuri sulla facciata, legati al pezzo che li regge
  if (kind === 'colombage') for (const F of faces) for (let st = 0; st < storeys; st++) {
    const fl = base + st * sh, L = F.a1 - F.a0;
    const findP = a => obj.secs.find(s => s.face === F.f && s.role === 'wall' && (F.axis === 'x' ? s.box[0] <= a && s.box[3] >= a : s.box[2] <= a && s.box[5] >= a) && s.box[1] <= fl + 1.5 && s.box[4] >= fl + 1.5) || obj;
    const D2 = (a, y, sa, sy, rz = 0) => { const [x, yy, z] = at(F, a, .02, y); F.axis === 'x' ? dzDeco(findP(a), 'wood', PR.timber, x, yy, z, sa, sy, .08, 0, 0, rz) : dzDeco(findP(a), 'wood', PR.timber, x, yy, z, .08, sy, sa, 0, rz * 1, 0); };
    for (let a = F.a0 + .1; a <= F.a1; a += .62) if (!openings.some(o => o.F === F && o.st === st && Math.abs(o.c - a) < o.w / 2 + .1)) D2(a, fl + (st ? 0 : .7), .14, sh - (st ? 0 : .7));
    D2((F.a0 + F.a1) / 2, fl + sh - .16, L, .18); D2((F.a0 + F.a1) / 2, fl + (st ? 0 : .7), L, .16);
  }
  // tetto
  const along = ridge, L = (along === 'x' ? w : d) / 2, Wd = (along === 'x' ? d : w) / 2, pitch = Math.atan(R_.r(...PR.pitch)), roofT = spec.roof || (use === 'fienile' ? 'gable' : R_.pick(['gable', 'gable', 'hip', 'halfhip']));
  const roofCol = R_.pick(R_.chance(.6) ? PR.roofs.ardesia : PR.roofs.coppi);
  const ro = { cx, cz, along, L, Wd, top, pitch, ov: .45, type: roofT, col: roofCol }, RG = archRoofGeo(ro);
  const mb = new MB(); mb.mat = 'roof'; mb.addG(RG.g);
  mb.mat = kind === 'mattoni' ? 'brick' : kind === 'pietra' ? 'stone' : 'plaster';
  if (roofT !== 'hip') for (const s of [-1, 1]) mb.addG(archGableGeo(ro, s, use === 'fienile' && R_.chance(.5) ? 0x6a5236 : wallCol, roofT === 'halfhip' ? ro.gableTop : undefined));
  mb.mat = 'vc';
  const P = (u, v, y) => along === 'x' ? [cx + u, y, cz + v] : [cx + v, y, cz + u];
  { const lr = roofT === 'hip' ? Math.max(.3, L - Wd) : roofT === 'halfhip' ? L - Wd * .38 : L + ro.ov, [x, y, z] = P(0, 0, RG.yr + .02); mb.add(U.box, 0x3a3836, x, y, z, 0, 0, 0, along === 'x' ? lr * 2 + .1 : .3, .14, along === 'x' ? .3 : lr * 2 + .1); }
  for (const s of [-1, 1]) { const [x, y, z] = P(0, s * (Wd + ro.ov - .05), RG.ye - .05); mb.add(U.box, 0x2e2c2a, x, y, z, 0, 0, 0, along === 'x' ? L * 2 + ro.ov * 2 : .12, .12, along === 'x' ? .12 : L * 2 + ro.ov * 2); }   // gronda
  // comignoli sui frontoni (o in mezzo alle falde nei tetti a padiglione)
  mb.mat = kind === 'mattoni' ? 'brick' : 'stone';
  const nch = use === 'fienile' ? 0 : R_.chance(.7) ? 2 : 1;
  for (let k = 0; k < nch; k++) { const s = k ? -1 : 1, u = roofT === 'hip' ? s * Math.max(.4, L - Wd - .2) : s * (L - .45), v = roofT === 'hip' ? 0 : R_.r(-.4, .4), hh = RG.yr - top + 1.1, [x, y, z] = P(u, v, top + hh / 2 - .3); mb.add(U.box, kind === 'mattoni' ? 0x9a6650 : wallCol, x, y, z, 0, 0, 0, .9, hh, .7); const [x2, y2, z2] = P(u, v, top + hh - .3); mb.add(U.box, 0x6a645a, x2, y2 + .06, z2, 0, 0, 0, 1.05, .12, .85); }
  const vis = groupMesh(mb.buildGroups()); scene.add(vis); obj.vis.push(vis);
  // collider del tetto: blocca vista e colpi sopra i muri, crolla con l'edificio
  dzSection(obj, 'hidden', 'legno', cx - w / 2, top, cz - d / 2, cx + w / 2, top + RG.rh * .6, cz + d / 2, { hpK: 4 });
  // interni: pavimento, solaio con vano scala, scala (rampa percorribile), mobili essenziali; coperture alle finestre del piano terra
  const flr = (x0, x1, z0, z1, y, ramp) => { const f = { x0, x1, z0, z1, y, ramp }; FLOORS.push(f); obj.floors.push(f); return f; };
  if (spec.interior) {
    const ix0 = cx - w / 2 + t, ix1 = cx + w / 2 - t, iz0 = cz - d / 2 + t, iz1 = cz + d / 2 - t;
    flr(ix0, ix1, iz0, iz1, base + .05); dzDeco(obj, 'wood', 0x7a6248, cx, base - .1, cz, ix1 - ix0, .15, iz1 - iz0);
    if (storeys > 1) {
      // vano scala lungo il muro posteriore (lato opposto alla strada), la rampa sale lungo x
      const back = spec.street === '+z' ? -1 : 1, sz0 = back > 0 ? iz1 - 1.15 : iz0, sz1 = back > 0 ? iz1 : iz0 + 1.15, sx0 = ix0 + .2, sx1 = sx0 + 3.8, fy = base + sh;
      flr(sx0, sx1, sz0, sz1, 0, { axis: 'x', c0: sx0, c1: sx1, y0: base + .05, y1: fy + .12 });
      for (let i = 0; i < 14; i++) { const k = (i + .5) / 14, x = sx0 + (sx1 - sx0) * k; dzDeco(obj, 'wood', 0x6a5238, x, base + .05, (sz0 + sz1) / 2, (sx1 - sx0) / 14 + .02, (fy - base) * k, sz1 - sz0); }
      // solaio (due lastre attorno al vano), percorribile; collider sottile che non disturba chi sta sotto
      for (const [a0, a1, b0, b1] of [[ix0, ix1, back > 0 ? iz0 : sz1, back > 0 ? sz0 : iz1], [sx1, ix1, sz0, sz1]]) { if (a1 - a0 < .2 || b1 - b0 < .2) continue; const f = flr(a0, a1, b0, b1, fy + .12); f.sol = addSolid(a0, fy - .12, b0, a1, fy + .12, b1, 'floor'); f.sol.walk = true; f.sol.mat = 'legno'; dzDeco(obj, 'wood', 0x6e563c, (a0 + a1) / 2, fy - .12, (b0 + b1) / 2, a1 - a0, .24, b1 - b0); }
      // letto e armadio al piano di sopra
      dzDeco(obj, 'wood', 0x5a4632, ix1 - 1.2, fy + .12, cz, 1.9, .55, 1.4); dzDeco(obj, 'vc', 0xc8c0b0, ix1 - 1.2, fy + .67, cz, 1.8, .12, 1.3); dzDeco(obj, 'wood', 0x4a3828, ix1 - .4, fy + .12, cz - (iz1 - iz0) / 2 + .5, .6, 1.9, 1.1);
    }
    // tavolo, sedie, credenza al piano terra
    dzDeco(obj, 'wood', 0x6a5238, cx + 1, base + .05, cz, 1.6, .78, .9); for (const s of [-1, 1]) dzDeco(obj, 'wood', 0x5a4430, cx + 1 + s * .5, base + .05, cz + s * .75, .42, .9, .42); dzDeco(obj, 'wood', 0x4a3828, cx - w / 2 + t + .3, base + .05, cz + (spec.street === '+z' ? d / 2 - t - 1.2 : -d / 2 + t + 1.2), .5, 1.8, 1.6);
    for (const o of openings) if (!o.door && o.st === 0) { const [x, , z] = at(o.F, o.c, -t / 2 - .7, 0); dzCover(o.below || o.pier, x, z, 'house'); }
  }
  // coperture all'esterno, agli spigoli
  for (const [qx, qz] of [[cx - w / 2 - 1, cz + d / 2 + 1], [cx + w / 2 + 1, cz + d / 2 + 1], [cx - w / 2 - 1, cz - d / 2 - 1], [cx + w / 2 + 1, cz - d / 2 - 1]]) dzCover(obj.secs.find(s => s.role === 'wall' && Math.hypot((s.box[0] + s.box[3]) / 2 - qx, (s.box[2] + s.box[5]) / 2 - qz) < 4) || obj.secs[0], qx, qz, 'house');
  // rovina (deterministica): parte delle sezioni già distrutte, tetto caduto, fumo
  if (spec.ruin) {
    DZ.restoring = true; try {
      const walls = obj.secs.filter(s => s.role === 'wall' || s.role === 'door'), n = Math.floor(walls.length * Math.min(.45, spec.ruin));
      const upper = walls.filter(s => s.box[1] > base + .5).sort((a, b) => R_.f() - .5), lower = walls.filter(s => s.box[1] <= base + .5).sort((a, b) => R_.f() - .5);
      for (const s of upper.concat(lower).slice(0, n)) { dzSetState(s, 2, { quiet: true }); if (R_.chance(.75)) dzSetState(s, 3, { quiet: true }); }
      for (const s of walls.slice(0, Math.floor(walls.length * .3))) if (s.state < 1) dzSetState(s, 1, { quiet: true });
      for (const m of obj.vis) m.visible = false; for (const s of obj.secs) if (s.role === 'hidden' && s.state < 3) { s.state = 2; dzSetState(s, 3, { quiet: true }); }
      for (let i = 0; i < 14; i++) dzRubble(cx + R_.r(-w / 2, w / 2), base + .2, cz + R_.r(-d / 2, d / 2), R_.r(.4, 1.1), DZ_MAT[mat].rub);
      for (let i = 0; i < 4; i++) dzDeco(obj, 'wood', 0x221a14, cx + R_.r(-w / 3, w / 3), base + R_.r(.3, 1.5), cz + R_.r(-d / 3, d / 3), .22, .22, R_.r(2.5, 4.5), R_.r(0, 3), R_.r(-.6, .6), R_.r(-.4, .4));
      if (R_.chance(.6)) { const e = addEmitter(new V3(cx + R_.r(-1.5, 1.5), base + .5, cz + R_.r(-1.5, 1.5)), R_.chance(.4) ? 'fire' : 'smoke', .6); }
    } finally { DZ.restoring = false; }
  }
  ARCH.st.houses++; ARCH.st.secs += obj.secs.length; ARCH.st.ms += performance.now() - t0;
  return obj;
}
// muro di cinta con varco (cancello) per cortili: pezzi di muro distruttibili, pilastri del cancello
function archYardWall(id, pts, h = 1.3, gateAt = -1) {
  const objs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    if (i === gateAt) { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, g = 1.9;
      objs.push(dzWall(id + '_' + i + 'a', x0, z0, mx - ux * g, mz - uz * g, h, 'pietra', { type: 'wall', cover: true }), dzWall(id + '_' + i + 'b', mx + ux * g, mz + uz * g, x1, z1, h, 'pietra', { type: 'wall', cover: true }));
      for (const s of [-1, 1]) { const px = mx + ux * g * s, pz = mz + uz * g * s; dzDeco(null, 'stone', 0xc4baa0, px, Hf(px, pz) - .2, pz, .6, h + .9, .6); }
      continue; }
    objs.push(dzWall(id + '_' + i, x0, z0, x1, z1, h, 'pietra', { type: 'wall', cover: true }));
  }
  return objs;
}
