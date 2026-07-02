import { BrowserView, BrowserWindow, WebContentsView } from "electron";
import type { PickMode, TabState } from "../shared/types.js";

let tabCounter = 0;

interface ManagedTab {
  tabId: string;
  view: WebContentsView | BrowserView;
  url: string;
  title: string | null;
  active: boolean;
}

export class TabManager {
  private tabs: Map<string, ManagedTab> = new Map();
  private order: string[] = [];
  private _activeTabId: string | null = null;
  private _pickMode: PickMode = "off";
  private parentWindow: BrowserWindow | null = null;

  setWindow(win: BrowserWindow) {
    this.parentWindow = win;
  }

  get activeTabId() {
    return this._activeTabId;
  }

  get pickMode() {
    return this._pickMode;
  }

  setPickMode(mode: PickMode) {
    this._pickMode = mode;
  }

  createTab(url: string | null): TabState {
    const tabId = `tab_${++tabCounter}`;
    const view = new WebContentsView({
      webPreferences: {
        preload: undefined,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    view.webContents.on("did-finish-load", () => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.title = view.webContents.getTitle();
        tab.url = view.webContents.getURL();
      }
    });

    view.webContents.on("did-navigate", (_e, u) => {
      const tab = this.tabs.get(tabId);
      if (tab) tab.url = u;
    });

    view.webContents.on("page-title-updated", (_e, t) => {
      const tab = this.tabs.get(tabId);
      if (tab) tab.title = t;
    });

    const managed: ManagedTab = {
      tabId,
      view,
      url: url ?? "about:blank",
      title: null,
      active: false,
    };
    this.tabs.set(tabId, managed);
    this.order.push(tabId);

    if (url) {
      void view.webContents.loadURL(url);
    }

    if (this._activeTabId === null) {
      this.switchTab(tabId);
    }

    return this.toTabState(managed);
  }

  switchTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    for (const t of this.tabs.values()) t.active = false;
    tab.active = true;
    this._activeTabId = tabId;
  }

  closeTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    (tab.view as WebContentsView).webContents.close();
    this.tabs.delete(tabId);
    this.order = this.order.filter((id) => id !== tabId);
    if (this._activeTabId === tabId) {
      this._activeTabId = this.order[0] ?? null;
      if (this._activeTabId) {
        const next = this.tabs.get(this._activeTabId);
        if (next) next.active = true;
      }
    }
  }

  listTabs(): TabState[] {
    return this.order.map((id) => {
      const t = this.tabs.get(id)!;
      return this.toTabState(t);
    });
  }

  navigateTab(tabId: string, url: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return { ok: false, error: "Tab not found" };
    void tab.view.webContents.loadURL(url);
    return { ok: true };
  }

  goBack(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return { ok: false };
    tab.view.webContents.navigationHistory.goBack();
    return { ok: true };
  }

  goForward(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return { ok: false };
    tab.view.webContents.navigationHistory.goForward();
    return { ok: true };
  }

  reloadTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return { ok: false };
    tab.view.webContents.reload();
    return { ok: true };
  }

  getTab(tabId: string) {
    return this.tabs.get(tabId) ?? null;
  }

  getActiveTab() {
    if (!this._activeTabId) return null;
    return this.tabs.get(this._activeTabId) ?? null;
  }

  private toTabState(t: ManagedTab): TabState {
    return {
      tabId: t.tabId,
      url: t.url,
      title: t.title,
      active: t.active,
      loading: false,
    };
  }
}
