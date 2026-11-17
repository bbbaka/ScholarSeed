import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSources, generateDebt } from '../git.mjs'

test('audited localization budget works without historical Git objects and still blocks staged debt', () => {
  const root = mkdtempSync(join(tmpdir(), 'scholarseed-i18n-portable-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  const dir = join(root, 'apps/desktop/src/renderer/src')
  const file = join(dir, 'PortableFixture.tsx')
  const options = { root, debtPath: join(root, 'debt.json') }
  const previous = process.env.I18N_BASE_REF
  try {
    delete process.env.I18N_BASE_REF
    mkdirSync(dir, { recursive: true })
    git('init', '-q')
    writeFileSync(options.debtPath, JSON.stringify({ version: 1, baseCommit: '405f3f60ee6413b5a8cfc1fffb8f623a42282b54', files: {} }))
    writeFileSync(file, 'export const Page=()=> <div />')
    git('add', 'apps')
    assert.deepEqual(checkSources(undefined, options).errors, [])
    writeFileSync(file, 'export const Page=()=> <div>New text</div>')
    assert.match(checkSources(undefined, options).errors.join(), /New text \[worktree\]/)
    git('add', 'apps')
    writeFileSync(file, 'export const Page=()=> <div />')
    assert.match(checkSources(undefined, options).errors.join(), /New text \[index\]/)
    git('add', file)
    const legacy = join(root, 'apps/desktop/src/main/appsForFile.ts')
    mkdirSync(join(root, 'apps/desktop/src/main'), { recursive: true })
    const legacyPath = 'apps/desktop/src/main/appsForFile.ts'
    writeFileSync(options.debtPath, JSON.stringify({ version: 1, baseCommit: '405f3f60ee6413b5a8cfc1fffb8f623a42282b54', files: {
      [legacyPath]: [{ identity: '0c6a84cdd20119edd452859e7f4346c401d433c2cc5b0f27331dc354286bd7fe' }],
    } }))
    writeFileSync(legacy, 'function openPathWith(){ return {error: `open exited ${code}`} }')
    assert.deepEqual(checkSources(undefined, options).errors, [])
    writeFileSync(legacy, 'function openPathWith(){ return [{error: `open exited ${code}`},{error: `open exited ${code}`}] }')
    assert.equal(checkSources(undefined, options).errors.length, 1)
    assert.throws(() => checkSources('missing-base', options))
  } finally {
    if (previous === undefined) delete process.env.I18N_BASE_REF
    else process.env.I18N_BASE_REF = previous
    rmSync(root, { recursive: true, force: true })
  }
})

test('real Git fixture covers staged, unstaged, untracked, missing refs and debt tightening', () => {
  const root = mkdtempSync(join(tmpdir(), 'scholarseed-i18n-git-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const dir = join(root, 'apps/desktop/src/renderer/src')
  const file = join(dir, 'Page.tsx')
  const options = { root, debtPath: join(root, 'debt.json') }
  try {
    mkdirSync(dir, { recursive: true })
    git('init', '-q'); git('config', 'user.name', 'Contract Fixture'); git('config', 'user.email', 'fixture@example.invalid')
    writeFileSync(file, 'export const Page=()=> <div>Old</div>')
    git('add', '.'); git('commit', '-qm', 'fixture baseline')
    generateDebt(git('rev-parse', 'HEAD'), options)
    git('add', 'debt.json'); git('commit', '-qm', 'fixture reviewed debt')
    const base = git('rev-parse', 'HEAD')
    assert.deepEqual(checkSources(base, options).errors, [])
    const reviewedDebt = readFileSync(options.debtPath, 'utf8')
    const widened = JSON.parse(reviewedDebt)
    const path = Object.keys(widened.files)[0]
    widened.files[path].push(widened.files[path][0])
    widened.baseCommit = base
    writeFileSync(options.debtPath, JSON.stringify(widened))
    assert.match(checkSources(base, options).errors.join(), /debt must not expand/)
    git('add', 'debt.json')
    writeFileSync(options.debtPath, reviewedDebt)
    assert.match(checkSources(base, options).errors.join(), /debt must not expand.*\[index\]/)
    git('add', 'debt.json')
    writeFileSync(file, '\n\nexport const Page=()=> <div>Old</div>')
    assert.deepEqual(checkSources(base, options).errors, [])
    writeFileSync(file, 'export const Page=()=> <div>New</div>')
    assert.equal(checkSources(base, options).errors.length, 1)
    git('add', file)
    assert.equal(checkSources(base, options).errors.length, 1)
    writeFileSync(file, 'export const Page=()=> <div>Old</div>')
    assert.match(checkSources(base, options).errors.join(), /New \[index\]/)
    rmSync(file)
    assert.match(checkSources(base, options).errors.join(), /New \[index\]/)
    writeFileSync(file, 'export const Page=()=> <div>New</div>')
    writeFileSync(join(dir, 'New.tsx'), 'export const Added=()=> <div>中文</div>')
    assert.equal(checkSources(base, options).errors.length, 2)
    assert.throws(() => checkSources('missing-base', options))
    assert.throws(() => generateDebt(base, options), /already exists/)
    // Tightening cannot bless a replacement hardcoded message or duplicate occurrences.
    git('add', 'apps'); git('commit', '-qm', 'fixture changed')
    const tightened = generateDebt('HEAD', { ...options, tighten: true })
    assert.equal(Object.keys(tightened.files).length, 0)
    assert.equal(checkSources('HEAD', options).errors.length, 2)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
