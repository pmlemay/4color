#!/usr/bin/env node
// Deploy dist/ to gh-pages branch.
//
// Clones the current gh-pages branch into a temp dir, wipes its working tree,
// then copies dist/ in. Git uploads only the blobs that actually changed, so the
// 4k icon files cost upload time once instead of on every deploy.
//
// The wipe is what keeps this safe: the pushed tree is always exactly dist/, so
// a changed file always gets pushed and a deleted file is really gone. This is
// not the stale-delta trap the gh-pages npm package falls into — that package
// reuses a persistent clone under node_modules/.cache and silently skips files
// when it desyncs. Here the clone is fresh every run, and git decides what
// changed by hashing content, never by timestamp or size.
//
// Pass --fresh to skip the clone and force-push an orphan commit instead (the
// old behavior) — a full re-upload of everything, if you ever want certainty.

const { execSync } = require('child_process')
const { mkdtempSync, cpSync, writeFileSync, readdirSync, rmSync } = require('fs')
const { join } = require('path')
const os = require('os')

const fresh = process.argv.includes('--fresh')
const distDir = join(__dirname, '..', 'dist')

// Get remote URL from current repo
const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim()

const tmpDir = mkdtempSync(join(os.tmpdir(), 'gh-pages-')).replace(/\\/g, '/')

console.log(`Deploying to ${remote} (gh-pages branch)...`)
console.log(`Using temp dir: ${tmpDir}`)

try {
  const run = (cmd) => execSync(cmd, { cwd: tmpDir, stdio: 'inherit' })
  const capture = (cmd) => execSync(cmd, { cwd: tmpDir, encoding: 'utf-8' })

  let cloned = false
  if (fresh) {
    console.log('--fresh: rebuilding the branch from scratch, full re-upload.')
  } else {
    try {
      run(`git clone --branch gh-pages --single-branch --depth 1 ${remote} .`)
      cloned = true
    } catch {
      console.log('Could not clone gh-pages — starting a new branch instead.')
    }
  }

  if (!cloned) {
    run('git init')
    run('git checkout -b gh-pages')
    run(`git remote add origin ${remote}`)
  }

  // Drop the previous deploy's files so the commit mirrors dist/ exactly.
  // Without this, anything removed from dist/ would linger on the branch.
  for (const entry of readdirSync(tmpDir)) {
    if (entry === '.git') continue
    rmSync(join(tmpDir, entry), { recursive: true, force: true })
  }

  cpSync(distDir, tmpDir, { recursive: true })
  // .nojekyll prevents GitHub Pages from ignoring files starting with _
  writeFileSync(join(tmpDir, '.nojekyll'), '')

  run('git add -A')

  if (cloned) {
    const changed = capture('git diff --cached --name-only').split('\n').filter(Boolean)
    if (changed.length === 0) {
      console.log('\nNothing changed since the last deploy — nothing to push.')
      process.exit(0)
    }
    console.log(`\n${changed.length} file(s) changed:`)
    for (const file of changed.slice(0, 25)) console.log(`  ${file}`)
    if (changed.length > 25) console.log(`  ...and ${changed.length - 25} more`)
    console.log('')
  }

  run('git commit -m "Deploy"')
  run(cloned ? 'git push origin gh-pages' : 'git push origin gh-pages --force')
  console.log('\nDeploy complete!')
} catch (e) {
  console.error('Deploy failed:', e.message)
  process.exit(1)
} finally {
  // Each run clones the branch now, so leaving temp dirs behind adds up.
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    console.log(`(Could not clean up ${tmpDir})`)
  }
}
