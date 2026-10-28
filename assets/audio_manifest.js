// ============================================================
//  Registro degli eventi audio personalizzabili (usato dal gioco e da scripts/audio-scaffold.js).
//  Ogni evento: id univoco, percorso (senza estensione) sotto la cartella degli audio personali,
//  categoria, descrizione, suono originale usato quando il file personale manca o non è valido.
//  Per aggiungere un'arma, un mezzo o una nave basta aggiungerne il nome nelle tabelle qui sotto.
// ============================================================
(function (root) {
  const M = [];
  const seen = new Set();
  const add = (id, path, cat, desc, orig) => { if (seen.has(id)) return; seen.add(id); M.push({ id, path, cat, desc, orig: orig || '' }); };

  // ---------- suoni generici: uno per ogni campione del gioco ----------
  // [campione originale, id, percorso, categoria, descrizione]
  const GEN = [
    ['garand', 'weapon.garand.fire', 'weapons/rifles/garand/fire', 'weapons', 'Sparo M1 Garand (anche fucili alleati dei soldati)'],
    ['springfield', 'weapon.springfield.fire', 'weapons/rifles/springfield/fire', 'weapons', 'Sparo Springfield (e Lee-Enfield)'],
    ['kar98', 'weapon.kar98.fire', 'weapons/rifles/kar98/fire', 'weapons', 'Sparo Kar98k (e fucili tedeschi e sovietici dei soldati)'],
    ['thompson', 'weapon.thompson.fire', 'weapons/smg/thompson/fire', 'weapons', 'Sparo Thompson'],
    ['mp40', 'weapon.mp40.fire', 'weapons/smg/mp40/fire', 'weapons', 'Sparo MP 40'],
    ['bar', 'weapon.bar.fire', 'weapons/automatic/bar/fire', 'weapons', 'Sparo BAR (e mitragliatrici di bordo leggere)'],
    ['colt', 'weapon.colt.fire', 'weapons/pistols/colt/fire', 'weapons', 'Sparo Colt M1911'],
    ['rocket', 'weapon.bazooka.fire', 'weapons/launchers/bazooka/fire', 'weapons', 'Lancio del Bazooka'],
    ['mg42', 'weapon.mg42.fire', 'weapons/machineguns/mg42/fire', 'weapons', 'Colpo singolo MG 42 (la raffica ripete il colpo)'],
    ['m2', 'weapon.m2.fire', 'weapons/machineguns/m2/fire', 'weapons', 'Colpo Browning M2 .50 (aerei, navi, mezzi)'],
    ['flak', 'weapon.flak.fire', 'weapons/flak/fire', 'weapons', 'Colpo di contraerea e cannoncini'],
    ['rifle_far', 'weapon.common.rifle_distant', 'weapons/common/rifle_distant', 'weapons', 'Fucile sentito da lontano'],
    ['smg_far', 'weapon.common.smg_distant', 'weapons/common/smg_distant', 'weapons', 'Mitra sentito da lontano'],
    ['mg_far', 'weapon.common.mg_distant', 'weapons/common/mg_distant', 'weapons', 'Mitragliatrice sentita da lontano'],
    ['flak_far', 'weapon.common.flak_distant', 'weapons/common/flak_distant', 'weapons', 'Contraerea sentita da lontano'],
    ['mag_out', 'weapon.common.reload_start', 'weapons/common/reload_start', 'weapons', 'Ricarica: caricatore fuori'],
    ['mag_in', 'weapon.common.reload_end', 'weapons/common/reload_end', 'weapons', 'Ricarica: caricatore dentro (anche cambio arma)'],
    ['clip_in', 'weapon.common.reload', 'weapons/common/reload', 'weapons', 'Ricarica: lastrina inserita'],
    ['bolt_open', 'weapon.common.bolt', 'weapons/common/bolt', 'weapons', 'Otturatore aperto'],
    ['bolt_close', 'weapon.common.bolt_close', 'weapons/common/bolt_close', 'weapons', 'Otturatore chiuso'],
    ['dry', 'weapon.common.empty', 'weapons/common/empty', 'weapons', 'Grilletto a vuoto'],
    ['ping', 'weapon.garand.clip_eject', 'weapons/rifles/garand/clip_eject', 'weapons', 'Espulsione della lastrina del Garand (ping)'],
    ['tink', 'weapon.common.casing', 'weapons/common/casing', 'weapons', 'Bossolo che cade'],
    ['pin', 'weapon.grenade.pin', 'weapons/grenade/pin', 'weapons', 'Granata: spoletta tolta'],
    ['nade_bounce', 'weapon.grenade.bounce', 'weapons/grenade/bounce', 'weapons', 'Granata che rimbalza'],
    ['crack', 'impact.bullet_crack', 'impacts/bullet_crack', 'impacts', 'Schiocco del proiettile che passa vicino'],
    ['whiz', 'impact.bullet_whiz', 'impacts/bullet_whiz', 'impacts', 'Fischio del proiettile vicino'],
    ['ricochet', 'impact.ricochet', 'impacts/ricochet', 'impacts', 'Rimbalzo sulla corazza'],
    ['imp_sand', 'impact.sand', 'impacts/sand', 'impacts', 'Colpo nella sabbia e nella terra'],
    ['imp_water', 'impact.water', 'impacts/water', 'impacts', 'Colpo nell\'acqua'],
    ['imp_metal', 'impact.metal', 'impacts/metal', 'impacts', 'Colpo sul metallo'],
    ['imp_flesh', 'impact.flesh', 'impacts/flesh', 'impacts', 'Colpo a segno su un soldato'],
    ['imp_wood', 'impact.wood', 'impacts/wood', 'impacts', 'Colpo sul legno'],
    ['imp_stone', 'impact.stone', 'impacts/stone', 'impacts', 'Colpo su pietra e cemento'],
    ['flesh_squelch', 'impact.flesh_squelch', 'impacts/flesh_squelch', 'impacts', 'Ferita grave'],
    ['clang', 'impact.armor', 'impacts/armor', 'impacts', 'Granata che colpisce una corazza'],
    ['boom', 'explosion.near', 'explosions/near', 'explosions', 'Esplosione vicina (granate, proiettili, carri)'],
    ['boom_far', 'explosion.far', 'explosions/far', 'explosions', 'Esplosione lontana'],
    ['boom_water', 'explosion.water', 'explosions/water', 'explosions', 'Esplosione in acqua'],
    ['boom_big', 'explosion.magazine', 'explosions/magazine', 'explosions', 'Esplosione enorme (santabarbara di una nave)'],
    ['mortar', 'explosion.mortar', 'explosions/mortar', 'explosions', 'Colpo di mortaio in arrivo'],
    ['whistle', 'explosion.shell_whistle', 'explosions/shell_whistle', 'explosions', 'Fischio del proiettile d\'artiglieria'],
    ['bomb', 'explosion.bomb_whistle', 'explosions/bomb_whistle', 'explosions', 'Fischio della bomba che cade'],
    ['step_sand', 'move.step_sand', 'movement/step_sand', 'movement', 'Passo sulla sabbia e sulla terra'],
    ['step_peb', 'move.step_pebble', 'movement/step_pebble', 'movement', 'Passo sui ciottoli'],
    ['step_water', 'move.step_water', 'movement/step_water', 'movement', 'Passo nell\'acqua'],
    ['bodyfall', 'move.bodyfall', 'movement/bodyfall', 'movement', 'Corpo a terra, alberi che cadono'],
    ['heart', 'player.heartbeat', 'player/heartbeat', 'player', 'Battito del cuore (ferito)'],
    ['breath', 'player.breath', 'player/breath', 'player', 'Respiro affannato'],
    ['thud', 'player.hit', 'player/hit', 'player', 'Colpo ricevuto'],
    ['scream', 'voice.scream', 'voices/scream', 'voices', 'Urlo'],
    ['groan', 'voice.groan', 'voices/groan', 'voices', 'Gemito'],
    ['yell', 'voice.yell', 'voices/yell', 'voices', 'Grido'],
    ['wail', 'voice.wail', 'voices/wail', 'voices', 'Lamento'],
    ['eng_sherman', 'vehicle.sherman.engine', 'vehicles/tanks/sherman/engine', 'vehicles', 'Motore Sherman (loop)'],
    ['eng_pz4', 'vehicle.pz4.engine', 'vehicles/tanks/pz4/engine', 'vehicles', 'Motore Panzer IV e III (loop)'],
    ['eng_tiger', 'vehicle.tiger.engine', 'vehicles/tanks/tiger/engine', 'vehicles', 'Motore Tiger (loop)'],
    ['eng_boat', 'vehicle.boat.engine', 'vehicles/boats/engine', 'vehicles', 'Motore dei mezzi da sbarco e delle motosiluranti (loop)'],
    ['tracks', 'vehicle.common.tracks', 'vehicles/common/tracks', 'vehicles', 'Cingoli (loop)'],
    ['turret', 'vehicle.common.turret_rotate', 'vehicles/common/turret_rotate', 'vehicles', 'Rotazione della torretta (loop)'],
    ['tank_gun', 'vehicle.common.cannon_fire', 'vehicles/common/cannon_fire', 'vehicles', 'Cannone del carro'],
    ['reload_clank', 'vehicle.common.cannon_reload', 'vehicles/common/cannon_reload', 'vehicles', 'Ricarica del cannone (anche cariche e casse)'],
    ['eng_p47', 'aircraft.common.engine_allied', 'aircraft/common/engine_allied', 'aircraft', 'Motore degli aerei alleati e giapponesi (loop)'],
    ['eng_fw', 'aircraft.common.engine_german', 'aircraft/common/engine_german', 'aircraft', 'Motore degli aerei tedeschi (loop)'],
    ['eng_bomber', 'aircraft.common.engine_bomber', 'aircraft/common/engine_bomber', 'aircraft', 'Motori dei bombardieri (loop)'],
    ['flyby', 'aircraft.common.flyby', 'aircraft/common/flyby', 'aircraft', 'Passaggio ravvicinato'],
    ['dive', 'aircraft.common.dive', 'aircraft/common/dive', 'aircraft', 'Picchiata'],
    ['ship_near', 'naval.common.main_cannon_fire', 'naval/common/main_cannon_fire', 'naval', 'Cannoni principali della propria nave'],
    ['ship_far', 'naval.common.main_cannon_distant', 'naval/common/main_cannon_distant', 'naval', 'Cannoni navali lontani (anche il bombardamento su Omaha)'],
    ['gq_siren', 'naval.common.general_quarters', 'naval/common/general_quarters', 'naval', 'Allarme di posto di combattimento'],
    ['horn', 'naval.common.horn', 'naval/common/horn', 'naval', 'Sirena della nave'],
    ['torpedo_run', 'naval.common.torpedo', 'naval/common/torpedo', 'naval', 'Siluro in corsa'],
    ['air_raid', 'ambient.air_raid_siren', 'ambient/air_raid_siren', 'ambient', 'Sirena d\'allarme aereo'],
    ['wind', 'ambient.wind', 'ambient/wind', 'ambient', 'Vento (loop)'],
    ['surf', 'ambient.surf', 'ambient/surf', 'ambient', 'Risacca e onde (loop)'],
    ['battle', 'ambient.distant_battle', 'ambient/distant_battle', 'ambient', 'Battaglia lontana (loop)'],
    ['fire_loop', 'ambient.fire', 'ambient/fire', 'ambient', 'Incendio (loop)'],
  ];
  for (const [s, id, path, cat, desc] of GEN) add(id, path, cat, desc, s);
  const GEN_BY_SAMPLE = {}; for (const [s, id] of GEN) GEN_BY_SAMPLE[s] = id;

  // ---------- armi: un evento per ogni azione che l'arma esegue davvero ----------
  // [id arma, classe (cartella), nome, ha otturatore, ha caricatore staccabile o lastrina]
  const WEAPONS = [
    ['garand', 'rifles', 'M1 Garand', 0], ['springfield', 'rifles', 'Springfield M1903A4', 1], ['enfield', 'rifles', 'Lee-Enfield No.4 (T)', 1],
    ['mosin', 'rifles', 'Mosin-Nagant 91/30 PU', 1], ['kar98', 'rifles', 'Karabiner 98k', 1], ['kar98zf', 'rifles', 'Kar98k ZF39', 1],
    ['g43', 'rifles', 'Gewehr 43', 0], ['svt40', 'rifles', 'SVT-40', 0], ['thompson', 'smg', 'Thompson M1A1', 0], ['mp40', 'smg', 'MP 40', 0],
    ['bar', 'automatic', 'BAR M1918A2', 0], ['colt', 'pistols', 'Colt M1911A1', 0], ['bazooka', 'launchers', 'Bazooka M1A1', 0],
  ];
  const WEV = [
    ['fire', 'Sparo (vicino, in prima persona)', 'sparo del tipo di arma'], ['fire_distant', 'Sparo sentito da lontano', 'rimbombo lontano generico'],
    ['aim_in', 'Inizio della mira (click destro)', 'nessuno: solo se presente il file'], ['aim_out', 'Fine della mira', 'nessuno: solo se presente il file'],
    ['reload_start', 'Inizio ricarica (caricatore fuori)', 'mag_out'], ['reload', 'Ricarica (lastrina inserita)', 'clip_in'], ['reload_end', 'Fine ricarica (caricatore dentro)', 'mag_in'],
    ['empty', 'Grilletto a vuoto', 'dry'], ['equip', 'Estrazione dell\'arma (cambio arma)', 'mag_in'],
  ];
  for (const [w, cls, name, bolt] of WEAPONS) {
    for (const [ev, d, o] of WEV) add(`weapon.${w}.${ev}`, `weapons/${cls}/${w}/${ev}`, 'weapons', `${name}: ${d}`, o);
    if (bolt) { add(`weapon.${w}.bolt`, `weapons/${cls}/${w}/bolt`, 'weapons', `${name}: otturatore aperto`, 'bolt_open'); add(`weapon.${w}.bolt_close`, `weapons/${cls}/${w}/bolt_close`, 'weapons', `${name}: otturatore chiuso`, 'bolt_close'); }
  }

  // ---------- carri armati ----------
  const TANKS = [['sherman', 'M4 Sherman'], ['pz4', 'Panzer IV'], ['pz3', 'Panzer III'], ['tiger', 'Tiger I']];
  const TEV = [['engine', 'Motore (loop, segue il regime)', 'motore generico del carro'], ['tracks', 'Cingoli (loop)', 'tracks'], ['turret_rotate', 'Rotazione della torretta (loop)', 'turret'],
    ['cannon_fire', 'Sparo del cannone', 'tank_gun'], ['cannon_reload', 'Ricarica del cannone', 'reload_clank'], ['machinegun_fire', 'Mitragliatrice coassiale', 'colpo MG 42 o M2']];
  for (const [t, name] of TANKS) for (const [ev, d, o] of TEV) add(`vehicle.${t}.${ev}`, `vehicles/tanks/${t}/${ev}`, 'vehicles', `${name}: ${d}`, o);

  // ---------- aerei ----------
  const PLANES = [['p47', 'P-47 Thunderbolt'], ['p51', 'P-51 Mustang'], ['f4u', 'F4U Corsair'], ['spit', 'Spitfire'], ['typhoon', 'Typhoon'], ['hurri', 'Hurricane'], ['p40', 'P-40 Warhawk'],
    ['sbd', 'SBD Dauntless'], ['tbf', 'TBF Avenger'], ['bf109', 'Bf 109'], ['fw190', 'Fw 190'], ['stuka', 'Ju 87 Stuka'], ['me262', 'Me 262'], ['mosquito', 'Mosquito'], ['zero', 'A6M Zero'],
    ['val', 'D3A Val'], ['kate', 'B5N Kate'], ['f47', 'F-47'], ['b26', 'B-26 Marauder']];
  for (const [p, name] of PLANES) {
    add(`aircraft.${p}.engine`, `aircraft/${p}/engine`, 'aircraft', `${name}: motore (loop, segue manetta e velocità)`, 'motore generico della nazione');
    add(`aircraft.${p}.guns_fire`, `aircraft/${p}/guns_fire`, 'aircraft', `${name}: mitragliatrici o cannoni di bordo`, 'colpo dell\'arma di bordo');
  }

  // ---------- navi ----------
  const SHIPS = [['texas', 'USS Texas'], ['fletcher', 'Cacciatorpediniere Fletcher'], ['cleveland', 'Incrociatore Cleveland'], ['elco', 'PT boat Elco'], ['satsuma', 'Satsuma'],
    ['akagi', 'Portaerei Akagi'], ['kaga', 'Portaerei Kaga'], ['soryu', 'Portaerei Soryu'], ['kirishima', 'Corazzata Kirishima'], ['z1934', 'Zerstörer 1934'], ['nurnberg', 'Incrociatore Nürnberg'],
    ['scharnhorst', 'Scharnhorst'], ['sboot', 'Schnellboot S-100'], ['cargo', 'Mercantile']];
  for (const [s, name] of SHIPS) {
    add(`naval.${s}.main_cannon_fire`, `naval/${s}/main_cannon_fire`, 'naval', `${name}: cannoni principali (nave del giocatore)`, 'ship_near');
    add(`naval.${s}.main_cannon_distant`, `naval/${s}/main_cannon_distant`, 'naval', `${name}: cannoni principali sentiti da fuori`, 'ship_far');
    add(`naval.${s}.secondary_fire`, `naval/${s}/secondary_fire`, 'naval', `${name}: artiglieria secondaria e cannoncini (20 mm e oltre)`, 'flak');
    add(`naval.${s}.aa_fire`, `naval/${s}/aa_fire`, 'naval', `${name}: mitragliere antiaeree leggere`, 'm2');
  }

  // ---------- modalità cecchini: annunci e conferme (solo se presenti i file) ----------
  for (const [ev, d] of [['headshot', 'Colpo alla testa'], ['double_headshot', 'Due colpi alla testa di fila'], ['triple_headshot', 'Tre colpi alla testa di fila'],
    ['multikill', 'Due uccisioni in 4 secondi'], ['killing_spree', '5 uccisioni senza morire'], ['unstoppable', '10 uccisioni senza morire']]) add(`sniper.announcer.${ev}`, `sniper/announcer/${ev}`, 'sniper', `Annuncio: ${d}`, 'nessuno: solo se presente il file');
  for (const [ev, d] of [['hitmarker', 'Colpo a segno'], ['headshot_confirm', 'Conferma colpo alla testa'], ['kill_confirm', 'Conferma uccisione']]) add(`sniper.effects.${ev}`, `sniper/effects/${ev}`, 'sniper', d, 'nessuno: solo se presente il file');

  // ---------- grida dei soldati: sostituiscono la sintesi vocale per quella categoria ----------
  for (const [lang, cats] of [['en', 'move medic cover grenade reload kill fire mortar plane'], ['de', 'fire spot grenade reload medic retreat hold plane']])
    for (const c of cats.split(' ')) add(`shout.${lang}.${c}`, `voices/shouts/${lang}/${c}`, 'voices', `Grida ${lang === 'en' ? 'americane' : 'tedesche'}: ${c}`, 'sintesi vocale del browser');

  // ---------- interfaccia (solo se presenti i file) ----------
  add('ui.click', 'ui/click', 'ui', 'Clic sui pulsanti dei menù', 'nessuno: solo se presente il file');
  add('ui.start', 'ui/start', 'ui', 'Inizio della battaglia', 'nessuno: solo se presente il file');

  const api = { list: M, byId: Object.fromEntries(M.map(e => [e.id, e])), bySample: GEN_BY_SAMPLE, formats: ['ogg', 'mp3', 'wav'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AUDIO_MANIFEST = api;
})(typeof window !== 'undefined' ? window : globalThis);
