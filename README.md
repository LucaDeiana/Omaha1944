# Omaha 1944

FPS nel browser che simula lo sbarco a Omaha Beach (6 giugno 1944): dall'avvicinamento sul mezzo da sbarco Higgins, sotto il fuoco delle corazzate, fino alla liberazione di Colleville-sur-Mer e alla difesa dal contrattacco tedesco.

## Come giocare
Fai doppio clic su `Avvia Omaha.bat` (oppure apri `index.html` in Chrome o Edge). Serve internet per caricare Three.js e i font da CDN. Nel menu scegli fazione (Alleati o Asse) e, per l'Asse, la modalità (campagna o infinita).

| Tasto | Azione |
|---|---|
| W A S D | Movimento |
| Shift | Corsa (consuma fiato) |
| Spazio | Salto |
| C / Ctrl | Accovacciati |
| Z | A terra |
| Click sinistro | Fuoco |
| Click destro | Mira (ottica per lo Springfield) |
| R | Ricarica |
| G | Granata |
| 1 2 3 / rotella | Cambio arma · Q arma precedente |
| E | Interagisci / raccogli armi / rifornimento / entra in MG42, mortaio, Flak, Tobruk, Panzer |
| H | Bendati (3 s, +45 salute) |
| T | Supporto aereo con vista dall'alto (una chiamata ogni 2 min e mezzo) |
| X | Ordini alla squadra (con me / tenete la posizione / avanzate) |
| Panzer | W/S/A/D guida · mouse torretta · click sx cannone · F mitragliatrice · click dx ottica · E esci |
| V | Colpo con il calcio del fucile |
| B | Cambia ruolo (fanteria / corazzata / aereo) |
| Aereo | mouse = direzione (istruttore; M per la cloche manuale) · click sx mitragliatrici · click dx zoom · Spazio o F bomba · A/D rollio · W/S manetta · V visuale |
| Esc | Pausa |

## Ruoli (tasto B o dopo la morte)
- **Fanteria**: dall'ultimo checkpoint oppure a bordo della prossima ondata di sbarco.
- **USS Texas**: torretta da 14 pollici con binocolo; bombarda la costa (attenzione al fuoco amico).
- **P-47 Thunderbolt**: cabina in prima persona, modello di volo fisico (portanza, resistenza, stallo, forze G), 8 mitragliatrici .50 e 2 bombe; contraerea nemica attiva.

## Campagna
1. **Avvicinamento**: 40 secondi sul mezzo da sbarco tra bombardamento navale e mitragliatrici.
2. **Omaha Beach**: raggiungi il terrapieno sotto il fuoco di MG42 e mortai.
3. **Il filo spinato**: prendi un tubo Bangalore e apri un varco.
4. **La scogliera**: risali il canalone evitando i campi minati e conquista la trincea.
5. **I bunker MG42**: neutralizza 3 bunker con cariche, granate nella feritoia o bazooka.
6. **La batteria da 88**: attraversa il bocage e distruggi i cannoni che colpiscono la spiaggia.
7. **Colleville-sur-Mer**: libera il villaggio casa per casa (attenzione al cecchino sul campanile).
8. **Il contrattacco**: resisti 3 minuti a fanteria e semicingolati finché arrivano gli Sherman.

Checkpoint automatici: se cadi riparti dall'ultimo.

## Armi
- **USA:** M1 Garand, Thompson M1A1, BAR M1918A2, Springfield M1903A4 con ottica, Colt M1911A1, bazooka M1A1, granate Mk 2, cariche da demolizione, tubo Bangalore.
- **Germania (raccoglibili dai caduti):** Karabiner 98k, MP 40.

## Grafica, audio e prestazioni
- Texture procedurali generate sulla GPU (sabbia bagnata riflettente, ciottoli, erba, cemento, pietra, legno, tessuto delle divise).
- Soldati dettagliati disegnati in istanze GPU con due livelli di dettaglio: centinaia di soldati in poche chiamate di disegno.
- Ragdoll fisico (Verlet) per i caduti, corpi che galleggiano, smembramenti e sangue (disattivabili).
- Audio sintetizzato offline: spari a strati, eco della scogliera, schiocchi supersonici, rimbalzi, esplosioni con pioggia di detriti, motori, risacca, urla.
- Voci dei soldati in inglese (americani) e tedesco (tedeschi) con le voci di sintesi del browser e sottotitoli in italiano.
- Qualità: Basso, Medio, Alto, Ultra. La **risoluzione dinamica** abbassa da sola la risoluzione interna quando gli FPS calano.

