import React, { useEffect, useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogPortal, AlertDialogTitle,
  Badge, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogPortal, DialogTitle, Input, Label, Textarea,
} from '../src/renderer/src/components/ui'
import {
  PDFE_ITERATION_LIMIT, pdfeIterationDeletionBlocker, type PdfeIteration,
  type PdfeIterationEdit, type PdfeIterationEditErrorCode, type PdfeIterationSaveResult, type PdfeIterationSnapshot,
} from '../src/iterations.ts'
import type { PreviewPage } from './catalog.ts'
import type { PdfeTranslate } from './collaboration.ts'
import { pdfeIterationReferences, type PdfeIterationReadState } from './iterations.ts'

const STACK = 'grid min-w-0 content-start gap-[var(--vds-space-2)]'
const SECONDARY = 'text-[var(--vds-text-secondary)]'
const ERROR = {
  'invalid-edit': 'iterationInvalidEdit', duplicate: 'iterationDuplicate', 'unknown-version': 'iterationUnknownVersion',
  'confirm-release': 'iterationConfirmReleaseError', downgrade: 'iterationDowngrade', baseline: 'iterationCannotDeleteBaseline',
  current: 'iterationCannotDeleteCurrent', released: 'iterationCannotDeleteReleased', referenced: 'iterationCannotDeleteReferenced',
} as const satisfies Record<PdfeIterationEditErrorCode, Parameters<PdfeTranslate>[0]>
const ACTION = { create: 'iterationCreate', edit: 'iterationEdit', select: 'iterationSelect', delete: 'iterationDelete' } as const
const ACTIONS = 'flex flex-wrap gap-[var(--vds-space-2)]'
type Editor = { kind: 'create' } | { kind: 'edit' | 'select' | 'delete'; entry: PdfeIteration }
type SaveIteration = (revision: string, edit: PdfeIterationEdit) => Promise<PdfeIterationSaveResult>

export function PdfeIterationsPanel({ state, pages, onRefresh, onSave, onDraft, translate }: {
  state: PdfeIterationReadState
  pages: readonly PreviewPage[]
  onRefresh: () => Promise<PdfeIterationSnapshot | undefined>
  onSave?: SaveIteration
  onDraft: (dirty: boolean) => void
  translate: PdfeTranslate
}) {
  const manifest = state.snapshot?.manifest
  const references = manifest ? pdfeIterationReferences(manifest, pages) : null
  const [editor, setEditor] = useState<Editor>()
  const [saved, setSaved] = useState(false)
  const [startingRevision, setStartingRevision] = useState('')
  const editDisabled = state.loading || state.failed || !state.snapshot
  const open = (next: Editor) => {
    if (!state.snapshot) return
    setSaved(false)
    setStartingRevision(state.snapshot.revision)
    setEditor(next)
  }
  return <section className={STACK} aria-label={translate('iterationMaintenance')}>
    <h2 className="font-semibold">{translate('iterationMaintenance')}</h2>
    <p className={SECONDARY}>{translate(onSave ? 'iterationWritable' : 'iterationReadOnly')}</p>
    <div className={ACTIONS}>
      <Button variant="secondary" disabled={state.loading} onClick={() => void onRefresh()}>{translate('iterationReload')}</Button>
      {onSave && <Button disabled={editDisabled} onClick={() => open({ kind: 'create' })}>{translate('iterationCreate')}</Button>}
    </div>
    {saved && <p role="status">{translate('iterationSaved')}</p>}
    {state.loading && <p role="status">{translate('iterationLoading')}</p>}
    {state.failed && <p role="alert">{translate(manifest ? 'iterationStale' : 'iterationUnavailable')}</p>}
    {manifest && <ul className={STACK}>
      {manifest.iterations.map(entry => {
        const blocker = pdfeIterationDeletionBlocker(manifest, entry)
        return <li key={entry.version} data-testid={'preview-iteration-entry-' + entry.version} className="grid min-w-0 gap-[var(--vds-space-1)] rounded-[var(--vds-radius-3)] border border-[var(--vds-border-default)] p-[var(--vds-space-3)]">
        <h3 className="flex flex-wrap items-center gap-[var(--vds-space-2)] font-semibold">
          <span>v{entry.version}</span>
          <Badge variant="outline">{translate(entry.status === 'released' ? 'iterationReleased' : 'iterationPrototype')}</Badge>
          {entry.version === manifest.current && <Badge>{translate('iterationCurrent')}</Badge>}
          {entry.version === manifest.baseline.version && <Badge variant="outline">{translate('iterationBaseline')}</Badge>}
        </h3>
        <p className={'whitespace-pre-wrap break-words ' + SECONDARY}>{entry.description?.trim() ? entry.description : translate('iterationNoDescription')}</p>
        <p className={SECONDARY}>{translate('iterationReferences', { count: references?.get(entry.version) ?? 0 })}</p>
        {onSave && <>
          <div className={ACTIONS}>
            <Button variant="secondary" disabled={editDisabled} onClick={() => open({ kind: 'edit', entry })}>{translate('iterationEdit')}</Button>
            <Button variant="secondary" disabled={editDisabled || entry.version === manifest.current} onClick={() => open({ kind: 'select', entry })}>{translate('iterationSelect')}</Button>
            <Button variant="ghost" disabled={editDisabled || !!blocker} onClick={() => open({ kind: 'delete', entry })}>{translate('iterationDelete')}</Button>
          </div>
          {blocker && <p className={SECONDARY}>{translate(ERROR[blocker])}</p>}
        </>}
      </li>})}
    </ul>}
    {editor && onSave && <IterationEditor editor={editor} startingRevision={startingRevision} blocked={state.failed}
      onDraft={onDraft} onRefresh={onRefresh} onSave={onSave} translate={translate}
      onClose={didSave => { onDraft(false); setEditor(undefined); setSaved(didSave) }} />}
  </section>
}

