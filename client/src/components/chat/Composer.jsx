import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";
import { uploadService } from "../../services/uploadService";
import Spinner from "../ui/Spinner";

const TYPING_DEBOUNCE_MS = 1200;
const MAX_TEXTAREA_HEIGHT = 120;
const PREVIEW_LIMIT = 88;

function trimPreview(value, fallback = "") {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

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

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function formatFileSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Composer() {
  const {
    sendMessage,
    selectedConversation,
    replyTarget,
    clearReplyTarget,
    startTyping,
    stopTyping,
  } = useChat();

  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef(null);
  const sentFromTouchRef = useRef(false);

  const conversationId = selectedConversation?._id;

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const emitStop = useCallback(() => {
    if (!isTypingRef.current || !conversationId) return;

    stopTyping(conversationId);
    isTypingRef.current = false;
  }, [conversationId, stopTyping]);

  const emitStart = useCallback(() => {
    if (isTypingRef.current || !conversationId) return;

    startTyping(conversationId);
    isTypingRef.current = true;
  }, [conversationId, startTyping]);

  const scheduleStop = useCallback(() => {
    clearStopTimer();

    stopTimerRef.current = setTimeout(() => {
      emitStop();
    }, TYPING_DEBOUNCE_MS);
  }, [clearStopTimer, emitStop]);

  useEffect(() => {
    return () => {
      clearStopTimer();

      if (isTypingRef.current && conversationId) {
        stopTyping(conversationId);
        isTypingRef.current = false;
      }
    };
  }, [clearStopTimer, conversationId, stopTyping]);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, text]);

  useEffect(() => {
    if (!replyTarget || !conversationId) return;

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [replyTarget, conversationId]);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setFilePreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);

    if (!conversationId) return;

    if (!value.trim()) {
      clearStopTimer();
      emitStop();
      return;
    }

    emitStart();
    scheduleStop();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null);
    setUploadError("");
  };

  const handleSend = async () => {
    const cleanText = text.trim();

    if ((!cleanText && !selectedFile) || uploading || !conversationId) {
      return;
    }

    const oldReplyTarget = replyTarget;
    const oldSelectedFile = selectedFile;

    clearStopTimer();
    emitStop();

    let attachment = null;

    if (oldSelectedFile) {
      setUploading(true);
      setUploadError("");

      try {
        attachment = await uploadService.uploadAttachment({
          file: oldSelectedFile,
          conversationId,
        });
      } catch (err) {
        setUploadError(
          err?.response?.data?.message || err?.message || "File upload failed.",
        );
        setUploading(false);
        textareaRef.current?.focus({ preventScroll: true });
        return;
      } finally {
        setUploading(false);
      }
    }

    setText("");
    clearReplyTarget();
    clearSelectedFile();
    requestAnimationFrame(resizeTextarea);

    await sendMessage({
      text: cleanText,
      replyTo: oldReplyTarget?._id || null,
      attachments: attachment ? [attachment] : [],
    });

    requestAnimationFrame(resizeTextarea);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleSend();
  };

  const preventSendBlur = (event) => {
    if ((!text.trim() && !selectedFile) || uploading) return;
    event.preventDefault();
  };

  const handleSendTouchEnd = (event) => {
    if ((!text.trim() && !selectedFile) || uploading) return;

    event.preventDefault();
    sentFromTouchRef.current = true;
    handleSend();

    window.setTimeout(() => {
      sentFromTouchRef.current = false;
    }, 250);
  };

  const handleSendClick = () => {
    if (sentFromTouchRef.current) return;
    handleSend();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleBlur = () => {
    clearStopTimer();
    emitStop();
  };

  if (!selectedConversation) return null;

  const hasSendableContent = Boolean(text.trim() || selectedFile);
  const isBusy = uploading;

  return (
    <div className="aurora-composer">
      {replyTarget && (
        <div className="aurora-composer__reply">
          <div className="aurora-composer__reply-body">
            <p className="aurora-composer__reply-name">
              {getSenderName(replyTarget.sender)}
            </p>

            <p className="aurora-composer__reply-text">
              {getReplyPreview(replyTarget)}
            </p>
          </div>

          <button
            type="button"
            className="aurora-composer__reply-close"
            onClick={clearReplyTarget}
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      )}

      <form className="aurora-composer__form" onSubmit={handleSubmit}>
        {selectedFile && (
          <div className="aurora-composer__attachment">
            {filePreviewUrl ? (
              <img
                src={filePreviewUrl}
                alt={selectedFile.name}
                className="aurora-composer__attachment-img"
              />
            ) : (
              <div
                className="aurora-composer__attachment-icon"
                aria-hidden="true"
              >
                {"\u{1F4CE}"}
              </div>
            )}

            <div className="aurora-composer__attachment-body">
              <p className="aurora-composer__attachment-name">
                {selectedFile.name}
              </p>
              <p className="aurora-composer__attachment-meta">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>

            <button
              type="button"
              className="aurora-composer__attachment-remove"
              onClick={clearSelectedFile}
              aria-label="Remove selected file"
            >
              {"\u00D7"}
            </button>
          </div>
        )}

        {uploadError && (
          <p className="aurora-composer__error" role="alert">
            {uploadError}
          </p>
        )}

        <div className="aurora-composer__box">
          <input
            ref={fileInputRef}
            type="file"
            className="aurora-composer__file-input"
            onChange={handleFileChange}
            aria-label="Attach file"
          />

          <button
            type="button"
            className="aurora-composer__attach"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
            disabled={isBusy}
          >
            <AttachIcon />
          </button>

          <textarea
            id="aurora-composer-input"
            ref={textareaRef}
            className="aurora-composer__textarea"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="Write a message..."
            aria-label="Type a message"
            rows={1}
          />

          <button
            type="button"
            className="aurora-composer__send"
            disabled={!hasSendableContent || isBusy}
            aria-label="Send message"
            title="Send message"
            onMouseDown={preventSendBlur}
            onTouchStart={preventSendBlur}
            onTouchEnd={handleSendTouchEnd}
            onClick={handleSendClick}
          >
            {isBusy ? <Spinner size={16} color="#fff" /> : <SendIcon />}
          </button>
        </div>

        <p className="aurora-composer__hint">
          Enter to send · Shift + Enter for new line
        </p>
      </form>
    </div>
  );
}
