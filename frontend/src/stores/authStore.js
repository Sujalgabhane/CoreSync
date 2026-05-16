import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/axios';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { email, password });
          const { accessToken, refreshToken, user } = res.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          set({ user, accessToken, refreshToken, isLoading: false });
          return { success: true, role: user.role };
        } catch (err) {
          set({ isLoading: false });
          const message = err.response?.data?.error || 'Login failed';
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout', { refreshToken: get().refreshToken });
        } catch {
          // Ignore logout errors
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/users/me');
          set({ user: res.data });
          return res.data;
        } catch {
          return null;
        }
      },

      isAuthenticated: () => !!get().user && !!get().accessToken,
      isEmployee: () => get().user?.role === 'employee',
      isManager:  () => get().user?.role === 'manager',
      isAdmin:    () => get().user?.role === 'admin',
    }),
    {
      name: 'coresync-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

export default useAuthStore;
