/**
 * Zero out completion times too small to have come from someone playing.
 * Usage: node scripts/zero-implausible-times.cjs [--apply] [threshold-ms]
 *
 * Lists what it would change by default; --apply performs the writes.
 *
 * A time under a second was recorded by a bug: a grid restored from a previous
 * session could satisfy the validator the moment its solution file arrived,
 * seconds after the timer had restarted from zero. Zero is the app's
 * "completed, time unknown" — the solve still counts and the puzzle
 * leaderboard lists the player last rather than first.
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service
 *           account key JSON, or a GCP environment with access.
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const apply = process.argv.includes('--apply')
const threshold = Number(process.argv.find(a => /^\d+$/.test(a))) || 1000

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (serviceAccount) {
  initializeApp({ credential: cert(require(serviceAccount)) })
} else {
  initializeApp({ projectId: 'color-73b3e' })
}

const db = getFirestore()

async function main() {
  const snapshot = await db.collection('completions_index').get()
  let changed = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const times = data.times || {}
    const bogus = Object.entries(times).filter(([, ms]) => typeof ms === 'number' && ms > 0 && ms < threshold)
    if (bogus.length === 0) continue

    for (const [puzzleId, ms] of bogus) {
      console.log(`  ${data.displayName || 'unknown'}: ${puzzleId} = ${ms} ms -> 0`)
      changed++
    }
    if (apply) {
      // `count` is unchanged: the entry stays, so the solve still counts.
      await doc.ref.update(Object.fromEntries(bogus.map(([puzzleId]) => [`times.${puzzleId}`, 0])))
    }
  }

  console.log(
    changed === 0
      ? `\nNothing under ${threshold} ms.`
      : apply
        ? `\nDone. Zeroed ${changed} time(s) under ${threshold} ms.`
        : `\n${changed} time(s) under ${threshold} ms. Re-run with --apply to write.`
  )
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
