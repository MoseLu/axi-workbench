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
 * Axi Docs Control - Electron 主进程
 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_log_1 = __importDefault(require("electron-log"));
// 日志
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'info';
electron_log_1.default.info('[Control] 应用启动');
// 去掉原生菜单
electron_1.Menu.setApplicationMenu(null);
// 全局窗口
let mainWindow = null;
const getResourcesPath = () => process.resourcesPath || '';
/**
 * 读取服务器地址配置（优先级：exe 旁的 config.json > 默认值）
 * 允许运维人员在不重新打包的情况下修改服务器地址
 */
function getServerURL() {
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
                electron_log_1.default.info('[Control] 使用配置文件服务器地址:', url);
                return url;
            }
        }
        catch (e) {
            const err = e;
            electron_log_1.default.warn('[Control] 读取 config.json 失败:', err.message);
        }
    }
    electron_log_1.default.info('[Control] 未配置服务器地址，交由前端自动发现后端');
    return null;
}
function createWindow(serverURL) {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        backgroundColor: '#1e293b',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });
    electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
    electron_1.ipcMain.handle('maximize-window', async () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('close-window', () => mainWindow?.close());
    electron_1.ipcMain.handle('is-maximized', () => mainWindow?.isMaximized());
    electron_1.ipcMain.handle('get-stats', () => ({}));
    mainWindow.on('maximize', () => mainWindow?.webContents.send('maximize-change', true));
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('maximize-change', false));
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.setTitle('Axi Docs Control');
        electron_log_1.default.info('[Control] 窗口已显示');
    });
    const isDev = !electron_1.app.isPackaged;
    const DEV_SERVER = 'http://localhost:3000';
    if (isDev) {
        const url = new URL(DEV_SERVER);
        url.searchParams.set('mode', 'control');
        if (serverURL) {
            url.searchParams.set('api_url', serverURL);
        }
        mainWindow.loadURL(url.toString());
    }
    else {
        const buildPath = path.join(getResourcesPath(), 'webapp');
        const indexPath = path.join(buildPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            const normalizedBuildPath = buildPath.replace(/\\/g, '/');
            const query = new URLSearchParams({ mode: 'control' });
            if (serverURL) {
                query.set('api_url', serverURL);
            }
            mainWindow.loadURL(`file://${normalizedBuildPath}/index.html?${query.toString()}`);
        }
        else {
            electron_log_1.default.error('[Control] 未找到 index.html:', indexPath);
        }
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    electron_log_1.default.info('[Control] Electron 就绪');
    const serverURL = getServerURL();
    createWindow(serverURL);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow(serverURL);
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
