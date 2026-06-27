import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";
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

export default function Composer() {
  const {
    sendMessage,
    sendingMessage,
    selectedConversation,
    replyTarget,
    clearReplyTarget,
    startTyping,
    stopTyping,
  } = useChat();

  const [text, setText] = useState("");
  const textareaRef = useRef(null);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef(null);

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

  const handleSend = async () => {
    const cleanText = text.trim();

    if (!cleanText || sendingMessage || !conversationId) return;

    const oldText = text;
    const oldReplyTarget = replyTarget;

    setText("");
    clearReplyTarget();
    requestAnimationFrame(resizeTextarea);

    clearStopTimer();
    emitStop();

    const message = await sendMessage({
      text: cleanText,
      replyTo: oldReplyTarget?._id || null,
    });

    if (!message) {
      setText(oldText);
      requestAnimationFrame(resizeTextarea);
    }

    textareaRef.current?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
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
        <div className="aurora-composer__box">
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
            type="submit"
            className="aurora-composer__send"
            disabled={!text.trim() || sendingMessage}
            aria-label="Send message"
            title="Send message"
          >
            {sendingMessage ? <Spinner size={16} color="#fff" /> : <SendIcon />}
          </button>
        </div>

        <p className="aurora-composer__hint">
          Enter to send · Shift + Enter for new line
        </p>
      </form>
    </div>
  );
}