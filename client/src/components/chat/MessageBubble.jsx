import React, { useEffect, useMemo, useState } from "react";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/ChatContext";
import ConfirmDialog from "../ui/ConfirmDialog";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];
const PREVIEW_LIMIT = 88;

const getId = (value) => String(value?._id || value || "");

function trimPreview(value, fallback = "") {
  const clean = String(value || "").replace(/\s+/g, " ").trim();

  if (!clean) return fallback;
  if (clean.length <= PREVIEW_LIMIT) return clean;

  return `${clean.slice(0, PREVIEW_LIMIT - 3)}...`;
}

function getSenderName(sender) {
  return sender?.name || sender?.email || "Unknown";
}

function getReplyPreview(message) {
  if (!message) return "";
  if (message.deletedForEveryone) return "Message deleted";
  if (message.text) return trimPreview(message.text);
  if (message.attachments?.length) return "Attachment";
  return "Message";
}

function getBubbleRadius(isOwn, isGroupStart, isGroupEnd) {
  const xl = "var(--radius-xl)";
  const md = "var(--radius-md)";
  const sm = "var(--radius-sm)";

  if (isOwn) {
    if (isGroupStart && isGroupEnd) return `${xl} ${xl} ${sm} ${xl}`;
    if (isGroupStart) return `${xl} ${xl} ${md} ${xl}`;
    if (isGroupEnd) return `${xl} ${md} ${sm} ${xl}`;
    return `${xl} ${md} ${md} ${xl}`;
  }

  if (isGroupStart && isGroupEnd) return `${xl} ${xl} ${xl} ${sm}`;
  if (isGroupStart) return `${xl} ${xl} ${xl} ${md}`;
  if (isGroupEnd) return `${md} ${xl} ${xl} ${sm}`;
  return `${md} ${xl} ${xl} ${md}`;
}

function getReactionCounts(reactions = []) {
  const counts = new Map();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  });

  return Array.from(counts, ([emoji, count]) => ({ emoji, count }));
}

function formatTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function StatusLabel({ status }) {
  const map = {
    read: "✓✓",
    delivered: "✓✓",
    sent: "✓",
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
      {map[status] || "✓"}
    </span>
  );
}

function MenuItem({ children, onClick, disabled, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-sm)",
        color: danger ? "var(--status-error)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        justifyContent: "flex-start",
        fontFamily: "var(--font-sans)",
        fontSize: "0.78rem",
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        padding: "7px 8px",
        textAlign: "left",
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.background = danger
            ? "rgba(239,68,68,0.12)"
            : "var(--bg-overlay)";
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "transparent";
      }}
    >
      {children}
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
      📎 {name}
    </a>
  );
}

