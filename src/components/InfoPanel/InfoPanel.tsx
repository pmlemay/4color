import { useState } from 'react'
import { Link } from 'react-router-dom'
import './InfoPanel.css'

interface InfoPanelProps {
  title?: string
  author?: string
  gridSize?: { rows: number; cols: number }
  difficulty?: string
  rulesList?: string[]
  cluesList?: string[]
  backLink?: boolean
  children?: React.ReactNode
  struckRuleWords?: Set<string>
  onStruckRuleWordsChange?: (s: Set<string>) => void
  struckClueWords?: Set<string>
  onStruckClueWordsChange?: (s: Set<string>) => void
}

export function InfoPanel({ title, author, gridSize, difficulty, rulesList, cluesList, backLink = true, children, struckRuleWords: controlledStruckRules, onStruckRuleWordsChange, struckClueWords: controlledStruckClues, onStruckClueWordsChange }: InfoPanelProps) {
  // Internal state used when not controlled (e.g. editor mode)
  const [internalStruckRules, setInternalStruckRules] = useState<Set<string>>(new Set())
  const [internalStruckClues, setInternalStruckClues] = useState<Set<string>>(new Set())
  const [rulesOpen, setRulesOpen] = useState(true)
  const [cluesOpen, setCluesOpen] = useState(true)

  const struckRuleWords = controlledStruckRules ?? internalStruckRules
  const setStruckRuleWords = onStruckRuleWordsChange ?? setInternalStruckRules
  const struckClueWords = controlledStruckClues ?? internalStruckClues
  const setStruckClueWords = onStruckClueWordsChange ?? setInternalStruckClues

  const toggleWord = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setFn(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllWords = (text: string, itemIndex: number, struckSet: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const wordKeys = text.split(/(\s+)/).map((part, wi) => /^\s+$/.test(part) ? null : `${itemIndex}:${wi}`).filter(Boolean) as string[]
    const allStruck = wordKeys.every(k => struckSet.has(k))
    setFn(prev => {
      const next = new Set(prev)
      for (const k of wordKeys) {
        if (allStruck) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  const renderStrikableText = (text: string, itemIndex: number, struckSet: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    return text.split(/(\s+)/).map((part, wi) => {
      if (/^\s+$/.test(part)) return part
      const key = `${itemIndex}:${wi}`
      const isStruck = struckSet.has(key)
      return (
        <span
          key={wi}
          className={`info-word ${isStruck ? 'info-word-struck' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleWord(setFn, key) }}
        >
          {part}
        </span>
      )
    })
  }

  return (
    <div className="info-panel">
      {backLink && (
        <Link to="/" className="info-back-link">&larr; Puzzles</Link>
      )}

      {title && (
        <div className="info-section">
          <h2 className="info-title">{title}</h2>
          {author && <p className="info-meta">by {author}</p>}
          {gridSize && (
            <p className="info-meta">{gridSize.rows}&times;{gridSize.cols}</p>
          )}
          {difficulty && <p className="info-meta">Difficulty: {difficulty}</p>}
        </div>
      )}

      {rulesList && rulesList.length > 0 && (
        <div className="info-section">
          <div className="info-section-title info-collapsible" onClick={() => setRulesOpen(o => !o)}>
            <span className={`info-chevron ${rulesOpen ? 'open' : ''}`}>&#9656;</span>
            Rules
          </div>
          {rulesOpen && (
            <ul className="info-list">
              {rulesList.map((rule, i) => (
                <li key={i} className="info-list-text info-list-bullet" onClick={() => toggleAllWords(rule, i, struckRuleWords, setStruckRuleWords)}>
                  {renderStrikableText(rule, i, struckRuleWords, setStruckRuleWords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {cluesList && cluesList.length > 0 && (
        <div className="info-section">
          <div className="info-section-title info-collapsible" onClick={() => setCluesOpen(o => !o)}>
            <span className={`info-chevron ${cluesOpen ? 'open' : ''}`}>&#9656;</span>
            Clues
          </div>
          {cluesOpen && (
            <ul className="info-list">
              {cluesList.map((clue, i) => (
                <li key={i} className="info-list-text info-list-bullet" onClick={() => toggleAllWords(clue, i, struckClueWords, setStruckClueWords)}>
                  {renderStrikableText(clue, i, struckClueWords, setStruckClueWords)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {children && (
        <div className="info-section">
          {children}
        </div>
      )}
    </div>
  )
}
