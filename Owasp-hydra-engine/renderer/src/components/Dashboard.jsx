// renderer/src/components/Dashboard.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * Dashboard.jsx
 * Ultra Beast Mode control center:
 * - Polls /logs and /status
 * - Calls /run/folder/:name, /run/all, /venv/create, /venv/install-root, /destroy
 * - Parses logs to detect demo script start/finish and updates per-folder UI
 *
 * NOTE: If you changed the backend API token, update API_TOKEN below.
 */

const BACKEND = 'http://localhost:3000';
const API_TOKEN = 'hydra-secret-token'; // change if you changed server.js/main.js
const POLL_INTERVAL_MS = 1400;
const FOLDERS = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'];

function cfg() {
  return { headers: { Authorization: `Bearer ${API_TOKEN}` }, timeout: 20000 };
}

export default function Dashboard() {
  const [backendStatus, setBackendStatus] = useState('unknown');
  const [logs, setLogs] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' or folder name
  const [filterText, setFilterText] = useState('');
  const [autoFollow, setAutoFollow] = useState(true);
  const [running, setRunning] = useState({}); // { A01: true, ... }
  const [progress, setProgress] = useState({}); // percent per folder
  const [loading, setLoading] = useState(true);
  const [lastFetchError, setLastFetchError] = useState(null);

  const logsRef = useRef('');
  const pollHandle = useRef(null);
  const logBoxRef = useRef(null);
  const lastLenRef = useRef(0);

  // helper: update map immutably
  const setRunState = (folder, val) => setRunning(prev => ({ ...prev, [folder]: val }));
  const setProg = (folder, val) => setProgress(prev => ({ ...prev, [folder]: val }));

  useEffect(() => {
    // initial fetch + polling
    fetchStatus();
    fetchLogs()
      .finally(() => {
        setLoading(false);
      });

    pollHandle.current = setInterval(() => {
      fetchLogs().catch(() => { /* ignore */ });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollHandle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFollow && logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs, autoFollow]);

  async function fetchStatus() {
    try {
      const r = await axios.get(`${BACKEND}/status`, cfg());
      setBackendStatus(r.data.status || 'ready');
      setLastFetchError(null);
    } catch (err) {
      setBackendStatus('down');
      setLastFetchError(err);
    }
  }

  async function fetchLogs() {
    try {
      const r = await axios.get(`${BACKEND}/logs`, { headers: { Authorization: `Bearer ${API_TOKEN}` }, responseType: 'text', timeout: 15000 });
      const text = r.data || '';
      // parse diff to update running/progress
      parseLogDiff(logsRef.current, text);
      logsRef.current = text;
      setLogs(text);
      lastLenRef.current = text.length;
      setLastFetchError(null);
    } catch (err) {
      // If logs endpoint missing, ignore until available
      setLastFetchError(err);
      // Keep previous logs visible; do not clear.
      // console.warn('fetchLogs error', err);
    }
  }

  function parseLogDiff(oldText, newText) {
    // only parse appended text for efficiency
    if (!newText || newText.length <= (oldText ? oldText.length : 0)) return;
    const added = newText.slice(oldText.length || 0);

    // For demo.py we expect:
    // "=== Demo script for <folder> ==="
    // "Demo complete. Exit code 0."
    // We'll look for these markers.
    FOLDERS.forEach(folder => {
      const startMark = `Demo script for ${folder}`;
      const startMarkLower = `Demo script for ${folder.toLowerCase()}`;
      if (added.includes(startMark) || added.includes(startMarkLower)) {
        // mark started
        setRunState(folder, true);
        setProg(folder, Math.max(progress[folder] || 0, 5));
      }
      if (added.includes('Demo complete') && (added.includes(folder) || added.toLowerCase().includes(folder.toLowerCase()))) {
        // finished for this folder
        setRunState(folder, false);
        setProg(folder, 100);
        // reset after short delay for UI niceness
        setTimeout(() => setProg(folder, 0), 1500);
      }
    });

    // gentle progress nudge for currently running folders
    setProgress(prev => {
      const out = { ...prev };
      Object.keys(out).forEach(f => {
        if ((running[f] || out[f] > 0) && out[f] < 95) {
          out[f] = Math.min(95, out[f] + Math.floor(Math.random() * 10));
        }
      });
      return out;
    });
  }

  /* ---------------- Actions ---------------- */

  async function runFolder(folder, { withTarget } = { withTarget: false }) {
    // optional: ask for target to pass; backend may ignore body unless implemented
    let body = {};
    if (withTarget) {
      const t = window.prompt(`Enter target for ${folder} (optional) — leave blank for none:`);
      if (t) body = { target: t };
    }

    setRunState(folder, true);
    setProg(folder, Math.max(progress[folder] || 0, 8));

    try {
      await axios.post(`${BACKEND}/run/folder/${folder}`, body, cfg());
      // we don't wait for completion — it's backgrounded; logs will update via poll
    } catch (err) {
      setRunState(folder, false);
      setProg(folder, 0);
      alert('Failed to trigger run: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function runAll() {
    // optimistic UI
    const newMap = {};
    FOLDERS.forEach(f => { newMap[f] = true; });
    setRunning(newMap);
    FOLDERS.forEach(f => setProg(f, 8));

    try {
      await axios.post(`${BACKEND}/run/all`, {}, cfg());
    } catch (err) {
      setRunning({});
      alert('Run all failed: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function createVenv() {
    try {
      await axios.post(`${BACKEND}/venv/create`, {}, cfg());
      alert('Venv creation requested. Check logs for progress.');
      fetchLogs();
    } catch (err) {
      alert('Venv creation failed: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function installRootReqs() {
    try {
      await axios.post(`${BACKEND}/venv/install-root`, {}, cfg());
      alert('Root requirements install requested. Check logs.');
      fetchLogs();
    } catch (err) {
      alert('Install failed: ' + (err?.response?.data?.error || err.message));
    }
  }

  async function destroyAll() {
    const ok = window.prompt('Type YES to permanently delete A01..A10 and today logs');
    if (ok !== 'YES') return;
    try {
      await axios.post(`${BACKEND}/destroy`, { confirm: 'YES' }, cfg());
      alert('Destroy completed. Check filesystem.');
      // clear UI state
      setLogs('');
      setRunning({});
      setProgress({});
    } catch (err) {
      alert('Destroy failed: ' + (err?.response?.data?.error || err.message));
    }
  }

  /* ------------- Console helpers ------------- */

  function filteredConsoleText() {
    if (!logs) return '[no logs]';
    if (activeTab === 'ALL') {
      if (!filterText) return logs;
      const q = filterText.toLowerCase();
      return logs.split('\n').filter(l => l.toLowerCase().includes(q)).join('\n');
    } else {
      // show only lines mentioning folder token
      return logs.split('\n').filter(l => l.includes(activeTab) || l.toLowerCase().includes(activeTab.toLowerCase())).join('\n');
    }
  }

  function copyConsole() {
    const text = filteredConsoleText();
    navigator.clipboard.writeText(text).then(() => alert('Console copied to clipboard'), () => alert('Copy failed'));
  }

  function downloadLogsFile() {
    const blob = new Blob([logs || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runs-${new Date().toISOString().slice(0,10)}.log`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ------------- Render ------------- */

  return (
    <div>
      {/* Control bar */}
      <div className="panel controls">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="panel-title">Control Center</div>
            <div className="muted">Backend: <b>{backendStatus}</b>{lastFetchError ? ' (logs may be missing)' : ''}</div>
          </div>

          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={createVenv}>Create Venv</button>
            <button className="btn" onClick={installRootReqs}>Install Reqs</button>
            <button className="btn danger" onClick={runAll}>Run ALL</button>
            <button className="btn warn" onClick={destroyAll}>Destroy</button>
          </div>
        </div>
      </div>

      {/* Folder cards */}
      <div className="panel folders" style={{marginTop:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <div className="panel-title">Folders</div>

          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <input className="input" placeholder="search console..." value={filterText} onChange={e => setFilterText(e.target.value)} />
            <label className="muted"><input type="checkbox" checked={autoFollow} onChange={e=>setAutoFollow(e.target.checked)} /> auto-follow</label>
            <button className="btn small" onClick={downloadLogsFile}>Download Logs</button>
          </div>
        </div>

        <div className="folder-grid">
          {FOLDERS.map(folder => (
            <div className="folder-card" key={folder}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                <div className="mono">{folder}</div>
                <div style={{fontSize:12}}>
                  {running[folder] ? <span style={{color:'#ffd'}}>RUNNING</span> : <span className="muted">idle</span>}
                </div>
              </div>

              <div style={{display:'flex', gap:8, marginBottom:8}}>
                <button className="btn small" onClick={()=>runFolder(folder, { withTarget: false })}>Run</button>
                <button className="btn small alt" onClick={() => { setActiveTab(folder); }}>Tail</button>
                <button className="btn small alt" onClick={() => runFolder(folder, { withTarget: true })}>Run (with target)</button>
              </div>

              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: (progress[folder] || 0) + '%' }} />
              </div>

              <div style={{display:'flex', justifyContent:'space-between', marginTop:6}}>
                <div className="muted">progress: {progress[folder] ? progress[folder]+'%' : '-'}</div>
                <div className="muted">pid: -</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Console */}
      <div className="panel console" style={{marginTop:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <div className="panel-title">Console</div>
            <div className="tabs" role="tablist" aria-label="Log tabs">
              <button className={`tab ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => setActiveTab('ALL')}>ALL</button>
              {FOLDERS.map(f => <button key={f} className={`tab ${activeTab === f ? 'active' : ''}`} onClick={() => setActiveTab(f)}>{f}</button>)}
            </div>
          </div>

          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button className="btn small" onClick={() => { setLogs(''); logsRef.current = ''; }}>Clear View</button>
            <button className="btn small" onClick={copyConsole}>Copy</button>
            <div className="muted">lines: {logs ? logs.split('\n').length : 0}</div>
          </div>
        </div>

        <div ref={logBoxRef} className="logbox" aria-live="polite" aria-atomic="false">
          <pre style={{margin:0, whiteSpace:'pre-wrap', fontFamily:'monospace'}}>{filteredConsoleText() || '[no logs yet]'}</pre>
        </div>
      </div>
    </div>
  );
}
