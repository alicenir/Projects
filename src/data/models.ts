const RAW_BASE = 'https://raw.githubusercontent.com/teslamotors/custom-wraps/master'

export interface TeslaModel {
  /** Matches the folder name in teslamotors/custom-wraps exactly. */
  id: string
  /** Display name exactly as shown in the repo README. */
  name: string
  /** Trim/variant subtitle exactly as shown in the repo README, if any. */
  subtitle?: string
  templateUrl: string
  vehicleImageUrl: string
  repoUrl: string
}

function model(id: string, name: string, subtitle?: string): TeslaModel {
  return {
    id,
    name,
    subtitle,
    templateUrl: `${RAW_BASE}/${id}/template.png`,
    vehicleImageUrl: `${RAW_BASE}/${id}/vehicle_image.png`,
    repoUrl: `https://github.com/teslamotors/custom-wraps/tree/master/${id}`,
  }
}

/** Exact set and order of vehicles listed in the teslamotors/custom-wraps README. */
export const TESLA_MODELS: TeslaModel[] = [
  model('cybertruck', 'Cybertruck'),
  model('model3', 'Model 3'),
  model('model3-2024-base', 'Model 3 (2024+)', 'Standard & Premium'),
  model('model3-2024-performance', 'Model 3 (2024+)', 'Performance'),
  model('modely', 'Model Y'),
  model('modely-2025-base', 'Model Y (2025+)', 'Standard'),
  model('modely-2025-premium', 'Model Y (2025+)', 'Premium'),
  model('modely-2025-performance', 'Model Y (2025+)', 'Performance'),
  model('modely-l', 'Model Y L'),
  model('models-2021', 'Model S (2021+)'),
  model('models-2025-plaid', 'Model S (2025+)', 'Plaid'),
  model('modelx-2021', 'Model X (2021+)'),
]
