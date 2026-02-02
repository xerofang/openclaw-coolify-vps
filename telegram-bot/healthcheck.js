import { promises as fs } from 'fs';
try {
  const d = JSON.parse(await fs.readFile('/tmp/bot_health', 'utf8'));
  process.exit(Date.now() - d.ts < 60000 ? 0 : 1);
} catch { process.exit(1); }
