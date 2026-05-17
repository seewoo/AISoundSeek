import { useState, useCallback } from 'react'
import { useToast } from './useToast'

interface AiErrorHandlerOptions {
  /** Called when API key is invalid (401) — typically opens Settings */
  onApiKeyInvalid?: () => void
  showToast?: boolean
}

export interface AiErrorInfo {
  title: string
  message: string
  suggestion?: string
  action?: () => void
  actionLabel?: string
}

interface AiErrorHandlerResult {
  handleError: (error: any) => void
  aiError: AiErrorInfo | null
  setAiError: (error: AiErrorInfo | null) => void
}

export function useAiErrorHandler(options: AiErrorHandlerOptions = {}): AiErrorHandlerResult {
  const toast = useToast()
  const [aiError, setAiError] = useState<AiErrorInfo | null>(null)
  const { onApiKeyInvalid, showToast: shouldShowToast = true } = options

  const handleError = useCallback((error: any) => {
    const code = error?.code ?? 500
    const message = error?.message ?? 'AI 请求失败'

    if (code === 401 || code === 400) {
      // API Key invalid or missing — prompt user to go to settings
      if (shouldShowToast) {
        toast.error('请在设置中配置 API Key 后再使用 AI 功能')
      }
      setAiError({ title: 'API Key 无效', message: '请在设置中配置有效的 API Key' })
      onApiKeyInvalid?.()
      return
    }

    // General AI errors
    if (shouldShowToast) {
      toast.error(message)
    }
    setAiError({ title: 'AI 请求失败', message })
  }, [toast, shouldShowToast, onApiKeyInvalid])

  return { handleError, aiError, setAiError }
}
