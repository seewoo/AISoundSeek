import { useState, useEffect, useRef } from 'react'
import { useSearch, usePlayer } from '../store'
import type { AudioFile, CustomCategory, CopyrightType, BatchAnalyzeProgress } from '../../shared/types'
import { formatDuration, CATEGORY_COLORS, CATEGORY_LABELS, COPYRIGHT_COLORS, COPYRIGHT_LABELS } from '../lib/utils'
import { PlayIcon, PauseIcon, SparklesIcon } from './Icons'
import { updateAudio, batchUpdateAudio, listCustomCategories } from '../lib/api'
import { useToast } from '../store/ToastContext'
import { useBatchAnalyze } from '../store/BatchAnalyzeContext'
import { useAiConfig } from '../hooks/useAiConfig'
import { CategoryBadge } from './audio/CategoryBadge'
import { CopyrightBadge } from './audio/CopyrightBadge'
import { WaveformCell } from './audio/WaveformCell'

interface Props {
  onSelect: (audio: AudioFile) => void
  selectedId?: number
}

type SortCol = 'title' | 'duration' | 'rating'

function SortIndicator({ col, current, order }: { col: SortCol; current?: string; order?: string }) {
  if (current !== col) return <span className="ml-1 opacity-30">↕</span>
  return <span className="ml-1 text-primary-400">{order === 'asc' ? '↑' : '↓'}</span>
}

