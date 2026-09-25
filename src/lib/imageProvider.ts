import { generateWrapImage, generateConceptText, type GeminiImageResult, type InputImage } from './gemini'
import { generateGrokImage, generateGrokText } from './grok'

export type Provider = 'gemini' | 'grok'

export interface ProviderSettings {
  provider: Provider
  apiKey: string
  geminiModelId: string
  geminiTextModelId: string
  xaiKey: string
  grokModelId: string
  grokTextModelId: string
}

export function activeKey(s: ProviderSettings): string {
  return (s.provider === 'grok' ? s.xaiKey : s.apiKey).trim()
}

/**
 * Generates an image from the prompt and input images with whichever provider is
 * selected. `aspectRatio` is only honoured by Grok; Gemini follows its inputs.
 */
export function generateImage(
  s: ProviderSettings,
  prompt: string,
  inputImages: InputImage[],
  aspectRatio?: string,
): Promise<GeminiImageResult> {
  return s.provider === 'grok'
    ? generateGrokImage(activeKey(s), s.grokModelId, prompt, inputImages, aspectRatio)
    : generateWrapImage(activeKey(s), s.geminiModelId, prompt, inputImages)
}

export function generateConcept(s: ProviderSettings, prompt: string): Promise<string> {
  return s.provider === 'grok'
    ? generateGrokText(activeKey(s), s.grokTextModelId, prompt)
    : generateConceptText(activeKey(s), s.geminiTextModelId, prompt)
}
