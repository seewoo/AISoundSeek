import { useState, useEffect, useRef } from 'react'
import type { AudioFile } from '../../../shared/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/utils'
import { updateAudio } from '../../lib/api'

interface Props {
  audio: AudioFile
  allCategories: Array<{ name: string; label: string; color: string }>
  onUpdated: (updated: AudioFile) => void
}

/** Inline category dropdown that appears when clicking the category badge */
export function CategoryBadge({ audio, allCategories, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const color = CATEGORY_COLORS[audio.category as keyof typeof CATEGORY_COLORS]
    ?? allCategories.find(c => c.name === audio.category)?.color
    ?? '#64748b'
  const label = CATEGORY_LABELS[audio.category as keyof typeof CATEGORY_LABELS]
    ?? allCategories.find(c => c.name === audio.category)?.label
    ?? audio.category

  const handleSelect = async (catName: string) => {
    setOpen(false)
    try {
      const updated = await updateAudio(audio.id, { category: catName })
      onUpdated(updated)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div ref={ref} className="relative w-16">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="text-xs px-1.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity w-full truncate"
        style={{ color, borderColor: `${color}50`, backgroundColor: `${color}15` }}
        title="点击修改类别"
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-surface-card border border-rim-2 rounded-lg shadow-xl py-1 min-w-[120px]">
          {allCategories.map(cat => (
            <button
              key={cat.name}
              onClick={e => { e.stopPropagation(); handleSelect(cat.name) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover flex items-center gap-2 ${audio.category === cat.name ? 'text-primary-400' : 'text-ink'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
