import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket } from "../../lib/socket";
import {
  applyReceiptToMessage,
  getId,
  hasSameClientMessageId,
  mergeMessageByIdOrClientId,
  setCachedMessages,
  updateCachedMessages,
} from "./chatHelpers";

export function useChatSocket({
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
}) {
  const hasConnectedOnceRef = useRef(false);
  const shouldReloadOnConnectRef = useRef(false);

  useEffect(() => {
    if (!currentUserId) return;

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

      if (shouldReloadOnConnectRef.current) {
        reloadConversationsOnce();
      }

      hasConnectedOnceRef.current = true;
      shouldReloadOnConnectRef.current = false;
      markConversationRead(selectedConvRef.current?._id);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);

      if (hasConnectedOnceRef.current) {
        shouldReloadOnConnectRef.current = true;
      }
    });

    socket.on("message:pending", (data) => {
      const rawMessage = data?.message || data;
      const conversationId =
        data?.conversationId ||
        rawMessage?.conversation?._id ||
        rawMessage?.conversation;

      if (!rawMessage?._id || !conversationId) return;
      if (getId(rawMessage.sender) === getId(currentUserId)) return;

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

          const next = [...prev, pendingMessage];
          setCachedMessages(messageCacheRef, conversationId, next);
          return next;
        });
      } else {
        updateCachedMessages(messageCacheRef, conversationId, (prev) => {
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
      notifyIncomingMessage(conversationId, pendingMessage);
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
        setMessages((prev) => {
          const next = mergeMessageByIdOrClientId(
            prev,
            confirmedMessage,
            pendingReceiptsRef.current,
          );
          setCachedMessages(messageCacheRef, conversationId, next);
          return next;
        });

        if (getId(message.sender) !== getId(currentUserId)) {
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
        notifyIncomingMessage(conversationId, confirmedMessage);
        return;
      }

      const storedReceipt = pendingReceiptsRef.current.get(
        getId(confirmedMessage),
      );

      if (getId(conversationId) !== getId(selectedId)) {
        updateCachedMessages(messageCacheRef, conversationId, (prev) =>
          mergeMessageByIdOrClientId(
            prev,
            confirmedMessage,
            pendingReceiptsRef.current,
          ),
        );
      }

      const lastMessage = storedReceipt
        ? applyReceiptToMessage(confirmedMessage, storedReceipt)
        : confirmedMessage;

      updateConversationLastMessage(conversationId, lastMessage);
      notifyIncomingMessage(conversationId, confirmedMessage);
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
          setMessages((prev) => {
            const next = prev.map((message) => {
              const receipt = receiptMap.get(getId(message));
              if (!receipt) return message;

              pendingReceiptsRef.current.delete(getId(message));
              return applyReceiptToMessage(message, receipt, fallbackStatus);
            });

            setCachedMessages(messageCacheRef, conversationId, next);
            return next;
          });
        } else {
          updateCachedMessages(messageCacheRef, conversationId, (prev) =>
            prev.map((message) => {
              const receipt = receiptMap.get(getId(message));
              return receipt
                ? applyReceiptToMessage(message, receipt, fallbackStatus)
                : message;
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

          setCachedMessages(messageCacheRef, conversationId, next);
          return next;
        });
      } else {
        updateCachedMessages(messageCacheRef, conversationId, (prev) =>
          prev.map((message) =>
            getId(message) === messageId
              ? applyReceiptToMessage(message, receipt, fallbackStatus)
              : message,
          ),
        );
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

      if (!conversationId || getId(typingUser) === getId(currentUserId)) {
        return;
      }

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
  ]);
}
