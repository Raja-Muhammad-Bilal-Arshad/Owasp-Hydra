#!/usr/bin/env bash
set -euo pipefail

ROOT="owasp-hydra-engine"

# create directories
mkdir -p "$ROOT"/renderer/src/components

# create top-level files with small placeholders
cat > "$ROOT/package.json" <<'EOF'
{
  "name": "owasp-hydra-engine",
  "version": "1.0.0",
  "description": "OWASP Hydra Engine - Electron GUI (placeholder).",
  "main": "main.js"
}
EOF

cat > "$ROOT/electron-builder.yml" <<'EOF'
# electron-builder config (placeholder)
# Replace with full config (see canvas document)
EOF

cat > "$ROOT/main.js" <<'EOF'
/*
main.js placeholder
Paste the full main.js content from the canvas / document named "Owasp-runner-gui (react + Node Backend)"
*/
EOF

cat > "$ROOT/preload.js" <<'EOF'
/*
preload.js placeholder
Paste the full preload.js content from the canvas document.
*/
EOF

cat > "$ROOT/server.js" <<'EOF'
/*
server.js placeholder
Paste the full backend server.js content from the canvas document.
*/
EOF

cat > "$ROOT/vite.config.js" <<'EOF'
/*
vite.config.js placeholder
Paste the Vite config from the canvas document.
*/
EOF

cat > "$ROOT/.electronignore" <<'EOF'
# .electronignore placeholder
node_modules
renderer/node_modules
.vscode
.git
*.log
*.md
EOF

cat > "$ROOT/README.md" <<'EOF'
# OWASP Hydra Engine - Project skeleton created by script
Replace placeholders in files with the full content from the canvas GUI document.
EOF

# renderer files
cat > "$ROOT/renderer/package.json" <<'EOF'
{
  "name": "owasp-hydra-renderer",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
EOF

cat > "$ROOT/renderer/index.html" <<'EOF'
<!-- index.html placeholder -->
<!-- Paste full index.html from canvas -->
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>OWASP Hydra Engine</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > "$ROOT/renderer/src/main.jsx" <<'EOF'
/* main.jsx placeholder */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
EOF

cat > "$ROOT/renderer/src/App.jsx" <<'EOF'
/* App.jsx placeholder
Paste the full App.jsx from the canvas document (Ghost Theme UI).
*/
EOF

cat > "$ROOT/renderer/src/styles.css" <<'EOF'
/* styles.css placeholder */
:root{ --bg:#050505; --accent:#ff2d95; }
body{ margin:0; font-family:Inter, system-ui; background:linear-gradient(180deg,#020202,#07111a); color:#e6edf3; }
EOF

cat > "$ROOT/renderer/src/components/Dashboard.jsx" <<'EOF'
/* Dashboard.jsx placeholder */
export default function Dashboard(){ return null; }
EOF

cat > "$ROOT/renderer/src/components/Targets.jsx" <<'EOF'
/* Targets.jsx placeholder */
export default function Targets(){ return null; }
EOF

# make script executable helper
chmod -R 755 "$ROOT"

echo "Done. Project skeleton created at ./$ROOT"
echo
echo "Next steps:"
echo "1) Open the canvas document named 'Owasp-runner-gui (react + Node Backend)' and copy full file contents into the placeholders created above."
echo "2) cd $ROOT"
echo "3) Run 'npm install' in root, then 'cd renderer && npm install' or simply run 'npm install' from root if package.json scripts/postinstall set up that way."
echo
echo "If you want, I can now: (A) paste any one of the full file contents here (file-by-file), or (B) produce a single large shell script that writes the full contents into files automatically. Tell me which files you want auto-populated next."
