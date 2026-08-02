import type { TeslaModel } from '../data/models'
import type { WrapIntensity } from '../data/themes'

export interface WrapPromptInput {
  model: TeslaModel
  colorHex: string
  colorName: string
  description: string
  intensity: WrapIntensity
}

/**
 * Describes design density *within* panels. Every panel still gets filled edge to
 * edge regardless — these must never suggest leaving a panel blank, which is what
 * caused earlier generations to paint one panel and abandon the rest.
 */
const INTENSITY_COPY: Record<WrapIntensity, string> = {
  subtle: 'Style: understated. Every panel is still filled completely, but mostly with the harmonizing base colour and clean, sparse detailing — thin accent lines, small motifs, generous areas of flat colour.',
  balanced: 'Style: balanced. Every panel is filled completely, mixing areas of detailed artwork with calmer passages of flat, harmonizing colour so the design has room to breathe.',
  bold: 'Style: maximal. Every panel is filled completely with dense, high-contrast artwork carrying the theme across the whole vehicle.',
}

/**
 * Builds the text instruction sent alongside the official Tesla template image to
 * Gemini's image-editing model. The template PNG (fetched from
 * teslamotors/custom-wraps) is sent as the input image, so the model fills in the
 * existing panel outlines rather than inventing a car shape from scratch.
 *
 * The template is a flattened layout of *many* separate body panels — hood, doors,
 * fenders, bumpers, pillars — scattered around the canvas, not one silhouette. An
 * earlier version described the hood in detail and said nothing about the rest,
 * which reliably produced a painted hood surrounded by blank outlines. Compare
 * Tesla's own example wraps (e.g. model3-2024-base/example/Doge.png): every
 * enclosed outline is filled edge to edge, and only the large empty region in the
 * middle of the canvas — the glass roof, which has no panel outline — stays white.
 */
export function buildWrapPrompt(input: WrapPromptInput): string {
  const trimmedDescription = input.description.trim()

  return [
    `You are given the official flattened wrap template for a Tesla ${input.model.name}${input.model.subtitle ? ` (${input.model.subtitle})` : ''}, from Tesla's teslamotors/custom-wraps repository.`,

    'This template is a flat layout of MANY separate body panels spread across the canvas: a large hood panel, long door panels down the left and right sides, front and rear fenders, narrow pillar strips, and several bumper and valance pieces along the top and bottom.',

    'CRITICAL — FILL EVERY PANEL. Every single closed outline in the template must be filled with artwork, edge to edge, corner to corner. Do not paint one panel and leave the others blank. Do not leave any outlined panel white, empty, or showing only its outline. The doors, fenders, bumpers, pillars and hood must ALL be covered. A result where only one panel is painted is a complete failure.',

    'Do NOT paint the large empty region in the middle of the canvas that has no outline around it — that gap is the panoramic glass roof and must stay pure white, exactly as it is in the input. Likewise, the white background between and around the panel outlines stays pure white. Only fill the interiors of the printed outlines.',

    'Keep every outline, panel boundary, cutout and position pixel-for-pixel identical to the input. Do not redraw, move, resize, warp, merge or add panel shapes.',

    `Design brief: ${trimmedDescription || 'An eye-catching, high-quality automotive wrap design.'}`,

    'Treat the brief as a single design flowing across the whole vehicle. Put the main focal subject — the character, creature, logo or hero element — on the large hood panel. Every other panel continues the same world: scenery, patterns, textures, colour gradients, secondary motifs. Nothing is left plain unless the style genuinely calls for a block of flat colour.',

    INTENSITY_COPY[input.intensity],

    `The car's factory paint colour is "${input.colorName}" (hex ${input.colorHex}). Use that colour family as the harmonizing base or accent throughout so the wrap sits naturally against the paint still visible on the car.`,

    'Orientation: the hood panel is the wide shape near the centre with two small rounded cutouts at its lower corners. Compose the focal subject on it upright and facing outward toward the front of the car — never rotated, upside down, sideways, or facing the rear.',

    'Render flat and evenly lit like a printable vinyl wrap texture — no drop shadows, no 3D car mockup, no reflections, no watermark, no added text unless the brief calls for it.',
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
