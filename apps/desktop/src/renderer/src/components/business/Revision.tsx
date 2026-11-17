import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Plus } from 'lucide-react'
import type { MessageReference } from '../../model'
import { createComposerDraftStore } from '../../draft'
import { ComposerEditor } from './Editor'
import { ReferenceAttachment } from '../primitive'
import { Alert, Button, IconButton, Input } from '../ui'

const REVISION_EDITOR_MAX_HEIGHT = 320
const COMPOSITION_KEY_CODE = 229

export function MessageRevisionEditor({
  text,
  references,
  onCancel,
  onSubmit,
}: {
  text: string
  references?: MessageReference[]
  onCancel: () => void
  onSubmit: (text: string, references: MessageReference[], requestId: string) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation('conversation')
  const { t: componentText } = useTranslation('components')
  const allowAttachments = references !== undefined
  const [draft] = useState(() => createComposerDraftStore(text))
  const value = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot)
  const [attachments, setAttachments] = useState(() => [...(references ?? [])])
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const receipt = useRef({ signature: '', id: '' })

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.setSelectionRange(text.length, text.length)
  }, [text])

  const submit = async (): Promise<void> => {
    if (submitting.current || !draft.getSnapshot().trim()) return
    submitting.current = true
    setPending(true)
    setFailed(false)
    const signature = JSON.stringify([draft.getSnapshot(), attachments])
    if (receipt.current.signature !== signature)
      receipt.current = { signature, id: crypto.randomUUID() }
    try {
      await onSubmit(draft.getSnapshot(), attachments, receipt.current.id)
    } catch {
      setFailed(true)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <div
      className="mb-[var(--vds-space-6)] rounded-[var(--vds-radius-6)] border border-[var(--vds-border-default)] bg-[var(--vds-bg-white-default)] p-[var(--vds-space-4)]"
      data-testid="message-revision-editor"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing && !submitting.current) {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <ComposerEditor
        draft={draft}
        inputRef={inputRef}
        maxHeight={REVISION_EDITOR_MAX_HEIGHT}
        disabled={pending}
        aria-label={allowAttachments ? t('revision.input') : componentText('stream.editMessage')}
        references={attachments.map((reference, index) => ({
          key: `${reference.type}:${reference.id}:${index}`,
          content: (
            <ReferenceAttachment
              icon={<FileText size={16} />}
              label={reference.title}
              onClose={
                pending
                  ? undefined
                  : () =>
                      setAttachments((current) =>
                        current.filter((_, position) => position !== index)
                      )
              }
            />
          ),
          onRemove: pending
            ? undefined
            : () =>
                setAttachments((current) => current.filter((_, position) => position !== index)),
        }))}
        onChange={() => setFailed(false)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== COMPOSITION_KEY_CODE
          ) {
            event.preventDefault()
            event.stopPropagation()
            void submit()
          }
        }}
      />
      {!allowAttachments && (
        <p className="mt-[var(--vds-space-3)] text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-tertiary)]">
          {componentText('stream.editBranchHint')}
        </p>
      )}
      {failed && (
        <Alert className="mt-[var(--vds-space-3)]">
          {allowAttachments ? t('revision.failed') : componentText('stream.forkFailed')}
        </Alert>
      )}
      {allowAttachments && (
        <Input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          disabled={pending}
          aria-label={t('revision.attach')}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            setAttachments((current) => [
              ...current,
              ...files
                .map((file) => {
                  const path = window.scholarseed.pathForFile?.(file) || file.name
                  return {
                    type: 'file',
                    id: path,
                    title: file.name,
                    path,
                    size: file.size,
                    mediaType: file.type,
                  }
                })
                .filter(
                  (file) =>
                    !current.some(
                      (reference) => reference.type === file.type && reference.id === file.id
                    )
                ),
            ])
            event.target.value = ''
          }}
        />
      )}
      <div className="mt-[var(--vds-space-4)] flex flex-wrap items-center gap-[var(--vds-space-2)]">
        {allowAttachments && (
          <IconButton
            label={t('revision.attach')}
            icon={<Plus size={20} />}
            variant="ghost"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          />
        )}
        <div className="ml-auto flex flex-wrap gap-[var(--vds-space-2)]">
          <Button variant="secondary" disabled={pending} onClick={onCancel}>
            {t('revision.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={pending || !value.trim()}
            onClick={() => void submit()}
          >
            {pending
              ? t('revision.submitting')
              : allowAttachments
                ? t('revision.submit')
                : componentText('stream.editBranchSend')}
          </Button>
        </div>
      </div>
    </div>
  )
}
