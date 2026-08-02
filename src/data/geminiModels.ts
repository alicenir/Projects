export type FreeTier = 'yes' | 'no' | 'unknown'

export interface GeminiImageModel {
  id: string
  label: string
  description: string
  freeTier: FreeTier
  /** Shown when this model is selected, to set expectations before the first call. */
  note?: string
}

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
