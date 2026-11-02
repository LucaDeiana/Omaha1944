# Fisica dei veicoli 2.0

## Analisi del codice prima delle modifiche
**Mezzi terrestri presenti** (nessuno aggiunto):

| Mezzo | File | Tipo | Modello 3D | Movimento prima | Armi | Danni prima | Controllo |
|---|---|---|---|---|---|---|---|
| Panzer IV (Omaha, Ardenne) | `src/tank.js`, classe `Panzer` | carro medio | scafo, torretta e cannone in tre gruppi uniti (ruote e cingoli fusi nello scafo) | velocità interpolata verso un valore fisso, rotazione diretta, altezza media di 4 punti del terreno | 75 mm (esplosione al punto colpito), MG 34 coassiale | barra unica da 1500 | IA o giocatore dell'Asse |
| M4A1 Sherman, Panzer III J, Panzer IV G, Tiger I (Kasserine) | `src/armor.js`, classe `KasTank` | carri | come sopra | come sopra, stesso schema | cannone balistico vero (velocità iniziale, caduta), coassiale che partiva dalla bocca del cannone | corazza per faccia senza inclinazione delle piastre, faccia decisa dalla direzione e non dal punto, cingolo, torretta, motore ed equipaggio con probabilità fisse | IA o giocatore |
| Pak 40 | `src/armor.js`, `KasGun` | cannone anticarro fisso | base e cannone | fermo | 75 mm | barra unica | IA |
| Sd.Kfz. 251 | `src/mission.js`, `Halftrack` | semicingolato | gruppo unico | percorso a velocità costante, sempre orizzontale | MG 34 | barra unica | script |
| Sherman di Omaha | `src/mission.js`, `Sherman` | carro di supporto | gruppo unico | percorso a velocità costante, sempre orizzontale | tiro scriptato | nessuno | script |

