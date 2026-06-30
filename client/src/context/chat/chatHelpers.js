export const getId = (value) => String(value?._id || value || "");
export const MESSAGE_CACHE_LIMIT = 15;

export const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

export const createClientMessageId = () =>
  `cm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const statusRank = {
  sending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export const strongerStatus = (current, next) => {
  const currentRank = statusRank[current] || 0;
  const nextRank = statusRank[next] || 0;

  return nextRank >= currentRank ? next : current;
};

export const applyReceiptToMessage = (message, receipt, fallbackStatus) => {
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

export const hasSameClientMessageId = (left, right) =>
  Boolean(
    left?.clientMessageId &&
      right?.clientMessageId &&
      left.clientMessageId === right.clientMessageId,
  );

export const mergeMessageByIdOrClientId = (
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

export const getCachedMessages = (cacheRef, conversationId) => {
  const id = getId(conversationId);
  const cache = cacheRef?.current;

  if (!id || !cache?.has(id)) return null;

  const messages = cache.get(id);

  cache.delete(id);
  cache.set(id, messages);

  return messages;
};

export const setCachedMessages = (
  cacheRef,
  conversationId,
  messages,
  limit = MESSAGE_CACHE_LIMIT,
) => {
  const id = getId(conversationId);
  const cache = cacheRef?.current;

  if (!id || !cache) return [];

  const nextMessages = Array.isArray(messages) ? messages : [];

  cache.delete(id);
  cache.set(id, nextMessages);

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  return nextMessages;
};

export const updateCachedMessages = (
  cacheRef,
  conversationId,
  updater,
  { createIfMissing = false } = {},
) => {
  const id = getId(conversationId);
  const cache = cacheRef?.current;

  if (!id || !cache) return null;
  if (!cache.has(id) && !createIfMissing) return null;

  const current = cache.get(id) || [];
  const nextMessages =
    typeof updater === "function" ? updater(current) : updater;

  return setCachedMessages(cacheRef, id, nextMessages);
};

export const updateCachedMessageEverywhere = (cacheRef, updater) => {
  const cache = cacheRef?.current;
  if (!cache) return;

  Array.from(cache.entries()).forEach(([conversationId, messages]) => {
    const nextMessages =
      typeof updater === "function" ? updater(messages, conversationId) : messages;

    if (nextMessages !== messages) {
      setCachedMessages(cacheRef, conversationId, nextMessages);
    }
  });
};

export const removeCachedConversation = (cacheRef, conversationId) => {
  const id = getId(conversationId);
  const cache = cacheRef?.current;

  if (id && cache) {
    cache.delete(id);
  }
};

const getMessageCacheSignature = (message) => {
  if (!message) return "";

  return [
    getId(message),
    message.clientMessageId || "",
    message.text || "",
    message.status || "",
    message.updatedAt || "",
    message.createdAt || "",
    message.isEdited ? "1" : "0",
    message.deletedForEveryone ? "1" : "0",
    message.attachments?.length || 0,
    message.reactions?.length || 0,
  ].join("|");
};

export const haveSameMessageList = (first = [], second = []) => {
  if (first === second) return true;
  if (first.length !== second.length) return false;

  return first.every(
    (message, index) =>
      getMessageCacheSignature(message) ===
      getMessageCacheSignature(second[index]),
  );
};

export const buildLocalMessage = ({
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

export const applyOnlineStateToConversation = (conversation, onlineIds) => {
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

export const applyOnlineStateToList = (conversations, onlineIds) =>
  conversations.map((conversation) =>
    applyOnlineStateToConversation(conversation, onlineIds),
  );
