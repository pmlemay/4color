import { useMemo } from 'react'
import { useCompletionsIndex } from './useCompletionsIndex'

export interface PuzzleLeaderboardEntry {
  uid: string
  displayName: string
  time: number // ms
}

/** Solvers whose time was never captured are listed, but after every real time. */
function byTime(a: PuzzleLeaderboardEntry, b: PuzzleLeaderboardEntry): number {
  if (a.time > 0 && b.time > 0) return a.time - b.time
  if (a.time > 0) return -1
  if (b.time > 0) return 1
  return 0
}

export function usePuzzleLeaderboard(puzzleId: string | undefined) {
  const records = useCompletionsIndex(!!puzzleId)

  return useMemo(() => {
    if (!puzzleId) return []
    return records
      .filter(r => typeof r.times[puzzleId] === 'number')
      .map(r => ({ uid: r.uid, displayName: r.displayName, time: r.times[puzzleId] }))
      .sort(byTime)
  }, [records, puzzleId])
}
