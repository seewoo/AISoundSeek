// AudioSeek Insert - CEP Extension for Adobe Premiere Pro
// Listens on localhost:18432 for audio file paths and inserts them into the active timeline

const http = require('http');
const { evalScript } = require('csinterface');

let server = null;

function escapeForJS(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

function insertAudioToTimeline(filePath) {
  const escaped = escapeForJS(filePath);

  const script = `
    (function() {
      try {
        var f = new File("${escaped}");
        if (!f.exists) {
          return JSON.stringify({ success: false, error: "文件不存在: ${escaped}" });
        }
        var item = app.project.importFile(f);
        if (!item) {
          return JSON.stringify({ success: false, error: "导入失败" });
        }
        var seq = app.project.activeSequence;
        if (!seq) {
          return JSON.stringify({ success: false, error: "请先打开一个序列" });
        }
        // Insert at end of first audio track
        var track = seq.audioTracks[0];
        if (!track) {
          return JSON.stringify({ success: false, error: "序列中没有音频轨道" });
        }
        track.insertClip(item, seq.end);
        return JSON.stringify({ success: true });
      } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
      }
    })()
  `;

  return new Promise((resolve) => {
    evalScript(script, (result) => {
      try {
        resolve(JSON.parse(result));
      } catch {
        resolve({ success: false, error: result });
      }
    });
  });
}

function startServer() {
  if (server) return;

  server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/insert-audio') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { filePath } = JSON.parse(body);
          if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing filePath' }));
            return;
          }

          console.log('[AudioSeek Insert] Received:', filePath);
          const result = await insertAudioToTimeline(filePath);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(18432, () => {
    console.log('[AudioSeek Insert] Server running on port 18432');
  });

  server.on('error', (err) => {
    console.error('[AudioSeek Insert] Server error:', err);
  });
}

startServer();