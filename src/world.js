"use strict";
// ============================================================
//  Mondo: terreno, acqua, spiaggia, scogliera, trincee, bunker,
//  siepi, batteria, villaggio, navi, aerei, mezzi da sbarco
// ============================================================
const DRAW_X = -30, BREACH_X = -30, WIRE_Z = -62.5, BANK_Z = -57.5, WATER_Y = .3;
const SQUARE = new V3(12, 0, -283);
const solids = [], covers = [], mines = [], OBST = [];
const MINEFIELDS = [[18, 112, -84, -66], [-165, -88, -82, -66]];
const HEDGES = [{ z: -170, gaps: [[-40, -20], [55, 68]] }, { z: -218, gaps: [[-40, -20], [-125, -112], [88, 100]] }];
const WORLD = { wireBreached: false, bunkers: [], flaks: [], boats: [], shipGuns: [], planes: [], crates: [], pickups: [], shells: [], bombard: 'bluff', planeT: 20, villageY: 0 };
let waterMat, wireLines = null;

// ---------- crateri (deformano il terreno) ----------
const craters = [], craterGrid = new Map();
const ck = (i, j) => (i + 500) * 2000 + (j + 500);
function addCrater(x, z, r, d) {
  const c = { x, z, r, d }; craters.push(c);
  for (let i = Math.floor((x - r) / 10); i <= Math.floor((x + r) / 10); i++)
    for (let j = Math.floor((z - r) / 10); j <= Math.floor((z + r) / 10); j++) {
      const k = ck(i, j); let a = craterGrid.get(k); if (!a) craterGrid.set(k, a = []); a.push(c);
    }
}
function genCraters() {
  for (let i = 0; i < 70; i++) addCrater(srnd(-190, 190), srnd(-52, -9), srnd(1.8, 3.4), srnd(.35, .7));
  for (let i = 0; i < 45; i++) { const x = srnd(-170, 170), z = srnd(-112, -66); if (Math.abs(z - trenchZ(x)) < 4 || Math.abs(x - BREACH_X) < 6) continue; addCrater(x, z, srnd(2, 4), srnd(.6, 1.1)); }
  for (let i = 0; i < 30; i++) { const x = srnd(-160, 160), z = srnd(-212, -118); if (Math.abs(z + 170) < 5) continue; addCrater(x, z, srnd(2, 4.5), srnd(.6, 1.2)); }
}

// ---------- altezza del terreno (analitica) ----------
function trenchZ(x) { return -90 + 2.2 * Math.sin(x * .11) + 1.3 * Math.sin(x * .031 + 1); }
function roadX(z) { return DRAW_X + 6 * Math.sin(z * .025); }
function roadDist(x, z) {
  let d = 1e9;
  if (z < -64 && z > -292) d = Math.abs(x - roadX(z));
  if (x > -95 && x < 95) d = Math.min(d, Math.abs(z + 281));
  return d;
}
function hedgeH(x, z) {
  let y = 0;
  for (const h of HEDGES) {
    const d = z - h.z;
    if (d > -3.5 && d < 3.5) {
      let g = false; for (const gp of h.gaps) if (x > gp[0] && x < gp[1]) { g = true; break; }
      if (!g) y += 1.2 * Math.exp(-(((d / 1.3)) ** 2));
    }
  }
  return y;
}
function H0(x, z) {
  if (z > 0) return Math.max(-9, -z * .035) + (vnoise(x * .04, z * .04) - .5) * .4;
  let y = Math.min(-z, 64) * .04;
  y += Math.sin(x * .21 + z * .13) * .03 + (vnoise(x * .07, z * .07) - .5) * .3 * smooth(-z / 25);
  y += 1.15 * Math.exp(-(((z - BANK_Z) / 1.7) ** 2));
  const draw = Math.exp(-(((x - DRAW_X) / 26) ** 2));
  const span = 24 + 44 * draw;
  const t = smooth((-61 - z) / span);
  if (t > 0) {
    const top = 13 + 2 * Math.sin(x * .045) + (fbm(x * .02, 3.7, 3) - .5) * 4 - draw * 3;
    y += t * top + t * (1 - t) * 4 * (fbm(x * .11, z * .11, 3) - .5) * 4;
    if (z < -82) { const p = smooth((-82 - z) / 40); y += p * ((fbm(x * .011 + 5, z * .011, 4) - .5) * 8 + (-z - 82) * .008); }
  }
  return y;
}
function H(x, z) {
  let y = H0(x, z);
  if (z > 0) return y;
  if (z < -84 && z > -97 && x > -165 && x < 165) { const d = Math.abs(z - trenchZ(x)); if (d < 1.7) y -= 1.8 * smooth((1.7 - d) / .6); }
  if (z < -160 && z > -225) y += hedgeH(x, z);
  if (z < -235 && z > -345 && x > -120 && x < 120) {
    const m = smooth(Math.min((120 - Math.abs(x - 5)) / 25, (55 - Math.abs(z + 288)) / 18));
    y = lerp(y, WORLD.villageY + (fbm(x * .05, z * .05, 2) - .5) * .4, m);
  }
  const a = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
  if (a) for (const c of a) {
    const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz;
    if (d2 < c.r * c.r) {
      const k = Math.sqrt(d2) / c.r;
      y += k < .72 ? -c.d * (1 - (k / .72) ** 2) : c.d * .35 * Math.sin((k - .72) / .28 * PI);
    }
  }
  return y;
}
function HN(x, z) { const e = .4; return new V3(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize(); }
function waveAmp(z) { return clamp((z + 10) / 60, .12, 1); }
function waveH(x, z, t) {
  const a = waveAmp(z);
  return a * (.32 * Math.sin(.07 * (.1 * x + .995 * z) + 1.1 * t) + .14 * Math.sin(.13 * (-.3 * x + .954 * z) + 1.6 * t + 1.3));
}
function waterLevel(x, z, t) { return WATER_Y + waveH(x, z, t); }
function inMinefield(x, z) { for (const m of MINEFIELDS) if (x > m[0] && x < m[1] && z > m[2] && z < m[3]) return true; return false; }

// ---------- solidi (collisioni e copertura dai proiettili) ----------
function addSolid(x0, y0, z0, x1, y1, z1, tag) {
  const s = { min: new V3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new V3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)), tag, on: true };
  solids.push(s); return s;
}
function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT, t1, t2, s;
  t1 = (b.min.x - ox) / dx; t2 = (b.max.x - ox) / dx; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  t1 = (b.min.y - oy) / dy; t2 = (b.max.y - oy) / dy; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  t1 = (b.min.z - oz) / dz; t2 = (b.max.z - oz) / dz; if (t1 > t2) { s = t1; t1 = t2; t2 = s; }
  if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  return tmin;
}
function raySolids(o, d, maxT) {
  let bt = maxT, bs = null;
  for (const s of solids) { if (!s.on || s.nb) continue; const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s, bt); if (t >= 0 && t < bt) { bt = t; bs = s; } }
  return bs ? { t: bt, s: bs } : null;
}
function rayTerrain(o, d, maxT) {
  let t = .3, pt = 0;
  while (t < maxT) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < H(x, z)) {
      let a = pt, b = t;
      for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (o.y + d.y * m < H(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      return b;
    }
    pt = t; t += Math.max(.35, t * .015);
  }
  return -1;
}
function losClear(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
  if (d < 1) return true;
  const st = Math.max(1.2, d / 70);
  for (let s = st; s < d - .8; s += st) { const k = s / d; if (a.y + dy * k < H(a.x + dx * k, a.z + dz * k)) return false; }
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z), inv = 1 / d;
  for (const s of solids) {
    if (!s.on || s.nb || s.max.x < x0 || s.min.x > x1 || s.max.z < z0 || s.min.z > z1) continue;
    if (rayBox(a.x, a.y, a.z, dx * inv, dy * inv, dz * inv, s, d - .6) >= 0) return false;
  }
  return true;
}
function pushOut(p, r, h = 1.7) {
  for (const s of solids) {
    if (!s.on || p.y + h < s.min.y || p.y > s.max.y - .05) continue;
    if (p.x < s.min.x - r || p.x > s.max.x + r || p.z < s.min.z - r || p.z > s.max.z + r) continue;
    const cx = clamp(p.x, s.min.x, s.max.x), cz = clamp(p.z, s.min.z, s.max.z);
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d > 0) { if (d < r) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; } }
    else {
      const l = p.x - s.min.x, rr = s.max.x - p.x, f = p.z - s.min.z, b = s.max.z - p.z, m = Math.min(l, rr, f, b);
      if (m === l) p.x = s.min.x - r; else if (m === rr) p.x = s.max.x + r; else if (m === f) p.z = s.min.z - r; else p.z = s.max.z + r;
    }
  }
}
function wireBlocks(x) { return x > -205 && x < 205 && (!WORLD.wireBreached || Math.abs(x - BREACH_X) > 3.4); }
function applyWire(p, prev) {
  if (!wireBlocks(p.x)) return;
  if (prev.z >= WIRE_Z && p.z < WIRE_Z + .5) p.z = Math.max(p.z, WIRE_Z + .5);
  else if (prev.z < WIRE_Z && p.z > WIRE_Z - .5) p.z = Math.min(p.z, WIRE_Z - .5);
}
// instradamento dell'IA attraverso varchi (filo spinato, siepi)
const BARRIERS = [
  { z: WIRE_Z, gaps: () => WORLD.wireBreached ? [[BREACH_X - 3, BREACH_X + 3]] : [] },
  { z: -170, gaps: () => HEDGES[0].gaps },
  { z: -218, gaps: () => HEDGES[1].gaps },
  { z: -250, gaps: () => [[-200, -92], [-40, -22], [40, 52], [92, 200]] },
  { z: -332, gaps: () => [[-200, -92], [-38, -20], [32, 48], [92, 200]] },
];
function routeWaypoint(from, dest, out) {
  const bs = BARRIERS.slice().sort((a, b) => Math.abs(from.z - a.z) - Math.abs(from.z - b.z));
  for (const b of bs) {
    if ((from.z - b.z) * (dest.z - b.z) >= 0) continue;
    const side = Math.sign(from.z - b.z), gaps = b.gaps();
    const inGap = gaps.some(g => from.x > g[0] + .4 && from.x < g[1] - .4);
    if (inGap && Math.abs(from.z - b.z) < 3) { out.set(from.x, 0, b.z - side * 3.5); return out; }
    if (!gaps.length) { out.set(dest.x, 0, b.z + side * 3); return out; }
    let best = 0, bd = 1e9;
    for (const g of gaps) { const gx = (g[0] + g[1]) / 2, d = Math.abs(gx - from.x) + Math.abs(gx - dest.x) * .5; if (d < bd) { bd = d; best = gx; } }
    out.set(best + rnd(-.8, .8), 0, b.z + side * 2.4); return out;
  }
  return out.copy(dest);
}
function addCover(x, z, kind) { covers.push({ x, z, kind, occ: 0 }); }

