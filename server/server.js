"use strict";
// ============================================================
//  Server di Omaha 1944 per la rete locale.
//  Serve i file del gioco via HTTP e inoltra i messaggi tra i
//  giocatori via WebSocket (implementazione minima, nessuna dipendenza).
//  Avvio:  node server/server.js [porta]
// ============================================================
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const ROOT = path.join(__dirname, '..'), PORT = +process.argv[2] || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  // nell'applicazione installata le musiche personali stanno in Documenti (la cartella del programma è di sola lettura)
  const PERS = process.env.FO_PERSONALI, PP = '/assets/music/personali/';
  if (PERS && p.startsWith(PP)) { const pf = path.normalize(path.join(PERS, p.slice(PP.length))); if (!pf.startsWith(path.normalize(PERS))) { res.writeHead(403); return res.end(); }
    return fs.readFile(pf, (err, data) => { if (err) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(pf).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data); }); }
  // audio personali: elenco dei file e file singoli dalla cartella locale (mai fuori da essa)
  // solo da questo PC: gli altri giocatori in rete non vedono né scaricano i tuoi file
  const local = /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || '');
  if (p.startsWith('/custom-audio/') || p.startsWith('/local-assets/')) { if (!local || !(p === '/custom-audio/index' || p.startsWith('/custom-audio/file/'))) { res.writeHead(403); return res.end(); } return customAudio(p, res); }
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT) || f.includes(`${path.sep}.git`) || f.includes(`${path.sep}server${path.sep}`)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  });
});

// ---------- audio personali ----------
// cartella: FO_AUDIO (programma installato: Documenti\Fronte Occidentale 1944\audio) oppure local-assets/audio nel progetto
const AUDIO_EXT = /\.(flac|wav|ogg|mp3)$/i;
function audioRoot() { return path.resolve(process.env.FO_AUDIO || path.join(ROOT, 'local-assets', 'audio')); }
function listAudio(dir, rel, out, depth) {
  if (depth > 6 || out.length > 4000) return;
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) listAudio(path.join(dir, e.name), r, out, depth + 1);
    else if (e.isFile() && AUDIO_EXT.test(e.name)) out.push(r);
  }
}
function customAudio(p, res) {
  const root = audioRoot();
  if (p === '/custom-audio/index') { const out = []; listAudio(root, '', out, 0); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); return res.end(JSON.stringify(out)); }
  const rel = p.slice('/custom-audio/file/'.length), f = path.resolve(root, rel);
  if (!AUDIO_EXT.test(f) || (f !== root && !f.startsWith(root + path.sep))) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  });
}

// ---------- WebSocket ----------
const clients = new Map(); let nextId = 1;
const stations = new Map(); // indice postazione -> id del giocatore
let hostId = 0; // chi simula la battaglia condivisa
function frame(str) {
  const pay = Buffer.from(str), n = pay.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, pay]);
}
function send(c, obj) { if (!c.dead) try { c.sock.write(frame(JSON.stringify(obj))); } catch (e) { } }
function broadcast(obj, except) { for (const c of clients.values()) if (c !== except && c.joined) send(c, obj); }
function drop(c) {
  if (c.dead) return; c.dead = true; clients.delete(c.id); try { c.sock.destroy(); } catch (e) { }
  for (const [k, v] of stations) if (v === c.id) { stations.delete(k); broadcast({ t: 'occ', i: k, by: 0 }); }
  if (c.joined && c.id === hostId && String(c.map).startsWith('snp')) { const nx = [...clients.values()].find(x => x.joined && !x.dead); hostId = nx ? nx.id : 0; if (nx) { broadcast({ t: 'newhost', id: nx.id }); console.log(`! nuovo host: ${nx.name}`); } }
  else if (c.joined && c.id === hostId) { hostId = 0; broadcast({ t: 'hostgone' }); console.log("! l'host ha lasciato: la battaglia condivisa termina"); }
  if (c.joined) { broadcast({ t: 'leave', id: c.id }); console.log(`- ${c.name} ha lasciato la partita (${clients.size} connessi)`); }
}
function onMessage(c, txt) {
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (m.t === 'join') {
    const h0 = hostId && clients.get(hostId); if (h0 && h0.map && m.map && h0.map !== m.map) { send(c, { t: 'mapdiff', map: h0.map }); return; }
    c.map = String(m.map || '');
    c.joined = true; if (!hostId || !clients.get(hostId)) hostId = c.id; c.name = String(m.name || 'Soldato').slice(0, 20); c.side = m.side === 'E' ? 'E' : 'A';
    send(c, { t: 'welcome', id: c.id, host: hostId, peers: [...clients.values()].filter(x => x !== c && x.joined).map(x => ({ id: x.id, name: x.name, side: x.side })), occ: [...stations] });
    broadcast({ t: 'join', id: c.id, name: c.name, side: c.side }, c);
    console.log(`+ ${c.name} (${c.side === 'E' ? 'Asse' : 'Alleati'}) è entrato (${clients.size} connessi)`);
    return;
  }
  if (!c.joined) return;
  m.id = c.id;
  if (m.t === 'aihit') { const h = clients.get(hostId); if (h) send(h, m); return; }
  if (m.t === 'aikill') { const to = clients.get(m.to); if (to) send(to, m); return; }
  if (m.t === 'hit' || m.t === 'kill') { const to = clients.get(m.to); if (to) send(to, m); if (m.t === 'kill') broadcast({ t: 'feed', text: `${to ? to.name : '?'} ha eliminato ${c.name}` }, null); return; }
  if (m.t === 'occ') {
    const cur = stations.get(m.i);
    if (m.on) { if (cur && cur !== c.id) return send(c, { t: 'occ', i: m.i, by: cur, denied: true }); stations.set(m.i, c.id); }
    else if (cur === c.id) stations.delete(m.i);
    broadcast({ t: 'occ', i: m.i, by: m.on ? c.id : 0 }, null); return;
  }
  broadcast(m, c); // stato, colpi sparati, esplosioni
}
server.on('upgrade', (req, sock) => {
  if (req.url !== '/ws' || !req.headers['sec-websocket-key']) return sock.destroy();
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
  sock.setNoDelay(true);
  const c = { id: nextId++, sock, buf: Buffer.alloc(0), joined: false, dead: false, frag: [] };
  clients.set(c.id, c);
  sock.on('data', d => {
    c.buf = Buffer.concat([c.buf, d]);
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 15, fin = b0 & 128, masked = b1 & 128;
      let len = b1 & 127, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return drop(c);
      const need = off + (masked ? 4 : 0) + len; if (c.buf.length < need) return;
      const mask = masked ? c.buf.slice(off, off + 4) : null, pay = Buffer.from(c.buf.slice(off + (masked ? 4 : 0), need));
      if (mask) for (let i = 0; i < pay.length; i++) pay[i] ^= mask[i & 3];
      c.buf = c.buf.slice(need);
      if (op === 8) return drop(c);
      if (op === 9) { try { sock.write(Buffer.concat([Buffer.from([0x8a, pay.length]), pay])); } catch (e) { } continue; }
      if (op === 1 || op === 0) { c.frag.push(pay); if (fin) { const txt = Buffer.concat(c.frag).toString('utf8'); c.frag = []; onMessage(c, txt); } }
    }
  });
  sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nOmaha 1944 — server multiplayer avviato sulla porta ${PORT}\n`);
  console.log(`Su questo PC apri:      http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`Sugli altri PC apri:    http://${a.address}:${PORT}`);
  console.log('\nNel menu spunta "Multiplayer in rete locale", scegli nome e fazione e premi INIZIA.\n');
});
