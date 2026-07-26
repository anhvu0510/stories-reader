import { create } from 'zustand';
import { ApiDomain } from '../shared/types';

interface AppStore {
  isOfflineMode: boolean;
  domains: ApiDomain[];
  activeDomainId: string | null;
  activeDomain: ApiDomain | null;
  
  setOfflineMode: (offline: boolean) => void;
  setDomains: (domains: ApiDomain[]) => void;
  setActiveDomainId: (id: string) => void;
  addDomain: (domain: ApiDomain) => void;
  removeDomain: (id: string) => void;
  loadAppConfig: () => void;
}

const STORAGE_KEY_DOMAINS = 'API_DOMAINS_CONFIG';
const STORAGE_KEY_ACTIVE = 'ACTIVE_API_DOMAIN_ID';
const STORAGE_KEY_OFFLINE = 'offlineMode';

function getInitialDomains(): ApiDomain[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOMAINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const legacy = localStorage.getItem('API_DOMAIN_CONFIG');
    if (legacy) {
      return [{ id: 'legacy', name: 'Server Mặc định', url: legacy }];
    }
  } catch {}
  return [];
}

export const useAppStore = create<AppStore>((set, get) => ({
  isOfflineMode: localStorage.getItem(STORAGE_KEY_OFFLINE) === 'true',
  domains: getInitialDomains(),
  activeDomainId: localStorage.getItem(STORAGE_KEY_ACTIVE) || (getInitialDomains()[0]?.id ?? null),
  activeDomain: null,

  setOfflineMode: (offline: boolean) => {
    localStorage.setItem(STORAGE_KEY_OFFLINE, String(offline));
    set({ isOfflineMode: offline });
    window.dispatchEvent(new CustomEvent('offline-mode-changed', { detail: offline }));
  },

  setDomains: (domains: ApiDomain[]) => {
    localStorage.setItem(STORAGE_KEY_DOMAINS, JSON.stringify(domains));
    const currentActiveId = get().activeDomainId;
    const active = domains.find(d => d.id === currentActiveId) || domains[0] || null;
    set({ domains, activeDomain: active, activeDomainId: active?.id ?? null });
  },

  setActiveDomainId: (id: string) => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    const active = get().domains.find(d => d.id === id) || null;
    set({ activeDomainId: id, activeDomain: active });
  },

  addDomain: (domain: ApiDomain) => {
    const next = [...get().domains, domain];
    get().setDomains(next);
    get().setActiveDomainId(domain.id);
  },

  removeDomain: (id: string) => {
    const next = get().domains.filter(d => d.id !== id);
    get().setDomains(next);
  },

  loadAppConfig: () => {
    const domains = getInitialDomains();
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE) || (domains[0]?.id ?? null);
    const active = domains.find(d => d.id === activeId) || domains[0] || null;
    set({
      isOfflineMode: localStorage.getItem(STORAGE_KEY_OFFLINE) === 'true',
      domains,
      activeDomainId: activeId,
      activeDomain: active,
    });
  },
}));
