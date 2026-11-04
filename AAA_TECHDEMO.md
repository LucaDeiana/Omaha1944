# AAA Graphics Test: «Normandy Village — Photorealism Test»

Tech demo grafica **separata dal gioco**: un villaggio normanno di 150 × 150 m, una mattina di giugno 1944. Si esplora a piedi, senza combattimenti.

## Come avviarla
Dal menù principale: **AAA GRAPHICS TEST** → scegli un preset (LOW, MEDIUM, HIGH, ULTRA) → **AVVIA**. Il preset scelto viene ricordato.

Comandi:
| Tasto | Funzione |
|---|---|
| WASD, mouse | Movimento come nel gioco: si entra dalle porte e si sale la scala |
| **P** | Modalità foto: telecamera libera, Spazio/C su e giù, Maiusc veloce, rotella FOV |
| **H** | Nasconde HUD e arma |
| **K** | Salva una foto PNG |
| **B** | Benchmark delle sei inquadrature A–F: tabella a schermo e `window.AAA_BENCH` |
| **Esc** | Pausa e uscita al menù |

## Analisi tecnica iniziale
| Voce | Stato nel progetto |
|---|---|
| Three.js | r128, file locale, script globali senza build |
| Renderer | WebGL2, uscita sRGB, tone mapping ACES (oppure nel color grading quando c'è il post-processing) |
| Ombre | PCF con filtro modificato, due cascate agganciate alla griglia dei texel |
| Luce | Sole direzionale, luce emisferica, mappa d'ambiente dal cielo (PMREM) |
| Post-processing | EffectComposer con bloom, color grading e FXAA. Nella libreria locale non c'è SSAO, e non ne ho aggiunta una |
| Texture | 12 texture fotografiche **CC0 di ambientCG** già nel progetto (`assets/tex_photo.js`), 512 px con colore, normale e rugosità |
| Modelli 3D | Solo corpo umano CC0 e testa scansionata (CC BY 3.0). **Nessun modello di edifici, alberi o oggetti** |
| Rete | Poly Haven e ambientCG **bloccati** in questa sessione: non ho scaricato nulla. Raggiungibili solo GitHub e npm, ma senza fonti affidabili di texture con licenza verificata |
| Scene | Ogni modalità ha costruzione, missione e ciclo propri (`SCEN`). La demo è `SCEN = 'aaa'` |

## Architettura (`src/aaa/`)
- **`mats.js`**: materiali.
  - Texture fotografiche applicate in coordinate del mondo (triplanare) con due scale miscelate (meno ripetizione) e variazione di colore a grande scala.
  - Rugosità dal canale alfa.
  - Umidità, colature e muschio alla base dei muri.
  - **Luce indiretta smorzata dentro le stanze**: gli interni restano in penombra e la luce del sole entra davvero dalle finestre, con le ombre.
  - Vento solo nello shader.
  - Atlante delle foglie (quercia, melo, siepe, edera) disegnato su canvas.
  - Preset.
- **`terrain.js`**: terreno.
  - Altimetria propria con strada fangosa a due solchi e dosso centrale, viottolo con la striscia d'erba, incrocio, aie spianate, terrapieni e fossi del bocage.
  - Mesh da 0,28 a 1 m secondo il preset.
  - Shader con **quattro strati fotografici fusi per altezza**: erba, terra, fango, ghiaia. Il bagnato scurisce e abbassa la rugosità.
  - **Pozzanghere posate nei punti bassi dei solchi**, con bordo sfumato e riflesso del villaggio.
  - Sassi istanziati; anello esterno fino a 1,4 km.
- **`buildings.js`**: edifici.
  - Ogni facciata è un **muro estruso con i fori veri**: spessore, sguanci, interno ed esterno.
  - Telai incassati con croce e vetri riflettenti, davanzali, architravi in pietra o in legno.
  - **Persiane a tavole** con traverse e saetta, **porte a tavole** con soglia.
  - Cantonali sporgenti, zoccolo, marcapiano.
  - **Tetti fatti di tegole o lastre d'ardesia una per una**, con colore variato e muschio sulle file basse; colmo, sottotetto, grondaie e pluviali, comignoli con i vasi.
  - Collider per colonne attorno alle aperture.
- **`veg.js`**: vegetazione.
  - Alberi per ramificazione ricorsiva (tronco curvo e rastremato, rami, schede di foglie) in tre modelli istanziati.
  - **Erba 3D** a ciuffi istanziati.
  - Fiori, siepi del bocage sugli argini con rovi, **edera** sui muri.
  - Ombre delle foglie con la trasparenza.
- **`props.js`**: oggetti collocati a mano.
  - Botti a doghe con cerchi, casse, casse militari, sacchi a terra, **carro con ruote a raggi**, legnaia, secchi, bidoni del latte, attrezzi, balle di fieno, taniche.
  - **Muri a secco pietra per pietra**, cancello, recinzione, **calvario** all'incrocio, cartello.
  - **Sherman** del gioco con sacchi a terra e bagagli.
- **`aaa.js`**:
  - pianta del villaggio;
  - interni (sotto);
  - luce del mattino, foschia, cubemap per i riflessi, fasci di luce, pulviscolo, vento, artiglieria lontana;
  - modalità foto, preset, benchmark, menù.

## Contenuto della scena
- **A — casa normanna a due piani** in pietrame, tetto in coppi muschiati, persiane grigio-azzurre, edera.
  - Interno esplorabile: **cucina** con pavimento in lastre, camino con architrave e paiolo, tavolo con tovaglia a quadri, sedie, credenza con piatti, mensola con barattoli; **stanza** con tavolato, armadio, cassapanca, poltrona; **scala** di legno; **camera** al primo piano con letto, comodino, cassettone.
  - Travi del solaio a vista e trave maestra.
- **B — fienile**: pietrame in basso e tavolato in alto con montanti a vista, ardesia vecchia con muschio, portone aperto. Dentro: pilastri, soppalco con fieno, balle, scala a pioli, attrezzi.
- **C — piccola casa intonacata**, tetto a padiglione in ardesia: architettura diversa dalla A.
- **D — officina di mattoni** con tettoia di lamiera ondulata arrugginita, banco, incudine, bidoni.
- Strada principale, viottolo, incrocio con calvario, cortile murato col cancello, frutteto, bocage, Sherman accanto al muro con sacchi a terra e casse.

## Preset (cambiano davvero il contenuto)
| | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| Qualità del motore | basso (niente ombre né post) | medio | alto | ultra |
| Passo del terreno | 1 m | 0,6 m | 0,4 m | 0,28 m |
| Erba (lame) | — | 24.000 | 70.000 | 150.000 (con ombre) |
| Tegole | grandi | singole | singole | singole |
| Foglie | 45% | 70% | 100% | 130% |
| Sassi | 300 | 1.200 | 2.600 | 4.500 |
| Cubemap dei riflessi | 64 | 128 | 256 | 512 |
| Fasci di luce, pulviscolo | no | sì | sì | sì |
| Area della cascata d'ombra vicina | ±40 m | ±40 m | ±34 m | ±26 m |

## Misure eseguite (Chromium headless con grafica software SwiftShader, 1280×720)
| Preset | Caricamento | Draw call (min–max fra le 7 viste) | Triangoli | Memoria JS |
|---|---|---|---|---|
| LOW | 16 s | 50–128 | 0,47–0,51 M | 98 MB |
| MEDIUM | 28 s | 79–248 | 0,79–1,49 M | 125 MB |
| HIGH | 33 s | 141–304 | 1,80–2,56 M | 141 MB |
| ULTRA | 40 s | 140–305 | 3,13–4,42 M | 159 MB |

- Costruzione della scena: da 3 a 6 s secondo il preset.
- Il benchmark interno funziona: 6 inquadrature con FPS medio, minimo e 1% più lento, frame time, draw call, triangoli.
- **Gli FPS misurati qui non valgono niente** perché la grafica è software. **Il traguardo di 50–60 FPS non è stato verificato**: va misurato sul tuo PC con il tasto B in ciascun preset.

## Test (`tools/ai/taaa.js`, 8/8)
- caricamento senza errori;
- il giocatore compare sul terreno;
- **si entra dalla porta**;
- il muro accanto alla porta blocca;
- **la scala porta al primo piano** (+2,97 m);
- benchmark completo;
- **isolamento**: Omaha resta Omaha;
- nessun errore JavaScript.

Regressione: Colleville 8/8, campagna 20/20, distruzione 24/24.

Durante i test ho trovato e corretto un difetto di collisione vero: un pezzo di collider sbarrava la porta quando sopra c'era una finestra del primo piano.

## Foto (reali, `docs/aaa/`)
- Le sette inquadrature richieste in HIGH: panoramica, facciata, strada, bocage, interno, Sherman, cortile.
- Strada in LOW e in ULTRA, bocage in ULTRA.

## Valutazione onesta rispetto agli obiettivi
- **Raggiunto**:
  - un salto netto rispetto alle mappe del gioco: muri con spessore e aperture vere, tetti a tegole singole, persiane, edera, interni arredati e in penombra con la luce dalle finestre;
  - strada con solchi e pozzanghere, bocage, erba 3D, materiali fotografici con umidità e muschio;
  - preset reali, modalità foto, benchmark, isolamento.
- **Non raggiunto**: la qualità delle immagini di riferimento. Mancano:
  - **modelli professionali** (scansioni o modelli scolpiti di pietre, alberi, mobili, carro, Sherman ad alta definizione), che qui non ci sono e non si potevano scaricare;
  - **texture PBR ad alta risoluzione** (1–2k, con altezza e AO), oggi a 512 px;
  - **occlusione ambientale in tempo reale** (SSAO o GTAO) e **luce indiretta vera**: i fasci dalle finestre sono finti;
  - **fogliame con traslucenza vera e alberi da libreria** (tipo SpeedTree): i miei alberi da vicino restano «a schede»;
  - **animali e particolari minuti** (galline, fiori sui davanzali, tegole rotte, crepe vere nell'intonaco);
  - **lo Sherman è quello del gioco**: geometria semplice, senza dettagli della meccanica.
- Per avvicinarsi davvero alle immagini di riferimento servono, in ordine:
  1. set di texture CC0 a 1–2k (Poly Haven, ambientCG) caricati nel progetto;
  2. un passaggio SSAO o GTAO;
  3. modelli glTF CC0 di alberi, oggetti e mobili;
  4. uno Sherman ad alta definizione;
  5. una misura degli FPS sul tuo PC per decidere quanto portarne nelle mappe principali.


## Aggiornamento: asset CC0 di Poly Haven (4 novembre 2026)
Con l'accesso di rete autorizzato ho scaricato dalle API ufficiali di Poly Haven **18 texture PBR a 1k** e **25 modelli glTF a 1k**, tutti **CC0 1.0** (pubblico dominio). L'elenco con nome, autori e link di ogni asset è in **`assets/aaa/LICENZE.md`**.

**Come sono inclusi**
- Due file JS caricati **solo quando parte la demo**: `assets/aaa/aaa_tex.js` (15 MB) e `assets/aaa/aaa_models.js` (30 MB). Le altre modalità non li scaricano.
- Il motivo: dal file locale il browser non lascia leggere a WebGL immagini e modelli separati, quindi li ho incorporati come per le texture fotografiche già presenti.
- I modelli sono impacchettati in GLB e le loro texture ricompresse: JPEG q80 fino a 1024 px, PNG fino a 512 px se hanno trasparenza.
- Il caricatore glTF è quello di three@0.128.0 (npm, licenza MIT).

**Dove si vedono**
- **Muri**:
  - pietrame della casa e del fienile (`rustic_stone_wall_02`);
  - intonaco su pietra della casetta (`plastered_stone_wall`);
  - mattoni dell'officina (`brick_wall_005`);
  - muri a secco (`castle_wall_slates`);
  - intonaco interno (`worn_mossy_plasterwall`).
- **Legno e metallo**:
  - tavole di porte, persiane e mobili (`old_planks_02`);
  - tavolato del fienile (`raw_plank_wall`);
  - pavimenti (`old_wooden_floor_01`, `slate_floor`);
  - lamiera ondulata (`rusty_corrugated_iron`);
  - ferro (`rusty_metal_02`).
- I materiali usano anche la mappa **AO/rugosità/metallo** di ciascuna texture.
- **Terreno**: erba `leafy_grass`, terra `forest_ground_04`, fango `brown_mud_02`, ghiaia `gravel_road`.
- **Modelli**:
  - botti di legno, cassette, cesto di vimini, secchi di legno, scala a pioli, vanga, accetta;
  - casse militari, cassetta di munizioni, taniche, maschera antigas;
  - tavolo dipinto, credenza, sgabello, lanterna (con una luce calda vera), brocca, pentola smaltata, letto.
- **Vegetazione di dettaglio istanziata**: le varianti dei set di felci, ortiche, ciuffi d'erba, cespugli e sassi muschiati sono sparse ai piedi dei muri, lungo la strada e sul bocage, con una draw call per variante. La quantità dipende dal preset: niente in LOW, 35% in MEDIUM, 60% in HIGH, tutto in ULTRA.

**Scartati perché fuori luogo**
- `Barrel_01`: è un fusto di petrolio rosso moderno.
- `WoodenChair_01`: è una sedia gotica.
- Alcuni modelli troppo pesanti, come `shrub_01` (6,8 MB) e `boulder_01`, o poco utili.
- Non ho trovato su Poly Haven alberi da latifoglia normanni, un carro agricolo o uno Sherman: restano quelli procedurali o del gioco.

**Misure dopo l'aggiornamento** (stesse 7 inquadrature, grafica software)
| Preset | Caricamento | Draw call | Triangoli | Memoria JS |
|---|---|---|---|---|
| LOW | 17,6 s | 66–200 | 0,63–0,93 M | 202 MB |
| HIGH | 32,8 s | 248–532 | 3,1–4,7 M | 242 MB |
| ULTRA | 37,9 s | 274–587 | 5,9–9,1 M | 273 MB |

- La lettura degli asset richiede circa 2,5 s.
- **ULTRA è molto pesante**: fino a 9 milioni di triangoli, perché lì tutta la vegetazione di dettaglio proietta ombre.
- **Gli FPS reali vanno misurati sul tuo PC** con il tasto B.

Foto aggiornate in `docs/aaa/v2/`.

Test: `tools/ai/taaa.js` 8/8 con gli asset caricati.

## Aggiornamento: occlusione ambientale (SSAO)
- Usa il passaggio ufficiale `SSAOPass` di three r128 (npm, licenza MIT), copiato in `assets/lib/three/examples/js/` e caricato **solo nella demo**. Attivo in **HIGH (16 campioni)** e **ULTRA (32)**; spento in LOW e MEDIUM.
- **Prende il posto del passaggio di rendering normale**, perché ridisegna già lui la scena: si evita un disegno doppio.
  - Il buffer della scena è in mezza precisione, quindi tone mapping e color grading restano invariati.
  - Resta comunque un secondo disegno della scena per normali e profondità.
- Foglie, erba, edera e fasci di luce sono **esclusi dalla profondità**: le schede con trasparenza farebbero aloni quadrati.
- **Regolazione verificata guardando il buffer SSAO da solo**:
  - con la camera che arriva a circa 600 m, la soglia minima va tenuta bassissima (0,000005), altrimenti si perdono proprio i contatti sotto i 10 cm;
  - raggio 0,6 m;
  - intensità aumentata con una curva di potenza (2,6) sul risultato sfocato.
- **Effetto visibile**: angoli fra muri e soffitto, giunzioni delle travi, fughe del pavimento, sotto tavolo e sedie, piede dei muri e del fienile. Confronto in `docs/aaa/v2/*_ssao.jpg`.
- **Costo misurato** (draw call dell'inquadratura, grafica software):
  - HIGH: da 250–530 a 320–700;
  - ULTRA: 310–360 nelle viste di facciata e interno, con 7,7–7,9 milioni di triangoli.
- FPS da verificare sul tuo PC col tasto B: se HIGH scende sotto i 50 FPS, l'SSAO è la prima cosa da spegnere.

## Aggiornamento: Sherman
- Vernice verde oliva consumata con ruggine (`green_metal_rust`, Poly Haven, CC0) applicata in triplanare sopra i colori del modello del gioco; fango e umidità in basso sullo scafo.
- Aggiunta al pacchetto anche `metal_plate_02` (non ancora usata).
- Foto: `docs/aaa/v2/HIGH_8_sherman_vernice.jpg`.
- **La geometria resta quella semplice del gioco**: né Poly Haven né ambientCG hanno modelli di carri armati.

## Aggiornamento: foglie e cortecce fotografiche (ambientCG, CC0)
- Le foglie di quercia scansionate (`LeafSet016`) sono **composte in rametti**: tante foglie per scheda, con rotazione, scala e tinta variate, lungo rami disegnati. Un riquadro ciascuno per quercia, albero da frutto e siepe; l'edera resta procedurale.
  - Le foglie disegnate a mano sono sostituite; da vicino si vedono foglie lobate con le venature.
- **Corteccia di quercia** (`Bark012`) con colore, normale, AO e rugosità sui tronchi.
- **Foglie secche cadute** (`LeafSet012`) sotto querce, meli e siepi: 900 in MEDIUM, 2.200 in HIGH, 4.500 in ULTRA, una draw call per variante (8).
- File `assets/aaa/aaa_leaf.js` (1,7 MB), caricato solo nella demo. Licenze in `assets/aaa/LICENZE.md`.
- Foto: `docs/aaa/v2/*_foglie.jpg`.

## Ottimizzazione dopo la prima misura sul PC dell'utente
**Misura riportata dall'utente**: ULTRA 15–19 FPS, MEDIUM 30–35 FPS. Il traguardo dei 50 FPS non era raggiunto.

**Analisi dei costi**, triangoli per categoria misurati nella scena:
- **Ombre ridisegnate a ogni fotogramma**: tutta la scena di nuovo, a ogni frame in ULTRA e a frame alterni in MEDIUM, più una cascata lontana.
- **ULTRA**:
  - terreno a 0,28 m: 720.000 triangoli;
  - ciuffi d'erba e ortiche dettagliati: oltre 800.000;
  - erba procedurale: 450.000;
  - passaggio SSAO, che ridisegna la scena.
- **Tronchi**: 227.000 triangoli, quasi tutti rametti dentro i cespugli della siepe, invisibili.

**Interventi**
- **Ombre statiche**: una sola mappa (2048 in MEDIUM, 4096 in HIGH e ULTRA) su tutto il villaggio (176 × 176 m), calcolata al caricamento perché la scena è ferma. **Niente cascata lontana.**
  - Le ombre delle foglie non seguono il vento: è il compromesso accettato.
- **Terreno**: 0,7 m in MEDIUM, 0,5 m in HIGH, 0,4 m in ULTRA (prima 0,6 / 0,4 / 0,28).
- **Erba procedurale**: 16.000 / 40.000 / 80.000 lame (prima 24.000 / 70.000 / 150.000).
- **Vegetazione dettagliata**: 15% / 30% / 50% (prima 35% / 60% / 100%).
- **Foglie degli alberi**: 85% in HIGH, 110% in ULTRA.
- **Cespugli della siepe senza tronco.**
- **Risoluzione interna**: al massimo 1 in MEDIUM e HIGH, 1,25 in ULTRA. Prima ULTRA arrivava a 2 sugli schermi ad alta densità.
- **SSAO solo in ULTRA**, con 16 campioni.

**Confronto** sulle stesse inquadrature, grafica software: vale solo come rapporto, non come FPS.

| Vista | Preset | Prima | Dopo |
|---|---|---|---|
| Panoramica | MEDIUM | 2.082 ms | 778 ms |
| Panoramica | ULTRA | 2.477 ms | 2.343 ms |
| Cortile | ULTRA | 3.222 ms | 258 ms |

La panoramica in ULTRA resta la vista più pesante: SSAO e chiome viste tutte insieme.

**Da rimisurare sul tuo PC** con il tasto B, in ciascun preset.

## Seconda misura dell'utente e blocchi spaziali
**Misura dell'utente dopo l'ottimizzazione precedente**: ULTRA circa 30 FPS (prima 15–19), MEDIUM circa 50 (prima 30–35).

**Difetto trovato**: le istanze di alberi, erba e piante usavano come volume di visibilità la sfera del singolo modello, centrata nell'origine del mondo. Il motore quindi non scartava quelle fuori dall'inquadratura, e in teoria poteva anche nasconderle per errore.

**Correzione** (`aaaChunkAll`, `aaaChunkTick`):
- Ogni gruppo di istanze è diviso in blocchi spaziali, con limiti veri:
  - alberi e siepi in celle da 40 m;
  - erba, vegetazione di dettaglio e piccoli oggetti in celle da 22 m.
- **Distanza massima di disegno**, dove la foschia li copre già:

  | | MEDIUM | HIGH | ULTRA |
  |---|---|---|---|
  | Erba | 32 m | 42 m | 55 m |
  | Vegetazione di dettaglio | 45 m | 60 m | 75 m |
  | Sassi e foglie cadute | 35 m | 45 m | 60 m |

- Durante il calcolo delle ombre statiche tutto resta visibile, così le ombre sono complete.

**Triangoli disegnati** (tre inquadrature): MEDIUM 0,8–1,1 M (prima circa 1,5), HIGH 1,2–1,5 M, ULTRA 3,0–3,8 M compreso il passaggio SSAO. Draw call fra 240 e 800.

## Limiti tecnici
- Gli edifici hanno collider allineati agli assi.
- Il frontone ha un collider approssimato.
- L'erba 3D copre tutta la mappa senza chunk dinamici: in ULTRA sono 150.000 lame.
- I riflessi delle pozzanghere vengono da una cubemap fissa presa dalla strada, non sono riflessi in tempo reale.
- Uccelli e fruscio delle foglie mancano: non ci sono suoni adatti nel progetto e non li ho sintetizzati. Ci sono vento e artiglieria lontana.
