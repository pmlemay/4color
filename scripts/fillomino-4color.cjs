#!/usr/bin/env node
// Fillomino-style 4-Color tool: partition solver, uniqueness check, and a minimal generator.
//
// A solution is a partition of the grid into connected regions where:
//   - each region contains exactly one clue (its anchor),
//   - a numeric clue equals its region's cell count; a "*" clue is any size,
//   - the region-adjacency graph admits a proper 4-coloring whose 4 color classes
//     each cover an equal number of cells (total/4). (Adjacent same-color cells are
//     the same region, so coloring reduces to a balanced grouping of regions.)
//
// Usage:
//   node scripts/fillomino-4color.cjs check <puzzle-id>        # analyze an existing puzzle
//   node scripts/fillomino-4color.cjs gen <rows> <cols> [opts] # generate a unique variant
//     opts: --min N --max N (region size range), --stars N (wildcard clues),
//           --attempts N, --write <id> (save to public/puzzles/<id>.json), --seed N
//
// This is a design-time tool. It caps its search and reports "inconclusive" if exceeded.

const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'puzzles')
const NODE_CAP = 8_000_000

// ─── Deterministic RNG (so --seed reproduces) ───────────────────
function makeRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    // xorshift32
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 0xffffffff
  }
}

// ─── Puzzle model ───────────────────────────────────────────────

/** Parse a loaded puzzle JSON into { rows, cols, clues: [{r,c,size|null}] }. */
function parsePuzzle(json) {
  const rows = json.gridSize.rows
  const cols = json.gridSize.cols
  const clues = []
  for (const cell of json.cells || []) {
    if (cell.fixedValue == null || cell.fixedValue === '') continue
    const fv = String(cell.fixedValue)
    const size = /^\d+$/.test(fv) ? parseInt(fv, 10) : null // null = wildcard
    clues.push({ r: cell.row, c: cell.col, size })
  }
  return { rows, cols, clues }
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]]

// ─── Partition solver ───────────────────────────────────────────
//
// Regions are pre-seeded at their anchors (guarantees connectivity from the anchor
// and that each region contains its own clue). Numeric regions grow from their anchor
// until they hit their target size; leftover cells are then partitioned among the
// star (wildcard) regions. Every distinct full partition that also admits a balanced
// 4-coloring is a solution.

/**
 * Enumerate solutions. Returns { solutions: [signature...], colorable, nodesExceeded }.
 * Stops once `limit` distinct solutions are found (2 is enough for a uniqueness test).
 */
