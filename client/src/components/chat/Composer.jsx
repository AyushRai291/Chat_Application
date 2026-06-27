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

  const handleChange = (e) => {
    const value = e.target.value;
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

    clearStopTimer();
    emitStop();

    const message = await sendMessage({
      text: cleanText,
      replyTo: replyTarget?._id || null,
    });

    if (message) {
      setText("");
      clearReplyTarget();
      textareaRef.current?.focus();
      requestAnimationFrame(resizeTextarea);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBlur = () => {
    clearStopTimer();
    emitStop();
  };

  if (!selectedConversation) return null;

  return (
    <div
      style={{
        padding: "12px 20px 16px",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
      }}
    >
      {replyTarget && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
            padding: "8px 10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderLeft: "3px solid var(--accent-primary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: "var(--accent-secondary)",
                fontSize: "0.76rem",
                fontWeight: 700,
                marginBottom: "2px",
              }}
            >
              {getSenderName(replyTarget.sender)}
            </p>

            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {getReplyPreview(replyTarget)}
            </p>
          </div>

          <button
            type="button"
            onClick={clearReplyTarget}
            aria-label="Cancel reply"
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-full)",
              color: "var(--text-muted)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: "0.8rem",
              height: 24,
              lineHeight: 1,
              width: 24,
            }}
          >
            x
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "10px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          padding: "8px 8px 8px 16px",
          transition: "border-color 0.15s",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--border-accent)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Message..."
          aria-label="Type a message"
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            resize: "none",
            lineHeight: 1.5,
            padding: "4px 0",
            maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
            overflowY: "hidden",
            alignSelf: "center",
            fontFamily: "var(--font-sans)",
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sendingMessage}
          aria-label="Send message"
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--radius-full)",
            background:
              text.trim() && !sendingMessage
                ? "var(--accent-gradient)"
                : "var(--bg-overlay)",
            border: "none",
            cursor: text.trim() && !sendingMessage ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
            flexShrink: 0,
            transition: "background 0.2s, box-shadow 0.2s",
            boxShadow: text.trim() ? "0 2px 10px var(--accent-glow)" : "none",
            color: "#fff",
          }}
        >
          {sendingMessage ? <Spinner size={16} color="#fff" /> : "\u27A4"}
        </button>
      </div>

    </div>
  );
}
