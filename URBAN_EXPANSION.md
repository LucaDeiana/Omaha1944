# AAA Normandy Village Urban Expansion 3.0 — avanzamento

**Solo nella tech demo.** Codice in `src/aaa/xdestruct.js` (sezione «URBAN EXPANSION 3.0»), sullo stesso sistema di distruzione del Destruction Lab: non esiste un secondo sistema.

## A. Audit (stato reale all'avvio)
- **Edifici della demo**:
  - 4 edifici originali procedurali più 1 casa Blender;
  - 27 del Villaggio 2.0 (procedurali, a mesh unite, **non distruttibili**);
  - 2 edifici di prova del Destruction Lab (distruttibili).
- **Sistemi citati nel prompt**:
  - Battlefield Atmosphere 4.0, Full-Body Physics & Reactive AI 7.0, Vertical Battlefield 10.0, Performance Guardian e Bug Hunter **non esistono** nel repository. Non li ho finti.
  - L'IA della demo non c'è (nessun soldato). La navigazione è la griglia locale del Destruction Lab.
- **Conseguenza**: per essere distruttibili, gli edifici nuovi nascono dal generatore a pannelli fratturati (`xdzHouse`). Gli edifici del Villaggio 2.0 restano non distruttibili finché non vengono convertiti (passo successivo).

## C. Registro degli edifici (`XDZ_REG`)
- **Ogni voce ha**: ID stabile (un duplicato genera un errore), tipologia, zona, posizione, orientamento, dimensioni, asset, materiali, livelli, esplorabilità, distruzione.
- **Lo stato è calcolato dal vivo**: integrità, pannelli, crollati, tetto, solai, scala, collider.
- **Debug F3**: elenco con selezione; l'edificio selezionato viene evidenziato, con la sua scheda e un teletrasporto davanti alla facciata.

## D–E. Libreria modulare distruttibile (`xdzHouse(id, x, z, cfg)`)
- **Parametri**: larghezza, profondità, 1–3 piani, muratura (pietra, mattoni, intonaco con colore), tetto (ardesia, tegole), pendenza, finestre per facciata, porte, porta aperta o chiusa, persiane, scala.
- **Porte chiuse e persiane**: ante di legno fratturate nel vano, non portanti, appese ai pannelli vicini. Una MG le apre; la muratura no.
- **Solai**: su travi appoggiate ai pannelli sotto il solaio. La **scala** (gradini e rampa) poggia sulle travi: se le travi cedono, cadono solaio e scala e le superfici percorribili si spengono.
- **Tetti e timpani**: in campate appoggiate alla fila alta dei muri.
- **Muretti di cortile**: una fila di pannelli di pietra distruttibili.
- **Materiali**: soglie e punti per m³ distinti per pietra, mattoni, intonaco, legno, tegole e ardesia.

## F. Primo isolato — rue Neuve (5 edifici + muretti)
| ID | Tipo | Piani | Muratura / tetto | Esplorabile |
|---|---|---|---|---|
| u1_casa_a | casa a schiera | 2 + soffitta | pietra / ardesia | sì, scala al primo piano, arredo |
| u1_casa_b | casa a schiera | 2 | intonaco crema / tegole | no: porta chiusa, persiane |
| u1_bottega | bottega con abitazione | 3 | mattoni / ardesia | sì, scala al primo piano, arredo |
| u1_casa_c | casa a schiera, danni preesistenti | 2 | intonaco ocra / tegole | no |
| u1_rimessa | rimessa con portone | 1 | pietra / ardesia | sì |
| u1_muretti | muri dei cortili posteriori | — | pietra | — |

- **rue Neuve**: nuova strada di 5 m che collega l'isolato alla strada del quartiere residenziale. Il corridoio da 3,2 m per i carri è libero.
- **Cortili posteriori**: 3 m di profondità, con un accesso posteriore a est.
- **Danni preesistenti** (casa c): celle tolte e una campata del tetto ceduta, con i collider spenti. Lo stato è coerente col sistema.

## G. Test del primo isolato (`node tools/ai/turban.js`, tutti superati)
- registro e ID;
- struttura appoggiata, nessun conflitto con il villaggio;
- scale al primo piano (casa a, bottega);
- porta chiusa e porta aperta;
- danni preesistenti;
- ogni edificio distruttibile e **indipendente**: un colpo di carro su uno non cambia gli altri;
- armi leggere: la muratura resta intatta, la porta di legno cede;
- crollo locale di travi, solaio e scala, con gli altri edifici intatti;
- navigazione: dalla strada dentro la casa e nei cortili; la breccia apre la casa chiusa;
- strada per i carri;
- persistenza;
- costo: un collider per pannello a riposo, aggiornamento 0,3 ms;
- selezione F3;
- errori.

Regressioni: `tdestruct` e `tvillage` superati.

