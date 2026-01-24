const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Add API functions here if needed
    sendAppReady: () => ipcRenderer.send('app-ready'),
    setCookies: (partition, cookies) => ipcRenderer.send('set-cookies', { partition, cookies }),
    setProxy: (partition, proxyRules) => ipcRenderer.send('set-proxy', { partition, proxyRules }),
    getIpInfo: (partition) => {
        console.log(`[Preload] getIpInfo called for ${partition}`);
        ipcRenderer.send('get-ip-info', { partition });
    },
    on: (channel, func) => {
        const subscription = (event, ...args) => func(event, ...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    }
});
