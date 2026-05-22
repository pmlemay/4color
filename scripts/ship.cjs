#!/usr/bin/env node
// Commit + push pending puzzle/asset changes (if any), then deploy.
// Always runs deploy, even when there's nothing to commit, so gh-pages
// can't silently drift behind master.

const { execSync, spawnSync } = require('child_process')

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

// `git diff --quiet` exits 0 when no changes, 1 when there are changes.
const wdDirty = spawnSync('git', ['diff', '--quiet'], { stdio: 'ignore' }).status !== 0
const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' }).trim().length > 0

if (wdDirty || untracked) {
  run('git add -A')
  run('git commit -m "Update puzzles and assets"')
  run('git push')
} else {
  console.log('No changes to commit, skipping commit/push.')
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const r = spawnSync(npmCmd, ['run', 'deploy'], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
