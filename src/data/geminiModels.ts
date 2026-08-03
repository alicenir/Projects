export type FreeTier = 'yes' | 'no' | 'unknown'

export interface GeminiImageModel {
  id: string
  label: string
  description: string
  freeTier: FreeTier
  /** Shown when this model is selected, to set expectations before the first call. */
  note?: string
}

export interface GeminiTextModel {
  id: string
  label: string
  description: string
}

/**
 * Text models used by "AI Wrap Generation" to invent a concept.
 *
 * Kept as a user-visible list rather than a hardcoded constant: the previous
 * hardcoded gemini-2.5-flash started returning 404 "no longer available to new
 * users" when Google retired it, which silently broke the button. Selecting the
 * model also means the call runs on whatever account tier you've chosen instead
 * of a fixed default.
 */
export const GEMINI_TEXT_MODELS: GeminiTextModel[] = [
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: 'gemini-3.6-flash — current general-purpose Flash model',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    description: 'gemini-3.5-flash-lite — cheapest and fastest',
  },
]

/** Gemini image-generation models reachable via generateContent + responseModalities: ["IMAGE"]. */
export const GEMINI_IMAGE_MODELS: GeminiImageModel[] = [
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana — free tier',
    description: 'gemini-2.5-flash-image — best default, low latency, generous free quota',
    freeTier: 'yes',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro — billing required',
    description: 'gemini-3-pro-image-preview — best detail, but no free quota',
    freeTier: 'no',
    note: 'This model has no free tier — calls fail with a 429 quota error unless billing is enabled on your Google Cloud project.',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2 (preview)',
    description: 'gemini-3.1-flash-image-preview — newer preview model',
    freeTier: 'unknown',
    note: 'Preview model — free-tier availability varies and it may require billing on your account.',
  },
]
