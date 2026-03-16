import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { useGrid } from '../hooks/useGrid'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTheme } from '../hooks/useTheme'
import { useModal } from '../hooks/useModal'
import { Grid } from '../components/Grid/Grid'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { InfoPanel } from '../components/InfoPanel/InfoPanel'
import { Modal } from '../components/Modal/Modal'
import { ResizableLeft } from '../components/ResizableLeft'
import { ResizableRight } from '../components/ResizableRight'
import { LanguagePicker } from '../components/LanguagePicker'
import { ThemeToggle } from '../components/ThemeToggle'
import { PillInput } from '../components/PillInput'
import { useGridScale } from '../hooks/useGridScale'
import { gridToPuzzle, downloadPuzzleJSON, savePuzzleToServer, saveSolutionToServer, downloadSolutionJSON, puzzleToGrid, fetchPuzzle, fetchPuzzleIndex, fetchPuzzleSolution, PUZZLE_TYPE_DEFAULTS, migratePuzzleType } from '../utils/puzzleIO'
import { PuzzleData, PuzzleSolution, CellData, CellPosition, InputMode, AutoCrossRule, MarkShape, FogGroup, FogTrigger } from '../types'
import { computeFoggedCells, evaluateNewReveals } from '../utils/fog'
import { cellMatchesAction, applyActionToGrid } from '../utils/clickActions'

