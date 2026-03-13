export type TextureType = 'water' | 'bricks' | 'grass' | 'gravel' | 'sand' | 'pavement' | 'wood' | 'dirt' | 'dirtTrailV' | 'dirtTrailH' | 'carpet'

export interface CellTexture {
  type: TextureType
  variant: number  // 0-based index for shade/color variation
}

export type LabelAlign = 'top' | 'middle' | 'bottom'

export interface CellLabel {
  text: string
  showThroughFog?: boolean
  revealWithFog?: string  // fog group ID — label hidden until that group is revealed
}

export type CellLabels = Partial<Record<LabelAlign, CellLabel | null>>

export interface CellData {
  value: string | null
  notes: string[]
  fixedValue: string | null
  fixedColor: string | null
  borders: [number, number, number, number] // [top, right, bottom, left]
  fixedBorders: [number, number, number, number] // borders from the puzzle definition (immutable in player mode)
  color: string | null
  labels: CellLabels
  crossed: boolean
  mark: MarkShape | null
  fixedMark: MarkShape | null
  fixedEdgeMarks: [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null] // [top, right, bottom, left]
  fixedVertexMarks: [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null] // [TL, TR, BR, BL]
  edgeCrosses: [boolean, boolean, boolean, boolean] // [top, right, bottom, left]
  lines: [boolean, boolean, boolean, boolean] // [top, right, bottom, left] — player connection lines
  selected: boolean
  image: string | null
  fixedTexture: CellTexture | null
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
  labels?: CellLabels
  label?: CellLabel & { align?: LabelAlign }  // backward compat for old puzzles
  crossed?: boolean
  mark?: MarkShape
  fixedMark?: MarkShape
  fixedEdgeMarks?: [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null]
  fixedVertexMarks?: [MarkShape | null, MarkShape | null, MarkShape | null, MarkShape | null]
  image?: string
  fixedTexture?: CellTexture
}

export interface PuzzleData {
  id: string
  title: string
  authors: string[]
  gridSize: { rows: number; cols: number }
  cells: PuzzleCellData[]
  rules: string[]
  clues: string[]
  specialRules?: string[]
  difficulty?: string
  tags?: string[]
  autoCrossRules?: AutoCrossRule[]
  puzzleType?: string
  clickActionLeft?: string
  clickActionRight?: string
  forcedInputLayout?: string // backward compat only
  images?: Record<string, string>
  fogGroups?: FogGroup[]
  inProgress?: boolean
  createdAt: string
}

export interface PuzzleIndexEntry {
  id: string
  file: string
  title: string
  authors: string[]
  gridSize: { rows: number; cols: number }
  difficulty?: string
  tags?: string[]
  autoCrossRules?: AutoCrossRule[]
  puzzleType?: string
  clickActionLeft?: string
  clickActionRight?: string
  forcedInputLayout?: string // backward compat only
  inProgress?: boolean
}

export type MarkShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'dot'

export type AutoCrossRule = 'king' | 'rook' | 'bishop' | 'knight'

export type InputMode = 'normal' | 'suggested' | 'color' | 'fixed' | 'fixedColor' | 'fixedDouble' | 'note' | 'label' | 'cross' | 'border' | 'edge' | 'fixedBorder' | 'fixedEdge' | 'mark' | 'fixedMark' | 'fog' | 'fixedTexture'

export interface FogTrigger {
  cells: CellPosition[]
  condition: string  // 'value:hello', 'color:9', 'mark:star', 'cross'
  matchMode?: 'all' | 'any'  // undefined treated as 'any' for backward compat
  negate?: boolean            // if true, condition must NOT match
}

export interface FogGroup {
  id: string              // e.g. "fog-0"
  cells: CellPosition[]   // cells hidden by this group
  triggers: FogTrigger[]  // ALL (or ANY, per triggerMode) must be true to reveal
  triggerMode?: 'all' | 'any'  // undefined treated as 'all' for backward compat
}

/** Identifies a single edge of a cell: side 0=top, 1=right, 2=bottom, 3=left */
export interface EdgeDescriptor {
  row: number
  col: number
  side: 0 | 1 | 2 | 3
}

/** Solution file: maps "row,col" to expected value/borders */
export interface PuzzleSolution {
  id: string
  cells: Record<string, string>
  borders?: Record<string, [number, number, number, number]>
  colors?: Record<string, string>
}
