"use strict";
// ============================================================
//  Modelli delle armi (vista in prima persona, armi a terra e
//  armi dei soldati): profili laterali arrotondati, canne tornite,
//  ponticelli, fascette, otturatori e mire. Misure in metri,
//  la canna punta verso -z.
// ============================================================

// parallelepipedo con spigoli smussati
function rbox(p, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const r = Math.min(sx, sy) * .22, bev = Math.min(sz * .3, r, .004), w = sx / 2 - r, h = sy / 2 - r;
  const s = new THREE.Shape();
  s.moveTo(-w, -sy / 2); s.lineTo(w, -sy / 2); s.quadraticCurveTo(sx / 2, -sy / 2, sx / 2, -h); s.lineTo(sx / 2, h); s.quadraticCurveTo(sx / 2, sy / 2, w, sy / 2);
  s.lineTo(-w, sy / 2); s.quadraticCurveTo(-sx / 2, sy / 2, -sx / 2, h); s.lineTo(-sx / 2, -h); s.quadraticCurveTo(-sx / 2, -sy / 2, -w, -sy / 2);
  const d = Math.max(.0005, sz - bev * 2), g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * .5, bevelOffset: -bev * .5, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m;
}
// pezzo tornito lungo l'asse della canna: pts = [raggio, distanza in avanti]
function turn(p, mat, x, y, z, pts, seg = 18) {
  const g = new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), seg);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.x = -PI / 2; p.add(m); return m;
}
// fascetta: anello con bordi arrotondati attorno alla cassa
function band(p, mat, y, z, rw, rh, w) {
  const g = new THREE.TorusGeometry(1, .18, 6, 20); const m = new THREE.Mesh(g, mat);
  m.position.set(0, y, z); m.scale.set(rw, rh, w / .36); p.add(m); return m;
}
// ponticello e grilletto
function guard(p, mat, y, z, r = .024) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, .0035, 6, 18, PI * 1.05), mat); t.position.set(0, y, z); t.rotation.set(0, PI / 2, PI + .05); t.scale.set(1, .85, 1); p.add(t);
  const tr = new THREE.Mesh(new THREE.TorusGeometry(.014, .0028, 5, 10, PI * .55), mat); tr.position.set(0, y + .008, z + .004); tr.rotation.set(0, PI / 2, PI * 1.2); p.add(tr);
}
// maglietta per la cinghia
function swivel(p, mat, y, z) { const t = new THREE.Mesh(new THREE.TorusGeometry(.009, .0018, 5, 12), mat); t.position.set(0, y, z); t.rotation.y = PI / 2; p.add(t); }
// vite a testa tonda sul fianco
function screw(p, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, .003, 10), mat); m.position.set(x, y, z); m.rotation.z = PI / 2; p.add(m); }

