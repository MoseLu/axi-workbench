/**
 * Axi Docs Control - Electron 主进程
 */
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

// 日志
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info('[Control] 应用启动');

// 去掉原生菜单
Menu.setApplicationMenu(null);

// 全局窗口
let mainWindow: BrowserWindow | null = null;
const getResourcesPath = (): string =>
  (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || '';

/**
 * 读取服务器地址配置（优先级：exe 旁的 config.json > 默认值）
 * 允许运维人员在不重新打包的情况下修改服务器地址
 */
function getServerURL(): string | null {
  const configPath = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'config.json')
    : path.join(__dirname, '..', '..', 'backend', 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
        server?: { host?: string; port?: number };
        server_host?: string;
        server_port?: number;
      };
      const host = cfg.server?.host || cfg.server_host;
      const port = cfg.server?.port || cfg.server_port || 8765;
      if (host && host !== '0.0.0.0') {
        const url = `http://${host}:${port}`;
        log.info('[Control] 使用配置文件服务器地址:', url);
        return url;
      }
    } catch (e) {
      const err = e as Error;
      log.warn('[Control] 读取 config.json 失败:', err.message);
    }
  }

  log.info('[Control] 未配置服务器地址，交由前端自动发现后端');
  return null;
}

function createWindow(serverURL?: string | null): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: 'var(--axi-text, #1e293b)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.handle('maximize-window', async () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('close-window', () => mainWindow?.close());
  ipcMain.handle('is-maximized', () => mainWindow?.isMaximized());
  ipcMain.handle('get-stats', () => ({}));
  mainWindow.on('maximize', () => mainWindow?.webContents.send('maximize-change', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('maximize-change', false));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.setTitle('Axi Docs Control');
    log.info('[Control] 窗口已显示');
  });

  const isDev = !app.isPackaged;
  const DEV_SERVER = 'http://localhost:3000';
  if (isDev) {
    const url = new URL(DEV_SERVER);
    url.searchParams.set('mode', 'control');
    if (serverURL) {
      url.searchParams.set('api_url', serverURL);
    }
    mainWindow.loadURL(url.toString());
  } else {
    const buildPath = path.join(getResourcesPath(), 'webapp');
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const normalizedBuildPath = buildPath.replace(/\\/g, '/');
      const query = new URLSearchParams({ mode: 'control' });
      if (serverURL) {
        query.set('api_url', serverURL);
      }
      mainWindow.loadURL(`file://${normalizedBuildPath}/index.html?${query.toString()}`);
    } else {
      log.error('[Control] 未找到 index.html:', indexPath);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  log.info('[Control] Electron 就绪');
  const serverURL = getServerURL();

  createWindow(serverURL);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverURL);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
