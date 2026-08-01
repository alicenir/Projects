import type { TeslaModel, WrapPanel } from '../data/models'
import type { TeslaColor } from '../data/colors'
import type { WrapTheme, WrapIntensity } from '../data/themes'

export interface PromptInput {
  model: TeslaModel
  panel: WrapPanel
  color: TeslaColor
  colorHex: string
  colorName: string
  theme: WrapTheme
  themeDetail: string
  intensity: WrapIntensity
}

const INTENSITY_COPY: Record<WrapIntensity, string> = {
  subtle: 'Keep coverage subtle: the factory paint color should still dominate, with the themed artwork appearing as a smaller accent, stripe, or badge rather than covering the whole panel.',
  balanced: 'Balance the coverage: roughly an even mix of themed artwork and visible factory paint color showing through.',
  bold: 'Go bold: the themed artwork should cover most or all of the panel as a full graphic wrap.',
}

/**
 * Builds the text prompt sent to the image model for one wrap panel.
 * Never call this for the 'roof' panel — roof generation is blocked upstream
 * in App.tsx because the panoramic glass roof has no physical surface to wrap.
 */
export function buildPanelPrompt(input: PromptInput): string {
  if (input.panel.disabled) {
    throw new Error(`Panel "${input.panel.id}" is disabled and must never be sent to the image model.`)
  }

  const themeLine = input.themeDetail.trim()
    ? `Theme: ${input.theme.label} — specifically inspired by "${input.themeDetail.trim()}".`
    : `Theme: ${input.theme.label}.`

  return [
    `A professional automotive vinyl wrap texture for a Tesla ${input.model.name} (${input.model.bodyStyle}), designed for the "${input.panel.label}" panel (${input.panel.description}).`,
    themeLine,
    INTENSITY_COPY[input.intensity],
    `The car's factory paint color is "${input.colorName}" (hex ${input.colorHex}). Use this exact color family as the harmonizing base or accent tone so the wrap blends naturally with the factory paint visible on the rest of the vehicle — do not clash with it or ignore it.`,
    input.panel.orientationNote ?? '',
    'This must be a flat, seamless, high-resolution decorative texture meant to be printed and applied to a single body panel, viewed straight-on and evenly lit. No reflections, no drop shadows implying a 3D car shape, no vehicle silhouette or outline, no watermark, no stray text unless it is genuinely part of the theme artwork itself.',
    'Output a single square image filling the entire frame edge-to-edge.',
  ]
    .filter(Boolean)
    .join(' ')
}
