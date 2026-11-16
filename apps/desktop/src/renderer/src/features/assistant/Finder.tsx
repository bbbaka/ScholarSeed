import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton, SearchBox } from '../../components/ui'
import { conversationMatches, nextOccurrence } from './find'

const MATCH_HIGHLIGHT = 'conversation-find-match'
const ACTIVE_HIGHLIGHT = 'conversation-find-active'

export function ConversationFinder({
  root,
  focusRequest,
  onClose,
}: {
  root: React.RefObject<HTMLDivElement | null>
  focusRequest: number
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation('assistant')
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [ranges, setRanges] = useState<Range[]>([])
  const [active, setActive] = useState(0)

  useLayoutEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    return () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])

  useLayoutEffect(() => {
    const content = root.current
    if (!content) return
    const refresh = () => {
      const matches = conversationMatches(content, query)
      setRanges(matches)
      setActive((current) => Math.min(current, Math.max(0, matches.length - 1)))
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(content, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [query, root])

  useLayoutEffect(() => {
    const highlights = CSS.highlights
    const all = new Highlight(...ranges)
    const selected = new Highlight(...(ranges[active] ? [ranges[active]] : []))
    selected.priority = 1
    highlights.set(MATCH_HIGHLIGHT, all)
    highlights.set(ACTIVE_HIGHLIGHT, selected)
    return () => {
      if (highlights.get(MATCH_HIGHLIGHT) === all) highlights.delete(MATCH_HIGHLIGHT)
      if (highlights.get(ACTIVE_HIGHLIGHT) === selected) highlights.delete(ACTIVE_HIGHLIGHT)
    }
  }, [ranges, active])

  useEffect(() => {
    const match = ranges[active]
    const content = root.current
    if (!match || !content) return
    const bounds = match.getBoundingClientRect()
    const viewport = content.getBoundingClientRect()
    if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
      content.scrollTop += bounds.top - viewport.top - viewport.height / 2
    }
  }, [ranges, active, root])

  const navigate = (direction: number) =>
    setActive((current) => nextOccurrence(current, direction, ranges.length))
  return (
    <div
      role="search"
      aria-label={t('find.label')}
      data-testid="conversation-find"
      className="flex shrink-0 items-center gap-[var(--vds-space-1)] border-b border-[var(--vds-border-primary)] px-[var(--vds-space-3)] py-[var(--vds-space-2)]"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        } else if (event.key === 'Enter' && event.target === inputRef.current) {
          event.preventDefault()
          navigate(event.shiftKey ? -1 : 1)
        }
      }}
    >
      <SearchBox
        ref={inputRef}
        value={query}
        aria-label={t('find.label')}
        placeholder={t('find.placeholder')}
        containerClassName="min-w-0 flex-1"
        size="sm"
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
        }}
      />
      <span
        role="status"
        aria-live="polite"
        className="shrink-0 whitespace-nowrap px-[var(--vds-space-1)] text-[length:var(--vds-font-body-lv1)] text-[var(--vds-text-secondary)]"
      >
        {query && !ranges.length
          ? t('find.empty')
          : t('find.count', { current: ranges.length ? active + 1 : 0, total: ranges.length })}
      </span>
      <IconButton
        size="sm"
        variant="ghostIcon"
        label={t('find.previous')}
        icon={<ArrowUp />}
        disabled={!ranges.length}
        onClick={() => navigate(-1)}
      />
      <IconButton
        size="sm"
        variant="ghostIcon"
        label={t('find.next')}
        icon={<ArrowDown />}
        disabled={!ranges.length}
        onClick={() => navigate(1)}
      />
      <IconButton
        size="sm"
        variant="ghostIcon"
        label={t('find.close')}
        icon={<X />}
        onClick={onClose}
      />
    </div>
  )
}
