# AudioSeek Insert — Premiere Pro CEP 插件

一款 CEP 面板插件，允许 AudioSeek 桌面应用将音频文件一键插入 Premiere Pro 的活动序列末尾。

## 工作原理

```
AudioSeek（Electron）
    │  POST http://localhost:18432/insert-audio
    │  { "filePath": "C:/音频/bgm.mp3" }
    ▼
premiere-plugin（CEP 面板）
    │  Node.js http.Server 监听 127.0.0.1:18432
    │  收到请求后通过 CSInterface.evalScript() 调用 ExtendScript
    ▼
Premiere Pro
    │  app.project.importFiles([filePath], ...)
    │  track.insertClip(item, seq.end)
    ▼
音频出现在活动序列第一条音频轨道末尾
```

---

## 前提条件

| 条件 | 说明 |
|------|------|
| Adobe Premiere Pro 2022 及以上 | 版本号 ≥ 22.0（内部使用 CEP 11） |
| Windows 10/11 | 已在 Windows 上验证 |
| `CSInterface.js` 文件 | 见下方第一步 |

---

## 安装步骤

### 第一步：下载 CSInterface.js

`CSInterface.js` 是 Adobe 官方的 CEP 通信库（MIT 协议），**不随插件附带**，需手动下载：

1. 打开链接：  
   <https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/CEP_11.x/CSInterface.js>
2. 另存为 `CSInterface.js`，放入 `premiere-plugin/` 目录（与 `index.html` 同级）。

完成后目录结构应为：

```
premiere-plugin/
├── CSXS/
│   └── manifest.xml
├── .debug
├── CSInterface.js      ← 手动下载放置
├── index.html
├── main.js
└── README.md
```

---

### 第二步：开启未签名扩展支持

Adobe 默认只加载已签名的 CEP 扩展。开发/测试阶段需通过注册表开启调试模式：

**在 PowerShell 中执行（无需管理员权限）：**

```powershell
# Premiere Pro 2022 使用 CSXS.11
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" `
  -Name "PlayerDebugMode" -Value "1" -Type String
```

**验证是否设置成功：**

```powershell
Get-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode"
# 应输出：PlayerDebugMode : 1
```

> **重要**：值必须是字符串 `1`（`REG_SZ` 类型），不能是数字类型。  
> 重启 Premiere 后生效，无需重启系统。

**macOS：**

```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

---

### 第三步：安装插件到 CEP 扩展目录

CEP 插件需要安装到以下**任意一个**目录（推荐两个都装，确保 Premiere 能找到）：

**路径 A — 用户级（推荐，无需管理员权限）：**

```
%APPDATA%\Adobe\CEP\extensions\com.aisoundseek.premiere-insert\
```

**路径 B — Premiere 本地目录（适用于非默认盘符安装）：**

```
<Premiere安装目录>\CEP\extensions\com.aisoundseek.premiere-insert\
```

**PowerShell 一键安装脚本**（在项目根目录执行，按需修改 `$premiere` 路径）：

```powershell
$src = ".\premiere-plugin"
$premiere = "D:\Program Files\Adobe Premiere Pro 2022"   # 改为你的实际安装路径

# 安装到用户级 AppData
$destA = "$env:APPDATA\Adobe\CEP\extensions\com.aisoundseek.premiere-insert"
New-Item -ItemType Directory -Force -Path "$destA\CSXS" | Out-Null
Copy-Item "$src\CSXS\manifest.xml" "$destA\CSXS\"
Copy-Item "$src\index.html", "$src\main.js", "$src\CSInterface.js", "$src\.debug" $destA
Write-Host "已安装到: $destA"

# 安装到 Premiere 本地目录
$destB = "$premiere\CEP\extensions\com.aisoundseek.premiere-insert"
New-Item -ItemType Directory -Force -Path "$destB\CSXS" | Out-Null
Copy-Item "$src\CSXS\manifest.xml" "$destB\CSXS\"
Copy-Item "$src\index.html", "$src\main.js", "$src\CSInterface.js", "$src\.debug" $destB
Write-Host "已安装到: $destB"
```

> **注意**：插件目录名必须与 Bundle ID 完全一致：`com.aisoundseek.premiere-insert`

---

### 第四步：启动 Premiere 并加载面板

1. **完全退出** Premiere Pro（包括系统托盘），然后重新启动。
2. 菜单栏选择：**窗口 (Window) → 扩展 (Extensions) → AudioSeek Insert**。
3. 面板打开后显示绿色「● 服务已启动」，表示 HTTP 服务器已在 `127.0.0.1:18432` 监听。

---

## 使用方式

1. 在 Premiere 中打开一个**含有音频轨道的序列**（时间线）。
2. 打开 AudioSeek 桌面应用，找到目标音频文件。
3. 在音频详情页点击 **「插入 PR 时间轴」** 按钮。
4. 音频文件将被导入当前项目，并追加到第一条音频轨道的末尾。

面板实时显示操作状态：

| 颜色 | 含义 |
|------|------|
| 🟢 绿色 | 服务运行中 / 插入成功 |
| 🟡 黄色 | 等待中 / 正在插入 |
| 🔴 红色 | 错误（详见面板提示） |

---

## 故障排查

### 「扩展」菜单是灰色或看不到 "AudioSeek Insert"

按顺序检查：

1. **确认 PlayerDebugMode 已正确设置**

   ```powershell
   Get-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode"
   ```
   输出应为 `PlayerDebugMode : 1`。若不存在，重新执行第二步。

2. **确认插件目录结构完整**

   ```
   com.aisoundseek.premiere-insert\
   ├── CSXS\
   │   └── manifest.xml   ← 必须存在
   ├── CSInterface.js
   ├── index.html
   └── main.js
   ```

3. **确认已完全重启 Premiere**（不是挂起后恢复，是彻底关闭再打开）。

4. **尝试两个路径都安装**（见第三步），Premiere 会扫描两处。

> 提示：Premiere Pro 中 Adobe 自带的 Frame.io、Libraries 等面板**不会**出现在「扩展」菜单中，它们走专属菜单入口。「扩展」菜单只显示第三方 CEP 插件；如果没有任何第三方插件被成功加载，该菜单项呈灰色。

---

### 其他常见问题

**Q：点击「插入 PR 时间轴」提示「无法连接到 Premiere」**  
A：确认 Premiere 中 AudioSeek Insert 面板已打开（面板关闭时 HTTP 服务器不运行）。

**Q：面板提示「端口 18432 已被占用」**  
A：运行 `netstat -ano | findstr 18432` 找到占用进程并关闭，或重启电脑。

**Q：提示「请先在 Premiere 中打开一个序列」**  
A：在 Premiere 时间线面板中双击打开一个序列，再重试。

---

## 开发调试

`.debug` 文件已配置 Chrome DevTools 端口（8080）。面板打开后，在浏览器地址栏输入：

```
http://localhost:8080
```

即可打开 CEP 面板的开发者工具，查看控制台输出和网络请求。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `CSXS/manifest.xml` | CEP 扩展声明（Bundle ID、宿主版本、权限） |
| `index.html` | 面板 UI |
| `main.js` | Node.js HTTP 服务器 + ExtendScript 调用逻辑 |
| `CSInterface.js` | Adobe CEP 通信库（需手动下载，见第一步） |
| `.debug` | Chrome DevTools 调试端口配置 |
