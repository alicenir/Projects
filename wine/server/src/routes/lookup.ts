import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getDb } from '../db.js';
import { dossier, identify } from '../lib/resolve.js';
import { cacheQuotes, fetchQuotes, loadProvider, quotesFor } from '../lib/prices.js';
import { int, str } from '../lib/params.js';
import { ocrAvailable, readLabel } from '../lib/ocr.js';

export const lookupRouter = Router();

const lookupSchema = z.object({
  text: z.string().min(2).max(400),
  vintage: z.number().int().min(1800).max(2100).nullable().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

/** Resolve a bottle, then hand back the dossier for the best match in one call. */
function respond(text: string, vintage: number | null, limit: number, source: 'text' | 'photo', extra?: Record<string, unknown>) {
  const db = getDb();
  const { parsed, matches } = identify(db, text, vintage, limit);
  const best = matches[0] ?? null;
  return {
    query: { text, vintage: parsed.vintage, tokens: parsed.signal, source },
    matches,
    dossier: best ? dossier(db, best.kind, best.ref, best.vintage ?? parsed.vintage) : null,
    prices: best ? quotesFor(db, { text, vintage: parsed.vintage, match: best }) : null,
    ...extra,
  };
}

lookupRouter.post('/lookup', (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid lookup' });
    return;
  }
  res.json(respond(parsed.data.text, parsed.data.vintage ?? null, parsed.data.limit ?? 6, 'text'));
});

lookupRouter.get('/lookup', (req, res) => {
  const text = str(req.query.q);
  if (!text) {
    res.status(400).json({ error: 'pass ?q=' });
    return;
  }
  res.json(respond(text, int(req.query.vintage) ?? null, int(req.query.limit, 6)!, 'text'));
});

/** The dossier on its own, for when the user picks a different match. */
lookupRouter.get('/lookup/:kind/:ref', (req, res) => {
  const kind = req.params.kind === 'label' ? 'label' : 'wine';
  const ref = int(req.params.ref);
  if (!ref) {
    res.status(400).json({ error: 'bad reference' });
    return;
  }
  const result = dossier(getDb(), kind, ref, int(req.query.vintage) ?? null);
  if (!result) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(result);
});

/* ----------------------------------------------------------- photo lookup */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic|heif|avif|gif|bmp|tiff)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('upload an image of the bottle label'));
  },
});

/**
 * Photograph a bottle, get the dossier. The image is read locally by Tesseract
 * and is never stored or forwarded anywhere.
 */
lookupRouter.post('/lookup/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'attach a photo field' });
      return;
    }
    if (!ocrAvailable()) {
      res.status(503).json({
        error: 'Label reading needs the Tesseract language file. Run "npm run ocr:setup" in server/ once.',
      });
      return;
    }

    const reading = await readLabel(req.file.buffer);
    const vintage = int(req.body?.vintage) ?? reading.vintage;
    if (!reading.query || reading.query.length < 3) {
      res.json({
        query: { text: '', vintage, tokens: [], source: 'photo' },
        matches: [],
        dossier: null,
        prices: null,
        reading: { text: reading.text, lines: reading.lines.map((l) => l.text), confidence: reading.confidence },
        hint: 'No readable text on the label — try a straight-on shot with the label filling the frame.',
      });
      return;
    }

    res.json(
      respond(reading.query, vintage, int(req.body?.limit, 6)!, 'photo', {
        reading: { text: reading.text, lines: reading.lines.map((l) => l.text), confidence: reading.confidence },
      }),
    );
  } catch (err) {
    next(err);
  }
});

lookupRouter.get('/lookup/capabilities', async (_req, res) => {
  const provider = await loadProvider().catch(() => null);
  res.json({ photo: ocrAvailable(), priceProvider: provider ? provider.name : null });
});

/* --------------------------------------------------------------- prices */

const priceSchema = z.object({
  text: z.string().min(2).max(400),
  vintage: z.number().int().min(1800).max(2100).nullable().optional(),
  kind: z.enum(['wine', 'label']).optional(),
  ref: z.number().int().positive().optional(),
});

/**
 * Ask the configured merchant API what this bottle costs right now, cache the
 * answer with its timestamp, and hand back both the quotes and the benchmark.
 */
lookupRouter.post('/prices/refresh', async (req, res, next) => {
  try {
    const parsed = priceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid request' });
      return;
    }
    const { text, vintage = null, kind, ref } = parsed.data;
    const db = getDb();

    const result = await fetchQuotes(text, vintage ?? null);
    if (!result) {
      res.status(503).json({
        error: 'No live price provider configured. Add data/price-provider.json (see the README) and restart.',
        ...quotesFor(db, { text, vintage: vintage ?? null, match: null }),
      });
      return;
    }

    const match = kind && ref ? { kind, ref, confidence: 0, why: [], title: '', subtitle: '', vintage: vintage ?? null } : null;
    cacheQuotes(db, result.provider, text, vintage ?? null, match, result.quotes);
    res.json({ provider: result.provider, fetchedAt: new Date().toISOString(), ...quotesFor(db, { text, vintage: vintage ?? null, match }) });
  } catch (err) {
    next(err);
  }
});

export { respond as lookupResponse };
