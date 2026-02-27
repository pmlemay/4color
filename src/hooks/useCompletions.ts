import { useEffect, useState, useCallback, useRef } from 'react'
import { doc, getDoc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useCompletions() {
  const { user } = useAuth()
  const [completedPuzzleIds, setCompletedPuzzleIds] = useState<Set<string>>(new Set())
  const [displayName, setDisplayNameState] = useState<string>('')
  // Ref mirror so callbacks can check current state without re-creating
  const completedRef = useRef(completedPuzzleIds)
  completedRef.current = completedPuzzleIds

  useEffect(() => {
    if (!user) {
      setCompletedPuzzleIds(new Set())
      setDisplayNameState('')
      return
    }
    const ref = doc(db, 'completions_index', user.uid)
    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data()
        const ids = data.puzzleIds || []
        setCompletedPuzzleIds(new Set(ids))
        setDisplayNameState(data.displayName || user.displayName || '')
        // Fix count if it drifted out of sync with array length
        if (data.count !== ids.length) {
          updateDoc(ref, { count: ids.length }).catch(() => {})
        }
      } else {
        setCompletedPuzzleIds(new Set())
        setDisplayNameState(user.displayName || '')
      }
    }, () => {
      setCompletedPuzzleIds(new Set())
      setDisplayNameState(user.displayName || '')
    })
  }, [user])

  const markCompleted = useCallback(async (puzzleId: string) => {
    if (!user) return
    // Skip if already completed
    if (completedRef.current.has(puzzleId)) return
    const ref = doc(db, 'completions_index', user.uid)
    try {
      // Read current to get accurate count
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const ids: string[] = snap.data().puzzleIds || []
        if (ids.includes(puzzleId)) return // already there
        await updateDoc(ref, {
          puzzleIds: arrayUnion(puzzleId),
          count: ids.length + 1,
        })
      } else {
        const name = user.displayName || 'Anonymous'
        await setDoc(ref, { uid: user.uid, puzzleIds: [puzzleId], count: 1, displayName: name })
      }
    } catch {
      // Fallback: try creating the doc
      const name = user.displayName || 'Anonymous'
      await setDoc(ref, { uid: user.uid, puzzleIds: [puzzleId], count: 1, displayName: name }).catch(() => {})
    }
  }, [user])

  const unmarkCompleted = useCallback(async (puzzleId: string) => {
    if (!user) return
    if (!completedRef.current.has(puzzleId)) return
    const ref = doc(db, 'completions_index', user.uid)
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const ids: string[] = snap.data().puzzleIds || []
        const newCount = Math.max(0, ids.filter(id => id !== puzzleId).length)
        await updateDoc(ref, {
          puzzleIds: arrayRemove(puzzleId),
          count: newCount,
        })
      }
    } catch {
      // ignore
    }
  }, [user])

  const setDisplayName = useCallback(async (name: string) => {
    if (!user) return
    const trimmed = name.trim()
    if (!trimmed) return
    const ref = doc(db, 'completions_index', user.uid)
    try {
      await updateDoc(ref, { displayName: trimmed })
    } catch {
      await setDoc(ref, { uid: user.uid, puzzleIds: [], count: 0, displayName: trimmed })
    }
  }, [user])

  return { completedPuzzleIds, displayName, setDisplayName, markCompleted, unmarkCompleted }
}
