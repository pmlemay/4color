import { useEffect, useState, useCallback, useRef } from 'react'
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export function useCompletions() {
  const { user } = useAuth()
  const [completedPuzzleIds, setCompletedPuzzleIds] = useState<Set<string>>(new Set())
  const [completionTimes, setCompletionTimes] = useState<Map<string, number>>(new Map())
  const [displayName, setDisplayNameState] = useState<string>('')
  // Ref mirror so callbacks can check current state without re-create
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
        let times: Record<string, number> = data.times || {}
        // Migrate legacy puzzleIds into times if needed
        const legacyIds: string[] = data.puzzleIds || []
        if (legacyIds.length > 0) {
          const migrated = { ...times }
          for (const id of legacyIds) {
            if (!(id in migrated)) migrated[id] = 0
          }
          times = migrated
          updateDoc(ref, { times: migrated, puzzleIds: [] }).catch(() => {})
        }
        const timesMap = new Map(Object.entries(times) as [string, number][])
        setCompletionTimes(timesMap)
        setCompletedPuzzleIds(new Set(timesMap.keys()))
        setDisplayNameState(data.displayName || user.displayName || '')
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
    if (timesRef.current.has(puzzleId)) return
    const time = timeMs ?? 0
    const ref = doc(db, 'completions_index', user.uid)
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const times: Record<string, number> = data.times || {}
        if (puzzleId in times) return
        await updateDoc(ref, { [`times.${puzzleId}`]: time, count: Object.keys(times).length + 1 })
      } else {
        const name = user.displayName || 'Anonymous'
        await setDoc(ref, { uid: user.uid, times: { [puzzleId]: time }, count: 1, displayName: name })
      }
    } catch {
      const name = user.displayName || 'Anonymous'
      await setDoc(ref, { uid: user.uid, times: { [puzzleId]: time }, count: 1, displayName: name }).catch(() => {})
    }
  }, [user])

  const unmarkCompleted = useCallback(async (puzzleId: string) => {
    if (!user) return
    if (!timesRef.current.has(puzzleId)) return
    const ref = doc(db, 'completions_index', user.uid)
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const times: Record<string, number> = { ...snap.data().times }
        delete times[puzzleId]
        await updateDoc(ref, { times, count: Object.keys(times).length })
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
      await setDoc(ref, { uid: user.uid, displayName: trimmed }, { merge: true })
    }
  }, [user])

  return { completedPuzzleIds, completionTimes, displayName, setDisplayName, markCompleted, unmarkCompleted }
}
