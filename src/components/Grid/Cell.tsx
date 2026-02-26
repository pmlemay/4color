import React from 'react'
import { CellData } from '../../types'

interface CellProps {
  data: CellData
  beingSelected: boolean
  debug: boolean
  row: number
  col: number
}

export const Cell = React.memo(function Cell({ data, beingSelected, debug, row, col }: CellProps) {
  const { selected, value, notes, fixedValue, fixedColor, color, borders, label, crossed, image } = data

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
        {hasNotes && !displayValue && !crossed ? (
          <div className="notes-grid">
            {notes.map((n, i) => (
              <span key={i} className="note-item">{n}</span>
            ))}
          </div>
        ) : (
          !crossed && displayValue
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
