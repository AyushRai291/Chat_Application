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

const createClientMessageId = () =>
  `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const statusRank = {
  sending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

const strongerStatus = (current, next) => {
  const currentRank = statusRank[current] || 0;
  const nextRank = statusRank[next] || 0;
  return nextRank >= currentRank ? next : current;
};

const applyReceiptToMessage = (message, receipt, fallbackStatus) => {
  if (!message || !receipt) return message;

  return {
    ...message,
    status: strongerStatus(
      message.status,
      receipt.status || fallbackStatus || message.status,
    ),
    deliveredTo: receipt.deliveredTo || message.deliveredTo,
    readBy: receipt.readBy || message.readBy,
  };
};

const hasSameClientMessageId = (left, right) =>
  Boolean(
    left?.clientMessageId &&
      right?.clientMessageId &&
      left.clientMessageId === right.clientMessageId,
  );

const mergeMessageByIdOrClientId = (
  messages,
  nextMessage,
  receiptMap = null,
) => {
  if (!nextMessage?._id) return messages;

  let replaced = false;

  let cleanedMessage = {
    ...nextMessage,
    isOptimistic: false,
    isPending: false,
    isFailed: false,
  };

  const storedReceipt = receiptMap?.get(getId(cleanedMessage));

  if (storedReceipt) {
    cleanedMessage = applyReceiptToMessage(cleanedMessage, storedReceipt);
    receiptMap.delete(getId(cleanedMessage));
  }

  const nextMessages = messages.map((message) => {
    if (
      getId(message) === getId(cleanedMessage) ||
      hasSameClientMessageId(message, cleanedMessage)
    ) {
      replaced = true;

      return {
        ...cleanedMessage,
        status: strongerStatus(message.status, cleanedMessage.status),
        deliveredTo: cleanedMessage.deliveredTo || message.deliveredTo,
        readBy: cleanedMessage.readBy || message.readBy,
      };
    }

    return message;
  });

  if (replaced) return nextMessages;

  if (messages.some((message) => getId(message) === getId(cleanedMessage))) {
    return messages;
  }

  return [...messages, cleanedMessage];
};

const buildLocalMessage = ({
  clientMessageId,
  conversationId,
  sender,
  text,
  attachments,
  replyTo,
  status = "sending",
  localFlag = "isOptimistic",
}) => {
  const now = new Date().toISOString();

  return {
    _id: `temp-${clientMessageId}`,
    clientMessageId,
    conversation: conversationId,
    sender: sender
      ? {
          _id: sender._id,
          name: sender.name,
          email: sender.email,
          avatar: sender.avatar,
        }
      : null,
    text,
    safeHtml: "",
    attachments,
    status,
    readBy: sender?._id ? [sender._id] : [],
    deliveredTo: [],
    reactions: [],
    replyTo: replyTo || null,
    isEdited: false,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: now,
    updatedAt: now,
    [localFlag]: true,
  };
};

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
    applyOnlineStateToConversation(conversation, onlineIds),
  );

export function ChatProvider({ children }) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyTarget, setReplyTargetState] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());

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

  const removeConversationForCurrentUser = useCallback((conversationId) => {
    const id = getId(conversationId);
    if (!id) return;

    setConversations((prev) =>
      prev.filter((conversation) => getId(conversation) !== id),
    );

    setSelectedConversation((prev) => (getId(prev) === id ? null : prev));
    setMessages((prev) => (getId(selectedConvRef.current) === id ? [] : prev));
    setReplyTargetState(null);
    setSelectedMessageIds(new Set());

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

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return [];

      setLoadingMessages(true);
      setMessages([]);
      setSelectedMessageIds(new Set());
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
    },
    [markConversationRead],
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
      setTypingUsersByConversation((prev) => ({
        ...prev,
        [conversation._id]: [],
      }));

      await loadMessages(conversation._id);
    },
    [loadMessages],
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

  useEffect(() => {
    if (!user?._id) return;

    const socket = connectSocket();

    const offEvents = () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message:pending");
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

    socket.on("message:pending", (data) => {
      const rawMessage = data?.message || data;
      const conversationId =
        data?.conversationId ||
        rawMessage?.conversation?._id ||
        rawMessage?.conversation;

      if (!rawMessage?._id || !conversationId) return;
      if (getId(rawMessage.sender) === getId(user)) return;

      const selectedId = selectedConvRef.current?._id;
      const pendingMessage = {
        ...rawMessage,
        isPending: true,
        isOptimistic: false,
        isFailed: false,
        status: rawMessage.status || "sending",
      };

      if (getId(conversationId) === getId(selectedId)) {
        setMessages((prev) => {
          if (
            prev.some(
              (message) =>
                getId(message) === getId(pendingMessage) ||
                hasSameClientMessageId(message, pendingMessage),
            )
          ) {
            return prev;
          }

          return [...prev, pendingMessage];
        });
      }

      updateConversationLastMessage(conversationId, pendingMessage);
    });

    socket.on("message:new", (data) => {
      const message = data?.message || data;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!message?._id || !conversationId) return;

      const selectedId = selectedConvRef.current?._id;
      const confirmedMessage = {
        ...message,
        isOptimistic: false,
        isPending: false,
        isFailed: false,
      };

      if (getId(conversationId) === getId(selectedId)) {
        setMessages((prev) =>
          mergeMessageByIdOrClientId(
            prev,
            confirmedMessage,
            pendingReceiptsRef.current,
          ),
        );

        if (getId(message.sender) !== getId(user)) {
          window.setTimeout(() => {
            markConversationRead(conversationId);
          }, 80);

          window.setTimeout(() => {
            markConversationRead(conversationId);
          }, 350);
        }
      }

      const exists = conversationsRef.current.some(
        (item) => getId(item) === getId(conversationId),
      );

      if (!exists) {
        reloadConversationsOnce();
        return;
      }

      const storedReceipt = pendingReceiptsRef.current.get(
        getId(confirmedMessage),
      );
      const lastMessage = storedReceipt
        ? applyReceiptToMessage(confirmedMessage, storedReceipt)
        : confirmedMessage;

      updateConversationLastMessage(conversationId, lastMessage);
    });

    socket.on("message:updated", (data) => {
      const message = data?.message || data;
      const conversationId =
        data?.conversationId ||
        message?.conversation?._id ||
        message?.conversation;

      if (!message?._id || !conversationId) return;

      patchMessageEverywhere(message._id, (current) => ({
        ...current,
        ...message,
      }));
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

      setReplyTargetState((prev) =>
        getId(prev) === getId(messageId) ? null : prev,
      );
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

      if (Array.isArray(data?.receipts)) {
        const receiptMap = new Map(
          data.receipts.map((receipt) => [
            getId(receipt.messageId),
            {
              ...receipt,
              status: receipt.status || fallbackStatus,
            },
          ]),
        );

        receiptMap.forEach((receipt, messageId) => {
          if (messageId) {
            pendingReceiptsRef.current.set(messageId, receipt);
          }
        });

        if (getId(selectedConvRef.current) === conversationId) {
          setMessages((prev) =>
            prev.map((message) => {
              const receipt = receiptMap.get(getId(message));
              if (!receipt) return message;

              pendingReceiptsRef.current.delete(getId(message));
              return applyReceiptToMessage(message, receipt, fallbackStatus);
            }),
          );
        }

        setConversations((prev) =>
          prev.map((conversation) => {
            if (
              getId(conversation) !== conversationId ||
              !conversation.lastMessage
            ) {
              return conversation;
            }

            const receipt = receiptMap.get(getId(conversation.lastMessage));
            return receipt
              ? {
                  ...conversation,
                  lastMessage: applyReceiptToMessage(
                    conversation.lastMessage,
                    receipt,
                    fallbackStatus,
                  ),
                }
              : conversation;
          }),
        );

        setSelectedConversation((prev) => {
          if (getId(prev) !== conversationId || !prev?.lastMessage) return prev;

          const receipt = receiptMap.get(getId(prev.lastMessage));
          return receipt
            ? {
                ...prev,
                lastMessage: applyReceiptToMessage(
                  prev.lastMessage,
                  receipt,
                  fallbackStatus,
                ),
              }
            : prev;
        });

        return;
      }

      const messageId = getId(data?.messageId || data?.message?._id);
      if (!messageId) return;

      const receipt = {
        ...data,
        status: data.status || fallbackStatus,
      };

      pendingReceiptsRef.current.set(messageId, receipt);

      if (getId(selectedConvRef.current) === conversationId) {
        setMessages((prev) => {
          let found = false;

          const next = prev.map((message) => {
            if (getId(message) !== messageId) return message;

            found = true;
            return applyReceiptToMessage(message, receipt, fallbackStatus);
          });

          if (found) {
            pendingReceiptsRef.current.delete(messageId);
          }

          return next;
        });
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          getId(conversation) === conversationId &&
          getId(conversation.lastMessage) === messageId
            ? {
                ...conversation,
                lastMessage: applyReceiptToMessage(
                  conversation.lastMessage,
                  receipt,
                  fallbackStatus,
                ),
              }
            : conversation,
        ),
      );

      setSelectedConversation((prev) =>
        getId(prev) === conversationId && getId(prev?.lastMessage) === messageId
          ? {
              ...prev,
              lastMessage: applyReceiptToMessage(
                prev.lastMessage,
                receipt,
                fallbackStatus,
              ),
            }
          : prev,
      );
    };

    socket.on("receipt:delivered", (data) => {
      applyReceipt(data, "delivered");
    });

    socket.on("receipt:read", (data) => {
      applyReceipt(data, "read");
    });

    socket.on("presence:online-users", (data) => {
      const ids = Array.isArray(data?.userIds) ? data.userIds.map(getId) : [];
      updatePresenceEverywhere(new Set(ids));
    });

    socket.on("presence:update", (data) => {
      const userId = getId(data?.userId || data?.user?._id);
      if (!userId) return;

      const next = new Set(onlineIdsRef.current);

      if (data?.isOnline) next.add(userId);
      else next.delete(userId);

      updatePresenceEverywhere(next);
    });

    socket.on("typing:start", (data) => {
      const conversationId = getId(data?.conversationId);
      const typingUser = data?.user;

      if (!conversationId || getId(typingUser) === getId(user)) return;

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
      const conversationId = getId(data?.conversationId);
      const typingUser = data?.user;

      if (!conversationId) return;

      setTypingUsersByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter(
          (item) => getId(item) !== getId(typingUser),
        ),
      }));
    });

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      offEvents();
      setSocketConnected(false);
      disconnectSocket();
    };
  }, [
    user,
    markConversationRead,
    patchMessageEverywhere,
    reloadConversationsOnce,
    removeConversationForCurrentUser,
    removeMessageForCurrentUser,
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
        selectedMessageIds,
        selectedMessageCount: selectedMessageIds.size,

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