import React from 'react'
import { CellData, MarkShape, CellTexture } from '../../types'
import { getTextureColors } from '../../utils/textures'

const SHAPE_PATHS: Record<MarkShape, string> = {
  circle:   'M25,8 a17,17 0 1,0 0.001,0 Z',
  square:   'M8,8 h34 v34 h-34 Z',
  triangle: 'M25,6 L44,42 L6,42 Z',
  diamond:  'M25,6 L44,25 L25,44 L6,25 Z',
  pentagon: 'M25,6 L43,20 L36,42 L14,42 L7,20 Z',
  hexagon:  'M25,6 L41,15.5 L41,34.5 L25,44 L9,34.5 L9,15.5 Z',
  star:     'M25,4 L30.5,18.5 L46,18.5 L33.5,28 L38,43 L25,33.5 L12,43 L16.5,28 L4,18.5 L19.5,18.5 Z',
  dot:      'M25,25 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0 Z',
  bigcircle:       'M25,4 a21,21 0 1,0 0.001,0 Z',
  bigcirclefilled: 'M25,4 a21,21 0 1,0 0.001,0 Z',
  dashV:    '', // rendered as custom SVG
  dashH:    '', // rendered as custom SVG
  arrowLeft:  '', // rendered as custom SVG
  arrowDown:  '', // rendered as custom SVG
  arrowRight: '', // rendered as custom SVG
  arrowUp:    '', // rendered as custom SVG
}

const FILLED_MARKS: Set<MarkShape> = new Set(['dot', 'star', 'bigcirclefilled'])

// Marks that render at edge positions instead of center
const EDGE_MARKS: Record<string, { position: React.CSSProperties; viewBox: string; width: string; height: string }> = {
  arrowLeft:  { position: { top: '6px', left: '50%', transform: 'translateX(-50%)' }, viewBox: '0 0 20 10', width: '28%', height: '18%' },
  arrowDown:  { position: { left: '6px', top: '50%', transform: 'translateY(-50%)' }, viewBox: '0 0 10 20', width: '18%', height: '28%' },
  arrowRight: { position: { bottom: '6px', left: '50%', transform: 'translateX(-50%)' }, viewBox: '0 0 20 10', width: '28%', height: '18%' },
  arrowUp:    { position: { right: '6px', top: '50%', transform: 'translateY(-50%)' }, viewBox: '0 0 10 20', width: '18%', height: '28%' },
}

