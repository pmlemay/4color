import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useGrid } from '../hooks/useGrid'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTheme } from '../hooks/useTheme'
import { useModal } from '../hooks/useModal'
import { useIsMobile } from '../hooks/useIsMobile'
import { useGridScale } from '../hooks/useGridScale'
import { Grid } from '../components/Grid/Grid'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { InputPanel } from '../components/InputPanel/InputPanel'
import { InfoPanel } from '../components/InfoPanel/InfoPanel'
import { CluesBar } from '../components/CluesBar'
import { Modal } from '../components/Modal/Modal'
import { ResizableLeft } from '../components/ResizableLeft'
import { ResizableRight } from '../components/ResizableRight'
import { MobileHeader } from '../components/MobileHeader'
import { SlidePanel } from '../components/SlidePanel'
import { LanguagePicker } from '../components/LanguagePicker'
import { ThemeToggle } from '../components/ThemeToggle'
import { fetchPuzzle, fetchPuzzleSolution, puzzleToGrid } from '../utils/puzzleIO'
import { savePlayerData, loadPlayerData, clearPlayerData, applyPlayerData } from '../utils/playerSave'
import { validate4Color, validateSolution } from '../utils/validate'
import { useCompletions } from '../hooks/useCompletions'
import { useTimer } from '../hooks/useTimer'
import { formatTime } from '../utils/formatTime'
import { useAuth } from '../contexts/AuthContext'
import { CellData, CellPosition, InputMode, PuzzleData, PuzzleSolution, AutoCrossRule, MarkShape } from '../types'
import { PUZZLE_TYPE_DEFAULTS } from '../utils/puzzleIO'

