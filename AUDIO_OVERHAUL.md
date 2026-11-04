# AAA Audio Overhaul 5.0 — report tecnico

Motore audio sperimentale (`src/aaa/xaudio.js`, XAE) **attivo solo nella tech demo «AAA Graphics Test»**. Nelle mappe originali, nella campagna e nel multiplayer resta il sistema audio originale; un test lo verifica.

## A. Audit del sistema esistente (`src/audio.js`)
**Punti buoni, mantenuti**:
- un solo AudioContext;
- bus di mixaggio per categoria; compressore morbido e limitatore finale;
- limite di 64 voci, con sostituzione della più debole;
- passaggio graduale da sparo vicino a lontano; ritardo del suono con la distanza; eco della scogliera;
- loop senza scatti; registrazioni CC0 reali degli spari.

**Cause della qualità limitata** (misurate dalla pipeline):
- campioni a **32 kHz mono**, **0,2–1,05 s**, con **code tagliate**;
- **clipping** già nei master di garand_2, kar98_0 e kar98_1;
- un solo riverbero sintetico (rumore con decadimento), uguale ovunque;
- solo panning stereo, niente audio 3D;
- niente livelli sovrapposti dello sparo; meccaniche e spari lontani **sintetizzati**;
- la variazione è solo di intonazione (±4%).

Non ho trovato loop incontrollati né AudioContext duplicati: i motori a giunzione «che si spegne e riparte» erano già stati corretti.

## B. ExperimentalAudioEngine
- **Mixer**: bus Weapons, Explosions, Vehicles, Environment, Voices e UI → Master → limitatore (-3 dBFS, attacco 1,5 ms) → saturazione morbida di sicurezza (lineare fino a -3 dBFS). La saturazione serve perché il compressore del browser non anticipa i transitori. Analizzatori prima e dopo il limitatore misurano picchi e clip. Abbassamento moderato del bus ambiente quando spara il giocatore.
- **Voci**: massimo 40, con priorità: giocatore 3, vicino 2, lontano 1. Una sorgente nuova di priorità maggiore sostituisce la più debole.
- **Spazializzazione**:
  - `PannerNode` HRTF entro 60 m, equal-power oltre;
  - listener allineato alla camera a ogni fotogramma;
  - il panner non attenua: la curva di distanza è una sola, quindi niente doppia attenuazione;
  - l'arma del giocatore non passa dal panner.
- **Distanza**, quattro bande (vicino < 25 m, medio < 150, lontano < 600, molto lontano):
  - guadagno con curva propria;
  - filtro passa-basso per l'assorbimento dell'aria (16 kHz → 900 Hz);
  - il transitorio sparisce oltre 150 m, la meccanica oltre 12 m, la mandata al riverbero cresce;
  - ritardo d/343 s.
- **Zone acustiche**: interno, fienile, cortile, strada, campo, bocage.
  - Ognuna ha un convolver con una **risposta all'impulso generata** (RT60, ritardo iniziale, prime riflessioni, smorzamento delle alte): **non registrata**.
  - La zona si riconosce da: volumi interni della demo, densità e lati degli edifici entro 22 m, vegetazione. Il passaggio tra zone è graduale.
- **Occlusione**: raggio sui solidi verso la sorgente, in cache per 0,1 s. Applica filtro (×0,3) e attenuazione, e lascia la mandata ambientale (attraverso un muro si sente la stanza).

## C. Pipeline degli asset (`tools/audio-pipeline/`)
- `process.py`:
  - controlla la licenza e rifiuta i file senza;
  - controlla frequenza, durata e clipping;
  - taglia il silenzio, non la coda;
  - normalizza la loudness per categoria, invece di portare tutto allo stesso picco;
  - converte in Ogg Vorbis a 48 kHz e in AAC; scrive `manifest.json`.
- Provata sui 29 campioni del progetto: ha segnalato tutti i difetti sopra e rifiutato il file di prova senza licenza.
- `MANIFEST.md`: asset acquisiti e asset da reperire.

## D–G. Armi
- **Profili per tutte le armi del gioco**: 12 profili XAE, più l'MG 42 usata dall'IA. Il Bazooka resta sui suoni originali.
- **Livelli dello sparo**:
  - **transitorio**: i primi 35 ms del campione, filtrati passa-alto;
  - **corpo**: il campione;
  - **meccanica**: campioni del gioco;
  - **coda**: rumore filtrato con inviluppo, generato;
  - **ambiente**: convoluzione di zona.
- Varianti senza ripetizioni immediate; intonazione ±1,5%; guadagno ±0,5 dB.
- **Raffiche** programmate sull'orologio audio alla cadenza reale (MG 42 1200, Thompson 700, MP 40 500, BAR 550 colpi/min). La coda suona solo ogni terzo colpo e sull'ultimo, così non si accumula.
- **Schiocco del proiettile** solo per le cartucce supersoniche (fucili, BAR, MG 42); sibilo per .45 ACP e 9 mm.
- **Meccanica sincronizzata con le animazioni Blender**: i suoni di ricarica e dell'otturatore girevole partono quando l'animazione raggiunge il punto (marcatori), non con timer fissi.
- I profili delle armi senza registrazione propria (Enfield, Mosin, G43, SVT-40) usano il campione più vicino con intonazione diversa: **non è la loro firma sonora reale**.

## F. AAA Audio Lab (F7)
- Scelta dell'arma, colpo singolo, raffica, anteprima della ricarica, proiettile che passa.
- **A/B con volume bilanciato**: si misura l'RMS dell'uscita di ciascun sistema e «Bilancia B su A» corregge il guadagno del nuovo.
- Distanza della sorgente (0–800 m), ambiente forzato, livelli attivabili e disattivabili.
- Stress test con 30 soldati; diagnostica dal vivo: stato del contesto, voci, zona, buffer, picchi prima e dopo il limitatore, clip, scartate, raggi di occlusione, ritardi.

## Test (`node tools/ai/taudio.js`, 29 controlli, tutti superati)
- Mappa originale con audio originale; motore attivo sull'AudioContext unico; 13 profili multistrato; nessuna ripetizione immediata.
- Bande di distanza; zone (interno e campo); occlusione con cache.
- Raffica MG 42 con intervalli misurati di 50,0 ms; marcatori di ricarica del Garand (clip, chiusura).
- Schiocco solo supersonico; limite delle voci con 30 soldati.
- Uscita sotto 0 dBFS con 0 clip: picco -9,2 dBFS dopo il limitatore, -7,0 prima.
- A/B; rilascio delle sorgenti; ritorno al menù; nessun errore.

**Non verificato e non verificabile qui**: la qualità percepita. Il browser headless calcola il segnale ma nessuno lo ascolta. **Non dichiaro che il suono sia «AAA»**: va giudicato a orecchio con l'Audio Lab e il confronto A/B bilanciato.

## Limiti
- **Nessuna registrazione nuova**: il proxy blocca Freesound, Wikimedia Commons, archive.org e OpenGameArt. La qualità di partenza resta quella dei campioni a 32 kHz con code tagliate.
- Code e riverberi sono generati (rumore filtrato e risposte all'impulso sintetiche), non registrati.
- Il costo CPU dell'audio non è esposto dal browser: il benchmark riporta voci, buffer, stato e scarti, non millisecondi di DSP.
- Veicoli ed esplosioni nella demo restano sul sistema originale. I bus esistono, ma i profili dedicati sono da fare.
