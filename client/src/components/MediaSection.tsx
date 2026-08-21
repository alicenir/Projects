import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MediaItem, MediaSnapshot } from "../types";
import { SectionHeading } from "./SectionHeading";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function Poster({ item }: { item: MediaItem }) {
  const [failed, setFailed] = useState(false);

  if (!item.poster || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center sunken-strong p-2 text-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {item.title}
        </span>
      </div>
    );
  }
  return (
    <img
      src={item.poster}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: (item: MediaItem) => void }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      onClick={() => onOpen(item)}
      className="group relative overflow-hidden rounded-xl text-left"
      title={item.title}
    >
      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl">
        <Poster item={item} />
      </div>

      {/* Always-visible label strip so the grid is readable without hovering. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-8">
        <p className="truncate text-xs font-bold text-white">{item.title}</p>
        <p className="truncate text-[11px] text-white/70">{item.subtitle}</p>
      </div>

      <span
        className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: item.kind === "movie" ? "#f97316cc" : "#22d3eecc" }}
      >
        {item.kind === "movie" ? "Movie" : "TV"}
      </span>

      <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
        {relativeTime(item.addedAt)}
      </span>
    </motion.button>
  );
}

function DetailModal({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex w-full max-w-2xl gap-5 overflow-hidden rounded-2xl p-5"
          >
            <div className="hidden h-56 w-36 shrink-0 overflow-hidden rounded-xl sm:block">
              <Poster item={item} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold leading-tight text-ink">{item.title}</h2>
                  <p className="mt-0.5 text-sm font-medium text-accent">{item.subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 text-lg leading-none text-ink-muted hover:text-ink"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                {item.year && <span className="rounded sunken-strong px-1.5 py-0.5">{item.year}</span>}
                {item.runtime ? (
                  <span className="rounded sunken-strong px-1.5 py-0.5">{item.runtime} min</span>
                ) : null}
                {item.quality && (
                  <span className="rounded sunken-strong px-1.5 py-0.5">{item.quality}</span>
                )}
                {item.rating ? (
                  <span className="rounded sunken-strong px-1.5 py-0.5">★ {item.rating.toFixed(1)}</span>
                ) : null}
                {item.genres.slice(0, 3).map((g) => (
                  <span key={g} className="rounded sunken-strong px-1.5 py-0.5">
                    {g}
                  </span>
                ))}
              </div>

              <p className="mt-3 max-h-48 overflow-y-auto scrollbar-thin text-sm leading-relaxed text-ink-muted">
                {item.overview || "No description available."}
              </p>

              <div className="mt-4 flex items-center gap-3 text-xs">
                <span className="text-ink-muted">Added {relativeTime(item.addedAt)}</span>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-semibold text-accent hover:underline"
                  >
                    Open in {item.service === "sonarr" ? "Sonarr" : "Radarr"} →
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MediaSection() {
  const [snapshot, setSnapshot] = useState<MediaSnapshot | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<MediaSnapshot>("/media/recent?limit=12");
        if (!cancelled) setSnapshot(data);
      } catch {
        if (!cancelled) setSnapshot({ configured: false, items: [], errors: [] });
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snapshot || !snapshot.configured) return null;
  if (snapshot.items.length === 0 && snapshot.errors.length === 0) return null;

  return (
    <section>
      <SectionHeading major count={snapshot.items.length}>
        Recently added
      </SectionHeading>

      {snapshot.errors.length > 0 && (
        <p className="mb-3 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
          {snapshot.errors
            .map((e) => `${e.service === "sonarr" ? "Sonarr" : "Radarr"}: ${e.message}`)
            .join(" · ")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
        {snapshot.items.map((item) => (
          <MediaCard key={item.id} item={item} onOpen={setSelected} />
        ))}
      </div>

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
