import React from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  busy = false,
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(2,6,23,0.62)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "min(420px, 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-default)",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(10,11,15,0.98))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.52)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 18px 14px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <p
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            {title}
          </p>

          <p
            style={{
              fontSize: "0.84rem",
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            {description}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: 14,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              minWidth: 88,
              padding: "9px 13px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-overlay)",
              color: "var(--text-secondary)",
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "0.82rem",
              fontWeight: 700,
              opacity: busy ? 0.65 : 1,
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minWidth: 96,
              padding: "9px 13px",
              borderRadius: "var(--radius-md)",
              border: danger
                ? "1px solid rgba(239,68,68,0.35)"
                : "1px solid var(--border-accent)",
              background: danger
                ? "linear-gradient(135deg, rgba(239,68,68,0.24), rgba(127,29,29,0.22))"
                : "var(--accent-gradient)",
              color: danger ? "var(--status-error)" : "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "0.82rem",
              fontWeight: 800,
              opacity: busy ? 0.65 : 1,
            }}
          >
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}