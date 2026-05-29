"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Axi Docs Display - Electron 主进程
 * 不启动本地后端，直接连接中控服务器
 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const electron_log_1 = __importDefault(require("electron-log"));
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'info';
electron_log_1.default.info('[Display] 应用启动');
electron_1.Menu.setApplicationMenu(null);
let mainWindow = null;
/**
 * 读取服务器地址配置（优先级：exe 旁的 config.json > 默认值）
 * 允许运维人员在不重新打包的情况下修改服务器地址
 */
function getServerURL() {
    // 已打包 exe 时，读取 exe 同目录的 config.json
    const configPath = electron_1.app.isPackaged
        ? path.join(path.dirname(electron_1.app.getPath('exe')), 'config.json')
        : path.join(__dirname, '..', '..', 'backend', 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const host = cfg.server?.host || cfg.server_host;
            const port = cfg.server?.port || cfg.server_port || 8765;
            if (host && host !== '0.0.0.0') {
                const url = `http://${host}:${port}`;
                electron_log_1.default.info('[Display] 使用配置文件服务器地址:', url);
                return url;
            }
        }
        catch (e) {
            const err = e;
            electron_log_1.default.warn('[Display] 读取 config.json 失败:', err.message);
        }
    }
    electron_log_1.default.info('[Display] 未配置服务器地址，交由前端自动发现后端');
    return '';
}
// 等待后端就绪（仅用于检测外网后端是否已启动）
async function waitForBackend(serverURL, maxAttempts = 30) {
    const healthUrl = `${serverURL}/api/stats`;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(healthUrl, (res) => {
                    if (res.statusCode === 200)
                        resolve();
                    else
                        reject(new Error(`status ${res.statusCode}`));
                });
                req.on('error', reject);
                req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            electron_log_1.default.info('[Display] 后端已就绪');
            return true;
        }
        catch {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    electron_log_1.default.warn('[Display] 后端未能在预期时间内就绪，继续启动（前端会自动重试连接）');
    return false;
}
function createWindow(serverURL) {
    const buildPath = path.join(process.resourcesPath, 'webapp');
    // 获取主显示器的实际分辨率
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
    const workArea = primaryDisplay.workArea;
    const scaleFactor = primaryDisplay.scaleFactor;
    electron_log_1.default.info(`[Display] 主显示器分辨率: ${screenWidth}x${screenHeight}, 缩放因子: ${scaleFactor}`);
    electron_log_1.default.info(`[Display] 工作区域: ${workArea.width}x${workArea.height}`);
    mainWindow = new electron_1.BrowserWindow({
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
    electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
    electron_1.ipcMain.handle('maximize-window', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('close-window', () => {
        electron_log_1.default.info('[Display] 关闭窗口');
        if (mainWindow) {
            mainWindow.setFullScreen(false);
            mainWindow.close();
        }
        electron_1.app.quit();
    });
    electron_1.ipcMain.handle('is-maximized', () => mainWindow?.isMaximized());
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.setTitle('Axi Docs Display');
        // 使用设备最大分辨率进入全屏
        mainWindow?.setFullScreen(true);
        electron_log_1.default.info('[Display] 窗口已全屏显示，分辨率:', mainWindow?.getSize());
    });
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        const query = { mode: 'display' };
        if (serverURL)
            query.api_url = serverURL;
        mainWindow.loadFile(indexPath, { query });
    }
    else {
        electron_log_1.default.warn('[Display] 未找到 index.html，尝试开发服务器');
        const suffix = serverURL ? `&api_url=${encodeURIComponent(serverURL)}` : '';
        mainWindow.loadURL(`http://localhost:3000?mode=display${suffix}`);
    }
    mainWindow.on('closed', () => { mainWindow = null; });
}
electron_1.app.whenReady().then(async () => {
    electron_log_1.default.info('[Display] Electron 就绪（展示端不启动本地后端）');
    const serverURL = getServerURL();
    // 先创建窗口，后台等待后端
    createWindow(serverURL);
    // 后端就绪后通知前端
    if (serverURL) {
        void waitForBackend(serverURL);
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow(serverURL);
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
