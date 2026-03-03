import { useState, useRef, useEffect, useCallback } from 'react'
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
import { PuzzleData, PuzzleSolution, CellData, CellPosition, InputMode, AutoCrossRule, MarkShape } from '../types'

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
  const [authors, setAuthors] = useState<string[]>([])
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

  const [editorPuzzleId, setEditorPuzzleId] = useState(puzzleId || '')
  const [solutionMode, setSolutionMode] = useState(false)
  const [puzzleSnapshot, setPuzzleSnapshot] = useState('')

  const { modalProps, showAlert, showConfirm } = useModal()
  const gridState = useGrid(rows, cols)
  const gridScale = useGridScale({ rows, cols })
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

  useEffect(() => {
    if (puzzleId) {
      fetchPuzzle(puzzleId).then(puzzle => {
        if (puzzle) {
          setTitle(puzzle.title)
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
          gridState.setGrid(puzzleToGrid(puzzle))
          // Rebuild image library from puzzle cells (resolve IDs via images dict)
          const images = new Set<string>()
          for (const cell of puzzle.cells) {
            if (cell.image) {
              const resolved = puzzle.images?.[cell.image] ?? cell.image
              images.add(resolved)
            }
          }
          setImageLibrary(Array.from(images))
        }
      })
    }
  }, [puzzleId])

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
  const PUZZLE_TYPE_RULES: Record<string, string[]> = {
    heyawake: HEYAWAKE_RULES,
    nurikabe: NURIKABE_RULES,
    starbattle: STARBATTLE_RULES,
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
    undo: gridState.undo,
    redo: gridState.redo,
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
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
    const puzzle = gridToPuzzle(gridState.grid, { id, title: title || 'Untitled', authors, specialRules: specialRules.length ? specialRules : undefined, rules, clues, difficulty, tags, autoCrossRules, puzzleType: puzzleType || undefined, clickActionLeft: clickActionLeft || undefined, clickActionRight: clickActionRight || undefined })

    if (puzzleId) {
      puzzle.id = puzzleId
    }
    setEditorPuzzleId(puzzle.id)
    if (import.meta.env.DEV) {
      const result = await savePuzzleToServer(puzzle)
      if (result.ok) {
        await showAlert(`Saved to puzzles/${result.file}`, 'Saved')
        if (!puzzleId) navigate(`/edit/${puzzle.id}`, { replace: true })
        return
      }
    }
    downloadPuzzleJSON(puzzle)
  }

  const handleClearAll = async () => {
    if (await showConfirm('Are you sure you want to clear all? This cannot be undone.', 'Clear All')) {
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
      fv: cell.fixedValue, fc: cell.fixedColor, fb: cell.fixedBorders, l: cell.label, i: cell.image,
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

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) {
      showAlert('Image must be under 200KB.')
      return
    }
    const img = new Image()
    img.onload = () => {
      // Scale down preserving aspect ratio, max dimension = 50px
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

  const handleImageSelect = useCallback((index: number | null) => {
    setSelectedImageIndex(index)
    if (index !== null) {
      gridState.setInputMode('normal')
    }
  }, [gridState])

  const applyClickAction = useCallback((pos: CellPosition, action: string, gs: typeof gridState) => {
    if (!action) return
    if (action.startsWith('color:')) {
      const colorVal = action.split(':')[1]
      gs.setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        const cell = next[pos.row][pos.col]
        cell.color = cell.color === colorVal ? null : colorVal
        if (cell.color) cell.mark = null
        return next
      })
    } else if (action.startsWith('mark:')) {
      const markVal = action.split(':')[1] as import('../types').MarkShape
      gs.setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        const cell = next[pos.row][pos.col]
        cell.mark = cell.mark === markVal ? null : markVal
        if (cell.mark) cell.color = null
        return next
      })
    } else if (action === 'cross') {
      gs.setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        const cell = next[pos.row][pos.col]
        cell.crossed = !cell.crossed
        if (cell.crossed) cell.mark = null
        return next
      })
    }
  }, [])

  const handleRightClickCell = useCallback((pos: CellPosition) => {
    applyClickAction(pos, clickActionRight, gridState)
  }, [clickActionRight, gridState, applyClickAction])

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

  const applyClickActionToCell = useCallback((prev: CellData[][], pos: CellPosition, action: string): CellData[][] => {
    const next = prev.map(row => row.map(cell => ({ ...cell })))
    const cell = next[pos.row][pos.col]
    if (action.startsWith('color:')) {
      const colorVal = action.split(':')[1]
      cell.color = cell.color === colorVal ? null : colorVal
      if (cell.color) cell.mark = null
    } else if (action.startsWith('mark:')) {
      const markVal = action.split(':')[1] as MarkShape
      cell.mark = cell.mark === markVal ? null : markVal
      if (cell.mark) cell.color = null
    } else if (action === 'cross') {
      cell.crossed = !cell.crossed
      if (cell.crossed) cell.mark = null
    }
    return next
  }, [])

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
      setter(prev => applyClickActionToCell(prev, pos, clickActionLeft))
    }
  }, [isSuggestedMode, clickActionLeft, gridState, applyClickActionToCell])

  const handleCommitSelection = useCallback((sel: CellPosition[]) => {
    if (isSuggestedMode) {
      suggestedProcessed.current.clear()
      return
    }
    gridState.commitSelection(sel)
  }, [isSuggestedMode, gridState])

  const handleClearSelection = useCallback(() => {
    suggestedProcessed.current.clear()
    gridState.clearSelection()
  }, [gridState])

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
        setTitle(puzzle.title)
        setAuthors(puzzle.authors || [])
        setRows(puzzle.gridSize.rows)
        setCols(puzzle.gridSize.cols)
        setDifficulty(puzzle.difficulty || '')
        setTags(puzzle.tags || [])
        setAutoCrossRulesState(puzzle.autoCrossRules || [])
        setPuzzleType(puzzle.puzzleType || '')
        setClickActionLeft(puzzle.clickActionLeft || '')
        setClickActionRight(puzzle.clickActionRight || 'cross')
        setRules(puzzle.rules || [])
        setClues(puzzle.clues || [])
        gridState.setGrid(puzzleToGrid(puzzle))
        const images = new Set<string>()
        for (const cell of puzzle.cells) {
          if (cell.image) {
            const resolved = puzzle.images?.[cell.image] ?? cell.image
            images.add(resolved)
          }
        }
        setImageLibrary(Array.from(images))
      } catch {
        showAlert('Invalid puzzle JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page-layout">
      <ResizableLeft>
        <InfoPanel title={solutionMode ? 'Solution Mode' : 'Puzzle Editor'} backLink headerRight={<><LanguagePicker /><ThemeToggle theme={theme} onToggle={toggleTheme} /></>}>
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
            <button className="info-btn" onClick={() => gridState.resetGrid(rows, cols)}>Resize Grid</button>

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
            <button className="info-btn" onClick={handleEnterSolutionMode}>Enter Solution Mode</button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageImport}
            />

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} />

            <div className="info-section-title" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Rules</div>
            {rules.map((rule, i) => (
              <div
                key={i}
                className="info-list-item info-list-draggable"
                draggable
                onDragStart={() => handleDragStart('rule', i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('rule')}
              >
                <span className="info-drag-handle" title="Drag to reorder">&#x2630;</span>
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
                draggable
                onDragStart={() => handleDragStart('specialRule', i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('specialRule')}
              >
                <span className="info-drag-handle" title="Drag to reorder">&#x2630;</span>
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
                draggable
                onDragStart={() => handleDragStart('clue', i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop('clue')}
              >
                <span className="info-drag-handle" title="Drag to reorder">&#x2630;</span>
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
            if (!(e.target as HTMLElement).closest('.puzzle-grid')) {
              gridState.clearSelection()
            }
          }}
        >
          <div className="grid-scale-wrapper" style={gridScale.style}>
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
              onToggleFixedMark={gridState.toggleFixedMark}
              isPinching={gridScale.isPinching}
            />
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
          onLabelApply={(text, align) => gridState.applyLabel(text, align)}
          onLabelRemove={() => gridState.removeLabel()}
          onUndo={gridState.undo}
          onRedo={gridState.redo}
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
          puzzleHasClickActions={!!puzzleType}
        />
      </ResizableRight>

      <Modal {...modalProps} />
    </div>
  )
}
