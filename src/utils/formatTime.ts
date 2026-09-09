/**
 * A completion recorded as 0 is one whose duration was never captured — an
 * older entry, or a grid that came back already solved. Rendering it as 0:00
 * would claim an instant solve.
 */
export function formatCompletionTime(ms: number): string {
  return ms > 0 ? formatTime(ms) : 'Time unknown'
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
