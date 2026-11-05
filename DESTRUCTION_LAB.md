# AAA Dynamic Battlefield & Destruction 3.0 — Dynamic Destruction Lab

**Solo nella tech demo (SCEN `aaa`).** Su Omaha il laboratorio non si carica: nessun kit, nessun pannello, nessun collider (verificato da `tools/ai/tdestruct.js`). Il sistema di distruzione del gioco (`src/destruction.js`, DZ) non è stato sostituito.

Codice: `src/aaa/xdestruct.js`. Agganci, tutti protetti da `SCEN === 'aaa'`:
- `weapons.js`: colpo su un solido ed esplosione;
- `aaa.js`: aie, costruzione, aggiornamento;
- `terrain.js`: assi della griglia;
- `lab.js`: tasto F3.

Laboratorio: cortile a sud-est del villaggio. Si apre con **F3**, con il pulsante «Vai al laboratorio».

## A. Audit del sistema esistente (DZ, `src/destruction.js`)
- **Già presenti**:
  - oggetti fatti di sezioni (scatole) con integrità e 4 stati: integro, leggero, grave (metà altezza), distrutto;
  - macerie a istanze, crollo dell'edificio al 50% dei muri;
  - incendi con limite, coperture che si perdono (`dzCoverLost`), percorsi dei carri che si aprono e chiudono;
  - snapshot e rete;
  - crateri sul terreno del gioco principale.
- **Limiti trovati**:
  - il danno non è localizzato: una sezione intera si scurisce o sparisce;
  - nessun grafo dei supporti, nessuna fisica dei detriti;
  - i crateri funzionano solo sul terreno del gioco principale (`WORLD.terr`), non su quello della demo.
- **Riutilizzati**: materiali e suoni (`dz_crumble`, `dz_wood`, `dz_collapse`), `dzCoverLost`, effetti (`fxDebris`, `fxImpact`, `PS_SMOKE`, `addEmitter`, `flashLight`), collisioni (`solids`, `FLOORS`, `raySolids`), occlusione audio dell'Audio Overhaul (legge i collider: un muro distrutto non attenua più).
- **Combat Lab e IA della demo**: non esistono soldati nella tech demo. La navigazione è una griglia locale con agenti indicatori, **non soldati**.

## B–D. Edifici di prova
- **Casa normanna in pietra** (8 × 6,4 m, due piani):
  - 4 facciate a pannelli (≈ 1,9 × 1,6 m), con porta e finestre come aperture vere;
  - solaio su due travi;
  - tetto d'ardesia in 6 campate e timpani.
- **Fienile a struttura di legno** (10 × 7 m):
  - 14 pilastri, tavolato fra i pilastri, portone aperto;
  - correnti in alto, tetto in 8 campate.
- **Totale**: 85 pannelli fratturati (1.386 celle), 14 tetti e timpani, 14 fra solai, travi e correnti.

## C. Pipeline Blender di frattura (`tools/asset-pipeline/blender/generators/fracture.py`, `scripts/build_fracture.py`)
- **Metodo**: fratture di Voronoi vere. Ogni cella è il volume tagliato dai piani bisettori verso gli altri semi (`bmesh.bisect_plane` più chiusura del taglio), quindi è convessa e chiusa. Il pivot sta nel baricentro.
- **Modelli**:
  - `frac_stone`: 18 celle che attraversano lo spessore;
  - `frac_wood`: 18 celle allungate come tavole;
  - `frac_beam`: 6 celle con tagli obliqui, per i pilastri;
  - 4 sassi di maceria.
- **Validatore**: le celle ricompongono il volume (1,000), sono tutte chiuse, il pivot è nel baricentro.
- **Uscita**: `assets/aaa/destruction/fracture_kit.glb` (83 KB, 1.004 triangoli) più `.json` e `.js`.
- I materiali sono quelli triplanari PBR della demo, in coordinate del mondo.

