import { useState, useEffect, useCallback } from 'react'
import type { MusicDirectory, AudioFile } from '../../shared/types'
import { useSearch } from '../store'
import { useAiChat } from '../store/AiChatContext'
import { listDirectories, listSubdirs, onDirChanged } from '../lib/api'
import { AudioList } from './AudioList'
import { SearchBar } from './SearchBar'
import { FilterPanel } from './FilterPanel'
import { AudioDetail } from './AudioDetail'
import { AiChatPanel } from './AiChatPanel'
import { FolderOpenIcon, FolderIcon, ChevronRightIcon, ChevronDownIcon, RefreshIcon, Cog6ToothIcon } from './Icons'

// ── Tree node state ────────────────────────────────────────────────────────

interface NodeState {
  expanded: boolean
  loaded: boolean
  subdirs: string[] // normalized forward-slash paths
}

// Normalize path separators to forward slashes
function normPath(p: string) {
  return p.replace(/\\/g, '/')
}

function pathName(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

// ── DirectoryTree ──────────────────────────────────────────────────────────

interface TreeNodeProps {
  path: string
  label?: string   // shown for root nodes
  depth: number
  selectedPath: string
  nodeMap: Record<string, NodeState>
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}

function TreeNode({ path, label, depth, selectedPath, nodeMap, onSelect, onToggle }: TreeNodeProps) {
  const norm = normPath(path)
  const state = nodeMap[norm]
  const isSelected = normPath(selectedPath) === norm
  const hasChildren = !state?.loaded || (state?.subdirs.length ?? 0) > 0
  const isExpanded = state?.expanded ?? false
  const subdirs = state?.subdirs ?? []

  return (
    <div>
      <button
        onClick={() => onSelect(path)}
        onDoubleClick={() => onToggle(path)}
        className={`w-full flex items-center gap-1 px-2 py-1 text-left rounded-md transition-colors group ${
          isSelected
            ? 'bg-primary-600/25 text-primary-300'
            : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* Expand toggle */}
        <span
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
          onClick={e => { e.stopPropagation(); onToggle(path) }}
        >
          {hasChildren ? (
            isExpanded
              ? <ChevronDownIcon className="w-3 h-3 opacity-60" />
              : <ChevronRightIcon className="w-3 h-3 opacity-60" />
          ) : (
            <span className="w-3 h-3" />
          )}
        </span>

        {/* Folder icon */}
        {isExpanded
          ? <FolderOpenIcon className="w-3.5 h-3.5 flex-shrink-0 text-yellow-400" />
          : <FolderIcon className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500/70" />
        }

        {/* Label */}
        <span className="text-xs truncate ml-1 flex-1">
          {label ?? pathName(path)}
        </span>
      </button>

      {/* Children */}
      {isExpanded && subdirs.map(sub => (
        <TreeNode
          key={sub}
          path={sub}
          depth={depth + 1}
          selectedPath={selectedPath}
          nodeMap={nodeMap}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────

interface DirectoryBrowserProps {
  onOpenDirs?: () => void
}

export function DirectoryBrowserView({ onOpenDirs }: DirectoryBrowserProps) {
  const { setParams, params } = useSearch()
  const { showAiChat, setShowAiChat } = useAiChat()
  const [dirs, setDirs] = useState<MusicDirectory[]>([])
  const [nodeMap, setNodeMap] = useState<Record<string, NodeState>>({})
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null)
  const [loadingDirs, setLoadingDirs] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Load registered directories
  const loadDirs = useCallback(async () => {
    setLoadingDirs(true)
    try {
      const list = await listDirectories()
      setDirs(list)
      // Rebuild nodeMap from scratch to remove stale entries
      const freshMap: Record<string, NodeState> = {}
      for (const d of list) {
        freshMap[normPath(d.dirPath)] = { expanded: false, loaded: false, subdirs: [] }
      }
      setNodeMap(freshMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDirs(false)
    }
  }, [])

  useEffect(() => { loadDirs() }, [loadDirs])

  // Listen for directory changes from other components (DirectoriesModal, etc.)
  useEffect(() => {
    const unsub = onDirChanged(({ type }) => {
      loadDirs()
      if (type === 'removed') {
        setSelectedPath('')
        setParams({ dirPath: undefined })
      }
    })
    return unsub
  }, [loadDirs, setParams])

  // Select a directory → update search filter
  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path)
    setSelectedAudio(null)
    setParams({ dirPath: path, page: 1 })
  }, [setParams])

  // Toggle expand/collapse; lazy-load subdirs
  const handleToggle = useCallback(async (path: string) => {
    const norm = normPath(path)
    const current = nodeMap[norm]

    if (!current?.loaded) {
      // Load subdirs
      try {
        const subdirs = await listSubdirs(path)
        setNodeMap(prev => ({
          ...prev,
          [norm]: { expanded: true, loaded: true, subdirs },
        }))
        // Init child nodes
        setNodeMap(prev => {
          const next = { ...prev }
          for (const sub of subdirs) {
            if (!next[sub]) {
              next[sub] = { expanded: false, loaded: false, subdirs: [] }
            }
          }
          return next
        })
      } catch (e) {
        console.error(e)
      }
    } else {
      setNodeMap(prev => ({
        ...prev,
        [norm]: { ...prev[norm], expanded: !prev[norm].expanded },
      }))
    }
  }, [nodeMap])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left: Directory Tree ── */}
      <div className="w-56 flex-shrink-0 bg-surface border-r border-rim flex flex-col">
        {/* Tree header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-rim">
          <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">目录</span>
          <button
            onClick={loadDirs}
            className="w-6 h-6 flex items-center justify-center text-ink-3 hover:text-ink transition-colors"
            title="刷新"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tree body */}
        <div className="flex-1 overflow-y-auto py-1">
          {loadingDirs ? (
            <div className="px-3 py-4 text-xs text-ink-3">加载中...</div>
          ) : dirs.length === 0 ? (
            <div className="px-3 py-2 space-y-2">
              <div className="text-xs text-ink-3">暂无目录</div>
              {onOpenDirs && (
                <button
                  onClick={onOpenDirs}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md transition-colors text-xs bg-surface-hover text-ink-2 hover:text-ink hover:bg-surface-active"
                >
                  <Cog6ToothIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  添加目录
                </button>
              )}
            </div>
          ) : (
            <>
              {/* "All" option + manage dirs button */}
              <div className="flex items-center gap-1 mx-1">
                <button
                  onClick={() => { setSelectedPath(''); setParams({ dirPath: undefined }) }}
                  className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-left rounded-md transition-colors text-xs ${
                    !selectedPath
                      ? 'bg-primary-600/25 text-primary-300'
                      : 'text-ink-2 hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  <FolderOpenIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  全部文件
                </button>
                {onOpenDirs && (
                  <button
                    onClick={onOpenDirs}
                    className="w-6 h-6 flex items-center justify-center rounded text-ink-3 hover:text-ink hover:bg-surface-hover transition-colors flex-shrink-0"
                    title="目录管理"
                  >
                    <Cog6ToothIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-1">
                {dirs.map(dir => (
                  <TreeNode
                    key={normPath(dir.dirPath)}
                    path={dir.dirPath}
                    label={dir.label || pathName(dir.dirPath)}
                    depth={0}
                    selectedPath={selectedPath}
                    nodeMap={nodeMap}
                    onSelect={handleSelect}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Selected path info */}
        {selectedPath && (
          <div className="px-3 py-2 border-t border-rim">
            <div className="text-xs text-ink-4 truncate" title={selectedPath}>
              {selectedPath.replace(/\\/g, '/')}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Audio List ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <SearchBar
          onToggleFilters={() => setShowFilters(f => !f)}
          showFilters={showFilters}
          onToggleAiChat={() => setShowAiChat(f => !f)}
          showAiChat={showAiChat}
        />
        {showFilters && <FilterPanel />}
        <AudioList
          onSelect={(audio) => setSelectedAudio(audio)}
          selectedId={selectedAudio?.id}
        />
      </div>

      {/* ── AI Chat panel ── */}
      {showAiChat && !selectedAudio && (
        <AiChatPanel
          onSelectAudio={setSelectedAudio}
        />
      )}

      {/* ── Detail panel ── */}
      {selectedAudio && (
        <AudioDetail
          audio={selectedAudio}
          onClose={() => setSelectedAudio(null)}
          onUpdate={(updated) => setSelectedAudio(updated)}
        />
      )}
    </div>
  )
}
