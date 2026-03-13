import { CellData, CellPosition, MarkShape, AutoCrossRule } from '../types'
import { getAutoCrossTargets } from './autoCross'

const ARROW_EDGE: Record<string, 0 | 1 | 2 | 3> = {
  arrowLeft: 0, arrowUp: 1, arrowRight: 2, arrowDown: 3,
}
const FIXED_CENTER_MARKS = new Set(['dashV', 'dashH'])

/** Check whether a cell currently matches a given click-action */
export function cellMatchesAction(cell: CellData, action: string): boolean {
  if (action.startsWith('color:')) return cell.color === action.split(':')[1]
  if (action.startsWith('mark:')) {
    const markVal = action.split(':')[1]
    const side = ARROW_EDGE[markVal]
    if (side !== undefined) return cell.fixedEdgeMarks[side] === markVal
    if (FIXED_CENTER_MARKS.has(markVal)) return cell.fixedMark === markVal
    return cell.mark === markVal
  }
  if (action === 'cross') return cell.crossed
  return false
}

/**
 * Check if an action can be applied to a cell.
 * Mirrors the same eligibility rules used by native input modes in useGrid.
 */
export function canApplyAction(cell: CellData, action: string): boolean {
  if (action === 'cross') {
    // Same as toggleCross / cross drag eligibility in useGrid
    return !cell.value && !cell.fixedValue && !cell.mark && !cell.fixedMark
  }
  if (action.startsWith('mark:')) {
    // Same as toggleMark / mark drag eligibility in useGrid
    return !cell.crossed && !cell.value && !cell.fixedValue
  }
  // color actions have no eligibility restrictions in native mode
  return true
}

/** Toggle a click-action on a single cell — mirrors native mode behavior (no side-effects on other state) */
export function toggleActionOnCell(cell: CellData, action: string): void {
  if (!canApplyAction(cell, action)) return
  if (action.startsWith('color:')) {
    const colorVal = action.split(':')[1]
    cell.color = cell.color === colorVal ? null : colorVal
  } else if (action.startsWith('mark:')) {
    const markVal = action.split(':')[1] as MarkShape
    const side = ARROW_EDGE[markVal]
    if (side !== undefined) {
      cell.fixedEdgeMarks[side] = cell.fixedEdgeMarks[side] === markVal ? null : markVal
    } else if (FIXED_CENTER_MARKS.has(markVal)) {
      cell.fixedMark = cell.fixedMark === markVal ? null : markVal
    } else {
      cell.mark = cell.mark === markVal ? null : markVal
    }
  } else if (action === 'cross') {
    cell.crossed = !cell.crossed
  }
}

/** Force-apply an action (always ON) — only sets the relevant field, doesn't clear others */
export function forceApplyActionOnCell(cell: CellData, action: string): void {
  if (!canApplyAction(cell, action)) return
  if (action.startsWith('color:')) {
    cell.color = action.split(':')[1]
  } else if (action.startsWith('mark:')) {
    const markVal = action.split(':')[1] as MarkShape
    const side = ARROW_EDGE[markVal]
    if (side !== undefined) {
      cell.fixedEdgeMarks[side] = markVal
    } else if (FIXED_CENTER_MARKS.has(markVal)) {
      cell.fixedMark = markVal
    } else {
      cell.mark = markVal
    }
  } else if (action === 'cross') {
    cell.crossed = true
  }
}

/** Force-clear all click-action state on a cell */
export function clearActionOnCell(cell: CellData): void {
  cell.color = null
  cell.mark = null
  cell.crossed = false
}

/**
 * Apply a click action to a grid at a position.
 * - force=true  → always apply (paint mode during drag)
 * - force=false → always clear
 * - force=undefined → toggle (single click / first cell of drag)
 * - autoCrossRules: if provided, auto-cross targets after placing a mark (suggested/forced mode only)
 */
export function applyActionToGrid(
  prev: CellData[][],
  pos: CellPosition,
  action: string,
  force?: boolean,
  autoCrossRules?: AutoCrossRule[],
): CellData[][] {
  const next = prev.map(row => row.map(cell => ({ ...cell })))
  const cell = next[pos.row][pos.col]
  if (force === true) {
    forceApplyActionOnCell(cell, action)
  } else if (force === false) {
    clearActionOnCell(cell)
  } else {
    toggleActionOnCell(cell, action)
  }
  // Auto-cross after placing a mark (mirrors useGrid native mark/value auto-cross)
  const placed = action.startsWith('mark:') ? cell.mark === action.split(':')[1] : false
  if (placed && autoCrossRules && autoCrossRules.length > 0) {
    const rows = next.length
    const cols = next[0].length
    const targets = getAutoCrossTargets([pos], autoCrossRules, rows, cols)
    for (const t of targets) {
      const tc = next[t.row][t.col]
      if (!tc.value && !tc.fixedValue && !tc.mark && !tc.fixedMark) {
        tc.crossed = true
      }
    }
  }
  return next
}
