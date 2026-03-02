import { useState, useRef, useMemo } from 'react'

interface PillInputProps {
  values: string[]
  onChange: (values: string[]) => void
  known: string[]
  placeholder?: string
}

export function PillInput({ values, onChange, known, placeholder }: PillInputProps) {
  const [input, setInput] = useState('')
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = input.toLowerCase().trim()
    if (!q) return []
    return known.filter(k => k.toLowerCase().includes(q) && !values.includes(k))
  }, [input, known, values])

  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setInput('')
    setSuggestionIndex(-1)
    inputRef.current?.focus()
  }

  const remove = (value: string) => {
    onChange(values.filter(v => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
        add(suggestions[suggestionIndex])
      } else if (input.trim()) {
        add(input)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      remove(values[values.length - 1])
    } else if (e.key === 'Escape') {
      setInput('')
      setSuggestionIndex(-1)
    }
  }

  return (
    <div className="tag-input-wrapper" onClick={() => inputRef.current?.focus()}>
      {values.map(v => (
        <span key={v} className="tag-input-pill">
          {v}
          <button onClick={() => remove(v)}>&times;</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => { setInput(e.target.value); setSuggestionIndex(-1) }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestionIndex(-1), 150)}
        placeholder={values.length === 0 ? (placeholder ?? '') : ''}
        className="tag-input-bare"
      />
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map((s, i) => (
            <div
              key={s}
              className={`tag-suggestion${i === suggestionIndex ? ' active' : ''}`}
              onMouseDown={() => add(s)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
