import type { AudioFile, Tag, MusicDirectory, SearchParams, SearchResult, AppSettings, CustomCategory, AiConfig, AiProvider, AiAnalysisResult, AiChatMessage, AiChatResponse, IpcResponse } from '../../shared/types'
import { ApiError, AuthenticationError, InsufficientTokenError, NetworkError } from './errors'
import { logger } from './logger'

const api = window.electronAPI

/**
 * 通用 API 调用包装器
 * 统一处理错误码保留、日志记录和错误抛出
 */
async function apiCall<T>(
  method: string,
  apiMethod: () => Promise<IpcResponse<T>>,
  params?: any
): Promise<T> {
  const requestId = logger.generateRequestId()

  // 记录请求（开发模式）
  logger.logApiRequest(method, params, requestId)

  try {
    const res = await apiMethod()

    // 记录响应（开发模式）
    logger.logApiResponse(method, res.success, res.data, requestId)

    // 处理错误响应
    if (!res.success) {
      const errorMessage = res.error || 'Unknown error'
      const errorCode = res.code

      // 根据错误码创建对应的错误对象
      let error: Error

      if (errorCode === 401) {
        error = new AuthenticationError(errorMessage)
      } else if (errorCode === 510) {
        error = new InsufficientTokenError(errorMessage)
      } else {
        error = new ApiError(errorMessage, errorCode, {
          method,
          params,
          requestId,
        })
      }

      // 附加请求 ID 用于追踪
      ;(error as any).requestId = requestId

      // 记录错误
      logger.logApiError(method, error, requestId)

      throw error
    }

    return res.data as T
  } catch (error) {
    // 如果是已知错误，直接抛出
    if (error instanceof ApiError) {
      throw error
    }

    // 未预期的错误（IPC 通信失败等）
    const unexpectedError = new NetworkError(
      error instanceof Error ? error.message : 'IPC communication failed'
    )
    unexpectedError.context = { method, originalError: error, requestId }
    unexpectedError.requestId = requestId

    logger.logApiError(method, unexpectedError, requestId)
    throw unexpectedError
  }
}

export async function searchAudio(params: SearchParams): Promise<SearchResult> {
  return apiCall('searchAudio', () => api.searchAudio(params), params)
}

export async function getAudioById(id: number): Promise<AudioFile | null> {
  return apiCall('getAudioById', () => api.getAudioById(id), { id })
}

export async function updateAudio(id: number, data: Partial<AudioFile>): Promise<AudioFile> {
  return apiCall('updateAudio', () => api.updateAudio(id, data), { id, data })
}

export async function deleteAudio(id: number): Promise<void> {
  return apiCall('deleteAudio', () => api.deleteAudio(id), { id })
}

export async function openFileLocation(filePath: string): Promise<void> {
  await api.openFileLocation(filePath)
}

export async function getAudioStats() {
  return apiCall('getAudioStats', () => api.getAudioStats())
}

export async function getFilePath(id: number): Promise<string> {
  return apiCall('getFilePath', () => api.getFilePath(id), { id })
}

export async function getCoverImage(id: number): Promise<string | null> {
  const res = await api.getCoverPath(id)
  return res.success ? (res.data as string | null) : null
}

export async function listDirectories(): Promise<MusicDirectory[]> {
  return apiCall('listDirectories', () => api.listDirectories())
}

export async function selectDirectory(): Promise<string | null> {
  return apiCall('selectDirectory', () => api.selectDirectory())
}

export async function addDirectory(dirPath: string, label: string): Promise<MusicDirectory> {
  return apiCall('addDirectory', () => api.addDirectory(dirPath, label), { dirPath, label })
}

export async function removeDirectory(id: number): Promise<void> {
  return apiCall('removeDirectory', () => api.removeDirectory(id), { id })
}

export async function scanDirectory(dirId: number): Promise<number> {
  const res = await api.scanDirectory(dirId)
  if (!res.success) throw new Error(res.error)
  return res.data as number
}

export async function scanAll(): Promise<number> {
  const res = await api.scanAll()
  if (!res.success) throw new Error(res.error)
  return res.data as number
}

export async function listTags(): Promise<Tag[]> {
  const res = await api.listTags()
  if (!res.success) throw new Error(res.error)
  return res.data as Tag[]
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const res = await api.createTag(name, color)
  if (!res.success) throw new Error(res.error)
  return res.data as Tag
}

