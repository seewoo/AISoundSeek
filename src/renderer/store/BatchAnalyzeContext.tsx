/**
 * 批量分析 Context
 * 集中管理批量分析进度监听和通知，避免多个组件重复监听导致重复弹窗
 */

import { createContext, useState, useCallback, useContext, useEffect, ReactNode } from 'react'
import type { BatchAnalyzeProgress } from '../../shared/types'
import { useToast } from './ToastContext'
import * as api from '../lib/api'

interface BatchAnalyzeContextValue {
  progress: BatchAnalyzeProgress | null
  isAnalyzing: boolean
  startBatchAnalyze: (fileIds?: number[], options?: { concurrency?: number; autoApply?: boolean }) => Promise<void>
}

export const BatchAnalyzeContext = createContext<BatchAnalyzeContextValue | null>(null)

interface BatchAnalyzeProviderProps {
  children: ReactNode
  onAnalysisComplete?: () => void
}

export function BatchAnalyzeProvider({ children, onAnalysisComplete }: BatchAnalyzeProviderProps) {
  const [progress, setProgress] = useState<BatchAnalyzeProgress | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const toast = useToast()

  // 监听批量分析进度（仅在此处监听，避免重复弹窗）
  useEffect(() => {
    const unsubscribe = api.onBatchProgress((prog: BatchAnalyzeProgress) => {
      setProgress(prog)

      if ((prog as any).done) {
        setIsAnalyzing(false)

        // 统一在此处处理完成通知
        if (prog.stopped) {
          if (prog.stopReason === 'api_key_invalid') {
            toast.error('API Key 无效，分析已停止。请在设置中配置正确的 API Key。')
          } else if (prog.stopReason === 'api_error') {
            toast.error('AI 接口错误，分析已停止')
          } else {
            toast.warning(`批量分析已停止。成功 ${prog.success} 个，失败 ${prog.failed} 个`)
          }
        } else {
          toast.success(`批量分析完成！成功 ${prog.success} 个，失败 ${prog.failed} 个`)
        }

        onAnalysisComplete?.()
      }
    })

    return unsubscribe
  }, [toast, onAnalysisComplete])

  const startBatchAnalyze = useCallback(async (
    fileIds?: number[],
    options?: { concurrency?: number; autoApply?: boolean }
  ) => {
    setIsAnalyzing(true)

    // 初始化进度
    setProgress({ current: 0, total: fileIds?.length || 0, success: 0, failed: 0 })

    try {
      await api.batchAnalyze(fileIds, {
        concurrency: options?.concurrency ?? 2,
        autoApply: options?.autoApply ?? false,
      })
    } catch (e: any) {
      toast.error(e.message || '批量分析失败')
      setIsAnalyzing(false)
    }
  }, [toast])

  const value: BatchAnalyzeContextValue = {
    progress,
    isAnalyzing,
    startBatchAnalyze,
  }

  return (
    <BatchAnalyzeContext.Provider value={value}>
      {children}
    </BatchAnalyzeContext.Provider>
  )
}

export function useBatchAnalyze() {
  const context = useContext(BatchAnalyzeContext)
  if (!context) {
    throw new Error('useBatchAnalyze must be used within BatchAnalyzeProvider')
  }
  return context
}
