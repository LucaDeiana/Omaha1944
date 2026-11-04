# Graphics Benchmark Lab 1.0 (tech demo AAA)

## Analisi iniziale
- **Modalità**: `SCEN = 'aaa'` (`src/aaa/*`). Si apre dal menù principale e si chiude ricaricando la pagina, quindi tutte le risorse GPU vengono distrutte insieme al contesto WebGL.
- **Renderer**: Three.js r128, WebGL2.
  - Senza post-processing: tone mapping ACES.
  - Con post-processing (MEDIUM, HIGH, ULTRA): EffectComposer con rendering della scena oppure SSAOPass, bloom, color grading, FXAA.
- **Ciclo di rendering**: `frame()` in `src/main.js`, con requestAnimationFrame.
- **Preset**: `AAA_PRESETS` in `src/aaa/mats.js`, combinati con `QUALITY` del motore attraverso `aaaQ()`.
- **Ombre**: statiche, una sola mappa sul villaggio, nessuna cascata lontana.
- **Vegetazione**: istanze divise in blocchi con distanza massima (`aaaChunkAll`).
- **Strumenti già presenti**:
  - contatore FPS del motore (`FPS.v`);
  - benchmark semplice della demo (tasto B, 6 inquadrature): **sostituito**, ora B avvia il benchmark del laboratorio;
  - risoluzione dinamica del motore (`SETTINGS.dynres`), che **abbassa la risoluzione quando gli FPS calano**.

  Quest'ultima falsa i confronti, quindi il laboratorio la sospende durante le misure e la ripristina alla fine. Probabilmente ha influito sulle misure fatte prima del laboratorio.

## Come si usa
| Tasto | Funzione |
|---|---|
| **F8** | Overlay discreto, aggiornato 4 volte al secondo |
| **F9** | Pannello GRAPHICS BENCHMARK LAB (il mouse si libera) |
| **B** | Avvio rapido del benchmark |
| **Esc** | Durante il benchmark, lo interrompe |

**Overlay F8** mostra:
- FPS smussati e media degli ultimi 10 s;
- frame time medio e massimo, 1% low;
- tempo CPU JavaScript; tempo GPU solo se disponibile;
- draw call, triangoli, geometrie, texture;
- memoria JS, tempo di caricamento, preset, risoluzione interna e DPR;
- costo del profiler;
- indicatore del budget di 20 ms, che distingue un **superamento persistente** (P95 degli ultimi 5 s oltre 20 ms) da un **picco isolato**;
- grafico degli ultimi 60 s con le linee a 16,7, 20 e 33,3 ms.

**Pannello F9**, sezioni:
1. Live Metrics.
2. Run Benchmark: durata 20–120 s (60 di base), percorso A–H, interruzione, **tutti i preset in sequenza** (la pagina si ricarica da sola per ciascun preset).
3. Graphics Presets: cambio preset con ricarica e ripartenza automatica.
4. Feature Isolation: interruttori reversibili e misura del costo di ogni effetto.
5. Results: tabella, confronto fra due esecuzioni, grafici.
6. Export: JSON, CSV, foto di confronto.
7. Diagnostics: wireframe, blocchi e limiti, collider, conteggi, test di accumulo.

## Metodo
- **Frame time osservato**: intervallo fra due fotogrammi consecutivi (requestAnimationFrame), in un buffer circolare di 8.192 campioni.
- **Tempo CPU**: durata del lavoro JavaScript del fotogramma, cioè aggiornamento più invio dei comandi di disegno. **Non è il tempo GPU.**
- **Tempo GPU**: misurato solo se il browser espone `EXT_disjoint_timer_query_webgl2`, con interrogazioni asincrone e scarto dei risultati «disjoint». Altrimenti è indicato come **non disponibile**: Chrome lo disattiva spesso.
- **Statistiche**: media, mediana, minimo, massimo, P95, P99, deviazione standard.
- **1% low**: `1000 / media dei frame time del 1% più lento`, calcolato solo con almeno 100 campioni. Non è l'FPS minimo.
- **Benchmark**:
  - riscaldamento di 4 s sulla prima posa, escluso dalle statistiche;
  - camera su un percorso deterministico (17 punti) con interpolazione morbida e quota dal terreno o dai solai;
  - giocatore fermo e comandi ignorati;
  - risoluzione dinamica sospesa.
- **Percorso**:
  - A panoramica;
  - B strada principale;
  - C cortile, entrando e uscendo dal cancello;
  - D facciata della casa;
  - E interno, entrando e uscendo dalla porta;
  - F bocage;
  - G Sherman;
  - H vista finale.

  È **verificato all'avvio**: 600 punti campionati, nessuno dentro un collider o sotto il terreno. Le statistiche sono riportate anche per tratto.
- **Costo degli effetti**: stesso percorso, prima un riferimento con tutto acceso, poi un effetto spento alla volta (20 s ciascuno). Costo = differenza di frame time medio. **I costi non sono additivi**; con una sola ripetizione la variabilità non è stimata, e il pannello lo indica.
- **Test di accumulo**: il percorso ripetuto più volte, contando a ogni giro geometrie, texture, programmi shader, oggetti della scena e memoria JS.
- **Esportazione**: data, build (versione degli script), browser, sistema operativo, WebGL, GPU (solo se il browser la espone), risoluzione, DPR, preset, durata, fotogrammi, statistiche, serie e metriche mancanti. **Niente viene inviato a server esterni.**

## Metriche non disponibili
- **Memoria GPU**: WebGL non la espone. Il numero di geometrie e texture non è memoria.
- **Tempo GPU**, se manca l'estensione dei timer.
- **Memoria JS** fuori da Chrome e Edge (`performance.memory`).
- **Nome della GPU**, se il browser lo maschera.

## Test eseguiti (headless, SwiftShader)
`node tools/ai/tlab.js`: 18/18 superati, tra cui statistiche (1% low, P95/P99), F8/F9, percorso A–H senza collisioni (601 punti verificati), benchmark completo, metriche mancanti dichiarate, interruzione anticipata, isolamento e ripristino degli effetti, export JSON/CSV, foto di confronto, costo del profiler (0,002 ms/fotogramma), test di accumulo (crescita zero), cambio preset con riavvio automatico, ritorno al menù. `node tools/ai/taaa.js`: 8/8 superati.

## Risultati misurati
Nel contenitore headless la GPU è emulata via software (SwiftShader): i tempi non rappresentano un PC reale e **non vengono riportati come FPS**. Servono le misure dal tuo PC: F9 → «Tutti i preset in sequenza» → esporta JSON/CSV.

## Colli di bottiglia probabili (da confermare con i dati)
- SSAO: ridisegna la scena una seconda volta (pass normali/profondità).
- Vegetazione densa (erba, siepi del bocage): molti triangoli e overdraw con alpha test.
- Terreno ULTRA: risoluzione della griglia elevata.

## Ottimizzazioni future (da scegliere in base ai dati)
- SSAO a mezza risoluzione o sostituito da AO precalcolato.
- LOD/impostori per siepi e alberi lontani; distanze di chunk più corte su MEDIUM.
- Griglia del terreno adattiva.
