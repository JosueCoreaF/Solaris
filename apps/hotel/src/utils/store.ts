import { create } from 'zustand';

interface AppStore {
  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Exchange Rate
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;

  // User (placeholder)
  user: { id: string; email: string } | null;
  setUser: (user: { id: string; email: string } | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),

  exchangeRate: 24.5,
  setExchangeRate: (rate) => set({ exchangeRate: rate }),

  user: null,
  setUser: (user) => set({ user }),
}));
