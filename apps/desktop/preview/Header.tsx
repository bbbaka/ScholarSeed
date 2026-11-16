import React from 'react'
import { CircleHelp, PanelRight, PanelsTopLeft, RefreshCw, RotateCw, Scan } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle, IconButton } from '../src/renderer/src/components/ui'
import type { PdfeDock } from '../src/pdfe.ts'
import type zh from './locales/zh.json'

const ICON_CLASS = 'size-[var(--vds-icon-8)]'

export function PdfeHeader({ dock, pending, translate, onHelp, onDock, onReload, onScreenshot, onRestart }: {
  dock: PdfeDock
  pending: boolean
  translate: (key: keyof typeof zh) => string
  onHelp: () => void
  onDock: () => void
  onReload: () => void
  onScreenshot?: () => void
  onRestart?: () => void
}): React.JSX.Element {
  return <div className="grid min-w-0 gap-[var(--vds-space-4)]">
    <div className="flex min-w-0 items-center justify-between gap-[var(--vds-space-2)]">
      <DialogHeader className="min-w-0 flex-1">
        <DialogTitle className="truncate">{translate('title')}</DialogTitle>
        <DialogDescription className="sr-only">{translate('description')}</DialogDescription>
      </DialogHeader>
      <div role="group" aria-label={translate('workbenchActions')} className="flex shrink-0 items-center gap-[var(--vds-space-1)]">
        <IconButton variant="ghost" size="sm" label={translate('guide')} icon={<CircleHelp className={ICON_CLASS} />} onClick={onHelp} />
        {onScreenshot && <IconButton variant="ghost" size="sm" label={translate('screenshotMark')} icon={<Scan className={ICON_CLASS} />} disabled={pending} onClick={onScreenshot} />}
        <IconButton variant="ghost" size="sm" data-testid="preview-dock" label={translate(dock === 'docked' ? 'detachWorkbench' : 'dockWorkbench')} icon={dock === 'docked' ? <PanelsTopLeft className={ICON_CLASS} /> : <PanelRight className={ICON_CLASS} />} disabled={pending} onClick={onDock} />
        <IconButton variant="ghost" size="sm" label={translate('reload')} icon={<RefreshCw className={ICON_CLASS} />} disabled={pending} onClick={onReload} />
        {onRestart && <IconButton variant="ghost" size="sm" label={translate('restart')} icon={<RotateCw className={ICON_CLASS} />} disabled={pending} onClick={onRestart} />}
      </div>
    </div>
  </div>
}
