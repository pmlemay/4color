import { useState, useCallback, useRef } from 'react'
import { CellData, CellPosition, InputMode, LabelAlign, MarkShape, AutoCrossRule, EdgeDescriptor, CellTexture } from '../types'
import { MarkTarget } from '../utils/gridHitTest'
import { createEmptyGrid } from '../utils/puzzleIO'
import { applyBordersToSelection } from '../utils/borders'
import { getAutoCrossTargets } from '../utils/autoCross'

const MAX_NOTES = 16
const MAX_UNDO = 500

function cloneGrid(grid: CellData[][]): CellData[][] {
  return grid.map(row => row.map(cell => ({
    ...cell,
    notes: [...cell.notes],
    borders: [...cell.borders] as [number, number, number, number],
    fixedBorders: [...cell.fixedBorders] as [number, number, number, number],
    edgeCrosses: [...cell.edgeCrosses] as [boolean, boolean, boolean, boolean],
    lines: [...cell.lines] as [boolean, boolean, boolean, boolean],
    fixedEdgeMarks: [...cell.fixedEdgeMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
    fixedVertexMarks: [...cell.fixedVertexMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
  })))
}

// Clone for undo/redo — strips transient `selected` flag so undo
// snapshots don't contain stale selection state
function cloneForUndo(grid: CellData[][]): CellData[][] {
  return grid.map(row => row.map(cell => ({
    ...cell,
    selected: false,
    notes: [...cell.notes],
    borders: [...cell.borders] as [number, number, number, number],
    fixedBorders: [...cell.fixedBorders] as [number, number, number, number],
    edgeCrosses: [...cell.edgeCrosses] as [boolean, boolean, boolean, boolean],
    lines: [...cell.lines] as [boolean, boolean, boolean, boolean],
    fixedEdgeMarks: [...cell.fixedEdgeMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
    fixedVertexMarks: [...cell.fixedVertexMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
  })))
}

export function useGrid(initialRows: number, initialCols: number) {
  const [grid, setGridRaw] = useState<CellData[][]>(() =>
    createEmptyGrid(initialRows, initialCols)
  )
  const gridRef = useRef(grid)
  gridRef.current = grid
  // Wrap setGrid to also update the ref synchronously, so unmount cleanup
  // always sees the latest grid even if React hasn't re-rendered yet.
  const setGrid = useCallback((updater: CellData[][] | ((prev: CellData[][]) => CellData[][])) => {
    setGridRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      gridRef.current = next
      return next
    })
  }, [])

  const [selection, setSelectionRaw] = useState<CellPosition[]>([])
  const selectionRef = useRef<CellPosition[]>([])
  const setSelection = useCallback((s: CellPosition[]) => { selectionRef.current = s; setSelectionRaw(s) }, [])
  const [inputMode, setInputModeRaw] = useState<InputMode>('normal')
  const undoStack = useRef<CellData[][][]>([])
  const redoStack = useRef<CellData[][][]>([])
  const crossAction = useRef<boolean>(true) // true = add X, false = remove X
  const crossDragActive = useRef(false)
  const borderDragBase = useRef<CellData[][] | null>(null) // pre-drag snapshot for border mode
  const borderDragRemoving = useRef(false)
  const colorDragActive = useRef(false)
  const colorDragAction = useRef<string | null>(null) // target color value for this drag (null = erase)
  const markDragActive = useRef(false)
  const markDragAction = useRef<MarkShape | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [activeMark, setActiveMark] = useState<MarkShape | null>(null)
  const [activeTexture, setActiveTexture] = useState<CellTexture | null>(null)
  const textureDragActive = useRef(false)
  const textureDragAction = useRef<CellTexture | null>(null)
  const autoCrossRulesRef = useRef<AutoCrossRule[]>([])
  const puzzleTypeRef = useRef('')

  const setAutoCrossRules = useCallback((rules: AutoCrossRule[]) => {
    autoCrossRulesRef.current = rules
  }, [])

  const setPuzzleType = useCallback((type: string) => {
    puzzleTypeRef.current = type
  }, [])

  const setInputMode = useCallback((mode: InputMode) => {
    setInputModeRaw(mode)
    if (mode !== 'color' && mode !== 'fixedColor') {
      setActiveColor(null)
    }
    if (mode !== 'mark' && mode !== 'fixedMark') {
      setActiveMark(null)
    }
    if (mode !== 'fixedTexture') {
      setActiveTexture(null)
    }
  }, [])

  const setGridWithUndo = useCallback((updater: CellData[][] | ((prev: CellData[][]) => CellData[][])) => {
    // Push current state to undo BEFORE the updater — avoids side effects
    // inside setGrid updater which React may call more than once (StrictMode)
    undoStack.current.push(cloneForUndo(gridRef.current))
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    redoStack.current = []
    setGrid(prev => typeof updater === 'function' ? updater(prev) : updater)
  }, [])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(cloneForUndo(gridRef.current))
    if (redoStack.current.length > MAX_UNDO) redoStack.current.shift()
    setGrid(prev)
    setSelection([])
  }, [])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(cloneForUndo(gridRef.current))
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
    setGrid(next)
    setSelection([])
  }, [])

  const prevSelection = useRef<CellPosition[]>([])
  const clearSelection = useCallback(() => {
    prevSelection.current = selectionRef.current
    setGrid(prev => prev.map(row => row.map(cell => ({ ...cell, selected: false }))))
    setSelection([])
  }, [])

  const onDragChange = useCallback((sel: CellPosition[]) => {
    if (sel.length === 0) return

    if ((inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null) {
      const field = inputMode === 'fixedColor' ? 'fixedColor' : 'color'
      const isErase = activeColor === '0'
      setGrid(prev => {
        if (!colorDragActive.current) {
          colorDragActive.current = true
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          // Determine paint vs erase from the first cell (like cross mode)
          if (isErase) {
            colorDragAction.current = null
          } else {
            colorDragAction.current = prev[sel[0].row][sel[0].col][field] === activeColor ? null : activeColor
          }
        }
        const targetValue = colorDragAction.current
        const isNurikabe = puzzleTypeRef.current === 'nurikabe'
        const needsUpdate = sel.some(pos => prev[pos.row][pos.col][field] !== targetValue || (isNurikabe && targetValue && prev[pos.row][pos.col].mark === 'dot'))
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of sel) {
          newGrid[pos.row][pos.col][field] = targetValue
          if (isNurikabe && targetValue) {
            newGrid[pos.row][pos.col].mark = null
          }
        }
        return newGrid
      })
      return
    }

    if (inputMode === 'cross') {
      setGrid(prev => {
        if (!crossDragActive.current) {
          crossDragActive.current = true
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          crossAction.current = !prev[sel[0].row][sel[0].col].crossed
        }
        const eligible = sel.filter(pos => { const c = prev[pos.row][pos.col]; return !c.value && !c.fixedValue && !c.mark && !c.fixedMark })
        const needsUpdate = eligible.some(pos => prev[pos.row][pos.col].crossed !== crossAction.current)
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of eligible) {
          newGrid[pos.row][pos.col].crossed = crossAction.current
        }
        return newGrid
      })
      return
    }

    if (inputMode === 'mark' && activeMark !== null) {
      setGrid(prev => {
        if (!markDragActive.current) {
          markDragActive.current = true
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          markDragAction.current = prev[sel[0].row][sel[0].col].mark === activeMark ? null : activeMark
        }
        const targetValue = markDragAction.current
        const eligible = sel.filter(pos => !prev[pos.row][pos.col].crossed && !prev[pos.row][pos.col].value && !prev[pos.row][pos.col].fixedValue)
        const needsUpdate = eligible.some(pos => prev[pos.row][pos.col].mark !== targetValue)
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of eligible) {
          newGrid[pos.row][pos.col].mark = targetValue
        }
        // Auto-cross around newly placed marks
        const rules = autoCrossRulesRef.current
        if (targetValue !== null && rules.length > 0) {
          const rows = newGrid.length
          const cols = newGrid[0].length
          const targets = getAutoCrossTargets(eligible, rules, rows, cols)
          for (const t of targets) {
            const cell = newGrid[t.row][t.col]
            if (!cell.value && !cell.fixedValue && !cell.mark && !cell.fixedMark) {
              cell.crossed = true
            }
          }
        }
        return newGrid
      })
      return
    }

    if (inputMode === 'fixedTexture' && activeTexture !== null) {
      setGrid(prev => {
        if (!textureDragActive.current) {
          textureDragActive.current = true
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          const firstCell = prev[sel[0].row][sel[0].col]
          const matches = firstCell.fixedTexture?.type === activeTexture.type && firstCell.fixedTexture?.variant === activeTexture.variant
          textureDragAction.current = matches ? null : activeTexture
        }
        const targetValue = textureDragAction.current
        const needsUpdate = sel.some(pos => {
          const ft = prev[pos.row][pos.col].fixedTexture
          if (targetValue === null) return ft !== null
          return ft?.type !== targetValue.type || ft?.variant !== targetValue.variant
        })
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of sel) {
          newGrid[pos.row][pos.col].fixedTexture = targetValue ? { ...targetValue } : null
        }
        return newGrid
      })
      return
    }

    if (inputMode === 'border') {
      setGrid(prev => {
        if (!borderDragBase.current) {
          // First call — save base snapshot and push undo
          borderDragBase.current = cloneGrid(prev)
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          // Determine if we're removing: only if first cell has all 4 borders active
          const firstCell = borderDragBase.current[sel[0].row][sel[0].col]
          borderDragRemoving.current = firstCell.borders.every(b => b > 0)
        }
        // Always recalculate from the base snapshot
        const base = borderDragBase.current
        if (borderDragRemoving.current) {
          // Remove user borders from selected cells + neighbor matching sides
          const newGrid = cloneGrid(base)
          const rows = newGrid.length
          const cols = newGrid[0].length
          const NEIGHBORS: [number, number, number, number][] = [
            [-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1],
          ]
          for (const pos of sel) {
            const cell = newGrid[pos.row][pos.col]
            for (const [dr, dc, side, nSide] of NEIGHBORS) {
              if (cell.fixedBorders[side] === 0) {
                cell.borders[side] = 0
                const nr = pos.row + dr, nc = pos.col + dc
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                  const neighbor = newGrid[nr][nc]
                  if (neighbor.fixedBorders[nSide] === 0) {
                    neighbor.borders[nSide] = 0
                  }
                }
              }
            }
          }
          return newGrid
        } else {
          // Apply perimeter borders with merge — returns full grid
          // (also removes shared walls with adjacent existing bordered regions)
          return applyBordersToSelection(base, sel)
        }
      })
      return
    }

    if (inputMode === 'fixedBorder') {
      setGrid(prev => {
        if (!borderDragBase.current) {
          borderDragBase.current = cloneGrid(prev)
          undoStack.current.push(cloneForUndo(prev))
          if (undoStack.current.length > MAX_UNDO) undoStack.current.shift()
          redoStack.current = []
          const firstCell = borderDragBase.current[sel[0].row][sel[0].col]
          borderDragRemoving.current = firstCell.fixedBorders.every(b => b > 0)
        }
        const base = borderDragBase.current
        const newGrid = cloneGrid(base)
        const rows = newGrid.length
        const cols = newGrid[0].length
        const NEIGHBORS: [number, number, number, number][] = [
          [-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1],
        ]
        if (borderDragRemoving.current) {
          for (const pos of sel) {
            const cell = newGrid[pos.row][pos.col]
            for (const [dr, dc, side, nSide] of NEIGHBORS) {
              cell.fixedBorders[side] = 0
              cell.borders[side] = 0
              const nr = pos.row + dr, nc = pos.col + dc
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const neighbor = newGrid[nr][nc]
                neighbor.fixedBorders[nSide] = 0
                neighbor.borders[nSide] = 0
              }
            }
          }
        } else {
          const selSet = new Set(sel.map(s => `${s.row},${s.col}`))
          for (const pos of sel) {
            for (const [dr, dc, side, nSide] of NEIGHBORS) {
              const isPerimeter = !selSet.has(`${pos.row + dr},${pos.col + dc}`)
              if (!isPerimeter) continue
              newGrid[pos.row][pos.col].fixedBorders[side] = 1
              newGrid[pos.row][pos.col].borders[side] = 1
              newGrid[pos.row][pos.col].edgeCrosses[side] = false
              const nr = pos.row + dr, nc = pos.col + dc
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                newGrid[nr][nc].fixedBorders[nSide] = 1
                newGrid[nr][nc].borders[nSide] = 1
                newGrid[nr][nc].edgeCrosses[nSide] = false
              }
            }
          }
        }
        return newGrid
      })
      return
    }
  }, [inputMode, activeColor, activeMark, activeTexture])

  const commitSelection = useCallback((sel: CellPosition[], ctrlHeld?: boolean) => {
    // Color mode with active color: already applied live, reset flag
    if ((inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null) {
      colorDragActive.current = false
      return
    }
    // Texture mode: already applied live during drag, just reset flag
    if (inputMode === 'fixedTexture' && activeTexture !== null) {
      textureDragActive.current = false
      return
    }
    // Cross mode: already applied live during drag, just reset flag
    if (inputMode === 'cross') {
      crossDragActive.current = false
      return
    }
    // Mark mode: already applied live during drag, just reset flag
    if (inputMode === 'mark' && activeMark !== null) {
      markDragActive.current = false
      return
    }
    // Border mode: already applied live during drag, just reset
    if (inputMode === 'border' || inputMode === 'fixedBorder') {
      borderDragBase.current = null
      return
    }
    // Normal modes: commit selection highlight
    if (ctrlHeld) {
      // Ctrl: accumulate selection.
      // If the first cell of the drag was already selected → remove mode (deselect dragged cells).
      // Otherwise → add mode (add dragged cells to selection).
      const currentGrid = gridRef.current
      const newSelKeys = new Set(sel.map(p => `${p.row},${p.col}`))
      const prevSelected: CellPosition[] = []
      for (let ri = 0; ri < currentGrid.length; ri++) {
        for (let ci = 0; ci < currentGrid[ri].length; ci++) {
          if (currentGrid[ri][ci].selected) prevSelected.push({ row: ri, col: ci })
        }
      }
      const prevKeys = new Set(prevSelected.map(p => `${p.row},${p.col}`))
      const firstWasSelected = sel.length > 0 && prevKeys.has(`${sel[0].row},${sel[0].col}`)
      const removing = firstWasSelected
      const merged: CellPosition[] = []
      for (const p of prevSelected) {
        if (removing && newSelKeys.has(`${p.row},${p.col}`)) continue
        merged.push(p)
      }
      if (!removing) {
        for (const p of sel) {
          if (!prevKeys.has(`${p.row},${p.col}`)) merged.push(p)
        }
      }
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(cell => ({ ...cell, selected: false })))
        for (const pos of merged) {
          if (newGrid[pos.row]?.[pos.col]) newGrid[pos.row][pos.col].selected = true
        }
        return newGrid
      })
      setSelection(merged)
    } else {
      // Single click on the only previously selected cell → deselect
      if (sel.length === 1 && prevSelection.current.length === 1 &&
          sel[0].row === prevSelection.current[0].row &&
          sel[0].col === prevSelection.current[0].col) {
        setSelection([])
        return
      }
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(cell => ({ ...cell })))
        for (const pos of sel) {
          if (newGrid[pos.row]?.[pos.col]) {
            newGrid[pos.row][pos.col].selected = true
          }
        }
        return newGrid
      })
      setSelection(sel)
    }
  }, [inputMode, activeColor, activeMark, activeTexture, setGridWithUndo])

  const applyValue = useCallback(
    (value: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allHaveValue = selection.every(
          pos => newGrid[pos.row][pos.col].value === value
        )
        const newValue = allHaveValue ? null : value
        for (const pos of selection) {
          newGrid[pos.row][pos.col].value = newValue
        }
        // Auto-cross: when setting a value (not erasing), cross eligible cells
        const rules = autoCrossRulesRef.current
        if (newValue !== null && rules.length > 0) {
          const rows = newGrid.length
          const cols = newGrid[0].length
          const targets = getAutoCrossTargets(selection, rules, rows, cols)
          for (const t of targets) {
            const cell = newGrid[t.row][t.col]
            if (!cell.value && !cell.fixedValue && !cell.mark && !cell.fixedMark) {
              cell.crossed = true
            }
          }
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const applyColor = useCallback(
    (value: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allHaveColor = selection.every(
          pos => newGrid[pos.row][pos.col].color === value
        )
        for (const pos of selection) {
          newGrid[pos.row][pos.col].color = allHaveColor ? null : value
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const eraseColor = useCallback(() => {
    if (selection.length === 0) return
    const field = inputMode === 'fixedColor' ? 'fixedColor' : 'color'
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col][field] = null
      }
      return newGrid
    })
  }, [selection, inputMode, setGridWithUndo])

  const applyFixedValue = useCallback(
    (value: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allHaveFixed = selection.every(
          pos => newGrid[pos.row][pos.col].fixedValue === value
        )
        for (const pos of selection) {
          newGrid[pos.row][pos.col].fixedValue = allHaveFixed ? null : value
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const applyFixedColor = useCallback(
    (value: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allHaveFixedColor = selection.every(
          pos => newGrid[pos.row][pos.col].fixedColor === value
        )
        for (const pos of selection) {
          newGrid[pos.row][pos.col].fixedColor = allHaveFixedColor ? null : value
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const addNote = useCallback(
    (value: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        for (const pos of selection) {
          const cell = newGrid[pos.row][pos.col]
          const idx = cell.notes.indexOf(value)
          if (idx !== -1) {
            cell.notes.splice(idx, 1)
          } else if (cell.notes.length < MAX_NOTES) {
            cell.notes.push(value)
          }
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const applyLabel = useCallback(
    (align: LabelAlign, text: string, showThroughFog?: boolean, revealWithFog?: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        for (const pos of selection) {
          const cell = newGrid[pos.row][pos.col]
          const existing = cell.labels[align]
          if (existing?.text === text && existing?.showThroughFog === showThroughFog && existing?.revealWithFog === revealWithFog) {
            cell.labels = { ...cell.labels, [align]: null }
          } else {
            cell.labels = { ...cell.labels, [align]: { text, showThroughFog, revealWithFog } }
          }
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const removeLabel = useCallback((align: LabelAlign) => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col].labels = { ...newGrid[pos.row][pos.col].labels, [align]: null }
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const toggleCross = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      const eligible = selection.filter(pos => { const c = newGrid[pos.row][pos.col]; return !c.value && !c.fixedValue && !c.mark && !c.fixedMark })
      if (eligible.length === 0) return prev
      const allCrossed = eligible.every(pos => newGrid[pos.row][pos.col].crossed)
      for (const pos of eligible) {
        newGrid[pos.row][pos.col].crossed = !allCrossed
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const toggleMark = useCallback((shape: MarkShape) => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      const eligible = selection.filter(pos => !newGrid[pos.row][pos.col].crossed && !newGrid[pos.row][pos.col].value && !newGrid[pos.row][pos.col].fixedValue)
      if (eligible.length === 0) return prev
      const allHaveMark = eligible.every(pos => newGrid[pos.row][pos.col].mark === shape)
      const placing = !allHaveMark
      for (const pos of eligible) {
        newGrid[pos.row][pos.col].mark = placing ? shape : null
      }
      // Auto-cross around newly placed marks
      const rules = autoCrossRulesRef.current
      if (placing && rules.length > 0) {
        const rows = newGrid.length
        const cols = newGrid[0].length
        const targets = getAutoCrossTargets(eligible, rules, rows, cols)
        for (const t of targets) {
          const cell = newGrid[t.row][t.col]
          if (!cell.value && !cell.fixedValue && !cell.mark) {
            cell.crossed = true
          }
        }
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const eraseMark = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col].mark = null
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const toggleFixedMark = useCallback((target: MarkTarget, shape: MarkShape) => {
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      const rows = newGrid.length
      const cols = newGrid[0].length

      if (target.type === 'center') {
        const cell = newGrid[target.row][target.col]
        cell.fixedMark = cell.fixedMark === shape ? null : shape
      } else if (target.type === 'edge') {
        const { row, col, side } = target
        const cell = newGrid[row][col]
        cell.fixedEdgeMarks[side] = cell.fixedEdgeMarks[side] === shape ? null : shape
        // Sync neighbor's matching side
        const OPPOSITE: Record<number, { dr: number; dc: number; nSide: 0 | 1 | 2 | 3 }> = {
          0: { dr: -1, dc: 0, nSide: 2 },
          1: { dr: 0, dc: 1, nSide: 3 },
          2: { dr: 1, dc: 0, nSide: 0 },
          3: { dr: 0, dc: -1, nSide: 1 },
        }
        const opp = OPPOSITE[side]
        const nr = row + opp.dr, nc = col + opp.dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          newGrid[nr][nc].fixedEdgeMarks[opp.nSide] = cell.fixedEdgeMarks[side]
        }
      } else if (target.type === 'vertex') {
        const { row, col, corner } = target
        const cell = newGrid[row][col]
        cell.fixedVertexMarks[corner] = cell.fixedVertexMarks[corner] === shape ? null : shape
        // Sync all cells sharing this vertex
        const newVal = cell.fixedVertexMarks[corner]
        // corner 0=TL, 1=TR, 2=BR, 3=BL
        // Neighbors sharing the same vertex point:
        const VERTEX_NEIGHBORS: Record<number, { dr: number; dc: number; nCorner: 0 | 1 | 2 | 3 }[]> = {
          0: [{ dr: -1, dc: 0, nCorner: 3 }, { dr: -1, dc: -1, nCorner: 2 }, { dr: 0, dc: -1, nCorner: 1 }], // TL
          1: [{ dr: -1, dc: 0, nCorner: 2 }, { dr: -1, dc: 1, nCorner: 3 }, { dr: 0, dc: 1, nCorner: 0 }],   // TR
          2: [{ dr: 1, dc: 0, nCorner: 1 }, { dr: 1, dc: 1, nCorner: 0 }, { dr: 0, dc: 1, nCorner: 3 }],     // BR
          3: [{ dr: 1, dc: 0, nCorner: 0 }, { dr: 1, dc: -1, nCorner: 1 }, { dr: 0, dc: -1, nCorner: 2 }],   // BL
        }
        for (const nb of VERTEX_NEIGHBORS[corner]) {
          const nr = row + nb.dr, nc = col + nb.dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            newGrid[nr][nc].fixedVertexMarks[nb.nCorner] = newVal
          }
        }
      }
      return newGrid
    })
  }, [setGridWithUndo])

  const applyFixedTexture = useCallback(
    (texture: CellTexture) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allMatch = selection.every(pos => {
          const ft = newGrid[pos.row][pos.col].fixedTexture
          return ft?.type === texture.type && ft?.variant === texture.variant
        })
        for (const pos of selection) {
          newGrid[pos.row][pos.col].fixedTexture = allMatch ? null : { ...texture }
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const removeFixedTexture = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col].fixedTexture = null
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const applyImage = useCallback(
    (imageBase64: string) => {
      if (selection.length === 0) return
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const allHaveImage = selection.every(pos => newGrid[pos.row][pos.col].image === imageBase64)
        for (const pos of selection) {
          newGrid[pos.row][pos.col].image = allHaveImage ? null : imageBase64
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const removeImage = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col].image = null
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const isEditorRef = useRef(false)
  const setIsEditor = useCallback((v: boolean) => { isEditorRef.current = v }, [])

  const clearValues = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        const cell = newGrid[pos.row][pos.col]
        cell.value = null
        cell.notes = []
        cell.color = null
        cell.crossed = false
        cell.mark = null
        cell.edgeCrosses = [false, false, false, false]
        cell.lines = [false, false, false, false]
        cell.borders = [...cell.fixedBorders] as [number, number, number, number]
        if (isEditorRef.current) {
          cell.fixedColor = null
          cell.fixedMark = null
          cell.fixedEdgeMarks = [null, null, null, null]
          cell.fixedVertexMarks = [null, null, null, null]
          cell.fixedTexture = null
        }
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const applyBorders = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      // Only remove if all selected cells have all 4 borders active
      const allFullyBordered = selection.every(pos => {
        const cell = prev[pos.row][pos.col]
        return cell.borders.every(b => b > 0)
      })
      if (allFullyBordered) {
        // Remove only user-added borders, keep fixed borders + neighbor matching sides
        const newGrid = cloneGrid(prev)
        const rows = newGrid.length
        const cols = newGrid[0].length
        const NEIGHBORS: [number, number, number, number][] = [
          [-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1],
        ]
        for (const pos of selection) {
          const cell = newGrid[pos.row][pos.col]
          for (const [dr, dc, side, nSide] of NEIGHBORS) {
            if (cell.fixedBorders[side] === 0) {
              cell.borders[side] = 0
              const nr = pos.row + dr, nc = pos.col + dc
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const neighbor = newGrid[nr][nc]
                if (neighbor.fixedBorders[nSide] === 0) {
                  neighbor.borders[nSide] = 0
                }
              }
            }
          }
        }
        return newGrid
      } else {
        return applyBordersToSelection(prev, selection)
      }
    })
  }, [selection, setGridWithUndo])

  const commitEdges = useCallback((edges: EdgeDescriptor[]) => {
    if (edges.length === 0) return
    const rows = gridRef.current.length
    const cols = gridRef.current[0].length
    // Determine add or remove based on first edge's current state
    const first = edges[0]
    const firstCell = gridRef.current[first.row]?.[first.col]
    if (!firstCell) return
    const removing = firstCell.borders[first.side] > 0 && firstCell.fixedBorders[first.side] === 0

    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const edge of edges) {
        // Expand each edge to both cells it touches
        const pairs: { row: number; col: number; side: 0 | 1 | 2 | 3 }[] = [edge]
        const { row: r, col: c, side } = edge
        if (side === 0 && r > 0) pairs.push({ row: r - 1, col: c, side: 2 })
        if (side === 1 && c + 1 < cols) pairs.push({ row: r, col: c + 1, side: 3 })
        if (side === 2 && r + 1 < rows) pairs.push({ row: r + 1, col: c, side: 0 })
        if (side === 3 && c > 0) pairs.push({ row: r, col: c - 1, side: 1 })

        for (const p of pairs) {
          const cell = newGrid[p.row]?.[p.col]
          if (!cell) continue
          if (removing) {
            // Only remove if not a fixed border
            if (cell.fixedBorders[p.side] === 0) {
              cell.borders[p.side] = 0
            }
          } else {
            cell.borders[p.side] = 1
            // Clear edge cross when a border is placed over it
            cell.edgeCrosses[p.side] = false
          }
        }
      }
      return newGrid
    })
  }, [setGridWithUndo])

  const commitFixedEdges = useCallback((edges: EdgeDescriptor[]) => {
    if (edges.length === 0) return
    const rows = gridRef.current.length
    const cols = gridRef.current[0].length
    const first = edges[0]
    const firstCell = gridRef.current[first.row]?.[first.col]
    if (!firstCell) return
    const removing = firstCell.fixedBorders[first.side] > 0

    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const edge of edges) {
        const pairs: { row: number; col: number; side: 0 | 1 | 2 | 3 }[] = [edge]
        const { row: r, col: c, side } = edge
        if (side === 0 && r > 0) pairs.push({ row: r - 1, col: c, side: 2 })
        if (side === 1 && c + 1 < cols) pairs.push({ row: r, col: c + 1, side: 3 })
        if (side === 2 && r + 1 < rows) pairs.push({ row: r + 1, col: c, side: 0 })
        if (side === 3 && c > 0) pairs.push({ row: r, col: c - 1, side: 1 })

        for (const p of pairs) {
          const cell = newGrid[p.row]?.[p.col]
          if (!cell) continue
          if (removing) {
            cell.fixedBorders[p.side] = 0
            cell.borders[p.side] = 0
          } else {
            cell.fixedBorders[p.side] = 1
            cell.borders[p.side] = 1
            cell.edgeCrosses[p.side] = false
          }
        }
      }
      return newGrid
    })
  }, [setGridWithUndo])

  const toggleEdgeCross = useCallback((edge: EdgeDescriptor, forceValue?: boolean) => {
    setGridWithUndo(prev => {
      const rows = prev.length
      const cols = prev[0]?.length ?? 0
      const newGrid = cloneGrid(prev)
      const cell = prev[edge.row][edge.col]
      const val = forceValue != null ? forceValue : !cell.edgeCrosses[edge.side]

      // Build list of both cells sharing this edge
      const pairs: { row: number; col: number; side: 0 | 1 | 2 | 3 }[] = [edge]
      if (edge.side === 0 && edge.row > 0) pairs.push({ row: edge.row - 1, col: edge.col, side: 2 })
      if (edge.side === 1 && edge.col < cols - 1) pairs.push({ row: edge.row, col: edge.col + 1, side: 3 })
      if (edge.side === 2 && edge.row < rows - 1) pairs.push({ row: edge.row + 1, col: edge.col, side: 0 })
      if (edge.side === 3 && edge.col > 0) pairs.push({ row: edge.row, col: edge.col - 1, side: 1 })

      for (const p of pairs) {
        const c = newGrid[p.row][p.col]
        c.edgeCrosses[p.side] = val
        // Remove user border when placing an X
        if (val && c.borders[p.side] > 0 && c.fixedBorders[p.side] === 0) {
          c.borders[p.side] = 0
        }
      }
      return newGrid
    })
  }, [setGridWithUndo])

  const toggleLine = useCallback((pos: CellPosition, side: 0 | 1 | 2 | 3, value: boolean, withUndo?: boolean) => {
    const setter = withUndo ? setGridWithUndo : setGrid
    setter(prev => {
      const rows = prev.length
      const cols = prev[0]?.length ?? 0
      const newGrid = cloneGrid(prev)
      newGrid[pos.row][pos.col].lines[side] = value
      // Set neighbor's matching side
      const OPPOSITE: Record<number, { dr: number; dc: number; nSide: 0 | 1 | 2 | 3 }> = {
        0: { dr: -1, dc: 0, nSide: 2 },
        1: { dr: 0, dc: 1, nSide: 3 },
        2: { dr: 1, dc: 0, nSide: 0 },
        3: { dr: 0, dc: -1, nSide: 1 },
      }
      const opp = OPPOSITE[side]
      const nr = pos.row + opp.dr, nc = pos.col + opp.dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        newGrid[nr][nc].lines[opp.nSide] = value
      }
      return newGrid
    })
  }, [setGrid, setGridWithUndo])

  const resetGrid = useCallback((rows: number, cols: number) => {
    undoStack.current = []
    setGrid(createEmptyGrid(rows, cols))
    setSelection([])
  }, [])

  const makeEmptyCell = useCallback((): CellData => ({
    value: null, notes: [], fixedValue: null, fixedColor: null,
    borders: [0,0,0,0], fixedBorders: [0,0,0,0], color: null, labels: {},
    crossed: false, mark: null, fixedMark: null,
    fixedEdgeMarks: [null,null,null,null], fixedVertexMarks: [null,null,null,null],
    edgeCrosses: [false,false,false,false], lines: [false,false,false,false], selected: false, image: null,
    fixedTexture: null,
  }), [])

  const addRow = useCallback((side: 'top' | 'bottom') => {
    setGridWithUndo(prev => {
      const cols = prev[0]?.length ?? 0
      const newRow = Array.from({ length: cols }, makeEmptyCell)
      return side === 'top' ? [newRow, ...prev] : [...prev, newRow]
    })
  }, [setGridWithUndo, makeEmptyCell])

  const addCol = useCallback((side: 'left' | 'right') => {
    setGridWithUndo(prev => prev.map(row =>
      side === 'left' ? [makeEmptyCell(), ...row] : [...row, makeEmptyCell()]
    ))
  }, [setGridWithUndo, makeEmptyCell])

  const removeRow = useCallback((side: 'top' | 'bottom') => {
    setGridWithUndo(prev => {
      if (prev.length <= 1) return prev
      return side === 'top' ? prev.slice(1) : prev.slice(0, -1)
    })
  }, [setGridWithUndo])

  const removeCol = useCallback((side: 'left' | 'right') => {
    setGridWithUndo(prev => {
      if ((prev[0]?.length ?? 0) <= 1) return prev
      return prev.map(row => side === 'left' ? row.slice(1) : row.slice(0, -1))
    })
  }, [setGridWithUndo])

  return {
    grid,
    setGrid,
    setGridWithUndo,
    selection,
    setSelection,
    inputMode,
    setInputMode,
    activeColor,
    setActiveColor,
    activeMark,
    setActiveMark,
    clearSelection,
    commitSelection,
    onDragChange,
    applyValue,
    applyColor,
    eraseColor,
    applyFixedValue,
    applyFixedColor,
    addNote,
    applyLabel,
    removeLabel,
    toggleCross,
    toggleMark,
    eraseMark,
    toggleFixedMark,
    applyFixedTexture,
    removeFixedTexture,
    activeTexture,
    setActiveTexture,
    applyImage,
    removeImage,
    clearValues,
    applyBorders,
    commitEdges,
    commitFixedEdges,
    toggleEdgeCross,
    toggleLine,
    resetGrid,
    addRow,
    addCol,
    removeRow,
    removeCol,
    setAutoCrossRules,
    setPuzzleType,
    setIsEditor,
    undo,
    redo,
    undoStackLength: () => undoStack.current.length,
    gridRef,
  }
}
