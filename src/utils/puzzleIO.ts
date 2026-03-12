import { CellData, PuzzleData, PuzzleCellData, PuzzleIndexEntry, PuzzleSolution, AutoCrossRule, MarkShape, FogGroup, CellTexture } from '../types'

const BASE = import.meta.env.BASE_URL

export function createEmptyGrid(rows: number, cols: number): CellData[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      value: null,
      notes: [],
      fixedValue: null,
      fixedColor: null,
      borders: [0, 0, 0, 0] as [number, number, number, number],
      fixedBorders: [0, 0, 0, 0] as [number, number, number, number],
      color: null,
      labels: {},
      crossed: false,
      mark: null,
      fixedMark: null,
      fixedEdgeMarks: [null, null, null, null] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
      fixedVertexMarks: [null, null, null, null] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null],
      edgeCrosses: [false, false, false, false] as [boolean, boolean, boolean, boolean],
      lines: [false, false, false, false] as [boolean, boolean, boolean, boolean],
      selected: false,
      image: null,
      fixedTexture: null,
    }))
  )
}

export function gridToPuzzle(
  grid: CellData[][],
  meta: { id: string; title: string; authors: string[]; rules: string[]; clues: string[]; specialRules?: string[]; difficulty: string; tags: string[]; autoCrossRules?: AutoCrossRule[]; puzzleType?: string; clickActionLeft?: string; clickActionRight?: string; fogGroups?: FogGroup[]; inProgress?: boolean }
): PuzzleData {
  // Build deduplicated image map: base64 → id
  const imageToId = new Map<string, string>()
  let imgCounter = 0
  for (const row of grid) {
    for (const cell of row) {
      if (cell.image && !imageToId.has(cell.image)) {
        imageToId.set(cell.image, `img${imgCounter++}`)
      }
    }
  }

  const cells: PuzzleCellData[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      const hasBorders = cell.borders.some(b => b > 0)
      const hasFixedEdgeMarks = cell.fixedEdgeMarks.some(m => m !== null)
      const hasFixedVertexMarks = cell.fixedVertexMarks.some(m => m !== null)
      const hasLabels = Object.values(cell.labels).some(l => l?.text)
      if (cell.fixedValue || cell.fixedColor || hasBorders || hasLabels || cell.fixedMark || hasFixedEdgeMarks || hasFixedVertexMarks || cell.image || cell.fixedTexture) {
        const entry: PuzzleCellData = { row: r, col: c }
        if (cell.fixedValue) entry.fixedValue = cell.fixedValue
        if (cell.fixedColor) entry.fixedColor = cell.fixedColor
        if (hasBorders) entry.borders = cell.borders
        if (hasLabels) entry.labels = cell.labels
        if (cell.fixedMark) entry.fixedMark = cell.fixedMark
        if (hasFixedEdgeMarks) entry.fixedEdgeMarks = cell.fixedEdgeMarks
        if (hasFixedVertexMarks) entry.fixedVertexMarks = cell.fixedVertexMarks
        if (cell.image) entry.image = imageToId.get(cell.image)!
        if (cell.fixedTexture) entry.fixedTexture = cell.fixedTexture
        cells.push(entry)
      }
    }
  }

  const images: Record<string, string> = {}
  for (const [base64, id] of imageToId) {
    images[id] = base64
  }

  const puzzle: PuzzleData = {
    ...meta,
    gridSize: { rows: grid.length, cols: grid[0].length },
    cells,
    rules: meta.rules,
    clues: meta.clues,
    createdAt: new Date().toISOString().split('T')[0],
  }
  if (Object.keys(images).length > 0) puzzle.images = images
  if (meta.specialRules?.length) puzzle.specialRules = meta.specialRules
  if (meta.autoCrossRules?.length) puzzle.autoCrossRules = meta.autoCrossRules
  if (meta.puzzleType) puzzle.puzzleType = meta.puzzleType
  if (meta.clickActionLeft) puzzle.clickActionLeft = meta.clickActionLeft
  if (meta.clickActionRight) puzzle.clickActionRight = meta.clickActionRight
  if (meta.fogGroups?.length) puzzle.fogGroups = meta.fogGroups
  if (meta.inProgress) puzzle.inProgress = true
  return puzzle
}

