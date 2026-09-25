import { AccountLevelError, type GeminiImageResult, type InputImage } from './gemini'

/** Aspect ratios Grok Imagine accepts; anything else is left to the model's default. */
const SUPPORTED_RATIOS = new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '2:1', '1:2'])

export function aspectRatioFor(width: number, height: number): string | undefined {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const d = gcd(width, height)
  const ratio = `${width / d}:${height / d}`
  return SUPPORTED_RATIOS.has(ratio) ? ratio : undefined
}

/**
 * Edits the input images with a Grok Imagine model. Requests go through this
 * app's server (/api/xai), which forwards them to api.x.ai — xAI doesn't allow
 * calls straight from a browser.
 */
export async function generateGrokImage(
  apiKey: string,
  modelId: string,
  prompt: string,
  inputImages: InputImage[],
  aspectRatio?: string,
): Promise<GeminiImageResult> {
  const sources = inputImages.map((img) => ({
    type: 'image_url',
    url: `data:${img.mimeType};base64,${img.base64}`,
  }))
  const body: Record<string, unknown> = {
    model: modelId,
    prompt,
    response_format: 'b64_json',
    ...(sources.length === 1 ? { image: sources[0] } : { images: sources }),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
  }

  const data = await callXai<{ data?: Array<{ b64_json?: string; mime_type?: string }> }>(
    apiKey,
    modelId,
    'images/edits',
    body,
  )
  const image = data.data?.[0]
  if (!image?.b64_json) {
    throw new Error('Grok did not return an image. Try a different description or model.')
  }
  const mimeType = image.mime_type ?? sniffMimeType(image.b64_json)
  return { dataUrl: `data:${mimeType};base64,${image.b64_json}`, mimeType }
}

/** Asks a Grok text model to invent a wrap concept (used by "AI Wrap Generation"). */
export async function generateGrokText(apiKey: string, modelId: string, prompt: string): Promise<string> {
  const data = await callXai<{ choices?: Array<{ message?: { content?: string } }> }>(
    apiKey,
    modelId,
    'chat/completions',
    { model: modelId, messages: [{ role: 'user', content: prompt }] },
  )
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Grok did not return a concept. Try again.')
  return text
}

async function callXai<T>(apiKey: string, modelId: string, route: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/xai/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-xai-key': apiKey },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AccountLevelError(
      "Couldn't reach this app's server, which relays Grok requests. Grok needs the Docker or `npm run server` version of the app, not a static-only build.",
    )
  }

  if (res.ok) return res.json()

  let detail = ''
  try {
    const errBody = await res.json()
    detail = errBody?.error?.message ?? errBody?.error ?? JSON.stringify(errBody)
  } catch {
    detail = res.statusText
  }

  if (res.status === 401 || res.status === 403) {
    throw new AccountLevelError(
      `xAI rejected that API key or it has no credits (${detail}). Check it at console.x.ai.`,
    )
  }
  if (res.status === 429) {
    throw new AccountLevelError(`Grok rate limit or spending limit reached. Wait a minute and try again. (${detail})`)
  }
  if (res.status === 404 && /model/i.test(detail)) {
    throw new AccountLevelError(
      `xAI doesn't recognise "${modelId}" — it may have been renamed or retired. Pick another model in the dropdown; if they all fail, update src/data/grokModels.ts.`,
    )
  }
  if (res.status === 502) throw new AccountLevelError(detail)
  throw new Error(`Grok API error (${res.status}): ${detail}`)
}

/** PNG base64 starts "iVBOR", JPEG "/9j/"; default to JPEG, which Grok returns most often. */
function sniffMimeType(base64: string): string {
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg'
}
