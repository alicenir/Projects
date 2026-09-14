/** Shared vocabulary: grape-name normalisation and tasting-note descriptors. */

export const BODY_ORDER = ['Very light-bodied', 'Light-bodied', 'Medium-bodied', 'Full-bodied', 'Very full-bodied'];
export const ACIDITY_ORDER = ['Low', 'Medium', 'High'];
export const TYPE_ORDER = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Dessert/Port'];

/**
 * X-Wines writes grapes like "Muscat/Moscato" or "Garnacha/Grenache"; Wine
 * Enthusiast writes varieties like "Muscat" or "Grenache". Normalising both to
 * the same key is what lets critic scores and prices attach to a grape page.
 */
const ALIASES: Record<string, string> = {
  'pinot noir': 'pinot noir',
  'pinot nero': 'pinot noir',
  'spatburgunder': 'pinot noir',
  'pinot gris': 'pinot gris',
  'pinot grigio': 'pinot gris',
  'grauburgunder': 'pinot gris',
  'pinot blanc': 'pinot blanc',
  'weissburgunder': 'pinot blanc',
  'shiraz': 'syrah',
  'syrah': 'syrah',
  'grenache': 'grenache',
  'garnacha': 'grenache',
  'garnacha tinta': 'grenache',
  'tempranillo': 'tempranillo',
  'tinta roriz': 'tempranillo',
  'aragonez': 'tempranillo',
  'tinto fino': 'tempranillo',
  'sangiovese': 'sangiovese',
  'sangiovese grosso': 'sangiovese',
  'brunello': 'sangiovese',
  'nielluccio': 'sangiovese',
  'monastrell': 'mourvedre',
  'mourvedre': 'mourvedre',
  'mataro': 'mourvedre',
  'carignan': 'carignan',
  'carinena': 'carignan',
  'mazuelo': 'carignan',
  'zinfandel': 'zinfandel',
  'primitivo': 'zinfandel',
  'malbec': 'malbec',
  'cot': 'malbec',
  'muscat': 'muscat',
  'moscato': 'muscat',
  'moscatel': 'muscat',
  'muscat blanc': 'muscat',
  'gewurztraminer': 'gewurztraminer',
  'traminer': 'gewurztraminer',
  'gruner veltliner': 'gruner veltliner',
  'alvarinho': 'albarino',
  'albarino': 'albarino',
  'chenin blanc': 'chenin blanc',
  'steen': 'chenin blanc',
  'ugni blanc': 'trebbiano',
  'trebbiano': 'trebbiano',
  'melon de bourgogne': 'muscadet',
  'muscadet': 'muscadet',
  'macabeo': 'viura',
  'viura': 'viura',
  'cabernet sauvignon': 'cabernet sauvignon',
  'cabernet franc': 'cabernet franc',
  'merlot': 'merlot',
  'chardonnay': 'chardonnay',
  'sauvignon blanc': 'sauvignon blanc',
  'fume blanc': 'sauvignon blanc',
  'riesling': 'riesling',
  'nebbiolo': 'nebbiolo',
  'barolo': 'nebbiolo',
  'barbaresco': 'nebbiolo',
};

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Map any spelling of a grape onto a stable lookup key. */
export function grapeKey(raw: string): string {
  let s = stripAccents(String(raw || '')).toLowerCase().trim();
  s = s.split('/')[0].trim();            // "Muscat/Moscato" -> "muscat"
  s = s.replace(/\([^)]*\)/g, ' ');       // drop parentheticals
  s = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIASES[s] ?? s;
}

/** Title-case a grape key for display when we have no original spelling. */
export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Flavour vocabulary used to turn 130K tasting notes into something countable.
 * Multi-word terms are matched as bigrams/trigrams before single words.
 */
