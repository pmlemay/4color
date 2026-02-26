import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

function puzzleSavePlugin(): Plugin {
  return {
    name: 'puzzle-save',
    configureServer(server) {
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

            // Rebuild index
            const allFiles = readdirSync(puzzlesDir).filter(f => f.endsWith('.json') && f !== 'index.json')
            const index = allFiles.map(f => {
              const data = JSON.parse(readFileSync(join(puzzlesDir, f), 'utf-8'))
              const entry: Record<string, unknown> = {
                id: data.id, file: f, title: data.title, author: data.author, gridSize: data.gridSize,
              }
              if (data.difficulty) entry.difficulty = data.difficulty
              if (data.tags) entry.tags = data.tags
              return entry
            })
            index.sort((a: any, b: any) => {
              const sizeA = a.gridSize.rows * a.gridSize.cols
              const sizeB = b.gridSize.rows * b.gridSize.cols
              if (sizeA !== sizeB) return sizeA - sizeB
              return (a.difficulty || '').localeCompare(b.difficulty || '')
            })
            writeFileSync(join(puzzlesDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')

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

export default defineConfig({
  plugins: [react(), puzzleSavePlugin()],
  base: '/4color/',
})
