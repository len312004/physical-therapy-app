import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  const startUrl = isDev
    ? 'http://localhost:5173' // Vite dev server
    : `file://${path.join(__dirname, '../dist/index.html')}`; // Production build

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle print preview
  ipcMain.handle('print-document', async () => {
    if (!mainWindow) return;

    const printOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margin: {
        marginType: 'default',
      },
      pageSize: 'A4',
    };

    try {
      await mainWindow.webContents.print(printOptions);
      return { success: true };
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, error: String(error) };
    }
  });

  // Handle PDF export
  ipcMain.handle('export-pdf', async () => {
    if (!mainWindow) return { success: false };

    try {
      const pdfData = await mainWindow.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
      });

      const pdfPath = path.join(app.getPath('documents'), `PT-Report-${Date.now()}.pdf`);
      require('fs').writeFileSync(pdfPath, pdfData);

      return { success: true, path: pdfPath };
    } catch (error) {
      console.error('PDF export error:', error);
      return { success: false, error: String(error) };
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Create application menu
const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
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

Menu.setApplicationMenu(menu);

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});