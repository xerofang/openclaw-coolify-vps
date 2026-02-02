/**
 * OpenClaw Dashboard - Simple Web Interface
 * Provides a web view of the approval queue and system status
 */

import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.DASHBOARD_AUTH_TOKEN;
const APPROVAL_QUEUE_PATH = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';

// Simple auth middleware
const authMiddleware = (req, res, next) => {
  if (!AUTH_TOKEN) return next();

  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.query.token;

  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use(authMiddleware);

// Dashboard HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>OpenClaw Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #38bdf8; margin-bottom: 20px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .card h2 { color: #94a3b8; font-size: 14px; text-transform: uppercase; margin-bottom: 15px; }
    .stat { display: inline-block; margin-right: 30px; }
    .stat-value { font-size: 32px; font-weight: bold; color: #38bdf8; }
    .stat-label { color: #64748b; font-size: 12px; }
    .item { background: #334155; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
    .item-header { display: flex; justify-content: space-between; align-items: center; }
    .item-id { font-family: monospace; color: #38bdf8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-pending { background: #fbbf24; color: #000; }
    .badge-approved { background: #22c55e; color: #000; }
    .badge-rejected { background: #ef4444; color: #fff; }
    .item-content { margin-top: 10px; color: #94a3b8; font-size: 14px; }
    .refresh { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 OpenClaw Dashboard</h1>

    <div class="card">
      <h2>System Status</h2>
      <div id="stats">Loading...</div>
    </div>

    <div class="card">
      <h2>Approval Queue</h2>
      <button class="refresh" onclick="loadQueue()">Refresh</button>
      <div id="queue" style="margin-top: 15px;">Loading...</div>
    </div>
  </div>

  <script>
    const token = new URLSearchParams(location.search).get('token') || '';

    async function fetchWithAuth(url) {
      return fetch(url + (url.includes('?') ? '&' : '?') + 'token=' + token);
    }

    async function loadStats() {
      try {
        const res = await fetchWithAuth('/api/stats');
        const data = await res.json();
        document.getElementById('stats').innerHTML = \`
          <div class="stat">
            <div class="stat-value">\${data.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat">
            <div class="stat-value">\${data.approved}</div>
            <div class="stat-label">Approved</div>
          </div>
          <div class="stat">
            <div class="stat-value">\${data.rejected}</div>
            <div class="stat-label">Rejected</div>
          </div>
        \`;
      } catch (e) {
        document.getElementById('stats').innerHTML = 'Error loading stats';
      }
    }

    async function loadQueue() {
      try {
        const res = await fetchWithAuth('/api/queue');
        const items = await res.json();

        if (items.length === 0) {
          document.getElementById('queue').innerHTML = '<p>No items in queue</p>';
          return;
        }

        document.getElementById('queue').innerHTML = items.map(item => \`
          <div class="item">
            <div class="item-header">
              <span class="item-id">\${item.id}</span>
              <span class="badge badge-\${item.status}">\${item.status}</span>
            </div>
            <div class="item-content">
              <strong>\${item.type}</strong>: \${item.description}<br>
              <small>Created: \${new Date(item.createdAt).toLocaleString()}</small>
            </div>
          </div>
        \`).join('');
      } catch (e) {
        document.getElementById('queue').innerHTML = 'Error loading queue';
      }
    }

    loadStats();
    loadQueue();
    setInterval(loadStats, 30000);
  </script>
</body>
</html>
  `);
});

// API: Get queue
app.get('/api/queue', async (req, res) => {
  try {
    const items = [];

    for (const dir of ['pending', 'processed']) {
      const dirPath = path.join(APPROVAL_QUEUE_PATH, dir);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(dirPath, file), 'utf8');
            items.push(JSON.parse(content));
          }
        }
      } catch (e) {}
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get stats
app.get('/api/stats', async (req, res) => {
  try {
    let pending = 0, approved = 0, rejected = 0;

    const pendingDir = path.join(APPROVAL_QUEUE_PATH, 'pending');
    const processedDir = path.join(APPROVAL_QUEUE_PATH, 'processed');

    try {
      pending = (await fs.readdir(pendingDir)).filter(f => f.endsWith('.json')).length;
    } catch (e) {}

    try {
      const files = await fs.readdir(processedDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(processedDir, file), 'utf8');
          const item = JSON.parse(content);
          if (item.status === 'approved') approved++;
          if (item.status === 'rejected') rejected++;
        }
      }
    } catch (e) {}

    res.json({ pending, approved, rejected });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on port ${PORT}`);
});
