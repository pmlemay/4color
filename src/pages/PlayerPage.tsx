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
import { fetchPuzzle, fetchPuzzleSolution, puzzleToGrid } from '../utils/puzzleIO'
import { savePlayerData, loadPlayerData, clearPlayerData, applyPlayerData } from '../utils/playerSave'
import { validate4Color, validateMurdoku } from '../utils/validate'
import { PuzzleData, PuzzleSolution } from '../types'

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
  const gridState = useGrid(1, 1)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!puzzleId) return
    fetchPuzzle(puzzleId).then(data => {
      if (data) {
        setPuzzle(data)
        let grid = puzzleToGrid(data)
        const saved = loadPlayerData(puzzleId)
        if (saved) {
          grid = applyPlayerData(grid, saved)
          setStruckRuleWords(new Set(saved.struckRules))
          setStruckClueWords(new Set(saved.struckClues))
        }
        gridState.setGrid(grid)
        gridState.setAutoCrossRules(data.autoCrossRules || [])
        // Fetch solution file if it exists (for murdoku etc.)
        fetchPuzzleSolution(puzzleId).then(sol => { if (sol) setSolution(sol) })
        // Mark as loaded after a tick so the initial setGrid doesn't trigger a save
        setTimeout(() => { loaded.current = true }, 0)
      } else {
        setError(true)
      }
      setLoading(false)
    })
  }, [puzzleId])

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!puzzleId || !loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      savePlayerData(puzzleId, gridState.grid, struckRuleWords, struckClueWords)
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [gridState.grid, struckRuleWords, struckClueWords, puzzleId])

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

  const is4Color = puzzle?.tags?.includes('4color') ?? false
  const isMurdoku = puzzle?.tags?.includes('murdoku') ?? false
  const canSubmit = is4Color || (isMurdoku && !!solution)

  const handleSubmit = useCallback(async () => {
    let result: { valid: boolean; error?: string }
    if (is4Color) {
      result = validate4Color(gridState.grid)
    } else if (isMurdoku && solution) {
      result = validateMurdoku(gridState.grid, solution)
    } else {
      return
    }
    if (result.valid) {
      const clear = await showConfirm('Congratulations!', 'Puzzle Solved!', 'Clear Puzzle', 'Keep')
      if (clear) doClearPlayerInput()
    } else {
      await showAlert(result.error || 'Not quite right. Keep trying!', 'Not Quite')
    }
  }, [gridState.grid, is4Color, isMurdoku, solution, showConfirm, showAlert])

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
          struckRuleWords={struckRuleWords}
          onStruckRuleWordsChange={setStruckRuleWords}
          struckClueWords={struckClueWords}
          onStruckClueWordsChange={setStruckClueWords}
        >
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
        />
      </aside>

      <Modal {...modalProps} />
    </div>
  )
}
