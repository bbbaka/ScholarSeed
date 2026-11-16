import React from 'react'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import {
  OverviewGroup,
  OverviewSection,
  OVERVIEW_ROW_CLASS,
} from '../../components/business/SessionArtifacts'
import { MEMORY_DIMENSIONS, useMemory } from './context'
import { memoryFiles } from './files'
import { MemoryPreview } from './Preview'

function SessionMemory({ sessionId }: { sessionId?: string | null }): React.JSX.Element | null {
  const memory = useMemory()
  const { t } = useTranslation('memory')
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  if (!memory || !sessionId) return null
  const files = memory.groups.flatMap((group) => memoryFiles(group, sessionId))
  const selectedFile = selectedPath
    ? memory.groups
        .flatMap((group) => memoryFiles(group))
        .find((file) => file.path === selectedPath)
    : null
  if (!files.length) return null
  return (
    <>
      <div
        aria-hidden
        className="mx-[var(--vds-space-2)] my-[var(--vds-space-2)] border-t border-[var(--vds-divider-default)]"
      />
      <OverviewSection title={t('title')} testId="session-memory">
        <div className="grid gap-[var(--vds-space-2)]">
          {MEMORY_DIMENSIONS.map((dimension) => {
            const updatedFiles = files.filter((file) => file.dimension === dimension)
            if (!updatedFiles.length) return null
            return (
              <OverviewGroup
                key={dimension}
                title={t(dimension)}
                testId={`memory-dimension-${dimension}`}
                items={updatedFiles.map((file) => (
                  <Button
                    key={file.path}
                    unstyled
                    className={OVERVIEW_ROW_CLASS}
                    onClick={() => setSelectedPath(file.path)}
                    title={file.name}
                    data-testid={`memory-session-file-${dimension}`}
                  >
                    <FileText aria-hidden />
                    <span className="min-w-0 truncate">{file.name}</span>
                  </Button>
                ))}
              />
            )
          })}
        </div>
      </OverviewSection>
      <MemoryPreview file={selectedFile ?? null} onClose={() => setSelectedPath(null)} />
    </>
  )
}
export function MemoryUpdates({ sessionId }: { sessionId?: string | null }): React.JSX.Element {
  return <SessionMemory key={sessionId ?? 'empty'} sessionId={sessionId} />
}
