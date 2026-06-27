import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import MessageBubble from "../chat/MessageBubble";
import Composer from "../chat/Composer";
import EmptyState from "../ui/EmptyState";
import Spinner from "../ui/Spinner";
import Avatar from "../ui/Avatar";
import { getConvAvatar, getConvName } from "../chat/ConversationItem";
import ConfirmDialog from "../ui/ConfirmDialog";

const getId = (value) => String(value?._id || value || "");
const NEAR_BOTTOM_PX = 140;
const DAY_MS = 24 * 60 * 60 * 1000;

const toValidDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameMessageDay = (a, b) => {
  const first = toValidDate(a?.createdAt);
  const second = toValidDate(b?.createdAt);

  if (!first || !second) return false;

  return startOfDay(first).getTime() === startOfDay(second).getTime();
};

const formatDateSeparator = (dateStr) => {
  const date = toValidDate(dateStr);
  if (!date) return "";

  const today = startOfDay(new Date());
  const messageDay = startOfDay(date);
  const diffDays = Math.floor(
    (today.getTime() - messageDay.getTime()) / DAY_MS
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ChatPanel({ onInfoToggle, showInfoPanel }) {
  const { user } = useAuth();

  const {
    selectedConversation,
    messages,
    loadingMessages,
    error,
    onlineUserIds,
    typingUsersByConversation,

    selectedMessageIds,
    selectedMessageCount,
    clearSelectedMessages,
    deleteSelectedMessagesForMe,
    deleteSelectedMessagesForEveryone,
  } = useChat();

  const [showNewMessages, setShowNewMessages] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const messageListRef = useRef(null);
  const endRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const forceScrollRef = useRef(true);
  const lastMessageIdRef = useRef("");
  const messageCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const list = messageListRef.current;

    if (list) {
      list.scrollTo({ top: list.scrollHeight, behavior });
      isNearBottomRef.current = true;
    } else {
      endRef.current?.scrollIntoView({ behavior });
    }

    setShowNewMessages(false);
  }, []);

  const handleMessageScroll = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return;

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    const isNearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;

    isNearBottomRef.current = isNearBottom;

    if (isNearBottom) {
      setShowNewMessages(false);
    }
  }, []);

  useEffect(() => {
    forceScrollRef.current = true;
    isNearBottomRef.current = true;
    lastMessageIdRef.current = "";
    messageCountRef.current = 0;
    setShowNewMessages(false);
  }, [selectedConversation?._id]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list || loadingMessages) return;

    const latestMessage = messages[messages.length - 1];
    const latestId = getId(latestMessage);
    const previousLatestId = lastMessageIdRef.current;
    const previousCount = messageCountRef.current;
    const appended =
      messages.length > previousCount &&
      Boolean(latestId) &&
      latestId !== previousLatestId;
    const ownLatest = getId(latestMessage?.sender) === getId(user);

    if (
      forceScrollRef.current ||
      (appended && (ownLatest || isNearBottomRef.current))
    ) {
      scrollToBottom(forceScrollRef.current ? "auto" : "smooth");
      forceScrollRef.current = false;
    } else if (appended) {
      setShowNewMessages(true);
    }

    lastMessageIdRef.current = latestId;
    messageCountRef.current = messages.length;
  }, [loadingMessages, messages, scrollToBottom, user]);

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

  const otherParticipant =
    !selectedConversation.isSelf && !selectedConversation.isGroup
      ? selectedConversation.participants?.find(
          (participant) => getId(participant) !== getId(user)
        )
      : null;

  const isOnline = otherParticipant
    ? onlineUserIds.has(getId(otherParticipant))
    : false;

  const typingUsers = (
    typingUsersByConversation[selectedConversation._id] || []
  ).filter((typingUser) => getId(typingUser) !== getId(user));

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].name || typingUsers[0].email || "Someone"} is typing…`
      : typingUsers.length > 1
      ? "Several people are typing…"
      : null;

  const subText = selectedConversation.isSelf
    ? "Your personal space"
    : typingLabel
    ? typingLabel
    : selectedConversation.isGroup
    ? `${selectedConversation.participants?.length || 0} members`
    : isOnline
    ? "● Online"
    : "○ Offline";

  const selectedMessages = messages.filter((message) =>
    selectedMessageIds.has(getId(message))
  );

  const canDeleteSelectedForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (message) =>
        getId(message.sender) === getId(user) && !message.deletedForEveryone
    );

  const handleDeleteSelectedForMe = () => {
    if (selectedMessageCount === 0) return;

    setConfirmAction({
      type: "delete-selected-me",
      title: `Delete ${selectedMessageCount} selected message${
        selectedMessageCount > 1 ? "s" : ""
      } for you?`,
      description:
        "Selected messages will be removed only from your chat. Other users will not be affected.",
      confirmText: "Delete",
    });
  };

  const handleDeleteSelectedForEveryone = () => {
    if (!canDeleteSelectedForEveryone) return;

    setConfirmAction({
      type: "delete-selected-everyone",
      title: `Delete ${selectedMessageCount} selected message${
        selectedMessageCount > 1 ? "s" : ""
      } for everyone?`,
      description:
        "Selected messages will be deleted for everyone. This action cannot be undone.",
      confirmText: "Delete",
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || confirmBusy) return;

    setConfirmBusy(true);

    try {
      if (confirmAction.type === "delete-selected-me") {
        await deleteSelectedMessagesForMe();
      }

      if (confirmAction.type === "delete-selected-everyone") {
        await deleteSelectedMessagesForEveryone();
      }

      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

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
              color: typingLabel
                ? "var(--accent-secondary)"
                : isOnline
                ? "var(--status-online)"
                : "var(--text-muted)",
              transition: "color 0.2s",
            }}
          >
            {subText}
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

      {selectedMessageCount > 0 && (
        <SelectionToolbar
          count={selectedMessageCount}
          canDeleteForEveryone={canDeleteSelectedForEveryone}
          onCancel={clearSelectedMessages}
          onDeleteForMe={handleDeleteSelectedForMe}
          onDeleteForEveryone={handleDeleteSelectedForEveryone}
        />
      )}

      <div
        role="log"
        aria-label="Messages"
        aria-live="polite"
        style={s.messageList}
        ref={messageListRef}
        onScroll={handleMessageScroll}
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
          messages.map((message, index) => {
            const senderId = getId(message.sender);
            const isOwn = senderId === getId(user);

            const prev = messages[index - 1];
            const next = messages[index + 1];
            const prevSenderId = getId(prev?.sender);
            const nextSenderId = getId(next?.sender);
            const startsNewDay = !prev || !isSameMessageDay(prev, message);
            const endsCurrentDay = !next || !isSameMessageDay(message, next);
            const isGroupStart =
              startsNewDay || !prev || prevSenderId !== senderId;
            const isGroupEnd =
              endsCurrentDay || !next || nextSenderId !== senderId;
            const groupGap = startsNewDay ? "6px" : isGroupStart ? "12px" : "2px";
            const showAvatar = !isOwn && isGroupStart;

            return (
              <React.Fragment key={message._id}>
                {startsNewDay && (
                  <DateSeparator label={formatDateSeparator(message.createdAt)} />
                )}

                <MessageBubble
                  message={message}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  showSenderName={
                    !isOwn && selectedConversation.isGroup && isGroupStart
                  }
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                  groupGap={groupGap}
                />
              </React.Fragment>
            );
          })}

        <div ref={endRef} />
      </div>

      {showNewMessages && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          style={s.newMessagesButton}
        >
          New messages
        </button>
      )}

      {typingLabel && (
        <div style={s.typingBar} aria-live="polite" aria-label={typingLabel}>
          <TypingDots />
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            {typingLabel}
          </span>
        </div>
      )}

      <Composer />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmText={confirmAction?.confirmText}
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        onConfirm={handleConfirmAction}
      />
    </main>
  );
}

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes aurora-bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }

          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .aurora-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-primary);
          margin-right: 3px;
          animation: aurora-bounce 1.2s infinite ease-in-out;
        }

        .aurora-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .aurora-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `}</style>

      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <span className="aurora-dot" />
        <span className="aurora-dot" />
        <span className="aurora-dot" />
      </span>
    </>
  );
}

