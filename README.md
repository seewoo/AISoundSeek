# Audio Resource Manager 🎵

> 一款专为视频博主设计的本地音频资源管理工具，支持标签管理、版权标注、元数据编辑、AI 智能分析和实时试听。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-29-47848f)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

## ✨ 功能特性

- **目录管理** — 配置多个本地音频目录，自动扫描 MP3 / WAV / FLAC / AAC / OGG 等主流格式
- **元数据解析** — 自动读取 ID3 标签（标题、艺术家、专辑、时长、比特率、采样率）
- **封面提取** — 自动提取嵌入封面或识别同目录封面图（cover.jpg / folder.jpg）
- **多维度检索** — 支持关键词、标签、类别、版权、时长范围、评分组合筛选
- **版权管理** — 标注免版权 / 有授权 / 未知，支持填写版权备注
- **实时试听** — 内置播放器，支持进度条拖拽、音量调节、上下曲切换、波形显示
- **AI 智能分析** — 通过后端代理调用 AI，自动生成描述、提取标签和类别建议
- **AI 对话搜索** — 用自然语言描述需要的音乐，AI 多阶段检索并给出理由排名
- **用户认证** — JWT 登录注册，Token 余额管理，AI 功能消费追踪
- **自动更新** — 内置 electron-updater，应用启动时自动检测并提示更新
- **深色界面** — 深色 / 浅色主题切换，响应式布局，流畅动画

---

## 🗂️ 项目结构

```
src/
├── main/                        # Electron 主进程
│   ├── main.ts                  # 应用入口，窗口创建与生命周期
│   ├── preload.ts               # 预加载脚本（contextBridge IPC 桥）
│   ├── ipcHandlers.ts           # IPC 注册入口（barrel file）
│   ├── database.ts              # DatabaseService — 对外统一接口
│   ├── scanner.ts               # 音频文件扫描与 music-metadata 解析
│   ├── aiAnalyzer.ts            # AI 分析：描述生成 + 标签提取
│   ├── backgroundAnalyzer.ts    # 后台定时批量分析任务
│   ├── autoUpdater.ts           # 自动更新逻辑（electron-updater）
│   ├── config.ts                # 配置管理（config.json）
│   ├── handlers/                # IPC 处理器（按领域拆分）
│   │   ├── directoryHandlers.ts # dir:* / scan:*
│   │   ├── audioHandlers.ts     # audio:* / waveform:*
│   │   ├── tagHandlers.ts       # tag:*
│   │   ├── categoryHandlers.ts  # category:*
│   │   ├── settingsHandlers.ts  # settings:* / ai:getConfig / ai:saveConfig
│   │   ├── aiHandlers.ts        # ai:analyze / ai:chatSearch / ai:batchAnalyze
│   │   ├── authHandlers.ts      # auth:login / auth:register / auth:logout / …
│   │   └── configHandlers.ts    # config:getBackendUrl / premiere:insertAudio
│   ├── db/                      # 数据库分层（Repository 模式）
│   │   ├── DbContext.ts         # sql.js 封装：query / run / transaction / save
│   │   ├── schema.ts            # migrate()：建表 + 增量列迁移
│   │   ├── DirectoryRepository.ts
│   │   ├── AudioRepository.ts
│   │   ├── TagRepository.ts
│   │   ├── SettingsRepository.ts
│   │   ├── AuthRepository.ts
│   │   └── CategoryRepository.ts
│   └── lib/
│       ├── backendClient.ts     # 后端 HTTP 客户端（登录 / 注册 / AI 代理）
│       └── errors.ts            # 类型化错误：AuthenticationError / InsufficientTokenError / …
├── renderer/                    # React 渲染进程
│   ├── App.tsx                  # 根组件
│   ├── main.tsx                 # 渲染入口
│   ├── components/              # UI 组件
│   │   ├── audio/               # 列表行级子组件
│   │   │   ├── CategoryBadge.tsx    # 内联类别下拉
│   │   │   ├── CopyrightBadge.tsx   # 内联版权下拉
│   │   │   └── WaveformCell.tsx     # 行内波形渲染
│   │   ├── AudioList.tsx        # 音频文件列表
│   │   ├── AudioDetail.tsx      # 文件详情 / 编辑面板
│   │   ├── AiChatPanel.tsx      # AI 对话搜索面板
│   │   ├── AiAnalysisModal.tsx  # 单文件 AI 分析弹窗
│   │   ├── PlayerBar.tsx        # 底部播放器
│   │   ├── WaveformBar.tsx      # 波形组件（Canvas 渲染）
│   │   ├── TopBar.tsx           # 顶部栏（搜索 + Token 余额）
│   │   ├── Sidebar.tsx          # 侧边导航
│   │   ├── FilterPanel.tsx      # 高级筛选面板
│   │   ├── TagsView.tsx         # 标签管理页
│   │   ├── LoginModal.tsx       # 登录 / 注册弹窗
│   │   ├── SettingsModal.tsx    # 设置弹窗
│   │   ├── DirectoriesModal.tsx # 目录管理弹窗
│   │   └── …                   # 其他页面级组件
│   ├── store/                   # React Context 全局状态
│   │   ├── index.tsx            # 播放器 + 搜索状态（usePlayer / useSearch）
│   │   ├── AuthContext.tsx      # 认证状态（用户信息 + Token 余额）
│   │   ├── BatchAnalyzeContext.tsx # 批量分析状态
│   │   ├── ThemeContext.tsx     # 深色 / 浅色主题
│   │   └── ToastContext.tsx     # 全局 Toast 通知
│   ├── hooks/                   # 自定义 React Hooks
│   │   ├── useAuth.ts
│   │   ├── useAiErrorHandler.ts
│   │   ├── useBalanceWarning.ts
│   │   └── useToast.ts
│   └── lib/                     # 工具函数与渲染层服务
│       ├── api.ts               # 统一 IPC 调用封装（apiCall wrapper）
│       ├── errors.ts            # 渲染层类型化错误
│       ├── utils.ts             # formatDuration / CATEGORY_COLORS / 等工具
│       ├── storageKeys.ts       # localStorage key 常量
│       ├── logger.ts            # 开发模式请求日志
│       └── useWaveformData.ts   # 波形数据懒加载 Hook
└── shared/
    └── types.ts                 # 主进程 / 渲染进程共用 TypeScript 类型
```

