"use strict";
// ============================================================
//  Personaggi speciali con nome e missioni personali
// ============================================================
const NPC = { list: [], tags: [], hayes: { state: 0, k0: 0, t: 0 }, navRel: 8 };

function initNPC() {
  if (PT === 'E' || SCEN === 'ard') return;
  // Pvt. Danny Rizzo: inchiodato a terra dietro un cratere sul bassofondale
  const rz = addAlly('rifle', -14, 24, { name: 'Pvt. Danny Rizzo', stationary: true, state: 'post' });
  rz.vip = true; rz.forceProne = true; rz.prone = 1; rz.yaw = PI;
  NPC.list.push({
    s: rz, title: 'Il ragazzo inchiodato', state: 0,
    talk(q) {
      if (q.state === 0) {
        q.bunker = WORLD.bunkers.filter(b => !b.destroyed).sort((a, b) => Math.abs(a.x - rz.pos.x) - Math.abs(b.x - rz.pos.x))[0];
        if (!q.bunker) { say(rz.name, 'Grazie al cielo quella MG ha smesso. Andiamo!'); return npcFinish(q); }
        q.state = 1; q.sup = 0;
        say(rz.name, 'Non posso muovermi! Quella MG42 mi tiene giù da dieci minuti!');
        after(3, () => say(rz.name, 'Tienigli la testa bassa — spara alla feritoia, e io corro al terrapieno!'));
      } else if (q.state === 1) say(rz.name, 'Spara alla feritoia! Non ce la faccio da solo!');
    },
    update(q, dt) {
      if (q.state !== 1) return;
      if (q.bunker.supT > 0) q.sup += dt;
      if (q.bunker.destroyed || q.sup > 3.5) {
        q.state = 2; rz.forceProne = false; rz.stationary = false; rz.state = 'idle'; rz.squad = true; rz.wait = 0;
        say(rz.name, 'Vado! Vado! Ti devo la vita, amico!'); shout('en', 'move', rz.pos, { text: "Covering fire! I'm moving!" });
        P.nades += 2; resupply(); feed('Rizzo ti lancia due granate e caricatori'); STATS.kills += 3;
      }
    },
    marker(q) { return q.state === 1 && q.bunker ? { pos: new V3(q.bunker.x, q.bunker.slitY, q.bunker.z + 3), label: 'Sopprimi la MG42' } : null; },
  });
  // Pierre Lefèvre: Résistance, a Colleville
  const pl = addAlly('rifle', 22, -276, { name: 'Pierre Lefèvre', stationary: true, state: 'post' });
  pl.vip = true; pl.yaw = PI; pl.root.visible = true;
  NPC.list.push({
    s: pl, title: 'I documenti del comando', state: 0, need: 6,
    talk(q) {
      if (q.state === 0) {
        q.state = 1; q.doc = new V3(-46, 0, -312); q.doc.y = Hf(q.doc.x, q.doc.z);
        say(pl.name, 'Américains! Enfin! Ascoltate: nella casa a ovest della piazza c\'è il posto comando tedesco.');
        after(4, () => say(pl.name, 'Le carte delle batterie sono lì. Prendetele e la vostra marina li cancellerà.'));
        q.guards = []; for (let k = 0; k < 5; k++) q.guards.push(addEnemy(pick(['rifle', 'smg']), q.doc.x + rnd(-8, 8), q.doc.z + rnd(-6, 8), { group: 'cp' }));
        MISSION.interactables.push(q.it = { pos: q.doc, r: 2.5, hold: 2.5, label: 'Tieni premuto E per prendere le carte', active: () => q.state === 1, done: () => { q.state = 2; sfxMech('pick'); feed('Carte delle batterie recuperate'); say(N.walsh, 'Le abbiamo! Riportiamole al francese!'); } });
      } else if (q.state === 2) {
        q.state = 3; say(pl.name, 'Magnifique! Trasmetto subito le coordinate alla flotta.');
        after(5, () => { say(N.radio, 'Ricevute le coordinate, fuoco in arrivo sulle batterie!'); for (let k = 0; k < 8; k++) after(1 + k * .6, () => { const p = new V3(rnd(-300, 300), 0, rnd(-380, -460)); p.y = Hf(p.x, p.z); explode(p, 12, 600, { bomb: true, byPlayer: true }); fxExplosion(p, 3, false); }); });
        STATS.kills += 8; npcFinish(q);
      } else if (q.state === 1) say(pl.name, 'La casa a ovest, presto! Prima che brucino tutto.');
    },
    active() { return MISSION.stage >= 6; },
    update(q) { if (q.state === 1 && q.it && !MISSION.interactables.includes(q.it)) MISSION.interactables.push(q.it); },
    marker(q) { return q.state === 1 ? { pos: q.doc.clone().add(new V3(0, 2, 0)), label: 'Carte' } : q.state === 2 ? { pos: pl.pos.clone().add(new V3(0, 2.3, 0)), label: 'Lefèvre' } : null; },
  });
  initShipDeck(); initInland();
  for (let i = 0; i < NPC.list.length; i++) { const d = document.createElement('div'); d.className = 'ntag'; $('markers').appendChild(d); NPC.tags.push(d); }
}
function npcFinish(q) { q.state = 9; showMsg('Missione personale compiuta: ' + q.title, 3); }

