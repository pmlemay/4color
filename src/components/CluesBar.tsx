import type { Dispatch, SetStateAction } from 'react'

interface CluesBarProps {
  cluesList: string[]
  struckClueWords: Set<string>
  onStruckClueWordsChange: Dispatch<SetStateAction<Set<string>>>
}

export function CluesBar({ cluesList, struckClueWords, onStruckClueWordsChange }: CluesBarProps) {
  if (!cluesList.length) return null

  const toggleWord = (key: string) => {
    onStruckClueWordsChange(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllWords = (text: string, itemIndex: number) => {
    const wordKeys = text.split(/(\s+)/).map((part, wi) => /^\s+$/.test(part) ? null : `${itemIndex}:${wi}`).filter(Boolean) as string[]
    const allStruck = wordKeys.every(k => struckClueWords.has(k))
    onStruckClueWordsChange(prev => {
      const next = new Set(prev)
      for (const k of wordKeys) {
        if (allStruck) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  const renderStrikableText = (text: string, itemIndex: number) => {
    return text.split(/(\s+)/).map((part, wi) => {
      if (/^\s+$/.test(part)) return part
      const key = `${itemIndex}:${wi}`
      const isStruck = struckClueWords.has(key)
      return (
        <span
          key={wi}
          className={`info-word ${isStruck ? 'info-word-struck' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleWord(key) }}
        >
          {part}
        </span>
      )
    })
  }

  return (
    <div className="clues-bar">
      <ul className="clues-bar-list">
        {cluesList.map((clue, i) => (
          <li key={i} className="clues-bar-item" onClick={() => toggleAllWords(clue, i)}>
            {renderStrikableText(clue, i)}
          </li>
        ))}
      </ul>
    </div>
  )
}
