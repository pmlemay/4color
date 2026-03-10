import { useEffect, useRef, useState } from 'react'
import { CellData, CellPosition, InputMode, MarkShape, EdgeDescriptor } from '../../types'
import { useDragSelect } from '../../hooks/useDragSelect'
import { useEdgeDrag, expandEdge, detectEdge } from '../../hooks/useEdgeDrag'
import { detectMarkTarget, getNearestCell, MarkTarget } from '../../utils/gridHitTest'
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
  commitSelection: (sel: CellPosition[], ctrlHeld?: boolean) => void
  onDragChange?: (sel: CellPosition[]) => void
  onRightClickCell?: (pos: CellPosition, isFirst: boolean) => void
  onCommitEdges?: (edges: EdgeDescriptor[]) => void
  onCommitFixedEdges?: (edges: EdgeDescriptor[]) => void
  onToggleEdgeCross?: (edge: EdgeDescriptor, forceValue?: boolean) => void
  onToggleFixedMark?: (target: MarkTarget, shape: MarkShape) => void
  onToggleLine?: (pos: CellPosition, side: 0 | 1 | 2 | 3, value: boolean, withUndo?: boolean) => void
  isPinching?: boolean
  isTouchDragRef?: React.MutableRefObject<boolean>
  foggedCells?: Set<string>
  fogPreviewCells?: Set<string>
  revealedFogIds?: Set<string>
}

