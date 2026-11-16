import { createContext, useContext } from 'react'

export const MEMORY_DIMENSIONS = [
  'background',
  'collaboration',
  'expression',
  'focus',
  'progress',
] as const
export type MemoryDimension = (typeof MEMORY_DIMENSIONS)[number]
export type MemoryScope = 'global' | 'project'
export const MEMORY_DIMENSION_SCOPE: Record<MemoryDimension, MemoryScope> = {
  background: 'global',
  collaboration: 'project',
  expression: 'project',
  focus: 'project',
  progress: 'project',
}
export interface MemoryEntry {
  id: string
  dimension: MemoryDimension
  content: string
  previous?: string
  change: 'added' | 'updated'
  sessionId: string
  source: string
  updatedAt: string
}
export interface MemoryGroup {
  id: string
  scope: MemoryScope
  name: string
  path: string
  entries: readonly MemoryEntry[]
}
export interface MemoryState {
  enabled: Record<MemoryScope, boolean>
  groups: readonly MemoryGroup[]
  setEnabled(scope: MemoryScope, enabled: boolean): void
  clear(id: string): void
}
// A missing provider keeps unconnected production surfaces hidden.
export const MemoryContext = createContext<MemoryState | null>(null)
export const useMemory = (): MemoryState | null => useContext(MemoryContext)
