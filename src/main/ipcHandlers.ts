import type { IpcMain, BrowserWindow, Dialog, Shell } from 'electron'
import { protocol } from 'electron'
import type { DatabaseService } from './database'
import type { ScannerService } from './scanner'
import { registerDirectoryHandlers } from './handlers/directoryHandlers'
import { registerAudioHandlers } from './handlers/audioHandlers'
import { registerTagHandlers } from './handlers/tagHandlers'
import { registerCategoryHandlers } from './handlers/categoryHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerAiHandlers } from './handlers/aiHandlers'
import { registerConfigHandlers } from './handlers/configHandlers'

export function registerIpcHandlers(
  ipcMain: IpcMain,
  db: DatabaseService,
  scanner: ScannerService,
  mainWindowGetter: () => BrowserWindow | null,
  dialog: Dialog,
  shell: Shell
): void {
  // Register local-file:// protocol for serving cover art from temp directory.
  // Only paths within the OS temp dir are served; all other requests are rejected.
  try {
    const os = require('os')
    const allowedRoot = os.tmpdir().replace(/\\/g, '/')
    protocol.registerFileProtocol('local-file', (request, callback) => {
      const raw = decodeURIComponent(request.url.replace('local-file://', ''))
      const normalized = raw.replace(/\\/g, '/')
      if (!normalized.startsWith(allowedRoot)) {
        callback({ error: -10 }) // net::ERR_ACCESS_DENIED
        return
      }
      callback({ path: raw })
    })
  } catch {
    // Protocol already registered (hot reload in dev mode)
  }

  registerDirectoryHandlers(ipcMain, db, scanner, mainWindowGetter, dialog)
  registerAudioHandlers(ipcMain, db, shell)
  registerTagHandlers(ipcMain, db)
  registerCategoryHandlers(ipcMain, db)
  registerSettingsHandlers(ipcMain, db)
  registerAiHandlers(ipcMain, db)
  registerConfigHandlers(ipcMain, db)
}
