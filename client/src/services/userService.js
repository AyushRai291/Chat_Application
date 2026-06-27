import api from "../lib/api";

export const userService = {
  async searchUsers(query = "") {
    const { data } = await api.get("/api/users", {
      params: { search: query },
    });

    return data.users || [];
  },
};