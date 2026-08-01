import { useEffect, useState } from 'react'
import { ApiKeyInput } from './components/ApiKeyInput'
import { ModelSelector } from './components/ModelSelector'
import { ColorPicker } from './components/ColorPicker'
import { ThemeSelector } from './components/ThemeSelector'
import { PanelGrid } from './components/PanelGrid'
import { TESLA_MODELS, WRAP_PANELS } from './data/models'
import { TESLA_COLORS } from './data/colors'
import { WRAP_THEMES, type WrapIntensity } from './data/themes'
import { GEMINI_IMAGE_MODELS } from './data/geminiModels'
import { buildPanelPrompt } from './lib/promptBuilder'
import { generateWrapImage } from './lib/gemini'
import { normalizeToWrapSpec, sanitizeWrapFilename } from './lib/imageSpec'
import type { PanelStateMap } from './types'

const LS_KEY = 'tesla-wrap-studio:v1'

interface PersistedPrefs {
  apiKey: string
  geminiModelId: string
  modelId: string
  colorId: string
  customHex: string
  customName: string
  themeId: string
  themeDetail: string
  intensity: WrapIntensity
}

function loadPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) }
  } catch {
    // ignore corrupt storage
  }
  return defaultPrefs()
}

function defaultPrefs(): PersistedPrefs {
  return {
    apiKey: '',
    geminiModelId: GEMINI_IMAGE_MODELS[0].id,
    modelId: TESLA_MODELS[0].id,
    colorId: TESLA_COLORS[0].id,
    customHex: '#8A8D90',
    customName: 'Custom color',
    themeId: WRAP_THEMES[0].id,
    themeDetail: '',
    intensity: 'balanced',
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<PersistedPrefs>(loadPrefs)
  const [panelStates, setPanelStates] = useState<PanelStateMap>({})

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs))
  }, [prefs])

  const model = TESLA_MODELS.find((m) => m.id === prefs.modelId)!
  const theme = WRAP_THEMES.find((t) => t.id === prefs.themeId)!
  const selectedColor = TESLA_COLORS.find((c) => c.id === prefs.colorId)!
  const colorHex = prefs.colorId === 'custom' ? prefs.customHex : selectedColor.hex
  const colorName = prefs.colorId === 'custom' ? prefs.customName || 'Custom color' : selectedColor.name

  const canGenerate =
    prefs.apiKey.trim().length > 0 &&
    Boolean(model) &&
    Boolean(theme) &&
    (theme.id !== 'custom' || prefs.themeDetail.trim().length > 0)

  async function handleGenerate(panelId: string) {
    const panel = WRAP_PANELS.find((p) => p.id === panelId)
    if (!panel || panel.disabled) return // roof (or any future disabled panel) never generates

    setPanelStates((prev) => ({ ...prev, [panelId]: { status: 'loading' } }))

    try {
      const prompt = buildPanelPrompt({
        model,
        panel,
        color: selectedColor,
        colorHex,
        colorName,
        theme,
        themeDetail: prefs.themeDetail,
        intensity: prefs.intensity,
      })

      const raw = await generateWrapImage(prefs.apiKey.trim(), prefs.geminiModelId, prompt)
      const normalized = await normalizeToWrapSpec(raw.dataUrl)

      setPanelStates((prev) => ({
        ...prev,
        [panelId]: {
          status: 'done',
          dataUrl: normalized.dataUrl,
          width: normalized.width,
          height: normalized.height,
          sizeBytes: normalized.sizeBytes,
        },
      }))
    } catch (err) {
      setPanelStates((prev) => ({
        ...prev,
        [panelId]: { status: 'error', error: err instanceof Error ? err.message : 'Generation failed.' },
      }))
    }
  }

  function handleDownload(panelId: string) {
    const state = panelStates[panelId]
    const panel = WRAP_PANELS.find((p) => p.id === panelId)
    if (!state?.dataUrl || !panel) return

    const filename = sanitizeWrapFilename(`${model.name}_${panel.label}_${theme.label}`.replace(/\s+/g, '_'))
    const a = document.createElement('a')
    a.href = state.dataUrl
    a.download = `${filename}.png`
    a.click()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tesla Wrap Studio</h1>
        <p>
          Design AI-generated custom wraps sized for the{' '}
          <a href="https://github.com/teslamotors/custom-wraps" target="_blank" rel="noreferrer">
            teslamotors/custom-wraps
          </a>{' '}
          Paint Shop upload spec.
        </p>
      </header>

      <main className="app-main">
        <ApiKeyInput
          apiKey={prefs.apiKey}
          onApiKeyChange={(apiKey) => setPrefs((p) => ({ ...p, apiKey }))}
          modelId={prefs.geminiModelId}
          onModelChange={(geminiModelId) => setPrefs((p) => ({ ...p, geminiModelId }))}
        />

        <ModelSelector selectedId={prefs.modelId} onSelect={(modelId) => setPrefs((p) => ({ ...p, modelId }))} />

        <ColorPicker
          selectedId={prefs.colorId}
          customHex={prefs.customHex}
          customName={prefs.customName}
          onSelect={(colorId) => setPrefs((p) => ({ ...p, colorId }))}
          onCustomHexChange={(customHex) => setPrefs((p) => ({ ...p, customHex }))}
          onCustomNameChange={(customName) => setPrefs((p) => ({ ...p, customName }))}
        />

        <ThemeSelector
          themeId={prefs.themeId}
          themeDetail={prefs.themeDetail}
          intensity={prefs.intensity}
          onThemeChange={(themeId) => setPrefs((p) => ({ ...p, themeId, themeDetail: '' }))}
          onThemeDetailChange={(themeDetail) => setPrefs((p) => ({ ...p, themeDetail }))}
          onIntensityChange={(intensity) => setPrefs((p) => ({ ...p, intensity }))}
        />

        <PanelGrid
          panelStates={panelStates}
          canGenerate={canGenerate}
          onGenerate={handleGenerate}
          onDownload={handleDownload}
        />

        {!canGenerate && (
          <p className="hint center">
            Add your API key{theme.id === 'custom' ? ' and describe your custom theme' : ''} above to enable
            generation.
          </p>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Wrap specs (512–1024px square PNG, ≤1MB) follow{' '}
          <a href="https://github.com/teslamotors/custom-wraps" target="_blank" rel="noreferrer">
            teslamotors/custom-wraps
          </a>
          . This project is not affiliated with or endorsed by Tesla, Inc.
        </p>
      </footer>
    </div>
  )
}
