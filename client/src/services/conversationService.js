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

  async createGroup({ groupName, participantIds }) {
    const { data } = await api.post("/api/conversations/groups", {
      groupName,
      participantIds,
    });

    return data.conversation;
  },

  async updateGroup(conversationId, payload) {
    const { data } = await api.patch(
      `/api/conversations/${conversationId}/group`,
      payload,
    );

    return data.conversation;
  },

  async addGroupParticipant(conversationId, participantId) {
    const { data } = await api.post(
      `/api/conversations/${conversationId}/participants`,
      { participantId },
    );

    return data.conversation;
  },

  async removeGroupParticipant(conversationId, participantId) {
    const { data } = await api.delete(
      `/api/conversations/${conversationId}/participants/${participantId}`,
    );

    return data.conversation;
  },

  async leaveGroup(conversationId) {
    const { data } = await api.post(
      `/api/conversations/${conversationId}/leave`,
    );

    return data.conversation || data;
  },

  async deleteForMe(conversationId) {
    const { data } = await api.delete(
      `/api/conversations/${conversationId}/for-me`,
    );

    return data;
  },
};