import path from 'node:path';
import { build } from './build.js';
import { CRITIC_REVIEWS, EDITIONS, dataDir, fetchSource } from './sources.js';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [flag, inline] = token.slice(2).split('=');
    if (inline !== undefined) out[flag] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[flag] = argv[++i];
    else out[flag] = true;
  }
  return out;
}

const USAGE = `
Build the Terroir catalogue database from the open wine datasets.

  npm run ingest                          # X-Wines Slim (1,007 wines, 150K ratings) + 130K critic reviews
  npm run ingest -- --edition test        # X-Wines Test (100 wines) - quick smoke build
  npm run ingest -- --no-critics          # skip the 53 MB Wine Enthusiast review file
  npm run ingest -- --refresh             # re-download instead of using the cache
  npm run ingest -- --wines <csv> --ratings <csv> --edition full
                                          # the Full 100K edition, downloaded by hand from
                                          # https://github.com/rogerioxavier/X-Wines (Google Drive / Kaggle)

Options:
  --edition <test|slim|full>   which X-Wines edition to build (default: slim)
  --wines <path>               local wines CSV, overrides the download
  --ratings <path>             local ratings CSV, overrides the download
  --critics <path>             local Wine Enthusiast reviews CSV
  --no-critics                 build without critic scores, prices and tasting notes
  --db <path>                  output database (default: $DATA_DIR/wine.db)
  --refresh                    ignore cached downloads
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(USAGE);
    return;
  }

  const edition = String(args.edition ?? 'slim');
  const known = EDITIONS[edition];
  const localWines = typeof args.wines === 'string' ? args.wines : null;
  const localRatings = typeof args.ratings === 'string' ? args.ratings : null;

  if (!known && !(localWines && localRatings)) {
    console.error(`Unknown edition "${edition}". Pass --wines/--ratings for a local copy, or use: ${Object.keys(EDITIONS).join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  const refresh = Boolean(args.refresh);
  console.log(`\nTerroir ingest - ${known ? known.label : `local edition "${edition}"`}`);

  const winesPath = localWines ?? (await fetchSource(known!.wines, { refresh }));
  const ratingsPath = localRatings ?? (await fetchSource(known!.ratings, { refresh }));

  let criticPath: string | null = null;
  if (args['no-critics']) console.log('  critics  skipped (--no-critics)');
  else if (typeof args.critics === 'string') criticPath = args.critics;
  else criticPath = await fetchSource(CRITIC_REVIEWS, { refresh });

  const dbPath = typeof args.db === 'string' ? args.db : path.join(dataDir(), 'wine.db');
  const started = Date.now();
  await build({ edition, winesPath, ratingsPath, criticPath, dbPath });
  console.log(`\nBuilt ${dbPath} in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
