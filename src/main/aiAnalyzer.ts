/**
 * AI 分析模块
 * 直连 AI 提供商（OpenAI / Anthropic / 其他兼容接口）
 */

import type { AiAnalysisResult, AudioFile, AudioCategory, AiChatMessage, AiChatPick, SearchIntent, CopyrightType, AiConfig, AiProvider } from '../shared/types'
import { MUSIC_TAG_PRESETS } from '../shared/tagPresets'
import { chatCompletion } from './lib/aiClient'
import type { DatabaseService } from './database'
import providersData from './lib/providers.json'

const ALL_PRESET_TAGS = new Set(MUSIC_TAG_PRESETS.flatMap(g => g.tags))

const CATEGORY_MAP: Record<string, AudioCategory> = {
  dialogue:     'dialogue',
  sfx:          'sfx',
  bgm:          'bgm',
  theme:        'theme',
  interactive:  'interactive',
  ambience:     'ambience',
  sound_design: 'sound_design',
}

const CATEGORY_DESCRIPTIONS: Record<AudioCategory, string> = {
  dialogue:     '对白 (Dialogue/Voice) — 人声台词、旁白、对话',
  sfx:          '声效 (SFX) — 单个动作或事件音效',
  bgm:          '背景音乐 (BGM) — 用于衬托场景的持续背景音乐',
  theme:        '主题音乐 (Theme) — 片头/片尾/角色主题曲',
  interactive:  '动态音乐 (Interactive/Adaptive) — 游戏动态音乐、循环素材',
  ambience:     '环境音 (Ambience) — 场景环境音、自然音效、氛围铺垫',
  sound_design: '音效设计 (Sound Design) — 经过创意设计的复杂音效',
}

function buildTagListString(): string {
  return MUSIC_TAG_PRESETS.map(g => `${g.group}: ${g.tags.join(', ')}`).join('\n')
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** 根据 providerId 从预设列表中查找 AiProvider */
export function resolveProvider(config: AiConfig): AiProvider {
  const providers: AiProvider[] = (providersData as any).providers
  const found = providers.find(p => p.id === config.providerId)
  if (!found) {
    // fallback 到 OpenAI
    return providers.find(p => p.id === 'openai')!
  }
  return found
}

/** 获取所有预设提供商列表 */
export function getProviders(): AiProvider[] {
  return (providersData as any).providers as AiProvider[]
}

/**
 * 使用 AI 分析音频文件
 */
export async function analyzeAudioWithAI(
  audio: AudioFile,
  db: DatabaseService
): Promise<AiAnalysisResult> {
  const config = db.getAiConfig()
  const provider = resolveProvider(config)

  const tagListString = buildTagListString()
  const durationStr = formatDuration(audio.duration)

  const systemPrompt = `请以专业影视配乐师/音效设计师的视角，对提供的音频文件进行系统化、结构化分析。请从以下五个维度展开，每个维度独立成段，使用清晰标题，最后附一段总结。分析需详实、专业、可感知，避免主观空泛描述。
1. 整体风格与情绪走向- 音乐/音效属于什么风格？（如史诗、电子、氛围、战斗、悬疑、科幻等）- 情绪如何演变？（如从平静→紧张→爆发→沉寂）是否具有叙事性？
2. 结构与段落划分- 是否有引子、发展、高潮、尾声？段落如何过渡？节奏/情绪是否递进？
- 是否存在循环、变奏、重复结构？有何设计意图？
3. 配器与音色特点- 使用了哪些乐器、音效或合成器？（如弦乐、铜管、电子鼓、金属撞击、环境采样等）
- 音色质感如何？（如冷硬、空灵、厚重、金属感、未来感、有机感）
- 频率分布、空间感、动态范围、混响/延迟等制作手法是否突出？
4.适用场景与用途- 最适合用于哪种影视/游戏/广告/宣传片类型？（如动作片、科幻预告、游戏BOSS战、纪录片、品牌片头等）
- 列出具体场景举例，镜头，情绪
5. 总结与价值定位-该音乐/音效的核心功能是什么？（如制造压迫感、烘托史诗感、引导观众情绪、强化战斗张力等）
- 它有何独特优势或记忆点？是否具备AI生成特征或特定风格标签？
- 对创作者或观众而言，它带来了怎样的听觉体验或心理暗示？
请将分析结果返回一个包含以下内容的 JSON 对象:
1. "description": 分析结果详细说明。
2. "tags": 仅从提供的标签列表中选择相关标签。请选择 3-8 个最相关的标签。
3. "category": 从提供的类别列表中选择最合适的类别键。
请始终仅返回有效的 JSON 数据，不要使用 Markdown。`

  const categoryListString = Object.entries(CATEGORY_DESCRIPTIONS)
    .map(([key, desc]) => `  "${key}": ${desc}`)
    .join('\n')

  const userPrompt = `Audio file metadata:
- Title: ${audio.title || audio.fileName}
- Artist: ${audio.artist || 'Unknown'}
- Album: ${audio.album || 'Unknown'}
- Duration: ${durationStr}
- Current Category: ${audio.category}
- Subcategory: ${audio.subcategory || 'None'}
- Format: ${audio.format?.toUpperCase() || 'Unknown'}, ${audio.bitrate || '?'}kbps

Available categories (choose ONE key):
${categoryListString}

Available tags (choose ONLY from these):
${tagListString}

Respond with JSON: {"description": "...", "tags": ["tag1", "tag2", ...], "category": "category_key"}`

  const content = await chatCompletion(config, provider, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])

  const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`无法解析 AI 返回的 JSON: ${clean.slice(0, 100)}`)
  }

  const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
  const tags: string[] = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === 'string' && ALL_PRESET_TAGS.has(t))
    : []
  const categoryRaw = typeof parsed.category === 'string' ? parsed.category.trim().toLowerCase() : ''
  const category: AudioCategory | undefined = CATEGORY_MAP[categoryRaw] ?? undefined

  return { description, tags, category }
}

