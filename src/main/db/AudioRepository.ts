import path from 'path'
import type { AudioFile, SearchParams, SearchResult } from '../../shared/types'
import { DbContext } from './DbContext'

export class AudioRepository {
  constructor(private ctx: DbContext) {}

  upsert(file: Partial<AudioFile> & { filePath: string; fileName: string }): AudioFile {
    const existing = this.ctx.queryOne(
      `SELECT id, title FROM audio_files WHERE file_path = ?`,
      [file.filePath]
    )

    if (existing) {
      this.ctx.run(
        `UPDATE audio_files SET
          file_name = ?, title = ?, artist = ?, album = ?,
          duration = ?, file_size = ?, format = ?, sample_rate = ?,
          bitrate = ?, channels = ?, cover_path = ?,
          updated_at = datetime('now')
        WHERE file_path = ?`,
        [
          file.fileName,
          file.title || existing.title || '',
          file.artist || '',
          file.album || '',
          file.duration || 0,
          file.fileSize || 0,
          file.format || '',
          file.sampleRate || 0,
          file.bitrate || 0,
          file.channels || 0,
          file.coverPath ?? null,
          file.filePath,
        ]
      )
      return this.findById(existing.id)!
    } else {
      const result = this.ctx.run(
        `INSERT INTO audio_files
          (file_path, file_name, title, artist, album, duration, file_size,
           format, sample_rate, bitrate, channels, cover_path,
           category, subcategory, copyright, copyright_note, description, tags, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          file.filePath,
          file.fileName,
          file.title || '',
          file.artist || '',
          file.album || '',
          file.duration || 0,
          file.fileSize || 0,
          file.format || '',
          file.sampleRate || 0,
          file.bitrate || 0,
          file.channels || 0,
          file.coverPath ?? null,
          file.category || 'sfx',
          file.subcategory || '',
          file.copyright || 'unknown',
          file.copyrightNote || '',
          file.description || '',
          JSON.stringify(file.tags || []),
          file.rating || 0,
        ]
      )
      return this.findById(result.lastInsertRowid)!
    }
  }

  findById(id: number): AudioFile | null {
    const row = this.ctx.queryOne(`SELECT * FROM audio_files WHERE id = ?`, [id])
    return row ? this.map(row) : null
  }

  update(id: number, data: Partial<AudioFile>): AudioFile | null {
    const fields: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      title: 'title', artist: 'artist', album: 'album',
      category: 'category', subcategory: 'subcategory',
      copyright: 'copyright', copyrightNote: 'copyright_note',
      description: 'description', rating: 'rating', aiAnalyzed: 'ai_analyzed',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = ?`)
        values.push(key === 'aiAnalyzed' ? ((data as any)[key] ? 1 : 0) : (data as any)[key])
      }
    }

    if ('tags' in data) {
      fields.push(`tags = ?`)
      values.push(JSON.stringify(data.tags))
    }

    if (fields.length === 0) return this.findById(id)

    fields.push(`updated_at = datetime('now')`)
    values.push(id)

