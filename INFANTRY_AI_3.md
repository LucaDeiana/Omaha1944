# IA della fanteria 3.0

## Analisi del codice prima delle modifiche
| Funzione | Com'era | Problema | Intervento | Priorità | Rischio di regressione | Costo |
|---|---|---|---|---|---|---|
| Creazione e fazione | `Soldier` (`src/soldier.js`), liste `allies`/`enemies`, `team` A/E | — | nessuno | — | — | — |
| Individuazione dei nemici | `findTarget`: tutti i nemici entro la gittata, senza cono visivo; linea di vista solo sui 2 più vicini (5 per la MG) | **onnisciente**: senza nemici visibili prendeva comunque come bersaglio il più vicino, anche dietro un muro, e si girava verso di lui; `pickCover` e l'assalto tedesco assegnavano bersagli dal semplice conteggio dei nemici vicini | cono visivo, tempo d'individuazione, udito, memoria che decade, nessun bersaglio senza percezione | alta | medio (bilanciamento) | basso |
| Percorsi e ostacoli | `routeWaypoint`, `pushOut`, `unstick` (passo laterale, poi rinuncia) | adeguati | riusati | — | — | — |
| Mira e sparo | probabilità di colpo per distanza, postura, soppressione, difficoltà | sparo nello stesso istante dell'avvistamento | tempo di reazione | media | basso | nullo |
| Ricarica | caricatori (fase precedente) | — | usati da soppressione e morale | — | — | — |
| Ripari | `covers` con tipo, qualità e occupazione (`occ`), scelta in `pickCover` | buona base | riusati per ripiegamento e fiancheggiamento, con prenotazione e rilascio | — | — | — |
| Squadre | solo la squadra del giocatore (ordini segui/tieni/avanza), avanzata a sbalzi | nessuna squadra IA, nessun comandante, niente memoria condivisa | squadre IA con comandante e stati | alta | medio | basso |
| Soppressione | `supp` sale solo se il colpo era diretto a quel soldato; avanzata bloccata sopra 0,5–0,7 | i colpi diretti ad altri non spaventano | soppressione d'area, MG più forte, stato inchiodato | alta | basso | basso |
| Fiancheggiamento | assente | — | aggiramento contestuale | media | medio | basso |
| Morale | solo fughe scriptate (`flee`) | — | morale individuale e di squadra | media | medio | basso |
| Rinforzi | `src/reinforce.js` e missioni | — | non toccati | — | — | — |
| Rete | l'IA gira sull'host; client con marionette (`netPuppet`, `netProxy`) | — | il nuovo sistema gira solo dove gira l'IA | — | basso | — |
| Costo | think sfalsati (0,3–1,4 s, al massimo 30 per fotogramma), griglia spaziale di 20 m | — | frequenze separate per squadre e direttore | — | — | — |

**Riferimento prima** (battaglia di Omaha, 180 s simulati a 30 Hz):

| Misura | Valore |
|---|---|
| Tempo dell'IA | 2,76 ms per fotogramma (picco 39,7) |
| Linee di vista | 802 al secondo |
| Colpi | 11.796 (14 su bersagli non in vista) |
| Alleati | 130 → 104 |
| Tedeschi | 214 → 205 |

## Cosa è stato fatto (`src/infantry.js`, piccoli agganci in `src/soldier.js` e `src/weapons.js`)
### Soldato
- **Cono visivo** di circa 160° (360° entro 12 m).
- **Individuazione progressiva**: un soldato si «vede» dopo un tempo che dipende da:
  - distanza;
  - postura (prono 0,35, accovacciato 0,6);
  - movimento (×1,6);
  - riparo o trincea (×0,7);
  - feritoia (×0,5);
  - aver sparato da poco (×2,5).
- **Linea di vista** sempre e solo sui 2 candidati più vicini nel cono (5 per la MG): stesso numero di raggi di prima.
- **Memoria** dei nemici:
  - contenuto: ultima posizione, ora, affidabilità, fonte (vista, udito, squadra);
  - durata: dimenticati dopo 14 s;
  - comportamento: un nemico non più visto non è un bersaglio, il soldato sorveglia la sua ultima posizione nota.
- **Udito**: ogni sparo lascia a chi lo sente (fino a 140 m, 210 per la MG) una posizione stimata con un errore pari al 12% della distanza, compresi gli spari del giocatore.
- **Tempo di reazione** (0,35–0,9 s, di più con il morale basso) prima del primo colpo a un nuovo bersaglio.
- **Soppressione d'area**: ogni colpo che cade entro 3 m da un nemico lo spaventa, anche se era diretto a un altro. Il peso è 0,30 per la MG, 0,22 per il BAR e 0,15 per gli altri.
- **Inchiodato** sopra 0,85 di soppressione: per 2–4 s non spara, con testa incassata (posa della fase precedente).
- **Morale** individuale, con una «tenuta» personale fra 0,8 e 1,2 (nessuna differenza per nazionalità):

  | Fattore | Effetto |
  |---|---|
  | Fuoco addosso, perdite, morte del comandante, isolamento, ripiegamento della fazione | cala |
  | Calma, riparo, comandante vicino | risale |

  Gli stati sono CONFIDENT, STEADY, SHAKEN, DISORGANIZED e ROUTED:
  - sotto 0,5 il soldato reagisce più lentamente e spara più di rado;
  - sotto 0,15 va in rotta: lascia la posizione per un riparo lontano dal nemico, non spara, e si riprende sopra 0,4.
