import { Plus, X } from "lucide-react";
import type { TabState } from "../shared/types.js";

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onSwitchTab: (tabId: string) => void;
}

export function TabBar(props: TabBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "4px 8px 0 8px",
        backgroundColor: "var(--tabbar-bg)",
        minHeight: "36px",
        borderBottom: "1px solid var(--tabbar-border)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {props.tabs.map((tab) => (
        <div
          key={tab.tabId}
          onClick={() => props.onSwitchTab(tab.tabId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px 8px 12px",
            backgroundColor: tab.active ? "var(--tab-active-bg)" : "transparent",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            color: tab.active ? "var(--tab-active-fg)" : "var(--tab-inactive-fg)",
            fontSize: "13px",
            whiteSpace: "nowrap",
            maxWidth: "200px",
            borderBottom: tab.active
              ? "2px solid var(--tab-active-indicator)"
              : "2px solid transparent",
            transition: "background 0.12s, color 0.12s",
          }}
          onMouseEnter={(e) => {
            if (!tab.active) {
              e.currentTarget.style.background = "var(--muted)";
              e.currentTarget.style.color = "var(--foreground)";
            }
          }}
          onMouseLeave={(e) => {
            if (!tab.active) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--tab-inactive-fg)";
            }
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "140px",
            }}
          >
            {tab.title || tab.url || "New Tab"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onCloseTab(tab.tabId);
            }}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "2px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              opacity: 0.6,
              transition: "opacity 0.12s, background 0.12s",
            }}
            type="button"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.background = "var(--muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.6";
              e.currentTarget.style.background = "none";
            }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={props.onNewTab}
        style={{
          background: "none",
          border: "none",
          color: "var(--tab-inactive-fg)",
          cursor: "pointer",
          padding: "6px 8px",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.12s, color 0.12s",
        }}
        type="button"
        title="New Tab"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--muted)";
          e.currentTarget.style.color = "var(--foreground)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
          e.currentTarget.style.color = "var(--tab-inactive-fg)";
        }}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
