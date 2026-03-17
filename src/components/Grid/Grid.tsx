import { useEffect, useRef, useState } from 'react'
import { CellData, CellPosition, InputMode, MarkShape, EdgeDescriptor } from '../../types'
import { useDragSelect } from '../../hooks/useDragSelect'
import { useEdgeDrag, expandEdge, detectEdge } from '../../hooks/useEdgeDrag'
import { detectMarkTarget, getNearestCell, getVirtualCell, MarkTarget } from '../../utils/gridHitTest'
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
  onLeftClickCell?: (pos: CellPosition, isFirst: boolean) => void
  onRightClickCell?: (pos: CellPosition, isFirst: boolean) => void
  onCommitEdges?: (edges: EdgeDescriptor[]) => void
  onCommitFixedEdges?: (edges: EdgeDescriptor[]) => void
  onToggleEdgeCross?: (edge: EdgeDescriptor, forceValue?: boolean) => void
  onCycleEdgeMark?: (edge: EdgeDescriptor) => void
  onToggleFixedMark?: (target: MarkTarget, shape: MarkShape) => void
  onToggleLine?: (pos: CellPosition, side: 0 | 1 | 2 | 3, value: boolean, withUndo?: boolean) => void
  onToggleFixedLine?: (pos: CellPosition, side: 0 | 1 | 2 | 3, value: boolean, withUndo?: boolean) => void
  onLineCenterClick?: (pos: CellPosition) => void
  onLineRightCenterClick?: (pos: CellPosition) => void
  isPinching?: boolean
  isTouchDragRef?: React.MutableRefObject<boolean>
  foggedCells?: Set<string>
  fogPreviewCells?: Set<string>
  revealedFogIds?: Set<string>
  highlightedNote?: string | null
}

