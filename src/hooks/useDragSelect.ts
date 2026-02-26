import { useRef, useCallback } from 'react'
import { CellPosition } from '../types'

interface UseDragSelectOptions {
  onSelectionStart: () => void
  onSelectionChange: (selection: CellPosition[]) => void
  onSelectionEnd: (selection: CellPosition[]) => void
}

export function useDragSelect(options: UseDragSelectOptions) {
  const dragging = useRef(false)
  const currentSelection = useRef<CellPosition[]>([])
  const ctrlHeld = useRef(false)

  const getCellFromEvent = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): CellPosition | null => {
    let target: HTMLElement | null
    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0]
      target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement
    } else if ('target' in e) {
      target = e.target as HTMLElement
      while (target && target.tagName !== 'TD') {
        target = target.parentElement
      }
    } else {
      return null
    }
    if (!target || target.tagName !== 'TD') return null
    const td = target as HTMLTableCellElement
    const row = (td.parentElement as HTMLTableRowElement)?.rowIndex
    const col = td.cellIndex
    if (row == null || col == null || row < 0 || col < 0) return null
    return { row, col }
  }, [])

  const handleCellMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Don't start drag if clicking on a control button
    if ((e.target as HTMLElement).closest('.toolbar')) return

    e.preventDefault()
    ctrlHeld.current = e.ctrlKey

    if (!e.ctrlKey) {
      options.onSelectionStart()
    }

    const pos = getCellFromEvent(e)
    if (pos) {
      dragging.current = true
      currentSelection.current = [pos]
      options.onSelectionChange([pos])
    }
  }, [getCellFromEvent, options])

  const handleCellMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const pos = getCellFromEvent(e)
    if (!pos) return
    if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
    currentSelection.current = [...currentSelection.current, pos]
    options.onSelectionChange(currentSelection.current)
  }, [getCellFromEvent, options])

  const handleMouseUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      options.onSelectionEnd(currentSelection.current)
    }
  }, [options])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.toolbar')) return
    e.preventDefault()
    options.onSelectionStart()
    const pos = getCellFromEvent(e)
    if (pos) {
      dragging.current = true
      currentSelection.current = [pos]
      options.onSelectionChange([pos])
    }
  }, [getCellFromEvent, options])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const pos = getCellFromEvent(e)
    if (!pos) return
    if (currentSelection.current.some(s => s.row === pos.row && s.col === pos.col)) return
    currentSelection.current = [...currentSelection.current, pos]
    options.onSelectionChange(currentSelection.current)
  }, [getCellFromEvent, options])

  return {
    handleCellMouseDown,
    handleCellMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    ctrlHeld,
  }
}
