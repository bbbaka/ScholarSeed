import type { HistoryTurn, HistoryMessageReference } from '../src/renderer/src/api.ts'
import type { MessageReference } from '../src/renderer/src/model.ts'

export const PREVIEW_REVISION = Object.freeze({
  action: 'revise-message',
  invalid: 'preview_revision_invalid',
  unavailable: 'preview_revision_unavailable',
  conflict: 'preview_revision_conflict',
  titlePrefix: '分支 · ',
  title: '科研 AI 工具比较',
})

export const PREVIEW_REVISION_TURNS = [
  { user: '请帮我比较面向科研人员的 AI 文献调研工具。', answer: '可以从检索覆盖、证据溯源和综述组织能力三个维度比较。你希望面向哪类使用者？' },
  { user: '面向博士生，重点比较证据溯源能力，结合附件整理成对照表，并列出各工具的使用限制。', answer: '可以按来源链接、原文定位、引用核验和适用边界整理对照表。以下内容仅为编辑消息的演示样例。' },
  { user: '再补充对中文文献的支持情况。', answer: '已在演示对照维度中补充中文检索与阅读支持。可编辑上一轮问题，新分支不会改变本对话。' },
] as const

export function revisionSnapshot(turns: readonly HistoryTurn[], turnId: string, itemId: string): HistoryTurn[] {
  const index = turns.findIndex(turn => turn.turn_id === turnId && turn.item_id === itemId)
  const selected = turns[index]
  if (!selected || selected.kind !== 'user' || selected.origin === 'steer' ||
    !turns.slice(0, index).some(turn => turn.kind === 'user' && turn.turn_id !== turnId)) {
    throw new Error(PREVIEW_REVISION.invalid)
  }
  return structuredClone(turns.slice(0, index))
}

export function revisionReferences(references: readonly MessageReference[]): HistoryMessageReference[] {
  return references.map(reference => ({
    type: reference.type, id: reference.id, title: reference.title,
    path: reference.path, kind: reference.kind, source_id: reference.sourceId,
    snapshot_id: reference.snapshotId, media_type: reference.mediaType,
    sha256: reference.sha256, size: reference.size,
    anchor: reference.anchor ? {
      document_id: reference.anchor.documentId,
      preview_text: reference.anchor.previewText,
      snapshot_text: reference.anchor.snapshotText,
      locator: reference.anchor.locator,
    } : null,
  }))
}