function solve({ rows, cols, clues }, limit = 2) {
  const total = rows * cols
  const idx = (r, c) => r * cols + c
  const anchorAt = new Int32Array(total).fill(-1) // cell -> region index if it's an anchor
  clues.forEach((cl, i) => { anchorAt[idx(cl.r, cl.c)] = i })

  const numericCap = clues.reduce((s, cl) => s + (cl.size || 0), 0)
  const starCount = clues.filter(cl => cl.size == null).length
  if (numericCap > total) return { solutions: [], colorable: false, nodesExceeded: false, error: `numeric clues sum to ${numericCap} > ${total} cells` }
  if (starCount === 0 && numericCap !== total) return { solutions: [], colorable: false, nodesExceeded: false, error: `numeric clues sum to ${numericCap}, need ${total} (no wildcards to absorb the rest)` }

  const owner = new Int32Array(total).fill(-1)
  const regionSize = new Int32Array(clues.length)
  for (let i = 0; i < clues.length; i++) {
    owner[idx(clues[i].r, clues[i].c)] = i
    regionSize[i] = 1
  }

  const seen = new Set()
  const solutions = []
  let colorable = false
  let nodes = 0
  let exceeded = false

  const isAnchorCell = (cell) => anchorAt[cell] !== -1

  // Free neighbors of a region (cells not owned, not any anchor) — for numeric growth.
  function freeNeighborsOf(regionIdx) {
    const out = []
    for (let cell = 0; cell < total; cell++) {
      if (owner[cell] !== regionIdx) continue
      const r = (cell / cols) | 0, c = cell % cols
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
        const nCell = idx(nr, nc)
        if (owner[nCell] === -1 && !isAnchorCell(nCell)) out.push(nCell)
      }
    }
    return [...new Set(out)]
  }

  // Prune: every free (unowned, non-anchor) cell must sit in a free-connected pocket
  // that touches a region still able to consume it (numeric-with-capacity or any star).
  function coverageOk() {
    const growable = new Uint8Array(clues.length)
    for (let i = 0; i < clues.length; i++) {
      growable[i] = clues[i].size == null || regionSize[i] < clues[i].size ? 1 : 0
    }
    const visited = new Uint8Array(total)
    for (let cell = 0; cell < total; cell++) {
      if (owner[cell] !== -1 || isAnchorCell(cell) || visited[cell]) continue
      // Flood this free pocket; check it borders a growable region.
      const stack = [cell]; visited[cell] = 1
      let bordersGrowable = false
      while (stack.length) {
        const cur = stack.pop()
        const r = (cur / cols) | 0, c = cur % cols
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const n = idx(nr, nc)
          if (owner[n] !== -1) { if (growable[owner[n]]) bordersGrowable = true; continue }
          if (isAnchorCell(n)) { if (growable[anchorAt[n]]) bordersGrowable = true; continue }
          if (!visited[n]) { visited[n] = 1; stack.push(n) }
        }
      }
      if (!bordersGrowable) return false
    }
    return true
  }

  function recordSolution() {
    // Signature by anchor position (color labels are irrelevant; shape is what matters).
    const sig = new Array(total)
    for (let cell = 0; cell < total; cell++) sig[cell] = owner[cell]
    // Normalize region ids to their anchor cell so equivalent partitions collapse.
    const anchorCellOf = clues.map(cl => idx(cl.r, cl.c))
    const key = sig.map(o => anchorCellOf[o]).join(',')
    if (seen.has(key)) return
    // Must admit a balanced 4-coloring to count as a real solution.
    if (!canBalanceColor({ rows, cols }, owner, regionSize, clues.length)) return
    seen.add(key)
    colorable = true
    solutions.push(key)
  }

  // Phase 2: assign leftover free cells to star regions (connected growth).
  function fillStars() {
    if (++nodes > NODE_CAP) { exceeded = true; return }
    if (exceeded || solutions.length >= limit) return
    // Find a free cell adjacent to a star region, MRV on number of star options.
    let best = -1, bestOpts = null
    for (let cell = 0; cell < total; cell++) {
      if (owner[cell] !== -1 || isAnchorCell(cell)) continue
      const r = (cell / cols) | 0, c = cell % cols
      const opts = new Set()
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
        const n = idx(nr, nc)
        const o = owner[n] !== -1 ? owner[n] : (isAnchorCell(n) ? anchorAt[n] : -1)
        if (o !== -1 && clues[o].size == null) opts.add(o)
      }
      if (opts.size === 0) continue
      if (best === -1 || opts.size < bestOpts.size) { best = cell; bestOpts = opts }
    }
    if (best === -1) {
      // No assignable free cell left. Success iff nothing free remains.
      for (let cell = 0; cell < total; cell++) {
        if (owner[cell] === -1 && !isAnchorCell(cell)) return // orphaned → dead end
      }
      recordSolution()
      return
    }
    for (const region of bestOpts) {
      owner[best] = region; regionSize[region]++
      fillStars()
      owner[best] = -1; regionSize[region]--
      if (exceeded || solutions.length >= limit) return
    }
  }

  // Phase 1: grow numeric regions to their target sizes.
  function growNumeric() {
    if (++nodes > NODE_CAP) { exceeded = true; return }
    if (exceeded || solutions.length >= limit) return
    // MRV: unfinished numeric region with the fewest free-neighbor options.
    let best = -1, bestNbrs = null
    for (let i = 0; i < clues.length; i++) {
      if (clues[i].size == null || regionSize[i] >= clues[i].size) continue
      const nbrs = freeNeighborsOf(i)
      if (nbrs.length === 0) return // can't complete this region → dead end
      if (best === -1 || nbrs.length < bestNbrs.length) { best = i; bestNbrs = nbrs }
    }
    if (best === -1) { fillStars(); return } // all numeric regions full
    if (!coverageOk()) return
    for (const cell of bestNbrs) {
      owner[cell] = best; regionSize[best]++
      growNumeric()
      owner[cell] = -1; regionSize[best]--
      if (exceeded || solutions.length >= limit) return
    }
  }

  growNumeric()
  return { solutions, colorable, nodesExceeded: exceeded }
}

// ─── Balanced 4-coloring feasibility ────────────────────────────
//
// Group the regions into 4 color classes so that adjacent regions differ and each
// class covers exactly total/4 cells.

function buildRegionAdjacency({ rows, cols }, owner, regionCount) {
  const idx = (r, c) => r * cols + c
  const adj = Array.from({ length: regionCount }, () => new Set())
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = owner[idx(r, c)]
      if (c + 1 < cols) { const b = owner[idx(r, c + 1)]; if (a !== b) { adj[a].add(b); adj[b].add(a) } }
      if (r + 1 < rows) { const b = owner[idx(r + 1, c)]; if (a !== b) { adj[a].add(b); adj[b].add(a) } }
    }
  }
  return adj.map(s => [...s])
}

