import { useState } from 'react'
import { InputMode, LabelAlign, MarkShape } from '../../types'
import './Toolbar.css'

const PLAYER_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'normal', label: 'Normal (N)' },
  { mode: 'note', label: 'Note (Shift+Key)' },
  { mode: 'color', label: 'Color (C)' },
  { mode: 'cross', label: 'X Cross (X)' },
  { mode: 'border', label: 'Border (B)' },
  { mode: 'mark', label: 'Marks (M)' },
]

const MARK_SHAPES: MarkShape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'dot']
const MARK_LABELS: Record<MarkShape, string> = {
  circle: '\u25CB', square: '\u25A1', triangle: '\u25B3',
  diamond: '\u25C7', pentagon: '\u2B20', hexagon: '\u2B21',
  dot: '\u25CF',
}

const EDITOR_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'fixed', label: 'Fixed Normal' },
  { mode: 'fixedDouble', label: 'Fixed 2-Digit' },
  { mode: 'fixedColor', label: 'Fixed Color' },
  { mode: 'label', label: 'Label' },
]

interface ToolbarProps {
  inputMode: InputMode
  onInputModeChange: (mode: InputMode) => void
  onColorSelect?: (colorIndex: string) => void
  onColorErase?: () => void
  activeColor?: string | null
  onActiveColorChange?: (color: string | null) => void
  onLabelApply?: (text: string, align: LabelAlign) => void
  onLabelRemove?: () => void
  onUndo: () => void
  onRedo: () => void
  onErase: () => void
  isEditor?: boolean
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  imageLibrary?: string[]
  selectedImageIndex?: number | null
  onImageSelect?: (index: number | null) => void
  onImageApply?: () => void
  onImageRemove?: () => void
  onImageImport?: () => void
  activeMark?: MarkShape | null
  onActiveMarkChange?: (mark: MarkShape | null) => void
  onMarkSelect?: (shape: MarkShape) => void
  onMarkErase?: () => void
  onSubmit?: () => void
  forcedInputLayout?: string
}

