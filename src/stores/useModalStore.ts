import { create } from 'zustand';

export type SettingsTab = 'servers' | 'tokens' | 'quotas' | 'reader' | 'translation' | 'replacements' | 'voice';

interface ModalStore {
  isSettingsOpen: boolean;
  activeSettingsTab: SettingsTab;
  isOfflineManagerOpen: boolean;
  
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  
  openOfflineManager: () => void;
  closeOfflineManager: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  isSettingsOpen: false,
  activeSettingsTab: 'reader',
  isOfflineManagerOpen: false,

  openSettings: (tab = 'reader') => set({ isSettingsOpen: true, activeSettingsTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  setSettingsTab: (tab: SettingsTab) => set({ activeSettingsTab: tab }),

  openOfflineManager: () => set({ isOfflineManagerOpen: true }),
  closeOfflineManager: () => set({ isOfflineManagerOpen: false }),
}));
