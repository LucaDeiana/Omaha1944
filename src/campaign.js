"use strict";
// ============================================================
//  CAMPAIGN MODE 2.0 — «Theatres of War».
//  Registro dei personaggi, capitoli e missioni a dati (validati all'avvio), salvataggio versionato, menù con briefing,
//  regia della missione sopra le modalità già esistenti (nessun secondo sistema di combattimento): la campagna
//  sceglie mappa, fazione e difficoltà, mette i personaggi nella squadra, aggiunge dialoghi agli eventi reali,
//  salva i punti di ripresa e riconosce la fine della missione. Le modalità libere e il multigiocatore non cambiano.
//  I sette protagonisti sono personaggi di fantasia (ispirati ad amici dell'autore), non militari realmente esistiti.
// ============================================================
const CHARACTERS = [
  { id: 'edoardo_stara', firstName: 'Edoardo', lastName: 'Stara', rank: 'Captain', rankShort: 'Capt.', rankIt: 'Capitano', faction: 'US', branch: 'US_ARMY', role: 'company_commander', roleIt: 'comandante di compagnia di fanteria',
    persistent: true, fictional: true, voiceProfile: 'us_officer', aiProfile: 'commanding_officer', model: 'us_officer', gear: 'carabina M1, binocolo, radio SCR-536 (radiofonista al seguito)',
    personality: 'Autorevole, pianifica con cura, risponde della vita dei suoi uomini.', missions: ['overlord_01'], presence: { overlord_01: 'radio' }, relations: { alessio_medda: 'superiore diretto' } },
  { id: 'alessio_medda', firstName: 'Alessio', lastName: 'Medda', rank: 'First Lieutenant', rankShort: '1st Lt.', rankIt: 'Tenente', faction: 'US', branch: 'US_ARMY', role: 'platoon_leader', roleIt: 'comandante di plotone',
    persistent: true, fictional: true, voiceProfile: 'us_officer', aiProfile: 'squad_leader', model: 'us_officer', gear: 'mitra Thompson, binocolo', squadKind: 'smg',
    personality: 'Coraggioso e determinato, sempre in prima linea accanto ai suoi uomini.', missions: ['overlord_01'], presence: { overlord_01: 'campo' }, relations: { edoardo_stara: 'comandante', dominick_ucchesu: 'sottufficiale di fiducia' } },
  { id: 'dominick_ucchesu', firstName: 'Dominick', lastName: 'Ucchesu', rank: 'Staff Sergeant', rankShort: 'S.Sgt.', rankIt: 'Sergente maggiore', faction: 'US', branch: 'US_ARMY', role: 'squad_leader', roleIt: 'caposquadra, sottufficiale veterano',
    persistent: true, fictional: true, voiceProfile: 'us_nco', aiProfile: 'squad_leader', model: 'us_nco', gear: 'mitra Thompson, granate', squadKind: 'smg',
    personality: 'Esperto e pragmatico, protettivo con i suoi, lucido nei momenti critici.', missions: ['overlord_01'], presence: { overlord_01: 'campo' }, relations: { alessio_medda: 'comandante di plotone', matteo_murtas: 'squadra' } },
  { id: 'nino_baker', firstName: 'Nino', lastName: 'Baker', rank: 'Technical Sergeant', rankShort: 'T/Sgt.', rankIt: 'Sergente tecnico', faction: 'US', branch: 'US_ARMY', role: 'tank_commander', roleIt: 'capocarro di uno Sherman',
    persistent: true, fictional: true, voiceProfile: 'us_nco', aiProfile: 'tank_commander', model: 'us_tanker', gear: 'pistola M1911, cuffie da carrista',
    personality: 'Conosce i corazzati come le sue tasche, deciso, coordina bene con la fanteria.', missions: ['desert_03'], presence: { desert_03: 'campo' }, relations: {},
    note: 'Nel 1943-44 i capocarro delle divisioni corazzate erano di solito sergenti o sergenti maggiori; il grado di Technical Sergeant è plausibile per un capocarro di plotone.' },
  { id: 'richard_lecca', firstName: 'Richard', lastName: 'Lecca', rank: 'First Lieutenant', rankShort: '1st Lt.', rankIt: 'Tenente', faction: 'US', branch: 'USAAF', role: 'fighter_pilot', roleIt: 'pilota di P-47 Thunderbolt',
    persistent: true, fictional: true, voiceProfile: 'us_pilot', aiProfile: 'pilot', model: 'us_pilot', gear: 'P-47D Thunderbolt', callsign: 'Thunderbolt One',
    personality: 'Pilota esperto, freddo nel pericolo.', missions: ['overlord_06'], presence: { overlord_06: 'giocatore' }, relations: {} },
  { id: 'manuel_meloni', firstName: 'Manuel', lastName: 'Meloni', rank: 'Petty Officer First Class', rankShort: 'PO1c', rankIt: 'Sottufficiale di 1ª classe', faction: 'US', branch: 'US_NAVY', role: 'naval_gunner', roleIt: 'gunner\'s mate, artiglieria della USS Texas',
    persistent: true, fictional: true, voiceProfile: 'us_navy', aiProfile: 'naval_crew', model: 'us_sailor', gear: 'elmetto Mk 2, cuffie del telefono di bordo', ship: 'USS Texas (BB-35)',
    personality: 'Disciplinato, conosce le armi di bordo, sicuro sotto il fuoco.', missions: ['sea_05'], presence: { sea_05: 'radio' }, relations: {},
    note: 'Il grado Petty Officer First Class (Gunner\'s Mate) corrisponde a un capopezzo o capo di un complesso antiaereo, coerente con l\'incarico.' },
  { id: 'matteo_murtas', firstName: 'Matteo', lastName: 'Murtas', rank: 'Corporal', rankShort: 'Cpl.', rankIt: 'Caporale', faction: 'US', branch: 'US_ARMY', role: 'scout_sniper', roleIt: 'esploratore e tiratore scelto',
    persistent: true, fictional: true, voiceProfile: 'us_soldier', aiProfile: 'marksman', model: 'us_rifleman', gear: 'fucile Springfield M1903A4 con ottica', squadKind: 'sniper',
    personality: 'Paziente, preciso, attento a ogni dettaglio del terreno.', missions: ['overlord_01'], presence: { overlord_01: 'campo' }, relations: { dominick_ucchesu: 'caposquadra' } },
];
const CHAR = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
const cname = id => { const c = CHAR[id]; return c ? `${c.rankShort} ${c.lastName}` : id; };
const cfull = id => { const c = CHAR[id]; return c ? `${c.rank} ${c.firstName} ${c.lastName}` : id; };

