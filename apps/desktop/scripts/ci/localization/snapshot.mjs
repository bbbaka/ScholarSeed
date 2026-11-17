/** Generate the portable localization ratchet from its exact historical commit. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DESKTOP } from './resources.mjs'
import { AUDITED_BASE, localizationCandidates, localizationRulesFingerprint } from './git.mjs'
import { scanSource } from './source.mjs'
import { readGitBlobs } from '../git.mjs'

const root = resolve(DESKTOP, '../..')
const prefix = 'apps/desktop/src'
const debt = 'apps/desktop/scripts/ci/localization/debt.json'
const originalDebt = execFileSync('git', ['ls-tree', '--name-only', AUDITED_BASE, '--', debt], { cwd: root, encoding: 'utf8' })
if (originalDebt.trim()) throw new Error('audited localization base unexpectedly contains a debt inventory')
const raw = execFileSync('git', ['ls-tree', '-r', '-z', AUDITED_BASE, '--', prefix], { cwd: root, encoding: 'utf8' })
const objects = new Map(raw.split('\0').filter(Boolean).map((entry) => {
  const at = entry.indexOf('\t')
  const metadata = entry.slice(0, at).split(' ')
  if (at < 0 || metadata[1] !== 'blob' || !/^[a-f0-9]{40}$/.test(metadata[2]))
    throw new Error('audited localization Git tree is invalid')
  return [entry.slice(at + 1), metadata[2]]
}))
const paths = localizationCandidates([...objects.keys()]).sort()
const blobs = readGitBlobs(paths.map(path => `${AUDITED_BASE}:${path}`), { root })
const files = Object.fromEntries(paths.map(path => [path, {
  blob: objects.get(path),
  identities: scanSource(blobs.get(`${AUDITED_BASE}:${path}`), path).map(hit => hit.identity),
}]))
const snapshot = `${JSON.stringify({ base: AUDITED_BASE, rules: localizationRulesFingerprint(), files })}\n`
writeFileSync(resolve(DESKTOP, 'scripts/ci/localization/baseline.json'), snapshot)
console.log(`audited localization snapshot sha256=${createHash('sha256').update(snapshot).digest('hex')} files=${paths.length}`)
