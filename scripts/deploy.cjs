#!/usr/bin/env node
// Deploy dist/ to gh-pages branch.
// Uses a temp directory to avoid ENAMETOOLONG on Windows
// (the gh-pages npm package can't handle 4000+ icon files).

const { execSync } = require('child_process')
const { mkdtempSync, cpSync, writeFileSync } = require('fs')
const { join } = require('path')
const os = require('os')

const distDir = join(__dirname, '..', 'dist').replace(/\\/g, '/')

// Get remote URL from current repo
const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim()

const tmpDir = mkdtempSync(join(os.tmpdir(), 'gh-pages-')).replace(/\\/g, '/')

console.log(`Deploying to ${remote} (gh-pages branch)...`)
console.log(`Using temp dir: ${tmpDir}`)

try {
  const run = (cmd) => execSync(cmd, { cwd: tmpDir, stdio: 'inherit' })
  run('git init')
  run('git checkout -b gh-pages')
  cpSync(join(__dirname, '..', 'dist'), tmpDir, { recursive: true })
  // .nojekyll prevents GitHub Pages from ignoring files starting with _
  writeFileSync(join(tmpDir, '.nojekyll'), '')
  run('git add -A')
  run('git commit -m "Deploy"')
  run(`git remote add origin ${remote}`)
  run('git push origin gh-pages --force')
  console.log('\nDeploy complete!')
} catch (e) {
  console.error('Deploy failed:', e.message)
  process.exit(1)
}
