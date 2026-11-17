/** Generate a portable visual ratchet from the exact audited Git commit. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readGitBlobs } from './git.mjs'
import { VISUAL_BASE, visualCandidates, visualFindings, visualRulesFingerprint } from './visual.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const prefix = 'apps/desktop/src/renderer/src/'
const raw = execFileSync('git', ['ls-tree', '-r', '-z', VISUAL_BASE, '--', prefix], { cwd: root, encoding: 'utf8' })
const objects = new Map(raw.split('\0').filter(Boolean).map((entry) => {
  const at = entry.indexOf('\t')
  const metadata = entry.slice(0, at).split(' ')
  if (at < 0 || metadata[1] !== 'blob' || !/^[a-f0-9]{40}$/.test(metadata[2]))
    throw new Error('audited visual Git tree is invalid')
  return [entry.slice(at + 1), metadata[2]]
}))
const paths = visualCandidates([...objects.keys()])
const blobs = readGitBlobs(paths.map(path => `${VISUAL_BASE}:${path}`), { root })
const files = Object.fromEntries(paths.map((path) => [path, {
  blob: objects.get(path),
  identities: visualFindings(blobs.get(`${VISUAL_BASE}:${path}`), path).map(hit => hit.identity),
}]))
const snapshot = `${JSON.stringify({ base: VISUAL_BASE, rules: visualRulesFingerprint(), files })}\n`
const destination = resolve(dirname(fileURLToPath(import.meta.url)), 'visualbaseline.json')
writeFileSync(destination, snapshot)
console.log(`audited visual snapshot sha256=${createHash('sha256').update(snapshot).digest('hex')} files=${paths.length}`)