export async function updateTag(id: number, name: string, color: string): Promise<void> {
  const res = await api.updateTag(id, name, color)
  if (!res.success) throw new Error(res.error)
}

export async function deleteTag(id: number): Promise<void> {
  const res = await api.deleteTag(id)
  if (!res.success) throw new Error(res.error)
}

export async function batchUpdateAudio(ids: number[], data: Partial<Pick<AudioFile, 'category' | 'copyright' | 'rating' | 'tags'>>): Promise<void> {
  const res = await api.batchUpdateAudio(ids, data)
  if (!res.success) throw new Error(res.error)
}

export async function listCustomCategories(): Promise<CustomCategory[]> {
  const res = await api.listCategories()
  if (!res.success) throw new Error(res.error)
  return res.data as CustomCategory[]
}

export async function createCustomCategory(name: string, label: string, color: string): Promise<CustomCategory> {
  const res = await api.createCategory(name, label, color)
  if (!res.success) throw new Error(res.error)
  return res.data as CustomCategory
}

export async function updateCustomCategory(id: number, label: string, color: string): Promise<void> {
  const res = await api.updateCategory(id, label, color)
  if (!res.success) throw new Error(res.error)
}

export async function deleteCustomCategory(id: number): Promise<void> {
  const res = await api.deleteCategory(id)
  if (!res.success) throw new Error(res.error)
}

export async function listSubdirs(parentPath: string): Promise<string[]> {
  const res = await api.listSubdirs(parentPath)
  if (!res.success) throw new Error(res.error)
  return res.data as string[]
}

export async function getSettings(): Promise<AppSettings> {
  const res = await api.getSettings()
  if (!res.success) throw new Error(res.error)
  return res.data as AppSettings
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const res = await api.saveSettings(settings)
  if (!res.success) throw new Error(res.error)
}

export function onScanProgress(callback: (p: { current: number; total: number; currentFile: string; done: boolean }) => void): () => void {
  return window.electronAPI.onScanProgress(callback as any)
}

export function onDirChanged(callback: (data: { type: string; dirId?: number; id?: number; dir?: any }) => void): () => void {
  return window.electronAPI.onDirChanged((data: unknown) => { callback(data as any) })
}

// ── AI Analysis ──────────────────────────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  const res = await api.getAiConfig()
  if (!res.success) throw new Error(res.error)
  return res.data as AiConfig
}

export async function saveAiConfig(config: Partial<AiConfig>): Promise<void> {
  const res = await api.saveAiConfig(config)
  if (!res.success) throw new Error(res.error)
}

export async function getProviders(): Promise<AiProvider[]> {
  return window.electronAPI.getProviders()
}

export async function testAiConnection(config: AiConfig): Promise<{ reply: string }> {
  const res = await (window.electronAPI as any).testAiConnection(config)
  if (!res.success) throw new Error(res.error ?? '连接失败')
  return res.data
}

export async function analyzeAudio(audioId: number): Promise<AiAnalysisResult> {
  return apiCall('analyzeAudio', () => api.analyzeAudio(audioId), { audioId })
}

export async function aiChatSearch(messages: AiChatMessage[]): Promise<AiChatResponse> {
  return apiCall('aiChatSearch', () => api.aiChatSearch(messages), { messages })
}

// ── Waveform ──────────────────────────────────────────────────────────────────

export async function getWaveform(id: number): Promise<number[] | null> {
  const res = await api.getWaveform(id)
  if (!res.success) return null
  return res.data as number[] | null
}

export async function saveWaveform(id: number, peaks: number[]): Promise<void> {
  await api.saveWaveform(id, peaks)
}

// ── Premiere Pro ────────────────────────────────────────────────────────────────

export async function insertToPremiere(id: number): Promise<void> {
  const res = await api.insertToPremiere(id)
  if (!res.success) throw new Error(res.error)
}

// ── Batch AI Analysis ─────────────────────────────────────────────────────────

export async function getUnanalyzedStats() {
  return apiCall('getUnanalyzedStats', () => api.getUnanalyzedStats())
}

export async function batchAnalyze(fileIds?: number[], options?: Record<string, unknown>) {
  return apiCall('batchAnalyze', () => api.batchAnalyze(fileIds, options), { fileIds, options })
}

export function onBatchProgress(callback: (progress: unknown) => void): () => void {
  return api.onBatchProgress(callback)
}

