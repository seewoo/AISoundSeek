import type { ChatSession, ChatSessionSummary, StoredMessage } from '../../shared/types'
import { DbContext } from './DbContext'

export class ChatSessionRepository {
  constructor(private ctx: DbContext) {}

  list(): ChatSessionSummary[] {
    const rows = this.ctx.query(
      `SELECT id, name, messages, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC`
    )
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      messageCount: this.countMessages(r.messages as string),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  get(id: number): ChatSession | null {
    const row = this.ctx.queryOne(`SELECT * FROM chat_sessions WHERE id = ?`, [id])
    if (!row) return null
    return this.map(row)
  }

  create(name: string): ChatSession {
    const now = Date.now()
    const result = this.ctx.run(
      `INSERT INTO chat_sessions (name, messages, created_at, updated_at) VALUES (?, '[]', ?, ?)`,
      [name, now, now]
    )
    return { id: result.lastInsertRowid, name, messages: [], createdAt: now, updatedAt: now }
  }

  update(id: number, messages: StoredMessage[], name?: string): void {
    const now = Date.now()
    const json = JSON.stringify(messages)
    if (name !== undefined) {
      this.ctx.run(
        `UPDATE chat_sessions SET messages = ?, name = ?, updated_at = ? WHERE id = ?`,
        [json, name, now, id]
      )
    } else {
      this.ctx.run(
        `UPDATE chat_sessions SET messages = ?, updated_at = ? WHERE id = ?`,
        [json, now, id]
      )
    }
  }

  rename(id: number, name: string): void {
    this.ctx.run(
      `UPDATE chat_sessions SET name = ?, updated_at = ? WHERE id = ?`,
      [name, Date.now(), id]
    )
  }

  delete(id: number): void {
    this.ctx.run(`DELETE FROM chat_sessions WHERE id = ?`, [id])
  }

  private countMessages(json: string): number {
    try { return JSON.parse(json).length } catch { return 0 }
  }

  private map(r: any): ChatSession {
    let messages: StoredMessage[] = []
    try { messages = JSON.parse(r.messages) } catch { /* keep empty */ }
    return {
      id: r.id,
      name: r.name,
      messages,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
