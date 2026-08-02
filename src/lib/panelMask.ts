/**
 * Constrains a generated wrap to the template's real panel geometry.
 *
 * Tesla's templates are not silhouettes — they are scattered islands of body
 * panels drawn as closed outlines, and everything else (the background *and* the
 * large central gap where the glass roof and greenhouse sit) must stay empty.
 * Their own example wraps confirm it: modely-2025-premium/example/Doge.png paints
 * only the outlined panels and leaves the whole centre transparent.
 *
 * Asking the image model to respect that never worked reliably, so instead of
 * trusting the prompt we rebuild the output: flood-fill inward from the canvas
 * border through everything that isn't an outline. Anything the fill reaches is
 * outside a panel and becomes fully transparent; anything it cannot reach is a
 * panel interior and keeps the generated artwork. The template's own outlines are
 * then drawn back on top so the geometry is pixel-exact rather than whatever the
 * model redrew.
 */

/** Luminance below this counts as a printed outline that blocks the flood fill. */
const OUTLINE_LUMA = 160

export interface MaskedResult {
  dataUrl: string
  /** Fraction of the canvas that ended up as paintable panel area (diagnostics). */
  panelRatio: number
  /** Panels big enough to matter that came back essentially unpainted. */
  blankPanels: number
}

/** A pixel this pale counts as "unpainted" when judging whether a panel was skipped. */
const NEAR_WHITE = 236
/** Ignore slivers — only panels at least this fraction of the canvas are judged. */
const SIGNIFICANT_PANEL = 0.004
/** Above this share of near-white pixels, a panel is treated as left blank. */
const BLANK_THRESHOLD = 0.9

/**
 * Labels each connected panel interior and counts how many significant ones came
 * back essentially white. The image model intermittently skips a panel — most
 * often the large hood — and this makes that detectable instead of something the
 * user has to notice by eye.
 */
function countBlankPanels(
  width: number,
  height: number,
  paintable: Uint8Array,
  art: Uint8ClampedArray,
): number {
  const seen = new Uint8Array(width * height)
  const minArea = width * height * SIGNIFICANT_PANEL
  let blank = 0

  for (let start = 0; start < paintable.length; start++) {
    if (!paintable[start] || seen[start]) continue

    const stack = [start]
    seen[start] = 1
    let area = 0
    let pale = 0

    while (stack.length) {
      const p = stack.pop()!
      area++
      const i = p * 4
      if (art[i] > NEAR_WHITE && art[i + 1] > NEAR_WHITE && art[i + 2] > NEAR_WHITE) pale++

      const x = p % width
      const y = (p - x) / width
      const neighbours = [
        x + 1 < width ? p + 1 : -1,
        x - 1 >= 0 ? p - 1 : -1,
        y + 1 < height ? p + width : -1,
        y - 1 >= 0 ? p - width : -1,
      ]
      for (const n of neighbours) {
        if (n >= 0 && paintable[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }

    if (area >= minArea && pale / area > BLANK_THRESHOLD) blank++
  }

  return blank
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image for masking.'))
    img.src = src
  })
}

/**
 * Marks every pixel reachable from the canvas border without crossing an outline.
 * Uses an explicit stack — a recursive fill overflows on a 1024x1024 template.
 */
function computeMasks(templateData: ImageData): { outside: Uint8Array; isOutline: Uint8Array } {
  const { width, height, data } = templateData
  const outside = new Uint8Array(width * height)
  const isOutline = new Uint8Array(width * height)

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const alpha = data[i + 3]
    // Transparent template pixels are open space, not outlines.
    if (alpha < 16) continue
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luma < OUTLINE_LUMA) isOutline[p] = 1
  }

  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const p = y * width + x
    if (outside[p] || isOutline[p]) return
    outside[p] = 1
    stack.push(p)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (stack.length) {
    const p = stack.pop()!
    const x = p % width
    const y = (p - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  return { outside, isOutline }
}

/**
 * Composites `generatedDataUrl` through `templateDataUrl`'s panel geometry.
 * Returns a PNG with transparent background, matching how Tesla ships its own examples.
 */
export async function maskToPanels(generatedDataUrl: string, templateDataUrl: string): Promise<MaskedResult> {
  const [template, generated] = await Promise.all([loadImage(templateDataUrl), loadImage(generatedDataUrl)])

  const width = template.naturalWidth
  const height = template.naturalHeight

  const templateCanvas = document.createElement('canvas')
  templateCanvas.width = width
  templateCanvas.height = height
  const templateCtx = templateCanvas.getContext('2d', { willReadFrequently: true })
  if (!templateCtx) throw new Error('Canvas 2D context unavailable.')
  templateCtx.drawImage(template, 0, 0)
  const templateData = templateCtx.getImageData(0, 0, width, height)

  const { outside, isOutline } = computeMasks(templateData)

  // Draw the generated art scaled to cover the template's exact dimensions.
  const artCanvas = document.createElement('canvas')
  artCanvas.width = width
  artCanvas.height = height
  const artCtx = artCanvas.getContext('2d', { willReadFrequently: true })
  if (!artCtx) throw new Error('Canvas 2D context unavailable.')
  const scale = Math.max(width / generated.naturalWidth, height / generated.naturalHeight)
  const drawW = generated.naturalWidth * scale
  const drawH = generated.naturalHeight * scale
  artCtx.drawImage(generated, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH)
  const artData = artCtx.getImageData(0, 0, width, height)

  // Keep artwork only inside panel interiors. The background, the central roof and
  // greenhouse gap, and the printed outlines themselves all become transparent —
  // the outlines are panel gaps on the real car, which is how Tesla's own examples
  // render them.
  let panelPixels = 0
  const paintable = new Uint8Array(outside.length)
  for (let p = 0, i = 0; p < outside.length; p++, i += 4) {
    if (outside[p] || isOutline[p]) {
      artData.data[i + 3] = 0
    } else {
      artData.data[i + 3] = 255
      paintable[p] = 1
      panelPixels++
    }
  }

  const blankPanels = countBlankPanels(width, height, paintable, artData.data)
  artCtx.putImageData(artData, 0, 0)

  return {
    dataUrl: artCanvas.toDataURL('image/png'),
    panelRatio: panelPixels / (width * height),
    blankPanels,
  }
}
