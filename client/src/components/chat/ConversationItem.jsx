import React from "react";
import Avatar from "../ui/Avatar";

const getId = (value) => {
  if (!value) return "";
  return String(value._id || value);
};

const getOtherParticipant = (conv, currentUserId) => {
  if (!conv?.participants?.length) return null;

  return conv.participants.find(
    (participant) => getId(participant) !== String(currentUserId)
  );
};

export function getConvName(conv, currentUserId) {
  if (!conv) return "Unknown";

  if (conv.isSelf) return "Saved Messages";

  if (conv.isGroup) return conv.groupName || "Group";

  const other = getOtherParticipant(conv, currentUserId);
  return other?.name || other?.email || "Unknown User";
}

export function getConvAvatar(conv, currentUserId) {
  if (!conv) return null;

  if (conv.isSelf) return null;

  if (conv.isGroup) return conv.groupAvatar || null;

  const other = getOtherParticipant(conv, currentUserId);
  return other?.avatar || null;
}

export function getConvOnline(conv, currentUserId) {
  if (!conv || conv.isSelf || conv.isGroup) return undefined;

  const other = getOtherParticipant(conv, currentUserId);
  return Boolean(other?.isOnline);
}

function getLastPreview(conv) {
  const lm = conv?.lastMessage;

  if (!lm) return "No messages yet";
  if (lm.deletedForEveryone) return "Message was deleted";
  if (lm.text) return lm.text;
  if (lm.attachments?.length) {
    return `📎 ${lm.attachments[0].fileName || "Attachment"}`;
  }

  return "";
}

function formatTime(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diff = now - d;

  if (diff < 86400000) {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (diff < 604800000) {
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
    });
  }

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  currentUserId,
}) {
  const name = getConvName(conversation, currentUserId);
  const avatar = getConvAvatar(conversation, currentUserId);
  const preview = getLastPreview(conversation);
  const time = formatTime(conversation?.updatedAt);
  const online = getConvOnline(conversation, currentUserId);
  const isSelf = conversation?.isSelf;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open conversation with ${name}`}
      aria-current={isActive ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "var(--radius-lg)",
        background: isActive ? "var(--bg-active)" : "transparent",
        border: `1px solid ${
          isActive ? "var(--border-accent)" : "transparent"
        }`,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
        boxShadow: isActive ? "0 0 12px var(--accent-glow)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        {isSelf ? (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-full)",
              background: "var(--accent-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            🔖
          </div>
        ) : (
          <Avatar name={name} src={avatar} size="md" online={online} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
          }}
        >
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>

          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {time}
          </span>
        </div>

        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginTop: "2px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {preview}
        </p>
      </div>
    </button>
  );
}