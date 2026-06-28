import React from "react";
import { formatMessageTime } from "./messageBubbleUtils";

const STATUS_LABELS = {
  read: "\u2713\u2713",
  delivered: "\u2713\u2713",
  sent: "\u2713",
};

function StatusLabel({ status }) {
  return (
    <span className="aurora-msg-status" data-status={status}>
      {STATUS_LABELS[status] || "\u2713"}
    </span>
  );
}

export default function MessageMeta({ createdAt, status, showStatus }) {
  return (
    <div className="aurora-msg-meta">
      <span className="aurora-msg-time">{formatMessageTime(createdAt)}</span>

      {showStatus && <StatusLabel status={status} />}
    </div>
  );
}
