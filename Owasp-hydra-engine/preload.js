const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // optionally expose functions for the renderer to call main process
  showMessage: (title, body) => ipcRenderer.invoke('show-message', { title, body })
});
