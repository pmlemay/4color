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

  /**
   * The authoritative elapsed time. `elapsedMs` is rendered state: it only
   * advances on the once-a-second tick, and it lands a render *after* the
   * reset/pause that produced it. Anything that persists a time — a save, a
   * recorded completion — must read it from here or it will store a value
   * that is stale, or still the pre-reset one.
   */
  const read = useCallback((): number => (
    baseMs.current + (startTimestamp.current ? Date.now() - startTimestamp.current : 0)
  ), [])

  const start = useCallback(() => {
    // Already running — a second start would drop everything accrued since the
    // first. And note what is NOT here: `baseMs.current = elapsedMs`. baseMs is
    // the accumulator that reset() and pause() maintain; copying the rendered
    // `elapsedMs` back into it raced the render reset() schedules, so whenever
    // this ran first it silently wiped a restored time back to zero.
    if (startTimestamp.current) return
    startTimestamp.current = Date.now()
    setRunning(true)
  }, [])

  /** Stops the clock and returns the final elapsed time. */
  const pause = useCallback((): number => {
    clearTick()
    if (startTimestamp.current) {
      baseMs.current = read()
      setElapsedMs(baseMs.current)
      startTimestamp.current = 0
    }
    setRunning(false)
    return baseMs.current
  }, [clearTick, read])

  const reset = useCallback((ms = 0) => {
    clearTick()
    baseMs.current = ms
    startTimestamp.current = 0
    setElapsedMs(ms)
    setRunning(false)
  }, [clearTick])

  // Start/stop interval when running changes. Ticking through read() keeps a
  // tick that lands after a pause from computing against a zeroed timestamp.
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsedMs(read())
      }, 1000)
    }
    return clearTick
  }, [running, clearTick, read])

  // Auto-pause on unmount
  useEffect(() => {
    return () => {
      clearTick()
    }
  }, [clearTick])

  return { elapsedMs, formatted: formatTime(elapsedMs), running, start, pause, reset, read }
}
