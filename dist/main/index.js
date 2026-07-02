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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainWindow = getMainWindow;
exports.getTabManager = getTabManager;
exports.getPickQueue = getPickQueue;
exports.drainPickQueue = drainPickQueue;
exports.onResourceUpdate = onResourceUpdate;
exports.getBrowserState = getBrowserState;
exports.executeOnRenderer = executeOnRenderer;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const mcp_server_js_1 = require("./mcp-server.js");
const tab_manager_js_1 = require("./tab-manager.js");
const channels_js_1 = require("../shared/channels.js");
let mainWindow = null;
const tabManager = new tab_manager_js_1.TabManager();
const pickQueue = [];
const resourceUpdateCallbacks = [];
function emitResourceUpdate() {
    for (const cb of resourceUpdateCallbacks) {
        try {
            cb();
        }
        catch { /* ignore */ }
    }
}
// Send an IPC message to the renderer and wait for a response via a one-shot handler.
function sendToRenderer(channel, responseChannel, ...args) {
    return new Promise((resolve) => {
        if (!mainWindow)
            return resolve(null);
        electron_1.ipcMain.handleOnce(responseChannel, (_e, result) => {
            resolve(result);
            return undefined;
        });
        mainWindow.webContents.send(channel, ...args);
    });
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: "Browser MCP",
        webPreferences: {
            preload: path.join(__dirname, "..", "preload", "app-preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    tabManager.setWindow(mainWindow);
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl) {
        void mainWindow.loadURL(devUrl);
    }
    else {
        void mainWindow.loadFile(path.join(__dirname, "..", "renderer", "src", "renderer", "index.html"));
    }
    mainWindow.on("closed", () => { mainWindow = null; });
}
// ---- IPC: Renderer -> Main ----
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_NEW, async (_event, url) => tabManager.createTab(url ?? null));
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_CLOSE, async (_event, tabId) => { tabManager.closeTab(tabId); return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_SWITCH, async (_event, tabId) => { tabManager.switchTab(tabId); return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_LIST, async () => tabManager.listTabs());
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_NAVIGATE, async (_event, tabId, url) => { tabManager.updateTabUrl(tabId, url); return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_BACK, async (_event, tabId) => { return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_FORWARD, async (_event, tabId) => { return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.TAB_RELOAD, async (_event, tabId) => { return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.PICK_MODE, async (_event, mode) => { tabManager.setPickMode(mode); emitResourceUpdate(); return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.PICK_RESULT, async (_event, payload) => { pickQueue.push(payload); emitResourceUpdate(); return { ok: true }; });
electron_1.ipcMain.handle(channels_js_1.IPC.ANNOTATION_SUBMIT, async (_event, payload) => { pickQueue.push(payload); emitResourceUpdate(); return { ok: true }; });
// Renderer updates tab state (from webview events)
electron_1.ipcMain.handle("browser:tab-url-update", async (_event, tabId, url) => {
    tabManager.updateTabUrl(tabId, url);
    return { ok: true };
});
electron_1.ipcMain.handle("browser:tab-title-update", async (_event, tabId, title) => {
    tabManager.updateTabTitle(tabId, title);
    return { ok: true };
});
// ---- IPC: Main -> Renderer (for MCP tools) ----
function getMainWindow() { return mainWindow; }
function getTabManager() { return tabManager; }
function getPickQueue() { return pickQueue; }
function drainPickQueue() { const items = pickQueue.splice(0, pickQueue.length); return items; }
function onResourceUpdate(cb) {
    resourceUpdateCallbacks.push(cb);
    return () => { const i = resourceUpdateCallbacks.indexOf(cb); if (i >= 0)
        resourceUpdateCallbacks.splice(i, 1); };
}
function getBrowserState() {
    return { tabs: tabManager.listTabs(), activeTabId: tabManager.activeTabId, pickMode: tabManager.pickMode };
}
// Forward actions from MCP tools to the renderer's webviews
function executeOnRenderer(script) {
    return sendToRenderer("browser:do-execute", "browser:execute-response", script);
}
electron_1.app.whenReady().then(() => {
    electron_1.session.defaultSession.webRequest.onBeforeRequest((_details, callback) => callback({}));
    createWindow();
    (0, mcp_server_js_1.startMcpServer)();
});
electron_1.app.on("window-all-closed", () => { if (process.platform !== "darwin")
    electron_1.app.quit(); });
electron_1.app.on("activate", () => { if (mainWindow === null)
    createWindow(); });
