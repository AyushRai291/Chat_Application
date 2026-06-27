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
  else if (lastMessage.attachments?.length) preview = "📎 Attachment";
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
  const time =
    formatTime(conversation?.lastMessage?.createdAt) ||
    formatTime(conversation?.updatedAt);

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
      className="aurora-conv"
      data-active={isActive ? "true" : undefined}
      onClick={onClick}
      aria-label={`Open conversation with ${name}`}
      aria-current={isActive ? "page" : undefined}
    >
      {isSelf ? (
        <div className="aurora-conv__saved" aria-hidden="true">
          🔖
        </div>
      ) : (
        <Avatar name={name} src={avatar} size="md" online={isOnline} />
      )}

      <div className="aurora-conv__body">
        <div className="aurora-conv__top">
          <span className="aurora-conv__name">{name}</span>

          {time && <span className="aurora-conv__time">{time}</span>}
        </div>

        <div className="aurora-conv__bottom">
          <p className="aurora-conv__preview">{preview}</p>
        </div>
      </div>
    </button>
  );
}