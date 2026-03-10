import { useRef, useCallback, useEffect } from 'react'
import { CellPosition } from '../types'
import { getCellPositionFromPoint } from '../utils/gridHitTest'

interface UseDragSelectOptions {
  onSelectionStart: () => void
  onSelectionChange: (selection: CellPosition[], isTouch: boolean) => void
  onSelectionEnd: (selection: CellPosition[]) => void
  onRightClickCell?: (pos: CellPosition, isFirst: boolean) => void
  isPinching?: boolean
  touchEnabled?: boolean
  foggedCells?: Set<string>
}

export function useDragSelect(options: UseDragSelectOptions) {
  const dragging = useRef(false)
  const rightDragging = useRef(false)
  const currentSelection = useRef<CellPosition[]>([])
  const rightSelection = useRef<CellPosition[]>([])
  const ctrlHeld = useRef(false)
  const tableRef = useRef<HTMLTableElement>(null)
  // Keep options in a ref so native listeners always see latest callbacks
  const optionsRef = useRef(options)
  optionsRef.current = options

  const isFogged = (pos: CellPosition): boolean =>
    optionsRef.current.foggedCells?.has(`${pos.row},${pos.col}`) ?? false

  const getCellFromPoint = (x: number, y: number): CellPosition | null => {
    const table = tableRef.current
    if (!table) return null
    return getCellPositionFromPoint(x, y, table)
  }

  const getCellFromEvent = useCallback((e: React.MouseEvent | MouseEvent): CellPosition | null => {
    // Try direct target first (fast path)
    let target = e.target as HTMLElement | null
    while (target && target.tagName !== 'TD') {
      target = target.parentElement
    }
    if (target && target.tagName === 'TD') {
      const td = target as HTMLTableCellElement
      const row = (td.parentElement as HTMLTableRowElement)?.rowIndex
      const col = td.cellIndex
      if (row != null && col != null && row >= 0 && col >= 0) return { row, col }
    }
    // Fallback: find nearest cell (for clicks just outside the grid)
    const table = tableRef.current
    if (!table) return null
    return getCellPositionFromPoint(e.clientX, e.clientY, table)
  }, [])

  const handleCellMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.toolbar')) return

    if (e.button === 2 && optionsRef.current.onRightClickCell) {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (pos && !isFogged(pos)) {
        rightDragging.current = true
        rightSelection.current = [pos]
        optionsRef.current.onRightClickCell(pos, true)
      }
      return
    }

    if (e.button !== 0) return

    e.preventDefault()
    ctrlHeld.current = e.ctrlKey
    if (!e.ctrlKey) {
      optionsRef.current.onSelectionStart()
    }

    const pos = getCellFromEvent(e)
    if (pos && !isFogged(pos)) {
      dragging.current = true
      currentSelection.current = [pos]
      optionsRef.current.onSelectionChange([pos], false)
    }
  }, [getCellFromEvent])

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (rightDragging.current) {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (!pos || isFogged(pos)) return
      if (rightSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
      rightSelection.current = [...rightSelection.current, pos]
      optionsRef.current.onRightClickCell?.(pos, false)
      return
    }
    if (!dragging.current) return
    e.preventDefault()
    const pos = getCellFromEvent(e)
    if (!pos || isFogged(pos)) return
    if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
    currentSelection.current = [...currentSelection.current, pos]
    optionsRef.current.onSelectionChange(currentSelection.current, false)
  }, [getCellFromEvent])

  const handleMouseUp = useCallback(() => {
    if (rightDragging.current) {
      rightDragging.current = false
      rightSelection.current = []
      return
    }
    if (dragging.current) {
      dragging.current = false
      optionsRef.current.onSelectionEnd(currentSelection.current)
    }
  }, [])

  // Attach touch listeners natively with { passive: false } so preventDefault works
  // Delay touch start to avoid triggering actions when a pinch is starting
  const touchStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTouchPos = useRef<CellPosition | null>(null)

  useEffect(() => {
    const table = tableRef.current
    if (!table) return

    const commitTouchStart = () => {
      const pos = pendingTouchPos.current
      if (!pos) return
      pendingTouchPos.current = null
      optionsRef.current.onSelectionStart()
      dragging.current = true
      currentSelection.current = [pos]
      optionsRef.current.onSelectionChange([pos], true)
    }

    const cancelPendingTouch = () => {
      if (touchStartTimer.current) {
        clearTimeout(touchStartTimer.current)
        touchStartTimer.current = null
      }
      pendingTouchPos.current = null
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.touchEnabled === false) return
      if ((e.target as HTMLElement).closest('.toolbar')) return
      if (e.touches.length >= 2) {
        cancelPendingTouch()
        return
      }
      e.preventDefault()
      const touch = e.touches[0]
      const pos = getCellFromPoint(touch.clientX, touch.clientY)
      if (pos && !isFogged(pos)) {
        pendingTouchPos.current = pos
        touchStartTimer.current = setTimeout(commitTouchStart, 150)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      // If a second finger appeared, cancel pending touch and revert any committed drag
      if (e.touches.length >= 2) {
        cancelPendingTouch()
        if (dragging.current) {
          dragging.current = false
          // Fire empty selection end to revert any partial changes
          currentSelection.current = []
          optionsRef.current.onSelectionEnd([])
        }
        return
      }
      // If pending touch hasn't committed yet, only commit if finger moved to a different cell
      if (pendingTouchPos.current && touchStartTimer.current) {
        const touch = e.touches[0]
        const pos = getCellFromPoint(touch.clientX, touch.clientY)
        if (pos && (pos.row !== pendingTouchPos.current.row || pos.col !== pendingTouchPos.current.col)) {
          // Moved to a new cell — this is a real drag, commit
          clearTimeout(touchStartTimer.current)
          touchStartTimer.current = null
          commitTouchStart()
        }
        // Otherwise ignore small movement within same cell (could be pinch jitter)
        return
      }
      if (!dragging.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const pos = getCellFromPoint(touch.clientX, touch.clientY)
      if (!pos || isFogged(pos)) return
      if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
      currentSelection.current = [...currentSelection.current, pos]
      optionsRef.current.onSelectionChange(currentSelection.current, true)
    }

    table.addEventListener('touchstart', handleTouchStart, { passive: false })
    table.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      table.removeEventListener('touchstart', handleTouchStart)
      table.removeEventListener('touchmove', handleTouchMove)
      cancelPendingTouch()
    }
  }, [])

  return {
    tableRef,
    handleCellMouseDown,
    handleCellMouseMove,
    handleMouseUp,
    ctrlHeld,
  }
}
