import {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react'
import type { AudioFile, ChatSession, ChatSessionSummary, StoredMessage } from '../../shared/types'
import {
  listSessions,
  getSession,
  createSession,
  saveSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
} from '../lib/api'

export type MessageEntry =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string; rawJson?: string; items: AudioFile[]; reasons: Record<number, string> }
  | { type: 'error'; text: string }

function toStored(entry: MessageEntry): StoredMessage {
  if (entry.type === 'user') return { type: 'user', text: entry.text }
  if (entry.type === 'error') return { type: 'error', text: entry.text }
  return {
    type: 'assistant',
    text: entry.text,
    rawJson: entry.rawJson,
    items: entry.items,
    reasons: Object.fromEntries(
      Object.entries(entry.reasons).map(([k, v]) => [String(k), v])
    ),
  }
}

function fromStored(msg: StoredMessage): MessageEntry {
  if (msg.type === 'user') return { type: 'user', text: msg.text }
  if (msg.type === 'error') return { type: 'error', text: msg.text }
  const reasons: Record<number, string> = {}
  if (msg.reasons) {
    for (const [k, v] of Object.entries(msg.reasons)) reasons[Number(k)] = v
  }
  return {
    type: 'assistant',
    text: msg.text,
    rawJson: msg.rawJson,
    items: msg.items ?? [],
    reasons,
  }
}

interface AiChatContextValue {
  showAiChat: boolean
  setShowAiChat: Dispatch<SetStateAction<boolean>>
  messages: MessageEntry[]
  setMessages: Dispatch<SetStateAction<MessageEntry[]>>
  currentSessionId: number | null
  sessions: ChatSessionSummary[]
  createNewSession: () => Promise<void>
  loadSession: (id: number) => Promise<void>
  deleteSession: (id: number) => Promise<void>
  renameSession: (id: number, name: string) => Promise<void>
  autoNameSession: (firstUserText: string) => Promise<void>
}

export const AiChatContext = createContext<AiChatContextValue | null>(null)

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [showAiChat, setShowAiChat] = useState(false)
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentSessionIdRef = useRef<number | null>(null)
  const messagesRef = useRef<MessageEntry[]>([])

  useEffect(() => { currentSessionIdRef.current = currentSessionId }, [currentSessionId])
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    const init = async () => {
      try {
        const sessionList = await listSessions()
        setSessions(sessionList)
        if (sessionList.length > 0) {
          const full = await getSession(sessionList[0].id)
          setCurrentSessionId(full.id)
          setMessages(full.messages.map(fromStored))
        } else {
          const newSess = await createSession('新会话')
          setCurrentSessionId(newSess.id)
          setSessions([toSummary(newSess, 0)])
          setMessages([])
        }
      } catch { /* DB may not be ready on first render */ }
    }
    init()
  }, [])

  // Auto-save with debounce
  useEffect(() => {
    if (currentSessionId === null || messages.length === 0) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const id = currentSessionIdRef.current
      if (id === null) return
      try {
        await saveSession(id, messagesRef.current.map(toStored))
        setSessions(prev =>
          prev.map(s => s.id === id ? { ...s, messageCount: messagesRef.current.length, updatedAt: Date.now() } : s)
        )
      } catch { /* ignore */ }
    }, 800)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [messages, currentSessionId])

  const flushSave = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const id = currentSessionIdRef.current
    const msgs = messagesRef.current
    if (id !== null && msgs.length > 0) {
      try { await saveSession(id, msgs.map(toStored)) } catch { /* ignore */ }
    }
  }

  const createNewSession = async () => {
    await flushSave()
    const newSess = await createSession('新会话')
    setCurrentSessionId(newSess.id)
    setMessages([])
    setSessions(prev => [toSummary(newSess, 0), ...prev])
  }

  const loadSession = async (id: number) => {
    await flushSave()
    const full = await getSession(id)
    setCurrentSessionId(full.id)
    setMessages(full.messages.map(fromStored))
  }

  const deleteSession = async (id: number) => {
    await apiDeleteSession(id)
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (id === currentSessionId) {
      if (remaining.length > 0) {
        const full = await getSession(remaining[0].id)
        setCurrentSessionId(full.id)
        setMessages(full.messages.map(fromStored))
      } else {
        const newSess = await createSession('新会话')
        setCurrentSessionId(newSess.id)
        setMessages([])
        setSessions([toSummary(newSess, 0)])
      }
    }
  }

  const renameSession = async (id: number, name: string) => {
    await apiRenameSession(id, name)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  const autoNameSession = async (firstUserText: string) => {
    const id = currentSessionIdRef.current
    if (id === null) return
    const current = sessions.find(s => s.id === id)
    if (!current || current.name !== '新会话') return
    const name = firstUserText.slice(0, 20)
    await renameSession(id, name)
  }

  return (
    <AiChatContext.Provider value={{
      showAiChat, setShowAiChat,
      messages, setMessages,
      currentSessionId, sessions,
      createNewSession, loadSession, deleteSession, renameSession, autoNameSession,
    }}>
      {children}
    </AiChatContext.Provider>
  )
}

export function useAiChat() {
  const context = useContext(AiChatContext)
  if (!context) throw new Error('useAiChat must be used within AiChatProvider')
  return context
}

function toSummary(session: ChatSession, messageCount: number): ChatSessionSummary {
  return { id: session.id, name: session.name, messageCount, createdAt: session.createdAt, updatedAt: session.updatedAt }
}
