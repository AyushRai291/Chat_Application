import api from '../lib/api';

export const authService = {
  async signup({ name, email, password }) {
    const { data } = await api.post('/api/auth/signup', { name, email, password });
    return data;
  },

  async login({ email, password }) {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  },

  async logout() {
    const { data } = await api.post('/api/auth/logout');
    return data;
  },

  async getMe() {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
};