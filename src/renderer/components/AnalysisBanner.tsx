/**
 * 智能横幅提示组件
 * 非侵入式地提示用户有未分析的音频文件
 */

import React, { useState, useEffect } from 'react'
import type { UnanalyzedStats, BatchAnalyzeProgress } from '../../shared/types'
import { useBatchAnalyze } from '../store/BatchAnalyzeContext'
import { estimateTokenConsumption } from '../../shared/tokenEstimate'

interface AnalysisBannerProps {
  onStartAnalysis?: () => void
}

const electronAPI = (window as any).electronAPI

export function AnalysisBanner({ onStartAnalysis }: AnalysisBannerProps) {
  const [stats, setStats] = useState<UnanalyzedStats | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('analysisBannerDismissed')
    if (!saved) return false
    const savedTime = parseInt(localStorage.getItem('analysisBannerDismissTime') || '0', 10)
    // 关闭状态 24 小时后自动重置
    return Date.now() - savedTime < 24 * 60 * 60 * 1000
  })
  const [progress, setProgress] = useState<BatchAnalyzeProgress | null>(null)
  const { isAnalyzing, progress: ctxProgress, startBatchAnalyze } = useBatchAnalyze()

  // 加载统计数据
  useEffect(() => {
    loadStats()
    // 每30秒刷新一次
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // 同步上下文进度，并在分析完成时重新加载统计
  useEffect(() => {
    if (ctxProgress) {
      setProgress(ctxProgress)
      if ((ctxProgress as any).done) {
        loadStats() // 重新加载统计
      }
    }
  }, [ctxProgress])

  const loadStats = async () => {
    try {
      const resp = await electronAPI.getUnanalyzedStats()
      if (resp.success && resp.data.total > 0) {
        setStats(resp.data)
      } else {
        setStats(null)
      }
    } catch (e: any) {
      console.error('Failed to load unanalyzed stats:', e)
    }
  }

  const handleStartAnalysis = async () => {
    if (!stats) return
    await startBatchAnalyze(undefined, {
      concurrency: 2,
      autoApply: true,
    })
    onStartAnalysis?.()
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('analysisBannerDismissed', 'true')
    localStorage.setItem('analysisBannerDismissTime', Date.now().toString())
  }

  // 如果已关闭或没有未分析文件，不显示
  if (dismissed || !stats || stats.total < 1) return null

  const estimatedTokens = estimateTokenConsumption(stats.totalDuration)

  return (
    <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-blue-500/20 backdrop-blur-sm">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：信息 */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="text-2xl">🔍</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink">
                  发现 <span className="text-blue-500 font-bold">{stats.total}</span> 个未分析音频
                </span>
                <span className="text-xs text-ink-3">
                  消耗约 {estimatedTokens.toLocaleString()} tokens
                </span>
                {!expanded && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    详情
                  </button>
                )}
              </div>

              {/* 展开详情 */}
              {expanded && (
                <div className="mt-2 text-xs text-ink-3 space-y-1">
                  {stats.byDirectory.slice(0, 3).map((dir, idx) => (
                    <div key={idx} className="flex justify-between max-w-md">
                      <span className="truncate mr-4">{dir.label}</span>
                      <span className="text-blue-400">{dir.count} 个</span>
                    </div>
                  ))}
                  {stats.byDirectory.length > 3 && (
                    <div className="text-ink-3">
                      以及其他 {stats.byDirectory.length - 3} 个目录...
                    </div>
                  )}
                </div>
              )}

              {/* 进度条 */}
              {isAnalyzing && progress && (
                <div className="mt-2 max-w-md">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-3 truncate">
                      {progress.currentFile || '正在分析...'}
                    </span>
                    <span className="text-blue-400">
                      {progress.current}/{progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-btn rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-surface-btn disabled:text-ink-3 disabled:cursor-not-allowed
                       text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors border border-transparent disabled:border-rim"
            >
              {isAnalyzing ? '分析中...' : '开始分析'}
            </button>

            {expanded && (
              <button
                onClick={() => setExpanded(false)}
                className="text-ink-3 hover:text-ink transition-colors p-2"
                title="收起"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}

            <button
              onClick={handleDismiss}
              disabled={isAnalyzing}
              className="text-ink-3 hover:text-ink transition-colors p-2 disabled:opacity-50"
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
