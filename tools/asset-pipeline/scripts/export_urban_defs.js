// Esporta le definizioni degli edifici dell'Urban Expansion 3.0 dal gioco (src/aaa/xdestruct.js) al JSON letto da Blender:
//   node tools/asset-pipeline/scripts/export_urban_defs.js src/aaa/xdestruct.js assets/aaa/urban/urban_defs.json
const fs = require('fs'); const s = fs.readFileSync(process.argv[2], 'utf8'); const PI = Math.PI;
const iso = s.match(/isolato1: (\[[\s\S]*?\n  \]),/)[1], rows = s.match(/const XDZ_ROWS = (\[[\s\S]*?\n\]);/)[1];
const A = eval(iso), B = eval(rows), more = s.match(/XDZ_ROWS\.push\(([\s\S]*?)\n\);/); if (more) B.push(...eval('[' + more[1] + ']'));
const out = { formato: 'omaha1944-urban-1', nota: 'Definizioni degli edifici dell\'Urban Expansion 3.0: lette dal gioco (src/aaa/xdestruct.js) e dal generatore Blender (tools/asset-pipeline/blender/generators/urban_house.py)', isolato1: { front: 90, items: A }, file: B };
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(A.length, B.reduce((a, r) => a + r.items.length, 0));
