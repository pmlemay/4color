import { CellData, PuzzleData, PuzzleCellData, PuzzleIndexEntry } from '../types'

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
      label: null,
      crossed: false,
      mark: null,
      selected: false,
      image: null,
    }))
  )
}

export function gridToPuzzle(
  grid: CellData[][],
  meta: { id: string; title: string; author: string; rules: string[]; clues: string[]; difficulty: string }
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
      if (cell.fixedValue || cell.fixedColor || cell.color || hasBorders || cell.label || cell.crossed || cell.mark || cell.image) {
        const entry: PuzzleCellData = { row: r, col: c }
        if (cell.fixedValue) entry.fixedValue = cell.fixedValue
        if (cell.fixedColor) entry.fixedColor = cell.fixedColor
        if (cell.color) entry.color = cell.color
        if (hasBorders) entry.borders = cell.borders
        if (cell.label) entry.label = cell.label
        if (cell.crossed) entry.crossed = cell.crossed
        if (cell.mark) entry.mark = cell.mark
        if (cell.image) entry.image = imageToId.get(cell.image)!
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
  return puzzle
}

export function puzzleToGrid(puzzle: PuzzleData): CellData[][] {
  const grid = createEmptyGrid(puzzle.gridSize.rows, puzzle.gridSize.cols)
  const images = puzzle.images || {}
  for (const cell of puzzle.cells) {
    if (cell.fixedValue) grid[cell.row][cell.col].fixedValue = cell.fixedValue
    if (cell.fixedColor) grid[cell.row][cell.col].fixedColor = cell.fixedColor
    if (cell.color) grid[cell.row][cell.col].color = cell.color
    if (cell.borders) {
      grid[cell.row][cell.col].borders = cell.borders
      grid[cell.row][cell.col].fixedBorders = [...cell.borders] as [number, number, number, number]
    }
    if (cell.label) grid[cell.row][cell.col].label = cell.label
    if (cell.crossed) grid[cell.row][cell.col].crossed = cell.crossed
    if (cell.mark) grid[cell.row][cell.col].mark = cell.mark
    if (cell.image) {
      // Resolve image ID to base64, or use directly if it's already base64 (backward compat)
      grid[cell.row][cell.col].image = images[cell.image] ?? cell.image
    }
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
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchPuzzleIndex(): Promise<PuzzleIndexEntry[]> {
  const res = await fetch(`${BASE}puzzles/index.json`)
  if (!res.ok) return []
  return res.json()
}

export async function savePuzzleToServer(puzzle: PuzzleData): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const res = await fetch('/api/save-puzzle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(puzzle),
    })
    return res.json()
  } catch {
    return { ok: false, error: 'Server not available (only works in dev mode)' }
  }
}

export async function fetchPuzzle(id: string): Promise<PuzzleData | null> {
  // Look up the actual filename from the index (id may differ from filename)
  const index = await fetchPuzzleIndex()
  const entry = index.find(e => e.id === id)
  const file = entry?.file ?? `${id}.json`
  const res = await fetch(`${BASE}puzzles/${file}`)
  if (!res.ok) return null
  return res.json()
}
