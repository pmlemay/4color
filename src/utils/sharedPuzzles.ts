import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const COLLECTION = 'shared_puzzles'
const ID_STORE = 'shared-puzzle-ids'

/**
 * Cached for the life of the page, so a reload is what picks up a puzzle the
 * author has re-shared since. Avoids a second read per link within a session.
 */
const cache = new Map<string, string>()

function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let id = ''
  for (const byte of bytes) id += alphabet[byte % alphabet.length]
  return id
}

/**
 * Author-side map of editor slot → share document id, so re-sharing overwrites
 * the doc people already hold links to instead of minting a new one. Keyed the
 * same way as the editor draft: the puzzle id, or 'new' for an unsaved draft.
 */
function readIds(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ID_STORE) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeIds(ids: Record<string, string>): void {
  try {
    localStorage.setItem(ID_STORE, JSON.stringify(ids))
  } catch { /* out of quota — worst case the next share mints a new id */ }
}

export function getShareId(key: string): string | null {
  return readIds()[key] || null
}

export function setShareId(key: string, id: string): void {
  const ids = readIds()
  ids[key] = id
  writeIds(ids)
}

export function clearShareId(key: string): void {
  const ids = readIds()
  delete ids[key]
  writeIds(ids)
}

/**
 * Carries a draft's share id over to the id it was saved under, so links handed
 * out before the puzzle was first saved keep resolving.
 */
export function moveShareId(fromKey: string, toKey: string): void {
  const ids = readIds()
  if (!ids[fromKey]) return
  ids[toKey] = ids[fromKey]
  delete ids[fromKey]
  writeIds(ids)
}

/**
 * Writes the payload, reusing `existingId` so old links serve the new version.
 * `owner` is what lets the rules allow that overwrite for the author alone,
 * so sharing requires being signed in.
 */
export async function putSharedPuzzle(payload: string, existingId?: string | null): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to share a puzzle.')
  const id = existingId || randomId()
  const now = Date.now()
  await setDoc(
    doc(db, COLLECTION, id),
    existingId ? { payload, updatedAt: now } : { payload, owner: uid, createdAt: now, updatedAt: now },
    { merge: true },
  )
  cache.set(id, payload)
  return id
}

export async function getSharedPuzzle(id: string): Promise<string | null> {
  const cached = cache.get(id)
  if (cached) return cached
  try {
    const snap = await getDoc(doc(db, COLLECTION, id))
    const payload = snap.exists() ? (snap.data().payload as string) : null
    if (payload) cache.set(id, payload)
    return payload
  } catch {
    return null
  }
}
