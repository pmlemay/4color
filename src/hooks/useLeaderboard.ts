import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export interface LeaderboardEntry {
  uid: string
  displayName: string
  count: number
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'completions_index'),
      orderBy('count', 'desc')
    )
    return onSnapshot(q, snap => {
      const results: LeaderboardEntry[] = []
      snap.forEach(doc => {
        const data = doc.data()
        const count = data.times ? Object.keys(data.times).length : data.count || 0
        if (count > 0) {
          results.push({
            uid: doc.id,
            displayName: data.displayName || 'Anonymous',
            count,
          })
        }
      })
      results.sort((a, b) => b.count - a.count)
      setEntries(results)
    }, () => {
      // Firestore error — ignore silently
      setEntries([])
    })
  }, [])

  return entries
}