function ReplyPreview({ replyTo, isOwn }) {
  if (!replyTo) return null;

  return (
    <div
      style={{
        alignSelf: isOwn ? "flex-end" : "flex-start",
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-default)",
        borderLeft: "3px solid var(--accent-primary)",
        borderRadius: "var(--radius-md)",
        padding: "5px 9px",
        marginBottom: "4px",
        fontSize: "0.76rem",
        lineHeight: 1.35,
        color: "var(--text-muted)",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "var(--accent-secondary)",
          fontWeight: 700,
          display: "block",
          marginBottom: "1px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {getSenderName(replyTo.sender)}
      </span>

      <span
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {getReplyPreview(replyTo)}
      </span>
    </div>
  );
}

export default function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showSenderName,
  isGroupStart = true,
  isGroupEnd = true,
  groupGap = "4px",
}) {
  const {
    setReplyTarget,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    toggleReaction,
    selectedMessageIds,
    toggleMessageSelection,
  } = useChat();

  const [showActions, setShowActions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [busyAction, setBusyAction] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const messageId = getId(message);
  const isDeleted = Boolean(message.deletedForEveryone);
  const senderName = getSenderName(message.sender);
  const text = isDeleted ? "This message was deleted" : message.text || "";

  const isSelectionMode = selectedMessageIds.size > 0;
  const isSelected = selectedMessageIds.has(messageId);

  const canEdit = isOwn && !isDeleted && Boolean(message.text?.trim());
  const canDeleteEveryone = isOwn && !isDeleted;
  const canUseActions = !isEditing;

  const reactionCounts = useMemo(
    () => getReactionCounts(message.reactions),
    [message.reactions]
  );

  useEffect(() => {
    if (!isEditing) {
      setEditText(message.text || "");
    }
  }, [isEditing, message.text]);

  useEffect(() => {
    if (isDeleted) {
      setMenuOpen(false);
      setIsEditing(false);
    }
  }, [isDeleted]);

  const runAction = async (actionName, action, closeMenu = true) => {
    if (busyAction) return null;

    setBusyAction(actionName);

    try {
      const result = await action();
      if (closeMenu) setMenuOpen(false);
      return result;
    } finally {
      setBusyAction("");
    }
  };

  const handleEditSave = async () => {
    const cleanText = editText.trim();
    const currentText = (message.text || "").trim();

    if (!cleanText || cleanText === currentText) {
      setIsEditing(false);
      setEditText(message.text || "");
      return;
    }

    await runAction("edit", async () => {
      const updated = await editMessage(message._id, cleanText);
      if (updated) setIsEditing(false);
      return updated;
    });
  };

  const handleEditCancel = () => {
    if (busyAction) return;

    setIsEditing(false);
    setEditText(message.text || "");
  };

  const handleEditKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEditSave();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleEditCancel();
    }
  };

  const closeHoverSurface = (event) => {
    if (
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setShowActions(false);
    setMenuOpen(false);
  };

  const showActionTrigger = canUseActions && (showActions || menuOpen);
  const actionTop =
    (showSenderName ? 20 : 0) + (message.replyTo && !isDeleted ? 34 : 0);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: isOwn ? "row-reverse" : "row",
          alignItems: "flex-end",
          gap: "8px",
          marginBottom: isGroupEnd ? "4px" : 0,
          marginTop: groupGap,
          cursor: isSelectionMode ? "pointer" : "default",
        }}
        onClick={() => {
          if (isSelectionMode && messageId) {
            toggleMessageSelection(messageId);
          }
        }}
        onMouseEnter={() => {
          if (canUseActions) setShowActions(true);
        }}
        onMouseLeave={() => {
          setShowActions(false);
          setMenuOpen(false);
        }}
        onTouchStart={() => {
          if (canUseActions) setShowActions(true);
        }}
        onFocus={() => {
          if (canUseActions) setShowActions(true);
        }}
        onBlur={closeHoverSurface}
      >
        {!isOwn && (
          <div style={{ width: 28, flexShrink: 0 }}>
            {showAvatar && (
              <Avatar name={senderName} src={message.sender?.avatar} size="xs" />
            )}
          </div>
        )}

        <div
          style={{
            maxWidth: "min(70%, 560px)",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: isOwn ? "flex-end" : "flex-start",
            minWidth: 0,
          }}
        >
          {showSenderName && (
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

          {showActionTrigger && (
            <div
              style={{
                position: "absolute",
                top: actionTop,
                zIndex: 10,
                ...(isOwn ? { left: -36 } : { right: -36 }),
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Message actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                disabled={Boolean(busyAction)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                }}
              >
                ⋯
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: 32,
                    minWidth: 190,
                    padding: "6px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-elevated)",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
                    ...(isOwn ? { right: 0 } : { left: 0 }),
                  }}
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
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          padding: "3px 2px 6px",
                          borderBottom: "1px solid var(--border-subtle)",
                          marginBottom: "4px",
                        }}
                      >
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() =>
                              runAction(`reaction-${emoji}`, () =>
                                toggleReaction(message._id, emoji)
                              )
                            }
                            disabled={Boolean(busyAction)}
                            aria-label={`React with ${emoji}`}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "var(--radius-full)",
                              border: "1px solid var(--border-default)",
                              background: "var(--bg-overlay)",
                              cursor: busyAction ? "not-allowed" : "pointer",
                              fontSize: "0.9rem",
                              lineHeight: 1,
                            }}
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
          )}

          {message.replyTo && !isDeleted && (
            <ReplyPreview replyTo={message.replyTo} isOwn={isOwn} />
          )}

          <div
            role="article"
            aria-label={`Message from ${senderName}`}
            style={{
              background: isDeleted
                ? "rgba(148,163,184,0.07)"
                : isOwn
                ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.18))"
                : "var(--bg-elevated)",
              border: `1px solid ${
                isSelected
                  ? "var(--accent-primary)"
                  : isDeleted
                  ? "rgba(148,163,184,0.18)"
                  : isOwn
                  ? "rgba(139,92,246,0.3)"
                  : "var(--border-subtle)"
              }`,
              borderRadius: getBubbleRadius(isOwn, isGroupStart, isGroupEnd),
              padding: isDeleted ? "5px 10px" : "10px 14px",
              fontSize: isDeleted ? "0.78rem" : "0.875rem",
              lineHeight: isDeleted ? 1.3 : 1.55,
              color: isDeleted ? "var(--text-muted)" : "var(--text-primary)",
              fontStyle: isDeleted ? "italic" : "normal",
              wordBreak: "break-word",
              maxWidth: "100%",
              boxShadow: isSelected
                ? "0 0 0 2px var(--accent-primary), 0 0 18px var(--accent-glow)"
                : "none",
            }}
          >
            {isEditing ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
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

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "6px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={Boolean(busyAction) || !editText.trim()}
                    style={{
                      background: "var(--accent-gradient)",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      color: "#fff",
                      cursor:
                        busyAction || !editText.trim()
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "6px 10px",
                    }}
                  >
                    {busyAction === "edit" ? <Spinner size={12} /> : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={handleEditCancel}
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

          {reactionCounts.length > 0 && !isDeleted && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginTop: "4px",
              }}
            >
              {reactionCounts.map((reaction) => (
                <button
                  key={reaction.emoji}
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "1px 7px",
                    fontSize: "0.75rem",
                  }}
                >
                  <span>{reaction.emoji}</span>
                  {reaction.count > 1 && <span>{reaction.count}</span>}
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: isDeleted ? "2px" : "4px",
              paddingInline: "4px",
            }}
          >
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {formatTime(message.createdAt)}
            </span>

            {isOwn && !isDeleted && <StatusLabel status={message.status} />}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText}
        busy={Boolean(busyAction)}
        onCancel={() => {
          if (!busyAction) setConfirmAction(null);
        }}
        onConfirm={async () => {
          if (!confirmAction || busyAction) return;

          if (confirmAction.type === "delete-me") {
            await runAction("delete-me", () => deleteMessageForMe(message._id));
          }

          if (confirmAction.type === "delete-everyone") {
            await runAction("delete-everyone", () =>
              deleteMessageForEveryone(message._id)
            );
          }

          setConfirmAction(null);
        }}
      />
    </>
  );
}