import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";
import Spinner from "../ui/Spinner";

const TYPING_DEBOUNCE_MS = 1200;

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
              {replyTarget.sender?.name || replyTarget.sender?.email || "Unknown"}
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
              {replyTarget.deletedForEveryone
                ? "Message was deleted"
                : replyTarget.text || "Attachment"}
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
          placeholder="Message…"
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
            maxHeight: "120px",
            overflowY: "auto",
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
          {sendingMessage ? <Spinner size={16} color="#fff" /> : "➤"}
        </button>
      </div>

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          marginTop: "6px",
          paddingLeft: "4px",
        }}
      >
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
