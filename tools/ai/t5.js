// prototipo N contro N: arena con molti ripari nell'entroterra di Omaha, alleati in avanzata, tedeschi in difesa mobile
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const S = __dirname;
(async () => { const root = process.env.ROOT || require('path').resolve(__dirname, '../..'), N = +(process.env.N || 5), secs = +(process.env.SECS || 120), seed = +(process.env.SEED || 1);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + root + '/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(async () => { $('optMap').value = 'omaha'; $('optMap').dispatchEvent(new Event('change')); await startGame(); }); await p.waitForTimeout(2500);
  const out = await p.evaluate(([N, secs, seed, process_env_FL]) => {
    // generatore deterministico per la prova
    let sd = seed * 9301 + 49297; Math.random = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    for (const s of allies.concat(enemies)) { s.alive = false; s.removed = true; s.body.removed = true; }
    allies.length = 0; enemies.length = 0; MISSION.godT = 1e9; P.pos.set(0, -50, 900); P.dead = true;
    for (const t of TANKS.list || []) { t.alive = false; } 
    // centro dell'arena: zona dell'entroterra con più ripari
    let bc = null, bn = 0; for (const c of covers) { if (c.z > -120 || c.z < -420 || /hedge/.test(c.kind)) continue; let n = 0; for (const o of covers) if (Math.hypot(o.x - c.x, o.z - c.z) < 55) n += /hedge/.test(o.kind) ? -2 : 1; if (n > bn) { bn = n; bc = c; } }
    const cx = bc.x, cz = bc.z; camera.position.set(cx, Hf(cx, cz) + 30, cz + 90); camera.updateMatrixWorld(true); MISSION.allyZone = { zMin: cz - 70, zMax: cz + 70, xMin: cx - 60, xMax: cx + 60, step: 13, wait: [2, 4] };
    const A = [], E = [], kinds = ['smg', 'rifle', 'bar', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle'], ek = ['smg', 'rifle', 'mg', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle'];
    for (let i = 0; i < N; i++) { const a = new Soldier('A', kinds[i % 8], cx + (i - N / 2) * 4, cz + 55 + (i % 2) * 3, { state: 'cover' }); if (!allies.includes(a)) allies.push(a); A.push(a); }
    const FL = process_env_FL;
    if (FL) { for (const [k, dx] of [['mg', 0], ['rifle', 3]]) { const e = new Soldier('E', k, cx + dx, cz - 55, { state: 'post', stationary: true }); e.hp = 1e6; if (!enemies.includes(e)) enemies.push(e); E.push(e); } }
    else for (let i = 0; i < N; i++) { const e = new Soldier('E', ek[i % 8], cx + (i - N / 2) * 4, cz - 45 - (i % 2) * 3, { state: 'post' }); if (!enemies.includes(e)) enemies.push(e); E.push(e); }
    let shots = 0, blind = 0, supp = 0, los = 0, cov = 0, n = 0, ai = 0, tFirstSpot = -1, tFirstShot = -1; const f0 = Soldier.prototype.fire;
    Soldier.prototype.fire = function () { shots++; const t = this.target; if (t && t.isSupp) supp++; else if (t && t.chest && !t.isBoat && !losClear(this.eye(new V3()), t.chest(new V3()))) blind++; if (tFirstShot < 0) tFirstShot = GAME.time - t0; return f0.apply(this, arguments); };
    const l0 = window.losClear; window.losClear = function () { los++; return l0.apply(this, arguments); };
    const t0 = GAME.time, tl = [];
    for (let i = 0; i < secs * 30; i++) { const dt = 1 / 30; GAME.time += dt; const t = performance.now(); try { updateAI(dt); updateProjectiles(dt); } catch (e) { return 'ERR ' + e.stack.slice(0, 400); } ai += performance.now() - t;
      if (tFirstSpot < 0 && A.concat(E).some(s => s.tVis && s.target && !s.target.isSupp)) tFirstSpot = GAME.time - t0;
      if (i % 30 === 0) { for (const s of A.concat(E)) if (s.alive) { n++; if (covers.some(c => Math.hypot(c.x - s.pos.x, c.z - s.pos.z) < 2.5)) cov++; } }
      if (i % 600 === 0) tl.push(Math.round(i / 30) + 's A' + A.filter(s => s.alive).length + '/E' + E.filter(s => s.alive).length + (typeof INF !== 'undefined' ? ' ' + INF.squads.map(q => q.team + ':' + q.state).join(',') : '')); }
    window.losClear = l0;
    const FLR = typeof INF !== 'undefined' ? ' · fiancheggiatori: ' + A.filter(s => s.flankUntil !== undefined).map(s => (s.alive ? 'vivo' : 'caduto') + ' a ' + Math.round(Math.hypot(s.pos.x - E[0].pos.x, s.pos.z - E[0].pos.z)) + ' m dalla MG, ' + (losClear(s.eye(new V3()), E[0].chest(new V3())) ? 'la vede' : 'non la vede')).join(' ; ') : '';
    const R = [FLR, `${N}v${N} ${secs}s · sopravvissuti A ${A.filter(s => s.alive).length}/${N} E ${E.filter(s => s.alive).length}/${N} · primo avvistamento ${tFirstSpot.toFixed(1)} s · primo colpo ${tFirstShot.toFixed(1)} s · colpi ${shots} (soppressione ${supp}, senza vista ${blind}) · al riparo ${Math.round(cov / Math.max(1, n) * 100)}% · IA ${(ai / (secs * 30)).toFixed(3)} ms/fot · linee di vista ${Math.round(los / secs)}/s`, tl.join(' | ')];
    if (typeof INF !== 'undefined') R.push(INF.report());
    return R.join('\n'); }, [N, secs, seed, +(process.env.FL || 0)]);
  console.log(root.includes('old') ? 'PRIMA' : 'DOPO'); console.log(out); console.log(errs.slice(0, 3).join('|') || 'nessun errore'); await b.close(); })();