/** Convert 0-based column index to Excel-style letter label (A, B, ... Z, AA, AB, ...) */
function colLabel(index: number): string {
  let label = ''
  let n = index
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

export function EditorPage() {
  const { puzzleId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const debug = searchParams.get('debug') === 'true'
  const paramRows = Number(searchParams.get('rows')) || 10
  const paramCols = Number(searchParams.get('cols')) || 10

  const { theme, toggle: toggleTheme } = useTheme()
  const [rows, setRows] = useState(paramRows)
  const [cols, setCols] = useState(paramCols)
  const [title, setTitle] = useState('')
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const [authors, setAuthors] = useState<string[]>(isDev ? ['PmLemay'] : [])
  const [difficulty, setDifficulty] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [specialRules, setSpecialRules] = useState<string[]>([])
  const [rules, setRules] = useState<string[]>([])
  const [clues, setClues] = useState<string[]>([])
  const [newSpecialRule, setNewSpecialRule] = useState('')
  const [newRule, setNewRule] = useState('')
  const [newClue, setNewClue] = useState('')
  const [imageLibrary, setImageLibrary] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [knownAuthors, setKnownAuthors] = useState<string[]>([])
  const [autoCrossRules, setAutoCrossRulesState] = useState<AutoCrossRule[]>([])
  const [puzzleType, setPuzzleType] = useState('')
  const [clickActionLeft, setClickActionLeft] = useState('')
  const [clickActionRight, setClickActionRight] = useState('cross')
  const [inProgress, setInProgress] = useState(false)

  const [fogGroups, setFogGroups] = useState<FogGroup[]>([])
  const [fogEditStep, setFogEditStep] = useState<'idle' | 'pickFogCells' | 'pickTriggerCells' | 'pickTrigger'>('idle')
  const [fogPendingCells, setFogPendingCells] = useState<CellPosition[]>([])
  const [fogPendingTriggers, setFogPendingTriggers] = useState<FogTrigger[]>([])
  const [fogPendingTriggerCells, setFogPendingTriggerCells] = useState<CellPosition[]>([])
  const [fogPendingTriggerMode, setFogPendingTriggerMode] = useState<'all' | 'any'>('all')
  const [fogEditingGroupId, setFogEditingGroupId] = useState<string | null>(null)
  const [fogPreviewGroupId, setFogPreviewGroupId] = useState<string | null>(null)
  const [revealedFogGroupIds, setRevealedFogGroupIds] = useState<Set<string>>(new Set())
  const prevInputMode = useRef<InputMode>('normal')
  const fogEditingTrigger = useRef<{ index: number; trigger: FogTrigger } | null>(null)

  // Map from grid undo stack depth (before the push) to the fog shift applied.
  // On undo (depth shrinks), reverse the shift at the new depth. On redo (depth grows), re-apply.
  const fogShiftByDepth = useRef<Map<number, { row: number; col: number }>>(new Map())

  const [editorPuzzleId, setEditorPuzzleId] = useState(puzzleId || '')
  const [solutionMode, setSolutionMode] = useState(false)
  const [puzzleSnapshot, setPuzzleSnapshot] = useState('')

  const { modalProps, showAlert, showConfirm } = useModal()
  const gridState = useGrid(rows, cols)
  gridState.setIsEditor(true)

  const shiftFogGroups = useCallback((rowDelta: number, colDelta: number) => {
    const shiftCells = (cells: CellPosition[]) =>
      cells.map(c => ({ row: c.row + rowDelta, col: c.col + colDelta }))
    setFogGroups(prev => prev.map(g => ({
      ...g,
      cells: shiftCells(g.cells),
      triggers: g.triggers.map(t => ({ ...t, cells: shiftCells(t.cells) })),
    })))
    setFogPendingCells(prev => shiftCells(prev))
    setFogPendingTriggers(prev => prev.map(t => ({ ...t, cells: shiftCells(t.cells) })))
    setFogPendingTriggerCells(prev => shiftCells(prev))
  }, [])

  const handleUndo = useCallback(() => {
    // After undo, the stack depth is one less — that's the key where we stored the shift
    gridState.undo()
    const depth = gridState.undoStackLength()
    const shift = fogShiftByDepth.current.get(depth)
    if (shift) shiftFogGroups(-shift.row, -shift.col)
  }, [gridState, shiftFogGroups])

  const handleRedo = useCallback(() => {
    // Before redo, the current depth is where the shift was stored
    const depth = gridState.undoStackLength()
    const shift = fogShiftByDepth.current.get(depth)
    gridState.redo()
    if (shift) shiftFogGroups(shift.row, shift.col)
  }, [gridState, shiftFogGroups])

  const gridScale = useGridScale({ rows: gridState.grid.length, cols: gridState.grid[0]?.length ?? 0, autoResetZoom: false })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPuzzleIndex().then(entries => {
      const allTags = new Set<string>()
      const allAuthors = new Set<string>()
      for (const e of entries) {
        for (const t of e.tags || []) allTags.add(t)
        for (const a of e.authors || []) allAuthors.add(a)
      }
      setKnownTags([...allTags].sort())
      setKnownAuthors([...allAuthors].sort())
    })
  }, [])

  const loadPuzzleIntoEditor = useCallback((puzzle: PuzzleData) => {
    setTitle(puzzle.title || '')
    setAuthors(puzzle.authors || [])
    setRows(puzzle.gridSize.rows)
    setCols(puzzle.gridSize.cols)
    setDifficulty(puzzle.difficulty || '')
    setTags(puzzle.tags || [])
    setAutoCrossRulesState(puzzle.autoCrossRules || [])
    setPuzzleType(puzzle.puzzleType || '')
    setClickActionLeft(puzzle.clickActionLeft || '')
    setClickActionRight(puzzle.clickActionRight || 'cross')
    setSpecialRules(puzzle.specialRules || [])
    setRules(puzzle.rules || [])
    setClues(puzzle.clues || [])
    setFogGroups(puzzle.fogGroups || [])
    setInProgress(puzzle.inProgress || false)
    gridState.setGrid(puzzleToGrid(puzzle))
    const images = new Set<string>()
    for (const cell of puzzle.cells) {
      if (cell.image) {
        const resolved = puzzle.images?.[cell.image] ?? cell.image
        images.add(resolved)
      }
    }
    setImageLibrary(Array.from(images))
  }, [gridState])

  useEffect(() => {
    if (puzzleId) {
      fetchPuzzle(puzzleId).then(puzzle => {
        if (puzzle) {
          // Prefer draft over saved file if one exists
          const raw = localStorage.getItem(`editor-draft-${puzzleId}`)
          if (raw) {
            try {
              const draft = JSON.parse(raw) as PuzzleData
              loadPuzzleIntoEditor(draft)
              gridScale.resetZoom()
              draftLoaded.current = true
              return
            } catch { /* fall through to saved file */ }
          }
          loadPuzzleIntoEditor(puzzle)
          gridScale.resetZoom()
          draftLoaded.current = true
        }
      })
    }
  }, [puzzleId])

  // --- Auto-save draft to localStorage ---
  const draftKey = `editor-draft-${puzzleId || 'new'}`
  const draftLoaded = useRef(false)

  // Restore draft on mount for new puzzles
  useEffect(() => {
    if (draftLoaded.current || puzzleId) return
    const raw = localStorage.getItem(draftKey)
    if (!raw) { draftLoaded.current = true; return }
    try {
      loadPuzzleIntoEditor(JSON.parse(raw) as PuzzleData)
    } catch { /* ignore corrupt drafts */ }
    draftLoaded.current = true
  }, [])

  // Auto-save draft every 3 seconds when state changes
  useEffect(() => {
    if (!draftLoaded.current) return
    const timer = setTimeout(() => {
      try {
        const draft = gridToPuzzle(gridState.grid, {
          id: editorPuzzleId || 'draft',
          title, authors, specialRules: specialRules.length ? specialRules : undefined,
          rules, clues, difficulty, tags, autoCrossRules,
          puzzleType: puzzleType || undefined,
          clickActionLeft: clickActionLeft || undefined,
          clickActionRight: clickActionRight || undefined,
          fogGroups: fogGroups.length ? fogGroups : undefined,
          inProgress: inProgress || undefined,
        })
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch { /* ignore serialization errors */ }
    }, 3000)
    return () => clearTimeout(timer)
  }, [gridState.grid, title, authors, difficulty, tags, specialRules, rules, clues, autoCrossRules, puzzleType, clickActionLeft, clickActionRight, fogGroups, inProgress, editorPuzzleId, draftKey])

  // Clear draft on successful save
  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey)
  }, [draftKey])

  // Sync rows/cols from actual grid dimensions (keeps inputs accurate after undo/redo/add)
  useEffect(() => {
    setRows(gridState.grid.length)
    setCols(gridState.grid[0]?.length ?? 0)
  }, [gridState.grid.length, gridState.grid[0]?.length])

  useEffect(() => {
    gridState.setAutoCrossRules(autoCrossRules)
  }, [autoCrossRules])

  const HEYAWAKE_RULES = [
    'Shade some cells so that no two shaded cells are orthogonally adjacent and the remaining unshaded cells form one orthogonally connected area.',
    'Numbered regions must contain the indicated amount of shaded cells.',
    'A line of consecutive unshaded cells may not cross more than one bold border.',
  ]
  const NURIKABE_RULES = [
    'Each island (dots) contains exactly one clue.',
    'The number of squares in each island equals the value of the clue.',
    'All islands are isolated from each other horizontally and vertically.',
    'There are no shaded (black) areas of 2x2 or larger.',
    'When completed, all shaded cells form a continuous path.',
  ]
  const STARBATTLE_RULES = [
    'Place stars in the grid so that each row, column, and bold-outlined region contains the indicated number of stars.',
    'The value of N is given outside the grid.',
    'Stars may not touch each other, not even diagonally.',
  ]
  const SPIRALGALAXY_RULES = [
    'Divide the grid into regions that have rotational symmetry around their center white circle.',
    'Each region has exactly 1 white circle in it.',
  ]
  const YAJILIN_RULES = [
    'Shade some cells so that no two shaded cells are orthogonally adjacent and draw a non-intersecting loop through the centers of all the remaining empty cells.',
    'Clues cannot be shaded, and represent the number of shaded cells in a straight line in the indicated direction.',
  ]
  const CAVE_RULES = [
    'Shade some cells so that the shaded cells are all connected orthogonally by other shaded cells to the edge of the grid, and the remaining unshaded cells form one orthogonally connected area.',
    'Clues cannot be shaded, and represent the total number of unshaded cells that can be seen in a straight line vertically or horizontally, including itself.',
  ]
  const COCKTAILLAMP_RULES = [
    'Shade some cells such that all shaded cells within a region form a single orthogonally connected group.',
    'Shaded groups may not be orthogonally adjacent, but must all form a single diagonally connected network.',
    'Regions with numbers must contain the indicated amount of shaded cells.',
    'No 2x2 region may be entirely shaded.',
  ]
  const LITS_RULES = [
    'Shade one tetromino of cells in each region so that all shaded cells form one orthogonally connected area.',
    'Two tetrominoes of the same shape may not share a bold border, counting rotations and reflections as the same.',
    'No 2x2 region may be entirely shaded.',
  ]
  const ARCHIPELAGO_RULES = [
    'Shade some cells to form groups of orthogonally adjacent shaded cells, called islands. Some shaded cells are given.',
    'Numbers indicate the amount of cells in their island. An island can have any amount of identical numbers.',
    'Each diagonally connected network of islands must contain exactly one island of each size from 1 to N, where N is the size of the largest island in the group.',
    'All islands must be diagonally adjacent to at least one other island.',
  ]
  const MURDOKU_RULES = [
    'Place everyone on the grid according to their clue to find the murderer. He was in a region alone with the victim.',
    'Only 1 person per row and per column.',
    '"Beside" means in the same room and orthogonally adjacent.',
  ]
  const ICEWALK_RULES = [
    'Draw a loop through the centers of some cells which passes through each numbered cell.',
    'Two perpendicular line segments may intersect each other only on icy cells, but they may not turn at their intersection or otherwise overlap.',
    'The loop may not turn on icy cells.',
    'A number indicates how many cells make up the continuous non-icy section of the loop that the number is on.',
  ]
  const ICEBARN_RULES = [
    'Draw a path through the centers of some cells, entering the grid at the "IN" marking and exiting at the "OUT" marking.',
    'The path must travel through all of the arrows in the indicated direction.',
    'Two perpendicular line segments may intersect each other only on icy cells, but they may not turn at their intersection or otherwise overlap.',
    'The path may not turn on icy cells, and each orthogonally connected group of icy cells must be passed through at least once.',
  ]
  const SLALOM_RULES = [
    'Draw a non-intersecting loop through the centers of some cells, starting and ending at the circle.',
    'The loop may not enter blackened cells, and must pass straight through each gate exactly once.',
    'If a number N is pointing at a gate, it must be the Nth gate visited from the circle.',
  ]
  const PUZZLE_TYPE_RULES: Record<string, string[]> = {
    heyawake: HEYAWAKE_RULES,
    nurikabe: NURIKABE_RULES,
    starbattle: STARBATTLE_RULES,
    spiralgalaxy: SPIRALGALAXY_RULES,
    slalom: SLALOM_RULES,
    icebarn: ICEBARN_RULES,
    yajilin: YAJILIN_RULES,
    cave: CAVE_RULES,
    cocktaillamp: COCKTAILLAMP_RULES,
    lits: LITS_RULES,
    archipelago: ARCHIPELAGO_RULES,
    icewalk: ICEWALK_RULES,
    murdoku: MURDOKU_RULES,
  }
  const PUZZLE_TYPE_TITLES: Record<string, string> = {
    heyawake: 'Heyawake',
    nurikabe: 'Nurikabe',
    starbattle: 'Star Battle',
    spiralgalaxy: 'Spiral Galaxy',
    slalom: 'Slalom',
    icebarn: 'Icebarn',
    yajilin: 'Yajilin',
    cave: 'Cave',
    cocktaillamp: 'Cocktail Lamp',
    lits: 'LITS',
    archipelago: 'Archipelago',
    icewalk: 'Ice Walk',
    murdoku: 'Murdoku',
  }
  const PUZZLE_TYPE_TAGS: Record<string, string> = {
    heyawake: 'Heyawake',
    nurikabe: 'Nurikabe',
    starbattle: 'Star-battle',
    spiralgalaxy: 'Spiral-galaxy',
    slalom: 'Slalom',
    icebarn: 'Icebarn',
    yajilin: 'Yajilin',
    cave: 'Cave',
    cocktaillamp: 'Cocktail-lamp',
    lits: 'LITS',
    archipelago: 'Archipelago',
    icewalk: 'Ice-walk',
    murdoku: 'Murdoku',
  }
  const prevPuzzleType = useRef(puzzleType)

  const handlePuzzleTypeChange = useCallback((newType: string) => {
    setPuzzleType(newType)
    // Auto-populate click actions from defaults
    const defaults = PUZZLE_TYPE_DEFAULTS[newType]
    if (defaults) {
      setClickActionLeft(defaults.left)
      setClickActionRight(defaults.right)
    } else {
      setClickActionLeft('')
      setClickActionRight('cross')
    }
    // Auto-fill title (overwrite with type's default name)
    const oldTitle = PUZZLE_TYPE_TITLES[prevPuzzleType.current]
    const newTitle = PUZZLE_TYPE_TITLES[newType]
    if (newTitle) {
      setTitle(prev => (!prev || prev === oldTitle) ? newTitle : prev)
    } else if (oldTitle) {
      setTitle(prev => prev === oldTitle ? '' : prev)
    }
    // Remove old type's tag, add new type's tag
    const oldTag = PUZZLE_TYPE_TAGS[prevPuzzleType.current]
    const newTag = PUZZLE_TYPE_TAGS[newType]
    setTags(prev => {
      let next = oldTag ? prev.filter(t => t !== oldTag) : prev
      if (newTag && !next.includes(newTag)) next = [...next, newTag]
      return next
    })
    // Murdoku: generate random suspect clues (A, B, C... V) with matching first-letter names
    if (newType === 'murdoku') {
      const gridRows = gridState.grid.length
      const gridCols = gridState.grid[0]?.length ?? 1
      const count = Math.min(gridRows, gridCols)
      const NAMES: Record<string, { male: string[]; female: string[] }> = {
        A: { male: ['Alfred', 'Alaric', 'Arthur', 'Adrian', 'Alistair', 'Ambrose', 'Angelo', 'Archibald', 'Augustus', 'Atticus'], female: ['Alice', 'Agatha', 'Adelaide', 'Astrid', 'Amelia', 'Arabella', 'Antonia', 'Anastasia', 'Aurora', 'Abigail'] },
        B: { male: ['Boris', 'Bruno', 'Barnaby', 'Booker', 'Benedict', 'Bernard', 'Basil', 'Balthazar', 'Beckett', 'Bradford'], female: ['Beatrice', 'Bianca', 'Bridget', 'Bertha', 'Brenda', 'Blanche', 'Bonnie', 'Belinda', 'Blythe', 'Bronwyn'] },
        C: { male: ['Carlos', 'Cedric', 'Cornelius', 'Cyrus', 'Calvin', 'Casper', 'Chester', 'Clayton', 'Conrad', 'Clifford'], female: ['Clara', 'Celia', 'Charlotte', 'Celeste', 'Camille', 'Cordelia', 'Constance', 'Cassandra', 'Colette', 'Clementine'] },
        D: { male: ['Diego', 'Desmond', 'Drake', 'Dmitri', 'Donovan', 'Duncan', 'Dante', 'Dalton', 'Dominic', 'Dexter'], female: ['Diana', 'Dolores', 'Dahlia', 'Daphne', 'Delilah', 'Dorothy', 'Daisy', 'Desiree', 'Dinah', 'Dorothea'] },
        E: { male: ['Edgar', 'Edmund', 'Elias', 'Emilio', 'Ernest', 'Everett', 'Ezra', 'Eugene', 'Elliott', 'Enrique'], female: ['Elena', 'Elise', 'Esmeralda', 'Echo', 'Evelyn', 'Estelle', 'Edith', 'Eloise', 'Emmeline', 'Eugenia'] },
        F: { male: ['Felix', 'Fletcher', 'Flint', 'Fabian', 'Franklin', 'Frederick', 'Finnegan', 'Forrest', 'Floyd', 'Fergus'], female: ['Fiona', 'Felicia', 'Flora', 'Freya', 'Frances', 'Francesca', 'Fernanda', 'Faith', 'Florence', 'Fleur'] },
        G: { male: ['George', 'Gareth', 'Gideon', 'Gustav', 'Gordon', 'Gerald', 'Graham', 'Gilbert', 'Grover', 'Gunther'], female: ['Gloria', 'Gemma', 'Greta', 'Giselle', 'Genevieve', 'Guinevere', 'Gwendolyn', 'Gladys', 'Grace', 'Gertrude'] },
        H: { male: ['Hugo', 'Hawke', 'Hector', 'Harold', 'Harvey', 'Horatio', 'Herbert', 'Henrik', 'Hubert', 'Hamish'], female: ['Helena', 'Harriet', 'Hazel', 'Hilda', 'Henrietta', 'Hermione', 'Heather', 'Holly', 'Helga', 'Hortense'] },
        I: { male: ['Ivan', 'Igor', 'Isaac', 'Ignacio', 'Irving', 'Isidore', 'Ibrahim', 'Ira', 'Idris', 'Inigo'], female: ['Irene', 'Iris', 'Isolde', 'Ingrid', 'Imogen', 'Isadora', 'Ivy', 'Ilona', 'Ines', 'Imelda'] },
        J: { male: ['James', 'Jasper', 'Jonas', 'Julian', 'Jerome', 'Jeremiah', 'Jethro', 'Joaquin', 'Julius', 'Jefferson'], female: ['Julia', 'Josephine', 'Jade', 'Jocelyn', 'Jasmine', 'Juliette', 'Jacqueline', 'Judith', 'Joanna', 'Jemima'] },
        K: { male: ['Klaus', 'Kenneth', 'Kurt', 'Killian', 'Keegan', 'Kingston', 'Kendrick', 'Kasper', 'Kelvin', 'Kieran'], female: ['Karen', 'Kira', 'Katherine', 'Katya', 'Kirsten', 'Keziah', 'Kathleen', 'Kendra', 'Katarina', 'Kelsey'] },
        L: { male: ['Leon', 'Lazlo', 'Lorenzo', 'Lucian', 'Leopold', 'Lancelot', 'Luther', 'Leander', 'Lionel', 'Lysander'], female: ['Laura', 'Lillian', 'Lydia', 'Lenora', 'Lucille', 'Lorraine', 'Lavinia', 'Lisette', 'Louisa', 'Leona'] },
        M: { male: ['Marco', 'Magnus', 'Maurice', 'Milton', 'Mortimer', 'Montgomery', 'Malcolm', 'Maximilian', 'Marshall', 'Matthias'], female: ['Maria', 'Mira', 'Margot', 'Minerva', 'Madeleine', 'Miranda', 'Millicent', 'Maude', 'Marcella', 'Mirabel'] },
        N: { male: ['Nigel', 'Nash', 'Nolan', 'Nestor', 'Nathaniel', 'Nelson', 'Neville', 'Norman', 'Nicholas', 'Norbert'], female: ['Nina', 'Nadia', 'Nora', 'Natasha', 'Nadine', 'Noelle', 'Nicolette', 'Nell', 'Nerissa', 'Nanette'] },
        O: { male: ['Oscar', 'Otto', 'Orion', 'Oswald', 'Oliver', 'Octavius', 'Orlando', 'Oberon', 'Orville', 'Otis'], female: ['Olivia', 'Orla', 'Octavia', 'Ophelia', 'Odette', 'Olympia', 'Opal', 'Ondine', 'Ottilie', 'Olga'] },
        P: { male: ['Percy', 'Patrick', 'Philip', 'Preston', 'Percival', 'Phineas', 'Porter', 'Palmer', 'Pemberton', 'Prescott'], female: ['Paula', 'Penelope', 'Priscilla', 'Petra', 'Prudence', 'Portia', 'Pauline', 'Patience', 'Philippa', 'Persephone'] },
        Q: { male: ['Quinn', 'Quentin', 'Quincy', 'Quillan', 'Quade', 'Quinton', 'Quimby', 'Quillen', 'Quasim', 'Quarles'], female: ['Quinn', 'Queenie', 'Quintessa', 'Quiana', 'Querida', 'Quella', 'Quinella', 'Quillan', 'Qadira', 'Questa'] },
        R: { male: ['Roland', 'Rupert', 'Rafael', 'Reginald', 'Roderick', 'Randolph', 'Raymond', 'Remington', 'Rowan', 'Rufus'], female: ['Rita', 'Rosalind', 'Regina', 'Rowena', 'Rosemary', 'Ramona', 'Rebecca', 'Renata', 'Roxanne', 'Rosetta'] },
        S: { male: ['Stefan', 'Simon', 'Sebastian', 'Silas', 'Sylvester', 'Solomon', 'Sterling', 'Spencer', 'Sullivan', 'Sinclair'], female: ['Sophia', 'Selena', 'Sylvia', 'Stella', 'Sabrina', 'Seraphina', 'Sybil', 'Simone', 'Scarlett', 'Susannah'] },
        T: { male: ['Thomas', 'Theodore', 'Tobias', 'Tristan', 'Thaddeus', 'Thornton', 'Terrence', 'Timothy', 'Tiberius', 'Tucker'], female: ['Tanya', 'Thea', 'Tabitha', 'Tamara', 'Theodora', 'Tatiana', 'Tallulah', 'Temperance', 'Thomasina', 'Trudy'] },
        U: { male: ['Ulrich', 'Umberto', 'Ugo', 'Ulysses', 'Urban', 'Usher', 'Upton', 'Udo', 'Uriah', 'Uttam'], female: ['Ursula', 'Una', 'Ulyana', 'Undine', 'Unity', 'Ulla', 'Ulrike', 'Umaya', 'Ulyssa', 'Urbana'] },
        V: { male: ['Victor', 'Vincent', 'Vasco', 'Viktor', 'Virgil', 'Vernon', 'Vaughn', 'Valentin', 'Vladimir', 'Vance'], female: ['Valentina', 'Vivian', 'Viola', 'Vera', 'Veronica', 'Victoria', 'Virginia', 'Violet', 'Venetia', 'Vanessa'] },
      }
      const letters = 'ABCDEFGHIJKLMNOPQRSTUV'
      const suspectLetters = letters.slice(0, count - 1).split('')
      const newClues: string[] = []
      for (const letter of suspectLetters) {
        const pool = NAMES[letter]
        if (!pool) continue
        const isMale = Math.random() < 0.5
        const names = isMale ? pool.male : pool.female
        const name = names[Math.floor(Math.random() * names.length)]
        const gender = isMale ? 'Man' : 'Woman'
        const pronoun = isMale ? 'He' : 'She'
        newClues.push(`${letter} (${gender} - ${name}). ${pronoun} was...`)
      }
      // Last one is always V (victim)
      const vPool = NAMES['V']
      const vMale = Math.random() < 0.5
      const vNames = vMale ? vPool.male : vPool.female
      const vName = vNames[Math.floor(Math.random() * vNames.length)]
      const vGender = vMale ? 'Man' : 'Woman'
      const vPronoun = vMale ? 'He' : 'She'
      newClues.push(`V (${vGender} - ${vName}). The victim. ${vPronoun} was alone with the murderer.`)
      setClues(newClues)
    }
    // Icebarn: expand grid by +2 in each dimension, add border fog + IN/OUT labels
    if (newType === 'icebarn') {
      const r = gridState.grid.length + 2
      const c = (gridState.grid[0]?.length ?? 1) + 2
      setRows(r)
      setCols(c)
      gridState.resetGrid(r, c)
      gridState.setGrid(prev => {
        const g = prev.map(row => row.map(cell => ({ ...cell, labels: { ...cell.labels } })))
        if (g[0]?.[1]) g[0][1].labels = { middle: { text: 'IN', showThroughFog: true } }
        if (g[r - 1]?.[c - 2]) g[r - 1][c - 2].labels = { middle: { text: 'OUT', showThroughFog: true } }
        return g
      })
      const borderCells: CellPosition[] = []
      for (let ri = 0; ri < r; ri++) {
        for (let ci = 0; ci < c; ci++) {
          if (ri === 0 || ri === r - 1 || ci === 0 || ci === c - 1) {
            borderCells.push({ row: ri, col: ci })
          }
        }
      }
      setFogGroups([{ id: 'fog-border', cells: borderCells, triggers: [] }])
    } else if (newType === 'starbattle') {
      // Star Battle: add 1 extra row at top for fog header with "1" and star labels
      const r = gridState.grid.length + 1
      const c = gridState.grid[0]?.length ?? 1
      setRows(r)
      setCols(c)
      gridState.resetGrid(r, c)
      gridState.setGrid(prev => {
        const g = prev.map(row => row.map(cell => ({ ...cell, labels: { ...cell.labels } })))
        // "1" label in second-to-last column of top row
        if (g[0]?.[c - 2]) g[0][c - 2].labels = { middle: { text: '1', showThroughFog: true } }
        // Star label in last column of top row
        if (g[0]?.[c - 1]) g[0][c - 1].labels = { middle: { text: '\u2605', showThroughFog: true } }
        return g
      })
      // Fog the entire top row
      const topRowCells: CellPosition[] = []
      for (let ci = 0; ci < c; ci++) {
        topRowCells.push({ row: 0, col: ci })
      }
      setFogGroups([{ id: 'fog-header', cells: topRowCells, triggers: [] }])
    } else if (prevPuzzleType.current === 'icebarn') {
      // Switching away from icebarn: clear the auto-generated fog and IN/OUT labels
      setFogGroups(prev => prev.filter(g => g.id !== 'fog-border'))
      gridState.setGrid(prev => {
        const r = prev.length
        const c = prev[0]?.length ?? 1
        const g = prev.map(row => row.map(cell => ({ ...cell })))
        if (g[0]?.[1]?.labels?.middle?.text === 'IN') {
          g[0][1] = { ...g[0][1], labels: {} }
        }
        if (g[r - 1]?.[c - 2]?.labels?.middle?.text === 'OUT') {
          g[r - 1][c - 2] = { ...g[r - 1][c - 2], labels: {} }
        }
        return g
      })
    } else if (prevPuzzleType.current === 'starbattle') {
      // Switching away from starbattle: clear the auto-generated fog header and labels
      setFogGroups(prev => prev.filter(g => g.id !== 'fog-header'))
      gridState.setGrid(prev => {
        const c = prev[0]?.length ?? 1
        const g = prev.map(row => row.map(cell => ({ ...cell })))
        if (g[0]?.[c - 2]?.labels?.middle?.text === '1') {
          g[0][c - 2] = { ...g[0][c - 2], labels: {} }
        }
        if (g[0]?.[c - 1]?.labels?.middle?.text === '\u2605') {
          g[0][c - 1] = { ...g[0][c - 1], labels: {} }
        }
        return g
      })
    }
  }, [])

  useEffect(() => {
    gridState.setPuzzleType(puzzleType)
    if (clickActionLeft) {
      gridState.setInputMode('suggested')
    }
    if (puzzleType === 'starbattle') {
      if (!autoCrossRules.includes('king')) {
        setAutoCrossRulesState(prev => prev.includes('king') ? prev : [...prev, 'king'])
      }
    }
    if (puzzleType === 'murdoku') {
      if (!autoCrossRules.includes('rook')) {
        setAutoCrossRulesState(prev => prev.includes('rook') ? prev : [...prev, 'rook'])
      }
    }

    const prev = prevPuzzleType.current
    const prevRules = PUZZLE_TYPE_RULES[prev] || []
    const nextRules = PUZZLE_TYPE_RULES[puzzleType] || []

    // Remove old layout rules when switching away
    if (prevRules.length > 0 && puzzleType !== prev) {
      const removeSet = new Set(prevRules)
      setRules(r => r.filter(rule => !removeSet.has(rule)))
    }

    // Add new layout rules when switching to
    if (nextRules.length > 0 && puzzleType !== prev) {
      setRules(r => {
        const existing = new Set(r)
        const toAdd = nextRules.filter(rule => !existing.has(rule))
        return toAdd.length > 0 ? [...r, ...toAdd] : r
      })
    }

    prevPuzzleType.current = puzzleType
  }, [puzzleType])

  useKeyboard({
    inputMode: gridState.inputMode,
    applyValue: gridState.applyValue,
    applyColor: gridState.applyColor,
    applyFixedValue: gridState.applyFixedValue,
    applyFixedColor: gridState.applyFixedColor,
    addNote: gridState.addNote,
    clearValues: gridState.clearValues,
    eraseColor: gridState.eraseColor,
    undo: handleUndo,
    redo: handleRedo,
    onActiveColorChange: gridState.setActiveColor,
    onActiveMarkChange: gridState.setActiveMark,
    toggleMark: gridState.toggleMark,
    hasSelection: gridState.selection.length > 0,
    onInputModeChange: gridState.setInputMode,
    puzzleType,
    isEditor: true,
    onEnter: () => {
      if (selectedImageIndex !== null && imageLibrary[selectedImageIndex]) {
        gridState.applyImage(imageLibrary[selectedImageIndex])
      }
    },
  })

  const handleResizeGrid = async () => {
    if (!await showConfirm('This will clear all cell data. To add rows/columns without clearing, use the + buttons around the grid instead.', 'Resize Grid')) return
    // Icebarn: add +2 to each dimension for fog border
    // Star Battle: add +1 row for fog header
    const actualRows = puzzleType === 'icebarn' ? rows + 2 : puzzleType === 'starbattle' ? rows + 1 : rows
    const actualCols = puzzleType === 'icebarn' ? cols + 2 : cols
    gridState.resetGrid(actualRows, actualCols)
    setFogGroups([])
    gridScale.resetZoom()
    // Icebarn: add border fog + IN/OUT labels
    if (puzzleType === 'icebarn') {
      gridState.setGrid(prev => {
        const g = prev.map(r => r.map(c => ({ ...c, labels: { ...c.labels } })))
        if (g[0]?.[1]) g[0][1].labels = { middle: { text: 'IN', showThroughFog: true } }
        if (g[actualRows - 1]?.[actualCols - 2]) g[actualRows - 1][actualCols - 2].labels = { middle: { text: 'OUT', showThroughFog: true } }
        return g
      })
      const borderCells: CellPosition[] = []
      for (let r = 0; r < actualRows; r++) {
        for (let c = 0; c < actualCols; c++) {
          if (r === 0 || r === actualRows - 1 || c === 0 || c === actualCols - 1) {
            borderCells.push({ row: r, col: c })
          }
        }
      }
      setFogGroups([{ id: 'fog-border', cells: borderCells, triggers: [] }])
    }
    // Star Battle: add top-row fog + "1" and star labels
    if (puzzleType === 'starbattle') {
      gridState.setGrid(prev => {
        const g = prev.map(r => r.map(c => ({ ...c, labels: { ...c.labels } })))
        if (g[0]?.[actualCols - 2]) g[0][actualCols - 2].labels = { middle: { text: '1', showThroughFog: true } }
        if (g[0]?.[actualCols - 1]) g[0][actualCols - 1].labels = { middle: { text: '\u2605', showThroughFog: true } }
        return g
      })
      const topRowCells: CellPosition[] = []
      for (let c = 0; c < actualCols; c++) {
        topRowCells.push({ row: 0, col: c })
      }
      setFogGroups([{ id: 'fog-header', cells: topRowCells, triggers: [] }])
    }
  }

  const handleSave = async () => {
    if (!difficulty) { await showAlert('Please select a difficulty before saving.'); return }
    let id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
    // For new puzzles, ensure unique ID by appending a suffix if needed
    if (!puzzleId) {
      const index = await fetchPuzzleIndex()
      const existingIds = new Set(index.map(e => e.id))
      if (existingIds.has(id)) {
        let n = 2
        while (existingIds.has(`${id}-${n}`)) n++
        id = `${id}-${n}`
      }
    }
    const puzzle = gridToPuzzle(gridState.grid, { id, title: title || 'Untitled', authors, specialRules: specialRules.length ? specialRules : undefined, rules, clues, difficulty, tags, autoCrossRules, puzzleType: puzzleType || undefined, clickActionLeft: clickActionLeft || undefined, clickActionRight: clickActionRight || undefined, fogGroups: fogGroups.length ? fogGroups : undefined, inProgress: inProgress || undefined })

    if (puzzleId) {
      puzzle.id = puzzleId
    }
    setEditorPuzzleId(puzzle.id)
    if (import.meta.env.DEV) {
      const result = await savePuzzleToServer(puzzle)
      if (result.ok) {
        clearDraft()
        await showAlert(`Saved to puzzles/${result.file}`, 'Saved')
        if (!puzzleId) navigate(`/edit/${puzzle.id}`, { replace: true })
        return
      }
    }
    clearDraft()
    downloadPuzzleJSON(puzzle)
  }

  const handleClearAll = async () => {
    if (await showConfirm('Are you sure you want to clear all? This cannot be undone.', 'Clear All')) {
      gridState.resetGrid(rows, cols)
    }
  }

  const handleDiscardDraft = async () => {
    if (!await showConfirm('Discard draft and reload puzzle from file?', 'Discard Draft')) return
    clearDraft()
    if (puzzleId) {
      // Reload from file
      const puzzle = await fetchPuzzle(puzzleId)
      if (puzzle) loadPuzzleIntoEditor(puzzle)
    } else {
      gridState.resetGrid(rows, cols)
    }
  }

  const clearPlayerInput = useCallback(() => {
    gridState.setGrid(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          value: null,
          notes: [],
          color: null,
          crossed: false,
          mark: null,
          selected: false,
          edgeCrosses: [false, false, false, false] as [boolean, boolean, boolean, boolean],
          borders: [...cell.fixedBorders] as [number, number, number, number],
        }))
      )
    )
    setRevealedFogGroupIds(new Set())
  }, [gridState])

  const handleClearPlayerInput = async () => {
    if (!await showConfirm('Clear all player input? Puzzle layout (fixed values, colors, borders, images, labels) will be kept.', 'Clear Player Input')) return
    clearPlayerInput()
  }

  const handleClearSolutionInput = () => {
    clearPlayerInput()
  }

  function extractPuzzleDefinition(grid: CellData[][]): object {
    return grid.map(row => row.map(cell => ({
      fv: cell.fixedValue, fc: cell.fixedColor, fb: cell.fixedBorders, l: cell.labels, i: cell.image,
    })))
  }

  const handleEnterSolutionMode = async () => {
    const snapshot = JSON.stringify(extractPuzzleDefinition(gridState.grid))
    setPuzzleSnapshot(snapshot)
    clearPlayerInput()
    if (puzzleType === 'nurikabe' || puzzleType === 'heyawake') {
      gridState.setInputMode('color')
      gridState.setActiveColor('9')
    } else if (puzzleType === 'starbattle') {
      gridState.setInputMode('mark')
      gridState.setActiveMark('star')
    } else {
      gridState.setInputMode('normal')
    }
    // Load existing solution if any (only when puzzle is on server)
    if (puzzleId) {
      const existing = await fetchPuzzleSolution(puzzleId)
      if (existing && (Object.keys(existing.cells).length > 0 || Object.keys(existing.borders || {}).length > 0 || Object.keys(existing.colors || {}).length > 0)) {
        gridState.setGrid(prev => {
          const next = prev.map(row => row.map(cell => ({ ...cell })))
          for (const [key, val] of Object.entries(existing.cells)) {
            const [r, c] = key.split(',').map(Number)
            if (next[r]?.[c]) next[r][c].value = val
          }
          if (existing.borders) {
            for (const [key, b] of Object.entries(existing.borders)) {
              const [r, c] = key.split(',').map(Number)
              if (next[r]?.[c]) next[r][c].borders = b
            }
          }
          if (existing.colors) {
            for (const [key, col] of Object.entries(existing.colors)) {
              const [r, c] = key.split(',').map(Number)
              if (next[r]?.[c]) next[r][c].color = col
            }
          }
          return next
        })
      }
    }
    setSolutionMode(true)
    if (clickActionLeft) {
      gridState.setInputMode('suggested')
    }
  }

  const handleExitSolutionMode = () => {
    clearPlayerInput()
    setSolutionMode(false)
  }

  const handleSaveSolution = async () => {
    const solutionId = editorPuzzleId || 'untitled'
    const currentSnapshot = JSON.stringify(extractPuzzleDefinition(gridState.grid))
    if (currentSnapshot !== puzzleSnapshot) {
      if (!await showConfirm('The puzzle definition has changed since entering solution mode. The solution may be invalid. Save anyway?', 'Definition Changed')) return
    }
    const cells: Record<string, string> = {}
    const borders: Record<string, [number, number, number, number]> = {}
    const colors: Record<string, string> = {}
    const solutionLines: Record<string, [boolean, boolean, boolean, boolean]> = {}
    const solutionMarks: Record<string, string> = {}
    for (let r = 0; r < gridState.grid.length; r++) {
      for (let c = 0; c < gridState.grid[r].length; c++) {
        const cell = gridState.grid[r][c]
        if (cell.value) cells[`${r},${c}`] = cell.value
        const fb = cell.fixedBorders
        const b = cell.borders
        if (b[0] !== fb[0] || b[1] !== fb[1] || b[2] !== fb[2] || b[3] !== fb[3]) {
          borders[`${r},${c}`] = b
        }
        if (cell.color && !cell.fixedColor) colors[`${r},${c}`] = cell.color
        if (cell.mark && !cell.fixedMark) solutionMarks[`${r},${c}`] = cell.mark
        const fl = cell.fixedLines
        const l = cell.lines
        if ((l[0] && !fl[0]) || (l[1] && !fl[1]) || (l[2] && !fl[2]) || (l[3] && !fl[3])) {
          solutionLines[`${r},${c}`] = [...l] as [boolean, boolean, boolean, boolean]
        }
      }
    }
    if (Object.keys(cells).length === 0 && Object.keys(borders).length === 0 && Object.keys(colors).length === 0 && Object.keys(solutionLines).length === 0 && Object.keys(solutionMarks).length === 0) {
      await showAlert('No solution values, borders, colors, lines, or marks entered.'); return
    }
    const solution: PuzzleSolution = { id: solutionId, cells }
    if (Object.keys(borders).length > 0) solution.borders = borders
    if (Object.keys(colors).length > 0) solution.colors = colors
    if (Object.keys(solutionLines).length > 0) solution.lines = solutionLines
    if (Object.keys(solutionMarks).length > 0) solution.marks = solutionMarks
    if (import.meta.env.DEV) {
      const result = await saveSolutionToServer(solution)
      if (result.ok) {
        await showAlert(`Solution saved to puzzles/solutions/${result.file}`, 'Saved')
        return
      }
    }
    downloadSolutionJSON(solution)
  }

  const processImageFile = (file: File) => {
    if (file.size > 200 * 1024) {
      showAlert(`Image "${file.name}" must be under 200KB.`)
      return
    }
    const img = new Image()
    img.onload = () => {
      const maxDim = 50
      const scale = maxDim / Math.max(img.width, img.height)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const base64 = canvas.toDataURL('image/png')
      setImageLibrary(prev => {
        if (prev.includes(base64)) return prev
        return [...prev, base64]
      })
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      processImageFile(file)
    }
    e.target.value = ''
  }

  const [editingItem, setEditingItem] = useState<{ type: 'specialRule' | 'rule' | 'clue'; index: number } | null>(null)
  const [editingText, setEditingText] = useState('')
  const dragItem = useRef<{ type: 'specialRule' | 'rule' | 'clue'; index: number } | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = useCallback((type: 'specialRule' | 'rule' | 'clue', index: number) => {
    dragItem.current = { type, index }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragOverItem.current = index
  }, [])

  const handleDrop = useCallback((type: 'specialRule' | 'rule' | 'clue') => {
    if (!dragItem.current || dragOverItem.current === null || dragItem.current.type !== type) return
    const from = dragItem.current.index
    const to = dragOverItem.current
    if (from === to) return
    const setter = type === 'specialRule' ? setSpecialRules : type === 'rule' ? setRules : setClues
    setter(prev => {
      const items = [...prev]
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return items
    })
    dragItem.current = null
    dragOverItem.current = null
  }, [])

  const startEditing = useCallback((type: 'specialRule' | 'rule' | 'clue', index: number, text: string) => {
    setEditingItem({ type, index })
    setEditingText(text)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingItem) return
    const trimmed = editingText.trim()
    const setter = editingItem.type === 'specialRule' ? setSpecialRules : editingItem.type === 'rule' ? setRules : setClues
    if (trimmed) {
      setter(prev => prev.map((item, i) => i === editingItem.index ? trimmed : item))
    } else {
      setter(prev => prev.filter((_, i) => i !== editingItem.index))
    }
    setEditingItem(null)
    setEditingText('')
  }, [editingItem, editingText])

  // --- Fog of War editor handlers ---
  const handleFogGroupAdd = useCallback(() => {
    prevInputMode.current = gridState.inputMode
    gridState.setInputMode('fog' as InputMode)
    gridState.clearSelection()
    setFogEditStep('pickFogCells')
    setFogPendingCells([])
    setFogPendingTriggers([])
    setFogPendingTriggerCells([])
    setFogEditingGroupId(null)
    setFogPreviewGroupId(null)
  }, [gridState])

  const handleFogConfirmCells = useCallback(() => {
    const sel = gridState.selection
    if (sel.length === 0) return
    setFogPendingCells([...sel])
    gridState.clearSelection()
    gridState.setInputMode(prevInputMode.current)
    setFogEditStep('pickTrigger')
  }, [gridState])

  const handleFogSelectTriggerCells = useCallback(() => {
    prevInputMode.current = gridState.inputMode
    gridState.setInputMode('fog' as InputMode)
    gridState.clearSelection()
    setFogEditStep('pickTriggerCells')
  }, [gridState])

  const handleFogConfirmTriggerCells = useCallback(() => {
    const sel = gridState.selection
    if (sel.length === 0) return
    setFogPendingTriggerCells([...sel])
    gridState.clearSelection()
    gridState.setInputMode(prevInputMode.current)
    fogEditingTrigger.current = null
    setFogEditStep('pickTrigger')
  }, [gridState])


  const handleFogTriggerMatchModeChange = useCallback((index: number, mode: 'all' | 'any') => {
    setFogPendingTriggers(prev => prev.map((t, i) => i === index ? { ...t, matchMode: mode } : t))
  }, [])

  const handleFogTriggerNegateChange = useCallback((index: number, negate: boolean) => {
    setFogPendingTriggers(prev => prev.map((t, i) => i === index ? { ...t, negate: negate || undefined } : t))
  }, [])

  const handleFogAddTrigger = useCallback((trigger: FogTrigger) => {
    setFogPendingTriggers(prev => [...prev, { ...trigger, matchMode: trigger.matchMode || 'all' }])
    setFogPendingTriggerCells([])
  }, [])

  const handleFogRemoveTrigger = useCallback((index: number) => {
    setFogPendingTriggers(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleFogHighlightTrigger = useCallback((trigger: FogTrigger) => {
    gridState.clearSelection()
    gridState.commitSelection(trigger.cells, false)
  }, [gridState])

  const handleFogEditTrigger = useCallback((index: number) => {
    const trigger = fogPendingTriggers[index]
    if (!trigger) return
    // Stash the trigger so it can be restored on cancel
    fogEditingTrigger.current = { index, trigger }
    // Remove this trigger from the list — it will be re-added after editing
    setFogPendingTriggers(prev => prev.filter((_, i) => i !== index))
    // Pre-select the trigger's cells and enter pickTriggerCells
    prevInputMode.current = gridState.inputMode
    gridState.setInputMode('fog' as InputMode)
    // Set the cells as selected on the grid so user can ctrl-click to add more
    gridState.commitSelection(trigger.cells, false)
    setFogEditStep('pickTriggerCells')
  }, [fogPendingTriggers, gridState])

  const handleFogFinishGroup = useCallback(() => {
    if (fogEditingGroupId) {
      // Update existing group in-place
      setFogGroups(prev => prev.map(g =>
        g.id === fogEditingGroupId
          ? { ...g, cells: fogPendingCells, triggers: fogPendingTriggers, triggerMode: fogPendingTriggerMode }
          : g
      ))
    } else {
      const id = `fog-${Date.now()}`
      const newGroup: FogGroup = {
        id,
        cells: fogPendingCells,
        triggers: fogPendingTriggers,
        triggerMode: fogPendingTriggerMode,
      }
      setFogGroups(prev => [...prev, newGroup])
    }
    setFogEditStep('idle')
    setFogPendingCells([])
    setFogPendingTriggers([])
    setFogPendingTriggerCells([])
    setFogPendingTriggerMode('all')
    setFogEditingGroupId(null)
  }, [fogPendingCells, fogPendingTriggers, fogPendingTriggerMode, fogEditingGroupId])

  const handleFogCancel = useCallback(() => {
    gridState.clearSelection()
    if (fogEditStep === 'pickFogCells' || fogEditStep === 'pickTriggerCells') {
      gridState.setInputMode(prevInputMode.current)
    }
    if (fogEditStep === 'pickTriggerCells') {
      // Restore stashed trigger if we were editing one
      if (fogEditingTrigger.current) {
        const { index, trigger } = fogEditingTrigger.current
        setFogPendingTriggers(prev => {
          const next = [...prev]
          next.splice(index, 0, trigger)
          return next
        })
        fogEditingTrigger.current = null
      }
      // Go back to pickTrigger instead of idle
      setFogEditStep('pickTrigger')
      return
    }
    setFogEditStep('idle')
    setFogPendingCells([])
    setFogPendingTriggers([])
    setFogPendingTriggerCells([])
    setFogEditingGroupId(null)
  }, [gridState, fogEditStep])

  const handleFogGroupDelete = useCallback((id: string) => {
    setFogGroups(prev => prev.filter(g => g.id !== id))
    if (fogPreviewGroupId === id) setFogPreviewGroupId(null)
  }, [fogPreviewGroupId])

  const handleFogGroupSelect = useCallback((id: string) => {
    const toggling = fogPreviewGroupId === id
    setFogPreviewGroupId(toggling ? null : id)
    if (toggling) {
      gridState.clearSelection()
    } else {
      // Highlight trigger cells with normal yellow selection
      const group = fogGroups.find(g => g.id === id)
      if (group) {
        const triggerCells: CellPosition[] = []
        for (const t of group.triggers) {
          for (const c of t.cells) {
            if (!triggerCells.some(tc => tc.row === c.row && tc.col === c.col)) {
              triggerCells.push(c)
            }
          }
        }
        gridState.clearSelection()
        if (triggerCells.length > 0) {
          gridState.commitSelection(triggerCells)
        }
      }
    }
  }, [fogPreviewGroupId, fogGroups, gridState])

  const handleFogGroupEdit = useCallback((id: string) => {
    const group = fogGroups.find(g => g.id === id)
    if (!group) return
    setFogEditingGroupId(id)
    setFogPendingCells([...group.cells])
    setFogPendingTriggers([...group.triggers])
    setFogPendingTriggerMode(group.triggerMode || 'all')
    setFogPendingTriggerCells([])
    setFogPreviewGroupId(null)
    setFogEditStep('pickTrigger')
  }, [fogGroups])

  const handleFogReSelectFogCells = useCallback(() => {
    prevInputMode.current = gridState.inputMode
    gridState.setInputMode('fog' as InputMode)
    gridState.clearSelection()
    // Pre-select existing fog cells so the user can add/remove incrementally
    if (fogPendingCells.length > 0) {
      gridState.commitSelection(fogPendingCells, false)
    }
    setFogEditStep('pickFogCells')
  }, [gridState, fogPendingCells])

  // Compute fog preview cells for editor display
  const fogPreviewCells = useMemo(() => {
    // Show pending cells during editing
    if ((fogEditStep === 'pickTrigger' || fogEditStep === 'pickTriggerCells') && fogPendingCells.length > 0) {
      const set = new Set<string>()
      for (const c of fogPendingCells) set.add(`${c.row},${c.col}`)
      return set
    }
    // Show selected group when clicking its name (fogged cells only — trigger cells use yellow selection)
    if (fogPreviewGroupId) {
      const group = fogGroups.find(g => g.id === fogPreviewGroupId)
      if (group) {
        const set = new Set<string>()
        for (const c of group.cells) set.add(`${c.row},${c.col}`)
        return set
      }
    }
    // In idle or pickFogCells mode, show existing fog cells as preview
    if (fogGroups.length > 0 && (fogEditStep === 'idle' || fogEditStep === 'pickFogCells')) {
      return computeFoggedCells(fogGroups, revealedFogGroupIds)
    }
    return undefined
  }, [fogEditStep, fogPendingCells, fogPreviewGroupId, fogGroups, revealedFogGroupIds])

  // Evaluate fog triggers in editor so user can test them
  useEffect(() => {
    if (!fogGroups.length) return
    const newlyRevealed = evaluateNewReveals(gridState.grid, fogGroups, revealedFogGroupIds)
    if (newlyRevealed.length > 0) {
      setRevealedFogGroupIds(prev => {
        const next = new Set(prev)
        for (const id of newlyRevealed) next.add(id)
        return next
      })
    }
  }, [gridState.grid, fogGroups, revealedFogGroupIds])

  // Reset revealed fog groups when fog groups change (e.g. edited/deleted)
  useEffect(() => {
    setRevealedFogGroupIds(new Set())
  }, [fogGroups])

  const handleImageSelect = useCallback((index: number | null) => {
    setSelectedImageIndex(index)
    if (index !== null) {
      gridState.setInputMode('normal')
    }
  }, [gridState])

  const rightDragAction = useRef<boolean | undefined>(undefined)

  const handleRightClickCell = useCallback((pos: CellPosition, isFirst: boolean) => {
    if (!clickActionRight) return
    if (isFirst) {
      const matches = cellMatchesAction(gridState.grid[pos.row][pos.col], clickActionRight)
      rightDragAction.current = !matches // true = apply, false = clear
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionRight, undefined, autoCrossRules))
    } else {
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionRight, rightDragAction.current, autoCrossRules))
    }
  }, [clickActionRight, autoCrossRules, gridState])

  // Map click action string to the effective inputMode / activeColor / activeMark
  const suggestedEffectiveMode: InputMode = (() => {
    if (!clickActionLeft) return 'normal'
    if (clickActionLeft === 'line') return 'line'
    if (clickActionLeft.startsWith('color:')) return 'color'
    if (clickActionLeft.startsWith('mark:')) return 'mark'
    if (clickActionLeft === 'cross') return 'cross'
    return 'normal'
  })()
  const suggestedActiveColor = clickActionLeft?.startsWith('color:') ? clickActionLeft.split(':')[1] : null
  const suggestedActiveMark = clickActionLeft?.startsWith('mark:') ? clickActionLeft.split(':')[1] as MarkShape : null

  // Line mode cell-center left-click: cycle empty → black → dot → empty
  const handleLineCenterClick = useCallback((pos: CellPosition) => {
    gridState.setGridWithUndo(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })))
      const cell = next[pos.row][pos.col]
      if (cell.color === '9') {
        cell.color = null
        cell.mark = 'dot' as MarkShape
      } else if (cell.mark === 'dot') {
        cell.mark = null
      } else {
        cell.color = '9'
        cell.mark = null
      }
      return next
    })
  }, [gridState])

  // Line mode cell-center right-click: toggle dot (clear black if present)
  const handleLineRightCenterClick = useCallback((pos: CellPosition) => {
    gridState.setGridWithUndo(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })))
      const cell = next[pos.row][pos.col]
      if (cell.mark === 'dot') {
        cell.mark = null
      } else {
        cell.mark = 'dot' as MarkShape
        cell.color = null
      }
      return next
    })
  }, [gridState])

  const isSuggestedMode = gridState.inputMode === 'suggested'

  // Suggested mode: per-cell left-click handler (same pattern as right-click)
  const leftDragAction = useRef<boolean | undefined>(undefined)

  const handleLeftClickCell = useCallback((pos: CellPosition, isFirst: boolean) => {
    if (!clickActionLeft) return
    if (isFirst) {
      const matches = cellMatchesAction(gridState.grid[pos.row][pos.col], clickActionLeft)
      leftDragAction.current = !matches
      gridState.setGridWithUndo(prev => applyActionToGrid(prev, pos, clickActionLeft, undefined, autoCrossRules))
    } else {
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionLeft, leftDragAction.current, autoCrossRules))
    }
  }, [clickActionLeft, autoCrossRules, gridState])

  // Touch drag: still uses onDragChange since touch goes through onSelectionChange
  const touchProcessed = useRef<Set<string>>(new Set())
  const touchCycleAction = useRef<string | null>(null)

  const handleDragChange = useCallback((sel: CellPosition[]) => {
    if (!isSuggestedMode || !clickActionLeft || clickActionLeft === 'line') {
      gridState.onDragChange(sel)
      return
    }
    if (sel.length === 0) return
    const newCells: CellPosition[] = []
    const wasEmpty = touchProcessed.current.size === 0
    for (const pos of sel) {
      const key = `${pos.row},${pos.col}`
      if (touchProcessed.current.has(key)) continue
      touchProcessed.current.add(key)
      newCells.push(pos)
    }
    if (newCells.length === 0) return
    for (let i = 0; i < newCells.length; i++) {
      const pos = newCells[i]
      const cellIsFirst = wasEmpty && i === 0
      const cellSetter = cellIsFirst ? gridState.setGridWithUndo : gridState.setGrid
      cellSetter(prev => {
        const cell = prev[pos.row][pos.col]
        let action: string
        if (cellIsFirst) {
          if (cellMatchesAction(cell, clickActionLeft)) {
            action = clickActionRight || 'clear'
          } else if (clickActionRight && cellMatchesAction(cell, clickActionRight)) {
            action = 'clear'
          } else {
            action = clickActionLeft
          }
          touchCycleAction.current = action
        } else {
          action = touchCycleAction.current || clickActionLeft
        }
        if (action === 'clear') return applyActionToGrid(prev, pos, clickActionLeft, false)
        const mid = applyActionToGrid(prev, pos, clickActionLeft, false)
        return applyActionToGrid(mid, pos, action, true, autoCrossRules)
      })
    }
  }, [isSuggestedMode, clickActionLeft, clickActionRight, autoCrossRules, gridState])

  const handleCommitSelection = useCallback((sel: CellPosition[], ctrlHeld?: boolean) => {
    if (isSuggestedMode) {
      touchProcessed.current.clear()
      touchCycleAction.current = null
      return
    }
    gridState.commitSelection(sel, ctrlHeld)
  }, [isSuggestedMode, gridState])

  const handleClearSelection = useCallback(() => {
    touchProcessed.current.clear()
    gridState.clearSelection()
    if (fogPreviewGroupId) setFogPreviewGroupId(null)
  }, [gridState, fogPreviewGroupId])

  // --- Row/column header selection ---
  const headerDragging = useRef(false)
  const headerDragAxis = useRef<'row' | 'col'>('row')
  const headerDragStart = useRef(0)

  const selectRowOrCol = useCallback((axis: 'row' | 'col', index: number, ctrlHeld: boolean) => {
    const g = gridState.grid
    const cells: CellPosition[] = axis === 'row'
      ? g[index].map((_, c) => ({ row: index, col: c }))
      : g.map((_, r) => ({ row: r, col: index }))
    if (!ctrlHeld) handleClearSelection()
    handleCommitSelection(cells, ctrlHeld)
  }, [gridState.grid, handleClearSelection, handleCommitSelection])

  const selectHeaderRange = useCallback((axis: 'row' | 'col', from: number, to: number, ctrlHeld: boolean) => {
    const g = gridState.grid
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    const cells: CellPosition[] = []
    for (let i = lo; i <= hi; i++) {
      if (axis === 'row') {
        for (let c = 0; c < (g[0]?.length ?? 0); c++) cells.push({ row: i, col: c })
      } else {
        for (let r = 0; r < g.length; r++) cells.push({ row: r, col: i })
      }
    }
    if (!ctrlHeld) handleClearSelection()
    handleCommitSelection(cells, ctrlHeld)
  }, [gridState.grid, handleClearSelection, handleCommitSelection])

  const handleHeaderMouseDown = useCallback((axis: 'row' | 'col', index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    headerDragging.current = true
    headerDragAxis.current = axis
    headerDragStart.current = index
    selectRowOrCol(axis, index, e.ctrlKey)
  }, [selectRowOrCol])

  const handleHeaderMouseEnter = useCallback((axis: 'row' | 'col', index: number, e: React.MouseEvent) => {
    if (!headerDragging.current || axis !== headerDragAxis.current) return
    e.preventDefault()
    selectHeaderRange(axis, headerDragStart.current, index, e.ctrlKey)
  }, [selectHeaderRange])

  useEffect(() => {
    const handleUp = () => { headerDragging.current = false }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [])

  // Determine which rows/cols are fully selected for header highlighting
  const selectedRows = useMemo(() => {
    const set = new Set<number>()
    if (gridState.selection.length === 0) return set
    const colCount = gridState.grid[0]?.length ?? 0
    if (colCount === 0) return set
    const byRow = new Map<number, number>()
    for (const p of gridState.selection) {
      byRow.set(p.row, (byRow.get(p.row) ?? 0) + 1)
    }
    for (const [r, count] of byRow) {
      if (count >= colCount) set.add(r)
    }
    return set
  }, [gridState.selection, gridState.grid])

  const selectedCols = useMemo(() => {
    const set = new Set<number>()
    if (gridState.selection.length === 0) return set
    const rowCount = gridState.grid.length
    if (rowCount === 0) return set
    const byCol = new Map<number, number>()
    for (const p of gridState.selection) {
      byCol.set(p.col, (byCol.get(p.col) ?? 0) + 1)
    }
    for (const [c, count] of byCol) {
      if (count >= rowCount) set.add(c)
    }
    return set
  }, [gridState.selection, gridState.grid])

  const handleIconAdd = useCallback((base64: string) => {
    setImageLibrary(prev => {
      if (prev.includes(base64)) return prev
      return [...prev, base64]
    })
  }, [])

  const handleImageApply = () => {
    if (selectedImageIndex === null || !imageLibrary[selectedImageIndex]) return
    gridState.applyImage(imageLibrary[selectedImageIndex])
  }

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const puzzle: PuzzleData = JSON.parse(reader.result as string)
        migratePuzzleType(puzzle)
        setEditorPuzzleId(puzzle.id)
        loadPuzzleIntoEditor(puzzle)
      } catch {
        showAlert('Invalid puzzle JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page-layout">
      <ResizableLeft>
        <InfoPanel title={solutionMode ? 'Solution Mode' : 'Puzzle Editor'} backLink headerRight={<>{(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="checkbox" checked={inProgress} onChange={e => setInProgress(e.target.checked)} />In Progress</label>}<LanguagePicker /><ThemeToggle theme={theme} onToggle={toggleTheme} /></>}>
          {solutionMode ? (<>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              Place the correct values for each cell. Only normal inputs (values) and borders will be saved as the solution.
            </p>
            <button className="info-btn" onClick={handleSaveSolution}>Save Solution</button>
            <button className="info-btn" onClick={handleClearSolutionInput}>Clear Solution Input</button>
            <button className="info-btn" onClick={handleExitSolutionMode}>Exit Solution Mode</button>

            {clues.length > 0 && (<>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />
              <div className="info-section-title" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Clues</div>
              {clues.map((clue, i) => (
                <div key={i} className="info-list-item">
                  <span className="info-list-text">{clue}</span>
                </div>
              ))}
            </>)}
          </>) : (<>
            <div className="info-editor-field">
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="My Puzzle" />
            </div>
            <div className="info-editor-field">
              <label>Authors</label>
              <PillInput values={authors} onChange={setAuthors} known={knownAuthors} placeholder="Add authors..." />
            </div>
            <div className="info-editor-field">
              <label>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="">— None —</option>
                <option value="Very easy">Very easy</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Very hard">Very hard</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            <div className="info-editor-field">
              <label>Tags</label>
              <PillInput values={tags} onChange={setTags} known={knownTags} placeholder="Add tags..." />
            </div>
            <div className="info-editor-field">
              <label>Auto-Cross Rules</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                {(['king', 'rook', 'bishop', 'knight'] as AutoCrossRule[]).map(rule => (
                  <label key={rule} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoCrossRules.includes(rule)}
                      onChange={e => {
                        setAutoCrossRulesState(prev =>
                          e.target.checked ? [...prev, rule] : prev.filter(r => r !== rule)
                        )
                        e.target.blur()
                      }}
                    />
                    {rule.charAt(0).toUpperCase() + rule.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="info-editor-field">
              <label>Puzzle Type</label>
              <select value={puzzleType} onChange={e => handlePuzzleTypeChange(e.target.value)}>
                <option value="">— None —</option>
                <option value="nurikabe">Nurikabe</option>
                <option value="heyawake">Heyawake</option>
                <option value="starbattle">Star Battle</option>
                <option value="spiralgalaxy">Spiral Galaxy</option>
                <option value="slalom">Slalom</option>
                <option value="icebarn">Icebarn</option>
                <option value="yajilin">Yajilin</option>
                <option value="cave">Cave</option>
                <option value="cocktaillamp">Cocktail Lamp</option>
                <option value="lits">LITS</option>
                <option value="archipelago">Archipelago</option>
                <option value="icewalk">Ice Walk</option>
                <option value="murdoku">Murdoku</option>
              </select>
            </div>
            <div className="info-editor-field">
              <label>Left Click Action</label>
              <select value={clickActionLeft} onChange={e => setClickActionLeft(e.target.value)}>
                <option value="">None</option>
                <optgroup label="Colors">
                  <option value="color:0">Gray</option>
                  <option value="color:1">Red</option>
                  <option value="color:2">Pink</option>
                  <option value="color:3">Orange</option>
                  <option value="color:4">Yellow</option>
                  <option value="color:5">Green</option>
                  <option value="color:6">Cyan</option>
                  <option value="color:7">Blue</option>
                  <option value="color:8">Purple</option>
                  <option value="color:9">Black</option>
                </optgroup>
                <optgroup label="Marks">
                  <option value="mark:circle">Circle</option>
                  <option value="mark:square">Square</option>
                  <option value="mark:triangle">Triangle</option>
                  <option value="mark:diamond">Diamond</option>
                  <option value="mark:pentagon">Pentagon</option>
                  <option value="mark:hexagon">Hexagon</option>
                  <option value="mark:star">Star</option>
                  <option value="mark:dot">Dot</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="cross">Cross</option>
                  <option value="line">Line</option>
                </optgroup>
              </select>
            </div>
            <div className="info-editor-field">
              <label>Right Click Action</label>
              <select value={clickActionRight} onChange={e => setClickActionRight(e.target.value)}>
                <option value="">None</option>
                <optgroup label="Colors">
                  <option value="color:0">Gray</option>
                  <option value="color:1">Red</option>
                  <option value="color:2">Pink</option>
                  <option value="color:3">Orange</option>
                  <option value="color:4">Yellow</option>
                  <option value="color:5">Green</option>
                  <option value="color:6">Cyan</option>
                  <option value="color:7">Blue</option>
                  <option value="color:8">Purple</option>
                  <option value="color:9">Black</option>
                </optgroup>
                <optgroup label="Marks">
                  <option value="mark:circle">Circle</option>
                  <option value="mark:square">Square</option>
                  <option value="mark:triangle">Triangle</option>
                  <option value="mark:diamond">Diamond</option>
                  <option value="mark:pentagon">Pentagon</option>
                  <option value="mark:hexagon">Hexagon</option>
                  <option value="mark:star">Star</option>
                  <option value="mark:dot">Dot</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="cross">Cross</option>
                </optgroup>
              </select>
            </div>
            <div className="info-editor-row">
              <div className="info-editor-field">
                <label>Rows</label>
                <input type="number" value={rows} onChange={e => setRows(Math.min(99, Math.max(1, Number(e.target.value))))} min={1} max={99} onKeyDown={e => { if (e.key === 'Enter') handleResizeGrid() }} />
              </div>
              <div className="info-editor-field">
                <label>Cols</label>
                <input type="number" value={cols} onChange={e => setCols(Math.min(99, Math.max(1, Number(e.target.value))))} min={1} max={99} onKeyDown={e => { if (e.key === 'Enter') handleResizeGrid() }} />
              </div>
            </div>
            <button className="info-btn" onClick={handleResizeGrid}>Resize Grid</button>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />
            <button className="info-btn" onClick={handleSave}>Save (Download JSON)</button>
            <button className="info-btn" onClick={() => fileInputRef.current?.click()}>Load JSON</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoad}
            />
            <button className="info-btn" onClick={handleClearAll}>Clear All</button>
            <button className="info-btn" onClick={handleClearPlayerInput}>Clear Player Input</button>
            <button className="info-btn" onClick={handleDiscardDraft}>Discard Draft</button>
            <button className="info-btn" onClick={handleEnterSolutionMode}>Enter Solution Mode</button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleImageImport}
            />

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />

            <div className="info-section-title" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Rules</div>
            {rules.map((rule, i) => (
              <div
                key={i}
                className="info-list-item info-list-draggable"
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('rule')}
              >
                <span className="info-drag-handle" title="Drag to reorder" draggable onDragStart={() => handleDragStart('rule', i)}>&#x2630;</span>
                {editingItem?.type === 'rule' && editingItem.index === i ? (
                  <input
                    className="info-edit-input"
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingItem(null); setEditingText('') } }}
                    autoFocus
                  />
                ) : (
                  <span className="info-list-text info-list-editable" onClick={() => startEditing('rule', i, rule)}>{rule}</span>
                )}
                <button className="info-list-remove" onClick={() => setRules(rules.filter((_, j) => j !== i))} title="Remove">&times;</button>
              </div>
            ))}
            <div className="info-add-row">
              <input
                className="info-add-input"
                value={newRule}
                onChange={e => setNewRule(e.target.value)}
                placeholder="Add a rule..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && newRule.trim()) {
                    setRules([...rules, newRule.trim()])
                    setNewRule('')
                  }
                }}
              />
              <button className="info-add-btn" onClick={() => {
                if (newRule.trim()) {
                  setRules([...rules, newRule.trim()])
                  setNewRule('')
                }
              }}>+</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />

            <div className="info-section-title" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Special Rules</div>
            {specialRules.map((rule, i) => (
              <div
                key={i}
                className="info-list-item info-list-draggable"
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('specialRule')}
              >
                <span className="info-drag-handle" title="Drag to reorder" draggable onDragStart={() => handleDragStart('specialRule', i)}>&#x2630;</span>
                {editingItem?.type === 'specialRule' && editingItem.index === i ? (
                  <input
                    className="info-edit-input"
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingItem(null); setEditingText('') } }}
                    autoFocus
                  />
                ) : (
                  <span className="info-list-text info-list-editable" onClick={() => startEditing('specialRule', i, rule)}>{rule}</span>
                )}
                <button className="info-list-remove" onClick={() => setSpecialRules(specialRules.filter((_, j) => j !== i))} title="Remove">&times;</button>
              </div>
            ))}
            <div className="info-add-row">
              <input
                className="info-add-input"
                value={newSpecialRule}
                onChange={e => setNewSpecialRule(e.target.value)}
                placeholder="Add a special rule..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && newSpecialRule.trim()) {
                    setSpecialRules([...specialRules, newSpecialRule.trim()])
                    setNewSpecialRule('')
                  }
                }}
              />
              <button className="info-add-btn" onClick={() => {
                if (newSpecialRule.trim()) {
                  setSpecialRules([...specialRules, newSpecialRule.trim()])
                  setNewSpecialRule('')
                }
              }}>+</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />

            <div className="info-section-title" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Clues</div>
            {clues.map((clue, i) => (
              <div
                key={i}
                className="info-list-item info-list-draggable"
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('clue')}
              >
                <span className="info-drag-handle" title="Drag to reorder" draggable onDragStart={() => handleDragStart('clue', i)}>&#x2630;</span>
                {editingItem?.type === 'clue' && editingItem.index === i ? (
                  <input
                    className="info-edit-input"
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingItem(null); setEditingText('') } }}
                    autoFocus
                  />
                ) : (
                  <span className="info-list-text info-list-editable" onClick={() => startEditing('clue', i, clue)}>{clue}</span>
                )}
                <button className="info-list-remove" onClick={() => setClues(clues.filter((_, j) => j !== i))} title="Remove">&times;</button>
              </div>
            ))}
            <div className="info-add-row">
              <input
                className="info-add-input"
                value={newClue}
                onChange={e => setNewClue(e.target.value)}
                placeholder="Add a clue..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && newClue.trim()) {
                    setClues([...clues, newClue.trim()])
                    setNewClue('')
                  }
                }}
              />
              <button className="info-add-btn" onClick={() => {
                if (newClue.trim()) {
                  setClues([...clues, newClue.trim()])
                  setNewClue('')
                }
              }}>+</button>
            </div>
          </>)}
        </InfoPanel>
      </ResizableLeft>

      <div className="panel-center-col">
        <div
          className="grid-scale-area"
          ref={gridScale.containerRef}
          onMouseDown={e => {
            if (e.button !== 0) return
            if (!(e.target as HTMLElement).closest('.puzzle-grid') && !(e.target as HTMLElement).closest('.grid-header-cell')) {
              gridState.clearSelection()
            }
          }}
        >
          <div className="grid-scale-wrapper" style={gridScale.style}>
            <div className="grid-expand-wrapper">
              <button className="grid-expand-btn grid-expand-top" title="Add row to top" onClick={() => { fogShiftByDepth.current.set(gridState.undoStackLength(), { row: 1, col: 0 }); gridState.addRow('top'); shiftFogGroups(1, 0) }}>+</button>
              <button className="grid-shrink-btn grid-shrink-top" title="Remove top row" onClick={() => { fogShiftByDepth.current.set(gridState.undoStackLength(), { row: -1, col: 0 }); gridState.removeRow('top'); shiftFogGroups(-1, 0) }}>-</button>
              <button className="grid-expand-btn grid-expand-bottom" title="Add row to bottom" onClick={() => gridState.addRow('bottom')}>+</button>
              <button className="grid-shrink-btn grid-shrink-bottom" title="Remove bottom row" onClick={() => gridState.removeRow('bottom')}>-</button>
              <button className="grid-expand-btn grid-expand-left" title="Add column to left" onClick={() => { fogShiftByDepth.current.set(gridState.undoStackLength(), { row: 0, col: 1 }); gridState.addCol('left'); shiftFogGroups(0, 1) }}>+</button>
              <button className="grid-shrink-btn grid-shrink-left" title="Remove left column" onClick={() => { fogShiftByDepth.current.set(gridState.undoStackLength(), { row: 0, col: -1 }); gridState.removeCol('left'); shiftFogGroups(0, -1) }}>-</button>
              <button className="grid-expand-btn grid-expand-right" title="Add column to right" onClick={() => gridState.addCol('right')}>+</button>
              <button className="grid-shrink-btn grid-shrink-right" title="Remove right column" onClick={() => gridState.removeCol('right')}>-</button>
              {/* Column headers (top) */}
              <div className="grid-headers-row top">
                {gridState.grid[0]?.map((_, ci) => (
                  <div key={ci} className={`grid-header-cell${selectedCols.has(ci) ? ' selected' : ''}`}
                    onMouseDown={e => handleHeaderMouseDown('col', ci, e)}
                    onMouseEnter={e => handleHeaderMouseEnter('col', ci, e)}
                  >{colLabel(ci)}</div>
                ))}
              </div>
              {/* Row headers (left) */}
              <div className="grid-headers-col left">
                {gridState.grid.map((_, ri) => (
                  <div key={ri} className={`grid-header-cell${selectedRows.has(ri) ? ' selected' : ''}`}
                    onMouseDown={e => handleHeaderMouseDown('row', ri, e)}
                    onMouseEnter={e => handleHeaderMouseEnter('row', ri, e)}
                  >{ri + 1}</div>
                ))}
              </div>
              <Grid
                grid={gridState.grid}
                selection={gridState.selection}
                debug={debug}
                inputMode={isSuggestedMode ? suggestedEffectiveMode : gridState.inputMode}
                activeColor={isSuggestedMode ? suggestedActiveColor : gridState.activeColor}
                activeMark={isSuggestedMode ? suggestedActiveMark : gridState.activeMark}
                clearSelection={handleClearSelection}
                commitSelection={handleCommitSelection}
                onDragChange={handleDragChange}
                onLeftClickCell={isSuggestedMode && clickActionLeft && clickActionLeft !== 'line' ? handleLeftClickCell : undefined}
                onRightClickCell={clickActionRight && clickActionRight !== 'line' ? handleRightClickCell : undefined}
                onCommitEdges={gridState.commitEdges}
                onCommitFixedEdges={gridState.commitFixedEdges}
                onToggleEdgeCross={gridState.toggleEdgeCross}
                onCycleEdgeMark={gridState.cycleEdgeMark}
                onToggleLine={gridState.toggleLine}
                onToggleFixedLine={gridState.toggleFixedLine}
                onToggleFixedMark={gridState.toggleFixedMark}
                onLineCenterClick={handleLineCenterClick}
                onLineRightCenterClick={handleLineRightCenterClick}
                isPinching={gridScale.isPinching}
                fogPreviewCells={fogPreviewCells}
              />
            </div>
          </div>
        </div>
      </div>

      <ResizableRight>
        <Toolbar
          inputMode={gridState.inputMode}
          onInputModeChange={(mode) => {
            gridState.setInputMode(mode)
            if (mode !== 'normal') setSelectedImageIndex(null)
          }}
          onColorSelect={c => {
            if (gridState.inputMode === 'fixedColor') gridState.applyFixedColor(c)
            else gridState.applyColor(c)
          }}
          onColorErase={gridState.eraseColor}
          activeColor={gridState.activeColor}
          onActiveColorChange={gridState.setActiveColor}
          activeMark={gridState.activeMark}
          onActiveMarkChange={gridState.setActiveMark}
          onMarkSelect={shape => gridState.toggleMark(shape)}
          onMarkErase={gridState.eraseMark}
          onLabelApply={(align, text, showThroughFog, revealWithFog) => gridState.applyLabel(align, text, showThroughFog, revealWithFog)}
          onLabelRemove={(align) => gridState.removeLabel(align)}
          selectedCellLabels={gridState.selection.length === 1 ? gridState.grid[gridState.selection[0].row][gridState.selection[0].col].labels : null}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onErase={gridState.clearValues}
          isEditor={!solutionMode}
          imageLibrary={imageLibrary}
          selectedImageIndex={selectedImageIndex}
          onImageSelect={handleImageSelect}
          onImageApply={handleImageApply}
          onImageRemove={gridState.removeImage}
          onImageImport={() => imageInputRef.current?.click()}
          onIconAdd={handleIconAdd}
          puzzleType={puzzleType || undefined}
          clickActionLeft={clickActionLeft || undefined}
          clickActionRight={clickActionRight || undefined}
          onClickActionLeftChange={setClickActionLeft}
          onClickActionRightChange={setClickActionRight}
          puzzleHasClickActions={!!clickActionLeft}
          fogGroups={solutionMode ? undefined : fogGroups}
          fogEditStep={fogEditStep}
          fogPendingTriggers={fogPendingTriggers}
          fogPendingCellCount={fogPendingCells.length}
          fogPendingTriggerCells={fogPendingTriggerCells}
          fogEditingGroupId={fogEditingGroupId}
          selectionCount={gridState.selection.length}
          onFogGroupAdd={handleFogGroupAdd}
          onFogGroupDelete={handleFogGroupDelete}
          onFogGroupSelect={handleFogGroupSelect}
          onFogGroupEdit={handleFogGroupEdit}
          onFogConfirmCells={handleFogConfirmCells}
          onFogSelectTriggerCells={handleFogSelectTriggerCells}
          onFogConfirmTriggerCells={handleFogConfirmTriggerCells}
          onFogAddTrigger={handleFogAddTrigger}
          onFogTriggerMatchModeChange={handleFogTriggerMatchModeChange}
          onFogTriggerNegateChange={handleFogTriggerNegateChange}
          onFogTriggerGroupModeChange={setFogPendingTriggerMode}
          fogPendingTriggerMode={fogPendingTriggerMode}
          onFogRemoveTrigger={handleFogRemoveTrigger}
          onFogHighlightTrigger={handleFogHighlightTrigger}
          onFogEditTrigger={handleFogEditTrigger}
          onFogFinishGroup={handleFogFinishGroup}
          onFogReSelectFogCells={handleFogReSelectFogCells}
          onFogCancel={handleFogCancel}
          activeTexture={gridState.activeTexture}
          onActiveTextureChange={gridState.setActiveTexture}
          onTextureApply={tex => gridState.applyFixedTexture(tex)}
          onTextureRemove={gridState.removeFixedTexture}
        />
      </ResizableRight>

      <Modal {...modalProps} />
    </div>
  )
}
