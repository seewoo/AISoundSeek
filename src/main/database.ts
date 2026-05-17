import path from 'path'
import fs from 'fs'
import type { AudioFile, Tag, MusicDirectory, SearchParams, SearchResult, AppSettings, CustomCategory, AiConfig } from '../shared/types'
import { DbContext } from './db/DbContext'
import { migrate } from './db/schema'
import { DirectoryRepository } from './db/DirectoryRepository'
import { AudioRepository } from './db/AudioRepository'
import { TagRepository } from './db/TagRepository'
import { SettingsRepository } from './db/SettingsRepository'
import { CategoryRepository } from './db/CategoryRepository'

/**
 * DatabaseService — 对外暴露统一的数据库 API。
 * 内部通过 Repository 分层委托实现，保持原有公开接口不变。
 */
export class DatabaseService {
  private ctx!: DbContext
  private dirRepo!: DirectoryRepository
  private audioRepo!: AudioRepository
  private tagRepo!: TagRepository
  private settingsRepo!: SettingsRepository
  private categoryRepo!: CategoryRepository

  private dbPath: string

  constructor(userDataPath: string) {
    this.dbPath = path.join(userDataPath, 'audio-manager.db')
  }

  async initialize(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const initSqlJs = require('sql.js')
    const { app } = require('electron')

    const wasmPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      : path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

    const SQL = await initSqlJs({ locateFile: () => wasmPath })

    const rawDb = fs.existsSync(this.dbPath)
      ? new SQL.Database(fs.readFileSync(this.dbPath))
      : new SQL.Database()

    rawDb.run('PRAGMA foreign_keys = ON')

    this.ctx = new DbContext(rawDb, this.dbPath)

    // Build repositories
    this.settingsRepo = new SettingsRepository(this.ctx)
    this.dirRepo = new DirectoryRepository(this.ctx)
    this.audioRepo = new AudioRepository(this.ctx)
    this.tagRepo = new TagRepository(this.ctx)
    this.categoryRepo = new CategoryRepository(this.ctx)

    migrate(rawDb, (sql) => this.ctx.query(sql))
    this.ctx.save()
  }

  // ── Transaction helper (used by scanner and handlers) ──────────────────────

  transaction(fn: () => void): void {
    this.ctx.transaction(fn)
  }

  // ── Directories ────────────────────────────────────────────────────────────

  addDirectory(dirPath: string, label: string): MusicDirectory {
    return this.dirRepo.add(dirPath, label)
  }

  removeDirectory(id: number): void {
    const dir = this.dirRepo.findById(id)
    if (dir) this.dirRepo.remove(id, dir.dirPath)
  }

  listDirectories(): MusicDirectory[] {
    return this.dirRepo.list()
  }

  getDirectoryByPath(dirPath: string): MusicDirectory | null {
    return this.dirRepo.findByPath(dirPath)
  }

  updateDirectoryScanInfo(id: number, fileCount: number): void {
    this.dirRepo.updateScanInfo(id, fileCount)
  }

  // ── Audio Files ─────────────────────────────────────────────────────────────

  upsertAudioFile(file: Partial<AudioFile> & { filePath: string; fileName: string }): AudioFile {
    return this.audioRepo.upsert(file)
  }

  getAudioById(id: number): AudioFile | null {
    return this.audioRepo.findById(id)
  }

  updateAudioFile(id: number, data: Partial<AudioFile>): AudioFile | null {
    const result = this.audioRepo.update(id, data)
    if ('tags' in data) this.tagRepo.recalcUsage()
    return result
  }

  deleteAudioFile(id: number): void {
    this.audioRepo.delete(id)
    this.tagRepo.recalcUsage()
  }

  searchAudioFiles(params: SearchParams): SearchResult {
    return this.audioRepo.search(params)
  }

  listSubdirs(parentPath: string): string[] {
    return this.audioRepo.listSubdirs(parentPath)
  }

  incrementPlayCount(id: number): void {
    this.audioRepo.incrementPlayCount(id)
  }

  getStats(): { total: number; byCategory: any[]; byCopyright: any[] } {
    return this.audioRepo.getStats()
  }

  batchUpdateAudioFiles(ids: number[], data: Partial<Pick<AudioFile, 'category' | 'copyright' | 'rating' | 'tags'>>): void {
    this.audioRepo.batchUpdate(ids, data)
  }

  // ── Waveform ────────────────────────────────────────────────────────────────

  getWaveform(id: number): number[] | null {
    return this.audioRepo.getWaveform(id)
  }

  saveWaveform(id: number, peaks: number[]): void {
    this.audioRepo.saveWaveform(id, peaks)
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  listTags(): Tag[] {
    return this.tagRepo.list()
  }

  createTag(name: string, color: string): Tag {
    return this.tagRepo.create(name, color)
  }

  updateTag(id: number, name: string, color: string): void {
    this.tagRepo.update(id, name, color)
  }

  deleteTag(id: number): void {
    this.tagRepo.delete(id)
  }

  ensureTagExists(name: string): void {
    this.tagRepo.ensureExists(name)
  }

  recalcTagUsage(): void {
    this.tagRepo.recalcUsage()
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  getSetting(key: string, defaultValue: string): string {
    return this.settingsRepo.get(key, defaultValue)
  }

  setSetting(key: string, value: string): void {
    this.settingsRepo.set(key, value)
  }

  getSettings(): AppSettings {
    return this.settingsRepo.getSettings()
  }

  saveSettings(settings: Partial<AppSettings>): void {
    this.settingsRepo.saveSettings(settings)
  }

  getAiConfig(): AiConfig {
    return this.settingsRepo.getAiConfig()
  }

  saveAiConfig(config: Partial<AiConfig>): void {
    this.settingsRepo.saveAiConfig(config)
  }

  // ── Custom Categories ────────────────────────────────────────────────────────

  listCustomCategories(): CustomCategory[] {
    return this.categoryRepo.list()
  }

  createCustomCategory(name: string, label: string, color: string): CustomCategory {
    return this.categoryRepo.create(name, label, color)
  }

  updateCustomCategory(id: number, label: string, color: string): void {
    this.categoryRepo.update(id, label, color)
  }

  deleteCustomCategory(id: number): void {
    this.categoryRepo.delete(id)
  }

  // ── Batch AI Analysis ────────────────────────────────────────────────────────

  getUnanalyzedStats(): { total: number; totalDuration: number; byDirectory: { dirPath: string; label: string; count: number }[] } {
    return this.audioRepo.getUnanalyzedStats(this.dirRepo.list())
  }

  getUnanalyzedFileIds(limit?: number): number[] {
    return this.audioRepo.getUnanalyzedFileIds(limit)
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  close(): void {
    this.ctx.save()
    this.ctx.db.close()
  }
}
