import React from "react";

export default function VoicePreview({ recordedFile, recordedUrl, onRemove }) {
  if (!recordedFile || !recordedUrl) return null;

  return (
    <div className="aurora-composer__voice-preview">
      <div className="aurora-composer__voice-dot" aria-hidden="true" />

      <audio
        src={recordedUrl}
        controls
        className="aurora-composer__voice-audio"
      />

      <button
        type="button"
        className="aurora-composer__attachment-remove"
        onClick={onRemove}
        aria-label="Remove voice recording"
      >
        {"\u00D7"}
      </button>
    </div>
  );
}
