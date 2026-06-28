import React from "react";

export function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes aurora-bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }

          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .aurora-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-primary);
          margin-right: 3px;
          animation: aurora-bounce 1.2s infinite ease-in-out;
        }

        .aurora-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .aurora-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>

      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span className="aurora-dot" />
        <span className="aurora-dot" />
        <span className="aurora-dot" />
      </span>
    </>
  );
}

export function DateSeparator({ label }) {
  if (!label) return null;

  return (
    <div className="aurora-date" aria-label={label}>
      <span className="aurora-date__line" />
      <span className="aurora-date__text">{label}</span>
      <span className="aurora-date__line" />
    </div>
  );
}

export function SelectionToolbar({
  count,
  canDeleteForEveryone,
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  return (
    <div className="aurora-chat__selection">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="aurora-chat__selection-close"
      >
        {"\u2715"}
      </button>

      <span className="aurora-chat__selection-text">{count} selected</span>

      <button
        type="button"
        onClick={onDeleteForMe}
        className="aurora-chat__danger-btn"
      >
        Delete for me
      </button>

      <button
        type="button"
        onClick={onDeleteForEveryone}
        disabled={!canDeleteForEveryone}
        title={
          canDeleteForEveryone
            ? "Delete selected messages for everyone"
            : "Only your non-deleted messages can be deleted for everyone"
        }
        className="aurora-chat__danger-btn"
      >
        Delete for everyone
      </button>
    </div>
  );
}

export function HeaderBtn({ children, onClick, active, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "true" : undefined}
      className="aurora-chat__icon-btn"
      {...props}
    >
      {children}
    </button>
  );
}
