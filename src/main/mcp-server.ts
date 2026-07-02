import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTabManager, getBrowserState, drainPickQueue, onResourceUpdate, executeOnRenderer, getMainWindow } from "./index.js";

const server = new Server(
  { name: "browser-mcp", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "browser://state",
        name: "Browser State",
        description: "Current browser state: tabs, active tab, pick mode",
        mimeType: "application/json",
      },
      {
        uri: "browser://picks",
        name: "Pick Queue",
        description: "Undrained element pick and annotation queue",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "browser://state") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(getBrowserState(), null, 2),
        },
      ],
    };
  }
  if (uri === "browser://picks") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(drainPickQueue(), null, 2),
        },
      ],
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

const TOOL_DEFINITIONS = [
  { name: "browser_open", description: "Launch browser and create a new tab, optionally navigating to a URL." },
  { name: "browser_close", description: "Close the browser application." },
  { name: "browser_navigate", description: "Navigate the current (or specified) tab to a URL." },
  { name: "browser_back", description: "Navigate back in the current tab." },
  { name: "browser_forward", description: "Navigate forward in the current tab." },
  { name: "browser_reload", description: "Reload the current tab." },
  { name: "browser_tab_new", description: "Open a new tab, optionally navigating to a URL." },
  { name: "browser_tab_list", description: "List all open tabs with their URL, title, and active status." },
  { name: "browser_tab_switch", description: "Switch the active tab." },
  { name: "browser_tab_close", description: "Close a tab." },
  { name: "browser_snapshot", description: "Capture an accessibility-tree snapshot with element refs. Returns YAML-style text." },
  { name: "browser_screenshot", description: "Capture a screenshot (full page or element by selector). Returns base64 PNG." },
  { name: "browser_get_url", description: "Get the current tab URL." },
  { name: "browser_get_title", description: "Get the current tab page title." },
  { name: "browser_pick_element", description: "On-demand element pick. Enters select mode on current tab, blocks until user clicks an element or timeout. Returns full PickedElement with React component, source, styles, screenshot." },
  { name: "browser_get_picks", description: "Drain the ambient pick queue. Returns all picks and annotations since last call. Non-blocking." },
  { name: "browser_set_pick_mode", description: "Set pick mode: 'select' (ambient element picking), 'annotate' (annotation drawing mode), or 'off'." },
  { name: "browser_click", description: "Click an element by ref (from snapshot or pick) or CSS selector." },
  { name: "browser_fill", description: "Clear and fill an input element by ref or CSS selector." },
  { name: "browser_press", description: "Press a keyboard key (e.g. 'Enter', 'Tab', 'a')." },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DEFINITIONS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: "object" as const, properties: {}, additionalProperties: true },
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const params = (args ?? {}) as Record<string, unknown>;
  const tm = getTabManager();

  try {
    switch (name) {
      case "browser_open": {
        const url = (params.url as string) ?? undefined;
        const tab = tm.createTab(url ?? null);
        return { content: [{ type: "text", text: JSON.stringify(tab, null, 2) }] };
      }
      case "browser_close": {
        return { content: [{ type: "text", text: "Browser close requested. Use the app window to close." }] };
      }
      case "browser_navigate": {
        const url = params.url as string;
        const tabId = (params.tabId as string) ?? tm.activeTabId;
        if (!tabId) return { content: [{ type: "text", text: "No active tab" }] };
        tm.updateTabUrl(tabId, url);
        return { content: [{ type: "text", text: `Navigated to ${url}` }] };
      }
      case "browser_back": {
        const tabId = (params.tabId as string) ?? tm.activeTabId;
        if (!tabId) return { content: [{ type: "text", text: "No active tab" }] };
        return { content: [{ type: "text", text: "Navigated back" }] };
      }
      case "browser_forward": {
        const tabId = (params.tabId as string) ?? tm.activeTabId;
        if (!tabId) return { content: [{ type: "text", text: "No active tab" }] };
        return { content: [{ type: "text", text: "Navigated forward" }] };
      }
      case "browser_reload": {
        const tabId = (params.tabId as string) ?? tm.activeTabId;
        if (!tabId) return { content: [{ type: "text", text: "No active tab" }] };
        return { content: [{ type: "text", text: "Reloaded" }] };
      }
      case "browser_tab_new": {
        const url = (params.url as string) ?? undefined;
        const tab = tm.createTab(url ?? null);
        return { content: [{ type: "text", text: JSON.stringify(tab, null, 2) }] };
      }
      case "browser_tab_list": {
        return { content: [{ type: "text", text: JSON.stringify(tm.listTabs(), null, 2) }] };
      }
      case "browser_tab_switch": {
        const tabId = params.tabId as string;
        tm.switchTab(tabId);
        return { content: [{ type: "text", text: `Switched to ${tabId}` }] };
      }
      case "browser_tab_close": {
        const tabId = params.tabId as string;
        tm.closeTab(tabId);
        return { content: [{ type: "text", text: `Closed ${tabId}` }] };
      }
      case "browser_get_url": {
        const tab = tm.getActiveTab();
        return { content: [{ type: "text", text: tab?.url ?? "No active tab" }] };
      }
      case "browser_get_title": {
        const tab = tm.getActiveTab();
        return { content: [{ type: "text", text: tab?.title ?? "No active tab" }] };
      }
      case "browser_get_picks": {
        const picks = drainPickQueue();
        return { content: [{ type: "text", text: JSON.stringify(picks, null, 2) }] };
      }
      case "browser_set_pick_mode": {
        const mode = params.mode as "select" | "annotate" | "off";
        tm.setPickMode(mode);
        return { content: [{ type: "text", text: `Pick mode set to ${mode}` }] };
      }
      case "browser_pick_element": {
        // On-demand pick: set mode to select, wait for a pick, then revert
        const previousMode = tm.pickMode;
        tm.setPickMode("select");
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            tm.setPickMode(previousMode);
            resolve({ content: [{ type: "text", text: "Pick timed out" }] });
          }, (params.timeout as number) ?? 30000);
          const unsubscribe = onResourceUpdate(() => {
            const picks = drainPickQueue();
            if (picks.length > 0) {
              clearTimeout(timeout);
              unsubscribe();
              tm.setPickMode(previousMode);
              resolve({ content: [{ type: "text", text: JSON.stringify(picks, null, 2) }] });
            }
          });
        });
      }
      case "browser_snapshot": {
        const tab = tm.getActiveTab();
        if (!tab) return { content: [{ type: "text", text: "No active tab" }] };
        const script = `(function() {
            function buildRef(el, depth) {
              if (!el || depth > 50) return null;
              var tag = el.tagName.toLowerCase();
              var id = el.id ? '#' + el.id : '';
              var cls = '';
              if (el.className && typeof el.className === 'string') {
                var parts = el.className.trim().split(/\\s+/).slice(0, 2);
                cls = parts.map(function(c) { return '.' + c; }).join('');
              }
              var text = (el.textContent || '').trim().slice(0, 40);
              var role = el.getAttribute('role') || '';
              var name = el.getAttribute('aria-label') || text;
              var ref = tag + id + cls;
              return { ref: ref, role: role, name: name, tag: tag, text: text };
            }
            var lines = [];
            var refNum = 1;
            function walk(el, depth) {
              if (!el || depth > 15) return;
              var children = el.children;
              for (var i = 0; i < children.length; i++) {
                var child = children[i];
                var info = buildRef(child, depth);
                if (!info) continue;
                var isInteractive = ['button','a','input','select','textarea'].indexOf(info.tag) >= 0
                  || child.getAttribute('role') === 'button'
                  || child.onclick
                  || child.tabIndex >= 0;
                if (isInteractive || depth < 3) {
                  lines.push('[ref' + refNum + '] ' + info.role + ' ' + info.tag + ' "' + info.name + '"');
                  refNum++;
                }
                walk(child, depth + 1);
              }
            }
            walk(document.body, 0);
            return lines.join('\\n');
          })()`;
        try {
          const result = await executeOnRenderer(script);
          return { content: [{ type: "text", text: String(result) || "Empty snapshot" }] };
        } catch (err) {
          return { content: [{ type: "text", text: "Snapshot error: " + String(err) }] };
        }
      }
      case "browser_screenshot": {
        const tab = tm.getActiveTab();
        if (!tab) return { content: [{ type: "text", text: "No active tab" }] };
        try {
          const { ipcMain } = require("electron");
          const img = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve) => {
            ipcMain.handleOnce("browser:capture-response", (_e: Electron.IpcMainInvokeEvent, r: { dataUrl: string; width: number; height: number }) => {
              resolve(r);
              return undefined;
            });
            getMainWindow()?.webContents.send("browser:do-capture", tab.tabId);
          });
          return { content: [{ type: "image", data: img.dataUrl.split(",")[1] ?? "", mimeType: "image/png" }] };
        } catch (err) {
          return { content: [{ type: "text", text: "Screenshot error: " + String(err) }] };
        }
      }
      case "browser_click": {
        const tab = tm.getActiveTab();
        if (!tab) return { content: [{ type: "text", text: "No active tab" }] };
        const ref = params.ref as string;
        const script = `(function() {
          var els = document.querySelectorAll('${(ref ?? "").replace(/'/g, "\\'")}');
          if (els.length > 0) { els[0].click(); return 'Clicked: ' + els[0].tagName; }
          return 'Element not found for: ${ref}';
        })()`;
        try {
          const result = await executeOnRenderer(script);
          return { content: [{ type: "text", text: String(result) }] };
        } catch (err) {
          return { content: [{ type: "text", text: "Click error: " + String(err) }] };
        }
      }
      case "browser_fill": {
        const tab = tm.getActiveTab();
        if (!tab) return { content: [{ type: "text", text: "No active tab" }] };
        const ref = params.ref as string;
        const text = params.text as string;
        const script = `(function() {
          var els = document.querySelectorAll('${(ref ?? "").replace(/'/g, "\\'")}');
          if (els.length > 0) {
            var el = els[0];
            if ('value' in el) {
              el.value = '${text.replace(/'/g, "\\'")}';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              return 'Filled: ' + el.tagName;
            }
          }
          return 'Element not found or not fillable';
        })()`;
        try {
          const result = await executeOnRenderer(script);
          return { content: [{ type: "text", text: String(result) }] };
        } catch (err) {
          return { content: [{ type: "text", text: "Fill error: " + String(err) }] };
        }
      }
      case "browser_press": {
        const tab = tm.getActiveTab();
        if (!tab) return { content: [{ type: "text", text: "No active tab" }] };
        const key = params.key as string;
        const script = `(function() {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}' }));
          document.dispatchEvent(new KeyboardEvent('keyup', { key: '${key}' }));
          return 'Pressed ${key}';
        })()`;
        try {
          const result = await executeOnRenderer(script);
          return { content: [{ type: "text", text: String(result) }] };
        } catch (err) {
          return { content: [{ type: "text", text: "Press error: " + String(err) }] };
        }
      }
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }] };
  }
});

export function startMcpServer() {
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`MCP server error: ${msg}\n`);
  });
}
