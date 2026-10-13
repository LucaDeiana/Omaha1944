"use strict";
// ============================================================
//  La città normanna dietro la costa: isolati di case a schiera,
//  chiesa, piazza del mercato, viali, macerie. Gli edifici crollano
//  sotto bombe e granate navali.
// ============================================================
const CITY = { x0: -440, x1: 440, z0: -770, z1: -380, chunks: [], houses: [], y: 0, sq: new V3(0, 0, -575) };
const cityIn = (x, z) => x > CITY.x0 - 40 && x < CITY.x1 + 40 && z > CITY.z0 - 40 && z < CITY.z1 + 40;

// appiattisce il terreno della città (chiamata da H)
function cityFlat(x, z, y) {
  if (!cityIn(x, z)) return y;
  const m = smooth(Math.min((x - CITY.x0 + 40) / 40, (CITY.x1 + 40 - x) / 40, (z - CITY.z0 + 40) / 40, (CITY.z1 + 40 - z) / 40));
  return lerp(y, CITY.y, m);
}
const STONE = [0xc8bfa8, 0xbdb39b, 0xd2c9b2, 0xb0a68e, 0xc4b79a], PLASTER = [0xd9cfb8, 0xe0d6be, 0xcfc3a5], BRICK = [0x8e5a44, 0x9a6650, 0x7e4e3a];
const ROOFC = [0x5f646b, 0x6a6f76, 0x7a5a48, 0x6e4c3c, 0x585c62];

