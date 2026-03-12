import { useRef, useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'

interface CluesBarProps {
  specialRulesList?: string[]
  struckSpecialRuleWords?: Set<string>
  onStruckSpecialRuleWordsChange?: Dispatch<SetStateAction<Set<string>>>
  cluesList: string[]
  struckClueWords: Set<string>
  onStruckClueWordsChange: Dispatch<SetStateAction<Set<string>>>
}

function makeStrikable(struckSet: Set<string>, setFn: Dispatch<SetStateAction<Set<string>>>) {
  const toggleWord = (key: string) => {
    setFn(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllWords = (text: string, itemIndex: number) => {
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

  const renderStrikableText = (text: string, itemIndex: number) => {
    return text.split(/(\s+)/).map((part, wi) => {
      if (/^\s+$/.test(part)) return part
      const key = `${itemIndex}:${wi}`
      const isStruck = struckSet.has(key)
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

  return { toggleAllWords, renderStrikableText }
}

export function CluesBar({ specialRulesList, struckSpecialRuleWords, onStruckSpecialRuleWordsChange, cluesList, struckClueWords, onStruckClueWordsChange }: CluesBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [specialRulesOpen, setSpecialRulesOpen] = useState(true)

  const updateShadows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateShadows()
    el.addEventListener('scroll', updateShadows, { passive: true })
    const ro = new ResizeObserver(updateShadows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateShadows)
      ro.disconnect()
    }
  }, [updateShadows, cluesList, specialRulesList])

  const hasSpecialRules = specialRulesList && specialRulesList.length > 0 && struckSpecialRuleWords && onStruckSpecialRuleWordsChange
  const hasClues = cluesList.length > 0

  if (!hasClues && !hasSpecialRules) return null

  const clueStrikable = makeStrikable(struckClueWords, onStruckClueWordsChange)
  const specialStrikable = hasSpecialRules ? makeStrikable(struckSpecialRuleWords, onStruckSpecialRuleWordsChange) : null

  const shadowClass = [
    'clues-bar',
    canScrollUp ? 'clues-bar--shadow-top' : '',
    canScrollDown ? 'clues-bar--shadow-bottom' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shadowClass} ref={scrollRef}>
      {hasSpecialRules && (
        <>
          <div className="clues-bar-section-title" onClick={() => setSpecialRulesOpen(o => !o)}>
            <span className={`info-chevron ${specialRulesOpen ? 'open' : ''}`}>&#9656;</span>
            Special Rules
          </div>
          {specialRulesOpen && (
            <ul className="clues-bar-list">
              {specialRulesList.map((rule, i) => (
                <li key={i} className="clues-bar-item" onClick={() => specialStrikable!.toggleAllWords(rule, i)}>
                  {specialStrikable!.renderStrikableText(rule, i)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {hasClues && (
        <>
          {hasSpecialRules && (
            <div className="clues-bar-separator">CLUES:</div>
          )}
          <ul className="clues-bar-list">
            {cluesList.map((clue, i) => (
              <li key={i} className="clues-bar-item" onClick={() => clueStrikable.toggleAllWords(clue, i)}>
                {clueStrikable.renderStrikableText(clue, i)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
