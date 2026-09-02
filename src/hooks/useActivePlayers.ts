import { useEffect, useState } from 'react'
import { collection, getDocs, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface ActivePlayer {
  uid: string
  displayName: string
  puzzleId: string
}

/**
 * Presence is polled, not streamed. A listener on the whole collection bills one
 * read per heartbeat per viewer, so the cost was (viewers x players x beats/min)
 * and scaled quadratically with how busy the site was.
 */
const POLL_MS = 60_000

/** Drop a heartbeat older than this. Must comfortably exceed the heartbeat interval. */
const STALE_MS = 150_000

function groupByPuzzle(docs: QueryDocumentSnapshot[]): Map<string, ActivePlayer[]> {
  const now = Date.now()
  const grouped = new Map<string, ActivePlayer[]>()

  for (const d of docs) {
    const data = d.data()
    if (!data.puzzleId || !data.lastSeen) continue

    const lastSeen = data.lastSeen instanceof Timestamp
      ? data.lastSeen.toMillis()
      : typeof data.lastSeen === 'number' ? data.lastSeen : 0
    if (now - lastSeen > STALE_MS) continue

    const entry: ActivePlayer = {
      uid: data.uid,
      displayName: data.displayName || 'Anonymous',
      puzzleId: data.puzzleId,
    }

    const list = grouped.get(data.puzzleId)
    if (list) {
      if (!list.some(p => p.uid === entry.uid)) list.push(entry)
    } else {
      grouped.set(data.puzzleId, [entry])
    }
  }

  return grouped
}

/**
 * Map of puzzleId -> active player names, refreshed once a minute while the tab
 * is visible.
 */
export function useActivePlayers(): Map<string, ActivePlayer[]> {
  const [players, setPlayers] = useState<Map<string, ActivePlayer[]>>(new Map())

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastFetch = 0

    const fetchNow = async () => {
      lastFetch = Date.now()
      try {
        const snap = await getDocs(collection(db, 'presence'))
        if (!cancelled) setPlayers(groupByPuzzle(snap.docs))
      } catch {
        if (!cancelled) setPlayers(new Map())
      }
    }

    const tick = async () => {
      // A hidden tab shows nobody, so skip the read entirely — this is where
      // most of the savings come from, since list tabs are left open for hours.
      if (document.visibilityState === 'visible') await fetchNow()
      if (!cancelled) timer = setTimeout(tick, POLL_MS)
    }
    tick()

    // Coming back to the tab shouldn't leave a minute-old list on screen, but
    // don't let tab-flipping turn into one read per switch either.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch > POLL_MS / 2) {
        fetchNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return players
}
