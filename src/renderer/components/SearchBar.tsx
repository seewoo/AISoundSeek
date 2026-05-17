import { useSearch } from '../store'
import { SearchIcon, FilterIcon, XMarkIcon, SparklesIcon } from './Icons'

interface Props {
  onToggleFilters: () => void
  showFilters: boolean
  onToggleAiChat: () => void
  showAiChat: boolean
}

export function SearchBar({ onToggleFilters, showFilters, onToggleAiChat, showAiChat }: Props) {
  const { params, setParams, total, loading } = useSearch()

  return (
    <div className="px-4 py-3 border-b border-rim bg-surface">
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <input
            className="input pl-9 pr-8 h-9 text-sm"
            placeholder="搜索文件名、标题、艺术家、描述、标签..."
            value={params.keyword || ''}
            onChange={e => setParams({ keyword: e.target.value })}
          />
          {params.keyword && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
              onClick={() => setParams({ keyword: '' })}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={onToggleFilters}
          className={`btn-secondary h-9 px-3 gap-1.5 ${showFilters ? 'border-primary-600 text-primary-400' : ''}`}
        >
          <FilterIcon className="w-4 h-4" />
          筛选
        </button>

        {/* AI Chat toggle */}
        <button
          onClick={onToggleAiChat}
          className={`btn-secondary h-9 px-3 gap-1.5 ${showAiChat ? 'border-primary-600 text-primary-400' : ''}`}
          title="AI 智能搜索"
        >
          <SparklesIcon className="w-4 h-4" />
          AI
        </button>

        {/* Sort */}
        <select
          className="select h-9 text-sm w-36"
          value={`${params.sortBy}:${params.sortOrder}`}
          onChange={e => {
            const [sortBy, sortOrder] = e.target.value.split(':')
            setParams({ sortBy: sortBy as any, sortOrder: sortOrder as any })
          }}
        >
          <option value="createdAt:desc">最新添加</option>
          <option value="createdAt:asc">最早添加</option>
          <option value="title:asc">标题 A-Z</option>
          <option value="title:desc">标题 Z-A</option>
          <option value="duration:desc">时长 长→短</option>
          <option value="duration:asc">时长 短→长</option>
          <option value="rating:desc">评分最高</option>
          <option value="playCount:desc">最常播放</option>
        </select>
      </div>

      {/* Result count */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs text-ink-3">
          {loading ? '搜索中...' : `共 ${total} 个文件`}
        </span>
      </div>
    </div>
  )
}
