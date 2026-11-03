# Audio 4.0

## Analisi del codice
- **Motore** (`src/audio.js`): un solo `AudioContext`, catena uscita → filtro «ovattato» → compressore morbido → volume generale → limitatore; riverbero a convoluzione; massimo 64 voci contemporanee, con il suono più debole interrotto quando si supera il limite.
  - `play()`: suoni brevi spaziali (volume, panning, filtro con la distanza, ritardo del suono, eco sulla scogliera);
  - `loopSound()`: suoni continui (motori, cingoli, ambiente) con volume, panning, velocità di lettura e filtro aggiornati in modo graduale;
  - `shout()`: grida dei soldati (file registrato, sintesi vocale del browser o urlo sintetico).
- **Audio personali** (`src/customaudio.js`, catalogo in `assets/audio_manifest.js`): file in `local-assets/audio` (esclusi da git), caricati una volta, con varianti a rotazione e ritorno al suono originale.
- **Musica** (`src/music.js`) e introduzione (`src/intro.js`): elementi audio HTML, separati.
- **Rete**: gli spari dell'IA arrivano ai client come eventi (`netAIShot`); le voci non viaggiano in rete. Ogni computer decide le proprie, e solo l'host fa girare l'IA che le chiede.
- Nessun `THREE.Audio`/`PositionalAudio`, nessun `ScriptProcessorNode` né `AudioWorklet`.

### Campioni
| Origine | Contenuto | Licenza documentata (README) |
|---|---|---|
| `assets/sfx_samples.js` | spari di Garand, Kar98k, Springfield, Thompson, MP 40, BAR, MG 42, Colt (3–5 varianti) | The Free Firearm Sound Library, CC0 |
| `assets/sfx_war.js` | cannoni, artiglieria, esplosioni, sirene, motori d'aereo, risacca, incendio, siluro, sirena di bordo, colpo in acqua, impatto metallico | Internet Archive «Red Library», «GOLD TAPE», «SSE Library», OpenGameArt, CC0 |
| sintesi in `buildBank()` | tutto il resto, vedi sotto | — |

Non ho potuto ascoltare né analizzare i file vocali scaricati da te: stanno in `local-assets`, che non è nel repository. Ora li analizza il gioco al caricamento (vedi «Qualità delle registrazioni»).

