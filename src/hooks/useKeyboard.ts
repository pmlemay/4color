import { useEffect, useRef } from 'react'
import { InputMode, MarkShape } from '../types'

interface UseKeyboardOptions {
  inputMode: InputMode
  applyValue: (value: string) => void
  applyColor: (value: string) => void
  applyFixedValue: (value: string) => void
  applyFixedColor: (value: string) => void
  addNote: (value: string) => void
  clearValues: () => void
  eraseColor?: () => void
  undo: () => void
  redo: () => void
  onEnter?: () => void
  onActiveColorChange?: (color: string) => void
  onActiveMarkChange?: (mark: MarkShape | null) => void
  toggleMark?: (shape: MarkShape) => void
  hasSelection?: boolean
  onInputModeChange?: (mode: InputMode) => void
}

// Map e.code to the unshifted key value (e.g. Shift+1 gives code "Digit1" → "1")
function getUnshiftedKey(code: string): string | null {
  if (code.startsWith('Digit')) return code.charAt(5)
  if (code.startsWith('Key')) return code.charAt(3).toUpperCase()
  return null
}

function getKeyValue(e: KeyboardEvent): string | null {
  // Single printable character (ignore ctrl/alt/meta but allow shift)
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return e.key.toUpperCase()
  }
  return null
}

export function useKeyboard(options: UseKeyboardOptions) {
  const doubleDigitBuffer = useRef<string | null>(null)

  // Clear buffer when leaving fixedDouble mode
  useEffect(() => {
    if (options.inputMode !== 'fixedDouble') {
      doubleDigitBuffer.current = null
    }
  }, [options.inputMode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in input fields
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        options.undo()
        return
      }

      // Ctrl+Y redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        options.redo()
        return
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        options.clearValues()
        return
      }

      // Enter
      if (e.key === 'Enter') {
        e.preventDefault()
        options.onEnter?.()
        return
      }

      // Mode switching hotkeys when no cells are selected
      if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && options.hasSelection === false && options.onInputModeChange) {
        const MODE_KEYS: Record<string, InputMode> = { N: 'normal', C: 'color', X: 'cross', B: 'border', M: 'mark' }
        const upper = e.key.toUpperCase()
        if (upper in MODE_KEYS) {
          e.preventDefault()
          options.onInputModeChange(MODE_KEYS[upper])
          return
        }
      }

      const value = getKeyValue(e)
      if (!value) return
      e.preventDefault()

      // Shift+Key adds a note regardless of current input mode
      // Use unshifted key so Shift+1 gives "1" not "!"
      if (e.shiftKey) {
        const unshifted = getUnshiftedKey(e.code)
        if (unshifted) {
          options.addNote(unshifted)
        }
        return
      }

      switch (options.inputMode) {
        case 'normal':
          options.applyValue(value)
          break
        case 'color':
          if (value === '0') {
            options.onActiveColorChange?.(value)
            options.eraseColor?.()
          } else if (value >= '1' && value <= '9') {
            options.onActiveColorChange?.(value)
            options.applyColor(value)
          }
          break
        case 'fixed':
          options.applyFixedValue(value)
          break
        case 'fixedDouble':
          if (value >= '0' && value <= '9') {
            if (doubleDigitBuffer.current === null) {
              doubleDigitBuffer.current = value
            } else {
              options.applyFixedValue(doubleDigitBuffer.current + value)
              doubleDigitBuffer.current = null
            }
          }
          break
        case 'fixedColor':
          if (value === '0') {
            options.onActiveColorChange?.(value)
            options.eraseColor?.()
          } else if (value >= '1' && value <= '9') {
            options.onActiveColorChange?.(value)
            options.applyFixedColor(value)
          }
          break
        case 'note':
          options.addNote(value)
          break
        case 'mark': {
          const SHAPES: MarkShape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'dot']
          const idx = parseInt(value) - 1
          if (idx >= 0 && idx < SHAPES.length) {
            const shape = SHAPES[idx]
            options.onActiveMarkChange?.(shape)
            options.toggleMark?.(shape)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [options.inputMode, options.applyValue, options.applyColor, options.applyFixedValue, options.applyFixedColor, options.addNote, options.clearValues, options.eraseColor, options.undo, options.redo, options.onEnter, options.onActiveColorChange, options.onActiveMarkChange, options.toggleMark, options.hasSelection, options.onInputModeChange])
}