export function AudioList({ onSelect, selectedId }: Props) {
  const { results, loading, params, setParams, refresh } = useSearch()
  const { currentTrack, isPlaying, currentTime, togglePlay, setQueue } = usePlayer()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [batchCategory, setBatchCategory] = useState('')
  const [batchCopyright, setBatchCopyright] = useState<CopyrightType | ''>('')
  const [progress, setProgress] = useState<BatchAnalyzeProgress | null>(null)
  const toast = useToast()
  const { isAnalyzing, progress: ctxProgress, startBatchAnalyze } = useBatchAnalyze()
  const { isConfigured } = useAiConfig()

  // Measure list container width to decide whether to show waveform column
  const listContainerRef = useRef<HTMLDivElement>(null)
  const [listWidth, setListWidth] = useState(0)

  useEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w !== undefined) setListWidth(Math.floor(w))
    })
    ro.observe(el)
    setListWidth(el.clientWidth)
    return () => ro.disconnect()
  // Re-run when loading finishes / results appear so the ref div is in the DOM
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, results.length])

  // Show waveform column only when there's enough room (>720px)
  // Waveform column width = 25% of container, clamped between 120px and 300px
  const WAVEFORM_THRESHOLD = 720
  const showWaveform = listWidth >= WAVEFORM_THRESHOLD
  const waveformColWidth = showWaveform
    ? Math.min(300, Math.max(120, Math.floor(listWidth * 0.25)))
    : 0

  // All categories: built-in + custom
  const allCategories = [
    ...Object.entries(CATEGORY_LABELS).map(([name, label]) => ({ name, label, color: CATEGORY_COLORS[name as keyof typeof CATEGORY_COLORS] })),
    ...customCategories.map(c => ({ name: c.name, label: c.label, color: c.color })),
  ]

  useEffect(() => {
    listCustomCategories().then(setCustomCategories).catch(console.error)
  }, [])

  // 同步上下文中的进度状态，并在分析完成时刷新列表和清除选择
  useEffect(() => {
    if (ctxProgress) {
      setProgress(ctxProgress)
      if ((ctxProgress as any).done) {
        refresh() // 刷新列表以更新 AI 分析状态
        setSelected(new Set()) // 清除选择
      }
    }
  }, [ctxProgress, refresh])

  // Clear selection when results change
  useEffect(() => { setSelected(new Set()) }, [results])

  const handleSort = (col: SortCol) => {
    if (params.sortBy === col) {
      setParams({ sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultOrder = col === 'title' ? 'asc' : 'desc'
      setParams({ sortBy: col, sortOrder: defaultOrder })
    }
  }

  const handlePlay = (e: React.MouseEvent, audio: AudioFile) => {
    e.stopPropagation()
    if (currentTrack?.id === audio.id) {
      togglePlay()
    } else {
      const idx = results.indexOf(audio)
      setQueue(results, idx)
    }
  }

  const toggleSelect = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(results.map(a => a.id)))
    }
  }

  const handleBatchCategory = async () => {
    if (!batchCategory || selected.size === 0) return
    try {
      await batchUpdateAudio(Array.from(selected), { category: batchCategory })
      setSelected(new Set())
      setBatchCategory('')
      refresh()
    } catch (e) {
      console.error(e)
    }
  }

  const handleBatchCopyright = async () => {
    if (!batchCopyright || selected.size === 0) return
    try {
      await batchUpdateAudio(Array.from(selected), { copyright: batchCopyright })
      setSelected(new Set())
      setBatchCopyright('')
      refresh()
    } catch (e) {
      console.error(e)
    }
  }

  const handleBatchAnalyze = async () => {
    if (selected.size === 0 || isAnalyzing) return
    if (!isConfigured) {
      toast.error('请先在设置中配置 API Key 再使用 AI 分析功能')
      return
    }
    await startBatchAnalyze(Array.from(selected), {
      concurrency: 2,
      autoApply: true,
    })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">🎵</div>
          <div>没有找到音频文件</div>
          <div className="text-xs mt-1 text-ink-4">请先添加音频目录并扫描</div>
        </div>
      </div>
    )
  }

  const allSelected = selected.size === results.length && results.length > 0
  const someSelected = selected.size > 0

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Batch action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary-900/30 border-b border-primary-700/50 flex-shrink-0">
          <span className="text-xs text-primary-300 font-medium">已选 {selected.size} 项</span>

          {/* 批量分析 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchAnalyze}
              disabled={isAnalyzing}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-1.5"
              title="批量 AI 分析"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              {isAnalyzing ? `分析中 ${progress?.current}/${progress?.total}` : 'AI 分析'}
            </button>
          </div>

          <div className="w-px h-4 bg-rim-2 flex-shrink-0" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-2">批量改类别：</span>
            <select
              className="select text-xs w-32"
              value={batchCategory}
              onChange={e => setBatchCategory(e.target.value)}
            >
              <option value="">选择类别</option>
              {allCategories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.label}</option>
              ))}
            </select>
            <button
              onClick={handleBatchCategory}
              disabled={!batchCategory}
              className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              应用
            </button>
          </div>
          <div className="w-px h-4 bg-rim-2 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-2">批量改版权：</span>
            <select
              className="select text-xs w-24"
              value={batchCopyright}
              onChange={e => setBatchCopyright(e.target.value as CopyrightType | '')}
            >
              <option value="">选择版权</option>
              {(Object.entries(COPYRIGHT_LABELS) as [CopyrightType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              onClick={handleBatchCopyright}
              disabled={!batchCopyright}
              className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              应用
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-ink-3 hover:text-ink-2 transition-colors"
          >
            取消选择
          </button>
        </div>
      )}

      <div ref={listContainerRef} className="flex-1 overflow-y-auto py-2 px-2">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-xs text-ink-3 font-medium border-b border-rim mb-1">
          {/* Select all checkbox */}
          <div className="w-4 flex-shrink-0">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded accent-primary-500 cursor-pointer"
            />
          </div>
          <div className="w-8 flex-shrink-0" />
          <button
            className="flex-1 min-w-0 text-left flex items-center hover:text-ink-2 transition-colors"
            onClick={() => handleSort('title')}
          >
            标题 / 文件名
            <SortIndicator col="title" current={params.sortBy} order={params.sortOrder} />
          </button>
          {showWaveform && (
            <div className="flex-shrink-0" style={{ width: waveformColWidth }}>波形</div>
          )}
          <button
            className="w-14 text-right flex items-center justify-end hover:text-ink-2 transition-colors flex-shrink-0"
            onClick={() => handleSort('duration')}
          >
            <SortIndicator col="duration" current={params.sortBy} order={params.sortOrder} />
            时长
          </button>
          <div className="w-24 hidden md:block">艺术家</div>
          <div className="w-16">类别</div>
          <div className="w-16">版权</div>
          <div className="w-8 text-center" title="AI 分析状态">
            <SparklesIcon className="w-3.5 h-3.5 text-ink-4 mx-auto" />
          </div>
        </div>

        {results.map((audio, idx) => {
          const isCurrentTrack = currentTrack?.id === audio.id
          const isCurrentPlaying = isCurrentTrack && isPlaying
          const isChecked = selected.has(audio.id)

          return (
            <div
              key={audio.id}
              onClick={() => onSelect(audio)}
              className={`audio-row ${selectedId === audio.id ? 'audio-row-active' : ''} ${isChecked ? 'bg-primary-900/20' : ''}`}
            >
              {/* Checkbox */}
              <div className="w-4 flex-shrink-0" onClick={e => toggleSelect(e, audio.id)}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 rounded accent-primary-500 cursor-pointer"
                />
              </div>

              {/* Play button */}
              <button
                onClick={(e) => handlePlay(e, audio)}
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                  isCurrentTrack
                    ? 'text-primary-400 bg-primary-900/30'
                    : 'text-ink-2 hover:text-ink hover:bg-surface-btn-hov'
                }`}
              >
                {isCurrentPlaying ? (
                  <PauseIcon className="w-4 h-4" />
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
              </button>

              {/* Title / filename */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isCurrentTrack ? 'text-primary-400' : 'text-ink'}`}>
                  {audio.title || audio.fileName}
                </div>
                {audio.title && audio.title !== audio.fileName && (
                  <div className="text-xs text-ink-3 truncate">{audio.fileName}</div>
                )}
                {audio.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {audio.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0 rounded bg-surface-btn text-ink-2 border border-rim">
                        {tag}
                      </span>
                    ))}
                    {audio.tags.length > 3 && (
                      <span className="text-xs text-ink-4">+{audio.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Waveform */}
              {showWaveform && (
                <div className="flex-shrink-0 flex items-center" style={{ width: waveformColWidth }}>
                  <WaveformCell
                    audio={audio}
                    isCurrentTrack={isCurrentTrack}
                    currentTime={isCurrentTrack ? currentTime : 0}
                    width={waveformColWidth}
                  />
                </div>
              )}

              {/* Duration */}
              <div className="w-14 flex-shrink-0 text-right text-xs text-ink-2 font-mono">
                {formatDuration(audio.duration)}
              </div>

              {/* Artist */}
              <div className="w-24 hidden md:block text-xs text-ink-2 truncate">{audio.artist || '—'}</div>

              {/* Category — inline editable */}
              <CategoryBadge audio={audio} allCategories={allCategories} onUpdated={() => refresh()} />

              {/* Copyright — inline editable */}
              <CopyrightBadge audio={audio} onUpdated={() => refresh()} />

              {/* AI Analyzed Status Badge */}
              <div className="w-8 flex-shrink-0 flex items-center justify-center">
                {audio.aiAnalyzed && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: '#6366f115',
                      border: '1px solid #6366f130',
                    }}
                    title="已完成 AI 分析"
                  >
                    <SparklesIcon className="w-3 h-3 text-indigo-400" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
