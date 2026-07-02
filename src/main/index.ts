import { app, BrowserWindow, ipcMain, session } from "electron";
import * as path from "path";
import { startMcpServer } from "./mcp-server.js";
import { TabManager } from "./tab-manager.js";
import { IPC } from "../shared/channels.js";
import type { PickedElement, Annotation, PickMode } from "../shared/types.js";

let mainWindow: BrowserWindow | null = null;
const tabManager = new TabManager();
const pickQueue: Array<PickedElement | Annotation> = [];
const resourceUpdateCallbacks: Array<() => void> = [];

function emitResourceUpdate() {
  for (const cb of resourceUpdateCallbacks) {
    try { cb(); } catch { /* ignore */ }
  }
}

// Send an IPC message to the renderer and wait for a response via a one-shot handler.
function sendToRenderer<T>(channel: string, responseChannel: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve) => {
    if (!mainWindow) return resolve(null as T);
    ipcMain.handleOnce(responseChannel, (_e: Electron.IpcMainInvokeEvent, result: T) => {
      resolve(result);
      return undefined;
    });
    mainWindow.webContents.send(channel, ...args);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "renderer", "src", "renderer", "index.html"));
  }
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ---- IPC: Renderer -> Main ----
ipcMain.handle(IPC.TAB_NEW, async (_event, url?: string) => tabManager.createTab(url ?? null));
ipcMain.handle(IPC.TAB_CLOSE, async (_event, tabId: string) => { tabManager.closeTab(tabId); return { ok: true }; });
ipcMain.handle(IPC.TAB_SWITCH, async (_event, tabId: string) => { tabManager.switchTab(tabId); return { ok: true }; });
ipcMain.handle(IPC.TAB_LIST, async () => tabManager.listTabs());
ipcMain.handle(IPC.TAB_NAVIGATE, async (_event, tabId: string, url: string) => { tabManager.updateTabUrl(tabId, url); return { ok: true }; });
ipcMain.handle(IPC.TAB_BACK, async (_event, tabId: string) => { return { ok: true }; });
ipcMain.handle(IPC.TAB_FORWARD, async (_event, tabId: string) => { return { ok: true }; });
ipcMain.handle(IPC.TAB_RELOAD, async (_event, tabId: string) => { return { ok: true }; });
ipcMain.handle(IPC.PICK_MODE, async (_event, mode: PickMode) => { tabManager.setPickMode(mode); emitResourceUpdate(); return { ok: true }; });
ipcMain.handle(IPC.PICK_RESULT, async (_event, payload: PickedElement) => { pickQueue.push(payload); emitResourceUpdate(); return { ok: true }; });
ipcMain.handle(IPC.ANNOTATION_SUBMIT, async (_event, payload: Annotation) => { pickQueue.push(payload); emitResourceUpdate(); return { ok: true }; });

// Renderer updates tab state (from webview events)
ipcMain.handle("browser:tab-url-update", async (_event, tabId: string, url: string) => {
  tabManager.updateTabUrl(tabId, url);
  return { ok: true };
});
ipcMain.handle("browser:tab-title-update", async (_event, tabId: string, title: string) => {
  tabManager.updateTabTitle(tabId, title);
  return { ok: true };
});

// ---- IPC: Main -> Renderer (for MCP tools) ----

export function ensureWindow() {
  if (mainWindow === null) createWindow();
  return mainWindow;
}

export function getMainWindow() { return mainWindow; }
export function getTabManager() { return tabManager; }
export function getPickQueue() { return pickQueue; }
export function drainPickQueue() { const items = pickQueue.splice(0, pickQueue.length); return items; }
export function onResourceUpdate(cb: () => void) {
  resourceUpdateCallbacks.push(cb);
  return () => { const i = resourceUpdateCallbacks.indexOf(cb); if (i >= 0) resourceUpdateCallbacks.splice(i, 1); };
}
export function getBrowserState() {
  return { tabs: tabManager.listTabs(), activeTabId: tabManager.activeTabId, pickMode: tabManager.pickMode };
}
// Forward actions from MCP tools to the renderer's webviews
export function executeOnRenderer(script: string): Promise<unknown> {
  return sendToRenderer<unknown>("browser:do-execute", "browser:execute-response", script);
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((_details, callback) => callback({}));
  createWindow();
  startMcpServer();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (mainWindow === null) createWindow(); });
