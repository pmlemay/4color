import React from 'react'
import { CellData, MarkShape } from '../../types'

const SHAPE_PATHS: Record<MarkShape, string> = {
  circle:   'M25,8 a17,17 0 1,0 0.001,0 Z',
  square:   'M8,8 h34 v34 h-34 Z',
  triangle: 'M25,6 L44,42 L6,42 Z',
  diamond:  'M25,6 L44,25 L25,44 L6,25 Z',
  pentagon: 'M25,6 L43,20 L36,42 L14,42 L7,20 Z',
  hexagon:  'M25,6 L41,15.5 L41,34.5 L25,44 L9,34.5 L9,15.5 Z',
  star:     'M25,4 L30.5,18.5 L46,18.5 L33.5,28 L38,43 L25,33.5 L12,43 L16.5,28 L4,18.5 L19.5,18.5 Z',
  dot:      'M25,25 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 Z',
}

const FILLED_MARKS: Set<MarkShape> = new Set(['dot', 'star'])

interface CellProps {
  data: CellData
  beingSelected: boolean
  beingDeselected?: boolean
  debug: boolean
  row: number
  col: number
  draftEdgeSides?: Set<number> | null
  fogged?: boolean
  fogEdges?: [boolean, boolean, boolean, boolean] // top, right, bottom, left neighbors are fogged
  fogPreview?: boolean
  revealedFogIds?: Set<string>
}

