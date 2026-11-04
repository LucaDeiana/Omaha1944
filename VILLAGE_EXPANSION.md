# AAA Normandy Village Expansion 2.0 — tech demo

**Solo nella tech demo «AAA Graphics Test» (SCEN `aaa`).** Le mappe originali, la campagna e il multiplayer non cambiano: `tools/ai/tvillage.js` verifica che su Omaha il villaggio esteso non venga costruito, e `tools/ai/taaa.js` che Omaha resti Omaha.

Codice: `src/aaa/village2.js`. Agganci minimi nei file della demo:
- `terrain.js`: dimensioni, griglia, strade;
- `aaa.js`: aie, costruzione, aggiornamento;
- `mats.js`: stanze interne;
- `lab.js`: tasto F4;
- `pipeline.js`: punto fisso della casa Blender.

## A. Audit (prima dell'espansione)
- **Terreno**: 156 × 156 m con griglia uniforme, strada principale est-ovest, viottolo a nord, 5 argini di bocage.
- **Edifici**: 4 edifici procedurali (`aaaBuilding`, cioè casa A, fienile B, casetta C, officina D) e 1 casa Blender GLB con LOD (`normandy_house_01`). La chiesa era una sagoma lontana fatta di scatole.
- **Interni**: casa A (scala e primo piano) e casa Blender.
- **Riutilizzati senza modifiche**:
  - `aaaBuilding`: muri estrusi con aperture vere, telai, persiane, tetti tegola per tegola, comignoli, gronde, collider a pezzi;
  - materiali PBR triplanari (`aaaTri`, texture CC0 della demo);
  - vegetazione a istanze, argini e siepi del bocage;
  - props (`apSandbags`, `apCart`, `apCrate`…);
  - Benchmark Lab (F8/F9), Movement Lab (F6), collisioni (`solids`, `FLOORS`).
- **Combat Lab**: non esiste nel progetto. Ho preparato solo i dati (vedi sezione G).

## B. Masterplan
Il terreno passa da 156 a **292 m di lato** (`AV.half` da 78 a 146). La griglia resta fitta entro ±92 m e si dirada fino a 1,2 m verso il bordo, quindi non ci sono crepe. Su LOW il terreno ha 82.369 vertici.

| Zona | Dove | Contenuto |
|---|---|---|
| A centro storico | ovest, sulla strada principale | piazza lastricata, chiesa e campanile, municipio-Ortskommandantur, locanda, panetteria, bottega, 4 case, pozzo, monumento ai caduti 1914-18, sagrato con tombe, vicolo |
| B residenziale | strada secondaria a sud-ovest | 6 case diverse, 3 depositi, muretti, cancelli, orti, recinzioni, panni stesi, carriole |
| C agricola | est | fattoria a corte chiusa: casa, grande fienile con soppalco, stalla, magazzino, tettoia del fieno, pozzo, letamaio, abbeveratoio, carri, aratro, frutteto, campi arati |
| D militare | nord, sul viottolo, e ingresso est | posto di blocco, trincea a zig-zag, 2 postazioni MG 42, ricovero di cemento, deposito munizioni, sbarramento con cavalli di Frisia e filo spinato, cartelli dei campi minati, osservatorio nella cella campanaria |
| E periferia | ovunque | sentiero dei campi, pali del telegrafo con fili, filari, 6 nuovi argini di bocage, casa isolata, fienile in rovina |

Strade nuove: secondaria residenziale (4,2 m), via dietro la chiesa verso le trincee (3,2 m), vicolo (2,8 m), accesso alla fattoria (4,2 m), sentiero (2,4 m). Si appoggiano al terreno senza gradini e tagliano gli argini dove li attraversano.

## C–H. Edifici creati (27 nuovi, 10 esplorabili)
Totale con quelli esistenti: 32 edifici, di cui 14 esplorabili (contando i 4 della demo originale: A, B, D e la casa Blender).

| Edificio | Zona | Esplorabile | Note |
|---|---|---|---|
| Chiesa (navata) | A | sì | pietra squadrata; portale e finestre alte; lastre; presbiterio rialzato; altare, croce, 14 banchi, fonte; capriate |
| Campanile | A | sì | 4 livelli (0 / 4,2 / 8,4 / 12,6 m); 2 rampe per livello con pianerottolo; cella campanaria con campana, aperture senza vetri, sacchi e radio (osservatorio tedesco); guglia d'ardesia a 23 m |
| Municipio | A | piano terra | Ortskommandantur: scrivanie, schedari, tavolo delle carte, stufa, avvisi alla popolazione |
| Locanda «Café de la Place» | A | sì, 2 piani | bancone, bottiglie, tavoli, sedie, botti, stufa, scala, camere; terrazza abbandonata |
| Panetteria | A | sì | forno di mattoni, bancone, scaffali, pani |
| Bottega (épicerie) | A | sì | colombage, bancone, scaffali, casse |
| Case della piazza 1–4 | A | no | pietra, intonaco con colombage, mattoni; una con tetto danneggiato (segnato per la distruzione) |
| Casa residenziale 1 | B | sì, 2 piani | camino, tavolo, credenza, scala, letti |
| Case residenziali 2–6 | B | no | 1 o 2 piani, tetti a due falde e a padiglione, tegole e ardesia |
| Depositi 1–3 | B | no | |
| Fattoria (casa) | C | piano terra | camino, tavolo lungo con panche, credenza, zangole |
| Grande fienile | C | sì | 2 portoni, soppalco percorribile, fieno, carro, attrezzi |
| Stalla | C | sì | poste, mangiatoie, fieno |
| Magazzino | C | no (porta aperta, interno con casse) | |
| Casa isolata | E | no | |
| Fienile in rovina | E | sì | muri spezzati senza tetto, macerie, travi crollate |
| Ricovero di cemento (Unterstand) | D | sì | brande, tavolo, stufa, radio, feritoia |

