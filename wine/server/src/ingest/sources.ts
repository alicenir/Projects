import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

export type RemoteFile = { file: string; url: string; note?: string };

export type WineEdition = {
  id: string;
  label: string;
  wines: RemoteFile;
  ratings: RemoteFile;
};

/**
 * X-Wines (CC BY 4.0 / CC0 dedication in the repo) is the catalogue backbone:
 * wines with grapes, food pairings, body/acidity and 5-star user ratings.
 *
 * The project's own repository ships only the 100-wine Test edition; Slim and
 * Full live on Google Drive and Kaggle, which are not scriptable. `slim` is
 * therefore pulled from a public GitHub mirror, and `full` is local-only —
 * download it once and point the ingester at the files with --wines/--ratings.
 */
export const EDITIONS: Record<string, WineEdition> = {
  test: {
    id: 'test',
    label: 'X-Wines Test — 100 wines, 1K ratings',
    wines: {
      file: 'xwines_test_100_wines.csv',
      url: 'https://raw.githubusercontent.com/rogerioxavier/X-Wines/main/Dataset/last/XWines_Test_100_wines.csv',
    },
    ratings: {
      file: 'xwines_test_1k_ratings.csv',
      url: 'https://raw.githubusercontent.com/rogerioxavier/X-Wines/main/Dataset/last/XWines_Test_1K_ratings.csv',
    },
  },
  slim: {
    id: 'slim',
    label: 'X-Wines Slim — 1,007 wines, 150K ratings',
    wines: {
      file: 'xwines_slim_1k_wines.csv',
      url: 'https://raw.githubusercontent.com/Anotherafael/WineRecommendation/main/dataset/XWines_Slim_1K_wines.csv',
      note: 'mirror of the X-Wines Slim edition',
    },
    ratings: {
      file: 'xwines_slim_150k_ratings.csv',
      url: 'https://raw.githubusercontent.com/Anotherafael/WineRecommendation/main/dataset/XWines_Slim_150K_ratings.csv',
      note: 'mirror of the X-Wines Slim edition',
    },
  },
};

/**
 * Wine Enthusiast tasting notes (the Kaggle "wine reviews" set, served here
 * from the TidyTuesday archive): 130K critic reviews with a 80–100 point score,
 * a bottle price and a paragraph of tasting notes. Optional, but it is what
 * gives the site prices, critic scores and flavour vocabulary.
 */
export const CRITIC_REVIEWS: RemoteFile = {
  file: 'winemag_130k_reviews.csv',
  url: 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2019/2019-05-28/winemag-data-130k-v2.csv',
};

export function cacheDir(): string {
  return process.env.CACHE_DIR || path.join(dataDir(), 'cache');
}

export function dataDir(): string {
  return process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
}

async function exists(p: string): Promise<number | null> {
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return null;
  }
}

/** Download `source` into the cache unless it is already there. */
export async function fetchSource(source: RemoteFile, opts: { refresh?: boolean } = {}): Promise<string> {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, source.file);

  const size = await exists(dest);
  if (size !== null && size > 0 && !opts.refresh) {
    console.log(`  cached  ${source.file} (${fmtBytes(size)})`);
    return dest;
  }

  console.log(`  fetch   ${source.url}`);
  const res = await fetch(source.url, { headers: { 'user-agent': 'terroir-ingest' } });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status} ${res.statusText}): ${source.url}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, dest);
  console.log(`  saved   ${source.file} (${fmtBytes((await exists(dest)) ?? 0)})`);
  return dest;
}

export function fmtBytes(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
