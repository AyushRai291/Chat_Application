import React, { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/ChatContext";
import ConfirmDialog from "../ui/ConfirmDialog";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];
const PREVIEW_LIMIT = 88;
const LONG_PRESS_MS = 520;
const TOUCH_MOVE_CANCEL_PX = 12;

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

  return (
    <span className="aurora-msg-status" data-status={status}>
      {map[status] || "✓"}
    </span>
  );
}

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

function getAttachmentUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function AttachmentView({ attachment }) {
  const fileType = attachment.fileType || attachment.type || "";
  const url = getAttachmentUrl(attachment.url);
  const name = attachment.fileName || attachment.name || "Attachment";

  if (!url) return null;

  if (fileType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} className="aurora-attachment-img" />
      </a>
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
    >
      📎 {name}
    </a>
  );
}

function ReplyPreview({ replyTo, isOwn }) {
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

  const editTextareaRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchStartRef = useRef(null);
  const touchLongPressedRef = useRef(false);
  const suppressNextClickRef = useRef(false);

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
    if (!isEditing) return;

    requestAnimationFrame(() => {
      const textarea = editTextareaRef.current;
      if (!textarea) return;

      const end = textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(end, end);
    });
  }, [isEditing]);

  useEffect(() => {
    if (isDeleted) {
      setMenuOpen(false);
      setIsEditing(false);
    }
  }, [isDeleted]);

  useEffect(() => {
    return () => {
      window.clearTimeout(touchTimerRef.current);
    };
  }, []);

  const focusComposer = () => {
    window.setTimeout(() => {
      document.getElementById("aurora-composer-input")?.focus();
    }, 0);
  };

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

  const clearLongPressTimer = () => {
    window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = null;
  };

  const selectFromLongPress = () => {
    if (!messageId) return;

    touchLongPressedRef.current = true;
    suppressNextClickRef.current = true;
    setShowActions(false);
    setMenuOpen(false);
    toggleMessageSelection(messageId);
    navigator.vibrate?.(12);

    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 320);
  };

  const handleTouchStart = (event) => {
    if (!messageId || isEditing) return;

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchLongPressedRef.current = false;
    clearLongPressTimer();

    touchTimerRef.current = window.setTimeout(
      selectFromLongPress,
      LONG_PRESS_MS
    );
  };

  const handleTouchMove = (event) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const moved =
      Math.abs(touch.clientX - start.x) > TOUCH_MOVE_CANCEL_PX ||
      Math.abs(touch.clientY - start.y) > TOUCH_MOVE_CANCEL_PX;

    if (moved) clearLongPressTimer();
  };

  const handleTouchEnd = () => {
    const wasLongPressed = touchLongPressedRef.current;
    clearLongPressTimer();

    if (!wasLongPressed && canUseActions && !isSelectionMode) {
      setShowActions(true);
    }
  };

  const handleContextMenu = (event) => {
    if (!messageId || isEditing) return;

    event.preventDefault();
    suppressNextClickRef.current = true;
    setShowActions(false);
    setMenuOpen(false);
    toggleMessageSelection(messageId);

    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 320);
  };

  return (
    <>
      <div
        className="aurora-msg-row"
        data-own={isOwn ? "true" : undefined}
        style={{
          marginBottom: isGroupEnd ? "4px" : 0,
          marginTop: groupGap,
          cursor: isSelectionMode ? "pointer" : "default",
        }}
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={clearLongPressTimer}
        onContextMenu={handleContextMenu}
        onFocus={() => {
          if (canUseActions) setShowActions(true);
        }}
        onBlur={closeHoverSurface}
      >
        {!isOwn && (
          <div className="aurora-msg-avatar-slot">
            {showAvatar && (
              <Avatar name={senderName} src={message.sender?.avatar} size="xs" />
            )}
          </div>
        )}

        <div className="aurora-msg-stack" data-own={isOwn ? "true" : undefined}>
          {showSenderName && (
            <span className="aurora-msg-sender">{senderName}</span>
          )}

          {showActionTrigger && (
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
                ⋯
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
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="aurora-msg-menu-emoji"
                            onClick={() =>
                              runAction(`reaction-${emoji}`, () =>
                                toggleReaction(message._id, emoji)
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
          )}

          {message.replyTo && !isDeleted && (
            <ReplyPreview replyTo={message.replyTo} isOwn={isOwn} />
          )}

          <div
            role="article"
            aria-label={`Message from ${senderName}`}
            className="aurora-bubble"
            data-own={isOwn ? "true" : undefined}
            data-deleted={isDeleted ? "true" : undefined}
            data-selected={isSelected ? "true" : undefined}
            style={{
              borderRadius: getBubbleRadius(isOwn, isGroupStart, isGroupEnd),
            }}
          >
            {isEditing ? (
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
            ) : (
              <>
                {text}

                {message.isEdited && !isDeleted && (
                  <span className="aurora-msg-edited">(edited)</span>
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
            <div className="aurora-msg-reactions">
              {reactionCounts.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  className="aurora-msg-reaction"
                  onClick={() =>
                    runAction(`reaction-${reaction.emoji}`, () =>
                      toggleReaction(message._id, reaction.emoji)
                    )
                  }
                  disabled={Boolean(busyAction)}
                  aria-label={`Toggle ${reaction.emoji} reaction`}
                >
                  <span>{reaction.emoji}</span>
                  {reaction.count > 1 && <span>{reaction.count}</span>}
                </button>
              ))}
            </div>
          )}

          <div className="aurora-msg-meta">
            <span className="aurora-msg-time">
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
