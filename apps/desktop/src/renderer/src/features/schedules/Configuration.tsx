import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { getSkills, type Project, type SkillInfo } from '../../api'
import type { AssistantContextCandidate, ComposerReference } from '../../contracts/assistant'
import { renderFeedback } from '../../contracts/feedback'
import { Icon } from '../../icons'
import { useApp } from '../../store'
import { createComposerDraftStore } from '../../draft'
import { ComposerEditor } from '../../components/business/Editor'
import { COMPOSER_MAX_HEIGHT_PX } from '../../components/business/Composer'
import { ComposerSkillRefs } from '../../components/business/SkillRefs'
import { DraftAttachments } from '../assistant/Images'
import { ReferenceAttachment } from '../../components/primitive'
import { declaredEffortValues, modelDefaultEffort, reasoningLabel } from '../../reasoning'
import { skillCallable, skillName } from '../../skill'
import { composerTrigger, replaceComposerTrigger, COMPOSER_SKILL_KIND } from '../../input'
import {
  SkillSelection,
  ComposerMenuEntries,
  selectFirstMenuItem,
  COMPOSER_SELECTION_PAGE_SIZE,
} from '../../components/business/Selection'
import { SkillAdd, Skills } from '../../components/business/Skills'
import { useScheduleSources } from './Creation'
import { assistantSourceAvailable } from '../assistant/candidates'
import { ModelMenu } from '../../components/business/ModelMenu'
import { ReferencePicker } from '../../components/business/References'
import { useAccountAccess } from '../../components/business/access'
import {
  IMPORT_PICKER_TARGET,
  supportsImportPickerTarget,
  type ImportPickerTarget,
} from '../../../../picker'
import { SKILL_SURFACE_CONVERSATION } from '../../../../skills'
import {
  Alert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
} from '../../components/ui'
import type { ScheduleExecution } from './model'

