/**
 * 渲染进程日志系统
 * 自动检测开发/生产环境，提供结构化日志输出
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: any
  requestId?: string
}

class Logger {
  private isDevelopment: boolean
  private requestIdCounter = 0

  constructor() {
    // 检测开发模式：localhost 或 127.0.0.1
    this.isDevelopment =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  }

  /**
   * 生成唯一的请求 ID
   * 格式：req_时间戳_计数器
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`
  }

  /**
   * 格式化日志条目
   * 格式：[时间] [级别] [请求ID] 消息
   */
  private formatLog(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString().split('T')[1].slice(0, 12)
    const prefix = `[${time}] [${entry.level.toUpperCase()}]`
    const reqId = entry.requestId ? ` [${entry.requestId}]` : ''

    return `${prefix}${reqId} ${entry.message}`
  }

  /**
   * 内部日志方法
   */
  private log(level: LogLevel, message: string, context?: any, requestId?: string) {
    // 生产模式：只记录错误
    if (!this.isDevelopment && level !== 'error') {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      requestId,
    }

    const formatted = this.formatLog(entry)

    // 控制台输出，带颜色样式
    const styles = {
      debug: 'color: #94a3b8',
      info: 'color: #3b82f6',
      warn: 'color: #f59e0b',
      error: 'color: #ef4444; font-weight: bold',
    }

    console.log(`%c${formatted}`, styles[level])

    // 开发模式下显示上下文对象
    if (context && this.isDevelopment) {
      console.log('%cContext:', 'color: #64748b; font-weight: bold', context)
    }
  }

  /**
   * 调试日志（仅开发模式）
   */
  debug(message: string, context?: any, requestId?: string) {
    this.log('debug', message, context, requestId)
  }

  /**
   * 信息日志（仅开发模式）
   */
  info(message: string, context?: any, requestId?: string) {
    this.log('info', message, context, requestId)
  }

  /**
   * 警告日志
   */
  warn(message: string, context?: any, requestId?: string) {
    this.log('warn', message, context, requestId)
  }

  /**
   * 错误日志（开发和生产模式都记录）
   */
  error(message: string, context?: any, requestId?: string) {
    this.log('error', message, context, requestId)
  }

  /**
   * 记录 API 请求
   * 格式：→ API: 方法名
   */
  logApiRequest(method: string, params?: any, requestId?: string) {
    this.debug(`→ API: ${method}`, params ? { params } : undefined, requestId)
  }

  /**
   * 记录 API 响应
   * 格式：✓ API: 方法名 (成功) 或 ✗ API: 方法名 (失败)
   */
  logApiResponse(method: string, success: boolean, data?: any, requestId?: string) {
    const symbol = success ? '✓' : '✗'
    const message = `${symbol} API: ${method}`
    const level = success ? 'debug' : 'error'
    this.log(level, message, data ? { data } : undefined, requestId)
  }

  /**
   * 记录 API 错误
   * 包含错误类型、消息、错误码和堆栈（仅开发模式）
   */
  logApiError(method: string, error: Error, requestId?: string) {
    this.error(
      `✗ API: ${method}`,
      {
        type: error.name,
        message: error.message,
        code: (error as any).code,
        stack: this.isDevelopment ? error.stack : undefined,
      },
      requestId
    )
  }
}

// 导出单例
export const logger = new Logger()
