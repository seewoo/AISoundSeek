import { useState } from 'react'
import type { AiAnalysisResult, AudioCategory } from '../../shared/types'
import { MUSIC_TAG_PRESETS, CATEGORY_LABELS } from '../lib/utils'
import { XMarkIcon, CheckIcon } from './Icons'

interface Props {
  result: AiAnalysisResult
  onApply: (result: AiAnalysisResult) => void
  onClose: () => void
}

// Build a color map for preset tags
const TAG_COLOR_MAP: Record<string, string> = {}
for (const group of MUSIC_TAG_PRESETS) {
  for (const tag of group.tags) {
    TAG_COLOR_MAP[tag] = group.color
  }
}

export function AiAnalysisModal({ result, onApply, onClose }: Props) {
  const [description, setDescription] = useState(result.description)
  const [selectedTags, setSelectedTags] = useState<string[]>(result.tags)
  const [category, setCategory] = useState<AudioCategory | undefined>(result.category)

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleApply = () => {
    onApply({ description, tags: selectedTags, category })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h2 className="text-base font-semibold text-dark-100">AI 分析结果</h2>
          </div>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-dark-500 uppercase tracking-wide mb-2">
              生成描述
            </label>
            <textarea
              className="input text-sm resize-none w-full"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="AI 未能生成描述"
            />
            <p className="text-xs text-dark-600 mt-1">可直接编辑后再应用</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-dark-500 uppercase tracking-wide mb-2">
              建议类别
              {result.category ? (
                <span className="ml-2 font-normal normal-case text-dark-600">（AI 已识别，可修改）</span>
              ) : (
                <span className="ml-2 font-normal normal-case text-dark-600">（AI 未能识别，可手动选择）</span>
              )}
            </label>
            <select
              className="input text-sm w-full"
              value={category ?? ''}
              onChange={e => setCategory(e.target.value as AudioCategory || undefined)}
            >
              <option value="">不修改类别</option>
              {(Object.keys(CATEGORY_LABELS) as AudioCategory[]).map(key => (
                <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-dark-500 uppercase tracking-wide mb-2">
              建议标签
              <span className="ml-2 font-normal normal-case text-dark-600">（点击取消选择）</span>
            </label>
            {result.tags.length === 0 ? (
              <p className="text-xs text-dark-600">AI 未返回标签建议</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.tags.map(tag => {
                  const color = TAG_COLOR_MAP[tag] || '#64748b'
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full border transition-all"
                      style={selected ? {
                        backgroundColor: color,
                        borderColor: color,
                        color: '#fff',
                      } : {
                        backgroundColor: `${color}15`,
                        borderColor: `${color}40`,
                        color: color,
                        opacity: 0.5,
                      }}
                    >
                      {selected && <CheckIcon className="w-3 h-3" />}
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="text-xs text-dark-600 bg-dark-800 rounded-lg px-3 py-2">
            点击"应用到编辑"后，描述和所选标签将填入编辑表单，需手动点击"保存"才会写入数据库。
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-dark-700 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-secondary text-sm">取消</button>
          <button onClick={handleApply} className="btn-primary text-sm gap-1">
            <CheckIcon className="w-4 h-4" />
            应用到编辑
          </button>
        </div>
      </div>
    </div>
  )
}
