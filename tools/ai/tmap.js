// test Mappe 4.0: Colleville (libreria Architettura) — determinismo, aperture, collisioni, interni, distruzione, validazione
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../../index.html');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const ctx = await b.newContext(); const errs = []; let p;
  const open = async () => { if (p) await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500); await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(2500); };
  const sig = () => p.evaluate(() => WORLD.colleville.houses.map(id => { const o = DZ.objs.get(id); return id + ':' + o.spec.kind + ':' + o.secs.length + ':' + o.secs.map(s => s.box.map(v => v.toFixed(2)).join(',')).join('|').length; }).join(';'));
  await open(); const s1 = await sig(); await open(); const s2 = await sig();
  console.log((s1 === s2 ? 'OK   ' : 'FALLITO ') + 'determinismo: due caricamenti, stesso villaggio — ' + s1.split(';').length + ' edifici');
  console.log(await p.evaluate(() => {
    const R = [], ok = (n, c, x = '') => R.push((c ? 'OK   ' : 'FALLITO ') + n + (x ? ' — ' + x : ''));
    const H = DZ.objs.get('colleville_n3'), sp = H.spec, inF = H.secs.filter(s => s.face === '-z');
    // finestra del piano terra sulla strada: un colpo dall'esterno all'interno passa; accanto (muro) no
    const win = H.secs.filter(s => s.face === '-z' && s.role === 'wall' && s.box[3] - s.box[0] < 1.2 && s.box[4] < H.base + 1.5 && s.box[4] > H.base + .5)[0];
    const wx = (win.box[0] + win.box[3]) / 2, wy = win.box[4] + .6, zf = win.box[2];
    const ext = new V3(wx, wy, zf - 6), inn = new V3(wx, wy, zf + 2.5), h1 = tlRay(ext, inn, 'shell', 0);
    const pier = H.secs.find(s => s.face === '-z' && s.role === 'wall' && s.box[1] < H.base && s.box[4] > H.base + 2.5 && s.box[0] > H.cx - sp.w / 2 + 1 && s.box[3] < H.cx + sp.w / 2 - 1), px = (pier.box[0] + pier.box[3]) / 2, h2 = tlRay(new V3(px, H.base + 1.5, zf - 6), new V3(px, H.base + 1.5, zf + 2.5), 'shell', 0);
    ok('finestra reale: vista e colpi passano dall\'apertura', !h1, h1 ? 'bloccato da ' + h1.s.tag : '');
    ok('muro pieno accanto: blocca', h2 && h2.s && h2.s._dz && h2.s._dz.obj === H);
    // porta aperta: il giocatore entra camminando e non viene respinto
    const door = H.deco && true; const dop = H.secs.filter(s => s.face === '-z').filter(s => s.box[1] < H.base + .3 && s.box[4] > H.base + .5).map(s => [s.box[0], s.box[3]]).sort((a, b) => a[0] - b[0]); let gx = null; for (let i = 0; i < dop.length - 1; i++) if (dop[i + 1][0] - dop[i][1] > .9) { gx = (dop[i][1] + dop[i + 1][0]) / 2; break; }
    let pos = new V3(gx, Hf(gx, zf - 3), zf - 3), blocked = false; for (let i = 0; i < 40; i++) { pos.z += .15; const q = pos.clone(); pushOut(pos, .38, 1.7); if (Math.abs(pos.z - q.z) + Math.abs(pos.x - q.x) > .05) blocked = true; }
    ok('porta aperta: si entra in casa', gx !== null && !blocked && pos.z > zf + 1, gx === null ? 'nessuna porta ' + JSON.stringify(dop.map(a => a.map(v => +(v - H.cx).toFixed(2)))) + ' ' + H.secs.filter(s => s.role === 'door').length : `dentro di ${(pos.z - zf).toFixed(1)} m`);
    // scala: salendo la rampa il pavimento sale fino al primo piano
    const ramp = FLOORS.find(f => f.ramp && f.x0 > H.cx - sp.w / 2 && f.x1 < H.cx + sp.w / 2 + 1); let y = ramp.ramp.y0; const zz = (ramp.z0 + ramp.z1) / 2;
    for (let x = ramp.x0; x <= ramp.x1 + 1.5; x += .25) y = Math.max(Hf(x, zz), worldFloor(x, zz, y));
    ok('scala: dal piano terra al primo piano', y > H.base + 2.9, `quota ${(y - H.base).toFixed(2)} m`);
    // un soldato al primo piano resta sul solaio
    const up = FLOORS.find(f => !f.ramp && f.sol && f.x0 >= H.cx - sp.w / 2 - .1); const s = new Soldier('E', 'rifle', (up.x0 + up.x1) / 2, (up.z0 + up.z1) / 2, { state: 'post', stationary: true }); s.pos.y = up.y; enemies.includes(s) || enemies.push(s);
    for (let i = 0; i < 30; i++) { GAME.time += 1 / 30; updateAI(1 / 30); }
    ok('bot al primo piano: resta sul solaio', Math.abs(s.pos.y - up.y) < .05, `quota ${(s.pos.y - H.base).toFixed(2)} m`);
    // distruzione: tre colpi su un pilastro aprono un varco reale
    for (let i = 0; i < 6 && pier.state < 3; i++) dzShellHit(pier.sol, new V3(px, H.base + 1.5, zf), new V3(0, 0, 1), { T: { cal: 75 }, he: true });
    { const hh = tlRay(new V3(px, H.base + 1.5, zf - 6), new V3(px, H.base + 1.5, zf + 2.5), 'shell', 0); ok('distruzione: il pilastro cade e il varco è aperto', pier.state === 3 && !hh, `stato ${DZ_ST[pier.state]}${hh ? ', bloccato da ' + (hh.terrain ? 'terreno' : hh.s.tag + (hh.s._dz ? ' ' + hh.s._dz.role + ' ' + DZ_ST[hh.s._dz.state] : '')) : ''}`); }
    const V = mapValidate(); ok('validazione: nessun punto di ripresa dentro un muro, nessuna coordinata non valida, solai validi', !V.spawnInside.length && !V.nan && !V.floorsBad, `collider ${V.active}, solai ${V.floors}, coperture nei muri ${V.coverInside}, sovrapposizioni ${V.overlaps.length} (rovine della città, preesistenti)`);
    return R.join('\n');
  }));
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 3).join(' | ') : 'nessun errore JavaScript'); await b.close();
})();
