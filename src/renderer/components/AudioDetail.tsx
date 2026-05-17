import { useState, useEffect } from 'react'
import type { AudioFile, Tag, CustomCategory, AiAnalysisResult } from '../../shared/types'
import { updateAudio, openFileLocation, listTags, createTag, getCoverImage, listCustomCategories, analyzeAudio, insertToPremiere } from '../lib/api'
import { useSearch, usePlayer } from '../store'
import { useAiConfig } from '../hooks/useAiConfig'
import { useToast } from '../hooks/useToast'
import { useAiErrorHandler } from '../hooks/useAiErrorHandler'
import {
  formatDuration, formatFileSize,
  CATEGORY_LABELS, COPYRIGHT_LABELS, COPYRIGHT_COLORS, CATEGORY_COLORS,
  TAG_PRESET_COLORS, MUSIC_TAG_PRESETS,
} from '../lib/utils'
import { XMarkIcon, PlusIcon, TrashIcon, PlayIcon, PauseIcon, StarIcon, SparklesIcon } from './Icons'
import { AiAnalysisModal } from './AiAnalysisModal'

interface Props {
  audio: AudioFile
  onClose: () => void
  onUpdate: (updated: AudioFile) => void
}

export function AudioDetail({ audio, onClose, onUpdate }: Props) {
  const { refresh } = useSearch()
  const { currentTrack, isPlaying, togglePlay } = usePlayer()
  const { isConfigured } = useAiConfig()
  const toast = useToast()
  const { handleError, aiError, setAiError } = useAiErrorHandler({
    showToast: false,
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...audio })
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activePresetGroup, setActivePresetGroup] = useState(MUSIC_TAG_PRESETS[0].group)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [prInserting, setPrInserting] = useState(false)
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null)

  const isCurrentTrack = currentTrack?.id === audio.id

  useEffect(() => {
    setForm({ ...audio })
    listTags().then(setAvailableTags).catch(console.error)
    listCustomCategories().then(setCustomCategories).catch(console.error)
    getCoverImage(audio.id).then(setCoverUrl).catch(() => setCoverUrl(null))
  }, [audio.id])

  const allCategories = [
    ...Object.entries(CATEGORY_LABELS).map(([name, label]) => ({ name, label, color: CATEGORY_COLORS[name as keyof typeof CATEGORY_COLORS] })),
    ...customCategories.map(c => ({ name: c.name, label: c.label, color: c.color })),
  ]

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateAudio(audio.id, {
        title: form.title,
        artist: form.artist,
        album: form.album,
        category: form.category,
        subcategory: form.subcategory,
        copyright: form.copyright,
        copyrightNote: form.copyrightNote,
        description: form.description,
        tags: form.tags,
        rating: form.rating,
        aiAnalyzed: form.aiAnalyzed,
      })
      onUpdate(updated)
      refresh()
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagName: string) => {
    const current = form.tags
    setForm(f => ({
      ...f,
      tags: current.includes(tagName)
        ? current.filter(t => t !== tagName)
        : [...current, tagName],
    }))
  }

  const addNewTag = async () => {
    const name = newTagInput.trim()
    if (!name) return
    const color = TAG_PRESET_COLORS[Math.floor(Math.random() * TAG_PRESET_COLORS.length)]
    const tag = await createTag(name, color)
    setAvailableTags(prev => prev.find(t => t.id === tag.id) ? prev : [...prev, tag])
    if (!form.tags.includes(name)) setForm(f => ({ ...f, tags: [...f.tags, name] }))
    setNewTagInput('')
  }

  const togglePresetTag = async (tagName: string, groupColor: string) => {
    if (form.tags.includes(tagName)) {
      setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tagName) }))
    } else {
      if (!availableTags.find(t => t.name === tagName)) {
        const tag = await createTag(tagName, groupColor)
        setAvailableTags(prev => [...prev, tag])
      }
      setForm(f => ({ ...f, tags: [...f.tags, tagName] }))
    }
  }

  const handleAiAnalyze = async () => {
    if (!isConfigured) {
      toast.error('请先在设置中配置 AI 提供商和 API Key')
      return
    }

    setAiAnalyzing(true)

    try {
      const result = await analyzeAudio(audio.id)

      // 构建新的表单数据（包含 AI 结果）
      const updatedForm = {
        ...form,
        description: result.description || form.description,
        tags: result.tags.length > 0 ? [...new Set([...form.tags, ...result.tags])] : form.tags,
        category: result.category || form.category,
        aiAnalyzed: true, // 标记为已分析
      }

      // 更新表单状态用于 UI 显示
      setForm(updatedForm)

      // 确保新标签存在
      if (result.tags.length > 0) {
        result.tags.forEach(tagName => {
          if (!availableTags.find(t => t.name === tagName)) {
            createTag(tagName, '#6366f1').then(tag =>
              setAvailableTags(prev => prev.find(t => t.id === tag.id) ? prev : [...prev, tag])
            ).catch(() => {})
          }
        })
      }

      // 直接保存到数据库（使用新的表单数据）
      try {
        setSaving(true)
        const updated = await updateAudio(audio.id, {
          title: updatedForm.title,
          artist: updatedForm.artist,
          album: updatedForm.album,
          category: updatedForm.category,
          subcategory: updatedForm.subcategory,
          copyright: updatedForm.copyright,
          copyrightNote: updatedForm.copyrightNote,
          description: updatedForm.description,
          tags: updatedForm.tags,
          rating: updatedForm.rating,
          aiAnalyzed: updatedForm.aiAnalyzed,
        })
        onUpdate(updated)
        refresh()

        toast.success('AI 分析完成并已保存', {
          message: '已自动应用分析结果',
        })
      } catch (e) {
        console.error('Auto save failed:', e)
        toast.error('保存失败', {
          message: '请手动保存',
        })
      } finally {
        setSaving(false)
      }
    } catch (error: any) {
      handleError(error)
    } finally {
      setAiAnalyzing(false)
    }
  }

  const handleAiApply = (result: AiAnalysisResult) => {
    if (result.description) {
      setForm(f => ({ ...f, description: result.description }))
    }
    if (result.tags.length > 0) {
      setForm(f => ({ ...f, tags: [...new Set([...f.tags, ...result.tags])] }))
      // Ensure new tags exist in available tags list
      result.tags.forEach(tagName => {
        if (!availableTags.find(t => t.name === tagName)) {
          createTag(tagName, '#6366f1').then(tag =>
            setAvailableTags(prev => prev.find(t => t.id === tag.id) ? prev : [...prev, tag])
          ).catch(() => {})
        }
      })
    }
    if (result.category) {
      setForm(f => ({ ...f, category: result.category! }))
    }
    // Mark as AI analyzed
    setForm(f => ({ ...f, aiAnalyzed: true }))
    setAiResult(null)
  }

  const handleInsertToPremiere = async () => {
    setPrInserting(true)
    try {
      await insertToPremiere(audio.id)
      toast.success('已插入到 Premiere 时间轴', {
        message: audio.title,
      })
    } catch (e: any) {
      toast.error('插入失败', {
        message: e.message,
      })
    } finally {
      setPrInserting(false)
    }
  }

  return (
    <div className="w-96 flex-shrink-0 bg-surface border-l border-rim flex flex-col overflow-hidden animate-fade-in">
      {aiResult && (
        <AiAnalysisModal
          result={aiResult}
          onApply={handleAiApply}
          onClose={() => setAiResult(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rim">
        <span className="text-sm font-semibold text-ink">文件详情</span>
        <div className="flex items-center gap-1">
          {/* AI 分析按钮 - 始终显示 */}
          <button
            onClick={handleAiAnalyze}
            disabled={aiAnalyzing || !isConfigured}
            title={!isConfigured ? '请先在设置中配置 API Key' : 'AI 分析 — 自动生成描述和标签'}
            className={`flex items-center gap-1 btn-ghost text-xs px-2 py-1 ${
              !isConfigured
                ? 'opacity-50 cursor-not-allowed text-ink-3'
                : 'text-primary-400 hover:text-primary-300'
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            {aiAnalyzing ? '分析中...' : !isConfigured ? '未配置' : 'AI'}
          </button>

          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-ghost text-xs px-2 py-1">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1">
                {saving ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary text-xs px-2 py-1">编辑</button>
          )}
          <button onClick={onClose} className="btn-ghost w-7 h-7 p-0 ml-1">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI 错误提示区域 */}
      {aiError && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-fade-in">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-red-400">{aiError.title}</div>
              <div className="text-xs text-red-300 mt-1">{aiError.message}</div>
              {aiError.suggestion && (
                <div className="text-xs text-red-400/70 mt-1.5 leading-relaxed">
                  💡 {aiError.suggestion}
                </div>
              )}
              {aiError.action && aiError.actionLabel && (
                <button
                  onClick={aiError.action}
                  className="mt-2 text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium transition-colors"
                >
                  {aiError.actionLabel}
                </button>
              )}
            </div>
            <button
              onClick={() => setAiError(null)}
              className="text-red-400/50 hover:text-red-400 transition-colors"
              title="关闭"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Cover + Play */}
        <div className="px-5 pt-5 pb-4">
          <div className="relative w-36 mx-auto aspect-square rounded-xl overflow-hidden bg-surface-card border border-rim mb-4">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">🎵</span>
              </div>
            )}
            <button
              onClick={() => togglePlay(audio)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center shadow-lg">
                {isCurrentTrack && isPlaying ? (
                  <PauseIcon className="w-6 h-6 text-white" />
                ) : (
                  <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                )}
              </div>
            </button>
          </div>

          {/* Rating */}
          <div className="flex items-center justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => editing && setForm(f => ({ ...f, rating: f.rating === star ? 0 : star }))}
                className={`transition-colors ${editing ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <StarIcon
                  className="w-5 h-5"
                  filled={form.rating >= star}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Metadata fields */}
          <div className="px-5 pb-5 space-y-4">
          <Field label="标题">
            {editing ? (
              <input className="input text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            ) : (
              <span className="text-sm text-ink">{audio.title || '—'}</span>
            )}
          </Field>

          <Field label="艺术家">
            {editing ? (
              <input className="input text-sm" value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} />
            ) : (
              <span className="text-sm text-ink">{audio.artist || '—'}</span>
            )}
          </Field>

          <Field label="专辑">
            {editing ? (
              <input className="input text-sm" value={form.album} onChange={e => setForm(f => ({ ...f, album: e.target.value }))} />
            ) : (
              <span className="text-sm text-ink">{audio.album || '—'}</span>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="类别">
              {editing ? (
                <select className="select text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {allCategories.map(cat => <option key={cat.name} value={cat.name}>{cat.label}</option>)}
                </select>
              ) : (
                <span className="text-sm" style={{ color: CATEGORY_COLORS[audio.category as keyof typeof CATEGORY_COLORS] ?? allCategories.find(c => c.name === audio.category)?.color ?? '#64748b' }}>
                  {CATEGORY_LABELS[audio.category as keyof typeof CATEGORY_LABELS] ?? allCategories.find(c => c.name === audio.category)?.label ?? audio.category}
                </span>
              )}
            </Field>

            <Field label="版权">
              {editing ? (
                <select className="select text-sm" value={form.copyright} onChange={e => setForm(f => ({ ...f, copyright: e.target.value as any }))}>
                  {Object.entries(COPYRIGHT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <span className="text-sm" style={{ color: COPYRIGHT_COLORS[audio.copyright] }}>
                  {COPYRIGHT_LABELS[audio.copyright]}
                </span>
              )}
            </Field>
          </div>

          {(editing || audio.subcategory) && (
            <Field label="子类别">
              {editing ? (
                <input className="input text-sm" placeholder="如：自然、城市、动作..." value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
              ) : (
                <span className="text-sm text-ink">{audio.subcategory}</span>
              )}
            </Field>
          )}

          {(editing || audio.copyrightNote) && (
            <Field label="版权备注">
              {editing ? (
                <input className="input text-sm" placeholder="授权来源、许可证等..." value={form.copyrightNote} onChange={e => setForm(f => ({ ...f, copyrightNote: e.target.value }))} />
              ) : (
                <span className="text-sm text-ink">{audio.copyrightNote}</span>
              )}
            </Field>
          )}

          <Field label="描述">
            {editing ? (
              <textarea
                className="input text-sm resize-none"
                rows={3}
                placeholder="描述这个音频的使用场景、特点..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            ) : (
              <span className="text-sm text-ink">{audio.description || '—'}</span>
            )}
          </Field>

          {/* Tags */}
          <Field label="标签">
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map(tag => {
                const tagObj = availableTags.find(t => t.name === tag)
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                    style={{
                      color: tagObj?.color || '#94a3b8',
                      borderColor: `${tagObj?.color || '#94a3b8'}50`,
                      backgroundColor: `${tagObj?.color || '#94a3b8'}15`,
                    }}
                  >
                    {tag}
                    {editing && (
                      <button onClick={() => toggleTag(tag)} className="hover:text-red-400 transition-colors">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>

            {editing && (
              <>
                {/* Preset tag panel with group tabs */}
                <div className="mt-2 border border-rim rounded-lg overflow-hidden">
                  <div className="flex border-b border-rim">
                    {MUSIC_TAG_PRESETS.map(g => (
                      <button
                        key={g.group}
                        onClick={() => setActivePresetGroup(g.group)}
                        className={`flex-1 text-xs py-1.5 transition-colors ${
                          activePresetGroup === g.group
                            ? 'text-white font-medium'
                            : 'text-ink-2 hover:text-ink'
                        }`}
                        style={activePresetGroup === g.group ? { backgroundColor: `${g.color}30`, color: g.color } : {}}
                      >
                        {g.group}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {(() => {
                      const grp = MUSIC_TAG_PRESETS.find(g => g.group === activePresetGroup)!
                      return grp.tags.map(tag => {
                        const selected = form.tags.includes(tag)
                        return (
                          <button
                            key={tag}
                            onClick={() => togglePresetTag(tag, grp.color)}
                            className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                            style={selected ? {
                              backgroundColor: grp.color,
                              borderColor: grp.color,
                              color: '#fff',
                            } : {
                              backgroundColor: `${grp.color}15`,
                              borderColor: `${grp.color}40`,
                              color: grp.color,
                            }}
                          >
                            {tag}
                          </button>
                        )
                      })
                    })()}
                  </div>
                </div>

                {/* Custom DB tags not in presets */}
                {(() => {
                  const allPresetTags = MUSIC_TAG_PRESETS.flatMap(g => g.tags)
                  const customTags = availableTags.filter(
                    t => !allPresetTags.includes(t.name) && !form.tags.includes(t.name)
                  )
                  return customTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {customTags.slice(0, 15).map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.name)}
                          className="text-xs px-2 py-0.5 rounded-full bg-surface-card text-ink-2 border border-rim hover:border-rim-2 transition-colors"
                        >
                          + {tag.name}
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}

                {/* New custom tag input */}
                <div className="flex gap-2 mt-2">
                  <input
                    className="input text-xs h-7 flex-1"
                    placeholder="自定义标签..."
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNewTag()}
                  />
                  <button onClick={addNewTag} className="btn-secondary text-xs h-7 px-2">
                    <PlusIcon className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </Field>

          {/* File info */}
          <div className="border-t border-rim pt-3 mt-3 space-y-1.5">
            <div className="text-xs font-medium text-ink-3 mb-2">文件信息</div>
            <InfoRow label="文件名" value={audio.fileName} />
            <InfoRow label="格式" value={`${audio.format?.toUpperCase()} · ${audio.bitrate}kbps`} />
            <InfoRow label="时长" value={formatDuration(audio.duration)} />
            <InfoRow label="文件大小" value={formatFileSize(audio.fileSize)} />
            <InfoRow label="采样率" value={audio.sampleRate ? `${audio.sampleRate} Hz` : '—'} />
            <InfoRow label="声道" value={audio.channels === 1 ? '单声道' : audio.channels === 2 ? '立体声' : `${audio.channels}ch`} />
            <InfoRow label="播放次数" value={String(audio.playCount)} />
            <InfoRow label="添加时间" value={new Date(audio.createdAt).toLocaleDateString('zh-CN')} />
            {/* AI 分析状态 */}
            {audio.aiAnalyzed && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-rim mt-1.5">
                <span className="text-ink-3">AI 分析状态</span>
                <span className="flex items-center gap-1 text-indigo-400">
                  <SparklesIcon className="w-3.5 h-3.5" />
                  已分析
                </span>
              </div>
            )}
          </div>

          {/* Open location */}
          <button
            onClick={() => openFileLocation(audio.filePath)}
            className="btn-ghost w-full text-xs justify-center mt-2 border border-rim"
          >
            在文件夹中显示
          </button>

          {/* Insert to Premiere Pro */}
          <button
            onClick={handleInsertToPremiere}
            disabled={prInserting}
            className="btn-primary w-full text-xs justify-center mt-2"
          >
            {prInserting ? '插入中...' : '插入 PR 时间轴'}
          </button>
        </div>
      </div>

      {/* AI 分析结果模态框 */}
      {aiResult && (
        <AiAnalysisModal
          result={aiResult}
          onApply={handleAiApply}
          onClose={() => setAiResult(null)}
        />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-ink-3 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink-2 font-mono truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}
