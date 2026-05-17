import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'
import { configManager } from '../config'

/** Premiere Pro 本地插件端口（仅与本机通信） */
const PREMIERE_PLUGIN_URL = 'http://localhost:18432/insert-audio'

export function registerConfigHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('config:getBackendUrl', async () => {
    try {
      return { success: true, data: configManager.getBackendBaseUrl() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('premiere:insertAudio', async (_, { id }: { id: number }) => {
    try {
      const file = db.getAudioById(id)
      if (!file) return { success: false, error: '文件不存在' }

      const response = await fetch(PREMIERE_PLUGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.filePath }),
      })

      if (!response.ok) {
        return { success: false, error: 'Premiere 插件未响应，请确保插件已加载' }
      }

      const result = (await response.json()) as { success: boolean; error?: string }
      if (!result.success) {
        return { success: false, error: result.error ?? '插入失败' }
      }

      return { success: true }
    } catch {
      return {
        success: false,
        error: '无法连接到 Premiere，请确保 Premiere 已启动且 AudioSeek 插件已加载',
      }
    }
  })
}
