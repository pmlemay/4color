import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const puzzlesDir = join(import.meta.dirname, '..', 'public', 'puzzles')
const thumbDir = join(puzzlesDir, 'thumbnails')
const files = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')

let skipped = 0
const index = files.map(f => {
  const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
  if (data.inProgress) skipped++
  const entry = {
    id: data.id,
    file: f,
    title: data.title,
    authors: data.authors || (data.author ? [data.author] : []),
    gridSize: data.gridSize,
  }
  if (data.difficulty) entry.difficulty = data.difficulty
  if (data.tags) entry.tags = data.tags
  if (data.autoCrossRules?.length) entry.autoCrossRules = data.autoCrossRules
  if (data.puzzleType) entry.puzzleType = data.puzzleType
  else if (data.forcedInputLayout) entry.puzzleType = data.forcedInputLayout
  if (data.clickActionLeft) entry.clickActionLeft = data.clickActionLeft
  if (data.clickActionRight) entry.clickActionRight = data.clickActionRight
  if (data.inProgress) entry.inProgress = true
  // Check for captured thumbnail PNG
  const safeId = String(data.id).replace(/[^a-z0-9_-]/gi, '_')
  const thumbPath = join(thumbDir, `${safeId}.png`)
  if (existsSync(thumbPath)) {
    entry.thumbnail = `thumbnails/${safeId}.png`
  }
  return entry
})

index.sort((a, b) => {
  const sizeA = a.gridSize.rows * a.gridSize.cols
  const sizeB = b.gridSize.rows * b.gridSize.cols
  if (sizeA !== sizeB) return sizeA - sizeB
  return (a.difficulty || '').localeCompare(b.difficulty || '')
})

writeFileSync(join(puzzlesDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`Built puzzle index: ${index.length} puzzle(s)` + (skipped ? ` (${skipped} in-progress)` : ''))

// Write version.json for auto-update detection
const publicDir = join(import.meta.dirname, '..', 'public')
const version = { buildTime: Date.now() }
writeFileSync(join(publicDir, 'version.json'), JSON.stringify(version) + '\n')
console.log(`Wrote version.json: ${version.buildTime}`)
