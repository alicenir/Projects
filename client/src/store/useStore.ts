import { create } from "zustand";
import { api } from "../lib/api";
import type { Category, HealthEntry, Item, SabnzbdSnapshot, Settings } from "../types";

interface StoreState {
  items: Item[];
  categories: Category[];
  settings: Settings | null;
  authed: boolean;
  hasPassword: boolean;
  editMode: boolean;
  sabnzbd: SabnzbdSnapshot | null;
  loading: boolean;
  /** Whether Sonarr/Radarr are set up, so the header can offer "add media". */
  mediaConfigured: boolean;
  addMediaOpen: boolean;
  /** Bumped after an add so the media row reloads. */
  mediaRefreshToken: number;
  health: Record<number, HealthEntry>;

  setHealth: (health: Record<number, HealthEntry>) => void;
  setMediaConfigured: (value: boolean) => void;
  setAddMediaOpen: (value: boolean) => void;
  bumpMediaRefresh: () => void;
  loadAll: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setSabnzbd: (snapshot: SabnzbdSnapshot) => void;
  toggleEditMode: () => void;
  setSettings: (settings: Settings) => void;
  upsertItem: (item: Item) => void;
  removeItem: (id: number) => void;
  upsertCategory: (category: Category) => void;
  removeCategory: (id: number) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  items: [],
  categories: [],
  settings: null,
  authed: false,
  hasPassword: false,
  editMode: false,
  sabnzbd: null,
  loading: true,
  mediaConfigured: false,
  addMediaOpen: false,
  mediaRefreshToken: 0,
  health: {},

  setHealth: (health) => set({ health }),
  setMediaConfigured: (value) => set({ mediaConfigured: value }),
  setAddMediaOpen: (value) => set({ addMediaOpen: value }),
  bumpMediaRefresh: () => set((s) => ({ mediaRefreshToken: s.mediaRefreshToken + 1 })),

  loadAll: async () => {
    set({ loading: true });
    const [items, categories, settings, authStatus] = await Promise.all([
      api.get<Item[]>("/items"),
      api.get<Category[]>("/categories"),
      api.get<Settings>("/settings"),
      api.get<{ authed: boolean; hasPassword: boolean }>("/auth/status"),
    ]);
    set({
      items,
      categories,
      settings,
      authed: authStatus.authed,
      hasPassword: authStatus.hasPassword,
      loading: false,
    });
  },

  refreshAuth: async () => {
    const authStatus = await api.get<{ authed: boolean; hasPassword: boolean }>("/auth/status");
    set({ authed: authStatus.authed, hasPassword: authStatus.hasPassword });
    if (!authStatus.authed) set({ editMode: false });
  },

  setSabnzbd: (snapshot) => set({ sabnzbd: snapshot }),

  toggleEditMode: () => {
    const { authed, editMode } = get();
    if (!authed && !editMode) return;
    set({ editMode: !editMode });
  },

  setSettings: (settings) => set({ settings }),

  upsertItem: (item) =>
    set((state) => {
      const exists = state.items.some((i) => i.id === item.id);
      return {
        items: exists
          ? state.items.map((i) => (i.id === item.id ? item : i))
          : [...state.items, item],
      };
    }),

  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  upsertCategory: (category) =>
    set((state) => {
      const exists = state.categories.some((c) => c.id === category.id);
      return {
        categories: exists
          ? state.categories.map((c) => (c.id === category.id ? category : c))
          : [...state.categories, category],
      };
    }),

  removeCategory: (id) =>
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),
}));
