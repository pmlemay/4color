import { useRef, useCallback, useEffect } from 'react'
import { EdgeDescriptor } from '../types'
import { getNearestCell } from '../utils/gridHitTest'

interface UseEdgeDragOptions {
  tableRef: React.RefObject<HTMLTableElement | null>
  rows: number
  cols: number
  onDraftChange: (edges: EdgeDescriptor[]) => void
  onCommit: (edges: EdgeDescriptor[]) => void
  onTapEdge?: (edge: EdgeDescriptor) => void
  isPinching?: boolean
  enabled?: boolean
  foggedCells?: Set<string>
}

/** Normalize an edge so shared borders use the canonical cell (smaller row/col, top/left side). */
function normalizeEdge(e: EdgeDescriptor, rows: number, cols: number): EdgeDescriptor {
  // bottom of (r,c) = top of (r+1,c)
  if (e.side === 2 && e.row + 1 < rows) return { row: e.row + 1, col: e.col, side: 0 }
  // right of (r,c) = left of (r,c+1)
  if (e.side === 1 && e.col + 1 < cols) return { row: e.row, col: e.col + 1, side: 3 }
  return e
}

function edgeKey(e: EdgeDescriptor): string {
  return `${e.row},${e.col},${e.side}`
}

/**
 * Get the two grid-intersection endpoints of an edge.
 * Grid intersections are at integer coordinates: (row, col) where
 * top-left of cell (r,c) is intersection (r, c).
 * Edge top of (r,c): endpoints (r,c) and (r,c+1)
 * Edge right of (r,c): endpoints (r,c+1) and (r+1,c+1)
 * Edge bottom of (r,c): endpoints (r+1,c) and (r+1,c+1)
 * Edge left of (r,c): endpoints (r,c) and (r+1,c)
 */
function edgeEndpoints(e: EdgeDescriptor): [string, string] {
  const { row: r, col: c, side } = e
  switch (side) {
    case 0: return [`${r},${c}`, `${r},${c + 1}`]
    case 1: return [`${r},${c + 1}`, `${r + 1},${c + 1}`]
    case 2: return [`${r + 1},${c}`, `${r + 1},${c + 1}`]
    case 3: return [`${r},${c}`, `${r + 1},${c}`]
  }
}

/**
 * Compute the tip vertex(es) of the path if it were truncated to edges 0..idx.
 * For a single edge (idx 0) the tip is ambiguous — both endpoints are candidates.
 * For idx > 0, the tip is the endpoint of edge[idx] NOT shared with edge[idx-1].
 */
function tipVerticesAt(path: EdgeDescriptor[], idx: number, rows: number, cols: number): string[] {
  const edge = normalizeEdge(path[idx], rows, cols)
  const [e1, e2] = edgeEndpoints(edge)
  if (idx === 0) return [e1, e2]
  const prev = normalizeEdge(path[idx - 1], rows, cols)
  const [p1, p2] = edgeEndpoints(prev)
  // The tip is the endpoint NOT shared with prev
  if (e1 === p1 || e1 === p2) return [e2]
  return [e1]
}

export function detectEdge(
  clientX: number,
  clientY: number,
  tableEl: HTMLTableElement,
  deadzone?: number,
): EdgeDescriptor | null {
  const hit = getNearestCell(clientX, clientY, tableEl)
  if (!hit) return null
  const { td, row, col } = hit

  const rect = td.getBoundingClientRect()
  const relX = clientX - rect.left
  const relY = clientY - rect.top
  const w = rect.width
  const h = rect.height

  // Fractional position within cell
  const fx = relX / w
  const fy = relY / h

  // Distance to each side (0=top, 1=right, 2=bottom, 3=left)
  const distances = [fy, 1 - fx, 1 - fy, fx]
  let minIdx = 0
  for (let i = 1; i < 4; i++) {
    if (distances[i] < distances[minIdx]) minIdx = i
  }

  // Deadzone: reject if cursor is too far from the edge (perpendicular)
  // or too close to a corner (parallel position along the edge)
  if (deadzone != null) {
    if (distances[minIdx] > deadzone) return null
    // Reject if cursor is near a corner (parallel position along the edge)
    const along = (minIdx === 0 || minIdx === 2) ? fx : fy
    if (along < 0.2 || along > 0.8) return null
  }

  return { row, col, side: minIdx as 0 | 1 | 2 | 3 }
}

