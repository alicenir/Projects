const RAW_BASE = 'https://raw.githubusercontent.com/teslamotors/custom-wraps/master'

export interface TeslaModel {
  /** Matches the folder name in teslamotors/custom-wraps exactly. */
  id: string
  /** Display name exactly as shown in the repo README. */
  name: string
  /** Trim/variant subtitle exactly as shown in the repo README, if any. */
  subtitle?: string
  /**
   * Distinguishing front-end features, used to pin the generation in on-car
   * previews. The reference render alone isn't enough: several nameplates span
   * facelifts that look quite different, and image models default to whichever
   * generation dominates their training data — usually the older one.
   */
  renderNotes: string
  templateUrl: string
  vehicleImageUrl: string
  repoUrl: string
}

function model(id: string, name: string, renderNotes: string, subtitle?: string): TeslaModel {
  return {
    id,
    name,
    subtitle,
    renderNotes,
    templateUrl: `${RAW_BASE}/${id}/template.png`,
    vehicleImageUrl: `${RAW_BASE}/${id}/vehicle_image.png`,
    repoUrl: `https://github.com/teslamotors/custom-wraps/tree/master/${id}`,
  }
}

const MODEL_Y_JUNIPER =
  'the 2025 "Juniper" facelift: a single full-width LED light bar running edge to edge across the very front of the nose, slim angular headlights set LOW down in the bumper below it, and a completely smooth badgeless nose. It is NOT the earlier Model Y — no teardrop-shaped headlights high on the fascia, and no Tesla T badge on the nose.'

const MODEL_Y_PRE_REFRESH =
  'the original pre-2025 Model Y: a rounded nose with teardrop-shaped headlights set high on the fascia and a Tesla T badge on the nose. It has NO full-width light bar across the front.'

const MODEL_3_HIGHLAND =
  'the 2024 "Highland" facelift: a sharply pointed smooth nose with very slim angular headlights and no badge. It is NOT the earlier Model 3 with rounded teardrop headlights.'

const MODEL_3_ORIGINAL =
  'the original pre-2024 Model 3: a rounded nose with teardrop-shaped headlights and a Tesla T badge.'

/** Exact set and order of vehicles listed in the teslamotors/custom-wraps README. */
export const TESLA_MODELS: TeslaModel[] = [
  model('cybertruck', 'Cybertruck', 'an angular stainless-steel exoskeleton pickup made of flat unpainted planes with no curved bodywork.'),
  model('model3', 'Model 3', MODEL_3_ORIGINAL),
  model('model3-2024-base', 'Model 3 (2024+)', MODEL_3_HIGHLAND, 'Standard & Premium'),
  model('model3-2024-performance', 'Model 3 (2024+)', MODEL_3_HIGHLAND, 'Performance'),
  model('modely', 'Model Y', MODEL_Y_PRE_REFRESH),
  model('modely-2025-base', 'Model Y (2025+)', MODEL_Y_JUNIPER, 'Standard'),
  model('modely-2025-premium', 'Model Y (2025+)', MODEL_Y_JUNIPER, 'Premium'),
  model('modely-2025-performance', 'Model Y (2025+)', MODEL_Y_JUNIPER, 'Performance'),
  model('modely-l', 'Model Y L', `an extended three-row Model Y with a longer body and taller rear roofline, sharing ${MODEL_Y_JUNIPER}`),
  model('models-2021', 'Model S (2021+)', 'a low, wide liftback sedan with a smooth badgeless nose and a long sloping roofline.'),
  model('models-2025-plaid', 'Model S (2025+)', 'a low, wide liftback sedan in its latest Plaid form, with a smooth badgeless nose and a long sloping roofline.', 'Plaid'),
  model('modelx-2021', 'Model X (2021+)', 'a large SUV with falcon-wing rear doors and a smooth badgeless nose.'),
]
