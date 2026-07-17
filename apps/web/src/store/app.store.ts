import { create } from 'zustand';

interface Tenant {
  id: string;
  name: string;
  code: string;
}

interface AppState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  chatSessionId: string | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  setTenants: (tenants: Tenant[]) => void;
  setChatSessionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentTenant: null,
  tenants: [],
  chatSessionId: null,
  setCurrentTenant: (tenant) => set({ currentTenant: tenant, chatSessionId: null }),
  setTenants: (tenants) => set({ tenants }),
  setChatSessionId: (id) => set({ chatSessionId: id }),
}));
