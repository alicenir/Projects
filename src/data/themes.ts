export interface WrapTheme {
  id: string
  label: string
  examples: string[]
}

export const WRAP_THEMES: WrapTheme[] = [
  { id: 'gaming', label: 'Gaming', examples: ['Cyberpunk 2077', 'Halo', 'The Legend of Zelda', 'Fortnite', 'Minecraft'] },
  { id: 'movies', label: 'Movies', examples: ['Star Wars', 'Blade Runner', 'Tron', 'Mad Max', 'Marvel'] },
  { id: 'tv', label: 'TV Shows', examples: ['Stranger Things', 'Breaking Bad', 'The Mandalorian', 'Rick and Morty'] },
  { id: 'anime', label: 'Anime & Comics', examples: ['Akira', 'Ghost in the Shell', 'Dragon Ball', 'Batman'] },
  { id: 'motorsport', label: 'Motorsport & Racing', examples: ['Le Mans livery', 'Rally stripes', 'F1 team livery'] },
  { id: 'nature', label: 'Nature & Abstract', examples: ['Geometric camo', 'Liquid metal', 'Aurora borealis', 'Carbon weave'] },
  { id: 'custom', label: 'Custom', examples: [] },
]

export type WrapIntensity = 'subtle' | 'balanced' | 'bold'

export const WRAP_INTENSITIES: { id: WrapIntensity; label: string; description: string }[] = [
  { id: 'subtle', label: 'Subtle', description: 'Mostly factory paint color with a small accent graphic' },
  { id: 'balanced', label: 'Balanced', description: 'Even mix of theme artwork and factory color' },
  { id: 'bold', label: 'Bold', description: 'Full-coverage themed graphic' },
]
