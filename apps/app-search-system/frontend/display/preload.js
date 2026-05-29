"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 展示端 - preload.ts
 */
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    minimizeWindow: () => electron_1.ipcRenderer.send('minimize-window'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('maximize-window'),
    closeWindow: () => electron_1.ipcRenderer.send('close-window'),
    isMaximized: () => electron_1.ipcRenderer.invoke('is-maximized'),
});
