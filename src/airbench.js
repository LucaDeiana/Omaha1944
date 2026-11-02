"use strict";
// ============================================================
//  Benchmark del combattimento aereo (Ctrl+Maiusc+B in volo, oppure airBench() dalla console).
//  Sei scenari da 15 s ciascuno, misurati sui fotogrammi veri del browser:
//  FPS medi, minimi, 1% low, tempo per fotogramma, draw call e triangoli.
//  Il giocatore vola in cerchio con il pilota automatico ed è invulnerabile durante la prova.
// ============================================================
const AIRBENCH = { on: false, res: [] };
function benchClear() {
  for (const p of PLANES.slice()) if (!p.player) p.remove();
  if (PL.wing) PL.wing.length = 0;
  if (typeof AIRM !== 'undefined' && AIRM.hunters) AIRM.hunters.length = 0;
}
function benchSpawn(nA, nE) {
  const me = PL.me;
  for (let i = 0; i < nA; i++) { const side = i % 2 ? 1 : -1, pos = new V3(side * (30 + i * 25), 5 + i * 8, 30 + i * 20).applyQuaternion(me.q).add(me.pos);
    const w = new Plane('p47', 'A', pos, me.vel.clone().setLength(150), []); w.wing = true; w.side = side; w.hp = 600; PL.wing.push(w); }
  for (let i = 0; i < nE; i++) { const p = spawnHunter('fw190'); const wl = PL.wing.filter(w => w.alive); if (wl.length && i % 2) p.huntTarget = wl[i % wl.length]; }
}
// scenari: [nome, gregari alleati, caccia nemici, extra]
const BENCH_SC = [['Volo senza nemici', 0, 0], ['Dogfight 1 contro 1', 0, 1], ['Dogfight 2 contro 2', 1, 2], ['Dogfight 4 contro 4', 3, 4], ['4 contro 4, aerei danneggiati', 3, 4, 'dmg'], ['4 contro 4, proiettili ed esplosioni', 3, 4, 'fx']];
async function airBench(secs = 15) {
  if (AIRBENCH.on || SCEN !== 'air' || !PL.me) { showMsg('Il benchmark si avvia in volo, nella modalità aerei', 3); return; }
  AIRBENCH.on = true; AIRBENCH.res = [];
  const me = PL.me, need0 = typeof AIRM !== 'undefined' ? AIRM.needKills : 0; if (typeof AIRM !== 'undefined') AIRM.needKills = -99;
  me.pos.y = Math.max(me.pos.y, 700); me.vel.setLength(150); PL.assist = true;
  const ri = renderer.info, auto0 = ri.autoReset; ri.autoReset = false;
  // tempo di calcolo di aerei (IA e fisica), proiettili ed effetti: misurabile anche dove la grafica è lenta
  const LOG = { ai: 0, fx: 0 }, wrap = (n, k) => { const f = window[n]; window[n] = function () { const t = performance.now(); const r = f.apply(this, arguments); LOG[k] += performance.now() - t; return r; }; return f; };
  const o1 = wrap('updateAircraft', 'ai'), o2 = wrap('updateAirBullets', 'ai'), o3 = wrap('updatePlane', 'ai'), o4 = wrap('updateFX', 'fx');
  for (const [name, nA, nE, extra] of BENCH_SC) {
    benchClear(); benchSpawn(nA, nE);
    if (extra === 'dmg') for (const p of PLANES) if (!p.player && typeof acDamageDemo === 'function') acDamageDemo(p);
    const ft = [], calls = [], tris = [], ai = [], fx = []; let last = performance.now(), t0 = last, fxT = 0;
    await new Promise(done => {
      const step = now => {
        const dt = now - last; last = now;
        if (now - t0 > 1500) { ft.push(dt); calls.push(ri.render.calls); tris.push(ri.render.triangles); ai.push(LOG.ai); fx.push(LOG.fx); }
        LOG.ai = LOG.fx = 0;   // il primo secondo e mezzo serve ad assestarsi
        ri.reset();
        // pilota automatico: cerchio largo a quota costante, invulnerabile
        PL.aimYaw += .00025 * dt; PL.aimPitch = clamp((700 - me.pos.y) * .002, -.2, .25); PL.throttle = .8; me.hp = me.hpMax || 1100; if (me.parts) for (const k in me.parts) me.parts[k] = 1; me.engFire = false;
        if (extra === 'fx' && (fxT += dt) > 250) { fxT = 0; const q = PLANES[(Math.random() * PLANES.length) | 0]; if (q) { fxExplosion(q.pos.clone().add(new V3(rnd(-40, 40), rnd(-20, 20), rnd(-40, 40))), 2, false);
          for (let k = 0; k < 12; k++) fireAirBullet(q.pos.clone(), new V3(rnd(-1, 1), rnd(-.3, .3), rnd(-1, 1)).normalize(), q.vel, { cal: 20 }, 1, false, q.team === 'A' ? 'A' : 'E'); } }
        if (now - t0 < secs * 1000 && AIRBENCH.on) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    const s = ft.slice().sort((a, b) => a - b), avgFt = ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length), worst = s.slice(Math.floor(s.length * .99));
    const low1 = worst.length ? 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length) : 0, avg = a => Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));
    AIRBENCH.res.push({ name, fps: +(1000 / avgFt).toFixed(1), min: +(1000 / (s[s.length - 1] || 1)).toFixed(1), low1: +low1.toFixed(1), ft: +avgFt.toFixed(2), calls: avg(calls), tris: avg(tris), planes: PLANES.length, aiMs: +(ai.reduce((x, y) => x + y, 0) / Math.max(1, ai.length)).toFixed(2), fxMs: +(fx.reduce((x, y) => x + y, 0) / Math.max(1, fx.length)).toFixed(2) });
  }
  window.updateAircraft = o1; window.updateAirBullets = o2; window.updatePlane = o3; window.updateFX = o4;
  ri.autoReset = auto0; benchClear(); if (typeof AIRM !== 'undefined') AIRM.needKills = need0; AIRBENCH.on = false;
  const txt = 'Scenario | FPS medi | FPS min | 1% low | ms/fot | draw call | triangoli | ms aerei | ms effetti\n' + AIRBENCH.res.map(r => `${r.name} | ${r.fps} | ${r.min} | ${r.low1} | ${r.ft} | ${r.calls} | ${r.tris} | ${r.aiMs} | ${r.fxMs}`).join('\n');
  console.log('BENCHMARK AEREO\n' + txt); try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) { }
  let el = $('benchOut'); if (!el) { el = document.createElement('pre'); el.id = 'benchOut'; el.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:70;background:rgba(10,12,10,.92);color:#efe6cf;font:13px/1.5 monospace;padding:16px 20px;border:1px solid #e8c46a;white-space:pre;pointer-events:auto;cursor:pointer'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.textContent = 'BENCHMARK AEREO (copiato negli appunti · clic per chiudere)\n\n' + txt;
  return AIRBENCH.res;
}
addEventListener('keydown', e => { if (e.code === 'KeyB' && e.ctrlKey && e.shiftKey && SCEN === 'air') { e.preventDefault(); airBench(); } });