export function Configuration({
  promptId,
  prompt,
  maxLength,
  onPromptChange,
  project,
  value,
  disabled,
  onChange,
}: {
  promptId: string
  prompt: string
  maxLength: number
  onPromptChange: (prompt: string) => void
  project: Pick<Project, 'id' | 'path' | 'name'>
  value: ScheduleExecution
  disabled: boolean
  onChange: (value: ScheduleExecution) => void
}): React.JSX.Element {
  const { state } = useApp()
  const { t, i18n } = useTranslation('components')
  const { t: scheduleText } = useTranslation('schedules')
  const { t: conversationText } = useTranslation('conversation')
  const { authenticated, revision } = useAccountAccess(state.backendReady)
  const [skillOpen, setSkillOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [skillLoading, setSkillLoading] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')
  const [skillVisibleCount, setSkillVisibleCount] = useState(COMPOSER_SELECTION_PAGE_SIZE)
  const skillPanelRef = useRef<HTMLDivElement>(null)
  const skillSearchRef = useRef<HTMLInputElement>(null)
  const [skillUploadOpen, setSkillUploadOpen] = useState(false)
  const [skillMarketOpen, setSkillMarketOpen] = useState(false)
  const [menuEntry, setMenuEntry] = useState<'plus' | 'skills'>('plus')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<AssistantContextCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const draft = useMemo(() => createComposerDraftStore(prompt), [])
  useEffect(() => {
    draft.set(prompt)
  }, [draft, prompt])
  const sources = useScheduleSources().filter((source) =>
    assistantSourceAvailable(source, project.id)
  )
  const source = sources.find((entry) => entry.id === sourceId)
  const model = state.catalog.models.find((entry) => entry.key === value.model_key)
  const efforts = declaredEffortValues(model)
  const unifiedPicker = supportsImportPickerTarget(
    window.scholarseed?.platform,
    IMPORT_PICKER_TARGET.RESOURCE
  )
  useEffect(() => {
    if (!skillOpen) return
    let current = true
    setSkillLoading(true)
    setError(false)
    void getSkills(SKILL_SURFACE_CONVERSATION, i18n.language)
      .then((entries) => {
        if (current) setSkills(entries.filter((entry) => skillCallable(entry, authenticated)))
      })
      .catch(() => {
        if (current) setError(true)
      })
      .finally(() => {
        if (current) setSkillLoading(false)
      })
    return () => {
      current = false
    }
  }, [skillOpen, authenticated, revision, i18n.language])
  useEffect(() => {
    if (!source) return
    let current = true
    setLoading(true)
    setError(false)
    setCandidates([])
    void source
      .search({
        projectId: project.id,
        projectPath: project.path,
        activeSessionId: null,
        query,
        filter: 'all',
      })
      .then((result) => {
        if (current) setCandidates(result.items)
      })
      .catch(() => {
        if (current) setError(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [source, project.id, project.path, query])
  const restoreInput = (): void => {
    requestAnimationFrame(() => input.current?.focus())
  }
  const closeMenu = (): void => {
    setSkillOpen(false)
    setMenuOpen(false)
    setMenuEntry('plus')
  }
  const changePrompt = (): void => {
    const text = draft.getSnapshot()
    const editor = input.current
    const caret = editor?.selectionStart ?? text.length
    const trigger =
      editor?.selectionStart === editor?.selectionEnd ? composerTrigger(text, caret) : null
    if (!trigger || composing.current || menuOpen) {
      onPromptChange(text)
      return
    }
    const skills = trigger.query.startsWith(COMPOSER_SKILL_KIND + ':')
    const next = replaceComposerTrigger(text, '', caret)
    draft.set(next)
    onPromptChange(next)
    setSkillQuery(skills ? trigger.query.slice(COMPOSER_SKILL_KIND.length + 1) : '')
    setSkillVisibleCount(COMPOSER_SELECTION_PAGE_SIZE)
    setMenuEntry(skills ? 'skills' : 'plus')
    setSkillOpen(skills)
    setMenuOpen(true)
  }
  useEffect(() => {
    if (!skillOpen || skillLoading) return
    const frame = requestAnimationFrame(() => {
      const first = skillPanelRef.current?.querySelector<HTMLButtonElement>(
        '[data-composer-skill-option]'
      )
      ;(first ?? skillSearchRef.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [skillOpen, skillLoading])
  const addReferences = (entries: ComposerReference[]): void => {
    const references = new Map(
      value.references.map((entry) => [`${entry.type}:${entry.id}`, entry])
    )
    entries.forEach((entry) => references.set(`${entry.type}:${entry.id}`, entry))
    onChange({ ...value, references: [...references.values()] })
  }
  const pickLocal = async (target: ImportPickerTarget): Promise<void> => {
    if (picking) return
    if (!window.scholarseed?.pickImport) {
      if (target !== IMPORT_PICKER_TARGET.DIRECTORY) fileInput.current?.click()
      return
    }
    setPicking(true)
    setError(false)
    try {
      const paths = await window.scholarseed.pickImport(target)
      addReferences(
        paths.map((path) => ({
          type: target === IMPORT_PICKER_TARGET.DIRECTORY ? 'directory' : 'file',
          id: path,
          title: path.split(/[/\\]/).filter(Boolean).pop() || path,
          path,
        }))
      )
    } catch {
      setError(true)
    } finally {
      setPicking(false)
    }
  }
  const skillMenu = (
    <SkillSelection
      panelRef={skillPanelRef}
      searchRef={skillSearchRef}
      query={skillQuery}
      onQueryChange={setSkillQuery}
      visibleCount={skillVisibleCount}
      onVisibleCountChange={setSkillVisibleCount}
      rows={skills}
      loading={skillLoading}
      onSelect={(skill) => {
        addReferences([
          {
            type: 'skill',
            id: skill.name,
            title: skillName(skill, i18n.resolvedLanguage || i18n.language),
            path: skill.path,
            version: skill.version,
          },
        ])
        closeMenu()
        setSkillQuery('')
        restoreInput()
      }}
      onUpload={() => {
        closeMenu()
        setSkillUploadOpen(true)
      }}
      onExplore={() => {
        closeMenu()
        setSkillMarketOpen(true)
      }}
    />
  )
  return (
    <div
      className="grid min-w-0 gap-[var(--vds-space-3)] rounded-[var(--vds-radius-6)] border border-[var(--vds-border-default)] bg-[var(--vds-bg-white-default)] p-[var(--vds-space-4)]"
      data-testid="schedule-composer"
      onCompositionStartCapture={() => {
        composing.current = true
      }}
      onCompositionEndCapture={() => {
        composing.current = false
      }}
    >
      <div className="hidden">
        <Input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          aria-label={t('composer.addLocal')}
          disabled={disabled}
          onChange={(event) => {
            addReferences(
              Array.from(event.target.files ?? []).map((file) => ({
                type: 'file',
                id: `${file.name}:${file.size}:${file.lastModified}`,
                title: file.name,
                path: window.scholarseed?.pathForFile?.(file) || file.name,
              }))
            )
            event.target.value = ''
          }}
        />
      </div>
      {value.references.some((entry) => entry.type !== 'skill') && (
        <div
          data-testid="schedule-references"
          className="flex min-w-0 flex-wrap gap-[var(--vds-space-2)]"
        >
          <DraftAttachments
            refs={value.references.filter((entry) => entry.type !== 'skill')}
            onRemove={
              disabled
                ? undefined
                : (index) => {
                    const entry = value.references.filter((item) => item.type !== 'skill')[index]
                    onChange({
                      ...value,
                      references: value.references.filter((item) => item !== entry),
                    })
                  }
            }
          />
        </div>
      )}
      <ComposerEditor
        inputRef={input}
        draft={draft}
        id={promptId}
        aria-label={scheduleText('prompt')}
        data-testid="schedule-composer-input"
        maxHeight={COMPOSER_MAX_HEIGHT_PX}
        maxLength={maxLength}
        rows={3}
        required
        unstyled
        disabled={disabled}
        placeholder={scheduleText('promptPlaceholder')}
        className="min-h-[var(--vds-schedule-composer-min-height)] w-full resize-none border-0 bg-transparent p-[var(--vds-space-0)] text-[var(--vds-text-primary)] outline-none"
        typographyClassName="font-[var(--font-serif)] text-[length:var(--vds-font-body-lv2)] font-[var(--vds-fw-regular)] leading-[var(--vds-lh-body-lv2)]"
        onChange={changePrompt}
        references={[
          ...value.references
            .filter((entry) => entry.type === 'skill')
            .map((entry) => {
              const remove = disabled
                ? undefined
                : () =>
                    onChange({
                      ...value,
                      references: value.references.filter((item) => item !== entry),
                    })
              return {
                key: `skill:${entry.id}`,
                content: <ComposerSkillRefs refs={[entry]} onRemove={remove} />,
                onRemove: remove,
              }
            }),
          ...value.contexts.map((entry) => {
            const remove = disabled
              ? undefined
              : () =>
                  onChange({ ...value, contexts: value.contexts.filter((item) => item !== entry) })
            return {
              key: `${entry.kind}:${entry.source_id}`,
              content: (
                <ReferenceAttachment
                  variant="text"
                  label={entry.label}
                  title={entry.label}
                  closeLabel={scheduleText('removeReference', { name: entry.label })}
                  onClose={remove}
                />
              ),
              onRemove: remove,
            }
          }),
        ]}
        onRemoveAllReferences={
          disabled ? undefined : () => onChange({ ...value, references: [], contexts: [] })
        }
      />
      <div className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open)
            if (!open) {
              setSkillOpen(false)
              setMenuEntry('plus')
              restoreInput()
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <IconButton
              type="button"
              variant="ghostIcon"
              icon={<Plus />}
              label={t('composer.addMenu')}
              data-testid="schedule-plus"
              disabled={disabled || picking}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            key={menuEntry}
            side="top"
            coordinateNavigation
            className="!z-[var(--vds-z-modal-nested-flyout)]"
            onKeyDown={selectFirstMenuItem}
          >
            {menuEntry === 'skills' ? (
              skillMenu
            ) : (
              <ComposerMenuEntries
                skillsOpen={skillOpen}
                onSkillsOpenChange={(open) => {
                  setSkillOpen(open)
                  if (open) {
                    setSkillQuery('')
                    setSkillVisibleCount(COMPOSER_SELECTION_PAGE_SIZE)
                  }
                }}
                skills={skillMenu}
                submenuClassName="!z-[var(--vds-z-modal-nested-flyout)]"
                onFile={() =>
                  void pickLocal(
                    unifiedPicker ? IMPORT_PICKER_TARGET.RESOURCE : IMPORT_PICKER_TARGET.FILE
                  )
                }
                onFolder={
                  !unifiedPicker && typeof window.scholarseed?.pickImport === 'function'
                    ? () => {
                        void pickLocal(IMPORT_PICKER_TARGET.DIRECTORY)
                      }
                    : undefined
                }
              >
                {sources.map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    onSelect={() => {
                      setQuery('')
                      setSourceId(entry.id)
                    }}
                  >
                    <Icon name={entry.icon} />
                    {t('composer.referenceSource', { source: renderFeedback(i18n, entry.label) })}
                  </DropdownMenuItem>
                ))}
              </ComposerMenuEntries>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto min-w-0" inert={disabled}>
          <ModelMenu
            independent
            modelKey={value.model_key}
            testIdPrefix="schedule-model"
            onModelSelect={(next) =>
              onChange({
                ...value,
                model_key: next.key,
                reasoning_effort: modelDefaultEffort(next),
              })
            }
            effortControl={{
              value: value.reasoning_effort,
              label: reasoningLabel(value.reasoning_effort, conversationText, true),
              options: efforts.map((effort) => ({
                value: effort,
                label: reasoningLabel(effort, conversationText),
              })),
              selectable: Boolean(model) && efforts.length > 0,
              disabled: !model || !efforts.length,
              pending: false,
              select: async (effort) => {
                onChange({ ...value, reasoning_effort: effort })
              },
            }}
          />
        </div>
      </div>
      {skillUploadOpen && (
        <SkillAdd
          onClose={() => {
            setSkillUploadOpen(false)
            restoreInput()
          }}
          onDone={async () => {
            setSkillUploadOpen(false)
            restoreInput()
          }}
        />
      )}
      <Dialog open={skillMarketOpen} onOpenChange={setSkillMarketOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="!max-w-[var(--vds-layout-reading-width)]"
        >
          <DialogHeader>
            <DialogTitle>{t('composer.skillMarket')}</DialogTitle>
          </DialogHeader>
          <Skills />
        </DialogContent>
      </Dialog>
      {error && <Alert tone="error" description={scheduleText('configurationFailed')} />}
      {source && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSourceId(null)
          }}
        >
          <DialogContent
            aria-describedby={undefined}
            className="!max-w-[var(--vds-layout-reading-width)]"
          >
            <DialogHeader>
              <DialogTitle>
                {t('composer.referenceSource', { source: renderFeedback(i18n, source.label) })}
              </DialogTitle>
            </DialogHeader>
            {error && <Alert tone="error" description={scheduleText('configurationFailed')} />}
            <ReferencePicker
              browse={source.browse}
              candidates={candidates}
              emptyLabel={renderFeedback(i18n, source.emptyLabel)}
              loading={loading}
              onQueryChange={setQuery}
              projectId={project.id}
              query={query}
              sourceId={source.id}
              sourceLabel={renderFeedback(i18n, source.label)}
              onCancel={() => setSourceId(null)}
              onConfirm={async (entries) => {
                const contexts = new Map(
                  value.contexts.map((entry) => [`${entry.kind}:${entry.source_id}`, entry])
                )
                entries.forEach((entry) => contexts.set(`${entry.kind}:${entry.source_id}`, entry))
                onChange({ ...value, contexts: [...contexts.values()] })
                setSourceId(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
