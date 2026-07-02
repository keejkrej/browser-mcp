import { ipcRenderer } from "electron";
import type { PickedElement, StackFrame, ElementRect, ElementA11y } from "../shared/types.js";

let pickActive = false;
let hoverOutline: HTMLDivElement | null = null;
let inspectPopup: HTMLDivElement | null = null;
const OVERLAY_ATTR = "data-browser-mcp-pick-ui";

function nextId(): string {
  return `pick_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rectFromDom(rect: DOMRect): ElementRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function buildSelector(el: Element): string | null {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const classes = el instanceof HTMLElement && typeof el.className === "string"
    ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map((c) => `.${c}`).join("")
    : "";
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
    if (siblings.length > 1) {
      const nth = siblings.indexOf(el) + 1;
      return `${tag}${classes}:nth-of-type(${nth})`;
    }
  }
  return `${tag}${classes}`;
}

function getHtmlPreview(el: Element): string {
  const html = el.outerHTML;
  return html.length > 500 ? html.slice(0, 500) + "..." : html;
}

function getAuthorStyles(el: Element): string {
  const computed = getComputedStyle(el);
  const props = [
    "color", "background-color", "font-size", "font-weight", "font-family",
    "line-height", "padding", "margin", "border", "border-radius",
    "display", "flex-direction", "align-items", "justify-content",
    "width", "height", "position", "z-index", "opacity", "overflow",
  ];
  return props
    .map((p) => `${p}: ${computed.getPropertyValue(p)}`)
    .join("; ");
}

function getA11y(el: Element): ElementA11y {
  const role = el.getAttribute("role");
  const ariaLabel = el.getAttribute("aria-label");
  const title = el.getAttribute("title");
  const textContent = (el.textContent || "").trim().slice(0, 100) || null;
  return {
    name: ariaLabel || title || textContent,
    role: role || (el.tagName.toLowerCase() === "a" ? "link" : null),
    keyboardFocusable: (el as HTMLElement).tabIndex >= 0,
  };
}

function getReactComponent(el: Element): { componentName: string | null; source: StackFrame | null; stack: StackFrame[] } {
  const fiberKey = Object.keys(el).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) return { componentName: null, source: null, stack: [] };

  let fiber = (el as unknown as Record<string, unknown>)[fiberKey] as Record<string, unknown> | undefined;
  const stack: StackFrame[] = [];
  let firstSource: StackFrame | null = null;
  let componentName: string | null = null;

  while (fiber) {
    const type = fiber.type as { displayName?: string; name?: string } | undefined;
    if (type && (type.displayName || type.name)) {
      const name = type.displayName || type.name;
      if (!componentName) componentName = name ?? null;
      const debugSource = fiber._debugSource as { fileName: string; lineNumber: number; columnNumber: number } | undefined;
      const frame: StackFrame = {
        functionName: name || null,
        fileName: debugSource?.fileName ?? null,
        lineNumber: debugSource?.lineNumber ?? null,
        columnNumber: debugSource?.columnNumber ?? null,
      };
      if (!firstSource && frame.fileName) firstSource = frame;
      stack.push(frame);
    }
    fiber = fiber._debugOwner as Record<string, unknown> | undefined;
  }

  return { componentName, source: firstSource, stack };
}

function createHoverOutline(): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute(OVERLAY_ATTR, "");
  node.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "border:2px solid #2563eb",
    "background:color-mix(in srgb, #2563eb 10%, transparent)",
    "border-radius:3px",
    "box-sizing:border-box",
    "display:none",
    "z-index:2147483646",
  ].join(";");
  return node;
}

function createInspectPopup(): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute(OVERLAY_ATTR, "");
  node.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "background:#1a1a2e",
    "color:#e0e0e0",
    "font-family:ui-monospace,monospace",
    "font-size:12px",
    "padding:10px 14px",
    "border-radius:8px",
    "box-shadow:0 8px 32px rgba(0,0,0,0.3)",
    "display:none",
    "z-index:2147483646",
    "max-width:360px",
    "line-height:1.6",
  ].join(";");
  return node;
}

function showInspectPopup(el: Element, rect: DOMRect) {
  if (!inspectPopup) return;
  const tag = el.tagName.toLowerCase();
  const classes = el instanceof HTMLElement && typeof el.className === "string"
    ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 5)
    : [];
  const classStr = classes.length > 0
    ? classes.map((c) => `<span style="color:#7dd3fc">${c}</span>`).join(" ")
    : "";
  const dims = `${Math.round(rect.width)} x ${Math.round(rect.height)}`;
  const a11y = getA11y(el);
  inspectPopup.innerHTML = [
    `<div style="margin-bottom:4px"><span style="color:#fbbf24">${tag}</span>${classStr ? " " + classStr : ""}</div>`,
    `<div style="color:#94a3b8;margin-bottom:6px">${dims}</div>`,
    `<div style="border-top:1px solid #334155;padding-top:6px;margin-top:6px">`,
    `<div><span style="color:#64748b">Name:</span> ${a11y.name ?? "—"}</div>`,
    `<div><span style="color:#64748b">Role:</span> ${a11y.role ?? "generic"}</div>`,
    `<div><span style="color:#64748b">Focusable:</span> ${a11y.keyboardFocusable ? "yes" : "no"}</div>`,
    `</div>`,
  ].join("");
  inspectPopup.style.display = "block";
  inspectPopup.style.transform = `translate(${Math.max(8, rect.right + 8)}px, ${Math.max(8, rect.top)}px)`;
}

function hideInspectPopup() {
  if (inspectPopup) inspectPopup.style.display = "none";
}

function pickFromPoint(x: number, y: number): Element | null {
  for (const candidate of document.elementsFromPoint(x, y)) {
    if (!(candidate instanceof Element)) continue;
    if (candidate.closest(`[${OVERLAY_ATTR}]`)) continue;
    if (candidate === document.documentElement || candidate === document.body) continue;
    return candidate;
  }
  return null;
}

async function captureElement(el: Element): Promise<PickedElement> {
  const rect = el.getBoundingClientRect();
  const selector = buildSelector(el);
  const htmlPreview = getHtmlPreview(el);
  const styles = getAuthorStyles(el);
  const a11y = getA11y(el);
  const { componentName, source, stack } = getReactComponent(el);

  return {
    id: nextId(),
    pageUrl: location.href,
    pageTitle: document.title?.trim() || null,
    tagName: el.tagName.toLowerCase(),
    selector,
    htmlPreview,
    componentName,
    source,
    stack,
    styles,
    rect: rectFromDom(rect),
    a11y,
    screenshot: null,
    pickedAt: new Date().toISOString(),
  };
}

function startPickMode() {
  if (pickActive) return;
  pickActive = true;
  hoverOutline = createHoverOutline();
  inspectPopup = createInspectPopup();
  document.documentElement.appendChild(hoverOutline);
  document.documentElement.appendChild(inspectPopup);
  document.documentElement.style.cursor = "crosshair";

  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
}

function stopPickMode() {
  if (!pickActive) return;
  pickActive = false;
  document.removeEventListener("pointermove", onPointerMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown, true);
  document.documentElement.style.cursor = "";
  hoverOutline?.remove();
  inspectPopup?.remove();
  hoverOutline = null;
  inspectPopup = null;
}

function onPointerMove(e: PointerEvent) {
  if (!pickActive || !hoverOutline) return;
  const target = pickFromPoint(e.clientX, e.clientY);
  if (target) {
    const rect = target.getBoundingClientRect();
    hoverOutline.style.display = "block";
    hoverOutline.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    hoverOutline.style.width = `${rect.width}px`;
    hoverOutline.style.height = `${rect.height}px`;
    showInspectPopup(target, rect);
  } else {
    hoverOutline.style.display = "none";
    hideInspectPopup();
  }
}

async function onClick(e: MouseEvent) {
  if (!pickActive) return;
  e.preventDefault();
  e.stopPropagation();
  const target = pickFromPoint(e.clientX, e.clientY);
  if (!target) return;
  const payload = await captureElement(target);
  ipcRenderer.send("browser:element-picked", payload);
  stopPickMode();
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && pickActive) {
    e.preventDefault();
    stopPickMode();
  }
}

ipcRenderer.on("browser:start-pick", () => startPickMode());
ipcRenderer.on("browser:cancel-pick", () => stopPickMode());
