import type { TeslaModel } from '../data/models'
import type { WrapIntensity } from '../data/themes'

export interface WrapPromptInput {
  model: TeslaModel
  colorHex: string
  colorName: string
  description: string
  intensity: WrapIntensity
  /** Optional lettering the user wants rendered on the wrap. */
  customText?: string
  /** Placement instruction from TEXT_PLACEMENTS, used only when customText is set. */
  customTextPlacement?: string
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
 *
 * Orientation is stated in image-space rather than as "the front of the car",
 * which the model has no way to locate. model3-2024-base/example/Reindeer.png
 * fixes the mapping: the red nose sits on the hood panel's top edge and the ears
 * land on the mirror ovals below it, so the top of the canvas is the car's nose
 * and the bottom is its tail.
 */
export function buildWrapPrompt(input: WrapPromptInput): string {
  const trimmedDescription = input.description.trim()
  const lettering = input.customText?.trim()

  return [
    `You are given the official flattened wrap template for a Tesla ${input.model.name}${input.model.subtitle ? ` (${input.model.subtitle})` : ''}, from Tesla's teslamotors/custom-wraps repository.`,

    'This template is a flat layout of MANY separate body panels spread across the canvas: a large hood panel, long door panels down the left and right sides, front and rear fenders, narrow pillar strips, and several bumper and valance pieces along the top and bottom.',

    'CRITICAL — LEAVE NOTHING WHITE. Cover the ENTIRE image with your artwork, edge to edge and corner to corner, including the large panel near the top centre (the hood/frunk), every door, fender, pillar and bumper piece, and the space between them. There must be no white, blank, empty or unpainted area anywhere in your output. A white or empty region — especially the large hood panel — is a complete failure.',

    'Do not worry about staying inside the printed outlines and do not try to leave the glass roof empty: the areas that must not be wrapped are cut out automatically after you finish. Your only job is to produce a complete, edge-to-edge design with no blank space. Use the printed outlines purely as a guide to where the panels sit so the composition lines up with them.',

    `Design brief: ${trimmedDescription || 'An eye-catching, high-quality automotive wrap design.'}`,

    // Sits with the design brief rather than among the rendering notes: buried near
    // the end of a 3000-character prompt it was simply ignored, because by then the
    // composition had already been decided.
    lettering
      ? `REQUIRED LETTERING — this design MUST include the words "${lettering}" rendered as visible text on the wrap. This is not optional and must not be omitted. Reproduce it letter for letter, exactly as written, once only: no extra words, no invented sponsor names, no duplicated copies scattered around. Set it in a typeface suiting the design, large enough to read easily, in a colour that contrasts with whatever sits behind it. ${input.customTextPlacement ?? ''}`
      : '',

    'Treat the brief as a single design flowing across the whole image. Place the main focal subject — the character, creature, logo or hero element — over the large panel near the top centre, which is the hood, and make sure that panel is richly painted rather than left as background. The rest of the image continues the same world: scenery, patterns, textures, colour gradients, secondary motifs.',

    INTENSITY_COPY[input.intensity],

    `The car's factory paint colour is "${input.colorName}" (hex ${input.colorHex}). Use that colour family as the harmonizing base or accent throughout so the wrap sits naturally against the paint still visible on the car.`,

    'ORIENTATION — THE TOP EDGE OF THE IMAGE IS THE FRONT OF THE CAR. The bottom edge is the rear. The large panel near the top centre is the hood, and its upper edge is the leading edge at the car\'s nose. Rotate the focal subject so it faces, points, looks or travels toward the TOP EDGE of the image: a character\'s head and gaze toward the top, a vehicle or animal nose-first toward the top, any motion or speed lines running toward the top. Never orient the subject toward the bottom, left or right edge, and never place it sideways or upside down.',

    `Render flat and evenly lit like a printable vinyl wrap texture — no drop shadows, no 3D car mockup, no reflections, no watermark${lettering ? '' : ', no added text unless the brief calls for it'}.`,

    // Restated last as well: a single mention in a long prompt is easy to drop.
    lettering ? `Before finishing, confirm the words "${lettering}" actually appear as legible text on the wrap.` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface PortPromptInput {
  target: TeslaModel
  colorHex: string
  colorName: string
}

/**
 * Builds the instruction for re-laying an existing wrap onto a different vehicle's
 * template.
 *
 * The layouts genuinely differ — measured panel-area overlap between the Model Y
 * (2025+) Premium template and the others runs from 93% for the Performance trim
 * down to 15% for the Cybertruck — so the same PNG cannot simply be reused. The
 * design has to be redrawn against the new panel shapes, which is what this asks
 * for: same artwork, different arrangement.
 */
export function buildPortPrompt(input: PortPromptInput): string {
  return [
    `You are given two images. The FIRST is a finished vinyl wrap design made for a different Tesla. The SECOND is the blank wrap template for a Tesla ${input.target.name}${input.target.subtitle ? ` (${input.target.subtitle})` : ''}.`,

    'Recreate the SAME design from the first image onto the second image\'s layout. Keep its colours, motifs, characters, typography, mood and overall style recognisably identical — someone seeing both should say it is the same wrap on a different car.',

    'The two layouts are NOT the same: the panels are different shapes, different sizes and in different positions. Do not copy the first image pixel for pixel or paste it on top. Re-compose the design to suit the second template\'s panels, stretching, re-tiling and rearranging elements as needed so each panel is filled sensibly.',

    'CRITICAL — LEAVE NOTHING WHITE. Cover the entire second image with artwork, edge to edge, including the large panel near the top centre (the hood), every door, fender, pillar and bumper piece, and the space between them. No white, blank or unpainted area anywhere.',

    'Do not worry about staying inside the printed outlines: the areas that must not be wrapped are cut out automatically afterwards. Use the outlines only as a guide to where the panels sit.',

    'ORIENTATION — the TOP EDGE of the image is the FRONT of the car. Put the design\'s main focal subject on the large hood panel near the top centre, facing and pointing toward the top edge, never sideways or upside down.',

    `The car's factory paint colour is "${input.colorName}" (hex ${input.colorHex}); keep using that colour family as the harmonizing base or accent.`,

    'Render flat and evenly lit like a printable vinyl wrap texture — no drop shadows, no 3D car mockup, no reflections, no watermark.',
  ].join(' ')
}

export interface MockupPromptInput {
  model: TeslaModel
  colorName: string
  /** Camera description from VIEW_ANGLES. */
  anglePrompt: string
}

/**
 * Builds the instruction for the "Preview on car" mockup, which sends the finished
 * wrap back to the image model and asks for it rendered on the vehicle.
 *
 * This is deliberately illustrative rather than exact — the model has no UV data,
 * so panel seams won't land pixel-perfectly. It exists to judge how the design
 * reads at a glance before transferring the file to the car, where Tesla's own
 * Paint Shop renders it properly.
 */
export function buildMockupPrompt(input: MockupPromptInput): string {
  return [
    `You are given two images. The FIRST is a reference render of the exact car to draw: a Tesla ${input.model.name}${input.model.subtitle ? ` (${input.model.subtitle})` : ''}. The SECOND is a flattened vinyl wrap layout.`,

    'Render a photorealistic studio photograph of the car from the FIRST image, wearing the artwork from the SECOND image as a printed vinyl wrap.',

    `THE CAR MUST BE THE EXACT VARIANT IN THE FIRST IMAGE. This one is ${input.model.renderNotes} Copy its front and rear light signatures, bumpers, body creases, proportions, greenhouse and wheels from that reference. Do not substitute a different model year, facelift or generation of the same nameplate, and do not fall back on a more familiar version of this car — study the reference and reproduce what is actually shown.`,

    'In the wrap layout, the large panel near the top centre is the hood, the tall panels down each side are the doors and fenders, and the pieces along the top and bottom are the bumpers. Map that artwork onto the matching panels, preserving its colours, motifs, characters and composition so the car is clearly wearing this specific design, with the hood subject upright and facing forward.',

    `Camera: show the whole car from ${input.anglePrompt}. Wheels included, lit like a showroom photograph on a clean neutral background with a soft floor reflection. The reference render is a front three-quarter view — if the requested camera differs, rotate the same car to that angle rather than reusing the reference framing, and carry the wrap design consistently around to the surfaces now in view.`,

    'The panoramic roof is tinted glass and must stay dark glass — never wrapped or painted. Windows stay glass, and the tyres, badges and lights stay realistic.',

    'No text overlays, no watermarks, no colour swatches or design-layout diagrams — just the finished car.',
  ].join(' ')
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
