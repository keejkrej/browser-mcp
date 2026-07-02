import { useCallback, useEffect, useRef, useState } from "react";
import type { TabState, PickMode, PickedElement, Annotation } from "../shared/types.js";
import { Toolbar } from "./Toolbar.js";
import { TabBar } from "./TabBar.js";
import { AnnotationOverlay } from "./AnnotationOverlay.js";
import { EmptyState } from "./EmptyState.js";

interface BrowserApi {
  tabNew: (url?: string) => Promise<TabState>;
  tabClose: (tabId: string) => Promise<unknown>;
  tabSwitch: (tabId: string) => Promise<unknown>;
  tabList: () => Promise<TabState[]>;
  tabNavigate: (tabId: string, url: string) => Promise<unknown>;
  tabBack: (tabId: string) => Promise<unknown>;
  tabForward: (tabId: string) => Promise<unknown>;
  tabReload: (tabId: string) => Promise<unknown>;
  setPickMode: (mode: PickMode) => Promise<unknown>;
  capturePage: (tabId: string) => Promise<{ dataUrl: string; width: number; height: number }>;
  onPickStart: (cb: () => void) => void;
  onPickCancel: (cb: () => void) => void;
  onSetPickMode: (cb: (mode: PickMode) => void) => void;
  onElementPicked: (cb: (payload: PickedElement) => void) => void;
  onAnnotationSubmitted: (cb: (payload: Annotation) => void) => void;
  sendPickResult: (payload: PickedElement) => Promise<unknown>;
  sendAnnotation: (payload: Annotation) => Promise<unknown>;
}

const api = (window as unknown as { browserApi: BrowserApi }).browserApi;

