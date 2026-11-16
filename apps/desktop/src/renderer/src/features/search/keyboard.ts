import { currentShortcutPlatform, matchesBinding } from '../../shortcuts.ts'

type SearchKeyEvent = Pick<
  KeyboardEvent,
  | 'key'
  | 'metaKey'
  | 'ctrlKey'
  | 'shiftKey'
  | 'altKey'
  | 'repeat'
  | 'isComposing'
  | 'defaultPrevented'
> & { keyCode?: number }

export function searchShortcut(
  event: SearchKeyEvent,
  platform = currentShortcutPlatform()
): 'project' | 'conversation' | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229)
    return null
  if (matchesBinding(event, { key: 'k', modifiers: ['primary'] }, platform)) return 'project'
  if (matchesBinding(event, { key: 'f', modifiers: ['primary'] }, platform)) return 'conversation'
  return null
}

export function searchIsBlocked(): boolean {
  return [...document.querySelectorAll('[aria-modal="true"], .vds-modal-scrim')].some(
    (element) => element.getClientRects().length > 0
  )
}
