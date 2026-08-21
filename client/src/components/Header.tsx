import { useStore } from "../store/useStore";
import { Greeting } from "./Clock";
import { SearchBar } from "./SearchBar";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
}

export function Header({ query, onQueryChange, onOpenSettings, onOpenLogin }: Props) {
  const settings = useStore((s) => s.settings);
  const authed = useStore((s) => s.authed);
  const hasPassword = useStore((s) => s.hasPassword);
  const editMode = useStore((s) => s.editMode);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const mediaConfigured = useStore((s) => s.mediaConfigured);
  const setAddMediaOpen = useStore((s) => s.setAddMediaOpen);

  function handleEditClick() {
    if (!authed && hasPassword) {
      onOpenLogin();
      return;
    }
    toggleEditMode();
  }

  // Shown whether or not this browser has a session — a phone is a separate
  // browser from the desktop, so hiding it there just made the feature look
  // missing. Tapping it prompts for the password instead, like Edit does.
  function handleAddClick() {
    if (!authed && hasPassword) {
      onOpenLogin();
      return;
    }
    setAddMediaOpen(true);
  }

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <Greeting name={settings?.greeting_name ?? ""} />

      <div className="flex w-full items-center gap-2 lg:w-auto lg:shrink-0">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          searchEngine={settings?.search_engine ?? "https://www.google.com/search?q=%s"}
        />
        {/* Always in the header so it never depends on how far down the media
            row is, or whether it has anything in it yet. */}
        {mediaConfigured && (
          <button
            onClick={handleAddClick}
            title="Add a movie or series"
            className="flex h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        )}

        <button
          onClick={handleEditClick}
          className={`hairline shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
            editMode
              ? "border-accent text-accent"
              : "text-ink-muted hover:border-accent/60 hover:text-ink"
          }`}
        >
          {editMode ? "Done" : "Edit"}
        </button>
        <button
          onClick={onOpenSettings}
          className="hairline flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border text-ink-muted transition-colors hover:border-accent/60 hover:text-ink"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