    this.ctx.run(`UPDATE audio_files SET ${fields.join(', ')} WHERE id = ?`, values)
    return this.findById(id)
  }

  delete(id: number): void {
    this.ctx.run(`DELETE FROM audio_files WHERE id = ?`, [id])
  }

  search(params: SearchParams): SearchResult {
    const conditions: string[] = []
    const values: unknown[] = []

    if (params.keyword) {
      conditions.push(
        `(title LIKE ? OR file_name LIKE ? OR artist LIKE ? OR album LIKE ? OR description LIKE ? OR tags LIKE ?)`
      )
      const kw = `%${params.keyword}%`
      values.push(kw, kw, kw, kw, kw, kw)
    }

    if (params.category) { conditions.push(`category = ?`); values.push(params.category) }
    if (params.copyright) { conditions.push(`copyright = ?`); values.push(params.copyright) }
    if (params.minDuration !== undefined) { conditions.push(`duration >= ?`); values.push(params.minDuration) }
    if (params.maxDuration !== undefined) { conditions.push(`duration <= ?`); values.push(params.maxDuration) }
    if (params.rating !== undefined && params.rating > 0) { conditions.push(`rating >= ?`); values.push(params.rating) }

    if (params.tags && params.tags.length > 0) {
      conditions.push(`(${params.tags.map(() => `tags LIKE ?`).join(' AND ')})`)
      for (const tag of params.tags) { values.push(`%"${tag}"%`) }
    }

    if (params.dirPath) {
      const normDir = params.dirPath.replace(/\\/g, '/')
      conditions.push(`REPLACE(file_path, '\\', '/') LIKE ?`)
      values.push(`${normDir}/%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sortColMap: Record<string, string> = {
      fileName: 'file_name', title: 'title', duration: 'duration',
      createdAt: 'created_at', rating: 'rating', playCount: 'play_count', updatedAt: 'updated_at',
    }
    const sortCol = sortColMap[params.sortBy || 'updatedAt'] || 'updated_at'
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC'
    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const offset = (page - 1) * pageSize

    const totalRow = this.ctx.queryOne(`SELECT COUNT(*) as count FROM audio_files ${where}`, values)
    const total = (totalRow?.count as number) ?? 0

    const rows = this.ctx.query(
      `SELECT * FROM audio_files ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    )
    return { total, items: rows.map(r => this.map(r)) }
  }

  listSubdirs(parentPath: string): string[] {
    const normParent = parentPath.replace(/\\/g, '/').replace(/\/$/, '')
    const rows = this.ctx.query(
      `SELECT DISTINCT REPLACE(file_path, '\\', '/') as norm_path FROM audio_files WHERE REPLACE(file_path, '\\', '/') LIKE ?`,
      [`${normParent}/%`]
    )
    const subdirs = new Set<string>()
    for (const row of rows) {
      const rest = (row.norm_path as string).slice(normParent.length + 1)
      const slashIdx = rest.indexOf('/')
      if (slashIdx > 0) subdirs.add(normParent + '/' + rest.slice(0, slashIdx))
    }
    return Array.from(subdirs).sort()
  }

  incrementPlayCount(id: number): void {
    this.ctx.run(
      `UPDATE audio_files SET play_count = play_count + 1, last_played_at = datetime('now') WHERE id = ?`,
      [id]
    )
  }

  getStats(): { total: number; byCategory: any[]; byCopyright: any[] } {
    const totalRow = this.ctx.queryOne(`SELECT COUNT(*) as count FROM audio_files`)
    return {
      total: (totalRow?.count as number) ?? 0,
      byCategory: this.ctx.query(`SELECT category, COUNT(*) as count FROM audio_files GROUP BY category`),
      byCopyright: this.ctx.query(`SELECT copyright, COUNT(*) as count FROM audio_files GROUP BY copyright`),
    }
  }

  batchUpdate(ids: number[], data: Partial<Pick<AudioFile, 'category' | 'copyright' | 'rating' | 'tags'>>): void {
    if (ids.length === 0) return
    this.ctx.transaction(() => {
      for (const id of ids) {
        const fields: string[] = []
        const values: unknown[] = []
        if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category) }
        if (data.copyright !== undefined) { fields.push('copyright = ?'); values.push(data.copyright) }
        if (data.rating !== undefined) { fields.push('rating = ?'); values.push(data.rating) }
        if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
        if (fields.length === 0) continue
        fields.push(`updated_at = datetime('now')`)
        values.push(id)
        this.ctx.db.run(`UPDATE audio_files SET ${fields.join(', ')} WHERE id = ?`, values as any)
      }
    })
  }

  getWaveform(id: number): number[] | null {
    const row = this.ctx.queryOne(`SELECT waveform_data FROM audio_files WHERE id = ?`, [id])
    if (!row || !row.waveform_data) return null
    try { return JSON.parse(row.waveform_data as string) } catch { return null }
  }

  saveWaveform(id: number, peaks: number[]): void {
    this.ctx.run(`UPDATE audio_files SET waveform_data = ? WHERE id = ?`, [JSON.stringify(peaks), id])
  }

  getUnanalyzedStats(directories: { dirPath: string; label: string }[]): {
    total: number; totalDuration: number; byDirectory: { dirPath: string; label: string; count: number }[]
  } {
    const totalRow = this.ctx.queryOne(`SELECT COUNT(*) as count FROM audio_files WHERE ai_analyzed = 0`)
    const total = (totalRow?.count as number) ?? 0
    const durationRow = this.ctx.queryOne(
      `SELECT COALESCE(SUM(duration), 0) as totalDuration FROM audio_files WHERE ai_analyzed = 0`
    )
    const totalDuration = (durationRow?.totalDuration as number) ?? 0

    const byDirectory: { dirPath: string; label: string; count: number }[] = []
    for (const dir of directories) {
      const normDir = dir.dirPath.replace(/\\/g, '/')
      const countRow = this.ctx.queryOne(
        `SELECT COUNT(*) as count FROM audio_files WHERE ai_analyzed = 0 AND REPLACE(file_path, '\\', '/') LIKE ?`,
        [`${normDir}/%`]
      )
      const count = (countRow?.count as number) ?? 0
      if (count > 0) byDirectory.push({ dirPath: dir.dirPath, label: dir.label, count })
    }
    return { total, totalDuration, byDirectory }
  }

  getUnanalyzedFileIds(limit?: number): number[] {
    const sql = limit
      ? `SELECT id FROM audio_files WHERE ai_analyzed = 0 ORDER BY created_at DESC LIMIT ?`
      : `SELECT id FROM audio_files WHERE ai_analyzed = 0 ORDER BY created_at DESC`
    return this.ctx.query(sql, limit ? [limit] : []).map((r: any) => r.id as number)
  }

  map(row: any): AudioFile {
    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      fileSize: row.file_size,
      format: row.format,
      sampleRate: row.sample_rate,
      bitrate: row.bitrate,
      channels: row.channels,
      coverPath: row.cover_path,
      category: row.category,
      subcategory: row.subcategory,
      copyright: row.copyright,
      copyrightNote: row.copyright_note,
      description: row.description,
      tags: (() => { try { return JSON.parse(row.tags as string) } catch { return [] } })(),
      rating: row.rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastPlayedAt: row.last_played_at,
      playCount: row.play_count,
      waveformData: (() => {
        try { return row.waveform_data ? JSON.parse(row.waveform_data as string) : null } catch { return null }
      })(),
      aiAnalyzed: row.ai_analyzed === 1,
    }
  }

  deleteByDirPath(dirPath: string): void {
    const prefix = dirPath.replace(/\\/g, '/').replace(/\/$/, '')
    this.ctx.run(`DELETE FROM audio_files WHERE replace(file_path, '\\', '/') LIKE ?`, [`${prefix}/%`])
  }

  countByDirPath(dirPath: string): number {
    const normDir = dirPath.replace(/\\/g, '/')
    const row = this.ctx.queryOne(
      `SELECT COUNT(*) as count FROM audio_files WHERE REPLACE(file_path, '\\', '/') LIKE ?`,
      [`${normDir}/%`]
    )
    return (row?.count as number) ?? 0
  }
}