// ---------- capitoli e missioni ----------
// status: 'playable' giocabile; 'adapted' giocabile usando una modalità esistente (indicato nel briefing); 'planned' in preparazione
const CAMPAIGN = {
  chapters: [
    { id: 'overlord', title: 'Operation Overlord', sub: 'Normandia, giugno–agosto 1944', missions: [
      { id: 'overlord_01', n: 1, title: 'The Longest Day', date: '6 giugno 1944', loc: 'Omaha Beach, settore Dog Green', status: 'playable', mode: { map: 'omaha', side: 'A' }, endStage: 5, next: 'overlord_02',
        characters: ['edoardo_stara', 'alessio_medda', 'dominick_ucchesu', 'matteo_murtas'], player: 'Fuciliere della squadra di Ucchesu (personaggio senza nome)',
        context: 'All\'alba del 6 giugno 1944 la 1ª e la 29ª Divisione di fanteria americane sbarcano a Omaha Beach sotto il fuoco dei capisaldi tedeschi sulla scogliera. Le prime ondate subiscono perdite gravissime; nella mattinata piccoli gruppi aprono varchi nel filo e salgono sulla scogliera, prendendo i capisaldi alle spalle.',
        doc: ['Lo sbarco a Omaha Beach e le gravi perdite delle prime ondate (1ª e 29ª Divisione di fanteria).', 'L\'uso dei tubi Bangalore per aprire il filo spinato e la salita per i canaloni della scogliera.', 'Il fuoco della corazzata USS Texas sulla zona di Omaha.'],
        story: ['Il capitano Stara, il tenente Medda, il sergente Ucchesu e il caporale Murtas sono personaggi di fantasia: non appartengono a un reparto reale e le loro azioni non sono attribuite a nessuna unità storica.', 'Mappa, capisaldi e ordini sono una ricostruzione del gioco.'],
        objectives: [['approach', 'Avvicinati alla costa sul mezzo da sbarco', 0], ['beach', 'Attraversa la spiaggia fino al terrapieno', 1], ['wire', 'Apri un varco nel filo spinato', 2], ['bluff', 'Sali sulla scogliera e prendi la trincea', 3], ['bunkers', 'Neutralizza i bunker MG42', 4]],
        events: {
          0: [[2, 'edoardo_stara', 'radio', 'Easy Company, qui Stara. Il vostro tratto è Dog Green. Dritti al terrapieno, poi il varco. Niente eroi sulla sabbia.', 'Easy Company, this is Stara. Your sector is Dog Green. Get to the shingle, then the gap. No heroes on that sand.'],
            [14, 'alessio_medda', 'campo', 'Secondo plotone, quando si apre la rampa uscite di lato e cercate gli ostacoli. Ucchesu, la tua squadra è con me.', 'Second platoon, when that ramp drops you go over the side and find cover. Ucchesu, your squad is with me.']],
          1: [[3, 'alessio_medda', 'campo', 'Restate bassi! Da un ostacolo all\'altro, non fermatevi in acqua!', 'Stay low! Move to the next cover!'],
            [12, 'matteo_murtas', 'campo', 'Mitragliatrice sulla scogliera, a ore undici. Non mettete la testa fuori dagli ostacoli.', 'MG up on the bluff, eleven o\'clock. Keep your heads behind the obstacles.']],
          2: [[2, 'dominick_ucchesu', 'campo', 'Siamo al terrapieno! Contate gli uomini, poi qualcuno mi porti quel Bangalore!', 'We made the shingle! Count heads, then somebody get me that Bangalore!'],
            [9, 'edoardo_stara', 'radio', 'Medda, qui Stara. Le altre squadre sono inchiodate a est. Se aprite il filo, tutta la compagnia passa da voi.', 'Medda, Stara. The other squads are pinned to the east. You open that wire, the whole company goes through you.']],
          3: [[2, 'alessio_medda', 'campo', 'Il varco è aperto! Seguitemi su per il canalone, restate sul sentiero!', 'The gap is open! Follow me up the draw, stay on the path!'],
            [8, 'matteo_murtas', 'campo', 'Vi copro io dalla curva. Due tedeschi nella trincea, a destra.', 'I\'ve got you covered from the bend. Two Krauts in the trench, right side.']],
          4: [[2, 'dominick_ucchesu', 'campo', 'Sopprimete quella postazione! Chi ha una carica la porti alla porta posteriore!', 'Suppress that position! Whoever has a charge, get it to the back door!'],
            [14, 'edoardo_stara', 'radio', 'Qui Stara: bravi, ragazzi. Togliete di mezzo quei bunker e la spiaggia respira.', 'Stara here: good work. Take out those bunkers and the beach can breathe.']],
          5: [[0, 'edoardo_stara', 'radio', 'Tutte le unità, qui Stara: la scogliera è nostra. Consolidate sul ciglio, riorganizzatevi e contate le munizioni.', 'All units, Stara: the bluff is ours. Consolidate on the crest, reorganize and count your ammo.']],
        } },
      { id: 'overlord_02', n: 2, title: 'Break the Atlantic Wall', date: '6 giugno 1944', loc: 'Capisaldi della scogliera', status: 'planned', characters: ['alessio_medda', 'dominick_ucchesu', 'matteo_murtas'] },
      { id: 'overlord_03', n: 3, title: 'Beyond the Beach', date: '7 giugno 1944', loc: 'Entroterra di Omaha', status: 'planned', characters: ['alessio_medda', 'dominick_ucchesu'] },
      { id: 'overlord_04', n: 4, title: 'The Hedgerows', date: 'giugno 1944', loc: 'Bocage normanno', status: 'planned', characters: ['dominick_ucchesu', 'matteo_murtas'] },
      { id: 'overlord_05', n: 5, title: 'Steel Support', date: 'luglio 1944', loc: 'Normandia', status: 'planned', characters: ['nino_baker', 'alessio_medda'], needs: 'Sherman pilotabile con la fanteria nella stessa mappa' },
      { id: 'overlord_06', n: 6, title: 'Thunder Over Normandy', date: '7 giugno 1944', loc: 'Entroterra di Omaha (dall\'aria)', status: 'adapted', mode: { airMis: 'c_norm_cas' }, characters: ['richard_lecca'], player: 'richard_lecca', after: 'overlord_01',
        context: 'Il giorno dopo lo sbarco i P-47 della 9ª Air Force battono le strade dietro le spiagge per fermare i rinforzi tedeschi.', adaptedFrom: 'missione «Strade di Normandia» della campagna aerea',
        doc: ['I P-47 della Ninth Air Force attaccarono strade, ponti e ferrovie dietro le spiagge nei giorni dello sbarco.'], story: ['Il tenente Lecca è un personaggio di fantasia; il nominativo «Thunderbolt One» è inventato.'],
        events: { 0: [[4, 'richard_lecca', 'radio', 'Thunderbolt One, in salita dalla Manica. Costa in vista.', 'Thunderbolt One, climbing out over the Channel. Coast in sight.']], 2: [[1, 'richard_lecca', 'radio', 'Thunderbolt One, inizio la passata d\'attacco.', 'Thunderbolt One, beginning attack run!']] } },
      { id: 'overlord_07', n: 7, title: 'The Breakthrough', date: 'luglio 1944', loc: 'Normandia', status: 'planned', characters: ['edoardo_stara', 'alessio_medda', 'nino_baker', 'richard_lecca'] },
    ] },
    { id: 'bulge', title: 'Battle of the Bulge', sub: 'Ardenne, dicembre 1944–gennaio 1945', missions: [
      { id: 'bulge_01', n: 1, title: 'Frozen Front', date: 'dicembre 1944', loc: 'Ardenne', status: 'planned', characters: ['dominick_ucchesu', 'matteo_murtas'] },
      { id: 'bulge_02', n: 2, title: 'The Ambush', date: 'dicembre 1944', loc: 'Ardenne', status: 'planned', characters: ['matteo_murtas'] },
      { id: 'bulge_03', n: 3, title: 'Hold the Line', date: 'dicembre 1944', loc: 'Ardenne', status: 'planned', characters: ['alessio_medda', 'dominick_ucchesu'] },
      { id: 'bulge_04', n: 4, title: 'Bastogne', date: 'dicembre 1944', loc: 'dintorni di Bastogne', status: 'planned', characters: ['edoardo_stara', 'alessio_medda'] },
      { id: 'bulge_05', n: 5, title: 'Breaking the Siege', date: 'dicembre 1944', loc: 'Ardenne', status: 'planned', characters: ['nino_baker'] },
      { id: 'bulge_06', n: 6, title: 'Winter Victory', date: 'gennaio 1945', loc: 'Ardenne', status: 'planned', characters: ['edoardo_stara', 'alessio_medda', 'dominick_ucchesu', 'matteo_murtas'] },
    ] },
    { id: 'desert', title: 'Desert War', sub: 'Nord Africa, 1942–1943 (capitolo retrospettivo)', missions: [
      { id: 'desert_01', n: 1, title: 'Desert Arrival', date: 'novembre 1942', loc: 'Africa settentrionale francese', status: 'planned', characters: ['nino_baker'] },
      { id: 'desert_02', n: 2, title: 'Sandstorm Patrol', date: '1943', loc: 'Tunisia', status: 'planned', characters: ['nino_baker'] },
      { id: 'desert_03', n: 3, title: 'Armored Clash', date: 'febbraio 1943', loc: 'Passo di Kasserine', status: 'adapted', mode: { map: 'kas', kasSide: 'A' }, characters: ['nino_baker'], player: 'nino_baker', after: 'overlord_01',
        context: 'Nel febbraio 1943 i corazzati tedeschi attaccano gli Americani in Tunisia, a Sidi Bou Zid e al passo di Kasserine. Storicamente gli Americani subirono una dura sconfitta prima di ristabilire il fronte.', adaptedFrom: 'modalità «Guerra corazzata», attacco al passo',
        doc: ['La battaglia del passo di Kasserine (febbraio 1943) e i combattimenti di Sidi Bou Zid.', 'Gli M4A1 Sherman della 1ª Divisione corazzata americana.'], story: ['La missione segue l\'attacco della modalità esistente: è un\'avanzata alternativa, non la sconfitta storica.', 'Il sergente Baker è un personaggio di fantasia.'],
        events: { 0: [[3, 'nino_baker', 'radio', 'Qui Baker. Carri in linea, fanteria dietro. Occhi aperti sui pezzi anticarro nella macchia.', 'Baker here. Tanks on line, infantry behind. Watch for anti-tank guns in the scrub.']], 1: [[2, 'nino_baker', 'radio', 'Cresta presa. Avanti verso il villaggio, piano.', 'Ridge is ours. Move on the village, easy now.']] } },
      { id: 'desert_04', n: 4, title: 'Behind Enemy Lines', date: '1943', loc: 'Tunisia', status: 'planned', characters: ['matteo_murtas'] },
      { id: 'desert_05', n: 5, title: 'The Defensive Line', date: '1943', loc: 'Tunisia', status: 'planned', characters: ['nino_baker'] },
      { id: 'desert_06', n: 6, title: 'Tunisia Offensive', date: 'maggio 1943', loc: 'Tunisia', status: 'planned', characters: ['nino_baker'] },
    ] },
    { id: 'sea', title: 'War at Sea', sub: 'Atlantico, Manica e coste francesi, 1944', missions: [
      { id: 'sea_01', n: 1, title: 'Atlantic Convoy', date: '1944', loc: 'Atlantico', status: 'planned', characters: [] },
      { id: 'sea_02', n: 2, title: 'Enemy Aircraft', date: '1944', loc: 'Manica', status: 'planned', characters: ['manuel_meloni'] },
      { id: 'sea_03', n: 3, title: 'Naval Engagement', date: '1944', loc: 'Manica', status: 'planned', characters: [] },
      { id: 'sea_04', n: 4, title: 'Fire Support', date: '6 giugno 1944', loc: 'davanti a Omaha Beach', status: 'planned', characters: ['manuel_meloni'], needs: 'tiro navale della USS Texas sulla costa (oggi la modalità navale ha solo scontri tra navi)' },
      { id: 'sea_05', n: 5, title: 'Guns of Normandy', date: '6 giugno 1944', loc: 'USS Texas, Omaha Beach', status: 'planned', characters: ['manuel_meloni'] },
    ] },
  ],
};
const CMISSIONS = CAMPAIGN.chapters.flatMap(c => c.missions.map(m => Object.assign(m, { chapter: c.id })));

