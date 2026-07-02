import { ArrowLeft, ArrowRight, MousePointerClick, RotateCw, PenLine } from "lucide-react";
import type { CSSProperties } from "react";
import type { PickMode } from "../shared/types.js";

interface ToolbarProps {
  url: string;
  onUrlChange: (url: string) => void;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  pickMode: PickMode;
  onTogglePickMode: () => void;
  onAnnotate: () => void;
  annotateActive: boolean;
}

const navBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--toolbar-fg)",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "var(--radius-sm)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  transition: "background 0.15s",
};

export function Toolbar(props: ToolbarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = props.url.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url) && !/^about:/.test(url) && !/^file:/.test(url)) {
      url = "https://" + url;
    }
    props.onNavigate(url);
  };

  const pickActive = props.pickMode === "select";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 8px",
        backgroundColor: "var(--toolbar-bg)",
        borderBottom: "1px solid var(--toolbar-border)",
      }}
    >
      <button
        style={navBtn}
        onClick={props.onBack}
        title="Back"
        type="button"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--toolbar-btn-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        style={navBtn}
        onClick={props.onForward}
        title="Forward"
        type="button"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--toolbar-btn-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <ArrowRight size={16} />
      </button>
      <button
        style={navBtn}
        onClick={props.onReload}
        title="Reload"
        type="button"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--toolbar-btn-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <RotateCw size={15} />
      </button>
      <form onSubmit={handleSubmit} style={{ flex: 1, margin: "0 4px" }}>
        <input
          type="text"
          value={props.url}
          onChange={(e) => props.onUrlChange(e.target.value)}
          placeholder="Search or enter URL"
          spellCheck={false}
          style={{
            width: "100%",
            padding: "6px 14px",
            backgroundColor: "var(--toolbar-input-bg)",
            border: "1px solid var(--toolbar-input-border)",
            borderRadius: "var(--radius-lg)",
            color: "var(--toolbar-input-fg)",
            fontSize: "13px",
            outline: "none",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "var(--background)";
            e.currentTarget.style.borderColor = "var(--ring)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "var(--toolbar-input-bg)";
            e.currentTarget.style.borderColor = "var(--toolbar-input-border)";
          }}
        />
      </form>
      <button
        style={{
          ...navBtn,
          width: "auto",
          padding: "6px 12px",
          gap: "6px",
          fontSize: "13px",
          fontWeight: 500,
          background: pickActive ? "var(--primary)" : "none",
          color: pickActive ? "var(--primary-foreground)" : "var(--toolbar-fg)",
          border: pickActive ? "none" : "1px solid var(--border)",
        }}
        onClick={props.onTogglePickMode}
        title="Select an element to send to the model"
        type="button"
        aria-pressed={pickActive}
        onMouseEnter={(e) => {
          if (!pickActive) e.currentTarget.style.background = "var(--toolbar-btn-hover)";
        }}
        onMouseLeave={(e) => {
          if (!pickActive) e.currentTarget.style.background = "none";
        }}
      >
        <MousePointerClick size={15} />
        Select
      </button>
      <button
        style={{
          ...navBtn,
          width: "auto",
          padding: "6px 12px",
          gap: "6px",
          fontSize: "13px",
          fontWeight: 500,
          background: props.annotateActive ? "var(--primary)" : "none",
          color: props.annotateActive ? "var(--primary-foreground)" : "var(--toolbar-fg)",
          border: props.annotateActive ? "none" : "1px solid var(--border)",
        }}
        onClick={props.onAnnotate}
        title="Draw on a screenshot to annotate"
        type="button"
        aria-pressed={props.annotateActive}
        onMouseEnter={(e) => {
          if (!props.annotateActive) e.currentTarget.style.background = "var(--toolbar-btn-hover)";
        }}
        onMouseLeave={(e) => {
          if (!props.annotateActive) e.currentTarget.style.background = "none";
        }}
      >
        <PenLine size={15} />
        Annotate
      </button>
    </div>
  );
}
