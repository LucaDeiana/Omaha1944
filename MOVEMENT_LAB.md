# AAA Movement Lab 1.0

Controller sperimentale della fanteria, **attivo solo nella tech demo «AAA Graphics Test»** (`SCEN === 'aaa'`). Nelle mappe originali, nella campagna e nel multiplayer non cambia nulla; un test lo verifica.

## Audit (sistemi esistenti)
- **`src/player.js`, `updatePlayer`**: in un'unica funzione gestisce input, velocità con un `lerp` di accelerazione fissa, posture (`P.stance` 0/1/2 con i tasti C/Ctrl e Z), scatto con fiato, salto, gravità, acqua, ferite, collisioni (`pushOut` sui solidi AABB, `worldFloor` per pavimenti e rampe, `Hf` per il terreno), passi, fuoco e interazione.
- **`updateCamera`**: altezza degli occhi per postura, oscillazione dei passi, rollio laterale, FOV di scatto e di mira.
- **`src/weapons.js`, `updateViewmodel`**: moto dell'arma da `P.moveK`, `P.bobPh`, `P.sprintK`, `P.vel`, `P.vy`, `P.stance`, `P.adsK`, `swayX/Y`.
- **Non esistono**: inclinazione, scavalcamento e arrampicata, verifica del soffitto, animazioni scheletriche del soldato in prima persona. Weapon Handling & Physics 5.0 non è presente nel repository: il controller alimenta il sistema dell'arma esistente.
- **Dipendenze riusate senza modifiche**: `solids`, `addSolid`, `pushOut`, `rayBox`, `pointInSolid`, `FLOORS` e `worldFloor`, `Hf`, `KEYS`, `P`, `camera`, `sfxStep`, `play`.

## Integrazione (modifica retrocompatibile)
In `updatePlayer` il blocco di movimento è dentro `if (xpcActive()) xpcUpdate(dt, w); else { …codice originale identico… }`. La camera segue lo stesso schema (`xpcCamera` / `updateCamera`). `xpcActive()` è vero solo con `XPC.on` e `SCEN === 'aaa'`; il flag si attiva in `aaaInit`. Il diff della funzione, ignorando l'indentazione, sono solo queste righe.

## Componenti (`src/aaa/movelab.js`)
- **Input**: W/A/S/D, Maiusc (scatto), C/Ctrl e Z (posture), Spazio (salto, oppure scavalcamento davanti a un ostacolo), Q/E (inclinazione). Nel laboratorio F sostituisce E per interagire, perché nel gioco Q ed E sono già usati (arma precedente, interazione).
- **Movimento**:
  - accelerazione e frenata con valori in m/s², attrito, controllo in aria limitato;
  - diagonale normalizzata, frenata più forte quando si inverte la direzione;
  - pendenze dal gradiente del terreno, con rallentamento in salita e blocco oltre `slopeMax`;
  - gradini e scale aggirati entro 45 cm; si può stare in piedi sulla sommità dei solidi;
  - **sotto-passi fissi ≤ 1/120 s**: stesso percorso a 30, 60 e 144 FPS.
- **Posture**:
  - in piedi, accovacciato e prono, con l'altezza del collider interpolata;
  - prima di alzarsi si controlla lo spazio sopra la testa;
  - niente scatto in mira, da prono o durante l'inclinazione; premere la mira interrompe lo scatto.
- **Inclinazione**: Q/E, angolo e distanza regolabili. Lo spostamento della testa è limitato dalla distanza libera misurata con un raggio sui solidi, così la camera, e quindi l'origine dello sparo, non entra nei muri. È ridotta in mira.
- **Camera**:
  - altezza degli occhi con smorzamento critico, che assorbe gradini e irregolarità;
  - oscillazione legata ai passi; beccheggio all'accelerazione e alla frenata; abbassamento all'atterraggio; rollio laterale;
  - intensità regolabile, fino a 0 per accessibilità.
  - All'arma passano solo dati (velocità, postura, atterraggio): il suo moto lo calcola `updateViewmodel`, senza duplicare gli offset.
- **Scavalcamento e arrampicata** (solo con Spazio davanti all'ostacolo):
  - si rilevano altezza, profondità della sommità, superficie di atterraggio, spazio per il corpo e passaggio libero sopra;
  - scavalcamento fino a 1,15 m con profondità ≤ 0,8 m; arrampicata fino a 1,95 m.
  - Il movimento è una **transizione procedurale provvisoria**: curva di Bézier con l'arma abbassata, non un'animazione.
- **Animazioni**: `XPCAnim` calcola i pesi di blending per idle, walk, run, sprint, crouch, prone, lean, vault e mantle. **Nessuna clip esiste**: non c'è ancora un modello del soldato in prima persona con scheletro. Il pannello le elenca come mancanti.

## Movement Lab
- **Percorso di prova**: prove A–J dentro il villaggio esistente, con riferimenti relativi e nessuna coordinata fissa della mappa. Ostacoli aggiunti solo dove servono: un muretto da 0,9 m, un ripiano da 1,5 m e una trave a 1,32 m per passare accovacciati. Le prove D (muro) e J (scala e interni) usano la casa normanna.
- **Pannello F6 «MOVEMENT LAB — DEBUG»**:
  - mostra velocità, accelerazione, stato, postura, altezza del collider, contatto col terreno, pendenza, inclinazione e spazio libero, scavalcamento, mira, tempo del controller e raggi lanciati;
  - cursori per i parametri, «Reset defaults», pulsanti per teletrasportarsi alle prove;
  - un interruttore passa dal controller sperimentale all'originale, per confrontarli.

## Test (`node tools/ai/tmove.js`, 23 controlli, tutti superati)
- **Coperti**: avvio, accelerazione e frenata, diagonale e inversione, frame rate variabile, scatto e fiato, posture e altezze, soffitto, inclinazione contro il muro, scavalcamento, arrampicata, rifiuto dei muri alti, mira, terreno irregolare, scala, collisioni, oscillazione disattivabile, dati all'arma, costo, benchmark, reset, ritorno al menù, mappa originale invariata, nessun errore.
- **Misure in headless (SwiftShader, CPU)**:
  - da 0 al 95% della velocità in 0,15 s, arresto in 0,17 s;
  - `updatePlayer` costa 0,014 ms con il controller sperimentale e 0,010 ms con l'originale.
  - Gli FPS veri si misurano sul PC con il Benchmark Lab.

## Limiti e lavoro futuro
- Animazioni scheletriche assenti: servono un modello del soldato in prima persona con scheletro e clip di Blender.
- Nessun suono specifico per scavalcamento e posture, oltre a quelli esistenti.
- Per portarlo nel gioco principale: interfacce già separate (`XPCWorld`, configurazione `XPC_DEFAULTS`, flag `XPC.on`). Serve la tua approvazione.
