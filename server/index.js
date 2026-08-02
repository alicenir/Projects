import express from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 3000)
const WRAPS_DIR = path.resolve(process.env.WRAPS_DIR ?? path.join(__dirname, '..', 'wraps'))
const STATIC_DIR = path.join(__dirname, '..', 'dist')

// Wraps are capped at 1 MB by the Tesla spec; leave headroom for base64 overhead.
const MAX_BODY = '8mb'

// Mirrors the Tesla wrap filename spec: alphanumeric, underscore, dash, space,
// max 30 chars before the extension. Notably excludes "/" and ".", so a name that
// passes this can't traverse out of WRAPS_DIR.
const SAFE_NAME = /^[a-zA-Z0-9_\- ]{1,30}\.png$/

const app = express()
app.use(express.json({ limit: MAX_BODY }))

/** Resolves a client-supplied filename to an absolute path inside WRAPS_DIR, or null if unsafe. */
function resolveWrapPath(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) return null
  const full = path.resolve(WRAPS_DIR, name)
  // Defense in depth: confirm the resolved path really sits directly in WRAPS_DIR.
  if (path.dirname(full) !== WRAPS_DIR) return null
  return full
}

/** Finds a free filename, appending _2, _3… on collision while staying within 30 chars. */
async function uniqueName(baseName) {
  const stem = baseName.replace(/\.png$/i, '')
  let candidate = `${stem}.png`
  for (let i = 2; i < 1000; i++) {
    try {
      await fs.access(path.join(WRAPS_DIR, candidate))
    } catch {
      return candidate // does not exist yet
    }
    const suffix = `_${i}`
    candidate = `${stem.slice(0, 30 - suffix.length)}${suffix}.png`
  }
  throw new Error('Could not find a free filename.')
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, wrapsDir: WRAPS_DIR })
})

app.get('/api/wraps', async (_req, res) => {
  try {
    const entries = await fs.readdir(WRAPS_DIR)
    const wraps = await Promise.all(
      entries
        .filter((name) => SAFE_NAME.test(name))
        .map(async (name) => {
          const stat = await fs.stat(path.join(WRAPS_DIR, name))
          return { name, size: stat.size, modified: stat.mtime.toISOString() }
        }),
    )
    wraps.sort((a, b) => b.modified.localeCompare(a.modified))
    res.json(wraps)
  } catch (err) {
    res.status(500).json({ error: `Could not list wraps: ${err.message}` })
  }
})

app.post('/api/wraps', async (req, res) => {
  const { name, dataUrl } = req.body ?? {}

  if (!resolveWrapPath(name)) {
    return res.status(400).json({
      error: 'Invalid filename. Use letters, numbers, spaces, dashes or underscores (max 30 chars) ending in .png',
    })
  }
  const match = /^data:image\/png;base64,(.+)$/s.exec(dataUrl ?? '')
  if (!match) {
    return res.status(400).json({ error: 'Expected a PNG data URL.' })
  }

  const buffer = Buffer.from(match[1], 'base64')
  // Verify the PNG magic number rather than trusting the declared MIME type.
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) {
    return res.status(400).json({ error: 'Payload is not a valid PNG.' })
  }

  try {
    await fs.mkdir(WRAPS_DIR, { recursive: true })
    const finalName = await uniqueName(name)
    await fs.writeFile(path.join(WRAPS_DIR, finalName), buffer)
    res.status(201).json({ name: finalName, size: buffer.length, modified: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: `Could not save wrap: ${err.message}` })
  }
})

app.get('/api/wraps/:name', async (req, res) => {
  const full = resolveWrapPath(req.params.name)
  if (!full) return res.status(400).json({ error: 'Invalid filename.' })
  try {
    const buffer = await fs.readFile(full)
    res.type('image/png').send(buffer)
  } catch {
    res.status(404).json({ error: 'Wrap not found.' })
  }
})

app.delete('/api/wraps/:name', async (req, res) => {
  const full = resolveWrapPath(req.params.name)
  if (!full) return res.status(400).json({ error: 'Invalid filename.' })
  try {
    await fs.unlink(full)
    res.status(204).end()
  } catch {
    res.status(404).json({ error: 'Wrap not found.' })
  }
})

// Serve the built frontend. Hashed assets can be cached hard; the shell cannot.
app.use(
  express.static(STATIC_DIR, {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  }),
)

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Tesla Wrap Studio listening on http://0.0.0.0:${PORT}`)
  console.log(`Saving wraps to ${WRAPS_DIR}`)
})
