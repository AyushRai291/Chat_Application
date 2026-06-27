import React from "react";
import Avatar from "../ui/Avatar";

function formatTime(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusLabel({ status }) {
  const map = {
    read: "✓✓",
    delivered: "✓✓",
    sent: "✓",
  };

  const colorMap = {
    read: "var(--accent-secondary)",
    delivered: "var(--text-muted)",
    sent: "var(--text-muted)",
  };

  return (
    <span
      style={{
        color: colorMap[status] || "var(--text-muted)",
        fontSize: "0.72rem",
        marginLeft: "3px",
      }}
    >
      {map[status] || "✓"}
    </span>
  );
}

function AttachmentView({ attachment }) {
  const fileType = attachment.fileType || "";
  const url = attachment.url;
  const name = attachment.fileName || "Attachment";

  if (!url) return null;

  if (fileType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={name}
          style={{
            display: "block",
            maxWidth: "240px",
            maxHeight: "220px",
            borderRadius: "var(--radius-md)",
            marginTop: "8px",
            objectFit: "cover",
          }}
        />
      </a>
    );
  }

  if (fileType.startsWith("video/")) {
    return (
      <video
        src={url}
        controls
        style={{
          display: "block",
          maxWidth: "260px",
          borderRadius: "var(--radius-md)",
          marginTop: "8px",
        }}
      />
    );
  }

  if (fileType.startsWith("audio/")) {
    return (
      <audio
        src={url}
        controls
        style={{
          display: "block",
          maxWidth: "260px",
          marginTop: "8px",
        }}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-flex",
        marginTop: "8px",
        color: "var(--accent-secondary)",
        fontSize: "0.82rem",
        wordBreak: "break-word",
      }}
    >
      📎 {name}
    </a>
  );
}

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const isDeleted = Boolean(message.deletedForEveryone);
  const senderName = message.sender?.name || message.sender?.email || "Unknown";
  const text = isDeleted
    ? "This message was deleted"
    : message.text || "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isOwn ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: "8px",
        marginBottom: "4px",
      }}
    >
      {!isOwn && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && (
            <Avatar
              name={senderName}
              src={message.sender?.avatar}
              size="xs"
            />
          )}
        </div>
      )}

      <div
        style={{
          maxWidth: "min(65%, 520px)",
          display: "flex",
          flexDirection: "column",
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {!isOwn && showAvatar && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--accent-secondary)",
              fontWeight: 600,
              marginBottom: "4px",
              paddingLeft: "4px",
            }}
          >
            {senderName}
          </span>
        )}

        {message.replyTo && !isDeleted && (
          <div
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
              borderLeft: "3px solid var(--accent-primary)",
              borderRadius: "var(--radius-md)",
              padding: "6px 10px",
              marginBottom: "4px",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                color: "var(--accent-secondary)",
                fontWeight: 600,
                display: "block",
                marginBottom: "2px",
              }}
            >
              {message.replyTo.sender?.name ||
                message.replyTo.sender?.email ||
                "Unknown"}
            </span>

            <span
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {message.replyTo.deletedForEveryone
                ? "Message was deleted"
                : message.replyTo.text || "Attachment"}
            </span>
          </div>
        )}

        <div
          role="article"
          aria-label={`Message from ${senderName}`}
          style={{
            background: isOwn
              ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(6,182,212,0.18))"
              : "var(--bg-elevated)",
            border: `1px solid ${
              isOwn ? "rgba(139,92,246,0.3)" : "var(--border-subtle)"
            }`,
            borderRadius: isOwn
              ? "var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)"
              : "var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)",
            padding: "10px 14px",
            fontSize: "0.875rem",
            lineHeight: 1.55,
            color: isDeleted ? "var(--text-muted)" : "var(--text-primary)",
            fontStyle: isDeleted ? "italic" : "normal",
            wordBreak: "break-word",
          }}
        >
          {text}

          {message.isEdited && !isDeleted && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                marginLeft: "6px",
              }}
            >
              (edited)
            </span>
          )}

          {!isDeleted &&
            message.attachments?.map((attachment) => (
              <AttachmentView
                key={attachment.publicId || attachment.url}
                attachment={attachment}
              />
            ))}
        </div>

        {message.reactions?.length > 0 && !isDeleted && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              marginTop: "4px",
            }}
          >
            {message.reactions.map((reaction) => (
              <span
                key={`${reaction.user?._id || reaction.user}-${reaction.emoji}`}
                style={{
                  background: "var(--bg-overlay)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-full)",
                  padding: "1px 7px",
                  fontSize: "0.75rem",
                }}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginTop: "4px",
            paddingInline: "4px",
          }}
        >
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {formatTime(message.createdAt)}
          </span>

          {isOwn && <StatusLabel status={message.status} />}
        </div>
      </div>
    </div>
  );
}