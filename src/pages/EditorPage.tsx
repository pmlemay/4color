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
    'Stars may not touch each other, not even diagonally.',
  ]
  const SPIRALGALAXY_RULES = [
    'Divide the grid into regions that have rotational symmetry around their center white circle.',
    'Each region has exactly 1 white circle in it.',
  ]
  const PUZZLE_TYPE_RULES: Record<string, string[]> = {
    heyawake: HEYAWAKE_RULES,
    nurikabe: NURIKABE_RULES,
    starbattle: STARBATTLE_RULES,
    spiralgalaxy: SPIRALGALAXY_RULES,
  }
  const PUZZLE_TYPE_TITLES: Record<string, string> = {
    heyawake: 'Heyawake',
    nurikabe: 'Nurikabe',
    starbattle: 'Star Battle',
    spiralgalaxy: 'Spiral Galaxy',
  }
  const PUZZLE_TYPE_TAGS: Record<string, string> = {
    heyawake: 'Heyawake',
    nurikabe: 'Nurikabe',
    starbattle: 'Star-battle',
    spiralgalaxy: 'Spiral-galaxy',
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
      setTitle(newTitle)
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
      }
    }
    if (Object.keys(cells).length === 0 && Object.keys(borders).length === 0 && Object.keys(colors).length === 0) {
      await showAlert('No solution values, borders, or colors entered.'); return
    }
    const solution: PuzzleSolution = { id: solutionId, cells }
    if (Object.keys(borders).length > 0) solution.borders = borders
    if (Object.keys(colors).length > 0) solution.colors = colors
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
    if (clickActionLeft.startsWith('color:')) return 'color'
    if (clickActionLeft.startsWith('mark:')) return 'mark'
    if (clickActionLeft === 'cross') return 'cross'
    return 'normal'
  })()
  const suggestedActiveColor = clickActionLeft?.startsWith('color:') ? clickActionLeft.split(':')[1] : null
  const suggestedActiveMark = clickActionLeft?.startsWith('mark:') ? clickActionLeft.split(':')[1] as MarkShape : null

  const isSuggestedMode = gridState.inputMode === 'suggested'

  // Wrap drag handlers so suggested mode applies click actions directly
  const suggestedProcessed = useRef<Set<string>>(new Set())

  const handleDragChange = useCallback((sel: CellPosition[]) => {
    if (!isSuggestedMode || !clickActionLeft) {
      gridState.onDragChange(sel)
      return
    }
    for (const pos of sel) {
      const key = `${pos.row},${pos.col}`
      if (suggestedProcessed.current.has(key)) continue
      suggestedProcessed.current.add(key)
      const setter = suggestedProcessed.current.size === 1 ? gridState.setGridWithUndo : gridState.setGrid
      setter(prev => applyActionToGrid(prev, pos, clickActionLeft, undefined, autoCrossRules))
    }
  }, [isSuggestedMode, clickActionLeft, autoCrossRules, gridState])

  const handleCommitSelection = useCallback((sel: CellPosition[], ctrlHeld?: boolean) => {
    if (isSuggestedMode) {
      suggestedProcessed.current.clear()
      return
    }
    gridState.commitSelection(sel, ctrlHeld)
  }, [isSuggestedMode, gridState])

  const handleClearSelection = useCallback(() => {
    suggestedProcessed.current.clear()
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
                <input type="number" value={rows} onChange={e => setRows(Math.min(99, Math.max(1, Number(e.target.value))))} min={1} max={99} />
              </div>
              <div className="info-editor-field">
                <label>Cols</label>
                <input type="number" value={cols} onChange={e => setCols(Math.min(99, Math.max(1, Number(e.target.value))))} min={1} max={99} />
              </div>
            </div>
            <button className="info-btn" onClick={async () => {
              if (!await showConfirm('This will clear all cell data. To add rows/columns without clearing, use the + buttons around the grid instead.', 'Resize Grid')) return
              gridState.resetGrid(rows, cols)
              setFogGroups([])
              gridScale.resetZoom()
            }}>Resize Grid</button>

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
                onRightClickCell={clickActionRight ? handleRightClickCell : undefined}
                onCommitEdges={gridState.commitEdges}
                onCommitFixedEdges={gridState.commitFixedEdges}
                onToggleEdgeCross={gridState.toggleEdgeCross}
                onToggleLine={gridState.toggleLine}
                onToggleFixedMark={gridState.toggleFixedMark}
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
