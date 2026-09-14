import { createReadStream } from 'node:fs';

/**
 * Streaming RFC-4180 CSV reader. The wine datasets carry quoted fields with
 * embedded commas, quotes and the odd newline, so a split(',') will not do.
 */
export async function* readCsvRows(path: string): AsyncGenerator<string[]> {
  const stream = createReadStream(path, { encoding: 'utf8' });
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let quoteSeen = false; // a '"' inside a quoted field: either an escape or the closer

  for await (const chunk of stream as AsyncIterable<string>) {
    for (const c of chunk) {
      if (quoteSeen) {
        quoteSeen = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        inQuotes = false;
      }
      if (inQuotes) {
        if (c === '"') quoteSeen = true;
        else field += c;
        continue;
      }
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        field = '';
        yield row;
        row = [];
      } else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    yield row;
  }
}

/** Same, but keyed by the header row. */
export async function* readCsvObjects(path: string): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;
  for await (const row of readCsvRows(path)) {
    if (!header) {
      header = row.map((h) => h.replace(/^﻿/, '').trim());
      continue;
    }
    if (row.length === 1 && row[0] === '') continue; // trailing blank line
    const out: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) out[header[i]] = row[i] ?? '';
    yield out;
  }
}

/**
 * X-Wines stores lists the way Python prints them: ['Merlot', 'Cabernet'] and
 * [2020, 2019, 'N.V.']. Parse those into plain string arrays.
 */
export function parsePyList(raw: string): string[] {
  const s = (raw ?? '').trim();
  if (!s || s === '[]') return [];
  const body = s.startsWith('[') ? s.slice(1, -1) : s;
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (const c of body) {
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === ',') {
      const v = cur.trim();
      if (v) out.push(v);
      cur = '';
    } else cur += c;
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

export function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
