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

export interface HoodPanel {
  /** 1 for pixels belonging to the hood panel. */
  mask: Uint8Array
  width: number
  height: number
  /** Centroid, used as the pivot when rotating the panel's artwork. */
  cx: number
  cy: number
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

function templateToImageData(template: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = template.naturalWidth
  canvas.height = template.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  ctx.drawImage(template, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Locates the hood panel so its artwork can be rotated independently.
 *
 * Across Tesla's templates the hood is the large panel sitting in the upper
 * middle of the canvas — above the mirror ovals, below the front bumper strip —
 * so candidates are restricted to components centred in the top portion near the
 * horizontal midline, and the largest of those wins.
 */
export async function findHoodPanel(templateDataUrl: string): Promise<HoodPanel | null> {
  const template = await loadImage(templateDataUrl)
  const templateData = templateToImageData(template)
  const { width, height } = templateData
  const { outside, isOutline } = computeMasks(templateData)

  const paintable = new Uint8Array(width * height)
  for (let p = 0; p < paintable.length; p++) {
    if (!outside[p] && !isOutline[p]) paintable[p] = 1
  }

  const seen = new Uint8Array(width * height)
  const minArea = width * height * 0.01
  let best: { pixels: number[]; area: number; cx: number; cy: number } | null = null

  for (let start = 0; start < paintable.length; start++) {
    if (!paintable[start] || seen[start]) continue

    const stack = [start]
    seen[start] = 1
    const pixels: number[] = []
    let sumX = 0
    let sumY = 0
    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1

    while (stack.length) {
      const p = stack.pop()!
      pixels.push(p)
      const x = p % width
      const y = (p - x) / width
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

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

    const area = pixels.length
    if (area < minArea) continue

    const cx = sumX / area
    const cy = sumY / area
    // Hood sits in the upper half, straddling the horizontal centre.
    if (cy > height * 0.55) continue
    if (Math.abs(cx - width / 2) > width * 0.12) continue
    // Bumper and fascia strips are also large and centred, but they are long and
    // flat; the hood is roughly as tall as it is wide.
    if ((maxX - minX) / Math.max(1, maxY - minY) > 2.5) continue

    if (!best || area > best.area) best = { pixels, area, cx, cy }
  }

  if (!best) return null

  const mask = new Uint8Array(width * height)
  for (const p of best.pixels) mask[p] = 1
  return { mask, width, height, cx: best.cx, cy: best.cy }
}

/**
 * Rotates only the hood panel's artwork about the panel's centroid, leaving every
 * other panel untouched.
 *
 * Rotation samples from `sourceDataUrl` — the raw generated image before masking,
 * which is opaque across the whole canvas — rather than from the already-masked
 * wrap. Rotating the masked version drags its transparent surroundings into the
 * panel's corners, which then render as black wedges.
 */
export async function rotateHoodArtwork(
  maskedDataUrl: string,
  sourceDataUrl: string,
  hood: HoodPanel,
  degrees: number,
): Promise<string> {
  const [art, source] = await Promise.all([loadImage(maskedDataUrl), loadImage(sourceDataUrl)])
  const { width, height } = hood

  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  const baseCtx = base.getContext('2d', { willReadFrequently: true })
  if (!baseCtx) throw new Error('Canvas 2D context unavailable.')
  baseCtx.drawImage(art, 0, 0, width, height)
  const original = baseCtx.getImageData(0, 0, width, height)

  const rotated = document.createElement('canvas')
  rotated.width = width
  rotated.height = height
  const rotCtx = rotated.getContext('2d', { willReadFrequently: true })
  if (!rotCtx) throw new Error('Canvas 2D context unavailable.')
  rotCtx.translate(hood.cx, hood.cy)
  rotCtx.rotate((degrees * Math.PI) / 180)
  rotCtx.translate(-hood.cx, -hood.cy)
  rotCtx.drawImage(source, 0, 0, width, height)
  const rotatedData = rotCtx.getImageData(0, 0, width, height)

  for (let p = 0, i = 0; p < hood.mask.length; p++, i += 4) {
    if (!hood.mask[p]) continue
    // If rotation still reached past the source edge, keep what was already there
    // rather than punching a hole in the panel.
    if (rotatedData.data[i + 3] === 0) continue
    original.data[i] = rotatedData.data[i]
    original.data[i + 1] = rotatedData.data[i + 1]
    original.data[i + 2] = rotatedData.data[i + 2]
    original.data[i + 3] = 255
  }

  baseCtx.putImageData(original, 0, 0)
  return base.toDataURL('image/png')
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
