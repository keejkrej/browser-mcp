import { app, BrowserWindow, ipcMain, session } from "electron";
import * as path from "path";
import { startMcpServer } from "./mcp-server.js";
import { TabManager } from "./tab-manager.js";
import { IPC } from "../shared/channels.js";
import type { PickedElement, Annotation, PickMode, TabState } from "../shared/types.js";

let mainWindow: BrowserWindow | null = null;
const tabManager = new TabManager();
const pickQueue: Array<PickedElement | Annotation> = [];
const resourceUpdateCallbacks: Array<() => void> = [];

function emitResourceUpdate() {
  for (const cb of resourceUpdateCallbacks) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
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

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "renderer", "src", "renderer", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers: renderer -> main
ipcMain.handle(IPC.TAB_NEW, async (_event, url?: string) => {
  return tabManager.createTab(url ?? null);
});

ipcMain.handle(IPC.TAB_CLOSE, async (_event, tabId: string) => {
  tabManager.closeTab(tabId);
  return { ok: true };
});

ipcMain.handle(IPC.TAB_SWITCH, async (_event, tabId: string) => {
  tabManager.switchTab(tabId);
  return { ok: true };
});

ipcMain.handle(IPC.TAB_LIST, async () => {
  return tabManager.listTabs();
});

ipcMain.handle(IPC.TAB_NAVIGATE, async (_event, tabId: string, url: string) => {
  return tabManager.navigateTab(tabId, url);
});

ipcMain.handle(IPC.TAB_BACK, async (_event, tabId: string) => {
  return tabManager.goBack(tabId);
});

ipcMain.handle(IPC.TAB_FORWARD, async (_event, tabId: string) => {
  return tabManager.goForward(tabId);
});

ipcMain.handle(IPC.TAB_RELOAD, async (_event, tabId: string) => {
  return tabManager.reloadTab(tabId);
});

ipcMain.handle(IPC.CAPTURE_PAGE, async (_event, tabId: string) => {
  const tab = tabManager.getTab(tabId);
  if (!tab) return { dataUrl: "", width: 0, height: 0 };
  const img = await tab.view.webContents.capturePage();
  return {
    dataUrl: img.toDataURL(),
    width: img.getSize().width,
    height: img.getSize().height,
  };
});

ipcMain.handle(IPC.PICK_MODE, async (_event, mode: PickMode) => {
  tabManager.setPickMode(mode);
  emitResourceUpdate();
  return { ok: true };
});

ipcMain.handle(IPC.PICK_RESULT, async (_event, payload: PickedElement) => {
  pickQueue.push(payload);
  emitResourceUpdate();
  return { ok: true };
});

ipcMain.handle(IPC.ANNOTATION_SUBMIT, async (_event, payload: Annotation) => {
  pickQueue.push(payload);
  emitResourceUpdate();
  return { ok: true };
});

// Expose for MCP server to use
export function getMainWindow() {
  return mainWindow;
}

export function getTabManager() {
  return tabManager;
}

export function getPickQueue() {
  return pickQueue;
}

export function drainPickQueue() {
  const items = pickQueue.splice(0, pickQueue.length);
  return items;
}

export function onResourceUpdate(cb: () => void) {
  resourceUpdateCallbacks.push(cb);
  return () => {
    const idx = resourceUpdateCallbacks.indexOf(cb);
    if (idx >= 0) resourceUpdateCallbacks.splice(idx, 1);
  };
}

export function getBrowserState() {
  return {
    tabs: tabManager.listTabs(),
    activeTabId: tabManager.activeTabId,
    pickMode: tabManager.pickMode,
  };
}

app.whenReady().then(() => {
  // Set up webview security: allow preload, enable devtools
  session.defaultSession.webRequest.onBeforeRequest((_details, callback) => {
    callback({});
  });

  createWindow();
  startMcpServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
