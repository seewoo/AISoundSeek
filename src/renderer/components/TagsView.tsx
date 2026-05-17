import { useState, useEffect } from 'react'
import type { Tag } from '../../shared/types'
import { listTags, createTag, updateTag, deleteTag } from '../lib/api'
import { TAG_PRESET_COLORS } from '../lib/utils'
import { PlusIcon, TrashIcon, PencilIcon, XMarkIcon } from './Icons'

export function TagsView() {
  const [tags, setTags] = useState<Tag[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [form, setForm] = useState({ name: '', color: TAG_PRESET_COLORS[0] })

  const loadTags = () => listTags().then(setTags).catch(console.error)

  useEffect(() => { loadTags() }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    await createTag(form.name.trim(), form.color)
    setShowCreate(false)
    setForm({ name: '', color: TAG_PRESET_COLORS[0] })
    loadTags()
  }

  const handleUpdate = async () => {
    if (!editingTag || !form.name.trim()) return
    await updateTag(editingTag.id, form.name.trim(), form.color)
    setEditingTag(null)
    loadTags()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('删除此标签将从所有音频文件中移除，确认删除？')) return
    await deleteTag(id)
    loadTags()
  }

  const openEdit = (tag: Tag) => {
    setEditingTag(tag)
    setForm({ name: tag.name, color: tag.color })
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-rim flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">标签管理</h2>
          <p className="text-xs text-ink-3 mt-0.5">管理音频文件的分类标签</p>
        </div>
        <button onClick={() => { setShowCreate(true); setForm({ name: '', color: TAG_PRESET_COLORS[0] }) }} className="btn-primary text-sm">
          <PlusIcon className="w-4 h-4" />
          新建标签
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Create / Edit form */}
        {(showCreate || editingTag) && (
          <div className="card p-4 mb-6 animate-fade-in">
            <div className="text-sm font-medium text-ink mb-3">
              {editingTag ? '编辑标签' : '新建标签'}
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-ink-3 mb-1 block">标签名称</label>
                <input
                  className="input text-sm"
                  placeholder="输入标签名称..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (editingTag ? handleUpdate() : handleCreate())}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-ink-3 mb-1 block">颜色</label>
                <div className="flex flex-wrap gap-1.5 max-w-52">
                  {TAG_PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-surface-card ring-white scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setShowCreate(false); setEditingTag(null) }}
                className="btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={editingTag ? handleUpdate : handleCreate}
                className="btn-primary text-sm"
              >
                {editingTag ? '更新' : '创建'}
              </button>
            </div>
          </div>
        )}

        {/* Tags grid */}
        {tags.length === 0 ? (
          <div className="text-center py-16 text-ink-3">
            <div className="text-4xl mb-3">🏷️</div>
            <div>还没有标签，点击右上角创建第一个标签</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {tags.map(tag => (
              <div key={tag.id} className="card p-3 flex items-center justify-between group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-ink truncate">{tag.name}</span>
                  <span className="text-xs text-ink-4 flex-shrink-0">({tag.usageCount})</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(tag)} className="btn-ghost w-6 h-6 p-0 text-ink-3 hover:text-ink-2">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(tag.id)} className="btn-ghost w-6 h-6 p-0 text-ink-3 hover:text-red-400">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
