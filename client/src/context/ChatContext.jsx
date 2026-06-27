import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { conversationService } from "../services/conversationService";
import { messageService } from "../services/messageService";
import { connectSocket, disconnectSocket, getSocket } from "../lib/socket";

const ChatContext = createContext(null);

const getId = (value) => String(value?._id || value || "");

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

const applyOnlineStateToConversation = (conversation, onlineIds) => {
  if (!conversation?.participants?.length) return conversation;

  return {
    ...conversation,
    participants: conversation.participants.map((participant) => {
      if (!participant || typeof participant !== "object") return participant;

      return {
        ...participant,
        isOnline: onlineIds.has(getId(participant)),
      };
    }),
  };
};

const applyOnlineStateToList = (conversations, onlineIds) =>
  conversations.map((conversation) =>
    applyOnlineStateToConversation(conversation, onlineIds)
  );

export function ChatProvider({ children }) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyTarget, setReplyTargetState] = useState(null);

  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsersByConversation, setTypingUsersByConversation] = useState({});

  const [error, setError] = useState(null);

  const selectedConvRef = useRef(null);
  const conversationsRef = useRef([]);
  const onlineIdsRef = useRef(new Set());
  const reloadingConversationsRef = useRef(false);

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    onlineIdsRef.current = onlineUserIds;
  }, [onlineUserIds]);

  const updatePresenceEverywhere = useCallback((nextOnlineIds) => {
    setOnlineUserIds(nextOnlineIds);

    setConversations((prev) => applyOnlineStateToList(prev, nextOnlineIds));

    setSelectedConversation((prev) =>
      prev ? applyOnlineStateToConversation(prev, nextOnlineIds) : prev
    );
  }, []);

  const upsertConversation = useCallback((conversation, moveTop = true) => {
    if (!conversation?._id) return;

    setConversations((prev) => {
      const withPresence = applyOnlineStateToConversation(
        conversation,
        onlineIdsRef.current
      );

      const exists = prev.some((item) => item._id === withPresence._id);

      if (!exists) return [withPresence, ...prev];

      const updated = prev.map((item) =>
        item._id === withPresence._id ? { ...item, ...withPresence } : item
      );

      if (!moveTop) return updated;

      const target = updated.find((item) => item._id === withPresence._id);
      const rest = updated.filter((item) => item._id !== withPresence._id);

      return target ? [target, ...rest] : updated;
    });

    setSelectedConversation((prev) =>
      prev?._id === conversation._id
        ? applyOnlineStateToConversation({ ...prev, ...conversation }, onlineIdsRef.current)
        : prev
    );
  }, []);

  const updateConversationLastMessage = useCallback((conversationId, message) => {
    if (!conversationId || !message?._id) return;

    setConversations((prev) => {
      const exists = prev.find((item) => item._id === conversationId);
      if (!exists) return prev;

      const updatedConversation = {
        ...exists,
        lastMessage: message,
        updatedAt: message.createdAt || exists.updatedAt,
      };

      const rest = prev.filter((item) => item._id !== conversationId);
      return [updatedConversation, ...rest];
    });

    setSelectedConversation((prev) =>
      prev?._id === conversationId
        ? {
            ...prev,
            lastMessage: message,
            updatedAt: message.createdAt || prev.updatedAt,
          }
        : prev
    );
  }, []);

  const patchMessageEverywhere = useCallback((messageId, updater) => {
    const id = getId(messageId);
    if (!id) return;

    const patchMessage = (message) => {
      if (!message || getId(message) !== id) return message;
      return typeof updater === "function" ? updater(message) : { ...message, ...updater };
    };

    setMessages((prev) => prev.map(patchMessage));

    setConversations((prev) =>
      prev.map((conversation) =>
        getId(conversation.lastMessage) === id
          ? { ...conversation, lastMessage: patchMessage(conversation.lastMessage) }
          : conversation
      )
    );

    setSelectedConversation((prev) =>
      getId(prev?.lastMessage) === id
        ? { ...prev, lastMessage: patchMessage(prev.lastMessage) }
        : prev
    );

    setReplyTargetState((prev) => (getId(prev) === id ? patchMessage(prev) : prev));
  }, []);

  const removeMessageForCurrentUser = useCallback((messageId) => {
    const id = getId(messageId);
    if (!id) return;

    setMessages((prev) => prev.filter((message) => getId(message) !== id));

    setConversations((prev) =>
      prev.map((conversation) =>
        getId(conversation.lastMessage) === id
          ? { ...conversation, lastMessage: null }
          : conversation
      )
    );

    setSelectedConversation((prev) =>
      getId(prev?.lastMessage) === id ? { ...prev, lastMessage: null } : prev
    );

    setReplyTargetState((prev) => (getId(prev) === id ? null : prev));
  }, []);

  const setReplyTarget = useCallback((message) => {
    if (!message?._id || message.deletedForEveryone) return;
    setReplyTargetState(message);
  }, []);

  const clearReplyTarget = useCallback(() => {
    setReplyTargetState(null);
  }, []);

  const removeConversationForCurrentUser = useCallback((conversationId) => {
    const id = getId(conversationId);
    if (!id) return;

    setConversations((prev) =>
      prev.filter((conversation) => getId(conversation) !== id)
    );

    setSelectedConversation((prev) => (getId(prev) === id ? null : prev));
    setMessages((prev) => (getId(selectedConvRef.current) === id ? [] : prev));
    setReplyTargetState(null);
    setTypingUsersByConversation((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

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

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return [];

    setLoadingMessages(true);
    setMessages([]);
    setError(null);

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
  }, [markConversationRead]);

  const selectConversation = useCallback(
    async (conversation) => {
      if (!conversation?._id) return;

      const withPresence = applyOnlineStateToConversation(
        conversation,
        onlineIdsRef.current
      );

      setSelectedConversation(withPresence);
      setTypingUsersByConversation((prev) => ({
        ...prev,
        [conversation._id]: [],
      }));

      await loadMessages(conversation._id);
    },
    [loadMessages]
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
    [selectConversation, upsertConversation]
  );

  const deleteConversationForMe = useCallback(async (conversationId) => {
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
  }, [removeConversationForCurrentUser]);

  const sendMessage = useCallback(async ({ text = "", replyTo = null, attachments = [] } = {}) => {
    const cleanText = text.trim();
    const conversationId = selectedConvRef.current?._id;

    if (!conversationId) return null;
    if (!cleanText && attachments.length === 0) return null;

    setSendingMessage(true);
    setError(null);

    try {
      const message = await messageService.sendMessage({
        conversationId,
        text: cleanText,
        replyTo,
        attachments,
      });

      setMessages((prev) => {
        if (prev.some((item) => item._id === message._id)) return prev;
        return [...prev, message];
      });

      updateConversationLastMessage(conversationId, message);

      return message;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send message."));
      return null;
    } finally {
      setSendingMessage(false);
    }
  }, [updateConversationLastMessage]);

  const editMessage = useCallback(async (messageId, text) => {
    const cleanText = text.trim();

    if (!messageId || !cleanText) return null;

    setError(null);

    try {
      const message = await messageService.updateMessage(messageId, cleanText);
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
  }, [patchMessageEverywhere]);

  const deleteMessageForMe = useCallback(async (messageId) => {
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
  }, [removeMessageForCurrentUser]);

  const deleteMessageForEveryone = useCallback(async (messageId) => {
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

      setReplyTargetState((prev) => (getId(prev) === getId(messageId) ? null : prev));
      return nextMessage;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete message for everyone."));
      return null;
    }
  }, [patchMessageEverywhere]);

  const toggleReaction = useCallback(async (messageId, emoji) => {
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
  }, [patchMessageEverywhere]);

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

  useEffect(() => {
    if (!user?._id) return;

    const socket = connectSocket();

    const offEvents = () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message:new");
      socket.off("message:updated");
      socket.off("message:deleted-for-me");
      socket.off("message:deleted-for-everyone");
      socket.off("message:reaction-updated");
      socket.off("conversation:deleted-for-me");
      socket.off("receipt:delivered");
      socket.off("receipt:read");
      socket.off("presence:online-users");
      socket.off("presence:update");
      socket.off("typing:start");
      socket.off("typing:stop");
    };

    offEvents();

    socket.on("connect", () => {
      setSocketConnected(true);
      markConversationRead(selectedConvRef.current?._id);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("message:new", (data) => {
      const message = data?.message || data;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!message?._id || !conversationId) return;

      const selectedId = selectedConvRef.current?._id;

      if (getId(conversationId) === getId(selectedId)) {
        setMessages((prev) => {
          if (prev.some((item) => getId(item) === getId(message))) return prev;
          return [...prev, message];
        });

        if (getId(message.sender) !== getId(user)) {
          markConversationRead(conversationId);
        }
      }

      const exists = conversationsRef.current.some(
        (item) => getId(item) === getId(conversationId)
      );

      if (!exists) {
        reloadConversationsOnce();
        return;
      }

      updateConversationLastMessage(conversationId, message);
    });

    socket.on("message:updated", (data) => {
      const message = data?.message || data;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!message?._id || !conversationId) return;

      patchMessageEverywhere(message._id, (current) => ({ ...current, ...message }));
    });

    socket.on("message:deleted-for-everyone", (data) => {
      const message = data?.message || {};
      const messageId = data?.messageId || message?._id;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!messageId || !conversationId) return;

      const patch = {
        ...message,
        _id: messageId,
        deletedForEveryone: true,
        text: message.text || "",
      };

      patchMessageEverywhere(messageId, (current) => ({
        ...current,
        ...patch,
        deletedForEveryone: true,
      }));
      setReplyTargetState((prev) => (getId(prev) === getId(messageId) ? null : prev));
    });

    socket.on("message:deleted-for-me", (data) => {
      const messageId = data?.messageId || data?.message?._id;
      const conversationId =
        data?.conversationId ||
        data?.message?.conversation?._id ||
        data?.message?.conversation;

      if (!messageId || !conversationId) return;

      removeMessageForCurrentUser(messageId);
    });

    socket.on("message:reaction-updated", (data) => {
      const message = data?.message || data;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!message?._id || !conversationId) return;

      patchMessageEverywhere(message._id, (current) => ({
        ...current,
        ...message,
        reactions: message.reactions || [],
      }));
    });

    socket.on("conversation:deleted-for-me", (data) => {
      removeConversationForCurrentUser(data?.conversationId);
    });

    const applyReceipt = (data, fallbackStatus) => {
      const conversationId = getId(data?.conversationId);
      if (!conversationId) return;

      const patchWithReceipt = (message, receipt) => ({
        ...message,
        status: receipt.status || fallbackStatus || message.status,
        deliveredTo: receipt.deliveredTo || message.deliveredTo,
        readBy: receipt.readBy || message.readBy,
      });

      if (Array.isArray(data?.receipts)) {
        const receiptMap = new Map(
          data.receipts.map((receipt) => [getId(receipt.messageId), receipt])
        );

        if (getId(selectedConvRef.current) === conversationId) {
          setMessages((prev) =>
            prev.map((message) => {
              const receipt = receiptMap.get(getId(message));
              return receipt ? patchWithReceipt(message, receipt) : message;
            })
          );
        }

        setConversations((prev) =>
          prev.map((conversation) => {
            if (getId(conversation) !== conversationId || !conversation.lastMessage) {
              return conversation;
            }

            const receipt = receiptMap.get(getId(conversation.lastMessage));
            return receipt
              ? {
                  ...conversation,
                  lastMessage: patchWithReceipt(conversation.lastMessage, receipt),
                }
              : conversation;
          })
        );

        setSelectedConversation((prev) => {
          if (getId(prev) !== conversationId || !prev?.lastMessage) return prev;

          const receipt = receiptMap.get(getId(prev.lastMessage));
          return receipt
            ? {
                ...prev,
                lastMessage: patchWithReceipt(prev.lastMessage, receipt),
              }
            : prev;
        });

        return;
      }

      const messageId = getId(data?.messageId || data?.message?._id);
      if (!messageId) return;

      if (getId(selectedConvRef.current) === conversationId) {
        setMessages((prev) =>
          prev.map((message) =>
            getId(message) === messageId ? patchWithReceipt(message, data) : message
          )
        );
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          getId(conversation) === conversationId &&
          getId(conversation.lastMessage) === messageId
            ? {
                ...conversation,
                lastMessage: patchWithReceipt(conversation.lastMessage, data),
              }
            : conversation
        )
      );

      setSelectedConversation((prev) =>
        getId(prev) === conversationId && getId(prev?.lastMessage) === messageId
          ? {
              ...prev,
              lastMessage: patchWithReceipt(prev.lastMessage, data),
            }
          : prev
      );
    };

    socket.on("receipt:delivered", (data) => {
      applyReceipt(data, "delivered");
    });

    socket.on("receipt:read", (data) => {
      applyReceipt(data, "read");
    });

    socket.on("presence:online-users", (data) => {
      const ids = (data?.users || data?.userIds || data || []).map(getId);
      updatePresenceEverywhere(new Set(ids));
    });

    socket.on("presence:update", (data) => {
      const userId = getId(data?.userId || data?.user);
      if (!userId) return;

      const next = new Set(onlineIdsRef.current);

      if (data?.isOnline) next.add(userId);
      else next.delete(userId);

      updatePresenceEverywhere(next);
    });

    socket.on("typing:start", (data) => {
      const conversationId = data?.conversationId;
      const typingUser = data?.user || {
        _id: data?.userId,
        name: data?.name,
        email: data?.email,
      };

      if (!conversationId || !getId(typingUser)) return;
      if (getId(typingUser) === getId(user)) return;

      setTypingUsersByConversation((prev) => {
        const current = prev[conversationId] || [];
        if (current.some((item) => getId(item) === getId(typingUser))) {
          return prev;
        }

        return {
          ...prev,
          [conversationId]: [...current, typingUser],
        };
      });
    });

    socket.on("typing:stop", (data) => {
      const conversationId = data?.conversationId;
      const typingUserId = getId(data?.user || data?.userId);

      if (!conversationId || !typingUserId) return;

      setTypingUsersByConversation((prev) => {
        const current = prev[conversationId] || [];

        return {
          ...prev,
          [conversationId]: current.filter(
            (item) => getId(item) !== typingUserId
          ),
        };
      });
    });

    return () => {
      offEvents();
      disconnectSocket();
      setSocketConnected(false);
    };
  }, [
    user,
    markConversationRead,
    patchMessageEverywhere,
    removeMessageForCurrentUser,
    removeConversationForCurrentUser,
    reloadConversationsOnce,
    updateConversationLastMessage,
    updatePresenceEverywhere,
  ]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        selectedConversation,
        messages,
        replyTarget,

        loadingConversations,
        loadingMessages,
        sendingMessage,

        socketConnected,
        onlineUserIds,
        typingUsersByConversation,

        error,
        setError,

        loadConversations,
        loadMessages,
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

  if (!ctx) {
    throw new Error("useChat must be used inside ChatProvider");
  }

  return ctx;
}