export function Toolbar({
  inputMode,
  onInputModeChange,
  onColorSelect,
  onColorErase,
  activeColor = null,
  onActiveColorChange,
  onLabelApply,
  onLabelRemove,
  onUndo,
  onRedo,
  onErase,
  isEditor = false,
  theme,
  onThemeToggle,
  imageLibrary = [],
  selectedImageIndex = null,
  onImageSelect,
  onImageApply,
  onImageRemove,
  onImageImport,
  activeMark = null,
  onActiveMarkChange,
  onMarkSelect,
  onMarkErase,
  onSubmit,
  forcedInputLayout,
}: ToolbarProps) {
  const showPalette = inputMode === 'color' || inputMode === 'fixedColor'
  const showLabel = inputMode === 'label'

  const [labelText, setLabelText] = useState('')
  const [labelAlign, setLabelAlign] = useState<LabelAlign>('top')

  const renderModeBtn = (m: { mode: InputMode; label: string }) => (
    <button
      key={m.mode}
      className={`tb-btn ${inputMode === m.mode ? 'selected' : ''}`}
      onClick={() => onInputModeChange(inputMode === m.mode ? 'normal' : m.mode)}
    >
      {m.label}
    </button>
  )

  return (
    <div className="toolbar">
      {!forcedInputLayout && (
      <div className="tb-section">
        <div className="tb-section-title">Input Mode</div>
        {PLAYER_MODES.map(renderModeBtn)}
      </div>
      )}

      <div className="tb-section">
        <div className="tb-section-title">Actions</div>
        <button className="tb-btn" onClick={onErase} title="Delete/Backspace">Erase (Del)</button>
        <button className="tb-btn" onClick={onUndo} title="Ctrl+Z">Undo (Ctrl+Z)</button>
        <button className="tb-btn" onClick={onRedo} title="Ctrl+Y">Redo (Ctrl+Y)</button>
      </div>

      {showPalette && !forcedInputLayout && (
        <div className="tb-section">
          <div className="tb-section-title">Colors</div>
          <div className="tb-palette">
            <button
              className={`palette-swatch color-erase ${activeColor === '0' ? 'active-color' : ''}`}
              onClick={() => {
                if (activeColor === '0') {
                  onActiveColorChange?.(null)
                } else {
                  onActiveColorChange?.('0')
                  onColorErase?.()
                }
              }}
              title={`No color (erase)${activeColor === '0' ? ' — drag to erase' : ''}`}
            >
              &#x2715;
            </button>
            {Array.from({ length: 9 }, (_, i) => i + 1).map(i => (
              <button
                key={i}
                className={`palette-swatch color${i} ${activeColor === String(i) ? 'active-color' : ''}`}
                onClick={() => {
                  const c = String(i)
                  if (activeColor === c) {
                    onActiveColorChange?.(null)
                  } else {
                    onActiveColorChange?.(c)
                    onColorSelect?.(c)
                  }
                }}
                title={`Color ${i}${activeColor === String(i) ? ' (active — drag to paint)' : ''}`}
              >
                {i}
              </button>
            ))}
          </div>
          {activeColor !== null && (
            <button className="tb-btn" onClick={() => onActiveColorChange?.(null)}>Deselect Color</button>
          )}
        </div>
      )}

      {inputMode === 'mark' && !forcedInputLayout && (
        <div className="tb-section">
          <div className="tb-section-title">Shape</div>
          <div className="tb-mark-palette">
            <button
              className={`mark-swatch mark-erase ${activeMark === null ? 'active-mark' : ''}`}
              onClick={() => {
                onMarkErase?.()
                onActiveMarkChange?.(null)
              }}
              title="Erase mark"
            >
              &#x2715;
            </button>
            {MARK_SHAPES.map(shape => (
              <button
                key={shape}
                className={`mark-swatch ${activeMark === shape ? 'active-mark' : ''}`}
                onClick={() => {
                  if (activeMark === shape) {
                    onActiveMarkChange?.(null)
                  } else {
                    onActiveMarkChange?.(shape)
                    onMarkSelect?.(shape)
                  }
                }}
                title={shape}
              >
                {MARK_LABELS[shape]}
              </button>
            ))}
          </div>
          {activeMark !== null && (
            <button className="tb-btn" onClick={() => onActiveMarkChange?.(null)}>Deselect Shape</button>
          )}
        </div>
      )}

      {isEditor && (
        <div className="tb-section">
          <div className="tb-section-title">Editor</div>
          {EDITOR_MODES.map(renderModeBtn)}
        </div>
      )}

      {isEditor && (
        <div className="tb-section">
          <div className="tb-section-title">Images</div>
          {imageLibrary.length > 0 && (
            <div className="tb-image-grid">
              {imageLibrary.map((img, i) => (
                <button
                  key={i}
                  className={`tb-image-thumb ${selectedImageIndex === i ? 'selected' : ''}`}
                  onClick={() => onImageSelect?.(selectedImageIndex === i ? null : i)}
                  title={`Image ${i + 1}`}
                >
                  <img src={img} alt="" draggable={false} />
                </button>
              ))}
            </div>
          )}
          <button className="tb-btn" onClick={onImageImport}>Import Image</button>
          {selectedImageIndex !== null && (
            <button className="tb-btn" onClick={onImageApply}>Apply to Cells</button>
          )}
          <button className="tb-btn" onClick={onImageRemove}>Remove Image</button>
        </div>
      )}

      {showLabel && (
        <div className="tb-section">
          <div className="tb-section-title">Label</div>
          <input
            className="tb-input"
            value={labelText}
            onChange={e => setLabelText(e.target.value)}
            placeholder="Label text..."
          />
          <div className="tb-row">
            <button
              className={`tb-btn-sm ${labelAlign === 'top' ? 'selected' : ''}`}
              onClick={() => setLabelAlign('top')}
            >
              Top
            </button>
            <button
              className={`tb-btn-sm ${labelAlign === 'bottom' ? 'selected' : ''}`}
              onClick={() => setLabelAlign('bottom')}
            >
              Bottom
            </button>
          </div>
          <button
            className="tb-btn"
            onClick={() => {
              if (labelText.trim()) onLabelApply?.(labelText.trim(), labelAlign)
            }}
          >
            Apply
          </button>
          <button className="tb-btn" onClick={() => onLabelRemove?.()}>
            Remove
          </button>
        </div>
      )}

      <div className="tb-hint">
        {inputMode === 'fixed' && 'Type any key for fixed clue.'}
        {inputMode === 'fixedDouble' && 'Type two digits for a 2-digit fixed clue.'}
        {inputMode === 'fixedColor' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {inputMode === 'label' && 'Enter text, pick alignment, Apply.'}
        {forcedInputLayout && inputMode !== 'fixed' && inputMode !== 'fixedDouble' && inputMode !== 'fixedColor' && inputMode !== 'label' && (<><div>Left-click: black &rarr; dot &rarr; clear</div><div>Right-click: toggle dot</div></>)}
        {!forcedInputLayout && inputMode === 'normal' && 'Type any key to set value. Same key to remove.'}
        {!forcedInputLayout && inputMode === 'color' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {!forcedInputLayout && inputMode === 'note' && 'Type to add/remove notes (max 16).'}
        {!forcedInputLayout && inputMode === 'cross' && 'Click/drag to toggle X marks.'}
        {!forcedInputLayout && inputMode === 'border' && 'Drag to create/remove borders.'}
        {!forcedInputLayout && inputMode === 'mark' && (activeMark !== null ? 'Drag to paint mark. Click swatch again to deselect.' : 'Press 1-6 or click swatch to select shape.')}
      </div>

      <div className="tb-spacer" />
      {onSubmit && (
        <div className="tb-submit">
          <button className="tb-submit-btn" onClick={onSubmit}>Submit</button>
        </div>
      )}
      <div className="tb-theme-toggle">
        <button className="tb-btn" onClick={onThemeToggle} title="Toggle theme">
          {theme === 'light' ? '\u263E Dark' : '\u2600 Light'}
        </button>
      </div>
    </div>
  )
}
