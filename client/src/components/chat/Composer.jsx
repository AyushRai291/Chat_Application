import React, { useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";
import Spinner from "../ui/Spinner";

export default function Composer() {
  const { sendMessage, sendingMessage, selectedConversation } = useChat();
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  const handleSend = async () => {
    const cleanText = text.trim();

    if (!cleanText || sendingMessage || !selectedConversation) return;

    const message = await sendMessage({
      text: cleanText,
    });

    if (message) {
      setText("");
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
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