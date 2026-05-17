import type { AudioCategory, CopyrightType } from '../../shared/types'

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export const CATEGORY_LABELS: Record<AudioCategory, string> = {
  dialogue:     '对白',
  sfx:          '声效',
  bgm:          '背景音乐',
  theme:        '主题音乐',
  interactive:  '动态音乐',
  ambience:     '环境音',
  sound_design: '音效设计',
}

export const CATEGORY_COLORS: Record<AudioCategory, string> = {
  dialogue:     '#a78bfa',
  sfx:          '#f59e0b',
  bgm:          '#0ea5e9',
  theme:        '#ec4899',
  interactive:  '#22c55e',
  ambience:     '#10b981',
  sound_design: '#f97316',
}

export const COPYRIGHT_LABELS: Record<CopyrightType, string> = {
  free: '免版权',
  licensed: '需要授权',
  unknown: '未知',
}

export const COPYRIGHT_COLORS: Record<CopyrightType, string> = {
  free: '#22c55e',
  licensed: '#f97316',
  unknown: '#94a3b8',
}

export const TAG_PRESET_COLORS = [
  '#0ea5e9', '#6366f1', '#a78bfa', '#ec4899', '#f43f5e',
  '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#64748b', '#94a3b8',
]

export type { TagPresetGroup } from '../../shared/tagPresets'
export { MUSIC_TAG_PRESETS } from '../../shared/tagPresets'


