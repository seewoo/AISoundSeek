import { useState, useRef, useEffect } from 'react'
import type { ChatSessionSummary } from '../../shared/types'
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from './Icons'

interface Props {
  sessions: ChatSessionSummary[]
  currentId: number | null
  onSelect: (id: number) => void
  onCreate: () => void
  onRename: (id: number, name: string) => void
  onDelete: (id: number) => void
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function AiSessionList({ sessions, currentId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus()
  }, [renamingId])

  const startRename = (id: number, currentName: string) => {
    setRenamingId(id)
    setRenameValue(currentName)
    setConfirmDeleteId(null)
  }

  const commitRename = (id: number) => {
    const name = renameValue.trim()
    if (name && name !== sessions.find(s => s.id === id)?.name) {
      onRename(id, name)
    }
    setRenamingId(null)
  }

  const cancelRename = () => setRenamingId(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New session button */}
      <div className="px-3 py-2 flex-shrink-0">
        <button
          onClick={onCreate}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600/10 hover:bg-primary-600/20 text-primary-400 text-sm transition-colors border border-primary-600/20"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>新建会话</span>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="text-xs text-ink-3 text-center py-8">暂无会话历史</div>
        )}
        {sessions.map(session => (
          <div
            key={session.id}
            className={`group relative rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
              session.id === currentId
                ? 'bg-primary-600/15 border border-primary-600/25'
                : 'hover:bg-surface-card border border-transparent'
            }`}
            onClick={() => { if (renamingId !== session.id) onSelect(session.id) }}
          >
            {renamingId === session.id ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  ref={renameInputRef}
                  className="input text-xs flex-1 h-6 py-0 px-1.5 min-w-0"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(session.id)
                    if (e.key === 'Escape') cancelRename()
                  }}
                />
                <button
                  className="btn-ghost w-5 h-5 p-0 text-primary-400"
                  onClick={() => commitRename(session.id)}
                >
                  <CheckIcon className="w-3 h-3" />
                </button>
                <button
                  className="btn-ghost w-5 h-5 p-0"
                  onClick={cancelRename}
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium text-ink truncate pr-12 leading-tight">
                  {session.name}
                </div>
                <div className="text-[10px] text-ink-3 mt-0.5 flex items-center gap-1.5">
                  <span>{session.messageCount > 0 ? `${session.messageCount} 条` : '空'}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(session.updatedAt)}</span>
                </div>

                {/* Action buttons — visible on hover */}
                <div
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className="btn-ghost w-5 h-5 p-0"
                    title="重命名"
                    onClick={() => startRename(session.id, session.name)}
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                  {confirmDeleteId === session.id ? (
                    <>
                      <button
                        className="btn-ghost w-5 h-5 p-0 text-red-400"
                        title="确认删除"
                        onClick={() => { onDelete(session.id); setConfirmDeleteId(null) }}
                      >
                        <CheckIcon className="w-3 h-3" />
                      </button>
                      <button
                        className="btn-ghost w-5 h-5 p-0"
                        title="取消"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-ghost w-5 h-5 p-0 hover:text-red-400"
                      title="删除"
                      onClick={() => setConfirmDeleteId(session.id)}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
