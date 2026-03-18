#!/usr/bin/env node
/**
 * Capture thumbnails for all puzzles by visiting each puzzle page
 * in a headless browser while the dev server is running.
 *
 * Usage:
 *   1. Start the dev server:  npx vite dev --port 5173
 *   2. In another terminal:   node scripts/capture-thumbnails.mjs
 *
 * Or run both automatically:  node scripts/capture-thumbnails.mjs --start-server
 */

import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'
import { execSync, spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const puzzlesDir = join(__dirname, '..', 'public', 'puzzles')
const thumbDir = join(puzzlesDir, 'thumbnails')
const BASE = 'http://localhost:5173'
const WAIT_MS = 3000 // time to wait for grid + capture

const forceAll = process.argv.includes('--force')
const startServer = process.argv.includes('--start-server')

// Gather puzzle IDs
const files = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')
const puzzleIds = files.map(f => {
  const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
  return data.id
}).filter(Boolean)

// Filter to only puzzles missing thumbnails (unless --force)
const needed = forceAll
  ? puzzleIds
  : puzzleIds.filter(id => {
      const safeId = id.replace(/[^a-z0-9_-]/gi, '_')
      return !existsSync(join(thumbDir, `${safeId}.png`))
    })

if (needed.length === 0) {
  console.log('All thumbnails already exist. Use --force to regenerate.')
  process.exit(0)
}

console.log(`Capturing ${needed.length} thumbnail(s)...`)

let serverProc = null

async function checkServer() {
  try {
    const res = await fetch(BASE)
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  // Optionally start dev server
  if (startServer) {
    const running = await checkServer()
    if (!running) {
      console.log('Starting dev server...')
      serverProc = spawn('npx', ['vite', 'dev', '--port', '5173'], {
        cwd: join(__dirname, '..'),
        stdio: 'ignore',
        shell: true,
      })
      // Wait for server to be ready
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000))
        if (await checkServer()) break
      }
      if (!await checkServer()) {
        console.error('Dev server failed to start')
        process.exit(1)
      }
      console.log('Dev server ready.')
    }
  }

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  for (let i = 0; i < needed.length; i++) {
    const id = needed[i]
    const url = `${BASE}/play/${id}`
    process.stdout.write(`  [${i + 1}/${needed.length}] ${id}...`)
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
      // Wait for the grid to render and the capture to fire
      await new Promise(r => setTimeout(r, WAIT_MS))
      const safeId = id.replace(/[^a-z0-9_-]/gi, '_')
      const exists = existsSync(join(thumbDir, `${safeId}.png`))
      console.log(exists ? ' OK' : ' (no file created)')
    } catch (e) {
      console.log(` ERROR: ${e.message}`)
    }
  }

  await browser.close()

  if (serverProc) {
    serverProc.kill()
    // Also kill any lingering node processes from the vite server
    try { execSync('taskkill /F /IM node.exe 2>NUL', { stdio: 'ignore' }) } catch {}
  }

  console.log('Done! Thumbnails saved to public/puzzles/thumbnails/')
  console.log('Restart the dev server or rebuild to update the index.')
}

main().catch(e => {
  console.error(e)
  if (serverProc) serverProc.kill()
  process.exit(1)
})
