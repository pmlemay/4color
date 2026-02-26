import { CellData, CellPosition } from '../types'

export function applyBordersToSelection(
  grid: CellData[][],
  selection: CellPosition[]
): CellData[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })))
  const borderValue = 2
  const selSet = new Set(selection.map(s => `${s.row},${s.col}`))

  for (const cell of selection) {
    const fixed = newGrid[cell.row][cell.col].fixedBorders
    newGrid[cell.row][cell.col].borders = [
      fixed[0] > 0 ? fixed[0] : (selSet.has(`${cell.row - 1},${cell.col}`) ? 0 : borderValue),
      fixed[1] > 0 ? fixed[1] : (selSet.has(`${cell.row},${cell.col + 1}`) ? 0 : borderValue),
      fixed[2] > 0 ? fixed[2] : (selSet.has(`${cell.row + 1},${cell.col}`) ? 0 : borderValue),
      fixed[3] > 0 ? fixed[3] : (selSet.has(`${cell.row},${cell.col - 1}`) ? 0 : borderValue),
    ]
  }

  return newGrid
}
