export interface NormalizedImage {
  dataUrl: string
  width: number
  height: number
  sizeBytes: number
}

const MAX_BYTES = 1_000_000 // Tesla wrap spec: ≤ 1 MB
const CANDIDATE_SIZES = [1024, 896, 768, 640, 512] // Tesla wrap spec: 512–1024 px square

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
 * Re-renders any generated image as a square, center-cropped PNG that satisfies
 * the teslamotors/custom-wraps upload spec (512–1024px square, PNG, ≤1MB),
 * shrinking the target size until it fits under the size cap.
 */
export async function normalizeToWrapSpec(dataUrl: string): Promise<NormalizedImage> {
  const img = await loadImage(dataUrl)

  for (const size of CANDIDATE_SIZES) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable.')

    // Cover-crop: scale so the shorter source dimension fills the square, centered.
    const scale = Math.max(size / img.width, size / img.height)
    const drawWidth = img.width * scale
    const drawHeight = img.height * scale
    const dx = (size - drawWidth) / 2
    const dy = (size - drawHeight) / 2
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight)

    const { dataUrl: outUrl, sizeBytes } = await canvasToPngDataUrl(canvas)
    if (sizeBytes <= MAX_BYTES || size === CANDIDATE_SIZES[CANDIDATE_SIZES.length - 1]) {
      return { dataUrl: outUrl, width: size, height: size, sizeBytes }
    }
  }

  throw new Error('Could not shrink image under the 1MB spec limit.')
}

/** Sanitizes a filename to the wrap spec: alphanumeric, underscore, dash, space, max 30 chars. */
export function sanitizeWrapFilename(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
  return (cleaned || 'tesla_wrap').slice(0, 30)
}
