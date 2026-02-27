import { CellData, PuzzleSolution } from '../types'

function getEffectiveColor(cell: CellData): string | null {
  return cell.color || cell.fixedColor || null
}

/** Find connected regions based on fixed borders (0 = no wall = same region) */
function findRegions(grid: CellData[][]): number[][] {
  const rows = grid.length
  const cols = grid[0].length
  const regionMap: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1))
  let regionId = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (regionMap[r][c] !== -1) continue
      // BFS flood fill within fixed borders (puzzle-defined region boundaries)
      const queue: [number, number][] = [[r, c]]
      regionMap[r][c] = regionId
      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!
        const b = grid[cr][cc].fixedBorders
        // top
        if (cr > 0 && b[0] === 0 && regionMap[cr - 1][cc] === -1) {
          regionMap[cr - 1][cc] = regionId; queue.push([cr - 1, cc])
        }
        // right
        if (cc < cols - 1 && b[1] === 0 && regionMap[cr][cc + 1] === -1) {
          regionMap[cr][cc + 1] = regionId; queue.push([cr, cc + 1])
        }
        // bottom
        if (cr < rows - 1 && b[2] === 0 && regionMap[cr + 1][cc] === -1) {
          regionMap[cr + 1][cc] = regionId; queue.push([cr + 1, cc])
        }
        // left
        if (cc > 0 && b[3] === 0 && regionMap[cr][cc - 1] === -1) {
          regionMap[cr][cc - 1] = regionId; queue.push([cr, cc - 1])
        }
      }
      regionId++
    }
  }
  return regionMap
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

export function validateMurdoku(grid: CellData[][], solution: PuzzleSolution): { valid: boolean; error?: string } {
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

  // Count expected solution borders
  const borderTotal = Object.keys(solution.borders || {}).length
  let borderFilled = 0
  if (borderTotal > 0) {
    for (const [key, expected] of Object.entries(solution.borders!)) {
      const [r, c] = key.split(',').map(Number)
      const b = grid[r]?.[c]?.borders
      const fb = grid[r]?.[c]?.fixedBorders
      if (b && fb && (b[0] !== fb[0] || b[1] !== fb[1] || b[2] !== fb[2] || b[3] !== fb[3])) borderFilled++
    }
  }

  if (filled !== total || borderFilled !== borderTotal) {
    return { valid: false, error: `Not ready: ${filled}/${total} values, ${borderFilled}/${borderTotal} borders.` }
  }

  // Everything filled — now validate correctness
  let wrong = 0

  for (const [key, expected] of Object.entries(solution.cells)) {
    const [r, c] = key.split(',').map(Number)
    const cell = grid[r]?.[c]
    const actual = cell?.value || cell?.fixedValue
    if (!actual || actual.toUpperCase() !== expected.toUpperCase()) wrong++
  }

  if (solution.borders) {
    for (const [key, expected] of Object.entries(solution.borders)) {
      const [r, c] = key.split(',').map(Number)
      const b = grid[r]?.[c]?.borders
      if (!b || b[0] !== expected[0] || b[1] !== expected[1] || b[2] !== expected[2] || b[3] !== expected[3]) wrong++
    }
  }

  if (wrong > 0) {
    return { valid: false, error: `${wrong} wrong.` }
  }

  return { valid: true }
}
