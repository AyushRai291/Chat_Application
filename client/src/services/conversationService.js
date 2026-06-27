import api from "../lib/api";

export const conversationService = {
  async getConversations() {
    const { data } = await api.get("/api/conversations");
    return data.conversations || [];
  },

  async createSaved() {
    const { data } = await api.post("/api/conversations", { isSelf: true });
    return data.conversation;
  },

  async createDirect(receiverId) {
    const { data } = await api.post("/api/conversations", { receiverId });
    return data.conversation;
  },

  async deleteForMe(conversationId) {
    const { data } = await api.delete(`/api/conversations/${conversationId}/for-me`);
    return data;
  },
};
