import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, Menu } from 'electron'
import path from 'path'
import log from 'electron-log'
import { DatabaseService } from './database'
import { ScannerService } from './scanner'
import { registerIpcHandlers } from './ipcHandlers'
import { BackgroundAnalyzer } from './backgroundAnalyzer'
import { setupAutoUpdater } from './autoUpdater'

// 开发环境使用独立的用户数据目录，避免与生产环境数据混淆
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'aisoundseek-dev'))
}

// Configure electron-log
log.transports.file.level = 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

// Redirect console methods to electron-log
console.log = log.log.bind(log)
console.info = log.info.bind(log)
console.warn = log.warn.bind(log)
console.error = log.error.bind(log)
console.debug = log.debug.bind(log)

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

log.info('=== Application Starting ===')
log.info('Version:', app.getVersion())
log.info('Platform:', process.platform)
log.info('Arch:', process.arch)
log.info('Log file path:', log.transports.file.getFile().path)

let mainWindow: BrowserWindow | null = null
let db: DatabaseService
let scanner: ScannerService
let backgroundAnalyzer: BackgroundAnalyzer

function createWindow() {
  log.info('Creating main window...')
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/icon.png'))
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    log.debug('Loading development URL: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '../../renderer/index.html')
    log.info('Loading production file:', indexPath)
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    log.info('Main window closed')
    mainWindow = null
  })

  // Log renderer process errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log.error('Renderer process gone:', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    log.warn('Renderer process became unresponsive')
  })

  mainWindow.webContents.on('responsive', () => {
    log.info('Renderer process became responsive')
  })
}

app.whenReady().then(async () => {
  log.info('App ready, initializing...')

  // Setup application menu: only show in development mode
  if (!app.isPackaged) {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '帮助',
        submenu: [
          {
            label: '打开日志文件夹',
            click: () => {
              const logPath = log.transports.file.getFile().path
              const logDir = path.dirname(logPath)
              shell.openPath(logDir)
              log.info('Opening log folder:', logDir)
            }
          },
          {
            label: '重新加载',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              mainWindow?.reload()
            }
          },
          {
            label: '开发者工具',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => {
              mainWindow?.webContents.toggleDevTools()
            }
          }
        ]
      }
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    Menu.setApplicationMenu(null)
  }

  log.info('Initializing database...')
  db = new DatabaseService(app.getPath('userData'))
  await db.initialize()
  log.info('Database initialized successfully')

  scanner = new ScannerService(db)

  // 初始化后台分析调度器
  log.info('Starting background analyzer...')
  backgroundAnalyzer = new BackgroundAnalyzer(db)
  backgroundAnalyzer.start()

  // 监听后台分析配置更改事件
  ipcMain.on('background-analyzer:restart' as any, () => {
    log.info('Restarting background analyzer...')
    backgroundAnalyzer?.restart()
  })

  createWindow()

  registerIpcHandlers(ipcMain, db, scanner, () => mainWindow, dialog, shell)

  setupAutoUpdater(ipcMain, () => mainWindow)

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log.info('All windows closed')
  if (process.platform !== 'darwin') {
    backgroundAnalyzer?.stop()
    db?.close()
    log.info('Application quitting')
    app.quit()
  }
})

app.on('before-quit', () => {
  log.info('Application is about to quit')
  backgroundAnalyzer?.stop()
})

export { mainWindow }
