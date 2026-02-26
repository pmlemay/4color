export type LabelAlign = 'top' | 'bottom'

export interface CellLabel {
  text: string
  align: LabelAlign
}

export interface CellData {
  value: string | null
  notes: string[]
  fixedValue: string | null
  fixedColor: string | null
  borders: [number, number, number, number] // [top, right, bottom, left]
  fixedBorders: [number, number, number, number] // borders from the puzzle definition (immutable in player mode)
  color: string | null
  label: CellLabel | null
  crossed: boolean
  selected: boolean
  image: string | null
}

export interface CellPosition {
  row: number
  col: number
}

export interface PuzzleCellData {
  row: number
  col: number
  fixedValue?: string
  fixedColor?: string
  color?: string
  borders?: [number, number, number, number]
  label?: CellLabel
  crossed?: boolean
  image?: string
}

export interface PuzzleData {
  id: string
  title: string
  author: string
  gridSize: { rows: number; cols: number }
  cells: PuzzleCellData[]
  rules: string[]
  clues: string[]
  difficulty?: string
  images?: Record<string, string>
  createdAt: string
}

export interface PuzzleIndexEntry {
  id: string
  file: string
  title: string
  author: string
  gridSize: { rows: number; cols: number }
  difficulty?: string
}

export type InputMode = 'normal' | 'color' | 'fixed' | 'fixedColor' | 'note' | 'label' | 'cross' | 'border'
