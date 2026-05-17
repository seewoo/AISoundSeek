import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'

export function registerCategoryHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('category:list', async () => {
    try {
      return { success: true, data: db.listCustomCategories() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('category:create', async (_, { name, label, color }: { name: string; label: string; color: string }) => {
    try {
      return { success: true, data: db.createCustomCategory(name, label, color) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('category:update', async (_, { id, label, color }: { id: number; label: string; color: string }) => {
    try {
      db.updateCustomCategory(id, label, color)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('category:delete', async (_, { id }: { id: number }) => {
    try {
      db.deleteCustomCategory(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
