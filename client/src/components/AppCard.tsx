import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { Item } from "../types";
import { Icon } from "./Icon";

interface Props {
  item: Item;
  editMode: boolean;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export function AppCard({ item, editMode, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ y: -3 }}
      className="group relative"
    >
      <a
        href={editMode ? undefined : item.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => editMode && e.preventDefault()}
        className="glass flex flex-col items-center gap-2.5 rounded-2xl p-4 transition-colors hover:border-accent/50 hover:shadow-glow cursor-pointer"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/5 overflow-hidden">
          <Icon icon={item.icon} name={item.name} className="h-11 w-11" />
        </div>
        <span className="max-w-[6.5rem] truncate text-sm font-medium">{item.name}</span>
      </a>

      {editMode && (
        <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(item)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs text-white shadow hover:bg-accent"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(item)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs text-white shadow hover:bg-red-500"
            title="Delete"
          >
            ×
          </button>
        </div>
      )}
    </motion.div>
  );
}
