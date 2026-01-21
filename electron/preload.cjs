const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Add API functions here if needed
    sendAppReady: () => ipcRenderer.send('app-ready'),
    setCookies: (partition, cookies) => ipcRenderer.send('set-cookies', { partition, cookies })
});
