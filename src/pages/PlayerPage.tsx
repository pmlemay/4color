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
import { savePlayerData, loadPlayerData, clearPlayerData, applyPlayerData, puzzleFingerprint } from '../utils/playerSave'
import { validate4Color, validateSolution } from '../utils/validate'
import { useCompletions } from '../hooks/useCompletions'
import { useTimer } from '../hooks/useTimer'
import { formatTime } from '../utils/formatTime'
import { useAuth } from '../contexts/AuthContext'
import { usePuzzleLeaderboard } from '../hooks/usePuzzleLeaderboard'
import { CellData, CellPosition, InputMode, PuzzleData, PuzzleSolution, AutoCrossRule, MarkShape } from '../types'
import { PUZZLE_TYPE_DEFAULTS } from '../utils/puzzleIO'
import { cellMatchesAction, applyActionToGrid } from '../utils/clickActions'
import { computeFoggedCells, evaluateNewReveals } from '../utils/fog'
import { incrementPuzzleCompletions } from '../utils/puzzleStats'

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
  const [revealedFogGroupIds, setRevealedFogGroupIds] = useState<Set<string>>(new Set())

  const { modalProps, showAlert, showConfirm } = useModal()
  const { completedPuzzleIds, completionTimes, markCompleted } = useCompletions()
  const gridState = useGrid(1, 1)
  const timer = useTimer(0)
  const puzzleLeaderboard = usePuzzleLeaderboard(puzzleId)
  const timerRef = useRef(timer)
  timerRef.current = timer
  const gridRef = gridState.gridRef
  const struckSpecialRuleWordsRef = useRef(struckSpecialRuleWords)
  struckSpecialRuleWordsRef.current = struckSpecialRuleWords
  const struckRuleWordsRef = useRef(struckRuleWords)
  struckRuleWordsRef.current = struckRuleWords
  const struckClueWordsRef = useRef(struckClueWords)
  struckClueWordsRef.current = struckClueWords
  const revealedFogGroupIdsRef = useRef(revealedFogGroupIds)
  revealedFogGroupIdsRef.current = revealedFogGroupIds
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)
  const fingerprintRef = useRef<string | undefined>(undefined)
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
    let cancelled = false
    loaded.current = false
    fetchPuzzle(puzzleId).then(data => {
      if (cancelled) return
      if (data) {
        setPuzzle(data)
        const fp = puzzleFingerprint(data)
        fingerprintRef.current = fp
        let grid = puzzleToGrid(data)
        const saved = loadPlayerData(puzzleId, fp)
        let savedElapsedMs = 0
        if (saved) {
          grid = applyPlayerData(grid, saved)
          setStruckSpecialRuleWords(new Set(saved.struckSpecialRules || []))
          setStruckRuleWords(new Set(saved.struckRules))
          setStruckClueWords(new Set(saved.struckClues))
          if (saved.revealedFogGroups) setRevealedFogGroupIds(new Set(saved.revealedFogGroups))
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
        // Fetch solution file if it exists (for murdoku etc.) — skip for 4color (self-validating)
        const is4c = data.tags?.includes('4color')
        if (!is4c) {
          fetchPuzzleSolution(puzzleId).then(sol => { if (!cancelled && sol) setSolution(sol) })
        }
        // Only start timer if puzzle not already completed
        if (!completedPuzzleIds.has(puzzleId)) {
          timerRef.current.reset(savedElapsedMs)
          setTimeout(() => { timerRef.current.start() }, 0)
        } else {
          setPuzzleCompleted(true)
        }
        // Mark as loaded after a tick so the initial setGrid doesn't trigger a save
        setTimeout(() => { if (!cancelled) loaded.current = true }, 0)
      } else {
        setError(true)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
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

  // Flush save immediately using refs (always latest state)
  const flushSave = useCallback(() => {
    if (!puzzleId || !loaded.current) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    savePlayerData(puzzleId, gridRef.current, struckRuleWordsRef.current, struckClueWordsRef.current, struckSpecialRuleWordsRef.current, timerRef.current.elapsedMs, revealedFogGroupIdsRef.current, fingerprintRef.current)
  }, [puzzleId])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!puzzleId || !loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      savePlayerData(puzzleId, gridState.grid, struckRuleWords, struckClueWords, struckSpecialRuleWords, timerRef.current.elapsedMs, revealedFogGroupIds, fingerprintRef.current)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [gridState.grid, struckRuleWords, struckClueWords, struckSpecialRuleWords, puzzleId, revealedFogGroupIds])

  // Save on unmount, visibility change, beforeunload, and pagehide
  // pagehide is more reliable than beforeunload on iOS Safari/Chrome
  useEffect(() => {
    const handleVisChange = () => { if (document.hidden) flushSave() }
    const handleUnload = () => { flushSave() }
    document.addEventListener('visibilitychange', handleVisChange)
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange)
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      flushSave()
    }
  }, [flushSave])

  // Periodically save timer progress (every 10s) so iOS refreshes don't lose time
  useEffect(() => {
    if (!puzzleId || puzzleCompleted) return
    const interval = setInterval(() => { if (loaded.current) flushSave() }, 10000)
    return () => clearInterval(interval)
  }, [puzzleId, puzzleCompleted, flushSave])

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
          lines: [false, false, false, false] as [boolean, boolean, boolean, boolean],
          borders: [...cell.fixedBorders] as [number, number, number, number],
        }))
      )
    )
    setStruckRuleWords(new Set())
    setStruckClueWords(new Set())
    setRevealedFogGroupIds(new Set())
    if (puzzleId) clearPlayerData(puzzleId)
  }

  const handleClearPlayerInput = async () => {
    if (!await showConfirm('Are you sure you want to reset all your input?', 'Reset Input')) return
    doClearPlayerInput()
  }

  // Click action: apply a click action string to a cell (toggle)
  const rightDragAction = useRef<boolean | undefined>(undefined)

  // Right-click handler with drag action locking
  const suggestedAutoCross = puzzleHasClickActions ? autoCrossRules : undefined
  const handleRightClickCell = useCallback((pos: CellPosition, isFirst: boolean) => {
    if (!clickActionRight) return
    if (isFirst) {
      const matches = cellMatchesAction(gridState.grid[pos.row][pos.col], clickActionRight)
      rightDragAction.current = !matches // true = apply, false = clear
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionRight, undefined, suggestedAutoCross))
    } else {
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionRight, rightDragAction.current, suggestedAutoCross))
    }
  }, [clickActionRight, suggestedAutoCross, gridState])

  const isTouchDragRef = useRef(false)

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
        // black → dot
        cell.color = null
        cell.mark = 'dot' as MarkShape
      } else if (cell.mark === 'dot') {
        // dot → empty
        cell.mark = null
      } else {
        // empty → black
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

  const is4Color = puzzle?.tags?.includes('4color') ?? false
  const canSubmit = is4Color || !!solution

  const triggerCompletion = useCallback(() => {
    timer.pause()
    const timeMs = timer.elapsedMs
    setPuzzleCompleted(true)
    if (puzzleId) {
      incrementPuzzleCompletions(puzzleId)
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

  // Fog of War: evaluate triggers and derive fogged cells
  useEffect(() => {
    if (!puzzle?.fogGroups?.length) return
    const newlyRevealed = evaluateNewReveals(gridState.grid, puzzle.fogGroups, revealedFogGroupIds)
    if (newlyRevealed.length > 0) {
      setRevealedFogGroupIds(prev => {
        const next = new Set(prev)
        for (const id of newlyRevealed) next.add(id)
        return next
      })
    }
  }, [gridState.grid, puzzle?.fogGroups, revealedFogGroupIds])

  const foggedCells = useMemo(() => {
    if (!puzzle?.fogGroups?.length) return undefined
    return computeFoggedCells(puzzle.fogGroups, revealedFogGroupIds)
  }, [puzzle?.fogGroups, revealedFogGroupIds])

  // On first load with fog, zoom/pan to frame the visible (non-fogged) cells
  const hasFocusedFog = useRef(false)
  useEffect(() => {
    if (hasFocusedFog.current || !foggedCells || !puzzle) return
    hasFocusedFog.current = true
    const rows = puzzle.gridSize.rows
    const cols = puzzle.gridSize.cols
    let minR = rows, maxR = -1, minC = cols, maxC = -1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!foggedCells.has(`${r},${c}`)) {
          if (r < minR) minR = r
          if (r > maxR) maxR = r
          if (c < minC) minC = c
          if (c > maxC) maxC = c
        }
      }
    }
    // Only focus if the visible area is much smaller than the full grid
    if (maxR >= 0 && (maxR - minR + 1) * (maxC - minC + 1) < rows * cols * 0.5) {
      gridScale.focusOnRegion(minR, maxR, minC, maxC)
    }
  }, [foggedCells, puzzle, gridScale])

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

  // Suggested mode: per-cell left-click handler (same pattern as right-click — no batching issues)
  const leftDragAction = useRef<boolean | undefined>(undefined)

  const handleLeftClickCell = useCallback((pos: CellPosition, isFirst: boolean) => {
    if (!clickActionLeft) return
    if (isFirst) {
      const matches = cellMatchesAction(gridState.grid[pos.row][pos.col], clickActionLeft)
      leftDragAction.current = !matches // true = apply, false = clear
      gridState.setGridWithUndo(prev => applyActionToGrid(prev, pos, clickActionLeft, undefined, suggestedAutoCross))
    } else {
      gridState.setGrid(prev => applyActionToGrid(prev, pos, clickActionLeft, leftDragAction.current, suggestedAutoCross))
    }
  }, [clickActionLeft, suggestedAutoCross, gridState])

  // Touch drag: still uses onDragChange since touch goes through onSelectionChange
  const touchCycleAction = useRef<string | null>(null)
  const touchProcessed = useRef<Set<string>>(new Set())

  const handleDragChange = useCallback((sel: CellPosition[]) => {
    if (!isSuggestedMode || !clickActionLeft || clickActionLeft === 'line') {
      gridState.onDragChange(sel)
      return
    }
    if (sel.length === 0) return

    // Touch: cycle through left action → right action → clear
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
        return applyActionToGrid(mid, pos, action, true, suggestedAutoCross)
      })
    }
  }, [isSuggestedMode, clickActionLeft, clickActionRight, suggestedAutoCross, gridState])

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

  const leaderboardSection = (
    <div className="puzzle-leaderboard">
      <h3 className="puzzle-leaderboard-title">Leaderboard</h3>
      {puzzleLeaderboard.length > 0 ? (
        <ol className="puzzle-leaderboard-list">
          {puzzleLeaderboard.map((entry, i) => (
            <li key={entry.uid} className={`puzzle-leaderboard-entry${user && entry.uid === user.uid ? ' puzzle-leaderboard-self' : ''}`}>
              <span className="puzzle-leaderboard-rank">{i + 1}.</span>
              <span className="puzzle-leaderboard-name notranslate">{entry.displayName}</span>
              <span className="puzzle-leaderboard-time">{formatTime(entry.time)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="puzzle-leaderboard-empty">Be the first to complete this puzzle!</p>
      )}
    </div>
  )

  const infoPanelContent = (
    <div className="info-panel-wrapper">
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
        aboveRules={!isMobile ? <div className="info-section">
          {timerDisplay}
          <button className="info-btn" onClick={handleClearPlayerInput}>Reset My Input</button>
          {debug && <button className="info-btn" onClick={() => navigate(`/edit/${puzzleId}`)}>Edit Puzzle</button>}
        </div> : undefined}
        struckSpecialRuleWords={struckSpecialRuleWords}
        onStruckSpecialRuleWordsChange={setStruckSpecialRuleWords}
        struckRuleWords={struckRuleWords}
        onStruckRuleWordsChange={setStruckRuleWords}
        struckClueWords={struckClueWords}
        onStruckClueWordsChange={setStruckClueWords}
      />
      {leaderboardSection}
    </div>
  )

  const metaPanelContent = (
    <div className="slide-panel-content">
      <div className="slide-panel-scroll">
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
          aboveRules={<div className="info-section">
            {timerDisplay}
            <button className="info-btn" onClick={handleClearPlayerInput}>Reset My Input</button>
            {debug && <button className="info-btn" onClick={() => navigate(`/edit/${puzzleId}`)}>Edit Puzzle</button>}
          </div>}
        />
      </div>
      {leaderboardSection}
    </div>
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
      onLeftClickCell={isSuggestedMode && clickActionLeft && clickActionLeft !== 'line' ? handleLeftClickCell : undefined}
      onRightClickCell={clickActionRight && clickActionRight !== 'line' ? handleRightClickCell : undefined}
      onCommitEdges={gridState.commitEdges}
      onToggleEdgeCross={gridState.toggleEdgeCross}
      onCycleEdgeMark={gridState.cycleEdgeMark}
      onToggleLine={gridState.toggleLine}
      onLineCenterClick={handleLineCenterClick}
      onLineRightCenterClick={handleLineRightCenterClick}
      isPinching={gridScale.isPinching}
      isTouchDragRef={isTouchDragRef}
      foggedCells={foggedCells}
      revealedFogIds={revealedFogGroupIds}
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
            if (e.button !== 0) return
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
            if (e.button !== 0) return
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
