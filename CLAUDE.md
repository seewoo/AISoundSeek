# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Audio Resource Manager is an Electron-based desktop application for managing audio files (MP3, WAV, FLAC, etc.) aimed at video creators. It provides metadata extraction, tagging, copyright tracking, AI-powered analysis, and an integrated audio player.

**Tech Stack**: Electron 29 + React 18 + TypeScript 5 + Vite 5 + Tailwind CSS + sql.js + music-metadata

**Current Branch**: `feature/user-auth-backend-proxy` — Implements JWT authentication and backend proxy for AI features.

## Build Commands

```bash
# Development (run in separate terminals)
npm run dev:renderer    # Start Vite dev server on port 5173
npm run dev:main        # Watch-compile main process TypeScript
npx electron .          # Launch Electron

# Or use concurrent mode (requires manual Electron launch after build)
npm run dev             # Start renderer and watch-compile main
# Then in another terminal: npx electron .

# Production Build
npm run build           # Build both renderer and main
npm run start           # Build and run Electron

# Package for Distribution
npm run package:win     # Windows (NSIS + portable)
npm run package:mac     # macOS (DMG + ZIP)
npm run package:linux   # Linux (AppImage + DEB)
npm run package:all     # All platforms
```

**Output Directories**:
- Renderer: `dist/renderer/`
- Main process: `dist/main/main/`
- Packaged apps: `release/`

## Architecture

### Process Structure

**Main Process** (`src/main/`):
- `main.ts` — App entry, window creation, lifecycle
- `preload.ts` — IPC bridge exposed via `contextBridge` (secure)
- `ipcHandlers.ts` — All IPC handlers (40+ endpoints covering directory management, audio CRUD, tags, AI, auth)
- `database.ts` — sql.js wrapper with transaction support
- `scanner.ts` — Audio file scanning and metadata extraction using `music-metadata`
- `aiAnalyzer.ts` — AI-powered audio analysis (description generation, tag extraction)
- `lib/backendClient.ts` — Backend API client (login, register, AI chat)
- `lib/errors.ts` — Custom error classes (AuthenticationError, InsufficientTokenError, etc.)
- `config.ts` — Configuration manager (loads `config.json` from userData directory)

**Renderer Process** (`src/renderer/`):
- `App.tsx` — Root component
- `components/` — UI components (Sidebar, AudioList, AudioDetail, PlayerBar, LoginModal, etc.)
- `store/` — React Context for global state (AuthContext, ToastContext)
- `hooks/` — Custom React hooks

**Shared** (`src/shared/types.ts`):
- TypeScript interfaces shared between main and renderer processes

### Database Architecture (sql.js)

**CRITICAL**: This app uses **sql.js** (SQLite compiled to WebAssembly), NOT `better-sqlite3`. Key differences:

1. **In-Memory + Manual Persistence**: Database lives in memory; changes are saved to disk by explicitly calling `save()` after each operation
2. **Transaction Pattern**: Use `transaction(fn)` to batch multiple writes and save once at the end
3. **WASM Binary**: `sql-wasm.wasm` must be unpacked in production builds (see `build.asarUnpack` in package.json)

**Schema** (`database.ts:migrate`):
- `music_directories` — Scanned directory paths
- `audio_files` — Audio metadata, tags (JSON string), waveform data (JSON string), copyright info
- `tags` — Tag definitions with colors and usage counts
- `custom_categories` — User-defined categories beyond built-in AudioCategory types
- `settings` — Key-value store for app settings, AI config, auth tokens

**Important Methods**:
- `upsertAudioFile()` — Updates metadata on rescan but preserves user edits (category, tags, description, rating)
- `searchAudioFiles()` — Multi-criteria search with pagination (keyword searches across title, file_name, artist, album, description, tags)
- `transaction(fn)` — Wraps multiple operations in `BEGIN...COMMIT` and saves once
- Auth methods: `saveAuth()`, `getAuth()`, `clearAuth()` — JWT tokens are Base64-encoded in storage

### IPC Communication

All main-renderer communication uses secure IPC via `contextBridge`. The API surface is exposed in `preload.ts`.

**Pattern**: All handlers return `IpcResponse<T>` with `{ success: boolean, data?: T, error?: string, code?: number }`

**Key IPC Channels**:
- `dir:*` — Directory management (add, remove, list, select)
- `scan:*` — Audio scanning with progress events (`scan:progress` sent to renderer)
- `audio:*` — Audio CRUD, search, batch update, play count tracking
- `tag:*` — Tag CRUD and usage recalculation
- `ai:*` — AI analysis, chat search (requires authentication)
- `auth:*` — Login, register, logout, token refresh
- `waveform:*` — Waveform data persistence

**Error Handling**: 
- `code: 401` — Authentication failure (triggers logout in renderer)
- `code: 510` — Insufficient token balance (prompts user to recharge)

### Authentication & Backend Proxy

**New in this branch**: AI features now route through a backend proxy server instead of direct OpenAI API calls.

