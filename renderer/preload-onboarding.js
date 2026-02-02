const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  getDisplays: () => ipcRenderer.invoke('window:get-displays'),
  finishOnboarding: (settings) => ipcRenderer.invoke('onboarding:finish', settings),
});
