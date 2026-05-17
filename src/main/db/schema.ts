/**
 * schema.ts — 数据库建表与增量迁移。
 * 接受 sql.js Database 实例，无业务逻辑耦合。
 */

type SqlJsDatabase = import('sql.js').Database

export function migrate(db: SqlJsDatabase, queryFn: (sql: string) => any[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS music_directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dir_path TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL DEFAULT '',
      auto_scan INTEGER NOT NULL DEFAULT 1,
      last_scan_at TEXT,
      file_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audio_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL DEFAULT '',
      sample_rate INTEGER NOT NULL DEFAULT 0,
      bitrate INTEGER NOT NULL DEFAULT 0,
      channels INTEGER NOT NULL DEFAULT 0,
      cover_path TEXT,
      category TEXT NOT NULL DEFAULT 'other',
      subcategory TEXT NOT NULL DEFAULT '',
      copyright TEXT NOT NULL DEFAULT 'unknown',
      copyright_note TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      rating INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_played_at TEXT,
      play_count INTEGER NOT NULL DEFAULT 0,
      ai_analyzed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#0ea5e9',
      usage_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b'
    );

    CREATE INDEX IF NOT EXISTS idx_audio_files_category ON audio_files(category);
    CREATE INDEX IF NOT EXISTS idx_audio_files_copyright ON audio_files(copyright);
    CREATE INDEX IF NOT EXISTS idx_audio_files_rating ON audio_files(rating);
    CREATE INDEX IF NOT EXISTS idx_audio_files_updated ON audio_files(updated_at);
  `)

  // ── Incremental column migrations ──────────────────────────────────────────
  const cols = queryFn(`PRAGMA table_info(audio_files)`).map((r: any) => r.name as string)

  if (!cols.includes('waveform_data')) {
    db.run(`ALTER TABLE audio_files ADD COLUMN waveform_data TEXT`)
  }
  if (!cols.includes('ai_analyzed')) {
    db.run(`ALTER TABLE audio_files ADD COLUMN ai_analyzed INTEGER NOT NULL DEFAULT 0`)
  }

  // ── V2: 移除旧的 AI 配置（已迁移到后端代理） ──────────────────────────────
  const migrationDone = queryFn(`SELECT value FROM settings WHERE key = 'schema_migration_v2'`)
  if (migrationDone.length === 0) {
    const oldApiKeyRow = queryFn(`SELECT value FROM settings WHERE key = 'ai.apiKey'`)
    if (oldApiKeyRow.length > 0 && oldApiKeyRow[0].value) {
      db.run(`DELETE FROM settings WHERE key IN ('ai.apiKey', 'ai.baseUrl', 'ai.model')`)
      console.log('[Migration] 已移除旧的 AI 配置，AI 功能已迁移到后端代理服务')
    }
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_migration_v2', '1')`)
  }
}
