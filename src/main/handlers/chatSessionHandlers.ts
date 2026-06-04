import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'

export function registerChatSessionHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('session:list', async () => {
    try {
      return { success: true, data: db.listChatSessions() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('session:get', async (_, { id }) => {
    try {
      const session = db.getChatSession(id)
      if (!session) return { success: false, error: 'Session not found' }
      return { success: true, data: session }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('session:create', async (_, { name }) => {
    try {
      return { success: true, data: db.createChatSession(name) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('session:save', async (_, { id, messages, name }) => {
    try {
      db.updateChatSession(id, messages, name)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('session:rename', async (_, { id, name }) => {
    try {
      db.renameChatSession(id, name)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('session:delete', async (_, { id }) => {
    try {
      db.deleteChatSession(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
