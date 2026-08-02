/**
 * Prepares a finished wrap for the "Preview on car" mockup call.
 *
 * The masked wrap is transparent wherever the car isn't wrapped (glass roof, panel
 * gaps, background). Handing that straight to the image model reads as missing
 * data, so the transparent areas are flattened onto the vehicle's factory paint
 * colour first — the model then sees a complete surface and the unwrapped parts
 * are shown in the colour they will actually be.
 */
export function flattenOnColor(dataUrl: string, hex: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas 2D context unavailable.'))
      ctx.fillStyle = hex
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Could not read the wrap for preview.'))
    img.src = dataUrl
  })
}

/** Splits a data URL into the base64 payload and mime type for the Gemini API. */
export function splitDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Unexpected image format.')
  return { mimeType: match[1], base64: match[2] }
}
