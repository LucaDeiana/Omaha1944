#!/usr/bin/env node
// Crea le cartelle degli audio personali leggendo il registro degli eventi (assets/audio_manifest.js).
// Non crea file audio e non tocca quelli esistenti. Scrive anche EVENTI_AUDIO.csv con l'elenco completo.
// Uso:  npm run audio:scaffold            (cartella local-assets/audio del progetto)
//       npm run audio:scaffold -- <cartella>   (es. Documenti\Fronte Occidentale 1944\audio)
//       npm run audio:scaffold -- <cartella> armi    (solo una categoria: weapons, vehicles, aircraft, naval, sniper, ...)
const fs = require('fs'), path = require('path');
const MF = require(path.join(__dirname, '..', 'assets', 'audio_manifest.js'));
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'local-assets', 'audio')), only = process.argv[3];
const dirs = new Set(), created = [];
for (const e of MF.list) if (!only || e.cat === only) dirs.add(path.dirname(e.path));
for (const d of [...dirs].sort()) { const full = path.join(root, d); if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); created.push(d); } }
const q = s => '"' + String(s).replace(/"/g, '""') + '"';
const csv = ['id;categoria;file (estensione .flac, .wav, .ogg o .mp3);descrizione;suono originale'].concat(MF.list.map(e => [e.id, e.cat, e.path + '.mp3', e.desc, e.orig].map(q).join(';'))).join('\r\n');
fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(path.join(root, 'EVENTI_AUDIO.csv'), '﻿' + csv);
const present = []; (function walk(d, r) { let l = []; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { } for (const x of l) { const rr = r ? r + '/' + x.name : x.name; if (x.isDirectory()) walk(path.join(d, x.name), rr); else if (/\.(flac|wav|ogg|mp3)$/i.test(x.name)) present.push(rr); } })(root, '');
console.log(`Cartella: ${root}`);
console.log(`Eventi nel registro: ${MF.list.length}${only ? ' (categoria ' + only + ')' : ''}`);
console.log(`Cartelle create ora: ${created.length}${created.length ? '\n  ' + created.join('\n  ') : ''}`);
console.log(`File audio già presenti: ${present.length}`);
console.log('Elenco completo degli eventi: EVENTI_AUDIO.csv');
