const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  getDisplays: () => ipcRenderer.invoke('window:get-displays'),
  finishOnboarding: (settings) => ipcRenderer.invoke('onboarding:finish', settings),
  parseFileBuffer: (buffer, type) => ipcRenderer.invoke('file:parse-buffer', buffer, type),
  saveContextFile: (type, content) => ipcRenderer.invoke('file:save-context', type, content),
});
