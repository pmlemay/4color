import { useEffect, useRef, useState } from 'react'
import { CellData, CellPosition, InputMode, MarkShape } from '../../types'
import { useDragSelect } from '../../hooks/useDragSelect'
import { Cell } from './Cell'
import './Grid.css'

interface GridProps {
  grid: CellData[][]
  selection: CellPosition[]
  debug: boolean
  inputMode: InputMode
  activeColor: string | null
  activeMark?: MarkShape | null
  clearSelection: () => void
  commitSelection: (sel: CellPosition[]) => void
  onDragChange?: (sel: CellPosition[]) => void
  onRightClickCell?: (pos: CellPosition) => void
  forcedInputLayout?: string
  isPinching?: boolean
}

export function Grid({ grid, selection, debug, inputMode, activeColor, activeMark, clearSelection, commitSelection, onDragChange, onRightClickCell, forcedInputLayout, isPinching }: GridProps) {
  const beingSelected = useRef<CellPosition[]>([])
  const [, setRenderTick] = useState(0)
  const isColorDrag = (inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null
  const isMarkDrag = inputMode === 'mark' && activeMark != null
  const isImmediateMode = inputMode === 'cross' || inputMode === 'border' || isColorDrag || isMarkDrag

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
    onRightClickCell,
    isPinching,
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
        ref={dragSelect.tableRef}
        onMouseDown={dragSelect.handleCellMouseDown}
        onMouseMove={dragSelect.handleCellMouseMove}
        onContextMenu={forcedInputLayout ? (e) => e.preventDefault() : undefined}
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
