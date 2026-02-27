import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PuzzleIndexEntry } from '../../types'
import { fetchPuzzleIndex } from '../../utils/puzzleIO'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../contexts/AuthContext'
import { useCompletions } from '../../hooks/useCompletions'
import { formatTime } from '../../utils/formatTime'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { useModal } from '../../hooks/useModal'
import { Modal } from '../Modal/Modal'
import { LanguagePicker } from '../LanguagePicker'
import './PuzzleList.css'

export function PuzzleList() {
  const debug = new URLSearchParams(window.location.hash.split('?')[1] || '').get('debug') === 'true'
  const { theme, toggle: toggleTheme } = useTheme()
  const { user, signIn, signOut } = useAuth()
  const { completedPuzzleIds, completionTimes, displayName, setDisplayName } = useCompletions()
  const leaderboard = useLeaderboard(10)
  const { modalProps, showConfirm } = useModal()
  const [showAccount, setShowAccount] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [puzzles, setPuzzles] = useState<PuzzleIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagMode, setTagMode] = useState<'or' | 'and'>('or')
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set())
  const [hideCompleted, setHideCompleted] = useState(false)

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
    if (hideCompleted) {
      result = result.filter(p => !completedPuzzleIds.has(p.id))
    }
    return result
  }, [puzzles, selectedTags, tagMode, selectedDifficulties, hideCompleted, completedPuzzleIds])

  const groupedPuzzles = useMemo(() => {
    const order = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard']
    const groups: { difficulty: string; puzzles: typeof filteredPuzzles }[] = []
    const byDiff = new Map<string, typeof filteredPuzzles>()
    for (const p of filteredPuzzles) {
      const d = p.difficulty || 'Unrated'
      if (!byDiff.has(d)) byDiff.set(d, [])
      byDiff.get(d)!.push(p)
    }
    for (const d of order) {
      if (byDiff.has(d)) {
        groups.push({ difficulty: d, puzzles: byDiff.get(d)! })
        byDiff.delete(d)
      }
    }
    for (const [d, puzzles] of byDiff) {
      groups.push({ difficulty: d, puzzles })
    }
    return groups
  }, [filteredPuzzles])

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
    <div className="puzzle-list-layout">
      <aside className="puzzle-list-sidebar">
        <div className="sidebar-section">
          {user ? (
            <button className="auth-btn auth-btn-full notranslate" onClick={() => { setEditingName(displayName); setShowAccount(true) }}>
              {displayName || user.displayName || 'User'}
            </button>
          ) : (
            <button className="auth-btn auth-btn-full" onClick={signIn}>
              Sign in with Google
            </button>
          )}
        </div>
        <div className="sidebar-section">
          <h3 className="sidebar-title">Leaderboard</h3>
          {leaderboard.length === 0 ? (
            <p className="sidebar-empty">No completions yet</p>
          ) : (
            <ol className="leaderboard-list">
              {leaderboard.map((entry, i) => (
                <li key={entry.uid} className={`leaderboard-entry${user && entry.uid === user.uid ? ' leaderboard-self' : ''}`}>
                  <span className="leaderboard-rank">{i + 1}.</span>
                  <span className="leaderboard-name notranslate">{entry.displayName}</span>
                  <span className="leaderboard-count">{entry.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="sidebar-spacer" />
      </aside>

      <div className="puzzle-list-main">
        <div className="puzzle-list-topbar">
          <span
            className="discord-link notranslate"
            title="Click to copy Discord username"
            onClick={() => { navigator.clipboard.writeText('pmlemay'); alert('Copied pmlemay to clipboard!') }}
          >
            Contact me on Discord : pmlemay
          </span>
          <LanguagePicker />
          <button className="puzzle-list-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'light' ? '\u263E' : '\u2600'}
          </button>
        </div>
        <div className="puzzle-list-header">
          <h1>4Color Puzzles</h1>
        </div>
        <div className="puzzle-list-actions">
          <Link to="/edit" className="new-puzzle-btn">Create New Puzzle</Link>
        </div>

        {(allTags.length > 0 || allDifficulties.length > 0) && (
          <div className="filter-bars">
            <div className="tag-filter-bar">
              {completedPuzzleIds.size > 0 && (<>
                <button
                  className={`tag-chip${hideCompleted ? ' selected' : ''}`}
                  onClick={() => setHideCompleted(h => !h)}
                >
                  Hide completed
                </button>
                {allDifficulties.length > 0 && <span className="filter-separator">|</span>}
              </>)}
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
          <div className="puzzle-sections">
            {groupedPuzzles.map(group => (
              <div key={group.difficulty} className="puzzle-section">
                <h2 className="puzzle-section-title">{group.difficulty}</h2>
                <div className="puzzle-cards">
                  {group.puzzles.map(p => (
                    <div key={p.id} className="puzzle-card-row">
                      <Link to={`/play/${p.id}`} className={`puzzle-card${completedPuzzleIds.has(p.id) ? ' puzzle-completed' : ''}`}>
                        <h3>{p.title}{completedPuzzleIds.has(p.id) && <span className="completed-badge" title="Completed">&#10003;</span>}{completionTimes.has(p.id) && <span className="completion-time">{formatTime(completionTimes.get(p.id)!)}</span>}</h3>
                        <p className="puzzle-meta">
                          by {p.author} &middot; {p.gridSize.rows}&times;{p.gridSize.cols}
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
              </div>
            ))}
          </div>
        )}
      </div>

      {showAccount && user && (
        <div className="modal-backdrop" onClick={() => setShowAccount(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Account</h2>
            <p className="account-info">Signed in with Google as {user.email}</p>
            <div className="account-name-field">
              <label>Display name</label>
              <input
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && editingName.trim()) {
                    setDisplayName(editingName.trim())
                    setShowAccount(false)
                  }
                }}
                placeholder={user.displayName || 'Enter a name'}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => {
                if (editingName.trim()) setDisplayName(editingName.trim())
                setShowAccount(false)
              }}>Save</button>
              <button className="modal-btn modal-btn-danger" onClick={async () => {
                setShowAccount(false)
                if (await showConfirm('Are you sure you want to sign out?', 'Sign Out', 'Sign out', 'Cancel')) {
                  signOut()
                }
              }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
      <Modal {...modalProps} />
    </div>
  )
}
