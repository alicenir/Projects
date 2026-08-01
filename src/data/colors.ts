export interface TeslaColor {
  id: string
  name: string
  hex: string
}

/** Common factory paint colors across current Tesla lineups, plus a custom fallback. */
export const TESLA_COLORS: TeslaColor[] = [
  { id: 'pearl-white', name: 'Pearl White Multi-Coat', hex: '#F2F2EC' },
  { id: 'solid-black', name: 'Solid Black', hex: '#171718' },
  { id: 'stealth-grey', name: 'Stealth Grey', hex: '#54595D' },
  { id: 'quicksilver', name: 'Quicksilver', hex: '#BFC2C4' },
  { id: 'diamond-black', name: 'Diamond Black Multi-Coat', hex: '#0A0A0A' },
  { id: 'deep-blue', name: 'Deep Blue Metallic', hex: '#1B3A67' },
  { id: 'ultra-red', name: 'Ultra Red', hex: '#A8151E' },
  { id: 'custom', name: 'Custom color', hex: '#8A8D90' },
]
