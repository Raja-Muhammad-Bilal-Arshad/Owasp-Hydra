// server.js - Local backend for OWASP Hydra Engine
// IMPORTANT: run only on systems you control. Use with explicit permission.
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const APP_PORT = process.env.APP_PORT || 3000;
const BASE_DIR = path.resolve(process.cwd(), 'OWASP TOP 10');
const VENV_DIR = path.join(BASE_DIR, 'venv');
const API_TOKEN = process.env.API_TOKEN || 'hydra-secret-token';
const ALLOWED_FOLDERS = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'];

function dailyLogPath(){
  const d = new Date().toISOString().slice(0,10);
  return path.join(process.cwd(), `runs-${d}.log`);
}

function appendLog(line){
  fs.appendFileSync(dailyLogPath(), `[${new Date().toISOString()}] ${line}\n`);
}

const app = express();
app.use(bodyParser.json());

// simple auth
function checkAuth(req, res, next){
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = h.slice(7);
  if (token !== API_TOKEN) return res.status(403).json({ error: 'bad token' });
  next();
}

app.get('/status', checkAuth, (req,res) => {
  res.json({ status: fs.existsSync(BASE_DIR) ? 'ready' : 'missing_base' });
});

app.post('/venv/create', checkAuth, async (req,res) => {
  try{
    if (!fs.existsSync(BASE_DIR)) return res.status(400).json({error:'base missing'});
    spawnSyncLog('python3', ['-m','venv', VENV_DIR]);
    spawnSyncLog(path.join(VENV_DIR,'bin','python'), ['-m','pip','install','--upgrade','pip','setuptools','wheel']);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post('/venv/install-root', checkAuth, (req,res) => {
  try{
    const reqfile = path.join(BASE_DIR,'requirements.txt');
    if (!fs.existsSync(reqfile)) return res.status(400).json({error:'no root requirements'});
    spawnSyncLog(path.join(VENV_DIR,'bin','python'), ['-m','pip','install','-r', reqfile]);
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// run a folder sequentially
app.post('/run/folder/:name', checkAuth, async (req,res) => {
  const name = req.params.name;
  if (!ALLOWED_FOLDERS.includes(name)) return res.status(400).json({error:'bad folder'});
  const folderPath = path.join(BASE_DIR, name);
  if (!fs.existsSync(folderPath)) return res.status(400).json({error:'folder missing'});
  const sh = `for f in "${folderPath}"/*.py; do if [ -f "$f" ]; then "${path.join(VENV_DIR,'bin','python')}" "$f"; fi; done`;
  spawnDetachedLog('bash', ['-lc', sh]);
  res.json({ok:true});
});

// run-all: folder-parallel
app.post('/run/all', checkAuth, (req,res) => {
  ALLOWED_FOLDERS.forEach(folder => {
    const folderPath = path.join(BASE_DIR, folder);
    if (!fs.existsSync(folderPath)) return;
    const sh = `for f in "${folderPath}"/*.py; do if [ -f "$f" ]; then "${path.join(VENV_DIR,'bin','python')}" "$f"; fi; done`;
    spawnDetachedLog('bash', ['-lc', sh]);
  });
  res.json({ok:true});
});

// destroy
app.post('/destroy', checkAuth, (req,res) => {
  const c = req.body && req.body.confirm;
  if (c !== 'YES') return res.status(400).json({error:'type YES in JSON body as confirm'});
  try{
    fs.rmSync(BASE_DIR, { recursive: true, force: true });
    res.json({ok:true});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// targets manager: list / add / remove
const TARGETS_FILE = path.join(process.cwd(), 'hydra_targets.json');
function loadTargets(){ try { return JSON.parse(fs.readFileSync(TARGETS_FILE)); } catch(e){ return []; } }
function saveTargets(list){ fs.writeFileSync(TARGETS_FILE, JSON.stringify(list, null, 2)); }

app.get('/targets', checkAuth, (req,res) => res.json(loadTargets()));

app.post('/targets', checkAuth, (req,res) => {
  const t = req.body;
  if (!t || !t.name || !t.url) return res.status(400).json({ error: 'invalid target' });
  const list = loadTargets();
  list.push(t);
  saveTargets(list);
  res.json({ok:true});
});

app.delete('/targets/:name', checkAuth, (req,res) => {
  const name = req.params.name;
  const list = loadTargets().filter(t=>t.name!==name);
  saveTargets(list);
  res.json({ok:true});
});

// logs
app.get('/logs', checkAuth, (req,res) => {
  const p = dailyLogPath();
  if (!fs.existsSync(p)) return res.status(404).send('');
  res.sendFile(p);
});

// helper functions to run commands and append logs
function spawnSyncLog(cmd, args){
  appendLog(`RUN: ${cmd} ${args.join(' ')}`);
  const { spawnSync } = require('child_process');
  const out = spawnSync(cmd, args, { cwd: process.cwd() });
  if (out.stdout) appendLog(out.stdout.toString());
  if (out.stderr) appendLog('ERR: '+out.stderr.toString());
  return out.status;
}

function spawnDetachedLog(cmd, args){
  appendLog(`SPAWN: ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

app.listen(APP_PORT, () => {
  appendLog(`OWASP Hydra backend started on ${APP_PORT}. BASE_DIR=${BASE_DIR}`);
  console.log(`OWASP Hydra backend listening on ${APP_PORT}`);
});
