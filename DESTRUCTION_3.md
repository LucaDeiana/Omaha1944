# Distruzione 3.0: campo di battaglia distruttibile

## 1. Analisi iniziale (cosa c'era già)
- **Collider**: scatole `solids` usate da fanteria (`pushOut`), fisica dei carri (`vpGrid`, griglia da 12 m), colpi del giocatore (`hitscan`) e ora anche dalla vista e dai proiettili dei carri (Carri 3.0).
- **Distruzione esistente**:
  - città normanna di Omaha (`city.js`): la casa crolla tutta insieme, da intatta a rovina, e i collider vengono sostituiti;
  - varchi nel filo spinato, sincronizzati in rete;
  - depositi e alberi.
- **Esplosioni**: `explode()` è l'unico punto di ingresso e ha già la rete con autorità dell'host.
- **Terreno**: funzione analitica `H` campionata nelle griglie `HF` (0,75 m) e `HC` (3 m), su cui si basa la fisica; la mesh è costruita una volta sola. I crateri esistevano solo alla costruzione della mappa.
- **Relitti** (`vpWreck`): restavano visibili 240 s, ma senza collider per vista e proiettili.
- **Fumo e fuoco**: emettitori con durata.
- **Campagna**: punti di ripresa per fase.
- **Rete**: eventi dell'host più un'istantanea del mondo ogni secondo.

## 2. Architettura
Il sistema centrale è **`src/destruction.js`** (`DZ`).
- Ogni oggetto distruttibile (casa, muro, barricata, postazione) è fatto di **sezioni**: pannelli di muro, porta, tetto, elementi della barricata, sacchi.
- Ogni sezione ha materiale, integrità, stato, **un collider vero** (un elemento di `solids`), una mesh e le coperture collegate.
- Niente logica scritta per un singolo edificio: tutto passa da profili di materiale e da poche funzioni di costruzione (`dzHouse`, `dzWall`, `dzSection`).

Flusso di un colpo:
1. **impatto reale**: proiettile che tocca il collider, oppure `explode()`;
2. `dzShellHit` o `dzBlast`, con attenuazione dietro altri muri;
3. `dzDamage`: soglia del materiale, perdita di integrità;
4. `dzSetState`: aggiornamento di geometria e collider, macerie, coperture, `TL.ver` (vista e tiro dei carri), percorsi, evento, rete.

## 3. File
**Creati**
- `src/destruction.js`
- `tools/ai/tdz.js`
- `DESTRUCTION_3.md`

**Modificati**
- `armor.js`: impatti dei proiettili, sfondamento da parte dell'IA, scenario «Villaggio», bersaglio distrutto azzerato subito.
- `weapons.js`: `explode` chiama la distruzione; la fanteria dietro un muro integro subisce il 30% del danno.
- `world.js`: assi e geometria del terreno salvati per i crateri.
- `tanklos.js`: cache invalidate dai cambi di stato.
- `vehphys.js`: collider dei relitti.
- `net.js`: eventi 7 e 8, stato per chi entra a partita in corso.
- `audio.js`: suoni procedurali `dz_crumble`, `dz_collapse`, `dz_wood`.
- `campaign.js`: missione Overlord 5 adattata, distruzione nel punto di ripresa.
- `tank.js`: bersaglio distrutto azzerato.
- `main.js`: debug, azzeramento a ogni partita.
- `index.html`
- `tools/ai/tinf.js`, `tools/ai/ttank.js`: banchi di prova resi indipendenti dalla mappa casuale.

## 4. Oggetti distruttibili supportati
- Casa in muratura a uno o più piani:
  - muri a pannelli di circa 2,6 m per piano;
  - porta di legno;
  - tetto;
  - quattro coperture ai lati.
- Muro di cinta, basso o alto, a pannelli, con coperture.
- Barricata di legno.
- Postazione di sacchi a terra.
- Relitti dei carri: collider d'acciaio e coperture.
- Crateri sul terreno.