## Multiplayer in rete locale

Serve Node.js (nessun pacchetto da installare).

1. Sul PC che fa da server, nella cartella del gioco: `node server/server.js`
   Il server stampa gli indirizzi da usare, per esempio `http://192.168.1.146:8080`.
2. Su quel PC apri `http://localhost:8080`; sull'altro PC, collegato alla stessa rete, apri `http://IP-DEL-SERVER:8080`.
3. Nel menu spunta **Multiplayer in rete locale**, scrivi il tuo nome, scegli la fazione e premi INIZIA.
4. Alla prima esecuzione Windows chiede di consentire Node.js nel firewall: consenti l'accesso alle **reti private**.

Il primo giocatore che entra è l'**host**: il suo PC simula la battaglia (soldati dell'IA, mezzi da sbarco, fasi della missione, bunker, varchi nel filo) e la trasmette agli altri 10 volte al secondo. Tutti vedono e combattono la stessa battaglia: i colpi dei client sui soldati dell'IA vengono applicati dall'host, e l'IA dell'host può colpire e uccidere tutti i giocatori.
Condiviso anche: posizione, animazioni e nomi dei giocatori, colpi, danni tra fazioni, uccisioni, postazioni MG42 e mortaio.
Limiti: se l'host esce, la partita condivisa termina; aerei casuali e bombardamento navale restano locali a ogni PC.

## Struttura
```
index.html, style.css   pagina e interfaccia
src/config.js           impostazioni, dati delle armi, utilità
src/textures.js         texture procedurali sulla GPU e materiali
src/crowd.js            scheletri e rendering in istanze dei soldati
src/gore.js             sangue, ragdoll, smembramenti
src/aircraft.js         aerei, contraerea, modalità pilota
src/naval.js            modalità artigliere della USS Texas
src/engine.js           renderer, cielo, luci, post-processing
src/audio.js            audio sintetizzato (WebAudio)
src/fx.js               particelle, traccianti, detriti, crateri
src/world.js            terreno, acqua, spiaggia, bunker, villaggio, flotta
src/soldier.js          modelli dei soldati e IA
src/weapons.js          armi in prima persona, balistica, esplosioni
src/player.js           movimento, posture, danni, interazioni
src/mission.js          fasi della campagna, dialoghi, ondate, mezzi
src/hud.js              HUD, bussola, marcatori
src/main.js             menu, pausa, ciclo di gioco
```

## Scenari
- **Omaha Beach — 6 giugno 1944**: sbarco, scogliera, bocage, Colleville e la città (Alleati o Asse, campagna o modalità infinita).
- **Ardenne — Bois Jacques, dicembre 1944**: la Easy Company tiene le buche nel bosco innevato sotto gli sbarramenti d'artiglieria che abbattono gli abeti, recupera i rifornimenti paracadutati dai C-47 nel campo, ferma i Panzer sulla strada e contrattacca fino a Foy. Si sceglie dal menu "Scenario".
- **Cieli di Normandia — solo aerei**: P-47 su una mappa dedicata di bocage, costa e fiume; intercettare i Fw 190, distruggere una colonna sotto la Flak, fermare il treno delle munizioni, scortare i B-26 sullo scalo ferroviario, bombardare il ponte sulla Douve. Nuvole attraversabili e campagna visibile fino a 6 km. A/D per rollare e mouse per tirare in virata, V per la visuale esterna.

## Crediti texture

Texture fotografiche da [ambientCG](https://ambientcg.com) (licenza CC0): Ground054, Ground109, Grass004, Concrete034, Bricks100, Bricks097, RoofingTiles013A, PavingStones138, Planks037A, PaintedMetal004, Fabric084, Plaster001. Ridotte a 512 px e incluse in `assets/tex_photo.js`.

## Crediti modelli
Corpo umano base da [Godot-Male-Base-Mesh](https://github.com/BoQsc/Godot-Male-Base-Mesh) (orange-juice-games, licenza CC0): `assets/models/male_base.glb`. Lo script `tools/convert_base.js` lo adatta allo scheletro dei soldati, rimuove testa, mani e piedi (sostituiti da quelli scolpiti del gioco), lo leviga con una suddivisione di Loop e scrive `assets/models/male_base.js`.

## Crediti audio
Spari reali da [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) (CC0).
