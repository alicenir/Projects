export interface MockupState {
  status: 'idle' | 'loading' | 'done' | 'error'
  dataUrl?: string
  error?: string
}

export interface WrapGenerationState {
  status: 'idle' | 'loading-concept' | 'loading-image' | 'done' | 'error'
  dataUrl?: string
  width?: number
  height?: number
  sizeBytes?: number
  error?: string
}
