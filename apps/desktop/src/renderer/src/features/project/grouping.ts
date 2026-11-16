import type { ServeSession } from '../../api'
import type { SessionGroup } from '../../contracts/features'

export type NavigationSession = ServeSession & {
  navigationGroup?: string
  navigationIcon?: SessionGroup['icon']
  navigationActions?: SessionGroup['renderActions']
}

export function unrepresentedGroups(
  rows: NavigationSession[],
  groups: SessionGroup[]
): SessionGroup[] {
  const represented = new Set(rows.map((row) => row.navigationGroup))
  return groups.filter((group) => group.open && !represented.has(group.id))
}

export function groupSessions(
  rows: ServeSession[],
  groups: SessionGroup[],
  active: string | null
): NavigationSession[] {
  const membership = new Map(
    groups.flatMap((group) => group.sessionIds.map((id) => [id, group] as const))
  )
  const available = new Map(rows.map((row) => [row.session_id, row]))
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    const group = membership.get(row.session_id)
    if (!group) return [row]
    if (seen.has(group.id)) return []
    seen.add(group.id)
    const selected = active && group.sessionIds.includes(active) ? available.get(active) : undefined
    const entry = selected ?? available.get(group.entrySessionId) ?? row
    return [
      {
        ...entry,
        title: group.title,
        title_fallback: undefined,
        display_parent_session_id: null,
        navigationGroup: group.id,
        navigationIcon: group.icon,
        navigationActions: group.renderActions,
      },
    ]
  })
}
