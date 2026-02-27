import { useEffect, useState, useCallback, useRef } from 'react'
import { doc, getDoc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useCompletions() {
  const { user } = useAuth()
  const [completedPuzzleIds, setCompletedPuzzleIds] = useState<Set<string>>(new Set())
  const [completionTimes, setCompletionTimes] = useState<Map<string, number>>(new Map())
  const [displayName, setDisplayNameState] = useState<string>('')
  // Ref mirror so callbacks can check current state without re-create
  const completedRef = useRef(completedPuzzleIds)
  completedRef.current = completedPuzzleIds
  const timesRef = useRef(completionTimes)
  timesRef.current = completionTimes

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
        const times = data.times || {}
        setCompletionTimes(new Map(Object.entries(times) as [string, number][]))
        // Fix count if it drifted out of sync with array length
        if (data.count !== ids.length) {
          updateDoc(ref, { count: ids.length }).catch(() => {})
        }
      } else {
        setCompletedPuzzleIds(new Set())
        setCompletionTimes(new Map())
        setDisplayNameState(user.displayName || '')
      }
    }, () => {
      setCompletedPuzzleIds(new Set())
      setCompletionTimes(new Map())
      setDisplayNameState(user.displayName || '')
    })
  }, [user])

  const markCompleted = useCallback(async (puzzleId: string, timeMs?: number) => {
    if (!user) return
    // Skip if already completed
    if (completedRef.current.has(puzzleId)) return
    const ref = doc(db, 'completions_index', user.uid)
    try {
      // Read current to get accurate count
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const ids: string[] = data.puzzleIds || []
        if (ids.includes(puzzleId)) return // already there
        const update: Record<string, unknown> = {
          puzzleIds: arrayUnion(puzzleId),
          count: ids.length + 1,
        }
        // Only store time if provided and not already stored
        if (timeMs != null && !(data.times && data.times[puzzleId])) {
          update[`times.${puzzleId}`] = timeMs
        }
        await updateDoc(ref, update)
      } else {
        const name = user.displayName || 'Anonymous'
        const newDoc: Record<string, unknown> = { uid: user.uid, puzzleIds: [puzzleId], count: 1, displayName: name }
        if (timeMs != null) {
          newDoc.times = { [puzzleId]: timeMs }
        }
        await setDoc(ref, newDoc)
      }
    } catch {
      // Fallback: try creating the doc
      const name = user.displayName || 'Anonymous'
      const newDoc: Record<string, unknown> = { uid: user.uid, puzzleIds: [puzzleId], count: 1, displayName: name }
      if (timeMs != null) {
        newDoc.times = { [puzzleId]: timeMs }
      }
      await setDoc(ref, newDoc).catch(() => {})
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

  return { completedPuzzleIds, completionTimes, displayName, setDisplayName, markCompleted, unmarkCompleted }
}
