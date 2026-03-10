import { CellData, PuzzleData, MarkShape } from '../types'

interface SavedCell {
  row: number
  col: number
  value?: string
  notes?: string[]
  color?: string
  crossed?: boolean
  mark?: MarkShape
  borders?: [number, number, number, number]
  edgeCrosses?: [boolean, boolean, boolean, boolean]
  lines?: [boolean, boolean, boolean, boolean]
}

interface PlayerSaveData {
  cells: SavedCell[]
  struckRules: string[]
  struckClues: string[]
  struckSpecialRules?: string[]
  elapsedMs?: number
  revealedFogGroups?: string[]
  puzzleFingerprint?: string
}

const STORAGE_PREFIX = '4color:play:'

/** Simple fingerprint of the puzzle definition — if this changes, saved progress is invalid */
export function puzzleFingerprint(puzzle: PuzzleData): string {
  const parts = [
    `${puzzle.gridSize.rows}x${puzzle.gridSize.cols}`,
    ...(puzzle.cells || []).map(c =>
      `${c.row},${c.col}:${c.fixedValue || ''}${c.fixedColor || ''}${c.borders?.join('') || ''}`
    ),
    (puzzle.fogGroups || []).length.toString(),
  ]
  // Simple hash — not crypto, just enough to detect changes
  let h = 0
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

export function savePlayerData(
  puzzleId: string,
  grid: CellData[][],
  struckRules: Set<string>,
  struckClues: Set<string>,
  struckSpecialRules?: Set<string>,
  elapsedMs?: number,
  revealedFogGroups?: Set<string>,
  fingerprint?: string,
) {
  const cells: SavedCell[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      const hasUserBorders = cell.borders.some((b, i) => b !== cell.fixedBorders[i])
      const hasEdgeCrosses = cell.edgeCrosses.some(x => x)
      const hasLines = cell.lines.some(l => l)
      const hasInput = cell.value || cell.notes.length > 0 || cell.color || cell.crossed || cell.mark || hasUserBorders || hasEdgeCrosses || hasLines
      if (!hasInput) continue
      const entry: SavedCell = { row: r, col: c }
      if (cell.value) entry.value = cell.value
      if (cell.notes.length > 0) entry.notes = cell.notes
      if (cell.color) entry.color = cell.color
      if (cell.crossed) entry.crossed = cell.crossed
      if (cell.mark) entry.mark = cell.mark
      if (hasUserBorders) entry.borders = [...cell.borders] as [number, number, number, number]
      if (hasEdgeCrosses) entry.edgeCrosses = [...cell.edgeCrosses] as [boolean, boolean, boolean, boolean]
      if (hasLines) entry.lines = [...cell.lines] as [boolean, boolean, boolean, boolean]
      cells.push(entry)
    }
  }
  const data: PlayerSaveData = {
    cells,
    struckRules: Array.from(struckRules),
    struckClues: Array.from(struckClues),
    struckSpecialRules: struckSpecialRules ? Array.from(struckSpecialRules) : undefined,
    elapsedMs,
    revealedFogGroups: revealedFogGroups?.size ? Array.from(revealedFogGroups) : undefined,
    puzzleFingerprint: fingerprint,
  }
  try {
    const json = JSON.stringify(data)
    localStorage.setItem(STORAGE_PREFIX + puzzleId, json)
    if (import.meta.env.DEV) {
      console.debug(`[save] ${puzzleId}: ${data.cells.length} cells, fog=${data.revealedFogGroups?.length || 0}, fp=${data.puzzleFingerprint}`)
    }
  } catch { /* quota exceeded — silently fail */ }
}

export function loadPlayerData(puzzleId: string, expectedFingerprint?: string): PlayerSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + puzzleId)
    if (!raw) return null
    const data: PlayerSaveData = JSON.parse(raw)
    // Discard stale saves: if puzzle has a fingerprint but saved data doesn't match
    // (either missing fingerprint from old save or different fingerprint from puzzle edit)
    if (expectedFingerprint && data.puzzleFingerprint !== expectedFingerprint) {
      if (import.meta.env.DEV) {
        console.warn(`[load] ${puzzleId}: discarded stale save (fp=${data.puzzleFingerprint} vs expected=${expectedFingerprint})`)
      }
      localStorage.removeItem(STORAGE_PREFIX + puzzleId)
      return null
    }
    if (import.meta.env.DEV) {
      console.debug(`[load] ${puzzleId}: restored ${data.cells.length} cells, fog=${data.revealedFogGroups?.length || 0}, fp=${data.puzzleFingerprint}`)
    }
    return data
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
    if (saved.borders) cell.borders = [...saved.borders] as [number, number, number, number]
    if (saved.edgeCrosses) cell.edgeCrosses = [...saved.edgeCrosses] as [boolean, boolean, boolean, boolean]
    if (saved.lines) cell.lines = [...saved.lines] as [boolean, boolean, boolean, boolean]
  }
  return newGrid
}
