"use strict";
// ============================================================
//  Benchmark dei carri armati (Ctrl+Maiusc+B nella Guerra corazzata, oppure vehBench() dalla console).
//  Dieci scenari: carro fermo, in movimento, su terreno irregolare, 2, 4 e 8 carri in combattimento, molti spari,
//  carri danneggiati con fumo, relitti, carri con fanteria. Per ognuno: FPS medi, 1% low, tempo per fotogramma,
//  tempo di fisica, collisioni e IA dei carri, draw call, triangoli, memoria.
// ============================================================
async function vehBench(secs = 10) {
  if (SCEN !== 'kas' || window.__vehBenchOn || !TANKS.me) return; window.__vehBenchOn = true;
  const ri = renderer.info, auto0 = ri.autoReset; ri.autoReset = false;
  const me = TANKS.me, drive0 = me.drive, hp0 = me.hp, base = me.pos.clone(), res = [], spawned = [], troops = [];
  const clear = () => { for (const t of KAS.tanks.slice()) if (t !== me) vpRemove(t); for (const s of troops) { s.alive = false; s.removed = true; if (s.root && s.root.parent) s.root.parent.remove(s.root); } troops.length = 0; };
  const spawn = (n, fight) => { for (let i = 0; i < n; i++) { const tm = i % 2 ? 'E' : 'A', a = i * 1.7, r = 120 + i * 25, t = new KasTank(tm === 'E' ? pick(['pz4', 'pz3', 'tiger']) : 'sherman', tm, me.pos.x + Math.sin(a) * r, me.pos.z - 200 - Math.cos(a) * r * .5, tm === 'E' ? 0 : PI); t.hp = t.hpMax = 1e6; t.goalOff.set(rnd(-60, 60), 0, rnd(-40, 40)); if (!fight) t.think = () => { t.cmdThr = .6; t.cmdSteer = .2; }; spawned.push(t); } };
  const SC = [
    ['1 Un carro fermo', () => { me.drive = () => { me.cmdThr = 0; me.cmdSteer = 0; }; }],
    ['2 Un carro in movimento', () => { me.drive = () => { me.cmdThr = 1; me.cmdSteer = .15; }; }],
    ['3 Terreno irregolare', () => { me.pos.set(380, Hf(380, -300), -300); me.yaw = -PI / 2; vpPoseKin(me, 1, true); me.drive = () => { me.cmdThr = 1; me.cmdSteer = Math.sin(GAME.time * .4) * .6; }; }],
    ['4 Due carri in combattimento', () => { me.drive = () => { me.cmdThr = 0; me.cmdSteer = 0; }; spawn(1, true); }],
    ['5 Quattro carri', () => spawn(3, true)],
    ['6 Otto carri', () => spawn(7, true)],
    ['7 Molti carri che sparano', () => { spawn(7, true); }, 'fire'],
    ['8 Carri danneggiati con fumo', () => { spawn(7, true); for (const t of KAS.tanks) if (t !== me) { t.cm.engine = 15; t.cm.turret = 35; } }],
    ['9 Carri distrutti e relitti', () => { spawn(8, false); for (const t of spawned) if (t.alive) { t.hp = -1; t.destroy(false, R() < .4); } }],
    ['10 Carri con fanteria (16 soldati)', () => { spawn(7, true); try { for (let i = 0; i < 16; i++) troops.push(new Soldier(i % 2 ? 'E' : 'A', 'rifle', me.pos.x + rnd(-40, 40), me.pos.z - 60 + rnd(-30, 30), {})); } catch (e) { troops.err = e.message; } }],
  ];
  for (const [name, setup, extra] of SC) {
    clear(); spawned.length = 0; me.pos.copy(base); vpPoseKin(me, 1, true); me.hp = 1e6; setup();
    const ft = [], calls = [], tris = [], ph = [], co = [], ai = []; let last = performance.now(), t0 = last, fT = 0;
    await new Promise(done => { const step = now => { const dt = now - last; last = now;
      if (now - t0 > 1200) { ft.push(dt); calls.push(ri.render.calls); tris.push(ri.render.triangles); ph.push(VP.st.phys); co.push(VP.st.col); ai.push(VP.st.ai); }
      ri.reset(); VP.st.phys = VP.st.col = VP.st.ai = 0;
      if (extra === 'fire' && (fT += dt) > 400) { fT = 0; for (const t of KAS.tanks) if (t.alive && t !== me) { t.reload = 0; t.fireMain(false); } }
      if (now - t0 < secs * 1000) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    const s = ft.slice().sort((a, b) => a - b), mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), worst = s.slice(Math.floor(s.length * .99)), avg = mean(ft);
    res.push({ name: name + (troops.err ? ' (fanteria non creata: ' + troops.err + ')' : ''), tanks: KAS.tanks.length, fps: +(1000 / avg).toFixed(1), low1: +(1000 / (mean(worst) || 1)).toFixed(1), ft: +avg.toFixed(2), phys: +mean(ph).toFixed(3), col: +mean(co).toFixed(3), ai: +mean(ai).toFixed(3), calls: Math.round(mean(calls)), tris: Math.round(mean(tris) / 1000), memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
  }
  clear(); me.drive = drive0; me.hp = hp0; me.pos.copy(base); vpPoseKin(me, 1, true); ri.autoReset = auto0; window.__vehBenchOn = false;
  const txt = 'Scenario | carri | FPS medi | 1% low | ms/fot | ms fisica | ms collisioni | ms IA | draw call | migliaia di triangoli | memoria MB\n' + res.map(r => `${r.name} | ${r.tanks} | ${r.fps} | ${r.low1} | ${r.ft} | ${r.phys} | ${r.col} | ${r.ai} | ${r.calls} | ${r.tris} | ${r.memMB}`).join('\n');
  console.log('BENCHMARK CARRI\n' + txt); try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) { }
  let el = $('benchOut'); if (!el) { el = document.createElement('pre'); el.id = 'benchOut'; el.style.cssText = 'position:fixed;left:50%;top:10%;transform:translateX(-50%);z-index:70;background:rgba(10,12,10,.92);color:#efe6cf;font:12px/1.5 monospace;padding:16px 20px;border:1px solid #e8c46a;white-space:pre;pointer-events:auto;cursor:pointer;max-width:96vw;overflow:auto'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.textContent = 'BENCHMARK CARRI (copiato negli appunti · clic per chiudere)\n\n' + txt;
  return res;
}
addEventListener('keydown', e => { if (e.code === 'KeyB' && e.ctrlKey && e.shiftKey && SCEN === 'kas') { e.preventDefault(); vehBench(); } });
