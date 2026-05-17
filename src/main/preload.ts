import { contextBridge, ipcRenderer } from 'electron'
import type { AiConfig, AppSettings, AudioFile, AiProvider } from '../shared/types'

const api = {
  // Directory management
  addDirectory: (dirPath: string, label: string) =>
    ipcRenderer.invoke('dir:add', { dirPath, label }),
  removeDirectory: (id: number) =>
    ipcRenderer.invoke('dir:remove', { id }),
  listDirectories: () =>
    ipcRenderer.invoke('dir:list'),
  selectDirectory: () =>
    ipcRenderer.invoke('dir:select'),

  // Scanning
  scanDirectory: (dirId: number) =>
    ipcRenderer.invoke('scan:directory', { dirId }),
  scanAll: () =>
    ipcRenderer.invoke('scan:all'),
  onScanProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: unknown, progress: unknown) => callback(progress)
    ipcRenderer.on('scan:progress', listener)
    return () => ipcRenderer.removeListener('scan:progress', listener)
  },
  onDirChanged: (callback: (data: unknown) => void) => {
    const listener = (_: unknown, data: unknown) => callback(data)
    ipcRenderer.on('dir-changed', listener)
    return () => ipcRenderer.removeListener('dir-changed', listener)
  },

  // Audio files
  searchAudio: (params: unknown) =>
    ipcRenderer.invoke('audio:search', params),
  getAudioById: (id: number) =>
    ipcRenderer.invoke('audio:getById', { id }),
  updateAudio: (id: number, data: unknown) =>
    ipcRenderer.invoke('audio:update', { id, data }),
  deleteAudio: (id: number) =>
    ipcRenderer.invoke('audio:delete', { id }),
  openFileLocation: (filePath: string) =>
    ipcRenderer.invoke('audio:openLocation', { filePath }),
  getAudioStats: () =>
    ipcRenderer.invoke('audio:stats'),

  // Tags
  listTags: () =>
    ipcRenderer.invoke('tag:list'),
  createTag: (name: string, color: string) =>
    ipcRenderer.invoke('tag:create', { name, color }),
  deleteTag: (id: number) =>
    ipcRenderer.invoke('tag:delete', { id }),
  updateTag: (id: number, name: string, color: string) =>
    ipcRenderer.invoke('tag:update', { id, name, color }),

  // Player
  getFilePath: (id: number) =>
    ipcRenderer.invoke('audio:getFilePath', { id }),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:save', settings),

  // Batch update
  batchUpdateAudio: (ids: number[], data: Partial<Pick<AudioFile, 'category' | 'copyright' | 'rating' | 'tags'>>) =>
    ipcRenderer.invoke('audio:batchUpdate', { ids, data }),

  // Custom categories
  listCategories: () =>
    ipcRenderer.invoke('category:list'),
  createCategory: (name: string, label: string, color: string) =>
    ipcRenderer.invoke('category:create', { name, label, color }),
  updateCategory: (id: number, label: string, color: string) =>
    ipcRenderer.invoke('category:update', { id, label, color }),
  deleteCategory: (id: number) =>
    ipcRenderer.invoke('category:delete', { id }),

  // Cover art
  getCoverPath: (id: number) =>
    ipcRenderer.invoke('audio:getCover', { id }),

  // Directory subdirs
  listSubdirs: (parentPath: string) =>
    ipcRenderer.invoke('dir:subdirs', { parentPath }),

  // AI Analysis
  getAiConfig: () =>
    ipcRenderer.invoke('ai:getConfig'),
  saveAiConfig: (config: Partial<AiConfig>) =>
    ipcRenderer.invoke('ai:saveConfig', config),
  getProviders: (): Promise<AiProvider[]> =>
    ipcRenderer.invoke('ai:getProviders').then((r: any) => r.data ?? []),
  testAiConnection: (config: AiConfig) =>
    ipcRenderer.invoke('ai:testConnection', config),
  analyzeAudio: (audioId: number) =>
    ipcRenderer.invoke('ai:analyze', { audioId }),
  aiChatSearch: (messages: unknown) =>
    ipcRenderer.invoke('ai:chatSearch', { messages }),

  // Batch AI Analysis
  getUnanalyzedStats: () =>
    ipcRenderer.invoke('ai:getUnanalyzedStats'),
  batchAnalyze: (fileIds?: number[], options?: unknown) =>
    ipcRenderer.invoke('ai:batchAnalyze', { fileIds, options }),
  onBatchProgress: (callback: (progress: unknown) => void) => {
    const listener = (_: unknown, progress: unknown) => callback(progress)
    ipcRenderer.on('ai:batchProgress', listener)
    return () => ipcRenderer.removeListener('ai:batchProgress', listener)
  },

  // Configuration
  getBackendUrl: () =>
    ipcRenderer.invoke('config:getBackendUrl'),

  // Waveform
  getWaveform: (id: number) =>
    ipcRenderer.invoke('waveform:get', { id }),
  saveWaveform: (id: number, peaks: number[]) =>
    ipcRenderer.invoke('waveform:save', { id, peaks }),

  // Premiere Pro
  insertToPremiere: (id: number) =>
    ipcRenderer.invoke('premiere:insertAudio', { id }),

  // Auto-updater
  checkForUpdates: () =>
    ipcRenderer.invoke('update:check'),
  downloadUpdate: () =>
    ipcRenderer.invoke('update:download'),
  installUpdate: () =>
    ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => cb(info)
    ipcRenderer.on('update:available', listener)
    return () => ipcRenderer.removeListener('update:available', listener)
  },
  onUpdateNotAvailable: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('update:not-available', listener)
    return () => ipcRenderer.removeListener('update:not-available', listener)
  },
  onUpdateDownloadProgress: (cb: (progress: unknown) => void) => {
    const listener = (_: unknown, p: unknown) => cb(p)
    ipcRenderer.on('update:download-progress', listener)
    return () => ipcRenderer.removeListener('update:download-progress', listener)
  },
  onUpdateDownloaded: (cb: (info: unknown) => void) => {
    const listener = (_: unknown, info: unknown) => cb(info)
    ipcRenderer.on('update:downloaded', listener)
    return () => ipcRenderer.removeListener('update:downloaded', listener)
  },
  onUpdateError: (cb: (msg: string) => void) => {
    const listener = (_: unknown, msg: string) => cb(msg)
    ipcRenderer.on('update:error', listener)
    return () => ipcRenderer.removeListener('update:error', listener)
  },

  // App info
  getVersion: () =>
    ipcRenderer.invoke('app:getVersion'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
