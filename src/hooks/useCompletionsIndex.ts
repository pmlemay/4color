import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export interface CompletionRecord {
  uid: string
  displayName: string
  times: Record<string, number>
  count: number
}

/**
 * One cached read of `completions_index`, shared by every leaderboard.
 *
 * The collection holds one document per user and Firestore bills per document,
 * so the previous live listeners charged a full-table read on every home-page
 * load *and* on every puzzle open, then again on every change. Both views now
 * derive from this single snapshot, refetched at most once per CACHE_MS.
 */
const CACHE_MS = 60_000

let cache: CompletionRecord[] | null = null
let fetchedAt = 0
let inflight: Promise<CompletionRecord[]> | null = null
const listeners = new Set<(records: CompletionRecord[]) => void>()

function toRecord(id: string, data: Record<string, unknown>): CompletionRecord {
  const times = (data.times as Record<string, number>) || {}
  return {
    uid: id,
    displayName: (data.displayName as string) || 'Anonymous',
    times,
    // `times` is authoritative when present; `count` is the pre-migration fallback
    count: data.times ? Object.keys(times).length : ((data.count as number) || 0),
  }
}

function load(force = false): Promise<CompletionRecord[]> {
  if (!force && cache && Date.now() - fetchedAt < CACHE_MS) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = getDocs(collection(db, 'completions_index'))
    .then(snap => {
      cache = snap.docs.map(d => toRecord(d.id, d.data()))
      fetchedAt = Date.now()
      for (const notify of listeners) notify(cache)
      return cache
    })
    .catch(() => cache ?? [])
    .finally(() => { inflight = null })

  return inflight
}

/** Force a refetch — call after writing a completion so the board reflects it. */
export function refreshCompletionsIndex(): Promise<CompletionRecord[]> {
  return load(true)
}

export function useCompletionsIndex(): CompletionRecord[] {
  const [records, setRecords] = useState<CompletionRecord[]>(() => cache ?? [])

  useEffect(() => {
    let active = true
    const notify = (next: CompletionRecord[]) => { if (active) setRecords(next) }
    listeners.add(notify)
    load().then(notify)
    return () => {
      active = false
      listeners.delete(notify)
    }
  }, [])

  return records
}
