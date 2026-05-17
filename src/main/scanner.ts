import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import type { IAudioMetadata } from 'music-metadata'
import type { DatabaseService } from './database'
import type { AudioCategory, AudioFile } from '../shared/types'
import { analyzeAudioWithAI } from './aiAnalyzer'

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff', '.ape']

// Tag extraction patterns from file names
const TAG_PATTERNS: Record<string, string[]> = {
  dialogue:     ['dialogue', 'dialog', 'voice', 'vocal', '对白', '人声', '台词', 'narration', 'speech'],
  sfx:          ['sfx', 'effect', '声效', '音效', '效果', 'impact', 'whoosh', 'hit', 'click'],
  bgm:          ['bgm', 'background', '背景音乐', '背景', 'lofi', 'lo-fi', 'cinematic'],
  theme:        ['theme', 'opening', 'closing', 'ending', '主题', '片头', '片尾', 'title_music'],
  interactive:  ['interactive', 'adaptive', 'dynamic', '动态', '互动', 'loop', 'stinger'],
  ambience:     ['ambience', 'ambient', 'atmosphere', 'atmos', '环境音', '氛围', 'nature', 'rain', 'wind'],
  sound_design: ['sound_design', 'designed', '音效设计'],
}

const SUBCATEGORY_PATTERNS: Record<string, string[]> = {
  nature: ['nature', 'rain', 'wind', 'ocean', 'forest', '自然', '雨', '风', '海洋', '森林'],
  urban: ['city', 'traffic', 'crowd', '城市', '交通', '人群', 'urban'],
  action: ['action', 'fight', 'battle', '动作', '战斗', '打斗', 'epic'],
  emotional: ['emotional', 'sad', 'happy', 'joy', 'melancholy', '情感', '悲伤', '欢快'],
  horror: ['horror', 'scary', 'dark', 'creepy', '恐怖', '黑暗', '诡异'],
  comedy: ['funny', 'comedy', 'humorous', '搞笑', '幽默', '喜剧'],
}

export class ScannerService {
  constructor(private db: DatabaseService) {}

  async scanDirectory(
    dirId: number,
    dirPath: string,
    onProgress?: (current: number, total: number, currentFile: string) => void,
    token?: string | null
  ): Promise<number> {
    const files = await glob(`**/*{${AUDIO_EXTENSIONS.join(',')}}`, {
      cwd: dirPath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**'],
    })

    let count = 0
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      onProgress?.(i + 1, files.length, path.basename(filePath))
      try {
        await this.processFile(filePath, token)
        count++
      } catch (err) {
        console.error(`Failed to process ${filePath}:`, err)
      }
    }