function canBalanceColor({ rows, cols }, owner, regionSize, regionCount) {
  const total = rows * cols
  if (total % 4 !== 0) return false
  const target = total / 4
  const adj = buildRegionAdjacency({ rows, cols }, owner, regionCount)
  // Order regions largest-first for stronger pruning.
  const order = [...Array(regionCount).keys()].sort((a, b) => regionSize[b] - regionSize[a])
  const color = new Int32Array(regionCount).fill(-1)
  const sums = [0, 0, 0, 0]

  function place(oi) {
    if (oi === regionCount) return true
    const region = order[oi]
    const sz = regionSize[region]
    for (let col = 0; col < 4; col++) {
      if (sums[col] + sz > target) continue
      let clash = false
      for (const nb of adj[region]) { if (color[nb] === col) { clash = true; break } }
      if (clash) continue
      color[region] = col; sums[col] += sz
      if (place(oi + 1)) return true
      color[region] = -1; sums[col] -= sz
    }
    return false
  }
  return place(0)
}

// ─── Analysis of an existing puzzle ─────────────────────────────

function loadPuzzle(id) {
  const file = path.join(OUT_DIR, `${id}.json`)
  if (!fs.existsSync(file)) { console.error(`Puzzle not found: ${file}`); process.exit(1) }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function analyze(id) {
  const json = loadPuzzle(id)
  const puzzle = parsePuzzle(json)
  const { rows, cols, clues } = puzzle
  const total = rows * cols
  const numericSum = clues.reduce((s, cl) => s + (cl.size || 0), 0)
  const stars = clues.filter(cl => cl.size == null).length

  console.log(`Puzzle: ${id}  (${rows}x${cols} = ${total} cells)`)
  console.log(`Clues: ${clues.length}  (${clues.length - stars} numeric summing to ${numericSum}, ${stars} wildcard covering ${total - numericSum})`)

  const t0 = Date.now()
  const { solutions, nodesExceeded, error } = solve(puzzle, 2)
  const ms = Date.now() - t0
  if (error) { console.log(`Result: INVALID — ${error}`); return }
  if (nodesExceeded) {
    console.log(`Result: INCONCLUSIVE — search cap (${NODE_CAP.toLocaleString()} nodes) hit after ${ms}ms. Found ${solutions.length} solution(s) so far.`)
    return
  }
  if (solutions.length === 0) console.log(`Result: NO SOLUTION (no partition satisfies the clues + balanced 4-coloring).  [${ms}ms]`)
  else if (solutions.length === 1) console.log(`Result: UNIQUE ✓ — exactly one solution, and it is balance-colorable.  [${ms}ms]`)
  else console.log(`Result: NOT UNIQUE — at least 2 distinct solutions exist.  [${ms}ms]`)
}

// ─── Minimal generator ──────────────────────────────────────────
//
// Random-restart: grow a random connected partition of the grid, keep it only if its
// regions admit a balanced 4-coloring, emit one clue per region (some as wildcards),
// then confirm the clues force a unique solution.

function randomPartition(rows, cols, rng, minSize, maxSize) {
  const total = rows * cols
  const idx = (r, c) => r * cols + c
  const owner = new Int32Array(total).fill(-1)
  const regionSizes = []
  let regionCount = 0

  const freeCells = () => {
    const out = []
    for (let i = 0; i < total; i++) if (owner[i] === -1) out.push(i)
    return out
  }

  while (true) {
    const free = freeCells()
    if (free.length === 0) break
    const seed = free[(rng() * free.length) | 0]
    const rid = regionCount++
    owner[seed] = rid
    let size = 1
    const targetRaw = minSize + ((rng() * (maxSize - minSize + 1)) | 0)
    const target = Math.min(targetRaw, free.length)
    // Grow by random adjacent free cells.
    while (size < target) {
      const frontier = []
      for (let cell = 0; cell < total; cell++) {
        if (owner[cell] !== rid) continue
        const r = (cell / cols) | 0, c = cell % cols
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
          const n = idx(nr, nc)
          if (owner[n] === -1) frontier.push(n)
        }
      }
      if (frontier.length === 0) break
      const pick = frontier[(rng() * frontier.length) | 0]
      owner[pick] = rid; size++
    }
    regionSizes[rid] = size
  }

  // Merge any size-1 stragglers that got stranded? Keep as-is; small regions are fine.
  return { owner, regionSizes, regionCount }
}