// geometria di una casa (facciata verso face = ±1 lungo z); restituisce i solidi da creare
function cityHouseGeo(mb, h, ruined) {
  const { cx, cz, w, d, ht, face, style, base } = h, top = base + ht, fz = cz + face * d / 2;
  const wall = style === 2 ? pick(BRICK) : style === 1 ? pick(PLASTER) : pick(STONE), storeys = Math.max(1, Math.round((ht - 1) / 3.1));
  if (!ruined) {
    mb.mat = style === 2 ? 'brick' : style === 1 ? 'plaster' : 'stone';
    mb.add(U.box, wall, cx, base + ht / 2, cz, 0, 0, 0, w, ht, d);
    mb.mat = 'concrete'; mb.add(U.box, 0x8a8478, cx, base + .35, cz, 0, 0, 0, w + .08, .7, d + .08);
    for (let s = 1; s < storeys; s++) mb.add(U.box, 0xa49c8a, cx, base + s * 3.1 + .2, fz + face * .04, 0, 0, 0, w + .04, .14, .1);
    // graticcio normanno
    if (style === 1) { mb.mat = 'wood'; for (let s = 0; s < storeys; s++) { const y0 = base + .8 + s * 3.1; mb.add(U.box, 0x3a2a1e, cx, y0 + 2.6, fz + face * .05, 0, 0, 0, w, .16, .06); for (let x = -w / 2 + .3; x <= w / 2; x += 1.3) mb.add(U.box, 0x3a2a1e, cx + x, y0 + 1.3, fz + face * .05, 0, 0, 0, .14, 2.6, .06); mb.add(U.box, 0x3a2a1e, cx - w / 4, y0 + 1.3, fz + face * .05, 0, 0, .65, .12, 3, .05); mb.add(U.box, 0x3a2a1e, cx + w / 4, y0 + 1.3, fz + face * .05, 0, 0, -.65, .12, 3, .05); } }
    // tetto, comignoli, abbaini, grondaie
    mb.mat = 'roof'; const rc = pick(ROOFC);
    mb.add(U.prism, rc, cx, top, cz, 0, PI / 2, 0, d + .8, d * .55, w + .5);
    mb.add(U.box, 0x3a3d40, cx, top + .02, fz + face * .4, 0, 0, 0, w + .5, .12, .18);
    mb.mat = 'stone';
    for (const sx of [-1, 1]) if (R() < .8) { mb.add(U.box, wall, cx + sx * (w / 2 - .6), top + d * .35, cz - face * d * .1, 0, 0, 0, .8, d * .55 + 1.2, .7); mb.add(U.box, 0x6a5a4a, cx + sx * (w / 2 - .6), top + d * .63 + .65, cz - face * d * .1, 0, 0, 0, .9, .14, .8); }
    if (w > 7 && R() < .6) { mb.mat = 'roof'; mb.add(U.box, wall, cx, top + d * .14, fz - face * d * .18, 0, 0, 0, 1.4, 1.3, 1); mb.add(U.prism, rc, cx, top + d * .14 + .65, fz - face * d * .18, 0, PI / 2, 0, 1.3, .8, 1.6); mb.mat = 'vc'; mb.add(U.box, 0x141518, cx, top + d * .14, fz - face * (d * .18 - .51), 0, 0, 0, .7, .8, .03); }
    // finestre con persiane e davanzali
    mb.mat = 'vc';
    const shop = storeys > 1 && R() < .45;
    for (let s = 0; s < storeys; s++) for (let x = -w / 2 + 1.3; x < w / 2 - .7; x += 2.2) {
      if (s === 0 && shop) continue;
      const y = base + 1.9 + s * 3.1, z = fz + face * .06, lit = R() < .03;
      mb.add(U.box, lit ? 0x5a4a28 : 0x141619, cx + x, y, z, 0, 0, 0, .9, 1.35, .06);
      mb.add(U.box, 0xd6d0c0, cx + x, y - .74, z + face * .06, 0, 0, 0, 1.1, .1, .18);
      mb.add(U.box, 0x6a5a48, cx + x, y, z + face * .02, 0, 0, 0, .05, 1.3, .04); mb.add(U.box, 0x6a5a48, cx + x, y + .2, z + face * .02, 0, 0, 0, .9, .05, .04);
      const sh = pick([0x3d4a3a, 0x4a5a6a, 0x5e4836, 0x6a6a5e]), open = R();
      if (open < .7) { mb.add(U.box, sh, cx + x - .72, y, z + face * .03, 0, face * (open < .35 ? .9 : .1), 0, .48, 1.35, .04); mb.add(U.box, sh, cx + x + .72, y, z + face * .03, 0, -face * (open < .35 ? .9 : .1), 0, .48, 1.35, .04); }
      if (s > 0 && R() < .12) { mb.add(U.box, 0x2a2a2a, cx + x, y - .7, z + face * .45, 0, 0, 0, 1.3, .06, .8); for (let k = -2; k <= 2; k++) mb.add(U.box, 0x1e1e1e, cx + x + k * .3, y - .35, z + face * .82, 0, 0, 0, .03, .7, .03); }
    }
    if (shop) {
      mb.add(U.box, 0x1a1c1e, cx, base + 1.7, fz + face * .05, 0, 0, 0, w - 1.6, 2, .06);
      mb.add(U.box, pick([0x3a4a3a, 0x5a2a22, 0x2a3a5a, 0x4a3a2a]), cx, base + 3, fz + face * .08, 0, 0, 0, w - 1, .6, .1);
      mb.add(U.box, pick([0x7a3a30, 0x3a5a3a, 0x8a7a50]), cx, base + 2.6, fz + face * .7, -face * .45, 0, 0, w - 1.2, .05, 1.4);
    }
    mb.add(U.box, 0x3e2c1e, cx + (shop ? w / 2 - .7 : 0), base + 1.25, fz + face * .07, 0, 0, 0, 1.1, 2.2, .08);
    mb.mat = 'concrete'; mb.add(U.box, 0x8a8478, cx + (shop ? w / 2 - .7 : 0), base + .08, fz + face * .4, 0, 0, 0, 1.4, .16, .5);
    return [[cx - w / 2, base, cz - d / 2, cx + w / 2, top + d * .5, cz + d / 2, 'house']];
  }
  // rovina: muri spezzati, travi carbonizzate, solai pendenti, macerie
  const t = .5, sol = [], segH = [];
  const walls = [[cx, cz - d / 2 + t / 2, w, t], [cx, cz + d / 2 - t / 2, w, t], [cx - w / 2 + t / 2, cz, t, d], [cx + w / 2 - t / 2, cz, t, d]];
  mb.mat = style === 2 ? 'brick' : 'stone';
  walls.forEach(([wx, wz, ww, wd], wi) => {
    const len = Math.max(ww, wd), along = ww > wd, n = Math.max(3, Math.round(len / 1.1));
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const f = -len / 2 + (i + .5) * len / n;
      if (wi === (face > 0 ? 1 : 0) && Math.abs(f) < 1) continue;
      const sh = Math.max(.6, ht * (R() < .25 ? rnd(.1, .35) : rnd(.45, 1)) * (1 - Math.abs(f) / len * .6)); sum += sh;
      mb.add(U.box, wall, wx + (along ? f : 0), base + sh / 2, wz + (along ? 0 : f), 0, 0, 0, along ? len / n + .02 : t, sh, along ? t : len / n + .02);
      if (R() < .3) mb.add(U.box, 0x2a2826, wx + (along ? f : 0), base + sh - .1, wz + (along ? 0 : f), 0, 0, 0, along ? len / n : t + .02, .2, along ? t + .02 : len / n);
    }
    segH.push(base + sum / n);
    sol.push([wx - ww / 2, base, wz - wd / 2, wx + ww / 2, base + sum / n, wz + wd / 2, 'ruin']);
  });
  mb.mat = 'wood';
  for (let i = 0; i < 8; i++) mb.add(U.box, 0x1e1712, cx + rnd(-w / 3, w / 3), base + rnd(.5, ht * .6), cz + rnd(-d / 3, d / 3), rnd(-.9, .9), R() * 3, rnd(-.6, .6), .22, .22, rnd(2.5, 5));
  if (storeys > 1) { mb.mat = 'concrete'; mb.add(U.box, 0x6a645a, cx + rnd(-1, 1), base + 3.1, cz, rnd(-.3, .3), 0, rnd(-.35, .35), w * .6, .25, d * .6); }
  mb.mat = 'stone';
  for (let i = 0; i < 22; i++) mb.add(U.ico, R() < .5 ? wall : 0x8a8478, cx + rnd(-w / 2 - 1.5, w / 2 + 1.5), base + .2, cz + rnd(-d / 2 - 1.5, d / 2 + 1.5), R() * 3, R() * 3, 0, rnd(.4, 1.5), rnd(.3, .9), rnd(.4, 1.5));
  return sol;
}
function cityChunkBuild(c) {
  if (c.mesh) { scene.remove(c.mesh); c.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const mb = new MB(); for (const h of c.houses) mb.parts.push(...h.parts); for (const p of c.extra) mb.parts.push(p);
  c.mesh = groupMesh(mb.buildGroups()); scene.add(c.mesh);
}
function cityHouse(chunk, cx, cz, w, d, ht, face, ruined) {
  const h = { cx, cz, w, d, ht, face, style: R() < .35 ? 1 : R() < .25 ? 2 : 0, base: CITY.y - .2, hp: w * d * ht * 4.5, ruined, solids: [], chunk };
  const mb = new MB(); h.sol = cityHouseGeo(mb, h, ruined); h.parts = mb.parts;
  h.solids = h.sol.map(s => addSolid(...s));
  if (ruined && R() < .4) addEmitter(new V3(cx + rnd(-2, 2), h.base + 1, cz + rnd(-2, 2)), R() < .5 ? 'smoke' : 'fire', .7);
  addCover(cx - w / 2 + 1, cz + face * (d / 2 + 1), ruined ? 'ruin' : 'house'); addCover(cx + w / 2 - 1, cz + face * (d / 2 + 1), ruined ? 'ruin' : 'house');
  chunk.houses.push(h); CITY.houses.push(h);
}
// un'esplosione abbastanza potente fa crollare la casa
function cityBlast(p, radius, dmg) {
  if (!cityIn(p.x, p.z) || radius < 4) return;
  for (const h of CITY.houses) {
    if (h.ruined) continue;
    const dx = Math.max(0, Math.abs(p.x - h.cx) - h.w / 2), dz = Math.max(0, Math.abs(p.z - h.cz) - h.d / 2);
    if (dx > radius || dz > radius) continue;
    h.hp -= dmg * (1 - Math.hypot(dx, dz) / (radius + 1)) * (radius >= 8 ? 3 : 1);
    if (h.hp > 0) continue;
    h.ruined = true; for (const s of h.solids) s.on = false;
    const mb = new MB(); h.parts = (h.sol = cityHouseGeo(mb, h, true), mb.parts); h.solids = h.sol.map(s => addSolid(...s));
    const c = new V3(h.cx, h.base + h.ht * .5, h.cz);
    fxExplosion(c, 2.5, false); fxDebris(c, 40, 3); sfxBoom(c, 2.6);
    for (let i = 0; i < 10; i++) PS_SMOKE.emit(h.cx + rnd(-h.w / 2, h.w / 2), h.base + rnd(1, h.ht), h.cz + rnd(-h.d / 2, h.d / 2), rnd(-2, 2), rnd(1, 4), rnd(-2, 2), rnd(6, 10), 3, 9, .62, .58, .52, .7, .5, -.05);
    addEmitter(new V3(h.cx, h.base + 1.5, h.cz), 'smoke', 1.3).life = 80;
    for (const s of allies.concat(enemies)) if (s.alive && Math.abs(s.pos.x - h.cx) < h.w / 2 + 1 && Math.abs(s.pos.z - h.cz) < h.d / 2 + 1) s.die(c, false, 'blast', { blast: c, power: 6 });
    if (P.mode === 'foot' && P.pos.distanceTo(c) < 60) { P.shake += .8; muffle(1.6); }
    cityChunkBuild(h.chunk);
  }
}
function buildCity() {
  const blkW = 52, blkD = 46, street = 12;
  const xs = [], zs = [];
  for (let x = CITY.x0; x + blkW <= CITY.x1; x += blkW + street) xs.push(x);
  for (let z = CITY.z1; z - blkD >= CITY.z0; z -= blkD + street) zs.push(z);
  const sq = CITY.sq;
  for (const bx of xs) for (const bz of zs) {
    const cx = bx + blkW / 2, cz = bz - blkD / 2;
    if (Math.abs(cx - sq.x) < 60 && Math.abs(cz - sq.z) < 50) continue; // piazza
    if (Math.abs(cx - roadPathX(cz)) < blkW / 2 + 6) continue; // viale principale
    const chunk = { houses: [], extra: [], mesh: null }; CITY.chunks.push(chunk);
    const damage = clamp(.15 + (bz > -480 ? .45 : 0) + (vnoise(cx * .01, cz * .01) - .5) * .4, 0, .85);
    for (const face of [1, -1]) {
      let x = bx + .2;
      while (x < bx + blkW - 4) {
        const w = Math.min(rnd(6, 10.5), bx + blkW - x), d = rnd(8, 11), ht = pick([6.5, 7, 9.6, 9.6, 12.7, 12.7, 15.8]);
        if (w < 4) break;
        const hz = face > 0 ? bz - d / 2 - .2 : bz - blkD + d / 2 + .2;
        cityHouse(chunk, x + w / 2, hz, w, d, ht, face, R() < damage);
        x += w + (R() < .08 ? rnd(2, 4) : 0);
      }
    }
    // cortili interni: muri di cinta, orti, carretti
    const mb = new MB(); mb.mat = 'stone';
    for (const sx of [-1, 1]) mb.add(U.box, pick(STONE), cx + sx * (blkW / 2 - .3), CITY.y + .9, cz, 0, 0, 0, .5, 1.8, blkD - 22);
    mb.mat = 'wood'; if (R() < .6) { const ux = cx + rnd(-10, 10), uz = cz + rnd(-5, 5); mb.add(U.box, 0x5a4632, ux, CITY.y + .8, uz, 0, R() * 3, 0, 1.4, .5, 2.4); for (const s of [-1, 1]) mb.add(U.cyl12, 0x3a2a1e, ux + s * .8, CITY.y + .6, uz, 0, 0, PI / 2, .6, .1, .6); }
    chunk.extra = mb.parts;
    cityChunkBuild(chunk);
  }
  cityStreets();
  cityChurch();
  buildDepot();
}
// deposito di carburante e munizioni dei camion: distrutto, i rinforzi si fermano
function buildDepot() {
  const x = roadPathX(-560) + 16, z = -560, y = CITY.y, mb = new MB();
  mb.mat = 'paint'; for (let i = 0; i < 26; i++) mb.add(U.cyl12, pick([0x4a5038, 0x5a4a30, 0x3a3e30]), x + rnd(-5, 5), y + .45 + (i > 18 ? .9 : 0), z + rnd(-4, 4), 0, 0, 0, .3, .9, .3);
  mb.mat = 'wood'; for (let i = 0; i < 12; i++) mb.add(U.box, 0x5a4a32, x + rnd(-6, 6), y + .35 + (i % 3) * .6, z + rnd(-5, 5), 0, R() * 3, 0, 1.2, .6, .8);
  mb.mat = 'sack'; mb.add(U.prism, 0x5a5a44, x - 8, y, z, 0, 0, 0, 6, 3.2, 8);
  const g = groupMesh(mb.buildGroups()); scene.add(g);
  WORLD.depot = { pos: new V3(x, y, z), g, destroyed: false, hp: 900 };
  addSolid(x - 6, y, z - 5, x + 6, y + 1.6, z + 5, 'sand'); addCover(x, z + 6, 'sand');
}
function depotBlast(p, radius, dmg) {
  const d = WORLD.depot; if (!d || d.destroyed) return;
  const dist = Math.hypot(p.x - d.pos.x, p.z - d.pos.z); if (dist > radius + 6) return;
  d.hp -= dmg * (1 - dist / (radius + 6)) * 1.5; if (d.hp > 0) return;
  d.destroyed = true; burnMeshes(d.g); CONVOY.stop = true;
  for (let i = 0; i < 6; i++) after(i * .4, () => { const q = d.pos.clone().add(new V3(rnd(-5, 5), 1, rnd(-4, 4))); fxExplosion(q, 3, false); sfxBoom(q, 3); });
  addEmitter(d.pos.clone().add(new V3(0, 1, 0)), 'fire', 2).life = 300; addEmitter(d.pos.clone().add(new V3(0, 4, 0)), 'smoke', 2.2).life = 400;
  feed('Deposito dei rinforzi tedeschi distrutto!'); if (P.mode === 'foot') say(PT === 'A' ? N.radio : NA.funk, PT === 'A' ? 'Il deposito è saltato: niente più camion di rinforzi!' : 'Il deposito è perduto! Niente più rinforzi dalla città!');
}
// strade: lampioni, pali del telegrafo, barricate, crateri, relitti, alberi dei viali
function cityStreets() {
  const S = new MB(), y = CITY.y;
  S.mat = 'cobble'; S.add(U.box, 0x9a958a, (CITY.x0 + CITY.x1) / 2, y - .02, (CITY.z0 + CITY.z1) / 2, 0, 0, 0, CITY.x1 - CITY.x0 + 40, .12, CITY.z1 - CITY.z0 + 40);
  for (let x = CITY.x0; x < CITY.x1; x += 3) for (let z = CITY.z1 + 6; z > CITY.z0; z -= 58) { if (R() < .5) continue; S.mat = 'concrete'; S.add(U.box, 0x8a857a, x, y + .06, z, 0, 0, 0, 3, .12, 1.2); }
  for (let i = 0; i < 160; i++) {
    const x = rnd(CITY.x0, CITY.x1), z = CITY.z1 + 6 - Math.floor(R() * 7) * 58 + rnd(-4, 4);
    const k = R();
    if (k < .3) { S.mat = 'paint'; S.add(U.cyl, 0x2a2a2a, x, y + 2.2, z, 0, 0, 0, .06, 4.4, .06); S.add(U.box, 0x2a2a2a, x, y + 4.4, z + .35, 0, 0, 0, .08, .08, .8); S.mat = 'vc'; S.add(U.box, 0xe8e0c0, x, y + 4.25, z + .7, 0, 0, 0, .25, .25, .25); }
    else if (k < .45) { S.mat = 'wood'; S.add(U.cyl, 0x4a3a2a, x, y + 4, z, rnd(-.05, .05), 0, rnd(-.05, .05), .1, 8, .1); S.add(U.box, 0x4a3a2a, x, y + 7.6, z, 0, 0, 0, 1.6, .1, .1); }
    else if (k < .6) { sandbagLine(S, x - 3, z, x + 3, z + rnd(-1, 1), 3); addCover(x, z + 1, 'sand'); addSolid(x - 3, y - .5, z - .4, x + 3, y + 1, z + .4, 'sand'); }
    else if (k < .72) { S.mat = 'wood'; for (let j = 0; j < 6; j++) S.add(U.box, 0x2a201a, x + rnd(-2, 2), y + .3, z + rnd(-2, 2), rnd(-.4, .4), R() * 3, rnd(-.3, .3), .2, .2, rnd(1.5, 3.5)); }
    else if (k < .8) { S.mat = 'paint'; S.add(U.box, 0x6a5a48, x, y + .9, z, rnd(-.1, .1), R() * 3, rnd(-.2, .2), 1.8, 1.4, 4); S.add(U.box, 0x2a2826, x, y + 1.7, z, 0, R() * 3, 0, 1.6, .5, 1.8); addSolid(x - 1.8, y, z - 2, x + 1.8, y + 1.8, z + 2, 'tank'); addCover(x, z + 2.6, 'tank'); if (R() < .4) addEmitter(new V3(x, y + 1.5, z), 'fire', .6); }
    else { S.mat = 'stone'; for (let j = 0; j < 10; j++) S.add(U.ico, pick(STONE), x + rnd(-3, 3), y + .3, z + rnd(-2, 2), R() * 3, R() * 3, 0, rnd(.5, 1.6), rnd(.3, .9), rnd(.5, 1.6)); addCover(x, z + 2, 'ruin'); }
  }
  for (let z = CITY.z1; z > CITY.z0; z -= 14) for (const s of [-1, 1]) { const x = roadPathX(z) + s * 9; if (R() < .85) addTree(S, x, z, rnd(.8, 1.1)); }
  scene.add(groupMesh(S.buildGroups()));
}
// chiesa con campanile sulla piazza del mercato, fontana, mercato coperto
function cityChurch() {
  const S = new MB(), y = CITY.y, c = CITY.sq, cz = c.z - 30;
  S.mat = 'stone';
  S.add(U.box, 0xbdb39b, c.x, y + 7, cz, 0, 0, 0, 14, 14, 30); S.mat = 'roof'; S.add(U.prism, 0x585c62, c.x, y + 14, cz, 0, 0, 0, 15, 7, 31);
  S.mat = 'stone'; S.add(U.box, 0xc4b79a, c.x, y + 14, cz + 17, 0, 0, 0, 7, 28, 7); S.mat = 'roof'; S.add(U.cone, 0x4a4e54, c.x, y + 34, cz + 17, 0, PI / 4, 0, 5.2, 12, 5.2);
  S.mat = 'vc'; for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) S.add(U.box, 0x1a1c22, c.x + sx * 7.05, y + 7, cz - 10 + k * 6, 0, 0, 0, .08, 6, 1.6);
  S.add(U.box, 0x1a1c22, c.x, y + 24, cz + 20.55, 0, 0, 0, 1.6, 3, .08); S.add(U.cyl12, 0xe8e0d0, c.x, y + 19, cz + 20.56, PI / 2, 0, 0, 1.1, .05, 1.1);
  addSolid(c.x - 7, y, cz - 15, c.x + 7, y + 18, cz + 15, 'house'); addSolid(c.x - 3.5, y, cz + 13.5, c.x + 3.5, y + 28, cz + 20.5, 'house');
  S.mat = 'stone'; S.add(U.cyl12, 0xb0a68e, c.x, y + .5, c.z + 12, 0, 0, 0, 3, 1, 3); S.add(U.cyl12, 0x9a9282, c.x, y + 1.6, c.z + 12, 0, 0, 0, .5, 2.2, .5); addSolid(c.x - 3, y, c.z + 9, c.x + 3, y + 1, c.z + 15, 'ruin'); addCover(c.x, c.z + 15.6, 'ruin');
  S.mat = 'wood'; for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) S.add(U.box, 0x4a3a2a, c.x + sx * 28, y + 2.5, c.z - 8 + k * 6, 0, 0, 0, .4, 5, .4);
  S.mat = 'roof'; for (const sx of [-1, 1]) S.add(U.prism, 0x6e4c3c, c.x + sx * 28, y + 5, c.z + 4, 0, PI / 2, 0, 8, 2.5, 28);
  for (let i = 0; i < 14; i++) { S.mat = 'wood'; const sx = R() < .5 ? -1 : 1; S.add(U.box, pick([0x5a4632, 0x6a5440]), c.x + sx * 28 + rnd(-2, 2), y + .5, c.z + rnd(-8, 16), 0, R() * 3, 0, rnd(.6, 1.4), rnd(.5, 1), rnd(.6, 1.4)); }
  scene.add(groupMesh(S.buildGroups()));
  WORLD.cityTower = new V3(c.x, y + 25, cz + 17);
}
