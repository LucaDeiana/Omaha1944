# Missioni aeree 3.0

## Analisi del codice prima delle modifiche
- **Volo**: Air Combat 2.0 (`src/aircraft.js`, `src/aircombat.js`): fisica del giocatore a passo fisso, IA a stati con manovre, danni per componente, gregari, decollo e atterraggio da portaerei o pista.
- **Aerei pilotabili** (`src/planes2.js`): P-47, P-51, F4U, Spitfire IX, Typhoon, Hurricane, P-40, SBD, TBF, Bf 109, Fw 190, Ju 87, Me 262, Mosquito, Zero, Val, Kate, F-47. Bombe per chi le porta, siluri solo nella modalità navale. Nessun razzo, nessun Beaufighter, nessun bombardiere pilotabile.
- **Aerei solo IA**: B-26, Ju 88.
- **Mappe aeree**:
  - Normandia (`src/air.js`): costa, fiume con ponte, strada della colonna, villaggio, ferrovia con scalo, contraerea; la portaerei al largo è una licenza (non c'erano portaerei a Normandia);
  - La Manica e Il Reno (`src/airmaps.js`).
  - Terreno a blocchi con livelli di dettaglio (`src/airworld.js`), campagna lontana fino a 6 km, alberi istanziati, nuvole a sprite.
- **Missioni prima**: tappe fisse scritte a mano per ogni mappa (`AIR_STAGES`, `AIR_STAGES2`), più le missioni secondarie automatiche (`src/sidemissions.js`); nessun briefing, nessun resoconto, nessun salvataggio dei progressi.
- **Navale**: la modalità navale (`src/navy.js`, `src/shipmodels.js`) ha modelli dettagliati, tra cui la USS Texas, un Fletcher, cacciatorpediniere e mercantili; nella scena aerea c'erano solo sagome semplici (`AirShip`).
- **Audio**: sistema degli audio personali con ritorno ai suoni originali; `caPlay` per i suoni che esistono solo come file personale.
- **Rete**: la modalità aerea non è sincronizzata.

## Sistema delle missioni (`src/aircamp.js`)
Ogni missione è un oggetto dati con:
- id, titolo, data, ora, teatro, luogo, velivolo e armamento, partenza, meteo e luce;
- gruppi di unità, obiettivi primari in sequenza e secondari in parallelo (anche nascosti e rivelati da eventi);
- eventi a condizione, frasi radio, condizioni di fallimento, aerei di riserva, limite di tempo;
- nota storica divisa in *documentato*, *ricostruzione plausibile* e *modificato per il gioco*.

Il motore:
- trasforma gli obiettivi nelle tappe della modalità aerea;
- tipi di obiettivo: `reach`, `identify`, `destroy`, `patrol`, `intercept`, `return`, più `protect` e `flag` per i secondari;
- mostra rotta e distanza dal punto (bussola), segnalini e secondari sotto l'obiettivo;
- fa partire gli eventi una sola volta, al verificarsi della loro condizione;
- usa ogni frase radio una sola volta, con il file personale `radio.<missione>.<frase>` se presente;
- conta precisione, bombe, danni subiti, aerei perduti, bersagli distrutti e alleati sopravvissuti, poi calcola la valutazione;
- salva i progressi (`localStorage`) e sblocca la missione successiva.

**Valutazione** su 100:
- obiettivi primari 45;
- secondari 10;
- aerei conservati 15;
- alleati protetti 15;
- precisione 8;
- danni evitati 7.

Gli abbattimenti non contano da soli.

**Briefing** nel menù (Mappa aerea → Campagna aerea 1944): numero e titolo, data e ora, luogo, velivolo, armamento, meteo, contesto, obiettivi, nota storica e mappa operativa disegnata dal terreno vero della missione, con partenza, rotta e punti numerati.

Nelle missioni della campagna:
- niente portaerei;
- partenza in volo;
- niente missioni secondarie automatiche;
- niente riarmo in volo.

## Missioni giocabili
### 1 — Strade di Normandia (P-47D, 7 giugno 1944, mattina)
- **Svolgimento**:
  1. Ingresso dalla Manica.
  2. Ricerca e identificazione della colonna: bisogna scendere sotto i 900 m nell'area per qualche secondo.
  3. Attacco: almeno 6 autocarri su 10.
  4. Rientro verso la Manica.
- **Secondari**: 3 postazioni contraeree; il ponte sulla Douve, assegnato dal comando durante la missione.
- **Eventi**:
  - la colonna si ferma e i mezzi escono dalla strada al primo attacco;
  - avviso di Flak alla prima postazione vicina;
  - le nubi si abbassano e la foschia aumenta;
  - due Fw 190 dopo l'attacco;
  - gregario colpito.
- **Meteo**: nubi basse e foschia.

### 2 — Ombrello sulla flotta (Spitfire IX, 7 giugno 1944, tramonto)
- **Svolgimento**:
  1. Ingresso sul gruppo navale.
  2. Pattuglia.
  3. Prima incursione: 4 Fw 190 con bombe, bassi da sud-est.
  4. Pattuglia.
  5. Seconda incursione: 3 Ju 88 con due Bf 109 di scorta.
  6. Rientro.
- **Gruppo navale**: USS Texas, due cacciatorpediniere e quattro trasporti, con i modelli della modalità navale. Navigano in formazione su una rotta ad anello con scie, accostano quando arriva un'incursione e sparano contraerea con puntamento progressivo, mai perfetto.
- **Fuoco amico**: le navi sparano anche al giocatore se passa sotto i 300 m sopra di loro.
- **USS Texas**: spara sull'entroterra.
- **Danni alle navi**: le bombe vicine allo scafo le danneggiano; possono prendere fuoco e affondare.
- **Fallimento**: tre trasporti affondati.
- **Secondari**: nessun trasporto perduto; nessun colpo dalle navi amiche.
- **Luce**: tramonto (sole basso a ovest, luce calda, foschia dorata).

Le note storiche complete sono nel briefing di ogni missione. Due precisazioni di coerenza:
- il P-47 è usato solo nella missione d'interdizione terrestre;
- per la copertura bassa della flotta, compito documentato degli Spitfire della RAF, si vola sullo Spitfire IX.

## Missioni pianificate (visibili nel menù, non ancora giocabili)
| Missione | Teatro | Velivolo | Dipendenze |
|---|---|---|---|
| Caccia ai convogli | Francia, estate 1944 | P-47 | nuova mappa con bocage, fattorie, ponti; convoglio con soste e dispersione (già pronta) |
| Cielo d'inverno | Ardenne, dicembre 1944 | P-47 | mappa aerea innevata (la mappa a terra delle Ardenne esiste); la data va scelta dopo il 23 dicembre, quando il cielo si schiarì |
| Caccia ai treni | Europa occidentale, 1944 | P-47 | il treno e la ferrovia esistono già in Normandia; servono galleria e stazione |
| Duello sopra la Germania | Germania, 1944-45 | P-47 e Fw 190 | formazione di bombardieri da scortare: va aggiunto il B-17 o il B-24 (oggi c'è solo il B-26) |
| Caccia ai convogli navali | Norvegia o Paesi Bassi, 1944 | Beaufighter (da aggiungere) | nessun aereo antinave britannico adatto; nuova mappa costiera |
| Attacco al naviglio | Mediterraneo, 1943-44 | da verificare (P-47 o Beaufighter, secondo il reparto scelto) | mappa mediterranea, batterie costiere |
| Scorta di convoglio | da verificare | da verificare | riuso del gruppo navale e degli obiettivi `protect` e `intercept` |

## Test eseguiti (banco di prova senza grafica)
| Test | Risultato |
|---|---|
| Caricamento missione 1 | P-47, mappa Normandia, nessuna portaerei, 4 tappe |
| Caricamento missione 2 | Spitfire IX, gruppo navale di 7 navi, 6 tappe |
| Partenza in volo | P-47 a 520 m sopra la Manica; Spitfire a 420 m |
| Obiettivi, missione 1 | ingresso, identificazione, attacco e rientro completati in sequenza |
| Obiettivi, missione 2 | ingresso, pattuglie, due incursioni intercettate (2 abbattuti, gli altri sganciano e se ne vanno) e rientro completati |
| Eventi e radio | dispersione della colonna (mezzi a 17–24 m dalla strada), avviso di Flak, ponte assegnato; Texas, manovra evasiva della flotta |
| Resoconto | obiettivi spuntati, statistiche, valutazione (missione 1: Buona 82/100; missione 2: Eccellente 92/100) |
| Salvataggio e sblocco | progressi salvati; la missione 2 è bloccata finché non si completa la 1 |
| Briefing nel menù | scheda e mappa operativa corrette (screenshot) |
| Missioni secondarie automatiche e radio estranee | disattivate nella campagna (verificato dallo screenshot) |
| Navi in volo | modelli orientati sulla rotta, scie (screenshot) |
| Altre modalità | Omaha (Alleati e Asse), cecchini, Ardenne, aria libera, mare, Tunisia, Kasserine nei tre modi e il visualizzatore partono senza errori JavaScript |
| Fallimento | perdita del terzo aereo e tre trasporti affondati: missione fallita con il motivo nel resoconto |

**Non eseguiti**:
- partita giocata a mano con mouse e tastiera;
- frasi radio con file personali veri;
- benchmark: il benchmark aereo esistente (Ctrl+Maiusc+B in volo) funziona anche nella campagna, ma qui la grafica è software e gli FPS non hanno valore. I 50 FPS vanno misurati sul tuo PC.

Non fatto in questa fase:
- terreni nuovi e geografie reali: le due missioni usano la mappa della Normandia esistente, con meteo e luce propri;
- le sette missioni pianificate;
- l'atterraggio come obiettivo (il rientro termina in una zona sopra la Manica).
