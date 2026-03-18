import { useEffect, useState } from 'react'
import { collection, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface ActivePlayer {
  uid: string
  displayName: string
  puzzleId: string
}

const STALE_MS = 60_000 // Consider presence stale after 60s without heartbeat

/**
 * Listens to all presence documents and returns a map of puzzleId → active player names.
 * Filters out stale entries (no heartbeat in last 60s).
 */
export function useActivePlayers(): Map<string, ActivePlayer[]> {
  const [players, setPlayers] = useState<Map<string, ActivePlayer[]>>(new Map())

  useEffect(() => {
    const ref = collection(db, 'presence')
    return onSnapshot(ref, snap => {
      const now = Date.now()
      const grouped = new Map<string, ActivePlayer[]>()

      for (const d of snap.docs) {
        const data = d.data()
        if (!data.puzzleId || !data.lastSeen) continue

        // Check staleness
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

      setPlayers(grouped)
    }, () => {
      // On error, just clear
      setPlayers(new Map())
    })
  }, [])

  return players
}