## E. Danno localizzato
- Un **collider per cella** (scatola ridotta dell'8%): il colpo trova la cella colpita.
- **Armi leggere** (fucile, mitra, MG):
  - fori (segni a istanze, 600 riciclati), schegge, polvere, suono d'impatto;
  - il danno resta **sotto la soglia della pietra**: un muro portante non si demolisce con un fucile;
  - il legno cede.
- **Esplosioni** (granata, carro, bombardamento):
  - danno alle celle nel raggio, con attenuazione per distanza;
  - celle dietro il punto d'impatto protette;
  - impulso ai detriti e incendio del legno, con probabilità dal seme.
  - Raggio d'azione: 0,95 m per il carro (75 mm), 2,6 m per la granata, 3,6 m per il bombardamento.
- **Effetti diversi per tipo**: lampo, onda di polvere ad anello, colonna di fumo, schegge, tremore della camera, suono.
- **Stati del pannello**: integro, danno leggero (segni), danno medio (celle mancanti), danno grave (meno della metà), crollato.
  - Finché il pannello è integro si vede una superficie unica; le celle compaiono al primo distacco. L'edificio non cambia mai modello in blocco.

## F. Grafo dei supporti
Le regole di appoggio:
- un pannello sta sul pannello sotto o sul terreno;
- un architrave regge se è quasi integro e un vicino di fila è appoggiato (aperture, brecce);
- il tavolato sta sui pilastri, che reggono finché hanno metà delle celle;
- correnti sui pilastri, travi del solaio sui muri lunghi, tetti e solaio su almeno un terzo dei loro appoggi.

La rivalutazione avviene solo dopo un cambiamento (poche decine di nodi). Ciò che resta senza appoggio crolla dopo un preavviso di 0,25–1,2 s, con uno scricchiolio.

## G. Detriti
- **Grandi** (celle oltre 0,12 m³, tetti, travi): corpi rigidi con gravità, rimbalzo (0,22), attrito, collisione con terreno, solai e muri.
  - Quando si fermano (sonno) diventano **macerie con collider** percorribile; se alte, diventano **nuove coperture**.
- **Medi**: stessa fisica, nessun collider da fermi; i più vecchi spariscono oltre 260 pezzi.
- **Piccoli**: particelle (`fxDebris`).
- **Limiti**: 60 corpi attivi (i più vecchi si addormentano subito); nessun corpo resta attivo oltre 12 s.
- **Limite dichiarato**: nessuna collisione fra detriti.

## H. Collisioni dinamiche
- Le celle staccate spengono il loro collider: nessun collider invisibile (verificato su tutte le celle).
- Tetti e solai che cedono spengono collider e superficie percorribile.
- La luce e l'acustica d'interno si tolgono quando cade il tetto.

## I. Terreno deformabile
- **Crateri veri sul terreno della demo**:
  - griglie fisiche `Hf`/`Hc` abbassate (profilo con bordo rialzato);
  - vertici, normali e materiale della mesh aggiornati solo nel raggio;
  - zolle sul bordo; navigazione aggiornata.
- **Reset**: ripristina l'altimetria originale.
- **Limite verificato**: in SwiftShader l'aggiornamento della mesh del terreno si vede solo nel preset LOW. Con i buffer più grandi (MEDIUM e oltre) il renderer software ignora i caricamenti parziali oltre circa 1 MB di offset. Altimetria fisica e dati della mesh sono comunque aggiornati (verificato). Su una GPU vera va controllato visivamente.

## J. Incendi
- **Solo il legno**, al massimo 8 incendi.
- **Propagazione deterministica (seme)**: al massimo 2 generazioni, ai pannelli di legno entro 3,2 m, dopo 12 s.
- **Effetti**: il legno brucia e cede (celle che cadono), annerimento, fumo che dura più delle fiamme.

## K. Navigazione e coperture
- **Griglia di 0,5 m** sul cortile del laboratorio, con A* a 8 direzioni. Si aggiorna **solo nel riquadro cambiato**.
- **Coperture**: davanti ai pannelli bassi dei muri. Quando il pannello è grave o crollato le coperture vengono tolte con `dzCoverLost`, che avvisa i soldati che le usano. Le macerie alte creano nuove coperture.
- **Misura**: una breccia bassa nel muro est accorcia il percorso fuori→dentro da 13,3 a 6 m.

## L. Audio
- **Suoni**: quelli sintetizzati del gioco, `dz_crumble` (pietra), `dz_wood` (legno, travi) e `dz_collapse` (tetto); scricchiolio prima del crollo; impatto quando i detriti si fermano. Nessuna nuova registrazione: non sono raggiungibili registrazioni autorizzate da questo ambiente.

## M. Persistenza
- `xdzSnapshot()` registra: celle mancanti per pannello (maschera), parti cedute, crateri, incendi, legno bruciato, macerie grandi ferme. Pesa circa 1 KB.
- `xdzRestore()` ricostruisce lo stesso stato (verificato).
- I reset sono tre: edifici, terreno, scenario.

## Scenari (seme 1944, ripetibili)
- **A, armi leggere**: fucile e MG contro la pietra (solo segni), MG contro il tavolato (cede), colpi sul carro (segni).
- **B, colpo di carro**: breccia nel muro sud.
- **C, crollo strutturale**: pilastri del fienile e muro portante della casa; cedono correnti, tetti, travi.
- **D, esplosione sul terreno**: cratere di bombardamento e di carro.
- **E, armi combinate**: carro, MG, mortai, incendio, agenti di navigazione che ripianificano.

## Debug (F3)
Il pannello mostra:
- integrità di edifici e pannelli per stato, tetti ceduti;
- frammenti, corpi attivi e fermi, collider, crateri, incendi, segni;
- tempi di distruzione, collisioni, navigazione e crateri; draw call e triangoli.

Visualizzazioni: grafo dei supporti, collider, griglia di navigazione e percorsi. Pulsanti: scenari, reset, snapshot.

## Test (`node tools/ai/tdestruct.js`, tutti superati)
I controlli coperti:
- isolamento;
- kit validato, struttura appoggiata;
- armi leggere, breccia localizzata, percorso più corto;
- crollo strutturale, cratere;
- armi combinate, snapshot, reset;
- pannello, errori.

Rendering e aggiornamento in SwiftShader: l'aggiornamento della distruzione costa circa 1 ms durante lo scenario E. **Gli FPS veri vanno misurati sul tuo PC** (F9).

## Regressioni
- **taaa**: superato.
- **tlab**: due controlli del benchmark in SwiftShader falliscono, e così il limite di 20 s sulla costruzione in tvillage (21,6 s). **Falliscono allo stesso modo anche sul commit precedente (af79548)**, che prima li superava. Il container è stato riavviato su una macchina più lenta: non è una regressione della distruzione.
- **Collider**: a riposo un pannello integro ha **un solo collider**. I collider delle 18 celle entrano nella lista dei solidi solo quando il pannello si apre, quindi gli edifici di prova aggiungono 85 solidi invece di 1.386.

## Limiti dichiarati
- Gli edifici distruttibili sono **due edifici di prova**. Il sistema non è ancora esteso agli edifici del villaggio, come chiede la fase 21.
- I detriti usano una fisica semplice (sfera orientata contro terreno e scatole), non un motore di corpi rigidi; nessun urto fra detriti.
- Nessun soldato nella demo: lo scenario E usa agenti di navigazione, non fanteria.
- Il colpo di carro è simulato nel laboratorio (raggio e danno); il carro della demo non spara.
- Il crollo dei tetti è un corpo rigido unico per campata, senza tegole che si separano.
