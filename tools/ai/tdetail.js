// test del dettaglio Blender degli edifici urbani legato alla distruzione (solo tech demo) — node tools/ai/tdetail.js
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
let fails = 0; const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : '')); };
(async () => {
  // file: un GLB (in .js) per ognuno dei 25 edifici, validato in Blender
  const defs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../assets/aaa/urban/urban_defs.json'), 'utf8')), ids = defs.isolato1.items.map(d => d.id).concat(defs.file.flatMap(R => R.items.map((d, i) => `${R.id}_${String.fromCharCode(97 + i)}`)));
  const man = ids.map(id => { const f = path.resolve(__dirname, `../../assets/aaa/urban/${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; });
  ok('25 edifici con dettaglio Blender esportato e validato', man.every(m => m && !m.validazione.errori.length) && man.length === 25, `${man.filter(Boolean).length}/25, triangoli ${man.filter(Boolean).map(m => m.triangoli.LOD0).reduce((a, b) => a + b, 0)}`);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { AAA.preset = 'LOW'; const sm = $('optMap'); const o = document.createElement('option'); o.value = 'aaa'; sm.appendChild(o); sm.value = 'aaa'; await startGame(); });
  for (let i = 0; i < 200 && await p.evaluate(() => !GAME.started); i++) await p.waitForTimeout(1000);
  const R = await p.evaluate(async () => {
    for (let i = 0; i < 300 && !XDZ.ready; i++) await new Promise(r => setTimeout(r, 500)); GAME.running = false;
    const sim = s => { for (let i = 0; i < s * 30; i++) { GAME.time += 1 / 30; xdzTick(1 / 30); } }, out = {};
    // caricamento progressivo: dal più vicino alla camera
    const B0 = XDZ_REG.get('u4_a').b; camera.position.set(B0.x, B0.base + 2, B0.z + 12);
    for (let i = 0; i < 80 && !(B0.detail && B0.detail.groups); i++) { GAME.time += .5; xdzTick(.5); await new Promise(r => setTimeout(r, 250)); }
    const D = B0.detail; out.load = { ok: !!(D && D.groups), primo: XDZD.loaded, gruppi: D && Object.keys(D.groups).length, senzaComponente: D ? Object.values(D.groups).filter(G => !G.own.length).map(G => G.key) : null, mesh: D && D.root.children.length };
    // stato coerente: gruppi tutti visibili su un edificio integro
    out.integro = Object.values(D.groups).every(G => G.on);
    // colpo di carro sulla facciata: i gruppi dei pannelli aperti spariscono (maschera) e cadono come detriti; gli altri restano
    const t = new V3(B0.x - 1.5, B0.base + 1.3, B0.z + B0.d / 2), o = t.clone().add(new V3(.2, .4, 3.5)), n0 = XDZ.bodies.length;
    xdzShell(o, t.clone().sub(o).normalize()); sim(3);
    const off = Object.values(D.groups).filter(G => !G.on), mask = off.every(G => XDZD.data[G.gi * 4] === 0), coherent = Object.values(D.groups).every(G => G.on === G.own.every(q => !q.dead && !q.opened));
    out.danno = { nascosti: off.length, totali: Object.keys(D.groups).length, maschera: mask, coerente: coherent, detriti: XDZ.bodies.length - n0, chiavi: off.map(G => G.key).slice(0, 6) };
    // crollo di un timpano: il comignolo (gruppo g) segue
    const gab = B0.parts.find(q => q.isGable && Object.values(D.groups).some(G => G.key === 'g:' + q.side));
    if (gab) { for (const c of gab.sup) for (const cell of c.cells) if (cell.alive) xdzRemoveCell(cell, cell.wp, new V3(0, -1, 0), 'carro'); sim(6); out.comignolo = { timpano: gab.dead, gruppo: !D.groups['g:' + gab.side].on }; } else out.comignolo = { assente: true };
    // persistenza: ripristino → dettaglio ricaricato con la stessa maschera dei componenti
    const sn = xdzSnapshot(); xdzRestore(sn); const B1 = XDZ_REG.get('u4_a').b; camera.position.set(B1.x, B1.base + 2, B1.z + 12);
    for (let i = 0; i < 80 && !(B1.detail && B1.detail.groups); i++) { GAME.time += .5; xdzTick(.5); await new Promise(r => setTimeout(r, 250)); }
    out.ripristino = B1.detail && B1.detail.err ? { err: B1.detail.err } : B1.detail && B1.detail.groups ? { coerente: Object.values(B1.detail.groups).every(G => G.on === G.own.every(q => !q.dead && !q.opened)), nascosti: Object.values(B1.detail.groups).filter(G => !G.on).length } : null;
    out.tris = Math.round(XDZD.tris);
    return out;
  });
  ok('caricamento progressivo del dettaglio (più vicino per primo), ogni gruppo legato a un componente', R.load.ok && R.load.senzaComponente.length === 0 && R.load.gruppi > 20, JSON.stringify(R.load));
  ok('edificio integro: tutto il dettaglio visibile', R.integro);
  ok('danno: il dettaglio dei pannelli colpiti sparisce (anche nell\'ombra) e cade come detrito, il resto resta', R.danno.nascosti > 0 && R.danno.nascosti < R.danno.totali && R.danno.maschera && R.danno.coerente && R.danno.detriti > 0, JSON.stringify(R.danno));
  ok('crollo del timpano: cade anche il comignolo', R.comignolo.assente || (R.comignolo.timpano && R.comignolo.gruppo), JSON.stringify(R.comignolo));
  ok('ripristino: dettaglio coerente con lo stato salvato', R.ripristino && R.ripristino.coerente && R.ripristino.nascosti > 0, JSON.stringify(R.ripristino));
  ok('nessun errore JavaScript', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(fails ? `\n${fails} test FALLITI` : '\ntutti i test superati'); process.exit(fails ? 1 : 0);
})();
