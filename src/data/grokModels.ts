export interface GrokModel {
  id: string
  label: string
  description: string
}

/** xAI image models reachable via /v1/images/edits, which takes the template as an input image. */
export const GROK_IMAGE_MODELS: GrokModel[] = [
  {
    id: 'grok-imagine-image-2.0',
    label: 'Grok Imagine Image 2.0',
    description: 'grok-imagine-image-2.0 — current model, about $0.04–0.06 per image plus $0.01 per input image',
  },
  {
    id: 'grok-imagine-image',
    label: 'Grok Imagine Image (previous)',
    description: 'grok-imagine-image — previous generation, kept as a fallback',
  },
]

/** Text models used by "AI Wrap Generation" when Grok is the provider. */
export const GROK_TEXT_MODELS: GrokModel[] = [
  {
    id: 'grok-4.7',
    label: 'Grok 4.7',
    description: 'grok-4.7 — current general-purpose model',
  },
  {
    id: 'grok-4.6',
    label: 'Grok 4.6',
    description: 'grok-4.6 — previous model',
  },
]
