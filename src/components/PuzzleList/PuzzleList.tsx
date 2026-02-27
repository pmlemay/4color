import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PuzzleIndexEntry } from '../../types'
import { fetchPuzzleIndex } from '../../utils/puzzleIO'
import { useTheme } from '../../hooks/useTheme'
import './PuzzleList.css'

export function PuzzleList() {
  const debug = new URLSearchParams(window.location.hash.split('?')[1] || '').get('debug') === 'true'
  const { theme, toggle: toggleTheme } = useTheme()
  const [puzzles, setPuzzles] = useState<PuzzleIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagMode, setTagMode] = useState<'or' | 'and'>('or')
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPuzzleIndex().then(data => {
      setPuzzles(data)
      setLoading(false)
    })
  }, [])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const p of puzzles) {
      for (const t of p.tags || []) tags.add(t)
    }
    return [...tags].sort()
  }, [puzzles])

  const allDifficulties = useMemo(() => {
    const order = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard']
    const diffs = new Set<string>()
    for (const p of puzzles) {
      if (p.difficulty) diffs.add(p.difficulty)
    }
    const sorted = order.filter(d => diffs.has(d))
    for (const d of diffs) {
      if (!sorted.includes(d)) sorted.push(d)
    }
    return sorted
  }, [puzzles])

  const filteredPuzzles = useMemo(() => {
    let result = puzzles
    if (selectedTags.size > 0) {
      result = result.filter(p => {
        const pt = p.tags || []
        if (tagMode === 'or') return pt.some(t => selectedTags.has(t))
        return [...selectedTags].every(t => pt.includes(t))
      })
    }
    if (selectedDifficulties.size > 0) {
      result = result.filter(p => p.difficulty != null && selectedDifficulties.has(p.difficulty))
    }
    return result
  }, [puzzles, selectedTags, tagMode, selectedDifficulties])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const toggleDifficulty = (d: string) => {
    setSelectedDifficulties(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="puzzle-list-page">
      <div className="puzzle-list-header">
        <h1>4Color Puzzles</h1>
        <button className="puzzle-list-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '\u263E' : '\u2600'}
        </button>
      </div>
      <div className="puzzle-list-actions">
        <Link to="/edit" className="new-puzzle-btn">Create New Puzzle</Link>
      </div>

      {(allTags.length > 0 || allDifficulties.length > 0) && (
        <div className="filter-bars">
          {allDifficulties.length > 0 && (
            <div className="tag-filter-bar">
              {allDifficulties.map(d => (
                <button
                  key={d}
                  className={`tag-chip difficulty${selectedDifficulties.has(d) ? ' selected' : ''}`}
                  onClick={() => toggleDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {allTags.length > 0 && (
            <div className="tag-filter-bar">
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-chip${selectedTags.has(tag) ? ' selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.size >= 2 && (
                <button
                  className="tag-mode-toggle"
                  onClick={() => setTagMode(m => m === 'or' ? 'and' : 'or')}
                  title={tagMode === 'or' ? 'Showing puzzles matching ANY tag' : 'Showing puzzles matching ALL tags'}
                >
                  {tagMode.toUpperCase()}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p>Loading puzzles...</p>
      ) : puzzles.length === 0 ? (
        <p className="empty-state">
          No puzzles yet. <Link to="/edit">Create one</Link> to get started!
        </p>
      ) : (
        <div className="puzzle-cards">
          {filteredPuzzles.map(p => (
            <div key={p.id} className="puzzle-card-row">
              <Link to={`/play/${p.id}`} className="puzzle-card">
                <h3>{p.title}</h3>
                <p className="puzzle-meta">
                  by {p.author} &middot; {p.gridSize.rows}&times;{p.gridSize.cols}
                  {p.difficulty && <> &middot; {p.difficulty}</>}
                </p>
                {p.tags && p.tags.length > 0 && (
                  <div className="puzzle-tags">
                    {p.tags.map(t => <span key={t} className="puzzle-tag">{t}</span>)}
                  </div>
                )}
              </Link>
              {debug && <Link to={`/edit/${p.id}`} className="puzzle-edit-btn" title="Edit puzzle">&#9998;</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
