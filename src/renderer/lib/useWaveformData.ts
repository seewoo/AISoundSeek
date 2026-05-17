import { useState, useEffect, useRef } from 'react'
import { getWaveform, saveWaveform, getFilePath } from '../lib/api'

/** Number of peaks to sample from the decoded audio buffer */
const PEAK_COUNT = 200

/**
 * Decode an audio file via Web Audio API and return an array of normalised
 * peak values (absolute values, range 0–1) of length PEAK_COUNT.
 */
async function generatePeaks(filePath: string): Promise<number[]> {
  const url = `file://${filePath.replace(/\\/g, '/')}`
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()

  const audioCtx = new OfflineAudioContext(1, 1, 44100)
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)
  const rawData = decoded.getChannelData(0)

  const blockSize = Math.floor(rawData.length / PEAK_COUNT)
  const peaks: number[] = []
  for (let i = 0; i < PEAK_COUNT; i++) {
    let max = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(rawData[start + j] ?? 0)
      if (abs > max) max = abs
    }
    peaks.push(max)
  }

  // Normalise so the loudest peak = 1
  const globalMax = Math.max(...peaks, 1e-6)
  return peaks.map(p => p / globalMax)
}

interface WaveformState {
  peaks: number[] | null
  loading: boolean
}

// Module-level cache: audioId -> peaks (avoids re-generating within a session)
const peaksCache = new Map<number, number[]>()

/**
 * Hook that returns waveform peaks for an audio file.
 * 1. Returns cached value immediately if available.
 * 2. Fetches from DB (via IPC) if not cached.
 * 3. Falls back to generating via Web Audio API and saves to DB.
 */
export function useWaveformData(audioId: number, enabled = true): WaveformState {
  const [state, setState] = useState<WaveformState>(() => ({
    peaks: peaksCache.get(audioId) ?? null,
    loading: false,
  }))
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (peaksCache.has(audioId)) {
      setState({ peaks: peaksCache.get(audioId)!, loading: false })
      return
    }

    if (loadingRef.current) return
    loadingRef.current = true
    setState(s => ({ ...s, loading: true }))

    let cancelled = false

    ;(async () => {
      try {
        // 1. Try DB first
        const dbPeaks = await getWaveform(audioId)
        if (dbPeaks && dbPeaks.length > 0) {
          if (!cancelled) {
            peaksCache.set(audioId, dbPeaks)
            setState({ peaks: dbPeaks, loading: false })
          }
          return
        }

        // 2. Generate from audio file
        const filePath = await getFilePath(audioId)
        const peaks = await generatePeaks(filePath)

        if (!cancelled) {
          peaksCache.set(audioId, peaks)
          setState({ peaks, loading: false })
          // Save asynchronously — don't block rendering
          saveWaveform(audioId, peaks).catch(console.error)
        }
      } catch (err) {
        console.error('[waveform] generation failed for id', audioId, err)
        if (!cancelled) setState({ peaks: null, loading: false })
      } finally {
        loadingRef.current = false
      }
    })()

    return () => { cancelled = true }
  }, [audioId, enabled])

  return state
}
