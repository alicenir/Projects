import type { TeslaModel } from '../data/models'
import type { WrapIntensity } from '../data/themes'

export interface WrapPromptInput {
  model: TeslaModel
  colorHex: string
  colorName: string
  description: string
  intensity: WrapIntensity
}

const INTENSITY_COPY: Record<WrapIntensity, string> = {
  subtle: 'Keep coverage subtle overall: let the factory paint color show through as the dominant tone, with the described design appearing as smaller accents, stripes, or badges rather than covering every panel edge-to-edge.',
  balanced: 'Balance the coverage: roughly an even mix of the described artwork and the visible factory paint color.',
  bold: 'Go bold: the described artwork should fill most or all of the paintable area as a full graphic wrap.',
}

/**
 * Builds the text instruction sent alongside the official Tesla template image to
 * Gemini's image-editing model. The template PNG (fetched from
 * teslamotors/custom-wraps) is sent as the input image — Gemini fills in the design
 * inside its existing outlines rather than inventing a new car shape from scratch.
 *
 * Because that template never includes the glass roof panel (Tesla's own renderer
 * always shows it as plain glass, independent of the wrap), the roof is excluded by
 * construction here — there's no roof-shaped region in the input for the model to
 * paint into.
 */
export function buildWrapPrompt(input: WrapPromptInput): string {
  const trimmedDescription = input.description.trim()

  return [
    `You are given the official flattened wrap template for a Tesla ${input.model.name}${input.model.subtitle ? ` (${input.model.subtitle})` : ''}, sourced from Tesla's own teslamotors/custom-wraps template.`,
    'Fill in the white/paintable areas inside the printed black outlines with the design described below. Keep every outline, panel boundary, cutout, and the overall silhouette pixel-for-pixel identical to the input template — do not redraw, move, resize, warp, or add any panel shapes, and do not add a roof shape or any shape outside the given outlines. Anything that is pure white background outside the printed outlines in the input must stay pure white (or transparent) in the output.',
    `Design brief: ${trimmedDescription || 'An eye-catching, high-quality automotive wrap design.'}`,
    INTENSITY_COPY[input.intensity],
    `The car's factory paint color is "${input.colorName}" (hex ${input.colorHex}). Use this color family as a harmonizing base or accent tone so the design blends naturally with the factory paint that will remain visible on the unwrapped parts of the vehicle.`,
    'The template contains one shield-shaped panel near the middle with two small pointed cutouts (for the headlights) — that is the front hood/frunk panel. Compose whatever art lands on that panel so its subject or directional elements face and point toward the narrow/pointed end of that shape, matching the front of the car, never toward the rear or sideways.',
    'Render at high resolution, flat and evenly lit like a printable vinyl wrap texture — no drop shadows, no 3D car mockup, no reflections, no watermark, no added text unless it is genuinely part of the described design.',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface ConceptPromptInput {
  model: TeslaModel
  colorName: string
  themeHint?: string
}

/** Builds the short brief used to ask Gemini to invent a wrap concept for "AI Wrap Generation". */
export function buildConceptPrompt(input: ConceptPromptInput): string {
  return [
    `Invent one creative, visually striking custom vinyl wrap concept for a Tesla ${input.model.name} that is factory-painted "${input.colorName}".`,
    input.themeHint
      ? `Draw inspiration from this theme: ${input.themeHint}.`
      : 'You may draw from gaming, movies, TV shows, anime, motorsport, nature, or abstract art — pick whatever would look best.',
    'Reply with only a single vivid 1-3 sentence design description suitable to hand directly to an image generator, with no preamble, no title, and no quotation marks.',
  ].join(' ')
}
