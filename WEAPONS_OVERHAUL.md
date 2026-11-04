# Weapon Visual Overhaul 4.0 — stato

## Inventario delle armi (da `src/config.js`, nessuna arma inventata)
| Arma | Id | Modello attuale | Stato |
|---|---|---|---|
| M1 Garand | `garand` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Thompson M1A1 | `thompson` | **GLB Blender** (FP 2.788 / TP 1.580 / WD 1.324) | **convertita**: otturatore aperto, caricatore a stecca |
| BAR M1918A2 | `bar` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Springfield M1903A4 | `springfield` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Colt M1911A1 | `colt` | **GLB Blender** (FP/TP/WD) | **convertita** |
| M1A1 Bazooka | `bazooka` | **GLB Blender** (FP/TP/WD) | **convertita** |
| MP 40 | `mp40` | **GLB Blender** (FP 3.104 / TP 1.468 / WD 1.304) | **convertita**: calcio aperto, bachelite, leva a sinistra |
| Karabiner 98k | `kar98` | **GLB Blender** (FP 3.612 / TP 1.912 / WD 1.512) | **convertita**: otturatore girevole |
| Kar98k ZF39 | `kar98zf` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Lee-Enfield No.4 (T) | `enfield` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Mosin-Nagant 91/30 PU | `mosin` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Gewehr 43 ZF4 | `g43` | **GLB Blender** (FP/TP/WD) | **convertita** |
| SVT-40 PU | `svt40` | **GLB Blender** (FP/TP/WD) | **convertita** |
L'MG42 esiste solo come arma dell'IA (`AIW.mg`, suono) e non ha un modello giocabile.

## Sistemi esistenti, riusati senza modifiche di gameplay
- **Prima persona**: `src/weapons.js` (`buildViewmodel`, `updateViewmodel`): oscillazione, passo, respiro, rinculo visivo, ricarica generica col caricatore, otturatore a ritorno, strisciata, mischia. Il contratto dei punti (`muzzle`, `port`, `grip`, `fore`, `ads`, `hip`, `mag`, `magOut`, `charge`) resta lo stesso.
- **Fuoco**: fiammata e luce (`vmFlash`, `flashLight`), fumo, bossoli in pool (`fxCasing`, istanze), «ping» della clip vuota, suoni per arma.
- **Terza persona**: `gunGeo` in `src/crowd.js` (geometria unita a colori per vertice).
- **Armi a terra**: `spawnPickup`.
- **Danni, balistica, munizioni, tempi**: `WEAPONS` in `config.js`. **Non toccati**; un test lo verifica.

## Pipeline (`tools/asset-pipeline/`)
- `blender/lib/wgeo.py`: loft di sezioni (calcio), torniti, scatole smussate, profili estrusi; UV lungo l'arma.
- `blender/generators/m1garand.py`: generatore.
- `scripts/build_weapon.py`: tre modelli, materiali PBR con texture incorporate, punti di riferimento, esportazione GLB, validazione, pacchetto `.js`.
- Validatore: `validate_weapon` (nodi, parti mobili, punti, texture, lunghezza, allineamento delle mire).

## M1 Garand
- Dimensioni reali: 1,107 m, canna 610 mm, linea di mira 33 mm sopra la canna.
- Parti: calcio in noce con impugnatura semi-pistola, calciolo, due copricanna, fascette, canna rastremata con anima, cilindro del gas con tenone e mirino a lama con orecchie, castello con binari, diottra con foro passante, orecchie e tamburi zigrinati, fermo della clip, ponticello, sicura, magliette.
- Parti mobili separate: otturatore, asta di manovra con manetta, clip en-bloc con 8 cartucce .30-06 sfalsate (bossolo e palla), grilletto.
- Modelli: FP 8.916, TP 3.756, WD 2.564 triangoli; GLB da 778 KB.
- Materiali:
  - noce: Poly Haven `american_walnut_veneer`, CC0;
  - acciaio fosfatato: texture procedurale generata nella pipeline, perché le texture CC0 di metallo disponibili hanno bugnature, rivetti o ruggine;
  - ottone e rame: procedurali.
- Comportamento:
  - L'ADS si calcola dai punti diottra e mirino; scarto misurato 0,0003 in coordinate normalizzate.
  - Sparo: ciclo otturatore e asta.
  - Clip vuota: otturatore bloccato aperto, clip espulsa (un oggetto riusato).
  - Ricarica: clip dall'alto, poi rilascio dell'otturatore.
  - Tasto J: ispezione.
  - Caricamento in background; se il GLB manca si usa il modello procedurale.
- Showroom (F10, nella demo AAA): voci «nuovo» e «modello precedente», animazioni di sparo, ricarica e clip vuota, vista ADS, statistiche.

## Resa (aggiornamento)
- **Occlusione e usura cotte con Cycles** sul modello in prima persona: secondo set di UV senza sovrapposizioni, AO nel canale R, spigoli convessi (pointiness) nel canale G. A runtime gli incavi si scuriscono e gli spigoli dell'acciaio si schiariscono e si lisciano; il legno si consuma sugli spigoli.
- **Mani e avambracci da Blender** (`fp_arms`, 6.936 triangoli): dita a tre falangi in posa d'impugnatura, pollice, palmo modellato, polso, manica di lana della giacca M1941 con polsino e pieghe. Pelle e lana con texture procedurali. Sostituiscono capsule e cilindri quando l'arma è un modello Blender.

## Limiti dichiarati
- Mani **rigide in posa fissa**, senza scheletro: le dita non si muovono durante la ricarica. Le animazioni delle mani restano quelle generiche; solo le animazioni meccaniche sono specifiche del Garand.
- Nessuna fotografia di riferimento consultata in questa sessione: misure da dati tecnici noti.
- Tutte le 13 armi giocabili sono convertite.
- Le 9 armi dell'ultima fase hanno 1.000–4.000 triangoli in prima persona; i quattro fucili con ottica escono dallo stesso generatore parametrico (`boltrifles.py`) e si somigliano più degli originali.
- Con le ottiche, in mira il modello è nascosto dal reticolo (comportamento originale).
- Thompson, MP 40 e Kar98k hanno meno dettaglio del Garand (circa 3.000 triangoli in prima persona contro 8.900).
- La distanza dell'occhio in mira è regolata per arma (`WGLB.mech[id].eye`).

## Test
- `node tools/ai/twpn.js`: 12 test (mappa originale, ADS, ciclo, clip vuota, ricarica, ispezione, terza persona, a terra, fallback, valori invariati, nessun errore).
- `python tools/asset-pipeline/scripts/test_pipeline.py`: build reale con Blender, determinismo, validazione.
