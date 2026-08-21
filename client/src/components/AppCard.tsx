import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { displayHost } from "../lib/palette";
import { useStore } from "../store/useStore";
import type { Item } from "../types";
import { Icon } from "./Icon";

interface Props {
  item: Item;
  editMode: boolean;
  accent?: string;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

const DOT: Record<string, { color: string; label: string }> = {
  up: { color: "#34d399", label: "Reachable" },
  down: { color: "#f87171", label: "Not responding" },
  unknown: { color: "#94a3b8", label: "Not checked yet" },
};

function sinceLabel(since: string | null): string {
  if (!since) return "";
  const mins = Math.round((Date.now() - new Date(since).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export function AppCard({ item, editMode, accent, onEdit, onDelete }: Props) {
  const health = useStore((s) => s.health[item.id]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    "--tile-accent": accent ?? "var(--accent)",
  } as React.CSSProperties;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ y: -2 }}
      className="group relative"
    >
      <a
        href={editMode ? undefined : item.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => editMode && e.preventDefault()}
        className="glass flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:border-[var(--tile-accent)]/60"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, var(--tile-accent) 16%, transparent)" }}
        >
          <Icon icon={item.icon} name={item.name} className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-bold uppercase tracking-wide text-ink">
            <span className="truncate">{item.name}</span>
            {health && health.state !== "unknown" && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: DOT[health.state].color }}
                title={`${DOT[health.state].label}${
                  health.status ? ` (HTTP ${health.status})` : ""
                }${health.since ? ` · ${sinceLabel(health.since)}` : ""}`}
                aria-label={DOT[health.state].label}
              />
            )}
          </p>
          <p
            className="truncate text-[11px] font-medium lowercase"
            style={{ color: "var(--tile-accent)" }}
          >
            {displayHost(item.url)}
          </p>
        </div>
      </a>

      {editMode && (
        <div className="absolute -right-1.5 -top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(item)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-xs text-ink shadow hover:bg-accent"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(item)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-xs text-ink shadow hover:bg-red-500"
            title="Delete"
          >
            ×
          </button>
        </div>
      )}
    </motion.div>
  );
}
