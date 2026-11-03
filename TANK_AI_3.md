# Carri 3.0: vista, tiro e collisioni con gli edifici

## Causa effettiva del bug
1. **Kasserine** (`armor.js`):
   - `kasLOS`, usata da carri, Pak 40 e ricerca della copertura, controllava **solo il terreno**: case e muri erano trasparenti alla vista.
   - I proiettili simulati (`kasUpdateShells`) controllavano terreno e carri, **mai i solidi**: attraversavano gli edifici.
2. **Omaha e Ardenne** (`tank.js`, Panzer IV):
   - sceglieva il soldato o il giocatore più vicino entro 260 m **senza alcuna linea di vista**;
   - il colpo dell'IA non era un proiettile: dopo un ritardo **esplodeva direttamente sul bersaglio**, attraverso qualunque muro;
   - la mitragliatrice dell'IA applicava danno al bersaglio senza controllo.

I collider degli edifici esistevano già (scatole `solids`, usate da fanteria, fisica dei carri e colpi del giocatore). Erano esclusi solo da questi percorsi dell'IA dei carri.

## Cosa è cambiato
- **`src/tanklos.js`** (nuovo): un'unica interrogazione, `tlRay`, che trova il primo ostacolo lungo un segmento, tra terreno e solidi.
  - Fase larga: la griglia spaziale dei solidi della fisica dei carri (`vpGrid`, celle di 12 m) visitata lungo il segmento, più i solidi molto grandi.
  - Gli ostacoli sono ordinati per distanza: si elabora sempre prima il più vicino.
- **Vista** (`tlSee`):
  - dalla cupola del capocarro verso la torretta e verso lo scafo del bersaglio: basta uno dei due punti, quindi un bersaglio parzialmente coperto si vede;
  - per i soldati si mira al petto.
  - Cache per coppia di 0,5–0,8 s, invalidata se uno dei due si sposta di oltre 1,5 m, se l'ostacolo che bloccava viene disattivato o se cambiano i solidi.
- **Tre stati** (`tlMem`): `TARGET_UNKNOWN`, `TARGET_KNOWN` (ultima posizione ricordata per 12 s), `TARGET_VISIBLE`. Si spara solo a un bersaglio visibile.
- **Linea di tiro** (`tlLOF`):
  - separata dalla vista: parte dalla bocca reale del cannone verso il punto mirato, con la perforazione del colpo;
  - se è ostruita il carro non spara e il debug ne mostra il motivo («non sparo: wall davanti alla canna»);
  - dopo 3 s di ostruzione il carro cerca un'altra posizione;
  - per i colpi esplosivi del Panzer un ostacolo entro 5 m dal bersaglio, come i sacchi di sabbia davanti a un fante, è un tiro accettato.
- **Proiettili** (Kasserine):
  - segmento continuo tra la posizione precedente e la nuova a ogni sottopasso, quindi niente tunneling;
  - i solidi vengono controllati prima dei carri;
  - all'impatto ci sono effetti in base al materiale, l'esplosione per l'HE e il crollo delle case dove la mappa lo supporta (`cityBlast`).
- **Panzer** di Omaha e Ardenne: il colpo esplode sul primo ostacolo reale lungo la traiettoria; la mitragliatrice spara solo con linea di tiro libera.
- **Materiali** (`TL_MAT`): ogni materiale indica se blocca la vista e quanti millimetri di perforazione assorbe.

  | Materiale | Perforazione assorbita (mm) |
  |---|---|
  | muratura | 400 |
  | cemento, roccia, acciaio | invalicabili |
  | terra e sacchi | 160 |
  | vegetazione | 60 |
  | legno | 12 |
  | filo spinato | non blocca né la vista né il colpo |

  La perforazione è esplicita: un colpo che attraversa il legno arriva al bersaglio con la perforazione ridotta.
- **IA tattica**:
  - con il bersaglio nascosto la torretta resta sull'ultima posizione per 6 s, poi torna in avanti, quindi non insegue all'infinito;
  - dopo 3 s il carro cerca una posizione di tiro vicina (24 punti), libera da edifici, non ripida, da cui l'ultima posizione si vede;
  - chi difende una posizione a volte resta ad aspettare;
  - preferenza per il bersaglio già tenuto;
  - la ritirata verso la copertura ora considera gli edifici.
- **Pak 40**: vista reale, linea di tiro, bocca del cannone.
- **Debug** con **Ctrl+Maiusc+K**:
  - verde: vista libera; rossa con croce: primo ostacolo;
  - gialla: ultima posizione nota;
  - azzurra: canna; ciano: linea di tiro libera; magenta: linea ostruita fino all'ostacolo;
  - bianca: posizione di tiro cercata;
  - etichetta con stato e motivo.

Le regole sono identiche per alleati e nemici. La navigazione esistente (collisioni con i solidi e recupero da incastro) è stata riusata.

## Test (`tools/ai/ttank.js`, 18/18, due esecuzioni)
Per ciascun lato, Sherman contro Panzer IV e viceversa:
1. edificio in mezzo: nessuna vista e nessun colpo;
2. ostacolo tolto: il carro individua e spara;
3. bersaglio che si nasconde: posizione ricordata, nessun colpo, nuova posizione di tiro o attesa;
4. vista libera ma canna ostruita da un muretto: non spara;
5. proiettile sparato contro l'edificio: colpisce l'edificio, il carro dietro non viene toccato.

In più:
- il legno viene attraversato con perforazione ridotta (88 → 76 mm);
- un collider disattivato aggiorna subito la vista;
- Omaha: il Panzer non vede un fante dietro una casa; senza la casa lo vede e spara.

Regressione: IA fanteria 20/20, audio 22/22, campagna 20/20.

## Prestazioni (banco di prova, 12 carri per 20 s)
- 5–6 interrogazioni per fotogramma;
- 0,04–0,06 ms per fotogramma tra vista, tiro e proiettili;
- aggiornamento totale dei carri 0,4–0,6 ms per fotogramma.

FPS non misurabili qui (grafica software).

## Problemi residui
- Le esplosioni ad area (`explode`) non sono ancora schermate dai muri.
- I proiettili simulati a Kasserine controllano il carro bersaglio per punti ogni 2,5 m, come prima.
- I Panzer di Omaha non cercano posizioni di tiro alternative: lì seguono la strada.
- Kasserine non ha case distruttibili: lì la distruzione aggiornerà vista e tiro tramite lo stato dei collider, già supportato.
