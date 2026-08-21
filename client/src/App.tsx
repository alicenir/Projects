import { useEffect, useState } from "react";
import { AddMediaModal } from "./components/AddMediaModal";
import { AppGrid } from "./components/AppGrid";
import { BookmarksSection } from "./components/BookmarksSection";
import { CommandPalette } from "./components/CommandPalette";
import { Header } from "./components/Header";
import { ItemModal } from "./components/ItemModal";
import { LoginModal } from "./components/LoginModal";
import { MediaSection } from "./components/MediaSection";
import { SabnzbdWidget } from "./components/SabnzbdWidget";
import { SectionHeading } from "./components/SectionHeading";
import { SettingsPanel } from "./components/SettingsPanel";
import { TeslaWidget } from "./components/TeslaWidget";
import { useStore } from "./store/useStore";
import type { Item, ItemType } from "./types";

export default function App() {
  const { loadAll, items, settings, loading } = useStore();
  const editMode = useStore((s) => s.editMode);
  const addMediaOpen = useStore((s) => s.addMediaOpen);
  const setAddMediaOpen = useStore((s) => s.setAddMediaOpen);
  const bumpMediaRefresh = useStore((s) => s.bumpMediaRefresh);

  const [query, setQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"General" | "Media" | "Car">("General");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newItemDefaults, setNewItemDefaults] = useState<{ type: ItemType; categoryId: number | null }>({
    type: "app",
    categoryId: null,
  });

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("light", settings.theme === "light");
    document.documentElement.style.setProperty("--accent", settings.accent_color);
  }, [settings]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openAddModal(type: ItemType, categoryId: number | null = null) {
    setEditingItem(null);
    setNewItemDefaults({ type, categoryId });
    setItemModalOpen(true);
  }

  function openEditModal(item: Item) {
    setEditingItem(item);
    setItemModalOpen(true);
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  const apps = filtered
    .filter((i) => i.type === "app" || Boolean(i.is_pinned))
    .sort((a, b) => a.sort_order - b.sort_order);
  const bookmarks = filtered
    .filter((i) => i.type === "bookmark" && !i.is_pinned)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="shimmer h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-10 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <Header
        query={query}
        onQueryChange={setQuery}
        onOpenSettings={() => {
          setSettingsTab("General");
          setSettingsOpen(true);
        }}
        onOpenLogin={() => setLoginOpen(true)}
      />

      <div className="grid flex-1 grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="flex min-w-0 flex-col gap-10">
          {(apps.length > 0 || editMode) && (
            <section>
              <SectionHeading major count={apps.length}>
                Applications
              </SectionHeading>
              <AppGrid items={apps} onEdit={openEditModal} onAddClick={() => openAddModal("app")} />
            </section>
          )}

          <MediaSection
            onConfigure={() => {
              setSettingsTab("Media");
              setSettingsOpen(true);
            }}
          />

          <BookmarksSection
            bookmarks={bookmarks}
            onEdit={openEditModal}
            onAddClick={(categoryId) => openAddModal("bookmark", categoryId)}
          />

          {apps.length === 0 && bookmarks.length === 0 && !editMode && (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
              <p className="text-lg font-semibold text-ink">Nothing here yet</p>
              <p className="max-w-sm text-sm text-ink-muted">
                {q
                  ? "No apps or bookmarks match your search."
                  : "Hit Edit to add your first app or bookmark."}
              </p>
            </div>
          )}
        </main>

        <aside className="flex min-w-0 flex-col gap-6">
          <SabnzbdWidget />
          <TeslaWidget />
        </aside>
      </div>

      <AddMediaModal
        open={addMediaOpen}
        onClose={() => setAddMediaOpen(false)}
        onAdded={bumpMediaRefresh}
      />
      <CommandPalette items={items} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
      <ItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        editing={editingItem}
        defaultType={newItemDefaults.type}
        defaultCategoryId={newItemDefaults.categoryId}
      />
    </div>
  );
}
