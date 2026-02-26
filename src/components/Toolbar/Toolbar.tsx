import { useState } from 'react'
import { InputMode, LabelAlign } from '../../types'
import './Toolbar.css'

const PLAYER_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'note', label: 'Note (Shift+Key)' },
  { mode: 'color', label: 'Color' },
  { mode: 'cross', label: 'X Cross' },
  { mode: 'border', label: 'Border' },
]

const EDITOR_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'fixed', label: 'Fixed Normal' },
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
}: ToolbarProps) {
  const showPalette = inputMode === 'color' || inputMode === 'fixedColor'
  const showLabel = inputMode === 'label'

  const [labelText, setLabelText] = useState('')
  const [labelAlign, setLabelAlign] = useState<LabelAlign>('top')

  const renderModeBtn = (m: { mode: InputMode; label: string }) => (
    <button
      key={m.mode}
      className={`tb-btn ${inputMode === m.mode ? 'selected' : ''}`}
      onClick={() => onInputModeChange(m.mode)}
    >
      {m.label}
    </button>
  )

  return (
    <div className="toolbar">
      <div className="tb-section">
        <div className="tb-section-title">Input Mode</div>
        {PLAYER_MODES.map(renderModeBtn)}
      </div>

      <div className="tb-section">
        <div className="tb-section-title">Actions</div>
        <button className="tb-btn" onClick={onErase} title="Delete/Backspace">Erase (Del)</button>
        <button className="tb-btn" onClick={onUndo} title="Ctrl+Z">Undo (Ctrl+Z)</button>
      </div>

      {showPalette && (
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
        {inputMode === 'normal' && 'Type any key to set value. Same key to remove.'}
        {inputMode === 'color' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {inputMode === 'fixed' && 'Type any key for fixed clue.'}
        {inputMode === 'fixedColor' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {inputMode === 'label' && 'Enter text, pick alignment, Apply.'}
        {inputMode === 'note' && 'Type to add/remove notes (max 16).'}
        {inputMode === 'cross' && 'Click/drag to toggle X marks.'}
        {inputMode === 'border' && 'Drag to create/remove borders.'}
      </div>

      <div className="tb-spacer" />
      <div className="tb-theme-toggle">
        <button className="tb-btn" onClick={onThemeToggle} title="Toggle theme">
          {theme === 'light' ? '\u263E Dark' : '\u2600 Light'}
        </button>
      </div>
    </div>
  )
}