export function Grid({ grid, selection, debug, inputMode, activeColor, activeMark, clearSelection, commitSelection, onDragChange, onLeftClickCell, onRightClickCell, onCommitEdges, onCommitFixedEdges, onToggleEdgeCross, onCycleEdgeMark, onToggleFixedMark, onToggleLine, onToggleFixedLine, onLineCenterClick, onLineRightCenterClick, isPinching, isTouchDragRef, foggedCells, fogPreviewCells, revealedFogIds, highlightedNote }: GridProps) {
  const beingSelected = useRef<CellPosition[]>([])
  const beingDeselected = useRef<Set<string>>(new Set())
  const [, setRenderTick] = useState(0)
  const isColorDrag = (inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null
  const isMarkDrag = inputMode === 'mark' && activeMark != null
  const isTextureDrag = inputMode === 'fixedTexture'
  const isFixedMarkDrag = inputMode === 'fixedMark' && activeMark != null
  const isLineMode = inputMode === 'line' || inputMode === 'fixedLine'
  const lineToggleFn = inputMode === 'fixedLine' ? onToggleFixedLine : onToggleLine
  const isImmediateMode = inputMode === 'cross' || inputMode === 'border' || inputMode === 'fixedBorder' || isColorDrag || isMarkDrag || isFixedMarkDrag || isTextureDrag || isLineMode
  const isEdgeMode = inputMode === 'edge' || inputMode === 'fixedEdge'
  const isFixedMarkMode = isFixedMarkDrag

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
  // Left-click line drag (line mode)
  const leftLineDragging = useRef(false)
  const leftLineLastCell = useRef<{ row: number; col: number } | null>(null)
  const leftLineAction = useRef<boolean | undefined>(undefined)
  const leftLineFirst = useRef(true)
  const leftLineStartCell = useRef<{ row: number; col: number } | null>(null)
  const rightLineStartCell = useRef<{ row: number; col: number } | null>(null)

  const isEdgeCrossMode = isEdgeMode || inputMode === 'border' || inputMode === 'fixedBorder' || isLineMode

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
    onLeftClickCell,
    onRightClickCell,
    isPinching,
    touchEnabled: !isEdgeMode && !isLineMode,
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
      // If left line drag ended without drawing any line, treat as center click
      if (leftLineDragging.current && leftLineAction.current === undefined && leftLineStartCell.current && onLineCenterClickRef.current) {
        onLineCenterClickRef.current(leftLineStartCell.current)
      }
      rightEdgeDragging.current = false
      rightEdgeVisited.current.clear()
      rightLineDragging.current = false
      rightLineLastCell.current = null
      rightLineStartCell.current = null
      leftLineDragging.current = false
      leftLineLastCell.current = null
      leftLineStartCell.current = null
      leftLineAction.current = undefined
      leftLineFirst.current = true
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

  // Keep refs for native touch handlers to access latest values
  const lineToggleFnRef = useRef(lineToggleFn)
  lineToggleFnRef.current = lineToggleFn
  const onLineCenterClickRef = useRef(onLineCenterClick)
  onLineCenterClickRef.current = onLineCenterClick
  const isLineModeRef = useRef(isLineMode)
  isLineModeRef.current = isLineMode
  const gridRef = useRef(grid)
  gridRef.current = grid
  const isPinchingRef = useRef(isPinching)
  isPinchingRef.current = isPinching
  const foggedCellsRef = useRef(foggedCells)
  foggedCellsRef.current = foggedCells

  // Touch-based line drawing (native handlers with passive: false)
  useEffect(() => {
    const table = dragSelect.tableRef.current
    if (!table) return

    const touchLineDragging = { current: false }
    const touchLineLastCell = { current: null as { row: number; col: number } | null }
    const touchLineAction = { current: undefined as boolean | undefined }
    const touchLineFirst = { current: true }
    const touchLineStartCell = { current: null as { row: number; col: number } | null }
    let touchStartTimer: ReturnType<typeof setTimeout> | null = null
    let pendingTouchPos: { row: number; col: number } | null = null

    const commitTouchLineStart = () => {
      if (!pendingTouchPos) return
      const pos = pendingTouchPos
      touchLineDragging.current = true
      touchLineLastCell.current = pos
      touchLineAction.current = undefined
      touchLineFirst.current = true
      const g = gridRef.current
      const rows = g.length, cols = g[0]?.length ?? 0
      const isReal = pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols
      touchLineStartCell.current = isReal ? pos : null
      pendingTouchPos = null
    }

    const cancelPending = () => {
      if (touchStartTimer) {
        clearTimeout(touchStartTimer)
        touchStartTimer = null
      }
      pendingTouchPos = null
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (!isLineModeRef.current || !lineToggleFnRef.current) return
      if (isPinchingRef.current) return
      if (e.touches.length >= 2) { cancelPending(); return }
      e.preventDefault()
      const touch = e.touches[0]
      const hit = getLineDragCell(touch.clientX, touch.clientY, table)
      if (hit) {
        pendingTouchPos = hit
        touchStartTimer = setTimeout(commitTouchLineStart, 80)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isLineModeRef.current || !lineToggleFnRef.current) return
      if (e.touches.length >= 2) {
        cancelPending()
        touchLineDragging.current = false
        touchLineLastCell.current = null
        return
      }
      // If pending, commit immediately on move to new cell
      if (pendingTouchPos && touchStartTimer) {
        const touch = e.touches[0]
        const hit = getLineDragCell(touch.clientX, touch.clientY, table)
        if (hit && (hit.row !== pendingTouchPos.row || hit.col !== pendingTouchPos.col)) {
          clearTimeout(touchStartTimer)
          touchStartTimer = null
          commitTouchLineStart()
        } else {
          return
        }
      }
      if (!touchLineDragging.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const g = gridRef.current
      const rows = g.length, cols = g[0]?.length ?? 0
      const rawHit = getLineDragCell(touch.clientX, touch.clientY, table)
      if (!rawHit) return
      const hit = { row: rawHit.row, col: rawHit.col }
      const prev = touchLineLastCell.current
      if (!prev || (hit.row === prev.row && hit.col === prev.col)) return
      const dr = hit.row - prev.row
      const dc = hit.col - prev.col
      if (Math.abs(dr) + Math.abs(dc) !== 1) return
      const prevReal = prev.row >= 0 && prev.row < rows && prev.col >= 0 && prev.col < cols
      const hitReal = hit.row >= 0 && hit.row < rows && hit.col >= 0 && hit.col < cols
      if (!prevReal && !hitReal) return
      // Block lines between two fogged cells (player mode)
      const fc = foggedCellsRef.current
      const prevFogged = prevReal && fc?.has(`${prev.row},${prev.col}`)
      const hitFogged = hitReal && fc?.has(`${hit.row},${hit.col}`)
      if (prevFogged && hitFogged) { touchLineLastCell.current = hit; return }
      let realCell: { row: number; col: number }
      let side: 0 | 1 | 2 | 3
      if (prevReal) {
        realCell = prev
        if (dr === -1) side = 0
        else if (dc === 1) side = 1
        else if (dr === 1) side = 2
        else side = 3
      } else {
        realCell = hit
        if (dr === -1) side = 2
        else if (dc === 1) side = 3
        else if (dr === 1) side = 0
        else side = 1
      }
      if (touchLineAction.current === undefined) {
        const cell = g[realCell.row]?.[realCell.col]
        touchLineAction.current = cell ? !cell.lines[side] : true
      }
      const withUndo = touchLineFirst.current
      touchLineFirst.current = false
      lineToggleFnRef.current!(realCell, side, touchLineAction.current, withUndo)
      touchLineLastCell.current = hit
    }

    const handleTouchEnd = () => {
      // If touch ended without drawing any line, treat as center tap
      if (pendingTouchPos || (touchLineDragging.current && touchLineAction.current === undefined && touchLineStartCell.current)) {
        const cell = pendingTouchPos || touchLineStartCell.current
        if (cell && onLineCenterClickRef.current) {
          onLineCenterClickRef.current(cell)
        }
      }
      cancelPending()
      touchLineDragging.current = false
      touchLineLastCell.current = null
      touchLineStartCell.current = null
      touchLineAction.current = undefined
      touchLineFirst.current = true
    }

    table.addEventListener('touchstart', handleTouchStart, { passive: false })
    table.addEventListener('touchmove', handleTouchMove, { passive: false })
    table.addEventListener('touchend', handleTouchEnd)
    return () => {
      table.removeEventListener('touchstart', handleTouchStart)
      table.removeEventListener('touchmove', handleTouchMove)
      table.removeEventListener('touchend', handleTouchEnd)
      cancelPending()
    }
  }, [])

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

  // Get cell position for line drags — uses virtual cells when mouse is outside the table
  const getLineDragCell = (x: number, y: number, table: HTMLTableElement) => {
    const rect = table.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return getNearestCell(x, y, table)
    }
    return getVirtualCell(x, y, table)
  }

  return (
    <div
      className="grid-container"
      onMouseDown={(e) => {
        // Ignore middle-click — let it pan without affecting selection
        if (e.button === 1) return
        if (e.button === 0 && isLineMode && lineToggleFn) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge) {
            // Edge click: cycle none → X → < → > → none
            if (onCycleEdgeMark) onCycleEdgeMark(edge)
          } else {
            // Center zone: start line drag (also allow starting from outside the grid)
            const hit = getLineDragCell(e.clientX, e.clientY, table)
            if (hit) {
              leftLineDragging.current = true
              leftLineLastCell.current = { row: hit.row, col: hit.col }
              leftLineAction.current = undefined
              leftLineFirst.current = true
              const rows = grid.length, cols = grid[0]?.length ?? 0
              const isReal = hit.row >= 0 && hit.row < rows && hit.col >= 0 && hit.col < cols
              leftLineStartCell.current = isReal ? hit : null
            }
          }
          return
        }
        if (e.button === 2 && isLineMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge) {
            // Right-click on edge: start X drag (reuse rightEdge refs)
            rightEdgeDragging.current = true
            rightEdgeVisited.current.clear()
            const cell = grid[edge.row]?.[edge.col]
            rightEdgeAction.current = cell ? !cell.edgeCrosses[edge.side] : true
            const key = normalizeEdgeKey(edge)
            rightEdgeVisited.current.add(key)
            onToggleEdgeCross(edge, rightEdgeAction.current)
          } else if (onLineRightCenterClick) {
            // Right-click on cell center: toggle dot mark
            const hit = getNearestCell(e.clientX, e.clientY, table)
            if (hit) onLineRightCenterClick(hit)
          }
          return
        }
        if (e.button === 0 && isFixedMarkMode && onToggleFixedMark) {
          const table = dragSelect.tableRef.current
          if (table) {
            const target = detectMarkTarget(e.clientX, e.clientY, table)
            if (target && !foggedCells?.has(`${target.row},${target.col}`) && target.type !== 'center') {
              // Edge/vertex clicks: handle directly, not via drag
              e.preventDefault()
              onToggleFixedMark(target, activeMark!)
              return
            }
          }
          // Center clicks: fall through to drag system
        }
        if (e.button === 2 && isEdgeCrossMode && onToggleEdgeCross) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
          if (edge) {
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
            if (hit) {
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
        if (leftLineDragging.current && lineToggleFn) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          if (leftLineAction.current === false) {
            const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
            if (edge) {
              const cell = grid[edge.row]?.[edge.col]
              if (cell?.lines[edge.side]) {
                const withUndo = leftLineFirst.current
                leftLineFirst.current = false
                lineToggleFn!({ row: edge.row, col: edge.col }, edge.side, false, withUndo)
                leftLineLastCell.current = { row: edge.row, col: edge.col }
                return
              }
            }
          }
          const rows = grid.length, cols = grid[0]?.length ?? 0
          const rawHit = getLineDragCell(e.clientX, e.clientY, table)
          if (!rawHit) return
          const hit = { row: rawHit.row, col: rawHit.col }
          const prev = leftLineLastCell.current
          if (!prev || (hit.row === prev.row && hit.col === prev.col)) return
          const dr = hit.row - prev.row
          const dc = hit.col - prev.col
          if (Math.abs(dr) + Math.abs(dc) !== 1) return
          // Determine which cell is real and which side to toggle
          const prevReal = prev.row >= 0 && prev.row < rows && prev.col >= 0 && prev.col < cols
          const hitReal = hit.row >= 0 && hit.row < rows && hit.col >= 0 && hit.col < cols
          if (!prevReal && !hitReal) return
          // Block lines between two fogged cells (player mode)
          const prevFogged = prevReal && foggedCells?.has(`${prev.row},${prev.col}`)
          const hitFogged = hitReal && foggedCells?.has(`${hit.row},${hit.col}`)
          if (prevFogged && hitFogged) { leftLineLastCell.current = hit; return }
          let realCell: { row: number; col: number }
          let side: 0 | 1 | 2 | 3
          if (prevReal) {
            realCell = prev
            if (dr === -1) side = 0
            else if (dc === 1) side = 1
            else if (dr === 1) side = 2
            else side = 3
          } else {
            realCell = hit
            // Reverse: from virtual into real, side is opposite
            if (dr === -1) side = 2
            else if (dc === 1) side = 3
            else if (dr === 1) side = 0
            else side = 1
          }
          if (leftLineAction.current === undefined) {
            const cell = grid[realCell.row]?.[realCell.col]
            leftLineAction.current = cell ? !cell.lines[side] : true
          }
          const withUndo = leftLineFirst.current
          leftLineFirst.current = false
          lineToggleFn!(realCell, side, leftLineAction.current, withUndo)
          leftLineLastCell.current = { row: hit.row, col: hit.col }
          return
        }
        if (rightLineDragging.current && lineToggleFn) {
          e.preventDefault()
          const table = dragSelect.tableRef.current
          if (!table) return
          // When removing lines, also check edge zones so the cursor doesn't have to
          // travel all the way to cell centers
          if (rightLineAction.current === false) {
            const edge = detectEdge(e.clientX, e.clientY, table, 0.25)
            if (edge) {
              const cell = grid[edge.row]?.[edge.col]
              if (cell?.lines[edge.side]) {
                const withUndo = rightLineFirst.current
                rightLineFirst.current = false
                lineToggleFn!({ row: edge.row, col: edge.col }, edge.side, false, withUndo)
                rightLineLastCell.current = { row: edge.row, col: edge.col }
                return
              }
            }
          }
          const rows = grid.length, cols = grid[0]?.length ?? 0
          const rawHit = getLineDragCell(e.clientX, e.clientY, table)
          if (!rawHit) return
          const hit = { row: rawHit.row, col: rawHit.col }
          const prev = rightLineLastCell.current
          if (!prev || (hit.row === prev.row && hit.col === prev.col)) return
          const dr = hit.row - prev.row
          const dc = hit.col - prev.col
          if (Math.abs(dr) + Math.abs(dc) !== 1) return
          const prevReal = prev.row >= 0 && prev.row < rows && prev.col >= 0 && prev.col < cols
          const hitReal = hit.row >= 0 && hit.row < rows && hit.col >= 0 && hit.col < cols
          if (!prevReal && !hitReal) return
          // Block lines between two fogged cells (player mode)
          const prevFogged = prevReal && foggedCells?.has(`${prev.row},${prev.col}`)
          const hitFogged = hitReal && foggedCells?.has(`${hit.row},${hit.col}`)
          if (prevFogged && hitFogged) { rightLineLastCell.current = hit; return }
          let realCell: { row: number; col: number }
          let side: 0 | 1 | 2 | 3
          if (prevReal) {
            realCell = prev
            if (dr === -1) side = 0
            else if (dc === 1) side = 1
            else if (dr === 1) side = 2
            else side = 3
          } else {
            realCell = hit
            if (dr === -1) side = 2
            else if (dc === 1) side = 3
            else if (dr === 1) side = 0
            else side = 1
          }
          if (rightLineAction.current === undefined) {
            const cell = grid[realCell.row]?.[realCell.col]
            rightLineAction.current = cell ? !cell.lines[side] : true
          }
          const withUndo = rightLineFirst.current
          rightLineFirst.current = false
          lineToggleFn!(realCell, side, rightLineAction.current, withUndo)
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
      onContextMenu={(e) => e.preventDefault()}
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
                    totalRows={grid.length}
                    totalCols={row.length}
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
                    highlightedNote={highlightedNote}
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