export const Cell = React.memo(function Cell({ data, beingSelected, beingDeselected, debug, row, col, draftEdgeSides, fogged, fogEdges, fogPreview, revealedFogIds }: CellProps) {
  const { selected, value, notes, fixedValue, fixedColor, color, borders, fixedBorders, labels, crossed, mark, fixedMark, fixedEdgeMarks, fixedVertexMarks, edgeCrosses, lines, image } = data

  const hasLines = lines[0] || lines[1] || lines[2] || lines[3]
  let tdClass = 'grid-cell cell-enabled'
  if (selected && !beingDeselected) tdClass += ' cell-selected'
  if (beingSelected) tdClass += ' cell-being-selected'
  if (fogged) tdClass += ' cell-fogged'
  if (hasLines) tdClass += ' cell-has-lines'

  let divClass = 'cell-inner'
  if (!fogged) {
    if (fixedColor) divClass += ` color${fixedColor}`
    else if (color) divClass += ` color${color}`
  }
  if (fixedValue) divClass += ' cell-fixed-value'

  // Border thickness: fixed=3px, user=2px
  const borderWidth = (i: number) =>
    borders[i] > 0 ? (fixedBorders[i] > 0 ? 3 : 2) : 0

  const bTop = borderWidth(0)
  const bRight = borderWidth(1)
  const bBottom = borderWidth(2)
  const bLeft = borderWidth(3)
  const hasBorders = bTop > 0 || bRight > 0 || bBottom > 0 || bLeft > 0

  const displayValue = fixedValue || value || ''
  const hasNotes = notes.length > 0

  return (
    <td className={tdClass}>
      <div className={divClass}>
        {image && <img src={image} className="cell-image" alt="" draggable={false} />}
        {crossed && <span className="cell-cross">&times;</span>}
        {mark && (
          <span className="cell-mark" aria-hidden="true">
            <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
              <path d={SHAPE_PATHS[mark]} fill={FILLED_MARKS.has(mark) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
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
        {labels.top?.text && (!labels.top.revealWithFog || !revealedFogIds || revealedFogIds.has(labels.top.revealWithFog)) && <span className="cell-label cell-label-top">{labels.top.text}</span>}
        {labels.middle?.text && (!labels.middle.revealWithFog || !revealedFogIds || revealedFogIds.has(labels.middle.revealWithFog)) && <span className="cell-label cell-label-middle">{labels.middle.text}</span>}
        {labels.bottom?.text && (!labels.bottom.revealWithFog || !revealedFogIds || revealedFogIds.has(labels.bottom.revealWithFog)) && <span className="cell-label cell-label-bottom">{labels.bottom.text}</span>}
        {debug && (
          <span className="debug-overlay">{row},{col}</span>
        )}
      </div>
      {!fogged && hasBorders && (
        <>
          {bTop > 0 && <div className="cell-border cell-border-top" style={{ height: `${bTop}px` }} />}
          {bRight > 0 && <div className="cell-border cell-border-right" style={{ width: `${bRight}px` }} />}
          {bBottom > 0 && <div className="cell-border cell-border-bottom" style={{ height: `${bBottom}px` }} />}
          {bLeft > 0 && <div className="cell-border cell-border-left" style={{ width: `${bLeft}px` }} />}
        </>
      )}
      {!fogged && draftEdgeSides && draftEdgeSides.has(0) && <div className="edge-draft edge-draft-top" />}
      {!fogged && draftEdgeSides && draftEdgeSides.has(1) && <div className="edge-draft edge-draft-right" />}
      {!fogged && draftEdgeSides && draftEdgeSides.has(2) && <div className="edge-draft edge-draft-bottom" />}
      {!fogged && draftEdgeSides && draftEdgeSides.has(3) && <div className="edge-draft edge-draft-left" />}
      {!fogged && lines[0] && <div className="cell-line cell-line-top" />}
      {!fogged && lines[1] && <div className="cell-line cell-line-right" />}
      {!fogged && lines[2] && <div className="cell-line cell-line-bottom" />}
      {!fogged && lines[3] && <div className="cell-line cell-line-left" />}
      {!fogged && edgeCrosses[0] && row === 0 && <span className="edge-x edge-x-top">&times;</span>}
      {!fogged && edgeCrosses[1] && <span className="edge-x edge-x-right">&times;</span>}
      {!fogged && edgeCrosses[2] && <span className="edge-x edge-x-bottom">&times;</span>}
      {!fogged && edgeCrosses[3] && col === 0 && <span className="edge-x edge-x-left">&times;</span>}
      {!fogged && fixedMark && (
        <span className="fixed-mark fixed-mark-center" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedMark]} fill={FILLED_MARKS.has(fixedMark) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedEdgeMarks[0] && (
        <span className="fixed-mark fixed-mark-edge-top" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedEdgeMarks[0]]} fill={FILLED_MARKS.has(fixedEdgeMarks[0]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedEdgeMarks[1] && (
        <span className="fixed-mark fixed-mark-edge-right" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedEdgeMarks[1]]} fill={FILLED_MARKS.has(fixedEdgeMarks[1]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedEdgeMarks[2] && (
        <span className="fixed-mark fixed-mark-edge-bottom" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedEdgeMarks[2]]} fill={FILLED_MARKS.has(fixedEdgeMarks[2]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedEdgeMarks[3] && (
        <span className="fixed-mark fixed-mark-edge-left" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedEdgeMarks[3]]} fill={FILLED_MARKS.has(fixedEdgeMarks[3]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedVertexMarks[0] && (
        <span className="fixed-mark fixed-mark-vertex-tl" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedVertexMarks[0]]} fill={FILLED_MARKS.has(fixedVertexMarks[0]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedVertexMarks[1] && (
        <span className="fixed-mark fixed-mark-vertex-tr" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedVertexMarks[1]]} fill={FILLED_MARKS.has(fixedVertexMarks[1]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedVertexMarks[2] && (
        <span className="fixed-mark fixed-mark-vertex-br" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedVertexMarks[2]]} fill={FILLED_MARKS.has(fixedVertexMarks[2]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {!fogged && fixedVertexMarks[3] && (
        <span className="fixed-mark fixed-mark-vertex-bl" aria-hidden="true">
          <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <path d={SHAPE_PATHS[fixedVertexMarks[3]]} fill={FILLED_MARKS.has(fixedVertexMarks[3]!) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </span>
      )}
      {fogged && <div className="cell-fog-overlay" style={fogEdges ? {
        top: fogEdges[0] ? -1 : 0,
        right: fogEdges[1] ? -1 : 0,
        bottom: fogEdges[2] ? -1 : 0,
        left: fogEdges[3] ? -1 : 0,
      } : undefined} />}
      {fogPreview && <div className="cell-fog-preview" />}
      {(fogged || fogPreview) && (['top', 'middle', 'bottom'] as const).map(pos => {
        const lbl = labels[pos]
        if (!lbl?.text) return null
        const revealed = lbl.revealWithFog ? (revealedFogIds?.has(lbl.revealWithFog) ?? false) : false
        if (!lbl.showThroughFog && !revealed) return null
        return <span key={pos} className={`cell-label cell-label-${pos} cell-label-over-fog`}>{lbl.text}</span>
      })}
    </td>
  )
})
