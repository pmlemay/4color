import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useGrid } from '../hooks/useGrid'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTheme } from '../hooks/useTheme'
import { Grid } from '../components/Grid/Grid'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { InfoPanel } from '../components/InfoPanel/InfoPanel'
import { ResizableLeft } from '../components/ResizableLeft'
import { fetchPuzzle, puzzleToGrid } from '../utils/puzzleIO'
import { savePlayerData, loadPlayerData, clearPlayerData, applyPlayerData } from '../utils/playerSave'
import { PuzzleData } from '../types'

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
    onActiveColorChange: gridState.setActiveColor,
    onActiveMarkChange: gridState.setActiveMark,
    toggleMark: gridState.toggleMark,
  })

  const handleClearPlayerInput = () => {
    if (!window.confirm('Are you sure you want to reset all your input?')) return
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
          onErase={gridState.clearValues}
          theme={theme}
          onThemeToggle={toggleTheme}
          activeMark={gridState.activeMark}
          onActiveMarkChange={gridState.setActiveMark}
          onMarkSelect={shape => gridState.toggleMark(shape)}
          onMarkErase={gridState.eraseMark}
        />
      </aside>
    </div>
  )
}
