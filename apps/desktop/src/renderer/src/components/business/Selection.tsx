import React from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Hammer, Paperclip, Upload, X } from 'lucide-react'
import type { SkillInfo } from '../../api'
import { isAbsoluteInputPath } from '../../input'
import { skillCategory, skillDescription, skillName } from '../../skill'
import { Icon } from '../../icons'
import {
  Button,
  EmptyState,
  IconButton,
  SearchBox,
  Tooltip,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../ui'

export const COMPOSER_SELECTION_PAGE_SIZE = 10
const PLUS_MENU_PAGE_SIZE = COMPOSER_SELECTION_PAGE_SIZE
const skillPanelClass = [
  'flex max-h-[var(--vds-composer-selection-max-height)] w-[var(--vds-composer-selection-width)] min-w-0 flex-col overflow-hidden bg-[var(--vds-surface-raised)] p-0',
].join(' ')
const skillPanelHeadClass = [
  'grid flex-none gap-[var(--vds-space-2)] border-b border-[var(--border-soft)]',
  'bg-[var(--bg-2)] px-[var(--vds-space-2)] pb-[var(--vds-space-3)] pt-[var(--vds-space-2)]',
].join(' ')
const skillMenuRowClass =
  'w-full rounded-[var(--vds-radius-3)] border-0 px-[var(--vds-space-3)] py-[calc(var(--vds-space-2)+var(--vds-border-width-1))] text-left text-[length:var(--vds-font-body-lv2)] leading-[var(--vds-lh-body-lv2)] font-[var(--vds-fw-regular)] hover:bg-[var(--vds-bg-white-hover-transparent)] focus:bg-[var(--vds-bg-white-hover-transparent)]'

export function selectFirstMenuItem(event: React.KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
  const first = event.currentTarget.querySelector<HTMLButtonElement>(
    '[role="menuitem"]:not(:disabled)'
  )
  if (!first) return
  event.preventDefault()
  event.stopPropagation()
  first.click()
}

export function SkillSelection({
  panelRef: skillPanelRef,
  searchRef: skillSearchRef,
  query: skillQuery,
  onQueryChange: setSkillQuery,
  visibleCount: skillVisibleCount,
  onVisibleCountChange: setSkillVisibleCount,
  rows: skillRows,
  loading: skillRowsLoading,
  onSelect,
  onUpload,
  onExplore,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>
  searchRef: React.RefObject<HTMLInputElement | null>
  query: string
  onQueryChange: React.Dispatch<React.SetStateAction<string>>
  visibleCount: number
  onVisibleCountChange: React.Dispatch<React.SetStateAction<number>>
  rows: SkillInfo[] | null
  loading: boolean
  onSelect: (skill: SkillInfo & { path: string }) => void
  onUpload: () => void
  onExplore: () => void
}): React.JSX.Element {
  const { t, i18n } = useTranslation('components')
  const { t: skillText } = useTranslation('skills')
  return (
    <div
      ref={skillPanelRef}
      className={skillPanelClass}
      onKeyDown={(event) => {
        if (
          event.target instanceof Element &&
          Boolean(event.target.closest('[data-composer-skill-option]')) &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          ((event.key.length === 1 && event.key !== ' ') || event.key === 'Backspace')
        ) {
          event.preventDefault()
          event.stopPropagation()
          setSkillQuery((current) =>
            event.key === 'Backspace' ? current.slice(0, -1) : current + event.key
          )
          setSkillVisibleCount(PLUS_MENU_PAGE_SIZE)
          skillSearchRef.current?.focus()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        if (
          (event.key === 'Home' || event.key === 'End') &&
          event.target instanceof HTMLInputElement
        )
          return
        const rows = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[data-composer-skill-option]'
          ),
        ]
        if (!rows.length) return
        event.preventDefault()
        event.stopPropagation()
        const current = rows.indexOf(document.activeElement as HTMLButtonElement)
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : event.key === 'ArrowDown'
                ? (current + 1) % rows.length
                : (current - 1 + rows.length) % rows.length
        rows[index].focus()
        rows[index].scrollIntoView({ block: 'nearest' })
      }}
    >
      <div className={skillPanelHeadClass}>
        <div className="relative">
          <SearchBox
            ref={skillSearchRef}
            value={skillQuery}
            onChange={(event) => {
              setSkillQuery(event.target.value)
              setSkillVisibleCount(PLUS_MENU_PAGE_SIZE)
            }}
            placeholder={t('composer.searchSkills')}
            aria-label={t('composer.searchSkillsLabel')}
            size="sm"
          />
          {skillQuery && (
            <IconButton
              className="absolute right-[var(--vds-space-1)] top-1/2 -translate-y-1/2"
              icon={<X size={13} />}
              label={t('composer.clearSearch')}
              onClick={() => {
                setSkillQuery('')
                setSkillVisibleCount(PLUS_MENU_PAGE_SIZE)
              }}
              size="xs"
              variant="ghost"
            />
          )}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain" data-testid="composer-skill-list">
        {skillRowsLoading || skillRows === null ? (
          <p className="m-[var(--vds-space-0)] px-[var(--vds-space-3)] py-[var(--vds-space-3)] text-[length:var(--vds-font-body-lv2)] text-[var(--text-3)]">
            {t('composer.loadSkills')}
          </p>
        ) : (
          (() => {
            const query = skillQuery.trim().toLowerCase()
            const language = i18n.resolvedLanguage || i18n.language
            const rows = skillRows
              .filter(
                (skill): skill is SkillInfo & { path: string } =>
                  skill.enabled !== false &&
                  skill.active !== false &&
                  (!skill.dependency_status || skill.dependency_status === 'ready') &&
                  isAbsoluteInputPath(skill.path)
              )
              .filter(
                (skill) =>
                  !query ||
                  skill.name.toLowerCase().includes(query) ||
                  skillName(skill, language).toLowerCase().includes(query) ||
                  skillDescription(skill, language).toLowerCase().includes(query)
              )
            if (!rows.length) {
              return (
                <EmptyState
                  variant="compact"
                  icon={<Icon name="search" />}
                  title={t('composer.emptySkills')}
                />
              )
            }
            const visibleRows = rows.slice(0, skillVisibleCount)
            return [
              ...visibleRows.map((skill) => {
                const description = skillDescription(skill, language)
                return (
                  <Tooltip
                    key={skill.name}
                    className="!w-full"
                    content={description}
                    disabled={!description}
                    portalled
                    side="right"
                  >
                    <span className="block w-full">
                      <Button
                        type="button"
                        data-testid={`composer-skill-${skill.name}`}
                        data-composer-skill-option
                        role="menuitem"
                        variant="ghost"
                        size="content"
                        unstyled
                        className={`block ${skillMenuRowClass}`}
                        onClick={() => onSelect(skill)}
                      >
                        <span className="flex min-w-0 flex-wrap items-center justify-between gap-[var(--vds-space-2)]">
                          <span className="min-w-0 whitespace-normal break-words text-[length:var(--vds-font-body-lv2)] font-[var(--vds-fw-regular)] text-[var(--vds-text-primary)]">
                            {skillName(skill, language)}
                          </span>
                          {skill.category ? (
                            <span className="flex-none whitespace-nowrap rounded-[var(--vds-radius-2)] bg-[var(--bg-3)] px-[var(--vds-space-2)] py-[var(--vds-space-half)] text-[length:var(--vds-font-caption)] text-[var(--text-3)]">
                              {skillCategory(skill, skillText)}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                    </span>
                  </Tooltip>
                )
              }),
              rows.length > visibleRows.length ? (
                <Button
                  type="button"
                  key="composer-skill-more"
                  data-testid="composer-skill-more"
                  variant="ghost"
                  size="content"
                  unstyled
                  className="flex w-full items-center justify-center border-0 px-[var(--vds-space-3)] py-[var(--vds-space-2)] text-[length:var(--vds-font-body-lv2)] text-[var(--text-3)] hover:bg-[var(--vds-bg-white-hover-transparent)] hover:text-[var(--text)]"
                  onClick={() => setSkillVisibleCount((count) => count + PLUS_MENU_PAGE_SIZE)}
                >
                  {t('composer.viewMore')} ({rows.length - visibleRows.length})
                </Button>
              ) : null,
            ]
          })()
        )}
      </div>
      <div className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--bg-2)] p-[calc(var(--vds-space-1)+var(--vds-border-width-1))] [&_button]:!font-[var(--vds-fw-regular)]">
        <Button
          data-testid="composer-skill-upload"
          variant="ghost"
          size="content"
          unstyled
          className={`flex items-center justify-start gap-[var(--vds-space-2)] ${skillMenuRowClass}`}
          icon={<Upload aria-hidden className="size-[var(--vds-icon-7)]" />}
          onClick={onUpload}
        >
          {t('composer.uploadSkill')}
        </Button>
        <Button
          data-testid="composer-skill-market"
          variant="ghost"
          size="content"
          unstyled
          className={`flex items-center justify-start gap-[var(--vds-space-2)] ${skillMenuRowClass}`}
          icon={<Hammer aria-hidden className="size-[var(--vds-icon-7)]" />}
          onClick={onExplore}
        >
          {t('composer.skillMarket')}
        </Button>
      </div>
    </div>
  )
}