// ---------- texture procedurali ----------
function detailTextures() {
  const S = 256, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = fbm(x / 32, y / 32, 4, 8) * .7 + vnoise(x / 4, y / 4, 64) * .3;
  const mk = fn => { const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), im = g.createImageData(S, S); for (let i = 0; i < S * S; i++) fn(im.data, i); g.putImageData(im, 0, 0); return cv; };
  const dc = mk((d, i) => { const v = 175 + h[i] * 80 + (R() - .5) * 18; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = clamp(v, 0, 255); d[i * 4 + 3] = 255; });
  const nc = mk((d, i) => {
    const x = i % S, y = (i / S) | 0, l = h[y * S + (x + S - 1) % S], r = h[y * S + (x + 1) % S], u = h[((y + S - 1) % S) * S + x], dn = h[((y + 1) % S) * S + x];
    const n = new V3((l - r) * 6, (u - dn) * 6, 1).normalize();
    d[i * 4] = (n.x * .5 + .5) * 255; d[i * 4 + 1] = (n.y * .5 + .5) * 255; d[i * 4 + 2] = (n.z * .5 + .5) * 255; d[i * 4 + 3] = 255;
  });
  const map = new THREE.CanvasTexture(dc), nrm = new THREE.CanvasTexture(nc);
  map.encoding = THREE.sRGBEncoding;
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, nrm };
}

// ---------- terreno ----------
function axisSteps(a0, a1, f) { const r = []; let a = a0; while (a < a1) { r.push(a); a += f(a); } r.push(a1); return r; }
const TC = {};
function terrainColor(x, z, y, out) {
  const n = vnoise(x * .15, z * .15), n2 = fbm(x * .03, z * .03, 3);
  if (z > 1) { out.copy(TC.seabed).lerp(TC.wet, clamp(1 - z / 20, 0, .6)); return out; }
  out.copy(TC.sand).lerp(TC.sand2, n * .6);
  out.lerp(TC.wet, smooth((z + 14) / 12));
  out.lerp(TC.peb, Math.exp(-(((z - BANK_Z) / 2.3) ** 2)) * .85);
  if (z < -59) {
    const sl = Math.abs(H(x, z - 1) - H(x, z + 1)) * .5 + Math.abs(H(x - 1, z) - H(x + 1, z)) * .5;
    const g = TC._g.copy(TC.grass).lerp(TC.grass2, n2);
    if (z < -110) { const f = fbm(x * .009 + 11, z * .009, 3); if (f > .56) g.lerp(TC.field2, smooth((f - .56) / .05) * .8); else if (f < .42) g.lerp(TC.field, .6); }
    g.lerp(TC.dirt, smooth((sl - .45) / .6) * .85);
    out.lerp(g, smooth((-59 - z) / 4));
    const rd = roadDist(x, z); if (rd < 3.2) out.lerp(TC.road, smooth((3.2 - rd) / 1.2) * .9);
    if (z < -84 && z > -97 && x > -165 && x < 165 && Math.abs(z - trenchZ(x)) < 1.8) out.lerp(TC.dirt, .9);
    if (z < -245 && z > -330 && x > -100 && x < 100) out.lerp(TC.road, .25);
  }
  const a = craterGrid.get(ck(Math.floor(x / 10), Math.floor(z / 10)));
  if (a) for (const c of a) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r * 1.2) out.lerp(TC.scorch, (1 - d / (c.r * 1.2)) * .75); }
  return out;
}
function buildTerrain() {
  Object.assign(TC, {
    seabed: col(0x5b5442).clone(), wet: col(0x6c5e47).clone(), sand: col(0xb29d76).clone(), sand2: col(0x9f8a64).clone(), peb: col(0x7e7a70).clone(),
    grass: col(0x5f6e38).clone(), grass2: col(0x7c7a48).clone(), dirt: col(0x6b5a40).clone(), field: col(0x6f7c40).clone(), field2: col(0x8e7d4e).clone(),
    road: col(0x86765a).clone(), scorch: col(0x38332a).clone(), _g: new THREE.Color()
  });
  const s = Q.terrainStep;
  const xs = axisSteps(-460, 460, x => (Math.abs(x) < 185 ? 1.6 : 5) * s);
  const zs = axisSteps(-470, 330, z => (z > -106 && z < -48 ? .85 : z >= -48 && z < 30 ? 1.6 : z <= -106 && z > -340 ? 2.2 : 5) * s);
  const nx = xs.length, nz = zs.length, N = nx * nz;
  const pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), uv = new Float32Array(N * 2), c = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j], y = H(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    terrainColor(x, z, y, c); cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b;
    uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + nx, cc = a + 1, d = b + 1;
    idx[o++] = a; idx[o++] = b; idx[o++] = cc; idx[o++] = cc; idx[o++] = b; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const tx = detailTextures();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: tx.map, normalMap: tx.nrm, normalScale: new THREE.Vector2(.9, .9), roughness: .96, metalness: 0 }));
  m.receiveShadow = true; scene.add(m);
}

