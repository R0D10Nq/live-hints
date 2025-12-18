const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Управление окном
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    setIgnoreMouse: (ignore) => ipcRenderer.invoke('window:set-ignore-mouse', ignore),

    // STT управление
    startSTT: () => ipcRenderer.invoke('stt:start'),
    stopSTT: () => ipcRenderer.invoke('stt:stop'),

    // Аудио захват
    startAudioCapture: () => ipcRenderer.invoke('audio:start-capture'),
    stopAudioCapture: () => ipcRenderer.invoke('audio:stop-capture'),

    // События от main process
    onPCMData: (callback) => {
        ipcRenderer.on('audio:pcm-data', (event, data) => callback(data));
    },

    onTranscript: (callback) => {
        ipcRenderer.on('stt:transcript', (event, data) => callback(data));
    },

    onHint: (callback) => {
        ipcRenderer.on('llm:hint', (event, data) => callback(data));
    },

    onStatusChange: (callback) => {
        ipcRenderer.on('status:change', (event, status) => callback(status));
    },

    onError: (callback) => {
        ipcRenderer.on('error', (event, error) => callback(error));
    },

    // Удаление слушателей
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
