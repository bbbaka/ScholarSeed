import type { MessageReference } from '../model'

export interface MessageRevision {
  sessionId: string
  itemId: string
  turnId: string
  text: string
  references: MessageReference[]
  requestId: string
}

export interface MessageRevisionResult {
  sessionId: string
  itemId: string
  turnId: string
  title: string
  projectPath: string | null
}

export type ReviseMessage = (revision: MessageRevision) => Promise<MessageRevisionResult>
