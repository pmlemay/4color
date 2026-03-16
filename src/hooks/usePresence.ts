import { useEffect, useRef } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useCompletions } from './useCompletions'

const HEARTBEAT_MS = 30_000

/**
 * Writes a presence document for the current signed-in user while they are on a puzzle page.
 * Heartbeats every 30s so stale entries can be detected. Cleans up on unmount / tab close.
 */
export function usePresence(puzzleId: string | undefined) {
  const { user } = useAuth()
  const { displayName } = useCompletions()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const docIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !puzzleId) return

    const docId = user.uid
    docIdRef.current = docId
    const ref = doc(db, 'presence', docId)
    const name = displayName || user.displayName || 'Anonymous'

    const write = () => {
      setDoc(ref, {
        uid: user.uid,
        displayName: name,
        puzzleId,
        lastSeen: serverTimestamp(),
      }).catch(() => {})
    }

    // Initial write
    write()

    // Heartbeat
    intervalRef.current = setInterval(write, HEARTBEAT_MS)

    // Cleanup on unmount
    const cleanup = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      deleteDoc(ref).catch(() => {})
      docIdRef.current = null
    }

    // Also clean up on tab close / navigation
    const handleUnload = () => {
      // Use navigator.sendBeacon for reliability on tab close
      // Fall back to deleteDoc which may not complete
      deleteDoc(ref).catch(() => {})
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      cleanup()
    }
  }, [user, puzzleId, displayName])
}
