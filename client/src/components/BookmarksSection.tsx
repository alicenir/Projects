import { useStore } from "../store/useStore";
import type { Item } from "../types";
import { AppGrid } from "./AppGrid";

interface Props {
  bookmarks: Item[];
  onEdit: (item: Item) => void;
  onAddClick?: (categoryId: number | null) => void;
}

export function BookmarksSection({ bookmarks, onEdit, onAddClick }: Props) {
  const categories = useStore((s) => s.categories);
  const editMode = useStore((s) => s.editMode);

  const grouped = categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cat) => ({
      category: cat,
      items: bookmarks.filter((b) => b.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0 || editMode);

  const uncategorized = bookmarks.filter((b) => b.category_id === null);

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(({ category, items }) => (
        <section key={category.id}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {category.name}
          </h2>
          <AppGrid items={items} onEdit={onEdit} onAddClick={onAddClick ? () => onAddClick(category.id) : undefined} />
        </section>
      ))}

      {(uncategorized.length > 0 || editMode) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Bookmarks
          </h2>
          <AppGrid
            items={uncategorized}
            onEdit={onEdit}
            onAddClick={onAddClick ? () => onAddClick(null) : undefined}
          />
        </section>
      )}
    </div>
  );
}
