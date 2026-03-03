import { CellData, CellPosition } from '../types'

export function applyBordersToSelection(
  grid: CellData[][],
  selection: CellPosition[]
): CellData[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })))
  const borderValue = 2
  const rows = newGrid.length
  const cols = newGrid[0]?.length ?? 0
  const selSet = new Set(selection.map(s => `${s.row},${s.col}`))

  // Neighbor offsets: [dRow, dCol, side, neighborSide]
  const NEIGHBORS: [number, number, number, number][] = [
    [-1, 0, 0, 2], // top    → neighbor above, their bottom
    [0, 1, 1, 3],  // right  → neighbor right, their left
    [1, 0, 2, 0],  // bottom → neighbor below, their top
    [0, -1, 3, 1], // left   → neighbor left, their right
  ]

  for (const cell of selection) {
    const c = newGrid[cell.row][cell.col]
    const fixed = c.fixedBorders
    const newBorders = [...c.borders] as [number, number, number, number]

    for (const [dr, dc, side, nSide] of NEIGHBORS) {
      const isPerimeter = !selSet.has(`${cell.row + dr},${cell.col + dc}`)
      if (!isPerimeter) continue
      // Set border on this cell's side
      if (fixed[side] === 0) {
        newBorders[side] = borderValue
        c.edgeCrosses = [...c.edgeCrosses] as [boolean, boolean, boolean, boolean]
        c.edgeCrosses[side] = false
      }
      // Also set the matching border on the neighbor cell (if it exists)
      const nr = cell.row + dr
      const nc = cell.col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = newGrid[nr][nc]
        if (neighbor.fixedBorders[nSide] === 0) {
          neighbor.borders = [...neighbor.borders] as [number, number, number, number]
          neighbor.borders[nSide] = borderValue
          neighbor.edgeCrosses = [...neighbor.edgeCrosses] as [boolean, boolean, boolean, boolean]
          neighbor.edgeCrosses[nSide] = false
        }
      }
    }

    newGrid[cell.row][cell.col].borders = newBorders
  }

  return newGrid
}
