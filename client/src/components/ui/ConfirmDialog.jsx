import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

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
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef(null);
  const oldFocus = useRef(null);

  useEffect(() => {
    if (!open) return;

    oldFocus.current = document.activeElement;

    const t = setTimeout(() => {
      cardRef.current?.querySelector("button:not(:disabled)")?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel?.();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      oldFocus.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background:
          "radial-gradient(circle at 50% 25%, rgba(139,92,246,0.18), transparent 34%), rgba(2,6,23,0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, calc(100vw - 40px))",
          borderRadius: 24,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          background:
            "linear-gradient(180deg, rgba(18,27,46,0.98), rgba(8,12,22,0.98))",
          boxShadow:
            "0 32px 90px rgba(0,0,0,0.58), 0 0 42px rgba(139,92,246,0.14)",
          transform: "translate3d(0,0,0)",
        }}
      >
        <div
          style={{
            position: "relative",
            padding: "22px 22px 16px",
            background:
              "radial-gradient(circle at 15% 0%, rgba(139,92,246,0.18), transparent 38%), radial-gradient(circle at 88% 0%, rgba(34,211,238,0.12), transparent 34%)",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              marginBottom: 14,
              background: danger
                ? "rgba(239,68,68,0.12)"
                : "rgba(139,92,246,0.13)",
              border: danger
                ? "1px solid rgba(239,68,68,0.22)"
                : "1px solid rgba(139,92,246,0.22)",
              color: danger ? "#fecaca" : "var(--accent-secondary)",
              fontWeight: 900,
            }}
          >
            {danger ? "!" : "✦"}
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-muted)",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>

          <h2
            id={titleId}
            style={{
              margin: "0 38px 8px 0",
              color: "var(--text-primary)",
              fontSize: "1.02rem",
              fontWeight: 850,
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            {title}
          </h2>

          {description && (
            <p
              id={descId}
              style={{
                color: "var(--text-muted)",
                fontSize: "0.86rem",
                lineHeight: 1.58,
              }}
            >
              {description}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: 16,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.018)",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              minWidth: 96,
              height: 40,
              padding: "0 14px",
              borderRadius: 12,
              fontSize: "0.83rem",
              fontWeight: 780,
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.045)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              minWidth: 102,
              height: 40,
              padding: "0 14px",
              borderRadius: 12,
              fontSize: "0.83rem",
              fontWeight: 800,
              color: danger ? "#fecaca" : "#fff",
              border: danger
                ? "1px solid rgba(239,68,68,0.28)"
                : "1px solid rgba(139,92,246,0.32)",
              background: danger
                ? "linear-gradient(135deg, rgba(239,68,68,0.24), rgba(127,29,29,0.2))"
                : "var(--accent-gradient)",
              boxShadow: danger
                ? "none"
                : "0 12px 28px rgba(139,92,246,0.22)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}