function buildGun(id) {
  const g = new THREE.Group(); let i = {};
  if (id === 'garand' || id === 'kar98' || id === 'springfield' || id === 'kar98zf') {
    const K = id === 'kar98' || id === 'kar98zf', W = K ? VM.wood2 : VM.wood, Mt = id === 'garand' ? VM.metal : VM.blue;
    // calcio e cassa: calciolo, nasello, impugnatura a pistola, astina
    prof(g, [[.44, -.042, 1], [.436, .03, 1], [.3, .036], [.18, .024], [.1, .01], [.055, 0, 1], [-.02, 0, 1], [-.05, .012, 1], [-.3, .012], [-.6, .008], [-.625, -.003, 1],
      [-.6, -.022], [-.3, -.028], [-.1, -.032], [-.02, -.035, 1], [.03, -.04], [.06, -.066], [K ? .075 : .08, -.086], [.11, -.086], [.14, -.064], [.28, -.084], [.43, -.107, 1], [.442, -.094, 1]], .044, W);
    // calciolo metallico e dischetto (Kar98)
    prof(g, [[.444, -.104, 1], [.446, .032, 1], [.452, .032, 1], [.45, -.104, 1]], .046, Mt, 0, .002);
    if (K) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .049, 16), Mt); d.position.set(0, -.03, .33); d.rotation.z = PI / 2; g.add(d); }
    // copricanna superiore
    prof(g, [[-.08, .012, 1], [-.09, .028], [-.3, .034], [-.32, .012, 1]], .036, W);
    if (!K) prof(g, [[-.38, .012, 1], [-.39, .028], [-.57, .026], [-.58, .012, 1]], .034, W);
    // canna tornita con rastremazione
    turn(g, Mt, 0, .03, -.05, [[0, 0], [.0135, 0], [.0128, .3], [.0115, .7], [.0108, .96], [0, .96]]);
    // fascette
    if (K) { band(g, Mt, .008, -.34, .028, .032, .012); band(g, Mt, .012, -.6, .025, .03, .02); rbox(g, Mt, 0, -.012, -.63, .008, .014, .03); }
    else { band(g, Mt, .01, -.335, .026, .03, .014); band(g, Mt, .012, -.6, .024, .03, .02); }
    guard(g, Mt, -.052, .01);
    swivel(g, Mt, -.1, .3); swivel(g, Mt, -.026, -.6);
    screw(g, Mt, .023, -.02, -.05); screw(g, Mt, -.023, -.02, -.05);
    let mag = null, bolt = null;
    if (id === 'garand') {
      // castello, leva d'armamento a destra, alzo a tamburo, cilindro del gas e mirino con orecchie
      prof(g, [[.07, 0, 1], [.07, .034], [.048, .05], [-.04, .052], [-.12, .046], [-.17, .032, 1], [-.17, 0, 1]], .032, Mt);
      rbox(g, Mt, .021, .03, -.3, .007, .012, .44);
      rbox(g, Mt, .028, .028, -.07, .014, .018, .03);
      for (const sx of [-1, 1]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .006, 14), Mt); k.position.set(sx * .022, .058, .055); k.rotation.z = PI / 2; g.add(k); }
      turn(g, Mt, 0, .012, -.78, [[0, 0], [.0145, 0], [.0145, .12], [.012, .13], [0, .13]]);
      for (const sx of [-1, 1]) rbox(g, Mt, sx * .007, .058, -.905, .003, .022, .01);
      addSights(g, 'aperture', .068, .055, -.905, Mt);
      mag = new THREE.Group(); mag.position.set(0, .052, -.045); g.add(mag);
      rbox(mag, VM.brass, 0, 0, 0, .022, .012, .062);
      for (let k = 0; k < 4; k++) turn(mag, VM.brass, k % 2 ? .005 : -.005, .008, -.02 + k * .015, [[0, -.012], [.005, -.012], [.005, .006], [.0025, .012], [0, .014]], 8);
    } else {
      // castello cilindrico, otturatore girevole con manubrio piegato e pomolo
      turn(g, Mt, 0, .028, .07, [[0, 0], [.016, 0], [.017, .02], [.017, .22], [.0155, .24], [0, .24]]);
      rbox(g, Mt, 0, .012, -.02, .03, .022, .14);
      bolt = new THREE.Group(); bolt.position.set(0, .028, .03); g.add(bolt);
      turn(bolt, Mt, 0, 0, .06, [[0, 0], [.0095, 0], [.0095, .1], [.012, .105], [0, .11]]);
      const hd = new THREE.Group(); hd.position.set(.01, 0, .03); bolt.add(hd);
      const bend = K ? -.75 : -.35;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .005, .055, 10), Mt); st.position.set(.026, -.012 + (K ? -.008 : 0), 0); st.rotation.z = PI / 2 + bend; hd.add(st);
      const kb = new THREE.Mesh(U.sph, Mt); kb.scale.setScalar(.011); kb.position.set(.048, K ? -.036 : -.02, 0); hd.add(kb);
      mag = new THREE.Group(); mag.position.set(0, .046, -.04); g.add(mag);
      for (let k = 0; k < 5; k++) turn(mag, VM.brass, 0, 0, -.02 + k * .01, [[0, -.015], [.005, -.015], [.005, .008], [.0025, .015], [0, .017]], 8);
      if (id === 'kar98') { addSights(g, 'notch', .06, -.17, -.86, Mt, true); rbox(g, Mt, 0, .044, -.17, .02, .012, .05); }
      if (id === 'springfield') { rbox(g, Mt, 0, .04, .1, .018, .02, .03); }
      if (id === 'springfield' || id === 'kar98zf') {
        // cannocchiale con oculare, obiettivo, attacchi e torrette
        turn(g, VM.blue, 0, .085, .17, [[0, 0], [.019, 0], [.019, .06], [.013, .08], [.013, .3], [.018, .33], [.018, .38], [0, .38]], 20);
        rbox(g, VM.blue, 0, .062, .04, .014, .03, .018); rbox(g, VM.blue, 0, .062, -.12, .014, .03, .018);
        const k1 = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .016, 14), VM.blue); k1.position.set(0, .1, -.04); g.add(k1);
        const k2 = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .016, 14), VM.blue); k2.position.set(.016, .085, -.04); k2.rotation.z = PI / 2; g.add(k2);
        CZ(g, VM.glass, 0, .085, .171, .016, .004);
      }
    }
    i = { mag, bolt, muzzle: new V3(0, .03, -1.01), port: new V3(.02, .05, -.04), hip: new V3(.16, -.17, -.32), ads: new V3(0, -.068, -.17), grip: new V3(0, -.045, .065), fore: new V3(0, -.014, -.38), magOut: new V3(0, .2, 0) };
    if (id === 'springfield' || id === 'kar98zf') i.ads = new V3(0, -.085, -.12);
    if (id === 'kar98') i.ads = new V3(0, -.06, -.16);
  } else if (id === 'thompson') {
    // calcio, castello arrotondato, impugnatura e astina verticale con scanalature, canna alettata e compensatore
    prof(g, [[.36, .012, 1], [.36, -.092, 1], [.25, -.07], [.14, -.046], [.1, -.03, 1], [.1, .014, 1], [.2, .02], [.3, .02]], .042, VM.wood);
    prof(g, [[.1, 0, 1], [.1, .05], [.08, .057], [-.15, .057], [-.18, .042, 1], [-.18, 0, 1]], .046, VM.metal);
    rbox(g, VM.metal, 0, -.006, -.04, .044, .03, .24);
    prof(g, [[.04, 0, 1], [.05, -.03], [.068, -.07], [.072, -.1], [.045, -.112, 1], [.024, -.105], [.02, -.06], [.012, -.03], [0, -.012, 1]], .034, VM.wood);
    prof(g, [[-.17, -.02, 1], [-.165, -.05], [-.175, -.06], [-.168, -.075], [-.178, -.088], [-.17, -.11, 1], [-.21, -.115, 1], [-.215, -.08], [-.212, -.04], [-.22, -.02, 1]], .034, VM.wood);
    guard(g, VM.metal, -.04, .02, .02);
    turn(g, VM.metal, 0, .035, -.18, [[0, 0], [.0145, 0], [.0145, .28], [0, .28]]);
    for (let k = 0; k < 11; k++) turn(g, VM.metal, 0, .035, -.2 - k * .011, [[.0145, 0], [.019, .002], [.019, .004], [.0145, .006]], 16);
    turn(g, VM.metal, 0, .035, -.44, [[0, 0], [.016, 0], [.018, .01], [.018, .055], [.014, .06], [0, .06]]);
    addSights(g, 'aperture', .078, .075, -.445, VM.metal);
    const ck = new THREE.Mesh(U.sph, VM.metal); ck.scale.setScalar(.008); ck.position.set(0, .062, -.06); g.add(ck);
    screw(g, VM.metal, .024, .02, .06); screw(g, VM.metal, -.024, .02, .06);
    swivel(g, VM.metal, -.08, .3);
    const mag = new THREE.Group(); mag.position.set(0, -.09, -.11); g.add(mag);
    rbox(mag, VM.metal, 0, 0, 0, .026, .17, .046); rbox(mag, VM.metal, 0, -.086, 0, .03, .008, .05);
    i = { mag, muzzle: new V3(0, .035, -.5), port: new V3(.025, .05, -.02), hip: new V3(.15, -.16, -.3), ads: new V3(0, -.078, -.2), grip: new V3(0, -.055, .03), fore: new V3(0, -.07, -.19), magOut: new V3(0, -.25, .05), charge: new V3(0, .062, -.06) };
  } else if (id === 'bar') {
    prof(g, [[.45, .022, 1], [.45, -.1, 1], [.3, -.07], [.13, -.032], [.1, .02, 1], [.25, .03], [.4, .03]], .046, VM.wood);
    prof(g, [[.1, -.02, 1], [.112, -.06], [.128, -.105], [.1, -.12, 1], [.075, -.11], [.07, -.06], [.05, -.02, 1]], .034, VM.wood);
    prof(g, [[.455, -.102, 1], [.455, .024, 1], [.46, .024, 1], [.46, -.102, 1]], .048, VM.metal, 0, .002);
    prof(g, [[.12, 0, 1], [.12, .058], [.1, .062], [-.27, .062], [-.3, .04, 1], [-.3, -.02, 1], [0, -.02], [.02, 0, 1]], .052, VM.metal);
    prof(g, [[-.3, 0, 1], [-.31, .04], [-.52, .038], [-.53, 0, 1], [-.5, -.012], [-.33, -.012]], .05, VM.wood);
    turn(g, VM.metal, 0, .045, -.3, [[0, 0], [.0145, 0], [.0135, .6], [0, .6]]);
    turn(g, VM.metal, 0, .01, -.52, [[0, 0], [.012, 0], [.012, .3], [0, .3]]);
    turn(g, VM.metal, 0, .045, -.9, [[0, 0], [.019, 0], [.02, .01], [.02, .07], [.016, .075], [0, .075]]);
    for (let k = 0; k < 3; k++) rbox(g, VM.sight, 0, .045, -.92 - k * .016, .042, .003, .005);
    guard(g, VM.metal, -.045, .05);
    addSights(g, 'aperture', .086, .1, -.9, VM.metal);
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.005, .004, .36, 8), VM.metal); l.position.set(sx * .025, .02, -.7); l.rotation.x = PI / 2 + .04; g.add(l); rbox(g, VM.metal, sx * .025, .012, -.88, .012, .006, .02); }
    const mag = new THREE.Group(); mag.position.set(0, -.05, -.12); g.add(mag);
    rbox(mag, VM.metal, 0, 0, 0, .034, .1, .074);
    i = { mag, muzzle: new V3(0, .045, -.97), port: new V3(.028, .04, -.05), hip: new V3(.17, -.17, -.3), ads: new V3(0, -.086, -.17), grip: new V3(0, -.06, .085), fore: new V3(0, -.02, -.4), magOut: new V3(0, -.25, 0), charge: new V3(-.03, .03, -.2) };
  } else if (id === 'colt') {
    const slide = new THREE.Group(); g.add(slide);
    prof(slide, [[.04, .03, 1], [.04, .058], [.035, .062], [-.165, .062], [-.17, .056], [-.17, .035, 1], [-.02, .03, 1]], .028, VM.metal);
    for (let k = 0; k < 7; k++) rbox(slide, VM.sight, 0, .046, .008 + k * .0045, .0295, .022, .0014);
    addSights(slide, 'notch', .071, .03, -.16, VM.metal);
    turn(slide, VM.metal, 0, .045, -.172, [[0, 0], [.009, 0], [.009, .006], [0, .006]]);
    prof(g, [[.04, .03, 1], [.03, .012], [-.12, .012], [-.125, .03, 1]], .027, VM.metal);
    prof(g, [[.035, .014, 1], [.05, -.03], [.064, -.082], [.055, -.096, 1], [.03, -.098, 1], [.015, -.05], [0, -.002, 1]], .033, VM.wood2);
    for (const sx of [-1, 1]) screw(g, VM.metal, sx * .017, -.012, .04);
    guard(g, VM.metal, -.006, -.02, .018);
    rbox(g, VM.metal, 0, .058, .046, .01, .022, .012, -.5);
    const mag = new THREE.Group(); mag.position.set(0, -.08, .015); g.add(mag);
    rbox(mag, VM.metal, 0, 0, 0, .024, .012, .04);
    i = { mag, slide, muzzle: new V3(0, .045, -.19), port: new V3(.016, .05, -.04), hip: new V3(.13, -.14, -.32), ads: new V3(0, -.071, -.28), grip: new V3(0, -.04, .02), fore: new V3(-.012, -.065, .03), magOut: new V3(0, -.2, 0) };
  } else if (id === 'bazooka') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, 1.45, 24, 1, true), VM.olive); tube.rotation.x = PI / 2; tube.position.z = -.3; g.add(tube);
    turn(g, VM.olive, 0, 0, .38, [[.046, 0], [.07, -.14], [.072, -.145], [.048, .005]], 24);
    for (const z of [-1.02, -.6, -.1, .3]) band(g, VM.olive, 0, z, .05, .05, .02);
    prof(g, [[.18, -.04, 1], [.18, -.1, 1], [-.08, -.08], [-.08, -.04, 1]], .045, VM.wood);
    prof(g, [[-.04, -.04, 1], [-.03, -.09], [-.022, -.13], [-.06, -.135, 1], [-.07, -.09], [-.08, -.04, 1]], .03, VM.wood);
    prof(g, [[-.33, -.04, 1], [-.32, -.09], [-.31, -.13], [-.35, -.135, 1], [-.36, -.09], [-.37, -.04, 1]], .03, VM.wood);
    guard(g, VM.metal, -.06, -.02, .02);
    addSights(g, 'frame', .045, -.2, -.55, VM.metal, false, -.066);
    rbox(g, VM.olive, 0, -.065, -.22, .04, .05, .1);
    const mag = new THREE.Group(); mag.position.set(0, 0, -1.09); g.add(mag);
    turn(mag, VM.olive, 0, 0, .07, [[0, 0], [.04, 0], [.042, -.08], [.03, -.16], [.008, -.2], [0, -.2]], 18);
    i = { mag, muzzle: new V3(0, 0, -1.05), hip: new V3(.2, -.13, -.25), ads: new V3(.066, -.045, -.22), grip: new V3(0, -.11, -.04), fore: new V3(0, -.11, -.34), magOut: new V3(0, 0, -.5) };
  } else if (id === 'mp40') {
    // castello tubolare scanalato, impugnatura in bachelite, calcio ripiegabile, poggia-canna
    turn(g, VM.blue, 0, .03, .07, [[0, 0], [.02, 0], [.021, .005], [.021, .3], [.017, .31], [0, .31]]);
    for (let k = 0; k < 8; k++) turn(g, VM.sight, 0, .03, -.03 - k * .022, [[.0212, 0], [.0215, .002], [.0215, .006], [.0212, .008]], 16);
    turn(g, VM.blue, 0, .03, -.24, [[0, 0], [.012, 0], [.0105, .17], [.013, .175], [.013, .19], [0, .19]]);
    prof(g, [[-.33, .002, 1], [-.33, .02], [-.4, .02, 1], [-.41, -.004, 1], [-.36, -.012, 1]], .016, VM.blue);
    prof(g, [[.07, .012, 1], [.07, -.02], [-.05, -.02], [-.13, -.03], [-.21, -.03, 1], [-.21, .012, 1]], .034, VM.blue);
    prof(g, [[.05, -.02, 1], [.062, -.05], [.072, -.09], [.05, -.102, 1], [.026, -.096], [.018, -.05], [.012, -.02, 1]], .032, VM.bake);
    guard(g, VM.blue, -.03, .0, .018);
    rbox(g, VM.blue, 0, -.035, -.17, .03, .04, .05);
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .25, 8), VM.blue); r.position.set(sx * .012, 0, .16); r.rotation.x = PI / 2; g.add(r); }
    prof(g, [[.29, .01, 1], [.3, -.07, 1], [.285, -.075], [.28, .005]], .03, VM.blue);
    addSights(g, 'notch', .064, 0, -.4, VM.blue, true);
    const ck = new THREE.Mesh(U.sph, VM.blue); ck.scale.setScalar(.008); ck.position.set(-.026, .03, -.05); g.add(ck);
    const mag = new THREE.Group(); mag.position.set(0, -.09, -.17); g.add(mag);
    rbox(mag, VM.blue, 0, 0, 0, .021, .2, .034);
    for (let k = 0; k < 4; k++) rbox(mag, VM.sight, .011, .06 - k * .04, 0, .002, .006, .02);
    i = { mag, muzzle: new V3(0, .03, -.43), port: new V3(.022, .04, -.05), hip: new V3(.15, -.15, -.3), ads: new V3(0, -.064, -.2), grip: new V3(0, -.045, .04), fore: new V3(0, -.1, -.17), magOut: new V3(0, -.25, 0), charge: new V3(-.03, .03, -.05) };
  }
  i.group = g; return i;
}

