import { CellPosition, MarkShape } from '../types'

const MARGIN = 15 // px outside the grid that still registers

/**
 * Find the nearest cell in a table given client coordinates.
 * First tries elementFromPoint (exact hit). If that misses (clicking
 * slightly outside the grid), falls back to clamping to the nearest
 * boundary cell within MARGIN px.
 */
export function getNearestCell(
  x: number,
  y: number,
  tableEl: HTMLTableElement,
): { td: HTMLTableCellElement; row: number; col: number } | null {
  // Try exact hit first
  let target = document.elementFromPoint(x, y) as HTMLElement | null
  while (target && target.tagName !== 'TD') {
    target = target.parentElement
  }
  if (target && target.tagName === 'TD') {
    const td = target as HTMLTableCellElement
    const row = (td.parentElement as HTMLTableRowElement)?.rowIndex
    const col = td.cellIndex
    if (row != null && col != null && row >= 0 && col >= 0) {
      return { td, row, col }
    }
  }

  // Fallback: clamp to nearest boundary cell
  const rect = tableEl.getBoundingClientRect()
  if (
    x < rect.left - MARGIN || x > rect.right + MARGIN ||
    y < rect.top - MARGIN || y > rect.bottom + MARGIN
  ) {
    return null // too far away
  }

  const rows = tableEl.rows
  if (!rows.length) return null

  // Find nearest row
  let bestRow = 0
  let bestRowDist = Infinity
  for (let r = 0; r < rows.length; r++) {
    const rowRect = rows[r].getBoundingClientRect()
    const cy = (rowRect.top + rowRect.bottom) / 2
    const dist = Math.abs(y - cy)
    if (dist < bestRowDist) {
      bestRowDist = dist
      bestRow = r
    }
  }

  // Find nearest col in that row
  const cells = rows[bestRow].cells
  let bestCol = 0
  let bestColDist = Infinity
  for (let c = 0; c < cells.length; c++) {
    const cellRect = cells[c].getBoundingClientRect()
    const cx = (cellRect.left + cellRect.right) / 2
    const dist = Math.abs(x - cx)
    if (dist < bestColDist) {
      bestColDist = dist
      bestCol = c
    }
  }

  const td = cells[bestCol]
  return { td, row: bestRow, col: bestCol }
}

/**
 * Get a CellPosition from client coordinates, with fallback for near-misses.
 */
export function getCellPositionFromPoint(
  x: number,
  y: number,
  tableEl: HTMLTableElement,
): CellPosition | null {
  const result = getNearestCell(x, y, tableEl)
  return result ? { row: result.row, col: result.col } : null
}

/**
 * Like getNearestCell but also returns virtual cells one step outside the grid.
 * Returns row/col that may be -1 or rows/cols (one beyond boundary).
 */
export function getVirtualCell(
  x: number,
  y: number,
  tableEl: HTMLTableElement,
): { row: number; col: number } | null {
  // Check if we're within one cell-width outside the grid
  const rect = tableEl.getBoundingClientRect()
  const rows = tableEl.rows
  if (!rows.length || !rows[0].cells.length) return null
  const cellW = rows[0].cells[0].getBoundingClientRect().width
  const cellH = rows[0].cells[0].getBoundingClientRect().height
  const totalRows = rows.length
  const totalCols = rows[0].cells.length

  // Expanded bounds: one cell outside each side
  if (
    x < rect.left - cellW || x > rect.right + cellW ||
    y < rect.top - cellH || y > rect.bottom + cellH
  ) return null

  // Determine virtual row
  let vRow: number
  if (y < rect.top) vRow = -1
  else if (y > rect.bottom) vRow = totalRows
  else {
    // Find real row
    vRow = 0
    let bestDist = Infinity
    for (let r = 0; r < totalRows; r++) {
      const rr = rows[r].getBoundingClientRect()
      const cy = (rr.top + rr.bottom) / 2
      const d = Math.abs(y - cy)
      if (d < bestDist) { bestDist = d; vRow = r }
    }
  }

  // Determine virtual col
  let vCol: number
  if (x < rect.left) vCol = -1
  else if (x > rect.right) vCol = totalCols
  else {
    vCol = 0
    let bestDist = Infinity
    const cells = rows[Math.max(0, Math.min(vRow, totalRows - 1))].cells
    for (let c = 0; c < cells.length; c++) {
      const cr = cells[c].getBoundingClientRect()
      const cx = (cr.left + cr.right) / 2
      const d = Math.abs(x - cx)
      if (d < bestDist) { bestDist = d; vCol = c }
    }
  }

  // Must have at least one virtual dimension
  if (vRow >= 0 && vRow < totalRows && vCol >= 0 && vCol < totalCols) return null
  return { row: vRow, col: vCol }
}

export type MarkTarget =
  | { type: 'center'; row: number; col: number }
  | { type: 'edge'; row: number; col: number; side: 0 | 1 | 2 | 3 }
  | { type: 'vertex'; row: number; col: number; corner: 0 | 1 | 2 | 3 }

const ZONE = 0.25

/**
 * Detect whether a click targets the center, an edge midpoint, or a corner vertex
 * of a cell. Returns null if the click is outside the grid.
 */
export function detectMarkTarget(
  clientX: number,
  clientY: number,
  tableEl: HTMLTableElement,
): MarkTarget | null {
  const hit = getNearestCell(clientX, clientY, tableEl)
  if (!hit) return null

  const rect = hit.td.getBoundingClientRect()
  const fx = (clientX - rect.left) / rect.width   // 0..1 fraction within cell
  const fy = (clientY - rect.top) / rect.height

  const nearLeft = fx < ZONE
  const nearRight = fx > 1 - ZONE
  const nearTop = fy < ZONE
  const nearBottom = fy > 1 - ZONE

  // Corner zones (both axes near an edge)
  if (nearTop && nearLeft) return { type: 'vertex', row: hit.row, col: hit.col, corner: 0 }   // TL
  if (nearTop && nearRight) return { type: 'vertex', row: hit.row, col: hit.col, corner: 1 }  // TR
  if (nearBottom && nearRight) return { type: 'vertex', row: hit.row, col: hit.col, corner: 2 } // BR
  if (nearBottom && nearLeft) return { type: 'vertex', row: hit.row, col: hit.col, corner: 3 }  // BL

  // Edge zones (one axis near an edge)
  if (nearTop) return { type: 'edge', row: hit.row, col: hit.col, side: 0 }    // top
  if (nearRight) return { type: 'edge', row: hit.row, col: hit.col, side: 1 }  // right
  if (nearBottom) return { type: 'edge', row: hit.row, col: hit.col, side: 2 } // bottom
  if (nearLeft) return { type: 'edge', row: hit.row, col: hit.col, side: 3 }   // left

  // Center
  return { type: 'center', row: hit.row, col: hit.col }
}
