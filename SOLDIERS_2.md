# Soldati 2.0 — aspetto

## Analisi del codice prima delle modifiche
I soldati non erano costruiti con cubi: c'era già una pipeline a tre livelli (`src/crowd.js`).
- **Vicino** (fino a 30 soldati entro 40 m): un'unica `SkinnedMesh` per soldato con uno scheletro di 14 ossa, formata da:
  - il corpo umano base [Godot-Male-Base-Mesh](https://github.com/BoQsc/Godot-Male-Base-Mesh) (CC0, `assets/models/male_base.glb`), gonfiato lungo le normali come uniforme;
  - testa da scansione 3D (Lee Perry-Smith, Infinite Realities, CC BY 3.0) con 8 varianti del volto e 3 di barba;
  - uniforme dipinta su un atlante 1024×2048 condiviso per fazione;
  - armi con lo stesso modello della vista in prima persona.
- **Media distanza**: parti scolpite ad anelli (14 lati), istanziate.
- **Lontano**: le stesse parti a 6–7 lati, istanziate.
- **Animazioni**: procedurali (camminata, corsa, posture, mira con cinematica inversa delle braccia), ragdoll alla morte.
- **Bersagli dei colpi**: sfere agganciate alle ossa (`HITZ`), indipendenti dalla grafica.

**Cosa rendeva i soldati squadrati da vicino**: l'equipaggiamento era fatto di parallelepipedi:
- bretelle e cinghie a Y piatte e dritte, che sulle spalle sembravano assi;
- giberne, borse, fibbie e tasche a spigoli vivi;
- sottogola dell'elmetto M1 come due bastoncini dritti;
- un colletto più scuro della giacca, che sotto il volto sembrava un anello nero.

**Triangoli prima**: vicino circa 12.400 (equipaggiamento 3.500), medio 8.100, lontano 1.850.

## Cosa è cambiato
- **Volumi smussati**: un unico volume arrotondato condiviso (8 lati, 4 anelli) sostituisce da vicino i parallelepipedi dell'equipaggiamento: giberne, borse, fibbie, tasche, borraccia, pala.
- **Cinghie a nastro che seguono il corpo**:
  - americani: bretelle M1936 dal cinturone davanti, sopra la spalla, giù fino alla borsa sulla schiena;
  - tedeschi: cinghie a Y, due davanti dalle giberne alle spalle, unite dietro in una sola che scende al cinturone.
- **Sottogola M1**: due cinghie ricurve slacciate che ricadono ai lati del volto.
- **Colletto**: stesso colore della giacca, più sottile.
- Media e lunga distanza non sono cambiate (stesso costo).
- Scheletro, ossa, bersagli dei colpi, IA, animazioni e rete non sono stati toccati.

Confronto prima e dopo fatto con la stessa scena e la stessa luce (viste frontale, posteriore, laterale, ravvicinata sul busto e lontana). Regressione: tutte le modalità e il visualizzatore partono senza errori JavaScript.

## Misure (banco di prova, grafica software)
| Soldati in vista | Triangoli prima | Triangoli dopo | Draw call prima → dopo | Aggiornamento soldati prima → dopo |
|---|---|---|---|---|
| 1 | 15 mila | 17 mila | 2 → 2 | 0,18 → 0,16 ms |
| 20 | 253 mila | 298 mila | 37 → 36 | 0,30 → 1,10 ms |
| 40 | 463 mila | 535 mila | 75 → 76 | 0,62 → 0,60 ms |
| 60 | 625 mila | 706 mila | 80 → 79 | 0,86 → 0,76 ms |
| 80 | 786 mila | 877 mila | 82 → 83 | 1,18 → 1,04 ms |
| 100 | 935 mila | 1.034 mila | 101 → 101 | 2,20 → 1,28 ms |

Per soldato vicino: circa 14.900 triangoli invece di 12.400. Media e lunga distanza: invariate.
Gli FPS e i tempi di disegno non si possono misurare qui, perché la grafica è software. Il tempo di aggiornamento varia da un giro all'altro anche senza modifiche: il valore di 20 soldati dopo (1,10 ms) è rumore di misura.

## Non fatto in questa fase (onestamente)
- **Nessun modello nuovo creato**: niente Blender, niente GLB nuovi; corpo e volto sono quelli già presenti, con licenze libere.
- **Varianti di equipaggiamento per soldato**: tutti i fucilieri di una fazione hanno lo stesso equipaggiamento (varia solo il volto, la barba, le proporzioni della testa e la tinta).
- **Nuovi ruoli visivi** (ufficiale, cecchino, equipaggi dei carri).
- **Animazioni**: transizioni, reazioni ai colpi diverse per zona, morti diverse per postura, piedi adattati al terreno.
- **Mani**: geometria delle mani rifatta.
- **Normal map e ambient occlusion** sui tessuti.
- **Verifica dei 50 FPS sul tuo PC.**

Proposta per la fase successiva:
1. varianti deterministiche dell'equipaggiamento (seme per soldato, 3–4 modelli per fazione e ruolo);
2. mani a pugno rifatte;
3. normal map del tessuto nell'atlante;
4. transizioni morbide tra le pose e reazioni ai colpi per zona;
5. misura sul tuo hardware.