// ---------- validazione all'avvio ----------
function campValidate() {
  const err = [], ids = new Set();
  for (const c of CHARACTERS) { if (ids.has(c.id)) err.push('personaggio duplicato ' + c.id); ids.add(c.id); for (const k of ['firstName', 'lastName', 'rank', 'branch', 'role']) if (!c[k]) err.push(c.id + ': manca ' + k); }
  const mids = new Set();
  for (const m of CMISSIONS) {
    if (mids.has(m.id)) err.push('missione duplicata ' + m.id); mids.add(m.id);
    for (const ch of m.characters || []) if (!CHAR[ch]) err.push(m.id + ': personaggio sconosciuto ' + ch);
    if (m.status !== 'planned' && !m.mode) err.push(m.id + ': giocabile senza modalità');
    if (m.events) for (const st in m.events) for (const e of m.events[st]) if (!CHAR[e[1]]) err.push(m.id + ': dialogo di un personaggio sconosciuto ' + e[1]);
  }
  for (const m of CMISSIONS) { if (m.next && !mids.has(m.next)) err.push(m.id + ': missione successiva inesistente ' + m.next); if (m.after && !mids.has(m.after)) err.push(m.id + ': requisito inesistente ' + m.after); }
  // un personaggio compare solo nelle missioni del suo elenco (continuità: Meloni non nelle Ardenne, Lecca non come fante)
  for (const m of CMISSIONS) for (const ch of m.characters || []) if (m.status !== 'planned' && !CHAR[ch].missions.includes(m.id)) err.push(m.id + ': ' + ch + ' non previsto in questa missione');
  if (err.length) console.warn('Campagna: configurazione non valida\n' + err.join('\n'));
  return err;
}