    this.db.updateDirectoryScanInfo(dirId, count)
    return count
  }

  private async processFile(filePath: string, token?: string | null): Promise<void> {
    const stat = fs.statSync(filePath)
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase().slice(1)

    let metadata: IAudioMetadata | null = null
    try {
      // Use new Function to bypass TypeScript's CJS transform of dynamic import.
      // Electron's main process uses "default" CJS exports which lack parseFile;
      // ESM import() correctly resolves the "node" ESM entry with parseFile.
      const importFn = new Function('m', 'return import(m)') as (m: string) => Promise<any>
      const mm = await importFn('music-metadata')
      metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false })
      console.log(`[scanner] ${path.basename(filePath)} duration=${metadata?.format?.duration}`)
    } catch (err) {
      console.error('[scanner] metadata parse error:', filePath, err)
    }

    const common = (metadata?.common || {}) as import('music-metadata').ICommonTagsResult
    const format = (metadata?.format || {}) as import('music-metadata').IFormat

    // Extract cover art
    let coverPath: string | null = null
    if (common.picture && common.picture.length > 0) {
      coverPath = await this.saveCover(filePath, common.picture[0])
    } else {
      coverPath = this.findSiblingCover(filePath)
    }

    // Auto extract tags and category from filename
    const autoResult = this.autoExtractFromFileName(fileName)

    const audioData: Partial<AudioFile> & { filePath: string; fileName: string } = {
      filePath,
      fileName,
      title: common.title || path.basename(fileName, path.extname(fileName)),
      artist: common.artist || common.albumartist || '',
      album: common.album || '',
      duration: format.duration || 0,
      fileSize: stat.size,
      format: format.container?.toLowerCase() || ext,
      sampleRate: format.sampleRate || 0,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : 0,
      channels: format.numberOfChannels || 0,
      coverPath,
      category: autoResult.category,
      subcategory: autoResult.subcategory,
      tags: autoResult.tags,
    }

    const audio = this.db.upsertAudioFile(audioData)

    // Ensure extracted tags exist in tags table
    for (const tag of autoResult.tags) {
      this.db.ensureTagExists(tag)
    }

    // AI analysis for newly inserted files (not yet analyzed) when enabled
    if (token && !audio.aiAnalyzed) {
      try {
        const result = await analyzeAudioWithAI(audio, this.db)
        if (result.description || result.tags.length > 0 || result.category) {
          this.db.updateAudioFile(audio.id, {
            description: result.description,
            tags: [...new Set([...audio.tags, ...result.tags])],
            ...(result.category ? { category: result.category } : {}),
            aiAnalyzed: true,
          })
          for (const tag of result.tags) {
            this.db.ensureTagExists(tag)
          }
        }
      } catch (err) {
        console.error(`[scanner] AI analysis failed for ${path.basename(filePath)}:`, err)
      }
    }
  }

  private autoExtractFromFileName(fileName: string): {
    category: AudioCategory
    subcategory: string
    tags: string[]
  } {
    const lower = fileName.toLowerCase()
    const tags: string[] = []
    let category: AudioCategory = 'sfx'
    let subcategory = ''

    // Detect category
    for (const [cat, patterns] of Object.entries(TAG_PATTERNS)) {
      for (const p of patterns) {
        if (lower.includes(p)) {
          category = cat as AudioCategory
          tags.push(cat)
          break
        }
      }
    }

    // Detect subcategory
    for (const [sub, patterns] of Object.entries(SUBCATEGORY_PATTERNS)) {
      for (const p of patterns) {
        if (lower.includes(p)) {
          subcategory = sub
          if (!tags.includes(sub)) tags.push(sub)
          break
        }
      }
    }

    // Extract BPM from filename like "120bpm"
    const bpmMatch = lower.match(/(\d{2,3})\s*bpm/)
    if (bpmMatch) tags.push(`${bpmMatch[1]}bpm`)

    // Extract key from filename like "C major", "Am", "G#m"
    const keyMatch = fileName.match(/\b([A-G][#b]?m?)\b/)
    if (keyMatch && keyMatch[1].length <= 3) tags.push(`key:${keyMatch[1]}`)

    // Extract "free", "copyright free", "royalty free"
    if (lower.includes('royalty free') || lower.includes('copyright free') || lower.includes('no copyright')) {
      tags.push('royalty-free')
    }

    return { category, subcategory, tags: [...new Set(tags)] }
  }

  private async saveCover(audioPath: string, picture: { data: Uint8Array; format: string }): Promise<string> {
    const fs = await import('fs')
    const os = await import('os')
    
    const coverDir = path.join(os.tmpdir(), 'arm-covers')
    if (!fs.existsSync(coverDir)) {
      fs.mkdirSync(coverDir, { recursive: true })
    }
    
    const ext = picture.format.includes('png') ? 'png' : 'jpg'
    const hash = Buffer.from(audioPath).toString('base64').replace(/[/+=]/g, '_').slice(0, 32)
    const coverPath = path.join(coverDir, `${hash}.${ext}`)
    
    if (!fs.existsSync(coverPath)) {
      fs.writeFileSync(coverPath, Buffer.from(picture.data))
    }
    
    return coverPath
  }

  private findSiblingCover(audioPath: string): string | null {
    const dir = path.dirname(audioPath)
    const coverNames = ['cover.jpg', 'cover.png', 'folder.jpg', 'folder.png', 'artwork.jpg', 'artwork.png', 'thumb.jpg']
    
    for (const name of coverNames) {
      const p = path.join(dir, name)
      if (fs.existsSync(p)) return p
    }
    return null
  }
}
