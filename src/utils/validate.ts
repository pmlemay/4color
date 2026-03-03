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

  if (filled !== total || !bordersReady || colorFilled !== colorTotal) {
    const parts: string[] = []
    if (total > 0) parts.push(`${filled}/${total} values`)
    if (borderProgress) parts.push(borderProgress)
    if (colorTotal > 0) parts.push(`${colorFilled}/${colorTotal} colors`)
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

  if (wrong > 0) {
    return { valid: false, error: `${wrong} wrong.` }
  }

  return { valid: true }
}
