export const PDFE_ITERATION_FILENAME = 'PDFE-iterations.json'
export const PDFE_ITERATION_WORKTREE_ENV = 'SCHOLARSEED_PDFE_ITERATION_WORKTREE'
export const PDFE_ITERATION_EDIT_ENV = 'SCHOLARSEED_PDFE_ITERATION_EDIT'
export const PDFE_ITERATION_LIMIT = { bytes: 512 * 1024, text: 2000 } as const
const VERSION = /^(?:0|[1-9]\d{0,7})(?:\.(?:0|[1-9]\d{0,7})){1,3}$/
const IDENTITY = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/

export interface PdfeIteration {
  readonly version: string
  readonly status: 'released' | 'prototype'
  readonly description?: string
}

export interface PdfeIterationFeature {
  readonly introducedIn: string | null
  readonly changes: readonly { readonly version: string; readonly summary: string }[]
}

export interface PdfeIterationManifest {
  readonly current: string
  readonly iterations: readonly PdfeIteration[]
  readonly baseline: {
    readonly version: string
    readonly scenes: Readonly<Record<string, readonly string[]>>
  }
  readonly features: Readonly<Record<string, PdfeIterationFeature>>
}

export interface PdfeIterationSnapshot {
  readonly revision: string
  readonly manifest: PdfeIterationManifest
}

export type PdfeIterationEdit =
  | { readonly kind: 'create'; readonly version: string; readonly description?: string }
  | {
      readonly kind: 'edit'
      readonly version: string
      readonly description?: string
      readonly status?: PdfeIteration['status']
      readonly confirmRelease?: boolean
    }
  | { readonly kind: 'select' | 'delete'; readonly version: string }

export type PdfeIterationEditErrorCode =
  | 'invalid-edit'
  | 'duplicate'
  | 'unknown-version'
  | 'confirm-release'
  | 'downgrade'
  | 'baseline'
  | 'current'
  | 'released'
  | 'referenced'

export type PdfeIterationSaveResult =
  | { readonly status: 'saved'; readonly snapshot: PdfeIterationSnapshot }
  | { readonly status: 'invalid'; readonly code: PdfeIterationEditErrorCode }
  | { readonly status: 'conflict' | 'unavailable' | 'unknown' }

export class PdfeIterationEditError extends Error {
  constructor(readonly code: PdfeIterationEditErrorCode) {
    super(code)
  }
}

const EDIT_FIELDS = {
  create: ['kind', 'version', 'description'],
  edit: ['kind', 'version', 'description', 'status', 'confirmRelease'],
  select: ['kind', 'version'],
  delete: ['kind', 'version'],
} as const

function invalid(field: string): never {
  throw new Error('Invalid PDFE iteration ' + field)
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field)
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length > PDFE_ITERATION_LIMIT.text) invalid(field)
  return value
}

function version(value: unknown, field: string): string {
  if (typeof value !== 'string' || !VERSION.test(value)) invalid(field)
  return value
}

export function comparePdfeVersions(left: string, right: string): number {
  const first = left.split('.').map(Number)
  const second = right.split('.').map(Number)
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

function knownVersion(value: unknown, versions: Set<string>, field: string): string {
  const result = version(value, field)
  if (!versions.has(result)) invalid(field)
  return result
}

function parseIterationDocument(source: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    invalid('JSON')
  }
  return object(value, 'document')
}

export function readPdfeIterations(source: string): PdfeIterationManifest {
  return validateIterationDocument(parseIterationDocument(source))
}

