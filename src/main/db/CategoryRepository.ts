import type { CustomCategory } from '../../shared/types'
import { DbContext } from './DbContext'

export class CategoryRepository {
  constructor(private ctx: DbContext) {}

  list(): CustomCategory[] {
    return this.ctx.query(`SELECT * FROM custom_categories ORDER BY label ASC`).map(this.map)
  }

  create(name: string, label: string, color: string): CustomCategory {
    const result = this.ctx.run(
      `INSERT INTO custom_categories (name, label, color) VALUES (?, ?, ?)`,
      [name, label, color]
    )
    return { id: result.lastInsertRowid, name, label, color }
  }

  update(id: number, label: string, color: string): void {
    this.ctx.run(`UPDATE custom_categories SET label = ?, color = ? WHERE id = ?`, [label, color, id])
  }

  delete(id: number): void {
    const cat = this.ctx.queryOne(`SELECT name FROM custom_categories WHERE id = ?`, [id])
    if (cat) {
      this.ctx.run(`UPDATE audio_files SET category = 'sfx' WHERE category = ?`, [cat.name])
    }
    this.ctx.run(`DELETE FROM custom_categories WHERE id = ?`, [id])
  }

  private map(r: any): CustomCategory {
    return { id: r.id, name: r.name, label: r.label, color: r.color }
  }
}
