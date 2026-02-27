import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../utils/formatTime'

export function useTimer(initialMs = 0) {
  const [elapsedMs, setElapsedMs] = useState(initialMs)
  const [running, setRunning] = useState(false)
  const startTimestamp = useRef(0)
  const baseMs = useRef(initialMs)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    startTimestamp.current = Date.now()
    baseMs.current = elapsedMs
    setRunning(true)
  }, [elapsedMs])

  const pause = useCallback(() => {
    clearTick()
    if (startTimestamp.current) {
      const now = Date.now()
      baseMs.current += now - startTimestamp.current
      setElapsedMs(baseMs.current)
      startTimestamp.current = 0
    }
    setRunning(false)
  }, [clearTick])

  const reset = useCallback((ms = 0) => {
    clearTick()
    baseMs.current = ms
    startTimestamp.current = 0
    setElapsedMs(ms)
    setRunning(false)
  }, [clearTick])

  // Start/stop interval when running changes
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsedMs(baseMs.current + (Date.now() - startTimestamp.current))
      }, 1000)
    }
    return clearTick
  }, [running, clearTick])

  // Auto-pause on unmount
  useEffect(() => {
    return () => {
      clearTick()
    }
  }, [clearTick])

  return { elapsedMs, formatted: formatTime(elapsedMs), running, start, pause, reset }
}
