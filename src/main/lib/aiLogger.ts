import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const MAX_LOG_SIZE = 10 * 1024 * 1024 // 10MB

let logFilePath: string | null = null

function getLogPath(): string {
  if (!logFilePath) {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    logFilePath = path.join(logsDir, 'ai-calls.ndjson')
  }
  return logFilePath
}

function rotateIfNeeded(filePath: string): void {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_LOG_SIZE) {
      fs.renameSync(filePath, filePath + '.old')
    }
  } catch {
    // file doesn't exist yet, no rotation needed
  }
}

export interface AiCallLog {
  ts: string
  provider: string
  model: string
  url: string
  messages: { role: string; content: string }[]
  durationMs: number
  success: boolean
  response?: string
  error?: string
}

export function logAiCall(entry: AiCallLog): void {
  const filePath = getLogPath()
  rotateIfNeeded(filePath)

  const line = JSON.stringify(entry) + '\n'
  try {
    fs.appendFileSync(filePath, line, 'utf8')
  } catch {
    // never let logging break the app
  }

  const status = entry.success ? 'OK' : 'ERR'
  const detail = entry.success
    ? `resp: ${(entry.response ?? '').slice(0, 80)}`
    : entry.error
  console.log(`[AI ${status}] ${entry.provider}/${entry.model} ${entry.durationMs}ms | ${detail}`)
}

/** Returns the path to the current log file, for display in UI */
export function getAiLogPath(): string {
  return getLogPath()
}
