import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'

export function registerTagHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('tag:list', async () => {
    try {
      return { success: true, data: db.listTags() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('tag:create', async (_, { name, color }: { name: string; color: string }) => {
    try {
      return { success: true, data: db.createTag(name, color) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('tag:update', async (_, { id, name, color }: { id: number; name: string; color: string }) => {
    try {
      db.updateTag(id, name, color)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('tag:delete', async (_, { id }: { id: number }) => {
    try {
      db.deleteTag(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
