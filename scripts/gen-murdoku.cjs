#!/usr/bin/env node
// Murdoku puzzle generator — creates puzzle JSON from region character maps.
//
// Usage:
//   node scripts/gen-murdoku.cjs                    # generate all, skip existing
//   node scripts/gen-murdoku.cjs --force             # overwrite all
//   node scripts/gen-murdoku.cjs haunted-lighthouse   # generate one by id (partial match)
//   node scripts/gen-murdoku.cjs lighthouse --force   # generate one, overwrite

const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'puzzles')

// ─── Core helpers ────────────────────────────────────────────

/** Check that every region in the map is a single connected component */
function validateConnectivity(regionMap) {
  const rows = regionMap.length
  const cols = regionMap[0].length
  const regionCells = {}
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = regionMap[r][c]
      if (!regionCells[ch]) regionCells[ch] = []
      regionCells[ch].push([r, c])
    }
  }
  const errors = []
  for (const [ch, cells] of Object.entries(regionCells)) {
    const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`))
    const visited = new Set()
    const queue = [cells[0]]
    visited.add(`${cells[0][0]},${cells[0][1]}`)
    while (queue.length > 0) {
      const [r, c] = queue.shift()
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc
        const key = `${nr},${nc}`
        if (cellSet.has(key) && !visited.has(key)) {
          visited.add(key)
          queue.push([nr, nc])
        }
      }
    }
    if (visited.size !== cells.length) {
      errors.push(`Region '${ch}' is DISCONNECTED: ${visited.size}/${cells.length} cells reachable`)
    }
  }
  return errors
}

/** Find the best label cell for each region.
 *  Preference: bottom-left cell with a bottom edge that has a neighbor to its right in the same region (2 cells wide).
 *  Fallback: any bottom-row cell with a bottom edge, leftmost first.
 *  Last resort: bottom-left cell of the region. */
function computeLabelPositions(regionMap, regionNames, labelOverrides) {
  if (labelOverrides) return labelOverrides
  const rows = regionMap.length
  const cols = regionMap[0].length

  // Collect cells per region
  const regionCells = {}
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = regionMap[r][c]
      if (!regionCells[ch]) regionCells[ch] = []
      regionCells[ch].push([r, c])
    }
  }

  const positions = {}
  for (const [ch, cells] of Object.entries(regionCells)) {
    if (!regionNames[ch]) continue
    const name = regionNames[ch]

    // Find cells with a bottom edge (bottom border of region)
    const withBottomEdge = cells.filter(([r, c]) =>
      r === rows - 1 || regionMap[r + 1][c] !== ch
    )

    // Among those, find ones that have a neighbor to the right in the same region (2-wide)
    const twoWide = withBottomEdge.filter(([r, c]) =>
      c < cols - 1 && regionMap[r][c + 1] === ch
    )

    // Pick: prefer 2-wide, then any bottom-edge, then last resort bottom-left of region
    let candidates = twoWide.length > 0 ? twoWide : withBottomEdge.length > 0 ? withBottomEdge : cells

    // Sort: bottom-most first, then left-most
    candidates.sort((a, b) => b[0] - a[0] || a[1] - b[1])
    const [r, c] = candidates[0]
    positions[`${r},${c}`] = name
  }
  return positions
}

/** Generate a puzzle JSON object from a config with region map */
function generatePuzzle({ id, title, authors, difficulty, rules, clues, regionMap, regionNames, labelPositions: labelOverrides, specialRules }) {
  const rows = regionMap.length
  const cols = regionMap[0].length

  // Validate row lengths
  for (let r = 0; r < rows; r++) {
    if (regionMap[r].length !== cols) {
      console.error(`${id}: Row ${r} has ${regionMap[r].length} cols, expected ${cols}`)
      process.exit(1)
    }
  }

  // Validate connectivity
  const errors = validateConnectivity(regionMap)
  if (errors.length > 0) {
    console.error(`${id}: Connectivity errors:`)
    for (const e of errors) console.error(`  ${e}`)
    process.exit(1)
  }

  // Compute label positions from region names
  const labelPositions = computeLabelPositions(regionMap, regionNames || {}, labelOverrides)

  // Compute borders for each cell
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const region = regionMap[r][c]
      const top = r === 0 || regionMap[r - 1][c] !== region ? 2 : 0
      const right = c === cols - 1 || regionMap[r][c + 1] !== region ? 2 : 0
      const bottom = r === rows - 1 || regionMap[r + 1][c] !== region ? 2 : 0
      const left = c === 0 || regionMap[r][c - 1] !== region ? 2 : 0
      const hasBorders = top > 0 || right > 0 || bottom > 0 || left > 0

      const entry = { row: r, col: c }
      if (hasBorders) entry.borders = [top, right, bottom, left]

      const labelKey = `${r},${c}`
      if (labelPositions[labelKey]) {
        entry.labels = { bottom: { text: labelPositions[labelKey] } }
      }

      if (hasBorders || labelPositions[labelKey]) {
        cells.push(entry)
      }
    }
  }

  // Log region summary
  const regionCounts = {}
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = regionMap[r][c]
      regionCounts[ch] = (regionCounts[ch] || 0) + 1
    }
  }
  const regionSummary = Object.entries(regionCounts)
    .map(([ch, n]) => `${regionNames?.[ch] || ch}(${n})`)
    .join(', ')
  console.log(`  ${id}: ${rows}x${cols}, ${cells.length} cells — ${regionSummary}`)

  return {
    id,
    title,
    authors: authors || ['PmLemay'],
    rules,
    clues,
    specialRules,
    difficulty: difficulty || 'Medium',
    tags: ['Murdoku'],
    autoCrossRules: ['rook'],
    gridSize: { rows, cols },
    cells,
    inProgress: true,
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

// ─── Puzzle definitions ──────────────────────────────────────
// Add new puzzles here. Each entry is a config object for generatePuzzle().

const PUZZLES = [
  // 12x12 Castle Siege
  {
    id: 'castle-siege-murdoku',
    title: 'Castle Siege Murdoku',
    difficulty: 'Expert',
    rules: [
      '- Only 1 person per row and per column.',
      '- "Beside" means in the same area and orthogonally adjacent.',
      '- "Adjacent room" means the person\'s cell touches a border of the named room.',
      '- Icons: crown (crown), sword (broadsword), shield (round-shield), torch (torch)',
    ],
    clues: [
      'A (Man   - Alaric). He was in the Tower.',
      'B (Woman - Beatrice). She was beside a crown.',
      'C (Man   - Cedric). He was in the Courtyard.',
      'D (Woman - Diana). She was...',
      'E (Man   - Edmund). He was...',
      'F (Woman - Fiona). She was...',
      'G (Man   - Gareth). He was...',
      'H (Woman - Helena). She was...',
      'I (Woman - Isolde). She was...',
      'J (Man   - Jasper). He was...',
      'K (Man   - Klaus). He was...',
      'V (Woman - Valentina). The victim. She was alone with the murderer.',
    ],
    regionMap: [
      'TTTRRRRRRGGG',
      'TTTRRRRRRGG.',
      'TTWWWRRCCCC.',
      'TTWWWRRCCCAA',
      'MMWWDDDDCCAA',
      'MMMMDDDDKKAA',
      'MMMMDDDDKKAA',
      'BBBHHHHHKKAA',
      'BBBHHHHHKKAA',
      'BBBHHHHHSSSS',
      'BBFFFLHHSSSS',
      'BBFFFLLHSSSS',
    ],
    regionNames: {
      T: 'Tower', R: 'Ramparts', G: 'Gatehouse', W: 'War Room',
      C: 'Chapel', A: 'Armory', M: 'Courtyard', D: 'Great Hall',
      K: 'Kitchen', B: 'Barracks', H: 'Throne Room', F: 'Forge',
      S: 'Stables', L: 'Dungeon', '.': 'Cellar',
    },
  },

  // 16x16 Space Station
  {
    id: 'space-station-murdoku',
    title: 'Space Station Murdoku',
    difficulty: 'Expert',
    rules: [
      '- Only 1 person per row and per column.',
      '- "Beside" means in the same module and orthogonally adjacent.',
      '- "Same corridor" means in the same row or column within the same module.',
      '- Icons: wrench (auto-repair), vial (test-tube), satellite (satellite-communication), laser (laser-blast)',
    ],
    clues: [
      'A (Woman - Astrid). She was on the Bridge.',
      'B (Man   - Booker). He was beside a wrench.',
      'C (Woman - Celeste). She was in the Lab.',
      'D (Man   - Dmitri). He was...',
      'E (Woman - Echo). She was...',
      'F (Man   - Flint). He was...',
      'G (Woman - Gemma). She was...',
      'H (Man   - Hawke). He was...',
      'I (Woman - Iris). She was...',
      'J (Man   - Jonas). He was...',
      'K (Woman - Kira). She was...',
      'L (Man   - Lazlo). He was...',
      'M (Woman - Mira). She was...',
      'N (Man   - Nash). He was...',
      'O (Woman - Orla). She was...',
      'V (Man   - Viktor). The victim. He was alone with the murderer.',
    ],
    regionMap: [
      'BBBBBCCCCCLLLLLL',
      'BBBBBCCCCCLLLOOO',
      'BBBEEECCLLLLOOOO',
      'BBEEEECHHHLLLLOO',
      'EEEEEHHHHHQQQQOO',
      'EEEEEHHHHHNQQQQQ',
      'EEMMMMMHHHQQQQAA',
      'EEMMMMMHHHAAAAAA',
      'RRMMMMMDDDAAAAAA',
      'RRRRGGDDDDSSSAAA',
      'RRRRGGDDDDSSSSTT',
      'RRRRGGGGDDSSSSTT',
      'PPPPGGGGDDFFTTTT',
      'PPPPGGGGFFFFTTTT',
      'PPPPFFFFFFIITTTT',
      'PPPPFFFFIIIITTTT',
    ],
    regionNames: {
      B: 'Bridge', C: 'Communications', L: 'Lab', O: 'Observatory',
      E: 'Engineering', H: 'Habitat Ring', Q: 'Crew Quarters',
      A: 'Armory', M: 'Medbay', R: 'Reactor', D: 'Docking Bay',
      S: 'Storage', G: 'Hydroponics', P: 'Cargo Bay',
      F: 'Mess Hall', T: 'Comms Tower', I: 'Airlock', N: 'Navigation',
    },
  },
]

// ─── CLI ─────────────────────────────────────────────────────

const args = process.argv.slice(2)
const force = args.includes('--force')
const filters = args.filter(a => a !== '--force')

let toGenerate = PUZZLES
if (filters.length > 0) {
  toGenerate = PUZZLES.filter(p =>
    filters.some(f => p.id.includes(f))
  )
  if (toGenerate.length === 0) {
    console.error(`No puzzles matched: ${filters.join(', ')}`)
    console.error(`Available: ${PUZZLES.map(p => p.id).join(', ')}`)
    process.exit(1)
  }
}

let wrote = 0, skipped = 0
for (const config of toGenerate) {
  const outPath = path.join(OUT_DIR, `${config.id}.json`)
  if (!force && fs.existsSync(outPath)) {
    console.log(`  SKIP ${config.id} (already exists, use --force to overwrite)`)
    skipped++
    continue
  }
  const puzzle = generatePuzzle(config)
  fs.writeFileSync(outPath, JSON.stringify(puzzle, null, 2))
  console.log(`  WROTE ${outPath}`)
  wrote++
}

console.log(`\nDone: ${wrote} written, ${skipped} skipped`)
