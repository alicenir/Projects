export interface GeminiImageModel {
  id: string
  label: string
  description: string
}

/** Gemini image-generation models reachable via generateContent + responseModalities: ["IMAGE"]. */
export const GEMINI_IMAGE_MODELS: GeminiImageModel[] = [
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana (fast, stable)', description: 'gemini-2.5-flash-image — best default, low latency' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (highest quality)', description: 'gemini-3-pro-image-preview — slower, best detail' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (preview)', description: 'gemini-3.1-flash-image-preview — newer preview model' },
]
