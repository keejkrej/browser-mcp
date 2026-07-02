"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabManager = void 0;
const electron_1 = require("electron");
let tabCounter = 0;
class TabManager {
    tabs = new Map();
    order = [];
    _activeTabId = null;
    _pickMode = "off";
    parentWindow = null;
    setWindow(win) {
        this.parentWindow = win;
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
        const view = new electron_1.WebContentsView({
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
            if (tab)
                tab.url = u;
        });
        view.webContents.on("page-title-updated", (_e, t) => {
            const tab = this.tabs.get(tabId);
            if (tab)
                tab.title = t;
        });
        const managed = {
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
        const tab = this.tabs.get(tabId);
        if (!tab)
            return;
        tab.view.webContents.close();
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
        return this.order.map((id) => {
            const t = this.tabs.get(id);
            return this.toTabState(t);
        });
    }
    navigateTab(tabId, url) {
        const tab = this.tabs.get(tabId);
        if (!tab)
            return { ok: false, error: "Tab not found" };
        void tab.view.webContents.loadURL(url);
        return { ok: true };
    }
    goBack(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab)
            return { ok: false };
        tab.view.webContents.navigationHistory.goBack();
        return { ok: true };
    }
    goForward(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab)
            return { ok: false };
        tab.view.webContents.navigationHistory.goForward();
        return { ok: true };
    }
    reloadTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab)
            return { ok: false };
        tab.view.webContents.reload();
        return { ok: true };
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