export function ComposerMenuEntries({
  skillsOpen,
  onSkillsOpenChange,
  skills,
  onFile,
  onFolder,
  children,
  submenuClassName,
}: {
  skillsOpen: boolean
  onSkillsOpenChange: (open: boolean) => void
  skills: React.ReactNode
  onFile: () => void
  onFolder?: () => void
  children?: React.ReactNode
  submenuClassName?: string
}): React.JSX.Element {
  const { t } = useTranslation('components')
  return (
    <>
      <DropdownMenuSub open={skillsOpen} onOpenChange={onSkillsOpenChange}>
        <DropdownMenuSubTrigger data-testid="composer-skills-menu" openOnHover>
          <Hammer className="size-[var(--vds-icon-8)]" />
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
            {t('composer.skill')}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          coordinateNavigation
          data-testid="composer-plus-submenu"
          className={submenuClassName}
          onKeyDown={selectFirstMenuItem}
        >
          {skills}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem data-testid="composer-add-file" onSelect={onFile}>
        <Paperclip className="size-[var(--vds-icon-8)]" />
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
          {t('composer.addLocal')}
        </span>
      </DropdownMenuItem>
      {onFolder && (
        <DropdownMenuItem data-testid="composer-add-folder" onSelect={onFolder}>
          <Folder className="size-[var(--vds-icon-8)]" />
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
            {t('composer.addLocalFolder')}
          </span>
        </DropdownMenuItem>
      )}
      {children}
    </>
  )
}
