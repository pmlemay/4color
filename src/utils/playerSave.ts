import { CellData, MarkShape } from '../types'

interface SavedCell {
  row: number
  col: number
  value?: string
  notes?: string[]
  color?: string
  crossed?: boolean
  mark?: MarkShape
}

interface PlayerSaveData {
  cells: SavedCell[]
  struckRules: string[]
  struckClues: string[]
}

const STORAGE_PREFIX = '4color:play:'

export function savePlayerData(
  puzzleId: string,
  grid: CellData[][],
  struckRules: Set<string>,
  struckClues: Set<string>,
) {
  const cells: SavedCell[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      const hasInput = cell.value || cell.notes.length > 0 || cell.color || cell.crossed || cell.mark
      if (!hasInput) continue
      const entry: SavedCell = { row: r, col: c }
      if (cell.value) entry.value = cell.value
      if (cell.notes.length > 0) entry.notes = cell.notes
      if (cell.color) entry.color = cell.color
      if (cell.crossed) entry.crossed = cell.crossed
      if (cell.mark) entry.mark = cell.mark
      cells.push(entry)
    }
  }
  const data: PlayerSaveData = {
    cells,
    struckRules: Array.from(struckRules),
    struckClues: Array.from(struckClues),
  }
  try {
    localStorage.setItem(STORAGE_PREFIX + puzzleId, JSON.stringify(data))
  } catch { /* quota exceeded — silently fail */ }
}

export function loadPlayerData(puzzleId: string): PlayerSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + puzzleId)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearPlayerData(puzzleId: string) {
  localStorage.removeItem(STORAGE_PREFIX + puzzleId)
}

export function applyPlayerData(grid: CellData[][], data: PlayerSaveData): CellData[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell, notes: [...cell.notes] })))
  for (const saved of data.cells) {
    const cell = newGrid[saved.row]?.[saved.col]
    if (!cell) continue
    if (saved.value) cell.value = saved.value
    if (saved.notes) cell.notes = saved.notes
    if (saved.color) cell.color = saved.color
    if (saved.crossed) cell.crossed = saved.crossed
    if (saved.mark) cell.mark = saved.mark
  }
  return newGrid
}
