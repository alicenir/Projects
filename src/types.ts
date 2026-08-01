export interface PanelState {
  status: 'idle' | 'loading' | 'done' | 'error'
  dataUrl?: string
  width?: number
  height?: number
  sizeBytes?: number
  error?: string
}

export type PanelStateMap = Record<string, PanelState>
