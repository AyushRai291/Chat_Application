import React, { useState } from "react";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/ChatContext";

const REACTION_EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}"];

function formatTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusLabel({ status }) {
  const map = {
    read: "\u2713\u2713",
    delivered: "\u2713\u2713",
    sent: "\u2713",
  };

  const colorMap = {
    read: "var(--accent-secondary)",
    delivered: "var(--text-muted)",
    sent: "var(--text-muted)",
  };

  return (
    <span
      style={{
        color: colorMap[status] || "var(--text-muted)",
        fontSize: "0.72rem",
        marginLeft: "3px",
      }}
    >
      {map[status] || "\u2713"}
    </span>
  );
}

function ActionButton({ label, onClick, disabled, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger ? "rgba(239,68,68,0.12)" : "var(--bg-overlay)",
        border: `1px solid ${
          danger ? "rgba(239,68,68,0.25)" : "var(--border-default)"
        }`,
        borderRadius: "var(--radius-full)",
        color: danger ? "var(--status-error)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "0.68rem",
        lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
        padding: "5px 8px",
      }}
    >
      {label}
    </button>
  );
}

function AttachmentView({ attachment }) {
  const fileType = attachment.fileType || "";
  const url = attachment.url;
  const name = attachment.fileName || "Attachment";

  if (!url) return null;

  if (fileType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={name}
          style={{
            display: "block",
            maxWidth: "240px",
            maxHeight: "220px",
            borderRadius: "var(--radius-md)",
            marginTop: "8px",
            objectFit: "cover",
          }}
        />
      </a>
    );
  }

  if (fileType.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        style={{
          display: "block",
          maxWidth: "260px",
          borderRadius: "var(--radius-md)",
          marginTop: "8px",
        }}
      />
    );
  }

  if (fileType.startsWith("audio/")) {
    return (
      <audio
        src={url}
        controls
        style={{
          display: "block",
          maxWidth: "260px",
          marginTop: "8px",
        }}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        marginTop: "8px",
        color: "var(--accent-secondary)",
        fontSize: "0.82rem",
        wordBreak: "break-word",
      }}
    >
      Attachment: {name}
    </a>
  );
}

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const {
    setReplyTarget,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    toggleReaction,
  } = useChat();

  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [busyAction, setBusyAction] = useState("");

  const isDeleted = Boolean(message.deletedForEveryone);
  const senderName = message.sender?.name || message.sender?.email || "Unknown";
  const text = isDeleted
    ? "This message was deleted"
    : message.text || "";
  const canEdit = isOwn && !isDeleted && Boolean(message.text?.trim());
  const canDeleteEveryone = isOwn && !isDeleted;

  const runAction = async (actionName, action) => {
    if (busyAction) return;

    setBusyAction(actionName);

    try {
      await action();
    } finally {
      setBusyAction("");
    }
  };

  const handleEditSave = async () => {
    const cleanText = editText.trim();

    if (!cleanText || cleanText === (message.text || "")) {
      setIsEditing(false);
      setEditText(message.text || "");
      return;
    }

    await runAction("edit", async () => {
      const updated = await editMessage(message._id, cleanText);
      if (updated) setIsEditing(false);
    });
  };

  const handleEditKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEditSave();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
      setEditText(message.text || "");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isOwn ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: "8px",
        marginBottom: "4px",
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && (
            <Avatar
              name={senderName}
              src={message.sender?.avatar}
              size="xs"
            />
          )}
        </div>
      )}

      <div
        style={{
          maxWidth: "min(65%, 520px)",
          display: "flex",
          flexDirection: "column",
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {!isOwn && showAvatar && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--accent-secondary)",
              fontWeight: 600,
              marginBottom: "4px",
              paddingLeft: "4px",
            }}
          >
            {senderName}
          </span>
        )}

        {showActions && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: isOwn ? "flex-end" : "flex-start",
              gap: "4px",
              maxWidth: "100%",
              marginBottom: "4px",
            }}
          >
            {!isDeleted && (
              <ActionButton
                label="Reply"
                disabled={Boolean(busyAction)}
                onClick={() => setReplyTarget(message)}
              />
            )}

            {canEdit && (
              <ActionButton
                label="Edit"
                disabled={Boolean(busyAction)}
                onClick={() => {
                  setEditText(message.text || "");
                  setIsEditing(true);
                }}
              />
            )}

            {REACTION_EMOJIS.map((emoji) => (
              <ActionButton
                key={emoji}
                label={emoji}
                disabled={Boolean(busyAction) || isDeleted}
                onClick={() =>
                  runAction(`reaction-${emoji}`, () =>
                    toggleReaction(message._id, emoji)
                  )
                }
              />
            ))}

            <ActionButton
              label="Delete me"
              disabled={Boolean(busyAction)}
              danger
              onClick={() =>
                runAction("delete-me", () => deleteMessageForMe(message._id))
              }
            />

            {canDeleteEveryone && (
              <ActionButton
                label="Delete all"
                disabled={Boolean(busyAction)}
                danger
                onClick={() =>
                  runAction("delete-everyone", () =>
                    deleteMessageForEveryone(message._id)
                  )
                }
              />
            )}
          </div>
        )}

        {message.replyTo && !isDeleted && (
          <div
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
              borderLeft: "3px solid var(--accent-primary)",
              borderRadius: "var(--radius-md)",
              padding: "6px 10px",
              marginBottom: "4px",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                color: "var(--accent-secondary)",
                fontWeight: 600,
                display: "block",
                marginBottom: "2px",
              }}
            >
              {message.replyTo.sender?.name ||
                message.replyTo.sender?.email ||
                "Unknown"}
            </span>

            <span
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {message.replyTo.deletedForEveryone
                ? "Message was deleted"
                : message.replyTo.text || "Attachment"}
            </span>
          </div>
        )}

        <div
          role="article"
          aria-label={`Message from ${senderName}`}
          style={{
            background: isOwn
              ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.18))"
              : "var(--bg-elevated)",
            border: `1px solid ${
              isOwn ? "rgba(139,92,246,0.3)" : "var(--border-subtle)"
            }`,
            borderRadius: isOwn
              ? "var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)"
              : "var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)",
            padding: "10px 14px",
            fontSize: "0.875rem",
            lineHeight: 1.55,
            color: isDeleted ? "var(--text-muted)" : "var(--text-primary)",
            fontStyle: isDeleted ? "italic" : "normal",
            wordBreak: "break-word",
          }}
        >
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <textarea
                autoFocus
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={handleEditKeyDown}
                aria-label="Edit message"
                rows={2}
                style={{
                  minWidth: 220,
                  resize: "vertical",
                  background: "rgba(10,11,15,0.4)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                  outline: "none",
                  padding: "8px 10px",
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={Boolean(busyAction) || !editText.trim()}
                  style={{
                    background: "var(--accent-gradient)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    cursor: busyAction || !editText.trim() ? "not-allowed" : "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "6px 10px",
                  }}
                >
                  {busyAction === "edit" ? <Spinner size={12} /> : "Save"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(message.text || "");
                  }}
                  disabled={Boolean(busyAction)}
                  style={{
                    background: "var(--bg-overlay)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)",
                    cursor: busyAction ? "not-allowed" : "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "6px 10px",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {text}

              {message.isEdited && !isDeleted && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginLeft: "6px",
                  }}
                >
                  (edited)
                </span>
              )}

              {!isDeleted &&
                message.attachments?.map((attachment) => (
                  <AttachmentView
                    key={attachment.publicId || attachment.url}
                    attachment={attachment}
                  />
                ))}
            </>
          )}
        </div>

        {message.reactions?.length > 0 && !isDeleted && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginTop: "4px",
            }}
          >
            {message.reactions.map((reaction) => (
              <button
                key={`${reaction.user?._id || reaction.user}-${reaction.emoji}`}
                type="button"
                onClick={() =>
                  runAction(`reaction-${reaction.emoji}`, () =>
                    toggleReaction(message._id, reaction.emoji)
                  )
                }
                disabled={Boolean(busyAction)}
                aria-label={`Toggle ${reaction.emoji} reaction`}
                style={{
                  background: "var(--bg-overlay)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-full)",
                  color: "var(--text-primary)",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  padding: "1px 7px",
                  fontSize: "0.75rem",
                }}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginTop: "4px",
            paddingInline: "4px",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {formatTime(message.createdAt)}
          </span>

          {isOwn && <StatusLabel status={message.status} />}
        </div>
      </div>
    </div>
  );
}
