/**
 * Remove a puzzle's completion data from all users in Firestore.
 * Usage: node scripts/remove-puzzle-completions.cjs <puzzle-id>
 *
 * Requires: npm install firebase-admin (one-time)
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key JSON,
 *           or run from a GCP environment with appropriate permissions.
 *
 * Alternative: use the Firebase console to manually delete fields.
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const puzzleId = process.argv[2]
if (!puzzleId) {
  console.error('Usage: node scripts/remove-puzzle-completions.cjs <puzzle-id>')
  process.exit(1)
}

// Initialize with default credentials or service account
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (serviceAccount) {
  initializeApp({ credential: cert(require(serviceAccount)) })
} else {
  initializeApp({ projectId: 'color-73b3e' })
}

const db = getFirestore()

async function main() {
  const collection = db.collection('completions_index')
  const snapshot = await collection.get()

  let updated = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const times = data.times || {}

    if (puzzleId in times) {
      const newCount = Object.keys(times).length - 1
      await doc.ref.update({
        [`times.${puzzleId}`]: FieldValue.delete(),
        count: newCount,
      })
      updated++
      console.log(`  Removed from user ${doc.id} (${data.displayName || 'unknown'})`)
    } else {
      skipped++
    }
  }

  console.log(`\nDone. Removed "${puzzleId}" from ${updated} user(s), ${skipped} had no entry.`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
