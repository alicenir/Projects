import type { TextPlacementId } from '../data/textPlacements'

/**
 * Draws the user's lettering onto the finished wrap with canvas rather than asking
 * the image model for it.
 *
 * Models render text unreliably — earlier generations produced "SLA MOTORSPORTS"
 * and "GLACIE RACING" from clean inputs, and often omitted the text entirely. Since
 * the panel geometry is already known from the template mask, the lettering can be
 * placed exactly instead: correct spelling, correct panel, correct orientation,
 * every time. The trade-off is that it reads as cleanly applied vinyl rather than
 * artwork woven into the design.
 */

const OUTLINE_LUMA = 160

interface Component {
  pixels: number[]
  minX: number
  maxX: number
  minY: number
  maxY: number
  cx: number
  cy: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image for lettering.'))
    img.src = src
  })
}

/** Same panel derivation as the mask: anything the border fill can't reach is a panel. */
function findComponents(templateData: ImageData): Component[] {
  const { width, height, data } = templateData
  const isOutline = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 16) continue
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luma < OUTLINE_LUMA) isOutline[p] = 1
  }

  const outside = new Uint8Array(width * height)
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

  const seen = new Uint8Array(width * height)
  const components: Component[] = []
  const minArea = width * height * 0.005

  for (let start = 0; start < seen.length; start++) {
    if (outside[start] || isOutline[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    const pixels: number[] = []
    let minX = width
    let maxX = -1
    let minY = height
    let maxY = -1
    let sumX = 0
    let sumY = 0

    while (queue.length) {
      const p = queue.pop()!
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
        if (n >= 0 && !outside[n] && !isOutline[n] && !seen[n]) {
          seen[n] = 1
          queue.push(n)
        }
      }
    }

    if (pixels.length >= minArea) {
      components.push({ pixels, minX, maxX, minY, maxY, cx: sumX / pixels.length, cy: sumY / pixels.length })
    }
  }

  return components
}

function pickTargets(components: Component[], placement: TextPlacementId, width: number, height: number): Component[] {
  const tall = (c: Component) => c.maxY - c.minY > (c.maxX - c.minX) * 1.4
  const area = (c: Component) => c.pixels.length

  if (placement === 'hood') {
    const candidates = components.filter(
      (c) => c.cy < height * 0.55 && Math.abs(c.cx - width / 2) < width * 0.12 && !tall(c),
    )
    const best = candidates.sort((a, b) => area(b) - area(a))[0]
    return best ? [best] : []
  }

  if (placement === 'rear') {
    const candidates = components
      .filter((c) => c.cy > height * 0.75 && c.maxX - c.minX > c.maxY - c.minY)
      .sort((a, b) => area(b) - area(a))
    return candidates.slice(0, 1)
  }

  // Doors (and the "wherever it fits" default): the biggest panel on each side.
  //
  // Deliberately not filtered on being tall. Door panels are split into upper and
  // lower sections by a body line, so each half is only about as tall as it is
  // wide, while the narrow pillar strip beside them is emphatically tall — filtering
  // for tallness picked the pillar and squeezed the lettering into a sliver. Size
  // with a minimum thickness is the reliable discriminator instead.
  const roomy = (c: Component) => Math.min(c.maxX - c.minX, c.maxY - c.minY) > width * 0.06
  const left = components.filter((c) => roomy(c) && c.cx < width * 0.4).sort((a, b) => area(b) - area(a))[0]
  const right = components.filter((c) => roomy(c) && c.cx > width * 0.6).sort((a, b) => area(b) - area(a))[0]
  return [left, right].filter(Boolean) as Component[]
}

/** Average luminance beneath a panel, so the lettering can be set light or dark for contrast. */
function panelLuma(component: Component, art: Uint8ClampedArray): number {
  let total = 0
  const step = Math.max(1, Math.floor(component.pixels.length / 4000))
  let count = 0
  for (let i = 0; i < component.pixels.length; i += step) {
    const p = component.pixels[i] * 4
    total += 0.299 * art[p] + 0.587 * art[p + 1] + 0.114 * art[p + 2]
    count++
  }
  return count ? total / count : 128
}

export async function drawTextOnWrap(
  maskedDataUrl: string,
  templateDataUrl: string,
  text: string,
  placement: TextPlacementId,
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return maskedDataUrl

  const [template, art] = await Promise.all([loadImage(templateDataUrl), loadImage(maskedDataUrl)])
  const width = template.naturalWidth
  const height = template.naturalHeight

  const tplCanvas = document.createElement('canvas')
  tplCanvas.width = width
  tplCanvas.height = height
  const tplCtx = tplCanvas.getContext('2d', { willReadFrequently: true })
  if (!tplCtx) throw new Error('Canvas 2D context unavailable.')
  tplCtx.drawImage(template, 0, 0)

  const components = findComponents(tplCtx.getImageData(0, 0, width, height))
  const targets = pickTargets(components, placement, width, height)
  if (!targets.length) return maskedDataUrl

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context unavailable.')
  ctx.drawImage(art, 0, 0, width, height)
  const artData = ctx.getImageData(0, 0, width, height).data

  for (const target of targets) {
    const boxW = target.maxX - target.minX
    const boxH = target.maxY - target.minY
    const vertical = boxH > boxW

    // Along the panel's long axis, inset so lettering doesn't touch the edges.
    const along = (vertical ? boxH : boxW) * 0.82
    const across = (vertical ? boxW : boxH) * 0.42

    // Text is drawn to its own layer so it can be clipped to the panel afterwards.
    const layer = document.createElement('canvas')
    layer.width = width
    layer.height = height
    const lctx = layer.getContext('2d', { willReadFrequently: true })
    if (!lctx) continue

    let fontSize = Math.min(across, 140)
    lctx.font = `700 ${fontSize}px Helvetica, Arial, sans-serif`
    const measured = lctx.measureText(trimmed).width
    if (measured > along) {
      fontSize = Math.max(12, Math.floor(fontSize * (along / measured)))
      lctx.font = `700 ${fontSize}px Helvetica, Arial, sans-serif`
    }

    const light = panelLuma(target, artData) < 130
    lctx.textAlign = 'center'
    lctx.textBaseline = 'middle'
    lctx.translate(target.cx, target.cy)
    if (vertical) {
      // Mirror the rotation between sides so both read the same way round the car.
      lctx.rotate(target.cx < width / 2 ? Math.PI / 2 : -Math.PI / 2)
    }
    lctx.lineJoin = 'round'
    lctx.lineWidth = Math.max(2, fontSize * 0.16)
    lctx.strokeStyle = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)'
    lctx.strokeText(trimmed, 0, 0)
    lctx.fillStyle = light ? '#ffffff' : '#111111'
    lctx.fillText(trimmed, 0, 0)

    // Keep only the parts of the lettering that fall inside this panel.
    const layerData = lctx.getImageData(0, 0, width, height)
    const inPanel = new Uint8Array(width * height)
    for (const p of target.pixels) inPanel[p] = 1
    for (let p = 0, i = 0; p < inPanel.length; p++, i += 4) {
      if (!inPanel[p]) layerData.data[i + 3] = 0
    }
    lctx.putImageData(layerData, 0, 0)
    ctx.drawImage(layer, 0, 0)
  }

  return out.toDataURL('image/png')
}