function DateSeparator({ label }) {
  if (!label) return null;

  return (
    <div style={s.dateSeparator} aria-label={label}>
      <span style={s.dateSeparatorLine} />
      <span style={s.dateSeparatorText}>{label}</span>
      <span style={s.dateSeparatorLine} />
    </div>
  );
}

function SelectionToolbar({
  count,
  canDeleteForEveryone,
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  return (
    <div style={s.selectionToolbar}>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        style={s.selectionCloseButton}
      >
        ✕
      </button>

      <span style={s.selectionText}>{count} selected</span>

      <button
        type="button"
        onClick={onDeleteForMe}
        style={s.selectionDangerBtn}
      >
        Delete for me
      </button>

      <button
        type="button"
        onClick={onDeleteForEveryone}
        disabled={!canDeleteForEveryone}
        title={
          canDeleteForEveryone
            ? "Delete selected messages for everyone"
            : "Only your non-deleted messages can be deleted for everyone"
        }
        style={{
          ...s.selectionDangerBtn,
          background: canDeleteForEveryone
            ? "rgba(239,68,68,0.14)"
            : "rgba(148,163,184,0.08)",
          color: canDeleteForEveryone
            ? "var(--status-error)"
            : "var(--text-muted)",
          cursor: canDeleteForEveryone ? "pointer" : "not-allowed",
          opacity: canDeleteForEveryone ? 1 : 0.65,
        }}
      >
        Delete for everyone
      </button>
    </div>
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
        border: `1px solid ${active ? "var(--border-accent)" : "transparent"}`,
        borderRadius: "var(--radius-md)",
        width: 36,
        height: 36,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "var(--accent-secondary)" : "var(--text-muted)",
        fontSize: "0.95rem",
      }}
    >
      {children}
    </button>
  );
}