- I soldati di postazioni fisse (bunker, trincee, capisaldi) non vanno in rotta.

### Squadra
- **Formazione automatica**: ogni 3 s i soldati liberi entrano nella squadra vicina non piena (raggio 26 m, al massimo 6 soldati). La squadra del giocatore, i serventi dei bunker e i ruoli speciali restano fuori.
- **Comandante**: preferenza mitra, poi fucile, BAR, cecchino, MG. Alla sua morte subentra il successivo e tutti perdono morale.
- **Memoria condivisa** solo entro 50 m dal comandante: nessuna rete telepatica tra squadre o per fazione.
- **Stati della squadra**:
  - **HOLD**: senza contatto, comportamento esistente (avanzata a sbalzi, posti);
  - **SUPPRESS**: con contatto recente (meno di 6 s), MG e BAR (oppure un fuciliere, se mancano) sparano sull'ultima posizione nota anche senza vederla. Questi colpi non colpiscono mai: servono a sopprimere. Le raffiche sono più rade del tiro mirato;
  - **FLANK**: una posizione nemica ferma da 10 s, una squadra di almeno 4 soldati con almeno 3 liberi di muoversi, il morale sopra 0,45 e meno di metà squadra inchiodata. Il comandante cerca, sui due lati a 25, 35 o 45 m, un riparo:
    - libero;
    - non dentro un edificio;
    - entro 80 m;
    - preferibilmente non visto dal nemico.
    
    Due soldati (mai la MG o il BAR) ci vanno di corsa, chinati, mentre gli altri sopprimono. La manovra si interrompe se un fiancheggiatore cade o sono tutti inchiodati. Una nuova manovra è possibile dopo 70 s. Le rinunce sono contate per motivo;
  - **WITHDRAW**: morale medio sotto 0,28, oppure perdite di almeno il 60% (minimo 2): i soldati mobili ripiegano su ripari più lontani dal nemico;
  - **REGROUP**: senza contatto, chi si è allontanato più di 30 m torna verso il comandante.
- **Voce**: avvistamento, ordine di fiancheggiare, ripiegamento e successione usano il sistema delle grida esistente, con priorità e attese, e solo vicino alla camera.

### Carri, ripari e tiratori scelti (seconda fase)
- **Carri**:
  - un carro nemico entro 75 m e visibile alza la soppressione e abbassa il morale (il fucile non lo ferma);
  - entro 40 m il soldato mobile ripiega su un riparo lontano dal carro, al massimo una volta ogni 8 s;
  - davanti a un carro amico in movimento, entro 10 m, si sposta di lato.
  
  I Panzer di Omaha e delle Ardenne contano come tedeschi.
- **Ripari meno esposti**: quando la squadra ha un contatto, se il riparo scelto dalla logica esistente è sotto il tiro della posizione nemica nota, il soldato prende uno dei 4 ripari liberi più vicini (entro 10 m) che il nemico non vede.
- **Tiratori scelti**: dopo tre colpi cambiano posizione, su un riparo a 8–25 m che resta alla stessa distanza dal bersaglio.

### Percorsi, supporto e soldati lontanissimi (terza fase)
- **Tappa coperta**: con un contatto, se il punto di mezzo del tragitto verso il riparo è visto dal nemico noto e il tragitto supera 18 m, il soldato fa tappa su un riparo intermedio coperto, poi prosegue.
- **Supporto**: quando una squadra ripiega, la squadra vicina della stessa fazione senza contatto (entro 90 m) si porta 12 m dietro di lei per coprirla.
- **Livello 3**: oltre 350 m dalla camera, senza bersaglio e senza contatto di squadra, il soldato ragiona ogni 2–3 s invece che ogni 0,9–1,4 s. Il movimento e il combattimento continuano normalmente.
- Un errore introdotto in questa fase (un commento che inghiottiva la chiamata del ragionamento) è stato trovato dalla prova nell'arena e corretto prima della pubblicazione.

### Direttore di battaglia (versione leggera)
Ogni 3 s calcola per fazione il rapporto di forze e il morale medio, e decide l'atteggiamento:
- **attacco**: rapporto sopra 1,4 e morale sopra 0,55;
- **tenuta**;
- **ripiegamento**: morale sotto 0,3 e rapporto sotto 0,6. In ripiegamento le squadre non tentano fiancheggiamenti e il morale scende un poco.

Non sostituisce il sistema delle missioni né i rinforzi.

### Frequenze
| Livello | Frequenza |
|---|---|
| Percezione | col ciclo esistente dei soldati (0,3–0,55 s vicino, 0,9–1,4 s oltre 200 m dalla camera) |
| Squadre | 1 Hz (0,33 Hz oltre 300 m) |
| Direttore | ogni 3 s |
| Formazione delle squadre | ogni 3 s |

