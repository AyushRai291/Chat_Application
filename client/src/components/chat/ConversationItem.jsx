import React from "react";
import Avatar from "../ui/Avatar";
import { useChat } from "../../context/ChatContext";

const getId = (value) => String(value?._id || value || "");
const PREVIEW_LIMIT = 72;

function trimPreview(value, fallback = "") {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return fallback;
  if (clean.length <= PREVIEW_LIMIT) return clean;

  return `${clean.slice(0, PREVIEW_LIMIT - 3)}...`;
}

const getOtherParticipant = (conversation, currentUserId) => {
  if (!conversation?.participants?.length) return null;

  return conversation.participants.find(
    (participant) => getId(participant) !== getId(currentUserId)
  );
};

export function getConvName(conversation, currentUserId) {
  if (!conversation) return "Unknown";

  if (conversation.isSelf) return "Saved Messages";

  if (conversation.isGroup) return conversation.groupName || "Group";

  const other = getOtherParticipant(conversation, currentUserId);

  return other?.name || other?.email || "Unknown User";
}

export function getConvAvatar(conversation, currentUserId) {
  if (!conversation) return null;

  if (conversation.isSelf) return null;

  if (conversation.isGroup) return conversation.groupAvatar || null;

  const other = getOtherParticipant(conversation, currentUserId);

  return other?.avatar || null;
}

export function getConvOnline(conversation, currentUserId) {
  if (!conversation || conversation.isSelf || conversation.isGroup) {
    return undefined;
  }

  const other = getOtherParticipant(conversation, currentUserId);

  return Boolean(other?.isOnline);
}

function getLastPreview(conversation, currentUserId) {
  const lastMessage = conversation?.lastMessage;

  if (!lastMessage) return "No messages yet";
  if (typeof lastMessage === "string") return trimPreview(lastMessage);

  const isOwn = getId(lastMessage.sender) === getId(currentUserId);
  let preview = "";

  if (lastMessage.deletedForEveryone) preview = "Message deleted";
  else if (lastMessage.attachments?.length) preview = "\u{1F4CE} Attachment";
  else if (lastMessage.text) preview = trimPreview(lastMessage.text);

  if (!preview) return "";

  return isOwn ? `You: ${preview}` : preview;
}

function formatTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now - date;

  if (diff < 86400000) {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (diff < 604800000) {
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
    });
  }

  return date.toLocaleDateString("en-IN", {
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
  const { onlineUserIds } = useChat();

  const name = getConvName(conversation, currentUserId);
  const avatar = getConvAvatar(conversation, currentUserId);
  const preview = getLastPreview(conversation, currentUserId);
  const time = formatTime(conversation?.updatedAt);
  const isSelf = Boolean(conversation?.isSelf);

  const otherParticipant =
    !isSelf && !conversation?.isGroup
      ? getOtherParticipant(conversation, currentUserId)
      : null;

  const isOnline = otherParticipant
    ? onlineUserIds.has(getId(otherParticipant))
    : undefined;

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
        position: "relative",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
        boxShadow: isActive
          ? "inset 3px 0 0 var(--accent-primary), 0 0 12px var(--accent-glow)"
          : "none",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      {isSelf ? (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-full)",
            background: "var(--accent-gradient)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
          }}
        >
          🔖
        </div>
      ) : (
        <Avatar name={name} src={avatar} size="md" online={isOnline} />
      )}

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
