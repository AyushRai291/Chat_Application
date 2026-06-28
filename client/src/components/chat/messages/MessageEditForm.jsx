import React from "react";
import Spinner from "../../ui/Spinner";

export default function MessageEditForm({
  editTextareaRef,
  editText,
  setEditText,
  handleEditKeyDown,
  handleEditSave,
  handleEditCancel,
  busyAction,
}) {
  return (
    <div className="aurora-msg-edit">
      <textarea
        ref={editTextareaRef}
        autoFocus
        value={editText}
        onChange={(event) => setEditText(event.target.value)}
        onKeyDown={handleEditKeyDown}
        aria-label="Edit message"
        rows={2}
        className="aurora-msg-edit-area"
      />

      <div className="aurora-msg-edit-actions">
        <button
          type="button"
          onClick={handleEditSave}
          disabled={Boolean(busyAction) || !editText.trim()}
          className="aurora-msg-edit-btn"
          data-primary="true"
        >
          {busyAction === "edit" ? <Spinner size={12} /> : "Save"}
        </button>

        <button
          type="button"
          onClick={handleEditCancel}
          disabled={Boolean(busyAction)}
          className="aurora-msg-edit-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