Altri sistemi coinvolti:
- **collisioni**: `pushOut` (cerchio contro tutti i solidi, scorrendo l'intero elenco), spinta tra carri a cerchio unico di 5,5 m;
- **terreno**: `Hf` (altezza), nessun tipo di fondo;
- **audio**: `loopSound`/`play` con il sistema di audio personali (`caResolve`), già con eventi per motore, cingoli, torretta, cannone, ricarica e coassiale;
- **rete**: i carri non sono sincronizzati; sui client non vengono creati (`initTanks` esce se `NET.client`), Kasserine è solo in solitario.

**Riferimento prima delle modifiche** (banco di prova senza grafica, battaglia libera di Kasserine, 120 s simulati a passo 1/30 s, codice del commit precedente): `updateArmor` **0,35 ms** per passo in media, 99° percentile 3,2 ms, 15 carri, 159 colpi, 5 carri distrutti.
Non ho misurato FPS e draw call di riferimento: in questo ambiente la grafica è software e va a meno di 2 FPS, quindi quei valori non direbbero nulla.

## Cosa è stato fatto
Nuovo file `src/vehphys.js`, usato da tutti i carri (giocatore e IA con le stesse regole):
- **unità e parametri** documentati in testa al file; valori diversi per Sherman, Panzer III, Panzer IV e Tiger: massa, potenza, rendimento della trasmissione, velocità massima e di retromarcia, freni, interasse e lunghezza dei cingoli, raggio di sterzata, rotazione sul posto, sospensione (frequenza, smorzamento, corsa), gradino superabile, rinculo, brandeggio, elevazione, cadenza della coassiale, corazza con inclinazione;
- **passo fisso** 60 Hz (vicino, carro del giocatore), 30 Hz (150–450 m), 15 Hz (oltre), con accumulatore e al massimo 6 passi per fotogramma;
- **moto**: spinta = potenza utile / velocità, limitata dalla coppia della prima marcia (0,55 × peso) e dall'aderenza del fondo; innesto progressivo; cinque marce con isteresi e un breve calo di spinta a ogni cambio; pendenza, rotolamento, freni, freno motore; in discesa la velocità resta al regolatore; da fermi il carro resta frenato se l'aderenza basta;
- **cingoli differenziali**: sterzata limitata dal raggio minimo; da fermi lo Sherman e i Panzer girano su un cingolo bloccato (il carro avanza un poco), solo il Tiger ruota sul posto (cambio Olvar con sterzo rigenerativo); la sterzata consuma potenza (momento resistente μ·N·L/4 × velocità di rotazione); su fondi cedevoli gira meno; con troppa accelerazione laterale il carro slitta (più polvere, suono di slittamento se presente il file); sui pendii laterali troppo ripidi scivola di lato;
- **fondi** (aderenza e resistenza al rotolamento documentate): strada, terra, prato, ghiaia desertica, sabbia sciolta, neve, strada innevata, fango, roccia; scelti dalla mappa (strade, spiaggia, pendenze, rumore);
- **sospensioni**: 4 punti di contatto per lato (3 per il Panzer III e a media distanza) con molla, smorzatore e finecorsa, su altezza, beccheggio e rollio; la ruota sale sui gradini lungo una rampa invece di saltare; senza contatto il carro cade; mai sotto il terreno; da lontano l'assetto viene dal terreno senza molle;
- **ostacoli**: tre cerchi lungo lo scafo contro i solidi, cercati in una griglia spaziale di 12 m; i solidi più bassi del gradino (0,6 m, Tiger 0,79 m) si scavalcano sollevando lo scafo, quelli più alti fermano il carro; sacchetti, siepi e casse si schiacciano; carri contro carri (anche i relitti) con tre cerchi per carro, spostamento in proporzione alla massa, controllo solo fra carri vicini; urti con suono e scossone;
- **cingoli animati**: una fascia sul tratto superiore di ciascun cingolo con tessitura che scorre alla velocità di quel cingolo (opposta in retromarcia, diversa nelle curve), nascosta quando il cingolo si spezza. Si vede solo dove parafanghi, gonne e sovrastruttura non coprono il tratto superiore (dallo screenshot: poco visibile da sopra su tutti e quattro i modelli). Ruote e maglie del modello sono fuse nello scafo: non si muovono una per una, è lo scafo intero a muoversi sulle sospensioni;
- **torretta**: brandeggio ed elevazione con velocità e limiti meccanici per carro, rallentati dalla torretta o dal cannoniere colpiti; il brandeggio idraulico del Tiger dipende dai giri del motore; stabilizzatore in elevazione solo sullo Sherman (lo aveva davvero), che compensa in parte il beccheggio; canna dentro un edificio = niente tiro, con avviso;
- **rinculo**: la canna arretra (Sherman 0,30 m, Panzer III 0,30, Panzer IV 0,52, Tiger 0,58) in pochi centesimi di secondo e torna con smorzamento; lo scafo riceve l'impulso del colpo (proietto più gas) come rotazione, qualche decimo di grado; onda di polvere a terra, lampo, fumo, scossone della camera;
- **coassiale**: parte dalla feritoia accanto al cannone, cadenza per carro (Browning 460 colpi/min, MG 34 850), traccianti, dispersione. Mitragliatrici di scafo e antiaeree non sono armi separate nel gioco: non sono state aggiunte;
- **danni per componente** (scafo, torretta, cannone, motore, trasmissione, cingolo sinistro e destro, munizioni, più l'equipaggio già presente):
  - motore: meno potenza, fumo grigio sotto il 60%, nero sotto il 30%, arresti improvvisi sotto il 25%, fiamme quando è distrutto;
  - cingolo: un cingolo danneggiato fa deviare il carro, uno spezzato lo immobilizza;
  - trasmissione: velocità ridotta, a zero immobilizza;
  - torretta: brandeggio più lento, poi bloccato;
  - cannone: tiro meno preciso, poi impossibile;
  - munizioni: esplosione (la torretta vola via) o incendio;
- **corazza e perforazione**: si risale la traiettoria fino al vero punto d'ingresso (il proiettile avanza a passi di alcuni metri), si sceglie la piastra (fronte, fronte inferiore, fianco, retro, tetto, torretta fronte/fianco/retro), si calcola lo spessore efficace con l'inclinazione della piastra (limitato a 5 volte lo spessore agli angoli estremi), rimbalzo oltre 70° salvo calibro molto superiore alla piastra; esiti: nessuna perforazione, sfaldamento interno, perforazione con danni ai componenti attraversati (segmento di 2,6 m dentro il carro), danno critico; i cingoli si colpiscono senza corazza; l'esplosivo rompe soprattutto organi esterni; le esplosioni senza punto (bazooka, bombe, mine) danneggiano un componente scelto in base all'esplosione;
- **effetti**: segni d'impatto sullo scafo (al massimo 10 per carro, riusati), scintille, polvere o neve dai cingoli secondo il fondo, fumo dal motore e dalla torretta, incendi; relitti in fumo per 240 s e **al massimo 10 insieme** (`VP.WRECK_MAX`, `VP.WRECK_TIME`); particelle dai sistemi già in pool; effetti spenti oltre 450 m;
- **IA**: stessi comandi del giocatore (acceleratore e sterzo); rallenta prima delle curve; si ferma per sparare (lo Sherman rallenta soltanto, grazie allo stabilizzatore); il Tiger volge il fronte verso il bersaglio; manovra di sblocco (retromarcia sterzando) se non avanza per 3 s; ritirata verso un punto coperto dal terreno quando scafo, motore o cannone sono gravemente danneggiati; decisioni ogni 0,6 s; i Panzer di Omaha indietreggiano quando sono molto danneggiati;
- **camera**: in terza persona segue con un po' d'inerzia e si inclina con lo scafo; vibrazioni dal fondo e dagli urti della sospensione; scossoni per spari e colpi;
- **HUD** (quello già esistente): stato del motore, cingolo rotto o trasmissione rotta, torretta bloccata, cannone fuori uso o canna ostruita; nel pannello di Kasserine i due cingoli separati, la torretta, il motore e le percentuali di cannone, trasmissione e munizioni;
- **audio**: regime simulato dalle cinque marce e dall'acceleratore (altezza e volume del motore), cingoli secondo la velocità dei cingoli e lo slittamento, posizionale per gli altri carri; nuovi eventi personali per carro: `engine_idle`, `skid`, `armor_hit`, `ricochet`, `collision`, `explosion` (FLAC, WAV, OGG, MP3); senza file resta il suono originale, e il minimo e lo slittamento non aggiungono suoni.
- Semicingolato e Sherman di Omaha: ora seguono beccheggio e rollio del terreno (`vpGroundPose`).
- `src/vehbench.js`: benchmark in gioco, **Ctrl+Maiusc+B** nella Guerra corazzata (o `vehBench()` in console), con i dieci scenari richiesti.

**Rete**: nessuna modifica. I carri restano simulati solo dove esistono (host o solitario), quindi non ci sono due client che calcolano danni diversi. Il modello a passo fisso è pronto per un'eventuale sincronizzazione decisa dall'host, che non è stata fatta.

## Test eseguiti (banco di prova senza grafica, simulazione passo per passo)
| N. | Test | Risultato |
|---|---|---|
| 1 | Accelerazione Sherman su strada | 1 s 4 km/h · 5 s 20 · 10 s 31 · 15 s 39 km/h |
| 2 | Frenata da 39 km/h | fermo in 2,8 s e 15 m |
| 2b | Rilascio del gas da 39 km/h | fermo in 8 s |
| 3 | Retromarcia | massimo 11,5 km/h |
| 4 | Sterzata in marcia | 28°/s a 10 km/h |
| 5 | Sterzo da fermo | Sherman 12°/s avanzando 4 m (cingolo bloccato) · Tiger 11°/s fermo sul posto |
| 6 | Salita di un pendio di 19° | superato, +12 m di quota |
| 6b | Pendio di 38° | non superato (+3,9 m, poi ricade) |
| 7 | Discesa a motore al minimo | resta frenato |
| 7b | Discesa con il gas | 46 km/h (regolatore 42) |
| 8–9 | Velocità massima per fondo, Sherman | strada 43 · ghiaia desertica 20 · sabbia sciolta 13 · neve 18 · fango 8 km/h |
| 8–9 | Panzer IV nelle Ardenne | strada innevata 18–19 km/h |
| 10 | Ostacolo di 0,35 m a 19 km/h | superato, beccheggio −5,5/+6°, poi assestamento in circa 4 s |
| 11 | Cingoli | fascia che scorre in avanti e all'indietro; in curva a sinistra 2,5 m contro 3,1 m in un secondo |
| 12 | Torretta | 90° in 3,7 s (Sherman, 24°/s) |
| 13 | Elevazione | limitata a +25° e −9,7° |
| 14 | Rinculo | Sherman: canna 0,25 m a 0,05 s, 0,10 a 0,3 s, a riposo dopo 0,8 s, scafo +0,3° · Tiger 0,57 m, +0,4° · Panzer IV del giocatore a Omaha 0,47 m |
| 15 | Coassiale | parte a 2,1 m dalla bocca del cannone, accanto alla canna, 460 colpi/min |
| 16 | Muro di 2 m | non attraversato |
| 16b | Gradino di 0,5 m | superato |
| 16c | Carro contro carro | nessuna compenetrazione, il Panzer viene spinto di 0,24 m |
| 17 | Motore | 88 mm sul retro: motore distrutto; al 20% raggiunge 12 km/h invece di 38; distrutto: carro fermo, regime 0 |
| 18 | Cingolo | 3 colpi per spezzarlo, poi immobilizzato; al 40% devia di 5° in 5 s |
| 19 | Torretta e cannone | torretta al 30%: 8°/s invece di 17; distrutta: bloccata; cannone distrutto: non spara; al 40%: spara con 3,6 mrad di dispersione in più |
| 20 | Perforazione, 20 colpi per caso, Sherman a 300 m | Tiger frontale: nessuna perforazione · Panzer IV frontale a 0°: 8 perforazioni · a 60°: nessuna · fianco a 0°: tutte · fianco a 75°: rimbalzi o nessuna · retro: tutte |
| 20b | Esplosivo sul frontale del Panzer IV | sfaldamento, scafo 91 su 95 |
| 21 | Distruzione e relitti | 30 colpi da 88 mm sul fianco: 7 distrutti, 14 in fiamme; relitti limitati a 10 |
| 22 | IA in battaglia libera, 120 s, 10 carri | nessuna compenetrazione, nessun carro dentro i muri o sotto terra, manovre di sblocco usate, fino a 31 km/h |
| 23 | Audio personale (file finto inserito in memoria) | Sherman usa il file personale, Panzer IV l'originale; strato del minimo creato solo con il file |
| 24 | Audio senza file | suono originale; nessuno strato in più |
| — | Audio posizionale | volume 0,95 a 20 m, 0,08 a 900 m con filtro a 936 Hz |
| — | Panzer IV di Omaha (IA e giocatore dell'Asse) | l'IA percorre 79 m in 20 s su strada; il giocatore fa 42 m in 6 s; il bazooka danneggia componenti |
| — | Avvio di tutte le modalità e del visualizzatore | 10 configurazioni (Omaha Alleati e Asse, cecchini, Ardenne, aria, mare, Tunisia, Kasserine attacco, difesa e battaglia libera) con 5 s di gioco reale, più 8 mezzi nel visualizzatore: nessun errore JavaScript |

**Prestazioni** (stesso banco di prova del riferimento): `updateArmor` **0,44 ms** per passo in media contro 0,35 (99° percentile 4,2 contro 3,2 ms). Con 10 carri la fisica costa 0,08 ms per fotogramma, di cui 0,02 di collisioni, e l'IA 0,10 ms.

**Bilanciamento**: con la corazza inclinata calcolata davvero, molti colpi frontali che prima perforavano ora non passano (il 50 mm del Panzer III non perfora il frontale dello Sherman, il 75 mm dello Sherman non perfora il Tiger). Nella battaglia libera, in 2 minuti, i carri distrutti sono passati da 5 a 3.

**Benchmark in gioco** (Ctrl+Maiusc+B): eseguito qui per verificare che funzioni; tutti e dieci gli scenari girano senza errori, ma con la grafica software ogni scenario raccoglie solo pochi fotogrammi (0,3–1,5 FPS), quindi FPS e tempi di quel giro non vanno presi come misure. Draw call misurate: 100–260 a seconda dell'inquadratura, 360–700 mila triangoli.

**Non eseguiti**:
- FPS sul tuo PC: il benchmark grafico qui gira con grafica software e non ha valore;
- audio con file personali veri (provato solo con un suono già caricato al posto del file);
- multigiocatore: i carri non sono sincronizzati, prima come ora;
- guida a mano con tastiera e mouse;
- giudizio visivo sulla fascia animata dei cingoli nei vari modelli.
