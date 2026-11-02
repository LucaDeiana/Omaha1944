# Combattimento aereo 2.0

## Analisi del codice prima delle modifiche
- **Aereo del giocatore** (`src/aircraft.js`, `updatePlane`): fisica vera (portanza con stallo a ~17°, resistenza parassita e indotta, spinta a potenza costante, gravità), ma passo di simulazione variabile e una sola costante di rollio per tutti; P-47 e Fw 190 si differenziavano solo per massa, superficie e un fattore di agilità; il Fw 190 non era pilotabile.
- **Aerei dell'IA** (`huntPlayer`, `wingmanAI`): nessuna fisica, la velocità veniva ruotata verso il bersaglio a velocità angolare fissa; nessuna perdita di energia in salita o in virata; mira con anticipo già presente (`airLeadPoint`) ma munizioni infinite.
- **Danni**: barra unica per l'IA con esito dell'abbattimento tirato a sorte; per il giocatore quattro parti (motore, ali, impennaggi) scelte a caso, non dal punto colpito.
- **Proiettili** (`src/ballistics.js`): veri, con tempo di volo, caduta e rallentamento; traccianti in un'unica InstancedMesh (già efficiente).
- **Multigiocatore**: non sincronizza gli aerei → nessun rischio per la rete.

## Cosa è cambiato
- `src/aircombat.js` (nuovo):
  - configurazione centralizzata per P-47D-25 e Fw 190 A-8 (massa, superficie, rollio, beccheggio, carico massimo, velocità limite, resistenza, armi con munizioni, resistenza dei componenti); gli altri aerei ricavano i valori dalla loro scheda;
  - volo dell'IA a massa puntiforme con spinta, resistenza, portanza e gravità: perde velocità in salita e in virata, la guadagna in picchiata, stalla sotto la velocità minima;
  - controllore che porta il vettore portanza sul punto voluto (rollio, poi trazione) con limiti di rollio e di carico;
  - pilota tattico a stati (PATROL, SEARCH, INTERCEPT, PURSUIT, ATTACK, EVADE, REPOSITION, RETREAT, RETURN, CRITICAL) a 5 Hz, sfalsato fra gli aerei, con tempi minimi negli stati (isteresi);
  - manovre eseguite dal modello di volo: break, tonneau, split-S, Immelmann, forbici, high e low yo-yo, boom and zoom dei caccia pesanti;
  - percezione limitata: ultima posizione nota, settore di coda controllato solo a volte, tempo di reazione;
  - bersagli distribuiti (penalità per i bersagli già attaccati, aiuto ai compagni inseguiti, il secondo cacciatore arriva da un lato diverso);
  - mira con anticipo e errore per difficoltà, raffiche con pause, munizioni contate, inceppamenti con armi danneggiate;
  - danni per componente dal punto d'impatto: motore, ali, alettoni, timone, elevatore, serbatoi, armi, fusoliera; proiettili esplosivi con schegge;
  - abbattimenti diversi: ala staccata (vite), pilota colpito (picchiata), incendio (spirale che può esplodere), motore fermo (planata e atterraggio di fortuna), esplosione in volo, schianto;
  - evitamento del terreno: previsione della traiettoria e quota necessaria alla richiamata (raggio di virata, tempo per raddrizzarsi), più un controllo a ogni fotogramma vicino al suolo; da rovescio spinge invece di tirare;
  - difficoltà dal menù (Recluta, Regolare, Veterano): reazione, errore di mira, cono di tiro, manovre disponibili, controllo della coda, gestione dell'energia, errori; la robustezza degli aerei non cambia.
- `src/aircraft.js`: passo fisico fisso di 1/120 s per il giocatore; rollio e beccheggio dalla configurazione (Fw 190 ~150°/s, P-47 ~93°/s); stallo con caduta d'ala, scossone e avviso; comandi duri e vibrazioni vicino alla velocità limite; danni del giocatore dal punto d'impatto (incendio dei serbatoi possibile); resistenza parassita ridotta e potenza ricalibrata (stessa velocità massima, ma la salita costa velocità).
- `src/planes2.js`: Fw 190 A-8 pilotabile (4 × MG 151/20 e 2 × MG 131).
- `assets/audio_manifest.js`: per ogni aereo anche cannoni, avviamento, passaggio ravvicinato, colpi sulla lamiera, incendio, esplosione (file personali con ritorno ai suoni originali).
- `src/airbench.js` (nuovo): benchmark in gioco, **Ctrl+Maiusc+B** in volo (o `airBench()` in console): sei scenari, FPS medi e minimi, 1% low, tempo per fotogramma, draw call, triangoli, tempo di calcolo di aerei ed effetti.

## Test eseguiti (simulazione passo per passo, senza grafica)
| Test | Risultato |
|---|---|
| Salita a 30° (P-47) | 540 → 503 km/h in 5 s |
| Picchiata a 35° | 540 → 671 km/h in 5 s |
| Virata stretta | 576 → 428 km/h, 5,8 G |
| Stallo a bassa velocità | si attiva, avviso «STALLO» |
| Rollio 90° | P-47 0,97 s · Fw 190 0,60 s |
| Inseguimento e attacco IA | si avvicina, attacca, spara, scavalca, si riposiziona, torna |
| Evasione IA | break, tonneau, split-S scelti secondo quota e velocità |
| Evitamento del terreno | picchiata da 400 m: vivo, quota minima 227 m |
| Colpi sull'ala sinistra | ala sx 37%, ala dx e motore intatti; altri colpi → ala staccata |
| Danni al motore | motore 0, fumo, motore fermo, stato CRITICAL |
| Danni ai comandi | elevatore al 10% |
| Incendio | brucia e consuma la fusoliera |
| 4 contro 4 per 60 s (3 prove) | entrambe le parti sparano e colpiscono; abbattimenti per incendio, ala, esplosione; 1 schianto al suolo in 3 prove |
| Avvio di tutte le modalità | nessun errore JavaScript |

Non eseguiti qui: audio personale reale per i nuovi eventi aerei, prestazioni sul PC dell'utente, prova pilotando a mano.

## Prestazioni
Costo misurato dell'IA: **0,06–0,10 ms per fotogramma con 8 caccia** (circa l'1% di un fotogramma a 60 FPS).
Il benchmark grafico in questo ambiente (senza scheda video) non è significativo; ha però rivelato che in volo ogni fotogramma disegna circa **7 milioni di triangoli** e ~950 draw call, quasi tutti di paesaggio: è il primo punto da ottimizzare se sul PC non si arriva a 50 FPS.