// ---------- salvataggio ----------
const CAMP_KEY = 'fo44_campaign', CAMP_VER = 1;
function campLoad() {
  let s = null; try { s = JSON.parse(localStorage.getItem(CAMP_KEY) || 'null'); } catch (e) { s = null; }
  if (!s || s.v !== CAMP_VER || typeof s.done !== 'object') {
    if (s) try { localStorage.setItem(CAMP_KEY + '_backup', JSON.stringify(s)); } catch (e) { }   // salvataggio incompatibile o corrotto: copia di riserva, poi si riparte
    s = { v: CAMP_VER, diff: 'regolare', done: {}, cp: null, chars: {} };
  }
  return s;
}
function campSave(s) { try { localStorage.setItem(CAMP_KEY, JSON.stringify(s)); } catch (e) { } }
function campAvailable(m, s = campLoad()) { if (m.status === 'planned') return false; if (!m.after && m.n === 1 && m.chapter === 'overlord') return true; return !!(m.after ? s.done[m.after] : true); }

// ---------- regia della missione in corso ----------
const CAMP = { on: false, m: null, fired: new Set(), chars: {}, t0: 0, stageSaved: -1 };
function campStart(id, opts = {}) {
  const m = CMISSIONS.find(x => x.id === id); if (!m || !campAvailable(m)) return false;
  const s = campLoad(); s.cur = id; if (!opts.resume) s.cp = { mission: id, stage: 0 }; campSave(s);
  CAMP.on = true; CAMP.m = m; CAMP.fired.clear(); CAMP.resumeStage = opts.resume && s.cp && s.cp.mission === id ? s.cp.stage : 0; CAMP.stageSaved = -1; CAMP.done = false;
  // modalità esistente con le scelte della campagna
  const setSel = (sid, v) => { const e = $(sid); if (e && v !== undefined) { e.value = v; e.dispatchEvent(new Event('change')); } };
  if (m.mode.map) setSel('optMap', m.mode.map);
  if (m.mode.side) setSel('optSide', m.mode.side);
  if (m.mode.kasSide) setSel('optKasSide', m.mode.kasSide);
  if (m.mode.airMis) { setSel('optMap', 'air'); setSel('optAirMap', m.mode.airMis); }
  if ($('optMode')) setSel('optMode', 'c');
  setSel('optDiff', s.diff);
  if (m.id === 'overlord_01') campOmahaSetup();
  for (const id2 of ['mainMenu', 'campMenu']) { const e = $(id2); if (e) e.style.display = 'none'; }
  const mm = document.querySelector('#menu'); if (mm) mm.classList.add('hidden');
  return startGame();
}
// Omaha: la squadra del giocatore diventa la squadra dei personaggi (stessi posti nel mezzo da sbarco, stesse armi del ruolo)
const N_ORIG = Object.assign({}, typeof N !== 'undefined' ? N : {});
function campOmahaSetup() {
  N.sarge = cname('dominick_ucchesu'); N.walsh = cname('matteo_murtas'); N.baker = cname('alessio_medda'); N.kow = 'Pvt. Kowalski'; N.russo = 'Pvt. Russo';
  CAMP.squadKinds = ['smg', 'sniper', 'bar', 'smg', 'rifle', 'medic'];
  CAMP.squadChars = { [N.sarge]: 'dominick_ucchesu', [N.walsh]: 'matteo_murtas', [N.baker]: 'alessio_medda' };
}
function campRestoreNames() { if (typeof N !== 'undefined') Object.assign(N, N_ORIG); CAMP.squadKinds = null; CAMP.squadChars = null; }
// battuta di un personaggio: sottotitolo col nome e grado, voce inglese dal gestore delle voci (con attese, mai dopo la morte)
function campLine(cid, how, it, en) {
  const c = CHAR[cid]; if (!c) return;
  const body = CAMP.chars[cid];
  if (body && (body.alive === false || body.removed)) return;   // un personaggio caduto non parla
  say((how === 'radio' ? '📻 ' : '') + cname(cid), it);
  if (en && typeof shout === 'function') shout('en', 'move', how === 'radio' ? null : body ? body.pos : null, { text: en, priority: true, force: true, src: body || null, ev: 'camp.' + CAMP.m.id + '.' + cid + '.' + it.length, range: 400 });
}
function campTick(dt) {
  if (!CAMP.on || !CAMP.m || CAMP.done) return;
  const m = CAMP.m;
  // corpi dei personaggi in campo (la squadra del giocatore con il loro nome)
  if (CAMP.squadChars) for (const a of allies) { const cid = a.squad && CAMP.squadChars[a.name]; if (cid && !CAMP.chars[cid]) { CAMP.chars[cid] = a; a.cchar = cid; } }
  if (CAMP.resumeStage > 0) { if (MISSION.stage < 0) return; const st = CAMP.resumeStage; CAMP.resumeStage = 0; if (typeof CUT !== 'undefined' && CUT.active) endCutscene(); campResume(st); }   // ripresa: niente filmato iniziale, e il punto salvato non viene sovrascritto dalla fase 0
  const st = MISSION.stage;
  // punto di ripresa persistente all'inizio di ogni fase
  if (st > CAMP.stageSaved && st < (m.endStage ?? 99)) { CAMP.stageSaved = st; const s = campLoad(); s.cp = { mission: m.id, stage: st, t: Date.now() }; campSave(s); if (st > 0) showMsg('Punto di ripresa salvato', 1.8); }
  // dialoghi della fase, legati al tempo trascorso nella fase reale (non a un orologio globale)
  if (!(typeof CUT !== 'undefined' && CUT.active)) for (const e of (m.events || {})[st] || []) { const k = st + ':' + e[1] + ':' + e[0]; if (!CAMP.fired.has(k) && MISSION.stageT >= e[0]) { CAMP.fired.add(k); campLine(e[1], e[2], e[3], e[4]); } }
  campHud();
  if (m.endStage !== undefined && st >= m.endStage) campComplete();
}
// ripresa da una fase salvata: il mondo viene portato allo stato della fase (varco aperto, squadra accanto al giocatore)
function campResume(stage) {
  if (CAMP.m.id !== 'overlord_01' || stage < 1) return;
  P.inBoat = false; if (P.boat) P.boat = null; P.mode = 'foot';
  if (stage >= 3 && typeof addWireGap === 'function') { addWireGap(BREACH_X); MISSION.flags.placed = true; }
  for (let i = 1; i <= stage; i++) { CAMP.fired.add(i - 1 + ':skip'); for (const e of (CAMP.m.events || {})[i - 1] || []) CAMP.fired.add((i - 1) + ':' + e[1] + ':' + e[0]); }
  setStage(stage); CAMP.stageSaved = stage;
  const cp = MISSION.checkpoint; if (cp) { P.pos.set(cp.pos.x, Hf(cp.pos.x, cp.pos.z) + 1.7, cp.pos.z); P.yaw = cp.yaw || 0; }
  let k = 0; for (const a of allies) if (a.squad && a.alive) { a.boat = null; a.state = 'cover'; a.pos.set(P.pos.x + (k % 3 - 1) * 2.5, 0, P.pos.z + 2 + Math.floor(k / 3) * 2); a.pos.y = Hf(a.pos.x, a.pos.z); k++; }
  showMsg('Ripresa: ' + MISSION.title, 3);
}
function campComplete() {
  CAMP.done = true; const m = CAMP.m, s = campLoad();
  s.done[m.id] = { t: Date.now(), time: Math.round(GAME.time), kills: STATS.kills, deaths: STATS.deaths, diff: s.diff }; s.cp = null;
  for (const cid of m.characters || []) { const b = CAMP.chars[cid]; s.chars[cid] = { state: b && b.cWounded ? 'ferito' : 'disponibile', last: m.id }; }
  campSave(s);
  const nx = CMISSIONS.filter(x => x.after === m.id || x.id === m.next).map(x => x.title + (x.status === 'planned' ? ' (in preparazione)' : ''));
  GAME.endTitle = 'MISSIONE COMPIUTA — ' + m.title.toUpperCase();
  GAME.endText = `<b>${m.date} · ${m.loc}</b><br>` + (m.objectives || []).map(o => '✓ ' + o[1]).join('<br>') + '<br><br>' + (m.characters || []).map(cid => `${cfull(cid)} — ${CAMP.chars[cid] ? (CAMP.chars[cid].cWounded ? 'ferito, sopravvissuto' : 'illeso') : CHAR[cid].presence[m.id] === 'radio' ? 'via radio' : 'presente'}`).join('<br>') + (nx.length ? '<br><br>Sbloccato: ' + nx.join(', ') : '');
  banner('MISSIONE COMPIUTA', m.title); after(7, () => { GAME.end(true); campRestoreNames(); CAMP.on = false; });
}
// pannello: obiettivo della campagna e stato dei compagni con nome
function campHud() {
  let el = $('campHud'); if (!el) { el = document.createElement('div'); el.id = 'campHud'; el.style.cssText = 'position:fixed;left:16px;top:118px;z-index:18;pointer-events:none;font:600 12px/1.45 Oswald,sans-serif;color:#e9e2cc;text-shadow:0 1px 2px #000;background:rgba(10,12,10,.45);padding:6px 9px;border-left:2px solid #e8c46a'; document.body.appendChild(el); }
  const m = CAMP.m, cur = (m.objectives || []).find(o => o[2] === MISSION.stage);
  el.style.display = GAME.running ? 'block' : 'none';
  el.innerHTML = `<span style="color:#e8c46a;letter-spacing:.12em">${m.title.toUpperCase()}</span>` + (cur ? `<br>${(m.objectives || []).filter(o => o[2] < MISSION.stage).length + 1}/${m.objectives.length} · ${cur[1]}` : '') + Object.entries(CAMP.chars).map(([cid, b]) => `<br><span style="color:${!b.alive ? '#888' : b.cWounded && GAME.time - b.cWounded < 30 ? '#ffb070' : '#bfe6a8'}">● ${cname(cid)}</span>`).join('');
}
// i personaggi della missione non muoiono per un colpo qualunque: restano feriti (e lo si vede), ma possono essere soccorsi
(function campProtect() {
  if (typeof Soldier === 'undefined') return;
  const d0 = Soldier.prototype.damage;
  Soldier.prototype.damage = function (a, from, byPlayer, zone, imp) {
    if (this.cchar && CAMP.on && this.alive && this.hp - a <= 12) { a = Math.max(0, this.hp - 12); if (!this.cWounded || GAME.time - this.cWounded > 20) { this.cWounded = GAME.time; feed(cname(this.cchar) + ' è ferito!'); } this.supp = 1; this.duck = true; this.duckT = 3; }
    return d0.call(this, a, from, byPlayer, zone, imp);
  };
})();