## Bug trovati e cause
| Bug | Causa | Correzione |
|---|---|---|
| **«OPEN FIRE!» ripetuto di continuo** | La frase non è tra quelle del gioco, quindi è un tuo file registrato per una categoria di grida. I file registrati partivano **prima** di qualunque controllo: le attese (9 s per la stessa frase, 2,5 s fra due frasi) valevano solo per la sintesi vocale. In più ogni soldato gridava «fuoco» o «avvistato» quando cambiava bersaglio, con un'attesa solo personale: con centinaia di soldati qualcuno gridava sempre. | Gestore centrale delle voci (sotto). «Aprite il fuoco» ora è un ordine del comandante, detto una volta per ogni nuovo contatto della squadra. |
| **Motore degli aerei che si spegne e riparte** | Il motore usa una registrazione reale di 8 s (la stessa per P-47, Fw 190 e bombardiere). Era ripetuta **grezza**, con i suoi cali di volume (nel punto più debole il 5% della media) e un salto alla giunzione ogni 8 s. La giunzione sfumata veniva preparata per il motore sintetico, che però era poi sostituito dalla registrazione. Anche il motore sintetico, se usato, durava 1 s con una giunzione che pulsava ogni 0,75 s. | Dalla registrazione si prende il tratto più costante (fino a 3 s) e lo si chiude ad anello con una dissolvenza a potenza costante: punto più debole al 77% della media invece del 5%. I motori sintetici (carri, barche) ora durano 4 s, con frequenze che compiono cicli interi, quindi senza salti alla giunzione. |
| Loop da file personale con buchi | I file personali dei suoni continui erano ripetuti con i silenzi iniziali e finali; anche il cambio a caldo dopo il caricamento usava il file grezzo. | `loopify`: silenzi tolti e fine sfumata nell'inizio, in memoria (il file resta intatto). |
| P-47 e Fw 190 identici | Stessa registrazione (secondo i crediti è un P-51 in linea). | Regime diverso (P-47 ×0,9, R-2800 a 18 cilindri; Fw 190 ×1,1, BMW 801 a 14 cilindri) finché non ci sono registrazioni proprie; i file `aircraft.p47.engine` e `aircraft.fw190.engine` hanno la precedenza. |
| Frase «Fire in the hole!» usata come «aprite il fuoco» | Categoria `fire` americana con un solo significato (esplosivo). | Nuove categorie americane: `openfire` («Open fire!», «Fire at will!», «Let 'em have it!»), `spot` («Contact front!», «Enemy spotted!», «Krauts, up ahead!», «There, by the hedgerow!»), `fallback`. |

## Gestore centrale delle voci (`shout` in `src/audio.js`)
Ogni grido è un evento, con categoria, priorità, parlante, squadra e identificativo. Passa da qui qualunque sia la riproduzione: file registrato, sintesi del browser o urlo sintetico.

Priorità e attese per categoria:

| Priorità | Categorie e attese (valgono in tutta la battaglia, per lingua) |
|---|---|
| Critica | granata 4 s, mortaio 6 s |
| Alta | avvistamento 10 s, apertura del fuoco 14 s, riparo 8 s, ripiegamento 12 s, aerei 14 s |
| Media | movimento 8 s, soccorso 7 s, ricarica 9 s, «tenete la posizione» 18 s |
| Bassa | uccisione 12 s |

La richiesta viene scartata se:
- il parlante è morto;
- è troppo lontano;
- la categoria è stata detta da poco;
- lo stesso soldato ha parlato meno di 12 s prima;
- la stessa squadra ha dato lo stesso ordine meno di 25 s prima;
- lo stesso evento è già stato annunciato;
- c'è già una voce più importante o più vicina in corso (al massimo 2 insieme).

Altre regole:
- chi muore mentre parla viene zittito;
- le varianti dei file personali ruotano senza ripetere subito la stessa;
- le frasi della sintesi vocale sono scelte a caso tra quelle della categoria;
- durante un ordine importante vicino, armi, esplosioni e mezzi si abbassano di 3,5 dB.

Collegamenti con l'IA della fanteria:

| Voce | Quando |
|---|---|
| Avvistamento | il soldato nota un nemico nuovo |
| «Contatto» e «aprite il fuoco» | il comandante, una volta per episodio di contatto |
| «Ripiegate» | al ripiegamento della squadra |
| «Muovetevi» | al fiancheggiamento e al supporto |
| Nuovo comandante | alla successione |

Le grida del codice esistente ora indicano chi parla.

## Qualità delle registrazioni (file personali)
Al caricamento ogni file viene analizzato (in memoria, i file non vengono toccati) e classificato:
- **KEEP**: va bene così;
- **CLEANUP**: recuperabile;
- **REPLACE**: da sostituire.

Cosa misura:
- picco e distorsione;
- volume della parte utile;
- silenzi alle estremità;
- rapporto segnale/rumore, misurato nelle pause;
- se la registrazione è ovattata;
- frequenza di campionamento.

Voci, annunci e radio non «KEEP» vengono ripuliti leggermente: silenzi tagliati, con 30 ms di margine, e picco portato a −1 dBFS con un limitatore morbido. Niente riduzione del rumore aggressiva, perché su fruscio forte peggiora la voce.

Il rapporto si legge nella console del browser all'avvio e nel debug audio. I file classificati REPLACE vanno sostituiti: nessun filtro li rende buoni.

## Mixaggio, spazio, debug
- **Bus**: armi, voci, esplosioni, carri e navi, aerei, ambiente, altri effetti. Ognuno ha il suo volume in Impostazioni → Volume → «Mixer audio» (salvato con le impostazioni), prima del compressore e del limitatore comuni.
- **Occlusione**: un edificio o un muro fra la camera e la sorgente rende il suono più basso (×0,6) e più ovattato (filtro ×0,3). Si fa un raggio per cella di 10 m, riusato per 0,5 s; spenta in volo e in mare.
- **Debug audio (Ctrl+Maiusc+U)**:
  - ultime voci richieste, con esito e motivo dello scarto (per «aprite il fuoco» si vede esattamente chi l'ha chiesto e perché è stato detto o scartato);
  - contatori per categoria;
  - loop attivi, con file personale o di base, ricostruzioni, volume, velocità e filtro;
  - motore del giocatore, con ricostruzioni e velocità di lettura;
  - rapporto di qualità dei file personali;
  - suoni più frequenti nell'ultimo secondo.

## Test (`tools/ai/taudio.js`, orologio delle voci simulato)
| Test | Risultato |
|---|---|
| «Open fire» chiesto 600 volte in 60 s di combattimento | detto 1 volta |
| Nuovo ordine distinto | detto di nuovo |
| Stesso evento | scartato |
| 100 soldati che chiedono avvistamenti per 60 s | 6 frasi dette su 600 richieste |
| Soldato morto | non parla; voce interrotta se muore mentre parla |
| Priorità | bassa scartata con una voce in corso, granata (critica) passa |
| Varianti | 4 frasi diverse in 20 avvistamenti |
| Loop dei motori | P-47 e Fw 190: punto più debole 77–84% della media (prima 5%), giunzione 85–97%; Sherman sintetico 59–64% (pulsazione voluta dei cilindri) |
| Loop da file personale con 0,5 s di silenzi | silenzi tolti, 0,4% di campioni muti |
| Motore del P-47 per 3 minuti con manetta variabile e 18 cambi di visuale | stessa sorgente audio, 0 ricostruzioni, nessun salto brusco della velocità di lettura |
| Qualità su segnali preparati | pulito → KEEP; fruscio forte → REPLACE; distorto → REPLACE; ovattato → CLEANUP; con silenzi → CLEANUP; pulizia: 2,0 s → 0,8 s |
| Mixer | ogni suono nel suo bus; volume delle armi al 40% applicato |
| Occlusione | dietro una casa: filtro 4.100 Hz; allo scoperto: 7.800 Hz |

**Prestazioni** (battaglia di Omaha, 60 s simulati, senza altri processi in parallelo):
- IA e gioco: 5,4 ms per fotogramma, contro 5,3 prima delle modifiche audio;
- occlusione: 12–14 raggi al secondo;
- voci: 11 richieste e 3 dette in un minuto (le altre scartate perché lontane, già dette o con un'altra voce in corso).

**Regressione**: tutte le modalità e il visualizzatore partono senza errori.

## Suoni sintetici ancora presenti (da sostituire con registrazioni quando disponibili)
| Suono | Uso | Giudizio |
|---|---|---|
| `crack`, `whiz`, `ricochet` | proiettili vicini e rimbalzi | accettabili, brevi |
| `imp_sand/flesh/wood/stone`, `bodyfall`, passi | impatti e passi | accettabili |
| `mag_out/in`, `bolt_open/close`, `clip_in`, `dry`, `pin`, `tink` | meccanismi delle armi | **artificiali**: servono registrazioni di Garand (incluso il «ping» della lastrina), Kar98k, MP 40, Thompson |
| `rifle_far`, `mg_far`, `smg_far`, `flak_far` | spari lontani | accettabili come coda |
| `mortar`, `bomb`, `rocket`, `whistle` (dove non sostituito) | artiglieria | migliorabili |
| `scream`, `groan`, `yell`, `wail` | urla a formanti | **robotici**: da sostituire con registrazioni (o lasciare silenzio) |
| `eng_sherman`, `eng_pz4`, `eng_tiger`, `eng_boat`, `tracks`, `turret`, `tank_gun`, `reload_clank`, `clang` | carri e barche | **sintetici**: servono registrazioni di motori radiali e V12, cingoli, torretta, 75 e 88 mm |
| `wind`, `battle` | ambiente | accettabili come fondo |

Sostituire uno di questi suoni non richiede codice: basta il file nella cartella degli audio personali (`local-assets/audio/…`, percorsi in `CUSTOM_AUDIO_GUIDE.md`).

**Asset mancanti** (servono registrazioni libere o tue):
- voci americane e tedesche recitate (le categorie sono nel catalogo);
- motori distinti di P-47 (R-2800) e Fw 190 (BMW 801), con avviamento e spegnimento;
- meccanismi delle armi;
- carri e cingoli;
- ambienti per teatro (campagna normanna, foresta invernale, deserto).

Non ho scaricato audio da internet.

## Non fatto
- **Macchina a stati completa del motore degli aerei**: avviamento, regimi a strati e spegnimento, con crossfade fra campioni. Oggi c'è un solo loop continuo che segue la manetta; i campioni a strati non esistono ancora.
- **Doppler e audio LOD dei motori lontani**: c'è una lieve variazione d'intonazione con l'avvicinamento, già esistente.
- **Ambienti diversi per teatro**: servono campioni.
- **Test di ascolto reali**: i test qui misurano il segnale; l'ascolto va fatto sul tuo computer.
  - Motore del P-47 per 3 minuti a regime costante, poi con la manetta che sale e scende, poi cambiando visuale con V.
  - Battaglia a Omaha per un minuto, controllando che le voci non si ripetano (Ctrl+Maiusc+U mostra cosa viene detto e cosa scartato).
- **Prova di rete con due computer**: le voci non viaggiano in rete, quindi non possono duplicarsi via rete; non provato su due computer.
