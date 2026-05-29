/**
 * 中控端 - preload.ts
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getStats: () => ipcRenderer.invoke('get-stats'),
  setThemeColor: (color: string) => ipcRenderer.send('set-theme-color', color),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onMaximizeChange: (cb: (val: boolean) => void) => {
    ipcRenderer.on('maximize-change', (_, val: boolean) => cb(val));
    return () => ipcRenderer.removeAllListeners('maximize-change');
  },
  platform: process.platform,
});
