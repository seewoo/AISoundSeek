/**
 * 自定义错误类型
 * 用于后端 API 调用的错误处理
 */

/**
 * 认证失败错误 (401)
 * Token 过期或无效
 */
export class AuthenticationError extends Error {
  code = 401

  constructor(message: string = '认证失败或 Token 过期') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Token 余额不足错误 (510)
 */
export class InsufficientTokenError extends Error {
  code = 510

  constructor(message: string = 'Token 余额不足') {
    super(message)
    this.name = 'InsufficientTokenError'
  }
}

/**
 * 后端服务错误
 * 包括所有其他后端返回的错误
 */
export class BackendError extends Error {
  code: number

  constructor(message: string, code: number = 500) {
    super(message)
    this.name = 'BackendError'
    this.code = code
  }
}

/**
 * 网络请求失败错误
 */
export class NetworkError extends Error {
  constructor(message: string = '网络请求失败，请检查网络连接') {
    super(message)
    this.name = 'NetworkError'
  }
}
