import {
  MEMORY_DIMENSIONS,
  type MemoryDimension,
  type MemoryEntry,
  type MemoryGroup,
} from './context'

const FILE_NAMES: Record<MemoryDimension, string> = {
  background: 'background.md',
  collaboration: 'collaboration.md',
  expression: 'expression.md',
  focus: 'research-focus.md',
  progress: 'research-progress.md',
}
export interface MemoryFile {
  name: string
  path: string
  dimension?: MemoryDimension
  entries: readonly MemoryEntry[]
  updatedAt: string
}
export function memoryFiles(group: MemoryGroup, sessionId?: string): MemoryFile[] {
  const entries = group.entries.filter(
    (entry) => sessionId === undefined || entry.sessionId === sessionId
  )
  if (!entries.length) return []
  const file = (
    name: string,
    items: readonly MemoryEntry[],
    dimension?: MemoryDimension
  ): MemoryFile => ({
    name,
    path: `${group.path}${name}`,
    dimension,
    entries: items,
    updatedAt: items
      .map((entry) => entry.updatedAt)
      .sort()
      .at(-1)!,
  })
  return [
    ...(sessionId === undefined ? [file('MEMORY.md', entries)] : []),
    ...MEMORY_DIMENSIONS.flatMap((dimension) => {
      const items = entries.filter((entry) => entry.dimension === dimension)
      return items.length ? [file(FILE_NAMES[dimension], items, dimension)] : []
    }),
  ]
}
