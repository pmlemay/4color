import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export interface PuzzleLeaderboardEntry {
  uid: string
  displayName: string
  time: number // ms
}

export function usePuzzleLeaderboard(puzzleId: string | undefined, maxEntries = 10) {
  const [entries, setEntries] = useState<PuzzleLeaderboardEntry[]>([])

  useEffect(() => {
    if (!puzzleId) return
    // Query all users who have at least 1 completion, then filter client-side
    const q = query(
      collection(db, 'completions_index'),
      where('count', '>', 0)
    )
    return onSnapshot(q, snap => {
      const results: PuzzleLeaderboardEntry[] = []
      snap.forEach(doc => {
        const data = doc.data()
        const times = data.times as Record<string, number> | undefined
        if (times && puzzleId in times && times[puzzleId] > 0) {
          results.push({
            uid: doc.id,
            displayName: data.displayName || 'Anonymous',
            time: times[puzzleId],
          })
        }
      })
      results.sort((a, b) => a.time - b.time)
      setEntries(results.slice(0, maxEntries))
    }, () => {
      setEntries([])
    })
  }, [puzzleId, maxEntries])

  return entries
}
