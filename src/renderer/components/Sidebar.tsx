import type { ActiveView } from '../App'
import { MusicalNoteIcon, TagIcon, FolderIcon, Cog6ToothIcon } from './Icons'

interface Props {
  activeView: ActiveView
  onViewChange: (v: ActiveView) => void
  onOpenSettings: () => void
}

const navItems: Array<{ id: ActiveView; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'library', label: '音频库', icon: MusicalNoteIcon },
  { id: 'dirBrowser', label: '目录浏览', icon: FolderIcon },
  { id: 'tags', label: '标签管理', icon: TagIcon },
]

export function Sidebar({ activeView, onViewChange, onOpenSettings }: Props) {
  return (
    <aside className="w-52 flex-shrink-0 bg-white dark:bg-dark-900 border-r border-gray-200 dark:border-dark-700 flex flex-col">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-200 dark:border-dark-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <MusicalNoteIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-gray-900 dark:text-dark-100 leading-tight">音觅</div>
            <div className="text-xs text-gray-500 dark:text-dark-500">音频资源管理工具</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(item => {
          const isActive = activeView === item.id
          const onClick = () => onViewChange(item.id)
          return (
            <button
              key={item.id}
              onClick={onClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive && !item.modal
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-700/30 dark:bg-primary-600/20 dark:text-primary-400 dark:border-primary-700/30'
                  : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700/60 hover:text-gray-900 dark:hover:text-dark-200'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-gray-200 dark:border-dark-700">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-700/60 hover:text-gray-900 dark:hover:text-dark-200 transition-all"
        >
          <Cog6ToothIcon className="w-4 h-4" />
          设置
        </button>
      </div>
    </aside>
  )
}
