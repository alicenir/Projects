export interface TeslaModel {
  id: string
  name: string
  years: string
  bodyStyle: string
}

export const TESLA_MODELS: TeslaModel[] = [
  { id: 'cybertruck', name: 'Cybertruck', years: '2024+', bodyStyle: 'Angular stainless-steel exoskeleton pickup' },
  { id: 'model3', name: 'Model 3', years: '2024+', bodyStyle: 'Sedan' },
  { id: 'modely', name: 'Model Y', years: '2025', bodyStyle: 'Compact SUV' },
  { id: 'modelyl', name: 'Model Y L', years: '2025', bodyStyle: 'Extended-length SUV' },
  { id: 'models', name: 'Model S', years: '2021+ / Plaid', bodyStyle: 'Sedan' },
  { id: 'modelx', name: 'Model X', years: '2021+', bodyStyle: 'SUV with falcon-wing doors' },
]

export interface WrapPanel {
  id: string
  label: string
  description: string
  /** Panels that never receive AI artwork (e.g. the glass roof) */
  disabled?: boolean
  disabledReason?: string
  /** Extra directive baked into every prompt for this panel */
  orientationNote?: string
}

export const WRAP_PANELS: WrapPanel[] = [
  {
    id: 'frunk',
    label: 'Frunk / Hood',
    description: 'Front hood panel above the frunk',
    orientationNote:
      'This panel sits at the very front of the car, ahead of the windshield. Compose the artwork so its focal subject (character, logo, creature, vehicle, or any directional element) faces and points toward the front of the vehicle — never toward the rear or off to the side — the way a hood graphic should read correctly when the car is viewed from the front or front three-quarter angle.',
  },
  {
    id: 'doors',
    label: 'Doors & Sides',
    description: 'Side doors and rocker panels',
    orientationNote:
      'This is a side panel running along the length of the door. The design should read naturally left-to-right as the car is viewed from the side, with any directional motion (speed lines, characters, motion blur) pointing toward the front of the car.',
  },
  {
    id: 'rear',
    label: 'Rear / Trunk',
    description: 'Rear trunk lid or tailgate panel',
    orientationNote:
      'This is the rear panel, viewed from directly behind the car. Any directional elements (logos, characters, text) should face outward toward the viewer standing behind the vehicle.',
  },
  {
    id: 'roof',
    label: 'Roof',
    description: 'Panoramic glass roof',
    disabled: true,
    disabledReason:
      'This is a glass roof, not a paintable panel. No image or background is ever generated or applied here — it is intentionally left out of every wrap set.',
  },
]
