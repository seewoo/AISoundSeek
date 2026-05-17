/**
 * 首次登录引导弹窗
 * 引导用户对音频库进行AI分析
 */

import React, { useState, useEffect } from 'react'
import type { UnanalyzedStats, BatchAnalyzeProgress } from '../../shared/types'
import { useBatchAnalyze } from '../store/BatchAnalyzeContext'
import { estimateTokenConsumption } from '../../shared/tokenEstimate'

interface WelcomeAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
}

const electronAPI = (window as any).electronAPI

export function WelcomeAnalysisModal({ isOpen, onClose }: WelcomeAnalysisModalProps) {
  const [stats, setStats] = useState<UnanalyzedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<BatchAnalyzeProgress | null>(null)
  const { isAnalyzing, progress: ctxProgress, startBatchAnalyze } = useBatchAnalyze()

  // 加载统计数据
  useEffect(() => {
    if (isOpen) {
      loadStats()
    }
  }, [isOpen])

  const loadStats = async () => {
    setLoading(true)
    try {
      const resp = await electronAPI.getUnanalyzedStats()
      if (resp.success) {
        setStats(resp.data)
      }
    } catch (e: any) {
      console.error('Failed to load unanalyzed stats:', e)
    } finally {
      setLoading(false)
    }
  }

  // 同步上下文进度，并在分析完成时关闭弹窗
  useEffect(() => {
    if (ctxProgress) {
      setProgress(ctxProgress)
      if ((ctxProgress as any).done) {
        onClose()
      }
    }
  }, [ctxProgress, onClose])

  const handleStartAnalysis = async () => {
    if (!stats || stats.total === 0) return
    await startBatchAnalyze(undefined, {
      concurrency: 2,
      autoApply: true,
    })
  }

  const handleRemindLater = () => {
    // 保存"稍后提醒"标记，下次启动时再显示
    localStorage.setItem('analysisRemindLater', 'true')
    localStorage.setItem('analysisRemindTime', Date.now().toString())
    onClose()
  }

  const handleDontShowAgain = () => {
    // 不再提示
    localStorage.setItem('analysisDontShow', 'true')
    onClose()
  }

  if (!isOpen) return null

  // 估算token消耗（每秒 5 tokens）
  const estimatedTokens = estimateTokenConsumption(stats?.totalDuration || 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            欢迎使用 AI 音频分析功能
          </h2>
          <p className="text-blue-100 mt-2">让AI为你的音频库添加智能标签和描述</p>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">正在检测音频库...</p>
            </div>
          ) : stats && stats.total > 0 ? (
            <div className="space-y-6">
              {/* 统计卡片 */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">检测到未分析的音频</h3>
                  <span className="text-3xl font-bold text-blue-500">{stats.total}</span>
                </div>

                <div className="space-y-2 text-sm text-slate-400">
                  {stats.byDirectory.slice(0, 3).map((dir, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate mr-4">{dir.label}</span>
                      <span className="text-blue-400 font-medium">{dir.count} 个</span>
                    </div>
                  ))}
                  {stats.byDirectory.length > 3 && (
                    <div className="text-slate-500 text-xs pt-2">
                      以及其他 {stats.byDirectory.length - 3} 个目录...
                    </div>
                  )}
                </div>
              </div>

              {/* AI分析说明 */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">🤖 AI 分析可以为你做什么？</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• 自动生成音频描述（内容、情感、用途）</li>
                  <li>• 智能提取标签（风格、乐器、场景等）</li>
                  <li>• 识别音频类别（对话、音效、背景音乐等）</li>
                </ul>
              </div>

              {/* Token消耗提示 */}
              <div className="flex items-start gap-3 text-sm">
                <span className="text-2xl">💡</span>
                <div className="flex-1 text-slate-400">
                  <p>预计消耗约 <span className="text-yellow-400 font-semibold">{estimatedTokens.toLocaleString()}</span> tokens</p>
                  <p className="text-xs mt-1 text-slate-500">分析过程可能需要几分钟，请保持应用开启</p>
                </div>
              </div>

              {/* 进度条 */}
              {isAnalyzing && progress && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">
                      {progress.currentFile ? `正在分析: ${progress.currentFile}` : '正在分析...'}
                    </span>
                    <span className="text-blue-400 font-medium">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-2 text-slate-500">
                    <span>成功: {progress.success}</span>
                    <span>失败: {progress.failed}</span>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                           disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed
                           text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200
                           transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isAnalyzing ? '正在分析中...' : '立即开始分析'}
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={handleRemindLater}
                    disabled={isAnalyzing}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 px-4 rounded-lg
                             transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    稍后提醒
                  </button>
                  <button
                    onClick={handleDontShowAgain}
                    disabled={isAnalyzing}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 px-4 rounded-lg
                             transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    不再提示
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="text-6xl">✅</span>
              <h3 className="text-xl font-semibold text-white mt-4">太棒了！</h3>
              <p className="text-slate-400 mt-2">你的音频库已经全部分析完成</p>
              <button
                onClick={onClose}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 px-8 rounded-lg
                         transition-colors"
              >
                开始使用
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
