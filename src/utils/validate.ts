import { CellData, PuzzleSolution } from '../types'

function getEffectiveColor(cell: CellData): string | null {
  return cell.color || cell.fixedColor || null
}

type BorderLookup = (r: number, c: number) => [number, number, number, number]

/**
 * Find connected regions using a border lookup function.
 * A wall exists between two adjacent cells if EITHER side reports a border > 0.
 */
function findRegionsFromBorders(rows: number, cols: number, getBorder: BorderLookup): number[][] {
  const regionMap: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1))
  let regionId = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (regionMap[r][c] !== -1) continue
      const queue: [number, number][] = [[r, c]]
      regionMap[r][c] = regionId
      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!
        const b = getBorder(cr, cc)
        // top — wall if this cell's top > 0 OR neighbor's bottom > 0
        if (cr > 0 && regionMap[cr - 1][cc] === -1 && b[0] === 0 && getBorder(cr - 1, cc)[2] === 0) {
          regionMap[cr - 1][cc] = regionId; queue.push([cr - 1, cc])
        }
        // right
        if (cc < cols - 1 && regionMap[cr][cc + 1] === -1 && b[1] === 0 && getBorder(cr, cc + 1)[3] === 0) {
          regionMap[cr][cc + 1] = regionId; queue.push([cr, cc + 1])
        }
        // bottom
        if (cr < rows - 1 && regionMap[cr + 1][cc] === -1 && b[2] === 0 && getBorder(cr + 1, cc)[0] === 0) {
          regionMap[cr + 1][cc] = regionId; queue.push([cr + 1, cc])
        }
        // left
        if (cc > 0 && regionMap[cr][cc - 1] === -1 && b[3] === 0 && getBorder(cr, cc - 1)[1] === 0) {
          regionMap[cr][cc - 1] = regionId; queue.push([cr, cc - 1])
        }
      }
      regionId++
    }
  }
  return regionMap
}

/** Find connected regions based on fixed borders */
function findRegions(grid: CellData[][]): number[][] {
  return findRegionsFromBorders(grid.length, grid[0].length, (r, c) => grid[r][c].fixedBorders)
}

/**
 * Check if two region maps define the same partitioning (cell groupings match,
 * even if region IDs differ).
 */
function regionsMatch(map1: number[][], map2: number[][]): boolean {
  const rows = map1.length
  const cols = map1[0].length
  const fwd = new Map<number, number>() // map1 region → map2 region
  const rev = new Map<number, number>() // map2 region → map1 region
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = map1[r][c]
      const b = map2[r][c]
      if (fwd.has(a)) { if (fwd.get(a) !== b) return false }
      else fwd.set(a, b)
      if (rev.has(b)) { if (rev.get(b) !== a) return false }
      else rev.set(b, a)
    }
  }
  return true
}

export function validate4Color(grid: CellData[][]): { valid: boolean; error?: string } {
  const rows = grid.length
  const cols = grid[0].length
  const regionMap = findRegions(grid)

  // Collect color per region
  const regionColors = new Map<number, string | null>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rid = regionMap[r][c]
      const color = getEffectiveColor(grid[r][c])
      const existing = regionColors.get(rid)
      if (existing === undefined) {
        regionColors.set(rid, color)
      } else if (existing !== color) {
        if (existing === null || color === null) {
          return { valid: false, error: 'Some regions have uncolored cells.' }
        }
        return { valid: false, error: 'All cells in a region must be the same color.' }
      }
    }
  }

  // Check all regions are colored
  for (const [, color] of regionColors) {
    if (color === null) {
      return { valid: false, error: 'Some regions are not colored.' }
    }
  }

  // Check max 4 colors
  const usedColors = new Set(regionColors.values())
  if (usedColors.size > 4) {
    return { valid: false, error: `Used ${usedColors.size} colors — maximum is 4.` }
  }

  // Check no two adjacent regions share the same color
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rid = regionMap[r][c]
      const color = regionColors.get(rid)!
      // Check right neighbor
      if (c < cols - 1) {
        const nrid = regionMap[r][c + 1]
        if (nrid !== rid && regionColors.get(nrid) === color) {
          return { valid: false, error: 'Two adjacent regions share the same color.' }
        }
      }
      // Check bottom neighbor
      if (r < rows - 1) {
        const nrid = regionMap[r + 1][c]
        if (nrid !== rid && regionColors.get(nrid) === color) {
          return { valid: false, error: 'Two adjacent regions share the same color.' }
        }
      }
    }
  }

  return { valid: true }
}

