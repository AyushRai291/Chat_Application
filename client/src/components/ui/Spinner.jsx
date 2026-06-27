import React from "react";

export default function Spinner({
  size = 18,
  label = "Loading",
  color = "var(--accent-secondary)",
}) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        border: "2px solid var(--border-default)",
        borderTopColor: color,
        animation: "aurora-spin 0.8s linear infinite",
      }}
    />
  );
}