// mano in prima persona: palmo arrotondato, falangi a capsula piegate attorno all'impugnatura, pollice
const CAPS_G = new THREE.LatheGeometry([[0, -.5], [.6, -.42], [.9, -.25], [1, 0], [1, 1], [.9, 1.25], [.6, 1.42], [0, 1.5]].map(q => new THREE.Vector2(q[0], q[1] * .5)), 10);
function capsule(parent, mat, a, b, r) {
  const d = new V3().subVectors(b, a), m = new THREE.Mesh(CAPS_G, mat);
  m.position.copy(a); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize()); m.scale.set(r, d.length(), r); parent.add(m); return m;
}
function hand(parent, p, side) {
  const h = new THREE.Group(); h.position.copy(p); parent.add(h);
  const palm = new THREE.Mesh(U.sph, VM.skin); palm.scale.set(.02, .045, .045); palm.position.set(side * .008, -.004, .016); h.add(palm);
  const back = new THREE.Mesh(U.sph, VM.sleeve); back.scale.set(.03, .032, .04); back.position.set(side * .01, -.004, .06); h.add(back);
  for (let k = 0; k < 4; k++) {
    const y = .024 - k * .0175, l = k === 3 ? .78 : k === 0 ? .95 : 1, r = k === 3 ? .0068 : .0078;
    const p0 = new V3(side * -.002, y, -.012), p1 = new V3(side * -.016, y - .002, -.036 * l), p2 = new V3(side * -.034, y - .004, -.032 * l), p3 = new V3(side * -.04, y - .005, -.012 * l);
    capsule(h, VM.skin, p0, p1, r); capsule(h, VM.skin, p1, p2, r * .95); capsule(h, VM.skin, p2, p3, r * .9);
  }
  const t0 = new V3(side * .01, .03, .02), t1 = new V3(side * -.008, .045, -.012), t2 = new V3(side * -.022, .046, -.03);
  capsule(h, VM.skin, t0, t1, .0095); capsule(h, VM.skin, t1, t2, .0085);
  return h;
}
