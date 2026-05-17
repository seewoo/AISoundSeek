import type { IpcMain, BrowserWindow, Dialog } from 'electron'
import type { DatabaseService } from '../database'
import type { ScannerService } from '../scanner'

type MainWindowGetter = () => BrowserWindow | null

export function registerDirectoryHandlers(
  ipcMain: IpcMain,
  db: DatabaseService,
  scanner: ScannerService,
  getMainWindow: MainWindowGetter,
  dialog: Dialog
): void {
  ipcMain.handle('dir:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择音频目录',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    return { success: true, data: result.filePaths[0] }
  })

  ipcMain.handle('dir:add', async (_, { dirPath, label }: { dirPath: string; label: string }) => {
    try {
      const dir = db.addDirectory(dirPath, label)
      getMainWindow()?.webContents.send('dir-changed', { type: 'added', dir })
      return { success: true, data: dir }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('dir:remove', async (_, { id }: { id: number }) => {
    try {
      db.removeDirectory(id)
      getMainWindow()?.webContents.send('dir-changed', { type: 'removed', id })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('dir:list', async () => {
    try {
      return { success: true, data: db.listDirectories() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('dir:subdirs', async (_, { parentPath }: { parentPath: string }) => {
    try {
      return { success: true, data: db.listSubdirs(parentPath) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('scan:directory', async (event, { dirId }: { dirId: number }) => {
    const dirs = db.listDirectories()
    const dir = dirs.find((d) => d.id === dirId)
    if (!dir) return { success: false, error: '目录不存在' }

    try {
      const aiConfig = db.getAiConfig()
      const token = aiConfig.enableOnScan ? db.getAuthToken() : null
      const count = await scanner.scanDirectory(
        dir.id,
        dir.dirPath,
        (current, total, file) => {
          event.sender.send('scan:progress', { current, total, currentFile: file, done: false })
        },
        token
      )
      event.sender.send('scan:progress', {
        current: count, total: count, currentFile: '', done: true, dirId,
      })
      getMainWindow()?.webContents.send('dir-changed', { type: 'scanned', dirId })
      return { success: true, data: count }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('scan:all', async (event) => {
    const dirs = db.listDirectories()
    const aiConfig = db.getAiConfig()
    const token = aiConfig.enableOnScan ? db.getAuthToken() : null
    let total = 0

    for (const dir of dirs) {
      try {
        const count = await scanner.scanDirectory(
          dir.id,
          dir.dirPath,
          (current, dirTotal, file) => {
            event.sender.send('scan:progress', { current, total: dirTotal, currentFile: file, done: false })
          },
          token
        )
        total += count
      } catch (e) {
        console.error(`Scan failed for ${dir.dirPath}:`, e)
      }
    }

    event.sender.send('scan:progress', { current: total, total, currentFile: '', done: true })
    return { success: true, data: total }
  })
}
