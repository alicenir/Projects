import { useStore } from "../store/useStore";
import { Clock } from "./Clock";
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

  function handleEditClick() {
    if (!authed && hasPassword) {
      onOpenLogin();
      return;
    }
    toggleEditMode();
  }

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <Clock greeting={settings?.greeting_name ?? ""} />

      <SearchBar value={query} onChange={onQueryChange} searchEngine={settings?.search_engine ?? "https://www.google.com/search?q=%s"} />

      <div className="flex items-center gap-2">
        <button
          onClick={handleEditClick}
          className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
            editMode ? "border-accent text-accent" : "border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          {editMode ? "Done" : "Edit"}
        </button>
        <button
          onClick={onOpenSettings}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