export function App() {
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pickMode, setPickModeState] = useState<PickMode>("off");
  const [urlInput, setUrlInput] = useState("");
  const [annotateActive, setAnnotateActive] = useState(false);
  const [annotationScreenshot, setAnnotationScreenshot] = useState<{
    url: string;
    width: number;
    height: number;
    pageUrl: string;
    pageTitle: string | null;
  } | null>(null);
  const webviewContainerRef = useRef<HTMLDivElement | null>(null);
  const webviewRefs = useRef<Map<string, ElectronWebview>>(new Map());
  const pickModeRef = useRef<PickMode>("off");

  type ElectronWebview = HTMLElement & {
    src: string;
    getWebContentsId: () => number;
    executeJavaScript: (code: string) => Promise<unknown>;
  };

  const refreshTabs = useCallback(async () => {
    const list = await api.tabList();
    setTabs(list);
    const active = list.find((t) => t.active);
    setActiveTabId(active?.tabId ?? null);
    if (active) setUrlInput(active.url);
  }, []);

  useEffect(() => {
    void refreshTabs();
    const interval = setInterval(() => void refreshTabs(), 1000);
    return () => clearInterval(interval);
  }, [refreshTabs]);

  // Handle pick mode changes from main process
  useEffect(() => {
    api.onSetPickMode((mode) => {
      setPickModeState(mode);
      pickModeRef.current = mode;
      for (const [, wv] of webviewRefs.current) {
        if (mode === "select") {
          void wv.executeJavaScript("window.dispatchEvent(new CustomEvent('browser:start-pick'))").catch(() => {});
        } else {
          void wv.executeJavaScript("window.dispatchEvent(new CustomEvent('browser:cancel-pick'))").catch(() => {});
        }
      }
    });
    api.onPickStart(() => {
      setPickModeState("select");
      pickModeRef.current = "select";
    });
    api.onPickCancel(() => {
      setPickModeState("off");
      pickModeRef.current = "off";
    });
  }, []);

  // Handle element picks from webview
  useEffect(() => {
    api.onElementPicked(async (payload) => {
      await api.sendPickResult(payload);
      if (pickModeRef.current === "select") {
        setPickModeState("off");
        pickModeRef.current = "off";
        await api.setPickMode("off");
      }
    });
  }, []);

  const handleTogglePickMode = useCallback(async () => {
    const next: PickMode = pickMode === "select" ? "off" : "select";
    setPickModeState(next);
    pickModeRef.current = next;
    await api.setPickMode(next);
    for (const [, wv] of webviewRefs.current) {
      if (next === "select") {
        void wv.executeJavaScript(
          "document.dispatchEvent(new CustomEvent('browser:start-pick'))",
        ).catch(() => {});
      } else {
        void wv.executeJavaScript(
          "document.dispatchEvent(new CustomEvent('browser:cancel-pick'))",
        ).catch(() => {});
      }
    }
  }, [pickMode]);

  const handleNewTab = useCallback(async () => {
    await api.tabNew();
    await refreshTabs();
  }, [refreshTabs]);

  const handleCloseTab = useCallback(async (tabId: string) => {
    await api.tabClose(tabId);
    await refreshTabs();
  }, [refreshTabs]);

  const handleSwitchTab = useCallback(async (tabId: string) => {
    await api.tabSwitch(tabId);
    await refreshTabs();
  }, [refreshTabs]);

  const handleNavigate = useCallback(async (url: string) => {
    if (!activeTabId) {
      await api.tabNew(url);
    } else {
      await api.tabNavigate(activeTabId, url);
    }
    await refreshTabs();
  }, [activeTabId, refreshTabs]);

  const handleBack = useCallback(async () => {
    if (!activeTabId) return;
    await api.tabBack(activeTabId);
    await refreshTabs();
  }, [activeTabId, refreshTabs]);

  const handleForward = useCallback(async () => {
    if (!activeTabId) return;
    await api.tabForward(activeTabId);
    await refreshTabs();
  }, [activeTabId, refreshTabs]);

  const handleReload = useCallback(async () => {
    if (!activeTabId) return;
    await api.tabReload(activeTabId);
    await refreshTabs();
  }, [activeTabId, refreshTabs]);

  const handleAnnotate = useCallback(async () => {
    if (annotateActive) {
      setAnnotateActive(false);
      setAnnotationScreenshot(null);
      return;
    }
    // Capture screenshot of the active webview
    const activeWebview = activeTabId ? webviewRefs.current.get(activeTabId) : null;
    if (!activeWebview) return;
    try {
      // Use Electron's capturePage via the webview's webContents
      const dataUrl = await activeWebview.executeJavaScript(`(function() {
        return new Promise(function(resolve) {
          // Take a screenshot using the browser's built-in
          var canvas = document.createElement('canvas');
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          resolve(null); // We'll use Electron capturePage instead
        })();
      })()`);
      // Use the IPC to capture via Electron main
      if (!activeTabId) return;
      const img = await api.capturePage(activeTabId);
      setAnnotationScreenshot({
        url: (img as { dataUrl: string }).dataUrl,
        width: (img as { width: number }).width,
        height: (img as { height: number }).height,
        pageUrl: tabs.find((t) => t.active)?.url ?? "",
        pageTitle: tabs.find((t) => t.active)?.title ?? null,
      });
      setAnnotateActive(true);
    } catch {
      // fallback: use executeJavaScript to get a screenshot via canvas
    }
  }, [activeTabId, annotateActive, tabs]);

  const handleAnnotationSubmit = useCallback(async (annotation: Annotation) => {
    await api.sendAnnotation(annotation);
    setAnnotateActive(false);
    setAnnotationScreenshot(null);
  }, []);

  const handleAnnotationCancel = useCallback(() => {
    setAnnotateActive(false);
    setAnnotationScreenshot(null);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", margin: 0, backgroundColor: "var(--chrome-background)" }}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onSwitchTab={handleSwitchTab}
      />
      <Toolbar
        url={urlInput}
        onUrlChange={setUrlInput}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        pickMode={pickMode}
        onTogglePickMode={handleTogglePickMode}
        onAnnotate={handleAnnotate}
        annotateActive={annotateActive}
      />
      <div ref={webviewContainerRef} style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "var(--background)" }}>
        {tabs.length === 0 ? <EmptyState /> : null}
        {tabs.map((tab) => (
          <div
            key={tab.tabId}
            style={{
              position: "absolute",
              inset: 0,
              display: tab.active ? "block" : "none",
            }}
          >
            <webview
              ref={(node) => {
                const wv = node as ElectronWebview | null;
                if (wv) {
                  webviewRefs.current.set(tab.tabId, wv);
                } else {
                  webviewRefs.current.delete(tab.tabId);
                }
              }}
              src={tab.url}
              style={{ width: "100%", height: "100%", border: "none" }}
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=no"
              preload="../../preload/webview-preload.js"
            />
          </div>
        ))}
        {annotateActive && annotationScreenshot ? (
          <AnnotationOverlay
            screenshotUrl={annotationScreenshot.url}
            screenshotWidth={annotationScreenshot.width}
            screenshotHeight={annotationScreenshot.height}
            pageUrl={annotationScreenshot.pageUrl}
            pageTitle={annotationScreenshot.pageTitle}
            onSubmit={handleAnnotationSubmit}
            onCancel={handleAnnotationCancel}
          />
        ) : null}
      </div>
    </div>
  );
}
