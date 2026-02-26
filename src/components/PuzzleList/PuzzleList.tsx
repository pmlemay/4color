import { useEffect, useState } from 'react'
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

  useEffect(() => {
    fetchPuzzleIndex().then(data => {
      setPuzzles(data)
      setLoading(false)
    })
  }, [])

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

      {loading ? (
        <p>Loading puzzles...</p>
      ) : puzzles.length === 0 ? (
        <p className="empty-state">
          No puzzles yet. <Link to="/edit">Create one</Link> to get started!
        </p>
      ) : (
        <div className="puzzle-cards">
          {puzzles.map(p => (
            <div key={p.id} className="puzzle-card-row">
              <Link to={`/play/${p.id}`} className="puzzle-card">
                <h3>{p.title}</h3>
                <p className="puzzle-meta">
                  by {p.author} &middot; {p.gridSize.rows}&times;{p.gridSize.cols}
                  {p.difficulty && <> &middot; {p.difficulty}</>}
                </p>
              </Link>
              {debug && <Link to={`/edit/${p.id}`} className="puzzle-edit-btn" title="Edit puzzle">&#9998;</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