const s = {
  emptyWrap: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, rgba(139,92,246,0.1), transparent 28%), var(--bg-base)",
  },

  wrap: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background:
      "radial-gradient(circle at 35% 0%, rgba(139,92,246,0.08), transparent 30%), var(--bg-base)",
  },

  header: {
    height: 72,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 20px",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
  },

  selectionToolbar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-subtle)",
    background:
      "linear-gradient(135deg, rgba(139,92,246,0.14), rgba(6,182,212,0.08))",
    flexShrink: 0,
  },

  selectionCloseButton: {
    width: 30,
    height: 30,
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-overlay)",
    color: "var(--text-secondary)",
    cursor: "pointer",
  },

  selectionText: {
    flex: 1,
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    fontWeight: 700,
  },

  selectionDangerBtn: {
    border: "1px solid rgba(239,68,68,0.3)",
    background: "rgba(239,68,68,0.1)",
    color: "var(--status-error)",
    borderRadius: "var(--radius-md)",
    padding: "7px 10px",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 700,
    fontFamily: "var(--font-sans)",
  },

  messageList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: "18px 20px 20px",
  },

  center: {
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  errorBanner: {
    margin: "0 auto 12px",
    maxWidth: 520,
    padding: "8px 12px",
    borderRadius: "var(--radius-md)",
    border: "1px solid rgba(239,68,68,0.25)",
    background: "rgba(239,68,68,0.1)",
    color: "var(--status-error)",
    fontSize: "0.8rem",
  },

  dateSeparator: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "16px 0 12px",
  },

  dateSeparatorLine: {
    flex: 1,
    height: 1,
    background: "var(--border-subtle)",
  },

  dateSeparatorText: {
    padding: "4px 10px",
    borderRadius: "var(--radius-full)",
    background: "var(--bg-overlay)",
    border: "1px solid var(--border-default)",
    color: "var(--text-muted)",
    fontSize: "0.7rem",
    fontWeight: 700,
  },

  newMessagesButton: {
    position: "absolute",
    left: "50%",
    bottom: 86,
    transform: "translateX(-50%)",
    border: "1px solid var(--border-accent)",
    borderRadius: "var(--radius-full)",
    background: "var(--bg-elevated)",
    color: "var(--accent-secondary)",
    padding: "7px 12px",
    cursor: "pointer",
    fontSize: "0.78rem",
    fontWeight: 700,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    zIndex: 5,
  },

  typingBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 20px",
    borderTop: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
    flexShrink: 0,
  },
};