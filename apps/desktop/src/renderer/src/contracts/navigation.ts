import { createContext } from 'react'
import type { ReviseMessage } from './editing'

export const MessageRevisionContext = createContext<ReviseMessage | null>(null)

export const NavigationRecoveryContext = createContext<(() => void) | null>(null)

export const LiteratureConversationContext = createContext<
  ((taskId: string, paperIds: string[]) => Promise<string>) | null
>(null)

export interface ScheduleCreationSeed {
  name: string
  prompt: string
}

export const ScheduleCreationContext = createContext<((seed: ScheduleCreationSeed) => void) | null>(
  null
)

export const WebNavigationContext = createContext<(url: string, onOpened?: () => void) => void>(
  () => {
    throw new Error('web_navigation_unavailable')
  }
)
