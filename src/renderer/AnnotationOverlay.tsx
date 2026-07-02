import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Square, Circle, Scissors, Undo2, X, Send } from "lucide-react";
import type { StrokeTarget, Annotation, Screenshot } from "../shared/types.js";

type AnnotationTool = "freehand" | "rectangle" | "ellipse" | "region";

interface AnnotationOverlayProps {
  screenshotUrl: string;
  screenshotWidth: number;
  screenshotHeight: number;
  pageUrl: string;
  pageTitle: string | null;
  onSubmit: (annotation: Annotation) => void;
  onCancel: () => void;
}

let strokeIdCounter = 0;
const nextStrokeId = () => `stroke_${++strokeIdCounter}`;

const toolIcon: Record<AnnotationTool, typeof Pencil> = {
  freehand: Pencil,
  rectangle: Square,
  ellipse: Circle,
  region: Scissors,
};

export function AnnotationOverlay(props: AnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<AnnotationTool>("freehand");
  const [color, setColor] = useState("#ef4444");
  const [strokes, setStrokes] = useState<StrokeTarget[]>([]);
  const drawingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#ffffff"];
  const tools: { id: AnnotationTool; label: string }[] = [
    { id: "freehand", label: "Pencil" },
    { id: "rectangle", label: "Rectangle" },
    { id: "ellipse", label: "Ellipse" },
    { id: "region", label: "Region" },
  ];

  const getCanvasCoords = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const strokeBounds = (points: { x: number; y: number }[], width: number) => {
    if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const pad = width + 3;
    return {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      width: Math.max(...xs) + pad - Math.min(...xs) + pad * 2,
      height: Math.max(...ys) + pad - Math.min(...ys) + pad * 2,
    };
  };

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: StrokeTarget) => {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stroke.tool === "freehand" && stroke.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
      }
      ctx.stroke();
    } else if (stroke.tool === "rectangle" && stroke.points.length >= 2) {
      const [start, end] = [stroke.points[0]!, stroke.points[stroke.points.length - 1]!];
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (stroke.tool === "ellipse" && stroke.points.length >= 2) {
      const [start, end] = [stroke.points[0]!, stroke.points[stroke.points.length - 1]!];
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.tool === "region" && stroke.points.length >= 2) {
      const [start, end] = [stroke.points[0]!, stroke.points[stroke.points.length - 1]!];
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.setLineDash([]);
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) drawStroke(ctx, stroke);
  }, [drawStroke, strokes]);

  useEffect(() => { redraw(); }, [redraw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const pt = getCanvasCoords(e);
    dragStartRef.current = pt;
    currentPointsRef.current = [pt];
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const pt = getCanvasCoords(e);
    if (tool === "freehand") currentPointsRef.current.push(pt);
    else currentPointsRef.current = [dragStartRef.current!, pt];

    const tempStroke: StrokeTarget = {
      id: "temp", tool, color, width: 3,
      points: [...currentPointsRef.current],
      bounds: strokeBounds(currentPointsRef.current, 3),
    };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      for (const s of strokes) drawStroke(ctx, s);
      drawStroke(ctx, tempStroke);
    }
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentPointsRef.current.length > 0) {
      const stroke: StrokeTarget = {
        id: nextStrokeId(), tool, color, width: 3,
        points: [...currentPointsRef.current],
        bounds: strokeBounds(currentPointsRef.current, 3),
      };
      setStrokes((prev) => [...prev, stroke]);
    }
    currentPointsRef.current = [];
    dragStartRef.current = null;
  };

  const handleUndo = () => setStrokes((prev) => prev.slice(0, -1));

  const handleSubmit = () => {
    const annotation: Annotation = {
      id: `ann_${Date.now().toString(36)}`,
      pageUrl: props.pageUrl,
      pageTitle: props.pageTitle,
      strokes,
      screenshot: { dataUrl: props.screenshotUrl, width: props.screenshotWidth, height: props.screenshotHeight } as Screenshot,
      comment: "",
      createdAt: new Date().toISOString(),
    };
    props.onSubmit(annotation);
  };

  const toolBtn = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--primary)" : "none",
    border: active ? "none" : "1px solid var(--border)",
    color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    transition: "background 0.12s, color 0.12s",
  });

  const divider: React.CSSProperties = { width: 1, height: 24, backgroundColor: "var(--border)" };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", backgroundColor: "var(--chrome-background)" }}>
      <div style={{ flex: 1, position: "relative", overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative" }}>
          <img src={props.screenshotUrl} alt="screenshot" style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }} />
          <canvas
            ref={canvasRef}
            width={props.screenshotWidth}
            height={props.screenshotHeight}
            style={{ position: "absolute", inset: 0, cursor: "crosshair", width: "100%", height: "100%" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 16px",
          backgroundColor: "var(--annotation-toolbar-bg)",
          borderTop: "1px solid var(--annotation-toolbar-border)",
          justifyContent: "center",
        }}
      >
        {tools.map((t) => {
          const Icon = toolIcon[t.id];
          return (
            <button key={t.id} style={toolBtn(tool === t.id)} onClick={() => setTool(t.id)} title={t.label} type="button">
              <Icon size={15} />
            </button>
          );
        })}
        <div style={divider} />
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 24, height: 24, borderRadius: "50%",
              border: color === c ? "2px solid var(--foreground)" : "2px solid transparent",
              backgroundColor: c, cursor: "pointer",
              transition: "border-color 0.12s",
            }}
            type="button"
          />
        ))}
        <div style={divider} />
        <button style={toolBtn(false)} onClick={handleUndo} title="Undo" type="button">
          <Undo2 size={15} />
        </button>
        <button style={toolBtn(false)} onClick={props.onCancel} type="button">
          <X size={15} style={{ marginRight: 3 }} />
          Cancel
        </button>
        <button
          style={{ ...toolBtn(true), padding: "6px 16px", fontWeight: 600 }}
          onClick={handleSubmit}
          type="button"
        >
          <Send size={14} style={{ marginRight: 3 }} />
          Add to chat
        </button>
      </div>
    </div>
  );
}
