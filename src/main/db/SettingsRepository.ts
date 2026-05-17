import type { AppSettings, AiConfig } from '../../shared/types'
import { DbContext } from './DbContext'

export class SettingsRepository {
  constructor(private ctx: DbContext) {}

  get(key: string, defaultValue: string): string {
    const row = this.ctx.queryOne(`SELECT value FROM settings WHERE key = ?`, [key])
    return row ? (row.value as string) : defaultValue
  }

  set(key: string, value: string): void {
    this.ctx.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value])
  }

  getSettings(): AppSettings {
    const g = (k: string, d: string) => this.get(k, d)
    return {
      theme: g('theme', 'dark') as AppSettings['theme'],
      language: g('language', 'zh-CN'),
      playerVolume: parseFloat(g('playerVolume', '0.8')),
      defaultCategory: g('defaultCategory', 'sfx') as AppSettings['defaultCategory'],
      autoExtractTags: g('autoExtractTags', 'true') === 'true',
      scanOnStartup: g('scanOnStartup', 'false') === 'true',
      coverCacheDir: g('coverCacheDir', ''),
      onboardingCompleted: g('onboardingCompleted', 'false') === 'true',
    }
  }

  saveSettings(settings: Partial<AppSettings>): void {
    for (const [key, value] of Object.entries(settings)) {
      this.set(key, String(value))
    }
  }

  getAiConfig(): AiConfig {
    // Migration: if old ai.baseUrl exists but no providerId, migrate to custom
    let providerId = this.get('ai.providerId', '')
    if (!providerId) {
      const oldBaseUrl = this.get('ai.baseUrl', '')
      if (oldBaseUrl && oldBaseUrl !== 'https://api.openai.com/v1') {
        providerId = 'custom'
        this.set('ai.providerId', 'custom')
        this.set('ai.customBaseUrl', oldBaseUrl)
      } else {
        providerId = 'openai'
        this.set('ai.providerId', 'openai')
      }
    }
    return {
      providerId,
      apiKey: this.get('ai.apiKey', ''),
      model: this.get('ai.model', 'gpt-4o-mini'),
      customBaseUrl: this.get('ai.customBaseUrl', '') || undefined,
      enableOnScan: this.get('ai.enableOnScan', 'false') === 'true',
    }
  }

  saveAiConfig(config: Partial<AiConfig>): void {
    if (config.providerId !== undefined) this.set('ai.providerId', config.providerId)
    if (config.apiKey !== undefined) this.set('ai.apiKey', config.apiKey)
    if (config.model !== undefined) this.set('ai.model', config.model)
    if (config.customBaseUrl !== undefined) this.set('ai.customBaseUrl', config.customBaseUrl)
    if (config.enableOnScan !== undefined) this.set('ai.enableOnScan', String(config.enableOnScan))
  }
}
