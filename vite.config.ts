import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readdirSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

function rebuildPuzzleIndex(writeVersion = true) {
  const puzzlesDir = join(__dirname, 'public', 'puzzles')
  const files = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')
  const index = files.map(f => {
    const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
    const entry: Record<string, unknown> = {
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
    const thumbDir = join(puzzlesDir, 'thumbnails')
    const thumbPath = join(thumbDir, `${safeId}.png`)
    if (existsSync(thumbPath)) {
      entry.thumbnail = `thumbnails/${safeId}.png`
    }
    return entry
  })
  index.sort((a: any, b: any) => {
    const sizeA = a.gridSize.rows * a.gridSize.cols
    const sizeB = b.gridSize.rows * b.gridSize.cols
    if (sizeA !== sizeB) return sizeA - sizeB
    return (a.difficulty || '').localeCompare(b.difficulty || '')
  })
  writeFileSync(join(puzzlesDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')

  if (writeVersion) {
    const publicDir = join(__dirname, 'public')
    writeFileSync(join(publicDir, 'version.json'), JSON.stringify({ buildTime: Date.now() }) + '\n')
  }
}

function puzzleSavePlugin(): Plugin {
  return {
    name: 'puzzle-save',
    buildStart() {
      rebuildPuzzleIndex()
    },
    configureServer(server) {
      // Serve puzzle JSON files directly from disk so newly added files work without restart
      // Serve puzzle and solution JSON from disk with no-cache so newly saved files are available immediately
      // Serve thumbnail PNGs from disk (directory may be created after server start)
      server.middlewares.use((req, res, next) => {
        const thumbMatch = req.url?.match(/^(?:\/4color)?\/puzzles\/thumbnails\/([^/]+\.png)$/)
        if (thumbMatch) {
          const filePath = join(__dirname, 'public', 'puzzles', 'thumbnails', thumbMatch[1])
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Cache-Control', 'no-cache, no-store')
            res.end(readFileSync(filePath))
            return
          }
        }
        next()
      })

      server.middlewares.use((req, res, next) => {
        // Match /puzzles/*.json or /4color/puzzles/*.json
        const puzzleMatch = req.url?.match(/^(?:\/4color)?\/puzzles\/([^/.]+\.json)$/)
        if (puzzleMatch) {
          const relPath = puzzleMatch[1]
          const filePath = join(__dirname, 'public', 'puzzles', relPath)
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-cache, no-store')
            res.end(readFileSync(filePath, 'utf-8'))
            return
          }
          // Check solutions subdirectory
          const solPath = join(__dirname, 'public', 'puzzles', 'solutions', relPath)
          if (existsSync(solPath)) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-cache, no-store')
            res.end(readFileSync(solPath, 'utf-8'))
            return
          }
        }
        const solMatch = req.url?.match(/^(?:\/4color)?\/puzzles\/solutions\/([^/.]+\.json)$/)
        if (solMatch) {
          const relPath = solMatch[1]
          const filePath = join(__dirname, 'public', 'puzzles', 'solutions', relPath)
          if (existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-cache, no-store')
            res.end(readFileSync(filePath, 'utf-8'))
            return
          }
        }
        next()
      })

      server.middlewares.use('/api/save-puzzle', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const puzzle = JSON.parse(body)
            const puzzlesDir = join(__dirname, 'public', 'puzzles')

            // Sanitize puzzle id to prevent path traversal
            const safeId = String(puzzle.id).replace(/[^a-z0-9_-]/gi, '_')
            if (!safeId) { res.statusCode = 400; res.end('Invalid puzzle id'); return }

            // Find existing file for this puzzle id, or use id as filename
            const files = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')
            let targetFile = `${safeId}.json`
            for (const f of files) {
              const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
              if (data.id === puzzle.id) {
                targetFile = f
                break
              }
            }

            writeFileSync(join(puzzlesDir, targetFile), JSON.stringify(puzzle, null, 2) + '\n')

            // Rebuild index (skip version.json to avoid triggering reload)
            rebuildPuzzleIndex(false)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: targetFile }))
          } catch (e: unknown) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })

      server.middlewares.use('/api/save-thumbnail', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { id, dataUrl } = JSON.parse(body)
            const safeId = String(id).replace(/[^a-z0-9_-]/gi, '_')
            if (!safeId) { res.statusCode = 400; res.end('Invalid id'); return }
            const dir = join(__dirname, 'public', 'puzzles', 'thumbnails')
            mkdirSync(dir, { recursive: true })
            // dataUrl is "data:image/png;base64,..."
            const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
            const buf = Buffer.from(base64, 'base64')
            const targetFile = `${safeId}.png`
            writeFileSync(join(dir, targetFile), buf)
            // Rebuild index to pick up the new thumbnail
            rebuildPuzzleIndex(false)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: targetFile }))
          } catch (e: unknown) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })

      server.middlewares.use('/api/save-solution', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const solution = JSON.parse(body)
            const safeId = String(solution.id).replace(/[^a-z0-9_-]/gi, '_')
            if (!safeId) { res.statusCode = 400; res.end('Invalid id'); return }
            const dir = join(__dirname, 'public', 'puzzles', 'solutions')
            mkdirSync(dir, { recursive: true })
            const targetFile = `${safeId}-solution.json`
            writeFileSync(join(dir, targetFile), JSON.stringify(solution, null, 2) + '\n')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: targetFile }))
          } catch (e: unknown) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), puzzleSavePlugin()],
  base: command === 'serve' ? '/' : '/4color/',
  server: {
    watch: {
      // Ignore public/puzzles so saving puzzles via API doesn't trigger page reloads
      ignored: ['**/public/puzzles/**', '**/public/version.json'],
    },
  },
}))
