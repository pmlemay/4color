import { CellData, FogGroup, FogTrigger, MarkShape } from '../types'

/** Check if a cell satisfies a fog trigger condition */
export function cellMatchesFogCondition(cell: CellData, condition: string): boolean {
  if (condition === 'cross') return cell.crossed
  if (condition.startsWith('value:')) {
    const val = condition.split(':')[1].toLowerCase()
    return (cell.value?.toLowerCase() === val) || (cell.fixedValue?.toLowerCase() === val)
  }
  if (condition.startsWith('color:')) {
    const col = condition.split(':')[1]
    return cell.color === col || cell.fixedColor === col
  }
  if (condition.startsWith('mark:')) {
    const mark = condition.split(':')[1] as MarkShape
    return cell.mark === mark || cell.fixedMark === mark
  }
  return false
}

/** Compute set of currently fogged cell keys ("row,col") from fog groups + revealed set */
export function computeFoggedCells(fogGroups: FogGroup[], revealedIds: Set<string>): Set<string> {
  const fogged = new Set<string>()
  for (const group of fogGroups) {
    if (revealedIds.has(group.id)) continue
    for (const cell of group.cells) {
      fogged.add(`${cell.row},${cell.col}`)
    }
  }
  return fogged
}

/** Evaluate which fog groups are newly satisfied by current grid state */
export function evaluateNewReveals(
  grid: CellData[][],
  fogGroups: FogGroup[],
  alreadyRevealed: Set<string>
): string[] {
  const newlyRevealed: string[] = []
  for (const group of fogGroups) {
    if (alreadyRevealed.has(group.id)) continue
    if (group.triggers.length === 0) continue
    const checkTrigger = (trigger: FogTrigger) => {
      const check = (pos: { row: number; col: number }) => {
        const cell = grid[pos.row]?.[pos.col]
        if (!cell) return false
        return cellMatchesFogCondition(cell, trigger.condition)
      }
      const result = trigger.matchMode === 'all'
        ? trigger.cells.every(check)
        : trigger.cells.some(check)
      return trigger.negate ? !result : result
    }
    const satisfied = group.triggerMode === 'any'
      ? group.triggers.some(checkTrigger)
      : group.triggers.every(checkTrigger)
    if (satisfied) newlyRevealed.push(group.id)
  }
  return newlyRevealed
}
