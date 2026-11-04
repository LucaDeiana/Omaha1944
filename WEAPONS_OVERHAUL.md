# Weapon Visual Overhaul 4.0 — stato

## Inventario delle armi (da `src/config.js`, nessuna arma inventata)
| Arma | Id | Modello attuale | Stato |
|---|---|---|---|
| M1 Garand | `garand` | **GLB Blender** (FP/TP/WD) | **convertita** |
| Thompson M1A1 | `thompson` | **GLB Blender** (FP 2.788 / TP 1.580 / WD 1.324) | **convertita**: otturatore aperto, caricatore a stecca |
| BAR M1918A2 | `bar` | procedurale | da convertire |
| Springfield M1903A4 | `springfield` | procedurale (ottica) | da convertire |
| Colt M1911A1 | `colt` | procedurale (carrello animato) | da convertire |
| M1A1 Bazooka | `bazooka` | procedurale | da convertire |
| MP 40 | `mp40` | **GLB Blender** (FP 3.104 / TP 1.468 / WD 1.304) | **convertita**: calcio aperto, bachelite, leva a sinistra |
| Karabiner 98k | `kar98` | **GLB Blender** (FP 3.612 / TP 1.912 / WD 1.512) | **convertita**: otturatore girevole |
| Kar98k ZF39 | `kar98zf` | procedurale (ottica) | da convertire |
| Lee-Enfield No.4 (T) | `enfield` | procedurale | da convertire |
| Mosin-Nagant 91/30 PU | `mosin` | procedurale | da convertire |
| Gewehr 43 ZF4 | `g43` | procedurale | da convertire |
| SVT-40 PU | `svt40` | procedurale | da convertire |
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

## Limiti dichiarati
- Le **mani e le braccia** sono ancora quelle del gioco, fatte di capsule: niente modello scheletrico. Le animazioni delle mani restano quelle generiche; solo le animazioni meccaniche sono specifiche del Garand.
- Nessuna fotografia di riferimento consultata in questa sessione: misure da dati tecnici noti.
- Restano da convertire 9 armi (BAR, Springfield, Colt, Bazooka, Kar98k ZF39, Enfield, Mosin, G43, SVT-40).
- Thompson, MP 40 e Kar98k hanno meno dettaglio del Garand (circa 3.000 triangoli in prima persona contro 8.900).
- La distanza dell'occhio in mira è regolata per arma (`WGLB.mech[id].eye`).

## Test
- `node tools/ai/twpn.js`: 12 test (mappa originale, ADS, ciclo, clip vuota, ricarica, ispezione, terza persona, a terra, fallback, valori invariati, nessun errore).
- `python tools/asset-pipeline/scripts/test_pipeline.py`: build reale con Blender, determinismo, validazione.