// ---------- menù della campagna ----------
function campMenu() {
  let el = $('campMenu'); if (!el) { el = document.createElement('div'); el.id = 'campMenu'; document.body.appendChild(el); }
  const s = campLoad(), tot = CMISSIONS.filter(m => m.status !== 'planned').length, done = CMISSIONS.filter(m => s.done[m.id]).length, cp = s.cp && CMISSIONS.find(m => m.id === s.cp.mission);
  const DL = [['recluta', 'Recruit — Recluta'], ['regolare', 'Regular — Regolare'], ['temprato', 'Hardened — Temprato'], ['veterano', 'Veteran — Veterano']];
  el.innerHTML = `<div class="cmIn"><div class="cmHd"><div class="cmK">THEATRES OF WAR</div><h2>CAMPAGNA</h2><button class="cmX" data-c="close">✕</button></div>
  <div class="cmBar">${cp ? `<button data-c="continue">CONTINUA<small>${cp.title} · fase ${s.cp.stage + 1}</small></button>` : ''}<button data-c="new">NUOVA CAMPAGNA<small>dalla prima missione</small></button>
  <label>Difficoltà <select id="cmDiff">${DL.map(([k, l]) => `<option value="${k}" ${s.diff === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <span class="cmProg">Missioni completate ${done}/${tot} giocabili · ${CMISSIONS.length} previste</span></div>
  <div class="cmGrid"><div class="cmList">${CAMPAIGN.chapters.map(c => `<div class="cmCh"><b>${c.title}</b><small>${c.sub}</small>${c.missions.map(m => { const av = campAvailable(m, s), st = s.done[m.id] ? '✓' : m.status === 'planned' ? 'in preparazione' : av ? (m.status === 'adapted' ? 'giocabile (adattata)' : 'giocabile') : 'bloccata'; return `<button class="cmM ${av ? '' : 'off'}" data-m="${m.id}"><span>${m.n}. ${m.title}</span><i>${st}</i></button>`; }).join('')}</div>`).join('')}</div>
  <div class="cmBrief" id="cmBrief"><p>Scegli una missione per il briefing.</p><p class="cmChars">${CHARACTERS.map(c => `<span><b>${c.rank} ${c.firstName} ${c.lastName}</b> — ${c.roleIt} (${c.branch.replace('_', ' ')})${s.chars[c.id] ? ' · ' + s.chars[c.id].state : ''}</span>`).join('')}</p></div></div></div>`;
  el.style.display = 'flex';
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.c === 'close') { el.style.display = 'none'; const mm = $('mainMenu'); if (mm) mm.style.display = ''; return; }
    if (b.dataset.c === 'continue') return campStart(s.cp.mission, { resume: true });
    if (b.dataset.c === 'new') { const any = Object.keys(s.done).length || s.cp; if (any && !confirm('Ricominciare la campagna? I progressi salvati verranno cancellati.')) return; const ns = { v: CAMP_VER, diff: $('cmDiff').value, done: {}, cp: null, chars: {} }; campSave(ns); return campStart('overlord_01'); }
    if (b.dataset.m) campBrief(b.dataset.m);
    if (b.dataset.start) campStart(b.dataset.start);
  };
  $('cmDiff').onchange = e => { const s2 = campLoad(); s2.diff = e.target.value; campSave(s2); };
}
function campBrief(id) {
  const m = CMISSIONS.find(x => x.id === id), s = campLoad(), av = campAvailable(m, s), el = $('cmBrief'); if (!m) return;
  const li = a => (a || []).map(x => `<li>${x}</li>`).join('');
  el.innerHTML = `<div class="cmT">${m.title}</div><div class="cmD">${m.date} · ${m.loc}</div>
  ${m.context ? `<p>${m.context}</p>` : '<p><i>Missione in preparazione: non è ancora giocabile.</i>' + (m.needs ? ' Serve: ' + m.needs + '.' : '') + '</p>'}
  ${m.adaptedFrom ? `<p class="cmA">Usa la ${m.adaptedFrom}.</p>` : ''}
  ${m.id === 'overlord_01' ? '<canvas id="cmMap" width="300" height="150"></canvas>' : ''}
  ${m.objectives ? `<b>Obiettivi</b><ol>${li(m.objectives.map(o => o[1]))}</ol>` : ''}
  <b>Personaggi</b><ul>${li((m.characters || []).map(c => `${cfull(c)} — ${CHAR[c].roleIt}${m.presence ? '' : ''}${CHAR[c].presence[m.id] === 'radio' ? ' (via radio)' : CHAR[c].presence[m.id] === 'giocatore' ? ' (sei tu)' : ''}`))}</ul>
  ${m.player && !CHAR[m.player] ? `<p>Giochi come: ${m.player}.</p>` : ''}
  ${m.doc ? `<details><summary>Nota storica</summary><b>Documentato</b><ul>${li(m.doc)}</ul><b>Elementi di fantasia</b><ul>${li(m.story)}</ul></details>` : ''}
  ${av ? `<button class="cmGo" data-start="${m.id}">INIZIA LA MISSIONE</button>` : m.status === 'planned' ? '' : '<p><i>Bloccata: completa prima ' + (CMISSIONS.find(x => x.id === m.after) || {}).title + '.</i></p>'}`;
  const cv = $('cmMap'); if (cv) { const g = cv.getContext('2d'); g.fillStyle = '#3b4f5a'; g.fillRect(0, 0, 300, 150); g.fillStyle = '#c9b98d'; g.fillRect(0, 0, 300, 70); g.fillStyle = '#6f7a52'; g.fillRect(0, 0, 300, 38); g.strokeStyle = '#2b2b22'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, 48); g.lineTo(300, 48); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#c8432f'; for (const x of [70, 150, 230]) { g.fillRect(x - 4, 26, 8, 8); } g.fillStyle = '#e8c46a'; g.beginPath(); g.moveTo(130, 140); g.lineTo(140, 70); g.lineTo(140, 48); g.lineTo(150, 30); g.strokeStyle = '#e8c46a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#111'; g.font = '600 10px Oswald, sans-serif'; g.fillText('mare · mezzi da sbarco', 8, 140); g.fillText('spiaggia', 8, 64); g.fillText('filo spinato', 8, 45); g.fillText('scogliera · bunker MG42', 8, 14); g.fillText('N ↑', 278, 14); }
}
validateOnce: { const e = campValidate(); CAMP.valid = !e.length; CAMP.errors = e; }
// fine partita: le missioni adattate da altre modalità contano quando la modalità dichiara la vittoria; i nomi tornano quelli di sempre
window.addEventListener('load', function campEndHook() {
  const e0 = GAME.end;
  GAME.end = function (win) {
    if (CAMP.on && !CAMP.done && win && CAMP.m && CAMP.m.status === 'adapted') { const s = campLoad(); s.done[CAMP.m.id] = { t: Date.now(), time: Math.round(GAME.time), diff: s.diff }; s.cp = null; for (const cid of CAMP.m.characters) s.chars[cid] = { state: 'disponibile', last: CAMP.m.id }; campSave(s); CAMP.done = true; }
    const r = e0.call(GAME, win); if (CAMP.on && (CAMP.done || !win)) { campRestoreNames(); CAMP.on = false; } return r;
  };
});
addEventListener('keydown', e => { if (e.key === 'Escape' && $('campMenu') && $('campMenu').style.display === 'flex') { $('campMenu').style.display = 'none'; const mm = $('mainMenu'); if (mm) mm.style.display = ''; } });
