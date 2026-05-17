import { useState, useEffect } from 'react'
import { useSearch } from '../store'
import type { Tag, CustomCategory } from '../../shared/types'
import { listTags, listCustomCategories } from '../lib/api'
import { CATEGORY_LABELS, CATEGORY_COLORS, COPYRIGHT_LABELS } from '../lib/utils'

export function FilterPanel() {
  const { params, setParams } = useSearch()
  const [tags, setTags] = useState<Tag[]>([])
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])

  useEffect(() => {
    listTags().then(setTags).catch(console.error)
    listCustomCategories().then(setCustomCategories).catch(console.error)
  }, [])

  const allCategories = [
    ...Object.entries(CATEGORY_LABELS).map(([name, label]) => ({ name, label, color: CATEGORY_COLORS[name as keyof typeof CATEGORY_COLORS] })),
    ...customCategories.map(c => ({ name: c.name, label: c.label, color: c.color })),
  ]

  const toggleTag = (name: string) => {
    const current = params.tags || []
    const next = current.includes(name) ? current.filter(t => t !== name) : [...current, name]
    setParams({ tags: next })
  }

  return (
    <div className="px-4 py-3 bg-surface border-b border-rim space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Category */}
        <div>
          <label className="text-xs text-ink-3 mb-1 block">类别</label>
          <select
            className="select text-sm"
            value={params.category || ''}
            onChange={e => setParams({ category: e.target.value as any })}
          >
            <option value="">全部类别</option>
            {allCategories.map(cat => (
              <option key={cat.name} value={cat.name}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Copyright */}
        <div>
          <label className="text-xs text-ink-3 mb-1 block">版权</label>
          <select
            className="select text-sm"
            value={params.copyright || ''}
            onChange={e => setParams({ copyright: e.target.value as any })}
          >
            <option value="">全部版权</option>
            {Object.entries(COPYRIGHT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Duration range */}
        <div>
          <label className="text-xs text-ink-3 mb-1 block">时长（秒）</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="input text-sm h-8 text-center"
              placeholder="最小"
              min={0}
              value={params.minDuration ?? ''}
              onChange={e => setParams({ minDuration: e.target.value ? Number(e.target.value) : undefined })}
            />
            <span className="text-ink-3 text-xs">-</span>
            <input
              type="number"
              className="input text-sm h-8 text-center"
              placeholder="最大"
              min={0}
              value={params.maxDuration ?? ''}
              onChange={e => setParams({ maxDuration: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="text-xs text-ink-3 mb-1 block">最低评分</label>
          <select
            className="select text-sm"
            value={params.rating ?? 0}
            onChange={e => setParams({ rating: Number(e.target.value) })}
          >
            <option value={0}>全部</option>
            {[1, 2, 3, 4, 5].map(r => (
              <option key={r} value={r}>{'★'.repeat(r)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div>
          <label className="text-xs text-ink-3 mb-1.5 block">标签筛选</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 30).map(tag => {
              const active = (params.tags || []).includes(tag.name)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.name)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? 'text-white border-transparent'
                      : 'bg-surface-card text-ink-2 border-rim hover:border-rim-2'
                  }`}
                  style={active ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                >
                  {tag.name}
                  {tag.usageCount > 0 && (
                    <span className="ml-1 opacity-60">({tag.usageCount})</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
