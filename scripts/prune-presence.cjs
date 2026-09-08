#!/usr/bin/env node
// Deletes stale `presence` docs. Stands in for a Firestore TTL policy, which
// needs the Blaze plan — this does the same job on the free tier, on demand.
//
// Stale docs are harmless for reads (useActivePlayers filters server-side, and
// Firestore bills range queries by results, not collection size), so this is
// housekeeping: run it whenever, or before a deploy.
//
// Usage:
//   node scripts/prune-presence.cjs            # delete presence older than 1h
//   node scripts/prune-presence.cjs --dry-run  # report only, delete nothing
//   node scripts/prune-presence.cjs --hours 24 # a different staleness cutoff

const path = require('path')
const admin = require('firebase-admin')

const cred = require(path.join(__dirname, '..', 'firebase.serviceaccount.json'))

const dryRun = process.argv.includes('--dry-run')
const hoursArg = process.argv.indexOf('--hours')
const hours = hoursArg !== -1 ? Number(process.argv[hoursArg + 1]) || 1 : 1

const BATCH_SIZE = 400

admin.initializeApp({ credential: admin.credential.cert(cred) })
const db = admin.firestore()

;(async () => {
  const presence = db.collection('presence')
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - hours * 60 * 60_000)

  const before = (await presence.count().get()).data().count
  const stale = await presence.where('lastSeen', '<', cutoff).get()

  console.log(`presence docs      : ${before}`)
  console.log(`older than ${hours}h     : ${stale.size}`)

  if (stale.size === 0) {
    console.log('nothing to prune.')
    return
  }
  if (dryRun) {
    console.log('--dry-run: nothing deleted.')
    return
  }

  let deleted = 0
  for (let i = 0; i < stale.docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of stale.docs.slice(i, i + BATCH_SIZE)) batch.delete(doc.ref)
    await batch.commit()
    deleted += Math.min(BATCH_SIZE, stale.docs.length - i)
    console.log(`  deleted ${deleted}/${stale.size}`)
  }

  const after = (await presence.count().get()).data().count
  console.log(`presence docs now  : ${after}`)
})()
  .then(() => process.exit(0))
  .catch(e => { console.error('prune failed:', e.message); process.exit(1) })