Le case non esplorabili hanno porte chiuse e finestre con collider, quindi nessuna porta porta a stanze vuote. Le persiane chiuse sono il 55% (case abbandonate).

### Architettura modulare
Gli edifici sono combinazioni di moduli parametrici:
- muri (pietra irregolare, pietra squadrata, intonaco di vari colori, mattoni);
- cantonali, fascia marcapiano;
- **colombage** (montanti, traverse, saette che evitano le aperture: `v2Timber`);
- porte (normali, da fienile), finestre (con o senza persiane, vetri o aperte);
- tetti (due falde e padiglione, tegole o ardesia, pendenza e colori variabili, muschio), comignoli, gronde;
- solai con travi, scale con ringhiera, tramezzi, soppalchi.

## Interni, scale, collisioni
- **Pavimenti percorribili** (`FLOORS`): rampe per le scale, solai con collider.
- **Stanze interne**: illuminazione indiretta ridotta. Ora sono illimitate (38 nel villaggio). Lo shader ne riceve 8, scelte fra le più vicine alla camera 4 volte al secondo.
- **Collisioni**: 810 nuovi solidi, cioè muri a pezzi attorno alle aperture, mobili grandi (tavoli, banconi, armadi, banchi), sacchi, filo, ostacoli.

## G. Combattimento (dati per un futuro Combat Lab)
- `V2.spawns`: americani a est e sud-est, tedeschi in piazza, chiesa, locanda e trincee, posizioni per gli Sherman.
- `V2.routes`: Sherman sulla strada principale e sull'accesso alla fattoria; fanteria su campi, residenziale, chiesa, vicolo e viottolo.
- `covers`: coperture registrate su trincee, MG, sacchi e angoli degli edifici.
- `V2.elevated`: posizioni sopraelevate.

Linee di tiro: piazza aperta di 28 × 22 m con coperture (pozzo, monumento, alberi). Il campanile si contrasta dalla piazza, dal sagrato e dal vicolo. Le trincee hanno un varco sul viottolo per i veicoli.

## Distruzione (preparazione)
`V2.destr` descrive ogni edificio come parti:
- strutturali: muri per facciata, tetto, solaio;
- distruttibili: porte, finestre, comignoli;
- decorative.

Ogni parte ha riquadro, connessioni, stato e uno slot `danneggiato`; `v2SetPart(id, stato, mesh)` registra stato e mesh. **Limite**: oggi la geometria di un edificio è unita per materiale. Per sostituire una singola parte serviranno mesh separate per sezione, nella fase del Destruction Test.

## K. Prestazioni
- **LOD**:
  - oltre 70, 95, 120 o 150 m (LOW, MEDIUM, HIGH, ULTRA) ogni edificio diventa un volume semplificato, cioè muri e prisma del tetto, con 2 draw call;
  - entro quella distanza il dettaglio resta pieno.
- **Ombre statiche**: il riquadro di ±88 m si ricentra quando la camera si sposta di oltre 30 m.
- **Altre misure**: geometria unita per materiale e per edificio, materiali condivisi, vegetazione a istanze con blocchi spaziali, frustum culling di Three.js.
- **Streaming per settori**: valutato e **non introdotto**. L'intero villaggio si costruisce in circa 0,7 s e sta in memoria. I settori (40 m) servono solo a conteggi e debug.
- **FPS**: in SwiftShader (CPU) misuro solo draw call e triangoli, non gli FPS. Gli FPS veri vanno misurati sul tuo PC con F9, nel Benchmark Lab.

## Debug della mappa (F4)
Livelli:
- collisioni, colorate per tipo;
- settori;
- riquadri degli edifici (verdi quelli esplorabili);
- punti di comparsa;
- percorsi;
- stato LOD.

Il pannello mostra anche:
- conteggi di edifici, props, solidi, coperture e solai;
- draw call, triangoli, FPS;
- un comando "forza LOD0" e un salto rapido alle zone;
- **«Ripristina la tech demo»**, che ricarica la demo con lo stesso preset.

## Test
- **`node tools/ai/tvillage.js`**:
  - isolamento;
  - validazione della mappa;
  - quantità;
  - salita del campanile;
  - chiesa, scale della locanda e della casa;
  - tutte le porte, aperte e chiuse;
  - percorsi dei carri e punti di comparsa;
  - LOD, debug, dati di distruzione;
  - costo, errori.
- **Regressioni**: `taaa`, `tmove`, `tlab`.

## Limiti dichiarati
- Gli edifici nuovi usano il **sistema procedurale della demo** (JavaScript), non nuovi GLB Blender. È un sistema modulare con aperture vere, tetti tegola per tegola, colombage e collider, ma non scolpito a mano. L'unico GLB Blender resta `normandy_house_01`.
- **Mobili e props** sono fatti di scatole e torniti, come quelli già presenti nella demo: credibili a distanza di gioco, non dettagliati da vicino. L'MG 42 è un modello semplificato.
- La guglia del campanile è un tetto a padiglione molto ripido, non una guglia ottagonale.
- Nessun grano o coltura alta nei campi, solo campi arati e pascoli.
- Municipio e fattoria sono esplorabili solo al piano terra (il solaio è chiuso).