export function PlayerPage() {
  const { puzzleId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const debug = searchParams.get('debug') === 'true'

  const { theme, toggle: toggleTheme } = useTheme()
  const { user, signIn } = useAuth()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [completionStep, setCompletionStep] = useState<'none' | 'signin' | 'keepclear'>('none')
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [struckSpecialRuleWords, setStruckSpecialRuleWords] = useState<Set<string>>(new Set())
  const [struckRuleWords, setStruckRuleWords] = useState<Set<string>>(new Set())
  const [struckClueWords, setStruckClueWords] = useState<Set<string>>(new Set())
  const [solution, setSolution] = useState<PuzzleSolution | null>(null)

  const { modalProps, showAlert, showConfirm } = useModal()
  const { completedPuzzleIds, completionTimes, markCompleted } = useCompletions()
  const gridState = useGrid(1, 1)
  const timer = useTimer(0)
  const timerRef = useRef(timer)
  timerRef.current = timer
  const gridRef = useRef(gridState.grid)
  gridRef.current = gridState.grid
  const struckSpecialRuleWordsRef = useRef(struckSpecialRuleWords)
  struckSpecialRuleWordsRef.current = struckSpecialRuleWords
  const struckRuleWordsRef = useRef(struckRuleWords)
  struckRuleWordsRef.current = struckRuleWords
  const struckClueWordsRef = useRef(struckClueWords)
  struckClueWordsRef.current = struckClueWords
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)
  const [puzzleCompleted, setPuzzleCompleted] = useState(false)
  const pendingCompletion = useRef<{ puzzleId: string; timeMs: number } | null>(null)

  const gridRows = puzzle?.gridSize?.rows || 1
  const gridCols = puzzle?.gridSize?.cols || 1
  const gridScale = useGridScale({ rows: gridRows, cols: gridCols })

  const valueSet = useMemo(() => {
    if (!puzzle) return []
    if (solution?.cells && Object.keys(solution.cells).length > 0) {
      return [...new Set(Object.values(solution.cells))].sort()
    }
    const maxDim = Math.max(puzzle.gridSize.rows, puzzle.gridSize.cols)
    const vals: string[] = []
    for (let i = 1; i <= maxDim && i <= 9; i++) vals.push(String(i))
    for (let i = 10; i <= maxDim; i++) vals.push(String.fromCharCode(55 + i)) // A=10, B=11, etc
    return vals
  }, [puzzle, solution])

  useEffect(() => {
    if (!puzzleId) return
    fetchPuzzle(puzzleId).then(data => {
      if (data) {
        setPuzzle(data)
        let grid = puzzleToGrid(data)
        const saved = loadPlayerData(puzzleId)
        let savedElapsedMs = 0
        if (saved) {
          grid = applyPlayerData(grid, saved)
          setStruckSpecialRuleWords(new Set(saved.struckSpecialRules || []))
          setStruckRuleWords(new Set(saved.struckRules))
          setStruckClueWords(new Set(saved.struckClues))
          savedElapsedMs = saved.elapsedMs || 0
        }
        gridState.setGrid(grid)
        gridState.setAutoCrossRules(data.autoCrossRules || [])
        gridState.setPuzzleType(data.puzzleType || '')
        // Initialize click actions from puzzle data
        if (data.clickActionLeft) setClickActionLeft(data.clickActionLeft)
        if (data.clickActionRight) setClickActionRight(data.clickActionRight)
        // Pre-select suggested mode if puzzle has click actions
        if (data.clickActionLeft) {
          gridState.setInputMode('suggested')
        }
        // Fetch solution file if it exists (for murdoku etc.)
        fetchPuzzleSolution(puzzleId).then(sol => { if (sol) setSolution(sol) })
        // Only start timer if puzzle not already completed
        if (!completedPuzzleIds.has(puzzleId)) {
          timerRef.current.reset(savedElapsedMs)
          setTimeout(() => { timerRef.current.start() }, 0)
        } else {
          setPuzzleCompleted(true)
        }
        // Mark as loaded after a tick so the initial setGrid doesn't trigger a save
        setTimeout(() => { loaded.current = true }, 0)
      } else {
        setError(true)
      }
      setLoading(false)
    })
  }, [puzzleId])

  // React to completedPuzzleIds loading (may arrive after puzzle fetch)
  useEffect(() => {
    if (puzzleId && completedPuzzleIds.has(puzzleId) && !puzzleCompleted) {
      setPuzzleCompleted(true)
      timerRef.current.pause()
    }
  }, [puzzleId, completedPuzzleIds, puzzleCompleted])

  // After sign-in, persist any pending completion
  useEffect(() => {
    if (user && pendingCompletion.current) {
      const { puzzleId: pid, timeMs } = pendingCompletion.current
      pendingCompletion.current = null
      markCompleted(pid, timeMs)
    }
  }, [user, markCompleted])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!puzzleId || !loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      savePlayerData(puzzleId, gridState.grid, struckRuleWords, struckClueWords, struckSpecialRuleWords, timerRef.current.elapsedMs)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [gridState.grid, struckRuleWords, struckClueWords, struckSpecialRuleWords, puzzleId])

  // Save timer on unmount (covers leaving without any grid changes)
  useEffect(() => {
    return () => {
      if (puzzleId && loaded.current) {
        savePlayerData(puzzleId, gridRef.current, struckRuleWordsRef.current, struckClueWordsRef.current, struckSpecialRuleWordsRef.current, timerRef.current.elapsedMs)
      }
    }
  }, [puzzleId])

  const puzzleType = puzzle?.puzzleType || ''
  const puzzleHasClickActions = !!(puzzle?.clickActionLeft)
  const [clickActionLeft, setClickActionLeft] = useState('')
  const [clickActionRight, setClickActionRight] = useState('cross')
  const autoCrossRules: AutoCrossRule[] = puzzle?.autoCrossRules || []

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
  })

  const doClearPlayerInput = () => {
    gridState.setGrid(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          value: null,
          notes: [],
          color: null,
          crossed: false,
          mark: null,
          edgeCrosses: [false, false, false, false] as [boolean, boolean, boolean, boolean],
          borders: [...cell.fixedBorders] as [number, number, number, number],
        }))
      )
    )
    setStruckRuleWords(new Set())
    setStruckClueWords(new Set())
    if (puzzleId) clearPlayerData(puzzleId)
  }

  const handleClearPlayerInput = async () => {
    if (!await showConfirm('Are you sure you want to reset all your input?', 'Reset Input')) return
    doClearPlayerInput()
  }

  // Click action: apply a click action string to a cell (toggle)
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

  // Check if a cell matches a given action state
  const cellMatchesAction = useCallback((cell: CellData, action: string): boolean => {
    if (action.startsWith('color:')) return cell.color === action.split(':')[1]
    if (action.startsWith('mark:')) return cell.mark === action.split(':')[1]
    if (action === 'cross') return cell.crossed
    return false
  }, [])

  // Force-apply an action (always ON, not toggle), clearing conflicting state
  const forceApplyAction = useCallback((prev: CellData[][], pos: CellPosition, action: string): CellData[][] => {
    const next = prev.map(row => row.map(cell => ({ ...cell })))
    const cell = next[pos.row][pos.col]
    // Clear all action state first
    cell.color = null
    cell.mark = null
    cell.crossed = false
    // Apply the action
    if (action.startsWith('color:')) {
      cell.color = action.split(':')[1]
    } else if (action.startsWith('mark:')) {
      cell.mark = action.split(':')[1] as MarkShape
    } else if (action === 'cross') {
      cell.crossed = true
    }
    return next
  }, [])

  // Clear all click-action-related state from a cell
  const clearCellActions = useCallback((prev: CellData[][], pos: CellPosition): CellData[][] => {
    const next = prev.map(row => row.map(cell => ({ ...cell })))
    const cell = next[pos.row][pos.col]
    cell.color = null
    cell.mark = null
    cell.crossed = false
    return next
  }, [])

  // Right-click handler
  const handleRightClickCell = useCallback((pos: CellPosition) => {
    if (!clickActionRight) return
    gridState.setGrid(prev => applyClickActionToCell(prev, pos, clickActionRight))
  }, [clickActionRight, gridState, applyClickActionToCell])

  const isTouchDragRef = useRef(false)

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

  const is4Color = puzzle?.tags?.includes('4color') ?? false
  const canSubmit = is4Color || !!solution

  const triggerCompletion = useCallback(() => {
    timer.pause()
    const timeMs = timer.elapsedMs
    setPuzzleCompleted(true)
    if (puzzleId) {
      if (user) {
        markCompleted(puzzleId, timeMs)
        setCompletionStep('keepclear')
      } else {
        pendingCompletion.current = { puzzleId, timeMs }
        setCompletionStep('signin')
      }
    }
  }, [puzzleId, markCompleted, timer, user])

  const handleSubmit = useCallback(async () => {
    let result: { valid: boolean; error?: string }
    if (is4Color) {
      result = validate4Color(gridState.grid)
    } else if (solution) {
      result = validateSolution(gridState.grid, solution)
    } else {
      return
    }
    if (result.valid) {
      triggerCompletion()
    } else {
      await showAlert(result.error || 'Not quite right. Keep trying!', 'Not Quite')
    }
  }, [gridState.grid, is4Color, solution, showAlert, triggerCompletion])

  // Auto-validate after every grid change — silently trigger completion
  // only on the transition from invalid → valid (not while already valid)
  const wasValid = useRef(false)
  useEffect(() => {
    if (!canSubmit) return
    let result: { valid: boolean }
    if (is4Color) {
      result = validate4Color(gridState.grid)
    } else if (solution) {
      result = validateSolution(gridState.grid, solution)
    } else {
      return
    }
    if (result.valid) {
      if (!wasValid.current) {
        wasValid.current = true
        triggerCompletion()
      }
    } else {
      wasValid.current = false
    }
  }, [gridState.grid, canSubmit, is4Color, solution, triggerCompletion])

  const handleCompletionSignIn = async () => {
    try { await signIn() } catch { /* user closed popup */ }
    setCompletionStep('keepclear')
  }

  const handleCompletionIgnore = () => {
    setCompletionStep('keepclear')
  }

  const handleCompletionKeep = () => {
    setCompletionStep('none')
  }

  const handleCompletionClear = () => {
    doClearPlayerInput()
    setCompletionStep('none')
  }

  const isSuggestedMode = gridState.inputMode === 'suggested'

  // Wrap drag handlers so suggested mode applies click actions directly
  // (useGrid's onDragChange/commitSelection don't know about 'suggested' inputMode)
  const suggestedProcessed = useRef<Set<string>>(new Set())
  const touchCycleAction = useRef<string | null>(null) // determined action for touch drag: action string or 'clear'

  const handleDragChange = useCallback((sel: CellPosition[]) => {
    if (!isSuggestedMode || !clickActionLeft) {
      gridState.onDragChange(sel)
      return
    }
    const isTouch = isTouchDragRef.current

    for (const pos of sel) {
      const key = `${pos.row},${pos.col}`
      if (suggestedProcessed.current.has(key)) continue
      suggestedProcessed.current.add(key)
      const isFirst = suggestedProcessed.current.size === 1
      const setter = isFirst ? gridState.setGridWithUndo : gridState.setGrid

      if (isTouch) {
        // Touch: cycle through left action → right action → clear
        setter(prev => {
          const cell = prev[pos.row][pos.col]
          let action: string
          if (isFirst) {
            // First cell determines the cycle action for the entire drag
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
          if (action === 'clear') return clearCellActions(prev, pos)
          return forceApplyAction(prev, pos, action)
        })
      } else {
        // Mouse: left click toggles left action
        setter(prev => applyClickActionToCell(prev, pos, clickActionLeft))
      }
    }
  }, [isSuggestedMode, clickActionLeft, clickActionRight, gridState, applyClickActionToCell, cellMatchesAction, forceApplyAction, clearCellActions])

  const handleCommitSelection = useCallback((sel: CellPosition[]) => {
    if (isSuggestedMode) {
      suggestedProcessed.current.clear()
      touchCycleAction.current = null
      return
    }
    gridState.commitSelection(sel)
  }, [isSuggestedMode, gridState])

  const handleClearSelection = useCallback(() => {
    suggestedProcessed.current.clear()
    gridState.clearSelection()
  }, [gridState])

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Loading puzzle...</p>
  if (error || !puzzle) {
    return (
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <p>Puzzle not found.</p>
        <Link to="/">Back to puzzle list</Link>
      </div>
    )
  }

  const completionModal = completionStep !== 'none' && (
    <div className="modal-backdrop" onMouseDown={() => {}}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <h3 className="modal-title">Puzzle Solved!</h3>
        <p className="modal-message">Congratulations!</p>
        {completionStep === 'signin' ? (
          <div className="completion-signin">
            <p className="completion-signin-text">Save your completed puzzles and times by signing in.</p>
            <div className="modal-actions completion-actions">
              <button className="modal-btn" onClick={handleCompletionIgnore}>Ignore</button>
              <button className="modal-btn modal-btn-confirm" onClick={handleCompletionSignIn}>Sign in with Google</button>
            </div>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="modal-btn" onClick={handleCompletionKeep}>Keep</button>
            <button className="modal-btn modal-btn-confirm" onClick={handleCompletionClear}>Clear Puzzle</button>
          </div>
        )}
      </div>
    </div>
  )

  const timerDisplay = puzzleCompleted
    ? puzzleId && completionTimes.has(puzzleId)
      ? <div className="info-timer completed">{formatTime(completionTimes.get(puzzleId)!)}</div>
      : null
    : <div className="info-timer">{timer.formatted}</div>

  const infoPanelContent = (
    <InfoPanel
      title={puzzle.title}
      authors={puzzle.authors}
      gridSize={puzzle.gridSize}
      difficulty={puzzle.difficulty}
      specialRulesList={puzzle.specialRules}
      rulesList={puzzle.rules}
      cluesList={puzzle.clues}
      backLink={!isMobile}
      headerRight={<><LanguagePicker /><ThemeToggle theme={theme} onToggle={toggleTheme} /></>}
      struckSpecialRuleWords={struckSpecialRuleWords}
      onStruckSpecialRuleWordsChange={setStruckSpecialRuleWords}
      struckRuleWords={struckRuleWords}
      onStruckRuleWordsChange={setStruckRuleWords}
      struckClueWords={struckClueWords}
      onStruckClueWordsChange={setStruckClueWords}
    >
      {!isMobile && timerDisplay}
      <button className="info-btn" onClick={handleClearPlayerInput}>Reset My Input</button>
      {debug && <button className="info-btn" onClick={() => navigate(`/edit/${puzzleId}`)}>Edit Puzzle</button>}
    </InfoPanel>
  )

  const metaPanelContent = (
    <InfoPanel
      title={puzzle.title}
      authors={puzzle.authors}
      gridSize={puzzle.gridSize}
      difficulty={puzzle.difficulty}
      specialRulesList={puzzle.specialRules}
      rulesList={puzzle.rules}
      backLink={false}
      headerRight={<><LanguagePicker /><ThemeToggle theme={theme} onToggle={toggleTheme} /></>}
      struckSpecialRuleWords={struckSpecialRuleWords}
      onStruckSpecialRuleWordsChange={setStruckSpecialRuleWords}
      struckRuleWords={struckRuleWords}
      onStruckRuleWordsChange={setStruckRuleWords}
    >
      {timerDisplay}
      <button className="info-btn" onClick={handleClearPlayerInput}>Reset My Input</button>
      {debug && <button className="info-btn" onClick={() => navigate(`/edit/${puzzleId}`)}>Edit Puzzle</button>}
    </InfoPanel>
  )

  const gridElement = (
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
      onToggleEdgeCross={gridState.toggleEdgeCross}
      isPinching={gridScale.isPinching}
      isTouchDragRef={isTouchDragRef}
    />
  )

  const inputPanel = (
    <InputPanel
      inputMode={gridState.inputMode}
      onInputModeChange={gridState.setInputMode}
      onValueInput={gridState.applyValue}
      onNoteInput={gridState.addNote}
      valueSet={valueSet}
      onColorSelect={c => gridState.applyColor(c)}
      onColorErase={gridState.eraseColor}
      activeColor={gridState.activeColor}
      onActiveColorChange={gridState.setActiveColor}
      activeMark={gridState.activeMark}
      onActiveMarkChange={gridState.setActiveMark}
      onMarkSelect={shape => gridState.toggleMark(shape)}
      onMarkErase={gridState.eraseMark}
      onUndo={gridState.undo}
      onRedo={gridState.redo}
      onErase={gridState.clearValues}
      onSubmit={canSubmit ? handleSubmit : undefined}
      puzzleType={puzzleType || undefined}
      puzzleHasClickActions={puzzleHasClickActions}
    />
  )

  if (isMobile) {
    return (
      <div className="mobile-layout">
        <MobileHeader
          title={puzzle.title}
          timerDisplay={timerDisplay}
          onMenuToggle={() => setMenuOpen(o => !o)}
        />

        {((puzzle.clues && puzzle.clues.length > 0) || (puzzle.specialRules && puzzle.specialRules.length > 0)) && (
          <CluesBar
            specialRulesList={puzzle.specialRules}
            struckSpecialRuleWords={struckSpecialRuleWords}
            onStruckSpecialRuleWordsChange={setStruckSpecialRuleWords}
            cluesList={puzzle.clues || []}
            struckClueWords={struckClueWords}
            onStruckClueWordsChange={setStruckClueWords}
          />
        )}

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
            {gridElement}
          </div>
        </div>

        {inputPanel}

        <SlidePanel open={menuOpen} onClose={() => setMenuOpen(false)}>
          {metaPanelContent}
        </SlidePanel>

        {completionModal}
        <Modal {...modalProps} />
      </div>
    )
  }

  return (
    <div className="page-layout">
      <ResizableLeft>
        {infoPanelContent}
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
            {gridElement}
          </div>
        </div>
      </div>

      <ResizableRight>
        <Toolbar
          isEditor={false}
          inputMode={gridState.inputMode}
          onInputModeChange={gridState.setInputMode}
          onColorSelect={c => gridState.applyColor(c)}
          onColorErase={gridState.eraseColor}
          activeColor={gridState.activeColor}
          onActiveColorChange={gridState.setActiveColor}
          activeMark={gridState.activeMark}
          onActiveMarkChange={gridState.setActiveMark}
          onMarkSelect={shape => gridState.toggleMark(shape)}
          onMarkErase={gridState.eraseMark}
          onUndo={gridState.undo}
          onRedo={gridState.redo}
          onErase={gridState.clearValues}
          onSubmit={canSubmit ? handleSubmit : undefined}
          puzzleType={puzzleType || undefined}
          clickActionLeft={clickActionLeft || undefined}
          clickActionRight={clickActionRight || undefined}
          onClickActionLeftChange={setClickActionLeft}
          onClickActionRightChange={setClickActionRight}
          puzzleHasClickActions={puzzleHasClickActions}
        />
      </ResizableRight>

      {completionModal}
      <Modal {...modalProps} />
    </div>
  )
}
