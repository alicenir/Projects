export interface BriefOption {
  id: string
  label: string
  /** Phrase spliced into the concept prompt. Empty means "no preference". */
  prompt: string
}

export interface BriefQuestion {
  key: 'theme' | 'mood' | 'palette' | 'subject'
  label: string
  options: BriefOption[]
}

const SURPRISE: BriefOption = { id: 'any', label: 'Surprise me', prompt: '' }

/**
 * Optional steering for "AI Wrap Generation". Every question defaults to
 * "Surprise me", so the button stays a single click for anyone who wants a
 * genuinely random concept, while giving taste-based direction to anyone who
 * doesn't — without making them write a brief themselves.
 */
export const BRIEF_QUESTIONS: BriefQuestion[] = [
  {
    key: 'theme',
    label: 'What kind of theme?',
    options: [
      SURPRISE,
      { id: 'gaming', label: 'Gaming', prompt: 'Draw on video games.' },
      { id: 'movies', label: 'Movies', prompt: 'Draw on cinema.' },
      { id: 'tv', label: 'TV shows', prompt: 'Draw on television series.' },
      { id: 'anime', label: 'Anime & comics', prompt: 'Draw on anime, manga or comic books.' },
      { id: 'motorsport', label: 'Motorsport', prompt: 'Draw on racing and motorsport liveries.' },
      { id: 'nature', label: 'Nature', prompt: 'Draw on the natural world.' },
      { id: 'retro', label: 'Retro & graphic', prompt: 'Draw on retro and graphic-design movements.' },
      { id: 'abstract', label: 'Abstract', prompt: 'Keep it non-representational and abstract.' },
    ],
  },
  {
    key: 'mood',
    label: 'What mood?',
    options: [
      SURPRISE,
      { id: 'aggressive', label: 'Aggressive', prompt: 'The mood should be aggressive and menacing.' },
      { id: 'playful', label: 'Playful', prompt: 'The mood should be playful, fun and light-hearted.' },
      { id: 'elegant', label: 'Sleek & elegant', prompt: 'The mood should be sleek, elegant and restrained.' },
      { id: 'futuristic', label: 'Futuristic', prompt: 'The mood should be futuristic and high-tech.' },
      { id: 'retro', label: 'Nostalgic', prompt: 'The mood should be warm, retro and nostalgic.' },
      { id: 'stealth', label: 'Stealthy', prompt: 'The mood should be dark, stealthy and understated.' },
      { id: 'epic', label: 'Epic & dramatic', prompt: 'The mood should be epic, cinematic and dramatic.' },
    ],
  },
  {
    key: 'palette',
    label: 'Colour direction?',
    options: [
      SURPRISE,
      { id: 'match', label: 'Build around my paint', prompt: 'Build the palette around the car\'s own factory paint colour.' },
      { id: 'contrast', label: 'High contrast', prompt: 'Use a bold, high-contrast palette.' },
      { id: 'mono', label: 'Monochrome', prompt: 'Use a monochrome or near-monochrome palette.' },
      { id: 'neon', label: 'Vivid neon', prompt: 'Use vivid, saturated neon colours.' },
      { id: 'earthy', label: 'Earthy & muted', prompt: 'Use earthy, muted, natural tones.' },
      { id: 'pastel', label: 'Soft pastels', prompt: 'Use soft pastel colours.' },
      { id: 'metallic', label: 'Metallic', prompt: 'Use metallic tones — chrome, gold, brushed steel.' },
    ],
  },
  {
    key: 'subject',
    label: 'What should the hood show?',
    options: [
      SURPRISE,
      { id: 'character', label: 'A character or creature', prompt: 'Centre the design on a character or creature on the hood.' },
      { id: 'machine', label: 'A machine or vehicle', prompt: 'Centre the design on a machine, robot or vehicle on the hood.' },
      { id: 'scene', label: 'A landscape or scene', prompt: 'Centre the design on a landscape or scene on the hood.' },
      { id: 'emblem', label: 'A symbol or emblem', prompt: 'Centre the design on a bold symbol, crest or emblem on the hood.' },
      { id: 'pattern', label: 'Pattern only, no subject', prompt: 'Use flowing patterns and texture throughout with no single focal character.' },
    ],
  },
]

export type BriefAnswers = Record<BriefQuestion['key'], string>

export const DEFAULT_BRIEF: BriefAnswers = { theme: 'any', mood: 'any', palette: 'any', subject: 'any' }

/** Collapses the chosen answers into instruction text; empty when everything is "Surprise me". */
export function briefToPrompt(answers: BriefAnswers): string {
  return BRIEF_QUESTIONS.map((q) => q.options.find((o) => o.id === answers[q.key])?.prompt ?? '')
    .filter(Boolean)
    .join(' ')
}
