import { useState, useRef, useEffect } from 'react'
import type { AudioFile, AiChatMessage } from '../../shared/types'
import { aiChatSearch } from '../lib/api'
import { usePlayer } from '../store'
import { useAiConfig } from '../hooks/useAiConfig'
import { useToast } from '../hooks/useToast'
import { useAiErrorHandler } from '../hooks/useAiErrorHandler'
import { XMarkIcon, SparklesIcon, PlayIcon, PauseIcon } from './Icons'
import { CATEGORY_LABELS, CATEGORY_COLORS, formatDuration } from '../lib/utils'
import { useAiChat } from '../store/AiChatContext'
import type { MessageEntry } from '../store/AiChatContext'
import { AiSessionList } from './AiSessionList'
export type { MessageEntry } from '../store/AiChatContext'

interface Props {
  onSelectAudio: (audio: AudioFile) => void
}

export function AiChatPanel({ onSelectAudio }: Props) {
  const {
    messages, setMessages, setShowAiChat,
    currentSessionId, sessions,
    createNewSession, loadSession, deleteSession, renameSession, autoNameSession,
  } = useAiChat()
  const { isConfigured } = useAiConfig()
  const toast = useToast()
  const { handleError } = useAiErrorHandler({ showToast: true })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'chat' | 'sessions'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer()

  const buildHistory = (entries: MessageEntry[]): AiChatMessage[] => {
    const result: AiChatMessage[] = []
    for (const e of entries) {
      if (e.type === 'user') {
        result.push({ role: 'user', content: e.text })
      } else if (e.type === 'assistant') {
        result.push({ role: 'assistant', content: e.rawJson ?? e.text })
      }
    }
    return result
  }

  const handleSend = async () => {
    if (!isConfigured) {
      toast.error('请先在设置中配置 AI 提供商和 API Key')
      return
    }

    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const isFirstMessage = messages.length === 0

    const userEntry: MessageEntry = { type: 'user', text }
    const nextEntries = [...messages, userEntry]
    setMessages(nextEntries)
    setLoading(true)

    if (isFirstMessage) {
      autoNameSession(text).catch(() => { /* ignore */ })
    }

    try {
      const history = buildHistory(nextEntries)
      const res = await aiChatSearch(history)
      const reasons: Record<number, string> = {}
      for (const p of res.picks) reasons[p.id] = p.reason
      setMessages(prev => [...prev, {
        type: 'assistant',
        text: res.reply,
        rawJson: JSON.stringify({ reply: res.reply, picks: res.picks }),
        items: res.items,
        reasons,
      }])
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (view === 'chat') inputRef.current?.focus()
  }, [view])

  const currentSessionName = sessions.find(s => s.id === currentSessionId)?.name ?? '新会话'

  const handleSelectSession = async (id: number) => {
    await loadSession(id)
    setView('chat')
  }

  const handleCreateSession = async () => {
    await createNewSession()
    setView('chat')
  }

  return (
    <div className="w-80 flex-shrink-0 bg-surface border-l border-rim flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rim flex-shrink-0">
        {view === 'sessions' ? (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('chat')}
                className="btn-ghost w-7 h-7 p-0"
                title="返回"
              >
                {/* Left chevron inline SVG */}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-ink">会话历史</span>
            </div>
            <button onClick={() => setShowAiChat(false)} className="btn-ghost w-7 h-7 p-0">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SparklesIcon className="w-4 h-4 text-primary-400 flex-shrink-0" />
              <span
                className="text-sm font-semibold text-ink truncate"
                title={currentSessionName}
              >
                {currentSessionName}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* History button */}
              <button
                onClick={() => setView('sessions')}
                className="btn-ghost w-7 h-7 p-0"
                title="会话历史"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
                </svg>
              </button>
              {/* New session */}
              <button
                onClick={createNewSession}
                className="btn-ghost w-7 h-7 p-0"
                title="新建会话"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button onClick={() => setShowAiChat(false)} className="btn-ghost w-7 h-7 p-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      {view === 'sessions' ? (
        <AiSessionList
          sessions={sessions}
          currentId={currentSessionId}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          onRename={renameSession}
          onDelete={deleteSession}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-3">
                <SparklesIcon className="w-8 h-8 text-primary-500/50" />
                <div className="text-sm text-ink-2 leading-relaxed">
                  用自然语言描述你想要的音频，AI 将从本地音频库中为你推荐匹配的文件。
                </div>
                <div className="text-xs text-ink-3 space-y-1">
                  <div>例如：找一首紧张刺激的战斗配乐</div>
                  <div>例如：需要安静的环境音，用于办公场景</div>
                  <div>例如：有没有幽默搞笑风格的短音效</div>
                </div>
              </div>
            )}

            {messages.map((entry, i) => {
              if (entry.type === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] bg-primary-600 text-white text-sm rounded-2xl rounded-tr-sm px-3 py-2 leading-relaxed select-text">
                      {entry.text}
                    </div>
                  </div>
                )
              }

              if (entry.type === 'error') {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[90%] bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2 select-text">
                      ✗ {entry.text}
                    </div>
                  </div>
                )
              }

              // assistant
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-start">
                    <div className="max-w-[90%] bg-surface-card text-ink text-sm rounded-2xl rounded-tl-sm px-3 py-2 leading-relaxed select-text">
                      <span className="text-primary-400 font-semibold text-xs mr-1">✨ AI</span>
                      {entry.text}
                    </div>
                  </div>

                  {entry.items.length > 0 && (
                    <div className="space-y-1.5">
                      {entry.items.map(audio => {
                        const isCurrentPlaying = currentTrack?.id === audio.id && isPlaying
                        const catLabel = CATEGORY_LABELS[audio.category as keyof typeof CATEGORY_LABELS] ?? audio.category
                        const catColor = CATEGORY_COLORS[audio.category as keyof typeof CATEGORY_COLORS] ?? '#64748b'
                        return (
                          <div
                            key={audio.id}
                            className="bg-surface-card border border-rim rounded-xl p-2.5 hover:border-rim-2 transition-colors cursor-pointer group"
                            onClick={() => onSelectAudio(audio)}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-primary-600/20 hover:bg-primary-600 text-primary-400 hover:text-white transition-colors mt-0.5"
                                onClick={e => {
                                  e.stopPropagation()
                                  if (isCurrentPlaying) { togglePlay() } else { play(audio) }
                                }}
                              >
                                {isCurrentPlaying
                                  ? <PauseIcon className="w-3.5 h-3.5" />
                                  : <PlayIcon className="w-3.5 h-3.5" />
                                }
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-ink truncate leading-tight select-text">
                                  {audio.title || audio.fileName}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: `${catColor}20`, color: catColor }}
                                  >
                                    {catLabel}
                                  </span>
                                  <span className="text-[10px] text-ink-3">{formatDuration(audio.duration)}</span>
                                </div>
                                {entry.reasons[audio.id] && (
                                  <div className="text-[10px] text-ink-3 mt-1 leading-relaxed line-clamp-2 select-text">
                                    {entry.reasons[audio.id]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {entry.items.length === 0 && (
                    <div className="text-xs text-ink-4 pl-2 select-text">未找到匹配的音频文件</div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-card text-ink-2 text-xs rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                  <span className="animate-pulse">✨ AI 正在分析...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-rim flex-shrink-0">
            {!isConfigured && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>请先在设置中配置 API Key 以使用 AI 助手</span>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="input flex-1 text-sm resize-none min-h-[36px] max-h-24 py-2 leading-relaxed"
                placeholder={isConfigured ? "描述你想找的音频..." : "请先在设置中配置 API Key..."}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || !isConfigured}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !isConfigured}
                className="btn-primary h-9 px-3 text-xs flex-shrink-0 disabled:opacity-40"
              >
                发送
              </button>
            </div>
            <div className="text-[10px] text-ink-3 mt-1.5">Enter 发送 · Shift+Enter 换行</div>
          </div>
        </>
      )}
    </div>
  )
}
