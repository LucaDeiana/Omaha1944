# Solo cecchini 2.0

## Analisi del codice prima delle modifiche
Già presenti e funzionanti (non riscritti):
- **Bersagli**: sfere agganciate alle ossa dello scheletro (`HITZ` in `src/weapons.js`), quindi seguono le animazioni; zone testa, torace, braccia, gambe.
- **Danni** (`snpDamage`): testa sempre letale, torace con il danno pieno del fucile (letale), braccia 40 e gambe 45 (non letali).
- **Mira** (`src/snp/combat.js`): ingrandimenti storici delle ottiche, oscillazione per postura, fiato dopo la corsa e ferite, respiro trattenuto con Maiusc (durata limitata e recupero), sporgersi con Q/E senza entrare nei muri.
- **Fucili**: caratteristiche diverse (danno, cadenza, caricatore, ottica) in `WEAPONS`.
- **Bot** (`src/snp/bots.js`): 5 livelli di difficoltà e 5 personalità (cauto, aggressivo, paziente, mobile, opportunista); stati PATROL, OBSERVE, SEARCH, INVESTIGATE, AIM, FIRE, RELOAD, TAKE_COVER, REPOSITION; postazioni con prenotazione (`post.occ`) e punteggio; percezione con linea di vista vera (`snpTrace`), memoria, reazione ai colpi vicini (`snpNearMiss`), cambio di postazione dopo alcuni colpi.
- **Confine centrale** (No Cross): rispettato da giocatore e bot; punti di rinascita lontani dall'ultima morte.
- **Multigiocatore**: l'host decide le uccisioni e rimanda il tabellone; migrazione dell'host.

Incompleti o mancanti: killcam, annunci con contatori distinti e priorità (prima solo da file personali), scritte a schermo, killfeed strutturato, statistiche (solo uccisioni e morti), classifica con punti e K/D, premi di fine partita, protezione allo spawn, opzioni killcam, annunci e solo headshot, convalida delle uccisioni in rete, benchmark.

## Cosa è stato aggiunto
- `src/snp/events.js`:
  - **evento di uccisione unico** (`snpKillEv`): punti, statistiche, serie, annunci e killfeed passano da qui; doppioni scartati (la stessa vittima non cade due volte in meno di 1 s);
  - **statistiche**: colpi, a segno, precisione, headshot, headshot di fila, uccisioni, morti, K/D, serie migliore, colpo più lungo, vita media, fucile preferito, punti (100 per uccisione, +50 alla testa, fino a +50 per la distanza);
  - **annunciatore** con tre contatori separati: headshot letali entro 12 s (HEADSHOT, DOUBLE, TRIPLE, MULTI HEADSHOT), uccisioni entro 4 s (DOUBLE, TRIPLE, MULTI KILL), serie senza morire (KILLING SPREE 5, RAMPAGE 10, DOMINATING 15, UNSTOPPABLE 20); soglie in `SNP_AN_CFG`;
  - **priorità e coda**: con più annunci nello stesso istante parte solo il più importante; mentre parla, al massimo uno in coda (il più importante); la morte svuota la coda;
  - **voce**: file personale `sniper/announcer/<nome>.flac|wav|ogg|mp3` se presente, altrimenti la voce sintetica del sistema (nessun audio di altri giochi);
  - **scritta centrale** animata (scala, dissolvenza), colore per tipo, sopra il reticolo;
  - **killfeed**: `Tiratore [Fucile · HEADSHOT · 214 m] Vittima`, massimo 5 righe, scadono dopo 6,5 s;
  - **classifica (Tab)**: per squadra punti, uccisioni, morti, headshot, U/M, serie migliore, ping; giocatori e bot per squadra, tempo rimanente; aggiornata 4 volte al secondo solo quando è aperta;
  - **fine partita**: miglior giocatore, miglior cecchino (colpo più lungo), più headshot, serie migliore, più preciso, statistiche personali, classifica finale;
  - **protezione allo spawn** di 2,5 s, che termina al primo colpo sparato.
- `src/snp/killcam.js`:
  - registrazione circolare di 6 s a 15 campioni al secondo (posizione, orientamento, mira, postura, fucile) di giocatore e bot, più i colpi (origine, impatto, vittima, zona);
  - replay della propria eliminazione: occhi del tiratore con l'ingrandimento quando mirava, rallentatore attorno allo sparo, camera sul proiettile **solo se il colpo che ha ucciso è stato registrato**, impatto da vicino; in solitario i bot vengono rimessi dove erano e la vittima ha un corpo;
  - senza dati del tiratore: scheda «ELIMINATO» con la scritta «replay non disponibile», nessuna sequenza inventata;
  - Spazio per saltare; durata 3, 4 o 5 s oppure disattivata; il tempo della killcam si scala dall'attesa di rinascita.
- **Opzioni di partita** nel menù: killcam (durata o disattivata), annunci vocali (attivi o solo a schermo), regole (normali o solo headshot), fine partita (25, 50 o 100 uccisioni; 10, 15 o 20 minuti).
- **Rete**: l'host convalida le uccisioni dichiarate dai client (tiratore esistente e vivo, squadra opposta, distanza fino a 900 m, nessun muro pieno sulla linea di tiro, non due uccisioni in 0,6 s dallo stesso tiratore); quelle non plausibili diventano «caduto» senza punti. Killfeed e annunci dei client arrivano dagli eventi confermati dall'host; il tabellone trasmette anche punti, headshot, serie, colpo più lungo, colpi e colpi a segno.
- `src/snp/bench.js`: benchmark in partita (**Ctrl+Maiusc+B**).

## Test eseguiti (banco di prova senza grafica)
| Test | Risultato |
|---|---|
| Colpo alla testa a 60 m (giocatore → bot) | uccisione, zona testa |
| Colpo al torace a 60 m | uccisione |
| Solo headshot: colpo al torace | nessun danno |
| HEADSHOT, DOUBLE, TRIPLE HEADSHOT | annunci corretti |
| Uccisioni ravvicinate e serie | KILLING SPREE alla 5ª, RAMPAGE alla 10ª (hanno la precedenza su DOUBLE KILL) |
| Azzeramento della serie alla morte | serie 0 |
| Tre uccisioni nello stesso istante | un annuncio subito, uno in coda (il più importante) |
| Doppione della stessa uccisione | contata una volta |
| Killcam con dati (bot alla testa del giocatore) | replay 5,1 s, colpo registrato, camera sul proiettile, poi rientro |
| Killcam senza dati | scheda «ELIMINATO», 2,2 s, nessun replay |
| Salto con Spazio | killcam chiusa |
| Rientro dopo la killcam | vivo, protezione attiva |
| Classifica | righe di entrambe le squadre, punti e statistiche |
| Confine centrale, 60 s con 8 bot | nessun bot oltre la linea |
| Bot in postazione | tutti in postazione, in osservazione |
| Avvio delle altre modalità | nessun errore JavaScript |

Non eseguiti: colpo alle gambe (nel punto di prova un ostacolo basso fermava il colpo), audio personale reale degli annunci, partita multigiocatore con due computer, prestazioni sul PC dell'utente. Colpo alla testa non letale: con le regole attuali la testa è sempre letale, quindi non esiste; il sistema registra la zona e annuncia solo headshot letali.

Benchmark in gioco eseguito qui solo sul codice nuovo: funziona in tutti gli scenari, ma con la grafica software va a 0,2–1,3 FPS e quei numeri non hanno valore (draw call 350–410, IA dei bot 1–6 ms su pochissimi fotogrammi). Il confronto con il codice precedente non è riuscito: il browser senza grafica è andato in timeout.
