/**
 * DatabaseContext — 封装 sql.js 数据库连接的底层读写方法。
 * 各 Repository 通过注入此上下文来执行 SQL，无需持有 db 引用。
 */

// sql.js Database type (loaded dynamically to avoid compilation issues)
type SqlJsDatabase = import('sql.js').Database

export class DbContext {
  /** 是否正在事务中（避免 save 被嵌套调用时触发写盘） */
  private _inTransaction = false

  constructor(
    public readonly db: SqlJsDatabase,
    private readonly dbPath: string
  ) {}

  /** 持久化到磁盘（事务进行中时跳过，由 transaction() 统一写盘） */
  save(): void {
    if (this._inTransaction) return
    const fs = require('fs') as typeof import('fs')
    const data = this.db.export()
    fs.writeFileSync(this.dbPath, Buffer.from(data))
  }

  /**
   * 批量写操作包装器：BEGIN → 执行 → COMMIT，最后统一写盘一次。
   * 出现异常时自动 ROLLBACK。
   */
  transaction(fn: () => void): void {
    this.db.run('BEGIN')
    this._inTransaction = true
    try {
      fn()
      this.db.run('COMMIT')
    } catch (e) {
      try { this.db.run('ROLLBACK') } catch { /* ignore secondary error */ }
      throw e
    } finally {
      this._inTransaction = false
      this.save()
    }
  }

  /** 执行查询并返回所有行 */
  query(sql: string, params: unknown[] = []): any[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params as any)
    const rows: any[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  }

  /** 执行查询并返回第一行（无结果时返回 null） */
  queryOne(sql: string, params: unknown[] = []): any | null {
    const rows = this.query(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  /** 执行写操作，返回 lastInsertRowid 和 changes */
  run(sql: string, params: unknown[] = []): { lastInsertRowid: number; changes: number } {
    this.db.run(sql, params as any)
    const changes = this.db.getRowsModified()
    const lastIdRows = this.db.exec('SELECT last_insert_rowid()')
    const lastInsertRowid = (lastIdRows[0]?.values[0]?.[0] as number) ?? 0
    this.save()
    return { lastInsertRowid, changes }
  }
}
