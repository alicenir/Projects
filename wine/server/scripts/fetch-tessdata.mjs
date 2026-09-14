/**
 * One-time download of the Tesseract English model so label photos can be read
 * locally. ~4 MB, from the official tesseract-ocr data repository.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const LANG = process.env.TESSERACT_LANG || 'eng';
const DIR = process.env.TESSDATA_DIR || path.resolve(process.env.DATA_DIR || 'data', 'tessdata');
const URL = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${LANG}.traineddata`;
const dest = path.join(DIR, `${LANG}.traineddata`);

try {
  const info = await stat(dest);
  console.log(`${dest} already present (${(info.size / 1e6).toFixed(1)} MB)`);
  process.exit(0);
} catch {
  // not there yet - fetch it
}

await mkdir(DIR, { recursive: true });
console.log(`Fetching ${URL}`);
const res = await fetch(URL);
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
await writeFile(dest, Buffer.from(await res.arrayBuffer()));
const info = await stat(dest);
console.log(`Saved ${dest} (${(info.size / 1e6).toFixed(1)} MB) - label photos are ready.`);
