import { useState, useEffect } from 'react'
import { PlayerProvider, SearchProvider, useSearch } from './store'
import { AiConfigProvider } from './store/AiConfigContext'
import { AiChatProvider } from './store/AiChatContext'
import { ToastProvider } from './store/ToastContext'
import { BatchAnalyzeProvider } from './store/BatchAnalyzeContext'
import { ThemeProvider } from './store/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { MainContent } from './components/MainContent'
import { PlayerBar } from './components/PlayerBar'
import { TopBar } from './components/TopBar'
import { SettingsModal } from './components/SettingsModal'
import { DirectoriesModal } from './components/DirectoriesModal'
import { OnboardingModal } from './components/OnboardingModal'
import { WelcomeAnalysisModal } from './components/WelcomeAnalysisModal'
import { AnalysisBanner } from './components/AnalysisBanner'
import { getSettings, saveSettings, onDirChanged } from './lib/api'
import { STORAGE_KEYS } from './lib/storageKeys'
import { useAiConfig } from './hooks/useAiConfig'

export type ActiveView = 'library' | 'tags' | 'dirs' | 'dirBrowser'

function AppContent() {
  const [activeView, setActiveView] = useState<ActiveView>('library')
  const [showSettings, setShowSettings] = useState(false)
  const [showDirs, setShowDirs] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showWelcomeAnalysis, setShowWelcomeAnalysis] = useState(false)
  const { isConfigured } = useAiConfig()
  const { refresh } = useSearch()

  useEffect(() => {
    // Check if onboarding has been completed
    getSettings().then(s => {
      if (!s.onboardingCompleted) setShowOnboarding(true)
    }).catch(() => setShowOnboarding(true))
  }, [])

  // Listen for directory changes to refresh audio list
  useEffect(() => {
    const unsub = onDirChanged(({ type }) => {
      if (type === 'added' || type === 'scanned') {
        refresh()
      }
    })
    return unsub
  }, [refresh])

  // 显示 AI 分析引导弹窗（首次配置后）
  useEffect(() => {
    if (!isConfigured) return

    const dontShow = localStorage.getItem(STORAGE_KEYS.ANALYSIS_DONT_SHOW)
    if (dontShow === 'true') return

    const remindLater = localStorage.getItem(STORAGE_KEYS.ANALYSIS_REMIND_LATER)
    const remindTime = localStorage.getItem(STORAGE_KEYS.ANALYSIS_REMIND_TIME)

    if (remindLater === 'true' && remindTime) {
      // 如果设置了稍后提醒，检查是否已经过了 24 小时
      const elapsed = Date.now() - parseInt(remindTime)
      const hours = elapsed / (1000 * 60 * 60)
      if (hours < 24) return // 还没到 24 小时
    }

    // 检查是否是首次登录后的状态（5秒后显示，避免与其他弹窗冲突）
    const timer = setTimeout(() => {
      setShowWelcomeAnalysis(true)
      // 清除稍后提醒标记
      localStorage.removeItem(STORAGE_KEYS.ANALYSIS_REMIND_LATER)
      localStorage.removeItem(STORAGE_KEYS.ANALYSIS_REMIND_TIME)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isConfigured])

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    try {
      await saveSettings({ onboardingCompleted: true } as any)
    } catch {}
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-dark-950 text-ink overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* AI 分析横幅提示（已配置 AI 且库视图时显示） */}
          {isConfigured && activeView === 'library' && <AnalysisBanner />}

          <MainContent activeView={activeView} onOpenDirs={() => setShowDirs(true)} />
        </div>
      </div>

      <PlayerBar />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showDirs && <DirectoriesModal onClose={() => setShowDirs(false)} />}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {showWelcomeAnalysis && (
        <WelcomeAnalysisModal
          isOpen={showWelcomeAnalysis}
          onClose={() => setShowWelcomeAnalysis(false)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AiConfigProvider>
          <AiChatProvider>
            <BatchAnalyzeProvider>
              <PlayerProvider>
                <SearchProvider>
                  <AppContent />
                </SearchProvider>
              </PlayerProvider>
            </BatchAnalyzeProvider>
          </AiChatProvider>
        </AiConfigProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
