"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
        icon: path_1.default.join(__dirname, '../public/icon.png'),
    });
    const startUrl = electron_is_dev_1.default
        ? 'http://localhost:5173' // Vite dev server
        : `file://${path_1.default.join(__dirname, '../dist/index.html')}`; // Production build
    mainWindow.loadURL(startUrl);
    if (electron_is_dev_1.default) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// Create application menu
const menu = electron_1.Menu.buildFromTemplate([
    {
        label: 'File',
        submenu: [
            {
                label: 'Exit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    electron_1.app.quit();
                },
            },
        ],
    },
    {
        label: 'Edit',
        submenu: [
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
            { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
            { type: 'separator' },
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        ],
    },
    {
        label: 'View',
        submenu: [
            {
                label: 'Reload',
                accelerator: 'CmdOrCtrl+R',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.reload();
                    }
                },
            },
            {
                label: 'Toggle Developer Tools',
                accelerator: 'F12',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
            },
        ],
    },
]);
electron_1.Menu.setApplicationMenu(menu);
// IPC handlers for any future electron features
electron_1.ipcMain.handle('get-app-version', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('get-app-path', () => {
    return electron_1.app.getAppPath();
});
//# sourceMappingURL=main.js.map