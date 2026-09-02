import { useEffect, useRef } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const HEARTBEAT_MS = 60_000

/**
 * Written so a Firestore TTL policy on `expiresAt` can reap docs left behind by
 * tabs that crashed before cleanup ran — otherwise they accumulate forever and
 * every presence poll pays to read them.
 */
const TTL_MS = 5 * 60_000

function getSessionId(): string {
  let id = sessionStorage.getItem('presenceSessionId')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('presenceSessionId', id)
  }
  return id
}

/**
 * Writes a presence document while on a puzzle page.
 * Doc ID is {userId}__{puzzleId} so multiple puzzles can be open simultaneously.
 * Heartbeats every 60s so stale entries can be detected.
 */
export function usePresence(puzzleId: string | undefined, displayName: string) {
  const { user, loading: authLoading } = useAuth()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!puzzleId) return
    // Wait for auth to resolve and displayName to load before writing
    if (authLoading) return
    if (user && !displayName) return

    const userId = user ? user.uid : `anon_${getSessionId()}`
    const docId = `${userId}__${puzzleId}`
    const ref = doc(db, 'presence', docId)
    const name = user
      ? (displayName || user.displayName || 'Anonymous')
      : 'Anonymous'

    const write = () => {
      setDoc(ref, {
        uid: userId,
        displayName: name,
        puzzleId,
        lastSeen: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
      }).catch(() => {})
    }

    // Initial write
    write()

    // Heartbeat. A backgrounded tab isn't actively playing, so it stops beating
    // and ages out of the list instead of costing every viewer a read.
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') write()
    }, HEARTBEAT_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') write()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const cleanup = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      deleteDoc(ref).catch(() => {})
    }

    const handleUnload = () => {
      deleteDoc(ref).catch(() => {})
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      cleanup()
    }
  }, [user, authLoading, puzzleId, displayName])
}
