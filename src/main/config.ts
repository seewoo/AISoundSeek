/**
 * 配置管理器
 * 从用户数据目录加载和管理应用配置
 */

import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AppConfig {
  version: string
  backend: {
    baseUrl: string
    timeout: number
  }
}

// 构建时通过 esbuild define 注入
declare const __AUDIO_SEEK_API_URL__: string
const API_URL = typeof __AUDIO_SEEK_API_URL__ !== 'undefined'
  ? __AUDIO_SEEK_API_URL__
  : 'http://localhost:8080/api'

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0',
  backend: {
    baseUrl: API_URL,
    timeout: 30000,
  },
}

class ConfigManager {
  private config: AppConfig | null = null
  private configPath: string | null = null

  constructor() {
    // 延迟初始化，等待 app ready
  }

  private ensureInitialized(): void {
    if (this.config === null) {
      const userDataPath = app.getPath('userData')
      this.configPath = path.join(userDataPath, 'config.json')
      this.config = this.loadConfig()
    }
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath!)) {
        const content = fs.readFileSync(this.configPath!, 'utf-8')
        const loaded = JSON.parse(content)
        // 合并默认配置和加载的配置，baseUrl 始终使用构建时的默认值
        // 以确保生产构建的 URL 不会被已存在的 config.json 覆盖
        return {
          ...DEFAULT_CONFIG,
          ...loaded,
          backend: {
            ...DEFAULT_CONFIG.backend,
            ...loaded.backend,
          },
        }
      }
    } catch (e) {
      console.error('Failed to load config:', e)
    }

    // 首次运行，创建默认配置
    this.saveConfig(DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }

  private saveConfig(config: AppConfig): void {
    try {
      const dir = path.dirname(this.configPath!)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(
        this.configPath!,
        JSON.stringify(config, null, 2),
        'utf-8'
      )
    } catch (e) {
      console.error('Failed to save config:', e)
    }
  }

  /**
   * 获取配置项
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    this.ensureInitialized()
    return this.config![key]
  }

  /**
   * 设置配置项
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.ensureInitialized()
    this.config![key] = value
    this.saveConfig(this.config!)
  }

  /**
   * 获取后端服务器地址
   */
  getBackendBaseUrl(): string {
    this.ensureInitialized()
    return this.config!.backend.baseUrl
  }

  /**
   * 设置后端服务器地址
   */
  setBackendBaseUrl(url: string): void {
    this.ensureInitialized()
    this.config!.backend.baseUrl = url
    this.saveConfig(this.config!)
  }

  /**
   * 获取请求超时时间
   */
  getBackendTimeout(): number {
    this.ensureInitialized()
    return this.config!.backend.timeout
  }

  /**
   * 重新加载配置文件
   */
  reload(): void {
    this.ensureInitialized()
    this.config = this.loadConfig()
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    this.ensureInitialized()
    return this.configPath!
  }
}

// 导出单例
export const configManager = new ConfigManager()