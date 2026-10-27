"use strict";
// ============================================================
//  Fronte Occidentale 1944 — applicazione per Windows (Electron).
//  Avvia il server del gioco dentro il programma (anche per il
//  multiplayer in rete locale) e apre il gioco in una finestra sua.
//  Le musiche personali stanno in Documenti\Fronte Occidentale 1944\musiche.
//  Gli aggiornamenti arrivano da soli dalle Releases di GitHub.
// ============================================================
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path'), net = require('net'), fs = require('fs');

// una sola copia del gioco aperta
if (!app.requestSingleInstanceLock()) { app.quit(); }

function freePort(p) {
  return new Promise(res => { const s = net.createServer(); s.once('error', () => res(freePort(p + 1))); s.once('listening', () => s.close(() => res(p))); s.listen(p, '0.0.0.0'); });
}
function personalDir() {
  const d = path.join(app.getPath('documents'), 'Fronte Occidentale 1944', 'musiche');
  try {
    fs.mkdirSync(d, { recursive: true });
    const g = path.join(d, 'LEGGIMI.txt'), src = path.join(__dirname, '..', 'assets', 'music', 'personali', 'LEGGIMI.txt');
    fs.writeFileSync(g, fs.readFileSync(src, 'utf8').replace(/In questa cartella/, 'In questa cartella (Documenti\\Fronte Occidentale 1944\\musiche)'));
  } catch (e) { }
  return d;
}

let win = null;
app.whenReady().then(async () => {
  const port = await freePort(8080);
  process.env.FO_PERSONALI = personalDir();
  process.argv[2] = String(port);
  require(path.join(__dirname, '..', 'server', 'server.js'));
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, show: false, backgroundColor: '#000000', title: 'Fronte Occidentale 1944',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'), autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false, contextIsolation: true },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL(`http://localhost:${port}/`);
  // collegamenti esterni nel browser normale; il visualizzatore resta nella finestra
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith(`http://localhost:${port}`)) { win.loadURL(url); return { action: 'deny' }; } shell.openExternal(url); return { action: 'deny' }; });
  // F11 schermo intero, F12 strumenti per sviluppatori, Ctrl+M apre la cartella delle musiche
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
    else if (i.control && (i.key === 'm' || i.key === 'M')) { shell.openPath(process.env.FO_PERSONALI); e.preventDefault(); }
  });
  // aggiornamenti automatici
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('update-downloaded', async () => {
      const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Riavvia ora', 'Più tardi'], title: 'Aggiornamento pronto', message: 'È pronta una nuova versione di Fronte Occidentale 1944.', detail: 'Riavvia per usarla (altrimenti verrà installata alla chiusura).' });
      if (r.response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.checkForUpdatesAndNotify().catch(() => { });
  } catch (e) { }
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
