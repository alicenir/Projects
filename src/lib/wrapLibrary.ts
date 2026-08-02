export interface SavedWrap {
  name: string
  size: number
  modified: string
}

/**
 * Client for the optional wrap-library backend (see server/index.js).
 *
 * The app is designed to work with or without it: when running as a plain static
 * build (or `npm run dev` with no server), `isLibraryAvailable()` returns false and
 * the UI simply hides the library, falling back to browser downloads.
 */
export async function isLibraryAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return false
    const body = await res.json()
    return body?.ok === true
  } catch {
    return false
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

export async function listWraps(): Promise<SavedWrap[]> {
  const res = await fetch('/api/wraps')
  if (!res.ok) throw new Error(await readError(res, 'Could not load the wrap library.'))
  return res.json()
}

export async function saveWrap(name: string, dataUrl: string): Promise<SavedWrap> {
  const res = await fetch('/api/wraps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataUrl }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Could not save the wrap.'))
  return res.json()
}

export async function deleteWrap(name: string): Promise<void> {
  const res = await fetch(`/api/wraps/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res, 'Could not delete the wrap.'))
}

export function wrapUrl(name: string): string {
  return `/api/wraps/${encodeURIComponent(name)}`
}
