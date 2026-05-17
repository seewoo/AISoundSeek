import { createContext, useState, useCallback, useContext, ReactNode } from 'react'
import { ToastItem, ToastContainer } from '../components/Toast'

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (toast: Omit<ToastItem, 'id'>) => string
  hideToast: (id: string) => void
  // 便捷方法
  success: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => void
  error: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => void
  warning: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => void
  info: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: ToastItem = {
      ...toast,
      id,
      duration: toast.duration ?? 4000,
    }
    setToasts(prev => [...prev, newToast].slice(-5)) // 保留最近 5 个
    return id
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => {
      showToast({ type: 'success', message, ...options })
    },
    [showToast]
  )

  const error = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => {
      showToast({ type: 'error', message, ...options })
    },
    [showToast]
  )

  const warning = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => {
      showToast({ type: 'warning', message, ...options })
    },
    [showToast]
  )

  const info = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => {
      showToast({ type: 'info', message, ...options })
    },
    [showToast]
  )

  const value = { toasts, showToast, hideToast, success, error, warning, info }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={hideToast} />
    </ToastContext.Provider>
  )
}

// 导出 useToast hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
