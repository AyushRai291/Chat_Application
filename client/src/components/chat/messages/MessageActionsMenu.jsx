import React from "react";
import { MESSAGE_REACTION_EMOJIS } from "./messageBubbleUtils";

function MenuItem({ children, onClick, disabled, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="aurora-msg-menu-item"
      data-danger={danger ? "true" : undefined}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function MessageActionsMenu({
  actionTop,
  isOwn,
  menuOpen,
  setMenuOpen,
  busyAction,
  isSelected,
  isDeleted,
  canEdit,
  canDeleteEveryone,
  message,
  runAction,
  toggleReaction,
  toggleMessageSelection,
  setReplyTarget,
  setEditText,
  setIsEditing,
  setConfirmAction,
  focusComposer,
}) {
  return (
    <div
      className="aurora-msg-actions"
      style={{
        top: actionTop,
        ...(isOwn ? { left: -40 } : { right: -40 }),
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="aurora-msg-action-btn"
        aria-label="Message actions"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        disabled={Boolean(busyAction)}
      >
        {"\u22EF"}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="aurora-msg-menu"
          style={isOwn ? { right: 0 } : { left: 0 }}
        >
          <MenuItem
            disabled={Boolean(busyAction)}
            onClick={() => {
              if (busyAction) return;
              toggleMessageSelection(message._id);
              setMenuOpen(false);
            }}
          >
            {isSelected ? "Unselect" : "Select"}
          </MenuItem>

          {!isDeleted && (
            <>
              <div className="aurora-msg-menu-reactions">
                {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="aurora-msg-menu-emoji"
                    onClick={() =>
                      runAction(`reaction-${emoji}`, () =>
                        toggleReaction(message._id, emoji),
                      )
                    }
                    disabled={Boolean(busyAction)}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <MenuItem
                disabled={Boolean(busyAction)}
                onClick={() => {
                  if (busyAction) return;

                  setReplyTarget(message);
                  setMenuOpen(false);
                  focusComposer();
                }}
              >
                Reply
              </MenuItem>

              {canEdit && (
                <MenuItem
                  disabled={Boolean(busyAction)}
                  onClick={() => {
                    if (busyAction) return;

                    setEditText(message.text || "");
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  Edit
                </MenuItem>
              )}
            </>
          )}

          <MenuItem
            danger
            disabled={Boolean(busyAction)}
            onClick={() => {
              setConfirmAction({
                type: "delete-me",
                title: isDeleted
                  ? "Remove deleted message?"
                  : "Delete message for you?",
                description: isDeleted
                  ? "This deleted-message placeholder will disappear only from your chat."
                  : "This message will be removed only from your chat. The other user will still keep it.",
                confirmText: isDeleted ? "Remove" : "Delete",
              });
              setMenuOpen(false);
            }}
          >
            {isDeleted ? "Remove for me" : "Delete for me"}
          </MenuItem>

          {canDeleteEveryone && (
            <MenuItem
              danger
              disabled={Boolean(busyAction)}
              onClick={() => {
                setConfirmAction({
                  type: "delete-everyone",
                  title: "Delete message for everyone?",
                  description:
                    "This message will be deleted for everyone. This action cannot be undone.",
                  confirmText: "Delete",
                });
                setMenuOpen(false);
              }}
            >
              Delete for everyone
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
}