## 5. Materiali
Profili strutturali distinti dalla perforazione balistica, che resta in `TL_MAT`. Ogni materiale definisce:
- resistenza per volume;
- soglia sotto la quale il colpo non intacca;
- risposta all'esplosivo e al perforante;
- colore delle macerie e della polvere;
- suono;
- infiammabilità.

Materiali: legno, mattoni, pietra, cemento, acciaio, sacchi, terra, vegetazione.

Esempio: un pannello di pietra regge 3 colpi perforanti da 75 mm, cioè 2 per il danno grave; il legno si spezza al primo.

## 6. Stati
- **INTACT**
- **LIGHT_DAMAGE**: tinta scura, frammenti, polvere, suono; collider e copertura invariati.
- **HEAVY_DAMAGE**: resta la metà inferiore della sezione e il collider si abbassa alla stessa altezza, quindi vista e tiro passano sopra; la copertura diventa «rovina»; macerie.
- **DESTROYED**: mesh e collider tolti; macerie basse (0,55 m) con un collider semplice, calpestabile dalla fanteria e superabile dai cingoli; coperture perse; il legno può incendiarsi.

Un **edificio** con metà dei muri distrutti **crolla**: tutte le sezioni distrutte, un cumulo con collider unico (fino a 2,4 m, blocca i carri e fa da copertura), fumo, polvere, suono di crollo; i soldati dentro muoiono.

## 7. Collider
- Si modifica la scatola della sezione stessa: viene abbassata o disattivata.
- Le macerie hanno scatole proprie e semplici.
- I frammenti visivi (pool di detriti e particelle esistente) non hanno collider.
- Le macerie persistenti sono un'unica InstancedMesh fino a 1.500 sassi.