export function puzzleToGrid(puzzle: PuzzleData): CellData[][] {
  const grid = createEmptyGrid(puzzle.gridSize.rows, puzzle.gridSize.cols)
  const images = puzzle.images || {}
  for (const cell of puzzle.cells) {
    if (cell.fixedValue) grid[cell.row][cell.col].fixedValue = cell.fixedValue
    if (cell.fixedColor) grid[cell.row][cell.col].fixedColor = cell.fixedColor
    if (cell.borders) {
      grid[cell.row][cell.col].borders = cell.borders
      grid[cell.row][cell.col].fixedBorders = [...cell.borders] as [number, number, number, number]
    }
    if (cell.labels) {
      grid[cell.row][cell.col].labels = cell.labels
    } else if (cell.label) {
      // Backward compat: old format had single label with align
      const { text, showThroughFog, revealWithFog } = cell.label
      const align = (cell.label as any).align || 'top'
      grid[cell.row][cell.col].labels = { [align]: { text, showThroughFog, revealWithFog } }
    }
    if (cell.fixedMark) grid[cell.row][cell.col].fixedMark = cell.fixedMark
    if (cell.fixedEdgeMarks) grid[cell.row][cell.col].fixedEdgeMarks = [...cell.fixedEdgeMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null]
    if (cell.fixedVertexMarks) grid[cell.row][cell.col].fixedVertexMarks = [...cell.fixedVertexMarks] as [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null]
    if (cell.image) {
      // Resolve image ID to base64, or use directly if it's already base64 (backward compat)
      grid[cell.row][cell.col].image = images[cell.image] ?? cell.image
    }
    if (cell.fixedTexture) grid[cell.row][cell.col].fixedTexture = { ...cell.fixedTexture }
  }
  return grid
}

export function downloadPuzzleJSON(puzzle: PuzzleData) {
  const json = JSON.stringify(puzzle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${puzzle.id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function fetchPuzzleIndex(): Promise<PuzzleIndexEntry[]> {
  const res = await fetch(`${BASE}puzzles/index.json`)
  if (!res.ok) return []
  return res.json()
}

export async function saveSolutionToServer(solution: PuzzleSolution): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const res = await fetch('/api/save-solution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solution),
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server not available (only works in dev mode)' }
  }
}

export function downloadSolutionJSON(solution: PuzzleSolution) {
  const json = JSON.stringify(solution, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${solution.id}-solution.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function savePuzzleToServer(puzzle: PuzzleData): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const res = await fetch('/api/save-puzzle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(puzzle),
    })
    const text = await res.text()
    if (!text) return { ok: false, error: `Server returned empty response (status ${res.status})` }
    try { return JSON.parse(text) } catch { return { ok: false, error: `Invalid JSON from server: ${text.slice(0, 200)}` } }
  } catch {
    return { ok: false, error: 'Server not available (only works in dev mode)' }
  }
}

export async function fetchPuzzleSolution(id: string): Promise<PuzzleSolution | null> {
  try {
    const res = await fetch(`${BASE}puzzles/solutions/${id}-solution.json`)
    if (!res.ok) return null
    const text = await res.text()
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Default click actions for each puzzle type */
export const PUZZLE_TYPE_DEFAULTS: Record<string, { left: string; right: string }> = {
  nurikabe: { left: 'color:9', right: 'mark:dot' },
  heyawake: { left: 'color:9', right: 'color:5' },
  starbattle: { left: 'mark:star', right: 'cross' },
}

/** Migrate legacy forcedInputLayout to puzzleType + click actions */
export function migratePuzzleType(puzzle: PuzzleData): void {
  if (!puzzle.puzzleType && puzzle.forcedInputLayout) {
    puzzle.puzzleType = puzzle.forcedInputLayout
    const defaults = PUZZLE_TYPE_DEFAULTS[puzzle.forcedInputLayout]
    if (defaults) {
      if (!puzzle.clickActionLeft) puzzle.clickActionLeft = defaults.left
      if (!puzzle.clickActionRight) puzzle.clickActionRight = defaults.right
    }
  }
}

export async function fetchPuzzle(id: string): Promise<PuzzleData | null> {
  // Look up the actual filename from the index (id may differ from filename)
  const index = await fetchPuzzleIndex()
  const entry = index.find(e => e.id === id)
  const file = entry?.file ?? `${id}.json`
  const res = await fetch(`${BASE}puzzles/${file}`)
  if (!res.ok) return null
  const puzzle: PuzzleData = await res.json()
  migratePuzzleType(puzzle)
  return puzzle
}
