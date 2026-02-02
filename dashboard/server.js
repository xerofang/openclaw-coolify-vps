import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH = process.env.DASHBOARD_AUTH_TOKEN;
const QUEUE = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';

const auth = (req, res, next) => {
  if (!AUTH) return next();
  const t = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (t !== AUTH) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use(auth);

app.get('/', (_, res) => res.send(`<!DOCTYPE html><html><head><title>OpenClaw</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0f172a;color:#e2e8f0;padding:20px}.card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:20px}h1{color:#38bdf8;margin-bottom:20px}.stat{display:inline-block;margin-right:30px}.stat-value{font-size:32px;color:#38bdf8}.item{background:#334155;border-radius:8px;padding:15px;margin-bottom:10px}.badge{padding:4px 8px;border-radius:4px;font-size:12px}.pending{background:#fbbf24;color:#000}.approved{background:#22c55e}.rejected{background:#ef4444}</style></head><body><h1>🤖 OpenClaw Dashboard</h1><div class="card"><h2>Stats</h2><div id="stats">Loading...</div></div><div class="card"><h2>Queue</h2><div id="queue">Loading...</div></div><script>const t=new URLSearchParams(location.search).get('token')||'';async function load(){try{const s=await(await fetch('/api/stats?token='+t)).json();document.getElementById('stats').innerHTML='<div class="stat"><div class="stat-value">'+s.pending+'</div><div>Pending</div></div><div class="stat"><div class="stat-value">'+s.approved+'</div><div>Approved</div></div>';const q=await(await fetch('/api/queue?token='+t)).json();document.getElementById('queue').innerHTML=q.length?q.map(i=>'<div class="item"><span class="badge '+i.status+'">'+i.status+'</span> <b>'+i.id+'</b><br>'+i.description+'</div>').join(''):'<p>No items</p>';}catch(e){}}load();setInterval(load,30000);</script></body></html>`));

app.get('/api/stats', async (_, res) => {
  let pending = 0, approved = 0, rejected = 0;
  try { pending = (await fs.readdir(path.join(QUEUE, 'pending'))).filter(f => f.endsWith('.json')).length; } catch {}
  try {
    for (const f of (await fs.readdir(path.join(QUEUE, 'processed'))).filter(f => f.endsWith('.json'))) {
      const item = JSON.parse(await fs.readFile(path.join(QUEUE, 'processed', f), 'utf8'));
      if (item.status === 'approved') approved++;
      if (item.status === 'rejected') rejected++;
    }
  } catch {}
  res.json({ pending, approved, rejected });
});

app.get('/api/queue', async (_, res) => {
  const items = [];
  for (const dir of ['pending', 'processed']) {
    try {
      for (const f of (await fs.readdir(path.join(QUEUE, dir))).filter(f => f.endsWith('.json'))) {
        items.push(JSON.parse(await fs.readFile(path.join(QUEUE, dir, f), 'utf8')));
      }
    } catch {}
  }
  res.json(items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Dashboard on ${PORT}`));