## 8. Balistica
- **Proiettili dei carri** (Kasserine): il colpo che tocca una sezione la danneggia (calibro × fattore del materiale; esplosivo con onda d'urto).
- Il legno attraversato con la perforazione viene danneggiato anch'esso.
- **Esplosioni**: danno a tutte le sezioni nel raggio, ridotto all'80% se dietro c'è un altro solido.
- Dopo la distruzione i proiettili passano **solo** dall'apertura effettiva (test 5).

## 9. IA
- **Carri**:
  - vista e linea di tiro ricalcolate subito a ogni cambio di stato;
  - con il nemico noto ma coperto da una sezione distruttibile, l'IA passa all'esplosivo e spara a quella sezione, solo se la canna la raggiunge, poi torna al perforante;
  - un relitto non è più un bersaglio.
- **Fanteria**:
  - copertura distrutta: il soldato lo sa, la lascia, si allarma e se ne cerca un'altra;
  - nella dimostrazione, quando si apre il varco i fanti americani avanzano attraverso la breccia;
  - un muro integro attenua le esplosioni.
- **Percorsi**: segmenti registrati, ricalcolati solo vicino alla modifica. Eventi `ROUTE_OPENED` (barricata distrutta) e `ROUTE_BLOCKED` (relitto, cumulo).
- **Eventi** su un unico bus (`dzOn`/`dzEmit`): `COVER_DESTROYED`, `WALL_BREACHED`, `BUILDING_COLLAPSED`, `ROUTE_BLOCKED`, `ROUTE_OPENED`, `VEHICLE_WRECK_CREATED`, `CRATER`, `STATE_*`.

## 10. Campagna
**Overlord 5 «Steel Support»** è giocabile come missione adattata, con il sergente Baker; si sblocca dopo la missione 1.

Fasi:
1. avvicinamento;
2. apertura di un varco, completata dall'evento reale `WALL_BREACHED` o da una linea di vista libera;
3. distruzione del Panzer;
4. fine.

## 11. Punti di ripresa
- Salvati a ogni fase con lo stato di ogni sezione e l'integrità (`v: 1`), i crateri e gli edifici crollati.
- Al ripristino:
  - geometria, collider, coperture e percorsi vengono riapplicati senza effetti;
  - **nessun evento ripetuto** e **nessuna duplicazione**: due ripristini di fila danno lo stesso numero di macerie e di solidi.

## 12. Rete
- L'host decide e invia `[7, sezione, stato]` e `[8, cratere]`.
- Il client applica e genera gli effetti in locale; **non applica danni strutturali propri**.
- Chi entra a partita in corso riceve lo stato completo nell'istantanea del mondo.
- Le particelle non passano dalla rete.

## 13. Test eseguiti (`tools/ai/tdz.js`, 24/24)
1. edificio integro blocca vista e proiettili;
2. danno leggero;
3. danno grave con collider dimezzato;
4. distruzione;
5. collider coerente: varco libero, macerie basse, pannello accanto ancora solido;
6. passaggio reale per la fanteria;
7. il soldato perde la copertura e cambia posizione;
8. lo Sherman vede il Panzer appena si apre il varco;
9. barricata distrutta → `ROUTE_OPENED`; relitto sulla strada → `ROUTE_BLOCKED`;
10. cratere grande: terreno fisico e mesh abbassati insieme, scarto 0;
11. relitto con collider, non più bersaglio.

Dimostrazione completa con l'IA:
- 0 colpi a segno attraverso la casa intatta;
- sfondamento con colpi reali;
- Panzer visto attraverso il varco a circa 18 s e distrutto a circa 28 s;
- fase finale raggiunta.

Inoltre:
- **12.** punto di ripresa ripristinato senza duplicati né eventi;
- **13.** rete: stesso stato sul client, e il client non decide i danni;
- campagna: punto di ripresa della fase 2 con la distruzione, e «Continua» in una pagina nuova ripristina fase e villaggio;
- **14.** stress (sotto);
- **15.** regressione:
  - IA fanteria 21/21, audio 22/22, campagna 20/20, carri 18/18;
  - tutte le modalità (Omaha, Kasserine, aria, mare, Ardenne, Tunisia, cecchini) partono senza errori.

## 14. Prestazioni (banco di prova, grafica software)
- 80 esplosioni con danni e crateri: 1,7 ms ciascuna;
- 60 impatti diretti: 0,04 ms ciascuno;
- dopo lo stress l'aggiornamento di gioco è di 2,1 ms per fotogramma;
- macerie 622/1.500, incendi al massimo 10, crateri al massimo 160;
- collider 10 ms in tutto per centinaia di cambi di stato;
- percorsi 1,7 ms in tutto; crateri 5,4 ms in tutto;
- memoria JS: nessuna crescita misurabile;
- villaggio: 49 sezioni, cioè 49 draw call più una per le macerie.

**FPS non misurati**: con la grafica software non sono significativi; vanno misurati sul tuo PC.

## 15. Limitazioni
- Il villaggio della dimostrazione è sulla mappa dei carri di Kasserine: **terreno e colori sono della valle tunisina**, non della Normandia.
- Le case della città di Omaha usano ancora la distruzione di prima (crollo in un passo), con i collider già corretti; non sono sezionate.
- Le esplosioni ad area per i carri restano quelle di prima.
- Per la fanteria non c'è una navigazione a grafo: si muove in linea retta con spinta fuori dai solidi, quindi i varchi funzionano perché i collider spariscono, non perché si ricalcola un percorso.
- La sincronizzazione di rete è stata verificata simulando host e client in due pagine, non con due giocatori reali sul server.

## 16. Da fare
- Sezionare le case della città di Omaha e i bunker.
- Una mappa normanna dedicata ai carri.
- Distruzione da armi leggere sul legno.
- Propagazione limitata del fuoco tra sezioni di legno.
- Crepe con texture invece della tinta scura.
- Misura degli FPS sul tuo PC.
