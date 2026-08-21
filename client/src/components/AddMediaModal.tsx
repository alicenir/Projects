import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { AddOptions, ArrService, LookupResult } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

function Poster({ item }: { item: LookupResult }) {
  const [failed, setFailed] = useState(false);
  if (!item.poster || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center sunken-strong p-1 text-center">
        <span className="text-[10px] font-semibold uppercase text-ink-muted">{item.title}</span>
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

export function AddMediaModal({ open, onClose, onAdded }: Props) {
  const [service, setService] = useState<ArrService>("radarr");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<LookupResult | null>(null);
  const [options, setOptions] = useState<AddOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [qualityProfileId, setQualityProfileId] = useState<number | null>(null);
  const [rootFolderPath, setRootFolderPath] = useState("");
  const [monitor, setMonitor] = useState<"all" | "future" | "firstSeason">("all");
  const [searchNow, setSearchNow] = useState(true);
  const [adding, setAdding] = useState(false);

  const reqId = useRef(0);

  useEffect(() => {
    if (!open) {
      setTerm("");
      setResults([]);
      setSelected(null);
      setSearchError(null);
    }
  }, [open]);

  // Load root folders / quality profiles whenever the target service changes.
  useEffect(() => {
    if (!open) return;
    setOptions(null);
    setOptionsError(null);
    api
      .get<AddOptions>(`/media/options/${service}`)
      .then((opts) => {
        setOptions(opts);
        setQualityProfileId(opts.qualityProfiles[0]?.id ?? null);
        setRootFolderPath(opts.rootFolders[0]?.path ?? "");
      })
      .catch((err) => setOptionsError(err instanceof Error ? err.message : "Could not load options"));
  }, [service, open]);

  // Debounced lookup.
  useEffect(() => {
    if (!open) return;
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const data = await api.get<{ results: LookupResult[] }>(
          `/media/search?service=${service}&q=${encodeURIComponent(q)}`
        );
        if (id === reqId.current) setResults(data.results);
      } catch (err) {
        if (id === reqId.current) {
          setResults([]);
          setSearchError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [term, service, open]);

  async function handleAdd() {
    if (!selected || qualityProfileId === null || !rootFolderPath) return;
    setAdding(true);
    try {
      await api.post("/media/add", {
        service: selected.service,
        externalId: selected.externalId,
        title: selected.title,
        year: selected.year,
        qualityProfileId,
        rootFolderPath,
        searchNow,
        ...(selected.kind === "series" ? { monitor } : {}),
      });
      toast.success(
        searchNow ? `Added ${selected.title} — searching now` : `Added ${selected.title}`
      );
      setSelected(null);
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[8vh]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
            style={{ maxHeight: "80vh" }}
          >
            <div className="flex items-center gap-3 p-4 pb-3">
              <div className="flex gap-1 rounded-xl sunken p-1">
                {(["radarr", "sonarr"] as ArrService[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setService(s);
                      setSelected(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      service === s ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {s === "radarr" ? "Movie" : "TV series"}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={service === "radarr" ? "Search for a movie…" : "Search for a series…"}
                className="field flex-1"
              />
              <button onClick={onClose} className="text-lg leading-none text-ink-muted hover:text-ink">
                ×
              </button>
            </div>

            {optionsError && (
              <p className="mx-4 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {optionsError}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
              {searchError && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{searchError}</p>
              )}

              {!searchError && term.trim().length < 2 && (
                <p className="py-10 text-center text-sm text-ink-muted">
                  Type at least two characters to search.
                </p>
              )}

              {searching && results.length === 0 && term.trim().length >= 2 && (
                <p className="py-10 text-center text-sm text-ink-muted">Searching…</p>
              )}

              {!searching && !searchError && term.trim().length >= 2 && results.length === 0 && (
                <p className="py-10 text-center text-sm text-ink-muted">No matches.</p>
              )}

              <ul className="flex flex-col gap-2">
                {results.map((r) => {
                  const already = r.existingId > 0;
                  const isSelected = selected?.externalId === r.externalId;
                  return (
                    <li key={`${r.service}-${r.externalId}`}>
                      <button
                        disabled={already}
                        onClick={() => setSelected(isSelected ? null : r)}
                        className={`flex w-full gap-3 rounded-xl p-2 text-left transition-colors ${
                          already
                            ? "cursor-not-allowed opacity-50"
                            : isSelected
                              ? "bg-accent/15 ring-1 ring-accent/50"
                              : "hover-sunken"
                        }`}
                      >
                        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg">
                          <Poster item={r} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-baseline gap-2 text-sm font-semibold text-ink">
                            <span className="truncate">{r.title}</span>
                            {r.year && <span className="shrink-0 text-xs text-ink-muted">{r.year}</span>}
                            {already && (
                              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                                In library
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                            {r.overview || "No description available."}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-2 text-[10px] text-ink-muted">
                            {r.network && <span>{r.network}</span>}
                            {r.status && <span className="capitalize">{r.status}</span>}
                            {r.genres.slice(0, 3).map((g) => (
                              <span key={g}>{g}</span>
                            ))}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selected && (
              <div className="hairline border-t p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 text-xs text-ink-muted">
                    Quality
                    <select
                      value={qualityProfileId ?? ""}
                      onChange={(e) => setQualityProfileId(Number(e.target.value))}
                      className="field mt-1"
                    >
                      {options?.qualityProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="min-w-0 flex-1 text-xs text-ink-muted">
                    Folder
                    <select
                      value={rootFolderPath}
                      onChange={(e) => setRootFolderPath(e.target.value)}
                      className="field mt-1"
                    >
                      {options?.rootFolders.map((f) => (
                        <option key={f.id} value={f.path}>
                          {f.path}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selected.kind === "series" && (
                    <label className="min-w-0 flex-1 text-xs text-ink-muted">
                      Monitor
                      <select
                        value={monitor}
                        onChange={(e) => setMonitor(e.target.value as typeof monitor)}
                        className="field mt-1"
                      >
                        <option value="all">All episodes</option>
                        <option value="future">Future episodes</option>
                        <option value="firstSeason">First season</option>
                      </select>
                    </label>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={searchNow}
                      onChange={(e) => setSearchNow(e.target.checked)}
                      className="accent-accent"
                    />
                    Start searching immediately
                  </label>
                  <button
                    onClick={handleAdd}
                    disabled={adding || qualityProfileId === null || !rootFolderPath}
                    className="btn-primary ml-auto"
                  >
                    {adding ? "Adding…" : `Add ${selected.kind === "movie" ? "movie" : "series"}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
