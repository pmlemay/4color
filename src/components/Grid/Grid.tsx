import { useEffect, useRef, useState } from 'react'
import { CellData, CellPosition, InputMode } from '../../types'
import { useDragSelect } from '../../hooks/useDragSelect'
import { Cell } from './Cell'
import './Grid.css'

interface GridProps {
  grid: CellData[][]
  selection: CellPosition[]
  debug: boolean
  inputMode: InputMode
  activeColor: string | null
  clearSelection: () => void
  commitSelection: (sel: CellPosition[]) => void
  onDragChange?: (sel: CellPosition[]) => void
}

export function Grid({ grid, selection, debug, inputMode, activeColor, clearSelection, commitSelection, onDragChange }: GridProps) {
  const beingSelected = useRef<CellPosition[]>([])
  const [, setRenderTick] = useState(0)
  const isColorDrag = (inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null
  const isImmediateMode = inputMode === 'cross' || inputMode === 'border' || isColorDrag

  const dragSelect = useDragSelect({
    onSelectionStart: () => {
      clearSelection()
      beingSelected.current = []
    },
    onSelectionChange: (sel) => {
      beingSelected.current = sel
      if (isImmediateMode) {
        onDragChange?.(sel)
      } else {
        setRenderTick(t => t + 1)
      }
    },
    onSelectionEnd: (sel) => {
      beingSelected.current = []
      commitSelection(sel)
    },
  })

  useEffect(() => {
    const handler = () => dragSelect.handleMouseUp()
    window.addEventListener('mouseup', handler)
    window.addEventListener('touchend', handler)
    return () => {
      window.removeEventListener('mouseup', handler)
      window.removeEventListener('touchend', handler)
    }
  }, [dragSelect.handleMouseUp])

  return (
    <div className="grid-container">
      <table
        className="puzzle-grid"
        onMouseDown={dragSelect.handleCellMouseDown}
        onMouseMove={dragSelect.handleCellMouseMove}
        onTouchStart={dragSelect.handleTouchStart}
        onTouchMove={dragSelect.handleTouchMove}
      >
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <Cell
                  key={ci}
                  data={cell}
                  row={ri}
                  col={ci}
                  debug={debug}
                  beingSelected={!isImmediateMode && beingSelected.current.some(
                    s => s.row === ri && s.col === ci
                  )}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
