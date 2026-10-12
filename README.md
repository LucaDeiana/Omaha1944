# Omaha 1944

FPS nel browser che simula lo sbarco a Omaha Beach (6 giugno 1944): dall'avvicinamento sul mezzo da sbarco Higgins, sotto il fuoco delle corazzate, fino alla liberazione di Colleville-sur-Mer e alla difesa dal contrattacco tedesco.

## Come giocare
Apri `index.html` in Chrome o Edge (serve internet per caricare Three.js e i font da CDN). Non serve installare nulla.

| Tasto | Azione |
|---|---|
| W A S D | Movimento |
| Shift | Corsa (consuma fiato) |
| Spazio | Salto |
| C / Ctrl | Accovacciati |
| Z | A terra |
| Click sinistro | Fuoco |
| Click destro | Mira (ottica per lo Springfield) |
| R | Ricarica |
| G | Granata |
| 1 2 3 / rotella | Cambio arma · Q arma precedente |
| E | Interagisci / raccogli armi / rifornimento |
| Esc | Pausa |

## Campagna
1. **Avvicinamento**: 40 secondi sul mezzo da sbarco tra bombardamento navale e mitragliatrici.
2. **Omaha Beach**: raggiungi il terrapieno sotto il fuoco di MG42 e mortai.
3. **Il filo spinato**: prendi un tubo Bangalore e apri un varco.
4. **La scogliera**: risali il canalone evitando i campi minati e conquista la trincea.
5. **I bunker MG42**: neutralizza 3 bunker con cariche, granate nella feritoia o bazooka.
6. **La batteria da 88**: attraversa il bocage e distruggi i cannoni che colpiscono la spiaggia.
7. **Colleville-sur-Mer**: libera il villaggio casa per casa (attenzione al cecchino sul campanile).
8. **Il contrattacco**: resisti 3 minuti a fanteria e semicingolati finché arrivano gli Sherman.

Checkpoint automatici: se cadi riparti dall'ultimo.

## Armi
- **USA:** M1 Garand, Thompson M1A1, BAR M1918A2, Springfield M1903A4 con ottica, Colt M1911A1, bazooka M1A1, granate Mk 2, cariche da demolizione, tubo Bangalore.
- **Germania (raccoglibili dai caduti):** Karabiner 98k, MP 40.

## Grafica e prestazioni
Dal menu scegli la qualità:
- **Basso**: niente ombre né post-processing, meno soldati. Per PC con grafica integrata.
- **Medio**: ombre, color grading cinematografico, erba.
- **Alto**: ombre morbide, bloom, più erba e più soldati.

Effetti: acqua con onde e schiuma, cielo procedurale con nuvole, fumo e fuoco a particelle, traccianti, crateri, materiali PBR con riflessi ambientali, audio spaziale sintetizzato con riverbero.

## Struttura
```
index.html, style.css   pagina e interfaccia
src/config.js           impostazioni, dati delle armi, utilità
src/engine.js           renderer, cielo, luci, post-processing
src/audio.js            audio sintetizzato (WebAudio)
src/fx.js               particelle, traccianti, detriti, crateri
src/world.js            terreno, acqua, spiaggia, bunker, villaggio, flotta
src/soldier.js          modelli dei soldati e IA
src/weapons.js          armi in prima persona, balistica, esplosioni
src/player.js           movimento, posture, danni, interazioni
src/mission.js          fasi della campagna, dialoghi, ondate, mezzi
src/hud.js              HUD, bussola, marcatori
src/main.js             menu, pausa, ciclo di gioco
```
