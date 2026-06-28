import React, { useState } from "react";
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

function getMemberRole(conversation, participantId) {
  const id = getId(participantId);

  const roleItem = conversation.memberRoles?.find(
    (item) => getId(item.user) === id,
  );

  if (roleItem?.role === "owner") return "Owner";
  if (roleItem?.role === "admin") return "Admin";

  if (getId(conversation.admin) === id) return "Owner";

  const isAdmin = conversation.admins?.some((adminId) => getId(adminId) === id);
  if (isAdmin) return "Admin";

  return "Member";
}

function getActionCopy(conversation) {
  if (conversation.isSelf) {
    return {
      type: "delete-for-me",
      button: "Clear Saved Messages",
      title: "Clear Saved Messages?",
      desc: "This will hide this chat and remove saved messages only for you.",
      confirm: "Clear",
    };
  }

  if (conversation.isGroup) {
    return {
      type: "leave-group",
      button: "Leave group",
      title: "Leave this group?",
      desc: "You will stop receiving messages from this group. Other members will remain in the group.",
      confirm: "Leave",
    };
  }

  return {
    type: "delete-for-me",
    button: "Delete conversation",
    title: "Delete this conversation?",
    desc: "This will delete the chat only for you. The other user will still keep their messages.",
    confirm: "Delete",
  };
}

export default function InfoPanel({ onClose }) {
  const { user } = useAuth();

  const {
    selectedConversation,
    onlineUserIds,
    socketConnected,
    deleteConversationForMe,
    leaveGroupConversation,
  } = useChat();

  const [busyAction, setBusyAction] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!selectedConversation) return null;

  const conversation = selectedConversation;
  const conversationName = getConvName(conversation, user?._id);
  const conversationAvatar = getConvAvatar(conversation, user?._id);
  const participants = conversation.participants || [];
  const actionCopy = getActionCopy(conversation);

  const otherUser =
    !conversation.isSelf && !conversation.isGroup
      ? participants.find((participant) => getId(participant) !== getId(user))
      : null;

  const otherUserOnline = otherUser
    ? onlineUserIds.has(getId(otherUser))
    : false;

  const handleConfirmAction = async () => {
    if (busyAction) return;

    setBusyAction(true);

    try {
      if (actionCopy.type === "leave-group") {
        const result = await leaveGroupConversation(conversation._id);

        if (result) {
          setConfirmOpen(false);
          onClose?.();
        }

        return;
      }

      const deletedId = await deleteConversationForMe(conversation._id);

      if (deletedId) {
        setConfirmOpen(false);
        onClose?.();
      }
    } finally {
      setBusyAction(false);
    }
  };

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
        {conversation.isSelf ? (
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
            name={conversationName}
            src={conversationAvatar}
            size="xl"
            online={conversation.isGroup ? undefined : otherUserOnline}
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
          {conversationName}
        </p>

        {conversation.isSelf && (
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

        {!conversation.isSelf && !conversation.isGroup && otherUser && (
          <p
            style={{
              fontSize: "0.78rem",
              color: otherUserOnline
                ? "var(--status-online)"
                : "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            {otherUserOnline
              ? "● Online now"
              : `Last seen ${formatLastSeen(otherUser.lastSeen)}`}
          </p>
        )}

        {conversation.isGroup && (
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

      <Section title="Actions">
        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busyAction}
            aria-label={actionCopy.button}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(239,68,68,0.28)",
              background: "rgba(239,68,68,0.1)",
              color: "var(--status-error)",
              cursor: busyAction ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "0.82rem",
              fontWeight: 700,
              opacity: busyAction ? 0.65 : 1,
              textAlign: "left",
            }}
          >
            {actionCopy.button}
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-label={actionCopy.title}
            style={{
              padding: "12px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(239,68,68,0.28)",
              background:
                "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(15,23,42,0.45))",
            }}
          >
            <p
              style={{
                color: "var(--text-primary)",
                fontSize: "0.86rem",
                fontWeight: 800,
                marginBottom: "6px",
              }}
            >
              {actionCopy.title}
            </p>

            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.76rem",
                lineHeight: 1.45,
                marginBottom: "12px",
              }}
            >
              {actionCopy.desc}
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={busyAction}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.18)",
                  color: "var(--status-error)",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  opacity: busyAction ? 0.65 : 1,
                }}
              >
                {busyAction ? "Working..." : actionCopy.confirm}
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busyAction}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-overlay)",
                  color: "var(--text-secondary)",
                  cursor: busyAction ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  opacity: busyAction ? 0.65 : 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {!conversation.isSelf && participants.length > 0 && (
        <Section title={conversation.isGroup ? "Members" : "Participants"}>
          {participants.map((participant) => {
            const participantId = getId(participant);
            const participantName =
              participant.name || participant.email || participantId;

            const isMe = participantId === getId(user);
            const isOnline = isMe
              ? socketConnected
              : onlineUserIds.has(participantId);
            const role = conversation.isGroup
              ? getMemberRole(conversation, participantId)
              : "";

            return (
              <div
                key={participantId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 0",
                }}
              >
                <Avatar
                  name={participantName}
                  src={participant.avatar}
                  size="sm"
                  online={isOnline}
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
                    {participantName}
                    {isMe ? " (you)" : ""}
                  </p>

                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: isOnline
                        ? "var(--status-online)"
                        : "var(--text-muted)",
                    }}
                  >
                    {isOnline ? "● Online" : "○ Offline"}
                    {role ? ` · ${role}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {conversation.isSelf && (
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