import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { conversationService } from "../services/conversationService";
import { messageService } from "../services/messageService";

const ChatContext = createContext(null);

const getErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

export function ChatProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const [error, setError] = useState(null);

  const upsertConversation = useCallback((conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c._id === conversation._id);

      if (!exists) {
        return [conversation, ...prev];
      }

      return prev.map((c) =>
        c._id === conversation._id ? { ...c, ...conversation } : c
      );
    });
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError(null);

    try {
      const data = await conversationService.getConversations();
      setConversations(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load conversations."));
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return [];

    setLoadingMessages(true);
    setMessages([]);
    setError(null);

    try {
      const data = await messageService.getMessages(conversationId);
      setMessages(data);
      return data;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load messages."));
      return [];
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectConversation = useCallback(
    async (conversation) => {
      if (!conversation?._id) return;

      setSelectedConversation(conversation);
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

  const sendMessage = useCallback(
    async ({ text = "", replyTo = null, attachments = [] } = {}) => {
      const cleanText = text.trim();

      if (!selectedConversation?._id) return null;
      if (!cleanText && attachments.length === 0) return null;

      setSendingMessage(true);
      setError(null);

      try {
        const message = await messageService.sendMessage({
          conversationId: selectedConversation._id,
          text: cleanText,
          replyTo,
          attachments,
        });

        setMessages((prev) => [...prev, message]);

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation._id === selectedConversation._id
              ? {
                  ...conversation,
                  lastMessage: message,
                  updatedAt: message.createdAt || new Date().toISOString(),
                }
              : conversation
          )
        );

        setSelectedConversation((prev) =>
          prev?._id === selectedConversation._id
            ? {
                ...prev,
                lastMessage: message,
                updatedAt: message.createdAt || new Date().toISOString(),
              }
            : prev
        );

        return message;
      } catch (err) {
        setError(getErrorMessage(err, "Failed to send message."));
        return null;
      } finally {
        setSendingMessage(false);
      }
    },
    [selectedConversation]
  );

  return (
    <ChatContext.Provider
      value={{
        conversations,
        selectedConversation,
        messages,

        loadingConversations,
        loadingMessages,
        sendingMessage,

        error,
        setError,

        loadConversations,
        loadMessages,
        selectConversation,
        createSavedConversation,
        createDirectConversation,
        sendMessage,
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