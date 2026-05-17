/**
 * 后台渐进式分析调度器
 * 在应用空闲时自动分析未处理的音频文件
 */

import type { DatabaseService } from './database'
import { analyzeAudioWithAI, resolveProvider } from './aiAnalyzer'

// ── Constants ─────────────────────────────────────────────────────────────────
const TOKENS_PER_SECOND = 5         // 每秒音频估算消耗的 token 数
const MIN_TOKENS_PER_FILE = 100     // 单文件最低 token 预算
const STARTUP_DELAY_MS = 30_000     // 启动后延迟首次分析的毫秒数
const MAX_BATCH_SIZE = 3            // 每次分析最大文件数
const DEFAULT_INTERVAL_MINUTES = 10 // 默认轮询间隔（分钟）
const DEFAULT_DAILY_LIMIT = 1000    // 默认每日 token 上限

export class BackgroundAnalyzer {
  private db: DatabaseService
  private timer: NodeJS.Timeout | null = null
  private running = false
  private lastRunDate = ''
  private dailyTokenUsed = 0

  constructor(db: DatabaseService) {
    this.db = db
  }

  /** 启动后台分析 */
  start() {
    if (this.running) return

    const config = this.db.getAiConfig()
    const enableBackgroundAnalysis = this.db.getSetting('ai.enableBackgroundAnalysis', 'false') === 'true'

    if (!enableBackgroundAnalysis) {
      console.log('[BackgroundAnalyzer] Disabled in settings')
      return
    }

    // 检查 API Key 是否已配置
    const provider = resolveProvider(config)
    if (provider.requiresApiKey && !config.apiKey) {
      console.log('[BackgroundAnalyzer] No API key configured, skipping')
      return
    }

    this.running = true
    const interval = parseInt(this.db.getSetting('ai.backgroundInterval', String(DEFAULT_INTERVAL_MINUTES))) * 60 * 1000
    const dailyLimit = parseInt(this.db.getSetting('ai.backgroundDailyLimit', String(DEFAULT_DAILY_LIMIT)))

    console.log(`[BackgroundAnalyzer] Started (interval: ${interval / 60000}min, daily limit: ${dailyLimit} tokens)`)

    this.timer = setInterval(() => {
      this.runAnalysisCycle(dailyLimit)
    }, interval)

    // 立即运行一次（延迟 STARTUP_DELAY_MS，避免启动时冲突）
    setTimeout(() => {
      this.runAnalysisCycle(dailyLimit)
    }, STARTUP_DELAY_MS)
  }

  /** 停止后台分析 */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
    console.log('[BackgroundAnalyzer] Stopped')
  }

  /** 重启后台分析（配置更改后调用） */
  restart() {
    this.stop()
    this.start()
  }

  /** 运行一次分析周期 */
  private async runAnalysisCycle(dailyLimit: number) {
    try {
      // 检查日期是否改变，如果是新的一天则重置计数器
      const today = new Date().toISOString().split('T')[0]
      if (today !== this.lastRunDate) {
        this.lastRunDate = today
        this.dailyTokenUsed = 0
        console.log(`[BackgroundAnalyzer] New day, reset token counter`)
      }

      // 检查是否已达到每日限制
      if (this.dailyTokenUsed >= dailyLimit) {
        console.log(`[BackgroundAnalyzer] Daily limit reached (${this.dailyTokenUsed}/${dailyLimit})`)
        return
      }

      // 获取未分析的文件（每次最多 MAX_BATCH_SIZE 个）
      const batchSize = Math.min(MAX_BATCH_SIZE, Math.floor((dailyLimit - this.dailyTokenUsed) / MIN_TOKENS_PER_FILE))
      if (batchSize === 0) {
        console.log(`[BackgroundAnalyzer] Not enough tokens left for analysis`)
        return
      }

      const fileIds = this.db.getUnanalyzedFileIds(batchSize)
      if (fileIds.length === 0) {
        console.log(`[BackgroundAnalyzer] No unanalyzed files found`)
        return
      }

      console.log(`[BackgroundAnalyzer] Analyzing ${fileIds.length} files...`)

      let successCount = 0
      let failedCount = 0

      for (const id of fileIds) {
        try {
          const audio = this.db.getAudioById(id)
          if (!audio) continue

          const result = await analyzeAudioWithAI(audio, this.db)

          // 标记为已分析（不自动应用结果，让用户手动决定）
          this.db.updateAudioFile(id, { aiAnalyzed: true })

          // 根据音频时长计算 token 消耗（每秒 TOKENS_PER_SECOND 个 tokens）
          const audioDuration = audio.duration || 0
          this.dailyTokenUsed += Math.ceil(audioDuration * TOKENS_PER_SECOND)
          successCount++

          console.log(`[BackgroundAnalyzer] Analyzed: ${audio.fileName}`)

          // 检查是否超过每日限制
          if (this.dailyTokenUsed >= dailyLimit) {
            console.log(`[BackgroundAnalyzer] Daily limit reached after analysis`)
            break
          }
        } catch (e: any) {
          console.error(`[BackgroundAnalyzer] Failed to analyze file ${id}:`, e.message)
          failedCount++
        }
      }

      if (successCount > 0 || failedCount > 0) {
        console.log(`[BackgroundAnalyzer] Cycle completed: ${successCount} success, ${failedCount} failed (tokens used: ${this.dailyTokenUsed}/${dailyLimit})`)
      }
    } catch (e: any) {
      console.error('[BackgroundAnalyzer] Cycle error:', e)
    }
  }

  /** 获取当前状态（用于调试） */
  getStatus() {
    return {
      running: this.running,
      dailyTokenUsed: this.dailyTokenUsed,
      lastRunDate: this.lastRunDate,
    }
  }
}
