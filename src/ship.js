"use strict";
// ============================================================
//  USS Texas: ponte calpestabile, ufficiale Hayes, torretta B
// ============================================================
const SHIP = { x: -230, z: 780, deckY: 7.7, its: [] };
// nave ruotata di 90°: asse longitudinale lungo x (prua verso +x)
// profilo della coperta ricavato dalle sezioni dello scafo (insellatura e bolzone)
function shipDeckAt(lz, lx) {
  const L = 174, B = 32, F = 7.5, t = (lz + L / 2) / L;
  if (t < 0 || t > 1) return null;
  const hb = B / 2 * (t < .1 ? .6 + .4 * smooth(t / .1) : t > .58 ? Math.max(.015, 1 - Math.pow((t - .58) / .42, 1.8)) : 1);
  const hd = hb * (1 + .12 * smooth((t - .72) / .28)), fb = F * (1 + .3 * smooth((t - .6) / .4) + .06 * smooth((.1 - t) / .1)), cb = B * .012;
  const u = Math.abs(lx) / hd; if (u > .93) return null;
  return { y: u < .55 ? fb + cb - .3 * cb * u / .55 : fb + .7 * cb * (1 - (u - .55) / .45), hd };
}
function shipDeckY(x, z) { const d = shipDeckAt(x - SHIP.x, SHIP.z - z); return d && Math.abs(x - SHIP.x) < 84 ? d.y : -99; }
function shipY(lz, lx) { return shipDeckY(SHIP.x + lz, SHIP.z - lx); }
function initShipDeck() {
  // tavolato in teak del ponte
  const mb = new MB(); mb.mat = 'wood';
  for (let lz = -82; lz < 82; lz += 3) for (let lx = -16; lx < 16; lx += .9) {
    const c = lz + 1.5, m = lx + .45, d = shipDeckAt(c, m); if (!d || Math.abs(m) > d.hd * .9) continue;
    const y2 = shipY(c, m + .1), y1 = shipY(c, m - .1), y3 = shipY(c + .5, m), y0 = shipY(c - .5, m);
    if (y1 < 0 || y2 < 0 || y0 < 0 || y3 < 0) continue;
    mb.add(U.box, R() < .5 ? 0x5e4630 : 0x54402c, SHIP.x + c, d.y + .03, SHIP.z - m, Math.atan2(y2 - y1, .2), 0, Math.atan2(y3 - y0, 1), 3.08, .07, .96);
  }
  scene.add(groupMesh(mb.buildGroups(), false));
  // sovrastruttura e torri come ostacoli
  addSolid(SHIP.x - 26.1, 7, SHIP.z - 8, SHIP.x + 26.1, 35, SHIP.z + 8, 'ship');
  for (const lz of [53.9, 39.2, -7, -39.2, -53.9]) addSolid(SHIP.x + lz - 4.6, 7, SHIP.z - 4.6, SHIP.x + lz + 4.6, 16, SHIP.z + 4.6, 'ship');
  // l'ufficiale di tiro
  const h = addAlly('rifle', SHIP.x + 34, SHIP.z - 6, { y: shipY(34, 6), name: 'Lt. Cmdr. Hayes', stationary: true, state: 'post', yaw: -PI / 2 });
  h.vip = true; h.ship = true; hidePart(h.body, 'weapon');
  // alcuni marinai ai pezzi antiaerei
  for (const [lz, lx] of [[12, -12], [-14, 12], [-20, -12], [60, 6]]) { const s = addAlly('rifle', SHIP.x + lz, SHIP.z - lx, { y: shipY(lz, lx), stationary: true, state: 'post', yaw: lx > 0 ? PI : 0 }); s.vip = true; s.ship = true; hidePart(s.body, 'weapon'); }
  NPC.list.push({
    s: h, title: 'L\'occhio dell\'Ammiraglio', state: 0,
    talk(q) {
      if (q.state === 0) {
        q.state = 1; NPC.hayes.armed = true;
        say(h.name, 'Ah, il fante che ci hanno mandato in prestito. I miei puntatori sono mezzi sordi.');
        after(4, () => say(h.name, 'Prendi la torretta B: dieci crucchi in novanta secondi e ti faccio ricaricare più in fretta.'));
      } else say(h.name, NPC.hayes.state === 2 ? 'Tiro da manuale, ragazzo.' : 'La torretta B ti aspetta. Premi E sulla scaletta.');
    },
    marker(q) { return q.state === 1 && NPC.hayes.state < 2 && P.onShip ? { pos: new V3(SHIP.x + 33, shipY(33, 0) + 2, SHIP.z), label: 'Torretta B' } : null; },
  });
  SHIP.its.push({ pos: new V3(SHIP.x + 33, shipY(33, 0), SHIP.z), r: 3, label: 'Premi E per prendere posto alla torretta B', active: () => P.onShip && P.mode === 'foot', done: () => { enterNaval(); } });
}
function spawnOnShip() {
  resetPlayerState(); P.inBoat = false; P.mode = 'foot';
  P.pos.set(SHIP.x + 44, shipY(44, 3), SHIP.z - 3); P.yaw = PI / 2; P.onShip = true;
  showMsg('USS Texas — ponte di coperta', 3);
}
function leaveTurretToDeck() {
  leaveMode(); P.pos.set(SHIP.x + 31, shipY(31, -1), SHIP.z + 1); P.yaw = PI / 2; P.onShip = true; P.vy = 0;
}
