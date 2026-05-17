import { useEffect } from 'react'
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from './Icons'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number  // 0 表示不自动消失
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastItemProps {
  toast: ToastItem
  onClose: () => void
}

function getTypeStyles(type: ToastItem['type']): string {
  switch (type) {
    case 'success':
      return 'bg-green-500/10 border-green-500/30 text-green-400'
    case 'error':
      return 'bg-red-500/10 border-red-500/30 text-red-400'
    case 'warning':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    case 'info':
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  }
}

function getIcon(type: ToastItem['type']) {
  switch (type) {
    case 'success':
      return CheckCircleIcon
    case 'error':
      return XCircleIcon
    case 'warning':
      return ExclamationTriangleIcon
    case 'info':
      return InformationCircleIcon
  }
}

function ToastItemComponent({ toast, onClose }: ToastItemProps) {
  const Icon = getIcon(toast.type)

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, onClose])

  return (
    <div
      className={`
        rounded-lg border shadow-lg backdrop-blur-sm
        animate-slide-in-right
        ${getTypeStyles(toast.type)}
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="font-semibold text-sm mb-1">{toast.title}</div>
          )}
          <div className="text-sm leading-relaxed">{toast.message}</div>
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors font-medium"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="关闭"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-[400px]">
      {toasts.slice(0, 3).map(toast => (
        <ToastItemComponent
          key={toast.id}
          toast={toast}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}
