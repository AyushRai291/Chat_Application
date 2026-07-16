import React from "react";
import Spinner from "./Spinner";

export function PageSuspenseFallback({ label = "Loading" }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
      }}
    >
      <Spinner size={28} label={label} />
    </div>
  );
}

export function DialogSuspenseFallback({ label = "Loading dialog" }) {
  return (
    <div className="aurora-dialog-backdrop" role="status" aria-label={label}>
      <div
        className="aurora-dialog-card"
        style={{
          minHeight: 120,
          maxWidth: 280,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size={24} label={label} />
      </div>
    </div>
  );
}
