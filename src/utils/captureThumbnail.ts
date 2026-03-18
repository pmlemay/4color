import html2canvas from 'html2canvas-pro'

const THUMB_MAX = 200 // max width or height in pixels

/**
 * Capture a thumbnail of the puzzle grid and POST it to the dev server.
 * Only runs on localhost (dev mode). Skips if thumbnail already exists.
 */
export async function captureThumbnail(puzzleId: string) {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  if (!isDev) return

  const el = document.querySelector('.puzzle-grid') as HTMLElement | null
  if (!el) return

  try {
    const canvas = await html2canvas(el, {
      scale: 1,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    })

    // Scale down to thumbnail size
    const ratio = Math.min(THUMB_MAX / canvas.width, THUMB_MAX / canvas.height, 1)
    const tw = Math.round(canvas.width * ratio)
    const th = Math.round(canvas.height * ratio)

    const thumb = document.createElement('canvas')
    thumb.width = tw
    thumb.height = th
    const ctx = thumb.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, tw, th)

    const dataUrl = thumb.toDataURL('image/png')

    await fetch('/api/save-thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: puzzleId, dataUrl }),
    })
  } catch {
    // Silently fail — thumbnails are nice-to-have
  }
}
