import type { IpcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

type MainWindowGetter = () => BrowserWindow | null

export function setupAutoUpdater(ipcMain: IpcMain, getMainWindow: MainWindowGetter): void {
  log.info('Configuring auto-updater...')
  autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info)
    getMainWindow()?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', () => {
    log.info('No update available')
    getMainWindow()?.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info('Download progress:', progress.percent)
    getMainWindow()?.webContents.send('update:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info)
    getMainWindow()?.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
    getMainWindow()?.webContents.send('update:error', err.message)
  })

  ipcMain.handle('update:check', async () => {
    try {
      log.info('Checking for updates...')
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (e: any) {
      log.error('Failed to check for updates:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      log.info('Downloading update...')
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (e: any) {
      log.error('Failed to download update:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('update:install', () => {
    log.info('Installing update and quitting...')
    autoUpdater.quitAndInstall(false, true)
  })
}
