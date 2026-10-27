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
// ---------- cruscotti dei singoli aerei ----------
// coordinate in metri sul pannello (x destra, y su, centro del pannello). Ogni strumento: [tipo, x, y, raggio, opzioni]
// w/h pannello, pc colore, px spostamento laterale, bfp pannello di volo strumentale (inglese), sub pannelli aggiuntivi,
// sight collimatore, stick impugnatura, extra dettagli caratteristici, lamps posizione delle spie
const CK_BLIND = [['asi', -.09, .06, .04], ['ah', 0, .06, .042], ['vsi', .09, .06, .04], ['alt', -.09, -.055, .04], ['dg', 0, -.055, .04], ['turn', .09, -.055, .04]];   // pannello di volo strumentale britannico: i «sei» in due file
const CK_LAY = {
  spit: { w: .6, h: .3, pc: 0x161616, bfp: [0, .003, .29, .24], sight: 'gm2', stick: 'uk', extra: ['compassFloor'], lamps: [-.23, -.035],
    g: [...CK_BLIND, ['boost', -.23, .07, .032], ['clock', -.23, -.1, .022], ['rpm', .23, .08, .034], ['oilp', .195, -.01, .022], ['oilt', .262, -.01, .022], ['cool', .195, -.08, .022], ['fuelp', .262, -.08, .022]] },
  hurri: { w: .64, h: .3, pc: 0x161616, bfp: [0, .003, .29, .24], sight: 'gm2', stick: 'uk', extra: ['compassFloor'], lamps: [-.25, -.035],
    g: [...CK_BLIND, ['boost', -.24, .07, .032], ['fuel', -.27, -.09, .024], ['clock', -.2, -.1, .02], ['rpm', .24, .08, .034], ['oilp', .21, -.01, .022], ['oilt', .275, -.01, .022], ['cool', .21, -.08, .022], ['fuelp', .275, -.08, .022]] },
  typhoon: { w: .66, h: .32, pc: 0x161616, bfp: [0, .003, .29, .24], sight: 'gm2', stick: 'uk', extra: ['compassFloor'], lamps: [-.26, -.04],
    g: [...CK_BLIND, ['boost', -.25, .08, .034], ['clock', -.25, -.1, .022], ['rpm', .25, .085, .036], ['oilp', .215, 0, .022], ['oilt', .285, 0, .022], ['cool', .215, -.075, .022], ['fuelp', .285, -.075, .022]] },
  mosquito: { w: .92, h: .32, px: .18, pc: 0x161616, bfp: [0, .003, .29, .24], sight: 'gm2', stick: 'uk', extra: ['compassFloor', 'seat2'], lamps: [-.22, -.04],
    g: [...CK_BLIND, ['clock', -.22, .07, .026], ['fuel', -.22, -.11, .022], ['rpm', .22, .085, .03, { lbl: 'PORT' }], ['rpm', .3, .085, .03, { lbl: 'STBD' }], ['boost', .22, .005, .027, { lbl: 'PORT' }], ['boost', .3, .005, .027, { lbl: 'STBD' }],
      ['cool', .2, -.075, .02], ['cool', .25, -.075, .02], ['oilp', .3, -.075, .02], ['oilt', .35, -.075, .02]] },
  p51: { w: .66, h: .34, pc: 0x1b1b1a, sight: 'k14', stick: 'us', extra: ['compassTop'], lamps: [-.27, -.135],
    g: [['clock', -.27, .1, .026], ['map', -.27, .02, .034], ['suct', -.27, -.075, .024], ['asi', -.14, .08, .042], ['alt', -.14, -.045, .042], ['ah', 0, .08, .046], ['dg', 0, -.045, .042],
      ['vsi', .14, .08, .042], ['turn', .14, -.045, .042], ['rpm', .27, .1, .034], ['eng3', .27, .02, .034], ['cool', .27, -.075, .026]] },
  p47: { w: .74, h: .36, pc: 0x1b1b1a, sight: 'n3', stick: 'us', extra: ['compassTop'], lamps: [-.3, -.145],
    g: [['map', -.3, .1, .034], ['clock', -.3, .02, .026], ['suct', -.3, -.08, .024], ['asi', -.16, .09, .044], ['alt', -.16, -.04, .044], ['ah', 0, .09, .048], ['dg', 0, -.04, .044],
      ['vsi', .16, .09, .044], ['turn', .16, -.04, .044], ['rpm', .3, .1, .034], ['turbo', .3, .02, .03], ['eng3', .3, -.08, .032]] },
  f4u: { w: .7, h: .34, pc: 0x1b1b1a, sight: 'n3', stick: 'us', extra: ['compassTop'], lamps: [-.29, -.14],
    g: [['map', -.29, .08, .032], ['clock', -.29, 0, .024], ['fuel', -.29, -.075, .026], ['asi', -.15, .08, .042], ['ah', 0, .085, .046], ['vsi', .15, .08, .042],
      ['alt', -.15, -.045, .042], ['dg', 0, -.05, .042], ['turn', .15, -.045, .042], ['rpm', .29, .08, .032], ['eng3', .29, 0, .03], ['cht', .29, -.075, .024]] },
  p40: { w: .62, h: .3, pc: 0x1b1b1a, sight: 'n3', stick: 'us', extra: ['compassTop'], lamps: [-.25, -.115],
    g: [['asi', -.12, .07, .04], ['ah', 0, .07, .044], ['vsi', .12, .07, .04], ['alt', -.12, -.05, .04], ['dg', 0, -.05, .04], ['turn', .12, -.05, .04],
      ['map', -.25, .06, .03], ['clock', -.25, -.04, .024], ['rpm', .25, .06, .03], ['eng3', .25, -.035, .028], ['cool', .25, -.105, .02]] },
  sbd: { w: .68, h: .32, pc: 0x1b1b1a, sight: 'tele', stick: 'us', extra: ['compassTop'], lamps: [-.28, -.12],
    g: [['asi', -.15, .07, .042], ['ah', 0, .075, .046], ['alt', .15, .07, .042], ['turn', -.15, -.05, .04], ['dg', 0, -.05, .042], ['vsi', .15, -.05, .04],
      ['map', -.28, .06, .03], ['clock', -.28, -.04, .024], ['rpm', .28, .06, .03], ['eng3', .28, -.04, .028]] },
  tbf: { w: .72, h: .32, pc: 0x1b1b1a, sight: 'n3', stick: 'us', extra: ['compassTop'], lamps: [-.3, -.12],
    g: [['asi', -.15, .07, .042], ['ah', 0, .075, .046], ['alt', .15, .07, .042], ['turn', -.15, -.05, .04], ['dg', 0, -.05, .042], ['vsi', .15, -.05, .04],
      ['map', -.29, .06, .03], ['clock', -.29, -.04, .024], ['rpm', .29, .06, .03], ['eng3', .29, -.035, .028], ['cht', .29, -.105, .02]] },
  bf109: { w: .5, h: .26, pc: 0x232527, sub: [[0, -.19, .34, .12]], sight: 'revi', stick: 'de', extra: ['breech131'], lamps: [0, -.235],
    g: [['asi', -.17, .04, .04], ['alt', -.17, -.07, .038], ['afn', -.06, .07, .028], ['turn', -.06, -.025, .032], ['ata', .06, .05, .036], ['dg', .06, -.06, .034], ['rpm', .175, .04, .04], ['clock', .18, -.08, .024],
      ['oilf', -.07, -.19, .03], ['press2', .07, -.19, .03], ['ammo', .015, .113, .022, { rect: [.05, .022] }], ['ammo', .085, .113, .022, { rect: [.05, .022] }]] },
  stuka: { w: .66, h: .3, pc: 0x232527, sight: 'revi', stick: 'de', extra: ['diveLines'], lamps: [-.27, -.125],
    g: [['clock', -.27, .07, .026], ['asi', -.15, .07, .042], ['ah', 0, .075, .046], ['alt', .15, .07, .042], ['turn', -.15, -.05, .04], ['dg', 0, -.05, .04], ['vsi', .15, -.05, .04],
      ['ata', .27, .07, .032], ['rpm', .27, -.02, .034], ['oilf', -.27, -.03, .026], ['fuel', -.27, -.1, .022], ['cool', .27, -.1, .022]] },
  me262: { w: .72, h: .3, pc: 0x232527, sight: 'revi', stick: 'de', extra: [], lamps: [-.3, -.125],
    g: [['asi', -.25, .07, .038], ['ah', -.13, .07, .042], ['alt', -.25, -.05, .038], ['dg', -.13, -.05, .04], ['turn', -.03, .07, .028], ['vsi', -.03, -.04, .028],
      ['rpm', .08, .08, .032, { lbl: 'L', jet: 1 }], ['rpm', .17, .08, .032, { lbl: 'R', jet: 1 }], ['egt', .08, -.01, .028, { lbl: 'L' }], ['egt', .17, -.01, .028, { lbl: 'R' }],
      ['fuelp', .27, .08, .024, { lbl: 'L' }], ['fuelp', .27, .01, .024, { lbl: 'R' }], ['oilp', .27, -.07, .024], ['fuel', .125, -.095, .026]] },
  zero: { w: .56, h: .3, pc: 0x23241f, sight: 'type98', stick: 'jp', extra: ['breech97'], lamps: [-.23, -.125],
    g: [['asi', -.17, .07, .036], ['turn', -.06, .08, .03], ['vsi', .06, .08, .03], ['alt', .17, .07, .036], ['rpm', -.17, -.04, .034], ['mmhg', -.06, -.035, .028], ['cmp', .05, -.055, .04], ['oilt', .17, -.04, .028], ['clock', .235, -.11, .018]] },
  val: { w: .58, h: .3, pc: 0x23241f, sight: 'tele', stick: 'jp', extra: ['breech97'], lamps: [-.24, -.125],
    g: [['asi', -.17, .07, .036], ['turn', -.06, .08, .03], ['vsi', .06, .08, .03], ['alt', .17, .07, .036], ['rpm', -.17, -.04, .034], ['mmhg', -.06, -.035, .028], ['cmp', .05, -.055, .04], ['oilt', .17, -.04, .028], ['ah', .245, .03, .026]] },
  kate: { w: .62, h: .3, pc: 0x23241f, sight: 'type98', stick: 'jp', extra: [], lamps: [-.26, -.125],
    g: [['asi', -.18, .07, .036], ['ah', -.06, .075, .036], ['vsi', .06, .075, .03], ['alt', .18, .07, .036], ['rpm', -.18, -.04, .034], ['mmhg', -.07, -.04, .028], ['cmp', .05, -.055, .04], ['oilt', .18, -.04, .028], ['turn', .255, .02, .024]] },
};
// etichette per nazione
const CK_LBL = {
  us: { asi: 'AIRSPEED', alt: 'ALTITUDE', vsi: 'RATE OF CLIMB', turn: 'TURN', rpm: 'RPM', map: 'MANIFOLD', oilt: 'OIL TEMP', oilp: 'OIL PRESS', fuel: 'FUEL', fuelp: 'FUEL PRESS', cool: 'COOLANT', suct: 'SUCTION', turbo: 'TURBO', cht: 'CYL HEAD', eng3: 'ENGINE', gm: 'G' },
  uk: { asi: 'AIR SPEED', alt: 'ALTIMETER', vsi: 'CLIMB', turn: 'TURN', rpm: 'R.P.M.', boost: 'BOOST', oilt: 'OIL °C', oilp: 'OIL LB', fuel: 'FUEL', fuelp: 'FUEL LB', cool: 'RAD °C', gm: 'G' },
  de: { asi: 'FAHRT', alt: 'HÖHE', vsi: 'STEIGEN', turn: 'WENDE', rpm: 'DREHZAHL', ata: 'LADEDRUCK', oilt: 'ÖL °C', oilp: 'ÖLDRUCK', fuel: 'KRAFTSTOFF', fuelp: 'KR.DRUCK', cool: 'KÜHLST.', egt: 'GASTEMP.', afn: 'AFN 2', gm: 'G' },
  jp: { asi: '速度 kt', alt: '高度 m', vsi: '昇降', turn: '旋回', rpm: '回転', mmhg: '吸気圧', oilt: '油温', fuel: '燃料', gm: 'G' },
};
// collimatori, impugnature e dettagli caratteristici
function ckSightModel(mb, g, style, sy, zp, wTop, zW) {
  const bk = 0x161616, mt = 0x55595c, glass = (w, h, y, z, rx) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x40505a, transparent: true, opacity: .14, roughness: .05, metalness: .5, depthWrite: false, side: THREE.DoubleSide })); m.position.set(0, y, z); m.rotation.x = rx; m.renderOrder = 4; g.add(m); };
  if (style === 'revi') {   // Revi C/12D: corpo cilindrico, testa con vetro riflettente e filtro antiabbagliante ribaltabile
    mb.add(U.cyl12, bk, 0, sy + .03, zp - .03, PI / 2, 0, 0, .035, .16, .035); mb.add(U.box, bk, 0, sy + .07, zp - .08, 0, 0, 0, .07, .05, .06);
    mb.add(U.box, 0x2a2a2a, 0, sy + .14, zp - .03, -.6, 0, 0, .06, .004, .05); glass(.075, .06, sy + .11, zp - .1, -.25);
    mb.add(U.box, 0x4a3828, 0, sy + .03, zp + .07, 0, 0, 0, .07, .06, .04);   // imbottitura
  } else if (style === 'gm2') {   // Mk II britannico: scatola, lampada, vetro riflettente e cuscinetto antiurto in pelle
    mb.add(U.box, bk, 0, sy + .035, zp - .02, 0, 0, 0, .075, .07, .17); mb.add(U.cyl12, mt, 0, sy + .035, zp + .075, PI / 2, 0, 0, .028, .03, .028);
    mb.add(U.box, 0x3a2a1c, 0, sy + .04, zp + .11, 0, 0, 0, .1, .07, .05); glass(.09, .07, sy + .11, zp - .08, -.3);
  } else if (style === 'k14') {   // K-14 giroscopico: corpo voluminoso con manopola della distanza
    mb.add(U.box, bk, 0, sy + .05, zp - .02, 0, 0, 0, .12, .1, .2); mb.add(U.cyl12, mt, .07, sy + .04, zp + .02, 0, 0, PI / 2, .03, .02, .03); mb.add(U.box, 0x3a2a1c, 0, sy + .05, zp + .1, 0, 0, 0, .12, .08, .04);
    glass(.1, .08, sy + .14, zp - .09, -.3);
  } else if (style === 'n3') {   // N-3B / Mk 8: scatola con lampada e vetro
    mb.add(U.box, bk, 0, sy + .035, zp - .01, 0, 0, 0, .07, .07, .15); mb.add(U.cyl12, mt, 0, sy + .07, zp + .03, 0, 0, 0, .022, .04, .022); glass(.085, .07, sy + .11, zp - .07, -.3);
  } else if (style === 'type98') {   // Tipo 98: tubo orizzontale con testa riflettente
    mb.add(U.cyl12, bk, 0, sy + .03, zp - .04, PI / 2, 0, 0, .03, .2, .03); mb.add(U.box, bk, 0, sy + .065, zp - .13, 0, 0, 0, .05, .04, .04); glass(.07, .06, sy + .1, zp - .14, -.25);
  } else if (style === 'tele') {   // cannocchiale che attraversa il parabrezza (SBD, Val): appena sotto la linea degli occhi
    const y = -.11; mb.add(U.cyl12, bk, 0, y, -.7, PI / 2, 0, 0, .02, .8, .02); mb.add(U.cyl12, 0x111111, 0, y, -.32, PI / 2, 0, 0, .026, .05, .026); mb.add(U.cyl12, mt, 0, y, -1.02, PI / 2, 0, 0, .03, .08, .03);
    for (const z of [-.45, -.8]) mb.add(U.box, mt, 0, (y + sy) / 2, z, 0, 0, 0, .015, Math.max(.02, y - sy), .015);
  }
}
function ckReticle(style) {
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const s = sc.getContext('2d'); s.lineWidth = 2.5;
  s.strokeStyle = s.fillStyle = style === 'modern' ? 'rgba(90,255,140,1)' : 'rgba(255,170,70,1)';
  const ln = (a, b, c, d) => { s.beginPath(); s.moveTo(a, b); s.lineTo(c, d); s.stroke(); }, ring = r => { s.beginPath(); s.arc(64, 64, r, 0, TAU); s.stroke(); }, dot = r => { s.beginPath(); s.arc(64, 64, r, 0, TAU); s.fill(); };
  if (style === 'modern') { ring(10); ln(64, 30, 64, 50); ln(64, 78, 64, 98); ln(30, 64, 50, 64); ln(78, 64, 98, 64); }
  else if (style === 'revi') { ring(48); ln(10, 64, 46, 64); ln(82, 64, 118, 64); ln(64, 70, 64, 112); dot(3); }   // Revi: cerchio, barra orizzontale interrotta, asta verticale in basso
  else if (style === 'k14') { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, x = 64 + Math.cos(a) * 44, y = 64 + Math.sin(a) * 44; s.beginPath(); s.moveTo(x, y - 6); s.lineTo(x + 5, y); s.lineTo(x, y + 6); s.lineTo(x - 5, y); s.closePath(); s.fill(); } dot(3); }   // K-14: sei rombi e punto centrale
  else if (style === 'tele') { ring(56); ln(64, 10, 64, 118); ln(10, 64, 118, 64); }
  else if (style === 'type98') { ring(50); ring(25); ln(64, 14, 64, 114); ln(14, 64, 114, 64); }
  else { ring(50); ln(64, 18, 64, 52); ln(64, 76, 64, 110); ln(18, 64, 52, 64); ln(76, 64, 110, 64); dot(3); }
  return new THREE.CanvasTexture(sc);
}
function ckStickModel(sm, style) {
  const bk = 0x161616, mt = 0x55595c;
  sm.add(U.cyl12, 0x2a2a28, 0, .02, 0, 0, 0, 0, .07, .04, .07); sm.add(U.cyl, mt, 0, .2, 0, 0, 0, 0, .014, .4, .014);
  if (style === 'uk') { sm.add(new THREE.TorusGeometry(.055, .009, 6, 20), bk, 0, .47, 0, 0, 0, 0); sm.add(U.cyl, bk, 0, .41, 0, 0, 0, 0, .013, .03, .013); sm.add(U.cyl12, 0x8a7a60, 0, .47, -.012, PI / 2, 0, 0, .012, .012, .012); }   // impugnatura a vanga con pulsante di sparo
  else if (style === 'de') { sm.add(U.box, bk, 0, .44, .005, -.15, 0, 0, .035, .1, .04); sm.add(U.box, 0x7a1a14, 0, .49, -.01, 0, 0, 0, .025, .012, .02); sm.add(U.box, bk, 0, .43, -.03, 0, 0, 0, .012, .03, .015); }   // KG 13: impugnatura con pulsante ribaltabile delle bombe
  else if (style === 'jp') { sm.add(U.cyl12, 0x3a2e22, 0, .43, 0, 0, 0, 0, .02, .09, .02); sm.add(U.box, mt, 0, .48, 0, 0, 0, 0, .03, .015, .02); }
  else { sm.add(U.cyl12, bk, 0, .44, 0, -.2, 0, 0, .022, .1, .026); sm.add(U.box, 0xa02a1c, 0, .47, -.025, 0, 0, 0, .012, .025, .012); sm.add(U.box, bk, 0, .43, -.03, 0, 0, 0, .01, .028, .014); }   // impugnatura a pistola con grilletto
}
function ckExtras(mb, list, o) {
  const bk = 0x161616, mt = 0x55595c, { panY, panH, zp, halfW, wTop, zW, ic } = o, top = panY + panH / 2;
  for (const e of list) {
    if (e === 'compassFloor') { mb.add(U.cyl12, bk, 0, panY - panH / 2 - .14, zp + .18, 0, 0, 0, .06, .06, .06); mb.add(U.hemi, 0x8a9a9a, 0, panY - panH / 2 - .11, zp + .18, 0, 0, 0, .055, .04, .055); }   // bussola P8 fra le ginocchia
    if (e === 'compassTop') { mb.add(U.cyl12, bk, 0, wTop - .025, zW + .2, PI / 2, 0, 0, .02, .035, .02); mb.add(U.box, bk, 0, wTop - .008, zW + .2, 0, 0, 0, .008, .016, .008); }   // bussola magnetica in cima al parabrezza
    if (e === 'breech97') for (const sx of [-1, 1]) { const x = sx * .11; mb.add(U.box, bk, x, top + .04, zp + .06, 0, 0, 0, .055, .06, .26); mb.add(U.cyl, mt, x, top + .045, zp - .1, PI / 2, 0, 0, .012, .1, .012); mb.add(U.box, mt, x + sx * .035, top + .05, zp + .12, 0, 0, 0, .02, .015, .06); mb.add(U.cyl12, 0x6a5a3a, x, top + .02, zp + .2, PI / 2, 0, 0, .02, .04, .02); }   // culatte delle mitragliatrici Tipo 97 dentro la cabina
    if (e === 'breech131') for (const sx of [-1, 1]) { const x = sx * .13; mb.add(U.box, 0x232527, x, top + .035, zp + .02, 0, 0, 0, .07, .06, .2); mb.add(U.box, mt, x, top + .07, zp + .05, 0, 0, 0, .05, .01, .12); }   // carenature delle culatte MG 131 (le «Beulen» del G-6)
    if (e === 'diveLines') for (const [a, c] of [[30, 0xc02020], [50, 0xc02020], [60, 0xc02020], [70, 0xc02020], [80, 0xc02020]]) { const r = a * PI / 180; mb.add(U.box, c, halfW - .035, .02 + Math.sin(r) * .1, -.05 - Math.cos(r) * .1, -r, 0, 0, .003, .005, .22); }   // linee dell'angolo di picchiata sul vetro destro
    if (e === 'seat2') { mb.add(U.box, mt, .62, -.55, .2, 0, 0, 0, .4, .06, .4); mb.add(U.box, mt, .62, -.28, .38, -.1, 0, 0, .42, .55, .04); mb.add(U.box, ic, .62, -.42, -.35, 0, 0, 0, .3, .2, .3); }   // posto del navigatore
  }
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
  const LY = CK_LAY[type] || CK_LAY.p47, tubX = (LY.extra || []).includes('seat2') ? -eye[0] : 0, tubW = tubX ? halfW + Math.abs(tubX) : halfW;
  const zp = zW + .06, panW = modern ? Math.min(.78, halfW * 2 - .06) : Math.min(LY.w || .66, tubW * 2 - .04), panH = modern ? .36 : LY.h || .32, sillY = -.13, px = LY.px || 0;
  // il cruscotto sta sotto il dorso della fusoliera (il paraluce è il bordo del cofano)
  let panY = -.27;
  if (typeof specFuselage === 'function' && sp.len && !sp.builtin) { try { const st = specFuselage(sp), z = eye[2] + zp; for (let i = 0; i < st.length - 1; i++) if (z >= st[i][0] && z <= st[i + 1][0]) { const t = (z - st[i][0]) / (st[i + 1][0] - st[i][0]), top = lerp(st[i][3] + st[i][2] / 2, st[i + 1][3] + st[i + 1][2] / 2, t); panY = clamp(top - eye[1] - .04 - panH / 2, -.5, -.2); } } catch (e) { } }
  CK.zp = zp; CK.panY = panY;
  // vasca della cabina: fianchi, pavimento, paratia dietro il seggiolino
  for (const sx of [-1, 1]) { mb.add(U.box, ic, tubX + sx * tubW, -.42, (zW + .45) / 2, 0, 0, 0, .03, .62, .45 - zW); mb.add(U.box, ic, tubX + sx * (tubW - .02), sillY, (zW + .45) / 2, 0, 0, 0, .06, .05, .45 - zW); }
  mb.add(U.box, ic, tubX, -.74, (zW + .45) / 2, 0, 0, 0, tubW * 2, .03, .45 - zW);
  mb.add(U.box, ic, tubX, -.35, .45, 0, 0, 0, tubW * 2, .8, .03);
  // cruscotto: pannello principale e pannello inferiore, paraluce imbottito sopra
  const pc = modern ? 0x202326 : LY.pc || 0x1d1e1c;
  mb.add(U.box, pc, px, panY, zp, -.1, 0, 0, panW, panH, .03);
  for (const [x, y, w, h] of (modern ? [] : LY.sub || [])) mb.add(U.box, pc, px + x, panY + y, zp + .01, -.1, 0, 0, w, h, .03);
  if (LY.bfp && !modern) mb.add(U.box, 0x0b0b0b, px + LY.bfp[0], panY + LY.bfp[1], zp + .006, -.1, 0, 0, LY.bfp[2], LY.bfp[3], .01);   // pannello di volo strumentale su silent-block
  mb.add(U.box, pc, px, panY - panH / 2 - .1, zp + .08, -.6, 0, 0, panW * .5, .22, .03);
  mb.add(U.box, leather, px, panY + panH / 2 + .02, zp - .06, 0, 0, 0, panW + .04, .05, .2);
  // collimatore a riflessione sul paraluce (vetro combinatore inclinato)
  const sy = panY + panH / 2 + .05;

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
    ckSightModel(mb, g, LY.sight, sy, zp, wTop, zW);
    ckExtras(mb, (LY.extra || []).map(e => e), { panY, panH, zp, halfW: tubX + tubW, wTop, zW, ic });
  }
  g.add(groupMesh(mb.buildGroups(), false));
  if (!modern && (nat === 'de' || nat === 'uk' || type === 'p47' || type === 'p51')) { const ag = new THREE.Mesh(new THREE.BoxGeometry(.28, .26, .05), new THREE.MeshStandardMaterial({ color: 0x5f8a80, transparent: true, opacity: .16, roughness: .05, metalness: .3, depthWrite: false })); ag.position.set(0, (wy0 + wTop) / 2, zW + .1); ag.rotation.x = -.45; ag.renderOrder = 4; g.add(ag); }   // vetro blindato
  // atlante degli strumenti
  if (!CK.atlas) { CK.atlas = document.createElement('canvas'); CK.atlas.width = 1024; CK.atlas.height = 512; CK.actx = CK.atlas.getContext('2d'); CK.atex = new THREE.CanvasTexture(CK.atlas); CK.atex.encoding = THREE.sRGBEncoding; CK.atex.anisotropy = 4; }
  const faceMat = new THREE.MeshBasicMaterial({ map: CK.atex, color: new THREE.Color(.85, .85, .82) }), bezMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .45, metalness: .6 });
  const panel = new THREE.Group(); panel.position.set(0, panY, zp); panel.rotation.x = -.1; g.add(panel);
  CK.gauges = [];
  const L = modern ? [] : LY.g;
  let cell = 0;
  for (const [id, x, y, rad, op] of L) {
    const c = cell % 8, r = Math.floor(cell / 8); cell++;
    const rect = op && op.rect, geo = rect ? new THREE.PlaneGeometry(rect[0], rect[1]) : new THREE.CircleGeometry(rad, 40);
    if (rect) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (c + uv.getX(i)) / 8, 1 - (r + 1 - (.3 + uv.getY(i) * .4)) / 4); } else ckCell(geo, c, r);
    const face = new THREE.Mesh(geo, faceMat); face.position.set(px + x, y, .017); panel.add(face);
    if (!rect) { const bez = new THREE.Mesh(new THREE.TorusGeometry(rad + .004, .006, 6, 32), bezMat); bez.position.set(px + x, y, .018); panel.add(bez); }
    CK.gauges.push({ id, c, r, op: op || {} });
  }
  // spie: carrello (verdi e rosse), incendio del motore
  CK.lamps = {};
  const lamp = (id, x, y, hex) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.009, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(hex), emissiveIntensity: 0 })); m.position.set(x, y, .02); panel.add(m); CK.lamps[id] = m; };
  if (!modern) { const [lx, ly] = LY.lamps || [-.05, -.15]; lamp('gL', px + lx - .015, ly, 0x40ff50); lamp('gR', px + lx + .015, ly, 0x40ff50); lamp('gT', px + lx, ly + .022, 0xff3020); lamp('fire', px + lx + .045, ly, 0xff5010); }
  // schermi multifunzione (F-47)
  if (modern) {
    if (!CK.mfd) { CK.mfd = document.createElement('canvas'); CK.mfd.width = 1024; CK.mfd.height = 256; CK.mctx = CK.mfd.getContext('2d'); CK.mtex = new THREE.CanvasTexture(CK.mfd); CK.mtex.encoding = THREE.sRGBEncoding; }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(panW * .96, panW * .96 / 4), new THREE.MeshBasicMaterial({ map: CK.mtex })); scr.position.set(0, .01, .017); panel.add(scr);
  }
  // collimatore: reticolo luminoso sull'asse degli occhi (o visore a testa alta)
  const sight = new THREE.Mesh(new THREE.PlaneGeometry(.13, .13), new THREE.MeshBasicMaterial({ map: ckReticle(modern ? 'modern' : LY.sight), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: modern ? new THREE.Color(.6, 2.2, 1) : new THREE.Color(2.5, 1.6, .7) }));
  sight.position.set(0, 0, zp - .02 > -.7 ? -.7 : zp - .02); sight.renderOrder = 5; g.add(sight);
  if (modern) { const comb = new THREE.Mesh(new THREE.PlaneGeometry(.15, .12), new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: .12, roughness: .05, metalness: .5, depthWrite: false })); comb.position.set(0, -.02, sight.position.z + .01); comb.rotation.x = -.3; g.add(comb); }
  // cloche (perno sul pavimento), manetta, pedaliera
  const stick = new THREE.Group(); stick.position.set(0, -.74, -.33); g.add(stick);
  const sm = new MB(); sm.mat = 'paint'; ckStickModel(sm, modern ? 'us' : LY.stick);
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
  x.fillStyle = '#1d1e1c'; x.fillRect(0, 0, 1024, 512);
  const thr = PL.throttle, eng = me.parts ? me.parts.eng : 1, R = 60, nat = CK.nat, LB = CK_LBL[nat] || CK_LBL.us;
  const kt = nat === 'jp', mph = nat === 'us' || nat === 'uk', ftU = mph;
  const rpm = (1200 + thr * 1500 + clamp(sp / 700, 0, 1) * 250) * (eng < .2 ? .6 : 1) + Math.sin(GAME.time * 31) * 8, ot = 70 + thr * 15 + (1 - eng) * 60;
  const font = nat === 'jp' ? '"Yu Gothic","MS Gothic","Noto Sans CJK JP",sans-serif' : 'Arial';
  const title = (cx, cy, t, dy = -.3) => { if (!t) return; x.font = Math.round(R * .15) + 'px ' + font; x.fillStyle = '#c9c3ad'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy + R * dy); };
  const simple = (cx, cy, v, max, labels, t, a0 = -PI * .75, a1 = PI * .75, red) => { ckDial(x, cx, cy, R, (labels.length - 1) * 2, labels, a0, a1, '', ''); title(cx, cy, t, .32); ckNeedle(x, cx, cy, R, a0 + clamp(v / max, 0, 1) * (a1 - a0), .8, 3, red ? '#ff6040' : '#f4eedc'); };
  for (const G of CK.gauges) {
    const cx = G.c * 128 + 64, cy = G.r * 128 + 64, o = G.op, sub = o.lbl ? ' ' + o.lbl : '';
    switch (G.id) {
      case 'asi': { const v = kt ? sp / 1.852 : mph ? sp / 1.609 : sp, max = kt ? 400 : mph ? 500 : 800; ckDial(x, cx, cy, R, 20, kt ? ['0', '100', '200', '300', '400'] : mph ? ['0', '100', '200', '300', '400', '500'] : ['0', '200', '400', '600', '800'], -PI * .8, PI * .8); title(cx, cy, kt ? '速度 kt' : mph ? 'MPH' : 'km/h', .32); title(cx, cy, LB.asi && !kt ? LB.asi : '', -.3); ckNeedle(x, cx, cy, R, -PI * .8 + clamp(v / max, 0, 1) * PI * 1.6); break; }
      case 'alt': { const a = ftU ? alt * 3.281 : alt, unit = ftU ? 10000 : 1000; ckDial(x, cx, cy, R, 50, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], 0, TAU * .999); title(cx, cy, LB.alt, -.3); title(cx, cy, ftU ? 'FT ×100' : 'm ×100', .3); ckNeedle(x, cx, cy, R, (a % (unit / 10)) / (unit / 10) * TAU, .85, 2.5); ckNeedle(x, cx, cy, R, (a % unit) / unit * TAU, .55, 5, '#e0d8b8'); break; }
      case 'ah': { x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); x.translate(cx, cy); x.rotate(roll);
        const ph = clamp(pitch, -.8, .8) * 90; x.fillStyle = nat === 'de' ? '#2c2c2c' : '#4f7a9e'; x.fillRect(-100, -200 + ph, 200, 200); x.fillStyle = nat === 'de' ? '#7a6a52' : '#3d2c1c'; x.fillRect(-100, ph, 200, 200);
        x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-80, ph); x.lineTo(80, ph); x.stroke(); x.lineWidth = 1; for (let k = -3; k <= 3; k++) if (k) { x.beginPath(); x.moveTo(-14, ph - k * 15); x.lineTo(14, ph - k * 15); x.stroke(); }
        x.restore(); x.strokeStyle = '#f0b030'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 34, cy); x.lineTo(cx - 10, cy); x.lineTo(cx, cy + 8); x.lineTo(cx + 10, cy); x.lineTo(cx + 34, cy); x.stroke();
        x.fillStyle = '#e8e4d6'; x.beginPath(); x.moveTo(cx, cy - R + 4); x.lineTo(cx - 6, cy - R + 14); x.lineTo(cx + 6, cy - R + 14); x.fill(); break; }
      case 'turn': { ckDial(x, cx, cy, R, 4, ['L', '', 'R'], -PI * .3, PI * .3); title(cx, cy, LB.turn, .45); ckNeedle(x, cx, cy, R, clamp(CK.turn * 1.5, -.9, .9), .85, 4);
        x.strokeStyle = '#888'; x.lineWidth = 12; x.beginPath(); x.arc(cx, cy - 40, 70, PI * .36, PI * .64); x.stroke();
        const slip = clamp(-(PL.rudder || 0) * .4 + Math.sin(roll) * .2 - CK.turn * .4, -.12, .12); x.fillStyle = '#111'; x.beginPath(); x.arc(cx + Math.sin(slip * 2) * 70, cy - 40 + Math.cos(slip * 2) * 70, 6, 0, TAU); x.fill(); break; }
      case 'dg': case 'cmp': { x.fillStyle = '#0d0d0c'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
        x.save(); x.translate(cx, cy); x.rotate(-hdg); x.fillStyle = x.strokeStyle = G.id === 'cmp' ? '#d8cfa8' : '#e8e4d6'; x.font = 'bold 13px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; x.save(); x.rotate(a); x.lineWidth = k % 3 ? 1 : 2; x.beginPath(); x.moveTo(0, -R * .95); x.lineTo(0, -R * (k % 3 ? .86 : .78)); x.stroke(); if (k % 9 === 0) x.fillText(['N', 'E', 'S', 'W'][k / 9], 0, -R * .62); else if (k % 3 === 0) x.fillText(String(k), 0, -R * .62); x.restore(); }
        x.restore(); x.fillStyle = '#f0b030'; x.beginPath(); x.moveTo(cx, cy - R + 2); x.lineTo(cx - 7, cy - R + 16); x.lineTo(cx + 7, cy - R + 16); x.fill();
        x.strokeStyle = '#f0b030'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy - 16); x.lineTo(cx, cy + 22); x.moveTo(cx - 16, cy); x.lineTo(cx + 16, cy); x.stroke(); break; }
      case 'vsi': { const v = mph ? vs * 196.85 / 1000 : vs, m = mph ? 6 : 30; ckDial(x, cx, cy, R, 12, mph ? ['6', '3', '0', '3', '6'] : ['30', '15', '0', '15', '30'], -PI, 0); title(cx, cy, LB.vsi, .3); title(cx, cy, mph ? '×1000 FT/MIN' : 'm/s', .5); ckNeedle(x, cx, cy, R, -PI / 2 + clamp(v / m, -1, 1) * PI / 2); break; }
      case 'rpm': { const r = o.jet ? 4000 + thr * 4700 : rpm, mx = o.jet ? 10000 : 3500; ckDial(x, cx, cy, R, 14, o.jet ? ['0', '2', '4', '6', '8', '10'] : ['0', '10', '20', '30', '35'], -PI * .75, PI * .75); title(cx, cy, (LB.rpm || 'RPM') + sub, -.3); title(cx, cy, o.jet ? 'U/min ×1000' : '×100', .32); ckNeedle(x, cx, cy, R, -PI * .75 + clamp(r / mx, 0, 1) * PI * 1.5); break; }
      case 'map': simple(cx, cy, 18 + thr * 34 - 10, 60, ['10', '30', '50', '70'], 'IN. HG', -PI * .75, PI * .75); title(cx, cy, LB.map, -.3); break;
      case 'boost': { const b = -4 + thr * 22; simple(cx, cy, b + 6, 30, ['-6', '+4', '+14', '+24'], 'LB/SQ.IN' + sub); title(cx, cy, 'BOOST', -.3); break; }
      case 'ata': simple(cx, cy, .7 + thr * .75 - .6, 1.2, ['0.6', '1.0', '1.4', '1.8'], 'ata'); title(cx, cy, LB.ata, -.3); break;
      case 'mmhg': simple(cx, cy, -150 + thr * 450 + 300, 700, ['-300', '-100', '+100', '+300', '+400'], 'mmHg'); title(cx, cy, LB.mmhg, -.3); break;
      case 'turbo': simple(cx, cy, thr * 20000 + clamp(alt / 8000, 0, 1) * 4000, 26000, ['0', '10', '20', '26'], '×1000'); title(cx, cy, 'TURBO RPM', -.3); break;
      case 'oilt': simple(cx, cy, ot, 150, ['0', '50', '100', '150'], LB.oilt || 'OIL', -PI * .7, PI * .7, ot > 115); break;
      case 'oilp': simple(cx, cy, eng > .2 ? 70 + thr * 15 : 10, 120, ['0', '40', '80', '120'], (LB.oilp || 'OIL P') + sub); break;
      case 'cool': simple(cx, cy, 80 + thr * 25 + (1 - eng) * 40, 140, ['40', '80', '120', '140'], (LB.cool || 'COOL') + sub, -PI * .7, PI * .7, (1 - eng) > .5); break;
      case 'cht': simple(cx, cy, 160 + thr * 60 + (1 - eng) * 60, 300, ['0', '100', '200', '300'], LB.cht || 'CHT'); break;
      case 'egt': simple(cx, cy, 350 + thr * 300, 1000, ['0', '400', '800', '1000'], (LB.egt || 'EGT') + sub); break;
      case 'fuel': simple(cx, cy, CK.fuel, 1, ['E', '½', 'F'], LB.fuel || 'FUEL', -PI * .6, PI * .6, CK.fuel < .15); break;
      case 'fuelp': simple(cx, cy, eng > .2 ? 12 + thr * 5 : 2, 25, ['0', '10', '20', '25'], (LB.fuelp || 'FUEL P') + sub); break;
      case 'suct': simple(cx, cy, 4, 10, ['0', '5', '10'], 'SUCTION'); break;
      case 'gm': simple(cx, cy, (PL.G || 1) + 4, 16, ['-4', '0', '4', '8', '12'], 'G'); break;
      case 'afn': { ckDial(x, cx, cy, R, 4, ['', '', ''], -PI * .4, PI * .4); title(cx, cy, 'AFN 2', .35); ckNeedle(x, cx, cy, R, Math.sin(GAME.time * .2) * .3, .8, 3); break; }
      case 'eng3': case 'oilf': case 'press2': {   // strumenti combinati: tre (o due) lancette su scale separate
        x.fillStyle = '#0d0d0c'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill(); x.strokeStyle = '#e8e4d6'; x.lineWidth = 1.5;
        const parts = G.id === 'eng3' ? [[-1, .8, 'FUEL', (eng > .2 ? 14 : 3) / 25], [1, .8, 'OIL', (eng > .2 ? 75 : 10) / 120], [0, .45, '°C', ot / 150]] : G.id === 'oilf' ? [[-1, .7, nat === 'de' ? 'KRAFTST.' : 'FUEL', CK.fuel], [1, .7, nat === 'de' ? 'ÖL °C' : 'OIL', ot / 150]] : [[-1, .7, nat === 'de' ? 'KR.DR.' : 'FUEL P', (eng > .2 ? .6 : .1)], [1, .7, nat === 'de' ? 'ÖLDR.' : 'OIL P', (eng > .2 ? .7 : .1)]];
        for (const [sd, rr, t, v] of parts) { const ox = cx + sd * R * .38, oy = cy + (sd ? 8 : 24); x.beginPath(); x.arc(ox, oy, R * .4, -PI * .9, -PI * .1); x.stroke(); x.font = '10px ' + font; x.fillStyle = '#c9c3ad'; x.textAlign = 'center'; x.fillText(t, ox, oy + 14); const a = -PI * .9 + clamp(v, 0, 1) * PI * .8; x.strokeStyle = '#f4eedc'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + Math.cos(a) * R * .38, oy + Math.sin(a) * R * .38); x.stroke(); x.strokeStyle = '#e8e4d6'; x.lineWidth = 1.5; }
        break; }
      case 'clock': { const d = new Date(); ckDial(x, cx, cy, R, 60, ['12', '3', '6', '9', '12'], 0, TAU * .999); ckNeedle(x, cx, cy, R, (d.getHours() % 12 + d.getMinutes() / 60) / 12 * TAU, .5, 4); ckNeedle(x, cx, cy, R, d.getMinutes() / 60 * TAU, .78, 2.5); ckNeedle(x, cx, cy, R, d.getSeconds() / 60 * TAU, .85, 1, '#e05030'); break; }
      case 'ammo': {   // contatore delle munizioni (SZKK): finestrella con le cifre
        x.fillStyle = '#121212'; x.fillRect(cx - 64, cy - 26, 128, 52); x.fillStyle = '#e8e4d6'; x.font = 'bold 34px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(Math.max(0, Math.round(PL.ammoShow ?? 300))).padStart(3, '0'), cx, cy + 2); break; }
    }
  }
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
