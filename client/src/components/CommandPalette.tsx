import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Item } from "../types";
import { Icon } from "./Icon";

interface Props {
  items: Item[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ items, open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) return items.slice(0, 8);
    const q = query.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function launch(item: Item) {
    window.open(item.url, "_blank");
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      launch(results[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Jump to an app…"
              className="w-full bg-transparent px-5 py-4 text-base placeholder:text-ink-muted focus:outline-none hairline border-b"
            />
            <div className="max-h-80 overflow-y-auto scrollbar-thin p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ink-muted">No matches</p>
              )}
              {results.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => launch(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    index === activeIndex ? "bg-accent/20 text-accent" : "hover:sunken"
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg sunken">
                    <Icon icon={item.icon} name={item.name} className="h-5 w-5" />
                  </div>
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
