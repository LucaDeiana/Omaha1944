# Mappe 4.0: prima fase (Omaha e Colleville)

## Analisi delle mappe
| Mappa | Generazione | Note |
|---|---|---|
| **Omaha** (`world.js`, `city.js`) | Terreno analitico `H0`/`H` (spiaggia, terrapieno, scogliera con le uscite, trincea, bunker scavati); griglie `HF` da 0,75 m e `HC` da 3 m; edifici con `addHouse` (scatola + prisma); città normanna di 880×390 m (`city.js`, case a schiera con crollo in un passo) | Spiaggia già ricca (ricci cechi, cancelli belgi, pali con mine, detriti). **Colleville non era deterministico**: altezze e piani delle case usavano `Math.random`. Finestre dipinte su muri pieni, tetti tutti uguali. Nessun interno. Circa 2.900 collider, 420–900 draw call e 2,4–4,4 milioni di triangoli a seconda della vista |
| **Ardenne** (`ardennes.js`) | Terreno con neve e crateri; case con `addHouse` | Stesse case-scatola della Normandia: da fare |
| **Tunisia** (`tunisia.js`) e **Kasserine** (`armor.js`, funzione `kasH`) | Strutture diverse: Tunisia è un'arena per la fanteria, Kasserine una valle per i carri con il villaggio di Sidi Bou Zid | Case a calce a blocco; Kasserine ha anche il villaggio dimostrativo della distruzione. Da fare |
| **Stalingrado** (`snp/maps/stalingrado.js`) | Mappa per i cecchini con solai e rampe propri (`snpFloor`) | Ha già piani e scale. Da rivedere |
| **Aeree** (`airworld.js`, `airmaps.js`) | Tasselli da 1 km a tre livelli di dettaglio, orizzonte rado | Migliorate in questa sessione (visibilità e boschi a media distanza). Da fare: campi e villaggi riconoscibili |

## Cosa ho fatto (vertical slice di Colleville)
- **`src/arch.js`**: libreria modulare di edifici con un profilo per teatro; per ora è implementato quello normanno.
  - **Muri a pezzi** con **aperture vere**: finestre e porte senza muro, attraverso cui si vede, si spara e si entra. Ogni pezzo è una sezione di Distruzione 3.0, con collider, materiale e stati.
  - Tipologie: pietra, intonaco, graticcio (*colombage*), mattoni. Usi: casa, officina, fienile (portone grande).
  - **Tetti** a due falde, a padiglione e a mezzo padiglione, con pendenza normanna di 43–53°, gronda, colmo, frontoni, uno o due comignoli; in ardesia o in coppi.
  - Finestre con telaio a croce, vetro scuro arretrato, davanzale, architrave in pietra o cornice, persiane dipinte. Cantonali, zoccolo, fascia marcapiano.
  - Le decorazioni sono **legate ai pezzi**: se il muro cade, cadono con lui.
  - **Interni** negli edifici strategici: pavimento, solaio con vano scala, **scala percorribile**, letto, armadio, tavolo, sedie, credenza, coperture dietro le finestre del piano terra.
  - Rovine deterministiche con collider veri, al posto delle scatole di prima.
  - Muri di cortile con cancello.
- **`src/maps/colleville.js`**: il villaggio sugli **stessi lotti** di prima, quindi coperture, missioni e IA non si spostano.
  - 16 edifici, di cui 2 strategici con interni, più fattoria con fienile e cortile murato e muretti degli orti.
  - **Deterministico**: due caricamenti producono lo stesso villaggio (testato).
  - Con `?village=old` nell'indirizzo si vede la versione precedente, per confrontare.
- **Solai globali** (`FLOORS`/`worldFloor`), con lo stesso formato dei cecchini: li usano il giocatore e i bot.
- **Distruzione resa con instancing**: un'InstancedMesh per materiale, con texture triplanare in coordinate del mondo, al posto di una mesh per sezione.
- **`pushOut`** ora usa la griglia spaziale dei solidi invece di scorrere tutti i 3.600 collider per ogni soldato in movimento.
- **`src/mapcheck.js`**:
  - validazione (edifici sovrapposti, sospesi, sepolti, coperture e punti di ripresa dentro i muri, coordinate non valide, solai);
  - overlay con **Ctrl+Maiusc+M**: collider per tipo, sezioni per stato, coperture, solai e scale, punto di ripresa.

## Misure (stesse inquadrature, grafica software)
| Vista | Draw call prima → dopo | Triangoli prima → dopo |
|---|---|---|
| Strada del villaggio | 419 → 399 | 2,43 → 2,15 milioni |
| Dall'alto | 446 → 434 | 3,63 → 3,21 milioni |
| Casa da vicino | 908 → 773 | 4,39 → 3,53 milioni |
| Spiaggia | 790 → 759 | 3,32 → 2,89 milioni |

Altri numeri:
- collider: da 2.905 a 3.662 (+757 pezzi di muro);
- sezioni distruttibili: 812;
- caricamento: da 20,8 a 21,6 s (headless);
- memoria JS: da 441 a 468 MB.

FPS non misurabili qui.

Foto prima e dopo in `docs/maps4/`.

## Test
- `tools/ai/tmap.js`, 8/8:
  - determinismo;
  - una finestra lascia passare vista e colpi, il muro accanto li blocca;
  - si entra dalla porta;
  - la scala porta al primo piano (+3,12 m);
  - un bot resta sul solaio;
  - un pilastro distrutto apre il varco;
  - validazione.
- Regressione: fanteria 21/21, audio 22/22, campagna 20/20, carri 18/18, distruzione 24/24.

## Limiti e prossimi passi
- Gli edifici hanno collider allineati agli assi, quindi non possono essere ruotati: la varietà viene da lotti, arretramenti, tipologie e tetti.
- Sul lato a monte di una casa in pendenza il parapetto sotto le finestre può finire in parte sotto terra.
- I bot non salgono le scale da soli: al piano di sopra ci vanno solo se piazzati dallo scenario.
- **Non ancora rifatti**: bocage, spiaggia (solo l'analisi), Ardenne, Tunisia e Kasserine, Stalingrado, mappe aeree, città di `city.js`.
