export interface TeslaColor {
  id: string
  name: string
  hex: string
}

/**
 * Current Tesla factory paint options (approximate swatch hexes — Tesla doesn't
 * publish exact color values, these are close visual references for prompting),
 * plus a custom fallback for anything else.
 */
export const TESLA_COLORS: TeslaColor[] = [
  { id: 'pearl-white', name: 'Pearl White Multi-Coat', hex: '#F2F2EC' },
  { id: 'solid-black', name: 'Solid Black', hex: '#171718' },
  { id: 'stealth-grey', name: 'Stealth Grey', hex: '#54595D' },
  { id: 'quicksilver', name: 'Quicksilver', hex: '#C7C9CB' },
  { id: 'diamond-black', name: 'Diamond Black Multi-Coat', hex: '#0A0A0A' },
  { id: 'deep-blue', name: 'Deep Blue Metallic', hex: '#1B3A67' },
  { id: 'glacier-blue', name: 'Glacier Blue', hex: '#A9C9DA' },
  { id: 'frost-blue', name: 'Frost Blue', hex: '#C7D9E3' },
  { id: 'marine-blue', name: 'Marine Blue', hex: '#1E3F56' },
  { id: 'ultra-red', name: 'Ultra Red', hex: '#B10F1D' },
  { id: 'custom', name: 'Custom color', hex: '#8A8D90' },
]
