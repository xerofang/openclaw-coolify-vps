import { promises as fs } from 'fs';

async function check() {
  try {
    const data = await fs.readFile('/tmp/instagram_health', 'utf8');
    const health = JSON.parse(data);
    const age = Date.now() - new Date(health.timestamp).getTime();
    if (age < 60000) process.exit(0);
  } catch (e) {}
  process.exit(1);
}

check();
