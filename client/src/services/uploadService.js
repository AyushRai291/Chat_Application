import api from "../lib/api";

export const uploadService = {
  async uploadAttachment({ file, conversationId }) {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("files", file);

    const { data } = await api.post("/api/messages/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return data.attachments?.[0] || null;
  },
};
