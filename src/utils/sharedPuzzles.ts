import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'

const COLLECTION = 'shared_puzzles'
const ID_STORE = 'shared-puzzle-ids'

export interface SharedPuzzleMeta {
  id: string
  title: string
  updatedAt: number
  owner: string
  ownerName: string
}

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
 * same way as the editor draft: the puzzle id, the shared doc id, or 'new'.
 *
 * This is only a convenience: it lives in localStorage, so clearing the cache
 * loses it. The durable record is the `owner` field on the document itself —
 * that's what listMySharedPuzzles recovers from.
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
 * `owner` is what lets the rules allow that overwrite for the author alone, and
 * what makes the puzzle recoverable later, so sharing requires being signed in.
 * `title` is stored in the clear purely so the author's list is readable
 * without decompressing every payload.
 */
export async function putSharedPuzzle(payload: string, title: string, existingId?: string | null): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Sign in to share a puzzle.')
  const id = existingId || randomId()
  const now = Date.now()
  const ownerName = auth.currentUser?.displayName || 'Anonymous'
  // `owner` goes on every write, not just the first. Re-sharing a puzzle whose
  // doc has since been deleted is a create as far as the rules are concerned,
  // and the create rule demands an owner — without it the write is rejected and
  // a still-loaded puzzle can never be re-shared. With it, the same id is
  // simply revived and old links start working again.
  await setDoc(
    doc(db, COLLECTION, id),
    existingId
      ? { payload, title, owner: uid, ownerName, updatedAt: now }
      : { payload, title, owner: uid, ownerName, createdAt: now, updatedAt: now },
    { merge: true },
  )
  cache.set(id, payload)
  return id
}

function toMeta(d: QueryDocumentSnapshot): SharedPuzzleMeta {
  const data = d.data()
  return {
    id: d.id,
    title: (data.title as string) || 'Untitled',
    updatedAt: (data.updatedAt as number) || 0,
    owner: (data.owner as string) || '',
    ownerName: (data.ownerName as string) || 'Unknown',
  }
}

function byNewest(a: SharedPuzzleMeta, b: SharedPuzzleMeta): number {
  return b.updatedAt - a.updatedAt
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

/**
 * The signed-in author's own shared puzzles, newest first. The rules only
 * permit listing your own, so this is the query that recovers a puzzle after a
 * cleared cache. Sorted client-side to avoid needing a composite index.
 */
export async function listMySharedPuzzles(): Promise<SharedPuzzleMeta[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('owner', '==', uid)))
    return snap.docs.map(toMeta).sort(byNewest)
  } catch {
    return []
  }
}

/**
 * Every user's shared puzzles. Authority is the rules' admin-uid check, not the
 * caller — for anyone else this query is rejected and comes back empty, so a
 * `?debug=true` in the URL grants nothing on its own.
 */
export async function listAllSharedPuzzles(): Promise<SharedPuzzleMeta[]> {
  if (!auth.currentUser) return []
  try {
    const snap = await getDocs(collection(db, COLLECTION))
    return snap.docs.map(toMeta).sort(byNewest)
  } catch {
    return []
  }
}

export async function deleteSharedPuzzle(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
  cache.delete(id)
}
