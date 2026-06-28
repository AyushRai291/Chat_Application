export const MESSAGE_REACTION_EMOJIS = [
  "\uD83D\uDC4D",
  "\u2764\uFE0F",
  "\uD83D\uDE02",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
];

const PREVIEW_LIMIT = 88;

export const getId = (value) => String(value?._id || value || "");

export function trimPreview(value, fallback = "") {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return fallback;
  if (clean.length <= PREVIEW_LIMIT) return clean;

  return `${clean.slice(0, PREVIEW_LIMIT - 3)}...`;
}

export function getSenderName(sender) {
  return sender?.name || sender?.email || "Unknown";
}

export function getReplyPreview(message) {
  if (!message) return "";
  if (message.deletedForEveryone) return "Message deleted";
  if (message.text) return trimPreview(message.text);
  if (message.attachments?.length) return "Attachment";
  return "Message";
}

export function getBubbleRadius(isOwn, isGroupStart, isGroupEnd) {
  const xl = "var(--radius-xl)";
  const md = "var(--radius-md)";
  const sm = "var(--radius-sm)";

  if (isOwn) {
    if (isGroupStart && isGroupEnd) return `${xl} ${xl} ${sm} ${xl}`;
    if (isGroupStart) return `${xl} ${xl} ${md} ${xl}`;
    if (isGroupEnd) return `${xl} ${md} ${sm} ${xl}`;
    return `${xl} ${md} ${md} ${xl}`;
  }

  if (isGroupStart && isGroupEnd) return `${xl} ${xl} ${xl} ${sm}`;
  if (isGroupStart) return `${xl} ${xl} ${xl} ${md}`;
  if (isGroupEnd) return `${md} ${xl} ${xl} ${sm}`;
  return `${md} ${xl} ${xl} ${md}`;
}

export function getReactionCounts(reactions = []) {
  const counts = new Map();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  });

  return Array.from(counts, ([emoji, count]) => ({ emoji, count }));
}

export function formatMessageTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getAttachmentUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}