---

## 🚀 开发环境搭建

### 前置要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | ≥ 18.0 |
| npm | ≥ 9.0 |

### 安装依赖

```bash
cd aisoundseek/client
npm install
```

### 开发模式运行（推荐三终端）

```bash
# 终端 1：启动 Vite 开发服务器（渲染进程，端口 5173）
npm run dev:renderer

# 终端 2：监听编译主进程 TypeScript
npm run dev:main

# 终端 3：启动 Electron
npx electron .
```

或使用并发命令（仅启动前两个，之后手动执行第三步）：

```bash
npm run dev
# 等待 dist/main/ 生成后，在另一个终端执行：
npx electron .
```

---

## 📦 构建 & 打包

### 仅构建（不打包）

```bash
npm run build
```

构建产物：
- 渲染进程 → `dist/renderer/`
- 主进程 → `dist/main/main/`

### 打包为可分发安装包

```bash
npm run package:win    # Windows：NSIS 安装包 + 便携版
npm run package:mac    # macOS：DMG + ZIP（需在 macOS 上执行）
npm run package:linux  # Linux：AppImage + DEB
npm run package:all    # 全平台
```

打包产物输出至 `release/` 目录。

---

## 🗄️ 数据存储

### 数据库

应用使用 **sql.js**（SQLite 编译为 WebAssembly）作为本地数据库。数据库常驻内存，每次写入后显式序列化到磁盘。

> **注意**：使用的是 sql.js，不是 better-sqlite3。

| 平台 | 数据库路径 |
|------|-----------|
| Windows | `%APPDATA%\aisoundseek\audio-manager.db` |
| macOS | `~/Library/Application Support/aisoundseek/audio-manager.db` |
| Linux | `~/.config/aisoundseek/audio-manager.db` |

封面图缓存存储在系统临时目录的 `arm-covers/` 子目录（通过安全的 `local-file://` 协议访问，仅限 tmpdir 内路径）。

### 数据库 Schema

| 表 | 说明 |
|----|------|
| `music_directories` | 已配置的扫描目录 |
| `audio_files` | 音频文件元数据、标签（JSON）、波形数据（JSON）、版权信息 |
| `tags` | 标签定义（名称、颜色、使用次数） |
| `custom_categories` | 用户自定义类别 |
| `settings` | 键值对设置（含 AI 配置、认证 Token） |

### 配置文件

| 平台 | 配置文件路径 |
|------|------------|
| Windows | `%APPDATA%\aisoundseek\config.json` |
| macOS | `~/Library/Application Support/aisoundseek/config.json` |
| Linux | `~/.config/aisoundseek/config.json` |

默认配置：

```json
{
  "version": "1.0",
  "backend": {
    "baseUrl": "http://localhost:8080/api",
    "timeout": 30000
  }
}
```

