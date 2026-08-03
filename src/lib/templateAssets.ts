export interface FetchedImage {
  base64: string
  mimeType: string
  width: number
  height: number
  objectUrl: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read image dimensions.'))
    img.src = objectUrl
  })
}

/**
 * Fetches an image (e.g. a template.png from teslamotors/custom-wraps) and returns
 * both a base64 payload (for sending to Gemini as an input image) and an object URL
 * (for displaying it directly in the browser).
 */
export async function fetchImageAsset(url: string): Promise<FetchedImage> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not load ${url} (HTTP ${res.status}). The teslamotors/custom-wraps repo may have changed or be unreachable.`)
  }
  const mimeType = res.headers.get('content-type') || 'image/png'
  const buffer = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)
  const objectUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }))
  const { width, height } = await readImageDimensions(objectUrl)
  return { base64, mimeType, width, height, objectUrl }
}
