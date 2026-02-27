import React from 'react'
import { CellData, MarkShape } from '../../types'

const SHAPE_PATHS: Record<MarkShape, string> = {
  circle:   'M25,8 a17,17 0 1,0 0.001,0 Z',
  square:   'M8,8 h34 v34 h-34 Z',
  triangle: 'M25,6 L44,42 L6,42 Z',
  diamond:  'M25,6 L44,25 L25,44 L6,25 Z',
  pentagon: 'M25,6 L43,20 L36,42 L14,42 L7,20 Z',
  hexagon:  'M25,6 L41,15.5 L41,34.5 L25,44 L9,34.5 L9,15.5 Z',
  dot:      'M25,25 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 Z',
}

interface CellProps {
  data: CellData
  beingSelected: boolean
  debug: boolean
  row: number
  col: number
}

export const Cell = React.memo(function Cell({ data, beingSelected, debug, row, col }: CellProps) {
  const { selected, value, notes, fixedValue, fixedColor, color, borders, label, crossed, mark, image } = data

  let tdClass = 'grid-cell cell-enabled'
  if (selected) tdClass += ' cell-selected'
  if (beingSelected) tdClass += ' cell-being-selected'

  let divClass = 'cell-inner'
  if (fixedColor) divClass += ` color${fixedColor}`
  else if (color) divClass += ` color${color}`
  if (fixedValue) divClass += ' cell-fixed-value'

  const cellStyle: React.CSSProperties = {
    borderTopWidth: `${borders[0]}px`,
    borderRightWidth: `${borders[1]}px`,
    borderBottomWidth: `${borders[2]}px`,
    borderLeftWidth: `${borders[3]}px`,
  }

  const displayValue = fixedValue || value || ''
  const hasNotes = notes.length > 0

  return (
    <td className={tdClass}>
      <div className={divClass} style={cellStyle}>
        {image && <img src={image} className="cell-image" alt="" draggable={false} />}
        {crossed && <span className="cell-cross">&times;</span>}
        {mark && (
          <span className="cell-mark" aria-hidden="true">
            <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
              <path d={SHAPE_PATHS[mark]} fill={mark === 'dot' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
            </svg>
          </span>
        )}
        {hasNotes && !displayValue && !crossed ? (
          <div className="notes-grid notranslate">
            {notes.map((n, i) => (
              <span key={i} className="note-item">{n}</span>
            ))}
          </div>
        ) : (
          !crossed && displayValue && <span className="cell-value notranslate">{displayValue}</span>
        )}
        {label && (
          <span className={`cell-label cell-label-${label.align}`}>
            {label.text}
          </span>
        )}
        {debug && (
          <span className="debug-overlay">{row},{col}</span>
        )}
      </div>
    </td>
  )
})
