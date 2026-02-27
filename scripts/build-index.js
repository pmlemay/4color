import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const puzzlesDir = join(import.meta.dirname, '..', 'public', 'puzzles')
const files = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')

const index = files.map(f => {
  const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
  const entry = {
    id: data.id,
    file: f,
    title: data.title,
    author: data.author,
    gridSize: data.gridSize,
  }
  if (data.difficulty) entry.difficulty = data.difficulty
  if (data.tags) entry.tags = data.tags
  if (data.autoCrossRules?.length) entry.autoCrossRules = data.autoCrossRules
  if (data.forcedInputLayout) entry.forcedInputLayout = data.forcedInputLayout
  return entry
})

index.sort((a, b) => {
  const sizeA = a.gridSize.rows * a.gridSize.cols
  const sizeB = b.gridSize.rows * b.gridSize.cols
  if (sizeA !== sizeB) return sizeA - sizeB
  return (a.difficulty || '').localeCompare(b.difficulty || '')
})

writeFileSync(join(puzzlesDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`Built puzzle index: ${index.length} puzzle(s)`)
