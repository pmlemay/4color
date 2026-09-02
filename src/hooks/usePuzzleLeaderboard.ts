import { useMemo } from 'react'
import { useCompletionsIndex } from './useCompletionsIndex'

export interface PuzzleLeaderboardEntry {
  uid: string
  displayName: string
  time: number // ms
}

export function usePuzzleLeaderboard(puzzleId: string | undefined) {
  const records = useCompletionsIndex()

  return useMemo(() => {
    if (!puzzleId) return []
    return records
      .filter(r => r.times[puzzleId] > 0)
      .map(r => ({ uid: r.uid, displayName: r.displayName, time: r.times[puzzleId] }))
      .sort((a, b) => a.time - b.time)
  }, [records, puzzleId])
}
