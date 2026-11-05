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

**Numero attuale di edifici nuovi dell'Urban Expansion 3.0: 5, più i muretti.**
