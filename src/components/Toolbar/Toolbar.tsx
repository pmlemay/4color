import { useState } from 'react'
import { InputMode, LabelAlign, MarkShape } from '../../types'
import { IconBrowser } from './IconBrowser'
import './Toolbar.css'

const PLAYER_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'normal', label: 'Normal (N)' },
  { mode: 'note', label: 'Note (Shift+Key)' },
  { mode: 'color', label: 'Color (C)' },
  { mode: 'cross', label: 'X Cross (X)' },
  { mode: 'border', label: 'Border (B)' },
  { mode: 'edge', label: 'Edge (E)' },
  { mode: 'mark', label: 'Marks (M)' },
]

const MARK_SHAPES: MarkShape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'dot']
const MARK_LABELS: Record<MarkShape, string> = {
  circle: '\u25CB', square: '\u25A1', triangle: '\u25B3',
  diamond: '\u25C7', pentagon: '\u2B20', hexagon: '\u2B21',
  star: '\u2605', dot: '\u25CF',
}

const EDITOR_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'fixed', label: 'Fixed Normal (Ctrl+N)' },
  { mode: 'fixedDouble', label: 'Fixed 2-Digit (Ctrl+D)' },
  { mode: 'fixedColor', label: 'Fixed Color (Ctrl+Shift+C)' },
  { mode: 'fixedBorder', label: 'Fixed Border (Ctrl+B)' },
  { mode: 'fixedEdge', label: 'Fixed Edge (Ctrl+E)' },
  { mode: 'fixedMark', label: 'Fixed Mark (Ctrl+M)' },
  { mode: 'label', label: 'Label (Ctrl+L)' },
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
  onIconAdd?: (base64: string) => void
  onSubmit?: () => void
  puzzleType?: string
  clickActionLeft?: string
  clickActionRight?: string
  onClickActionLeftChange?: (action: string) => void
  onClickActionRightChange?: (action: string) => void
  puzzleHasClickActions?: boolean
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
  onIconAdd,
  onSubmit,
  puzzleType,
  clickActionLeft,
  clickActionRight,
  onClickActionLeftChange,
  onClickActionRightChange,
  puzzleHasClickActions = false,
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
      <div className="tb-hint tb-hint-sticky">
        {inputMode === 'fixed' && 'Type any key for fixed clue.'}
        {inputMode === 'fixedDouble' && 'Type two digits for a 2-digit fixed clue.'}
        {inputMode === 'fixedColor' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {inputMode === 'fixedMark' && (activeMark !== null ? 'Click cell center, edge, or corner to place/remove mark.' : 'Select a shape, then click cell center, edge, or corner.')}
        {inputMode === 'label' && 'Enter text, pick alignment, Apply.'}
        {inputMode === 'suggested' && puzzleType === 'nurikabe' && (<><div>Left-click: toggle black. Right-click: toggle dot</div><div>Touch: black &rarr; dot &rarr; clear</div></>)}
        {inputMode === 'suggested' && puzzleType === 'heyawake' && (<><div>Left-click: toggle black. Right-click: toggle green</div><div>Touch: black &rarr; green &rarr; clear</div></>)}
        {inputMode === 'suggested' && puzzleType === 'starbattle' && (<><div>Left-click: toggle star. Right-click: toggle X</div><div>Touch: star &rarr; X &rarr; clear</div></>)}
        {inputMode === 'suggested' && !puzzleType && (clickActionLeft ? 'Custom click actions configured.' : 'Select click actions below.')}
        {inputMode === 'normal' && 'Type any key to set value. Same key to remove.'}
        {inputMode === 'color' && (activeColor !== null ? 'Drag to paint. Click swatch again to deselect.' : 'Press 0-9 or click swatch. Click to lock color for drag painting.')}
        {inputMode === 'note' && 'Type to add/remove notes (max 16).'}
        {inputMode === 'cross' && 'Click/drag to toggle X marks.'}
        {inputMode === 'border' && 'Drag to create/remove borders.'}
        {inputMode === 'edge' && 'Click/drag edges to toggle individual borders.'}
        {inputMode === 'mark' && (activeMark !== null ? 'Drag to paint mark. Click swatch again to deselect.' : 'Press 1-6 or click swatch to select shape.')}
      </div>

      <div className="tb-section">
        <div className="tb-section-title">Input Mode</div>
        {renderModeBtn({ mode: 'suggested', label: puzzleHasClickActions ? 'Suggested (S)' : 'Custom (S)' })}
        {PLAYER_MODES.map(renderModeBtn)}
      </div>

      {inputMode === 'suggested' && !puzzleHasClickActions && (onClickActionLeftChange || onClickActionRightChange) && (
        <div className="tb-section">
          <div className="tb-section-title">Click Actions</div>
          <div className="tb-click-actions">
            <label className="tb-click-action-label">
              Left Click
              <select
                className="tb-click-action-select"
                value={clickActionLeft || ''}
                onChange={e => onClickActionLeftChange?.(e.target.value)}
              >
                <option value="">None</option>
                <optgroup label="Colors">
                  <option value="color:0">Gray</option>
                  <option value="color:1">Red</option>
                  <option value="color:2">Pink</option>
                  <option value="color:3">Orange</option>
                  <option value="color:4">Yellow</option>
                  <option value="color:5">Green</option>
                  <option value="color:6">Cyan</option>
                  <option value="color:7">Blue</option>
                  <option value="color:8">Purple</option>
                  <option value="color:9">Black</option>
                </optgroup>
                <optgroup label="Marks">
                  <option value="mark:circle">Circle</option>
                  <option value="mark:square">Square</option>
                  <option value="mark:triangle">Triangle</option>
                  <option value="mark:diamond">Diamond</option>
                  <option value="mark:pentagon">Pentagon</option>
                  <option value="mark:hexagon">Hexagon</option>
                  <option value="mark:star">Star</option>
                  <option value="mark:dot">Dot</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="cross">Cross</option>
                </optgroup>
              </select>
            </label>
            <label className="tb-click-action-label">
              Right Click
              <select
                className="tb-click-action-select"
                value={clickActionRight || ''}
                onChange={e => onClickActionRightChange?.(e.target.value)}
              >
                <option value="">None</option>
                <optgroup label="Colors">
                  <option value="color:0">Gray</option>
                  <option value="color:1">Red</option>
                  <option value="color:2">Pink</option>
                  <option value="color:3">Orange</option>
                  <option value="color:4">Yellow</option>
                  <option value="color:5">Green</option>
                  <option value="color:6">Cyan</option>
                  <option value="color:7">Blue</option>
                  <option value="color:8">Purple</option>
                  <option value="color:9">Black</option>
                </optgroup>
                <optgroup label="Marks">
                  <option value="mark:circle">Circle</option>
                  <option value="mark:square">Square</option>
                  <option value="mark:triangle">Triangle</option>
                  <option value="mark:diamond">Diamond</option>
                  <option value="mark:pentagon">Pentagon</option>
                  <option value="mark:hexagon">Hexagon</option>
                  <option value="mark:star">Star</option>
                  <option value="mark:dot">Dot</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="cross">Cross</option>
                </optgroup>
              </select>
            </label>
          </div>
        </div>
      )}

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

      {inputMode === 'mark' && (
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

      <div className="tb-section">
        <div className="tb-section-title">Actions</div>
        <button className="tb-btn" onClick={onErase} title="Delete/Backspace">Erase (Del)</button>
        <button className="tb-btn" onClick={onUndo} title="Ctrl+Z">Undo (Ctrl+Z)</button>
        <button className="tb-btn" onClick={onRedo} title="Ctrl+Y">Redo (Ctrl+Y)</button>
      </div>

      {inputMode === 'fixedMark' && (
        <div className="tb-section">
          <div className="tb-section-title">Shape</div>
          <div className="tb-mark-palette">
            {MARK_SHAPES.map(shape => (
              <button
                key={shape}
                className={`mark-swatch ${activeMark === shape ? 'active-mark' : ''}`}
                onClick={() => {
                  if (activeMark === shape) {
                    onActiveMarkChange?.(null)
                  } else {
                    onActiveMarkChange?.(shape)
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
          {EDITOR_MODES.map(m => (
            <div key={m.mode}>
              {renderModeBtn(m)}
              {m.mode === 'label' && showLabel && (
                <div className="tb-label-fields">
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
            </div>
          ))}
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

      {isEditor && onIconAdd && (
        <div className="tb-section">
          <div className="tb-section-title">Icon Library</div>
          <IconBrowser onIconAdd={onIconAdd} />
        </div>
      )}

      <div className="tb-spacer" />
      {onSubmit && (
        <div className="tb-submit">
          <button className="tb-submit-btn" onClick={onSubmit}>Submit</button>
        </div>
      )}
    </div>
  )
}
