import type { IpcMain, Shell } from 'electron'
import type { DatabaseService } from '../database'
import type { SearchParams, BatchUpdateParams } from '../../shared/types'
import fs from 'fs'

export function registerAudioHandlers(
  ipcMain: IpcMain,
  db: DatabaseService,
  shell: Shell
): void {
  ipcMain.handle('audio:search', async (_, params: SearchParams) => {
    try {
      return { success: true, data: db.searchAudioFiles(params) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:getById', async (_, { id }: { id: number }) => {
    try {
      return { success: true, data: db.getAudioById(id) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:update', async (_, { id, data }: { id: number; data: unknown }) => {
    try {
      return { success: true, data: db.updateAudioFile(id, data as any) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:delete', async (_, { id }: { id: number }) => {
    try {
      db.deleteAudioFile(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:openLocation', async (_, { filePath }: { filePath: string }) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:getFilePath', async (_, { id }: { id: number }) => {
    try {
      const file = db.getAudioById(id)
      if (!file) return { success: false, error: '文件不存在' }
      db.incrementPlayCount(id)
      return { success: true, data: file.filePath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:getCover', async (_, { id }: { id: number }) => {
    try {
      const file = db.getAudioById(id)
      if (!file || !file.coverPath) return { success: true, data: null }
      if (!fs.existsSync(file.coverPath)) return { success: true, data: null }
      const data = fs.readFileSync(file.coverPath)
      const base64 = data.toString('base64')
      const ext = file.coverPath.endsWith('.png') ? 'png' : 'jpeg'
      return { success: true, data: `data:image/${ext};base64,${base64}` }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:stats', async () => {
    try {
      return { success: true, data: db.getStats() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('audio:batchUpdate', async (_, { ids, data }: BatchUpdateParams) => {
    try {
      db.batchUpdateAudioFiles(ids, data)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('waveform:get', async (_, { id }: { id: number }) => {
    try {
      return { success: true, data: db.getWaveform(id) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('waveform:save', async (_, { id, peaks }: { id: number; peaks: number[] }) => {
    try {
      db.saveWaveform(id, peaks)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
