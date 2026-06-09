# OWASP Hydra Engine — Build & Run (Linux AppImage)

## Prereqs
- Node.js >= 18 (npm)
- Python 3
- git (optional)
- For packaging: `libfuse2` installed on target Linux (AppImage run requirement). On Debian/Ubuntu: sudo apt install libfuse2

## Setup (development)
1. Clone or copy project:
   mkdir owasp-hydra-engine && cd owasp-hydra-engine
2. Install root deps:
   npm install
   (this runs postinstall and installs renderer deps)
3. Prepare your `OWASP TOP 10` project folder with A01..A10 inside the same directory.

## Run development (fast)
Open two terminals (or use `concurrently`):
1) Start renderer dev server:
   cd renderer
   npm run dev
2) Start electron:
   # from project root
   npm run dev:main
   (or) npm run dev

Renderer will be at http://localhost:5173; Electron will load it automatically.

## Build AppImage (production)
1) Build renderer and package:
   npm run dist

2) After packaging finishes, find the AppImage in `dist/` (electron-builder output).
3) chmod +x OWASP\ Hydra\ Engine-x86_64.AppImage
4) Run: ./OWASP\ Hydra\ Engine-x86_64.AppImage

## Security notes
- The packaged app spawns a local Node backend and runs Python scripts. Use only on systems you own or have permission to test.
- Do NOT expose the app to public networks.
- Change the default API token in `main.js` and `server.js`.

