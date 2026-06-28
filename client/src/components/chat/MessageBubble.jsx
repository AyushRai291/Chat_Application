import React, { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../ui/Avatar";
import { useChat } from "../../context/ChatContext";
import ConfirmDialog from "../ui/ConfirmDialog";
import AttachmentView from "./messages/AttachmentView";
import ImageViewer from "./messages/ImageViewer";
import MessageActionsMenu from "./messages/MessageActionsMenu";
import MessageEditForm from "./messages/MessageEditForm";
import MessageMeta from "./messages/MessageMeta";
import ReplyPreview from "./messages/ReplyPreview";
import {
  getBubbleRadius,
  getId,
  getReactionCounts,
  getSenderName,
} from "./messages/messageBubbleUtils";

const LONG_PRESS_MS = 520;
const TOUCH_MOVE_CANCEL_PX = 12;

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
  const [viewerImage, setViewerImage] = useState(null);

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
    [message.reactions],
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
      setViewerImage(null);
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
      LONG_PRESS_MS,
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
              <Avatar
                name={senderName}
                src={message.sender?.avatar}
                size="xs"
              />
            )}
          </div>
        )}

        <div className="aurora-msg-stack" data-own={isOwn ? "true" : undefined}>
          {showSenderName && (
            <span className="aurora-msg-sender">{senderName}</span>
          )}

          {showActionTrigger && (
            <MessageActionsMenu
              actionTop={actionTop}
              isOwn={isOwn}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              busyAction={busyAction}
              isSelected={isSelected}
              isDeleted={isDeleted}
              canEdit={canEdit}
              canDeleteEveryone={canDeleteEveryone}
              message={message}
              runAction={runAction}
              toggleReaction={toggleReaction}
              toggleMessageSelection={toggleMessageSelection}
              setReplyTarget={setReplyTarget}
              setEditText={setEditText}
              setIsEditing={setIsEditing}
              setConfirmAction={setConfirmAction}
              focusComposer={focusComposer}
            />
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
              <MessageEditForm
                editTextareaRef={editTextareaRef}
                editText={editText}
                setEditText={setEditText}
                handleEditKeyDown={handleEditKeyDown}
                handleEditSave={handleEditSave}
                handleEditCancel={handleEditCancel}
                busyAction={busyAction}
              />
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
                      onImageOpen={setViewerImage}
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
                      toggleReaction(message._id, reaction.emoji),
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

          <MessageMeta
            createdAt={message.createdAt}
            status={message.status}
            showStatus={isOwn && !isDeleted}
          />
        </div>
      </div>

      <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />

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
              deleteMessageForEveryone(message._id),
            );
          }

          setConfirmAction(null);
        }}
      />
    </>
  );
}
