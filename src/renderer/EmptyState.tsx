import { Globe } from "lucide-react";

export function EmptyState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        backgroundColor: "var(--background)",
        color: "var(--empty-description)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "48px",
          height: "48px",
          borderRadius: "var(--radius-xl)",
          backgroundColor: "var(--muted)",
        }}
      >
        <Globe size={22} style={{ color: "var(--empty-icon)" }} />
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--empty-title)",
        }}
      >
        No page open
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--empty-description)",
          textAlign: "center",
          maxWidth: "280px",
        }}
      >
        Enter a URL in the address bar, or ask the model to open one for you.
      </div>
    </div>
  );
}
