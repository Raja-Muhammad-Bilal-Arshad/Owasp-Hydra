import React, { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Targets from './components/Targets';
import './styles.css';

/**
 * App.jsx - Ultra Beast Mode shell
 * - shows splash while warming up
 * - contains layout for Dashboard (left) and Targets (right)
 * - uses Ghost theme styles in styles.css
 *
 * Save as: renderer/src/App.jsx
 */

export default function App() {
  const [ready, setReady] = useState(false);
  const [backendWarm, setBackendWarm] = useState(false);

  useEffect(() => {
    // splash for feel + brief backend warm check
    const splashT = setTimeout(() => setReady(true), 650);

    // attempt a lightweight backend ping to show status quickly
    const ping = async () => {
      try {
        // try to hit the backend status endpoint; it's fine if it fails
        await fetch('http://localhost:3000/status', { method: 'GET', headers: { Authorization: 'Bearer hydra-secret-token' } });
        setBackendWarm(true);
      } catch {
        setBackendWarm(false);
      }
    };
    ping();

    return () => clearTimeout(splashT);
  }, []);

  if (!ready) {
    return (
      <div className="app-root splash">
        <div className="splash-card">
          <div className="splash-logo">OWASP HYDRA ENGINE</div>
          <div className="splash-sub">Ghost — Ultra Beast Mode</div>
          <div className="spinner" aria-hidden="true"><span/></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <div className="logo">🛡️</div>
          <div>
            <div className="title">OWASP Hydra Engine</div>
            <div className="subtitle">Ghost — Ultra Beast Mode</div>
          </div>
        </div>

        <div className="header-actions">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{fontSize:13, color:'#9aa0a6'}}>Local UI</div>
            <div style={{fontSize:13, color: backendWarm ? '#22c55e' : '#ff6b6b' }}>
              {backendWarm ? 'Backend OK' : 'Backend cold'}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="left">
          <Dashboard />
        </section>

        <aside className="right">
          <Targets />
          <div className="panel info">
            <div className="panel-title">Quick Notes</div>
            <div className="muted">Backend: <code>http://localhost:3000</code></div>
            <div className="muted">API Token: <code>hydra-secret-token</code></div>
            <div style={{marginTop:8}}>Folders: <code>A01..A10</code> in project root. Demo scripts write <code>last_run.txt</code> on completion.</div>
          </div>
        </aside>
      </main>
    </div>
  );
}

