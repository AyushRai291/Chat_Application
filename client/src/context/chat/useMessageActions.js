import { useCallback } from "react";
import { messageService } from "../../services/messageService";
import { getSocket } from "../../lib/socket";
import {
  buildLocalMessage,
  createClientMessageId,
  getErrorMessage,
  getId,
  mergeMessageByIdOrClientId,
  setCachedMessages,
  updateCachedMessageEverywhere,
  updateCachedMessages,
} from "./chatHelpers";

export function useMessageActions({
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
}) {
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
    updateCachedMessageEverywhere(messageCacheRef, (messages) => {
      let changed = false;

      const nextMessages = messages.map((message) => {
        const nextMessage = patchMessage(message);

        if (nextMessage !== message) {
          changed = true;
        }

        return nextMessage;
      });

      return changed ? nextMessages : messages;
    });

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
  }, [
    messageCacheRef,
    setConversations,
    setMessages,
    setReplyTargetState,
    setSelectedConversation,
  ]);

  const removeMessageForCurrentUser = useCallback((messageId) => {
    const id = getId(messageId);
    if (!id) return;

    const removeMessage = (messages) => {
      if (!messages.some((message) => getId(message) === id)) {
        return messages;
      }

      return messages.filter((message) => getId(message) !== id);
    };

    setMessages(removeMessage);
    updateCachedMessageEverywhere(messageCacheRef, removeMessage);

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
  }, [
    messageCacheRef,
    setConversations,
    setMessages,
    setReplyTargetState,
    setSelectedConversation,
    setSelectedMessageIds,
  ]);

  const setReplyTarget = useCallback((message) => {
    if (!message?._id || message.deletedForEveryone) return;

    setReplyTargetState(message);
  }, [setReplyTargetState]);

  const clearReplyTarget = useCallback(() => {
    setReplyTargetState(null);
  }, [setReplyTargetState]);

  const toggleMessageSelection = useCallback((messageId) => {
    const id = getId(messageId);
    if (!id) return;

    setSelectedMessageIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }, [setSelectedMessageIds]);

  const clearSelectedMessages = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, [setSelectedMessageIds]);

  const sendMessage = useCallback(
    async ({ text = "", replyTo = null, attachments = [] } = {}) => {
      const cleanText = text.trim();
      const conversationId = selectedConvRef.current?._id;

      if (!conversationId) return null;
      if (!cleanText && attachments.length === 0) return null;

      const updateConversationMessages = (updater) => {
        if (getId(selectedConvRef.current) === getId(conversationId)) {
          setMessages((prev) => {
            const next = updater(prev);
            setCachedMessages(messageCacheRef, conversationId, next);
            return next;
          });

          return;
        }

        updateCachedMessages(messageCacheRef, conversationId, updater, {
          createIfMissing: true,
        });
      };

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

      const addOptimisticMessage = (prev) => {
        if (
          prev.some(
            (message) =>
              message.clientMessageId === optimisticMessage.clientMessageId,
          )
        ) {
          return prev;
        }

        return [...prev, optimisticMessage];
      };

      updateConversationMessages(addOptimisticMessage);

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

        const mergeConfirmedMessage = (prev) =>
          mergeMessageByIdOrClientId(
            prev,
            confirmedMessage,
            pendingReceiptsRef.current,
          );

        updateConversationMessages(mergeConfirmedMessage);

        updateConversationLastMessage(conversationId, confirmedMessage);
        return confirmedMessage;
      } catch (err) {
        const errorMessage = getErrorMessage(err, "Failed to send message.");
        setError(errorMessage);

        const markFailedMessage = (prev) =>
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
          );

        updateConversationMessages(markFailedMessage);

        return null;
      } finally {
        setSendingMessage(false);
      }
    },
    [
      pendingReceiptsRef,
      messageCacheRef,
      replyTarget,
      selectedConvRef,
      setError,
      setMessages,
      setSendingMessage,
      updateConversationLastMessage,
      user,
    ],
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
    [patchMessageEverywhere, setError],
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
    [removeMessageForCurrentUser, setError],
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
    [
      patchMessageEverywhere,
      setError,
      setReplyTargetState,
      setSelectedMessageIds,
    ],
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
    [patchMessageEverywhere, setError],
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
  }, [
    removeMessageForCurrentUser,
    selectedMessageIds,
    setError,
    setSelectedMessageIds,
  ]);

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
  }, [
    patchMessageEverywhere,
    selectedMessageIds,
    setError,
    setSelectedMessageIds,
  ]);

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

  return {
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
  };
}
