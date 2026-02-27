import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export interface LeaderboardEntry {
  uid: string
  displayName: string
  count: number
}

export function useLeaderboard(maxEntries = 10) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'completions_index'),
      orderBy('count', 'desc'),
      limit(maxEntries)
    )
    return onSnapshot(q, snap => {
      const results: LeaderboardEntry[] = []
      snap.forEach(doc => {
        const data = doc.data()
        if (data.count > 0) {
          results.push({
            uid: doc.id,
            displayName: data.displayName || 'Anonymous',
            count: data.count,
          })
        }
      })
      setEntries(results)
    }, () => {
      // Firestore error — ignore silently
      setEntries([])
    })
  }, [maxEntries])

  return entries
}
