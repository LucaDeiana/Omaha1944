# Audio personalizzati — guida

Ogni suono di Fronte Occidentale 1944 può essere sostituito con un tuo file audio. Basta mettere il file nella cartella giusta: non serve toccare il codice.

**Regola:** se il file personale esiste ed è valido, il gioco usa quello. Se manca o è rovinato, usa il suono originale. Vale evento per evento: puoi cambiare solo lo sparo del Kar98k e lasciare tutto il resto com'è.

## Dove mettere i file
| Come avvii il gioco | Cartella |
|---|---|
| Programma installato (Windows) | `Documenti\Fronte Occidentale 1944\audio` — si apre con **Ctrl+U** dentro il gioco |
| File .bat / browser (server locale) | `local-assets/audio` nella cartella del gioco |

La cartella `local-assets/` è esclusa da Git e dal pacchetto di installazione: i tuoi file restano solo sul tuo PC. Il server li serve solo a questo PC (gli altri giocatori in rete non possono vederli né scaricarli). In multigiocatore ognuno sente i propri file.

## Nomi dei file
- Formati: **.flac, .wav, .ogg, .mp3**. Se lo stesso suono esiste in più formati, vale la priorità flac → wav → ogg → mp3 (prima la qualità piena).
- Il nome è quello della colonna «File» qui sotto, con l'estensione che vuoi. Esempio: `weapons/rifles/kar98zf/fire.mp3`.
- **Varianti:** aggiungi `_01`, `_02`, … prima dell'estensione (`fire_01.mp3`, `fire_02.mp3`). Il gioco le alterna senza ripetere subito la stessa.
- I file vengono letti **all'inizio di ogni partita**: dopo averne aggiunto uno, avvia una nuova partita.
- Un file che non si riesce a leggere viene ignorato (resta l'originale) e segnalato nella console (F12 nel programma).

## Creare le cartelle
```
npm run audio:scaffold                       (crea local-assets/audio)
npm run audio:scaffold -- "C:\Users\Tu\Documents\Fronte Occidentale 1944\audio"
npm run audio:scaffold -- <cartella> weapons     (solo una categoria)
```
Crea solo le cartelle, non crea file audio e non tocca quelli che ci sono. Scrive anche `EVENTI_AUDIO.csv` con l'elenco completo degli eventi (apribile con Excel).

## Come funziona la ricerca
Per uno sparo del Kar98k ZF39 il gioco cerca, nell'ordine:
1. `weapons/rifles/kar98zf/fire` (evento dell'arma)
2. `weapons/rifles/kar98/fire` (suono generico usato da quel tipo di arma)
3. il suono originale.

Lo stesso vale per carri (`vehicles/tanks/<carro>/…` poi `vehicles/common/…`), aerei (`aircraft/<aereo>/…` poi `aircraft/common/…`) e navi (`naval/<nave>/…` poi `naval/common/…`).

Gli eventi con suono originale «nessuno» (mira, annunci dei cecchini, interfaccia) suonano solo se metti il file.

## Aggiungere nuovi suoni al gioco (per chi modifica il codice)
- Nuova arma, carro, aereo o nave: aggiungi il nome nelle tabelle di `assets/audio_manifest.js` (WEAPONS, TANKS, PLANES, SHIPS).
- Nuovo evento: `add(id, percorso, categoria, descrizione, originale)` nel registro, poi nel codice `play(campione, pos, { cx: 'id' })` (con fallback all'originale) oppure `caPlay('id', pos)` (solo se c'è il file). Loop: `loopSound(campione, vol, 'id')`.

## Cosa non è coperto
- Le **musiche**: hanno già il loro sistema (cartella `musiche`, vedi LEGGIMI.txt).
- I suoni dell'**introduzione** e del **menù iniziale**, che hanno un sistema separato.

## Elenco degli eventi (339)

### Armi (144)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `weapons/rifles/garand/fire` | Sparo M1 Garand (anche fucili alleati dei soldati) | garand | `weapon.garand.fire` |
| `weapons/rifles/springfield/fire` | Sparo Springfield (e Lee-Enfield) | springfield | `weapon.springfield.fire` |
| `weapons/rifles/kar98/fire` | Sparo Kar98k (e fucili tedeschi e sovietici dei soldati) | kar98 | `weapon.kar98.fire` |
| `weapons/smg/thompson/fire` | Sparo Thompson | thompson | `weapon.thompson.fire` |
| `weapons/smg/mp40/fire` | Sparo MP 40 | mp40 | `weapon.mp40.fire` |
| `weapons/automatic/bar/fire` | Sparo BAR (e mitragliatrici di bordo leggere) | bar | `weapon.bar.fire` |
| `weapons/pistols/colt/fire` | Sparo Colt M1911 | colt | `weapon.colt.fire` |
| `weapons/launchers/bazooka/fire` | Lancio del Bazooka | rocket | `weapon.bazooka.fire` |
| `weapons/machineguns/mg42/fire` | Colpo singolo MG 42 (la raffica ripete il colpo) | mg42 | `weapon.mg42.fire` |
| `weapons/machineguns/m2/fire` | Colpo Browning M2 .50 (aerei, navi, mezzi) | m2 | `weapon.m2.fire` |
| `weapons/flak/fire` | Colpo di contraerea e cannoncini | flak | `weapon.flak.fire` |
| `weapons/common/rifle_distant` | Fucile sentito da lontano | rifle_far | `weapon.common.rifle_distant` |
| `weapons/common/smg_distant` | Mitra sentito da lontano | smg_far | `weapon.common.smg_distant` |
| `weapons/common/mg_distant` | Mitragliatrice sentita da lontano | mg_far | `weapon.common.mg_distant` |
| `weapons/common/flak_distant` | Contraerea sentita da lontano | flak_far | `weapon.common.flak_distant` |
| `weapons/common/reload_start` | Ricarica: caricatore fuori | mag_out | `weapon.common.reload_start` |
| `weapons/common/reload_end` | Ricarica: caricatore dentro (anche cambio arma) | mag_in | `weapon.common.reload_end` |
| `weapons/common/reload` | Ricarica: lastrina inserita | clip_in | `weapon.common.reload` |
| `weapons/common/bolt` | Otturatore aperto | bolt_open | `weapon.common.bolt` |
| `weapons/common/bolt_close` | Otturatore chiuso | bolt_close | `weapon.common.bolt_close` |
| `weapons/common/empty` | Grilletto a vuoto | dry | `weapon.common.empty` |
| `weapons/rifles/garand/clip_eject` | Espulsione della lastrina del Garand (ping) | ping | `weapon.garand.clip_eject` |
| `weapons/common/casing` | Bossolo che cade | tink | `weapon.common.casing` |
| `weapons/grenade/pin` | Granata: spoletta tolta | pin | `weapon.grenade.pin` |
| `weapons/grenade/bounce` | Granata che rimbalza | nade_bounce | `weapon.grenade.bounce` |
| `weapons/rifles/garand/fire_distant` | M1 Garand: Sparo sentito da lontano | rimbombo lontano generico | `weapon.garand.fire_distant` |
| `weapons/rifles/garand/aim_in` | M1 Garand: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.garand.aim_in` |
| `weapons/rifles/garand/aim_out` | M1 Garand: Fine della mira | nessuno: solo se presente il file | `weapon.garand.aim_out` |
| `weapons/rifles/garand/reload_start` | M1 Garand: Inizio ricarica (caricatore fuori) | mag_out | `weapon.garand.reload_start` |
| `weapons/rifles/garand/reload` | M1 Garand: Ricarica (lastrina inserita) | clip_in | `weapon.garand.reload` |
| `weapons/rifles/garand/reload_end` | M1 Garand: Fine ricarica (caricatore dentro) | mag_in | `weapon.garand.reload_end` |
| `weapons/rifles/garand/empty` | M1 Garand: Grilletto a vuoto | dry | `weapon.garand.empty` |
| `weapons/rifles/garand/equip` | M1 Garand: Estrazione dell'arma (cambio arma) | mag_in | `weapon.garand.equip` |
| `weapons/rifles/springfield/fire_distant` | Springfield M1903A4: Sparo sentito da lontano | rimbombo lontano generico | `weapon.springfield.fire_distant` |
| `weapons/rifles/springfield/aim_in` | Springfield M1903A4: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.springfield.aim_in` |
| `weapons/rifles/springfield/aim_out` | Springfield M1903A4: Fine della mira | nessuno: solo se presente il file | `weapon.springfield.aim_out` |
| `weapons/rifles/springfield/reload_start` | Springfield M1903A4: Inizio ricarica (caricatore fuori) | mag_out | `weapon.springfield.reload_start` |
| `weapons/rifles/springfield/reload` | Springfield M1903A4: Ricarica (lastrina inserita) | clip_in | `weapon.springfield.reload` |
| `weapons/rifles/springfield/reload_end` | Springfield M1903A4: Fine ricarica (caricatore dentro) | mag_in | `weapon.springfield.reload_end` |
| `weapons/rifles/springfield/empty` | Springfield M1903A4: Grilletto a vuoto | dry | `weapon.springfield.empty` |
| `weapons/rifles/springfield/equip` | Springfield M1903A4: Estrazione dell'arma (cambio arma) | mag_in | `weapon.springfield.equip` |
| `weapons/rifles/springfield/bolt` | Springfield M1903A4: otturatore aperto | bolt_open | `weapon.springfield.bolt` |
| `weapons/rifles/springfield/bolt_close` | Springfield M1903A4: otturatore chiuso | bolt_close | `weapon.springfield.bolt_close` |
| `weapons/rifles/enfield/fire` | Lee-Enfield No.4 (T): Sparo (vicino, in prima persona) | sparo del tipo di arma | `weapon.enfield.fire` |
| `weapons/rifles/enfield/fire_distant` | Lee-Enfield No.4 (T): Sparo sentito da lontano | rimbombo lontano generico | `weapon.enfield.fire_distant` |
| `weapons/rifles/enfield/aim_in` | Lee-Enfield No.4 (T): Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.enfield.aim_in` |
| `weapons/rifles/enfield/aim_out` | Lee-Enfield No.4 (T): Fine della mira | nessuno: solo se presente il file | `weapon.enfield.aim_out` |
| `weapons/rifles/enfield/reload_start` | Lee-Enfield No.4 (T): Inizio ricarica (caricatore fuori) | mag_out | `weapon.enfield.reload_start` |
| `weapons/rifles/enfield/reload` | Lee-Enfield No.4 (T): Ricarica (lastrina inserita) | clip_in | `weapon.enfield.reload` |
| `weapons/rifles/enfield/reload_end` | Lee-Enfield No.4 (T): Fine ricarica (caricatore dentro) | mag_in | `weapon.enfield.reload_end` |
| `weapons/rifles/enfield/empty` | Lee-Enfield No.4 (T): Grilletto a vuoto | dry | `weapon.enfield.empty` |
| `weapons/rifles/enfield/equip` | Lee-Enfield No.4 (T): Estrazione dell'arma (cambio arma) | mag_in | `weapon.enfield.equip` |
| `weapons/rifles/enfield/bolt` | Lee-Enfield No.4 (T): otturatore aperto | bolt_open | `weapon.enfield.bolt` |
| `weapons/rifles/enfield/bolt_close` | Lee-Enfield No.4 (T): otturatore chiuso | bolt_close | `weapon.enfield.bolt_close` |
| `weapons/rifles/mosin/fire` | Mosin-Nagant 91/30 PU: Sparo (vicino, in prima persona) | sparo del tipo di arma | `weapon.mosin.fire` |
| `weapons/rifles/mosin/fire_distant` | Mosin-Nagant 91/30 PU: Sparo sentito da lontano | rimbombo lontano generico | `weapon.mosin.fire_distant` |
| `weapons/rifles/mosin/aim_in` | Mosin-Nagant 91/30 PU: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.mosin.aim_in` |
| `weapons/rifles/mosin/aim_out` | Mosin-Nagant 91/30 PU: Fine della mira | nessuno: solo se presente il file | `weapon.mosin.aim_out` |
| `weapons/rifles/mosin/reload_start` | Mosin-Nagant 91/30 PU: Inizio ricarica (caricatore fuori) | mag_out | `weapon.mosin.reload_start` |
| `weapons/rifles/mosin/reload` | Mosin-Nagant 91/30 PU: Ricarica (lastrina inserita) | clip_in | `weapon.mosin.reload` |
| `weapons/rifles/mosin/reload_end` | Mosin-Nagant 91/30 PU: Fine ricarica (caricatore dentro) | mag_in | `weapon.mosin.reload_end` |
| `weapons/rifles/mosin/empty` | Mosin-Nagant 91/30 PU: Grilletto a vuoto | dry | `weapon.mosin.empty` |
| `weapons/rifles/mosin/equip` | Mosin-Nagant 91/30 PU: Estrazione dell'arma (cambio arma) | mag_in | `weapon.mosin.equip` |
| `weapons/rifles/mosin/bolt` | Mosin-Nagant 91/30 PU: otturatore aperto | bolt_open | `weapon.mosin.bolt` |
| `weapons/rifles/mosin/bolt_close` | Mosin-Nagant 91/30 PU: otturatore chiuso | bolt_close | `weapon.mosin.bolt_close` |
| `weapons/rifles/kar98/fire_distant` | Karabiner 98k: Sparo sentito da lontano | rimbombo lontano generico | `weapon.kar98.fire_distant` |
| `weapons/rifles/kar98/aim_in` | Karabiner 98k: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.kar98.aim_in` |
| `weapons/rifles/kar98/aim_out` | Karabiner 98k: Fine della mira | nessuno: solo se presente il file | `weapon.kar98.aim_out` |
| `weapons/rifles/kar98/reload_start` | Karabiner 98k: Inizio ricarica (caricatore fuori) | mag_out | `weapon.kar98.reload_start` |
| `weapons/rifles/kar98/reload` | Karabiner 98k: Ricarica (lastrina inserita) | clip_in | `weapon.kar98.reload` |
| `weapons/rifles/kar98/reload_end` | Karabiner 98k: Fine ricarica (caricatore dentro) | mag_in | `weapon.kar98.reload_end` |
| `weapons/rifles/kar98/empty` | Karabiner 98k: Grilletto a vuoto | dry | `weapon.kar98.empty` |
| `weapons/rifles/kar98/equip` | Karabiner 98k: Estrazione dell'arma (cambio arma) | mag_in | `weapon.kar98.equip` |
| `weapons/rifles/kar98/bolt` | Karabiner 98k: otturatore aperto | bolt_open | `weapon.kar98.bolt` |
| `weapons/rifles/kar98/bolt_close` | Karabiner 98k: otturatore chiuso | bolt_close | `weapon.kar98.bolt_close` |
| `weapons/rifles/kar98zf/fire` | Kar98k ZF39: Sparo (vicino, in prima persona) | sparo del tipo di arma | `weapon.kar98zf.fire` |
| `weapons/rifles/kar98zf/fire_distant` | Kar98k ZF39: Sparo sentito da lontano | rimbombo lontano generico | `weapon.kar98zf.fire_distant` |
| `weapons/rifles/kar98zf/aim_in` | Kar98k ZF39: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.kar98zf.aim_in` |
| `weapons/rifles/kar98zf/aim_out` | Kar98k ZF39: Fine della mira | nessuno: solo se presente il file | `weapon.kar98zf.aim_out` |
| `weapons/rifles/kar98zf/reload_start` | Kar98k ZF39: Inizio ricarica (caricatore fuori) | mag_out | `weapon.kar98zf.reload_start` |
| `weapons/rifles/kar98zf/reload` | Kar98k ZF39: Ricarica (lastrina inserita) | clip_in | `weapon.kar98zf.reload` |
| `weapons/rifles/kar98zf/reload_end` | Kar98k ZF39: Fine ricarica (caricatore dentro) | mag_in | `weapon.kar98zf.reload_end` |
| `weapons/rifles/kar98zf/empty` | Kar98k ZF39: Grilletto a vuoto | dry | `weapon.kar98zf.empty` |
| `weapons/rifles/kar98zf/equip` | Kar98k ZF39: Estrazione dell'arma (cambio arma) | mag_in | `weapon.kar98zf.equip` |
| `weapons/rifles/kar98zf/bolt` | Kar98k ZF39: otturatore aperto | bolt_open | `weapon.kar98zf.bolt` |
| `weapons/rifles/kar98zf/bolt_close` | Kar98k ZF39: otturatore chiuso | bolt_close | `weapon.kar98zf.bolt_close` |
| `weapons/rifles/g43/fire` | Gewehr 43: Sparo (vicino, in prima persona) | sparo del tipo di arma | `weapon.g43.fire` |
| `weapons/rifles/g43/fire_distant` | Gewehr 43: Sparo sentito da lontano | rimbombo lontano generico | `weapon.g43.fire_distant` |
| `weapons/rifles/g43/aim_in` | Gewehr 43: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.g43.aim_in` |
| `weapons/rifles/g43/aim_out` | Gewehr 43: Fine della mira | nessuno: solo se presente il file | `weapon.g43.aim_out` |
| `weapons/rifles/g43/reload_start` | Gewehr 43: Inizio ricarica (caricatore fuori) | mag_out | `weapon.g43.reload_start` |
| `weapons/rifles/g43/reload` | Gewehr 43: Ricarica (lastrina inserita) | clip_in | `weapon.g43.reload` |
| `weapons/rifles/g43/reload_end` | Gewehr 43: Fine ricarica (caricatore dentro) | mag_in | `weapon.g43.reload_end` |
| `weapons/rifles/g43/empty` | Gewehr 43: Grilletto a vuoto | dry | `weapon.g43.empty` |
| `weapons/rifles/g43/equip` | Gewehr 43: Estrazione dell'arma (cambio arma) | mag_in | `weapon.g43.equip` |
| `weapons/rifles/svt40/fire` | SVT-40: Sparo (vicino, in prima persona) | sparo del tipo di arma | `weapon.svt40.fire` |
| `weapons/rifles/svt40/fire_distant` | SVT-40: Sparo sentito da lontano | rimbombo lontano generico | `weapon.svt40.fire_distant` |
| `weapons/rifles/svt40/aim_in` | SVT-40: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.svt40.aim_in` |
| `weapons/rifles/svt40/aim_out` | SVT-40: Fine della mira | nessuno: solo se presente il file | `weapon.svt40.aim_out` |
| `weapons/rifles/svt40/reload_start` | SVT-40: Inizio ricarica (caricatore fuori) | mag_out | `weapon.svt40.reload_start` |
| `weapons/rifles/svt40/reload` | SVT-40: Ricarica (lastrina inserita) | clip_in | `weapon.svt40.reload` |
| `weapons/rifles/svt40/reload_end` | SVT-40: Fine ricarica (caricatore dentro) | mag_in | `weapon.svt40.reload_end` |
| `weapons/rifles/svt40/empty` | SVT-40: Grilletto a vuoto | dry | `weapon.svt40.empty` |
| `weapons/rifles/svt40/equip` | SVT-40: Estrazione dell'arma (cambio arma) | mag_in | `weapon.svt40.equip` |
| `weapons/smg/thompson/fire_distant` | Thompson M1A1: Sparo sentito da lontano | rimbombo lontano generico | `weapon.thompson.fire_distant` |
| `weapons/smg/thompson/aim_in` | Thompson M1A1: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.thompson.aim_in` |
| `weapons/smg/thompson/aim_out` | Thompson M1A1: Fine della mira | nessuno: solo se presente il file | `weapon.thompson.aim_out` |
| `weapons/smg/thompson/reload_start` | Thompson M1A1: Inizio ricarica (caricatore fuori) | mag_out | `weapon.thompson.reload_start` |
| `weapons/smg/thompson/reload` | Thompson M1A1: Ricarica (lastrina inserita) | clip_in | `weapon.thompson.reload` |
| `weapons/smg/thompson/reload_end` | Thompson M1A1: Fine ricarica (caricatore dentro) | mag_in | `weapon.thompson.reload_end` |
| `weapons/smg/thompson/empty` | Thompson M1A1: Grilletto a vuoto | dry | `weapon.thompson.empty` |
| `weapons/smg/thompson/equip` | Thompson M1A1: Estrazione dell'arma (cambio arma) | mag_in | `weapon.thompson.equip` |
| `weapons/smg/mp40/fire_distant` | MP 40: Sparo sentito da lontano | rimbombo lontano generico | `weapon.mp40.fire_distant` |
| `weapons/smg/mp40/aim_in` | MP 40: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.mp40.aim_in` |
| `weapons/smg/mp40/aim_out` | MP 40: Fine della mira | nessuno: solo se presente il file | `weapon.mp40.aim_out` |
| `weapons/smg/mp40/reload_start` | MP 40: Inizio ricarica (caricatore fuori) | mag_out | `weapon.mp40.reload_start` |
| `weapons/smg/mp40/reload` | MP 40: Ricarica (lastrina inserita) | clip_in | `weapon.mp40.reload` |
| `weapons/smg/mp40/reload_end` | MP 40: Fine ricarica (caricatore dentro) | mag_in | `weapon.mp40.reload_end` |
| `weapons/smg/mp40/empty` | MP 40: Grilletto a vuoto | dry | `weapon.mp40.empty` |
| `weapons/smg/mp40/equip` | MP 40: Estrazione dell'arma (cambio arma) | mag_in | `weapon.mp40.equip` |
| `weapons/automatic/bar/fire_distant` | BAR M1918A2: Sparo sentito da lontano | rimbombo lontano generico | `weapon.bar.fire_distant` |
| `weapons/automatic/bar/aim_in` | BAR M1918A2: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.bar.aim_in` |
| `weapons/automatic/bar/aim_out` | BAR M1918A2: Fine della mira | nessuno: solo se presente il file | `weapon.bar.aim_out` |
| `weapons/automatic/bar/reload_start` | BAR M1918A2: Inizio ricarica (caricatore fuori) | mag_out | `weapon.bar.reload_start` |
| `weapons/automatic/bar/reload` | BAR M1918A2: Ricarica (lastrina inserita) | clip_in | `weapon.bar.reload` |
| `weapons/automatic/bar/reload_end` | BAR M1918A2: Fine ricarica (caricatore dentro) | mag_in | `weapon.bar.reload_end` |
| `weapons/automatic/bar/empty` | BAR M1918A2: Grilletto a vuoto | dry | `weapon.bar.empty` |
| `weapons/automatic/bar/equip` | BAR M1918A2: Estrazione dell'arma (cambio arma) | mag_in | `weapon.bar.equip` |
| `weapons/pistols/colt/fire_distant` | Colt M1911A1: Sparo sentito da lontano | rimbombo lontano generico | `weapon.colt.fire_distant` |
| `weapons/pistols/colt/aim_in` | Colt M1911A1: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.colt.aim_in` |
| `weapons/pistols/colt/aim_out` | Colt M1911A1: Fine della mira | nessuno: solo se presente il file | `weapon.colt.aim_out` |
| `weapons/pistols/colt/reload_start` | Colt M1911A1: Inizio ricarica (caricatore fuori) | mag_out | `weapon.colt.reload_start` |
| `weapons/pistols/colt/reload` | Colt M1911A1: Ricarica (lastrina inserita) | clip_in | `weapon.colt.reload` |
| `weapons/pistols/colt/reload_end` | Colt M1911A1: Fine ricarica (caricatore dentro) | mag_in | `weapon.colt.reload_end` |
| `weapons/pistols/colt/empty` | Colt M1911A1: Grilletto a vuoto | dry | `weapon.colt.empty` |
| `weapons/pistols/colt/equip` | Colt M1911A1: Estrazione dell'arma (cambio arma) | mag_in | `weapon.colt.equip` |
| `weapons/launchers/bazooka/fire_distant` | Bazooka M1A1: Sparo sentito da lontano | rimbombo lontano generico | `weapon.bazooka.fire_distant` |
| `weapons/launchers/bazooka/aim_in` | Bazooka M1A1: Inizio della mira (click destro) | nessuno: solo se presente il file | `weapon.bazooka.aim_in` |
| `weapons/launchers/bazooka/aim_out` | Bazooka M1A1: Fine della mira | nessuno: solo se presente il file | `weapon.bazooka.aim_out` |
| `weapons/launchers/bazooka/reload_start` | Bazooka M1A1: Inizio ricarica (caricatore fuori) | mag_out | `weapon.bazooka.reload_start` |
| `weapons/launchers/bazooka/reload` | Bazooka M1A1: Ricarica (lastrina inserita) | clip_in | `weapon.bazooka.reload` |
| `weapons/launchers/bazooka/reload_end` | Bazooka M1A1: Fine ricarica (caricatore dentro) | mag_in | `weapon.bazooka.reload_end` |
| `weapons/launchers/bazooka/empty` | Bazooka M1A1: Grilletto a vuoto | dry | `weapon.bazooka.empty` |
| `weapons/launchers/bazooka/equip` | Bazooka M1A1: Estrazione dell'arma (cambio arma) | mag_in | `weapon.bazooka.equip` |

### Impatti (11)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `impacts/bullet_crack` | Schiocco del proiettile che passa vicino | crack | `impact.bullet_crack` |
| `impacts/bullet_whiz` | Fischio del proiettile vicino | whiz | `impact.bullet_whiz` |
| `impacts/ricochet` | Rimbalzo sulla corazza | ricochet | `impact.ricochet` |
| `impacts/sand` | Colpo nella sabbia e nella terra | imp_sand | `impact.sand` |
| `impacts/water` | Colpo nell'acqua | imp_water | `impact.water` |
| `impacts/metal` | Colpo sul metallo | imp_metal | `impact.metal` |
| `impacts/flesh` | Colpo a segno su un soldato | imp_flesh | `impact.flesh` |
| `impacts/wood` | Colpo sul legno | imp_wood | `impact.wood` |
| `impacts/stone` | Colpo su pietra e cemento | imp_stone | `impact.stone` |
| `impacts/flesh_squelch` | Ferita grave | flesh_squelch | `impact.flesh_squelch` |
| `impacts/armor` | Granata che colpisce una corazza | clang | `impact.armor` |

### Esplosioni (7)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `explosions/near` | Esplosione vicina (granate, proiettili, carri) | boom | `explosion.near` |
| `explosions/far` | Esplosione lontana | boom_far | `explosion.far` |
| `explosions/water` | Esplosione in acqua | boom_water | `explosion.water` |
| `explosions/magazine` | Esplosione enorme (santabarbara di una nave) | boom_big | `explosion.magazine` |
| `explosions/mortar` | Colpo di mortaio in arrivo | mortar | `explosion.mortar` |
| `explosions/shell_whistle` | Fischio del proiettile d'artiglieria | whistle | `explosion.shell_whistle` |
| `explosions/bomb_whistle` | Fischio della bomba che cade | bomb | `explosion.bomb_whistle` |

### Movimento (4)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `movement/step_sand` | Passo sulla sabbia e sulla terra | step_sand | `move.step_sand` |
| `movement/step_pebble` | Passo sui ciottoli | step_peb | `move.step_pebble` |
| `movement/step_water` | Passo nell'acqua | step_water | `move.step_water` |
| `movement/bodyfall` | Corpo a terra, alberi che cadono | bodyfall | `move.bodyfall` |

### Giocatore (3)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `player/heartbeat` | Battito del cuore (ferito) | heart | `player.heartbeat` |
| `player/breath` | Respiro affannato | breath | `player.breath` |
| `player/hit` | Colpo ricevuto | thud | `player.hit` |

### Voci e grida (21)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `voices/scream` | Urlo | scream | `voice.scream` |
| `voices/groan` | Gemito | groan | `voice.groan` |
| `voices/yell` | Grido | yell | `voice.yell` |
| `voices/wail` | Lamento | wail | `voice.wail` |
| `voices/shouts/en/move` | Grida americane: move | sintesi vocale del browser | `shout.en.move` |
| `voices/shouts/en/medic` | Grida americane: medic | sintesi vocale del browser | `shout.en.medic` |
| `voices/shouts/en/cover` | Grida americane: cover | sintesi vocale del browser | `shout.en.cover` |
| `voices/shouts/en/grenade` | Grida americane: grenade | sintesi vocale del browser | `shout.en.grenade` |
| `voices/shouts/en/reload` | Grida americane: reload | sintesi vocale del browser | `shout.en.reload` |
| `voices/shouts/en/kill` | Grida americane: kill | sintesi vocale del browser | `shout.en.kill` |
| `voices/shouts/en/fire` | Grida americane: fire | sintesi vocale del browser | `shout.en.fire` |
| `voices/shouts/en/mortar` | Grida americane: mortar | sintesi vocale del browser | `shout.en.mortar` |
| `voices/shouts/en/plane` | Grida americane: plane | sintesi vocale del browser | `shout.en.plane` |
| `voices/shouts/de/fire` | Grida tedesche: fire | sintesi vocale del browser | `shout.de.fire` |
| `voices/shouts/de/spot` | Grida tedesche: spot | sintesi vocale del browser | `shout.de.spot` |
| `voices/shouts/de/grenade` | Grida tedesche: grenade | sintesi vocale del browser | `shout.de.grenade` |
| `voices/shouts/de/reload` | Grida tedesche: reload | sintesi vocale del browser | `shout.de.reload` |
| `voices/shouts/de/medic` | Grida tedesche: medic | sintesi vocale del browser | `shout.de.medic` |
| `voices/shouts/de/retreat` | Grida tedesche: retreat | sintesi vocale del browser | `shout.de.retreat` |
| `voices/shouts/de/hold` | Grida tedesche: hold | sintesi vocale del browser | `shout.de.hold` |
| `voices/shouts/de/plane` | Grida tedesche: plane | sintesi vocale del browser | `shout.de.plane` |

### Carri e mezzi (29)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `vehicles/tanks/sherman/engine` | Motore Sherman (loop) | eng_sherman | `vehicle.sherman.engine` |
| `vehicles/tanks/pz4/engine` | Motore Panzer IV e III (loop) | eng_pz4 | `vehicle.pz4.engine` |
| `vehicles/tanks/tiger/engine` | Motore Tiger (loop) | eng_tiger | `vehicle.tiger.engine` |
| `vehicles/boats/engine` | Motore dei mezzi da sbarco e delle motosiluranti (loop) | eng_boat | `vehicle.boat.engine` |
| `vehicles/common/tracks` | Cingoli (loop) | tracks | `vehicle.common.tracks` |
| `vehicles/common/turret_rotate` | Rotazione della torretta (loop) | turret | `vehicle.common.turret_rotate` |
| `vehicles/common/cannon_fire` | Cannone del carro | tank_gun | `vehicle.common.cannon_fire` |
| `vehicles/common/cannon_reload` | Ricarica del cannone (anche cariche e casse) | reload_clank | `vehicle.common.cannon_reload` |
| `vehicles/tanks/sherman/tracks` | M4 Sherman: Cingoli (loop) | tracks | `vehicle.sherman.tracks` |
| `vehicles/tanks/sherman/turret_rotate` | M4 Sherman: Rotazione della torretta (loop) | turret | `vehicle.sherman.turret_rotate` |
| `vehicles/tanks/sherman/cannon_fire` | M4 Sherman: Sparo del cannone | tank_gun | `vehicle.sherman.cannon_fire` |
| `vehicles/tanks/sherman/cannon_reload` | M4 Sherman: Ricarica del cannone | reload_clank | `vehicle.sherman.cannon_reload` |
| `vehicles/tanks/sherman/machinegun_fire` | M4 Sherman: Mitragliatrice coassiale | colpo MG 42 o M2 | `vehicle.sherman.machinegun_fire` |
| `vehicles/tanks/pz4/tracks` | Panzer IV: Cingoli (loop) | tracks | `vehicle.pz4.tracks` |
| `vehicles/tanks/pz4/turret_rotate` | Panzer IV: Rotazione della torretta (loop) | turret | `vehicle.pz4.turret_rotate` |
| `vehicles/tanks/pz4/cannon_fire` | Panzer IV: Sparo del cannone | tank_gun | `vehicle.pz4.cannon_fire` |
| `vehicles/tanks/pz4/cannon_reload` | Panzer IV: Ricarica del cannone | reload_clank | `vehicle.pz4.cannon_reload` |
| `vehicles/tanks/pz4/machinegun_fire` | Panzer IV: Mitragliatrice coassiale | colpo MG 42 o M2 | `vehicle.pz4.machinegun_fire` |
| `vehicles/tanks/pz3/engine` | Panzer III: Motore (loop, segue il regime) | motore generico del carro | `vehicle.pz3.engine` |
| `vehicles/tanks/pz3/tracks` | Panzer III: Cingoli (loop) | tracks | `vehicle.pz3.tracks` |
| `vehicles/tanks/pz3/turret_rotate` | Panzer III: Rotazione della torretta (loop) | turret | `vehicle.pz3.turret_rotate` |
| `vehicles/tanks/pz3/cannon_fire` | Panzer III: Sparo del cannone | tank_gun | `vehicle.pz3.cannon_fire` |
| `vehicles/tanks/pz3/cannon_reload` | Panzer III: Ricarica del cannone | reload_clank | `vehicle.pz3.cannon_reload` |
| `vehicles/tanks/pz3/machinegun_fire` | Panzer III: Mitragliatrice coassiale | colpo MG 42 o M2 | `vehicle.pz3.machinegun_fire` |
| `vehicles/tanks/tiger/tracks` | Tiger I: Cingoli (loop) | tracks | `vehicle.tiger.tracks` |
| `vehicles/tanks/tiger/turret_rotate` | Tiger I: Rotazione della torretta (loop) | turret | `vehicle.tiger.turret_rotate` |
| `vehicles/tanks/tiger/cannon_fire` | Tiger I: Sparo del cannone | tank_gun | `vehicle.tiger.cannon_fire` |
| `vehicles/tanks/tiger/cannon_reload` | Tiger I: Ricarica del cannone | reload_clank | `vehicle.tiger.cannon_reload` |
| `vehicles/tanks/tiger/machinegun_fire` | Tiger I: Mitragliatrice coassiale | colpo MG 42 o M2 | `vehicle.tiger.machinegun_fire` |

### Aerei (43)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `aircraft/common/engine_allied` | Motore degli aerei alleati e giapponesi (loop) | eng_p47 | `aircraft.common.engine_allied` |
| `aircraft/common/engine_german` | Motore degli aerei tedeschi (loop) | eng_fw | `aircraft.common.engine_german` |
| `aircraft/common/engine_bomber` | Motori dei bombardieri (loop) | eng_bomber | `aircraft.common.engine_bomber` |
| `aircraft/common/flyby` | Passaggio ravvicinato | flyby | `aircraft.common.flyby` |
| `aircraft/common/dive` | Picchiata | dive | `aircraft.common.dive` |
| `aircraft/p47/engine` | P-47 Thunderbolt: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.p47.engine` |
| `aircraft/p47/guns_fire` | P-47 Thunderbolt: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.p47.guns_fire` |
| `aircraft/p51/engine` | P-51 Mustang: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.p51.engine` |
| `aircraft/p51/guns_fire` | P-51 Mustang: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.p51.guns_fire` |
| `aircraft/f4u/engine` | F4U Corsair: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.f4u.engine` |
| `aircraft/f4u/guns_fire` | F4U Corsair: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.f4u.guns_fire` |
| `aircraft/spit/engine` | Spitfire: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.spit.engine` |
| `aircraft/spit/guns_fire` | Spitfire: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.spit.guns_fire` |
| `aircraft/typhoon/engine` | Typhoon: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.typhoon.engine` |
| `aircraft/typhoon/guns_fire` | Typhoon: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.typhoon.guns_fire` |
| `aircraft/hurri/engine` | Hurricane: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.hurri.engine` |
| `aircraft/hurri/guns_fire` | Hurricane: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.hurri.guns_fire` |
| `aircraft/p40/engine` | P-40 Warhawk: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.p40.engine` |
| `aircraft/p40/guns_fire` | P-40 Warhawk: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.p40.guns_fire` |
| `aircraft/sbd/engine` | SBD Dauntless: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.sbd.engine` |
| `aircraft/sbd/guns_fire` | SBD Dauntless: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.sbd.guns_fire` |
| `aircraft/tbf/engine` | TBF Avenger: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.tbf.engine` |
| `aircraft/tbf/guns_fire` | TBF Avenger: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.tbf.guns_fire` |
| `aircraft/bf109/engine` | Bf 109: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.bf109.engine` |
| `aircraft/bf109/guns_fire` | Bf 109: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.bf109.guns_fire` |
| `aircraft/fw190/engine` | Fw 190: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.fw190.engine` |
| `aircraft/fw190/guns_fire` | Fw 190: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.fw190.guns_fire` |
| `aircraft/stuka/engine` | Ju 87 Stuka: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.stuka.engine` |
| `aircraft/stuka/guns_fire` | Ju 87 Stuka: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.stuka.guns_fire` |
| `aircraft/me262/engine` | Me 262: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.me262.engine` |
| `aircraft/me262/guns_fire` | Me 262: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.me262.guns_fire` |
| `aircraft/mosquito/engine` | Mosquito: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.mosquito.engine` |
| `aircraft/mosquito/guns_fire` | Mosquito: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.mosquito.guns_fire` |
| `aircraft/zero/engine` | A6M Zero: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.zero.engine` |
| `aircraft/zero/guns_fire` | A6M Zero: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.zero.guns_fire` |
| `aircraft/val/engine` | D3A Val: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.val.engine` |
| `aircraft/val/guns_fire` | D3A Val: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.val.guns_fire` |
| `aircraft/kate/engine` | B5N Kate: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.kate.engine` |
| `aircraft/kate/guns_fire` | B5N Kate: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.kate.guns_fire` |
| `aircraft/f47/engine` | F-47: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.f47.engine` |
| `aircraft/f47/guns_fire` | F-47: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.f47.guns_fire` |
| `aircraft/b26/engine` | B-26 Marauder: motore (loop, segue manetta e velocità) | motore generico della nazione | `aircraft.b26.engine` |
| `aircraft/b26/guns_fire` | B-26 Marauder: mitragliatrici o cannoni di bordo | colpo dell'arma di bordo | `aircraft.b26.guns_fire` |

### Navi (61)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `naval/common/main_cannon_fire` | Cannoni principali della propria nave | ship_near | `naval.common.main_cannon_fire` |
| `naval/common/main_cannon_distant` | Cannoni navali lontani (anche il bombardamento su Omaha) | ship_far | `naval.common.main_cannon_distant` |
| `naval/common/general_quarters` | Allarme di posto di combattimento | gq_siren | `naval.common.general_quarters` |
| `naval/common/horn` | Sirena della nave | horn | `naval.common.horn` |
| `naval/common/torpedo` | Siluro in corsa | torpedo_run | `naval.common.torpedo` |
| `naval/texas/main_cannon_fire` | USS Texas: cannoni principali (nave del giocatore) | ship_near | `naval.texas.main_cannon_fire` |
| `naval/texas/main_cannon_distant` | USS Texas: cannoni principali sentiti da fuori | ship_far | `naval.texas.main_cannon_distant` |
| `naval/texas/secondary_fire` | USS Texas: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.texas.secondary_fire` |
| `naval/texas/aa_fire` | USS Texas: mitragliere antiaeree leggere | m2 | `naval.texas.aa_fire` |
| `naval/fletcher/main_cannon_fire` | Cacciatorpediniere Fletcher: cannoni principali (nave del giocatore) | ship_near | `naval.fletcher.main_cannon_fire` |
| `naval/fletcher/main_cannon_distant` | Cacciatorpediniere Fletcher: cannoni principali sentiti da fuori | ship_far | `naval.fletcher.main_cannon_distant` |
| `naval/fletcher/secondary_fire` | Cacciatorpediniere Fletcher: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.fletcher.secondary_fire` |
| `naval/fletcher/aa_fire` | Cacciatorpediniere Fletcher: mitragliere antiaeree leggere | m2 | `naval.fletcher.aa_fire` |
| `naval/cleveland/main_cannon_fire` | Incrociatore Cleveland: cannoni principali (nave del giocatore) | ship_near | `naval.cleveland.main_cannon_fire` |
| `naval/cleveland/main_cannon_distant` | Incrociatore Cleveland: cannoni principali sentiti da fuori | ship_far | `naval.cleveland.main_cannon_distant` |
| `naval/cleveland/secondary_fire` | Incrociatore Cleveland: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.cleveland.secondary_fire` |
| `naval/cleveland/aa_fire` | Incrociatore Cleveland: mitragliere antiaeree leggere | m2 | `naval.cleveland.aa_fire` |
| `naval/elco/main_cannon_fire` | PT boat Elco: cannoni principali (nave del giocatore) | ship_near | `naval.elco.main_cannon_fire` |
| `naval/elco/main_cannon_distant` | PT boat Elco: cannoni principali sentiti da fuori | ship_far | `naval.elco.main_cannon_distant` |
| `naval/elco/secondary_fire` | PT boat Elco: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.elco.secondary_fire` |
| `naval/elco/aa_fire` | PT boat Elco: mitragliere antiaeree leggere | m2 | `naval.elco.aa_fire` |
| `naval/satsuma/main_cannon_fire` | Satsuma: cannoni principali (nave del giocatore) | ship_near | `naval.satsuma.main_cannon_fire` |
| `naval/satsuma/main_cannon_distant` | Satsuma: cannoni principali sentiti da fuori | ship_far | `naval.satsuma.main_cannon_distant` |
| `naval/satsuma/secondary_fire` | Satsuma: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.satsuma.secondary_fire` |
| `naval/satsuma/aa_fire` | Satsuma: mitragliere antiaeree leggere | m2 | `naval.satsuma.aa_fire` |
| `naval/akagi/main_cannon_fire` | Portaerei Akagi: cannoni principali (nave del giocatore) | ship_near | `naval.akagi.main_cannon_fire` |
| `naval/akagi/main_cannon_distant` | Portaerei Akagi: cannoni principali sentiti da fuori | ship_far | `naval.akagi.main_cannon_distant` |
| `naval/akagi/secondary_fire` | Portaerei Akagi: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.akagi.secondary_fire` |
| `naval/akagi/aa_fire` | Portaerei Akagi: mitragliere antiaeree leggere | m2 | `naval.akagi.aa_fire` |
| `naval/kaga/main_cannon_fire` | Portaerei Kaga: cannoni principali (nave del giocatore) | ship_near | `naval.kaga.main_cannon_fire` |
| `naval/kaga/main_cannon_distant` | Portaerei Kaga: cannoni principali sentiti da fuori | ship_far | `naval.kaga.main_cannon_distant` |
| `naval/kaga/secondary_fire` | Portaerei Kaga: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.kaga.secondary_fire` |
| `naval/kaga/aa_fire` | Portaerei Kaga: mitragliere antiaeree leggere | m2 | `naval.kaga.aa_fire` |
| `naval/soryu/main_cannon_fire` | Portaerei Soryu: cannoni principali (nave del giocatore) | ship_near | `naval.soryu.main_cannon_fire` |
| `naval/soryu/main_cannon_distant` | Portaerei Soryu: cannoni principali sentiti da fuori | ship_far | `naval.soryu.main_cannon_distant` |
| `naval/soryu/secondary_fire` | Portaerei Soryu: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.soryu.secondary_fire` |
| `naval/soryu/aa_fire` | Portaerei Soryu: mitragliere antiaeree leggere | m2 | `naval.soryu.aa_fire` |
| `naval/kirishima/main_cannon_fire` | Corazzata Kirishima: cannoni principali (nave del giocatore) | ship_near | `naval.kirishima.main_cannon_fire` |
| `naval/kirishima/main_cannon_distant` | Corazzata Kirishima: cannoni principali sentiti da fuori | ship_far | `naval.kirishima.main_cannon_distant` |
| `naval/kirishima/secondary_fire` | Corazzata Kirishima: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.kirishima.secondary_fire` |
| `naval/kirishima/aa_fire` | Corazzata Kirishima: mitragliere antiaeree leggere | m2 | `naval.kirishima.aa_fire` |
| `naval/z1934/main_cannon_fire` | Zerstörer 1934: cannoni principali (nave del giocatore) | ship_near | `naval.z1934.main_cannon_fire` |
| `naval/z1934/main_cannon_distant` | Zerstörer 1934: cannoni principali sentiti da fuori | ship_far | `naval.z1934.main_cannon_distant` |
| `naval/z1934/secondary_fire` | Zerstörer 1934: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.z1934.secondary_fire` |
| `naval/z1934/aa_fire` | Zerstörer 1934: mitragliere antiaeree leggere | m2 | `naval.z1934.aa_fire` |
| `naval/nurnberg/main_cannon_fire` | Incrociatore Nürnberg: cannoni principali (nave del giocatore) | ship_near | `naval.nurnberg.main_cannon_fire` |
| `naval/nurnberg/main_cannon_distant` | Incrociatore Nürnberg: cannoni principali sentiti da fuori | ship_far | `naval.nurnberg.main_cannon_distant` |
| `naval/nurnberg/secondary_fire` | Incrociatore Nürnberg: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.nurnberg.secondary_fire` |
| `naval/nurnberg/aa_fire` | Incrociatore Nürnberg: mitragliere antiaeree leggere | m2 | `naval.nurnberg.aa_fire` |
| `naval/scharnhorst/main_cannon_fire` | Scharnhorst: cannoni principali (nave del giocatore) | ship_near | `naval.scharnhorst.main_cannon_fire` |
| `naval/scharnhorst/main_cannon_distant` | Scharnhorst: cannoni principali sentiti da fuori | ship_far | `naval.scharnhorst.main_cannon_distant` |
| `naval/scharnhorst/secondary_fire` | Scharnhorst: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.scharnhorst.secondary_fire` |
| `naval/scharnhorst/aa_fire` | Scharnhorst: mitragliere antiaeree leggere | m2 | `naval.scharnhorst.aa_fire` |
| `naval/sboot/main_cannon_fire` | Schnellboot S-100: cannoni principali (nave del giocatore) | ship_near | `naval.sboot.main_cannon_fire` |
| `naval/sboot/main_cannon_distant` | Schnellboot S-100: cannoni principali sentiti da fuori | ship_far | `naval.sboot.main_cannon_distant` |
| `naval/sboot/secondary_fire` | Schnellboot S-100: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.sboot.secondary_fire` |
| `naval/sboot/aa_fire` | Schnellboot S-100: mitragliere antiaeree leggere | m2 | `naval.sboot.aa_fire` |
| `naval/cargo/main_cannon_fire` | Mercantile: cannoni principali (nave del giocatore) | ship_near | `naval.cargo.main_cannon_fire` |
| `naval/cargo/main_cannon_distant` | Mercantile: cannoni principali sentiti da fuori | ship_far | `naval.cargo.main_cannon_distant` |
| `naval/cargo/secondary_fire` | Mercantile: artiglieria secondaria e cannoncini (20 mm e oltre) | flak | `naval.cargo.secondary_fire` |
| `naval/cargo/aa_fire` | Mercantile: mitragliere antiaeree leggere | m2 | `naval.cargo.aa_fire` |

### Ambiente (5)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `ambient/air_raid_siren` | Sirena d'allarme aereo | air_raid | `ambient.air_raid_siren` |
| `ambient/wind` | Vento (loop) | wind | `ambient.wind` |
| `ambient/surf` | Risacca e onde (loop) | surf | `ambient.surf` |
| `ambient/distant_battle` | Battaglia lontana (loop) | battle | `ambient.distant_battle` |
| `ambient/fire` | Incendio (loop) | fire_loop | `ambient.fire` |

### Modalità cecchini (9)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `sniper/announcer/headshot` | Annuncio: Colpo alla testa | nessuno: solo se presente il file | `sniper.announcer.headshot` |
| `sniper/announcer/double_headshot` | Annuncio: Due colpi alla testa di fila | nessuno: solo se presente il file | `sniper.announcer.double_headshot` |
| `sniper/announcer/triple_headshot` | Annuncio: Tre colpi alla testa di fila | nessuno: solo se presente il file | `sniper.announcer.triple_headshot` |
| `sniper/announcer/multikill` | Annuncio: Due uccisioni in 4 secondi | nessuno: solo se presente il file | `sniper.announcer.multikill` |
| `sniper/announcer/killing_spree` | Annuncio: 5 uccisioni senza morire | nessuno: solo se presente il file | `sniper.announcer.killing_spree` |
| `sniper/announcer/unstoppable` | Annuncio: 10 uccisioni senza morire | nessuno: solo se presente il file | `sniper.announcer.unstoppable` |
| `sniper/effects/hitmarker` | Colpo a segno | nessuno: solo se presente il file | `sniper.effects.hitmarker` |
| `sniper/effects/headshot_confirm` | Conferma colpo alla testa | nessuno: solo se presente il file | `sniper.effects.headshot_confirm` |
| `sniper/effects/kill_confirm` | Conferma uccisione | nessuno: solo se presente il file | `sniper.effects.kill_confirm` |

### Interfaccia (2)
| File | Descrizione | Originale | Id |
|---|---|---|---|
| `ui/click` | Clic sui pulsanti dei menù | nessuno: solo se presente il file | `ui.click` |
| `ui/start` | Inizio della battaglia | nessuno: solo se presente il file | `ui.start` |
