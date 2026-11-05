// test dell'Urban Expansion 3.0 — primo isolato distruttibile (solo tech demo) — node tools/ai/turban.js
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 200 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const R = await p.evaluate(async () => {
    for (let i = 0; i < 200 && !XDZ.ready; i++) await new Promise(r => setTimeout(r, 500)); GAME.running = false;
    const sim = s => { for (let i = 0; i < s * 30; i++) { GAME.time += 1 / 30; xdzTick(1 / 30); } }, out = {};
    const U = () => [...XDZ_REG.values()].filter(e => /^u1_/.test(e.id)), ids = [...XDZ_REG.keys()];
    out.reg = { n: U().length, unici: new Set(ids).size === ids.length, campi: U().every(e => e.tipo && e.pos && e.dim && e.materiali && e.livelli && e.distruzione), nonAppoggiati: XDZ.panels.filter(q => !q.dead && !xdzSupported(q)).map(q => q.id), v2: Object.entries(v2Validate()).filter(e => e[1].length).map(e => e[0]) };
    const ground = (x, z, y) => Math.max(Hf(x, z), worldFloor(x, z, y)), inSolid = (x, y, z) => solids.some(s => s.on !== false && !s.walk && x > s.min.x && x < s.max.x && y > s.min.y && y < s.max.y && z > s.min.z && z < s.max.z);
    const walk = pts => { let y = ground(pts[0][0], pts[0][1], Hf(pts[0][0], pts[0][1]) + .3), mx = 0, bl = 0; for (let i = 0; i < pts.length - 1; i++) for (let k = 1; k <= 160; k++) { const t = k / 160, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, y2 = ground(x, z, y); mx = Math.max(mx, Math.abs(y2 - y)); y = y2; if (inSolid(x, y + 1.1, z)) bl++; } return { mx: +mx.toFixed(2), bl, y }; };
    // scale: dalla porta al primo piano (casa a, bottega a tre piani)
    out.scale = {}; for (const id of ['u1_casa_a', 'u1_bottega']) { const B = XDZ_REG.get(id).b, ix0 = B.x - B.w / 2 + .55, iz0 = B.z - B.d / 2 + .55, L = Math.min(3 / .66, B.w - 2.5), door = B.openings.find(o => o.door); const r = walk([[door.px, B.z + B.d / 2 + 2], [door.px, B.z + .5], [ix0 + .1, iz0 + .5], [ix0 + .25 + L + .3, iz0 + .5], [ix0 + .25 + L + .6, iz0 + 1.6]]); out.scale[id] = { ...r, quota: +(r.y - B.base).toFixed(2) }; }
    // porte chiuse e persiane: bloccano; quella aperta no
    const cb = XDZ_REG.get('u1_casa_b').b, dB = cb.openings.find(o => o.door); out.porte = { chiusa: walk([[dB.px, cb.z + cb.d / 2 + 2], [dB.px, cb.z]]).bl > 0, aperta: walk([[XDZ_REG.get('u1_casa_a').b.openings.find(o => o.door).px, XDZ_REG.get('u1_casa_a').b.z + 5], [XDZ_REG.get('u1_casa_a').b.openings.find(o => o.door).px, XDZ_REG.get('u1_casa_a').b.z]]).bl === 0 };
    // stato preesistente coerente (casa c): celle tolte senza collider, campata del tetto ceduta senza collider
    const cc = XDZ_REG.get('u1_casa_c').b; out.pre = { celle: cc.parts.filter(q => q.cells).reduce((a, q) => a + q.cells.filter(c => !c.alive).length, 0), colliderOrfani: cc.parts.filter(q => q.cells).some(q => q.cells.some(c => !c.alive && c.sol.on)), tettoSpento: cc.parts.filter(q => q.role === 'roof' && q.dead).every(q => q.sols.every(s => !s.on)) };
    // ogni edificio è distruttibile indipendentemente: un colpo di carro su ciascuno, solo quell'edificio cambia
    out.edifici = {};
    for (const id of U().filter(e => e.b.cfg).map(e => e.id)) {
      xdzReset({ terrain: true }); const e = XDZ_REG.get(id), B = e.b, t = new V3(B.x + .4, B.base + 1.4, B.z + B.d / 2), o = t.clone().add(new V3(.5, .6, 12));
      const others0 = U().filter(q => q !== e).map(q => xdzRegState(q).integrita); xdzShell(o, t.clone().sub(o).normalize()); sim(4);
      const st = xdzRegState(e), others1 = U().filter(q => q !== e).map(q => xdzRegState(q).integrita);
      out.edifici[e.id] = { integrita: st.integrita, pannelliDanneggiati: B.parts.filter(q => q.cells && q.state >= 2).length, altriInvariati: others0.every((v, i) => v === others1[i]), collider: B.parts.filter(q => q.cells).every(q => q.cells.every(c => c.alive || !c.sol.on)) };
    }
    // armi leggere sull'intonaco: segni, nessuna cella di muratura; la MG apre la porta di legno della casa b
    xdzReset({ terrain: true }); { const B = XDZ_REG.get('u1_casa_b').b, d = B.openings.find(o => o.door), t = new V3(d.px, B.base + 1, B.z + B.d / 2), o = t.clone().add(new V3(0, .4, 15)); xdzFireAt(o, new V3(B.x - 2, B.base + 1.3, B.z + B.d / 2), { snd: 'garand', dmg: 50 }, 30, .02); const mur = B.parts.filter(q => q.role === 'muro').reduce((a, q) => a + q.cells.filter(c => !c.alive).length, 0); xdzFireAt(o, t, { snd: 'mg42', dmg: 45, auto: true }, 220, .035); sim(3); const door = B.parts.find(q => q.role === 'porta'); out.armi = { muratura: mur, porta: door ? xdzAlive(door) : null, varco: walk([[d.px, B.z + B.d / 2 + 2], [d.px, B.z]]).bl === 0 }; }
    // crollo del solaio: tolte le file sotto le travi, cedono travi, solaio e scala (superfici spente)
    xdzReset({ terrain: true }); { const B = XDZ_REG.get('u1_casa_a').b; for (const face of [B.grid[0], B.grid[1]]) for (const col of face) for (const r of [0, 1]) if (col[r]) for (const c of col[r].cells) if (c.alive) xdzRemoveCell(c, c.wp, new V3(0, 0, 1), 'carro'); sim(10); const ev = XDZ.events.map(e => e.type); out.crollo = { trave: ev.includes('TRAVE_CEDUTA'), solaio: ev.includes('SOLAIO_CROLLATO'), scala: ev.includes('SCALA_CROLLATA'), superfici: FLOORS.filter(f => f.xdz && f.xdz.startsWith('u1_casa_a') && f.y > B.base + 1).every(f => f.off), altri: U().filter(e => e.id !== 'u1_casa_a' && e.b.cfg).every(e => xdzRegState(e).integrita >= 98) }; }
    // navigazione dell'isolato: dalla strada nella casa a (porta) e accesso posteriore ai cortili; percorso aggiornato dopo una breccia
    xdzReset({ terrain: true }); { const N = XDZ.navs[1], A = XDZ_REG.get('u1_casa_a').b, d = A.openings.find(o => o.door), [sx, sz] = v2W(-80, 93.5), [rx, rz] = v2W(-76, 81.5); out.nav = { dentro: !!xdzPath(sx, sz, d.px, A.z), cortile: !!xdzPath(sx, sz, rx, rz) }; const B = XDZ_REG.get('u1_casa_b').b, before = xdzPath(sx, sz, B.x, B.z); out.nav.chiusaPrima = before ? +before.len.toFixed(1) : null; const t = new V3(B.x - .3, B.base + .7, B.z + B.d / 2), o = t.clone().add(new V3(0, .3, 6)); xdzShell(o, t.clone().sub(o).normalize()); xdzShell(o, t.clone().add(new V3(.6, .7, 0)).sub(o).normalize()); sim(6); const after = xdzPath(sx, sz, B.x, B.z); out.nav.dopoBreccia = after ? +after.len.toFixed(1) : null; }
    // strada: corridoio di 3,2 m libero per lo Sherman lungo la rue Neuve
    { let bad = 0; const pts = XDZ_URBAN.strada.pts; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k <= 12; k++) { const [x, z] = v2W(lerp(pts[i][0], pts[i + 1][0], k / 12), lerp(pts[i][1], pts[i + 1][1], k / 12)); for (const dx of [-1.6, 0, 1.6]) for (const dz of [-1.6, 0, 1.6]) if (inSolid(x + dx, Hf(x, z) + .5, z + dz) || inSolid(x + dx, Hf(x, z) + 1.6, z + dz)) bad++; } out.strada = bad; }
    // persistenza: snapshot con l'isolato danneggiato → ripristino identico
    const s1 = xdzSnapshot(); xdzRestore(s1); const s2 = xdzSnapshot(); out.snap = { uguale: JSON.stringify(s1.pannelli) === JSON.stringify(s2.pannelli) && s1.lastre.length === s2.lastre.length, kb: +(JSON.stringify(s1).length / 1024).toFixed(1) };
    // costo: solidi a riposo, aggiornamento
    xdzReset({ terrain: true }); sim(1); out.costo = { solidiXdz: solids.filter(s => /^xdz_/.test(s.tag)).length, pannelli: XDZ.panels.length, ms: +XDZ.st.updMs.toFixed(2) };
    xdzOpen(true); xdzSelect('u1_bottega'); out.ui = /u1_bottega/.test(document.getElementById('xdzPanel').textContent) && /scala/.test(document.getElementById('xdzPanel').textContent); xdzOpen(false);
    return out;
  });
  ok('registro: 6 voci dell\'isolato (5 edifici + muretti), ID unici, campi completi', R.reg.n === 6 && R.reg.unici && R.reg.campi, JSON.stringify(R.reg));
  ok('struttura iniziale appoggiata, nessun conflitto con il villaggio', !R.reg.nonAppoggiati.length && !R.reg.v2.length, JSON.stringify(R.reg));
  for (const id in R.scale) ok('scala al primo piano: ' + id, R.scale[id].bl === 0 && R.scale[id].mx <= .55 && Math.abs(R.scale[id].quota - 3.07) < .15, JSON.stringify(R.scale[id]));
  ok('porta chiusa blocca, porta aperta si attraversa', R.porte.chiusa && R.porte.aperta, JSON.stringify(R.porte));
  ok('danni preesistenti coerenti (nessun collider orfano)', R.pre.celle > 5 && !R.pre.colliderOrfani && R.pre.tettoSpento, JSON.stringify(R.pre));
  for (const id in R.edifici) { const e = R.edifici[id]; ok('distruttibile e indipendente: ' + id, e.integrita < 100 && e.pannelliDanneggiati > 0 && e.altriInvariati && e.collider, JSON.stringify(e)); }
  ok('armi leggere: muratura intatta, la MG apre la porta di legno', R.armi.muratura === 0 && R.armi.porta !== null && R.armi.porta < .6 && R.armi.varco, JSON.stringify(R.armi));
  ok('crollo locale: travi, solaio e scala cedono, superfici spente, altri edifici intatti', R.crollo.trave && R.crollo.solaio && R.crollo.scala && R.crollo.superfici && R.crollo.altri, JSON.stringify(R.crollo));
  ok('navigazione: dalla strada dentro la casa e nei cortili; la breccia apre la casa chiusa', R.nav.dentro && R.nav.cortile && R.nav.dopoBreccia && (!R.nav.chiusaPrima || R.nav.dopoBreccia < R.nav.chiusaPrima), JSON.stringify(R.nav));
  ok('rue Neuve percorribile da un carro (3,2 m)', R.strada === 0, R.strada + ' punti bloccati');
  ok('persistenza: ripristino identico dell\'isolato', R.snap.uguale, JSON.stringify(R.snap));
  ok('costo: un collider per pannello a riposo, aggiornamento leggero', R.costo.solidiXdz < R.costo.pannelli * 1.4 && R.costo.ms < 5, JSON.stringify(R.costo));
  ok('debug F3: selezione dell\'edificio con stato strutturale', R.ui);
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
