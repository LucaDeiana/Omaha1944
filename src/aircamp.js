"use strict";
// ============================================================
//  AIR MISSIONS 3.0 — sistema delle missioni aeree a configurazione.
//  Ogni missione è un oggetto dati (AIR_CAMPAIGN): mappa, velivolo, partenza, meteo e ora, gruppi di unità,
//  obiettivi primari in sequenza e secondari in parallelo, eventi a condizione, frasi radio, condizioni di fallimento.
//  Il motore (amis*) trasforma gli obiettivi nelle tappe della modalità aerea, tiene le statistiche, calcola
//  la valutazione e salva i progressi della campagna. Le unità usano i sistemi già esistenti: Air Combat 2.0
//  per i caccia, AirTruck e postazioni contraeree della Normandia, i modelli navali della modalità navale.
// ============================================================
const AMIS = { on: false, M: null, stages: [], sec: [], groups: {}, used: new Set(), fired: new Set(), t: 0, st: null, fogK: 1, fogT: 1 };
const AMIS_KEY = 'fo44_aircamp';

// ---------- campagna ----------
const AIR_CAMPAIGN = [
  {
    id: 'c_norm_cas', n: 1, title: 'Strade di Normandia', sub: 'Supporto e interdizione dietro le spiagge',
    date: '7 giugno 1944', time: 'mattina', theatre: 'Normandia', place: 'Entroterra di Omaha Beach e valle della Douve (ricostruzione)',
    map: 'norm', aircraft: 'p47', lives: 3, timeLimit: 1500, noRearm: true, noCarrier: true,
    arm: '8 mitragliatrici Browning M2 da 12,7 mm, 2 bombe da 500 libbre',
    weather: { label: 'Nuvoloso, base delle nubi tra 500 e 700 m, foschia in aumento', cloudY: -160, cover: .35, gray: .25, fog: 1.3 },
    context: 'Il giorno dopo lo sbarco la testa di ponte di Omaha è ancora sottile. I gruppi caccia della 9ª Air Force, decollati dall\'Inghilterra, battono le strade dietro la costa per fermare i rinforzi tedeschi diretti alle spiagge. La Luftwaffe si vede poco, ma la Flak protegge strade e ponti.',
    history: {
      doc: ['Nei giorni dello sbarco i P-47 della 9ª Air Force (Ninth Air Force) attaccarono strade, ponti e ferrovie dietro le spiagge normanne, con bombe da 500 libbre e mitragliatrici da 12,7 mm.', 'Il 6 e il 7 giugno la Luftwaffe effettuò pochissime sortite sulla testa di sbarco rispetto alle migliaia degli Alleati.', 'Il tempo nei primi giorni dell\'invasione era nuvoloso e ventoso.', 'I P-47 operavano dalle basi in Inghilterra: le prime piste avanzate in Normandia entrarono in servizio solo nei giorni successivi.'],
      plaus: ['Una colonna di autocarri diretta verso la costa lungo una strada secondaria, scortata da contraerea leggera.', 'Una coppia di Fw 190 che compare sulla zona dopo l\'attacco.', 'La geografia è una ricostruzione: costa, fiume, ponte e villaggio non riproducono un luogo preciso.'],
      game: ['Fino a tre aerei di riserva.', 'Il rientro termina sopra la Manica invece che con l\'atterraggio in Inghilterra.', 'I reparti e i nominativi radio sono generici, non riferiti a una missione documentata.'],
    },
    start: { x: -250, z: 1600, alt: 520, hdg: PI },
    groups: {
      convoy() { const L = []; for (let k = 0; k < 10; k++) L.push(new AirTruck(-1000 - k * 24, k)); return L; },
      aa() { for (const a of WORLD.aaSites) for (let i = 0; i < 2; i++) addEnemy('rifle', a.x + (i ? 1 : -1), a.z + .5, { state: 'post', stationary: true, role: 'aa', group: 'aa' }); return WORLD.aaSites; },
    },
    objectives: [
      { id: 'coast', type: 'reach', title: 'Raggiungi la costa e il punto d\'ingresso', pos: [-120, 160], r: 450, label: 'Ingresso' },
      { id: 'find', type: 'identify', title: 'Cerca e identifica la colonna sulla strada per la costa', group: 'convoy', area: [260, -700], r: 650, maxAlt: 900, t: 2.5, label: 'Area di ricerca' },
      { id: 'attack', type: 'destroy', title: 'Ferma la colonna', group: 'convoy', need: 6, label: 'Colonna' },
      { id: 'rtb', type: 'return', title: 'Rientra verso la Manica', pos: [-200, 1700], r: 500, label: 'Rientro' },
    ],
    secondary: [
      { id: 'flak', type: 'destroy', title: 'Neutralizza almeno 3 postazioni contraeree', group: 'aa', need: 3, hidden: false },
      { id: 'bridge', type: 'bridge', title: 'Interrompi il ponte sulla Douve', hidden: true, label: 'Ponte' },
    ],
    radio: {
      start: 'Thunderbolt Leader, qui Comando. Colonne nemiche segnalate verso la costa: ingresso dal mare, poi armed recon a sud.',
      coast: 'Costa sotto di noi. La strada corre a sud-est, oltre il fiume. Tenete gli occhi aperti.',
      found: 'Contatto! Autocarri sulla strada, diretti a nord. Sono militari: attaccate.',
      scatter: 'Si fermano e escono dalla strada, si stanno disperdendo!',
      flakFirst: 'Flak, a ore due! Non restate dritti, cambiate quota.',
      cloud: 'Il soffitto si abbassa, la visibilità peggiora verso l\'interno.',
      fighters: 'Attenzione, due Focke-Wulf da sud, quota media!',
      bridge: 'Comando a Thunderbolt: chi ha ancora bombe colpisca il ponte sulla Douve, i rinforzi passano di lì.',
      done: 'Colonna fermata, ottimo lavoro. Rientrate, rotta nord verso la Manica.',
      wingHit: 'Sono colpito, ma resto in formazione!',
      fail: 'Abbiamo perso troppi aerei. Interrompete e rientrate.',
    },
    events: [
      { id: 'cloud', when: c => c.t > 70, radio: 'cloud', do() { AMIS.fogT = 1.75; } },
      { id: 'scatter', when: c => AIRM.convoyHit, radio: 'scatter' },
      { id: 'flakFirst', when: c => c.flakNear, radio: 'flakFirst' },
      { id: 'fighters', when: c => AIRM.convoyHit && c.t - AIRM.convoyHit > 75, radio: 'fighters', do() { for (let i = 0; i < 2; i++) { const h = spawnHunter('fw190'); AMIS.st.foes++; } } },
      { id: 'bridge', when: c => c.done('attack') || (AIRM.convoyHit && c.t - AIRM.convoyHit > 140), radio: 'bridge', do() { amisReveal('bridge'); } },
      { id: 'wingHit', when: c => (PL.wing || []).some(w => w.hp0 && w.hp < w.hp0 * .6), radio: 'wingHit' },
    ],
  },
  {
    id: 'c_norm_fleet', n: 2, title: 'Ombrello sulla flotta', sub: 'Copertura bassa sulle navi davanti a Omaha',
    date: '7 giugno 1944', time: 'tramonto', theatre: 'Canale della Manica', place: 'Acque davanti a Omaha Beach (ricostruzione)',
    map: 'norm', aircraft: 'spit', lives: 3, timeLimit: 1500, noRearm: true, noCarrier: true,
    arm: '2 cannoni Hispano da 20 mm, 4 mitragliatrici Browning da 7,7 mm',
    weather: { label: 'Nubi sparse, mare mosso, luce radente del tramonto', cloudY: 0, cover: .15, gray: .1, fog: 1.2, dusk: true },
    context: 'Davanti alle spiagge centinaia di navi scaricano uomini e mezzi; la corazzata USS Texas spara ancora sull\'entroterra. Gli Spitfire della RAF tengono la copertura bassa sulla testa di sbarco. Al crepuscolo la Luftwaffe tenta piccole incursioni contro il naviglio.',
    history: {
      doc: ['Gli Spitfire della RAF assicurarono la copertura a bassa quota sulle spiagge e sul naviglio dello sbarco.', 'La USS Texas sostenne con il fuoco navale le truppe a Omaha Beach il 6 e il 7 giugno 1944.', 'La Luftwaffe attaccò il naviglio alleato soprattutto al crepuscolo e di notte, con forze modeste, usando anche Ju 88 e cacciabombardieri Fw 190.'],
      plaus: ['Due incursioni nella stessa sera: quattro Fw 190 con bombe a bassa quota, poi tre Ju 88 scortati da due Bf 109.', 'La composizione del gruppo navale (una corazzata, due cacciatorpediniere, quattro trasporti) è una semplificazione.'],
      game: ['I cacciatorpediniere usano il modello della classe Fletcher, i trasporti un mercantile generico.', 'Le navi incrociano su una rotta ad anello invece di restare all\'ancora.', 'Fino a tre aerei di riserva; il rientro termina sopra la Manica.'],
    },
    start: { x: -1300, z: 1700, alt: 420, hdg: -PI * .25 },
    groups: { fleet() { return amisFleet(); } },
    objectives: [
      { id: 'join', type: 'reach', title: 'Raggiungi il gruppo navale', pos: [-300, 1080], r: 600, label: 'Flotta' },
      { id: 'patrol', type: 'patrol', title: 'Pattuglia sopra la flotta', pos: [0, 1100], r: 1500, t: 60, label: 'Settore' },
      { id: 'raid1', type: 'intercept', title: 'Intercetta i cacciabombardieri prima dello sgancio', group: 'raid1', spawn: 'raid1' },
      { id: 'patrol2', type: 'patrol', title: 'Resta sulla flotta: altri contatti radar', pos: [0, 1100], r: 1500, t: 35, label: 'Settore' },
      { id: 'raid2', type: 'intercept', title: 'Ferma i bombardieri Ju 88', group: 'raid2', spawn: 'raid2' },
      { id: 'rtb', type: 'return', title: 'Rientra, rotta nord', pos: [-300, 2300], r: 500, label: 'Rientro' },
    ],
    secondary: [
      { id: 'noLoss', type: 'protect', title: 'Nessun trasporto affondato', group: 'fleet', kinds: ['cargo'], lose: 0 },
      { id: 'friendly', type: 'flag', title: 'Non farti sparare dalle navi amiche (stai sopra i 300 m sulle navi)', ok: () => !AMIS.st.friendlyHit },
    ],
    fail: [{ id: 'fleetLost', check: () => amisFleetLost(['cargo']) >= 3, why: 'Tre trasporti affondati: la flotta è stata colpita duramente.' }],
    radio: {
      start: 'Qui controllo caccia sulla nave comando. Ombrello basso sulla flotta di Omaha, nessun contatto per ora.',
      join: 'Vi vediamo sopra il gruppo navale. Tenete la quota sopra i trecento metri sulle navi: i serventi sparano a tutto.',
      raid1: 'Contatto radar! Piccoli aerei veloci, bassi, da sud-est, verso i trasporti!',
      raid1done: 'Primo gruppo disperso. Restate in zona.',
      raid2: 'Nuovo contatto, più grande, da sud a quota media: bombardieri con scorta.',
      raid2done: 'Le navi sono al sicuro. Ottimo lavoro, rientrate.',
      evade: 'Qui la flotta: accostiamo, accostiamo!',
      friendly: 'Ehi, siamo amici! Le navi ci sparano addosso, alziamoci!',
      shipHit: 'Un trasporto è stato colpito, incendio a bordo!',
      texas: 'La Texas apre il fuoco sull\'entroterra.',
      fail: 'Abbiamo perso troppi aerei. Interrompete la pattuglia.',
    },
    events: [
      { id: 'texas', when: c => c.t > 25, radio: 'texas' },
      { id: 'friendly', when: c => AMIS.st.friendlyHit, radio: 'friendly' },
      { id: 'shipHit', when: c => amisFleetDamaged(), radio: 'shipHit' },
      { id: 'evade', when: c => c.raidNear, radio: 'evade', do() { for (const s of AMIS.groups.fleet || []) s.evade = 40; } },
    ],
  },
];
// missioni pianificate (non ancora giocabili): descritte nel documento AIR_MISSIONS_3.md
const AIR_CAMPAIGN_PLANNED = [
  ['Caccia ai convogli', 'Francia, estate 1944 · P-47'], ['Cielo d\'inverno', 'Ardenne, dicembre 1944 · P-47'], ['Caccia ai treni', 'Europa occidentale, 1944 · P-47'],
  ['Duello sopra la Germania', 'Germania, 1944-45 · P-47 e Fw 190'], ['Caccia ai convogli navali', 'Coste norvegesi o olandesi · Beaufighter (aereo da aggiungere)'],
  ['Attacco al naviglio', 'Mediterraneo, 1943-44 · aereo da verificare'], ['Scorta di convoglio', 'Teatro marittimo da verificare'],
];

