/**
 * AI 配置状态 Context
 * 管理全局的 AI 提供商配置状态
 */

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { AiConfig, AiProvider } from '../../shared/types'
import * as api from '../lib/api'

interface AiConfigContextValue {
  /** 是否已完成 AI 配置（有 API Key 或不需要 Key） */
  isConfigured: boolean
  config: AiConfig
  providers: AiProvider[]
  /** 当前选中的提供商对象 */
  currentProvider: AiProvider | null
  /** 重新从数据库加载配置 */
  reload: () => Promise<void>
}

const DEFAULT_CONFIG: AiConfig = {
  providerId: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  enableOnScan: false,
}

export const AiConfigContext = createContext<AiConfigContextValue>({
  isConfigured: false,
  config: DEFAULT_CONFIG,
  providers: [],
  currentProvider: null,
  reload: async () => {},
})

export function AiConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG)
  const [providers, setProviders] = useState<AiProvider[]>([])

  const reload = useCallback(async () => {
    try {
      const [cfg, provs] = await Promise.all([api.getAiConfig(), api.getProviders()])
      setConfig(cfg)
      setProviders(provs)
    } catch (e) {
      console.error('Failed to load AI config:', e)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const currentProvider = providers.find(p => p.id === config.providerId) ?? null

  const isConfigured =
    !!currentProvider &&
    (currentProvider.requiresApiKey === false || config.apiKey.length > 0)

  return (
    <AiConfigContext.Provider value={{ isConfigured, config, providers, currentProvider, reload }}>
      {children}
    </AiConfigContext.Provider>
  )
}
