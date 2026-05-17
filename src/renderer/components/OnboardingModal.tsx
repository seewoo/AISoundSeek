import { useState } from 'react'
import { addDirectory, selectDirectory, scanDirectory } from '../lib/api'
import { MusicalNoteIcon, FolderOpenIcon, SparklesIcon } from './Icons'

interface Props {
  onComplete: () => void
}

type Step = 'welcome' | 'add-dir' | 'scan' | 'done'

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [dirPath, setDirPath] = useState('')
  const [dirLabel, setDirLabel] = useState('')
  const [dirId, setDirId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanCount, setScanCount] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleSelectDir = async () => {
    const path = await selectDirectory()
    if (path) {
      setDirPath(path)
      // Auto-fill label from last folder name
      const parts = path.replace(/\\/g, '/').split('/')
      setDirLabel(parts[parts.length - 1] || path)
    }
  }

  const handleAddDir = async () => {
    if (!dirPath) return
    setAdding(true)
    setError('')
    try {
      const dir = await addDirectory(dirPath, dirLabel || dirPath)
      setDirId(dir.id)
      setStep('scan')
    } catch (e: any) {
      setError(e.message || '添加目录失败')
    } finally {
      setAdding(false)
    }
  }

  const handleScan = async () => {
    if (!dirId) return
    setScanning(true)
    setError('')
    try {
      const count = await scanDirectory(dirId)
      setScanCount(count)
      setStep('done')
    } catch (e: any) {
      setError(e.message || '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const STEPS: Step[] = ['welcome', 'add-dir', 'scan', 'done']
  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-dark-800">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${((stepIndex) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* ── Welcome ── */}
          {step === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MusicalNoteIcon className="w-10 h-10 text-primary-400" />
              </div>
              <h1 className="text-2xl font-bold text-dark-100 mb-2">欢迎使用音觅</h1>
              <p className="text-dark-400 text-sm leading-relaxed mb-8">
                专业的音频资源管理工具，帮助您高效整理、搜索和管理您的音频文件。
                <br />
                只需几步，即可开始使用。
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                {[
                  { icon: '📁', title: '管理目录', desc: '添加本地音频目录' },
                  { icon: '🔍', title: '智能搜索', desc: '快速找到任意音频' },
                  { icon: '🤖', title: 'AI 分析', desc: '自动生成描述标签' },
                ].map(item => (
                  <div key={item.title} className="p-3 rounded-xl bg-dark-800/60">
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="text-xs font-semibold text-dark-200">{item.title}</div>
                    <div className="text-xs text-dark-500 mt-0.5">{item.desc}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep('add-dir')}
                className="btn-primary w-full text-sm py-3"
              >
                开始配置 →
              </button>
            </div>
          )}

          {/* ── Add Directory ── */}
          {step === 'add-dir' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderOpenIcon className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-dark-100">添加音频目录</h2>
                  <p className="text-xs text-dark-500">选择存储音频文件的文件夹</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wide mb-1.5">
                    目录路径 <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={dirPath}
                      placeholder="点击右侧按钮选择目录..."
                      className="input text-sm flex-1 cursor-default"
                    />
                    <button
                      onClick={handleSelectDir}
                      className="btn-secondary text-sm px-4 flex-shrink-0"
                    >
                      浏览
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wide mb-1.5">
                    目录备注名称
                  </label>
                  <input
                    type="text"
                    value={dirLabel}
                    onChange={e => setDirLabel(e.target.value)}
                    placeholder="如：BGM素材、人声库..."
                    className="input text-sm w-full"
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('welcome')} className="btn-secondary text-sm flex-1">
                  上一步
                </button>
                <button
                  onClick={handleAddDir}
                  disabled={!dirPath || adding}
                  className="btn-primary text-sm flex-1"
                >
                  {adding ? '添加中...' : '添加目录 →'}
                </button>
              </div>

              <p className="text-center mt-3">
                <button
                  onClick={onComplete}
                  className="text-xs text-dark-600 hover:text-dark-400 transition-colors"
                >
                  跳过，稍后在目录管理中添加
                </button>
              </p>
            </div>
          )}

          {/* ── Scan ── */}
          {step === 'scan' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <SparklesIcon className="w-8 h-8 text-primary-400" />
              </div>
              <h2 className="text-lg font-bold text-dark-100 mb-2">扫描音频文件</h2>
              <p className="text-dark-400 text-sm mb-2">
                已添加目录：<span className="text-dark-200 font-medium">{dirLabel || dirPath}</span>
              </p>
              <p className="text-dark-500 text-xs mb-8 leading-relaxed">
                现在可以扫描该目录，将音频文件导入数据库。
                扫描过程会自动读取文件的元数据信息。
              </p>

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</div>
              )}

              {scanning && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary-400 mb-6">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  正在扫描，请稍候...
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onComplete} className="btn-secondary text-sm flex-1" disabled={scanning}>
                  稍后扫描
                </button>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="btn-primary text-sm flex-1"
                >
                  立即扫描
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="text-5xl mb-5">🎉</div>
              <h2 className="text-xl font-bold text-dark-100 mb-2">配置完成！</h2>
              <p className="text-dark-400 text-sm mb-2">
                已成功扫描 <span className="text-primary-400 font-bold text-base">{scanCount}</span> 个音频文件。
              </p>
              <p className="text-dark-500 text-xs mb-8 leading-relaxed">
                您可以在音频库中浏览所有文件，使用搜索和筛选快速定位音频，
                或在设置中配置 AI 分析功能。
              </p>
              <button
                onClick={onComplete}
                className="btn-primary w-full text-sm py-3"
              >
                进入音觅
              </button>
            </div>
          )}
        </div>

        {/* Step dots */}
        {step !== 'done' && (
          <div className="flex justify-center gap-2 pb-5">
            {(['welcome', 'add-dir', 'scan'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-primary-500' : 'bg-dark-700'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
