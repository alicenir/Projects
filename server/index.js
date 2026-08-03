import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 3000)
const STATIC_DIR = path.join(__dirname, '..', 'dist')

const app = express()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
})
