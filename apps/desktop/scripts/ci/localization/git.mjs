import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { DESKTOP } from './resources.mjs'
import { scanSource, newFindings } from './source.mjs'
import { readGitBlobs } from '../git.mjs'
import ts from 'typescript'

export const DEBT_PATH = resolve(DESKTOP, 'scripts/ci/localization/debt.json')
const ROOT = resolve(DESKTOP, '../..')
const PREFIX = 'apps/desktop/'
const SOURCE = /^apps\/desktop\/src\/(?:main|preload|renderer\/src)\/.*\.[jt]sx?$/
// Tests are executable fixtures; UI source itself is never excluded wholesale.
const FIXTURE = /(?:\.test\.|\.fixture\.|\.d\.ts$)/
export const AUDITED_BASE = '405f3f60ee6413b5a8cfc1fffb8f623a42282b54'
const SNAPSHOT_PATH = resolve(DESKTOP, 'scripts/ci/localization/baseline.json')
const SNAPSHOT_SHA256 = '1b06c123025feb4e46b8cfb6b4e5b9882b311613511ceb10b264e3019834a8e3'
function git(args, root = ROOT) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }) }
export function resolveBase(ref, root = ROOT) {
  if (!ref) throw new Error('Missing Git comparison base; supply --base <ref> or I18N_BASE_REF')
  return git(['rev-parse', '--verify', `${ref}^{commit}`], root).trim()
}
function tracked(base, root = ROOT) { return git(['ls-tree', '-r', '--name-only', '-z', base, '--', PREFIX + 'src'], root).split('\0').filter(Boolean) }
export function localizationCandidates(paths) { return paths.filter((path) => SOURCE.test(path) && !FIXTURE.test(path)) }
function at(base, path, root = ROOT) { return git(['show', `${base}:${path}`], root) }

/** A checked-in debt inventory can only shrink, even if its claimed base changes. */
export function checkDebt(debt, previous) {
  if (debt.version !== 1 || !debt.baseCommit || !debt.files || typeof debt.files !== 'object') return ['Invalid localization debt inventory']
  if (!previous) return []
  const errors = []
  for (const [path, rows] of Object.entries(debt.files)) {
    const remaining = new Map()
    for (const row of previous.files[path] ?? []) remaining.set(row.identity, (remaining.get(row.identity) ?? 0) + 1)
    for (const row of rows) {
      const count = remaining.get(row.identity) ?? 0
      if (!count) errors.push(`${path}: localization debt must not expand (${row.kind}: ${row.text})`)
      else remaining.set(row.identity, count - 1)
    }
  }
  return errors
}

export function generateDebt(ref, { tighten = false, root = ROOT, debtPath = DEBT_PATH } = {}) {
  const base = resolveBase(ref, root)
  const previous = existsSync(debtPath) ? JSON.parse(readFileSync(debtPath, 'utf8')) : undefined
  if (previous && !tighten) throw new Error('Debt already exists; only explicit --tighten may remove debt')
  const files = {}
  for (const path of localizationCandidates(tracked(base, root))) {
    const rows = scanSource(at(base, path, root), path)
    if (!rows.length) continue
    if (previous) {
      const allowed = previous.files[path] ?? []
      const remaining = new Map()
      for (const row of allowed) remaining.set(row.identity, (remaining.get(row.identity) ?? 0) + 1)
      const retained = rows.filter((row) => {
        const count = remaining.get(row.identity) ?? 0
        if (!count) return false
        remaining.set(row.identity, count - 1)
        return true
      })
      if (retained.length) files[path] = retained
    } else files[path] = rows
  }
  const output = { version: 1, baseCommit: base, policy: 'Exact AST owner/kind/text identity; no new debt. Tests are fixtures. Review human-visible semantics separately.', files }
  writeFileSync(debtPath, JSON.stringify(output, null, 2) + '\n')
  return output
}

/** A portable baseline remains valid only for the detector that produced it. */
export function localizationRulesFingerprint() {
  const source = readFileSync(resolve(DESKTOP, 'scripts/ci/localization/source.mjs'), 'utf8').replaceAll('\r\n', '\n')
  return createHash('sha256').update(source).update(String(SOURCE)).update(String(FIXTURE))
    .update(localizationCandidates.toString()).update(ts.version).digest('hex')
}

