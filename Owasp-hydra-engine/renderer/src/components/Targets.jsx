// renderer/src/components/Targets.jsx
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * Targets.jsx - Target manager UI for OWASP Hydra Engine (Ultra Beast Mode)
 *
 * Features:
 * - List / Add / Edit / Delete targets (uses GET/POST/DELETE /targets endpoints)
 * - Run chosen OWASP folders (A01..A10) against a selected target:
 *    * Calls POST /run/folder/:name for each selected folder with body { target: url }
 *    * Tracks per-run progress client-side and watches backend logs for completion markers
 * - Export / Import targets as JSON
 * - Polished Ghost-theme UI that integrates with existing styles.css
 *
 * Notes:
 * - Backend must expose: GET /targets, POST /targets, DELETE /targets/:name
 * - Backend run endpoints: POST /run/folder/:name and POST /run/all are used.
 * - If you changed the API token in server.js, update API_TOKEN here.
 */

const BACKEND = 'http://localhost:3000';
const API_TOKEN = 'hydra-secret-token';
const FOLDERS = ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10'];

function cfg() {
  return { headers: { Authorization: `Bearer ${API_TOKEN}` }, timeout: 20000 };
}

export default function Targets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); // for UI blocking actions
  const [runState, setRunState] = useState({}); // { targetName: {running:bool, progress: number, details: {...}} }
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { name, url } when editing
  const logsRef = useRef(''); // cached logs for parsing run completion
  const pollRef = useRef(null);

  useEffect(() => {
    fetchTargets();
    // start a background log poll to support run completion detection
    pollRef.current = setInterval(fetchLogs, 1400);
    return () => clearInterval(pollRef.current);
  }, []);

  // ---------------- API helpers ----------------
  async function fetchTargets() {
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND}/targets`, cfg());
      setTargets(r.data || []);
    } catch (e) {
      console.warn('fetchTargets error', e);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }

  async function addTarget(name, url) {
    try {
      await axios.post(`${BACKEND}/targets`, { name, url }, cfg());
      await fetchTargets();
    } catch (e) {
      alert('Add failed: ' + (e?.response?.data?.error || e.message));
    }
  }

  async function deleteTarget(name) {
    if (!confirm(`Delete target ${name}?`)) return;
    try {
      await axios.delete(`${BACKEND}/targets/${encodeURIComponent(name)}`, cfg());
      await fetchTargets();
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.error || e.message));
    }
  }

  // Edit is implemented as delete(old) + post(new) because backend has no PUT
  async function editTargetSave(oldName, newName, newUrl) {
    try {
      if (oldName !== newName) {
        // delete old first if name changed
        await axios.delete(`${BACKEND}/targets/${encodeURIComponent(oldName)}`, cfg());
      }
      await axios.post(`${BACKEND}/targets`, { name: newName, url: newUrl }, cfg());
      await fetchTargets();
    } catch (e) {
      alert('Edit failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setEditTarget(null);
      setShowModal(false);
    }
  }

  // ---------------- Logs for run detection ----------------
  async function fetchLogs() {
    try {
      const r = await axios.get(`${BACKEND}/logs`, { ...cfg(), responseType: 'text' });
      const text = r.data || '';
      // update cached logs for run detection/parsing
      // keep only tail to avoid memory blowup
      logsRef.current = text;
      // attempt to resolve any running runs
      detectRunCompletions();
    } catch (e) {
      // logs may not exist yet; ignore
    }
  }

  // ---------------- Run target logic ----------------
  // Run selected folders for the given target.
  // This function will:
  //  - POST /run/folder/:name for each selected folder with body { target: url }
  //  - Set a per-target runState item and poll logsRef for completion markers
  async function runTarget(target, foldersToRun = FOLDERS.slice()) {
    const tkey = target.name;
    if (runState[tkey] && runState[tkey].running) {
      alert('This target already has a running job.');
      return;
    }

    setRunState(prev => ({ ...prev, [tkey]: { running: true, progress: 5, folders: foldersToRun.slice(), startedAt: Date.now(), completed: [] } }));
    setBusy(true);

    // Trigger each folder run (fire-and-forget). We do not wait for them to finish here.
    const posts = foldersToRun.map(folder =>
      axios.post(`${BACKEND}/run/folder/${folder}`, { target: target.url }, cfg())
        .then(() => ({ folder, ok: true }))
        .catch(err => ({ folder, ok: false, err }))
    );

    const results = await Promise.all(posts);
    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      alert(`Some folder runs failed to start: ${failed.map(f => f.folder).join(', ')}`);
      // still proceed to monitor logs for those started
    }

    // Start a monitor loop that checks logsRef for completion markers for each folder
    // We'll keep this simple: when logs contain both "Demo script for <folder>" and "Demo complete" for that folder
    // OR when last_run.txt appears on filesystem (not implemented here), we'll mark folder complete.
    // We'll update progress values to give feedback.

    const monitor = setInterval(() => {
      const tail = logsRef.current || '';
      setRunState(prev => {
        const state = prev[tkey];
        if (!state || !state.running) return prev;

        const newCompleted = [...(state.completed || [])];
        state.folders.forEach(folder => {
          if (!newCompleted.includes(folder)) {
            const started = tail.includes(`Demo script for ${folder}`) || tail.toLowerCase().includes(`demo script for ${folder.toLowerCase()}`);
            const finished = tail.includes('Demo complete') && (tail.includes(folder) || tail.toLowerCase().includes(folder.toLowerCase()));
            if (finished) {
              newCompleted.push(folder);
            } else if (started) {
              // bump progress for started ones
            }
          }
        });

        const progressPercent = Math.min(95, Math.round((newCompleted.length / Math.max(1, state.folders.length)) * 100));
        const newState = {
          ...prev,
          [tkey]: { ...state, completed: newCompleted, progress: progressPercent }
        };

        // if all completed -> finalize
        if (newCompleted.length >= state.folders.length) {
          newState[tkey] = { ...newState[tkey], running: false, progress: 100, finishedAt: Date.now() };
          // after a short delay, keep progress at 100 for UX then reset to 0 after some time
          setTimeout(() => {
            setRunState(rs => ({ ...rs, [tkey]: { ...(rs[tkey] || {}), progress: 0 } }));
          }, 1800);
          clearInterval(monitor);
          setBusy(false);
        }

        return newState;
      });
    }, 1500);

    // stop monitor after a long timeout (e.g., 20 minutes) to avoid infinite loops
    setTimeout(() => {
      setRunState(prev => {
        const state = prev[tkey];
        if (!state) return prev;
        if (state.running) {
          // mark as stopped due to timeout
          return { ...prev, [tkey]: { ...state, running: false, timedOut: true } };
        }
        return prev;
      });
      clearInterval(monitor);
      setBusy(false);
    }, 20 * 60 * 1000); // 20 minutes
  }

  // Called periodically to mark run completions using logsRef (in addition to monitor)
  function detectRunCompletions() {
    // iterate over runState targets that are running and update completed arrays
    Object.keys(runState).forEach(tkey => {
      const st = runState[tkey];
      if (!st || !st.running) return;
      const tail = logsRef.current || '';
      const newCompleted = [...(st.completed || [])];
      st.folders.forEach(folder => {
        if (!newCompleted.includes(folder)) {
          const finished = tail.includes('Demo complete') && (tail.includes(folder) || tail.toLowerCase().includes(folder.toLowerCase()));
          if (finished) newCompleted.push(folder);
        }
      });
      if (newCompleted.length !== (st.completed || []).length) {
        setRunState(prev => ({ ...prev, [tkey]: { ...prev[tkey], completed: newCompleted, progress: Math.round((newCompleted.length / Math.max(1, st.folders.length)) * 100) } }));
      }
    });
  }

  // ---------------- Export / Import ----------------
  function exportTargets() {
    const blob = new Blob([JSON.stringify(targets, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hydra_targets_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function importTargets(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result);
        if (!Array.isArray(json)) throw new Error('Invalid format');
        // Bulk-post targets (will create duplicates if server doesn't check)
        for (const t of json) {
          if (t && t.name && t.url) {
            try { await axios.post(`${BACKEND}/targets`, { name: t.name, url: t.url }, cfg()); } catch (e) { /* ignore individual errors */ }
          }
        }
        await fetchTargets();
        alert('Import complete');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(f);
    // reset the input
    e.target.value = '';
  }

  // ---------------- UI helpers ----------------
  function openAddModal() {
    setEditTarget({ name: '', url: '' });
    setShowModal(true);
  }

  function openEditModal(t) {
    setEditTarget({ name: t.name, url: t.url, oldName: t.name });
    setShowModal(true);
  }

  // ---------------- Render ----------------
  return (
    <div className="panel targets">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <div className="panel-title">Targets</div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn small" onClick={openAddModal} disabled={busy}>Add</button>
          <button className="btn small" onClick={exportTargets} disabled={targets.length===0}>Export</button>
          <label className="btn small" style={{display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer'}}>
            Import
            <input type="file" accept="application/json" onChange={importTargets} style={{display:'none'}} />
          </label>
        </div>
      </div>

      <div style={{maxHeight:260, overflow:'auto', display:'grid', gap:8}}>
        {loading && <div className="muted">Loading...</div>}
        {!loading && targets.length === 0 && <div className="muted">No targets configured</div>}

        {targets.map(t => {
          const rs = runState[t.name] || { running: false, progress: 0, completed: [] };
          return (
            <div key={t.name} className="target-item">
              <div>
                <div style={{fontWeight:700}}>{t.name}</div>
                <div className="muted" style={{fontSize:12}}>{t.url}</div>
                {rs.running && <div style={{fontSize:12, marginTop:6, color:'#ffd'}}>Running: {rs.progress || 0}%</div>}
                {rs.timedOut && <div style={{fontSize:12, marginTop:6, color:'#ff6b6b'}}>Timed out</div>}
                {rs.finishedAt && <div style={{fontSize:12, marginTop:6, color:'#9aa0a6'}}>Finished</div>}
              </div>

              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                <button
                  className="btn small"
                  onClick={() => {
                    // run modal to pick folders
                    const folders = prompt(`Run which folders for target "${t.name}"?\nEnter comma-separated A01..A10 or leave blank for ALL (e.g. A01,A03)`, '');
                    let toRun = FOLDERS.slice();
                    if (folders && folders.trim()) {
                      toRun = folders.split(',').map(s => s.trim().toUpperCase()).filter(s => FOLDERS.includes(s));
                      if (toRun.length === 0) { alert('No valid folders selected'); return; }
                    }
                    runTarget(t, toRun);
                  }}
                  disabled={busy}
                >
                  Run
                </button>

                <div style={{display:'flex', gap:6, flexDirection:'column', alignItems:'stretch'}}>
                  <button className="btn small alt" onClick={() => openEditModal(t)}>Edit</button>
                  <button className="btn small warn" onClick={() => deleteTarget(t.name)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit modal (simple inline modal) */}
      {showModal && editTarget && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', zIndex: 2000
        }}>
          <div style={{width:520, background:'#081014', padding:18, borderRadius:10, border:'1px solid rgba(255,255,255,0.03)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div style={{fontWeight:700}}>Add / Edit Target</div>
              <div><button className="btn small" onClick={() => { setShowModal(false); setEditTarget(null); }}>Close</button></div>
            </div>

            <div style={{display:'grid', gap:8}}>
              <label className="muted">Name</label>
              <input className="input" value={editTarget.name} onChange={e => setEditTarget({...editTarget, name: e.target.value})} />
              <label className="muted">URL</label>
              <input className="input" value={editTarget.url} onChange={e => setEditTarget({...editTarget, url: e.target.value})} />
              <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:8}}>
                <button className="btn" onClick={() => {
                  if (!editTarget.name || !editTarget.url) { alert('Name and URL required'); return; }
                  // if editing an existing target (oldName), save as edit
                  if (editTarget.oldName) {
                    editTargetSave(editTarget.oldName, editTarget.name, editTarget.url);
                  } else {
                    addTarget(editTarget.name, editTarget.url).then(() => { setShowModal(false); setEditTarget(null); });
                  }
                }}>Save</button>
                <button className="btn small alt" onClick={() => { setShowModal(false); setEditTarget(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
