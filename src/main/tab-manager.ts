import { BrowserWindow } from "electron";
import type { PickMode, TabState } from "../shared/types.js";

let tabCounter = 0;

interface ManagedTab {
  tabId: string;
  url: string;
  title: string | null;
  active: boolean;
}

export class TabManager {
  private tabs: Map<string, ManagedTab> = new Map();
  private order: string[] = [];
  private _activeTabId: string | null = null;
  private _pickMode: PickMode = "off";
  private mainWindow: BrowserWindow | null = null;

  setWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  get window() {
    return this.mainWindow;
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
    const tab: ManagedTab = {
      tabId,
      url: url ?? "about:blank",
      title: null,
      active: false,
    };
    this.tabs.set(tabId, tab);
    this.order.push(tabId);
    if (this._activeTabId === null) this.switchTab(tabId);
    return this.toTabState(tab);
  }

  switchTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    for (const t of this.tabs.values()) t.active = false;
    tab.active = true;
    this._activeTabId = tabId;
  }

  closeTab(tabId: string) {
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
    return this.order.map((id) => this.toTabState(this.tabs.get(id)!));
  }

  updateTabUrl(tabId: string, url: string) {
    const tab = this.tabs.get(tabId);
    if (tab) tab.url = url;
  }

  updateTabTitle(tabId: string, title: string) {
    const tab = this.tabs.get(tabId);
    if (tab) tab.title = title;
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
