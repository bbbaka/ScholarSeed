import type * as React from 'react'
import { useRef, useState } from 'react'
import {
  Compass,
  Database,
  Gift,
  Globe,
  GraduationCap,
  LogOut,
  MessageCircleQuestionMark,
  Settings,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import type { AccountMenuAction, AccountMenuView, MenuItem, MenuValue } from '../../../../menu'
import { MENU_ACTION } from '../../../../menu'
import { SYSTEM_LANGUAGE_MODE } from '../../../../preferences'
import { FEEDBACK_SHORTCUT } from '../../../../feedback'
import { currentShortcutPlatform } from '../../shortcuts'
import { IconFont } from '../primitive'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../ui'
import { accountMenuItems, accountMenuText } from './accountview'

const ACCOUNT_ICONS = {
  [MENU_ACTION.login]: GraduationCap,
  [MENU_ACTION.credits]: Database,
  [MENU_ACTION.creditsMore]: Gift,
  [MENU_ACTION.guide]: Compass,
  [MENU_ACTION.feedback]: MessageCircleQuestionMark,
  [MENU_ACTION.settings]: Settings,
  [MENU_ACTION.logout]: LogOut,
} as const
const ACCOUNT_ICON_SIZE = 16
const ACCOUNT_LOGIN_TEST_ID = 'account-menu-anonymous-login'
const ACCOUNT_NAME_TEST_ID = 'account-menu-name'

export function AccountMenuPanel({
  view,
  onAction,
}: {
  view: AccountMenuView
  onAction(action: AccountMenuAction, value: MenuValue): void
}): React.JSX.Element {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const languageTrigger = useRef<HTMLButtonElement | null>(null)
  const translate = accountMenuText(view.locale)
  const credits = view.credits
  const balance =
    credits.phase === 'loading'
      ? '…'
      : credits.phase === 'error' || (credits.value === null && !credits.unlimited)
        ? '--'
        : credits.unlimited
          ? translate('accountMenu.unlimited')
          : new Intl.NumberFormat(view.locale, { maximumFractionDigits: 0 }).format(
              Math.floor(credits.value!)
            )
  return (
    <>
      {accountMenuItems(view).map((item) => {
        if (item.kind === 'separator') return <DropdownMenuSeparator key={item.id} />
        if (item.kind === 'submenu') {
          const appearance = item.id === MENU_ACTION.appearance
          const selected = item.items.find(
            (option): option is Extract<MenuItem, { kind: 'action' }> =>
              option.kind === 'action' && option.checked
          )
          const AppearanceIcon =
            view.theme === 'dark' ? Moon : view.theme === 'system' ? Monitor : Sun
          return (
            <DropdownMenuSub
              key={item.id}
              open={openSubmenu === item.id}
              onOpenChange={(open) =>
                setOpenSubmenu((current) => (open ? item.id : current === item.id ? null : current))
              }
            >
              <DropdownMenuSubTrigger
                data-testid={appearance ? 'account-menu-appearance' : 'account-menu-language'}
                className="min-w-0"
                disabled={view.logoutBusy}
                showArrow={false}
                onFocus={(event) => {
                  languageTrigger.current = event.currentTarget
                }}
              >
                {appearance ? (
                  <AppearanceIcon size={ACCOUNT_ICON_SIZE} />
                ) : (
                  <Globe size={ACCOUNT_ICON_SIZE} />
                )}
                <span className="min-w-0 flex-1 truncate text-left">
                  {translate(appearance ? 'preferences.appearance' : 'preferences.language')}
                </span>
                <span className="min-w-0 truncate text-right text-[var(--vds-text-tertiary)]">
                  {selected?.label}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className="w-max min-w-[var(--vds-account-language-menu-min-width)]!"
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft') return
                  event.preventDefault()
                  setOpenSubmenu(null)
                  languageTrigger.current?.focus({ preventScroll: true })
                }}
              >
                {item.items.map(
                  (option) =>
                    option.kind === 'action' && (
                      <DropdownMenuItem
                        key={option.id}
                        role="menuitemradio"
                        aria-checked={option.checked}
                        className="h-auto! whitespace-nowrap p-[var(--vds-space-2)]! aria-checked:bg-[var(--vds-surface-hover)]"
                        disabled={option.disabled}
                        onClick={(event) => {
                          event.preventDefault()
                          if (option.disabled) return
                          onAction(option.actionId as AccountMenuAction, option.value)
                          setOpenSubmenu(null)
                          languageTrigger.current?.focus({ preventScroll: true })
                        }}
                      >
                        {appearance ? (
                          option.value.kind === 'choice' && option.value.value === 'dark' ? (
                            <Moon size={ACCOUNT_ICON_SIZE} />
                          ) : option.value.kind === 'choice' && option.value.value === 'system' ? (
                            <Monitor size={ACCOUNT_ICON_SIZE} />
                          ) : (
                            <Sun size={ACCOUNT_ICON_SIZE} />
                          )
                        ) : option.value.kind === 'choice' &&
                          option.value.value === SYSTEM_LANGUAGE_MODE ? (
                          <Globe className="size-[var(--vds-icon-8)] shrink-0 text-[var(--vds-text-tertiary)]" />
                        ) : (
                          <IconFont
                            type={
                              option.value.kind === 'choice' && option.value.value === 'en'
                                ? 'icon-yingwen'
                                : 'icon-zhongwen'
                            }
                            className="inline-flex size-[var(--vds-icon-8)] shrink-0 items-center justify-center text-[length:var(--vds-icon-8)] leading-none text-[var(--vds-text-tertiary)]"
                          />
                        )}
                        {option.label}
                      </DropdownMenuItem>
                    )
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        }
        const IconComponent = ACCOUNT_ICONS[item.actionId as keyof typeof ACCOUNT_ICONS]
        return (
          <DropdownMenuItem
            key={item.id}
            className="min-w-0"
            data-testid={
              item.actionId === MENU_ACTION.login
                ? ACCOUNT_LOGIN_TEST_ID
                : `account-menu-${item.actionId.slice('account.'.length)}`
            }
            disabled={item.disabled}
            destructive={item.actionId === MENU_ACTION.logout}
            onClick={(event) => {
              event.preventDefault()
              if (!item.disabled) onAction(item.actionId as AccountMenuAction, item.value)
            }}
          >
            {item.actionId === MENU_ACTION.profile ? (
              <span
                aria-hidden
                className="grid size-[var(--vds-space-7)] place-items-center rounded-[var(--vds-radius-circle)] bg-[var(--vds-brand-light-bg-default)] text-[var(--vds-brand-text-primary)]"
              >
                {view.avatar}
              </span>
            ) : (
              IconComponent && <IconComponent size={ACCOUNT_ICON_SIZE} />
            )}
            <span
              data-testid={item.actionId === MENU_ACTION.profile ? ACCOUNT_NAME_TEST_ID : undefined}
              className="min-w-0 flex-1 truncate"
            >
              {item.label}
            </span>
            {item.actionId === MENU_ACTION.feedback && (
              <DropdownMenuShortcut>
                {currentShortcutPlatform() === 'mac'
                  ? FEEDBACK_SHORTCUT.macLabel
                  : FEEDBACK_SHORTCUT.otherLabel}
              </DropdownMenuShortcut>
            )}
            {item.actionId === MENU_ACTION.credits && (
              <span
                data-testid="account-menu-credits-value"
                className="flex-none tabular-nums text-[var(--vds-text-secondary)]"
              >
                {balance}
              </span>
            )}
          </DropdownMenuItem>
        )
      })}
      {!view.alias && <DropdownMenuLabel>{translate('accountMenu.loginHint')}</DropdownMenuLabel>}
      {view.logoutError && (
        <div role="alert" className="px-[var(--vds-space-2)] text-[var(--vds-error-text-primary)]">
          {view.logoutError}
        </div>
      )}
    </>
  )
}
