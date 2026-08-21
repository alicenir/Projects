import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { UpcomingItem, UpcomingSnapshot } from "../types";
import { SectionHeading } from "./SectionHeading";

/** "Tonight" / "Tomorrow" / "Thu" — calendar days, not 24h windows. */
function whenLabel(iso: string): string {
  const air = new Date(iso);
  if (Number.isNaN(air.getTime())) return "";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(air) - startOfDay(new Date())) / 86_400_000);

  if (days <= 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  if (days < 7) return air.toLocaleDateString([], { weekday: "long" });
  return air.toLocaleDateString([], { month: "short", day: "numeric" });
}

function airTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Poster({ item }: { item: UpcomingItem }) {
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

export function UpcomingSection() {
  const [snapshot, setSnapshot] = useState<UpcomingSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<UpcomingSnapshot>("/media/upcoming?days=7");
        if (!cancelled) setSnapshot(data);
      } catch {
        if (!cancelled) setSnapshot({ configured: false, items: [] });
      }
    }
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!snapshot || !snapshot.configured || snapshot.items.length === 0) return null;

  // Group by day so the row reads as a schedule rather than a flat list.
  const groups: { label: string; items: UpcomingItem[] }[] = [];
  for (const item of snapshot.items) {
    const label = whenLabel(item.airsAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <section>
      <SectionHeading major count={snapshot.items.length}>
        Upcoming
      </SectionHeading>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent">
              {group.label}
            </p>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <motion.a
                  key={item.id}
                  href={item.link ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-3 rounded-xl p-2 transition-colors hover-sunken ${
                    item.hasFile ? "opacity-60" : ""
                  }`}
                  title={item.overview || item.title}
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg">
                    <Poster item={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    <p className="truncate text-[11px] text-ink-muted">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-ink">
                      {airTime(item.airsAt)}
                    </p>
                    {item.hasFile ? (
                      <p className="text-[10px] text-emerald-400/80">Downloaded</p>
                    ) : (
                      item.network && <p className="text-[10px] text-ink-muted">{item.network}</p>
                    )}
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
