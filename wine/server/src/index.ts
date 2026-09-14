import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import compression from 'compression';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CatalogueMissingError, catalogueReady, CATALOGUE_PATH, meta } from './db.js';
import { winesRouter } from './routes/wines.js';
import { analyticsRouter } from './routes/analytics.js';
import { referenceRouter } from './routes/reference.js';
import { discoverRouter } from './routes/discover.js';
import { cellarRouter } from './routes/cellar.js';
import { lookupRouter } from './routes/lookup.js';
import { loadProvider } from './lib/prices.js';

const PORT = Number(process.env.PORT ?? 5100);
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = process.env.CLIENT_DIST || path.resolve(here, '../../client/dist');

const app = express();
app.use(compression());
app.use(express.json({ limit: '256kb' }));
if (process.env.NODE_ENV !== 'production') app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: catalogueReady(),
    catalogue: CATALOGUE_PATH,
    ...(catalogueReady() ? { meta: meta() } : { hint: 'run "npm run ingest" in server/ to build the catalogue' }),
  });
});

app.use('/api', winesRouter);
app.use('/api', analyticsRouter);
app.use('/api', referenceRouter);
app.use('/api', discoverRouter);
app.use('/api', cellarRouter);
app.use('/api', lookupRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'unknown endpoint' });
});

// In production the API also serves the built client.
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof CatalogueMissingError) {
    res.status(503).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'internal error' });
});

// Warm the price-provider config so the dossier knows whether one exists.
void loadProvider().catch((err) => console.warn('price provider config ignored:', (err as Error).message));

app.listen(PORT, () => {
  const state = catalogueReady() ? `catalogue ${CATALOGUE_PATH}` : 'no catalogue yet - run "npm run ingest"';
  console.log(`Terroir API listening on http://localhost:${PORT} (${state})`);
});
