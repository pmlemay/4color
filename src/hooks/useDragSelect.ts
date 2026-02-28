import { useRef, useCallback, useEffect } from 'react'
import { CellPosition } from '../types'

interface UseDragSelectOptions {
  onSelectionStart: () => void
  onSelectionChange: (selection: CellPosition[]) => void
  onSelectionEnd: (selection: CellPosition[]) => void
  onRightClickCell?: (pos: CellPosition) => void
  isPinching?: boolean
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

  const getCellFromPoint = (x: number, y: number): CellPosition | null => {
    let target = document.elementFromPoint(x, y) as HTMLElement | null
    if (!target) return null
    while (target && target.tagName !== 'TD') {
      target = target.parentElement
    }
    if (!target || target.tagName !== 'TD') return null
    const td = target as HTMLTableCellElement
    const row = (td.parentElement as HTMLTableRowElement)?.rowIndex
    const col = td.cellIndex
    if (row == null || col == null || row < 0 || col < 0) return null
    return { row, col }
  }

  const getCellFromEvent = useCallback((e: React.MouseEvent | MouseEvent): CellPosition | null => {
    let target = e.target as HTMLElement | null
    while (target && target.tagName !== 'TD') {
      target = target.parentElement
    }
    if (!target || target.tagName !== 'TD') return null
    const td = target as HTMLTableCellElement
    const row = (td.parentElement as HTMLTableRowElement)?.rowIndex
    const col = td.cellIndex
    if (row == null || col == null || row < 0 || col < 0) return null
    return { row, col }
  }, [])

  const handleCellMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.toolbar')) return

    if (e.button === 2 && optionsRef.current.onRightClickCell) {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (pos) {
        rightDragging.current = true
        rightSelection.current = [pos]
        optionsRef.current.onRightClickCell(pos)
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
    if (pos) {
      dragging.current = true
      currentSelection.current = [pos]
      optionsRef.current.onSelectionChange([pos])
    }
  }, [getCellFromEvent])

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (rightDragging.current) {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (!pos) return
      if (rightSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
      rightSelection.current = [...rightSelection.current, pos]
      optionsRef.current.onRightClickCell?.(pos)
      return
    }
    if (!dragging.current) return
    e.preventDefault()
    const pos = getCellFromEvent(e)
    if (!pos) return
    if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
    currentSelection.current = [...currentSelection.current, pos]
    optionsRef.current.onSelectionChange(currentSelection.current)
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
  useEffect(() => {
    const table = tableRef.current
    if (!table) return

    const handleTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('.toolbar')) return
      if (optionsRef.current.isPinching || e.touches.length >= 2) return
      e.preventDefault()
      optionsRef.current.onSelectionStart()
      const touch = e.touches[0]
      const pos = getCellFromPoint(touch.clientX, touch.clientY)
      if (pos) {
        dragging.current = true
        currentSelection.current = [pos]
        optionsRef.current.onSelectionChange([pos])
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging.current || optionsRef.current.isPinching || e.touches.length >= 2) return
      e.preventDefault()
      const touch = e.touches[0]
      const pos = getCellFromPoint(touch.clientX, touch.clientY)
      if (!pos) return
      if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
      currentSelection.current = [...currentSelection.current, pos]
      optionsRef.current.onSelectionChange(currentSelection.current)
    }

    table.addEventListener('touchstart', handleTouchStart, { passive: false })
    table.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      table.removeEventListener('touchstart', handleTouchStart)
      table.removeEventListener('touchmove', handleTouchMove)
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
