/** Wine-type colours, in the order validated for colour-blind separation. */
export const TYPE_COLORS: Record<string, string> = {
  Red: 'var(--wine-red)',
  'Dessert/Port': 'var(--wine-port)',
  Dessert: 'var(--wine-dessert)',
  Sparkling: 'var(--wine-sparkling)',
  White: 'var(--wine-white)',
  'Rosé': 'var(--wine-rose)',
};

export const TYPE_ORDER = ['Red', 'Dessert/Port', 'Dessert', 'Sparkling', 'White', 'Rosé'];

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];

export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'var(--series-1)';
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function num(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `$${n >= 100 ? Math.round(n) : n.toFixed(n % 1 ? 2 : 0)}`;
}

export function vintageRange(wine: { vintage_min: number | null; vintage_max: number | null; non_vintage: number }): string {
  if (wine.vintage_min && wine.vintage_max) {
    return wine.vintage_min === wine.vintage_max ? String(wine.vintage_max) : `${wine.vintage_min}–${wine.vintage_max}`;
  }
  return wine.non_vintage ? 'Non-vintage' : '—';
}

/** Flag emoji from an ISO country code — a small visual anchor in dense lists. */
export function flag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🍇';
  const iso = code === 'UK' ? 'GB' : code;
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const PAIRING_ICONS: Record<string, string> = {
  Beef: '🥩', Lamb: '🍖', Pork: '🐖', Veal: '🍽️', Poultry: '🍗', Chicken: '🍗', 'Game Meat': '🦌',
  'Cured Meat': '🥓', 'Rich Fish': '🐟', 'Lean Fish': '🐠', Fish: '🐟', Shellfish: '🦐', Seafood: '🦞',
  Pasta: '🍝', Pizza: '🍕', Risotto: '🍚', Vegetarian: '🥗', Salad: '🥬', Mushrooms: '🍄',
  'Hard Cheese': '🧀', 'Soft Cheese': '🧀', 'Goat Cheese': '🧀', 'Blue Cheese': '🧀', 'Maturated Cheese': '🧀',
  'Spicy Food': '🌶️', Appetizer: '🫒', Snack: '🥨', 'Sweet Dessert': '🍮', 'Fruit Dessert': '🍓',
  Cake: '🍰', Fruit: '🍎', Aperitif: '🥂',
};

export function pairingIcon(name: string): string {
  return PAIRING_ICONS[name] ?? '🍽️';
}

export function slug(value: string): string {
  return encodeURIComponent(value);
}
