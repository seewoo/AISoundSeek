// Shared types between main and renderer processes

export interface AudioFile {
  id: number
  filePath: string
  fileName: string
  title: string
  artist: string
  album: string
  duration: number // seconds
  fileSize: number // bytes
  format: string
  sampleRate: number
  bitrate: number
  channels: number
  coverPath: string | null
  category: string  // built-in AudioCategory or custom category name
  subcategory: string
  copyright: CopyrightType
  copyrightNote: string
  description: string
  tags: string[] // JSON array stored as string
  rating: number // 0-5
  createdAt: string
  updatedAt: string
  lastPlayedAt: string | null
  playCount: number
  waveformData: number[] | null // normalized peak values [-1, 1], null if not yet generated
  aiAnalyzed: boolean // Track if file has been AI analyzed
}

export type AudioCategory = 'dialogue' | 'sfx' | 'bgm' | 'theme' | 'interactive' | 'ambience' | 'sound_design'
export type CopyrightType = 'free' | 'licensed' | 'unknown'

export interface CustomCategory {
  id: number
  name: string   // unique key, used as category value
  label: string  // display name
  color: string  // hex color
}

export interface AudioFileRow extends Omit<AudioFile, 'tags'> {
  tags: string // stored as JSON string in SQLite
}

export interface Tag {
  id: number
  name: string
  color: string
  usageCount: number
}

export interface MusicDirectory {
  id: number
  dirPath: string
  label: string
  autoScan: boolean
  lastScanAt: string | null
  fileCount: number
}

export interface SearchParams {
  keyword?: string
  tags?: string[]
  category?: string
  copyright?: CopyrightType | ''
  minDuration?: number
  maxDuration?: number
  rating?: number
  dirPath?: string
  sortBy?: 'fileName' | 'title' | 'duration' | 'createdAt' | 'rating' | 'playCount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface SearchResult {
  total: number
  items: AudioFile[]
}

export interface ScanProgress {
  current: number
  total: number
  currentFile: string
  done: boolean
}

export interface BatchUpdateParams {
  ids: number[]
  data: Partial<Pick<AudioFile, 'category' | 'copyright' | 'rating' | 'tags'>>
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  playerVolume: number
  defaultCategory: AudioCategory
  autoExtractTags: boolean
  scanOnStartup: boolean
  coverCacheDir: string
  onboardingCompleted: boolean
}

// ── AI Provider & Config ──────────────────────────────────────────────────

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  apiStyle: 'openai' | 'anthropic'
  requiresApiKey: boolean
  models: string[]
  isCustom?: boolean
}

export interface AiConfig {
  providerId: string    // matches AiProvider.id
  apiKey: string
  model: string
  customBaseUrl?: string  // only used when providerId === 'custom'
  enableOnScan: boolean
}

export interface AiAnalysisResult {
  description: string
  tags: string[]
  category?: AudioCategory
}

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatPick {
  id: number
  reason: string
}

export interface AiChatResponse {
  reply: string
  picks: AiChatPick[]
  items: AudioFile[]
}

/**
 * AI 提取的搜索意图，包含关键词和过滤条件
 */
export interface SearchIntent {
  keywords: string[]          // 搜索关键词（1-8个）
  category?: AudioCategory    // 识别出的类别过滤（可选）
  copyright?: CopyrightType   // 识别出的版权过滤（可选）
}

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: number  // 错误码（401, 510等）
}

// ── Batch AI Analysis ──────────────────────────────────────────────────────

export interface UnanalyzedStats {
  total: number
  totalDuration: number  // 未分析音频总时长（秒）
  byDirectory: { dirPath: string; label: string; count: number }[]
}

export interface BatchAnalyzeOptions {
  concurrency?: number  // 并发数，默认 1
  autoApply?: boolean   // 是否自动应用分析结果，默认 false
}

export interface BatchAnalyzeProgress {
  current: number       // 当前已处理数量
  total: number         // 总数量
  success: number       // 成功数量
  failed: number        // 失败数量
  currentFile?: string  // 当前正在分析的文件名
  done?: boolean        // 是否完成
  stopped?: boolean     // 是否因错误而停止
  stopReason?: 'api_key_invalid' | 'api_error' | null  // 停止原因
}
