import React, {
  createContext,
  useContext,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useChatSocket } from "./chat/useChatSocket";
import { useConversationActions } from "./chat/useConversationActions";
import { useMessageActions } from "./chat/useMessageActions";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const currentUserId = user?._id;

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyTarget, setReplyTargetState] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());
  const [unreadCountsByConversation, setUnreadCountsByConversation] = useState(
    {},
  );

  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsersByConversation, setTypingUsersByConversation] = useState(
    {},
  );

  const [error, setError] = useState(null);

  const selectedConvRef = useRef(null);
  const conversationsRef = useRef([]);
  const onlineIdsRef = useRef(new Set());
  const reloadingConversationsRef = useRef(false);
  const pendingReceiptsRef = useRef(new Map());
  const messageCacheRef = useRef(new Map());
  const incomingNotifyKeysRef = useRef(new Set());
  const lastSoundAtRef = useRef(0);
  const playIncomingSoundRef = useRef(() => {});
  const loadedUnreadSnapshotRef = useRef("");

  selectedConvRef.current = selectedConversation;
  conversationsRef.current = conversations;
  onlineIdsRef.current = onlineUserIds;

  const {
    clearUnreadCount,
    createDirectConversation,
    createGroupConversation,
    createSavedConversation,
    deleteConversationForMe,
    leaveGroupConversation,
    loadConversations,
    markConversationRead,
    notifyIncomingMessage,
    reloadConversationsOnce,
    removeConversationForCurrentUser,
    selectConversation,
    updateConversationLastMessage,
    updatePresenceEverywhere,
  } = useConversationActions({
    currentUserId,
    selectedConvRef,
    onlineIdsRef,
    messageCacheRef,
    reloadingConversationsRef,
    incomingNotifyKeysRef,
    lastSoundAtRef,
    playIncomingSoundRef,
    loadedUnreadSnapshotRef,
    setOnlineUserIds,
    setConversations,
    setSelectedConversation,
    setMessages,
    setReplyTargetState,
    setSelectedMessageIds,
    setUnreadCountsByConversation,
    setLoadingConversations,
    setLoadingMessages,
    setError,
    setTypingUsersByConversation,
  });

  const {
    clearReplyTarget,
    clearSelectedMessages,
    deleteMessageForEveryone,
    deleteMessageForMe,
    deleteSelectedMessagesForEveryone,
    deleteSelectedMessagesForMe,
    editMessage,
    patchMessageEverywhere,
    removeMessageForCurrentUser,
    sendMessage,
    setReplyTarget,
    startTyping,
    stopTyping,
    toggleMessageSelection,
    toggleReaction,
  } = useMessageActions({
    user,
    replyTarget,
    selectedMessageIds,
    selectedConvRef,
    pendingReceiptsRef,
    messageCacheRef,
    setMessages,
    setConversations,
    setSelectedConversation,
    setReplyTargetState,
    setSelectedMessageIds,
    setSendingMessage,
    setError,
    updateConversationLastMessage,
  });

  useChatSocket({
    currentUserId,
    selectedConvRef,
    conversationsRef,
    onlineIdsRef,
    pendingReceiptsRef,
    messageCacheRef,

    setSocketConnected,
    setMessages,
    setConversations,
    setSelectedConversation,
    setReplyTargetState,
    setTypingUsersByConversation,

    markConversationRead,
    notifyIncomingMessage,
    patchMessageEverywhere,
    reloadConversationsOnce,
    removeConversationForCurrentUser,
    removeMessageForCurrentUser,
    updateConversationLastMessage,
    updatePresenceEverywhere,
  });

  return (
    <ChatContext.Provider
      value={{
        conversations,
        selectedConversation,
        messages,
        replyTarget,
        selectedMessageIds,
        selectedMessageCount: selectedMessageIds.size,
        unreadCountsByConversation,

        loadingConversations,
        loadingMessages,
        sendingMessage,
        socketConnected,
        onlineUserIds,
        typingUsersByConversation,
        error,

        loadConversations,
        selectConversation,
        createSavedConversation,
        createDirectConversation,
        createGroupConversation,
        leaveGroupConversation,
        deleteConversationForMe,

        sendMessage,
        editMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        toggleReaction,

        setReplyTarget,
        clearReplyTarget,

        toggleMessageSelection,
        clearSelectedMessages,
        deleteSelectedMessagesForMe,
        deleteSelectedMessagesForEveryone,

        clearUnreadCount,
        startTyping,
        stopTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
