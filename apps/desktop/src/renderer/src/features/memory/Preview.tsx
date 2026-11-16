import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from '../../components/ui'
import { Markdown } from '../../components/primitive/Markdown'
import { MEMORY_DIMENSIONS } from './context'
import type { MemoryFile } from './files'

export function MemoryPreview({
  file,
  onClose,
  nested = false,
}: {
  file: MemoryFile | null
  onClose(): void
  nested?: boolean
}): React.JSX.Element {
  const { t } = useTranslation('memory')
  const text = file
    ? MEMORY_DIMENSIONS.flatMap((dimension) => {
        const entries = file.entries.filter((entry) => entry.dimension === dimension)
        if (!entries.length) return []
        return [`## ${t(dimension)}`, ...entries.map((entry) => `- ${entry.content}`)]
      }).join('\n\n')
    : ''
  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPortal>
        <DialogContent
          className={nested ? '!flex !flex-col !z-[var(--vds-z-modal-nested)]' : '!flex !flex-col'}
          overlayClassName={nested ? '!z-[var(--vds-z-modal-nested-overlay)]' : undefined}
          data-testid="memory-file-preview"
        >
          <DialogHeader>
            <DialogTitle>{file?.name}</DialogTitle>
            <DialogDescription className="!text-[length:var(--vds-font-body-lv1)] !leading-[var(--vds-lh-body-lv1)] !font-[var(--vds-fw-regular)]">
              <span className="block break-all">{file?.path}</span>
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 max-h-[var(--vds-dialog-list-max-height)] overflow-y-auto"
            data-testid="memory-document-content"
          >
            <Markdown
              text={text}
              className="![font-family:var(--vds-font-main)] !text-[length:var(--vds-font-body-lv2)] !leading-[var(--vds-lh-body-lv2)] !font-[var(--vds-fw-regular)] [&_.md-h]:!text-[length:var(--vds-font-subhead)] [&_.md-h]:!leading-[var(--vds-lh-subhead)] [&_.md-h]:!font-[var(--vds-fw-medium)] [&_strong]:!font-[var(--vds-fw-medium)]"
            />
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
