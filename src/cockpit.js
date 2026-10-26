"use strict";
// ============================================================
//  Cabina in prima persona: costruita attorno agli occhi del pilota di ogni aereo.
//  Cruscotto con strumenti veri a lancette disegnati su un atlante (anemometro, altimetro a due lancette,
//  orizzonte artificiale, girobussola, virosbandometro, variometro, contagiri, pressione di alimentazione,
//  olio, carburante, orologio, accelerometro), spie del carrello e dell'incendio, collimatore a riflessione,
//  telaio del parabrezza e del tettuccio, consolle laterali, cloche, manetta e pedaliera animate.
//  Unità secondo la nazione (miglia e piedi per USA e Regno Unito, km/h e metri per Germania e Giappone).
//  L'F-47 ha una cabina moderna con tre schermi multifunzione e il visore a testa alta.
// ============================================================
const CK = { atlas: null, actx: null, atex: null, lamps: {}, stick: null, throttle: null, pedals: [], mfd: null, mctx: null, mtex: null, t: 0, hdgPrev: 0, turn: 0, fuel: 1 };
const CK_INT = { us: 0x56653c, uk: 0x6f7a68, de: 0x3c3e40, jp: 0x6d7047 };   // interior green, grigio-verde, RLM 66, aotake opaco
function ckCell(geo, col, row) {   // rimappa gli UV di un disco sulla cella (col, row) dell'atlante 8×4
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 8, 1 - (row + 1 - uv.getY(i)) / 4); uv.needsUpdate = true; return geo;
}
function buildCockpit(type) {
  type = type || PL.type || 'p47';
  const sp = PLANE_SPECS[type] || PLANE_SPECS.p47, nat = sp.nation === 'uk' ? 'uk' : sp.nation || 'us', modern = !!sp.sixth;
  const eye = sp.eye || [0, 1.12, -.5], cn = sp.canopy || { z0: -1, z1: .6, w: .7, h: .5, y: .6 };
  const g = new THREE.Group(); g.position.set(eye[0], eye[1], eye[2]);
  const mb = new MB(); mb.mat = 'paint';
  const ic = modern ? 0x3a3f44 : CK_INT[nat] || CK_INT.us, black = 0x161616, metal = 0x55595c, leather = 0x3a2a1c;
  // misure in coordinate dell'occhio (x destra, y su, -z avanti)
  const halfW = Math.max(.36, (cn.w || .7) / 2 + .02), zW = clamp((cn.z0 ?? -1.2) - eye[2] + .15, -1.05, -.62), topY = (cn.y ?? .6) + (cn.h ?? .5) - eye[1];
  const zp = zW + .06, panW = Math.min(.78, halfW * 2 - .06), panH = .36, sillY = -.13;
  // il cruscotto sta sotto il dorso della fusoliera (il paraluce è il bordo del cofano)
  let panY = -.27;
  if (typeof specFuselage === 'function' && sp.len && !sp.builtin) { try { const st = specFuselage(sp), z = eye[2] + zp; for (let i = 0; i < st.length - 1; i++) if (z >= st[i][0] && z <= st[i + 1][0]) { const t = (z - st[i][0]) / (st[i + 1][0] - st[i][0]), top = lerp(st[i][3] + st[i][2] / 2, st[i + 1][3] + st[i + 1][2] / 2, t); panY = clamp(top - eye[1] - .04 - panH / 2, -.5, -.2); } } catch (e) { } }
  CK.zp = zp; CK.panY = panY;
  // vasca della cabina: fianchi, pavimento, paratia dietro il seggiolino
  for (const sx of [-1, 1]) { mb.add(U.box, ic, sx * halfW, -.42, (zW + .45) / 2, 0, 0, 0, .03, .62, .45 - zW); mb.add(U.box, ic, sx * (halfW - .02), sillY, (zW + .45) / 2, 0, 0, 0, .06, .05, .45 - zW); }
  mb.add(U.box, ic, 0, -.74, (zW + .45) / 2, 0, 0, 0, halfW * 2, .03, .45 - zW);
  mb.add(U.box, ic, 0, -.35, .45, 0, 0, 0, halfW * 2, .8, .03);
  // cruscotto: pannello principale e pannello inferiore, paraluce imbottito sopra
  const pc = modern ? 0x202326 : nat === 'de' ? 0x2a2b2c : 0x1d1e1c;
  mb.add(U.box, pc, 0, panY, zp, -.1, 0, 0, panW, panH, .03);
  mb.add(U.box, pc, 0, panY - panH / 2 - .1, zp + .08, -.6, 0, 0, panW * .5, .22, .03);
  mb.add(U.box, leather, 0, panY + panH / 2 + .02, zp - .06, 0, 0, 0, panW + .04, .05, .2);
  // collimatore a riflessione sul paraluce (vetro combinatore inclinato)
  const sy = panY + panH / 2 + .05;
  if (!modern) { mb.add(U.box, black, 0, sy + .03, zp - .02, 0, 0, 0, .08, .07, .16); mb.add(U.cyl12, metal, 0, sy + .03, zp + .07, PI / 2, 0, 0, .03, .04, .03); }
  // consolle sinistra: quadrante della manetta, volantini dei compensatori
  mb.add(U.box, ic, -halfW + .07, -.42, -.32, 0, 0, 0, .12, .1, .5); mb.add(U.box, black, -halfW + .07, -.365, -.32, 0, 0, 0, .1, .01, .42);
  mb.add(U.cyl12, black, -halfW + .1, -.5, -.05, 0, 0, PI / 2, .07, .025, .07); mb.add(U.cyl12, black, -halfW + .1, -.5, .08, 0, 0, PI / 2, .05, .02, .05);
  // consolle destra: radio, interruttori, ossigeno
  mb.add(U.box, 0x2a2c28, halfW - .08, -.43, -.35, 0, 0, 0, .13, .12, .3); for (let i = 0; i < 4; i++) mb.add(U.cyl, 0xb8b8b0, halfW - .12 + (i % 2) * .05, -.36, -.42 + Math.floor(i / 2) * .07, 0, 0, 0, .006, .03, .006);
  mb.add(U.cyl12, 0x2a2c28, halfW - .08, -.42, -.05, PI / 2, 0, 0, .05, .04, .05);
  // seggiolino e cinghie sulle spalle
  mb.add(U.box, metal, 0, -.55, .28, 0, 0, 0, .42, .06, .4); mb.add(U.box, metal, 0, -.25, .45, -.1, 0, 0, .44, .62, .04);
  for (const sx of [-1, 1]) mb.between(new V3(sx * .1, .02, .42), new V3(sx * .08, -.42, .02), .022, 0x8f8360, U.box);
  // telaio del parabrezza: montanti, arco frontale, vetro blindato (non sui caccia moderni)
  const wy0 = sy - .02, wTop = Math.min(topY, .32);
  if (!modern) {
    for (const sx of [-1, 1]) { mb.between(new V3(sx * .17, wy0, zW), new V3(sx * .15, wTop, zW + .22), .012, black, U.box); mb.between(new V3(sx * (halfW - .01), sillY, zW + .08), new V3(sx * .3, wTop - .02, zW + .26), .014, black, U.box); }
    mb.between(new V3(-.17, wTop, zW + .22), new V3(.17, wTop, zW + .22), .016, black, U.box);
    mb.add(U.box, black, 0, wTop + .015, zW + .21, 0, 0, 0, .07, .025, .04); mb.add(U.box, 0x8fa0aa, 0, wTop + .015, zW + .232, 0, 0, 0, .06, .018, .004);   // specchietto
    // archi del tettuccio: più fitti sui tettucci intelaiati, pochi sulle bolle
    const bows = cn.framed ? [] : cn.bubble ? [.25] : [-.15, .3];   // i tettucci intelaiati hanno già gli archi del modello esterno
    for (const z of bows) { const arc = new THREE.TorusGeometry(halfW, .012, 4, 18, PI); mb.add(arc, black, 0, sillY, z, 0, 0, 0, 1, Math.max(.6, (topY - sillY) / halfW), 1.5); }
    if (cn.framed) for (const sx of [-1, 0, 1]) if (sx) mb.between(new V3(sx * halfW * .55, topY - .06, zW + .3), new V3(sx * halfW * .55, topY - .06, .55), .01, black, U.box);
    for (const sx of [-1, 1]) mb.between(new V3(sx * (halfW - .01), sillY + .02, zW), new V3(sx * (halfW - .01), sillY + .02, .6), .016, black, U.box);   // longheroni del bordo
    mb.add(U.box, metal, 0, .02, .5, 0, 0, 0, .3, .32, .04);   // corazza dietro la testa
  }
  g.add(groupMesh(mb.buildGroups(), false));
  if (!modern && (nat === 'de' || nat === 'uk' || type === 'p47' || type === 'p51')) { const ag = new THREE.Mesh(new THREE.BoxGeometry(.28, .26, .05), new THREE.MeshStandardMaterial({ color: 0x5f8a80, transparent: true, opacity: .16, roughness: .05, metalness: .3, depthWrite: false })); ag.position.set(0, (wy0 + wTop) / 2, zW + .1); ag.rotation.x = -.45; ag.renderOrder = 4; g.add(ag); }   // vetro blindato
  // atlante degli strumenti
  if (!CK.atlas) { CK.atlas = document.createElement('canvas'); CK.atlas.width = 1024; CK.atlas.height = 512; CK.actx = CK.atlas.getContext('2d'); CK.atex = new THREE.CanvasTexture(CK.atlas); CK.atex.encoding = THREE.sRGBEncoding; CK.atex.anisotropy = 4; }
  const faceMat = new THREE.MeshBasicMaterial({ map: CK.atex, color: new THREE.Color(.85, .85, .82) }), bezMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .45, metalness: .6 });
  const panel = new THREE.Group(); panel.position.set(0, panY, zp); panel.rotation.x = -.1; g.add(panel);
  CK.gauges = [];
  const L = modern ? [] : [
    ['asi', 0, 0, -.17, .075, .052], ['ah', 1, 0, 0, .075, .062], ['alt', 2, 0, .17, .075, .052],
    ['turn', 3, 0, -.17, -.075, .046], ['hdg', 4, 0, 0, -.08, .05], ['vsi', 5, 0, .17, -.075, .046],
    ['rpm', 6, 0, panW / 2 - .055, .1, .034], ['map', 7, 0, panW / 2 - .055, .02, .034], ['oil', 0, 1, panW / 2 - .055, -.06, .034],
    ['fuel', 1, 1, -panW / 2 + .055, .1, .034], ['clock', 2, 1, -panW / 2 + .055, .02, .034], ['gm', 3, 1, -panW / 2 + .055, -.06, .034]];
  for (const [id, c, r, x, y, rad] of L) {
    const face = new THREE.Mesh(ckCell(new THREE.CircleGeometry(rad, 40), c, r), faceMat); face.position.set(x, y, .017); panel.add(face);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(rad + .004, .006, 6, 32), bezMat); bez.position.set(x, y, .018); panel.add(bez);
    CK.gauges.push({ id, c, r });
  }
  // spie: carrello (verdi e rosse), incendio del motore
  CK.lamps = {};
  const lamp = (id, x, y, hex) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.009, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(hex), emissiveIntensity: 0 })); m.position.set(x, y, .02); panel.add(m); CK.lamps[id] = m; };
  if (!modern) { lamp('gL', -.06, -.155, 0x40ff50); lamp('gR', -.03, -.155, 0x40ff50); lamp('gT', -.045, -.135, 0xff3020); lamp('fire', .05, -.15, 0xff5010); }
  // schermi multifunzione (F-47)
  if (modern) {
    if (!CK.mfd) { CK.mfd = document.createElement('canvas'); CK.mfd.width = 1024; CK.mfd.height = 256; CK.mctx = CK.mfd.getContext('2d'); CK.mtex = new THREE.CanvasTexture(CK.mfd); CK.mtex.encoding = THREE.sRGBEncoding; }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(panW * .96, panW * .96 / 4), new THREE.MeshBasicMaterial({ map: CK.mtex })); scr.position.set(0, .01, .017); panel.add(scr);
  }
  // collimatore: reticolo luminoso sull'asse degli occhi (o visore a testa alta)
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const s2 = sc.getContext('2d');
  s2.strokeStyle = s2.fillStyle = modern ? 'rgba(90,255,140,1)' : 'rgba(255,170,70,1)'; s2.lineWidth = 2.5;
  if (modern) { s2.beginPath(); s2.arc(64, 64, 10, 0, TAU); s2.stroke(); for (const [a, b, c, d] of [[64, 30, 64, 50], [64, 78, 64, 98], [30, 64, 50, 64], [78, 64, 98, 64]]) { s2.beginPath(); s2.moveTo(a, b); s2.lineTo(c, d); s2.stroke(); } }
  else { s2.beginPath(); s2.arc(64, 64, 50, 0, TAU); s2.stroke(); s2.beginPath(); s2.moveTo(64, 18); s2.lineTo(64, 52); s2.moveTo(64, 76); s2.lineTo(64, 110); s2.moveTo(18, 64); s2.lineTo(52, 64); s2.moveTo(76, 64); s2.lineTo(110, 64); s2.stroke(); s2.beginPath(); s2.arc(64, 64, 3, 0, TAU); s2.fill(); }
  const sight = new THREE.Mesh(new THREE.PlaneGeometry(.13, .13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: modern ? new THREE.Color(.6, 2.2, 1) : new THREE.Color(2.5, 1.6, .7) }));
  sight.position.set(0, 0, zp - .02 > -.7 ? -.7 : zp - .02); sight.renderOrder = 5; g.add(sight);
  const comb = new THREE.Mesh(new THREE.PlaneGeometry(.15, .12), new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: .12, roughness: .05, metalness: .5, depthWrite: false }));
  comb.position.set(0, -.02, sight.position.z + .01); comb.rotation.x = -.3; g.add(comb);
  // cloche (perno sul pavimento), manetta, pedaliera
  const stick = new THREE.Group(); stick.position.set(0, -.74, -.33); g.add(stick);
  const sm = new MB(); sm.mat = 'paint'; sm.add(U.cyl, metal, 0, .2, 0, 0, 0, 0, .014, .4, .014); sm.add(U.cyl12, black, 0, .44, 0, 0, 0, 0, .022, .1, .024); sm.add(U.box, 0xa02a1c, 0, .46, -.02, 0, 0, 0, .012, .025, .012); sm.add(U.cyl12, 0x2a2a28, 0, .02, 0, 0, 0, 0, .07, .04, .07);
  stick.add(groupMesh(sm.buildGroups(), false)); CK.stick = stick;
  const thr = new THREE.Group(); thr.position.set(-halfW + .07, -.37, -.32); g.add(thr);
  const tm = new MB(); tm.mat = 'paint'; tm.add(U.box, metal, 0, .07, 0, 0, 0, 0, .012, .14, .012); tm.add(U.sph, black, 0, .15, 0, 0, 0, 0, .025, .02, .03); thr.add(groupMesh(tm.buildGroups(), false)); CK.throttle = thr;
  CK.pedals = [];
  for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * .12, -.68, -.82); const pm = new MB(); pm.mat = 'paint'; pm.add(U.box, metal, 0, 0, 0, -.5, 0, 0, .08, .14, .015); pm.add(U.box, metal, 0, -.02, .05, 0, 0, 0, .02, .02, .12); p.add(groupMesh(pm.buildGroups(), false)); g.add(p); CK.pedals.push(p); }
  g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; if (o.material && !o.material.map && o.material !== faceMat) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } } });
  CK.nat = nat; CK.modern = modern; CK.spec = sp;
  PL.cockpit = g; PL.cockpitType = type; PL.gctx = CK.actx; PL.gtex = CK.atex;
  return g;
}

