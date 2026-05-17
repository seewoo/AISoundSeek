import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import type { AudioFile, SearchParams } from '../../shared/types'
import * as api from '../lib/api'

interface PlayerState {
  currentTrack: AudioFile | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  queue: AudioFile[]
  queueIndex: number
}

interface PlayerContextValue extends PlayerState {
  play: (track: AudioFile) => void
  pause: () => void
  resume: () => void
  togglePlay: (track?: AudioFile) => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  playNext: () => void
  playPrev: () => void
  setQueue: (tracks: AudioFile[], startIndex?: number) => void
  audioRef: React.RefObject<HTMLAudioElement>
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    queue: [],
    queueIndex: -1,
  })

  // 用 ref 持有最新的 playNextInternal，避免 onEnded 闭包陈旧问题
  const playNextRef = useRef<() => void>(() => {})

  useEffect(() => {
    const audio = audioRef.current
    audio.volume = state.volume

    const onTimeUpdate = () => setState(s => ({ ...s, currentTime: audio.currentTime }))
    const onDurationChange = () => setState(s => ({ ...s, duration: audio.duration || 0 }))
    const onEnded = () => playNextRef.current()
    const onPlay = () => setState(s => ({ ...s, isPlaying: true }))
    const onPause = () => setState(s => ({ ...s, isPlaying: false }))

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, []) // eslint-disable-line

  const loadAndPlay = useCallback(async (track: AudioFile) => {
    const audio = audioRef.current
    try {
      const filePath = await api.getFilePath(track.id)
      // Use file:// protocol for local files
      const url = `file://${filePath.replace(/\\/g, '/')}`
      audio.src = url
      audio.load()
      await audio.play()
      setState(s => ({ ...s, currentTrack: track, isPlaying: true }))
    } catch (err) {
      console.error('Failed to play:', err)
    }
  }, [])

  const play = useCallback((track: AudioFile) => {
    loadAndPlay(track)
  }, [loadAndPlay])

  const pause = useCallback(() => {
    audioRef.current.pause()
  }, [])

  const resume = useCallback(() => {
    audioRef.current.play()
  }, [])

  const togglePlay = useCallback((track?: AudioFile) => {
    if (track && track.id !== state.currentTrack?.id) {
      play(track)
    } else if (state.isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [state.currentTrack, state.isPlaying, play, pause, resume])

  const seek = useCallback((time: number) => {
    audioRef.current.currentTime = time
    setState(s => ({ ...s, currentTime: time }))
  }, [])

  const setVolume = useCallback((v: number) => {
    audioRef.current.volume = v
    audioRef.current.muted = false
    setState(s => ({ ...s, volume: v, isMuted: false }))
  }, [])

  const toggleMute = useCallback(() => {
    const muted = !state.isMuted
    audioRef.current.muted = muted
    setState(s => ({ ...s, isMuted: muted }))
  }, [state.isMuted])

  const playNextInternal = useCallback(() => {
    setState(s => {
      if (s.queue.length === 0) return s
      const nextIndex = s.queueIndex + 1
      if (nextIndex >= s.queue.length) return { ...s, isPlaying: false }
      const nextTrack = s.queue[nextIndex]
      loadAndPlay(nextTrack)
      return { ...s, queueIndex: nextIndex, currentTrack: nextTrack }
    })
  }, [loadAndPlay])

  // 每次 playNextInternal 更新时同步到 ref，保证 onEnded 始终调用最新版本
  useEffect(() => { playNextRef.current = playNextInternal }, [playNextInternal])

  const playNext = useCallback(() => playNextInternal(), [playNextInternal])

  const playPrev = useCallback(() => {
    setState(s => {
      if (s.queue.length === 0) return s
      const prevIndex = Math.max(0, s.queueIndex - 1)
      const track = s.queue[prevIndex]
      if (track) loadAndPlay(track)
      return { ...s, queueIndex: prevIndex, currentTrack: track }
    })
  }, [loadAndPlay])

  const setQueue = useCallback((tracks: AudioFile[], startIndex = 0) => {
    setState(s => ({ ...s, queue: tracks, queueIndex: startIndex }))
    if (tracks[startIndex]) loadAndPlay(tracks[startIndex])
  }, [loadAndPlay])

  return (
    <PlayerContext.Provider value={{ ...state, play, pause, resume, togglePlay, seek, setVolume, toggleMute, playNext, playPrev, setQueue, audioRef }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}

// ── Search Store ──────────────────────────────────────────────────────────────

interface SearchStore {
  params: SearchParams
  results: AudioFile[]
  total: number
  loading: boolean
  setParams: (p: Partial<SearchParams>) => void
  refresh: () => void
}

const SearchContext = createContext<SearchStore | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<SearchParams>({
    keyword: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 100,
  })
  const [results, setResults] = useState<AudioFile[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (p: SearchParams) => {
    setLoading(true)
    try {
      const res = await api.searchAudio(p)
      setResults(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const setParams = useCallback((p: Partial<SearchParams>) => {
    setParamsState(prev => {
      const next = { ...prev, ...p, page: 1 }
      doSearch(next)
      return next
    })
  }, [doSearch])

  const refresh = useCallback(() => {
    doSearch(params)
  }, [doSearch, params])

  useEffect(() => {
    doSearch(params)
  }, []) // eslint-disable-line

  return (
    <SearchContext.Provider value={{ params, results, total, loading, setParams, refresh }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}