export function Grid({ grid, selection, debug, inputMode, activeColor, activeMark, clearSelection, commitSelection, onDragChange, onRightClickCell, onCommitEdges, onCommitFixedEdges, onToggleEdgeCross, onToggleFixedMark, onToggleLine, isPinching, isTouchDragRef, foggedCells, fogPreviewCells, revealedFogIds }: GridProps) {
  const beingSelected = useRef<CellPosition[]>([])
  const beingDeselected = useRef<Set<string>>(new Set())
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
  // Right-click center drag for connection lines
  const rightLineDragging = useRef(false)
  const rightLineLastCell = useRef<{ row: number; col: number } | null>(null)
  const rightLineAction = useRef<boolean | undefined>(undefined) // true = add, false = remove
  const rightLineFirst = useRef(true) // first toggle in drag gets undo snapshot

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
      beingDeselected.current.clear()
    },
    onSelectionChange: (sel, isTouch) => {
      if (isTouchDragRef) isTouchDragRef.current = isTouch
      if (isImmediateMode) {
        beingSelected.current = sel
        beingDeselected.current.clear()
        onDragChange?.(sel)
      } else if (dragSelect.ctrlHeld.current && sel.length > 0) {
        // Compute real-time merge for visual feedback during Ctrl+drag
        const dragKeys = new Set(sel.map(p => `${p.row},${p.col}`))
        const prevSelected: CellPosition[] = []
        for (let ri = 0; ri < grid.length; ri++) {
          for (let ci = 0; ci < grid[ri].length; ci++) {
            if (grid[ri][ci].selected) prevSelected.push({ row: ri, col: ci })
          }
        }
        const prevKeys = new Set(prevSelected.map(p => `${p.row},${p.col}`))
        const firstWasSelected = prevKeys.has(`${sel[0].row},${sel[0].col}`)
        if (firstWasSelected) {
          // Remove mode: mark dragged cells as being deselected
          beingSelected.current = []
          beingDeselected.current = new Set(sel.filter(p => prevKeys.has(`${p.row},${p.col}`)).map(p => `${p.row},${p.col}`))
        } else {
          // Add mode: show new cells as being selected
          beingSelected.current = sel.filter(p => !prevKeys.has(`${p.row},${p.col}`))
          beingDeselected.current.clear()
        }
        setRenderTick(t => t + 1)
      } else {
        beingSelected.current = sel
        beingDeselected.current.clear()
        setRenderTick(t => t + 1)
      }
    },
    onSelectionEnd: (sel) => {
      beingSelected.current = []
      beingDeselected.current.clear()
      commitSelection(sel, dragSelect.ctrlHeld.current)
    },
    onRightClickCell,
    isPinching,
    touchEnabled: !isEdgeMode,
    foggedCells,
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
    foggedCells,
  })

  useEffect(() => {
    const handler = () => {
      dragSelect.handleMouseUp()
      edgeDrag.handleMouseUp()
      rightEdgeDragging.current = false
      rightEdgeVisited.current.clear()
      rightLineDragging.current = false
      rightLineLastCell.current = null
      rightLineAction.current = undefined
      rightLineFirst.current = true
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
        // Ignore middle-click — let it pan without affecting selection
        if (e.button === 1) return
        if (e.button === 0 && isFixedMarkMode && onToggleFixedMark) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const target = detectMarkTarget(e.clientX, e.clientY, table)
          if (target && !foggedCells?.has(`${target.row},${target.col}`)) onToggleFixedMark(target, activeMark!)
          return
        }
        if (e.button === 2 && isEdgeCrossMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge && !foggedCells?.has(`${edge.row},${edge.col}`)) {
            // Check if there's a connection line on this edge — if so, enter remove-line mode instead
            const cell = grid[edge.row]?.[edge.col]
            if (cell?.lines[edge.side] && onToggleLine) {
              rightLineDragging.current = true
              rightLineLastCell.current = { row: edge.row, col: edge.col }
              rightLineAction.current = false // remove mode
              rightLineFirst.current = true
              // Immediately remove this line
              onToggleLine({ row: edge.row, col: edge.col }, edge.side, false, true)
              rightLineFirst.current = false
            } else {
              rightEdgeDragging.current = true
              rightEdgeVisited.current.clear()
              // Lock action based on first edge's current state
              rightEdgeAction.current = cell ? !cell.edgeCrosses[edge.side] : true
              const key = normalizeEdgeKey(edge)
              rightEdgeVisited.current.add(key)
              onToggleEdgeCross(edge, rightEdgeAction.current)
            }
          } else if (!edge && onToggleLine) {
            // Center zone — start connection line drag
            const hit = getNearestCell(e.clientX, e.clientY, table)
            if (hit && !foggedCells?.has(`${hit.row},${hit.col}`)) {
              rightLineDragging.current = true
              rightLineLastCell.current = { row: hit.row, col: hit.col }
              rightLineAction.current = undefined
            }
          }
          return
        }
        if (isEdgeMode) edgeDrag.handleMouseDown(e)
        else dragSelect.handleCellMouseDown(e)
      }}
      onMouseMove={(e) => {
        if (rightLineDragging.current && onToggleLine) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          // When removing lines, also check edge zones so the cursor doesn't have to
          // travel all the way to cell centers
          if (rightLineAction.current === false) {
            const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
            if (edge && !foggedCells?.has(`${edge.row},${edge.col}`)) {
              const cell = grid[edge.row]?.[edge.col]
              if (cell?.lines[edge.side]) {
                const withUndo = rightLineFirst.current
                rightLineFirst.current = false
                onToggleLine({ row: edge.row, col: edge.col }, edge.side, false, withUndo)
                rightLineLastCell.current = { row: edge.row, col: edge.col }
                return
              }
            }
          }
          const hit = getNearestCell(e.clientX, e.clientY, table)
          if (!hit) return
          const prev = rightLineLastCell.current
          if (!prev || (hit.row === prev.row && hit.col === prev.col)) return
          // Must be adjacent (Manhattan distance = 1)
          const dr = hit.row - prev.row
          const dc = hit.col - prev.col
          if (Math.abs(dr) + Math.abs(dc) !== 1) return
          if (foggedCells?.has(`${hit.row},${hit.col}`)) return
          // Determine side from prev → current
          let side: 0 | 1 | 2 | 3
          if (dr === -1) side = 0      // moved up → top side of prev
          else if (dc === 1) side = 1   // moved right → right side of prev
          else if (dr === 1) side = 2   // moved down → bottom side of prev
          else side = 3                  // moved left → left side of prev
          // On first pair, lock action
          if (rightLineAction.current === undefined) {
            const cell = grid[prev.row]?.[prev.col]
            rightLineAction.current = cell ? !cell.lines[side] : true
          }
          const withUndo = rightLineFirst.current
          rightLineFirst.current = false
          onToggleLine(prev, side, rightLineAction.current, withUndo)
          rightLineLastCell.current = { row: hit.row, col: hit.col }
          return
        }
        if (rightEdgeDragging.current && isEdgeCrossMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge && !foggedCells?.has(`${edge.row},${edge.col}`)) {
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
                const fogged = foggedCells?.has(cellKey) ?? false
                const fogPrev = fogPreviewCells?.has(cellKey) ?? false
                const fogEdges: [boolean, boolean, boolean, boolean] | undefined = fogged ? [
                  foggedCells!.has(`${ri - 1},${ci}`) || ri === 0,
                  foggedCells!.has(`${ri},${ci + 1}`) || ci === row.length - 1,
                  foggedCells!.has(`${ri + 1},${ci}`) || ri === grid.length - 1,
                  foggedCells!.has(`${ri},${ci - 1}`) || ci === 0,
                ] : undefined
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
                    beingDeselected={beingDeselected.current.has(cellKey)}
                    draftEdgeSides={draftSides}
                    fogged={fogged}
                    fogEdges={fogEdges}
                    fogPreview={fogPrev}
                    revealedFogIds={revealedFogIds}
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
