/** Suspect letters, in order. V is excluded — it is always reserved for the victim, so a 26×26 grid uses the whole alphabet. */
export const MURDOKU_SUSPECT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUWXYZ'

export const MURDOKU_VICTIM_LETTER = 'V'

/** One person per row and per column, so the grid's short side sets the cast size: N-1 suspects + the victim. */
export function murdokuSuspectLetters(gridRows: number, gridCols: number): string[] {
  const suspectCount = Math.min(Math.min(gridRows, gridCols) - 1, MURDOKU_SUSPECT_LETTERS.length)
  return MURDOKU_SUSPECT_LETTERS.slice(0, Math.max(0, suspectCount)).split('')
}