// ---------- progressi salvati ----------
function amisLoad() { try { return JSON.parse(localStorage.getItem(AMIS_KEY)) || { done: {} }; } catch (e) { return { done: {} }; } }
function amisSave(s) { try { localStorage.setItem(AMIS_KEY, JSON.stringify(s)); } catch (e) { } }
function amisUnlocked(M) { if (M.n === 1) return true; const s = amisLoad(), prev = AIR_CAMPAIGN.find(m => m.n === M.n - 1); return !!(prev && s.done[prev.id]); }

// ---------- scelta dal menù: la voce 'c_…' della mappa aerea è una missione ----------
function amisPrepare() {
  AMIS.on = false; AMIS.M = null;
  if (typeof AIRMAP !== 'string' || !AIRMAP.startsWith('c_')) return;
  const M = AIR_CAMPAIGN.find(m => m.id === AIRMAP); if (!M) { AIRMAP = 'norm'; return; }
  AMIS.on = true; AMIS.M = M; AIRMAP = M.map; SETTINGS.plane = M.aircraft; AIRFREE = false;
}
// ---------- avvio: gruppi, tappe dagli obiettivi, statistiche ----------
function amisInit() {
  const M = AMIS.M; AMIS.t = 0; AMIS.used.clear(); AMIS.fired.clear(); AMIS.groups = {}; AMIS.over = false; AMIS.fogK = 1; AMIS.fogT = M.weather.fog || 1;
  AMIS.st = { shots: 0, hits: 0, lost: 0, dmg: 0, kills: 0, foes: 0, ground: 0, naval: 0, bombs: 0, t0: GAME.time, friendlyHit: false, objDone: {}, objFail: {} };
  AIRM.convoyHit = 0;
  for (const k in M.groups) AMIS.groups[k] = M.groups[k]();
  AMIS.sec = M.secondary.map(o => Object.assign({ state: o.hidden ? 'hidden' : 'active' }, o));
  AMIS.stages = M.objectives.map((o, i) => amisStage(o, i));
  amisWeather(M.weather);
  amisRadio('start', 2);
}
function amisStage(o, i) {
  return {
    title: o.title,
    start() { o.state = 'active'; o.acc = 0; o.found = false; if (o.spawn) AMIS.groups[o.group] = amisSpawn[o.spawn](); if (o.type === 'identify') AMIS.searching = o; },
    update(dt) {
      amisTick(dt);
      if (AMIS.over) return;
      const done = amisObj(o, dt);
      if (done) { AMIS.st.objDone[o.id] = true; o.state = 'done'; if (AMIS.M.radio[o.id]) amisRadio(o.id); else if (AMIS.M.radio[o.id + 'done']) amisRadio(o.id + 'done'); addScore(250, o.title, '#9fe08a'); if (i + 1 < AMIS.stages.length) setStage(i + 1); else amisEnd(true); }
    },
  };
}
// ---------- obiettivi ----------
const _amA = new V3();
function amisMe() { return PL.me && !PL.me.crash ? PL.me : null; }
function amisObj(o, dt) {
  const me = amisMe(), G = o.group ? AMIS.groups[o.group] || [] : [];
  const alive = L => L.filter(u => u.alive !== false && !u.crash && !u.dead);
  const dist = (x, z) => me ? Math.hypot(me.pos.x - x, me.pos.z - z) : 1e9, nav = (x, z, lab) => { MISSION.markers = [{ pos: new V3(x, Math.max(0, Hf(x, z)) + 40, z), label: lab }]; return amisNav(x, z); };
  switch (o.type) {
    case 'reach': { const d = dist(o.pos[0], o.pos[1]); MISSION.objText = o.title + ' — ' + nav(o.pos[0], o.pos[1], o.label); return d < o.r; }
    case 'return': { const d = dist(o.pos[0], o.pos[1]); MISSION.objText = o.title + ' — ' + nav(o.pos[0], o.pos[1], o.label); return d < o.r; }
    case 'patrol': { const d = dist(o.pos[0], o.pos[1]); if (d < o.r) o.acc += dt; MISSION.markers = (AMIS.groups.fleet || []).filter(s => s.alive).slice(0, 1).map(s => ({ pos: s.pos.clone().add(_amA.set(0, 60, 0)), label: 'Flotta' })); MISSION.objText = o.title + ` — ${Math.round(o.acc)}/${o.t} s` + (d < o.r ? '' : ' · ' + amisNav(o.pos[0], o.pos[1])); return o.acc >= o.t; }
    case 'identify': {
      const L = alive(G);
      if (!o.found) {
        MISSION.markers = [{ pos: new V3(o.area[0], Hf(o.area[0], o.area[1]) + 60, o.area[1]), label: o.label }];
        const near = me && L.some(u => u.pos.distanceTo(me.pos) < o.r && me.pos.y - Hf(me.pos.x, me.pos.z) < o.maxAlt);
        o.acc = near ? o.acc + dt : Math.max(0, o.acc - dt * .5);
        MISSION.objText = o.title + (near ? ` — identificazione ${Math.min(100, Math.round(o.acc / o.t * 100))}%` : ` — scendi sotto i ${o.maxAlt} m sull'area · ` + amisNav(o.area[0], o.area[1]));
        if (o.acc >= o.t) { o.found = true; AMIS.searching = null; amisRadio('found'); }
        return o.found;
      }
      return true;
    }
    case 'destroy': {
      const L = alive(G), k = G.length - L.length; MISSION.markers = L.slice(0, 3).map(u => ({ pos: (u.pos || new V3(u.x, Hf(u.x, u.z), u.z)).clone().add(_amA.set(0, 8, 0)), label: o.label || 'Bersaglio' }));
      MISSION.objText = `${o.title} — ${k}/${o.need}` + (L[0] ? ' · ' + amisNav(L[0].pos.x, L[0].pos.z) : ''); return k >= o.need;
    }
    case 'intercept': {
      // il gruppo è neutralizzato quando nessun aereo può più colpire: abbattuti, in fuga, o con le bombe già sganciate
      const L = G.filter(p => p.alive && !p.crash && !p.amOut);
      MISSION.markers = L.map(p => ({ pos: p.pos.clone(), label: p.amLabel }));
      MISSION.objText = `${o.title} — ${G.length - L.length}/${G.length}` + (L[0] ? ' · ' + amisNav(L[0].pos.x, L[0].pos.z) : '');
      return G.length && !L.length;
    }
  }
  return false;
}
// rotta e distanza dal punto voluto (gradi bussola: 0 = nord, cioè -z)
function amisNav(x, z) {
  const me = amisMe(); if (!me) return '';
  const dx = x - me.pos.x, dz = z - me.pos.z, d = Math.hypot(dx, dz), brg = (Math.atan2(dx, -dz) * 180 / PI + 360) % 360;
  return `rotta ${String(Math.round(brg)).padStart(3, '0')}° · ${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`;
}
function amisReveal(id) { const s = AMIS.sec.find(o => o.id === id); if (s && s.state === 'hidden') { s.state = 'active'; banner('NUOVO OBIETTIVO', s.title); } }
// ---------- ogni fotogramma: eventi, secondari, fallimento, statistiche ----------
function amisTick(dt) {
  const M = AMIS.M, st = AMIS.st; AMIS.t += dt;
  if (M.noRearm) PL.rearm = Math.max(PL.rearm, 5);   // niente riarmo in volo: le bombe sono quelle del decollo
  // aereo perduto
  if (PL.me && PL.me.crash && !PL.me.amLost) { PL.me.amLost = true; st.lost++; if (st.lost >= M.lives) { amisRadio('fail'); return amisEnd(false, 'Tutti gli aerei disponibili sono stati perduti.'); } }
  if (AMIS.t > M.timeLimit) return amisEnd(false, 'Tempo della missione scaduto: carburante insufficiente per proseguire.');
  for (const f of M.fail || []) if (f.check()) return amisEnd(false, f.why);
  for (const w of PL.wing || []) if (w.hp0 === undefined) w.hp0 = w.hp;
  // abbattimenti del giocatore fra caccia e incursori
  airCountKills();
  for (const k of ['raid1', 'raid2']) for (const p of AMIS.groups[k] || []) {
    if (p.crash && !p.amCounted) { p.amCounted = true; p.amOut = true; if (p.amByP) AMIS.raidKills = (AMIS.raidKills || 0) + 1; }
    p.amT0 = p.amT0 ?? AMIS.t;
    if (!p.crash && !p.amOut && ((p.pi >= p.path.length - 1 && p.amBombed) || AMIS.t - p.amT0 > 170)) { p.amOut = true; if (p.amBombed) AMIS.st.raidHits = (AMIS.st.raidHits || 0) + 1; }
  }
  st.kills = Math.max(st.kills, AIRM.kills + (AMIS.raidKills || 0));
  // contesto per gli eventi
  const me = amisMe(), ctx = { t: AMIS.t, done: id => !!st.objDone[id], flakNear: false, raidNear: false };
  if (me) { for (const a of WORLD.aaSites || []) if (!a.dead && Math.hypot(a.x - me.pos.x, a.z - me.pos.z) < 900 && me.pos.y < 900) { ctx.flakNear = true; break; } }
  for (const k of ['raid1', 'raid2']) for (const p of AMIS.groups[k] || []) if (p.alive && !p.crash && Math.hypot(p.pos.x, p.pos.z - 1100) < 2200) ctx.raidNear = true;
  for (const e of M.events) if (!AMIS.fired.has(e.id) && e.when(ctx)) { AMIS.fired.add(e.id); if (e.radio) amisRadio(e.radio); if (e.do) e.do(); }
  // secondari
  for (const o of AMIS.sec) {
    if (o.state !== 'active') continue;
    if (o.type === 'destroy') { const G = AMIS.groups[o.group] || [], k = G.filter(u => u.dead || u.alive === false).length; if (k >= o.need) { o.state = 'done'; banner('OBIETTIVO SECONDARIO', o.title); addScore(200, o.title, '#9fe08a'); } }
    if (o.type === 'bridge' && AIRM.bridge && AIRM.bridge.down) { o.state = 'done'; banner('OBIETTIVO SECONDARIO', o.title); addScore(300, o.title, '#9fe08a'); }
  }
  // meteo: la visibilità cambia gradualmente
  AMIS.fogK = lerp(AMIS.fogK, AMIS.fogT, Math.min(1, dt * .08));
  if (P.mode === 'plane') scene.fog.density = FOG_BASE * AIR_FOG * AMIS.fogK;
  // bersagli terrestri distrutti
  st.ground = (AMIS.groups.convoy || []).filter(u => !u.alive).length + (WORLD.aaSites || []).filter(a => a.dead).length + (AIRM.bridge && AIRM.bridge.down ? 1 : 0);
  // secondari mostrati sotto l'obiettivo
  const sec = AMIS.sec.filter(o => o.state !== 'hidden').map(o => (o.state === 'done' ? '✓ ' : o.state === 'failed' ? '✗ ' : '· ') + o.title).join('   ');
  if (sec) MISSION.objText += '<br><small style="opacity:.8">' + sec + '</small>';
}
// ---------- radio: frase della missione (una volta), file personale se presente ----------
function amisRadio(k, delay = 0) {
  if (AMIS.used.has(k)) return; AMIS.used.add(k);
  const txt = AMIS.M.radio[k]; if (!txt) return;
  const go = () => { say('Radio', txt); if (typeof caPlay === 'function') caPlay('radio.' + AMIS.M.id + '.' + k, null, { vol: 1 }); };
  delay ? after(delay, go) : go();
}
// ---------- fine missione: resoconto e valutazione ----------
function amisEnd(win, why) {
  if (AMIS.over) return; AMIS.over = true;
  const M = AMIS.M, st = AMIS.st, t = AMIS.t, prim = M.objectives, pd = prim.filter(o => st.objDone[o.id]).length;
  const secDone = AMIS.sec.filter(o => o.state === 'done' || (o.type === 'protect' && amisProtectOk(o)) || (o.type === 'flag' && o.ok())).length, secAll = AMIS.sec.filter(o => o.state !== 'hidden').length;
  const wing = (PL.wing || []), wingOk = wing.filter(w => w.alive && !w.crash).length, fleet = AMIS.groups.fleet || [], fleetOk = fleet.filter(s => s.alive).length;
  const acc = st.shots ? st.hits / st.shots : 0;
  // valutazione: obiettivi, sopravvivenza, protezione degli alleati, precisione, danni evitati — non solo abbattimenti
  const allies = fleet.length ? fleetOk / fleet.length : wing.length ? wingOk / Math.max(1, wing.length) : 1;
  const score = 45 * pd / prim.length + 10 * secDone / Math.max(1, secAll) + 15 * (1 - st.lost / M.lives) + 15 * allies + 8 * Math.min(1, acc * 5) + 7 * (1 - Math.min(1, st.dmg / 600));
  const grade = !win ? 'Missione fallita' : score >= 88 ? 'Eccellente' : score >= 72 ? 'Buona' : score >= 55 ? 'Sufficiente' : 'Scarsa';
  const S = amisLoad(); if (win) { const prev = S.done[M.id]; S.done[M.id] = { score: Math.max(prev ? prev.score : 0, Math.round(score)), grade: prev && prev.score > score ? prev.grade : grade, date: Date.now() }; } amisSave(S);
  const next = AIR_CAMPAIGN.find(m => m.n === M.n + 1);
  const row = (a, b) => `<tr><td style="text-align:left;padding:1px 14px 1px 0;opacity:.8">${a}</td><td style="text-align:right">${b}</td></tr>`;
  GAME.endTitle = win ? 'MISSIONE COMPIUTA' : 'MISSIONE FALLITA';
  GAME.endText = `<b>${M.title}</b> — ${M.date}<br>${why ? why + '<br>' : ''}<div style="margin-top:8px;font-size:13px;line-height:1.5">`
    + prim.map(o => (st.objDone[o.id] ? '✓ ' : '✗ ') + o.title).join('<br>') + '<br>' + AMIS.sec.filter(o => o.state !== 'hidden').map(o => (o.state === 'done' || (o.type === 'protect' && amisProtectOk(o)) || (o.type === 'flag' && o.ok()) ? '✓ ' : '✗ ') + '<i>' + o.title + '</i>').join('<br>')
    + `</div><table style="margin:10px auto;font-size:13px">` + row('Aerei nemici abbattuti', st.kills) + row('Bersagli terrestri distrutti', st.ground) + row('Navi nemiche colpite', st.naval)
    + row('Precisione', st.shots ? Math.round(acc * 100) + '% (' + st.hits + '/' + st.shots + ' raffiche)' : '—') + row('Bombe sganciate', st.bombs) + row('Danni subiti', Math.round(st.dmg))
    + row('Aerei perduti', st.lost + ' su ' + M.lives) + (fleet.length ? row('Navi alleate a galla', fleetOk + ' su ' + fleet.length) : row('Gregari rientrati', wingOk + ' su ' + wing.length))
    + row('Tempo di missione', Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')) + `</table><b>Valutazione: ${grade}</b> (${Math.round(score)}/100)` + (win && next ? `<br>Sbloccata: ${next.title}` : '');
  banner(GAME.endTitle, M.title); after(win ? 6 : 4, () => GAME.end(win));
}
// ---------- meteo e ora del giorno ----------
function amisWeather(W) {
  if (AIRM.clouds) { AIRM.clouds.position.y = W.cloudY || 0; AIRM.clouds.traverse(o => { if (o.isSprite) o.material.opacity = Math.min(1, .8 + (W.cover || 0)); }); }
  if (skyMat) { skyMat.uniforms.uCover.value = W.cover || 0; skyMat.uniforms.uGray.value = W.gray || 0; }
  if (W.dusk) {   // tramonto: sole basso a ovest, luce calda, ombre lunghe, foschia dorata
    SUN_DIR.set(-.93, .12, .34).normalize(); if (sun) { sun.color.copy(col(0xffa860)); sun.intensity = 1.35; }
    scene.traverse(o => { if (o.isHemisphereLight) { o.intensity = .55; o.color.copy(col(0xc8b8b0)); } });
    FOG_COL.copy(col(0xc0a890)); scene.fog.color.copy(FOG_COL);
  }
}
// ---------- gruppo navale alleato (modelli della modalità navale) ----------
class AmShip {
  constructor(cls, x, z, slot) {
    const C = NCLS[cls]; this.C = C; this.cls = cls; this.kind = cls === 'cargo' ? 'cargo' : cls === 'texas' ? 'bb' : 'dd';
    const m = buildShipModel2(C); this.g = m.g; scene.add(this.g); this.pos = this.g.position; this.pos.set(x, WATER_Y, z); this.yaw = -PI / 2; this.slot = slot;
    this.hp = this.hp0 = this.kind === 'bb' ? 4000 : this.kind === 'dd' ? 1300 : 1600; this.alive = true; this.sink = 0; this.v = 3; this.evade = 0; this.fireT = rnd(0, 1); this.gunT = rnd(15, 30); this.fx = [];
    this.box = { min: new V3(), max: new V3() }; this.friendly = true;
  }
  update(dt, lead) {
    if (!this.alive) { this.sink += dt; this.pos.y = WATER_Y - Math.min(14, this.sink * .25); this.g.rotation.z = Math.min(.35, this.sink * .01); return; }
    // rotta ad anello del gruppo con posizione in formazione; manovra evasiva durante un attacco
    const R2 = AMIS_ROUTE, tgt = R2[lead.wp % R2.length], ox = this.slot[0], oz = this.slot[1];
    const hd = Math.atan2(-(tgt[0] + ox - this.pos.x), -(tgt[1] + oz - this.pos.z)) + (this.evade > 0 ? Math.sin(GAME.time * .25 + this.slot[0]) * .5 : 0);
    if (this.evade > 0) this.evade -= dt;
    this.yaw = angLerpMax(this.yaw, hd, dt * (this.kind === 'dd' ? .06 : .03));
    const sp = this.v * (this.evade > 0 ? (this.kind === 'dd' ? 3 : 1.6) : 1);
    this.pos.x += -Math.sin(this.yaw) * sp * dt; this.pos.z += -Math.cos(this.yaw) * sp * dt; this.pos.y = WATER_Y + Math.sin(GAME.time * .6 + ox) * .2;
    this.g.rotation.set(Math.sin(GAME.time * .5 + oz) * .008, this.yaw, Math.sin(GAME.time * .4 + ox) * .012, 'YXZ');
    const L = this.C.L / 2, B = this.C.B / 2 + 2; this.box.min.set(this.pos.x - L, WATER_Y - 2, this.pos.z - L); this.box.max.set(this.pos.x + L, WATER_Y + 20, this.pos.z + L);
    // scia e onda di prua (solo vicino alla camera)
    if (dist2Cam(this.pos) < 2500 * 2500 && R() < dt * 8) { const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); PS_SMOKE.emit(this.pos.x - fx * L, WATER_Y + .3, this.pos.z - fz * L, -fx * 1.5 + rnd(-.6, .6), .1, -fz * 1.5 + rnd(-.6, .6), 6, 3, 9, .5, .95, .97, 1, .4, 0); PS_SMOKE.emit(this.pos.x + fx * L, WATER_Y + .3, this.pos.z + fz * L, rnd(-1, 1), .3, rnd(-1, 1), 2, 2, 5, .45, .95, .97, 1, .8, 0); }
    // contraerea contro i nemici; contro il giocatore solo se passa basso sulle navi
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = this.kind === 'bb' ? .25 : .4;
      let tgt2 = null, bd = 1600;
      for (const k of ['raid1', 'raid2']) for (const p of AMIS.groups[k] || []) if (p.alive && !p.crash) { const d = p.pos.distanceTo(this.pos); if (d < bd) { bd = d; tgt2 = p; } }
      for (const p of AIRM.hunters) if (p.alive && !p.crash) { const d = p.pos.distanceTo(this.pos); if (d < bd) { bd = d; tgt2 = p; } }
      const me = amisMe();
      if (!tgt2 && me && me.pos.distanceTo(this.pos) < 450 && me.pos.y < 300) { tgt2 = me; bd = me.pos.distanceTo(this.pos); }
      if (tgt2) {
        // puntamento progressivo: l'errore cala tenendo lo stesso bersaglio, mai a zero
        if (this.aimAt !== tgt2) { this.aimAt = tgt2; this.aimErr = 60; } this.aimErr = Math.max(14, this.aimErr * .9);
        const o = this.pos.clone().add(_amA.set(rnd(-L * .5, L * .5), 14, 0)), aim = tgt2.pos.clone().addScaledVector(tgt2.vel || _amA.set(0, 0, 0), bd / 800).add(new V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.aimErr));
        fxTracer(o, aim, 1.3); if (dist2Cam(o) < 1500 * 1500 && R() < .4) sfxShot('flak', o);
        if (R() < .5 && dist2Cam(aim) < 3000 * 3000) PS_SMOKE.emit(aim.x, aim.y, aim.z, 0, 0, 0, 2.5, 3, 6, .7, .12, .12, .12, 1, 0);   // scoppi della contraerea
        const pHit = (this.kind === 'bb' ? .05 : .03) * Math.pow(Math.max(0, 1 - bd / 1600), 1.5) * (30 / this.aimErr);
        if (R() < pHit) { if (tgt2 === me) { AMIS.st.friendlyHit = true; me.damage(rnd(10, 22), false); } else tgt2.damage(rnd(20, 45), false); }
      }
    }
    // la corazzata spara sull'entroterra (fuoco di sostegno)
    if (this.kind === 'bb' && AMIS.t > 25 && (this.gunT -= dt) <= 0) {
      this.gunT = rnd(20, 32); const o = this.pos.clone().add(_amA.set(0, 12, 0)), tp = new V3(rnd(-900, 600), 0, rnd(-900, -300)); tp.y = Hf(tp.x, tp.z);
      PS_FIRE.emit(o.x, o.y, o.z, 0, 4, -10, .25, 8, 14, 1, 4, 2.5, 1.2); for (let i = 0; i < 10; i++) PS_SMOKE.emit(o.x + rnd(-6, 6), o.y, o.z + rnd(-6, 6), rnd(-3, 3), rnd(1, 3), rnd(-8, -2), 5, 6, 16, .6, .55, .53, .5, .6, -.03);
      sfxBoom(o, 3); flashLight(o, 0xffb060, 60, .15); after(tp.distanceTo(o) / 700, () => { fxExplosion(tp, 4, false); if (dist2Cam(tp) < 1500 * 1500) sfxBoom(tp, 2.5); });
    }
  }
  hitBy(dmg) {
    if (!this.alive) return; this.hp -= dmg; const p = this.pos.clone().add(_amA.set(rnd(-this.C.L * .3, this.C.L * .3), 8, 0));
    fxExplosion(p, 3, true); sfxBoom(p, 2.5, true); const e = addEmitter(p, 'fire', 1.3); e.life = 200; this.fx.push(e); this.damaged = true;
    if (this.hp <= 0) { this.alive = false; addEmitter(this.pos.clone().add(_amA.set(0, 10, 0)), 'smoke', 2.4).life = 400; feed(this.C.name + ' affondata'); }
  }
}
const AMIS_ROUTE = [[-700, 1050], [700, 1050], [700, 1350], [-700, 1350]];
function amisFleet() {
  const L = [], lead = { wp: 1 }; AMIS.lead = lead;
  const S = [['texas', 0, 0], ['fletcher', 0, -260], ['fletcher', 0, 300], ['cargo', -220, -130], ['cargo', -220, 140], ['cargo', 220, -130], ['cargo', 220, 140]];
  for (const [c, ox, oz] of S) { const s = new AmShip(c, -500 + ox, 1050 + oz, [ox, oz]); L.push(s); }
  return L;
}
function amisFleetTick(dt) {
  const F = AMIS.groups.fleet; if (!F) return;
  const lead = AMIS.lead, w = AMIS_ROUTE[lead.wp % AMIS_ROUTE.length], c = F[0];
  if (Math.hypot(c.pos.x - w[0], c.pos.z - w[1]) < 120) lead.wp++;
  for (const s of F) s.update(dt, lead);
}
const amisFleetLost = kinds => (AMIS.groups.fleet || []).filter(s => !s.alive && kinds.includes(s.kind)).length;
const amisFleetDamaged = () => (AMIS.groups.fleet || []).some(s => s.damaged && s.kind === 'cargo');
function amisProtectOk(o) { return amisFleetLost(o.kinds) <= o.lose; }
// bombe nemiche sulle navi: danno se cadono vicino allo scafo
function amisBombShips(p, q) {
  if (!AMIS.on || !AMIS.groups.fleet || !q || q.team !== 'E') return;
  for (const s of AMIS.groups.fleet) if (s.alive) { const dx = p.x - s.pos.x, dz = p.z - s.pos.z, ca = Math.cos(s.yaw), sa = Math.sin(s.yaw), lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; if (Math.abs(lx) < s.C.B / 2 + 6 && Math.abs(lz) < s.C.L / 2 + 6) s.hitBy(rnd(500, 900)); }
}
// ---------- incursioni nemiche ----------
const amisSpawn = {
  raid1() {   // quattro Fw 190 cacciabombardieri, bassi da sud-est verso i trasporti
    const F = (AMIS.groups.fleet || []).filter(s => s.alive && s.kind === 'cargo'), L = [];
    for (let i = 0; i < 4; i++) {
      const t = F[i % Math.max(1, F.length)] || { pos: new V3(0, 0, 1100) }, x0 = 1400 + i * 40, z0 = -900 - i * 30;
      const path = [{ p: new V3(t.pos.x + 400, 160, t.pos.z - 600), v: 150 }, { p: new V3(t.pos.x, 120, t.pos.z), v: 150, bomb: t.pos, r: 80 }, { p: new V3(t.pos.x - 1500, 300, t.pos.z + 1500), v: 160 }];
      const p = new Plane('fw190', 'E', new V3(x0, 180, z0), new V3(-60, 0, 120), path); p.amLabel = 'Fw 190 con bombe'; p.bombs = 1; L.push(p);
    }
    amisRadio('raid1'); return L;
  },
  raid2() {   // tre Ju 88 a quota media con due Bf 109 di scorta
    const F = (AMIS.groups.fleet || []).filter(s => s.alive), L = [];
    for (let i = 0; i < 3; i++) {
      const t = F[(i + 1) % Math.max(1, F.length)] || { pos: new V3(0, 0, 1100) }, x0 = -200 + i * 70;
      const path = [{ p: new V3(t.pos.x, 700, t.pos.z - 1200), v: 120 }, { p: new V3(t.pos.x, 650, t.pos.z), v: 125, bomb: t.pos, r: 100 }, { p: new V3(t.pos.x + 800, 800, t.pos.z + 2500), v: 130 }];
      const p = new Plane('ju88', 'E', new V3(x0, 750, -1800 - i * 60), new V3(0, 0, 120), path); p.hp = 700; p.amLabel = 'Ju 88'; p.bombs = 4; L.push(p);
    }
    for (let i = 0; i < 2; i++) { const h = spawnHunter('bf109'); h.pos.set(-150 + i * 120, 850, -1700); }
    amisRadio('raid2'); return L;
  },
};
// ---------- statistiche dal combattimento esistente ----------
(function amisHooks() {
  const g0 = window.playerPlaneGuns; window.playerPlaneGuns = function (me, G) { if (AMIS.on && AMIS.st) AMIS.st.shots++; return g0.apply(this, arguments); };
  const i0 = window.airBulletImpact; window.airBulletImpact = function (o, d, t, hp, hv) { if (AMIS.on && AMIS.st && (hp || hv) && !(hv && hv.friendly)) AMIS.st.hits++; return i0.apply(this, arguments); };
  const b0 = window.bombImpact; window.bombImpact = function (p, q) { amisBombShips(p, q); return b0.apply(this, arguments); };
  const d0 = window.planeDropBomb; window.planeDropBomb = function () { const n = PL.bombs; const r = d0.apply(this, arguments); if (AMIS.on && AMIS.st && PL.bombs < n) AMIS.st.bombs++; return r; };
  const pd = Plane.prototype.damage; Plane.prototype.damage = function (a, byPlayer) { if (byPlayer) this.amByP = true; if (AMIS.on && AMIS.st && this === PL.me) AMIS.st.dmg += a; return pd.apply(this, arguments); };
  const db = Plane.prototype.dropBomb; if (db) Plane.prototype.dropBomb = function () { this.amBombed = true; return db.apply(this, arguments); };
})();
// rientro in volo durante la campagna: vicino all'obiettivo attuale, mai in mezzo ai nemici
function amisSpawnPoint() {
  const M = AMIS.M, o = M.objectives[MISSION.stage] || M.objectives[0], s = M.start;
  if (MISSION.stage === 0 || !o) { const pos = new V3(s.x, s.alt, s.z), vel = new V3(-Math.sin(s.hdg), 0, -Math.cos(s.hdg)).multiplyScalar(130); return { pos, vel }; }
  const t = o.pos ? new V3(o.pos[0], 0, o.pos[1]) : o.area ? new V3(o.area[0], 0, o.area[1]) : new V3(0, 0, 1100);
  const a = Math.atan2(t.x - s.x, t.z - s.z), pos = new V3(t.x - Math.sin(a) * 1600, 0, t.z - Math.cos(a) * 1600); pos.x = clamp(pos.x, -1400, 1400); pos.z = clamp(pos.z, -1400, 2200); pos.y = Math.max(Hf(pos.x, pos.z), 0) + 500;
  return { pos, vel: new V3(t.x - pos.x, 0, t.z - pos.z).normalize().multiplyScalar(130) };
}
// ---------- briefing nel menù ----------
function amisBriefHTML(id) {
  const M = AIR_CAMPAIGN.find(m => m.id === id); if (!M) return '';
  const S = amisLoad(), d = S.done[M.id], lock = !amisUnlocked(M), sp = PLANE_SPECS[M.aircraft] || {}, li = a => a.map(x => `<li>${x}</li>`).join('');
  return `<div class="abHead"><span class="abN">MISSIONE ${M.n}</span><b>${M.title}</b><span>${M.sub}</span></div>
  <div class="abGrid"><canvas id="abMap" width="220" height="220"></canvas><div>
  <div class="abRow"><i>Data</i>${M.date}, ${M.time}</div><div class="abRow"><i>Luogo</i>${M.place}</div><div class="abRow"><i>Velivolo</i>${sp.name || M.aircraft}</div><div class="abRow"><i>Armamento</i>${M.arm}</div><div class="abRow"><i>Meteo</i>${M.weather.label}</div>
  ${d ? `<div class="abRow"><i>Migliore</i>${d.grade} · ${d.score}/100</div>` : ''}${lock ? '<div class="abLock">Bloccata: completa prima la missione precedente</div>' : ''}</div></div>
  <p class="abCtx">${M.context}</p>
  <div class="abObj"><b>Obiettivi</b><ol>${li(M.objectives.map(o => o.title))}</ol>${M.secondary.filter(o => !o.hidden).length ? '<b>Secondari</b><ul>' + li(M.secondary.filter(o => !o.hidden).map(o => o.title)) + '</ul>' : ''}</div>
  <details class="abHist"><summary>Nota storica</summary><b>Documentato</b><ul>${li(M.history.doc)}</ul><b>Ricostruzione plausibile</b><ul>${li(M.history.plaus)}</ul><b>Modificato per il gioco</b><ul>${li(M.history.game)}</ul></details>`;
}
// mappa operativa: terra e mare campionati dalla funzione del terreno, partenza, rotta e obiettivi
function amisBriefMap(id) {
  const M = AIR_CAMPAIGN.find(m => m.id === id), cv = $('abMap'); if (!M || !cv) return;
  const g = cv.getContext('2d'), W = cv.width, ext = 3400, cx = 0, cz = 450, S = W / ext, to = (x, z) => [(x - cx) * S + W / 2, (z - cz) * S + W / 2];
  const keep = AIRMAP; AIRMAP = M.map;
  for (let i = 0; i < 44; i++) for (let j = 0; j < 44; j++) { const x = cx - ext / 2 + (i + .5) * ext / 44, z = cz - ext / 2 + (j + .5) * ext / 44, h = airBase(x, z); g.fillStyle = h < -1 ? '#3b4f5a' : h < 6 ? '#b8ad8a' : '#6f7a52'; g.fillRect(i * W / 44, j * W / 44, W / 44 + 1, W / 44 + 1); }
  AIRMAP = keep;
  g.strokeStyle = 'rgba(30,40,60,.7)'; g.lineWidth = 2; g.beginPath(); for (let z = -1300; z < 120; z += 40) { const [a, b] = to(airRiverX(z), z); z === -1300 ? g.moveTo(a, b) : g.lineTo(a, b); } g.stroke();
  g.strokeStyle = 'rgba(90,70,40,.9)'; g.lineWidth = 1.5; g.beginPath(); for (let z = -1300; z < 120; z += 40) { const [a, b] = to(airRoadX(z), z); z === -1300 ? g.moveTo(a, b) : g.lineTo(a, b); } g.stroke();
  const pts = [[M.start.x, M.start.z]].concat(M.objectives.filter(o => o.pos || o.area).map(o => o.pos || o.area));
  g.strokeStyle = '#e8c46a'; g.setLineDash([5, 4]); g.lineWidth = 1.6; g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = to(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); g.setLineDash([]);
  g.font = '600 10px Oswald, sans-serif'; g.fillStyle = '#1b1b14';
  pts.forEach(([x, z], i) => { const [a, b] = to(x, z); g.beginPath(); g.arc(a, b, 5, 0, TAU); g.fillStyle = i ? '#c8432f' : '#2f6fc8'; g.fill(); g.fillStyle = '#111'; g.fillText(i ? String(i) : 'P', a + 7, b + 4); });
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText('N ↑  ·  3,4 km', 6, 12);
}
function amisMenu() {
  const sel = $('optAirMap'); if (!sel || sel.amis) return; sel.amis = true;
  const og = document.createElement('optgroup'); og.label = 'Campagna aerea 1944';
  for (const M of AIR_CAMPAIGN) { const o = document.createElement('option'); o.value = M.id; o.textContent = `${M.n}. ${M.title} — ${M.date}` + (amisUnlocked(M) ? '' : ' (bloccata)'); o.disabled = !amisUnlocked(M); og.appendChild(o); }
  for (const [t, s] of AIR_CAMPAIGN_PLANNED) { const o = document.createElement('option'); o.disabled = true; o.textContent = `· ${t} — ${s} (in preparazione)`; og.appendChild(o); }
  sel.appendChild(og);
  let box = $('airBrief'); if (!box) { box = document.createElement('div'); box.id = 'airBrief'; const lab = $('airMapL'); lab.parentNode.insertBefore(box, lab.nextSibling); }
  const upd = () => { const on = sel.value.startsWith('c_') && $('airMapL').style.display !== 'none'; box.style.display = on ? 'block' : 'none'; if (on) { box.innerHTML = amisBriefHTML(sel.value); amisBriefMap(sel.value); } if ($('planeL')) $('planeL').style.opacity = on ? .35 : 1; };
  sel.addEventListener('change', upd); AMIS.menuUpd = upd; setInterval(() => { const vis = $('airMapL') && $('airMapL').style.display !== 'none'; if (!vis && box.style.display !== 'none') box.style.display = 'none'; else if (vis && sel.value.startsWith('c_') && box.style.display === 'none') upd(); }, 500);
}
addEventListener('load', () => { try { amisMenu(); } catch (e) { console.warn('campagna aerea', e); } });