function generate(rows, cols, opts) {
  const total = rows * cols
  if (total % 4 !== 0) { console.error(`Grid ${rows}x${cols}=${total} not divisible by 4 — cannot balance 4 colors.`); process.exit(1) }
  const rng = makeRng(opts.seed || 12345)
  const minSize = opts.min || 2
  const maxSize = opts.max || Math.max(minSize, Math.round(total / 12))
  const attempts = opts.attempts || 3000
  const idx = (r, c) => r * cols + c

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { owner, regionSizes, regionCount } = randomPartition(rows, cols, rng, minSize, maxSize)
    if (regionCount < 4) continue
    if (!canBalanceColor({ rows, cols }, owner, Int32Array.from(regionSizes), regionCount)) continue

    // Emit one clue per region: anchor = first (scan-order) cell of the region.
    const anchorCell = new Array(regionCount).fill(-1)
    for (let cell = 0; cell < total; cell++) {
      const rid = owner[cell]
      if (anchorCell[rid] === -1) anchorCell[rid] = cell
    }
    // Choose which regions become wildcards.
    const starIds = new Set()
    if (opts.stars) {
      const ids = [...Array(regionCount).keys()].sort(() => rng() - 0.5)
      for (const id of ids.slice(0, opts.stars)) starIds.add(id)
    }
    const clues = []
    for (let rid = 0; rid < regionCount; rid++) {
      const cell = anchorCell[rid]
      clues.push({ r: (cell / cols) | 0, c: cell % cols, size: starIds.has(rid) ? null : regionSizes[rid] })
    }

    const puzzle = { rows, cols, clues }
    const { solutions, nodesExceeded } = solve(puzzle, 2)
    if (nodesExceeded || solutions.length !== 1) continue

    // Success.
    console.log(`Generated a unique puzzle on attempt ${attempt}: ${regionCount} regions, ${starIds.size} wildcard(s).`)
    const json = toPuzzleJson(rows, cols, clues, opts.write)
    if (opts.write) {
      const file = path.join(OUT_DIR, `${opts.write}.json`)
      fs.writeFileSync(file, JSON.stringify(json, null, 2))
      console.log(`Wrote ${file}`)
      console.log(`NOTE: rebuild the puzzle index (dev server does this on save; else run scripts/build-index.js).`)
    } else {
      console.log(JSON.stringify(json, null, 2))
    }
    return
  }
  console.error(`No unique balance-colorable puzzle found in ${attempts} attempts. Try a different --seed, wider --min/--max, or fewer --stars.`)
  process.exit(1)
}

function toPuzzleJson(rows, cols, clues, id) {
  return {
    id: id || 'generated',
    title: '4-Color',
    authors: ['PmLemay'],
    specialRules: [
      'Each region contains exactly one clue indicating the number of cells in that region. (Stars * means any number)',
      'Each different color must have the same number of cells.',
    ],
    rules: [
      'Color each region so that no two adjacent regions share the same color.',
      'Use exactly 4 colors.',
      'All cells in a region must be the same color.',
    ],
    clues: [],
    difficulty: 'Medium',
    tags: ['4color'],
    autoCrossRules: [],
    clickActionRight: 'cross',
    gridSize: { rows, cols },
    cells: clues.map(cl => ({ row: cl.r, col: cl.c, fixedValue: cl.size == null ? '*' : String(cl.size) })),
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

// ─── CLI ────────────────────────────────────────────────────────

function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'check') {
    if (!rest[0]) { console.error('Usage: check <puzzle-id>'); process.exit(1) }
    analyze(rest[0])
  } else if (cmd === 'gen' || cmd === 'generate') {
    const rows = parseInt(rest[0], 10)
    const cols = parseInt(rest[1], 10)
    if (!rows || !cols) { console.error('Usage: gen <rows> <cols> [--min N --max N --stars N --attempts N --write <id> --seed N]'); process.exit(1) }
    const opts = {}
    for (let i = 2; i < rest.length; i++) {
      const a = rest[i]
      if (a === '--min') opts.min = parseInt(rest[++i], 10)
      else if (a === '--max') opts.max = parseInt(rest[++i], 10)
      else if (a === '--stars') opts.stars = parseInt(rest[++i], 10)
      else if (a === '--attempts') opts.attempts = parseInt(rest[++i], 10)
      else if (a === '--seed') opts.seed = parseInt(rest[++i], 10)
      else if (a === '--write') opts.write = rest[++i]
    }
    generate(rows, cols, opts)
  } else {
    console.log('Fillomino 4-Color tool')
    console.log('  node scripts/fillomino-4color.cjs check <puzzle-id>')
    console.log('  node scripts/fillomino-4color.cjs gen <rows> <cols> [--min N --max N --stars N --attempts N --write <id> --seed N]')
  }
}

if (require.main === module) main()

module.exports = { parsePuzzle, solve, canBalanceColor }
