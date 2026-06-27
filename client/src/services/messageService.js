import api from "../lib/api";

export const messageService = {
  async getMessages(conversationId) {
    const { data } = await api.get(`/api/messages/${conversationId}`);
    return data.messages || [];
  },

  async sendMessage({ conversationId, text, replyTo = null, attachments = [] }) {
    const { data } = await api.post("/api/messages", {
      conversationId,
      text,
      replyTo,
      attachments,
    });

    return data.message;
  },
};