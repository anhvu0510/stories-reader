import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  activeToast: ToastItem | null;
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id?: string) => void;
}

let activeTimeout: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastStore>((set, get) => ({
  activeToast: null,
  toasts: [],
  showToast: (message: string, type = 'info') => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }

    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast: ToastItem = { id, message, type };

    set({
      activeToast: newToast,
      toasts: [newToast],
    });

    activeTimeout = setTimeout(() => {
      set({
        activeToast: null,
        toasts: [],
      });
      activeTimeout = null;
    }, 2800);
  },
  removeToast: (id?: string) => {
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }
    const current = get().activeToast;
    if (!id || (current && current.id === id)) {
      set({
        activeToast: null,
        toasts: [],
      });
    }
  },
}));

// Helper compatibility wrapper for non-React context callers
export const showToast = (message: string, type: ToastType = 'info') => {
  useToastStore.getState().showToast(message, type);
};
