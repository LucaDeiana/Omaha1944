# Audio — asset acquisiti e asset da reperire

## Acquisiti (già nel progetto, usati dal motore sperimentale)
| File | Contenuto | Licenza | Stato tecnico (misurato da `process.py`) |
|---|---|---|---|
| `assets/sounds/{garand,thompson,bar,kar98,mp40,mg42,springfield,colt}_N.wav` (29 file) | spari reali | CC0, «The Free Firearm Sound Library» (OpenGameArt) | 32 kHz mono 16 bit; durata 0,2–1,05 s, code tagliate; alcuni master con clipping (garand_2, kar98_0/1). |
| campioni meccanici, schiocco, sibilo, passi (`src/audio.js`, `buildBank`) | sintetizzati nel gioco | originali del progetto | non sono registrazioni |

**Nessun file audio nuovo è stato scaricato.** Il proxy della sessione blocca freesound.org, commons.wikimedia.org, archive.org e opengameart.org.

## Da reperire (registrazioni di qualità con licenza CC0 o CC-BY, WAV/FLAC ≥ 48 kHz, ≥ 24 bit, code complete ≥ 2 s)
Per ogni arma del gioco (M1 Garand, Thompson M1A1, BAR M1918A2, Springfield M1903, Colt M1911A1, MP 40, Kar98k, Lee-Enfield No.4, Mosin-Nagant, G43, SVT-40, MG 42 dell'IA, Bazooka M1A1):
1. **Sparo vicino**: 4–6 varianti, microfono a 1–5 m, all'aperto, coda completa.
2. **Sparo lontano**: 2–3 varianti a 100–500 m.
3. **Meccanica**: otturatore (apertura e chiusura), inserimento ed estrazione del caricatore o della clip, sicura, grilletto. Per il Garand anche il «ping» della clip.
4. **Raffiche** (Thompson, MP 40, BAR, MG 42): sequenze di 5–10 colpi alla cadenza reale, per verificare il ritmo.

Generali:
- risposte all'impulso registrate (interno di casa in pietra, fienile, cortile, campo aperto, bosco o siepe);
- schiocchi supersonici a diverse distanze laterali;
- impatti su pietra, legno, terra e metallo.

Fonti da valutare (verificando la licenza **di ogni singolo file**):
- Freesound, con filtro per licenza CC0 o CC-BY;
- Wikimedia Commons (categoria dei suoni di armi da fuoco);
- la libreria completa «The Free Firearm Sound Library», di cui il progetto contiene solo estratti a 32 kHz.

## Importazione
`python tools/audio-pipeline/process.py <master> <uscita> licenze.csv`
- Rifiuta i file senza licenza compatibile.
- Taglia il silenzio, ma non la coda.
- Normalizza la loudness per categoria: spari -14 LUFS, meccaniche -22, ambienti -26, con tetto a -1 dBTP.
- Converte in Ogg Vorbis a 48 kHz e in AAC.
- Scrive `manifest.json` con metadati, misure e avvisi.

I master restano separati e non vengono mai modificati.

Limite noto: la misura EBU R128 non è affidabile sotto i 400 ms (per alcuni campioni risulta -inf), e la normalizzazione a un solo passaggio è approssimata sui suoni brevi.
