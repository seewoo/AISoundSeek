// AudioSeek Insert — CEP Extension for Adobe Premiere Pro
// Listens on 127.0.0.1:18432, receives audio file paths and inserts them
// into the currently active sequence.
//
// Runtime context: CEP panel with --enable-nodejs + --mixed-context
//   • Node.js globals (require, process, …) are available
//   • Browser globals (window, document, CSInterface, …) are available

/* global CSInterface */

const http = require('http')

// CSInterface is loaded as a <script> tag in index.html before this file.
const csInterface = new CSInterface()

let server = null

// ── UI helpers ───────────────────────────────────────────────────────────────

function updateStatus(text, cls) {
  const el = document.getElementById('status')
  if (el) {
    el.textContent = '● ' + text
    el.className = 'status ' + cls
  }
}

function updateMessage(text, cls) {
  const el = document.getElementById('message')
  if (el) {
    el.textContent = text
    el.className = 'status ' + (cls || 'waiting')
  }
}

// ── Track selector ──────────────────────────────────────────────────────────

/**
 * Query Premiere for the active sequence's audio tracks and populate the
 * #trackSelect dropdown.  Called once on startup and on demand via the ↺ button.
 */
function refreshTracks() {
  const script = `(function () {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify([]);
    var result = [];
    for (var i = 0; i < seq.audioTracks.numTracks; i++) {
      try {
        result.push({ index: i, name: seq.audioTracks[i].name || ('A' + (i + 1)) });
      } catch (e) {}
    }
    return JSON.stringify(result);
  })()`

  csInterface.evalScript(script, (res) => {
    try {
      const tracks = JSON.parse(res)
      const sel = document.getElementById('trackSelect')
      if (!sel || !Array.isArray(tracks)) return
      const prev = sel.value
      while (sel.options.length > 0) sel.remove(0)
      if (tracks.length === 0) {
        const opt = document.createElement('option')
        opt.value = ''
        opt.disabled = true
        opt.textContent = '— 无音轨（请先打开序列）—'
        sel.appendChild(opt)
        return
      }
      tracks.forEach((t) => {
        const opt = document.createElement('option')
        opt.value = String(t.index)
        opt.textContent = t.name
        sel.appendChild(opt)
      })
      // Restore previous selection if still valid, otherwise default to first track
      if ([...sel.options].some((o) => o.value === prev && o.value !== '')) {
        sel.value = prev
      } else {
        sel.selectedIndex = 0
      }
    } catch (_) {}
  })
}

// ── ExtendScript helpers ─────────────────────────────────────────────────────

/**
 * Escape a file-path string so it is safe to embed inside an ExtendScript
 * double-quoted string literal.  Backslashes are converted to forward slashes
 * because ExtendScript's File object accepts either separator on Windows.
 */
