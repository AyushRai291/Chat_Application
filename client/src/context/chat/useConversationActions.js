import { useCallback } from "react";
import { conversationService } from "../../services/conversationService";
import { messageService } from "../../services/messageService";
import { getSocket } from "../../lib/socket";
import {
  applyOnlineStateToConversation,
  applyOnlineStateToList,
  getErrorMessage,
  getId,
} from "./chatHelpers";

function getServerUnreadCount(conversation) {
  const raw =
    conversation?.unreadCount ??
    conversation?.unreadMessagesCount ??
    conversation?.unread ??
    0;

  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function buildUnreadMapFromConversations(
  conversations,
  selectedConversationId,
) {
  const next = {};
  const selectedId = getId(selectedConversationId);

  conversations.forEach((conversation) => {
    const id = getId(conversation);
    const count = getServerUnreadCount(conversation);

    if (!id || id === selectedId || count <= 0) return;

    next[id] = count;
  });

  return next;
}

function buildUnreadSnapshot(unreadMap) {
  return Object.entries(unreadMap)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => `${id}:${count}`)
    .join("|");
}

export function useConversationActions({
  currentUserId,
  selectedConvRef,
  onlineIdsRef,
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
}) {
  const updatePresenceEverywhere = useCallback((nextOnlineIds) => {
    setOnlineUserIds(nextOnlineIds);

    setConversations((prev) => applyOnlineStateToList(prev, nextOnlineIds));

    setSelectedConversation((prev) =>
      prev ? applyOnlineStateToConversation(prev, nextOnlineIds) : prev,
    );
  }, [setConversations, setOnlineUserIds, setSelectedConversation]);

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
  }, [onlineIdsRef, setConversations, setSelectedConversation]);

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
    [setConversations, setSelectedConversation],
  );

  const clearUnreadCount = useCallback((conversationId) => {
    const id = getId(conversationId);
    if (!id) return;

    setUnreadCountsByConversation((prev) => {
      if (!prev[id]) return prev;

      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setUnreadCountsByConversation]);

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
    [
      clearUnreadCount,
      selectedConvRef,
      setConversations,
      setMessages,
      setReplyTargetState,
      setSelectedConversation,
      setSelectedMessageIds,
      setTypingUsersByConversation,
    ],
  );

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
      // Browsers can block programmatic audio until the user interacts.
    }
  }, [lastSoundAtRef]);

  playIncomingSoundRef.current = playIncomingSound;

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError(null);

    try {
      const data = await conversationService.getConversations();
      const withPresence = applyOnlineStateToList(data, onlineIdsRef.current);
      const serverUnreadMap = buildUnreadMapFromConversations(
        withPresence,
        selectedConvRef.current?._id,
      );

      setConversations(withPresence);

      setUnreadCountsByConversation((prev) => {
        const next = { ...serverUnreadMap };

        Object.entries(prev).forEach(([id, count]) => {
          if (count > 0) {
            next[id] = Math.max(next[id] || 0, count);
          }
        });

        return next;
      });

      const snapshot = buildUnreadSnapshot(serverUnreadMap);

      if (snapshot && loadedUnreadSnapshotRef.current !== snapshot) {
        loadedUnreadSnapshotRef.current = snapshot;

        window.setTimeout(() => {
          playIncomingSoundRef.current?.();
        }, 350);
      }

      return withPresence;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load conversations."));
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, [
    loadedUnreadSnapshotRef,
    onlineIdsRef,
    playIncomingSoundRef,
    selectedConvRef,
    setConversations,
    setError,
    setLoadingConversations,
    setUnreadCountsByConversation,
  ]);

  const reloadConversationsOnce = useCallback(async () => {
    if (reloadingConversationsRef.current) return;

    reloadingConversationsRef.current = true;

    try {
      await loadConversations();
    } finally {
      reloadingConversationsRef.current = false;
    }
  }, [loadConversations, reloadingConversationsRef]);

  const markConversationRead = useCallback((conversationId) => {
    const id = getId(conversationId);
    const socket = getSocket();

    if (!id || !socket?.connected) return;

    socket.emit("messages:read", { conversationId: id });
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
    [
      currentUserId,
      incomingNotifyKeysRef,
      playIncomingSound,
      selectedConvRef,
      setUnreadCountsByConversation,
    ],
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
    [
      clearUnreadCount,
      markConversationRead,
      setError,
      setLoadingMessages,
      setMessages,
      setSelectedMessageIds,
    ],
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
    [
      clearUnreadCount,
      loadMessages,
      onlineIdsRef,
      setReplyTargetState,
      setSelectedConversation,
      setSelectedMessageIds,
      setTypingUsersByConversation,
    ],
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
  }, [selectConversation, setError, upsertConversation]);

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
    [selectConversation, setError, upsertConversation],
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
    [removeConversationForCurrentUser, selectedConvRef, setError],
  );

  return {
    clearUnreadCount,
    createDirectConversation,
    createSavedConversation,
    deleteConversationForMe,
    loadConversations,
    markConversationRead,
    notifyIncomingMessage,
    reloadConversationsOnce,
    removeConversationForCurrentUser,
    selectConversation,
    updateConversationLastMessage,
    updatePresenceEverywhere,
  };
}
