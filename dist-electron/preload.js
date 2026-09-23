"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a secure API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
});
//# sourceMappingURL=preload.js.map