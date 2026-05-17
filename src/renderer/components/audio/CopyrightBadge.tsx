import { useState, useEffect, useRef } from 'react'
import type { AudioFile, CopyrightType } from '../../../shared/types'
import { COPYRIGHT_COLORS, COPYRIGHT_LABELS } from '../../lib/utils'
import { updateAudio } from '../../lib/api'

interface Props {
  audio: AudioFile
  onUpdated: () => void
}

/** Inline copyright dropdown — same pattern as CategoryBadge */
export function CopyrightBadge({ audio, onUpdated }: Props) {
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

  const color = COPYRIGHT_COLORS[audio.copyright]
  const label = COPYRIGHT_LABELS[audio.copyright]

  const handleSelect = async (value: CopyrightType) => {
    setOpen(false)
    try {
      await updateAudio(audio.id, { copyright: value })
      onUpdated()
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
        title="点击修改版权"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface-card border border-rim-2 rounded-lg shadow-xl py-1 min-w-[120px]">
          {(Object.entries(COPYRIGHT_LABELS) as [CopyrightType, string][]).map(([value, lbl]) => (
            <button
              key={value}
              onClick={e => { e.stopPropagation(); handleSelect(value) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover flex items-center gap-2 ${audio.copyright === value ? 'text-primary-400' : 'text-ink'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COPYRIGHT_COLORS[value] }} />
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
