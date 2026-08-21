import { categoryColor, displayHost } from "../lib/palette";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Item } from "../types";
import { Icon } from "./Icon";
import { SectionHeading } from "./SectionHeading";

interface Props {
  bookmarks: Item[];
  onEdit: (item: Item) => void;
  onAddClick?: (categoryId: number | null) => void;
}

function BookmarkLink({
  item,
  color,
  editMode,
  onEdit,
  onDelete,
}: {
  item: Item;
  color: string;
  editMode: boolean;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  return (
    <li className="group flex items-center gap-2">
      <a
        href={editMode ? undefined : item.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => editMode && e.preventDefault()}
        title={displayHost(item.url)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-ink-muted transition-colors hover:sunken hover:text-ink"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
          <Icon icon={item.icon} name={item.name} className="h-4 w-4" />
        </span>
        <span className="truncate">{item.name}</span>
      </a>
      {editMode && (
        <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => onEdit(item)} className="text-xs text-ink-muted hover:text-accent">
            ✎
          </button>
          <button onClick={() => onDelete(item)} className="text-xs text-ink-muted hover:text-red-400">
            ×
          </button>
        </span>
      )}
    </li>
  );
}

export function BookmarksSection({ bookmarks, onEdit, onAddClick }: Props) {
  const categories = useStore((s) => s.categories);
  const editMode = useStore((s) => s.editMode);
  const removeItem = useStore((s) => s.removeItem);

  async function handleDelete(item: Item) {
    if (!confirm(`Remove "${item.name}"?`)) return;
    await api.delete(`/items/${item.id}`);
    removeItem(item.id);
  }

  const groups = [
    ...categories
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cat) => ({
        key: `cat-${cat.id}`,
        id: cat.id as number | null,
        name: cat.name,
        items: bookmarks.filter((b) => b.category_id === cat.id),
      })),
    {
      key: "uncategorized",
      id: null as number | null,
      name: "Other",
      items: bookmarks.filter((b) => b.category_id === null),
    },
  ].filter((g) => g.items.length > 0 || editMode);

  if (groups.length === 0) return null;

  return (
    <section>
      <SectionHeading major count={bookmarks.length}>
        Bookmarks
      </SectionHeading>
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {groups.map((group, index) => {
          const color = categoryColor(group.id ?? index);
          return (
            <div key={group.key} className="min-w-0">
              <SectionHeading color={color} count={group.items.length}>
                {group.name}
              </SectionHeading>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <BookmarkLink
                    key={item.id}
                    item={item}
                    color={color}
                    editMode={editMode}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                  />
                ))}
                {editMode && onAddClick && (
                  <li>
                    <button
                      onClick={() => onAddClick(group.id)}
                      className="px-1.5 py-1 text-sm text-ink-muted transition-colors hover:text-accent"
                    >
                      + Add bookmark
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
