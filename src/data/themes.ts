export interface WrapTheme {
  id: string
  label: string
  examples: string[]
}

export const WRAP_THEMES: WrapTheme[] = [
  {
    id: 'gaming',
    label: 'Gaming',
    examples: [
      'Cyberpunk 2077',
      'Halo',
      'The Legend of Zelda',
      'Fortnite',
      'Minecraft',
      'Doom',
      'Elden Ring',
      'Portal',
      'Mario Kart',
      'Street Fighter',
    ],
  },
  {
    id: 'movies',
    label: 'Movies',
    examples: [
      'Star Wars',
      'Blade Runner',
      'Tron',
      'Mad Max',
      'Marvel',
      'Jurassic Park',
      'Back to the Future',
      'The Matrix',
      'Top Gun',
      'Ghostbusters',
    ],
  },
  {
    id: 'tv',
    label: 'TV Shows',
    examples: [
      'Stranger Things',
      'Breaking Bad',
      'The Mandalorian',
      'Rick and Morty',
      'Game of Thrones',
      'The Simpsons',
      'Doctor Who',
      'Squid Game',
    ],
  },
  {
    id: 'anime',
    label: 'Anime & Comics',
    examples: [
      'Akira',
      'Ghost in the Shell',
      'Dragon Ball',
      'Batman',
      'Studio Ghibli',
      'Neon Genesis Evangelion',
      'One Piece',
      'Demon Slayer',
      'Spider-Man',
      'Naruto',
    ],
  },
  {
    id: 'motorsport',
    label: 'Motorsport & Racing',
    examples: [
      'Formula 1 team livery',
      'Le Mans racing livery',
      'Rally stripes',
      'Gulf racing blue and orange',
      'Martini racing stripes',
      'NASCAR livery',
      'Racing number roundels',
      'Japanese drift livery',
    ],
  },
  {
    id: 'nature',
    label: 'Nature & Abstract',
    examples: [
      'Geometric camo',
      'Liquid metal',
      'Aurora borealis',
      'Carbon weave',
      'Marble veins',
      'Ocean waves',
      'Galaxy and nebula',
      'Autumn forest',
      'Lightning storm',
      'Iridescent oil slick',
    ],
  },
  {
    id: 'retro',
    label: 'Retro & Graphic',
    examples: [
      'Synthwave grid and neon sunset',
      'Vaporwave pastels',
      'Art deco geometry',
      '1980s memphis pattern',
      'Graffiti street art',
      'Comic book halftone',
      'Pop art',
      'Psychedelic 1970s swirls',
    ],
  },
  { id: 'custom', label: 'Custom', examples: [] },
]

export type WrapIntensity = 'subtle' | 'balanced' | 'bold'

/** All three fill every panel — these describe how busy the artwork inside them is. */
export const WRAP_INTENSITIES: { id: WrapIntensity; label: string; description: string }[] = [
  { id: 'subtle', label: 'Subtle', description: 'Every panel covered, but clean and understated — flat colour with sparse detailing' },
  { id: 'balanced', label: 'Balanced', description: 'Every panel covered, mixing detailed artwork with calmer areas' },
  { id: 'bold', label: 'Bold', description: 'Every panel covered in dense, high-contrast artwork' },
]
