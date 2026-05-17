/**
 * 渲染进程自定义错误类
 * 保留 IPC 响应中的错误码和上下文信息
 */

/**
 * 基础 API 错误类
 * 保留错误码、时间戳、上下文和请求 ID
 */
export class ApiError extends Error {
  code?: number
  timestamp: number
  context?: any
  requestId?: string

  constructor(message: string, code?: number, context?: any) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.timestamp = Date.now()
    this.context = context

    // 维护正确的原型链，支持 instanceof 检查
    Object.setPrototypeOf(this, ApiError.prototype)
  }
}

/**
 * 认证错误 (401)
 * 登录过期或 Token 无效
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = '认证失败或 Token 过期') {
    super(message, 401)
    this.name = 'AuthenticationError'
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

/**
 * Token 余额不足错误 (510)
 * AI 功能需要充值
 */
export class InsufficientTokenError extends ApiError {
  constructor(message: string = 'Token 余额不足') {
    super(message, 510)
    this.name = 'InsufficientTokenError'
    Object.setPrototypeOf(this, InsufficientTokenError.prototype)
  }
}

/**
 * 网络通信错误
 * IPC 调用失败或超时
 */
export class NetworkError extends ApiError {
  constructor(message: string = 'IPC 通信失败') {
    super(message)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}
