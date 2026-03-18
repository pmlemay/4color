/**
 * Generate a compact SVG thumbnail from puzzle data.
 * Renders the puzzle as a player would see it on first load:
 * textures, colors, fixed values, borders, marks, labels, and fog overlay.
 */
export function generateThumbnail(data) {
  const { rows, cols } = data.gridSize
  const cells = data.cells || []

  // Build lookups by "r,c"
  const cellMap = new Map()
  for (const cell of cells) {
    cellMap.set(`${cell.row},${cell.col}`, cell)
  }

  // Build fogged cell set (cells hidden at start)
  const foggedCells = new Set()
  for (const fg of data.fogGroups || []) {
    for (const c of fg.cells) foggedCells.add(`${c.row},${c.col}`)
  }

  // Scale cell size down for large grids to keep SVG size manageable
  const maxDim = Math.max(rows, cols)
  const cellSize = maxDim > 30 ? 3 : maxDim > 16 ? 4 : maxDim > 10 ? 6 : 8
  const pad = 1
  const w = cols * cellSize + pad * 2
  const h = rows * cellSize + pad * 2
  const showText = cellSize >= 6  // skip text rendering for tiny cells

  // Color palette matching the app's .color0-.color9 (at full opacity for thumbnail)
  const COLOR_MAP = {
    '0': '#9e9e9e', '1': '#e53935', '2': '#d81b60', '3': '#ff9800', '4': '#fbc02d',
    '5': '#4caf50', '6': '#00bcd4', '7': '#1e88e5', '8': '#7e57c2', '9': '#222',
  }

  // Texture base colors (variant 0 bg color — simplified)
  const TEXTURE_COLORS = {
    water:      ['#3a7bd5', '#6aafe6', '#4a90d9'],
    bricks:     ['#8b4513', '#6d6d6d', '#c4a882'],
    grass:      ['#3a7d44', '#6b8e23', '#228b22'],
    gravel:     ['#808080', '#8b7d6b', '#696969'],
    sand:       ['#d4b896', '#c2b280', '#e8d5b7'],
    pavement:   ['#555555', '#888888', '#6a5d4d'],
    wood:       ['#8b6914', '#5c3a1e', '#c4a56a'],
    dirt:       ['#2e1f14', '#241a10', '#382818'],
    dirtTrailV: ['#2e1f14', '#241a10', '#382818'],
    dirtTrailH: ['#2e1f14', '#241a10', '#382818'],
    carpet:     ['#8b2252', '#1a4a6e', '#2e5e3e'],
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`

  const hasFog = foggedCells.size > 0

  // Background: if fog is present, use white base (fog color) otherwise light gray
  svg += `<rect width="${w}" height="${h}" fill="${hasFog ? '#fff' : '#e8e8e8'}"/>`
  if (!hasFog) {
    svg += `<rect x="${pad}" y="${pad}" width="${cols * cellSize}" height="${rows * cellSize}" fill="#f8f8f8" stroke="#999" stroke-width="0.5"/>`
  } else {
    // Draw visible area background under the fog
    svg += `<rect x="${pad}" y="${pad}" width="${cols * cellSize}" height="${rows * cellSize}" fill="#fff" stroke="#ccc" stroke-width="0.3"/>`
  }

  // Render each cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`
      const x = pad + c * cellSize
      const y = pad + r * cellSize
      const isFogged = foggedCells.has(key)

      if (isFogged) continue  // skip fogged cells entirely (background is already white)

      const cell = cellMap.get(key)
      if (!cell) continue

      // In fog puzzles, draw a visible cell background so it stands out
      if (hasFog) {
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#f0f0f0" stroke="#bbb" stroke-width="0.3"/>`
      }

      // Texture background
      if (cell.fixedTexture) {
        const colors = TEXTURE_COLORS[cell.fixedTexture.type]
        if (colors) {
          const variant = cell.fixedTexture.variant || 0
          const bg = colors[variant % colors.length]
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${bg}" opacity="0.4"/>`
        }
      }

      // Fixed color
      if (cell.fixedColor) {
        const fill = COLOR_MAP[cell.fixedColor] || '#ddd'
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" opacity="0.55"/>`
      }

      // Color (pre-set color, not player-applied)
      if (cell.color && !cell.fixedColor) {
        const fill = COLOR_MAP[cell.color] || '#ddd'
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" opacity="0.55"/>`
      }

      // Fixed value (show as small text, skip for tiny cells)
      if (cell.fixedValue && showText) {
        const txt = cell.fixedValue
        const fontSize = txt.length > 1 ? cellSize * 0.45 : cellSize * 0.65
        svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2}" font-size="${fontSize}" font-weight="bold" fill="#333" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${escapeXml(txt)}</text>`
      }

      // Fixed mark (show as a small shape indicator)
      if (cell.fixedMark) {
        const cx = x + cellSize / 2
        const cy = y + cellSize / 2
        const markR = cellSize * 0.3
        svg += renderMiniMark(cell.fixedMark, cx, cy, markR)
      }

      // Labels — show middle label as tiny text (skip for tiny cells)
      if (showText) {
        const labels = cell.labels || {}
        if (cell.label && !labels.middle) {
          const align = cell.label.align || 'middle'
          if (!labels[align]) labels[align] = cell.label
        }
        const lbl = labels.middle || labels.top || labels.bottom
        if (lbl && lbl.text) {
          const ly = labels.top ? y + cellSize * 0.25 : labels.bottom ? y + cellSize * 0.8 : y + cellSize / 2
          const fontSize = cellSize * 0.35
          svg += `<text x="${x + cellSize / 2}" y="${ly}" font-size="${fontSize}" fill="#666" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${escapeXml(lbl.text.substring(0, 3))}</text>`
        }
      }

      // Edge marks (arrows at edges, skip for tiny cells)
      if (cell.fixedEdgeMarks && showText) {
        const em = cell.fixedEdgeMarks
        const cx = x + cellSize / 2
        const cy = y + cellSize / 2
        const markR = cellSize * 0.2
        if (em[0]) svg += renderMiniMark(em[0], cx, y + markR, markR)          // top
        if (em[1]) svg += renderMiniMark(em[1], x + cellSize - markR, cy, markR) // right
        if (em[2]) svg += renderMiniMark(em[2], cx, y + cellSize - markR, markR) // bottom
        if (em[3]) svg += renderMiniMark(em[3], x + markR, cy, markR)            // left
      }

      // Fixed lines (green connection lines)
      if (cell.fixedLines) {
        const fl = cell.fixedLines
        const cx = x + cellSize / 2
        const cy = y + cellSize / 2
        const lineColor = '#1a9e54'
        if (fl[0]) svg += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${cy}" stroke="${lineColor}" stroke-width="0.8"/>`
        if (fl[1]) svg += `<line x1="${cx}" y1="${cy}" x2="${x + cellSize}" y2="${cy}" stroke="${lineColor}" stroke-width="0.8"/>`
        if (fl[2]) svg += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${y + cellSize}" stroke="${lineColor}" stroke-width="0.8"/>`
        if (fl[3]) svg += `<line x1="${x}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="${lineColor}" stroke-width="0.8"/>`
      }
    }
  }

  // Grid lines (thin internal borders)
  for (let r = 1; r < rows; r++) {
    const y1 = pad + r * cellSize
    // Skip lines where both sides are fogged
    let hasVisible = false
    for (let c = 0; c < cols; c++) {
      if (!foggedCells.has(`${r},${c}`) || !foggedCells.has(`${r - 1},${c}`)) { hasVisible = true; break }
    }
    if (hasVisible) {
      svg += `<line x1="${pad}" y1="${y1}" x2="${pad + cols * cellSize}" y2="${y1}" stroke="#d0d0d0" stroke-width="0.2"/>`
    }
  }
  for (let c = 1; c < cols; c++) {
    const x1 = pad + c * cellSize
    let hasVisible = false
    for (let r = 0; r < rows; r++) {
      if (!foggedCells.has(`${r},${c}`) || !foggedCells.has(`${r},${c - 1}`)) { hasVisible = true; break }
    }
    if (hasVisible) {
      svg += `<line x1="${x1}" y1="${pad}" x2="${x1}" y2="${pad + rows * cellSize}" stroke="#d0d0d0" stroke-width="0.2"/>`
    }
  }

  // Thick borders (region borders)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`
      if (foggedCells.has(key)) continue
      const cell = cellMap.get(key)
      if (!cell || !cell.borders) continue
      const b = cell.borders
      const x = pad + c * cellSize
      const y = pad + r * cellSize

      // Right border (internal only)
      if (b[1] > 0 && c < cols - 1) {
        const bw = b[1] >= 2 ? 1.0 : 0.4
        svg += `<line x1="${x + cellSize}" y1="${y}" x2="${x + cellSize}" y2="${y + cellSize}" stroke="#444" stroke-width="${bw}"/>`
      }
      // Bottom border (internal only)
      if (b[2] > 0 && r < rows - 1) {
        const bw = b[2] >= 2 ? 1.0 : 0.4
        svg += `<line x1="${x}" y1="${y + cellSize}" x2="${x + cellSize}" y2="${y + cellSize}" stroke="#444" stroke-width="${bw}"/>`
      }
    }
  }

  svg += '</svg>'
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function renderMiniMark(shape, cx, cy, r) {
  const color = '#555'
  switch (shape) {
    case 'dot':
    case 'bigcirclefilled':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="${color}"/>`
    case 'circle':
    case 'bigcircle':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="none" stroke="${color}" stroke-width="0.4"/>`
    case 'square':
      return `<rect x="${cx - r * 0.5}" y="${cy - r * 0.5}" width="${r}" height="${r}" fill="none" stroke="${color}" stroke-width="0.4"/>`
    case 'diamond':
      return `<polygon points="${cx},${cy - r * 0.6} ${cx + r * 0.6},${cy} ${cx},${cy + r * 0.6} ${cx - r * 0.6},${cy}" fill="none" stroke="${color}" stroke-width="0.4"/>`
    case 'star':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="${color}"/>`
    case 'triangle':
      return `<polygon points="${cx},${cy - r * 0.6} ${cx + r * 0.6},${cy + r * 0.5} ${cx - r * 0.6},${cy + r * 0.5}" fill="none" stroke="${color}" stroke-width="0.4"/>`
    case 'arrowUp':
      return `<line x1="${cx}" y1="${cy - r * 0.5}" x2="${cx}" y2="${cy + r * 0.5}" stroke="${color}" stroke-width="0.4" marker-start="url(#ah)"/>`
    case 'arrowDown':
      return `<line x1="${cx}" y1="${cy - r * 0.5}" x2="${cx}" y2="${cy + r * 0.5}" stroke="${color}" stroke-width="0.4"/>`
    case 'arrowLeft':
    case 'arrowRight':
      return `<line x1="${cx - r * 0.5}" y1="${cy}" x2="${cx + r * 0.5}" y2="${cy}" stroke="${color}" stroke-width="0.4"/>`
    case 'dashV':
      return `<line x1="${cx}" y1="${cy - r * 0.4}" x2="${cx}" y2="${cy + r * 0.4}" stroke="${color}" stroke-width="0.5"/>`
    case 'dashH':
      return `<line x1="${cx - r * 0.4}" y1="${cy}" x2="${cx + r * 0.4}" y2="${cy}" stroke="${color}" stroke-width="0.5"/>`
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="${color}" opacity="0.5"/>`
  }
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
