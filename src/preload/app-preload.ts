import { contextBridge, ipcRenderer } from "electron";

// Inline IPC channel constants to avoid require() issues in sandboxed preload
const IPC = {
  TAB_NEW: "browser:tab-new",
  TAB_CLOSE: "browser:tab-close",
  TAB_SWITCH: "browser:tab-switch",
  TAB_LIST: "browser:tab-list",
  TAB_NAVIGATE: "browser:tab-navigate",
  TAB_BACK: "browser:tab-back",
  TAB_FORWARD: "browser:tab-forward",
  TAB_RELOAD: "browser:tab-reload",
  PICK_MODE: "browser:pick-mode",
  PICK_RESULT: "browser:pick-result",
  ANNOTATION_SUBMIT: "browser:annotation-submit",
  CAPTURE_PAGE: "browser:capture-page",
  PICK_START: "browser:pick-start",
  PICK_CANCEL: "browser:pick-cancel",
  SET_PICK_MODE: "browser:set-pick-mode",
  DO_NAVIGATE: "browser:do-navigate",
  DO_BACK: "browser:do-back",
  DO_FORWARD: "browser:do-forward",
  DO_RELOAD: "browser:do-reload",
  DO_TAB_NEW: "browser:do-tab-new",
  DO_TAB_SWITCH: "browser:do-tab-switch",
  DO_TAB_CLOSE: "browser:do-tab-close",
} as const;

export interface ApiBridge {
  tabNew: (url?: string) => Promise<unknown>;
  tabClose: (tabId: string) => Promise<unknown>;
  tabSwitch: (tabId: string) => Promise<unknown>;
  tabList: () => Promise<unknown>;
  tabNavigate: (tabId: string, url: string) => Promise<unknown>;
  tabBack: (tabId: string) => Promise<unknown>;
  tabForward: (tabId: string) => Promise<unknown>;
  tabReload: (tabId: string) => Promise<unknown>;
  setPickMode: (mode: "select" | "annotate" | "off") => Promise<unknown>;
  capturePage: (tabId: string) => Promise<{ dataUrl: string; width: number; height: number }>;
  updateTabUrl: (tabId: string, url: string) => Promise<unknown>;
  updateTabTitle: (tabId: string, title: string) => Promise<unknown>;
  onPickStart: (cb: () => void) => void;
  onPickCancel: (cb: () => void) => void;
  onSetPickMode: (cb: (mode: "select" | "annotate" | "off") => void) => void;
  onDoNavigate: (cb: (tabId: string, url: string) => void) => void;
  onDoBack: (cb: (tabId: string) => void) => void;
  onDoForward: (cb: (tabId: string) => void) => void;
  onDoReload: (cb: (tabId: string) => void) => void;
  onDoTabNew: (cb: (url?: string) => void) => void;
  onDoTabSwitch: (cb: (tabId: string) => void) => void;
  onDoTabClose: (cb: (tabId: string) => void) => void;
  onDoCapture: (cb: (tabId: string) => void) => void;
  onDoExecute: (cb: (script: string) => void) => void;
  sendCaptureResponse: (data: unknown) => void;
  sendExecuteResponse: (data: unknown) => void;
  onElementPicked: (cb: (payload: unknown) => void) => void;
  onAnnotationSubmitted: (cb: (payload: unknown) => void) => void;
  sendPickResult: (payload: unknown) => Promise<unknown>;
  sendAnnotation: (payload: unknown) => Promise<unknown>;
}

const api: ApiBridge = {
  tabNew: (url?: string) => ipcRenderer.invoke(IPC.TAB_NEW, url),
  tabClose: (tabId: string) => ipcRenderer.invoke(IPC.TAB_CLOSE, tabId),
  tabSwitch: (tabId: string) => ipcRenderer.invoke(IPC.TAB_SWITCH, tabId),
  tabList: () => ipcRenderer.invoke(IPC.TAB_LIST),
  tabNavigate: (tabId: string, url: string) => ipcRenderer.invoke(IPC.TAB_NAVIGATE, tabId, url),
  tabBack: (tabId: string) => ipcRenderer.invoke(IPC.TAB_BACK, tabId),
  tabForward: (tabId: string) => ipcRenderer.invoke(IPC.TAB_FORWARD, tabId),
  tabReload: (tabId: string) => ipcRenderer.invoke(IPC.TAB_RELOAD, tabId),
  setPickMode: (mode) => ipcRenderer.invoke(IPC.PICK_MODE, mode),
  capturePage: (tabId: string) => ipcRenderer.invoke(IPC.CAPTURE_PAGE, tabId),
  updateTabUrl: (tabId: string, url: string) => ipcRenderer.invoke("browser:tab-url-update", tabId, url),
  updateTabTitle: (tabId: string, title: string) => ipcRenderer.invoke("browser:tab-title-update", tabId, title),
  onPickStart: (cb) => ipcRenderer.on(IPC.PICK_START, () => cb()),
  onPickCancel: (cb) => ipcRenderer.on(IPC.PICK_CANCEL, () => cb()),
  onSetPickMode: (cb) => ipcRenderer.on(IPC.SET_PICK_MODE, (_e, mode) => cb(mode)),
  onDoNavigate: (cb) => ipcRenderer.on(IPC.DO_NAVIGATE, (_e, tabId, url) => cb(tabId, url)),
  onDoBack: (cb) => ipcRenderer.on(IPC.DO_BACK, (_e, tabId) => cb(tabId)),
  onDoForward: (cb) => ipcRenderer.on(IPC.DO_FORWARD, (_e, tabId) => cb(tabId)),
  onDoReload: (cb) => ipcRenderer.on(IPC.DO_RELOAD, (_e, tabId) => cb(tabId)),
  onDoTabNew: (cb) => ipcRenderer.on(IPC.DO_TAB_NEW, (_e, url) => cb(url)),
  onDoTabSwitch: (cb) => ipcRenderer.on(IPC.DO_TAB_SWITCH, (_e, tabId) => cb(tabId)),
  onDoTabClose: (cb) => ipcRenderer.on(IPC.DO_TAB_CLOSE, (_e, tabId) => cb(tabId)),
  onDoCapture: (cb) => ipcRenderer.on("browser:do-capture", (_e, tabId) => cb(tabId)),
  onDoExecute: (cb) => ipcRenderer.on("browser:do-execute", (_e, script) => cb(script)),
  sendCaptureResponse: (data) => ipcRenderer.send("browser:capture-response", data),
  sendExecuteResponse: (data) => ipcRenderer.send("browser:execute-response", data),
  onElementPicked: (cb) => ipcRenderer.on("browser:element-picked", (_e, payload) => cb(payload)),
  onAnnotationSubmitted: (cb) => ipcRenderer.on("browser:annotation-submitted", (_e, payload) => cb(payload)),
  sendPickResult: (payload) => ipcRenderer.invoke(IPC.PICK_RESULT, payload),
  sendAnnotation: (payload) => ipcRenderer.invoke(IPC.ANNOTATION_SUBMIT, payload),
};

contextBridge.exposeInMainWorld("browserApi", api);
