export interface MockupView {
  status: 'loading' | 'done' | 'error'
  dataUrl?: string
  error?: string
}

export interface MockupState {
  /** Whether the preview panel has been opened at all. */
  open: boolean
  /** Index into VIEW_ANGLES currently being shown. */
  active: number
  /** Rendered angles, kept so revisiting one costs nothing. */
  views: Record<number, MockupView>
}

export type HoodRotation = 0 | 90 | 180 | 270

export interface WrapGenerationState {
  status: 'idle' | 'loading-concept' | 'loading-image' | 'done' | 'error'
  dataUrl?: string
  /** Masked wrap at rotation 0, kept so rotations re-derive instead of compounding. */
  baseDataUrl?: string
  /** Raw model output before masking, used as the source when rotating the hood. */
  sourceDataUrl?: string
  width?: number
  height?: number
  sizeBytes?: number
  error?: string
}