如需连接其他后端服务，直接修改 `backend.baseUrl` 即可。也可通过构建时环境变量指定：

```bash
AUDIO_SEEK_API_URL=https://api.example.com/api npm run build
```

---

## 🤖 AI 功能

AI 功能通过后端代理服务器提供，需要用户账号登录并持有 Token 余额。

### 单文件分析（`ai:analyze`）

提取文件名、时长、元数据，发送给 AI 后返回：

- 自然语言描述
- 推荐标签列表
- 建议类别

用户可选择性地将建议应用到文件。

### AI 对话搜索（`ai:chatSearch`）

多阶段检索流程：

1. AI 从用户消息中抽取关键词
2. 对每个关键词执行 SQL 检索，合并结果（最多 100 条候选）
3. AI 对候选列表重新排序，返回最相关结果及原因说明

### 后台批量分析（`ai:batchAnalyze`）

可配置的后台定时任务，自动分析未处理的音频文件：

- 启动延迟：30 秒
- 每批最多：3 个文件
- 可设定每日 Token 上限

### Token 管理

- 登录后 Token 余额显示在顶部栏
- 余额不足时（服务端返回 510）提示充值
- JWT Token 以 Base64 编码存储在数据库 settings 表

---

## 🔐 认证与安全

- **contextBridge + nodeIntegration=false**：渲染进程无法直接访问 Node.js API
- **local-file:// 协议白名单**：仅允许访问 `os.tmpdir()` 内的路径，防止任意文件读取
- **JWT 认证**：所有 AI 请求通过 `Authorization: Bearer <token>` 头携带 Token
- **类型化错误**：`AuthenticationError`（401）、`InsufficientTokenError`（510）在渲染层统一捕获处理

---

## 🎮 使用指南

### 第一步：登录账号

点击右上角用户图标打开登录弹窗，注册账号后登录即可使用 AI 功能。

### 第二步：添加音频目录

1. 点击侧边栏 **目录管理**
2. 点击 **添加目录**，选择包含音频文件的文件夹
3. 点击 **扫描**，程序自动解析所有音频文件

### 第三步：检索音频

- 在顶部搜索框输入关键词（文件名、标题、艺术家、描述、标签均可搜索）
- 点击 **筛选** 展开高级筛选：类别、版权、时长范围、评分、标签
- 点击 **AI 搜索** 用自然语言描述所需音乐

### 第四步：试听 & 管理

- 点击列表播放按钮试听，底部播放器支持进度拖拽和音量调节
- 点击任意行打开右侧详情面板
- 在详情面板编辑标题、艺术家、类别、版权、描述、标签、评分
- 点击类别或版权徽章可直接内联修改

### 标签管理

- 点击侧边栏 **标签管理** 查看所有标签及使用次数
- 支持创建自定义标签并设置颜色

---

## 🎵 支持的音频格式

| 格式 | 扩展名 |
|------|--------|
| MP3 | `.mp3` |
| WAV | `.wav` |
| FLAC | `.flac` |
| AAC | `.aac`, `.m4a` |
| OGG Vorbis | `.ogg` |
| Opus | `.opus` |
| WMA | `.wma` |
| AIFF | `.aiff` |
| APE | `.ape` |

---

## 🛠️ 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | Electron 29 |
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| UI 样式 | Tailwind CSS 3 |
| 本地数据库 | sql.js（SQLite WASM，非 better-sqlite3） |
| 元数据解析 | music-metadata |
| 自动更新 | electron-updater |
| 打包工具 | electron-builder |

### TypeScript 双配置

| 配置文件 | 作用域 | 模块系统 |
|---------|--------|---------|
| `tsconfig.json` | 渲染进程 | ES Modules + JSX |
| `tsconfig.main.json` | 主进程 | CommonJS |

两端均可导入 `src/shared/types.ts` 共享接口定义。

---

## 📝 开发说明

- **IPC 通信**：所有 IPC handler 返回 `IpcResponse<T>` = `{ success, data?, error?, code? }`，错误码 401 触发自动登出，510 提示 Token 不足
- **数据库写入**：sql.js 内存数据库，每次写操作后显式调用 `save()` 序列化到磁盘；批量操作使用 `transaction(fn)` 包裹以只写一次磁盘
- **扫描保留用户编辑**：重扫仅更新元数据字段，用户设置的标签、版权、描述、评分不被覆盖
- **波形生成**：Web Audio API 在渲染进程按需生成波形峰值，结果持久化到数据库
- **文件路径协议**：音频播放使用 `file://`，封面图使用受白名单保护的 `local-file://`

---

## 📄 License

MIT