function renderMarkSvg(shape: MarkShape, useEdgeSize = false) {
  if (shape === 'dashV') {
    return (
      <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <line x1="25" y1="0" x2="25" y2="50" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6,4" />
      </svg>
    )
  }
  if (shape === 'dashH') {
    return (
      <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <line x1="0" y1="25" x2="50" y2="25" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6,4" />
      </svg>
    )
  }
  if (EDGE_MARKS[shape]) {
    const edgeInfo = EDGE_MARKS[shape]
    // Line + chevron arrows matching ←↓→↑ unicode style
    const sw = 1.5
    const sizeStyle = useEdgeSize ? { width: edgeInfo.width, height: edgeInfo.height } : undefined
    const arrowSvgs: Record<string, React.ReactNode> = {
      arrowLeft: (
        <svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg" style={sizeStyle}>
          <line x1="18" y1="5" x2="3" y2="5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <polyline points="6,1.5 2,5 6,8.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      arrowRight: (
        <svg viewBox="0 0 20 10" xmlns="http://www.w3.org/2000/svg" style={sizeStyle}>
          <line x1="2" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <polyline points="14,1.5 18,5 14,8.5" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      arrowUp: (
        <svg viewBox="0 0 10 20" xmlns="http://www.w3.org/2000/svg" style={sizeStyle}>
          <line x1="5" y1="18" x2="5" y2="3" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <polyline points="1.5,6 5,2 8.5,6" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      arrowDown: (
        <svg viewBox="0 0 10 20" xmlns="http://www.w3.org/2000/svg" style={sizeStyle}>
          <line x1="5" y1="2" x2="5" y2="17" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <polyline points="1.5,14 5,18 8.5,14" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    }
    return arrowSvgs[shape] || null
  }
  const fullSize = shape === 'bigcircle' || shape === 'bigcirclefilled'
  return (
    <svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" style={fullSize ? { width: '100%', height: '100%' } : undefined}>
      <path d={SHAPE_PATHS[shape]} fill={FILLED_MARKS.has(shape) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}

/** dir 1 = ‹ (left-pointing), dir 2 = › (right-pointing). CSS rotates for top/bottom edges. */
function renderChevron(dir: number) {
  const points = dir === 1 ? '8,2 2,7 8,12' : '2,2 8,7 2,12'
  return (
    <svg viewBox="0 0 10 14" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <polyline points={points} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function textureBackground(tex: CellTexture): string {
  const c = getTextureColors(tex.type, tex.variant)
  switch (tex.type) {
    case 'water':
      // Wavy lines — flat at edges, curve only in the middle of the tile
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20'><rect width='40' height='20' fill='${c.bg}'/><path d='M0 7 C13 2,27 12,40 7' stroke='${c.fg}' fill='none' stroke-width='1.8' opacity='0.6'/><path d='M0 15 C13 10,27 20,40 15' stroke='${c.fg2}' fill='none' stroke-width='1.4' opacity='0.5'/></svg>`
      )}")`
    case 'bricks':
      // Brick pattern with mortar lines
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='12'><rect width='24' height='12' fill='${c.bg}'/><rect x='0' y='0' width='11' height='5' fill='${c.fg}' rx='0.5'/><rect x='13' y='0' width='11' height='5' fill='${c.fg2}' rx='0.5'/><rect x='6' y='7' width='11' height='5' fill='${c.fg}' rx='0.5'/><rect x='19' y='7' width='5' height='5' fill='${c.fg2}' rx='0.5'/><rect x='0' y='7' width='4' height='5' fill='${c.fg2}' rx='0.5'/></svg>`
      )}")`
    case 'grass':
      // Small blade-like strokes
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='${c.bg}'/><path d='M3 18 Q3 12 5 8' stroke='${c.fg}' fill='none' stroke-width='1.2' opacity='0.7'/><path d='M10 20 Q9 14 12 9' stroke='${c.fg2}' fill='none' stroke-width='1' opacity='0.6'/><path d='M17 19 Q16 13 18 7' stroke='${c.fg}' fill='none' stroke-width='1.1' opacity='0.5'/><path d='M7 17 Q8 13 6 10' stroke='${c.fg2}' fill='none' stroke-width='0.9' opacity='0.4'/><path d='M14 18 Q15 15 13 11' stroke='${c.fg}' fill='none' stroke-width='1' opacity='0.5'/></svg>`
      )}")`
    case 'gravel':
      // Small irregular dots/pebbles
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='${c.bg}'/><circle cx='4' cy='4' r='1.8' fill='${c.fg}' opacity='0.5'/><circle cx='14' cy='3' r='1.3' fill='${c.fg2}' opacity='0.6'/><circle cx='9' cy='10' r='2' fill='${c.fg}' opacity='0.4'/><circle cx='17' cy='12' r='1.5' fill='${c.fg2}' opacity='0.5'/><circle cx='3' cy='16' r='1.4' fill='${c.fg}' opacity='0.5'/><circle cx='12' cy='17' r='1.7' fill='${c.fg2}' opacity='0.4'/></svg>`
      )}")`
    case 'sand':
      // Fine stippled dots
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='${c.bg}'/><circle cx='2' cy='2' r='0.7' fill='${c.fg}' opacity='0.4'/><circle cx='8' cy='1' r='0.6' fill='${c.fg2}' opacity='0.3'/><circle cx='14' cy='3' r='0.8' fill='${c.fg}' opacity='0.35'/><circle cx='5' cy='7' r='0.7' fill='${c.fg2}' opacity='0.4'/><circle cx='11' cy='8' r='0.6' fill='${c.fg}' opacity='0.3'/><circle cx='1' cy='12' r='0.7' fill='${c.fg}' opacity='0.35'/><circle cx='7' cy='13' r='0.8' fill='${c.fg2}' opacity='0.4'/><circle cx='13' cy='14' r='0.6' fill='${c.fg}' opacity='0.3'/><circle cx='4' cy='15' r='0.5' fill='${c.fg}' opacity='0.25'/><circle cx='10' cy='5' r='0.5' fill='${c.fg2}' opacity='0.3'/></svg>`
      )}")`
    case 'pavement':
      // Rectangular tiles — 2px mortar gap, tiles fill symmetrically so edges match
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><rect width='24' height='24' fill='${c.fg2}'/><rect x='1' y='1' width='10' height='10' fill='${c.bg}' rx='0.5'/><rect x='13' y='1' width='10' height='10' fill='${c.fg}' rx='0.5'/><rect x='1' y='13' width='10' height='10' fill='${c.fg}' rx='0.5'/><rect x='13' y='13' width='10' height='10' fill='${c.bg}' rx='0.5'/></svg>`
      )}")`
    case 'dirt':
      // Same tile as dirtTrail but without the footprints
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='60'><rect width='48' height='60' fill='${c.bg}'/><circle cx='5' cy='4' r='1.8' fill='${c.fg}' opacity='0.5'/><circle cx='40' cy='15' r='1.5' fill='${c.fg2}' opacity='0.5'/><circle cx='3' cy='40' r='1.6' fill='${c.fg}' opacity='0.4'/><circle cx='42' cy='50' r='1.4' fill='${c.fg2}' opacity='0.45'/><circle cx='38' cy='35' r='1.3' fill='${c.fg}' opacity='0.35'/><circle cx='20' cy='25' r='2' fill='${c.fg}' opacity='0.45'/><circle cx='10' cy='55' r='1.7' fill='${c.fg2}' opacity='0.4'/><circle cx='33' cy='8' r='1.4' fill='${c.fg}' opacity='0.4'/><circle cx='25' cy='48' r='1.6' fill='${c.fg2}' opacity='0.45'/><circle cx='15' cy='32' r='1.5' fill='${c.fg}' opacity='0.35'/></svg>`
      )}")`
    case 'dirtTrailV':
      // Vertical walking trail — footprints going top to bottom
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='60'><rect width='48' height='60' fill='${c.bg}'/><circle cx='5' cy='4' r='1.8' fill='${c.fg}' opacity='0.5'/><circle cx='40' cy='15' r='1.5' fill='${c.fg2}' opacity='0.5'/><circle cx='3' cy='40' r='1.6' fill='${c.fg}' opacity='0.4'/><circle cx='42' cy='50' r='1.4' fill='${c.fg2}' opacity='0.45'/><circle cx='38' cy='35' r='1.3' fill='${c.fg}' opacity='0.35'/><ellipse cx='15' cy='10' rx='4' ry='6' fill='${c.fg}' opacity='0.7' transform='rotate(-5 15 10)'/><ellipse cx='15' cy='10' rx='2.5' ry='4' fill='${c.bg}' opacity='0.8' transform='rotate(-5 15 10)'/><ellipse cx='14' cy='20' rx='3' ry='2.5' fill='${c.fg}' opacity='0.7' transform='rotate(-5 14 20)'/><ellipse cx='14' cy='20' rx='1.5' ry='1.2' fill='${c.bg}' opacity='0.8' transform='rotate(-5 14 20)'/><ellipse cx='30' cy='34' rx='4' ry='6' fill='${c.fg}' opacity='0.7' transform='rotate(5 30 34)'/><ellipse cx='30' cy='34' rx='2.5' ry='4' fill='${c.bg}' opacity='0.8' transform='rotate(5 30 34)'/><ellipse cx='31' cy='44' rx='3' ry='2.5' fill='${c.fg}' opacity='0.7' transform='rotate(5 31 44)'/><ellipse cx='31' cy='44' rx='1.5' ry='1.2' fill='${c.bg}' opacity='0.8' transform='rotate(5 31 44)'/></svg>`
      )}")`
    case 'dirtTrailH':
      // Horizontal walking trail — footprints going left to right
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='48'><rect width='60' height='48' fill='${c.bg}'/><circle cx='4' cy='42' r='1.8' fill='${c.fg}' opacity='0.5'/><circle cx='15' cy='5' r='1.5' fill='${c.fg2}' opacity='0.5'/><circle cx='40' cy='44' r='1.6' fill='${c.fg}' opacity='0.4'/><circle cx='50' cy='3' r='1.4' fill='${c.fg2}' opacity='0.45'/><circle cx='35' cy='8' r='1.3' fill='${c.fg}' opacity='0.35'/><ellipse cx='10' cy='15' rx='6' ry='4' fill='${c.fg}' opacity='0.7' transform='rotate(-5 10 15)'/><ellipse cx='10' cy='15' rx='4' ry='2.5' fill='${c.bg}' opacity='0.8' transform='rotate(-5 10 15)'/><ellipse cx='20' cy='14' rx='2.5' ry='3' fill='${c.fg}' opacity='0.7' transform='rotate(-5 20 14)'/><ellipse cx='20' cy='14' rx='1.2' ry='1.5' fill='${c.bg}' opacity='0.8' transform='rotate(-5 20 14)'/><ellipse cx='34' cy='30' rx='6' ry='4' fill='${c.fg}' opacity='0.7' transform='rotate(5 34 30)'/><ellipse cx='34' cy='30' rx='4' ry='2.5' fill='${c.bg}' opacity='0.8' transform='rotate(5 34 30)'/><ellipse cx='44' cy='31' rx='2.5' ry='3' fill='${c.fg}' opacity='0.7' transform='rotate(5 44 31)'/><ellipse cx='44' cy='31' rx='1.2' ry='1.5' fill='${c.bg}' opacity='0.8' transform='rotate(5 44 31)'/></svg>`
      )}")`
    case 'wood':
      // Horizontal wood grain lines with slight waviness
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='24'><rect width='40' height='24' fill='${c.bg}'/><path d='M0 3 C13 2,27 4,40 3' stroke='${c.fg}' fill='none' stroke-width='1' opacity='0.5'/><path d='M0 7 C13 8,27 6,40 7' stroke='${c.fg2}' fill='none' stroke-width='0.8' opacity='0.4'/><path d='M0 11 C13 10,27 12,40 11' stroke='${c.fg}' fill='none' stroke-width='1.2' opacity='0.5'/><path d='M0 15 C13 16,27 14,40 15' stroke='${c.fg2}' fill='none' stroke-width='0.7' opacity='0.35'/><path d='M0 19 C13 18,27 20,40 19' stroke='${c.fg}' fill='none' stroke-width='1' opacity='0.45'/><path d='M0 22 C13 23,27 21,40 22' stroke='${c.fg2}' fill='none' stroke-width='0.6' opacity='0.3'/></svg>`
      )}")`
    case 'carpet':
      // Woven carpet pattern with diamond/cross motif
      return `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect width='16' height='16' fill='${c.bg}'/><rect x='0' y='0' width='4' height='4' fill='${c.fg}' opacity='0.4'/><rect x='8' y='0' width='4' height='4' fill='${c.fg}' opacity='0.4'/><rect x='4' y='4' width='4' height='4' fill='${c.fg2}' opacity='0.5'/><rect x='12' y='4' width='4' height='4' fill='${c.fg2}' opacity='0.5'/><rect x='0' y='8' width='4' height='4' fill='${c.fg2}' opacity='0.5'/><rect x='8' y='8' width='4' height='4' fill='${c.fg2}' opacity='0.5'/><rect x='4' y='12' width='4' height='4' fill='${c.fg}' opacity='0.4'/><rect x='12' y='12' width='4' height='4' fill='${c.fg}' opacity='0.4'/></svg>`
      )}")`
    default:
      return ''
  }
}

interface CellProps {
  data: CellData
  beingSelected: boolean
  beingDeselected?: boolean
  debug: boolean
  row: number
  col: number
  totalRows: number
  totalCols: number
  draftEdgeSides?: Set<number> | null
  fogged?: boolean
  fogEdges?: [boolean, boolean, boolean, boolean] // top, right, bottom, left neighbors are fogged
  fogPreview?: boolean
  revealedFogIds?: Set<string>
}

export const Cell = React.memo(function Cell({ data, beingSelected, beingDeselected, debug, row, col, totalRows, totalCols, draftEdgeSides, fogged, fogEdges, fogPreview, revealedFogIds }: CellProps) {
  const { selected, value, notes, fixedValue, fixedColor, color, borders, fixedBorders, labels, crossed, mark, fixedMark, fixedEdgeMarks, fixedVertexMarks, edgeCrosses, edgeDirections, lines, fixedLines, image, fixedTexture } = data

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
        {!fogged && fixedTexture && (
          <div className="cell-texture" style={{ background: textureBackground(fixedTexture) }} />
        )}
        {image && <img src={image} className="cell-image" alt="" draggable={false} />}
        {crossed && <span className="cell-cross">&times;</span>}
        {mark && (
          EDGE_MARKS[mark] ? (
            <span className="cell-mark cell-mark-edge" style={EDGE_MARKS[mark].position} aria-hidden="true">
              {renderMarkSvg(mark, true)}
            </span>
          ) : (
            <span className="cell-mark" aria-hidden="true">
              {renderMarkSvg(mark)}
            </span>
          )
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
      {!fogged && lines[0] && <div className={`cell-line cell-line-top${row === 0 ? ' cell-line-exit' : ''}${fixedLines[0] ? ' cell-line-fixed' : ''}`} />}
      {!fogged && lines[1] && <div className={`cell-line cell-line-right${col === totalCols - 1 ? ' cell-line-exit' : ''}${fixedLines[1] ? ' cell-line-fixed' : ''}`} />}
      {!fogged && lines[2] && <div className={`cell-line cell-line-bottom${row === totalRows - 1 ? ' cell-line-exit' : ''}${fixedLines[2] ? ' cell-line-fixed' : ''}`} />}
      {!fogged && lines[3] && <div className={`cell-line cell-line-left${col === 0 ? ' cell-line-exit' : ''}${fixedLines[3] ? ' cell-line-fixed' : ''}`} />}
      {!fogged && edgeCrosses[0] && row === 0 && <span className="edge-x edge-x-top">&times;</span>}
      {!fogged && edgeCrosses[1] && <span className="edge-x edge-x-right">&times;</span>}
      {!fogged && edgeCrosses[2] && <span className="edge-x edge-x-bottom">&times;</span>}
      {!fogged && edgeCrosses[3] && col === 0 && <span className="edge-x edge-x-left">&times;</span>}
      {!fogged && edgeDirections[0] > 0 && row === 0 && <span className="edge-dir edge-dir-top">{renderChevron(edgeDirections[0])}</span>}
      {!fogged && edgeDirections[1] > 0 && <span className="edge-dir edge-dir-right">{renderChevron(edgeDirections[1])}</span>}
      {!fogged && edgeDirections[2] > 0 && <span className="edge-dir edge-dir-bottom">{renderChevron(edgeDirections[2])}</span>}
      {!fogged && edgeDirections[3] > 0 && col === 0 && <span className="edge-dir edge-dir-left">{renderChevron(edgeDirections[3])}</span>}
      {fixedMark && (
        EDGE_MARKS[fixedMark] ? (
          <span className="fixed-mark cell-mark-edge" style={EDGE_MARKS[fixedMark].position} aria-hidden="true">
            {renderMarkSvg(fixedMark, true)}
          </span>
        ) : (
          <span className="fixed-mark fixed-mark-center" aria-hidden="true">
            {renderMarkSvg(fixedMark)}
          </span>
        )
      )}
      {!fogged && fixedEdgeMarks[0] && (
        <span className={`fixed-mark fixed-mark-edge-top${EDGE_MARKS[fixedEdgeMarks[0]] ? ' fixed-mark-arrow' : ''}`} aria-hidden="true">
          {renderMarkSvg(fixedEdgeMarks[0])}
        </span>
      )}
      {!fogged && fixedEdgeMarks[1] && (
        <span className={`fixed-mark fixed-mark-edge-right${EDGE_MARKS[fixedEdgeMarks[1]] ? ' fixed-mark-arrow' : ''}`} aria-hidden="true">
          {renderMarkSvg(fixedEdgeMarks[1])}
        </span>
      )}
      {!fogged && fixedEdgeMarks[2] && (
        <span className={`fixed-mark fixed-mark-edge-bottom${EDGE_MARKS[fixedEdgeMarks[2]] ? ' fixed-mark-arrow' : ''}`} aria-hidden="true">
          {renderMarkSvg(fixedEdgeMarks[2])}
        </span>
      )}
      {!fogged && fixedEdgeMarks[3] && (
        <span className={`fixed-mark fixed-mark-edge-left${EDGE_MARKS[fixedEdgeMarks[3]] ? ' fixed-mark-arrow' : ''}`} aria-hidden="true">
          {renderMarkSvg(fixedEdgeMarks[3])}
        </span>
      )}
      {!fogged && fixedVertexMarks[0] && (
        <span className="fixed-mark fixed-mark-vertex-tl" aria-hidden="true">
          {renderMarkSvg(fixedVertexMarks[0])}
        </span>
      )}
      {!fogged && fixedVertexMarks[1] && (
        <span className="fixed-mark fixed-mark-vertex-tr" aria-hidden="true">
          {renderMarkSvg(fixedVertexMarks[1])}
        </span>
      )}
      {!fogged && fixedVertexMarks[2] && (
        <span className="fixed-mark fixed-mark-vertex-br" aria-hidden="true">
          {renderMarkSvg(fixedVertexMarks[2])}
        </span>
      )}
      {!fogged && fixedVertexMarks[3] && (
        <span className="fixed-mark fixed-mark-vertex-bl" aria-hidden="true">
          {renderMarkSvg(fixedVertexMarks[3])}
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
