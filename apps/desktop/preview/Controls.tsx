import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../src/renderer/src/components/ui'
import { PREFERENCE_LANGUAGES, PREFERENCE_THEMES, type PreferenceLanguage, type PreferenceTheme } from '../src/preferences.ts'
import { isPreviewLoginMode, PREVIEW_LOGIN, type PreviewLoginMode } from './accounts.ts'
import type zh from './locales/zh.json'

const SETTINGS_OPEN_KEY = 'pdfe-settings-open'
const SETTINGS_OPEN_VALUE = 'true'
const SETTINGS_ICON_CLASS = 'size-[var(--vds-icon-8)] shrink-0'

function ControlSelect({ id, label, value, choices, disabled, onChange }: {
  id: string
  label: string
  value: string
  choices: readonly { id: string; title: string }[]
  disabled: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return <div className="grid min-w-0 gap-[var(--vds-space-1)]">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled} size="standard">
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent className="!z-[var(--vds-z-modal-nested-flyout)]">{choices.map(choice => <SelectItem key={choice.id} value={choice.id}>{choice.title}</SelectItem>)}</SelectContent>
    </Select>
  </div>
}

export function PdfeControls({ theme, language, login, accountControl, pending, translate, onTheme, onLanguage, onLogin }: {
  theme: PreferenceTheme
  language: PreferenceLanguage
  login?: PreviewLoginMode
  accountControl: boolean
  pending: boolean
  translate: (key: keyof typeof zh) => string
  onTheme: (value: PreferenceTheme) => void
  onLanguage: (value: PreferenceLanguage) => void
  onLogin: (value: PreviewLoginMode) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(() => sessionStorage.getItem(SETTINGS_OPEN_KEY) === SETTINGS_OPEN_VALUE)
  const loginTitle = (mode: PreviewLoginMode) => translate(mode === 'ready' ? 'mockLoggedIn' : 'mockLoggedOut')
  const languageTitle = (value: PreferenceLanguage) => translate(value === 'zh' ? 'chinese' : 'english')
  const summary = [
    ...(accountControl && login !== undefined ? [loginTitle(login)] : []),
    translate(theme),
    languageTitle(language),
  ].join(' / ')

  return <Collapsible open={open} onOpenChange={value => {
    setOpen(value)
    if (value) sessionStorage.setItem(SETTINGS_OPEN_KEY, SETTINGS_OPEN_VALUE)
    else sessionStorage.removeItem(SETTINGS_OPEN_KEY)
  }}>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" data-testid="preview-settings-toggle" className="w-full min-w-0 !justify-between text-left">
        <span className="shrink-0">{translate('previewSettings')}</span>
        {!open && <span className="min-w-0 flex-1 truncate text-[var(--vds-text-secondary)]" title={summary}>{summary}</span>}
        {open ? <ChevronDown aria-hidden="true" className={SETTINGS_ICON_CLASS} /> : <ChevronRight aria-hidden="true" className={SETTINGS_ICON_CLASS} />}
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="!rounded-none !border-0 !bg-transparent !p-0 !text-inherit">
      <div role="group" aria-label={translate('publicControls')} className="grid min-w-0 grid-cols-2 gap-[var(--vds-space-2)]">
        {accountControl && <div className="col-span-2 min-w-0"><ControlSelect id="preview-login" label={translate('loginState')} value={login ?? ''} choices={PREVIEW_LOGIN.modes.map(id => ({ id, title: loginTitle(id) }))} disabled={pending || login === undefined} onChange={value => { if (isPreviewLoginMode(value)) onLogin(value) }} /></div>}
        <ControlSelect id="preview-theme" label={translate('theme')} value={theme} choices={PREFERENCE_THEMES.map(id => ({ id, title: translate(id) }))} disabled={pending} onChange={value => { if (PREFERENCE_THEMES.includes(value as PreferenceTheme)) onTheme(value as PreferenceTheme) }} />
        <ControlSelect id="preview-language" label={translate('language')} value={language} choices={PREFERENCE_LANGUAGES.map(id => ({ id, title: languageTitle(id) }))} disabled={pending} onChange={value => { if (PREFERENCE_LANGUAGES.includes(value as PreferenceLanguage)) onLanguage(value as PreferenceLanguage) }} />
      </div>
    </CollapsibleContent>
  </Collapsible>
}
