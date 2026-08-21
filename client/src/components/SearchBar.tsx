import { useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  searchEngine: string;
}

export function SearchBar({ value, onChange, searchEngine }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      const url = searchEngine.replace("%s", encodeURIComponent(value.trim()));
      window.open(url, "_blank");
    }
    if (e.key === "Escape") {
      onChange("");
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
        ⌕
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search apps, or press Enter to search the web…"
        className="glass w-full rounded-2xl py-3 pl-11 pr-16 text-sm placeholder:text-slate-500 focus:border-accent/60 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
        ⌘K
      </kbd>
    </div>
  );
}
