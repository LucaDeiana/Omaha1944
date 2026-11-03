# Campagna 2.0 — «Theatres of War»

## Architettura
`src/campaign.js` fa da regia **sopra le modalità che esistono già**: non c'è un secondo sistema di combattimento. La campagna:
- sceglie mappa, fazione e difficoltà;
- mette i personaggi nella squadra;
- aggancia i dialoghi alle fasi reali della missione (`MISSION.stage` e `stageT`);
- salva i punti di ripresa;
- riconosce la fine della missione.

Le modalità libere e il multigiocatore non cambiano (verificato dal test).

## Registro dei personaggi
Tutti personaggi di **fantasia** (`fictional: true`), non militari realmente esistiti.

| id | Grado e nome | Ruolo |
|---|---|---|
| edoardo_stara | Captain Edoardo Stara | US Army, comandante di compagnia (via radio) |
| alessio_medda | First Lieutenant Alessio Medda | comandante di plotone (in squadra, Thompson) |
| dominick_ucchesu | Staff Sergeant Dominick Ucchesu | caposquadra (in squadra, Thompson) |
| nino_baker | Technical Sergeant Nino Baker | capocarro Sherman |
| richard_lecca | First Lieutenant Richard Lecca | pilota P-47 USAAF |
| manuel_meloni | Petty Officer First Class Manuel Meloni | US Navy, cannoniere della USS Texas |
| matteo_murtas | Corporal Matteo Murtas | esploratore e cecchino (in squadra, Springfield) |

## Componenti
- **Validazione all'avvio**: id duplicati, personaggi e missioni inesistenti, missioni giocabili senza modalità, personaggi fuori dalle loro missioni.
- **Missioni a dati**: obiettivi legati alle fasi, eventi `[secondi nella fase, personaggio, radio|campo, testo italiano, voce inglese]`.
- **Regia**: i dialoghi partono dagli eventi di gioco (cambio di fase e tempo trascorso nella fase), non da un orologio globale e mai durante il filmato. Le voci passano dal gestore delle voci; un personaggio caduto non parla.
- **Personaggi protetti**: in missione non scendono sotto 12 punti vita; restano feriti e il pannello lo mostra.
- **Pannello di gioco**: titolo, obiettivo corrente (n/N), stato dei compagni con il nome.
- **Menù CAMPAGNA** (menù principale):
  - Continua, Nuova campagna (con conferma se ci sono progressi);
  - elenco missioni per capitolo con stato (bloccata / giocabile / adattata / in preparazione / ✓);
  - difficoltà: Recluta, Regolare, Temprato (nuova), Veterano;
  - progressi;
  - briefing con mappa schematica e nota storica che separa i fatti documentati dalla fantasia.
- **Difficoltà**: nuovo livello Temprato e un moltiplicatore del tempo di reazione dei nemici (`DIFF.react`).

## Salvataggio
- Chiave `localStorage` `fo44_campaign`, versione 1, con missioni completate, punto di ripresa (missione e fase), stato dei personaggi e difficoltà.
- Un salvataggio corrotto o di un'altra versione viene copiato in `fo44_campaign_backup` e si riparte da zero, senza errori.
- Il punto di ripresa si salva all'inizio di ogni fase. Riprendendo, si salta il filmato, il mondo viene portato allo stato della fase (varco nel filo aperto dalla fase 3) e la squadra si mette accanto al giocatore.

## Missioni
Capitoli: Overlord 7, Ardenne 6, Deserto 6, Mare 5 (24 missioni).

**Giocabile completa: Overlord 1 «The Longest Day»** (Omaha, Dog Green):
1. mezzo da sbarco;
2. spiaggia;
3. terrapieno e raggruppamento;
4. Bangalore e varco;
5. assalto alla scogliera;
6. conclusione con salvataggio e sblocco.

Ci sono 9 dialoghi dei personaggi.

**Giocabili adattate**, indicate così nel menù: usano una modalità esistente e aggiungono personaggio, dialoghi e progresso.
- Overlord 6: missione aerea P-47 con Lecca.
- Deserto 3: Kasserine con i carri, con Baker.

**In preparazione (21)**: hanno scheda e briefing, ma **non sono giocabili** e non vengono mai date per completate. Il menù indica cosa manca a ciascuna.

## Test (`tools/ai/tcamp.js`, eseguito: 20/20, due esecuzioni)
- registro, nomi e gradi esatti, personaggi di fantasia;
- validazione pulita, con duplicati e riferimenti mancanti segnalati;
- salvataggio corrotto;
- capitoli 7/6/6/5;
- progressione iniziale;
- avvio della missione 1, squadra con i personaggi e ruoli (Murtas cecchino);
- punto di ripresa a ogni fase e dialoghi emessi;
- personaggio protetto;
- ripresa dalla fase 3 in una nuova pagina tramite «Continua»;
- missione compiuta, salvataggio e sblocco;
- ripristino dei nomi;
- Omaha normale invariata;
- nessun errore JavaScript.

Regressione: `tinf` 20/20, `taudio` 22/22, `t5` senza errori.

Nel test le fasi vengono **forzate**: il test controlla la regia e il salvataggio, non che la missione si possa vincere giocando. La missione intera **non è stata giocata a mano** dall'inizio alla fine.

## Prestazioni
La regia costa un ciclo su una manciata di eventi per fotogramma: non è misurabile. FPS non misurati qui (grafica software).

## Problemi aperti
- Il personaggio non ha un modello dedicato: Stara non è in campo, è via radio.
- La voce inglese dei dialoghi usa la sintesi o le registrazioni del gestore, non un doppiaggio vero.
- Le missioni adattate contano come completate quando la modalità dichiara la vittoria.
- L'equilibrio della difficoltà Temprato non è stato provato giocando.

## Prossimi passi
1. Overlord 2 (Pointe du Hoc), con mappa e scogliera dedicate.
2. Modelli dei personaggi (ufficiale, carrista, pilota, marinaio).
3. Missione navale sulla USS Texas con Meloni.
4. Prova giocata della missione 1 sul tuo PC, con misura degli FPS.