export const DESCRIPTOR_FAMILIES: Record<string, string[]> = {
  'Red fruit': ['cherry', 'raspberry', 'strawberry', 'cranberry', 'red fruit', 'red berry', 'redcurrant', 'pomegranate'],
  'Dark fruit': ['blackberry', 'blackcurrant', 'black cherry', 'cassis', 'plum', 'black fruit', 'blueberry', 'boysenberry', 'dark fruit', 'damson'],
  'Citrus': ['lemon', 'lime', 'grapefruit', 'orange peel', 'citrus', 'tangerine', 'zest', 'mandarin'],
  'Orchard fruit': ['apple', 'pear', 'quince', 'peach', 'apricot', 'nectarine', 'white peach'],
  'Tropical': ['pineapple', 'mango', 'passion fruit', 'guava', 'papaya', 'lychee', 'melon', 'banana'],
  'Dried fruit': ['fig', 'raisin', 'prune', 'date', 'dried fruit', 'candied fruit', 'marmalade'],
  Floral: ['rose', 'violet', 'jasmine', 'lavender', 'honeysuckle', 'elderflower', 'blossom', 'floral', 'potpourri'],
  Herbal: ['mint', 'eucalyptus', 'sage', 'thyme', 'herbal', 'herbs', 'bell pepper', 'green pepper', 'grass', 'hay', 'fennel', 'basil', 'tomato leaf'],
  Spice: ['pepper', 'white pepper', 'cinnamon', 'clove', 'nutmeg', 'anise', 'licorice', 'ginger', 'spice', 'cardamom'],
  'Oak & toast': ['oak', 'vanilla', 'toast', 'smoke', 'cedar', 'chocolate', 'mocha', 'coffee', 'espresso', 'caramel', 'butterscotch', 'coconut', 'sandalwood', 'char'],
  'Earth & savoury': ['earth', 'forest floor', 'mushroom', 'truffle', 'tobacco', 'leather', 'game', 'meaty', 'iron', 'tar', 'graphite', 'smoked meat', 'soy'],
  Mineral: ['mineral', 'minerality', 'flint', 'chalk', 'saline', 'wet stone', 'slate', 'petrol', 'gunflint'],
  'Cream & nuts': ['honey', 'butter', 'cream', 'yeast', 'brioche', 'almond', 'hazelnut', 'walnut', 'biscuit', 'nutty', 'lees'],
};

export const STRUCTURE_TERMS = [
  'tannins', 'acidity', 'crisp', 'silky', 'velvety', 'austere', 'plush', 'juicy', 'lush',
  'firm', 'ripe', 'fresh', 'dense', 'elegant', 'structured', 'oaky', 'dry', 'sweet',
  'full-bodied', 'light-bodied', 'medium-bodied', 'balanced', 'concentrated', 'supple', 'grippy',
];

export type DescriptorTerm = { term: string; family: string; words: number };

export const DESCRIPTOR_TERMS: DescriptorTerm[] = Object.entries(DESCRIPTOR_FAMILIES)
  .flatMap(([family, terms]) => terms.map((term) => ({ term, family, words: term.split(' ').length })))
  .concat(STRUCTURE_TERMS.map((term) => ({ term, family: 'Structure', words: term.split(' ').length })))
  .sort((a, b) => b.words - a.words);

const TERM_INDEX = new Map(DESCRIPTOR_TERMS.map((t) => [t.term, t]));

/** Descriptors mentioned in one tasting note, de-duplicated. */
export function extractDescriptors(text: string): DescriptorTerm[] {
  const clean = stripAccents(String(text || '').toLowerCase()).replace(/[^a-z0-9\- ]+/g, ' ');
  const tokens = clean.split(/\s+/).filter(Boolean);
  const hits = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 3; len >= 1; len--) {
      if (i + len > tokens.length) continue;
      const phrase = tokens.slice(i, i + len).join(' ');
      const singular = phrase.replace(/s$/, '');
      const match = TERM_INDEX.get(phrase) ?? TERM_INDEX.get(singular) ?? TERM_INDEX.get(`${phrase}s`);
      if (match) {
        hits.add(match.term);
        break;
      }
    }
  }
  return [...hits].map((t) => TERM_INDEX.get(t)!);
}

/** Wine Enthusiast titles look like "Ponzi 2013 Reserve Pinot Noir (Willamette)". */
export function vintageFromTitle(title: string): number | null {
  const m = String(title || '').match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (!m) return null;
  return Number(m[1]);
}

/**
 * Wine Enthusiast names countries, X-Wines codes them (and uses UK, not GB).
 * Only wine-producing countries that actually appear in the data are listed.
 */
export const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  argentina: 'AR', armenia: 'AM', australia: 'AU', austria: 'AT', 'bosnia and herzegovina': 'BA',
  brazil: 'BR', bulgaria: 'BG', canada: 'CA', chile: 'CL', china: 'CN', croatia: 'HR', cyprus: 'CY',
  'czech republic': 'CZ', england: 'UK', 'united kingdom': 'UK', france: 'FR', georgia: 'GE',
  germany: 'DE', greece: 'GR', hungary: 'HU', india: 'IN', israel: 'IL', italy: 'IT', japan: 'JP',
  lebanon: 'LB', luxembourg: 'LU', macedonia: 'MK', malta: 'MT', mexico: 'MX', moldova: 'MD',
  morocco: 'MA', 'new zealand': 'NZ', peru: 'PE', portugal: 'PT', romania: 'RO', russia: 'RU',
  serbia: 'RS', slovakia: 'SK', slovenia: 'SI', 'south africa': 'ZA', spain: 'ES', switzerland: 'CH',
  turkey: 'TR', ukraine: 'UA', uruguay: 'UY', us: 'US', 'united states': 'US',
};

export function countryCode(name: string): string | null {
  const key = stripAccents(String(name || '')).toLowerCase().trim();
  return COUNTRY_CODE_BY_NAME[key] ?? null;
}
