import Database from 'better-sqlite3';
import type { Database as Db } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { CELLAR_SCHEMA } from './ingest/schema.js';
import { grapeKey, countryCode } from './lib/taxonomy.js';

export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
export const CATALOGUE_PATH = process.env.WINE_DB || path.join(DATA_DIR, 'wine.db');
export const CELLAR_PATH = process.env.CELLAR_DB || path.join(DATA_DIR, 'cellar.db');

let db: Db | null = null;

export class CatalogueMissingError extends Error {
  constructor(public readonly dbPath: string) {
    super(`No catalogue database at ${dbPath}. Run "npm run ingest" in server/ to build it.`);
    this.name = 'CatalogueMissingError';
  }
}

/**
 * One connection over two files: the catalogue (rebuilt by the ingester) and
 * the cellar (the user's own bottles and notes, never touched by an ingest).
 * Attaching them lets a single query join a shelf to its wine.
 */
export function getDb(): Db {
  if (db) return db;
  if (!existsSync(CATALOGUE_PATH)) throw new CatalogueMissingError(CATALOGUE_PATH);

  mkdirSync(path.dirname(CELLAR_PATH), { recursive: true });
  db = new Database(CATALOGUE_PATH);
  db.pragma('journal_mode = WAL');
  db.function('grape_key', (v: unknown) => grapeKey(String(v ?? '')));
  db.function('country_code', (v: unknown) => countryCode(String(v ?? '')));
  db.exec(`ATTACH DATABASE '${CELLAR_PATH.replace(/'/g, "''")}' AS cellar`);
  db.exec(CELLAR_SCHEMA);
  return db;
}

export function catalogueReady(): boolean {
  return existsSync(CATALOGUE_PATH);
}

export function meta(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
