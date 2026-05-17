import {
  createContext,
  useState,
  useContext,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react'
import type { AudioFile } from '../../shared/types'

export type MessageEntry =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string; items: AudioFile[]; reasons: Record<number, string> }
  | { type: 'error'; text: string }

interface AiChatContextValue {
  showAiChat: boolean
  setShowAiChat: Dispatch<SetStateAction<boolean>>
  messages: MessageEntry[]
  setMessages: Dispatch<SetStateAction<MessageEntry[]>>
}

export const AiChatContext = createContext<AiChatContextValue | null>(null)

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [showAiChat, setShowAiChat] = useState(false)
  const [messages, setMessages] = useState<MessageEntry[]>([])
  return (
    <AiChatContext.Provider value={{ showAiChat, setShowAiChat, messages, setMessages }}>
      {children}
    </AiChatContext.Provider>
  )
}

export function useAiChat() {
  const context = useContext(AiChatContext)
  if (!context) throw new Error('useAiChat must be used within AiChatProvider')
  return context
}
