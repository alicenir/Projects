export interface GeminiImageResult {
  dataUrl: string
  mimeType: string
}

export interface InputImage {
  base64: string
  mimeType: string
}

interface GenerateContentResponse {
  candidates?: Array<{
    finishReason?: string
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: { mimeType: string; data: string }
      }>
    }
  }>
}

/**
 * Calls the Gemini generateContent REST endpoint asking for an IMAGE response.
 * When `inputImage` is provided (e.g. a Tesla wrap template), it's sent alongside
 * the text prompt so the model edits/fills that image rather than generating one
 * from scratch.
 *
 * Runs directly from the browser using a user-supplied API key (see ApiKeyInput) —
 * fine for personal/local use, but the key is visible in network requests made
 * from this page, so never deploy this build publicly with a key baked in.
 */
export async function generateWrapImage(
  apiKey: string,
  modelId: string,
  prompt: string,
  inputImage?: InputImage,
  signal?: AbortSignal,
): Promise<GeminiImageResult> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ]
  if (inputImage) {
    parts.push({ inlineData: { mimeType: inputImage.mimeType, data: inputImage.base64 } })
  }

  const data = await callGenerateContent(apiKey, modelId, parts, ['IMAGE'], signal)

  const resultParts: Array<{ inlineData?: { mimeType: string; data: string } }> =
    data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = resultParts.find((p) => p.inlineData?.data)
  if (!imagePart?.inlineData) {
    const finishReason = data?.candidates?.[0]?.finishReason
    throw new Error(
      `The model did not return an image${finishReason ? ` (finishReason: ${finishReason})` : ''}. Try a different description or model.`,
    )
  }

  return {
    dataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
    mimeType: imagePart.inlineData.mimeType,
  }
}

const CONCEPT_TEXT_MODEL = 'gemini-2.5-flash'

/** Asks a fast Gemini text model to invent a short creative wrap concept (used by "AI Wrap Generation"). */
export async function generateConceptText(apiKey: string, prompt: string, signal?: AbortSignal): Promise<string> {
  const data = await callGenerateContent(apiKey, CONCEPT_TEXT_MODEL, [{ text: prompt }], ['TEXT'], signal)
  const resultParts: Array<{ text?: string }> = data?.candidates?.[0]?.content?.parts ?? []
  const text = resultParts.map((p) => p.text ?? '').join('').trim()
  if (!text) throw new Error('The model did not return a concept. Try again.')
  return text
}

async function callGenerateContent(
  apiKey: string,
  modelId: string,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  responseModalities: string[],
  signal?: AbortSignal,
): Promise<GenerateContentResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities },
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errBody = await res.json()
      detail = errBody?.error?.message ?? JSON.stringify(errBody)
    } catch {
      detail = await res.text()
    }
    throw new Error(`Gemini API error (${res.status}): ${detail || res.statusText}`)
  }

  return res.json()
}
