// Acqua interattiva: simulazione d'onda sulla GPU in un riquadro di ~500 m attorno alla camera.
// Canali della texture: r = altezza, g = altezza al passo precedente, b = schiuma.
// Colpi, bombe, siluri, schianti e scafi in movimento disturbano la superficie; le onde si propagano, si smorzano
// e lasciano schiuma. L'oceano legge la texture per spostare i vertici, piegare le normali e disegnare la schiuma.
const WSIM = { N: 256, cell: 2, on: false, drops: [], cx: 0, cz: 0, acc: 0, rate: 1 / 24 };
WSIM.span = WSIM.N * WSIM.cell;
function wsimInit() {
  if (WSIM.inited) return WSIM.on; WSIM.inited = true;
  try {
    const gl2 = renderer.capabilities.isWebGL2, type = gl2 ? THREE.HalfFloatType : THREE.FloatType;
    if (!gl2 && !renderer.extensions.get('OES_texture_float')) return false;
    const mk = () => new THREE.WebGLRenderTarget(WSIM.N, WSIM.N, { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    WSIM.a = mk(); WSIM.b = mk();
    const drops = []; for (let i = 0; i < 24; i++) drops.push(new THREE.Vector4(), new THREE.Vector4());
    const sh = []; for (let i = 0; i < 8; i++) sh.push(new THREE.Vector4(), new THREE.Vector4());
    WSIM.mat = new THREE.ShaderMaterial({
      uniforms: { uPrev: { value: null }, uTx: { value: 1 / WSIM.N }, uShift: { value: new THREE.Vector2() }, uDrop: { value: drops }, uND: { value: 0 }, uShip: { value: sh }, uNS: { value: 0 }, uK: { value: .12 }, uDamp: { value: .992 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `precision highp float; uniform sampler2D uPrev; uniform float uTx, uK, uDamp; uniform vec2 uShift; uniform vec4 uDrop[48]; uniform int uND; uniform vec4 uShip[16]; uniform int uNS; varying vec2 vUv;
        vec4 S(vec2 uv){ vec2 q = uv + uShift * uTx; if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) return vec4(0.); return texture2D(uPrev, q); }
        void main(){
          vec4 c = S(vUv); float h = c.r, hp = c.g, foam = c.b;
          // laplaciano isotropo a 9 punti: le onde si allargano in cerchi (niente croci dovute alla griglia)
          float ax = S(vUv + vec2(uTx, 0.)).r + S(vUv - vec2(uTx, 0.)).r + S(vUv + vec2(0., uTx)).r + S(vUv - vec2(0., uTx)).r;
          float dg = S(vUv + vec2(uTx, uTx)).r + S(vUv - vec2(uTx, uTx)).r + S(vUv + vec2(uTx, -uTx)).r + S(vUv + vec2(-uTx, uTx)).r;
          float lap = (4. * ax + dg - 20. * h) / 6.;
          float hn = (2. * h - hp + uK * lap) * uDamp;
          // la schiuma si allarga piano (la scia si apre) e si dissolve
          float fa = (S(vUv + vec2(uTx, 0.)).b + S(vUv - vec2(uTx, 0.)).b + S(vUv + vec2(0., uTx)).b + S(vUv - vec2(0., uTx)).b) * .25;
          foam = mix(foam, fa, .18) * .9935 + clamp(abs(lap) * .02 - .02, 0., .02);
          // tonfi: conca d'impatto (forza negativa) o rigonfiamento, con schiuma
          for (int i = 0; i < 24; i++) { if (i >= uND) break; vec4 d = uDrop[i * 2], e = uDrop[i * 2 + 1]; float r = length(vUv - d.xy); if (r < d.z) { float k = .5 + .5 * cos(3.14159 * r / d.z); hn += d.w * k; foam = max(foam, e.x * k); } }
          // scafi: depressione che si sposta con la nave (onde di prua e di poppa) e schiuma nella scia
          for (int i = 0; i < 8; i++) { if (i >= uNS) break; vec4 a = uShip[i * 2], b = uShip[i * 2 + 1]; vec2 r = vUv - a.xy; float lx = r.x * a.z + r.y * a.w, lz = r.x * a.w - r.y * a.z;   // lz < 0 a prua, > 0 a poppa
            float u = lz / b.x; if (abs(u) < 1.15) { float half_ = b.y * sqrt(max(0., 1. - u * u * u * u)); if (abs(lx) < half_) { hn = mix(hn, -b.z * .35 * (1. - u * u), .2); }
              float near = 1. - smoothstep(half_, half_ + b.y * 1.2, abs(lx)); foam = max(foam, near * b.w * (u > .7 ? .85 : u < -.8 ? .45 : .12));
              float line = 1. - smoothstep(0., b.y * .28, abs(abs(lx) - half_)); foam = max(foam, line * .3 * min(1., b.w * 1.6));
              if (abs(lx) < half_ + b.y * .9 && abs(lx) > half_ * .85) hn += -b.z * .025 * (1. - u * u); } }
          // bordo assorbente: le onde non rimbalzano sul limite del riquadro
          float edge = smoothstep(0., .06, min(min(vUv.x, vUv.y), min(1. - vUv.x, 1. - vUv.y)));
          gl_FragColor = vec4(clamp(hn, -6., 6.) * edge, h * edge, clamp(foam, 0., 1.) * edge, 1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    WSIM.scene = new THREE.Scene(); WSIM.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    WSIM.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), WSIM.mat); WSIM.quad.frustumCulled = false; WSIM.scene.add(WSIM.quad);
    const clr = new THREE.Color(), prev = renderer.getRenderTarget(); renderer.getClearColor(clr); const ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0); for (const t of [WSIM.a, WSIM.b]) { renderer.setRenderTarget(t); renderer.clear(); }
    renderer.setRenderTarget(prev); renderer.setClearColor(clr, ca);
    WSIM.on = true;
  } catch (e) { WSIM.on = false; }
  return WSIM.on;
}
// disturbo nell'acqua in coordinate del mondo: raggio in metri, forza in metri (negativa = conca), schiuma 0..1
function waterDrop(x, z, r, str, foam = .6) {
  if (!WSIM.on) return; if (Math.abs(x - WSIM.cx) > WSIM.span / 2 + r || Math.abs(z - WSIM.cz) > WSIM.span / 2 + r) return;
  if (WSIM.drops.length >= 24) WSIM.drops.shift();
  WSIM.drops.push([x, z, Math.max(r, WSIM.cell * 1.5), str, foam]);
}
function updateWaterSim(dt, focus) {
  if (!wsimInit()) return;
  WSIM.acc += dt; if (WSIM.acc < WSIM.rate) return; WSIM.acc = Math.min(WSIM.acc - WSIM.rate, WSIM.rate * 2);
  // il riquadro segue la camera a passi interi di cella (il contenuto scorre senza sbavature)
  const nx = Math.round(focus.x / WSIM.cell) * WSIM.cell, nz = Math.round(focus.z / WSIM.cell) * WSIM.cell;
  const U = WSIM.mat.uniforms, toU = (x, z) => [(x - nx) / WSIM.span + .5, .5 - (z - nz) / WSIM.span];
  U.uShift.value.set((nx - WSIM.cx) / WSIM.cell, -(nz - WSIM.cz) / WSIM.cell); WSIM.cx = nx; WSIM.cz = nz;
  let k = 0; for (const d of WSIM.drops) { const [u, v] = toU(d[0], d[1]); U.uDrop.value[k * 2].set(u, v, d[2] / WSIM.span, d[3]); U.uDrop.value[k * 2 + 1].set(d[4], 0, 0, 0); k++; }
  U.uND.value = k; WSIM.drops.length = 0;
  // scafi vicini (navi e mezzi), i più vicini per primi; anche da fermi l'acqua sciaborda contro lo scafo
  const H = [], T = performance.now() / 1000, half = WSIM.span / 2;
  if (typeof NV !== 'undefined' && NV.ships) for (const sh of NV.ships) if (!(sh.sinking > 0)) H.push({ pos: sh.pos, yaw: sh.yaw, L: sh.C.L, B: sh.C.B, spd: Math.abs(sh.spd || 0), ship: 1, id: sh });
  for (const h of WSIM.hulls || []) H.push(h);
  for (const h of H) h._d = Math.max(Math.abs(h.pos.x - nx) - h.L, Math.abs(h.pos.z - nz) - h.L);
  H.sort((p, q) => p._d - q._d);
  let s = 0;
  for (const h of H) {
    if (s >= 8 || h._d > half) break;
    const [u, v] = toU(h.pos.x, h.pos.z), spd = h.spd, ph = (h.pos.x * .013 + h.pos.z * .021) % 6.28;
    // sciabordio: lo scafo affonda e risale di poco a ritmo lento e manda piccole onde tutt'intorno
    const lap = (.55 + .45 * Math.sin(T * 1.6 + ph) * Math.sin(T * .63 + ph * 2.1)) * Math.min(1.4, .45 + Math.sqrt(h.B / 12) * .5);
    const push = h.ship || h.big ? Math.min(2.2, spd * .09 * Math.sqrt(h.B / 10)) : Math.min(1, spd * .1);
    const foam = h.ship || h.big ? clamp(spd / 12, 0, .9) : clamp(spd / 9, 0, .55);
    U.uShip.value[s * 2].set(u, v, Math.cos(h.yaw), Math.sin(h.yaw));
    U.uShip.value[s * 2 + 1].set(h.L / 2 / WSIM.span, h.B / 2 / WSIM.span, Math.max(push, lap * 1.6 * (1 - clamp(spd / 6, 0, 1))), Math.max(foam, .3 + .08 * Math.sin(T * 2.3 + ph)));
    s++;
  }
  U.uNS.value = s;
  U.uPrev.value = WSIM.a.texture;
  const prev = renderer.getRenderTarget(), xr = renderer.xr && renderer.xr.enabled; if (renderer.xr) renderer.xr.enabled = false;
  renderer.setRenderTarget(WSIM.b); renderer.render(WSIM.scene, WSIM.cam); renderer.setRenderTarget(prev); if (renderer.xr) renderer.xr.enabled = xr;
  const t = WSIM.a; WSIM.a = WSIM.b; WSIM.b = t;
  U.uShift.value.set(0, 0);
}
// uniformi e funzioni da inserire nello shader dell'oceano
const WATER_GLSL = {
  vert: `uniform sampler2D uSim; uniform vec3 uSimC; float simH(vec2 xz){ vec2 uv = vec2((xz.x - uSimC.x) / uSimC.z + .5, .5 - (xz.y - uSimC.y) / uSimC.z); if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.; return texture2D(uSim, uv).r; }`,
  frag: `uniform sampler2D uSim; uniform vec3 uSimC; uniform vec4 uHA[8]; uniform vec4 uHB[8]; uniform int uNH;
    vec3 simS(vec2 xz){ vec2 uv = vec2((xz.x - uSimC.x) / uSimC.z + .5, .5 - (xz.y - uSimC.y) / uSimC.z); if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec3(0.); float t = 1. / 256.;
      vec4 c = texture2D(uSim, uv); float hx = texture2D(uSim, uv + vec2(t, 0.)).r - texture2D(uSim, uv - vec2(t, 0.)).r, hz = texture2D(uSim, uv - vec2(0., t)).r - texture2D(uSim, uv + vec2(0., t)).r; return vec3(hx, hz, c.b); }
    bool inHull(vec2 xz){ for (int i = 0; i < 8; i++) { if (i >= uNH) break; vec4 a = uHA[i], b = uHB[i]; vec2 r = xz - a.xy; float lx = r.x * a.z - r.y * a.w, lz = r.x * a.w + r.y * a.z; float u = lz / b.x; if (abs(u) < 1.) { if (abs(lx) < b.y * sqrt(max(0., 1. - u * u * u * u)) - .15) return true; } } return false; }`,
};
// scafi da escludere dal disegno dell'acqua (niente mare dentro le barche)
function waterHullUniforms(U) {
  let n = 0;
  if (typeof NV !== 'undefined' && NV.ships) for (const sh of NV.ships) {
    if (n >= 8 || sh.sinking > 0) continue; const d = dist2Cam(sh.pos); if (d > 2500 * 2500) continue;
    U.uHA.value[n].set(sh.pos.x, sh.pos.z, Math.cos(sh.yaw), Math.sin(sh.yaw)); U.uHB.value[n].set(sh.C.L / 2, sh.C.B / 2, 0, 0); n++;
  }
  for (const h of WSIM.hulls || []) { if (n >= 8) break; if (dist2Cam(h.pos) > 400 * 400) continue; U.uHA.value[n].set(h.pos.x, h.pos.z, Math.cos(h.yaw), Math.sin(h.yaw)); U.uHB.value[n].set(h.L / 2, h.B / 2, 0, 0); n++; }
  U.uNH.value = n;
}
