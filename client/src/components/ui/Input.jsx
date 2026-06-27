import React from "react";

export default function Input({ prefix, suffix, style, inputStyle, ...props }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        minHeight: 40,
        padding: "0 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)",
        background: "var(--bg-elevated)",
        color: "var(--text-muted)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = "var(--border-accent)";
        event.currentTarget.style.boxShadow =
          "0 0 0 3px rgba(139, 92, 246, 0.12)";
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = "var(--border-default)";
        event.currentTarget.style.boxShadow = "none";
      }}
    >
      {prefix && (
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          {prefix}
        </span>
      )}

      <input
        {...props}
        style={{
          width: "100%",
          minWidth: 0,
          border: 0,
          outline: 0,
          background: "transparent",
          color: "var(--text-primary)",
          fontSize: "0.86rem",
          lineHeight: 1.4,
          ...inputStyle,
        }}
      />

      {suffix && (
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}