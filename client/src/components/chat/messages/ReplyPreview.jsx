import React from "react";
import { getReplyPreview, getSenderName } from "./messageBubbleUtils";

export default function ReplyPreview({ replyTo, isOwn }) {
  if (!replyTo) return null;

  return (
    <div className="aurora-msg-reply" data-own={isOwn ? "true" : undefined}>
      <span className="aurora-msg-reply-name">
        {getSenderName(replyTo.sender)}
      </span>

      <span className="aurora-msg-reply-text">{getReplyPreview(replyTo)}</span>
    </div>
  );
}