export function validateSolution(grid: CellData[][], solution: PuzzleSolution): { valid: boolean; error?: string } {
  const total = Object.keys(solution.cells).length

  // Count all normal inputs on the grid (regardless of position/correctness)
  let filled = 0
  const rows = grid.length
  const cols = grid[0].length
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].value) filled++
    }
  }

  // Region-based border check: compare zones formed by expected borders vs player borders.
  // A wall exists if EITHER side of a shared edge has a border, so single-sided and
  // dual-sided solution files both work. The player can also skip redundant interior
  // borders as long as the zones are correctly enclosed.
  let bordersReady = true
  let borderProgress = ''
  if (solution.borders) {
    const solutionBorderLookup: BorderLookup = (r, c) => {
      const key = `${r},${c}`
      if (solution.borders![key]) return solution.borders![key]
      return grid[r][c].fixedBorders
    }
    const playerBorderLookup: BorderLookup = (r, c) => grid[r][c].borders
    const expectedRegions = findRegionsFromBorders(rows, cols, solutionBorderLookup)
    const actualRegions = findRegionsFromBorders(rows, cols, playerBorderLookup)
    if (!regionsMatch(expectedRegions, actualRegions)) {
      bordersReady = false
      borderProgress = 'borders incomplete'
    }
  }

  // Count expected solution colors
  const colorTotal = Object.keys(solution.colors || {}).length
  let colorFilled = 0
  if (colorTotal > 0) {
    for (const [key] of Object.entries(solution.colors!)) {
      const [r, c] = key.split(',').map(Number)
      const cell = grid[r]?.[c]
      if (cell?.color || cell?.fixedColor) colorFilled++
    }
  }

  // Count expected solution marks
  const markTotal = Object.keys(solution.marks || {}).length
  let markFilled = 0
  if (markTotal > 0) {
    for (const [key] of Object.entries(solution.marks!)) {
      const [r, c] = key.split(',').map(Number)
      const cell = grid[r]?.[c]
      if (cell?.mark || cell?.fixedMark) markFilled++
    }
  }

  // Edge-based line validation: extract edges from solution and player grid, compare sets.
  // An edge is a normalized string "r1,c1-r2,c2" representing a line between two adjacent cells.
  // Side mapping: 0=top(dr=-1), 1=right(dc=+1), 2=bottom(dr=+1), 3=left(dc=-1)
  const SIDE_DR = [-1, 0, 1, 0]
  const SIDE_DC = [0, 1, 0, -1]

  function extractEdges(cellLines: Record<string, [boolean, boolean, boolean, boolean]>, fixedGrid?: CellData[][]): Set<string> {
    const edges = new Set<string>()
    for (const [key, sides] of Object.entries(cellLines)) {
      const [r, c] = key.split(',').map(Number)
      for (let i = 0; i < 4; i++) {
        if (!sides[i]) continue
        // Skip fixed lines — only compare player-drawn lines
        if (fixedGrid && fixedGrid[r]?.[c]?.fixedLines[i]) continue
        const nr = r + SIDE_DR[i], nc = c + SIDE_DC[i]
        // Normalize edge key so both cells produce the same string
        const edgeKey = r < nr || (r === nr && c < nc)
          ? `${r},${c}-${nr},${nc}`
          : `${nr},${nc}-${r},${c}`
        edges.add(edgeKey)
      }
    }
    return edges
  }

  // Extract expected edges from solution (skip fixed lines — those are already on the grid)
  const expectedEdges = solution.lines ? extractEdges(solution.lines, grid) : new Set<string>()
  const lineEdgeTotal = expectedEdges.size

  // Extract player edges from grid (only for cells that appear in the solution, plus their neighbors)
  let playerEdges = new Set<string>()
  if (solution.lines) {
    const playerCellLines: Record<string, [boolean, boolean, boolean, boolean]> = {}
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].lines.some((l, i) => l && !grid[r][c].fixedLines[i])) {
          playerCellLines[`${r},${c}`] = grid[r][c].lines
        }
      }
    }
    playerEdges = extractEdges(playerCellLines, grid)
  }

  // Count how many expected edges the player has drawn
  let lineEdgeFilled = 0
  for (const edge of expectedEdges) {
    if (playerEdges.has(edge)) lineEdgeFilled++
  }

  if ((total > 0 && filled !== total) || !bordersReady || colorFilled !== colorTotal || markFilled !== markTotal || lineEdgeFilled !== lineEdgeTotal) {
    const parts: string[] = []
    if (total > 0) parts.push(`${filled}/${total} values`)
    if (borderProgress) parts.push(borderProgress)
    if (colorTotal > 0) parts.push(`${colorFilled}/${colorTotal} colors`)
    if (markTotal > 0) parts.push(`${markFilled}/${markTotal} marks`)
    if (lineEdgeTotal > 0) parts.push(`${lineEdgeFilled}/${lineEdgeTotal} lines`)
    return { valid: false, error: `Not ready: ${parts.join(', ')}.` }
  }

  // Everything filled — now validate correctness
  let wrong = 0

  for (const [key, expected] of Object.entries(solution.cells)) {
    const [r, c] = key.split(',').map(Number)
    const cell = grid[r]?.[c]
    const actual = cell?.value || cell?.fixedValue
    if (!actual || actual.toUpperCase() !== expected.toUpperCase()) wrong++
  }

  // Borders already validated via region comparison above — if we got here, they match

  if (solution.colors) {
    for (const [key, expected] of Object.entries(solution.colors)) {
      const [r, c] = key.split(',').map(Number)
      const cell = grid[r]?.[c]
      const actual = cell?.color || cell?.fixedColor || null
      if (actual !== expected) wrong++
    }
  }

  if (solution.marks) {
    for (const [key, expected] of Object.entries(solution.marks)) {
      const [r, c] = key.split(',').map(Number)
      const cell = grid[r]?.[c]
      const actual = cell?.mark || cell?.fixedMark || null
      if (actual !== expected) wrong++
    }
  }

  // Line validation: compare edge sets (expected vs player)
  if (expectedEdges.size > 0) {
    // Check for missing edges
    for (const edge of expectedEdges) {
      if (!playerEdges.has(edge)) wrong++
    }
    // Check for extra edges the player drew that aren't in the solution
    for (const edge of playerEdges) {
      if (!expectedEdges.has(edge)) wrong++
    }
  }

  if (wrong > 0) {
    return { valid: false, error: `${wrong} wrong.` }
  }

  return { valid: true }
}
