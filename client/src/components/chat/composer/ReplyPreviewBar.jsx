import React from "react";
import { getReplyPreview, getSenderName } from "./composerUtils";

export default function ReplyPreviewBar({ replyTarget, onCancel }) {
  if (!replyTarget) return null;

  return (
    <div className="aurora-composer__reply">
      <div className="aurora-composer__reply-body">
        <p className="aurora-composer__reply-name">
          {getSenderName(replyTarget.sender)}
        </p>

        <p className="aurora-composer__reply-text">
          {getReplyPreview(replyTarget)}
        </p>
      </div>

      <button
        type="button"
        className="aurora-composer__reply-close"
        onClick={onCancel}
        aria-label="Cancel reply"
      >
        {"\u00D7"}
      </button>
    </div>
  );
}
