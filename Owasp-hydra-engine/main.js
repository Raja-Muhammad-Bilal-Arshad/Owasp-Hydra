// main.js - Electron main process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const log = require('electron-log');

const SERVER_PATH = path.join(process.resourcesPath || __dirname, 'server.js'); // packaged or dev
const WORK_DIR = process.cwd(); // app launch dir
const API_TOKEN = 'hydra-secret-token'; // for local use; you can change

let mainWindow;
let backendProc = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, 'renderer', 'dist', 'index.html')}`
    : 'http://localhost:5173';

  mainWindow.loadURL(startUrl);
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
}

// Spawn the Node backend (server.js) as a child process.
// It will be packaged and accessible via resourcesPath in production.
function startBackend() {
  const nodeExec = process.execPath; // electron binary also runs node
  const scriptPath = app.isPackaged ? SERVER_PATH : path.join(__dirname, 'server.js');
  log.info('Starting backend:', scriptPath);

  backendProc = spawn(nodeExec, [scriptPath], {
    cwd: WORK_DIR,
    env: { ...process.env, API_TOKEN: API_TOKEN, APP_PORT: '3000' },
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProc.stdout.on('data', (d) => log.info('backend:', d.toString()));
  backendProc.stderr.on('data', (d) => log.error('backend:', d.toString()));

  backendProc.on('close', (code) => {
    log.info('Backend exited with code', code);
    backendProc = null;
    // If backend exits unexpectedly, warn the user
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Backend stopped',
        message: `The backend process stopped (code ${code}). Some features may not work.`
      });
    }
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // attempt to gracefully stop backend
  if (backendProc) {
    try {
      backendProc.kill();
    } catch (e) { log.error(e); }
  }
});
