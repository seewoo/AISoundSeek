import type { IpcMain } from 'electron'
import type { DatabaseService } from '../database'
import type { AiChatMessage, AudioFile, BatchAnalyzeOptions, AiConfig } from '../../shared/types'
import { analyzeAudioWithAI, aiChatSearch, extractSearchIntent, classifyUserIntent, getProviders, resolveProvider } from '../aiAnalyzer'
import { chatCompletion } from '../lib/aiClient'
import { BackendError } from '../lib/errors'

function checkAiConfig(db: DatabaseService): { ok: true } | { ok: false; response: object } {
  const config = db.getAiConfig()
  const providers = getProviders()
  const provider = providers.find(p => p.id === config.providerId) ?? providers.find(p => p.id === 'openai')!
  if (provider.requiresApiKey && !config.apiKey) {
    return { ok: false, response: { success: false, error: '请先在设置中配置 API Key', code: 400 } }
  }
  return { ok: true }
}

export function registerAiHandlers(ipcMain: IpcMain, db: DatabaseService): void {
  ipcMain.handle('ai:getProviders', async () => {
    try {
      return { success: true, data: getProviders() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ai:getUnanalyzedStats', async () => {
    try {
      return { success: true, data: db.getUnanalyzedStats() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ai:analyze', async (_, { audioId }: { audioId: number }) => {
    try {
      const audio = db.getAudioById(audioId)
      if (!audio) return { success: false, error: '音频文件不存在' }

      const check = checkAiConfig(db)
      if (!check.ok) return check.response

      const result = await analyzeAudioWithAI(audio, db)
      return { success: true, data: result }
    } catch (e: any) {
      if (e instanceof BackendError && e.code === 401) {
        return { success: false, error: 'API Key 无效，请在设置中检查配置', code: 401 }
      }
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('ai:chatSearch', async (_, { messages }: { messages: AiChatMessage[] }) => {
    try {
      const check = checkAiConfig(db)
      if (!check.ok) return check.response

      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

      // Agent 1：意图分类 — 判断全新搜索 or 追问补充
      const recentExchanges = messages.slice(-4)
      const intentType = await classifyUserIntent(db, lastUserMsg, recentExchanges)

      // Agent 2：搜索意图提取 — 全新搜索不携带历史，追问则携带最近 2 条用户消息
      const userOnlyHistory = intentType === 'follow_up'
        ? messages.slice(0, -1).filter(m => m.role === 'user').slice(-2)
        : []
      const searchIntent = await extractSearchIntent(db, lastUserMsg, userOnlyHistory)

      // 追问时排除已推荐过的 ID；全新搜索重置，允许重新推荐相同文件
      const shownIds = new Set<number>()
      if (intentType === 'follow_up') {
        for (const msg of messages) {
          if (msg.role !== 'assistant') continue
          try {
            const parsed = JSON.parse(msg.content)
            if (Array.isArray(parsed.picks)) {
              for (const p of parsed.picks) {
                if (typeof p.id === 'number') shownIds.add(p.id)
              }
            }
          } catch { /* 非 JSON 格式的 assistant 消息直接跳过 */ }
        }
      }

      const seen = new Set<number>()
      const candidates: AudioFile[] = []
      const addResults = (items: AudioFile[]) => {
        for (const item of items) {
          if (!seen.has(item.id) && !shownIds.has(item.id)) {
            seen.add(item.id)
            candidates.push(item)
          }
        }
      }

      const allKeywords = [...searchIntent.keywords, ...searchIntent.expandedKeywords]

      // 用给定过滤器对所有关键词做搜索
      const searchKeywords = (category?: typeof searchIntent.category, copyright?: typeof searchIntent.copyright) => {
        for (const kw of allKeywords) {
          if (candidates.length >= 300) break
          addResults(
            db.searchAudioFiles({ keyword: kw, category, copyright, pageSize: 50, page: 1 }).items
          )
        }
      }

      // 阶段1：全部过滤器
      searchKeywords(searchIntent.category, searchIntent.copyright)

      // 阶段2：结果不足时去掉 copyright 重试
      if (candidates.length < 8 && searchIntent.copyright) {
        searchKeywords(searchIntent.category, undefined)
      }

      // 阶段3：仍不足时再去掉 category 重试
      if (candidates.length < 8 && searchIntent.category) {
        searchKeywords(undefined, undefined)
      }

      // 兜底：无关键词匹配时取最新文件
      if (candidates.length < 8) {
        addResults(
          db.searchAudioFiles({
            pageSize: 100,
            page: 1,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }).items
        )
      }

      const finalCandidates = candidates.slice(0, 300)

      if (finalCandidates.length === 0) {
        return {
          success: true,
          data: {
            reply: '没有找到匹配的音频。请尝试更换关键词或调整筛选条件。',
            picks: [],
            items: [],
          },
        }
      }

      const aiResult = await aiChatSearch(db, messages, finalCandidates)
      const candidateMap = new Map(finalCandidates.map((c) => [c.id, c]))
      const items = aiResult.picks
        .map((p) => candidateMap.get(p.id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined)

      // 兜底：AI 选出的 ID 全不在候选池（幻觉复用历史 ID），直接取候选池前 5 条
      if (items.length === 0 && finalCandidates.length > 0) {
        const fallback = finalCandidates.slice(0, 5)
        return {
          success: true,
          data: {
            reply: aiResult.reply,
            picks: fallback.map(c => ({ id: c.id, reason: '为您推荐的相关音频' })),
            items: fallback,
          },
        }
      }

      return { success: true, data: { reply: aiResult.reply, picks: aiResult.picks, items } }
    } catch (e: any) {
      if (e instanceof BackendError && e.code === 401) {
        return { success: false, error: 'API Key 无效，请在设置中检查配置', code: 401 }
      }
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle(
    'ai:batchAnalyze',
    async (event, { fileIds, options }: { fileIds?: number[]; options?: BatchAnalyzeOptions }) => {
      try {
        const check = checkAiConfig(db)
        if (!check.ok) return check.response

        let ids = fileIds ?? db.getUnanalyzedFileIds()

        if (fileIds) {
          const before = ids.length
          ids = ids.filter((id) => {
            const audio = db.getAudioById(id)
            return audio && !audio.aiAnalyzed
          })
          const skipped = before - ids.length
          if (skipped > 0) {
            console.log('[BatchAnalyze] 跳过 ' + skipped + ' 个已分析的音频文件')
          }
        }

        if (ids.length === 0) {
          event.sender.send('ai:batchProgress', {
            current: 0, total: 0, success: 0, failed: 0,
            stopped: false, stopReason: null, done: true,
          })
          return { success: true, data: { success: 0, failed: 0, total: 0 } }
        }

        const concurrency = options?.concurrency ?? 1
        const autoApply = options?.autoApply ?? false
        const total = ids.length
        let current = 0
        let successCount = 0
        let failedCount = 0
        let stopped = false
        let stopReason: 'api_key_invalid' | 'api_error' | null = null

        console.log('[BatchAnalyze] 开始批量分析 - 总数: ' + total + ', 并发: ' + concurrency)

        for (let i = 0; i < ids.length && !stopped; i += concurrency) {
          const batch = ids.slice(i, i + concurrency)

          const results = await Promise.allSettled(
            batch.map(async (id) => {
              const audio = db.getAudioById(id)
              if (!audio) {
                failedCount++
                return { success: false, reason: 'not_found' as const }
              }

              event.sender.send('ai:batchProgress', {
                current: current + 1, total, success: successCount,
                failed: failedCount, currentFile: audio.fileName,
              })

              try {
                const result = await analyzeAudioWithAI(audio, db)
                if (autoApply) {
                  db.updateAudioFile(id, {
                    description: result.description,
                    tags: result.tags,
                    category: result.category ?? audio.category,
                    aiAnalyzed: true,
                  })
                } else {
                  db.updateAudioFile(id, { aiAnalyzed: true })
                }
                successCount++
                return { success: true as const }
              } catch (e: any) {
                if (e instanceof BackendError && e.code === 401) {
                  console.log('[BatchAnalyze] API Key 无效，停止批量分析')
                  return { success: false, reason: 'api_key_invalid' as const }
                }
                console.log('[BatchAnalyze] 分析失败 (ID: ' + id + '): ' + e.message)
                failedCount++
                return { success: false, reason: 'analysis_error' as const }
              }
            })
          )

          for (const r of results) {
            if (r.status === 'fulfilled' && !r.value.success) {
              if (r.value.reason === 'api_key_invalid') {
                stopped = true
                stopReason = 'api_key_invalid'
                break
              }
            }
          }

          current += batch.length
          if (!stopped) {
            event.sender.send('ai:batchProgress', {
              current, total, success: successCount, failed: failedCount,
            })
          }
        }

        event.sender.send('ai:batchProgress', {
          current, total, success: successCount, failed: failedCount,
          done: true, stopped, stopReason,
        })

        if (stopReason === 'api_key_invalid') {
          return {
            success: false,
            error: 'API Key 无效，请在设置中检查配置',
            code: 401,
            data: { success: successCount, failed: failedCount, total, stopped: true },
          }
        }

        return { success: true, data: { success: successCount, failed: failedCount, total } }
      } catch (e: any) {
        if (e instanceof BackendError && e.code === 401) {
          return { success: false, error: 'API Key 无效，请在设置中检查配置', code: 401 }
        }
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle('ai:testConnection', async (_, config: AiConfig) => {
    try {
      const provider = resolveProvider(config)
      const testConfig = { ...config }
      if (provider.isCustom && config.customBaseUrl) {
        // Use the custom URL passed in the test config
      }
      const reply = await chatCompletion(testConfig, provider, [
        { role: 'user', content: 'Reply with exactly: OK' },
      ])
      return { success: true, data: { reply: reply.trim() } }
    } catch (e: any) {
      if (e instanceof BackendError) {
        return { success: false, error: `HTTP ${e.code}: API Key 无效或接口错误`, code: e.code }
      }
      return { success: false, error: e.message }
    }
  })
}
