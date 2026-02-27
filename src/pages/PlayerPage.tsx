import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useGrid } from '../hooks/useGrid'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTheme } from '../hooks/useTheme'
import { useModal } from '../hooks/useModal'
import { Grid } from '../components/Grid/Grid'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { InfoPanel } from '../components/InfoPanel/InfoPanel'
import { Modal } from '../components/Modal/Modal'
import { ResizableLeft } from '../components/ResizableLeft'
import { LanguagePicker } from '../components/LanguagePicker'
import { fetchPuzzle, fetchPuzzleSolution, puzzleToGrid } from '../utils/puzzleIO'
import { savePlayerData, loadPlayerData, clearPlayerData, applyPlayerData } from '../utils/playerSave'
import { validate4Color, validateSolution } from '../utils/validate'
import { useCompletions } from '../hooks/useCompletions'
import { useTimer } from '../hooks/useTimer'
import { formatTime } from '../utils/formatTime'
import { CellPosition, PuzzleData, PuzzleSolution } from '../types'

export function PlayerPage() {
  const { puzzleId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const debug = searchParams.get('debug') === 'true'

  const { theme, toggle: toggleTheme } = useTheme()
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
  const struckRuleWordsRef = useRef(struckRuleWords)
  struckRuleWordsRef.current = struckRuleWords
  const struckClueWordsRef = useRef(struckClueWords)
  struckClueWordsRef.current = struckClueWords
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)
  const [puzzleCompleted, setPuzzleCompleted] = useState(false)

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
          setStruckRuleWords(new Set(saved.struckRules))
          setStruckClueWords(new Set(saved.struckClues))
          savedElapsedMs = saved.elapsedMs || 0
        }
        gridState.setGrid(grid)
        gridState.setAutoCrossRules(data.autoCrossRules || [])
        gridState.setForcedInputLayout(data.forcedInputLayout || '')
        if (data.forcedInputLayout === 'nurikabe') {
          gridState.setInputMode('color')
          gridState.setActiveColor('9')
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

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!puzzleId || !loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      savePlayerData(puzzleId, gridState.grid, struckRuleWords, struckClueWords, timerRef.current.elapsedMs)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [gridState.grid, struckRuleWords, struckClueWords, puzzleId])

  // Save timer on unmount (covers leaving without any grid changes)
  useEffect(() => {
    return () => {
      if (puzzleId && loaded.current) {
        savePlayerData(puzzleId, gridRef.current, struckRuleWordsRef.current, struckClueWordsRef.current, timerRef.current.elapsedMs)
      }
    }
  }, [puzzleId])

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
  })

  const doClearPlayerInput = () => {
    gridState.setGrid(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          value: cell.fixedValue ? cell.value : null,
          notes: cell.fixedValue ? cell.notes : [],
          color: cell.fixedValue ? cell.color : null,
          crossed: cell.fixedValue ? cell.crossed : false,
          mark: cell.fixedValue ? cell.mark : null,
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

  const forcedInputLayout = puzzle?.forcedInputLayout || ''

  const handleRightClickCell = useCallback((pos: CellPosition) => {
    if (forcedInputLayout !== 'nurikabe') return
    gridState.setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })))
      const cell = next[pos.row][pos.col]
      cell.mark = cell.mark === 'dot' ? null : 'dot'
      if (cell.mark === 'dot') cell.color = null
      return next
    })
  }, [forcedInputLayout, gridState])

  const is4Color = puzzle?.tags?.includes('4color') ?? false
  const canSubmit = is4Color || !!solution

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
      timer.pause()
      if (puzzleId) markCompleted(puzzleId, timer.elapsedMs)
      setPuzzleCompleted(true)
      const clear = await showConfirm('Congratulations!', 'Puzzle Solved!', 'Clear Puzzle', 'Keep')
      if (clear) doClearPlayerInput()
    } else {
      await showAlert(result.error || 'Not quite right. Keep trying!', 'Not Quite')
    }
  }, [gridState.grid, is4Color, solution, showConfirm, showAlert, puzzleId, markCompleted, timer])

  if (loading) return <p style={{ textAlign: 'center', marginTop: 40 }}>Loading puzzle...</p>
  if (error || !puzzle) {
    return (
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <p>Puzzle not found.</p>
        <Link to="/">Back to puzzle list</Link>
      </div>
    )
  }

  return (
    <div className="page-layout">
      <ResizableLeft>
        <InfoPanel
          title={puzzle.title}
          author={puzzle.author}
          gridSize={puzzle.gridSize}
          difficulty={puzzle.difficulty}
          rulesList={puzzle.rules}
          cluesList={puzzle.clues}
          backLink
          headerRight={<LanguagePicker />}
          struckRuleWords={struckRuleWords}
          onStruckRuleWordsChange={setStruckRuleWords}
          struckClueWords={struckClueWords}
          onStruckClueWordsChange={setStruckClueWords}
        >
          {puzzleCompleted
            ? puzzleId && completionTimes.has(puzzleId) && <div className="info-timer completed">{formatTime(completionTimes.get(puzzleId)!)}</div>
            : <div className="info-timer">{timer.formatted}</div>
          }
          <button className="info-btn" onClick={handleClearPlayerInput}>Reset My Input</button>
          {debug && <button className="info-btn" onClick={() => navigate(`/edit/${puzzleId}`)}>Edit Puzzle</button>}
        </InfoPanel>
      </ResizableLeft>

      <main
        className="panel-center"
        onMouseDown={e => {
          if (!(e.target as HTMLElement).closest('.puzzle-grid')) {
            gridState.clearSelection()
          }
        }}
      >
        <Grid
          grid={gridState.grid}
          selection={gridState.selection}
          debug={debug}
          inputMode={gridState.inputMode}
          activeColor={gridState.activeColor}
          activeMark={gridState.activeMark}
          clearSelection={gridState.clearSelection}
          commitSelection={gridState.commitSelection}
          onDragChange={gridState.onDragChange}
          onRightClickCell={forcedInputLayout ? handleRightClickCell : undefined}
          forcedInputLayout={forcedInputLayout || undefined}
        />
      </main>

      <aside className="panel-right">
        <Toolbar
          inputMode={gridState.inputMode}
          onInputModeChange={gridState.setInputMode}
          onColorSelect={c => gridState.applyColor(c)}
          onColorErase={gridState.eraseColor}
          activeColor={gridState.activeColor}
          onActiveColorChange={gridState.setActiveColor}
          onUndo={gridState.undo}
          onRedo={gridState.redo}
          onErase={gridState.clearValues}
          theme={theme}
          onThemeToggle={toggleTheme}
          activeMark={gridState.activeMark}
          onActiveMarkChange={gridState.setActiveMark}
          onMarkSelect={shape => gridState.toggleMark(shape)}
          onMarkErase={gridState.eraseMark}
          onSubmit={canSubmit ? handleSubmit : undefined}
          forcedInputLayout={forcedInputLayout || undefined}
        />
      </aside>

      <Modal {...modalProps} />
    </div>
  )
}
