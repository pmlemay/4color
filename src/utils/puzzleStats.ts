import { doc, increment, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const STORAGE_KEY = 'puzzleStatsTracked'

function getTrackedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function markTracked(puzzleId: string) {
  const set = getTrackedSet()
  set.add(puzzleId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
}

/** Atomically increment the completion count for a puzzle (once per browser) */
export async function incrementPuzzleCompletions(puzzleId: string): Promise<void> {
  if (getTrackedSet().has(puzzleId)) return
  const ref = doc(db, 'puzzle_stats', puzzleId)
  try {
    await setDoc(ref, { completionCount: increment(1) }, { merge: true })
    markTracked(puzzleId)
  } catch {
    // silently ignore — stats are best-effort
  }
}
