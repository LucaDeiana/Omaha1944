# First-Person Arms & Hands Overhaul 5.0 — prima fase (M1 Garand e archetipi)

**Solo nella tech demo «AAA Graphics Test».** Nelle mappe originali restano le braccia precedenti; un test lo verifica.

## A. Audit
- **Gioco principale** (`src/guns.js`, `src/weapons.js`): mani a capsule e braccia a cilindri; con le armi Blender ci sono `fp_arms`, cioè mani rigide in posa fissa e avambracci stirati tra due punti. Non esistono scheletri, rig né un sistema di animazione scheletrica.
- **Riutilizzati**:
  - il moto dell'arma di `updateViewmodel` (oscillazione, passo, respiro, rinculo, scatto, cambio arma, mira);
  - la posizione della mano sinistra animata dalla ricarica (`i.lhand`: caricatore, clip, otturatore);
  - i punti di presa dei GLB delle armi (`grip_r`, `grip_l`);
  - il Movement Lab (`XPC`) per scavalcamento e inclinazione;
  - i marcatori audio della ricarica.
- **Weapon Handling & Physics 5.0** non esiste nel progetto: le braccia si agganciano al sistema dell'arma esistente.

## B–E. Pipeline Blender (`tools/asset-pipeline/blender/generators/fp_rig.py`, `scripts/build_rig.py`)
- **Pelle**:
  - uno scheletro di vertici con raggi ellittici (spalla, gomito, ventre muscolare dell'avambraccio, polso, nocche, falangi, eminenza del pollice) passa per il **modificatore Skin** e diventa un'unica superficie continua;
  - **Subdivision Surface** a 2 livelli la arrotonda, poi viene applicata;
  - il **palmo** è un volume a sezioni ellittiche (dorso arcuato, rastremato verso le dita), unito alla pelle prima dei pesi.
- **Armatura**: 22 ossa per braccio (omero, avambraccio, mano, 3 per il pollice, 4 per ogni altro dito con il metacarpo). **Pesi automatici** di Blender (diffusione di calore). Unghie rigide sulle falangette.
- **Manica della giacca M1941** in lana oliva: pieghe, sacca al gomito, polsino con bordo rivoltato e bottone; pesi sfumati tra omero e avambraccio.
- **Materiali**: pelle (pori e micro-rughe nella normale, rugosità variabile) e lana di serge (trama diagonale 2/2) **procedurali**, perché non ci sono texture CC0 di pelle disponibili. Unghie e bottone con materiali propri.
- **Uscita**: `assets/aaa/arms/fp_arms_rig.glb` (19.632 triangoli per due braccia, 863 KB, 2 armature, pesi su 4 influenze). Validatore: armature, ossa, pesi, texture.
- **Varianti di fazione**: possibili cambiando colore e materiale della manica (`build_rig.py`); non implementate prima della validazione del modello americano.

## F–I. Runtime (`src/aaa/fparms.js`)
- **IK a due ossa analitica**: spalle fisse nello spazio della camera, polso sul punto di presa, gomito orientato da un vettore guida (in basso e all'esterno). Le mani seguono l'arma, quindi oscillazione, respiro, rinculo, scatto e cambio arma non vengono mai applicati due volte.
- **Impugnature** per archetipo (fucile, mitra, pistola, tubo), con posizione e orientamento del polso nello spazio dell'arma. La flessione delle dita è calcolata dallo **spessore dell'impugnatura**. Calibrazione per arma salvata nel browser.
- **Dita**:
  - flessione per falange con velocità diverse per dito, quindi mai un blocco unico;
  - indice sul grilletto che si chiude allo sparo;
  - presa della mano sinistra durante la ricarica.
- **Ricarica**: la mano sinistra segue la posa animata dell'arma (clip del Garand, caricatori). **Scavalcamento** (Movement Lab): la mano sinistra lascia l'arma verso l'ostacolo.
- **Micro-aggiustamenti del polso** a riposo (±0,7°, lenti).
- Con le braccia vere l'arma a fianco sta 7 cm più vicina e la spalla sinistra è portata avanti; le braccia sono più lunghe dell'8%, un'esagerazione abituale nelle viste in prima persona. La mira dalle mire resta esatta.
- **Correzione importante**: le matrici dello scheletro vengono aggiornate esplicitamente. Il Benchmark Lab disattiva `renderer.info.autoReset`, e senza questo il renderer non le ricalcolava mai.

## J. First-Person Arms Lab (F11 nella demo)
- Camera orbitale attorno a braccia e arma: si ruota trascinando, si fa zoom con la rotella.
- Scheletro, wireframe, vista del giocatore, confronto con le mani precedenti.
- Test animati: mira, rinculo, ricarica, scatto, mano libera (scavalcamento), cambio arma.
- Scelta dell'arma, cursori di calibrazione (polso x/y/z e rotazione per mano), statistiche.

## Test (`node tools/ai/tarms.js`: 25 controlli, tutti superati)
- **Coperti**: mappa originale invariata; rig (44 ossa, GLB validato); IK e impugnatura su tutte le 13 armi, a fianco e in mira; dito sul grilletto; dita sfalsate; ricarica; rinculo senza doppioni; mano libera nello scavalcamento; scatto, accovacciato, prono e inclinazione; cambio arma; skinning vivo; costo; Arms Lab; nessun errore.
- **Misure**:
  - errore del polso sul punto di presa 0,0 mm, braccio esteso al 43–89% (mai bloccato a fondo corsa), gomito sotto la linea spalla–polso;
  - IK più dita: 0,1 ms per fotogramma (CPU in headless).

## Limiti dichiarati
- **Animazioni procedurali guidate da dati**, non clip scolpite in Blender: pose, IK e tempi sono calcolati; nessuna animazione keyframe di ricarica.
- La **mano** è ottenuta con Skin e Subdivision, non scolpita: niente pieghe cutanee né tendini modellati, e le nocche sono semplici. Il realismo non è da FPS commerciale.
- Le impugnature sono per **archetipo** (4) con calibrazione per arma, non pose dedicate per ognuna delle 13 armi.
- Nessuna weight map dipinta a mano: pesi automatici, e manica con pesi lineari.
- Gli FPS veri vanno misurati sul tuo PC (F9, Benchmark Lab).