// ---------- disegno degli strumenti ----------
function ckDial(x, cx, cy, R, ticks, labels, a0 = -PI * .75, a1 = PI * .75, title = '', sub = '') {
  x.fillStyle = '#0d0d0c'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
  x.strokeStyle = '#e8e4d6'; x.fillStyle = '#e8e4d6';
  for (let k = 0; k <= ticks; k++) { const a = a0 + (a1 - a0) * k / ticks - PI / 2, big = k % (ticks / (labels.length - 1 || 1)) === 0; x.lineWidth = big ? 2.4 : 1.2; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * (big ? .78 : .86), cy + Math.sin(a) * R * (big ? .78 : .86)); x.lineTo(cx + Math.cos(a) * R * .95, cy + Math.sin(a) * R * .95); x.stroke(); }
  x.font = 'bold ' + Math.round(R * .2) + 'px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  labels.forEach((t, i) => { const a = a0 + (a1 - a0) * i / (labels.length - 1) - PI / 2; x.fillText(t, cx + Math.cos(a) * R * .6, cy + Math.sin(a) * R * .6); });
  x.font = Math.round(R * .14) + 'px Arial'; x.fillStyle = '#c9c3ad'; if (title) x.fillText(title, cx, cy - R * .28); if (sub) x.fillText(sub, cx, cy + R * .3);
}
function ckNeedle(x, cx, cy, R, a, len = .82, w = 3, c = '#f4eedc') {
  const s = a - PI / 2; x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - Math.cos(s) * R * .15, cy - Math.sin(s) * R * .15); x.lineTo(cx + Math.cos(s) * R * len, cy + Math.sin(s) * R * len); x.stroke();
  x.fillStyle = '#333'; x.beginPath(); x.arc(cx, cy, R * .07, 0, TAU); x.fill();
}
function drawGauges() {
  const me = PL.me, x = CK.actx; if (!x || !me) return;
  const metric = CK.nat === 'de' || CK.nat === 'jp', sp = me.vel.length() * 3.6, alt = me.pos.y, vs = me.vel.y;
  const f = _a1.set(0, 0, -1).applyQuaternion(me.q), r = _a2.set(1, 0, 0).applyQuaternion(me.q), u = _a3.set(0, 1, 0).applyQuaternion(me.q);
  const pitch = Math.asin(clamp(f.y, -1, 1)), roll = Math.atan2(-r.y, u.y), hdg = (Math.atan2(f.x, -f.z) + TAU) % TAU;
  // rateo di virata (per il virosbandometro) e consumo del carburante
  let dh = hdg - CK.hdgPrev; if (dh > PI) dh -= TAU; if (dh < -PI) dh += TAU; CK.turn = lerp(CK.turn, dh / .15, .3); CK.hdgPrev = hdg;
  CK.fuel = Math.max(.08, CK.fuel - .00006 * (.4 + PL.throttle));
  if (CK.modern) return drawMFD(sp, alt, vs, pitch, roll, hdg);
  const cell = (c, r) => [c * 128 + 64, r * 128 + 64];
  x.fillStyle = '#1d1e1c'; x.fillRect(0, 0, 1024, 512);
  const thr = PL.throttle, eng = me.parts ? me.parts.eng : 1, R = 60;
  let cx, cy;
  // anemometro
  [cx, cy] = cell(0, 0); { const v = metric ? sp : sp / 1.609, max = metric ? 800 : 500; ckDial(x, cx, cy, R, 20, metric ? ['0', '200', '400', '600', '800'] : ['0', '100', '200', '300', '400', '500'], -PI * .8, PI * .8, metric ? 'km/h' : 'MPH', ''); ckNeedle(x, cx, cy, R, -PI * .8 + clamp(v / max, 0, 1) * PI * 1.6); }
  // orizzonte artificiale
  [cx, cy] = cell(1, 0); x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); x.translate(cx, cy); x.rotate(roll);
  const ph = clamp(pitch, -.8, .8) * 90; x.fillStyle = '#4f7a9e'; x.fillRect(-100, -200 + ph, 200, 200); x.fillStyle = '#3d2c1c'; x.fillRect(-100, ph, 200, 200);
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-80, ph); x.lineTo(80, ph); x.stroke(); x.lineWidth = 1;
  for (let k = -3; k <= 3; k++) if (k) { x.beginPath(); x.moveTo(-14, ph - k * 15); x.lineTo(14, ph - k * 15); x.stroke(); }
  x.restore(); x.strokeStyle = '#f0b030'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 34, cy); x.lineTo(cx - 10, cy); x.lineTo(cx, cy + 8); x.lineTo(cx + 10, cy); x.lineTo(cx + 34, cy); x.stroke();
  x.fillStyle = '#e8e4d6'; x.beginPath(); x.moveTo(cx, cy - R + 4); x.lineTo(cx - 6, cy - R + 14); x.lineTo(cx + 6, cy - R + 14); x.fill();
  // altimetro a due lancette (centinaia e migliaia)
  [cx, cy] = cell(2, 0); { const a = metric ? alt : alt * 3.281, unit = metric ? 1000 : 10000; ckDial(x, cx, cy, R, 50, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], 0, TAU * .999, metric ? 'm ×100' : 'FT ×100', '');
    ckNeedle(x, cx, cy, R, (a % (unit / 10)) / (unit / 10) * TAU, .85, 2.5); ckNeedle(x, cx, cy, R, (a % unit) / unit * TAU, .55, 5, '#e0d8b8'); }
  // virosbandometro: lancetta del rateo di virata e pallina dello sbandamento
  [cx, cy] = cell(3, 0); ckDial(x, cx, cy, R, 4, ['L', '', 'R'], -PI * .3, PI * .3, 'TURN', '');
  ckNeedle(x, cx, cy, R, clamp(CK.turn * 1.5, -.9, .9), .85, 4);
  x.strokeStyle = '#888'; x.lineWidth = 12; x.beginPath(); x.arc(cx, cy - 40, 70, PI * .36, PI * .64); x.stroke();
  const slip = clamp(-(PL.rudder || 0) * .4 + Math.sin(roll) * .2 - CK.turn * .4, -.12, .12); x.fillStyle = '#111'; x.beginPath(); x.arc(cx + Math.sin(slip * 2) * 70, cy - 40 + Math.cos(slip * 2) * 70, 6, 0, TAU); x.fill();
  // girobussola: rosa che ruota sotto l'indice
  [cx, cy] = cell(4, 0); x.fillStyle = '#0d0d0c'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
  x.save(); x.translate(cx, cy); x.rotate(-hdg); x.fillStyle = x.strokeStyle = '#e8e4d6'; x.font = 'bold 13px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; x.save(); x.rotate(a); x.lineWidth = k % 3 ? 1 : 2; x.beginPath(); x.moveTo(0, -R * .95); x.lineTo(0, -R * (k % 3 ? .86 : .78)); x.stroke(); if (k % 9 === 0) x.fillText(['N', 'E', 'S', 'W'][k / 9], 0, -R * .62); else if (k % 3 === 0) x.fillText(String(k), 0, -R * .62); x.restore(); }
  x.restore(); x.fillStyle = '#f0b030'; x.beginPath(); x.moveTo(cx, cy - R + 2); x.lineTo(cx - 7, cy - R + 16); x.lineTo(cx + 7, cy - R + 16); x.fill();
  x.strokeStyle = '#f0b030'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy - 16); x.lineTo(cx, cy + 22); x.moveTo(cx - 16, cy); x.lineTo(cx + 16, cy); x.stroke();
  // variometro
  [cx, cy] = cell(5, 0); { const v = metric ? vs : vs * 196.85 / 1000, m = metric ? 30 : 6; ckDial(x, cx, cy, R, 12, metric ? ['30', '15', '0', '15', '30'] : ['6', '3', '0', '3', '6'], -PI, 0, metric ? 'm/s' : '×1000 FT/MIN', ''); ckNeedle(x, cx, cy, R, -PI / 2 + clamp(v / m, -1, 1) * PI / 2); }
  // contagiri, pressione d'alimentazione, olio (temperatura e pressione)
  const rpm = (1200 + thr * 1500 + clamp(sp / 700, 0, 1) * 250) * (eng < .2 ? .6 : 1) + Math.sin(GAME.time * 31) * 8;
  [cx, cy] = cell(6, 0); ckDial(x, cx, cy, R, 14, ['0', '10', '20', '30', '35'], -PI * .75, PI * .75, 'RPM ×100', ''); ckNeedle(x, cx, cy, R, -PI * .75 + clamp(rpm / 3500, 0, 1) * PI * 1.5);
  const mp = metric ? .7 + thr * .75 : 18 + thr * 34;
  [cx, cy] = cell(7, 0); ckDial(x, cx, cy, R, 10, metric ? ['0.6', '1.0', '1.4', '1.8'] : ['10', '30', '50', '70'], -PI * .75, PI * .75, metric ? 'ata' : 'MAN. PRESS', ''); ckNeedle(x, cx, cy, R, -PI * .75 + clamp(metric ? (mp - .6) / 1.2 : (mp - 10) / 60, 0, 1) * PI * 1.5);
  const ot = 70 + thr * 15 + (1 - eng) * 60;
  [cx, cy] = cell(0, 1); ckDial(x, cx, cy, R, 8, ['0', '50', '100', '150'], -PI * .7, PI * .7, 'OIL °C', ''); ckNeedle(x, cx, cy, R, -PI * .7 + clamp(ot / 150, 0, 1) * PI * 1.4, .8, 3, ot > 115 ? '#ff6040' : '#f4eedc');
  [cx, cy] = cell(1, 1); ckDial(x, cx, cy, R, 4, ['E', '½', 'F'], -PI * .6, PI * .6, metric ? 'KRAFTSTOFF' : 'FUEL', ''); ckNeedle(x, cx, cy, R, -PI * .6 + CK.fuel * PI * 1.2);
  const d = new Date(); [cx, cy] = cell(2, 1); ckDial(x, cx, cy, R, 60, ['12', '3', '6', '9', '12'], 0, TAU * .999, '', ''); ckNeedle(x, cx, cy, R, (d.getHours() % 12 + d.getMinutes() / 60) / 12 * TAU, .5, 4); ckNeedle(x, cx, cy, R, d.getMinutes() / 60 * TAU, .78, 2.5); ckNeedle(x, cx, cy, R, d.getSeconds() / 60 * TAU, .85, 1, '#e05030');
  [cx, cy] = cell(3, 1); ckDial(x, cx, cy, R, 12, ['-4', '0', '4', '8', '12'], -PI * .75, PI * .75, 'G', ''); ckNeedle(x, cx, cy, R, -PI * .75 + clamp(((PL.G || 1) + 4) / 16, 0, 1) * PI * 1.5);
  CK.atex.needsUpdate = true;
  // spie
  const gk = PL.gearK ?? 0, L = CK.lamps;
  if (L.gL) { const down = gk > .98, moving = gk > .02 && gk < .98; L.gL.material.emissiveIntensity = L.gR.material.emissiveIntensity = down ? 2 : 0; L.gT.material.emissiveIntensity = moving ? 2 : 0; L.fire.material.emissiveIntensity = me.engFire && Math.sin(GAME.time * 12) > 0 ? 3 : 0; }
}
// cabina moderna: tre schermi su un'unica tela (assetto, situazione tattica, motore e armi)
function drawMFD(sp, alt, vs, pitch, roll, hdg) {
  const x = CK.mctx, me = PL.me; if (!x) return;
  x.fillStyle = '#05080a'; x.fillRect(0, 0, 1024, 256);
  const box = (x0) => { x.strokeStyle = '#2b3a40'; x.lineWidth = 4; x.strokeRect(x0 + 6, 6, 328, 244); };
  // assetto
  box(0); x.save(); x.beginPath(); x.rect(10, 10, 320, 236); x.clip(); x.translate(170, 128); x.rotate(roll);
  const ph = clamp(pitch, -1, 1) * 150; x.fillStyle = '#1d4e7a'; x.fillRect(-400, -500 + ph, 800, 500); x.fillStyle = '#5a3a1c'; x.fillRect(-400, ph, 800, 500);
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-300, ph); x.lineTo(300, ph); x.stroke(); x.fillStyle = '#fff'; x.font = '12px monospace'; x.textAlign = 'center';
  for (let k = -4; k <= 4; k++) if (k) { x.beginPath(); x.moveTo(-30, ph - k * 26); x.lineTo(30, ph - k * 26); x.stroke(); x.fillText(String(k * 10), 46, ph - k * 26 + 4); }
  x.restore(); x.strokeStyle = '#ffd040'; x.lineWidth = 4; x.beginPath(); x.moveTo(120, 128); x.lineTo(155, 128); x.lineTo(170, 140); x.lineTo(185, 128); x.lineTo(220, 128); x.stroke();
  x.fillStyle = '#7dffa0'; x.font = 'bold 20px monospace'; x.textAlign = 'left'; x.fillText(Math.round(sp) + ' KM/H', 18, 34); x.fillText('M ' + (PL.mach || 0).toFixed(2), 18, 58); x.textAlign = 'right'; x.fillText(Math.round(alt) + ' M', 322, 34); x.fillText((vs >= 0 ? '+' : '') + Math.round(vs) + ' M/S', 322, 58);
  x.textAlign = 'center'; x.fillText(String(Math.round(hdg * 180 / PI)).padStart(3, '0') + '°', 170, 236);
  // situazione tattica: aerei entro 8 km attorno al proprio, ruotati sulla prua
  box(342); x.save(); x.beginPath(); x.rect(350, 10, 320, 236); x.clip(); x.translate(512, 150); x.strokeStyle = '#21463a'; x.lineWidth = 1.5;
  for (const r of [40, 80, 120]) { x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke(); }
  x.fillStyle = '#7dffa0'; x.beginPath(); x.moveTo(0, -9); x.lineTo(-7, 8); x.lineTo(7, 8); x.fill();
  if (typeof PLANES !== 'undefined' && me) for (const q of PLANES) { if (q === me || !q.alive) continue; const dx = q.pos.x - me.pos.x, dz = q.pos.z - me.pos.z; const c = Math.cos(hdg), s = Math.sin(hdg), rx = (dx * c + dz * s) / 8000 * 120, ry = (dx * s - dz * c) / 8000 * 120; if (Math.hypot(rx, ry) > 130) continue; x.fillStyle = q.team === 'E' ? '#ff5a4a' : '#5ab8ff'; x.fillRect(rx - 4, -ry - 4, 8, 8); }
  x.restore(); x.fillStyle = '#7dffa0'; x.font = 'bold 16px monospace'; x.textAlign = 'left'; x.fillText('SIT · 8 KM', 358, 30);
  // motore e armi
  box(684); x.textAlign = 'left'; x.font = 'bold 18px monospace'; const thr = PL.throttle;
  x.fillStyle = '#7dffa0'; x.fillText('SPINTA', 700, 36); x.fillStyle = '#16301f'; x.fillRect(700, 46, 300, 18); x.fillStyle = thr > .9 ? '#ffb040' : '#7dffa0'; x.fillRect(700, 46, 300 * thr, 18);
  x.fillStyle = '#7dffa0'; x.fillText('CARB  ' + Math.round(CK.fuel * 100) + '%', 700, 96); x.fillText('G     ' + (PL.G || 1).toFixed(1), 700, 124);
  x.fillText('CARR  ' + ((PL.gearK ?? 0) > .98 ? 'GIÙ' : (PL.gearK ?? 0) < .02 ? 'SU' : '···'), 700, 152); x.fillText('BOMBE ' + (PL.bombs ?? 0), 700, 180);
  if (me && me.parts) { x.fillStyle = me.parts.eng < .4 ? '#ff5a4a' : '#7dffa0'; x.fillText('MOTORE ' + Math.round(me.parts.eng * 100) + '%', 700, 214); }
  CK.mtex.needsUpdate = true;
}
// animazione dei comandi (ogni fotogramma)
function updateCockpit(dt) {
  if (!PL.cockpit || !PL.cockpit.visible) return;
  if (CK.stick) { CK.stick.rotation.x = lerp(CK.stick.rotation.x, -(PL.stickY || 0) * .3, Math.min(1, dt * 12)); CK.stick.rotation.z = lerp(CK.stick.rotation.z, -(PL.stickX || 0) * .3, Math.min(1, dt * 12)); }
  if (CK.throttle) CK.throttle.rotation.x = lerp(CK.throttle.rotation.x, -.5 + (1 - (PL.throttle || 0)) * .9, Math.min(1, dt * 10));
  CK.pedals.forEach((p, i) => { p.position.z = lerp(p.position.z, -.82 + (i ? -1 : 1) * (PL.rudder || 0) * .05, Math.min(1, dt * 10)); });
}
