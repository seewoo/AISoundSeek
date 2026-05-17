import { useRef, useState, useEffect } from 'react'
import { usePlayer } from '../store'
import type { PlayMode } from '../store'
import { formatDuration } from '../lib/utils'
import { PlayIcon, PauseIcon, ForwardIcon, BackwardIcon, SpeakerIcon, SpeakerMuteIcon, PlaySequenceIcon, PlaySingleIcon, RepeatOneIcon } from './Icons'
import { WaveformBar } from './WaveformBar'
import { useWaveformData } from '../lib/useWaveformData'
import { useTheme } from '../store/ThemeContext'

const PLAY_MODE_CYCLE: PlayMode[] = ['sequence', 'single', 'repeat']
const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequence: '顺序播放',
  single: '单曲停止',
  repeat: '单曲循环',
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playMode,
    togglePlay,
    playNext,
    playPrev,
    seek,
    setVolume,
    toggleMute,
    setPlayMode,
  } = usePlayer()

  const cyclePlayMode = () => {
    const idx = PLAY_MODE_CYCLE.indexOf(playMode)
    setPlayMode(PLAY_MODE_CYCLE[(idx + 1) % PLAY_MODE_CYCLE.length])
  }

  const PlayModeIcon = playMode === 'single' ? PlaySingleIcon : playMode === 'repeat' ? RepeatOneIcon : PlaySequenceIcon

  const waveformContainerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const { isDark } = useTheme()

  useEffect(() => {
    const el = waveformContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { peaks } = useWaveformData(currentTrack?.id ?? 0, !!currentTrack)
  const progress = duration > 0 ? currentTime / duration : 0
  const legacyProgress = progress * 100

  return (
    <div className="bg-surface border-t border-rim flex flex-col">
      {/* Waveform / progress area — always rendered so ResizeObserver gets a valid ref */}
      <div
        ref={waveformContainerRef}
        className="relative cursor-pointer group"
        style={{ height: currentTrack && peaks && peaks.length > 0 ? 48 : 4 }}
        onClick={(e) => {
          if (!currentTrack || !duration) return
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          seek(ratio * duration)
        }}
      >
        {currentTrack && peaks && peaks.length > 0 && containerWidth > 0 ? (
          <WaveformBar
            peaks={peaks}
            progress={progress}
            width={containerWidth}
            height={48}
            baseColor={isDark ? '#334155' : '#94a3b8'}
            playedColor="#6366f1"
            gapRatio={0.25}
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-surface-btn" />
            {currentTrack && (
              <>
                <div
                  className="absolute inset-y-0 left-0 bg-primary-500 transition-all"
                  style={{ width: `${legacyProgress}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  style={{ left: `calc(${legacyProgress}% - 6px)` }}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center px-4 h-14">
        {!currentTrack ? (
          <span className="text-xs text-ink-4 mx-auto">选择音频文件开始播放</span>
        ) : (
          <>
            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">
                {currentTrack.title || currentTrack.fileName}
              </div>
              <div className="text-xs text-ink-3 truncate">
                {currentTrack.artist || '未知艺术家'} · {formatDuration(currentTime)} / {formatDuration(duration)}
              </div>
            </div>

            {/* Center controls */}
            <div className="flex items-center gap-2">
              <button onClick={playPrev} className="btn-ghost w-9 h-9 p-0 text-ink-2 hover:text-ink">
                <BackwardIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => togglePlay()}
                className="w-10 h-10 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center transition-colors shadow"
              >
                {isPlaying ? (
                  <PauseIcon className="w-5 h-5 text-white" />
                ) : (
                  <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
              <button onClick={playNext} className="btn-ghost w-9 h-9 p-0 text-ink-2 hover:text-ink">
                <ForwardIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex-1 flex items-center justify-end gap-2">
              <button
                onClick={cyclePlayMode}
                title={PLAY_MODE_LABEL[playMode]}
                className={`btn-ghost w-8 h-8 p-0 transition-colors ${playMode !== 'sequence' ? 'text-primary-500' : 'text-ink-2 hover:text-ink'}`}
              >
                <PlayModeIcon className="w-4 h-4" />
              </button>
              <button onClick={toggleMute} className="btn-ghost w-8 h-8 p-0 text-ink-2 hover:text-ink">
                {isMuted || volume === 0 ? (
                  <SpeakerMuteIcon className="w-4 h-4" />
                ) : (
                  <SpeakerIcon className="w-4 h-4" />
                )}
              </button>
              <div className="w-24">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={e => setVolume(Number(e.target.value))}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
