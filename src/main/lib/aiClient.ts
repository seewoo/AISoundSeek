/**
 * AI 直连客户端
 * 支持 OpenAI 兼容 API 和 Anthropic API
 */

import type { AiConfig, AiProvider } from '../../shared/types'
import { NetworkError, BackendError } from './errors'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 向 AI 提供商发送对话请求，返回助手回复文本
 */
export async function chatCompletion(
  config: AiConfig,
  provider: AiProvider,
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl = provider.isCustom
    ? (config.customBaseUrl || '').replace(/\/$/, '')
    : provider.baseUrl.replace(/\/$/, '')

  if (!baseUrl) {
    throw new Error('AI 提供商地址未配置，请在设置中填写自定义 API 地址')
  }

  if (provider.requiresApiKey && !config.apiKey) {
    throw new Error('API Key 未配置，请在设置中填写 API Key')
  }

  if (provider.apiStyle === 'anthropic') {
    return callAnthropic(baseUrl, config.apiKey, config.model, messages)
  }
  return callOpenAICompat(baseUrl, config.apiKey, config.model, messages)
}

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const url = `${baseUrl}/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    })
  } catch (e: any) {
    throw new NetworkError(`连接 AI 提供商失败: ${e.message}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new BackendError(`AI 请求失败 (HTTP ${response.status}): ${body.slice(0, 200)}`, response.status)
  }

  const data: any = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error(`AI 返回格式异常: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return content
}

async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  // Anthropic expects system as a top-level param, not in messages
  const systemMsg = messages.find(m => m.role === 'system')
  const userMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const url = `${baseUrl}/v1/messages`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: userMessages,
      }),
    })
  } catch (e: any) {
    throw new NetworkError(`连接 Anthropic 失败: ${e.message}`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new BackendError(`Anthropic 请求失败 (HTTP ${response.status}): ${body.slice(0, 200)}`, response.status)
  }

  const data: any = await response.json()
  const content = data?.content?.[0]?.text
  if (typeof content !== 'string') {
    throw new Error(`Anthropic 返回格式异常: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return content
}
