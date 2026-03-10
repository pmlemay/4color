import { useState } from 'react'
import { InputMode, LabelAlign, MarkShape, CellPosition, FogGroup, FogTrigger } from '../../types'
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
  onLabelApply?: (align: LabelAlign, text: string, showThroughFog?: boolean, revealWithFog?: string) => void
  onLabelRemove?: (align: LabelAlign) => void
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
  fogGroups?: FogGroup[]
  fogEditStep?: 'idle' | 'pickFogCells' | 'pickTriggerCells' | 'pickTrigger'
  fogPendingTriggers?: FogTrigger[]
  fogPendingCellCount?: number
  fogPendingTriggerCells?: CellPosition[]
  fogEditingGroupId?: string | null
  selectionCount?: number
  onFogGroupAdd?: () => void
  onFogGroupDelete?: (id: string) => void
  onFogGroupSelect?: (id: string) => void
  onFogGroupEdit?: (id: string) => void
  onFogConfirmCells?: () => void
  onFogSelectTriggerCells?: () => void
  onFogConfirmTriggerCells?: () => void
  onFogAddTrigger?: (trigger: FogTrigger) => void
  onFogRemoveTrigger?: (index: number) => void
  onFogHighlightTrigger?: (trigger: FogTrigger) => void
  onFogEditTrigger?: (index: number) => void
  onFogTriggerMatchModeChange?: (index: number, mode: 'all' | 'any') => void
  onFogTriggerNegateChange?: (index: number, negate: boolean) => void
  onFogTriggerGroupModeChange?: (mode: 'all' | 'any') => void
  fogPendingTriggerMode?: 'all' | 'any'
  onFogFinishGroup?: () => void
  onFogReSelectFogCells?: () => void
  onFogCancel?: () => void
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
  fogGroups,
  fogEditStep,
  fogPendingTriggers,
  fogPendingCellCount,
  fogPendingTriggerCells,
  fogEditingGroupId,
  selectionCount,
  onFogGroupAdd,
  onFogGroupDelete,
  onFogGroupSelect,
  onFogGroupEdit,
  onFogConfirmCells,
  onFogSelectTriggerCells,
  onFogConfirmTriggerCells,
  onFogAddTrigger,
  onFogRemoveTrigger,
  onFogHighlightTrigger,
  onFogEditTrigger,
  onFogTriggerMatchModeChange,
  onFogTriggerNegateChange,
  onFogTriggerGroupModeChange,
  fogPendingTriggerMode,
  onFogFinishGroup,
  onFogReSelectFogCells,
  onFogCancel,
}: ToolbarProps) {
  const showPalette = inputMode === 'color' || inputMode === 'fixedColor'
  const showLabel = inputMode === 'label'

  const [labelText, setLabelText] = useState('')
  const [labelAlign, setLabelAlign] = useState<LabelAlign>('top')
  const [labelFogMode, setLabelFogMode] = useState<'hidden' | 'always' | string>('hidden') // 'hidden' | 'always' | fog group id

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
                      className={`tb-btn-sm ${labelAlign === 'middle' ? 'selected' : ''}`}
                      onClick={() => setLabelAlign('middle')}
                    >
                      Middle
                    </button>
                    <button
                      className={`tb-btn-sm ${labelAlign === 'bottom' ? 'selected' : ''}`}
                      onClick={() => setLabelAlign('bottom')}
                    >
                      Bottom
                    </button>
                  </div>
                  {fogGroups && fogGroups.length > 0 && (
                    <label className="tb-row" style={{ fontSize: '0.85em', gap: 4, flexDirection: 'column', alignItems: 'flex-start' }}>
                      Fog visibility
                      <select
                        style={{ width: '100%', fontSize: 12 }}
                        value={labelFogMode}
                        onChange={e => setLabelFogMode(e.target.value)}
                      >
                        <option value="hidden">Hidden under fog</option>
                        <option value="always">Always show through fog</option>
                        {fogGroups.map((g, i) => (
                          <option key={g.id} value={g.id}>Reveal with Group {i + 1}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    className="tb-btn"
                    onClick={() => {
                      if (labelText.trim()) {
                        const showThrough = labelFogMode === 'always' ? true : undefined
                        const revealWith = labelFogMode !== 'hidden' && labelFogMode !== 'always' ? labelFogMode : undefined
                        onLabelApply?.(labelAlign, labelText.trim(), showThrough, revealWith)
                      }
                    }}
                  >
                    Apply
                  </button>
                  <button className="tb-btn" onClick={() => onLabelRemove?.(labelAlign)}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditor && fogGroups !== undefined && (
        <FogSection
          fogGroups={fogGroups}
          fogEditStep={fogEditStep || 'idle'}
          fogPendingTriggers={fogPendingTriggers || []}
          fogPendingCellCount={fogPendingCellCount || 0}
          fogPendingTriggerCells={fogPendingTriggerCells || []}
          fogEditingGroupId={fogEditingGroupId ?? null}
          selectionCount={selectionCount || 0}
          onFogGroupAdd={onFogGroupAdd}
          onFogGroupDelete={onFogGroupDelete}
          onFogGroupSelect={onFogGroupSelect}
          onFogGroupEdit={onFogGroupEdit}
          onFogConfirmCells={onFogConfirmCells}
          onFogSelectTriggerCells={onFogSelectTriggerCells}
          onFogConfirmTriggerCells={onFogConfirmTriggerCells}
          onFogAddTrigger={onFogAddTrigger}
          onFogRemoveTrigger={onFogRemoveTrigger}
          onFogHighlightTrigger={onFogHighlightTrigger}
          onFogEditTrigger={onFogEditTrigger}
          onFogTriggerMatchModeChange={onFogTriggerMatchModeChange}
          onFogTriggerNegateChange={onFogTriggerNegateChange}
          onFogTriggerGroupModeChange={onFogTriggerGroupModeChange}
          fogPendingTriggerMode={fogPendingTriggerMode}
          onFogFinishGroup={onFogFinishGroup}
          onFogReSelectFogCells={onFogReSelectFogCells}
          onFogCancel={onFogCancel}
        />
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

const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'color:0', label: 'Color: Gray' },
  { value: 'color:1', label: 'Color: Red' },
  { value: 'color:2', label: 'Color: Pink' },
  { value: 'color:3', label: 'Color: Orange' },
  { value: 'color:4', label: 'Color: Yellow' },
  { value: 'color:5', label: 'Color: Green' },
  { value: 'color:6', label: 'Color: Cyan' },
  { value: 'color:7', label: 'Color: Blue' },
  { value: 'color:8', label: 'Color: Purple' },
  { value: 'color:9', label: 'Color: Black' },
  { value: 'mark:circle', label: 'Mark: Circle' },
  { value: 'mark:square', label: 'Mark: Square' },
  { value: 'mark:triangle', label: 'Mark: Triangle' },
  { value: 'mark:diamond', label: 'Mark: Diamond' },
  { value: 'mark:pentagon', label: 'Mark: Pentagon' },
  { value: 'mark:hexagon', label: 'Mark: Hexagon' },
  { value: 'mark:star', label: 'Mark: Star' },
  { value: 'mark:dot', label: 'Mark: Dot' },
  { value: 'cross', label: 'Cross' },
]

function FogSection({
  fogGroups, fogEditStep, fogPendingTriggers, fogPendingCellCount, fogPendingTriggerCells, fogEditingGroupId, selectionCount,
  fogPendingTriggerMode,
  onFogGroupAdd, onFogGroupDelete, onFogGroupSelect, onFogGroupEdit, onFogConfirmCells,
  onFogSelectTriggerCells, onFogConfirmTriggerCells,
  onFogAddTrigger, onFogRemoveTrigger, onFogHighlightTrigger, onFogEditTrigger, onFogTriggerMatchModeChange, onFogTriggerNegateChange, onFogTriggerGroupModeChange, onFogFinishGroup, onFogReSelectFogCells, onFogCancel,
}: {
  fogGroups: FogGroup[]
  fogEditStep: 'idle' | 'pickFogCells' | 'pickTriggerCells' | 'pickTrigger'
  fogPendingTriggers: FogTrigger[]
  fogPendingCellCount: number
  fogPendingTriggerCells: CellPosition[]
  fogEditingGroupId: string | null
  selectionCount: number
  fogPendingTriggerMode?: 'all' | 'any'
  onFogGroupAdd?: () => void
  onFogGroupDelete?: (id: string) => void
  onFogGroupSelect?: (id: string) => void
  onFogGroupEdit?: (id: string) => void
  onFogConfirmCells?: () => void
  onFogSelectTriggerCells?: () => void
  onFogConfirmTriggerCells?: () => void
  onFogAddTrigger?: (trigger: FogTrigger) => void
  onFogRemoveTrigger?: (index: number) => void
  onFogHighlightTrigger?: (trigger: FogTrigger) => void
  onFogEditTrigger?: (index: number) => void
  onFogTriggerMatchModeChange?: (index: number, mode: 'all' | 'any') => void
  onFogTriggerNegateChange?: (index: number, negate: boolean) => void
  onFogTriggerGroupModeChange?: (mode: 'all' | 'any') => void
  onFogFinishGroup?: () => void
  onFogReSelectFogCells?: () => void
  onFogCancel?: () => void
}) {
  const [triggerCondition, setTriggerCondition] = useState('value')
  const [triggerValueText, setTriggerValueText] = useState('')

  return (
    <div className="tb-section">
      <div className="tb-section-title">Fog of War</div>

      {fogEditStep === 'idle' && (
        <>
          {fogGroups.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginBottom: 2 }}>
              <span
                style={{ flex: 1, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => onFogGroupSelect?.(g.id)}
                title="Click to highlight cells"
              >
                Group {i + 1}: {g.cells.length} cells, {g.triggers.length} trigger{g.triggers.length !== 1 ? 's' : ''}
              </span>
              <button
                className="tb-btn-sm"
                onClick={() => onFogGroupEdit?.(g.id)}
                title="Edit group"
                style={{ padding: '0 4px', fontSize: 11, lineHeight: 1 }}
              >
                Edit
              </button>
              <button
                className="tb-btn-sm"
                onClick={() => onFogGroupDelete?.(g.id)}
                title="Delete group"
                style={{ padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>
          ))}
          <button className="tb-btn" onClick={onFogGroupAdd}>Add Fog Group</button>
        </>
      )}

      {fogEditStep === 'pickFogCells' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Select cells to fog, then confirm.
          </div>
          <button
            className="tb-btn"
            onClick={onFogConfirmCells}
            disabled={selectionCount === 0}
          >
            Confirm Cells ({selectionCount} selected)
          </button>
          <button className="tb-btn" onClick={onFogCancel}>Cancel</button>
        </>
      )}

      {fogEditStep === 'pickTriggerCells' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Select trigger cells (any match satisfies the trigger).
          </div>
          <button
            className="tb-btn"
            onClick={onFogConfirmTriggerCells}
            disabled={selectionCount === 0}
          >
            Confirm Trigger Cells ({selectionCount} selected)
          </button>
          <button className="tb-btn" onClick={onFogCancel}>Back</button>
        </>
      )}

      {fogEditStep === 'pickTrigger' && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            {fogPendingCellCount} fog cells{fogEditingGroupId ? ' (editing)' : ''}. Add trigger conditions.
          </div>

          <button className="tb-btn" onClick={onFogReSelectFogCells} style={{ marginBottom: 4 }}>
            Re-select Fog Cells
          </button>

          <button
            className="tb-btn"
            onClick={onFogSelectTriggerCells}
            style={{ marginBottom: 4 }}
          >
            {fogPendingTriggerCells.length > 0
              ? `Trigger Cells Selected (${fogPendingTriggerCells.length})`
              : 'Select Trigger Cells'}
          </button>

          {fogPendingTriggerCells.length > 0 && (
            <>
              <select
                style={{ width: '100%', fontSize: 12, marginBottom: 4 }}
                value={triggerCondition}
                onChange={e => setTriggerCondition(e.target.value)}
              >
                {CONDITION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {triggerCondition === 'value' && (
                <input
                  type="text"
                  style={{ width: '100%', fontSize: 12, marginBottom: 4, boxSizing: 'border-box' }}
                  value={triggerValueText}
                  onChange={e => setTriggerValueText(e.target.value)}
                  placeholder="Enter value..."
                />
              )}

              <button
                className="tb-btn"
                onClick={() => {
                  if (fogPendingTriggerCells.length === 0) return
                  const condition = triggerCondition === 'value'
                    ? `value:${triggerValueText}`
                    : triggerCondition
                  if (triggerCondition === 'value' && !triggerValueText.trim()) return
                  onFogAddTrigger?.({ cells: [...fogPendingTriggerCells], condition })
                  setTriggerValueText('')
                }}
                disabled={triggerCondition === 'value' && !triggerValueText.trim()}
              >
                Add Trigger
              </button>
            </>
          )}

          {fogPendingTriggers.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                Reveal when
                <select
                  style={{ fontSize: 11, padding: '0 2px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}
                  value={fogPendingTriggerMode || 'all'}
                  onChange={e => onFogTriggerGroupModeChange?.(e.target.value as 'all' | 'any')}
                  title="Trigger group mode"
                >
                  <option value="all">all of</option>
                  <option value="any">any of</option>
                </select>
                :
              </div>
              {fogPendingTriggers.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 1 }}>
                  <select
                    style={{ fontSize: 11, padding: '0 2px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer' }}
                    value={`${t.negate ? 'not-' : ''}${t.matchMode || 'any'}`}
                    onChange={e => {
                      const v = e.target.value
                      const neg = v.startsWith('not-')
                      const mode = v.replace('not-', '') as 'all' | 'any'
                      onFogTriggerMatchModeChange?.(i, mode)
                      onFogTriggerNegateChange?.(i, neg)
                    }}
                    title="Match mode"
                  >
                    <option value="all">all of</option>
                    <option value="any">any of</option>
                    <option value="not-all">NOT all of</option>
                    <option value="not-any">NOT any of</option>
                  </select>
                  <span
                    style={{ flex: 1, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => onFogHighlightTrigger?.(t)}
                    title="Click to highlight trigger cells"
                  >
                    {t.cells.length} cell{t.cells.length !== 1 ? 's' : ''} &mdash; {t.condition}
                  </span>
                  <button
                    style={{ padding: '0 3px', fontSize: 11, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)' }}
                    onClick={() => onFogEditTrigger?.(i)}
                    title="Edit trigger cells"
                  >
                    Edit
                  </button>
                  <button
                    style={{ padding: '0 3px', fontSize: 12, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)' }}
                    onClick={() => onFogRemoveTrigger?.(i)}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              className="tb-btn"
              onClick={onFogFinishGroup}
              style={{ flex: 1 }}
            >
              {fogEditingGroupId ? 'Update Group' : 'Finish Group'}
            </button>
            <button className="tb-btn" onClick={onFogCancel} style={{ flex: 1 }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
