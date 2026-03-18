import { useEffect, useRef } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useCompletions } from './useCompletions'

const HEARTBEAT_MS = 30_000

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
 * Heartbeats every 30s so stale entries can be detected.
 */
export function usePresence(puzzleId: string | undefined) {
  const { user, loading: authLoading } = useAuth()
  const { displayName } = useCompletions()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRefPath = useRef<string | null>(null)

  useEffect(() => {
    if (!puzzleId) return
    // Wait for auth to resolve and displayName to load before writing
    if (authLoading) return
    if (user && !displayName) return

    const userId = user ? user.uid : `anon_${getSessionId()}`
    const docId = `${userId}__${puzzleId}`
    const ref = doc(db, 'presence', docId)
    activeRefPath.current = docId
    const name = user
      ? (displayName || user.displayName || 'Anonymous')
      : 'Anonymous'

    const write = () => {
      setDoc(ref, {
        uid: userId,
        displayName: name,
        puzzleId,
        lastSeen: serverTimestamp(),
      }).catch(() => {})
    }

    // Initial write
    write()

    // Heartbeat
    intervalRef.current = setInterval(write, HEARTBEAT_MS)

    const cleanup = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      deleteDoc(ref).catch(() => {})
      activeRefPath.current = null
    }

    const handleUnload = () => {
      deleteDoc(ref).catch(() => {})
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      cleanup()
    }
  }, [user, authLoading, puzzleId, displayName])
}
