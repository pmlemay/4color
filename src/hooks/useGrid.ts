import { useState, useCallback, useRef } from 'react'
import { CellData, CellPosition, InputMode, LabelAlign, MarkShape, AutoCrossRule } from '../types'
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
  })))
}

export function useGrid(initialRows: number, initialCols: number) {
  const [grid, setGrid] = useState<CellData[][]>(() =>
    createEmptyGrid(initialRows, initialCols)
  )
  // Ref mirror of grid state — always up-to-date after each render.
  // Used by undo/redo to read current state without side effects inside updaters.
  const gridRef = useRef(grid)
  gridRef.current = grid

  const [selection, setSelection] = useState<CellPosition[]>([])
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
  const autoCrossRulesRef = useRef<AutoCrossRule[]>([])

  const setAutoCrossRules = useCallback((rules: AutoCrossRule[]) => {
    autoCrossRulesRef.current = rules
  }, [])

  const setInputMode = useCallback((mode: InputMode) => {
    setInputModeRaw(mode)
    if (mode !== 'color' && mode !== 'fixedColor') {
      setActiveColor(null)
    }
    if (mode !== 'mark') {
      setActiveMark(null)
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

  const clearSelection = useCallback(() => {
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
        const needsUpdate = sel.some(pos => prev[pos.row][pos.col][field] !== targetValue)
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of sel) {
          newGrid[pos.row][pos.col][field] = targetValue
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
        const eligible = sel.filter(pos => !prev[pos.row][pos.col].value && !prev[pos.row][pos.col].fixedValue && !prev[pos.row][pos.col].mark)
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
        const eligible = sel.filter(pos => !prev[pos.row][pos.col].crossed && !prev[pos.row][pos.col].value && !prev[pos.row][pos.col].fixedValue && prev[pos.row][pos.col].notes.length === 0)
        const needsUpdate = eligible.some(pos => prev[pos.row][pos.col].mark !== targetValue)
        if (!needsUpdate) return prev
        const newGrid = cloneGrid(prev)
        for (const pos of eligible) {
          newGrid[pos.row][pos.col].mark = targetValue
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
          // Determine if we're removing: check if first cell has user borders in base grid
          const firstCell = borderDragBase.current[sel[0].row][sel[0].col]
          borderDragRemoving.current = firstCell.borders.some((b, i) => b > 0 && firstCell.fixedBorders[i] === 0)
        }
        // Always recalculate from the base snapshot
        const base = borderDragBase.current
        if (borderDragRemoving.current) {
          // Remove user borders from selected cells
          const newGrid = cloneGrid(base)
          for (const pos of sel) {
            const fixed = newGrid[pos.row][pos.col].fixedBorders
            newGrid[pos.row][pos.col].borders = [...fixed] as [number, number, number, number]
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
  }, [inputMode, activeColor, activeMark])

  const commitSelection = useCallback((sel: CellPosition[]) => {
    // Color mode with active color: already applied live, reset flag
    if ((inputMode === 'color' || inputMode === 'fixedColor') && activeColor !== null) {
      colorDragActive.current = false
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
    if (inputMode === 'border') {
      borderDragBase.current = null
      return
    }
    // Normal modes: commit selection highlight
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
  }, [inputMode, activeColor, activeMark, setGridWithUndo])

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
            if (!cell.value && !cell.fixedValue && !cell.mark) {
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
    (text: string, align: LabelAlign) => {
      if (selection.length === 0) return
      const pos = selection[0]
      setGridWithUndo(prev => {
        const newGrid = cloneGrid(prev)
        const cell = newGrid[pos.row][pos.col]
        if (cell.label?.text === text && cell.label?.align === align) {
          cell.label = null
        } else {
          cell.label = { text, align }
        }
        return newGrid
      })
    },
    [selection, setGridWithUndo]
  )

  const removeLabel = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      for (const pos of selection) {
        newGrid[pos.row][pos.col].label = null
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const toggleCross = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      const newGrid = cloneGrid(prev)
      const eligible = selection.filter(pos => !newGrid[pos.row][pos.col].value && !newGrid[pos.row][pos.col].fixedValue && !newGrid[pos.row][pos.col].mark)
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
      const eligible = selection.filter(pos => !newGrid[pos.row][pos.col].crossed && !newGrid[pos.row][pos.col].value && !newGrid[pos.row][pos.col].fixedValue && newGrid[pos.row][pos.col].notes.length === 0)
      if (eligible.length === 0) return prev
      const allHaveMark = eligible.every(pos => newGrid[pos.row][pos.col].mark === shape)
      for (const pos of eligible) {
        newGrid[pos.row][pos.col].mark = allHaveMark ? null : shape
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
        cell.borders = [...cell.fixedBorders] as [number, number, number, number]
      }
      return newGrid
    })
  }, [selection, setGridWithUndo])

  const applyBorders = useCallback(() => {
    if (selection.length === 0) return
    setGridWithUndo(prev => {
      // Check if any selected cell has non-fixed borders (user-added borders)
      const selectionHasUserBorders = selection.some(pos => {
        const cell = prev[pos.row][pos.col]
        return cell.borders.some((b, i) => b > 0 && cell.fixedBorders[i] === 0)
      })
      if (selectionHasUserBorders) {
        // Remove only user-added borders, keep fixed borders
        const newGrid = cloneGrid(prev)
        for (const pos of selection) {
          const fixed = newGrid[pos.row][pos.col].fixedBorders
          newGrid[pos.row][pos.col].borders = [...fixed] as [number, number, number, number]
        }
        return newGrid
      } else {
        return applyBordersToSelection(prev, selection)
      }
    })
  }, [selection, setGridWithUndo])

  const resetGrid = useCallback((rows: number, cols: number) => {
    undoStack.current = []
    setGrid(createEmptyGrid(rows, cols))
    setSelection([])
  }, [])

  return {
    grid,
    setGrid,
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
    applyImage,
    removeImage,
    clearValues,
    applyBorders,
    resetGrid,
    setAutoCrossRules,
    undo,
    redo,
  }
}
