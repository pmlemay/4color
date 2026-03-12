import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

/** Live map of puzzleId → total completion count (all users, including anonymous) */
export function usePuzzleStats() {
  const [stats, setStats] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    if (!isDev) return
    return onSnapshot(collection(db, 'puzzle_stats'), snap => {
      const next = new Map<string, number>()
      for (const doc of snap.docs) {
        const count = doc.data().completionCount
        if (typeof count === 'number' && count > 0) {
          next.set(doc.id, count)
        }
      }
      setStats(next)
    }, () => {
      // ignore errors — stats are optional
    })
  }, [])

  return stats
}
