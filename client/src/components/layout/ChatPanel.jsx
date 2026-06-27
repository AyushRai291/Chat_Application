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
      <main className="aurora-chat-empty">
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
    <main aria-label="Chat area" className="aurora-chat">
      <header className="aurora-chat__header">
        <Avatar
          name={convName}
          src={convAvatar}
          size="md"
          online={selectedConversation.isSelf ? undefined : isOnline}
        />

        <div className="aurora-chat__title-wrap">
          <p className="aurora-chat__title">{convName}</p>

          <p
            className="aurora-chat__sub"
            data-online={!typingLabel && isOnline ? "true" : undefined}
            data-typing={typingLabel ? "true" : undefined}
          >
            {subText}
          </p>
        </div>

        <div className="aurora-chat__header-actions">
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
        className="aurora-chat__messages"
        ref={messageListRef}
        onScroll={handleMessageScroll}
      >
        <div className="aurora-chat__messages-inner">
          {error && (
            <div className="aurora-chat__error" role="alert">
              {error}
            </div>
          )}

          {loadingMessages && (
            <div className="aurora-chat__center">
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
              const groupGap = startsNewDay
                ? "6px"
                : isGroupStart
                ? "12px"
                : "2px";
              const showAvatar = !isOwn && isGroupStart;

              return (
                <React.Fragment key={message._id}>
                  {startsNewDay && (
                    <DateSeparator
                      label={formatDateSeparator(message.createdAt)}
                    />
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
      </div>

      {showNewMessages && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="aurora-new-messages"
        >
          New messages
        </button>
      )}

      {typingLabel && (
        <div className="aurora-typing" aria-live="polite" aria-label={typingLabel}>
          <TypingDots />
          <span className="aurora-typing__text">{typingLabel}</span>
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
    <div className="aurora-date" aria-label={label}>
      <span className="aurora-date__line" />
      <span className="aurora-date__text">{label}</span>
      <span className="aurora-date__line" />
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
    <div className="aurora-chat__selection">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="aurora-chat__selection-close"
      >
        ✕
      </button>

      <span className="aurora-chat__selection-text">{count} selected</span>

      <button
        type="button"
        onClick={onDeleteForMe}
        className="aurora-chat__danger-btn"
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
        className="aurora-chat__danger-btn"
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
      data-active={active ? "true" : undefined}
      className="aurora-chat__icon-btn"
      {...props}
    >
      {children}
    </button>
  );
}