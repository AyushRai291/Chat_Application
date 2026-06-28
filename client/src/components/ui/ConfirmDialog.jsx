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

    const timer = setTimeout(() => {
      cardRef.current?.querySelector("button:not(:disabled)")?.focus();
    }, 0);

    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      oldFocus.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="aurora-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        className="aurora-dialog-card"
      >
        <div className="aurora-dialog-content">
          <div
            className="aurora-dialog-kicker"
            data-danger={danger ? "true" : undefined}
            aria-hidden="true"
          >
            {danger ? "!" : "\u2726"}
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
            className="aurora-dialog-close"
          >
            {"\u00D7"}
          </button>

          <h2 id={titleId} className="aurora-dialog-title">
            {title}
          </h2>

          {description && (
            <p id={descId} className="aurora-dialog-desc">
              {description}
            </p>
          )}
        </div>

        <div className="aurora-dialog-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="aurora-dialog-btn"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`aurora-dialog-btn ${
              danger ? "aurora-dialog-btn-danger" : "aurora-dialog-btn-primary"
            }`}
          >
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
