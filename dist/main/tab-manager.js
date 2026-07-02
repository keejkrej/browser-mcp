"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabManager = void 0;
let tabCounter = 0;
class TabManager {
    tabs = new Map();
    order = [];
    _activeTabId = null;
    _pickMode = "off";
    mainWindow = null;
    setWindow(win) {
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
    setPickMode(mode) {
        this._pickMode = mode;
    }
    createTab(url) {
        const tabId = `tab_${++tabCounter}`;
        const tab = {
            tabId,
            url: url ?? "about:blank",
            title: null,
            active: false,
        };
        this.tabs.set(tabId, tab);
        this.order.push(tabId);
        if (this._activeTabId === null)
            this.switchTab(tabId);
        return this.toTabState(tab);
    }
    switchTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab)
            return;
        for (const t of this.tabs.values())
            t.active = false;
        tab.active = true;
        this._activeTabId = tabId;
    }
    closeTab(tabId) {
        this.tabs.delete(tabId);
        this.order = this.order.filter((id) => id !== tabId);
        if (this._activeTabId === tabId) {
            this._activeTabId = this.order[0] ?? null;
            if (this._activeTabId) {
                const next = this.tabs.get(this._activeTabId);
                if (next)
                    next.active = true;
            }
        }
    }
    listTabs() {
        return this.order.map((id) => this.toTabState(this.tabs.get(id)));
    }
    updateTabUrl(tabId, url) {
        const tab = this.tabs.get(tabId);
        if (tab)
            tab.url = url;
    }
    updateTabTitle(tabId, title) {
        const tab = this.tabs.get(tabId);
        if (tab)
            tab.title = title;
    }
    getTab(tabId) {
        return this.tabs.get(tabId) ?? null;
    }
    getActiveTab() {
        if (!this._activeTabId)
            return null;
        return this.tabs.get(this._activeTabId) ?? null;
    }
    toTabState(t) {
        return {
            tabId: t.tabId,
            url: t.url,
            title: t.title,
            active: t.active,
            loading: false,
        };
    }
}
exports.TabManager = TabManager;
