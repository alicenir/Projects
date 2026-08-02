import { useEffect, useRef, useState } from 'react'
import { ApiKeyInput } from './components/ApiKeyInput'
import { ModelSelector } from './components/ModelSelector'
import { ColorPicker } from './components/ColorPicker'
import { PromptComposer } from './components/PromptComposer'
import { WrapPreview } from './components/WrapPreview'
import { TESLA_MODELS } from './data/models'
import { TESLA_COLORS } from './data/colors'
import { type WrapIntensity } from './data/themes'
import { GEMINI_IMAGE_MODELS, GEMINI_TEXT_MODELS } from './data/geminiModels'
import { buildWrapPrompt, buildConceptPrompt } from './lib/promptBuilder'
import { generateWrapImage, generateConceptText } from './lib/gemini'
import { normalizeToWrapSpec, sanitizeWrapFilename } from './lib/imageSpec'
import { fetchImageAsset, type FetchedImage } from './lib/templateAssets'
import { maskToPanels } from './lib/panelMask'
import type { WrapGenerationState } from './types'

const LS_KEY = 'tesla-wrap-studio:v2'

const BLANK_PANEL_CORRECTION =
  'RETRY — your previous attempt left an entire panel white and unpainted, most likely the large hood panel near the top centre. Paint over EVERY part of the image this time, especially that large top-centre panel. No region of the output may be white, blank or unpainted.'

interface PersistedPrefs {
  apiKey: string
  geminiModelId: string
  geminiTextModelId: string
  modelId: string
  colorId: string
  customHex: string
  customName: string
  description: string
  intensity: WrapIntensity
}

function loadPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const stored: PersistedPrefs = { ...defaultPrefs(), ...JSON.parse(raw) }
      // A model saved earlier may since have been retired by Google — fall back
      // rather than leaving the user stuck on an id that only 404s.
      if (!GEMINI_IMAGE_MODELS.some((m) => m.id === stored.geminiModelId)) {
        stored.geminiModelId = GEMINI_IMAGE_MODELS[0].id
      }
      if (!GEMINI_TEXT_MODELS.some((m) => m.id === stored.geminiTextModelId)) {
        stored.geminiTextModelId = GEMINI_TEXT_MODELS[0].id
      }
      return stored
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultPrefs()
}

