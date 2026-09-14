import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../db.js';
import { extractVintage } from './identity.js';

/**
 * Reading a wine label.
 *
 * The photo never leaves the machine: Tesseract runs locally against a language
 * file on disk. Label text is display type on a textured ground, often gold on
 * cream, so the preprocessing below matters as much as the OCR engine.
 */

export const LANG_DIR = process.env.TESSDATA_DIR || path.join(DATA_DIR, 'tessdata');
export const LANG = process.env.TESSERACT_LANG || 'eng';

let workerPromise: Promise<Worker> | null = null;

export function ocrAvailable(): boolean {
  return existsSync(path.join(LANG_DIR, `${LANG}.traineddata`)) || existsSync(path.join(LANG_DIR, `${LANG}.traineddata.gz`));
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(LANG, 1, {
      langPath: LANG_DIR,
      gzip: false,
      cacheMethod: 'none',
      logger: () => {},
    });
  }
  return workerPromise;
}

export async function shutdownOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

/** Lines that are on every bottle and identify none of them. */
const BOILERPLATE = /\b(alc|vol|ml|cl|contains?|sulfites?|sulphites?|government|warning|surgeon|general|pregnan|drink|responsib|imported|importer|product of|mis en bouteille|bottled by|net contents|75cl|750ml)\b/i;

export type LabelReading = {
  text: string;
  lines: { text: string; confidence: number }[];
  vintage: number | null;
  /** The lines we think name the wine, biggest and most confident first. */
  query: string;
  confidence: number;
};

/** Two passes: the photo as shot, and a high-contrast version for gold-on-cream. */
async function variants(image: Buffer): Promise<Buffer[]> {
  const base = sharp(image).rotate().resize({ width: 1400, withoutEnlargement: true });
  const plain = await base.clone().grayscale().normalise().sharpen().toBuffer();
  const punchy = await base
    .clone()
    .grayscale()
    .normalise()
    .linear(1.35, -28)
    .median(1)
    .sharpen()
    .toBuffer();
  return [plain, punchy];
}

export async function readLabel(image: Buffer): Promise<LabelReading> {
  const worker = await getWorker();
  const candidates = await variants(image);

  let best: { lines: { text: string; confidence: number }[]; confidence: number; text: string } | null = null;
  for (const buffer of candidates) {
    const { data } = await worker.recognize(buffer);
    const lines = String(data.text ?? '')
      .split('\n')
      .map((line) => line.replace(/[^\p{L}\p{N}&'’ .-]+/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 3)
      .map((line) => ({ text: line, confidence: data.confidence ?? 0 }));
    const score = lines.reduce((sum, l) => sum + l.text.length, 0) * (data.confidence ?? 0);
    if (!best || score > best.lines.reduce((sum, l) => sum + l.text.length, 0) * best.confidence) {
      best = { lines, confidence: data.confidence ?? 0, text: String(data.text ?? '') };
    }
  }

  const lines = best?.lines ?? [];
  const useful = lines.filter((l) => !BOILERPLATE.test(l.text) && !/^\d+$/.test(l.text));
  const vintage = extractVintage(lines.map((l) => l.text).join(' '));

  // Producer and cuvée are the largest type on a label, which OCR returns as
  // the longest confident lines near the top; keep the first few.
  const query = useful
    .slice(0, 6)
    .map((l) => l.text)
    .join(' ')
    .slice(0, 300);

  return { text: best?.text ?? '', lines, vintage, query, confidence: Math.round(best?.confidence ?? 0) };
}