/**
 * 使用 AI 从自然语言查询中提取搜索意图（关键词 + 扩展词 + 类别 + 版权）
 */
export async function extractSearchIntent(
  db: DatabaseService,
  userMessage: string,
  recentHistory?: AiChatMessage[]
): Promise<SearchIntent> {
  const config = db.getAiConfig()
  const provider = resolveProvider(config)

  const systemPrompt = `你是音频搜索助手，从用户查询中提取结构化搜索信息。

**任务**：提取以下四类信息

1. **keywords**（主要关键词，最多8个）
   - 提取名词、形容词、音乐术语、风格词、场景词
   - 去掉"有没有"、"找"、"需要"等无意义词
   - 保留英文原样，中文保持最短单元（1-4字）

2. **expandedKeywords**（扩展关键词，最多16个）
   - 为每个主要关键词提供同义词、近义词、英文等价词
   - 包含相关风格词、情绪词、场景词（例："紧张"→["tension","thriller","suspense","压迫","危机"]）
   - 覆盖不同表达习惯（中英文混合、口语/专业术语）
   - 不与 keywords 重复
   - **必须是独立字符串的数组，每个元素只含一个词或短语，禁止用逗号连接多个词放入同一元素**

3. **category**（类别过滤，可选）
   - "bgm"：背景音乐、BGM、配乐、伴奏
   - "sfx"：声效、音效、SFX
   - "dialogue"：对白、台词、旁白、语音
   - "theme"：主题曲、片头曲、片尾曲
   - "ambience"：环境音、氛围音、自然音
   - "interactive"：动态音乐、游戏音乐
   - "sound_design"：音效设计、创意音效
   如果用户没有指定，返回 null

4. **copyright**（版权过滤，可选）
   - "free"：免费、免版权、无版权、CC0、Royalty Free
   - "licensed"：需要授权、版权音乐
   **只有**当用户明确说出版权相关词汇时才设置。不要根据使用场景推断版权意图。如果未明确说明，严格返回 null。

**返回格式**：严格 JSON，不要 Markdown 包裹
{"keywords": ["词1"], "expandedKeywords": ["扩展1", "扩展2"], "category": null, "copyright": null}`

  try {
    const historyMessages = recentHistory ? recentHistory.slice(-6) : []
    const content = await chatCompletion(config, provider, [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ])

    const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((kw: unknown) => typeof kw === 'string' && kw.length > 0).slice(0, 8)
      : []

    const expandedKeywords = Array.isArray(parsed.expandedKeywords)
      ? parsed.expandedKeywords
          .flatMap((kw: unknown) => {
            if (typeof kw !== 'string' || kw.length === 0) return []
            // 兼容模型把多个词用逗号写进同一元素的情况
            return kw.split(/[,，]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          })
          .slice(0, 16)
      : []

    const validCategories = new Set<string>(['dialogue', 'sfx', 'bgm', 'theme', 'interactive', 'ambience', 'sound_design'])
    const category = typeof parsed.category === 'string' && validCategories.has(parsed.category)
      ? parsed.category as AudioCategory
      : undefined

    const validCopyrights = new Set<string>(['free', 'licensed', 'unknown'])
    const copyright = typeof parsed.copyright === 'string' && validCopyrights.has(parsed.copyright)
      ? parsed.copyright as CopyrightType
      : undefined

    if (keywords.length === 0) {
      return fallbackExtraction(userMessage, category, copyright)
    }

    return { keywords, expandedKeywords, category, copyright }
  } catch (e) {
    console.warn('AI 搜索意图提取失败，使用备用分词:', e)
    return fallbackExtraction(userMessage, undefined, undefined)
  }
}

function fallbackExtraction(
  userMessage: string,
  category?: AudioCategory,
  copyright?: CopyrightType
): SearchIntent {
  const cjkWords = userMessage.match(/[\u4e00-\u9fa5]{2,}/g) ?? []
  const alphaWords = userMessage.match(/[a-zA-Z]+/g) ?? []
  const keywords = [...cjkWords.slice(0, 4), ...alphaWords.slice(0, 4)].slice(0, 8)
  return { keywords, expandedKeywords: [], category, copyright }
}

/**
 * Agent 1 — 意图分类器
 * 判断用户最新消息是"全新搜索"还是"追问/补充"，决定后续 Agent 的上下文策略。
 */
export async function classifyUserIntent(
  db: DatabaseService,
  lastUserMsg: string,
  recentExchanges: AiChatMessage[]
): Promise<'new_search' | 'follow_up'> {
  if (recentExchanges.length === 0) return 'new_search'

  const config = db.getAiConfig()
  const provider = resolveProvider(config)

  const systemPrompt = `判断用户最新消息的类型，只返回 JSON，不要任何 Markdown。

new_search（全新搜索）：用户提出与之前话题无关的新需求，包含新的主题词、场景词或明确意图。
follow_up（追问补充）：用户在上次搜索基础上继续，例如"再来几首"、"换几首"、"更快节奏的"、"时长更长的"、"再推荐一些"等模糊追问。

返回格式：{"type":"new_search"} 或 {"type":"follow_up"}`

  try {
    const content = await chatCompletion(config, provider, [
      { role: 'system', content: systemPrompt },
      ...recentExchanges.slice(-4),
      { role: 'user', content: lastUserMsg },
    ])
    const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    return parsed.type === 'follow_up' ? 'follow_up' : 'new_search'
  } catch {
    // 分类失败时默认 follow_up，避免"再推荐"类追问丢失上下文
    return 'follow_up'
  }
}

/**
 * AI 对话式搜索
 */
export async function aiChatSearch(
  db: DatabaseService,
  messages: AiChatMessage[],
  candidateList: AudioFile[]
): Promise<{ reply: string; picks: AiChatPick[] }> {
  const config = db.getAiConfig()
  const provider = resolveProvider(config)

  // 候选数量多时使用紧凑格式，减少 token 消耗
  const isLargeList = candidateList.length > 100
  const listStr = candidateList
    .map(a => {
      const title = (a.title || a.fileName).slice(0, 40)
      const dur = formatDuration(a.duration)
      if (isLargeList) {
        return `[${a.id}] ${title} (${dur}) [${a.category}]`
      }
      const artist = a.artist && a.artist !== 'Unknown' ? ` - ${a.artist}` : ''
      const desc = a.description ? ` "${a.description.slice(0, 60)}"` : ''
      return `[ID:${a.id}] ${title}${artist} (${dur}) [${a.category}]${desc}`
    })
    .join('\n')

  const systemPrompt = `你是一个音频搜索助手，帮助用户从候选列表中选择最匹配的音频文件。
请分析用户的需求，从候选列表（共 ${candidateList.length} 个）中选出最匹配的 1-10 个音频（按相关性排序），每个选择都需要解释理由。
注意：候选集来自多路关键词扩展召回，请结合用户实际意图仔细筛选，不要只选靠前的结果。

**严格约束**：picks 中的 id 必须来自下方候选列表，绝对禁止使用历史对话中出现的任何其他 id，违反此规则将导致结果无效。
**重要**：严格返回JSON格式，不要使用Markdown代码块包裹
返回格式：{"reply": "简短回复", "picks": [{"id": <音频ID>, "reason": "选择理由"}, ...]}

候选列表：
${listStr}`

  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  let content = ''
  let clean = ''

  try {
    content = await chatCompletion(config, provider, chatMessages)
    clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)

    const reply = typeof parsed.reply === 'string' ? parsed.reply : '未找到匹配结果'
    const picks: AiChatPick[] = Array.isArray(parsed.picks)
      ? parsed.picks
          .filter((p: any) => typeof p.id === 'number' && typeof p.reason === 'string')
          .slice(0, 10)
      : []

    return { reply, picks }
  } catch (e: any) {
    console.error('AI 搜索响应解析失败:', e)

    let errorMessage = 'AI 搜索失败，请重试'
    if (!content) {
      errorMessage = 'AI 服务暂时不可用，请稍后重试'
    } else if (e instanceof SyntaxError) {
      errorMessage = 'AI 返回格式有误，建议重新提问或换个说法'
    } else if (e.message?.includes('timeout') || e.message?.includes('ETIMEDOUT')) {
      errorMessage = 'AI 响应超时，请稍后重试'
    } else if (e.message?.includes('network') || e.message?.includes('ECONNREFUSED')) {
      errorMessage = '无法连接到 AI 服务，请检查网络连接'
    }

    return { reply: errorMessage, picks: [] }
  }
}
