import React from 'react'
import { FileText, FolderOpen, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPortal,
  AlertDialogTitle,
  Button,
  IconButton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  PageSection,
  Switch,
} from '../../components/ui'
import { openSystemPath } from '../../api'
import { SettingsField, SettingsGroup, SettingsPage } from '../../components/business/Settings'
import { useMemory, type MemoryGroup } from './context'
import { memoryFiles } from './files'
import { MemoryPreview } from './Preview'

export function MemorySettings(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('memory')
  const memory = useMemory()
  const [clearId, setClearId] = React.useState<string | null>(null)
  const [directoryId, setDirectoryId] = React.useState<string | null>(null)
  const [openError, setOpenError] = React.useState<string | null>(null)
  const [opening, setOpening] = React.useState(false)
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  if (!memory) return null
  const title = (group: MemoryGroup): string =>
    group.scope === 'global' ? t('global') : group.name
  const clearGroup = memory.groups.find((group) => group.id === clearId)
  const directory = memory.groups.find((group) => group.id === directoryId)
  const files = directory ? memoryFiles(directory) : []
  const formatDate = (value: string): string =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  const openLocal = async (path: string): Promise<void> => {
    setOpenError(null)
    setOpening(true)
    try {
      const result = await openSystemPath(path)
      if (!result.ok)
        setOpenError(
          t(
            result.applicationFailure?.code === 'desktop_bridge_unavailable'
              ? 'openUnavailable'
              : 'openFailed'
          )
        )
    } finally {
      setOpening(false)
    }
  }
  const errorNotice = openError && (
    <p
      role="alert"
      className="m-0 text-[length:var(--vds-font-body-lv1)] text-[var(--vds-error-text-primary)]"
    >
      {openError}
    </p>
  )
  const row = (group: MemoryGroup): React.JSX.Element => {
    const documents = memoryFiles(group)
    return (
      <div
        key={group.id}
        className="flex min-w-0 items-center gap-[var(--vds-space-3)] p-[var(--vds-space-3)]"
        data-testid={`memory-group-row-${group.id}`}
      >
        <div className="grid min-w-0 flex-1 justify-items-start gap-[var(--vds-space-1)]">
          <Button
            unstyled
            className="max-w-full truncate text-left text-[length:var(--vds-font-body-lv2)] text-[var(--vds-text-primary)] hover:underline"
            data-testid={`memory-directory-${group.id}`}
            onClick={() => {
              setOpenError(null)
              setDirectoryId(group.id)
              setSelectedPath(null)
            }}
          >
            {title(group)}
          </Button>
          <span className="text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-tertiary)]">
            {documents.length ? t('fileCount', { count: documents.length }) : t('empty')}
          </span>
        </div>
        {documents.length > 0 && (
          <time
            className="shrink-0 text-right text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-tertiary)]"
            dateTime={documents[0].updatedAt}
          >
            {formatDate(documents[0].updatedAt)}
          </time>
        )}
        <div className="flex shrink-0 items-center gap-[var(--vds-space-1)]">
          <IconButton
            icon={<FolderOpen />}
            size="sm"
            variant="ghost"
            label={t('openDirectory', { name: title(group) })}
            disabled={opening}
            data-testid={`memory-local-directory-${group.id}`}
            onClick={() => void openLocal(group.path)}
          />
          <IconButton
            icon={<Trash2 className="text-[var(--vds-error-text-primary)]" />}
            size="sm"
            variant="ghost"
            label={t('clear', { name: title(group) })}
            disabled={!group.entries.length}
            data-testid={`memory-clear-${group.id}`}
            onClick={() => setClearId(group.id)}
          />
        </div>
      </div>
    )
  }
  if (directory)
    return (
      <SettingsPage
        data-testid="memory-files"
        title={
          <Breadcrumb className="!text-[length:var(--vds-font-subhead)] !leading-[var(--vds-lh-subhead)]">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  className="!text-[var(--vds-text-tertiary)]"
                  data-testid="memory-files-back"
                  onClick={(event) => {
                    event.preventDefault()
                    setDirectoryId(null)
                    setOpenError(null)
                  }}
                >
                  {t('title')}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title(directory)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        description={t('filesDescription')}
      >
        {errorNotice}
        <div className="min-w-0" data-testid="memory-file-list">
          {files.length ? (
            <SettingsGroup>
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex min-w-0 items-center gap-[var(--vds-space-3)] p-[var(--vds-space-3)]"
                  data-testid={`memory-file-row-${file.name}`}
                >
                  <FileText
                    aria-hidden
                    className="size-[var(--vds-icon-8)] shrink-0 text-[var(--vds-text-tertiary)]"
                  />
                  <div className="grid min-w-0 flex-1 justify-items-start gap-[var(--vds-space-1)]">
                    <Button
                      unstyled
                      className="max-w-full truncate text-left text-[length:var(--vds-font-body-lv2)] text-[var(--vds-text-primary)] hover:underline"
                      data-testid={`memory-file-${file.name}`}
                      onClick={() => setSelectedPath(file.path)}
                    >
                      {file.name}
                    </Button>
                    <span
                      className="max-w-full truncate text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-tertiary)]"
                      title={file.path}
                    >
                      {file.path}
                    </span>
                  </div>
                  <time
                    className="shrink-0 text-right text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-tertiary)]"
                    dateTime={file.updatedAt}
                  >
                    {formatDate(file.updatedAt)}
                  </time>
                  <IconButton
                    icon={<FolderOpen />}
                    size="sm"
                    variant="ghost"
                    label={t('openFile', { path: file.path })}
                    data-testid={`memory-local-file-${file.name}`}
                    disabled={opening}
                    onClick={() => void openLocal(file.path)}
                  />
                </div>
              ))}
            </SettingsGroup>
          ) : (
            <p className="text-[var(--vds-text-tertiary)]">{t('empty')}</p>
          )}
        </div>
        <MemoryPreview
          file={files.find((file) => file.path === selectedPath) ?? null}
          onClose={() => setSelectedPath(null)}
          nested
        />
      </SettingsPage>
    )
  return (
    <SettingsPage title={t('title')} description={t('description')} data-testid="memory-settings">
      {errorNotice}
      <PageSection title={t('behavior')}>
        <SettingsGroup>
          <SettingsField title={t('global')} description={t('globalDescription')}>
            <Switch
              label={t('global')}
              checked={memory.enabled.global}
              onCheckedChange={(value) => memory.setEnabled('global', value)}
              data-testid="memory-global-switch"
            />
          </SettingsField>
          <SettingsField title={t('project')} description={t('projectDescription')}>
            <Switch
              label={t('project')}
              checked={memory.enabled.project}
              onCheckedChange={(value) => memory.setEnabled('project', value)}
              data-testid="memory-project-switch"
            />
          </SettingsField>
        </SettingsGroup>
      </PageSection>
      <PageSection title={t('global')}>
        <SettingsGroup>
          {memory.groups.filter((group) => group.scope === 'global').map(row)}
        </SettingsGroup>
      </PageSection>
      <PageSection title={t('project')}>
        {memory.groups.some((group) => group.scope === 'project') ? (
          <SettingsGroup>
            {memory.groups.filter((group) => group.scope === 'project').map(row)}
          </SettingsGroup>
        ) : (
          <p className="text-[var(--vds-text-tertiary)]">{t('noProjects')}</p>
        )}
      </PageSection>
      <AlertDialog
        open={Boolean(clearGroup)}
        onOpenChange={(open) => {
          if (!open) setClearId(null)
        }}
      >
        <AlertDialogPortal>
          <AlertDialogContent
            className="!z-[var(--vds-z-modal-nested)]"
            overlayClassName="!z-[var(--vds-z-modal-nested-overlay)]"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('clearTitle', { name: clearGroup ? title(clearGroup) : '' })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t('clearDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                data-testid="memory-clear-confirm"
                onClick={() => {
                  if (clearGroup) memory.clear(clearGroup.id)
                  setClearId(null)
                }}
              >
                {t('clearConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialog>
    </SettingsPage>
  )
}
