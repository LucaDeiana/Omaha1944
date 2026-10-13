"use strict";
// ============================================================
//  USS Texas: ponte calpestabile, ufficiale Hayes, torretta B
// ============================================================
const SHIP = { x: -230, z: 780, deckY: 7.7, its: [] };
// nave ruotata di 90°: asse longitudinale lungo x (prua verso +x)
function shipDeckY(x, z) {
  const lz = x - SHIP.x, lx = SHIP.z - z;
  if (Math.abs(lz) > 84) return -99;
  const hw = 15.2 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, Math.abs(lz) - 30) / 56, 2)));
  return Math.abs(lx) < hw - .7 ? SHIP.deckY : -99;
}
function initShipDeck() {
  const y = SHIP.deckY;
  // sovrastruttura e torri come ostacoli
  addSolid(SHIP.x - 26.1, y, SHIP.z - 8, SHIP.x + 26.1, y + 25, SHIP.z + 8, 'ship');
  for (const lz of [53.9, 39.2, -7, -39.2, -53.9]) addSolid(SHIP.x + lz - 4.6, y, SHIP.z - 4.6, SHIP.x + lz + 4.6, y + 6, SHIP.z + 4.6, 'ship');
  // l'ufficiale di tiro
  const h = addAlly('rifle', SHIP.x + 34, SHIP.z - 6, { y, name: 'Lt. Cmdr. Hayes', stationary: true, state: 'post', yaw: -PI / 2 });
  h.vip = true; h.ship = true; hidePart(h.body, 'weapon');
  // alcuni marinai ai pezzi antiaerei
  for (const [lz, lx] of [[12, -12], [-14, 12], [-20, -12], [60, 6]]) { const s = addAlly('rifle', SHIP.x + lz, SHIP.z - lx, { y, stationary: true, state: 'post', yaw: lx > 0 ? PI : 0 }); s.vip = true; s.ship = true; hidePart(s.body, 'weapon'); }
  NPC.list.push({
    s: h, title: 'L\'occhio dell\'Ammiraglio', state: 0,
    talk(q) {
      if (q.state === 0) {
        q.state = 1; NPC.hayes.armed = true;
        say(h.name, 'Ah, il fante che ci hanno mandato in prestito. I miei puntatori sono mezzi sordi.');
        after(4, () => say(h.name, 'Prendi la torretta B: dieci crucchi in novanta secondi e ti faccio ricaricare più in fretta.'));
      } else say(h.name, NPC.hayes.state === 2 ? 'Tiro da manuale, ragazzo.' : 'La torretta B ti aspetta. Premi E sulla scaletta.');
    },
    marker(q) { return q.state === 1 && NPC.hayes.state < 2 && P.onShip ? { pos: new V3(SHIP.x + 33, SHIP.deckY + 2, SHIP.z), label: 'Torretta B' } : null; },
  });
  SHIP.its.push({ pos: new V3(SHIP.x + 33, y, SHIP.z), r: 3, label: 'Premi E per prendere posto alla torretta B', active: () => P.onShip && P.mode === 'foot', done: () => { enterNaval(); } });
}
function spawnOnShip() {
  resetPlayerState(); P.inBoat = false; P.mode = 'foot';
  P.pos.set(SHIP.x + 44, SHIP.deckY, SHIP.z - 3); P.yaw = PI / 2; P.onShip = true;
  showMsg('USS Texas — ponte di coperta', 3);
}
function leaveTurretToDeck() {
  leaveMode(); P.pos.set(SHIP.x + 31, SHIP.deckY, SHIP.z + 1); P.yaw = PI / 2; P.onShip = true; P.vy = 0;
}
