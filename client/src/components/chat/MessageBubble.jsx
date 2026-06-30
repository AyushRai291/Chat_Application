import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../ui/Avatar";
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

function getSenderSignature(sender) {
  if (!sender) return "";
  return [
    getId(sender),
    sender.name || "",
    sender.email || "",
    sender.avatar || "",
  ].join(":");
}

function getAttachmentSignature(attachments = []) {
  return attachments
    .map((attachment) =>
      [
        attachment.publicId || "",
        attachment.url || "",
        attachment.fileName || "",
        attachment.fileType || "",
        attachment.fileSize || 0,
      ].join(":"),
    )
    .join("|");
}

function getReactionSignature(reactions = []) {
  return reactions
    .map((reaction) => `${getId(reaction.user)}:${reaction.emoji || ""}`)
    .sort()
    .join("|");
}

function getReplySignature(replyTo) {
  if (!replyTo) return "";

  return [
    getId(replyTo),
    replyTo.text || "",
    replyTo.safeHtml || "",
    getSenderSignature(replyTo.sender),
    replyTo.createdAt || "",
    replyTo.deletedForEveryone ? "1" : "0",
  ].join("|");
}

function haveSameMessageView(first, second) {
  if (first === second) return true;
  if (!first || !second) return false;

  return (
    getId(first) === getId(second) &&
    first.clientMessageId === second.clientMessageId &&
    first.text === second.text &&
    first.status === second.status &&
    first.createdAt === second.createdAt &&
    first.isEdited === second.isEdited &&
    first.deletedForEveryone === second.deletedForEveryone &&
    first.isOptimistic === second.isOptimistic &&
    first.isPending === second.isPending &&
    first.isFailed === second.isFailed &&
    first.errorMessage === second.errorMessage &&
    getSenderSignature(first.sender) === getSenderSignature(second.sender) &&
    getReplySignature(first.replyTo) === getReplySignature(second.replyTo) &&
    getAttachmentSignature(first.attachments) ===
      getAttachmentSignature(second.attachments) &&
    getReactionSignature(first.reactions) === getReactionSignature(second.reactions)
  );
}

function areMessageBubblePropsEqual(prev, next) {
  return (
    prev.isOwn === next.isOwn &&
    prev.showAvatar === next.showAvatar &&
    prev.showSenderName === next.showSenderName &&
    prev.isGroupStart === next.isGroupStart &&
    prev.isGroupEnd === next.isGroupEnd &&
    prev.groupGap === next.groupGap &&
    prev.isSelected === next.isSelected &&
    prev.isSelectionMode === next.isSelectionMode &&
    prev.actions === next.actions &&
    haveSameMessageView(prev.message, next.message)
  );
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  showSenderName,
  isGroupStart = true,
  isGroupEnd = true,
  groupGap = "4px",
  isSelected = false,
  isSelectionMode = false,
  actions,
}) {
  const {
    setReplyTarget,
    editMessage,
    deleteMessageForMe,
    deleteMessageForEveryone,
    toggleReaction,
    toggleMessageSelection,
  } = actions;

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

  const focusComposer = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("aurora-composer-input")?.focus();
    }, 0);
  }, []);

  const runAction = useCallback(
    async (actionName, action, closeMenu = true) => {
      if (busyAction) return null;

      setBusyAction(actionName);

      try {
        const result = await action();
        if (closeMenu) setMenuOpen(false);
        return result;
      } finally {
        setBusyAction("");
      }
    },
    [busyAction],
  );

  const handleEditSave = useCallback(async () => {
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
  }, [editMessage, editText, message._id, message.text, runAction]);

  const handleEditCancel = useCallback(() => {
    if (busyAction) return;

    setIsEditing(false);
    setEditText(message.text || "");
  }, [busyAction, message.text]);

  const handleEditKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEditSave();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleEditCancel();
    }
  }, [handleEditCancel, handleEditSave]);

  const closeHoverSurface = useCallback((event) => {
    if (
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setShowActions(false);
    setMenuOpen(false);
  }, []);

  const showActionTrigger = canUseActions && (showActions || menuOpen);
  const actionTop =
    (showSenderName ? 20 : 0) + (message.replyTo && !isDeleted ? 34 : 0);

  const clearLongPressTimer = useCallback(() => {
    window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = null;
  }, []);

  const selectFromLongPress = useCallback(() => {
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
  }, [messageId, toggleMessageSelection]);

  const handleTouchStart = useCallback((event) => {
    if (!messageId || isEditing) return;

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchLongPressedRef.current = false;
    clearLongPressTimer();

    touchTimerRef.current = window.setTimeout(
      selectFromLongPress,
      LONG_PRESS_MS,
    );
  }, [clearLongPressTimer, isEditing, messageId, selectFromLongPress]);

  const handleTouchMove = useCallback((event) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const moved =
      Math.abs(touch.clientX - start.x) > TOUCH_MOVE_CANCEL_PX ||
      Math.abs(touch.clientY - start.y) > TOUCH_MOVE_CANCEL_PX;

    if (moved) clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    const wasLongPressed = touchLongPressedRef.current;
    clearLongPressTimer();

    if (!wasLongPressed && canUseActions && !isSelectionMode) {
      setShowActions(true);
    }
  }, [canUseActions, clearLongPressTimer, isSelectionMode]);

  const handleContextMenu = useCallback((event) => {
    if (!messageId || isEditing) return;

    event.preventDefault();
    suppressNextClickRef.current = true;
    setShowActions(false);
    setMenuOpen(false);
    toggleMessageSelection(messageId);

    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 320);
  }, [isEditing, messageId, toggleMessageSelection]);

  const handleRowClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    if (isSelectionMode && messageId) {
      toggleMessageSelection(messageId);
    }
  }, [isSelectionMode, messageId, toggleMessageSelection]);

  const handleMouseEnter = useCallback(() => {
    if (canUseActions) setShowActions(true);
  }, [canUseActions]);

  const handleMouseLeave = useCallback(() => {
    setShowActions(false);
    setMenuOpen(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (canUseActions) setShowActions(true);
  }, [canUseActions]);

  const handleImageOpen = useCallback((image) => {
    setViewerImage(image);
  }, []);

  const handleViewerClose = useCallback(() => {
    setViewerImage(null);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (!busyAction) setConfirmAction(null);
  }, [busyAction]);

  const handleConfirm = useCallback(async () => {
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
  }, [
    busyAction,
    confirmAction,
    deleteMessageForEveryone,
    deleteMessageForMe,
    message._id,
    runAction,
  ]);

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
        onClick={handleRowClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={clearLongPressTimer}
        onContextMenu={handleContextMenu}
        onFocus={handleFocus}
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
                      onImageOpen={handleImageOpen}
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

      <ImageViewer image={viewerImage} onClose={handleViewerClose} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText}
        busy={Boolean(busyAction)}
        onCancel={handleConfirmCancel}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export default React.memo(MessageBubble, areMessageBubblePropsEqual);
