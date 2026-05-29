/**
 * Axi Docs Display - Electron 主进程
 * 不启动本地后端，直接连接中控服务器
 */
import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info('[Display] 应用启动');

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

/**
 * 读取服务器地址配置（优先级：exe 旁的 config.json > 默认值）
 * 允许运维人员在不重新打包的情况下修改服务器地址
 */
function getServerURL(): string {
  // 已打包 exe 时，读取 exe 同目录的 config.json
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
        log.info('[Display] 使用配置文件服务器地址:', url);
        return url;
      }
    } catch (e) {
      const err = e as Error;
      log.warn('[Display] 读取 config.json 失败:', err.message);
    }
  }

  log.info('[Display] 未配置服务器地址，交由前端自动发现后端');
  return '';
}

// 等待后端就绪（仅用于检测外网后端是否已启动）
async function waitForBackend(serverURL: string, maxAttempts = 30): Promise<boolean> {
  const healthUrl = `${serverURL}/api/stats`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(healthUrl, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      log.info('[Display] 后端已就绪');
      return true;
    } catch {
      await new Promise<void>(r => setTimeout(r, 1000));
    }
  }
  log.warn('[Display] 后端未能在预期时间内就绪，继续启动（前端会自动重试连接）');
  return false;
}

function createWindow(serverURL: string): void {
  const buildPath = path.join(process.resourcesPath!, 'webapp');

  // 获取主显示器的实际分辨率
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
  const workArea = primaryDisplay.workArea;
  const scaleFactor = primaryDisplay.scaleFactor;

  log.info(`[Display] 主显示器分辨率: ${screenWidth}x${screenHeight}, 缩放因子: ${scaleFactor}`);
  log.info(`[Display] 工作区域: ${workArea.width}x${workArea.height}`);

  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: screenWidth,
    height: screenHeight,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('close-window', () => {
    log.info('[Display] 关闭窗口');
    if (mainWindow) {
      mainWindow.setFullScreen(false);
      mainWindow.close();
    }
    app.quit();
  });
  ipcMain.handle('is-maximized', () => mainWindow?.isMaximized());

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.setTitle('Axi Docs Display');
    // 使用设备最大分辨率进入全屏
    mainWindow?.setFullScreen(true);
    log.info('[Display] 窗口已全屏显示，分辨率:', mainWindow?.getSize());
  });

  const indexPath = path.join(buildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const query: Record<string, string> = { mode: 'display' };
    if (serverURL) query.api_url = serverURL;
    mainWindow.loadFile(indexPath, { query });
  } else {
    log.warn('[Display] 未找到 index.html，尝试开发服务器');
    const suffix = serverURL ? `&api_url=${encodeURIComponent(serverURL)}` : '';
    mainWindow.loadURL(`http://localhost:3000?mode=display${suffix}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  log.info('[Display] Electron 就绪（展示端不启动本地后端）');
  const serverURL = getServerURL();
  // 先创建窗口，后台等待后端
  createWindow(serverURL);
  // 后端就绪后通知前端
  if (serverURL) {
    void waitForBackend(serverURL);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverURL);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
