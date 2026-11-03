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

## Seconda fase: varianti e pose
**Varianti dell'equipaggiamento** (soldati vicini), deterministiche dal numero del soldato, 3 per fazione:
- americani: completo, senza coperta arrotolata, senza pala;
- tedeschi: con o senza il contenitore della maschera antigas, spesso lasciato nelle retrovie.

Ogni variante è un modello pelle condiviso: al massimo 3 modelli per fazione e arma.

**Pose e animazioni** (`src/soldier.js`, `src/crowd.js`). Si aggiungono al sistema procedurale esistente, che aveva già:
- passo legato alla velocità, quindi niente piedi che scivolano;
- inclinazione in accelerazione e in curva, respiro;
- accovacciato e prono con transizioni morbide;
- braccia sull'arma con cinematica inversa;
- pose pronto, mira, arma sul petto in corsa, al fianco per la mitragliatrice.

Nuovo:
- **In ginocchio** quando il soldato è fermo e basso (in copertura, sotto il fuoco, in mira accovacciato): ginocchio destro a terra, piede sinistro avanti, al posto dello squat «seduto nel vuoto»;
- **A riposo e in allerta**: senza nemici e senza fuoco addosso l'arma si abbassa con la volata verso terra, il peso passa da una gamba all'altra e la testa si guarda intorno; con un bersaglio torna pronta in pochi decimi di secondo;
- **Mira orientata dal busto**: il busto si gira subito verso il bersaglio (fino a ~30°), i piedi seguono più lentamente;
- **Rinculo**: a ogni colpo l'arma arretra nella spalla, la volata sale e la spalla cede, meno per i mitra;
- **Otturatore**: con Kar98k e Springfield, dopo ogni colpo la mano destra va alla leva, la apre, arretra e richiude, mentre la sinistra tiene l'arma; il Garand, semiautomatico, no;
- **Mitra** (Thompson, MP 40): arma più bassa e più vicina al busto in mira;
- **Sotto il fuoco**: appostato e non impegnato a sparare, testa incassata e spalle basse in proporzione alla soppressione;
- **Reazione al colpo per zona**: al busto spinto indietro, alla gamba il ginocchio cede, al braccio la spalla scatta;
- **Pose secondo la copertura** (dal tipo di riparo occupato dall'IA):
  - bassa (sacchetti, scarpata, cratere, relitto, ostacoli anticarro): in ginocchio anche per sparare da sopra, curvo e a testa bassa quando non spara;
  - alta (muro, rovina, casa, chiesa, carro, siepe, albero): a ridosso; per sparare si sporge di lato, dal lato del bersaglio rispetto al riparo; quando non spara sbircia oltre lo spigolo.

  È solo una posa: l'altezza usata dal combattimento dell'IA non cambia. Le sfere dei colpi del giocatore seguono il corpo, quindi chi spara in ginocchio dietro i sacchetti espone meno.
- **Variazioni individuali**: ampiezza dei gesti, ritmo dello sguardo e inclinazione dell'arma diversi per ogni soldato, oltre a fase del passo e del respiro già casuali.

Restano invariati:
- l'altezza di petto, occhi e bocca dell'arma usata dal combattimento (`chest`, `eye`, `muzzle`);
- velocità, IA, danni e rete.

Le sfere dei colpi seguono le ossa come prima: in ginocchio stanno dove sta il corpo.

**Verifica**: foglio delle pose dalla scena studio (riposo, mira, sparo, otturatore, riparo, corsa) con americani e tedeschi, fucile e mitra; triangoli invariati rispetto alla prima fase.

## Non fatto in questa fase (onestamente)
- **Nessun modello nuovo creato**: niente Blender, niente GLB nuovi; corpo e volto sono quelli già presenti, con licenze libere.
- **Nuovi ruoli visivi** (ufficiale, cecchino, equipaggi dei carri).
- **Animazioni ancora mancanti**:
  - ricarica visibile (l'IA non ha caricatori: andrebbe aggiunta anche nel gioco);
  - posa specifica per le finestre (arma appoggiata al davanzale);
  - piedi adattati alla pendenza;
  - morti diverse per postura (alla morte c'è già il ragdoll);
  - mitragliatrice su bipiede da prono (cambierebbe l'altezza del bersaglio, quindi il gameplay).
- **Mani**: geometria delle mani rifatta.
- **Normal map e ambient occlusion** sui tessuti.
- **Verifica dei 50 FPS sul tuo PC.**

Proposta per la fase successiva (dopo questa seconda fase):
1. varianti deterministiche dell'equipaggiamento (seme per soldato, 3–4 modelli per fazione e ruolo);
2. mani a pugno rifatte;
3. normal map del tessuto nell'atlante;
4. transizioni morbide tra le pose e reazioni ai colpi per zona;
5. misura sul tuo hardware.