export function useEdgeDrag({ tableRef, rows, cols, onDraftChange, onCommit, onTapEdge, isPinching, enabled = true, foggedCells }: UseEdgeDragOptions) {
  const dragging = useRef(false)
  const draftPath = useRef<EdgeDescriptor[]>([])
  const draftKeys = useRef<Set<string>>(new Set())
  const optionsRef = useRef({ onDraftChange, onCommit, onTapEdge, rows, cols, foggedCells })
  optionsRef.current = { onDraftChange, onCommit, onTapEdge, rows, cols, foggedCells }

  const addEdge = useCallback((clientX: number, clientY: number) => {
    const table = tableRef.current
    if (!table) return
    const raw = detectEdge(clientX, clientY, table)
    if (!raw) return

    // Block edges on fogged cells
    const fog = optionsRef.current.foggedCells
    if (fog?.has(`${raw.row},${raw.col}`)) return

    const { rows: r, cols: c } = optionsRef.current
    const norm = normalizeEdge(raw, r, c)
    const key = edgeKey(norm)

    // Backtrack: if this edge is already in the path, truncate to it
    const existingIdx = draftPath.current.findIndex(e => edgeKey(normalizeEdge(e, r, c)) === key)
    if (existingIdx !== -1) {
      draftPath.current = draftPath.current.slice(0, existingIdx + 1)
      draftKeys.current = new Set(draftPath.current.map(e => edgeKey(normalizeEdge(e, r, c))))
      optionsRef.current.onDraftChange([...draftPath.current])
      return
    }

    // First edge — just add it
    if (draftPath.current.length === 0) {
      draftPath.current.push(norm)
      draftKeys.current.add(key)
      optionsRef.current.onDraftChange([...draftPath.current])
      return
    }

    const [ep1, ep2] = edgeEndpoints(norm)

    // Scan backward through the path to find the latest position whose TIP vertex
    // matches one of the new edge's endpoints. This ensures the path stays a single
    // continuous line — if the new edge connects to the tip of an earlier edge,
    // everything after that point was a detour and gets pruned.
    for (let i = draftPath.current.length - 1; i >= 0; i--) {
      const tips = tipVerticesAt(draftPath.current, i, r, c)
      if (tips.some(t => t === ep1 || t === ep2)) {
        // Truncate everything after this point (prune any branch)
        if (i < draftPath.current.length - 1) {
          draftPath.current = draftPath.current.slice(0, i + 1)
          draftKeys.current = new Set(draftPath.current.map(e => edgeKey(normalizeEdge(e, r, c))))
        }
        draftPath.current.push(norm)
        draftKeys.current.add(key)
        optionsRef.current.onDraftChange([...draftPath.current])
        return
      }
    }

    // New edge doesn't connect to any tip in the path → ignore
  }, [tableRef])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    draftPath.current = []
    draftKeys.current = new Set()
    addEdge(e.clientX, e.clientY)
  }, [addEdge])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    addEdge(e.clientX, e.clientY)
  }, [addEdge])

  const handleMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (draftPath.current.length > 0) {
      optionsRef.current.onCommit([...draftPath.current])
    }
    draftPath.current = []
    draftKeys.current = new Set()
    optionsRef.current.onDraftChange([])
  }, [])

  // Touch support — only register when edge mode is enabled
  // Quick tap (lift before 200ms, no significant movement) → toggle edge X
  // Hold 200ms or drag > threshold → draw edge borders
  const DRAG_THRESHOLD = 6 // pixels
  const HOLD_MS = 200
  useEffect(() => {
    if (!enabled) return
    const table = tableRef.current
    if (!table) return

    let touchStart: { x: number; y: number } | null = null
    let isDrag = false
    let holdTimer: ReturnType<typeof setTimeout> | null = null

    const startDrag = () => {
      if (!touchStart || isDrag) return
      isDrag = true
      dragging.current = true
      draftPath.current = []
      draftKeys.current = new Set()
      addEdge(touchStart.x, touchStart.y)
    }

    const cancelHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) { touchStart = null; cancelHold(); return }
      e.preventDefault()
      const t = e.touches[0]
      touchStart = { x: t.clientX, y: t.clientY }
      isDrag = false
      // After hold duration, commit to edge drawing even without movement
      holdTimer = setTimeout(() => { holdTimer = null; startDrag() }, HOLD_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        touchStart = null
        cancelHold()
        if (dragging.current) {
          dragging.current = false
          draftPath.current = []
          draftKeys.current = new Set()
          optionsRef.current.onDraftChange([])
        }
        return
      }
      if (!touchStart) return
      const t = e.touches[0]
      if (!isDrag) {
        const dx = t.clientX - touchStart.x
        const dy = t.clientY - touchStart.y
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
        cancelHold()
        startDrag()
      }
      e.preventDefault()
      addEdge(t.clientX, t.clientY)
    }

    const onTouchEnd = () => {
      cancelHold()
      if (!isDrag && touchStart) {
        // Quick tap — toggle edge X at the tap position
        const edge = detectEdge(touchStart.x, touchStart.y, table)
        if (edge) {
          optionsRef.current.onTapEdge?.(edge)
        }
      }
      if (dragging.current) {
        dragging.current = false
        if (draftPath.current.length > 0) {
          optionsRef.current.onCommit([...draftPath.current])
        }
        draftPath.current = []
        draftKeys.current = new Set()
        optionsRef.current.onDraftChange([])
      }
      touchStart = null
      isDrag = false
    }

    table.addEventListener('touchstart', onTouchStart, { passive: false })
    table.addEventListener('touchmove', onTouchMove, { passive: false })
    table.addEventListener('touchend', onTouchEnd)
    return () => {
      table.removeEventListener('touchstart', onTouchStart)
      table.removeEventListener('touchmove', onTouchMove)
      table.removeEventListener('touchend', onTouchEnd)
    }
  }, [addEdge, tableRef, enabled])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

/** Expand an edge into both cells it touches (for commit/rendering). */
export function expandEdge(e: EdgeDescriptor, rows: number, cols: number): { row: number; col: number; side: 0 | 1 | 2 | 3 }[] {
  const result: { row: number; col: number; side: 0 | 1 | 2 | 3 }[] = [e]
  const { row: r, col: c, side } = e
  // Add the neighbor cell's matching side
  if (side === 0 && r > 0) result.push({ row: r - 1, col: c, side: 2 })
  if (side === 1 && c + 1 < cols) result.push({ row: r, col: c + 1, side: 3 })
  if (side === 2 && r + 1 < rows) result.push({ row: r + 1, col: c, side: 0 })
  if (side === 3 && c > 0) result.push({ row: r, col: c - 1, side: 1 })
  return result
}
