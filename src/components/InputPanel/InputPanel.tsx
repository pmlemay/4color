import { InputMode, MarkShape } from '../../types'
import './InputPanel.css'

const MARK_SHAPES: MarkShape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'dot']
const MARK_LABELS: Record<MarkShape, string> = {
  circle: '\u25CB', square: '\u25A1', triangle: '\u25B3',
  diamond: '\u25C7', pentagon: '\u2B20', hexagon: '\u2B21',
  dot: '\u25CF',
}

interface InputPanelProps {
  inputMode: InputMode
  onInputModeChange: (mode: InputMode) => void
  onValueInput: (val: string) => void
  onNoteInput: (val: string) => void
  valueSet: string[]
  onColorSelect?: (colorIndex: string) => void
  onColorErase?: () => void
  activeColor?: string | null
  onActiveColorChange?: (color: string | null) => void
  activeMark?: MarkShape | null
  onActiveMarkChange?: (mark: MarkShape | null) => void
  onMarkSelect?: (shape: MarkShape) => void
  onMarkErase?: () => void
  onUndo: () => void
  onRedo: () => void
  onErase: () => void
  onSubmit?: () => void
  forcedInputLayout?: string
}

const PLAYER_MODES: { mode: InputMode; label: string; icon: string }[] = [
  { mode: 'normal', label: 'Normal', icon: '✏' },
  { mode: 'note', label: 'Note', icon: '📝' },
  { mode: 'color', label: 'Color', icon: '🎨' },
  { mode: 'cross', label: 'Cross', icon: '✕' },
  { mode: 'border', label: 'Border', icon: '▢' },
  { mode: 'mark', label: 'Mark', icon: '◯' },
]

export function InputPanel({
  inputMode,
  onInputModeChange,
  onValueInput,
  onNoteInput,
  valueSet,
  onColorSelect,
  onColorErase,
  activeColor = null,
  onActiveColorChange,
  activeMark = null,
  onActiveMarkChange,
  onMarkSelect,
  onMarkErase,
  onUndo,
  onRedo,
  onErase,
  onSubmit,
  forcedInputLayout,
}: InputPanelProps) {
  const isNoteMode = inputMode === 'note'
  const isColorMode = inputMode === 'color'
  const isMarkMode = inputMode === 'mark'

  const handleValueTap = (val: string) => {
    if (isNoteMode) {
      onNoteInput(val)
    } else {
      onValueInput(val)
    }
  }

  return (
    <div className="input-panel" onMouseDown={e => e.preventDefault()}>
      {/* Row 1: Mode tabs */}
      {!forcedInputLayout && (
        <div className="ip-modes">
          {PLAYER_MODES.map(m => (
            <button
              key={m.mode}
              className={`ip-mode-btn ${inputMode === m.mode ? 'selected' : ''}`}
              onClick={() => onInputModeChange(inputMode === m.mode ? 'normal' : m.mode)}
            >
              <span className="ip-mode-icon">{m.icon}</span>
              <span className="ip-mode-label">{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Row 2: Context-sensitive buttons */}
      <div className="ip-context">
        {/* Values (normal + note mode) */}
        {(inputMode === 'normal' || isNoteMode) && !forcedInputLayout && (
          <div className="ip-values">
            {valueSet.map(v => (
              <button key={v} className="ip-val-btn" onClick={() => handleValueTap(v)}>
                {v}
              </button>
            ))}
          </div>
        )}

        {/* Color swatches */}
        {isColorMode && !forcedInputLayout && (
          <div className="ip-colors">
            <button
              className={`ip-color-swatch color-erase ${activeColor === '0' ? 'active-color' : ''}`}
              onClick={() => {
                if (activeColor === '0') {
                  onActiveColorChange?.(null)
                } else {
                  onActiveColorChange?.('0')
                  onColorErase?.()
                }
              }}
            >
              ✕
            </button>
            {Array.from({ length: 9 }, (_, i) => i + 1).map(i => (
              <button
                key={i}
                className={`ip-color-swatch color${i} ${activeColor === String(i) ? 'active-color' : ''}`}
                onClick={() => {
                  const c = String(i)
                  if (activeColor === c) {
                    onActiveColorChange?.(null)
                  } else {
                    onActiveColorChange?.(c)
                    onColorSelect?.(c)
                  }
                }}
              >
                {i}
              </button>
            ))}
          </div>
        )}

        {/* Mark shapes */}
        {isMarkMode && !forcedInputLayout && (
          <div className="ip-marks">
            <button
              className={`ip-mark-swatch ${activeMark === null ? 'active-mark' : ''}`}
              onClick={() => { onMarkErase?.(); onActiveMarkChange?.(null) }}
            >
              ✕
            </button>
            {MARK_SHAPES.map(shape => (
              <button
                key={shape}
                className={`ip-mark-swatch ${activeMark === shape ? 'active-mark' : ''}`}
                onClick={() => {
                  if (activeMark === shape) {
                    onActiveMarkChange?.(null)
                  } else {
                    onActiveMarkChange?.(shape)
                    onMarkSelect?.(shape)
                  }
                }}
              >
                {MARK_LABELS[shape]}
              </button>
            ))}
          </div>
        )}

        {/* Nurikabe: tap cycles empty→black→dot→empty, no swatches needed */}
        {forcedInputLayout === 'nurikabe' && (
          <div className="ip-hint">Tap: black &rarr; dot &rarr; clear</div>
        )}

        {/* Border and cross modes: no extra context buttons, just the mode is enough */}
        {(inputMode === 'cross' || inputMode === 'border') && !forcedInputLayout && (
          <div className="ip-hint">
            {inputMode === 'cross' ? 'Tap/drag cells to toggle X marks' : 'Drag between cells to create borders'}
          </div>
        )}
      </div>

      {/* Row 3: Actions */}
      <div className="ip-actions">
        <button className="ip-action-btn" onClick={onErase} title="Erase">⌫</button>
        <button className="ip-action-btn" onClick={onUndo} title="Undo">↩</button>
        <button className="ip-action-btn" onClick={onRedo} title="Redo">↪</button>
        {onSubmit && (
          <button className="ip-submit-btn" onClick={onSubmit}>Submit</button>
        )}
      </div>
    </div>
  )
}
