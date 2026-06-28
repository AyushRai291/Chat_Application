import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { conversationService } from "../services/conversationService";
import { messageService } from "../services/messageService";
import { getSocket } from "../lib/socket";
import { useChatSocket } from "./chat/useChatSocket";
import {
  applyOnlineStateToConversation,
  applyOnlineStateToList,
  buildLocalMessage,
  createClientMessageId,
  getErrorMessage,
  getId,
  mergeMessageByIdOrClientId,
} from "./chat/chatHelpers";

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
  const incomingNotifyKeysRef = useRef(new Set());
  const lastSoundAtRef = useRef(0);

  selectedConvRef.current = selectedConversation;
  conversationsRef.current = conversations;
  onlineIdsRef.current = onlineUserIds;

  const updatePresenceEverywhere = useCallback((nextOnlineIds) => {
    setOnlineUserIds(nextOnlineIds);

    setConversations((prev) => applyOnlineStateToList(prev, nextOnlineIds));

    setSelectedConversation((prev) =>
      prev ? applyOnlineStateToConversation(prev, nextOnlineIds) : prev,
    );
  }, []);

  const upsertConversation = useCallback((conversation, moveTop = true) => {
    if (!conversation?._id) return;

    setConversations((prev) => {
      const withPresence = applyOnlineStateToConversation(
        conversation,
        onlineIdsRef.current,
      );

      const exists = prev.some((item) => getId(item) === getId(withPresence));

      if (!exists) return [withPresence, ...prev];

      const updated = prev.map((item) =>
        getId(item) === getId(withPresence)
          ? { ...item, ...withPresence }
          : item,
      );

      if (!moveTop) return updated;

      const target = updated.find(
        (item) => getId(item) === getId(withPresence),
      );
      const rest = updated.filter(
        (item) => getId(item) !== getId(withPresence),
      );

      return target ? [target, ...rest] : updated;
    });

    setSelectedConversation((prev) =>
      getId(prev) === getId(conversation)
        ? applyOnlineStateToConversation(
            { ...prev, ...conversation },
            onlineIdsRef.current,
          )
        : prev,
    );
  }, []);

  const updateConversationLastMessage = useCallback(
    (conversationId, message) => {
      if (!conversationId || !message?._id) return;

      const id = getId(conversationId);

      setConversations((prev) => {
        const exists = prev.find((item) => getId(item) === id);
        if (!exists) return prev;

        const updatedConversation = {
          ...exists,
          lastMessage: message,
          updatedAt: message.createdAt || exists.updatedAt,
        };

        const rest = prev.filter((item) => getId(item) !== id);
        return [updatedConversation, ...rest];
      });

      setSelectedConversation((prev) =>
        getId(prev) === id
          ? {
              ...prev,
              lastMessage: message,
              updatedAt: message.createdAt || prev.updatedAt,
            }
          : prev,
      );
    },
    [],
  );

  const patchMessageEverywhere = useCallback((messageId, updater) => {
    const id = getId(messageId);
    if (!id) return;

    const patchMessage = (message) => {
      if (!message || getId(message) !== id) return message;

      return typeof updater === "function"
        ? updater(message)
        : { ...message, ...updater };
    };

    setMessages((prev) => prev.map(patchMessage));

    setConversations((prev) =>
      prev.map((conversation) =>
        getId(conversation.lastMessage) === id
          ? {
              ...conversation,
              lastMessage: patchMessage(conversation.lastMessage),
            }
          : conversation,
      ),
    );

    setSelectedConversation((prev) =>
      getId(prev?.lastMessage) === id
        ? { ...prev, lastMessage: patchMessage(prev.lastMessage) }
        : prev,
    );

    setReplyTargetState((prev) =>
      getId(prev) === id ? patchMessage(prev) : prev,
    );
  }, []);

  const removeMessageForCurrentUser = useCallback((messageId) => {
    const id = getId(messageId);
    if (!id) return;

    setMessages((prev) => prev.filter((message) => getId(message) !== id));

    setConversations((prev) =>
      prev.map((conversation) =>
        getId(conversation.lastMessage) === id
          ? { ...conversation, lastMessage: null }
          : conversation,
      ),
    );

    setSelectedConversation((prev) =>
      getId(prev?.lastMessage) === id ? { ...prev, lastMessage: null } : prev,
    );

    setReplyTargetState((prev) => (getId(prev) === id ? null : prev));

    setSelectedMessageIds((prev) => {
      if (!prev.has(id)) return prev;

      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setReplyTarget = useCallback((message) => {
    if (!message?._id || message.deletedForEveryone) return;

    setReplyTargetState(message);
  }, []);

  const clearReplyTarget = useCallback(() => {
    setReplyTargetState(null);
  }, []);

  const toggleMessageSelection = useCallback((messageId) => {
    const id = getId(messageId);
    if (!id) return;

    setSelectedMessageIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }, []);

  const clearSelectedMessages = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const clearUnreadCount = useCallback((conversationId) => {
    const id = getId(conversationId);
    if (!id) return;

    setUnreadCountsByConversation((prev) => {
      if (!prev[id]) return prev;

      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeConversationForCurrentUser = useCallback(
    (conversationId) => {
      const id = getId(conversationId);
      if (!id) return;

      setConversations((prev) =>
        prev.filter((conversation) => getId(conversation) !== id),
      );

      setSelectedConversation((prev) => (getId(prev) === id ? null : prev));
      setMessages((prev) =>
        getId(selectedConvRef.current) === id ? [] : prev,
      );
      setReplyTargetState(null);
      setSelectedMessageIds(new Set());
      clearUnreadCount(id);

      setTypingUsersByConversation((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [clearUnreadCount],
  );

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError(null);

    try {
      const data = await conversationService.getConversations();
      const withPresence = applyOnlineStateToList(data, onlineIdsRef.current);

      setConversations(withPresence);
      return withPresence;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load conversations."));
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const reloadConversationsOnce = useCallback(async () => {
    if (reloadingConversationsRef.current) return;

    reloadingConversationsRef.current = true;

    try {
      await loadConversations();
    } finally {
      reloadingConversationsRef.current = false;
    }
  }, [loadConversations]);

  const markConversationRead = useCallback((conversationId) => {
    const id = getId(conversationId);
    const socket = getSocket();

    if (!id || !socket?.connected) return;

    socket.emit("messages:read", { conversationId: id });
  }, []);

  const playIncomingSound = useCallback(() => {
    if (typeof window === "undefined") return;

    const now = Date.now();
    if (now - lastSoundAtRef.current < 700) return;

    lastSoundAtRef.current = now;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(720, ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);

      window.setTimeout(() => {
        ctx.close().catch(() => {});
      }, 250);
    } catch {
      // browser blocked audio
    }
  }, []);

  const notifyIncomingMessage = useCallback(
    (conversationId, message) => {
      const id = getId(conversationId);

      if (!id || !message?._id) return;
      if (getId(message.sender) === getId(currentUserId)) return;
      if (getId(selectedConvRef.current) === id) return;

      const key = message.clientMessageId || getId(message);

      if (key && incomingNotifyKeysRef.current.has(key)) return;
      if (key) incomingNotifyKeysRef.current.add(key);

      setUnreadCountsByConversation((prev) => ({
        ...prev,
        [id]: (prev[id] || 0) + 1,
      }));

      playIncomingSound();
    },
    [currentUserId, playIncomingSound],
  );

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return [];

      setLoadingMessages(true);
      setMessages([]);
      setSelectedMessageIds(new Set());
      setError(null);
      clearUnreadCount(conversationId);

      try {
        const data = await messageService.getMessages(conversationId);

        setMessages(data);
        markConversationRead(conversationId);
        return data;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load messages."));
        return [];
      } finally {
        setLoadingMessages(false);
      }
    },
    [clearUnreadCount, markConversationRead],
  );

  const selectConversation = useCallback(
    async (conversation) => {
      if (!conversation?._id) return;

      setSelectedMessageIds(new Set());
      setReplyTargetState(null);

      const withPresence = applyOnlineStateToConversation(
        conversation,
        onlineIdsRef.current,
      );

      setSelectedConversation(withPresence);
      clearUnreadCount(conversation._id);

      setTypingUsersByConversation((prev) => ({
        ...prev,
        [conversation._id]: [],
      }));

      await loadMessages(conversation._id);
    },
    [clearUnreadCount, loadMessages],
  );

  const createSavedConversation = useCallback(async () => {
    setError(null);

    try {
      const conversation = await conversationService.createSaved();

      upsertConversation(conversation);
      await selectConversation(conversation);

      return conversation;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create saved messages."));
      return null;
    }
  }, [selectConversation, upsertConversation]);

  const createDirectConversation = useCallback(
    async (receiverId) => {
      if (!receiverId) return null;

      setError(null);

      try {
        const conversation = await conversationService.createDirect(receiverId);

        upsertConversation(conversation);
        await selectConversation(conversation);

        return conversation;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to start conversation."));
        return null;
      }
    },
    [selectConversation, upsertConversation],
  );
  const deleteConversationForMe = useCallback(
    async (conversationId) => {
      const id = getId(conversationId || selectedConvRef.current);
      if (!id) return null;

      setError(null);

      try {
        const data = await conversationService.deleteForMe(id);
        const deletedId = getId(data?.conversationId || id);

        removeConversationForCurrentUser(deletedId);
        return deletedId;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to delete conversation."));
        return null;
      }
    },
    [removeConversationForCurrentUser],
  );

  const sendMessage = useCallback(
    async ({ text = "", replyTo = null, attachments = [] } = {}) => {
      const cleanText = text.trim();
      const conversationId = selectedConvRef.current?._id;

      if (!conversationId) return null;
      if (!cleanText && attachments.length === 0) return null;

      const clientMessageId = createClientMessageId();
      const optimisticReplyTo =
        getId(replyTarget) === getId(replyTo) ? replyTarget : null;

      const optimisticMessage = buildLocalMessage({
        clientMessageId,
        conversationId,
        sender: user,
        text: cleanText,
        attachments,
        replyTo: optimisticReplyTo,
        status: "sending",
        localFlag: "isOptimistic",
      });

      setMessages((prev) => {
        if (
          prev.some(
            (message) =>
              message.clientMessageId === optimisticMessage.clientMessageId,
          )
        ) {
          return prev;
        }

        return [...prev, optimisticMessage];
      });

      updateConversationLastMessage(conversationId, optimisticMessage);
      setSendingMessage(true);
      setError(null);

      try {
        const message = await messageService.sendMessage({
          conversationId,
          text: cleanText,
          replyTo,
          attachments,
          clientMessageId,
        });

        const confirmedMessage = {
          ...message,
          clientMessageId: message?.clientMessageId || clientMessageId,
          isOptimistic: false,
          isPending: false,
          isFailed: false,
        };

        setMessages((prev) =>
          mergeMessageByIdOrClientId(
            prev,
            confirmedMessage,
            pendingReceiptsRef.current,
          ),
        );

        updateConversationLastMessage(conversationId, confirmedMessage);
        return confirmedMessage;
      } catch (err) {
        const errorMessage = getErrorMessage(err, "Failed to send message.");
        setError(errorMessage);

        setMessages((prev) =>
          prev.map((message) =>
            message.clientMessageId === clientMessageId
              ? {
                  ...message,
                  status: "failed",
                  isOptimistic: false,
                  isPending: false,
                  isFailed: true,
                  errorMessage,
                }
              : message,
          ),
        );

        return null;
      } finally {
        setSendingMessage(false);
      }
    },
    [replyTarget, updateConversationLastMessage, user],
  );

  const editMessage = useCallback(
    async (messageId, text) => {
      const cleanText = text.trim();

      if (!messageId || !cleanText) return null;

      setError(null);

      try {
        const message = await messageService.updateMessage(
          messageId,
          cleanText,
        );

        const nextMessage = message?._id
          ? message
          : { _id: messageId, text: cleanText, isEdited: true };

        patchMessageEverywhere(messageId, (current) => ({
          ...current,
          ...nextMessage,
        }));

        return nextMessage;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to edit message."));
        return null;
      }
    },
    [patchMessageEverywhere],
  );

  const deleteMessageForMe = useCallback(
    async (messageId) => {
      if (!messageId) return null;

      setError(null);

      try {
        const data = await messageService.deleteForMe(messageId);
        const deletedId = getId(data?.messageId || data?._id || messageId);

        removeMessageForCurrentUser(deletedId);
        return deletedId;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to delete message."));
        return null;
      }
    },
    [removeMessageForCurrentUser],
  );

  const deleteMessageForEveryone = useCallback(
    async (messageId) => {
      if (!messageId) return null;

      setError(null);

      try {
        const message = await messageService.deleteForEveryone(messageId);

        const nextMessage = message?._id
          ? message
          : {
              _id: messageId,
              text: "",
              attachments: [],
              reactions: [],
              deletedForEveryone: true,
              isEdited: false,
            };

        patchMessageEverywhere(messageId, (current) => ({
          ...current,
          ...nextMessage,
          deletedForEveryone: true,
        }));

        setReplyTargetState((prev) =>
          getId(prev) === getId(messageId) ? null : prev,
        );

        setSelectedMessageIds((prev) => {
          const id = getId(messageId);
          if (!prev.has(id)) return prev;

          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        return nextMessage;
      } catch (err) {
        setError(
          getErrorMessage(err, "Failed to delete message for everyone."),
        );
        return null;
      }
    },
    [patchMessageEverywhere],
  );

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!messageId || !emoji) return null;

      setError(null);

      try {
        const message = await messageService.toggleReaction(messageId, emoji);

        if (message?._id) {
          patchMessageEverywhere(messageId, (current) => ({
            ...current,
            ...message,
            reactions: message.reactions || [],
          }));
        }

        return message;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to update reaction."));
        return null;
      }
    },
    [patchMessageEverywhere],
  );

  const deleteSelectedMessagesForMe = useCallback(async () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return 0;

    setError(null);

    const results = await Promise.allSettled(
      ids.map((id) => messageService.deleteForMe(id)),
    );

    let deletedCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        removeMessageForCurrentUser(ids[index]);
        deletedCount++;
      }
    });

    if (deletedCount !== ids.length) {
      setError("Some selected messages could not be deleted.");
    }

    setSelectedMessageIds(new Set());
    return deletedCount;
  }, [removeMessageForCurrentUser, selectedMessageIds]);

  const deleteSelectedMessagesForEveryone = useCallback(async () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return 0;

    setError(null);

    const results = await Promise.allSettled(
      ids.map((id) => messageService.deleteForEveryone(id)),
    );

    let deletedCount = 0;

    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;

      const id = ids[index];
      const message = result.value;

      const nextMessage = message?._id
        ? message
        : {
            _id: id,
            text: "",
            attachments: [],
            reactions: [],
            deletedForEveryone: true,
            isEdited: false,
          };

      patchMessageEverywhere(id, (current) => ({
        ...current,
        ...nextMessage,
        deletedForEveryone: true,
      }));

      deletedCount++;
    });

    if (deletedCount !== ids.length) {
      setError("Some selected messages could not be deleted for everyone.");
    }

    setSelectedMessageIds(new Set());
    return deletedCount;
  }, [patchMessageEverywhere, selectedMessageIds]);

  const startTyping = useCallback((conversationId) => {
    const socket = getSocket();

    if (!socket?.connected || !conversationId) return;

    socket.emit("typing:start", { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId) => {
    const socket = getSocket();

    if (!socket?.connected || !conversationId) return;

    socket.emit("typing:stop", { conversationId });
  }, []);

  useChatSocket({
    currentUserId,
    selectedConvRef,
    conversationsRef,
    onlineIdsRef,
    pendingReceiptsRef,

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
