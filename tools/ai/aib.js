// baseline/dopo: 60 s di battaglia a Omaha, tempo dell'IA, linee di vista, colpi, perdite, uso dei ripari, tiri su bersagli non visti
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const S = __dirname;
(async () => { const root = process.env.ROOT || require('path').resolve(__dirname, '../..'), secs = +(process.env.SECS || 60), side = process.env.SIDE || 'A'; const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + root + '/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(async side => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); $('optSide').value = side; await startGame(); }, side); await p.waitForTimeout(2500);
  console.log(root.includes('old') ? 'PRIMA' : 'DOPO', side, await p.evaluate(secs => { MISSION.godT = 1e9; let shots = 0, blind = 0, los = 0; const f0 = Soldier.prototype.fire; Soldier.prototype.fire = function () { shots++; const t = this.target; if (t && t.chest && t.alive !== false && !t.isSupp && !t.isBoat) { const e = this.eye(new V3()); if (!losClear(e, t.chest(new V3()))) blind++; } return f0.apply(this, arguments); };
    const l0 = window.losClear; window.losClear = function () { los++; return l0.apply(this, arguments); };
    const a0 = allies.filter(s => s.alive).length, e0 = enemies.filter(s => s.alive).length; let ai = 0, cov = 0, n = 0, mx = 0;
    for (let i = 0; i < secs * 30; i++) { const dt = 1 / 30; GAME.time += dt; try { updateTimers(dt); updateMission(dt); const t = performance.now(); updateAI(dt); const d = performance.now() - t; ai += d; mx = Math.max(mx, d); updateProjectiles(dt); } catch (e) { return 'ERR ' + e.stack.slice(0, 300); }
      if (i % 30 === 0) for (const s of allies.concat(enemies)) if (s.alive && s.state !== 'boat') { n++; if (s.cover && s.pos.distanceTo(new V3(s.cover.x, s.pos.y, s.cover.z)) < 2) cov++; } }
    window.losClear = l0;
    const ex = typeof INF !== 'undefined' ? ' · ' + INF.report() : '';
    return `${secs} s: IA ${(ai / (secs * 30)).toFixed(2)} ms/fot (picco ${mx.toFixed(1)}) · linee di vista ${Math.round(los / secs)}/s · colpi ${shots} (senza vista ${blind}) · alleati ${a0}→${allies.filter(s => s.alive).length} · tedeschi ${e0}→${enemies.filter(s => s.alive).length} · al riparo ${Math.round(cov / Math.max(1, n) * 100)}%` + ex; }, secs), errs.slice(0, 2).join('|') || 'ok');
  await b.close(); })();
