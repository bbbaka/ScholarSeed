import { MEMORY_REVIEW_ENTRIES } from './fixtures/memories'
import React, { useState } from 'react'
import { useApp } from '../src/renderer/src/store'
import {
  MemoryContext,
  MEMORY_DIMENSION_SCOPE,
  type MemoryEntry,
  type MemoryScope,
} from '../src/renderer/src/features/memory/context'
import { PREVIEW_PROJECT_ID } from './constants'

const MEMORY_SAMPLE_TIME = '2026-11-12T06:24:00Z'
const MEMORY_SAMPLE_SESSION = 'preview-session'
const MEMORY_SAMPLE_GLOBAL = 'global'
const sample = (
  id: string,
  dimension: MemoryEntry['dimension'],
  content: string,
  previous?: string
): MemoryEntry => ({
  id,
  dimension,
  content,
  previous,
  change: previous ? 'updated' : 'added',
  sessionId: MEMORY_SAMPLE_SESSION,
  updatedAt: MEMORY_SAMPLE_TIME,
  source: '本次会话 · 用户说明',
})
const SAMPLE_ENTRIES: MemoryEntry[] = [
  sample('background', 'background', '熟悉整数规划，正在学习 Python。'),
  sample('collaboration', 'collaboration', '方案先讨论确认，再执行。存在关键分歧时，先说明依据。'),
  sample(
    'expression',
    'expression',
    '回答简洁，优先使用表格和要点。解释编程操作时需要提供具体步骤。',
    '回答尽量详细，包含完整推导。'
  ),

  sample(
    'focus',
    'focus',
    'CPS/HCPS 综述聚焦体系架构，重点关注系统分层与人机协同。',
    '调研 CPS/HCPS 的体系架构、基础理论、关键技术与典型应用。'
  ),
  sample(
    'progress',
    'progress',
    '已确定综述范围。下一步补充检索 ACM TCPS 及 CPS 专门会议的相关论文。'
  ),
]

const GLOBAL_ENTRIES = SAMPLE_ENTRIES.filter(
  (entry) => MEMORY_DIMENSION_SCOPE[entry.dimension] === 'global'
)
const PROJECT_ENTRIES = SAMPLE_ENTRIES.filter(
  (entry) => MEMORY_DIMENSION_SCOPE[entry.dimension] === 'project'
)

export function PreviewMemoryProvider({
  children,
  empty = false,
  review = false,
}: {
  children: React.ReactNode
  empty?: boolean
  review?: boolean
}): React.JSX.Element {
  const { state } = useApp()
  const [enabled, setEnabled] = useState<Record<MemoryScope, boolean>>({
    global: true,
    project: true,
  })
  const [cleared, setCleared] = useState<readonly string[]>([])
  const groups = [
    {
      id: MEMORY_SAMPLE_GLOBAL,
      scope: 'global' as const,
      name: '',
      path: '~/.scholarseed/memory/',
      entries: empty || cleared.includes(MEMORY_SAMPLE_GLOBAL) ? [] : GLOBAL_ENTRIES,
    },
    ...state.projects.map((project) => ({
      id: project.id,
      scope: 'project' as const,
      name: project.name,
      path: `${project.path}/.scholarseed/service/memory/`,
      entries:
        !empty && project.id === PREVIEW_PROJECT_ID && !cleared.includes(project.id)
          ? [...PROJECT_ENTRIES, ...(review ? MEMORY_REVIEW_ENTRIES : [])]
          : [],
    })),
  ]
  return (
    <MemoryContext.Provider
      value={{
        enabled,
        groups,
        setEnabled: (scope, value) => setEnabled((current) => ({ ...current, [scope]: value })),
        clear: (id) => setCleared((current) => (current.includes(id) ? current : [...current, id])),
      }}
    >
      {children}
    </MemoryContext.Provider>
  )
}
