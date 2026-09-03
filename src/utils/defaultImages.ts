const BASE = import.meta.env.BASE_URL

/**
 * Data URIs seeded into every puzzle's image library. Shipped as a static file
 * in public/, so whatever is in the bucket at build time reaches everyone in
 * prod — including people who only ever use the editor to make their own puzzles.
 */
let cache: string[] | null = null
let inflight: Promise<string[]> | null = null

export async function fetchDefaultImages(): Promise<string[]> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = fetch(`${BASE}default-images.json`)
    .then(res => (res.ok ? res.json() : { images: [] }))
    .then((data: { images?: string[] }) => {
      const images = data.images ?? []
      cache = images
      return images
    })
    .catch(() => [])
    .finally(() => { inflight = null })

  return inflight
}

/**
 * Dev-only: add or remove one image from the shared bucket and write it to disk
 * straight away, independent of whether the puzzle being edited is ever saved.
 * The dev server owns the merge so two toggles can't clobber each other.
 */
export async function setDefaultImage(
  image: string,
  include: boolean,
): Promise<{ ok: boolean; images?: string[]; error?: string }> {
  try {
    const res = await fetch('/api/save-default-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, include }),
    })
    const result = await res.json()
    if (result.ok && Array.isArray(result.images)) cache = result.images
    return result
  } catch {
    return { ok: false, error: 'Server not available (only works in dev mode)' }
  }
}
