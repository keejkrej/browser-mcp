export type PickMode = "select" | "annotate" | "off";

export interface TabState {
  tabId: string;
  url: string;
  title: string | null;
  active: boolean;
  loading: boolean;
}

export interface StackFrame {
  functionName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementA11y {
  name: string | null;
  role: string | null;
  keyboardFocusable: boolean;
}

export interface Screenshot {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PickedElement {
  id: string;
  pageUrl: string;
  pageTitle: string | null;
  tagName: string;
  selector: string | null;
  htmlPreview: string;
  componentName: string | null;
  source: StackFrame | null;
  stack: StackFrame[];
  styles: string;
  rect: ElementRect;
  a11y: ElementA11y;
  screenshot: Screenshot | null;
  pickedAt: string;
}

export interface StrokeTarget {
  id: string;
  tool: "freehand" | "rectangle" | "ellipse" | "region";
  color: string;
  width: number;
  points: { x: number; y: number }[];
  bounds: ElementRect;
}

export interface Annotation {
  id: string;
  pageUrl: string;
  pageTitle: string | null;
  strokes: StrokeTarget[];
  screenshot: Screenshot | null;
  comment: string;
  createdAt: string;
}

export type PickQueueEntry = PickedElement | Annotation;

export interface BrowserState {
  tabs: TabState[];
  activeTabId: string | null;
  pickMode: PickMode;
}
