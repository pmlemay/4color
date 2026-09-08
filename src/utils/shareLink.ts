import { PuzzleData, PuzzleSolution } from '../types'

export interface SharedPuzzle {
  puzzle: PuzzleData
  solution?: PuzzleSolution
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Deflate + base64url. Keeps the stored doc far below Firestore's 1 MiB limit,
 * and means the embedded solution isn't readable in the document either —
 * enough to stop accidental spoilers, not real secrecy. Anyone determined can
 * decode it, because validation necessarily happens on the player's machine.
 */
export async function encodeSharedPuzzle(shared: SharedPuzzle): Promise<string> {
  const compressed = new Blob([JSON.stringify(shared)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return toBase64Url(await collectStream(compressed))
}

export async function decodeSharedPuzzle(payload: string): Promise<SharedPuzzle | null> {
  try {
    const bytes = fromBase64Url(payload)
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const json = new TextDecoder().decode(await collectStream(stream))
    const parsed = JSON.parse(json) as SharedPuzzle
    return parsed?.puzzle?.gridSize ? parsed : null
  } catch {
    return null
  }
}

export function buildShareUrl(docId: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}play/shared?d=${docId}`
}
