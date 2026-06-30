import api from "../lib/api";

export const userService = {
  async updateMe({ name, avatar }) {
    const { data } = await api.patch("/api/users/me", { name, avatar });
    return data;
  },

  async searchUsers(query = "") {
    const { data } = await api.get("/api/users", {
      params: { search: query },
    });

    return data.users || [];
  },
};
