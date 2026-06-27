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

  async updateMessage(messageId, text) {
    const { data } = await api.patch(`/api/messages/${messageId}`, { text });
    return data.message || data;
  },

  async deleteForMe(messageId) {
    const { data } = await api.delete(`/api/messages/${messageId}/for-me`);
    return data;
  },

  async deleteForEveryone(messageId) {
    const { data } = await api.delete(`/api/messages/${messageId}/for-everyone`);
    return data.message || data;
  },

  async toggleReaction(messageId, emoji) {
    const { data } = await api.post(`/api/messages/${messageId}/reactions`, {
      emoji,
    });

    return data.message || data;
  },
};
