#!/usr/bin/env node
/**
 * Build script for game-icons.net icon library.
 *
 * Usage:
 *   node scripts/build-icons.js <path-to-cloned-game-icons-repo>
 *
 * Expects the repo from https://github.com/game-icons/icons.git
 * Processes SVGs to black-on-transparent and writes them to public/icons/.
 * Generates public/icons/index.json as the catalog.
 */

import fs from 'fs'
import path from 'path'

const repoPath = process.argv[2]
if (!repoPath) {
  console.error('Usage: node scripts/build-icons.js <path-to-game-icons-repo>')
  process.exit(1)
}

const resolvedRepo = path.resolve(repoPath)
if (!fs.existsSync(resolvedRepo)) {
  console.error(`Repo path not found: ${resolvedRepo}`)
  process.exit(1)
}

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

// Recursively find all .svg files
function walkSvgs(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkSvgs(full))
    } else if (entry.name.endsWith('.svg')) {
      results.push(full)
    }
  }
  return results
}

const svgFiles = walkSvgs(resolvedRepo)
console.log(`Found ${svgFiles.length} SVG files`)

const seen = new Map() // name -> source path (for dedup)
const index = []

for (const svgPath of svgFiles) {
  const name = path.basename(svgPath, '.svg')

  // Deduplicate by name — keep first encountered
  if (seen.has(name)) continue
  seen.set(name, svgPath)

  let content = fs.readFileSync(svgPath, 'utf-8')

  // Remove background rect (typically the first rect with fill="#000" that covers the whole viewBox)
  content = content.replace(/<rect[^>]*fill=["']#000["'][^>]*\/?\s*>/gi, '')

  // Recolor white fills to black (the actual icon paths)
  content = content.replace(/fill=["']#fff["']/gi, 'fill="#000"')
  content = content.replace(/fill=["']white["']/gi, 'fill="#000"')

  const outFile = `${name}.svg`
  fs.writeFileSync(path.join(outDir, outFile), content)

  index.push({ n: name, f: outFile })
}

// Sort alphabetically
index.sort((a, b) => a.n.localeCompare(b.n))

fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index))

console.log(`Wrote ${index.length} icons to ${outDir}`)
console.log(`Generated index.json with ${index.length} entries`)