function validateIterationDocument(document: Record<string, unknown>): PdfeIterationManifest {
  if (!Array.isArray(document.iterations) || !document.iterations.length) invalid('list')
  const versions = new Set<string>()
  const comparable = new Set<string>()
  const iterations = document.iterations
    .map((item): PdfeIteration => {
      const entry = object(item, 'entry')
      const key = version(entry.version, 'version')
      const identity = key.replace(/(?:\.0)+$/, '')
      if (comparable.has(identity)) invalid('duplicate version')
      if (entry.status !== 'released' && entry.status !== 'prototype') invalid('status')
      comparable.add(identity)
      versions.add(key)
      return {
        version: key,
        status: entry.status,
        ...(entry.description === undefined
          ? {}
          : { description: text(entry.description, 'description') }),
      }
    })
    .sort((left, right) => comparePdfeVersions(right.version, left.version))

  const current = knownVersion(document.current, versions, 'current version')
  const baseline = object(document.baseline, 'baseline')
  const baselineVersion = knownVersion(baseline.version, versions, 'baseline version')
  if (!iterations.some((entry) => entry.version === baselineVersion && entry.status === 'released'))
    invalid('baseline release status')
  const scenes = Object.fromEntries(
    Object.entries(object(baseline.scenes, 'baseline scenes')).map(([page, entries]) => {
      if (
        !IDENTITY.test(page) ||
        !Array.isArray(entries) ||
        entries.some((scene) => typeof scene !== 'string' || !IDENTITY.test(scene)) ||
        new Set(entries).size !== entries.length
      )
        invalid('baseline scene identities')
      return [page, entries as string[]]
    })
  )

  const features = Object.fromEntries(
    Object.entries(object(document.features, 'features')).map(([identity, raw]) => {
      const parts = identity.split('/')
      if (parts.length > 2 || parts.some((part) => !IDENTITY.test(part)))
        invalid('feature identity')
      const feature = object(raw, 'feature')
      const introducedIn =
        feature.introducedIn === null
          ? null
          : knownVersion(feature.introducedIn, versions, 'feature introduction')
      if (!Array.isArray(feature.changes)) invalid('feature changes')
      const changes = feature.changes.map((rawChange) => {
        const change = object(rawChange, 'feature change')
        const revised = knownVersion(change.version, versions, 'feature update')
        if (introducedIn !== null && comparePdfeVersions(revised, introducedIn) < 0)
          invalid('feature update before introduction')
        return { version: revised, summary: text(change.summary, 'feature summary') }
      })
      return [identity, { introducedIn, changes }]
    })
  )

  return { current, iterations, baseline: { version: baselineVersion, scenes }, features }
}

function isEditKind(value: unknown): value is keyof typeof EDIT_FIELDS {
  return typeof value === 'string' && Object.hasOwn(EDIT_FIELDS, value)
}

function readIterationEdit(value: unknown): PdfeIterationEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new PdfeIterationEditError('invalid-edit')
  const edit = value as Record<string, unknown>
  const allowed: readonly string[] = isEditKind(edit.kind) ? EDIT_FIELDS[edit.kind] : []
  if (
    !allowed.length ||
    Object.keys(edit).some((key) => !allowed.includes(key)) ||
    typeof edit.version !== 'string' ||
    !VERSION.test(edit.version) ||
    (edit.description !== undefined &&
      (typeof edit.description !== 'string' ||
        edit.description.length > PDFE_ITERATION_LIMIT.text)) ||
    (edit.status !== undefined && edit.status !== 'prototype' && edit.status !== 'released') ||
    (edit.confirmRelease !== undefined && typeof edit.confirmRelease !== 'boolean') ||
    (edit.kind === 'edit' && edit.description === undefined && edit.status === undefined)
  ) {
    throw new PdfeIterationEditError('invalid-edit')
  }
  return edit as PdfeIterationEdit
}

export function pdfeIterationDeletionBlocker(
  manifest: PdfeIterationManifest,
  entry: PdfeIteration
): PdfeIterationEditErrorCode | undefined {
  if (entry.version === manifest.baseline.version) return 'baseline'
  if (entry.version === manifest.current) return 'current'
  if (entry.status === 'released') return 'released'
  if (
    Object.values(manifest.features).some(
      (feature) =>
        feature.introducedIn === entry.version ||
        feature.changes.some((change) => change.version === entry.version)
    )
  )
    return 'referenced'
}

export function applyPdfeIterationEdit(source: string, operation: unknown): string {
  const edit = readIterationEdit(operation)
  const document = parseIterationDocument(source)
  const manifest = validateIterationDocument(document)
  const entries = document.iterations as Record<string, unknown>[]
  const entry = manifest.iterations.find((item) => item.version === edit.version)
  if (edit.kind === 'create') {
    if (manifest.iterations.some((item) => comparePdfeVersions(item.version, edit.version) === 0))
      throw new PdfeIterationEditError('duplicate')
    entries.push({
      version: edit.version,
      status: 'prototype',
      ...(edit.description === undefined ? {} : { description: edit.description }),
    })
  } else {
    if (!entry) throw new PdfeIterationEditError('unknown-version')
    const index = entries.findIndex((item) => item.version === edit.version)
    if (edit.kind === 'edit') {
      if (entry.status === 'released' && edit.status === 'prototype')
        throw new PdfeIterationEditError('downgrade')
      if (
        entry.status === 'prototype' &&
        edit.status === 'released' &&
        edit.confirmRelease !== true
      )
        throw new PdfeIterationEditError('confirm-release')
      if (edit.status !== undefined) entries[index].status = edit.status
      if (edit.description !== undefined) entries[index].description = edit.description
    } else if (edit.kind === 'select') document.current = entry.version
    else {
      const blocker = pdfeIterationDeletionBlocker(manifest, entry)
      if (blocker) throw new PdfeIterationEditError(blocker)
      entries.splice(index, 1)
    }
  }
  validateIterationDocument(document)
  return JSON.stringify(document, null, 2) + '\n'
}
