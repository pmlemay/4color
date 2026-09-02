import { useMemo } from 'react'
import { useCompletionsIndex } from './useCompletionsIndex'

export interface LeaderboardEntry {
  uid: string
  displayName: string
  count: number
}

export function useLeaderboard() {
  const records = useCompletionsIndex()

  return useMemo(() => (
    records
      .filter(r => r.count > 0)
      .map(r => ({ uid: r.uid, displayName: r.displayName, count: r.count }))
      .sort((a, b) => b.count - a.count)
  ), [records])
}