## Prossimi passi (non ancora fatti)
- Gli isolati successivi: centro, quartiere agricolo, edifici di servizio, fino all'obiettivo di 40–60 edifici.
- La conversione degli edifici del Villaggio 2.0 al sistema distruttibile.
- Soffitte e cantine accessibili; combattimento urbano dell'IA, che richiede soldati nella demo.

## H–K. Altri isolati (fatti)
- rue Neuve, lato sud: 4 edifici (facciate a nord).
- rue de l'Église: casa del sagrestano e ufficio postale.
- Grande Rue: lato nord con caffè-tabacchi, casa danneggiata e casa a 3 piani; lato sud con 3 case.
- Ferme de la Croix: casa colonica, fienile, stalla, rimessa dei carri, muri della corte.
- rue des Ateliers: officina, magazzino, forgia, rimessa, muro del cortile.

Strade nuove: rue de l'Église, accesso della fattoria, rue des Ateliers. Ogni zona ha una griglia di navigazione propria.

**Ottimizzazioni**:
- un collider per colonna di pannelli integri, diviso al primo danno: 791 solidi per 1.152 pannelli;
- intonaci con un solo materiale colorato per istanza;
- fino a 2.048 istanze per pool.

**Test** (`turban`, tutti superati): 25 edifici in 7 zone con posizioni valide, ognuno distruttibile e indipendente (un colpo di carro su ciascuno).

**Numero attuale di edifici nuovi dell'Urban Expansion 3.0: 25, più 3 gruppi di muretti.**

## Dettaglio architettonico al livello della casa Blender (fatto)
- **Generatore Blender** `tools/asset-pipeline/blender/generators/urban_house.py`: estende quello della casa Blender (`normandy_house.py`) e ne riusa le funzioni:
  - mostre in pietra di Caen (stipiti a blocchi, architravi, davanzali con gocciolatoio);
  - finestre a due ante con traverse e vetri;
  - scuri a doghe con controvento a Z, bandelle e cardini;
  - porte a doghe (aperte, oppure chiuse con bandelle e maniglia) con telaio di quercia e gradino;
  - cantonali, zoccolo, marcapiano, cornicione, comignoli.
- **Gruppi**: ogni pezzo appartiene al componente distruttibile che lo sostiene:
  - `p` pannello di muro, `o` vano (riempimenti di pietra attorno), `a` anta di legno, `g` timpano;
  - `r` campata del tetto, solo se il tetto è generato in Blender (opzione `tetto_blender`, non usata).
- **Build**: `scripts/build_urban.py` produce un GLB per edificio (25, tutti validati) da `assets/aaa/urban/urban_defs.json`.
  - Le definizioni si esportano dal gioco con `scripts/export_urban_defs.js`.
  - Nel repository ci sono i `.js` (base64) e i manifest; i `.glb` si rigenerano.
  - In tutto 354.804 triangoli.
- **Vani di misura vera** nel sistema di distruzione: finestra 0,95 m, porta 1,05 × 2,15 m. Stipiti, davanzale e architrave sono **pannelli di pietra fratturati** (`riempimento`), appesi ai muri vicini, con collider e distruzione.
- **Tetto generato nel gioco** con la logica di `roof()` della casa Blender, per campata, con le stesse texture e UV in metri:
  - tavolato, puntoni, frontalino;
  - ardesie (o tegole piane) posate una per una, con larghezza, rotazione e quota variabili e qualche mancante;
  - colmo di coppi, grondaia di ghisa, bandinelle.

  Ogni campata resta una lastra del grafo dei supporti: crolla e cade come prima.
- **Nel gioco** (`xdzDetailLoad`):
  - caricamento progressivo, dal più vicino alla camera;
  - pezzi uniti per materiale in una mesh per edificio, con i materiali PBR della casa Blender;
  - una **maschera sulla GPU** (anche nelle ombre) nasconde i gruppi dei componenti rotti, e il pezzo **cade come detrito** con la sua geometria;
  - dopo un ripristino il dettaglio si ricarica coerente con lo stato salvato.
- **Test** `tools/ai/tdetail.js` (tutti superati):
  - 25 GLB validati;
  - caricamento progressivo, con ogni gruppo legato a un componente;
  - edificio integro;
  - colpo di carro: spariscono solo i gruppi dei pannelli colpiti, la maschera è coerente, ci sono detriti;
  - crollo del timpano con il comignolo;
  - ripristino.

## Limiti residui
- I muri sono i pannelli fratturati con le texture triplanari della demo, la stessa famiglia di texture della casa Blender. Non c'è la sbozzatura delle singole pietre.
- Non ci sono abbaini né interni arredati come nella casa Blender: solo arredo essenziale al pianterreno delle case esplorabili.
- Le varianti di colore degli scuri non sono ancora per edificio: il colore è unico.
