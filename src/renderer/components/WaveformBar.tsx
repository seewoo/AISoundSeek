import { useRef, useEffect, useCallback } from 'react'

interface WaveformBarProps {
  /** Normalized peak values in range [-1, 1] */
  peaks: number[]
  /** Playback progress 0–1, for rendering the played portion */
  progress?: number
  /** Width of the canvas in px */
  width?: number
  /** Height of the canvas in px */
  height?: number
  /** Color for the unplayed portion */
  baseColor?: string
  /** Color for the played portion */
  playedColor?: string
  /** Gap ratio between bars (0–1) */
  gapRatio?: number
  /** Optional click handler to seek, receives ratio 0–1 */
  onSeek?: (ratio: number) => void
}

export function WaveformBar({
  peaks,
  progress = 0,
  width = 160,
  height = 32,
  baseColor = '#475569',
  playedColor = '#6366f1',
  gapRatio = 0.25,
  onSeek,
}: WaveformBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const numBars = peaks.length
    const barWidth = width / numBars
    const gap = barWidth * gapRatio
    const bar = barWidth - gap
    const mid = height / 2
    const progressX = progress * width

    for (let i = 0; i < numBars; i++) {
      const x = i * barWidth + gap / 2
      const amplitude = Math.abs(peaks[i])
      // Minimum bar height of 2px so empty waveform still shows
      const barH = Math.max(2, amplitude * (height * 0.9))
      const y = mid - barH / 2

      ctx.fillStyle = x + bar <= progressX ? playedColor : baseColor
      ctx.beginPath()
      ctx.roundRect(x, y, bar, barH, bar / 2)
      ctx.fill()
    }
  }, [peaks, progress, width, height, baseColor, playedColor, gapRatio])

  useEffect(() => {
    draw()
  }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, ratio)))
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', cursor: onSeek ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  )
}