// ---------- acqua ----------
function buildWater() {
  waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSunDir: { value: SUN_DIR }, uSky: { value: col(0xa7b1b4) }, uDeep: { value: col(0x22393f) }, uShallow: { value: col(0x5d7a72) },
      uFog: { value: FOG_COL }, uFogD: { value: scene.fog.density }
    },
    vertexShader: `uniform float uTime;varying vec3 vW;varying vec2 vD;varying float vC;
    float amp(float z){return clamp((z+10.)/60.,.12,1.);}
    void main(){vec4 w=modelMatrix*vec4(position,1.);float a=amp(w.z);
      vec2 d1=vec2(.1,.995),d2=vec2(-.3,.954);
      float p1=.07*dot(d1,w.xz)+1.1*uTime,p2=.13*dot(d2,w.xz)+1.6*uTime+1.3;
      float h=a*(.32*sin(p1)+.14*sin(p2));
      vD=a*(.32*.07*cos(p1)*d1+.14*.13*cos(p2)*d2);
      vC=sin(p1)*.5+.5;
      w.y+=h;vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uFogD;uniform vec3 uSunDir,uSky,uDeep,uShallow,uFog;varying vec3 vW;varying vec2 vD;varying float vC;
    float bed(vec2 p){return p.y>0.?max(-9.,-p.y*.035):min(-p.y,64.)*.04;}
    void main(){
      vec2 p=vW.xz;float t=uTime;
      vec3 n=vec3(-vD.x,1.,-vD.y);
      n.x+=.07*sin(p.x*.9+t*1.7+sin(p.y*.5))+.04*sin(p.x*2.3-p.y*1.7+t*2.9)+.02*sin(p.x*6.1+p.y*3.3+t*4.);
      n.z+=.07*sin(p.y*1.1-t*1.9+sin(p.x*.4))+.04*sin(p.y*2.7+p.x*1.3+t*2.3)+.02*sin(p.y*5.7-p.x*4.1+t*3.6);
      n=normalize(n);
      vec3 v=normalize(cameraPosition-vW);
      float fr=.02+.98*pow(1.-max(dot(n,v),0.),5.);
      vec3 r=reflect(-v,n);
      vec3 sky=uSky*mix(.8,1.15,clamp(r.y*2.,0.,1.));
      float depth=vW.y-bed(p);
      vec3 wc=mix(uShallow,uDeep,clamp(depth/5.,0.,1.));
      vec3 c=mix(wc,sky,fr*.9);
      c+=vec3(1.,.88,.7)*pow(max(dot(r,uSunDir),0.),220.)*3.;
      float pat=smoothstep(.35,.9,sin(p.x*.37+t*.9+sin(p.y*.8+t*.5)*2.)*.5+.5+sin(p.x*1.3-p.y*.9-t*1.4)*.25);
      float foam=smoothstep(.45,.0,depth)*pat*.8;
      foam+=smoothstep(.85,.99,vC)*.18*pat*clamp((40.-vW.z)/40.,0.,1.);
      c=mix(c,vec3(.7,.72,.71),clamp(foam,0.,1.)*.7);
      float fd=length(cameraPosition-vW);c=mix(c,uFog,1.-exp(-uFogD*uFogD*fd*fd));
      gl_FragColor=vec4(c,clamp(depth*.9+.18+fr*.6+foam*.5,0.,1.));
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
    transparent: true,
  });
  const g = new THREE.PlaneGeometry(3200, 2300, 320, 230); g.rotateX(-PI / 2);
  const m = new THREE.Mesh(g, waterMat); m.position.set(0, WATER_Y, 1135); m.renderOrder = 1; m.frustumCulled = false;
  scene.add(m);
}

// ---------- mezzo da sbarco LCVP (Higgins boat) ----------
let LCVP_GEO, RAMP_GEO;
function buildBoatGeos() {
  const mb = new MB(), c = 0x5f6b62, d = 0x48524b;
  mb.add(U.box, d, 0, .12, 0, 0, 0, 0, 3.3, .5, 10.2);
  mb.add(U.box, c, -1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2); mb.add(U.box, c, 1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2);
  mb.add(U.box, c, 0, 1.08, 5.05, 0, 0, 0, 3.3, 1.95, .14);
  mb.add(U.box, 0x3d3a33, 0, .42, 0, 0, 0, 0, 3.1, .06, 9.8);
  mb.add(U.box, d, -1.66, 2.06, 0, 0, 0, 0, .24, .08, 10.2); mb.add(U.box, d, 1.66, 2.06, 0, 0, 0, 0, .24, .08, 10.2);
  mb.add(U.box, c, 0, 2.25, 4.4, 0, 0, 0, 1.4, .8, 1.1);
  mb.add(U.cyl, 0x1e1e1e, -1.35, 2.5, 4.2, PI / 2 - .25, 0, 0, .035, 1.1, .035); mb.add(U.cyl, 0x1e1e1e, 1.35, 2.5, 4.2, PI / 2 - .25, 0, 0, .035, 1.1, .035);
  for (let i = -4; i <= 4; i += 2) { mb.add(U.box, d, -1.53, 1, i, 0, 0, 0, .06, 1.8, .12); mb.add(U.box, d, 1.53, 1, i, 0, 0, 0, .06, 1.8, .12); }
  LCVP_GEO = mb.build();
  const rb = new MB();
  rb.add(U.box, 0x56625a, 0, 1, 0, 0, 0, 0, 3.2, 2, .12);
  for (const y of [.35, .8, 1.25, 1.7]) rb.add(U.box, 0x48524b, 0, y, -.09, 0, 0, 0, 3.1, .07, .08);
  RAMP_GEO = rb.build();
}
class Boat {
  constructor(x, z0, speed, stopZ) {
    this.g = new THREE.Group();
    const hull = new THREE.Mesh(LCVP_GEO, MAT.vcMetal); hull.castShadow = hull.receiveShadow = true; this.g.add(hull);
    this.pivot = new THREE.Group(); this.pivot.position.set(0, .25, -5.1); this.g.add(this.pivot);
    const ramp = new THREE.Mesh(RAMP_GEO, MAT.vcMetal); ramp.castShadow = true; this.pivot.add(ramp);
    this.x = x; this.z = z0; this.speed = speed; this.stopZ = stopZ; this.state = 'move'; this.ramp = 0; this.ph = R() * 10; this.sinkT = 0; this.y = 0;
    this.g.position.set(x, 0, z0); scene.add(this.g); WORLD.boats.push(this);
  }
  get landed() { return this.state === 'landed'; }
  get open() { return this.state === 'landed' && this.ramp >= 1; }
  update(dt, t) {
    if (this.state === 'move') {
      this.z -= this.speed * dt;
      if (this.z <= this.stopZ) {
        this.z = this.stopZ; this.state = 'landed';
        const x = this.x, z = this.z, y0 = -1, y1 = 3;
        this.sol = [addSolid(x - 1.72, y0, z - 5, x - 1.5, y1, z + 5.1, 'boat'), addSolid(x + 1.5, y0, z - 5, x + 1.72, y1, z + 5.1, 'boat'), addSolid(x - 1.7, y0, z + 4.95, x + 1.7, y1, z + 5.15, 'boat')];
      }
    }
    if (this.state === 'landed' && this.ramp < 1) { this.ramp = Math.min(1, this.ramp + dt * .85); this.pivot.rotation.x = -1.45 * smooth(this.ramp); }
    let y = waveH(this.x, this.z, t) * (this.state === 'move' ? 1 : .35);
    const pitch = this.state === 'move' ? (waveH(this.x, this.z - 4, t) - waveH(this.x, this.z + 4, t)) * .1 : 0;
    if (this.state === 'sunk') { this.sinkT += dt; y -= Math.min(1.6, this.sinkT * .25); this.g.rotation.z = Math.min(.35, this.sinkT * .05); }
    this.y = y;
    this.g.position.set(this.x, y, this.z);
    if (this.state !== 'sunk') { this.g.rotation.x = pitch; this.g.rotation.z = Math.sin(t * 1.3 + this.ph) * .025 * (this.state === 'move' ? 1 : .2); }
    this.g.updateMatrixWorld();
  }
  toWorld(off, out) { return out.copy(off).applyMatrix4(this.g.matrixWorld); }
}

// ---------- oggetti distruttibili: bunker e cannoni da 88 ----------
let BUNKER_GEO, FLAK_GEO;
function buildBunkerGeo() {
  const mb = new MB(), c = 0x8e8a7f, c2 = 0x7a766c;
  mb.add(U.box, c, 0, 1.25, 0, 0, 0, 0, 9, 2.5, 7);
  mb.add(U.box, c, -3.25, 2.78, 0, 0, 0, 0, 2.5, .56, 7); mb.add(U.box, c, 3.25, 2.78, 0, 0, 0, 0, 2.5, .56, 7);
  mb.add(U.box, c, 0, 2.78, -1.2, 0, 0, 0, 4, .56, 4.6);
  mb.add(U.box, c, 0, 3.6, 0, 0, 0, 0, 9, 1.1, 7);
  mb.add(U.box, c2, 0, 4.4, .2, 0, 0, 0, 10, .7, 8);
  mb.add(U.box, 0x0b0b0b, 0, 2.78, 3.2, 0, 0, 0, 3.9, .54, .6);
  mb.add(U.box, c2, -5.2, 1.6, 3.4, 0, .5, 0, .8, 3, 2.5); mb.add(U.box, c2, 5.2, 1.6, 3.4, 0, -.5, 0, .8, 3, 2.5);
  mb.add(U.box, 0x151515, 0, 1.1, -3.52, 0, 0, 0, 1.4, 2.1, .1);
  for (let i = 0; i < 10; i++) mb.add(U.ico, R() < .5 ? 0x55603a : 0x6b6a45, rnd(-4.5, 4.5), 4.8, rnd(-3.5, 3.5), 0, R() * 3, 0, rnd(.6, 1.2), rnd(.3, .5), rnd(.6, 1.2));
  BUNKER_GEO = mb.build();
  const f = new MB(), y = 0x7b7254, dk = 0x3c3b36;
  f.add(U.box, dk, 0, .35, 0, 0, 0, 0, 6.5, .3, .6); f.add(U.box, dk, 0, .35, 0, 0, 0, 0, .6, .3, 6.5);
  f.add(U.cyl, y, 0, 1.0, 0, 0, 0, 0, .5, 1.1, .5);
  f.add(U.box, y, 0, 1.85, .3, 0, 0, 0, 1.3, .8, 1.8);
  f.add(U.cyl, y, 0, 2.62, 2.58, 1.22, 0, 0, .1, 5.6, .1);
  f.add(U.cyl, dk, 0, 3.55, 5.16, 1.22, 0, 0, .15, .5, .15);
  f.add(U.cyl, y, 0, 2.2, 1.6, 1.22, 0, 0, .14, 1.8, .14);
  f.add(U.box, y, 0, 2.0, 1.2, -.15, 0, 0, 2.6, 1.7, .08);
  f.add(U.box, dk, -.8, .5, -2.4, 0, 0, 0, .9, .5, .5); f.add(U.box, dk, .8, .5, 2.4, 0, 0, 0, .9, .5, .5);
  FLAK_GEO = f.build();
}
function makeBunker(x) {
  const z = -84.5, g = H(x, z + 3), base = g - 1.35;
  const mat = MAT.vc.clone(), mesh = new THREE.Mesh(BUNKER_GEO, mat);
  mesh.position.set(x, base, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  const b = {
    x, z, base, mesh, mat, gunner: null, destroyed: false, slitY: base + 2.78,
    door: new V3(x, H(x, z - 4.6), z - 4.6),
    lower: addSolid(x - 4.5, base - 2, z - 3.5, x + 4.5, base + 2.5, z + 3.5, 'bunker'),
    upper: addSolid(x - 4.5, base + 3.06, z - 3.5, x + 4.5, base + 4.8, z + 3.5, 'bunker'),
    side: addSolid(x - 4.5, base + 2.4, z - 3.5, x + 4.5, base + 3.1, z + 1, 'bunker'),
    get neutralized() { return this.destroyed || !this.gunner || !this.gunner.alive; },
    destroy() {
      if (this.destroyed) return; this.destroyed = true;
      this.mat.color.setRGB(.28, .26, .24);
      if (this.gunner && this.gunner.alive) this.gunner.die(null, false);
      const p = new V3(this.x, this.slitY, this.z + 3.4);
      fxExplosion(p, 2.2, false); sfxBoom(p, 2);
      addEmitter(p, 'fire', .9); addEmitter(new V3(this.x, base + 5, this.z), 'smoke', 1.2);
    }
  };
  for (let i = -3; i <= 3; i++) addCover(x + i * 1.4, z + 5.2, 'bunker');
  WORLD.bunkers.push(b); return b;
}
function makeFlak(x, z) {
  const base = H(x, z), mat = MAT.vc.clone(), mesh = new THREE.Mesh(FLAK_GEO, mat);
  mesh.position.set(x, base, z); mesh.castShadow = true; scene.add(mesh);
  const f = {
    x, z, mesh, mat, alive: true, fireT: rnd(3, 8),
    muzzle: new V3(x, base + 3.55 + .3, z + 5.4),
    pos: new V3(x, base, z),
    solid: addSolid(x - 1.3, base, z - .5, x + 1.3, base + 2.6, z + 2.2, 'flak'),
    destroy() {
      if (!this.alive) return; this.alive = false;
      this.mat.color.setRGB(.25, .23, .2); this.mesh.rotation.z = .25; this.mesh.rotation.x = -.1;
      const p = new V3(this.x, base + 1.5, this.z);
      fxExplosion(p, 2.5, false); sfxBoom(p, 2.2); addEmitter(p, 'fire', 1.1);
    }
  };
  WORLD.flaks.push(f); return f;
}

// ---------- modelli statici ----------
function addSherman(mb, x, y, z, ry, burnt) {
  const c = burnt ? 0x2f2b26 : 0x4d5334, d = burnt ? 0x221f1b : 0x353a26;
  mb.setBase(x, y, z, 0, ry, 0);
  mb.add(U.box, c, 0, .75, 0, 0, 0, 0, 2.5, 1.0, 5.8);
  mb.add(U.box, c, 0, 1.55, .35, 0, 0, 0, 2.4, .75, 4.2);
  mb.add(U.box, c, 0, 1.3, -2.35, -.62, 0, 0, 2.4, .95, 1.6);
  mb.add(U.box, d, -1.38, .55, 0, 0, 0, 0, .55, 1.05, 6.0); mb.add(U.box, d, 1.38, .55, 0, 0, 0, 0, .55, 1.05, 6.0);
  for (let i = 0; i < 6; i++) { mb.add(U.cyl, d, -1.38, .38, -2.3 + i * .92, 0, 0, PI / 2, .33, .62, .33); mb.add(U.cyl, d, 1.38, .38, -2.3 + i * .92, 0, 0, PI / 2, .33, .62, .33); }
  mb.add(U.cyl12, c, 0, 2.35, .35, 0, 0, 0, 1.05, .9, 1.1);
  mb.add(U.box, c, 0, 2.3, -.75, 0, 0, 0, .95, .62, .45);
  mb.add(U.cyl, d, 0, 2.3, -2.05, PI / 2, 0, 0, .075, 2.6, .075);
  mb.add(U.cyl, d, -.4, 2.85, .5, 0, 0, 0, .3, .1, .3);
  mb.clearBase();
}
function addLCVPWreck(mb, x, z, ry, rz) {
  const y = Math.max(H(x, z), -.6);
  mb.setBase(x, y - .3, z, 0, ry, rz);
  mb.add(U.box, 0x3d4640, 0, .12, 0, 0, 0, 0, 3.3, .5, 10.2);
  mb.add(U.box, 0x4b554e, -1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2); mb.add(U.box, 0x4b554e, 1.62, 1.08, 0, 0, 0, 0, .14, 1.95, 10.2);
  mb.add(U.box, 0x4b554e, 0, 1.08, 5.05, 0, 0, 0, 3.3, 1.95, .14);
  mb.add(U.box, 0x3d4640, 0, .4, -5.6, -1.3, 0, 0, 3.2, 2, .12);
  mb.clearBase();
  addCover(x + Math.sin(ry) * 0, z + 6, 'wreck');
}
function addHouse(mb, cx, cz, w, d, h, ruined, door) {
  const base = Math.min(H(cx - w / 2, cz - d / 2), H(cx + w / 2, cz - d / 2), H(cx - w / 2, cz + d / 2), H(cx + w / 2, cz + d / 2)) - .3;
  const stone = pick([0xa59d8b, 0x9b927f, 0xb1a892, 0x948b7a]), roof = pick([0x4c5157, 0x55585b, 0x6b4a3a]);
  const top = base + h + .3;
  if (!ruined) {
    mb.add(U.box, stone, cx, base + (h + .3) / 2, cz, 0, 0, 0, w, h + .3, d);
    mb.add(U.prism, roof, cx, top, cz, 0, PI / 2, 0, d + .7, d * .45, w + .6);
    mb.add(U.box, stone, cx + w * .3, top + d * .3, cz, 0, 0, 0, .7, d * .45 + 1, .7);
    for (const sz of [-1, 1]) for (let fx = -w / 2 + 1.6; fx < w / 2 - 1; fx += 2.6) for (const fy of h > 4.5 ? [1.7, 4.2] : [1.7]) {
      mb.add(U.box, 0x1a1a1c, cx + fx, base + fy, cz + sz * d / 2, 0, 0, 0, .95, 1.25, .12);
      mb.add(U.box, 0x46523f, cx + fx - .75, base + fy, cz + sz * d / 2, 0, 0, 0, .5, 1.3, .14); mb.add(U.box, 0x46523f, cx + fx + .75, base + fy, cz + sz * d / 2, 0, 0, 0, .5, 1.3, .14);
    }
    mb.add(U.box, 0x4a3524, cx + (door || 0), base + 1.3, cz + (door === undefined ? 0 : 0) + d / 2 * (cz < -281 ? 1 : -1), 0, 0, 0, 1.2, 2.3, .14);
    addSolid(cx - w / 2, base, cz - d / 2, cx + w / 2, top + d * .45, cz + d / 2, 'house');
  } else {
    const t = .5, walls = [[cx, cz - d / 2 + t / 2, w, t], [cx, cz + d / 2 - t / 2, w, t], [cx - w / 2 + t / 2, cz, t, d], [cx + w / 2 - t / 2, cz, t, d]];
    walls.forEach((wl, wi) => {
      const len = Math.max(wl[2], wl[3]), along = wl[2] > wl[3], segs = Math.max(2, Math.round(len / 1.4));
      let hsum = 0, cnt = 0;
      for (let i = 0; i < segs; i++) {
        const f = -len / 2 + (i + .5) * len / segs;
        if (wi === (cz < -281 ? 1 : 0) && Math.abs(f) < 1.1) continue;
        const sh = rnd(1.4, h) * (R() < .2 ? .4 : 1); hsum += sh; cnt++;
        mb.add(U.box, stone, wl[0] + (along ? f : 0), base + sh / 2, wl[1] + (along ? 0 : f), 0, 0, 0, along ? len / segs + .02 : t, sh, along ? t : len / segs + .02);
      }
      const ah = base + hsum / Math.max(1, cnt);
      if (wi === (cz < -281 ? 1 : 0)) {
        addSolid(wl[0] - len / 2, base, wl[1] - t / 2, wl[0] - 1.1, ah, wl[1] + t / 2, 'ruin');
        addSolid(wl[0] + 1.1, base, wl[1] - t / 2, wl[0] + len / 2, ah, wl[1] + t / 2, 'ruin');
      } else addSolid(wl[0] - wl[2] / 2, base, wl[1] - wl[3] / 2, wl[0] + wl[2] / 2, ah, wl[1] + wl[3] / 2, 'ruin');
    });
    for (let i = 0; i < 9; i++) mb.add(U.ico, stone, cx + rnd(-w / 2, w / 2), base + .3, cz + rnd(-d / 2, d / 2), R() * 3, R() * 3, 0, rnd(.6, 1.4), rnd(.4, .8), rnd(.6, 1.4));
    for (let i = 0; i < 4; i++) mb.add(U.box, 0x241c15, cx + rnd(-w / 3, w / 3), base + rnd(.5, 2), cz + rnd(-d / 3, d / 3), rnd(-.8, .8), R() * 3, rnd(-.5, .5), .2, .2, rnd(2, 4));
    addCover(cx, cz + (cz < -281 ? -d / 2 + 1.2 : d / 2 - 1.2), 'ruin');
  }
  addCover(cx - w / 2 + 1, cz + d / 2 + 1, 'house'); addCover(cx + w / 2 - 1, cz + d / 2 + 1, 'house');
  addCover(cx - w / 2 + 1, cz - d / 2 - 1, 'houseS'); addCover(cx + w / 2 - 1, cz - d / 2 - 1, 'houseS');
  return base;
}
function addTree(mb, x, z, s = 1) {
  const y = H(x, z), hgt = rnd(5, 9) * s;
  mb.add(U.cyl, 0x3e3125, x, y + hgt / 2, z, rnd(-.05, .05), 0, rnd(-.05, .05), .22 * s, hgt, .22 * s);
  for (let i = 0; i < 4; i++) mb.add(U.ico1, pick([0x3f5228, 0x4a5e2c, 0x37481f, 0x55662f]), x + rnd(-1.6, 1.6) * s, y + hgt + rnd(-1.2, 1.2) * s, z + rnd(-1.6, 1.6) * s, R(), R(), R(), rnd(1.8, 2.8) * s, rnd(1.6, 2.4) * s, rnd(1.8, 2.8) * s);
}

function buildStatic() {
  const S = new MB(), M = new MB();
  // --- ostacoli della spiaggia ---
  for (let i = 0; i < 120; i++) {
    const x = srnd(-195, 195), z = srnd(-49, -7), y = H(x, z), ry = srnd(0, PI);
    M.add(U.box, 0x3b332c, x, y + .7, z, PI / 4, ry, 0, .17, .17, 2.4);
    M.add(U.box, 0x3b332c, x, y + .7, z, -PI / 4, ry, 0, .17, .17, 2.4);
    M.add(U.box, 0x413830, x, y + .7, z, 0, ry + PI / 2, PI / 4, .17, 2.4, .17);
    addCover(x + rnd(-.3, .3), z + 1.35, 'hh'); OBST.push({ x, z, r: .9 });
  }
  for (let i = 0; i < 16; i++) {
    const x = srnd(-185, 185), z = srnd(-16, -3), y = H(x, z), ry = srnd(-.25, .25);
    M.setBase(x, y, z, 0, ry, 0);
    for (const fx of [-1.4, 0, 1.4]) M.add(U.box, 0x433a32, fx, 1.3, 0, 0, 0, 0, .14, 2.6, .14);
    for (const fy of [.3, 1.3, 2.5]) M.add(U.box, 0x433a32, 0, fy, 0, 0, 0, 0, 3.0, .12, .12);
    M.add(U.box, 0x3a322b, 0, 1.2, 1.1, -.85, 0, 0, .12, .12, 2.9); M.add(U.box, 0x3a322b, -1.4, 1.2, 1.1, -.85, 0, 0, .12, .12, 2.9); M.add(U.box, 0x3a322b, 1.4, 1.2, 1.1, -.85, 0, 0, .12, .12, 2.9);
    M.clearBase(); addCover(x, z + 2.4, 'gate'); OBST.push({ x: x - 1, z, r: .8 }, { x: x + 1, z, r: .8 });
  }
  for (let i = 0; i < 50; i++) {
    const x = srnd(-190, 190), z = srnd(-24, -3), y = H(x, z);
    S.add(U.cyl, 0x5b4a36, x, y + 1.65, z + 1.13, .6, 0, 0, .13, 4, .13);
    M.add(U.cyl12, 0x4a4d3c, x, y + 3.35, z + 2.26, .6, 0, 0, .18, .09, .18); OBST.push({ x, z: z + .3, r: .35 });
  }
  // relitti
  [[45, -21, .4], [-92, -30, -.3], [118, -10, 2.6], [-150, -15, .2]].forEach(([x, z, r], i) => {
    addSherman(M, x, H(x, z) - .25, z, r, true);
    addEmitter(new V3(x, H(x, z) + 2.4, z), i % 2 ? 'fire' : 'smoke', i % 2 ? .9 : 1);
    addSolid(x - 2, H(x, z) - 1, z - 2, x + 2, H(x, z) + 2.6, z + 2, 'tank');
    addCover(x, z + 3.6, 'tank'); addCover(x + 1.5, z + 3.4, 'tank');
  });
  [[-60, 3, .35, .25], [80, 1, -.5, -.3], [150, 4, .2, .3], [-130, 2, -.25, .2]].forEach(([x, z, ry, rz]) => addLCVPWreck(M, x, z, ry, rz));
  for (let i = 0; i < 70; i++) {
    const x = srnd(-180, 180), z = srnd(-50, -2), y = H(x, z);
    if (R() < .5) S.add(U.box, pick([0x4d5236, 0x5b5a40, 0x6a5a3c]), x, y + .2, z, 0, R() * 3, 0, rnd(.4, .9), rnd(.3, .5), rnd(.4, 1.2));
    else S.add(U.cyl, 0x4f5536, x, y + .15, z, PI / 2, R() * 3, 0, .17, .5, .17);
  }
  // terrapieno: assi di legno e coperture
  for (let x = -200; x < 200; x += srnd(2, 9)) {
    S.add(U.box, 0x5a4a37, x, H(x, BANK_Z + .8) + .55, BANK_Z + .8, srnd(-.2, .1), srnd(-.3, .3), srnd(-.15, .15), .15, 1.3, .15);
  }
  for (let x = -198; x < 198; x += 2.3) if (!inMinefield(x, -66)) addCover(x + rnd(-.3, .3), BANK_Z + 1.6, 'bank');
  // filo spinato: pali
  for (let x = -200; x <= 200; x += 4) S.add(U.cyl, 0x4a3d2e, x, H(x, WIRE_Z) + .6, WIRE_Z, 0, 0, srnd(-.15, .15), .05, 1.3, .05);
  // trincea: sacchi di sabbia lungo il bordo anteriore
  for (let x = -164; x < 164; x += 1.15) {
    const z = trenchZ(x) + 1.9, y = H(x, z);
    S.add(U.box, R() < .5 ? 0x8a7b5a : 0x7d7052, x, y + .18, z, 0, srnd(-.2, .2), 0, 1.05, .32, .5);
    if (R() < .6) S.add(U.box, 0x857656, x + .5, y + .48, z + .05, 0, srnd(-.2, .2), 0, 1.0, .3, .48);
  }
  for (let x = -160; x < 160; x += 3.2) addCover(x, trenchZ(x) + .4, 'trench');
  for (let x = -164; x < 164; x += 6) { const z = trenchZ(x) - 1.6; S.add(U.box, 0x5a4a35, x, H(x, z) + .5, z, 0, 0, 0, .12, 1, .12); }
  // segnali di campo minato
  for (const mf of MINEFIELDS) {
    for (let x = mf[0]; x <= mf[1]; x += 18) {
      const z = mf[3] + .5, y = H(x, z);
      S.add(U.cyl, 0x5a4a37, x, y + .7, z, 0, 0, srnd(-.2, .2), .05, 1.4, .05);
      S.add(U.box, 0xc9b23a, x, y + 1.3, z + .02, 0, 0, srnd(-.2, .2), .7, .45, .04);
      S.add(U.box, 0x111111, x, y + 1.3, z + .05, 0, 0, 0, .5, .08, .02);
    }
    for (let i = 0; i < 34; i++) mines.push({ x: srnd(mf[0], mf[1]), z: srnd(mf[2], mf[3]), live: true });
  }
  // cespugli e rocce sulla scogliera
  for (let i = 0; i < 380; i++) {
    const x = srnd(-200, 200), z = srnd(-100, -60); if (Math.abs(z - trenchZ(x)) < 3 || roadDist(x, z) < 4) continue;
    const y = H(x, z);
    if (R() < .7) S.add(U.ico1, pick([0x4a5a2a, 0x5d6a33, 0x3f4f25, 0x6b6c3d]), x, y + .3, z, R(), R(), R(), rnd(.6, 1.5), rnd(.5, 1.1), rnd(.6, 1.5));
    else S.add(U.ico, pick([0x6e6a60, 0x7b766a]), x, y + .1, z, R(), R(), R(), rnd(.4, 1.2), rnd(.3, .8), rnd(.4, 1.2));
  }
  // siepi (bocage)
  for (const hd of HEDGES) {
    const inGap = x => hd.gaps.some(g => x > g[0] && x < g[1]);
    for (let x = -220; x < 220; x += 1.5) {
      if (inGap(x)) continue;
      const y = H(x, hd.z);
      S.add(U.ico1, pick([0x3a4d23, 0x45582a, 0x33441f, 0x4f6030]), x + rnd(-.4, .4), y + rnd(1.4, 2.2), hd.z + rnd(-.7, .7), R(), R(), R(), rnd(1.3, 2.0), rnd(1.4, 2.1), rnd(1.2, 1.8));
      if (R() < .12) addTree(S, x, hd.z + rnd(-.5, .5), rnd(.8, 1.2));
    }
    let x0 = -220;
    const ends = [...hd.gaps.map(g => g[0]), 220].sort((a, b) => a - b), starts = [-220, ...hd.gaps.map(g => g[1])].sort((a, b) => a - b);
    for (let k = 0; k < ends.length; k++) {
      for (let x = starts[k]; x < ends[k]; x += 8) {
        const x1 = Math.min(ends[k], x + 8); let lo = 1e9, hi = -1e9;
        for (let s = x; s <= x1; s += 2) { const y = H(s, hd.z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
        addSolid(x, lo - 1, hd.z - 1.3, x1, hi + 2.8, hd.z + 1.3, 'hedge').nb = true;
      }
    }
    for (let x = -200; x < 200; x += 3) if (!inGap(x)) { addCover(x, hd.z + 2.3, 'hedgeN'); addCover(x, hd.z - 2.3, 'hedgeS'); }
    void x0;
  }
  // alberi sparsi e frutteti
  for (let i = 0; i < 110; i++) {
    const x = srnd(-230, 230), z = srnd(-420, -110);
    if (roadDist(x, z) < 6 || (z < -240 && z > -330 && x > -95 && x < 90) || Math.abs(z + 170) < 6 || Math.abs(z + 218) < 6 || (z < -180 && z > -205 && x > -20 && x < 70)) continue;
    addTree(S, x, z, rnd(.8, 1.3));
  }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) addTree(S, 70 + c * 7 + srnd(-1, 1), -240 - r * 7, .6);
  // pali del telegrafo lungo la strada
  for (let z = -80; z > -280; z -= 28) { const x = roadX(z) + 5, y = H(x, z); S.add(U.cyl, 0x4a3d2e, x, y + 3.5, z, 0, 0, 0, .1, 7, .1); S.add(U.box, 0x4a3d2e, x, y + 6.6, z, 0, 0, 0, 1.4, .1, .1); }
  // --- villaggio di Colleville-sur-Mer ---
  const north = [[-79, 11, 0], [-63, 12, 1], [-48, 9, 0], [-17, 10, 0], [-2, 11, 1], [36, 12, 0], [52, 11, 0], [70, 11, 1]];
  const south = [[-79, 11, 0], [-62, 12, 0], [-45, 10, 1], [-16, 11, 0], [35, 10, 1], [51, 12, 0], [68, 11, 0]];
  for (const [x, w, r] of north) addHouse(S, x, -268, w, 8, R() < .5 ? 6 : 4.5, !!r);
  for (const [x, w, r] of south) addHouse(S, x, -295, w, 8.5, R() < .5 ? 6 : 4.5, !!r);
  // chiesa
  {
    const cx = 13, cz = -312, w = 10, d = 20, base = Math.min(H(cx - 5, cz - 10), H(cx + 5, cz + 10)) - .3, st = 0xa9a18f;
    S.add(U.box, st, cx, base + 4.5, cz, 0, 0, 0, w, 9, d);
    S.add(U.prism, 0x4b5056, cx, base + 9, cz, 0, 0, 0, w + .8, 4.5, d + .6);
    for (let z = cz - 8; z <= cz + 6; z += 3.5) { S.add(U.box, 0x1a1a1c, cx - w / 2, base + 4.5, z, 0, 0, 0, .14, 3, 1); S.add(U.box, 0x1a1a1c, cx + w / 2, base + 4.5, z, 0, 0, 0, .14, 3, 1); }
    addSolid(cx - w / 2, base, cz - d / 2, cx + w / 2, base + 13, cz + d / 2, 'church');
    const tx = cx, tz = cz + d / 2 + 2.5;
    S.add(U.box, st, tx, base + 6.4, tz, 0, 0, 0, 5, 12.8, 5);
    for (const [px, pz] of [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]]) S.add(U.box, st, tx + px, base + 13.9, tz + pz, 0, 0, 0, .8, 2.3, .8);
    S.add(U.box, st, tx, base + 16, tz, 0, 0, 0, 5.2, 2, 5.2);
    S.add(U.pyr, 0x4b5056, tx, base + 19.8, tz, 0, PI / 4, 0, 3.8, 5.6, 3.8);
    S.add(U.box, 0x3a2b1e, tx, base + 1.4, tz + 2.52, 0, 0, 0, 1.4, 2.8, .1);
    addSolid(tx - 2.5, base, tz - 2.5, tx + 2.5, base + 12.8, tz + 2.5, 'tower');
    addSolid(tx - 2.6, base + 15, tz - 2.6, tx + 2.6, base + 22, tz + 2.6, 'tower');
    WORLD.towerTop = new V3(tx, base + 12.8, tz);
    addCover(tx - 3.5, tz + 3.5, 'church'); addCover(tx + 3.5, tz + 3.5, 'church');
  }
  // muretti a secco
  const wall = (x0, x1, z) => {
    for (let x = x0; x < x1; x += 2) { const y = H(x + 1, z); S.add(U.box, pick([0x8f8778, 0x9a917f]), x + 1, y + .5, z, 0, 0, 0, 2.05, 1.1, .7); }
    let lo = 1e9, hi = -1e9; for (let x = x0; x <= x1; x += 4) { const y = H(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    addSolid(x0, lo - .5, z - .35, x1, hi + 1.05, z + .35, 'wall');
    for (let x = x0 + 1; x < x1; x += 2.5) { addCover(x, z + 1.1, 'wallN'); addCover(x, z - 1.1, 'wallS'); }
  };
  wall(-92, -40, -250); wall(-22, 40, -250); wall(52, 92, -250);
  wall(-92, -38, -332); wall(-20, 32, -332); wall(48, 92, -332);
  // barricata nella strada
  for (let i = 0; i < 9; i++) S.add(U.box, 0x857656, -31 + i * .9 - 4, H(-31, -258) + .3 + (i % 2) * .3, -258, 0, 0, 0, .9, .32, .5);
  addSolid(-35.5, H(-31, -258) - .5, -258.3, -26.5, H(-31, -258) + .8, -257.7, 'sandbag');
  // postazioni intorno ai cannoni
  for (const [fx, fz] of [[-5, -194], [48, -196]]) for (let a = 0; a < TAU; a += TAU / 16) {
    if (Math.abs(a - PI / 2) < .5) continue;
    const x = fx + Math.cos(a) * 5, z = fz + Math.sin(a) * 5;
    S.add(U.box, 0x857656, x, H(x, z) + .3, z, 0, -a, 0, .5, .6, 1.8);
  }
  const sm = new THREE.Mesh(S.build(), MAT.vc); sm.castShadow = sm.receiveShadow = true; scene.add(sm);
  const mm = new THREE.Mesh(M.build(), MAT.vcMetal); mm.castShadow = mm.receiveShadow = true; scene.add(mm);
}

// filo spinato (linee elicoidali) — ricostruito dopo la breccia
function buildWire() {
  if (wireLines) { scene.remove(wireLines); wireLines.geometry.dispose(); }
  const pts = [];
  const coil = (x0, x1, z, yOff) => {
    let prev = null;
    for (let x = x0; x <= x1; x += .25) {
      const a = x * 3.1, p = new V3(x, H(x, z) + yOff + .45 + Math.sin(a) * .45, z + Math.cos(a) * .45);
      if (prev) pts.push(prev, p); prev = p;
    }
  };
  for (let x = -200; x < 200; x += 8) {
    const x1 = x + 8;
    if (WORLD.wireBreached && x1 > BREACH_X - 3.6 && x < BREACH_X + 3.6) {
      if (x < BREACH_X - 3.6) coil(x, BREACH_X - 3.6, WIRE_Z, 0);
      if (x1 > BREACH_X + 3.6) coil(BREACH_X + 3.6, x1, WIRE_Z, 0);
      continue;
    }
    coil(x, x1, WIRE_Z, 0);
  }
  for (let i = 0; i < 25; i++) { const x = srnd(-170, 170), z = srnd(-82, -66); if (Math.abs(x - BREACH_X) > 8) coil(x, x + srnd(3, 7), z, -.1); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  wireLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col(0x2a2622) }));
  scene.add(wireLines);
}

// erba (istanze di ciuffi incrociati)
function buildGrass() {
  if (!Q.grass) return;
  const tex = canvasTex(64, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = rnd(4, s - 4), h = rnd(s * .4, s * .95), lean = rnd(-8, 8);
      g.strokeStyle = `rgba(${150 + R() * 60 | 0},${160 + R() * 50 | 0},${90 + R() * 40 | 0},1)`; g.lineWidth = rnd(1.5, 3);
      g.beginPath(); g.moveTo(x, s); g.quadraticCurveTo(x + lean * .3, s - h * .5, x + lean, s - h); g.stroke();
    }
  });
  const p1 = new THREE.PlaneGeometry(1, 1); p1.translate(0, .5, 0);
  const p2 = p1.clone(); p2.rotateY(PI / 2);
  const geo = new THREE.BufferGeometry();
  const merge = [p1, p2];
  const pos = [], uv = [], nor = [], idx = [];
  let o = 0;
  for (const g of merge) {
    const pa = g.attributes.position, ua = g.attributes.uv;
    for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); uv.push(ua.getX(i), ua.getY(i)); nor.push(0, 1, 0); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + o);
    o += pa.count;
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: 1, color: col(0x8d9560) });
  const im = new THREE.InstancedMesh(geo, mat, Q.grass);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < Q.grass && tries < Q.grass * 4; tries++) {
    const x = srnd(-180, 180), z = srnd(-235, -62);
    if (roadDist(x, z) < 3 || (z < -84 && z > -97 && Math.abs(z - trenchZ(x)) < 2.5) || (z < -245 && x > -95 && x < 95)) continue;
    const y = H(x, z); p.set(x, y - .05, z); q.setFromAxisAngle(new V3(0, 1, 0), SR() * PI);
    const h = srnd(.45, 1.05); s.set(srnd(.7, 1.3), h, srnd(.7, 1.3));
    m.compose(p, q, s); im.setMatrixAt(n, m);
    c.setHSL(.17 + SR() * .06, .35, .45 + SR() * .2); im.setColorAt(n, c); n++;
  }
  im.count = n; im.receiveShadow = true; scene.add(im);
}

// ---------- flotta ----------
function addShip(mb, x, z, len, beam, kind) {
  const hullH = { bb: 11, cl: 8, dd: 6, lst: 7 }[kind], draft = hullH * .45, deckY = hullH - draft;
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -beam * .42); s.lineTo(len * .22, -beam / 2); s.quadraticCurveTo(len * .42, -beam * .35, len / 2, 0);
  s.quadraticCurveTo(len * .42, beam * .35, len * .22, beam / 2); s.lineTo(-len / 2, beam * .42); s.lineTo(-len / 2, -beam * .42);
  const g = new THREE.ExtrudeGeometry(s, { depth: hullH, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-PI / 2);
  const hc = kind === 'lst' ? 0x5a6066 : 0x59626a, sc = 0x6a737a;
  mb.add(g, hc, x, -draft, z);
  if (kind === 'lst') {
    mb.add(U.box, sc, x - len * .35, deckY + 3, z, 0, 0, 0, len * .15, 6, beam * .8);
    return;
  }
  mb.add(U.box, sc, x, deckY + 2, z, 0, 0, 0, len * .22, 4, beam * .55);
  mb.add(U.box, sc, x - len * .02, deckY + 5.5, z, 0, 0, 0, len * .12, 3.5, beam * .42);
  mb.add(U.box, 0x4f575e, x, deckY + 8, z, 0, 0, 0, len * .05, 2.2, beam * .3);
  const fun = kind === 'dd' ? [x + len * .05, x - len * .1] : [x + len * .08];
  for (const fx of fun) { mb.add(U.cyl12, 0x4c545b, fx, deckY + 6, z, 0, 0, 0, beam * .09, 7, beam * .11); addEmitter(new V3(fx, deckY + 9.5, z), 'stack', kind === 'bb' ? 2 : 1.2); }
  mb.add(U.cyl, 0x3d444a, x - len * .03, deckY + 16, z, 0, 0, 0, .5, 22, .5);
  mb.add(U.box, 0x3d444a, x - len * .03, deckY + 22, z, 0, 0, 0, .3, .3, beam * .7);
  const tur = kind === 'bb' ? [-.36, -.24, .24, .36] : kind === 'cl' ? [-.32, -.2, .22, .32] : [-.3, .25, .36];
  const big = kind === 'bb', bl = big ? 13 : kind === 'cl' ? 8 : 5;
  for (const t of tur) {
    const tx = x + t * len, ty = deckY + (Math.abs(t) < .3 ? 2.2 : 1.2);
    mb.add(U.cyl12, sc, tx, ty, z, 0, 0, 0, beam * .2, 1.6, beam * .2);
    mb.add(U.box, sc, tx, ty + 1, z - beam * .06, 0, 0, 0, beam * .32, 1.8, beam * .3);
    const nb = big ? 2 : kind === 'cl' ? 3 : 1;
    for (let b = 0; b < nb; b++) {
      const bx = tx + (b - (nb - 1) / 2) * (big ? 1.4 : .9);
      mb.add(U.cyl, 0x30363b, bx, ty + 1.3 + bl * .5 * Math.sin(.2), z - beam * .2 - bl * .5 * Math.cos(.2), PI / 2 - .2, 0, 0, big ? .35 : .22, bl, big ? .35 : .22);
    }
    WORLD.shipGuns.push({ p: new V3(tx, ty + 1.3 + bl * Math.sin(.2), z - beam * .2 - bl * Math.cos(.2)), big, t: rnd(1, 9) });
  }
}
function buildFleet() {
  const mb = new MB();
  addShip(mb, -230, 780, 175, 32, 'bb');
  addShip(mb, 190, 840, 175, 32, 'bb');
  addShip(mb, 470, 720, 165, 20, 'cl');
  addShip(mb, -470, 700, 150, 18, 'cl');
  addShip(mb, -110, 430, 105, 11, 'dd'); addShip(mb, 70, 390, 105, 11, 'dd'); addShip(mb, 280, 460, 105, 11, 'dd');
  for (let i = 0; i < 9; i++) addShip(mb, srnd(-900, 900), srnd(1250, 1700), 100, 15, 'lst');
  for (let i = 0; i < 16; i++) { const x = srnd(-700, 700), z = srnd(520, 1100); mb.add(U.box, 0x5a625e, x, .5, z, 0, srnd(-.2, .2), 0, 4, 2, 11); }
  for (let i = 0; i < 6; i++) {
    const x = srnd(-900, 900), z = srnd(1250, 1700), y = srnd(90, 130);
    mb.add(U.sph, 0x8d949a, x, y, z, 0, 0, 0, 7, 3.2, 3.2);
    mb.add(U.box, 0x8d949a, x + 6, y + 1.5, z, 0, 0, 0, 2.5, 2.5, .2);
    mb.add(U.cyl, 0x333333, x, y / 2, z, 0, 0, 0, .1, y, .1);
  }
  const m = new THREE.Mesh(mb.build(), MAT.vcMetal); scene.add(m);
}
let PLANE_GEO;
function buildPlaneGeo() {
  const mb = new MB(), od = 0x4d5233, w = 0xdedcd2, b = 0x111111;
  mb.add(U.cyl12, od, 0, 0, 0, PI / 2, 0, 0, .7, 10, .7);
  mb.add(U.cyl12, 0x2b2b2b, 0, 0, -5.4, PI / 2, 0, 0, .82, 1.2, .82);
  mb.add(U.box, od, 0, -.2, -1, 0, 0, 0, 12.4, .22, 2.3);
  mb.add(U.box, od, 0, .1, 4.7, 0, 0, 0, 4.6, .15, 1.2);
  mb.add(U.box, od, 0, 1, 4.8, 0, 0, 0, .15, 1.9, 1.4);
  mb.add(U.sph, 0x1d2a33, 0, .75, -1.2, 0, 0, 0, .45, .4, 1);
  for (let i = 0; i < 5; i++) { const c = i % 2 ? b : w; mb.add(U.box, c, 3.6 + i * .32, -.08, -1, 0, 0, 0, .32, .24, 2.32); mb.add(U.box, c, -3.6 - i * .32, -.08, -1, 0, 0, 0, .32, .24, 2.32); }
  for (let i = 0; i < 5; i++) mb.add(U.cyl12, i % 2 ? b : w, 0, 0, 2.6 + i * .28, PI / 2, 0, 0, .72, .28, .72);
  PLANE_GEO = mb.build();
}
function spawnFlight() {
  const n = (rnd(2, 5)) | 0, alongBeach = R() < .4, base = new V3(srnd(-200, 200), srnd(70, 120), 0);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(PLANE_GEO, MAT.vcMetal); scene.add(m);
    const off = new V3(i * 14 - n * 7, rnd(-4, 4), i * 10);
    const dir = alongBeach ? new V3(R() < .5 ? 1 : -1, 0, 0) : new V3(0, 0, -1);
    const start = alongBeach ? new V3(-dir.x * 1400, base.y, rnd(-150, 40)) : new V3(base.x, base.y, 1400);
    m.position.copy(start).add(off);
    m.lookAt(m.position.clone().sub(dir)); // il muso è verso -z del modello
    WORLD.planes.push({ m, dir, speed: 115, life: 26, heard: false });
  }
}

// ---------- costruzione completa ----------
function buildWorld() {
  genCraters();
  WORLD.villageY = H0(10, -283);
  buildTerrain();
  buildWater();
  buildBoatGeos(); buildBunkerGeo(); buildPlaneGeo();
  buildStatic();
  buildWire();
  buildGrass();
  buildFleet();
  for (const x of [-100, 15, 100]) makeBunker(x);
  makeFlak(-5, -194); makeFlak(48, -196);
}

function updateWorld(dt, t) {
  waterMat.uniforms.uTime.value = t;
  for (const b of WORLD.boats) b.update(dt, t);
  // bombardamento navale
  for (const g of WORLD.shipGuns) {
    g.t -= dt; if (g.t > 0) continue;
    g.t = g.big ? rnd(7, 12) : rnd(4, 8);
    if (WORLD.bombard === 'off') continue;
    PS_FIRE.emit(g.p.x, g.p.y, g.p.z, 0, 2, -14, .3, g.big ? 16 : 9, g.big ? 26 : 14, 1, 4, 2.6, 1.2);
    for (let i = 0; i < 3; i++) PS_SMOKE.emit(g.p.x, g.p.y, g.p.z - 4, rnd(-2, 2), rnd(1, 3), rnd(-12, -6), rnd(5, 8), g.big ? 10 : 6, g.big ? 32 : 18, .55, .55, .55, .55, .4, -.1);
    sfxShip(g.p);
    const tp = bombardTarget(); if (!tp) continue;
    WORLD.shells.push({ t: g.p.distanceTo(tp) / 650 + 1.2, p: tp, size: g.big ? 2.4 : 1.5 });
  }
  for (let i = WORLD.shells.length - 1; i >= 0; i--) {
    const s = WORLD.shells[i]; s.t -= dt; if (s.t > 0) continue;
    WORLD.shells.splice(i, 1);
    if (s.p.distanceTo(P.pos) < 30) continue;
    explode(s.p, s.size * 4.5, 220, { ship: true });
  }
  // aerei
  WORLD.planeT -= dt; if (WORLD.planeT <= 0) { WORLD.planeT = rnd(40, 75); spawnFlight(); }
  for (let i = WORLD.planes.length - 1; i >= 0; i--) {
    const p = WORLD.planes[i]; p.life -= dt; p.m.position.addScaledVector(p.dir, p.speed * dt);
    if (!p.heard && p.m.position.distanceTo(camera.position) < 450) { p.heard = true; sfxPlane(p.m.position); }
    if (p.life <= 0) { scene.remove(p.m); WORLD.planes.splice(i, 1); }
  }
}
function bombardTarget() {
  if (WORLD.bombard === 'bluff') {
    const al = enemies.filter(e => e.alive && !e.inBunker && e.group === 'beach');
    let p = al.length && R() < .3 ? pick(al).pos.clone().add(new V3(rnd(-10, 10), 0, rnd(-6, 6))) : new V3(rnd(-180, 180), 0, rnd(-140, -92));
    p.y = H(p.x, p.z); return p;
  }
  if (WORLD.bombard === 'inland') { const p = new V3(rnd(-250, 250), 0, rnd(-470, -350)); p.y = H(p.x, p.z); return p; }
  return null;
}
