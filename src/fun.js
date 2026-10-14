"use strict";
// ============================================================
//  Punteggio, uccisioni multiple e serie di uccisioni:
//  ogni azione dà punti con un riquadro a schermo; le serie
//  senza morire sbloccano supporto aereo, rifornimento e uno
//  sbarramento navale. Il record personale resta salvato.
// ============================================================
const FUN = { score: 0, streak: 0, best: 0, multi: 0, multiT: 0, wasDead: false, pops: [], rewards: {} };

function initFun() {
  FUN.score = 0; FUN.streak = 0; FUN.multi = 0; FUN.multiT = 0;
  try { FUN.best = +localStorage.getItem('omahaBest') || 0; } catch (e) { FUN.best = 0; }
  let box = $('scorePop');
  if (!box) {
    box = document.createElement('div'); box.id = 'scorePop';
    box.style.cssText = 'position:fixed;left:50%;top:58%;transform:translateX(-50%);pointer-events:none;text-align:center;font:600 15px/1.25 Oswald,sans-serif;letter-spacing:.06em;text-shadow:0 1px 3px #000;z-index:20';
    document.body.appendChild(box);
    const big = document.createElement('div'); big.id = 'streakBanner';
    big.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%);pointer-events:none;text-align:center;font:700 30px/1.1 Oswald,sans-serif;letter-spacing:.12em;color:#f2d27a;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .4s;z-index:20';
    document.body.appendChild(big);
  }
  // le uccisioni e i colpi alla testa vengono intercettati alla fonte: ogni incremento dà punti
  let kills = STATS.kills || 0, heads = STATS.heads || 0;
  Object.defineProperty(STATS, 'kills', { configurable: true, get: () => kills, set: v => { const d = v - kills; kills = v; if (d > 0 && GAME.started) onKills(d); } });
  Object.defineProperty(STATS, 'heads', { configurable: true, get: () => heads, set: v => { const d = v - heads; heads = v; if (d > 0 && GAME.started) addScore(50 * d, 'Colpo alla testa', '#ffd27a'); } });
}

function addScore(pts, label, color = '#e8e2cf') {
  FUN.score += pts;
  const box = $('scorePop'); if (!box) return;
  const el = document.createElement('div'); el.textContent = `+${pts}  ${label.toUpperCase()}`; el.style.color = color; el.style.transition = 'opacity .5s, transform .5s';
  box.appendChild(el); while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translateY(-14px)'; }, 1500);
  setTimeout(() => el.remove(), 2100);
  if (FUN.score > FUN.best) { FUN.best = FUN.score; try { localStorage.setItem('omahaBest', FUN.best); } catch (e) { } }
}
function banner(text, sub) {
  const b = $('streakBanner'); if (!b) return;
  b.innerHTML = text + (sub ? `<div style="font-size:15px;letter-spacing:.06em;color:#e8e2cf">${sub}</div>` : '');
  b.style.opacity = 1; clearTimeout(b._t); b._t = setTimeout(() => b.style.opacity = 0, 2600);
}

function onKills(d) {
  // più di un'uccisione in un colpo solo = obiettivo o veicolo
  if (d >= 2) { addScore(d * 100, d >= 5 ? 'Obiettivo' : 'Veicolo distrutto', '#9fe08a'); return; }
  addScore(100, 'Eliminazione');
  FUN.streak++;
  FUN.multi = FUN.multiT > 0 ? FUN.multi + 1 : 1; FUN.multiT = 3.5;
  if (FUN.multi >= 2) {
    const names = ['', '', 'Doppia uccisione', 'Tripla uccisione', 'Quadrupla uccisione'];
    addScore(50 * FUN.multi, names[Math.min(4, FUN.multi)] || 'Strage', '#f2b84b');
    if (FUN.multi === 3) banner('TRIPLA UCCISIONE');
    if (FUN.multi >= 5) banner('STRAGE!');
  }
  streakReward(FUN.streak);
}

function streakReward(n) {
  if (n === 5) {
    AIR.cd = 0; banner('SERIE DI 5', 'Supporto aereo pronto — premi T'); sfxTick();
  } else if (n === 10) {
    resupply(); P.nades += 2; P.hp = 100; banner('SERIE DI 10', 'Rifornimento completo e ferite medicate');
  } else if (n === 15 || (n > 15 && n % 10 === 5)) {
    banner('SERIE DI ' + n, 'Sbarramento navale davanti a te!'); navalBarrage();
  } else if (n % 5 === 0) banner('SERIE DI ' + n);
}

// sbarramento: otto colpi da 127 mm sparsi 60-110 m davanti al giocatore, lontano dai compagni
function navalBarrage() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  say(N.radio, PT === 'A' ? 'Qui USS Texas: arrivano i colpi, giù la testa!' : 'Batteria costiera: fuoco di sbarramento in arrivo!');
  for (let k = 0; k < 8; k++) after(2.5 + k * .45, () => {
    const d = rnd(60, 110), s = rnd(-25, 25), p = new V3(P.pos.x + fx * d - fz * s, 0, P.pos.z + fz * d + fx * s);
    if (FRIENDS().some(f => f.alive && f.pos.distanceToSquared(p) < 15 * 15)) return;
    p.y = Math.max(Hf(p.x, p.z), WATER_Y) + .3;
    explode(p, 9, 500, { byPlayer: true, bomb: true });
  });
}

function updateFun(dt) {
  FUN.multiT -= dt;
  if (P.dead && !FUN.wasDead) { if (FUN.streak >= 5) feed('Serie interrotta a ' + FUN.streak); FUN.streak = 0; }
  FUN.wasDead = P.dead;
}
