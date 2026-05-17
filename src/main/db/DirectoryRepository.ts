import path from 'path'
import type { MusicDirectory } from '../../shared/types'
import { DbContext } from './DbContext'

export class DirectoryRepository {
  constructor(private ctx: DbContext) {}

  list(): MusicDirectory[] {
    return this.ctx.query(`SELECT * FROM music_directories ORDER BY label`).map(this.map)
  }

  findById(id: number): MusicDirectory | null {
    const row = this.ctx.queryOne(`SELECT * FROM music_directories WHERE id = ?`, [id])
    return row ? this.map(row) : null
  }

  findByPath(dirPath: string): MusicDirectory | null {
    const row = this.ctx.queryOne(`SELECT * FROM music_directories WHERE dir_path = ?`, [dirPath])
    return row ? this.map(row) : null
  }

  add(dirPath: string, label: string): MusicDirectory {
    this.ctx.run(
      `INSERT OR IGNORE INTO music_directories (dir_path, label) VALUES (?, ?)`,
      [dirPath, label || path.basename(dirPath)]
    )
    return this.findByPath(dirPath)!
  }

  remove(id: number, dirPath: string): void {
    const prefix = dirPath.replace(/\\/g, '/').replace(/\/$/, '')
    this.ctx.transaction(() => {
      this.ctx.db.run(
        `DELETE FROM audio_files WHERE replace(file_path, '\\', '/') LIKE ?`,
        [`${prefix}/%`]
      )
      this.ctx.db.run(`DELETE FROM music_directories WHERE id = ?`, [id])
    })
  }

  updateScanInfo(id: number, fileCount: number): void {
    this.ctx.run(
      `UPDATE music_directories SET last_scan_at = datetime('now'), file_count = ? WHERE id = ?`,
      [fileCount, id]
    )
  }

  private map(row: any): MusicDirectory {
    return {
      id: row.id,
      dirPath: row.dir_path,
      label: row.label,
      autoScan: row.auto_scan === 1,
      lastScanAt: row.last_scan_at,
      fileCount: row.file_count,
    }
  }
}
