import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('settings:get', async () => {
    try {
      return { success: true, data: db.getSettings() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('settings:save', async (_, settings: Partial<AppSettings>) => {
    try {
      db.saveSettings(settings)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ai:getConfig', async () => {
    try {
      return { success: true, data: db.getAiConfig() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ai:saveConfig', async (_, config: Record<string, unknown>) => {
    try {
      db.saveAiConfig(config as any)
      // 通知主进程重启后台分析调度器
      if (
        'enableBackgroundAnalysis' in config ||
        'backgroundInterval' in config ||
        'backgroundDailyLimit' in config
      ) {
        ipcMain.emit('background-analyzer:restart')
      }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