**Backend API** (see `API.md`):
- Base URL: `http://localhost:8080/api` (configurable in `config.json`)
- JWT authentication via `Authorization: Bearer <token>` header
- Endpoints: `/user/login`, `/user/register`, `/user/info`, `/ai/chat`
- Error codes: 401 (auth failure), 510 (insufficient tokens), 530-533 (AI errors)

**Client Implementation** (`lib/backendClient.ts`):
- `BackendClient` singleton with methods for login, register, getUserInfo, chat
- Timeout handling (30s default)
- Throws typed errors: `AuthenticationError`, `InsufficientTokenError`, `BackendError`, `NetworkError`

**Auth Flow**:
1. User logs in via `LoginModal` → `auth:login` IPC → `backendClient.login()`
2. Backend returns `{ token, userId, username, tokenBalance }`
3. Token saved to database (Base64-encoded), stored in `AuthContext` in renderer
4. Token included in all subsequent AI requests
5. On 401 error, `db.clearAuth()` called and user redirected to login

### AI Integration

**Audio Analysis** (`ai:analyze`):
- Extracts file info (name, duration, metadata) and sends to AI via backend
- AI returns `{ description, tags[], category? }`
- User can apply suggestions to audio file metadata

**AI Chat Search** (`ai:chatSearch`):
- Multi-stage retrieval: 
  1. AI extracts keywords from user message
  2. SQL search for each keyword, merge results (max 100 candidates)
  3. AI re-ranks candidates and returns top matches with reasoning
- Returns `{ reply: string, picks: { id, reason }[], items: AudioFile[] }`

**Token Consumption**:
- AI operations consume tokens from user balance
- Balance displayed in UI (TopBar)
- On insufficient tokens (510 error), user prompted to recharge

### TypeScript Configuration

**Dual tsconfig setup**:
- `tsconfig.json` — Renderer process (ES modules, JSX support)
- `tsconfig.main.json` — Main process (CommonJS, includes `src/main` and `src/shared`)

Both processes can import from `src/shared/types.ts` for shared interfaces.

### Vite Configuration

- **Base**: `./` (relative paths for Electron)
- **Alias**: `@` → `src/renderer`
- **Dev Server**: Port 5173
- **Build Output**: `dist/renderer/`

Main process compiled separately by `tsc` using `tsconfig.main.json`.

## Development Workflow

1. **First Run**: `npm install` (may need Visual Studio Build Tools on Windows for native modules)
2. **Development**:
   - Terminal 1: `npm run dev:renderer` (Vite dev server)
   - Terminal 2: `npm run dev:main` (TypeScript watch mode)
   - Terminal 3: `npx electron .` (launch Electron)
3. **Database**: Located at `%APPDATA%/aisoundseek/audio-manager.db` (Windows) or equivalent on macOS/Linux
4. **Cover Cache**: Extracted album art stored in temp directory under `arm-covers/`

## Important Patterns & Conventions

### Data Persistence
- **Audio metadata updates**: Use `upsertAudioFile()` which preserves user edits (tags, description, rating, category) on rescan
- **Tag usage recalculation**: Call `recalcTagUsage()` after bulk tag operations
- **Waveform data**: Stored as JSON string in `audio_files.waveform_data`, generated on-demand in UI

### Security
- **Never disable nodeIntegration**: Always use `contextBridge` in preload script
- **File paths**: Use `file://` protocol for audio playback and cover images
- **Token storage**: JWT tokens are Base64-encoded (not plain text) in database

### Error Handling
- **IPC responses**: Always return `{ success, data?, error?, code? }`
- **Authentication errors**: Clear local auth data on 401 and redirect to login
- **Network errors**: Show user-friendly toast messages via `ToastContext`

### Scanning Behavior
- Scans recursively in configured directories
- Extracts metadata (title, artist, album, duration, bitrate, sample rate, channels)
- Extracts cover art from embedded metadata or looks for `cover.jpg`/`folder.jpg` in directory
- **Preserves user edits**: On rescan, only metadata fields are updated (not category, tags, description, rating)
- Progress reported via `scan:progress` event

### AI Feature Flags
- `ai.enableOnScan` setting — Auto-analyze audio files during scan (disabled by default due to token cost)
- AI features gated behind authentication check

## Configuration Files

- **package.json** — App metadata, dependencies, build config (electron-builder)
- **config.json** (runtime, in userData) — Backend URL, timeout settings
- **tailwind.config.js** — Tailwind theme customization
- **electron-builder** config in package.json:
  - `asarUnpack`: Unpacks `sql-wasm.wasm` (required for sql.js)
  - Platform-specific icons in `assets/`

## Git Workflow

- **Main branch**: `main`
- **Current feature branch**: `feature/user-auth-backend-proxy`
- Recent work includes authentication system, backend proxy client, login/register UI, token balance tracking

## Known Issues & Notes

1. **Database**: The README mentions `better-sqlite3` but the code actually uses `sql.js` — this is correct behavior, do not "fix" this
2. **AI Config Migration**: Old client-side AI config (apiKey, baseUrl, model) has been removed and migrated to backend proxy (see `database.ts` migration)
3. **Development Mode**: The `npm run dev` concurrent script only starts renderer and watch-compiles main process — you need to manually run `npx electron .` in another terminal to launch the app. Prefer running three separate terminals for better control
