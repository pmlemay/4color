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

/** Generate a puzzle JSON object from a config with region map */
function generatePuzzle({ id, title, authors, difficulty, rules, clues, regionMap, regionNames, labelPositions, specialRules }) {
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
        entry.label = { text: labelPositions[labelKey], align: 'top' }
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
    tags: ['murdoku'],
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
  // 5x5 Haunted Lighthouse
  {
    id: 'haunted-lighthouse-murdoku',
    title: 'Haunted Lighthouse Murdoku',
    difficulty: 'Easy',
    rules: [
      '- Only 1 person per row and per column.',
      '- "Beside" means in the same room and orthogonally adjacent.',
      '- Icons: candle (candle-light), rope (rope-coil), skull (skull-crossed-bones)',
    ],
    clues: [
      'A (Woman - Agatha) is in the Lantern Room.',
      'B (Man   - Boris) is beside a candle.',
      'C (Woman - Celia) ...',
      'D (Man   - Desmond) ...',
      'V (Woman - Vivian) is the victim and is alone with the killer.',
    ],
    regionMap: [
      'LLLWW',
      'LLSWW',
      'DSSKK',
      'DDSKK',
      'DDDKK',
    ],
    regionNames: {
      L: 'Lantern Room', W: 'Watch Room', S: 'Spiral Stairs',
      D: 'Dock', K: "Keeper's Room",
    },
    labelPositions: {
      '0,0': 'Lantern Room', '0,3': 'Watch Room', '1,2': 'Stairs',
      '2,0': 'Dock', '2,3': "Keeper's Room",
    },
  },

  // 7x7 Neighbourhood Watch
  {
    id: 'neighbourhood-watch-murdoku',
    title: 'Neighbourhood Watch Murdoku',
    difficulty: 'Medium',
    rules: [
      '- Only 1 person per row and per column.',
      '- "Beside" means in the same area and orthogonally adjacent.',
      '- "Across the road" means in the same row or column, separated only by Road cells.',
      '- Icons: mailbox (mailbox), garden gnome (dwarf-face), bicycle (bicycle)',
    ],
    clues: [
      'A (Woman - Amanda) is in Maple House.',
      'B (Man   - Brad) is beside a mailbox.',
      'C (Woman - Carol) is across the road from Brad.',
      'D (Man   - Derek) ...',
      'E (Woman - Elise) ...',
      'F (Man   - Frank) ...',
      'V (Man   - Vincent) is the victim and is alone with the killer.',
    ],
    regionMap: [
      'MMROOPP',
      'MMROOPP',
      'CCRRRPP',
      'CCREEEE',
      'CCRBBBB',
      'GGRRBNN',
      'GGGRNNN',
    ],
    regionNames: {
      M: 'Maple House', O: 'Oak House', P: 'Park', R: 'Road',
      C: 'Cedar House', E: 'Elm House', B: 'Birch House',
      G: 'Garage', N: 'Garden',
    },
    labelPositions: {
      '0,0': 'Maple', '0,3': 'Oak', '0,5': 'Park',
      '2,0': 'Cedar', '3,3': 'Elm', '4,3': 'Birch',
      '5,0': 'Garage', '5,5': 'Garden',
    },
  },

  // 9x9 Pirate Ship
  {
    id: 'pirate-ship-murdoku',
    title: 'Pirate Ship Murdoku',
    difficulty: 'Hard',
    rules: [
      '- Only 1 person per row and per column.',
      '- "Beside" means in the same area and orthogonally adjacent.',
      '- "On the same deck" means in the same region.',
      '- Icons: treasure chest (locked-chest), anchor (anchor), compass (compass), cannon (cannon)',
    ],
    clues: [
      "A (Woman - Adelaide) is in the Captain's Cabin.",
      'B (Man   - Barnaby) is beside a cannon.',
      'C (Woman - Charlotte) is on the same deck as a treasure chest.',
      'D (Man   - Drake) ...',
      'E (Woman - Esmeralda) ...',
      'F (Man   - Fletcher) ...',
      'G (Man   - Gideon) ...',
      'H (Woman - Helena) ...',
      'V (Man   - Vasco) is the victim and is alone with the killer.',
    ],
    regionMap: [
      'CCCDDDNNN',
      'CCCCDBBBB',
      'QQQQDBBBG',
      'QQQHHHHGG',
      'QQQHHHHGG',
      'AAHHHHGGG',
      'AAAASSGGL',
      'AAASSSLLL',
      'AASSSLLLF',
    ],
    regionNames: {
      C: "Captain's Cabin", D: 'Upper Deck', N: "Crow's Nest",
      B: 'Brig', Q: 'Crew Quarters', H: 'Main Deck',
      G: 'Galley', A: 'Armory', S: 'Cargo Hold',
      L: 'Lower Hold', F: 'Bilge',
    },
    labelPositions: {
      '0,0': "Captain's", '0,3': 'Upper Deck', '0,6': "Crow's Nest",
      '1,5': 'Brig', '2,0': 'Crew Qtrs', '3,3': 'Main Deck',
      '3,7': 'Galley', '5,0': 'Armory', '6,4': 'Cargo',
      '7,5': 'Lower Hold', '8,8': 'Bilge',
    },
  },

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
      'A (Man   - Alaric) is in the Tower.',
      'B (Woman - Beatrice) is beside a crown.',
      'C (Man   - Cedric) is in the Courtyard.',
      'D (Woman - Diana) ...',
      'E (Man   - Edmund) ...',
      'F (Woman - Fiona) ...',
      'G (Man   - Gareth) ...',
      'H (Woman - Helena) ...',
      'I (Woman - Isolde) ...',
      'J (Man   - Jasper) ...',
      'K (Man   - Klaus) ...',
      'V (Woman - Valentina) is the victim and is alone with the killer.',
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
    labelPositions: {
      '0,0': 'Tower', '0,3': 'Ramparts', '0,9': 'Gatehouse',
      '2,2': 'War Room', '2,7': 'Chapel', '4,4': 'Great Hall',
      '4,0': 'Courtyard', '5,8': 'Kitchen', '3,10': 'Armory',
      '7,0': 'Barracks', '7,3': 'Throne Room', '10,2': 'Forge',
      '9,8': 'Stables', '10,5': 'Dungeon', '1,11': 'Cellar',
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
      'A (Woman - Astrid) is on the Bridge.',
      'B (Man   - Booker) is beside a wrench.',
      'C (Woman - Celeste) is in the Lab.',
      'D (Man   - Dmitri) ...',
      'E (Woman - Echo) ...',
      'F (Man   - Flint) ...',
      'G (Woman - Gemma) ...',
      'H (Man   - Hawke) ...',
      'I (Woman - Iris) ...',
      'J (Man   - Jonas) ...',
      'K (Woman - Kira) ...',
      'L (Man   - Lazlo) ...',
      'M (Woman - Mira) ...',
      'N (Man   - Nash) ...',
      'O (Woman - Orla) ...',
      'V (Man   - Viktor) is the victim and is alone with the killer.',
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
    labelPositions: {
      '0,0': 'Bridge', '0,5': 'Comms', '0,10': 'Lab',
      '1,13': 'Observatory', '3,2': 'Engineering', '3,7': 'Habitat',
      '4,10': 'Crew Qtrs', '6,14': 'Armory', '6,2': 'Medbay',
      '8,0': 'Reactor', '8,7': 'Docking', '9,10': 'Storage',
      '9,4': 'Hydro', '12,0': 'Cargo Bay', '13,5': 'Mess Hall',
      '14,10': 'Airlock', '10,14': 'Tower', '5,10': 'Navigation',
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