function escapeForExtendScript(str) {
  return str
    .replace(/\\/g, '/')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Import the audio file into the active Premiere Pro project, then append
 * it to the end of the first audio track in the active sequence.
 *
 * @param {string} filePath  Absolute OS path to the audio file.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function insertAudioToTimeline(filePath) {
  const escaped = escapeForExtendScript(filePath)
  // Read selected track index from panel UI (always a non-negative integer)
  const trackIndex = Math.max(0, parseInt(
    document.getElementById('trackSelect')?.value ?? '0', 10
  ))

  // ExtendScript (ES3 level) executed inside Premiere Pro.
  // Unicode escape sequences are used for Chinese error messages so that the
  // script string remains ASCII-safe when transferred through evalScript.
  const script = `
    (function () {
      try {
        var filePath = "${escaped}";
        var requestedTrackIndex = ${trackIndex};

        // ── 1. Import the file ──────────────────────────────────────────────
        // importFiles(fileList, suppressUI, targetBin, importAsNumberedStills)
        // Returns true on success; the item appears in rootItem.children.
        var ok = app.project.importFiles([filePath], true, app.project.rootItem, false);
        if (!ok) {
          return JSON.stringify({ success: false, error: "\\u5bfc\\u5165\\u5931\\u8d25\\uff0c\\u8bf7\\u68c0\\u67e5\\u6587\\u4ef6\\u683c\\u5f0f\\u662f\\u5426\\u652f\\u6301" });
        }

        // ── 2. Find the imported project item ───────────────────────────────
        // getMediaPath() on Windows returns backslash paths (C:\foo\bar.mp3),
        // while filePath was normalised to forward slashes (C:/foo/bar.mp3).
        // split("\\") inside ExtendScript splits on a single backslash.
        // (In this JS template literal "\\\\"->"\\", which ExtendScript
        //  interprets as the one-character string "\")
        var item = null;
        var children = app.project.rootItem.children;
        for (var i = children.numItems - 1; i >= 0; i--) {
          try {
            var mp = children[i].getMediaPath();
            if (mp && mp.split("\\\\").join("/") === filePath) {
              item = children[i];
              break;
            }
          } catch (ex) {}
        }

        // Fallback: match by file name in case the path comparison still misses
        if (!item) {
          var targetName = filePath.split("/").pop();
          for (var j = children.numItems - 1; j >= 0; j--) {
            try {
              var mp2 = children[j].getMediaPath();
              if (mp2 && children[j].name === targetName) {
                item = children[j];
                break;
              }
            } catch (ex2) {}
          }
        }

        if (!item) {
          return JSON.stringify({ success: false, error: "\\u5bfc\\u5165\\u540e\\u672a\\u5728\\u9879\\u76ee\\u4e2d\\u627e\\u5230\\u8be5\\u6587\\u4ef6" });
        }

        // ── 3. Validate active sequence ─────────────────────────────────────
        var seq = app.project.activeSequence;
        if (!seq) {
          return JSON.stringify({ success: false, error: "\\u8bf7\\u5148\\u5728 Premiere \\u4e2d\\u6253\\u5f00\\u4e00\\u4e2a\\u5e8f\\u5217" });
        }

        // ── 4. Find target audio track ───────────────────────────────────────
        var audioTracks = seq.audioTracks;
        var track = audioTracks[requestedTrackIndex] ||
                    (audioTracks.numTracks > 0 ? audioTracks[0] : null);

        if (!track) {
          return JSON.stringify({ success: false, error: "\\u5e8f\\u5217\\u4e2d\\u6ca1\\u6709\\u97f3\\u9891\\u8f68\\u9053" });
        }

        track.insertClip(item, seq.end);
        var trackName = "";
        try { trackName = track.name; } catch (ex) {}
        return JSON.stringify({ success: true, track: trackName });

      } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
      }
    })()
  `

  return new Promise((resolve) => {
    csInterface.evalScript(script, (result) => {
      try {
        resolve(JSON.parse(result))
      } catch (_) {
        resolve({ success: false, error: result })
      }
    })
  })
}

// ── HTTP server ──────────────────────────────────────────────────────────────

function startServer() {
  if (server) return

  server = http.createServer((req, res) => {
    // Security: only accept requests from localhost / 127.0.0.1.
    // The Electron app calls http://localhost:18432 so the origin header is
    // either absent (no CORS pre-flight for same-origin) or starts with
    // "http://localhost" / "http://127.0.0.1".
    const origin = req.headers.origin || ''
    const isLocalOrigin =
      origin === '' ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')

    if (!isLocalOrigin) {
      res.writeHead(403)
      res.end()
      return
    }

    // CORS — reply with the exact origin received (or localhost fallback)
    const allowOrigin = origin || 'http://localhost'
    res.setHeader('Access-Control-Allow-Origin', allowOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    if (req.method === 'POST' && req.url === '/insert-audio') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body)
          const filePath =
            parsed && typeof parsed.filePath === 'string'
              ? parsed.filePath.trim()
              : ''

          if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: 'Missing filePath' }))
            return
          }

          const fileName = filePath.split(/[/\\]/).pop()
          updateMessage('正在插入: ' + fileName, 'waiting')

          const result = await insertAudioToTimeline(filePath)

          if (result.success) {
            const trackInfo = result.track ? ' → ' + result.track : ''
            updateMessage('✓ 已插入: ' + fileName + trackInfo, 'active')
          } else {
            updateMessage('✗ ' + result.error, 'error')
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: e.message }))
        }
      })
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      updateStatus('端口 18432 已被占用', 'error')
      updateMessage('请关闭占用该端口的程序后重启 Premiere', 'error')
    } else {
      updateStatus('服务器错误: ' + err.message, 'error')
    }
  })

  // Bind to loopback only — never expose to external network interfaces.
  server.listen(18432, '127.0.0.1', () => {
    updateStatus('服务已启动', 'active')
    updateMessage('等待 AudioSeek 发送音频文件...', 'waiting')
    // Populate track list once the server is up (sequence may already be open)
    refreshTracks()
  })
}

startServer()
