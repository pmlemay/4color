import { useEffect, useRef, useState } from 'react'
import { CellData, CellPosition, InputMode, MarkShape, EdgeDescriptor } from '../../types'
import { useDragSelect } from '../../hooks/useDragSelect'
import { useEdgeDrag, expandEdge, detectEdge } from '../../hooks/useEdgeDrag'
import { detectMarkTarget, MarkTarget } from '../../utils/gridHitTest'
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
  onCommitEdges?: (edges: EdgeDescriptor[]) => void
  onCommitFixedEdges?: (edges: EdgeDescriptor[]) => void
  onToggleEdgeCross?: (edge: EdgeDescriptor, forceValue?: boolean) => void
  onToggleFixedMark?: (target: MarkTarget, shape: MarkShape) => void
  isPinching?: boolean
  isTouchDragRef?: React.MutableRefObject<boolean>
}

export function Grid({ grid, selection, debug, inputMode, activeColor, activeMark, clearSelection, commitSelection, onDragChange, onRightClickCell, onCommitEdges, onCommitFixedEdges, onToggleEdgeCross, onToggleFixedMark, isPinching, isTouchDragRef }: GridProps) {
  const beingSelected = useRef<CellPosition[]>([])
  const [, setRenderTick] = useState(0)
  const isColorDrag = (inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null
  const isMarkDrag = inputMode === 'mark' && activeMark != null
  const isImmediateMode = inputMode === 'cross' || inputMode === 'border' || inputMode === 'fixedBorder' || isColorDrag || isMarkDrag
  const isEdgeMode = inputMode === 'edge' || inputMode === 'fixedEdge'
  const isFixedMarkMode = inputMode === 'fixedMark' && activeMark != null

  const [draftEdges, setDraftEdges] = useState<EdgeDescriptor[]>([])

  // Right-click edge drag for placing multiple X marks
  const rightEdgeDragging = useRef(false)
  const rightEdgeVisited = useRef<Set<string>>(new Set())
  const rightEdgeAction = useRef<boolean>(true) // true = add X, false = remove X
  const isEdgeCrossMode = isEdgeMode || inputMode === 'border' || inputMode === 'fixedBorder'

  // Normalize edge key so both sides of the same physical edge map to the same string
  const normalizeEdgeKey = (edge: EdgeDescriptor): string => {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    // Canonicalize: for top/left, use the neighbor's bottom/right if it exists
    if (edge.side === 0 && edge.row > 0) return `${edge.row - 1},${edge.col},2`
    if (edge.side === 3 && edge.col > 0) return `${edge.row},${edge.col - 1},1`
    // For bottom/right at grid boundary, keep as-is; otherwise already canonical
    if (edge.side === 2 && edge.row >= rows - 1) return `${edge.row},${edge.col},2`
    if (edge.side === 1 && edge.col >= cols - 1) return `${edge.row},${edge.col},1`
    return `${edge.row},${edge.col},${edge.side}`
  }

  const dragSelect = useDragSelect({
    onSelectionStart: () => {
      clearSelection()
      beingSelected.current = []
    },
    onSelectionChange: (sel, isTouch) => {
      beingSelected.current = sel
      if (isTouchDragRef) isTouchDragRef.current = isTouch
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
    touchEnabled: !isEdgeMode,
  })

  const edgeDrag = useEdgeDrag({
    tableRef: dragSelect.tableRef,
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
    onDraftChange: setDraftEdges,
    onCommit: (edges) => {
      setDraftEdges([])
      if (inputMode === 'fixedEdge') {
        onCommitFixedEdges?.(edges)
      } else {
        onCommitEdges?.(edges)
      }
    },
    onTapEdge: (edge) => {
      onToggleEdgeCross?.(edge)
    },
    isPinching,
    enabled: isEdgeMode,
  })

  useEffect(() => {
    const handler = () => {
      dragSelect.handleMouseUp()
      edgeDrag.handleMouseUp()
      rightEdgeDragging.current = false
      rightEdgeVisited.current.clear()
    }
    window.addEventListener('mouseup', handler)
    window.addEventListener('touchend', handler)
    return () => {
      window.removeEventListener('mouseup', handler)
      window.removeEventListener('touchend', handler)
    }
  }, [dragSelect.handleMouseUp, edgeDrag.handleMouseUp])

  // Build a set of draft edge keys for fast lookup per cell
  const draftEdgeSet = useRef<Set<string>>(new Set())
  const draftSidesMap = useRef<Map<string, Set<number>>>(new Map())
  draftSidesMap.current.clear()
  draftEdgeSet.current.clear()
  if (isEdgeMode && draftEdges.length > 0) {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    for (const edge of draftEdges) {
      const expanded = expandEdge(edge, rows, cols)
      for (const e of expanded) {
        const cellKey = `${e.row},${e.col}`
        let sides = draftSidesMap.current.get(cellKey)
        if (!sides) {
          sides = new Set()
          draftSidesMap.current.set(cellKey, sides)
        }
        sides.add(e.side)
      }
    }
  }

  return (
    <div
      className="grid-container"
      onMouseDown={(e) => {
        if (e.button === 0 && isFixedMarkMode && onToggleFixedMark) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const target = detectMarkTarget(e.clientX, e.clientY, table)
          if (target) onToggleFixedMark(target, activeMark!)
          return
        }
        if (e.button === 2 && isEdgeCrossMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge) {
            rightEdgeDragging.current = true
            rightEdgeVisited.current.clear()
            // Lock action based on first edge's current state
            const cell = grid[edge.row]?.[edge.col]
            rightEdgeAction.current = cell ? !cell.edgeCrosses[edge.side] : true
            const key = normalizeEdgeKey(edge)
            rightEdgeVisited.current.add(key)
            onToggleEdgeCross(edge, rightEdgeAction.current)
          }
          return
        }
        if (isEdgeMode) edgeDrag.handleMouseDown(e)
        else dragSelect.handleCellMouseDown(e)
      }}
      onMouseMove={(e) => {
        if (rightEdgeDragging.current && isEdgeCrossMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge) {
            const key = normalizeEdgeKey(edge)
            if (!rightEdgeVisited.current.has(key)) {
              rightEdgeVisited.current.add(key)
              onToggleEdgeCross(edge, rightEdgeAction.current)
            }
          }
          return
        }
        if (isEdgeMode) edgeDrag.handleMouseMove(e)
        else dragSelect.handleCellMouseMove(e)
      }}
      onContextMenu={(e) => {
        if (isEdgeCrossMode || onRightClickCell) {
          e.preventDefault()
        }
      }}
    >
      <table
        className="puzzle-grid"
        ref={dragSelect.tableRef}
      >
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const cellKey = `${ri},${ci}`
                const draftSides = draftSidesMap.current.get(cellKey) ?? null
                return (
                  <Cell
                    key={ci}
                    data={cell}
                    row={ri}
                    col={ci}
                    debug={debug}
                    beingSelected={!isImmediateMode && !isEdgeMode && !isFixedMarkMode && beingSelected.current.some(
                      s => s.row === ri && s.col === ci
                    )}
                    draftEdgeSides={draftSides}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
