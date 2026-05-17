import { useState, useEffect } from 'react'
import type { MusicDirectory } from '../../shared/types'
import { listDirectories, selectDirectory, addDirectory, removeDirectory, scanDirectory, onScanProgress } from '../lib/api'
import { useSearch } from '../store'
import { FolderOpenIcon, FolderPlusIcon, TrashIcon, RefreshIcon, XMarkIcon } from './Icons'

interface Props {
  onClose: () => void
}

interface ScanState {
  dirId: number | null
  current: number
  total: number
  currentFile: string
  done: boolean
}

export function DirectoriesModal({ onClose }: Props) {
  const [dirs, setDirs] = useState<MusicDirectory[]>([])
  const [scan, setScan] = useState<ScanState>({ dirId: null, current: 0, total: 0, currentFile: '', done: true })
  const { refresh } = useSearch()

  const loadDirs = () => listDirectories().then(setDirs).catch(console.error)

  useEffect(() => {
    loadDirs()
    const unsub = onScanProgress(p => {
      setScan(s => ({ ...s, ...p }))
      if (p.done) {
        loadDirs()
        refresh()
        setTimeout(() => setScan(s => ({ ...s, dirId: null })), 2000)
      }
    })
    return unsub
  }, []) // eslint-disable-line

  const handleAddDir = async () => {
    const path = await selectDirectory()
    if (!path) return
    const label = path.split(/[\\/]/).pop() || path
    await addDirectory(path, label)
    loadDirs()
  }

  const handleRemove = async (id: number) => {
    await removeDirectory(id)
    loadDirs()
  }

  const handleScan = async (dir: MusicDirectory) => {
    setScan({ dirId: dir.id, current: 0, total: 0, currentFile: '', done: false })
    try {
      await scanDirectory(dir.id)
    } catch (e) {
      console.error(e)
      setScan(s => ({ ...s, done: true, dirId: null }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-rim rounded-2xl w-full max-w-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rim">
          <div>
            <h2 className="text-base font-semibold text-ink">目录管理</h2>
            <p className="text-xs text-ink-3 mt-0.5">管理音频文件扫描目录</p>
          </div>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scan progress */}
        {!scan.done && (
          <div className="mx-6 mt-4 p-3 bg-primary-900/30 border border-primary-700/30 rounded-lg">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-primary-400">正在扫描...</span>
              <span className="text-ink-3">{scan.current} / {scan.total || '?'}</span>
            </div>
            <div className="h-1.5 bg-surface-btn rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-300"
                style={{ width: scan.total > 0 ? `${(scan.current / scan.total) * 100}%` : '0%' }}
              />
            </div>
            <div className="text-xs text-ink-3 mt-1.5 truncate">{scan.currentFile}</div>
          </div>
        )}

        {/* Dir list */}
        <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
          {dirs.length === 0 ? (
            <div className="text-center py-8 text-ink-3 text-sm">
              <FolderOpenIcon className="w-10 h-10 mx-auto mb-2 text-ink-4" />
              还没有添加任何目录
            </div>
          ) : (
            dirs.map(dir => {
              const isScanning = scan.dirId === dir.id && !scan.done
              return (
                <div key={dir.id} className="card p-3 flex items-center gap-3">
                  <FolderOpenIcon className="w-5 h-5 text-ink-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{dir.label}</div>
                    <div className="text-xs text-ink-3 truncate">{dir.dirPath}</div>
                    <div className="text-xs text-ink-3 mt-0.5">
                      {dir.fileCount} 个文件
                      {dir.lastScanAt && ` · 最后扫描: ${new Date(dir.lastScanAt).toLocaleDateString('zh-CN')}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleScan(dir)}
                      disabled={isScanning || !scan.done}
                      className={`btn-secondary text-xs px-2 py-1 h-7 gap-1 ${isScanning ? 'opacity-50' : ''}`}
                    >
                      <RefreshIcon className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? '扫描中' : '扫描'}
                    </button>
                    <button onClick={() => handleRemove(dir.id)} className="btn-ghost w-7 h-7 p-0 text-ink-3 hover:text-red-500">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-between">
          <button onClick={handleAddDir} className="btn-primary text-sm gap-2">
            <FolderPlusIcon className="w-4 h-4" />
            添加目录
          </button>
          <button onClick={onClose} className="btn-secondary text-sm">关闭</button>
        </div>
      </div>
    </div>
  )
}
