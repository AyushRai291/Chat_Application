import React, { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import MessageBubble from "../chat/MessageBubble";
import Composer from "../chat/Composer";
import EmptyState from "../ui/EmptyState";
import Spinner from "../ui/Spinner";
import Avatar from "../ui/Avatar";
import {
  getConvAvatar,
  getConvName,
  getConvOnline,
} from "../chat/ConversationItem";

const getId = (value) => String(value?._id || value || "");

export default function ChatPanel({ onInfoToggle, showInfoPanel }) {
  const { user } = useAuth();
  const { selectedConversation, messages, loadingMessages, error } = useChat();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedConversation) {
    return (
      <main style={s.emptyWrap}>
        <EmptyState
          icon="✦"
          title="Welcome to Aurora"
          description="Select a conversation or start a new one."
        />
      </main>
    );
  }

  const convName = getConvName(selectedConversation, user?._id);
  const convAvatar = getConvAvatar(selectedConversation, user?._id);
  const isOnline = getConvOnline(selectedConversation, user?._id);

  return (
    <main aria-label="Chat area" style={s.wrap}>
      <header style={s.header}>
        <Avatar
          name={convName}
          src={convAvatar}
          size="md"
          online={selectedConversation.isSelf ? undefined : isOnline}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "var(--text-primary)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {convName}
          </p>

          <p
            style={{
              fontSize: "0.75rem",
              color: isOnline ? "var(--status-online)" : "var(--text-muted)",
            }}
          >
            {selectedConversation.isSelf
              ? "Your personal space"
              : selectedConversation.isGroup
              ? `${selectedConversation.participants?.length || 0} members`
              : isOnline
              ? "● Online"
              : "○ Offline"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <HeaderBtn
            aria-label={showInfoPanel ? "Close info panel" : "Open info panel"}
            title="Info"
            onClick={onInfoToggle}
            active={showInfoPanel}
          >
            ℹ
          </HeaderBtn>
        </div>
      </header>

      <div
        role="log"
        aria-label="Messages"
        aria-live="polite"
        style={s.messageList}
      >
        {error && (
          <div style={s.errorBanner} role="alert">
            {error}
          </div>
        )}

        {loadingMessages && (
          <div style={s.center}>
            <Spinner size={24} />
          </div>
        )}

        {!loadingMessages && messages.length === 0 && (
          <EmptyState
            icon="💬"
            title="No messages yet"
            description="Send the first message!"
          />
        )}

        {!loadingMessages &&
          messages.map((msg, index) => {
            const isOwn = getId(msg.sender) === getId(user);
            const prev = messages[index - 1];

            const prevSenderId = getId(prev?.sender);
            const curSenderId = getId(msg.sender);

            const showAvatar = !isOwn && prevSenderId !== curSenderId;

            return (
              <MessageBubble
                key={msg._id}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            );
          })}

        <div ref={endRef} />
      </div>

      <Composer />
    </main>
  );
}

function HeaderBtn({ children, onClick, active, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...props}
      style={{
        background: active ? "var(--bg-active)" : "transparent",
        border: `1px solid ${
          active ? "var(--border-accent)" : "transparent"
        }`,
        borderRadius: "var(--radius-md)",
        width: 36,
        height: 36,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.95rem",
        color: "var(--text-secondary)",
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active
          ? "var(--bg-active)"
          : "transparent";
      }}
    >
      {children}
    </button>
  );
}

const s = {
  wrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-base)",
    minWidth: 0,
    overflow: "hidden",
  },
  emptyWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-base)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 20px",
    height: "64px",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
    flexShrink: 0,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    padding: "40px",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    fontSize: "0.82rem",
    color: "var(--status-error)",
    marginBottom: "12px",
  },
};