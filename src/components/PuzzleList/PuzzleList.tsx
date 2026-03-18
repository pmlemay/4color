import { useEffect, useMemo, useRef, useState } from 'react'
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
import { ThemeToggle } from '../ThemeToggle'
import { usePuzzleStats } from '../../hooks/usePuzzleStats'
import { useActivePlayers } from '../../hooks/useActivePlayers'
import './PuzzleList.css'

export function PuzzleList() {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const debug = new URLSearchParams(window.location.search).get('debug') === 'true'
  const { theme, toggle: toggleTheme } = useTheme()
  const { user, signIn, signOut } = useAuth()
  const { completedPuzzleIds, completionTimes, displayName, setDisplayName } = useCompletions()
  const leaderboard = useLeaderboard()
  const puzzleStats = usePuzzleStats()
  const activePlayers = useActivePlayers()
  const { modalProps, showConfirm } = useModal()
  const [showAccount, setShowAccount] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [puzzles, setPuzzles] = useState<PuzzleIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => {
    try { const v = sessionStorage.getItem('filterTags'); return v ? new Set(JSON.parse(v)) : new Set() } catch { return new Set() }
  })
  const [tagMode, setTagMode] = useState<'or' | 'and'>(() => {
    return (sessionStorage.getItem('filterTagMode') as 'or' | 'and') || 'or'
  })
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(() => {
    try { const v = sessionStorage.getItem('filterDifficulties'); return v ? new Set(JSON.parse(v)) : new Set() } catch { return new Set() }
  })
  const [selectedAuthors, setSelectedAuthors] = useState<Set<string>>(() => {
    try { const v = sessionStorage.getItem('filterAuthors'); return v ? new Set(JSON.parse(v)) : new Set() } catch { return new Set() }
  })
  const [hideCompleted, setHideCompleted] = useState(() => {
    return sessionStorage.getItem('filterHideCompleted') === 'true'
  })

  const mainRef = useRef<HTMLDivElement>(null)

  // Persist filter state to sessionStorage
  useEffect(() => { sessionStorage.setItem('filterTags', JSON.stringify([...selectedTags])) }, [selectedTags])
  useEffect(() => { sessionStorage.setItem('filterTagMode', tagMode) }, [tagMode])
  useEffect(() => { sessionStorage.setItem('filterDifficulties', JSON.stringify([...selectedDifficulties])) }, [selectedDifficulties])
  useEffect(() => { sessionStorage.setItem('filterAuthors', JSON.stringify([...selectedAuthors])) }, [selectedAuthors])
  useEffect(() => { sessionStorage.setItem('filterHideCompleted', String(hideCompleted)) }, [hideCompleted])

  useEffect(() => {
    fetchPuzzleIndex().then(data => {
      setPuzzles(isDev ? data : data.filter(p => !p.inProgress))
      setLoading(false)
    })
  }, [])

  // Restore scroll position after puzzles load
  useEffect(() => {
    if (!loading && mainRef.current) {
      const saved = sessionStorage.getItem('puzzleListScroll')
      if (saved) {
        const el = mainRef.current
        requestAnimationFrame(() => { el.scrollTop = Number(saved) })
      }
    }
  }, [loading])

  // Save scroll position on scroll
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => {
      sessionStorage.setItem('puzzleListScroll', String(el.scrollTop))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const p of puzzles) {
      for (const t of p.tags || []) tags.add(t)
    }
    return [...tags].sort()
  }, [puzzles])

  const allAuthors = useMemo(() => {
    const authors = new Set<string>()
    for (const p of puzzles) {
      for (const a of p.authors || []) authors.add(a)
    }
    return [...authors].sort()
  }, [puzzles])

  const allDifficulties = useMemo(() => {
    const order = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard', 'Expert']
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
    if (selectedAuthors.size > 0) {
      result = result.filter(p => (p.authors || []).some(a => selectedAuthors.has(a)))
    }
    if (hideCompleted) {
      result = result.filter(p => !completedPuzzleIds.has(p.id))
    }
    return result
  }, [puzzles, selectedTags, tagMode, selectedDifficulties, selectedAuthors, hideCompleted, completedPuzzleIds])

  const completionStats = useMemo(() => {
    // Count against filteredPuzzles but before hideCompleted is applied
    let pool = puzzles
    if (selectedTags.size > 0) {
      pool = pool.filter(p => {
        const pt = p.tags || []
        if (tagMode === 'or') return pt.some(t => selectedTags.has(t))
        return [...selectedTags].every(t => pt.includes(t))
      })
    }
    if (selectedDifficulties.size > 0) {
      pool = pool.filter(p => p.difficulty != null && selectedDifficulties.has(p.difficulty))
    }
    if (selectedAuthors.size > 0) {
      pool = pool.filter(p => (p.authors || []).some(a => selectedAuthors.has(a)))
    }
    const completed = pool.filter(p => completedPuzzleIds.has(p.id)).length
    return { completed, total: pool.length }
  }, [puzzles, selectedTags, tagMode, selectedDifficulties, selectedAuthors, completedPuzzleIds])

  const groupedPuzzles = useMemo(() => {
    const order = ['Very easy', 'Easy', 'Medium', 'Hard', 'Very hard', 'Expert']
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

  const toggleAuthor = (a: string) => {
    setSelectedAuthors(prev => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
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

      <div className="puzzle-list-main" ref={mainRef}>
        <div className="puzzle-list-topbar">
          <span
            className="discord-link notranslate"
            title="Click to copy Discord username"
            onClick={() => { navigator.clipboard.writeText('pmlemay'); alert('Copied pmlemay to clipboard!') }}
          >
            Contact me on Discord : pmlemay
          </span>
          <span className="discord-link" onClick={() => setShowAbout(true)}>About / Credits</span>
          <LanguagePicker />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div className="puzzle-list-header">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="4Color logo" className="puzzle-list-logo" />
          <h1>4Color Puzzles</h1>
        </div>

        <div className="puzzle-list-actions">
          <Link to="/edit" className="new-puzzle-btn">Create New Puzzle</Link>
        </div>

        {(allTags.length > 0 || allDifficulties.length > 0 || allAuthors.length > 0) && (
          <div className="filter-bars">
            {completedPuzzleIds.size > 0 && (
              <div className="tag-filter-bar">
                <button
                  className={`tag-chip${hideCompleted ? ' selected' : ''}`}
                  onClick={() => setHideCompleted(h => !h)}
                >
                  Hide completed
                </button>
                <span className="completion-count">
                  Completed {completionStats.completed} out of {completionStats.total}
                </span>
              </div>
            )}
            {allDifficulties.length > 0 && (
              <div className="tag-filter-bar">
                <span className="filter-label">Difficulty:</span>
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
                <span className="filter-label">Tags:</span>
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
            {allAuthors.length > 0 && (
              <div className="tag-filter-bar">
                <span className="filter-label">Authors:</span>
                {allAuthors.map(a => (
                  <button
                    key={a}
                    className={`tag-chip notranslate${selectedAuthors.has(a) ? ' selected' : ''}`}
                    onClick={() => toggleAuthor(a)}
                  >
                    {a}
                  </button>
                ))}
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
                    <div key={p.id} className={`puzzle-card-row${p.inProgress ? ' puzzle-in-progress' : ''}`}>
                      <Link to={`/play/${p.id}`} className={`puzzle-card${completedPuzzleIds.has(p.id) ? ' puzzle-completed' : ''}`}>
                        {p.thumbnail && <img src={`${import.meta.env.BASE_URL}puzzles/${p.thumbnail}`} alt="" className="puzzle-thumbnail" />}
                        <h3>{p.title}</h3>
                        <p className="puzzle-meta">
                          {p.authors && p.authors.length > 0 ? <>by {p.authors.join(', ')} &middot; </> : ''}{p.gridSize.rows}&times;{p.gridSize.cols}
                        </p>
                        {p.tags && p.tags.length > 0 && (
                          <div className="puzzle-tags">
                            {p.tags.slice(0, 3).map(t => <span key={t} className="puzzle-tag">{t}</span>)}
                            {p.tags.length > 3 && <span className="puzzle-tag puzzle-tag-more">+{p.tags.length - 3}</span>}
                          </div>
                        )}
                        {activePlayers.has(p.id) && (() => {
                          const all = activePlayers.get(p.id)!
                          const shown = all.slice(0, 3)
                          const extra = all.length - 3
                          const truncate = (s: string) => s.length > 10 ? s.slice(0, 10) + '\u2026' : s
                          return (
                            <div className="currently-playing">
                              {shown.map(ap => (
                                <span key={ap.uid} className="currently-playing-name notranslate" title={ap.displayName}>{truncate(ap.displayName)}</span>
                              ))}
                              {extra > 0 && <span className="currently-playing-more">+{extra}</span>}
                            </div>
                          )
                        })()}
                        {completedPuzzleIds.has(p.id) && (
                          <span className="completed-info">
                            <span className="completed-badge" title="Completed">&#10003;</span>
                            {completionTimes.has(p.id) && <span className="completion-time">{formatTime(completionTimes.get(p.id)!)}</span>}
                          </span>
                        )}
                      </Link>
                      {isDev && puzzleStats.has(p.id) && (
                        <span className="puzzle-stat-count" title="Total completions (all users)">{puzzleStats.get(p.id)}</span>
                      )}
                      {isDev && <Link to={`/edit/${p.id}`} className="puzzle-edit-overlay" title="Edit puzzle">&#9998;</Link>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">About / Credits</h2>
            <div style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
              <p><strong>4Color Puzzles</strong> — a browser-based puzzle game.</p>
              <p style={{ marginTop: 8 }}>
                Icon library from{' '}
                <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer">game-icons.net</a>{' '}
                — licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.
              </p>
              <p style={{ marginTop: 4 }}>
                Additional icons designed by{' '}
                <a href="https://www.freepik.com" target="_blank" rel="noopener noreferrer">Freepik</a>{' '}
                from <a href="https://www.flaticon.com" target="_blank" rel="noopener noreferrer">Flaticon</a>.
              </p>
              <p style={{ marginTop: 4 }}>
                Rule text source:{' '}
                <a href="https://docs.google.com/document/d/11U3UAH6V7k9JTpF_WIKLiREc5KYbJGQP89EUBMLtjW0/edit?tab=t.0" target="_blank" rel="noopener noreferrer">Eric Fox's Dictionary of Rulesets</a>.
              </p>
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setShowAbout(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

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
