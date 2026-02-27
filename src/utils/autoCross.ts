import { CellPosition, AutoCrossRule } from '../types'

export function getRookTargets(row: number, col: number, rows: number, cols: number): CellPosition[] {
  const targets: CellPosition[] = []
  for (let r = 0; r < rows; r++) {
    if (r !== row) targets.push({ row: r, col })
  }
  for (let c = 0; c < cols; c++) {
    if (c !== col) targets.push({ row, col: c })
  }
  return targets
}

export function getBishopTargets(row: number, col: number, rows: number, cols: number): CellPosition[] {
  const targets: CellPosition[] = []
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  for (const [dr, dc] of directions) {
    let r = row + dr, c = col + dc
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      targets.push({ row: r, col: c })
      r += dr
      c += dc
    }
  }
  return targets
}

export function getKingTargets(row: number, col: number, rows: number, cols: number): CellPosition[] {
  const targets: CellPosition[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const r = row + dr, c = col + dc
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        targets.push({ row: r, col: c })
      }
    }
  }
  return targets
}

export function getKnightTargets(row: number, col: number, rows: number, cols: number): CellPosition[] {
  const targets: CellPosition[] = []
  const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
  for (const [dr, dc] of offsets) {
    const r = row + dr, c = col + dc
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      targets.push({ row: r, col: c })
    }
  }
  return targets
}

export function getAutoCrossTargets(
  sourceCells: CellPosition[],
  rules: AutoCrossRule[],
  rows: number,
  cols: number
): CellPosition[] {
  if (rules.length === 0) return []

  const expanded = new Set<AutoCrossRule>(rules)
  const seen = new Set<string>()
  const targets: CellPosition[] = []

  // Exclude source cells themselves
  for (const src of sourceCells) {
    seen.add(`${src.row},${src.col}`)
  }

  for (const src of sourceCells) {
    const cellTargets: CellPosition[] = []
    if (expanded.has('rook')) cellTargets.push(...getRookTargets(src.row, src.col, rows, cols))
    if (expanded.has('bishop')) cellTargets.push(...getBishopTargets(src.row, src.col, rows, cols))
    if (expanded.has('king')) cellTargets.push(...getKingTargets(src.row, src.col, rows, cols))
    if (expanded.has('knight')) cellTargets.push(...getKnightTargets(src.row, src.col, rows, cols))

    for (const t of cellTargets) {
      const key = `${t.row},${t.col}`
      if (!seen.has(key)) {
        seen.add(key)
        targets.push(t)
      }
    }
  }

  return targets
}