export function checkSnapshot({ root, debtPath, debt }) {
  const raw = readFileSync(SNAPSHOT_PATH, 'utf8').replaceAll('\r\n', '\n')
  if (createHash('sha256').update(raw).digest('hex') !== SNAPSHOT_SHA256)
    throw new Error('audited localization snapshot integrity check failed')
  const snapshot = JSON.parse(raw)
  if (snapshot.base !== AUDITED_BASE || snapshot.rules !== localizationRulesFingerprint() ||
      !snapshot.files || typeof snapshot.files !== 'object' || Array.isArray(snapshot.files))
    throw new Error('audited localization snapshot does not match the baseline and detector')
  const errors = checkDebt(debt, undefined)
  const debtRelative = relative(root, debtPath).split('\\').join('/')
  const indexedDebt = git(['ls-files', '--cached', '--', debtRelative], root).trim() === debtRelative
  if (indexedDebt) errors.push(...checkDebt(JSON.parse(at('', debtRelative, root)), undefined).map(error => `${error} [index]`))
  const entries = git(['ls-files', '--stage', '-z', '--', PREFIX + 'src'], root).split('\0').filter(Boolean)
  const index = new Map()
  for (const entry of entries) {
    const match = /^(\d+) ([a-f0-9]{40}) (\d)\t([\s\S]+)$/.exec(entry)
    if (!match || match[3] !== '0') throw new Error('localization gate requires a resolved Git index')
    index.set(match[4], match[2])
  }
  const current = localizationCandidates(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', PREFIX + 'src'], root).split('\0').filter(Boolean))
  const staged = localizationCandidates([...index.keys()])
  const blobs = readGitBlobs(staged.map(path => `:${path}`), { root })
  for (const path of new Set([...current, ...staged])) {
    const previous = (snapshot.files[path]?.identities ?? []).map(identity => ({ identity }))
    const surfaces = []
    const absolute = resolve(root, path)
    if (existsSync(absolute)) surfaces.push(['worktree', readFileSync(absolute, 'utf8')])
    if (blobs.has(`:${path}`)) surfaces.push(['index', blobs.get(`:${path}`)])
    const reported = new Set()
    for (const [surface, source] of surfaces) {
      for (const hit of newFindings(scanSource(source, path), previous, debt.files[path] ?? [])) {
        const signature = `${hit.identity}:${hit.line}`
        if (reported.has(signature)) continue
        reported.add(signature)
        errors.push(`${path}:${hit.line}: ${hit.kind}: ${hit.text} [${surface}]`)
      }
    }
  }
  return { base: AUDITED_BASE, errors }
}

export function checkSources(ref, { root = ROOT, debtPath = DEBT_PATH } = {}) {
  const debt = JSON.parse(readFileSync(debtPath, 'utf8'))
  const selected = ref ?? process.env.I18N_BASE_REF ?? debt.baseCommit
  let base
  try {
    execFileSync('git', ['cat-file', '-e', `${selected}^{commit}`], { cwd: root, stdio: 'pipe' })
    base = resolveBase(selected, root)
  } catch (error) {
    if (ref !== undefined || process.env.I18N_BASE_REF || selected !== AUDITED_BASE || error.status !== 128) throw error
    return checkSnapshot({ root, debtPath, debt })
  }
  const debtRelative = relative(root, debtPath).split('\\').join('/')
  const hasBaseDebt = git(['ls-tree', '--name-only', base, '--', debtRelative], root).trim() === debtRelative
  const originalDebt = hasBaseDebt ? JSON.parse(at(base, debtRelative, root)) : undefined
  const errors = checkDebt(debt, originalDebt)
  const indexedDebt = git(['ls-files', '--cached', '--', debtRelative], root).trim() === debtRelative
  if (indexedDebt) errors.push(...checkDebt(JSON.parse(at('', debtRelative, root)), originalDebt).map((error) => `${error} [index]`))
  const baseFiles = new Set(tracked(base, root))
  // Inspect the index separately: an unstaged correction must not hide staged debt.
  const stagedFiles = new Set(localizationCandidates(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', base, '--', PREFIX + 'src'], root).split('\0').filter(Boolean)))
  const currentFiles = localizationCandidates(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', PREFIX + 'src'], root).split('\0').filter(Boolean))
  const paths = [...new Set([...currentFiles, ...stagedFiles])]
  const blobs = readGitBlobs(paths.flatMap((path) => [
    ...(baseFiles.has(path) ? [`${base}:${path}`] : []),
    ...(stagedFiles.has(path) ? [`:${path}`] : []),
  ]), { root })
  for (const path of paths) {
    const absolute = resolve(root, path)
    const previous = baseFiles.has(path) ? scanSource(blobs.get(`${base}:${path}`), path) : []
    const snapshots = []
    if (existsSync(absolute)) snapshots.push(['worktree', readFileSync(absolute, 'utf8')])
    if (stagedFiles.has(path)) snapshots.push(['index', blobs.get(`:${path}`)])
    const reported = new Set()
    for (const [surface, source] of snapshots) {
      for (const hit of newFindings(scanSource(source, path), previous, debt.files[path] ?? [])) {
        const signature = `${hit.identity}:${hit.line}`
        if (reported.has(signature)) continue
        reported.add(signature)
        errors.push(`${path}:${hit.line}: ${hit.kind}: ${hit.text} [${surface}]`)
      }
    }
  }
  return { base, errors }
}