function defaultPrefs(): PersistedPrefs {
  return {
    apiKey: '',
    geminiModelId: GEMINI_IMAGE_MODELS[0].id,
    geminiTextModelId: GEMINI_TEXT_MODELS[0].id,
    modelId: TESLA_MODELS[0].id,
    colorId: TESLA_COLORS[0].id,
    customHex: '#8A8D90',
    customName: 'Custom color',
    description: '',
    intensity: 'balanced',
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<PersistedPrefs>(loadPrefs)
  const [generation, setGeneration] = useState<WrapGenerationState>({ status: 'idle' })
  const [templateUrl, setTemplateUrl] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const templateCache = useRef<Map<string, FetchedImage>>(new Map())

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs))
  }, [prefs])

  const model = TESLA_MODELS.find((m) => m.id === prefs.modelId)!
  const selectedColor = TESLA_COLORS.find((c) => c.id === prefs.colorId)!
  const colorHex = prefs.colorId === 'custom' ? prefs.customHex : selectedColor.hex
  const colorName = prefs.colorId === 'custom' ? prefs.customName || 'Custom color' : selectedColor.name

  // Load (and cache) the official template whenever the selected model changes.
  useEffect(() => {
    let cancelled = false
    setTemplateError(null)

    const cached = templateCache.current.get(model.id)
    if (cached) {
      setTemplateUrl(cached.objectUrl)
      return
    }

    setTemplateUrl(null)
    fetchImageAsset(model.templateUrl)
      .then((img) => {
        if (cancelled) return
        templateCache.current.set(model.id, img)
        setTemplateUrl(img.objectUrl)
      })
      .catch((err) => {
        if (cancelled) return
        setTemplateError(err instanceof Error ? err.message : 'Could not load the template.')
      })

    return () => {
      cancelled = true
    }
  }, [model.id, model.templateUrl])

  const canGenerate = prefs.apiKey.trim().length > 0 && Boolean(templateUrl) && !templateError
  const hasDescription = prefs.description.trim().length > 0

  async function generateAndMask(prompt: string, template: FetchedImage) {
    const raw = await generateWrapImage(prefs.apiKey.trim(), prefs.geminiModelId, prompt, {
      base64: template.base64,
      mimeType: template.mimeType,
    })
    // Clip to the template's real panels so nothing can land on the glass roof or
    // the background, whatever the model actually drew.
    return maskToPanels(raw.dataUrl, template.objectUrl)
  }

  async function runImageGeneration(description: string) {
    const template = templateCache.current.get(model.id)
    if (!template) {
      setGeneration({ status: 'error', error: 'Template is still loading — try again in a moment.' })
      return
    }

    setGeneration({ status: 'loading-image' })
    try {
      const basePrompt = buildWrapPrompt({
        model,
        colorHex,
        colorName,
        description,
        intensity: prefs.intensity,
      })

      // The model intermittently leaves a whole panel — usually the hood — unpainted.
      // Detect that after masking and retry once with a pointed correction rather
      // than handing back a wrap with a white frunk.
      let masked = await generateAndMask(basePrompt, template)
      if (masked.blankPanels > 0) {
        masked = await generateAndMask(`${basePrompt} ${BLANK_PANEL_CORRECTION}`, template)
      }

      const normalized = await normalizeToWrapSpec(masked.dataUrl, template.width, template.height)

      setGeneration({
        status: 'done',
        dataUrl: normalized.dataUrl,
        width: normalized.width,
        height: normalized.height,
        sizeBytes: normalized.sizeBytes,
      })
    } catch (err) {
      setGeneration({ status: 'error', error: err instanceof Error ? err.message : 'Generation failed.' })
    }
  }

  async function handleGenerate() {
    if (!hasDescription) return
    await runImageGeneration(prefs.description.trim())
  }

  async function handleAiWrapGeneration() {
    setGeneration({ status: 'loading-concept' })
    try {
      const conceptPrompt = buildConceptPrompt({
        model,
        colorName,
        themeHint: prefs.description.trim() || undefined,
      })
      const concept = await generateConceptText(prefs.apiKey.trim(), prefs.geminiTextModelId, conceptPrompt)
      setPrefs((p) => ({ ...p, description: concept }))
      await runImageGeneration(concept)
    } catch (err) {
      setGeneration({ status: 'error', error: err instanceof Error ? err.message : 'Concept generation failed.' })
    }
  }

  function handleDownload() {
    if (!generation.dataUrl) return
    const filename = sanitizeWrapFilename(`${model.name}_wrap`.replace(/\s+/g, '_'))
    const a = document.createElement('a')
    a.href = generation.dataUrl
    a.download = `${filename}.png`
    a.click()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tesla Wrap Studio</h1>
        <p>
          Design AI-generated custom wraps using the real{' '}
          <a href="https://github.com/teslamotors/custom-wraps" target="_blank" rel="noreferrer">
            teslamotors/custom-wraps
          </a>{' '}
          templates.
        </p>
      </header>

      <main className="app-main">
        <ApiKeyInput
          apiKey={prefs.apiKey}
          onApiKeyChange={(apiKey) => setPrefs((p) => ({ ...p, apiKey }))}
          modelId={prefs.geminiModelId}
          onModelChange={(geminiModelId) => setPrefs((p) => ({ ...p, geminiModelId }))}
          textModelId={prefs.geminiTextModelId}
          onTextModelChange={(geminiTextModelId) => setPrefs((p) => ({ ...p, geminiTextModelId }))}
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

        <PromptComposer
          description={prefs.description}
          intensity={prefs.intensity}
          onDescriptionChange={(description) => setPrefs((p) => ({ ...p, description }))}
          onIntensityChange={(intensity) => setPrefs((p) => ({ ...p, intensity }))}
        />

        {templateError && <p className="hint error-text">{templateError}</p>}

        <WrapPreview
          model={model}
          templateUrl={templateUrl}
          state={generation}
          canGenerate={canGenerate}
          hasDescription={hasDescription}
          onGenerate={handleGenerate}
          onAiWrapGeneration={handleAiWrapGeneration}
          onDownload={handleDownload}
        />

        {!canGenerate && !templateError && (
          <p className="hint center">Add your API key above to enable generation.</p>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Templates and vehicle images are fetched live from{' '}
          <a href="https://github.com/teslamotors/custom-wraps" target="_blank" rel="noreferrer">
            teslamotors/custom-wraps
          </a>
          . Wrap specs (512–1024px, PNG, ≤1MB) follow the same repo. This project is not affiliated with or endorsed
          by Tesla, Inc.
        </p>
      </footer>
    </div>
  )
}
