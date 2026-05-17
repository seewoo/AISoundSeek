import { useState, useEffect } from 'react'
import type { AppSettings, AiConfig, AiProvider } from '../../shared/types'
import { getSettings, saveSettings, getAiConfig, saveAiConfig, getProviders, testAiConnection } from '../lib/api'
import { useAiConfig } from '../hooks/useAiConfig'
import { XMarkIcon, SparklesIcon } from './Icons'

type TabId = 'general' | 'ai' | 'about'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: '常规' },
  { id: 'ai', label: 'AI 设置' },
  { id: 'about', label: '关于' },
]

interface Props {
  onClose: () => void
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'zh-CN',
  playerVolume: 0.8,
  defaultCategory: 'sfx',
  autoExtractTags: true,
  scanOnStartup: false,
  coverCacheDir: '',
  onboardingCompleted: true,
}

export function SettingsModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('ai')
  const { reload: reloadAiConfig } = useAiConfig()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // AI config state (local draft)
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    providerId: 'openai',
    apiKey: '',
    model: '',
    enableOnScan: false,
  })
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Update state
  type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateError, setUpdateError] = useState('')
  const [appVersion, setAppVersion] = useState('1.0.0')

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error)
    getAiConfig().then(cfg => setAiConfig(cfg as AiConfig)).catch(console.error)
    getProviders().then(setProviders).catch(console.error)
    ;(window.electronAPI as any).getVersion().then((v: string) => {
      if (v) setAppVersion(v)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const api = window.electronAPI as any
    if (!api?.onUpdateAvailable) return
    const unsubs = [
      api.onUpdateAvailable((info: any) => { setUpdateInfo(info); setUpdateStatus('available') }),
      api.onUpdateNotAvailable(() => setUpdateStatus('not-available')),
      api.onUpdateDownloadProgress((p: any) => { setDownloadProgress(Math.floor(p.percent ?? 0)); setUpdateStatus('downloading') }),
      api.onUpdateDownloaded((info: any) => { setUpdateInfo(info); setUpdateStatus('downloaded') }),
      api.onUpdateError((msg: string) => {
        let friendlyMsg = '检查更新失败，请稍后重试'
        if (msg.includes('404') || msg.includes('latest.yml')) {
          friendlyMsg = '暂无可用更新'
        } else if (msg.includes('networ') || msg.includes('Network')) {
          friendlyMsg = '网络连接失败，请检查网络'
        } else if (msg.includes('timeout')) {
          friendlyMsg = '连接超时，请稍后重试'
        }
        setUpdateError(friendlyMsg)
        setUpdateStatus('error')
      }),
    ]
    return () => unsubs.forEach((fn: () => void) => fn?.())
  }, [])

  const currentProvider = providers.find(p => p.id === aiConfig.providerId)

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    try {
      const api = window.electronAPI as any
      await api.checkForUpdates()
    } catch (e: any) {
      setUpdateError(e.message)
      setUpdateStatus('error')
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading')
    try {
      const api = window.electronAPI as any
      await api.downloadUpdate()
    } catch (e: any) {
      setUpdateError(e.message)
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = () => {
    const api = window.electronAPI as any
    api.installUpdate()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAi = async () => {
    setAiSaving(true)
    try {
      await saveAiConfig(aiConfig)
      setAiSaved(true)
      reloadAiConfig()
      setTimeout(() => setAiSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setAiSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testAiConnection(aiConfig)
      setTestResult({ ok: true, message: `连接成功：${result.reply}` })
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || '连接失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleProviderChange = (providerId: string) => {
    const p = providers.find(pp => pp.id === providerId)
    const defaultModel = p?.models?.[0] ?? ''
    setAiConfig(c => ({ ...c, providerId, model: defaultModel, customBaseUrl: undefined }))
    setTestResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-rim rounded-2xl w-full max-w-lg flex flex-col shadow-2xl animate-fade-in" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rim flex-shrink-0">
          <h2 className="text-base font-semibold text-ink">设置</h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 p-0">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-rim px-2 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {tab.id === 'ai' && <SparklesIcon className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <SettingRow
                label="自动提取标签"
                description="扫描时从文件名自动提取分类标签"
              >
                <Toggle
                  value={settings.autoExtractTags}
                  onChange={v => setSettings(s => ({ ...s, autoExtractTags: v }))}
                />
              </SettingRow>

              <SettingRow
                label="启动时自动扫描"
                description="应用启动后自动扫描所有已添加目录"
              >
                <Toggle
                  value={settings.scanOnStartup}
                  onChange={v => setSettings(s => ({ ...s, scanOnStartup: v }))}
                />
              </SettingRow>

              <SettingRow label="默认音频类别" description="新扫描文件的默认类别">
                <select
                  className="select text-sm w-36"
                  value={settings.defaultCategory}
                  onChange={e => setSettings(s => ({ ...s, defaultCategory: e.target.value as any }))}
                >
                  <option value="dialogue">对白</option>
                  <option value="sfx">声效</option>
                  <option value="bgm">背景音乐</option>
                  <option value="theme">主题音乐</option>
                  <option value="interactive">动态音乐</option>
                  <option value="ambience">环境音</option>
                  <option value="sound_design">音效设计</option>
                </select>
              </SettingRow>

              <SettingRow label="默认音量" description={`${Math.round(settings.playerVolume * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.playerVolume}
                  onChange={e => setSettings(s => ({ ...s, playerVolume: Number(e.target.value) }))}
                  className="w-32"
                />
              </SettingRow>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-5">
              {/* Provider selector */}
              <SettingRow label="AI 提供商" description="选择要使用的 AI 模型提供商">
                <select
                  className="select text-sm w-44"
                  value={aiConfig.providerId}
                  onChange={e => handleProviderChange(e.target.value)}
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </SettingRow>

              {/* Model selector */}
              <SettingRow label="模型" description="选择要调用的具体模型">
                {currentProvider?.models && currentProvider.models.length > 0 ? (
                  <select
                    className="select text-sm w-44"
                    value={aiConfig.model}
                    onChange={e => setAiConfig(c => ({ ...c, model: e.target.value }))}
                  >
                    {currentProvider.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input text-sm w-44"
                    placeholder="输入模型名称..."
                    value={aiConfig.model}
                    onChange={e => setAiConfig(c => ({ ...c, model: e.target.value }))}
                  />
                )}
              </SettingRow>

              {/* API Key (hidden if provider doesn't require one) */}
              {currentProvider?.requiresApiKey !== false && (
                <SettingRow label="API Key" description="访问该提供商所需的密钥">
                  <input
                    type="password"
                    className="input text-sm w-44 font-mono"
                    placeholder="sk-..."
                    value={aiConfig.apiKey}
                    onChange={e => setAiConfig(c => ({ ...c, apiKey: e.target.value }))}
                    autoComplete="off"
                  />
                </SettingRow>
              )}

              {/* Custom base URL (only for custom provider) */}
              {currentProvider?.isCustom && (
                <SettingRow label="接口地址" description="自定义 OpenAI 兼容接口的基础 URL">
                  <input
                    className="input text-sm w-44"
                    placeholder="https://api.example.com/v1"
                    value={aiConfig.customBaseUrl ?? ''}
                    onChange={e => setAiConfig(c => ({ ...c, customBaseUrl: e.target.value }))}
                  />
                </SettingRow>
              )}

              <SettingRow
                label="扫描时自动分析"
                description="扫描新文件时调用 AI 生成描述和标签"
              >
                <Toggle
                  value={aiConfig.enableOnScan}
                  onChange={v => setAiConfig(c => ({ ...c, enableOnScan: v }))}
                />
              </SettingRow>

              {/* Test connection */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  {testing ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  测试连接
                </button>
                {testResult && (
                  <span className={`text-xs ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-5">
              {/* App identity */}
              <div className="flex items-center gap-4 pb-5 border-b border-rim">
                <div className="w-14 h-14 rounded-2xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="w-7 h-7 text-primary-400" />
                </div>
                <div>
                  <div className="text-base font-bold text-ink">音觅</div>
                  <div className="text-xs text-ink-3 mt-0.5">版本 {appVersion}</div>
                  <div className="text-xs text-ink-2 mt-1">本地音频 AI 检索工具，一键扫描、智能识别、精准查找你的音频文件</div>
                </div>
              </div>

              {/* Developer info */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-2 border-b border-rim">
                  <span className="text-ink-3">开发者</span>
                  <span className="text-ink-2">Seewoo</span>
                </div>
                <div className="flex justify-between py-2 border-b border-rim">
                  <span className="text-ink-3">官方网站</span>
                  <span className="text-ink-2">https://aisoundseek.cn</span>
                </div>
                <div className="flex justify-between py-2 border-b border-rim">
                  <span className="text-ink-3">问题反馈</span>
                  <span className="text-ink-2">shinbada@outlook.com</span>
                </div>
                <div className="flex justify-between py-2 border-b border-rim">
                  <span className="text-ink-3">开源协议</span>
                  <span className="text-ink-2">MIT License</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-3">版权</span>
                  <span className="text-ink-2">&copy; 2026 aisoundseek.cn. All rights reserved.</span>
                </div>
              </div>

              {/* Tech stack */}
              <div>
                <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">技术栈</div>
                <div className="flex flex-wrap gap-1.5">
                  {['Electron', 'React 18', 'TypeScript', 'Vite', 'SQLite', 'Tailwind CSS'].map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded bg-surface-card text-ink-2 border border-rim">{t}</span>
                  ))}
                </div>
              </div>

              {/* Update checker */}
              <div className="pt-3 border-t border-rim">
                <div className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">软件更新</div>
                {updateStatus === 'idle' && (
                  <button onClick={handleCheckUpdate} className="btn-secondary text-xs w-full">
                    检查更新
                  </button>
                )}
                {updateStatus === 'checking' && (
                  <div className="flex items-center gap-2 text-xs text-ink-2">
                    <div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    正在检查更新...
                  </div>
                )}
                {updateStatus === 'not-available' && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400">✓ 已是最新版本</span>
                    <button onClick={handleCheckUpdate} className="text-xs text-ink-3 hover:text-ink-2">重新检查</button>
                  </div>
                )}
                {updateStatus === 'available' && (
                  <div className="space-y-2">
                    <div className="text-xs text-primary-400">
                      发现新版本 {updateInfo?.version}，建议更新以获得最新功能和修复。
                    </div>
                    <button onClick={handleDownloadUpdate} className="btn-primary text-xs w-full">
                      下载更新
                    </button>
                  </div>
                )}
                {updateStatus === 'downloading' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-ink-2">
                      <span>下载中...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-btn rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {updateStatus === 'downloaded' && (
                  <div className="space-y-2">
                    <div className="text-xs text-green-400">✓ 更新已下载完成，重启后生效</div>
                    <button onClick={handleInstallUpdate} className="btn-primary text-xs w-full">
                      立即重启并安装
                    </button>
                  </div>
                )}
                {updateStatus === 'error' && (
                  <div className="space-y-2">
                    <div className="text-xs text-red-400">✗ {updateError || '检查更新失败'}</div>
                    <button onClick={handleCheckUpdate} className="btn-secondary text-xs w-full">重试</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-rim px-6 py-4 flex justify-end gap-2 flex-shrink-0">
          {activeTab === 'general' && (
            <>
              <button onClick={onClose} className="btn-secondary text-sm">取消</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                {saved ? '✓ 已保存' : saving ? '保存中...' : '保存设置'}
              </button>
            </>
          )}
          {activeTab === 'ai' && (
            <>
              <button onClick={onClose} className="btn-secondary text-sm">取消</button>
              <button onClick={handleSaveAi} disabled={aiSaving} className="btn-primary text-sm">
                {aiSaved ? '✓ 已保存' : aiSaving ? '保存中...' : '保存设置'}
              </button>
            </>
          )}
          {activeTab === 'about' && (
            <button onClick={onClose} className="btn-secondary text-sm">关闭</button>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink whitespace-nowrap">{label}</div>
        {description && <div className="text-xs text-ink-3 mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-rim-2'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}
