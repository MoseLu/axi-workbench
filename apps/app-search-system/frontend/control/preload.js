"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 中控端 - preload.ts
 */
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getStats: () => electron_1.ipcRenderer.invoke('get-stats'),
    setThemeColor: (color) => electron_1.ipcRenderer.send('set-theme-color', color),
    minimizeWindow: () => electron_1.ipcRenderer.send('minimize-window'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('maximize-window'),
    closeWindow: () => electron_1.ipcRenderer.send('close-window'),
    isMaximized: () => electron_1.ipcRenderer.invoke('is-maximized'),
    onMaximizeChange: (cb) => {
        electron_1.ipcRenderer.on('maximize-change', (_, val) => cb(val));
        return () => electron_1.ipcRenderer.removeAllListeners('maximize-change');
    },
    platform: process.platform,
});
