import React from "react";
import { getAttachmentUrl } from "./messageBubbleUtils";

export default function AttachmentView({ attachment, onImageOpen }) {
  const fileType = attachment.fileType || attachment.type || "";
  const url = getAttachmentUrl(attachment.url);
  const name = attachment.fileName || attachment.name || "Attachment";

  if (!url) return null;

  if (fileType.startsWith("image/")) {
    return (
      <button
        type="button"
        className="aurora-attachment-img-btn"
        onClick={(event) => {
          event.stopPropagation();
          onImageOpen({ url, name });
        }}
        aria-label={`Open image ${name}`}
      >
        <img src={url} alt={name} className="aurora-attachment-img" />
      </button>
    );
  }

  if (fileType.startsWith("video/")) {
    return <video src={url} controls className="aurora-attachment-video" />;
  }

  if (fileType.startsWith("audio/")) {
    return <audio src={url} controls className="aurora-attachment-audio" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="aurora-attachment-file"
      onClick={(event) => event.stopPropagation()}
    >
      {"\uD83D\uDCCE"} {name}
    </a>
  );
}
