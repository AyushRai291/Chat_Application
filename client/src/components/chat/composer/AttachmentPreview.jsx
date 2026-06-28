import React from "react";
import { formatFileSize } from "./composerUtils";

export default function AttachmentPreview({
  selectedFile,
  filePreviewUrl,
  onRemove,
}) {
  if (!selectedFile) return null;

  return (
    <div className="aurora-composer__attachment">
      {filePreviewUrl ? (
        <img
          src={filePreviewUrl}
          alt={selectedFile.name}
          className="aurora-composer__attachment-img"
        />
      ) : (
        <div className="aurora-composer__attachment-icon" aria-hidden="true">
          {"\uD83D\uDCCE"}
        </div>
      )}

      <div className="aurora-composer__attachment-body">
        <p className="aurora-composer__attachment-name">{selectedFile.name}</p>
        <p className="aurora-composer__attachment-meta">
          {formatFileSize(selectedFile.size)}
        </p>
      </div>

      <button
        type="button"
        className="aurora-composer__attachment-remove"
        onClick={onRemove}
        aria-label="Remove selected file"
      >
        {"\u00D7"}
      </button>
    </div>
  );
}
