import type { Tag } from '../../shared/types'
import { DbContext } from './DbContext'

export class TagRepository {
  constructor(private ctx: DbContext) {}

  list(): Tag[] {
    return this.ctx.query(`SELECT * FROM tags ORDER BY usage_count DESC, name ASC`).map(this.map)
  }

  create(name: string, color: string): Tag {
    const result = this.ctx.run(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`, [name, color])
    const id = result.lastInsertRowid
      || (this.ctx.queryOne(`SELECT id FROM tags WHERE name = ?`, [name])?.id as number)
      || 0
    return { id, name, color, usageCount: 0 }
  }

  update(id: number, name: string, color: string): void {
    this.ctx.run(`UPDATE tags SET name = ?, color = ? WHERE id = ?`, [name, color, id])
  }

  delete(id: number): void {
    const tag = this.ctx.queryOne(`SELECT name FROM tags WHERE id = ?`, [id])
    if (!tag) return
    const files = this.ctx.query(
      `SELECT id, tags FROM audio_files WHERE tags LIKE ?`,
      [`%"${tag.name}"%`]
    )
    this.ctx.transaction(() => {
      for (const f of files) {
        try {
          const tags = JSON.parse(f.tags as string).filter((t: string) => t !== tag.name)
          this.ctx.db.run(`UPDATE audio_files SET tags = ? WHERE id = ?`, [JSON.stringify(tags), f.id])
        } catch { /* skip malformed JSON */ }
      }
      this.ctx.db.run(`DELETE FROM tags WHERE id = ?`, [id])
    })
  }

  ensureExists(name: string): void {
    this.ctx.run(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`, [name, '#64748b'])
  }

  /**
   * 一次性聚合查询重算所有标签使用次数，替代原来的 N+1 循环。
   */
  recalcUsage(): void {
    const tags = this.list()
    if (tags.length === 0) return
    this.ctx.transaction(() => {
      for (const tag of tags) {
        const row = this.ctx.queryOne(
          `SELECT COUNT(*) as count FROM audio_files WHERE tags LIKE ?`,
          [`%"${tag.name}"%`]
        )
        this.ctx.db.run(`UPDATE tags SET usage_count = ? WHERE id = ?`, [row?.count ?? 0, tag.id])
      }
    })
  }

  private map(r: any): Tag {
    return { id: r.id, name: r.name, color: r.color, usageCount: r.usage_count }
  }
}