### Debug (Ctrl+Maiusc+I)
Per ogni soldato entro 60 m:
- squadra, comandante (★), stato della squadra e del soldato;
- inchiodato o in rotta;
- morale e soppressione;
- «vede» o «ricorda».

Le linee mostrano il comandante con i membri, l'ultima posizione nota e il riparo scelto. Il debug è spento per default.

## Test (cartella `tools/ai`, Playwright senza grafica, generatore deterministico)
`tinf.js`, test dei singoli comportamenti: **20 su 20 superati in tre esecuzioni consecutive**. Oltre a quelli elencati sotto: il Panzer vicino spaventa e fa cercare riparo; passo di lato davanti allo Sherman in movimento; il tiratore scelto cambia posizione dopo tre colpi.

| Test | Esito |
|---|---|
| Nemico dietro un edificio | sconosciuto |
| Nemico accovacciato e fermo a 32 m | individuato in 2 cicli |
| Nemico in piedi in movimento | individuato subito |
| Nemico alle spalle | non visto |
| Udito | posizione stimata, non esatta |
| Memoria | decade e viene cancellata |
| Squadra | formata con comandante |
| Successione del comando | con calo del morale |
| Soppressione | inchiodato e poi recupero |
| Morale | cala sotto il fuoco, si riprende in calma |
| Ripari | prenotazione e rilascio |
| Munizioni | ricarica |
| Morte | tolto dalla squadra |
| Riparo rimosso | nessun errore |
| Soppressione | non colpisce mai |
| Debug | funziona |

`t5.js`, scontri in un'arena del villaggio di Omaha (centro scelto dove ci sono più ripari e meno siepi), 120 s:

| Prova | Prima | Dopo |
|---|---|---|
| 5 contro 5, seme 1 | sopravvissuti A 4, E 3; 220 colpi | A 4, E 5; 956 colpi (529 di soppressione); 20 inchiodati; 1 fiancheggiamento tentato e interrotto |
| 5 contro 5, semi 2 e 3 | — | A 2–3, E 5; una squadra ripiega dopo le perdite; successione del comando |
| 6 americani contro MG e fuciliere fermi e invulnerabili (fiancheggiamento) | — | seme 3: due fiancheggiatori raggiungono un riparo sul fianco a 30–47 m dalla MG, fuori dalla sua vista; altri semi: rinuncia per perdite o per mancanza di un fianco praticabile |

Nell'arena chi difende fermo e al riparo vince: il primo avvistamento e la reazione sono più lenti per chi è fermo e basso, e la MG inchioda chi avanza.

`aib.js`, battaglia completa di Omaha, 180 s:

| | Prima | Dopo |
|---|---|---|
| Tempo dell'IA | 2,76 ms | 3,81 ms |
| Picco | 39,7 ms | 32,9 ms |
| Linee di vista al secondo | 802 | 778 |
| Colpi | 11.796 | 20.816 (soppressione) |
| Alleati | 130 → 104 | 130 → 103 |
| Tedeschi | 214 → 205 | 214 → 204 |

Le squadre da sole costano circa 0,01–0,08 ms; il resto del costo viene dai colpi in più (effetti e suoni). I capisaldi tedeschi di Omaha sono postazioni fisse: tengono la posizione, non fiancheggiano né ripiegano.

Regressione: tutte le modalità e il visualizzatore partono senza errori. Inoltre 60 s di combattimento nelle Ardenne e in Tunisia senza errori. In Tunisia (tutti contro tutti) le squadre sono disattivate; i colpi in 60 s variano molto da una partita all'altra (prima 74–79, dopo 17–155).

## Non fatto (onestamente)
- **Navigazione tattica con costo d'esposizione lungo tutto il percorso**: si usa la navigazione esistente; è coperta solo la destinazione (ripari meno esposti).
- **Assistente mitragliere**: non esiste come soldato nel gioco.
- **Carri e fanteria nella stessa battaglia**: verificati solo dai test, perché nei 120–180 s simulati a Omaha i Panzer non arrivano vicino alla fanteria.
- **Settori e rinforzi del direttore**: oggi decide l'atteggiamento della fazione e il supporto tra squadre vicine, non sposta rinforzi.
- **Tappe coperte e supporto tra squadre** verificati solo nel codice: l'arena ha una squadra per parte e nelle prove non sono scattati.
- **Simulazione astratta dei soldati lontani**: non c'è; c'è il livello 3 con decisioni più rare.
- **Prove di rete con due computer**: il nuovo sistema non gira sui client (`NET.client`) e non aggiunge messaggi di rete.
- **Scontri 20 contro 20 e 40 contro 40 nell'arena**: la battaglia completa di Omaha, con oltre 300 soldati, copre la scala.
- **FPS sul tuo PC**: da misurare in una battaglia a Omaha. Ctrl+Maiusc+I mostra lo stato dell'IA.
