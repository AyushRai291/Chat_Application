import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import Avatar from "../ui/Avatar";
import EmptyState from "../ui/EmptyState";
import { getConvAvatar, getConvName } from "../chat/ConversationItem";

const getId = (value) => String(value?._id || value || "");

function formatLastSeen(dateStr) {
  if (!dateStr) return "Unknown";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function InfoPanel({ onClose }) {
  const { user } = useAuth();
  const { selectedConversation } = useChat();

  if (!selectedConversation) return null;

  const conv = selectedConversation;
  const convName = getConvName(conv, user?._id);
  const convAvatar = getConvAvatar(conv, user?._id);
  const participants = conv.participants || [];

  const otherUser =
    !conv.isSelf && !conv.isGroup
      ? participants.find((p) => getId(p) !== getId(user))
      : null;

  return (
    <aside
      aria-label="Conversation info"
      style={{
        width: "var(--info-panel-width)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Info
        </span>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close info panel"
          style={{
            background: "var(--bg-overlay)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            width: 26,
            height: 26,
            cursor: "pointer",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {conv.isSelf ? (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "var(--radius-full)",
              background: "var(--accent-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              margin: "0 auto 12px",
            }}
          >
            🔖
          </div>
        ) : (
          <Avatar
            name={convName}
            src={convAvatar}
            size="xl"
            online={conv.isGroup ? undefined : Boolean(otherUser?.isOnline)}
            style={{ margin: "0 auto 12px" }}
          />
        )}

        <p
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--text-primary)",
          }}
        >
          {convName}
        </p>

        {conv.isSelf && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            Your personal saved messages
          </p>
        )}

        {!conv.isSelf && !conv.isGroup && otherUser && (
          <p
            style={{
              fontSize: "0.78rem",
              color: otherUser.isOnline
                ? "var(--status-online)"
                : "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            {otherUser.isOnline
              ? "● Online now"
              : `Last seen ${formatLastSeen(otherUser.lastSeen)}`}
          </p>
        )}

        {conv.isGroup && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            {participants.length} members
          </p>
        )}
      </div>

      {!conv.isSelf && participants.length > 0 && (
        <Section title={conv.isGroup ? "Members" : "Participants"}>
          {participants.map((participant) => {
            const id = getId(participant);
            const name = participant.name || participant.email || id;
            const isMe = id === getId(user);

            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 0",
                }}
              >
                <Avatar
                  name={name}
                  src={participant.avatar}
                  size="sm"
                  online={Boolean(participant.isOnline)}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name}
                    {isMe ? " (you)" : ""}
                  </p>

                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: participant.isOnline
                        ? "var(--status-online)"
                        : "var(--text-muted)",
                    }}
                  >
                    {participant.isOnline ? "● Online" : "○ Offline"}
                  </p>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {conv.isSelf && (
        <div style={{ flex: 1 }}>
          <EmptyState
            icon="📌"
            title="Saved Messages"
            description="Use this space to save notes, links, and files for yourself."
          />
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        padding: "16px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <p
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "12px",
        }}
      >
        {title}
      </p>

      {children}
    </div>
  );
}