// Lt. Cmdr. Hayes: ufficiale di tiro della Texas, sfida a tempo
function updateHayes(dt) {
  const h = NPC.hayes;
  if (P.mode !== 'naval') { if (h.state === 1) { h.state = 0; } return; }
  if (h.state === 0 && !h.armed) { if (!h.hint) { h.hint = true; say('Lt. Cmdr. Hayes', 'Quando scendi dalla torretta passa a trovarmi in coperta, marinaio.'); } return; }
  if (h.state === 0) { h.state = 1; h.t = 90; h.k0 = STATS.kills; say('Lt. Cmdr. Hayes', 'Marinaio, l\'Ammiraglio guarda. Dieci crucchi in novanta secondi e ti faccio caricare più in fretta.'); }
  else if (h.state === 1) {
    h.t -= dt; const n = STATS.kills - h.k0;
    if (n >= 10) { h.state = 2; NPC.navRel = 5; showMsg('Hayes: ricarica rapida sbloccata', 3); say('Lt. Cmdr. Hayes', 'Gran bel tiro! Da ora i serventi ricaricano in cinque secondi.'); }
    else if (h.t <= 0) { h.state = 3; say('Lt. Cmdr. Hayes', 'Troppo lento. Riproveremo al prossimo turno.'); }
  }
}

function npcInteractables() {
  const out = SHIP.its.filter(it => it.active()).concat(stationInteractables(), tankInteractables(), wireInteractables());
  for (const q of NPC.list) {
    if (q.state >= 9 || !q.s.alive || (q.active && !q.active())) continue;
    out.push({ pos: q.s.pos, r: 2.6, label: 'Premi E per parlare con ' + q.s.name, active: () => true, done: () => q.talk(q) });
  }
  return out;
}
function updateNPC(dt) {
  updateHayes(dt);
  NPC.markers = [];
  for (const q of NPC.list) { if (q.update) q.update(q, dt); const m = q.marker && q.marker(q); if (m && P.mode === 'foot') NPC.markers.push(m); }
  // nomi sopra la testa
  for (let i = 0; i < NPC.tags.length; i++) {
    const el = NPC.tags[i], q = NPC.list[i];
    if (!q || P.mode !== 'foot' || !q.s.alive || q.s.removed) { el.style.display = 'none'; continue; }
    const d = camera.position.distanceTo(q.s.pos);
    _hv.copy(q.s.pos); _hv.y += 2.1 - q.s.prone * 1.5; _hv.project(camera);
    if (d > 60 || _hv.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.style.left = ((_hv.x * .5 + .5) * innerWidth) + 'px'; el.style.top = ((-_hv.y * .5 + .5) * innerHeight) + 'px';
    el.innerHTML = q.s.name + (q.state === 0 ? ' <b>!</b>' : '');
  }
}
