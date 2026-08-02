export interface NormalizedImage {
  dataUrl: string
  width: number
  height: number
  sizeBytes: number
}

const MAX_BYTES = 1_000_000 // Tesla wrap spec: ≤ 1 MB
const MIN_EDGE = 512 // Tesla wrap spec: 512–1024 px per side
const MAX_EDGE = 1024
const SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6, 0.5]

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode generated image.'))
    img.src = dataUrl
  })
}

function canvasToPngDataUrl(canvas: HTMLCanvasElement): Promise<{ dataUrl: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas export failed.'))
      const reader = new FileReader()
      reader.onload = () => resolve({ dataUrl: reader.result as string, sizeBytes: blob.size })
      reader.onerror = () => reject(new Error('Could not read exported image.'))
      reader.readAsDataURL(blob)
    }, 'image/png')
  })
}

/**
 * Re-renders a generated wrap as a PNG that satisfies the teslamotors/custom-wraps
 * upload spec (512–1024px per side, PNG, ≤1MB). Unlike a generic square export,
 * this preserves the aspect ratio of `targetWidth`/`targetHeight` — which should be
 * the source template's own dimensions (e.g. the Cybertruck template is 1024x768,
 * not square) — so the result still matches the template it was generated from.
 */
export async function normalizeToWrapSpec(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number,
): Promise<NormalizedImage> {
  const img = await loadImage(dataUrl)

  // Clamp the template's own aspect ratio into the 512-1024 allowed range first.
  const longEdge = Math.max(targetWidth, targetHeight)
  const baseScale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : longEdge < MIN_EDGE ? MIN_EDGE / longEdge : 1
  const baseWidth = Math.round(targetWidth * baseScale)
  const baseHeight = Math.round(targetHeight * baseScale)

  let lastResult: { dataUrl: string; sizeBytes: number } | null = null
  let lastWidth = baseWidth
  let lastHeight = baseHeight

  for (const step of SCALE_STEPS) {
    const width = Math.max(MIN_EDGE, Math.round(baseWidth * step))
    const height = Math.max(1, Math.round(baseHeight * step))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable.')

    // Cover-fit the generated image onto the template's own proportions, centered.
    const scale = Math.max(width / img.width, height / img.height)
    const drawWidth = img.width * scale
    const drawHeight = img.height * scale
    const dx = (width - drawWidth) / 2
    const dy = (height - drawHeight) / 2
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight)

    const result = await canvasToPngDataUrl(canvas)
    lastResult = result
    lastWidth = width
    lastHeight = height
    if (result.sizeBytes <= MAX_BYTES) break
  }

  if (!lastResult) throw new Error('Could not export image.')
  return { dataUrl: lastResult.dataUrl, width: lastWidth, height: lastHeight, sizeBytes: lastResult.sizeBytes }
}

/** Sanitizes a filename to the wrap spec: alphanumeric, underscore, dash, space, max 30 chars. */
export function sanitizeWrapFilename(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
  return (cleaned || 'tesla_wrap').slice(0, 30)
}
