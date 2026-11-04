# AAA Asset Pipeline 2.0 — Omaha1944

Pipeline Blender → GLB → validazione → Three.js per gli asset della tech demo «AAA Graphics Test». Le mappe originali non caricano nulla di tutto questo.

## Requisiti ed esecuzione
- Blender 5.2.3 LTS come modulo Python: `pip install bpy==5.2.3` (Python 3.13). In alternativa Blender completo: `blender --background --python tools/asset-pipeline/scripts/build.py -- normandy_house_01`.
- Generare tutti gli asset: `python tools/asset-pipeline/scripts/build.py`.
- Test della pipeline (bpy reale, determinismo, variante, validatore): `python tools/asset-pipeline/scripts/test_pipeline.py`.
- Test nel browser (caricamento, LOD, collisioni, showroom, pulizia, mappe originali): `node tools/ai/tpipe.js`.
- Validare un GLB senza Blender: `python tools/asset-pipeline/blender/validators/validate_glb.py assets/aaa/pipeline/normandy_house_01.glb`.

## Struttura
| Percorso | Contenuto |
|---|---|
| `blender/lib/geo.py` | Accumulatore di geometria per LOD e materiale, UV planari in metri, venatura del legno, rumore deterministico |
| `blender/generators/normandy_house.py` | Generatore parametrico della casa normanna, a componenti (muri con aperture, cantonali, mostre, finestre, scuri, porta, tetto, comignoli, grondaie, interno, camino, scala) |
| `blender/validators/validate_glb.py` | Validatore (solo libreria standard) |
| `manifests/assets.json` | Asset: generatore, seme, parametri, distanze LOD per preset, budget |
| `manifests/materials.json` | Libreria dei materiali: slot → texture CC0 già nel progetto, ripetizione, tinta, rugosità |
| `scripts/build.py`, `scripts/test_pipeline.py` | Costruzione e test |
| `reports/` | Rapporti del validatore |
| `assets/aaa/pipeline/` | Uscite runtime: `.glb`, `.json` (manifest), `.js` (GLB in base64 per funzionare anche da `file://`) |
| `src/aaa/pipeline.js` | Caricamento asincrono con cache, materiali condivisi, LOD, collisioni, pavimenti, interni, pulizia |
| `src/aaa/showroom.js` | 3D Asset Showroom (F10, o dal pannello F9) |

Sorgente = generatori e manifest; runtime = file in `assets/aaa/pipeline/`. Le texture non vengono copiate: il GLB porta solo i nomi degli slot; il runtime crea un materiale condiviso per slot con le texture Poly Haven già caricate dalla demo. La scala delle texture è nelle UV.

## Casa normanna (`normandy_house_01`)
Longère del Bessin: 12,4 × 6,6 m, muri da 55 cm, gronda a 3,35 m, falde a 50°, colmo a 7,5 m. Facciata verso +Z (glTF), origine al centro della pianta a quota terreno.
- Esterno: pietrame con superficie irregolare (rumore deterministico), cantonali alternati lunghi/corti sporgenti, mostre di pietra, architravi monolitici, davanzali con gocciolatoio, finestre a due ante con traverse e vetro, scuri a doghe con traverse e controvento a Z, bandelle e cardini di ferro, porta a doghe con bandelle, anello e gradino, zoccolo di pietra umida, ~3.360 ardesie singole, colmo in coppi, puntoni a vista, frontalini, bandinelle, due comignoli, grondaie su cicogne e pluviale. Edera e muschio a runtime.
- Interno esplorabile: pavimento a lastre, travetti di quercia e tavolato, tramezzo con vano porta e anta aperta, camino, scala ripida di 13 alzate fino al sottotetto (botola dimensionata per 1,75 m di altezza libera), sottotetto calpestabile.
- LOD: LOD0 70.358 triangoli, LOD1 12.788, LOD2 1.392. Distanze: LOW 10/35 m, MEDIUM 22/60, HIGH 30/80, ULTRA 42/110.
- Collisioni: 60 scatole separate dalla mesh visiva, più 8 superfici calpestabili con la scala a rampa.
- File: 6,1 MB di GLB, 17 materiali, nessuna texture incorporata.
- Parametri: `width`, `depth`, `wall`, `eave`, `pitch`, `front_windows`, `back_windows`, `door_slot`, `chimneys`, `wear`, `shutters_open`, `seed`.

## Limiti dichiarati
- Il pip ufficiale di `bpy` non include Draco e meshopt, quindi i GLB non sono compressi.
- Nel progetto non c'è una texture CC0 di pietra di Caen: i cantonali usano l'intonaco a calce schiarito. Il vetro è procedurale. Il muschio è solo nello shader: i ciuffi di geometria sembravano palline e sono stati tolti.
- La venatura del legno segue l'asse lungo di ogni pezzo, ma le UV sono planari: non c'è AO cotta.
- Vegetazione e props: la demo ha già alberi, siepi, edera e props procedurali. La pipeline non li duplica; i generatori Blender dedicati restano da fare.
- Le rotazioni degli asset nel mondo sono a multipli di 90° (collisioni AABB).