function IterationEditor({ editor, startingRevision, blocked, onDraft, onRefresh, onSave, onClose, translate }: {
  editor: Editor
  startingRevision: string
  blocked: boolean
  onDraft: (dirty: boolean) => void
  onRefresh: () => Promise<PdfeIterationSnapshot | undefined>
  onSave: SaveIteration
  onClose: (saved: boolean) => void
  translate: PdfeTranslate
}) {
  const entry = 'entry' in editor ? editor.entry : undefined
  const [baseEntry, setBaseEntry] = useState(entry)
  const [version, setVersion] = useState(entry?.version ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [descriptionConflict, setDescriptionConflict] = useState(false)
  const [release, setRelease] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  const [expected, setExpected] = useState(startingRevision)
  const [working, setWorking] = useState(false)
  const [failure, setFailure] = useState<Exclude<PdfeIterationSaveResult, { status: 'saved' }>>()
  const [discard, setDiscard] = useState(false)
  const fields = editor.kind === 'create' || editor.kind === 'edit'
  const descriptionChanged = description !== (baseEntry?.description ?? '')
  const entryMissing = editor.kind === 'edit' && !baseEntry
  const dirty = fields && (version !== (entry?.version ?? '') || descriptionChanged || release)
  useEffect(() => { onDraft(dirty) }, [dirty, onDraft])
  const close = () => {
    if (working) return
    if (dirty) setDiscard(true)
    else onClose(false)
  }
  const reloadRequired = blocked || failure?.status === 'conflict' || failure?.status === 'unknown'
  const reload = async () => {
    setWorking(true)
    try {
      const updated = await onRefresh()
      if (updated) {
        if (editor.kind === 'edit') {
          const latest = updated.manifest.iterations.find(candidate => candidate.version === version)
          const latestDescription = latest?.description ?? ''
          setBaseEntry(latest)
          if (!latest) {
            setFailure({ status: 'invalid', code: 'unknown-version' })
            return
          }
          setDescriptionConflict(descriptionChanged && latestDescription !== (baseEntry?.description ?? '') && latestDescription !== description)
          if (!descriptionChanged) setDescription(latestDescription)
          if (latest.status === 'released') setRelease(false)
        }
        setExpected(updated.revision)
        setConfirmRelease(false)
        setFailure(undefined)
      }
    } finally { setWorking(false) }
  }
  const cannotSave = working || reloadRequired || descriptionConflict || entryMissing || !version.trim() ||
    (release && !confirmRelease) || (editor.kind === 'edit' && !descriptionChanged && !release)
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (cannotSave) return
    const operation: PdfeIterationEdit = editor.kind === 'create' ? { kind: 'create', version: version.trim(), description }
      : editor.kind === 'edit' ? { kind: 'edit', version, ...(descriptionChanged ? { description } : {}), ...(release ? { status: 'released', confirmRelease } : {}) }
        : { kind: editor.kind, version }
    setWorking(true)
    try {
      const result = await onSave(expected, operation)
      if (result.status === 'saved') onClose(true)
      else setFailure(result)
    } finally { setWorking(false) }
  }
  const failureKey = failure?.status === 'invalid' ? ERROR[failure.code]
    : failure?.status === 'conflict' ? 'iterationConflict'
      : failure?.status === 'unknown' ? 'iterationUnknown'
        : failure?.status === 'unavailable' ? 'iterationSaveUnavailable' : undefined
  return <Dialog open onOpenChange={next => { if (!next) close() }}>
    <DialogPortal><DialogContent className="max-h-[calc(100dvh_-_var(--vds-space-6))] overflow-auto" aria-label={translate(ACTION[editor.kind])}>
      <DialogHeader><DialogTitle>{translate(ACTION[editor.kind])}</DialogTitle>
        <DialogDescription>{translate(editor.kind === 'delete' ? 'iterationDeleteConfirm' : 'iterationWritable')}</DialogDescription>
      </DialogHeader>
      <form className={STACK} onSubmit={event => void save(event)}>
        {editor.kind === 'create' ? <>
          <Label htmlFor="pdfe-edit-version">{translate('iterationVersion')}</Label>
          <Input id="pdfe-edit-version" value={version} onChange={event => setVersion(event.target.value)} disabled={working} maxLength={40} />
        </> : <p>v{version}</p>}
        {fields && <>
          <Label htmlFor="pdfe-edit-description">{translate('iterationDescription')}</Label>
          <Textarea id="pdfe-edit-description" value={description} onChange={event => setDescription(event.target.value)} disabled={working || descriptionConflict} maxLength={PDFE_ITERATION_LIMIT.text} />
        </>}
        {descriptionConflict && baseEntry && <div className={STACK}>
          <p role="alert">{translate('iterationDescriptionConflict')}</p>
          <p className="whitespace-pre-wrap break-words">{baseEntry.description || translate('iterationNoDescription')}</p>
          <div className={ACTIONS}>
            <Button variant="secondary" onClick={() => { setDescription(baseEntry.description ?? ''); setDescriptionConflict(false) }}>{translate('iterationKeepLatestDescription')}</Button>
            <Button variant="secondary" onClick={() => setDescriptionConflict(false)}>{translate('iterationKeepDraftDescription')}</Button>
          </div>
        </div>}
        {editor.kind === 'edit' && baseEntry?.status === 'prototype' && <>
          <Checkbox label={translate('iterationRelease')} checked={release} onCheckedChange={value => { setRelease(value); setConfirmRelease(false) }} disabled={working} />
          {release && <Checkbox label={translate('iterationReleaseConfirm')} checked={confirmRelease} onCheckedChange={setConfirmRelease} disabled={working} align="first-line" />}
        </>}
        {failureKey && <p role="alert">{translate(failureKey)}</p>}
        {blocked && !failureKey && <p role="alert">{translate('iterationStale')}</p>}
        <div className={ACTIONS}>
          <Button variant="secondary" disabled={working} onClick={close}>{translate('iterationCancel')}</Button>
          {reloadRequired && <Button variant="secondary" disabled={working} onClick={() => void reload()}>{translate('iterationReloadDraft')}</Button>}
          <Button type="submit" variant={editor.kind === 'delete' ? 'danger' : 'primary'}
            disabled={cannotSave}>
            {translate(editor.kind === 'delete' ? 'iterationDelete' : 'iterationSave')}
          </Button>
        </div>
      </form>
    </DialogContent></DialogPortal>
    <AlertDialog open={discard} onOpenChange={setDiscard}>
      <AlertDialogPortal><AlertDialogContent aria-label={translate('iterationDiscardTitle')}>
        <AlertDialogHeader><AlertDialogTitle>{translate('iterationDiscardTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{translate('iterationDiscardDetail')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{translate('iterationKeep')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onClose(false)}>{translate('iterationDiscard')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialogPortal>
    </AlertDialog>
  </Dialog>
}
