import type { AudioFile } from '../../../shared/types'
import { WaveformBar } from '../WaveformBar'
import { useWaveformData } from '../../lib/useWaveformData'
import { useTheme } from '../../store/ThemeContext'

interface Props {
  audio: AudioFile
  isCurrentTrack: boolean
  currentTime: number
  width: number
}

/** Compact waveform shown per row — generates lazily via Web Audio API */
export function WaveformCell({ audio, isCurrentTrack, currentTime, width }: Props) {
  const { peaks } = useWaveformData(audio.id, true)
  const { isDark } = useTheme()
  const progress = isCurrentTrack && audio.duration > 0 ? currentTime / audio.duration : 0

  if (!peaks) {
    return <div className="h-6 rounded bg-surface-btn animate-pulse opacity-40" style={{ width }} />
  }

  return (
    <WaveformBar
      peaks={peaks}
      progress={progress}
      width={width}
      height={24}
      baseColor={isDark ? '#334155' : '#94a3b8'}
      playedColor="#6366f1"
      gapRatio={0.3}
    />
  )
}
