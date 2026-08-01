export interface GeminiImageResult {
  dataUrl: string
  mimeType: string
}

/**
 * Calls the Gemini generateContent REST endpoint asking for an IMAGE response.
 * Runs directly from the browser using a user-supplied API key (see ApiKeyInput) —
 * fine for personal/local use, but the key is visible in network requests made
 * from this page, so never deploy this build publicly with a key baked in.
 */
export async function generateWrapImage(
  apiKey: string,
  modelId: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeminiImageResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
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

  const data = await res.json()
  const parts: Array<{ inlineData?: { mimeType: string; data: string } }> =
    data?.candidates?.[0]?.content?.parts ?? []

  const imagePart = parts.find((p) => p.inlineData?.data)
  if (!imagePart?.inlineData) {
    const finishReason = data?.candidates?.[0]?.finishReason
    throw new Error(
      `The model did not return an image${finishReason ? ` (finishReason: ${finishReason})` : ''}. Try a different theme description or model.`,
    )
  }

  return {
    dataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
    mimeType: imagePart.inlineData.mimeType,
  }
}
