import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { useGrid } from '../hooks/useGrid'
import { useKeyboard } from '../hooks/useKeyboard'
import { useTheme } from '../hooks/useTheme'
import { Grid } from '../components/Grid/Grid'
import { Toolbar } from '../components/Toolbar/Toolbar'
import { InfoPanel } from '../components/InfoPanel/InfoPanel'
import { ResizableLeft } from '../components/ResizableLeft'
import { gridToPuzzle, downloadPuzzleJSON, savePuzzleToServer, puzzleToGrid, fetchPuzzle } from '../utils/puzzleIO'
import { PuzzleData } from '../types'

export function EditorPage() {
  const { puzzleId } = useParams()
  const [searchParams] = useSearchParams()
  const debug = searchParams.get('debug') === 'true'
  const paramRows = Number(searchParams.get('rows')) || 10
  const paramCols = Number(searchParams.get('cols')) || 10

  const { theme, toggle: toggleTheme } = useTheme()
  const [rows, setRows] = useState(paramRows)
  const [cols, setCols] = useState(paramCols)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [rules, setRules] = useState<string[]>([])
  const [clues, setClues] = useState<string[]>([])
  const [newRule, setNewRule] = useState('')
  const [newClue, setNewClue] = useState('')
  const [imageLibrary, setImageLibrary] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  const gridState = useGrid(rows, cols)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (puzzleId) {
      fetchPuzzle(puzzleId).then(puzzle => {
        if (puzzle) {
          setTitle(puzzle.title)
          setAuthor(puzzle.author)
          setRows(puzzle.gridSize.rows)
          setCols(puzzle.gridSize.cols)
          setDifficulty(puzzle.difficulty || '')
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
    onEnter: () => {
      if (selectedImageIndex !== null && imageLibrary[selectedImageIndex]) {
        gridState.applyImage(imageLibrary[selectedImageIndex])
      }
    },
  })

  const handleSave = async () => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
    const puzzle = gridToPuzzle(gridState.grid, { id, title: title || 'Untitled', author, rules, clues, difficulty })

    if (puzzleId) {
      // Editing an existing puzzle — save directly to puzzles folder
      puzzle.id = puzzleId
      const result = await savePuzzleToServer(puzzle)
      if (result.ok) {
        alert(`Saved to puzzles/${result.file}`)
      } else {
        alert(`Save failed: ${result.error}\nFalling back to download.`)
        downloadPuzzleJSON(puzzle)
      }
    } else {
      downloadPuzzleJSON(puzzle)
    }
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all? This cannot be undone.')) {
      gridState.resetGrid(rows, cols)
    }
  }

  const handleClearPlayerInput = () => {
    if (!window.confirm('Clear all player input? Puzzle layout (fixed values, colors, borders, images, labels) will be kept.')) return
    gridState.setGrid(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          value: null,
          notes: [],
          color: cell.fixedColor ? cell.color : null,
          crossed: false,
          mark: null,
          selected: false,
          borders: [...cell.fixedBorders] as [number, number, number, number],
        }))
      )
    )
  }

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) {
      alert('Image must be under 200KB.')
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

  const [editingItem, setEditingItem] = useState<{ type: 'rule' | 'clue'; index: number } | null>(null)
  const [editingText, setEditingText] = useState('')
  const dragItem = useRef<{ type: 'rule' | 'clue'; index: number } | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const handleDragStart = useCallback((type: 'rule' | 'clue', index: number) => {
    dragItem.current = { type, index }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragOverItem.current = index
  }, [])

  const handleDrop = useCallback((type: 'rule' | 'clue') => {
    if (!dragItem.current || dragOverItem.current === null || dragItem.current.type !== type) return
    const from = dragItem.current.index
    const to = dragOverItem.current
    if (from === to) return
    const setter = type === 'rule' ? setRules : setClues
    setter(prev => {
      const items = [...prev]
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return items
    })
    dragItem.current = null
    dragOverItem.current = null
  }, [])

  const startEditing = useCallback((type: 'rule' | 'clue', index: number, text: string) => {
    setEditingItem({ type, index })
    setEditingText(text)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingItem) return
    const trimmed = editingText.trim()
    const setter = editingItem.type === 'rule' ? setRules : setClues
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
        setTitle(puzzle.title)
        setAuthor(puzzle.author)
        setRows(puzzle.gridSize.rows)
        setCols(puzzle.gridSize.cols)
        setDifficulty(puzzle.difficulty || '')
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
        alert('Invalid puzzle JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page-layout">
      <ResizableLeft>
        <InfoPanel title="Puzzle Editor" backLink>
          <div className="info-editor-field">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="My Puzzle" />
          </div>
          <div className="info-editor-field">
            <label>Author</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
          <div className="info-editor-field">
            <label>Difficulty</label>
            <input value={difficulty} onChange={e => setDifficulty(e.target.value)} placeholder="e.g. Easy, Medium, Hard" />
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
          isEditor
          theme={theme}
          onThemeToggle={toggleTheme}
          imageLibrary={imageLibrary}
          selectedImageIndex={selectedImageIndex}
          onImageSelect={handleImageSelect}
          onImageApply={handleImageApply}
          onImageRemove={gridState.removeImage}
          onImageImport={() => imageInputRef.current?.click()}
        />
      </aside>
    </div>
  )
}
