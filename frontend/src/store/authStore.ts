import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const savedToken = localStorage.getItem("classsense_token");
const savedUserStr = localStorage.getItem("classsense_user");
let initialUser: User | null = null;
if (savedUserStr) {
  try {
    initialUser = JSON.parse(savedUserStr);
  } catch {
    initialUser = null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: savedToken,
  isAuthenticated: !!savedToken && !!initialUser,
  login: (token: string, user: User) => {
    localStorage.setItem("classsense_token", token);
    localStorage.setItem("classsense_user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem("classsense_token");
    localStorage.removeItem("classsense_user");
    set({ token: null, user: null, isAuthenticated: false });
  },
  setUser: (user: User) => {
    localStorage.setItem("classsense_user", JSON.stringify(user));
    set({ user });
  }
}));
